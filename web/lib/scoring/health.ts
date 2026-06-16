export type HealthGrade = 'A' | 'B' | 'C' | 'D' | 'F';

// Per-severity retention factors — the fraction of the *remaining* health an
// issue of each severity preserves. Chosen so a single issue deducts the same
// amount as the old additive model (critical −12, high −7, medium −4, low −2):
// 100 × 0.88 = 88, 100 × 0.93 = 93, etc.
const SEVERITY_RETENTION: Record<string, number> = {
	critical: 0.88,
	high: 0.93,
	medium: 0.96,
	low: 0.98,
};

export function computeHealthScore(
	severities: Array<string | null | undefined>,
): number {
	// Multiplicative decay instead of a fixed subtraction floored at 0. The old
	// additive model bottomed out at 0 once a site had more than ~8–10 issues,
	// so any busy site showed a flat 0 (rendered as "CRIT" in the preview and a
	// bare "0" in the PDF) regardless of the real count. Decaying the remaining
	// health keeps the score low-but-realistic and strictly positive.
	let score = 100;

	for (const rawSeverity of severities) {
		const severity = rawSeverity?.toLowerCase();
		const factor = severity ? SEVERITY_RETENTION[severity] : undefined;
		if (factor !== undefined) score *= factor;
	}

	// Floor at 1, never 0: the preview treats a 0 score as a special "CRIT" state
	// and the PDF would print "0", which is what made many-issue scans look broken.
	return Math.max(1, Math.round(score));
}

export function gradeFromScore(score: number): HealthGrade {
	if (score >= 90) return 'A';
	if (score >= 80) return 'B';
	if (score >= 70) return 'C';
	if (score >= 60) return 'D';
	return 'F';
}

export function labelFromScore(score: number): string {
	if (score >= 80) return 'Good';
	if (score >= 60) return 'Needs attention';
	return 'Critical issues';
}
