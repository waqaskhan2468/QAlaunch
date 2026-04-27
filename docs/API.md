# QA Launch — HTTP API reference

This document describes the **Next.js App Router** routes under `web/app/api`, the **Express scanner** service under `vps`, and how they touch **Supabase**. Use it for integration, debugging, and onboarding.

---

## Base URLs

| Environment | Next.js app | Scanner (VPS) |
|-------------|-------------|-----------------|
| Local | `http://localhost:3000` | `http://localhost:3000` (default `PORT`) — **change one port** if both run on the same machine |
| Production | Your deployed origin (e.g. `https://app.example.com`) | `SCAN_SERVICE_URL` (no path suffix) |

All Next routes below are rooted at the app origin, e.g. `POST https://<origin>/api/scan/start`.

---

## End-to-end flow

```mermaid
sequenceDiagram
  participant Client
  participant Next as Next.js API
  participant DB as Supabase
  participant VPS as Scanner VPS

  Client->>Next: POST /api/scan/start
  Next->>DB: insert scans
  Next->>Next: POST /api/scan/process
  Next->>DB: update scans, upsert scan_pages
  Next->>VPS: POST /scan (Bearer)
  VPS->>DB: update scans, scan_pages
  Client->>Next: GET /api/scan/status/:scanId
  Next->>DB: select scans, scan_pages, issues
```

