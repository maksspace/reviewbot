import Link from "next/link"
import { ReviewBotLogo } from "@/components/reviewbot-logo"

export function Footer() {
  return (
    <footer className="border-t border-border px-6 py-12">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ReviewBotLogo size={20} />
          <span>ReviewBot</span>
        </div>

        <div className="flex items-center gap-6">
          <Link
            href="#how-it-works"
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            How it works
          </Link>
          <Link
            href="#pricing"
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Pricing
          </Link>
          <Link
            href="/login"
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Sign in
          </Link>
          <span className="text-xs text-muted-foreground/50">
            reviewbot.sh
          </span>
        </div>
        <div className="mt-6 w-full text-center sm:mt-0 sm:w-auto sm:text-right">
          <span className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground/30">
            CloudGrip, Inc.
          </span>
        </div>
      </div>
    </footer>
  )
}
