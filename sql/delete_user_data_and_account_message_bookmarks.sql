-- Add message_bookmarks deletion to delete_user_data_and_account so account
-- deletion removes all user data including bookmarks (no orphan rows).
CREATE OR REPLACE FUNCTION public.delete_user_data_and_account(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Delete user model preferences
  DELETE FROM user_model_preferences WHERE user_id = p_user_id;

  -- Delete prompt shortcuts
  DELETE FROM prompt_shortcuts WHERE user_id = p_user_id;

  -- Delete system prompts
  DELETE FROM system_prompts WHERE user_id = p_user_id;

  -- Delete message bookmarks (before messages so no orphan refs)
  DELETE FROM message_bookmarks WHERE user_id = p_user_id;

  -- Delete messages
  DELETE FROM messages WHERE user_id = p_user_id;

  -- Delete chat sessions
  DELETE FROM chat_sessions WHERE user_id = p_user_id;

  -- Delete from all_user table
  DELETE FROM all_user WHERE id = p_user_id;
END;
$function$;
