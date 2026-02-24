import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const priceId = process.env.STRIPE_PRICE_ID
  if (!priceId) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  // Check if user already has a Stripe customer
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .single()

  let customerId = sub?.stripe_customer_id

  // Find or create Stripe customer
  if (!customerId) {
    // Search Stripe for existing customer by email
    const existing = await getStripe().customers.list({
      email: user.email!,
      limit: 1,
    })

    let customer: { id: string }
    if (existing.data.length > 0) {
      customer = existing.data[0]
      // Update metadata in case it was missing
      await getStripe().customers.update(customer.id, {
        metadata: { user_id: user.id },
      })
    } else {
      customer = await getStripe().customers.create({
        email: user.email,
        metadata: { user_id: user.id },
      })
    }
    customerId = customer.id

    // Upsert subscription row with customer ID
    await supabase
      .from('subscriptions')
      .upsert({
        user_id: user.id,
        stripe_customer_id: customerId,
        plan: 'free',
        status: 'active',
        review_count_month: 0,
        review_count_reset_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
  }

  // Create Checkout Session
  const session = await getStripe().checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/dashboard/settings?upgraded=true`,
    cancel_url: `${appUrl}/dashboard/settings`,
    metadata: { user_id: user.id },
  })

  return NextResponse.json({ url: session.url })
}
