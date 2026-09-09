/**
 * Config for the /for-[platform] landing pages.
 *
 * These pages target commercial-intent queries ("test my <platform> site"),
 * so each one is written around that platform's real, specific failure modes
 * rather than generic QA copy — a page that could describe any builder ranks
 * for none of them.
 *
 * Rendered by components/platform/platform-page.tsx.
 */

export type PlatformIssue = {
	title: string
	desc: string
	severity: 'CRITICAL' | 'HIGH' | 'MEDIUM'
}

export type PlatformConfig = {
	slug: string
	/** Display name, e.g. "Base44". */
	name: string
	/** Small uppercase kicker above the H1. */
	eyebrow: string
	/** Meta title — keep under 49 chars; layout.tsx appends " | QAlaunch". */
	title: string
	/** Meta description — keep under 158 chars. */
	description: string
	ogTitle: string
	ogDescription: string
	/** H1 renders as: headlineLead <br/> headlineAccent (accent in green). */
	headlineLead: string
	headlineAccent: string
	intro: string
	issuesHeading: string
	issuesIntro: string
	issues: PlatformIssue[]
	/** Step 1 copy varies per platform (what URL to paste). */
	step1: string
	faqs: { q: string; a: string }[]
	midCtaHeading: string
	bottomCtaHeading: string
	bottomCtaButton: string
	/** Contextual internal links rendered under the FAQ. */
	related: { href: string; label: string }[]
	/** Reassurance line under the hero CTA. */
	heroNote: string
}

export const BASE44: PlatformConfig = {
	slug: 'for-base44',
	name: 'Base44',
	eyebrow: 'FOR BASE44 BUILDERS',
	title: 'Base44 App Testing — Find Bugs in 2 Minutes',
	description:
		'Free QA audit for Base44 apps. A real browser opens your published app and finds broken sign-up, mobile breaks, and dead buttons — in 2 minutes, no signup.',
	ogTitle: 'Test Your Base44 App — Find Bugs Before Your Users Do',
	ogDescription:
		'The Base44 editor shows you a logged-in, desktop view. QAlaunch checks your published app the way a stranger on a phone sees it.',
	headlineLead: 'Your Base44 app works in the editor.',
	headlineAccent: 'Does it work for a stranger?',
	intro:
		'Base44 gives you a frontend, a database, auth, and hosting from a prompt — which means there is far more that can quietly break than on a plain marketing site. The editor always shows you the best case: logged in as the owner, desktop width, warm cache. QAlaunch opens your published app the way a first-time visitor on a phone actually gets it.',
	issuesHeading: 'What breaks between the editor and your published app',
	issuesIntro:
		'These are the failures we see most often on Base44 apps — every one of them invisible from inside the editor, because the editor runs as you.',
	issues: [
		{
			title: 'Sign-up works for you and fails for everyone else',
			desc: 'You were never signed out while building, so the new-user path was never actually exercised. Confirmation links pointing at the wrong domain and redirects that assume an existing session turn away 100% of new users at the door.',
			severity: 'CRITICAL',
		},
		{
			title: 'Users can see each other’s data — or none at all',
			desc: 'Base44 generates data permissions from prompts, and permission logic only shows its problems when a second user appears. Either user B sees user A’s records, or user B sees an empty app because everything was scoped to the owner.',
			severity: 'CRITICAL',
		},
		{
			title: 'A blank screen after you push an update',
			desc: 'Returning visitors with a stale cache get a white page. You fix it for yourself with a hard refresh without thinking about it; a visitor who lands on nothing simply leaves and does not report it.',
			severity: 'HIGH',
		},
		{
			title: 'Integrations that look connected but never fire',
			desc: 'Payments, email, and file uploads can appear configured in the dashboard while the live calls fail — webhooks that never arrive, emails that never send, uploads that error only for non-owners.',
			severity: 'HIGH',
		},
		{
			title: 'The landing page falls apart at 375px',
			desc: 'Your public pages are where visitors decide whether to sign up at all, and they were reviewed at desktop width only. Heroes overflow, CTAs get pushed off-screen, and text becomes unreadable at phone widths.',
			severity: 'HIGH',
		},
		{
			title: 'Buttons that render but do nothing',
			desc: 'A button generated in one prompt and renamed in a later one still looks perfect and is wired to nothing. It fails silently — no error, no console message, just a click that does not respond.',
			severity: 'MEDIUM',
		},
	],
	step1: 'Any publicly accessible page — your base44.app subdomain or your custom domain.',
	faqs: [
		{
			q: 'Does QAlaunch work on Base44 apps?',
			a: 'Yes — on every publicly accessible page: your landing page, pricing, about, and the sign-up screen itself, on a base44.app subdomain or a custom domain. Pages behind a login are not tested, since the audit runs as an anonymous visitor.',
		},
		{
			q: 'Why does my Base44 app work in the editor but break when published?',
			a: 'The editor runs under the best conditions your app will ever have: you are logged in as the owner, the preview pane is desktop width, and the cache is warm. Your first real user gets the opposite — an anonymous session, a phone screen, production data, and a cold load. Bugs that live in that gap are invisible in the editor by definition.',
		},
		{
			q: 'Does the Base44 test data toggle cover this?',
			a: 'No. The test data toggle is genuinely useful during development, but it tests your app as you. It cannot tell you whether a brand-new visitor can sign up, whether your landing page survives a 375px screen, or whether two different users’ data stays separated.',
		},
		{
			q: 'Do I need to install anything or share my account?',
			a: 'No. Paste your published URL and the audit runs from the outside, exactly like a real visitor. No admin access, no account sharing, nothing to install, and your app is never modified.',
		},
		{
			q: 'What does it cost?',
			a: 'The free scan shows your top issues with no signup. Full reports are one-time purchases from $9 (single page) to $59 (up to 10 pages). No subscription.',
		},
	],
	midCtaHeading: 'See what a stranger sees on your Base44 app',
	bottomCtaHeading: 'Find it before your first real user does',
	bottomCtaButton: 'Audit My Base44 App Free →',
	related: [
		{ href: '/blog/test-base44-app-before-launch', label: 'the full Base44 pre-launch checklist' },
		{ href: '/blog/vibe-coding-website-bugs', label: '9 bugs every AI-built site ships with' },
	],
	heroNote: 'Free · No signup · Results in ~2 min',
}

