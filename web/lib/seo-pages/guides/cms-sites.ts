import type { FixGuide } from '../types'

/** WordPress, Wix, Webflow and any-website fixes. */
export const GUIDES: FixGuide[] = [
	// ───────────────────────────── WordPress ─────────────────────────────
	{
		platform: 'wordpress',
		problem: 'mobile-menu-not-working',
		query: 'wordpress mobile menu not working',
		title: 'WordPress Mobile Menu Not Working? Fix It',
		description:
			'Hamburger icon does nothing, flashes open and shut, or needs three taps? Find out whether caching, a plugin error or an overlapping element is to blame.',
		h1: 'WordPress mobile menu not working: how to find the cause',
		answer:
			'A WordPress mobile menu that will not open is almost always one of three things: a caching or optimisation plugin has deferred, combined or delayed the theme’s menu script, another plugin is throwing a JavaScript error before the toggle code runs, or an invisible element is sitting on top of the hamburger icon. Load the page on your phone with ?nocache=1 added to the URL first. If the menu works that way, your optimiser is the cause; if it does not, open the console and inspect the icon.',
		symptom:
			'On a phone the hamburger icon does nothing when tapped, opens and snaps shut again, or only responds on the second or third tap. The desktop navigation is fine, so the owner often never notices until a visitor mentions it. Sometimes the menu works on the home page and fails on posts, or the other way round.',
		causes: [
			{
				title: 'An optimisation plugin is holding the menu script back',
				body: 'WP Rocket, LiteSpeed Cache, Autoptimize, Perfmatters and similar tools can minify, combine, defer or “delay JavaScript execution until user interaction”. With delay turned on, the first tap only wakes the scripts up, so the menu needs a second tap, or the combined file breaks the toggle code entirely.',
			},
			{
				title: 'A different plugin throws an error first',
				body: 'Browsers stop running a script at the first uncaught error. If a slider, analytics or chat plugin errors out higher in the page, the theme’s navigation handler may never be attached, and the icon becomes decoration.',
			},
			{
				title: 'Something invisible covers the toggle',
				body: 'A wide logo, a header widget area, a transparent container or a sticky banner can overlap the icon at phone width. Your finger lands on that layer instead, which is why the menu sometimes works once the logo is removed.',
			},
			{
				title: 'Two menu systems fight over one button',
				body: 'Adding a mobile menu plugin on top of a theme that already has its own responsive menu means two scripts react to the same tap. One opens the panel and the other immediately closes it.',
			},
		],
		steps: [
			'On your phone, open the page with ?nocache=1 (or any made-up query string) on the end of the URL. If the menu now works, the cached or optimised version of the page is the problem.',
			'In your optimisation plugin, add the theme’s navigation script to the exclusion lists for minify, combine, defer and delay JavaScript. Theme docs usually name the file, for example navigation.js or a menu bundle. Then purge every cache layer, including the host’s and any CDN.',
			'On a computer, open Chrome DevTools, switch on device mode at 375px wide and watch the Console while you tap the icon. Red errors point to the plugin responsible; the Elements panel shows whether the menu receives its “toggled” or “open” class.',
			'Right-click the hamburger and choose Inspect. If DevTools highlights a logo, container or widget instead of the button, shrink or reposition that element, or give the toggle a higher z-index.',
			'Go to Appearance > Menus (or Appearance > Editor > Navigation on block themes) and confirm a menu is actually assigned to the primary or mobile location.',
			'Install the Health Check & Troubleshooting plugin and use Troubleshooting Mode to switch plugins back on one at a time for your session only, so visitors are not affected while you test.',
		],
		verify: [
			'On a real phone and at 375px in DevTools, one tap opens the menu, every link navigates and one tap closes it.',
			'Repeat the test on the home page and on an inner page or post, because themes often load different scripts per template.',
			'Reload with the console open and confirm no red errors appear before you touch anything.',
		],
		scanFlags: [
			'Phone-width screenshots with a visual review that points out a header where the icon is overlapped, cut off or does not fit.',
			'JavaScript console errors on the page and failed requests for script files, including combined or minified bundles that 404.',
			'Navigation links that return 404 or time out once reached.',
			'The scan does not tap through your menu step by step, so a toggle that looks right but does nothing still needs a quick tap test on a phone.',
		],
		faqs: [
			{
				q: 'Why does my mobile menu need two taps?',
				a: 'That pattern almost always comes from a “delay JavaScript until interaction” option. The first tap is treated as the interaction that loads the scripts, and only the second reaches the menu. Exclude the menu script from delay and it opens first time.',
			},
			{
				q: 'The menu works in the Customizer preview but not on the live site. Why?',
				a: 'The Customizer bypasses page caching and most optimisation, so it shows the untouched page. Visitors get the cached, combined version. That gap is a strong hint the optimiser or a stale cache is involved.',
			},
			{
				q: 'Do I need a separate mobile menu plugin?',
				a: 'Usually not. Most current themes include a responsive menu. Adding a plugin on top is a common source of double toggles, so try fixing the theme’s own menu before layering another one over it.',
			},
		],
		sources: [
			{ label: 'GeneratePress forum: hamburger menu not opening on mobile', url: 'https://generatepress.com/forums/topic/hamburger-menu-not-opening-on-mobile-2/' },
			{ label: 'WordPress.org support: burger menu not opening', url: 'https://wordpress.org/support/?p=15584776' },
			{ label: 'Codeable: WordPress mobile menu not working', url: 'https://www.codeable.io/blog/wordpress-mobile-menu-not-working' },
		],
		related: ['wordpress/button-not-clickable-on-mobile', 'wordpress/elementor-popup-wont-close-on-mobile'],
		updated: '2026-10-26',
	},
	{
		platform: 'wordpress',
		problem: 'mixed-content-not-secure-after-ssl',
		query: 'wordpress not secure after installing ssl',
		title: 'WordPress Not Secure After SSL? Fix Mixed Content',
		description:
			'Certificate installed but WordPress still shows Not secure or no padlock? Fix the site URLs, old http links in the database and conflicting redirects.',
		h1: 'WordPress still shows “Not secure” after installing SSL',
		answer:
			'If WordPress still shows “Not secure” after you install a certificate, the database is usually the culprit: the WordPress Address and Site Address are still http://, and thousands of absolute http:// links sit inside posts, page-builder layouts, widgets and theme options. Change both addresses under Settings > General, then run a serialization-safe search and replace (Better Search Replace or WP-CLI) from http://yourdomain to https://yourdomain. Purge every cache afterwards and keep only one HTTPS redirect.',
		symptom:
			'The host says the certificate is active and https:// loads, yet Chrome shows “Not secure” or a plain icon instead of a padlock. Some images, fonts or embedded maps fail to appear on the HTTPS version, and the console fills with “Mixed Content” warnings. Occasionally the admin area loops between http and https.',
		causes: [
			{
				title: 'The two site URLs were never changed',
				body: 'WordPress builds most links from the WordPress Address (URL) and Site Address (URL) fields. If they still begin with http://, WordPress keeps generating insecure links even though the certificate works.',
			},
			{
				title: 'Old http:// links are stored in the database',
				body: 'Image URLs in post content, Elementor, Divi or Beaver Builder layout data, menu items, widgets and Customizer settings are saved as full addresses. Changing the site URL does not touch them, so every page that uses them pulls an insecure file.',
			},
			{
				title: 'A theme, plugin or embed hard-codes http',
				body: 'An old theme option, a Google Fonts call in header.php, or a third-party widget loaded with http:// keeps the warning alive even after the database is clean.',
			},
			{
				title: 'A proxy makes WordPress think it is on http',
				body: 'Cloudflare’s Flexible SSL mode encrypts only the visitor-to-Cloudflare leg, so WordPress sees plain http from the proxy. Combined with a redirect plugin, that produces redirect loops or mixed links. Cached pages from before the switch add to the confusion.',
			},
		],
		steps: [
			'Open the page in Chrome, then DevTools > Console. Copy every URL in the “Mixed Content” messages; they tell you whether the leftovers are uploads, theme files or third-party embeds.',
			'Go to Settings > General and change both WordPress Address (URL) and Site Address (URL) to https://, using the same www or non-www host you actually serve. If those fields are greyed out, they are defined as WP_HOME and WP_SITEURL in wp-config.php; edit them there.',
			'Take a full database backup, install Better Search Replace, and search for http://yourdomain.com replacing with https://yourdomain.com across all tables with “Run as dry run” ticked. Review the counts, then run it for real. WP-CLI users can run wp search-replace with --dry-run first.',
			'If you use Elementor, open Elementor > Tools > Replace URL and then Regenerate CSS & Data, because the builder keeps its own copies of URLs in generated CSS files.',
			'Choose one way to force HTTPS (the host panel, an .htaccess rule, or Really Simple SSL) and remove the others. With Cloudflare, set SSL/TLS to Full (strict) rather than Flexible.',
			'Purge the caching plugin, the host cache and the CDN. Use SSL Insecure Content Fixer only as a temporary bridge while you clean up, not as the permanent fix.',
		],
		verify: [
			'Open the home page, a post, a page built with your page builder and any form page in a private window. Each should show a padlock.',
			'Keep the Console open on those pages and confirm there are no Mixed Content warnings left.',
			'Type the http:// address of an inner page and confirm it lands on the https:// version in a single hop.',
		],
		scanFlags: [
			'Whether the page is served over HTTPS and which security headers come back with it.',
			'Mixed Content warnings in the console and insecure requests the browser blocked, listed with their URLs.',
			'Images that fail to load on the HTTPS page, which is how leftover http:// uploads usually show up.',
			'The scan reads the visitor side only; it cannot open your database, wp-config.php or Cloudflare settings.',
		],
		faqs: [
			{
				q: 'Is Really Simple SSL enough on its own?',
				a: 'It handles the redirect and rewrites many insecure links on the fly, which hides the problem. The old http:// URLs are still in the database, so if the plugin is ever deactivated the warnings return. A one-time search and replace is the lasting fix.',
			},
			{
				q: 'Is it safe to run Better Search Replace?',
				a: 'Yes, with a backup and a dry run first. It understands serialized PHP data, which is how page builders and widgets store settings, so it updates lengths correctly. A raw SQL replace in phpMyAdmin can corrupt that data.',
			},
			{
				q: 'Why does my admin redirect in a loop after switching to HTTPS?',
				a: 'Usually a proxy like Cloudflare on Flexible mode is sending plain http to the server while WordPress forces https. Switch the proxy to Full (strict) with a valid origin certificate, or ask your host about forwarding the HTTPS header.',
			},
		],
		sources: [
			{ label: 'MalCare: fix WordPress mixed content', url: 'https://www.malcare.com/blog/wordpress-mixed-content/' },
			{ label: 'SSL Insecure Content Fixer plugin', url: 'https://yor.wordpress.org/plugins/ssl-insecure-content-fixer/' },
			{ label: 'WP Fix It: broken images after moving to HTTPS', url: 'https://www.wpfixit.com/fix-broken-images-in-wordpress-after-moving-to-https/' },
		],
		related: ['any-website/ssl-installed-but-site-not-secure', 'wordpress/images-not-showing-after-migration'],
		updated: '2026-10-26',
	},
	{
		platform: 'wordpress',
		problem: 'images-not-showing-after-migration',
		query: 'wordpress images not showing after migration',
		title: 'WordPress Images Missing After Migration? Fix',
		description:
			'Images in the Media Library but broken on the live site after a move? Find the old domain or localhost URLs still stored in content, builder data and CSS.',
		h1: 'WordPress images not showing after migration',
		answer:
			'When images disappear after a WordPress move, the files are usually fine and the links are wrong: post content, page-builder data and generated CSS still point at the old domain, localhost or a staging address. Changing the site URL does not rewrite those stored links. Run a serialization-safe search and replace from the old URL to the new one, regenerate your builder’s CSS and purge caches; if the files themselves are missing, re-upload the wp-content/uploads folder.',
		symptom:
			'After moving from Local, a staging subdomain or an old domain, some images show as broken icons or empty boxes. Background images set in a page builder are the most common casualties. The same images look fine in the Media Library, and they may even display for you while logged in because your browser still reaches the old address.',
		causes: [
			{
				title: 'Links still point at the old address',
				body: 'Every image inserted into a post or layout is saved with its full URL, such as http://mysite.local/wp-content/uploads/… or https://staging.example.com/…. After the move those addresses no longer exist for visitors, so the images break.',
			},
			{
				title: 'A find and replace corrupted serialized data',
				body: 'Builders like Elementor, Bricks and Divi store settings as serialized PHP arrays that record each string’s length. Replacing a URL with a longer or shorter one using a plain text tool breaks those lengths, and the builder silently drops the affected settings, including background images.',
			},
			{
				title: 'The uploads were not fully copied',
				body: 'Migration plugins can time out on large media folders, and manual FTP transfers skip files. Folder permissions on the new host can also stop the web server reading what did arrive.',
			},
			{
				title: 'Generated CSS files still hold the old URLs',
				body: 'Page builders write background images into cached CSS files under wp-content/uploads. Until those files are regenerated, they keep requesting images from the old domain even after the database is fixed.',
			},
		],
		steps: [
			'Right-click a broken image (or find the background image in DevTools > Elements) and open its URL in a new tab. Note the domain and path; that is the string you will replace.',
			'Back up the database, then run Better Search Replace from the old URL to the new one across all tables, dry run first. Repeat for variants such as http vs https or a trailing path like /wordpress. WP-CLI’s wp search-replace does the same job from the command line.',
			'Regenerate the builder’s CSS: in Elementor that is Elementor > Tools > Regenerate CSS & Data; Bricks and Divi have equivalent cache or static CSS options. Purge every page and CDN cache afterwards.',
			'Over SFTP or the host’s file manager, check that wp-content/uploads contains the year and month folders you expect and that a file opens directly in the browser. Folders are typically 755 and files 644.',
			'If originals exist but resized versions 404, run the Regenerate Thumbnails plugin so WordPress recreates the missing image sizes.',
		],
		verify: [
			'Open your main templates with DevTools > Network filtered to Img and confirm there are no 404s and no requests to the old domain, localhost or staging host.',
			'Test from a phone on mobile data, which cannot resolve your local or staging hostnames, so leftovers show up immediately.',
		],
		scanFlags: [
			'Broken images on the scanned pages, with the URL each one tried to load.',
			'Failed network requests, which makes leftover localhost or staging addresses easy to spot in the list.',
			'Mixed content warnings when the old address was http and the new site is https.',
			'Phone and desktop screenshots, so a missing background image shows up as an empty section.',
		],
		faqs: [
			{
				q: 'Why do the images show for me but not for visitors?',
				a: 'Your browser may still have the old images cached, or your computer may still resolve the old local or staging hostname. Visitors have neither, so test in a private window on another device or on mobile data.',
			},
			{
				q: 'Can I just change the Site Address and be done?',
				a: 'No. Settings > General only controls the base address WordPress uses for new links. Links already saved in content and builder data stay exactly as they were until you replace them.',
			},
			{
				q: 'Which migration plugins avoid this?',
				a: 'Duplicator, All-in-One WP Migration and WP Migrate all offer a URL replacement step during import. Problems usually come from skipping it, migrating by hand, or a second domain change later.',
			},
		],
		sources: [
			{ label: 'Local community: missing images after migration to live', url: 'https://community.localwp.com/t/missing-images-after-migration-to-live-environment/39321' },
			{ label: 'WP Fix It: broken images after moving to HTTPS', url: 'https://www.wpfixit.com/fix-broken-images-in-wordpress-after-moving-to-https/' },
		],
		related: ['wordpress/pages-404-except-homepage', 'wordpress/mixed-content-not-secure-after-ssl'],
		updated: '2026-10-26',
	},
	{
		platform: 'wordpress',
		problem: 'pages-404-except-homepage',
		query: 'wordpress all pages 404 except homepage',
		title: 'WordPress Pages 404 Except Homepage? Fix It',
		description:
			'Homepage loads but every post and page returns 404 after a migration or host move? Flush permalinks, then check .htaccess, AllowOverride or Nginx rules.',
		h1: 'All WordPress pages return 404 except the homepage',
		answer:
			'When only the homepage works and every other WordPress URL returns 404, the web server is not passing pretty permalinks to WordPress. Start by opening Settings > Permalinks and clicking Save Changes without editing anything, which rewrites the rules. If that does not help, the .htaccess file is missing or ignored on Apache (AllowOverride and mod_rewrite), or the Nginx config lacks the try_files line that sends requests to index.php.',
		symptom:
			'The home page displays normally, but clicking any menu item, post or category gives a 404 page, often the host’s plain one rather than your theme’s. It usually starts straight after a migration, a host change, pushing staging live or changing the permalink structure. URLs in the ?p=123 format still work.',
		causes: [
			{
				title: 'Rewrite rules were not regenerated',
				body: 'WordPress keeps its permalink rules in the database and writes them out when permalinks are saved. After an import those rules can be stale or tied to the old path, so every pretty URL misses.',
			},
			{
				title: 'The .htaccess file is missing or ignored',
				body: 'On Apache, the default WordPress block in .htaccess routes requests to index.php. Many migrations skip hidden files, and some servers are configured with AllowOverride None or without mod_rewrite, so the file is present but never read.',
			},
			{
				title: 'Nginx has no WordPress rule',
				body: 'Nginx ignores .htaccess completely. Without try_files $uri $uri/ /index.php?$args; in the server block, it looks for a real folder called /about/ and returns 404 when none exists.',
			},
			{
				title: 'Stored paths still point at staging',
				body: 'If the site lived in a subfolder such as /staging/ before, internal links and some plugin settings may still include that path, so links lead to URLs that genuinely do not exist on the live site.',
			},
		],
		steps: [
			'In wp-admin go to Settings > Permalinks and click Save Changes. You do not need to change the structure; saving flushes and rebuilds the rewrite rules. Test an inner page straight away.',
			'On Apache hosting, open the WordPress root folder (the one with wp-config.php) and make sure .htaccess exists and contains the standard block that begins # BEGIN WordPress. If it is missing, create it with that block or let WordPress write it by saving permalinks again with the file writable.',
			'If .htaccess is correct and pages still 404, ask the host to confirm mod_rewrite is enabled and that the site’s directory uses AllowOverride All. On a VPS you can check this yourself in the Apache virtual host file.',
			'On Nginx, ask the host (or edit the server block yourself) to add try_files $uri $uri/ /index.php?$args; inside the location / block, then reload Nginx.',
			'Back up the database and run a serialization-safe search and replace for any old staging domain or subfolder path, then re-save the menus under Appearance > Menus.',
		],
		verify: [
			'Click through every main menu item, a few posts, a category archive and page 2 of the blog. Each should load with your theme, not a 404.',
			'Visit a made-up URL like /this-does-not-exist and confirm your theme’s 404 template appears, which shows WordPress is now handling requests.',
			'Check the browser’s Network tab shows a 200 status for real pages rather than a 404 with content.',
		],
		scanFlags: [
			'Navigation and on-page links that return 404, which is exactly how this fault looks from outside.',
			'How the site responds to a deliberately missing path, so you can tell a server 404 from your theme’s 404 page.',
			'The free scan covers the homepage only, which is the one page that works here; its link check is what exposes the broken inner pages.',
		],
		faqs: [
			{
				q: 'Why does the homepage work when nothing else does?',
				a: 'The homepage is served by index.php directly, so it needs no rewriting. Every other pretty URL depends on rewrite rules to reach index.php, and that is the part that broke.',
			},
			{
				q: 'Will switching permalinks to Plain fix it?',
				a: 'It will make pages load because plain ?p= URLs need no rewriting, but it changes every URL on the site, breaks existing links from Google and other sites, and hides the real server problem. Fix the rules instead.',
			},
			{
				q: 'Can a plugin cause this?',
				a: 'Occasionally a plugin that registers custom post types or translations leaves stale rules behind after a move. Saving permalinks fixes that case too, which is why it is always the first step.',
			},
		],
		sources: [
			{ label: 'Akamai community: all pages except homepage 404 after migration', url: 'https://www.akamai.com/cloud/community/questions/18755/why-are-all-pages-except-my-home-page-seeing-a-404-after-an-all-in-one-wordpress' },
			{ label: 'WP Staging: page not found after pushing', url: 'https://wp-staging.com/docs/page-not-found-error-404-after-pushing/' },
			{ label: 'DreamHost: guide to WordPress 404 pages', url: 'https://www.dreamhost.com/wordpress/guide-to-wp-404-pages/' },
		],
		related: ['wordpress/images-not-showing-after-migration'],
		updated: '2026-10-26',
	},
	{
		platform: 'wordpress',
		problem: 'contact-form-7-spinning-not-sending',
		query: 'contact form 7 spinning not sending',
		title: 'Contact Form 7 Spinning, Not Sending? Fix It',
		description:
			'Contact Form 7 spinner keeps turning after Send and no message appears? Check the REST API request, security plugins and stale caches, in that order.',
		h1: 'Contact Form 7 keeps spinning and won’t send',
		answer:
			'Contact Form 7 sends every submission through the WordPress REST API, so an endless spinner means that request was blocked, failed or never returned. The usual causes are a security or admin plugin that disables the REST API, a firewall rule that blocks the request on some devices, or cached scripts left over after an update. Open DevTools > Network, submit the form and look at the request to /wp-json/contact-form-7/…/feedback; its status code tells you which.',
		symptom:
			'A visitor fills in the form, clicks Send and the little spinner next to the button keeps turning. No green success message or red error ever appears, and nothing arrives by email. In some cases it only happens on phones or only for visitors who are not logged in.',
		causes: [
			{
				title: 'The REST API is switched off or restricted',
				body: 'Plugins such as Admin and Site Enhancements, Disable REST API, or the REST options in some security suites block anonymous REST requests. Contact Form 7 needs that endpoint, so the submission is refused and the spinner waits forever.',
			},
			{
				title: 'A firewall rule blocks the submission',
				body: 'Wordfence, All In One WP Security, a host firewall or Cloudflare rules can treat the POST as suspicious, especially from mobile networks that share IP addresses. That explains cases where desktop works and phones do not.',
			},
			{
				title: 'Old cached scripts after an update',
				body: 'After Contact Form 7 or WordPress updates, a page cache or CDN can keep serving old JavaScript or an outdated nonce. The form then posts something the server rejects.',
			},
			{
				title: 'A script error or reCAPTCHA problem',
				body: 'Another plugin’s JavaScript error can stop the form handler, and a reCAPTCHA v3 integration with wrong keys or a blocked Google script leaves the request hanging.',
			},
		],
		steps: [
			'Open the contact page, then DevTools > Network. Submit the form and click the request whose URL contains /wp-json/contact-form-7/v1/contact-forms/ and ends in /feedback. Note the status: 401 or 403 points at a block, 500 at a server error, and no request at all at a JavaScript problem.',
			'For 401 or 403, check every security and admin-tweak plugin for an option named “Disable REST API” or “restrict REST to logged-in users”, and either turn it off or allow the contact-form-7 route. Also look at the firewall log for blocked requests at the time you tested.',
			'Purge the page cache, the minification cache and any CDN. In WP Rocket, LiteSpeed Cache and similar tools, exclude the contact page or Contact Form 7’s scripts from combine and delay JavaScript.',
			'If a red console error appears when you click Send, use the Health Check & Troubleshooting plugin to test with other plugins disabled for your session only.',
			'Once the success message appears, test delivery separately: install an SMTP plugin such as WP Mail SMTP, send its test email and then a real form submission. A green message only proves WordPress accepted the form, not that the email reached anyone.',
		],
		verify: [
			'Submit the form on desktop and on a phone. The success message should appear within a few seconds.',
			'In the Network tab the feedback request returns 200 and its response contains “status”: “mail_sent”.',
			'The test email lands in the destination inbox, not in spam.',
		],
		scanFlags: [
			'JavaScript console errors on the contact page and failed requests, including a blocked or erroring REST call while the page loads.',
			'Whether submitting the form empty shows Contact Form 7’s validation messages, which proves its script is running at all.',
			'The scan never sends a real message, so it cannot tell you whether a submission is accepted or whether the email reaches your inbox.',
		],
		faqs: [
			{
				q: 'Why does Contact Form 7 work when I am logged in but not for visitors?',
				a: 'Logged-in admins usually bypass page caching and pass REST API restrictions that block anonymous users. Always test in a private window, which behaves like a real visitor.',
			},
			{
				q: 'The success message shows but I never get the email. Is that the same problem?',
				a: 'No, that is a mail delivery problem. Configure SMTP through your email provider, set the From address to an address on your own domain, and check spam. The spinner problem happens before email is involved.',
			},
			{
				q: 'Should I switch to a different form plugin?',
				a: 'Other plugins that use admin-ajax instead of the REST API may work immediately, which can be a useful test. But the block that stopped Contact Form 7 is still there and can affect other plugins, so find it first.',
			},
		],
		sources: [
			{ label: 'WordPress.org: Contact Form 7 blocked from submitting, spinning', url: 'https://wordpress.org/support/topic/contact-form-7-is-blocked-from-submitting-spinning/' },
			{ label: 'WordPress.org: Contact Form 7 not submitting on mobile', url: 'https://wordpress.org/support/topic/contact-form-7-not-submitting-when-on-mobile/' },
			{ label: 'WordPress.org: submit wheel spins endlessly', url: 'https://wordpress.org/support/topic/submit-wheel-spins-endlessly-contact-requests-not-sent/' },
		],
		related: ['wordpress/button-not-clickable-on-mobile'],
		updated: '2026-10-26',
	},
	{
		platform: 'wordpress',
		problem: 'elementor-popup-wont-close-on-mobile',
		query: 'elementor popup not closing on mobile',
		title: 'Elementor Popup Won’t Close on Mobile? Fix It',
		description:
			'Elementor popup opens on phones but the X does nothing or is off-screen? Fix device animations, close button settings, popup height and hiding CSS.',
		h1: 'Elementor popup won’t close on mobile',
		answer:
			'An Elementor popup that will not close on phones is most often caused by separate entrance or exit animations set for tablet or mobile, which can make the close action fail with a console error. The other common causes are a popup taller than the screen that pushes the X out of view, and custom CSS that hides the close icon. Remove the device-specific animations, set the popup height to fit content on mobile and check that the close button is shown inside the popup.',
		symptom:
			'A newsletter or offer popup appears on a phone and the visitor cannot get rid of it. The X does nothing, is missing, or sits above the visible area. Tapping the dark overlay does nothing either, so the page behind is unusable and most visitors simply leave.',
		causes: [
			{
				title: 'Device-specific animations break the close action',
				body: 'Setting a different entrance or exit animation for tablet or mobile in the popup’s responsive settings is a known trigger: the popup opens, but closing it throws a JavaScript error and the overlay stays.',
			},
			{
				title: 'The close button is hidden or outside the box',
				body: 'In Popup Settings the close button can be hidden, or positioned outside the popup. On a narrow screen an outside position can land off the edge of the viewport where no one can reach it.',
			},
			{
				title: 'Content taller than the screen',
				body: 'A fixed popup height, or content that is taller than a phone screen, pushes the top of the popup and its X above the visible area, and the popup itself may not scroll.',
			},
			{
				title: 'Overlay closing is turned off',
				body: 'With “Prevent Closing on Overlay” and “Prevent Closing on ESC Key” enabled, the X is the only way out. If that one control breaks, the visitor is stuck.',
			},
		],
		steps: [
			'Go to Templates > Popups, edit the popup and open the Advanced or Motion Effects settings on the popup and its main container. Clear any tablet- or mobile-specific entrance and exit animations, keep only the desktop value, update and retest on a phone.',
			'Click the gear icon for Popup Settings, then the Style tab and the Close Button section. Make sure the button is shown, set its position inside the popup, and give it a colour that contrasts with the background.',
			'In the same Layout settings switch to the mobile view and set the height to Fit to Content, with a maximum width that fits a 360px screen.',
			'Under Popup Settings > Advanced, untick “Prevent Closing on Overlay” and “Prevent Closing on ESC Key” so visitors have a second way out.',
			'Search Appearance > Customize > Additional CSS, the theme options and Elementor’s Custom CSS for rules that target .dialog-close-button or an icon class with display: none or visibility: hidden.',
			'Review the popup’s Triggers and Conditions. Firing a full-screen popup the moment a page loads on mobile is the kind of intrusive interstitial Google’s guidance warns against, so prefer a scroll or exit-intent trigger, or a smaller banner on phones.',
		],
		verify: [
			'At 360px wide and on a real phone, trigger the popup and tap the X. It should close and the page should scroll again.',
			'Trigger it again and tap the overlay outside the box, which should also close it.',
			'Watch the console while closing and confirm no error appears.',
		],
		scanFlags: [
			'Phone-width screenshots where the visual review flags an overlay covering most of the screen or a close control that is missing or cut off.',
			'JavaScript console errors on the page, including the error thrown when the close action fails.',
			'A primary call-to-action that cannot be reached because something sits on top of it.',
			'The scan only sees popups that appear on page load; one triggered by scrolling or exit intent may not show up.',
		],
		faqs: [
			{
				q: 'Why does the popup close fine on desktop?',
				a: 'Desktop uses the base animation settings, which work. The bug appears only when Elementor applies a separate tablet or mobile animation, which is why removing those values is the first fix to try.',
			},
			{
				q: 'Will a popup that cannot be closed hurt SEO?',
				a: 'Google’s guidance treats popups that cover the main content on mobile as intrusive interstitials, which can count against the page. More immediately, visitors who cannot close it leave.',
			},
			{
				q: 'Should I just hide the popup on mobile?',
				a: 'In the popup’s Advanced settings you can show it only on certain devices. That is a reasonable stopgap, but fix the close button too so a future layout change does not trap visitors on tablets.',
			},
		],
		sources: [
			{ label: 'Element.how: Elementor popup problems', url: 'https://element.how/elementor-pop-ups-problems/' },
			{ label: 'XTemos forum: promo popup not closing', url: 'https://xtemos.com/forums/topic/promo-popup-not-closing/' },
		],
		related: ['wordpress/button-not-clickable-on-mobile', 'wordpress/mobile-menu-not-working'],
		updated: '2026-10-26',
	},
	{
		platform: 'wordpress',
		problem: 'button-not-clickable-on-mobile',
		query: 'wordpress button not working on mobile',
		title: 'WordPress Button Not Working on Mobile? Fix',
		description:
			'A WordPress or Elementor button works on desktop and in mobile preview but not on a real phone? Find the invisible element on top of it and remove it.',
		h1: 'WordPress button not working on mobile',
		answer:
			'A WordPress button that works on desktop but ignores taps on a phone is usually covered by something you cannot see: a container, spacer, negative-margin section, sticky header or chat widget that overlaps it only at mobile widths. Inspect the button in Chrome’s device mode; if a different element highlights, that layer is catching the tap. Less often a script cancels the tap or the button’s link is empty on the mobile version.',
		symptom:
			'A call-to-action or link works on a laptop and even looks fine in the Elementor or block editor mobile preview, but tapping it on a real phone does nothing. Sometimes only the top half of the button responds, or it starts working once you scroll a little.',
		causes: [
			{
				title: 'An invisible layer sits over the button',
				body: 'A transparent container, an empty column with a min-height, a section pulled up with a negative margin, or a sticky header can overlap the button at phone widths. The tap lands on that layer, which has no link.',
			},
			{
				title: 'Mobile-only styles move things around',
				body: 'Absolute positioning, transforms or custom offsets applied only at the mobile breakpoint can slide a decorative shape or background element over the content beneath it.',
			},
			{
				title: 'A script swallows the tap',
				body: 'Smooth-scroll, analytics or popup scripts sometimes attach a click handler that calls preventDefault on links, so the browser never follows the link even though the button is on top.',
			},
			{
				title: 'The link is empty at that breakpoint',
				body: 'Some layouts duplicate a section for mobile and hide the desktop one. If the mobile copy was never given a URL, or still has #, the button looks right but goes nowhere.',
			},
		],
		steps: [
			'Open the page in Chrome, press F12, switch on device mode (the phone icon) at about 390px, then right-click the button and choose Inspect. If DevTools highlights something other than the button or its link, that element is on top.',
			'For a precise answer, hover the button to get its position and run document.elementFromPoint(x, y) in the Console with those coordinates. It returns whatever element actually receives a tap there.',
			'Fix the overlapping element: remove the negative margin, reduce the min-height of the empty column, add pointer-events: none to purely decorative layers, or set a higher z-index on the section that holds the button.',
			'In the editor, switch to the mobile breakpoint, select the button and check its Link field and any responsive visibility settings, so the visible version has the real URL.',
			'If nothing overlaps, watch the Console and temporarily disable smooth-scroll or tracking plugins with Health Check & Troubleshooting to see if the tap starts working.',
			'Retest on iOS Safari and Android Chrome, since sticky headers and chat bubbles sit in slightly different places on each.',
		],
		verify: [
			'Tap every primary call-to-action at 360px, 390px and 414px widths; each should navigate or open what it promises.',
			'Repeat with the page scrolled so the sticky header and any chat bubble are over the button area.',
		],
		scanFlags: [
			'Clicking the primary call-to-action at desktop and phone widths and reporting when it is unreachable or leads nowhere.',
			'Phone screenshots with a visual review that points out overlapping or hidden elements.',
			'Tap targets that are too small or crammed together, plus phone and email links that cannot be tapped.',
			'Console errors from scripts that may be intercepting clicks.',
		],
		faqs: [
			{
				q: 'Why does the editor’s mobile preview work but my phone does not?',
				a: 'The editor preview is a resized desktop browser using a mouse, and often skips sticky headers, chat widgets and optimisation plugins. A real phone gets all of them, which is where the overlap appears.',
			},
			{
				q: 'Is raising the z-index always the right fix?',
				a: 'It works, but it treats the symptom. If an empty container or a negative margin is the real cause, fixing that keeps the layout clean and stops the same problem returning on the next button.',
			},
			{
				q: 'Could my caching plugin cause this?',
				a: 'Yes, when the button depends on JavaScript, such as one that opens a popup or scrolls to a section. Delayed or combined scripts can leave it inactive until a second tap. Test with ?nocache=1 to rule it out.',
			},
		],
		sources: [
			{ label: 'WordPress.org Elementor forum: button not working in mobile view', url: 'https://wordpress.org/support/?p=18552125' },
			{ label: 'GeneratePress forum: mobile taps failing with optimisation', url: 'https://generatepress.com/forums/topic/hamburger-menu-not-opening-on-mobile-2/' },
		],
		related: ['wordpress/mobile-menu-not-working', 'wordpress/elementor-popup-wont-close-on-mobile', 'any-website/website-not-working-on-iphone-safari'],
		updated: '2026-10-26',
	},

	// ───────────────────────────── Wix ─────────────────────────────
	{
		platform: 'wix',
		problem: 'mobile-menu-not-working',
		query: 'wix mobile menu not working',
		title: 'Wix Mobile Menu Not Working? How to Fix It',
		description:
			'Wix hamburger menu won’t open, is missing or gets cut off on phones? Check layer order, hidden-on-mobile items and Studio breakpoints, then test live.',
		h1: 'Wix mobile menu not working or not opening',
		answer:
			'When a Wix hamburger menu will not open on phones, another element is usually stacked above it in the mobile layout, or the menu has been hidden or swapped out at the mobile breakpoint. In the Wix Editor switch to Mobile view and use the Layers panel to bring the menu to the front; in Wix Studio check every breakpoint. Then publish and test the live URL on a real phone, because Preview does not always behave like the published site.',
		symptom:
			'On the mobile site the hamburger icon does nothing when tapped, is missing completely, or opens a menu whose items are clipped at the edge. Desktop navigation is fine, and the menu may even work in Preview, which makes the problem confusing to track down.',
		causes: [
			{
				title: 'Something sits above the menu in the layer order',
				body: 'A strip, text box, image or transparent container placed higher in the mobile layer stack can cover the icon. It looks visible, but taps hit the element on top.',
			},
			{
				title: 'The menu is hidden or replaced on mobile',
				body: 'The Wix mobile editor lets you hide elements on mobile only, and Wix Studio lets each breakpoint use a different menu. A hamburger hidden at one breakpoint, or a horizontal menu shown instead, leaves phone visitors with nothing usable.',
			},
			{
				title: 'Only Preview was tested',
				body: 'Preview runs inside the editor, and some site functions behave differently there than on the published site. A menu can fail in Preview yet work live, or the reverse, so Preview alone does not prove anything.',
			},
			{
				title: 'The menu container is too small',
				body: 'If the menu or its container was sized on a large screen, items can be cut off or pushed outside the viewport on small phones.',
			},
		],
		steps: [
			'In the Wix Editor click the mobile icon in the top bar to switch to Mobile view. Open the Layers panel and find the hamburger menu; if any element is above it in the stack, select the menu and choose Arrange > Bring to Front.',
			'In Mobile view, open the “Hidden on mobile” list in the left panel and check that the hamburger menu, or the header that holds it, is not in there. Show it again if it is.',
			'In Wix Studio, step through the desktop, tablet and mobile breakpoints in the top bar and confirm which menu each uses and that the hamburger is visible and clickable at the smaller two.',
			'Check the menu’s container size and padding at the mobile breakpoint so every item fits a 360px screen without being clipped.',
			'Publish, then open the live URL on a real phone in a private tab. Do not rely on Preview for the final check.',
			'If it still will not open, delete the hamburger menu and add a fresh one from Add Elements > Menu. Forum users report this clears menus that have become unresponsive.',
		],
		verify: [
			'On the live site at phone width, tap the icon: the menu opens, each link goes to the right page, and the close control works.',
			'Check the menu on an inner page as well as the home page, since headers can differ between pages.',
		],
		scanFlags: [
			'Phone-width screenshots of the live site with a visual review that points out a menu icon that is covered, hidden or cut off.',
			'Navigation links that are dead or time out.',
			'JavaScript errors on the published page.',
			'The scan tests the published URL, not the editor, so its results reflect what visitors get rather than what Preview shows.',
		],
		faqs: [
			{
				q: 'Why does my Wix menu work in Preview but not on the live site?',
				a: 'Preview runs inside the editor and does not always match the published site. An element added or moved after your last publish can also be in the live version but not the one you last checked, so republish and test live.',
			},
			{
				q: 'Can I edit the mobile site separately from desktop?',
				a: 'In the classic Wix Editor, layout changes in Mobile view affect mobile only, while content changes are shared. In Wix Studio, styles can be set per breakpoint. That separation is why the menu can break on one device only.',
			},
			{
				q: 'Do I need code to fix a broken hamburger menu?',
				a: 'No. Layer order, visibility and size are all controlled in the editor. Code is only involved if Velo was used to show or hide the menu, in which case check that code for errors.',
			},
		],
		sources: [
			{ label: 'Wix Studio forum: hamburger menu doesn’t work', url: 'https://forum.wixstudio.com/t/hamburger-menu-doesnt-work/55670' },
			{ label: 'Wix Studio forum: hamburger menu unresponsive', url: 'https://forum.wixstudio.com/t/hamburger-menu-dont-work/49147' },
		],
		related: ['wix/anchor-link-button-not-working-live-site', 'wix/form-not-working-on-mobile'],
		updated: '2026-10-26',
	},
	{
		platform: 'wix',
		problem: 'anchor-link-button-not-working-live-site',
		query: 'wix button works in preview but not on live site',
		title: 'Wix Button Works in Preview, Not Live? Fix',
		description:
			'Wix button or anchor link works in Preview but reloads the page, goes to the wrong page or does nothing when published? Check link type and permissions.',
		h1: 'Wix button works in preview but not on the live site',
		answer:
			'When a Wix button behaves in Preview but not on the published site, check how its link is set first: a link to the page rather than to an anchor reloads the page instead of scrolling. A target page restricted to members sends visitors to a login or another page, and Velo code with its own click handler can override the button’s link. Fix the link, republish, and test the live URL in a private window.',
		symptom:
			'A button or anchor link scrolls to the right section in Preview, but on the live site it reloads the page from the top, lands on the wrong page, or does nothing. Logged-out visitors may be sent somewhere else entirely, while you, logged in, see it working.',
		causes: [
			{
				title: 'The link points to a page, not an anchor',
				body: 'Choosing “Page” and then the current page in the link panel tells Wix to load that page again. It looks the same in some previews but reloads on the live site. An anchor on a different page or missing at one breakpoint has the same effect.',
			},
			{
				title: 'The target page is members-only',
				body: 'Pages set to members or paid plans redirect anonymous visitors to a login screen or fallback page. As the site owner you pass that check, so the button seems fine when you test it.',
			},
			{
				title: 'Velo code fights the link',
				body: 'If a button has both a link in the editor and an onClick handler in Velo that navigates with wixLocation, the two compete, and the result can differ between Preview and live.',
			},
			{
				title: 'The change was never published',
				body: 'Editing a link does nothing for visitors until you publish, and a browser holding an older version can keep showing the old behaviour for a while.',
			},
		],
		steps: [
			'In the editor, click the button and then the link icon. Choose “Anchor”, pick the page the anchor lives on and select the exact anchor name. Avoid linking to the page itself when you mean a section.',
			'Confirm the anchor element exists and is visible at every breakpoint; in Wix Studio an anchor attached to an element hidden on mobile has nowhere to scroll to.',
			'Open the Pages panel, click the three dots next to the target page and choose Settings > Permissions. If it is restricted to members, decide whether that is intended and point public buttons elsewhere.',
			'If Velo is enabled, search the page code for an onClick on that button. Use either the editor link or wixLocation.to() in code, not both.',
			'Publish, then test the live URL in a private window on desktop and on a phone, signed out.',
		],
		verify: [
			'Click each button on the live site and confirm the URL or scroll position changes to the intended target, on desktop and on mobile.',
			'Repeat in a private window while signed out, to see exactly what a new visitor sees on a restricted page.',
		],
		scanFlags: [
			'Clicking the primary call-to-action on the live site and reporting when it leads nowhere or ends on an error.',
			'Links that return 404 or time out, checked as an anonymous visitor.',
			'Desktop and phone screenshots, so a button that is hidden or misplaced at one size is visible.',
			'The scan visits as a signed-out visitor, which is useful here: it sees the members-only redirect you never see as the owner.',
		],
		faqs: [
			{
				q: 'Why does my anchor link reload the page?',
				a: 'Most often the link type is Page rather than Anchor. Wix then loads the page again from the top instead of scrolling. Re-select the link as an Anchor and republish.',
			},
			{
				q: 'Can I link to an anchor on another page?',
				a: 'Yes. In the link panel choose Anchor, pick the other page from the dropdown and then the anchor. Wix opens the page and scrolls to that section.',
			},
			{
				q: 'How long after publishing should the change show?',
				a: 'Usually right away. If it does not, open the live site in a private window to rule out your browser holding an older version before digging further.',
			},
		],
		sources: [
			{ label: 'Wix Studio forum: anchor links work in preview but not live', url: 'https://forum.wixstudio.com/t/anchor-links-on-buttons-are-working-in-editor-preview-but-not-on-published-live-site/67851' },
			{ label: 'Wix Studio forum: button working in preview but not published', url: 'https://forum.wixstudio.com/t/button-working-in-preview-but-not-on-the-published-site/74929' },
		],
		related: ['wix/mobile-menu-not-working'],
		updated: '2026-10-26',
	},
	{
		platform: 'wix',
		problem: 'form-not-working-on-mobile',
		query: 'wix form not working on mobile',
		title: 'Wix Form Not Working on Mobile? Fix It',
		description:
			'Visitors can’t tap into Wix form fields or the submit button does nothing on phones? Fix overlapping elements and Velo add-ons, then check notifications.',
		h1: 'Wix form not working on mobile',
		answer:
			'A Wix form that works on desktop but not on phones is usually covered by another element in the mobile layout, which Wix’s own troubleshooting article lists first. Custom Velo elements added inside the form, or dataset validation errors, can also stop the submit button. Clear anything stacked above the form in the mobile editor, remove Velo elements from inside it, republish and test on a real phone; if submissions save but no email arrives, that is a separate notification problem.',
		symptom:
			'On a phone, tapping a field does not bring up the keyboard, or the submit button does nothing. On desktop the same form works and submissions appear in the dashboard. Sometimes the form submits on mobile but the owner never receives the notification email.',
		causes: [
			{
				title: 'An element overlaps the form on mobile',
				body: 'The mobile layout is arranged separately, and a strip, image, text box or invisible container can end up on top of the fields or the button. Taps then hit that element instead of the form.',
			},
			{
				title: 'Velo elements inside the form',
				body: 'Adding custom inputs or code-driven elements inside a Wix form, or connecting it to a dataset with validation rules, can produce errors that stop submission on some devices.',
			},
			{
				title: 'The mobile layout was never rechecked',
				body: 'Fields added or resized on desktop are not always rearranged for mobile, leaving inputs squeezed, partly hidden or out of view. A submit button pushed below the form’s container can look present but sit outside the area that accepts taps.',
			},
		],
		steps: [
			'Open the Wix Editor, switch to Mobile view and select the form. In the Layers panel look for anything above it; move that element out of the way or use Arrange > Send Backward.',
			'Check each field at mobile width is fully visible and that the submit button is not clipped by the form’s own container.',
			'If you added Velo elements inside the form, remove them and manage fields through the form’s own settings, or move the custom logic outside the form.',
			'With Dev Mode on, open the browser console on the live site while you submit to catch dataset or code errors.',
			'Republish and test on a real phone, signed out, with test data.',
			'If submissions appear under Forms & Submissions in the dashboard but no email arrives, check spam for messages from no-reply@wixsiteautomations.com, allowlist Wix’s sending domains, and confirm the recipient address in the form’s Automations.',
		],
		verify: [
			'On the live site at phone width, tap every field, submit test data and confirm the success message appears.',
			'Check that the test submission shows up in the Wix dashboard under the form’s submissions.',
			'Confirm the notification email reaches the right inbox and not spam.',
		],
		scanFlags: [
			'Phone screenshots with a visual review that points out elements overlapping the form or a submit button cut off.',
			'Whether submitting the form empty brings up validation messages, which shows the form is responding.',
			'Inputs missing accessible labels, found by the accessibility check.',
			'The scan does not enter real data or check your inbox, so delivery of submissions and notification emails is something you confirm yourself.',
		],
		faqs: [
			{
				q: 'Why can visitors not type into my Wix form on a phone?',
				a: 'Usually something transparent sits on top of the field in the mobile layout. The field looks normal, but the tap lands on the element above it. Fix the layer order in Mobile view.',
			},
			{
				q: 'Where do Wix form submissions go?',
				a: 'They are stored in the dashboard under the form’s submissions, whether or not an email notification goes out. If they are there, the form works and the problem is email delivery.',
			},
			{
				q: 'Does a form problem on mobile affect desktop?',
				a: 'Not usually, because the mobile layout is arranged separately. That is why owners who test on a laptop rarely notice until visitors complain, and why a quick phone test after every publish is worth the minute it takes.',
			},
		],
		sources: [
			{ label: 'Wix Help: Wix Forms troubleshooting', url: 'https://support.wix.com/en/article/wix-forms-troubleshooting' },
			{ label: 'Wix Studio forum: submit button doesn’t work on mobile', url: 'https://forum.wixstudio.com/t/submit-button-doesnt-work-on-mobile/29176' },
			{ label: 'Wix Studio forum: customer not receiving contact form emails', url: 'https://forum.wixstudio.com/t/customer-not-receiving-contact-form-emails/74390' },
		],
		related: ['wix/mobile-menu-not-working', 'wix/site-slow-on-mobile'],
		updated: '2026-10-26',
	},
	{
		platform: 'wix',
		problem: 'site-slow-on-mobile',
		query: 'wix site slow on mobile',
		title: 'Wix Site Slow on Mobile? What Actually Helps',
		description:
			'Wix site crawls on phones and scores poorly in PageSpeed? Cut autoplay video, heavy apps and oversized images above the fold, then retest on mobile data.',
		h1: 'Wix site slow on mobile: what to change',
		answer:
			'A slow Wix site on mobile is usually carrying too much above the fold: autoplay or background video, heavy animations, large images and several apps or embeds loading on the same page. Wix handles hosting and much of the delivery, so the gains come from what you put on the page. Swap hero videos for a still image, remove unused apps and embeds, resize images before upload, and judge progress with the Site Speed dashboard and a real phone on mobile data.',
		symptom:
			'Pages take a long time to show anything useful on a phone, the layout jumps while it loads, and PageSpeed Insights gives the mobile version a much lower score than desktop. Visitors on mobile data notice it most.',
		causes: [
			{
				title: 'Video and animation above the fold',
				body: 'Autoplay videos, video backgrounds on strips and entrance animations all compete for the first seconds of loading. On a phone with a weaker processor and connection, they delay the content people came for.',
			},
			{
				title: 'Large images and long pages',
				body: 'Photos uploaded straight from a camera, galleries with many items and pages with dozens of sections all add weight. Each extra app section adds its own scripts too.',
			},
			{
				title: 'A lazy-loaded hero you cannot change',
				body: 'Wix Studio users report the main above-the-fold image being lazy-loaded with no setting to turn that off, which can hold back the Largest Contentful Paint measurement. That one is partly outside your control.',
			},
			{
				title: 'Third-party embeds and custom code',
				body: 'Chat widgets, social feeds, booking embeds and tracking snippets added through Custom Code each load extra scripts from other servers.',
			},
		],
		steps: [
			'In the Wix dashboard open Analytics > Site Speed to see real-visitor data, and focus on the pages that bring in traffic or leads rather than chasing a perfect score on every page.',
			'Replace autoplay and background videos in the first screen with a compressed still image. If the video matters, let visitors tap to play it.',
			'Go through Apps > Manage Apps and remove apps you no longer use, and delete embeds that do not earn their place. Under Settings > Custom Code, remove old tracking snippets.',
			'Resize images to roughly the size they display at before uploading and keep to one or two font families.',
			'Split very long pages into separate pages, and remove entrance animations from sections near the top on mobile.',
			'Test on a real phone over mobile data, then rerun PageSpeed Insights and compare the field data over the following weeks, not only the lab score.',
		],
		verify: [
			'On a phone on 4G, the headline and main button appear quickly and nothing jumps while the page settles.',
			'PageSpeed Insights mobile field data improves over the following weeks for the pages you changed. Field data lags behind edits because it is collected from real Chrome users over a rolling period.',
		],
		scanFlags: [
			'Google PageSpeed (Lighthouse) performance scores for the scanned page.',
			'Layout shift measured while the page loads, which video and animation often cause.',
			'Failed or erroring requests from embeds and apps, plus console errors from custom code.',
			'Phone-width screenshots so you can see what loads in the first screen.',
		],
		faqs: [
			{
				q: 'Can I get a perfect PageSpeed score on Wix?',
				a: 'Rarely, because Wix loads its own platform scripts you cannot remove. Aim for a fast first screen and stable layout on real phones; that matters more to visitors than the number.',
			},
			{
				q: 'Does Wix compress my images automatically?',
				a: 'Wix serves images in modern formats and resizes them for display, but starting from a huge original still costs more. Uploading sensibly sized images helps.',
			},
			{
				q: 'Why is my site fast on Wi-Fi but slow on my phone?',
				a: 'Mobile networks have more latency and phones have slower processors, so every script and video costs more there. Always judge speed on the device and connection your visitors use.',
			},
		],
		sources: [
			{ label: 'Wix Studio forum: mobile speed is so slow', url: 'https://forum.wixstudio.com/t/the-mobile-speed-is-so-slow-how-to-make-faster/50193' },
			{ label: 'Wix Studio forum: loading time still slow', url: 'https://forum.wixstudio.com/t/i-have-done-everything-right-and-still-my-wix-sites-loading-time-is-so-slow/68490' },
		],
		related: ['wix/form-not-working-on-mobile'],
		updated: '2026-10-26',
	},

	// ───────────────────────────── Webflow ─────────────────────────────
	{
		platform: 'webflow',
		problem: 'form-oops-something-went-wrong',
		query: 'webflow form oops something went wrong while submitting the form',
		title: 'Webflow Form “Oops! Something Went Wrong” Fix',
		description:
			'Webflow form shows “Oops! Something went wrong while submitting the form”? Check reCAPTCHA, plan limits, hosting and custom actions in that order.',
		h1: 'Webflow form: “Oops! Something went wrong while submitting the form”',
		answer:
			'Webflow shows “Oops! Something went wrong while submitting the form” when the submission is rejected. The most common causes are reCAPTCHA switched on in Site settings while the form has no reCAPTCHA element, the plan’s form submission limit being reached, the site being exported and hosted elsewhere so Webflow never receives the form, or a misconfigured custom action URL. Check those in order, then publish and test the live form with the Network tab open.',
		symptom:
			'A visitor fills in a Webflow form, clicks submit and the form switches to its error state with the default “Oops! Something went wrong” message. Sometimes every form on the site starts failing at once, or the submit button looks disabled and cannot be clicked at all.',
		causes: [
			{
				title: 'reCAPTCHA is on but missing from the form',
				body: 'When reCAPTCHA validation is enabled in Site settings, Webflow expects every form to include a reCAPTCHA element. Forms without one fail to submit, which is why turning it on can break all forms at once.',
			},
			{
				title: 'The plan’s submission limit is used up',
				body: 'Site plans include a set number of form submissions. Once a lower-tier site reaches its limit, further submissions are not processed until the plan changes.',
			},
			{
				title: 'The site is not hosted on Webflow',
				body: 'Exported code hosted elsewhere keeps the form markup but not Webflow’s form handling. Submissions have nowhere to go unless you connect your own endpoint.',
			},
			{
				title: 'A custom action or bot protection is misconfigured',
				body: 'A form pointed at a third-party Action URL with the wrong method or a broken endpoint returns an error. Bot protection such as Cloudflare Turnstile can also leave the submit button disabled if its check never completes.',
			},
		],
		steps: [
			'Open Site settings > Apps & Integrations and look at reCAPTCHA validation. If it is enabled, add a reCAPTCHA element inside every form on the site, or turn validation off.',
			'Open Site settings > Forms and compare the submission count with your plan’s limit. If you have hit it, upgrade or wait for the reset.',
			'If you exported the site, connect the forms to your own handler or a form service; Webflow will not process them from another host.',
			'Select the form block in the Designer and check the Action and Method fields in Settings. If you use a custom Action URL, confirm the endpoint works and accepts that method, and note Webflow’s notification emails no longer apply.',
			'Publish, open the live page in a private window with DevTools > Network open, submit test data and inspect the submit request’s status and response.',
			'Edit the form’s Error state to say something useful and include an email address, so a visitor who hits it still has a way to reach you.',
		],
		verify: [
			'Submit test data on the published domain and confirm the Success state appears.',
			'Check the submission is listed in Site settings > Forms and that the notification email arrives.',
			'Repeat on a phone, where bot-protection checks sometimes behave differently.',
		],
		scanFlags: [
			'Whether submitting the form empty shows validation feedback or the error state.',
			'JavaScript errors and failed requests on the page, including reCAPTCHA or Turnstile scripts that did not load.',
			'A submit button that is visible but disabled in the screenshots.',
			'The scan never submits real data and cannot see your plan limits or notification emails, so those you check in Site settings.',
		],
		faqs: [
			{
				q: 'Why did all my Webflow forms stop working at the same time?',
				a: 'A site-wide setting changed. Enabling reCAPTCHA without adding the element to every form, or reaching the plan’s submission limit, both affect every form at once.',
			},
			{
				q: 'Can I use Webflow forms on an exported site?',
				a: 'Not with Webflow’s own handling. Exported sites need a form backend of your own or a third-party service set as the form’s Action.',
			},
			{
				q: 'Can I change the “Oops” message?',
				a: 'Yes. Select the form block, switch to the Error state in the settings and edit the text like any other element. Adding a contact email there is good practice.',
			},
		],
		sources: [
			{ label: 'Webflow Help: how to add forms', url: 'https://help.webflow.com/hc/en-us/articles/33961347548563-How-do-I-add-forms-in-Webflow' },
			{ label: 'Webflow community: Oops! Something went wrong', url: 'https://community.webflow.com/ask-answer/post/oops-something-went-wrong-while-submitting-the-form-gcAM9bZgYXWB8wj' },
			{ label: 'Webflow community: all forms suddenly stopped working', url: 'https://community.webflow.com/ask-answer/post/all-forms-on-our-website-have-suddenly-stopped-working-sygDH7DWitb0gHf' },
			{ label: 'Webflow community: submit button disabled with Turnstile', url: 'https://community.webflow.com/ask-answer/post/form-submit-button-disabled-with-turnstile-bot-protection-MahcIrhqC3oUr4f' },
		],
		related: ['webflow/interactions-not-working-on-published-site'],
		updated: '2026-10-26',
	},
	{
		platform: 'webflow',
		problem: 'mobile-menu-not-opening',
		query: 'webflow mobile menu not opening',
		title: 'Webflow Mobile Menu Not Opening? Fix It',
		description:
			'Webflow hamburger missing, not opening or not closing after a section link on tablet and phone? Check the Navbar, conflicting interactions and z-index.',
		h1: 'Webflow mobile menu not opening',
		answer:
			'If a Webflow mobile menu will not open on the published site, the usual causes are custom interactions on the menu button clashing with the Navbar element’s built-in toggle, a script error from custom code that stops Webflow’s JavaScript, or the menu button being hidden or covered at tablet and phone breakpoints. Use either the native Navbar behaviour or your own interaction, not both, check the button at each breakpoint, and look for console errors on the live site.',
		symptom:
			'At tablet or phone size the hamburger button does not appear, does nothing when tapped, or opens a menu that slides behind the page content. On one-page sites the menu opens but stays open after tapping a section link, covering the section the visitor wanted.',
		causes: [
			{
				title: 'Custom interactions clash with the Navbar',
				body: 'The Navbar element has its own open and close behaviour. Adding a click interaction to the same menu button means two things respond to one tap, and the menu may open and close instantly or not at all.',
			},
			{
				title: 'A script error stops Webflow’s JavaScript',
				body: 'Custom code in the head, footer or an Embed element that throws an error can prevent Webflow’s site script from running fully, and the Navbar toggle is part of it.',
			},
			{
				title: 'The button is hidden or covered at that breakpoint',
				body: 'A display: none set on the menu button at tablet, or a section with a higher z-index overlapping the navbar, makes the button missing or untappable. A nav menu with a low z-index opens behind the content.',
			},
			{
				title: 'The navbar is not a Navbar element',
				body: 'Headers built from plain divs have no built-in menu button, so nothing toggles at smaller sizes unless you build the interaction yourself.',
			},
		],
		steps: [
			'In the Designer, select the Navbar and switch to the Tablet, Mobile landscape and Mobile portrait breakpoints. Confirm the Menu button is visible and not set to display: none at any of them.',
			'Open the Interactions panel with the menu button selected. If you are using the Navbar’s native toggle, remove custom click interactions from the button; if you want your own animation, use a plain div header instead.',
			'Publish, open the live site, set DevTools to a phone width and watch the Console for errors from custom code. Temporarily remove suspect embeds and republish to confirm.',
			'Give the Navbar a position and a z-index higher than the page sections, and check that no section uses a negative top margin to slide under the header.',
			'For one-page sites, add an interaction or a small script that closes the menu when a section link is tapped, so it does not stay open over the content.',
		],
		verify: [
			'On the published site at 991px, 767px and 479px wide, open the menu, tap a link and confirm it closes and navigates.',
			'Test on a real phone, including a link to a section on the same page.',
		],
		scanFlags: [
			'Phone screenshots of the published site with a visual review that points out a missing, overlapped or cut-off menu.',
			'Console errors from custom code that can stop Webflow’s scripts.',
			'Navigation links that return errors when followed.',
			'The scan does not open the menu and tap each item, so a toggle that appears fine but does not respond still needs a manual tap test.',
		],
		faqs: [
			{
				q: 'Why does my Webflow menu work in the Designer but not live?',
				a: 'The Designer preview does not run custom code from Site settings or Embed elements. On the published site that code runs, and an error in it can stop the Navbar script.',
			},
			{
				q: 'Why does the menu stay open after tapping a link on a one-page site?',
				a: 'The Navbar closes on page navigation, but a link to a section on the same page does not navigate. Add an interaction or script that closes the menu on link click.',
			},
			{
				q: 'At what width does the Webflow menu collapse?',
				a: 'The Navbar setting “Menu” lets you choose the breakpoint where it collapses into the button, commonly Tablet. Check that setting if the hamburger appears at the wrong size.',
			},
		],
		sources: [
			{ label: 'Webflow community: nav menu button', url: 'https://community.webflow.com/ask-answer/post/nav-menu-button-yad7XQNUKxwDRd9' },
			{ label: 'Webflow community: mobile menu not closing after section link', url: 'https://community.webflow.com/ask-answer/post/mobile-navigation-menu-not-closing-after-section-link-click-P2vC9f9GnydnFJO' },
		],
		related: ['webflow/horizontal-scroll-on-mobile', 'webflow/interactions-not-working-on-published-site'],
		updated: '2026-10-26',
	},
	{
		platform: 'webflow',
		problem: 'horizontal-scroll-on-mobile',
		query: 'webflow horizontal scroll on mobile',
		title: 'Webflow Horizontal Scroll on Mobile? Fix It',
		description:
			'Webflow site drags sideways on phones and shows white space on the right? Find the element that is too wide and clip it with overflow hidden.',
		h1: 'Webflow site scrolls sideways on mobile',
		answer:
			'Sideways scrolling on a Webflow site means one element is wider than the screen. The usual suspects are interactions that start elements off-screen, fixed pixel widths or 100vw widths inside padded containers, negative margins, and wide embeds or logo marquees. Find the element by previewing each breakpoint, then set Overflow to Hidden on its parent section, or replace the fixed width with a percentage or max-width.',
		symptom:
			'On a phone the page can be dragged left and right, revealing a strip of white space down the right side. Text may look slightly off-centre, and pinch-zoom behaves oddly. Desktop looks perfect.',
		causes: [
			{
				title: 'Slide-in interactions start off-screen',
				body: 'An element animated in from the right sits outside the viewport before the animation runs. Without a parent that clips it, the browser extends the page to include it, which Webflow’s own help notes is most noticeable on mobile.',
			},
			{
				title: 'Widths that do not fit small screens',
				body: 'A fixed width in pixels, a 100vw element inside a container with padding, or negative left and right margins all push past the edge of a phone screen.',
			},
			{
				title: 'Wide embeds, sliders and marquees',
				body: 'Map and video embeds with fixed widths, slider tracks and scrolling logo strips are common causes, because they are built to be wider than the visible area.',
			},
			{
				title: 'Long words and unbroken strings',
				body: 'A long email address, URL or headline word in a large font cannot wrap on a narrow screen, so its text box grows past the edge. Webflow’s Typography settings for word breaking, or a smaller heading size at Mobile portrait, solve it.',
			},
		],
		steps: [
			'Preview the site at each breakpoint in the Designer and try to scroll sideways. Then publish, open the live site in Chrome device mode at 390px and hover through the sections in the Elements panel; the highlighted box that extends past the right edge of the screen is the culprit.',
			'Select the parent Section of the element that overflows and, in the Style panel under Size, set Overflow to Hidden. If you need the direct wrapper to stay visible for shadows, apply it one level up.',
			'Replace fixed pixel widths with a percentage or max-width at the Mobile breakpoints, and remove negative margins there.',
			'Swap any 100vw width for a full-width setting on an element that sits outside padded containers.',
			'Remember that overflow hidden on a parent breaks position: sticky on elements inside it; if a sticky element stops sticking, move the clipping to a different wrapper.',
			'Publish and test on a real phone.',
		],
		verify: [
			'At 479px in the browser and on a real phone, swipe sideways on every page; nothing should move.',
			'Scroll through slower pages fully, since some interactions only push content out once they trigger.',
			'Rotate the phone to landscape and back, because the Mobile landscape breakpoint has its own styles and can overflow on its own.',
		],
		scanFlags: [
			'Horizontal overflow at phone width, flagged from the screenshots by the visual review with the area that sticks out.',
			'Overlapping or clipped elements on the phone layout.',
			'Layout shift while the page loads, which off-screen animations can cause.',
			'Only the pages included in the scan are checked: the free scan covers the homepage, so a wide element on an inner page needs a paid report or your own swipe test.',
		],
		faqs: [
			{
				q: 'Why not just set overflow hidden on the body?',
				a: 'It hides the symptom but can break sticky positioning and scroll-based interactions, and on some mobile browsers the page can still move. Clipping the specific section is safer.',
			},
			{
				q: 'Why does the white space appear only on the live site?',
				a: 'Interactions and embeds load fully on the published site, and real phones are narrower than the Designer’s preview widths, so overflow that is borderline in the Designer becomes visible.',
			},
			{
				q: 'Does sideways scrolling affect SEO?',
				a: 'Content wider than the screen is one of the problems Lighthouse and mobile usability checks report. More directly, it makes the site feel broken to phone visitors.',
			},
		],
		sources: [
			{ label: 'Webflow Help: overflow hidden', url: 'https://help.webflow.com/hc/en-us/articles/33961334731411-Overflow-hidden' },
			{ label: 'Webflow community: horizontal scrolling and overflow hidden', url: 'https://community.webflow.com/ask-answer/post/horizontal-scrolling-issue-overflow-hidden-H5HIuzWg3C6dYBN' },
		],
		related: ['webflow/mobile-menu-not-opening', 'webflow/interactions-not-working-on-published-site'],
		updated: '2026-10-26',
	},
	{
		platform: 'webflow',
		problem: 'interactions-not-working-on-published-site',
		query: 'webflow interactions not working on published site',
		title: 'Webflow Interactions Not Working When Live?',
		description:
			'Webflow animations play in preview but not on the live site, or content stays invisible on phones? Check triggers, breakpoints and custom code errors.',
		h1: 'Webflow interactions not working on the published site',
		answer:
			'When Webflow interactions work in preview but not live, a script error from custom code is often stopping Webflow’s interactions runtime, or the trigger never fires on that device, such as a hover trigger on a phone. The risky part is that elements with an initial state of hidden or opacity 0 stay invisible when that happens. Check the live Console for errors, confirm which breakpoints each interaction runs on, and give important content a visible fallback.',
		symptom:
			'Animations play in the Designer preview but nothing moves on the published site, or sections stay blank on phones. Scroll animations get stuck halfway, and text or images that should fade in never appear, leaving gaps visitors read as missing content.',
		causes: [
			{
				title: 'The trigger never fires on that device',
				body: 'Hover triggers have no real equivalent on touch screens, and scroll triggers depend on layout that changes at smaller breakpoints. If the element starts hidden, it stays hidden when its trigger does not happen.',
			},
			{
				title: 'Custom code stops the runtime',
				body: 'An error in custom code in Site settings, Page settings or an Embed can stop Webflow’s interactions script, along with any GSAP-based effects that rely on it.',
			},
			{
				title: 'The interaction is limited to certain breakpoints',
				body: 'Interactions can be set to run only on some devices. An animation turned off for phones leaves the element in whatever state it started in.',
			},
			{
				title: 'Reduced motion settings',
				body: 'Visitors who turn on “reduce motion” in their operating system may get different behaviour if the site respects that preference, which can look like a bug if content depends on movement to appear.',
			},
		],
		steps: [
			'Publish, open the live site, and check DevTools > Console for errors. Temporarily remove custom code embeds that throw errors and republish to see whether interactions return.',
			'Select the animated element, open the Interactions panel and check the trigger settings to see which breakpoints the interaction runs on.',
			'Replace hover triggers with click or scroll-into-view triggers at Tablet and below.',
			'Avoid starting important text or images at opacity 0 or display none; if you must, make sure the trigger is reliable on every device or set a visible state for smaller breakpoints.',
			'For scroll animations that stick, check the trigger offsets at each breakpoint, since shorter or taller sections change where the animation starts.',
			'Test on a real iPhone and Android phone, scrolling at normal speed.',
		],
		verify: [
			'Scroll through each page on a phone and confirm all content becomes visible with no blank sections.',
			'Reload with the console open and confirm no errors appear.',
			'Turn on Reduce Motion in the phone’s accessibility settings and scroll again; every section should still be readable, even if nothing animates.',
		],
		scanFlags: [
			'Phone and desktop screenshots where the visual review can spot blank sections or content that never appeared.',
			'Console errors from custom code that stop interactions.',
			'Layout shift while the page loads and animates.',
			'The scan can tell that content is missing from a screenshot, but it cannot judge whether an animation looks the way you designed it.',
		],
		faqs: [
			{
				q: 'Why do interactions work in the Designer but not live?',
				a: 'The Designer preview does not run custom code, while the live site does. An error there can stop the interactions script on the published page only.',
			},
			{
				q: 'Do hover interactions work on phones?',
				a: 'Not reliably. Touch screens do not hover; iOS and Android may fire a hover effect on the first tap and then a click on the second, which feels broken. Use click or scroll triggers on tablet and phone breakpoints instead.',
			},
			{
				q: 'Is content hidden by interactions bad for SEO?',
				a: 'Search engines can usually read text in the page even when it starts hidden. The bigger risk is people seeing an empty section and leaving, so give important content a visible fallback.',
			},
		],
		sources: [
			{ label: 'Webflow community: GSAP scroll interaction not working live', url: 'https://community.webflow.com/ask-answer/post/gsap-scroll-interaction-not-working-flowing-properly-when-the-site-is-0wrW6EnN7zvaz84' },
			{ label: 'Webflow Help: intro to interactions', url: 'https://help.webflow.com/hc/en-us/articles/33961310025107-Intro-to-Interactions' },
		],
		related: ['webflow/horizontal-scroll-on-mobile', 'webflow/mobile-menu-not-opening'],
		updated: '2026-10-26',
	},

	// ───────────────────────────── Any website ─────────────────────────────
	{
		platform: 'any-website',
		problem: 'website-not-working-on-iphone-safari',
		query: 'website not working on iphone safari but works in chrome',
		title: 'Website Not Working on iPhone Safari? Fix It',
		description:
			'Buttons, forms or whole pages fail on iPhone Safari but work in Chrome and on Android? Find the script error, overlay or touch issue behind it.',
		h1: 'Website not working on iPhone Safari but works in Chrome',
		answer:
			'When a site fails on iPhone Safari but works in Chrome on desktop and Android, the most common cause is JavaScript that uses a feature older Safari versions do not support, which throws an error and stops every script on the page. Other causes are Safari’s tracking prevention blocking third-party scripts or cookies, an invisible layer over buttons on iOS, and menus that rely on hover. Connect an iPhone to a Mac and use Safari’s Web Inspector to read the first error.',
		symptom:
			'On iPhones a button does nothing, a form will not submit, a menu will not open, or the page loads forever. The same page works in desktop Chrome and on Android phones. It may affect only some iPhones, typically those that have not updated iOS in a while.',
		causes: [
			{
				title: 'Code older Safari cannot parse',
				body: 'Safari often adopts new JavaScript features later than Chrome. Regex lookbehind, for example, was only supported from Safari 16.4. A script using such a feature fails to parse on older iPhones and everything in that file stops.',
			},
			{
				title: 'Tracking prevention blocks a dependency',
				body: 'Safari limits third-party cookies and storage. Embedded checkouts, chat widgets, login iframes or scripts that expect those cookies can fail silently on iPhones only.',
			},
			{
				title: 'An invisible layer on iOS',
				body: 'Differences in how iOS treats 100vh, fixed positioning and the address bar can leave an overlay or fixed footer covering buttons on iPhone screen sizes.',
			},
			{
				title: 'Hover-only or non-button controls',
				body: 'Menus that open on hover, and click handlers attached to plain divs or spans, can fail to respond to taps on iOS. Real button and link elements behave far more reliably.',
			},
		],
		steps: [
			'Test in real Safari. On an iPhone, enable Settings > Safari > Advanced > Web Inspector, connect it to a Mac and open Safari’s Develop menu to see the page’s console. Without an iPhone, Safari on a Mac with Responsive Design Mode catches many, but not all, issues.',
			'Find the first SyntaxError or TypeError in the console. Look up the feature it mentions on caniuse.com and compare it with the iOS versions your visitors use.',
			'If you control the build, set your browser targets to include older Safari versions so the code is transpiled or polyfilled. If the error comes from a theme or plugin, report it to the vendor with the console message.',
			'For third-party widgets, test with Settings > Safari > Prevent Cross-Site Tracking on and off to see whether tracking prevention is involved, then use the vendor’s first-party or Safari-compatible option.',
			'Replace clickable divs with real button and a elements, and make menus open on tap rather than hover.',
			'Inspect the page at iPhone sizes for fixed or full-height layers that cover the content you are tapping.',
		],
		verify: [
			'On an iPhone on the current iOS and, ideally, one a version or two behind, tap every main button, open the menu and submit each form.',
			'Keep Web Inspector connected and confirm the console stays clear of errors while you do.',
		],
		scanFlags: [
			'QAlaunch’s scan runs in Chromium at phone width, so it catches layout, overlap, console and link problems that also affect iPhones, but not bugs that exist only in Safari’s WebKit engine.',
			'Phone-width screenshots with a visual review for overlapping elements and cramped tap targets.',
			'JavaScript errors and failed requests that occur in Chromium too.',
			'Safari-only failures need hands-on testing on a real iPhone, which is what the $299 manual test is for.',
		],
		faqs: [
			{
				q: 'Why does Chrome on my iPhone fail too?',
				a: 'Every browser on iOS has historically used Apple’s WebKit engine underneath, so Chrome on an iPhone usually behaves like Safari. That is a quick way to confirm the problem is the engine, not the browser.',
			},
			{
				q: 'Can I test Safari without an iPhone?',
				a: 'Safari on a Mac shares the same engine and catches many problems. Cloud device services can also run real iPhones remotely. Chrome’s device mode only changes the size, not the engine.',
			},
			{
				q: 'Do I need to support old iOS versions?',
				a: 'Check your analytics for the iOS versions visitors actually use. Many people keep older iPhones that cannot update to the latest iOS, so one or two versions back is a reasonable baseline.',
			},
		],
		sources: [
			{ label: 'Meteor forums: site works in Chrome and Edge but fails in Safari', url: 'https://forums.meteor.com/t/site-works-in-chrome-and-edge-but-fails-in-safari/40879' },
			{ label: 'Shufflehound support: WooCommerce checkout button not working on iPhones', url: 'https://support.shufflehound.com/forums/topic/woocommerce-checkout-button-not-working-on-iphones/' },
			{ label: 'Bubble forum: buttons work on desktop but not mobile', url: 'https://forum.bubble.io/t/buttons-work-on-desktop-but-not-mobile/316459' },
		],
		related: ['wordpress/button-not-clickable-on-mobile', 'any-website/ssl-installed-but-site-not-secure'],
		updated: '2026-10-26',
	},
	{
		platform: 'any-website',
		problem: 'ssl-installed-but-site-not-secure',
		query: 'ssl installed but website still not secure',
		title: 'SSL Installed but Site Still Not Secure? Fix',
		description:
			'Certificate is installed but the browser still says Not secure? Check the certificate’s hostname and chain, the http to https redirect and insecure assets.',
		h1: 'SSL is installed but my website still says “Not secure”',
		answer:
			'A site can have a valid certificate and still show “Not secure” for four reasons: the page loads some images, scripts or fonts over http:// (mixed content), the certificate does not cover the exact hostname or is missing an intermediate certificate, there is no redirect from http to https, or a browser or CDN cache is showing the old state. Click the icon in the address bar to read the certificate, then check the console for Mixed Content warnings.',
		symptom:
			'The host or certificate provider says SSL is active, yet the browser shows “Not secure”, a warning triangle or no padlock. It may happen only on some pages, only on www or non-www, or only when someone types the address without https://.',
		causes: [
			{
				title: 'Insecure files on a secure page',
				body: 'If an https page loads an image, stylesheet, script or font from an http:// address, browsers mark the page as not fully secure and block the riskiest files outright.',
			},
			{
				title: 'The certificate does not match or is incomplete',
				body: 'A certificate issued for example.com does not cover www.example.com unless both names are on it. An expired certificate, or a server that does not send the intermediate certificate, makes some browsers and devices distrust it.',
			},
			{
				title: 'Visitors still land on http',
				body: 'Installing a certificate does not move anyone to https. Without a 301 redirect, links, bookmarks and typed addresses keep opening the http version, which browsers label “Not secure”.',
			},
			{
				title: 'A cache shows the old state',
				body: 'Browsers, CDNs and server caches can keep serving pages built before the switch, with old http links, for a while after the certificate goes live.',
			},
		],
		steps: [
			'Click the icon to the left of the address, open the connection or certificate details and check the names it covers, the expiry date and that the chain shows an intermediate certificate. An online SSL checker can confirm the chain from outside.',
			'Open DevTools > Console and copy every Mixed Content URL. Update each to https://, host the file yourself, or remove it if the third party has no https version.',
			'Add a single 301 redirect from http to https at the host, server or CDN level, and make sure only one layer does it so you do not create loops.',
			'Pick one canonical hostname, www or non-www. Make sure the certificate covers both and that one redirects to the other.',
			'If you use a CDN or proxy, set its SSL mode to encrypt all the way to your server rather than only to the visitor, then purge its cache.',
			'Retest in a private window or after a hard refresh to rule out your own browser cache.',
		],
		verify: [
			'Open the http://, http://www., https:// and https://www. versions of your address; all four should end on the same https URL with a padlock.',
			'Check the console on a few different pages and confirm no Mixed Content warnings appear.',
		],
		scanFlags: [
			'Whether the scanned page is served over HTTPS and which security headers it sends.',
			'Mixed Content warnings and blocked insecure requests in the console, listed with their URLs.',
			'Images and other files that fail to load, which often turn out to be http assets the browser refused.',
		],
		faqs: [
			{
				q: 'Do I need a new certificate for www?',
				a: 'Only if your current certificate does not list www as a name. Most providers, including free ones, can issue a certificate covering both the bare domain and www at once.',
			},
			{
				q: 'Why is only one page not secure?',
				a: 'That page loads something over http, often an embedded video, map, form or image pasted in with a full http:// address. The console on that page names the file.',
			},
			{
				q: 'How long until the padlock appears after installing SSL?',
				a: 'As soon as the certificate is served correctly and the page has no insecure files. If it does not, clear the cache or try a private window before assuming the install failed.',
			},
		],
		sources: [
			{ label: 'Let’s Encrypt community: SSL installed correctly, no padlock', url: 'https://community.letsencrypt.org/t/ssl-installed-correctly-no-padlock/76365' },
			{ label: 'GoDaddy: why is my website displaying a not secure warning', url: 'https://www.godaddy.com/resources/asia/skills/why-is-my-website-displaying-a-not-secure-warning' },
		],
		related: ['wordpress/mixed-content-not-secure-after-ssl', 'any-website/website-not-working-on-iphone-safari'],
		updated: '2026-10-26',
	},
]
