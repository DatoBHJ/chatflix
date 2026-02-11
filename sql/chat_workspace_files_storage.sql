-- Supabase Storage bucket for binary workspace files (pptx, xlsx, pdf, etc.)
-- created by run_python_code and persisted for rehydration.
-- Run in Supabase SQL editor.

-- Create the storage bucket (private, not public, 200 MB file limit for large PPT/PDF)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('chat-workspace-files', 'chat-workspace-files', false, 209715200)
ON CONFLICT (id) DO UPDATE SET file_size_limit = 209715200;

-- Storage policies: allow authenticated users to upload and read their own files.
-- Files are namespaced by chat_id prefix: {chatId}/{timestamp}_{filename}

-- Allow authenticated uploads
DROP POLICY IF EXISTS "Allow authenticated uploads to chat-workspace-files" ON storage.objects;
CREATE POLICY "Allow authenticated uploads to chat-workspace-files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'chat-workspace-files'
    AND auth.role() = 'authenticated'
  );

-- Allow authenticated reads (signed URLs generated server-side)
DROP POLICY IF EXISTS "Allow authenticated reads from chat-workspace-files" ON storage.objects;
CREATE POLICY "Allow authenticated reads from chat-workspace-files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'chat-workspace-files'
    AND auth.role() = 'authenticated'
  );

-- Allow service role full access (for server-side operations)
DROP POLICY IF EXISTS "Allow service role full access to chat-workspace-files" ON storage.objects;
CREATE POLICY "Allow service role full access to chat-workspace-files"
  ON storage.objects FOR ALL
  USING (
    bucket_id = 'chat-workspace-files'
  )
  WITH CHECK (
    bucket_id = 'chat-workspace-files'
  );
