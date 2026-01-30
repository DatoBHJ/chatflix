-- Migrate existing chat attachments (images only) to user_background_settings table
-- This script finds all image attachments from messages and creates database records for them

-- Step 1: Create a temporary function to migrate chat attachment images
CREATE OR REPLACE FUNCTION migrate_chat_attachment_images()
RETURNS TABLE (
  migrated_count INTEGER,
  skipped_count INTEGER,
  error_count INTEGER
) AS $$
DECLARE
  v_message_record RECORD;
  v_attachment JSONB;
  v_user_id UUID;
  v_file_path TEXT;
  v_file_url TEXT;
  v_file_name TEXT;
  v_content_type TEXT;
  v_migrated INTEGER := 0;
  v_skipped INTEGER := 0;
  v_errors INTEGER := 0;
BEGIN
  -- Loop through all messages with experimental_attachments
  FOR v_message_record IN
    SELECT 
      id,
      user_id,
      experimental_attachments,
      created_at
    FROM messages
    WHERE experimental_attachments IS NOT NULL
      AND cardinality(experimental_attachments) > 0
  LOOP
    -- Loop through each attachment in the message
    FOR v_attachment IN
      SELECT * FROM unnest(v_message_record.experimental_attachments)
    LOOP
      BEGIN
        -- Extract attachment information
        v_file_url := v_attachment->>'url';
        v_content_type := v_attachment->>'contentType';
        v_file_name := v_attachment->>'name';
        
        -- Only process image attachments
        IF v_content_type IS NOT NULL AND v_content_type LIKE 'image/%' THEN
          -- Extract file path from URL (if it's a chat_attachments URL)
          IF v_file_url LIKE '%chat_attachments%' THEN
            -- Extract path after 'chat_attachments/'
            v_file_path := (regexp_matches(v_file_url, 'chat_attachments/([^?]+)'))[1];
            
            IF v_file_path IS NOT NULL THEN
              -- Check if this file already exists in user_background_settings
              IF NOT EXISTS (
                SELECT 1 FROM user_background_settings
                WHERE user_id = v_message_record.user_id
                  AND background_path = v_file_path
                  AND source = 'upload'
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
                  v_message_record.user_id,
                  v_file_path,
                  '', -- Empty URL, will be generated when user visits the page
                  NOW(), -- Expired, will trigger URL generation
                  COALESCE(v_file_name, split_part(v_file_path, '/', -1)), -- Use name from attachment or extract from path
                  'upload', -- Chat attachments are user uploads
                  'chat_attachments',
                  COALESCE(v_message_record.created_at, NOW())
                );
                
                v_migrated := v_migrated + 1;
              ELSE
                v_skipped := v_skipped + 1;
              END IF;
            END IF;
          END IF;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        v_errors := v_errors + 1;
        RAISE NOTICE 'Error migrating attachment from message %: %', v_message_record.id, SQLERRM;
      END;
    END LOOP;
  END LOOP;
  
  RETURN QUERY SELECT v_migrated, v_skipped, v_errors;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Execute the migration
SELECT * FROM migrate_chat_attachment_images();

-- Step 3: Clean up the function (optional, comment out if you want to keep it)
-- DROP FUNCTION IF EXISTS migrate_chat_attachment_images();

-- Step 4: Verify the migration
SELECT 
  source,
  bucket_name,
  COUNT(*) as total_images,
  COUNT(CASE WHEN background_url = '' THEN 1 END) as pending_url_generation
FROM user_background_settings
GROUP BY source, bucket_name
ORDER BY source, bucket_name;

-- Step 5: Show sample migrated records
SELECT 
  user_id,
  name,
  source,
  bucket_name,
  created_at
FROM user_background_settings
WHERE source = 'upload' AND bucket_name = 'chat_attachments'
ORDER BY created_at DESC
LIMIT 10;
