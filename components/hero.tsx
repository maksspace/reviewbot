import Link from "next/link"
import { TerminalAnimation } from "./terminal-animation"

export function Hero() {
  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center px-6 pt-20">
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-8">
          <span className="text-xs tracking-[0.3em] uppercase text-muted-foreground">
            AI Code Review
          </span>
        </div>

        <h1 className="mb-6 text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl md:text-5xl lg:text-6xl text-balance">
          Code reviews that think{" "}
          <span className="text-terminal">like your team.</span>
        </h1>

        <p className="mb-12 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          An AI reviewer that learns your architecture, your standards, your
          opinions. Not generic best practices — yours.
        </p>

        <div className="mb-16 flex flex-wrap items-center gap-4">
          <Link
            href="/login"
            className="border border-terminal px-6 py-3 text-xs tracking-wider uppercase text-terminal transition-all hover:bg-terminal hover:text-background"
          >
            Connect Repository
          </Link>
          <Link
            href="#how-it-works"
            className="px-6 py-3 text-xs tracking-wider uppercase text-muted-foreground transition-colors hover:text-foreground"
          >
            {"How it works ->"}
          </Link>
        </div>

        <TerminalAnimation />
      </div>
    </section>
  )
}
