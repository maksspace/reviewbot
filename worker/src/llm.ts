import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'

export interface LLMCallOptions {
  provider: string
  model: string
  apiKey: string
  system: string
  user: string
}

export async function callLLM(options: LLMCallOptions): Promise<string> {
  const { provider, model, apiKey, system, user } = options

  if (provider === 'openai') {
    const client = new OpenAI({ apiKey })
    const response = await client.chat.completions.create({
      model,
      max_completion_tokens: 8192,
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
    max_tokens: 8192,
    system,
    messages: [{ role: 'user', content: user }],
  })

  const textBlock = response.content.find((b) => b.type === 'text')
  return textBlock?.text ?? ''
}

/**
 * Parse JSON from LLM response, stripping markdown fences if present.
 */
export function parseJSON<T>(raw: string): T {
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

  return JSON.parse(cleaned) as T
}
