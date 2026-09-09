import { ComparePage, compareMetadata } from '@/components/compare/compare-page'
import { LIGHTHOUSE } from '@/lib/compare/comparisons'

export const metadata = compareMetadata(LIGHTHOUSE)

export default function Page() {
	return <ComparePage config={LIGHTHOUSE} />
}
