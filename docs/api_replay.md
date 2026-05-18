# QAlaunch — API review reply

Plain-language status vs the May 4 review. Based on this codebase.

---

## What is already built

- **Scan pipeline:** Next.js + Inngest runs Playwright on **Browserbase** (no separate VPS scanner); data saved in Supabase.
- **Data collection:** HTML, screenshots, links (with HTTP checks), forms/buttons listed, console errors, axe accessibility, responsive screenshots, PageSpeed, SEO (includes OG tags + favicon flag).
- **AI:** Claude turns screenshots + metrics into structured issues; saved to the `**issues`** table (Supabase must have this table — migrations are not in this repo).
- **Free tier preview:** Picks **3 issues** and marks them `is_in_free_preview`.
- **PDF:** Generated on the VPS from HTML, uploaded to storage; `**report_pdf_url`** on scans.
- **Email:** Resend sends the download link after PDF (needs API keys in production).
- **Payments:** Paddle webhook verifies signature and kicks off paid scans.

---

## What is still missing or partial

- **Full “functionality testing”:** We **detect** buttons/forms and **check links** (HEAD/GET). We do **not** click every control, test modals/dropdowns/tabs, or write a `functionality_tests` blob like the review describes.
- **Dedicated security audit:** No separate HTTPS/header/cookie/exposed-file scanner; Claude may still mention security from what it sees.
- **Spelling/grammar:** LanguageTool is **not** wired up.
- **Results UI:** The public **homepage is still a placeholder**. Issue data is available via `**/api/scan/status/[scanId]`** — a proper results page still needs to be built.

---

## The three “critical issues” from the review

1. **No AI / no issues table** — **Addressed in code** (Claude + `issues`).
2. **Detection vs testing** — **Partly addressed** (link validation + data for Claude). **Not** the full Playwright click-through scope.
3. **Security + spelling** — **Security:** partial (AI + signals). **Spelling:** not done.

---

## Answers to their questions


| Question              | Short answer                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Started Claude?       | **Yes** — it’s integrated in the scan workflow.                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Longest scan you ran? | ***Under ~5 minutes****                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Results page built?   | **not yet**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Priority 1 in 5 days? | Main remaining **building the results UI** + finishing **hard functionality testing**                                                                                                                                                                                                                                                                                                                                                                                                                |
| Daily availability?   | **2:00 pm t0 5:00 and 9:00pm to 4:00 am**                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Stuck on anything?    | **About the report**The report layout still needs work. It is **not** exactly what we want for launch yet. We still need to adjust the **structure and wording** so it reads clearly for customers.---**About Resend and Gmail** - **Sending email:** Resend does **not** let you send “from” a normal **@gmail.com** address as your **official business sender**. You must use an address on **your own domain** (for example `reports@getqalaunch.com`) and **verify that domain** in Resend. |


---

