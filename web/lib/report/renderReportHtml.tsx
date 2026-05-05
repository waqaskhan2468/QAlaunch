import type { IssueCategory, IssueSeverity } from '@/types/claude';
import type { ReportIssue, ReportScan, ReportScanPage } from './report.types';

const CATEGORY_ORDER: Array<{
	key: IssueCategory;
	title: string;
	num: string;
}> = [
	{ key: 'functionality', title: 'Functionality issues', num: '01' },
	{ key: 'ui_bugs', title: 'UI / Visual bugs', num: '02' },
	{ key: 'usability_ux', title: 'Usability & UX issues', num: '03' },
	{ key: 'responsiveness', title: 'Responsiveness issues', num: '04' },
	{ key: 'performance', title: 'Performance issues', num: '05' },
	{ key: 'seo', title: 'SEO fundamentals', num: '06' },
	{ key: 'accessibility', title: 'Accessibility issues', num: '07' },
];

const SEVERITY_ORDER: Record<IssueSeverity, number> = {
	critical: 0,
	high: 1,
	medium: 2,
	low: 3,
};

/** Returns inline styles for each severity pill */
function severityPillStyle(severity: IssueSeverity): string {
	switch (severity) {
		case 'critical':
			return 'background:#fee2e2;color:#991b1b;';
		case 'high':
			return 'background:#ffedd5;color:#9a3412;';
		case 'medium':
			return 'background:#fef9c3;color:#854d0e;';
		case 'low':
			return 'background:#dbeafe;color:#1e40af;';
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
		const perf = mobile?.performance;
		const lcp = mobile?.lcpMs;
		const perfNum = safeNum(perf);
		if (perfNum !== null) perfScores.push(perfNum);
		const lcpNum = safeNum(lcp);
		if (lcpNum !== null) lcpValues.push(lcpNum);
	}

	const avgPerf =
		perfScores.length > 0 ?
			Math.round(perfScores.reduce((a, b) => a + b, 0) / perfScores.length)
		:	null;

	const avgLcp =
		lcpValues.length > 0 ?
			Math.round(lcpValues.reduce((a, b) => a + b, 0) / lcpValues.length)
		:	null;

	return { avgPerf, avgLcp };
}

function healthScore(issues: ReportIssue[]): number {
	let score = 100;
	for (const issue of issues) {
		if (issue.severity === 'critical') score -= 12;
		else if (issue.severity === 'high') score -= 7;
		else if (issue.severity === 'medium') score -= 4;
		else score -= 2;
	}
	return Math.max(0, score);
}

/** SVG circle circumference for r=28 → 2π×28 ≈ 175.9 */
const RING_CIRCUMFERENCE = 175.9;

function scoreRingOffset(score: number): number {
	// dashoffset = circumference × (1 − score/100)
	return Math.round(RING_CIRCUMFERENCE * (1 - score / 100));
}

function scoreRingColor(score: number): string {
	if (score >= 80) return '#22c55e';
	if (score >= 60) return '#f59e0b';
	return '#ef4444';
}

function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

function issueToHtml(issue: ReportIssue): string {
	const sectionRow =
		issue.page_section ?
			`<div class="issue-tag"><strong>Section:</strong> ${escapeHtml(issue.page_section)}</div>`
		:	'';

	return `
  <div class="issue">
    <div class="issue-top">
      <div class="sev-pill" style="${severityPillStyle(issue.severity)}">${escapeHtml(issue.severity)}</div>
      <div class="issue-title">${escapeHtml(issue.title)}</div>
    </div>
    <div class="issue-meta">${escapeHtml(issue.page_url)}${issue.page_section ? ` &mdash; ${escapeHtml(issue.page_section)}` : ''}</div>
    <div class="issue-desc">${escapeHtml(issue.description)}</div>
    <div class="issue-rows">
      ${sectionRow}
      <div class="issue-tag"><strong>Impact:</strong> ${escapeHtml(issue.impact)}</div>
      <div class="issue-tag"><strong>Fix:</strong> ${escapeHtml(issue.fix_instructions)}</div>
    </div>
  </div>`;
}

function perfBarColor(score: number): string {
	if (score >= 90) return '#22c55e';
	if (score >= 50) return '#f59e0b';
	return '#ef4444';
}

function lcpBarColor(ms: number): string {
	if (ms <= 2500) return '#22c55e';
	if (ms <= 4000) return '#f59e0b';
	return '#ef4444';
}

