'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { useUser } from '@/app/lib/UserContext';
import { getModelById } from '@/lib/models/config';
import { FeatureUpdate } from '@/app/components/WhatsNew';

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
  const supabase = createClient();
  const { user } = useUser();
  const router = useRouter();
  
  // 북마크 데이터 가져오기
  useEffect(() => {
    const fetchUpdateBookmarks = async () => {
      if (!user) {
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
      } catch (error) {
        console.error('Error in fetchUpdateBookmarks:', error);
      }
    };
    
    const fetchMessageBookmarks = async () => {
      if (!user) {
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
        
        // 북마크 데이터 처리
        const formattedBookmarks = bookmarkData.map((bookmark) => ({
          id: bookmark.id,
          message_id: bookmark.message_id,
          chat_session_id: bookmark.chat_session_id,
          content: bookmark.content,
          model: bookmark.model,
          created_at: bookmark.created_at,
          timestamp: new Date(bookmark.created_at).getTime()
        }));
        
        setMessageBookmarks(formattedBookmarks);
      } catch (error) {
        console.error('Error in fetchMessageBookmarks:', error);
      }
    };
    
    const fetchAllBookmarks = async () => {
      setIsLoading(true);
      
      if (!user) {
        setIsLoading(false);
        return;
      }
      
      await Promise.all([
        fetchUpdateBookmarks(),
        fetchMessageBookmarks()
      ]);
      
      setIsLoading(false);
    };
    
    fetchAllBookmarks();
    
    // 북마크 변경사항 실시간 구독
    const updateBookmarkChannel = supabase
      .channel('update-bookmark-changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'update_bookmarks', 
          filter: user ? `user_id=eq.${user.id}` : undefined
        }, 
        () => {
          fetchUpdateBookmarks();
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
          filter: user ? `user_id=eq.${user.id}` : undefined
        }, 
        () => {
          fetchMessageBookmarks();
        }
      )
      .subscribe();
      
    return () => {
      updateBookmarkChannel.unsubscribe();
      messageBookmarkChannel.unsubscribe();
    };
  }, [user, supabase]);
  
  // 업데이트 북마크 해제 함수
  const removeUpdateBookmark = async (updateId: string, e: React.MouseEvent) => {
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
  };
  
  // 메시지 북마크 해제 함수
  const removeMessageBookmark = async (bookmarkId: string, e: React.MouseEvent) => {
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
  };
  
  // 게시물 페이지로 이동
  const navigateToPost = (updateId: string) => {
    router.push(`/whats-new/${updateId}`);
  };
  
  // 메시지가 있는 채팅으로 이동
  const navigateToMessage = (chatSessionId: string, messageId: string) => {
    router.push(`/chat/${chatSessionId}?scrollToMessage=${messageId}`);
  };
  
  // 상대적 시간 표시
  const getRelativeTime = (timestamp: number) => {
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
  };

  // 콘텐츠 길이 제한 함수
  const truncateContent = (content: string, maxLength: number = 250) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };
  
  // 현재 북마크 타입에 따라 표시할 데이터 결정
  const currentBookmarks = bookmarkType === BookmarkType.Updates 
    ? updateBookmarks 
    : messageBookmarks;
  
  // 현재 북마크 타입에 따라 북마크가 비어있는지 확인
  const isCurrentBookmarksEmpty = bookmarkType === BookmarkType.Updates 
    ? updateBookmarks.length === 0 
    : messageBookmarks.length === 0;
    
  return (
    <main className="min-h-screen bg-[var(--background)]">
      <div className="max-w-2xl mx-auto py-8 px-4">
        <div className="flex items-center mb-0 sm:mb-6 mt-10">
          {/* <Link href="/" className="mr-4">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              width="20" 
              height="20" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              className="text-[var(--foreground)]"
            >
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </Link>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Bookmarks</h1> */}
        </div>
        
        {/* 북마크 타입 선택 탭 */}
        <div className="flex border-b border-[var(--subtle-divider)] mb-6">
          <button
            className={`py-2 px-4 font-medium text-sm ${
              bookmarkType === BookmarkType.Messages
                ? 'text-[var(--foreground)] border-b-2 border-[var(--foreground)]'
                : 'text-[var(--muted)] hover:text-[var(--foreground)]'
            }`}
            onClick={() => setBookmarkType(BookmarkType.Messages)}
          >
            Messages
          </button>
          <button
            className={`py-2 px-4 font-medium text-sm ${
              bookmarkType === BookmarkType.Updates
                ? 'text-[var(--foreground)] border-b-2 border-[var(--foreground)]'
                : 'text-[var(--muted)] hover:text-[var(--foreground)]'
            }`}
            onClick={() => setBookmarkType(BookmarkType.Updates)}
          >
            Updates
          </button>
        </div>
        
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--foreground)]"></div>
          </div>
        ) : !user ? (
          <div className="text-center py-12">
            <p className="text-[var(--muted)] mb-4">Please log in to view your bookmarks</p>
            <Link href="/login" className="inline-block px-4 py-2 bg-blue-500 text-white rounded-lg">
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
                <Link href="/whats-new" className="block mt-4 text-blue-500 hover:underline">
                  Browse updates to bookmark
                </Link>
              </>
            ) : (
              <p className="text-[var(--muted)]">No bookmarked messages yet</p>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {bookmarkType === BookmarkType.Updates ? (
              // 업데이트 북마크 표시
              updateBookmarks.map(update => (
                <div 
                  key={update.id}
                  className="border border-[var(--subtle-divider)] rounded-xl p-4 hover:border-[var(--foreground)]/20 transition-colors cursor-pointer"
                  onClick={() => navigateToPost(update.id)}
                >
                  <div className="flex items-start space-x-4">
                    <div className="flex-1">
                      <div className="flex items-center">
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-[var(--foreground)]/10 mr-3">
                          <Image 
                            src="/android-chrome-512x512.png" 
                            alt="Chatflix" 
                            width={48} 
                            height={48}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div>
                          <div className="font-medium">Chatflix</div>
                          <div className="text-xs text-[var(--muted)]">{getRelativeTime(update.timestamp)}</div>
                        </div>
                      </div>
                      
                      <h2 className="font-bold text-lg mt-3">{update.title}</h2>
                      <p className="text-[var(--muted)] mt-1 line-clamp-2">
                        {update.description}
                      </p>
                      
                      {update.images && update.images.length > 0 && (
                        <div className="mt-3 rounded-lg overflow-hidden border border-[var(--subtle-divider)]">
                          <Image 
                            src={update.images[0]}
                            alt={update.title}
                            width={600}
                            height={300}
                            className="w-full h-auto object-cover"
                          />
                        </div>
                      )}
                      
                      <div className="flex items-center mt-3 text-[var(--muted)] text-xs">
                        {/* Likes count */}
                        <div className="flex items-center mr-4">
                          <svg 
                            xmlns="http://www.w3.org/2000/svg" 
                            width="14" 
                            height="14" 
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
                        
                        {/* Bookmark button */}
                        <button 
                          onClick={(e) => removeUpdateBookmark(update.id, e)}
                          className="flex items-center text-blue-500"
                        >
                          <svg 
                            xmlns="http://www.w3.org/2000/svg" 
                            width="14" 
                            height="14" 
                            viewBox="0 0 24 24" 
                            fill="currentColor"
                            stroke="currentColor" 
                            strokeWidth="1.5" 
                            strokeLinecap="round" 
                            strokeLinejoin="round"
                            className="mr-1"
                          >
                            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                          </svg>
                          {update.bookmark_count || 0}
                        </button>
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
                  className="border border-[var(--subtle-divider)] rounded-xl p-4 hover:border-[var(--foreground)]/20 transition-colors cursor-pointer"
                  onClick={() => navigateToMessage(bookmark.chat_session_id, bookmark.message_id)}
                >
                  <div className="flex items-start space-x-4">
                    <div className="flex-1">
                      <div className="flex items-center">
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-[var(--foreground)]/10 mr-3">
                          <Image 
                            src="/favicon-32x32.png" 
                            alt="Chatflix" 
                            width={32} 
                            height={32}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex flex-col">
                          <div className="font-medium">Chatflix.app</div>
                          <div className="text-xs text-[var(--muted)] flex items-center">
                            <span className="uppercase tracking-wider mr-2">
                              {getModelById(bookmark.model)?.name || bookmark.model}
                            </span>
                            <span>・</span>
                            <span className="ml-2">{getRelativeTime(bookmark.timestamp)}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-2 prose-sm dark:prose-invert prose-p:my-1 prose-pre:my-0 prose-ul:my-0 prose-ol:my-0 prose-li:my-0 prose-headings:my-1">
                        {truncateContent(bookmark.content)}
                      </div>
                      
                      <div className="flex items-center mt-3 text-[var(--muted)] text-xs">
                        {/* Remove bookmark button */}
                        <button 
                          onClick={(e) => removeMessageBookmark(bookmark.id, e)}
                          className="flex items-center text-blue-500"
                        >
                          <svg 
                            xmlns="http://www.w3.org/2000/svg" 
                            width="14" 
                            height="14" 
                            viewBox="0 0 24 24" 
                            fill="currentColor"
                            stroke="currentColor" 
                            strokeWidth="1.5" 
                            strokeLinecap="round" 
                            strokeLinejoin="round"
                            className="mr-1"
                          >
                            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                          </svg>
                          Remove bookmark
                        </button>
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