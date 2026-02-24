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

    if (!error && data.session) {
      const response = NextResponse.redirect(`${origin}${next}`)

      // Determine which provider was used for THIS login.
      // app_metadata.provider is the FIRST provider ever used (not current),
      // so we check identities sorted by last_sign_in_at instead.
      const identities = data.session.user?.identities ?? []
      let provider = data.session.user?.app_metadata?.provider ?? 'github'
      if (identities.length > 0) {
        const sorted = [...identities].sort((a, b) =>
          new Date(b.last_sign_in_at ?? 0).getTime() - new Date(a.last_sign_in_at ?? 0).getTime()
        )
        provider = sorted[0].provider ?? provider
      }

      // Store provider token in the database (user_settings table).
      // This is the only time the provider_token is available from Supabase.
      if (data.session.provider_token) {
        await saveProviderTokens(
          supabase,
          data.session.user.id,
          provider,
          data.session.provider_token,
          data.session.provider_refresh_token,
        )
      }

      // Keep a lightweight provider cookie so the app knows which provider was used.
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
