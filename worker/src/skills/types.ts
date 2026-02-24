// ---------------------------------------------------------------------------
// Skill types — shared between predefined (static .md files) and custom (DB)
// ---------------------------------------------------------------------------

export type SkillCategory = 'languages' | 'frameworks' | 'patterns' | 'testing' | 'infra'

export interface PredefinedSkill {
  /** Filename without extension, e.g. "typescript" */
  id: string
  /** Display name extracted from the markdown heading, e.g. "TypeScript" */
  name: string
  /** Category derived from parent directory */
  category: SkillCategory
  /** The raw markdown content (rules) */
  content: string
}

export interface CustomSkill {
  /** UUID generated client-side */
  id: string
  /** User-provided skill name */
  name: string
  /** User-authored markdown rules, max 2000 chars */
  content: string
}
