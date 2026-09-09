/**
 * Config for the /compare/* pages.
 *
 * These target the comparisons a QAlaunch buyer actually makes before paying —
 * "I already run Lighthouse", "should I just hire someone", "isn't this what
 * BrowserStack does" — rather than the generic "best website testing tools"
 * head term, which is held by high-authority listicles about enterprise test
 * automation and describes a different audience entirely.
 *
 * Every page states plainly where the alternative is the better choice. That
 * is not a hedge: a comparison that never concedes anything reads as marketing,
 * converts worse, and is exactly what Google's helpful-content guidance treats
 * as low value.
 */

export type CompareRow = {
	capability: string
	/** Short verdict for the alternative. */
	them: string
	/** Short verdict for QAlaunch. */
	us: string
}

export type CompareConfig = {
	slug: string
	/** Alternative's display name, e.g. "Google Lighthouse". */
	name: string
	title: string
	description: string
	ogTitle: string
	ogDescription: string
	headlineLead: string
	headlineAccent: string
	/** Answer-first summary — the block AI engines quote. */
	summary: string
	intro: string[]
	tableHeading: string
	rows: CompareRow[]
	themBetterHeading: string
	themBetter: string[]
	usBetterHeading: string
	usBetter: string[]
	togetherHeading: string
	together: string
	faqs: { q: string; a: string }[]
	related: { href: string; label: string }[]
}

export const LIGHTHOUSE: CompareConfig = {
	slug: 'google-lighthouse',
	name: 'Google Lighthouse',
	title: 'QAlaunch vs Google Lighthouse — What It Misses',
	description:
		'Lighthouse scores how your page loads. It never looks at it. What a 100/100 score still misses, and when you need a real browser instead.',
	ogTitle: 'QAlaunch vs Google Lighthouse: What a 100/100 Score Still Misses',
	ogDescription:
		'Lighthouse measures loading, code and technical SEO. It cannot tell you your sign-up button is unreadable on a phone. Here is the honest split.',
	headlineLead: 'Lighthouse scores how your page loads.',
	headlineAccent: 'It never actually looks at it.',
	summary:
		'Google Lighthouse audits performance, accessibility, best practices and technical SEO, and it is genuinely excellent at that — free, unlimited, built into Chrome. What it cannot do is judge whether your page works for a human: whether the hero is cut off at phone width, whether a button leads anywhere, whether a form actually delivers. A site can score 100/100 and still lose every visitor at the sign-up screen.',
	intro: [
		'This is not a case of one tool being better. Lighthouse and QAlaunch measure genuinely different things, and the most common mistake is assuming a green Lighthouse score means the site is fine for visitors.',
		'Lighthouse is a lab tool. It loads your page, measures how fast it renders, runs a set of automated code and accessibility rules, and returns four scores. It is the right tool for performance work, and you should keep using it.',
		'What it does not do is use your website. It never scrolls, never taps a button, never submits a form, and never forms an opinion about what the page looks like at 375px. Those are the failures that cost sales.',
	],
	tableHeading: 'Where each one actually looks',
	rows: [
		{ capability: 'Load speed and Core Web Vitals', them: 'Yes — the reference tool', us: 'Reported, via PageSpeed data' },
		{ capability: 'Automated accessibility rules', them: 'Yes (axe-based)', us: 'Yes (axe-based)' },
		{ capability: 'Technical SEO basics', them: 'Yes', us: 'Yes' },
		{ capability: 'Renders the page at phone width and inspects it', them: 'No', us: 'Yes — desktop + mobile screenshots' },
		{ capability: 'Judges whether the layout is visually broken', them: 'No', us: 'Yes — AI visual review' },
		{ capability: 'Clicks buttons and links to see if they work', them: 'No', us: 'Yes' },
		{ capability: 'Checks a form responds and validates', them: 'No', us: 'Yes' },
		{ capability: 'Output written for a non-developer', them: 'No — technical audit list', us: 'Yes — plain English' },
		{ capability: 'Price', them: 'Free, unlimited', us: 'Free preview · full report from $9' },
	],
	themBetterHeading: 'When Lighthouse is the better tool',
	themBetter: [
		'You are working on load speed. Lighthouse is the reference implementation for Core Web Vitals and gives you the exact metrics and opportunities to fix, for free and as often as you like.',
		'You want a repeatable technical score to track over time, or to wire into a build pipeline.',
		'You are a developer, comfortable reading an audit list, and you already know how to interpret and act on it.',
		'Your budget is zero. Lighthouse is free forever and there is no reason not to run it.',
	],
	usBetterHeading: 'When Lighthouse will not tell you what you need',
	usBetter: [
		'Your site scores well and still is not converting. Lighthouse has no opinion on whether your call-to-action is readable, findable, or compelling.',
		'You built with an AI tool and cannot review the code yourself. You need findings in plain English, not a list of audit IDs.',
		'The problem might be visual — a hero taller than a phone screen, a section that overlaps, a button whose label disappears against its own background over a gradient or image.',
		'You need to know whether things actually work: whether the nav links resolve, whether the form responds, whether the images load.',
	],
	togetherHeading: 'The honest answer: run both',
	together:
		'They are not substitutes. Run Lighthouse for performance and technical health — it is free and it is the best tool for that job. Run QAlaunch when you need to know what a first-time visitor on a phone actually experiences. The two reports rarely overlap, and the second one is the one that explains why a fast site still is not converting.',
	faqs: [
		{
			q: 'Can Lighthouse find broken buttons or links?',
			a: 'No. Lighthouse analyses the page as loaded — it does not click anything. A button wired to nothing, a nav link pointing at a route that was renamed, or a form that submits into the void all pass Lighthouse without comment, because none of them are loading or code-quality problems.',
		},
		{
			q: 'My Lighthouse score is 100. Why would I need anything else?',
			a: 'A 100 score means the page loads fast, passes automated code checks, and has its technical SEO in order. It says nothing about whether the layout holds together at phone width, whether your primary action is visible, or whether the sign-up flow works. Those are judged by looking at and using the page, which Lighthouse does not do.',
		},
		{
			q: 'Does QAlaunch replace Lighthouse?',
			a: 'No, and it should not. QAlaunch reports performance data too, but Lighthouse is the reference tool for Core Web Vitals and it is free. Use it for performance. QAlaunch covers the visitor-experience layer above it — visual, functional and usability problems that no code audit detects.',
		},
		{
			q: 'Does Lighthouse check the mobile version?',
			a: 'Lighthouse has a mobile mode that throttles the connection and emulates a mobile viewport for its performance measurements. That is a performance simulation, not a visual inspection — it will not tell you the heading is clipped or the checkout button sits off-screen at 375px.',
		},
	],
	related: [
		{ href: '/blog/website-looks-fine-on-desktop-broken-on-mobile', label: 'why sites break on mobile but not desktop' },
		{ href: '/blog/vibe-coding-website-bugs', label: '9 bugs every AI-built site ships with' },
	],
}