**Paid path:** Paddle → `POST /api/webhooks/paddle` → updates `scans` → queues work that eventually hits `/api/scan/process` (see [Webhooks](#post-apiwebhookspaddle)).

---

## Error response shapes

Two patterns exist in the codebase:

### A. `AppError` (used by `asyncHandler` on `/api/scan/start` and `/api/scan/process`)

JSON body:

```json
{
  "ok": false,
  "code": "machine_readable_code",
  "message": "Human-readable message.",
  "details": null
}
```

`details` may contain validation output (e.g. Zod `flatten()`) for `invalid_request`.

### B. Legacy / minimal

- **`GET /api/scan/status/[scanId]`** — `{ "error": "not_found" }` or `{ "error": "<message>" }`
- **`POST /api/webhooks/paddle`** — `401` returns plain text `Invalid signature`; some errors use `{ "error": "..." }`

---

## Next.js routes

### `POST /api/scan/start`

Starts a scan: validates input, creates a `scans` row, then triggers processing (see **Implementation note**).

| | |
|--|--|
| **Auth** | None (public). |
| **Content-Type** | `application/json` |

#### Request body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `url` | string | yes | Site URL (non-empty). Normalized server-side. |
| `package` | string | yes | One of: `free`, `basic`, `standard`, `premium`, `enterprise`. |
| `email` | string | no | Valid email, or omit / empty string. |

#### Example request

```http
POST /api/scan/start HTTP/1.1
Host: localhost:3000
Content-Type: application/json

{
  "url": "https://example.com",
  "package": "free",
  "email": "user@example.com"
}
```

```bash
curl -sS -X POST "$ORIGIN/api/scan/start" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","package":"free","email":"user@example.com"}'
```

#### Success response — `201 Created`

```json
{
  "ok": true,
  "scanId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "pending",
  "message": "Scan started successfully."
}
```

#### Database effects

| Table | Action |
|-------|--------|
| `scans` | **INSERT** one row: `url`, `url_hash`, `package`, `status: "pending"`, `user_email`, `payment_status` (`"free"` if package is free else `"pending"`), `free_preview_used: false`. |

**Does not** write `scan_pages` or `issues` — that happens in `/api/scan/process` and downstream services.

**Free tier:** Before insert, if `package === "free"`, the API checks for an existing free scan for the same `url_hash` with `free_preview_used === true`. If found, **no new row** is inserted.

#### Error responses (selection)

| HTTP | Body (shape) | When |
|------|----------------|------|
| 400 | `AppError` — `code: "invalid_request"` | Zod validation failed |
| 400 | `AppError` — `code: "private_url_not_allowed"` | URL blocked as private/local |
| 409 | `{ "ok": false, "code": "free_preview_used", "message": "..." }` | Free preview already used for this site |
| 500 | `AppError` — e.g. `free_check_failed`, `scan_create_failed` | Database or server errors |

#### Implementation note (operators)

After insert, the handler calls **`POST http://localhost:3000/api/scan/process`** with a fixed host. That matches **local dev** where the Next app listens on port 3000. For **staging/production**, this URL must be aligned with your deployment (env-based base URL), or processing will not run from this path alone.

---

### `POST /api/scan/process`

Orchestration: marks crawl state, fetches homepage HTML, detects site type, selects pages, persists `scan_pages`, then calls the remote scanner.

| | |
|--|--|
| **Auth** | **None in code** — treat as internal; protect at the edge in production. |
| **Content-Type** | `application/json` |

#### Request body

| Field | Type | Required |
|-------|------|----------|
| `scanId` | string (UUID) | yes |
| `targetUrl` | string | yes |
| `package` | same enum as start | yes |
| `userEmail` | string \| null | no |

#### Example request

```http
POST /api/scan/process HTTP/1.1
Host: localhost:3000
Content-Type: application/json

{
  "scanId": "550e8400-e29b-41d4-a716-446655440000",
  "targetUrl": "https://example.com",
  "package": "standard"
}
```

#### Success response — `200 OK`

```json
{
  "ok": true,
  "scanId": "550e8400-e29b-41d4-a716-446655440000",
  "websiteType": "business",
  "requiresAuth": false,
  "pagesToTest": [
    "https://example.com/",
    "https://example.com/contact"
  ],
  "selectedPages": [
    { "url": "https://example.com/", "role": "home" },
    { "url": "https://example.com/contact", "role": "contact" }
  ]
}
```

If authentication is detected on the site, optional `auth` may appear:

```json
{
  "ok": true,
  "scanId": "...",
  "websiteType": "saas",
  "requiresAuth": true,
  "pagesToTest": ["..."],
  "selectedPages": [],
  "auth": {
    "notes": "...",
    "banner": "...",
    "contactUrl": "..."
  }
}
```

#### Database effects

| Table | Action |
|-------|--------|
| `scans` | **UPDATE** — `status` set to `crawling`, `error_message` cleared; then **UPDATE** with `website_type`, `pages_to_test`, etc. |
| `scan_pages` | **UPSERT** rows per selected page (`scan_id`, `page_url`, `page_role`; conflict on `scan_id,page_url`). |

Then the handler issues an outbound HTTP request (see Scanner service).

#### Error responses (selection)

| HTTP | `code` (AppError) | When |
|------|-------------------|------|
| 400 | `missing_scan_id`, `missing_target_url`, `missing_package` | Validation |
| 422 | `no_testable_pages` | No pages selected |
| 500 | `config_missing` | `SCAN_SERVICE_URL` or `SCAN_API_TOKEN` unset |
| 500 | `scan_status_update_failed`, `scan_update_failed`, `scan_pages_prepare_failed` | Supabase errors |
| 502 | `homepage_fetch_failed` | Could not fetch homepage HTML |
| 503 | `scanner_unreachable` | Outbound fetch to scanner failed / timeout (15 minutes) |

#### Downstream call

```http
POST ${SCAN_SERVICE_URL}/scan
Authorization: Bearer ${SCAN_API_TOKEN}
Content-Type: application/json

{ "scanId": "<same>", "urls": ["..."] }
```

---

### `GET /api/scan/status/[scanId]`

Returns the scan row, related pages, and issues for polling or UI.

| | |
|--|--|
| **Auth** | None in route — locking down who can read which `scanId` is an application concern. |

#### Example request

```http
GET /api/scan/status/550e8400-e29b-41d4-a716-446655440000 HTTP/1.1
Host: localhost:3000
```

```bash
curl -sS "$ORIGIN/api/scan/status/550e8400-e29b-41d4-a716-446655440000"
```

#### Success response — `200 OK`

```json
{
  "scan": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "url": "https://example.com",
    "status": "done",
    "package": "standard",
    "website_type": "business",
    "pages_to_test": ["https://example.com/"],
    "error_message": null,
    "completed_at": "2026-04-28T12:00:00.000Z"
  },
  "pages": [
    {
      "scan_id": "550e8400-e29b-41d4-a716-446655440000",
      "page_url": "https://example.com/",
      "page_role": "home",
      "screenshot_desktop_url": "https://...",
      "screenshot_mobile_url": "https://..."
    }
  ],
  "issues": []
}
```

Exact column set matches your Supabase schema (`select *`). Issues are ordered by `severity` descending, then `display_order` ascending.

#### Database effects

**Read-only** — `SELECT` on `scans`, `scan_pages`, `issues`.

#### Error responses

| HTTP | Body |
|------|------|
| 404 | `{ "error": "not_found" }` |
| 500 | `{ "error": "<Supabase message>" }` if the issues query fails |

---

### `POST /api/webhooks/paddle`

Handles Paddle server notifications after payment.

| | |
|--|--|
| **Auth** | Webhook signature: header **`paddle-signature`** + raw body verification. |
| **Content-Type** | Raw body (JSON string); use the **exact** bytes Paddle sent for signature verification. |

#### Example request (illustrative)

```http
POST /api/webhooks/paddle HTTP/1.1
Host: localhost:3000
Content-Type: application/json
paddle-signature: <signature>

{"event_type":"transaction.completed","data":{"id":"txn_...","custom_data":{"scanId":"...","package":"basic","targetUrl":"https://example.com","userEmail":"user@example.com"}}}
```

#### Success response — `200 OK`

```json
{ "ok": true }
```

Non-Paddle callers should not invoke this endpoint without a valid signature.

#### Handled events

- **`transaction.completed`** — Requires `event.data.custom_data`: `scanId`, `targetUrl`, `package` (and optionally `userEmail`). Updates the scan and queues processing via `queueScanJob` (see `web/lib/api/qstash.ts`). In development, that may call `/api/scan/process` directly; production behavior depends on QStash configuration.

#### Database effects (on `transaction.completed`)

| Table | Action |
|-------|--------|
| `scans` | **UPDATE** — `package`, `payment_id`, `payment_status: "paid"`, `status: "pending"` |

#### Error responses

| HTTP | Body |
|------|------|
| 401 | Plain text: `Invalid signature` |
| 400 | `{ "error": "missing_custom_data" }` if required custom data is missing |

---

## Scanner service (Express, `vps`)

Mounted under **`/scan`** with JSON body parsing. Global error middleware runs last.

### `GET /health`

**Auth:** none.

#### Example

If `SCAN_SERVICE_URL` is `https://scanner.example.com` (no path), the health endpoint is **`GET https://scanner.example.com/health`** — same origin as `/scan`, different path.

```bash
# Replace with your scanner origin (scheme + host + port)
curl -sS "https://scanner.example.com/health"
```

#### Response — `200 OK`

```json
{
  "status": "ok",
  "ts": "2026-04-28T12:00:00.000Z"
}
```

---

### `POST /scan`

Runs the Playwright pipeline for the given URLs.

| | |
|--|--|
| **Auth** | `Authorization: Bearer <SCAN_API_TOKEN>` |

#### Request body

```json
{
  "scanId": "550e8400-e29b-41d4-a716-446655440000",
  "urls": [
    "https://example.com/",
    "https://example.com/contact"
  ]
}
```

| Field | Required |
|-------|----------|
| `scanId` | yes (non-empty string) |
| `urls` | yes (non-empty array of strings) |

#### Example

```bash
curl -sS -X POST "$SCAN_SERVICE_URL/scan" \
  -H "Authorization: Bearer $SCAN_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"scanId":"550e8400-e29b-41d4-a716-446655440000","urls":["https://example.com/"]}'
```

#### Success response — `200 OK`

```json
{
  "success": true,
  "scanId": "550e8400-e29b-41d4-a716-446655440000",
  "finalStatus": "done",
  "processedPages": 2
}
```

`finalStatus` is `done` if at least one page succeeded, otherwise `failed`.

#### Database & storage effects (scanner)

| Store | Action |
|-------|--------|
| `scans` | **UPDATE** — e.g. `status: analyzing` during run; then `done` or `failed`, `completed_at`, optional `error_message` |
| `scan_pages` | **UPDATE** per URL — screenshots URLs, `axe_violations`, `playwright_data`, etc. |
| Supabase Storage | Screenshot uploads (bucket from env, default `scan-screenshots`) |

#### Auth errors

| HTTP | Body |
|------|------|
| 401 | `{ "error": "Missing Authorization header" }` or `{ "error": "Invalid Authorization format" }` |
| 403 | `{ "error": "Invalid token" }` |
| 500 | `{ "error": "SCAN_API_TOKEN not configured" }` |

---

## Environment variables (quick reference)

| Variable | Used by |
|----------|---------|
| `SCAN_SERVICE_URL`, `SCAN_API_TOKEN` | Next `/api/scan/process` → calls VPS |
| `SCAN_API_TOKEN` | VPS `POST /scan` — must match token sent by Next |
| `SUPABASE_*` / service role | Next and VPS DB access |
| `NEXT_PUBLIC_APP_URL` | QStash / dev queue calling `/api/scan/process` |
| `QSTASH_TOKEN`, `QSTASH_*` signing keys | Queue and verification helpers |
| Paddle webhook secrets | `verifyPaddleWebhook` |

---

## Security checklist for production

1. **Protect `/api/scan/process`** — internal secret, firewall, or queue-only invocation.
2. **Replace hardcoded `localhost`** in `scan/start` with a configurable app URL for non-local deployments.
3. **Rotate `SCAN_API_TOKEN`** and align Next + VPS.
4. **Webhook:** keep Paddle signing secret server-side only; verify raw body.

---

## Changelog

Document changes to request/response shapes or DB behavior here when you ship API updates.
