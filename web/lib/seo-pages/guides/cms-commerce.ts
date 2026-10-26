import type { FixGuide } from '../types'

/** Shopify, WooCommerce and Squarespace store fixes. */
export const GUIDES: FixGuide[] = [
	{
		platform: 'shopify',
		problem: 'add-to-cart-button-not-working',
		query: 'shopify add to cart button not working',
		title: 'Shopify Add to Cart Button Not Working? Fix It',
		description:
			'Add to cart does nothing, stays greyed out, or only works after a refresh? The four causes on Shopify and how to find which one your store has.',
		h1: 'Shopify add to cart button not working: causes and fixes',
		answer:
			'When a Shopify add to cart button does nothing, a JavaScript error in the theme is the usual cause: an app script, a leftover snippet from an uninstalled app, or an edited theme file stops the product form from sending the selected variant. Less often the variant really is unavailable and the theme is correctly disabling the button. Open the browser console on the live product page, click the button, and the first red error tells you which.',
		symptom:
			'A shopper picks a size or colour, taps Add to cart, and nothing happens. Sometimes the button stays greyed out after a variant is chosen, works only after a page refresh, or works on desktop but not on a phone. The Buy it now button may still work, which makes the problem easy to miss when you test it yourself.',
		causes: [
			{
				title: 'A JavaScript error stops the product form',
				body: "Shopify themes use a script to pass the chosen variant ID into the form. If an app injects code that throws an error, or a theme file such as product-form.js was edited, that script never finishes and the button has nothing to submit.",
			},
			{
				title: 'Leftover code from an app you uninstalled',
				body: 'Uninstalling an app does not always remove the script tag it added to theme.liquid. A tag pointing at a file that no longer exists throws an error, and every script after it on the page can fail with it.',
			},
			{
				title: "The theme's cart script lives in a section that broke",
				body: 'Some themes load the AJAX cart code from the header or cart drawer section. Remove or break that section and the add to cart request is never sent, even though the button still looks normal.',
			},
			{
				title: 'The variant genuinely cannot be bought',
				body: 'If a variant is out of stock with "Continue selling when out of stock" turned off, or the product is not available on the Online Store sales channel, the theme disables the button on purpose. That is correct behaviour with a confusing look.',
			},
		],
		steps: [
			'Open the product on your live store in a private window, open DevTools (right-click, Inspect, Console), choose a variant and click Add to cart. Write down the first red error and the file name it mentions.',
			'Go to Online Store > Themes > Customize > App embeds and turn embeds off one at a time, retesting in the theme preview after each. The one that makes the button work again is the culprit.',
			'Duplicate your theme, then open Edit code > layout/theme.liquid in the copy and search for script tags that reference apps you no longer use. Remove them in the copy and preview it.',
			'In Products, open the product and check each variant: inventory quantity, the "Continue selling when out of stock" setting, and that the product is available on the Online Store sales channel.',
			'If the theme is heavily customised, add a fresh copy of the same theme from the Theme Store and preview the product there. If it works in the fresh copy, the bug is in your edits, not in Shopify.',
			'Publish the fixed theme and repeat the test on a real phone over mobile data. Slow connections expose a race where the button is tapped before the scripts behind it have loaded.',
		],
		verify: [
			'In a private window, select every variant in turn and click Add to cart. The cart count or drawer should update each time.',
			'Open /cart and confirm the right variant and price are there, then repeat the whole test at phone width.',
			'Reload the product page with the console open and confirm no red errors appear before you touch anything.',
		],
		scanFlags: [
			'JavaScript errors in the console on the product page, with the file that threw them.',
			'Failed network requests for scripts or app files that no longer exist.',
			'A primary button that is visible but leads nowhere when clicked, on desktop or phone.',
			'It cannot see your inventory or sales channel settings, so a correctly disabled out-of-stock button shows up as a symptom to check, not as a bug.',
		],
		faqs: [
			{
				q: 'Why does Buy it now work but Add to cart does not?',
				a: 'They use different code paths. Buy it now goes straight to checkout through Shopify’s own dynamic checkout button, while Add to cart relies on your theme’s scripts. A theme or app error breaks the second and leaves the first alone.',
			},
			{
				q: 'Can a Shopify app break my add to cart button?',
				a: 'Yes. Upsell, bundle, product option and print-on-demand apps all hook into the product form. An update to one of them, or a conflict between two, is one of the most common reasons the button stops working overnight.',
			},
			{
				q: 'Will switching themes fix it?',
				a: 'It will tell you where the problem is. If the button works in a fresh theme, the cause is your theme edits or an app that only targets your old theme. You do not need to switch permanently; fix the copy you already have.',
			},
			{
				q: 'How do I know how many sales I lost?',
				a: 'Compare product page views with add to cart events in Shopify Analytics for the days before and after the problem started. A sudden drop in the add to cart rate with steady traffic points to the button, not to demand.',
			},
		],
		sources: [
			{ label: 'Shopify Community: add to cart button not working', url: 'https://community.shopify.com/t/add-to-cart-button-not-working/575744' },
			{ label: 'Shopify Community: add to cart buttons not working', url: 'https://community.shopify.com/t/add-to-cart-buttons-not-working/629768' },
		],
		related: ['shopify/cart-drawer-not-opening', 'shopify/variant-price-not-updating'],
		updated: '2026-10-26',
	},
	{
		platform: 'shopify',
		problem: 'cart-drawer-not-opening',
		query: 'shopify cart drawer not opening',
		title: 'Shopify Cart Drawer Not Opening? How to Fix It',
		description:
			'The item is added but the slide-out cart never appears, or the screen dims with no drawer. Find the setting, app or script conflict behind it.',
		h1: 'Shopify cart drawer not opening after add to cart',
		answer:
			'A Shopify cart drawer that will not open is almost always a conflict, not a broken cart: an app that adds its own cart, upsell or badge code is either cancelling the theme’s drawer script or overriding the CSS that slides it in. Check first that Theme settings > Cart is still set to Drawer, then switch app embeds off one at a time in the theme editor. Whichever embed brings the drawer back is the one to take up with its developer.',
		symptom:
			'The shopper clicks Add to cart and the item does go into the cart, but the slide-out panel never shows. Sometimes the page darkens or blurs as if the drawer were about to appear and then nothing slides in, leaving an overlay that blocks the page. On other stores the drawer opens but lists nothing until the page is refreshed, or it only opens on the second or third click.',
		causes: [
			{
				title: 'An app is overriding the drawer’s code or animation',
				body: 'Bundle, upsell, trust badge and sticky cart apps often load their own JavaScript and CSS on every page. When their styles override the transform or visibility rule that moves the drawer on screen, the theme opens the drawer correctly but it stays hidden behind the overlay.',
			},
			{
				title: 'Two carts are listening to the same click',
				body: 'If an app ships its own slide cart while the theme’s drawer is still enabled, both react to the add to cart event. One may stop the other, or they race each other, which is why the drawer opens on some clicks and not on others.',
			},
			{
				title: 'The cart type setting was changed',
				body: 'Themes such as Dawn offer Drawer, Page and Popup notification as cart types. A theme update, a new theme or someone tidying settings can switch it away from Drawer, and the store then behaves exactly as configured rather than as you remember it.',
			},
			{
				title: 'An earlier script error stops the drawer from listening',
				body: 'The drawer only opens if its event listener was registered when the page loaded. A JavaScript error higher up the page, often from an app or an edited snippet, can stop that from happening, so the click adds the item silently.',
			},
		],
		steps: [
			'In Online Store > Themes > Customize, open Theme settings and find the Cart group. Confirm Cart type is set to Drawer; some themes call it slide-out cart or mini cart.',
			'Still in the editor, open App embeds and disable any cart, bundle, upsell, badge or sticky-cart embed one at a time. After each change, add a product in the preview and watch whether the drawer returns.',
			'On the live product page, open DevTools and the Console tab before clicking Add to cart. Any red error that appears on the click, or on page load, names the file to look at.',
			'Switch to the Elements panel and find the drawer element (in Dawn it is a cart-drawer tag). Click Add to cart and see whether it gains an open class or attribute. If it does but stays off-screen, the problem is CSS; if it never changes, the problem is JavaScript.',
			'If an app’s stylesheet is to blame, ask its developer for a compatibility fix for your theme rather than piling on your own CSS overrides, which will quietly break again when the app updates or is removed.',
			'If you use an app’s slide cart on purpose, turn the theme drawer off so only one cart responds to the click.',
			'Repeat the test from a collection page quick-add as well as the product page, on an iPhone in Safari and an Android phone in Chrome.',
		],
		verify: [
			'From a product page, add an item once: the drawer should slide in on the first click showing that item, its variant and the correct subtotal.',
			'Add a second product from a collection quick-add button and confirm the drawer updates without a page refresh.',
			'Close the drawer and check that the dimmed overlay disappears with it and the page can be scrolled and tapped again, at phone width too.',
		],
		scanFlags: [
			'JavaScript errors logged on the page as it loads, including errors thrown by app scripts.',
			'Script or stylesheet requests from apps that fail with a 404 or never load.',
			'Overlays or hidden elements visible in the desktop and phone screenshots, such as a dark layer left over the content.',
			'It does not know which apps you have installed, so it can point at the failing file but not name the app that owns it.',
		],
		faqs: [
			{
				q: 'Why does the drawer only open after I refresh the page?',
				a: 'The add to cart request works, but the code that re-renders and opens the drawer either errored or was interrupted by another script. A refresh simply draws the cart fresh from the server. Look in the console for an error at the moment you click.',
			},
			{
				q: 'Should I fix it with custom CSS?',
				a: 'Only as a temporary patch. Overriding an app’s styles with stronger rules works until the app changes its class names, then the drawer breaks again with no warning. A fix from the app developer, or removing the conflicting app, lasts longer.',
			},
			{
				q: 'Is it safe to turn app embeds off on a live store?',
				a: 'Turning an embed off in the theme editor takes effect when you save, so test on a duplicate theme in preview if the store is busy. Turning an embed off does not uninstall the app or delete its settings.',
			},
		],
		sources: [
			{ label: 'Shopify Community: add to cart drawer not opening after click', url: 'https://community.shopify.com/t/add-to-cart-drawer-not-opening-after-atc-clicked-very-delayed/565334' },
			{ label: 'Shopify Community: cart drawer does not appear (Broadcast theme)', url: 'https://community.shopify.com/t/cart-drawer-doesnt-appear-broadcast-theme/551262' },
		],
		related: ['shopify/add-to-cart-button-not-working', 'shopify/variant-price-not-updating'],
		updated: '2026-10-26',
	},
	{
		platform: 'shopify',
		problem: 'variant-price-not-updating',
		query: 'shopify price not updating when selecting variant',
		title: 'Shopify Variant Price Not Updating? Fix It',
		description:
			'Picking a size or colour leaves the price, photo and URL unchanged, and the default variant lands in the cart. How to trace the broken variant script.',
		h1: 'Shopify price not updating when selecting a variant',
		answer:
			'If the price stays the same when a shopper picks another size or colour, the theme’s variant script has stopped running, usually because it throws an error looking for a page element that custom code or an app removed or renamed. Because the same script also sets the hidden variant ID, the cart then receives the default variant at the default price. Capture the first console error while changing options, then compare against a fresh copy of your theme to see which edit broke it.',
		symptom:
			'You choose Large or Blue on a product page and the price, the main image, the stock message and the ?variant= value in the address bar all stay as they were. The order then comes through for the first variant at its price, which is how many owners find out: a customer complains they were charged for the wrong option or sent the wrong size.',
		causes: [
			{
				title: 'The variant script throws an error and stops',
				body: 'When an option changes, the theme script updates price, media, availability and the hidden ID field in sequence. If one of those steps fails, for example because it expects a product image element that no longer exists, the code stops there and nothing after it runs.',
			},
			{
				title: 'The picker markup was replaced',
				body: 'Swatch apps, custom option apps and hand-edited snippets sometimes replace the theme’s dropdowns or radio buttons with their own. The theme script then cannot find the inputs it listens to, so selecting an option changes nothing behind the scenes.',
			},
			{
				title: 'Options changed after code was customised around them',
				body: 'A developer may have hard-coded option names or their position, such as assuming Size is always Option 1. Renaming an option, reordering options or adding a new one in the product admin breaks that assumption silently.',
			},
		],
		steps: [
			'Open the affected product on the live store, open DevTools > Console, then switch between several options. Copy the first red error and note which file and function it mentions.',
			'Go to Online Store > Themes > Add theme and add a fresh copy of the same theme from the Theme Store. Preview the product in it; if the price updates there, your theme’s edits are responsible.',
			'Compare the product template, the main product section and the variant picker snippet in your theme with the same files in the fresh copy. Shopify’s code editor shows file history for many files, which helps you see recent changes.',
			'In the theme editor’s App embeds, disable swatch, custom option and bundle embeds one at a time and retest the picker in preview.',
			'If the product’s options were recently renamed or reordered, check any custom code for literal option names or index numbers and update it.',
			'After the fix, change options again and watch the address bar: the ?variant= number should change with each choice.',
		],
		verify: [
			'Step through every combination of options and confirm price, compare-at price, main image and availability text change to match each one.',
			'Add two different variants to the cart and check on /cart that each line shows the option you picked at its own price.',
			'Load a variant URL directly (with ?variant= in it) in a private window and check the page opens with that option already selected.',
		],
		scanFlags: [
			'JavaScript errors on product pages included in a paid report, with the file that threw them.',
			'Failed requests for theme or app scripts that the picker depends on.',
			'It does not click through every option combination and has no way to know which price belongs to which variant, so price correctness needs your own check.',
		],
		faqs: [
			{
				q: 'Why does the wrong variant end up in the cart?',
				a: 'The form submits a hidden variant ID. When the picker script fails, that ID never changes from the default, so the cart gets the first variant regardless of what the shopper selected on screen.',
			},
			{
				q: 'The image changes but the price does not. Is that the same bug?',
				a: 'Usually. The variant script handles each element in turn, so a failure partway through can update some parts and not others. The console error tells you which step stopped.',
			},
			{
				q: 'Could this be a Shopify outage?',
				a: 'Rarely. Variant switching runs in your theme in the shopper’s browser. If the same product works in a fresh copy of your theme, Shopify itself is fine and the problem is in your theme or apps.',
			},
		],
		sources: [
			{ label: 'Shopify Community: variant picker doesn’t work', url: 'https://community.shopify.com/t/variant-picker-doesnt-work/342118' },
			{ label: 'Shopify Community: price not changing after choosing variant', url: 'https://community.shopify.com/t/variant-picker-issue-not-working-or-price-not-changing-after-choosing-different-price/412838' },
		],
		related: ['shopify/add-to-cart-button-not-working', 'shopify/cart-drawer-not-opening'],
		updated: '2026-10-26',
	},
	{
		platform: 'shopify',
		problem: 'mobile-site-moves-side-to-side',
		query: 'shopify mobile site moves left and right',
		title: 'Shopify Mobile Site Moving Side to Side? Fix It',
		description:
			'Your Shopify store wobbles sideways on phones or shows white space on the right. Find the element wider than the screen and fix it at the source.',
		h1: 'Shopify mobile site moves left and right: how to stop it',
		answer:
			'A Shopify store that slides sideways on a phone has at least one element wider than the screen: a section with a fixed pixel width, a wide image or embed, a negative margin, a carousel parked off-screen, or a block sized with 100vw inside a padded container. Find that element and fix its width instead of hiding the overflow. Adding overflow-x: hidden to the page is a last resort because it can break sticky headers and does not always stop panning in iOS Safari.',
		symptom:
			'On a phone the page jiggles when you scroll, or you can drag it left to reveal a strip of white on the right edge. Text can look slightly off-centre, and a sticky header may slide with the page. It is usually fine on desktop and in the theme editor’s mobile preview, which is why it is often reported by customers first.',
		causes: [
			{
				title: 'One element is wider than the viewport',
				body: 'A section given a fixed width in custom CSS, a wide table or video embed, a negative margin used to make something full-bleed, or width: 100vw inside a container with padding will all push the page wider than a phone screen.',
			},
			{
				title: 'Carousels and animations sit outside the screen',
				body: 'Sliders, logo marquees and slide-in animations often park items just off to the right until they move into view. Without a parent that clips them, those hidden items still widen the page.',
			},
			{
				title: 'An app injects a fixed-width block',
				body: 'Review widgets, announcement bars, chat bubbles and upsell banners add their own markup. One built with a fixed desktop width can overflow on small screens even though your theme is responsive.',
			},
		],
		steps: [
			'Open the page in Chrome DevTools device mode at 375px wide and drag sideways to see which section sticks out. Do this for the home page, a collection, a product and the cart, since the cause may only appear on one template.',
			'In the Console, paste [...document.querySelectorAll("*")].filter(e => e.getBoundingClientRect().right > document.documentElement.clientWidth) and press Enter. It lists every element that extends past the right edge; the outermost one is usually the cause.',
			'Fix that element directly: remove the fixed width, give images and embeds max-width set to 100 percent, take out negative margins, and replace 100vw with a width based on the container.',
			'If an app widget is the culprit, turn off its embed under Online Store > Themes > Customize > App embeds to confirm, then ask the developer for a mobile fix or adjust its settings.',
			'For sliders, make sure the slider’s wrapper clips its contents. Most themes do this already; custom sliders pasted into a Custom Liquid section often do not.',
			'Only if nothing else works, add overflow-x: hidden. Forum reports show it may need to be on both html and body, and it stops position: sticky working for anything inside it.',
			'Check the result on a real iPhone, because iOS Safari can still allow sideways panning when only the body element is clipped.',
		],
		verify: [
			'At widths between 360px and 414px, swipe sideways on the home, collection, product and cart pages; the page should not move horizontally at all.',
			'Run the Console snippet again on each template and confirm it returns an empty list.',
			'Scroll down a long page on a phone and check that the header still sticks if your theme uses a sticky header.',
		],
		scanFlags: [
			'Horizontal scrolling or overflow at phone width, spotted from the 390px screenshot and visual review.',
			'Elements that overlap, are cut off or sit partly off-screen on mobile.',
			'The free scan covers the homepage only; if the overflow is on product or collection templates, those pages need to be in a paid report to be checked.',
		],
		faqs: [
			{
				q: 'Why does it look fine in the Shopify mobile preview?',
				a: 'The editor preview is a resized frame inside your desktop browser, not a phone. It does not reproduce touch panning or Safari’s handling of overflow, so a real device or DevTools device mode is a better test.',
			},
			{
				q: 'Is overflow-x: hidden on the body a bad fix?',
				a: 'It hides the symptom rather than the cause, and it can break sticky headers and some drawer menus. It is acceptable as a stopgap while you track down the wide element, not as the permanent answer.',
			},
			{
				q: 'Does sideways scrolling hurt sales or SEO?',
				a: 'It makes the store feel broken on the device most shoppers use, and it can make buttons harder to tap. Google evaluates the mobile version of pages, so content that does not fit the screen is worth fixing for both reasons.',
			},
		],
		sources: [
			{ label: 'Shopify Community: horizontal scroll issue on mobile', url: 'https://community.shopify.com/t/how-to-fix-horizontal-scroll-issue-on-mobile-in-shopify/376909' },
			{ label: 'Shopify Community: website moving left to right on mobile', url: 'https://community.shopify.com/t/how-to-stop-website-from-moving-left-to-right-on-mobile/382687' },
			{ label: 'Shopify Community: mobile store keeps moving left and right', url: 'https://community.shopify.com/t/mobile-version-of-shopify-store-keep-moving-left-and-right/310321/6' },
		],
		related: ['shopify/cookie-banner-covering-mobile-screen', 'shopify/product-images-not-loading'],
		updated: '2026-10-26',
	},
	{
		platform: 'shopify',
		problem: 'product-images-not-loading',
		query: 'shopify product images not loading',
		title: 'Shopify Product Images Not Loading: Fixes',
		description:
			'Product photos show as blank boxes, appear only after scrolling or refreshing, or fail in Safari or Firefox. The causes on Shopify and how to test each.',
		h1: 'Shopify product images not loading or showing blank',
		answer:
			'When Shopify product images stay blank, the files are rarely missing. More often the gallery script crashed before it could reveal them, or lazy loading never fired for images that should have loaded straight away, both typically caused by an app or a theme edit. Check the browser console and the Network tab filtered to images: an error points to a script problem, while 404 responses mean the image URL itself is broken.',
		symptom:
			'Product pages show empty grey boxes where photos should be. Images might appear only after you scroll, after a refresh, or after a few seconds, and the problem may happen in Safari or Firefox but not in Chrome. Sometimes the add to cart form disappears alongside the images, which is a strong hint that one script failure is behind both.',
		causes: [
			{
				title: 'The gallery script fails before it starts',
				body: 'Many themes hide product media until a slider or gallery script has set it up. If that script, or one loaded before it, throws an error, the images stay hidden even though they downloaded fine.',
			},
			{
				title: 'Lazy loading never triggers',
				body: 'Images marked to load lazily wait until they are near the screen. If the first product image was set to lazy by a custom edit, or a lazy-load app waits for an event that never fires, the main photo can stay blank until the shopper scrolls.',
			},
			{
				title: 'Too many scripts competing on load',
				body: 'A page carrying many app scripts can be slow enough on mobile connections that images render late or time out, and the delay is worse in some browsers than others.',
			},
			{
				title: 'Image links point to files that no longer exist',
				body: 'Images inserted by URL from another host, or files deleted from Content > Files while still referenced in a description, return a 404 and show as broken.',
			},
		],
		steps: [
			'Open a product page in a private window in both Safari and Chrome. In DevTools, check the Console for errors and the Network tab with the Img filter for requests that fail or return 404.',
			'If there is a console error, note the file. A message such as "is not a function" coming from an app file points to an app conflict rather than to your images.',
			'Disable app embeds under Online Store > Themes > Customize > App embeds one by one, starting with image optimisers, lazy-load and gallery apps, and retest in preview.',
			'Inspect the main product image and check its loading attribute. Current Shopify themes load the first image eagerly; if yours says loading="lazy" on that first image, a custom edit probably changed it.',
			'Re-upload any image whose request returned 404, and replace images hot-linked from other sites with files uploaded to Shopify so they are served from Shopify’s CDN.',
			'Review the apps list and remove ones you no longer use, then load the page again on a phone over mobile data to see whether images appear promptly.',
		],
		verify: [
			'With the cache disabled in DevTools and a Fast 4G throttle on, load three different product pages; the main image should render without scrolling or refreshing.',
			'Repeat in Safari and Firefox, since some of these failures are browser-specific.',
			'Check the Network tab again and confirm no image requests return errors.',
		],
		scanFlags: [
			'Broken images and image requests that return 404 or fail to load.',
			'JavaScript console errors that may stop a gallery from rendering.',
			'Slow mobile performance in the PageSpeed (Lighthouse) results, including large image payloads.',
			'It checks whether images load, not whether each one is the right photo for the product.',
		],
		faqs: [
			{
				q: 'Why do images load in Chrome but not Safari?',
				a: 'Safari and Firefox handle some JavaScript and lazy-loading behaviour differently. An app script that errors only in one browser can stop the gallery there while everything looks fine in Chrome, so always test in more than one.',
			},
			{
				q: 'Will an image compression app fix this?',
				a: 'Not if the cause is a script error or broken lazy loading, and an extra optimisation app can add another script to the page. Shopify already serves resized images from its CDN, so try removing apps before adding one.',
			},
			{
				q: 'How do I find which product images are broken across the store?',
				a: 'Check the Network tab on your best-selling product pages first. For larger catalogues, a crawl or a paid report covering several pages will surface broken image requests faster than clicking through by hand.',
			},
		],
		sources: [
			{ label: 'Shopify Community: product images not loading/showing', url: 'https://community.shopify.com/t/product-images-not-loading-showing/390696' },
			{ label: 'Shopify Community: product images not loading consistently', url: 'https://community.shopify.com/t/why-are-my-product-images-not-loading-consistently-on-my-site/257044' },
		],
		related: ['shopify/add-to-cart-button-not-working', 'shopify/mobile-site-moves-side-to-side'],
		updated: '2026-10-26',
	},
	{
		platform: 'shopify',
		problem: 'cookie-banner-covering-mobile-screen',
		query: 'shopify cookie banner too big on mobile',
		title: 'Shopify Cookie Banner Too Big on Mobile? Fix It',
		description:
			'Consent banner covering half the phone screen or sitting on top of Add to cart? How to shrink it, stop banners stacking and keep buttons reachable.',
		h1: 'Shopify cookie banner too big on mobile or covering the screen',
		answer:
			'A Shopify cookie banner that swamps a phone screen is usually styled for desktop, with long copy, generous padding and stacked buttons, or two banners are running at once (Shopify’s own plus a consent app). Keep one banner, shorten its text, use its built-in position options, and only then add a mobile media query to tighten spacing. The goal is a banner that leaves the product photo, price and Add to cart visible.',
		symptom:
			'On a phone the consent banner fills half the screen or more as soon as the store opens. It may sit on top of the sticky Add to cart bar or the checkout button, and on small phones the Accept button can be pushed below the visible area. Some visitors never see it at all because the banner only shows in certain regions, which makes reports from customers confusing.',
		causes: [
			{
				title: 'The banner is styled for a large screen',
				body: 'Paragraph-length privacy text, wide padding and buttons stacked one above the other look fine on a laptop. On a phone the same box can take up most of the viewport before the shopper has seen a product.',
			},
			{
				title: 'It overlaps a sticky add to cart bar',
				body: 'Bottom-fixed banners and bottom-fixed buy buttons compete for the same strip of screen. Whichever has the higher stacking order covers the other, and it is often the banner that wins.',
			},
			{
				title: 'Two consent banners are switched on',
				body: 'Installing a consent app without turning off Shopify’s own cookie banner, or the reverse, stacks two banners. Each may also need its own tap to dismiss.',
			},
		],
		steps: [
			'Work out which banner you are using. Shopify’s own banner is managed under Settings > Customer privacy > Cookie banner; anything else comes from an app. If both are active, turn off the one you do not need.',
			'Use the banner’s built-in appearance options first: position, compact layout, or a smaller style if offered. These survive app and theme updates better than custom CSS.',
			'Cut the banner text to a sentence or two and link to your privacy policy for the detail instead of explaining everything inside the banner.',
			'If it is still too tall, add CSS inside a mobile media query (for example max-width: 767px) that reduces padding and font size and lets the buttons sit side by side.',
			'Check the banner’s Accept and Decline buttons on a 360px-wide screen and make sure neither is cut off or hidden behind the browser toolbar.',
			'If you use a sticky add to cart bar, confirm the bar is still usable while the banner is showing, or position the banner so they do not overlap.',
		],
		verify: [
			'Open the store in a private window at 360px and 390px widths: the product image, price and Add to cart should still be visible with the banner showing.',
			'Tap Accept and confirm the banner disappears in one tap, without scrolling first, and does not reappear on the next page.',
			'If your banner is limited to certain regions, test from one of those regions, or use the app’s preview setting.',
		],
		scanFlags: [
			'Whether a cookie banner is present on the page.',
			'Overlapping or hidden elements in the phone screenshot, such as a banner sitting over the main button.',
			'Cramped tap targets and menus or buttons that do not fit at 390px wide.',
			'The scan sees the banner only if it is shown to the scan’s location, so a region-limited banner may not appear in its screenshots.',
		],
		faqs: [
			{
				q: 'Can I just hide the banner on mobile?',
				a: 'If you are legally required to ask for consent, hiding it on phones defeats the purpose, since phones are where most visits come from. Make it smaller rather than removing it, and check your obligations with whoever advises you on privacy.',
			},
			{
				q: 'Why do some customers never see the banner?',
				a: 'Shopify’s banner and most consent apps can be limited to visitors from certain regions. A shopper outside those regions, or a test from one, will not see it, which is expected behaviour.',
			},
			{
				q: 'Does a large banner affect Google?',
				a: 'Google’s guidance on intrusive interstitials says notices shown because of a legal obligation, such as cookie consent, are not treated as intrusive. A banner covering most of the page is still a poor first impression for shoppers.',
			},
		],
		sources: [
			{ label: 'Shopify Community: cookie banner too large on mobile', url: 'https://community.shopify.com/t/cookie-banner-too-large-on-mobile/552803' },
			{ label: 'Shopify Community: cookie banner big size on mobile', url: 'https://community.shopify.com/t/cookie-banner-big-size-mobile/553048' },
		],
		related: ['shopify/mobile-site-moves-side-to-side', 'shopify/add-to-cart-button-not-working'],
		updated: '2026-10-26',
	},
	{
		platform: 'woocommerce',
		problem: 'add-to-cart-button-not-working',
		query: 'woocommerce add to cart button not working',
		title: 'WooCommerce Add to Cart Not Working? Fix It',
		description:
			'Add to cart spins, does nothing, or reloads without adding, often only for logged-out visitors or on phones. How to find the cache or plugin at fault.',
		h1: 'WooCommerce add to cart button not working',
		answer:
			'When WooCommerce add to cart fails, test logged out first: if it only breaks for visitors, page caching is serving them a cart without a session, and Cart, Checkout and My Account need excluding from every cache layer. If it fails for everyone, a plugin is throwing a JavaScript error or blocking the wc-ajax request, which a Troubleshooting Mode test will confirm. Mismatched WordPress Address and Site Address settings and outdated theme template overrides are the other common causes.',
		symptom:
			'The button spins and never finishes, does nothing at all, or the page reloads and the cart count stays at zero. Very often it works perfectly for you because you are logged in as an admin, while customers report that nothing goes into the cart. It may also fail only on phones, or only on shop and category pages but not on single product pages.',
		causes: [
			{
				title: 'Caching serves visitors a page without a cart session',
				body: 'Page caching plugins, host-level caches and CDNs can serve logged-out visitors a stored copy of a page, including cart fragments that belong to nobody. Admins usually bypass the cache, which hides the bug from the person trying to fix it.',
			},
			{
				title: 'A plugin breaks the request or the page’s scripts',
				body: 'Form, anti-spam, security and tracking plugins sometimes throw a JavaScript error that stops WooCommerce’s add to cart script, or a firewall rule blocks the wc-ajax request it sends.',
			},
			{
				title: 'Site URLs or cookies do not line up',
				body: 'If Settings > General has different WordPress Address and Site Address values, for example one with www and one without, the session cookie can be set on one host and read on another, so the cart never sticks.',
			},
			{
				title: 'The theme carries outdated WooCommerce templates',
				body: 'Themes can override WooCommerce templates such as the add to cart form. When WooCommerce changes those templates and the theme’s copies do not keep up, buttons can lose the attributes the scripts rely on.',
			},
		],
		steps: [
			'Log out, open a private window and try adding a simple product and a variable product. If it works when logged in but fails here, focus on caching first.',
			'Open DevTools > Network and click Add to cart on a shop page. With AJAX add to cart enabled, look for a request ending in ?wc-ajax=add_to_cart and check its status code and response. On a single product page the classic form posts back to the page instead.',
			'Install the Health Check & Troubleshooting plugin and enable Troubleshooting Mode, which runs only WooCommerce and a default theme for your session. Re-enable plugins one by one until the button breaks again.',
			'In your caching plugin, host panel and CDN, exclude the Cart, Checkout and My Account pages, and make sure requests carrying the woocommerce_items_in_cart or wp_woocommerce_session_ cookies bypass the cache. Purge every cache afterwards.',
			'Go to Settings > General and confirm WordPress Address (URL) and Site Address (URL) match exactly, including https and www.',
			'Open WooCommerce > Status and scroll to Templates. Any override marked as outdated should be updated by the theme developer, or by you in a child theme.',
		],
		verify: [
			'Logged out on a desktop browser and on a phone, add a simple product and a variable product from both the shop page and the product page; the cart count should rise each time.',
			'Open /cart in the same session and confirm both products are listed with the right quantities.',
			'Repeat after purging caches the next day, since cache problems sometimes only return once pages are cached again.',
		],
		scanFlags: [
			'JavaScript errors on the page and failed network requests, as seen by an anonymous, logged-out visitor.',
			'Whether the page’s primary button is visible and leads somewhere when clicked, on desktop and at phone width.',
			'It reports what a visitor experiences but cannot see your caching plugin, host or CDN settings, so a cache cause is inferred, not confirmed.',
		],
		faqs: [
			{
				q: 'Why does add to cart work for me but not for customers?',
				a: 'Logged-in administrators are usually excluded from page caching, so you always get a fresh page with a working session. Visitors get the cached copy. Always test in a private window while logged out.',
			},
			{
				q: 'Should I turn off AJAX add to cart?',
				a: 'You can untick Enable AJAX add to cart buttons on archives under WooCommerce > Settings > Products as a test. If the classic reload works, the problem is with the AJAX request, often a blocked or cached wc-ajax call, rather than the cart itself.',
			},
			{
				q: 'Is Troubleshooting Mode safe on a live shop?',
				a: 'Yes. Health Check’s Troubleshooting Mode disables plugins and switches theme only for your logged-in session, so customers keep seeing the normal site while you test.',
			},
		],
		sources: [
			{ label: 'WordPress.org support: cannot add anything to my cart', url: 'https://wordpress.org/support/topic/cannot-add-anything-to-my-cart-in-woocommerce/' },
			{ label: 'WordPress.org support: add to cart not working on mobiles', url: 'https://wordpress.org/support/topic/add-to-cart-button-missing-from-category-and-not-working-on-mobiles/' },
			{ label: 'WPFixit: WooCommerce add to cart button not working', url: 'https://www.wpfixit.com/woocommerce-add-to-cart-button-not-working/' },
		],
		related: ['woocommerce/cart-empty-after-adding-product', 'woocommerce/variation-dropdown-not-working'],
		updated: '2026-10-26',
	},
	{
		platform: 'woocommerce',
		problem: 'checkout-stuck-spinning',
		query: 'woocommerce checkout keeps spinning',
		title: 'WooCommerce Checkout Keeps Spinning? Fix It',
		description:
			'Place order spins forever, and sometimes the card is charged with no thank-you page. How to read the checkout request and find the slow or failing step.',
		h1: 'WooCommerce checkout keeps spinning after Place order',
		answer:
			'A WooCommerce checkout that spins forever means the browser never received a usable reply to the checkout request: it timed out, or the server returned a PHP error or HTML page instead of the JSON WooCommerce expects. The usual culprits are a slow plugin hooked into order processing, a payment gateway configuration problem, or caching and firewall rules interfering with the request. Watch the request in DevTools during a test order, then check WooCommerce > Status > Logs for the matching error.',
		symptom:
			'The customer presses Place order, the overlay and spinner appear, and nothing else happens. Sometimes the payment has actually gone through, so the customer tries again and is charged twice, and you find duplicate or pending orders in the admin. Other times no order is created at all and the sale is simply lost.',
		causes: [
			{
				title: 'The checkout request times out or returns an error page',
				body: 'The classic checkout posts to ?wc-ajax=checkout and the block checkout uses the Store API. If a slow plugin pushes the request past a server or proxy timeout (Cloudflare shows a 524), or PHP prints an error into the response, the page cannot read it and keeps spinning.',
			},
			{
				title: 'The payment gateway is misconfigured',
				body: 'Wrong or expired API keys, a gateway left in the wrong mode, or a webhook endpoint that no longer matches can leave the payment step hanging, or let the charge succeed while the order is never confirmed back to WooCommerce.',
			},
			{
				title: 'Another plugin hooks into order processing',
				body: 'Affiliate, membership, CRM and email marketing plugins often run code the moment an order is created. One that calls a slow external service, or crashes, holds up the entire checkout response.',
			},
			{
				title: 'Caching or security rules touch checkout requests',
				body: 'A page cache, CDN rule or firewall that caches, rewrites or blocks wc-ajax or Store API requests breaks the conversation between the checkout page and the server.',
			},
		],
		steps: [
			'Put your gateway in test or sandbox mode, open DevTools > Network, and place a test order. Find the checkout request and note its status code and whether the response body is JSON or an HTML error page.',
			'Go to WooCommerce > Status > Logs and open the fatal-errors log and your gateway’s log for the time of the test. A PHP fatal error there usually names the plugin file responsible.',
			'With Health Check & Troubleshooting, enable Troubleshooting Mode and activate only WooCommerce and the payment gateway, then repeat the test order. Add plugins back until the spinner returns.',
			'On the gateway’s settings screen, confirm it is in the intended live or test mode, that the keys match that mode, and that the webhook URL and secret match what the payment provider has on file.',
			'Exclude /checkout/, wc-ajax requests and the Store API path (/wp-json/wc/store/) from page cache, CDN and firewall rules. If requests are merely slow, ask your host about PHP max_execution_time and server timeouts.',
			'Check WooCommerce > Orders for pending or duplicate orders from affected customers, and refund any double charges.',
		],
		verify: [
			'Place test orders on a desktop browser and on a phone: each should redirect to the order-received page within a few seconds.',
			'Confirm exactly one order per test appears under WooCommerce > Orders, with the right status for your gateway.',
			'Check the payment provider’s dashboard for the test charges and make sure each one is matched to a single order.',
		],
		scanFlags: [
			'JavaScript errors and failed script requests on the pages it loads, such as a gateway script that is blocked or missing.',
			'Slow responses and poor performance scores from the PageSpeed (Lighthouse) check.',
			'It does not fill in checkout or complete a payment, so a spinner that only appears after Place order needs a test-mode order or manual testing to reproduce.',
		],
		faqs: [
			{
				q: 'The customer was charged but sees the spinner. What happened?',
				a: 'The payment provider accepted the payment, but WooCommerce’s reply to the browser failed or timed out. Gateway webhooks normally update the order afterwards; if they are misconfigured, the order can stay pending even though the money arrived.',
			},
			{
				q: 'Does this only happen with one payment method?',
				a: 'Test each method you offer separately. If only one spins, look at that gateway’s settings and log first; if all of them spin, the problem is in WooCommerce’s order processing or another plugin.',
			},
			{
				q: 'How do I stop customers paying twice while I fix it?',
				a: 'Add a note on the checkout page telling customers to check their email before retrying, and watch the Orders screen for pending orders. Fixing the timeout is the real cure.',
			},
			{
				q: 'Can an automated scan test my checkout?',
				a: 'It can load the checkout page and report errors there, but it should not submit real payment details. For a full run-through with test cards, manual testing is the honest option.',
			},
		],
		sources: [
			{ label: 'WordPress.org support: PayPal Payments checkout spinning', url: 'https://wordpress.org/support/?p=16733996' },
			{ label: 'WPMU DEV forums: WooCommerce Stripe checkout keeps spinning', url: 'https://wpmudev.com/forums/topic/woocommerce-stripe-checkout-keeps-spinning/' },
		],
		related: ['woocommerce/cart-empty-after-adding-product', 'woocommerce/add-to-cart-button-not-working'],
		updated: '2026-10-26',
	},
	{
		platform: 'woocommerce',
		problem: 'cart-empty-after-adding-product',
		query: 'woocommerce cart empty after adding product',
		title: 'WooCommerce Cart Empty After Adding? Fix It',
		description:
			'The mini cart shows the item but the Cart page says your cart is currently empty, or the cart clears between pages. Fix the cache, cookie or page setup.',
		h1: 'WooCommerce cart empty after adding a product',
		answer:
			'If WooCommerce adds a product but the Cart page says it is empty, the Cart page is almost always being served from a cache, or the shopper’s session cookie is not surviving from one page to the next. Exclude Cart, Checkout and My Account and the WooCommerce cookies from every cache layer, make the site load on a single URL (one protocol, one host), and confirm the right page is assigned as the Cart page. A plugin that hooks into add to cart events is the next thing to rule out.',
		symptom:
			'A shopper adds an item, the header mini cart may even show it, but opening the Cart page displays "Your cart is currently empty". In other cases the cart fills and then empties when the shopper moves to another page, or it works on desktop and keeps clearing on an iPhone. It often looks random because it depends on which cached copy a visitor happens to get.',
		causes: [
			{
				title: 'The Cart page is cached',
				body: 'Plugin caches such as LiteSpeed Cache or WP Rocket, server caches such as Varnish, and CDNs can store a copy of the Cart page taken when it was empty. Every visitor then sees that empty copy, whatever their own session holds.',
			},
			{
				title: 'The session cookie is lost',
				body: 'WooCommerce tracks a guest cart with a session cookie. If the site is reachable on both http and https, or with and without www, the cookie set on one version is not sent to the other, so the cart appears to vanish.',
			},
			{
				title: 'A plugin interferes with add to cart events',
				body: 'Tracking pixels and analytics plugins that listen for add to cart can trigger extra requests or break cart fragments. One reported case cleared up after changing how a tracking plugin fired its event.',
			},
			{
				title: 'The wrong page is set as the Cart page',
				body: 'If the page assigned as the Cart page does not contain the Cart block or the [woocommerce_cart] shortcode, or a different page is assigned, shoppers land somewhere that cannot show their cart.',
			},
		],
		steps: [
			'Go to WooCommerce > Settings > Advanced > Page setup and confirm the Cart page is set to the page you expect, and that the page contains the Cart block or [woocommerce_cart].',
			'In every cache layer you have (plugin, host panel, CDN, Varnish), exclude Cart, Checkout and My Account and bypass caching when WooCommerce cookies are present. Then purge everything.',
			'Check that the site has one canonical address: http should redirect to https, and either www or non-www should redirect to the other. Settings > General should use that same address in both fields.',
			'Under WooCommerce > Status > Tools, run Clear customer sessions. Be aware this empties every current cart, so do it at a quiet time.',
			'Use Health Check & Troubleshooting Mode to test with only WooCommerce active. If the cart then persists, add plugins back, starting with tracking and analytics plugins.',
			'Retest in Safari on an iPhone, which is stricter about cookies than most desktop browsers.',
		],
		verify: [
			'Logged out in a private window, add a product, visit two other pages, then open the Cart page: the item should still be there.',
			'Open the site with http:// and with the other www variant and confirm both redirect to the same https address.',
			'Repeat the add, browse and open-cart test in mobile Safari.',
		],
		scanFlags: [
			'The response headers it receives, including whether the page is served over HTTPS.',
			'Failed network requests and JavaScript errors as a logged-out visitor sees them.',
			'Dead or redirecting links in the navigation, which can reveal mixed http and https or www addresses.',
			'It loads pages as a fresh visitor and does not carry a cart from one page to the next, so cart persistence needs a manual test.',
		],
		faqs: [
			{
				q: 'Why does the mini cart show items when the Cart page does not?',
				a: 'The mini cart is refreshed by a separate request that bypasses the page cache, while the Cart page itself was served from cache. That mismatch is the classic sign of a cached Cart page.',
			},
			{
				q: 'Is LiteSpeed Cache the problem?',
				a: 'Not by itself. LiteSpeed Cache and other caches handle WooCommerce well when cart, checkout and account pages are excluded. The trouble starts when those exclusions are missing or a CDN in front ignores them.',
			},
			{
				q: 'Will clearing customer sessions lose orders?',
				a: 'No. It removes carts that have not been checked out yet, not orders. Anyone mid-shop will find their cart empty, so warn customers or run it when traffic is low.',
			},
		],
		sources: [
			{ label: 'WordPress.org support: cart randomly empty with LiteSpeed installed', url: 'https://wordpress.org/support/?p=17241314' },
			{ label: 'Business Bloomer: solving the WooCommerce cart empty issue', url: 'https://businessbloomer.com/woocommerce-solving-cart-empty-issue/' },
		],
		related: ['woocommerce/add-to-cart-button-not-working', 'woocommerce/checkout-stuck-spinning'],
		updated: '2026-10-26',
	},
	{
		platform: 'woocommerce',
		problem: 'variation-dropdown-not-working',
		query: 'woocommerce variations not selecting',
		title: 'WooCommerce Variations Not Selecting? Fix It',
		description:
			'Size and colour dropdowns ignore clicks, every combo shows unavailable, or it says to select product options. Find the plugin error or bad variation data.',
		h1: 'WooCommerce variations not selecting or dropdown not working',
		answer:
			'When WooCommerce variation dropdowns stop responding, another plugin is usually throwing a JavaScript error that halts WooCommerce’s add-to-cart-variation.js, so the chosen options are never matched to a variation. If the dropdowns work but combinations show as unavailable, check the variation data itself: every variation needs a price, and attribute values must match. The console error on the product page will normally name the plugin to update or roll back.',
		symptom:
			'On a variable product the size or colour dropdowns do not change, every combination is greyed out as unavailable, or the shopper picks everything and still gets the message "Please select some product options before adding this product to your cart." The price and stock text under the dropdowns never appear, and the add to cart button stays disabled.',
		causes: [
			{
				title: 'A plugin error stops the variation script',
				body: 'WooCommerce uses add-to-cart-variation.js to match chosen options to a variation and fill in the hidden variation ID. An error from a tracking, payments or theme script earlier on the page can stop it from running.',
			},
			{
				title: 'A specific plugin release has a bug',
				body: 'Variation selection has been broken by individual plugin updates before; one WooCommerce Payments release was followed by a changelog entry fixing variation selection. A problem that started right after an update points here.',
			},
			{
				title: 'The variation data is incomplete',
				body: 'A variation without a price is treated as unavailable, and attribute values that do not match what the product offers, or "Any" combinations that overlap, can leave valid choices unmatched.',
			},
			{
				title: 'Large products load availability on demand',
				body: 'Above a threshold of variations (30 by default, adjustable with the woocommerce_ajax_variation_threshold filter), WooCommerce looks up each combination with a wc-ajax request. If caching or a firewall blocks that request, choices look broken.',
			},
		],
		steps: [
			'Open the product page with DevTools > Console showing, change each dropdown, and note the first error and the plugin folder named in its file path.',
			'Update the plugin named in the error, or roll back to its previous version if the problem began with an update, and read its changelog for a variation-related fix.',
			'In Products > Edit product > Product data > Variations, open each variation and check it has a regular price and a stock status, and that its attribute values match the product’s attributes.',
			'For products with many variations, watch the Network tab while choosing options. Requests to ?wc-ajax=get_variation should return data, not a cached page or a 403 from a firewall.',
			'Run a conflict test with Health Check & Troubleshooting Mode using a default theme and WooCommerce only, then reactivate plugins one at a time.',
			'If you use a swatches plugin, test with it disabled; swatches replace the dropdowns and must stay in sync with WooCommerce’s script.',
		],
		verify: [
			'Select every combination of options: the price and stock message should update for each, and impossible combinations should be disabled.',
			'Add two different variations to the cart and check the Cart page lists each with the attributes you chose.',
			'Reload the product page with the console open and confirm no errors appear before you interact with it.',
		],
		scanFlags: [
			'JavaScript errors logged on product pages included in a paid report, with the file that caused them.',
			'Failed network requests, including blocked wc-ajax calls the page makes while loading.',
			'It does not choose every option combination and cannot tell whether your variation prices and stock are correct, so the data check is yours.',
		],
		faqs: [
			{
				q: 'What does "Please select some product options" mean when I already did?',
				a: 'WooCommerce did not register your choice, usually because its variation script never ran or could not match the options to a variation. A console error or a variation with no price is the usual reason.',
			},
			{
				q: 'Why do only some products have this problem?',
				a: 'Products above the variation threshold load data differently, and individual products can have incomplete variations. Compare a working product with a broken one: number of variations, prices and attribute setup.',
			},
			{
				q: 'Do I need to rebuild the variations?',
				a: 'Rarely. Filling in missing prices or correcting attribute values is usually enough. Rebuilding is only worth it if the attributes themselves were renamed and the variations no longer reference them.',
			},
		],
		sources: [
			{ label: 'WordPress.org support: product variations not selecting', url: 'https://wordpress.org/support/topic/product-variations-not-selecting/' },
			{ label: 'WordPress.org support: cannot add variable product to cart', url: 'https://wordpress.org/support/topic/cannot-add-variable-product-to-cart/' },
		],
		related: ['woocommerce/add-to-cart-button-not-working', 'shopify/variant-price-not-updating'],
		updated: '2026-10-26',
	},
	{
		platform: 'squarespace',
		problem: 'mobile-menu-not-working',
		query: 'squarespace mobile menu not working',
		title: 'Squarespace Mobile Menu Not Working? Fix It',
		description:
			'The burger icon will not open on phones, needs several taps, or opens cut off. How to find the custom code or overlapping element breaking it.',
		h1: 'Squarespace mobile menu not working or burger not opening',
		answer:
			'A Squarespace mobile menu that will not open is nearly always caused by custom code: CSS that puts another element over the burger icon, a sticky-header tweak, or a script in Code Injection that breaks the menu. Back up your Custom CSS and Code Injection, remove them temporarily, and test again on a phone. If the menu works without them, restore the code piece by piece; a z-index rule inside a max-width: 767px media query often fixes a covered burger.',
		symptom:
			'On a phone the burger icon in the header does nothing when tapped, needs three or four taps before it reacts, or opens a menu that runs off the bottom of the screen with no way to scroll. Sometimes it only fails on the homepage or one other page, and works everywhere else. Anchor links in the mobile menu may scroll the page but leave the menu open on top.',
		causes: [
			{
				title: 'Custom CSS or code covers or breaks the burger',
				body: 'Rules for sticky headers, announcement bars or layered sections can place an invisible element over the burger, so taps land on that element instead. A script added through Code Injection can also throw an error that stops the menu from responding.',
			},
			{
				title: 'Code on one page only',
				body: 'Each page has its own header code injection in its settings. A script or style added there for a banner or embed affects only that page, which is why the menu can fail on the homepage and work elsewhere.',
			},
			{
				title: 'Too many items for the screen',
				body: 'A long navigation with several folders can make the open menu taller than a small phone, and the lower links can end up unreachable.',
			},
			{
				title: 'Anchor links do not close the menu',
				body: 'Links to sections on the same page scroll the content underneath, but the open mobile menu can stay in place over it, which looks like the menu is stuck.',
			},
		],
		steps: [
			'Copy your Custom CSS and Code Injection into a text file as a backup. Both live under Website Tools in the current editor; on older menus they are under Design > Custom CSS and Settings > Advanced > Code Injection.',
			'Remove the custom code temporarily and test the live site on a phone. If the burger now opens reliably, the cause is in that code.',
			'Open the settings of the page where the menu fails and look under Advanced for page header code injection. Remove anything there and retest that page.',
			'Restore your code in sections, testing after each, until the menu breaks again. That last block is your culprit.',
			'If an element is sitting over the burger, give the header’s burger a higher z-index in Custom CSS inside a @media (max-width: 767px) block, since 767px is where Squarespace 7.1 switches to the mobile layout.',
			'If the menu is too tall, reduce top-level items or merge folders, so the whole menu fits on a small phone.',
			'Test in both Safari on an iPhone and Chrome on Android, on the homepage and at least one inner page.',
		],
		verify: [
			'Below 767px on the live site, tap the burger once: the menu should open on the first tap and close on the first tap of the close icon.',
			'Tap every link in the mobile menu, including anchor links and folder items, and confirm each navigates and the menu gets out of the way.',
			'Repeat on each page that had the problem, not just the homepage.',
		],
		scanFlags: [
			'Overlapping or hidden elements at phone width, such as something covering the header, from the 390px screenshot and visual review.',
			'Menus that do not fit the screen and tap targets that are too cramped.',
			'JavaScript errors from scripts added through Code Injection.',
			'The free scan checks the homepage; a menu that fails only on other pages needs those pages in a paid report.',
		],
		faqs: [
			{
				q: 'Why does the menu work in the editor but not on my phone?',
				a: 'The editor’s mobile preview is not a real touch device, and some custom code behaves differently inside the editor. Always test the published site on an actual phone.',
			},
			{
				q: 'Can I change the width where Squarespace switches to the mobile menu?',
				a: 'Not in Squarespace 7.1; the mobile layout starts at 767px. Write your custom CSS media queries to match that width so your styles and the built-in switch agree.',
			},
			{
				q: 'Will removing custom code break my design?',
				a: 'Temporarily, yes. That is why the backup matters. You are only removing it to find the faulty part, and you can paste the rest back as soon as you know which rule is responsible.',
			},
		],
		sources: [
			{ label: 'Squarespace Forum: hamburger menu not working on homepage in mobile Chrome', url: 'https://forum.squarespace.com/topic/256141-hamburger-menu-not-working-on-homepage-on-mobile-chrome/' },
			{ label: 'Squarespace Forum: hamburger menu on mobile not clickable', url: 'https://forum.squarespace.com/topic/200292-hamburger-menu-on-mobile-not-clickable/' },
			{ label: 'Squarespace Forum: hamburger menu on mobile not working', url: 'https://forum.squarespace.com/topic/247222-hamburger-menu-on-mobile-not-working-very-urgent/' },
		],
		related: ['squarespace/mobile-layout-broken', 'squarespace/add-to-cart-button-missing'],
		updated: '2026-10-26',
	},
	{
		platform: 'squarespace',
		problem: 'form-submissions-not-received',
		query: 'squarespace form submissions not received',
		title: 'Squarespace Form Emails Not Arriving? Fix It',
		description:
			'Visitors see the thank-you message but the notification email never comes, or they get a storage error. Where Squarespace form submissions go and why.',
		h1: 'Squarespace form submissions not received by email',
		answer:
			'If a Squarespace form shows its success message but no email arrives, the submission was usually accepted and the problem is delivery: the notification went to spam, your email provider filtered it, or your address was put on Squarespace’s bounce list after earlier failures. Check spam, add form-submission@squarespace.info to your allowed senders, and look for the entry in the Contacts panel or your connected storage. If one address stopped receiving entirely, Squarespace Customer Care can check whether it is on the bounce list.',
		symptom:
			'A visitor fills in the contact form, presses Submit and sees the confirmation, but you never receive the email. Sometimes it is a single address that stopped working, often a custom-domain mailbox, while a Gmail address still receives. In other cases the visitor sees an error such as "Form not fully sent. Error communicating with storage services", which means Squarespace could not deliver it to a connected service.',
		causes: [
			{
				title: 'Your address is on Squarespace’s bounce list',
				body: 'If notifications to an address bounced in the past, Squarespace can stop sending to it. The form keeps working for visitors and you simply stop getting emails, with no warning in the editor.',
			},
			{
				title: 'Your mail provider filters the notification',
				body: 'Custom-domain mailboxes such as Google Workspace or Microsoft 365 may quarantine or reject mail sent on your behalf from Squarespace, especially when spam rules are strict.',
			},
			{
				title: 'A storage connection has broken',
				body: 'Forms can also send entries to Google Drive, Mailchimp or other connected services. When that connection expires, visitors see a "Form not fully sent" error and some storage options stop receiving entries.',
			},
			{
				title: 'The emails are in spam',
				body: 'Notifications come from form-submission@squarespace.info. Many inboxes file them as spam until you tell the mail program otherwise.',
			},
		],
		steps: [
			'Double-click the form block and open its Storage tab. Check the email address listed there is correct, and disconnect and reconnect any Google Drive or Mailchimp storage.',
			'Search spam and junk folders for messages from form-submission@squarespace.info, then add that address to your contacts or create a filter so future notifications reach the inbox.',
			'Open the Contacts panel and look at the Form Submitters list. Entries appear there only when the form has a required email field, but if they are there, the form is working and the issue is email delivery.',
			'Temporarily change the notification address to one on a different provider, for example a personal Gmail account, and submit a test. If that arrives, the original mailbox is filtering or rejecting the mail.',
			'If one address stopped receiving everything, contact Squarespace Customer Care and ask them to check whether it is on the bounce list and remove it.',
			'If visitors report an error message, compare its wording with Squarespace’s form troubleshooting guide, which matches each message to a fix.',
		],
		verify: [
			'Submit a test entry with a clear label such as "TEST desktop" from a computer and another from a phone, and confirm the success message appears for both.',
			'Find both entries in Contacts or your connected storage.',
			'Confirm both notification emails reach the inbox you rely on, not just spam.',
		],
		scanFlags: [
			'Whether submitting the form empty shows validation messages or fails silently.',
			'JavaScript errors or failed requests on the page that holds the form.',
			'It never sends real data through your form and cannot see your inbox, so whether notification emails arrive is something only a manual test can confirm.',
		],
		faqs: [
			{
				q: 'Are form entries lost if the email never arrives?',
				a: 'Not necessarily. Entries can also be stored in Contacts, Google Drive, Mailchimp or another connected service. Check those before assuming a message is gone.',
			},
			{
				q: 'Why does Gmail get the notifications but my business email does not?',
				a: 'Your business mail provider is probably filtering or rejecting them. Check its quarantine or admin spam settings and allow form-submission@squarespace.info.',
			},
			{
				q: 'What does "Error communicating with storage services" mean?',
				a: 'Squarespace could not reach one of the services connected in the form’s Storage tab. Reconnecting it usually fixes it; if not, Squarespace suggests removing and re-adding the form block.',
			},
		],
		sources: [
			{ label: 'Squarespace Help: troubleshooting form issues', url: 'https://support.squarespace.com/hc/en-us/articles/205813938-Troubleshooting-form-issues' },
			{ label: 'Squarespace Forum: forms no longer send to Gmail addresses', url: 'https://forum.squarespace.com/topic/232309-forms-no-longer-send-to-gmail-addresses/' },
			{ label: 'Squarespace Forum: form submission emails not being received', url: 'https://forum.squarespace.com/topic/155168-form-submission-emails-not-being-received/' },
		],
		related: ['squarespace/mobile-menu-not-working'],
		updated: '2026-10-26',
	},
	{
		platform: 'squarespace',
		problem: 'add-to-cart-button-missing',
		query: 'squarespace add to cart button missing',
		title: 'Squarespace Add to Cart Button Missing? Fix It',
		description:
			'The Add to cart button vanished from some products, disappears on mobile, or does nothing in a product block. Check custom CSS and product settings.',
		h1: 'Squarespace add to cart button missing or not showing',
		answer:
			'A missing Squarespace Add to cart button is most often hidden by Custom CSS, for example a display: none rule aimed at .sqs-add-to-cart-button-wrapper that was added for another purpose. If clearing custom CSS does not bring it back, the product itself is the cause: it is out of stock, or a variant has no price. Compare a product that shows the button with one that does not to find the difference.',
		symptom:
			'Some product pages show the price and description but no Add to cart button, while other products look normal. The button might also show on desktop and disappear on phones, or appear inside a product block on a regular page but do nothing when clicked. Squarespace never edits your Custom CSS by itself, so if the button vanished, something was added or changed.',
		causes: [
			{
				title: 'Custom CSS hides the button',
				body: 'A rule such as one setting the add to cart wrapper or the quantity input to display: none, often copied from a tutorial to make a catalogue-only page, can apply to every product rather than the one intended.',
			},
			{
				title: 'The product cannot be bought',
				body: 'Products that are out of stock, or variants missing a price, will not offer a working Add to cart. When one product is fine and another is not, product settings are a likely difference.',
			},
			{
				title: 'Custom code breaks at the mobile breakpoint',
				body: 'Code that adds a second button or restyles the first may only be written for desktop. Below 767px it can push the real button out of view or cover it.',
			},
		],
		steps: [
			'Copy the contents of Custom CSS (under Website Tools in the current editor, Design > Custom CSS on older menus) into a text file, then clear it and save.',
			'Reload a product page that was missing the button. If it appears, paste your CSS back in pieces until it disappears, and remove or narrow the rule responsible. Look for selectors such as .sqs-add-to-cart-button-wrapper or .product-quantity-input.',
			'If CSS is not the cause, open the product in the Commerce or Products panel and check stock levels and that every variant has a price.',
			'Open a product that shows the button and compare its settings, variants and product type with the broken one side by side.',
			'Check Code Injection for scripts that alter product pages, and test with them removed.',
			'After any change, view the product below 767px wide and on an actual phone, not just the desktop editor.',
		],
		verify: [
			'Visit each product on desktop and on a phone and confirm Add to cart is visible.',
			'Add one item and check the cart count in the header updates and the cart page lists it.',
			'Click through to checkout to confirm it opens, without completing payment unless you are testing with a real order.',
		],
		scanFlags: [
			'Whether an above-the-fold call to action is visible, and whether the primary button responds when clicked, on product pages included in a paid report.',
			'Layout differences between the desktop and 390px screenshots, such as an element hidden or covered on mobile.',
			'JavaScript errors from injected code.',
			'It cannot see your product inventory or pricing, so an out-of-stock product shows up only as a missing button to investigate.',
		],
		faqs: [
			{
				q: 'Did Squarespace remove my Add to cart button in an update?',
				a: 'Squarespace does not edit your Custom CSS. If a CSS rule is hiding the button, it was added by you or someone with access to the site, sometimes long before anyone noticed.',
			},
			{
				q: 'Why is the button missing on only two products?',
				a: 'A CSS rule may target those product pages specifically, or those products may be out of stock or have a variant without a price. Compare their settings with a product that works.',
			},
			{
				q: 'Why does the product block on my homepage not add anything?',
				a: 'Product blocks rely on the same product data and scripts as the product page. Check the product works on its own page first; if it does, look for custom code that only runs on the page holding the block.',
			},
		],
		sources: [
			{ label: 'Squarespace Forum: missing add to cart button', url: 'https://forum.squarespace.com/topic/258635-missing-add-to-cart-button/' },
			{ label: 'Squarespace Forum: add to cart buttons missing from product page', url: 'https://forum.squarespace.com/topic/225230-add-to-cart-buttons-missing-from-my-product-page/' },
		],
		related: ['squarespace/mobile-layout-broken', 'shopify/add-to-cart-button-not-working'],
		updated: '2026-10-26',
	},
	{
		platform: 'squarespace',
		problem: 'mobile-layout-broken',
		query: 'squarespace mobile layout messed up',
		title: 'Squarespace Mobile Layout Messed Up? Fix It',
		description:
			'Text and images overlap on phones, the page looks jumbled on Android but fine on iPhone, or it breaks at 767px. How to fix Fluid Engine mobile layouts.',
		h1: 'Squarespace mobile layout messed up or overlapping',
		answer:
			'A jumbled Squarespace mobile layout usually comes from Fluid Engine’s separate mobile grid: blocks placed tight together or on top of each other collide when text renders slightly larger on some phones. Open the page in the editor’s mobile view, separate overlapping blocks and give text boxes room to grow. If the layout also breaks in narrow desktop windows, line your custom CSS up with 767px, the fixed width where Squarespace 7.1 switches to its mobile layout.',
		symptom:
			'On a phone, headings run into images, text spills out of its box, and buttons sit on top of paragraphs. The same page can look correct on an iPhone and messy on an Android phone, or fine on phones but broken in a desktop browser window narrowed to around 767px. The desktop layout itself is usually unaffected.',
		causes: [
			{
				title: 'Fluid Engine mobile blocks overlap',
				body: 'Fluid Engine keeps a separate layout for mobile. If blocks are placed edge to edge or layered, any change in text height pushes one into the next, so a layout that fits on one phone overlaps on another.',
			},
			{
				title: 'Fonts render at different sizes on different devices',
				body: 'Android and iOS use different font rendering and sometimes different fallback fonts. A text block sized exactly for one device can overflow on another by a line or two, which is enough to collide with the block below.',
			},
			{
				title: 'Custom CSS targets the wrong breakpoint',
				body: 'Squarespace 7.1 switches to the mobile layout at 767px and that width cannot be changed. Media queries written for other widths leave a range of screen sizes styled by neither the desktop nor the mobile rules you intended.',
			},
		],
		steps: [
			'Edit the page and switch the editor to mobile view. Look for blocks that touch or overlap, and drag them apart so each has its own rows on the grid.',
			'Give text blocks extra rows of empty space below their content, so a line or two of growth on another device does not run into the next block.',
			'Avoid layering text over images in the mobile grid unless the text box is large enough for longer wrapping; otherwise place the text below the image.',
			'Review Custom CSS and change media queries to use 767px (max-width: 767px for mobile, min-width: 768px for desktop) so they match where Squarespace switches layout.',
			'Check the page in a desktop browser narrowed to just under and just over 767px to make sure neither layout breaks at the switch.',
			'Test on a real iPhone and a real Android phone, because the overlap often shows on only one of them.',
		],
		verify: [
			'At 360px, 390px, 414px and 767px wide, scroll each edited page and confirm no text overlaps another block and nothing is cut off.',
			'Swipe sideways on each page to confirm there is no horizontal scrolling at phone widths.',
			'Open the page on both an Android phone and an iPhone and compare them.',
		],
		scanFlags: [
			'Overlapping, cut-off or hidden elements in the phone-width screenshot, picked up by visual review.',
			'Horizontal overflow, text too small to read and tap targets too close together at 390px.',
			'Layout shift measured while the page loads.',
			'Screenshots come from a Chromium browser at fixed sizes, so a problem that appears only with one Android phone’s fonts may need checking on that device.',
		],
		faqs: [
			{
				q: 'Why does my site look different on Android and iPhone?',
				a: 'The two systems render fonts differently, so the same text takes slightly different space. In a tight Fluid Engine mobile layout that small difference is enough to make blocks overlap on one and not the other.',
			},
			{
				q: 'Do mobile edits change my desktop layout?',
				a: 'In Fluid Engine, moving blocks in mobile view only changes the mobile arrangement. Editing the content of a block, such as its text, changes it on both.',
			},
			{
				q: 'Why does my desktop browser show the mobile layout?',
				a: 'Squarespace 7.1 shows the mobile layout whenever the window is 767px wide or less, whatever the device. A narrow desktop window or split screen will trigger it.',
			},
		],
		sources: [
			{ label: 'Squarespace Forum: mobile view different on Apple and Android', url: 'https://forum.squarespace.com/topic/304326-mobile-view-of-one-page-is-different-in-apple-and-android-phones/' },
			{ label: 'Squarespace Forum: mobile site shows on narrow desktop at 767px', url: 'https://forum.squarespace.com/topic/260081-why-does-a-messed-up-version-of-my-mobile-site-show-on-a-narrow-desktop-browser-at-767px-wide/' },
		],
		related: ['squarespace/mobile-menu-not-working', 'shopify/mobile-site-moves-side-to-side'],
		updated: '2026-10-26',
	},
]
