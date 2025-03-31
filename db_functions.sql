-- 메시지 10개 이상 있는 사용자 조회 함수
CREATE OR REPLACE FUNCTION get_users_with_message_count(min_message_count integer)
RETURNS TABLE (user_id uuid) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT m.user_id
  FROM messages m
  GROUP BY m.user_id
  HAVING COUNT(*) >= min_message_count;
END;
$$;

-- 증분 업데이트가 필요한 사용자 조회 함수
CREATE OR REPLACE FUNCTION get_users_needing_incremental_update(min_new_message_count integer)
RETURNS TABLE (user_id uuid, new_message_count bigint) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT p.user_id, COUNT(m.id) as new_message_count
  FROM user_profiles p
  JOIN messages m ON p.user_id = m.user_id
  WHERE m.id > p.last_analyzed_message_id
    AND m.role = 'user'
  GROUP BY p.user_id
  HAVING COUNT(m.id) >= min_new_message_count;
END;
$$;

-- 함수에 대한 권한 설정
GRANT EXECUTE ON FUNCTION get_users_with_message_count(integer) TO service_role;
GRANT EXECUTE ON FUNCTION get_users_needing_incremental_update(integer) TO service_role; 