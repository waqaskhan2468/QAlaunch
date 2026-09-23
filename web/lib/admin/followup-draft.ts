/**
 * Builds the personalised follow-up email offered in /admin for a free scan.
 *
 * The pitch is grounded in that scan's real findings — issue counts and actual
 * issue titles the visitor never saw — because a generic "you may have more
 * issues" note is indistinguishable from spam, while "3 critical issues on
 * yourstore.com, here are two of them" is a report they asked for.
 *
 * Two variants, chosen by what the scan found:
 *  - `locked`: issues exist beyond the free preview → lead with those.
 *  - `clean`:  nothing withheld → the homepage looked fine, so pitch the rest
 *              of the site instead of inventing problems.
 */

export type FollowUpScan = {
	host: string
	/** Total non-suggestion issues found on the scanned page. */
	totalIssues: number
	/** Issues rated critical or high. */
	highSeverityCount: number
	/** Titles the visitor did NOT see in the free preview. */
	lockedTitles: string[]
}

export type FollowUpDraft = {
	subject: string
	body: string
	variant: 'locked' | 'clean'
}

const SIGNATURE = [
	'Waqas',
	'QAlaunch · getqalaunch.com',
	'',
	'---',
]

function optOut(host: string): string {
	return `You're receiving this because ${host} was scanned on QAlaunch. Reply "no thanks" and I won't follow up again.`
}

export function buildFollowUpDraft(scan: FollowUpScan): FollowUpDraft {
	const { host, totalIssues, highSeverityCount, lockedTitles } = scan
	const samples = lockedTitles.slice(0, 2)

	if (samples.length > 0) {
		const severityLine =
			highSeverityCount > 0 ?
				`${totalIssues} on that page, ${highSeverityCount} of them rated critical or high`
			:	`${totalIssues} on that page`

		const body = [
			'Hi,',
			'',
			`Thanks for running a free QAlaunch scan on ${host} — I'm Waqas, the QA engineer who built it.`,
			'',
			`Your free preview showed the top 3 issues. The scan actually found ${severityLine}. A couple you haven't seen yet:`,
			'',
			...samples.map((t) => `  • ${t}`),
			'',
			"Here's the thing that scan can't tell you though: it only looked at your homepage, and it only catches what an automated check can see. It doesn't try to buy anything, fill in your forms, or follow the path a real customer takes.",
			'',
			`So if it matters that ${host} actually works — a launch coming up, ads running to it, a checkout that has to hold — I'll test it myself. Up to 10 key pages, gone through by hand on real phones and desktops, every flow a customer uses. You get a written report in plain language with screenshots, and a 15-minute call to walk through it. $299, done in 3 business days.`,
			'',
			"That's 9 years of professional QA testing, not a tool. Reply and tell me about the site and I'll give you a straight answer — including if I think you don't need it.",
			'',
			'If you just want the rest of what the scan found, the full automated report for that page is $9.',
			'',
			'Either way, good luck with it.',
			'',
			...SIGNATURE,
			optOut(host),
		].join('\n')

		return {
			subject: `${totalIssues} issues found on ${host}`,
			body,
			variant: 'locked',
		}
	}

	const body = [
		'Hi,',
		'',
		`Thanks for running a free QAlaunch scan on ${host} — I'm Waqas, the QA engineer who built it.`,
		'',
		'Good news first: the homepage came back clean, which is genuinely uncommon.',
		'',
		'The free scan only covers that one page though, and in my experience the problems usually sit deeper in — pricing pages, contact forms, product pages, anything added later or edited after launch. Those are the pages nobody re-checks.',
		'',
		'A 5-page report is $24 and covers the paths visitors actually take through the site.',
		'',
		`If it matters that ${host} actually works — a launch coming up, ads running to it, a checkout that has to hold — I'll test it myself rather than leaving it to a tool. Up to 10 key pages, gone through by hand on real phones and desktops, every flow a customer actually uses. Written report in plain language with screenshots, plus a 15-minute call. $299, done in 3 business days.`,
		'',
		"That's 9 years of professional QA testing behind it. Reply and tell me about the site and I'll give you a straight answer — including if I think you don't need it.",
		'',
		'Either way, nice work on the site.',
		'',
		...SIGNATURE,
		optOut(host),
	].join('\n')

	return { subject: `Your QAlaunch scan of ${host}`, body, variant: 'clean' }
}

/**
 * Plain text rendered as minimal HTML. Deliberately unbranded: a 1:1 follow-up
 * that looks like a marketing template reads as bulk mail and gets a far lower
 * reply rate than one that looks like a person typed it.
 */
export function draftBodyToHtml(body: string): string {
	const escaped = body
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
	return `<div style="font-family:-apple-system,'Segoe UI',Arial,sans-serif;font-size:14px;line-height:22px;color:#18293A;white-space:pre-wrap;">${escaped}</div>`
}
