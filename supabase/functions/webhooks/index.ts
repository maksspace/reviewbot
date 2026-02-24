import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WebhookEventPayload {
  repo_slug: string
  repo_name: string
  provider: "github" | "gitlab"
  event_type: "pr_opened" | "pr_updated" | "pr_closed" | "pr_reopened"
  pr_number: number
  pr_title: string
  pr_url: string
  pr_author: string
  base_branch: string
  head_branch: string
  action: string
  user_id: string
  received_at: string
}

// GitHub PR actions we care about
const GITHUB_PR_ACTIONS = new Set(["opened", "synchronize", "reopened", "closed"])

// GitLab MR actions we care about
const GITLAB_MR_ACTIONS = new Set(["open", "update", "reopen", "close", "merge"])

const QUEUE_NAME = "webhook_events"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  )
}

async function verifyGitHubSignature(
  payload: string,
  signature: string | null,
  secret: string,
): Promise<boolean> {
  if (!signature?.startsWith("sha256=")) return false

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )

  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  )

  const expected =
    "sha256=" +
    Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")

  // Constant-time comparison via subtle
  if (signature.length !== expected.length) return false

  const a = new TextEncoder().encode(signature)
  const b = new TextEncoder().encode(expected)
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i]
  }
  return diff === 0
}

function verifyGitLabToken(token: string | null, secret: string): boolean {
  if (!token || !secret) return false
  if (token.length !== secret.length) return false

  const a = new TextEncoder().encode(token)
  const b = new TextEncoder().encode(secret)
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i]
  }
  return diff === 0
}

async function enqueueEvent(payload: WebhookEventPayload): Promise<void> {
  const admin = getSupabaseAdmin()
  const { error } = await admin.schema("pgmq_public").rpc("send", {
    queue_name: QUEUE_NAME,
    message: payload,
    sleep_seconds: 0,
  })

  if (error) {
    console.error(`[webhook] queue send failed for ${payload.repo_slug}:`, error.message)
    throw new Error(`Queue send failed: ${error.message}`)
  }

  console.log(
    `[webhook] enqueued ${payload.event_type} for ${payload.repo_slug} PR #${payload.pr_number} (user: ${payload.user_id})`,
  )
}

function mapGitHubAction(action: string): WebhookEventPayload["event_type"] {
  switch (action) {
    case "opened":
      return "pr_opened"
    case "synchronize":
      return "pr_updated"
    case "reopened":
      return "pr_reopened"
    case "closed":
      return "pr_closed"
    default:
      return "pr_opened"
  }
}

function mapGitLabAction(action: string): WebhookEventPayload["event_type"] {
  switch (action) {
    case "open":
      return "pr_opened"
    case "update":
      return "pr_updated"
    case "reopen":
      return "pr_reopened"
    case "close":
    case "merge":
      return "pr_closed"
    default:
      return "pr_opened"
  }
}

// ---------------------------------------------------------------------------
// GitHub handler
// ---------------------------------------------------------------------------

async function handleGitHub(
  req: Request,
  rawBody: string,
  event: string,
): Promise<Response> {
  // Only handle pull_request events
  if (event !== "pull_request") {
    return json({ ok: true, skipped: true, reason: `event: ${event}` })
  }

  // Verify signature
  const secret = Deno.env.get("GITHUB_WEBHOOK_SECRET")
  if (!secret) {
    console.error("[webhook] GITHUB_WEBHOOK_SECRET not set")
    return json({ error: "Webhook not configured" }, 500)
  }

  const signature = req.headers.get("x-hub-signature-256")
  const valid = await verifyGitHubSignature(rawBody, signature, secret)
  if (!valid) {
    console.warn("[webhook] invalid GitHub signature")
    return json({ error: "Invalid signature" }, 401)
  }

  // Parse body
  let body: Record<string, unknown>
  try {
    body = JSON.parse(rawBody)
  } catch {
    return json({ error: "Invalid JSON" }, 400)
  }

  const action = body.action as string
  if (!GITHUB_PR_ACTIONS.has(action)) {
    return json({ ok: true, skipped: true, reason: `action: ${action}` })
  }

  // Extract repo name
  const repository = body.repository as Record<string, unknown> | undefined
  const repoFullName = repository?.full_name as string | undefined
  if (!repoFullName) {
    return json({ error: "Missing repository.full_name" }, 400)
  }

  // Look up all connected repos with this name
  const admin = getSupabaseAdmin()
  const { data: repos, error: lookupError } = await admin
    .from("connected_repositories")
    .select("user_id, slug, name, provider, status")
    .eq("name", repoFullName)

  if (lookupError) {
    console.error("[webhook] repo lookup failed:", lookupError.message)
    return json({ error: "Lookup failed" }, 500)
  }

  if (!repos || repos.length === 0) {
    return json({ error: "Repository not connected" }, 404)
  }

  // Enqueue for each connected user (skip paused repos)
  const pr = body.pull_request as Record<string, unknown>
  const prUser = pr?.user as Record<string, unknown> | undefined
  const prBase = pr?.base as Record<string, unknown> | undefined
  const prHead = pr?.head as Record<string, unknown> | undefined

  let queued = 0
  for (const repo of repos) {
    if (repo.status === "paused") continue

    const payload: WebhookEventPayload = {
      repo_slug: repo.slug,
      repo_name: repo.name,
      provider: "github",
      event_type: mapGitHubAction(action),
      pr_number: (pr?.number as number) ?? 0,
      pr_title: (pr?.title as string) ?? "",
      pr_url: (pr?.html_url as string) ?? "",
      pr_author: (prUser?.login as string) ?? "unknown",
      base_branch: (prBase?.ref as string) ?? "",
      head_branch: (prHead?.ref as string) ?? "",
      action,
      user_id: repo.user_id,
      received_at: new Date().toISOString(),
    }

    try {
      await enqueueEvent(payload)
      queued++
    } catch (err) {
      console.error(`[webhook] failed to enqueue for user ${repo.user_id}:`, err)
    }
  }

  return json({ ok: true, queued: queued > 0, count: queued })
}

