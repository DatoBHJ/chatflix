-- Allow 'static' in selected_background_type for Chatflix bg static wallpapers
-- Run: \d user_preferences to verify constraint name if DROP fails

ALTER TABLE user_preferences DROP CONSTRAINT IF EXISTS user_preferences_selected_background_type_check;

ALTER TABLE user_preferences ADD CONSTRAINT user_preferences_selected_background_type_check
  CHECK (selected_background_type IN ('default', 'custom', 'static'));
