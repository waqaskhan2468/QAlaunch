import { createHash } from 'crypto';

export function normalizeUrl(input: string) {
	let url = input.trim().toLowerCase();
	if (!/^https?:\/\//i.test(url)) {
		url = `https://${url}`;
	}

	const parsed = new URL(url);
	let host = parsed.host.toLowerCase();
	if (host.startsWith('www.')) host = host.slice(4);

	const pathname = parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/$/, '');

	return `https://${host}${pathname}`;
}

export function urlHash(normalizedUrl: string) {
	return createHash('sha256').update(normalizedUrl).digest('hex');
}

/**
 * True for an IPv4/IPv6 literal that must never be fetched by the scanner:
 * loopback, link-local (169.254.169.254 is every cloud's metadata service),
 * RFC 1918, carrier-grade NAT, unspecified (0.0.0.0) and their IPv6
 * counterparts. On 30 Sep 2026 someone submitted 169.254.169.254/latest/meta-data,
 * metadata.google.internal, 0.0.0.0 and [::1]; the old check let all four
 * through to the pre-scan fetch.
 */
export function isPrivateIpAddress(ip: string): boolean {
	const v4 = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
	if (v4) {
		const [a, b] = [Number(v4[1]), Number(v4[2])];
		return (
			a === 0 || // 0.0.0.0/8 — "this network"
			a === 10 ||
			a === 127 ||
			(a === 100 && b >= 64 && b <= 127) || // CGNAT 100.64/10
			(a === 169 && b === 254) || // link-local + cloud metadata
			(a === 172 && b >= 16 && b <= 31) ||
			(a === 192 && b === 168) ||
			(a === 198 && (b === 18 || b === 19)) || // benchmarking
			a >= 224 // multicast + reserved
		);
	}

	const v6 = ip.toLowerCase().replace(/^\[|\]$/g, '');
	if (v6.includes(':')) {
		if (v6 === '::' || v6 === '::1') return true;
		if (v6.startsWith('fe8') || v6.startsWith('fe9') || v6.startsWith('fea') || v6.startsWith('feb')) {
			return true; // link-local fe80::/10
		}
		if (v6.startsWith('fc') || v6.startsWith('fd')) return true; // unique local fc00::/7
		// IPv4-mapped (::ffff:a.b.c.d) — judge the embedded IPv4.
		const mapped = v6.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
		if (mapped) return isPrivateIpAddress(mapped[1]);
	}
	return false;
}

/** Hostnames that only mean something from inside a network or a cloud VM. */
const INTERNAL_HOST_SUFFIXES = [
	'.local',
	'.localhost',
	'.internal',
	'.intranet',
	'.lan',
	'.home',
	'.corp',
	'.localdomain',
];

export function isPrivateUrl(input: string) {
	try {
		const host = new URL(input).hostname.toLowerCase();
		if (host === 'localhost' || host === 'metadata.google.internal') return true;
		if (!host.includes('.') && !host.includes(':')) return true; // bare "intranet"
		if (INTERNAL_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))) return true;
		return isPrivateIpAddress(host);
	} catch {
		return true;
	}
}

/**
 * Resolves the hostname and reports whether ANY address it points at is
 * private. A public-looking name can point at 127.0.0.1 or the metadata
 * service (DNS rebinding, or just a misconfigured record), and the scanner
 * would happily fetch it. A failed lookup returns false — unreachable hosts
 * are reported by the reachability check, not here.
 */
export async function resolvesToPrivateAddress(input: string): Promise<boolean> {
	let host: string;
	try {
		host = new URL(input).hostname;
	} catch {
		return true;
	}
	if (isPrivateIpAddress(host)) return true;
	try {
		const { lookup } = await import('node:dns/promises');
		const addresses = await lookup(host, { all: true, verbatim: true });
		return addresses.some((entry) => isPrivateIpAddress(entry.address));
	} catch {
		return false;
	}
}
