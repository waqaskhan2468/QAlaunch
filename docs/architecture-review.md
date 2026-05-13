# QAlaunch — Architecture Review
**Date:** May 12, 2026  
**Source:** QAlaunch_Review.pdf (external consultant report) vs current codebase

---

## What You Built

A two-service monorepo:

| Service | Purpose |
|---------|---------|
| `web/` | Next.js marketing site + scan pipeline (Inngest) on Vercel |
| `vps/` | Express + Playwright scanner running in Docker |

**Core flow:**  
User submits URL → `POST /api/scan/start` → Inngest event → `run-scan` function → VPS runs Playwright + axe-core + Claude → PDF generated → results served at `/result?scanId=...`

---

## Area-by-Area: Report vs Your Code

### 1. Browser Automation

| | Report Says | Your Code | Status |
|---|---|---|---|
| Tool | Playwright | Playwright + Puppeteer (VPS) | ✅ |
| Runtime | Browserbase / Browserless (managed cloud) | Self-hosted Docker VPS | ⚠️ |
| Not on Vercel | Required | Correct — VPS is separate | ✅ |

**Notes:**  
Playwright choice is correct. However, running it on a self-hosted VPS creates problems at scale:
- Memory exhaustion under concurrent scans
- Cold start latency
- Your time spent on infrastructure maintenance instead of product

---

### 2. Visual & UI Analysis

| | Report Says | Your Code | Status |
|---|---|---|---|
| Deterministic checks (contrast, alt text, labels) | axe-core | `@axe-core/playwright` in VPS | ✅ |
| Subjective checks (layout, spacing, overflow) | Gemini (vision LLM) | Anthropic Claude | ✅ |

**Notes:**  
The report recommends Gemini for vision analysis on page 2, but then recommends Claude for the full tech stack on page 4. These contradict each other. Claude is the better choice — it handles both classification and vision in one API, with better instruction-following for structured JSON output.

---

### 3. PDF Generation

| | Report Says | Your Code | Status |
|---|---|---|---|
| Method | Puppeteer `page.pdf()` | Puppeteer installed, `generateAndStorePdfReport` exists | ✅ |

**Notes:**  
Correct approach. You already have a browser session running — using that same session for PDF generation avoids an extra service. Build the report as a real HTML page with a print route, then render it to PDF.

---

### 4. Background Jobs / Scan Pipeline

| | Report Says | Your Code | Status |
|---|---|---|---|
| Recommended | Inngest or Trigger.dev | **Inngest** (in use) | ✅ |

**Notes:**  
Inngest is in use for the scan pipeline. Operational tuning still applies at scale:
- Inngest gives a **visual dashboard** showing every scan step and failure
- Inngest supports **per-step retries** — a failed AI call does not restart the whole scan
- Inngest maps naturally to progress events you can stream to the user's status page

---

### 5. Payments

| | Report Says | Your Code | Status |
|---|---|---|---|
| Recommended | Stripe or Lemon Squeezy | Paddle | ✅ (better choice) |

**Notes:**  
The report was written for a general audience. For a Pakistani SaaS founder specifically, Paddle is the correct choice:

- **Stripe is not available in Pakistan** — requires a US LLC, US bank account, and EIN
- **Paddle is a Merchant of Record** — you sign up as a supplier, Paddle handles all tax/VAT globally, and pays you via wire or Payoneer
- No foreign entity required to get started

If QAlaunch grows to enterprise sales (custom invoicing, annual contracts), forming a US LLC + Stripe makes sense then. That is a future problem.

---

### 6. File Storage

| | Report Says | Your Code | Status |
|---|---|---|---|
| Recommended | Cloudflare R2 (no egress fees) | Supabase Storage | ⚠️ |

**Notes:**  
Supabase Storage works fine for MVP. At scale, R2 becomes significantly cheaper because it has no egress fees — every PDF download from Supabase incurs a small charge, R2 does not. Migration is straightforward when volume grows.

---

### 7. AI

| | Report Says | Your Code | Status |
|---|---|---|---|
| Recommended | Claude | Anthropic Claude | ✅ |

---

### 8. Email

| | Report Says | Your Code | Status |
|---|---|---|---|
| Recommended | Resend | Resend (in scan pipeline) | ✅ |

---

### 9. Accessibility

| | Report Says | Your Code | Status |
|---|---|---|---|
| Recommended | axe-core | `@axe-core/playwright` | ✅ |

---

### 10. Performance Checks

| | Report Says | Your Code | Status |
|---|---|---|---|
| Recommended | Google PageSpeed Insights API | PageSpeed in scan pipeline | ✅ |

---

## Long-Term Recommendations (Priority Order)

---

### Priority 1 — Move to Managed Cloud Browser

