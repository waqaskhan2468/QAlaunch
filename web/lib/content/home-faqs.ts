/**
 * Homepage FAQ content.
 *
 * Lives outside components/home/faq.tsx because that file is a client
 * component, and a server component importing a value across the client
 * boundary receives a module reference rather than the array — which silently
 * produced `null` FAQPage schema on the homepage rather than an error.
 *
 * Both the rendered accordion and the JSON-LD read from here, so the markup
 * cannot drift from what a visitor actually sees.
 */

export type FAQItem = {
  q: string
  a: string
}

export const homeFaqs: FAQItem[] = [
  {
    q: "What is a website audit and why do I need one?",
    a: "A website audit is a comprehensive quality check of your website that identifies problems affecting your users — broken links, usability issues, slow load times, mobile layout failures, and UI bugs. You need one because most website problems are invisible to the owner but very visible to customers. A professional audit finds issues before your users do — protecting your reputation and revenue.",
  },
  {
    q: "How is QAlaunch different from other free website checkers?",
    a: "Most website checkers test for SEO and page speed — they report on what Google sees. QAlaunch tests for what real users experience: usability problems, broken functionality, UI bugs, and mobile responsiveness failures. These are the issues that actually cost you customers, and no generic SEO tool finds them. QAlaunch also delivers developer-ready fix instructions with screenshot evidence, so issues get fixed — not just listed.",
  },
  {
    q: "How long does the free website audit take?",
    a: "The free audit preview takes under 120 seconds and shows your 3 most critical issues at no cost. A full paid audit report is generated within 3–5 minutes of payment. You receive a PDF download link by email as soon as it's ready — there's no waiting around.",
  },
  {
    q: "What does the full paid report include?",
    a: "Your full report includes: an overall health score (0–100) with category breakdowns, every issue found categorised by type and severity (Critical/High/Medium/Low), a screenshot showing exactly where each issue appears on your live site, a plain-English explanation of why it matters, and step-by-step developer fix instructions. The report is designed so your developer can action every issue without a single follow-up question.",
  },
  {
    q: "Do you test websites built with Lovable, Bolt, or Replit?",
    a: "Yes — QAlaunch was specifically designed with AI-built websites in mind. Lovable, Bolt.new, Replit, v0, and Cursor sites all ship fast but tend to produce repeating patterns of usability issues, mobile responsiveness failures, and broken interactive elements. Our checks are tuned to find exactly these patterns, which generic website checkers miss entirely.",
  },
  {
    q: "What if my website requires a login to access?",
    a: "QAlaunch automatically detects login barriers. If your site requires authentication, we run all 35 checks on your publicly accessible pages and clearly document in the report which areas were excluded due to the login requirement. You still receive a comprehensive audit of everything visible to new visitors — which is often where the most important user experience issues live anyway.",
  },
]
