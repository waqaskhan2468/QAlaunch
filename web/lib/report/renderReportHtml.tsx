import type { IssueCategory, IssueSeverity } from '@/lib/scan/ai/types';
import type { ReportIssue, ReportScan, ReportScanPage } from './report.types';
import { computeHealthScore, labelFromScore } from '@/lib/scoring/health';

// ─────────────────────────────────────────────────────────────────────────────
// Page-break budget (A4 @ 96 dpi, 16 mm top+bottom margins → ~1000 px usable)
// ─────────────────────────────────────────────────────────────────────────────
const PAGE_H = 900;
const SEC_HEAD_H = 48;
const ISSUES_PAD = 32;
const ISSUE_BASE_H = 155;
const ISSUE_GAP = 12;
const CHARS_PER_LINE = 78;

function extraLines(text: string, cpl = CHARS_PER_LINE): number {
	return Math.max(0, Math.ceil(text.length / cpl) - 1);
}

function estimateIssueHeight(issue: ReportIssue): number {
	const titleLines = 1 + extraLines(issue.title, 72);
	const descLines = 1 + extraLines(issue.description, CHARS_PER_LINE);
	const impactLines = 1 + extraLines(issue.impact, CHARS_PER_LINE);
	return ISSUE_BASE_H + titleLines * 20 + descLines * 17 + impactLines * 17;
}

// ─────────────────────────────────────────────────────────────────────────────
// Category config — all categories the AI can emit
// ─────────────────────────────────────────────────────────────────────────────
const CATEGORY_ORDER: Array<{
	key: IssueCategory | 'security' | 'content';
	title: string;
	num: string;
	icon: string;
}> = [
	{ key: 'functionality', title: 'Functionality', num: '01', icon: '⚙' },
	{ key: 'ui_bugs',       title: 'UI & Visual Bugs', num: '02', icon: '◈' },
	{ key: 'usability_ux',  title: 'Usability & UX',   num: '03', icon: '◎' },
	{ key: 'responsiveness', title: 'Mobile & Responsive', num: '04', icon: '⊡' },
	{ key: 'performance',   title: 'Performance',       num: '05', icon: '▲' },
	{ key: 'seo',           title: 'SEO',               num: '06', icon: '◉' },
	{ key: 'accessibility', title: 'Accessibility',     num: '07', icon: '◷' },
	{ key: 'security',      title: 'Security',          num: '08', icon: '◫' },
	{ key: 'content',       title: 'Content',           num: '09', icon: '◧' },
];

const SEVERITY_ORDER: Record<IssueSeverity, number> = {
	critical: 0,
	high: 1,
	medium: 2,
	low: 3,
};

// ─────────────────────────────────────────────────────────────────────────────
// Style helpers
// ─────────────────────────────────────────────────────────────────────────────

function severityConfig(severity: IssueSeverity): {
	bg: string; color: string; dot: string; border: string; label: string;
} {
	switch (severity) {
		case 'critical': return { bg: '#fff1f2', color: '#be123c', dot: '#f43f5e', border: '#f43f5e', label: 'Critical' };
		case 'high':     return { bg: '#fff7ed', color: '#c2410c', dot: '#f97316', border: '#f97316', label: 'High' };
		case 'medium':   return { bg: '#fefce8', color: '#a16207', dot: '#eab308', border: '#eab308', label: 'Medium' };
		case 'low':      return { bg: '#eff6ff', color: '#1d4ed8', dot: '#3b82f6', border: '#3b82f6', label: 'Low' };
		default:         return { bg: '#f9fafb', color: '#374151', dot: '#6b7280', border: '#e5e7eb', label: String(severity) };
	}
}

