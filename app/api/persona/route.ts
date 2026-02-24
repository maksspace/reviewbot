import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { slug, persona } = await request.json()

  if (!slug || typeof persona !== 'string') {
    return NextResponse.json({ error: 'Missing slug or persona' }, { status: 400 })
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  )

  const { error } = await admin
    .from('connected_repositories')
    .update({
      persona_data: {
        persona,
        generated_at: new Date().toISOString(),
        edited: true,
      },
    })
    .eq('user_id', user.id)
    .eq('slug', slug)

  if (error) {
    console.error('[persona] save failed:', error.message)
    return NextResponse.json({ error: 'Failed to save persona' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
