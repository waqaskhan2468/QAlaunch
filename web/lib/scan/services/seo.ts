import type { Page } from 'playwright-core';
import type { ScanResult } from '../types/scan.types';
import { logScanTiming } from './scan-timing';

export async function collectInteractiveData(
	page: Page,
	timing?: { scanId?: string; pageUrl?: string },
): Promise<NonNullable<ScanResult['interactive']>> {
	const startedAt = Date.now();
	const result = await page.evaluate(() => {
		const buttons = Array.from(
			document.querySelectorAll('button, [role="button"]'),
		).map((node) => {
			const element = node as HTMLElement & { onclick?: unknown };

			return {
				text: (element.innerText || element.textContent || '').trim(),
				hasOnClick: !!element.onclick || element.hasAttribute('onclick'),
				isVisible: element.offsetParent !== null,
				classes: element.className || '',
			};
		});

		const forms = Array.from(document.querySelectorAll('form')).map((node) => {
			const form = node as HTMLFormElement;
			const inputs = Array.from(
				form.querySelectorAll('input, select, textarea'),
			).map((inputNode) => {
				const field = inputNode as
					| HTMLInputElement
					| HTMLSelectElement
					| HTMLTextAreaElement;

				return {
					type: (field as HTMLInputElement).type || field.tagName.toLowerCase(),
					name: field.name || '',
					required: field.required,
					hasLabel: !!field.labels?.length,
				};
			});

			return {
				action: form.action || '',
				method: (form.method || 'get').toLowerCase(),
				inputs,
				submitButton: !!form.querySelector('[type="submit"]'),
			};
		});

		return { buttons, forms };
	});
	logScanTiming('interactive', Date.now() - startedAt, {
		...timing,
		ok: true,
		buttonCount: result.buttons.length,
		formCount: result.forms.length,
	});
	return result;
}

export async function collectSeoData(
	page: Page,
	timing?: { scanId?: string; pageUrl?: string },
): Promise<NonNullable<ScanResult['seoData']>> {
	const startedAt = Date.now();
	const result = await page.evaluate(() => ({
		title: document.title,
		metaDescription:
			document
				.querySelector('meta[name="description"]')
				?.getAttribute('content') ?? null,
		metaKeywords:
			document
				.querySelector('meta[name="keywords"]')
				?.getAttribute('content') ?? null,
		canonical:
			document.querySelector('link[rel="canonical"]')?.getAttribute('href') ??
			null,
		ogTitle:
			document
				.querySelector('meta[property="og:title"]')
				?.getAttribute('content') ?? null,
		ogImage:
			document
				.querySelector('meta[property="og:image"]')
				?.getAttribute('content') ?? null,
		h1Tags: Array.from(document.querySelectorAll('h1')).map((heading) =>
			(heading.textContent || '').trim(),
		),
		h2Count: document.querySelectorAll('h2').length,
		h3Count: document.querySelectorAll('h3').length,
		imagesWithoutAlt: document.querySelectorAll('img:not([alt])').length,
		totalImages: document.querySelectorAll('img').length,
		hasViewportMeta: !!document.querySelector('meta[name="viewport"]'),
		hasFavicon:
			!!document.querySelector('link[rel="icon"]') ||
			!!document.querySelector('link[rel="shortcut icon"]'),
		language: document.documentElement.lang || null,
		// ── Enriched SEO fields ──────────────────────────────────────────────
		titleLength: document.title.length,
		metaDescriptionLength: (document.querySelector('meta[name="description"]')?.getAttribute('content') ?? '').length,
		multipleH1: document.querySelectorAll('h1').length > 1,
		h1Count: document.querySelectorAll('h1').length,
		robotsMeta: document.querySelector('meta[name="robots"]')?.getAttribute('content') ?? null,
		hasNoIndex: (document.querySelector('meta[name="robots"]')?.getAttribute('content') ?? '').toLowerCase().includes('noindex'),
		hasSchemaOrg: !!(document.querySelector('script[type="application/ld+json"]') || document.querySelector('[itemtype]')),
		hasTwitterCard: !!document.querySelector('meta[name="twitter:card"]'),
		openGraphComplete: !!(
			document.querySelector('meta[property="og:title"]') &&
			document.querySelector('meta[property="og:description"]') &&
			document.querySelector('meta[property="og:image"]')
		),
	}));
	logScanTiming('seo', Date.now() - startedAt, {
		...timing,
		ok: true,
		titleLength: result.title?.length ?? 0,
		h1Count: result.h1Tags.length,
	});
	return result;
}