export const REPLIT: PlatformConfig = {
	slug: 'for-replit',
	name: 'Replit',
	eyebrow: 'FOR REPLIT BUILDERS',
	title: 'Replit App Testing — Find Bugs in 2 Minutes',
	description:
		'Free QA audit for Replit apps. A real browser opens your deployed app and finds broken pages, mobile breaks, and dead buttons — in 2 minutes, no signup.',
	ogTitle: 'Test Your Replit App — Find Bugs Before Your Users Do',
	ogDescription:
		'"Works in the editor, fails in production" is the most common Replit bug. QAlaunch checks your deployed app the way a real visitor gets it.',
	headlineLead: 'It runs in the Replit editor.',
	headlineAccent: 'That is not the same as working.',
	intro:
		'“Works in the workspace, fails in production” is the single most common Replit complaint, and it has a specific cause: the deployment is a different environment from the editor you built in. QAlaunch opens your deployed app in a real cloud browser — desktop and phone — and reports what an actual visitor runs into.',
	issuesHeading: 'What breaks between the workspace and your deployment',
	issuesIntro:
		'Replit deployments fail in a small number of very repeatable ways. These are the ones that reach real visitors rather than showing up in your logs.',
	issues: [
		{
			title: 'Secrets that never made it to production',
			desc: 'Secrets set in the workspace are not automatically present in a deployment. Anything missing there is the classic cause of “works in the editor, fails in production” — the app loads, then a feature that depends on a key quietly dies.',
			severity: 'CRITICAL',
		},
		{
			title: 'The app only runs while your tab is open',
			desc: 'A workspace preview stops when the tab closes. If you shared a preview URL rather than a published deployment, your link is dead for everyone the moment you close Replit — and it looks fine to you right up until then.',
			severity: 'CRITICAL',
		},
		{
			title: 'Stale assets served by an old service worker',
			desc: 'Returning visitors can be served a cached bundle from a previous deploy, producing a blank page or a half-broken UI. You clear it without thinking; a visitor sees a broken app and leaves.',
			severity: 'HIGH',
		},
		{
			title: 'A deployment that never passed its health check',
			desc: 'If the homepage takes too long to respond, publishing can fail at the final step — leaving the previous version, or nothing at all, live at your URL while you assume the new one shipped.',
			severity: 'HIGH',
		},
		{
			title: 'The mobile view nobody ever opened',
			desc: 'The Replit preview pane is desktop-shaped and narrow, so mobile breakpoints are the least-verified part of most Replit apps: overflowing heroes, off-screen buttons, and text that is unreadable at 375px.',
			severity: 'HIGH',
		},
		{
			title: 'Sign-up that only works because you were already signed in',
			desc: 'Auth flows are routinely built while authenticated, so the genuinely-new-user path — form, confirmation email, redirect back in — is never walked end to end until a real person tries it.',
			severity: 'HIGH',
		},
	],
	step1: 'Any publicly accessible page — your .replit.app deployment or your custom domain.',
	faqs: [
		{
			q: 'Does QAlaunch work on Replit apps?',
			a: 'Yes — on any publicly accessible deployment, whether that is a .replit.app URL or a custom domain. It tests the public pages a visitor can reach without an account; anything behind a login is not covered.',
		},
		{
			q: 'Why does my Replit app work in the editor but not after deploying?',
			a: 'The deployment is a separate environment from your workspace. Secrets do not carry over automatically, the start command has to actually run your server, and the deployed app runs for an anonymous visitor rather than for you. Most “works here, not there” reports trace back to one of those three.',
		},
		{
			q: 'Should I test the preview URL or the deployment?',
			a: 'Always the deployment. A workspace preview runs only while your tab is open and reflects your session and your environment — testing it tells you nothing about what your visitors get.',
		},
		{
			q: 'Do I need to give access to my Replit account?',
			a: 'No. Paste your public URL and the audit runs from the outside like any visitor. No account access, nothing installed, and your app is never modified.',
		},
		{
			q: 'What does it cost?',
			a: 'The free scan shows your top issues with no signup. Full reports are one-time purchases from $9 (single page) to $59 (up to 10 pages). No subscription.',
		},
	],
	midCtaHeading: 'Check your deployed Replit app',
	bottomCtaHeading: 'Test the deployment, not the preview',
	bottomCtaButton: 'Audit My Replit App Free →',
	related: [
		{ href: '/blog/vibe-coding-website-bugs', label: '9 bugs every AI-built site ships with' },
		{ href: '/blog/website-looks-fine-on-desktop-broken-on-mobile', label: 'why sites break on mobile but not desktop' },
	],
	heroNote: 'Free · No signup · Results in ~2 min',
}

