import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { randomBytes } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { getValidProviderToken } from '@/lib/provider-token'
import { FREE_LIMITS } from '@/lib/stripe'

const WEBHOOK_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/webhooks`
  : ''

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('connected_repositories')
    .select('slug, name, provider, status, connected_at')
    .eq('user_id', user.id)
    .order('connected_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const repos = (data ?? []).map((r) => ({
    slug: r.slug,
    name: r.name,
    provider: r.provider as 'GitHub' | 'GitLab',
    status: r.status as 'active' | 'interview' | 'analyzing' | 'paused',
    reviews: null,
    lastReview: null,
  }))

  return NextResponse.json(repos)
}

// ---------------------------------------------------------------------------
// GitLab webhook helpers
// ---------------------------------------------------------------------------

/**
 * Create a webhook on a GitLab project so we receive MR events.
 * Returns the hook ID from GitLab, or null on failure.
 */
async function createGitLabWebhook(
  projectPath: string,
  token: string,
  secret: string,
): Promise<number | null> {
  if (!WEBHOOK_URL) {
    console.error('[repositories] WEBHOOK_URL not configured, skipping webhook creation')
    return null
  }

  const encoded = encodeURIComponent(projectPath)
  try {
    const res = await fetch(`https://gitlab.com/api/v4/projects/${encoded}/hooks`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'reviewbot',
        description: 'AI code review by reviewbot.sh',
        url: WEBHOOK_URL,
        token: secret,
        merge_requests_events: true,
        note_events: true,
        push_events: false,
        enable_ssl_verification: true,
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      console.error(`[repositories] GitLab webhook creation failed (${res.status}):`, body)
      return null
    }

    const data = await res.json()
    console.log(`[repositories] GitLab webhook created for ${projectPath}, hook_id=${data.id}`)
    return data.id as number
  } catch (err) {
    console.error('[repositories] GitLab webhook creation error:', err)
    return null
  }
}

/**
 * Delete a webhook from a GitLab project.
 */
async function deleteGitLabWebhook(
  projectPath: string,
  hookId: number,
  token: string,
): Promise<void> {
  const encoded = encodeURIComponent(projectPath)
  try {
    const res = await fetch(
      `https://gitlab.com/api/v4/projects/${encoded}/hooks/${hookId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      },
    )
    // 204 = success, 404 = already gone
    if (res.ok || res.status === 404) {
      console.log(`[repositories] GitLab webhook deleted for ${projectPath}, hook_id=${hookId}`)
    } else {
      const body = await res.text()
      console.error(`[repositories] GitLab webhook delete failed (${res.status}):`, body)
    }
  } catch (err) {
    console.error('[repositories] GitLab webhook delete error:', err)
  }
}

// ---------------------------------------------------------------------------
// GitLab bot membership helper
// ---------------------------------------------------------------------------

/**
 * GitLab bot user ID.
 * Always invite the bot — the ID is known. No need to check GITLAB_BOT_TOKEN
 * (that env var lives on the worker, not the Next.js app).
 */
const GITLAB_BOT_USER_ID = Number(process.env.GITLAB_BOT_USER_ID) || 34875823

/**
 * Invite the GitLab bot account to a project as Developer (access_level=30).
 * Uses the connecting user's token (they have Maintainer/Owner access).
 * Silently skips if bot is already a member.
 */
async function inviteGitLabBotToProject(
  projectPath: string,
  userToken: string,
): Promise<void> {
  const encoded = encodeURIComponent(projectPath)
  console.log(`[repositories] inviting bot (user_id=${GITLAB_BOT_USER_ID}) to ${projectPath}...`)
  try {
    const res = await fetch(`https://gitlab.com/api/v4/projects/${encoded}/members`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${userToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: GITLAB_BOT_USER_ID,
        access_level: 30, // Developer
      }),
    })

    if (res.ok) {
      console.log(`[repositories] invited bot to ${projectPath} as Developer`)
    } else if (res.status === 409) {
      console.log(`[repositories] bot already a member of ${projectPath}`)
    } else {
      const body = await res.text()
      console.warn(`[repositories] failed to invite bot to ${projectPath} (${res.status}): ${body}`)
    }
  } catch (err) {
    console.warn(`[repositories] bot invite error for ${projectPath}:`, err)
  }
}

