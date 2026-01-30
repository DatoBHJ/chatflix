'use client'

import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { Chat } from '@/lib/types'
import { deleteChat } from '@/app/chat/[id]/utils'
import Link from 'next/link'
import Image from 'next/image'

import { getModelById, isChatflixModel } from '@/lib/models/config'
import { getProviderLogo, hasLogo, getChatflixLogo } from '@/lib/models/logoUtils'
import { getSidebarTranslations } from '@/app/lib/translations/sidebar'
import { useSidebar } from '@/app/lib/SidebarContext'
import { Trash2, Edit } from 'lucide-react'
import { SquarePencil } from 'react-ios-icons'
import { ProblemReportDialog } from '@/app/components/ProblemReportDialog'
// import { SubscriptionDialog } from '@/app/components/SubscriptionDialog'
import { highlightSearchTerm } from '@/app/utils/searchHighlight'
import { getAdaptiveGlassStyleClean } from '@/app/lib/adaptiveGlassStyle'
import { useElementBackgroundBrightness } from '@/app/hooks/useBackgroundBrightness'

const toEpochMs = (value?: string | number | null) => {
  if (!value) return 0
  if (typeof value === 'number') return value
  const timestamp = Date.parse(value)
  return Number.isNaN(timestamp) ? 0 : timestamp
}

const deriveSessionActivity = (session: { last_activity_at?: string | null; created_at: string }) => {
  return toEpochMs(session.last_activity_at) || toEpochMs(session.created_at)
}

const sortChatsByActivity = (chatList: Chat[]) =>
  [...chatList].sort((a, b) => (b.lastMessageTime ?? 0) - (a.lastMessageTime ?? 0))

interface ChatSidebarProps {
  user: any;
  toggleSidebar?: () => void;
}

