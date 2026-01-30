-- =====================================================
-- pensieve_curated_migration.sql
-- Pensieve curated 데이터를 Supabase로 마이그레이션하기 위한 스키마 확장
-- =====================================================

-- 1. user_background_settings 테이블에 pensieve_curated 전용 컬럼 추가
-- metadata 컬럼은 pensieve_uploads_metadata.sql에서 이미 추가되어 있음
ALTER TABLE user_background_settings
  ADD COLUMN IF NOT EXISTS pensieve_curated_group_id UUID,
  ADD COLUMN IF NOT EXISTS pensieve_curated_tweet_ids TEXT[],
  ADD COLUMN IF NOT EXISTS pensieve_curated_authors TEXT[],
  ADD COLUMN IF NOT EXISTS pensieve_curated_queries TEXT[],
  ADD COLUMN IF NOT EXISTS pensieve_curated_strategies TEXT[],
  ADD COLUMN IF NOT EXISTS metadata JSONB; -- links 등 추가 정보 저장용

-- 2. 인덱스 생성
-- 그룹화용 인덱스
CREATE INDEX IF NOT EXISTS idx_user_background_settings_pensieve_curated_group 
  ON user_background_settings(pensieve_curated_group_id) 
  WHERE source = 'pensieve_curated';

-- source 필터링용 인덱스
CREATE INDEX IF NOT EXISTS idx_user_background_settings_pensieve_curated_source 
  ON user_background_settings(source) 
  WHERE source = 'pensieve_curated';

-- 배열 검색용 GIN 인덱스 (tweetIds 검색 성능 향상)
CREATE INDEX IF NOT EXISTS idx_user_background_settings_pensieve_curated_tweet_ids 
  ON user_background_settings USING GIN(pensieve_curated_tweet_ids) 
  WHERE source = 'pensieve_curated';

-- 3. RLS 정책 추가 - pensieve_curated는 모두 공개 읽기 허용
DROP POLICY IF EXISTS "Public read pensieve_curated images" ON user_background_settings;

CREATE POLICY "Public read pensieve_curated images"
  ON user_background_settings
  FOR SELECT
  USING (source = 'pensieve_curated');

-- 4. user_id NULL 허용 (시스템 데이터이므로)
-- pensieve_curated는 시스템 데이터이므로 user_id가 NULL일 수 있어야 함
ALTER TABLE user_background_settings
  ALTER COLUMN user_id DROP NOT NULL;

-- 주석: pensieve_curated 데이터는 user_id가 NULL일 수 있으므로,
-- 기존 RLS 정책 "Users can view own background settings"와 함께
-- "Public read pensieve_curated images" 정책이 OR 조건으로 작동하여
-- source = 'pensieve_curated'인 경우 누구나 읽을 수 있음

