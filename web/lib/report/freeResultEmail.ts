import { escapeHtml } from '@/lib/api/email-safety';
import { labelFromScore } from '@/lib/scoring/health';

/**
 * The email someone gets when the free scan they asked to be notified about
 * finishes.
 *
 * What it is trying to do, in order:
 *
 * 1. Get opened. The subject names their own domain and the finding. Nobody
 *    opens "Your QAlaunch report is ready"; people open mail about their site.
 * 2. Land the result in the first screen — score, count, and three issues in
 *    their own words. The proof has to be in the email, not behind a click,
 *    because most readers will never click.
 * 3. One obvious action: see the rest.
 * 4. The paid options last, phrased as what they add rather than as a pitch.
 *
 * The audience is a small-business owner who built the site themselves, not a
 * developer. No jargon, no severity codes, no "actionable insights".
 *
 * Honesty constraints, which this product has got wrong before and paid for:
 * only issues the free result already shows are listed — the email never
 * teases findings behind the paywall as if they were visible, never invents a
 * count, and never claims more testing than actually ran. If there are no
 * issues it says so plainly rather than manufacturing concern.
 */

export type ResultEmailIssue = {
	severity: string | null;
	title: string;
};

export type FreeResultEmailInput = {
	targetUrl: string;
	resultUrl: string;
	healthScore: number;
	issueCount: number;
	/** Only issues already visible on the free result page. */
	topIssues: ResultEmailIssue[];
};

const NAVY = '#09111F';
const INK = '#18293A';
const MUTED = '#6B7C8F';
const GREEN = '#15803D';
const BORDER = '#DDE6F0';

/** example.com from https://example.com/pricing — what they call their site. */
export function displayDomain(rawUrl: string): string {
	try {
		return new URL(rawUrl).hostname.replace(/^www\./, '');
	} catch {
		return rawUrl.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
	}
}

function scoreColour(score: number): string {
	if (score >= 80) return '#15803D';
	if (score >= 60) return '#B45309';
	return '#B91C1C';
}

/**
 * Subject line.
 *
 * Their domain first, because that is the only word in an inbox they are
 * certain to recognise, then the single most useful fact. No brand name: it is
 * in the sender, and spending subject characters on ourselves costs opens.
 */
export function buildSubject(input: {
	targetUrl: string;
	issueCount: number;
}): string {
	const domain = displayDomain(input.targetUrl);
	if (input.issueCount === 0) return `${domain} — your scan found no issues`;
	const noun = input.issueCount === 1 ? 'issue' : 'issues';
	return `${domain} — ${input.issueCount} ${noun} found`;
}

/** Preview text: the line inboxes show next to the subject. */
function preheader(input: { healthScore: number; issueCount: number }): string {
	if (input.issueCount === 0) {
		return 'Everything we tested came back clean. Here is what we checked.';
	}
	return `Health score ${input.healthScore}. Here are the first few, with a screenshot of each.`;
}

export function buildFreeResultEmailText(input: FreeResultEmailInput): string {
	const domain = displayDomain(input.targetUrl);
	const lines = [
		`Your scan of ${domain} is done.`,
		'',
	];

	if (input.issueCount === 0) {
		lines.push('We did not find any issues on the page we tested. That is a good result.');
	} else {
		lines.push(
			`Health score: ${input.healthScore} out of 100 (${labelFromScore(input.healthScore)})`,
			`Issues found: ${input.issueCount}`,
			'',
			'A few of them:',
			...input.topIssues.map((issue) => `  - ${issue.title}`),
		);
	}

	lines.push(
		'',
		`See the full results, with a screenshot of each one: ${input.resultUrl}`,
		'',
		'---',
		'',
		'Want the rest?',
		'A full report explains what each issue means, why it matters to a visitor,',
		'and what to change. One-time payment from $9, no subscription.',
		'',
		'Or if you would rather not do it yourself: I test the site by hand,',
		'the way a real customer would use it, and send you a written report in',
		'3 business days. $299. Reply to this email and ask.',
		'',
		'— Waqas, QAlaunch',
		'',
		'Results are produced automatically and can occasionally flag something',
		'that is not a real problem. The screenshots show you exactly what we saw.',
	);

	return lines.join('\n');
}

