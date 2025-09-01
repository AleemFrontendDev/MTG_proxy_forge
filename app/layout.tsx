import type React from "react"
import type { Metadata } from "next"
import { Inter, Playfair_Display } from "next/font/google"
import "./globals.css"
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Toaster } from "@/components/ui/toaster"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
})

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
})

export const metadata: Metadata = {
  title: "ProxyPrintr - Magic: The Gathering Proxy Card Generator",
  description: "Generate printable proxy cards for Magic: The Gathering playtesting with professional layouts",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${playfair.variable}`}>
       <link rel="icon" type="image/png" href="icon.png" />
      <body className={inter.className}>
          {children}
          <SpeedInsights />
          <Toaster />
      </body>
    </html>
  )
}
