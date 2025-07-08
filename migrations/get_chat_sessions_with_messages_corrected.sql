-- 기존 함수 삭제 (존재하는 경우)
DROP FUNCTION IF EXISTS get_chat_sessions_with_messages(UUID, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS search_chat_sessions_with_messages(UUID, TEXT, INTEGER);

-- 채팅 세션과 메시지 정보를 한 번의 쿼리로 가져오는 최적화된 RPC 함수
-- 실제 데이터베이스 스키마에 맞춰 수정된 버전

CREATE OR REPLACE FUNCTION get_chat_sessions_with_messages(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 15,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    title TEXT,
    current_model TEXT,
    first_user_content TEXT,
    latest_content TEXT,
    latest_message_time TIMESTAMP WITH TIME ZONE,
    latest_model TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH chat_sessions_page AS (
        -- 페이지네이션을 적용하여 채팅 세션 가져오기
        SELECT 
            cs.id,
            cs.created_at,
            cs.title,
            cs.current_model
        FROM chat_sessions cs
        WHERE cs.user_id = p_user_id
        ORDER BY cs.created_at DESC
        LIMIT p_limit OFFSET p_offset
    ),
    first_user_messages AS (
        -- 각 채팅 세션의 첫 번째 사용자 메시지 가져오기 (제목 폴백용)
        SELECT DISTINCT ON (m.chat_session_id)
            m.chat_session_id,
            m.content as first_user_content
        FROM messages m
        INNER JOIN chat_sessions_page csp ON m.chat_session_id = csp.id
        WHERE m.role = 'user'
        ORDER BY m.chat_session_id, m.created_at ASC
    ),
    latest_messages AS (
        -- 각 채팅 세션의 최신 메시지 가져오기 (미리보기용)
        SELECT DISTINCT ON (m.chat_session_id)
            m.chat_session_id,
            m.content as latest_content,
            m.created_at as latest_message_time,
            m.model as latest_model
        FROM messages m
        INNER JOIN chat_sessions_page csp ON m.chat_session_id = csp.id
        ORDER BY m.chat_session_id, m.created_at DESC
    )
    SELECT 
        csp.id,
        csp.created_at,
        csp.title,
        csp.current_model,
        fum.first_user_content,
        lm.latest_content,
        lm.latest_message_time,
        lm.latest_model
    FROM chat_sessions_page csp
    LEFT JOIN first_user_messages fum ON csp.id = fum.chat_session_id
    LEFT JOIN latest_messages lm ON csp.id = lm.chat_session_id
    ORDER BY COALESCE(lm.latest_message_time, csp.created_at) DESC;
END;
$$;

-- 채팅 검색을 위한 최적화된 RPC 함수
CREATE OR REPLACE FUNCTION search_chat_sessions_with_messages(
    p_user_id UUID,
    p_search_term TEXT,
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
    id TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    title TEXT,
    current_model TEXT,
    first_user_content TEXT,
    latest_content TEXT,
    latest_message_time TIMESTAMP WITH TIME ZONE,
    latest_model TEXT,
    search_rank REAL
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH title_matches AS (
        -- 제목으로 검색 (높은 우선순위)
        SELECT 
            cs.id,
            cs.created_at,
            cs.title,
            cs.current_model,
            2.0 as search_rank  -- 제목 일치는 높은 점수
        FROM chat_sessions cs
        WHERE cs.user_id = p_user_id
        AND cs.title ILIKE '%' || p_search_term || '%'
    ),
    message_matches AS (
        -- 메시지 내용으로 검색
        SELECT DISTINCT
            cs.id,
            cs.created_at,
            cs.title,
            cs.current_model,
            1.0 as search_rank  -- 메시지 일치는 기본 점수
        FROM chat_sessions cs
        INNER JOIN messages m ON cs.id = m.chat_session_id
        WHERE cs.user_id = p_user_id
        AND m.content ILIKE '%' || p_search_term || '%'
    ),
    combined_matches AS (
        -- 제목과 메시지 검색 결과 병합 (중복 제거 및 점수 합산)
        SELECT 
            id,
            created_at,
            title,
            current_model,
            MAX(search_rank) as search_rank  -- 최고 점수 사용
        FROM (
            SELECT * FROM title_matches
            UNION ALL
            SELECT * FROM message_matches
        ) all_matches
        GROUP BY id, created_at, title, current_model
        ORDER BY search_rank DESC, created_at DESC
        LIMIT p_limit
    ),
    first_user_messages AS (
        -- 각 채팅 세션의 첫 번째 사용자 메시지 가져오기
        SELECT DISTINCT ON (m.chat_session_id)
            m.chat_session_id,
            m.content as first_user_content
        FROM messages m
        INNER JOIN combined_matches cm ON m.chat_session_id = cm.id
        WHERE m.role = 'user'
        ORDER BY m.chat_session_id, m.created_at ASC
    ),
    latest_messages AS (
        -- 각 채팅 세션의 최신 메시지 가져오기
        SELECT DISTINCT ON (m.chat_session_id)
            m.chat_session_id,
            m.content as latest_content,
            m.created_at as latest_message_time,
            m.model as latest_model
        FROM messages m
        INNER JOIN combined_matches cm ON m.chat_session_id = cm.id
        ORDER BY m.chat_session_id, m.created_at DESC
    )
    SELECT 
        cm.id,
        cm.created_at,
        cm.title,
        cm.current_model,
        fum.first_user_content,
        lm.latest_content,
        lm.latest_message_time,
        lm.latest_model,
        cm.search_rank
    FROM combined_matches cm
    LEFT JOIN first_user_messages fum ON cm.id = fum.chat_session_id
    LEFT JOIN latest_messages lm ON cm.id = lm.chat_session_id
    ORDER BY cm.search_rank DESC, COALESCE(lm.latest_message_time, cm.created_at) DESC;
END;
$$;

-- 함수 실행 권한 부여
GRANT EXECUTE ON FUNCTION get_chat_sessions_with_messages(UUID, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION search_chat_sessions_with_messages(UUID, TEXT, INTEGER) TO authenticated;

-- 함수 설명 주석
COMMENT ON FUNCTION get_chat_sessions_with_messages(UUID, INTEGER, INTEGER) IS 
'채팅 세션과 관련 메시지 정보를 한 번의 쿼리로 효율적으로 가져오는 함수. N+1 쿼리 문제를 해결하여 성능을 대폭 향상시킵니다.';

COMMENT ON FUNCTION search_chat_sessions_with_messages(UUID, TEXT, INTEGER) IS 
'채팅 세션과 메시지를 검색하는 최적화된 함수. 제목과 메시지 내용을 모두 검색하며 N+1 쿼리 문제를 해결합니다.';

-- 테스트 쿼리 (실행 전 확인용)
/*
-- 사용 예시:
SELECT * FROM get_chat_sessions_with_messages(
    '9b682bce-11c0-4373-b954-08ec55731312'::uuid, 
    15, 
    0
);

SELECT * FROM search_chat_sessions_with_messages(
    '9b682bce-11c0-4373-b954-08ec55731312'::uuid, 
    'Jesse', 
    50
);
*/ 