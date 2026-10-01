/**
 * Helpers for putting visitor-supplied text into an outbound email.
 *
 * Two different jobs, and using the wrong one is how injection happens:
 *
 * - escapeHtml for anything rendered into the HTML body.
 * - headerSafe for anything interpolated into a header, which here means the
 *   Subject line of both form emails.
 *
 * Headers are newline-delimited. A carriage return or line feed inside a value
 * that reaches a header can end that header early and begin another, which is
 * how an attacker adds a Bcc of their own and turns a contact form into an open
 * relay. Resend is sent JSON and very likely rejects this itself, but a header
 * we build out of visitor input is ours to make safe — relying on a vendor to
 * clean up after us is not a control, and it would change silently.
 *
 * The schemas in types/zod.ts reject these characters at the boundary too.
 * This is the second layer, applied where the value is actually used, so a
 * future field that skips the schema still cannot break a header.
 */

/** Characters that terminate or corrupt a header: CR, LF, NUL and friends. */
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;

/**
 * Makes a value safe to interpolate into an email header.
 *
 * Control characters are replaced with a space rather than removed so that
 * "a\r\nBcc: x@y.com" cannot be collapsed into a single plausible-looking
 * token. The result is trimmed and length-capped, because an over-long subject
 * is folded by mail servers in ways that are hard to predict.
 */
export function headerSafe(value: string, maxLength = 160): string {
	const cleaned = value.replace(CONTROL_CHARS, ' ').replace(/\s+/g, ' ').trim();
	return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength - 1)}…` : cleaned;
}

/**
 * Escapes text for interpolation into an HTML email body.
 *
 * Both form routes had their own identical copy of this; they now share one.
 * This is what made the injection attempts in those test submissions inert —
 * `<script>alert(1)</script>` arrived rendered as visible text, which is
 * exactly right.
 */
export function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}
