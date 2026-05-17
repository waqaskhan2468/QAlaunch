import type { IssueCategory, IssueSeverity } from '@/lib/scan/ai/types';
import type { ReportIssue, ReportScan, ReportScanPage } from './report.types';
import {
	computeHealthScore,
	labelFromScore,
} from '@/lib/scoring/health';

// ─────────────────────────────────────────────────────────────────────────────
// Page-break budget
// Puppeteer A4 @ 96dpi = 794 × 1122px.
// Margins top:16mm + bottom:16mm (~61px each) → usable ~1000px.
// PAGE_H = 920px conservative budget.
// ─────────────────────────────────────────────────────────────────────────────

const PAGE_H = 920;
const SEC_HEAD_H = 44;
const ISSUES_PAD = 28;
const ISSUE_BASE_H = 168;
const ISSUE_TAG_H = 30;
const ISSUE_GAP = 10;
const CHARS_PER_LINE = 82;

function extraLines(text: string): number {
	return Math.max(0, Math.floor(text.length / CHARS_PER_LINE) - 1);
}

function estimateIssueHeight(issue: ReportIssue): number {
	const tagCount = 2 + (issue.page_section ? 1 : 0);
	const titleLines = 1 + extraLines(issue.title);
	const descLines = 1 + extraLines(issue.description);
	const impactLines = 1 + extraLines(issue.impact);
	const fixLines = 1 + extraLines(issue.fix_instructions);
	return (
		ISSUE_BASE_H +
		titleLines * 18 +
		descLines * 16 +
		tagCount * ISSUE_TAG_H +
		impactLines * 16 +
		fixLines * 16
	);
}

// ─────────────────────────────────────────────────────────────────────────────

const CATEGORY_ORDER: Array<{
	key: IssueCategory;
	title: string;
	num: string;
	icon: string;
}> = [
	{ key: 'functionality', title: 'Functionality', num: '01', icon: '⚙' },
	{ key: 'ui_bugs', title: 'UI / Visual Bugs', num: '02', icon: '◈' },
	{ key: 'usability_ux', title: 'Usability & UX', num: '03', icon: '◎' },
	{ key: 'responsiveness', title: 'Responsiveness', num: '04', icon: '⊡' },
	{ key: 'performance', title: 'Performance', num: '05', icon: '▲' },
	{ key: 'seo', title: 'SEO Fundamentals', num: '06', icon: '◉' },
	{ key: 'accessibility', title: 'Accessibility', num: '07', icon: '◷' },
];

const SEVERITY_ORDER: Record<IssueSeverity, number> = {
	critical: 0,
	high: 1,
	medium: 2,
	low: 3,
};

function severityConfig(severity: IssueSeverity): {
	bg: string;
	color: string;
	dot: string;
	label: string;
} {
	switch (severity) {
		case 'critical':
			return {
				bg: '#fff1f2',
				color: '#be123c',
				dot: '#f43f5e',
				label: 'Critical',
			};
		case 'high':
			return { bg: '#fff7ed', color: '#c2410c', dot: '#f97316', label: 'High' };
		case 'medium':
			return {
				bg: '#fefce8',
				color: '#a16207',
				dot: '#eab308',
				label: 'Medium',
			};
		case 'low':
			return { bg: '#eff6ff', color: '#1d4ed8', dot: '#3b82f6', label: 'Low' };
	}
}

