import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import './globals.css'

export const metadata: Metadata = {
  title: 'MTG Proxy Forge',
  description: 'Get MTG proxies with ease',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      
      <head>
  <link 
    rel="icon" 
    type="image/png" 
    href="//mtgproxies.nl/cdn/shop/files/logo_transparant_7f807757-d066-43f1-8673-f22a34114e98.png?crop=center&height=32&v=1723500511&width=32" 
  />
        <style>{`
html {
  font-family: ${GeistSans.style.fontFamily};
  --font-sans: ${GeistSans.variable};
  --font-mono: ${GeistMono.variable};
}
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  )
}
