import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = await createClient()
  await supabase.auth.signOut()

  const response = NextResponse.json({ ok: true })

  // Clear provider cookie
  response.cookies.set('provider', '', { path: '/', maxAge: 0 })

  return response
}
