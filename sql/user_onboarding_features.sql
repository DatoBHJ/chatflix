-- Create user_onboarding_features table for storing user's seen onboarding features
-- 사용자가 본 온보딩 기능을 저장하는 테이블
--
-- 실행 방법:
-- 1. Supabase Dashboard에 로그인
-- 2. SQL Editor로 이동
-- 3. 아래 SQL을 복사하여 실행
-- 4. 실행 후 테이블이 생성되었는지 확인 (Table Editor에서 확인 가능)

CREATE TABLE IF NOT EXISTS user_onboarding_features (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL, -- 온보딩 기능 키 (예: 'quick_access_new_app_2024')
  seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, feature_key) -- 한 사용자가 같은 기능을 여러 번 볼 수 없도록 제약
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_onboarding_features_user_id ON user_onboarding_features(user_id);
CREATE INDEX IF NOT EXISTS idx_user_onboarding_features_feature_key ON user_onboarding_features(feature_key);
CREATE INDEX IF NOT EXISTS idx_user_onboarding_features_user_feature ON user_onboarding_features(user_id, feature_key);

-- Enable RLS
ALTER TABLE user_onboarding_features ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can only access their own onboarding features
CREATE POLICY "Users can view own onboarding features" ON user_onboarding_features
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own onboarding features" ON user_onboarding_features
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own onboarding features" ON user_onboarding_features
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own onboarding features" ON user_onboarding_features
  FOR DELETE USING (auth.uid() = user_id);

-- Add comment for documentation
COMMENT ON TABLE user_onboarding_features IS 'Stores which onboarding features each user has seen';
COMMENT ON COLUMN user_onboarding_features.feature_key IS 'Unique key identifying the onboarding feature (e.g., "quick_access_new_app_2024")';
COMMENT ON COLUMN user_onboarding_features.seen_at IS 'Timestamp when the user first saw this feature';