function safeNum(value: unknown): number | null {
	return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function getPerformanceMetrics(pages: ReportScanPage[]) {
	const perfScores: number[] = [];
	const lcpValues: number[] = [];
	for (const page of pages) {
		const pageSpeed = page.page_speed_data as Record<string, unknown> | null;
		const mobile = pageSpeed?.mobile as Record<string, unknown> | undefined;
		const perfNum = safeNum(mobile?.performance);
		const lcpNum = safeNum(mobile?.lcpMs);
		if (perfNum !== null) perfScores.push(perfNum);
		if (lcpNum !== null) lcpValues.push(lcpNum);
	}
	const avg = (arr: number[]) =>
		arr.length > 0 ?
			Math.round(arr.reduce((a, b) => a + b, 0) / arr.length)
		:	null;
	return { avgPerf: avg(perfScores), avgLcp: avg(lcpValues) };
}

const RING_C = 163.4;
function scoreRingOffset(score: number) {
	return Math.round(RING_C * (1 - score / 100));
}
function scoreGradientId(score: number) {
	return (
		score >= 80 ? 'grad-green'
		: score >= 60 ? 'grad-amber'
		: 'grad-red'
	);
}
function perfBarColor(score: number) {
	return (
		score >= 90 ? '#10b981'
		: score >= 50 ? '#f59e0b'
		: '#f43f5e'
	);
}
function lcpBarColor(ms: number) {
	return (
		ms <= 2500 ? '#10b981'
		: ms <= 4000 ? '#f59e0b'
		: '#f43f5e'
	);
}

function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

function isPlaywrightRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

type ProgrammaticFindingRow = {
	id: string;
	severity: string;
	category: string;
	title: string;
	summary: string;
	elements?: Array<{ selectorHint?: string; tag?: string }>;
};

function collectProgrammaticFindings(
	pages: ReportScanPage[],
): Array<{ pageUrl: string; finding: ProgrammaticFindingRow }> {
	const out: Array<{ pageUrl: string; finding: ProgrammaticFindingRow }> = [];
	for (const page of pages) {
		const pd = page.playwright_data;
		if (!isPlaywrightRecord(pd)) continue;
		for (const key of ['brokenStates'] as const) {
			const block = pd[key];
			if (!isPlaywrightRecord(block)) continue;
			const list = block.findings;
			if (!Array.isArray(list)) continue;
			for (const raw of list) {
				if (!isPlaywrightRecord(raw)) continue;
				const title = raw.title;
				const summary = raw.summary;
				if (typeof title !== 'string' || typeof summary !== 'string') continue;
				out.push({
					pageUrl: page.page_url,
					finding: {
						id: typeof raw.id === 'string' ? raw.id : 'unknown',
						severity: typeof raw.severity === 'string' ? raw.severity : 'info',
						category:
							typeof raw.category === 'string' ? raw.category : 'layout',
						title,
						summary,
						elements: Array.isArray(raw.elements) ?
							(raw.elements as ProgrammaticFindingRow['elements'])
						:	undefined,
					},
				});
			}
		}
	}
	return out;
}

function programmaticSeverityStyle(severity: string): {
	bg: string;
	color: string;
	dot: string;
	label: string;
} {
	switch (severity) {
		case 'critical':
			return {
				bg: '#fff1f2',
				color: '#be123c',
				dot: '#f43f5e',
				label: 'Critical',
			};
		case 'major':
			return { bg: '#fff7ed', color: '#c2410c', dot: '#f97316', label: 'Major' };
		case 'minor':
			return {
				bg: '#fefce8',
				color: '#a16207',
				dot: '#eab308',
				label: 'Minor',
			};
		default:
			return { bg: '#f1f5f9', color: '#475569', dot: '#94a3b8', label: 'Info' };
	}
}

function programmaticFindingToHtml(
	pageUrl: string,
	f: ProgrammaticFindingRow,
): string {
	const sev = programmaticSeverityStyle(f.severity);
	const hint =
		f.elements?.[0]?.selectorHint || f.elements?.[0]?.tag || '';
	const meta = hint ?
		`${escapeHtml(hint)} · ${escapeHtml(f.category)}`
	:	escapeHtml(f.category);
	return `
<div class="issue prog-issue">
  <div class="issue-header">
    <div class="sev-badge" style="background:${sev.bg};color:${sev.color};">
      <span class="sev-dot" style="background:${sev.dot};"></span>
      ${sev.label}
    </div>
    <div class="issue-title">${escapeHtml(f.title)}</div>
  </div>
  <div class="issue-url">${escapeHtml(pageUrl)} <span class="url-sep">›</span> <span class="prog-id">${escapeHtml(f.id)}</span></div>
  <div class="issue-desc">${escapeHtml(f.summary)}</div>
  <div class="issue-fields">
    <div class="field-row"><span class="field-key">Rule</span><span class="field-val">${escapeHtml(f.id)}</span></div>
    <div class="field-row"><span class="field-key">Target</span><span class="field-val">${meta}</span></div>
  </div>
</div>`;
}

function buildProgrammaticScanHtml(pages: ReportScanPage[]): string {
	const rows = collectProgrammaticFindings(pages);
	if (rows.length === 0) {
		return `
<div class="page">
  <div class="sec-head">
    <div class="sec-left">
      <span class="sec-num">00</span>
      <span class="sec-icon">◇</span>
      <span class="sec-title">Automated state checks</span>
    </div>
    <span class="sec-pill sec-pill--clean">Clean</span>
  </div>
  <div class="issues-body"><p class="empty-state">No automated broken-state findings were recorded for these pages.</p></div>
</div>`;
	}

	const inner = rows
		.map(({ pageUrl, finding }) => programmaticFindingToHtml(pageUrl, finding))
		.join('');

	return `
<div class="page">
  <div class="sec-head">
    <div class="sec-left">
      <span class="sec-num">00</span>
      <span class="sec-icon">◇</span>
      <span class="sec-title">Automated state checks</span>
    </div>
    <span class="sec-pill">${rows.length} finding${rows.length !== 1 ? 's' : ''}</span>
  </div>
  <div class="issues-body">
    <p class="prog-lead">Detected in-browser during the scan (no AI): loading tokens, empty tables, and similar signals. Use with Claude findings for confirmation.</p>
    ${inner}
  </div>
</div>`;
}

function issueToHtml(issue: ReportIssue): string {
	const sev = severityConfig(issue.severity);
	return `
<div class="issue">
  <div class="issue-header">
    <div class="sev-badge" style="background:${sev.bg};color:${sev.color};">
      <span class="sev-dot" style="background:${sev.dot};"></span>
      ${sev.label}
    </div>
    <div class="issue-title">${escapeHtml(issue.title)}</div>
  </div>
  <div class="issue-url">${escapeHtml(issue.page_url)}${issue.page_section ? ` <span class="url-sep">›</span> ${escapeHtml(issue.page_section)}` : ''}</div>
  <div class="issue-desc">${escapeHtml(issue.description)}</div>
  <div class="issue-fields">
    ${issue.page_section ? `<div class="field-row"><span class="field-key">Section</span><span class="field-val">${escapeHtml(issue.page_section)}</span></div>` : ''}
    <div class="field-row"><span class="field-key">Impact</span><span class="field-val">${escapeHtml(issue.impact)}</span></div>
    <div class="field-row"><span class="field-key">Fix</span><span class="field-val">${escapeHtml(issue.fix_instructions)}</span></div>
  </div>
</div>`;
}

function buildSectionHtml(
	section: (typeof CATEGORY_ORDER)[number],
	sectionIssues: ReportIssue[],
	perfExtra: string,
): string {
	if (sectionIssues.length === 0) {
		return `
<div class="page">
  <div class="sec-head">
    <div class="sec-left">
      <span class="sec-num">${section.num}</span>
      <span class="sec-icon">${section.icon}</span>
      <span class="sec-title">${escapeHtml(section.title)}</span>
    </div>
    <span class="sec-pill sec-pill--clean">No issues</span>
  </div>
  <div class="issues-body"><p class="empty-state">✓ No issues detected in this category.</p></div>
</div>`;
	}

	const buckets: ReportIssue[][] = [];
	let bucket: ReportIssue[] = [];
	const perfExtraH = perfExtra ? 110 : 0;
	let usedH = SEC_HEAD_H + ISSUES_PAD + perfExtraH;

	for (const issue of sectionIssues) {
		const h = estimateIssueHeight(issue) + ISSUE_GAP;
		if (usedH + h > PAGE_H && bucket.length > 0) {
			buckets.push(bucket);
			bucket = [];
			usedH = SEC_HEAD_H + ISSUES_PAD;
		}
		bucket.push(issue);
		usedH += h;
	}
	if (bucket.length > 0) buckets.push(bucket);

	const total = sectionIssues.length;

	return buckets
		.map((pageIssues, idx) => {
			const isFirst = idx === 0;
			const contLabel = isFirst ? '' : `<span class="sec-cont">cont.</span>`;
			return `
<div class="page">
  <div class="sec-head">
    <div class="sec-left">
      <span class="sec-num">${section.num}</span>
      <span class="sec-icon">${section.icon}</span>
      <span class="sec-title">${escapeHtml(section.title)} ${contLabel}</span>
    </div>
    <span class="sec-pill">${total} issue${total !== 1 ? 's' : ''}</span>
  </div>
  <div class="issues-body">
    ${isFirst ? perfExtra : ''}
    ${pageIssues.map(issueToHtml).join('')}
  </div>
</div>`;
		})
		.join('');
}

// ─────────────────────────────────────────────────────────────────────────────

export function renderReportHtml(input: {
	scan: ReportScan;
	issues: ReportIssue[];
	pages: ReportScanPage[];
	logoUrl?: string;
}): string {
	const { scan, issues, pages } = input;
	const generatedAt = new Date().toISOString();
	const score = computeHealthScore(issues.map((issue) => issue.severity));
	const scoreLabel = labelFromScore(score);
	const offset = scoreRingOffset(score);
	const gradId = scoreGradientId(score);

	const severityCounts = {
		critical: issues.filter((i) => i.severity === 'critical').length,
		high: issues.filter((i) => i.severity === 'high').length,
		medium: issues.filter((i) => i.severity === 'medium').length,
		low: issues.filter((i) => i.severity === 'low').length,
	};

	const { avgPerf, avgLcp } = getPerformanceMetrics(pages);
	const perfBarWidth = avgPerf !== null ? `${avgPerf}%` : '0%';
	const perfBarClr = avgPerf !== null ? perfBarColor(avgPerf) : '#e5e7eb';
	const lcpBarWidth =
		avgLcp !== null ?
			`${Math.min(100, Math.round((avgLcp / 6000) * 100))}%`
		:	'0%';
	const lcpBarClr = avgLcp !== null ? lcpBarColor(avgLcp) : '#e5e7eb';

	const sorted = [...issues].sort((a, b) => {
		const diff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
		return diff !== 0 ? diff : a.display_order - b.display_order;
	});

	const breakdownHtml = CATEGORY_ORDER.map((s) => {
		const count = issues.filter((i) => i.category === s.key).length;
		const pct =
			issues.length > 0 ? Math.round((count / issues.length) * 100) : 0;
		const hasCritical = sorted.some(
			(i) => i.category === s.key && i.severity === 'critical',
		);
		const hasHigh = sorted.some(
			(i) => i.category === s.key && i.severity === 'high',
		);
		const dotColor =
			hasCritical ? '#f43f5e'
			: hasHigh ? '#f97316'
			: count > 0 ? '#a78bfa'
			: '#d1d5db';
		return `
<div class="breakdown-row">
  <div class="breakdown-left">
    <span class="breakdown-dot" style="background:${dotColor};"></span>
    <span class="breakdown-lbl">${escapeHtml(s.title)}</span>
  </div>
  <div class="breakdown-track">
    <div class="breakdown-fill" style="width:${pct}%;background:${dotColor};"></div>
  </div>
  <span class="breakdown-n">${count}</span>
</div>`;
	}).join('');

	// Severity stat cards config
	const statCards = [
		{ num: issues.length, lbl: 'Total', accent: '#6366f1', bg: '#f5f3ff' },
		{
			num: severityCounts.critical,
			lbl: 'Critical',
			accent: '#f43f5e',
			bg: '#fff1f2',
		},
		{ num: severityCounts.high, lbl: 'High', accent: '#f97316', bg: '#fff7ed' },
		{
			num: severityCounts.medium + severityCounts.low,
			lbl: 'Med / Low',
			accent: '#eab308',
			bg: '#fefce8',
		},
	];

	const statCardsHtml = statCards
		.map(
			(c) => `
<div class="stat-card" style="background:${c.bg};">
  <div class="stat-num" style="color:${c.accent};">${c.num}</div>
  <div class="stat-lbl">${c.lbl}</div>
</div>`,
		)
		.join('');

	const sectionsHtml = CATEGORY_ORDER.map((s) => {
		const sectionIssues = sorted.filter((i) => i.category === s.key);
		const perfExtra =
			s.key === 'performance' && (avgPerf !== null || avgLcp !== null) ?
				`
<div class="perf-grid">
  <div class="perf-card">
    <div class="perf-label">Mobile Performance</div>
    <div class="perf-value">${avgPerf ?? 'N/A'}<span class="perf-unit"> / 100</span></div>
    <div class="perf-track"><div class="perf-fill" style="width:${perfBarWidth};background:${perfBarClr};"></div></div>
  </div>
  <div class="perf-card">
    <div class="perf-label">Avg LCP (mobile)</div>
    <div class="perf-value">${avgLcp !== null ? avgLcp.toLocaleString() : 'N/A'}<span class="perf-unit"> ms</span></div>
    <div class="perf-track"><div class="perf-fill" style="width:${lcpBarWidth};background:${lcpBarClr};"></div></div>
  </div>
</div>`
			:	'';
		return buildSectionHtml(s, sectionIssues, perfExtra);
	}).join('');

	const programmaticScanHtml = buildProgrammaticScanHtml(pages);

	// Format date nicely
	const formattedDate = new Date(generatedAt).toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'long',
		day: 'numeric',
	});

	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>QAlaunch Audit — ${escapeHtml(scan.url)}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --ink: #0f172a;
  --ink-2: #374151;
  --ink-3: #6b7280;
  --ink-4: #9ca3af;
  --line: #e5e7eb;
  --line-2: #f3f4f6;
  --surface: #f9fafb;
  --white: #ffffff;
  --brand: #6366f1;
  --brand-light: #ede9fe;
  --radius: 10px;
  --radius-sm: 6px;
}

