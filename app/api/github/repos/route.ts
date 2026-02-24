import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

interface GitHubRepo {
  id: number
  full_name: string
  name: string
  owner: { login: string }
  private: boolean
  description: string | null
  language: string | null
  updated_at: string
  default_branch: string
}

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get('provider_token')?.value

  if (!token) {
    return NextResponse.json(
      { error: 'No provider token. Please sign in again.' },
      { status: 401 }
    )
  }

  const res = await fetch(
    'https://api.github.com/user/repos?per_page=100&sort=updated&type=all',
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      next: { revalidate: 60 },
    }
  )

  if (!res.ok) {
    const body = await res.text()
    return NextResponse.json(
      { error: `GitHub API error: ${res.status}`, detail: body },
      { status: res.status }
    )
  }

  const repos: GitHubRepo[] = await res.json()

  const mapped = repos.map((r) => ({
    slug: r.full_name.replace(/\//g, '-'),
    name: r.full_name,
    provider: 'GitHub' as const,
    status: 'interview' as const,
    reviews: null,
    lastReview: null,
    language: r.language,
    private: r.private,
    description: r.description,
    updatedAt: r.updated_at,
    defaultBranch: r.default_branch,
  }))

  return NextResponse.json(mapped)
}
