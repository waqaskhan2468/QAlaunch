import { createHmac, timingSafeEqual, createHash } from 'node:crypto';

/**
 * Single-admin auth for the /admin analytics dashboard.
 *
 * There is exactly one operator, so this deliberately avoids a users table and
 * a full auth library: credentials live in env vars and the session is a
 * stateless HMAC-signed cookie. No secrets are ever sent to the browser — the
 * cookie carries only the username and an expiry, plus a signature that cannot
 * be forged without ADMIN_SESSION_SECRET.
 */

export const ADMIN_COOKIE_NAME = 'qa_admin_session';

const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

type SessionPayload = { u: string; exp: number };

function b64urlEncode(value: string): string {
	return Buffer.from(value, 'utf8').toString('base64url');
}

function b64urlDecode(value: string): string | null {
	try {
		return Buffer.from(value, 'base64url').toString('utf8');
	} catch {
		return null;
	}
}

/**
 * Length-independent constant-time compare. `timingSafeEqual` throws on
 * differing lengths (and the length itself leaks), so both sides are hashed to
 * a fixed 32 bytes first.
 */
function safeEqual(a: string, b: string): boolean {
	const ha = createHash('sha256').update(a, 'utf8').digest();
	const hb = createHash('sha256').update(b, 'utf8').digest();
	return timingSafeEqual(ha, hb);
}

function getSecret(): string | null {
	const secret = process.env.ADMIN_SESSION_SECRET?.trim();
	return secret && secret.length >= 16 ? secret : null;
}

function sign(data: string, secret: string): string {
	return createHmac('sha256', secret).update(data).digest('base64url');
}

/** True when every env var the dashboard needs is present. */
export function isAdminConfigured(): boolean {
	return Boolean(
		process.env.ADMIN_USERNAME?.trim() &&
			process.env.ADMIN_PASSWORD?.trim() &&
			getSecret(),
	);
}

/** Verify submitted login credentials in constant time. */
export function checkAdminCredentials(
	username: string,
	password: string,
): boolean {
	const expectedUser = process.env.ADMIN_USERNAME?.trim();
	const expectedPass = process.env.ADMIN_PASSWORD?.trim();
	if (!expectedUser || !expectedPass) return false;

	// Both compared unconditionally so a wrong username and a wrong password
	// take the same time.
	const userOk = safeEqual(username, expectedUser);
	const passOk = safeEqual(password, expectedPass);
	return userOk && passOk;
}

/** Signed session token for the admin cookie, or null if unconfigured. */
export function createSessionToken(username: string): string | null {
	const secret = getSecret();
	if (!secret) return null;

	const payload: SessionPayload = {
		u: username,
		exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
	};
	const encoded = b64urlEncode(JSON.stringify(payload));
	return `${encoded}.${sign(encoded, secret)}`;
}

/**
 * Validate a session cookie value. Returns the username, or null when the
 * token is malformed, tampered with, expired, or issued for a username that no
 * longer matches ADMIN_USERNAME (so rotating the env var logs the session out).
 */
export function verifySessionToken(token: string | undefined): string | null {
	const secret = getSecret();
	if (!secret || !token) return null;

	const [encoded, signature] = token.split('.');
	if (!encoded || !signature) return null;

	if (!safeEqual(signature, sign(encoded, secret))) return null;

	const json = b64urlDecode(encoded);
	if (!json) return null;

	let payload: SessionPayload;
	try {
		payload = JSON.parse(json) as SessionPayload;
	} catch {
		return null;
	}

	if (typeof payload?.u !== 'string' || typeof payload?.exp !== 'number') {
		return null;
	}
	if (payload.exp * 1000 <= Date.now()) return null;

	const expectedUser = process.env.ADMIN_USERNAME?.trim();
	if (!expectedUser || payload.u !== expectedUser) return null;

	return payload.u;
}

/** Cookie options for the session. Secure is dropped on http://localhost only. */
export function sessionCookieOptions(): {
	httpOnly: true;
	secure: boolean;
	sameSite: 'lax';
	path: string;
	maxAge: number;
} {
	return {
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production',
		sameSite: 'lax',
		path: '/',
		maxAge: SESSION_TTL_SECONDS,
	};
}
