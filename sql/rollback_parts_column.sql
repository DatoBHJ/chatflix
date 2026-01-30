-- messages 테이블의 parts 컬럼 롤백
-- add_parts_column.sql로 적용한 변경사항을 되돌립니다

-- ⚠️ 경고: 이 작업은 되돌릴 수 없습니다!
-- parts 컬럼에 저장된 데이터가 영구적으로 삭제됩니다.
-- 롤백 전에 반드시 백업을 수행하세요.

-- 1. 인덱스 삭제
DROP INDEX IF EXISTS idx_messages_parts;

-- 2. parts 컬럼 삭제
ALTER TABLE messages DROP COLUMN IF EXISTS parts;

-- 참고: 
-- - 이 롤백을 실행하면 parts 컬럼과 그 안의 모든 데이터가 삭제됩니다
-- - 기존 메시지(content, tool_results 등)는 영향받지 않습니다
-- - 코드는 자동으로 Fallback 모드로 전환되어 기존 방식으로 렌더링합니다
