-- RLS Policies for legacy_file_ownership table
-- Run this after creating and populating the legacy_file_ownership table

-- Enable RLS on the table
ALTER TABLE legacy_file_ownership ENABLE ROW LEVEL SECURITY;

-- Policy 1: Users can view their own legacy files
CREATE POLICY "Users can view their own legacy files"
ON legacy_file_ownership
FOR SELECT
USING (auth.uid() = user_id);

-- Policy 2: Allow insert for authenticated users (for future updates)
CREATE POLICY "Authenticated users can insert legacy files"
ON legacy_file_ownership
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy 3: Users can update their own legacy files
CREATE POLICY "Users can update their own legacy files"
ON legacy_file_ownership
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy 4: Users can delete their own legacy files
CREATE POLICY "Users can delete their own legacy files"
ON legacy_file_ownership
FOR DELETE
USING (auth.uid() = user_id);

-- Verify policies are created
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  cmd
FROM pg_policies
WHERE tablename = 'legacy_file_ownership'
ORDER BY policyname;
