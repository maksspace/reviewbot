import Link from "next/link"
import { StatusBadge } from "@/components/status-badge"

function formatDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return "just now"
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export type Repo = {
  slug: string
  name: string
  provider: "GitHub" | "GitLab"
  status: "active" | "interview" | "analyzing" | "paused"
  reviews: number | null
  lastReview: string | null
}

export function RepoTable({ repos }: { repos: Repo[] }) {
  if (repos.length === 0) {
    return (
      <div className="border border-border py-16 text-center">
        <p className="text-sm text-muted-foreground">
          No repositories connected yet.
        </p>
        <p className="mt-2 text-xs text-muted-foreground/60">
          Click "Connect Repository" to get started.
        </p>
      </div>
    )
  }

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
      {repos.map((repo) => (
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
            {repo.lastReview ? formatDate(repo.lastReview) : "\u2014"}
          </span>
        </Link>
      ))}
    </div>
  )
}
