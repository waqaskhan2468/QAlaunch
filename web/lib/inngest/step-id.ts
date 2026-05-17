/** Stable, short Inngest step id segment from a page URL. */
export function stepIdFromPageUrl(url: string): string {
	return url
		.replace(/^https?:\/\//i, '')
		.replace(/[^a-zA-Z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 80);
}
