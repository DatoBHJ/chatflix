-- Complete Pensieve Migration SQL
-- Run this to fix all remaining source value inconsistencies

-- 1. Fix 'upload' records in saved-gallery that are pensieve images
UPDATE user_background_settings
SET source = 'pensieve_saved'
WHERE source = 'upload'
  AND bucket_name = 'saved-gallery'
  AND background_path LIKE '%pensieve_upload_%';

-- 2. Consolidate 'pensieve_upload' to 'pensieve_saved'
-- (All pensieve images should use 'pensieve_saved' for consistency)
UPDATE user_background_settings
SET source = 'pensieve_saved'
WHERE source = 'pensieve_upload'
  AND bucket_name = 'saved-gallery';

-- 3. Optional: Migrate legacy 'searched' to 'saved'
-- (This was from an old migration, consolidate for clarity)
UPDATE user_background_settings
SET source = 'saved'
WHERE source = 'searched';

-- Verification queries (run separately to check results)
-- Check pensieve images by source
-- SELECT source, COUNT(*) as count
-- FROM user_background_settings
-- WHERE background_path LIKE '%pensieve_upload_%'
-- GROUP BY source;

-- Check all source values
-- SELECT source, bucket_name, COUNT(*) as count
-- FROM user_background_settings
-- GROUP BY source, bucket_name
-- ORDER BY source, bucket_name;

