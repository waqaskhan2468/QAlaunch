import type { PlatformSlug } from './types'

/**
 * Display data for each platform hub at /fix/<platform>. `landing` points to
 * the existing /for-* sales page where one exists, so every guide passes link
 * equity to a page that sells.
 */
export type PlatformInfo = {
	slug: PlatformSlug
	name: string
	/** One sentence for the hub page and the /fix index. */
	blurb: string
	landing?: string
	/** Existing blog posts that belong in this cluster. */
	posts?: { href: string; label: string }[]
}

export const PLATFORMS: Record<PlatformSlug, PlatformInfo> = {
	lovable: {
		slug: 'lovable',
		name: 'Lovable',
		blurb: 'Fixes for Lovable apps that work in the editor preview but break once real visitors arrive.',
		landing: '/for-lovable',
		posts: [{ href: '/blog/vibe-coding-website-bugs', label: '9 bugs every AI-built site ships with' }],
	},
	bolt: {
		slug: 'bolt',
		name: 'Bolt.new',
		blurb: 'Fixes for Bolt.new sites after deploy: blank pages, broken routes, forms and mobile layouts.',
		landing: '/for-bolt',
		posts: [{ href: '/blog/vibe-coding-website-bugs', label: '9 bugs every AI-built site ships with' }],
	},
	v0: {
		slug: 'v0',
		name: 'v0',
		blurb: 'Fixes for v0 projects deployed to Vercel that misbehave for visitors.',
		landing: '/for-v0',
	},
	replit: {
		slug: 'replit',
		name: 'Replit',
		blurb: 'Fixes for Replit apps that go offline, break on deploy or fail for visitors.',
		landing: '/for-replit',
	},
	base44: {
		slug: 'base44',
		name: 'Base44',
		blurb: 'Fixes for Base44 apps whose sign-up, forms or pages fail after publishing.',
		landing: '/for-base44',
		posts: [{ href: '/blog/test-base44-app-before-launch', label: 'the Base44 pre-launch checklist' }],
	},
	cursor: {
		slug: 'cursor',
		name: 'Cursor and Claude Code',
		blurb: 'Fixes for sites written with Cursor or Claude Code that pass on localhost and fail in production.',
		landing: '/for-claude',
	},
	bubble: {
		slug: 'bubble',
		name: 'Bubble',
		blurb: 'Fixes for Bubble apps with broken workflows, slow pages or mobile layout problems.',
	},
	framer: {
		slug: 'framer',
		name: 'Framer',
		blurb: 'Fixes for Framer sites with broken forms, layout breakpoints and indexing problems.',
	},
	wordpress: {
		slug: 'wordpress',
		name: 'WordPress',
		blurb: 'Fixes for WordPress sites that break after updates, plugins or theme changes.',
		landing: '/for-wordpress',
		posts: [
			{ href: '/blog/wordpress-broken-after-update', label: 'why WordPress breaks after updates' },
			{ href: '/blog/contact-form-not-working', label: 'why contact forms fail silently' },
		],
	},
	woocommerce: {
		slug: 'woocommerce',
		name: 'WooCommerce',
		blurb: 'Fixes for WooCommerce stores whose cart, checkout or product pages fail customers.',
		landing: '/for-wordpress',
	},
	shopify: {
		slug: 'shopify',
		name: 'Shopify',
		blurb: 'Fixes for Shopify stores losing sales to broken buttons, apps and mobile checkout bugs.',
		landing: '/for-shopify',
		posts: [{ href: '/blog/shopify-mobile-checkout-bugs', label: 'Shopify mobile checkout bugs' }],
	},
	wix: {
		slug: 'wix',
		name: 'Wix',
		blurb: 'Fixes for Wix sites with forms, mobile layout and indexing problems.',
	},
	webflow: {
		slug: 'webflow',
		name: 'Webflow',
		blurb: 'Fixes for Webflow sites with broken forms, interactions and responsive layouts.',
	},
	squarespace: {
		slug: 'squarespace',
		name: 'Squarespace',
		blurb: 'Fixes for Squarespace sites with forms, mobile and checkout problems.',
	},
	'any-website': {
		slug: 'any-website',
		name: 'Any website',
		blurb: 'Fixes that apply whatever your site is built with.',
		posts: [
			{ href: '/blog/website-looks-fine-on-desktop-broken-on-mobile', label: 'why sites break on mobile' },
			{ href: '/blog/contact-form-not-working', label: 'why contact forms fail silently' },
		],
	},
}
