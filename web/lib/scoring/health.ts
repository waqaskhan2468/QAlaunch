export type HealthGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export function computeHealthScore(
	severities: Array<string | null | undefined>,
): number {
	let score = 100;

	for (const rawSeverity of severities) {
		const severity = rawSeverity?.toLowerCase();
		if (severity === 'critical') score -= 12;
		else if (severity === 'high') score -= 7;
		else if (severity === 'medium') score -= 4;
		else if (severity === 'low') score -= 2;
	}

	return Math.max(0, score);
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
