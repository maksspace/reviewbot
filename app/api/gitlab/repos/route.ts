import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

interface GitLabProject {
  id: number
  path_with_namespace: string
  name: string
  name_with_namespace: string
  visibility: 'private' | 'internal' | 'public'
  description: string | null
  default_branch: string
  last_activity_at: string
  forked_from_project?: unknown
}

/**
 * Fetch ALL pages from a GitLab paginated endpoint.
 * GitLab uses Link header + X-Total-Pages for pagination.
 */
async function fetchAllPages<T>(url: string, token: string): Promise<T[]> {
  const results: T[] = []
  let nextUrl: string | null = url

  while (nextUrl) {
    const res = await fetch(nextUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`GitLab API error: ${res.status} — ${body.slice(0, 500)}`)
    }

    const data = await res.json() as T[]
    results.push(...data)

    // Parse Link header for next page
    const linkHeader = res.headers.get('link')
    nextUrl = null
    if (linkHeader) {
      const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/)
      if (match) {
        nextUrl = match[1]
      }
    }

    // Safety: cap at 500 repos
    if (results.length >= 500) break
  }

  return results
}

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get('provider_token')?.value

  console.log({ token });

  if (!token) {
    return NextResponse.json(
      { error: 'No provider token. Please sign in again.' },
      { status: 401 }
    )
  }

  try {
    const projects = await fetchAllPages<GitLabProject>(
      'https://gitlab.com/api/v4/projects?membership=true&order_by=updated_at&sort=desc&per_page=100&simple=true',
      token,
    )

    const mapped = projects.map((p) => ({
      slug: p.path_with_namespace.replace(/\//g, '-'),
      name: p.path_with_namespace,
      provider: 'GitLab' as const,
      status: 'interview' as const,
      reviews: null,
      lastReview: null,
      language: null, // GitLab simple mode doesn't include language
      private: p.visibility === 'private',
      description: p.description,
      updatedAt: p.last_activity_at,
      defaultBranch: p.default_branch,
    }))

    return NextResponse.json(mapped)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { error: `GitLab API error`, detail: message },
      { status: 502 }
    )
  }
}
