import type { Metadata, Viewport } from 'next'
import { JetBrains_Mono } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import { dark } from '@clerk/themes'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
})

export const metadata: Metadata = {
  title: 'ReviewBot - Code reviews that think like your team',
  description:
    'An AI code review bot that learns your architecture, your standards, your opinions. Works with GitHub and GitLab, powered by Claude and GPT.',
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
        <ClerkProvider
          appearance={{ baseTheme: dark }}
          signInUrl="/login"
          afterSignOutUrl="/"
        >
          {children}
        </ClerkProvider>
        <Analytics />
      </body>
    </html>
  )
}
