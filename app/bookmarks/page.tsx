'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { getModelById } from '@/lib/models/config';
import { getProviderLogo, hasLogo } from '@/lib/models/logoUtils';
import { User } from '@supabase/supabase-js';
import { getSidebarTranslations } from '../lib/sidebarTranslations';

// 북마크된 메시지 타입 정의
interface BookmarkedMessage {
  id: string;
  message_id: string;
  chat_session_id: string;
  content: string;
  model: string;
  created_at: string;
  timestamp: number;
  chat_title?: string;
}


export default function BookmarksPage() {
  const [messageBookmarks, setMessageBookmarks] = useState<BookmarkedMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [translations, setTranslations] = useState({
    bookmarks: 'Bookmarks',
    messages: 'Messages',
  });
  const supabase = createClient();
  const router = useRouter();
  
  // 최적화를 위한 상태 추가
  const [lastLoadedUserId, setLastLoadedUserId] = useState<string | null>(null);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const lastLoadTimeRef = useRef<number>(0);
  const CACHE_DURATION = 3 * 60 * 1000; // 3분 캐시
  
  // Fetch translations
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setTranslations(getSidebarTranslations() as any);
  }, []);

  // Fetch user data
  useEffect(() => {
    const getUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user);
      } catch (error) {
        console.error('Error loading user:', error);
        setUser(null);
      }
    };

    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
        router.push('/login');
      } else if (event === 'SIGNED_IN') {
        setUser(session?.user || null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, router]);
  
    
    const fetchMessageBookmarks = useCallback(async (forceRefresh = false) => {
      if (!user) {
        return;
      }
      
      // 캐시 확인 - 강제 새로고침이 아니고 캐시가 유효한 경우 스킵
      const now = Date.now();
      const isCacheValid = now - lastLoadTimeRef.current < CACHE_DURATION;
      
      if (!forceRefresh && isCacheValid && isDataLoaded && lastLoadedUserId === user.id && messageBookmarks.length > 0) {
        console.log('[Bookmarks] Using cached message bookmark data');
        return;
      }
      
      try {
        // 사용자가 북마크한 메시지 가져오기
        const { data: bookmarkData, error: bookmarkError } = await supabase
          .from('message_bookmarks')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
          
        if (bookmarkError) {
          console.error('Error fetching message bookmarks:', bookmarkError);
          return;
        }
        
        if (!bookmarkData || bookmarkData.length === 0) {
          setMessageBookmarks([]);
          return;
        }
        
        // Process bookmark data
        const formattedBookmarks = await Promise.all(
          bookmarkData.map(async (bookmark) => {
            // Get actual message content by message ID
            const { data: messageData, error: messageError } = await supabase
              .from('messages')
              .select('content, model, created_at')
              .eq('id', bookmark.message_id)
              .single();
            
            if (messageError) {
              // 메시지가 존재하지 않는 경우 (삭제된 메시지)
              if (messageError.code === 'PGRST116') {
                console.log(`Message ${bookmark.message_id} not found, cleaning up orphaned bookmark`);
                // 삭제된 메시지에 대한 북마크를 자동으로 정리
                try {
                  await supabase
                    .from('message_bookmarks')
                    .delete()
                    .eq('id', bookmark.id);
                } catch (cleanupError) {
                  console.error('Error cleaning up orphaned bookmark:', cleanupError);
                }
                return null;
              }
              console.error('Error fetching message:', messageError);
              return null;
            }
            
            // 채팅 세션 제목 가져오기
            const { data: chatSession, error: chatSessionError } = await supabase
              .from('chat_sessions')
              .select('title')
              .eq('id', bookmark.chat_session_id)
              .single();
            
            // 채팅 세션이 존재하지 않는 경우 처리
            if (chatSessionError && chatSessionError.code === 'PGRST116') {
              console.log(`Chat session ${bookmark.chat_session_id} not found, using fallback title`);
            }
            
            // 채팅 세션에 제목이 없으면 첫 번째 사용자 메시지로 제목 생성
            let chatTitle = chatSession?.title;
            if (!chatTitle || chatTitle.trim() === '') {
              // 채팅 세션이 존재하지 않는 경우 fallback 제목 사용
              if (chatSessionError && chatSessionError.code === 'PGRST116') {
                chatTitle = 'Deleted Chat';
              } else {
                const { data: firstUserMsg } = await supabase
                  .from('messages')
                  .select('content')
                  .eq('chat_session_id', bookmark.chat_session_id)
                  .eq('role', 'user')
                  .order('created_at', { ascending: true })
                  .limit(1)
                  .single();
                
                if (firstUserMsg?.content) {
                  chatTitle = firstUserMsg.content.length > 40 
                    ? firstUserMsg.content.substring(0, 40) + '...'
                    : firstUserMsg.content;
                } else {
                  chatTitle = 'Untitled Chat';
                }
              }
            }
            
            return {
              id: bookmark.id,
              message_id: bookmark.message_id,
              chat_session_id: bookmark.chat_session_id,
              content: messageData.content,
              model: messageData.model,
              created_at: messageData.created_at,
              timestamp: new Date(messageData.created_at).getTime(),
              chat_title: chatTitle
            };
          })
        );
        
        // Filter out null values
        const validBookmarks = formattedBookmarks.filter(bookmark => bookmark !== null) as BookmarkedMessage[];
        
        setMessageBookmarks(validBookmarks);
        
        // 캐시 상태 업데이트
        setIsDataLoaded(true);
        setLastLoadedUserId(user.id);
        lastLoadTimeRef.current = Date.now();
      } catch (error) {
        console.error('Error in fetchMessageBookmarks:', error);
      }
    }, [user, supabase, isDataLoaded, lastLoadedUserId, messageBookmarks.length]);
    
    const fetchAllBookmarks = useCallback(async (forceRefresh = false) => {
      setIsLoading(true);
      
      if (!user) {
        setIsLoading(false);
        return;
      }
      
      // 사용자가 변경된 경우 캐시 초기화
      if (lastLoadedUserId !== user.id) {
        setMessageBookmarks([]);
        setIsDataLoaded(false);
        setLastLoadedUserId(user.id);
      }
      
      await fetchMessageBookmarks(forceRefresh);
      
      setIsLoading(false);
    }, [user, lastLoadedUserId, fetchMessageBookmarks]);

  // 사용자 변경 시 캐시 초기화
  useEffect(() => {
    if (user) {
      // 사용자가 변경된 경우에만 상태 초기화
      if (lastLoadedUserId !== user.id) {
        setMessageBookmarks([]);
        setIsDataLoaded(false);
        setLastLoadedUserId(user.id);
      }
    } else {
      // 로그아웃 시 모든 상태 초기화
      setMessageBookmarks([]);
      setIsDataLoaded(false);
      setLastLoadedUserId(null);
    }
  }, [user, lastLoadedUserId]);

  // 데이터 로딩 useEffect
  useEffect(() => {
    if (user && !isDataLoaded) {
      fetchAllBookmarks(true);
    }
  }, [user, isDataLoaded, fetchAllBookmarks]);

  // 실시간 구독 useEffect
  useEffect(() => {
    if (!user) return;

    // 메시지 북마크 변경사항 실시간 구독
    const messageBookmarkChannel = supabase
      .channel('message-bookmark-changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'message_bookmarks', 
          filter: `user_id=eq.${user.id}`
        }, 
        () => {
          fetchMessageBookmarks(true);
        }
      )
      .subscribe();
      
    return () => {
      messageBookmarkChannel.unsubscribe();
    };
  }, [user, supabase, fetchMessageBookmarks]);
  
  
  // 메시지 북마크 해제 함수
  const removeMessageBookmark = useCallback(async (bookmarkId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!user) return;
    
    try {
      const { error } = await supabase
        .from('message_bookmarks')
        .delete()
        .eq('id', bookmarkId)
        .eq('user_id', user.id);
        
      if (error) throw error;
      
      // UI 즉시 업데이트
      setMessageBookmarks(prev => prev.filter(bookmark => bookmark.id !== bookmarkId));
    } catch (error) {
      console.error('Error removing message bookmark:', error);
    }
  }, [user, supabase]);
  
  
  // 메시지가 있는 채팅으로 이동
  const navigateToMessage = useCallback((chatSessionId: string, messageId: string) => {
    router.push(`/chat/${chatSessionId}?scrollToMessage=${messageId}`);
  }, [router]);
  
  // 상대적 시간 표시
  const getRelativeTime = useCallback((timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    
    let interval = Math.floor(seconds / 31536000);
    if (interval >= 1) return `${interval}y`;
    
    interval = Math.floor(seconds / 2592000);
    if (interval >= 1) return `${interval}mo`;
    
    interval = Math.floor(seconds / 86400);
    if (interval >= 1) return `${interval}d`;
    
    interval = Math.floor(seconds / 3600);
    if (interval >= 1) return `${interval}h`;
    
    interval = Math.floor(seconds / 60);
    if (interval >= 1) return `${interval}m`;
    
    return `${Math.floor(seconds)}s`;
  }, []);

  // 콘텐츠 길이 제한 함수 (사이드바 스타일)
  const truncateContent = useCallback((content: string, maxLength: number = 80) => {
    // 사이드바와 동일한 방식으로 단일 길이 제한 사용
    return content.length <= maxLength ? content : content.substring(0, maxLength) + '...';
  }, []);
  
  // 북마크가 비어있는지 확인
  const isBookmarksEmpty = useMemo(() => {
    return messageBookmarks.length === 0;
  }, [messageBookmarks.length]);
    
    return (
      <main className="min-h-screen bg-[var(--background)]">
        <div className="max-w-2xl mx-auto py-4 sm:py-8 px-3 sm:px-4">
          <div className="flex items-center mb-4 sm:mb-6 mt-12 sm:mt-10">
            <h1 className="text-xl sm:text-2xl font-bold text-[var(--foreground)]">{translations.bookmarks}</h1>
          </div>
        
        
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--foreground)]"></div>
          </div>
        ) : !user ? (
          <div className="text-center py-8 sm:py-12 px-4">
            <p className="text-[var(--muted)] mb-4 text-sm sm:text-base">Please log in to view your bookmarks</p>
            <Link href="/login" className="inline-block px-4 py-2 bg-[#007AFF] text-white rounded-lg hover:bg-[#007AFF]/90 transition-colors text-sm sm:text-base">
              Log In
            </Link>
          </div>
        ) : isBookmarksEmpty ? (
          <div className="text-center py-8 sm:py-12 px-4">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              width="40" 
              height="40" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="1.5" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              className="mx-auto mb-4 text-[var(--muted)] sm:w-12 sm:h-12"
            >
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
            </svg>
            <p className="text-[var(--muted)] text-sm sm:text-base">No bookmarked messages yet</p>
          </div>
        ) : (
          <div className="space-y-1">
            {/* 메시지 북마크 표시 */}
            {messageBookmarks.map(bookmark => (
                <div 
                  key={bookmark.id}
                  className="border-b border-[var(--accent)] last:border-b-0"
                >
                  <div
                    className="group cursor-pointer p-3 sm:p-4 rounded-lg hover:bg-[var(--accent)] transition-all"
                    onClick={() => navigateToMessage(bookmark.chat_session_id, bookmark.message_id)}
                  >
                    {/* 새로운 레이아웃 - 날짜를 아바타 밑으로, 북마크 중앙정렬 */}
                    <div className="flex gap-3 w-full">
                      {/* Avatar + Date */}
                      <div className="flex-shrink-0 flex flex-col items-center gap-1">
                        {(() => {
                          const modelConfig = getModelById(bookmark.model);
                          return (
                            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center bg-[var(--accent)] transition-colors">
                              {modelConfig?.provider && hasLogo(modelConfig.provider) ? (
                                <Image 
                                  src={getProviderLogo(modelConfig.provider, modelConfig.id || undefined)}
                                  alt={`${modelConfig.provider} logo`}
                                  width={16}
                                  height={16}
                                  className="object-contain sm:w-5 sm:h-5"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center rounded-full">
                                  <span className="text-sm sm:text-lg font-semibold text-gray-500">
                                    {modelConfig?.provider ? modelConfig.provider.substring(0, 1).toUpperCase() : 'A'}
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                        {/* 날짜를 아바타 밑에 배치 */}
                        <span className="text-xs text-[var(--muted)] text-center">
                          {getRelativeTime(bookmark.timestamp)}
                        </span>
                      </div>
                      
                      {/* Content + Bookmark */}
                      <div className="flex-1 min-w-0 flex flex-col justify-center">
                        {/* 제목 */}
                        <p className="text-sm sm:text-base font-semibold text-[var(--foreground)] break-words mb-1">
                          {bookmark.chat_title || 'Untitled Chat'}
                        </p>
                        
                        {/* 콘텐츠 */}
                        <p className="text-xs sm:text-sm text-[var(--muted)] leading-relaxed break-words">
                          {truncateContent(bookmark.content, 60)}
                        </p>
                      </div>
                      
                      {/* 북마크 버튼 - 중앙정렬 */}
                      <div className="flex-shrink-0 flex items-center justify-center">
                        <button 
                          onClick={(e) => removeMessageBookmark(bookmark.id, e)}
                          className="p-1.5 sm:p-1 rounded-full bg-[var(--accent)] hover:bg-[var(--subtle-divider)] transition-colors"
                          title="Remove bookmark"
                          type="button"
                          aria-label="Remove bookmark"
                        >
                          <svg 
                            xmlns="http://www.w3.org/2000/svg" 
                            width="12" 
                            height="12" 
                            viewBox="0 0 24 24" 
                            fill="currentColor"
                            stroke="currentColor" 
                            strokeWidth="1.5" 
                            strokeLinecap="round" 
                            strokeLinejoin="round"
                            className="text-[#007AFF]"
                          >
                            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
} 