/**
 * Instructions + formatting so Claude uses full Google PSI output (not Playwright timing).
 */
export const PAGE_SPEED_CLAUDE_INSTRUCTIONS = [
	'GOOGLE PAGESPEED INSIGHTS (authoritative for performance & Core Web Vitals):',
	'- Source: Google PageSpeed API only — NOT measured in the browser automation pass.',
	'- Shape: { mobile, desktop, strategyErrors? }. Each strategy may include:',
	'  • Scores (0–100): performance, seo, accessibility, bestPractices',
	'  • Lab vitals (ms unless noted): lcpMs, fcpMs, cls, ttiMs, inpMs, tbtMs, speedIndex, ttfbMs',
	'  • opportunities[]: Lighthouse failing audits (title, displayValue, score) — cite these for performance fixes',
	'  • fieldVitals: real-user CrUX percentiles when present (lcpMs, inpMs, cls, fcpMs)',
	'  • finalUrl, fetchedAt',
	'- Use BOTH mobile and desktop when available; compare them for category "performance" and "responsiveness".',
	'- category "performance": MUST cite specific PSI metrics or opportunity titles (e.g. LCP 4.5s, "Reduce unused JavaScript").',
	'- category "seo": may use PSI seo score AND on-page SEO ELEMENTS below; do not invent Lighthouse SEO audits.',
	'- Do NOT infer LCP/FCP/CLS/INP or performance scores from screenshots, console timing, or network waterfalls.',
	'- evidence for PSI-only findings: use "programmatic".',
].join('\n');

export function formatPageSpeedForClaude(pageSpeedData: unknown): string {
	if (pageSpeedData === null || pageSpeedData === undefined) {
		return JSON.stringify({ error: 'no_page_speed_data' });
	}
	try {
		return JSON.stringify(pageSpeedData, null, 2);
	} catch {
		return String(pageSpeedData);
	}
}
