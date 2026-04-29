export type PageSpeedStrategy = 'mobile' | 'desktop';

export type PageSpeedScores = {
	performance: number | null;
	seo: number | null;
	accessibility: number | null;
	bestPractices: number | null;
	lcpMs: number | null;
	fcpMs: number | null;
	cls: number | null;
	ttiMs: number | null;
};

export type PageSpeedResult = {
	mobile: PageSpeedScores | null;
	desktop: PageSpeedScores | null;
	strategyErrors?: Partial<Record<PageSpeedStrategy, string>>;
	error?: string;
};

export type PsiResponse = {
	lighthouseResult?: {
		categories?: {
			performance?: { score?: number | null };
			seo?: { score?: number | null };
			accessibility?: { score?: number | null };
			'best-practices'?: { score?: number | null };
		};
		audits?: Record<string, { numericValue?: number | null }>;
	};
};
