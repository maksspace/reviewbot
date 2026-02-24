"use client"

import { useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { ReviewBotLogo } from "@/components/reviewbot-logo"

function GitHubIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  )
}

function GitLabIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M23.955 13.587l-1.342-4.135-2.664-8.189a.455.455 0 00-.867 0L16.418 9.45H7.582L4.918 1.263a.455.455 0 00-.867 0L1.387 9.452.045 13.587a.924.924 0 00.331 1.023L12 23.054l11.624-8.443a.92.92 0 00.331-1.024" />
    </svg>
  )
}

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false)
  const supabase = createClient()

  const signInWith = async (provider: "github" | "gitlab") => {
    setIsLoading(true)
    const scopes = provider === "github" ? "repo read:org" : "read_user api"
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes,
      },
    })
    if (error) {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-12 text-center">
          <Link
            href="/"
            className="mb-8 inline-flex items-center gap-2 text-foreground"
          >
            <ReviewBotLogo size={28} />
            <span className="text-sm font-bold tracking-wider uppercase">
              ReviewBot
            </span>
          </Link>
        </div>

        <div className="border border-border p-8">
          <h1 className="mb-2 text-lg font-bold text-foreground">
            Sign in to ReviewBot
          </h1>
          <p className="mb-8 text-xs text-muted-foreground">
            Connect your repository to get started.
          </p>

          <div className="flex flex-col gap-3">
            <button
              type="button"
              disabled={isLoading}
              onClick={() => signInWith("github")}
              className="flex w-full items-center justify-center gap-3 border border-border px-4 py-3 text-xs tracking-wider uppercase text-foreground transition-colors hover:border-foreground hover:bg-surface-hover disabled:pointer-events-none disabled:opacity-50"
            >
              <GitHubIcon />
              Continue with GitHub
            </button>

            <button
              type="button"
              disabled={isLoading}
              onClick={() => signInWith("gitlab")}
              className="flex w-full items-center justify-center gap-3 border border-border px-4 py-3 text-xs tracking-wider uppercase text-foreground transition-colors hover:border-foreground hover:bg-surface-hover disabled:pointer-events-none disabled:opacity-50"
            >
              <GitLabIcon />
              Continue with GitLab
            </button>
          </div>
        </div>

        <div className="mt-8 text-center">
          <Link
            href="/"
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            {"<- Back to home"}
          </Link>
        </div>
      </div>
    </div>
  )
}
