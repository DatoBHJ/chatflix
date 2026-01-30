-- Storage policies for background-images bucket
-- Run these in your Supabase SQL editor after creating the 'background-images' bucket

-- Policy 1: Users can upload to their own folder
CREATE POLICY "Users can upload to own folder" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'background-images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy 2: Users can view their own files
CREATE POLICY "Users can view own files" ON storage.objects
FOR SELECT USING (
  bucket_id = 'background-images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy 3: Users can delete their own files
CREATE POLICY "Users can delete own files" ON storage.objects
FOR DELETE USING (
  bucket_id = 'background-images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy 4: Users can update their own files (for replacing images)
CREATE POLICY "Users can update own files" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'background-images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
