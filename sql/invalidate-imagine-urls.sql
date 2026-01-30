-- Invalidate URLs for pensieve images to force regeneration with correct storage paths
-- This prepares the database for storage filename migration from imagine_upload_ to pensieve_upload_

-- Step 1: Invalidate URLs by setting expiry to past date
-- The API checks: if (!url || (url_expires_at && new Date(url_expires_at) < new Date()))
-- Setting url_expires_at to a past date will trigger URL regeneration
UPDATE user_background_settings
SET 
  url_expires_at = '2020-01-01 00:00:00+00'
WHERE background_path LIKE '%imagine_upload_%'
   OR background_path LIKE '%pensieve_upload_%';

-- Verification query (optional - run separately to check results)
-- SELECT id, background_path, background_url, url_expires_at 
-- FROM user_background_settings 
-- WHERE background_path LIKE '%imagine_upload_%' 
--    OR background_path LIKE '%pensieve_upload_%'
-- LIMIT 10;

