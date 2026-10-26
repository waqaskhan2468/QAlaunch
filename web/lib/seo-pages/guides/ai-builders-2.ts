import type { FixGuide } from '../types'

/** v0, Replit, Bubble, Framer and Cursor/Claude Code fixes. */
export const GUIDES: FixGuide[] = [
	// ───────────────────────────── v0 ─────────────────────────────
	{
		platform: 'v0',
		problem: 'deployed-site-looks-different-from-preview',
		query: "v0 preview doesn't match deployment",
		title: 'v0 Deployed Site Looks Different From Preview',
		description:
			'Your v0 preview looks right but the Vercel deployment has missing styles or a broken layout. Find the duplicate CSS, config or cache that causes it.',
		h1: "v0 preview doesn't match the deployed site: how to fix it",
		answer:
			'When a v0 preview looks right but the deployed Vercel site is unstyled or laid out differently, the project usually has two globals.css files and app/layout.tsx imports the wrong one, or two PostCSS/Tailwind config files are fighting each other. The v0 preview and the Vercel build do not resolve files in exactly the same way, so a conflict that is invisible in one shows up in the other. Keep one stylesheet and one config of each kind, then redeploy without the build cache.',
		symptom:
			'In the v0 chat the page looks finished. On the vercel.app address or your own domain the same page shows plain serif text, buttons with no colour, cards stacked in a single column, or spacing that is completely off. Sometimes only one colour or one component is different, which makes it look like a design bug rather than a build problem.',
		causes: [
			{
				title: 'Two globals.css files, and the layout imports the wrong one',
				body: 'v0 sometimes creates app/globals.css and styles/globals.css in the same project. The preview may pick up the one with your Tailwind layers while the production build follows the import in app/layout.tsx to the other, nearly empty file. This is the one cause Vercel staff confirmed in their own investigation thread.',
			},
			{
				title: 'Duplicate PostCSS or Tailwind config files',
				body: 'A project that has both postcss.config.js and postcss.config.mjs, or an old tailwind.config.ts next to a Tailwind v4 setup that expects configuration inside the CSS file, can build with the wrong one. The result is a stylesheet that compiles but is missing most of its utility classes.',
			},
			{
				title: 'A stale build cache on Vercel',
				body: 'Vercel reuses build output between deployments to save time. In a few community reports a config change did not take effect until the project was rebuilt from scratch, so the old, broken CSS kept being served.',
			},
			{
				title: 'Something on the live page blocks the stylesheet',
				body: 'If the CSS file itself returns a 404, or a script error stops client-side components from mounting, the page looks broken even though the code is fine. This is why Vercel staff ask for the browser console and network tab first.',
			},
		],
		steps: [
			'Open the deployed page, press F12, and look at the Network tab filtered to CSS. Note whether the stylesheet under /_next/static/css/ loads with status 200 and how large it is. A tiny file points to the wrong globals.css; a 404 points to a build or path problem.',
			'In v0, open the code view and search the file tree for globals.css. If there are two, decide which one holds your @tailwind or @import "tailwindcss" lines and theme variables, and delete the other.',
			'Open app/layout.tsx and check the stylesheet import at the top. It must point at the file you kept, for example ./globals.css when it sits in app/, or ../styles/globals.css when it sits in styles/.',
			'Look in the project root for more than one postcss.config or tailwind.config file. Keep the one that matches the Tailwind version in package.json and remove the rest.',
			'Push the change, then in the Vercel dashboard open Deployments, choose the latest deployment, click Redeploy and untick Use existing Build Cache so the CSS is rebuilt from nothing.',
			'If the page still differs, duplicate the v0 project and deploy the copy. A clean copy that looks right means the original deployment pipeline was holding on to something old.',
		],
		prompt:
			"The deployed site's styling differs from the v0 preview. Find every globals.css, postcss.config and tailwind.config file in the project. Keep a single correct one of each for the Tailwind version in package.json, make sure app/layout.tsx imports the globals.css you kept, delete the duplicates, and list exactly which files you removed or changed.",
		verify: [
			'Open the production URL in a private window at desktop width and at phone width and compare it with the v0 preview side by side.',
			'In DevTools Network, confirm every CSS request returns 200 and the main stylesheet is a reasonable size, not a few hundred bytes.',
			'Reload with the Console open and confirm no red errors appear before the page finishes rendering.',
		],
		scanFlags: [
			'Desktop and 390px phone screenshots of the live page, so an unstyled or collapsed layout is visible next to what you expected.',
			'Failed network requests for stylesheets or scripts, with the URL and status code.',
			'JavaScript console errors that stop components from rendering.',
			'Horizontal overflow at phone width when missing utility classes leave elements at their full desktop size.',
		],
		faqs: [
			{
				q: 'Why does it look right in v0 but not on Vercel?',
				a: 'The v0 preview is a fast development render, while Vercel runs a full production build. Duplicate files, import paths and cached config are resolved differently between the two, so the same code can produce different CSS.',
			},
			{
				q: 'Will asking v0 to fix the styling help?',
				a: 'Only if you tell it what is wrong. Asking it to restyle the page often adds more CSS on top of the conflict. Point it at the duplicate files instead, using the prompt on this page.',
			},
			{
				q: 'Do I lose anything by redeploying without the build cache?',
				a: 'No. The build just takes longer because dependencies and assets are processed again. Your code, domains and environment variables stay the same.',
			},
		],
		sources: [
			{ label: 'Vercel Community: v0 preview does not match Vercel deployment', url: 'https://community.vercel.com/t/investigating-v0-preview-doesnt-match-vercel-deployment/12440' },
			{ label: 'Vercel Community: deployed layout crashed, fine in v0 preview', url: 'https://community.vercel.com/t/deployed-site-layout-crashed-on-vercel-works-fine-in-v0-preview/12399' },
			{ label: 'Vercel Community: deploy is different from v0 preview', url: 'https://community.vercel.com/t/deploy-is-different-from-v0-preview/21533' },
		],
		related: ['v0/application-error-client-side-exception', 'v0/images-not-loading-after-deploy'],
		updated: '2026-10-26',
	},
	{
		platform: 'v0',
		problem: 'application-error-client-side-exception',
		query: 'v0 application error a client-side exception has occurred',
		title: 'v0 Application Error: Client-Side Exception',
		description:
			'Your deployed v0 app shows "Application error: a client-side exception has occurred". How to read the real error and fix the usual production causes.',
		h1: 'v0 "Application error: a client-side exception has occurred": the fix',
		answer:
			'This message is Next.js telling you that a React component crashed in the visitor’s browser and nothing caught it. On v0 projects the crash is most often caused by an environment variable that exists in the v0 preview but not in the Vercel Production environment, by code that touches window or localStorage during render, or by auth code that assumes a user or session is always there. The browser console on the live page names the real error; fix that, then add an error boundary so a future crash shows a friendly message instead of a white screen.',
		symptom:
			'The page loads for a moment, then goes white with one line of black text: "Application error: a client-side exception has occurred (see the browser console for more information)". It often happens right after signing in, on a dashboard page, or only on the deployed site while the v0 preview keeps working.',
		causes: [
			{
				title: 'A variable is missing in Production',
				body: 'Supabase, Firebase, Stripe and similar clients need a URL and key. If they are set in v0 but not in Vercel under Settings > Environment Variables for the Production environment, the client is created with undefined values and the first call throws.',
			},
			{
				title: 'Browser-only code runs during rendering',
				body: 'Reading window, document or localStorage at the top of a component works in a client-only preview but breaks when Next.js renders on the server and then hydrates. Hydration mismatches can also surface as this error.',
			},
			{
				title: 'Auth or data code assumes a value exists',
				body: 'A line like user.profile.name crashes when the session has not loaded yet, or when a real visitor has no profile row. In the preview you are usually signed in with complete test data, so the crash never shows.',
			},
		],
		steps: [
			'Open the failing page on the live URL, press Ctrl+Shift+I (Cmd+Option+I on a Mac), choose Console and reload. Copy the first red error in full, including the file and line it mentions.',
			'If the error mentions undefined, a URL, a key or a client such as supabaseUrl is required, open Vercel > your project > Settings > Environment Variables and confirm every variable the app uses is ticked for Production. Variables read in the browser must start with NEXT_PUBLIC_.',
			'After adding or changing a variable, redeploy. Existing deployments keep the values they were built with, so the fix does not apply until a new build runs.',
			'If the error mentions window, document, localStorage or hydration, move that code into a useEffect or behind a typeof window check so it only runs in the browser.',
			'For crashes after login, open Vercel > Logs (runtime logs) while reproducing the problem to see whether a server request failed first and left the page with empty data.',
			'Paste the exact console error into v0 with the prompt below, and ask for an app/error.tsx boundary so any future crash shows a message and a retry button.',
		],
		prompt:
			"On the deployed site I get 'Application error: a client-side exception has occurred'. Here is the browser console error: [paste it]. Fix the cause. Guard any window, document or localStorage access so it only runs in the browser, handle the case where the user or their data is not loaded yet, add an app/error.tsx error boundary with a friendly message and a retry button, and list any environment variables that must be set for Production in Vercel.",
		verify: [
			'Load the page signed out and signed in, in a private window, with the Console open. There should be no uncaught errors.',
			'Throw a test error temporarily or disconnect your network mid-load to confirm the error boundary shows a readable message instead of a blank page.',
		],
		scanFlags: [
			'The full-page "Application error" screen captured in the desktop and phone screenshots.',
			'Uncaught JavaScript exceptions from the console, with the message text that points to the cause.',
			'Failed requests to your API or database host that leave components with nothing to render.',
			'It loads pages as a signed-out visitor only, so a crash that happens after login has to be checked by hand.',
		],
		faqs: [
			{
				q: 'Why does it work in the v0 preview but not on my domain?',
				a: 'The preview has the variables you added in v0 and runs in a forgiving development mode. The deployed site uses the variables stored in Vercel for Production and a strict production build, so missing values and hydration problems only appear there.',
			},
			{
				q: 'Where do I find the real error message?',
				a: 'In the browser console of the live page, not in v0. Production builds shorten messages, so if you see a minified React error with a link, open the link: it expands the code into a readable sentence.',
			},
			{
				q: 'Is an error boundary a fix?',
				a: 'No, it is a safety net. It stops a crash from blanking the whole page, but you still need to fix the code or setting that throws the error in the first place.',
			},
		],
		sources: [
			{ label: 'Vercel Community: client-side exceptions in v0 projects after deployment', url: 'https://community.vercel.com/t/fixing-client-side-exceptions-in-next-js-v0-projects-after-deployment/31853' },
			{ label: 'Vercel Community: application error, a client-side exception has occurred', url: 'https://community.vercel.com/t/application-error-a-client-side-exception-has-occurred/25813' },
			{ label: 'Vercel Community: missing environment variables in v0', url: 'https://community.vercel.com/t/missing-environment-variables-in-v0/28197' },
		],
		related: ['v0/deployed-site-looks-different-from-preview', 'v0/contact-form-email-not-sending'],
		updated: '2026-10-26',
	},
	{
		platform: 'v0',
		problem: 'title-says-v0-app',
		query: 'v0 app title change',
		title: 'v0 Site Title Says v0 App? Change It',
		description:
			'Your browser tab and Google result say "v0 App" and "Created with v0". How to set a real title, description, favicon and share preview in a v0 project.',
		h1: 'How to change the "v0 App" title and "Created with v0" description',
		answer:
			'A v0 project ships with default metadata in app/layout.tsx: the title "v0 App" and the description "Created with v0". Replace that metadata export with your own site name and description, add a metadata export to each page so every URL has its own title, and swap the default icon in the app folder. The changes show on the deployed site after the next deployment, not always in the v0 preview window.',
		symptom:
			'The browser tab reads "v0 App". When you paste your link into WhatsApp, Slack or LinkedIn the preview card says "Created with v0", or shows no image at all. Google, once it has crawled the site, shows the same default text under your domain, which looks unfinished to anyone searching for your business.',
		causes: [
			{
				title: 'The template metadata was never replaced',
				body: 'Next.js reads export const metadata from app/layout.tsx and puts it in the head of every page. v0 fills it with placeholder values, and nothing reminds you to change them before you publish.',
			},
			{
				title: 'Pages have no metadata of their own',
				body: 'Without a metadata export in each route’s page.tsx, every URL inherits the layout values. Your pricing page, about page and blog posts all end up with the same title, which makes them hard to tell apart in search results.',
			},
			{
				title: 'No Open Graph image or real favicon',
				body: 'Link previews need og:title, og:description and og:image. The default favicon and missing share image are separate files in the app folder, so fixing the title alone does not fix how your link looks when shared.',
			},
		],
		steps: [
			'Open app/layout.tsx in the v0 code view and find export const metadata. Change title to your business name and description to one plain sentence about what you offer.',
			'Turn title into an object with a default and a template, so each page title is followed by your brand name automatically. Next.js documents this as title.template in the Metadata API.',
			'Add export const metadata to each page.tsx with a page-specific title and description. For dynamic routes such as blog posts, use generateMetadata to build them from the post data.',
			'Add an openGraph block with your site name, a description and a 1200x630 image, or drop an opengraph-image.png file into the app folder so Next.js links it for you.',
			'Replace app/favicon.ico or app/icon.png with your own icon. Delete any leftover icon files from the template so the browser does not pick the wrong one.',
			'Deploy, then check the live site rather than the v0 preview, which may keep showing the old title.',
		],
		prompt:
			"Replace the default 'v0 App' title and 'Created with v0' description. In app/layout.tsx set a default title of 'My Business' and a title template that adds ' | My Business' after each page title, a one-sentence description, Open Graph and Twitter card tags with a 1200x630 image, and my favicon. Then give every page its own title and description through a metadata export, and list each page with the title you set.",
		verify: [
			'Open each important page on the live domain and read the tab title. Then use View Page Source and search for og:title and description.',
			'Paste the URL into a messaging app or a link preview checker and confirm the card shows your title, description and image.',
			'In Google Search Console, use URL Inspection on the homepage and request indexing so Google picks up the new text sooner.',
		],
		scanFlags: [
			'A page title or meta description that still reads "v0 App" or "Created with v0".',
			'Missing Open Graph tags, so shared links have no proper preview.',
			'A missing or default favicon.',
		],
		faqs: [
			{
				q: 'I changed the title but the tab still says v0 App. Why?',
				a: 'Either the change has not been deployed yet, or you are looking at the v0 preview, which can keep the old head. Open the production URL in a private window after the deployment finishes.',
			},
			{
				q: 'How long until Google shows the new title?',
				a: 'It updates the next time Google recrawls the page, which can take days. Requesting indexing in Search Console can speed that up, and Google may still rewrite titles it thinks do not match the page.',
			},
			{
				q: 'Why does WhatsApp still show the old preview?',
				a: 'Messaging apps cache link previews. Facebook’s Sharing Debugger can force a refresh for Facebook and Instagram; other apps refresh on their own schedule.',
			},
		],
		sources: [
			{ label: 'Vercel Community: change default title and description', url: 'https://community.vercel.com/t/change-default-title-and-decription/4506' },
			{ label: 'Vercel Community: change a browser tab title in v0', url: 'https://community.vercel.com/t/how-to-change-a-browser-tab-title-in-v0/22033' },
			{ label: 'Next.js docs: generateMetadata and the Metadata API', url: 'https://nextjs.org/docs/app/api-reference/functions/generate-metadata' },
		],
		related: ['v0/visitors-see-vercel-login', 'v0/images-not-loading-after-deploy'],
		updated: '2026-10-26',
	},
	{
		platform: 'v0',
		problem: 'visitors-see-vercel-login',
		query: 'vercel site asks visitors to log in',
		title: 'Visitors See a Vercel Login on Your v0 Site',
		description:
			'People who open your link get a Log in to Vercel page instead of your site. Why Vercel Authentication does this and which link or setting fixes it.',
		h1: 'Vercel site asks visitors to log in: why and how to make it public',
		answer:
			'Visitors see a Vercel login page because Vercel Authentication, part of Deployment Protection, is switched on and the link you shared is a protected URL. With the default Standard Protection, preview deployments and the long per-deployment production URLs require a Vercel login, while your production domains stay public. Share your custom domain or the main project domain from Settings > Domains, or change the protection setting if you really want deployment URLs public.',
		symptom:
			'You send someone the link from v0 or from the Vercel deployment page. They land on a vercel.com screen asking them to log in, or, if they already have a Vercel account, a page saying they need to request access. You never see it yourself because you are logged in to Vercel, so the site looks fine on your machine.',
		causes: [
			{
				title: 'You shared a deployment URL, not the production domain',
				body: 'Every deployment gets a unique address such as project-abc123-team.vercel.app. Under Standard Protection those addresses are protected even when they belong to a production deployment; only the domains assigned to production, like yourproject.vercel.app or your own domain, are open to everyone.',
			},
			{
				title: 'Vercel Authentication covers more than you expected',
				body: 'The setting is chosen per project in Settings > Deployment Protection. If it is set to All Deployments, your production domains require login too, and every visitor and search engine sees the login wall.',
			},
			{
				title: 'Your browser hides the problem from you',
				body: 'Vercel sets a cookie when you authenticate to a deployment, so it lets you straight through. Testing in your normal browser window will never show what a stranger sees.',
			},
		],
		steps: [
			'Open the exact link you shared in a private window where you are not logged in to Vercel. If you see the login or request-access screen, you have confirmed the cause.',
			'In the Vercel dashboard, open the project and go to Settings > Domains. Copy the production domain listed there, either your custom domain or the short yourproject.vercel.app address, and share that instead.',
			'If you only need one person to see a preview, open the deployment, use Share and create a Shareable Link. It lets anyone with that link past the protection for that deployment without changing the project setting.',
			'If you want deployment URLs public as well, go to Settings > Deployment Protection, find Vercel Authentication, and choose a narrower scope or turn it off, then save.',
			'Remember that turning Vercel Authentication off makes every existing deployment of the project public, including old previews that may contain unfinished work or test data.',
			'Re-test the shared link in a private window on your phone over mobile data before sending it again.',
		],
		verify: [
			'The production domain opens your homepage, not vercel.com, in a private window that has never logged in to Vercel.',
			'A colleague without a Vercel account can open the link on their own device.',
		],
		scanFlags: [
			'A login wall or redirect to vercel.com on the scanned URL instead of your homepage, shown in the screenshots.',
			'A 401 response on the page the scan was asked to load.',
			'Missing title and description on the scanned page, because the scan is reading the Vercel login screen rather than your site.',
		],
		faqs: [
			{
				q: 'Can Google index my site if it shows a Vercel login?',
				a: 'No. Search engines are anonymous visitors, so they see the login page too. Your production domains must be public before Google can crawl them.',
			},
			{
				q: 'Is it safe to turn Deployment Protection off?',
				a: 'It makes every deployment of the project public, including previews built from unfinished branches. If you only need the live site public, keep Standard Protection and share the production domain.',
			},
			{
				q: 'Why does the v0 share link behave differently from the deployed site?',
				a: 'A link into v0 itself opens the v0 chat or preview, which follows v0’s own sharing settings. Your website is the deployment on Vercel, so share its production domain rather than an editor link.',
			},
			{
				q: 'Can I keep the site private but let a client review it?',
				a: 'Yes. Leave protection on and send the client a Shareable Link for the deployment, or approve their access request if they have a Vercel account. On the Hobby plan only one external user can be granted access, so a Shareable Link is often simpler.',
			},
		],
		sources: [
			{ label: 'Vercel docs: Vercel Authentication', url: 'https://vercel.com/docs/deployment-protection/methods-to-protect-deployments/vercel-authentication' },
			{ label: 'Vercel Community: can a deployed website only be visible to me', url: 'https://community.vercel.com/t/can-a-deployed-website-only-be-visible-to-me/21658' },
			{ label: 'Vercel KB: locking down deployments', url: 'https://vercel.com/kb/guide/locking-down-deployments' },
		],
		related: ['v0/title-says-v0-app', 'v0/deployed-site-looks-different-from-preview'],
		updated: '2026-10-26',
	},
	{
		platform: 'v0',
		problem: 'images-not-loading-after-deploy',
		query: 'v0 images not showing after deploy',
		title: 'v0 Images Not Showing After Deploy? Fix It',
		description:
			'Images show in the v0 preview but are broken on the live Vercel site. Check remotePatterns, file paths, letter case and temporary image URLs.',
		h1: 'v0 images not showing after deploy: the causes and fixes',
		answer:
			'Images that appear in the v0 preview but break on Vercel are usually remote images the Next.js optimizer is not allowed to fetch, images that point at a temporary or placeholder URL instead of a file in /public, or paths whose letter case does not match the file name. Move your own images into /public, list any remote hosts in images.remotePatterns in next.config, and check that every path matches the file name exactly.',
		symptom:
			'On the live site you see empty boxes, alt text where a picture should be, or a broken image icon. In the Network tab the requests go to /_next/image and come back as 400, 404 or 502, sometimes with the code OPTIMIZED_EXTERNAL_IMAGE_REQUEST_UNAUTHORIZED.',
		causes: [
			{
				title: 'The remote host is not allowed for next/image',
				body: 'The Image component sends remote pictures through Vercel’s optimizer, which only fetches from hosts listed in images.remotePatterns. Anything else is refused, so the image works as a plain img tag in some previews but fails through /_next/image in production.',
			},
			{
				title: 'Images point at a temporary or placeholder source',
				body: 'v0 often uses placeholder services or uploads that live only inside the chat while you design. Those URLs are not part of your repository and can expire or be blocked once the site is deployed.',
			},
			{
				title: 'Path or letter case does not match the file',
				body: 'Vercel builds on Linux, where Hero.webp and hero.webp are different files. A path that works on a Mac or in the preview can 404 in production because of one capital letter.',
			},
		],
		steps: [
			'Open the live page, press F12, choose Network and filter by Img. Click a failed request and note the status code and the original image URL inside the url= parameter.',
			'For each image you own, download it, put it in the public folder (for example public/images/hero.webp) with a lowercase file name, and reference it as /images/hero.webp.',
			'For images that must stay remote, such as a CMS or Supabase Storage bucket, add the host to images.remotePatterns in next.config with protocol https, the exact hostname and a pathname pattern.',
			'Search the code for placeholder.svg, via.placeholder or other demo image services and replace them with real files.',
			'Redeploy, then reload the live page with the cache disabled in DevTools to confirm the new paths load.',
			'Only if one stubborn remote image still fails, add the unoptimized prop to that Image as a temporary workaround while you investigate. It skips resizing, so the visitor downloads the full file.',
		],
		prompt:
			'Some images are broken on the deployed site but work in the preview. Move every image the site owns into /public with lowercase, hyphenated file names and update all references. Add any remaining remote image hosts to images.remotePatterns in next.config. Replace placeholder image URLs with real files, give every image meaningful alt text, and list every image path you changed.',
		verify: [
			'In DevTools Network filtered to Img, every image request on the key pages returns 200.',
			'Check the same pages at phone width, where responsive images may request different sizes from the optimizer.',
		],
		scanFlags: [
			'Broken images on the page, with the image URL that failed.',
			'Failed requests to /_next/image or a remote host, with the status code (400, 404 or 502).',
			'Images with missing alt text, picked up by the accessibility checks.',
			'Heavy images flagged by the PageSpeed performance audit if you fall back to unoptimized files.',
		],
		faqs: [
			{
				q: 'Why do images work locally but not on Vercel?',
				a: 'Local development serves files more leniently: macOS ignores letter case and the dev server can load remote images without the same checks. Vercel builds on Linux and runs the production image optimizer, which is stricter about both.',
			},
			{
				q: 'Should I just use unoptimized on every image?',
				a: 'No. It works, but every visitor downloads the full-size file, which slows the page on phones. Fix the remotePatterns entry or move the images into /public instead.',
			},
			{
				q: 'What does OPTIMIZED_EXTERNAL_IMAGE_REQUEST_UNAUTHORIZED mean?',
				a: 'Vercel’s optimizer refused to fetch an external image, usually because its host is not allowed in your images configuration. Check the hostname in the error against your remotePatterns entry character by character.',
			},
		],
		sources: [
			{ label: 'Vercel Community: remote images not loading on deployment', url: 'https://community.vercel.com/t/remote-images-not-loading-on-deployment/4127' },
			{ label: 'Vercel Community: images not displaying after deploying to Vercel', url: 'https://community.vercel.com/t/images-not-displaying-after-deploying-to-vercel/26760' },
			{ label: 'Vercel Community: images will not load for Next.js project', url: 'https://community.vercel.com/t/images-wont-load-for-next-js-project/1167' },
		],
		related: ['v0/deployed-site-looks-different-from-preview', 'v0/title-says-v0-app'],
		updated: '2026-10-26',
	},
	{
		platform: 'v0',
		problem: 'contact-form-email-not-sending',
		query: 'v0 contact form not sending email',
		title: 'v0 Contact Form Not Sending Email? Fix It',
		description:
			'Your v0 contact form says thanks, but no email arrives. The Resend key, from address and silent server action errors behind it, and how to fix them.',
		h1: 'v0 contact form not sending email: what to check',
		answer:
			'A v0 contact form usually sends mail through a server action that calls Resend. If no email arrives, the RESEND_API_KEY is missing from the Vercel Production environment, the from address is still onboarding@resend.dev (which only delivers to your own Resend account email), or the action fails and the form shows success anyway. Add the key for Production, verify your domain in Resend and send from it, and make the form show an error when the send fails.',
		symptom:
			'Someone fills in the form on your live site, presses Send and sees a thank-you message. Nothing reaches your inbox. When you test it with your own address it may work, which hides the problem until a real customer writes in. Vercel function logs, if you look, may show a 403 from Resend.',
		causes: [
			{
				title: 'The API key is not set for Production',
				body: 'Variables you add in v0 do not automatically exist in every Vercel environment. Without RESEND_API_KEY in Production, the server action calls Resend with no key and the request is rejected.',
			},
			{
				title: 'The from address is the Resend test domain',
				body: 'Resend lets you send from onboarding@resend.dev without verifying anything, but only to the email address on your Resend account. Any other recipient gets a 403 saying you can only send testing emails to your own address.',
			},
			{
				title: 'The form ignores the result of the send',
				body: 'Generated forms often show the success state as soon as the button is pressed, or catch every error and return nothing. The visitor is told it worked even when the server action threw.',
			},
		],
		steps: [
			'Submit the live form yourself, then open Vercel > your project > Logs and filter for the function or route that handles it. Note any error from Resend, especially a 401 or 403.',
			'In Vercel > Settings > Environment Variables, add RESEND_API_KEY with the Production environment ticked. Redeploy so the new build can read it.',
			'In the Resend dashboard open Domains, add your domain, and create the DNS records it shows at your DNS provider. Wait until the domain shows as verified; confirm the current record types in Resend’s docs because they can change.',
			'Change the from address in the server action to one on your verified domain, such as hello@yourdomain.com, and set reply_to to the visitor’s email so you can answer directly.',
			'Make the action return a clear result, for example ok true or ok false with an error message, and have the form show the success message only when ok is true.',
			'Send a test from the live site to an address that is not your Resend login, and check spam as well as the inbox.',
		],
		prompt:
			"Make my contact form send email through a server action using Resend with process.env.RESEND_API_KEY, from 'Website <hello@mydomain.com>' to me@mydomain.com, with reply_to set to the visitor's email. Validate the fields on the server. Return { ok: true } on success and { ok: false, error } on failure, show the error in the form, and show the thank-you message only when ok is true.",
		verify: [
			'A message sent from the live site to a different mailbox arrives, with your domain as the sender and the visitor as reply-to.',
			'Temporarily remove the key in a preview deployment and confirm the form now shows an error instead of a false thank-you.',
			'Submitting the form empty shows a validation message on each required field.',
		],
		scanFlags: [
			'Whether submitting the form empty shows any validation feedback, or the form stays silent.',
			'JavaScript console errors and failed requests on the page that holds the form.',
			'The scan does not fill in real data or check your inbox, so delivery itself must be confirmed with a manual test send.',
		],
		faqs: [
			{
				q: 'It works when I send to myself. Why not for others?',
				a: 'That is the Resend test domain at work. onboarding@resend.dev only delivers to the email on your Resend account, so you see your own tests arrive while every other recipient is refused.',
			},
			{
				q: 'Do I need a paid Resend plan?',
				a: 'Resend has a free tier that covers a typical contact form. Check its pricing page for the current sending limits before you rely on it for anything high volume.',
			},
			{
				q: 'Can I use a Gmail address as the from address?',
				a: 'No. You can only send from domains you have verified in Resend, and you cannot verify gmail.com. Use an address on your own domain and put your Gmail in the to field.',
			},
		],
		sources: [
			{ label: 'Resend: 403 error when using the resend.dev domain', url: 'https://resend.com/docs/knowledge-base/403-error-resend-dev-domain' },
			{ label: 'Vercel Academy: email the owner', url: 'https://vercel.com/academy/build-and-launch-with-ai/email-the-owner' },
			{ label: 'Vercel Community: Resend email in v0 is not working', url: 'https://community.vercel.com/t/resend-email-in-v0-is-not-working/32966' },
		],
		related: ['v0/application-error-client-side-exception'],
		updated: '2026-10-26',
	},

	// ─────────────────────────── Replit ───────────────────────────
	{
		platform: 'replit',
		problem: 'app-stops-when-tab-closed',
		query: 'replit app stops when I close tab',
		title: 'Replit App Stops When You Close the Tab',
		description:
			'Your Replit app works while the editor is open, then the link dies. Why the replit.dev URL is temporary and how to publish a URL that stays up.',
		h1: 'Replit app stops when I close the tab: how to keep it running',
		answer:
			'The link you shared is almost certainly the development URL, the one ending in replit.dev. Replit says development URLs are only live while you actively work on the app, are private by default, and can change when you reopen the project. To keep a site running for visitors, publish it from the Publishing pane and share the replit.app address or your custom domain instead.',
		symptom:
			'While the Replit workspace is open, the preview link works on your phone and for friends. A while after you close the tab, the same link shows an error, asks people to sign in, or stops responding. The next day the address in the preview may even be different from the one you sent out.',
		causes: [
			{
				title: 'You shared the development URL',
				body: 'The replit.dev address is meant for testing while you build. It depends on your workspace being active, it requires authentication by default, and Replit does not promise it stays the same between sessions.',
			},
			{
				title: 'The app was never published',
				body: 'Publishing creates a separate production copy of the app with its own URL and its own secrets. Until you do that, there is no copy that runs independently of your editor.',
			},
			{
				title: 'The deployment type does not match the app',
				body: 'Autoscale deployments scale to zero when idle, which is fine for websites but not for a bot or worker that must stay connected all the time. Those need a Reserved VM.',
			},
		],
		steps: [
			'Check the link you shared. If it contains replit.dev, it is the development URL and will not stay up on its own.',
			'Click Publish in the workspace and pick a deployment type in the Publishing pane: Static for plain HTML and front-end builds, Autoscale for most web apps with a server, Reserved VM for always-on servers, bots and websocket apps, Scheduled for jobs that run on a timer.',
			'Before publishing, copy every secret the app needs into the deployment secrets. Development secrets do not carry over to the published app.',
			'When the publish finishes, copy the production URL from the Publishing pane (it ends in replit.app) or connect your own domain under Publishing > Domains.',
			'Replace the old replit.dev link everywhere you posted it: social bios, emails, QR codes and any webhooks that pointed at it.',
			'Check pricing for the deployment type you chose in Replit’s current docs, since plans and included usage change.',
		],
		prompt:
			'Prepare this app for publishing on Replit. Make sure the server listens on 0.0.0.0 and the port from the PORT environment variable, that the homepage responds within a couple of seconds, and that any file data the app writes is stored in the database instead, because the published file system resets on each publish. List every secret the published app needs.',
		verify: [
			'Close Replit completely, wait half an hour, then open the replit.app URL or your domain in a private window on your phone over mobile data.',
			'Open the same URL the next day and confirm the address and content have not changed.',
		],
		scanFlags: [
			'A sign-in screen, error page or unreachable site on the scanned URL instead of your homepage.',
			'A missing title and description, which happens when the scan is reading a Replit holding or login page rather than your app.',
			'Slow server response on the first request after an idle period, from the PageSpeed audit.',
		],
		faqs: [
			{
				q: 'What happened to Always On?',
				a: 'Replit replaced the old Always On toggle with Deployments, now called Publishing. Older blog posts that tell you to ping your repl with an uptime monitor describe a setup that no longer applies to published apps.',
			},
			{
				q: 'Is Autoscale or Reserved VM right for a website?',
				a: 'For a normal website or web app, Autoscale is usually enough: it scales to zero when idle and wakes on the next request. Choose Reserved VM when something must run continuously, such as a Discord bot or a websocket server.',
			},
			{
				q: 'Will my data survive republishing?',
				a: 'Files the app writes to disk on a published deployment are reset on each publish. Keep anything that must persist in Replit’s database or another external store.',
			},
		],
		sources: [
			{ label: 'Replit docs: development URLs', url: 'https://docs.replit.com/core-concepts/project-editor/app-setup/development-urls.md' },
			{ label: 'Replit docs: deployment and publishing help', url: 'https://docs.replit.com/help/deployment-and-publishing.md' },
			{ label: 'Replit docs: publishing troubleshooting', url: 'https://docs.replit.com/build/troubleshooting.md' },
		],
		related: ['replit/works-in-preview-not-published', 'replit/slow-first-load-autoscale'],
		updated: '2026-10-26',
	},
	{
		platform: 'replit',
		problem: 'works-in-preview-not-published',
		query: 'replit deployment works in dev but not production',
		title: 'Replit App Works in Preview, Not Published',
		description:
			'Your Replit app works in the preview but the published site errors, shows no data or will not log in. Secrets, database and localhost causes, fixed.',
		h1: 'Replit works in dev but not in production: the real causes',
		answer:
			'When a Replit app works in the preview but breaks once published, the published copy is missing something the development copy has. Usually that is a secret, because development and deployment secrets are separate stores; a DATABASE_URL that still points at the development database; or a hard-coded localhost address. Add the missing values to the deployment secrets, point DATABASE_URL at production, replace localhost with relative paths, and publish again.',
		symptom:
			'The published replit.app site loads but lists are empty, sign-in fails, a payment button does nothing, or every API call errors. The same actions work perfectly in the workspace preview. Sometimes the published site only shows an error page with no detail.',
		causes: [
			{
				title: 'A secret exists in development only',
				body: 'Replit keeps development secrets and deployment secrets apart, and changing one does not touch the other. An API key added in the editor’s Secrets pane is undefined in the published app until you add it to the deployment.',
			},
			{
				title: 'The database connection points at the wrong place',
				body: 'Replit’s docs say to check DATABASE_URL first when an app works in preview but fails published. If it targets the development database, or the production database has no tables or rows yet, pages render with nothing in them.',
			},
			{
				title: 'Hard-coded localhost URLs',
				body: 'Code that calls http://localhost:3000/api or 127.0.0.1 works inside the workspace, where the browser and server share a machine. In the published app the visitor’s browser tries to reach its own computer and the request fails.',
			},
			{
				title: 'Auth and payment redirects still list the dev address',
				body: 'OAuth providers, Supabase, Stripe and similar services only redirect to URLs you have allowed. If only the replit.dev address is listed, sign-in and checkout break on replit.app or your domain.',
			},
		],
		steps: [
			'Open the published site, press F12 and reproduce the problem. Note failed requests in the Network tab, especially any going to localhost, and the first red error in the Console.',
			'Open the Publishing pane, find the deployment, and read its logs from the three-dot menu. Look for undefined values, connection errors or missing modules.',
			'Compare the editor Secrets pane with the deployment secrets key by key. Add anything missing to the deployment secrets, then click Publish so the new values reach the live app.',
			'Check DATABASE_URL in the deployment secrets. Make sure it points at the production database and that the production database has its tables and any seed data the app needs.',
			'Search the code for localhost and 127.0.0.1 and replace those calls with relative paths such as /api/items or with a base URL read from an environment variable.',
			'Add the replit.app URL and your custom domain to the allowed redirect URLs in your auth and payment providers.',
		],
		prompt:
			'The published app fails but the preview works. Find every hard-coded localhost or 127.0.0.1 URL and replace it with a relative path or an environment variable. List every secret the app reads, and add a startup check that logs the names (not the values) of any required secrets that are missing, so the deployment logs show it clearly.',
		verify: [
			'Walk through the main flows on the published URL with DevTools open: load data, sign in, submit a form. No requests should go to localhost and none should fail.',
			'Read the deployment logs after a fresh publish and confirm the startup check reports no missing secrets.',
		],
		scanFlags: [
			'Failed network requests from the live page, including calls aimed at localhost or 127.0.0.1.',
			'JavaScript console errors on load, such as undefined configuration values.',
			'Empty sections or error states where content should appear, visible in the screenshots.',
			'It cannot open your deployment secrets or database, so it reports the symptoms a visitor gets rather than the missing value itself.',
		],
		faqs: [
			{
				q: 'I added the secret but the published app still fails. Why?',
				a: 'Deployment secret changes reach the live app when you publish again. Click Publish after editing them, then retest.',
			},
			{
				q: 'Why is my production database empty?',
				a: 'Development and production databases hold separate data. Publishing deploys your code and schema changes, not the test rows you created while building.',
			},
			{
				q: 'Why does a file the app saved disappear?',
				a: 'The published file system resets on every publish, so uploads or JSON files written to disk are lost. Store them in a database or object storage instead.',
			},
		],
		sources: [
			{ label: 'Replit docs: deployment and publishing help', url: 'https://docs.replit.com/help/deployment-and-publishing.md' },
			{ label: 'Replit docs: publishing troubleshooting', url: 'https://docs.replit.com/build/troubleshooting.md' },
			{ label: 'Replit forum: DATABASE_URL will not get saved for deployment', url: 'https://replit.discourse.group/t/database-url-wont-get-saved-for-deployment/6943' },
		],
		related: ['replit/publish-fails-health-check-port', 'replit/app-stops-when-tab-closed'],
		updated: '2026-10-26',
	},
	{
		platform: 'replit',
		problem: 'publish-fails-health-check-port',
		query: 'replit deployment failed health check',
		title: 'Replit Deployment Failed Health Check: Fix',
		description:
			'Replit publishing fails at the last step or the URL says the deployment could not be reached. Fix 0.0.0.0 binding, .replit ports and slow startup.',
		h1: 'Replit deployment failed health check: how to get it to publish',
		answer:
			'Before Replit puts a deployment live it sends a request to your homepage, and if the server does not answer in time on the expected address and port, publishing fails. The common causes are a server listening on localhost or 127.0.0.1 instead of 0.0.0.0, a [[ports]] block in .replit whose externalPort is not 80, a homepage that takes more than about five seconds to respond, or a process that exits instead of staying up. Fix the binding and port, make the homepage fast, and publish again.',
		symptom:
			'The publish runs through build and bundling, then fails on the final promotion step. Or it appears to succeed, but the replit.app URL shows "The deployment could not be reached" or hangs until it times out.',
		causes: [
			{
				title: 'The server only listens on localhost',
				body: 'A server bound to 127.0.0.1 accepts connections from inside its own container only. That works for the workspace preview, but Replit’s health check and your visitors arrive from outside, so they get no answer.',
			},
			{
				title: 'The .replit ports block is wrong',
				body: 'If .replit defines [[ports]], automatic port detection is turned off. The entry for your web server must map its localPort to externalPort 80, or the promotion step cannot find the app.',
			},
			{
				title: 'The homepage is too slow on startup',
				body: 'Replit’s docs say the health check can time out if the homepage takes longer than five seconds. Seeding a database, building a cache or calling a slow API before the server starts listening is enough to cause that.',
			},
			{
				title: 'The process does not keep running',
				body: 'A script that does its work and exits is not a web server. Replit restarts it, but there is never a server waiting for the health check request.',
			},
		],
		steps: [
			'Open Publishing > History, choose the failed attempt and read its logs. The first ERROR or FAILED line usually names the problem.',
			'Find where the server starts listening and change the host to 0.0.0.0 and the port to process.env.PORT, with a fallback for development. In Express that is app.listen(port, "0.0.0.0").',
			'Open .replit. If there is a [[ports]] section, make sure the web server’s localPort matches the port the app listens on and externalPort is 80, or remove the block so Replit detects the port itself.',
			'Move slow work out of startup. Start the server first, then run migrations, cache warm-ups or data imports in the background, or trigger them on first use.',
			'Confirm the run command in the Publishing pane starts the long-running server, not a one-off build or seed script.',
			'Publish again and watch the logs until the deployment is promoted, then open the URL in a private window.',
		],
		prompt:
			'Publishing on Replit fails the health check. Make the server listen on 0.0.0.0 using the PORT environment variable, make GET / respond in under a second by moving slow startup work to after the server is listening, check the [[ports]] config in .replit so the web port maps to externalPort 80, and confirm the run command starts a process that keeps running.',
		verify: [
			'The publish completes and the deployment shows as live in the Publishing pane.',
			'The replit.app URL starts showing content within a few seconds in a private window, including on the first load after a republish.',
		],
		scanFlags: [
			'The site failing to load or returning an error page on the scanned URL.',
			'Slow server response time on the homepage from the PageSpeed audit.',
			'Console errors and failed requests once the page does load, which point to startup problems the health check did not catch.',
		],
		faqs: [
			{
				q: 'Why does the preview work if the binding is wrong?',
				a: 'The workspace preview is more forgiving about how the server is reached. A published deployment is reached from outside the container, which only works when the server listens on 0.0.0.0.',
			},
			{
				q: 'Can I make the health check wait longer?',
				a: 'Replit’s docs describe the timeout but no setting to extend it. The reliable fix is to make the homepage answer quickly and do heavy work after the server is up.',
			},
			{
				q: 'My app is a static front end. Why is it failing?',
				a: 'Check the deployment type. A front-end-only build fits a Static deployment, which serves files without a server; an Autoscale deployment expects a process that listens on a port.',
			},
		],
		sources: [
			{ label: 'Replit docs: publishing troubleshooting', url: 'https://docs.replit.com/build/troubleshooting.md' },
			{ label: 'Replit forum: the deployment could not be reached', url: 'https://replit.discourse.group/t/the-deployment-could-not-be-reached-how-to-fix/8266' },
			{ label: 'Replit forum: publishing does not work', url: 'https://replit.discourse.group/t/publishing-does-not-work/8082' },
		],
		related: ['replit/works-in-preview-not-published', 'replit/slow-first-load-autoscale'],
		updated: '2026-10-26',
	},
	{
		platform: 'replit',
		problem: 'slow-first-load-autoscale',
		query: 'replit app slow to load',
		title: 'Replit App Slow to Load? Autoscale Cold Starts',
		description:
			'Your Replit app takes several seconds to show anything on the first visit. Why Autoscale cold starts happen and how to cut the wait or avoid it.',
		h1: 'Replit app slow to load: cold starts and how to fix them',
		answer:
			'If a published Replit app is slow mainly on the first visit after a quiet spell, that is an Autoscale cold start: Autoscale scales to zero when there is no traffic, and Replit says the next request can take a few seconds while an instance starts. Make startup as light as possible, use a Static deployment for sites that need no server, or move to a Reserved VM if the app must answer instantly at any time. If every load is slow, the problem is page weight, not the cold start.',
		symptom:
			'The first person to open the site in the morning stares at a blank tab for several seconds. A refresh straight after is fast. On a phone over mobile data the first visit feels broken, and some visitors leave before the page appears.',
		causes: [
			{
				title: 'Autoscale has scaled to zero',
				body: 'With no traffic, an Autoscale deployment keeps no instances running so you are not billed for idle time. The trade-off is that the next request waits for a new instance to boot and your server to start.',
			},
			{
				title: 'Startup does too much',
				body: 'Every cold start runs your whole boot sequence: installing nothing new, but loading large dependencies, connecting to databases and preparing caches. Heavy startup turns a short wake-up into a long one.',
			},
			{
				title: 'The page itself is heavy',
				body: 'Large JavaScript bundles and uncompressed images slow every visit, not just the first. Agent-built React apps often ship one big bundle and full-size photos.',
			},
		],
		steps: [
			'Measure before changing anything. Leave the site idle for half an hour, then load it in a private window with DevTools Network open and note the time to first byte for the document and the total load time. Repeat immediately to get a warm number.',
			'If only the cold number is slow, open the server entry file and defer anything not needed for the first request: database migrations, cache warm-ups, large SDK imports used on rare routes.',
			'If the site is plain HTML or a front-end build with no server-side code, switch it to a Static deployment in the Publishing pane, which serves files without booting a server.',
			'If the app needs a server and must respond quickly at all hours, switch the deployment to a Reserved VM, which keeps the app running. Check the current Reserved VM pricing in Replit’s docs first, since it bills for the time it runs.',
			'If even warm loads are slow, reduce page weight: convert images to WebP at the size they are displayed, lazy-load images below the fold, and split large routes so the homepage does not load the whole app.',
			'Republish and repeat the cold and warm measurements to confirm what changed.',
		],
		prompt:
			'Speed up the first load of this app. Make server startup fast by deferring any initialization not needed for the first request, lazy-load heavy routes and components, resize and convert images to WebP at their displayed size, lazy-load images below the fold, and remove unused dependencies. Report the bundle size before and after.',
		verify: [
			'After 30 or more idle minutes, the first load on a phone over mobile data shows content within a few seconds.',
			'Warm loads in Lighthouse or PageSpeed Insights show a reasonable Largest Contentful Paint on mobile.',
		],
		scanFlags: [
			'PageSpeed performance scores for mobile and desktop, including server response time and Largest Contentful Paint.',
			'Oversized images and render-blocking resources called out by the Lighthouse audit.',
			'Layout shift while the page finishes loading, measured in the real browser.',
		],
		faqs: [
			{
				q: 'Is a cold start a bug in my app?',
				a: 'No. Replit describes it as normal Autoscale behaviour. Your code affects how long it takes, but the wake-up itself comes with scaling to zero.',
			},
			{
				q: 'Should I ping my app to keep it awake?',
				a: 'Pinging can keep an Autoscale instance warm, but it also generates usage you may pay for, and it fights the point of scaling to zero. If the app must always be ready, a Reserved VM is the cleaner option.',
			},
			{
				q: 'Will a Static deployment work for my Agent-built app?',
				a: 'Only if the app has no server-side logic, API routes or database calls made from the server. A React front end that talks to an external backend such as Supabase can often run as Static.',
			},
		],
		sources: [
			{ label: 'Replit docs: deployment and publishing help', url: 'https://docs.replit.com/help/deployment-and-publishing.md' },
			{ label: 'Replit changelog, January 2025', url: 'https://docs.replit.com/updates/2025/01/24/changelog' },
			{ label: 'Replit docs: publishing troubleshooting', url: 'https://docs.replit.com/build/troubleshooting.md' },
		],
		related: ['replit/app-stops-when-tab-closed', 'replit/publish-fails-health-check-port'],
		updated: '2026-10-26',
	},
	{
		platform: 'replit',
		problem: 'custom-domain-not-verifying',
		query: 'replit custom domain not working',
		title: 'Replit Custom Domain Not Working or Verifying',
		description:
			'Your Replit custom domain is stuck on Verifying, shows Failed, or has SSL errors. Fix the A and TXT records, Cloudflare proxy, AAAA and CAA records.',
		h1: 'Replit custom domain not working: verifying, failed and SSL fixes',
		answer:
			'A Replit custom domain needs both the A record and the TXT record that Publishing > Domains shows you, added at the same time, with no other A or AAAA records on that hostname. Replit checks for them for about six hours after you add the domain; if they are not found in that window it marks the domain Failed and stops checking. Correct the records, set Cloudflare to DNS only, allow Let’s Encrypt in any CAA record, then remove and re-add the domain once.',
		symptom:
			'In Publishing > Domains the domain sits on Verifying for hours, then switches to Failed. Or it verifies, but the browser shows a certificate warning, the old website still appears, or the bare domain works while www does not.',
		causes: [
			{
				title: 'Only one of the two records was added',
				body: 'Replit needs the A record to route traffic and the TXT record to prove you own the domain. Both are required for SSL, so adding just the A record leaves the domain stuck.',
			},
			{
				title: 'Conflicting records on the same name',
				body: 'An old A record from your previous host, or an AAAA (IPv6) record on the same hostname, sends some visitors and the certificate check somewhere else. Replit’s docs say to remove them so only one A record points to Replit at the root.',
			},
			{
				title: 'Cloudflare proxy or a CAA record blocks the certificate',
				body: 'With Cloudflare’s orange-cloud proxy on, Replit cannot complete certificate issuance. A CAA record that allows only another certificate authority blocks Let’s Encrypt, which Replit uses.',
			},
			{
				title: 'The records arrived after the checking window',
				body: 'Replit checks every minute or two for about six hours. If DNS was added later, or propagated slowly, the domain is marked Failed even though the records are now correct.',
			},
		],
		steps: [
			'In Replit open Publishing > Domains, select the domain or Connect your own domain, and copy the exact A record value and TXT record shown. Confirm current values there or in Replit’s custom domain docs rather than from an old tutorial.',
			'At your DNS provider, add the A record for the root (@) and the TXT record together. Delete any other A records and any AAAA records on the same hostname.',
			'If your DNS is on Cloudflare, click the cloud icon on the A record so it shows grey, DNS only.',
			'If the domain has CAA records, add one that allows letsencrypt.org.',
			'Check propagation with a public DNS lookup tool or dig yourdomain.com A and dig yourdomain.com TXT, and confirm they return the Replit values.',
			'If the domain already shows Failed, remove it in Publishing > Domains and add it again once. Avoid repeated reconnects: each one requests a new certificate and Let’s Encrypt limits how many can be issued.',
			'Connect www separately if you want it, because Replit does not issue wildcard certificates; each subdomain is its own connection.',
		],
		verify: [
			'Publishing > Domains shows the domain as verified with no warning.',
			'Both https://yourdomain.com and, if connected, https://www.yourdomain.com open the published app in a private window with a valid padlock.',
		],
		scanFlags: [
			'The page failing to load over HTTPS, or loading content from the old host, on the scanned domain.',
			'HTTPS and security header results from the response once the certificate is in place.',
			'Running the scan on both the bare domain and www shows whether one of them is not yet pointed at Replit.',
		],
		faqs: [
			{
				q: 'How long does Replit domain verification take?',
				a: 'If the records are already in place, often minutes. DNS changes can take up to 48 hours to spread, but Replit only checks for about six hours, so add both records before connecting the domain if you can.',
			},
			{
				q: 'Can I use a CNAME for the root domain?',
				a: 'No. Replit’s docs say apex CNAMEs are not supported, so the root needs the A record. Subdomains follow the record type Replit shows for them.',
			},
			{
				q: 'I bought the domain through Replit and it still fails. What now?',
				a: 'Replit manages DNS for domains bought through it, so you cannot fix the records yourself. Replit’s docs say to contact Replit Support in that case.',
			},
		],
		sources: [
			{ label: 'Replit docs: custom domains and DNS', url: 'https://docs.replit.com/help/custom-domains-and-dns' },
			{ label: 'Replit forum: custom domain not verifying', url: 'https://replit.discourse.group/t/custom-domain-not-verifying/7278' },
			{ label: 'Replit forum: verifying a domain takes time', url: 'https://replit.discourse.group/t/verifying-a-domain-takes-time/6225?page=2' },
		],
		related: ['replit/site-not-on-google', 'replit/app-stops-when-tab-closed'],
		updated: '2026-10-26',
	},
	{
		platform: 'replit',
		problem: 'site-not-on-google',
		query: 'replit site not showing on google',
		title: 'Replit Site Not Showing on Google? Fix It',
		description:
			'Your Replit site is missing from Google, or the replit.app address shows instead of your domain. Fix client-side meta tags, canonicals and sitemaps.',
		h1: 'Replit site not showing on Google: what to change',
		answer:
			'Most Replit sites built by Agent are React apps that render in the browser, so the HTML Google first receives can be an almost empty shell with generic tags. On top of that, the replit.app address keeps working after you connect a custom domain, so Google may index the wrong one. Publish on your custom domain, make titles, descriptions and a canonical link to that domain appear in the served HTML, add sitemap.xml and robots.txt, then submit the sitemap in Google Search Console.',
		symptom:
			'Searching for your business name returns nothing from your site, or returns the something.replit.app address instead of your own domain. Search Console, if set up, lists pages as Discovered or Crawled but not indexed, or says Google chose a different canonical.',
		causes: [
			{
				title: 'Content and tags are added by JavaScript',
				body: 'A Vite React app serves one index.html and builds the page in the browser. Google can render JavaScript, but it does so later and less reliably, and tags set only by script may be missed. Replit’s own SEO guide recommends Static deployments for content-heavy sites because they serve ready-made HTML.',
			},
			{
				title: 'The replit.app copy competes with your domain',
				body: 'After connecting a custom domain the replit.app URL usually stays reachable. Without a canonical tag pointing at your domain, Google sees two copies of the same site and may pick the one you did not want.',
			},
			{
				title: 'Basic SEO files and tags were never added',
				body: 'Agent does not always create a sitemap, a robots.txt, unique page titles or meta descriptions unless asked. Every page sharing one generic title gives Google little reason to rank any of them.',
			},
		],
		steps: [
			'Open your site, choose View Page Source (not Inspect), and search for title, description and canonical. What you see there is what Google receives before rendering. If it is generic or missing, that is the first fix.',
			'After publishing, look at the SEO rating Replit shows in the Publishing pane. On paid plans, open the Growth pane and use Run scan with Agent in the SEO Rating card to get a list of issues and fixes.',
			'Ask Agent to add a unique title and meta description per page, Open Graph tags, and a canonical link that uses your custom domain, output in the served HTML rather than only set by script.',
			'For a content site with no server logic, switch to a Static deployment so each page is served as pre-rendered HTML.',
			'Ask Agent to generate sitemap.xml listing your custom-domain URLs and a robots.txt that links to it. Check both load in the browser.',
			'Verify your custom domain in Google Search Console, submit the sitemap under Sitemaps, and use URL Inspection on the homepage to request indexing.',
		],
		prompt:
			'Optimize this site for search on my domain https://example.com. Give every page a unique title and meta description, add Open Graph and Twitter tags, a lang attribute, and a canonical link pointing at the https://example.com version of each URL. Make sure these tags are in the HTML the server sends, not only added by JavaScript. Generate sitemap.xml and robots.txt for https://example.com and add JSON-LD for my business.',
		verify: [
			'View Page Source on two or three pages shows a distinct title, description and a canonical URL on your custom domain.',
			'Search Console reports the sitemap as read successfully, and URL Inspection shows Google’s chosen canonical is your domain.',
		],
		scanFlags: [
			'Missing or duplicate titles and meta descriptions in the rendered HTML.',
			'A canonical tag that points to replit.app, or no canonical at all.',
			'A robots noindex tag left on the page.',
			'It reads the page as a browser does and cannot tell you whether Google has indexed it; Search Console is the place for that.',
		],
		faqs: [
			{
				q: 'Can I redirect replit.app to my custom domain?',
				a: 'Replit’s docs do not describe a built-in permanent redirect from the replit.app address. A canonical tag on every page pointing at your domain is the dependable way to tell Google which copy to index.',
			},
			{
				q: 'Does Replit’s SEO rating mean Google will rank me?',
				a: 'No. The rating comes from a Lighthouse audit of technical basics. It helps you fix obvious problems, but ranking still depends on your content, links and competition.',
			},
			{
				q: 'How long until my Replit site appears on Google?',
				a: 'A new site often takes days to weeks. Submitting a sitemap and requesting indexing in Search Console helps Google find it; neither guarantees a date.',
			},
		],
		sources: [
			{ label: 'Replit docs: improve SEO', url: 'https://docs.replit.com/build/improve-seo.md' },
			{ label: 'Replit forum: SEO for Replit-hosted websites', url: 'https://replit.discourse.group/t/seo-for-replit-hosted-websites/5909' },
			{ label: 'Replit forum: SEO best practices on Replit', url: 'https://replit.discourse.group/t/seo-best-practises-on-replit/3863' },
		],
		related: ['replit/custom-domain-not-verifying', 'replit/slow-first-load-autoscale'],
		updated: '2026-10-26',
	},

	// ─────────────────────────── Bubble ───────────────────────────
	{
		platform: 'bubble',
		problem: 'data-not-showing-on-live',
		query: 'bubble data not showing on live version',
		title: 'Bubble Data Not Showing on the Live Version',
		description:
			'Repeating groups show data in version-test but are empty on your live Bubble app. Separate databases and privacy rules explained, with the fix.',
		h1: 'Bubble data not showing on the live version: why and how to fix it',
		answer:
			'Bubble keeps two separate databases: one for the development version (version-test) and one for Live. Deploying to Live copies your pages, workflows and data structure, but not the records you created while testing, so a live repeating group with nothing to search shows nothing. If the live database does have records, a privacy rule is hiding them from the current user or from logged-out visitors.',
		symptom:
			'In version-test your repeating groups, lists and dropdowns are full. On the live URL the same page shows empty groups, blank text where a field should be, or a dropdown with no choices. Sometimes it works for you as the admin but not for a normal user or someone who is not logged in.',
		causes: [
			{
				title: 'The live database has no records',
				body: 'Bubble separates development and live data so tests do not pollute your real app. Every product, listing or category you entered while building lives only in development until you move it.',
			},
			{
				title: 'Privacy rules block the viewer',
				body: 'Rules under Data > Privacy decide which users can find each data type in searches and see each field. Rules that only match the creator or admin role leave other users, and logged-out visitors, with empty results.',
			},
			{
				title: 'The search depends on something only development has',
				body: 'A constraint that matches a specific record, a user field that only your test account has filled in, or a URL parameter pointing at a development unique ID returns nothing in Live.',
			},
			{
				title: 'The latest changes were never deployed',
				body: 'Edits you make in the editor only reach the live app after Deploy current version to Live. A new field, a changed data source or a relaxed privacy rule that exists only in development leaves the live page behaving the old way.',
			},
		],
		steps: [
			'In the editor go to Data > App data and use the database switcher to view the Live database. Check whether the data type the page searches actually has records there.',
			'If it is empty, export the records from development as CSV and import them into Live, or create them through your app’s own admin pages. Use Copy and restore database only if you understand it replaces the target database’s contents.',
			'Open Data > Privacy, select the data type, and read each rule. Make sure a rule lets the right users, including Everyone else if logged-out visitors should see it, find this in searches and view the fields the page shows.',
			'Inspect the repeating group’s data source in the editor and look for constraints that depend on a specific user, record or option. Test the search with the debugger in step-by-step mode on version-test, then reason about what differs in Live.',
			'Deploy the current version to Live from the version menu so any structure or privacy changes are included.',
			'Log in to the live app as an ordinary user, then log out, and check the page each way.',
		],
		verify: [
			'The live page shows the expected records for an ordinary logged-in user and, where intended, for a logged-out visitor.',
			'Data > App data in Live lists the records the page depends on, with the fields filled in.',
		],
		scanFlags: [
			'Empty sections or groups where content is expected, visible in the screenshots as a logged-out visitor sees them.',
			'JavaScript console errors on the live page.',
			'The scan cannot read your Bubble database or privacy rules, and it does not log in, so pages that are only for signed-in users need a manual check.',
		],
		faqs: [
			{
				q: 'Why does Bubble not copy my data when I deploy?',
				a: 'Separating the databases protects real customer data from test changes and protects your tests from real data. Deploying moves the app’s design and logic, and you move data deliberately.',
			},
			{
				q: 'Do option sets have the same problem?',
				a: 'Option sets are part of the app’s structure rather than database records, so they travel with a deploy. If a list built from an option set is empty on Live, check that the latest version was actually deployed.',
			},
			{
				q: 'Is copying the development database to Live safe?',
				a: 'It overwrites what is in Live. On a brand-new app with no real users that can be fine; once real users have signed up, import only the records you need instead.',
			},
		],
		sources: [
			{ label: 'Bubble forum: why my data does not appear on live version', url: 'https://forum.bubble.io/t/urgent-help-why-my-data-doesnt-appear-on-live-version/354268' },
			{ label: 'Bubble forum: version-test OK, live version breaks', url: 'https://forum.bubble.io/t/version-test-ok-live-version-breaks/155679' },
			{ label: 'Bubble forum: development and live version are not the same', url: 'https://forum.bubble.io/t/development-and-live-version-are-not-the-same/323697' },
		],
		related: ['bubble/pages-not-indexed', 'bubble/mobile-responsive-not-working'],
		updated: '2026-10-26',
	},
	{
		platform: 'bubble',
		problem: 'pages-not-indexed',
		query: 'bubble site not indexed by google',
		title: 'Bubble Site Not Indexed by Google? Fix It',
		description:
			'Google shows no Bubble pages, or Search Console finds 0 pages in your sitemap. Fix SEO / metatags settings, page slugs and privacy rules for crawlers.',
		h1: 'Bubble site not indexed by Google: the settings that matter',
		answer:
			'Bubble pages stay out of Google when the sitemap and page metadata in Settings > SEO / metatags are not set up, when dynamic pages use bare unique IDs and underscored names, or when privacy rules hide the data a page displays from logged-out visitors, which includes Googlebot. Set an app-wide and per-page title and description, include your public pages in the sitemap, give dynamic pages readable slugs, check privacy rules, and resubmit the sitemap in Search Console.',
		symptom:
			'Searching site:yourdomain.com returns few or no pages. Search Console reports your sitemap with zero discovered URLs, or lists pages as Crawled - currently not indexed. Links shared in WhatsApp or LinkedIn show a generic Bubble title or no description.',
		causes: [
			{
				title: 'Sitemap and metatags were never configured',
				body: 'Bubble generates a sitemap only for the pages you choose in Settings > SEO / metatags, and every page has its own title and description fields. Left at defaults, Google gets a sparse sitemap and pages that all look the same.',
			},
			{
				title: 'Privacy rules hide content from anonymous visitors',
				body: 'Googlebot is never logged in. If a dynamic page’s data type only lets logged-in users find or view it, the crawler sees an empty page and has nothing to index.',
			},
			{
				title: 'URLs that tell Google nothing',
				body: 'Bubble turns a space in a page name into an underscore, and dynamic pages default to a unique ID in the URL. One forum member saw their sitemap pages discovered soon after switching to hyphenated names and descriptive slugs, though they could not be sure which change did it.',
			},
			{
				title: 'Thin pages, or simply not enough time',
				body: 'Pages with little text, or many near-identical dynamic pages, are often crawled and then left out. New sites also take days to weeks before Google indexes much at all.',
			},
		],
		steps: [
			'Open Settings > SEO / metatags. Set the app-wide title, description and social share image, and in the sitemap section include every public page you want in Google. Leave out admin, account and checkout pages.',
			'On each public page, open the page’s property editor and fill in its own title and description. For dynamic pages, build them from the thing’s fields so each record gets distinct text.',
			'Rename pages that contain underscores to hyphenated names, and give data types used on dynamic pages a Slug field filled with readable text, so URLs read /course/bachelor-of-aviation rather than an ID.',
			'In Data > Privacy, check that the data shown on public pages can be found and viewed by Everyone else, without exposing private fields.',
			'Make sure Google sees one domain: in Settings > Domain / email, set your custom domain and turn on the option that redirects all requests to it.',
			'Load yourdomain.com/sitemap.xml and yourdomain.com/robots.txt in the browser, then submit the sitemap in Google Search Console and request indexing for the homepage with URL Inspection.',
		],
		verify: [
			'View Page Source on several live pages shows a unique title and meta description each.',
			'The sitemap loads, lists your public pages on your custom domain, and Search Console reports it as read with discovered URLs.',
			'A dynamic page opened in a private window, logged out, shows its content rather than an empty layout.',
		],
		scanFlags: [
			'Missing, default or duplicate titles and meta descriptions in the rendered page.',
			'Missing Open Graph tags behind poor link previews.',
			'A robots noindex tag on a page you want in Google.',
			'Content missing from the page when it loads as a logged-out visitor, which is how a crawler sees it.',
		],
		faqs: [
			{
				q: 'Can Google index Bubble apps at all?',
				a: 'Yes. Bubble puts page titles and metatags into the HTML it serves, and plenty of Bubble sites rank. The common blockers are configuration, privacy rules and thin pages, not the platform itself.',
			},
			{
				q: 'Why is my sitemap showing 0 pages in Search Console?',
				a: 'Check that pages are actually included in the sitemap setting, that the sitemap URL is on the domain you verified, and that it loads in a browser. Resubmitting after fixing it is often enough for Google to read it again.',
			},
			{
				q: 'Should version-test pages be in Google?',
				a: 'No. Only your live domain should be indexed. Submit the live sitemap and keep test URLs out of any links you share publicly.',
			},
		],
		sources: [
			{ label: 'Bubble forum: sitemap not indexing on Google Console, got it to work', url: 'https://forum.bubble.io/t/sitemap-not-indexing-on-google-console-i-got-it-to-work-finally/339576' },
			{ label: 'Bubble forum: SEO settings Bubble has available', url: 'https://forum.bubble.io/t/seo-settings-that-bubble-has-available-for-you/180219' },
			{ label: 'Bubble forum: website built with Bubble not being indexed', url: 'https://forum.bubble.io/t/website-built-with-bubble-not-being-indexed-by-google-search-engine/322148' },
			{ label: 'Bubble forum: crawled but not indexed issues', url: 'https://forum.bubble.io/t/crawled-but-not-indexed-issues-with-seo/386713' },
		],
		related: ['bubble/data-not-showing-on-live', 'bubble/mobile-responsive-not-working'],
		updated: '2026-10-26',
	},
	{
		platform: 'bubble',
		problem: 'mobile-responsive-not-working',
		query: 'bubble mobile responsive not working',
		title: 'Bubble Mobile Responsive Not Working? Fix It',
		description:
			'Your Bubble page stretches, overlaps or scrolls sideways on phones, and mobile conditions never kick in. Fix breakpoints, conditions and fixed widths.',
		h1: 'Bubble mobile responsive not working: breakpoints and layout fixes',
		answer:
			'On Bubble, mobile layouts usually fail for three reasons: the mobile breakpoint is still at 320px while most phones are wider, so mobile conditions never fire; conditions test that the page width equals a value instead of being at or below it; or elements and groups have fixed or minimum widths wider than the screen. Raise the breakpoint to where your layout actually breaks, use at-or-below conditions, and let containers shrink.',
		symptom:
			'On a phone the page is wider than the screen and scrolls sideways, a four-column repeating group squashes into unreadable strips, buttons overlap text, or the menu runs off the edge. The mobile changes you set in the Responsive tab look right in the editor but never appear on a real phone.',
		causes: [
			{
				title: 'The mobile breakpoint is too narrow',
				body: 'A 320px breakpoint only applies to very small screens. Phones around 375 to 430px wide are treated as larger than mobile, so the layout you designed for phones is skipped. Bubble forum members point to this as the usual reason mobile settings seem ignored.',
			},
			{
				title: 'Conditions use equals instead of at-or-below',
				body: 'A condition like Current page width = 320 is true at exactly one width. It should be Current page width is less than or equal to your breakpoint so it covers every phone.',
			},
			{
				title: 'Fixed and minimum widths are larger than the screen',
				body: 'A group with a fixed width of 1100px, or a minimum width of 600px, cannot shrink, so it pushes the page sideways. Fixed-position elements and wide images do the same.',
			},
		],
		steps: [
			'Temporarily put a text element on the page showing Current page width, open the live page on your phone, and note the number. Delete the element when you are done.',
			'Open the Responsive tab and look at the breakpoints. Change the mobile breakpoint to the width where your layout starts to break, often somewhere between 480 and 768px, or add a custom breakpoint and name it.',
			'Go through conditionals that change layout and replace equals checks with Current page width is less than or equal to the breakpoint. Using a named breakpoint means changing its value later updates every condition at once.',
			'Select each wide group and check its width settings. Replace fixed widths with a maximum width, remove minimum widths that exceed a phone screen, and let column containers stack by switching them to a column layout on mobile.',
			'For repeating groups, set a condition that reduces the number of columns on mobile, and check that cells do not have a fixed width larger than the screen allows.',
			'Preview at several widths in the editor’s Responsive tab, then test the live page on a real phone in portrait and landscape.',
		],
		verify: [
			'At 375, 390 and 414px wide the page does not scroll sideways and nothing overlaps.',
			'Buttons and links are easy to tap and text is readable without zooming on a real phone.',
		],
		scanFlags: [
			'Horizontal overflow at 390px, where the page is wider than the phone screen.',
			'Overlapping, clipped or hidden elements in the phone screenshot, from the visual review.',
			'Tap targets that are too small or too close together, and text that is too small to read.',
		],
		faqs: [
			{
				q: 'Which breakpoint should I use for mobile?',
				a: 'There is no single right number. Drag the editor width down until your layout starts to look wrong and set the breakpoint there. It does not need to match any specific phone.',
			},
			{
				q: 'My app uses the legacy responsive engine. Does this apply?',
				a: 'The breakpoint advice is for the current responsive engine. Pages still on the legacy engine behave differently; Bubble’s manual covers converting them, and converting is usually worth it for mobile work.',
			},
			{
				q: 'Why does a button work on desktop but not on mobile?',
				a: 'Often another element overlaps it on narrow screens, even an invisible one, and catches the tap. Look for groups that sit on top of each other at phone width.',
			},
			{
				q: 'Do I need a separate mobile page in Bubble?',
				a: 'Rarely. One page with containers that stack and a few breakpoint conditions is easier to maintain than two copies that drift apart. Build a separate page only when the mobile experience is genuinely different, such as a native-style app view.',
			},
		],
		sources: [
			{ label: 'Bubble forum: mobile responsiveness is not working', url: 'https://forum.bubble.io/t/mobile-responsiveness-isnt-working/303994' },
			{ label: 'Bubble forum: custom responsive breakpoints', url: 'https://forum.bubble.io/t/new-feature-custom-responsive-breakpoints-for-easier-design-management/292975' },
			{ label: 'Bubble forum: buttons work on desktop but not mobile', url: 'https://forum.bubble.io/t/buttons-work-on-desktop-but-not-mobile/316459' },
		],
		related: ['bubble/pages-not-indexed', 'bubble/data-not-showing-on-live'],
		updated: '2026-10-26',
	},

	// ─────────────────────────── Framer ───────────────────────────
	{
		platform: 'framer',
		problem: 'staging-domain-in-google',
		query: 'framer.app showing in google',
		title: 'framer.app Showing in Google? Hide Staging',
		description:
			'Google lists your framer.app or framer.website staging pages next to your real domain. Protect staging and remove the indexed URLs in Search Console.',
		h1: 'framer.app showing in Google: how to remove your staging site',
		answer:
			'Your Framer staging address (yoursite.framer.app or .framer.website) is a public copy of the site, so Google can crawl and index it alongside your custom domain. On a paid plan, set Staging to Protected in Project Settings > Versions & Staging and publish, so visitors and crawlers must log in to Framer. Then add the staging address as a URL-prefix property in Search Console and request removal of everything under that prefix.',
		symptom:
			'Searching your brand shows results on a framer.app or framer.website address, sometimes with draft pages or old copy. Your custom domain ranks lower than expected, or both versions of the same page appear in results.',
		causes: [
			{
				title: 'Staging is public by default',
				body: 'The staging subdomain exists so you can review changes before publishing to your domain. Unless it is protected, anyone with the URL, including Googlebot following a stray link, can load it.',
			},
			{
				title: 'Two copies of the same pages',
				body: 'When the staging site and the live domain carry the same content, Google has to pick one. It does not always pick your custom domain, and drafts on staging can show up as if they were live.',
			},
			{
				title: 'Links to staging leaked out',
				body: 'A staging link shared in a tweet, a client email that got forwarded, a portfolio or a template marketplace gives Google a path to the subdomain.',
			},
			{
				title: 'The site launched on staging before the domain was connected',
				body: 'If the site ran on the framer.app address for weeks before you bought or connected a domain, Google may have indexed it there first. Those older results linger until Google recrawls both addresses and settles on one.',
			},
		],
		steps: [
			'Search site:yoursite.framer.app (and site:yoursite.framer.website if you used that) to see which staging pages Google holds.',
			'If you plan to remove them through Search Console, add the staging URL as a URL-prefix property first and verify it with the HTML tag method, pasting the tag into Site Settings > Custom Code > Head and publishing to staging.',
			'Open Project Settings > Versions & Staging, set Staging to Protected, and publish. Protected staging needs a paid Framer plan; check the plan page for current details.',
			'In Search Console, open the staging property, go to Removals, create a new request, choose to remove all URLs with this prefix, and submit the staging URL.',
			'On your live domain, check that each important page has Show this page in search engines turned on in its page settings, and request indexing for the homepage with URL Inspection in the custom-domain property.',
			'Find and update any public links that still point at the staging address.',
		],
		verify: [
			'The staging URL opened in a private window asks you to log in to Framer instead of showing the site.',
			'Over the following weeks, a site: search for the staging address returns fewer results and your custom domain appears for brand searches.',
		],
		scanFlags: [
			'A canonical tag on your live pages that points at a framer.app or framer.website address instead of your domain.',
			'Scanning the staging URL shows whether it is still publicly viewable or now behind a login wall.',
			'A robots noindex tag accidentally left on live pages you want indexed.',
		],
		faqs: [
			{
				q: 'Is a Search Console removal permanent?',
				a: 'No. A removal hides URLs from results for about six months. Protecting staging is what keeps them from coming back, so do both.',
			},
			{
				q: 'What if I am on the free Framer plan?',
				a: 'Protected staging is a paid feature. Without it, keep staging links private, make sure your live domain has strong, unique pages, and use Search Console removals for anything that leaks.',
			},
			{
				q: 'Will protecting staging hurt my live site’s ranking?',
				a: 'No. It only affects the staging subdomain. It helps the live domain by leaving Google one copy of each page to rank.',
			},
			{
				q: 'How long until the staging results disappear?',
				a: 'Removal requests are often processed within a day or two, but Google can take several weeks to drop every staging URL for good. Keep checking with a site: search and leave the protection on.',
			},
		],
		sources: [
			{ label: 'BRIX Templates: stop Google indexing your Framer staging subdomain', url: 'https://brixtemplates.com/blog/how-to-stop-google-from-indexing-your-framer-staging-subdomain' },
			{ label: 'Framer Help: troubleshooting Google indexing', url: 'https://www.framer.com/help/articles/troubleshooting-google-indexing/' },
		],
		related: ['framer/horizontal-scroll-mobile'],
		updated: '2026-10-26',
	},
	{
		platform: 'framer',
		problem: 'horizontal-scroll-mobile',
		query: 'framer site scrolls sideways on mobile',
		title: 'Framer Site Scrolls Sideways on Mobile: Fix',
		description:
			'Your Framer site wiggles sideways or shows white space on the right on phones. Find the element that is too wide and fix it without breaking sticky.',
		h1: 'Framer site scrolls sideways on mobile: find and fix the wide element',
		answer:
			'A Framer page scrolls sideways on phones when at least one element is wider than the screen: a fixed pixel width, a minimum width larger than the viewport, an absolutely positioned element hanging off the edge, an animation that slides or scales something past the edge, or a Fit-width element that grows too wide. Find that element at the Phone breakpoint and set its width to Fill or adjust its position. Avoid hiding the problem with Overflow: Hidden on the whole page, because it can break sticky elements.',
		symptom:
			'On a phone the page moves left and right when you scroll, a white strip appears on the right side, or the page zooms out slightly on load. It may only happen in one section, or only while an entrance animation plays.',
		causes: [
			{
				title: 'Fixed or minimum widths wider than the phone',
				body: 'A stack set to 1200px, or a component with a min width of 500px, keeps that width at the Phone breakpoint. Everything else fits, but that one element pushes the page wider.',
			},
			{
				title: 'Absolute positioning near the edge',
				body: 'Decorative shapes, blurred gradients and floating badges placed with absolute positioning often sit partly outside the frame. On desktop the overflow is hidden by the wide layout; on a phone it extends the page.',
			},
			{
				title: 'Animations that move elements off screen',
				body: 'Appear effects or scroll animations with an X offset, rotation or scale start an element beyond the edge. Even if it ends inside the screen, the starting position creates sideways scroll.',
			},
			{
				title: 'Fit-width text or embeds',
				body: 'A text layer set to Fit width with a long word, URL or headline, or an embed with a fixed width, grows until it no longer fits.',
			},
		],
		steps: [
			'Open the Phone breakpoint in the Framer canvas, select the page and scan the layers panel for anything whose width is a pixel value larger than the breakpoint width.',
			'Change those widths to Fill, or set a Max Width instead of a fixed width, so they shrink with the screen. Remove min widths that exceed a phone screen.',
			'Check absolutely positioned layers in each section. Move them inside the frame at the Phone breakpoint, scale them down, or hide them on phones.',
			'Open the effects on elements that animate in and reduce X offsets, rotation and scale at the Phone breakpoint so the starting position stays on screen.',
			'If a decorative section must bleed past the edge, set that section’s Overflow to Clip rather than Hidden. Clip cuts off the excess without creating a scroll container, so sticky elements elsewhere keep working.',
			'Publish, then test on a real phone and in your browser’s device toolbar by trying to drag the page sideways in every section.',
		],
		verify: [
			'At 375 and 390px wide, the page cannot be dragged horizontally in any section, including while animations play.',
			'Sticky headers and sticky sections still stick after your overflow changes.',
		],
		scanFlags: [
			'Horizontal overflow at 390px, where the document is wider than the viewport, seen in the phone screenshot and visual review.',
			'Elements cut off, overlapping or hidden at phone width.',
			'Layout shift during load, which often comes from the same entrance animations.',
		],
		faqs: [
			{
				q: 'Why not just set Overflow: Hidden on the page?',
				a: 'It hides the symptom, but Framer’s own help article warns it can break sticky elements, because hidden overflow turns the container into a scroll area. Fix the wide element, or use Clip on the one section that needs it.',
			},
			{
				q: 'It looks fine in the Framer preview. Why does my phone scroll sideways?',
				a: 'Real phones vary in width and browsers handle animations and fonts slightly differently. An element that is a few pixels too wide may only overflow on some devices or while an animation is mid-way.',
			},
			{
				q: 'How do I find the element quickly?',
				a: 'In your browser’s DevTools at phone width, look for the element whose box extends past the right edge of the viewport. Then find the matching layer in Framer and fix it at the Phone breakpoint.',
			},
		],
		sources: [
			{ label: 'Framer Help: fix horizontal scrolling on mobile', url: 'https://framer.com/help/articles/how-to-fix-horizontal-scrolling-issue-on-mobile' },
			{ label: 'Framer University: fix unwanted horizontal scrolling', url: 'https://framer.university/blog/how-to-fix-unwanted-horizontal-scrolling-on-framer-websites' },
			{ label: 'Framer Help: Overflow Clip', url: 'https://www.framer.com/ja/help/articles/overflow-clip/' },
		],
		related: ['framer/staging-domain-in-google', 'cursor/site-not-responsive-on-mobile'],
		updated: '2026-10-26',
	},

	// ───────────────────── Cursor / Claude Code ─────────────────────
	{
		platform: 'cursor',
		problem: 'site-not-responsive-on-mobile',
		query: 'claude code website not responsive on mobile',
		title: 'Claude Code or Cursor Site Broken on Mobile',
		description:
			'Your site built with Cursor or Claude Code looks fine on a laptop but breaks on phones. Fix viewport, fixed widths and pages the AI never checked.',
		h1: 'Website built with Claude Code or Cursor not responsive on mobile',
		answer:
			'Sites written with Cursor or Claude Code usually break on phones because the AI made only the page it was working on responsive, used fixed pixel widths or absolute positioning, or left out the viewport meta tag in a plain HTML or Vite project. Ask the AI to audit every page and shared component at phone widths, not just the current one, remove fixed widths, and check the viewport tag. Then test each page at 375px and on a real phone, because the AI cannot see the rendered result.',
		symptom:
			'On a laptop the site looks polished. On a phone the page scrolls sideways, text is tiny or runs off the edge, a three-column grid stays three columns, tables push past the screen, and the navigation shows every link in one squashed row with no menu button.',
		causes: [
			{
				title: 'The AI only fixed the page in front of it',
				body: 'When you ask for a page to be made responsive, the change lands in that file. Shared components like the header, footer, pricing table and forms, and every other page, keep their desktop-only layout unless you ask for them explicitly.',
			},
			{
				title: 'Fixed widths and layout shortcuts',
				body: 'Generated code often uses classes like w-[1200px], grid-cols-3 with no small-screen variant, absolute positioning for hero images, or flex rows that never wrap. All of them look right at 1440px and break at 390px.',
			},
			{
				title: 'The viewport meta tag is missing',
				body: 'Without a viewport tag with width=device-width and initial-scale=1, phones render the page at desktop width and zoom it out, so everything looks tiny. Next.js App Router adds it by default; hand-written HTML and some Vite setups may not have it.',
			},
			{
				title: 'Nobody looked at it on a phone',
				body: 'An AI editor reads and writes code; it does not see the rendered page unless you give it a screenshot or a browser tool. Layout bugs that are obvious on a phone can pass every test it runs.',
			},
		],
		steps: [
			'Open the site in Chrome, press F12, toggle the device toolbar and choose a 375px or 390px phone. Visit every page and note where it scrolls sideways, overlaps or has text you cannot read.',
			'Check the head of the page for a meta viewport tag. In a Vite or static project it belongs in index.html; in Next.js App Router, check you have not overridden the default viewport export.',
			'Give the AI the prompt below, naming every page and shared component so it does not stop at one file. In Claude Code, add a line to CLAUDE.md, or in Cursor a rule in .cursor/rules, saying every UI change must work from 360px up.',
			'Search the code for fixed pixel widths, w-screen or 100vw on elements inside padded containers, and grids without a mobile column count. Replace them with max widths and mobile-first classes.',
			'Wrap wide tables and code blocks in a container that scrolls horizontally on its own, so they do not widen the whole page.',
			'Screenshot any page that still looks wrong at phone width and paste the image into the chat, describing exactly which element is off.',
			'Test the finished site on a real phone in portrait and landscape, including opening and closing the mobile menu.',
		],
		prompt:
			'Audit every page and every shared component (header, navigation, footer, hero, cards, pricing, forms, tables) for screens 360 to 414px wide. There must be no horizontal scrolling, body text at least 16px, tap targets at least 44px, a working mobile menu, images that scale down, and grids that collapse to one column on phones. Use responsive utility classes mobile-first, remove fixed pixel widths, confirm the viewport meta tag is present, and list every file you changed.',
		verify: [
			'Every page at 375px and 390px wide in the device toolbar has no sideways scroll and no overlapping elements.',
			'On a real phone, the menu opens and closes, forms are usable with the on-screen keyboard, and text is readable without zooming.',
		],
		scanFlags: [
			'Horizontal overflow at 390px in the phone screenshot and visual review.',
			'Text too small to read and tap targets too small or too close together.',
			'Overlapping or hidden elements and navigation that does not fit at phone width.',
			'The free scan covers the homepage only; a paid report checks up to 5 or 10 pages, which matters when the AI fixed only one.',
		],
		faqs: [
			{
				q: 'Why does the AI keep missing mobile issues?',
				a: 'It works from code and your instructions, not from what the page looks like. Unless you give it a screenshot, a browser tool or a standing rule about phone widths, it has no way to notice a layout that only breaks at 390px.',
			},
			{
				q: 'Should I ask it to rebuild the site mobile-first?',
				a: 'Usually not. A targeted audit of shared components fixes most of the site at once, because the header, footer and cards appear on every page. Rebuild only if the layout depends on absolute positioning throughout.',
			},
			{
				q: 'Is a Tailwind site automatically responsive?',
				a: 'No. Tailwind gives you responsive prefixes such as sm: and md:, but the layout only adapts where those prefixes are used. A grid-cols-3 without a smaller variant stays three columns on a phone.',
			},
		],
		sources: [
			{ label: 'Vercel Community: page not responsive on mobile screens', url: 'https://community.vercel.com/t/page-not-responsive-in-mobile-screens/7814' },
			{ label: 'RapidDevelopers: making v0 apps responsive across screen sizes', url: 'https://www.rapidevelopers.com/md/v0-issues/making-v0-apps-fully-responsive-across-all-screen-sizes' },
			{ label: 'MDN: viewport meta tag', url: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meta/name/viewport' },
		],
		related: ['framer/horizontal-scroll-mobile', 'bubble/mobile-responsive-not-working'],
		updated: '2026-10-26',
	},
]
