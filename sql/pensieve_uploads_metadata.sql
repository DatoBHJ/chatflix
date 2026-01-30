-- Extend user_background_settings to store pensieve upload metadata (prompt, ai_json_prompt, etc.)
ALTER TABLE user_background_settings
  ADD COLUMN IF NOT EXISTS ai_prompt TEXT,
  ADD COLUMN IF NOT EXISTS ai_json_prompt JSONB,
  ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Ensure source and bucket_name columns exist for tracking upload source/bucket
ALTER TABLE user_background_settings
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'upload',
  ADD COLUMN IF NOT EXISTS bucket_name TEXT NOT NULL DEFAULT 'background-images';

-- Optional: index for filtering by source
CREATE INDEX IF NOT EXISTS idx_user_background_settings_source_v2
  ON user_background_settings(user_id, source);

