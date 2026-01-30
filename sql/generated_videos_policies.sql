-- Storage policies for generated-videos bucket
-- Run these in your Supabase SQL editor

-- Step 1: Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'generated-videos',
  'generated-videos',
  false,
  104857600,  -- 100MB limit for video files
  ARRAY['video/mp4', 'video/webm', 'video/quicktime']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Step 2: Drop any existing policies with the same names to avoid conflicts
DROP POLICY IF EXISTS "Users can upload to generated-videos" ON storage.objects;
DROP POLICY IF EXISTS "Users can view generated-videos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete generated-videos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update generated-videos" ON storage.objects;

-- Policy 1: Users can upload to their own folder in generated-videos bucket
CREATE POLICY "Users can upload to generated-videos" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'generated-videos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy 2: Users can view their own files in generated-videos bucket
CREATE POLICY "Users can view generated-videos" ON storage.objects
FOR SELECT USING (
  bucket_id = 'generated-videos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy 3: Users can delete their own files in generated-videos bucket
CREATE POLICY "Users can delete generated-videos" ON storage.objects
FOR DELETE USING (
  bucket_id = 'generated-videos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy 4: Users can update their own files in generated-videos bucket (for replacing videos)
CREATE POLICY "Users can update generated-videos" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'generated-videos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
