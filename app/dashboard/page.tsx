import { createClient } from "@/lib/supabase/server"
import { RepoTable, type Repo } from "@/components/repo-table"
import { RepoPicker } from "@/components/repo-picker"

async function getDashboardData(): Promise<{ repos: Repo[]; provider: "github" | "gitlab" }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { repos: [], provider: "github" }

  // Determine which provider was used most recently.
  // app_metadata.provider is the FIRST provider ever (not current),
  // so check identities sorted by last_sign_in_at.
  let provider: "github" | "gitlab" = "github"
  const identities = user.identities ?? []
  if (identities.length > 0) {
    const sorted = [...identities].sort((a, b) =>
      new Date(b.last_sign_in_at ?? 0).getTime() - new Date(a.last_sign_in_at ?? 0).getTime()
    )
    provider = (sorted[0].provider === "gitlab" ? "gitlab" : "github")
  }

  const { data, error } = await supabase
    .from("connected_repositories")
    .select("slug, name, provider, status, connected_at")
    .eq("user_id", user.id)
    .order("connected_at", { ascending: false })

  if (error || !data) return { repos: [], provider }

  // Fetch review stats per repo
  const { data: reviewStats } = await supabase
    .from("reviews")
    .select("repo_slug, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  const statsByRepo = new Map<string, { count: number; lastReview: string }>()
  for (const r of reviewStats ?? []) {
    const existing = statsByRepo.get(r.repo_slug)
    if (existing) {
      existing.count++
    } else {
      statsByRepo.set(r.repo_slug, { count: 1, lastReview: r.created_at })
    }
  }

  const repos = data.map((r) => {
    const stats = statsByRepo.get(r.slug)
    return {
      slug: r.slug,
      name: r.name,
      provider: r.provider as "GitHub" | "GitLab",
      status: r.status as "active" | "interview" | "analyzing" | "paused",
      reviews: stats?.count ?? null,
      lastReview: stats?.lastReview ?? null,
    }
  })

  return { repos, provider }
}

export default async function DashboardPage() {
  const { repos, provider } = await getDashboardData()

  return (
    <div>
      <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground">
            Your Repositories
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Manage connected repos and review personas.
          </p>
        </div>
        <RepoPicker connectedSlugs={repos.map((r) => r.slug)} provider={provider} />
      </div>

      <RepoTable repos={repos} />
    </div>
  )
}
