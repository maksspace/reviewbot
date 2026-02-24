import { formatComment, type ReviewResult } from './prompts/review.js'

const GITLAB_API = 'https://gitlab.com/api/v4'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MRChange {
  old_path: string
  new_path: string
  diff: string
  new_file: boolean
  renamed_file: boolean
  deleted_file: boolean
}

export interface MRMetadata {
  title: string
  description: string
  target_branch: string
  source_branch: string
  author: string
  draft: boolean
  diff_refs: {
    base_sha: string
    head_sha: string
    start_sha: string
  }
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

/**
 * PAT tokens (glpat-...) use PRIVATE-TOKEN header.
 * OAuth tokens use Authorization: Bearer header.
 */
function gitlabAuthHeader(token: string): Record<string, string> {
  if (token.startsWith('glpat-')) {
    return { 'PRIVATE-TOKEN': token }
  }
  return { Authorization: `Bearer ${token}` }
}

async function gitlabFetch(
  path: string,
  token: string,
  options?: RequestInit,
): Promise<Response> {
  const res = await fetch(`${GITLAB_API}${path}`, {
    ...options,
    headers: {
      ...gitlabAuthHeader(token),
      ...(options?.headers ?? {}),
    },
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`GitLab API ${res.status}: ${path} — ${body.slice(0, 500)}`)
  }

  return res
}

// ---------------------------------------------------------------------------
// Fetch MR changes
// ---------------------------------------------------------------------------

export async function fetchMRChanges(
  repoName: string,
  mrIid: number,
  token: string,
): Promise<{ metadata: MRMetadata; changes: MRChange[] }> {
  const encoded = encodeURIComponent(repoName)

  const res = await gitlabFetch(
    `/projects/${encoded}/merge_requests/${mrIid}/changes`,
    token,
  )

  const data = await res.json() as Record<string, unknown>

  const author = data.author as Record<string, unknown> | undefined
  const diffRefs = data.diff_refs as Record<string, unknown> | undefined

  const metadata: MRMetadata = {
    title: (data.title as string) ?? '',
    description: (data.description as string) ?? '',
    target_branch: (data.target_branch as string) ?? '',
    source_branch: (data.source_branch as string) ?? '',
    author: (author?.username as string) ?? 'unknown',
    draft: (data.draft as boolean) ?? false,
    diff_refs: {
      base_sha: (diffRefs?.base_sha as string) ?? '',
      head_sha: (diffRefs?.head_sha as string) ?? '',
      start_sha: (diffRefs?.start_sha as string) ?? '',
    },
  }

  const rawChanges = (data.changes as Array<Record<string, unknown>>) ?? []
  const changes: MRChange[] = rawChanges.map((c) => ({
    old_path: (c.old_path as string) ?? '',
    new_path: (c.new_path as string) ?? '',
    diff: (c.diff as string) ?? '',
    new_file: (c.new_file as boolean) ?? false,
    renamed_file: (c.renamed_file as boolean) ?? false,
    deleted_file: (c.deleted_file as boolean) ?? false,
  }))

  return { metadata, changes }
}

// ---------------------------------------------------------------------------
// Post review comments
// ---------------------------------------------------------------------------

export async function postGitLabReview(
  repoName: string,
  mrIid: number,
  token: string,
  review: ReviewResult,
  diffRefs: MRMetadata['diff_refs'],
): Promise<void> {
  const encoded = encodeURIComponent(repoName)

  if (review.comments.length === 0) {
    console.log(`[gitlab] no comments to post on ${repoName}!${mrIid}`)
    return
  }

  // Post inline comments as discussions
  for (const comment of review.comments) {
    try {
      await gitlabFetch(
        `/projects/${encoded}/merge_requests/${mrIid}/discussions`,
        token,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            body: formatComment(comment),
            position: {
              base_sha: diffRefs.base_sha,
              head_sha: diffRefs.head_sha,
              start_sha: diffRefs.start_sha,
              position_type: 'text',
              old_path: comment.file,
              new_path: comment.file,
              new_line: comment.line,
            },
          }),
        },
      )
    } catch (err) {
      console.error(`[gitlab] failed to post comment on ${comment.file}:${comment.line}:`, err)
    }
  }

  console.log(
    `[gitlab] posted review on ${repoName}!${mrIid}: ${review.comments.length} comments`,
  )
}
