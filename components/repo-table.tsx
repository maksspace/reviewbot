"use client"

import Link from "next/link"
import { StatusBadge } from "@/components/status-badge"

export type Repo = {
  slug: string
  name: string
  provider: "GitHub" | "GitLab"
  status: "active" | "interview" | "analyzing" | "paused"
  reviews: number | null
  lastReview: string | null
}

const MOCK_REPOS: Repo[] = [
  {
    slug: "acme-backend-api",
    name: "acme/backend-api",
    provider: "GitLab",
    status: "active",
    reviews: 142,
    lastReview: "2h ago",
  },
  {
    slug: "acme-frontend-app",
    name: "acme/frontend-app",
    provider: "GitHub",
    status: "interview",
    reviews: null,
    lastReview: null,
  },
  {
    slug: "acme-mobile-sdk",
    name: "acme/mobile-sdk",
    provider: "GitHub",
    status: "active",
    reviews: 38,
    lastReview: "1d ago",
  },
  {
    slug: "acme-infra",
    name: "acme/infra",
    provider: "GitLab",
    status: "analyzing",
    reviews: null,
    lastReview: null,
  },
  {
    slug: "acme-docs",
    name: "acme/docs",
    provider: "GitHub",
    status: "paused",
    reviews: 12,
    lastReview: "2w ago",
  },
]

export function RepoTable() {
  return (
    <div className="w-full overflow-x-auto">
      {/* Header row */}
      <div className="hidden border-b border-border pb-3 sm:grid sm:grid-cols-[1fr_100px_120px_80px_100px]">
        <span className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
          Repository
        </span>
        <span className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
          Provider
        </span>
        <span className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
          Status
        </span>
        <span className="text-right text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
          Reviews
        </span>
        <span className="text-right text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
          Last Review
        </span>
      </div>

      {/* Rows */}
      {MOCK_REPOS.map((repo) => (
        <Link
          key={repo.slug}
          href={`/dashboard/${repo.slug}`}
          className="flex flex-col gap-2 border-b border-border py-4 transition-colors hover:bg-surface-hover sm:grid sm:grid-cols-[1fr_100px_120px_80px_100px] sm:items-center sm:gap-0"
        >
          <span className="text-sm text-foreground">{repo.name}</span>

          <span className="text-xs text-muted-foreground">
            <span className="mr-2 text-[10px] tracking-wider uppercase text-muted-foreground/50 sm:hidden">
              Provider:
            </span>
            {repo.provider}
          </span>

          <div>
            <StatusBadge status={repo.status} />
          </div>

          <span className="text-right text-xs text-muted-foreground tabular-nums">
            <span className="mr-2 text-[10px] tracking-wider uppercase text-muted-foreground/50 sm:hidden">
              Reviews:
            </span>
            {repo.reviews !== null ? repo.reviews : "\u2014"}
          </span>

          <span className="text-right text-xs text-muted-foreground">
            <span className="mr-2 text-[10px] tracking-wider uppercase text-muted-foreground/50 sm:hidden">
              Last:
            </span>
            {repo.lastReview ?? "\u2014"}
          </span>
        </Link>
      ))}
    </div>
  )
}