export const FREELANCER: CompareConfig = {
	slug: 'hiring-a-qa-tester',
	name: 'Hiring a QA Tester',
	title: 'QAlaunch vs Hiring a QA Tester — Cost Compared',
	description:
		'A freelance QA tester costs hundreds and takes days. A scan costs $9 and takes minutes. An honest look at which one your site actually needs.',
	ogTitle: 'QAlaunch vs Hiring a QA Tester: Which Does Your Site Need?',
	ogDescription:
		'A human tester is better at judgement, logged-in flows and business logic. A scan is better at speed, cost and repeating after every change.',
	headlineLead: 'A freelance tester costs hundreds and takes days.',
	headlineAccent: 'Sometimes that is still the right call.',
	summary:
		'A freelance QA tester typically charges from around $25–75 an hour, or a few hundred dollars for a one-off site audit, and turns it around in days. QAlaunch costs $9–59 as a one-time charge and reports in minutes. The honest split: a human is better for anything requiring judgement — logged-in flows, payment logic, your specific business rules. A scan is better for the public-facing layer and for re-checking after every change, which is where most bugs actually appear.',
	intro: [
		'This is the decision most people are actually weighing, and the usual framing — "tool versus human" — is the wrong one. They fail at different things.',
		'A human tester brings judgement. They can be told what your product is supposed to do, log into it, follow a checkout through to a real card charge, and tell you that the flow is confusing even when nothing is technically broken. No automated scan does that.',
		'What a human cannot do is run again for free every time you change something. And that is precisely when sites break — after an update, a new section, a theme change, a fresh prompt to your AI builder.',
	],
	tableHeading: 'Honest side by side',
	rows: [
		{ capability: 'Typical cost', them: 'From ~$25–75/hr, or a few hundred per audit', us: '$9–59, one-time' },
		{ capability: 'Turnaround', them: 'Days', us: 'About 2 minutes' },
		{ capability: 'Tests pages behind a login', them: 'Yes', us: 'No — public pages only' },
		{ capability: 'Completes a real purchase or payment', them: 'Yes', us: 'No' },
		{ capability: 'Judges your specific business logic', them: 'Yes', us: 'No' },
		{ capability: 'Exploratory testing and gut feel', them: 'Yes', us: 'Partly — AI visual review' },
		{ capability: 'Repeat after every single change', them: 'Costly', us: 'Yes' },
		{ capability: 'Consistent, same checks every time', them: 'Varies by person and day', us: 'Yes' },
		{ capability: 'Available at 2am before a launch', them: 'Unlikely', us: 'Yes' },
	],
	themBetterHeading: 'When you should hire a person instead',
	themBetter: [
		'Your product lives behind a login. Automated public-page scanning cannot reach the part of your app that matters most, and that is where a tester earns their fee.',
		'Money changes hands in a way that needs verifying end to end — real cards, refunds, subscription states, edge cases in your pricing rules.',
		'You need someone to judge whether a flow makes sense, not just whether it functions. "This works but nobody will understand it" is a human observation.',
		'You are launching something significant and want one careful pass by somebody accountable for the result.',
	],
	usBetterHeading: 'When a scan is the better use of your money',
	usBetter: [
		'You need to know today whether the site you just published is broken for visitors, and a few hundred dollars plus a week of waiting is not proportionate.',
		'The pages that matter are public — a landing page, a marketing site, a store, an AI-built app’s front door.',
		'You change the site often. Every prompt, plugin update or theme tweak can introduce a regression, and re-hiring for each one is not realistic.',
		'You want the same checks run identically every time, so you can tell what changed rather than relying on whether the tester was thorough that day.',
	],
	togetherHeading: 'What most people should actually do',
	together:
		'Use the scan as the routine check — after every meaningful change, and before anything goes public. Bring in a human for the milestones: a real launch, a payment flow going live, an app whose core value sits behind a login. Spending $9 to find the obvious breakage first also means a paid tester spends their hours on the judgement work you are actually hiring them for.',
	faqs: [
		{
			q: 'How much does it cost to have someone test my website?',
			a: 'Freelance QA testers commonly charge from around $25–75 an hour depending on experience and region, and a one-off audit of a small site usually lands in the low hundreds. Agencies charge considerably more. Rates vary widely, so treat those as a starting range rather than a quote.',
		},
		{
			q: 'Can QAlaunch test pages behind a login?',
			a: 'No. QAlaunch runs as an anonymous visitor, so it covers what a stranger can reach — your homepage, landing pages, pricing, product and category pages, and the sign-up screen itself. Anything requiring an account needs a human tester or your own manual pass.',
		},
		{
			q: 'Is an automated scan good enough on its own?',
			a: 'For a public marketing site, store front, or an AI-built app’s public pages, it catches the large majority of what actually costs you visitors. For anything with accounts, payments or complex business rules, it is a first pass rather than a complete answer.',
		},
		{
			q: 'Why not just check the site myself?',
			a: 'You can, and you should — but you are the worst-placed person to do it. You test on the machine you built it on, already logged in, already knowing where everything is. That is the exact set of conditions that hides the bugs a stranger on a phone hits immediately.',
		},
	],
	related: [
		{ href: '/blog/contact-form-not-working', label: 'why contact forms fail silently' },
		{ href: '/pricing', label: 'QAlaunch pricing' },
	],
}

