import type { CheckoutPackageSlug } from "@/components/pricing/pricing-plans"

/**
 * Paddle.js runs in the browser — only `NEXT_PUBLIC_*` env vars are available.
 * Price IDs are safe to expose (they identify catalog prices, not secret keys).
 */
export function paddleClientToken(): string | undefined {
  return process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN
}

export function paddlePriceIdForPackage(
  pkg: CheckoutPackageSlug,
): string | undefined {
  switch (pkg) {
    case "basic":
      return process.env.NEXT_PUBLIC_PADDLE_BASIC_PRICE_ID
    case "standard":
      return process.env.NEXT_PUBLIC_PADDLE_STANDARD_PRICE_ID
    case "premium":
      return process.env.NEXT_PUBLIC_PADDLE_PREMIUM_PRICE_ID
    default:
      return undefined
  }
}
