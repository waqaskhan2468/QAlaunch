import type { Metadata } from 'next';
import Link from 'next/link';

import { SiteNav } from '@/components/site/site-nav';
import { SiteFooter } from '@/components/site/site-footer';
import { FullReportView } from '@/components/report/full-report-view';
import type { ScanIssue } from '@/components/audit/finding-card';
import { getServiceSupabase } from '@/lib/db/supabase';
import { computeHealthScore } from '@/lib/scoring/health';
import { formatPackagePrice } from '@/components/pricing/pricing-plans';

export const metadata: Metadata = {
	title: 'Sample report — a real QAlaunch audit, in full',
	description:
		'See exactly what a paid QAlaunch report contains: every issue found on a real website, with screenshot evidence and how to fix each one.',
	alternates: { canonical: '/sample-report' },
};

// Read fresh each time: the sample is a live scan row, not a fixture.
export const dynamic = 'force-dynamic';

/**
 * The scan shown as the public sample. Defaults to a free scan of
 * practicesoftwaretesting.com — a demo store published for QA practice, so
 * there is no customer to anonymise. Point SAMPLE_REPORT_SCAN_ID at a paid
 * scan (ideally one run after fix instructions returned) for a sample with a
 * PDF download and PageSpeed results.
 */
const DEFAULT_SAMPLE_SCAN_ID = '086415bc-0333-4336-ad64-9cb53991822d';

function sampleScanId(): string {
	const configured = process.env.SAMPLE_REPORT_SCAN_ID?.trim();
	return configured && /^[0-9a-f-]{36}$/i.test(configured) ? configured : DEFAULT_SAMPLE_SCAN_ID;
}

async function loadSample() {
	const supabase = getServiceSupabase();
	const scanId = sampleScanId();

	const [{ data: scan }, { data: issues }, { data: pages }] = await Promise.all([
		supabase
			.from('scans')
			.select('id, url, package, status, created_at, report_pdf_url')
			.eq('id', scanId)
			.maybeSingle(),
		supabase
			.from('issues')
			.select(
				'id, scan_page_id, category, severity, title, description, impact, page_section, fix_instructions, screenshot_url, finding_type, bounding_box, display_order',
			)
			.eq('scan_id', scanId)
			.order('display_order', { ascending: true }),
		supabase
			.from('scan_pages')
			.select('id, page_url, page_role, screenshot_desktop_url, screenshot_mobile_url')
			.eq('scan_id', scanId),
	]);

	if (!scan || scan.status !== 'done') return null;
	return {
		scan: scan as {
			id: string;
			url: string | null;
			package: string | null;
			created_at: string | null;
			report_pdf_url: string | null;
		},
		issues: (issues ?? []) as Array<ScanIssue & { scan_page_id?: string }>,
		pages: (pages ?? []) as Array<{
			id: string;
			page_url: string;
			page_role: string | null;
			screenshot_desktop_url: string | null;
			screenshot_mobile_url: string | null;
		}>,
	};
}

export default async function SampleReportPage() {
	const sample = await loadSample();

	return (
		<>
			<SiteNav />
			<main className='pt-16'>
				{sample ? (
					<FullReportView
						mode='sample'
						scan={{
							id: sample.scan.id,
							url: sample.scan.url,
							package: sample.scan.package,
							created_at: sample.scan.created_at,
							report_ready: Boolean(sample.scan.report_pdf_url),
						}}
						issues={sample.issues.map((issue) => ({
							...issue,
							// Rows from before fix guidance returned carry a placeholder;
							// the sample should show a blank rather than that sentence.
							fix_instructions:
								issue.fix_instructions === 'Not included in report.' ?
									null
								:	issue.fix_instructions,
						}))}
						pages={sample.pages}
						healthScore={computeHealthScore(
							sample.issues
								.filter((i) => i.finding_type !== 'suggestion')
								.map((i) => i.severity),
						)}
						scanPageIdToUrl={Object.fromEntries(sample.pages.map((p) => [p.id, p.page_url]))}
					/>
				) : (
					<section className='flex min-h-[60vh] items-center justify-center bg-surface-soft px-5 py-16'>
						<div className='w-full max-w-xl rounded-2xl border border-border-soft bg-white p-7 text-center'>
							<h1 className='font-heading text-2xl font-black text-ink'>
								The sample report is being refreshed
							</h1>
							<p className='mt-2 text-sm text-body'>
								Run a free scan on your own site instead — it shows 3 of the issues found at
								no cost, and the full report is {formatPackagePrice('basic')}.
							</p>
							<Link
								href='/#audit-input'
								className='mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-brand px-5 text-sm font-extrabold text-white hover:bg-brand-mid'>
								Scan my website free
							</Link>
						</div>
					</section>
				)}
			</main>
			<SiteFooter />
		</>
	);
}
