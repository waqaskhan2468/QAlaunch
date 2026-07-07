import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteNav } from '@/components/site/site-nav'
import { SiteFooter } from '@/components/site/site-footer'
import { Flag } from '@/components/home/flag'

export const metadata: Metadata = {
  title: 'QAlaunch Blog — Real Website Bugs, Found by Testing',
  description:
    'Notes from auditing real websites built with AI tools, Shopify, WordPress, and everything else — the bugs we find most often, and how to check for them yourself.',
  openGraph: {
    title: 'QAlaunch Blog — Real Website Bugs, Found by Testing',
    description:
      'Notes from auditing real websites — the frontend bugs we find most often, and how to check for them yourself.',
    url: 'https://getqalaunch.com/blog',
  },
}

const POSTS = [
  {
    title: 'Why Your Website Looks Fine on Desktop but Broken on Mobile',
    description:
      'The six most common reasons websites break at phone widths, why owners never notice, and how to check your own site the way a QA engineer would.',
    url: '/blog/website-looks-fine-on-desktop-broken-on-mobile',
    date: '2026-07-07',
  },
  {
    title: 'Contact Form Not Working? Why Forms Fail Silently — and How to Test Yours',
    description:
      'The five ways contact forms fail without showing an error, why they pass the owner’s test and fail for real visitors, and the 5-minute test that proves yours works.',
    url: '/blog/contact-form-not-working',
    date: '2026-07-07',
  },
  {
    title: 'Vibe Coding Website Bugs: The 9 Problems Every AI-Built Site Ships With',
    description:
      'The frontend bugs almost every vibe-coded website ships with, and how to check for each one before your users find them.',
    url: '/blog/vibe-coding-website-bugs',
    date: '2026-07-07',
  },
]

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default function BlogIndexPage() {
  return (
    <>
      <SiteNav />
      <main className="bg-white pt-16">
        {/* Hero */}
        <section className="relative overflow-hidden bg-slate-deep px-5 py-20 text-center sm:px-8 md:px-12 md:py-24">
          <div className="qa-hero-grid pointer-events-none absolute inset-0" />
          <div className="qa-orb-float pointer-events-none absolute -left-40 -top-40 size-[520px] rounded-full bg-[radial-gradient(circle,rgba(24,71,168,0.45)_0%,transparent_65%)]" />
          <div className="qa-orb-float-alt pointer-events-none absolute -bottom-48 -right-32 size-[460px] rounded-full bg-[radial-gradient(circle,rgba(34,197,94,0.18)_0%,transparent_60%)]" />

          <div className="relative z-10 mx-auto max-w-3xl">
            <div className="mb-6 flex justify-center">
              <Flag>QAlaunch Blog</Flag>
            </div>
            <h1 className="font-heading text-[clamp(2.25rem,5.2vw,3.5rem)] font-black leading-[1.05] tracking-tight text-balance text-white">
              Real bugs, found by testing real websites.
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-white/65 sm:text-lg">
              Notes from auditing websites built with AI tools, Shopify, WordPress, and everything else.
            </p>
          </div>
        </section>

        {/* Post list */}
        <section className="px-5 py-20 md:px-12 md:py-24">
          <div className="mx-auto max-w-4xl">
            <div className="grid gap-6 md:grid-cols-2">
              {POSTS.map((post) => (
                <Link
                  key={post.url}
                  href={post.url}
                  className="group flex flex-col rounded-none border-2 border-slate-deep bg-white p-7 transition-colors hover:border-accent-bright"
                >
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-ink">
                    {formatDate(post.date)}
                  </span>
                  <h2 className="mt-3 font-heading text-xl font-extrabold leading-snug text-ink group-hover:text-accent-emerald">
                    {post.title}
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-body">{post.description}</p>
                  <span className="mt-5 inline-flex items-center gap-1 text-sm font-bold text-accent-emerald">
                    Read the post →
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
