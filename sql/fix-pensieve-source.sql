-- Fix pensieve images that were saved with wrong source value
-- Change source from 'upload' to 'pensieve_saved' for pensieve uploads

UPDATE user_background_settings
SET source = 'pensieve_saved'
WHERE source = 'upload'
  AND bucket_name = 'saved-gallery'
  AND background_path LIKE '%pensieve_upload_%';

-- Verification query (run separately to check results)
-- SELECT id, background_path, source, created_at
-- FROM user_background_settings
-- WHERE background_path LIKE '%pensieve_upload_%'
-- ORDER BY created_at DESC
-- LIMIT 20;

