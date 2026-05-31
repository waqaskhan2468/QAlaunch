/**
 * Bucket name helpers.
 *
 * SCREENSHOT_BUCKET (scan-screenshots) → PUBLIC
 *   Desktop + mobile screenshots. getPublicUrl() works — permanent URLs stored in DB.
 *
 * ARTIFACT_BUCKET is retained for backward-compatible signed-URL resolution of old
 * scans whose screenshot_desktop_url still points to a private bucket path.
 */
const SCREENSHOT_BUCKET =
	process.env.SUPABASE_SCREENSHOT_BUCKET || 'scan-screenshots';

const ARTIFACT_BUCKET =
	process.env.SUPABASE_ARTIFACT_BUCKET || 'scan-artifacts';

export function getScreenshotBucket(): string {
	return SCREENSHOT_BUCKET;
}

export function getArtifactBucket(): string {
	return ARTIFACT_BUCKET;
}
