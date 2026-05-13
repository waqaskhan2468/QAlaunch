import { Inngest } from 'inngest';

/**
 * Dev vs Cloud mode (Inngest client + INNGEST_DEV):
 * https://www.inngest.com/docs/reference/typescript/client/create
 * https://www.inngest.com/docs/sdk/environment-variables#inngest-dev
 *
 * - Cloud: signature verification on, talks to Inngest Cloud (production on Vercel).
 * - Dev: verification off, talks to Inngest Dev Server (local `pnpm dev` + `inngest dev`).
 *
 * `INNGEST_DEV` overrides: `1` / `true` / dev server URL → dev; `0` / `false` → cloud.
 * If unset, we use Next's NODE_ENV (`development` → dev, `production` → cloud).
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
	return process.env.NODE_ENV !== 'production';
}

export const inngest = new Inngest({
	id: 'qalaunch',
	name: 'QA Launch',
	isDev: getInngestIsDev(),
});