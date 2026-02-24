-- Reviews table: stores completed PR/MR review records
CREATE TABLE IF NOT EXISTS reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  repo_slug TEXT NOT NULL,
  pr_number INTEGER NOT NULL,
  pr_title TEXT,
  pr_url TEXT,
  pr_author TEXT,
  verdict TEXT NOT NULL,
  summary TEXT,
  comment_count INTEGER DEFAULT 0,
  comments JSONB DEFAULT '[]'::jsonb,
  llm_provider TEXT,
  llm_model TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reviews_repo ON reviews (user_id, repo_slug);
CREATE INDEX IF NOT EXISTS idx_reviews_created ON reviews (user_id, created_at DESC);

-- Enable RLS
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Users can only read their own reviews
CREATE POLICY "Users can view own reviews"
  ON reviews
  FOR SELECT
  USING (auth.uid() = user_id);

-- Only the service role (worker) can insert reviews.
-- The worker uses SUPABASE_SECRET_KEY which bypasses RLS,
-- so no INSERT policy is needed for regular users.
-- But we add one scoped to own user_id as a safety net.
CREATE POLICY "Service role inserts reviews"
  ON reviews
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users cannot update or delete reviews (immutable audit log)
-- No UPDATE or DELETE policies = blocked by RLS

-- Also add provider_token column to connected_repositories if not exists
ALTER TABLE connected_repositories ADD COLUMN IF NOT EXISTS provider_token TEXT;