body {
  font-family: 'Geist', -apple-system, 'Helvetica Neue', sans-serif;
  color: var(--ink);
  font-size: 12.5px;
  line-height: 1.55;
  background: var(--white);
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

/* ── Page wrapper ──────────────────────────────────────────── */
.page {
  border: 1px solid var(--line);
  border-radius: var(--radius);
  overflow: hidden;
  page-break-after: always;
  break-inside: avoid;
  margin-bottom: 0;
}

/* ── Cover ─────────────────────────────────────────────────── */
.cover {
  background: #0a0f1e;
  padding: 0;
  position: relative;
  overflow: hidden;
  min-height: 320px;
}
.cover-noise {
  position: absolute;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
  opacity: 0.5;
}
.cover-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(99,102,241,0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(99,102,241,0.06) 1px, transparent 1px);
  background-size: 32px 32px;
}
.cover-glow {
  position: absolute;
  top: -80px;
  right: -60px;
  width: 320px;
  height: 320px;
  background: radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 70%);
  border-radius: 50%;
}
.cover-inner {
  position: relative;
  z-index: 1;
  padding: 32px 32px 28px;
}
.cover-brand {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-bottom: 36px;
}
.brand-mark {
  width: 28px;
  height: 28px;
  background: var(--brand);
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.brand-mark svg { display: block; }
.brand-name {
  font-size: 13px;
  font-weight: 600;
  color: #e2e8f0;
  letter-spacing: -0.01em;
}
.cover-eyebrow {
  font-size: 10px;
  font-weight: 500;
  color: #6366f1;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 10px;
}
.cover-heading {
  font-size: 26px;
  font-weight: 600;
  color: #f1f5f9;
  letter-spacing: -0.03em;
  line-height: 1.2;
  margin-bottom: 10px;
}
.cover-url {
  font-family: 'Geist Mono', monospace;
  font-size: 11px;
  color: #475569;
  margin-bottom: 32px;
  word-break: break-all;
}
.cover-divider {
  height: 1px;
  background: linear-gradient(90deg, rgba(99,102,241,0.4), transparent);
  margin-bottom: 24px;
}
.cover-meta {
  display: flex;
  gap: 32px;
}
.cover-meta-item {}
.cover-meta-label {
  font-size: 10px;
  color: #475569;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 4px;
}
.cover-meta-value {
  font-size: 14px;
  font-weight: 500;
  color: #cbd5e1;
}
.cover-score {
  position: absolute;
  top: 32px;
  right: 32px;
  z-index: 2;
  text-align: center;
}
.score-ring-wrap { position: relative; width: 72px; height: 72px; }
.score-ring-wrap svg { transform: rotate(-90deg); }
.score-val {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: 600;
  color: #f1f5f9;
  letter-spacing: -0.02em;
}
.score-label {
  font-size: 9.5px;
  font-weight: 500;
  color: #475569;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-top: 6px;
}
.score-grade {
  font-size: 10px;
  font-weight: 600;
  color: #cbd5e1;
  margin-top: 2px;
}

/* ── Summary page inner ────────────────────────────────────── */
.page-inner {
  padding: 22px 24px 24px;
}
.section-label {
  font-size: 10px;
  font-weight: 600;
  color: var(--ink-3);
  text-transform: uppercase;
  letter-spacing: 0.09em;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--line-2);
  margin-bottom: 14px;
}

