'use client'

import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { Chat } from '@/lib/types'
import { deleteChat } from '@/app/chat/[id]/utils'
import Link from 'next/link'
import Image from 'next/image'

import { getModelById } from '@/lib/models/config'
import { getProviderLogo, hasLogo } from '@/lib/models/logoUtils'
import { getSidebarTranslations } from '../lib/sidebarTranslations'
import { useSidebar } from '@/app/lib/SidebarContext'
import { LifeBuoy, Trash2, Edit } from 'lucide-react'
import { SquarePencil } from 'react-ios-icons'
import { ProblemReportDialog } from './ProblemReportDialog'
import { SubscriptionDialog } from './SubscriptionDialog'
import { highlightSearchTerm } from '@/app/utils/searchHighlight'

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
  const { isMobile, isSelectionMode, setIsSelectionMode } = useSidebar()
  const [selectedChatIds, setSelectedChatIds] = useState<string[]>([])
  const [isProblemReportOpen, setIsProblemReportOpen] = useState(false)
  const [isSubscriptionOpen, setIsSubscriptionOpen] = useState(false)
  const [isExpanded, setIsExpanded] = useState(true) // Always expanded - no toggle needed
  const [translations, setTranslations] = useState({
    home: 'Home',
    chatHistory: 'Chat History',
    bookmarks: 'Bookmarks',
    searchConversations: 'Search conversations...',
    settings: 'Settings',
    reportIssue: 'Report Issue',
    subscription: 'Subscription',
    logOut: 'Log Out',
    messages: 'Messages'
  });

  useEffect(() => {
    if (!isSelectionMode) {
      setSelectedChatIds([])
    }
  }, [isSelectionMode])

  // State for infinite scroll
  const [currentPage, setCurrentPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [initialLoadComplete, setInitialLoadComplete] = useState(false)
  const CHATS_PER_PAGE = 15
  const observerRef = useRef<IntersectionObserver | null>(null)
  const loadMoreTriggerRef = useRef<HTMLDivElement | null>(null)


  const scrollContainerRef = useRef<HTMLDivElement>(null)

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




  const handleSelectChat = (chatId: string) => {
    setSelectedChatIds(prev =>
      prev.includes(chatId)
        ? prev.filter(id => id !== chatId)
        : [...prev, chatId]
    )
  }

  const handleDeleteSelected = async () => {
    if (selectedChatIds.length === 0) return
    if (
      window.confirm(
        `Are you sure you want to delete ${selectedChatIds.length} conversation(s)?`
      )
    ) {
      try {
        await Promise.all(selectedChatIds.map(id => deleteChat(id)))

        if (selectedChatIds.some(id => pathname === `/chat/${id}`)) {
          router.push('/')
        }

        setChats(prev => prev.filter(chat => !selectedChatIds.includes(chat.id)))
        if(setIsSelectionMode) setIsSelectionMode(false) // This will also clear selectedChatIds via useEffect
      } catch (error) {
        console.error('Failed to delete selected chats:', error)
        alert('Failed to delete selected chats.')
      }
    }
  }

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



  // Search chats in the database with optimized FTS queries
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
    const searchStartTime = performance.now();
    try {
      // 🚀 OPTIMIZATION: Use PGroonga for multilingual full-text search
      // First, search by title using PGroonga via RPC function
      let { data: titleResults, error: titleError } = await supabase
        .rpc('search_chat_sessions_pgroonga', {
          search_term: search,
          user_id_param: user.id,
          limit_param: 30
        });

      if (titleError) {
        console.error('Title search error (PGroonga may not be enabled):', titleError);
        // Fallback to ILIKE if PGroonga is not available
        const { data: fallbackTitleResults, error: fallbackTitleError } = await supabase
          .from('chat_sessions')
          .select('id, created_at, title, current_model, initial_message')
          .eq('user_id', user.id)
          .or(`title.ilike.%${search}%,initial_message.ilike.%${search}%`)
          .order('created_at', { ascending: false })
          .limit(30);
        
        if (fallbackTitleError) {
          console.error('Fallback title search error:', fallbackTitleError);
          setSearchResults([]);
          return;
        }
        
        // Use fallback results
        titleResults = fallbackTitleResults;
      }

      // Then, search by message content using PGroonga for multilingual support (all roles)
      let { data: messageResults, error: messageError } = await supabase
        .rpc('search_messages_pgroonga', {
          search_term: search,
          user_id_param: user.id,
          limit_param: 100
        });

      if (messageError) {
        console.error('Message search error (PGroonga may not be enabled):', messageError);
        // Fallback to ILIKE if PGroonga is not available
        const { data: fallbackMessageResults, error: fallbackMessageError } = await supabase
          .from('messages')
          .select('chat_session_id, content, created_at, role, model')
          .eq('user_id', user.id)
          .ilike('content', `%${search}%`)
          .order('created_at', { ascending: false })
          .limit(100);
        
        if (fallbackMessageError) {
          console.error('Fallback message search error:', fallbackMessageError);
          setSearchResults([]);
          return;
        }
        
        // Use fallback results
        messageResults = fallbackMessageResults;
      }

      // 🚀 NEW: Search structured response titles with improved error handling
      let structuredResponseResults: any[] = [];
      let structuredResponseError = null;

      try {
        // First try PGroonga RPC function
        const { data: rpcResults, error: rpcError } = await supabase
          .rpc('search_structured_response_titles_pgroonga', {
            search_term: search,
            user_id_param: user.id,
            limit_param: 50
          });

        if (rpcError) {
          throw rpcError;
        }
        
        structuredResponseResults = rpcResults || [];
      } catch (error) {
        console.warn('PGroonga RPC search failed, falling back to ILIKE:', error);
        structuredResponseError = error;
        
        // Fallback to direct query with ILIKE
        try {
          const { data: fallbackStructuredResults, error: fallbackStructuredError } = await supabase
            .from('messages')
            .select('chat_session_id, id, tool_results, created_at, content')
            .eq('user_id', user.id)
            .not('tool_results', 'is', null)
            .filter('tool_results->structuredResponse->response->title', 'not.is', null)
            .order('created_at', { ascending: false })
            .limit(50);
          
          if (fallbackStructuredError) {
            console.error('Fallback structured response search error:', fallbackStructuredError);
            structuredResponseResults = [];
          } else {
            // Filter and process results in JavaScript for better compatibility
            structuredResponseResults = (fallbackStructuredResults || [])
              .filter(msg => {
                const title = msg.tool_results?.structuredResponse?.response?.title;
                return title && (
                  title.toLowerCase().includes(search.toLowerCase()) ||
                  msg.content.toLowerCase().includes(search.toLowerCase())
                );
              })
              .map(msg => ({
                chat_session_id: msg.chat_session_id,
                message_id: msg.id,
                title: msg.tool_results?.structuredResponse?.response?.title || '',
                created_at: msg.created_at,
                content: msg.content
              }));
          }
        } catch (fallbackError) {
          console.error('Both RPC and fallback structured response search failed:', fallbackError);
          structuredResponseResults = [];
        }
      }

      // Get unique session IDs from message search
      const messageSessionIds = messageResults 
        ? [...new Set(messageResults.map((msg: any) => msg.chat_session_id))]
        : [];

      // Get unique session IDs from structured response search
      const structuredResponseSessionIds = structuredResponseResults 
        ? [...new Set(structuredResponseResults.map((msg: any) => msg.chat_session_id))]
        : [];

      // Combine all session IDs
      const allMessageSessionIds = [...new Set([...messageSessionIds, ...structuredResponseSessionIds])];

      // Fetch session details for message search results (only if not already in title results)
      const existingSessionIds = new Set((titleResults || []).map((s: any) => s.id));
      const newSessionIds = allMessageSessionIds.filter(id => !existingSessionIds.has(id));
      
      const { data: messageSessionResults, error: sessionError } = newSessionIds.length > 0 
        ? await supabase
            .from('chat_sessions')
            .select('id, created_at, title, current_model, initial_message')
            .eq('user_id', user.id)
            .in('id', newSessionIds)
        : { data: [], error: null };

      if (sessionError) {
        console.error('Session fetch error:', sessionError);
        setSearchResults([]);
        return;
      }

      // Merge and deduplicate results
      const allSessions = [...(titleResults || []), ...(messageSessionResults || [])];
      const uniqueSessions = allSessions.filter((session: any, index: number, self: any[]) => 
        index === self.findIndex((s: any) => s.id === session.id)
      );

      // Process results efficiently
      const processedChats = uniqueSessions.map((session) => {
        // Find messages for this session
        const sessionMessages = messageResults?.filter((msg: any) => msg.chat_session_id === session.id) || [];
        
        // Find structured response results for this session
        const sessionStructuredResponses = structuredResponseResults?.filter((msg: any) => msg.chat_session_id === session.id) || [];
        
        const firstUserMsg = sessionMessages
          .filter((msg: any) => msg.role === 'user')
          .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0];
        
        const latestMsg = sessionMessages
          .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
        
        // Get the latest structured response for this session
        const latestStructuredResponse = sessionStructuredResponses
          .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

        // Determine title with better fallback logic
        const title = session.title && session.title.trim().length > 0
          ? session.title
          : (session.initial_message && session.initial_message.trim().length > 0
              ? (session.initial_message.length > 40 
                  ? session.initial_message.substring(0, 40) + '...' 
                  : session.initial_message)
              : (firstUserMsg
                  ? (firstUserMsg.content.length > 40 
                      ? firstUserMsg.content.substring(0, 40) + '...' 
                      : firstUserMsg.content)
                  : 'Untitled Chat'));
        
        // 🚀 FIX: Create a snippet around the search term for accurate preview
        const searchTermLower = search.toLowerCase();
        let lastMessage = '';
        let lastMessageTime = new Date(session.created_at).getTime();

        const createSnippet = (text: string, term: string, contextLength = 20) => {
          const textLower = text.toLowerCase();
          const searchWords = term.toLowerCase().trim().split(/\s+/).filter(word => word.length > 0);
          
          let firstMatchIndex = -1;
          for (const word of searchWords) {
            const index = textLower.indexOf(word);
            if (index !== -1) {
              firstMatchIndex = index;
              break;
            }
          }

          if (firstMatchIndex === -1) {
            return text.length > 100 ? text.substring(0, 100) + '...' : text;
          }

          const start = Math.max(0, firstMatchIndex - contextLength);
          const end = Math.min(text.length, firstMatchIndex + searchWords[0].length + contextLength);
          
          let snippet = text.substring(start, end);
          if (start > 0) snippet = '...' + snippet;
          if (end < text.length) snippet = snippet + '...';
          return snippet;
        };
        
        // Check for structured response matches first (highest priority)
        if (latestStructuredResponse && latestStructuredResponse.title) {
          const structuredTitle = latestStructuredResponse.title;
          if (structuredTitle.toLowerCase().includes(searchTermLower)) {
            lastMessage = `📋 ${createSnippet(structuredTitle, search)}`;
            lastMessageTime = new Date(latestStructuredResponse.created_at).getTime();
          } else if (latestStructuredResponse.content && latestStructuredResponse.content.toLowerCase().includes(searchTermLower)) {
            lastMessage = `📋 ${structuredTitle} - ${createSnippet(latestStructuredResponse.content, search)}`;
            lastMessageTime = new Date(latestStructuredResponse.created_at).getTime();
          }
        }
        
        // If no structured response match, check regular messages
        if (!lastMessage) {
          // sessionMessages are already sorted DESC, so the first element is the latest match
          const latestMatchingMessage = sessionMessages.length > 0 ? sessionMessages[0] : null;

          if (latestMatchingMessage) {
            lastMessage = createSnippet(latestMatchingMessage.content, search);
            lastMessageTime = new Date(latestMatchingMessage.created_at).getTime();
          } else if (session.initial_message && session.initial_message.toLowerCase().includes(searchTermLower)) {
            lastMessage = createSnippet(session.initial_message, search);
          } else {
            // Fallback for title-only matches
            const fallbackPreview = latestMsg ? latestMsg.content : (session.initial_message || '');
            lastMessage = fallbackPreview.length > 100 ? fallbackPreview.substring(0, 100) + '...' : fallbackPreview;
            lastMessageTime = latestMsg ? new Date(latestMsg.created_at).getTime() : new Date(session.created_at).getTime();
          }
        }

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

      // Sort efficiently by relevance and time
      processedChats.sort((a, b) => {
        // Prioritize structured response matches (highest priority)
        const aStructuredMatch = a.lastMessage?.startsWith('📋');
        const bStructuredMatch = b.lastMessage?.startsWith('📋');
        
        if (aStructuredMatch && !bStructuredMatch) return -1;
        if (!aStructuredMatch && bStructuredMatch) return 1;
        
        // Then prioritize title matches over message matches
        const aTitleMatch = a.title.toLowerCase().includes(search);
        const bTitleMatch = b.title.toLowerCase().includes(search);
        
        if (aTitleMatch && !bTitleMatch) return -1;
        if (!aTitleMatch && bTitleMatch) return 1;
        
        // Finally sort by time
        const timeA = a.lastMessageTime ?? 0;
        const timeB = b.lastMessageTime ?? 0;
        return timeB - timeA;
      });

      // Cache the results
      setSearchCache(prev => new Map(prev).set(search, processedChats));
      setSearchResults(processedChats);
      
      // 🚀 PERFORMANCE MONITORING: Log search performance with PGroonga status
      const searchEndTime = performance.now();
      const searchDuration = searchEndTime - searchStartTime;
      const usedPGroonga = !titleError && !messageError && !structuredResponseError;
      const structuredResponseCount = structuredResponseResults?.length || 0;
      console.log(`🔍 ${usedPGroonga ? 'PGroonga' : 'ILIKE'} search completed in ${searchDuration.toFixed(2)}ms for term: "${search}" (${processedChats.length} results, ${structuredResponseCount} structured responses)`);
      
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

  // Execute search on term change (debounced with smart caching)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchTerm.trim()) {
        // 🚀 OPTIMIZATION: Check for partial matches in cache for instant results
        const trimmedTerm = searchTerm.trim().toLowerCase();
        
        // Check if we have a cached result for this exact term
        if (searchCache.has(trimmedTerm)) {
          setSearchResults(searchCache.get(trimmedTerm) || []);
          setIsSearching(false);
          return;
        }
        
        // Check for partial matches in cache (for instant feedback)
        const partialMatches = Array.from(searchCache.keys()).filter(key => 
          key.includes(trimmedTerm) || trimmedTerm.includes(key)
        );
        
        if (partialMatches.length > 0) {
          // Use the most relevant cached result as instant feedback
          const bestMatch = partialMatches.reduce((best, current) => 
            current.length < best.length ? current : best
          );
          const cachedResults = searchCache.get(bestMatch) || [];
          const filteredResults = cachedResults.filter(chat => 
            chat.title.toLowerCase().includes(trimmedTerm) ||
            (chat.lastMessage && chat.lastMessage.toLowerCase().includes(trimmedTerm))
          );
          setSearchResults(filteredResults);
        }
        
        // Then perform the actual search
        searchChats(searchTerm);
      } else {
        setSearchResults([]);
        setIsSearching(false);
      }
    }, 300); // 🚀 OPTIMIZATION: Balanced debounce time for better UX

    return () => clearTimeout(timeoutId);
  }, [searchTerm, searchCache]); // Added searchCache dependency for partial matching

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


  if (!user) {
    return null;
  }

  return (
    <div className={`${isMobile ? 'w-full' : 'w-80'} h-full ${isMobile ? 'bg-background' : 'bg-[var(--sidebar-light)] dark:bg-[var(--sidebar-dark)]'} flex flex-col items-center overflow-hidden relative`}>
      {/* SVG 필터 정의: 유리 질감 왜곡 효과 */}
      <svg style={{ position: 'absolute', width: 0, height: 0 }}>
        <defs>
          <filter id="glass-distortion" x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.02 0.05" numOctaves="3" seed="7" result="noise" />
            <feImage result="radialMask" preserveAspectRatio="none" x="0" y="0" width="100%" height="100%" xlinkHref="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><defs><radialGradient id='g' cx='50%25' cy='50%25' r='70%25'><stop offset='0%25' stop-color='black'/><stop offset='100%25' stop-color='white'/></radialGradient></defs><rect width='100%25' height='100%25' fill='url(%23g)'/></svg>" />
            <feComposite in="noise" in2="radialMask" operator="arithmetic" k1="0" k2="0" k3="1" k4="0" result="modulatedNoise" />
            <feGaussianBlur in="modulatedNoise" stdDeviation="0.3" edgeMode="duplicate" result="smoothNoise" />
            <feDisplacementMap in="SourceGraphic" in2="smoothNoise" scale="18" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          {/* 다크모드 전용 글라스 필터 */}
          <filter id="glass-distortion-dark" x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.015 0.03" numOctaves="4" seed="7" result="noise" />
            <feImage result="radialMask" preserveAspectRatio="none" x="0" y="0" width="100%" height="100%" xlinkHref="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><defs><radialGradient id='g-dark' cx='50%25' cy='50%25' r='80%25'><stop offset='0%25' stop-color='white'/><stop offset='100%25' stop-color='black'/></radialGradient></defs><rect width='100%25' height='100%25' fill='url(%23g-dark)'/></svg>" />
            <feComposite in="noise" in2="radialMask" operator="arithmetic" k1="0" k2="0" k3="0.8" k4="0" result="modulatedNoise" />
            <feGaussianBlur in="modulatedNoise" stdDeviation="0.4" edgeMode="duplicate" result="smoothNoise" />
            <feDisplacementMap in="SourceGraphic" in2="smoothNoise" scale="12" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>
      
      <div className="h-full flex flex-col w-full overflow-x-hidden">
        {/* Top Section with Problem Report */}
        {/* <div className="pt-0 px-[14px] sm:px-[14px] flex flex-col space-y-0"> */}
          {/* Empty space for hamburger icon (maintained for UI consistency) */}
          {/* <div className="min-w-[40px] h-6 sm:h-10 ounded-lg flex items-center justify-center">
            <div className="w-4 h-4"></div>
          </div>
           */}

          {/* Problem Report Button - Commented out */}
          {/* {!isAnonymousUser && (
            <button
              onClick={() => {
                setIsProblemReportOpen(true);
                // 모바일에서만 사이드바 닫기
                if (isMobile && toggleSidebar) {
                  toggleSidebar();
                }
              }}
              className="flex items-center group w-full text-left cursor-pointer"
              type="button"
            >
              <div className="min-w-[40px] h-10 rounded-lg flex items-center justify-center">
                <LifeBuoy size={16} className="text-[var(--muted)]" />
              </div>
              <span className="ml-3 text-sm font-medium whitespace-nowrap text-[var(--muted)]">
                {translations.reportIssue}
              </span>
            </button>
          )} */}

        {/* </div> */}

        {/* Main Content Area */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto overflow-x-hidden sidebar-scroll w-full mt-0 md:mt-0 px-4 md:px-3 relative pb-24">
          {/* Messages Title */}
          <div className="px-2 py-2 pt-16 sm:pt-16">
            <h2 className="font-bold text-2xl">{translations.messages}</h2>
          </div>
          
          {/* Chat History Section */}
          {useMemo(() => {
            return (
            <div className="space-y-3">
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
                  <div className="px-0 py-0">
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
                            <div key={`${chat.id}-${index}`} className={`last:border-b-0 flex items-center transition-all duration-200 ${isSelectionMode ? 'pl-2' : 'pl-0'} min-w-0 py-0`}>
                              {isSelectionMode && (
                                <div className="pr-3 cursor-pointer" onClick={() => handleSelectChat(chat.id)}>
                                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${selectedChatIds.includes(chat.id) ? 'bg-[#007AFF] border-[#007AFF]' : 'border-[var(--muted)] opacity-50'}`}>
                                    {selectedChatIds.includes(chat.id) && <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                                  </div>
                                </div>
                              )}
                              <Link
                                href={editingChatId === chat.id || isSelectionMode ? '#' : `/chat/${chat.id}`}
                                className={`group relative block transition-all px-3 rounded-lg flex-1 min-w-0 ${ 
                                  editingChatId === chat.id 
                                    ? 'cursor-default' 
                                    : isSelectionMode ? 'cursor-pointer' : 'cursor-pointer'
                                } ${ 
                                  isSelected || (editingChatId === chat.id)
                                    ? 'bg-[#007AFF] text-white' 
                                    : 'hover:bg-[var(--accent)]'
                                }`}
                                onClick={(e) => {
                                  if (isSelectionMode) {
                                    e.preventDefault();
                                    handleSelectChat(chat.id);
                                    return;
                                  }
                                  if (editingChatId === chat.id) {
                                    e.preventDefault()
                                    e.stopPropagation()
                                  } else {
                                    // 🚀 모바일에서 채팅 클릭 시 사이드바 닫기
                                    if (isMobile && toggleSidebar) {
                                      toggleSidebar();
                                    }
                                    
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
                                          {modelConfig?.provider && hasLogo(modelConfig.provider, modelConfig.id) ? (
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
                                  <div className="flex-1 min-w-0 overflow-hidden border-b border-[var(--sidebar-divider)] pb-6 pt-3">
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
                                          className={`text-sm font-semibold truncate pr-2 min-w-0 max-w-[180px] ${ 
                                            isSelected ? 'text-white' : 'text-[var(--foreground)]'
                                          }`}
                                          onDoubleClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleEditChatTitle(chat.id, chat.title);
                                          }}
                                          title="Double-click to edit title"
                                        >
                                          {searchTerm ? highlightSearchTerm(chat.title, searchTerm, { isSelected }) : chat.title}
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
                                      <p className={`text-xs truncate pr-2 min-w-0 ${ 
                                        isSelected ? 'text-white/70' : 'text-[var(--muted)]'
                                      }`}>
                                        {searchTerm && chat.lastMessage 
                                          ? highlightSearchTerm(chat.lastMessage, searchTerm, { isSelected })
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
                  </div>
                </>
              )}
              </div>
            </div>
            );
          }, [displayChats, pathname, handleDeleteChat, hasMore, isLoadingMore, currentTime, editingChatId, editingTitle, handleEditChatTitle, handleSaveChatTitle, handleChatTitleKeyDown, searchTerm, isSearching, isSelectionMode, selectedChatIds, handleSelectChat])}


        </div>

        {/* Bottom Section - Search and New Chat - Floating over messages */}
        <div className="absolute bottom-3 left-0 right-0 p-3 flex flex-col space-y-3 text-[var(--muted)] z-20 pointer-events-none">
          {isSelectionMode ? (
              <div className="flex items-center justify-around px-2 pointer-events-auto gap-3">
                <button
                    onClick={() => {
                      if (selectedChatIds.length === 1) {
                        const chatToEdit = displayChats.find(
                          chat => chat.id === selectedChatIds[0]
                        )
                        if (chatToEdit) {
                          handleEditChatTitle(chatToEdit.id, chatToEdit.title)
                          if(setIsSelectionMode) setIsSelectionMode(false)
                        }
                      }
                    }}
                    disabled={selectedChatIds.length !== 1}
                    className="flex items-center justify-center w-10 h-10 rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
                    style={{
                      // 다크모드 전용 스타일
                      ...(document.documentElement.getAttribute('data-theme') === 'dark' || 
                          (document.documentElement.getAttribute('data-theme') === 'system' && 
                           window.matchMedia('(prefers-color-scheme: dark)').matches) ? {
                        backgroundColor: window.innerWidth <= 768 ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.7)',
                        backdropFilter: (window.innerWidth <= 768 || /^((?!chrome|android).)*safari/i.test(navigator.userAgent)) ? 'blur(10px)' : 'url(#glass-distortion-dark) blur(1px)',
                        WebkitBackdropFilter: (window.innerWidth <= 768 || /^((?!chrome|android).)*safari/i.test(navigator.userAgent)) ? 'blur(10px)' : 'url(#glass-distortion-dark) blur(1px)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        boxShadow: '0 8px 40px rgba(0, 0, 0, 0.3), 0 4px 20px rgba(0, 0, 0, 0.2), 0 2px 8px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                      } : {
                        backgroundColor: window.innerWidth <= 768 ? 'rgba(255, 255, 255, 0.6)' : 'rgba(255, 255, 255, 0.8)',
                        backdropFilter: (window.innerWidth <= 768 || /^((?!chrome|android).)*safari/i.test(navigator.userAgent)) ? 'blur(10px)' : 'url(#glass-distortion) blur(1px)',
                        WebkitBackdropFilter: (window.innerWidth <= 768 || /^((?!chrome|android).)*safari/i.test(navigator.userAgent)) ? 'blur(10px)' : 'url(#glass-distortion) blur(1px)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        boxShadow: '0 8px 40px rgba(0, 0, 0, 0.06), 0 4px 20px rgba(0, 0, 0, 0.04), 0 2px 8px rgba(0, 0, 0, 0.025), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
                      })
                    }}
                    title="Edit Title"
                >
                    <Edit size={18} />
                </button>
                <button
                    onClick={handleDeleteSelected}
                    disabled={selectedChatIds.length === 0}
                    className="flex items-center justify-center w-10 h-10 rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
                    style={{
                      // 다크모드 전용 스타일
                      ...(document.documentElement.getAttribute('data-theme') === 'dark' || 
                          (document.documentElement.getAttribute('data-theme') === 'system' && 
                           window.matchMedia('(prefers-color-scheme: dark)').matches) ? {
                        backgroundColor: window.innerWidth <= 768 ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.7)',
                        backdropFilter: (window.innerWidth <= 768 || /^((?!chrome|android).)*safari/i.test(navigator.userAgent)) ? 'blur(10px)' : 'url(#glass-distortion-dark) blur(1px)',
                        WebkitBackdropFilter: (window.innerWidth <= 768 || /^((?!chrome|android).)*safari/i.test(navigator.userAgent)) ? 'blur(10px)' : 'url(#glass-distortion-dark) blur(1px)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        boxShadow: '0 8px 40px rgba(0, 0, 0, 0.3), 0 4px 20px rgba(0, 0, 0, 0.2), 0 2px 8px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                      } : {
                        backgroundColor: window.innerWidth <= 768 ? 'rgba(255, 255, 255, 0.6)' : 'rgba(255, 255, 255, 0.8)',
                        backdropFilter: (window.innerWidth <= 768 || /^((?!chrome|android).)*safari/i.test(navigator.userAgent)) ? 'blur(10px)' : 'url(#glass-distortion) blur(1px)',
                        WebkitBackdropFilter: (window.innerWidth <= 768 || /^((?!chrome|android).)*safari/i.test(navigator.userAgent)) ? 'blur(10px)' : 'url(#glass-distortion) blur(1px)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        boxShadow: '0 8px 40px rgba(0, 0, 0, 0.06), 0 4px 20px rgba(0, 0, 0, 0.04), 0 2px 8px rgba(0, 0, 0, 0.025), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
                      })
                    }}
                    title="Delete"
                >
                    <Trash2 size={18} />
                </button>
              </div>
          ) : (
          <>
          {/* Search Input with New Chat Button */}
          <div className="px-2 pointer-events-auto">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={`${translations.searchConversations}`}
                  className={`w-full px-4 py-2.5 text-sm rounded-full placeholder-[var(--muted)] focus:outline-none transition-all ${
                    isAnonymousUser ? 'opacity-60 cursor-not-allowed' : ''
                  }`}
                  style={{ 
                    outline: 'none',
                    WebkitAppearance: 'none',
                    // 다크모드 전용 스타일
                    ...(document.documentElement.getAttribute('data-theme') === 'dark' || 
                        (document.documentElement.getAttribute('data-theme') === 'system' && 
                         window.matchMedia('(prefers-color-scheme: dark)').matches) ? {
                      backgroundColor: window.innerWidth <= 768 ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.8)',
                      backdropFilter: (window.innerWidth <= 768 || /^((?!chrome|android).)*safari/i.test(navigator.userAgent)) ? 'blur(10px)' : 'url(#glass-distortion-dark) blur(1px)',
                      WebkitBackdropFilter: (window.innerWidth <= 768 || /^((?!chrome|android).)*safari/i.test(navigator.userAgent)) ? 'blur(10px)' : 'url(#glass-distortion-dark) blur(1px)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      boxShadow: '0 8px 40px rgba(0, 0, 0, 0.3), 0 4px 20px rgba(0, 0, 0, 0.2), 0 2px 8px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                    } : {
                      backgroundColor: window.innerWidth <= 768 ? 'rgba(255, 255, 255, 0.6)' : 'rgba(255, 255, 255, 0.9)',
                      backdropFilter: (window.innerWidth <= 768 || /^((?!chrome|android).)*safari/i.test(navigator.userAgent)) ? 'blur(10px)' : 'url(#glass-distortion) blur(1px)',
                      WebkitBackdropFilter: (window.innerWidth <= 768 || /^((?!chrome|android).)*safari/i.test(navigator.userAgent)) ? 'blur(10px)' : 'url(#glass-distortion) blur(1px)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      boxShadow: '0 8px 40px rgba(0, 0, 0, 0.06), 0 4px 20px rgba(0, 0, 0, 0.04), 0 2px 8px rgba(0, 0, 0, 0.025), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
                    })
                  }}
                  disabled={isAnonymousUser}
                />
              </div>
              
              {/* New Chat Button */}
              {!isAnonymousUser && (
                <button
                  onClick={() => {
                    console.log('🚀 [NEW_CHAT_BUTTON] Clicked from sidebar:', pathname);
                    
                    // 🚀 모바일에서 새글 버튼 클릭 시 사이드바 닫기
                    if (isMobile && toggleSidebar) {
                      toggleSidebar();
                    }
                    
                    if (pathname === '/') {
                      // 홈에서는 즉시 새 채팅 이벤트 발생
                      window.dispatchEvent(new CustomEvent('requestNewChat'));
                    } else {
                      // 채팅창에서는 홈으로 이동 후 새 채팅 이벤트 발생
                      router.push('/');
                      // 라우팅 후 새 채팅 이벤트 발생 (약간의 지연)
                      setTimeout(() => {
                        window.dispatchEvent(new CustomEvent('requestNewChat'));
                      }, 50);
                    }
                  }}
                  className="flex items-center justify-center w-10 h-10 rounded-full transition-all duration-300 cursor-pointer"
                  style={{
                    color: 'var(--foreground)',
                    // 다크모드 전용 스타일
                    ...(document.documentElement.getAttribute('data-theme') === 'dark' || 
                        (document.documentElement.getAttribute('data-theme') === 'system' && 
                         window.matchMedia('(prefers-color-scheme: dark)').matches) ? {
                      backgroundColor: window.innerWidth <= 768 ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.7)',
                      backdropFilter: (window.innerWidth <= 768 || /^((?!chrome|android).)*safari/i.test(navigator.userAgent)) ? 'blur(10px)' : 'url(#glass-distortion-dark) blur(1px)',
                      WebkitBackdropFilter: (window.innerWidth <= 768 || /^((?!chrome|android).)*safari/i.test(navigator.userAgent)) ? 'blur(10px)' : 'url(#glass-distortion-dark) blur(1px)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      boxShadow: '0 8px 40px rgba(0, 0, 0, 0.3), 0 4px 20px rgba(0, 0, 0, 0.2), 0 2px 8px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                    } : {
                      backgroundColor: window.innerWidth <= 768 ? 'rgba(255, 255, 255, 0.6)' : 'rgba(255, 255, 255, 0.8)',
                      backdropFilter: (window.innerWidth <= 768 || /^((?!chrome|android).)*safari/i.test(navigator.userAgent)) ? 'blur(10px)' : 'url(#glass-distortion) blur(1px)',
                      WebkitBackdropFilter: (window.innerWidth <= 768 || /^((?!chrome|android).)*safari/i.test(navigator.userAgent)) ? 'blur(10px)' : 'url(#glass-distortion) blur(1px)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      boxShadow: '0 8px 40px rgba(0, 0, 0, 0.06), 0 4px 20px rgba(0, 0, 0, 0.04), 0 2px 8px rgba(0, 0, 0, 0.025), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
                    })
                  }}
                  title="New Chat"
                  type="button"
                  aria-label="New Chat"
                >
                  <SquarePencil className="w-8 h-8 pt-1 pl-0.5" />
                </button>
              )}
            </div>
          </div>
          </>
          )}
        </div>


      </div>

      <ProblemReportDialog
        isOpen={isProblemReportOpen}
        onClose={() => setIsProblemReportOpen(false)}
        user={user}
      />
      <SubscriptionDialog
        isOpen={isSubscriptionOpen}
        onClose={() => setIsSubscriptionOpen(false)}
        user={user}
      />
    </div>
  )
} 
