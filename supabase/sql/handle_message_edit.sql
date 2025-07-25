-- 메시지 편집을 원자적으로 처리하는 RPC 함수
-- 이 함수는 메시지 업데이트/삽입, 후속 메시지 삭제를 하나의 트랜잭션으로 처리합니다.

CREATE OR REPLACE FUNCTION handle_message_edit(
  p_message_id TEXT,
  p_user_id UUID,
  p_chat_session_id TEXT,
  p_content TEXT,
  p_model TEXT,
  p_role TEXT,
  p_sequence_number BIGINT,
  p_attachments JSONB[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  existing_message_row RECORD;
  new_sequence_number BIGINT;
  current_user_id UUID;
  deleted_count INTEGER;
BEGIN
  -- 현재 인증된 사용자 ID 확인
  current_user_id := auth.uid();
  
  -- 보안 검증: 현재 사용자가 요청한 user_id와 일치하는지 확인
  IF current_user_id IS NULL OR current_user_id != p_user_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unauthorized: User can only edit their own messages',
      'error_code', 'UNAUTHORIZED'
    );
  END IF;

  -- 기존 메시지 확인 (보안: 해당 사용자의 메시지인지 재확인)
  SELECT * INTO existing_message_row
  FROM messages
  WHERE id = p_message_id
    AND user_id = p_user_id
    AND chat_session_id = p_chat_session_id;

  IF FOUND THEN
    -- 기존 메시지가 있으면 업데이트
    UPDATE messages
    SET 
      content = p_content,
      is_edited = true,
      edited_at = NOW(),
      experimental_attachments = p_attachments
    WHERE id = p_message_id
      AND user_id = p_user_id
      AND chat_session_id = p_chat_session_id;
    
    -- 기존 sequence_number 사용
    new_sequence_number := existing_message_row.sequence_number + 1;
  ELSE
    -- 새 메시지 삽입
    INSERT INTO messages (
      id,
      role,
      content,
      created_at,
      chat_session_id,
      user_id,
      sequence_number,
      is_edited,
      edited_at,
      model,
      host,
      experimental_attachments,
      topic,
      extension
    ) VALUES (
      p_message_id,
      p_role,
      p_content,
      NOW(),
      p_chat_session_id,
      p_user_id,
      p_sequence_number,
      true,
      NOW(),
      p_model,
      CASE WHEN p_role = 'assistant' THEN 'assistant' ELSE 'user' END,
      p_attachments,
      'general', -- 기본 topic 값
      'default'  -- 기본 extension 값
    );
    
    -- 새로 삽입된 sequence_number + 1 사용
    new_sequence_number := p_sequence_number + 1;
  END IF;

  -- 편집된 메시지 이후의 모든 메시지 삭제 (보안: 해당 사용자의 메시지만)
  WITH deleted_messages AS (
    DELETE FROM messages
    WHERE chat_session_id = p_chat_session_id
      AND user_id = p_user_id  -- 추가 보안 검증
      AND sequence_number > COALESCE(existing_message_row.sequence_number, p_sequence_number)
    RETURNING id
  )
  SELECT COUNT(*)::integer INTO deleted_count FROM deleted_messages;

  -- 결과 반환
  RETURN jsonb_build_object(
    'success', true,
    'new_sequence_number', new_sequence_number,
    'updated_existing', CASE WHEN existing_message_row.id IS NOT NULL THEN true ELSE false END,
    'deleted_count', deleted_count
  );

EXCEPTION
  WHEN OTHERS THEN
    -- 에러 발생 시 롤백되고 에러 메시지 반환
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'error_code', SQLSTATE
    );
END;
$$;