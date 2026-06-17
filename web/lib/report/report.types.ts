import type { IssueCategory, IssueSeverity } from '@/lib/scan/ai/types';

export type ReportIssue = {
	id: string;
	page_url: string;
	category: IssueCategory;
	severity: IssueSeverity;
	title: string;
	description: string;
	impact: string;
	page_section: string | null;
	display_order: number;
};

export type ReportScanPage = {
	page_url: string;
	page_speed_data: unknown;
	/** VPS scan payload (broken states, rollup, …) */
	playwright_data?: unknown;
};

export type ReportScan = {
	id: string;
	url: string;
	user_email: string | null;
	created_at: string | null;
};
