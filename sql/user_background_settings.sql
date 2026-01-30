-- Create user_background_settings table for storing custom background images
CREATE TABLE IF NOT EXISTS user_background_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  background_path TEXT NOT NULL, -- Storage path in Supabase
  background_url TEXT NOT NULL, -- Current signed URL
  url_expires_at TIMESTAMP WITH TIME ZONE NOT NULL, -- When the URL expires
  name TEXT, -- User-friendly name for the background
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_background_settings_user_id ON user_background_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_background_settings_expires ON user_background_settings(url_expires_at);

-- Enable RLS
ALTER TABLE user_background_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can only access their own background settings
CREATE POLICY "Users can view own background settings" ON user_background_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own background settings" ON user_background_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own background settings" ON user_background_settings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own background settings" ON user_background_settings
  FOR DELETE USING (auth.uid() = user_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_background_settings_updated_at
  BEFORE UPDATE ON user_background_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
