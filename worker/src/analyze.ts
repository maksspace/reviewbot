import { GenericContainer, type StartedTestContainer, type ExecResult } from 'testcontainers'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { RepoAnalysisPayload } from './queue.js'
import { ANALYSIS_SYSTEM_PROMPT } from './prompts/analyze.js'
import { getValidProviderToken } from './token.js'
import { ANALYZER_IMAGE } from './config.js'

/** Timeout for the CLI analysis (3 minutes) */
const ANALYSIS_TIMEOUT_MS = 15 * 60 * 1000

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
 * Run full codebase analysis using opencode CLI inside a Docker container.
 *
 * 1. Get a valid provider token (refresh if expired)
 * 2. Start pre-built reviewbot-analyzer container (git + opencode pre-installed)
 * 3. Clone the repo
 * 4. Write the prompt to a file inside the container
 * 5. Set up opencode auth + run analysis
 * 6. Parse NDJSON output, extract Codebase Profile
 * 7. Store in DB, flip status to 'interview'
 */
export async function analyzeRepo(
  supabase: SupabaseClient,
  payload: RepoAnalysisPayload
): Promise<void> {
  const { user_id, slug, name, provider } = payload

  console.log(`[analyze] starting analysis for ${slug} (${provider})`)

  // -----------------------------------------------------------------------
  // Get a valid provider token (reads fresh from DB, refreshes if expired)
  // -----------------------------------------------------------------------

  const providerToken = await getValidProviderToken(supabase, user_id, provider)

  if (!providerToken) {
    console.error(`[analyze] no valid provider_token for ${slug} — skipping (user may need to re-authenticate)`)
    await updateStatus(supabase, user_id, slug, 'interview', null)
    return
  }

  // Fetch user's LLM settings
  const { data: settings } = await supabase
    .from('user_settings')
    .select('provider, model, api_key')
    .eq('user_id', user_id)
    .single()

  if (!settings?.api_key) {
    console.log(`[analyze] no API key configured — skipping analysis`)
    await updateStatus(supabase, user_id, slug, 'interview', null)
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
  const llmProvider = extractProvider(model)

  let container: StartedTestContainer | null = null

  try {
    // --- Step 1: Start container ---
    console.log(`[analyze] starting container...`)
    container = await new GenericContainer(ANALYZER_IMAGE)
      .withEntrypoint(['sleep'])
      .withCommand(['infinity'])
      .start()

    // --- Step 2: Clone repo ---
    const isGitLab = provider.toLowerCase() === 'gitlab'
    const cloneHost = isGitLab ? 'gitlab.com' : 'github.com'
    const cloneUser = isGitLab ? 'oauth2' : 'x-access-token'
    const cloneUrl = `https://${cloneUser}:${providerToken}@${cloneHost}/${name}.git`
    console.log(`[analyze] cloning ${name}...`)

    const clone = await container.exec([
      'git', 'clone', '--depth', '1', cloneUrl, '/repo',
    ])

    if (clone.exitCode !== 0) {
      console.error(`[analyze] clone failed for ${slug}:`, clone.stderr)
      await updateStatus(supabase, user_id, slug, 'interview', null)
      return
    }

    console.log(`[analyze] cloned ${name}`)

    // --- Step 3: Write prompt to file ---
    const prompt = buildPrompt()

    await container.exec([
      'sh', '-c', `cat > /tmp/prompt.txt << 'REVIEWBOT_EOF'\n${prompt}\nREVIEWBOT_EOF`,
    ])

    // --- Step 4: Set up opencode auth ---
    const authJson = JSON.stringify({
      [llmProvider]: { type: 'api', key: apiKey },
    })
    await container.exec([
      'sh', '-c', `mkdir -p ~/.local/share/opencode && cat > ~/.local/share/opencode/auth.json << 'AUTH_EOF'\n${authJson}\nAUTH_EOF`,
    ])

    // --- Step 5: Run analysis ---
    const cliCmd = `cat /tmp/prompt.txt | opencode run --model "${model}" --format json --dir /repo > /tmp/result.txt`

    console.log(`[analyze] running opencode analysis (${model})...`)
    const analysis = await execWithTimeout(container, ['sh', '-c', cliCmd], ANALYSIS_TIMEOUT_MS)

    if (analysis.exitCode !== 0) {
      console.error(`[analyze] CLI exited with code ${analysis.exitCode}`)
      console.error(`[analyze] stderr:`, analysis.stderr.slice(0, 2000))
    }

    // --- Step 6: Read result (NDJSON) and extract text ---
    const result = await container.exec(['sh', '-c', 'cat /tmp/result.txt'])
    const rawNdjson = result.output
    console.log(`[analyze] raw NDJSON: ${rawNdjson.length} chars`)

    const profile = parseOpenCodeOutput(rawNdjson)
    console.log(`[analyze] extracted text: ${profile.length} chars`)

    if (profile) {
      console.log(`[analyze] profile generated (${profile.length} chars)`)
    } else {
      console.warn(`[analyze] no profile output`)
    }

    // --- Step 7: Store results and flip status ---
    await updateStatus(supabase, user_id, slug, 'interview', {
      profile,
      provider: llmProvider,
      model,
      analyzed_at: new Date().toISOString(),
    })

    console.log(`[analyze] done — ${slug} status -> interview`)
  } catch (err) {
    console.error(`[analyze] error analyzing ${slug}:`, err)
    await updateStatus(supabase, user_id, slug, 'interview', null)
  } finally {
    if (container) {
      console.log(`[analyze] stopping container...`)
      await container.stop()
      console.log(`[analyze] container stopped`)
    }
  }
}

function buildPrompt(): string {
  return `Follow the analysis process in your instructions.
Analyze this codebase thoroughly and produce the Codebase Profile document.

${ANALYSIS_SYSTEM_PROMPT}`
}

async function updateStatus(
  supabase: SupabaseClient,
  userId: string,
  slug: string,
  status: string,
  analysisData: Record<string, unknown> | null
): Promise<void> {
  const update: Record<string, unknown> = { status }
  if (analysisData) {
    update.analysis_data = analysisData
  }

  const { error } = await supabase
    .from('connected_repositories')
    .update(update)
    .eq('user_id', userId)
    .eq('slug', slug)

  if (error) {
    console.error(`[analyze] failed to update status for ${slug}:`, error.message)
  }
}
