import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { saveProviderTokens } from '@/lib/provider-token'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    console.log(`[auth/callback] exchangeCodeForSession: error=${error?.message ?? 'none'}, has_session=${!!data?.session}`)

    if (!error && data.session) {
      // Determine which provider was used for THIS login.
      // Primary: explicit ?provider= param passed from the login page (most reliable).
      // Fallback: sort identities by last_sign_in_at (unreliable when both are linked).
      let provider = searchParams.get('provider')

      if (!provider) {
        const identities = data.session.user?.identities ?? []
        provider = data.session.user?.app_metadata?.provider ?? 'github'
        if (identities.length > 0) {
          const sorted = [...identities].sort((a, b) =>
            new Date(b.last_sign_in_at ?? 0).getTime() - new Date(a.last_sign_in_at ?? 0).getTime()
          )
          provider = sorted[0].provider ?? provider
        }
      }

      console.log(`[auth/callback] provider=${provider}, user=${data.session.user.id}, has_token=${!!data.session.provider_token}, has_refresh=${!!data.session.provider_refresh_token}`)

      // Store provider token in the database (user_settings table).
      // This is the only time the provider_token is available from Supabase.
      // Wrapped in try-catch so a DB error doesn't break the login redirect.
      if (data.session.provider_token) {
        try {
          await saveProviderTokens(
            supabase,
            data.session.user.id,
            provider,
            data.session.provider_token,
            data.session.provider_refresh_token,
          )
        } catch (err) {
          console.error(`[auth/callback] failed to save provider tokens:`, err)
        }
      } else {
        console.error(`[auth/callback] WARNING: no provider_token in session for ${provider}`)
      }

      // Keep a lightweight provider cookie so the app knows which provider was used.
      const response = NextResponse.redirect(`${origin}${next}`)
      response.cookies.set('provider', provider, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
      })

      return response
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
