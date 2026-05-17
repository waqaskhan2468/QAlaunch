# Scanner roadmap plan (implement only when you approve each phase)

This document is the **single source of truth** for what to build next. **Do not merge code** for a phase until you explicitly say to apply that phase (e.g. “apply Phase 2”).

---

## Principles

- **Collect in `web/lib/scan/`** (Browserbase + Playwright, buffers, Sharp): interaction probes, CLS, screenshots, compression, optional overlays.
- **Present + Claude in `web/`**: prompts (full Playwright JSON + axe + heuristics), fixed **desktop + one mobile** image per request, issues insert, PDF/HTML report, dashboard UI.
- **`playwright_data`** (JSON on `scan_pages`): extend with new keys unless you need SQL queries—then add columns or a child table.

---

## Phase A — Mobile screenshot mode (product choice)

**Goal:** Decide how mobile is stored and sent to Claude.

| Option | Behavior | Pros | Cons |
|--------|-----------|------|------|
| **A1 — Slices (current)** | `takeMobileSlices` → several ≤844px images | Better detail for vision APIs on tall pages | More uploads, more URLs |
| **A2 — Single full-page** | `takeScreenshot` with `fullPage: true` on mobile, no `slices` | One “true” full-page PNG, simpler mental model | Very tall pages may be downscaled heavily in vision |

**Implementation (when you say “apply Phase A2”):**

1. `web/lib/scan/services/responsive.ts` — mobile branch: call `takeScreenshot` instead of `takeMobileSlices`; return `sliceCount: 1`, omit `slices` (upload path already treats missing slices as `[item.screenshot]`).
2. `web/lib/scan/types/scan.types.ts` — adjust JSDoc on `slices` / `sliceCount` if A2 is permanent.
3. `web/lib/scan/runScannerForScan.ts` — JSDoc only unless upload naming must change.
4. `web/lib/scan/ai/runAiAnalysisForScan.ts` — already sends **one** mobile URL to Claude (first slice or `screenshot_mobile_url`).

**No DB migration** for A2 if URLs stay in existing columns.

---

## Phase B — Report + UI for existing programmatic data

**Goal:** Surface `domHeuristics`, `brokenStates`, `programmaticRollup` in the product (not only inside Claude’s prompt).

**Implementation (when you say “apply Phase B”):**

1. `web/lib/report/renderReportHtml.tsx` (and types in `report.types`) — new sections / cards per finding category.
2. Any **audit / result** React page that reads `scan_pages` — list programmatic issues with severity.
3. Optional: link each finding to desktop/mobile screenshot (scroll region is future work).

**No DB migration** if data is already in `playwright_data`.

---

## Phase C — Claude policy (cost / quality) — **deferred**

**Current product choice:** every analysis uses the **full structured prompt** plus exactly **two** images (desktop + one mobile). No text-only, light, or auto tiers in code.

**If you later want tiered vision again:** reintroduce a small resolver (rollup + axe + env) and optional text-only API shape in `claude.ts`.

---

## Phase D — VPS: interaction testing (flagged)

**Goal:** Clicks / tab / limited form probes; results in `playwright_data.interaction`.

**Implementation (when you say “apply Phase D”):**

1. New `web/lib/scan/services/interaction.ts` — caps, blocklist, same-origin rules, console capture window.
2. `web/lib/scan/services/index.ts` — run after screenshots **or** second navigation (document chosen order).
3. Types + `buildPlaywrightPayload` + Phase B/C consumers.

**No DB migration** if nested in JSON.

---

## Phase E — VPS: CLS + culprits

**Goal:** `addInitScript` + `PerformanceObserver` (`layout-shift`); read buffer after load; store in `playwright_data.layoutShifts` (name TBD).

**Implementation (when you say “apply Phase E”):**

1. Register observer before first navigation to that URL in the mobile/desktop session where you care (often same as responsive capture or main page).
2. Serialize entries with `sources` when present.
3. Web: prompt + report section.

---

## Phase F — VPS: Sharp overlays + optional pixel diff

**Goal:** Optional annotated PNG; optional compare to previous run.

**Implementation (when you say “apply Phase F”):**

1. Overlays: after capture, `sharp` composite SVG rects from finding `rect`s → upload second object or replace (product choice).
2. Diff: needs **baseline** stored (Supabase row or Storage); worker compares hashes or pixels — new table or JSON history recommended for “last run fingerprint.”

**May need:** new Storage paths; optional **new columns** for `screenshot_desktop_annotated_url` or diff URL.

---

## Suggested order

1. **B** — users see value from data you already collect.  
2. **A** — only if you revisit A1 vs A2 (mobile capture shape).  
3. **D → E** — deeper QA.  
4. **F** — polish / regression.  
5. **C** — optional later if you want tiered / text-only Claude again.

---

## Status (implementation log)

- **Phase A2** — Mobile uses a single full-page PNG (`responsive.ts`); `takeMobileSlices` kept in `screenshots.ts` for optional reuse.
- **Phase B** — PDF report includes an “Automated layout & state checks” section from `playwright_data` (`renderReportHtml` + `generateAndStorePdfReport` select).
- **Phase C** — Deferred. Claude path: `analyzeWithClaude` always attaches desktop + one mobile signed URL; `runAiAnalysisForScan` builds the full text prompt (no vision modes).

---

## How to proceed (remaining phases)

Reply to apply **D** (interaction), **E** (CLS), or **F** (overlays / diff), e.g. **“apply Phase D”**.

