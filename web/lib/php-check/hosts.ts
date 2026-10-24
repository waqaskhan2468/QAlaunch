/**
 * Per-host PHP patch status.
 *
 * "Did my host patch this" is the question people are actually asking, and the
 * search results for it are mostly Reddit threads — because Reddit is the only
 * place the answer stays current. Three of the better competitor articles each
 * contain a "what hosts are saying" section written as static prose, which
 * goes stale the week it is published.
 *
 * These pages make dated claims about named companies' security posture, which
 * is a more serious thing to get wrong than a version number. So the data
 * model is built so an unverified claim cannot be expressed:
 *
 * - `status` can only be set alongside a `source` on the HOST'S OWN domain.
 * - `quote` must be copied verbatim from that page.
 * - A host with no public statement is `not_found`, which is a real, publishable
 *   answer: "no public statement found as of <date>". It is never rounded up to
 *   "probably patched".
 * - A Reddit thread, a news article or another blog is not verification. Those
 *   belong in `notes`, never in `status`.
 */

export type HostStatus =
	/** The host publicly states it has patched or updated PHP for this. */
	| "published_patched"
	/** The host published something but does not clearly claim completion. */
	| "published_acknowledged"
	/** The host says the customer must act — e.g. change PHP version themselves. */
	| "published_action_required"
	/** Searched, nothing public found. An honest answer, not a gap. */
	| "not_found"

export type HostRecord = {
	/** URL segment, e.g. "wp-engine". */
	slug: string
	/** Display name exactly as the company writes it. */
	name: string
	status: HostStatus
	/**
	 * The host's OWN page. Required for any status other than not_found —
	 * enforced by a test, because this is the field that makes the claim
	 * checkable by the reader.
	 */
	source: string | null
	/** Date shown ON that page. Null when the page carries no visible date. */
	sourceDate: string | null
	/** Verbatim, under ~25 words. Null only when status is not_found. */
	quote: string | null
	/** What the host tells customers to do, in our words. */
	customerAction: string | null
	/** Caveats worth stating — scope limits, third-party-only evidence, etc. */
	notes: string | null
	/**
	 * Strings this host's own response headers contain, so the checker can link
	 * a detected platform straight to its page. Matched case-insensitively.
	 */
	headerSignatures: readonly string[]
}

/** When this table was last gone through end to end. */
export const HOSTS_REVIEWED = "2026-10-24"

