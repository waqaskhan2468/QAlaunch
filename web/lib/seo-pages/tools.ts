import type { ToolPage } from './types'

/**
 * Scanner-first landing pages at /tools/<slug>.
 *
 * Every tool page runs the same free scan. They exist because people search
 * for the job ("mobile friendly test", "check website for javascript errors"),
 * not the product, and each page explains what the scan covers for that job
 * and, plainly, what it does not. The scan never fills in and sends a form,
 * never logs in and never places an order, so no page may say it does.
 */
export const TOOLS: ToolPage[] = [
	{
		slug: 'mobile-friendly-test',
		query: 'mobile friendly test',
		title: 'Free Mobile-Friendly Test (Real Phone View)',
		description:
			'Google retired its Mobile-Friendly Test in 2023. Check your site at real phone width: layout, tap targets, text size, menus and buttons that fail.',
		h1: 'Free mobile-friendly test',
		lead: 'Google switched off its Mobile-Friendly Test in December 2023. This one opens your site in a real browser at phone width and shows you what visitors on a phone actually get.',
		answer:
			'To check if a website is mobile friendly now, load it at a real phone width and look for sideways scrolling, text too small to read, buttons too close to tap, menus that do not open and elements that overlap. Google’s own Mobile-Friendly Test and the Mobile Usability report in Search Console were retired in December 2023, and Google points people to Lighthouse instead. Lighthouse scores speed and a few mobile basics; it does not tap through your menu or tell you a button is hidden behind a cookie banner.',
		checks: [
			{
				title: 'Real phone-width rendering',
				body: 'Your page is loaded in Chromium at 390 pixels wide, the size of a current iPhone, and screenshotted from top to bottom so you see the same thing a visitor on a phone does.',
			},
			{
				title: 'Sideways scrolling and overflow',
				body: 'An element wider than the screen makes the whole page slide left and right under a thumb. The scan finds content that spills past the viewport and shows where it is.',
			},
			{
				title: 'Overlapping and hidden elements',
				body: 'The screenshots go through a visual review for text sitting on top of other text, buttons covered by banners or chat widgets, and content cut off at the edge.',
			},
			{
				title: 'Text size and tap targets',
				body: 'Body text that needs pinching to read and links packed too tightly to tap accurately are both flagged, with the page area they appear in.',
			},
			{
				title: 'Mobile menu and main button',
				body: 'The main call to action is checked for being visible and reachable on a phone, and navigation links are checked for leading somewhere real.',
			},
			{
				title: 'Mobile speed',
				body: 'Google PageSpeed scores for mobile are included, so slow loading on a phone connection shows up next to the layout problems.',
			},
		],
		reading: [
			'Start with anything marked high severity on the phone view. A covered button or a menu that will not open stops visitors outright; a slightly small font only annoys them.',
			'Compare the desktop and phone screenshots side by side. Problems that only appear at phone width usually come from a fixed width, a wide image or table, or a widget that ignores small screens.',
			'Treat the PageSpeed score as one signal, not the verdict. A fast page can still be unusable on a phone, and a slower page can work perfectly well.',
		],
		limits: [
			'The scan uses Chromium at phone size, not a physical iPhone. Bugs that only happen in Safari’s engine need a real device to confirm.',
			'The free scan covers your homepage. Other templates, such as product or blog pages, need a paid report or their own scan.',
			'It cannot log in, so pages behind an account are out of reach.',
		],
		faqs: [
			{
				q: 'Is Google’s Mobile-Friendly Test still available?',
				a: 'No. Google retired the Mobile-Friendly Test tool, its API and the Mobile Usability report in Search Console in December 2023. The old address no longer runs a test.',
			},
			{
				q: 'What replaced the Google Mobile-Friendly Test?',
				a: 'Google recommends Lighthouse, which is built into Chrome and powers PageSpeed Insights. It measures performance and some mobile basics. For checking whether a phone visitor can actually use the page, you need a test that renders it at phone width and looks at the result, which is what this page does.',
			},
			{
				q: 'Does mobile-friendliness still affect Google rankings?',
				a: 'Google indexes the mobile version of your site first, so content and links missing on mobile can cost you. More directly, visitors who cannot use a page on their phone leave, and that costs you enquiries and sales whatever your ranking.',
			},
			{
				q: 'Does PageSpeed Insights check if my site is mobile friendly?',
				a: 'Partly. It reports mobile speed and flags a few issues such as a missing viewport tag or small tap targets. It does not show you overlapping elements, a hidden menu or a button that does nothing.',
			},
		],
		sources: [
			{
				label: 'Search Engine Land: Google drops Mobile-Friendly Test',
				url: 'https://searchengineland.com/google-officially-drops-mobile-usability-report-mobile-friendly-test-tool-and-mobile-friendly-test-api-435377',
			},
			{ label: 'Shopify: Google Mobile-Friendly Test retired', url: 'https://www.shopify.com/blog/google-mobile-friendly-test' },
		],
		related: ['shopify/mobile-site-moves-side-to-side', 'webflow/horizontal-scroll-on-mobile', 'wordpress/mobile-menu-not-working'],
		updated: '2026-10-26',
	},
	{
		slug: 'contact-form-tester',
		query: 'test contact form online',
		title: 'Contact Form Tester: Check Your Form Free',
		description:
			'Find out if your contact form can be used at all: submit button, validation, mobile layout and the errors behind it. Free real-browser check.',
		h1: 'Contact form tester',
		lead: 'A form can look perfect and still lose every message. This check opens your page in a real browser and tests the parts of the form a visitor touches.',
		answer:
			'To test a contact form properly you need two checks: that a visitor can actually complete and submit it, on desktop and on a phone, and that the message then arrives where it should. This free scan handles the first part in a real browser: it finds the form, presses submit on an empty form to see whether validation appears, checks the layout at phone width, and records JavaScript errors and failed requests. The second part, delivery to your inbox, only you can confirm, by sending yourself a test message from a private window.',
		checks: [
			{
				title: 'Validation on an empty submit',
				body: 'The scan presses the submit button without filling anything in. A healthy form shows which fields are required; a broken one does nothing, or worse, pretends to succeed.',
			},
			{
				title: 'Submit button reachable on a phone',
				body: 'At phone width, fields and buttons pushed off screen, covered by a sticky bar or squeezed too small to tap are flagged with a screenshot.',
			},
			{
				title: 'JavaScript errors and failed requests',
				body: 'Many silent form failures leave a trace: a script error when the page loads or a request to a form endpoint that returns an error. Both are recorded and shown in the report.',
			},
			{
				title: 'Labels and accessibility',
				body: 'Fields without labels, poor contrast and missing error descriptions are checked with axe-core, because a form that a screen reader cannot use is also a form that confuses everyone else.',
			},
		],
		reading: [
			'If empty submit showed no validation, try it yourself in a private window. No message at all usually means the form’s script failed to load.',
			'A failed request in the report that mentions your form provider, email service or a backend function is the most direct clue to why messages are not arriving.',
			'If the scan is clean, finish with the delivery test: send a real message to yourself and check the inbox and spam folder.',
		],
		limits: [
			'The scan does not fill in and send real messages, so it cannot confirm that an email reached your inbox. That would also fill your inbox with test leads.',
			'It does not get past CAPTCHA challenges, and it should not: if your form has one, the delivery test has to be done by hand.',
			'The free scan looks at your homepage form; forms on other pages need a paid report or the manual test.',
		],
		faqs: [
			{
				q: 'How do I test if my contact form is working?',
				a: 'Open the live site in a private window, submit a real test message from an address you control, and check that it arrives in the inbox the form should deliver to, including the spam folder. Repeat on a phone. A success message on screen does not prove delivery.',
			},
			{
				q: 'Why does my form say sent but I never get the email?',
				a: 'The success message and the delivery are separate steps. Common causes are email sent without SPF and DKIM landing in spam, a recipient address nobody reads, an expired key for the email service, or on AI-built sites a backend that only worked in the builder preview.',
			},
			{
				q: 'How do I keep test submissions out of my real leads?',
				a: 'Use an obvious subject such as FORM TEST with the date, and an address you recognise, so you can filter them out. That is also why an automated scan should not send real submissions to someone else’s form.',
			},
			{
				q: 'How often should I test my website forms?',
				a: 'After every change to the site, plugin or email setup, and once a month even when nothing changed, because the email side can break without anything on your site moving.',
			},
		],
		sources: [
			{ label: 'HackerNoon: testing website contact forms', url: 'https://hackernoon.com/a-three-checkpoint-framework-for-testing-website-contact-forms' },
			{ label: 'Website form monitoring guide', url: 'https://kumsalajans.com/en/blog/web-design/website-form-monitoring-guide' },
		],
		related: ['wordpress/contact-form-7-spinning-not-sending', 'lovable/contact-form-not-sending', 'webflow/form-oops-something-went-wrong'],
		updated: '2026-10-26',
	},
	{
		slug: 'broken-button-checker',
		query: 'broken button checker',
		title: 'Broken Button Checker: Find Dead Buttons',
		description:
			'Link checkers miss buttons that run on JavaScript. Find buttons and menus that do nothing, on desktop and phone, with a free real-browser scan.',
		h1: 'Broken button checker',
		lead: 'A broken link checker reads the addresses in your links. It cannot tell you that your Book now button does nothing when someone taps it. This scan clicks.',
		answer:
			'To find buttons that do not work, you have to click them in a real browser and watch what happens, because most modern buttons are driven by JavaScript rather than a plain link a crawler can read. This free scan loads your page on desktop and at phone width, clicks the main call to action, follows navigation links, and records any JavaScript error or failed request along the way. A button that is visible but leads nowhere, or one covered by another element on a phone, shows up in the report with a screenshot.',
		checks: [
			{
				title: 'Main call to action',
				body: 'The primary button is found, checked for being visible above the fold, and clicked to confirm it leads somewhere instead of sitting there doing nothing.',
			},
			{
				title: 'Navigation links',
				body: 'Menu links are followed and their responses checked, so a menu item pointing at a deleted page or a server error is caught.',
			},
			{
				title: 'Covered and hidden buttons on mobile',
				body: 'Invisible overlays, cookie banners and chat bubbles often sit on top of a button at phone width. The phone screenshots are reviewed for exactly this.',
			},
			{
				title: 'The error behind the button',
				body: 'When a button fails because a script crashed, the console error and the file it came from are listed, which is usually what a developer needs to fix it.',
			},
			{
				title: 'Dead links on the page',
				body: 'Up to about thirty links on the page are requested, and any that return a 404, a server error or time out are listed.',
			},
		],
		reading: [
			'A button flagged as leading nowhere on phone only, but fine on desktop, almost always means something is covering it. Look at the phone screenshot around the button.',
			'A console error that appears as the page loads can break every button that depends on that script. Fix the first error first; later ones often disappear with it.',
			'Dead links are quick wins. Update or remove them before looking at anything subtle.',
		],
		limits: [
			'The scan clicks the main call to action and navigation, not every single button on a long page. A paid report covers more pages, and the manual test covers whole flows.',
			'It will not place an order or complete a payment, so a checkout button that fails at the final step needs the manual test.',
			'Buttons that only exist after logging in are out of reach.',
		],
		faqs: [
			{
				q: 'What is the difference between a broken link checker and a broken button checker?',
				a: 'A link checker reads the href address in each link and requests it. A button that opens a menu, submits a form or adds to a cart often has no address at all; it runs JavaScript. Only clicking it in a browser shows whether it works.',
			},
			{
				q: 'Why does my button work on desktop but not on my phone?',
				a: 'Usually something is on top of it at phone width: a cookie banner, a chat widget, a popup or an invisible element from the theme. Less often the button sits outside the screen because a section is wider than the phone.',
			},
			{
				q: 'How do I find buttons that do nothing myself?',
				a: 'Open the page in a private window with the browser console open, click each important button, and watch for red errors or nothing happening. Then repeat in Chrome’s device mode or on a real phone.',
			},
		],
		sources: [
			{ label: 'WordPress.org support: button not clickable on mobile', url: 'https://wordpress.org/support/?p=18552125' },
			{ label: 'MDN: Using the browser console', url: 'https://developer.mozilla.org/en-US/docs/Learn_web_development/Howto/Tools_and_setup/What_are_browser_developer_tools' },
		],
		related: ['wordpress/button-not-clickable-on-mobile', 'shopify/add-to-cart-button-not-working', 'wix/anchor-link-button-not-working-live-site'],
		updated: '2026-10-26',
	},
	{
		slug: 'javascript-error-checker',
		query: 'check website for javascript errors online',
		title: 'JavaScript Error Checker for Any Website',
		description:
			'See the JavaScript errors and failed requests your site throws for real visitors, on desktop and phone, without opening DevTools. Free scan.',
		h1: 'JavaScript error checker',
		lead: 'Plugin and theme support teams always ask the same thing: what does your console say? This scan answers it for you, from a real browser, as an anonymous visitor.',
		answer:
			'To check a website for JavaScript errors, load it in a real browser with the developer console open and note every red error, including ones that appear only after you interact with the page. This free scan does that automatically: it opens your page in Chromium on desktop and at phone width, records console errors and failed network requests while it clicks the main button and follows links, and lists each error with the file it came from. Errors that happen only for logged-out visitors, which you never see while signed in, show up here.',
		checks: [
			{
				title: 'Console errors on load',
				body: 'Every error the page throws while loading is captured with its message and source file, so you can tell your own code from a plugin or a third-party script.',
			},
			{
				title: 'Errors after interaction',
				body: 'Some scripts only fail when a visitor does something. The scan clicks the main call to action and follows navigation, and records errors that appear then.',
			},
			{
				title: 'Failed network requests',
				body: 'Scripts, styles, images and API calls that return 404 or 500, or never load at all, are listed. A missing script file is one of the most common reasons a menu or form stops working.',
			},
			{
				title: 'Desktop and phone separately',
				body: 'Some scripts behave differently at small widths, such as mobile menus or sliders. Running at both sizes catches errors that happen only on one.',
			},
		],
		reading: [
			'Read the errors in order. The first one is often the cause and the rest are knock-on effects of a script that stopped halfway.',
			'Look at the file name. A file from a plugin, app or embed points at that vendor; a file from your theme or build points at your own code.',
			'Failed requests to files that no longer exist usually come from a removed plugin or app that left its script tag behind.',
		],
		limits: [
			'The scan sees errors in the visitor’s browser, not on your server. Server-side errors show up only as failed requests or error pages.',
			'Errors that occur only after logging in, or deep inside a multi-step flow, need a paid report covering more pages or the manual test.',
			'Warnings and messages that do not break anything are not all reported; the focus is on errors that affect visitors.',
		],
		faqs: [
			{
				q: 'How do I open the browser console?',
				a: 'In Chrome or Edge, right-click the page, choose Inspect, then the Console tab, or press F12. In Safari, enable the Develop menu in Settings > Advanced, then choose Develop > Show JavaScript Console.',
			},
			{
				q: 'Do JavaScript errors affect SEO?',
				a: 'They can. If an error stops your content from rendering, search engines that render pages may see less than a visitor would. More often the cost is to visitors: menus, forms and buttons that silently stop working.',
			},
			{
				q: 'Why does one JavaScript error break my whole menu?',
				a: 'Browsers stop running a script at the first unhandled error. If your menu code lives in the same file, or runs after the failing script, it never gets the chance to attach to the menu button.',
			},
			{
				q: 'Can I check JavaScript errors on my phone?',
				a: 'It takes extra setup: connecting the phone to a computer for remote debugging. This scan runs at phone width in a desktop browser engine, which catches most mobile-only errors without that setup.',
			},
		],
		sources: [
			{ label: 'Yoast: find JavaScript errors with the console', url: 'https://yoast.com/help/how-to-find-javascript-errors-with-your-browsers-console/' },
			{ label: 'Chrome DevTools: Console overview', url: 'https://developer.chrome.com/docs/devtools/console' },
		],
		related: ['v0/application-error-client-side-exception', 'bolt/blank-page-after-deploy', 'woocommerce/checkout-stuck-spinning'],
		updated: '2026-10-26',
	},
	{
		slug: 'website-bug-checker',
		query: 'website bug checker',
		title: 'Free Website Bug Checker (Real Browser)',
		description:
			'Check your website for broken buttons, dead links, mobile layout bugs, JavaScript errors, accessibility and speed. Free real-browser scan, no signup.',
		h1: 'Free website bug checker',
		lead: 'SEO audits tell you about keywords and backlinks. This tells you what is broken for the people who visit, found the way a tester would find it: by using the site.',
		answer:
			'To check a website for bugs, open it as a stranger would, on a computer and on a phone, and try the things a visitor does: read, tap the main button, use the menu, follow links, fill in the form. This free scan does that in a real browser and reports what fails, including broken buttons and links, layout problems at phone width, JavaScript errors, accessibility barriers, placeholder text, and slow loading, each with a screenshot and a suggested fix. It is a bug check, not an SEO audit: it is about whether the site works.',
		checks: [
			{
				title: 'Functionality',
				body: 'Main button, navigation links, broken images, 404 handling, empty-form validation and search boxes, each tried in the browser rather than read from the code.',
			},
			{
				title: 'Mobile layout',
				body: 'Phone-width screenshots reviewed for sideways scrolling, overlapping content, covered buttons, tiny text and cramped tap targets.',
			},
			{
				title: 'Errors under the surface',
				body: 'JavaScript console errors and failed requests, which explain many of the visible problems and tell a developer where to look.',
			},
			{
				title: 'Accessibility',
				body: 'axe-core checks for missing labels, alt text and heading structure, plus text contrast measured from the rendered page rather than guessed from the stylesheet.',
			},
			{
				title: 'Finishing details',
				body: 'Leftover lorem ipsum, an old copyright year, missing privacy and terms links, a missing favicon and phone numbers that cannot be tapped.',
			},
			{
				title: 'Speed and basics',
				body: 'Google PageSpeed scores, page title and description, and security headers, so the obvious gaps show up alongside the bugs.',
			},
		],
		reading: [
			'Fix by severity, not by count. One broken main button costs more than ten small contrast warnings.',
			'Each finding has a screenshot showing where it is. Check it yourself before handing it to a developer; occasionally a finding needs a human eye to confirm.',
			'The free result shows your top issues. The full report lists every issue with fix instructions, which is what you hand to whoever builds the site.',
		],
		limits: [
			'No automated check finds every bug. It covers what a visitor sees and touches on load, not every path through a complex app.',
			'It cannot log in, send real form messages or complete a purchase. Those flows need the manual test.',
			'The free scan covers the homepage; paid reports cover up to 5 or 10 pages.',
		],
		faqs: [
			{
				q: 'Is there a free tool to find bugs on my website?',
				a: 'Yes, this one. The free scan runs on your homepage with no signup and shows your top issues. Browser developer tools are also free, if you know where to look.',
			},
			{
				q: 'What is the difference between an SEO audit and a bug check?',
				a: 'An SEO audit looks at how search engines see the site: keywords, backlinks, titles, indexing. A bug check looks at whether visitors can use it: buttons, forms, layout, errors. A site can score well on one and badly on the other.',
			},
			{
				q: 'Can a scanner find every bug on my site?',
				a: 'No. It reliably finds the problems a visitor meets on the pages it tests, and it misses things behind logins or deep in multi-step flows. That gap is what manual testing by a person covers.',
			},
		],
		sources: [
			{ label: 'axe-core accessibility rules', url: 'https://github.com/dequelabs/axe-core' },
			{ label: 'Google PageSpeed Insights', url: 'https://pagespeed.web.dev/' },
		],
		related: ['any-website/website-not-working-on-iphone-safari', 'any-website/ssl-installed-but-site-not-secure'],
		updated: '2026-10-26',
	},
	{
		slug: 'ai-website-tester',
		query: 'ai website tester',
		title: 'AI Website Tester: Free Real-Browser Scan',
		description:
			'An AI website tester that opens your site in a real browser, clicks through it on desktop and phone, and explains every problem in plain English.',
		h1: 'AI website tester',
		lead: 'Plenty of tools now call themselves AI testers. Here is exactly what is automated, what the AI part does, and where a human still matters.',
		answer:
			'An AI website tester loads your site in a real browser, interacts with it like a visitor, and uses an AI model to judge what it sees and explain problems in plain language. QAlaunch combines fixed checks that always run the same way (links, console errors, accessibility, contrast, speed) with an AI review of desktop and phone screenshots that catches what rules miss, such as overlapping elements or a button that is technically there but impossible to see. It was built by a QA engineer, and findings come with screenshots so you can check them yourself.',
		checks: [
			{
				title: 'Fixed, repeatable checks',
				body: 'Dead links, console errors, failed requests, empty-form validation, broken images and accessibility rules run the same way every time and produce the same answer for the same page.',
			},
			{
				title: 'AI visual review',
				body: 'Screenshots at desktop and phone width are reviewed by an AI model for layout problems a rule cannot describe: text over images, covered buttons, cut-off content, a hero with no clear action.',
			},
			{
				title: 'Plain-English findings',
				body: 'Each issue is written up for a non-developer: where it is, why it matters to a visitor, and what to change, with severity so you know what to fix first.',
			},
			{
				title: 'Evidence for every finding',
				body: 'Findings link to the screenshot or the error they came from. If something looks wrong to you, you can see exactly what the tester saw.',
			},
		],
		reading: [
			'Fixed checks are facts: a 404 is a 404. AI visual findings are judgements, and the report says how confident it is, so glance at the screenshot before acting on a low-confidence one.',
			'Start with high-severity issues on the phone view; most visitors are on phones, and those issues stop them completely.',
			'If you built the site with an AI builder, each fix can be pasted into it as an instruction.',
		],
		limits: [
			'AI review can be wrong. That is why findings carry evidence and a confidence level instead of a bare verdict.',
			'It tests what an anonymous visitor can reach. Logged-in areas, payments and multi-step flows need a person.',
			'It does not replace testing by your users; it removes the obvious failures before they ever see them.',
		],
		faqs: [
			{
				q: 'Can AI test my website for bugs automatically?',
				a: 'Yes, for a large share of what visitors run into: broken buttons and links, layout problems, script errors and accessibility gaps. It is weaker on business logic, such as whether the right price shows for a discount code, which needs someone who knows how the site should behave.',
			},
			{
				q: 'Can AI replace manual website QA?',
				a: 'Not completely. It is fast and consistent on the surface of a site. A person still catches confusing wording, flows that technically work but make no sense, and anything behind a login. That is why a manual test is offered alongside the scan.',
			},
			{
				q: 'Is AI website testing free?',
				a: 'The scan of your homepage is free with no signup and shows your top issues. A full report with every issue and fix instructions is a one-time payment, with no subscription.',
			},
		],
		sources: [
			{ label: 'BugHerd: AI QA testing for websites', url: 'https://bugherd.com/blog/ai-qa-testing-for-websites' },
			{ label: 'axe-core accessibility rules', url: 'https://github.com/dequelabs/axe-core' },
		],
		related: ['lovable/supabase-data-not-showing-rls', 'cursor/site-not-responsive-on-mobile'],
		updated: '2026-10-26',
	},
]

export function getTool(slug: string): ToolPage | undefined {
	return TOOLS.find((t) => t.slug === slug)
}
