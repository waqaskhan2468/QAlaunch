import type { Page, Response } from 'playwright-core';
import type { ResponseSecurityMeta } from '../types/scan.types';

const MAX_HEADER_SAMPLE_LEN = 240;

function pickHeader(
	headers: Record<string, string>,
	name: string,
): string | undefined {
	const want = name.toLowerCase();
	for (const [k, v] of Object.entries(headers)) {
		if (k.toLowerCase() === want && typeof v === 'string' && v.length > 0) {
			return v;
		}
	}
	return undefined;
}

function sample(v: string | undefined): string | null {
	if (!v) return null;
	const t = v.trim();
	if (!t) return null;
	return t.length > MAX_HEADER_SAMPLE_LEN ?
			t.slice(0, MAX_HEADER_SAMPLE_LEN) + '...'
		:	t;
}

/**
 * Builds passive security / transport metadata from the navigation response.
 * Safe: no extra requests, no path probing.
 */
export function buildResponseSecurityMeta(
	page: Page,
	response: Response | null,
	requestedUrl: string,
): ResponseSecurityMeta {
	const finalUrl = page.url();
	const headers = response?.headers() ?? {};

	const hsts = pickHeader(headers, 'strict-transport-security');
	const csp = pickHeader(headers, 'content-security-policy');
	const xfo = pickHeader(headers, 'x-frame-options');
	const xcto = pickHeader(headers, 'x-content-type-options');
	const rp = pickHeader(headers, 'referrer-policy');
	const pp =
		pickHeader(headers, 'permissions-policy') ??
		pickHeader(headers, 'feature-policy');
	const server = pickHeader(headers, 'server');
	const xpb = pickHeader(headers, 'x-powered-by');

	return {
		requestedUrl,
		finalUrl,
		protocolIsHttps: finalUrl.startsWith('https:'),
		httpStatus: response?.status() ?? null,
		headersPresent: {
			strictTransportSecurity: Boolean(hsts),
			contentSecurityPolicy: Boolean(csp),
			xFrameOptions: Boolean(xfo),
			xContentTypeOptions: Boolean(xcto),
			referrerPolicy: Boolean(rp),
			permissionsPolicy: Boolean(pp),
		},
		headerSamples: {
			strictTransportSecurity: sample(hsts),
			contentSecurityPolicy: sample(csp),
			xFrameOptions: sample(xfo),
			xContentTypeOptions: sample(xcto),
			referrerPolicy: sample(rp),
			permissionsPolicy: sample(pp),
			server: sample(server),
			xPoweredBy: sample(xpb),
		},
	};
}
