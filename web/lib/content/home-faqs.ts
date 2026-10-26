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
    a: "Most website checkers test for SEO and page speed — they report on what Google sees. QAlaunch opens your site in a real browser and tests what visitors experience: usability problems, broken functionality, UI bugs, and mobile layout failures. These are the issues that actually cost you customers, and a generic SEO tool does not find them. Every issue in the full report comes with how to fix it, and a screenshot wherever the scanner could pinpoint the element.",
  },
  {
    q: "How long does the free website audit take?",
    a: "The free preview takes about 2 minutes and shows 3 of the issues found, including the most serious, at no cost. A full paid report is usually ready within 5 minutes of payment, and the PDF download link arrives by email as soon as it is.",
  },
  {
    q: "What does the full paid report include?",
    a: "Your full report includes: an overall health score (0–100) with category breakdowns, every issue found categorised by type and severity (Critical/High/Medium/Low), where on the page each one is, a screenshot wherever the scanner could pinpoint the element, a plain-English explanation of why it matters, and how to fix it, written for your developer. You get it as a PDF and as a web page you can share.",
  },
  {
    q: "Do you test websites built with Lovable, Bolt, or Replit?",
    a: "Yes — QAlaunch was specifically designed with AI-built websites in mind. Lovable, Bolt.new, Replit, v0, and Cursor sites all ship fast but tend to produce repeating patterns of usability issues, mobile responsiveness failures, and broken interactive elements. Our checks are tuned to find exactly these patterns, which generic website checkers miss entirely.",
  },
  {
    q: "What if my website requires a login to access?",
    a: "QAlaunch tests what a visitor can reach before signing in. If your homepage is itself a login screen, the free scan will tell you so and ask for your public homepage instead; a paid report tests every public page it can reach and says which areas sat behind the login. That is usually where new visitors form their first impression anyway. Paste your published site's address, not an editor or preview link.",
  },
]
