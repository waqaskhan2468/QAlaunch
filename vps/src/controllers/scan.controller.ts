import { Request, Response } from 'express';
import { runPlaywrightScan } from '../services/playwright.service';

export async function runScan(req: Request, res: Response) {
	try {
		const { urls, scanId } = req.body;

		if (!urls || !Array.isArray(urls)) {
			return res.status(400).json({ error: 'Invalid input' });
		}

		if (!scanId) {
			return res.status(400).json({ error: 'scanId is required' });
		}

		const results = await runPlaywrightScan(urls,scanId);

		return res.json({ success: true, data: results });
	} catch (error: any) {
		console.error(error);
		return res.status(500).json({ error: error.message });
	}
}
