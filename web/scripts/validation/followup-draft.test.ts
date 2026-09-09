import { expect, test } from 'vitest';

import { buildFollowUpDraft, draftBodyToHtml } from '@/lib/admin/followup-draft';

const base = {
	host: 'yourstore.com',
	totalIssues: 11,
	highSeverityCount: 3,
	lockedTitles: [
		'The sign-up button is unreadable on mobile',
		'Footer links open pages without scrolling to the top',
		'A third one',
	],
};

test('locked variant leads with real counts and real issue titles', () => {
	const d = buildFollowUpDraft(base);
	expect(d.variant).toBe('locked');
	expect(d.subject).toBe('11 issues found on yourstore.com');
	expect(d.body).toContain('11 on that page, 3 of them rated critical or high');
	// Exactly two samples — a longer list reads like a dump, not a note.
	expect(d.body).toContain('The sign-up button is unreadable on mobile');
	expect(d.body).toContain('Footer links open pages without scrolling to the top');
	expect(d.body).not.toContain('A third one');
});

test('omits the severity clause when nothing is critical or high', () => {
	const d = buildFollowUpDraft({ ...base, highSeverityCount: 0 });
	expect(d.body).toContain('11 on that page.');
	expect(d.body).not.toContain('rated critical or high');
});

test('clean variant pitches other pages instead of inventing problems', () => {
	const d = buildFollowUpDraft({ ...base, totalIssues: 3, lockedTitles: [] });
	expect(d.variant).toBe('clean');
	expect(d.subject).toBe('Your QAlaunch scan of yourstore.com');
	expect(d.body).toContain('came back clean');
	expect(d.body).toContain('$24');
	// Must never claim unseen issues it cannot name.
	expect(d.body).not.toMatch(/issues you haven't seen/i);
});

test('every draft identifies the sender and offers an opt-out', () => {
	for (const d of [buildFollowUpDraft(base), buildFollowUpDraft({ ...base, lockedTitles: [] })]) {
		expect(d.body).toContain('Waqas');
		expect(d.body).toContain('getqalaunch.com');
		expect(d.body).toContain('no thanks');
		expect(d.body).toContain('yourstore.com');
	}
});

test('both variants offer the manual QA review as well as the report', () => {
	for (const d of [buildFollowUpDraft(base), buildFollowUpDraft({ ...base, lockedTitles: [] })]) {
		expect(d.body).toContain('manual QA review');
	}
});

test('html rendering escapes user-derived content', () => {
	const html = draftBodyToHtml('a <script>alert(1)</script> & b');
	expect(html).not.toContain('<script>');
	expect(html).toContain('&lt;script&gt;');
	expect(html).toContain('&amp;');
});

test('host with unusual characters is not injected raw into html', () => {
	const d = buildFollowUpDraft({ ...base, host: '<b>evil.com</b>' });
	expect(draftBodyToHtml(d.body)).not.toContain('<b>evil.com</b>');
});
