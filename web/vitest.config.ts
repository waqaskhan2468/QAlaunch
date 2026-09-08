import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Mirrors the `@/*` path alias from tsconfig.json. Without it, any test that
 * imports (directly or transitively) a module using `@/…` fails to resolve.
 */
export default defineConfig({
	resolve: {
		alias: {
			'@': fileURLToPath(new URL('./', import.meta.url)),
		},
	},
});
