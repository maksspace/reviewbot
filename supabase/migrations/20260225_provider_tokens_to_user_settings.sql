-- Move provider tokens from connected_repositories to user_settings.
-- One token per provider per user (not per repo).

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS github_token TEXT,
  ADD COLUMN IF NOT EXISTS github_refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS gitlab_token TEXT,
  ADD COLUMN IF NOT EXISTS gitlab_refresh_token TEXT;

-- Remove token columns from connected_repositories (no longer needed).
ALTER TABLE connected_repositories
  DROP COLUMN IF EXISTS provider_token,
  DROP COLUMN IF EXISTS provider_refresh_token;
