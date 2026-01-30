'use client'

import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useChatApp } from '../context/ChatContext'
import { getModelById, isChatflixModel } from '@/lib/models/config'
import { getProviderLogo, hasLogo, getChatflixLogo } from '@/lib/models/logoUtils'
import { highlightSearchTerm } from '@/app/utils/searchHighlight'

interface ChatListProps {
  onChatClick?: () => void
  showSearch?: boolean
  className?: string
}

export function ChatList({ onChatClick, showSearch = false, className = '' }: ChatListProps) {
  const router = useRouter()
  const pathname = usePathname()
  const {
    chats,
    searchQuery,
    setSearchQuery,
    searchResults,
    isSearching,
    hasMore,
    isLoadingMore,
    initialLoadComplete,
    currentTime,
    editingChatId,
    editingTitle,
    setEditingTitle,
    handleEditChatTitle,
    handleSaveChatTitle,
    handleDeleteChat,
    handleCancelChatTitleEdit,
    loadChats,
    currentPage,
    searchChats,
    clearSearch,
    user
  } = useChatApp()

  const [isDark, setIsDark] = useState(false)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const loadMoreTriggerRef = useRef<HTMLDivElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const isAnonymousUser = user?.isAnonymous || user?.id === 'anonymous'

  // Theme detection
  useEffect(() => {
    const checkTheme = () => {
      const theme = document.documentElement.getAttribute('data-theme')
      const isDarkMode = theme === 'dark' || 
        (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
      setIsDark(isDarkMode)
    }
    
    checkTheme()
    
    const observer = new MutationObserver(checkTheme)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    })
    
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    mediaQuery.addEventListener('change', checkTheme)
    
    return () => {
      observer.disconnect()
      mediaQuery.removeEventListener('change', checkTheme)
    }
  }, [])

  // Handle search term changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery.trim()) {
        const trimmedTerm = searchQuery.trim().toLowerCase()
        searchChats(searchQuery)
      } else {
        clearSearch()
      }
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [searchQuery, searchChats, clearSearch])

  // Infinite scroll
  useEffect(() => {
    if (initialLoadComplete && hasMore && !searchQuery) {
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
  }, [initialLoadComplete, currentPage, isLoadingMore, hasMore, searchQuery, loadChats])

  const handleChatTitleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSaveChatTitle()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleCancelChatTitleEdit()
    }
  }, [handleSaveChatTitle, handleCancelChatTitleEdit])

  const displayChats = useMemo(() => {
    return searchQuery.trim() ? searchResults : chats
  }, [searchQuery, searchResults, chats])

  const getModelConfig = (model: string | null | undefined) => {
    if (!model) return null
    return getModelById(model)
  }

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {showSearch && (
        <div className="px-4 py-3 border-b border-[var(--sidebar-divider)]">
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            className="w-full px-4 py-2.5 text-sm rounded-full placeholder-[var(--muted)] focus:outline-none transition-all bg-[var(--accent)]"
          />
        </div>
      )}

      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {isSearching && (
          <div className="flex flex-col items-center py-4 space-y-2">
            <div className="w-6 h-6 border-2 border-t-transparent border-[var(--foreground)] rounded-full animate-spin"></div>
            <span className="text-xs text-[var(--muted)]">Searching all conversations...</span>
          </div>
        )}
        
        {searchQuery && !isSearching && displayChats.length > 0 && (
          <div className="px-4 py-2 text-xs text-[var(--muted)] text-center">
            Found {displayChats.length} conversation{displayChats.length !== 1 ? 's' : ''}
          </div>
        )}
        
        {!isSearching && displayChats.length > 0 ? (
          <>
            {displayChats.map((chat) => {
              const isSelected = pathname === `/chat/${chat.id}`
              
              return (
                <div key={chat.id} className="flex items-center transition-all duration-200 min-w-0 py-0">
                  <Link
                    href={editingChatId === chat.id ? '#' : `/chat/${chat.id}`}
                    className={`group relative block transition-all px-3 rounded-lg flex-1 min-w-0 ${
                      editingChatId === chat.id ? 'cursor-default' : 'cursor-pointer'
                    } ${
                      isSelected || (editingChatId === chat.id)
                        ? 'bg-[#007AFF] text-white' 
                        : 'hover:bg-[var(--accent)]'
                    }`}
                    onClick={(e) => {
                      if (editingChatId === chat.id) {
                        e.preventDefault()
                        e.stopPropagation()
                      } else {
                        if (onChatClick) {
                          onChatClick()
                        }
                        
                        if (searchQuery.trim()) {
                          e.preventDefault()
                          const searchParams = new URLSearchParams()
                          searchParams.set('search', searchQuery)
                          router.push(`/chat/${chat.id}?${searchParams.toString()}`)
                        }
                      }
                    }}
                  >
                    <div className="flex items-center gap-3 w-full">
                      {/* Avatar */}
                      <div className="flex-shrink-0">
                        {(() => {
                          const modelConfig = getModelConfig(chat.current_model)
                          const avatarBg = isSelected ? 'bg-white/25' : 'bg-[var(--accent)]'
                          const isChatflix = modelConfig?.id && isChatflixModel(modelConfig.id)
                          const useDarkLogo = isSelected || isDark
                          const chatflixLogo = getChatflixLogo({ isDark: useDarkLogo })
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
                                <div className="w-full h-full flex items-center justify-center rounded-full">
                                  <span className={`text-lg font-semibold ${isSelected ? 'text-white' : 'text-gray-500'}`}>
                                    {modelConfig?.provider ? modelConfig.provider.substring(0, 1).toUpperCase() : 'A'}
                                  </span>
                                </div>
                              )}
                            </div>
                          )
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
                              className={`text-sm font-semibold truncate pr-2 min-w-0 max-w-[240px] ${
                                isSelected ? 'text-white' : 'text-[var(--foreground)]'
                              }`}
                              onDoubleClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                handleEditChatTitle(chat.id, chat.title)
                              }}
                              title="Double-click to edit title"
                            >
                              {searchQuery ? highlightSearchTerm(chat.title, searchQuery, { isSelected }) : chat.title}
                            </p>
                          )}
                          <span className={`text-xs flex-shrink-0 ${
                            isSelected ? 'text-white/80' : 'text-[var(--muted)]'
                          }`}>
                            {(() => {
                              const date = new Date(chat.lastMessageTime || chat.created_at)
                              const diffMs = currentTime - date.getTime()
                              const diffMinutes = Math.floor(diffMs / (1000 * 60))
                              const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
                              const diffDays = Math.floor(diffHours / 24)
                              if (diffMinutes < 1) return 'now'
                              if (diffMinutes < 60) return `${diffMinutes}m`
                              if (diffHours < 24) return `${diffHours}h`
                              if (diffDays === 1) return 'Yesterday'
                              if (diffDays < 7) return date.toLocaleDateString('en-US', { weekday: 'long' })
                              const month = date.getMonth() + 1
                              const day = date.getDate()
                              const year = date.getFullYear().toString().slice(-2)
                              return `${month}/${day}/${year}`
                            })()}
                          </span>
                        </div>
                        {/* Bottom line: Preview + Buttons */}
                        <div className="flex justify-between items-end">
                          <p className={`text-xs truncate pr-2 min-w-0 ${
                            isSelected ? 'text-white/70' : 'text-[var(--muted)]'
                          }`}>
                            {searchQuery && chat.lastMessage 
                              ? highlightSearchTerm(chat.lastMessage, searchQuery, { isSelected })
                              : chat.lastMessage || 'No messages yet'}
                          </p>
                          
                          {/* Action buttons */}
                          <div className={`flex items-center gap-1 transition-opacity ${
                            isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                          }`}>
                            <button 
                              onClick={(e) => { 
                                e.preventDefault()
                                e.stopPropagation()
                                handleEditChatTitle(chat.id, chat.title)
                              }}
                              className={`p-1 rounded-full transition-colors ${
                                isSelected ? 'bg-white/20 hover:bg-white/30' : 'bg-[var(--accent)] hover:bg-[var(--subtle-divider)]'
                              }`}
                              title="Edit title"
                              type="button"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                              </svg>
                            </button>
                            <button 
                              onClick={(e) => { 
                                e.preventDefault()
                                e.stopPropagation()
                                handleDeleteChat(chat.id, e)
                              }}
                              className={`p-1 rounded-full transition-colors ${
                                isSelected ? 'bg-white/20 hover:bg-white/30' : 'bg-[var(--accent)] hover:bg-[var(--subtle-divider)]'
                              }`}
                              title="Delete chat"
                              type="button"
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
              )
            })}

            {/* Infinite scroll trigger */}
            {!searchQuery && hasMore && (
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
              {searchQuery ? 'No matching conversations found' : 'No chats yet'}
            </div>
          )
        )}
      </div>
    </div>
  )
}

