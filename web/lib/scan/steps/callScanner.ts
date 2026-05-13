import { NonRetriableError } from 'inngest';
import { AppError } from '@/lib/api/error';

export async function callScannerStep(input: {
	scanId: string;
	pagesToTest: string[];
}): Promise<void> {
	const { scanId, pagesToTest } = input;

	if (!process.env.SCAN_SERVICE_URL || !process.env.SCAN_API_TOKEN) {
		throw new NonRetriableError(
			'SCAN_SERVICE_URL or SCAN_API_TOKEN is missing.',
		);
	}

	const response = await fetch(`${process.env.SCAN_SERVICE_URL}/scan`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${process.env.SCAN_API_TOKEN}`,
		},
		body: JSON.stringify({ scanId, urls: pagesToTest }),
	});

	if (!response.ok) {
		const text = await response.text().catch(() => '');
		throw new AppError(
			502,
			'scanner_error_response',
			`Scanner returned ${response.status}${text ? `: ${text}` : ''}`,
		);
	}
}
