"use client"

import Link from "next/link"
import { useAuth } from "@clerk/nextjs"
import { ReviewBotLogo } from "@/components/reviewbot-logo"

export function Navbar() {
  const { isSignedIn } = useAuth()

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2 text-foreground">
          <ReviewBotLogo size={24} />
          <span className="text-sm font-bold tracking-wider uppercase">
            ReviewBot
          </span>
        </Link>

        <div className="flex items-center gap-8">
          <Link
            href="#how-it-works"
            className="hidden text-xs tracking-wider uppercase text-muted-foreground transition-colors hover:text-foreground sm:block"
          >
            How it works
          </Link>
          <Link
            href="#pricing"
            className="hidden text-xs tracking-wider uppercase text-muted-foreground transition-colors hover:text-foreground sm:block"
          >
            Pricing
          </Link>
          {isSignedIn ? (
            <Link
              href="/dashboard"
              className="border border-terminal/50 px-4 py-2 text-xs tracking-wider uppercase text-terminal transition-colors hover:border-terminal hover:bg-terminal/10"
            >
              Dashboard
            </Link>
          ) : (
            <Link
              href="/login"
              className="border border-terminal/50 px-4 py-2 text-xs tracking-wider uppercase text-terminal transition-colors hover:border-terminal hover:bg-terminal/10"
            >
              Sign in
            </Link>
          )}
        </div>
      </nav>
    </header>
  )
}
