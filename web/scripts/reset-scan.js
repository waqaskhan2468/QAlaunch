/**
 * reset-scan.js — QA helper to wipe a single URL's scan(s) and all related rows
 * from Supabase, so the free-scan flow can be re-tested on the same URL.
 *
 * Usage:
 *   node scripts/reset-scan.js https://example.com
 *
 * It deletes — scoped strictly to the matching scan id(s), never other scans:
 *   issues, scan_pages, funnel_events, then the scans row(s) themselves.
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local
 * (falls back to .env, then the existing process environment).
 */

const { createClient } = require('@supabase/supabase-js');

// Load env the same way the app does, but for a plain `node` invocation. Next.js
// auto-loads .env.local for the server; a bare script does not, so do it here.
for (const file of ['.env.local', '.env']) {
	try {
		process.loadEnvFile(file);
	} catch {
		// File absent — fine; rely on whatever is already in process.env.
	}
}

/**
 * Mirror of lib/utils/url.ts `normalizeUrl()`. The scans.url column stores the
 * NORMALIZED url, so we must normalize the CLI argument the same way to match.
 * Keep this in sync with lib/utils/url.ts.
 */
function normalizeUrl(input) {
	let url = input.trim().toLowerCase();
	if (!/^https?:\/\//i.test(url)) {
		url = `https://${url}`;
	}

	const parsed = new URL(url);
	let host = parsed.host.toLowerCase();
	if (host.startsWith('www.')) host = host.slice(4);

	const pathname =
		parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/$/, '');

	return `https://${host}${pathname}`;
}

async function main() {
	const rawUrl = process.argv[2];

	if (!rawUrl || rawUrl === '--help' || rawUrl === '-h') {
		console.error('Usage: node scripts/reset-scan.js <url>');
		console.error('Example: node scripts/reset-scan.js https://example.com');
		process.exitCode = 1;
		return;
	}

	let normalized;
	try {
		normalized = normalizeUrl(rawUrl);
	} catch {
		console.error(`Invalid URL: "${rawUrl}"`);
		process.exitCode = 1;
		return;
	}

	const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

	if (!supabaseUrl || !serviceKey) {
		console.error(
			'Missing Supabase credentials. Ensure NEXT_PUBLIC_SUPABASE_URL and ' +
				'SUPABASE_SERVICE_ROLE_KEY are set in .env.local (or the environment).',
		);
		process.exitCode = 1;
		return;
	}

	const supabase = createClient(supabaseUrl, serviceKey, {
		auth: { persistSession: false },
	});

	console.log(`Resetting scans for: ${normalized}`);
	if (normalized !== rawUrl.trim()) {
		console.log(`  (normalized from "${rawUrl.trim()}")`);
	}

	// 1. Find every scan row for this exact normalized URL. Re-running a scan
	//    creates a new scans row each time, so a full reset may match several.
	const { data: scans, error: findError } = await supabase
		.from('scans')
		.select('id, created_at, status, package')
		.eq('url', normalized);

	if (findError) {
		console.error(`Failed to query scans: ${findError.message}`);
		process.exitCode = 1;
		return;
	}

	if (!scans || scans.length === 0) {
		console.log(`No scan found for ${normalized}. Nothing to delete.`);
		return;
	}

	const scanIds = scans.map((s) => s.id);
	console.log(
		`Found ${scanIds.length} scan record(s): ${scanIds.join(', ')}`,
	);

	// 2. Delete children first (issues, scan_pages), then funnel_events, then the
	//    scans themselves. Every delete is scoped by scan_id IN (these ids), so no
	//    other scan is ever touched. funnel_events would cascade with the scans
	//    delete, but we delete it explicitly to report an accurate count.
	//    `.select('id')` makes Supabase return the deleted rows so we can count them.
	const deletions = [
		{ table: 'issues', column: 'scan_id' },
		{ table: 'scan_pages', column: 'scan_id' },
		{ table: 'funnel_events', column: 'scan_id' },
		{ table: 'scans', column: 'id' },
	];

	const summary = {};

	for (const { table, column } of deletions) {
		const { data, error } = await supabase
			.from(table)
			.delete()
			.in(column, scanIds)
			.select('id');

		if (error) {
			console.error(`Failed to delete from ${table}: ${error.message}`);
			process.exitCode = 1;
			return;
		}

		summary[table] = data ? data.length : 0;
	}

	console.log('\nDeleted:');
	console.log(`  issues:        ${summary.issues}`);
	console.log(`  scan_pages:    ${summary.scan_pages}`);
	console.log(`  funnel_events: ${summary.funnel_events}`);
	console.log(`  scans:         ${summary.scans}`);
	console.log(`\nDone. ${normalized} is reset and ready to re-scan.`);
	console.log(
		'Note: screenshot/report files in Supabase Storage are not removed; ' +
			'they are harmless orphans and a new scan writes fresh paths.',
	);
}

main().catch((err) => {
	console.error('Unexpected error:', err);
	process.exitCode = 1;
});
