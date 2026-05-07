import type { Metadata, Viewport } from "next"
import { Epilogue, Figtree, JetBrains_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
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
  title: "QAlaunch — Free Website Audit Tool | UI, UX & Functionality Testing",
  description:
    "Get a free expert website audit in 60 seconds. QAlaunch tests your website for usability issues, UI bugs, broken functionality, mobile responsiveness, and SEO — and delivers an actionable PDF report starting from $9.",
  keywords: [
    "free website audit",
    "website testing tool",
    "usability testing",
    "UI testing",
    "website quality checker",
    "website audit tool",
    "free website checker",
    "website QA",
  ],
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
        {children}
        {process.env.NODE_ENV === "production" && <Analytics />}
      </body>
    </html>
  )
}
