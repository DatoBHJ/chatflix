'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { DatabaseMessage, Chat } from '@/lib/types'

interface SidebarProps {
  user: any;  // You might want to define a proper User type
}

export function Sidebar({ user }: SidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [chats, setChats] = useState<Chat[]>([])
  const supabase = createClient()

  useEffect(() => {
    if (user) {
      loadChats()
    } else {
      setChats([])
    }

    // 실시간 업데이트를 위한 채널 설정
    const chatChannel = supabase
      .channel('chat-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_sessions',
          filter: `user_id=eq.${user?.id}`
        },
        async (payload) => {
          console.log('Chat session change:', payload)
          await loadChats()
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `user_id=eq.${user?.id}`
        },
        async (payload) => {
          console.log('Message change:', payload)
          await loadChats()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(chatChannel)
    }
  }, [user])

  async function loadChats() {
    if (!user) return;

    try {
      const { data: sessions, error: sessionsError } = await supabase
        .from('chat_sessions')
        .select('*, messages:messages(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (sessionsError) {
        console.error('Error loading chat sessions:', sessionsError)
        return
      }

      const chatsWithMessages = sessions.map(session => {
        const messages = session.messages || []
        const lastMessageTime = messages.length > 0 
          ? Math.max(...messages.map((m: { created_at: string | number | Date }) => new Date(m.created_at).getTime()))
          : new Date(session.created_at).getTime()

        const firstUserMessage = messages.find((m: { role: string }) => m.role === 'user')
        const title = firstUserMessage?.content || 'New Chat'

        return {
          id: session.id,
          title: title,
          messages: messages,
          created_at: session.created_at,
          lastMessageTime: lastMessageTime,
          lastMessage: messages[messages.length - 1]?.content
        }
      })

      chatsWithMessages.sort((a, b) => b.lastMessageTime - a.lastMessageTime)
      setChats(chatsWithMessages)
    } catch (error) {
      console.error('Error in loadChats:', error)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setChats([])
    router.push('/login')
  }

  const handleDeleteChat = async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    
    if (!confirm('Do you want to delete this chat?')) return

    try {
      await supabase
        .from('messages')
        .delete()
        .eq('chat_session_id', chatId)
        .eq('user_id', user.id)

      await supabase
        .from('chat_sessions')
        .delete()
        .eq('id', chatId)
        .eq('user_id', user.id)

      if (pathname === `/chat/${chatId}`) {
        router.push('/')
      }

      loadChats()
    } catch (error) {
      console.error('Failed to delete chat:', error)
      alert('Failed to delete chat.')
    }
  }

  const handleDeleteAllChats = async () => {
    if (!confirm('Do you want to delete all chats? This action cannot be undone.')) return

    try {
      await supabase
        .from('messages')
        .delete()
        .eq('user_id', user.id)

      await supabase
        .from('chat_sessions')
        .delete()
        .eq('user_id', user.id)

      router.push('/')
      loadChats()
    } catch (error) {
      console.error('Failed to delete all chats:', error)
      alert('Failed to delete chats.')
    }
  }

  if (!user) {
    return null;
  }

  return (
    <div className="w-80 h-full bg-[var(--background)] border-r border-[var(--accent)]">
      <div className="h-full flex flex-col">
        {/* Top Section - New Chat Button */}
        <div className="pt-24 px-6 pb-6 border-b border-[var(--accent)]">
          <button
            onClick={() => router.push('/')}
            className="w-full h-[46px] flex items-center justify-center text-sm uppercase tracking-wider hover:text-[var(--muted)] transition-colors"
            title="New Chat"
          >
            new chat
          </button>
        </div>

        {/* Chat List Section */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6">
            {chats.length > 0 && (
              <div className="mb-8">
                <button
                  onClick={handleDeleteAllChats}
                  className="w-full py-3 text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors uppercase tracking-wider"
                >
                  Delete All Chats
                </button>
              </div>
            )}
            
            <div className="space-y-1">
              {chats.map((chat) => (
                <div
                  key={chat.id}
                  className={`group yeezy-sidebar-item ${
                    pathname === `/chat/${chat.id}` ? 'bg-[var(--accent)]' : ''
                  }`}
                  onClick={() => router.push(`/chat/${chat.id}`)}
                >
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="font-medium truncate">{chat.title}</div>
                      <div className="text-[var(--muted)] text-xs truncate">
                        {new Date(chat.created_at).toLocaleDateString()}
                      </div>
                      {chat.messages[1] && (
                        <div className="text-[var(--muted)] text-xs uppercase">
                          {chat.messages[1].host}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={(e) => handleDeleteChat(chat.id, e)}
                      className="opacity-0 group-hover:opacity-100 text-[var(--muted)] hover:text-[var(--foreground)] transition-all"
                      title="Delete chat"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Section - User Info & Sign Out */}
        <div className="mt-auto px-6 py-6 border-t border-[var(--accent)]">
          <div className="text-xs text-center text-[var(--muted)] mb-4 uppercase tracking-wider">
            {user.email}
          </div>
          <button
            onClick={handleSignOut}
            className="w-full h-[46px] flex items-center justify-center text-sm uppercase tracking-wider hover:text-[var(--muted)] transition-colors"
            title="Sign Out"
          >
            sign out
          </button>
        </div>
      </div>
    </div>
  )
} 