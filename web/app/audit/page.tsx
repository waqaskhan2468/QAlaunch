import type { Metadata } from "next"
import { Suspense } from "react"

import { SiteNav } from "@/components/site/site-nav"
import { SiteFooter } from "@/components/site/site-footer"
import { AuditExperience } from "@/components/audit/audit-experience"

export const metadata: Metadata = {
  title: "Your Free Website Audit — QAlaunch",
  description:
    "Live website audit results — usability, UI, functionality and mobile responsiveness issues found on your site.",
  robots: { index: false, follow: true },
}

export default function AuditPage() {
  return (
    <>
      <SiteNav />
      <main className="pt-16">
        {/* Suspense is required because AuditExperience uses useSearchParams. */}
        <Suspense
          fallback={
            <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-surface-soft">
              <div className="qa-spin size-12 rounded-full border-4 border-brand-pale border-t-brand" />
            </div>
          }
        >
          <AuditExperience />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  )
}