export const BROWSERSTACK: CompareConfig = {
	slug: 'browserstack',
	name: 'BrowserStack',
	title: 'QAlaunch vs BrowserStack — Which Do You Need?',
	description:
		'BrowserStack gives you browsers to test in. QAlaunch tells you what is wrong. Different jobs — here is which one fits how you work.',
	ogTitle: 'QAlaunch vs BrowserStack: Access to Browsers, or Answers?',
	ogDescription:
		'BrowserStack is a device and browser cloud for engineering teams. QAlaunch is a one-URL audit that reports findings in plain English.',
	headlineLead: 'BrowserStack gives you browsers to test in.',
	headlineAccent: 'QAlaunch tells you what is wrong.',
	summary:
		'BrowserStack is a real device and browser cloud: it gives engineering teams access to thousands of browser, OS and device combinations to test against, manually or through automated suites. QAlaunch does not give you browsers — it opens your URL in one, inspects the result, and hands back a list of problems in plain English. If you know what to look for and need to check it everywhere, use BrowserStack. If you need to be told what is broken, use QAlaunch.',
	intro: [
		'These two get compared often, and they are not really competitors — they solve opposite halves of the problem.',
		'BrowserStack solves coverage. Your site might work in Chrome on your laptop and fail in Safari on an older iPhone, and BrowserStack lets you check that specific combination on a real device, or run an automated test suite across hundreds of them in a build pipeline.',
		'But BrowserStack assumes you already know what you are looking for. It hands you a browser; the judgement is yours. That assumption breaks down completely if you did not write the site yourself.',
	],
	tableHeading: 'Two different jobs',
	rows: [
		{ capability: 'Real device and browser matrix', them: 'Yes — thousands of combinations', us: 'No — one modern cloud browser' },
		{ capability: 'Automated test suites in CI', them: 'Yes', us: 'No' },
		{ capability: 'Tells you what is broken, unprompted', them: 'No — you inspect', us: 'Yes — reports findings' },
		{ capability: 'Requires knowing what to look for', them: 'Yes', us: 'No' },
		{ capability: 'Requires writing test scripts', them: 'For automation, yes', us: 'No' },
		{ capability: 'Setup needed', them: 'Account, config, often scripting', us: 'Paste a URL' },
		{ capability: 'Plain-English output', them: 'No', us: 'Yes' },
		{ capability: 'Pricing model', them: 'Monthly subscription', us: 'One-time, from $9' },
	],
	themBetterHeading: 'When BrowserStack is clearly the right tool',
	themBetter: [
		'You need a specific combination verified — Safari on a particular iOS version, an older Android, a corporate browser you cannot install.',
		'You have an engineering team and want automated cross-browser tests running on every commit.',
		'You are debugging a bug that only reproduces on one device and you need hands-on access to that device.',
		'Broad browser coverage is a compliance or contractual requirement for your product.',
	],
	usBetterHeading: 'When BrowserStack will not help you',
	usBetter: [
		'You do not know what you are looking for. Access to a hundred browsers is worth nothing if you cannot tell that a layout is subtly wrong in any of them.',
		'You did not write the site — an AI builder, a theme or an agency did — and you need findings, not tooling.',
		'You want one answer in two minutes, not an environment to configure and a suite to maintain.',
		'A monthly subscription is not proportionate to a site you check occasionally rather than continuously.',
	],
	togetherHeading: 'If you are choosing between them',
	together:
		'Pick by what you are missing. Missing coverage — you know the bug, you need the device — that is BrowserStack. Missing information — the site looks fine to you and you cannot work out why visitors leave — that is QAlaunch. Teams with real engineering capacity often end up using both; solo founders and non-technical owners almost never need a device cloud.',
	faqs: [
		{
			q: 'Is QAlaunch a BrowserStack alternative?',
			a: 'Only for one specific need: finding out what is wrong with a live site without knowing in advance what to look for. It is not an alternative for cross-browser coverage, real device access, or automated test suites, and it does not try to be.',
		},
		{
			q: 'Do I need a device cloud for a small site?',
			a: 'Usually not. Most bugs that cost small sites visitors are not exotic browser incompatibilities — they are layouts breaking at phone width, buttons wired to nothing, and forms that silently fail. Those appear in any modern browser, which is why a single well-inspected pass finds them.',
		},
		{
			q: 'Does QAlaunch test in Safari?',
			a: 'No. QAlaunch runs a modern Chromium-based cloud browser at desktop and mobile widths. Genuinely Safari-specific bugs need a real Apple device or a device cloud — we say so plainly rather than implying coverage we do not have.',
		},
		{
			q: 'Which is cheaper?',
			a: 'They price for different things. BrowserStack is a monthly subscription for ongoing access; QAlaunch is a one-time charge per report, starting at $9, with a free preview. If you audit a site occasionally, the one-time model costs less. If you test continuously across many devices, a subscription is the model that fits.',
		},
	],
	related: [
		{ href: '/blog/website-looks-fine-on-desktop-broken-on-mobile', label: 'why sites break on mobile but not desktop' },
		{ href: '/pricing', label: 'QAlaunch pricing' },
	],
}

export const COMPARISONS: CompareConfig[] = [LIGHTHOUSE, FREELANCER, BROWSERSTACK]
