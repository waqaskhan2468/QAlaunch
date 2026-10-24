import { NextResponse } from "next/server"
import { Agent, fetch as undiciFetch } from "undici"
import { z } from "zod"

import { AppError, asyncHandler } from "@/lib/api/error"
import { getClientIp } from "@/lib/api/scan-start-rate-limit"
import { buildDetectResult } from "@/lib/php-check/detect"
import { isBlockedDomain } from "@/lib/scan/blocklist"
import { isPrivateUrl } from "@/lib/utils/url"

export const runtime = "nodejs"

const TIMEOUT_MS = 10_000
/** Enough to read <head>; we never need the whole page. */
const MAX_BYTES = 256 * 1024

/**
 * Plain browser UA. Many WordPress hosts and WAFs reject anything that
 * announces itself as a bot, and a check that is blocked for half the web is
 * not a check. We never route around a block, though — see below.
 */
const USER_AGENT =
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"

const agent = new Agent({ connectTimeout: TIMEOUT_MS })

const bodySchema = z.object({
	url: z.string().trim().min(3).max(300),
})

/** Per-IP, per-instance. Keeps one person from using this as a scan proxy. */
const PER_IP_PER_MINUTE = 10
const WINDOW_MS = 60_000
const buckets = new Map<string, { count: number; resetAt: number }>()

function withinLimit(ip: string): boolean {
	const now = Date.now()
	for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k)

	const b = buckets.get(ip)
	if (!b || b.resetAt <= now) {
		buckets.set(ip, { count: 1, resetAt: now + WINDOW_MS })
		return true
	}
	if (b.count >= PER_IP_PER_MINUTE) return false
	b.count += 1
	return true
}

/**
 * POST /api/php-check
 *
 * Makes exactly ONE request to the address the visitor typed and reports what
 * that single response volunteered: PHP banner, hosting platform, WordPress
 * signals, XML-RPC and REST advertisement, HTTPS behaviour, security headers.
 *
 * What it deliberately does not do, and why:
 *
 * - No extra paths. Not /readme.html, not /xmlrpc.php, not /wp-login.php, and
 *   above all not /.env or /wp-config.php.bak. The line is whether we are
 *   fetching something the operator published or testing a guess that they
 *   leaked something. Requesting a backup config file would also mean taking
 *   custody of a stranger's database password, which is not a thing this
 *   product should ever hold.
 * - No user enumeration, no POSTs, no credentials, nothing that writes state.
 * - No block evasion. A 403 or 429 is reported as "blocked" and we stop.
 *   Routing around a block is affirmative evidence of knowing you were not
 *   welcome, and it is the single worst thing a tool like this can do.
 *
 * Everything above is one page load's worth of traffic — less than a visitor
 * costs the site.
 */
export const POST = asyncHandler(async (req: Request) => {
	if (!withinLimit(getClientIp(req))) {
		throw new AppError(
			429,
			"rate_limit_exceeded",
			"Too many checks from your network. Please wait a minute and try again.",
		)
	}

	let json: unknown
	try {
		json = await req.json()
	} catch {
		throw new AppError(400, "invalid_request", "Invalid request body.")
	}

	const parsed = bodySchema.safeParse(json)
	if (!parsed.success) {
		throw new AppError(400, "invalid_request", "Enter a website address.")
	}

	const raw = parsed.data.url.trim()
	let target: URL
	try {
		target = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
	} catch {
		throw new AppError(400, "invalid_url", "That does not look like a website address.")
	}

	if (!["http:", "https:"].includes(target.protocol)) {
		throw new AppError(400, "invalid_url", "Only http and https addresses can be checked.")
	}
	// SSRF: never let this endpoint be pointed at our own network.
	if (isPrivateUrl(target.toString())) {
		throw new AppError(400, "invalid_url", "That address is not reachable from the internet.")
	}
	if (isBlockedDomain(target.hostname)) {
		throw new AppError(400, "blocked_domain", "That website cannot be checked.")
	}

	const requestedHttp = target.protocol === "http:"
	const controller = new AbortController()
	const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

	try {
		const res = await undiciFetch(target.toString(), {
			signal: controller.signal as AbortSignal,
			dispatcher: agent,
			redirect: "follow",
			headers: { "User-Agent": USER_AGENT, Accept: "text/html,*/*" },
		})

		// Blocked is a result, not a failure, and not an invitation to retry
		// differently.
		if (res.status === 403 || res.status === 429 || res.status === 503) {
			return NextResponse.json({
				ok: true,
				blocked: true,
				httpStatus: res.status,
				finalUrl: res.url,
			})
		}

		// Read only enough for <head>. No reason to pull a whole page.
		let html = ""
		if (res.body) {
			const reader = res.body.getReader()
			const decoder = new TextDecoder()
			let total = 0
			while (total < MAX_BYTES) {
				const { done, value } = await reader.read()
				if (done) break
				total += value.byteLength
				html += decoder.decode(value, { stream: true })
			}
			await reader.cancel().catch(() => {})
		}

		const result = buildDetectResult({
			finalUrl: res.url || target.toString(),
			httpStatus: res.status,
			requestedHttp,
			headers: res.headers as unknown as Headers,
			html,
		})

		return NextResponse.json({ ok: true, blocked: false, result })
	} catch {
		throw new AppError(
			502,
			"unreachable",
			"We could not reach that website. Check the address and try again.",
		)
	} finally {
		clearTimeout(timer)
	}
})
