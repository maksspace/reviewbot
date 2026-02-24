-- Add custom_skills JSONB column to connected_repositories.
-- Stores an array of custom review skill objects.
-- Each entry: { "id": "uuid", "name": "...", "content": "..." }
-- Max 5 skills per repo, max 2000 chars per skill content (enforced in app layer).

ALTER TABLE connected_repositories
  ADD COLUMN IF NOT EXISTS custom_skills JSONB DEFAULT '[]'::jsonb;
