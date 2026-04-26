import type { Page } from 'playwright';
import type { ScanResult } from '../types/scan.types';

export async function collectInteractiveData(
	page: Page,
): Promise<NonNullable<ScanResult['interactive']>> {
	return page.evaluate(() => {
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
}

export async function collectSeoData(
	page: Page,
): Promise<NonNullable<ScanResult['seoData']>> {
	return page.evaluate(() => ({
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
	}));
}
