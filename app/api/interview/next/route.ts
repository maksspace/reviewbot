import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { buildInterviewMessages } from '../prompt'
import { callLLM, parseAgentResponse } from '../llm'
import type { InterviewNextRequest } from '@/lib/types/interview'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ status: 'error', message: 'Unauthorized' }, { status: 401 })
  }

  const body: InterviewNextRequest = await request.json()
  const { slug, answers } = body

  if (!slug) {
    return NextResponse.json({ status: 'error', message: 'Missing slug' }, { status: 400 })
  }

  // Fetch analysis profile
  const { data: repo, error: repoError } = await supabase
    .from('connected_repositories')
    .select('analysis_data, name')
    .eq('user_id', user.id)
    .eq('slug', slug)
    .single()

  if (repoError || !repo) {
    return NextResponse.json({ status: 'error', message: 'Repository not found' }, { status: 404 })
  }

  const analysisProfile: string = repo.analysis_data?.profile ?? ''

  // Fetch LLM settings
  const { data: settings } = await supabase
    .from('user_settings')
    .select('provider, model, api_key')
    .eq('user_id', user.id)
    .single()

  if (!settings?.api_key) {
    return NextResponse.json(
      { status: 'error', message: 'No API key configured. Go to Settings to add one.' },
      { status: 400 },
    )
  }

  // Build prompt and call LLM
  const { system, user: userMessage } = buildInterviewMessages(analysisProfile, answers ?? [])

  let rawResponse: string
  try {
    rawResponse = await callLLM({
      provider: settings.provider ?? 'anthropic',
      model: settings.provider === 'openai' ? 'gpt-5.2' : 'claude-sonnet-4-6',
      apiKey: settings.api_key,
      system,
      user: userMessage,
    })
  } catch (err) {
    console.error('[interview] LLM call failed:', err)
    return NextResponse.json(
      { status: 'error', message: `LLM call failed: ${err instanceof Error ? err.message : 'Unknown error'}` },
      { status: 502 },
    )
  }

  // Parse agent response
  let parsed
  try {
    parsed = parseAgentResponse(rawResponse)
  } catch (err) {
    console.log(err)
    console.error('[interview] Failed to parse agent response:', rawResponse.slice(0, 500))
    return NextResponse.json(
      { status: 'error', message: 'Failed to parse agent response' },
      { status: 500 },
    )
  }

  // If complete, store persona and flip status (use service role to bypass RLS)
  if (parsed.status === 'complete') {
    console.log(`[interview] interview complete for ${slug}, saving persona (${parsed.persona.length} chars)...`)

    const admin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!,
    )

    const { error: updateError, data: updateData } = await admin
      .from('connected_repositories')
      .update({
        status: 'active',
        persona_data: {
          persona: parsed.persona,
          generated_at: new Date().toISOString(),
        },
      })
      .eq('user_id', user.id)
      .eq('slug', slug)
      .select()

    if (updateError) {
      console.error('[interview] Failed to store persona:', updateError.message, updateError.details, updateError.hint)
    } else {
      console.log(`[interview] persona saved for ${slug}, matched rows:`, updateData?.length ?? 0)
    }
  }

  return NextResponse.json(parsed)
}
