import { readdirSync, readFileSync } from 'node:fs'
import { join, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { PredefinedSkill, CustomSkill, SkillCategory } from './types.js'

// ---------------------------------------------------------------------------
// Load predefined skills from disk (once at module init)
// ---------------------------------------------------------------------------

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const PREDEFINED_DIR = join(__dirname, 'predefined')

const VALID_CATEGORIES = new Set<SkillCategory>([
  'languages', 'frameworks', 'patterns', 'testing', 'infra',
])

function extractName(content: string, fallback: string): string {
  // Extract name from first ## heading: "## TypeScript" → "TypeScript"
  const match = content.match(/^##\s+(.+)$/m)
  return match ? match[1].trim() : fallback
}

function loadAll(): PredefinedSkill[] {
  const skills: PredefinedSkill[] = []

  let categories: string[]
  try {
    categories = readdirSync(PREDEFINED_DIR)
  } catch {
    console.warn('[skills] predefined skills directory not found:', PREDEFINED_DIR)
    return []
  }

  for (const cat of categories) {
    if (!VALID_CATEGORIES.has(cat as SkillCategory)) continue

    const catDir = join(PREDEFINED_DIR, cat)
    let files: string[]
    try {
      files = readdirSync(catDir).filter((f) => f.endsWith('.md'))
    } catch {
      continue
    }

    for (const file of files) {
      const content = readFileSync(join(catDir, file), 'utf8').trim()
      const id = basename(file, '.md')
      const name = extractName(content, id)

      skills.push({
        id,
        name,
        category: cat as SkillCategory,
        content,
      })
    }
  }

  return skills.sort((a, b) => a.id.localeCompare(b.id))
}

/** All predefined skills, loaded once at startup */
export const PREDEFINED_SKILLS: PredefinedSkill[] = loadAll()

// ---------------------------------------------------------------------------
// Formatters for prompt injection
// ---------------------------------------------------------------------------

/**
 * Format all predefined skills into a single markdown string for the review prompt.
 * Groups by category. Each skill is a sub-heading with its rules.
 */
export function formatPredefinedSkillsForPrompt(): string {
  if (PREDEFINED_SKILLS.length === 0) return '(none)'

  const byCategory = new Map<SkillCategory, PredefinedSkill[]>()
  for (const skill of PREDEFINED_SKILLS) {
    const list = byCategory.get(skill.category) ?? []
    list.push(skill)
    byCategory.set(skill.category, list)
  }

  const sections: string[] = []
  const order: SkillCategory[] = ['languages', 'frameworks', 'patterns', 'testing', 'infra']

  for (const cat of order) {
    const skills = byCategory.get(cat)
    if (!skills?.length) continue

    for (const skill of skills) {
      // Strip the ## heading since we're re-formatting
      const rules = skill.content
        .replace(/^##\s+.+\n*/m, '')
        .trim()
      sections.push(`#### ${skill.name}\n${rules}`)
    }
  }

  return sections.join('\n\n')
}

/**
 * Format custom skills (from DB) into a markdown string for the review prompt.
 */
export function formatCustomSkillsForPrompt(skills: CustomSkill[]): string {
  if (!skills?.length) return '(none)'

  return skills
    .map((s) => `#### ${s.name}\n${s.content.trim()}`)
    .join('\n\n')
}

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

/** Get a single predefined skill by ID */
export function getPredefinedSkill(id: string): PredefinedSkill | undefined {
  return PREDEFINED_SKILLS.find((s) => s.id === id)
}

/** Get all predefined skills grouped by category */
export function getPredefinedSkillsByCategory(): Record<SkillCategory, PredefinedSkill[]> {
  const result: Record<SkillCategory, PredefinedSkill[]> = {
    languages: [],
    frameworks: [],
    patterns: [],
    testing: [],
    infra: [],
  }
  for (const skill of PREDEFINED_SKILLS) {
    result[skill.category].push(skill)
  }
  return result
}

export type { PredefinedSkill, CustomSkill, SkillCategory } from './types.js'
