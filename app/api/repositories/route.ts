import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { randomBytes } from 'crypto'
import { createClient } from '@/lib/supabase/server'
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
// Token validation + refresh helpers
// ---------------------------------------------------------------------------

/** Test a GitHub token with a lightweight API call. */
async function testGitHubToken(token: string): Promise<boolean> {
  try {
    const res = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    })
    return res.ok
  } catch {
    return false
  }
}

/** Test a GitLab token with a lightweight API call. */
async function testGitLabToken(token: string): Promise<boolean> {
  try {
    const res = await fetch('https://gitlab.com/api/v4/user', {
      headers: { Authorization: `Bearer ${token}` },
    })
    return res.ok
  } catch {
    return false
  }
}

/**
 * Try to refresh a GitHub OAuth token using the refresh token.
 * Returns the new access_token + refresh_token, or null on failure.
 */
async function refreshGitHubToken(
  refreshToken: string,
): Promise<{ access_token: string; refresh_token: string } | null> {
  const clientId = process.env.GITHUB_CLIENT_ID
  const clientSecret = process.env.GITHUB_CLIENT_SECRET

  if (!clientId || !clientSecret || !refreshToken) return null

  try {
    const res = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    })

    if (!res.ok) return null

    const data = await res.json() as Record<string, unknown>
    if (data.error || !data.access_token) return null

    return {
      access_token: data.access_token as string,
      refresh_token: (data.refresh_token as string) ?? refreshToken,
    }
  } catch {
    return null
  }
}

/**
 * Try to refresh a GitLab OAuth token using the refresh token.
 * GitLab OAuth tokens expire after 2 hours. Refresh tokens are valid for longer.
 *
 * Requires env vars: GITLAB_CLIENT_ID, GITLAB_CLIENT_SECRET
 */
async function refreshGitLabToken(
  refreshToken: string,
): Promise<{ access_token: string; refresh_token: string } | null> {
  const clientId = process.env.GITLAB_CLIENT_ID
  const clientSecret = process.env.GITLAB_CLIENT_SECRET

  if (!clientId || !clientSecret || !refreshToken) return null

  try {
    const res = await fetch('https://gitlab.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    })

    if (!res.ok) return null

    const data = await res.json() as Record<string, unknown>
    if (data.error || !data.access_token) return null

    return {
      access_token: data.access_token as string,
      refresh_token: (data.refresh_token as string) ?? refreshToken,
    }
  } catch {
    return null
  }
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

/** Refresh a provider token (GitHub or GitLab). */
async function refreshProviderToken(
  provider: string,
  refreshToken: string,
): Promise<{ access_token: string; refresh_token: string } | null> {
  if (provider === 'github') return refreshGitHubToken(refreshToken)
  if (provider === 'gitlab') return refreshGitLabToken(refreshToken)
  return null
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

  const cookieStore = await cookies()
  let providerToken = cookieStore.get('provider_token')?.value ?? ''
  let providerRefreshToken = cookieStore.get('provider_refresh_token')?.value ?? ''

  const body = await request.json()
  const repos: { slug: string; name: string; provider: string }[] = body.repos

  if (!repos?.length) {
    return NextResponse.json({ error: 'No repos provided' }, { status: 400 })
  }

  if (!providerToken) {
    return NextResponse.json(
      { error: 'No provider token. Please sign out and sign in again.' },
      { status: 401 },
    )
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
  // Validate the token before storing — fail fast if expired
  // -------------------------------------------------------------------------

  const provider = repos[0].provider?.toLowerCase()
  const isGitHub = provider === 'github'
  const tokenValid = isGitHub
    ? await testGitHubToken(providerToken)
    : await testGitLabToken(providerToken)

  const providerLabel = isGitHub ? 'GitHub' : 'GitLab'

  if (!tokenValid) {
    console.log(`[repositories] ${providerLabel} token expired, attempting refresh...`)

    if (providerRefreshToken) {
      const refreshed = await refreshProviderToken(provider, providerRefreshToken)

      if (refreshed) {
        providerToken = refreshed.access_token
        providerRefreshToken = refreshed.refresh_token
        console.log(`[repositories] ${providerLabel} token refreshed successfully`)
      } else {
        console.log(`[repositories] ${providerLabel} refresh failed`)
        return NextResponse.json(
          { error: 'token_expired', message: `Your ${providerLabel} session has expired. Please sign out and sign in again.` },
          { status: 401 },
        )
      }
    } else {
      return NextResponse.json(
        { error: 'token_expired', message: `Your ${providerLabel} session has expired. Please sign out and sign in again.` },
        { status: 401 },
      )
    }
  }

  // -------------------------------------------------------------------------
  // Store repos + enqueue analysis
  // -------------------------------------------------------------------------

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

  const rows = repos.map((r) => {
    const wh = webhookData.get(r.slug)
    return {
      user_id: user.id,
      slug: r.slug,
      name: r.name,
      provider: r.provider,
      status: 'analyzing',
      provider_token: providerToken,
      provider_refresh_token: providerRefreshToken || null,
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
        provider_token: providerToken,
      },
      sleep_seconds: 0,
    })
    console.log(`[queue] enqueue ${r.slug}:`, queueData, queueError)
    if (queueError) {
      console.error(`[queue] failed to enqueue ${r.slug}:`, queueError.message)
    }
  }

  // Build response — update cookies if token was refreshed
  const response = NextResponse.json({ ok: true, connected: repos.length })

  if (tokenValid === false) {
    // Token was refreshed — update the cookies
    response.cookies.set('provider_token', providerToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    })
    if (providerRefreshToken) {
      response.cookies.set('provider_refresh_token', providerRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
      })
    }
  }

  return response
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

  // Fetch repo info before deleting — need hook_id + token for GitLab cleanup
  const { data: repo } = await supabase
    .from('connected_repositories')
    .select('name, provider, provider_token, webhook_hook_id')
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
  if (repo?.provider?.toLowerCase() === 'gitlab' && repo.webhook_hook_id && repo.provider_token) {
    deleteGitLabWebhook(repo.name, repo.webhook_hook_id, repo.provider_token).catch(() => {})
  }

  return NextResponse.json({ ok: true })
}