/* ── Stat cards ────────────────────────────────────────────── */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-bottom: 20px;
}
.stat-card {
  border-radius: var(--radius-sm);
  padding: 14px 12px 12px;
  text-align: center;
}
.stat-num {
  font-size: 26px;
  font-weight: 600;
  line-height: 1;
  letter-spacing: -0.03em;
}
.stat-lbl {
  font-size: 10.5px;
  color: var(--ink-3);
  margin-top: 4px;
  font-weight: 500;
}

/* ── Breakdown ─────────────────────────────────────────────── */
.breakdown-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 7px;
}
.breakdown-left {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 164px;
}
.breakdown-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}
.breakdown-lbl {
  font-size: 11px;
  color: var(--ink-2);
}
.breakdown-track {
  flex: 1;
  height: 3px;
  background: var(--line-2);
  border-radius: 99px;
  overflow: hidden;
}
.breakdown-fill {
  height: 100%;
  border-radius: 99px;
  transition: width 0s;
}
.breakdown-n {
  font-size: 11px;
  font-weight: 500;
  color: var(--ink-3);
  min-width: 18px;
  text-align: right;
}

/* ── Section header ────────────────────────────────────────── */
.sec-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 11px 16px;
  background: var(--surface);
  border-bottom: 1px solid var(--line-2);
  break-after: avoid;
}
.sec-left {
  display: flex;
  align-items: center;
  gap: 8px;
}
.sec-num {
  font-family: 'Geist Mono', monospace;
  font-size: 10px;
  color: var(--ink-4);
  font-weight: 500;
}
.sec-icon {
  font-size: 13px;
  color: var(--ink-3);
  line-height: 1;
}
.sec-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--ink);
  letter-spacing: -0.01em;
}
.sec-cont {
  font-size: 10px;
  color: var(--ink-4);
  font-weight: 400;
  margin-left: 4px;
}
.sec-pill {
  font-size: 10.5px;
  font-weight: 500;
  color: var(--brand);
  background: var(--brand-light);
  border-radius: 99px;
  padding: 2px 11px;
}
.sec-pill--clean {
  color: var(--ink-4);
  background: var(--line-2);
}

