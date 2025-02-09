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

  return (
    <div className="w-64 h-full bg-[var(--background)] border-r border-[var(--accent)]">
      <div className="p-4">
        <button
          onClick={handleNewChat}
          className="w-full p-3 mb-4 bg-[var(--accent)] rounded hover:opacity-80"
        >
          New Chat
        </button>
        
        <div className="space-y-2">
          {chats.map((chat) => (
            <div
              key={chat.id}
              className={`p-3 rounded cursor-pointer ${
                pathname === `/chat/${chat.id}`
                  ? 'bg-[var(--accent)]' 
                  : 'hover:bg-[var(--accent)]'
              }`}
              onClick={() => router.push(`/chat/${chat.id}`)}
            >
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
          ))}
        </div>
      </div>
    </div>
  )
} 