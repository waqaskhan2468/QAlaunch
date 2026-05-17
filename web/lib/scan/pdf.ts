import Browserbase from '@browserbasehq/sdk';
import { chromium } from 'playwright-core';

const DEFAULT_SESSION_TIMEOUT_SEC = 600;

function getSessionTimeoutSec(): number {
	const raw = Number.parseInt(
		process.env.BROWSERBASE_SESSION_TIMEOUT_SEC ?? '',
		10,
	);
	if (!Number.isFinite(raw) || raw < 60) return DEFAULT_SESSION_TIMEOUT_SEC;
	return Math.min(raw, 6 * 3600);
}

export async function generatePdfFromHtml(html: string): Promise<Buffer> {
	const apiKey = process.env.BROWSERBASE_API_KEY?.trim();
	if (!apiKey) {
		throw new Error('BROWSERBASE_API_KEY is not configured.');
	}

	const projectId = process.env.BROWSERBASE_PROJECT_ID?.trim();
	const bb = new Browserbase({ apiKey });

	const session = await bb.sessions.create({
		...(projectId ? { projectId } : {}),
		timeout: getSessionTimeoutSec(),
		userMetadata: { purpose: 'report-pdf' },
	});

	if (!session.connectUrl) {
		throw new Error('Browserbase session missing connectUrl.');
	}

	const browser = await chromium.connectOverCDP(session.connectUrl);

	try {
		const context = browser.contexts()[0] ?? (await browser.newContext());
		const page = context.pages()[0] ?? (await context.newPage());

		await page.setContent(html, { waitUntil: 'networkidle' });

		const pdf = await page.pdf({
			format: 'A4',
			printBackground: true,
			margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
			displayHeaderFooter: true,
			headerTemplate:
				'<div style="font-size:9px;width:100%;text-align:center;color:#888">QAlaunch Audit Report</div>',
			footerTemplate:
				'<div style="font-size:9px;width:100%;text-align:center;color:#888">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>',
		});

		return Buffer.from(pdf);
	} finally {
		try {
			await browser.close();
		} catch {
			// Ignore CDP cleanup errors.
		}
	}
}
