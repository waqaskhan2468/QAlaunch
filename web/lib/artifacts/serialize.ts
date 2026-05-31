import type { ScanResult } from '@/lib/scan/types/scan.types';
import type { ResponsiveArtifactMeta } from './types';

/** Strip screenshot buffers from responsive results for JSON serialization. */
export function responsiveToArtifactMeta(
	responsive: ScanResult['responsive'],
): ResponsiveArtifactMeta[] | null {
	if (!responsive?.length) return null;
	return responsive.map(({ screenshot: _s, slices: _sl, ...meta }) => meta);
}
