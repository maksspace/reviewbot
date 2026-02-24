-- Subscription tracking for Stripe billing
CREATE TABLE IF NOT EXISTS subscriptions (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  plan TEXT NOT NULL DEFAULT 'free',        -- 'free' | 'pro'
  status TEXT NOT NULL DEFAULT 'active',    -- 'active' | 'canceled' | 'past_due' | 'trialing'
  current_period_end TIMESTAMPTZ,
  review_count_month INT NOT NULL DEFAULT 0,
  review_count_reset_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can read their own subscription
CREATE POLICY "Users can view own subscription"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can do everything (for webhook + worker)
CREATE POLICY "Service role full access"
  ON subscriptions FOR ALL
  USING (true)
  WITH CHECK (true);

-- Atomic increment for review count (avoids race conditions in worker)
CREATE OR REPLACE FUNCTION increment_review_count(uid UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO subscriptions (user_id, review_count_month, review_count_reset_at)
  VALUES (uid, 1, NOW())
  ON CONFLICT (user_id)
  DO UPDATE SET review_count_month = subscriptions.review_count_month + 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
