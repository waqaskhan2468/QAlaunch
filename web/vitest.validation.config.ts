import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Regression harness for the deterministic-check pipeline. Runs real scans
// (Browserbase + Claude + Supabase) against a fixed URL set and reports what each
// deterministic check produced. REQUIRED before any change to the checking
// pipeline ships. Run with: pnpm validate:checks
export default defineConfig({
	resolve: { alias: { '@': path.resolve(process.cwd()) } },
	test: {
		environment: 'node',
		include: ['scripts/validation/check-regression.test.ts'],
		testTimeout: 300_000,
		hookTimeout: 120_000,
		fileParallelism: false,
	},
});
