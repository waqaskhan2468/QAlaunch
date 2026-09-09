import { ComparePage, compareMetadata } from '@/components/compare/compare-page'
import { FREELANCER } from '@/lib/compare/comparisons'

export const metadata = compareMetadata(FREELANCER)

export default function Page() {
	return <ComparePage config={FREELANCER} />
}
