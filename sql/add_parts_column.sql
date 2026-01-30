-- messages 테이블에 parts 컬럼 추가
-- AI SDK 5 parts 배열을 저장하여 tool-call/tool-result 순서 보존
-- 기존 데이터는 NULL로 유지 (하위 호환)

-- 1. parts 컬럼 추가 (nullable)
ALTER TABLE messages ADD COLUMN IF NOT EXISTS parts JSONB DEFAULT NULL;

-- 2. 인덱스 추가 (선택적, 성능 최적화 - parts가 NULL이 아닌 경우만)
CREATE INDEX IF NOT EXISTS idx_messages_parts ON messages USING GIN (parts) WHERE parts IS NOT NULL;

-- 3. 코멘트 추가
COMMENT ON COLUMN messages.parts IS 'AI SDK 5 parts 배열 - tool-call/tool-result 순서 보존용. NULL이면 기존 방식으로 렌더링 (하위 호환).';

-- 참고: 기존 메시지는 parts = NULL로 유지됨
-- 클라이언트의 convertMessage 함수에서 Fallback 로직으로 처리
