-- Add provider_refresh_token column for GitHub/GitLab OAuth token refresh.
-- GitHub expiring tokens (8h) need refresh tokens (6mo) to stay valid.
ALTER TABLE connected_repositories
  ADD COLUMN IF NOT EXISTS provider_refresh_token TEXT;
