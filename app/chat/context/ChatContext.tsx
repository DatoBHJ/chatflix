'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Chat } from '@/lib/types'
import { deleteChat } from '@/app/chat/[id]/utils'

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

interface ChatContextType {
  user: any
  isLoading: boolean
  chats: Chat[]
  setChats: React.Dispatch<React.SetStateAction<Chat[]>>
  searchQuery: string
  setSearchQuery: (query: string) => void
  searchResults: Chat[]
  setSearchResults: React.Dispatch<React.SetStateAction<Chat[]>>
  isSearching: boolean
  setIsSearching: React.Dispatch<React.SetStateAction<boolean>>
  // Pagination
  currentPage: number
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>
  hasMore: boolean
  setHasMore: React.Dispatch<React.SetStateAction<boolean>>
  isLoadingMore: boolean
  setIsLoadingMore: React.Dispatch<React.SetStateAction<boolean>>
  initialLoadComplete: boolean
  setInitialLoadComplete: React.Dispatch<React.SetStateAction<boolean>>
  // Chat operations
  loadChats: (page?: number, append?: boolean, forceRefresh?: boolean) => Promise<void>
  handleDeleteChat: (chatId: string, e?: React.MouseEvent) => Promise<void>
  handleEditChatTitle: (chatId: string, currentTitle: string) => void
  handleSaveChatTitle: () => Promise<void>
  handleCancelChatTitleEdit: () => void
  // Chat title editing
  editingChatId: string | null
  editingTitle: string
  setEditingTitle: React.Dispatch<React.SetStateAction<string>>
  // Search cache
  searchCache: Map<string, Chat[]>
  setSearchCache: React.Dispatch<React.SetStateAction<Map<string, Chat[]>>>
  searchChats: (term: string) => Promise<void>
  clearSearch: () => void
  // Real-time updates
  currentTime: number
}

const ChatContext = createContext<ChatContextType | undefined>(undefined)

