-- Allow public (anonymous) SELECT for public pensieve content
-- Scope: user_background_settings
-- Condition: is_public=true OR source='pensieve_curated'
-- Note: Keep existing owner/user-specific policies intact
-- This policy works alongside "Users can view own background settings" (PERMISSIVE = OR condition)

DROP POLICY IF EXISTS "Public read pensieve uploads" ON user_background_settings;
DROP POLICY IF EXISTS "Public read pensieve saved images" ON user_background_settings;
DROP POLICY IF EXISTS "Public read pensieve content" ON user_background_settings;

-- 1. DB 레코드 읽기 권한: 공개 설정된 이미지나 큐레이션된 이미지는 누구나 조회 가능
CREATE POLICY "Public read pensieve content"
  ON user_background_settings
  FOR SELECT
  USING (
    is_public = true 
    OR source = 'pensieve_curated'
  );

-- 2. Storage 파일 읽기 권한: 'saved-gallery' 버킷
-- DB의 user_background_settings 테이블에서 공개된 파일만 접근 허용
DROP POLICY IF EXISTS "Public read public images in saved-gallery" ON storage.objects;
CREATE POLICY "Public read public images in saved-gallery"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'saved-gallery' AND
    (
      EXISTS (
        SELECT 1 FROM public.user_background_settings 
        WHERE background_path = name AND (is_public = true OR source = 'pensieve_curated')
      )
    )
  );

-- 3. Storage 파일 읽기 권한: 'generated-images' 버킷 (프로젝트 슬라이드 등)
-- 공개된 프로젝트에 속한 슬라이드 이미지이거나, 직접 공개된 이미지인 경우 접근 허용
DROP POLICY IF EXISTS "Public read public images in generated-images" ON storage.objects;
CREATE POLICY "Public read public images in generated-images"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'generated-images' AND
    (
      -- 프로젝트 슬라이드 체크 (프로젝트가 public인 경우)
      EXISTS (
        SELECT 1 FROM public.pensieve_project_slides s
        JOIN public.pensieve_projects p ON s.project_id = p.id
        WHERE s.image_path = name AND p.is_public = true
      )
      OR
      -- 일반 배경화면 설정 체크
      EXISTS (
        SELECT 1 FROM public.user_background_settings
        WHERE background_path = name AND is_public = true
      )
    )
  );