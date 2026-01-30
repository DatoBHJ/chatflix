-- =====================================================
-- pensieve_projects.sql
-- Pensieve 프로젝트 저장, 편집, 공유 기능을 위한 테이블
-- 복사하여 Supabase SQL Editor에서 실행
-- =====================================================

-- 1. 프로젝트 테이블 생성
CREATE TABLE IF NOT EXISTS pensieve_projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  
  -- 썸네일 (최신 슬라이드 또는 원본)
  thumbnail_url TEXT,
  thumbnail_path TEXT,
  
  -- 원본 이미지 정보
  original_image_url TEXT,
  original_image_path TEXT,
  original_bucket_name TEXT DEFAULT 'generated-images',
  
  -- 프롬프트 정보
  prompt TEXT,
  ai_prompt TEXT,
  ai_json_prompt JSONB,
  
  -- 설정
  selected_model TEXT DEFAULT 'nano-banana-pro',
  is_public BOOLEAN DEFAULT false,
  
  -- 슬라이드 수 (캐시용)
  slide_count INTEGER DEFAULT 1,
  
  -- 타임스탬프
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 슬라이드 테이블 생성
CREATE TABLE IF NOT EXISTS pensieve_project_slides (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES pensieve_projects(id) ON DELETE CASCADE,
  
  -- 슬라이드 순서 및 계층 구조
  slide_index INTEGER NOT NULL,
  parent_slide_id UUID REFERENCES pensieve_project_slides(id) ON DELETE SET NULL,
  
  -- 이미지 정보
  image_url TEXT NOT NULL,
  image_path TEXT NOT NULL,
  bucket_name TEXT DEFAULT 'generated-images',
  url_expires_at TIMESTAMP WITH TIME ZONE,
  
  -- 프롬프트 (이 슬라이드 생성에 사용된)
  prompt TEXT,
  ai_prompt TEXT,
  ai_json_prompt JSONB,
  
  -- 플래그
  is_original BOOLEAN DEFAULT false,
  
  -- 타임스탬프
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_pensieve_projects_user ON pensieve_projects(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pensieve_projects_public ON pensieve_projects(is_public, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pensieve_project_slides_project ON pensieve_project_slides(project_id, slide_index);

-- 4. RLS 활성화
ALTER TABLE pensieve_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE pensieve_project_slides ENABLE ROW LEVEL SECURITY;

-- 5. RLS 정책 - 프로젝트
-- 기존 정책 삭제 (재실행 시 충돌 방지)
DROP POLICY IF EXISTS "Users can CRUD own projects" ON pensieve_projects;
DROP POLICY IF EXISTS "Public can read public projects" ON pensieve_projects;

-- 본인 프로젝트 전체 접근
CREATE POLICY "Users can CRUD own projects" ON pensieve_projects
  FOR ALL USING (auth.uid() = user_id);

-- 공개 프로젝트 읽기 (Strands 탭용)
CREATE POLICY "Public can read public projects" ON pensieve_projects
  FOR SELECT USING (is_public = true);

-- 6. RLS 정책 - 슬라이드
-- 기존 정책 삭제 (재실행 시 충돌 방지)
DROP POLICY IF EXISTS "Users can CRUD slides of own projects" ON pensieve_project_slides;
DROP POLICY IF EXISTS "Public can read slides of public projects" ON pensieve_project_slides;

-- 본인 프로젝트의 슬라이드 전체 접근
CREATE POLICY "Users can CRUD slides of own projects" ON pensieve_project_slides
  FOR ALL USING (
    project_id IN (SELECT id FROM pensieve_projects WHERE user_id = auth.uid())
  );

-- 공개 프로젝트의 슬라이드 읽기 (Strands 탭용)
CREATE POLICY "Public can read slides of public projects" ON pensieve_project_slides
  FOR SELECT USING (
    project_id IN (SELECT id FROM pensieve_projects WHERE is_public = true)
  );

-- 7. updated_at 자동 갱신 트리거
-- update_updated_at_column 함수가 이미 존재한다고 가정 (user_background_settings.sql에서 생성됨)
DROP TRIGGER IF EXISTS update_pensieve_projects_updated_at ON pensieve_projects;
CREATE TRIGGER update_pensieve_projects_updated_at
  BEFORE UPDATE ON pensieve_projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 8. slide_count 자동 갱신 함수 및 트리거
CREATE OR REPLACE FUNCTION update_project_slide_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE pensieve_projects 
    SET slide_count = (SELECT COUNT(*) FROM pensieve_project_slides WHERE project_id = NEW.project_id),
        thumbnail_url = NEW.image_url,
        thumbnail_path = NEW.image_path
    WHERE id = NEW.project_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE pensieve_projects 
    SET slide_count = (SELECT COUNT(*) FROM pensieve_project_slides WHERE project_id = OLD.project_id)
    WHERE id = OLD.project_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_slide_count_on_insert ON pensieve_project_slides;
CREATE TRIGGER update_slide_count_on_insert
  AFTER INSERT ON pensieve_project_slides
  FOR EACH ROW EXECUTE FUNCTION update_project_slide_count();

DROP TRIGGER IF EXISTS update_slide_count_on_delete ON pensieve_project_slides;
CREATE TRIGGER update_slide_count_on_delete
  AFTER DELETE ON pensieve_project_slides
  FOR EACH ROW EXECUTE FUNCTION update_project_slide_count();

