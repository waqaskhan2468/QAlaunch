/**
 * Reddit Pixel conversion events.
 *
 * The pixel itself only fires PageVisit. Anything Reddit can later optimise
 * against — or that tells us a paid click actually did something — has to be
 * reported from the point in the UI where it happened.
 *
 * Every call here is a no-op unless the pixel loaded: outside production it is
 * never rendered, and in production it can still be blocked by an ad blocker,
 * which a meaningful share of Reddit's audience runs. Analytics must never be
 * able to break the funnel it is measuring, so this swallows everything.
 */

/** Reddit's standard event names. Custom strings are allowed but unoptimisable. */
type RedditEvent = "Lead" | "SignUp" | "Purchase" | "ViewContent" | "Search"

type RedditPixel = (command: string, ...args: unknown[]) => void

export function trackRedditEvent(
  event: RedditEvent,
  metadata?: Record<string, unknown>,
): void {
  try {
    const rdt = (window as unknown as { rdt?: RedditPixel }).rdt
    if (typeof rdt !== "function") return
    rdt("track", event, metadata)
  } catch {
    // An analytics failure is never worth surfacing to the person scanning.
  }
}
