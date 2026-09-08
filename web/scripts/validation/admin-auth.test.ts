import { expect, test, beforeEach } from 'vitest';

import {
	checkAdminCredentials,
	createSessionToken,
	isAdminConfigured,
	verifySessionToken,
} from '../../lib/admin/auth';

const SECRET = 'test-secret-that-is-long-enough-123456';

beforeEach(() => {
	process.env.ADMIN_USERNAME = 'waqas';
	process.env.ADMIN_PASSWORD = 'correct-horse-battery';
	process.env.ADMIN_SESSION_SECRET = SECRET;
});

test('isAdminConfigured requires all three vars', () => {
	expect(isAdminConfigured()).toBe(true);
	delete process.env.ADMIN_SESSION_SECRET;
	expect(isAdminConfigured()).toBe(false);
});

test('rejects a short/weak session secret', () => {
	process.env.ADMIN_SESSION_SECRET = 'tooshort';
	expect(isAdminConfigured()).toBe(false);
	expect(createSessionToken('waqas')).toBeNull();
});

test('accepts only the exact credentials', () => {
	expect(checkAdminCredentials('waqas', 'correct-horse-battery')).toBe(true);
	expect(checkAdminCredentials('waqas', 'wrong')).toBe(false);
	expect(checkAdminCredentials('someone', 'correct-horse-battery')).toBe(false);
	expect(checkAdminCredentials('', '')).toBe(false);
	// No prefix/substring weirdness.
	expect(checkAdminCredentials('waqas', 'correct-horse-batter')).toBe(false);
	expect(checkAdminCredentials('waqas ', 'correct-horse-battery')).toBe(false);
});

test('round-trips a valid session', () => {
	const token = createSessionToken('waqas');
	expect(token).toBeTruthy();
	expect(verifySessionToken(token!)).toBe('waqas');
});

test('rejects missing, malformed, and empty tokens', () => {
	expect(verifySessionToken(undefined)).toBeNull();
	expect(verifySessionToken('')).toBeNull();
	expect(verifySessionToken('garbage')).toBeNull();
	expect(verifySessionToken('a.b.c')).toBeNull();
	expect(verifySessionToken('.')).toBeNull();
});

test('rejects a tampered payload (forged username)', () => {
	const token = createSessionToken('waqas')!;
	const [, sig] = token.split('.');
	const forgedPayload = Buffer.from(
		JSON.stringify({ u: 'waqas', exp: Math.floor(Date.now() / 1000) + 9999 }),
		'utf8',
	).toString('base64url');
	// Same claims, but the signature belongs to a different payload string.
	expect(verifySessionToken(`${forgedPayload}x.${sig}`)).toBeNull();
});

test('rejects a token signed with a different secret', () => {
	const token = createSessionToken('waqas')!;
	process.env.ADMIN_SESSION_SECRET = 'a-completely-different-secret-value-99';
	expect(verifySessionToken(token)).toBeNull();
});

test('rejects an expired token', () => {
	const expired = Buffer.from(
		JSON.stringify({ u: 'waqas', exp: Math.floor(Date.now() / 1000) - 60 }),
		'utf8',
	).toString('base64url');
	const { createHmac } = require('node:crypto') as typeof import('node:crypto');
	const sig = createHmac('sha256', SECRET).update(expired).digest('base64url');
	expect(verifySessionToken(`${expired}.${sig}`)).toBeNull();
});

test('rotating ADMIN_USERNAME invalidates existing sessions', () => {
	const token = createSessionToken('waqas')!;
	expect(verifySessionToken(token)).toBe('waqas');
	process.env.ADMIN_USERNAME = 'someone-else';
	expect(verifySessionToken(token)).toBeNull();
});

test('no session is valid when auth is unconfigured', () => {
	const token = createSessionToken('waqas')!;
	delete process.env.ADMIN_SESSION_SECRET;
	expect(verifySessionToken(token)).toBeNull();
});
