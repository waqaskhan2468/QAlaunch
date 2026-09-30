export type PlanCTA = {
  label: string
  href: string
  variant: "primary" | "soft" | "outline" | "dark"
}

/** Self-serve Paddle checkout tier slug (Basic / Standard / Premium). */
export type CheckoutPackageSlug = "basic" | "standard" | "premium"

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
 */
export const plans: Plan[] = [
  {
    tier: "Homepage",
    price: "9",
    priceSymbol: "$",
    pages: "Your homepage, tested in full",
    delivery: { icon: "bolt", label: "Instant PDF delivery" },
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
    price: "24",
    priceSymbol: "$",
    pages: "Up to 5 pages",
    delivery: { icon: "bolt", label: "Instant PDF delivery" },
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
    price: "59",
    priceSymbol: "$",
    pages: "Up to 10 pages",
    delivery: { icon: "bolt", label: "Instant PDF delivery" },
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
