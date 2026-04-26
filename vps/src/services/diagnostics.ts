import type { Page } from 'playwright';
import type { ScanResult } from '../types/scan.types';

export function attachPageDiagnostics(page: Page, result: ScanResult): void {
	page.on('console', (message) => {
		if (message.type() !== 'error' && message.type() !== 'warning') return;

		result.consoleMessages.push({
			type: message.type(),
			text: message.text(),
			url: message.location()?.url ?? null,
		});
	});

	page.on('pageerror', (error) => {
		result.consoleMessages.push({
			type: 'pageerror',
			text: error.message,
		});
	});

	page.on('requestfailed', (request) => {
		result.failedRequests.push({
			url: request.url(),
			failure: request.failure()?.errorText ?? null,
			method: request.method(),
		});
	});

	page.on('response', (response) => {
		if (response.status() < 400) return;

		result.httpErrors.push({
			url: response.url(),
			status: response.status(),
		});
	});
}
