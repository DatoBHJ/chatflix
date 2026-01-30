-- Add prompt column to user_background_settings table for storing user-provided Human Prompt
-- This is optional and separate from ai_prompt (AI-extracted prompt)
ALTER TABLE user_background_settings
  ADD COLUMN IF NOT EXISTS prompt TEXT;

-- Add comment for documentation
COMMENT ON COLUMN user_background_settings.prompt IS 'User-provided Human Prompt (optional). Takes priority over ai_prompt for display.';

