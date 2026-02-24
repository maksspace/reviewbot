#!/usr/bin/env tsx
/**
 * test-local — Run ReviewBot analysis or review against a local repository.
 *
 * Uses opencode CLI (https://opencode.ai) as the agent runtime.
 *
 * Usage:
 *   pnpm test:local analyze --repo /path/to/repo
 *   pnpm test:local review  --repo /path/to/repo --branch main
 *
 * See --help for all options.
 */

import { spawn } from 'node:child_process'
import { readFile, writeFile, mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'

import { ANALYSIS_SYSTEM_PROMPT } from './prompts/analyze.js'
import {
  buildReviewSystemPrompt,
  buildMRContext,
  formatGitHubDiff,
  formatComment,
  type ReviewComment,
  type ReviewResult,
  type MRMetadata,
} from './prompts/review.js'
import type { PRFile } from './github.js'
import { parseJSON } from './llm.js'
import { formatPredefinedSkillsForPrompt, formatCustomSkillsForPrompt, type CustomSkill } from './skills/index.js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ANALYSIS_TIMEOUT_MS = 15 * 60 * 1000
const REVIEW_TIMEOUT_MS = 15 * 60 * 1000
const DEFAULT_MODEL = 'openai/gpt-5.2-codex'

const C = {
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
} as const

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function die(message: string): never {
  console.error(`${C.red}[test-local] error:${C.reset} ${message}`)
  process.exit(1)
}

function log(message: string): void {
  console.error(`${C.dim}[test-local]${C.reset} ${message}`)
}

async function execGit(
  cwd: string,
  args: string[],
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const child = spawn('git', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString() })
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString() })
    child.on('close', (code) => resolve({ stdout, stderr, exitCode: code ?? 1 }))
    child.on('error', (err) => resolve({ stdout: '', stderr: err.message, exitCode: 1 }))
  })
}

async function commandExists(cmd: string): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn('which', [cmd], { stdio: 'ignore' })
    child.on('close', (code) => resolve(code === 0))
    child.on('error', () => resolve(false))
  })
}

// ---------------------------------------------------------------------------
// Local diff generation
// ---------------------------------------------------------------------------

interface LocalDiffResult {
  files: PRFile[]
  metadata: {
    currentBranch: string
    baseBranch: string
    commitCount: number
    title: string
    author: string
  }
}

function gitStatusToAPI(char: string): PRFile['status'] {
  switch (char) {
    case 'A': return 'added'
    case 'D': return 'removed'
    case 'R': return 'renamed'
    default: return 'modified'
  }
}

/**
 * Split a full `git diff` output into per-file patches.
 * Returns a Map<filename, patch> where each patch starts at the first @@ hunk
 * (preamble stripped). This matches what GitHub's API returns and what
 * annotatePatch() expects.
 */
function splitDiffIntoPatches(fullDiff: string): Map<string, string> {
  const patches = new Map<string, string>()
  const fileDiffs = fullDiff.split(/^diff --git /m).filter(Boolean)

  for (const fileDiff of fileDiffs) {
    const firstNewline = fileDiff.indexOf('\n')
    if (firstNewline === -1) continue
    const header = fileDiff.slice(0, firstNewline)

    const bMatch = header.match(/ b\/(.+)$/)
    if (!bMatch) continue
    const filename = bMatch[1]

    const hunkStart = fileDiff.indexOf('\n@@')
    if (hunkStart === -1) continue

    const patch = fileDiff.slice(hunkStart + 1).replace(/\n$/, '')
    patches.set(filename, patch)
  }

  return patches
}

