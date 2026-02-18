-- Add relevance ordering to chat message search (pgroonga_score)
-- Fallback: when index not used, pgroonga_score=0 → created_at breaks tie

CREATE INDEX IF NOT EXISTS idx_messages_content_pgroonga
  ON messages USING pgroonga (content);

CREATE OR REPLACE FUNCTION public.search_messages_pgroonga_v2(
  search_term text,
  user_id_param uuid,
  limit_param integer DEFAULT 50,
  offset_param integer DEFAULT 0
)
RETURNS TABLE(
  message_id text,
  chat_session_id text,
  sequence_number bigint,
  created_at timestamp with time zone,
  role text,
  model text,
  content text,
  chat_title text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id::text AS message_id,
    m.chat_session_id,
    m.sequence_number,
    m.created_at,
    m.role,
    m.model,
    left(m.content, 500) AS content,
    coalesce(cs.title, left(cs.initial_message, 80), 'Untitled Chat') AS chat_title
  FROM messages m
  LEFT JOIN chat_sessions cs ON cs.id = m.chat_session_id AND cs.user_id = m.user_id
  WHERE m.user_id = user_id_param
    AND m.content IS NOT NULL
    AND m.content <> ''
    AND m.content &@~ search_term
  ORDER BY pgroonga_score(m.tableoid, m.ctid) DESC NULLS LAST, m.created_at DESC
  LIMIT limit_param
  OFFSET offset_param;
END;
$$;
