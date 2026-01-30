-- Wan 비디오 도구 통합 마이그레이션
-- wan25_text_to_video, wan25_image_to_video → wan25_video

-- 1. parts 배열 내의 type 필드 변경
-- tool-wan25_text_to_video → tool-wan25_video
-- tool-wan25_image_to_video → tool-wan25_video

-- 변경할 메시지 확인 (DRY RUN)
SELECT 
  id,
  chat_session_id,
  created_at,
  parts::text
FROM messages 
WHERE 
  parts::text LIKE '%tool-wan25_text_to_video%'
  OR parts::text LIKE '%tool-wan25_image_to_video%';

-- 실제 마이그레이션 실행
-- parts JSONB 배열 내의 type 필드를 wan25_video로 변경

UPDATE messages
SET parts = (
  SELECT jsonb_agg(
    CASE 
      WHEN elem->>'type' = 'tool-wan25_text_to_video' THEN
        jsonb_set(elem, '{type}', '"tool-wan25_video"')
      WHEN elem->>'type' = 'tool-wan25_image_to_video' THEN
        jsonb_set(elem, '{type}', '"tool-wan25_video"')
      ELSE elem
    END
  )
  FROM jsonb_array_elements(parts) AS elem
)
WHERE 
  parts::text LIKE '%tool-wan25_text_to_video%'
  OR parts::text LIKE '%tool-wan25_image_to_video%';

-- 변경 확인
SELECT 
  id,
  chat_session_id,
  parts::text
FROM messages 
WHERE parts::text LIKE '%tool-wan25_video%'
LIMIT 5;
