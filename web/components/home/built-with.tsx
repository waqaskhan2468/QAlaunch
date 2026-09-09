import Link from 'next/link'

import { SectionHeader } from '@/components/site/section-header'

/**
 * Platform + guide index on the homepage.
 *
 * Doubles as internal linking: the homepage is the site's strongest page and
 * previously linked to no content at all, so every landing page and guide had
 * to rank on its own. Anchors are the phrases each destination targets.
 */
const PLATFORMS = [
	{ href: '/for-lovable', label: 'Lovable', anchor: 'Test a Lovable site' },
	{ href: '/for-bolt', label: 'Bolt.new', anchor: 'Test a Bolt.new site' },
	{ href: '/for-base44', label: 'Base44', anchor: 'Test a Base44 app' },
	{ href: '/for-replit', label: 'Replit', anchor: 'Test a Replit app' },
	{ href: '/for-v0', label: 'v0', anchor: 'Test a v0 app' },
	{ href: '/for-claude', label: 'Claude', anchor: 'Test a Claude-built site' },
	{ href: '/for-shopify', label: 'Shopify', anchor: 'Check a Shopify store' },
	{ href: '/for-wordpress', label: 'WordPress', anchor: 'Check a WordPress site' },
]

const GUIDES = [
	{
		href: '/blog/test-base44-app-before-launch',
		title: 'How to test a Base44 app before launch',
		blurb: 'The 6-step check that catches what the editor preview hides.',
	},
	{
		href: '/blog/vibe-coding-website-bugs',
		title: '9 bugs every AI-built website ships with',
		blurb: 'The frontend problems Lovable, Bolt, Replit and v0 leave behind.',
	},
	{
		href: '/blog/website-looks-fine-on-desktop-broken-on-mobile',
		title: 'Site looks fine on desktop but broken on mobile?',
		blurb: 'Why owners never see it, and the 15-minute check that finds it.',
	},
	{
		href: '/blog/contact-form-not-working',
		title: 'Contact form not working?',
		blurb: 'Most broken forms still show “message sent”. Test yours properly.',
	},
]

export function BuiltWith() {
	return (
		<section className="bg-surface-soft px-5 py-20 md:px-12 md:py-24">
			<div className="mx-auto max-w-6xl">
				<SectionHeader
					eyebrow="Built with AI?"
					title="However your site was built, we test what visitors actually see"
					description="QAlaunch runs on any public website — AI builders, Shopify, WordPress, or hand-written code. Start with the guide for your platform."
				/>

				<div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
					{PLATFORMS.map((p) => (
						<Link
							key={p.href}
							href={p.href}
							className="group rounded-none border-2 border-slate-deep bg-white p-5 transition-colors hover:border-accent-bright">
							<div className="font-heading text-lg font-extrabold text-ink">
								{p.label}
							</div>
							<div className="mt-1 text-[13px] font-semibold text-accent-emerald">
								{p.anchor} →
							</div>
						</Link>
					))}
				</div>

				<div className="mt-10 grid gap-3 md:grid-cols-2">
					{GUIDES.map((g) => (
						<Link
							key={g.href}
							href={g.href}
							className="rounded-none border-2 border-slate-deep bg-white p-5 transition-colors hover:border-accent-bright">
							<div className="font-heading text-[15px] font-extrabold leading-snug text-ink">
								{g.title}
							</div>
							<p className="mt-1.5 text-[13px] leading-relaxed text-body">
								{g.blurb}
							</p>
						</Link>
					))}
				</div>

				<div className="mt-6">
					<Link
						href="/blog"
						className="text-[13.5px] font-bold text-accent-emerald hover:underline">
						Read all QA guides →
					</Link>
				</div>
			</div>
		</section>
	)
}