export const V0: PlatformConfig = {
	slug: 'for-v0',
	name: 'v0',
	eyebrow: 'FOR v0 BUILDERS',
	title: 'v0 App Testing — Find Bugs in 2 Minutes',
	description:
		'Free QA audit for v0 apps. A real browser opens your deployed site and finds broken layouts, mobile breaks, and dead buttons — in 2 minutes, no signup.',
	ogTitle: 'Test Your v0 App — Find Bugs Before Your Users Do',
	ogDescription:
		'Perfect in the v0 preview, broken in production is the most reported v0 problem. QAlaunch checks the deployed site as a real visitor.',
	headlineLead: 'It looked perfect in the v0 preview.',
	headlineAccent: 'Then you deployed it.',
	intro:
		'The most reported v0 problem is not bad code — it is the gap between the preview and the deployment. Layouts that render perfectly in v0 arrive misaligned in production, and the person who built it never sees it, because they are logged into Vercel and viewing on a desktop. QAlaunch opens the deployed URL as an anonymous visitor on a real phone.',
	issuesHeading: 'What breaks between the v0 preview and production',
	issuesIntro:
		'These are the failures v0 builders report most — and the ones you are least likely to catch yourself, because your own browser is the best case.',
	issues: [
		{
			title: 'Deployment Protection blocking every real visitor',
			desc: 'With Vercel Deployment Protection enabled, visitors hit a login wall instead of your site. You never see it: you are already authenticated with Vercel, so the page loads perfectly for you and for nobody else.',
			severity: 'CRITICAL',
		},
		{
			title: 'The layout crashes in production but not in preview',
			desc: 'Styles that resolve correctly inside the v0 preview can arrive missing or misapplied on the deployed site, leaving sections misaligned or unstyled — the single most common v0 complaint.',
			severity: 'CRITICAL',
		},
		{
			title: 'Sign-in that fails only after deploying',
			desc: 'OAuth redirect URIs configured for the preview do not match the production URL, so login works throughout development and breaks for the first real user who tries it.',
			severity: 'CRITICAL',
		},
		{
			title: 'Data and animations dead on iPhone',
			desc: 'Apps that behave correctly on a desktop can load without their data or with animations that never run on a real phone — a failure mode invisible in a desktop-width preview pane.',
			severity: 'HIGH',
		},
		{
			title: 'Half-fixed UI left by an error loop',
			desc: 'Asking v0 to fix an error can introduce a related one, and iterating leaves components that render but no longer do what they did two prompts ago. The page still looks finished.',
			severity: 'HIGH',
		},
		{
			title: 'A generic title in Google, not the one you set',
			desc: 'Metadata that resolves correctly in preview can fall back to a default in the deployed environment, so your page shows up in search results with the wrong title or no description at all.',
			severity: 'MEDIUM',
		},
	],
	step1: 'Any publicly accessible page — your .vercel.app deployment or your custom domain.',
	faqs: [
		{
			q: 'Does QAlaunch work on apps built with v0?',
			a: 'Yes — on any publicly accessible deployment, whether that is a .vercel.app URL or a custom domain. It checks the public pages a visitor reaches without an account.',
		},
		{
			q: 'Why does my v0 app look right in the preview and broken after deploying?',
			a: 'The preview and the deployment are different environments. Styles, metadata, and route handling can resolve differently once built for production, and the deployed app runs for an anonymous visitor rather than for your logged-in session. Always judge the deployed URL, never the preview.',
		},
		{
			q: 'My site works for me but others say it asks them to log in. Why?',
			a: 'That is almost always Vercel Deployment Protection still enabled on the project. Because you are signed into Vercel, the protection is transparent to you and absolute for everyone else. Open your deployed URL in an incognito window to see what visitors actually get.',
		},
		{
			q: 'Do I need to connect my Vercel account?',
			a: 'No. Paste your public URL and the audit runs from the outside like any visitor. No account access, nothing installed, and your project is never modified.',
		},
		{
			q: 'What does it cost?',
			a: 'The free scan shows your top issues with no signup. Full reports are one-time purchases from $9 (single page) to $59 (up to 10 pages). No subscription.',
		},
	],
	midCtaHeading: 'Check your deployed v0 app',
	bottomCtaHeading: 'See the deployed site as a visitor sees it',
	bottomCtaButton: 'Audit My v0 App Free →',
	related: [
		{ href: '/blog/vibe-coding-website-bugs', label: '9 bugs every AI-built site ships with' },
		{ href: '/blog/website-looks-fine-on-desktop-broken-on-mobile', label: 'why sites break on mobile but not desktop' },
	],
	heroNote: 'Free · No signup · Results in ~2 min',
}

