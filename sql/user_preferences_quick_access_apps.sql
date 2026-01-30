-- Add quick_access_apps column to user_preferences table
-- This stores an array of app IDs in display order for the QuickAccessApps component

ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS quick_access_apps JSONB DEFAULT NULL;

-- Create GIN index for efficient JSONB operations
CREATE INDEX IF NOT EXISTS idx_user_preferences_quick_access_apps 
  ON user_preferences USING GIN (quick_access_apps);

-- Device-specific quick access apps (mobile/desktop separated)
ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS quick_access_apps_mobile JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS quick_access_apps_desktop JSONB DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_user_preferences_quick_access_apps_mobile 
  ON user_preferences USING GIN (quick_access_apps_mobile);

CREATE INDEX IF NOT EXISTS idx_user_preferences_quick_access_apps_desktop 
  ON user_preferences USING GIN (quick_access_apps_desktop);

-- Add comment for documentation
COMMENT ON COLUMN user_preferences.quick_access_apps 
  IS 'Array of quick access app IDs in display order. NULL means use frontend default. Example: ["memory", "bookmarks", "photos", "whats-new"]';

-- Example of what the data looks like:
-- quick_access_apps: ["memory", "photos", "bookmarks", "whats-new"]
-- This means: Memory first, then Photos, then Bookmarks, then What's New