/* ── Issue list ────────────────────────────────────────────── */
.issues-body {
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.empty-state {
  font-size: 12px;
  color: var(--ink-4);
  padding: 8px 0;
}

/* ── Issue card ────────────────────────────────────────────── */
.issue {
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  padding: 13px 14px;
  background: var(--white);
  break-inside: avoid;
  page-break-inside: avoid;
}
.issue-header {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  margin-bottom: 5px;
}
.sev-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 10px;
  font-weight: 600;
  padding: 2px 8px 2px 6px;
  border-radius: 99px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  white-space: nowrap;
  flex-shrink: 0;
  margin-top: 2px;
}
.sev-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  flex-shrink: 0;
}
.issue-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--ink);
  line-height: 1.4;
  letter-spacing: -0.01em;
}
.issue-url {
  font-family: 'Geist Mono', monospace;
  font-size: 10px;
  color: var(--ink-4);
  margin-bottom: 6px;
  word-break: break-all;
}
.url-sep {
  color: var(--ink-4);
  margin: 0 3px;
}
.issue-desc {
  font-size: 11.5px;
  color: var(--ink-2);
  line-height: 1.55;
  margin-bottom: 9px;
}
.issue-fields {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.field-row {
  display: flex;
  gap: 8px;
  background: var(--surface);
  border-radius: var(--radius-sm);
  padding: 5px 10px;
  font-size: 11px;
}
.field-key {
  font-weight: 600;
  color: var(--ink-2);
  min-width: 44px;
  flex-shrink: 0;
}
.field-val {
  color: var(--ink-3);
  line-height: 1.5;
}

/* ── Performance cards ─────────────────────────────────────── */
.perf-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 12px;
  break-inside: avoid;
}
.perf-card {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  padding: 14px;
}
.perf-label {
  font-size: 10px;
  font-weight: 600;
  color: var(--ink-3);
  text-transform: uppercase;
  letter-spacing: 0.07em;
  margin-bottom: 6px;
}
.perf-value {
  font-size: 28px;
  font-weight: 600;
  color: var(--ink);
  line-height: 1;
  letter-spacing: -0.03em;
}
.perf-unit {
  font-size: 13px;
  color: var(--ink-3);
  font-weight: 400;
}
.perf-track {
  height: 3px;
  background: var(--line);
  border-radius: 99px;
  overflow: hidden;
  margin-top: 10px;
}
.perf-fill {
  height: 100%;
  border-radius: 99px;
}

