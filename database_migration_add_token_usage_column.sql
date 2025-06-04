-- Add token_usage column to messages table
-- This script should be run in Supabase SQL Editor

-- 1. Add the new token_usage column
ALTER TABLE public.messages 
ADD COLUMN token_usage JSONB;

-- 2. Create an index on the token_usage column for better performance
CREATE INDEX IF NOT EXISTS idx_messages_token_usage 
ON public.messages USING GIN (token_usage);

-- 3. Add comment to document the column purpose
COMMENT ON COLUMN public.messages.token_usage IS 'Stores token usage information including promptTokens, completionTokens, and totalTokens from AI model responses';

-- 4. Update RLS policies to include the new column
-- Note: Since this is an addition to existing table, existing policies should automatically apply
-- But we'll explicitly ensure the column is accessible

-- Drop and recreate the select policy to ensure it includes the new column
DROP POLICY IF EXISTS "Users can view their own messages" ON public.messages;
CREATE POLICY "Users can view their own messages" 
ON public.messages FOR SELECT 
USING (auth.uid() = user_id);

-- Drop and recreate the insert policy
DROP POLICY IF EXISTS "Users can insert their own messages" ON public.messages;
CREATE POLICY "Users can insert their own messages" 
ON public.messages FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Drop and recreate the update policy
DROP POLICY IF EXISTS "Users can update their own messages" ON public.messages;
CREATE POLICY "Users can update their own messages" 
ON public.messages FOR UPDATE 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

-- Drop and recreate the delete policy
DROP POLICY IF EXISTS "Users can delete their own messages" ON public.messages;
CREATE POLICY "Users can delete their own messages" 
ON public.messages FOR DELETE 
USING (auth.uid() = user_id);

-- 5. Optional: Migrate existing token_usage data from tool_results to the new column
-- This will extract token_usage from tool_results and move it to the new column
UPDATE public.messages 
SET token_usage = (tool_results->>'token_usage')::jsonb,
    tool_results = tool_results - 'token_usage'
WHERE tool_results ? 'token_usage' 
AND token_usage IS NULL;

-- 6. Create a function to automatically clean token_usage from tool_results on future inserts/updates
CREATE OR REPLACE FUNCTION clean_token_usage_from_tool_results()
RETURNS TRIGGER AS $$
BEGIN
  -- If tool_results contains token_usage and token_usage column is empty, move it
  IF NEW.tool_results ? 'token_usage' AND NEW.token_usage IS NULL THEN
    NEW.token_usage := (NEW.tool_results->>'token_usage')::jsonb;
    NEW.tool_results := NEW.tool_results - 'token_usage';
  END IF;
  
  -- If both exist, remove from tool_results to avoid duplication
  IF NEW.tool_results ? 'token_usage' AND NEW.token_usage IS NOT NULL THEN
    NEW.tool_results := NEW.tool_results - 'token_usage';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. Create trigger to automatically apply the cleaning function
DROP TRIGGER IF EXISTS trigger_clean_token_usage ON public.messages;
CREATE TRIGGER trigger_clean_token_usage
  BEFORE INSERT OR UPDATE ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION clean_token_usage_from_tool_results();

-- 8. Grant necessary permissions (adjust if needed based on your setup)
-- This ensures the new column is accessible by the same roles that can access the table
GRANT SELECT, INSERT, UPDATE ON public.messages TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated; 