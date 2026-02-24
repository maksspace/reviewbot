import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Refresh an expired GitHub OAuth token using the stored refresh token.
 *
 * GitHub expiring user tokens (opt-in on OAuth Apps) have:
 *   - Access token: 8 hours
 *   - Refresh token: 6 months
 *
 * Requires env vars: GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET
 *
 * @see https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/refreshing-user-access-tokens
 */
export async function refreshGitHubToken(
  refreshToken: string,
): Promise<{ access_token: string; refresh_token: string } | null> {
  const clientId = process.env.GITHUB_CLIENT_ID
  const clientSecret = process.env.GITHUB_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    console.error('[token] GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET not set — cannot refresh')
    return null
  }

  if (!refreshToken) {
    console.error('[token] no refresh token provided')
    return null
  }

  try {
    const res = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    })

    if (!res.ok) {
      console.error(`[token] GitHub refresh failed: ${res.status} ${res.statusText}`)
      return null
    }

    const data = await res.json() as Record<string, unknown>

    if (data.error) {
      console.error(`[token] GitHub refresh error: ${data.error} — ${data.error_description}`)
      return null
    }

    const newAccessToken = data.access_token as string
    const newRefreshToken = data.refresh_token as string

    if (!newAccessToken) {
      console.error('[token] no access_token in refresh response')
      return null
    }

    console.log('[token] GitHub token refreshed successfully')
    return {
      access_token: newAccessToken,
      refresh_token: newRefreshToken ?? refreshToken,
    }
  } catch (err) {
    console.error('[token] GitHub refresh request failed:', err)
    return null
  }
}

/**
 * Refresh an expired GitLab OAuth token using the stored refresh token.
 *
 * GitLab OAuth tokens expire after 2 hours.
 * Refresh tokens are valid until used or revoked.
 *
 * Requires env vars: GITLAB_CLIENT_ID, GITLAB_CLIENT_SECRET
 *
 * @see https://docs.gitlab.com/ee/api/oauth2.html#authorization-code-with-proof-key-for-code-exchange-pkce
 */
export async function refreshGitLabToken(
  refreshToken: string,
): Promise<{ access_token: string; refresh_token: string } | null> {
  const clientId = process.env.GITLAB_CLIENT_ID
  const clientSecret = process.env.GITLAB_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    console.error('[token] GITLAB_CLIENT_ID or GITLAB_CLIENT_SECRET not set — cannot refresh')
    return null
  }

  if (!refreshToken) {
    console.error('[token] no refresh token provided')
    return null
  }

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

    if (!res.ok) {
      console.error(`[token] GitLab refresh failed: ${res.status} ${res.statusText}`)
      return null
    }

    const data = await res.json() as Record<string, unknown>

    if (data.error) {
      console.error(`[token] GitLab refresh error: ${data.error} — ${data.error_description}`)
      return null
    }

    const newAccessToken = data.access_token as string
    const newRefreshToken = data.refresh_token as string

    if (!newAccessToken) {
      console.error('[token] no access_token in GitLab refresh response')
      return null
    }

    console.log('[token] GitLab token refreshed successfully')
    return {
      access_token: newAccessToken,
      refresh_token: newRefreshToken ?? refreshToken,
    }
  } catch (err) {
    console.error('[token] GitLab refresh request failed:', err)
    return null
  }
}

/** Refresh a provider token (GitHub or GitLab). */
function refreshProviderToken(
  provider: string,
  refreshToken: string,
): Promise<{ access_token: string; refresh_token: string } | null> {
  const p = provider.toLowerCase()
  if (p === 'github') return refreshGitHubToken(refreshToken)
  if (p === 'gitlab') return refreshGitLabToken(refreshToken)
  console.error(`[token] unsupported provider for refresh: ${provider}`)
  return Promise.resolve(null)
}

/**
 * Read the current provider token + refresh token from the DB for a repo.
 * Returns null if the repo is not found.
 */
export async function readProviderToken(
  supabase: SupabaseClient,
  userId: string,
  slug: string,
): Promise<{ provider_token: string; provider_refresh_token: string | null } | null> {
  const { data, error } = await supabase
    .from('connected_repositories')
    .select('provider_token, provider_refresh_token')
    .eq('user_id', userId)
    .eq('slug', slug)
    .single()

  if (error || !data) return null
  return {
    provider_token: data.provider_token,
    provider_refresh_token: data.provider_refresh_token,
  }
}

/**
 * Update the stored provider token (and optionally refresh token) in the DB.
 * Updates ALL rows for this user (same token applies to all repos).
 */
export async function updateProviderToken(
  supabase: SupabaseClient,
  userId: string,
  accessToken: string,
  refreshToken?: string,
): Promise<void> {
  const update: Record<string, unknown> = { provider_token: accessToken }
  if (refreshToken) {
    update.provider_refresh_token = refreshToken
  }

  const { error } = await supabase
    .from('connected_repositories')
    .update(update)
    .eq('user_id', userId)

  if (error) {
    console.error(`[token] failed to update tokens in DB:`, error.message)
  } else {
    console.log(`[token] updated tokens for user ${userId} (all repos)`)
  }
}

/**
 * Get a valid provider token for a repo, refreshing if needed.
 *
 * 1. Read the current token + refresh token from the DB (fresh, not from stale queue payload)
 * 2. Test the token with a lightweight GitHub API call
 * 3. If expired (401), try to refresh using the refresh token
 * 4. Update the DB with the new tokens
 * 5. Return the valid token or null if everything fails
 */
export async function getValidProviderToken(
  supabase: SupabaseClient,
  userId: string,
  slug: string,
  provider: string,
): Promise<string | null> {
  // Step 1: Read fresh from DB
  const tokens = await readProviderToken(supabase, userId, slug)

  if (!tokens?.provider_token) {
    console.error(`[token] no provider_token in DB for ${slug}`)
    return null
  }

  // Step 2: Test the token
  const isValid = await testToken(tokens.provider_token, provider)

  if (isValid) {
    return tokens.provider_token
  }

  console.log(`[token] token expired for ${slug} (${provider}), attempting refresh...`)

  // Step 3: Try to refresh
  if (!tokens.provider_refresh_token) {
    console.error(`[token] no refresh token stored for ${slug} — user needs to re-authenticate`)
    return null
  }

  const refreshed = await refreshProviderToken(provider, tokens.provider_refresh_token)

  if (!refreshed) {
    console.error(`[token] refresh failed for ${slug} — user needs to re-authenticate`)
    return null
  }

  // Step 4: Update DB with new tokens (for ALL repos of this user)
  await updateProviderToken(supabase, userId, refreshed.access_token, refreshed.refresh_token)

  return refreshed.access_token
}

/**
 * Quick test: call the GitHub/GitLab API with the token.
 * Returns true if the token is still valid, false if expired.
 */
async function testToken(token: string, provider: string): Promise<boolean> {
  try {
    if (provider.toLowerCase() === 'gitlab') {
      const res = await fetch('https://gitlab.com/api/v4/user', {
        headers: { Authorization: `Bearer ${token}` },
      })
      return res.ok
    }

    // GitHub
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
