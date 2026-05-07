import Image from "next/image"
import Link from "next/link"

const productLinks = [
  { href: "/result", label: "Free Website Audit" },
  { href: "/pricing", label: "Pricing" },
  { href: "/#sample-report", label: "Sample Report" },
]

const companyLinks = [
  { href: "/#about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/#blog", label: "Blog" },
]

const legalLinks = [
  { href: "/#privacy", label: "Privacy Policy" },
  { href: "/#terms", label: "Terms of Service" },
]

const socialLinks = [
  { href: "#", label: "Twitter" },
  { href: "#", label: "LinkedIn" },
  { href: "#", label: "Product Hunt" },
]

/**
 * Site-wide footer. Reused across every page so branding, navigation,
 * and legal links stay consistent.
 */
export function SiteFooter() {
  return (
    <footer className="bg-slate-deep px-5 py-14 text-white md:px-12 md:pt-14">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-10 pb-10 md:grid-cols-[2fr_1fr_1fr_1fr] md:gap-11">
          <div>
            <div className="flex items-center gap-2.5">
              <Image
                src="/QAlaunch_Favicon.svg"
                alt="QAlaunch logo"
                width={28}
                height={28}
                className="size-7"
              />
              <span className="font-heading text-[18px] font-black tracking-tight text-white">
                QAlaunch
              </span>
            </div>
            <p className="mt-4 max-w-sm text-[13.5px] leading-relaxed text-white/45">
              Expert website auditing backed by 9 years of professional QA
              experience. Find what&apos;s broken before your users do.
            </p>
          </div>
          <FooterColumn title="Product" links={productLinks} />
          <FooterColumn title="Company" links={companyLinks} />
          <FooterColumn title="Legal" links={legalLinks} />
        </div>
        <div className="flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 md:flex-row">
          <span className="text-[13px] text-white/35">
            © {new Date().getFullYear()} QAlaunch — getqalaunch.com · All
            rights reserved.
          </span>
          <div className="flex gap-5">
            {socialLinks.map((s) => (
              <Link
                key={s.label}
                href={s.href}
                className="text-[13px] text-white/35 transition-colors hover:text-white"
              >
                {s.label}
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
