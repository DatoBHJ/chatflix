-- Create saved-gallery storage bucket
-- This bucket stores all types of saved images (web search, AI-generated, etc.)
-- Run this in Supabase SQL Editor or Dashboard

-- Note: Bucket creation is typically done via Supabase Dashboard
-- but policies can be set up via SQL

-- Storage policies for saved-gallery bucket
-- Policy 1: Users can upload to their own folder
CREATE POLICY "Users can upload to own folder in saved-gallery" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'saved-gallery' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy 2: Users can view their own files
CREATE POLICY "Users can view own files in saved-gallery" ON storage.objects
FOR SELECT USING (
  bucket_id = 'saved-gallery' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy 3: Users can delete their own files
CREATE POLICY "Users can delete own files in saved-gallery" ON storage.objects
FOR DELETE USING (
  bucket_id = 'saved-gallery' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy 4: Users can update their own files
CREATE POLICY "Users can update own files in saved-gallery" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'saved-gallery' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