/* ── Footer ────────────────────────────────────────────────── */
.report-footer {
  margin-top: 24px;
  padding: 16px 18px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  break-inside: avoid;
}
.footer-heading {
  font-size: 11px;
  font-weight: 600;
  color: var(--ink-2);
  margin-bottom: 3px;
}
.footer-text {
  font-size: 11px;
  color: var(--ink-3);
}
.footer-contact {
  display: inline-block;
  margin-top: 8px;
  font-size: 11px;
  font-weight: 600;
  color: var(--brand);
}

/* ── Checklist ─────────────────────────────────────────────── */
.checklist {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 7px;
  margin-bottom: 0;
}
.checklist li {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  font-size: 12px;
  color: var(--ink-2);
  line-height: 1.5;
}
.check-icon {
  width: 16px;
  height: 16px;
  background: #dcfce7;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 1px;
  font-size: 9px;
  color: #16a34a;
  font-weight: 700;
}

.prog-lead {
  font-size: 11px;
  color: var(--ink-3);
  margin-bottom: 12px;
  line-height: 1.5;
}
.prog-id {
  font-family: 'Geist Mono', monospace;
  font-size: 10px;
  color: var(--ink-4);
}
.prog-issue {
  margin-bottom: 10px;
}

@media print {
  .page { page-break-after: always; }
}
</style>
</head>
<body>

