'use client'

import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { Chat } from '@/lib/types'
import { AccountDialog, fetchUserName } from './AccountDialog'
import { deleteChat } from '@/app/chat/[id]/utils'
import Link from 'next/link'
import Image from 'next/image'

import { getModelById } from '@/lib/models/config'
import { getProviderLogo, hasLogo } from '@/lib/models/logoUtils'
import { getSidebarTranslations } from '../lib/sidebarTranslations'
import { clearAllSubscriptionCache } from '@/lib/utils'
import { useSidebar } from '@/app/lib/SidebarContext'
import { Settings, LifeBuoy, Zap, LogOut, CreditCard } from 'lucide-react'
import { SquarePencil } from 'react-ios-icons'
import { ProblemReportDialog } from './ProblemReportDialog'

interface SidebarProps {
  user: any;  // You might want to define a proper User type
  toggleSidebar?: () => void;
}



export function Sidebar({ user, toggleSidebar }: SidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [chats, setChats] = useState<Chat[]>([])
  const supabase = createClient()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const { isAccountOpen, setIsAccountOpen } = useSidebar()
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false)
  const [isProblemReportOpen, setIsProblemReportOpen] = useState(false)
  const [profileImage, setProfileImage] = useState<string | null>(null)
  const [userName, setUserName] = useState('You')
  const [isExpanded, setIsExpanded] = useState(true) // Always expanded - no toggle needed
  const [translations, setTranslations] = useState({
    home: 'Home',
    chatHistory: 'Chat History',
    bookmarks: 'Bookmarks',
    searchConversations: 'Search conversations...',
    settings: 'Settings',
    reportIssue: 'Report Issue',
    subscription: 'Subscription',
    logOut: 'Log Out'
  });

  // State for infinite scroll
  const [currentPage, setCurrentPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [initialLoadComplete, setInitialLoadComplete] = useState(false)
  const CHATS_PER_PAGE = 15
  const observerRef = useRef<IntersectionObserver | null>(null)
  const loadMoreTriggerRef = useRef<HTMLDivElement | null>(null)


  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const accountButtonRef = useRef<HTMLButtonElement>(null)
  const accountMenuRef = useRef<HTMLDivElement>(null)

  // State for chat title editing
  const [editingChatId, setEditingChatId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const titleInputRef = useRef<HTMLInputElement>(null)

  // State for chat search
  const [searchTerm, setSearchTerm] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [searchResults, setSearchResults] = useState<Chat[]>([])
  const [isSearching, setIsSearching] = useState(false)

  // 🚀 OPTIMIZATION: Search caching for better performance
  const [searchCache, setSearchCache] = useState<Map<string, Chat[]>>(new Map())

  // State for optimization
  const [lastLoadedUserId, setLastLoadedUserId] = useState<string | null>(null)
  const [isChatsLoaded, setIsChatsLoaded] = useState(false)
  const lastLoadTimeRef = useRef<number>(0)
  const CACHE_DURATION = 10 * 60 * 1000 // 10 minute cache for performance improvement

  // State for real-time updates
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
        // 커스텀 도메인 사용 시 Storage URL을 수동으로 수정
        let finalUrl = urlInfo.publicUrl;
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        
        if (supabaseUrl && supabaseUrl !== 'https://jgkrhazygwcvbzkwkhnj.supabase.co') {
          // 기본 Supabase 도메인을 커스텀 도메인으로 교체
          finalUrl = urlInfo.publicUrl.replace(
            'https://jgkrhazygwcvbzkwkhnj.supabase.co',
            supabaseUrl
          );
          console.log('Storage URL updated for custom domain:', finalUrl);
        }
        
        setProfileImage(finalUrl);
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
  }, [user, supabase]); // ✅ P1 FIX: fetchProfileImage 의존성 제거로 안정성 증대

  // Listen for user name updates from other components
  useEffect(() => {
    const handleUserNameUpdate = (event: CustomEvent) => {
      const { newName } = event.detail;
      setUserName(newName);
    };

    window.addEventListener('userNameUpdated', handleUserNameUpdate as EventListener);
    
    return () => {
      window.removeEventListener('userNameUpdated', handleUserNameUpdate as EventListener);
    };
  }, []);





  // Real-time update
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now())
    }, 60000) // Update every minute

    return () => clearInterval(interval)
  }, [])

  // 🚀 익명 사용자 지원: 익명 사용자는 채팅 히스토리 로드하지 않음
  const isAnonymousUser = user?.isAnonymous || user?.id === 'anonymous';

  // Load chats when user changes or component mounts
  useEffect(() => {
    if (!user?.id || isAnonymousUser) {
      setChats([]);
      setInitialLoadComplete(true);
      return;
    }

    // Skip if already loaded for this user
    if (lastLoadedUserId === user.id && isChatsLoaded) {
      return;
    }

    loadChats(1, false, false);
  }, [user?.id, isAnonymousUser]);

  // Real-time updates for chat sessions
  useEffect(() => {
    if (!user?.id || isAnonymousUser) return;

    const channel = supabase
      .channel('chat_sessions_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_sessions'
        },
        (payload) => {
          console.log('🔄 [Sidebar] Real-time update received:', payload);
          
          // Refresh chats when there are changes
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE' || payload.eventType === 'DELETE') {
            loadChats(1, false, true);
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id, isAnonymousUser])

  // Add custom event listener for immediate chat updates
  useEffect(() => {
    // Skip all sidebar realtime features for anonymous or unauthenticated users
    if (!user?.id || isAnonymousUser) {
      return;
    }
    // 🚀 제목 생성 함수 추가
    const handleNewChat = (event: CustomEvent) => {
      const chatData = event.detail;
      console.log('🚀 [Sidebar] New chat event received:', chatData);
      
      // 🚀 데이터 유효성 검사
      if (!chatData?.id) {
        console.log('🚀 [Sidebar] Invalid chat data, skipping');
        return;
      }
      
      // Prevent duplicates: check if the chat already exists
      setChats(prevChats => {
        const existingChat = prevChats.find(chat => chat.id === chatData.id);
        if (existingChat) {
          console.log('🚀 [Sidebar] Chat already exists, skipping duplicate:', chatData.id);
          return prevChats;
        }
        
        // 🚀 즉시 임시 제목 생성 (사용자 메시지 첫 부분)
        let title = chatData.title;
        if (!title && chatData.initial_message) {
          const message = chatData.initial_message.trim();
          title = message.length > 30 ? message.slice(0, 30) + '...' : message;
        }
        
        // Create new chat with immediate title
        const newChat: Chat = {
          id: chatData.id,
          title: title || 'New Chat',
          created_at: chatData.created_at,
          messages: [],
          lastMessageTime: new Date(chatData.created_at).getTime(),
          lastMessage: chatData.initial_message || '',
          current_model: chatData.current_model
        };
        
        // Add new chat to the top and sort by time
        const updatedChats = [newChat, ...prevChats].sort((a, b) => {
          const timeA = a.lastMessageTime ?? 0;
          const timeB = b.lastMessageTime ?? 0;
          return timeB - timeA;
        });
        
        console.log('🚀 [Sidebar] Chat added with immediate title:', title);
        return updatedChats;
      });

      // 🚀 즉시 실시간 제목 생성 (사이드바 독립 처리)
      if (chatData.initial_message?.trim() && chatData.current_model) {
        // 임시 제목 계산
        const tempTitle = chatData.title || (chatData.initial_message.trim().length > 30 
          ? chatData.initial_message.trim().slice(0, 30) + '...' 
          : chatData.initial_message.trim());
        
        // 즉시 제목 생성 시작 (비동기, UI 차단하지 않음)
        generateRealtimeTitle(chatData.id, chatData.initial_message, chatData.current_model, tempTitle);
      }
    };

    // 🚀 실시간 제목 생성 함수 (사이드바 독립 처리)
    const generateRealtimeTitle = async (chatId: string, message: string, model: string, tempTitle: string) => {
      try {
        console.log('🚀 [Sidebar] Starting realtime title generation for chat:', chatId);
        
        // 유효성 검사
        if (!chatId || !message?.trim() || !model) {
          console.log('🚀 [Sidebar] Invalid parameters for title generation');
          return;
        }
        
        // 익명 사용자는 제목 업데이트 건너뛰기
        if (!user?.id || isAnonymousUser) {
          console.log('🚀 [Sidebar] Anonymous user, skipping title update');
          return;
        }
        
        // 즉시 제목 생성 API 호출
        const titleResponse = await fetch('/api/chat/summarize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chatId,
            message: message.trim(),
            model
          })
        });
        
        if (titleResponse.ok) {
          const titleData = await titleResponse.json();
          console.log('🚀 [Sidebar] Realtime title generated:', titleData);
          
          if (titleData.summary && titleData.summary !== tempTitle) {
            // DB 업데이트 - user_id 조건 추가
            const { error: updateError } = await supabase
              .from('chat_sessions')
              .update({ title: titleData.summary })
              .eq('id', chatId)
              .eq('user_id', user?.id);
            
            if (!updateError) {
              // 즉시 UI 업데이트
              window.dispatchEvent(new CustomEvent('chatTitleUpdated', {
                detail: { id: chatId, title: titleData.summary }
              }));
              console.log('✅ [Sidebar] Realtime title updated:', tempTitle, '→', titleData.summary);
            } else {
              console.error('💥 [Sidebar] Failed to update title in DB:', {
                error: updateError,
                chatId,
                userId: user?.id,
                title: titleData.summary
              });
            }
          } else {
            console.log('🔧 [Sidebar] Generated title same as temp title, no update needed');
          }
        } else {
          const errorText = await titleResponse.text();
          console.error('💥 [Sidebar] Title generation API failed:', {
            status: titleResponse.status,
            statusText: titleResponse.statusText,
            error: errorText,
            chatId,
            message: message.substring(0, 100) + '...'
          });
        }
      } catch (error) {
        console.error('💥 [Sidebar] Realtime title generation failed:', error);
      }
    };

    const handleChatTitleUpdated = (event: CustomEvent) => {
      const { id, title } = event.detail;
      console.log('🚀 [Sidebar] Chat title update event received:', { id, title });
      
      // 🚀 데이터 유효성 검사
      if (!id || !title?.trim()) {
        console.log('🚀 [Sidebar] Invalid title update data, skipping');
        return;
      }
      
      // Update the chat title in the chats array
      setChats(prevChats => {
        const updatedChats = prevChats.map(chat => 
          chat.id === id ? { ...chat, title: title.trim() } : chat
        );
        
        const wasUpdated = updatedChats.some((chat, index) => 
          chat.id === id && chat.title !== prevChats[index]?.title
        );
        
        if (wasUpdated) {
          console.log('🚀 [Sidebar] Chat title updated successfully:', id, '→', title.trim());
        } else {
          console.log('🚀 [Sidebar] Chat not found for title update:', id);
        }
        
        return updatedChats;
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
  }, [user?.id, isAnonymousUser]);

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

  useEffect(() => {
    function handleClickOutsideAccountMenu(event: MouseEvent) {
      if (
        accountMenuRef.current &&
        !accountMenuRef.current.contains(event.target as Node) &&
        accountButtonRef.current &&
        !accountButtonRef.current.contains(event.target as Node)
      ) {
        setIsAccountMenuOpen(false);
      }
    }
    if (isAccountMenuOpen) {
      document.addEventListener('mousedown', handleClickOutsideAccountMenu);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutsideAccountMenu);
    };
  }, [isAccountMenuOpen]);



  const loadChats = useCallback(async (page = 1, append = false, forceRefresh = false) => {
    // 🚀 익명 사용자 지원: 익명 사용자는 채팅 히스토리 로드하지 않음
    if (!user || isAnonymousUser) return;
    
    // Optimization: skip if cached data exists and it's not a forced refresh
    const now = Date.now();
    const isCacheValid = now - lastLoadTimeRef.current < CACHE_DURATION;
    
    if (!forceRefresh && page === 1 && !append && lastLoadedUserId === user.id && isCacheValid) {
      console.log('[Sidebar] Using cached chat data');
      return;
    }
    
    try {
      // Show loading state when loading more
      if (append) {
        setIsLoadingMore(true)
      }

      // Apply pagination
      const from = (page - 1) * CHATS_PER_PAGE
      const to = from + CHATS_PER_PAGE - 1

      // 🚀 Efficiently fetch all necessary data with a single query
      // Fetch only basic info from chat_sessions (no updated_at)
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

      // Check if there are more chats to load
      if (sessions.length < CHATS_PER_PAGE) {
        setHasMore(false)
      }

      // Efficiently fetch the first user messages
      const sessionIds = sessions.map(s => s.id);
      let firstMessages: Record<string, string> = {};
      
      if (sessionIds.length > 0) {
        // Fetch the first user message for all sessions at once
        const { data: messagesData } = await supabase
          .from('messages')
          .select('chat_session_id, content')
          .in('chat_session_id', sessionIds)
          .eq('role', 'user')
          .order('created_at', { ascending: true });
        
        // Map the first message for each session
        if (messagesData) {
          const firstMsgMap: Record<string, string> = {};
          messagesData.forEach(msg => {
            if (!firstMsgMap[msg.chat_session_id]) {
              firstMsgMap[msg.chat_session_id] = msg.content;
            }
          });
          firstMessages = firstMsgMap;
        }
      }

      const newChats = sessions.map((session) => {
        // Use title if it exists, otherwise use default title
        const title = session.title && session.title.trim().length > 0
          ? session.title
          : 'New Chat'
        
        // Use created_at as the last message time
        const lastMessageTime = new Date(session.created_at).getTime()

        // First message content (limited to 100 characters)
        const firstMessage = firstMessages[session.id] || '';
        const truncatedFirstMessage = firstMessage.length > 100 
          ? firstMessage.substring(0, 100) + '...' 
          : firstMessage;

        return {
          id: session.id,
          title: title,
          created_at: session.created_at,
          messages: [], // Keep as an empty array
          lastMessageTime: lastMessageTime,
          lastMessage: truncatedFirstMessage, // Set as the first message
          current_model: session.current_model
        } as Chat
      })

      // Already sorted by updated_at, so no additional sorting needed
      const filteredChats = newChats.filter(chat => chat.title && chat.title.trim() !== '')
      
      if (append) {
        setChats(prevChats => [...prevChats, ...filteredChats])
      } else {
        setChats(filteredChats)
      }
      
      // Mark initial load as complete
      if (page === 1) {
        setInitialLoadComplete(true)
        setIsChatsLoaded(true)
        setLastLoadedUserId(user.id)
        lastLoadTimeRef.current = Date.now()
        

      }
      
      // Set next page
      if (append) {
        setCurrentPage(page)
      }
      
      setIsLoadingMore(false)
    } catch (error) {
      console.error('Error in loadChats:', error)
      setIsLoadingMore(false)
    }
  }, [user, lastLoadedUserId, isAnonymousUser])

  // Effect to load chats when needed - prevent duplicate loading
  const isChatsLoadedRef = useRef(false)
  const loadingRef = useRef(false)
  isChatsLoadedRef.current = isChatsLoaded

  useEffect(() => {
    if (user && !isChatsLoadedRef.current && !loadingRef.current) {
      loadingRef.current = true
      loadChats(1, false, true).finally(() => {
        loadingRef.current = false
      });
    }
  }, [user]); // Minimize dependencies to just user

  // Set up IntersectionObserver - minimize dependencies using loadChats ref
  const loadChatsRef = useRef(loadChats)
  loadChatsRef.current = loadChats

      useEffect(() => {
      // Set up scroll observer (for infinite scroll) - activate only when not searching
      if (initialLoadComplete && hasMore && !searchTerm) {
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && !isLoadingMore && hasMore) {
            loadChatsRef.current(currentPage + 1, true)
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
    }, [initialLoadComplete, currentPage, isLoadingMore, hasMore, searchTerm])

  const handleDeleteChat = useCallback(async (chatId: string, e: React.MouseEvent) => {
    // 🚀 익명 사용자 지원: 익명 사용자는 채팅 삭제 불가
    if (isAnonymousUser) return;
    
    e.stopPropagation()
    
    try {
      await deleteChat(chatId);

      if (pathname === `/chat/${chatId}`) {
        router.push('/')
      }

      // Remove directly from local state after deleting chat (DB is already handled in deleteChat)
      setChats(prevChats => prevChats.filter(chat => chat.id !== chatId))
    } catch (error) {
      console.error('Failed to delete chat:', error)
      alert('Failed to delete chat.')
    }
  }, [pathname, router, isAnonymousUser])

  const handleDeleteAllChats = useCallback(async () => {
    // 🚀 익명 사용자 지원: 익명 사용자는 채팅 삭제 불가
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
      // Reset local state after deleting chats
      setChats([])
    } catch (error) {
      console.error('Failed to delete all chats:', error)
      alert('Failed to delete chats.')
    }
  }, [user, supabase, router, isAnonymousUser]) // Removed loadChats dependency



  // Functions related to chat title editing
  const handleEditChatTitle = useCallback((chatId: string, currentTitle: string) => {
    // 🚀 익명 사용자 지원: 익명 사용자는 채팅 제목 편집 불가
    if (isAnonymousUser) return;
    
    setEditingChatId(chatId)
    setEditingTitle(currentTitle)
    // Focus on input after the next render
    setTimeout(() => {
      if (titleInputRef.current) {
        titleInputRef.current.focus()
        titleInputRef.current.select()
      }
    }, 0)
  }, [isAnonymousUser])

  const handleSaveChatTitle = useCallback(async () => {
    // 🚀 익명 사용자 지원: 익명 사용자는 채팅 제목 저장 불가
    if (isAnonymousUser) return;
    
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

      // Update local state
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
  }, [editingChatId, editingTitle, user, supabase, isAnonymousUser])

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



  // Search chats in the database
  const searchChats = useCallback(async (term: string) => {
    if (!user || !term.trim()) {
      setIsSearching(false);
      return;
    }
    
    const search = term.toLowerCase();
    
    // 🚀 OPTIMIZATION: Check cache first
    if (searchCache.has(search)) {
      setSearchResults(searchCache.get(search) || []);
      setIsSearching(false);
      return;
    }
    
    setIsSearching(true);
    try {
      // 🚀 OPTIMIZATION: Use separate queries for better compatibility
      // First, search by title
      const { data: titleResults, error: titleError } = await supabase
        .from('chat_sessions')
        .select('id, created_at, title, current_model')
        .eq('user_id', user.id)
        .ilike('title', `%${search}%`)
        .order('created_at', { ascending: false })
        .limit(20);

      if (titleError) {
        console.error('Title search error:', titleError);
        setSearchResults([]);
        return;
      }

      // Then, search by message content
      const { data: messageResults, error: messageError } = await supabase
        .from('messages')
        .select('chat_session_id, content, created_at, role, model')
        .eq('user_id', user.id)
        .ilike('content', `%${search}%`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (messageError) {
        console.error('Message search error:', messageError);
        setSearchResults([]);
        return;
      }

      // Get unique session IDs from message search
      const messageSessionIds = messageResults 
        ? [...new Set(messageResults.map(msg => msg.chat_session_id))]
        : [];

      // Fetch session details for message search results
      const { data: messageSessionResults, error: sessionError } = messageSessionIds.length > 0 
        ? await supabase
            .from('chat_sessions')
            .select('id, created_at, title, current_model')
            .eq('user_id', user.id)
            .in('id', messageSessionIds)
        : { data: [], error: null };

      if (sessionError) {
        console.error('Session fetch error:', sessionError);
        setSearchResults([]);
        return;
      }

      // Merge and deduplicate results
      const allSessions = [...(titleResults || []), ...(messageSessionResults || [])];
      const uniqueSessions = allSessions.filter((session, index, self) => 
        index === self.findIndex(s => s.id === session.id)
      );

      // Process results efficiently
      const processedChats = uniqueSessions.map((session) => {
        // Find messages for this session
        const sessionMessages = messageResults?.filter(msg => msg.chat_session_id === session.id) || [];
        
        const firstUserMsg = sessionMessages
          .filter(msg => msg.role === 'user')
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0];
        
        const latestMsg = sessionMessages
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

        // Determine title
        const title = session.title && session.title.trim().length > 0
          ? session.title
          : (firstUserMsg
              ? (firstUserMsg.content.length > 40 
                  ? firstUserMsg.content.substring(0, 40) + '...' 
                  : firstUserMsg.content)
              : 'Untitled Chat');
        
        // Determine last message and time
        const lastMessage = latestMsg ? latestMsg.content : '';
        const lastMessageTime = latestMsg 
          ? new Date(latestMsg.created_at).getTime()
          : new Date(session.created_at).getTime();

        // Determine current model
        const currentModel = session.current_model || (latestMsg ? latestMsg.model : null);

        return {
          id: session.id,
          title: title,
          created_at: session.created_at,
          messages: [],
          lastMessageTime: lastMessageTime,
          lastMessage: lastMessage,
          current_model: currentModel
        } as Chat;
      });

      // Sort efficiently
      processedChats.sort((a, b) => {
        const timeA = a.lastMessageTime ?? 0;
        const timeB = b.lastMessageTime ?? 0;
        return timeB - timeA;
      });

      // Cache the results
      setSearchCache(prev => new Map(prev).set(search, processedChats));
      setSearchResults(processedChats);
    } catch (error) {
      console.error('Error searching chats:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [user?.id, searchCache]);

  // Clear search function
  const clearSearch = useCallback(() => {
    setSearchTerm('');
    setSearchResults([]);
    setIsSearching(false);
    
    // 🚀 OPTIMIZATION: Limit cache size to prevent memory issues
    setSearchCache(prev => {
      const newCache = new Map(prev);
      if (newCache.size > 50) { // Keep only last 50 searches
        const entries = Array.from(newCache.entries());
        const recentEntries = entries.slice(-50);
        return new Map(recentEntries);
      }
      return newCache;
    });
  }, []);

  // Execute search on term change (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchTerm.trim()) {
        searchChats(searchTerm);
      } else {
        setSearchResults([]);
        setIsSearching(false);
      }
    }, 150); // 🚀 OPTIMIZATION: Reduced from 300ms to 150ms for faster response

    return () => clearTimeout(timeoutId);
  }, [searchTerm]); // Removed searchChats dependency to prevent unnecessary re-executions

  // Determine the list of chats to display
  const displayChats = useMemo(() => {
    return searchTerm.trim() ? searchResults : chats;
  }, [searchTerm, searchResults, chats]);

  // 🚀 FEATURE: Auto-select first search result
  const [hasAutoSelected, setHasAutoSelected] = useState(false);
  
  useEffect(() => {
    if (searchTerm.trim() && searchResults.length > 0 && !isSearching && !hasAutoSelected) {
      const firstResult = searchResults[0];
      // Only navigate if we're not already on this chat
      if (pathname !== `/chat/${firstResult.id}`) {
        // 🚀 FEATURE: Add search term to URL for highlighting in chat
        const searchParams = new URLSearchParams();
        searchParams.set('search', searchTerm);
        router.push(`/chat/${firstResult.id}?${searchParams.toString()}`);
        setHasAutoSelected(true); // Mark as auto-selected
      }
    }
  }, [searchResults, searchTerm, isSearching, pathname, router, hasAutoSelected]);

  // Reset auto-selection when search term changes
  useEffect(() => {
    setHasAutoSelected(false);
  }, [searchTerm]);

  // Search term highlighting function
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







  // Keyboard shortcut for search (Ctrl/Cmd + K)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
              if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
          event.preventDefault();
          if (searchInputRef.current) {
            searchInputRef.current.focus();
          }
        }
    };

          document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }, []);

  // Clear search state on page change (only if not on a chat page)
  useEffect(() => {
    // Clear search state only when navigating to a page other than a chat page
    if (!pathname.startsWith('/chat/') && pathname !== '/') {
      clearSearch();
    }
  }, [pathname, clearSearch]);

  // Clear search state on component unmount
  useEffect(() => {
    return () => {
      clearSearch();
    };
  }, [clearSearch]);

  const handleSignOut = async () => {
    try {
      clearAllSubscriptionCache();
      
      await supabase.auth.signOut();
      router.push('/login');
    } catch (error) {
      console.error('Error signing out:', error);
      alert('Failed to sign out. Please try again.');
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="w-80 h-full bg-[var(--sidebar-light)] dark:bg-[var(--sidebar-dark)] flex flex-col items-center overflow-hidden relative ">
      <div className="h-full flex flex-col w-full">
        {/* Top Section with Home, Bookmarks and History icons */}
        <div className="pt-4 px-[14px] sm:px-[14px] flex flex-col space-y-0">
          {/* Empty space for hamburger icon (maintained for UI consistency) */}
          <div className="min-w-[40px] h-6 sm:h-10 ounded-lg flex items-center justify-start">
            <div className="w-4 h-4"></div>
          </div>
          

          

        </div>

        {/* Main Content Area */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto sidebar-scroll w-full mt-3 md:mt-0 px-4 md:px-3">
          {/* Chat History Section */}
          {useMemo(() => {
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
                    className={`w-full pl-10 pr-4 py-2.5 bg-transparent text-sm rounded-lg placeholder-[var(--muted)] focus:outline-none focus:bg-transparent border-0 outline-none ring-0 focus:ring-0 focus:border-0 shadow-none focus:shadow-none transition-all ${
                      isAnonymousUser ? 'opacity-60 cursor-not-allowed' : ''
                    }`}
                    style={{ 
                      outline: 'none',
                      border: 'none',
                      boxShadow: 'none',
                      WebkitAppearance: 'none'
                    }}
                    disabled={isAnonymousUser}
                  />
                  {isAnonymousUser && (
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--muted)] opacity-40">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                        <circle cx="12" cy="16" r="1"></circle>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                      </svg>
                    </div>
                  )}
                  {searchTerm && !isAnonymousUser && (
                    <button
                      onClick={clearSearch}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-[var(--muted)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
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
              {/* 🚀 익명 사용자 지원: 익명 사용자는 채팅 히스토리 대신 로그인 안내 표시 */}
              {isAnonymousUser ? (
                <div className="px-4 py-6">
                  {/* 미리보기 채팅 히스토리 */}
                  <div className="space-y-2 mb-6">
                    {/* 미리보기 채팅 아이템들 */}
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="group relative block transition-all p-3 rounded-lg opacity-60 hover:opacity-80">
                        <div className="flex items-center gap-3 w-full">
                          {/* Avatar */}
                          <div className="flex-shrink-0">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[var(--accent)]/20">
                              {i === 1 ? (
                                <Image 
                                  src="/logo/openai.svg"
                                  alt="OpenAI logo"
                                  width={20}
                                  height={20}
                                  className="object-contain text-[var(--muted)]"
                                />
                              ) : i === 2 ? (
                                <Image 
                                  src="/logo/grok.svg"
                                  alt="Grok logo"
                                  width={20}
                                  height={20}
                                  className="object-contain text-[var(--muted)]"
                                />
                              ) : (
                                <Image 
                                  src="/logo/anthropic.svg"
                                  alt="Anthropic logo"
                                  width={20}
                                  height={20}
                                  className="object-contain text-[var(--muted)]"
                                />
                              )}
                            </div>
                          </div>
                          
                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            {/* Top line: Title + Date */}
                            <div className="flex justify-between items-baseline gap-1">
                              <p className="text-sm font-semibold truncate text-[var(--muted)]" style={{ maxWidth: 'calc(100% - 0px)' }}>
                                {i === 1 ? 'Where do socks go after laundry?' : i === 2 ? 'How do I find Nemo?' : 'Why is my WiFi so slow?'}
                              </p>
                              <span className="text-xs flex-shrink-0 text-[var(--muted)]/60">
                                {i === 1 ? '2h' : i === 2 ? '1d' : '3d'}
                              </span>
                            </div>
                            {/* Bottom line: Preview */}
                            <p className="text-xs truncate pr-2 text-[var(--muted)]/60 mt-1">
                              {i === 1 ? 'Lost 7 socks this week. Is there a portal in my washer?' : i === 2 ? 'I\'ve been looking for Nemo for 3 hours, where is he?' : 'My internet is slower than a snail, help me!'}
                            </p>
                          </div>
                          
                          {/* Lock icon */}
                          <div className="opacity-40">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--muted)]">
                              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                              <circle cx="12" cy="16" r="1"></circle>
                              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                            </svg>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* 로그인 CTA */}
                  <div className="bg-gradient-to-r from-[var(--accent)]/10 to-[var(--accent)]/5 rounded-xl p-4 border border-[var(--accent)]/20">
                    <div className="text-center">
                      <div className="w-8 h-8 mx-auto mb-3 rounded-full bg-[var(--accent)]/20 flex items-center justify-center">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--accent)]">
                          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
                          <polyline points="10,17 15,12 10,7"></polyline>
                          <line x1="15" y1="12" x2="3" y2="12"></line>
                        </svg>
                      </div>
                      <div className="text-sm font-medium text-[var(--foreground)] mb-1">
                        Unlock Your Chat History
                      </div>
                      <div className="text-xs text-[var(--muted)] mb-4">
                        Sign in to save and access your conversations
                      </div>
                      <Link 
                        href="/login" 
                        className="inline-flex items-center justify-center w-full px-4 py-2.5 bg-[#007AFF] text-white rounded-lg text-sm font-medium hover:bg-[#0056CC] transition-all duration-200 hover:shadow-lg"
                      >
                        Sign In
                      </Link>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Show search loading state */}
                  {isSearching && (
                    <div className="flex flex-col items-center py-4 space-y-2">
                      <div className="w-6 h-6 border-2 border-t-transparent border-[var(--foreground)] rounded-full animate-spin"></div>
                      <span className="text-xs text-[var(--muted)]">Searching all conversations...</span>
                    </div>
                  )}
                  
                  {/* Show number of search results */}
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
                            <div key={`${chat.id}-${index}`} className="last:border-b-0">
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
                                  } else {
                                    // 🚀 FEATURE: Reset auto-selection when user manually clicks
                                    setHasAutoSelected(true);
                                    
                                    // 🚀 FEATURE: Add search term to URL for highlighting in chat
                                    if (searchTerm.trim()) {
                                      e.preventDefault();
                                      const searchParams = new URLSearchParams();
                                      searchParams.set('search', searchTerm);
                                      router.push(`/chat/${chat.id}?${searchParams.toString()}`);
                                    }
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
                                        {searchTerm && chat.lastMessage 
                                          ? highlightSearchTerm(chat.lastMessage, searchTerm, isSelected)
                                          : chat.lastMessage || 'No messages yet'}
                                      </p>
                                      
                                      {/* Action buttons - only show on hover or when selected */}
                                      <div className={`flex items-center gap-1 transition-opacity ${
                                        isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                                      }`}>
                                        <button 
                                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleEditChatTitle(chat.id, chat.title); }}
                                          className={`p-1 rounded-full transition-colors ${isSelected ? 'bg-white/20 hover:bg-white/30' : 'bg-[var(--accent)] hover:bg-[var(--subtle-divider)]'}`}
                                          title="Edit title"
                                          type="button"
                                          aria-label="Edit title"
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

                      {/* Infinite scroll trigger & loading indicator - show only when not searching */}
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
                </>
              )}
              </div>
            </div>
            );
          }, [displayChats, pathname, handleDeleteChat, hasMore, isLoadingMore, currentTime, editingChatId, editingTitle, handleEditChatTitle, handleSaveChatTitle, handleChatTitleKeyDown, searchTerm, isSearching])}


        </div>

        {/* Bottom Section */}
        <div className="mt-3 sm:mt-6 pb-5 md:pb-8 flex flex-col space-y-0 px-3 text-[var(--muted)]">

          {/* 🚀 익명 사용자 지원: 익명 사용자는 하단 기능들 대신 미리보기 표시 */}
          {isAnonymousUser ? (
            <div className="space-y-2">
              {/* 미리보기 북마크 */}
              <div className="flex items-center group w-full text-left opacity-60">
                <div className="min-w-[40px] h-10 rounded-lg flex items-center justify-center">
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
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                  </svg>
                </div>
                <span className="ml-3 text-sm font-medium whitespace-nowrap text-[var(--muted)]">
                  Bookmarks
                </span>
                <div className="ml-auto opacity-40">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--muted)]">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <circle cx="12" cy="16" r="1"></circle>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                </div>
              </div>

              {/* 미리보기 사용자 프로필 */}
              <div className="flex items-center group w-full text-left opacity-60">
                <div className="min-w-[40px] h-10 rounded-lg flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-[var(--accent)]/30 bg-[var(--accent)]/10 flex items-center justify-center">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--muted)]">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                      <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                  </div>
                </div>
                <span className="ml-3 text-sm font-medium whitespace-nowrap text-[var(--muted)]">
                  Your Profile
                </span>
                <div className="ml-auto opacity-40">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--muted)]">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <circle cx="12" cy="16" r="1"></circle>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                </div>
              </div>
            </div>
          ) : (
            <>
              <Link href="/bookmarks" className="flex items-center group w-full text-left">
                <div className="min-w-[40px] h-10 rounded-lg flex items-center justify-center">
                  <svg 
                    width="16" 
                    height="16" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="#007AFF" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  >
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                  </svg>
                </div>
                <span className="ml-3 text-sm font-medium whitespace-nowrap text-[var(--muted)]">
                  {translations.bookmarks}
                </span>
              </Link>

              <button
                ref={accountButtonRef}
                onClick={() => {
                  setIsAccountMenuOpen(prev => !prev);
                }}
                className="flex items-center group w-full text-left mt-2 cursor-pointer"
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
            </>
          )}
        </div>

        {/* Account Popover Menu */}
        {isAccountMenuOpen && (
          <div
            ref={accountMenuRef}
            className="absolute w-72 bg-background rounded-xl shadow-2xl p-2 z-50 border border-accent"
            style={{
              bottom: '80px',
              left: '1rem'
            }}
          >
            <div className="p-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-[var(--accent)]">
                  {profileImage ? (
                    <Image
                      src={profileImage}
                      alt={userName}
                      width={40}
                      height={40}
                      className="object-cover w-full h-full"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-[var(--foreground)] text-[var(--background)]">
                      {userName.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div>
                  <div className="font-semibold text-sm text-[var(--foreground)]">{userName}</div>
                  <div className="text-xs text-[var(--muted)]">{user.email}</div>
                </div>
              </div>
            </div>
            <div className="my-2 h-[1px] bg-[var(--accent)]" />
            <div className="flex flex-col text-[var(--foreground)]">
              <button onClick={() => { setIsAccountOpen(true); setIsAccountMenuOpen(false); }} className="flex items-center gap-3 text-left p-2 hover:bg-[var(--accent)] rounded-md text-sm cursor-pointer">
                <Settings size={16} /> {translations.settings}
              </button>
              <button onClick={() => { setIsProblemReportOpen(true); setIsAccountMenuOpen(false); }} className="flex items-center gap-3 text-left p-2 hover:bg-[var(--accent)] rounded-md text-sm cursor-pointer">
                <LifeBuoy size={16} /> {translations.reportIssue}
              </button>
              <Link href="/pricing" className="flex items-center gap-3 text-left p-2 hover:bg-[var(--accent)] rounded-md text-sm">
                <CreditCard size={16} /> {translations.subscription}
              </Link>
            </div>
            <div className="my-2 h-[1px] bg-[var(--accent)]" />
            <button onClick={handleSignOut} className="flex items-center gap-3 w-full text-left p-2 hover:bg-[var(--accent)] rounded-md text-sm text-[var(--foreground)] cursor-pointer">
              <LogOut size={16} /> {translations.logOut}
            </button>
          </div>
        )}

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
      <ProblemReportDialog
        isOpen={isProblemReportOpen}
        onClose={() => setIsProblemReportOpen(false)}
        user={user}
      />
    </div>
  )
} 