export function useChatApp() {
  const context = useContext(ChatContext)
  if (context === undefined) {
    throw new Error('useChatApp must be used within a ChatProvider')
  }
  return context
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [chats, setChats] = useState<Chat[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Chat[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchCache, setSearchCache] = useState<Map<string, Chat[]>>(new Map())
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [initialLoadComplete, setInitialLoadComplete] = useState(false)
  const CHATS_PER_PAGE = 15
  
  // Chat title editing
  const [editingChatId, setEditingChatId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const titleInputRef = useRef<HTMLInputElement>(null)
  
  // Optimization
  const [lastLoadedUserId, setLastLoadedUserId] = useState<string | null>(null)
  const [isChatsLoaded, setIsChatsLoaded] = useState(false)
  const lastLoadTimeRef = useRef<number>(0)
  const CACHE_DURATION = 10 * 60 * 1000 // 10 minute cache
  
  // Real-time updates
  const [currentTime, setCurrentTime] = useState(Date.now())
  
  const supabase = createClient()
  
  // 🚀 익명 사용자 지원
  const isAnonymousUser = user?.isAnonymous || user?.id === 'anonymous'

  // Load user on mount
  useEffect(() => {
    const loadUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        
        if (!user) {
          const guestUser = {
            id: 'anonymous',
            email: 'guest@chatflix.app',
            user_metadata: {
              full_name: 'Guest User',
              name: 'Guest'
            },
            isAnonymous: true
          }
          setUser(guestUser)
        } else {
          setUser(user)
        }
      } catch (error) {
        console.error('Error loading user:', error)
        const guestUser = {
          id: 'anonymous',
          email: 'guest@chatflix.app',
          user_metadata: {
            full_name: 'Guest User',
            name: 'Guest'
          },
          isAnonymous: true
        }
        setUser(guestUser)
      } finally {
        setIsLoading(false)
      }
    }

    loadUser()
  }, [supabase])

  // Real-time update
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now())
    }, 60000) // Update every minute

    return () => clearInterval(interval)
  }, [])

  // Load chats when user changes
  useEffect(() => {
    if (!user?.id || isAnonymousUser) {
      setChats([])
      setInitialLoadComplete(true)
      return
    }

    // Skip if already loaded for this user
    if (lastLoadedUserId === user.id && isChatsLoaded) {
      return
    }

    loadChats(1, false, false)
  }, [user?.id, isAnonymousUser])

  // Real-time updates for chat sessions
  useEffect(() => {
    if (!user?.id || isAnonymousUser) return

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
          console.log('🔄 [ChatContext] Real-time update received:', payload)
          
          if (payload.eventType === 'UPDATE') {
            const updatedSession = payload.new
            if (updatedSession?.id) {
              setChats(prevChats => {
                const mapped = prevChats.map(chat => {
                  if (chat.id !== updatedSession.id) return chat

                  const nextLastActivity =
                    updatedSession.last_activity_at ||
                    chat.last_activity_at ||
                    chat.created_at

                  return {
                    ...chat,
                    title: updatedSession.title ?? chat.title,
                    current_model: updatedSession.current_model ?? chat.current_model,
                    last_activity_at: nextLastActivity,
                    lastMessageTime: deriveSessionActivity({
                      last_activity_at: nextLastActivity,
                      created_at: chat.created_at
                    })
                  }
                })

                return sortChatsByActivity(mapped)
              })
            }
          } else if (payload.eventType === 'INSERT' || payload.eventType === 'DELETE') {
            loadChats(1, false, true)
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
    if (!user?.id || isAnonymousUser) {
      return
    }
    
    const handleNewChat = (event: CustomEvent) => {
      const chatData = event.detail
      console.log('🚀 [ChatContext] New chat event received:', chatData)
      
      if (!chatData?.id) {
        return
      }
      
      setChats(prevChats => {
        const existingChat = prevChats.find(chat => chat.id === chatData.id)
        if (existingChat) {
          return prevChats
        }
        
        let title = chatData.title
        if (!title && chatData.initial_message) {
          const message = chatData.initial_message.trim()
          title = message.length > 45 ? message.slice(0, 45) + '...' : message
        }
        
        const lastActivityIso = chatData.last_activity_at || chatData.created_at
        const lastActivityMs = toEpochMs(lastActivityIso)

        const newChat: Chat = {
          id: chatData.id,
          title: title || 'New Chat',
          created_at: chatData.created_at,
          messages: [],
          lastMessageTime: lastActivityMs,
          lastMessage: chatData.initial_message || '',
          current_model: chatData.current_model,
          last_activity_at: lastActivityIso
        }
        
        return sortChatsByActivity([newChat, ...prevChats])
      })
    }

    const handleChatTitleUpdated = (event: CustomEvent) => {
      const { id, title } = event.detail
      console.log('🚀 [ChatContext] Chat title update event received:', { id, title })
      
      if (!id || !title?.trim()) {
        return
      }
      
      setChats(prevChats => 
        prevChats.map(chat => 
          chat.id === id ? { ...chat, title: title.trim() } : chat
        )
      )
    }

    window.addEventListener('newChatCreated', handleNewChat as EventListener)
    window.addEventListener('chatTitleUpdated', handleChatTitleUpdated as EventListener)

    return () => {
      window.removeEventListener('newChatCreated', handleNewChat as EventListener)
      window.removeEventListener('chatTitleUpdated', handleChatTitleUpdated as EventListener)
    }
  }, [user?.id, isAnonymousUser])

  const loadChats = useCallback(async (page = 1, append = false, forceRefresh = false) => {
    if (!user || isAnonymousUser) return
    
    const now = Date.now()
    const isCacheValid = now - lastLoadTimeRef.current < CACHE_DURATION
    
    if (!forceRefresh && page === 1 && !append && lastLoadedUserId === user.id && isCacheValid) {
      console.log('[ChatContext] Using cached chat data')
      return
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

      const sessionIds = sessions.map(s => s.id)
      let firstMessages: Record<string, string> = {}
      
      if (sessionIds.length > 0) {
        const { data: messagesData } = await supabase
          .from('messages')
          .select('chat_session_id, content')
          .in('chat_session_id', sessionIds)
          .eq('role', 'user')
          .order('created_at', { ascending: true })
        
        if (messagesData) {
          const firstMsgMap: Record<string, string> = {}
          messagesData.forEach(msg => {
            if (!firstMsgMap[msg.chat_session_id]) {
              firstMsgMap[msg.chat_session_id] = msg.content
            }
          })
          firstMessages = firstMsgMap
        }
      }

      const newChats = sessions.map((session) => {
        const title = session.title && session.title.trim().length > 0
          ? session.title
          : 'New Chat'
        
        const activityTimestamp = deriveSessionActivity(session)
        const firstMessage = firstMessages[session.id] || ''
        const truncatedFirstMessage = firstMessage.length > 100 
          ? firstMessage.substring(0, 100) + '...' 
          : firstMessage

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
  }, [user, lastLoadedUserId, isAnonymousUser, supabase])

  const handleDeleteChat = useCallback(async (chatId: string, e?: React.MouseEvent) => {
    if (isAnonymousUser) return
    
    if (e) {
      e.stopPropagation()
    }
    
    try {
      await deleteChat(chatId)
      setChats(prevChats => prevChats.filter(chat => chat.id !== chatId))
    } catch (error) {
      console.error('Failed to delete chat:', error)
      alert('Failed to delete chat.')
    }
  }, [isAnonymousUser])

  const handleEditChatTitle = useCallback((chatId: string, currentTitle: string) => {
    if (isAnonymousUser) return
    
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
    if (isAnonymousUser) return
    
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

  // Search chats - full implementation
  const searchChats = useCallback(async (term: string) => {
    if (!user || !term.trim()) {
      setIsSearching(false)
      return
    }
    
    const search = term.toLowerCase()
    
    // Check cache first
    if (searchCache.has(search)) {
      setSearchResults(searchCache.get(search) || [])
      setIsSearching(false)
      return
    }
    
    setIsSearching(true)
    const searchStartTime = performance.now()
    try {
      // Use PGroonga for multilingual full-text search
      let { data: titleResults, error: titleError } = await supabase
        .rpc('search_chat_sessions_pgroonga', {
          search_term: search,
          user_id_param: user.id,
          limit_param: 30
        })

      if (titleError) {
        // Fallback to ILIKE
        const { data: fallbackTitleResults, error: fallbackTitleError } = await supabase
          .from('chat_sessions')
          .select('id, created_at, title, current_model, initial_message, last_activity_at')
          .eq('user_id', user.id)
          .or(`title.ilike.%${search}%,initial_message.ilike.%${search}%`)
          .order('created_at', { ascending: false })
          .limit(30)
        
        if (fallbackTitleError) {
          setSearchResults([])
          return
        }
        
        titleResults = fallbackTitleResults
      }

      // Search by message content
      let { data: messageResults, error: messageError } = await supabase
        .rpc('search_messages_pgroonga', {
          search_term: search,
          user_id_param: user.id,
          limit_param: 100
        })

      if (messageError) {
        const { data: fallbackMessageResults, error: fallbackMessageError } = await supabase
          .from('messages')
          .select('chat_session_id, content, created_at, role, model')
          .eq('user_id', user.id)
          .ilike('content', `%${search}%`)
          .order('created_at', { ascending: false })
          .limit(100)
        
        if (fallbackMessageError) {
          setSearchResults([])
          return
        }
        
        messageResults = fallbackMessageResults
      }

      const messageSessionIds = messageResults 
        ? [...new Set(messageResults.map((msg: any) => msg.chat_session_id))]
        : []

      const allMessageSessionIds = [...new Set(messageSessionIds)]
      const existingSessionIds = new Set((titleResults || []).map((s: any) => s.id))
      const newSessionIds = allMessageSessionIds.filter(id => !existingSessionIds.has(id))
      
      const { data: messageSessionResults, error: sessionError } = newSessionIds.length > 0 
        ? await supabase
            .from('chat_sessions')
            .select('id, created_at, title, current_model, initial_message, last_activity_at')
            .eq('user_id', user.id)
            .in('id', newSessionIds)
        : { data: [], error: null }

      if (sessionError) {
        setSearchResults([])
        return
      }

      const allSessions = [...(titleResults || []), ...(messageSessionResults || [])]
      const uniqueSessions = allSessions.filter((session: any, index: number, self: any[]) => 
        index === self.findIndex((s: any) => s.id === session.id)
      )

      const createSnippet = (text: string, term: string, contextLength = 20) => {
        const textLower = text.toLowerCase()
        const searchWords = term.toLowerCase().trim().split(/\s+/).filter(word => word.length > 0)
        
        let firstMatchIndex = -1
        for (const word of searchWords) {
          const index = textLower.indexOf(word)
          if (index !== -1) {
            firstMatchIndex = index
            break
          }
        }

        if (firstMatchIndex === -1) {
          return text.length > 100 ? text.substring(0, 100) + '...' : text
        }

        const start = Math.max(0, firstMatchIndex - contextLength)
        const end = Math.min(text.length, firstMatchIndex + searchWords[0].length + contextLength)
        
        let snippet = text.substring(start, end)
        if (start > 0) snippet = '...' + snippet
        if (end < text.length) snippet = snippet + '...'
        return snippet
      }

      const processedChats = uniqueSessions.map((session: any) => {
        const sessionMessages = messageResults?.filter((msg: any) => msg.chat_session_id === session.id) || []
        
        const firstUserMsg = sessionMessages
          .filter((msg: any) => msg.role === 'user')
          .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0]
        
        const latestMsg = sessionMessages
          .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]

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
                  : 'Untitled Chat'))
        
        const searchTermLower = search.toLowerCase()
        let lastMessage = ''
        const baseActivityIso = session.last_activity_at || session.created_at
        let lastMessageTime = toEpochMs(baseActivityIso)
        let resolvedActivityIso = baseActivityIso
        
        if (!lastMessage) {
          const latestMatchingMessage = sessionMessages.length > 0 ? sessionMessages[0] : null

          if (latestMatchingMessage) {
            lastMessage = createSnippet(latestMatchingMessage.content, term)
            lastMessageTime = toEpochMs(latestMatchingMessage.created_at) || lastMessageTime
            resolvedActivityIso = latestMatchingMessage.created_at || resolvedActivityIso
          } else if (session.initial_message && session.initial_message.toLowerCase().includes(searchTermLower)) {
            lastMessage = createSnippet(session.initial_message, term)
          } else {
            const fallbackPreview = latestMsg ? latestMsg.content : (session.initial_message || '')
            lastMessage = fallbackPreview.length > 100 ? fallbackPreview.substring(0, 100) + '...' : fallbackPreview
            if (latestMsg?.created_at) {
              lastMessageTime = toEpochMs(latestMsg.created_at) || lastMessageTime
              resolvedActivityIso = latestMsg.created_at
            }
          }
        }

        const currentModel = session.current_model || (latestMsg ? latestMsg.model : null)

        return {
          id: session.id,
          title: title,
          created_at: session.created_at,
          messages: [],
          lastMessageTime: lastMessageTime,
          lastMessage: lastMessage,
          current_model: currentModel,
          last_activity_at: resolvedActivityIso
        } as Chat
      })

      processedChats.sort((a, b) => {
        const aStructuredMatch = a.lastMessage?.startsWith('📋')
        const bStructuredMatch = b.lastMessage?.startsWith('📋')
        
        if (aStructuredMatch && !bStructuredMatch) return -1
        if (!aStructuredMatch && bStructuredMatch) return 1
        
        const aTitleMatch = a.title.toLowerCase().includes(search)
        const bTitleMatch = b.title.toLowerCase().includes(search)
        
        if (aTitleMatch && !bTitleMatch) return -1
        if (!aTitleMatch && bTitleMatch) return 1
        
        const timeA = a.lastMessageTime ?? 0
        const timeB = b.lastMessageTime ?? 0
        return timeB - timeA
      })

      setSearchCache(prev => new Map(prev).set(search, processedChats))
      setSearchResults(processedChats)
      
      const searchEndTime = performance.now()
      const searchDuration = searchEndTime - searchStartTime
      console.log(`🔍 Search completed in ${searchDuration.toFixed(2)}ms for term: "${search}" (${processedChats.length} results)`)
      
    } catch (error) {
      console.error('Error searching chats:', error)
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }, [user, searchCache, supabase])

  const clearSearch = useCallback(() => {
    setSearchQuery('')
    setSearchResults([])
    setIsSearching(false)
    
    setSearchCache(prev => {
      const newCache = new Map(prev)
      if (newCache.size > 50) {
        const entries = Array.from(newCache.entries())
        const recentEntries = entries.slice(-50)
        return new Map(recentEntries)
      }
      return newCache
    })
  }, [])

  // Effect to load chats when needed
  const isChatsLoadedRef = useRef(false)
  const loadingRef = useRef(false)
  isChatsLoadedRef.current = isChatsLoaded

  useEffect(() => {
    if (user && !isChatsLoadedRef.current && !loadingRef.current) {
      loadingRef.current = true
      loadChats(1, false, true).finally(() => {
        loadingRef.current = false
      })
    }
  }, [user, loadChats])

  return (
    <ChatContext.Provider
      value={{
        user,
        isLoading,
        chats,
        setChats,
        searchQuery,
        setSearchQuery,
        searchResults,
        setSearchResults,
        isSearching,
        setIsSearching,
        currentPage,
        setCurrentPage,
        hasMore,
        setHasMore,
        isLoadingMore,
        setIsLoadingMore,
        initialLoadComplete,
        setInitialLoadComplete,
        loadChats,
        handleDeleteChat,
        handleEditChatTitle,
        handleSaveChatTitle,
        handleCancelChatTitleEdit,
        editingChatId,
        editingTitle,
        setEditingTitle,
        searchCache,
        setSearchCache,
        searchChats,
        clearSearch,
        currentTime
      }}
    >
      {children}
    </ChatContext.Provider>
  )
}

