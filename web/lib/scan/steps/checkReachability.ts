import { getServiceSupabase } from '@/lib/db/supabase';
import { validateScanTarget } from '@/lib/scan/validate-target';

export type ReachabilityResult = { ok: true } | { ok: false; reason: string };

const UNREACHABLE_MESSAGE =
	"We couldn't load this website. Please check the URL and try again.";

const WEBAPP_MESSAGE =
	"This looks like a login or web-app page, so there's nothing public to preview on a free scan. Enter your public homepage URL, or get a paid report to test the pages reachable before sign-in.";

/**
 * First pipeline step for FREE scans: the reachability / login-gate front-door
 * check that used to run synchronously inside POST /api/scan/start. Moving it
 * here keeps the submit response instant — the slow live fetch to the target
 * now happens in the background, with the progress page showing "Checking your
 * site…" while it runs.
 *
 * On failure we mark the scan `failed` with a user-facing reason and return
 * `{ ok: false }`; the orchestrator stops there and never starts a browser scan.
 *
 * validateScanTarget already swallows fetch errors (returning 'unreachable'),
 * so this won't throw for an offline host. Any *unexpected* throw is treated as
 * "proceed" rather than failing the scan on a validation bug — the real
 * browser-based scan is the source of truth and can handle bot challenges the
 * plain fetch cannot.
 */
export async function checkReachabilityStep(input: {
	scanId: string;
	targetUrl: string;
}): Promise<ReachabilityResult> {
	const { scanId, targetUrl } = input;

	let reason: string | null = null;
	try {
		const validation = await validateScanTarget(targetUrl);
		if (validation.status === 'unreachable') {
			reason = UNREACHABLE_MESSAGE;
		} else if (validation.isWebApp) {
			reason = WEBAPP_MESSAGE;
		}
	} catch (error) {
		console.warn('[check-reachability] validation threw — proceeding', {
			scanId,
			error: error instanceof Error ? error.message : String(error),
		});
		return { ok: true };
	}

	if (reason) {
		const supabase = getServiceSupabase();
		await supabase
			.from('scans')
			.update({ status: 'failed', error_message: reason })
			.eq('id', scanId);
		return { ok: false, reason };
	}

	return { ok: true };
}