async function generateLocalDiff(
  repoPath: string,
  baseBranch: string,
): Promise<LocalDiffResult> {
  const mergeBaseResult = await execGit(repoPath, ['merge-base', baseBranch, 'HEAD'])
  if (mergeBaseResult.exitCode !== 0) {
    die(`cannot find merge base between "${baseBranch}" and HEAD: ${mergeBaseResult.stderr.trim()}`)
  }
  const mergeBase = mergeBaseResult.stdout.trim()

  const nameStatus = await execGit(repoPath, ['diff', '--name-status', '--diff-filter=ACDMR', `${mergeBase}..HEAD`])
  const numstat = await execGit(repoPath, ['diff', '--numstat', `${mergeBase}..HEAD`])
  const fullDiff = await execGit(repoPath, ['diff', '--no-color', `${mergeBase}..HEAD`])

  const statsMap = new Map<string, { additions: number; deletions: number }>()
  for (const line of numstat.stdout.trim().split('\n')) {
    if (!line) continue
    const parts = line.split('\t')
    if (parts.length < 3) continue
    const [add, del, ...pathParts] = parts
    const filename = pathParts.join('\t')
    statsMap.set(filename, {
      additions: add === '-' ? 0 : parseInt(add, 10),
      deletions: del === '-' ? 0 : parseInt(del, 10),
    })
  }

  const patchMap = splitDiffIntoPatches(fullDiff.stdout)

  const files: PRFile[] = []
  for (const line of nameStatus.stdout.trim().split('\n')) {
    if (!line) continue
    const parts = line.split('\t')
    const statusChar = parts[0][0]
    const filename = statusChar === 'R' ? parts[2] : parts[1]
    if (!filename) continue

    const stats = statsMap.get(filename) ?? { additions: 0, deletions: 0 }
    const patch = patchMap.get(filename)

    files.push({
      filename,
      status: gitStatusToAPI(statusChar),
      additions: stats.additions,
      deletions: stats.deletions,
      patch,
    })
  }

  const currentBranch = (await execGit(repoPath, ['rev-parse', '--abbrev-ref', 'HEAD'])).stdout.trim()
  const commitCountStr = (await execGit(repoPath, ['rev-list', '--count', `${mergeBase}..HEAD`])).stdout.trim()
  const commitCount = parseInt(commitCountStr, 10) || 0
  const firstCommitMsg = (await execGit(repoPath, ['log', '--format=%s', '-1', `${mergeBase}..HEAD`])).stdout.trim()
  const author = (await execGit(repoPath, ['config', 'user.name'])).stdout.trim()

  return {
    files,
    metadata: {
      currentBranch,
      baseBranch,
      commitCount,
      title: firstCommitMsg || currentBranch,
      author: author || 'local',
    },
  }
}

// ---------------------------------------------------------------------------
// OpenCode CLI
// ---------------------------------------------------------------------------

interface RunOptions {
  model: string
  repoPath: string
  systemPromptFile?: string
  userPromptFile: string
  timeout: number
}

/**
 * Run opencode CLI and return the output.
 *
 *   cat prompt.txt | opencode run --model <provider/model> --format json --dir <repo>
 *
 * System prompt is attached via --file flag.
 * Output is NDJSON — text extracted from {"type":"text","part":{"text":"..."}} events.
 */
async function runOpenCode(
  options: RunOptions,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const { model, repoPath, systemPromptFile, userPromptFile, timeout } = options

  const cleanEnv = { ...process.env }
  delete cleanEnv.CLAUDECODE

  const promptContent = await readFile(userPromptFile, 'utf8')

  const args = [
    'run',
    '--model', model,
    '--format', 'json',
    '--dir', repoPath,
  ]

  if (systemPromptFile) {
    args.push('--file', systemPromptFile)
  }

  log(`$ cat prompt.txt | opencode run --model ${model} --dir ${repoPath}${systemPromptFile ? ' --file system-prompt.md' : ''}`)

  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn('opencode', args, {
      cwd: repoPath,
      env: cleanEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    child.stdin.write(promptContent)
    child.stdin.end()

    let rawOutput = ''
    let stderr = ''

    child.stdout.on('data', (chunk: Buffer) => { rawOutput += chunk.toString() })
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
      process.stderr.write(chunk)
    })

    const timer = setTimeout(() => {
      child.kill('SIGTERM')
      rejectPromise(new Error(`opencode timed out after ${timeout / 1000}s`))
    }, timeout)

    child.on('close', (code) => {
      clearTimeout(timer)
      // Extract text from NDJSON events
      const textParts: string[] = []
      for (const line of rawOutput.split('\n')) {
        if (!line.trim()) continue
        try {
          const event = JSON.parse(line)
          if (event.type === 'text' && event.part?.text) {
            textParts.push(event.part.text)
          }
        } catch { /* skip non-JSON lines */ }
      }
      resolvePromise({ stdout: textParts.join(''), stderr, exitCode: code ?? 1 })
    })
    child.on('error', (err) => { clearTimeout(timer); rejectPromise(err) })
  })
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

