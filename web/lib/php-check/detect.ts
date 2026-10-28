import { assessPhpVersion, type PhpVerdict } from "./php-versions"

/**
 * Everything this check reads comes from ONE request to the URL the visitor
 * typed, plus its TLS handshake. No extra paths are fetched, nothing is
 * enumerated, nothing is submitted.
 *
 * That boundary is deliberate and it is where this stops. The line that
 * matters is not the HTTP verb — it is whether we are fetching a resource the
 * operator published, or testing a hypothesis that the operator leaked
 * something. Requesting someone's homepage is the first; requesting
 * /wp-config.php.bak is the second, and it would also mean taking custody of a
 * stranger's database credentials.
 *
 * Two findings here are worth the attention they get: `X-Pingback` and
 * `Link: <...>; rel="https://api.w.org/"` reveal that XML-RPC and the REST API
 * are enabled, with no probe at all. The server volunteers both in response to
 * an ordinary page load.
 */

export type HeaderFinding = {
	id: string
	/** What the visitor is told. Never asserts a conclusion about their site. */
	label: string
	present: boolean
	/** Plain-English consequence, for someone who is not a developer. */
	detail: string
}

export type DetectResult = {
	finalUrl: string
	httpStatus: number
	/** Raw banner, exactly as the server printed it. May be null. */
	phpVersionDetected: string | null
	phpVerdict: PhpVerdict
	/** Hosting platform inferred from headers, when it names itself. */
	platform: string | null
	/** Whether the page looks like WordPress, and on what evidence. */
	wordpress: { detected: boolean; evidence: string[]; version: string | null }
	/** XML-RPC / REST reachability, read from headers only — never probed. */
	xmlrpcAdvertised: boolean
	restApiAdvertised: boolean
	servedOverHttps: boolean
	redirectedToHttps: boolean
	securityHeaders: HeaderFinding[]
}

function header(h: Headers, name: string): string | null {
	const v = h.get(name)
	return v && v.trim() ? v.trim() : null
}

/** Pulls `8.3.8` out of `PHP/8.3.8`, and nothing else. */
export function parsePhpVersion(headers: Headers): string | null {
	for (const name of ["x-powered-by", "server"]) {
		const raw = header(headers, name)
		if (!raw) continue
		const m = /PHP\/(\d+\.\d+(?:\.\d+)?)/i.exec(raw)
		if (m) return m[1]
	}
	return null
}

/**
 * Names the platform when the server names itself.
 *
 * Worth more than it looks. In a sample of twenty WordPress-ecosystem sites,
 * only one printed a PHP version, but nine printed a platform. "Did my host
 * patch this" is the question people are actually asking, and a platform name
 * answers it far more usefully than a stale banner number would.
 */
export function identifyPlatform(headers: Headers): string | null {
	const candidates = [
		header(headers, "x-powered-by"),
		header(headers, "server"),
		header(headers, "x-served-by"),
	].filter(Boolean) as string[]

	const KNOWN: Array<[RegExp, string]> = [
		[/wordpress\s*vip/i, "WordPress VIP"],
		[/wp\s*engine/i, "WP Engine"],
		[/elementor\s*cloud/i, "Elementor Cloud"],
		[/kinsta/i, "Kinsta"],
		[/siteground|sg_?optimizer/i, "SiteGround"],
		[/pressable/i, "Pressable"],
		[/flywheel/i, "Flywheel"],
		[/cloudways/i, "Cloudways"],
		[/hostinger|hcdn/i, "Hostinger"],
		[/godaddy/i, "GoDaddy"],
		[/bluehost/i, "Bluehost"],
		[/dreamhost/i, "DreamHost"],
		[/\bnext\.js\b/i, "Next.js"],
		[/cloudflare/i, "Cloudflare"],
	]

	for (const raw of candidates) {
		for (const [re, name] of KNOWN) {
			if (re.test(raw)) return name
		}
	}
	return null
}

