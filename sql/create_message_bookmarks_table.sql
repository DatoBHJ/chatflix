-- Create message_bookmarks table
CREATE TABLE IF NOT EXISTS message_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  message_id TEXT NOT NULL,
  chat_session_id TEXT NOT NULL,
  content TEXT NOT NULL,
  model TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Add constraints
  CONSTRAINT message_bookmarks_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Unique constraint to prevent duplicate bookmarks
  CONSTRAINT message_bookmarks_unique_user_message UNIQUE (user_id, message_id)
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS message_bookmarks_user_id_idx ON message_bookmarks (user_id);
CREATE INDEX IF NOT EXISTS message_bookmarks_message_id_idx ON message_bookmarks (message_id);
CREATE INDEX IF NOT EXISTS message_bookmarks_chat_session_id_idx ON message_bookmarks (chat_session_id);

-- Add RLS (Row Level Security) policies
ALTER TABLE message_bookmarks ENABLE ROW LEVEL SECURITY;

-- Only allow users to see their own bookmarks
CREATE POLICY message_bookmarks_select_policy
  ON message_bookmarks
  FOR SELECT
  USING (auth.uid() = user_id);

-- Only allow users to insert their own bookmarks
CREATE POLICY message_bookmarks_insert_policy
  ON message_bookmarks
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Only allow users to update their own bookmarks
CREATE POLICY message_bookmarks_update_policy
  ON message_bookmarks
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Only allow users to delete their own bookmarks
CREATE POLICY message_bookmarks_delete_policy
  ON message_bookmarks
  FOR DELETE
  USING (auth.uid() = user_id); 