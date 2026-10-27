export type PlanCTA = {
  label: string
  href: string
  variant: "primary" | "soft" | "outline" | "dark"
}

/** Self-serve Paddle checkout tier slug (Basic / Standard / Premium). */
export type CheckoutPackageSlug = "basic" | "standard" | "premium"

/**
 * List price in USD for each self-serve tier. The single source for every
 * place that states or counts a price (pricing cards, emails, admin revenue).
 * The amount actually charged is set by the Paddle price behind
 * NEXT_PUBLIC_PADDLE_*_PRICE_ID, so these must match the Paddle catalog.
 */
export const PACKAGE_PRICE_USD: Record<CheckoutPackageSlug, number> = {
  basic: 19,
  standard: 49,
  premium: 99,
}

/** "$19" — a tier's list price as shown to people. */
export function formatPackagePrice(slug: CheckoutPackageSlug): string {
  return `$${PACKAGE_PRICE_USD[slug]}`
}

export type Plan = {
  tier: string
  price: string
  priceSymbol?: string
  pages: string
  delivery: {
    icon: "bolt" | "clipboard"
    label: string
  }
  popular?: boolean
  features: string[]
  cta: PlanCTA
  checkoutPackage?: CheckoutPackageSlug
}

/**
 * Canonical pricing plans. Reused by the homepage preview, the full
 * pricing page, and the audit results page.
 *
 * NAMING RULE: a tier is named for the SITE it covers, never for a page count.
 *
 * The tiers used to read "Basic / 1 page full audit", and three separate people
 * in one Facebook thread objected to "charging per page" — including one who
 * asked what it would cost for a site with thousands of pages. None of them were
 * objecting to $9. They were objecting to the unit: "1 page" invites you to
 * multiply by your own page count and arrive at a frightening number, even
 * though every tier here is a flat one-time price.
 *
 * "Homepage" cannot be multiplied. It also sets the right expectation up front —
 * the one customer who did pay wrote afterwards that he "was expecting a full
 * website report" and had not noticed the other plans.
 *
 * SUBTITLE RULE: `pages` names the actual pages a tier covers. People have
 * never counted their own pages, so "Up to 5 pages" alone did not let them
 * recognise their site; "home, about, services, contact, one more" does.
 */
export const plans: Plan[] = [
  {
    tier: "Homepage",
    price: String(PACKAGE_PRICE_USD.basic),
    priceSymbol: "$",
    pages: "Just your homepage, tested in full",
    delivery: { icon: "bolt", label: "PDF by email in ~5 minutes" },
    features: [
      "Full 35-point audit",
      "Usability + UI + functionality",
      "Mobile responsiveness",
      "Performance + SEO checks",
      "Developer fix instructions",
      "PDF via email + download",
    ],
    checkoutPackage: "basic",
    cta: {
      label: "Test my homepage",
      href: "/checkout?package=basic",
      variant: "soft",
    },
  },
  {
    tier: "Small site",
    price: String(PACKAGE_PRICE_USD.standard),
    priceSymbol: "$",
    pages: "Up to 5 pages — home, about, services, contact, one more",
    delivery: { icon: "bolt", label: "PDF by email in ~5 minutes" },
    popular: true,
    features: [
      "Everything in Homepage",
      "Every page checked the same way",
      "Cross-page consistency check",
      "Navigation flow analysis",
      "Priority fix ranking",
      "PDF via email + download",
    ],
    checkoutPackage: "standard",
    cta: {
      label: "Test up to 5 pages",
      href: "/checkout?package=standard",
      variant: "primary",
    },
  },
  {
    tier: "Whole site",
    price: String(PACKAGE_PRICE_USD.premium),
    priceSymbol: "$",
    pages: "Up to 10 pages — adds your blog, landing pages or product pages",
    delivery: { icon: "bolt", label: "PDF by email in ~5 minutes" },
    features: [
      "Everything in Small site",
      "Twice the coverage",
      "Full eCommerce audit",
      "Checkout flow analysis",
      "Conversion rate insights",
      "Priority email support",
    ],
    checkoutPackage: "premium",
    cta: {
      label: "Test up to 10 pages",
      href: "/checkout?package=premium",
      variant: "soft",
    },
  },
  {
    tier: "Larger site",
    price: "Custom",
    pages: "More than 10 pages",
    delivery: { icon: "clipboard", label: "Quote in 24h" },
    features: [
      "Everything in Whole site",
      "Every page on the site",
      "Custom QA checklist",
      "Video walkthrough",
      "Dedicated QA engineer",
      "Re-test after fixes",
    ],
    cta: {
      label: "Request Quote",
      href: "/contact",
      variant: "dark",
    },
  },
]

export function planForCheckoutPackage(
  slug: string,
): (Plan & { checkoutPackage: CheckoutPackageSlug }) | undefined {
  const normalized = slug.toLowerCase()
  return plans.find(
    (p): p is Plan & { checkoutPackage: CheckoutPackageSlug } =>
      p.checkoutPackage === normalized,
  )
}