**When:** Before production launch  
**Migration:** Browserbase or Browserless → connect via Playwright CDP

Replace the self-hosted Docker VPS browser with a managed provider.

**Why it matters:**
- Your VPS has fixed memory — 3 concurrent scans can crash it
- Browserbase spins up isolated browsers on demand
- You pay per browser-minute (~$0.10–$0.20/min) instead of paying for idle VPS capacity
- Zero infrastructure maintenance

**Estimated cost at 10 scans/day × 5 minutes each:**  
~$5–10/day ($150–$300/month). Reasonable once you have paying customers.

Your VPS can still handle the Express routing, axe-core, and sharp — just offload the browser to the cloud.

---

### Priority 2 — Inngest for background jobs

**Status:** Implemented — scan pipeline runs as an Inngest function (`run-scan`) served at `/api/inngest`.

**When:** Before 50+ scans/day (operational tuning still applies)

**Why it matters:**
- Every scan step becomes visible in the Inngest dashboard
- Failed AI calls retry at the step level — no full scan restart
- Step events map directly to progress UI for users
- Much easier to debug customer complaints ("my scan is stuck")

---

### Priority 3 — Cloudflare R2 for PDF Storage

**When:** When PDF download volume grows  
**Migration:** Replace Supabase Storage bucket calls with R2 SDK

**Why it matters:**  
Supabase Storage charges egress. R2 has zero egress fees. For a product where every scan produces a PDF that customers download repeatedly, this compounds quickly.

---

### Priority 4 — Write Tests

**When:** Now  
**Tool:** Vitest (already installed, zero tests written)

Minimum test coverage needed:
- `api/scan/start` — URL validation, free preview limit enforcement
- Inngest `run-scan` — pipeline step ordering
- Webhook handler — Paddle signature verification, idempotency
- `computeHealthScore` — scoring logic

---

### Priority 5 — Add CI/CD

**When:** Before inviting beta users  
**Tool:** GitHub Actions

Minimum pipeline:
```yaml
- pnpm install
- pnpm type-check
- pnpm lint
- pnpm test
```

Prevents broken TypeScript and failed deploys from reaching users.

---

## Final Summary Table

| Area | Matches Report | Long-Term Action |
|------|---------------|-----------------|
| Playwright (tool) | ✅ Matched | Keep |
| Cloud browser | ❌ Self-hosted VPS | Migrate to Browserbase — Priority 1 |
| axe-core accessibility | ✅ Matched | Keep |
| Claude AI | ✅ Matched | Keep |
| Puppeteer PDF | ✅ Matched | Keep |
| Upstash Workflow | N/A | Replaced by Inngest |
| Paddle payments | ✅ Better for Pakistan | Keep |
| Supabase Storage | ⚠️ Different | Migrate to R2 — Priority 3 |
| Resend email | ✅ Matched | Keep |
| PageSpeed API | ✅ Matched | Keep |
| Tests | ❌ None | Write them — Priority 4 |
| CI/CD | ❌ None | Add GitHub Actions — Priority 5 |

---

## Realistic Scan Timing (from Report)

| Step | Time |
|------|------|
| Page load | 3–8s |
| Screenshots (desktop + mobile) | 3–5s |
| axe-core run | 1–2s |
| PageSpeed Insights / Lighthouse | 10–20s |
| Vision LLM analysis (Claude) | 5–15s |
| Functional checks (links, forms) | 10–30s |
| **Per-page total** | **45–90s** |

| Package | Pages | Estimated Time |
|---------|-------|---------------|
| Basic | 1 page | 1–2 minutes |
| Standard | 5 pages (parallel) | 4–7 minutes |
| Premium | 10 pages (parallel) | 6–12 minutes |
| + PDF and email | — | +30–60 seconds |

**Key UX implication:** Most paid scans exceed 5 minutes. Email delivery is the right model — do not keep users on a spinner. Show a status page with step progress, send a "scan started" email immediately, and a "report ready" email when done.

---

## Recommended Tech Stack (Final)

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend / API | Next.js on Vercel | ✅ In use |
| Auth + DB | Supabase (Postgres + Storage) | ✅ In use |
| Payments | Paddle | ✅ In use — correct for Pakistan |
| Email | Resend | ✅ In use |
| File storage | Supabase Storage → R2 | Migrate later |
| Background jobs | Inngest (`run-scan`) | Tune retries / concurrency at scale |
| Browsers | Self-hosted VPS → Browserbase | Migrate before launch |
| AI | Anthropic Claude | ✅ In use |
| Accessibility | axe-core via Playwright | ✅ In use |
| Performance | Google PageSpeed Insights API | ✅ In use |
| PDF | Puppeteer `page.pdf()` | ✅ In use |
| Screenshots | Playwright + SVG overlay (sharp) | ✅ In use |
