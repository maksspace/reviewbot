import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data } = await supabase
    .from('user_settings')
    .select('provider, model, api_key, max_comments')
    .eq('user_id', user.id)
    .single()

  // Return defaults if no row exists yet
  const settings = data ?? {
    provider: 'openai',
    model: 'openai/gpt-5.2-codex',
    api_key: null,
    max_comments: 10,
  }

  // Backward compat: old rows store model without provider/ prefix
  let model = settings.model ?? 'gpt-5.2-codex'
  if (!model.includes('/')) {
    const p = settings.provider ?? 'openai'
    model = `${p}/${model}`
  }

  // Mask the API key for the client
  return NextResponse.json({
    model,
    max_comments: settings.max_comments,
    api_key: settings.api_key
      ? settings.api_key.slice(0, 7) + '...' + settings.api_key.slice(-4)
      : '',
    has_api_key: !!settings.api_key,
  })
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { model, api_key, max_comments } = body

  // Derive provider from model string (e.g., "openai/gpt-5.2-codex" → "openai")
  const slash = (model as string)?.indexOf('/')
  const provider = slash > 0 ? (model as string).slice(0, slash) : 'openai'

  const row: Record<string, unknown> = {
    user_id: user.id,
    provider,
    model,
    max_comments: Math.max(1, Math.min(50, max_comments ?? 10)),
    updated_at: new Date().toISOString(),
  }

  // Only update api_key if a new value was explicitly provided
  // (not the masked placeholder)
  if (api_key && !api_key.includes('...')) {
    row.api_key = api_key
  }

  const { error } = await supabase
    .from('user_settings')
    .upsert(row, { onConflict: 'user_id' })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
