import { Inngest } from 'inngest';

/**
 * Local: run `pnpm dev` + `pnpm dev:inngest` with INNGEST_DEV=1 (optional).
 * Vercel: INNGEST_EVENT_KEY + INNGEST_SIGNING_KEY, INNGEST_DEV unset or 0.
 */
function getInngestIsDev(): boolean {
	const raw = process.env.INNGEST_DEV;
	if (raw === '0' || raw === 'false') {
		return false;
	}
	if (
		raw === '1' ||
		raw === 'true' ||
		(typeof raw === 'string' && /^https?:\/\//i.test(raw.trim()))
	) {
		return true;
	}
	// Cloud keys present → production worker mode even if NODE_ENV is wrong.
	if (
		process.env.INNGEST_EVENT_KEY?.trim() &&
		process.env.INNGEST_SIGNING_KEY?.trim()
	) {
		return false;
	}
	return process.env.NODE_ENV !== 'production';
}

export const inngest = new Inngest({
	id: 'qalaunch',
	name: 'QA Launch',
	isDev: getInngestIsDev(),
	eventKey: process.env.INNGEST_EVENT_KEY,
});