function categoryChipStyle(category: string): { bg: string; color: string } {
	switch (category) {
		case 'functionality':  return { bg: '#fef2f2', color: '#dc2626' };
		case 'ui_bugs':        return { bg: '#fdf4ff', color: '#9333ea' };
		case 'usability_ux':   return { bg: '#eff6ff', color: '#2563eb' };
		case 'responsiveness': return { bg: '#f0fdf4', color: '#16a34a' };
		case 'performance':    return { bg: '#fff7ed', color: '#ea580c' };
		case 'seo':            return { bg: '#fefce8', color: '#b45309' };
		case 'accessibility':  return { bg: '#f0f9ff', color: '#0284c7' };
		case 'security':       return { bg: '#fff1f2', color: '#be123c' };
		case 'content':        return { bg: '#f8fafc', color: '#475569' };
		default:               return { bg: '#f5f3ff', color: '#6366f1' };
	}
}

function categoryDisplayLabel(category: string): string {
	const found = CATEGORY_ORDER.find((c) => c.key === category);
	return found ? found.title : String(category);
}

function perfBarColor(score: number) {
	return score >= 90 ? '#10b981' : score >= 50 ? '#f59e0b' : '#f43f5e';
}
function lcpBarColor(ms: number) {
	return ms <= 2500 ? '#10b981' : ms <= 4000 ? '#f59e0b' : '#f43f5e';
}

// ─────────────────────────────────────────────────────────────────────────────
// Text helpers
// ─────────────────────────────────────────────────────────────────────────────

function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

// ─────────────────────────────────────────────────────────────────────────────
// Score ring
// ─────────────────────────────────────────────────────────────────────────────

const RING_C = 289; // 2π × 46
function scoreRingOffset(score: number) { return Math.round(RING_C * (1 - score / 100)); }
function scoreGradientId(score: number) {
	return score >= 80 ? 'grad-green' : score >= 60 ? 'grad-amber' : 'grad-red';
}

// ─────────────────────────────────────────────────────────────────────────────
// Perf metrics
// ─────────────────────────────────────────────────────────────────────────────