export function ChatSidebar({ user, toggleSidebar }: ChatSidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [chats, setChats] = useState<Chat[]>([])
  const [isDark, setIsDark] = useState(false)
  const supabase = createClient()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const { isMobile, isSelectionMode, setIsSelectionMode } = useSidebar()
  const [selectedChatIds, setSelectedChatIds] = useState<string[]>([])
  const [isProblemReportOpen, setIsProblemReportOpen] = useState(false)
  const [isSubscriptionOpen, setIsSubscriptionOpen] = useState(false)
  const [isExpanded, setIsExpanded] = useState(true)
  
  const sidebarRef = useRef<HTMLDivElement>(null)
  const { isDark: isBackgroundDark } = useElementBackgroundBrightness(sidebarRef)
  
  useEffect(() => {
    const checkTheme = () => {
      const theme = document.documentElement.getAttribute('data-theme');
      const isDarkMode = theme === 'dark' || 
        (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      setIsDark(isDarkMode);
    };
    
    checkTheme();
    
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });
    
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', checkTheme);
    
    return () => {
      observer.disconnect();
      mediaQuery.removeEventListener('change', checkTheme);
    };
  }, []);
  
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

  const [currentPage, setCurrentPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [initialLoadComplete, setInitialLoadComplete] = useState(false)
  const CHATS_PER_PAGE = 15
  const observerRef = useRef<IntersectionObserver | null>(null)
  const loadMoreTriggerRef = useRef<HTMLDivElement | null>(null)

  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const [editingChatId, setEditingChatId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const titleInputRef = useRef<HTMLInputElement>(null)

  const [searchTerm, setSearchTerm] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [searchResults, setSearchResults] = useState<Chat[]>([])
  const [isSearching, setIsSearching] = useState(false)

  const [searchCache, setSearchCache] = useState<Map<string, Chat[]>>(new Map())

  const [lastLoadedUserId, setLastLoadedUserId] = useState<string | null>(null)
  const [isChatsLoaded, setIsChatsLoaded] = useState(false)
  const lastLoadTimeRef = useRef<number>(0)
  const CACHE_DURATION = 10 * 60 * 1000

  const [currentTime, setCurrentTime] = useState(Date.now())

  useEffect(() => {
    setTranslations(getSidebarTranslations());
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now())
    }, 60000)

    return () => clearInterval(interval)
  }, [])

  const isAnonymousUser = user?.isAnonymous || user?.id === 'anonymous';

  useEffect(() => {
    if (!user?.id || isAnonymousUser) {
      setChats([]);
      setInitialLoadComplete(true);
      return;
    }

    if (lastLoadedUserId === user.id && isChatsLoaded) {
      return;
    }

    loadChats(1, false, false);
  }, [user?.id, isAnonymousUser]);

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
          console.log('🔄 [ChatSidebar] Real-time update received:', payload);
          
          if (payload.eventType === 'UPDATE') {
            const updatedSession = payload.new;
            if (updatedSession?.id) {
              setChats(prevChats => {
                const mapped = prevChats.map(chat => {
                  if (chat.id !== updatedSession.id) return chat;

                  const nextLastActivity =
                    updatedSession.last_activity_at ||
                    chat.last_activity_at ||
                    chat.created_at;

                  return {
                    ...chat,
                    title: updatedSession.title ?? chat.title,
                    current_model: updatedSession.current_model ?? chat.current_model,
                    last_activity_at: nextLastActivity,
                    lastMessageTime: deriveSessionActivity({
                      last_activity_at: nextLastActivity,
                      created_at: chat.created_at
                    })
                  };
                });

                return sortChatsByActivity(mapped);
              });
              console.log('✅ [ChatSidebar] Session updated in real-time:', {
                chatId: updatedSession.id,
                title: updatedSession.title,
                current_model: updatedSession.current_model,
                last_activity_at: updatedSession.last_activity_at
              });
            }
          } else if (payload.eventType === 'INSERT' || payload.eventType === 'DELETE') {
            loadChats(1, false, true);
          }
        }
      )
      .subscribe()

    const pollInterval = setInterval(async () => {
      try {
        const { data: recentSessions, error } = await supabase
          .from('chat_sessions')
          .select('id, title, created_at')
          .eq('user_id', user.id)
          .gte('created_at', new Date(Date.now() - 30000).toISOString())
          .order('created_at', { ascending: false })
          .limit(5);

        if (!error && recentSessions) {
          setChats(prevChats => {
            let hasUpdates = false;
            const updatedChats = prevChats.map(chat => {
              const recentSession = recentSessions.find(s => s.id === chat.id);
              if (recentSession && recentSession.title !== chat.title) {
                hasUpdates = true;
                console.log('🔄 [ChatSidebar] Polling detected title update:', {
                  chatId: chat.id,
                  oldTitle: chat.title,
                  newTitle: recentSession.title
                });
                return { ...chat, title: recentSession.title };
              }
              return chat;
            });
            return hasUpdates ? updatedChats : prevChats;
          });
        }
      } catch (pollError) {
        console.error('💥 [ChatSidebar] Polling error:', pollError);
      }
    }, 5000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    }
  }, [user?.id, isAnonymousUser])

  useEffect(() => {
    if (!user?.id || isAnonymousUser) {
      return;
    }
    const handleNewChat = (event: CustomEvent) => {
      const chatData = event.detail;
      console.log('🚀 [ChatSidebar] New chat event received:', chatData);
      
      if (!chatData?.id) {
        console.log('🚀 [ChatSidebar] Invalid chat data, skipping');
        return;
      }
      
      setChats(prevChats => {
        const existingChat = prevChats.find(chat => chat.id === chatData.id);
        if (existingChat) {
          console.log('🚀 [ChatSidebar] Chat already exists, skipping duplicate:', chatData.id);
          return prevChats;
        }
        
        let title = chatData.title;
        if (!title && chatData.initial_message) {
          const message = chatData.initial_message.trim();
          title = message.length > 45 ? message.slice(0, 45) + '...' : message;
        }
        
        const lastActivityIso = chatData.last_activity_at || chatData.created_at;
        const lastActivityMs = toEpochMs(lastActivityIso);

        const newChat: Chat = {
          id: chatData.id,
          title: title || 'New Chat',
          created_at: chatData.created_at,
          messages: [],
          lastMessageTime: lastActivityMs,
          lastMessage: chatData.initial_message || '',
          current_model: chatData.current_model,
          last_activity_at: lastActivityIso
        };
        
        const updatedChats = sortChatsByActivity([newChat, ...prevChats]);
        
        console.log('🚀 [ChatSidebar] Chat added with immediate title:', title);
        return updatedChats;
      });

      if (chatData.initial_message?.trim() && chatData.current_model) {
        const tempTitle = chatData.title || (chatData.initial_message.trim().length > 45 
          ? chatData.initial_message.trim().slice(0, 45) + '...' 
          : chatData.initial_message.trim());
      }
    };

    const handleChatTitleUpdated = (event: CustomEvent) => {
      const { id, title } = event.detail;
      console.log('🚀 [ChatSidebar] Chat title update event received:', { id, title });
      
      if (!id || !title?.trim()) {
        console.log('🚀 [ChatSidebar] Invalid title update data, skipping');
        return;
      }
      
      setChats(prevChats => {
        const updatedChats = prevChats.map(chat => 
          chat.id === id ? { ...chat, title: title.trim() } : chat
        );
        
        const wasUpdated = updatedChats.some((chat, index) => 
          chat.id === id && chat.title !== prevChats[index]?.title
        );
        
        if (wasUpdated) {
          console.log('🚀 [ChatSidebar] Chat title updated successfully:', id, '→', title.trim());
        } else {
          console.log('🚀 [ChatSidebar] Chat not found for title update:', id);
        }
        
        return updatedChats;
      });
    };

    window.addEventListener('newChatCreated', handleNewChat as EventListener);
    window.addEventListener('chatTitleUpdated', handleChatTitleUpdated as EventListener);

    return () => {
      window.removeEventListener('newChatCreated', handleNewChat as EventListener);
      window.removeEventListener('chatTitleUpdated', handleChatTitleUpdated as EventListener);
    };
  }, [user?.id, isAnonymousUser]);

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
        const results = await Promise.allSettled(
          selectedChatIds.map(id => deleteChat(id))
        )

        const successful: string[] = []
        const failed: string[] = []

        results.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            successful.push(selectedChatIds[index])
          } else {
            failed.push(selectedChatIds[index])
          }
        })

        if (selectedChatIds.some(id => pathname === `/chat/${id}`)) {
          router.push('/chat')
        }

        if (successful.length > 0) {
          setChats(prev => prev.filter(chat => !successful.includes(chat.id)))
        }

        if (failed.length > 0) {
          alert(`${successful.length} conversation(s) deleted successfully. ${failed.length} conversation(s) failed to delete. Please refresh the page.`)
        } else {
          if(setIsSelectionMode) setIsSelectionMode(false)
        }
      } catch (error) {
        console.error('Failed to delete selected chats:', error)
        alert('Failed to delete selected chats. Please refresh the page to see the current state.')
      }
    }
  }

  const loadChats = useCallback(async (page = 1, append = false, forceRefresh = false) => {
    if (!user || isAnonymousUser) return;
    
    const now = Date.now();
    const isCacheValid = now - lastLoadTimeRef.current < CACHE_DURATION;
    
    if (!forceRefresh && page === 1 && !append && lastLoadedUserId === user.id && isCacheValid) {
      console.log('[ChatSidebar] Using cached chat data');
      return;
    }
    
    try {
      if (append) {
        setIsLoadingMore(true)
      }

      const from = (page - 1) * CHATS_PER_PAGE
      const to = from + CHATS_PER_PAGE - 1

      const { data: sessions, error: sessionsError } = await supabase
        .from('chat_sessions')
        .select('id, created_at, title, current_model, last_activity_at')
        .eq('user_id', user.id)
        .order('last_activity_at', { ascending: false, nullsFirst: false })
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

      const sessionIds = sessions.map(s => s.id);
      let firstMessages: Record<string, string> = {};
      
      if (sessionIds.length > 0) {
        const { data: messagesData } = await supabase
          .from('messages')
          .select('chat_session_id, content')
          .in('chat_session_id', sessionIds)
          .eq('role', 'user')
          .order('created_at', { ascending: true });
        
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
        const title = session.title && session.title.trim().length > 0
          ? session.title
          : 'New Chat'
        
        const activityTimestamp = deriveSessionActivity(session)

        const firstMessage = firstMessages[session.id] || '';
        const truncatedFirstMessage = firstMessage.length > 100 
          ? firstMessage.substring(0, 100) + '...' 
          : firstMessage;

        return {
          id: session.id,
          title: title,
          created_at: session.created_at,
          messages: [],
          lastMessageTime: activityTimestamp,
          lastMessage: truncatedFirstMessage,
          current_model: session.current_model,
          last_activity_at: session.last_activity_at || session.created_at
        } as Chat
      })

      const filteredChats = newChats.filter(chat => chat.title && chat.title.trim() !== '')
      
      if (append) {
        setChats(prevChats => sortChatsByActivity([...prevChats, ...filteredChats]))
      } else {
        setChats(sortChatsByActivity(filteredChats))
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
      console.error('Error in loadChats:', error)
      setIsLoadingMore(false)
    }
  }, [user, lastLoadedUserId, isAnonymousUser])

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
  }, [user]);

  const loadChatsRef = useRef(loadChats)
  loadChatsRef.current = loadChats

  useEffect(() => {
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
    if (isAnonymousUser) return;
    
    e.stopPropagation()
    
    try {
      await deleteChat(chatId);

      if (pathname === `/chat/${chatId}`) {
        router.push('/chat')
      }

      setChats(prevChats => prevChats.filter(chat => chat.id !== chatId))
    } catch (error) {
      console.error('Failed to delete chat:', error)
      alert('Failed to delete chat.')
    }
  }, [pathname, router, isAnonymousUser])

  const handleEditChatTitle = useCallback((chatId: string, currentTitle: string) => {
    if (isAnonymousUser) return;
    
    setEditingChatId(chatId)
    setEditingTitle(currentTitle)
    setTimeout(() => {
      if (titleInputRef.current) {
        titleInputRef.current.focus()
        titleInputRef.current.select()
      }
    }, 0)
  }, [isAnonymousUser])

  const handleSaveChatTitle = useCallback(async () => {
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

  const searchChats = useCallback(async (term: string) => {
    if (!user || !term.trim()) {
      setIsSearching(false);
      return;
    }
    
    const search = term.toLowerCase();
    
    if (searchCache.has(search)) {
      setSearchResults(searchCache.get(search) || []);
      setIsSearching(false);
      return;
    }
    
    setIsSearching(true);
    const searchStartTime = performance.now();
    try {
      let { data: titleResults, error: titleError } = await supabase
        .rpc('search_chat_sessions_pgroonga', {
          search_term: search,
          user_id_param: user.id,
          limit_param: 30
        });

      if (titleError) {
        console.error('Title search error (PGroonga may not be enabled):', titleError);
        const { data: fallbackTitleResults, error: fallbackTitleError } = await supabase
          .from('chat_sessions')
          .select('id, created_at, title, current_model, initial_message, last_activity_at')
          .eq('user_id', user.id)
          .or(`title.ilike.%${search}%,initial_message.ilike.%${search}%`)
          .order('created_at', { ascending: false })
          .limit(30);
        
        if (fallbackTitleError) {
          console.error('Fallback title search error:', fallbackTitleError);
          setSearchResults([]);
          return;
        }
        
        titleResults = fallbackTitleResults;
      }

      let { data: messageResults, error: messageError } = await supabase
        .rpc('search_messages_pgroonga', {
          search_term: search,
          user_id_param: user.id,
          limit_param: 100
        });

      if (messageError) {
        console.error('Message search error (PGroonga may not be enabled):', messageError);
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
        
        messageResults = fallbackMessageResults;
      }

      const messageSessionIds = messageResults 
        ? [...new Set(messageResults.map((msg: any) => msg.chat_session_id))]
        : [];

      const allMessageSessionIds = [...new Set(messageSessionIds)];

      const existingSessionIds = new Set((titleResults || []).map((s: any) => s.id));
      const newSessionIds = allMessageSessionIds.filter(id => !existingSessionIds.has(id));
      
      const { data: messageSessionResults, error: sessionError } = newSessionIds.length > 0 
        ? await supabase
            .from('chat_sessions')
            .select('id, created_at, title, current_model, initial_message, last_activity_at')
            .eq('user_id', user.id)
            .in('id', newSessionIds)
        : { data: [], error: null };

      if (sessionError) {
        console.error('Session fetch error:', sessionError);
        setSearchResults([]);
        return;
      }

      const allSessions = [...(titleResults || []), ...(messageSessionResults || [])];
      const uniqueSessions = allSessions.filter((session: any, index: number, self: any[]) => 
        index === self.findIndex((s: any) => s.id === session.id)
      );

      const processedChats = uniqueSessions.map((session) => {
        const sessionMessages = messageResults?.filter((msg: any) => msg.chat_session_id === session.id) || [];
        
        const firstUserMsg = sessionMessages
          .filter((msg: any) => msg.role === 'user')
          .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0];
        
        const latestMsg = sessionMessages
          .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

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
        
        const searchTermLower = search.toLowerCase();
        let lastMessage = '';
        const baseActivityIso = session.last_activity_at || session.created_at;
        let lastMessageTime = toEpochMs(baseActivityIso);
        let resolvedActivityIso = baseActivityIso;

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
        
        if (!lastMessage) {
          const latestMatchingMessage = sessionMessages.length > 0 ? sessionMessages[0] : null;

          if (latestMatchingMessage) {
            lastMessage = createSnippet(latestMatchingMessage.content, search);
            lastMessageTime = toEpochMs(latestMatchingMessage.created_at) || lastMessageTime;
            resolvedActivityIso = latestMatchingMessage.created_at || resolvedActivityIso;
          } else if (session.initial_message && session.initial_message.toLowerCase().includes(searchTermLower)) {
            lastMessage = createSnippet(session.initial_message, search);
          } else {
            const fallbackPreview = latestMsg ? latestMsg.content : (session.initial_message || '');
            lastMessage = fallbackPreview.length > 100 ? fallbackPreview.substring(0, 100) + '...' : fallbackPreview;
            if (latestMsg?.created_at) {
              lastMessageTime = toEpochMs(latestMsg.created_at) || lastMessageTime;
              resolvedActivityIso = latestMsg.created_at;
            }
          }
        }

        const currentModel = session.current_model || (latestMsg ? latestMsg.model : null);

        return {
          id: session.id,
          title: title,
          created_at: session.created_at,
          messages: [],
          lastMessageTime: lastMessageTime,
          lastMessage: lastMessage,
          current_model: currentModel,
          last_activity_at: resolvedActivityIso
        } as Chat;
      });

      processedChats.sort((a, b) => {
        const aStructuredMatch = a.lastMessage?.startsWith('📋');
        const bStructuredMatch = b.lastMessage?.startsWith('📋');
        
        if (aStructuredMatch && !bStructuredMatch) return -1;
        if (!aStructuredMatch && bStructuredMatch) return 1;
        
        const aTitleMatch = a.title.toLowerCase().includes(search);
        const bTitleMatch = b.title.toLowerCase().includes(search);
        
        if (aTitleMatch && !bTitleMatch) return -1;
        if (!aTitleMatch && bTitleMatch) return 1;
        
        const timeA = a.lastMessageTime ?? 0;
        const timeB = b.lastMessageTime ?? 0;
        return timeB - timeA;
      });

      setSearchCache(prev => new Map(prev).set(search, processedChats));
      setSearchResults(processedChats);
      
      const searchEndTime = performance.now();
      const searchDuration = searchEndTime - searchStartTime;
      const usedPGroonga = !titleError && !messageError;
      console.log(`🔍 ${usedPGroonga ? 'PGroonga' : 'ILIKE'} search completed in ${searchDuration.toFixed(2)}ms for term: "${search}" (${processedChats.length} results)`);
      
    } catch (error) {
      console.error('Error searching chats:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [user?.id, searchCache]);

  const clearSearch = useCallback(() => {
    setSearchTerm('');
    setSearchResults([]);
    setIsSearching(false);
    
    setSearchCache(prev => {
      const newCache = new Map(prev);
      if (newCache.size > 50) {
        const entries = Array.from(newCache.entries());
        const recentEntries = entries.slice(-50);
        return new Map(recentEntries);
      }
      return newCache;
    });
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchTerm.trim()) {
        const trimmedTerm = searchTerm.trim().toLowerCase();
        
        if (searchCache.has(trimmedTerm)) {
          setSearchResults(searchCache.get(trimmedTerm) || []);
          setIsSearching(false);
          return;
        }
        
        const partialMatches = Array.from(searchCache.keys()).filter(key => 
          key.includes(trimmedTerm) || trimmedTerm.includes(key)
        );
        
        if (partialMatches.length > 0) {
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
        
        searchChats(searchTerm);
      } else {
        setSearchResults([]);
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchTerm, searchCache]);

  const displayChats = useMemo(() => {
    return searchTerm.trim() ? searchResults : chats;
  }, [searchTerm, searchResults, chats]);

  const [hasAutoSelected, setHasAutoSelected] = useState(false);
  
  useEffect(() => {
    if (searchTerm.trim() && searchResults.length > 0 && !isSearching && !hasAutoSelected) {
      const firstResult = searchResults[0];
      if (pathname !== `/chat/${firstResult.id}`) {
        const searchParams = new URLSearchParams();
        searchParams.set('search', searchTerm);
        router.push(`/chat/${firstResult.id}?${searchParams.toString()}`);
        setHasAutoSelected(true);
      }
    }
  }, [searchResults, searchTerm, isSearching, pathname, router, hasAutoSelected]);

  useEffect(() => {
    setHasAutoSelected(false);
  }, [searchTerm]);

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

  useEffect(() => {
    if (!pathname.startsWith('/chat/') && pathname !== '/') {
      clearSearch();
    }
  }, [pathname, clearSearch]);

  useEffect(() => {
    return () => {
      clearSearch();
    };
  }, [clearSearch]);

  if (!user) {
    return null;
  }

  return (
    <div 
      ref={sidebarRef}
      className={`${isMobile ? 'w-full' : 'w-96'} h-full bg-background flex flex-col items-center overflow-hidden relative`}
    >
      <div className="h-full flex flex-col w-full overflow-x-hidden">
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto overflow-x-hidden sidebar-scroll w-full mt-0 md:mt-0 px-4 md:px-3 relative pb-24">
          <div className="px-2 py-2 pt-16 sm:pt-16">
            <h2 className="font-bold text-2xl">{translations.messages}</h2>
          </div>
          
          {useMemo(() => {
            return (
            <div className="space-y-3">
              <div className="space-y-0.5">
              {isAnonymousUser ? (
                <div className="px-4 py-6">
                  <div className="space-y-2 mb-6">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="group relative block transition-all p-3 rounded-lg opacity-60 hover:opacity-80">
                        <div className="flex items-center gap-3 w-full">
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
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-baseline gap-1">
                              <p className="text-sm font-semibold truncate text-[var(--muted)]" style={{ maxWidth: 'calc(100% - 0px)' }}>
                                {i === 1 ? 'Where do socks go after laundry?' : i === 2 ? 'How do I find Nemo?' : 'Why is my WiFi so slow?'}
                              </p>
                              <span className="text-xs flex-shrink-0 text-[var(--muted)]/60">
                                {i === 1 ? '2h' : i === 2 ? '1d' : '3d'}
                              </span>
                            </div>
                            <p className="text-xs truncate pr-2 text-[var(--muted)]/60 mt-1">
                              {i === 1 ? 'Lost 7 socks this week. Is there a portal in my washer?' : i === 2 ? 'I\'ve been looking for Nemo for 3 hours, where is he?' : 'My internet is slower than a snail, help me!'}
                            </p>
                          </div>
                          
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
                    {isSearching && (
                      <div className="flex flex-col items-center py-4 space-y-2">
                        <div className="w-6 h-6 border-2 border-t-transparent border-[var(--foreground)] rounded-full animate-spin"></div>
                        <span className="text-xs text-[var(--muted)]">Searching all conversations...</span>
                      </div>
                    )}
                    
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
                            
                            const modelConfig = getModelById(model);
                            if (modelConfig) {
                              return modelConfig.name;
                            }
                            
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
                                    if (isMobile && toggleSidebar) {
                                      toggleSidebar();
                                    }
                                    
                                    setHasAutoSelected(true);
                                    
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
                                  <div className="flex-shrink-0">
                                    {(() => {
                                      const modelConfig = getModelConfig(chat.current_model);
                                      const avatarBg = isSelected ? 'bg-white/25' : 'bg-[var(--accent)]';
                                      const isChatflix = modelConfig?.id && isChatflixModel(modelConfig.id);
                                      const useDarkLogo = isSelected || isDark;
                                      const chatflixLogo = getChatflixLogo({ isDark: useDarkLogo });
                                      return (
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${avatarBg}`}>
                                          {modelConfig?.provider && hasLogo(modelConfig.provider, modelConfig.id) ? (
                                            <Image 
                                              src={isChatflix ? chatflixLogo : getProviderLogo(modelConfig.provider, modelConfig.id || undefined)}
                                              alt={`${modelConfig.provider} logo`}
                                              width={isChatflix ? 28 : 20}
                                              height={isChatflix ? 28 : 20}
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
                                  
                                  <div className="flex-1 min-w-0 overflow-hidden border-b border-[var(--sidebar-divider)] pb-6 pt-3">
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
                                          className={`text-sm font-semibold truncate pr-2 min-w-0 max-w-[240px] ${ 
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
                                    <div className="flex justify-between items-end">
                                      <p className={`text-xs truncate pr-2 min-w-0 ${ 
                                        isSelected ? 'text-white/70' : 'text-[var(--muted)]'
                                      }`}>
                                        {searchTerm && chat.lastMessage 
                                          ? highlightSearchTerm(chat.lastMessage, searchTerm, { isSelected })
                                          : chat.lastMessage || 'No messages yet'}
                                      </p>
                                      
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
                className="flex items-center justify-center w-12 h-12 rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
                style={{
                  ...(document.documentElement.getAttribute('data-theme') === 'dark' || 
                      (document.documentElement.getAttribute('data-theme') === 'system' && 
                       window.matchMedia('(prefers-color-scheme: dark)').matches) ? {
                    backgroundColor: typeof window !== 'undefined' && window.innerWidth <= 768 ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.7)',
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    boxShadow: '0 8px 40px rgba(0, 0, 0, 0.15), 0 4px 20px rgba(0, 0, 0, 0.1), 0 2px 8px rgba(0, 0, 0, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                  } : {
                    backgroundColor: typeof window !== 'undefined' && window.innerWidth <= 768 ? 'rgba(255, 255, 255, 0.6)' : 'rgba(255, 255, 255, 0.8)',
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    boxShadow: '0 8px 40px rgba(0, 0, 0, 0.06), 0 4px 20px rgba(0, 0, 0, 0.04), 0 2px 8px rgba(0, 0, 0, 0.025), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
                  })
                }}
                title="Edit Title"
              >
                <Edit size={20} />
              </button>
              <button
                onClick={handleDeleteSelected}
                disabled={selectedChatIds.length === 0}
                className="flex items-center justify-center w-12 h-12 rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
                style={{
                  ...(document.documentElement.getAttribute('data-theme') === 'dark' || 
                      (document.documentElement.getAttribute('data-theme') === 'system' && 
                       window.matchMedia('(prefers-color-scheme: dark)').matches) ? {
                    backgroundColor: typeof window !== 'undefined' && window.innerWidth <= 768 ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.7)',
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    boxShadow: '0 8px 40px rgba(0, 0, 0, 0.15), 0 4px 20px rgba(0, 0, 0, 0.1), 0 2px 8px rgba(0, 0, 0, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                  } : {
                    backgroundColor: typeof window !== 'undefined' && window.innerWidth <= 768 ? 'rgba(255, 255, 255, 0.6)' : 'rgba(255, 255, 255, 0.8)',
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    boxShadow: '0 8px 40px rgba(0, 0, 0, 0.06), 0 4px 20px rgba(0, 0, 0, 0.04), 0 2px 8px rgba(0, 0, 0, 0.025), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
                  })
                }}
                title="Delete"
              >
                <Trash2 size={20} />
              </button>
            </div>
          ) : (
            <>
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
                        ...(document.documentElement.getAttribute('data-theme') === 'dark' || 
                            (document.documentElement.getAttribute('data-theme') === 'system' && 
                             window.matchMedia('(prefers-color-scheme: dark)').matches) ? {
                          backgroundColor: typeof window !== 'undefined' && window.innerWidth <= 768 ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.8)',
                          backdropFilter: 'blur(10px)',
                          WebkitBackdropFilter: 'blur(10px)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          boxShadow: '0 8px 40px rgba(0, 0, 0, 0.3), 0 4px 20px rgba(0, 0, 0, 0.2), 0 2px 8px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                        } : {
                          backgroundColor: typeof window !== 'undefined' && window.innerWidth <= 768 ? 'rgba(255, 255, 255, 0.6)' : 'rgba(255, 255, 255, 0.9)',
                          backdropFilter: 'blur(10px)',
                          WebkitBackdropFilter: 'blur(10px)',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          boxShadow: '0 8px 40px rgba(0, 0, 0, 0.06), 0 4px 20px rgba(0, 0, 0, 0.04), 0 2px 8px rgba(0, 0, 0, 0.025), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
                        })
                      }}
                      disabled={isAnonymousUser}
                    />
                  </div>
                  
                  <button
                    onClick={() => {
                      if (pathname === '/chat') {
                        window.dispatchEvent(new CustomEvent('requestNewChat'));
                      } else {
                        router.push('/chat');
                      }
                      if (isMobile && toggleSidebar) {
                        toggleSidebar();
                      }
                    }}
                    className="flex items-center justify-center w-10 h-10 rounded-full transition-all duration-300 cursor-pointer"
                    style={{
                      color: 'var(--foreground)',
                      ...(document.documentElement.getAttribute('data-theme') === 'dark' || 
                          (document.documentElement.getAttribute('data-theme') === 'system' && 
                           window.matchMedia('(prefers-color-scheme: dark)').matches) ? {
                        backgroundColor: typeof window !== 'undefined' && window.innerWidth <= 768 ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.7)',
                        backdropFilter: 'blur(10px)',
                        WebkitBackdropFilter: 'blur(10px)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        boxShadow: '0 8px 40px rgba(0, 0, 0, 0.3), 0 4px 20px rgba(0, 0, 0, 0.2), 0 2px 8px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                      } : {
                        backgroundColor: typeof window !== 'undefined' && window.innerWidth <= 768 ? 'rgba(255, 255, 255, 0.6)' : 'rgba(255, 255, 255, 0.8)',
                        backdropFilter: 'blur(10px)',
                        WebkitBackdropFilter: 'blur(10px)',
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
      {/* <SubscriptionDialog
        isOpen={isSubscriptionOpen}
        onClose={() => setIsSubscriptionOpen(false)}
        user={user}
      /> */}
    </div>
  )
}

