-- ============================================
-- DEPLOYMENT SCRIPT: save_chat_message_atomic
-- Run this in Supabase SQL Editor
-- ============================================

-- Step 1: Drop the old UUID version of the function
DROP FUNCTION IF EXISTS save_chat_message_atomic(
  p_chat_id UUID,
  p_user_id UUID,
  p_user_message JSONB,
  p_assistant_message JSONB,
  p_model TEXT,
  p_provider TEXT,
  p_is_regeneration BOOLEAN
);

-- Step 2: Drop the old TEXT version (if exists) to ensure clean replacement
DROP FUNCTION IF EXISTS save_chat_message_atomic(
  p_chat_id TEXT,
  p_user_id UUID,
  p_user_message JSONB,
  p_assistant_message JSONB,
  p_model TEXT,
  p_provider TEXT,
  p_is_regeneration BOOLEAN
);

-- Step 3: Create the updated function with correct jsonb[] handling AND parts support
CREATE OR REPLACE FUNCTION save_chat_message_atomic(
  p_chat_id TEXT,
  p_user_id UUID,
  p_user_message JSONB,
  p_assistant_message JSONB,
  p_model TEXT DEFAULT NULL,
  p_provider TEXT DEFAULT NULL,
  p_is_regeneration BOOLEAN DEFAULT FALSE
) RETURNS JSONB AS $$
DECLARE
  v_next_seq INTEGER;
  v_user_exists BOOLEAN;
  v_session_title TEXT;
BEGIN
  -- 1. Ensure session exists (upsert)
  v_session_title := LEFT(COALESCE(p_user_message->>'content', 'New Chat'), 30);
  IF LENGTH(v_session_title) = 30 THEN
    v_session_title := v_session_title || '...';
  END IF;
  
  INSERT INTO chat_sessions (id, user_id, title, created_at, last_activity_at, current_model)
  VALUES (p_chat_id, p_user_id, v_session_title, NOW(), NOW(), p_model)
  ON CONFLICT (id) DO UPDATE SET 
    last_activity_at = NOW(),
    current_model = COALESCE(p_model, chat_sessions.current_model);

  -- 2. Get next sequence number (use advisory lock to prevent race condition)
  -- Advisory lock on chat_id hash for this user's session
  PERFORM pg_advisory_xact_lock(hashtext(p_chat_id || '::' || p_user_id::text));
  
  SELECT COALESCE(MAX(sequence_number), 0) INTO v_next_seq
  FROM messages 
  WHERE chat_session_id = p_chat_id AND user_id = p_user_id;

  -- 3. Check if user message exists
  SELECT EXISTS(
    SELECT 1 FROM messages WHERE id = (p_user_message->>'id')::TEXT
  ) INTO v_user_exists;

  -- 4. Insert user message if not exists
  IF NOT v_user_exists THEN
    INSERT INTO messages (
      id, chat_session_id, user_id, role, content, 
      sequence_number, created_at, host, experimental_attachments, parts
    ) VALUES (
      p_user_message->>'id',
      p_chat_id,
      p_user_id,
      'user',
      p_user_message->>'content',
      v_next_seq + 1,
      NOW(),
      'user',
      -- Convert JSONB array to PostgreSQL jsonb[] array
      CASE 
        WHEN p_user_message->'experimental_attachments' IS NOT NULL 
             AND jsonb_typeof(p_user_message->'experimental_attachments') = 'array'
        THEN (SELECT ARRAY(SELECT jsonb_array_elements(p_user_message->'experimental_attachments')))
        ELSE NULL
      END,
      p_user_message->'parts' -- Add parts column support for user messages
    );
    v_next_seq := v_next_seq + 1;
  END IF;

  -- 5. Handle assistant message
  IF p_is_regeneration THEN
    UPDATE messages SET
      content = p_assistant_message->>'content',
      reasoning = NULLIF(p_assistant_message->>'reasoning', ''),
      model = p_model,
      host = p_provider,
      parts = p_assistant_message->'parts',
      tool_results = p_assistant_message->'tool_results',
      token_usage = p_assistant_message->'token_usage',
      created_at = NOW()
    WHERE id = (p_assistant_message->>'id')::TEXT 
      AND user_id = p_user_id;
  ELSE
    INSERT INTO messages (
      id, chat_session_id, user_id, role, content, reasoning,
      sequence_number, model, host, created_at, parts, tool_results, token_usage
    ) VALUES (
      p_assistant_message->>'id',
      p_chat_id,
      p_user_id,
      'assistant',
      p_assistant_message->>'content',
      NULLIF(p_assistant_message->>'reasoning', ''),
      v_next_seq + 1,
      p_model,
      p_provider,
      NOW(),
      p_assistant_message->'parts',
      p_assistant_message->'tool_results',
      p_assistant_message->'token_usage'
    ) ON CONFLICT (id) DO UPDATE SET
      content = EXCLUDED.content,
      reasoning = EXCLUDED.reasoning,
      parts = EXCLUDED.parts,
      tool_results = EXCLUDED.tool_results;
  END IF;

  RETURN jsonb_build_object('success', true);

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'save_chat_message_atomic error: %', SQLERRM;
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql;

-- Step 4: Verify the function exists with correct signature
SELECT 
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'save_chat_message_atomic' AND n.nspname = 'public';
