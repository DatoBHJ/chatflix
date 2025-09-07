import { createClient as createSupabaseClient } from '@/utils/supabase/client'
import { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime'

export interface DeleteAllChatsParams {
  user: any
  router: AppRouterInstance
  supabase?: any
}

/**
 * Delete all chats for a user with confirmation dialogs
 * @param params - Object containing user, router, and optional supabase client
 */
export const handleDeleteAllChats = async (params: DeleteAllChatsParams) => {
  const { user, router, supabase: providedSupabase } = params
  
  // 🚀 익명 사용자 지원: 익명 사용자는 채팅 삭제 불가
  const isAnonymousUser = user?.is_anonymous || user?.id === 'anonymous' || !user
  if (isAnonymousUser) return;
  
  // First confirmation - warn about data loss including AI Recap data
  if (!confirm('Warning: Deleting all chats will also remove your personalized AI Recap analytics data. This action cannot be undone.')) return

  // Second confirmation - extra step to make deletion harder
  if (!confirm('Are you absolutely sure? Type "DELETE" in the next prompt to confirm permanent deletion of all chat data and analytics.')) return
  
  const confirmationInput = window.prompt('Please type "DELETE" to confirm:')
  if (confirmationInput !== 'DELETE') {
    alert('Deletion cancelled. Your chats and analytics data have been preserved.')
    return
  }

  try {
    // Use provided supabase client or create a new one
    const supabase = providedSupabase || createSupabaseClient()
    
    // Get all chat sessions
    const { data: sessions } = await supabase
      .from('chat_sessions')
      .select('id')
      .eq('user_id', user.id);

    if (sessions) {
      // Delete each chat session and its associated files
      for (const session of sessions) {
        try {
          const response = await fetch(`/api/chat/delete/${session.id}`, {
            method: 'DELETE',
          });
          
          if (!response.ok) {
            console.error(`Failed to delete chat session ${session.id}`);
          }
        } catch (error) {
          console.error(`Error deleting chat session ${session.id}:`, error);
        }
      }
    }

    router.push('/')
    alert('All chats have been deleted successfully.')
  } catch (error) {
    console.error('Failed to delete all chats:', error)
    alert('Failed to delete all chats. Please try again.')
  }
}
