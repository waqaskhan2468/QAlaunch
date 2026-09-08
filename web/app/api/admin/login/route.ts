import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

import {
	ADMIN_COOKIE_NAME,
	checkAdminCredentials,
	createSessionToken,
	isAdminConfigured,
	sessionCookieOptions,
} from '@/lib/admin/auth';
import { getClientIp } from '@/lib/api/scan-start-rate-limit';

export const runtime = 'nodejs';

// Per-instance throttle on failed logins. Serverless means this is not a global
// guarantee (same caveat as the scan-start IP limiter), but it removes cheap
// high-rate guessing against a single warm instance.
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 10 * 60 * 1000;
const attempts = new Map<string, { count: number; resetAt: number }>();

function tooManyAttempts(ip: string): boolean {
	const now = Date.now();
	const bucket = attempts.get(ip);
	if (!bucket || bucket.resetAt <= now) return false;
	return bucket.count >= MAX_ATTEMPTS;
}

function recordFailure(ip: string): void {
	const now = Date.now();
	const bucket = attempts.get(ip);
	if (!bucket || bucket.resetAt <= now) {
		attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
		return;
	}
	bucket.count += 1;
}

export async function POST(req: Request) {
	if (!isAdminConfigured()) {
		console.error('[admin] login attempted but admin env vars are not set');
		return NextResponse.json(
			{ ok: false, error: 'Admin login is not configured on this deployment.' },
			{ status: 503 },
		);
	}

	const ip = getClientIp(req);
	if (tooManyAttempts(ip)) {
		return NextResponse.json(
			{ ok: false, error: 'Too many attempts. Try again in a few minutes.' },
			{ status: 429 },
		);
	}

	let body: unknown;
	try {
		body = await req.json();
	} catch {
		return NextResponse.json(
			{ ok: false, error: 'Invalid request.' },
			{ status: 400 },
		);
	}

	const { username, password } = (body ?? {}) as {
		username?: unknown;
		password?: unknown;
	};

	if (typeof username !== 'string' || typeof password !== 'string') {
		recordFailure(ip);
		return NextResponse.json(
			{ ok: false, error: 'Username and password are required.' },
			{ status: 400 },
		);
	}

	if (!checkAdminCredentials(username, password)) {
		recordFailure(ip);
		console.warn('[admin] failed login attempt', { ip });
		// Deliberately vague: never reveal which field was wrong.
		return NextResponse.json(
			{ ok: false, error: 'Incorrect username or password.' },
			{ status: 401 },
		);
	}

	const token = createSessionToken(username);
	if (!token) {
		return NextResponse.json(
			{ ok: false, error: 'Admin login is not configured on this deployment.' },
			{ status: 503 },
		);
	}

	attempts.delete(ip);
	const cookieStore = await cookies();
	cookieStore.set(ADMIN_COOKIE_NAME, token, sessionCookieOptions());

	return NextResponse.json({ ok: true });
}

/** Log out — clears the session cookie. */
export async function DELETE() {
	const cookieStore = await cookies();
	cookieStore.set(ADMIN_COOKIE_NAME, '', {
		...sessionCookieOptions(),
		maxAge: 0,
	});
	return NextResponse.json({ ok: true });
}
