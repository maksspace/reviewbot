import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import type { InterviewNextResponse } from '@/lib/types/interview'

interface LLMCallOptions {
  provider: string
  model: string
  apiKey: string
  system: string
  user: string
}

const DEFAULT_MODELS: Record<string, string> = {
  openai: 'gpt-4.1',
  anthropic: 'claude-sonnet-4-5-20250514',
}

export async function callLLM(options: LLMCallOptions): Promise<string> {
  const { provider, apiKey, system, user } = options
  const model = options.model || DEFAULT_MODELS[provider] || DEFAULT_MODELS.anthropic

  if (provider === 'openai') {
    const client = new OpenAI({ apiKey })
    const response = await client.chat.completions.create({
      model,
      max_completion_tokens: 4096,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      response_format: { type: 'json_object' },
    })
    return response.choices[0]?.message?.content ?? ''
  }

  // Default: Anthropic
  const client = new Anthropic({ apiKey })
  const response = await client.messages.create({
    model,
    max_tokens: 4096,
    system,
    messages: [{ role: 'user', content: user }],
  })

  const textBlock = response.content.find((b) => b.type === 'text')
  return textBlock?.text ?? ''
}

/**
 * Fix unescaped control characters inside JSON string values.
 * LLMs sometimes return literal newlines/tabs inside strings instead of \n / \t.
 */
function sanitizeJsonString(json: string): string {
  // Fix unescaped control chars inside JSON string values
  // Walk through the string tracking whether we're inside a JSON string
  let result = ''
  let inString = false
  let escaped = false

  for (let i = 0; i < json.length; i++) {
    const ch = json[i]

    if (escaped) {
      result += ch
      escaped = false
      continue
    }

    if (ch === '\\' && inString) {
      result += ch
      escaped = true
      continue
    }

    if (ch === '"') {
      inString = !inString
      result += ch
      continue
    }

    if (inString) {
      // Replace literal control characters with their escape sequences
      if (ch === '\n') { result += '\\n'; continue }
      if (ch === '\r') { result += '\\r'; continue }
      if (ch === '\t') { result += '\\t'; continue }
    }

    result += ch
  }

  return result
}

export function parseAgentResponse(raw: string): InterviewNextResponse {
  // Strip markdown code fences if the LLM wraps output
  let cleaned = raw.trim()
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7)
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3)
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3)
  }
  cleaned = cleaned.trim()

  // Try parsing as-is first, fall back to sanitized version
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    console.log('[interview] JSON parse failed, attempting to sanitize...')
    cleaned = sanitizeJsonString(cleaned)
    parsed = JSON.parse(cleaned)
  }

  if (parsed.status === 'complete' && typeof parsed.persona === 'string') {
    return parsed as InterviewNextResponse
  }

  if (parsed.status === 'question' && parsed.question) {
    const q = parsed.question
    if (!q.type || !q.question || !q.category) {
      throw new Error(`Question missing required fields (type/question/category)`)
    }

    // Validate fields per question type
    const needsOptions = ['single_select', 'multi_select', 'code_opinion']
    if (needsOptions.includes(q.type) && (!Array.isArray(q.options) || q.options.length === 0)) {
      throw new Error(`Question type "${q.type}" requires non-empty options array`)
    }
    if (q.type === 'code_opinion' && (!q.codeSnippet || !q.codeFile)) {
      throw new Error(`code_opinion question requires codeSnippet and codeFile`)
    }
    if (q.type === 'confirm_correct' && (!Array.isArray(q.detections) || q.detections.length === 0)) {
      throw new Error(`confirm_correct question requires non-empty detections array`)
    }

    return parsed as InterviewNextResponse
  }

  throw new Error(`Invalid agent response: status="${parsed.status}"`)
}
