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

    // 실시간 업데이트를 위한 채널 설정
    const chatChannel = supabase
      .channel('chat-updates')
      .on(
        'postgres_changes',
        {
          event: '*',  // INSERT, UPDATE, DELETE 모두 감지
          schema: 'public',
          table: 'chat_sessions'
        },
        async (payload) => {
          console.log('Chat session change:', payload);
          // 변경 즉시 채팅 목록 새로고침
          await loadChats()
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',  // INSERT, UPDATE, DELETE 모두 감지
          schema: 'public',
          table: 'messages'
        },
        async (payload) => {
          console.log('Message change:', payload);
          // 메시지 변경 즉시 채팅 목록 새로고침
          await loadChats()
        }
      )
      .subscribe()

    // Add event listener for new chat creation
    const handleChatCreated = (event: CustomEvent<Chat>) => {
      setChats(prevChats => [event.detail, ...prevChats]);
    };

    window.addEventListener('chatCreated', handleChatCreated as EventListener);

    return () => {
      supabase.removeChannel(chatChannel)
      window.removeEventListener('chatCreated', handleChatCreated as EventListener);
    }
  }, [])

  async function loadChats() {
    try {
      // 세션을 최신 수정 시간 순으로 정렬
      const { data: sessions, error: sessionsError } = await supabase
        .from('chat_sessions')
        .select('*, messages:messages(*, created_at)')  // messages 테이블과 join
        .order('created_at', { ascending: false })

      if (sessionsError) {
        console.error('Error loading chat sessions:', sessionsError)
        return
      }

      const chatsWithMessages = sessions.map(session => {
        const messages = session.messages || []
        // 가장 최근 메시지 시간을 기준으로 정렬
        const lastMessageTime = messages.length > 0 
          ? Math.max(...messages.map((m: { created_at: string | number | Date }) => new Date(m.created_at).getTime()))
          : new Date(session.created_at).getTime()

        // 첫 번째 사용자 메시지를 제목으로 사용
        const firstUserMessage = messages.find((m: { role: string }) => m.role === 'user')
        const title = firstUserMessage?.content || 'New Chat'

        return {
          id: session.id,
          title: title,
          messages: messages,
          created_at: session.created_at,
          lastMessageTime: lastMessageTime,  // 정렬을 위한 추가 필드
          lastMessage: messages[messages.length - 1]?.content
        }
      })

      // 마지막 메시지 시간 기준으로 정렬
      chatsWithMessages.sort((a, b) => b.lastMessageTime - a.lastMessageTime)

      console.log('Updated chats:', chatsWithMessages)
      setChats(chatsWithMessages)
    } catch (error) {
      console.error('Error in loadChats:', error)
    }
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

      // 현재 삭제된 채팅을 보고 있었다면 홈페이지로 리다이렉트
      if (pathname === `/chat/${chatId}`) {
        router.push('/')
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

      // 홈페이지로 리다이렉트
      router.push('/')

      // 채팅 목록 새로고침
      loadChats()
    } catch (error) {
      console.error('Failed to delete all chats:', error)
      alert('Failed to delete chats.')
    }
  }

  return (
    <div className="w-80 h-full bg-[var(--background)] border-r border-[var(--accent)]">
      <div className="h-full flex flex-col">
        {/* Top Section with Padding for Menu Button */}
        <div className="pt-24 px-6 pb-6 border-b border-[var(--accent)]">
          <button
            onClick={() => router.push('/')}
            className="w-full h-[46px] flex items-center justify-center text-sm uppercase tracking-wider hover:text-[var(--muted)] transition-colors"
            title="Home"
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
      </div>
    </div>
  )
} 