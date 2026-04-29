# QA Launch API

This document explains the scan API in simple English.

The scan starts in the Next.js app, is queued with QStash, then is processed by the VPS scanner. Data is saved in Supabase.

## Scan Flow

1. The browser calls `POST /api/scan/start`.
2. The start route creates a `scans` row in Supabase.
3. The start route sends a job to QStash.
4. QStash calls `POST /api/scan/process`.
5. The process route chooses the pages to test.
6. The process route runs PageSpeed Insights for each selected page.
7. The process route calls the VPS scanner.
8. The VPS scanner runs Playwright and saves the final page data.

## Start A Scan

Endpoint:

```http
POST /api/scan/start
Content-Type: application/json
```

Request body:

```json
{
  "url": "https://supabase.com/",
  "email": "haseebsajjad@gmail.com",
  "package": "premium"
}
```

What this route does:

- Checks that the request body is valid.
- Normalizes the URL.
- Blocks private and local URLs.
- Creates one row in the `scans` table.
- Sets the scan status to `pending`.
- Sends a QStash job to `/api/scan/process`.

Response (`201 Created` on success):

```json
{
  "ok": true,
  "scanId": "b699aa99-0e61-4ee7-ba3f-00e461e30566",
  "status": "pending",
  "message": "Scan started successfully."
}
```

Why the response is `pending`:

- `POST /api/scan/start` only creates the scan row and queues work.
- The long work runs asynchronously through QStash and the VPS scanner.
- Use `scanId` with the status endpoint to read final `done` or `failed` state.

Free package rule:

- A free scan can only be used once for the same website.
- If the free preview was already used, the route returns `409`.

Paid package rule:

- Paid scans start with `payment_status = pending`.
- After Paddle confirms payment, the webhook can queue the scan again with QStash.

## QStash Job

The app uses QStash so the scan does not depend on one long browser request.

The queued job calls:

```http
POST /api/scan/process
```

QStash sends this body:

```json
{
  "scanId": "1423ace4-bb8b-4d33-836d-bc60a5aeb415",
  "targetUrl": "https://supabase.com",
  "package": "premium",
  "userEmail": "user@example.com"
}
```

The process route uses `verifySignatureAppRouter` from `@upstash/qstash/nextjs`. This means normal users should not call `/api/scan/process` directly. QStash must sign the request.

Required QStash environment variables:

- `QSTASH_TOKEN`
- `QSTASH_CURRENT_SIGNING_KEY`
- `QSTASH_NEXT_SIGNING_KEY`
- `NEXT_PUBLIC_APP_URL`

## Process A Scan

Endpoint:

```http
POST /api/scan/process
Content-Type: application/json
```

This endpoint is called by QStash.

What this route does:

- Marks the scan as `crawling`.
- Fetches the homepage HTML.
- Detects the website type.
- Selects public pages to test.
- Saves the selected page URLs in `scans.pages_to_test`.
- Creates or updates one `scan_pages` row for each selected page.
- Runs PageSpeed Insights for each selected page.
- Calls the VPS scanner with the selected URLs.

If no public pages are found, the route returns `422`.

## Website Type Detection

The process route fetches the homepage HTML and passes it to `detectWebsiteType`.
The detector parses the HTML with Cheerio and normalizes:

- Full HTML.
- `nav` and `header` text.
- `body` text.
- Page title.

It then checks website type signals in this order:

1. `ecommerce`
  - Cart or checkout links.
  - Cart forms.
  - Buy buttons such as `add to cart`, `buy now`, or `checkout`.
  - Shopify, WooCommerce, or product metadata.
  - Shop, cart, or checkout navigation text.
2. `saas`
  - Navigation text such as pricing, features, solutions, login, sign in, sign up, get started, or start for free.
  - Page text such as free trial, per month, per seat, per user, subscription, dashboard, or `/month`.
  - Hostnames that start with `app.`.
3. `business`
  - Navigation text such as services, about, contact, or what we do.
  - Page text such as get a quote, book a call, book a demo, or request a quote.
  - Any form on the page.
4. `blog`
  - Article elements.
  - RSS markup.
  - Recent posts text.
  - Article schema markup.
  - Blog URLs in the HTML.
5. `portfolio`
  - Navigation text such as portfolio, work, projects, or case studies.
  - Page text such as case studies, our team, or selected work.
6. `landing`
  - Small navigation with many hash links.
  - No navigation with several hash links.
  - Repeated CTA text such as get started, book demo, start free trial, or contact us.

If none of these signals match, the detector returns `unknown`.

The first matching type is saved in `scans.website_type`.

The same detector also checks whether the site appears to have authentication. It looks for auth subdomains, auth paths, password fields, login or signup links/forms, auth-related text, dashboard/workspace signals, and auth-related meta tags.

For now, auth detection only sets `requiresAuth` and logs the auth note, banner, and contact URL in the process route. It does not stop or change the public page scan. If this needs to be stored later, add a database column for the auth detection result and save it with the scan metadata.

## Page Selection

The process route finds links from the homepage.

It keeps only useful public pages:

- Same website only.
- No hash-only links.
- No private pages like login, signup, dashboard, account, settings, logout, or profile.
- No duplicate URLs.

Each page gets a role. Example roles are:

- `homepage`
- `pricing`
- `features`
- `product`
- `cart`
- `checkout`
- `about`
- `contact`
- `docs`
- `blog`
- `legal`
- `other`

Package limits:

- `free`: 1 page
- `basic`: 1 page
- `standard`: 5 pages
- `premium`: 10 pages
- `enterprise`: no automatic limit from the selector

