import { describe, it, expect } from 'vitest';

import {
	buildFreeResultEmailHtml,
	buildFreeResultEmailText,
	buildSubject,
	displayDomain,
	type FreeResultEmailInput,
} from '@/lib/report/freeResultEmail';

/**
 * The opt-in result email for free scans.
 *
 * This product has shipped overclaims before — fabricated locked issues, a
 * hardcoded "3 critical", "five viewport widths" when the scanner renders one.
 * Each cost real trust, and one was posted about publicly. An email is the
 * worst place to repeat that, because it arrives unprompted and is kept.
 *
 * So these tests are mostly about what the email must NOT say.
 */

const base: FreeResultEmailInput = {
	targetUrl: 'https://www.example.com/pricing',
	resultUrl: 'https://getqalaunch.com/result?url=x&scanId=y',
	healthScore: 62,
	issueCount: 7,
	topIssues: [
		{ severity: 'critical', title: 'Checkout button is off screen on a phone' },
		{ severity: 'high', title: 'Contact form submits but never arrives' },
		{ severity: 'medium', title: 'Three navigation links return 404' },
	],
};

describe('subject line', () => {
	it('leads with their domain, not our brand', () => {
		const subject = buildSubject({ targetUrl: base.targetUrl, issueCount: 7 });
		expect(subject.startsWith('example.com')).toBe(true);
		expect(subject).not.toMatch(/QAlaunch/i);
	});

	it('states the real count', () => {
		expect(buildSubject({ targetUrl: base.targetUrl, issueCount: 7 })).toContain(
			'7 issues',
		);
	});

	it('says singular for one issue', () => {
		const subject = buildSubject({ targetUrl: base.targetUrl, issueCount: 1 });
		expect(subject).toContain('1 issue');
		expect(subject).not.toContain('1 issues');
	});

	it('does not manufacture concern when the site is clean', () => {
		const subject = buildSubject({ targetUrl: base.targetUrl, issueCount: 0 });
		expect(subject).toContain('no issues');
		expect(subject).not.toMatch(/\b0 issues\b/);
	});

	it('stays short enough to survive an inbox', () => {
		expect(
			buildSubject({ targetUrl: base.targetUrl, issueCount: 7 }).length,
		).toBeLessThan(70);
	});
});

describe('displayDomain', () => {
	it('strips protocol, www and path', () => {
		expect(displayDomain('https://www.example.com/pricing?a=b')).toBe('example.com');
	});

	it('survives something that is not a valid URL', () => {
		expect(displayDomain('example.com/thing')).toBe('example.com');
	});
});

describe('email body — honesty', () => {
	it('shows only the issues it was handed, never more', () => {
		const html = buildFreeResultEmailHtml(base);
		expect(html).toContain('Checkout button is off screen on a phone');
		expect(html).toContain('Contact form submits but never arrives');
		expect(html).toContain('Three navigation links return 404');
		// 7 found, 3 named, so 4 unnamed — stated, not implied.
		expect(html).toContain('and 4 more');
	});

	it('does not say "and N more" when it listed everything', () => {
		const html = buildFreeResultEmailHtml({
			...base,
			issueCount: 3,
			topIssues: base.topIssues,
		});
		expect(html).not.toContain('more.');
	});

	it('tells someone with a clean site that it is clean', () => {
		const html = buildFreeResultEmailHtml({
			...base,
			issueCount: 0,
			topIssues: [],
		});
		expect(html).toContain('did not find any issues');
		expect(html).not.toContain('HEALTH SCORE');
	});

	it('carries the false-positive caveat, as the result page does', () => {
		expect(buildFreeResultEmailHtml(base)).toContain('not a real problem');
		expect(buildFreeResultEmailText(base)).toContain('not a real problem');
	});

	it('says where the address came from', () => {
		expect(buildFreeResultEmailHtml(base)).toContain('You asked for these results');
	});
});

describe('email body — conversion mechanics', () => {
	it('links to the result page with both params, or the link bounces home', () => {
		const html = buildFreeResultEmailHtml(base);
		expect(html).toContain('url=');
		expect(html).toContain('scanId=');
	});

	it('names both paid options with their real prices', () => {
		const html = buildFreeResultEmailHtml(base);
		expect(html).toContain('$9');
		expect(html).toContain('$299');
		expect(html).toContain('3 business days');
	});

	it('leads with the result, not the pitch', () => {
		const html = buildFreeResultEmailHtml(base);
		// The first issue must appear before the first price.
		expect(html.indexOf('Checkout button is off screen')).toBeLessThan(
			html.indexOf('$9'),
		);
	});

	it('has one primary action', () => {
		const html = buildFreeResultEmailHtml(base);
		expect(html.match(/See your full results/g)).toHaveLength(1);
	});

	it('ships a plain-text part, so it is not filed as spam', () => {
		const text = buildFreeResultEmailText(base);
		expect(text).toContain('example.com');
		expect(text).toContain('Checkout button is off screen on a phone');
		expect(text).not.toContain('<');
	});
});

describe('email body — safety', () => {
	it('escapes an issue title rather than rendering it as markup', () => {
		const html = buildFreeResultEmailHtml({
			...base,
			topIssues: [{ severity: 'high', title: '<script>alert(1)</script>' }],
		});
		expect(html).not.toContain('<script>alert(1)</script>');
		expect(html).toContain('&lt;script&gt;');
	});

	it('escapes a hostile URL', () => {
		const html = buildFreeResultEmailHtml({
			...base,
			targetUrl: 'https://evil.com/"><script>x</script>',
		});
		expect(html).not.toContain('"><script>');
	});
});
