import { describe, it, expect } from 'vitest';

import { detectWebAppGate } from '@/lib/utils/detect';

/**
 * Regression tests for the pre-scan gate.
 *
 * Every "should scan" case below is modelled on a homepage this gate actually
 * rejected in production during August and September 2026 — a perfume shop, a
 * pharmacy, an eye-care clinic, a plumber. Each was fully public. Together they
 * were roughly two thirds of all scan failures, and each one is a lost customer
 * who saw an error telling them to enter a public URL they had already entered.
 */

/** A content-rich public page: lots of text and plenty of links. */
function publicPage(extraBodyHtml = '', navHtml = ''): string {
	const paragraphs = Array.from(
		{ length: 40 },
		(_, i) =>
			`<p>Section ${i}: we have served customers in this area for many years and offer a full range of services, with details on this page.</p>`,
	).join('');
	const links = Array.from(
		{ length: 50 },
		(_, i) => `<a href="/page-${i}">Service ${i}</a>`,
	).join('');
	return `<html><body><header><nav>${navHtml}<a href="/">Home</a><a href="/about">About</a></nav></header>
		${paragraphs}${links}${extraBodyHtml}</body></html>`;
}

/** A genuine auth screen: a password box and essentially nothing else. */
function loginPage(): string {
	return `<html><body><h1>Sign in</h1>
		<form><input type="email" name="email"><input type="password" name="password">
		<button>Sign in</button></form>
		<a href="/forgot">Forgot password?</a><a href="/signup">Create account</a></body></html>`;
}

const blocked = (html: string, url: string) => {
	const g = detectWebAppGate(html, url);
	return g.authForm || g.appShell;
};

describe('detectWebAppGate — public sites must be scannable', () => {
	it('allows a store whose page builder ships type="password" inside a script', () => {
		// The exact production bug: no password input in the DOM at all, but the
		// string appears in an inline template. Four of six rejected homepages
		// failed only on this.
		const html = publicPage(
			`<script>var tpl = '<input type="password" name="pw">'; window.tpl = tpl;</script>`,
		);
		expect(blocked(html, 'https://theperfumegallery.co.za')).toBe(false);
	});

	it('allows a clinic with a real customer login form in the footer', () => {
		const html = publicPage(
			`<footer><form><input type="password" name="pass"><button>Patient login</button></form></footer>`,
		);
		expect(blocked(html, 'https://dreamsaverseyecare.com')).toBe(false);
	});

	it('allows a storefront showing "My Account" to logged-out visitors', () => {
		// WooCommerce and Shopify both render this anonymously.
		const html = publicPage('', '<a href="/my-account">My Account</a>');
		expect(blocked(html, 'https://parafarmaciagemamedina.es')).toBe(false);
	});

	it('allows a marketing site that links to a product dashboard', () => {
		const html = publicPage('', '<a href="/dashboard">Dashboard</a>');
		expect(blocked(html, 'https://qualitxinc.com')).toBe(false);
	});

	it('allows a public page carrying a hidden login modal', () => {
		const html = publicPage(
			`<div role="dialog" hidden><input type="password" name="pw"></div>`,
		);
		expect(blocked(html, 'https://allplumbingcompany.com')).toBe(false);
	});
});

describe('detectWebAppGate — genuine gates must stay blocked', () => {
	it('blocks a bare login screen', () => {
		expect(blocked(loginPage(), 'https://example.com')).toBe(true);
	});

	it('blocks an auth path even when the page is content-rich', () => {
		expect(blocked(publicPage(), 'https://example.com/login')).toBe(true);
		expect(blocked(publicPage(), 'https://example.com/sign-up')).toBe(true);
		expect(blocked(publicPage(), 'https://example.com/app')).toBe(true);
	});

	it('blocks a dedicated app subdomain regardless of content', () => {
		expect(blocked(publicPage(), 'https://app.asana.com')).toBe(true);
		expect(blocked(publicPage(), 'https://accounts.example.com')).toBe(true);
	});

	it('blocks a page showing a logged-in nav, which needs a session to appear', () => {
		const html = publicPage('', '<a href="/logout">Log out</a>');
		expect(blocked(html, 'https://example.com')).toBe(true);
	});

	it('blocks an unrendered app shell with account nav and no content', () => {
		const html = `<html><body><nav><a href="/dashboard">Dashboard</a></nav><div id="root"></div></body></html>`;
		expect(blocked(html, 'https://myhisab.org')).toBe(true);
	});
});

describe('detectWebAppGate — signal shape', () => {
	it('reports which signal fired rather than a single boolean', () => {
		expect(detectWebAppGate(loginPage(), 'https://example.com')).toMatchObject({
			authForm: true,
		});
		expect(detectWebAppGate(publicPage(), 'https://app.example.com')).toMatchObject({
			authForm: false,
			appShell: true,
		});
	});

	it('does not throw on an empty document', () => {
		expect(() => detectWebAppGate('', 'https://example.com')).not.toThrow();
	});
});
