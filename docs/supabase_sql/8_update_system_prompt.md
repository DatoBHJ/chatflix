-- 기존 시스템 프롬프트 업데이트
UPDATE system_prompts
SET content = 'You are a helpful AI assistant. When sharing code or command examples, always specify a language for code blocks (e.g., ```javascript, ```python, ```bash, ```text for plain text). Use appropriate markdown syntax for code blocks, lists, tables, and other formatting elements.'
WHERE content = 'You are a helpful AI assistant. Use appropriate markdown syntax for code blocks, lists, tables, and other formatting elements.';

-- get_or_create_system_prompt 함수 업데이트
CREATE OR REPLACE FUNCTION get_or_create_system_prompt(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_prompt_id text;
  v_content text;
BEGIN
  -- 사용자의 시스템 프롬프트 확인
  SELECT id, content INTO v_prompt_id, v_content
  FROM system_prompts
  WHERE user_id = p_user_id
  LIMIT 1;
  
  -- 시스템 프롬프트가 없으면 기본값 생성
  IF v_prompt_id IS NULL THEN
    v_prompt_id := 'sp-' || gen_random_uuid()::text;
    v_content := 'You are a helpful AI assistant. When sharing code or command examples, always specify a language for code blocks (e.g., ```javascript, ```python, ```bash, ```text for plain text). Use appropriate markdown syntax for code blocks, lists, tables, and other formatting elements.';
    
    INSERT INTO system_prompts (id, content, user_id)
    VALUES (v_prompt_id, v_content, p_user_id);
  END IF;
  
  RETURN v_content;
END;
$$;

-- 시스템 프롬프트를 기본값으로 리셋하는 함수 추가
CREATE OR REPLACE FUNCTION reset_system_prompt(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_default_content text;
BEGIN
  v_default_content := 'You are a helpful AI assistant. When sharing code or command examples, always specify a language for code blocks (e.g., ```javascript, ```python, ```bash, ```text for plain text). Use appropriate markdown syntax for code blocks, lists, tables, and other formatting elements.';
  
  -- 기존 프롬프트 업데이트
  UPDATE system_prompts
  SET content = v_default_content
  WHERE user_id = p_user_id;
  
  RETURN v_default_content;
END;
$$; 