/** Stored SEO snapshot size (matches `scan_pages.raw_html` budget). */
export const RAW_HTML_MAX_BYTES = 50 * 1024;

/** Truncate a string to at most `maxBytes` UTF-8 octets. */
export function truncateUtf8Bytes(input: string, maxBytes: number): string {
	const encoder = new TextEncoder();
	const buf = encoder.encode(input);

	if (buf.length <= maxBytes) {
		return input;
	}

	const decoder = new TextDecoder('utf-8', { fatal: false });
	return decoder.decode(buf.slice(0, maxBytes));
}
