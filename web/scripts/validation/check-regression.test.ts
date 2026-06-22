import { createHash, randomUUID } from 'node:crypto';
import { test } from 'vitest';
import { getServiceSupabase } from '@/lib/db/supabase';
import { scanBrowserOnlyStep } from '@/lib/scan/steps/scanBrowserOnly';
import { analyzePageStep } from '@/lib/scan/steps/analyzePage';
import { persistAiIssuesStep } from '@/lib/scan/steps/persistAiIssues';

for (const f of ['.env.local', '.env']) {
	try {
		process.loadEnvFile(f);
	} catch {
		/* optional */
	}
}

/**
 * Fixed regression URL set. Must include:
 *  - an image/gradient-background hero (contrast must be judged from pixels)
 *  - a client-side-routing SPA (footer nav probe must wait for the transition)
 *  - a simple static control.
 * Override with SCAN_VALIDATION_URLS (comma-separated) for ad-hoc runs.
 */
const DEFAULT_URLS = [
	'https://tailwindcss.com', // baseline
	'https://nextjs.org', // SPA, client-side routing
	'https://react.dev', // SPA + illustrated/gradient hero
	'https://vercel.com', // dark gradient hero (image/gradient bg → pixel contrast)
	'https://news.ycombinator.com', // simple static control
];

const URLS = (process.env.SCAN_VALIDATION_URLS?.split(',').map((s) => s.trim()).filter(Boolean) ??
	DEFAULT_URLS);

type AnyRec = Record<string, unknown>;

function summarizePatternResults(results: AnyRec[]): AnyRec[] {
	return results
		.filter((r) => r.status === 'fail' || r.status === 'error')
		.map((r) => ({
			id: r.id,
			status: r.status,
			device: r.device ?? null,
			severity: r.severity ?? null,
			title: r.title ?? null,
			detail: r.detail ?? null,
			cropReliable: r.cropReliable ?? null,
			hasCrop: typeof r.cropScreenshotUrl === 'string',
		}));
}

for (const url of URLS) {
	test(`validate: ${url}`, async () => {
		const supabase = getServiceSupabase();
		const scanId = randomUUID();
		const urlHash = createHash('sha256').update(url).digest('hex');

		await supabase.from('scans').insert({
			id: scanId,
			url,
			url_hash: urlHash,
			package: 'basic', // paid tier → full-page + full check scope (not free top-scope)
			status: 'analyzing',
			payment_status: 'pending',
			free_preview_used: false,
		});
		const { error: pErr } = await supabase
			.from('scan_pages')
			.upsert({ scan_id: scanId, page_url: url }, { onConflict: 'scan_id,page_url' });
		if (pErr) throw new Error(`scan_pages upsert failed: ${pErr.message}`);

		try {
			await scanBrowserOnlyStep({ scanId, pageUrl: url, pkg: 'basic', isHomepage: true });

			const { data: pageRow } = await supabase
				.from('scan_pages')
				.select('playwright_data')
				.eq('scan_id', scanId)
				.eq('page_url', url)
				.single();

			const pd = (pageRow?.playwright_data ?? {}) as AnyRec;
			const patternResults = Array.isArray((pd.patternChecks as AnyRec)?.results)
				? ((pd.patternChecks as AnyRec).results as AnyRec[])
				: [];
			const probes = Array.isArray((pd.interactionProbes as AnyRec)?.results)
				? ((pd.interactionProbes as AnyRec).results as AnyRec[])
				: [];
			const footerNav = probes.find((p) => p.id === 'footer-link-scroll');

			await analyzePageStep({ scanId, pageUrl: url, websiteType: null, pkg: 'basic' });
			await persistAiIssuesStep({ scanId, pkg: 'basic', pagesToTest: [url] });

			const { data: issues } = await supabase
				.from('issues')
				.select('title, severity, finding_type, screenshot_url')
				.eq('scan_id', scanId);
			const verified = (issues ?? []).filter((i) => i.finding_type === 'verified_pattern');

			console.log(
				`VALIDATION_RESULT ${JSON.stringify({
					url,
					patternFindings: summarizePatternResults(patternResults),
					patternAllChecks: patternResults.map((r) => ({ id: r.id, status: r.status, device: r.device ?? null })),
					footerNav: footerNav
						? { status: footerNav.status, observation: footerNav.observation }
						: null,
					verifiedIssues: verified.map((i) => ({
						title: i.title,
						severity: i.severity,
						cropUrl: i.screenshot_url,
					})),
				})}`,
			);
		} finally {
			await supabase.from('issues').delete().eq('scan_id', scanId);
			await supabase.from('funnel_events').delete().eq('scan_id', scanId);
			await supabase.from('scan_pages').delete().eq('scan_id', scanId);
			await supabase.from('scans').delete().eq('id', scanId);
		}
	});
}