<!-- ═══════════════════════════════════════════════════════════════
     COVER
════════════════════════════════════════════════════════════════ -->
<div class="page">
  <div class="cover">
    <div class="cover-noise"></div>
    <div class="cover-grid"></div>
    <div class="cover-glow"></div>
    <div class="cover-inner">
      <div class="cover-brand">
        <div class="brand-mark">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
          </svg>
        </div>
        <span class="brand-name">QAlaunch</span>
      </div>
      <div class="cover-eyebrow">Website Audit Report</div>
      <div class="cover-heading">Quality Assurance<br>Analysis</div>
      <div class="cover-url">${escapeHtml(scan.url)}</div>
      <div class="cover-divider"></div>
      <div class="cover-meta">
        <div class="cover-meta-item">
          <div class="cover-meta-label">Generated</div>
          <div class="cover-meta-value">${formattedDate}</div>
        </div>
        <div class="cover-meta-item">
          <div class="cover-meta-label">Pages scanned</div>
          <div class="cover-meta-value">${pages.length}</div>
        </div>
        <div class="cover-meta-item">
          <div class="cover-meta-label">Total issues</div>
          <div class="cover-meta-value">${issues.length}</div>
        </div>
      </div>
    </div>
    <div class="cover-score">
      <div class="score-ring-wrap">
        <svg width="72" height="72" viewBox="0 0 72 72">
          <defs>
            <linearGradient id="grad-green" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#34d399"/>
              <stop offset="100%" stop-color="#10b981"/>
            </linearGradient>
            <linearGradient id="grad-amber" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#fcd34d"/>
              <stop offset="100%" stop-color="#f59e0b"/>
            </linearGradient>
            <linearGradient id="grad-red" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#fb7185"/>
              <stop offset="100%" stop-color="#f43f5e"/>
            </linearGradient>
          </defs>
          <circle cx="36" cy="36" r="26" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="6"/>
          <circle cx="36" cy="36" r="26" fill="none" stroke="url(#${gradId})" stroke-width="6"
            stroke-dasharray="${RING_C}" stroke-dashoffset="${offset}" stroke-linecap="round"/>
        </svg>
        <div class="score-val">${score}</div>
      </div>
      <div class="score-label">Health Score</div>
      <div class="score-grade">${escapeHtml(scoreLabel)}</div>
    </div>
  </div>
