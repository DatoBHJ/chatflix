-- Migration: Rename Imagine to Pensieve in user_background_settings
-- This script migrates existing data from imagine_* to pensieve_* naming

-- 1. Update source column values
--    imagine_upload -> pensieve_upload
--    imagine_saved -> pensieve_saved

UPDATE user_background_settings
SET source = 'pensieve_upload'
WHERE source = 'imagine_upload';

UPDATE user_background_settings
SET source = 'pensieve_saved'
WHERE source = 'imagine_saved';

-- 2. Update background_path column
--    Replace imagine_upload_ prefix with pensieve_upload_ in file paths
--    This handles paths like: user_id/imagine_upload_timestamp_hash.ext

UPDATE user_background_settings
SET background_path = REPLACE(background_path, 'imagine_upload_', 'pensieve_upload_')
WHERE background_path LIKE '%imagine_upload_%';

-- 3. Verify migration results (optional - can be run separately)
-- Uncomment to check migration results:
-- SELECT 
--   source,
--   COUNT(*) as count
-- FROM user_background_settings
-- WHERE source IN ('pensieve_upload', 'pensieve_saved', 'imagine_upload', 'imagine_saved')
-- GROUP BY source
-- ORDER BY source;

-- SELECT 
--   background_path,
--   COUNT(*) as count
-- FROM user_background_settings
-- WHERE background_path LIKE '%imagine_upload_%' OR background_path LIKE '%pensieve_upload_%'
-- GROUP BY background_path
-- ORDER BY background_path
-- LIMIT 20;

