'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { Chat } from '@/lib/types'
import { AccountDialog, fetchUserName } from './AccountDialog'
import { deleteChat } from '@/app/chat/[id]/utils'
import Link from 'next/link'
import Image from 'next/image'
import { defaultPromptShortcuts } from '../lib/defaultPromptShortcuts'

interface SidebarProps {
  user: any;  // You might want to define a proper User type
  onClose?: () => void;  // Add onClose prop
}

// 다른 컴포넌트에서 바로가기 패널을 열기 위한 전역 이벤트
const EXPAND_SHORTCUTS_EVENT = 'expand-shortcuts';

export function expandShortcuts() {
  document.dispatchEvent(new CustomEvent(EXPAND_SHORTCUTS_EVENT));
}

export function Sidebar({ user, onClose }: SidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [chats, setChats] = useState<Chat[]>([])
  const supabase = createClient()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isAccountOpen, setIsAccountOpen] = useState(false)
  const [profileImage, setProfileImage] = useState<string | null>(null)
  const [userName, setUserName] = useState('You')
  const [isExpanded, setIsExpanded] = useState(false)
  const [isExpandedSystem, setIsExpandedSystem] = useState(false)
  const [isExpandedShortcuts, setIsExpandedShortcuts] = useState(false)
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false)

  // Shortcuts 관련 상태
  const [shortcuts, setShortcuts] = useState<any[]>([])
  const [newName, setNewName] = useState('')
  const [newContent, setNewContent] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Add function to fetch profile image
  const fetchProfileImage = async (userId: string) => {
    try {
      // Try to get profile image from storage
      const { data: profileData, error: profileError } = await supabase
        .storage
        .from('profile-pics')
        .list(`${userId}`);

      if (profileError) {
        console.error('Error fetching profile image:', profileError);
        return;
      }

      // If profile image exists, get public URL
      if (profileData && profileData.length > 0) {
        try {
          const { data } = supabase
            .storage
            .from('profile-pics')
            .getPublicUrl(`${userId}/${profileData[0].name}`);
          
          setProfileImage(data.publicUrl);
        } catch (error) {
          console.error('Error getting public URL for profile image:', error);
        }
      }
    } catch (error) {
      console.error('Error fetching profile image:', error);
    }
  };

  // Load user info when component mounts or user changes
  useEffect(() => {
    if (user) {
      // Load user name from all_user table
      const loadUserData = async () => {
        const name = await fetchUserName(user.id, supabase);
        setUserName(name);
        fetchProfileImage(user.id);
      };
      
      loadUserData();
    }
  }, [user]);

  // Effect to scroll to top when editing starts
  useEffect(() => {
    if (editingId && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  }, [editingId]);

  // 전역 이벤트 리스너 등록
  useEffect(() => {
    const handleExpandShortcuts = () => {
      if (user) {
        setIsExpandedShortcuts(true)
      }
    }
    
    document.addEventListener(EXPAND_SHORTCUTS_EVENT, handleExpandShortcuts)
    return () => {
      document.removeEventListener(EXPAND_SHORTCUTS_EVENT, handleExpandShortcuts)
    }
  }, [user])

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
        .limit(30)  // Limit to 30 most recent chat sessions

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

  // 프롬프트 바로가기 관련 함수들
  async function loadShortcuts() {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('prompt_shortcuts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      
      // If user has no shortcuts, add default ones
      if (!data || data.length === 0) {
        const defaultShortcutsWithIds = defaultPromptShortcuts.map((shortcut) => ({
          id: `ps-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          name: shortcut.name,
          content: shortcut.content,
          user_id: user.id
        }))

        const { error: insertError } = await supabase
          .from('prompt_shortcuts')
          .insert(defaultShortcutsWithIds)

        if (insertError) throw insertError
        setShortcuts(defaultShortcutsWithIds)
      } else {
        setShortcuts(data)
      }
    } catch (error) {
      console.error('Error loading shortcuts:', error)
    }
  }

  async function handleAddShortcut() {
    if (!newName.trim() || !newContent.trim()) return

    try {
      const formattedName = newName.trim().replace(/\s+/g, '_')

      if (editingId && editingId !== 'new') {
        // Update existing shortcut
        const { error } = await supabase
          .from('prompt_shortcuts')
          .update({
            name: formattedName,
            content: newContent.trim(),
          })
          .eq('id', editingId)
          .eq('user_id', user.id)

        if (error) throw error
      } else {
        // Add new shortcut
        const { error } = await supabase
          .from('prompt_shortcuts')
          .insert({
            id: `ps-${Date.now()}`,
            name: formattedName,
            content: newContent.trim(),
            user_id: user.id
          })

        if (error) throw error
      }
      
      setNewName('')
      setNewContent('')
      setEditingId(null)
      loadShortcuts()
    } catch (error) {
      console.error('Error saving shortcut:', error)
    }
  }

  function handleEditShortcut(shortcut: any) {
    setEditingId(shortcut.id)
    setNewName(shortcut.name)
    setNewContent(shortcut.content)
    setOpenMenuId(null)
  }

  function handleCancelShortcut() {
    setEditingId(null)
    setNewName('')
    setNewContent('')
  }

  async function handleDeleteShortcut(id: string) {
    try {
      const { error } = await supabase
        .from('prompt_shortcuts')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

      if (error) throw error
      setOpenMenuId(null)
      loadShortcuts()
    } catch (error) {
      console.error('Error deleting shortcut:', error)
    }
  }

  useEffect(() => {
    if (isExpandedShortcuts && user) {
      loadShortcuts();
    }
  }, [isExpandedShortcuts, user]);

  // 토글 함수들 단순화
  const toggleExpanded = () => {
    if (isExpanded) {
      setIsExpanded(false);
      if (!isExpandedSystem && !isExpandedShortcuts) {
        setIsSidebarExpanded(false);
      }
    } else {
      setIsSidebarExpanded(true);
      setIsExpanded(true);
      setIsExpandedSystem(false);
      setIsExpandedShortcuts(false);
    }
  };

  const toggleShortcuts = () => {
    if (isExpandedShortcuts) {
      setIsExpandedShortcuts(false);
      if (!isExpanded && !isExpandedSystem) {
        setIsSidebarExpanded(false);
      }
    } else {
      setIsSidebarExpanded(true);
      setIsExpandedShortcuts(true);
      setIsExpanded(false);
      setIsExpandedSystem(false);
      
      // 토글할 때 바로 데이터 로딩 시작
      if (user && shortcuts.length === 0) {
        loadShortcuts();
      }
    }
  };

  // 초기 렌더링 시 미리 데이터 로드
  useEffect(() => {
    if (user) {
      // 사이드바 열리자마자 바로가기 데이터 미리 로드
      loadShortcuts();
    }
  }, [user]);

  if (!user) {
    return null;
  }

  return (
    <div className={`${isSidebarExpanded ? 'w-72 md:w-80' : 'w-16 md:w-16'} h-full bg-[var(--background)] border-r border-[var(--accent)] flex flex-col items-center overflow-hidden`}>
      <div className="h-full flex flex-col w-full">
        {/* Top Section with Home and Chats icons */}
        <div className="pt-5 md:pt-8 px-3 flex flex-col space-y-4 md:space-y-5">
          <Link href="/" onClick={onClose}>
            <div className="flex items-center group">
              <div className="min-w-[40px] h-10 rounded-lg flex items-center justify-center hover:bg-[var(--accent)] transition-all duration-200">
                <svg 
                  width="20" 
                  height="20" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  className="group-hover:scale-110 transition-transform duration-200"
                >
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                  <polyline points="9 22 9 12 15 12 15 22"></polyline>
                </svg>
              </div>
              <span className={`ml-3 text-sm font-medium whitespace-nowrap ${isSidebarExpanded ? 'block' : 'hidden'}`}>
                Home
              </span>
            </div>
          </Link>
          
          <button onClick={toggleExpanded} className="flex items-center group w-full text-left">
            <div className={`min-w-[40px] h-10 rounded-lg flex items-center justify-center transition-all duration-200 ${isExpanded ? 'bg-[var(--foreground)]/10' : 'hover:bg-[var(--accent)]'}`}>
              <svg 
                width="20" 
                height="20" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke={isExpanded ? "var(--foreground)" : "currentColor"}
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                className={`${isExpanded ? 'scale-110' : 'group-hover:scale-110'} transition-transform duration-200`}
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <span className={`ml-3 whitespace-nowrap ${isSidebarExpanded ? 'block' : 'hidden'} ${isExpanded ? 'font-bold text-base text-[var(--foreground)]' : 'font-medium text-sm'}`}>
              Chat History
            </span>
          </button>
        </div>

        {/* Main Content Area */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto sidebar-scroll w-full mt-4 md:mt-5 px-2 md:px-3">
          {isExpanded && (
            <div className="space-y-3 sm:space-y-6 pb-4 pl-0 ml-4 border-l border-[var(--sidebar-divider)] relative">
              {chats.length > 0 ? (
                chats.map((chat) => (
                  <div
                    key={chat.id}
                    className="group shortcut-item bg-[var(--accent)]/5 hover:bg-[var(--accent)]/20 p-3 rounded-lg relative transition-all cursor-pointer"
                    onClick={() => {
                      router.push(`/chat/${chat.id}`)
                      onClose?.()
                    }}
                  >
                    <div className="flex pr-12">
                      <div className="flex-1 flex flex-col gap-1 text-left">
                        <span className="text-sm font-medium tracking-wide">
                          {chat.title.length > 40 ? chat.title.substring(0, 40) + '...' : chat.title}
                        </span>
                        <span className="text-xs line-clamp-2 text-[var(--muted)]">
                          {(() => {
                            const date = new Date(chat.lastMessageTime || chat.created_at);
                            return date.toLocaleDateString();
                          })()}
                        </span>
                      </div>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-1 items-center justify-center">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteChat(chat.id, e);
                          }}
                          className="p-1.5 rounded-md bg-[var(--accent)]/20 hover:bg-red-500/20 transition-colors"
                          title="Delete chat"
                          type="button"
                          aria-label="Delete chat"
                        >
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="px-4 py-3 text-sm text-[var(--muted)] text-center bg-[var(--accent)]/5 rounded-lg">
                  No chats yet
                </div>
              )}
            </div>
          )}

          {isExpandedShortcuts && (
            <div className="space-y-3 pb-4 pl-0 ml-4 border-l border-[var(--sidebar-divider)] relative">
              {editingId ? (
                // Edit/Create Form
                <div className="bg-[var(--accent)]/5 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-sm font-medium">
                      {editingId !== 'new' ? 'Edit Shortcut' : 'Add New Shortcut'}
                    </h3>
                    <button 
                      onClick={handleCancelShortcut}
                      className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                      type="button"
                    >
                      ×
                    </button>
                  </div>
                  
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full p-2.5 bg-[var(--accent)] text-sm focus:outline-none rounded-lg"
                    placeholder="Shortcut name (without @)"
                  />
                  <textarea
                    ref={textareaRef}
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    className="w-full min-h-[120px] p-2.5 bg-[var(--accent)] text-sm resize-none focus:outline-none rounded-lg"
                    placeholder="Prompt content"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleAddShortcut}
                      disabled={!newName.trim() || !newContent.trim()}
                      className="flex-1 py-2.5 text-xs uppercase tracking-wider bg-[var(--foreground)] text-[var(--background)] hover:opacity-90 transition-opacity disabled:opacity-50 rounded-lg font-medium"
                      type="button"
                    >
                      {editingId !== 'new' ? 'Update' : 'Save Shortcut'}
                    </button>
                    <button
                      onClick={handleCancelShortcut}
                      className="w-24 py-2.5 text-xs uppercase tracking-wider bg-[var(--accent)] hover:opacity-90 transition-opacity rounded-lg font-medium"
                      type="button"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                // Add New Button
                <button
                  onClick={() => {
                    setEditingId('new');
                    setNewName('');
                    setNewContent('');
                  }}
                  className="w-full px-4 py-3 text-left transition-all duration-300 group relative overflow-hidden bg-[var(--accent)]/5 hover:bg-[var(--accent)]/20 rounded-lg"
                  type="button"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-[var(--accent)]/10 to-transparent opacity-100 transition-opacity duration-300" />
                  <div className="flex items-center justify-between relative">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-md bg-[var(--accent)]/20 flex items-center justify-center transition-all duration-300 group-hover:scale-110">
                        <svg 
                          width="14" 
                          height="14" 
                          viewBox="0 0 24 24" 
                          fill="none" 
                          stroke="currentColor" 
                          strokeWidth="1.5" 
                          strokeLinecap="round" 
                          className="text-[var(--foreground)] transition-colors transform rotate-0 duration-300"
                        >
                          <line x1="12" y1="5" x2="12" y2="19" />
                          <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                      </div>
                      <div className="flex flex-col items-start gap-0.5">
                        <span className="text-xs tracking-wide text-[var(--foreground)] transition-colors font-medium">
                        ADD NEW SHORTCUT
                        </span>
                        <span className="text-[10px] text-[var(--muted)] transition-colors">
                          Create custom prompt templates
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              )}
              
              {/* Shortcuts List with Loading State */}
              <div className="space-y-2 mt-3 pr-1">
                {shortcuts.map((shortcut) => (
                  <div 
                    key={shortcut.id} 
                    className="shortcut-item group bg-[var(--accent)]/5 hover:bg-[var(--accent)]/20 p-3 rounded-lg relative transition-all"
                  >
                    <div className="flex pr-16">
                      <div className="flex-1 flex flex-col gap-1 text-left">
                        <span className="text-sm font-medium tracking-wide">
                          @{shortcut.name}
                        </span>
                        <span className="text-xs line-clamp-2 text-[var(--muted)]">
                          {shortcut.content.substring(0, 80)}{shortcut.content.length > 80 ? '...' : ''}
                        </span>
                      </div>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-1 items-center justify-center">
                        <button 
                          onClick={() => handleEditShortcut(shortcut)}
                          className="p-1.5 rounded-md bg-[var(--accent)]/20 hover:bg-[var(--accent)]/40 transition-colors"
                          type="button"
                          aria-label="Edit shortcut"
                        >
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                          </svg>
                        </button>
                        <button 
                          onClick={() => handleDeleteShortcut(shortcut.id)}
                          className="p-1.5 rounded-md bg-[var(--accent)]/20 hover:bg-red-500/20 transition-colors"
                          type="button"
                          aria-label="Delete shortcut"
                        >
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {shortcuts.length === 0 && (
                  <div className="px-4 py-3 text-sm text-[var(--muted)] text-center bg-[var(--accent)]/5 rounded-lg">
                    No shortcuts yet. Create one to get started!
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Section */}
        <div className="mt-6 pb-5 md:pb-8 flex flex-col space-y-4 md:space-y-5 px-3">
          <button
            onClick={toggleShortcuts}
            className="flex items-center group w-full text-left"
            type="button"
          >
            <div className={`min-w-[40px] h-10 rounded-lg flex items-center justify-center transition-all duration-200 ${isExpandedShortcuts ? 'bg-[var(--foreground)]/10' : 'hover:bg-[var(--accent)]'}`}>
              <svg 
                width="20" 
                height="20" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke={isExpandedShortcuts ? "var(--foreground)" : "currentColor"}
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                className={`${isExpandedShortcuts ? 'scale-110' : 'group-hover:scale-110'} transition-transform duration-200`}
              >
                <circle cx="12" cy="12" r="4" />
                <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8" />
              </svg>
            </div>
            <span className={`ml-3 whitespace-nowrap ${isSidebarExpanded ? 'block' : 'hidden'} ${isExpandedShortcuts ? 'font-bold text-base text-[var(--foreground)]' : 'font-medium text-sm'}`}>
              Shortcuts
            </span>
          </button>
          
          <Link href="/bookmarks" className="flex items-center group">
            <div className="min-w-[40px] h-10 rounded-lg flex items-center justify-center hover:bg-[var(--accent)] transition-all duration-200">
              <svg 
                width="20" 
                height="20" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                className="group-hover:scale-110 transition-transform duration-200"
              >
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
              </svg>
            </div>
            <span className={`ml-3 text-sm font-medium whitespace-nowrap ${isSidebarExpanded ? 'block' : 'hidden'}`}>
              Bookmarks
            </span>
          </Link>
          
          <Link href="/user-insights" onClick={onClose} className="flex items-center group">
            <div className="min-w-[40px] h-10 rounded-lg flex items-center justify-center hover:bg-[var(--accent)] transition-all duration-200">
              <svg 
                width="20" 
                height="20" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                className="group-hover:scale-110 transition-transform duration-200"
              >
                <line x1="18" y1="20" x2="18" y2="10"></line>
                <line x1="12" y1="20" x2="12" y2="4"></line>
                <line x1="6" y1="20" x2="6" y2="14"></line>
              </svg>
            </div>
            <span className={`ml-3 text-sm font-medium whitespace-nowrap ${isSidebarExpanded ? 'block' : 'hidden'}`}>
              My Chatflix Recap
            </span>
          </Link>
          
          <button
            onClick={() => {
              setIsAccountOpen(true);
              setIsSidebarExpanded(true);
            }}
            className="flex items-center group w-full text-left mt-2"
            type="button"
          >
            <div className="min-w-[40px] h-10 rounded-lg flex items-center justify-center hover:bg-[var(--accent)] transition-all duration-200">
              <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-[var(--accent)] group-hover:border-[var(--foreground)] transition-colors">
                {profileImage ? (
                  <Image 
                    src={profileImage} 
                    alt={userName} 
                    width={32}
                    height={32}
                    className="object-cover w-full h-full"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-[var(--foreground)] text-[var(--background)]">
                    {userName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            </div>
            <span className={`ml-3 text-sm font-medium whitespace-nowrap ${isSidebarExpanded ? 'block' : 'hidden'}`}>
              {userName}
            </span>
          </button>
        </div>

        {/* Account Dialog (remains as a modal) */}
        <AccountDialog
          isOpen={isAccountOpen}
          onClose={() => {
            setIsAccountOpen(false);
            // After closing the dialog, refresh user data in case it was updated
            if (user) {
              const refreshUserData = async () => {
                const name = await fetchUserName(user.id, supabase);
                setUserName(name);
                fetchProfileImage(user.id);
              };
              refreshUserData();
            }
            // Check if no panels are expanded before collapsing sidebar
            if (!isExpanded && !isExpandedSystem && !isExpandedShortcuts) {
              setIsSidebarExpanded(false);
            }
          }}
          user={user}
          profileImage={profileImage}
          handleDeleteAllChats={handleDeleteAllChats}
        />
      </div>
    </div>
  )
} 