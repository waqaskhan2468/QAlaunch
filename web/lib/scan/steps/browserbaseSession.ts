import {
	closeBrowserbaseSession,
	createBrowserbaseSession,
	type BrowserbaseSession,
} from '@/lib/scan/browser';

export async function createBrowserbaseSessionStep(
	scanId: string,
): Promise<BrowserbaseSession> {
	return createBrowserbaseSession(scanId);
}

export async function closeBrowserbaseSessionStep(
	session: BrowserbaseSession,
): Promise<void> {
	await closeBrowserbaseSession(session);
}