export function renderReportHtml(input: {
	scan: ReportScan;
	issues: ReportIssue[];
	pages: ReportScanPage[];
	logoUrl?: string;
}): string {
	const { scan, issues, pages } = input;
	const generatedAt = new Date().toISOString();
	const score = healthScore(issues);
	const offset = scoreRingOffset(score);
	const ringColor = scoreRingColor(score);

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
		const sa = SEVERITY_ORDER[a.severity];
		const sb = SEVERITY_ORDER[b.severity];
		if (sa !== sb) return sa - sb;
		return a.display_order - b.display_order;
	});

	// ── Sections HTML ────────────────────────────────────────────────────────
	const sectionsHtml = CATEGORY_ORDER.map((section) => {
		const sectionIssues = sorted.filter((i) => i.category === section.key);
		const issuesHtml =
			sectionIssues.length === 0 ?
				'<p class="empty">No issues detected in this section.</p>'
			:	sectionIssues.map(issueToHtml).join('');

		const perfExtra =
			section.key === 'performance' && (avgPerf !== null || avgLcp !== null) ?
				`<div class="perf-grid">
              <div class="perf-card">
                <div class="perf-label">Mobile performance score</div>
                <div class="perf-val">${avgPerf ?? 'N/A'}<span class="perf-unit"> / 100</span></div>
                <div class="perf-bar"><div style="width:${perfBarWidth};background:${perfBarClr};"></div></div>
              </div>
              <div class="perf-card">
                <div class="perf-label">Average LCP (mobile)</div>
                <div class="perf-val">${avgLcp !== null ? avgLcp.toLocaleString() : 'N/A'}<span class="perf-unit"> ms</span></div>
                <div class="perf-bar"><div style="width:${lcpBarWidth};background:${lcpBarClr};"></div></div>
              </div>
            </div>`
			:	'';

		return `
  <div class="page">
    <div class="section-head">
      <span class="section-num">${section.num}</span>
      <span class="section-title">${escapeHtml(section.title)}</span>
      <span class="section-count">${sectionIssues.length} issue${sectionIssues.length !== 1 ? 's' : ''}</span>
    </div>
    ${perfExtra}
    <div class="section-body">${issuesHtml}</div>
  </div>`;
	}).join('');

	// ── Category breakdown rows ──────────────────────────────────────────────
	const breakdownHtml = CATEGORY_ORDER.map((section) => {
		const count = issues.filter((i) => i.category === section.key).length;
		const pct =
			issues.length > 0 ? Math.round((count / issues.length) * 100) : 0;
		return `
  <div class="breakdown-row">
    <span class="breakdown-label">${escapeHtml(section.title)}</span>
    <div class="breakdown-bar-wrap">
      <div class="breakdown-bar-fill" style="width:${pct}%;"></div>
    </div>
    <span class="breakdown-count">${count}</span>
  </div>`;
	}).join('');

	// ────────────────────────────────────────────────────────────────────────
	return `<!doctype html>
  <html>
  <head>
  <meta charset="utf-8"/>
  <title>QAlaunch Audit Report &mdash; ${escapeHtml(scan.url)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500&family=DM+Mono:wght@400&display=swap');

    *, *::before, *::after { box-sizing: border-box; }

    body {
      font-family: 'DM Sans', Arial, sans-serif;
      color: #111827;
      margin: 0;
      font-size: 12px;
      line-height: 1.55;
      background: #fff;
    }

    /* ── Page breaks ───────────────────────────────────── */
    .page { page-break-after: always; padding: 32px 28px; }
    .no-break { page-break-inside: avoid; }

    /* ── Cover page ────────────────────────────────────── */
    .cover {
      background: #0f172a;
      color: #f8fafc;
      padding: 40px 36px 36px;
      border-radius: 14px;
      position: relative;
      overflow: hidden;
      margin-bottom: 0;
    }
    .cover-ring-1 {
      position: absolute; top: -70px; right: -70px;
      width: 240px; height: 240px; border-radius: 50%;
      border: 48px solid rgba(255,255,255,0.04);
    }
    .cover-ring-2 {
      position: absolute; bottom: -50px; right: 80px;
      width: 140px; height: 140px; border-radius: 50%;
      border: 28px solid rgba(255,255,255,0.03);
    }
    .logo-row {
      display: flex; align-items: center; gap: 10px;
      margin-bottom: 32px;
    }
    .logo-icon {
      width: 30px; height: 30px; border-radius: 7px;
      background: #6366f1;
      display: flex; align-items: center; justify-content: center;
    }
    .logo-icon svg { width: 17px; height: 17px; }
    .logo-text { font-size: 14px; font-weight: 500; color: #e2e8f0; letter-spacing: -0.01em; }

    .cover-title { font-size: 26px; font-weight: 500; margin: 0 0 6px; color: #f1f5f9; letter-spacing: -0.02em; }
    .cover-url {
      font-family: 'DM Mono', monospace;
      font-size: 12px; color: #94a3b8;
      margin-bottom: 28px; word-break: break-all;
    }
    .cover-meta { display: flex; gap: 28px; flex-wrap: wrap; }
    .cover-meta-item { font-size: 11px; color: #94a3b8; }
    .cover-meta-item span { display: block; font-size: 13px; font-weight: 500; color: #e2e8f0; margin-top: 2px; }

    .score-badge { position: absolute; top: 38px; right: 38px; text-align: center; }
    .score-ring { position: relative; width: 76px; height: 76px; }
    .score-ring svg { transform: rotate(-90deg); }
    .score-val {
      position: absolute; top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      font-size: 20px; font-weight: 500; color: #f1f5f9; line-height: 1;
    }
    .score-lbl { font-size: 10px; color: #94a3b8; margin-top: 5px; letter-spacing: 0.05em; text-transform: uppercase; }

    /* ── Summary stats ─────────────────────────────────── */
    .section-label {
      font-size: 10px; font-weight: 500; color: #6b7280;
      text-transform: uppercase; letter-spacing: 0.06em;
      margin: 28px 0 10px; padding-bottom: 7px;
      border-bottom: 1px solid #f3f4f6;
    }
    .stats-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 10px; margin-bottom: 8px; }
    .stat-card { background: #f9fafb; border-radius: 10px; padding: 14px 12px; text-align: center; }
    .stat-num { font-size: 24px; font-weight: 500; line-height: 1; }
    .stat-lbl { font-size: 11px; color: #6b7280; margin-top: 4px; }

    /* ── Performance cards ─────────────────────────────── */
    .perf-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 12px 0; }
    .perf-card { background: #f9fafb; border-radius: 10px; padding: 14px; }
    .perf-label { font-size: 10px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 7px; }
    .perf-val { font-size: 26px; font-weight: 500; color: #111827; line-height: 1; }
    .perf-unit { font-size: 13px; color: #6b7280; }
    .perf-bar { height: 5px; border-radius: 99px; background: #e5e7eb; margin-top: 10px; overflow: hidden; }
    .perf-bar div { height: 100%; border-radius: 99px; }

    /* ── Category breakdown ────────────────────────────── */
    .breakdown-row { display: flex; align-items: center; gap: 10px; margin-bottom: 7px; }
    .breakdown-label { font-size: 11px; color: #374151; min-width: 160px; }
    .breakdown-bar-wrap { flex: 1; height: 5px; background: #f3f4f6; border-radius: 99px; overflow: hidden; }
    .breakdown-bar-fill { height: 100%; background: #6366f1; border-radius: 99px; }
    .breakdown-count { font-size: 11px; color: #6b7280; min-width: 18px; text-align: right; }

    /* ── Section heading ───────────────────────────────── */
    .section-head {
      display: flex; align-items: center; gap: 10px;
      padding: 11px 14px;
      background: #f9fafb;
      border-radius: 10px;
      border: 1px solid #f3f4f6;
      margin-bottom: 10px;
      page-break-inside: avoid;
    }
    .section-num { font-family: 'DM Mono', monospace; font-size: 11px; color: #9ca3af; min-width: 22px; }
    .section-title { font-size: 13px; font-weight: 500; flex: 1; }
    .section-count {
      font-size: 11px; color: #6b7280;
      background: #fff; border: 1px solid #e5e7eb;
      border-radius: 99px; padding: 2px 10px;
    }
    .section-body { display: flex; flex-direction: column; gap: 8px; }
    .empty { color: #9ca3af; font-size: 12px; padding: 8px 2px; }

    /* ── Issue card ────────────────────────────────────── */
    .issue {
      border: 1px solid #f3f4f6;
      border-radius: 10px;
      padding: 13px 15px;
      page-break-inside: avoid;
      background: #fff;
    }
    .issue-top { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 6px; }
    .sev-pill {
      font-size: 10px; font-weight: 500;
      padding: 2px 9px; border-radius: 99px;
      text-transform: uppercase; letter-spacing: 0.04em;
      white-space: nowrap; flex-shrink: 0; margin-top: 2px;
    }
    .issue-title { font-size: 13px; font-weight: 500; line-height: 1.4; color: #111827; }
    .issue-meta {
      font-family: 'DM Mono', monospace;
      font-size: 11px; color: #9ca3af;
      margin-bottom: 6px; word-break: break-all;
    }
    .issue-desc { font-size: 12px; color: #4b5563; margin-bottom: 8px; }
    .issue-rows { display: flex; flex-direction: column; gap: 5px; }
    .issue-tag {
      font-size: 11px; color: #4b5563;
      background: #f9fafb;
      border: 1px solid #f3f4f6;
      border-radius: 7px;
      padding: 4px 10px;
    }
    .issue-tag strong { color: #111827; font-weight: 500; }

    /* ── Footer ────────────────────────────────────────── */
    .report-footer {
      margin-top: 28px; padding: 16px;
      background: #f9fafb;
      border-radius: 10px;
      border: 1px solid #f3f4f6;
    }
    .report-footer p { margin: 0 0 4px; font-size: 12px; color: #6b7280; }
  </style>
  </head>
  <body>

  <!-- ── Cover ───────────────────────────────────────────────── -->
  <div class="page">
    <div class="cover">
      <div class="cover-ring-1"></div>
      <div class="cover-ring-2"></div>
      <div class="logo-row">
        <div class="logo-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
          </svg>
        </div>
        <div class="logo-text">QAlaunch</div>
      </div>
      <div class="cover-title">Website Audit Report</div>
      <div class="cover-url">${escapeHtml(scan.url)}</div>
      <div class="cover-meta">
        <div class="cover-meta-item">Generated<span>${new Date(generatedAt).toUTCString()}</span></div>
        <div class="cover-meta-item">Pages scanned<span>${pages.length}</span></div>
        <div class="cover-meta-item">Total issues<span>${issues.length}</span></div>
      </div>
      <div class="score-badge">
        <div class="score-ring">
          <svg width="76" height="76" viewBox="0 0 76 76">
            <circle cx="38" cy="38" r="28" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="7"/>
            <circle cx="38" cy="38" r="28" fill="none"
              stroke="${ringColor}" stroke-width="7"
              stroke-dasharray="${RING_CIRCUMFERENCE}"
              stroke-dashoffset="${offset}"
              stroke-linecap="round"/>
          </svg>
          <div class="score-val">${score}</div>
        </div>
        <div class="score-lbl">Health score</div>
      </div>
    </div>
  </div>

  <!-- ── Executive summary ────────────────────────────────────── -->
  <div class="page">
    <div class="section-label">Severity breakdown</div>
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-num">${issues.length}</div>
        <div class="stat-lbl">Total issues</div>
      </div>
      <div class="stat-card">
        <div class="stat-num" style="color:#dc2626;">${severityCounts.critical}</div>
        <div class="stat-lbl">Critical</div>
      </div>
      <div class="stat-card">
        <div class="stat-num" style="color:#ea580c;">${severityCounts.high}</div>
        <div class="stat-lbl">High</div>
      </div>
      <div class="stat-card">
        <div class="stat-num" style="color:#ca8a04;">${severityCounts.medium + severityCounts.low}</div>
        <div class="stat-lbl">Med / Low</div>
      </div>
    </div>

    <div class="section-label" style="margin-top:24px;">Issues by category</div>
    ${breakdownHtml}
  </div>

  <!-- ── Issue sections ───────────────────────────────────────── -->
  ${sectionsHtml}

  <!-- ── Closing page ─────────────────────────────────────────── -->
  <div class="page">
    <div class="section-label">What&rsquo;s working well</div>
    <ul style="font-size:12px;color:#4b5563;line-height:1.8;margin:0 0 0 18px;padding:0;">
      <li>Core website flows are accessible without private authentication pages.</li>
      <li>Automated crawl, PageSpeed, and accessibility baselines were collected successfully.</li>
      <li>Issues are prioritized by business impact and implementation urgency.</li>
    </ul>
    <div class="report-footer">
      <p>Need help fixing these issues? Share this report with your development team.</p>
      <p>Contact: <strong style="color:#374151;">support@qalaunch.com</strong></p>
    </div>
  </div>

  </body>
  </html>`;
}