// ---------------------------------------------------------------------------
// GitLab handler
// ---------------------------------------------------------------------------

async function handleGitLab(
  req: Request,
  rawBody: string,
  event: string,
): Promise<Response> {
  // Only handle Merge Request Hook events
  if (event !== "Merge Request Hook") {
    return json({ ok: true, skipped: true, reason: `event: ${event}` })
  }

  // Parse body first — we need the project path to look up the per-repo secret
  let body: Record<string, unknown>
  try {
    body = JSON.parse(rawBody)
  } catch {
    return json({ error: "Invalid JSON" }, 400)
  }

  const objectAttributes = body.object_attributes as Record<string, unknown> | undefined
  const action = objectAttributes?.action as string
  if (!action || !GITLAB_MR_ACTIONS.has(action)) {
    return json({ ok: true, skipped: true, reason: `action: ${action}` })
  }

  // Extract repo name
  const project = body.project as Record<string, unknown> | undefined
  const repoFullName = project?.path_with_namespace as string | undefined
  if (!repoFullName) {
    return json({ error: "Missing project.path_with_namespace" }, 400)
  }

  // Look up all connected repos with this name (includes per-repo webhook_secret)
  const admin = getSupabaseAdmin()

  console.log(`[webhook] GitLab MR event: project="${repoFullName}", action="${action}"`)

  const { data: repos, error: lookupError } = await admin
    .from("connected_repositories")
    .select("user_id, slug, name, provider, status, webhook_secret")
    .eq("name", repoFullName)

  if (lookupError) {
    console.error("[webhook] repo lookup failed:", lookupError.message)
    return json({ error: "Lookup failed" }, 500)
  }

  if (!repos || repos.length === 0) {
    console.warn("[webhook] no connected repo found for GitLab project:", repoFullName)
    return json({ error: "Repository not connected" }, 404)
  }

  console.log(`[webhook] found ${repos.length} connected repo(s) for "${repoFullName}"`)
  for (const r of repos) {
    const hasSecret = !!r.webhook_secret
    const secretPreview = hasSecret ? (r.webhook_secret as string).slice(0, 8) + "..." : "(none)"
    console.log(`[webhook]   repo="${r.slug}" user="${r.user_id}" status="${r.status}" secret=${secretPreview}`)
  }

  // Verify X-Gitlab-Token against the per-repo webhook_secret.
  // Each repo row has its own secret (created when the webhook was registered).
  // If multiple users connected the same project, accept if ANY secret matches.
  const incomingToken = req.headers.get("x-gitlab-token")
  const hasIncomingToken = !!incomingToken
  const incomingPreview = incomingToken ? incomingToken.slice(0, 8) + "..." : "(none)"
  console.log(`[webhook] X-Gitlab-Token present=${hasIncomingToken} preview=${incomingPreview}`)

  const verified = repos.some((r) => {
    const secret = r.webhook_secret as string | null
    if (!secret) {
      console.log(`[webhook]   repo="${r.slug}" — no webhook_secret in DB, skip`)
      return false
    }
    const match = verifyGitLabToken(incomingToken, secret)
    console.log(`[webhook]   repo="${r.slug}" — token match=${match}`)
    return match
  })

  if (!verified) {
    console.warn(`[webhook] token verification FAILED for "${repoFullName}"`)
    console.warn(`[webhook]   incoming token length=${incomingToken?.length ?? 0}`)
    console.warn(`[webhook]   stored secrets: ${repos.map((r) => r.webhook_secret ? (r.webhook_secret as string).length : 0).join(", ")}`)
    return json({ error: "Invalid token" }, 401)
  }

  console.log(`[webhook] token verified for "${repoFullName}"`)


  // Enqueue for each connected user (skip paused repos)
  const user = body.user as Record<string, unknown> | undefined

  let queued = 0
  for (const repo of repos) {
    if (repo.status === "paused") continue

    const payload: WebhookEventPayload = {
      repo_slug: repo.slug,
      repo_name: repo.name,
      provider: "gitlab",
      event_type: mapGitLabAction(action),
      pr_number: (objectAttributes?.iid as number) ?? 0,
      pr_title: (objectAttributes?.title as string) ?? "",
      pr_url: (objectAttributes?.url as string) ?? "",
      pr_author: (user?.username as string) ?? "unknown",
      base_branch: (objectAttributes?.target_branch as string) ?? "",
      head_branch: (objectAttributes?.source_branch as string) ?? "",
      action,
      user_id: repo.user_id,
      received_at: new Date().toISOString(),
    }

    try {
      await enqueueEvent(payload)
      queued++
    } catch (err) {
      console.error(`[webhook] failed to enqueue for user ${repo.user_id}:`, err)
    }
  }

  return json({ ok: true, queued: queued > 0, count: queued })
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405)
  }

  try {
    const rawBody = await req.text()
    const githubEvent = req.headers.get("x-github-event")
    const gitlabEvent = req.headers.get("x-gitlab-event")

    console.log(rawBody);

    if (githubEvent) return await handleGitHub(req, rawBody, githubEvent)
    if (gitlabEvent) return await handleGitLab(req, rawBody, gitlabEvent)

    return json({ error: "Unknown webhook source — expected X-GitHub-Event or X-Gitlab-Event header" }, 400)
  } catch (err) {
    console.error("[webhook] unhandled error:", err)
    return json({ error: "Internal error" }, 500)
  }
})
