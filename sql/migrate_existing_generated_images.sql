-- Migrate existing generated images from storage to user_background_settings table
-- This script finds all generated images in storage and creates database records for them

-- Step 1: Create a temporary function to migrate generated images from storage
CREATE OR REPLACE FUNCTION migrate_generated_images_from_storage()
RETURNS TABLE (
  migrated_count INTEGER,
  skipped_count INTEGER,
  error_count INTEGER
) AS $$
DECLARE
  v_user_id UUID;
  v_file_record RECORD;
  v_file_path TEXT;
  v_migrated INTEGER := 0;
  v_skipped INTEGER := 0;
  v_errors INTEGER := 0;
BEGIN
  -- Loop through each user folder in generated-images storage
  FOR v_user_id IN 
    SELECT DISTINCT (storage.foldername(name))[1]::UUID as user_id
    FROM storage.objects
    WHERE bucket_id = 'generated-images'
      AND (storage.foldername(name))[1] IS NOT NULL
      AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  LOOP
    -- Get all files for this user
    FOR v_file_record IN
      SELECT 
        name as file_path,
        created_at,
        metadata
      FROM storage.objects
      WHERE bucket_id = 'generated-images'
        AND name LIKE v_user_id::TEXT || '/%'
    LOOP
      BEGIN
        -- Check if this file already exists in user_background_settings
        IF NOT EXISTS (
          SELECT 1 FROM user_background_settings
          WHERE user_id = v_user_id
            AND background_path = v_file_record.file_path
        ) THEN
          -- Insert new record (URL will be empty, will be generated on first load)
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
            v_user_id,
            v_file_record.file_path,
            '', -- Empty URL, will be generated when user visits the page
            NOW(), -- Expired, will trigger URL generation
            split_part(v_file_record.file_path, '/', 2), -- Extract filename
            'generated',
            'generated-images',
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
  END LOOP;
  
  RETURN QUERY SELECT v_migrated, v_skipped, v_errors;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Execute the migration
SELECT * FROM migrate_generated_images_from_storage();

-- Step 3: Clean up the function (optional, comment out if you want to keep it)
-- DROP FUNCTION IF EXISTS migrate_generated_images_from_storage();

-- Step 4: Verify the migration
SELECT 
  source,
  bucket_name,
  COUNT(*) as total_images,
  COUNT(CASE WHEN background_url = '' THEN 1 END) as pending_url_generation
FROM user_background_settings
GROUP BY source, bucket_name
ORDER BY source, bucket_name;