export function buildFreeResultEmailHtml(input: FreeResultEmailInput): string {
	const domain = escapeHtml(displayDomain(input.targetUrl));
	const resultUrl = escapeHtml(input.resultUrl);
	const clean = input.issueCount === 0;

	const issueRows = input.topIssues
		.map(
			(issue) => `
				<tr>
					<td style="padding:11px 0;border-bottom:1px solid ${BORDER};vertical-align:top;">
						<span style="color:${INK};font-size:16px;line-height:23px;">${escapeHtml(issue.title)}</span>
					</td>
				</tr>`,
		)
		.join('');

	const remaining = input.issueCount - input.topIssues.length;

	const findings =
		clean ?
			`<p style="margin:0 0 6px;color:${INK};font-size:17px;line-height:26px;">
				We did not find any issues on the page we tested. That is a good result
				and worth knowing.
			</p>`
		:	`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
				${issueRows}
			</table>
			${
				remaining > 0 ?
					`<p style="margin:14px 0 0;color:${MUTED};font-size:15px;line-height:22px;">
						and ${remaining} more.
					</p>`
				:	''
			}`;

	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light only" />
<title>Your scan of ${domain}</title>
</head>
<body style="margin:0;padding:0;background:#F4F8FC;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(
		preheader(input),
	)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F8FC;">
	<tr>
		<td align="center" style="padding:28px 14px;">
			<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#FFFFFF;border:1px solid ${BORDER};border-radius:14px;overflow:hidden;font-family:'Segoe UI',Arial,Helvetica,sans-serif;">

				<tr>
					<td style="padding:20px 28px;background:${NAVY};">
						<span style="color:#FFFFFF;font-size:17px;font-weight:700;letter-spacing:-0.3px;">QAlaunch</span>
					</td>
				</tr>

				<tr>
					<td style="padding:30px 28px 0;">
						<p style="margin:0 0 4px;color:${MUTED};font-size:14px;line-height:20px;">Your scan is done</p>
						<h1 style="margin:0 0 22px;color:${INK};font-size:25px;line-height:32px;font-weight:800;letter-spacing:-0.5px;">${domain}</h1>
					</td>
				</tr>

				${
					clean ? ''
					:	`<tr>
					<td style="padding:0 28px 22px;">
						<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F4F8FC;border-radius:10px;">
							<tr>
								<td style="padding:16px 20px;">
									<span style="color:${MUTED};font-size:12px;font-weight:700;letter-spacing:1.2px;">HEALTH SCORE</span><br />
									<span style="color:${scoreColour(
										input.healthScore,
									)};font-size:40px;font-weight:800;line-height:48px;">${input.healthScore}</span>
									<span style="color:${MUTED};font-size:15px;"> / 100 · ${escapeHtml(
										labelFromScore(input.healthScore),
									)}</span>
								</td>
								<td align="right" style="padding:16px 20px;">
									<span style="color:${INK};font-size:17px;font-weight:700;">${input.issueCount}</span>
									<span style="color:${MUTED};font-size:15px;"> ${
										input.issueCount === 1 ? 'issue' : 'issues'
									}</span>
								</td>
							</tr>
						</table>
					</td>
				</tr>`
				}

				<tr>
					<td style="padding:0 28px;">
						${findings}
					</td>
				</tr>

				<tr>
					<td style="padding:26px 28px 6px;">
						<table role="presentation" cellpadding="0" cellspacing="0" border="0">
							<tr>
								<td style="background:#22C55E;border-radius:8px;">
									<a href="${resultUrl}" style="display:inline-block;padding:15px 30px;color:#06140D;font-size:17px;font-weight:700;text-decoration:none;">See your full results</a>
								</td>
							</tr>
						</table>
						<p style="margin:12px 0 0;color:${MUTED};font-size:14px;line-height:21px;">
							Each one comes with a screenshot showing exactly where it happens.
						</p>
					</td>
				</tr>

				<tr>
					<td style="padding:26px 28px 0;">
						<div style="border-top:1px solid ${BORDER};padding-top:22px;">
							<p style="margin:0 0 6px;color:${INK};font-size:16px;font-weight:700;line-height:23px;">Want the rest of it?</p>
							<p style="margin:0 0 18px;color:${INK};font-size:15px;line-height:23px;">
								A full report explains what each issue means, why it matters to a
								visitor, and what to change. One-time payment from $9 — no
								subscription.
							</p>
							<p style="margin:0 0 6px;color:${INK};font-size:16px;font-weight:700;line-height:23px;">Or I can do it by hand</p>
							<p style="margin:0;color:${INK};font-size:15px;line-height:23px;">
								I go through the site myself, the way a real customer would use it,
								and send you a written report in 3 business days. $299. Just reply
								to this email and ask.
							</p>
						</div>
					</td>
				</tr>

				<tr>
					<td style="padding:24px 28px 30px;">
						<p style="margin:0;color:${GREEN};font-size:15px;line-height:22px;font-weight:600;">— Waqas, QAlaunch</p>
					</td>
				</tr>

				<tr>
					<td style="padding:16px 28px 22px;background:#F4F8FC;border-top:1px solid ${BORDER};">
						<p style="margin:0;color:${MUTED};font-size:12px;line-height:18px;">
							Results are produced automatically and can occasionally flag
							something that is not a real problem. The screenshots show you
							exactly what we saw, so you can judge for yourself.
						</p>
						<p style="margin:10px 0 0;color:${MUTED};font-size:12px;line-height:18px;">
							You asked for these results at getqalaunch.com. This is the only
							email we send about this scan.
						</p>
					</td>
				</tr>

			</table>
		</td>
	</tr>
</table>
</body>
</html>`;
}
