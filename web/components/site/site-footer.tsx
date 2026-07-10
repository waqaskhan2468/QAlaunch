import Image from "next/image"
import Link from "next/link"

const productLinks = [
  { href: "/result", label: "Free Website Audit" },
  { href: "/pricing", label: "Pricing" },
  { href: "/#sample-report", label: "Sample Report" },
]

const companyLinks = [
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/blog", label: "Blog" },
]

const legalLinks = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
  { href: "/refund", label: "Refund Policy" },
]

const platformLinks = [
  { href: "/for-lovable", label: "For Lovable" },
  { href: "/for-bolt", label: "For Bolt" },
  { href: "/for-shopify", label: "For Shopify" },
  { href: "/for-wordpress", label: "For WordPress" },
  { href: "/blog/test-base44-app-before-launch", label: "Base44 App Testing" },
  { href: "/blog/vibe-coding-website-bugs", label: "Vibe Coding Bugs" },
]

const socialLinks = [
  {
    href: "https://x.com/QAlaunchHQ",
    label: "X (Twitter)",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" aria-hidden="true">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    href: "https://www.linkedin.com/company/qalaunch",
    label: "LinkedIn",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" aria-hidden="true">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
  },
]

/**
 * Site-wide footer. Reused across every page so branding, navigation,
 * and legal links stay consistent.
 */
export function SiteFooter() {
  return (
    <footer className="bg-slate-deep px-5 py-14 text-white md:px-12 md:pt-14">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-10 pb-10 md:grid-cols-[2fr_1fr_1fr_1fr_1fr] md:gap-11">
          <div>
            <div className="flex items-center">
              <Image
                src="/brand/qalaunch-logo-dark-bg.svg"
                alt="QAlaunch"
                width={1219}
                height={340}
                className="h-8 w-auto"
              />
            </div>
            <p className="mt-4 max-w-sm text-[13.5px] leading-relaxed text-white/45">
              Expert website auditing backed by 9 years of professional QA
              experience. Find what&apos;s broken before your users do.
            </p>
            <a
              href="mailto:contact@getqalaunch.com"
              className="mt-4 inline-block text-[13.5px] font-medium text-white/60 transition-colors hover:text-white"
            >
              contact@getqalaunch.com
            </a>
          </div>
          <FooterColumn title="Product" links={productLinks} />
          <FooterColumn title="Platforms" links={platformLinks} />
          <FooterColumn title="Company" links={companyLinks} />
          <FooterColumn title="Legal" links={legalLinks} />
        </div>
        <div className="flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 md:flex-row">
          <span className="text-[13px] text-white/35">
            © {new Date().getFullYear()} QAlaunch — getqalaunch.com · All
            rights reserved.
          </span>
          <div className="flex gap-4">
            {socialLinks.map((s) => (
              <Link
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.label}
                className="text-white/35 transition-colors hover:text-white"
              >
                {s.icon}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}

function FooterColumn({
  title,
  links,
}: {
  title: string
  links: { href: string; label: string }[]
}) {
  return (
    <div>
      <h4 className="mb-3.5 text-xs font-bold uppercase tracking-[1.5px] text-white">
        {title}
      </h4>
      <ul className="flex flex-col gap-2.5">
        {links.map((l) => (
          <li key={l.label}>
            <Link
              href={l.href}
              className="text-[13.5px] text-white/45 transition-colors hover:text-white"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
