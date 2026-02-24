import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.session) {
      const response = NextResponse.redirect(`${origin}${next}`)

      // Store the provider token so we can call GitHub/GitLab APIs later.
      // This is the only time the provider_token is available from Supabase.
      if (data.session.provider_token) {
        response.cookies.set('provider_token', data.session.provider_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: 60 * 60 * 24 * 30, // 30 days
        })
      }

      if (data.session.provider_refresh_token) {
        response.cookies.set('provider_refresh_token', data.session.provider_refresh_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: 60 * 60 * 24 * 30,
        })
      }

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
