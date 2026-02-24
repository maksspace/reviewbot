import Stripe from 'stripe'

let _stripe: Stripe | null = null

/** Lazy-initialized Stripe client (avoids build-time crash when env var is missing) */
export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { typescript: true })
  }
  return _stripe
}

/** Free plan limits */
export const FREE_LIMITS = {
  repos: 1,
  reviewsPerMonth: 50,
} as const

/** Plan types */
export type Plan = 'free' | 'pro'
