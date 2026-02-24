import type { SupabaseClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Token column mapping
// ---------------------------------------------------------------------------

function tokenColumns(provider: string) {
  const p = provider.toLowerCase()
  if (p === 'github') return { token: 'github_token', refresh: 'github_refresh_token' } as const
  if (p === 'gitlab') return { token: 'gitlab_token', refresh: 'gitlab_refresh_token' } as const
  throw new Error(`Unsupported provider: ${provider}`)
}

// ---------------------------------------------------------------------------
// Read / Save
// ---------------------------------------------------------------------------

export async function getProviderTokens(
  supabase: SupabaseClient,
  userId: string,
  provider: string,
): Promise<{ token: string | null; refreshToken: string | null }> {
  const cols = tokenColumns(provider)

  const { data } = await supabase
    .from('user_settings')
    .select(`${cols.token}, ${cols.refresh}`)
    .eq('user_id', userId)
    .single()

  if (!data) return { token: null, refreshToken: null }

  return {
    token: (data as Record<string, string | null>)[cols.token] ?? null,
    refreshToken: (data as Record<string, string | null>)[cols.refresh] ?? null,
  }
}

export async function saveProviderTokens(
  supabase: SupabaseClient,
  userId: string,
  provider: string,
  accessToken: string,
  refreshToken?: string | null,
): Promise<void> {
  const cols = tokenColumns(provider)

  const row: Record<string, unknown> = {
    user_id: userId,
    [cols.token]: accessToken,
  }
  if (refreshToken) {
    row[cols.refresh] = refreshToken
  }

  const { error } = await supabase
    .from('user_settings')
    .upsert(row, { onConflict: 'user_id' })

  if (error) {
    console.error(`[provider-token] failed to save ${provider} tokens:`, error.message)
  }
}

// ---------------------------------------------------------------------------
// Token validation
// ---------------------------------------------------------------------------

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

function testToken(token: string, provider: string): Promise<boolean> {
  return provider.toLowerCase() === 'gitlab'
    ? testGitLabToken(token)
    : testGitHubToken(token)
}

// ---------------------------------------------------------------------------
// Token refresh
// ---------------------------------------------------------------------------

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

function refreshProviderToken(
  provider: string,
  refreshToken: string,
): Promise<{ access_token: string; refresh_token: string } | null> {
  return provider.toLowerCase() === 'gitlab'
    ? refreshGitLabToken(refreshToken)
    : refreshGitHubToken(refreshToken)
}

// ---------------------------------------------------------------------------
// Main entry point: get a valid token, refreshing if needed
// ---------------------------------------------------------------------------

export async function getValidProviderToken(
  supabase: SupabaseClient,
  userId: string,
  provider: string,
): Promise<string | null> {
  const { token, refreshToken } = await getProviderTokens(supabase, userId, provider)

  if (!token) {
    console.error(`[provider-token] no ${provider} token in user_settings for user ${userId}`)
    return null
  }

  const valid = await testToken(token, provider)
  if (valid) return token

  console.log(`[provider-token] ${provider} token expired for user ${userId}, refreshing...`)

  if (!refreshToken) {
    console.error(`[provider-token] no refresh token for ${provider} — user needs to re-authenticate`)
    return null
  }

  const refreshed = await refreshProviderToken(provider, refreshToken)
  if (!refreshed) {
    console.error(`[provider-token] ${provider} refresh failed — user needs to re-authenticate`)
    return null
  }

  await saveProviderTokens(supabase, userId, provider, refreshed.access_token, refreshed.refresh_token)
  console.log(`[provider-token] ${provider} token refreshed for user ${userId}`)

  return refreshed.access_token
}
