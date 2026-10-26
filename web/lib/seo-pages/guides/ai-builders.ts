import type { FixGuide } from '../types'

/** Lovable, Bolt.new and Base44 fixes. */
export const GUIDES: FixGuide[] = [
	// ───────────────────────────── Lovable ─────────────────────────────
	{
		platform: 'lovable',
		problem: 'site-not-showing-on-google',
		query: 'lovable site not showing on google',
		title: 'Lovable Site Not Showing on Google? Fix It',
		description:
			'Your Lovable site is live but Google shows nothing, or only the lovable.app address. Why it happens on old and new projects and how to get indexed.',
		h1: 'Lovable site not showing on Google: causes and fixes',
		answer: `A Lovable site usually stays out of Google for one of four reasons: the latest version was never published, the lovable.app address is still the one Google treats as canonical, the pages carry generic starter metadata with no sitemap, or an older React + Vite project serves crawlers a thin snapshot. Lovable can rank: projects created from 13 May 2026 are server-rendered with TanStack Start, and older ones are pre-rendered for verified crawlers. Publish, set your custom domain as primary, run the SEO & AI scan, connect Search Console and request indexing.`,
		symptom: `You search Google for your brand or a phrase from your homepage and nothing comes up, or the only result is yourproject.lovable.app instead of your own domain. In Search Console the pages sit under "Discovered – currently not indexed" or "Crawled – currently not indexed", or URL Inspection reports that Google picked the lovable.app address as the canonical.`,
		causes: [
			{
				title: 'Nothing is actually live on the custom domain',
				body: `If the project was never published, or the domain shows Ready in Project > Settings > Domains, the domain is configured but not serving a published build. Google cannot index a version that only exists in the editor.`,
			},
			{
				title: 'Google prefers the lovable.app address',
				body: `The lovable.app subdomain keeps working after you connect a domain, and Lovable redirects secondary domains to the primary with a 302 (temporary) redirect because it does not offer 301s between project domains. If the custom domain is not marked primary, Google can settle on the lovable.app URL and ignore yours.`,
			},
			{
				title: 'An older React + Vite project serves a thin snapshot',
				body: `Projects from before 13 May 2026 are client-rendered single-page apps. Lovable pre-renders them on request for verified crawlers, but content that loads late, such as text fetched from the database after a delay, can be missing from that snapshot.`,
			},
			{
				title: 'Starter metadata, no sitemap',
				body: `Every page can still share the title from the template, and Lovable creates robots.txt with each project but not always a sitemap. A robots.txt without a correct Sitemap: line leaves Google to discover pages on its own.`,
			},
		],
		steps: [
			`Click Publish (or Update if it was published before) so the live build matches the editor, then open Project > Settings > Domains and confirm the custom domain reads Live, not Ready or Verifying.`,
			`On the same Domains screen, open the three-dots menu next to your custom domain and choose Set as primary. The lovable.app address and any other domains will then redirect to it.`,
			`Open More > Analytics, select the SEO & AI tab and click Run SEO scan. Work through the sitemap, robots.txt, metadata and canonical findings with Try to fix, then click Scan again to confirm they pass.`,
			`On the Google searches card, click Finish setup to connect Google Search Console. Lovable adds the verification tag and submits the sitemap; if you changed domains recently, verify the new domain and resubmit the sitemap there.`,
			`If the project predates May 2026 and holds important text that loads from the database, consider Upgrade to TanStack Start so every page is server-rendered. Nothing changes on the live site until you publish again, so test the preview first.`,
			`In Search Console, run URL Inspection on the homepage and two key pages and click Request indexing. Then leave it alone for a week or two; repeated requests do not speed Google up.`,
		],
		prompt: `Make every public page SEO-ready for my custom domain https://example.com. Give each route its own <title> under 60 characters and its own meta description, a canonical URL on https://example.com (never lovable.app), and Open Graph tags. Generate /sitemap.xml listing every public route with absolute https://example.com URLs, and make sure robots.txt allows crawling and contains "Sitemap: https://example.com/sitemap.xml". Do not change page content or layout.`,
		verify: [
			`Open https://yourdomain.com/robots.txt and https://yourdomain.com/sitemap.xml in a browser. Both should load, and every URL in the sitemap should start with your custom domain.`,
			`Press Ctrl+U (View Source) on two different pages and check that each has its own title, description and a canonical pointing at your custom domain.`,
			`After a couple of weeks, search site:yourdomain.com and look at the Google-selected canonical in URL Inspection; it should be your domain, not the lovable.app one.`,
		],
		scanFlags: [
			`Missing or generic title and meta description in the rendered homepage, and whether a canonical tag is present and which host it points at.`,
			`A robots noindex tag left on the page, which keeps it out of Google no matter what else you fix.`,
			`Console errors or a blank render, the visitor-side sign that content depends on scripts that are failing.`,
			`It does not query Google's index, so it tells you whether the page is ready to be indexed, not whether Google has done it yet.`,
		],
		faqs: [
			{
				q: `Can a Lovable site rank on Google at all?`,
				a: `Yes. Older advice that Lovable apps are invisible to search predates Lovable's own pre-rendering and the move to TanStack Start. New projects return fully rendered HTML on every request, and older ones serve verified crawlers a rendered copy, so you no longer need an outside pre-rendering service.`,
			},
			{
				q: `Why does Google show my lovable.app address instead of my domain?`,
				a: `Both addresses serve the same pages, and until the custom domain is set as primary and Google has recrawled, it may keep the first one it found. Set the primary domain, make canonicals point at it, resubmit the sitemap on the custom domain and give it time.`,
			},
			{
				q: `Should I upgrade my old project to TanStack Start just for SEO?`,
				a: `Only if your important content loads late or the SEO scan keeps reporting thin pages. A simple marketing site with text written straight into the components is usually captured fine by the crawler snapshot. Upgrade on a quiet day and test every route before you republish.`,
			},
			{
				q: `How long does indexing take after I fix everything?`,
				a: `Days for the homepage on a site Google already knows about, and often several weeks for a brand-new domain with no links pointing to it. Getting one or two genuine links from sites you already own or directories you belong to helps more than pressing Request indexing again.`,
			},
		],
		sources: [
			{ label: 'Lovable docs: SEO and AI search', url: 'https://docs.lovable.dev/features/seo-aeo.md' },
			{ label: 'Lovable docs: custom domains', url: 'https://docs.lovable.dev/features/custom-domain.md' },
			{ label: 'Axon Build: Lovable site not showing on Google', url: 'https://axonbuild.com/blog/lovable-site-not-showing-on-google/' },
		],
		related: ['lovable/custom-domain-not-working', 'lovable/link-preview-og-image-wrong'],
		updated: '2026-10-26',
	},
	{
		platform: 'lovable',
		problem: 'custom-domain-not-working',
		query: 'lovable custom domain not working',
		title: 'Lovable Custom Domain Not Working? Fix It',
		description:
			'Lovable domain stuck on Verifying, showing the old site, a Cloudflare 1001 error or an SSL warning? What each status means and the DNS records to fix.',
		h1: 'Lovable custom domain not working: statuses, causes and fixes',
		answer: `Most broken Lovable domains come down to DNS: the A record does not point at the IP Lovable shows in Project > Settings > Domains, old A, AAAA or CNAME records from a previous host are still there, or Cloudflare is proxying the record. SSL that stalls is usually a CAA record that blocks Lovable's certificate authorities. Match the records exactly, delete the leftovers, set Cloudflare to DNS only, then wait and click Retry rather than changing records again.`,
		symptom: `Your domain shows the old website, a registrar parking page, a "Your connection is not private" warning, or a Cloudflare error 1001 or 1003. Sometimes the root works and www does not. Inside Lovable the domain sits at Verifying, Unable to verify, Setting up, Stalled, Failed or Offline instead of Live.`,
		causes: [
			{
				title: 'Records that do not match what Lovable asks for',
				body: `For a domain bought elsewhere, Lovable's docs (as of October 2026) ask for an A record at the root pointing to 185.158.133.1 and a TXT record at _lovable whose value starts with lovable_verify=. A typo, a record on the wrong host, or an extra A record splitting traffic keeps verification from finishing.`,
			},
			{
				title: 'Leftovers from the previous host',
				body: `An AAAA (IPv6) record or an old CNAME on the same name sends some visitors to the previous site. This is why one person sees the new site and another, on a different network, sees the old one.`,
			},
			{
				title: 'Cloudflare proxy turned on',
				body: `Errors 1001 and 1003 come from Cloudflare's proxy, not from Lovable. With the orange cloud on, Lovable cannot see its own IP behind the record and verification hangs.`,
			},
			{
				title: 'A CAA record blocks the certificate',
				body: `If your domain, or its parent domain, has CAA records that do not allow pki.goog, letsencrypt.org or ssl.com, Lovable cannot issue the certificate and the status moves to Stalled or Failed.`,
			},
		],
		steps: [
			`Open Project > Settings > Domains in Lovable and note the status and the exact records shown for your domain. Copy values from that screen, because the IP and verification string are the source of truth, not a blog post.`,
			`At the company that runs your nameservers (Cloudflare, if your nameservers point there, not the registrar), create the A record at @ and the TXT record at _lovable exactly as shown. Delete every other A, AAAA or CNAME record on the root and on www.`,
			`If you use Cloudflare, click the orange cloud on each Lovable record so it turns grey (DNS only) and leave it that way until the domain is Live. Lovable also documents a "Uses Cloudflare or similar proxy" option that swaps the A record for a CNAME if you need the proxy permanently.`,
			`If the status is Stalled or Failed, look up CAA records on the domain and its parent. Either remove them or add 0 issue "pki.goog", 0 issue "letsencrypt.org" and 0 issue "ssl.com", then click Retry.`,
			`Leave "Redirect www.yourdomain.com → yourdomain.com" switched on when you connect the root, so www is added as its own domain and redirects. Check that both names appear in the Domains list.`,
			`Stop editing records once they are right. Lovable says DNS changes can take up to 72 hours; flipping records back and forth restarts the wait. If the status reads Offline later, click Recover after checking that nothing changed at your DNS provider.`,
		],
		prompt: `Tell me the current state of my custom domain in Project > Settings > Domains, list the exact DNS records it expects, and tell me which existing records at my DNS provider I should delete. Do not change any code.`,
		verify: [
			`Look up A, AAAA and CAA records for both yourdomain.com and www.yourdomain.com on a public DNS checker such as dnschecker.org. You should see only Lovable's A record and no AAAA records.`,
			`Open https://yourdomain.com and https://www.yourdomain.com in a private window, on a laptop and on a phone using mobile data. Neither should show a certificate warning, and both should end on the same primary address.`,
			`Confirm the domain status in Lovable reads Live and that a fresh publish appears on the custom domain.`,
		],
		scanFlags: [
			`The page failing to load, or a browser certificate error, when the scan opens your domain over HTTPS.`,
			`An unexpected page such as a parked domain or the previous site, visible in the desktop and phone screenshots.`,
			`Run one scan on the root and one on www to compare them: if one loads and the other fails, the www record is the problem. The scan cannot read your DNS records directly.`,
		],
		faqs: [
			{
				q: `Why does my Lovable domain work for me but show the old site to others?`,
				a: `Usually an AAAA record or a cached DNS answer. Devices that prefer IPv6 follow the AAAA record to your old host. Delete it, then test from mobile data rather than your office Wi-Fi, which may still hold the old answer.`,
			},
			{
				q: `Can I keep Cloudflare in front of a Lovable site?`,
				a: `Yes, but connect it with the records set to DNS only first. Once you need the proxy, use the documented "Uses Cloudflare or similar proxy" option, which gives you a CNAME instead of the A record.`,
			},
			{
				q: `Do I need a paid Lovable plan for a custom domain?`,
				a: `Yes, connecting a custom domain needs a paid plan. If you downgrade to Free later, domains that are already connected keep working, but you cannot add new ones.`,
			},
			{
				q: `What does Unable to verify mean?`,
				a: `Lovable could not see the verification records within an hour. Check that the TXT record is on _lovable (or _lovable.yourprefix for a subdomain), not on the root, then use Complete setup or remove and re-add the domain.`,
			},
		],
		sources: [
			{ label: 'Lovable docs: custom domains', url: 'https://docs.lovable.dev/features/custom-domain.md' },
			{ label: "Let's Encrypt community: www not working using Lovable", url: 'https://community.letsencrypt.org/t/www-not-working-using-lovable-dev/240165' },
			{ label: 'DEV Community: custom domains in Lovable and TXT records', url: 'https://dev.to/tielec-takashi/setting-up-custom-domains-in-lovable-subdomain-design-atxt-records-3ee5' },
		],
		related: ['lovable/site-not-showing-on-google', 'lovable/published-site-not-updating'],
		updated: '2026-10-26',
	},
	{
		platform: 'lovable',
		problem: 'supabase-data-not-showing-rls',
		query: 'lovable supabase data not showing',
		title: 'Lovable Supabase Data Not Showing? Check RLS',
		description:
			'Rows exist in Supabase but your Lovable app shows an empty list with no error. Why Row Level Security returns nothing and how to write policies safely.',
		h1: 'Lovable app shows no Supabase data: fixing Row Level Security',
		answer: `When a Lovable app shows an empty list even though the rows are in Supabase, Row Level Security is almost always the reason. With RLS enabled and no matching policy, Supabase returns an empty array rather than an error, so the page looks fine and simply has nothing in it. Add a policy per operation for the authenticated role, scoped to the signed-in user, and make sure new rows store that user's id. Never fix it with using (true) or the service role key in the browser.`,
		symptom: `Dashboards, lists or tables on the published app show "No items yet" or render empty, while the Supabase Table Editor clearly shows rows. There is no error on screen. In DevTools the request to /rest/v1/ comes back 200 with [] as the body, or occasionally 401 or 403. Sometimes data appears for the person who built the app and not for anyone else.`,
		causes: [
			{
				title: 'RLS is on and no policy allows the read',
				body: `Supabase's own troubleshooting page says an empty data array with rows in the table usually means RLS is enabled with no policy, or the request does not meet the policy. Lovable often enables RLS on new tables, which is correct, but the matching SELECT policy can be missing.`,
			},
			{
				title: 'The request arrives without a user session',
				body: `A policy built on auth.uid() only matches when the request carries the user's token. If the session was lost after a redirect, or the page fetches before login finishes, the query runs as anon and gets nothing back.`,
			},
			{
				title: 'Rows were saved without the owner column',
				body: `If inserts never set user_id, or there is no INSERT policy with a WITH CHECK clause, rows end up with a null owner or are never written. A correct SELECT policy then has nothing it is allowed to return.`,
			},
			{
				title: 'A previous "fix" that opened everything',
				body: `Sometimes the data shows up because someone added using (true) or put the service_role key in frontend code. The list works, but every visitor can now read every row, which is a far worse problem than an empty page.`,
			},
		],
		steps: [
			`On the live site, log in, open DevTools > Network and filter by rest/v1. Click the request for the empty list and read the status and response body: 200 with [] points to policies, 401 or 403 points to a missing or rejected session.`,
			`In the Supabase dashboard open Table Editor, select the table and check whether RLS is enabled, then open Authentication > Policies to see what exists for it. On Lovable Cloud projects the same information is under the project's Cloud database view.`,
			`Check the rows themselves: does the owner column (often user_id) hold the id of the user who should see them? If it is empty, the inserts are the bug, not the reads.`,
			`Add one policy per operation for the authenticated role, for example SELECT using ((select auth.uid()) = user_id) and INSERT with check ((select auth.uid()) = user_id). Add UPDATE and DELETE the same way only if the app needs them.`,
			`If a table is meant to be public, such as a list of products, give it a SELECT policy for the anon role on that table only, and keep writes restricted.`,
			`Search the code for service_role and for using (true). Remove both from anything that runs in the browser, and rotate the service role key in Supabase if it was ever shipped to the frontend.`,
		],
		prompt: `My [table name] data shows as empty on the published site for logged-in users. Check the Supabase Row Level Security policies on this table. Add SELECT, INSERT, UPDATE and DELETE policies for the authenticated role that only allow rows where user_id = auth.uid(), make sure every new row sets user_id to the current user, and make sure the page waits for the session before it queries. Do not use the service role key or "using (true)" anywhere in client code. Explain each policy you add.`,
		verify: [
			`Log in on the live site in a private window and confirm the rest/v1 response contains your rows, not [] and not a 401.`,
			`Sign up as a second test user and check that you cannot see the first user's rows, even by changing an id in the URL.`,
			`Log out and reload: private data should no longer be returned in any network response.`,
		],
		scanFlags: [
			`A public page that renders an empty list or a "no results" state where content is expected, visible in the screenshots.`,
			`Failed requests with 401 or 403 status to your backend from public pages, and console errors from data fetching.`,
			`The scan visits as a logged-out visitor and cannot read your RLS policies, so it finds the public symptom, not the policy that causes it.`,
		],
		faqs: [
			{
				q: `Why does Supabase return an empty array instead of an error?`,
				a: `That is how Row Level Security is designed. A policy works like a filter added to every query, so rows the user is not allowed to see are simply left out. From the app's point of view the query succeeded and found nothing.`,
			},
			{
				q: `Is it safe to just turn RLS off?`,
				a: `No. Your Supabase anon key is in the browser by design, so with RLS off anyone can query the table directly. Turning it off briefly in a development copy is a fine way to confirm the cause, but production tables need policies.`,
			},
			{
				q: `It works for me but not for other users. Why?`,
				a: `Often the rows were created while you were logged in, so they carry your user id, or you are testing in the editor preview where your own session is present. Test the live site in a private window with a brand-new account to see what real users see.`,
			},
		],
		sources: [
			{ label: 'Supabase: why is my select returning an empty data array', url: 'https://supabase.com/docs/guides/troubleshooting/why-is-my-select-returning-an-empty-data-array-and-i-have-data-in-the-table-xvOPgx.md' },
			{ label: 'Witscode: Supabase RLS in Lovable', url: 'https://witscode.com/blogs/supabase-rls-lovable' },
			{ label: 'Escape: vulnerabilities in vibe-coded apps', url: 'https://escape.tech/blog/methodology-how-we-discovered-vulnerabilities-apps-built-with-vibe-coding/' },
		],
		related: ['lovable/login-redirects-to-localhost', 'lovable/published-site-not-updating'],
		updated: '2026-10-26',
	},
	{
		platform: 'lovable',
		problem: 'login-redirects-to-localhost',
		query: 'lovable login redirects to localhost',
		title: 'Lovable Login Redirects to Localhost? Fix It',
		description:
			'Confirmation or reset emails from your Lovable app open localhost:3000 or the preview URL? Fix the Supabase Site URL, redirect list and Google origins.',
		h1: 'Lovable login redirects to localhost: how to fix auth URLs',
		answer: `If signing up or resetting a password in a Lovable app sends people to localhost:3000 or the preview URL, the auth settings still point at development. In Supabase, set Authentication > URL Configuration > Site URL to your live domain, add the live domain and lovable.app address to Redirect URLs, and make the code pass window.location.origin as the redirect. Then send a fresh email, because links in old emails keep the old address.`,
		symptom: `A new user clicks the confirmation link and the browser opens http://localhost:3000 with "This site can't be reached". Password reset links behave the same way, or land on the Lovable editor preview instead of the real site. Google sign-in on the custom domain may fail with a redirect_uri_mismatch error while it works on lovable.app.`,
		causes: [
			{
				title: 'Site URL is still the default',
				body: `Supabase uses the Site URL as the fallback redirect whenever the code does not pass one, and it is the address written into confirmation and reset emails. New Supabase projects start with http://localhost:3000 there.`,
			},
			{
				title: 'The live domain is not on the allow list',
				body: `Supabase only redirects to addresses listed under Redirect URLs. If the code asks for https://yourdomain.com and that address is missing, Supabase silently falls back to the Site URL.`,
			},
			{
				title: 'A hardcoded preview or localhost address in the code',
				body: `Generated code sometimes sets emailRedirectTo or redirectTo to the address it was built on. That works while building and breaks the moment the site moves to a custom domain.`,
			},
			{
				title: 'Google OAuth client missing the new domain',
				body: `If you use your own Google OAuth client, the custom domain has to be listed under Authorized JavaScript origins in Google Cloud Console, or Google refuses the sign-in.`,
			},
		],
		steps: [
			`In the Supabase dashboard open Authentication > URL Configuration and set Site URL to https://yourdomain.com. If the project runs on Lovable Cloud instead of your own Supabase account, find the equivalent auth URL setting in Lovable's Cloud settings; the names may differ.`,
			`Under Redirect URLs add https://yourdomain.com/** and https://yourproject.lovable.app/**. Supabase recommends exact paths in production, so tighten these to your callback path once things work.`,
			`Search the code for localhost, lovable.app and lovableproject in any emailRedirectTo or redirectTo option, and replace them with window.location.origin plus your callback path.`,
			`If sign-in with Google uses your own OAuth client, open Google Cloud Console > Credentials, edit the client and add your custom domain to Authorized JavaScript origins. Keep the Supabase callback URL in Authorized redirect URIs.`,
			`Publish, then request a brand-new confirmation and a new reset email. Older emails were generated with the previous Site URL and will never work.`,
		],
		prompt: `Fix auth redirects for production. Use window.location.origin for every emailRedirectTo and redirectTo (sign up, magic link, password reset, OAuth) instead of any hardcoded localhost or preview URL, and add an /auth/callback route that finishes the session and sends the user to the dashboard. Then tell me exactly which URLs I must add as Site URL and Redirect URLs in the auth settings.`,
		verify: [
			`Sign up with a new email on the live domain. The confirmation link should open your domain and leave you logged in.`,
			`Run Forgot password and hover the link in the email before clicking: the host should be your domain.`,
			`Try Google sign-in from the custom domain on desktop and on a phone, in a private window.`,
		],
		scanFlags: [
			`Links or buttons on public pages that point at localhost or a preview address, which fail the scan's link check.`,
			`Console errors and failed requests on public pages such as the sign-in screen.`,
			`The scan does not log in or open emails, so it cannot follow a confirmation link; test that flow yourself with the steps above.`,
		],
		faqs: [
			{
				q: `I fixed the Site URL but the email link still goes to localhost. Why?`,
				a: `The link was baked into the email when it was sent. Request a new one. If a new email still has localhost, the code is passing a hardcoded redirect, or the address it passes is not in Redirect URLs and Supabase fell back.`,
			},
			{
				q: `Should I keep the lovable.app address in Redirect URLs?`,
				a: `Keep it while you still test on it. Once the custom domain is primary and everyone uses it, you can remove the extra entries and leave only the exact production callback.`,
			},
			{
				q: `Does this affect Google sign-in too?`,
				a: `Yes, in two places. Supabase needs your domain in Redirect URLs to send users back after Google, and Google needs your domain as an authorised origin if you use your own client ID. Either one missing breaks the flow on the custom domain.`,
			},
		],
		sources: [
			{ label: 'Supabase docs: redirect URLs', url: 'https://supabase.com/docs/guides/auth/redirect-urls' },
			{ label: 'RapidDev: redirect issues after auth flow in Lovable', url: 'https://www.rapidevelopers.com/md/lovable-issues/resolving-redirect-issues-after-auth-flow-in-lovable' },
		],
		related: ['lovable/supabase-data-not-showing-rls', 'lovable/custom-domain-not-working'],
		updated: '2026-10-26',
	},
	{
		platform: 'lovable',
		problem: '404-on-refresh-after-export',
		query: 'lovable 404 on page refresh',
		title: 'Lovable 404 on Refresh After Export? Fix It',
		description:
			'Your exported Lovable app works from the homepage but /about gives a 404 on Netlify, Vercel or GitHub Pages. Add the right fallback for your host.',
		h1: 'Lovable app gives 404 on refresh after export: the fix per host',
		answer: `An exported Lovable React + Vite app returns 404 on refresh because it is a single-page app: the host looks for a file called /about, finds none, and never loads index.html where the router lives. Add a fallback so every unknown path serves index.html, using public/_redirects on Netlify or a rewrite in vercel.json on Vercel. On Lovable's own hosting this is handled for you, so the problem only appears after you move the code.`,
		symptom: `The homepage loads on your new host and clicking through the menu works. But pressing refresh on /about, opening /dashboard from a bookmark, or following a link someone shared gives the host's own error, such as Netlify's "Page not found – Looks like you've followed a broken link" or Vercel's 404 page.`,
		causes: [
			{
				title: 'Client-side routing needs a fallback',
				body: `Older Lovable projects use React Router inside one index.html. Inside the app, links change the URL without asking the server for anything. A refresh asks the server for /about directly, and a plain static host has no such file.`,
			},
			{
				title: 'No rewrite rule was exported',
				body: `Lovable's hosting serves index.html for every route, so the project never needed a rule. When you sync to GitHub and deploy elsewhere, nothing tells the new host to do the same.`,
			},
			{
				title: 'A netlify.toml rule that is never read',
				body: `Netlify only reads netlify.toml redirects during its own build. If you drag and drop a dist folder, or a tool uploads prebuilt files, that step is skipped and the rule is ignored, which is why a _redirects file inside the output is more reliable.`,
			},
		],
		steps: [
			`Confirm the project type first. If package.json uses Vite and react-router-dom, this guide applies. Projects created on TanStack Start from May 2026 render on a server and need a host that runs Node, not just a static fallback.`,
			`For Netlify, create a file at public/_redirects containing one line: /*    /index.html   200. Vite copies everything in public/ into dist/ on build, so the rule ships with every deploy.`,
			`For Vercel, add vercel.json at the project root with { "rewrites": [ { "source": "/(.*)", "destination": "/index.html" } ] }. Vercel serves real files first, so images and scripts are unaffected.`,
			`For GitHub Pages, which has no rewrites, copy index.html to 404.html in the build output, or switch to HashRouter. Also set base in vite.config to /your-repo-name/ if the site lives in a subfolder.`,
			`Add a catch-all route inside the app that shows a proper "page not found" screen, so genuinely wrong URLs still tell the visitor something useful once the host stops returning 404.`,
			`Redeploy, then open three deep links in a fresh private window and press refresh on each.`,
		],
		prompt: `This app will be hosted on [Netlify/Vercel]. Add the single-page-app fallback so direct visits and refreshes on any route serve index.html: for Netlify add public/_redirects with "/*  /index.html  200"; for Vercel add vercel.json with a rewrite from "/(.*)" to "/index.html". Also add an in-app 404 page for unknown routes. Do not change routing otherwise.`,
		verify: [
			`Paste several deep URLs straight into a new private window and refresh each one; every page should render, not the host's error page.`,
			`In DevTools > Network, the document request for a deep URL should return 200, and a made-up URL should show your in-app 404 screen.`,
		],
		scanFlags: [
			`Internal links on the homepage that return 404 when the scan loads them directly, which is exactly how a refresh behaves.`,
			`How the site answers a path that does not exist: the host's bare error page, or your own 404 screen.`,
			`A free scan covers the homepage and its links; a paid report loads up to 10 pages directly, which catches deep routes too.`,
		],
		faqs: [
			{
				q: `Why does it work when I click links but not when I refresh?`,
				a: `Clicking a link inside the app never asks the server for a page; the router swaps the content in the browser. Refreshing makes a real request for that path, and without a fallback rule the host has nothing to send back.`,
			},
			{
				q: `Will the fallback rule break my images or API calls?`,
				a: `No. Netlify and Vercel serve files that exist before applying the rule, so assets in dist load normally. Only paths with no matching file get index.html.`,
			},
			{
				q: `Does this happen on lovable.app or my Lovable custom domain?`,
				a: `No. Lovable's own hosting already serves the app for every route. If you see 404s there, the link itself points at a route the app does not define.`,
			},
		],
		sources: [
			{ label: 'Netlify forum: 404 on page refresh with netlify.toml', url: 'https://answers.netlify.com/t/production-redirect-running-404-error-on-page-refresh-bolt-new-netlify-toml/143636' },
			{ label: 'Vercel community: React Vite production 404 on nested routes', url: 'https://community.vercel.com/t/react-vite-createbrowserrouter-production-404-on-nested-routes/8447' },
			{ label: 'RapidDev: fixing 404 errors on refresh in Lovable SPAs', url: 'https://www.rapidevelopers.com/lovable-issues/fixing-404-errors-on-page-refresh-in-lovable-spas' },
		],
		related: ['lovable/published-site-not-updating', 'bolt/404-on-refresh-netlify'],
		updated: '2026-10-26',
	},
	{
		platform: 'lovable',
		problem: 'link-preview-og-image-wrong',
		query: 'lovable link preview not showing image',
		title: 'Lovable Link Preview Image Wrong? Fix It',
		description:
			'Sharing your Lovable site on WhatsApp, Slack or LinkedIn shows no image, a placeholder or the same card on every page? Set per-page Open Graph tags.',
		h1: 'Lovable link preview not showing the right image: how to fix it',
		answer: `A Lovable link preview shows no image, a placeholder or the wrong title when the Open Graph tags are generic, missing, only set once for the whole site, or point at an image that is too big or uses a relative URL. Give each page its own og:title, og:description and an absolute og:image around 1200×630 at a few hundred KB, publish, then clear each platform's cached preview with its debugging tool.`,
		symptom: `You paste your link into WhatsApp, iMessage, Slack, LinkedIn or X and the card has no picture, a generic placeholder, the project's old name, or the homepage image for every page you share. Sometimes it looks right in one app and wrong in another, which is a sign of caching rather than a broken tag.`,
		causes: [
			{
				title: 'One set of tags for the whole site',
				body: `If og:title and og:image are only written once in index.html, every page shares the same card. Template projects also ship with placeholder tags that nobody replaced.`,
			},
			{
				title: 'Tags added by JavaScript after load',
				body: `Most social crawlers read the HTML and do not run scripts. Tags set in the browser after the page loads are invisible to them unless the server or Lovable's crawler pre-rendering includes them in the delivered HTML.`,
			},
			{
				title: 'The image is too heavy or not an absolute URL',
				body: `Lovable's docs recommend 1200×630 at a few hundred KB and note that WhatsApp shows no preview for larger files. A path like /og.png without the domain is also ignored by several platforms.`,
			},
			{
				title: 'The old preview is cached',
				body: `Facebook, LinkedIn and messaging apps store the card the first time a link is shared. Fixing the tags does not change a cached card until the platform scrapes the page again.`,
			},
		],
		steps: [
			`Check what Lovable will show before publishing: use the page selector above the preview, hover the preview icon and open the Social card. You can also open Social & search appearance from the ⋮ menu in the Publish dialog.`,
			`Set a unique og:title and og:description for each page, and an og:image with a full https:// address on your custom domain. Save the image in public/ so it ships with the site.`,
			`Export the share image at 1200×630 and compress it to a few hundred KB; a large PNG straight from a design tool is the usual reason WhatsApp shows nothing.`,
			`Add twitter:card with the value summary_large_image so X shows a large card instead of a small thumbnail.`,
			`Publish, then paste each URL into the Facebook Sharing Debugger and click Scrape Again, and into LinkedIn's Post Inspector. These refresh the cached card for those platforms.`,
			`Run the SEO & AI scan under More > Analytics, which also reviews Open Graph previews, and fix anything it lists.`,
		],
		prompt: `Give every public page its own Open Graph and Twitter card tags: og:title, og:description, og:url (absolute, on https://example.com), og:image (absolute URL, 1200x630, under 300 KB, saved in /public), and twitter:card=summary_large_image. Make sure these tags are present in the HTML the server or pre-renderer delivers, not only added by JavaScript after the page loads.`,
		verify: [
			`Use View Source (not the Elements panel) on two pages and confirm the og: tags are present and different on each.`,
			`Open the og:image address directly in a browser; it should load and the file should be a few hundred KB, not several MB.`,
			`Share each URL in a private WhatsApp or Slack chat with yourself and check the card shows the right image and title.`,
		],
		scanFlags: [
			`Missing og:title, og:description or og:image in the rendered homepage.`,
			`An og:image address that fails to load, reported as a failed request or broken image.`,
			`A paid report compares titles and descriptions across up to 10 pages, so a single card reused everywhere stands out.`,
		],
		faqs: [
			{
				q: `Why does the preview look right in Lovable but wrong in WhatsApp?`,
				a: `Either WhatsApp cached an older version, or the image is above the size it accepts. Compress the image, publish, and share the link with a harmless query string such as ?v=2 to force a fresh fetch.`,
			},
			{
				q: `Do social apps see tags on older React + Vite Lovable projects?`,
				a: `Lovable pre-renders older projects for verified crawlers, and social preview bots are included, so tags set per route generally reach them. Newer TanStack Start projects render the tags on the server for every request.`,
			},
			{
				q: `What size should the share image be?`,
				a: `1200×630 pixels is the safe standard across platforms, kept to a few hundred KB. Keep important text away from the edges, since some apps crop the card to a square.`,
			},
		],
		sources: [
			{ label: 'Lovable docs: SEO, AI search and social previews', url: 'https://docs.lovable.dev/features/seo-aeo.md' },
			{ label: 'Meta for Developers: sharing FAQ for webmasters', url: 'https://developers.facebook.com/documentation/sharing/webmasters/faq' },
		],
		related: ['lovable/site-not-showing-on-google', 'lovable/published-site-not-updating'],
		updated: '2026-10-26',
	},
	{
		platform: 'lovable',
		problem: 'contact-form-not-sending',
		query: 'lovable contact form not sending email',
		title: 'Lovable Contact Form Not Sending? Fix It',
		description:
			'Your Lovable contact form shows a thank-you message but no email arrives? Find out whether the form has a backend, then fix the email key and sender.',
		h1: 'Lovable contact form not sending email: how to make it deliver',
		answer: `A Lovable contact form that shows success but sends nothing usually has no backend at all: the generated form validates fields and displays a toast without saving or emailing anything. If there is a backend function, the email provider key is missing, the sender is still Resend's onboarding@resend.dev test address, or the domain is not verified so messages land in spam. Check the network request on submit to see which.`,
		symptom: `A visitor fills in the form, clicks Send and sees "Thanks, we'll be in touch", or nothing at all. No email reaches you, and when you look in the database there is no saved message either. You may only discover this weeks later when someone mentions they wrote to you.`,
		causes: [
			{
				title: 'The form is only a front end',
				body: `When you ask for "a contact form", the builder can produce the fields, validation and a success toast with no call to a server. Submitting does nothing, or only logs to the console.`,
			},
			{
				title: 'The email key was never added',
				body: `If a backend function exists, it needs the provider's API key, such as RESEND_API_KEY, stored as a secret. Without it the function errors out, and a careless UI still shows success.`,
			},
			{
				title: 'Still sending from the test address',
				body: `Resend's onboarding@resend.dev sender only delivers to the email address on your own Resend account. Anything else returns a 403 error saying you can only send testing emails to your own address.`,
			},
			{
				title: 'Delivered, but into spam',
				body: `Mail sent from a domain without SPF and DKIM records is easy for inbox providers to distrust. The message technically sends and quietly goes to junk.`,
			},
		],
		steps: [
			`Open the live site, open DevTools > Network, fill in the form and click submit. If no request appears at all, the form has no backend and you need to ask Lovable to build one.`,
			`If a request fires, click it and read the status. A 500 or a message about a missing key points at secrets; a 403 from Resend points at the sender or domain.`,
			`Ask Lovable to save each submission to a table first and then send the email from a backend function. Saving first means a message is never lost, even when email fails.`,
			`Add the provider key as a secret in the project, never in the code. Then verify your own domain in Resend by adding its DNS records, and change the from address to something like hello@yourdomain.com.`,
			`Make the form honest: disable the button while sending, show success only after the server confirms, and show a clear error with an alternative contact if it fails.`,
			`Send yourself a real test from a phone and a laptop, and check the spam folder as well as the inbox.`,
		],
		prompt: `My contact form at [page] must actually deliver. On submit: save the entry to a "contact_messages" table, then call a backend function that emails it to me@example.com via Resend using the RESEND_API_KEY secret and a from address on my verified domain. Show the success message only after the server confirms, show a clear error message if it fails, disable the button while sending, and add a honeypot field for basic spam protection.`,
		verify: [
			`Submit a real message on the live site and confirm it appears in the contact_messages table and in your inbox within a couple of minutes.`,
			`Watch DevTools > Network during submit and check the request returns a 2xx status.`,
			`Turn on DevTools offline mode and submit again: the form should show an error, not a thank-you.`,
		],
		scanFlags: [
			`Whether submitting the form empty shows validation messages, or silently does nothing.`,
			`Console errors and failed requests on the page that holds the form.`,
			`The scan never sends real data and cannot check your inbox, so it can point to a broken form but cannot prove delivery; do the real test above.`,
		],
		faqs: [
			{
				q: `How can I tell if my form has a backend at all?`,
				a: `Submit it with DevTools > Network open. A working form makes a request to a function, Supabase or a form service. If nothing appears in the list when you click send, the form is decoration.`,
			},
			{
				q: `Do I need Resend, or can Lovable send email itself?`,
				a: `Lovable lists Resend among its integrations and it is the common route for app emails. Check Lovable's current integration docs for built-in options, since they change; whichever you use, verify your sending domain.`,
			},
			{
				q: `Why do test emails to me work but not to anyone else?`,
				a: `That is the signature of Resend's onboarding@resend.dev sender, which only delivers to your own account address. Verify a domain and send from it.`,
			},
		],
		sources: [
			{ label: 'Resend: 403 error with the resend.dev domain', url: 'https://resend.com/docs/knowledge-base/403-error-resend-dev-domain' },
			{ label: 'Splitforms: add a contact form to Lovable', url: 'https://splitforms.com/blog/add-contact-form-to-lovable' },
			{ label: 'RapidDev: form submission errors in Lovable', url: 'https://www.rapidevelopers.com/md/lovable-issues/fixing-form-submission-errors-in-lovable-projects' },
		],
		related: ['bolt/emails-not-sending', 'base44/form-email-not-sending', 'lovable/published-site-not-updating'],
		updated: '2026-10-26',
	},
	{
		platform: 'lovable',
		problem: 'published-site-not-updating',
		query: 'lovable changes not showing on live site',
		title: 'Lovable Live Site Not Updating? Fix It',
		description:
			'The Lovable editor shows your changes but the live site is still the old version, or broke while the preview works. Why it happens and how to fix it.',
		h1: 'Lovable changes not showing on the live site: what to check',
		answer: `Lovable's live site is a snapshot taken when you last published, so editor changes only appear after you click Publish and then Update. If you did update and still see the old site, your browser or a CDN is serving cached files. If the live site broke while the preview works, a database or auth change made during editing is hitting the older published code, because both use the same backend.`,
		symptom: `You made changes, the preview in the editor looks right, but yourproject.lovable.app or your custom domain still shows last week's version. Or the opposite surprise: you changed a table or sign-in setting, and the live site now errors or shows empty pages even though you did not publish anything new.`,
		causes: [
			{
				title: 'The changes were never published',
				body: `Editing in Lovable updates the preview, not the live site. Publishing deploys a fixed version, and new edits wait until you open the Publish dialog and choose Update.`,
			},
			{
				title: 'Cached files in the browser or at the edge',
				body: `Your browser may hold the previous JavaScript bundle, and a proxy such as Cloudflare in front of the domain can keep serving old files after a publish.`,
			},
			{
				title: 'Live code and editor share one backend',
				body: `The preview and the published app talk to the same database. Renaming a column or changing an auth setting while building can break the older published code, which still expects the previous shape.`,
			},
		],
		steps: [
			`Open the Publish dialog and click Update. In version history, check which version is marked as published and that it is the one you expect.`,
			`Open the live site in a private window and hard-refresh with Ctrl+Shift+R on Windows or Cmd+Shift+R on a Mac. If you use Cloudflare in front of the domain, purge its cache too.`,
			`If the live site broke without a publish, think about what changed in the backend since: a renamed column, a new required field, an RLS policy, an auth setting. Either publish the code that matches the new schema or reverse the schema change.`,
			`Open the browser console on the live site and read the first red error. A message naming a column or table that does not exist confirms the code and the database are out of step.`,
			`If Update seems to do nothing at all, check Lovable's status page for publishing incidents before changing anything else.`,
			`For risky database changes in future, make them in small steps that work with both old and new code, and publish straight after.`,
		],
		prompt: `Compare the currently published version with the current version and list any database, auth or environment changes the published code depends on. Tell me whether publishing now is safe, and what would break on the live site if I don't.`,
		verify: [
			`Open the live URL in a private window on desktop and phone and confirm the newest text or feature is visible.`,
			`Check the browser console on the live site after the publish for red errors.`,
			`Click through the main flow, including any page that reads from the database.`,
		],
		scanFlags: [
			`JavaScript console errors and failed data requests on the live site, the usual trace of code and database being out of step.`,
			`Desktop and phone screenshots of exactly what a fresh visitor gets, which settles whether the update is live.`,
			`Running a scan before and after a publish gives you two reports to compare side by side.`,
		],
		faqs: [
			{
				q: `Does Lovable publish automatically when I make changes?`,
				a: `No. Publishing is deliberate so half-finished edits never reach visitors. Each time you want changes live, open the Publish dialog and click Update.`,
			},
			{
				q: `Why did my live site break when I only changed the database?`,
				a: `The preview and the published app share the same database. The live site still runs the older code, and if that code expects a column you renamed or removed, it fails. Publish the matching code or undo the change.`,
			},
			{
				q: `I published and cleared my cache, but a customer still sees the old version. Why?`,
				a: `Their browser or company network may still hold old files. Ask them to hard-refresh or try a private window. If you use a proxy in front of the domain, purge its cache as well.`,
			},
		],
		sources: [
			{ label: 'Lovable docs: FAQ', url: 'https://docs.lovable.dev/introduction/faq' },
			{ label: 'Axon Build: Lovable preview not working', url: 'https://axonbuild.com/blog/lovable-preview-not-working/' },
		],
		related: ['lovable/supabase-data-not-showing-rls', 'lovable/custom-domain-not-working'],
		updated: '2026-10-26',
	},
	// ───────────────────────────── Bolt.new ─────────────────────────────
	{
		platform: 'bolt',
		problem: 'blank-page-after-deploy',
		query: 'bolt.new blank page after deploy',
		title: 'Bolt.new Blank Page After Deploy? Fix It',
		description:
			'Your Bolt.new app works in the preview but the deployed site is a white screen. Read the console error, then fix the build folder, env vars or base path.',
		h1: 'Bolt.new blank page after deploy: causes and fixes',
		answer: `A Bolt.new app that works in the preview but shows a white page after deploy is crashing before it can draw anything. The browser console names the cause: a MIME type error means source files were deployed instead of the dist build, a "supabaseUrl is required" style error means environment variables never reached the host, and 404s on JS or CSS files mean a wrong Vite base path. Fix that one thing and redeploy.`,
		symptom: `The Bolt preview looks perfect, but the deployed address on Netlify or another host is completely white, or shows a split second of content and then goes blank. The page title may be correct in the tab. Opening the console shows red errors such as "Expected a JavaScript module script but the server responded with a MIME type of application/octet-stream".`,
		causes: [
			{
				title: 'Source files deployed instead of the build',
				body: `Dragging the project folder into a host uploads raw files like src/main.tsx, which browsers cannot run. Only the output of npm run build, in the dist folder for Vite, is meant to be served.`,
			},
			{
				title: 'Wrong publish directory',
				body: `Vite writes the built site to dist; older Create React App projects use build. If the host publishes the wrong folder, it serves an index.html that points at files which do not exist.`,
			},
			{
				title: 'Environment variables missing on the host',
				body: `Keys such as VITE_SUPABASE_URL exist in Bolt but are not copied to Netlify. The app tries to create its database client on start, throws, and React renders nothing.`,
			},
			{
				title: 'A subfolder base path',
				body: `If vite.config sets base to something like /Portfolio/, every script and stylesheet is requested from that folder. On a site served at the root, they all return 404.`,
			},
		],
		steps: [
			`Open the deployed URL, press F12, select Console and reload. Write down the first red error; everything after it is usually a consequence.`,
			`If you deploy by hand, run npm run build and upload the contents of dist, not the project root. With Git-connected deploys, set the build command to npm run build and the publish directory to dist.`,
			`If the build fails on the host but works in Bolt, pin the Node version with a .nvmrc file or a NODE_VERSION environment variable matching the one Bolt used.`,
			`Add every VITE_ variable the app reads under Netlify's Site configuration > Environment variables, or your host's equivalent, then start a new deploy so the values are built in.`,
			`Open vite.config and make sure base is '/' unless the site really lives in a subfolder.`,
			`Ask Bolt to show a readable error message when a required setting is missing, so the next failure tells visitors something instead of showing white.`,
		],
		prompt: `The deployed site shows a blank page but the preview works. Check vite.config for a non-root "base", make sure the build outputs to dist, list every environment variable the app reads at startup (import.meta.env.*), and add a visible error message instead of a blank screen if a required variable is missing.`,
		verify: [
			`Reload the live URL with the console open: no red errors, and in the Network tab every JS and CSS file returns 200 with a JavaScript or CSS content type.`,
			`Open the site on a phone over mobile data to rule out anything cached on your own machine.`,
		],
		scanFlags: [
			`A blank page: the scan flags a page that loads but renders nothing meaningful, on desktop and phone.`,
			`The exact console errors on load, such as MIME type or missing configuration messages.`,
			`Failed requests for JavaScript and CSS files, which points straight at the build folder or base path.`,
		],
		faqs: [
			{
				q: `Why does the preview work if the deployed site is broken?`,
				a: `The preview runs a development server inside Bolt with your environment variables already loaded and no build step. The deployed site is a separate build on another machine, so anything that only exists inside Bolt is missing there.`,
			},
			{
				q: `What does the MIME type error mean?`,
				a: `The browser asked for a script and got a file it does not recognise as JavaScript, usually a raw .tsx file. It means unbuilt source was uploaded. Build first and deploy dist.`,
			},
			{
				q: `I added the environment variables but it is still blank. Why?`,
				a: `Vite bakes VITE_ variables into the files at build time. Adding them afterwards does nothing until you trigger a new deploy, and names without the VITE_ prefix are never exposed to the browser.`,
			},
		],
		sources: [
			{ label: 'Netlify forum: blank page on live site, working in Bolt preview', url: 'https://answers.netlify.com/t/getting-blank-page-on-live-site-working-in-preview-in-bolt-new/130702' },
			{ label: 'Netlify: deploy your Bolt app to Netlify', url: 'https://www.netlify.com/knowledge-base/deploy-your-bolt-app-to-netlify/' },
			{ label: 'Netlify forum: blank page 404 with React Vite', url: 'https://answers.netlify.com/t/blank-page-404-linking-github-page-react-vite/149982' },
		],
		related: ['bolt/env-variables-not-working-after-deploy', 'bolt/404-on-refresh-netlify'],
		updated: '2026-10-26',
	},
	{
		platform: 'bolt',
		problem: '404-on-refresh-netlify',
		query: 'bolt.new 404 on page refresh',
		title: 'Bolt.new 404 on Refresh on Netlify? Fix It',
		description:
			'Bolt app pages work from the menu but show Netlify "Page not found" on refresh or after a Stripe redirect? Add a _redirects file and republish.',
		h1: 'Bolt.new site shows 404 on refresh: the Netlify fix',
		answer: `A Bolt.new site on Netlify shows "Page not found" on refresh because the app routes pages in the browser and Netlify has no file for /pricing or /success. Add a file at public/_redirects containing /*  /index.html  200 and republish. A rule in netlify.toml often does not help here, because Bolt uploads ready-built files and Netlify skips the build step that reads that file.`,
		symptom: `Moving around the site through its menu works. Refreshing any page other than the homepage, opening a deep link from an email, or returning from Stripe Checkout to /success shows Netlify's "Page not found – Looks like you've followed a broken link or entered a URL that doesn't exist on this site." Customers who just paid land on that page.`,
		causes: [
			{
				title: 'Client-side routing with no fallback',
				body: `Bolt's default React + Vite app has one index.html and swaps pages in the browser. A fresh request for /success reaches Netlify, which looks for a file by that name and finds nothing.`,
			},
			{
				title: 'A netlify.toml rule that never runs',
				body: `Netlify reads [[redirects]] in netlify.toml during its build. Bolt's publish sends files that are already built, so that step is skipped, and the rule sits in the repository doing nothing. People add it, see no change, and assume redirects are broken.`,
			},
			{
				title: 'Return URLs pointing at routes the host cannot serve',
				body: `Stripe and OAuth providers send users to a full URL such as /success?session_id=… as a fresh page load. That is the same as a refresh, so it fails in exactly the same way.`,
			},
		],
		steps: [
			`Create a file called _redirects inside the public folder (public/_redirects, no file extension) with this single line: /*    /index.html   200.`,
			`Republish from Bolt, then open the deployed site's /_redirects address or check the deploy's file list in Netlify to confirm the file made it into the output.`,
			`If you deploy from Git instead, check Site configuration > Build & deploy in Netlify shows npm run build and dist; with a real build, netlify.toml rules work as well.`,
			`Open /success, /pricing and any other important route directly in a private window and press refresh on each.`,
			`Run a Stripe test-mode checkout end to end and confirm the success and cancel pages load after the redirect.`,
			`Ask Bolt for an in-app "page not found" screen so mistyped URLs still look like your site.`,
		],
		prompt: `Add a public/_redirects file containing "/*  /index.html  200" so every route works on refresh and when opened directly, including the Stripe success and cancel URLs. Also add a friendly 404 page inside the app for unknown routes.`,
		verify: [
			`Open each main route in a new private window and refresh it; every one should render your page with HTTP status 200.`,
			`Complete a test-mode Stripe checkout and confirm the return page loads.`,
		],
		scanFlags: [
			`Links from the homepage that come back 404 when loaded directly, the same thing a refresh does.`,
			`What a missing page returns: Netlify's generic error or your own 404 screen.`,
			`Pages behind checkout cannot be reached by the scan, so test the Stripe return URL yourself.`,
		],
		faqs: [
			{
				q: `I added a redirect to netlify.toml. Why is it ignored?`,
				a: `Netlify only processes netlify.toml when it runs the build itself. Files pushed already built, as Bolt does, skip that, so put the rule in public/_redirects, which is copied into dist and read on every deploy.`,
			},
			{
				q: `Does this happen on Bolt Cloud hosting too?`,
				a: `This guide is about Netlify. Bolt now also hosts on its own .bolt.host domains, and how that host treats deep links is not spelled out in Bolt's help center, so test a refresh on your own routes after publishing there.`,
			},
			{
				q: `Is a 200 rewrite bad for SEO?`,
				a: `No, it is the standard setup for single-page apps. Just make sure the app shows a real not-found screen for nonsense URLs and, ideally, sets a noindex tag on it.`,
			},
		],
		sources: [
			{ label: 'Netlify forum: 404 on refresh, bolt.new and netlify.toml', url: 'https://answers.netlify.com/t/production-redirect-running-404-error-on-page-refresh-bolt-new-netlify-toml/143636' },
			{ label: 'Netlify forum: Stripe redirect page gives 404 on a Bolt site', url: 'https://answers.netlify.com/t/deployed-using-bolt-new-when-my-site-tried-to-process-a-stripe-payment-the-redirect-page-gives-404/144283/2' },
			{ label: 'Netlify forum: Bolt site shows "broken link" error', url: 'https://answers.netlify.com/t/bolt-new-site-deploys-but-shows-with-l-ooks-like-you-ve-followed-a-broken-link-or-entered-a-url-that-doesn-t-exist-on-this-site-error/141811' },
		],
		related: ['bolt/blank-page-after-deploy', 'lovable/404-on-refresh-after-export'],
		updated: '2026-10-26',
	},
	{
		platform: 'bolt',
		problem: 'env-variables-not-working-after-deploy',
		query: 'bolt.new environment variables not working netlify',
		title: 'Bolt.new Env Variables Not Working? Fix It',
		description:
			'Login, data or API calls work in the Bolt preview but fail live with "Failed to fetch" or "Invalid API key"? Move the env variables to the host properly.',
		h1: 'Bolt.new environment variables not working after deploy',
		answer: `Bolt.new does not carry its environment variables to Netlify, so a deployed app often runs without its Supabase URL, API keys or other settings. Add each variable in the host's settings, use the VITE_ prefix for anything the browser needs, and trigger a fresh deploy, because Vite writes the values into the files at build time. If calls still fail, the API is probably rejecting your live domain as an origin.`,
		symptom: `Everything that touches a database or API works in the Bolt preview and fails on the live site. You see "Failed to fetch", "Invalid API key", CORS errors in the console, or lists that are simply empty. Static pages are fine, which makes it look like a data problem rather than a deploy problem.`,
		causes: [
			{
				title: 'The variables only exist inside Bolt',
				body: `Bolt's .env file or settings are not copied to Netlify. The deployed build therefore has undefined values wherever the code reads import.meta.env.`,
			},
			{
				title: 'The wrong prefix',
				body: `Vite only exposes variables whose names start with VITE_ to browser code; Next.js uses NEXT_PUBLIC_. A variable named SUPABASE_URL is quietly left out of the bundle.`,
			},
			{
				title: 'Added, but not rebuilt',
				body: `Values are inserted when the site is built. Saving them in the host's dashboard has no effect on a deploy that already exists.`,
			},
			{
				title: 'The live domain is not an allowed origin',
				body: `Some APIs, and Supabase auth redirects, only accept requests from origins you list. The preview address was allowed; the new domain was never added.`,
			},
		],
		steps: [
			`List every variable the app reads: search the code for import.meta.env and process.env, and compare against the .env file in Bolt.`,
			`In Netlify open Site configuration > Environment variables and add each key with its value, or run netlify env:set KEY value from the CLI.`,
			`Rename any variable the browser needs so it starts with VITE_, and update the code to match. Keep secrets that must stay private, such as service keys, out of the frontend entirely and move that logic to a server function.`,
			`Trigger a new deploy (Deploys > Trigger deploy > Clear cache and deploy site) so the build picks up the values.`,
			`Add your live domain to the API's allowed origins, and to Supabase's Redirect URLs if sign-in is involved.`,
			`Reload the live site with DevTools > Network open and check each API call returns a 2xx status.`,
		],
		prompt: `List every environment variable this app needs in production, say which are safe for the browser (VITE_ prefix) and which must stay server-only, and make the app show a clear error banner if a required variable is missing instead of failing silently.`,
		verify: [
			`On the live site, DevTools > Network should show API calls returning 200 with no CORS errors in the console.`,
			`Open DevTools > Sources and search the loaded JavaScript for "service_role" or "sk_" to make sure no secret key was exposed while fixing this.`,
		],
		scanFlags: [
			`Failed network requests and CORS errors in the console on the live page.`,
			`Empty lists or sections where data should appear, visible in the screenshots.`,
			`The scan cannot read your host's variables; it reports the visitor-side failure they cause.`,
		],
		faqs: [
			{
				q: `Is it safe to put a VITE_ variable in the browser?`,
				a: `Only for values designed to be public, like a Supabase anon key protected by Row Level Security or a publishable Stripe key. Anything prefixed VITE_ can be read by every visitor, so secret keys must live in a server function.`,
			},
			{
				q: `Why do I need to redeploy after adding variables?`,
				a: `Vite replaces each import.meta.env reference with the actual value when it builds. The existing deploy was built without them, so only a new build includes them.`,
			},
			{
				q: `Does this apply if I publish on Bolt Cloud instead of Netlify?`,
				a: `Bolt Cloud keeps secrets in the project's database settings, which the app reads on Bolt's own hosting. This guide is for moving the app to Netlify or another host, where you set the variables yourself.`,
			},
		],
		sources: [
			{ label: 'Netlify: deploy your Bolt app to Netlify', url: 'https://www.netlify.com/knowledge-base/deploy-your-bolt-app-to-netlify/' },
			{ label: 'KrishaWeb: fixing a Bolt app', url: 'https://www.krishaweb.com/blog/fix-bolt-app.md' },
		],
		related: ['bolt/blank-page-after-deploy', 'bolt/google-sign-in-not-working'],
		updated: '2026-10-26',
	},
	{
		platform: 'bolt',
		problem: 'custom-domain-not-connecting',
		query: 'bolt.new custom domain not working',
		title: 'Bolt.new Custom Domain Not Connecting? Fix It',
		description:
			'Bolt says the domain is already in use, or your site shows an SSL error or the old page? Fix the site-dns.bolt.host records and release old Netlify links.',
		h1: 'Bolt.new custom domain not connecting: causes and fixes',
		answer: `A Bolt.new custom domain fails to connect when the project is not published yet, the records do not point at site-dns.bolt.host, an AAAA record was used, or the domain is still attached to an old Netlify site. Publish, then set the root to an ALIAS, ANAME or flattened CNAME and www to a CNAME, both pointing at site-dns.bolt.host as Bolt's docs describe. Remove the domain from any old host and check the Status column in Domains & Hosting after a few hours.`,
		symptom: `In Bolt you see a warning that another project is already using the domain, that it is in use on Netlify, or that ownership cannot be verified. Or the domain seems connected but visitors get an SSL warning or your old site. Custom domains are a paid Bolt feature, so the option may also be missing entirely on a free account.`,
		causes: [
			{
				title: 'Record type or target is wrong',
				body: `Bolt's help center asks for a CNAME on www and an ALIAS, ANAME or flattened CNAME on the root, all pointing at site-dns.bolt.host. Many registrars default to an A or AAAA record, and Bolt warns that AAAA will not connect the domain.`,
			},
			{
				title: 'Still claimed by an old Netlify site',
				body: `Earlier Bolt deploys went to Netlify. If the domain is still added to that Netlify site, Bolt reports it as already used, and a domain bought through Netlify may need Netlify support to release it.`,
			},
			{
				title: 'The project is not published',
				body: `Bolt only lets you connect a domain to a published project. Before the first publish, the option to connect a domain does not appear.`,
			},
			{
				title: 'DNS half finished, so SSL fails',
				body: `If www points at Bolt but the root still points elsewhere, or the TXT record for a subdomain is missing, the certificate cannot be issued for every name and visitors see a security warning.`,
			},
		],
		steps: [
			`Publish the project, then open the gear icon > All project settings > Domains & Hosting and click Connect a domain you own. Enter the domain and click Verify and add domain, keeping the DNS screen open.`,
			`At your registrar or DNS host, set www as a CNAME to site-dns.bolt.host and the root as ALIAS, ANAME or flattened CNAME to site-dns.bolt.host. Confirm the current target in Bolt's own DNS screen before saving, since hosting targets can change.`,
			`Delete any AAAA records and any old A or CNAME records on those names that point at Netlify or a previous host.`,
			`For a subdomain such as app.yourdomain.com, add the TXT record Bolt shows and click Verify and add subdomain; that record usually becomes visible within minutes.`,
			`If Bolt says the domain is in use, log in to Netlify (or the other service), open its domain management for the old site and remove the domain, then reconnect it in Bolt.`,
			`Return to Domains & Hosting and read the Status column. Most domains connect within a few hours; Bolt says some take up to 24. Check status.bolt.new if nothing moves.`,
		],
		prompt: `No code change is needed for this; it is a DNS fix. If you want a checklist, ask Bolt: "List the DNS records my custom domain needs for Bolt hosting and anything I should remove from my old Netlify site."`,
		verify: [
			`Look up the root and www on a public DNS checker; both should resolve through site-dns.bolt.host with no AAAA records.`,
			`Open https://yourdomain.com and https://www.yourdomain.com in a private window on a laptop and a phone; both should load your Bolt site with no certificate warning.`,
		],
		scanFlags: [
			`A certificate error or failed load when the scan opens the domain over HTTPS.`,
			`The wrong site in the screenshots, such as your old Netlify version or a registrar page.`,
			`Scanning root and www separately shows whether both names reach the new site; the scan does not read DNS itself.`,
		],
		faqs: [
			{
				q: `My registrar does not offer ALIAS or ANAME. What now?`,
				a: `Some registrars only support A and CNAME records. You can move DNS hosting to a provider that offers flattened CNAMEs, such as Cloudflare, and keep the registration where it is, or ask your registrar's support what they offer at the root.`,
			},
			{
				q: `I moved from Bolt hosting to Netlify. Why did the domain stop working?`,
				a: `Domains do not move automatically between Bolt and Netlify. Reconnect it in Netlify's Domain management, and remove it from Bolt so the two do not compete.`,
			},
			{
				q: `Do I need a paid Bolt plan for a custom domain?`,
				a: `Yes. Bolt's help center says Free and Pro can both publish to a .bolt.host address, while custom domains are for paid plans.`,
			},
		],
		sources: [
			{ label: 'Bolt help center: connect a domain', url: 'https://support.bolt.new/cloud/domains/connect.md' },
			{ label: 'Bolt help center: domain issues', url: 'https://support.bolt.new/troubleshooting/domain-issues.md' },
		],
		related: ['bolt/site-not-on-google', 'bolt/site-offline-hosting-limit'],
		updated: '2026-10-26',
	},
	{
		platform: 'bolt',
		problem: 'google-sign-in-not-working',
		query: 'bolt.new google login not working',
		title: 'Bolt.new Google Sign-In Not Working? Fix It',
		description:
			'Continue with Google fails in your Bolt app with redirect_uri_mismatch, does nothing in preview, or only works for some accounts? Here is how to fix it.',
		h1: 'Bolt.new Google sign-in not working: causes and fixes',
		answer: `Google sign-in in a Bolt.new app fails for three reasons: the origin or redirect URI in Google Cloud does not exactly match what Bolt's Authentication screen shows, you are testing inside the Bolt preview where Google blocks the sign-in window, or the Google app is still in Testing mode and only lets listed users in. Copy the values from Bolt into your OAuth client, add your custom domain as an origin, test on the published site and publish the app in Google Auth Platform.`,
		symptom: `Clicking Continue with Google shows "Error 400: redirect_uri_mismatch", or nothing happens at all when you click inside Bolt. On the published site it works for you and a colleague but strangers get "Access blocked" or a message that the app has not completed verification.`,
		causes: [
			{
				title: 'Origin or redirect URI does not match',
				body: `Google compares the request against the exact list in your OAuth client. A missing https, a trailing slash, the bolt.host address listed but not your custom domain, or a typo in the redirect URI is enough for Google to refuse.`,
			},
			{
				title: 'Testing inside the preview iframe',
				body: `Bolt's help center notes that Google's OAuth flow blocks iframes, so sign-in will not work in the Bolt Preview window. It looks broken there even when the setup is correct.`,
			},
			{
				title: 'The Google app is still in Testing',
				body: `New OAuth apps start in Testing mode, which Google limits to up to 100 users. Anyone outside that group is turned away until you publish the app.`,
			},
		],
		steps: [
			`In Bolt, click the database icon, open Authentication > Continue with Google and switch on Enable Google Sign In. Note the authorised JavaScript origin and the redirect URI it displays.`,
			`In Google Cloud Console, open your project's OAuth client (Web application). Paste the redirect URI into Authorized redirect URIs exactly, and the bolt.host address into Authorized JavaScript origins.`,
			`Add your custom domain, with https:// and no trailing slash, as a further Authorized JavaScript origin. Bolt's docs note you may need several origins depending on your domain setup.`,
			`Copy the Client ID and Client Secret from Google into the matching fields on Bolt's Continue with Google screen and save.`,
			`Publish the Bolt project and open the published URL in a new browser tab. Test sign-in there, never in the preview pane.`,
			`In Google Auth Platform, fill in Branding and then use Audience to publish the app to production so any Google account can sign in.`,
		],
		prompt: `Make Google sign-in redirect back to window.location.origin after login, and show any OAuth error message on screen instead of failing silently. Do not change any other auth behaviour.`,
		verify: [
			`On the published custom domain, in a private window, sign in with a Google account that was never added as a test user.`,
			`Repeat on a phone, and confirm you land back on your site signed in rather than on an error page.`,
		],
		scanFlags: [
			`Console errors and failed requests on the public sign-in page.`,
			`A sign-in button that is the main call to action but leads to an error page, which the CTA check reports.`,
			`The scan never signs in with a Google account, so it cannot complete the flow; it shows what happens up to that point.`,
		],
		faqs: [
			{
				q: `Why does Google sign-in do nothing in the Bolt preview?`,
				a: `The preview runs inside an iframe, and Google blocks its sign-in flow from loading in one. Publish and test in a normal browser tab.`,
			},
			{
				q: `What is redirect_uri_mismatch?`,
				a: `Google received a redirect address that is not in your OAuth client's list. Copy the redirect URI from Bolt's Authentication screen character for character, including https and any path.`,
			},
			{
				q: `Do I need Google to verify my app?`,
				a: `Plain sign-in does not need scope verification, but you do need to publish the app under Audience to leave Testing mode. Verification is only required if you request extra Google data such as Drive or Calendar access.`,
			},
		],
		sources: [
			{ label: 'Bolt help center: Google sign-in', url: 'https://support.bolt.new/integrations/google-sso.md' },
			{ label: 'Bolt help center: login issues', url: 'https://support.bolt.new/troubleshooting/login-issues.md' },
		],
		related: ['bolt/env-variables-not-working-after-deploy', 'bolt/custom-domain-not-connecting'],
		updated: '2026-10-26',
	},
	{
		platform: 'bolt',
		problem: 'emails-not-sending',
		query: 'bolt.new emails not sending',
		title: 'Bolt.new Emails Not Sending? Fix It',
		description:
			'Contact form or sign-up emails from your Bolt app never arrive? Fix the RESEND_API_KEY secret, verify your domain, and set up SMTP for auth emails.',
		h1: 'Bolt.new emails not sending: contact forms and auth emails',
		answer: `Emails from a Bolt.new app usually fail because the RESEND_API_KEY secret is missing or misspelt, the sending domain is not verified in Resend, or the project is not published on a custom domain, which Bolt lists as a prerequisite. Auth emails like password resets are a separate case: they come from Supabase's default sender until you claim the database and turn on custom SMTP. Fix the secret first, then the domain.`,
		symptom: `People submit your contact form and nothing reaches you, or new users never get a confirmation email. In the Bolt editor you may see "The following secrets are used in the code but don't exist yet: RESEND_API_KEY". Password reset emails might arrive, but from a generic Supabase address that looks like spam.`,
		causes: [
			{
				title: 'The secret is missing or misnamed',
				body: `Bolt reads the key from a secret named exactly RESEND_API_KEY, and the name is case-sensitive. resend_api_key or a key pasted into the code does not count.`,
			},
			{
				title: 'The sending domain is not verified',
				body: `Resend needs DNS records on the domain you send from. Until they verify, sends fail or fall back to restrictions that only allow mail to your own address.`,
			},
			{
				title: 'No published custom domain',
				body: `Bolt's email guide lists a published project with a custom domain as a prerequisite. An unpublished project or one still in preview cannot complete the setup.`,
			},
			{
				title: 'Auth emails ignore your SMTP settings',
				body: `For Bolt-managed databases, Bolt's docs say SMTP settings save but emails still come from Supabase's address until you claim the database into your own Supabase account.`,
			},
		],
		steps: [
			`Create an API key at Resend and copy it straight away; it may not be shown again.`,
			`In Bolt, click the database icon, open Secrets in the left menu and create RESEND_API_KEY with the key as its value. If Secrets is missing, the project has no database yet.`,
			`In Resend, go to Domains > Add Domain, enter your primary domain and add the DNS records it lists. For a domain bought through Bolt, add them under profile icon > Settings > Cloud > Custom domains > Open domain settings.`,
			`Wait for verification, usually 10 to 20 minutes according to Bolt, occasionally a few hours. Then make sure the code's from address uses that verified domain.`,
			`Trigger an email from the live app and check Resend's logs and your Bolt project logs for server function errors.`,
			`For auth emails, click the database icon > Advanced > Claim, then in Supabase enable custom SMTP under Authentication > Email > SMTP Settings with host smtp.resend.com, port 465, user resend and a separate Resend key.`,
		],
		prompt: `My contact form must email me@example.com via Resend from a server function, using the RESEND_API_KEY secret and the from address hello@example.com on my verified domain. Show the success message only after the function returns OK, otherwise show a clear error, and disable the button while it sends.`,
		verify: [
			`Submit the live form and check both inbox and spam, then confirm the send appears in Resend's delivery logs.`,
			`Run Forgot password on the live site and check the email comes from your own domain.`,
		],
		scanFlags: [
			`Whether an empty form submission shows validation messages or silently does nothing.`,
			`Console errors and failed requests on the page with the form.`,
			`The scan does not send real messages or read inboxes, so delivery itself has to be tested by hand.`,
		],
		faqs: [
			{
				q: `Do I need a custom domain to send email from Bolt?`,
				a: `For app emails through Resend, Bolt's guide lists a published project with a custom domain as a prerequisite, and you send from a domain you have verified. That also keeps your mail out of spam.`,
			},
			{
				q: `Why do password reset emails come from Supabase?`,
				a: `Auth emails use Supabase's built-in sender until custom SMTP is active. On a Bolt-managed database, you have to claim it into your own Supabase account before SMTP settings take effect.`,
			},
			{
				q: `Can I use the same Resend key for SMTP?`,
				a: `Bolt recommends a separate key for Supabase SMTP. It keeps the two uses apart and lets you revoke one without breaking the other.`,
			},
		],
		sources: [
			{ label: 'Bolt help center: send emails', url: 'https://support.bolt.new/bolt-cloud/database/send-emails.md' },
			{ label: 'Resend: 403 error with the resend.dev domain', url: 'https://resend.com/docs/knowledge-base/403-error-resend-dev-domain' },
		],
		related: ['bolt/custom-domain-not-connecting', 'lovable/contact-form-not-sending'],
		updated: '2026-10-26',
	},
	{
		platform: 'bolt',
		problem: 'site-offline-hosting-limit',
		query: 'bolt.new site stopped working',
		title: 'Bolt.new Site Stopped Working? Check Limits',
		description:
			'Your Bolt site worked, then stopped loading for visitors partway through the month? Check hosting limits, the spending cap, status and network blocks.',
		h1: 'Bolt.new site stopped working: hosting limits and other causes',
		answer: `A Bolt.new site that suddenly stops loading mid-month has often hit its hosting allowance: Bolt's help center says Free sites go offline until usage resets at the next billing cycle, and Pro sites pause when they reach the spending cap you set. Limits are shared by every site on the account. If you are within limits, check status.bolt.new for an incident, and test from mobile data in case a network is blocking .bolt.host.`,
		symptom: `The site loaded fine for weeks, then visitors report it is down, or it fails only for some of them. You did not publish anything new. Some people see ERR_SSL_PROTOCOL_ERROR or a connection error on one network while it works on another.`,
		causes: [
			{
				title: 'Free plan hosting allowance used up',
				body: `Bolt's plans page lists the Free allowance as 10 GB of bandwidth and 333,333 requests a month (as of October 2026), with a hard stop. When it is reached, the site stays offline until the next billing cycle.`,
			},
			{
				title: 'Pro spending cap reached',
				body: `Pro includes a larger allowance and pay-as-you-go beyond it, up to a cap you choose. Bolt says once the cap is reached, the site pauses until usage resets.`,
			},
			{
				title: 'Another site on the account used the allowance',
				body: `Limits are account-wide. A demo with a large video, or a project that suddenly got traffic, can take a quiet business site offline with it.`,
			},
			{
				title: 'A network block or a platform incident',
				body: `Some school, office or country filters block .bolt.host addresses, which shows as an SSL protocol error. A Bolt outage looks similar, so check status.bolt.new before changing anything.`,
			},
		],
		steps: [
			`Check status.bolt.new for an active hosting incident first; if there is one, wait for it to clear.`,
			`Open the site on your phone over mobile data. If it works there but not on a particular Wi-Fi network, that network is blocking .bolt.host and a custom domain is the long-term fix.`,
			`Review hosting usage for your account and plan, and confirm the current limits on Bolt's hosting plans page, since numbers change. Bolt's docs do not say where usage is shown, so contact support if you cannot find it.`,
			`On Pro, raise the cap at profile icon > Settings > Cloud > Change spending limit. On Free, upgrading is the only way to bring a site back before the reset.`,
			`Unpublish demos and old experiments you no longer need so they stop using the shared allowance.`,
			`Cut page weight: compress images, serve them at display size, and host large video on a video platform rather than in the project.`,
		],
		prompt: `Reduce this site's bandwidth: convert images to WebP, resize them to the size they are displayed at, lazy-load images and videos below the fold, and replace any self-hosted video files with an embed from an external video host. Do not change the design.`,
		verify: [
			`Load the site from two different networks, such as home Wi-Fi and mobile data.`,
			`Set up a free uptime monitor on the homepage so you hear about the next outage before customers do.`,
		],
		scanFlags: [
			`The site failing to load, or returning an error page, when the scan visits it.`,
			`A low PageSpeed performance score and heavy images, which use up hosting bandwidth fastest.`,
			`It cannot see your Bolt usage or billing, only whether visitors currently get the site.`,
		],
		faqs: [
			{
				q: `What do visitors see when a Bolt site hits its limit?`,
				a: `Bolt's help center says the site stops displaying publicly but does not describe the exact page visitors get. Treat any sudden mid-month outage as a reason to check usage.`,
			},
			{
				q: `Do limits apply per site or per account?`,
				a: `Per account. All published sites share the same monthly bandwidth and request allowance, so one busy project affects the others.`,
			},
			{
				q: `How do I stop it happening again?`,
				a: `Keep business sites on a paid plan with a sensible spending cap, remove unused projects, keep images light, and run an uptime monitor so you know within minutes rather than days.`,
			},
		],
		sources: [
			{ label: 'Bolt help center: hosting plans', url: 'https://support.bolt.new/bolt-cloud/hosting/plans.md' },
			{ label: 'Bolt help center: troubleshoot hosting', url: 'https://support.bolt.new/cloud/hosting/troubleshoot-host' },
		],
		related: ['bolt/custom-domain-not-connecting', 'bolt/blank-page-after-deploy'],
		updated: '2026-10-26',
	},
	{
		platform: 'bolt',
		problem: 'site-not-on-google',
		query: 'bolt.new site not showing on google',
		title: 'Bolt.new Site Not Showing on Google? Fix It',
		description:
			'Your Bolt.new site is live but Google ignores it, and view-source is almost empty? How JavaScript rendering, missing tags and a bolt.host URL get in the way.',
		h1: 'Bolt.new site not showing on Google: causes and fixes',
		answer: `A Bolt.new site often stays out of Google because the default React + Vite build sends an almost empty HTML file and fills it with JavaScript, the pages have no individual titles or descriptions, there is no sitemap, and the site still lives on a .bolt.host address. Find out whether your Bolt hosting plan pre-renders pages, add per-page metadata, generate sitemap.xml and robots.txt, move to a custom domain and submit it in Search Console.`,
		symptom: `Searching for your business name finds nothing from your site. When you right-click and choose View Page Source, you see a short file with a single empty div and some script tags instead of your text. Link previews in social apps are blank or generic.`,
		causes: [
			{
				title: 'Content arrives only after JavaScript runs',
				body: `Bolt generates React and Vite apps by default. The first HTML is nearly empty and the content appears when scripts run, which Google can usually handle with delay but many other crawlers and preview bots cannot.`,
			},
			{
				title: 'Unclear pre-rendering on Bolt hosting',
				body: `Bolt's August 2025 launch post promised automatic SEO pre-rendering on Bolt Cloud, while a September 2026 review describes pre-rendering as a paid "SEO Boosting" feature. Bolt's help center does not settle it, so check what your plan includes.`,
			},
			{
				title: 'No per-page metadata or crawler files',
				body: `Bolt's help center does not document meta tags, sitemaps or robots.txt as features it generates. Unless you prompted for them, every page may share one title and there may be no sitemap at all.`,
			},
			{
				title: 'A temporary-looking address',
				body: `A .bolt.host subdomain works, but a custom domain gives Google a stable home to rank and lets you verify it properly in Search Console.`,
			},
		],
		steps: [
			`View the source of your homepage (Ctrl+U). If your headline text is not in there, crawlers that skip JavaScript see an empty page.`,
			`Check your Bolt plan and hosting settings for pre-rendering or "SEO Boosting", and ask Bolt support whether it is active for your project, since public sources disagree.`,
			`Ask Bolt to add a unique title, meta description, canonical URL and Open Graph tags to every page.`,
			`Have it generate /sitemap.xml with absolute URLs on your custom domain and a robots.txt that allows crawling and names the sitemap.`,
			`Connect a custom domain, verify it in Google Search Console, submit the sitemap and use URL Inspection > Request indexing on the main pages.`,
			`For pure marketing pages that never change, consider plain static HTML pages, which need no rendering help at all.`,
		],
		prompt: `Add a unique title, meta description, canonical URL and Open Graph tags to every page, generate sitemap.xml and robots.txt for https://example.com, and make sure the main text of each page is present in the HTML that is served before JavaScript runs if the setup allows it. Do not change the design.`,
		verify: [
			`View page source on the homepage and one inner page; the main text and a page-specific title should be in the raw HTML.`,
			`Open /robots.txt and /sitemap.xml on your domain; both should load.`,
			`In Search Console, URL Inspection > View crawled page should show your real content, not an empty shell.`,
		],
		scanFlags: [
			`Missing title, meta description or canonical in the rendered homepage.`,
			`A noindex tag, or Open Graph tags that are absent.`,
			`Console errors that would leave crawlers with nothing to render.`,
			`It does not check Google's index itself; it shows whether the page gives Google what it needs.`,
		],
		faqs: [
			{
				q: `Does Bolt.new pre-render pages for SEO?`,
				a: `Sources conflict. Bolt's 2025 Bolt Cloud announcement described automatic SEO pre-rendering, and a 2026 independent review describes it as a paid feature. Ask Bolt support what applies to your plan and confirm with View Source or Search Console's crawled page.`,
			},
			{
				q: `Can Google index a JavaScript app anyway?`,
				a: `Google can render JavaScript, but it does so later and less reliably than plain HTML, and many other search and AI crawlers do not run scripts at all. Content in the initial HTML is the safer bet.`,
			},
			{
				q: `Is a .bolt.host address bad for SEO?`,
				a: `It can be indexed, but you do not own it and it is harder to build trust on. Move to your own domain before you start promoting the site.`,
			},
		],
		sources: [
			{ label: 'Bolt blog: Bolt Cloud launch', url: 'https://bolt.new/blog/bolt-cloud' },
			{ label: 'J.A. Watte: bolt.new SEO, AEO and GEO', url: 'https://jwatte.com/blog/bolt-new-seo-aeo-geo-do-it-yourself.md' },
		],
		related: ['bolt/custom-domain-not-connecting', 'bolt/blank-page-after-deploy'],
		updated: '2026-10-26',
	},
	// ───────────────────────────── Base44 ─────────────────────────────
	{
		platform: 'base44',
		problem: 'site-not-on-google',
		query: 'base44 not showing on google',
		title: 'Base44 App Not Showing on Google? Fix It',
		description:
			'Your Base44 app is missing from Google or shows a thin summary in results? Check SEO & GEO settings, page visibility, login walls and proxied DNS.',
		h1: 'Base44 app not showing on Google: causes and fixes',
		answer: `Base44 apps render in the browser, so Base44 serves crawlers a pre-rendered copy of each page, and the usual reasons for missing from Google sit around that copy: SEO switched off or a page's Search visibility toggled off, no custom domain, content that needs a login, or a proxied domain that stops Base44 refreshing the copy after you publish. Fix those in Dashboard > SEO & GEO and your domain settings, then submit the sitemap in Search Console.`,
		symptom: `Your app does not appear when you search for it, or Google shows a vague summary with just a heading and links instead of your real page text. Listings or records that should each have their own result are missing. Changes you published weeks ago still are not reflected in what Google shows.`,
		causes: [
			{
				title: 'SEO or page visibility switched off',
				body: `Turning off Enable SEO for this app stops Base44's SEO tags and files and asks search engines not to index the app. A page with Search visibility off is dropped from the sitemap and given a noindex tag.`,
			},
			{
				title: 'Crawlers get a summary, not the page',
				body: `Base44's docs explain that a page not yet rendered is served to crawlers as a short summary, and that copies are marked outdated on publish and rebuilt in the background. New pages and fresh changes take a while to reach Google.`,
			},
			{
				title: 'Records and pages behind sign-in',
				body: `Data-driven pages need their records to be readable by anyone, otherwise crawlers only see a general summary. If the whole app needs a login, there is nothing public to index.`,
			},
			{
				title: 'Free URL or proxied domain',
				body: `Base44 says SEO is designed for apps on a custom domain. If that domain runs through a proxy, Base44 cannot confirm it and publishing will not refresh the crawler copies.`,
			},
		],
		steps: [
			`Open Dashboard > SEO & GEO (under Marketing) and make sure Enable SEO for this app is on. In the Meta tags tab, open Page search settings and check Search visibility for every page you want found.`,
			`Set titles, descriptions and social images for the main pages, or leave Automatic titles and descriptions on and review what it wrote.`,
			`Connect a custom domain if you are still on the free Base44 address. In Cloudflare or any DNS host with a proxy, set the Base44 records to DNS only.`,
			`Check data permissions for the entities behind your public pages, and make only the records that are genuinely public readable without login.`,
			`Connect Google Search Console from the SEO & GEO screen, submit /sitemap.xml, then use URL Inspection > Request indexing on the homepage and key pages.`,
			`If you turned the main SEO toggle off and on again, revisit each page's Search visibility, because pages that were off stay hidden.`,
		],
		prompt: `Make my public pages search-friendly: write a unique title and meta description for each public page, make sure the landing page, pricing and listings are visible without logging in, and add Organization and FAQ structured data where it fits. Do not make any private user data public.`,
		verify: [
			`Open /sitemap.xml and /robots.txt on your custom domain and check your public pages are listed.`,
			`Open your main pages in a private window and confirm they show without a login prompt.`,
			`In Search Console, URL Inspection on a key page should show the real page content after recrawl.`,
		],
		scanFlags: [
			`A noindex tag on the homepage, or missing title and description.`,
			`A login wall where a public landing page should be, seen by the scan's logged-out browser.`,
			`Duplicate titles across pages in a paid multi-page report.`,
		],
		faqs: [
			{
				q: `Does Base44 support SEO at all?`,
				a: `Yes, through pre-rendered copies served to crawlers, an automatic sitemap and robots.txt, and the SEO & GEO dashboard. Base44's own docs say it is intended for apps on a custom domain.`,
			},
			{
				q: `Why does Google show old content after I published?`,
				a: `Publishing marks Base44's saved copies as outdated and rebuilds them in the background, and Google only picks up the new copy when it recrawls. Request indexing on the page to nudge it.`,
			},
			{
				q: `Can I use my own sitemap?`,
				a: `Yes. Turn off Sitemap under Search engine files in the Advanced settings tab and deploy public/sitemap.xml; otherwise that address returns 404.`,
			},
		],
		sources: [
			{ label: 'Base44 docs: SEO and search visibility', url: 'https://docs.base44.com/Guides/SEO-and-search-visibility' },
			{ label: 'Base44 feedback: server-side rendering request', url: 'https://feedback.base44.com/p/server-side-rendering-ssr-for-base44-apps-critical-for-seo' },
		],
		related: ['base44/visitors-forced-to-log-in', 'base44/custom-domain-not-working'],
		updated: '2026-10-26',
	},
	{
		platform: 'base44',
		problem: 'form-email-not-sending',
		query: 'base44 email not sending',
		title: 'Base44 Form Email Not Sending? Fix It',
		description:
			'Base44 form submissions do not email you or the visitor? Learn who SendEmail can reach on each plan, the daily limits, and where failures are logged.',
		h1: 'Base44 email not sending: forms, visitors and limits',
		answer: `Base44's built-in SendEmail only reaches registered app users on the Free plan, so emails to a visitor who filled in a form are not sent. Emailing non-registered people needs a paid plan and a verified custom domain, and Base44 limits those sends to 20 new people a day and 3 emails per person a day. The workflow Send email step only reaches registered users on any plan. Your app logs say which rule blocked a message.`,
		symptom: `Someone submits your contact or booking form and the confirmation never arrives for them, or the owner notification goes missing. Emails to your own account work fine. Messages that do arrive come from no-reply@base44-apps.com and sometimes land in spam.`,
		causes: [
			{
				title: 'The recipient is not a registered user',
				body: `On Free, SendEmail can only email people registered in the app. A visitor who only filled in a form is not one, so the email is not sent.`,
			},
			{
				title: 'Daily limits for non-registered recipients',
				body: `On a paid plan with a verified domain, Base44's docs (as of October 2026) cap sends at 20 new people a day and 3 emails per person a day, with an hourly limit as well. Extra emails are delayed by hours.`,
			},
			{
				title: 'The workflow email step',
				body: `The Send email step in workflows reaches only registered users, whatever the plan. Emailing anyone else from a workflow needs a backend function step instead.`,
			},
			{
				title: 'Sent but filtered as spam',
				body: `Built-in mail goes out from no-reply@base44-apps.com. Without a custom email domain, some inboxes treat it with suspicion.`,
			},
		],
		steps: [
			`Open your app logs in Base44 and find the failed send. Base44 records the reason, such as plan, missing custom domain or a send limit.`,
			`Decide who needs the email. If it is only you, make sure your address belongs to a registered user of the app, and SendEmail works on any plan.`,
			`To email visitors, upgrade to a paid plan and connect and verify the custom domain the app is served on.`,
			`Move visitor emails out of workflow Send email steps and into a backend function step.`,
			`For volume above the built-in limits, connect Resend through the integrations catalog on Builder or above and describe the email flow to the AI chat.`,
			`Set up a custom email domain on the Domains page (Builder plan and above) so mail comes from your own address.`,
		],
		prompt: `When the contact form is submitted, save it to a ContactMessage entity and email the details to me (I'm a registered user of this app) using SendEmail. Show a success message only after the record is saved, show an error if anything fails, and do not try to email the visitor.`,
		verify: [
			`Submit the live form, then check the ContactMessage records, your inbox and spam folder, and the app logs.`,
			`If you email visitors, test with an address that is not registered in the app and confirm it arrives.`,
		],
		scanFlags: [
			`Whether the form gives validation feedback when submitted empty.`,
			`Console errors or failed requests on the form page.`,
			`The scan does not fill in real data or check inboxes, so it cannot see Base44's send limits being hit.`,
		],
		faqs: [
			{
				q: `Why do emails reach me but not my visitors?`,
				a: `You are a registered user and they are not. Free plans only email registered users; reaching visitors needs a paid plan and a verified custom domain.`,
			},
			{
				q: `Can I change the no-reply sender address?`,
				a: `Not for built-in mail; you can only change the display name. A custom email domain, available from the Builder plan, lets you send from your own address.`,
			},
			{
				q: `Why are some emails arriving hours late?`,
				a: `You likely passed the daily or hourly limit for non-registered recipients. Base44 delays emails beyond the limit rather than dropping them.`,
			},
		],
		sources: [
			{ label: 'Base44 docs: sending emails', url: 'https://docs.base44.com/he/documentation/building-your-app/sending-emails.md' },
			{ label: 'Base44 feedback: email to visitors', url: 'https://feedback.base44.com/p/email-to-visitors' },
		],
		related: ['base44/custom-domain-not-working', 'base44/visitors-forced-to-log-in'],
		updated: '2026-10-26',
	},
	{
		platform: 'base44',
		problem: 'custom-domain-not-working',
		query: 'base44 custom domain not working',
		title: 'Base44 Custom Domain Not Working? Fix It',
		description:
			'Base44 domain stuck on Pending verification, showing 502 Bad Gateway, an SSL error or a parking page? The records Base44 expects and what to remove.',
		h1: 'Base44 custom domain not working: causes and fixes',
		answer: `A Base44 custom domain that stays on Pending verification or shows errors almost always has the wrong records, leftover records, or a proxy in the way. Base44's docs ask for an ANAME or ALIAS at the root to base44.onrender.com (or an A record when ALIAS is not offered) and a CNAME on www to the same target; check the current values under DNS instructions. Remove AAAA records, parking and forwarding, set Cloudflare to DNS only, then click Verify.`,
		symptom: `The Domains page in Base44 says Pending verification for hours. Visitors see a 502 Bad Gateway, a certificate warning, the registrar's parking page or your old site. New pages sometimes return 404 on the custom domain while the Base44 address works.`,
		causes: [
			{
				title: 'Records that point somewhere else',
				body: `Base44's docs (as of October 2026) list ANAME or ALIAS at @ pointing to base44.onrender.com, or A at @ to 216.24.57.1 if your provider lacks ALIAS, and CNAME at www to base44.onrender.com. Typing the full domain in the host field instead of @ or www is a common slip.`,
			},
			{
				title: 'Hidden leftovers',
				body: `Old A records, AAAA records, or registrar forwarding and parking features add their own records. Base44 notes these can block verification or send visitors to the old site.`,
			},
			{
				title: 'A proxy in front of Base44',
				body: `With Cloudflare's orange cloud on, Base44 cannot confirm the domain. Its docs warn proxied records can make new pages 404 and stop crawler copies refreshing.`,
			},
			{
				title: 'Registrar-side blocks',
				body: `A CAA record that excludes Base44's certificate authorities, a DNSSEC record left over from an old DNS host, or a domain on clientHold at the registrar all keep the domain from going live.`,
			},
		],
		steps: [
			`In the app editor, open Dashboard > Domains, click More actions next to the domain and choose DNS instructions. Copy the values from the ANAME/ALIAS or A record tab.`,
			`Make the change where your nameservers point (Cloudflare if they point there, not the registrar). Enter only @ or www in the host field.`,
			`Delete any other A record on the root, every AAAA record, and any www CNAME that points elsewhere. Switch off URL forwarding and parking at the registrar.`,
			`In Cloudflare or any proxying DNS host, set the Base44 records to DNS only.`,
			`If SSL still fails, review CAA records, and if you moved DNS hosts recently, update or remove the DNSSEC DS record at the registrar. Run a WHOIS lookup to rule out clientHold.`,
			`Click the refresh icon next to the domain or More actions > Verify. DNS can take up to 48 hours; track it on whatsmydns.net rather than editing again.`,
		],
		prompt: `No prompt is needed: this is fixed at your DNS provider, not in the app. Base44 can also add the records for you through Set up DNS for me if your provider supports it.`,
		verify: [
			`Open https://yourdomain.com and https://www.yourdomain.com in a private window; both should load the app with no warning.`,
			`Check the Domains page shows Verified, then publish a small change and confirm it appears on the custom domain.`,
		],
		scanFlags: [
			`Server errors such as 502 when the scan loads the domain.`,
			`A failed HTTPS load or certificate problem on the address you scan.`,
			`Screenshots that show a parking page or the old site instead of your app; the scan cannot inspect the DNS records behind it.`,
		],
		faqs: [
			{
				q: `Which Base44 plan do I need for a custom domain?`,
				a: `Base44's docs say custom domains are available on Starter and higher. Connecting a domain you already own adds no Base44 charge beyond the plan.`,
			},
			{
				q: `Why does my domain show 502 Bad Gateway?`,
				a: `Typically the records point at Base44 but something in between, often a proxy or a stale record, breaks the connection. Set records to DNS only, remove extras and verify again; if it persists after propagation, contact Base44 support with screenshots.`,
			},
			{
				q: `Does connecting the root also connect www?`,
				a: `Yes, Base44 connects the www version along with the root, as long as the www CNAME exists. Wildcard subdomains are not supported, so add each subdomain separately.`,
			},
		],
		sources: [
			{ label: 'Base44 docs: connecting an external domain', url: 'https://docs.base44.com/he/Setting-up-your-app/Connecting-an-external-domain.md' },
			{ label: 'Base44 feedback: custom domain shows bad gateway', url: 'https://feedback.base44.com/p/custom-domain-shows-bad-gateway-not-loading' },
		],
		related: ['base44/site-not-on-google', 'base44/form-email-not-sending'],
		updated: '2026-10-26',
	},
	{
		platform: 'base44',
		problem: 'visitors-forced-to-log-in',
		query: 'base44 make app public without login',
		title: 'Base44 Visitors Forced to Log In? Fix It',
		description:
			'Visitors to your Base44 landing page land on a login screen instead? Set App Visibility to Public and protect only the pages that really need sign-in.',
		h1: 'Base44 app forces visitors to log in: how to make pages public',
		answer: `Base44 sends every visitor to a login screen when App Visibility is set to Private or Workspace, or when the app is Public but every page was protected or the data on public pages needs sign-in. Set Dashboard > Overview > App Visibility to Public, ask the AI chat to protect only the pages that need an account, and make only genuinely public records readable without login.`,
		symptom: `Someone clicks your link from an ad or social post and sees a sign-in form instead of your landing page. Search results and link previews show nothing useful. You do not notice, because you are always logged in when you check the app.`,
		causes: [
			{
				title: 'App Visibility is not Public',
				body: `Private allows only invited people and Workspace allows only your Base44 workspace members; both require a login. Older apps may still show the deprecated Public (login required) option.`,
			},
			{
				title: 'Every page is protected',
				body: `In a Public app the AI chat can protect pages and redirect signed-out visitors to login. If it protected all of them, including the homepage, the effect is the same as a private app.`,
			},
			{
				title: 'Public pages read private data',
				body: `If a landing page shows records from an entity whose permissions require sign-in, signed-out visitors get an empty or broken page, and crawlers get only a general summary.`,
			},
			{
				title: 'SSO enforcement on the workspace',
				body: `When your workspace enforces SSO, Base44 does not offer Public (no login), so the app needs a login regardless of other settings.`,
			},
		],
		steps: [
			`Open Dashboard > Overview and set the App Visibility dropdown to Public.`,
			`Ask the AI chat which pages are protected, then have it protect only the ones that need an account, such as the dashboard and settings.`,
			`Review data permissions for the entities your public pages display and make only safe, public records readable by anyone. Keep user data in protected entities.`,
			`If the workspace enforces SSO and you need a public marketing page, check with your workspace admin.`,
			`Open the app in a private window on your phone and click through every public page while signed out.`,
			`Once the landing page is public, go to Dashboard > SEO & GEO and check that page's Search visibility is on, so the page you just opened up can actually be found.`,
		],
		prompt: `Keep the app Public. Make the Home, Pricing and About pages viewable without logging in, and require login only for /dashboard and /settings. Make sure no user data appears on the public pages, and redirect signed-out visitors to login only when they open a protected page.`,
		verify: [
			`Open the domain in a private window on a phone: the landing page should render with no login prompt.`,
			`Open /dashboard while signed out and confirm you are sent to login, so private pages stay private.`,
		],
		scanFlags: [
			`A login screen where the homepage should be: the scan visits as an anonymous visitor and sees exactly what a new customer sees.`,
			`Links and the main call to action that redirect to a login page instead of content.`,
			`Missing title and description on the page crawlers receive.`,
		],
		faqs: [
			{
				q: `Will making the app Public expose my users' data?`,
				a: `Not by itself. Visibility controls who can open the app; data permissions control who can read each entity. Keep sensitive entities restricted and protect the pages that show them.`,
			},
			{
				q: `What is Public (login required)?`,
				a: `An older option that Base44 now marks as deprecated. On current apps, choose Public and protect individual pages instead.`,
			},
			{
				q: `How does this affect Google?`,
				a: `Base44 keeps sign-in pages out of search automatically in a public app. If the whole app needs a login, crawlers see nothing to index, so public pages are a must for search.`,
			},
			{
				q: `How can I share a private app with a few people without making it public?`,
				a: `Leave it Private and use Send Invites or Copy Link on the Overview page. Uninvited visitors can request access after verifying their email, which suits a client preview or an internal tool better than opening it to everyone.`,
			},
		],
		sources: [
			{ label: 'Base44 docs: managing access', url: 'https://docs.base44.com/es/Setting-up-your-app/Managing-access.md' },
			{ label: 'Base44 docs: SEO and search visibility', url: 'https://docs.base44.com/Guides/SEO-and-search-visibility' },
		],
		related: ['base44/site-not-on-google', 'base44/custom-domain-not-working'],
		updated: '2026-10-26',
	},
]
