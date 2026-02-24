import { formatComment, type ReviewResult } from './prompts/review.js'

const GITHUB_API = 'https://api.github.com'

const GITHUB_HEADERS = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PRFile {
  filename: string
  status: 'added' | 'modified' | 'removed' | 'renamed'
  additions: number
  deletions: number
  patch?: string
}

export interface PRMetadata {
  title: string
  body: string
  base: string
  head: string
  head_sha: string
  author: string
  draft: boolean
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

async function githubFetch(
  path: string,
  token: string,
  options?: RequestInit,
): Promise<Response> {
  const res = await fetch(`${GITHUB_API}${path}`, {
    ...options,
    headers: {
      ...GITHUB_HEADERS,
      Authorization: `Bearer ${token}`,
      ...(options?.headers ?? {}),
    },
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`GitHub API ${res.status}: ${path} — ${body.slice(0, 500)}`)
  }

  return res
}

// ---------------------------------------------------------------------------
// Fetch PR diff
// ---------------------------------------------------------------------------

export async function fetchPRDiff(
  repoName: string,
  prNumber: number,
  token: string,
): Promise<{ metadata: PRMetadata; files: PRFile[] }> {
  const [metaRes, filesRes] = await Promise.all([
    githubFetch(`/repos/${repoName}/pulls/${prNumber}`, token),
    githubFetch(`/repos/${repoName}/pulls/${prNumber}/files?per_page=100`, token),
  ])

  const meta = await metaRes.json() as Record<string, unknown>
  const files = await filesRes.json() as Array<Record<string, unknown>>

  const prUser = meta.user as Record<string, unknown> | undefined
  const base = meta.base as Record<string, unknown> | undefined
  const head = meta.head as Record<string, unknown> | undefined

  const metadata: PRMetadata = {
    title: (meta.title as string) ?? '',
    body: (meta.body as string) ?? '',
    base: (base?.ref as string) ?? '',
    head: (head?.ref as string) ?? '',
    head_sha: (head?.sha as string) ?? '',
    author: (prUser?.login as string) ?? 'unknown',
    draft: (meta.draft as boolean) ?? false,
  }

  const prFiles: PRFile[] = files.map((f) => ({
    filename: f.filename as string,
    status: f.status as PRFile['status'],
    additions: (f.additions as number) ?? 0,
    deletions: (f.deletions as number) ?? 0,
    patch: f.patch as string | undefined,
  }))

  return { metadata, files: prFiles }
}

// ---------------------------------------------------------------------------
// Post review
// ---------------------------------------------------------------------------

export async function postGitHubReview(
  repoName: string,
  prNumber: number,
  token: string,
  review: ReviewResult,
  headSha?: string,
): Promise<void> {
  if (review.comments.length === 0) {
    console.log(`[github] no comments to post on ${repoName}#${prNumber}`)
    return
  }

  const reviewBody: Record<string, unknown> = {
    event: 'COMMENT',
    comments: review.comments.map((c) => {
      const comment: Record<string, unknown> = {
        path: c.file,
        line: c.endLine ?? c.line,
        side: 'RIGHT',
        body: formatComment(c),
      }
      // Multi-line comment support
      if (c.endLine && c.endLine > c.line) {
        comment.start_line = c.line
        comment.start_side = 'RIGHT'
      }
      return comment
    }),
  }

  // Pin review to specific commit so line numbers stay valid
  if (headSha) {
    reviewBody.commit_id = headSha
  }

  try {
    await githubFetch(
      `/repos/${repoName}/pulls/${prNumber}/reviews`,
      token,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reviewBody),
      },
    )

    console.log(
      `[github] posted review on ${repoName}#${prNumber}: ${review.comments.length} comments`,
    )
  } catch (err) {
    // GitHub Reviews API is atomic — if ANY comment has an invalid line number
    // (not in the diff), the entire review is rejected with 422.
    // Fallback: post individual review comments.
    console.warn(`[github] atomic review failed, falling back to individual comments:`, err)

    // Try each inline comment individually via single-comment reviews
    let posted = 0
    for (const c of review.comments) {
      try {
        const singleComment: Record<string, unknown> = {
          path: c.file,
          line: c.endLine ?? c.line,
          side: 'RIGHT',
          body: formatComment(c),
        }
        if (c.endLine && c.endLine > c.line) {
          singleComment.start_line = c.line
          singleComment.start_side = 'RIGHT'
        }

        await githubFetch(
          `/repos/${repoName}/pulls/${prNumber}/reviews`,
          token,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event: 'COMMENT',
              comments: [singleComment],
              ...(headSha ? { commit_id: headSha } : {}),
            }),
          },
        )
        posted++
      } catch (commentErr) {
        console.warn(`[github] skipping comment on ${c.file}:${c.line} (invalid position)`)
      }
    }

    console.log(
      `[github] fallback: posted ${posted}/${review.comments.length} inline comments on ${repoName}#${prNumber}`,
    )
  }
}