export const CLAUDE: PlatformConfig = {
	slug: 'for-claude',
	name: 'Claude',
	eyebrow: 'FOR SITES BUILT WITH CLAUDE',
	title: 'Test a Website Built With Claude — Free Scan',
	description:
		'Free QA audit for sites built with Claude. A real browser finds broken links, mobile layout breaks, and forms that fail — in 2 minutes, no signup.',
	ogTitle: 'Test a Website You Built With Claude',
	ogDescription:
		'Claude writes the code; nobody checks the result in a real browser on a real phone. QAlaunch does, in about two minutes.',
	headlineLead: 'Claude wrote the code.',
	headlineAccent: 'Who checked the result?',
	intro:
		'Building with Claude or Claude Code removes the hard part of writing a site — and moves the risk somewhere else. The code compiles, the page renders, and everything looks finished, but nobody has opened the live site on a real phone as a stranger. QAlaunch does exactly that, and reports what it finds in plain English.',
	issuesHeading: 'What we find most on sites built with Claude',
	issuesIntro:
		'Generated code is usually structurally fine. What slips through is everything that only shows up once the site is live and someone who is not you visits it.',
	issues: [
		{
			title: 'Forms that render perfectly and post nowhere',
			desc: 'A contact form generated as UI, complete with a convincing success message, but never wired to a working endpoint or inbox. Visitors think they reached you; you think nobody wrote.',
			severity: 'CRITICAL',
		},
		{
			title: 'Placeholder content that shipped',
			desc: 'Lorem ipsum, example.com links, sample phone numbers, and TODO text left in sections you stopped reviewing after the third iteration — highly visible to a first-time reader and invisible to you.',
			severity: 'HIGH',
		},
		{
			title: 'Mobile breakpoints nobody verified',
			desc: 'Responsive classes are generated confidently and then never checked at a real phone width, so heroes overflow, buttons land off-screen, and body text becomes unreadable at 375px.',
			severity: 'HIGH',
		},
		{
			title: 'Links pointing at localhost or nowhere',
			desc: 'Navigation and footer links written during development still point at local paths, placeholder anchors, or routes that were renamed later. Each one is a dead end for a visitor.',
			severity: 'HIGH',
		},
		{
			title: 'Missing titles and descriptions',
			desc: 'Metadata changes nothing visible on the page, so it is the first thing skipped. The result is a site that appears in Google as “Untitled” or with a fragment of code as its description.',
			severity: 'MEDIUM',
		},
		{
			title: 'Text you cannot read against its background',
			desc: 'Colour choices that look intentional in a design pass often fail real contrast thresholds — light grey on white, or a button label nearly the same colour as its button.',
			severity: 'MEDIUM',
		},
	],
	step1: 'Any publicly accessible page — a custom domain or wherever you deployed it.',
	faqs: [
		{
			q: 'Does QAlaunch work on a site built with Claude?',
			a: 'Yes. QAlaunch works on any publicly accessible website regardless of how it was built or what it was deployed on — it opens your live URL in a real browser and reports what a visitor actually experiences.',
		},
		{
			q: 'Claude wrote clean code. Why would anything be broken?',
			a: 'Most of what QAlaunch finds is not a coding mistake. It is the gap between code that is correct and a site that works for a stranger: a form wired to nothing, placeholder text left in, a layout never checked at phone width, links renamed in a later prompt. None of that produces an error.',
		},
		{
			q: 'Can I just ask Claude to check it instead?',
			a: 'Claude can review the code it can see; it cannot open your deployed site in a real browser, render it at 375px, click every link, or watch what happens on submit. QAlaunch does that against the live URL and hands the findings back in plain English — which you can then paste straight back into Claude as a fix list.',
		},
		{
			q: 'Do I need to share my code or repository?',
			a: 'No. Paste your public URL and the audit runs entirely from the outside, like any visitor. No repository access, nothing installed, and your site is never modified.',
		},
		{
			q: 'What does it cost?',
			a: 'The free scan shows your top issues with no signup. Full reports are one-time purchases from $9 (single page) to $59 (up to 10 pages). No subscription.',
		},
	],
	midCtaHeading: 'Check the site Claude built for you',
	bottomCtaHeading: 'Get a fix list you can paste back into Claude',
	bottomCtaButton: 'Audit My Website Free →',
	related: [
		{ href: '/blog/vibe-coding-website-bugs', label: '9 bugs every AI-built site ships with' },
		{ href: '/blog/contact-form-not-working', label: 'why contact forms fail silently' },
	],
	heroNote: 'Free · No signup · Results in ~2 min',
}

export const PLATFORMS: PlatformConfig[] = [BASE44, REPLIT, V0, CLAUDE]
