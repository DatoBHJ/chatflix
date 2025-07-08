'use client'

import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { Chat } from '@/lib/types'
import { AccountDialog, fetchUserName } from './AccountDialog'
import { deleteChat } from '@/app/chat/[id]/utils'
import Link from 'next/link'
import Image from 'next/image'
import { defaultPromptShortcuts } from '../lib/defaultPromptShortcuts'
import { getModelById } from '@/lib/models/config'
import { getProviderLogo, hasLogo } from '@/app/lib/models/logoUtils'
import { getSidebarTranslations } from '../lib/sidebarTranslations'

interface SidebarProps {
  user: any;  // You might want to define a proper User type
}

// 다른 컴포넌트에서 바로가기 패널을 열기 위한 전역 이벤트
const EXPAND_SHORTCUTS_EVENT = 'expand-shortcuts';

export function expandShortcuts() {
  document.dispatchEvent(new CustomEvent(EXPAND_SHORTCUTS_EVENT));
}

export function Sidebar({ user }: SidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [chats, setChats] = useState<Chat[]>([])
  const supabase = createClient()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isAccountOpen, setIsAccountOpen] = useState(false)
  const [profileImage, setProfileImage] = useState<string | null>(null)
  const [userName, setUserName] = useState('You')
  const [isExpanded, setIsExpanded] = useState(true)
  const [isExpandedShortcuts, setIsExpandedShortcuts] = useState(false)
  const [translations, setTranslations] = useState({
    home: 'Home',
    chatHistory: 'Chat History',
    shortcuts: 'Shortcuts',
    bookmarks: 'Bookmarks',
    searchConversations: 'Search conversations...',
    editShortcut: 'Edit Shortcut',
    addShortcut: 'Add New Shortcut',
    shortcutNamePlaceholder: 'Shortcut name (without @)',
    promptContentPlaceholder: 'Prompt content',
    updateButton: 'Update',
    saveShortcutButton: 'Save Shortcut',
    cancelButton: 'Cancel',
    addNewShortcutButton: 'ADD NEW SHORTCUT',
    createCustomPromptTemplates: 'Create custom prompt templates',
    noShortcutsYet: 'No shortcuts yet. Create one to get started!'
  });

  // 무한 스크롤 관련 상태 추가
  const [currentPage, setCurrentPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [initialLoadComplete, setInitialLoadComplete] = useState(false)
  const CHATS_PER_PAGE = 15
  const observerRef = useRef<IntersectionObserver | null>(null)
  const loadMoreTriggerRef = useRef<HTMLDivElement | null>(null)

  // Shortcuts 관련 상태
  const [shortcuts, setShortcuts] = useState<any[]>([])
  const [newName, setNewName] = useState('')
  const [newContent, setNewContent] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // 채팅 제목 편집 관련 상태
  const [editingChatId, setEditingChatId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const titleInputRef = useRef<HTMLInputElement>(null)

  // 채팅 검색 관련 상태
  const [searchTerm, setSearchTerm] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [searchResults, setSearchResults] = useState<Chat[]>([])
  const [isSearching, setIsSearching] = useState(false)

  // 최적화를 위한 상태 추가
  const [lastLoadedUserId, setLastLoadedUserId] = useState<string | null>(null)
  const [isChatsLoaded, setIsChatsLoaded] = useState(false)
  const lastLoadTimeRef = useRef<number>(0)
  const CACHE_DURATION = 5 * 60 * 1000 // 5분 캐시

  // 실시간 시간 업데이트를 위한 상태
  const [currentTime, setCurrentTime] = useState(Date.now())

  useEffect(() => {
    setTranslations(getSidebarTranslations());
  }, []);

  // Add function to fetch profile image
  const fetchProfileImage = useCallback(async (userId: string) => {
    if (!userId) {
      console.log('No user ID provided for fetching profile image');
      return;
    }

    let listData: any = null;
    let lastError: Error | null = null;

    // Attempt 1: List files from storage with a timeout
    try {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Storage request timed out')), 5000)
      );
      
      const result = await Promise.race([
        supabase.storage.from('profile-pics').list(`${userId}`),
        timeoutPromise
      ]) as { data: any, error?: any };

      if (result.error) {
        lastError = result.error;
        console.warn('Initial attempt to list profile pics failed with Supabase error:', lastError);
        
        // Optional: Immediate retry if Supabase client itself returned an error (not a timeout)
        if (typeof window !== 'undefined') {
          console.log('Attempting immediate retry for profile image list (due to initial list error)...');
          const newClient = createClient();
          try {
            const { data: directRetryData, error: directRetryError } = await newClient.storage.from('profile-pics').list(`${userId}`);
            if (directRetryError) {
              console.warn('Immediate retry for list also failed:', directRetryError);
              // lastError remains the original Supabase error
            } else {
              console.log('Immediate retry for list successful.');
              listData = directRetryData;
              lastError = null; // Clear error as retry was successful
            }
          } catch (directRetryCatchError: any) {
            console.warn('Exception during immediate list retry:', directRetryCatchError);
            lastError = directRetryCatchError; // Update lastError to this new exception
          }
        }
      } else {
        listData = result.data;
      }
    } catch (e: any) { // This catch is primarily for the timeout from Promise.race
      if (e.message === 'Storage request timed out') {
        console.log('Profile image list: initial request timed out. Attempting retry...');
        lastError = e; // Store the timeout error temporarily

        if (typeof window !== 'undefined') {
          const newClient = createClient();
          try {
            const { data: timeoutRetryData, error: timeoutRetryError } = await newClient.storage.from('profile-pics').list(`${userId}`);
            if (timeoutRetryError) {
              console.warn('Profile image list: retry after timeout failed:', timeoutRetryError);
              // Augment lastError or replace, depending on desired logging
              lastError = new Error(`Timeout followed by retry error: ${timeoutRetryError.message || timeoutRetryError}`);
            } else {
              console.log('Profile image list: retry after timeout successful.');
              listData = timeoutRetryData;
              lastError = null; // Clear error as retry was successful
            }
          } catch (timeoutRetryCatchError: any) {
            console.warn('Profile image list: exception during retry after timeout:', timeoutRetryCatchError);
            lastError = new Error(`Timeout followed by retry exception: ${timeoutRetryCatchError.message || timeoutRetryCatchError}`);
          }
        } else {
          // No client-side retry possible for timeout (e.g. SSR), so timeout is the effective error.
          // lastError is already set to the timeout error.
          console.log('Profile image list: timed out (no client-side retry performed).');
        }
      } else {
        // Other unexpected error from Promise.race
        console.error('Critical error during initial profile pic list attempt (Promise.race):', e);
        lastError = e;
      }
    }

    // After all attempts, if listData is still not populated and an error occurred, log final error and return.
    if (!listData && lastError) {
      console.error('Failed to fetch profile image list after all attempts:', lastError.message || lastError);
      if (lastError.message?.includes('<html>') || lastError.message?.includes('not valid JSON')) {
        console.warn('Received HTML instead of JSON response - this might be a network issue or Supabase authentication problem');
      }
      return; 
    }
    
    if (!listData || listData.length === 0) {
      if (!lastError) { // Only log "No profile images" if there wasn't a preceding error that prevented listing
        console.log('No profile images found for user.');
      }
      // If lastError exists, it means we failed to get the list, error already logged.
      return; 
    }

    // Proceed to get public URL if listData is available
    try {
      const fileName = listData[0].name;
      const filePath = `${userId}/${fileName}`;
      
      if (!fileName || typeof fileName !== 'string') {
        console.error('Invalid file name returned from storage.');
        return;
      }
      
      const { data: urlInfo, error: urlError } = supabase.storage.from('profile-pics').getPublicUrl(filePath) as { data: { publicUrl: string } | null, error: Error | null };
      
      if (urlError) {
        console.error('Error getting public URL for profile image:', urlError);
        return;
      }
      
      if (urlInfo && urlInfo.publicUrl && urlInfo.publicUrl.startsWith('http')) {
        setProfileImage(urlInfo.publicUrl);
      } else {
        console.log('No valid public URL returned or URL is not properly formatted for profile image.');
      }
    } catch (processingError) {
      console.error('Error processing profile data or getting public URL:', processingError);
    }
  }, [supabase]);

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
  }, [user, supabase, fetchProfileImage]);

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

  // 실시간 시간 업데이트
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now())
    }, 60000) // 1분마다 업데이트

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (user) {
      // 사용자가 변경된 경우에만 상태 초기화
      if (lastLoadedUserId !== user.id) {
        setCurrentPage(1)
        setHasMore(true)
        setInitialLoadComplete(false)
        setIsChatsLoaded(false)
        setChats([])
        setLastLoadedUserId(user.id)
      }
    } else {
      setChats([])
      setIsChatsLoaded(false)
      setLastLoadedUserId(null)
    }

    // Only set up real-time updates if user exists
    if (!user) return

    // Set up a simplified real-time channel for essential updates only
    const channelSuffix = Date.now() + Math.random().toString(36).substr(2, 9);
    
    const chatChannel = supabase
      .channel(`chat-updates-${user.id}-${channelSuffix}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_sessions',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('Chat session updated:', payload)
          // Update the chat title or other properties
          setChats(prevChats => 
            prevChats.map(chat => 
              chat.id === payload.new.id 
                ? { ...chat, title: payload.new.title, current_model: payload.new.current_model }
                : chat
            )
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'chat_sessions'
        },
        (payload) => {
          console.log('Chat session deleted:', payload)
          // Remove the deleted chat from state
          setChats(prevChats => prevChats.filter(chat => chat.id !== payload.old.id))
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status)
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to real-time updates')
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Error subscribing to real-time updates')
        }
      })

    return () => {
      console.log('Cleaning up real-time subscription')
      supabase.removeChannel(chatChannel)
    }
  }, [user, supabase]) // Add supabase to dependencies for stability

  // Add custom event listener for immediate chat updates
  useEffect(() => {
    const handleNewChat = (event: CustomEvent) => {
      const chatData = event.detail;
      console.log('New chat created via custom event:', chatData);
      
      // 중복 방지: 이미 존재하는 채팅인지 확인
      setChats(prevChats => {
        const existingChat = prevChats.find(chat => chat.id === chatData.id);
        if (existingChat) {
          console.log('Chat already exists, skipping duplicate');
          return prevChats;
        }
        
        // 새 채팅 생성
        const newChat: Chat = {
          id: chatData.id,
          title: chatData.title,
          created_at: chatData.created_at,
          messages: [],
          lastMessageTime: new Date(chatData.created_at).getTime(),
          lastMessage: chatData.initial_message || '',
          current_model: chatData.current_model
        };
        
        // 새 채팅을 맨 위에 추가하고 시간순으로 정렬
        const updatedChats = [newChat, ...prevChats].sort((a, b) => {
          const timeA = a.lastMessageTime ?? 0;
          const timeB = b.lastMessageTime ?? 0;
          return timeB - timeA;
        });
        
        console.log('Updated chats with new chat:', updatedChats);
        return updatedChats;
      });
    };

    const handleChatTitleUpdated = (event: CustomEvent) => {
      const { id, title } = event.detail;
      console.log('Chat title updated via custom event:', { id, title });
      
      // Update the chat title in the chats array
      setChats(prevChats => {
        return prevChats.map(chat => 
          chat.id === id ? { ...chat, title } : chat
        );
      });
    };

    // Add event listeners
    window.addEventListener('newChatCreated', handleNewChat as EventListener);
    window.addEventListener('chatTitleUpdated', handleChatTitleUpdated as EventListener);

    // Cleanup
    return () => {
      window.removeEventListener('newChatCreated', handleNewChat as EventListener);
      window.removeEventListener('chatTitleUpdated', handleChatTitleUpdated as EventListener);
    };
  }, []);

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

  const loadChats = useCallback(async (page = 1, append = false, forceRefresh = false) => {
    if (!user) return;
    
    // 최적화: 캐시된 데이터가 있고 강제 새로고침이 아닌 경우 스킵
    const now = Date.now();
    const isCacheValid = now - lastLoadTimeRef.current < CACHE_DURATION;
    
    if (!forceRefresh && page === 1 && !append && isChatsLoaded && isCacheValid && lastLoadedUserId === user.id) {
      console.log('[Sidebar] Using cached chat data');
      return;
    }
    
    try {
      // 추가 로드 시 로딩 상태 표시
      if (append) {
        setIsLoadingMore(true)
      }

      // 페이지네이션 적용
      const from = (page - 1) * CHATS_PER_PAGE
      const to = from + CHATS_PER_PAGE - 1

      // First, fetch only chat session data with limited columns
      const { data: sessions, error: sessionsError } = await supabase
        .from('chat_sessions')
        .select('id, created_at, title, current_model')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .range(from, to)

      if (sessionsError) {
        console.error('Error loading chat sessions:', sessionsError)
        setIsLoadingMore(false)
        return
      }

      // 더 이상 불러올 채팅이 없는지 확인
      if (sessions.length < CHATS_PER_PAGE) {
        setHasMore(false)
      }

      // For each session, fetch only the most recent message and the first user message
      const chatPromises = sessions.map(async (session) => {
        // Get the first user message (for title fallback)
        const { data: firstUserMsg } = await supabase
          .from('messages')
          .select('content, created_at')
          .eq('chat_session_id', session.id)
          .eq('role', 'user')
          .order('created_at', { ascending: true })
          .limit(1)

        // Get the most recent message timestamp and last used model
        const { data: latestMsg } = await supabase
          .from('messages')
          .select('content, created_at, model')
          .eq('chat_session_id', session.id)
          .order('created_at', { ascending: false })
          .limit(1)

        const title = session.title && session.title.trim().length > 0
          ? session.title
          : (firstUserMsg && firstUserMsg.length > 0
              ? (firstUserMsg[0].content.length > 40 
                  ? firstUserMsg[0].content.substring(0, 40) + '...' 
                  : firstUserMsg[0].content)
              : 'Untitled Chat')
        
        const lastMessage = latestMsg && latestMsg.length > 0
          ? latestMsg[0].content
          : ''
        
        const lastMessageTime = latestMsg && latestMsg.length > 0 
          ? new Date(latestMsg[0].created_at).getTime()
          : new Date(session.created_at).getTime()

        // Get the current model from session or last message
        const currentModel = session.current_model || 
          (latestMsg && latestMsg.length > 0 ? latestMsg[0].model : null)

        // Create an object that matches the Chat type
        return {
          id: session.id,
          title: title,
          created_at: session.created_at,
          messages: [], // Empty array since we're not loading all messages
          lastMessageTime: lastMessageTime,
          lastMessage: lastMessage,
          current_model: currentModel
        } as Chat
      })

      // Wait for all queries to complete
      const newChats = await Promise.all(chatPromises)

      // Sort by last message time
      newChats.sort((a, b) => {
        // Handle possibly undefined lastMessageTime values
        const timeA = a.lastMessageTime ?? 0;
        const timeB = b.lastMessageTime ?? 0;
        return timeB - timeA;
      })

      // title이 비어있는 채팅방만 제외 (모든 제목 허용)
      const filteredChats = newChats.filter(chat => chat.title && chat.title.trim() !== '');
      
      if (append) {
        setChats(prevChats => [...prevChats, ...filteredChats])
      } else {
        setChats(filteredChats)
      }
      
      // 초기 로드 완료 표시
      if (page === 1) {
        setInitialLoadComplete(true)
        setIsChatsLoaded(true)
        setLastLoadedUserId(user.id)
        lastLoadTimeRef.current = Date.now()
      }
      
      // 다음 페이지 설정
      if (append) {
        setCurrentPage(page)
      }
      
      setIsLoadingMore(false)
    } catch (error) {
      console.error('Error in loadChats:', error)
      setIsLoadingMore(false)
    }
  }, [user, isChatsLoaded, lastLoadedUserId])

  // 기존 방식 (폴백용)
  const loadChatsOriginal = useCallback(async (page = 1, append = false, forceRefresh = false) => {
    if (!user) return;
    
    try {
      if (append) {
        setIsLoadingMore(true)
      }

      const from = (page - 1) * CHATS_PER_PAGE
      const to = from + CHATS_PER_PAGE - 1

      const { data: sessions, error: sessionsError } = await supabase
        .from('chat_sessions')
        .select('id, created_at, title, current_model')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .range(from, to)

      if (sessionsError) {
        console.error('Error loading chat sessions:', sessionsError)
        setIsLoadingMore(false)
        return
      }

      if (sessions.length < CHATS_PER_PAGE) {
        setHasMore(false)
      }

      // 🐌 기존 방식: 각 세션마다 개별 쿼리 (N+1 문제)
      const chatPromises = sessions.map(async (session) => {
        const { data: firstUserMsg } = await supabase
          .from('messages')
          .select('content, created_at')
          .eq('chat_session_id', session.id)
          .eq('role', 'user')
          .order('created_at', { ascending: true })
          .limit(1)

        const { data: latestMsg } = await supabase
          .from('messages')
          .select('content, created_at, model')
          .eq('chat_session_id', session.id)
          .order('created_at', { ascending: false })
          .limit(1)

        const title = session.title && session.title.trim().length > 0
          ? session.title
          : (firstUserMsg && firstUserMsg.length > 0
              ? (firstUserMsg[0].content.length > 40 
                  ? firstUserMsg[0].content.substring(0, 40) + '...' 
                  : firstUserMsg[0].content)
              : 'Untitled Chat')
        
        const lastMessage = latestMsg && latestMsg.length > 0
          ? latestMsg[0].content
          : ''
        
        const lastMessageTime = latestMsg && latestMsg.length > 0 
          ? new Date(latestMsg[0].created_at).getTime()
          : new Date(session.created_at).getTime()

        const currentModel = session.current_model || 
          (latestMsg && latestMsg.length > 0 ? latestMsg[0].model : null)

        return {
          id: session.id,
          title: title,
          created_at: session.created_at,
          messages: [],
          lastMessageTime: lastMessageTime,
          lastMessage: lastMessage,
          current_model: currentModel
        } as Chat
      })

      const newChats = await Promise.all(chatPromises)

      newChats.sort((a, b) => {
        const timeA = a.lastMessageTime ?? 0;
        const timeB = b.lastMessageTime ?? 0;
        return timeB - timeA;
      })

      const filteredChats = newChats.filter(chat => chat.title && chat.title.trim() !== '');
      
      if (append) {
        setChats(prevChats => [...prevChats, ...filteredChats])
      } else {
        setChats(filteredChats)
      }
      
      if (page === 1) {
        setInitialLoadComplete(true)
        setIsChatsLoaded(true)
        setLastLoadedUserId(user.id)
        lastLoadTimeRef.current = Date.now()
      }
      
      if (append) {
        setCurrentPage(page)
      }
      
      setIsLoadingMore(false)
    } catch (error) {
      console.error('Error in loadChatsOriginal:', error)
      setIsLoadingMore(false)
    }
  }, [user, supabase])

  // Effect to load chats when needed
  useEffect(() => {
    if (user && !isChatsLoaded) {
      loadChats(1, false, true);
    }
  }, [user, isChatsLoaded, loadChats]);

  // IntersectionObserver 설정
  useEffect(() => {
    // 스크롤 관찰자 설정 (무한 스크롤용) - 검색 중이 아닐 때만 활성화
    if (isExpanded && initialLoadComplete && hasMore && !searchTerm) {
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && !isLoadingMore && hasMore) {
            loadChats(currentPage + 1, true)
          }
        },
        { threshold: 0.1 }
      )

      if (loadMoreTriggerRef.current) {
        observer.observe(loadMoreTriggerRef.current)
      }
      
      observerRef.current = observer
      
      return () => {
        if (observerRef.current) {
          observerRef.current.disconnect()
        }
      }
    }
  }, [isExpanded, initialLoadComplete, currentPage, isLoadingMore, hasMore, searchTerm])

  const handleDeleteChat = useCallback(async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    
    try {
      await deleteChat(chatId);

      if (pathname === `/chat/${chatId}`) {
        router.push('/')
      }

      // 채팅 삭제 후 캐시 무효화하고 새로고침
      setIsChatsLoaded(false)
      loadChats(1, false, true)
    } catch (error) {
      console.error('Failed to delete chat:', error)
      alert('Failed to delete chat.')
    }
  }, [pathname, router, loadChats])

  const handleDeleteAllChats = useCallback(async () => {
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
      setIsChatsLoaded(false)
      loadChats(1, false, true)
    } catch (error) {
      console.error('Failed to delete all chats:', error)
      alert('Failed to delete chats.')
    }
  }, [user, supabase, router, loadChats])

  // 프롬프트 바로가기 관련 함수들
  const loadShortcuts = useCallback(async () => {
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
  }, [user, supabase])

  const handleAddShortcut = useCallback(async () => {
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
  }, [newName, newContent, editingId, user, supabase, loadShortcuts])

  const handleEditShortcut = useCallback((shortcut: any) => {
    setEditingId(shortcut.id)
    setNewName(shortcut.name)
    setNewContent(shortcut.content)
    setOpenMenuId(null)
  }, [])

  const handleCancelShortcut = useCallback(() => {
    setEditingId(null)
    setNewName('')
    setNewContent('')
  }, [])

  const handleDeleteShortcut = useCallback(async (id: string) => {
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
  }, [user, supabase, loadShortcuts])

  // 채팅 제목 편집 관련 함수들
  const handleEditChatTitle = useCallback((chatId: string, currentTitle: string) => {
    setEditingChatId(chatId)
    setEditingTitle(currentTitle)
    // 다음 렌더링 후 input에 포커스
    setTimeout(() => {
      if (titleInputRef.current) {
        titleInputRef.current.focus()
        titleInputRef.current.select()
      }
    }, 0)
  }, [])

  const handleSaveChatTitle = useCallback(async () => {
    if (!editingChatId || !editingTitle.trim()) {
      setEditingChatId(null)
      setEditingTitle('')
      return
    }

    try {
      const { error } = await supabase
        .from('chat_sessions')
        .update({ title: editingTitle.trim() })
        .eq('id', editingChatId)
        .eq('user_id', user.id)

      if (error) throw error

      // 로컬 상태 업데이트
      setChats(prevChats => 
        prevChats.map(chat => 
          chat.id === editingChatId 
            ? { ...chat, title: editingTitle.trim() }
            : chat
        )
      )

      setEditingChatId(null)
      setEditingTitle('')
    } catch (error) {
      console.error('Error updating chat title:', error)
      alert('Failed to update chat title.')
    }
  }, [editingChatId, editingTitle, user, supabase])

  const handleCancelChatTitleEdit = useCallback(() => {
    setEditingChatId(null)
    setEditingTitle('')
  }, [])

  const handleChatTitleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSaveChatTitle()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleCancelChatTitleEdit()
    }
  }, [handleSaveChatTitle, handleCancelChatTitleEdit])

  useEffect(() => {
    if (isExpandedShortcuts && user) {
      loadShortcuts();
    }
  }, [isExpandedShortcuts, user]);

  // 데이터베이스에서 채팅 검색
  const searchChats = useCallback(async (term: string) => {
    if (!user || !term.trim()) {
      setIsSearching(false);
      return;
    }
    
    setIsSearching(true);
    try {
      const search = term.toLowerCase();
      
      // 🚀 최적화된 검색: RPC 함수 사용
      const { data: searchResults, error: searchError } = await supabase
        .rpc('search_chat_sessions_with_messages', {
          p_user_id: user.id,
          p_search_term: search,
          p_limit: 50
        })

      if (searchError) {
        console.error('Error searching chats:', searchError)
        
        // RPC 함수가 없는 경우 기존 방식으로 폴백
        if (searchError.message?.includes('function') || searchError.message?.includes('does not exist')) {
          console.log('Search RPC function not found, falling back to original method')
          return await searchChatsOriginal(term)
        }
        
        setSearchResults([])
        setIsSearching(false)
        return
      }

      // 데이터 변환
      const searchChatsWithDetails = searchResults.map((row: any) => {
        const title = row.title && row.title.trim().length > 0
          ? row.title
          : (row.first_user_content && row.first_user_content.length > 0
              ? (row.first_user_content.length > 40 
                  ? row.first_user_content.substring(0, 40) + '...' 
                  : row.first_user_content)
              : 'Untitled Chat');
        
        const lastMessage = row.latest_content || '';
        const lastMessageTime = row.latest_message_time 
          ? new Date(row.latest_message_time).getTime()
          : new Date(row.created_at).getTime();

        const currentModel = row.current_model || row.latest_model || null;

        return {
          id: row.id,
          title: title,
          created_at: row.created_at,
          messages: [],
          lastMessageTime: lastMessageTime,
          lastMessage: lastMessage,
          current_model: currentModel
        } as Chat;
      });

      // 시간순 정렬
      searchChatsWithDetails.sort((a: Chat, b: Chat) => {
        const timeA = a.lastMessageTime ?? 0;
        const timeB = b.lastMessageTime ?? 0;
        return timeB - timeA;
      });

      setSearchResults(searchChatsWithDetails);
    } catch (error) {
      console.error('Error searching chats:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [user?.id]); // 최소한의 의존성으로 최적화

  // 기존 검색 방식 (폴백용)
  const searchChatsOriginal = useCallback(async (term: string) => {
    if (!user || !term.trim()) {
      setIsSearching(false);
      return;
    }
    
    const search = term.toLowerCase();
    
    try {
      // 1. 제목으로 검색
      const { data: titleResults } = await supabase
        .from('chat_sessions')
        .select('id, created_at, title, current_model')
        .eq('user_id', user.id)
        .ilike('title', `%${search}%`)
        .order('created_at', { ascending: false })
        .limit(20);

      // 2. 메시지 내용으로 검색
      const { data: messageResults } = await supabase
        .from('messages')
        .select('chat_session_id, content, created_at')
        .eq('user_id', user.id)
        .ilike('content', `%${search}%`)
        .order('created_at', { ascending: false })
        .limit(50);

      // 메시지 검색 결과에서 채팅 세션 ID 추출
      const sessionIds = messageResults 
        ? [...new Set(messageResults.map(msg => msg.chat_session_id))]
        : [];

      // 메시지 검색으로 찾은 채팅 세션 정보 가져오기
      const { data: sessionResults } = sessionIds.length > 0 
        ? await supabase
            .from('chat_sessions')
            .select('id, created_at, title, current_model')
            .eq('user_id', user.id)
            .in('id', sessionIds)
        : { data: [] };

      // 모든 검색 결과 병합 (중복 제거)
      const allSessions = [...(titleResults || []), ...(sessionResults || [])];
      const uniqueSessions = allSessions.filter((session, index, self) => 
        index === self.findIndex(s => s.id === session.id)
      );

      // 🐌 기존 방식: 각 세션마다 개별 쿼리 (N+1 문제)
      const searchChatsWithDetails = await Promise.all(
        uniqueSessions.map(async (session) => {
          // 첫 번째 사용자 메시지 (제목 폴백용)
          const { data: firstUserMsg } = await supabase
            .from('messages')
            .select('content, created_at')
            .eq('chat_session_id', session.id)
            .eq('role', 'user')
            .order('created_at', { ascending: true })
            .limit(1);

          // 최신 메시지
          const { data: latestMsg } = await supabase
            .from('messages')
            .select('content, created_at, model')
            .eq('chat_session_id', session.id)
            .order('created_at', { ascending: false })
            .limit(1);

          const title = session.title && session.title.trim().length > 0
            ? session.title
            : (firstUserMsg && firstUserMsg.length > 0
                ? (firstUserMsg[0].content.length > 40 
                    ? firstUserMsg[0].content.substring(0, 40) + '...' 
                    : firstUserMsg[0].content)
                : 'Untitled Chat');
          
          const lastMessage = latestMsg && latestMsg.length > 0
            ? latestMsg[0].content
            : '';
          
          const lastMessageTime = latestMsg && latestMsg.length > 0 
            ? new Date(latestMsg[0].created_at).getTime()
            : new Date(session.created_at).getTime();

          const currentModel = session.current_model || 
            (latestMsg && latestMsg.length > 0 ? latestMsg[0].model : null);

          return {
            id: session.id,
            title: title,
            created_at: session.created_at,
            messages: [],
            lastMessageTime: lastMessageTime,
            lastMessage: lastMessage,
            current_model: currentModel
          } as Chat;
        })
      );

      // 시간순 정렬
      searchChatsWithDetails.sort((a: Chat, b: Chat) => {
        const timeA = a.lastMessageTime ?? 0;
        const timeB = b.lastMessageTime ?? 0;
        return timeB - timeA;
      });

      setSearchResults(searchChatsWithDetails);
    } catch (error) {
      console.error('Error searching chats (original):', error);
      setSearchResults([]);
    }
  }, [user?.id, supabase])

  // 검색 초기화 함수
  const clearSearch = useCallback(() => {
    setSearchTerm('');
    setSearchResults([]);
    setIsSearching(false);
  }, []);

  // 검색어 변경 시 검색 실행 (디바운싱)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchTerm.trim()) {
        searchChats(searchTerm);
      } else {
        setSearchResults([]);
        setIsSearching(false);
      }
    }, 300); // 300ms 디바운싱

    return () => clearTimeout(timeoutId);
  }, [searchTerm]); // searchChats 의존성 제거로 불필요한 재실행 방지

  // 표시할 채팅 목록 결정
  const displayChats = useMemo(() => {
    return searchTerm.trim() ? searchResults : chats;
  }, [searchTerm, searchResults, chats]);

  // 검색어 하이라이팅 함수
  const highlightSearchTerm = (text: string, term: string, isSelected: boolean = false) => {
    if (!term.trim()) return text;
    
    const regex = new RegExp(`(${term})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => {
      if (regex.test(part)) {
        return (
          <span 
            key={index} 
            className={`px-0.5 rounded text-xs ${
              isSelected 
                ? 'bg-white/30 text-white font-medium' 
                : 'bg-[#007AFF]/20 text-[#007AFF] font-medium'
            }`}
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  // 토글 함수들 단순화
  const toggleExpanded = useCallback(() => {
    if (isExpanded) {
      setIsExpanded(false);
      clearSearch(); // 채팅 목록을 닫을 때 검색 상태 초기화
    } else {
      setIsExpanded(true);
      setIsExpandedShortcuts(false);
    }
  }, [isExpanded, clearSearch]);

  const toggleShortcuts = useCallback(() => {
    if (isExpandedShortcuts) {
      setIsExpandedShortcuts(false);
    } else {
      setIsExpandedShortcuts(true);
      setIsExpanded(false);
      
      // 토글할 때 바로 데이터 로딩 시작
      if (user && shortcuts.length === 0) {
        loadShortcuts();
      }
    }
  }, [isExpandedShortcuts, user, shortcuts.length, loadShortcuts]);

  // 초기 렌더링 시 미리 데이터 로드
  useEffect(() => {
    if (user) {
      // 사이드바 열리자마자 바로가기 데이터 미리 로드
      loadShortcuts();
    }
  }, [user]);

  // 검색 키보드 단축키 (Ctrl/Cmd + K)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        if (isExpanded && searchInputRef.current) {
          searchInputRef.current.focus();
        } else if (!isExpanded) {
          setIsExpanded(true);
          setIsExpandedShortcuts(false);
          // 다음 렌더링 후 포커스
          setTimeout(() => {
            if (searchInputRef.current) {
              searchInputRef.current.focus();
            }
          }, 100);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isExpanded]);

  // 페이지 변경 시 검색 상태 초기화 (채팅 페이지가 아닌 경우에만)
  useEffect(() => {
    // 채팅 페이지가 아닌 다른 페이지로 이동했을 때만 검색 상태 초기화
    if (!pathname.startsWith('/chat/') && pathname !== '/') {
      clearSearch();
    }
  }, [pathname, clearSearch]);

  // 컴포넌트 언마운트 시 검색 상태 초기화
  useEffect(() => {
    return () => {
      clearSearch();
    };
  }, [clearSearch]);

  if (!user) {
    return null;
  }

  return (
    <div className="w-80 h-full bg-[var(--background)] border-r border-[var(--accent)] flex flex-col items-center overflow-hidden relative ">
      <div className="h-full flex flex-col w-full">
        {/* Top Section with Home and Chats icons */}
        <div className="pt-4 px-3 flex flex-col space-y-4 md:space-y-5">
          <Link href="/">
            <div className="flex items-center group">
              <div className="min-w-[40px] h-10 rounded-lg flex items-center justify-center hover:bg-[var(--foreground)]/8 transition-all duration-200">
                <svg 
                  width="16" 
                  height="16" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="#007AFF"
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  className="transition-transform duration-200"
                >
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                  <polyline points="9 22 9 12 15 12 15 22"></polyline>
                </svg>
              </div>
              <span className="text-sm font-medium whitespace-nowrap text-[var(--muted)]">
                {translations.home}
              </span>
            </div>
          </Link>
          
          <button onClick={toggleExpanded} className="flex items-center group w-full text-left">
            <div className={`min-w-[40px] h-10 rounded-lg flex items-center justify-center transition-all duration-200 ${isExpanded ? 'bg-[var(--foreground)]/10' : 'hover:bg-[var(--foreground)]/8 text-[var(--muted)]'}`}>
              <svg 
                width="16" 
                height="16" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="#007AFF"
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                className="transition-transform duration-200"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <span className={`text-sm font-medium whitespace-nowrap ${isExpanded ? 'text-[var(--foreground)]' : 'text-[var(--muted)]'}`}>
              {translations.chatHistory}
            </span>
          </button>
        </div>

        {/* Main Content Area */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto sidebar-scroll w-full mt-4 md:mt-5 px-2 md:px-3">
          {/* Chat History Section */}
          {useMemo(() => {
            if (!isExpanded) return null;
            
            return (
            <div className="space-y-3">
              {/* Search Input */}
              <div className="px-2">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg 
                      width="16" 
                      height="16" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                      className="text-[var(--muted)]"
                    >
                      <circle cx="11" cy="11" r="8"></circle>
                      <path d="m21 21-4.35-4.35"></path>
                    </svg>
                  </div>
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder={`${translations.searchConversations} (⌘K)`}
                    className="w-full pl-10 pr-4 py-2.5 bg-[var(--accent)] text-sm rounded-lg placeholder-[var(--muted)] focus:outline-none focus:bg-[var(--accent)] border-0 outline-none ring-0 focus:ring-0 focus:border-0 shadow-none focus:shadow-none transition-all"
                    style={{ 
                      outline: 'none',
                      border: 'none',
                      boxShadow: 'none',
                      WebkitAppearance: 'none'
                    }}
                  />
                  {searchTerm && (
                    <button
                      onClick={clearSearch}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                      type="button"
                      aria-label="Clear search"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                    </button>
                  )}
                </div>
              </div>
              
              <div className="space-y-0.5">
              {/* 검색 로딩 상태 표시 */}
              {isSearching && (
                <div className="flex flex-col items-center py-4 space-y-2">
                  <div className="w-6 h-6 border-2 border-t-transparent border-[var(--foreground)] rounded-full animate-spin"></div>
                  <span className="text-xs text-[var(--muted)]">Searching all conversations...</span>
                </div>
              )}
              
              {/* 검색 결과 개수 표시 */}
              {searchTerm && !isSearching && displayChats.length > 0 && (
                <div className="px-2 py-1 text-xs text-[var(--muted)] text-center">
                  Found {displayChats.length} conversation{displayChats.length !== 1 ? 's' : ''}
                </div>
              )}
              
              {!isSearching && displayChats.length > 0 ? (
                <>
                    {displayChats.map((chat, index) => {
                      const isSelected = pathname === `/chat/${chat.id}`;
                      const getModelDisplayName = (model: string | null | undefined) => {
                        if (!model) return 'Unknown Model';
                        
                        // Get model configuration from config.ts
                        const modelConfig = getModelById(model);
                        if (modelConfig) {
                          // Use the actual model name instead of abbreviation
                          return modelConfig.name;
                        }
                        
                        // Fallback for models not in config
                        return model.charAt(0).toUpperCase() + model.slice(1);
                      };
                      
                      const getModelConfig = (model: string | null | undefined) => {
                        if (!model) return null;
                        return getModelById(model);
                      };
                      
                      return (
                        <div key={`${chat.id}-${index}`} className="border-b border-[var(--accent)] last:border-b-0">
                          <Link
                            href={editingChatId === chat.id ? '#' : `/chat/${chat.id}`}
                            className={`group relative block transition-all p-3 rounded-lg ${
                              editingChatId === chat.id 
                                ? 'cursor-default' 
                                : 'cursor-pointer'
                            } ${
                              isSelected 
                                ? 'bg-[#007AFF] text-white' 
                                : 'hover:bg-[var(--accent)]'
                            }`}
                            onClick={(e) => {
                              if (editingChatId === chat.id) {
                                e.preventDefault()
                                e.stopPropagation()
                              }
                            }}
                          >
                            <div className="flex items-center gap-3 w-full">
                              {/* Avatar */}
                              <div className="flex-shrink-0">
                                {(() => {
                                  const modelConfig = getModelConfig(chat.current_model);
                                  const avatarBg = isSelected ? 'bg-white/25' : 'bg-[var(--accent)]';
                                  return (
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${avatarBg}`}>
                                      {modelConfig?.provider && hasLogo(modelConfig.provider) ? (
                                        <Image 
                                          src={getProviderLogo(modelConfig.provider, modelConfig.id || undefined)}
                                          alt={`${modelConfig.provider} logo`}
                                          width={20}
                                          height={20}
                                          className="object-contain"
                                        />
                                      ) : (
                                        <div className={`w-full h-full flex items-center justify-center rounded-full`}>
                                          <span className={`text-lg font-semibold ${isSelected ? 'text-white' : 'text-gray-500'}`}>
                                            {modelConfig?.provider ? modelConfig.provider.substring(0, 1).toUpperCase() : 'A'}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                              
                              {/* Content */}
                              <div className="flex-1 min-w-0">
                                {/* Top line: Title + Date */}
                                <div className="flex justify-between items-baseline">
                                  {editingChatId === chat.id ? (
                                    <input
                                      ref={titleInputRef}
                                      type="text"
                                      value={editingTitle}
                                      onChange={(e) => setEditingTitle(e.target.value)}
                                      onBlur={handleSaveChatTitle}
                                      onKeyDown={handleChatTitleKeyDown}
                                      className={`text-sm font-semibold bg-transparent border-b-2 outline-none w-full mr-2 ${
                                        isSelected 
                                          ? 'text-white placeholder-white/70 border-white/50 focus:border-white' 
                                          : 'text-[var(--foreground)] placeholder-gray-400 border-gray-300 focus:border-[var(--foreground)]'
                                      }`}
                                      placeholder="Enter chat title..."
                                      maxLength={100}
                                    />
                                  ) : (
                                    <p 
                                      className={`text-sm font-semibold truncate pr-2 ${
                                        isSelected ? 'text-white' : 'text-[var(--foreground)]'
                                      }`}
                                      onDoubleClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleEditChatTitle(chat.id, chat.title);
                                      }}
                                      title="Double-click to edit title"
                                    >
                                      {searchTerm ? highlightSearchTerm(chat.title, searchTerm, isSelected) : chat.title}
                                    </p>
                                  )}
                                  <span className={`text-xs flex-shrink-0 ${
                                    isSelected ? 'text-white/80' : 'text-[var(--muted)]'
                                  }`}>
                                    {(() => {
                                      const date = new Date(chat.lastMessageTime || chat.created_at);
                                      const diffMs = currentTime - date.getTime();
                                      const diffMinutes = Math.floor(diffMs / (1000 * 60));
                                      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                                      const diffDays = Math.floor(diffHours / 24);
                                      if (diffMinutes < 1) return 'now';
                                      if (diffMinutes < 60) return `${diffMinutes}m`;
                                      if (diffHours < 24) return `${diffHours}h`;
                                      if (diffDays === 1) return 'Yesterday';
                                      if (diffDays < 7) return date.toLocaleDateString('en-US', { weekday: 'long' });
                                      const month = date.getMonth() + 1;
                                      const day = date.getDate();
                                      const year = date.getFullYear().toString().slice(-2);
                                      return `${month}/${day}/${year}`;
                                    })()}
                                  </span>
                                </div>
                                {/* Bottom line: Preview + Buttons */}
                                <div className="flex justify-between items-end">
                                  <p className={`text-xs truncate pr-2 ${
                                    isSelected ? 'text-white/70' : 'text-[var(--muted)]'
                                  }`}>
                                    {chat.lastMessage 
                                      ? (searchTerm ? highlightSearchTerm(chat.lastMessage, searchTerm, isSelected) : chat.lastMessage)
                                      : 'No messages yet'
                                    }
                                  </p>
                                  <div className={`flex gap-1 transition-opacity ${
                                    isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                                  }`}>
                                    <button 
                                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleEditChatTitle(chat.id, chat.title); }}
                                      className={`p-1 rounded-full transition-colors ${isSelected ? 'bg-white/20 hover:bg-white/30' : 'bg-[var(--accent)] hover:bg-[var(--subtle-divider)]'}`}
                                      title="Edit title"
                                      type="button"
                                      aria-label="Edit chat title"
                                    >
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                      </svg>
                                    </button>
                                    <button 
                                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteChat(chat.id, e); }}
                                      className={`p-1 rounded-full transition-colors ${isSelected ? 'bg-white/20 hover:bg-white/30' : 'bg-[var(--accent)] hover:bg-[var(--subtle-divider)]'}`}
                                      title="Delete chat"
                                      type="button"
                                      aria-label="Delete chat"
                                    >
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="3 6 5 6 21 6"></polyline>
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                      </svg>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </Link>
                        </div>
                      );
                    })}

                  {/* 무한 스크롤 트리거 & 로딩 인디케이터 - 검색 중이 아닐 때만 표시 */}
                  {!searchTerm && hasMore && (
                    <div 
                      ref={loadMoreTriggerRef} 
                      className="flex justify-center py-4"
                    >
                      {isLoadingMore && (
                        <div className="w-6 h-6 border-2 border-t-transparent border-[var(--foreground)] rounded-full animate-spin"></div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                !isSearching && (
                  <div className="px-4 py-3 text-sm text-[var(--muted)] text-center bg-[var(--accent)]/5 rounded-lg">
                    {searchTerm ? 'No matching conversations found' : 'No chats yet'}
                  </div>
                )
              )}
              </div>
            </div>
            );
          }, [isExpanded, displayChats, pathname, handleDeleteChat, hasMore, isLoadingMore, currentTime, editingChatId, editingTitle, handleEditChatTitle, handleSaveChatTitle, handleChatTitleKeyDown, searchTerm, isSearching])}

          {/* Shortcuts Section */}
          {useMemo(() => {
            if (!isExpandedShortcuts) return null;
            
            return (
            <div className="space-y-3 pb-4 px-2 relative">
              {editingId ? (
                // Edit/Create Form
                <div className="bg-[var(--accent)]/5 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-sm font-medium">
                      {editingId !== 'new' ? translations.editShortcut : translations.addShortcut}
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
                    placeholder={translations.shortcutNamePlaceholder}
                  />
                  <textarea
                    ref={textareaRef}
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    className="w-full min-h-[120px] p-2.5 bg-[var(--accent)] text-sm resize-none focus:outline-none rounded-lg"
                    placeholder={translations.promptContentPlaceholder}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleAddShortcut}
                      disabled={!newName.trim() || !newContent.trim()}
                      className="flex-1 py-2.5 text-xs uppercase tracking-wider bg-[var(--foreground)] text-[var(--background)] hover:opacity-90 transition-opacity disabled:opacity-50 rounded-lg font-medium"
                      type="button"
                    >
                      {editingId !== 'new' ? translations.updateButton : translations.saveShortcutButton}
                    </button>
                    <button
                      onClick={handleCancelShortcut}
                      className="w-24 py-2.5 text-xs uppercase tracking-wider bg-[var(--accent)] hover:opacity-90 transition-opacity rounded-lg font-medium"
                      type="button"
                    >
                      {translations.cancelButton}
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
                        {translations.addNewShortcutButton}
                        </span>
                        <span className="text-[10px] text-[var(--muted)] transition-colors">
                          {translations.createCustomPromptTemplates}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              )}
              
              {/* Shortcuts List with Loading State */}
              <div className="space-y-2 mt-3 pr-1">
                  {shortcuts.length > 0 ? (
                    shortcuts.map((shortcut) => (
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
                    ))
                  ) : (
                  <div className="px-4 py-3 text-sm text-[var(--muted)] text-center bg-[var(--accent)]/5 rounded-lg">
                    {translations.noShortcutsYet}
                  </div>
                )}
              </div>
            </div>
            );
          }, [isExpandedShortcuts, editingId, newName, newContent, shortcuts, handleCancelShortcut, handleAddShortcut, handleEditShortcut, handleDeleteShortcut])}
        </div>

        {/* Bottom Section */}
        <div className="mt-4 sm:mt-6 pb-5 md:pb-8 flex flex-col space-y-4 md:space-y-5 px-3 text-[var(--muted)]">
          <button
            onClick={toggleShortcuts}
            className="flex items-center group w-full text-left"
            type="button"
          >
            <div className={`min-w-[40px] h-10 rounded-lg flex items-center justify-center transition-all duration-200 ${isExpandedShortcuts ? 'bg-[var(--foreground)]/10' : 'hover:bg-[var(--foreground)]/8'}`}>
              <svg 
                width="16" 
                height="16" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="#007AFF"
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                className="transition-transform duration-200"
              >
                <circle cx="12" cy="12" r="4" />
                <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8" />
              </svg>
            </div>
            <span className={`text-sm font-medium whitespace-nowrap ${isExpandedShortcuts ? 'text-[var(--foreground)]' : 'text-[var(--muted)]'}`}>
              {translations.shortcuts}
            </span>
          </button>
          
          <Link href="/bookmarks" className="flex items-center group">
            <div className={`min-w-[40px] h-10 rounded-lg flex items-center justify-center transition-all duration-200 ${pathname === '/bookmarks' ? 'bg-[var(--foreground)]/10' : 'hover:bg-[var(--foreground)]/8'}`}>
              <svg 
                width="16" 
                height="16" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="#007AFF" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                className="transition-transform duration-200"
              >
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
              </svg>
            </div>
            <span className={`text-sm font-medium whitespace-nowrap ${pathname === '/bookmarks' ? 'text-[var(--foreground)]' : 'text-[var(--muted)]'}`}>
              {translations.bookmarks}
            </span>
          </Link>
          

          <button
            onClick={() => {
              setIsAccountOpen(true);
            }}
            className="flex items-center group w-full text-left mt-2"
            type="button"
          >
            <div className="min-w-[40px] h-10 rounded-lg flex items-center justify-center hover:bg-[var(--foreground)]/8 transition-all duration-200">
              <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-[var(--accent)] group-hover:border-[#007AFF] transition-colors">
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
            <span className="ml-3 text-sm font-medium whitespace-nowrap text-[var(--muted)]">
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
          }}
          user={user}
          profileImage={profileImage}
          handleDeleteAllChats={handleDeleteAllChats}
        />
      </div>
    </div>
  )
} 