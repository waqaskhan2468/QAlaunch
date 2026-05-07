export type PlanCTA = {
  label: string
  href: string
  variant: "primary" | "soft" | "outline" | "dark"
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
}

/**
 * Canonical pricing plans. Reused by the homepage preview, the full
 * pricing page, and the audit results page.
 */
export const plans: Plan[] = [
  {
    tier: "Basic",
    price: "9",
    priceSymbol: "$",
    pages: "1 page full audit",
    delivery: { icon: "bolt", label: "Instant PDF delivery" },
    features: [
      "Full 35-point audit",
      "Usability + UI + functionality",
      "Mobile responsiveness",
      "Performance + SEO checks",
      "Developer fix instructions",
      "PDF via email + download",
    ],
    cta: {
      label: "Start Free Audit First",
      href: "/#audit-input",
      variant: "soft",
    },
  },
  {
    tier: "Standard",
    price: "24",
    priceSymbol: "$",
    pages: "2–5 pages full audit",
    delivery: { icon: "bolt", label: "Instant PDF delivery" },
    popular: true,
    features: [
      "Everything in Basic",
      "Up to 5 pages tested",
      "Cross-page consistency check",
      "Navigation flow analysis",
      "Priority fix ranking",
      "PDF via email + download",
    ],
    cta: {
      label: "Start Free Audit",
      href: "/#audit-input",
      variant: "primary",
    },
  },
  {
    tier: "Premium",
    price: "59",
    priceSymbol: "$",
    pages: "6–10 pages full audit",
    delivery: { icon: "bolt", label: "Instant PDF delivery" },
    features: [
      "Everything in Standard",
      "Up to 10 pages tested",
      "Full eCommerce audit",
      "Checkout flow analysis",
      "Conversion rate insights",
      "Priority email support",
    ],
    cta: {
      label: "Start Free Audit",
      href: "/#audit-input",
      variant: "soft",
    },
  },
  {
    tier: "Enterprise",
    price: "Custom",
    pages: "11+ pages",
    delivery: { icon: "clipboard", label: "Quote in 24h" },
    features: [
      "Everything in Premium",
      "Full website audit",
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
