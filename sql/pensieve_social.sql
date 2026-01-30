-- =====================================================
-- pensieve_social.sql
-- Pensieve 좋아요(하트) 및 댓글 기능을 위한 테이블
-- 복사하여 Supabase SQL Editor에서 실행
-- =====================================================

-- 1. pensieve_likes 테이블 생성
CREATE TABLE IF NOT EXISTS pensieve_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('project', 'saved_image')),
  target_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, target_type, target_id)
);

-- 2. pensieve_comments 테이블 생성
CREATE TABLE IF NOT EXISTS pensieve_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('project', 'saved_image')),
  target_id UUID NOT NULL,
  content TEXT NOT NULL CHECK (char_length(content) <= 500),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_pensieve_likes_target ON pensieve_likes(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_pensieve_likes_user ON pensieve_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_pensieve_comments_target ON pensieve_comments(target_type, target_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pensieve_comments_user ON pensieve_comments(user_id);

-- 4. RLS 활성화
ALTER TABLE pensieve_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pensieve_comments ENABLE ROW LEVEL SECURITY;

-- 5. RLS 정책 - pensieve_likes
DROP POLICY IF EXISTS "Users can read all likes" ON pensieve_likes;
DROP POLICY IF EXISTS "Users can manage own likes" ON pensieve_likes;

-- 모든 사용자가 좋아요 수를 볼 수 있음
CREATE POLICY "Users can read all likes" ON pensieve_likes
  FOR SELECT USING (true);

-- 본인 좋아요만 추가/삭제 가능
CREATE POLICY "Users can manage own likes" ON pensieve_likes
  FOR ALL USING (auth.uid() = user_id);

-- 6. RLS 정책 - pensieve_comments
DROP POLICY IF EXISTS "Users can read all comments" ON pensieve_comments;
DROP POLICY IF EXISTS "Users can insert own comments" ON pensieve_comments;
DROP POLICY IF EXISTS "Users can delete own comments" ON pensieve_comments;

-- 모든 사용자가 댓글을 볼 수 있음
CREATE POLICY "Users can read all comments" ON pensieve_comments
  FOR SELECT USING (true);

-- 본인 댓글만 추가 가능
CREATE POLICY "Users can insert own comments" ON pensieve_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 본인 댓글만 삭제 가능
CREATE POLICY "Users can delete own comments" ON pensieve_comments
  FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- pensieve_views 테이블 (조회수)
-- =====================================================

-- 7. pensieve_views 테이블 생성
CREATE TABLE IF NOT EXISTS pensieve_views (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  target_type TEXT NOT NULL CHECK (target_type IN ('project', 'saved_image')),
  target_id UUID NOT NULL,
  viewer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  viewer_ip TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_pensieve_views_target ON pensieve_views(target_type, target_id);
-- 중복 방지 조회용 인덱스 (24시간 체크는 API에서 처리)
CREATE INDEX IF NOT EXISTS idx_pensieve_views_dedup ON pensieve_views(target_type, target_id, viewer_ip, created_at);

-- 9. RLS 활성화
ALTER TABLE pensieve_views ENABLE ROW LEVEL SECURITY;

-- 10. RLS 정책 - pensieve_views
DROP POLICY IF EXISTS "Anyone can read views" ON pensieve_views;
DROP POLICY IF EXISTS "Anyone can insert views" ON pensieve_views;

-- 모든 사용자가 조회수를 볼 수 있음
CREATE POLICY "Anyone can read views" ON pensieve_views
  FOR SELECT USING (true);

-- 모든 사용자(비회원 포함)가 조회 기록 추가 가능
CREATE POLICY "Anyone can insert views" ON pensieve_views
  FOR INSERT WITH CHECK (true);
