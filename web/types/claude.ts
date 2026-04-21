export type ClaudeIssue = {
	category:
		| 'functionality'
		| 'ui_bugs'
		| 'usability_ux'
		| 'responsiveness'
		| 'performance'
		| 'seo'
		| 'accessibility';
	severity: 'critical' | 'high' | 'medium' | 'low';
	title: string;
	description: string;
	impact: string;
	page_section?: string;
	fix_instructions: string;
};