function severityTag(severity: ReviewComment['severity']): string {
  switch (severity) {
    case 'critical': return `${C.red}${C.bold}CRITICAL${C.reset}`
    case 'warning': return `${C.yellow}WARNING${C.reset}`
    case 'suggestion': return `${C.cyan}suggestion${C.reset}`
  }
}

function displayReviewResult(result: ReviewResult): void {
  if (result.comments.length === 0) {
    console.log(`\n  ${C.green}No issues found. Clean diff.${C.reset}\n`)
    return
  }

  console.log(`\n  ${result.comments.length} comment(s):\n`)

  for (let i = 0; i < result.comments.length; i++) {
    const c = result.comments[i]
    const location = c.endLine && c.endLine > c.line
      ? `${c.file}:${c.line}-${c.endLine}`
      : `${c.file}:${c.line}`

    console.log(`  ${C.dim}${i + 1}.${C.reset} ${severityTag(c.severity)}  ${C.bold}${location}${C.reset}`)
    console.log(`     ${c.message}`)

    if (c.suggestion) {
      console.log(`     ${C.dim}suggestion:${C.reset}`)
      for (const line of c.suggestion.split('\n')) {
        console.log(`     ${C.green}${line}${C.reset}`)
      }
    }

    console.log()
  }
}

// ---------------------------------------------------------------------------
// Modes
// ---------------------------------------------------------------------------

interface AnalysisOptions {
  repoPath: string
  model: string
  output?: string
  dryRun: boolean
}

