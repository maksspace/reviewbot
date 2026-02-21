"use client"

import { use, useState } from "react"
import Link from "next/link"
import { ArrowLeft, ArrowRight, Pause, Play } from "lucide-react"
import { StatusBadge } from "@/components/status-badge"
import { PersonaViewer } from "@/components/persona-viewer"
import { ActivityFeed } from "@/components/activity-feed"

const TABS = ["Overview", "Interview", "Review Persona", "Activity"] as const
type Tab = (typeof TABS)[number]

// Mock repo data keyed by slug
const REPO_DATA: Record<
  string,
  {
    name: string
    provider: string
    status: "active" | "interview" | "analyzing" | "paused"
    connected: string
    totalReviews: number
    avgComments: number
    topCategories: string[]
  }
> = {
  "acme-backend-api": {
    name: "acme/backend-api",
    provider: "GitLab",
    status: "active",
    connected: "Jan 12, 2026",
    totalReviews: 142,
    avgComments: 2.3,
    topCategories: ["Module boundaries", "Missing tests", "Code style"],
  },
  "acme-frontend-app": {
    name: "acme/frontend-app",
    provider: "GitHub",
    status: "interview",
    connected: "Feb 1, 2026",
    totalReviews: 0,
    avgComments: 0,
    topCategories: [],
  },
  "acme-mobile-sdk": {
    name: "acme/mobile-sdk",
    provider: "GitHub",
    status: "active",
    connected: "Dec 8, 2025",
    totalReviews: 38,
    avgComments: 1.8,
    topCategories: ["Null safety", "Platform APIs", "Error handling"],
  },
  "acme-infra": {
    name: "acme/infra",
    provider: "GitLab",
    status: "analyzing",
    connected: "Feb 20, 2026",
    totalReviews: 0,
    avgComments: 0,
    topCategories: [],
  },
  "acme-docs": {
    name: "acme/docs",
    provider: "GitHub",
    status: "paused",
    connected: "Nov 2, 2025",
    totalReviews: 12,
    avgComments: 0.8,
    topCategories: ["Formatting", "Broken links"],
  },
}

const FALLBACK = {
  name: "unknown/repo",
  provider: "GitHub",
  status: "paused" as const,
  connected: "Unknown",
  totalReviews: 0,
  avgComments: 0,
  topCategories: [],
}

export default function RepoDetailPage({
  params,
}: {
  params: Promise<{ repo: string }>
}) {
  const { repo: slug } = use(params)
  const repo = REPO_DATA[slug] ?? FALLBACK
  const [activeTab, setActiveTab] = useState<Tab>("Overview")
  const [paused, setPaused] = useState(repo.status === "paused")

  return (
    <div>
      {/* Breadcrumb */}
      <Link
        href="/dashboard"
        className="mb-8 inline-flex items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3" />
        Back to repositories
      </Link>

      {/* Repo header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold text-foreground">{repo.name}</h1>
          <StatusBadge status={paused ? "paused" : repo.status} />
        </div>
        {repo.status === "active" && (
          <button
            type="button"
            onClick={() => setPaused(!paused)}
            className="inline-flex items-center gap-2 border border-border px-4 py-2 text-xs tracking-wider uppercase text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
          >
            {paused ? (
              <>
                <Play className="size-3" /> Resume Reviews
              </>
            ) : (
              <>
                <Pause className="size-3" /> Pause Reviews
              </>
            )}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-8 flex gap-6 border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`pb-3 text-xs tracking-wider uppercase transition-colors ${
              activeTab === tab
                ? "border-b border-terminal text-terminal"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "Overview" && (
        <OverviewTab repo={repo} />
      )}
      {activeTab === "Interview" && (
        <InterviewTab status={repo.status} slug={slug} />
      )}
      {activeTab === "Review Persona" && <PersonaViewer />}
      {activeTab === "Activity" && <ActivityFeed />}
    </div>
  )
}

function OverviewTab({
  repo,
}: {
  repo: {
    name: string
    provider: string
    connected: string
    totalReviews: number
    avgComments: number
    topCategories: string[]
  }
}) {
  return (
    <div className="flex flex-col gap-8">
      {/* Info */}
      <div className="border border-border p-6">
        <h3 className="mb-4 text-xs tracking-[0.2em] uppercase text-muted-foreground">
          Repository Info
        </h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <div className="mb-1 text-[10px] tracking-wider uppercase text-muted-foreground/60">
              Name
            </div>
            <div className="text-sm text-foreground">{repo.name}</div>
          </div>
          <div>
            <div className="mb-1 text-[10px] tracking-wider uppercase text-muted-foreground/60">
              Provider
            </div>
            <div className="text-sm text-foreground">{repo.provider}</div>
          </div>
          <div>
            <div className="mb-1 text-[10px] tracking-wider uppercase text-muted-foreground/60">
              Connected
            </div>
            <div className="text-sm text-foreground">{repo.connected}</div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="border border-border p-6">
        <h3 className="mb-4 text-xs tracking-[0.2em] uppercase text-muted-foreground">
          Stats
        </h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <div className="mb-1 text-[10px] tracking-wider uppercase text-muted-foreground/60">
              Total Reviews
            </div>
            <div className="text-2xl font-bold tabular-nums text-foreground">
              {repo.totalReviews}
            </div>
          </div>
          <div>
            <div className="mb-1 text-[10px] tracking-wider uppercase text-muted-foreground/60">
              Avg Comments / PR
            </div>
            <div className="text-2xl font-bold tabular-nums text-foreground">
              {repo.avgComments}
            </div>
          </div>
          <div>
            <div className="mb-1 text-[10px] tracking-wider uppercase text-muted-foreground/60">
              Top Categories
            </div>
            <div className="flex flex-col gap-1">
              {repo.topCategories.length > 0 ? (
                repo.topCategories.map((cat) => (
                  <span key={cat} className="text-sm text-foreground">
                    {cat}
                  </span>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">{"\u2014"}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function InterviewTab({ status, slug }: { status: string; slug: string }) {
  const hasPersona = status === "active"

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      {hasPersona ? (
        <>
          <p className="mb-4 text-sm text-foreground">
            Interview completed. Your review persona is active.
          </p>
          <p className="mb-8 text-xs text-muted-foreground">
            You can re-interview to update your persona with new preferences.
          </p>
          <Link
            href={`/dashboard/${slug}/interview`}
            className="inline-flex items-center gap-2 border border-border px-6 py-3 text-xs tracking-wider uppercase text-muted-foreground transition-colors hover:border-terminal hover:text-terminal"
          >
            Re-interview
            <ArrowRight className="size-3" />
          </Link>
        </>
      ) : (
        <>
          <p className="mb-4 text-sm text-muted-foreground">
            The interview helps ReviewBot learn your team{"'"}s standards.
          </p>
          <p className="mb-8 text-xs text-muted-foreground/60">
            It takes about 15 minutes and covers architecture, code style, and review preferences.
          </p>
          <Link
            href={`/dashboard/${slug}/interview`}
            className="inline-flex items-center gap-2 border border-terminal px-6 py-3 text-xs tracking-wider uppercase text-terminal transition-colors hover:bg-terminal hover:text-background"
          >
            Start Interview
            <ArrowRight className="size-3" />
          </Link>
        </>
      )}
    </div>
  )
}
