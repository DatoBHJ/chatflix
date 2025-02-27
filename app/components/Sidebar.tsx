'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { DatabaseMessage, Chat } from '@/lib/types'
import { SystemPromptDialog } from './SystemPromptDialog'
import { PromptShortcutsDialog, openShortcutsDialog } from './PromptShortcutsDialog'
import { ThemeToggle } from './ThemeToggle'
import { AccountDialog } from './AccountDialog'
import { deleteChat } from '@/app/chat/[id]/utils'
import { getModelById } from '@/lib/models/config'

interface SidebarProps {
  user: any;  // You might want to define a proper User type
  onClose?: () => void;  // Add onClose prop
}

export function Sidebar({ user, onClose }: SidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [chats, setChats] = useState<Chat[]>([])
  const supabase = createClient()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isSystemPromptOpen, setIsSystemPromptOpen] = useState(false)
  const [isAccountOpen, setIsAccountOpen] = useState(false)

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

  // Add click outside handler
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (isMenuOpen && !target.closest('.menu-container')) {
        setIsMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

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

  const handleDeleteChat = async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    
    if (!confirm('Do you want to delete this chat?')) return

    try {
      await deleteChat(chatId);

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
      // Get all chat sessions
      const { data: sessions } = await supabase
        .from('chat_sessions')
        .select('id')
        .eq('user_id', user.id);

      if (sessions) {
        // Delete each chat session and its associated files
        await Promise.all(sessions.map(session => deleteChat(session.id)));
      }

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
    <div className="w-80 h-full bg-[var(--background)]">
      <div className="h-full flex flex-col">
        {/* Top Section - New Chat Button */}
        <div className="pt-12 px-6 pb-6" style={{ borderBottom: '1px solid var(--subtle-divider)' }}>
          <button
            onClick={() => {
              router.push('/')
              onClose?.()
            }}
            className="w-full h-[46px] flex items-center justify-center gap-3 text-sm uppercase tracking-wider hover:text-[var(--muted)] transition-colors"
            title="New Chat"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>new chat</span>
          </button>
        </div>

        {/* Chat List Section */}
        <div className="flex-1 overflow-y-auto sidebar-scroll">
          <div className="p-6">
            {chats.length > 0 && (
              <div className="mb-8">
                <button
                  onClick={handleDeleteAllChats}
                  className="w-full py-3 text-xs flex items-center justify-center gap-2 text-red-500 hover:text-red-700 transition-colors uppercase tracking-wider"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M3 6h18" />
                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                    <line x1="10" y1="11" x2="10" y2="17" />
                    <line x1="14" y1="11" x2="14" y2="17" />
                  </svg>
                  <span>Delete All Chats</span>
                </button>
              </div>
            )}
            
            <div className="space-y-10">
              {chats.map((chat) => (
                <div
                  key={chat.id}
                  className={`group yeezy-sidebar-item ${
                    pathname === `/chat/${chat.id}` ? 'bg-[var(--accent)]' : ''
                  }`}
                  onClick={() => {
                    router.push(`/chat/${chat.id}`)
                    onClose?.()
                  }}
                >
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="font-medium truncate">{chat.title}</div>
                      {chat.messages.length > 0 && chat.messages[chat.messages.length - 1].model && (
                        <div className="text-[var(--muted)] text-xs uppercase">
                          {getModelById(chat.messages[chat.messages.length - 1].model)?.name || 
                           chat.messages[chat.messages.length - 1].model.split('.')[0]}
                        </div>
                      )}
                      <div className="text-[var(--muted)] text-xs truncate">
                        {(() => {
                          const date = new Date(chat.lastMessageTime || chat.created_at);
                          const now = new Date();
                          const isToday = date.toDateString() === now.toDateString();
                          const isThisYear = date.getFullYear() === now.getFullYear();
                          
                          const time = date.toLocaleTimeString('en-US', { 
                            hour: 'numeric', 
                            minute: '2-digit',
                            hour12: true 
                          });
                          
                          if (isToday) {
                            return time;
                          } else if (isThisYear) {
                            return `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${time}`;
                          } else {
                            return `${date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })} ${time}`;
                          }
                        })()}
                      </div>
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

        {/* Bottom Section */}
        <div className="mt-auto">
          <div className="px-6 pt-6 pb-10 flex flex-col gap-2">
            <button
              onClick={() => openShortcutsDialog()}
              className="w-full px-4 py-3 text-sm flex items-center gap-3 hover:bg-[var(--accent)] transition-colors"
              title="Manage Shortcuts"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
              <span className="text-xs uppercase tracking-wider">Shortcuts</span>
            </button>
            <button
              onClick={() => setIsSystemPromptOpen(true)}
              className="w-full px-4 py-3 text-sm flex items-center gap-3 hover:bg-[var(--accent)] transition-colors"
              title="Edit System Prompt"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
              <span className="text-xs uppercase tracking-wider">System Prompt</span>
            </button>
            <button
              onClick={() => setIsAccountOpen(true)}
              className="w-full px-4 py-3 text-sm flex items-center gap-3 hover:bg-[var(--accent)] transition-colors group"
              title="Account Settings"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <span className="text-xs uppercase tracking-wider truncate">
                {user.email}
              </span>
            </button>
          </div>
        </div>

        {/* Dialogs */}
        <SystemPromptDialog
          isOpen={isSystemPromptOpen}
          onClose={() => setIsSystemPromptOpen(false)}
          user={user}
        />
        <AccountDialog
          isOpen={isAccountOpen}
          onClose={() => setIsAccountOpen(false)}
          user={user}
        />
      </div>
    </div>
  )
} 