-- Migrate existing gemini-images (legacy bucket) to user_background_settings table
-- FIXED: gemini-images stores files at ROOT LEVEL using owner column, not folders!

CREATE OR REPLACE FUNCTION migrate_gemini_images_legacy()
RETURNS TABLE (
  migrated_count INTEGER,
  skipped_count INTEGER,
  error_count INTEGER
) AS $$
DECLARE
  v_file_record RECORD;
  v_migrated INTEGER := 0;
  v_skipped INTEGER := 0;
  v_errors INTEGER := 0;
BEGIN
  -- Loop through all files in gemini-images storage (using owner column for user_id)
  FOR v_file_record IN
    SELECT 
      name as file_path,
      owner as user_id,
      created_at,
      metadata
    FROM storage.objects
    WHERE bucket_id = 'gemini-images'
      AND name != '.emptyFolderPlaceholder'
      AND owner IS NOT NULL
  LOOP
    BEGIN
      -- Check if this file already exists in user_background_settings
      IF NOT EXISTS (
        SELECT 1 FROM user_background_settings
        WHERE user_id = v_file_record.user_id
          AND background_path = v_file_record.file_path
          AND bucket_name = 'gemini-images'
      ) THEN
        -- Insert new record
        INSERT INTO user_background_settings (
          user_id,
          background_path,
          background_url,
          url_expires_at,
          name,
          source,
          bucket_name,
          created_at
        ) VALUES (
          v_file_record.user_id,
          v_file_record.file_path,
          '', -- Empty URL, will be generated when user visits the page
          NOW(), -- Expired, will trigger URL generation
          v_file_record.file_path, -- Use filename directly as name
          'generated', -- Mark as generated
          'gemini-images', -- OLD bucket name
          COALESCE(v_file_record.created_at, NOW())
        );
        
        v_migrated := v_migrated + 1;
      ELSE
        v_skipped := v_skipped + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
      RAISE NOTICE 'Error migrating file %: %', v_file_record.file_path, SQLERRM;
    END;
  END LOOP;
  
  RETURN QUERY SELECT v_migrated, v_skipped, v_errors;
END;
$$ LANGUAGE plpgsql;

-- Execute the migration
SELECT * FROM migrate_gemini_images_legacy();

-- Clean up the function (optional)
-- DROP FUNCTION IF EXISTS migrate_gemini_images_legacy();

-- Verify the migration
SELECT 
  source,
  bucket_name,
  COUNT(*) as total_images,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(CASE WHEN background_url = '' THEN 1 END) as pending_url_generation
FROM user_background_settings
WHERE bucket_name IN ('gemini-images', 'generated-images')
GROUP BY source, bucket_name
ORDER BY source, bucket_name;