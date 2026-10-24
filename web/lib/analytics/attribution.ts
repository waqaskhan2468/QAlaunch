/**
 * First-touch attribution, captured in the browser.
 *
 * Two sales exist and nobody can say which channel produced either. Every
 * experiment so far — $42 of Reddit Ads, a Facebook post that drove 176 scans,
 * organic search, and now a few hundred programmatic pages — arrives in the
 * database as the same anonymous row. This is what fixes that.
 *
 * FIRST touch, held for the session. Someone who arrives from a search result,
 * reads two pages and then runs a scan is credited to search, not to the
 * internal link they clicked last. For a funnel this short that is the honest
 * model, and it is the one that answers "what should I spend more on".
 *
 * sessionStorage rather than localStorage: a visit a month later from a
 * different source should be recorded as that source, not as whatever brought
 * them the first time ever.
 *
 * Privacy: the referrer is reduced to its host before anything is stored. A
 * full referring URL can carry someone's search terms or a private page they
 * came from, and nothing here needs that.
 */

const KEY = "qa_attr_v1"

export type Attribution = {
	utmSource?: string
	utmMedium?: string
	utmCampaign?: string
	referrerHost?: string
	landingPath?: string
}

/** Everything stored is capped, because these end up in a database and an email. */
const MAX = 120

function clean(value: string | null | undefined): string | undefined {
	if (!value) return undefined
	// Control characters would corrupt a header or a log line downstream.
	const trimmed = value.replace(/[\u0000-\u001F\u007F]/g, " ").trim()
	if (!trimmed) return undefined
	return trimmed.slice(0, MAX)
}

/** google.com from https://www.google.com/search?q=secret — host only, www dropped. */
export function referrerHostOf(referrer: string, selfHost: string): string | undefined {
	if (!referrer) return undefined
	try {
		const host = new URL(referrer).hostname.replace(/^www\./, "")
		// An internal link is not a source; treat it as direct.
		if (!host || host === selfHost.replace(/^www\./, "")) return undefined
		return host.slice(0, MAX)
	} catch {
		return undefined
	}
}

/**
 * Reads the attribution for this session, capturing it on first call.
 *
 * Safe to call on any page and as often as you like. Returns an empty object
 * rather than throwing when storage is unavailable — private windows, blocked
 * site data and prerender all do that, and a scan must never fail because
 * analytics could not write.
 */
export function captureAttribution(): Attribution {
	if (typeof window === "undefined") return {}

	try {
		const existing = window.sessionStorage.getItem(KEY)
		if (existing) return JSON.parse(existing) as Attribution
	} catch {
		// Storage unavailable. Fall through and return a fresh read without
		// persisting; a single uncredited scan beats a broken one.
	}

	const params = new URLSearchParams(window.location.search)
	const attribution: Attribution = {
		utmSource: clean(params.get("utm_source")),
		utmMedium: clean(params.get("utm_medium")),
		utmCampaign: clean(params.get("utm_campaign")),
		referrerHost: clean(referrerHostOf(document.referrer, window.location.hostname)),
		landingPath: clean(window.location.pathname),
	}

	try {
		window.sessionStorage.setItem(KEY, JSON.stringify(attribution))
	} catch {
		// See above.
	}

	return attribution
}
