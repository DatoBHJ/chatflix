-- Extend user_background_settings table to support multiple image sources
-- This allows managing both uploaded and generated images in one table

-- Add new columns to existing table
ALTER TABLE user_background_settings 
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'upload',
  ADD COLUMN IF NOT EXISTS bucket_name TEXT NOT NULL DEFAULT 'background-images';

-- Create index for efficient filtering by source
CREATE INDEX IF NOT EXISTS idx_user_background_settings_source 
  ON user_background_settings(user_id, source);

-- Update existing records to have proper source and bucket_name
UPDATE user_background_settings 
SET source = 'upload', bucket_name = 'background-images'
WHERE source IS NULL OR bucket_name IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN user_background_settings.source IS 'Image source: upload, generated, or default';
COMMENT ON COLUMN user_background_settings.bucket_name IS 'Storage bucket: background-images or generated-images';
