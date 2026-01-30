-- Create user_trends_preferences table for storing user's Trending widget filter settings
-- This allows users to persist their filter preferences (country, region, time range, category)
-- across sessions until they manually change them

CREATE TABLE IF NOT EXISTS user_trends_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  selected_country TEXT,                    -- Country code (e.g., "US", "KR")
  selected_region TEXT,                    -- Region geo_id (e.g., "US-CA", "KR-11")
  time_range TEXT NOT NULL DEFAULT 'past_24_hours',  -- Time range filter
  selected_category TEXT,                  -- Selected category filter (nullable)
  is_custom BOOLEAN NOT NULL DEFAULT false, -- Whether user has manually modified settings
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_trends_preferences_user_id ON user_trends_preferences(user_id);

-- Enable RLS
ALTER TABLE user_trends_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can only access their own preferences
CREATE POLICY "Users can view own trends preferences" ON user_trends_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own trends preferences" ON user_trends_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own trends preferences" ON user_trends_preferences
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own trends preferences" ON user_trends_preferences
  FOR DELETE USING (auth.uid() = user_id);

-- Create updated_at trigger
CREATE TRIGGER update_user_trends_preferences_updated_at
  BEFORE UPDATE ON user_trends_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

