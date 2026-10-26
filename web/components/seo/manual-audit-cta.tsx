"use client"

import { useState } from "react"
import { usePathname } from "next/navigation"

/**
 * $299 done-for-you manual testing offer for the /fix and /tools pages.
 *
 * Posts to the same /api/audit-enquiry endpoint as the result-page offer
 * (components/audit/audit-enquiry.tsx), so leads land in the same inbox. That
 * component assumes a scan already happened and takes the site from it; here
 * the visitor hasn't scanned, so the site is a field, and the page they came
 * from is appended to the message so it's clear which guide produced the lead.
 */
const PRICE = "$299"
const TURNAROUND = "3 business days"

type Status = "idle" | "sending" | "sent" | "error"

export function ManualAuditCta({ context }: { context: string }) {
	const pathname = usePathname()
	const [open, setOpen] = useState(false)
	const [status, setStatus] = useState<Status>("idle")
	const [error, setError] = useState<string | null>(null)

	async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault()
		if (status === "sending") return
		const form = new FormData(e.currentTarget)
		const concern = String(form.get("concern") ?? "").trim()
		const payload = {
			name: String(form.get("name") ?? "").trim(),
			email: String(form.get("email") ?? "").trim(),
			websiteUrl: String(form.get("website") ?? "").trim() || undefined,
			concern: `${concern}${concern ? "\n\n" : ""}(Sent from ${pathname})`,
			company: String(form.get("company") ?? ""),
		}
		setStatus("sending")
		setError(null)
		try {
			const res = await fetch("/api/audit-enquiry", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			})
			const data = (await res.json().catch(() => null)) as { ok?: boolean; message?: string } | null
			if (!res.ok || !data?.ok) {
				setStatus("error")
				setError(data?.message ?? "Something went wrong. Please try again.")
				return
			}
			setStatus("sent")
		} catch {
			setStatus("error")
			setError("Could not reach the server. Please check your connection and try again.")
		}
	}

	const inputClass =
		"w-full border border-[#cfd6e0] bg-white px-3 py-2.5 text-[14px] text-[#09111f] outline-none focus:border-[#16a34a] focus:ring-2 focus:ring-[#16a34a]/20"

	return (
		<section className="border-2 border-[#09111f] bg-white">
			<div className="bg-[#09111f] px-6 py-5 text-white">
				<div className="text-[11px] font-bold uppercase tracking-widest text-[#22c55e]">Done for you · not automated</div>
				<h2 className="mt-2 text-2xl font-extrabold">Rather have a QA engineer test it by hand?</h2>
				<p className="mt-2 text-[14.5px] leading-relaxed text-[#aab3c8]">{context}</p>
			</div>
			<div className="grid md:grid-cols-[1.1fr_1fr]">
				<div className="border-b border-[#e3e5ea] p-6 md:border-b-0 md:border-r">
					<div className="mb-4 flex items-baseline gap-2">
						<span className="text-3xl font-extrabold text-[#09111f]">{PRICE}</span>
						<span className="text-[13.5px] text-[#5b6472]">one-time · {TURNAROUND}</span>
					</div>
					<ul className="space-y-2.5 text-[14px] text-[#09111f]">
						{[
							"Up to 10 key pages tested by hand, not a scan",
							"Every flow a customer uses: forms, sign-up, checkout, booking",
							"Real mobile and desktop browsers",
							"A written report in plain language, with screenshots",
							"A 15-minute call to walk you through it",
							"10 years of professional QA experience",
						].map((item) => (
							<li key={item} className="flex items-start gap-2.5">
								<span aria-hidden className="mt-[7px] size-1.5 shrink-0 rounded-full bg-[#22c55e]" />
								<span>{item}</span>
							</li>
						))}
					</ul>
				</div>
				<div className="bg-[#f5f6f8] p-6">
					{status === "sent" ? (
						<div>
							<div className="text-[19px] font-extrabold text-[#09111f]">Thanks, I&apos;ve got it.</div>
							<p className="mt-2 text-[14px] leading-relaxed text-[#3b4253]">
								I&apos;ll reply personally within one business day, usually sooner.
							</p>
						</div>
					) : !open ? (
						<div>
							<p className="text-[14px] leading-relaxed text-[#3b4253]">
								Tell me about your site and I&apos;ll reply personally, usually the same day.
							</p>
							<button
								type="button"
								onClick={() => setOpen(true)}
								className="mt-4 inline-flex items-center justify-center bg-[#09111f] px-5 py-3 text-sm font-extrabold text-white hover:bg-[#1e293b]">
								Request manual testing →
							</button>
							<p className="mt-3 text-[12px] text-[#5b6472]">No payment now. I&apos;ll confirm scope and price first.</p>
						</div>
					) : (
						<form onSubmit={handleSubmit} className="relative flex flex-col gap-3">
							<div aria-hidden="true" className="absolute left-[-9999px] top-0 h-0 w-0 overflow-hidden">
								<label htmlFor="mac-company">Company (leave this empty)</label>
								<input id="mac-company" name="company" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
							</div>
							<label className="text-[12px] font-bold uppercase tracking-wide text-[#5b6472]">
								Your name
								<input name="name" required maxLength={120} autoComplete="name" className={`mt-1 ${inputClass}`} />
							</label>
							<label className="text-[12px] font-bold uppercase tracking-wide text-[#5b6472]">
								Email
								<input name="email" type="email" required maxLength={160} autoComplete="email" className={`mt-1 ${inputClass}`} />
							</label>
							<label className="text-[12px] font-bold uppercase tracking-wide text-[#5b6472]">
								Website
								<input name="website" maxLength={300} placeholder="yourwebsite.com" className={`mt-1 ${inputClass}`} />
							</label>
							<label className="text-[12px] font-bold uppercase tracking-wide text-[#5b6472]">
								What worries you most? <span className="font-medium normal-case">(optional)</span>
								<textarea name="concern" rows={3} maxLength={1800} className={`mt-1 resize-y ${inputClass}`} />
							</label>
							{status === "error" && error ? (
								<p role="alert" className="text-[13px] font-semibold text-[#dc2626]">
									{error}
								</p>
							) : null}
							<button
								type="submit"
								disabled={status === "sending"}
								className="mt-1 inline-flex items-center justify-center bg-[#09111f] px-5 py-3 text-sm font-extrabold text-white hover:bg-[#1e293b] disabled:opacity-60">
								{status === "sending" ? "Sending…" : "Send enquiry →"}
							</button>
							<p className="text-[12px] text-[#5b6472]">Goes straight to my inbox. No payment now, no newsletter.</p>
						</form>
					)}
				</div>
			</div>
		</section>
	)
}
