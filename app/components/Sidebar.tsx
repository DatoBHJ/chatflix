'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { DatabaseMessage, Chat } from '@/lib/types'

export function Sidebar() {
  const router = useRouter()
  const pathname = usePathname()
  const [chats, setChats] = useState<Chat[]>([])

  useEffect(() => {
    loadChats()

    const chatChannel = supabase
      .channel('chat-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_sessions'
        },
        () => {
          loadChats()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(chatChannel)
    }
  }, [])

  async function loadChats() {
    const { data: sessions, error: sessionsError } = await supabase
      .from('chat_sessions')
      .select('*')
      .order('created_at', { ascending: false })

    if (sessionsError) {
      console.error('Error loading chat sessions:', sessionsError)
      return
    }

    const chatsWithMessages = await Promise.all(
      sessions.map(async (session) => {
        const { data: messages, error: messagesError } = await supabase
          .from('messages')
          .select('*')
          .eq('chat_session_id', session.id)
          .order('created_at', { ascending: true })

        if (messagesError) {
          console.error('Error loading messages:', messagesError)
          return null
        }

        const firstUserMessage = messages.find(m => m.role === 'user')
        const title = firstUserMessage?.content || 'New Chat'

        return {
          id: session.id,
          title: title,
          messages: messages,
          created_at: session.created_at,
          lastMessage: messages[messages.length - 1]?.content
        }
      })
    )

    setChats(chatsWithMessages.filter(Boolean) as Chat[])
  }

  const handleNewChat = () => {
    router.push('/chat')
  }

  const handleDeleteChat = async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent chat selection event
    
    if (!confirm('Do you want to delete this chat?')) return

    try {
      // 먼저 메시지 삭제
      await supabase
        .from('messages')
        .delete()
        .eq('chat_session_id', chatId)

      // 그 다음 세션 삭제
      await supabase
        .from('chat_sessions')
        .delete()
        .eq('id', chatId)

      // 현재 삭제된 채팅을 보고 있었다면 /chat으로 리다이렉트
      if (pathname === `/chat/${chatId}`) {
        router.push('/chat')
      }

      // 채팅 목록 새로고침
      loadChats()
    } catch (error) {
      console.error('Failed to delete chat:', error)
      alert('Failed to delete chat.')
    }
  }

  const handleDeleteAllChats = async () => {
    if (!confirm('Do you want to delete all chats? This action cannot be undone.')) return

    try {
      // 먼저 모든 메시지 삭제
      await supabase
        .from('messages')
        .delete()
        .neq('id', '0') // 모든 메시지 삭제

      // 그 다음 모든 세션 삭제
      await supabase
        .from('chat_sessions')
        .delete()
        .neq('id', '0') // 모든 세션 삭제

      // /chat으로 리다이렉트
      router.push('/chat')

      // 채팅 목록 새로고침
      loadChats()
    } catch (error) {
      console.error('Failed to delete all chats:', error)
      alert('Failed to delete chats.')
    }
  }

  return (
    <div className="w-64 h-full bg-[var(--background)] border-r border-[var(--accent)]">
      <div className="p-4">
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => router.push('/chat')}
            className="flex-1 p-3 bg-[var(--accent)] rounded hover:opacity-80"
          >
            New Chat
          </button>
          <button
            onClick={() => router.push('/')}
            className="p-3 bg-[var(--accent)] rounded hover:opacity-80"
            title="Home"
          >
            🏠
          </button>
        </div>

        {chats.length > 0 && (
          <button
            onClick={handleDeleteAllChats}
            className="w-full p-2 mb-4 text-sm text-red-500 hover:text-red-400 transition-colors"
          >
            Delete All Chats
          </button>
        )}
        
        <div className="space-y-2">
          {chats.map((chat) => (
            <div
              key={chat.id}
              className={`group p-3 rounded cursor-pointer ${
                pathname === `/chat/${chat.id}`
                  ? 'bg-[var(--accent)]' 
                  : 'hover:bg-[var(--accent)]'
              }`}
              onClick={() => router.push(`/chat/${chat.id}`)}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{chat.title}</div>
                  <div className="text-xs opacity-50 truncate mt-1">
                    {new Date(chat.created_at).toLocaleDateString()}
                  </div>
                  {chat.messages[0] && (
                    <div className="text-xs opacity-50 mt-1">
                      {chat.messages[0].host}
                    </div>
                  )}
                </div>
                <button
                  onClick={(e) => handleDeleteChat(chat.id, e)}
                  className="opacity-0 group-hover:opacity-100 ml-2 p-1 text-red-500 hover:text-red-400 transition-opacity"
                  title="Delete chat"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
} 