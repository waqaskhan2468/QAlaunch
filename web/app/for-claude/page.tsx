import { PlatformPage, platformMetadata } from '@/components/platform/platform-page'
import { CLAUDE } from '@/lib/platform/platforms'

export const metadata = platformMetadata(CLAUDE)

export default function Page() {
	return <PlatformPage config={CLAUDE} />
}
