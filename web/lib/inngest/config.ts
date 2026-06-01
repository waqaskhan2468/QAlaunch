/** Public origin Inngest Cloud uses to call `/api/inngest` (custom domain or Vercel URL). */
export function getInngestServeOrigin(): string | undefined {
	const explicit = process.env.INNGEST_SERVE_ORIGIN?.trim();
	if (explicit) return explicit.replace(/\/$/, '');

	const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
	if (appUrl) return appUrl.replace(/\/$/, '');

	const vercel = process.env.VERCEL_URL?.trim();
	if (vercel) return `https://${vercel.replace(/\/$/, '')}`;

	return undefined;
}

export function assertInngestEventSendConfigured(): void {
	if (process.env.NODE_ENV !== 'production') return;

	const eventKey = process.env.INNGEST_EVENT_KEY?.trim();
	if (eventKey) return;

	const message =
		'INNGEST_EVENT_KEY is missing. Scans stay on "Queued" because events never reach Inngest Cloud. Add it in Vercel → Settings → Environment Variables.';

	console.error('[inngest]', message);
	throw new Error(message);
}

export function logInngestProductionMisconfigWarnings(): void {
	if (process.env.NODE_ENV !== 'production') return;

	if (process.env.INNGEST_DEV === '1' || process.env.INNGEST_DEV === 'true') {
		console.error(
			'[inngest] INNGEST_DEV is enabled in production — background jobs will not run on Vercel. Set INNGEST_DEV=0 or remove it.',
		);
	}

	if (!process.env.INNGEST_SIGNING_KEY?.trim()) {
		console.error(
			'[inngest] INNGEST_SIGNING_KEY is missing — Inngest Cloud cannot invoke /api/inngest.',
		);
	}

	if (!getInngestServeOrigin()) {
		console.warn(
			'[inngest] Set NEXT_PUBLIC_APP_URL or INNGEST_SERVE_ORIGIN so Inngest knows your production URL.',
		);
	}
}
