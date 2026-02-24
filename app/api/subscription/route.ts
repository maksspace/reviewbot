import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { FREE_LIMITS } from '@/lib/stripe'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch subscription
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('plan, status, review_count_month, review_count_reset_at, current_period_end, stripe_customer_id')
    .eq('user_id', user.id)
    .single()

  // Count connected repos
  const { count: repoCount } = await supabase
    .from('connected_repositories')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  const plan = sub?.plan ?? 'free'
  const isPro = plan === 'pro' && sub?.status === 'active'

  // Count actual reviews this month from the reviews table
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const { count: reviewsThisMonth } = await supabase
    .from('reviews')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', startOfMonth.toISOString())

  const reviewsUsed = reviewsThisMonth ?? 0

  return NextResponse.json({
    plan,
    status: sub?.status ?? 'active',
    reviewsUsed,
    reviewsLimit: isPro ? null : FREE_LIMITS.reviewsPerMonth,
    reposUsed: repoCount ?? 0,
    reposLimit: isPro ? null : FREE_LIMITS.repos,
    currentPeriodEnd: sub?.current_period_end ?? null,
    hasStripeCustomer: !!sub?.stripe_customer_id,
  })
}
