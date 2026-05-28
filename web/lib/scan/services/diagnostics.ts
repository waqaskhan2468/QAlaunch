import type { Page } from 'playwright-core';
import type { ScanResult } from '../types/scan.types';

const MAX_CONSOLE_MESSAGES = 50;
const MAX_FAILED_REQUESTS = 30;
const MAX_HTTP_ERRORS = 30;

export function attachPageDiagnostics(page: Page, result: ScanResult): void {
	page.on('console', (message) => {
		if (message.type() !== 'error' && message.type() !== 'warning') return;
		if (result.consoleMessages.length >= MAX_CONSOLE_MESSAGES) return;

		result.consoleMessages.push({
			type: message.type(),
			text: message.text(),
			url: message.location()?.url ?? null,
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
		if (result.failedRequests.length >= MAX_FAILED_REQUESTS) return;

		result.failedRequests.push({
			url: request.url(),
			failure: request.failure()?.errorText ?? null,
			method: request.method(),
		});
	});

	page.on('response', (response) => {
		if (response.status() < 400) return;
		if (result.httpErrors.length >= MAX_HTTP_ERRORS) return;

		result.httpErrors.push({
			url: response.url(),
			status: response.status(),
		});
	});
}
