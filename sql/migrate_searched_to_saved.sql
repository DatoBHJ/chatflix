-- Migration script to update source and bucket_name fields
-- This updates existing 'web_search' records to 'saved' and changes bucket from 'saved-web' to 'saved-gallery'

-- Update source field from 'web_search' to 'saved' and bucket_name from 'saved-web' to 'saved-gallery'
UPDATE user_background_settings 
SET source = 'saved', 
    bucket_name = 'saved-gallery'
WHERE source = 'web_search' 
  AND bucket_name = 'saved-web';

-- Verify the migration
SELECT source, bucket_name, COUNT(*) as count 
FROM user_background_settings 
WHERE source = 'saved' AND bucket_name = 'saved-gallery'
GROUP BY source, bucket_name;
