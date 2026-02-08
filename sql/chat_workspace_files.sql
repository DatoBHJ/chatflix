-- Persisted workspace file contents per chat. Used to rehydrate a new sandbox when the previous one expired.
-- Run in Supabase SQL editor after chat_sandboxes.

-- Table: chat_workspace_files
CREATE TABLE IF NOT EXISTS chat_workspace_files (
  chat_id text NOT NULL,
  path text NOT NULL,
  content text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chat_id, path)
);

CREATE INDEX IF NOT EXISTS idx_chat_workspace_files_chat_id ON chat_workspace_files(chat_id);

ALTER TABLE chat_workspace_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow app to manage chat_workspace_files" ON chat_workspace_files;
CREATE POLICY "Allow app to manage chat_workspace_files"
  ON chat_workspace_files FOR ALL
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE chat_workspace_files IS 'Saved file contents per chat; rehydrated into new E2B sandbox when previous sandbox expired';
