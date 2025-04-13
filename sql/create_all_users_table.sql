-- Create all_user table to store user names
CREATE TABLE IF NOT EXISTS all_user (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS all_user_id_idx ON all_user (id);

-- Add RLS (Row Level Security) policies
ALTER TABLE all_user ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to see user names
CREATE POLICY all_user_select_policy
  ON all_user
  FOR SELECT
  USING (true);

-- Only allow users to insert their own name
CREATE POLICY all_user_insert_policy
  ON all_user
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Only allow users to update their own name
CREATE POLICY all_user_update_policy
  ON all_user
  FOR UPDATE
  USING (auth.uid() = id);

-- Function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_all_user_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update the updated_at timestamp
CREATE TRIGGER update_all_user_updated_at
BEFORE UPDATE ON all_user
FOR EACH ROW
EXECUTE FUNCTION update_all_user_updated_at(); 