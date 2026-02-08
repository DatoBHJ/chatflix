-- Chat-scoped E2B sandboxes and workspace file paths for file-edit feature.
-- Run in Supabase SQL editor.

-- Table: chat_sandboxes
-- Maps chat_id to an E2B sandbox and tracks workspace paths (files we know about in that sandbox).
CREATE TABLE IF NOT EXISTS chat_sandboxes (
  chat_id text PRIMARY KEY,
  sandbox_id text NOT NULL,
  expires_at timestamptz NOT NULL,
  workspace_paths jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for TTL cleanup: find rows that have expired
CREATE INDEX IF NOT EXISTS idx_chat_sandboxes_expires_at ON chat_sandboxes(expires_at);

-- RLS: allow service role / authenticated to manage (adjust to your auth pattern)
ALTER TABLE chat_sandboxes ENABLE ROW LEVEL SECURITY;

-- Policy: users can only access sandboxes for chats they own.
-- Assumes you have a chats table with user_id; if not, use a permissive policy for now.
-- Example (uncomment and adjust table/column names to match your schema):
-- CREATE POLICY "Users can manage own chat sandboxes"
--   ON chat_sandboxes FOR ALL
--   USING (
--     EXISTS (
--       SELECT 1 FROM chats c WHERE c.id = chat_sandboxes.chat_id AND c.user_id = auth.uid()::text
--     )
--   );

-- If you don't have a chats table or want API-only access, use a permissive policy for app access:
DROP POLICY IF EXISTS "Allow app to manage chat_sandboxes" ON chat_sandboxes;
CREATE POLICY "Allow app to manage chat_sandboxes"
  ON chat_sandboxes FOR ALL
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE chat_sandboxes IS 'E2B sandbox per chat for file read/write; workspace_paths = array of absolute paths in sandbox';
