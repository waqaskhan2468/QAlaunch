import { createHash } from 'crypto';

export function normalizeUrl(input: string) {
	let url = input.trim();
	if (!/^https?:\/\//i.test(url)) {
		url = `https://${url}`;
	}

	const parsed = new URL(url);
	let host = parsed.host.toLowerCase();
	if (host.startsWith('www.')) host = host.slice(4);

	const pathname =
		parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/$/, '');
	const search =
		parsed.searchParams.toString() ? `?${parsed.searchParams.toString()}` : '';

	return `https://${host}${pathname}${search}`;
}

export function urlHash(normalizedUrl: string) {
	return createHash('sha256').update(normalizedUrl).digest('hex');
}

export function isPrivateUrl(input: string) {
	try {
		const host = new URL(input).hostname;
		return (
			host === 'localhost' ||
			host.endsWith('.local') ||
			/^127\./.test(host) ||
			/^10\./.test(host) ||
			/^192\.168\./.test(host) ||
			/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
		);
	} catch {
		return true;
	}
}
