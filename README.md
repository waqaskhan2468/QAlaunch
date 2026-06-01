# QA Launch

Automated website scanning with Next.js, Inngest, Browserbase, and Claude.

---

## Project structure

```bash
qalaunch/
├── web/                # Next.js app (Vercel) + scan pipeline
│   ├── app/
│   ├── lib/scan/       # Playwright collectors + AI (Browserbase)
│   └── package.json
└── README.md
```

---

## How it works

1. User submits a URL from the Next.js app.
2. Inngest runs the `run-scan` pipeline (`web/lib/inngest/functions/run-scan.ts`).
3. **Browserbase** hosts headless Chromium; `web/lib/scan/` collects axe, screenshots, links, SEO, etc.
4. Results are stored in Supabase; Claude analyzes pages; paid plans get a PDF report.

Local dev: run **Next** and the **Inngest dev server** (see `web/.env.example`). No separate VPS service.

---

## Tech stack (`web/`)

- Next.js, Tailwind, Supabase
- Inngest (background jobs)
- Browserbase + `playwright-core` + `@axe-core/playwright`
- Anthropic Claude, Google PageSpeed, Resend, Paddle

---

## Setup

### 1) Clone and install

```bash
git clone https://github.com/yourname/QALaunch.git
cd QALaunch/web
pnpm install
cp .env.example .env.local
# Fill in Supabase, Browserbase, Inngest, Claude, etc.
```

### 2) Run locally

Terminal A:

```bash
pnpm dev
```

Terminal B:

```bash
pnpm dev:inngest
```

App: http://localhost:3000

---

## Deployment (Vercel)

- Root directory: **`web/`**
- Env vars: see `web/.env.example`
- **Inngest (required or scans stay on "Queued"):**
  - `INNGEST_EVENT_KEY` — send events from `/api/scan/start`
  - `INNGEST_SIGNING_KEY` — Inngest Cloud invokes `/api/inngest`
  - `NEXT_PUBLIC_APP_URL` — e.g. `https://getqalaunch.com` (your live domain)
  - Do **not** set `INNGEST_DEV=1` on Vercel
- After deploy: [Inngest dashboard](https://app.inngest.com) → Apps → sync app to `{NEXT_PUBLIC_APP_URL}/api/inngest`
- Vercel **Pro** recommended (`maxDuration` 300s on `/api/inngest` for long scan steps)

---

## Security

- Keep `BROWSERBASE_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` server-only (never `NEXT_PUBLIC_*`)
- Do not commit `.env` / `.env.local`