export const HOSTS: readonly HostRecord[] = [
	{
		slug: "siteground",
		name: "SiteGround",
		status: "published_patched",
		source: "https://www.siteground.com/blog/critical-php-vulnerabilities-october-2026",
		sourceDate: "2026-10-21",
		quote:
			"Once PHP released the fixes on 21 October, we applied them across all SiteGround servers.",
		customerAction:
			"Nothing, if your site is on SiteGround. If you host elsewhere, they say to update PHP to a fixed version now.",
		notes:
			"Names both CVEs and the 9.2 severity rating, and says protections were in place before the official release. Page shows a later update stamped 22 October.",
		headerSignatures: ["siteground", "sg_optimizer"],
	},
	{
		slug: "hostinger",
		name: "Hostinger",
		status: "published_patched",
		source: "https://www.hostinger.com/blog/protecting-php2shell/",
		sourceDate: "2026-10-21",
		quote:
			"PHP's fix is now installed on all Hostinger hosting servers except VPS, which customers manage themselves.",
		customerAction:
			"Nothing on any plan except VPS. On VPS you manage PHP yourself, so they say to update it and restart.",
		notes:
			"The only host to publish a completion timestamp — 22 October, 06:44 UTC. They warn the version number may not change and say to check the PHP build date is 21 October 2026 or later instead.",
		headerSignatures: ["hostinger", "hcdn"],
	},
	{
		slug: "bluehost",
		name: "Bluehost",
		status: "published_acknowledged",
		source: "https://www.bluehost.com/status/announcement/271",
		sourceDate: "2026-10-21",
		quote:
			"Our teams continue to work on deploying patched PHP builds across our remaining hosting infrastructure.",
		customerAction:
			"They say no action is needed on managed hosting. On VPS and dedicated servers they ask you to run a package update from your control panel.",
		notes:
			"Bluehost says most of its platforms are patched and work continues on the rest. It has not said the rollout is finished, so this page does not say so either.",
		headerSignatures: ["bluehost"],
	},
	{
		slug: "godaddy",
		name: "GoDaddy",
		status: "published_patched",
		source:
			"https://www.godaddy.com/resources/news/important-php-security-update-what-website-owners-need-to-do",
		sourceDate: null,
		quote:
			"Web Hosting: We have patched all PHP versions on Web Hosting. You don't need to take any action.",
		customerAction:
			"Nothing on Web Hosting, Managed WordPress or Windows Hosting. On VPS you manage the server software, so they say to update PHP yourself.",
		notes:
			"The page carries no publication date, only dated update headers — the most recent is 23 October. GoDaddy patched each product line separately. On Web Hosting the version number does not change, so they say to check the build date.",
		headerSignatures: ["godaddy"],
	},
	{
		slug: "wp-engine",
		name: "WP Engine",
		status: "published_patched",
		source: "https://wpengine.com/blog/php-vulnerability-update/",
		sourceDate: "2026-10-22",
		quote: "All customer sites are running fully patched versions of PHP.",
		customerAction: "Nothing. They state customers do not need to take any action.",
		notes:
			"Unusually candid: WP Engine says it would not claim customers were protected until the official patches were fully applied, and apologises for gaps in its updates. Also covers the Flywheel platform.",
		headerSignatures: ["wp engine", "wpengine"],
	},
	{
		slug: "kinsta",
		name: "Kinsta",
		status: "published_patched",
		source: "https://kinsta.com/blog/php2shell-kinsta-wordpress/",
		sourceDate: "2026-10-23",
		quote:
			"Our engineering and security teams deployed the necessary PHP security updates across our hosting platform, including live and staging environments.",
		customerAction:
			"Nothing. Kinsta says customers do not need to install patches or change anything.",
		notes:
			"Kinsta marked the incident resolved on 22 October at 08:26 UTC. Covers PHP 7.4 through 8.5.",
		headerSignatures: ["kinsta"],
	},
	{
		slug: "dreamhost",
		name: "DreamHost",
		status: "published_patched",
		source:
			"https://www.dreamhoststatus.com/pages/incident/575f0f606826303142000510/6ad8c218a7031204d4ca2981",
		sourceDate: "2026-10-23",
		quote:
			"PHP's security fix is now installed across all DreamHost servers, including Shared, Dedicated, VPS, and DreamPress.",
		customerAction: "Nothing. They state no intervention is needed on your end.",
		notes:
			"DreamHost's page does not name the CVE identifiers — it refers only to the PHP remote code execution vulnerability. One of the few hosts to patch VPS on the customer's behalf.",
		headerSignatures: ["dreamhost"],
	},
	{
		slug: "hostgator",
		name: "HostGator",
		status: "published_acknowledged",
		source: "https://www.hostgator.com/status/announcement/277",
		sourceDate: "2026-10-21",
		quote:
			"Our teams continue to work on deploying patched PHP builds across our remaining hosting infrastructure.",
		customerAction:
			"They say no action is needed on managed hosting. On VPS and dedicated servers they ask you to run a package update from your control panel.",
		notes:
			"The strongest claim HostGator makes is that most servers are patched and the rest are in progress. Completion is never stated. HostGator and Bluehost publish near-identical text.",
		headerSignatures: ["hostgator"],
	},
	{
		slug: "namecheap",
		name: "Namecheap",
		status: "published_patched",
		source:
			"https://www.namecheap.com/status-updates/ongoing-php-security-vulnerability-affecting-hosting-services-october-21-2026/",
		sourceDate: "2026-10-21",
		quote:
			"All PHP versions offered on our Shared Hosting servers are patched against these vulnerabilities.",
		customerAction:
			"Nothing on Shared Hosting. If you run a VPS or dedicated server they say to update PHP yourself now.",
		notes:
			"This claim covers Shared Hosting only — Namecheap does not say it patched VPS or dedicated servers. Older PHP versions were patched without the version number changing.",
		headerSignatures: ["namecheap"],
	},
	{
		slug: "cloudways",
		name: "Cloudways",
		status: "published_patched",
		source: "https://status.cloudways.com/incidents/xxjt802wwhpk",
		sourceDate: "2026-10-22",
		quote:
			"The PHP security patch rollout is complete, and all active servers have been successfully updated.",
		customerAction: "Nothing. Cloudways states no action is required from customers.",
		notes:
			"Covers all Cloudways-supported PHP versions from 5.6 upward. A separate incident on their status page tracks post-patch regressions.",
		headerSignatures: ["cloudways"],
	},
	{
		slug: "a2-hosting",
		name: "A2 Hosting (now Hosting.com)",
		status: "published_patched",
		source: "https://hosting.com/blog/protecting-against-php2shell-vulnerabilities/",
		sourceDate: "2026-10-21",
		quote: "With help from our vendors, every server we manage was updated.",
		customerAction:
			"Nothing on a managed plan. On unmanaged plans with root access they say you must apply the update yourself, because they cannot do it for you.",
		notes:
			"A2 Hosting rebranded to Hosting.com, and a2hosting.com now redirects there — this statement is published under the Hosting.com name. Their status page separately confirms the update completed on 22 October.",
		headerSignatures: ["a2 hosting", "a2hosting"],
	},
	{
		slug: "inmotion-hosting",
		name: "InMotion Hosting",
		status: "published_acknowledged",
		source:
			"https://status.inmotionhosting.com/incidents/5b3dee2d-6b8e-4a58-88e4-812ef43ef43a",
		sourceDate: "2026-10-22",
		quote: "VPS: In Progress. Security patches are still being deployed across the VPS fleet.",
		customerAction:
			"Nothing on shared or dedicated hosting. InMotion also disabled a PHP upload-progress setting across the platform, which may affect custom sites that rely on it.",
		notes:
			"Shared and dedicated hosting are both stated complete and the CVEs are named. VPS was still in progress at the last update, so this page does not report InMotion as finished. They also warn that patched shared hosting keeps its old version number, and that scanners checking only version numbers may wrongly flag those accounts.",
		headerSignatures: ["inmotion"],
	},
	{
		slug: "wordpress-vip",
		name: "WordPress VIP",
		status: "published_patched",
		source:
			"https://customerhub.wpvip.com/lobby/2026/10/21/upcoming-php-security-release-no-action-required/",
		sourceDate: "2026-10-21",
		quote: "Your sites are already protected against the recently disclosed PHP security issues.",
		customerAction: "Nothing. They state no action is required on your part.",
		notes:
			"The page reads as a pre-release notice with the protection claim added afterwards, so the 21 October date does not pin when that claim was made. Automattic published the same claim on its own site the same day, covering WordPress.com, WordPress VIP, WP Cloud and Pressable.",
		headerSignatures: ["wordpress vip", "wpvip"],
	},
	{
		slug: "pressable",
		name: "Pressable",
		status: "published_patched",
		source:
			"https://pressable.com/blog/your-pressable-sites-are-already-protected-from-the-recent-critical-php-security-update/",
		sourceDate: "2026-10-21",
		quote:
			"That covers every site on Pressable and every PHP version we offer, including Production, Staging, and Sandbox sites.",
		customerAction:
			"Nothing. Pressable explicitly says not to update PHP or change any settings.",
		notes:
			"Pressable tells customers to ignore the PHP version number shown in their dashboard or in Site Health, because the patch does not change it.",
		headerSignatures: ["pressable"],
	},
	{
		slug: "flywheel",
		name: "Flywheel",
		status: "published_patched",
		source: "https://status.getflywheel.com/2026/10/21/php-security-update/",
		sourceDate: "2026-10-21",
		quote:
			"WP Engine has finished the deployment of security patches for two critical PHP vulnerabilities on the Flywheel platform.",
		customerAction: "Nothing. They state the patch has been applied and no action is needed.",
		notes:
			"Flywheel is operated by WP Engine and the claim is made in WP Engine's name. The page does not name the CVE identifiers, referring only to two critical PHP vulnerabilities.",
		headerSignatures: ["flywheel"],
	},
	{
		slug: "ionos",
		name: "IONOS",
		status: "published_patched",
		source:
			"https://www.ionos.com/newsroom/news/php-vulnerabilities-websites-hosted-by-ionos-are-protected/",
		sourceDate: null,
		quote:
			"IONOS has already applied the official update on all platforms the company operates itself.",
		customerAction:
			"Nothing on IONOS-operated platforms. If you run PHP yourself on a VPS or dedicated server they say to install the update right away.",
		notes:
			"No publication date appears anywhere on this page. The claim covers Web Hosting, Managed WordPress, MyWebsite 8, Managed Nextcloud and HiDrive Next — note the wording covers platforms IONOS operates itself, which excludes customer-run servers.",
		headerSignatures: ["ionos", "1and1"],
	},
	{
		slug: "liquid-web",
		name: "Liquid Web",
		status: "published_acknowledged",
		source: "https://status.liquidweb.com/incidents/6bfpxwg75xgj",
		sourceDate: "2026-10-24",
		quote: "Patch deployment continues across the affected hosting environments.",
		customerAction:
			"Liquid Web asks customers to check their own PHP version and, if it is not yet patched, to run a package update from their control panel.",
		notes:
			"This incident was still open on 24 October, three days after the fix shipped, and no update has claimed completion. Liquid Web and Nexcess are sibling brands publishing one shared disclosure with the same incident identifier, so treat the two rows as a single source.",
		headerSignatures: ["liquid web", "liquidweb"],
	},
	{
		slug: "nexcess",
		name: "Nexcess",
		status: "published_acknowledged",
		source: "https://status.nexcess.net/",
		sourceDate: "2026-10-24",
		quote: "Patch deployment continues across the affected hosting environments.",
		customerAction:
			"Nexcess asks customers to check their own PHP version and to move off end-of-life versions as soon as possible.",
		notes:
			"Nexcess is a Liquid Web sibling brand and this is the same shared disclosure, down to the incident identifier — not an independent confirmation. Their status page also carries an unrelated open incident about Magento, which is easy to confuse with this one.",
		headerSignatures: ["nexcess"],
	},
	{
		slug: "rocket-net",
		name: "Rocket.net",
		status: "published_acknowledged",
		source: "https://status.rocket.net/incident/3178",
		sourceDate: "2026-10-22",
		quote:
			"Patches from upstream vendors have been released and are currently being deployed across the fleet in rolling waves.",
		customerAction:
			"Rocket.net recommends updating to PHP 8.2 or later yourself through Mission Control, after checking theme and plugin compatibility.",
		notes:
			"The incident is marked resolved, but the only substantive text describes deployment as still in progress and no update states that it finished — so this page reports what was written rather than what the status widget says. The page does not name the CVE identifiers.",
		headerSignatures: ["rocket.net", "rocketnet"],
	},
	{
		slug: "elementor-hosting",
		name: "Elementor Hosting",
		status: "published_patched",
		source: "https://elementor.com/blog/php2shell-elementor-hosting/",
		sourceDate: "2026-10-22",
		quote: "Every Elementor Hosting site is now running a patched and updated version of PHP.",
		customerAction:
			"Nothing if your site is on Elementor Hosting. If you host elsewhere they say to check Tools, Site Health, Info and contact your host.",
		notes:
			"Elementor consistently calls this product Elementor Hosting rather than Elementor Cloud. They say patched PHP was live across every site by the end of 21 October.",
		headerSignatures: ["elementor"],
	},
]

export function hostBySlug(slug: string): HostRecord | null {
	return HOSTS.find((h) => h.slug === slug) ?? null
}

/** Maps a platform name the checker detected to its page, when we have one. */
export function hostForPlatform(platform: string): HostRecord | null {
	const needle = platform.toLowerCase()
	return (
		HOSTS.find((h) =>
			h.headerSignatures.some((sig) => needle.includes(sig.toLowerCase())),
		) ?? null
	)
}

/** Plain-English summary of a status, used in copy and in page titles. */
export function statusLabel(status: HostStatus): string {
	switch (status) {
		case "published_patched":
			return "Says it has patched"
		case "published_acknowledged":
			return "Has acknowledged the issue"
		case "published_action_required":
			return "Says customers need to act"
		case "not_found":
			return "No public statement found"
	}
}
