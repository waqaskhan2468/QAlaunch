/**
 * OpenAI Measurement Pixel conversion events.
 *
 * The pixel itself only reports `page_viewed`. Anything OpenAI can optimise a
 * ChatGPT Ads campaign against — or that tells us a paid click did something —
 * has to be sent from the point in the UI where it happened.
 *
 * Every call here is a no-op unless the SDK loaded: outside production the
 * pixel is never rendered, and in production it can still be blocked by an ad
 * blocker. Analytics must never be able to break the funnel it is measuring,
 * so this swallows everything.
 */

/**
 * The standard events this site can actually produce, each paired with the
 * `type` its data shape requires. OpenAI rejects a mismatched type, and these
 * pairings are not guessable — they come from the supported-events reference:
 *
 *   page_viewed      contents
 *   lead_created     customer_action
 *   checkout_started contents
 *   order_created    contents
 */
const EVENT_TYPE = {
	lead_created: "customer_action",
	checkout_started: "contents",
	order_created: "contents",
	contents_viewed: "contents",
} as const

export type OpenAiEvent = keyof typeof EVENT_TYPE

type Oaiq = (command: string, ...args: unknown[]) => void

/**
 * Reports one conversion event.
 *
 * @param extra merged into the event data. `order_created` may carry `amount`,
 *   but only together with `currency` — OpenAI requires the pair.
 */
export function trackOpenAiEvent(
	event: OpenAiEvent,
	extra?: Record<string, unknown>,
): void {
	try {
		const oaiq = (window as unknown as { oaiq?: Oaiq }).oaiq
		if (typeof oaiq !== "function") return
		oaiq("measure", event, { type: EVENT_TYPE[event], ...extra })
	} catch {
		// An analytics failure is never worth surfacing to the person scanning.
	}
}
