-- Adds last_activity_at tracking for chat sessions and backfills existing data
ALTER TABLE chat_sessions
ADD COLUMN IF NOT EXISTS last_activity_at timestamptz;

-- Backfill last_activity_at with the latest message timestamp or fallback to created_at
UPDATE chat_sessions
SET last_activity_at = COALESCE(
  (
    SELECT MAX(created_at)
    FROM messages
    WHERE messages.chat_session_id = chat_sessions.id
  ),
  created_at
)
WHERE last_activity_at IS NULL;

-- Helpful index for ordering by last activity
CREATE INDEX IF NOT EXISTS chat_sessions_last_activity_idx
ON chat_sessions (last_activity_at DESC NULLS LAST);

