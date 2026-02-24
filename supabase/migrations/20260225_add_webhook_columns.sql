-- Store GitLab webhook hook_id so we can delete it on disconnect.
-- Store per-repo webhook_secret for GitLab signature verification.
-- (GitHub uses a single App-level secret; GitLab needs per-project tokens.)
ALTER TABLE connected_repositories
  ADD COLUMN IF NOT EXISTS webhook_hook_id INTEGER,
  ADD COLUMN IF NOT EXISTS webhook_secret TEXT;
