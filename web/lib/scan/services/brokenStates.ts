import type { Page } from 'playwright-core';
import { PROGRAMMATIC_RULESET_VERSION } from '../constants/programmatic';
import type { ProgrammaticFinding, ProgrammaticPayload } from '../types/scan.types';

const DEFAULT_MAX_FINDINGS = 48;

type BrokenEvaluateResult = {
	findings: ProgrammaticFinding[];
	truncated: boolean;
};

const BAD_TEXT_META_JSON = JSON.stringify([
	{
		src: String.raw`\[object Object\]`,
		flags: 'i',
		id: 'BROKEN_TEXT_OBJECT_OBJECT',
		title: 'Visible "[object Object]" text',
	},
	{ src: String.raw`\bNaN\b`, flags: '', id: 'BROKEN_TEXT_NAN', title: 'Visible "NaN" text' },
	{
		src: String.raw`\bundefined\b`,
		flags: 'i',
		id: 'BROKEN_TEXT_UNDEFINED',
		title: 'Visible "undefined" text',
	},
	{ src: String.raw`\bnull\b`, flags: '', id: 'BROKEN_TEXT_NULL', title: 'Visible "null" text' },
]);

/** Inlined string for Playwright `page.evaluate` (no TS callback — avoids tooling injecting helpers into the page). */
function buildBrokenStatesExpression(opts: { capFindings: number }): string {
	const o = JSON.stringify(opts);
	return `(function(o) {
	var capFindings = o.capFindings;
	function selectorHint(el) {
		try { if (el.id) return '#' + CSS.escape(el.id); } catch (_) { if (el.id) return '#' + el.id; }
		var tag = el.tagName.toLowerCase();
		var first = el.classList && el.classList[0];
		if (first && /^[a-zA-Z_-][a-zA-Z0-9_-]*$/.test(first)) {
			try { return tag + '.' + CSS.escape(first); } catch (_) { return tag + '.' + first; }
		}
		return tag;
	}
	function ref(el) {
		var r = el.getBoundingClientRect();
		return {
			selectorHint: selectorHint(el),
			tag: el.tagName.toLowerCase(),
			rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }
		};
	}
	function visible(el, rect) {
		if (rect.width < 1 || rect.height < 1) return false;
		var s = window.getComputedStyle(el);
		if (s.display === 'none' || s.visibility === 'hidden') return false;
		if (Number(s.opacity) < 0.05) return false;
		return true;
	}
	var findings = [];
	function tryPush(f) {
		if (findings.length < capFindings) findings.push(f);
	}
	var loadingSelector = '[aria-busy="true"],[data-loading],[data-busy],[data-state="loading"],[data-loading="true"],[role="progressbar"],[class*="loading"],[class*="spinner"],[class*="skeleton"]';
	var loadingEls = document.querySelectorAll(loadingSelector);
	for (var li = 0; li < loadingEls.length; li++) {
		var el = loadingEls[li];
		var rect = el.getBoundingClientRect();
		if (!visible(el, rect)) continue;
		tryPush({
			id: 'BROKEN_LOADING_INDICATOR_VISIBLE',
			severity: 'major',
			category: 'broken-state',
			title: 'Loading / skeleton UI still visible after settle',
			summary: 'Element suggests async work (aria-busy, loading class, skeleton, etc.) is still visible — page may be stuck loading.',
			elements: [ref(el)],
			evidence: { matched: el.getAttribute('aria-busy') ? 'aria-busy' : 'selector' }
		});
	}
	var badMeta = ${BAD_TEXT_META_JSON};
	var badPatterns = badMeta.map(function(c) {
		return { re: new RegExp(c.src, c.flags || undefined), id: c.id, title: c.title };
	});
	var textRoot = document.body;
	if (textRoot) {
		var walker = document.createTreeWalker(textRoot, NodeFilter.SHOW_TEXT, null);
		var n = walker.nextNode();
		while (n) {
			if (findings.length >= capFindings) break;
			var parent = n.parentElement;
			if (!parent) { n = walker.nextNode(); continue; }
			var pTag = parent.tagName;
			if (pTag === 'SCRIPT' || pTag === 'STYLE' || pTag === 'NOSCRIPT') {
				n = walker.nextNode();
				continue;
			}
			var raw = n.textContent || '';
			if (raw.length < 3) { n = walker.nextNode(); continue; }
			for (var bi = 0; bi < badPatterns.length; bi++) {
				var bp = badPatterns[bi];
				if (!bp.re.test(raw)) continue;
				var pr = parent.getBoundingClientRect();
				if (!visible(parent, pr)) break;
				tryPush({
					id: bp.id,
					severity: 'critical',
					category: 'broken-state',
					title: bp.title,
					summary: 'Matched pattern in visible text: ' + raw.trim().slice(0, 120),
					elements: [ref(parent)]
				});
				break;
			}
			n = walker.nextNode();
		}
	}
	var lists = document.querySelectorAll('ul, ol');
	for (var ui = 0; ui < lists.length; ui++) {
		if (findings.length >= capFindings) break;
		var list = lists[ui];
		if (list.querySelector('li')) continue;
		var lr = list.getBoundingClientRect();
		if (!visible(list, lr)) continue;
		tryPush({
			id: 'BROKEN_EMPTY_LIST',
			severity: 'info',
			category: 'broken-state',
			title: 'Visible list has no items',
			summary: 'Visible ul/ol has no li children — may be an empty state bug or unfinished data binding.',
			elements: [ref(list)]
		});
	}
	var tables = document.querySelectorAll('table');
	for (var ti = 0; ti < tables.length; ti++) {
		if (findings.length >= capFindings) break;
		var table = tables[ti];
		var bodyRows = table.querySelectorAll('tbody tr, tr');
		if (bodyRows.length > 0) continue;
		var tr = table.getBoundingClientRect();
		if (!visible(table, tr)) continue;
		tryPush({
			id: 'BROKEN_EMPTY_TABLE',
			severity: 'info',
			category: 'broken-state',
			title: 'Visible table has no rows',
			summary: 'Table is visible but has no data rows — verify loading state or API failure.',
			elements: [ref(table)]
		});
	}
	return { findings: findings, truncated: findings.length >= capFindings };
})(${o})`;
}

export async function collectBrokenStates(
	page: Page,
	options?: { maxFindings?: number },
): Promise<ProgrammaticPayload> {
	const maxFindings = options?.maxFindings ?? DEFAULT_MAX_FINDINGS;
	const started = Date.now();

	const expression = buildBrokenStatesExpression({ capFindings: maxFindings });
	const evaluated = (await page.evaluate(expression)) as BrokenEvaluateResult;

	const durationMs = Date.now() - started;
	const data = evaluated;

	return {
		findings: data.findings as ProgrammaticFinding[],
		stats: {
			durationMs,
			nodesScanned: data.findings.length,
			truncated: data.truncated,
			rulesetVersion: PROGRAMMATIC_RULESET_VERSION,
		},
	};
}
