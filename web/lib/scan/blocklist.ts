import blockedDomains from './blocked-domains.json';

/**
 * Major, established global sites that are never legitimate scan targets — the
 * submitter could not possibly own or manage them, so auditing one only burns
 * cloud-browser + Claude budget with zero chance of converting to a sale.
 *
 * Sourced from `blocked-domains.json` so the list can be extended without
 * touching code — add a root domain (no `www.`, no scheme) to that file.
 */
export const BLOCKED_DOMAINS: readonly string[] = blockedDomains;

/**
 * True when `input`'s root domain is on the blocklist. Matches the root domain,
 * so every subdomain of a blocked entry is caught too: `www.google.com`,
 * `mail.google.com`, and `google.com` all match `google.com`.
 *
 * Accepts a full URL or a bare host. Returns `false` for anything unparseable
 * (the caller's own URL validation rejects those separately).
 */
export function isBlockedDomain(input: string): boolean {
	let host: string;
	try {
		host = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`)
			.hostname.toLowerCase();
	} catch {
		return false;
	}

	if (host.startsWith('www.')) host = host.slice(4);

	return BLOCKED_DOMAINS.some(
		(domain) => host === domain || host.endsWith(`.${domain}`),
	);
}
