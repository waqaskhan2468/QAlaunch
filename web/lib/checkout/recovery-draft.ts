/**
 * Copy for the abandoned-checkout recovery email.
 *
 * Who receives this: someone who ran a scan, picked a paid package, entered an
 * email, and stopped at the payment step. They have already seen real issues
 * found on their own site — so the persuasive work is done and the email's only
 * job is to remove whatever stopped them and hand back the link.
 *
 * Deliberately not written as marketing. No discount, no countdown, no second
 * chase. One short note from the person who built it, sent once. A $9 product
 * cannot afford to damage the sending domain that also delivers paid reports.
 */

export type RecoveryScan = {
	/** Bare hostname of the scanned site, e.g. "example.com". */
	host: string;
	/** Package they selected at checkout. */
	pkg: string;
	/** Scan id — used to rebuild the resume link. */
	scanId: string;
};

export type RecoveryDraft = {
	subject: string;
	body: string;
};

const SITE = 'https://getqalaunch.com';

/** What each package actually delivers, in the buyer's words. */
const PACKAGE_SUMMARY: Record<string, string> = {
	basic: 'the full report for that page — $9',
	standard: 'the 5-page report — $24',
	premium: 'the 10-page report — $59',
};

function packageLine(pkg: string): string {
	return PACKAGE_SUMMARY[pkg] ?? 'the full report';
}

/**
 * The resume link. Sends them back to their own result page rather than the
 * homepage: the scan is already run, so re-entering the URL would waste their
 * free preview and make them repeat work they already did.
 */
export function resumeUrl(scanId: string): string {
	return `${SITE}/result?scanId=${encodeURIComponent(scanId)}`;
}

export function buildRecoveryDraft(scan: RecoveryScan): RecoveryDraft {
	const { host, pkg, scanId } = scan;

	const body = [
		'Hi,',
		'',
		`You started a QAlaunch report for ${host} earlier and the payment didn't go through — I'm Waqas, the QA engineer who built this, so I wanted to check nothing broke on my end.`,
		'',
		`Your scan is still saved. You can pick it up here without re-running anything:`,
		'',
		resumeUrl(scanId),
		'',
		`That's ${packageLine(pkg)}: every issue the scan found, each with a screenshot showing exactly where it happens, so you or your developer can fix it without hunting around for it.`,
		'',
		'If something went wrong at the payment step, or you just want to ask me something about what the scan found before paying, reply to this email — it comes straight to me.',
		'',
		'Waqas',
		'QAlaunch · getqalaunch.com',
		'',
		'---',
		`You're receiving this once because a report for ${host} was started on QAlaunch. I won't send another.`,
	].join('\n');

	return {
		subject: `Your ${host} report is still waiting`,
		body,
	};
}

/** Plain-text draft → minimal HTML. Escapes first so site names can't inject markup. */
export function recoveryBodyToHtml(body: string): string {
	const escaped = body
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');

	// Linkify the resume URL so the message is actionable in an HTML client.
	const linked = escaped.replace(
		/(https:\/\/getqalaunch\.com\/result\?scanId=[^\s]+)/g,
		'<a href="$1">$1</a>',
	);

	return `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.6;color:#0e1726;white-space:pre-wrap">${linked}</div>`;
}
