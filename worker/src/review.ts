import { GenericContainer, type StartedTestContainer, type ExecResult } from 'testcontainers'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { WebhookEventPayload } from './queue.js'
import { fetchPRDiff, postGitHubReview } from './github.js'
import { fetchMRChanges, postGitLabReview } from './gitlab.js'
import { parseJSON } from './llm.js'
import {
  buildReviewSystemPrompt,
  buildMRContext,
  formatGitHubDiff,
  formatGitLabDiff,
  type ReviewComment,
  type ReviewResult,
} from './prompts/review.js'
import { formatPredefinedSkillsForPrompt, formatCustomSkillsForPrompt, type CustomSkill } from './skills/index.js'
import { getValidProviderToken } from './token.js'
import { getGitHubAppToken } from './github-app.js'
import { ANALYZER_IMAGE } from './config.js'

/** Timeout for the CLI review (5 minutes) */
const REVIEW_TIMEOUT_MS = 5 * 60 * 1000

/** Run a container exec with a timeout (testcontainers ExecOptions doesn't support timeout). */
function execWithTimeout(
  container: StartedTestContainer,
  command: string[],
  timeoutMs: number,
): Promise<ExecResult> {
  return Promise.race([
    container.exec(command),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`exec timed out after ${timeoutMs}ms`)), timeoutMs),
    ),
  ])
}

/**
 * Extract text content from opencode's NDJSON output.
 * Each line is a JSON event; text content lives in {"type":"text","part":{"text":"..."}}.
 */
function parseOpenCodeOutput(ndjson: string): string {
  const textParts: string[] = []
  for (const line of ndjson.split('\n')) {
    if (!line.trim()) continue
    try {
      const event = JSON.parse(line)
      if (event.type === 'text' && event.part?.text) {
        textParts.push(event.part.text)
      }
    } catch { /* skip non-JSON lines */ }
  }
  return textParts.join('')
}

/** Extract LLM provider from model string (e.g., "openai/gpt-5.2-codex" → "openai") */
function extractProvider(model: string): string {
  const slash = model.indexOf('/')
  return slash > 0 ? model.slice(0, slash) : 'openai'
}

/**
 * Check if a new comment is a duplicate of a previously flagged comment.
 * Matches on: same file + line within 3 lines (code may shift between commits)
 * + same rule ID or similar message start.
 */
function isDuplicateComment(
  comment: ReviewComment,
  previous: ReviewComment[],
): boolean {
  return previous.some((prev) => {
    if (prev.file !== comment.file) return false
    if (Math.abs(prev.line - comment.line) > 3) return false

    // Fuzzy message match: first 80 chars
    const prevMsg = prev.message.slice(0, 80).toLowerCase()
    const newMsg = comment.message.slice(0, 80).toLowerCase()
    return prevMsg === newMsg
  })
}

/**
 * Review a PR/MR using opencode CLI inside a Docker container.
 *
 * 1. Fetch repo context + user settings from DB
 * 2. Fetch PR diff from GitHub/GitLab API
 * 3. Start reviewbot-analyzer container
 * 4. Clone repo + checkout PR branch
 * 5. Write system prompt + MR context to files
 * 6. Set up opencode auth + run review
 * 7. Parse structured JSON output from NDJSON
 * 8. Post review comments back to GitHub/GitLab
 * 9. Store review record
 */
