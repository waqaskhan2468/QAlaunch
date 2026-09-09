import { PlatformPage, platformMetadata } from '@/components/platform/platform-page'
import { BASE44 } from '@/lib/platform/platforms'

export const metadata = platformMetadata(BASE44)

export default function Page() {
	return <PlatformPage config={BASE44} />
}