function safeNum(value: unknown): number | null {
	return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function getPerformanceMetrics(pages: ReportScanPage[]) {
	const perfScores: number[] = [];
	const lcpValues: number[] = [];
	for (const page of pages) {
		const pageSpeed = page.page_speed_data as Record<string, unknown> | null;
		for (const strategy of ['mobile', 'desktop'] as const) {
			const snapshot = pageSpeed?.[strategy] as Record<string, unknown> | undefined;
			const perfNum = safeNum(snapshot?.performance);
			const lcpNum = safeNum(snapshot?.lcpMs);
			if (perfNum !== null) perfScores.push(perfNum);
			if (lcpNum !== null) lcpValues.push(lcpNum);
		}
	}
	const avg = (arr: number[]) =>
		arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;
	return { avgPerf: avg(perfScores), avgLcp: avg(lcpValues) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Issue card HTML
// ─────────────────────────────────────────────────────────────────────────────

function issueToHtml(issue: ReportIssue): string {
	const sev = severityConfig(issue.severity);
	const cat = categoryChipStyle(issue.category);
	const catLabel = categoryDisplayLabel(issue.category);

	// Shorten long page_section labels
	const section = issue.page_section && issue.page_section.length > 60
		? issue.page_section.slice(0, 57) + '…'
		: issue.page_section;

	return `
<div class="issue" style="border-left:3px solid ${sev.border};">
  <div class="issue-chips">
    <div class="sev-badge" style="background:${sev.bg};color:${sev.color};">
      <span class="sev-dot" style="background:${sev.dot};"></span>${sev.label}
    </div>
    <div class="cat-chip" style="background:${cat.bg};color:${cat.color};">${escapeHtml(catLabel)}</div>
  </div>

  <div class="issue-title">${escapeHtml(issue.title)}</div>
  ${section ? `<div class="issue-location">📍 ${escapeHtml(section)}</div>` : ''}

  <div class="issue-desc">${escapeHtml(issue.description)}</div>

  <div class="field-block impact-block">
    <div class="field-key">⚡ Why it matters</div>
    <div class="field-val">${escapeHtml(issue.impact)}</div>
  </div>
</div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Section HTML (with page-break bucketing)
// ─────────────────────────────────────────────────────────────────────────────

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
    <span class="sec-pill sec-pill--clean">✓ No issues</span>
  </div>
  <div class="issues-body"><p class="empty-state">No issues found in this category.</p></div>
</div>`;
	}

	const buckets: ReportIssue[][] = [];
	let bucket: ReportIssue[] = [];
	const perfExtraH = perfExtra ? 120 : 0;
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
			const contLabel = isFirst ? '' : `<span class="sec-cont">continued</span>`;
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
// Main render
// ─────────────────────────────────────────────────────────────────────────────

export function renderReportHtml(input: {
	scan: ReportScan;
	issues: ReportIssue[];
	pages: ReportScanPage[];
	logoUrl?: string;
}): string {
	const { scan, issues, pages, logoUrl } = input;
	const generatedAt = new Date().toISOString();

	// White-text wordmark on the dark cover. Falls back to the inline SVG mark
	// when no hosted logo URL is supplied (e.g. local renders without an origin).
	const coverBrandHtml = logoUrl
		? `<img src="${escapeHtml(logoUrl)}" alt="QAlaunch" style="height:32px;width:auto;display:block;" />`
		: `<div class="brand-mark">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
          </svg>
        </div>
        <span class="brand-name">QAlaunch</span>`;
	const score = computeHealthScore(issues.map((i) => i.severity));
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

	const sorted = [...issues].sort((a, b) => {
		const diff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
		return diff !== 0 ? diff : a.display_order - b.display_order;
	});

	// ── Summary stat cards ──────────────────────────────────────────────────
	const statCards = [
		{ num: issues.length,                               lbl: 'Total Issues', accent: '#6366f1', bg: '#f5f3ff' },
		{ num: severityCounts.critical,                     lbl: 'Critical',     accent: '#f43f5e', bg: '#fff1f2' },
		{ num: severityCounts.high,                         lbl: 'High',         accent: '#f97316', bg: '#fff7ed' },
		{ num: severityCounts.medium + severityCounts.low,  lbl: 'Medium / Low', accent: '#eab308', bg: '#fefce8' },
	];
	const statCardsHtml = statCards.map((c) => `
<div class="stat-card" style="background:${c.bg};">
  <div class="stat-num" style="color:${c.accent};">${c.num}</div>
  <div class="stat-lbl">${c.lbl}</div>
</div>`).join('');

	// ── Category breakdown bars ──────────────────────────────────────────────
	const breakdownHtml = CATEGORY_ORDER.map((s) => {
		const catIssues = issues.filter((i) => i.category === s.key);
		const count = catIssues.length;
		if (count === 0) return '';
		const critCount = catIssues.filter((i) => i.severity === 'critical').length;
		const highCount = catIssues.filter((i) => i.severity === 'high').length;
		const pct = issues.length > 0 ? Math.round((count / issues.length) * 100) : 0;
		const barColor = critCount > 0 ? '#f43f5e' : highCount > 0 ? '#f97316' : '#a78bfa';
		const catStyle = categoryChipStyle(s.key);
		const sevParts: string[] = [];
		if (critCount > 0) sevParts.push(`${critCount} critical`);
		if (highCount > 0) sevParts.push(`${highCount} high`);
		const sevLabel = sevParts.length > 0 ? sevParts.join(', ') : `${count} total`;
		return `
<div class="breakdown-row">
  <div class="breakdown-left">
    <span class="cat-chip" style="background:${catStyle.bg};color:${catStyle.color};">${escapeHtml(s.title)}</span>
  </div>
  <div class="breakdown-track">
    <div class="breakdown-fill" style="width:${pct}%;background:${barColor};"></div>
  </div>
  <span class="breakdown-sev">${escapeHtml(sevLabel)}</span>
  <span class="breakdown-n">${count}</span>
</div>`;
	}).join('');

	// ── Top priority actions (up to 3 critical/high issues) ─────────────────
	const priorityIssues = sorted.filter((i) => i.severity === 'critical' || i.severity === 'high').slice(0, 3);
	const priorityHtml = priorityIssues.length > 0 ? `
<div class="section-label" style="margin-top:20px;">Priority Actions</div>
<div class="priority-list">
${priorityIssues.map((issue, idx) => {
	const sev = severityConfig(issue.severity);
	return `
  <div class="priority-row">
    <span class="priority-num">${idx + 1}</span>
    <div class="priority-body">
      <div class="priority-title">${escapeHtml(issue.title)}</div>
      <div class="priority-meta">
        <span class="sev-badge" style="background:${sev.bg};color:${sev.color};">
          <span class="sev-dot" style="background:${sev.dot};"></span>${sev.label}
        </span>
        <span class="priority-cat">${escapeHtml(categoryDisplayLabel(issue.category))}</span>
      </div>
    </div>
  </div>`;
}).join('')}
</div>` : '';

	// ── Section pages ────────────────────────────────────────────────────────
	const sectionsHtml = CATEGORY_ORDER.map((s) => {
		const sectionIssues = sorted.filter((i) => i.category === s.key);
		const perfExtra =
			s.key === 'performance' && (avgPerf !== null || avgLcp !== null) ?
				`<div class="perf-grid">
  <div class="perf-card">
    <div class="perf-label">Avg Performance Score</div>
    <div class="perf-value">${avgPerf ?? 'N/A'}<span class="perf-unit"> / 100</span></div>
    <div class="perf-bar-wrap"><div class="perf-bar-track"><div class="perf-bar-fill" style="width:${avgPerf ?? 0}%;background:${avgPerf !== null ? perfBarColor(avgPerf) : '#e5e7eb'};"></div></div></div>
    <div class="perf-hint">${avgPerf !== null ? (avgPerf >= 90 ? '✓ Good' : avgPerf >= 50 ? '⚠ Needs work' : '✗ Poor') : ''}</div>
  </div>
  <div class="perf-card">
    <div class="perf-label">Avg Largest Contentful Paint</div>
    <div class="perf-value">${avgLcp !== null ? (avgLcp / 1000).toFixed(1) : 'N/A'}<span class="perf-unit"> s</span></div>
    <div class="perf-bar-wrap"><div class="perf-bar-track"><div class="perf-bar-fill" style="width:${avgLcp !== null ? Math.min(100, Math.round((avgLcp / 6000) * 100)) : 0}%;background:${avgLcp !== null ? lcpBarColor(avgLcp) : '#e5e7eb'};"></div></div></div>
    <div class="perf-hint">${avgLcp !== null ? (avgLcp <= 2500 ? '✓ Fast' : avgLcp <= 4000 ? '⚠ Slow' : '✗ Very slow') : ''}</div>
  </div>
</div>`
			: '';
		return buildSectionHtml(s, sectionIssues, perfExtra);
	}).join('');

	const formattedDate = new Date(generatedAt).toLocaleDateString('en-US', {
		year: 'numeric', month: 'long', day: 'numeric',
	});

	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>QAlaunch Audit — ${escapeHtml(scan.url)}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --ink:    #0f172a;
  --ink-2:  #1e293b;
  --ink-3:  #475569;
  --ink-4:  #94a3b8;
  --line:   #e2e8f0;
  --line-2: #f1f5f9;
  --surface:#f8fafc;
  --white:  #ffffff;
  --brand:  #6366f1;
  --brand-light: #eef2ff;
  --radius: 10px;
  --radius-sm: 7px;
}

body {
  font-family: 'Inter', -apple-system, 'Helvetica Neue', sans-serif;
  color: var(--ink);
  font-size: 13px;
  line-height: 1.6;
  background: var(--white);
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

/* ── Page wrapper ─────────────────────────────────────────── */
.page {
  border: 1px solid var(--line);
  border-radius: var(--radius);
  overflow: hidden;
  page-break-after: always;
  break-after: page;
  break-inside: avoid;
  margin-bottom: 0;
}

/* ── Cover ────────────────────────────────────────────────── */
.cover {
  background: #0a0f1e;
  position: relative;
  overflow: hidden;
  min-height: 340px;
}
.cover-grid {
  position: absolute; inset: 0;
  background-image:
    linear-gradient(rgba(99,102,241,0.07) 1px, transparent 1px),
    linear-gradient(90deg, rgba(99,102,241,0.07) 1px, transparent 1px);
  background-size: 28px 28px;
}
.cover-glow {
  position: absolute; top: -80px; right: -60px;
  width: 340px; height: 340px;
  background: radial-gradient(circle, rgba(99,102,241,0.2) 0%, transparent 68%);
  border-radius: 50%;
}
.cover-inner {
  position: relative; z-index: 1;
  padding: 36px 200px 32px 36px;
}
.cover-brand {
  display: flex; align-items: center; gap: 10px;
  margin-bottom: 40px;
}
.brand-mark {
  width: 30px; height: 30px; background: var(--brand);
  border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
}
.brand-name { font-size: 14px; font-weight: 600; color: #e2e8f0; letter-spacing: -0.01em; }
.cover-eyebrow {
  font-size: 10.5px; font-weight: 600; color: #818cf8;
  text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 12px;
}
.cover-heading {
  font-size: 28px; font-weight: 700; color: #f1f5f9;
  letter-spacing: -0.03em; line-height: 1.18; margin-bottom: 10px;
}
.cover-url {
  font-family: 'Courier New', monospace; font-size: 11px;
  color: #64748b; margin-bottom: 36px; word-break: break-all;
}
.cover-divider { height: 1px; background: linear-gradient(90deg, rgba(99,102,241,0.5), transparent); margin-bottom: 26px; }
.cover-meta { display: flex; gap: 36px; }
.cover-meta-label { font-size: 10px; color: #475569; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 4px; }
.cover-meta-value { font-size: 14px; font-weight: 600; color: #cbd5e1; }
.cover-score {
  position: absolute; top: 50%; right: 30px; transform: translateY(-50%);
  z-index: 2; text-align: center;
}
.score-ring-wrap { position: relative; width: 120px; height: 120px; }
.score-ring-wrap svg { transform: rotate(-90deg); }
.score-val {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 36px; font-weight: 700; color: #f1f5f9; letter-spacing: -0.03em;
}
.score-label { font-size: 10px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em; margin-top: 9px; }
.score-grade { font-size: 12px; font-weight: 600; color: #cbd5e1; margin-top: 3px; }

/* ── Summary inner ────────────────────────────────────────── */
.page-inner { padding: 24px 26px 26px; }
.section-label {
  font-size: 10.5px; font-weight: 700; color: var(--ink-3);
  text-transform: uppercase; letter-spacing: 0.09em;
  padding-bottom: 9px; border-bottom: 1px solid var(--line-2); margin-bottom: 16px;
}

/* ── Stat cards ───────────────────────────────────────────── */
.stats-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 9px; margin-bottom: 22px; }
.stat-card { border-radius: var(--radius-sm); padding: 16px 12px 13px; text-align: center; }
.stat-num { font-size: 28px; font-weight: 700; line-height: 1; letter-spacing: -0.04em; }
.stat-lbl { font-size: 10.5px; color: var(--ink-3); margin-top: 5px; font-weight: 500; }

/* ── Breakdown ────────────────────────────────────────────── */
.breakdown-row { display: flex; align-items: center; gap: 10px; margin-bottom: 9px; }
.breakdown-left { display: flex; align-items: center; min-width: 175px; flex-shrink: 0; }
.breakdown-track { flex: 1; height: 5px; background: var(--line-2); border-radius: 99px; overflow: hidden; }
.breakdown-fill { height: 100%; border-radius: 99px; }
.breakdown-sev { font-size: 10px; color: var(--ink-4); white-space: nowrap; min-width: 90px; text-align: right; }
.breakdown-n { font-size: 12px; font-weight: 700; color: var(--ink-3); min-width: 22px; text-align: right; }

/* ── Priority list ────────────────────────────────────────── */
.priority-list { display: flex; flex-direction: column; gap: 8px; }
.priority-row { display: flex; align-items: flex-start; gap: 12px; padding: 11px 14px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-sm); }
.priority-num { width: 22px; height: 22px; background: var(--brand); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10.5px; font-weight: 700; flex-shrink: 0; margin-top: 1px; }
.priority-body { flex: 1; min-width: 0; }
.priority-title { font-size: 12.5px; font-weight: 600; color: var(--ink); line-height: 1.4; margin-bottom: 5px; }
.priority-meta { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
.priority-cat { font-size: 10px; color: var(--ink-4); }

/* ── Section header ───────────────────────────────────────── */
.sec-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 18px; background: var(--surface); border-bottom: 1px solid var(--line-2);
  break-after: avoid;
}
.sec-left { display: flex; align-items: center; gap: 9px; }
.sec-num { font-family: 'Courier New', monospace; font-size: 10px; color: var(--ink-4); font-weight: 600; }
.sec-icon { font-size: 14px; color: var(--ink-3); line-height: 1; }
.sec-title { font-size: 13.5px; font-weight: 700; color: var(--ink); letter-spacing: -0.01em; }
.sec-cont { font-size: 10px; color: var(--ink-4); font-weight: 400; margin-left: 5px; }
.sec-pill { font-size: 10.5px; font-weight: 600; color: var(--brand); background: var(--brand-light); border-radius: 99px; padding: 3px 12px; }
.sec-pill--clean { color: #16a34a; background: #dcfce7; }

/* ── Issue list ───────────────────────────────────────────── */
.issues-body { padding: 16px 18px; display: flex; flex-direction: column; gap: 12px; }
.empty-state { font-size: 12.5px; color: var(--ink-4); padding: 10px 0; }

/* ── Issue card ───────────────────────────────────────────── */
.issue {
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  padding: 14px 16px;
  background: var(--white);
  break-inside: avoid;
  page-break-inside: avoid;
}
.issue-chips { display: flex; align-items: center; gap: 7px; margin-bottom: 8px; flex-wrap: wrap; }
.sev-badge {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 10px; font-weight: 700;
  padding: 2px 9px 2px 6px; border-radius: 99px;
  text-transform: uppercase; letter-spacing: 0.06em;
  white-space: nowrap; flex-shrink: 0;
}
.sev-dot { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
.cat-chip {
  display: inline-flex; align-items: center;
  font-size: 10px; font-weight: 600;
  padding: 2px 9px; border-radius: 99px;
  letter-spacing: 0.02em; white-space: nowrap; flex-shrink: 0;
}
.issue-title {
  font-size: 13.5px; font-weight: 700; color: var(--ink);
  line-height: 1.38; letter-spacing: -0.01em; margin-bottom: 4px;
}
.issue-location {
  font-size: 10.5px; color: var(--ink-4); margin-bottom: 9px;
}
.issue-desc {
  font-size: 12px; color: var(--ink-2); line-height: 1.65; margin-bottom: 10px;
}

/* ── Field blocks ─────────────────────────────────────────── */
.field-block {
  border-radius: var(--radius-sm);
  padding: 9px 12px;
  margin-bottom: 7px;
}
.field-block:last-child { margin-bottom: 0; }
.field-key {
  font-size: 10.5px; font-weight: 700; color: var(--ink-2);
  margin-bottom: 5px; letter-spacing: 0.01em;
}
.field-val { font-size: 11.5px; color: var(--ink-3); line-height: 1.58; }

.impact-block { background: #fffbeb; border: 1px solid #fef3c7; }

/* ── Performance cards ────────────────────────────────────── */
.perf-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px; }
.perf-card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 16px; }
.perf-label { font-size: 10px; font-weight: 700; color: var(--ink-3); text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 7px; }
.perf-value { font-size: 30px; font-weight: 700; color: var(--ink); line-height: 1; letter-spacing: -0.04em; }
.perf-unit { font-size: 14px; color: var(--ink-3); font-weight: 400; }
.perf-bar-wrap { margin-top: 10px; }
.perf-bar-track { height: 4px; background: var(--line); border-radius: 99px; overflow: hidden; }
.perf-bar-fill { height: 100%; border-radius: 99px; }
.perf-hint { font-size: 10.5px; color: var(--ink-3); margin-top: 5px; font-weight: 500; }

/* ── Closing / footer ─────────────────────────────────────── */
.checklist { list-style: none; display: flex; flex-direction: column; gap: 8px; }
.checklist li { display: flex; align-items: flex-start; gap: 10px; font-size: 12.5px; color: var(--ink-2); line-height: 1.55; }
.check-icon {
  width: 17px; height: 17px; background: #dcfce7; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; margin-top: 1px; font-size: 9px; color: #16a34a; font-weight: 800;
}
.report-footer { margin-top: 24px; padding: 18px 20px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-sm); }
.footer-heading { font-size: 12px; font-weight: 700; color: var(--ink-2); margin-bottom: 5px; }
.footer-text { font-size: 12px; color: var(--ink-3); line-height: 1.58; }
.footer-contact { display: inline-block; margin-top: 10px; font-size: 12px; font-weight: 600; color: var(--brand); }

@media print {
  .page { page-break-after: always; break-after: page; }
}
</style>
</head>
<body>

<!-- COVER -->
<div class="page">
  <div class="cover">
    <div class="cover-grid"></div>
    <div class="cover-glow"></div>
    <div class="cover-inner">
      <div class="cover-brand">
        ${coverBrandHtml}
      </div>
      <div class="cover-eyebrow">Website Quality Audit</div>
      <div class="cover-heading">QA Analysis<br>Report</div>
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
          <div class="cover-meta-label">Issues found</div>
          <div class="cover-meta-value">${issues.length}</div>
        </div>
      </div>
    </div>
    <div class="cover-score">
      <div class="score-ring-wrap">
        <svg width="120" height="120" viewBox="0 0 120 120">
          <defs>
            <linearGradient id="grad-green" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#34d399"/><stop offset="100%" stop-color="#10b981"/>
            </linearGradient>
            <linearGradient id="grad-amber" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#fcd34d"/><stop offset="100%" stop-color="#f59e0b"/>
            </linearGradient>
            <linearGradient id="grad-red" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#fb7185"/><stop offset="100%" stop-color="#f43f5e"/>
            </linearGradient>
          </defs>
          <circle cx="60" cy="60" r="46" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="9"/>
          <circle cx="60" cy="60" r="46" fill="none" stroke="url(#${gradId})" stroke-width="9"
            stroke-dasharray="${RING_C}" stroke-dashoffset="${offset}" stroke-linecap="round"/>
        </svg>
        <div class="score-val">${score}</div>
      </div>
      <div class="score-label">Health Score</div>
      <div class="score-grade">${escapeHtml(scoreLabel)}</div>
    </div>
  </div>
</div>

<!-- SUMMARY -->
<div class="page">
  <div class="page-inner">
    <div class="section-label">Issue Summary</div>
    <div class="stats-grid">${statCardsHtml}</div>
    <div class="section-label" style="margin-top:22px;">Issues by Category</div>
    ${breakdownHtml || '<p class="empty-state">No issues found.</p>'}
    ${priorityHtml}
  </div>
</div>

<!-- SECTIONS -->
${sectionsHtml}

<!-- CLOSING PAGE -->
<div class="page">
  <div class="page-inner">
    <div class="section-label">What’s Working Well</div>
    <ul class="checklist">
      <li><span class="check-icon">✓</span>All pages were successfully crawled and scanned by our automated QA system.</li>
      <li><span class="check-icon">✓</span>Performance scores, accessibility checks, and SEO data were collected across all pages.</li>
      <li><span class="check-icon">✓</span>Every issue is ranked by business impact so your team knows exactly where to start.</li>
    </ul>
    <div class="report-footer">
      <div class="footer-heading">Recommended next steps</div>
      <div class="footer-text">
        Start with Critical and High severity issues — these affect real visitors right now.
        Share this report with your developer so they can reproduce and resolve each issue.
        Medium and Low issues can be addressed in a follow-up sprint.
      </div>
      <a class="footer-contact" href="mailto:support@getqalaunch.com">Questions? Contact support@getqalaunch.com</a>
    </div>
  </div>
</div>

</body>
</html>`;
}
