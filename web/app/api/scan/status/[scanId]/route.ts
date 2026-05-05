import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/db/supabase';

export const runtime = 'nodejs';

type IssueRow = {
	id: string;
	scan_id: string;
	scan_page_id: string | null;
	category: string;
	severity: string;
	title: string;
	description: string;
	impact: string;
	page_section: string | null;
	fix_instructions: string | null;
	screenshot_url: string | null;
	is_in_free_preview: boolean | null;
	display_order: number | null;
	created_at: string | null;
};

export async function GET(
	_: Request,
	{ params }: { params: Promise<{ scanId: string }> },
) {
	const { scanId } = await params;
	const supabase = getServiceSupabase();

	const { data: scan, error: scanError } = await supabase
		.from('scans')
		.select('*')
		.eq('id', scanId)
		.single();

	if (scanError || !scan) {
		return NextResponse.json({ error: 'not_found' }, { status: 404 });
	}

	const { data: issues, error: issueError } = await supabase
		.from('issues')
		.select('*')
		.eq('scan_id', scanId)
		.order('display_order', { ascending: true });

	if (issueError) {
		return NextResponse.json({ error: issueError.message }, { status: 500 });
	}

	const { data: pages, error: pagesError } = await supabase
		.from('scan_pages')
		.select('*')
		.eq('scan_id', scanId);

	if (pagesError) {
		return NextResponse.json({ error: pagesError.message }, { status: 500 });
	}

	const allIssues = (issues ?? []) as IssueRow[];
	const isFree = scan.package === 'free';

	if (!isFree) {
		return NextResponse.json({
			scan,
			pages: pages ?? [],
			issues: allIssues,
			lockedIssues: [],
			totalIssueCount: allIssues.length,
			visibleIssueCount: allIssues.length,
			lockedIssueCount: 0,
		});
	}

	const visibleIssues = allIssues.filter((issue) => issue.is_in_free_preview);
	const lockedIssues = allIssues
		.filter((issue) => !issue.is_in_free_preview)
		.map((issue) => ({
			id: issue.id,
			category: issue.category,
			severity: issue.severity,
			isLocked: true,
		}));

	return NextResponse.json({
		scan,
		pages: pages ?? [],
		issues: visibleIssues,
		lockedIssues,
		totalIssueCount: allIssues.length,
		visibleIssueCount: visibleIssues.length,
		lockedIssueCount: lockedIssues.length,
	});
}
