import type { Page } from 'playwright-core';
import type { ScanResult } from '../types/scan.types';

const MAX_CONSOLE_MESSAGES = 50;
const MAX_FAILED_REQUESTS = 30;
const MAX_HTTP_ERRORS = 30;

// Paths injected by our own test infrastructure — filter from diagnostics so they
// don't appear as real errors in the AI analysis or the report.
const INTERNAL_TEST_PATHS = ['/qalaunch-test-404-xk9z'];

function isInternalTestUrl(url: string): boolean {
	return INTERNAL_TEST_PATHS.some((path) => url.includes(path));
}

export function attachPageDiagnostics(page: Page, result: ScanResult): void {
	page.on('console', (message) => {
		if (message.type() !== 'error' && message.type() !== 'warning') return;
		if (result.consoleMessages.length >= MAX_CONSOLE_MESSAGES) return;
		// Filter out noise from our own 404 probe
		const url = message.location()?.url ?? '';
		if (isInternalTestUrl(url) || isInternalTestUrl(message.text())) return;

		result.consoleMessages.push({
			type: message.type(),
			text: message.text(),
			url: url || null,
		});
	});

	page.on('pageerror', (error) => {
		if (result.consoleMessages.length >= MAX_CONSOLE_MESSAGES) return;

		result.consoleMessages.push({
			type: 'pageerror',
			text: error.message,
		});
	});

	page.on('requestfailed', (request) => {
		// Skip intentionally-blocked resources — route.abort() fires requestfailed
		// with net::ERR_ABORTED, which is noise from our own blocklist.
		if (request.failure()?.errorText === 'net::ERR_ABORTED') return;
		if (isInternalTestUrl(request.url())) return;
		if (result.failedRequests.length >= MAX_FAILED_REQUESTS) return;

		result.failedRequests.push({
			url: request.url(),
			failure: request.failure()?.errorText ?? null,
			method: request.method(),
		});
	});

	page.on('response', (response) => {
		if (response.status() < 400) return;
		if (isInternalTestUrl(response.url())) return;
		if (result.httpErrors.length >= MAX_HTTP_ERRORS) return;

		result.httpErrors.push({
			url: response.url(),
			status: response.status(),
		});
	});
}
