-- Add context_summary column to chat_sessions for storing conversation summaries
-- Used for context management when conversations exceed token limits

ALTER TABLE chat_sessions 
ADD COLUMN IF NOT EXISTS context_summary JSONB DEFAULT NULL;

COMMENT ON COLUMN chat_sessions.context_summary IS 
'Context summary for long conversations. Structure: {summary: string, summarized_until_message_id: string, summarized_until_sequence: number, created_at: timestamp}';

-- Create index for faster lookups when checking for existing summaries
CREATE INDEX IF NOT EXISTS idx_chat_sessions_context_summary 
ON chat_sessions USING GIN (context_summary) 
WHERE context_summary IS NOT NULL;
