export const FRONTEND_PUBLIC_URL_REGEX =
	/^(https?:\/\/)?([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(\/[^\s?#]*)?(\?[^#\s]*)?(#[^\s]*)?$/;

export function isValidPublicWebsiteUrl(value: string): boolean {
	return FRONTEND_PUBLIC_URL_REGEX.test(value.trim());
}
