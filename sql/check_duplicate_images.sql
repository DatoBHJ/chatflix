-- =====================================================
-- fix_pensieve_curated_prompts.sql
-- pensieve_curated 데이터의 잘못된 prompt 필드 수정
-- =====================================================

-- ⚠️ 주의: 이 SQL은 source = 'pensieve_curated'인 데이터만 수정합니다.
-- 다른 source (generated, pensieve_saved, saved, upload)의 데이터는 전혀 영향받지 않습니다.

-- 문제: ai_prompt와 ai_json_prompt에 잘못 저장된 데이터가 있음
-- 해결: ai_prompt와 ai_json_prompt를 NULL로 설정하고, prompt 필드만 유지

-- 트랜잭션 시작 (롤백 가능)
BEGIN;

-- 1. 방금 추가한 잘못된 데이터 삭제 (선택적 - 필요시 주석 해제)
-- 최근 추가된 pensieve_curated 데이터 중 ai_prompt나 ai_json_prompt가 있는 것들 삭제
-- DELETE FROM user_background_settings
-- WHERE source = 'pensieve_curated'
--   AND created_at >= '2025-12-27 06:00:00'
--   AND (ai_prompt IS NOT NULL OR ai_json_prompt IS NOT NULL);

-- 2. ai_json_prompt에만 값이 있고 prompt가 NULL인 경우, ai_json_prompt 값을 prompt로 이동
--    (JSON 객체를 문자열로 변환하여 prompt에 저장)
UPDATE user_background_settings
SET 
  prompt = ai_json_prompt::text,
  ai_json_prompt = NULL
WHERE source = 'pensieve_curated'
  AND prompt IS NULL
  AND ai_json_prompt IS NOT NULL;

-- 3. 모든 pensieve_curated 데이터의 ai_prompt와 ai_json_prompt를 NULL로 설정
--    prompt 필드는 그대로 유지 (기존 데이터에 방해되지 않음)
UPDATE user_background_settings
SET 
  ai_prompt = NULL,
  ai_json_prompt = NULL
WHERE source = 'pensieve_curated'
  AND (ai_prompt IS NOT NULL OR ai_json_prompt IS NOT NULL);

-- 4. 확인 쿼리 (실행 후 확인용)
-- SELECT 
--   COUNT(*) as total,
--   COUNT(CASE WHEN prompt IS NOT NULL THEN 1 END) as has_prompt,
--   COUNT(CASE WHEN ai_prompt IS NOT NULL THEN 1 END) as has_ai_prompt,
--   COUNT(CASE WHEN ai_json_prompt IS NOT NULL THEN 1 END) as has_ai_json_prompt
-- FROM user_background_settings
-- WHERE source = 'pensieve_curated';

-- 5. 다른 source 데이터 확인 (영향받지 않았는지 확인)
-- SELECT 
--   source,
--   COUNT(*) as total,
--   COUNT(CASE WHEN ai_prompt IS NOT NULL THEN 1 END) as has_ai_prompt,
--   COUNT(CASE WHEN ai_json_prompt IS NOT NULL THEN 1 END) as has_ai_json_prompt
-- FROM user_background_settings
-- WHERE source != 'pensieve_curated'
-- GROUP BY source;

-- 트랜잭션 커밋 (문제없으면)
COMMIT;

-- 문제가 있으면 롤백:
-- ROLLBACK;

