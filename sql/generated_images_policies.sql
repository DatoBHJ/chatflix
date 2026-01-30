-- Storage policies for generated-images bucket
-- Run these in your Supabase SQL editor after creating the 'generated-images' bucket

-- First, drop any existing policies with the same names to avoid conflicts
DROP POLICY IF EXISTS "Users can upload to generated-images" ON storage.objects;
DROP POLICY IF EXISTS "Users can view generated-images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete generated-images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update generated-images" ON storage.objects;

-- Policy 1: Users can upload to their own folder in generated-images bucket
CREATE POLICY "Users can upload to generated-images" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'generated-images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy 2: Users can view their own files in generated-images bucket
CREATE POLICY "Users can view generated-images" ON storage.objects
FOR SELECT USING (
  bucket_id = 'generated-images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy 3: Users can delete their own files in generated-images bucket
CREATE POLICY "Users can delete generated-images" ON storage.objects
FOR DELETE USING (
  bucket_id = 'generated-images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy 4: Users can update their own files in generated-images bucket (for replacing images)
CREATE POLICY "Users can update generated-images" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'generated-images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
