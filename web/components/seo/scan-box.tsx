"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight } from "lucide-react"

import { captureAttribution } from "@/lib/analytics/attribution"
import { isValidPublicWebsiteUrl } from "@/lib/validation/url"
import { formatPackagePrice } from "@/components/pricing/pricing-plans"

/**
 * Free-scan box for the /fix and /tools pages.
 *
 * Starts the same free scan as the homepage hero (same endpoint, same
 * attribution capture, same free-preview-used handling) so a visitor who lands
 * on a guide can test their own site without first going to the homepage. The
 * hero is left as it is; this is a separate copy so the two can't break each
 * other.
 */
export function ScanBox({
	heading = "Test your site for this now",
	note,
	tone = "light",
}: {
	heading?: string
	note?: string
	tone?: "light" | "dark"
}) {
	const router = useRouter()
	const [url, setUrl] = useState("")
	const [isStarting, setIsStarting] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const submit = async (e: React.FormEvent) => {
		e.preventDefault()
		const raw = url.trim()
		if (!raw || isStarting) return
		if (!isValidPublicWebsiteUrl(raw)) {
			setError("Please enter a valid public website URL.")
			return
		}
		const value = raw.startsWith("http://") || raw.startsWith("https://") ? raw : `https://${raw}`

		try {
			setIsStarting(true)
			setError(null)
			const res = await fetch("/api/scan/start", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ url: value, package: "free", attribution: captureAttribution() }),
			})
			const payload = (await res.json()) as
				| { ok: true; scanId: string }
				| { ok: false; code?: string; message?: string }

			if (res.status === 409 && payload.ok === false && payload.code === "free_preview_used") {
				router.push(`/result?url=${encodeURIComponent(value)}&freePreviewUsed=1`)
				return
			}
			if (payload.ok !== true || !payload.scanId) {
				setError((payload.ok === false && payload.message) || "Could not start your free scan. Please try again.")
				setIsStarting(false)
				return
			}
			router.push(`/result?url=${encodeURIComponent(value)}&scanId=${encodeURIComponent(payload.scanId)}`)
		} catch {
			setError("Could not start your free scan. Please try again.")
			setIsStarting(false)
		}
	}

	const dark = tone === "dark"

	return (
		<form
			onSubmit={submit}
			className={dark ? "bg-[#0f1a2e] border border-[#22304a] p-5 md:p-6" : "bg-[#eef6f0] border border-[#d1e9d9] p-5 md:p-6"}>
			<label
				htmlFor="seo-scan-url"
				className={`block font-bold text-lg mb-3 ${dark ? "text-white" : "text-[#09111f]"}`}>
				{heading}
			</label>
			<div className="flex flex-col sm:flex-row gap-2">
				<input
					id="seo-scan-url"
					type="text"
					inputMode="url"
					autoComplete="url"
					placeholder="yourwebsite.com"
					value={url}
					onChange={(e) => setUrl(e.target.value)}
					className="flex-1 min-w-0 border border-[#cfd6e0] bg-white px-4 py-3 text-[15px] text-[#09111f] outline-none focus:border-[#16a34a] focus:ring-2 focus:ring-[#16a34a]/20"
				/>
				<button
					type="submit"
					disabled={isStarting}
					className="inline-flex items-center justify-center gap-2 bg-[#22c55e] text-[#06140d] font-bold px-5 py-3 text-sm hover:bg-[#16a34a] transition-colors disabled:opacity-60 whitespace-nowrap">
					{isStarting ? "Starting…" : "Scan free"}
					{!isStarting && <ArrowRight className="size-4" aria-hidden />}
				</button>
			</div>
			{error ? (
				<p role="alert" className="mt-2 text-sm font-semibold text-[#dc2626]">
					{error}
				</p>
			) : null}
			<p className={`mt-3 text-xs ${dark ? "text-[#8a96ad]" : "text-[#5b6472]"}`}>
				{note ??
					`Opens your site in a real browser on desktop and phone. Free, about two minutes, no signup. Full report from ${formatPackagePrice("basic")}.`}
			</p>
		</form>
	)
}
