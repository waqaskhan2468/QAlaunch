import { Response } from 'express';
import puppeteer from 'puppeteer';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';

type ReportPdfRequest = {
	scanId: string;
	html: string;
};

function validateBody(body: Partial<ReportPdfRequest>): ReportPdfRequest {
	const scanId = typeof body.scanId === 'string' ? body.scanId.trim() : '';
	const html = typeof body.html === 'string' ? body.html.trim() : '';

	if (!scanId) {
		throw new AppError('scanId is required', 400);
	}

	if (!html) {
		throw new AppError('html is required', 400);
	}

	return { scanId, html };
}

async function generatePdfBuffer(html: string): Promise<Buffer> {
	const browser = await puppeteer.launch({
		headless: true,
		args: ['--no-sandbox', '--disable-setuid-sandbox'],
	});

	try {
		const page = await browser.newPage();
		await page.setContent(html, { waitUntil: 'networkidle0' });

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
		await browser.close();
	}
}

export const createReportPdf = asyncHandler(async (req, res: Response) => {
	const { scanId, html } = validateBody(req.body);
	const pdfBuffer = await generatePdfBuffer(html);

	res.setHeader('Content-Type', 'application/pdf');
	res.setHeader('Content-Disposition', `inline; filename="${scanId}.pdf"`);
	res.send(pdfBuffer);
});
