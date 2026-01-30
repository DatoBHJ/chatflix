-- Fix pensieve generated/edited images that were saved with wrong bucket_name
-- These images are in 'generated-images' bucket but DB says 'saved-gallery'

-- 1. Fix generated images (generate_*.png) - change bucket to 'generated-images'
UPDATE user_background_settings
SET bucket_name = 'generated-images'
WHERE (background_path LIKE '%generate_%' OR background_path LIKE '%edit_%')
  AND bucket_name = 'saved-gallery';

-- 2. Invalidate URLs to force regeneration with correct bucket
UPDATE user_background_settings
SET url_expires_at = '2020-01-01 00:00:00+00'
WHERE (background_path LIKE '%generate_%' OR background_path LIKE '%edit_%')
  AND bucket_name = 'generated-images';

-- Verification queries (run separately to check results)
-- Check generated images by bucket
-- SELECT bucket_name, COUNT(*) as count
-- FROM user_background_settings
-- WHERE background_path LIKE '%generate_%' OR background_path LIKE '%edit_%'
-- GROUP BY bucket_name;

-- Check specific examples
-- SELECT id, background_path, source, bucket_name, created_at
-- FROM user_background_settings
-- WHERE background_path LIKE '%generate_%' OR background_path LIKE '%edit_%'
-- ORDER BY created_at DESC
-- LIMIT 10;

