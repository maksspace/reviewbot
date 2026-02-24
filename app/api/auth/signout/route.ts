import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = await createClient()
  await supabase.auth.signOut()

  const response = NextResponse.json({ ok: true })

  // Clear httpOnly provider token cookies
  response.cookies.set('provider_token', '', { path: '/', maxAge: 0 })
  response.cookies.set('provider_refresh_token', '', { path: '/', maxAge: 0 })
  response.cookies.set('provider', '', { path: '/', maxAge: 0 })

  return response
}
