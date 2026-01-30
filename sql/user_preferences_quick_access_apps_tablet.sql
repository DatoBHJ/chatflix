-- Add tablet-specific quick access apps column to user_preferences table
-- This allows iPad/tablet users to have separate app/widget configurations
-- Run this migration in Supabase SQL Editor

ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS quick_access_apps_tablet JSONB DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_user_preferences_quick_access_apps_tablet 
  ON user_preferences USING GIN (quick_access_apps_tablet);

COMMENT ON COLUMN user_preferences.quick_access_apps_tablet 
  IS 'Array of quick access app IDs for tablet (iPad) devices. NULL means use frontend default. Example: [{"id": "add-app", "dockIndex": 0}, {"id": "glass-trends-widget", "size": {"width": 6, "height": 4}, "slotIndex": 0}]';
