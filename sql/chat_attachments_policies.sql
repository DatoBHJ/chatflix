-- Storage policies for chat_attachments bucket
-- Run these in your Supabase SQL editor after creating the 'chat_attachments' bucket

-- First, drop any existing policies with the same names to avoid conflicts
DROP POLICY IF EXISTS "Users can upload to chat_attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can view chat_attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete chat_attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can update chat_attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can view legacy chat_attachments" ON storage.objects;

-- Policy 1: Users can upload to their own folder in chat_attachments bucket
CREATE POLICY "Users can upload to chat_attachments" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'chat_attachments' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy 2: Users can view their own files in chat_attachments bucket (new structure)
CREATE POLICY "Users can view chat_attachments" ON storage.objects
FOR SELECT USING (
  bucket_id = 'chat_attachments' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy 3: Users can delete their own files in chat_attachments bucket (new structure)
CREATE POLICY "Users can delete chat_attachments" ON storage.objects
FOR DELETE USING (
  bucket_id = 'chat_attachments' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy 4: Users can update their own files in chat_attachments bucket (new structure)
CREATE POLICY "Users can update chat_attachments" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'chat_attachments' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy 5: Legacy support - Users can view root-level files (backward compatibility)
CREATE POLICY "Users can view legacy chat_attachments" ON storage.objects
FOR SELECT USING (
  bucket_id = 'chat_attachments' AND
  array_length(storage.foldername(name), 1) IS NULL
);
