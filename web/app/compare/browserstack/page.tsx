import { ComparePage, compareMetadata } from '@/components/compare/compare-page'
import { BROWSERSTACK } from '@/lib/compare/comparisons'

export const metadata = compareMetadata(BROWSERSTACK)

export default function Page() {
	return <ComparePage config={BROWSERSTACK} />
}
