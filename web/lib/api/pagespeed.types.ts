export type PageSpeedStrategy = 'mobile' | 'desktop';

/** One actionable Lighthouse audit row (opportunity / failing check). */
export type PageSpeedAuditFinding = {
	id: string;
	title: string;
	displayValue: string | null;
	score: number | null;
};

/** Real-user (CrUX) percentiles when PSI returns field data. */
export type PageSpeedFieldVitals = {
	lcpMs: number | null;
	inpMs: number | null;
	cls: number | null;
	fcpMs: number | null;
};

/** Lab + category scores for one strategy (mobile or desktop). Source: Google PSI only. */
export type PageSpeedScores = {
	performance: number | null;
	seo: number | null;
	accessibility: number | null;
	bestPractices: number | null;
	lcpMs: number | null;
	fcpMs: number | null;
	cls: number | null;
	ttiMs: number | null;
	inpMs: number | null;
	tbtMs: number | null;
	speedIndex: number | null;
	ttfbMs: number | null;
	finalUrl: string | null;
	fetchedAt: string | null;
	opportunities: PageSpeedAuditFinding[];
	fieldVitals: PageSpeedFieldVitals | null;
};

export type PageSpeedResult = {
	mobile: PageSpeedScores | null;
	desktop: PageSpeedScores | null;
	strategyErrors?: Partial<Record<PageSpeedStrategy, string>>;
	error?: string;
};

export type PsiAudit = {
	title?: string;
	description?: string;
	displayValue?: string;
	numericValue?: number | null;
	score?: number | null;
	scoreDisplayMode?: string;
	details?: { type?: string };
};

export type PsiResponse = {
	loadingExperience?: {
		metrics?: Record<
			string,
			{ percentile?: number | null; category?: string }
		>;
	};
	lighthouseResult?: {
		finalUrl?: string;
		fetchTime?: string;
		categories?: {
			performance?: { score?: number | null };
			seo?: { score?: number | null };
			accessibility?: { score?: number | null };
			'best-practices'?: { score?: number | null };
		};
		audits?: Record<string, PsiAudit>;
	};
};
