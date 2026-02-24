"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Search, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"

interface ProviderRepo {
  slug: string
  name: string
  provider: string
  language: string | null
  private: boolean
  description: string | null
}

export function RepoPicker({
  connectedSlugs,
  provider = "github",
}: {
  connectedSlugs: string[]
  provider?: "github" | "gitlab"
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [repos, setRepos] = useState<ProviderRepo[]>([])
  const [loading, setLoading] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [connectError, setConnectError] = useState("")
  const [atRepoLimit, setAtRepoLimit] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setSearch("")
    setSelected(new Set())
    setConnectError("")
    setAtRepoLimit(false)

    const endpoint = provider === "gitlab" ? "/api/gitlab/repos" : "/api/github/repos"
    Promise.all([
      fetch(endpoint).then((r) => r.json()),
      fetch("/api/subscription").then((r) => r.json()),
    ]).then(([repoData, sub]) => {
      if (Array.isArray(repoData)) {
        setRepos(repoData)
      }
      // Check if at repo limit (free plan)
      if (!sub.error && sub.reposLimit !== null && sub.reposUsed >= sub.reposLimit) {
        setAtRepoLimit(true)
      }
    }).finally(() => setLoading(false))
  }, [open, provider])

  const connectedSet = useMemo(() => new Set(connectedSlugs), [connectedSlugs])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return repos
      .filter((r) => !connectedSet.has(r.slug))
      .filter((r) => !q || r.name.toLowerCase().includes(q))
  }, [repos, search, connectedSet])

  const toggle = (slug: string) => {
    if (atRepoLimit) return
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(slug)) next.delete(slug)
      else next.add(slug)
      return next
    })
  }

  const handleConnect = async () => {
    if (selected.size === 0) return
    setConnecting(true)
    setConnectError("")

    const toConnect = repos
      .filter((r) => selected.has(r.slug))
      .map((r) => ({ slug: r.slug, name: r.name, provider: r.provider }))

    const res = await fetch("/api/repositories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repos: toConnect }),
    })

    const data = await res.json()

    if (!res.ok) {
      setConnecting(false)
      if (data.error === "plan_limit") {
        setAtRepoLimit(true)
        setConnectError(data.message)
      } else if (data.error === "token_expired") {
        setConnectError(data.message ?? "Your session has expired. Please sign out and sign in again.")
      } else {
        setConnectError(data.error ?? "Failed to connect repositories.")
      }
      return
    }

    setConnecting(false)
    setOpen(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center border border-terminal px-5 py-2.5 text-xs tracking-wider uppercase text-terminal transition-colors hover:bg-terminal hover:text-background"
      >
        Connect Repository
      </button>

      <DialogContent className="overflow-hidden border-border bg-background sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold tracking-wider uppercase">
            Connect Repositories
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Select repositories to connect to ReviewBot.
          </DialogDescription>
        </DialogHeader>

        {atRepoLimit && (
          <div className="border border-terminal/30 px-4 py-3">
            <p className="mb-2 text-xs text-foreground">
              Free plan allows 1 repository. Upgrade to Pro for unlimited.
            </p>
            <Link
              href="/dashboard/settings"
              onClick={() => setOpen(false)}
              className="text-xs font-bold tracking-wider uppercase text-terminal hover:underline"
            >
              Upgrade to Pro — $9/mo
            </Link>
          </div>
        )}

        {!atRepoLimit && (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search repositories..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 w-full border border-border bg-transparent pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-terminal focus:outline-none"
              />
            </div>

            <ScrollArea className="h-[320px]">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-xs text-muted-foreground">
                    Loading repositories...
                  </span>
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  {search
                    ? "No matching repositories."
                    : "All repositories are already connected."}
                </div>
              ) : (
                <div className="flex flex-col">
                  {filtered.map((repo) => (
                    <button
                      key={repo.slug}
                      type="button"
                      onClick={() => toggle(repo.slug)}
                      className="flex w-full items-center gap-3 overflow-hidden border-b border-border px-1 py-3 text-left transition-colors hover:bg-surface-hover"
                    >
                      <Checkbox
                        checked={selected.has(repo.slug)}
                        onCheckedChange={() => toggle(repo.slug)}
                        className="pointer-events-none shrink-0"
                      />
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <span className="block truncate text-sm text-foreground">
                          {repo.name}
                        </span>
                        {repo.description && (
                          <span className="text-xs text-muted-foreground line-clamp-1 max-w-[70%]">
                            {repo.description.length > 60
                              ? repo.description.slice(0, 60) + "..."
                              : repo.description}
                          </span>
                        )}
                      </div>
                      {repo.language && (
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {repo.language}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </>
        )}

        {connectError && !atRepoLimit && (
          <div className="border border-destructive/30 px-4 py-3">
            <p className="text-xs text-destructive">{connectError}</p>
          </div>
        )}

        <DialogFooter>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="px-4 py-2 text-xs tracking-wider uppercase text-muted-foreground transition-colors hover:text-foreground"
          >
            Cancel
          </button>
          {!atRepoLimit && (
            <button
              type="button"
              disabled={selected.size === 0 || connecting}
              onClick={handleConnect}
              className="border border-terminal px-5 py-2 text-xs tracking-wider uppercase text-terminal transition-colors hover:bg-terminal hover:text-background disabled:pointer-events-none disabled:opacity-50"
            >
              {connecting
                ? "Connecting..."
                : `Connect ${selected.size > 0 ? selected.size : ""} ${selected.size === 1 ? "repo" : "repos"}`}
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