export async function reviewPR(
  supabase: SupabaseClient,
  event: WebhookEventPayload,
): Promise<void> {
  const { repo_slug, repo_name, provider, pr_number, user_id } = event

  console.log(`[review] starting review: ${repo_name}#${pr_number}`)

  // -----------------------------------------------------------------------
  // Fetch repo data
  // -----------------------------------------------------------------------

  const { data: repo, error: repoError } = await supabase
    .from('connected_repositories')
    .select('status, persona_data, analysis_data, custom_skills')
    .eq('user_id', user_id)
    .eq('slug', repo_slug)
    .single()

  if (repoError || !repo) {
    console.error(`[review] repo not found: ${repo_slug}`, repoError?.message)
    return
  }

  if (repo.status !== 'active') {
    console.log(`[review] skipping — repo ${repo_slug} status is "${repo.status}" (persona not ready)`)
    return
  }

  const persona: string = repo.persona_data?.persona ?? ''
  const analysisProfile: string = repo.analysis_data?.profile ?? ''
  const customSkills: CustomSkill[] = repo.custom_skills ?? []

  if (!persona) {
    console.log(`[review] skipping — no persona for ${repo_slug}`)
    return
  }

  // -----------------------------------------------------------------------
  // Check subscription limits (free plan: 50 reviews/month)
  // -----------------------------------------------------------------------

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('plan, status, review_count_month, review_count_reset_at')
    .eq('user_id', user_id)
    .single()

  const isPro = sub?.plan === 'pro' && sub?.status === 'active'

  if (!isPro) {
    const FREE_REVIEW_LIMIT = 50
    let reviewCount = sub?.review_count_month ?? 0

    // Auto-reset monthly counter
    if (sub?.review_count_reset_at) {
      const resetAt = new Date(sub.review_count_reset_at)
      const monthMs = 30 * 24 * 60 * 60 * 1000
      if (Date.now() - resetAt.getTime() > monthMs) {
        reviewCount = 0
        await supabase
          .from('subscriptions')
          .update({ review_count_month: 0, review_count_reset_at: new Date().toISOString() })
          .eq('user_id', user_id)
      }
    }

    if (reviewCount >= FREE_REVIEW_LIMIT) {
      console.log(`[review] skipping — free plan limit reached (${reviewCount}/${FREE_REVIEW_LIMIT}) for user ${user_id}`)
      return
    }
  }

  // Get a valid provider token (reads fresh from DB, refreshes if expired)
  const providerToken = await getValidProviderToken(supabase, user_id, repo_slug, provider)

  if (!providerToken) {
    console.error(`[review] no valid provider_token for ${repo_slug} — user may need to re-authenticate`)
    return
  }

  // -----------------------------------------------------------------------
  // Fetch user LLM settings
  // -----------------------------------------------------------------------

  const { data: settings } = await supabase
    .from('user_settings')
    .select('provider, model, api_key, max_comments')
    .eq('user_id', user_id)
    .single()

  if (!settings?.api_key) {
    console.error(`[review] no API key configured for user ${user_id}`)
    return
  }

  // Backward compat: old rows store model without provider/ prefix (e.g. "gpt-5.2-codex")
  // opencode expects "provider/model" format (e.g. "openai/gpt-5.2-codex")
  let model = settings.model ?? 'gpt-5.2-codex'
  if (!model.includes('/')) {
    const p = settings.provider ?? 'openai'
    model = `${p}/${model}`
  }
  const apiKey = settings.api_key
  const maxComments = Math.min(settings.max_comments ?? 10, 50)
  const llmProvider = extractProvider(model)

  // -----------------------------------------------------------------------
  // Fetch PR diff from GitHub/GitLab API
  // -----------------------------------------------------------------------

  let diff: string
  let prTitle: string
  let prBody: string
  let prAuthor: string
  let targetBranch: string
  let fileCount: number
  let isDraft = false
  let headSha: string | undefined
  let gitlabDiffRefs: { base_sha: string; head_sha: string; start_sha: string } | null = null

  if (provider === 'github') {
    console.log(`[review] fetching GitHub PR #${pr_number} diff...`)
    const { metadata, files } = await fetchPRDiff(repo_name, pr_number, providerToken)

    isDraft = metadata.draft
    prTitle = metadata.title
    prBody = metadata.body
    prAuthor = metadata.author
    targetBranch = metadata.base
    headSha = metadata.head_sha
    fileCount = files.length

    if (files.length === 0) {
      console.log(`[review] skipping — empty diff`)
      return
    }
    if (files.length > 100) {
      console.log(`[review] skipping — too many files (${files.length})`)
      return
    }

    diff = formatGitHubDiff(files)
  } else {
    console.log(`[review] fetching GitLab MR !${pr_number} diff...`)
    const { metadata, changes } = await fetchMRChanges(repo_name, pr_number, providerToken)

    isDraft = metadata.draft
    prTitle = metadata.title
    prBody = metadata.description
    prAuthor = metadata.author
    targetBranch = metadata.target_branch
    fileCount = changes.length
    gitlabDiffRefs = metadata.diff_refs

    if (changes.length === 0) {
      console.log(`[review] skipping — empty diff`)
      return
    }
    if (changes.length > 100) {
      console.log(`[review] skipping — too many files (${changes.length})`)
      return
    }

    diff = formatGitLabDiff(changes)
  }

  if (isDraft) {
    console.log(`[review] skipping — draft PR`)
    return
  }

  console.log(`[review] diff formatted: ${diff.length} chars, ${fileCount} files`)

  // -----------------------------------------------------------------------
  // Fetch previous comments on this PR (dedup)
  // -----------------------------------------------------------------------

  const { data: previousReviews } = await supabase
    .from('reviews')
    .select('comments, created_at')
    .eq('user_id', user_id)
    .eq('repo_slug', repo_slug)
    .eq('pr_number', pr_number)
    .order('created_at', { ascending: false })

  const previousComments: ReviewComment[] = (previousReviews ?? [])
    .flatMap((r: { comments: ReviewComment[] | null }) => r.comments ?? [])

  if (previousComments.length > 0) {
    console.log(`[review] found ${previousComments.length} previous comments on ${repo_slug}#${pr_number}`)
  }

  // -----------------------------------------------------------------------
  // Build prompts
  // -----------------------------------------------------------------------

  const systemPrompt = buildReviewSystemPrompt(
    persona,
    analysisProfile,
    formatPredefinedSkillsForPrompt(),
    formatCustomSkillsForPrompt(customSkills),
  )
  const mrContext = buildMRContext(diff, {
    title: prTitle,
    description: prBody,
    author: prAuthor,
    targetBranch,
    fileCount,
  }, previousComments.length > 0 ? previousComments : undefined)

  // -----------------------------------------------------------------------
  // Run review in Docker container (same pattern as analyze.ts)
  // -----------------------------------------------------------------------

  let container: StartedTestContainer | null = null

  try {
    console.log(`[review] starting container...`)
    container = await new GenericContainer(ANALYZER_IMAGE)
      .withEntrypoint(['sleep'])
      .withCommand(['infinity'])
      .start()

    // --- Clone repo ---
    const isGitLab = provider.toLowerCase() === 'gitlab'
    const cloneHost = isGitLab ? 'gitlab.com' : 'github.com'
    const cloneUser = isGitLab ? 'oauth2' : 'x-access-token'
    const cloneUrl = `https://${cloneUser}:${providerToken}@${cloneHost}/${repo_name}.git`
    console.log(`[review] cloning ${repo_name}...`)

    const clone = await container.exec([
      'git', 'clone', '--depth', '50', cloneUrl, '/repo',
    ])

    if (clone.exitCode !== 0) {
      console.error(`[review] clone failed:`, clone.stderr)
      throw new Error(`Clone failed: ${clone.stderr.slice(0, 500)}`)
    }

    // --- Checkout PR branch ---
    let fetchRef: string
    if (!isGitLab) {
      fetchRef = `git fetch origin pull/${pr_number}/head:pr-review && git checkout pr-review`
    } else {
      fetchRef = `git fetch origin merge-requests/${pr_number}/head:mr-review && git checkout mr-review`
    }

    console.log(`[review] checking out PR branch...`)
    const checkout = await container.exec(['sh', '-c', `cd /repo && ${fetchRef}`])

    if (checkout.exitCode !== 0) {
      console.warn(`[review] PR branch checkout failed (will review default branch):`, checkout.stderr.slice(0, 500))
    }

    // --- Write system prompt ---
    await container.exec([
      'sh', '-c', `cat > /tmp/system-prompt.md << 'REVIEWBOT_SYSTEM_EOF'\n${systemPrompt}\nREVIEWBOT_SYSTEM_EOF`,
    ])

    // --- Write MR context (user message) ---
    await container.exec([
      'sh', '-c', `cat > /tmp/mr-context.md << 'REVIEWBOT_MR_EOF'\n${mrContext}\nREVIEWBOT_MR_EOF`,
    ])

    // --- Set up opencode auth ---
    const authJson = JSON.stringify({
      [llmProvider]: { type: 'api', key: apiKey },
    })
    await container.exec([
      'sh', '-c', `mkdir -p ~/.local/share/opencode && cat > ~/.local/share/opencode/auth.json << 'AUTH_EOF'\n${authJson}\nAUTH_EOF`,
    ])

    // --- Build opencode CLI command ---
    // System prompt attached via --file, MR context piped via stdin
    const cliCmd = `cat /tmp/mr-context.md | opencode run --model "${model}" --format json --dir /repo --file /tmp/system-prompt.md > /tmp/result.txt`

    // --- Run review ---
    console.log(`[review] running opencode review (${model})...`)
    const exec = await execWithTimeout(container, ['sh', '-c', cliCmd], REVIEW_TIMEOUT_MS)

    if (exec.exitCode !== 0) {
      console.error(`[review] CLI exited with code ${exec.exitCode}`)
      console.error(`[review] stderr:`, exec.stderr.slice(0, 2000))
    }

    // --- Read result (NDJSON) and extract text ---
    const resultExec = await container.exec(['sh', '-c', 'cat /tmp/result.txt'])
    const rawNdjson = resultExec.output
    console.log(`[review] raw NDJSON: ${rawNdjson.length} chars`)

    const rawOutput = parseOpenCodeOutput(rawNdjson)
    console.log(`[review] extracted text: ${rawOutput.length} chars`)

    if (!rawOutput || rawOutput.trim().length === 0) {
      console.error(`[review] empty output from CLI`)
      throw new Error('Empty CLI output')
    }

    // -----------------------------------------------------------------------
    // Parse JSON result
    // -----------------------------------------------------------------------

    let result: ReviewResult
    try {
      result = parseJSON<ReviewResult>(rawOutput)
    } catch (err) {
      console.error(`[review] failed to parse LLM response:`, rawOutput.slice(0, 1000))
      throw err
    }

    if (!result.comments || !Array.isArray(result.comments)) {
      console.error(`[review] invalid review shape:`, JSON.stringify(result).slice(0, 500))
      throw new Error('Invalid review response shape')
    }

    // Enforce max_comments, then drop suggestions if still >5
    if (result.comments.length > maxComments) {
      result.comments = result.comments.slice(0, maxComments)
    }
    if (result.comments.length > 5) {
      result.comments = result.comments.filter((c) => c.severity !== 'suggestion')
    }

    // Dedup: filter out comments that match previously flagged issues
    if (previousComments.length > 0 && result.comments.length > 0) {
      const before = result.comments.length
      result.comments = result.comments.filter((c) => !isDuplicateComment(c, previousComments))
      const filtered = before - result.comments.length
      if (filtered > 0) {
        console.log(`[review] dedup: ${filtered} comments filtered (already flagged), ${result.comments.length} remaining`)
      }
    }

    console.log(`[review] ${result.comments.length} comments`)

    // -----------------------------------------------------------------------
    // Post review (use GitHub App token if available, so reviews appear as "reviewbot[bot]")
    // -----------------------------------------------------------------------

    if (provider === 'github') {
      const botToken = await getGitHubAppToken(repo_name)
      const postToken = botToken ?? providerToken
      if (botToken) {
        console.log(`[review] posting as reviewbot[bot] (GitHub App)`)
      } else {
        console.log(`[review] posting as user (no GitHub App configured)`)
      }
      await postGitHubReview(repo_name, pr_number, postToken, result, headSha)
    } else if (gitlabDiffRefs) {
      // Use dedicated GitLab bot token if available, so reviews appear as the bot user
      const gitlabBotToken = process.env.GITLAB_BOT_TOKEN
      const postToken = gitlabBotToken ?? providerToken
      if (gitlabBotToken) {
        console.log(`[review] posting as GitLab bot account`)
      } else {
        console.log(`[review] posting as user (no GITLAB_BOT_TOKEN configured)`)
      }
      await postGitLabReview(repo_name, pr_number, postToken, result, gitlabDiffRefs)
    }

    // -----------------------------------------------------------------------
    // Store review record
    // -----------------------------------------------------------------------

    const { error: insertError } = await supabase.from('reviews').insert({
      user_id,
      repo_slug,
      pr_number,
      pr_title: prTitle,
      pr_url: event.pr_url,
      pr_author: prAuthor,
      verdict: 'comment',
      comment_count: result.comments.length,
      comments: result.comments,
      llm_provider: llmProvider,
      llm_model: model,
    })

    if (insertError) {
      console.error(`[review] failed to store review record:`, insertError.message)
    }

    // Increment monthly review counter
    if (!isPro) {
      await supabase.rpc('increment_review_count', { uid: user_id }).then(({ error }) => {
        if (error) console.error(`[review] failed to increment review count:`, error.message)
      })
    }

    console.log(`[review] done — ${repo_name}#${pr_number} reviewed (${model})`)
  } catch (err) {
    console.error(`[review] error reviewing ${repo_name}#${pr_number}:`, err)
    throw err // Re-throw so pollWebhooks() keeps the message for retry
  } finally {
    if (container) {
      console.log(`[review] stopping container...`)
      await container.stop();
      console.log(`[analyze] container stopped`)
    }
  }
}
