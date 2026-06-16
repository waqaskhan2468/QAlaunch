import type { Metadata, Viewport } from "next"
import { Epilogue, Figtree, JetBrains_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"

import { PageTransition } from "@/components/motion/page-transition"
import "./globals.css"

// Body copy — Figtree is warm, highly readable for marketing prose.
const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-figtree",
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
})

// Headings — Epilogue has the strong personality we want for H1/H2.
const epilogue = Epilogue({
  subsets: ["latin"],
  variable: "--font-epilogue",
  weight: ["400", "500", "700", "800", "900"],
  display: "swap",
})

// Monospace — used for the URL input + technical chrome.
const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  weight: ["400", "500"],
  display: "swap",
})

export const metadata: Metadata = {
  title: {
    default: "QAlaunch — AI Website Audit Tool | Find Bugs in 60 Seconds",
    template: "%s | QAlaunch",
  },
  description:
    "AI-powered website auditing tool built by a senior QA engineer with 9+ years experience. Find UI bugs, broken buttons, mobile issues, and usability problems on any website in 60 seconds. Reports from $9.",
  keywords: [
    "website audit tool",
    "free website audit",
    "website QA testing",
    "website bug checker",
    "AI website audit",
    "website usability testing",
    "mobile responsiveness test",
    "website quality checker",
    "Lovable website testing",
    "Bolt website audit",
    "Shopify store audit",
    "website accessibility checker",
  ],
  authors: [{ name: "QAlaunch", url: "https://getqalaunch.com" }],
  creator: "QAlaunch",
  publisher: "QAlaunch",
  metadataBase: new URL("https://getqalaunch.com"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://getqalaunch.com",
    siteName: "QAlaunch",
    title: "QAlaunch — AI Website Audit Tool | Find Bugs in 60 Seconds",
    description:
      "Find UI bugs, broken buttons, mobile issues, and usability problems on any website in 60 seconds. Built by a QA engineer with 9+ years experience. Reports from $9.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "QAlaunch — AI Website Audit Tool",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "QAlaunch — Find What's Broken on Your Website in 60 Seconds",
    description:
      "AI-powered website audit tool. Find UI bugs, broken buttons, mobile issues instantly. From $9.",
    images: ["/og-image.png"],
    creator: "@QAlaunchHQ",
    site: "@QAlaunchHQ",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: "",
  },
}

export const viewport: Viewport = {
  themeColor: "#09111f",
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${figtree.variable} ${epilogue.variable} ${jetbrains.variable} bg-background`}
    >
      <body className="font-sans antialiased">
        <PageTransition>{children}</PageTransition>
        {process.env.NODE_ENV === "production" && <Analytics />}
      </body>
    </html>
  )
}