/**
 * Security headers, scored on presence only.
 *
 * Presence is a fact about the response. Whether a given CSP is *good* is a
 * judgement call that needs the site's own context, so this reports what is
 * there and what each one does, and leaves grading alone.
 */
export function readSecurityHeaders(h: Headers): HeaderFinding[] {
	const def: Array<[string, string, string, string]> = [
		[
			"hsts",
			"strict-transport-security",
			"Forces HTTPS",
			"Tells browsers to refuse an unencrypted connection to your site in future, even if someone is handed an http:// link.",
		],
		[
			"csp",
			"content-security-policy",
			"Content Security Policy",
			"Limits which scripts are allowed to run. This is the header that most reduces the damage if something malicious is ever injected into a page.",
		],
		[
			"xfo",
			"x-frame-options",
			"Clickjacking protection",
			"Stops another site loading yours inside a hidden frame to trick your visitors into clicking something.",
		],
		[
			"xcto",
			"x-content-type-options",
			"MIME-sniffing protection",
			"Stops a browser guessing that an uploaded file is a script when you said it was an image.",
		],
		[
			"referrer",
			"referrer-policy",
			"Referrer control",
			"Controls how much of your page address is handed to other sites your visitors click through to.",
		],
		[
			"permissions",
			"permissions-policy",
			"Permissions policy",
			"Controls which browser features — camera, microphone, location — embedded content is allowed to request.",
		],
	]

	return def.map(([id, name, label, detail]) => ({
		id,
		label,
		present: Boolean(header(h, name) ?? (id === "permissions" ? header(h, "feature-policy") : null)),
		detail,
	}))
}

/** WordPress signals a page volunteers about itself. */
export function detectWordPress(
	headers: Headers,
	html: string,
): { detected: boolean; evidence: string[]; version: string | null } {
	const evidence: string[] = []
	let version: string | null = null

	const generator = /<meta[^>]+name=["']generator["'][^>]+content=["']([^"']*WordPress[^"']*)["']/i.exec(
		html,
	)
	if (generator) {
		evidence.push(`Generator tag: ${generator[1].slice(0, 60)}`)
		// "WordPress 6.7.1" -> "6.7.1". Often stripped by security plugins, so
		// absence says nothing either way.
		const v = /WordPress\s+(\d+\.\d+(?:\.\d+)?)/i.exec(generator[1])
		if (v) version = v[1]
	}
	if (/\/wp-content\//i.test(html)) evidence.push("Loads files from /wp-content/")
	if (/\/wp-includes\//i.test(html)) evidence.push("Loads files from /wp-includes/")
	if (header(headers, "x-pingback")) evidence.push("Sends an X-Pingback header")
	if (/api\.w\.org/i.test(header(headers, "link") ?? "")) {
		evidence.push("Advertises the WordPress REST API")
	}

	return { detected: evidence.length > 0, evidence, version }
}

export function buildDetectResult(input: {
	finalUrl: string
	httpStatus: number
	requestedHttp: boolean
	headers: Headers
	html: string
}): DetectResult {
	const { finalUrl, httpStatus, requestedHttp, headers, html } = input

	const phpVersionDetected = parsePhpVersion(headers)
	const linkHeader = header(headers, "link") ?? ""

	return {
		finalUrl,
		httpStatus,
		phpVersionDetected,
		phpVerdict: assessPhpVersion(phpVersionDetected),
		platform: identifyPlatform(headers),
		wordpress: detectWordPress(headers, html),
		// Both read from headers the server volunteered. Neither path is requested.
		xmlrpcAdvertised: Boolean(header(headers, "x-pingback")),
		restApiAdvertised: /api\.w\.org/i.test(linkHeader),
		servedOverHttps: finalUrl.startsWith("https:"),
		redirectedToHttps: requestedHttp && finalUrl.startsWith("https:"),
		securityHeaders: readSecurityHeaders(headers),
	}
}
