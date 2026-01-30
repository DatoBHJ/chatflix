-- Add public sharing support for pensieve uploads
ALTER TABLE user_background_settings
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;

-- Index to list public images quickly
CREATE INDEX IF NOT EXISTS idx_user_background_settings_is_public
  ON user_background_settings(is_public, created_at);


