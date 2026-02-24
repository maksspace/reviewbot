import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import Stripe from 'stripe'
import { getStripe } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'

/** Safely convert a Stripe timestamp (seconds) to ISO string, or null. */
function toISO(epoch: number | null | undefined): string | null {
  if (epoch == null || !Number.isFinite(epoch)) return null
  const d = new Date(epoch * 1000)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

// Use service-role client for webhook (no user session)
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
  )
}

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    )
  } catch (err) {
    console.error('[stripe] webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = getServiceClient()

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const userId = session.metadata?.user_id
      const subscriptionId = session.subscription as string

      if (!userId) break

      // Fetch subscription details from Stripe
      const subscription = await getStripe().subscriptions.retrieve(subscriptionId)

      await supabase
        .from('subscriptions')
        .upsert({
          user_id: userId,
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: subscriptionId,
          plan: 'pro',
          status: 'active',
          current_period_end: toISO(subscription.current_period_end),
        }, { onConflict: 'user_id' })

      console.log(`[stripe] user ${userId} upgraded to pro`)
      break
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription
      const customerId = subscription.customer as string

      // Look up user by customer ID
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('user_id')
        .eq('stripe_customer_id', customerId)
        .single()

      if (!sub) break

      const status = subscription.status === 'active' ? 'active'
        : subscription.status === 'past_due' ? 'past_due'
        : subscription.status === 'canceled' ? 'canceled'
        : subscription.status

      await supabase
        .from('subscriptions')
        .update({
          status,
          current_period_end: toISO(subscription.current_period_end),
        })
        .eq('user_id', sub.user_id)

      console.log(`[stripe] subscription updated for user ${sub.user_id}: ${status}`)
      break
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      const customerId = subscription.customer as string

      const { data: sub } = await supabase
        .from('subscriptions')
        .select('user_id')
        .eq('stripe_customer_id', customerId)
        .single()

      if (!sub) break

      await supabase
        .from('subscriptions')
        .update({
          plan: 'free',
          status: 'canceled',
          stripe_subscription_id: null,
          current_period_end: null,
        })
        .eq('user_id', sub.user_id)

      console.log(`[stripe] subscription canceled for user ${sub.user_id}`)
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      const customerId = invoice.customer as string

      const { data: sub } = await supabase
        .from('subscriptions')
        .select('user_id')
        .eq('stripe_customer_id', customerId)
        .single()

      if (!sub) break

      await supabase
        .from('subscriptions')
        .update({ status: 'past_due' })
        .eq('user_id', sub.user_id)

      console.log(`[stripe] payment failed for user ${sub.user_id}`)
      break
    }
  }

  return NextResponse.json({ received: true })
}