</div>

<!-- ═══════════════════════════════════════════════════════════════
     SUMMARY
════════════════════════════════════════════════════════════════ -->
<div class="page">
  <div class="page-inner">
    <div class="section-label">Severity Breakdown</div>
    <div class="stats-grid">
      ${statCardsHtml}
    </div>
    <div class="section-label" style="margin-top:18px;">Issues by Category</div>
    ${breakdownHtml}
  </div>
</div>

<!-- ═══════════════════════════════════════════════════════════════
     SECTIONS
════════════════════════════════════════════════════════════════ -->
${programmaticScanHtml}
${sectionsHtml}

<!-- ═══════════════════════════════════════════════════════════════
     CLOSING PAGE
════════════════════════════════════════════════════════════════ -->
<div class="page">
  <div class="page-inner">
    <div class="section-label">What\u2019s Working Well</div>
    <ul class="checklist">
      <li><span class="check-icon">✓</span>Core website flows are accessible and were successfully crawled without authentication barriers.</li>
      <li><span class="check-icon">✓</span>PageSpeed and accessibility baselines were collected across all scanned pages.</li>
      <li><span class="check-icon">✓</span>All issues are ranked by business impact and implementation urgency for your team.</li>
    </ul>
    <div class="report-footer">
      <div class="footer-heading">Next steps</div>
      <div class="footer-text">Share this report with your development team and prioritize critical and high severity issues first. Use the Fix instructions in each card as a starting point for your sprint backlog.</div>
      <a class="footer-contact" href="mailto:support@qalaunch.com">support@qalaunch.com</a>
    </div>
  </div>
</div>

</body>
</html>`;
}