// ---------------------------------------------------------------------------
// POST — connect repos
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const repos: { slug: string; name: string; provider: string }[] = body.repos

  if (!repos?.length) {
    return NextResponse.json({ error: 'No repos provided' }, { status: 400 })
  }

  // -------------------------------------------------------------------------
  // Check subscription repo limit
  // -------------------------------------------------------------------------

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('plan, status')
    .eq('user_id', user.id)
    .single()

  const isPro = sub?.plan === 'pro' && sub?.status === 'active'

  if (!isPro) {
    const { count: currentRepos } = await supabase
      .from('connected_repositories')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    if ((currentRepos ?? 0) + repos.length > FREE_LIMITS.repos) {
      return NextResponse.json(
        { error: 'plan_limit', message: `Free plan allows ${FREE_LIMITS.repos} repository. Upgrade to Pro for unlimited.` },
        { status: 403 },
      )
    }
  }

  // -------------------------------------------------------------------------
  // Get a valid provider token from user_settings (auto-refreshes if expired)
  // -------------------------------------------------------------------------

  const provider = repos[0].provider?.toLowerCase()
  const isGitHub = provider === 'github'
  const providerLabel = isGitHub ? 'GitHub' : 'GitLab'

  const providerToken = await getValidProviderToken(supabase, user.id, provider)

  if (!providerToken) {
    return NextResponse.json(
      { error: 'token_expired', message: `Your ${providerLabel} session has expired. Please sign out and sign in again.` },
      { status: 401 },
    )
  }

  // -------------------------------------------------------------------------
  // For GitLab repos: create webhooks so we receive MR events
  // -------------------------------------------------------------------------

  const isGitLab = !isGitHub
  const webhookData: Map<string, { hook_id: number | null; secret: string }> = new Map()

  if (isGitLab) {
    for (const r of repos) {
      // Invite bot account so it can post review comments
      await inviteGitLabBotToProject(r.name, providerToken)

      const secret = randomBytes(32).toString('hex')
      const hookId = await createGitLabWebhook(r.name, providerToken, secret)
      webhookData.set(r.slug, { hook_id: hookId, secret })
    }
  }

  // -------------------------------------------------------------------------
  // Store repos + enqueue analysis
  // -------------------------------------------------------------------------

  const rows = repos.map((r) => {
    const wh = webhookData.get(r.slug)
    return {
      user_id: user.id,
      slug: r.slug,
      name: r.name,
      provider: r.provider,
      status: 'analyzing',
      ...(wh ? { webhook_hook_id: wh.hook_id, webhook_secret: wh.secret } : {}),
    }
  })

  const { error } = await supabase
    .from('connected_repositories')
    .upsert(rows, { onConflict: 'user_id,slug' })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Push each repo to the analysis queue via pgmq
  const pgmq = supabase.schema('pgmq_public')
  for (const r of repos) {
    const { data: queueData, error: queueError } = await pgmq.rpc('send', {
      queue_name: 'repo_analysis',
      message: {
        user_id: user.id,
        slug: r.slug,
        name: r.name,
        provider: r.provider,
      },
      sleep_seconds: 0,
    })
    console.log(`[queue] enqueue ${r.slug}:`, queueData, queueError)
    if (queueError) {
      console.error(`[queue] failed to enqueue ${r.slug}:`, queueError.message)
    }
  }

  return NextResponse.json({ ok: true, connected: repos.length })
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { slug } = await request.json()

  if (!slug) {
    return NextResponse.json({ error: 'No slug provided' }, { status: 400 })
  }

  // Fetch repo info before deleting — need hook_id for GitLab cleanup
  const { data: repo } = await supabase
    .from('connected_repositories')
    .select('name, provider, webhook_hook_id')
    .eq('user_id', user.id)
    .eq('slug', slug)
    .single()

  // Delete from DB first
  const { error } = await supabase
    .from('connected_repositories')
    .delete()
    .eq('user_id', user.id)
    .eq('slug', slug)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Clean up GitLab webhook (best-effort, don't fail the request)
  if (repo?.provider?.toLowerCase() === 'gitlab' && repo.webhook_hook_id) {
    const gitlabToken = await getValidProviderToken(supabase, user.id, 'gitlab')
    if (gitlabToken) {
      deleteGitLabWebhook(repo.name, repo.webhook_hook_id, gitlabToken).catch(() => {})
    }
  }

  return NextResponse.json({ ok: true })
}
