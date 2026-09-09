import { PlatformPage, platformMetadata } from '@/components/platform/platform-page'
import { REPLIT } from '@/lib/platform/platforms'

export const metadata = platformMetadata(REPLIT)

export default function Page() {
	return <PlatformPage config={REPLIT} />
}