The homepage is always selected first when at least one page is allowed.

For a SaaS website, important pages like homepage, features, pricing, contact, docs, blog, legal, and about are ranked higher.

Example selected pages for a premium SaaS scan:

```json
[
  "https://supabase.com/",
  "https://supabase.com/solutions/ai-builders",
  "https://supabase.com/pricing",
  "https://supabase.com/contact/sales",
  "https://supabase.com/docs",
  "https://supabase.com/blog",
  "https://supabase.com/security",
  "https://supabase.com/customers",
  "https://supabase.com/state-of-startups",
  "https://supabase.com/solutions/no-code"
]
```

## PageSpeed Insights

After pages are selected, the process route runs PageSpeed Insights for each page.

For each page, it runs:

- Mobile PageSpeed
- Desktop PageSpeed

The PageSpeed request includes these categories:

- Performance
- SEO
- Accessibility
- Best practices

The saved result includes:

- `performance`
- `seo`
- `accessibility`
- `bestPractices`
- `lcpMs`
- `fcpMs`
- `cls`
- `ttiMs`
- Any mobile or desktop strategy error

The result is saved in `scan_pages.page_speed_data`.

If one strategy fails and the other succeeds, the successful result is still saved. If both fail, the error is saved in the PageSpeed data.

Required PageSpeed environment variable:

- `GOOGLE_PAGESPEED_API_KEY`

## VPS Scanner

After PageSpeed data is saved, the process route calls the VPS scanner.

Endpoint:

```http
POST ${SCAN_SERVICE_URL}/scan
Authorization: Bearer ${SCAN_API_TOKEN}
Content-Type: application/json
```

Request body:

```json
{
  "scanId": "1423ace4-bb8b-4d33-836d-bc60a5aeb415",
  "urls": [
    "https://supabase.com/",
    "https://supabase.com/pricing"
  ]
}
```

Required scanner environment variables:

- `SCAN_SERVICE_URL`
- `SCAN_API_TOKEN`

## VPS Scan Work

The VPS scanner uses Playwright.

For each selected page, it collects:

- Raw HTML
- Desktop screenshot
- Mobile screenshot
- Responsive screenshots
- Links and broken links
- Buttons and forms
- SEO data
- Accessibility issues from axe
- Console messages
- Failed requests
- HTTP errors

The scanner opens a fresh browser context for each page. This keeps cookies and page state separate between URLs.

The scanner uses `SCAN_PAGE_CONCURRENCY`. If it is not set, it scans one page at a time.

## Accessibility

Accessibility is checked with `@axe-core/playwright`.

The scanner uses these axe tags:

- `wcag2a`
- `wcag2aa`
- `wcag21aa`

A page is only marked as successful when:

- Navigation works.
- Axe returns a valid list of violations.

If important data is missing, the scanner retries the page once. If data is still missing, it saves warnings in `playwright_data.warnings`.

## Screenshots And Storage

Screenshots are uploaded to Supabase Storage.

The file path uses:

- The `scanId`
- A cleaned version of the page URL
- The screenshot type

The public screenshot URLs are saved in `scan_pages`.

Saved screenshot fields:

- `screenshot_desktop_url`
- `screenshot_mobile_url`
- Responsive screenshot URLs inside `playwright_data.responsive`

## Database Updates

This section explains exactly what changes in Supabase from start to finish.

### 1) `POST /api/scan/start` inserts one parent row in `scans`

Initial values include:

- `status = pending`
- `payment_status = pending` for paid packages (`free` package uses `free`)
- `url`, `url_hash`, `package`, `user_email`
- `free_preview_used = false`

This is why the API immediately returns:

```json
{
  "ok": true,
  "scanId": "b699aa99-0e61-4ee7-ba3f-00e461e30566",
  "status": "pending",
  "message": "Scan started successfully."
}
```

### 2) `POST /api/scan/process` updates the same `scans` row

The process route sets/updates:

- `status = crawling`
- `website_type` (example: `saas`)
- `pages_to_test` (selected public URLs)
- `error_message = null` while processing

### 3) Process route prepares child rows in `scan_pages`

- One row per selected page is upserted (`scan_id + page_url`).
- `page_role` is saved at this step (`homepage`, `pricing`, `docs`, etc.).

### 4) PageSpeed writes into `scan_pages`

- `page_speed_data` is saved for each page (mobile + desktop metrics).

### 5) VPS scanner writes final page artifacts and final status

- Scan status moves to `analyzing`.
- For each page, scanner updates `scan_pages` with:
  - `screenshot_desktop_url`
  - `screenshot_mobile_url`
  - `raw_html`
  - `axe_violations`
  - `playwright_data` (links, forms, responsive screenshots, diagnostics)
- Final `scans.status` becomes:
  - `done` when at least one page succeeds
  - `failed` when all pages fail
- `completed_at` is set when finished.

### `scans` table (parent scan)

Important `scans` fields:

- `id`
- `url`
- `url_hash`
- `package`
- `status`
- `payment_status`
- `user_email`
- `website_type`
- `pages_to_test`
- `error_message`
- `completed_at`

### `scan_pages` table (one row per selected page)

Important `scan_pages` fields:

- `scan_id`
- `page_url`
- `page_role`
- `page_speed_data`
- `screenshot_desktop_url`
- `screenshot_mobile_url`
- `raw_html`
- `axe_violations`
- `playwright_data`

Status flow:

```text
pending -> crawling -> analyzing -> done
```

Failure path:

```text
pending -> crawling/analyzing -> failed
```
