-- 1. Create the user_profiles table
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  profile_data JSONB NOT NULL, 
  profile_summary TEXT NOT NULL,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_analyzed_message_id TEXT,
  analyzed_message_count INTEGER,
  keywords TEXT[],
  UNIQUE(user_id)
);

-- 2. Create index for faster lookups
CREATE INDEX user_profiles_user_id_idx ON user_profiles(user_id);

-- 3. Enable Row Level Security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS policies

-- Admin policy: full access for administrators
CREATE POLICY "Admins have full access" 
ON user_profiles
FOR ALL
TO authenticated
USING (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
WITH CHECK (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin');

-- User read-only policy: users can only read their own profiles
CREATE POLICY "Users can read their own profiles" 
ON user_profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 5. Comments for developers
COMMENT ON TABLE user_profiles IS 'Stores AI-generated user profiles based on conversation analysis';
COMMENT ON COLUMN user_profiles.profile_data IS 'JSON containing extracted interests, traits, patterns, and suggested prompts';
COMMENT ON COLUMN user_profiles.profile_summary IS 'Natural language summary of the user profile';
COMMENT ON COLUMN user_profiles.last_analyzed_message_id IS 'ID of the most recent message analyzed';
COMMENT ON COLUMN user_profiles.analyzed_message_count IS 'Count of messages used in the profile analysis';
COMMENT ON COLUMN user_profiles.keywords IS 'Array of keywords representing the user interests and traits';

-- 6. Audit triggers for tracking changes (optional but recommended)
CREATE OR REPLACE FUNCTION user_profiles_audit_trigger_func()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_profiles_audit_trigger
BEFORE UPDATE ON user_profiles
FOR EACH ROW
EXECUTE FUNCTION user_profiles_audit_trigger_func(); 