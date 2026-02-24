"use client"

import { use, useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, ArrowRight, Pause, Play, Trash2 } from "lucide-react"
import { StatusBadge } from "@/components/status-badge"
import { PersonaViewer } from "@/components/persona-viewer"
import { ActivityFeed, type ReviewRecord } from "@/components/activity-feed"
import { SkillsTab } from "@/components/skills-tab"
import { createClient } from "@/lib/supabase/client"

const TABS = ["Overview", "Interview", "Review Persona", "Skills", "Activity"] as const
type Tab = (typeof TABS)[number]

interface RepoData {
  name: string
  provider: string
  status: "active" | "interview" | "analyzing" | "paused"
  connected_at: string
  persona_data?: { persona: string; generated_at: string } | null
}

export default function RepoDetailPage({
  params,
}: {
  params: Promise<{ repo: string }>
}) {
  const { repo: slug } = use(params)
  const [repo, setRepo] = useState<RepoData | null>(null)
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>("Overview")
  const [paused, setPaused] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [reviews, setReviews] = useState<ReviewRecord[]>([])

  useEffect(() => {
    const supabase = createClient()

    // Fetch repo data
    supabase
      .from("connected_repositories")
      .select("name, provider, status, connected_at, persona_data")
      .eq("slug", slug)
      .single()
      .then(({ data }) => {
        if (data) {
          setRepo(data as RepoData)
          setPaused(data.status === "paused")
        }
        setLoading(false)
      })

    // Fetch reviews
    supabase
      .from("reviews")
      .select("id, pr_number, pr_title, pr_url, pr_author, verdict, summary, comment_count, comments, created_at")
      .eq("repo_slug", slug)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (data) setReviews(data as ReviewRecord[])
      })
  }, [slug])

  if (loading) {
    return (
      <div className="py-20 text-center text-xs text-muted-foreground">
        Loading...
      </div>
    )
  }

  if (!repo) {
    return (
      <div>
        <Link
          href="/dashboard"
          className="mb-8 inline-flex items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3" />
          Back to repositories
        </Link>
        <div className="py-20 text-center text-xs text-muted-foreground">
          Repository not found.
        </div>
      </div>
    )
  }

  const connectedDate = new Date(repo.connected_at).toLocaleDateString(
    "en-US",
    { month: "short", day: "numeric", year: "numeric" }
  )

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
        <div className="flex items-center gap-3">
          {repo.status === "active" && (
            <button
              type="button"
              onClick={async () => {
                const newStatus = paused ? "active" : "paused"
                const supabase = createClient()
                const { error } = await supabase
                  .from("connected_repositories")
                  .update({ status: newStatus })
                  .eq("slug", slug)
                if (!error) {
                  setPaused(!paused)
                }
              }}
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
          <button
            type="button"
            disabled={deleting}
            onClick={async () => {
              if (!confirm("Disconnect this repository? This will remove all review data.")) return
              setDeleting(true)
              await fetch("/api/repositories", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ slug }),
              })
              router.push("/dashboard")
            }}
            className="inline-flex items-center gap-2 border border-destructive/50 px-4 py-2 text-xs tracking-wider uppercase text-destructive transition-colors hover:border-destructive hover:bg-destructive/10 disabled:pointer-events-none disabled:opacity-50"
          >
            <Trash2 className="size-3" />
            {deleting ? "Removing..." : "Disconnect"}
          </button>
        </div>
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
        <OverviewTab repo={repo} connectedDate={connectedDate} reviews={reviews} />
      )}
      {activeTab === "Interview" && (
        <InterviewTab status={repo.status} slug={slug} />
      )}
      {activeTab === "Review Persona" && <PersonaViewer persona={repo.persona_data?.persona} slug={slug} />}
      {activeTab === "Skills" && <SkillsTab slug={slug} />}
      {activeTab === "Activity" && <ActivityFeed reviews={reviews} />}
    </div>
  )
}

function OverviewTab({
  repo,
  connectedDate,
  reviews,
}: {
  repo: RepoData
  connectedDate: string
  reviews: ReviewRecord[]
}) {
  const totalReviews = reviews.length
  const totalComments = reviews.reduce((sum, r) => sum + (r.comment_count ?? 0), 0)
  const avgComments = totalReviews > 0 ? (totalComments / totalReviews).toFixed(1) : "0"

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
            <div className="text-sm text-foreground">{connectedDate}</div>
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
              {totalReviews}
            </div>
          </div>
          <div>
            <div className="mb-1 text-[10px] tracking-wider uppercase text-muted-foreground/60">
              Avg Comments / PR
            </div>
            <div className="text-2xl font-bold tabular-nums text-foreground">
              {avgComments}
            </div>
          </div>
          <div>
            <div className="mb-1 text-[10px] tracking-wider uppercase text-muted-foreground/60">
              Status
            </div>
            <div className="text-sm text-foreground">
              {repo.status === "interview"
                ? "Awaiting interview"
                : repo.status === "analyzing"
                  ? "Analyzing codebase"
                  : repo.status === "active"
                    ? "Active"
                    : "Paused"}
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
