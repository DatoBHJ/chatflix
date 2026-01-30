-- Legacy File Ownership Mapping Table
-- This table maps legacy storage files to their owners based on messages analysis

-- Create the mapping table
CREATE TABLE IF NOT EXISTS legacy_file_ownership (
  file_path TEXT PRIMARY KEY,
  user_id UUID NOT NULL,
  bucket_name TEXT NOT NULL,
  file_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_legacy_file_ownership_user 
ON legacy_file_ownership(user_id, bucket_name);

-- Populate the table with file ownership data from messages
-- This query extracts file paths from experimental_attachments and tool_results
INSERT INTO legacy_file_ownership (file_path, user_id, bucket_name, file_type)
WITH attachment_files AS (
  -- Extract files from experimental_attachments
  SELECT 
    user_id,
    (attachment->>'path')::text as file_path,
    (attachment->>'fileType')::text as file_type,
    'chat_attachments' as bucket_name
  FROM messages,
  LATERAL unnest(experimental_attachments) AS attachment
  WHERE experimental_attachments IS NOT NULL
    AND array_length(experimental_attachments, 1) > 0
    AND (attachment->>'path') IS NOT NULL
),
generated_files AS (
  -- Extract files from tool_results for generated-images
  SELECT 
    user_id,
    (regexp_matches(tool_results::text, 'generated-images/([^"]+)', 'g'))[1] as file_path,
    'image' as file_type,
    'generated-images' as bucket_name
  FROM messages
  WHERE tool_results IS NOT NULL
    AND tool_results::text != '{}'
    AND tool_results::text LIKE '%generated-images%'
),
gemini_files AS (
  -- Extract files from tool_results for gemini-images
  SELECT 
    user_id,
    (regexp_matches(tool_results::text, 'gemini-images/([^"]+)', 'g'))[1] as file_path,
    'image' as file_type,
    'gemini-images' as bucket_name
  FROM messages
  WHERE tool_results IS NOT NULL
    AND tool_results::text != '{}'
    AND tool_results::text LIKE '%gemini-images%'
),
tool_result_files AS (
  SELECT * FROM generated_files
  UNION ALL
  SELECT * FROM gemini_files
)
SELECT DISTINCT
  file_path,
  user_id,
  bucket_name,
  file_type
FROM (
  SELECT file_path, user_id, bucket_name, file_type FROM attachment_files
  UNION ALL
  SELECT file_path, user_id, bucket_name, file_type FROM tool_result_files
) combined
WHERE file_path IS NOT NULL
  AND file_path != ''
ON CONFLICT (file_path) DO NOTHING;

-- Add comment for documentation
COMMENT ON TABLE legacy_file_ownership IS 'Maps legacy storage files to their owners based on messages analysis';
COMMENT ON COLUMN legacy_file_ownership.file_path IS 'Storage file path (filename only for legacy files)';
COMMENT ON COLUMN legacy_file_ownership.user_id IS 'Owner of the file';
COMMENT ON COLUMN legacy_file_ownership.bucket_name IS 'Storage bucket name';
COMMENT ON COLUMN legacy_file_ownership.file_type IS 'File type (image, code, etc.)';
