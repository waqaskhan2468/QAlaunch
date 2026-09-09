import { PlatformPage, platformMetadata } from '@/components/platform/platform-page'
import { V0 } from '@/lib/platform/platforms'

export const metadata = platformMetadata(V0)

export default function Page() {
	return <PlatformPage config={V0} />
}
