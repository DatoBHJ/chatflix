-- Create initial_prompts table for storing user-specific suggested prompts
CREATE TABLE IF NOT EXISTS initial_prompts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  prompt TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create index for faster user lookups
CREATE INDEX IF NOT EXISTS idx_initial_prompts_user_id ON initial_prompts(user_id);

-- Create unique constraint to ensure one prompt per user
ALTER TABLE initial_prompts ADD CONSTRAINT unique_user_prompt UNIQUE(user_id);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at on row updates
CREATE TRIGGER update_initial_prompts_updated_at
  BEFORE UPDATE ON initial_prompts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE initial_prompts ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to only access their own prompts
CREATE POLICY "Users can only access their own prompts" ON initial_prompts
  FOR ALL USING (auth.uid()::text = user_id);

-- Grant necessary permissions
GRANT ALL ON initial_prompts TO authenticated;
GRANT ALL ON initial_prompts TO service_role; 