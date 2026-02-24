import { createSign } from 'node:crypto'

/**
 * GitHub App authentication for posting reviews as "reviewbot[bot]".
 *
 * Without this, reviews are posted using the user's OAuth token and appear
 * as comments from the user — not from the bot.
 *
 * Requires env vars:
 *   GITHUB_APP_ID        — numeric App ID from the GitHub App settings page
 *   GITHUB_APP_PRIVATE_KEY — PEM-encoded private key (can include \n literals)
 *
 * Setup:
 *   1. Create a GitHub App at github.com/settings/apps/new
 *   2. Permissions needed: Pull Requests (read & write)
 *   3. Install the app on the repos you want ReviewBot to review
 *   4. Set GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY in worker env
 */

const GITHUB_API = 'https://api.github.com'

/**
 * Normalize a PEM private key from environment variable format.
 *
 * Environment variables often store PEM keys with literal "\n" strings
 * instead of actual newlines. This converts them so OpenSSL can parse the key.
 */
function normalizeKey(key: string): string {
  // Strip nested quotes layer by layer (Docker .env can produce '"..."' or "'...'")
  while (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1)
  }
  // Replace literal \\n (double-escaped) and \n (single-escaped) with actual newlines
  key = key.replace(/\\\\n/g, '\n').replace(/\\n/g, '\n')
  return key.trim()
}

/**
 * Create a JWT for GitHub App authentication (RS256).
 * Valid for 10 minutes (GitHub maximum).
 */
function createAppJWT(appId: string, privateKey: string): string {
  const now = Math.floor(Date.now() / 1000)

  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({
    iat: now - 60,      // issued 60s ago (clock drift tolerance)
    exp: now + 10 * 60, // expires in 10 minutes
    iss: appId,
  })).toString('base64url')

  const signingInput = `${header}.${payload}`
  const sign = createSign('RSA-SHA256')
  sign.update(signingInput)
  const signature = sign.sign(privateKey, 'base64url')

  return `${signingInput}.${signature}`
}

/**
 * Get a GitHub App installation token for a specific repository.
 *
 * Flow:
 *   1. Create JWT from App ID + private key
 *   2. GET /repos/{owner}/{repo}/installation → installation_id
 *   3. POST /app/installations/{id}/access_tokens → token
 *
 * Returns the installation token or null if the app is not configured/installed.
 */
export async function getGitHubAppToken(repoName: string): Promise<string | null> {
  const appId = process.env.GITHUB_APP_ID
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY

  if (!appId || !privateKey) {
    console.warn(`[github-app] missing env: GITHUB_APP_ID=${!!appId}, GITHUB_APP_PRIVATE_KEY=${!!privateKey}`)
    return null
  }

  // Sanity check the key format
  if (!privateKey.includes('-----BEGIN')) {
    console.error(`[github-app] GITHUB_APP_PRIVATE_KEY does not look like a PEM key (missing BEGIN header)`)
    return null
  }

  try {
    const normalizedKey = normalizeKey(privateKey)
    console.log(`[github-app] creating JWT for app_id=${appId}, repo=${repoName}, key_length=${privateKey.length}, normalized_length=${normalizedKey.length}`)
    const jwt = createAppJWT(appId, normalizedKey)

    // Step 1: Get installation ID for this repo
    const installRes = await fetch(`${GITHUB_API}/repos/${repoName}/installation`, {
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    })

    if (!installRes.ok) {
      const body = await installRes.text().catch(() => '')
      console.warn(`[github-app] no installation found for ${repoName}: ${installRes.status} ${body.slice(0, 200)}`)
      return null
    }

    const installData = await installRes.json() as { id: number }

    // Step 2: Get installation access token
    const tokenRes = await fetch(`${GITHUB_API}/app/installations/${installData.id}/access_tokens`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    })

    if (!tokenRes.ok) {
      const body = await tokenRes.text().catch(() => '')
      console.error(`[github-app] failed to get installation token: ${tokenRes.status} ${body.slice(0, 200)}`)
      return null
    }

    const tokenData = await tokenRes.json() as { token: string }
    console.log(`[github-app] obtained installation token for ${repoName}`)
    return tokenData.token
  } catch (err) {
    console.error(`[github-app] error getting app token:`, err)
    return null
  }
}
