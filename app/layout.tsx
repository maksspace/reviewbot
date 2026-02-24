import type { Metadata, Viewport } from 'next'
import { JetBrains_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
})

const SITE_URL = 'https://reviewbot.sh'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'ReviewBot - Code reviews that think like your team',
    template: '%s | ReviewBot',
  },
  description:
    'An AI code review bot that learns your architecture, your standards, your opinions. Works with GitHub and GitLab, powered by Claude and GPT.',
  keywords: [
    'code review',
    'AI code review',
    'GitHub',
    'GitLab',
    'pull request',
    'merge request',
    'automated review',
    'Claude',
    'GPT',
  ],
  authors: [{ name: 'ReviewBot' }],
  creator: 'ReviewBot',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: SITE_URL,
    siteName: 'ReviewBot',
    title: 'ReviewBot - Code reviews that think like your team',
    description:
      'An AI reviewer that learns your architecture, your standards, your opinions. Not generic best practices — yours.',
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: 'ReviewBot — AI code reviews that think like your team',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ReviewBot - Code reviews that think like your team',
    description:
      'An AI reviewer that learns your architecture, your standards, your opinions. Not generic best practices — yours.',
    images: ['/og.png'],
  },
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon-dark-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#0a0a0a',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${jetbrainsMono.variable} font-mono antialiased`}>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
