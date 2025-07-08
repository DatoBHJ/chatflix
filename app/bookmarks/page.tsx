'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { getModelById } from '@/lib/models/config';
import { getProviderLogo, hasLogo } from '@/app/lib/models/logoUtils';
import { FeatureUpdate } from '@/app/components/WhatsNew';
import { User } from '@supabase/supabase-js';
import { getSidebarTranslations } from '../lib/sidebarTranslations';

// 북마크된 업데이트 타입 정의
interface BookmarkedUpdate extends FeatureUpdate {
  like_count?: number;
  bookmark_count?: number;
  is_bookmarked: boolean;
}

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

enum BookmarkType {
  Messages = 'messages',
  Updates = 'updates'
}

export default function BookmarksPage() {
  const [bookmarkType, setBookmarkType] = useState<BookmarkType>(BookmarkType.Messages);
  const [updateBookmarks, setUpdateBookmarks] = useState<BookmarkedUpdate[]>([]);
  const [messageBookmarks, setMessageBookmarks] = useState<BookmarkedMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [translations, setTranslations] = useState({
    bookmarks: 'Bookmarks',
    messages: 'Messages',
    updates: 'Updates',
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
  
  // 북마크 데이터 가져오기 함수들을 useCallback으로 최적화
  const fetchUpdateBookmarks = useCallback(async (forceRefresh = false) => {
      if (!user) {
        return;
      }
      
      // 캐시 확인 - 강제 새로고침이 아니고 캐시가 유효한 경우 스킵
      const now = Date.now();
      const isCacheValid = now - lastLoadTimeRef.current < CACHE_DURATION;
      
      if (!forceRefresh && isCacheValid && isDataLoaded && lastLoadedUserId === user.id && updateBookmarks.length > 0) {
        console.log('[Bookmarks] Using cached update bookmark data');
        return;
      }
      
      try {
        // 사용자가 북마크한 게시물 ID 가져오기
        const { data: bookmarkData, error: bookmarkError } = await supabase
          .from('update_bookmarks')
          .select('update_id')
          .eq('user_id', user.id);
          
        if (bookmarkError) {
          console.error('Error fetching update bookmarks:', bookmarkError);
          return;
        }
        
        if (!bookmarkData || bookmarkData.length === 0) {
          setUpdateBookmarks([]);
          return;
        }
        
        // 북마크한 게시물 ID 배열
        const bookmarkedIds = bookmarkData.map(b => b.update_id);
        
        // 북마크한 게시물 데이터 가져오기
        const { data: updatesData, error: updatesError } = await supabase
          .from('feature_updates')
          .select('*')
          .in('id', bookmarkedIds)
          .order('created_at', { ascending: false });
          
        if (updatesError) {
          console.error('Error fetching bookmarked updates:', updatesError);
          return;
        }
        
        // 게시물 데이터 처리
        const formattedBookmarks = await Promise.all(updatesData.map(async (update) => {
          // Get like count
          const { data: likeCountData } = await supabase
            .rpc('get_like_count', { update_id_param: update.id });
          
          // Get bookmark count
          const { data: bookmarkCountData } = await supabase
            .from('update_bookmarks')
            .select('id', { count: 'exact' })
            .eq('update_id', update.id);
            
          return {
            id: update.id,
            title: update.title,
            description: update.description,
            date: new Date(update.created_at).toLocaleDateString('en-US', {
              day: 'numeric',
              month: 'long',
              year: 'numeric'
            }),
            timestamp: new Date(update.created_at).getTime(),
            images: update.images || [],
            like_count: likeCountData || 0,
            bookmark_count: bookmarkCountData?.length || 0,
            is_bookmarked: true
          };
        }));
        
        setUpdateBookmarks(formattedBookmarks);
        
        // 캐시 상태 업데이트
        setIsDataLoaded(true);
        setLastLoadedUserId(user.id);
        lastLoadTimeRef.current = Date.now();
      } catch (error) {
        console.error('Error in fetchUpdateBookmarks:', error);
      }
    }, [user, supabase, isDataLoaded, lastLoadedUserId, updateBookmarks.length]);
    
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
        
        // 북마크 데이터 처리 (채팅 세션 제목 포함)
        const formattedBookmarks = await Promise.all(
          bookmarkData.map(async (bookmark) => {
            // 채팅 세션 제목 가져오기
            const { data: chatSession } = await supabase
              .from('chat_sessions')
              .select('title')
              .eq('id', bookmark.chat_session_id)
              .single();
            
            // 채팅 세션에 제목이 없으면 첫 번째 사용자 메시지로 제목 생성
            let chatTitle = chatSession?.title;
            if (!chatTitle || chatTitle.trim() === '') {
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
            
            return {
              id: bookmark.id,
              message_id: bookmark.message_id,
              chat_session_id: bookmark.chat_session_id,
              content: bookmark.content,
              model: bookmark.model,
              created_at: bookmark.created_at,
              timestamp: new Date(bookmark.created_at).getTime(),
              chat_title: chatTitle
            };
          })
        );
        
        setMessageBookmarks(formattedBookmarks);
        
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
        setUpdateBookmarks([]);
        setMessageBookmarks([]);
        setIsDataLoaded(false);
        setLastLoadedUserId(user.id);
      }
      
      await Promise.all([
        fetchUpdateBookmarks(forceRefresh),
        fetchMessageBookmarks(forceRefresh)
      ]);
      
      setIsLoading(false);
    }, [user, lastLoadedUserId, fetchUpdateBookmarks, fetchMessageBookmarks]);

  // 사용자 변경 시 캐시 초기화
  useEffect(() => {
    if (user) {
      // 사용자가 변경된 경우에만 상태 초기화
      if (lastLoadedUserId !== user.id) {
        setUpdateBookmarks([]);
        setMessageBookmarks([]);
        setIsDataLoaded(false);
        setLastLoadedUserId(user.id);
      }
    } else {
      // 로그아웃 시 모든 상태 초기화
      setUpdateBookmarks([]);
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

    // 북마크 변경사항 실시간 구독
    const updateBookmarkChannel = supabase
      .channel('update-bookmark-changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'update_bookmarks', 
          filter: `user_id=eq.${user.id}`
        }, 
        () => {
          fetchUpdateBookmarks(true);
        }
      )
      .subscribe();
    
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
      updateBookmarkChannel.unsubscribe();
      messageBookmarkChannel.unsubscribe();
    };
  }, [user, supabase, fetchUpdateBookmarks, fetchMessageBookmarks]);
  
  // 업데이트 북마크 해제 함수
  const removeUpdateBookmark = useCallback(async (updateId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!user) return;
    
    try {
      const { error } = await supabase
        .from('update_bookmarks')
        .delete()
        .eq('update_id', updateId)
        .eq('user_id', user.id);
        
      if (error) throw error;
      
      // UI 즉시 업데이트
      setUpdateBookmarks(prev => prev.filter(bookmark => bookmark.id !== updateId));
    } catch (error) {
      console.error('Error removing update bookmark:', error);
    }
  }, [user, supabase]);
  
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
  
  // 게시물 페이지로 이동
  const navigateToPost = useCallback((updateId: string) => {
    router.push(`/whats-new/${updateId}`);
  }, [router]);
  
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

  // 콘텐츠 길이 제한 함수
  const truncateContent = useCallback((content: string, maxLength: number = 250) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  }, []);
  
  // 현재 북마크 타입에 따라 표시할 데이터 결정
  const currentBookmarks = useMemo(() => {
    return bookmarkType === BookmarkType.Updates 
      ? updateBookmarks 
      : messageBookmarks;
  }, [bookmarkType, updateBookmarks, messageBookmarks]);
  
  // 현재 북마크 타입에 따라 북마크가 비어있는지 확인
  const isCurrentBookmarksEmpty = useMemo(() => {
    return bookmarkType === BookmarkType.Updates 
      ? updateBookmarks.length === 0 
      : messageBookmarks.length === 0;
  }, [bookmarkType, updateBookmarks.length, messageBookmarks.length]);
    
  return (
    <main className="min-h-screen bg-[var(--background)]">
      <div className="max-w-2xl mx-auto py-8 px-4">
        <div className="flex items-center mb-6 mt-10">
          <h1 className="text-2xl font-bold text-[var(--foreground)]">{translations.bookmarks}</h1>
        </div>
        
        {/* 북마크 타입 선택 탭 */}
        <div className="flex border-b border-[var(--accent)] mb-6">
          <button
            className={`py-2 px-4 font-medium text-sm transition-colors ${
              bookmarkType === BookmarkType.Messages
                ? 'text-[var(--foreground)] border-b-2 border-[#007AFF]'
                : 'text-[var(--muted)] hover:text-[var(--foreground)]'
            }`}
            onClick={useCallback(() => setBookmarkType(BookmarkType.Messages), [])}
          >
            {translations.messages}
          </button>
          <button
            className={`py-2 px-4 font-medium text-sm transition-colors ${
              bookmarkType === BookmarkType.Updates
                ? 'text-[var(--foreground)] border-b-2 border-[#007AFF]'
                : 'text-[var(--muted)] hover:text-[var(--foreground)]'
            }`}
            onClick={useCallback(() => setBookmarkType(BookmarkType.Updates), [])}
          >
            {translations.updates}
          </button>
        </div>
        
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--foreground)]"></div>
          </div>
        ) : !user ? (
          <div className="text-center py-12">
            <p className="text-[var(--muted)] mb-4">Please log in to view your bookmarks</p>
            <Link href="/login" className="inline-block px-4 py-2 bg-[#007AFF] text-white rounded-lg hover:bg-[#007AFF]/90 transition-colors">
              Log In
            </Link>
          </div>
        ) : isCurrentBookmarksEmpty ? (
          <div className="text-center py-12">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              width="48" 
              height="48" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="1.5" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              className="mx-auto mb-4 text-[var(--muted)]"
            >
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
            </svg>
            {bookmarkType === BookmarkType.Updates ? (
              <>
                <p className="text-[var(--muted)]">No bookmarked updates yet</p>
                <Link href="/whats-new" className="block mt-4 text-[#007AFF] hover:underline">
                  Browse updates to bookmark
                </Link>
              </>
            ) : (
              <p className="text-[var(--muted)]">No bookmarked messages yet</p>
            )}
          </div>
        ) : (
          <div className="space-y-0.5">
            {bookmarkType === BookmarkType.Updates ? (
              // 업데이트 북마크 표시
              updateBookmarks.map(update => (
                <div 
                  key={update.id}
                  className="border-b border-[var(--accent)] last:border-b-0"
                >
                  <div
                    className="group cursor-pointer p-3 rounded-lg hover:bg-[var(--accent)] transition-all"
                    onClick={() => navigateToPost(update.id)}
                  >
                    <div className="flex items-center gap-3 w-full">
                      {/* Avatar */}
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-[var(--accent)]">
                          <Image 
                            src="/android-chrome-512x512.png" 
                            alt="Chatflix" 
                            width={40} 
                            height={40}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        {/* Top line: Title + Date */}
                        <div className="flex justify-between items-baseline">
                          <p className="text-sm font-semibold truncate pr-2 text-[var(--foreground)]">
                            {update.title}
                          </p>
                          <span className="text-xs flex-shrink-0 text-[var(--muted)]">
                            {getRelativeTime(update.timestamp)}
                          </span>
                        </div>
                        
                        {/* Bottom line: Description + Buttons */}
                        <div className="flex justify-between items-end">
                          <p className="text-xs truncate pr-2 text-[var(--muted)]">
                            {update.description}
                          </p>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="flex items-center text-xs text-[var(--muted)] bg-[var(--accent)] px-2 py-1 rounded-full">
                              <svg 
                                xmlns="http://www.w3.org/2000/svg" 
                                width="12" 
                                height="12" 
                                viewBox="0 0 24 24" 
                                fill="none" 
                                stroke="currentColor" 
                                strokeWidth="1.5" 
                                strokeLinecap="round" 
                                strokeLinejoin="round"
                                className="mr-1"
                              >
                                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                              </svg>
                              {update.like_count || 0}
                            </div>
                            <button 
                              onClick={(e) => removeUpdateBookmark(update.id, e)}
                              className="p-1 rounded-full bg-[var(--accent)] hover:bg-[var(--subtle-divider)] transition-colors"
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
                  </div>
                </div>
              ))
            ) : (
              // 메시지 북마크 표시
              messageBookmarks.map(bookmark => (
                <div 
                  key={bookmark.id}
                  className="border-b border-[var(--accent)] last:border-b-0"
                >
                  <div
                    className="group cursor-pointer p-3 rounded-lg hover:bg-[var(--accent)] transition-all"
                    onClick={() => navigateToMessage(bookmark.chat_session_id, bookmark.message_id)}
                  >
                    <div className="flex items-center gap-3 w-full">
                      {/* Avatar */}
                      <div className="flex-shrink-0">
                        {(() => {
                          const modelConfig = getModelById(bookmark.model);
                          return (
                            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[var(--accent)]">
                              {modelConfig?.provider && hasLogo(modelConfig.provider) ? (
                                <Image 
                                  src={getProviderLogo(modelConfig.provider, modelConfig.id || undefined)}
                                  alt={`${modelConfig.provider} logo`}
                                  width={20}
                                  height={20}
                                  className="object-contain"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center rounded-full">
                                  <span className="text-lg font-semibold text-gray-500">
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
                         {/* Top line: Chat Title + Date */}
                         <div className="flex justify-between items-baseline">
                           <p className="text-sm font-semibold truncate pr-2 text-[var(--foreground)]">
                             {bookmark.chat_title || 'Untitled Chat'}
                           </p>
                           <span className="text-xs flex-shrink-0 text-[var(--muted)]">
                             {getRelativeTime(bookmark.timestamp)}
                           </span>
                         </div>
                        
                        {/* Bottom line: Content + Buttons */}
                        <div className="flex justify-between items-end">
                          <p className="text-xs truncate pr-2 text-[var(--muted)]">
                            {truncateContent(bookmark.content, 100)}
                          </p>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={(e) => removeMessageBookmark(bookmark.id, e)}
                              className="p-1 rounded-full bg-[var(--accent)] hover:bg-[var(--subtle-divider)] transition-colors"
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
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </main>
  );
} 