async function runAnalysis(options: AnalysisOptions): Promise<void> {
  const { repoPath, model, output, dryRun } = options

  log(`analyzing ${repoPath}`)
  log(`model: ${model}`)

  const prompt = `Follow the analysis process in your instructions.\nAnalyze this codebase thoroughly and produce the Codebase Profile document.\n\n${ANALYSIS_SYSTEM_PROMPT}`

  if (dryRun) {
    console.log('\n--- ANALYSIS PROMPT ---')
    console.log(prompt)
    console.log('--- END PROMPT ---')
    log(`prompt length: ${prompt.length} chars`)
    return
  }

  const tempDir = await mkdtemp(join(tmpdir(), 'reviewbot-analyze-'))
  const promptFile = join(tempDir, 'prompt.txt')
  await writeFile(promptFile, prompt)

  try {
    log(`running opencode analysis (${model})...`)

    const result = await runOpenCode({
      model,
      repoPath,
      userPromptFile: promptFile,
      timeout: ANALYSIS_TIMEOUT_MS,
    })

    if (result.exitCode !== 0) {
      log(`opencode exited with code ${result.exitCode}`)
    }

    const profile = result.stdout.trim()
    if (!profile) {
      die('empty output from opencode')
    }

    log(`analysis complete (${profile.length} chars)`)
    console.log('\n' + profile)

    if (output) {
      await writeFile(output, profile)
      log(`saved to ${output}`)
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}

interface ReviewOptions {
  repoPath: string
  baseBranch: string
  model: string
  persona: string
  analysis: string
  customSkills: CustomSkill[]
  output?: string
  dryRun: boolean
}

async function runReview(options: ReviewOptions): Promise<void> {
  const { repoPath, baseBranch, model, persona, analysis, customSkills, output, dryRun } = options

  const diffResult = await generateLocalDiff(repoPath, baseBranch)
  const { files, metadata } = diffResult

  log(`reviewing ${repoPath} (${metadata.currentBranch} vs ${baseBranch})`)
  log(`model: ${model}`)

  const totalAdds = files.reduce((s, f) => s + f.additions, 0)
  const totalDels = files.reduce((s, f) => s + f.deletions, 0)
  log(`diff: ${files.length} files changed, +${totalAdds} -${totalDels} (${metadata.commitCount} commit(s))`)

  if (files.length === 0) die(`no files changed between HEAD and ${baseBranch}`)
  if (files.length > 100) die(`too many files changed (${files.length}). Max 100.`)

  const formattedDiff = formatGitHubDiff(files)

  const systemPrompt = buildReviewSystemPrompt(
    persona || '(No team persona provided. Apply baseline rules only.)',
    analysis || '(No codebase analysis available.)',
    formatPredefinedSkillsForPrompt(),
    customSkills.length > 0 ? formatCustomSkillsForPrompt(customSkills) : '(No custom skills configured.)',
  )

  const mrMetadata: MRMetadata = {
    title: metadata.title,
    description: `Local review: ${metadata.currentBranch} vs ${baseBranch} (${metadata.commitCount} commit(s))`,
    author: metadata.author,
    targetBranch: baseBranch,
    fileCount: files.length,
  }

  const mrContext = buildMRContext(formattedDiff, mrMetadata)

  if (dryRun) {
    console.log('\n--- SYSTEM PROMPT ---')
    console.log(systemPrompt)
    console.log(`\n--- MR CONTEXT (user message) ---`)
    console.log(mrContext)
    console.log('--- END ---')
    log(`system prompt: ${systemPrompt.length} chars`)
    log(`MR context: ${mrContext.length} chars`)
    return
  }

  const tempDir = await mkdtemp(join(tmpdir(), 'reviewbot-review-'))

  try {
    const systemPromptFile = join(tempDir, 'system-prompt.md')
    const userPromptFile = join(tempDir, 'mr-context.md')
    await writeFile(systemPromptFile, systemPrompt)
    await writeFile(userPromptFile, mrContext)

    log(`running opencode review (${model})...`)

    const cliResult = await runOpenCode({
      model,
      repoPath,
      systemPromptFile,
      userPromptFile,
      timeout: REVIEW_TIMEOUT_MS,
    })

    if (cliResult.exitCode !== 0) {
      log(`opencode exited with code ${cliResult.exitCode}`)
    }

    const rawOutput = cliResult.stdout.trim()
    if (!rawOutput) die('empty output from opencode')

    let result: ReviewResult
    try {
      result = parseJSON<ReviewResult>(rawOutput)
    } catch {
      console.error(`\n${C.red}Failed to parse JSON response. Raw output:${C.reset}`)
      console.error(rawOutput.slice(0, 2000))
      die('LLM did not return valid JSON')
    }

    if (!result.comments || !Array.isArray(result.comments)) {
      console.error(`Invalid response shape:`, JSON.stringify(result).slice(0, 500))
      die('LLM response missing "comments" array')
    }

    log(`review complete`)
    displayReviewResult(result)

    if (result.comments.length > 0) {
      console.log(`${C.dim}  --- As posted on GitHub/GitLab ---${C.reset}\n`)
      for (const c of result.comments) {
        const location = c.endLine && c.endLine > c.line
          ? `${c.file}:${c.line}-${c.endLine}`
          : `${c.file}:${c.line}`
        console.log(`  ${C.dim}${location}${C.reset}`)
        console.log(`  ${formatComment(c)}`)
        console.log()
      }
    }

    if (output) {
      await writeFile(output, JSON.stringify(result, null, 2))
      log(`saved JSON to ${output}`)
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}

// ---------------------------------------------------------------------------
// Usage
// ---------------------------------------------------------------------------

function printUsage(): void {
  console.log(`
${C.bold}reviewbot test-local${C.reset} — test analysis and review against a local repo

${C.bold}Usage:${C.reset}
  pnpm test:local <mode> [options]

${C.bold}Modes:${C.reset}
  analyze   Generate a codebase analysis profile
  review    Generate review comments for the diff vs a base branch

${C.bold}Options:${C.reset}
  --repo, -r <path>       Path to the local repository (default: .)
  --branch, -b <name>     Base branch for review mode (required for review)
  --persona <path>        Path to persona markdown file (review only)
  --analysis, -a <path>   Path to analysis profile file (review only)
  --skills <path>         Path to custom skills JSON file (review only)
                          Format: [{"name": "...", "content": "..."}]
  --output, -o <path>     Save output to file
  --model, -m <name>      LLM model in provider/model format (default: ${DEFAULT_MODEL})
  --dry-run               Print prompts without running the LLM
  --help, -h              Show this help

${C.bold}Examples:${C.reset}
  pnpm test:local analyze --repo /path/to/repo
  pnpm test:local review --repo /path/to/repo --branch main
  pnpm test:local review -r . -b main --persona persona.md --analysis analysis.md
  pnpm test:local analyze -r /path/to/repo --output analysis.md
  pnpm test:local review -r . -b main --dry-run
  pnpm test:local review -r . -b main -m openai/o3
  pnpm test:local analyze -r . -m opencode/gpt-5-nano

${C.bold}Auth:${C.reset}
  Uses opencode's built-in auth (opencode auth).
  Run "opencode models" to see available models.
`)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      repo: { type: 'string', short: 'r' },
      branch: { type: 'string', short: 'b' },
      persona: { type: 'string' },
      analysis: { type: 'string', short: 'a' },
      skills: { type: 'string' },
      output: { type: 'string', short: 'o' },
      model: { type: 'string', short: 'm' },
      'dry-run': { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
    allowPositionals: true,
    strict: false,
  })

  const mode = positionals[0] as 'analyze' | 'review' | undefined

  if (values.help || !mode) {
    printUsage()
    process.exit(values.help ? 0 : 1)
  }

  if (mode !== 'analyze' && mode !== 'review') {
    die(`unknown mode "${mode}". Use "analyze" or "review".`)
  }

  // --- Resolve and validate repo path ---
  const repoPath = resolve(values.repo as string ?? '.')

  try {
    await stat(repoPath)
  } catch {
    die(`repository path does not exist: ${repoPath}`)
  }

  const gitCheck = await execGit(repoPath, ['rev-parse', '--git-dir'])
  if (gitCheck.exitCode !== 0) {
    die(`${repoPath} is not a git repository`)
  }

  const dryRun = (values['dry-run'] ?? false) as boolean

  // --- CLI availability ---
  if (!dryRun) {
    const exists = await commandExists('opencode')
    if (!exists) {
      die('"opencode" CLI not found in PATH. Install: curl -fsSL https://opencode.ai/install | bash')
    }
  }

  // --- Model ---
  const model = (values.model as string) ?? DEFAULT_MODEL

  // --- Warn about uncommitted changes ---
  const dirtyCheck = await execGit(repoPath, ['status', '--porcelain'])
  if (dirtyCheck.stdout.trim()) {
    log(`${C.yellow}warning: uncommitted changes detected (not included in review)${C.reset}`)
  }

  // --- Route to mode ---
  if (mode === 'analyze') {
    await runAnalysis({
      repoPath,
      model,
      output: values.output ? resolve(values.output as string) : undefined,
      dryRun,
    })
  } else {
    if (!values.branch) {
      die('--branch is required for review mode (the base branch to diff against)')
    }

    const branch = values.branch as string
    const branchCheck = await execGit(repoPath, ['rev-parse', '--verify', branch])
    if (branchCheck.exitCode !== 0) {
      die(`branch "${branch}" does not exist in ${repoPath}`)
    }

    const mergeBase = (await execGit(repoPath, ['merge-base', branch, 'HEAD'])).stdout.trim()
    const diffCheck = await execGit(repoPath, ['diff', '--quiet', `${mergeBase}..HEAD`])
    if (diffCheck.exitCode === 0) {
      die(`no diff between HEAD and ${branch}. Nothing to review.`)
    }

    let persona = ''
    let analysis = ''
    let customSkills: CustomSkill[] = []

    if (values.persona) {
      try { persona = await readFile(resolve(values.persona as string), 'utf8') }
      catch { die(`cannot read persona file: ${values.persona}`) }
    }

    if (values.analysis) {
      try { analysis = await readFile(resolve(values.analysis as string), 'utf8') }
      catch { die(`cannot read analysis file: ${values.analysis}`) }
    }

    if (values.skills) {
      try {
        const raw = await readFile(resolve(values.skills as string), 'utf8')
        customSkills = JSON.parse(raw)
      } catch { die(`cannot read or parse skills file: ${values.skills}`) }
    }

    await runReview({
      repoPath,
      baseBranch: branch,
      model,
      persona,
      analysis,
      customSkills,
      output: values.output ? resolve(values.output as string) : undefined,
      dryRun,
    })
  }
}

main().catch((err) => {
  if (err instanceof Error) {
    die(err.message)
  }
  die(String(err))
})
