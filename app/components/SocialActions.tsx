'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
// import { useUser } from '@/app/lib/UserContext';
import { User } from '@supabase/supabase-js';

interface SocialActionsProps {
  updateId: string;
  initialLikeCount?: number;
  initialLiked?: boolean;
  initialBookmarked?: boolean;
  initialBookmarkCount?: number;
}

const SocialActions: React.FC<SocialActionsProps> = ({ 
  updateId,
  initialLikeCount = 0,
  initialLiked = false,
  initialBookmarked = false,
  initialBookmarkCount = 0
}) => {
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [isLiked, setIsLiked] = useState(initialLiked);
  const [isBookmarked, setIsBookmarked] = useState(initialBookmarked);
  const [bookmarkCount, setBookmarkCount] = useState(initialBookmarkCount);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionInProgress, setIsActionInProgress] = useState(false);
  
  // const { user } = useUser();
  const [user, setUser] = useState<User | null>(null);
  const supabase = createClient();

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
      } else if (event === 'SIGNED_IN') {
        setUser(session?.user || null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  // Fetch like count and user's like/bookmark status
  useEffect(() => {
    const fetchSocialState = async () => {
      if (!updateId) return;
      
      try {
        setIsLoading(true);
        
        // Get like count
        const { data: likeCountData, error: likeCountError } = await supabase
          .rpc('get_like_count', { update_id_param: updateId });
        
        if (likeCountError) {
          console.error('Error fetching like count:', likeCountError);
        } else {
          setLikeCount(likeCountData || 0);
        }
        
        // Get bookmark count
        const { data: bookmarkCountData, error: bookmarkCountError } = await supabase
          .from('update_bookmarks')
          .select('id', { count: 'exact' })
          .eq('update_id', updateId);
        
        if (!bookmarkCountError) {
          setBookmarkCount(bookmarkCountData?.length || 0);
        }
        
        // If logged in, check if user has liked/bookmarked this post
        if (user) {
          // Check like status
          const { data: likedData, error: likedError } = await supabase
            .rpc('has_user_liked', { 
              update_id_param: updateId,
              user_id_param: user.id 
            });
          
          if (!likedError) {
            setIsLiked(!!likedData);
          }
          
          // Check bookmark status
          const { data: bookmarkedData, error: bookmarkedError } = await supabase
            .rpc('has_user_bookmarked', { 
              update_id_param: updateId,
              user_id_param: user.id 
            });
          
          if (!bookmarkedError) {
            setIsBookmarked(!!bookmarkedData);
          }
        }
      } catch (error) {
        console.error('Error fetching social state:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchSocialState();
    
    // Set up real-time subscription for likes
    const likesSubscription = supabase
      .channel('likes-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'update_likes', filter: `update_id=eq.${updateId}` }, 
        () => {
          // Only update the like count, not the isLiked state
          fetchLikeCount();
        }
      )
      .subscribe();
    
    // Set up real-time subscription for bookmarks
    const bookmarksSubscription = supabase
      .channel('bookmarks-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'update_bookmarks', filter: `update_id=eq.${updateId}` }, 
        () => {
          // Update the bookmark count
          fetchBookmarkCount();
        }
      )
      .subscribe();
    
    return () => {
      likesSubscription.unsubscribe();
      bookmarksSubscription.unsubscribe();
    };
  }, [updateId, user, supabase]);

  // Fetch like count (without affecting isLiked state)
  const fetchLikeCount = async () => {
    const { data, error } = await supabase
      .rpc('get_like_count', { update_id_param: updateId });
    
    if (!error) {
      setLikeCount(data || 0);
    }
  };

  // Fetch bookmark count
  const fetchBookmarkCount = async () => {
    const { data, error } = await supabase
      .from('update_bookmarks')
      .select('id', { count: 'exact' })
      .eq('update_id', updateId);
    
    if (!error) {
      setBookmarkCount(data?.length || 0);
    }
  };

  // Handle like action
  const handleLike = async () => {
    if (!user || isActionInProgress) return;
    
    try {
      setIsActionInProgress(true);
      
      if (isLiked) {
        // Unlike: delete from update_likes
        const { error } = await supabase
          .from('update_likes')
          .delete()
          .eq('update_id', updateId)
          .eq('user_id', user.id);
        
        if (error) {
          console.error('Error unliking post:', error);
          return;
        }
        
        setIsLiked(false);
        setLikeCount(prev => Math.max(0, prev - 1));
      } else {
        // Like: insert into update_likes
        const { error } = await supabase
          .from('update_likes')
          .insert({
            update_id: updateId,
            user_id: user.id
          });
        
        if (error) {
          console.error('Error liking post:', error);
          return;
        }
        
        setIsLiked(true);
        setLikeCount(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error in handleLike:', error);
    } finally {
      setIsActionInProgress(false);
    }
  };

  // Handle bookmark action
  const handleBookmark = async () => {
    if (!user || isActionInProgress) return;
    
    try {
      setIsActionInProgress(true);
      
      if (isBookmarked) {
        // Remove bookmark
        const { error } = await supabase
          .from('update_bookmarks')
          .delete()
          .eq('update_id', updateId)
          .eq('user_id', user.id);
        
        if (error) {
          console.error('Error removing bookmark:', error);
          return;
        }
        
        setIsBookmarked(false);
        setBookmarkCount(prev => Math.max(0, prev - 1));
      } else {
        // Add bookmark
        const { error } = await supabase
          .from('update_bookmarks')
          .insert({
            update_id: updateId,
            user_id: user.id
          });
        
        if (error) {
          console.error('Error bookmarking post:', error);
          return;
        }
        
        setIsBookmarked(true);
        setBookmarkCount(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error in handleBookmark:', error);
    } finally {
      setIsActionInProgress(false);
    }
  };

  return (
    <div className="flex items-center space-x-6 text-[var(--muted)]">
      {/* Like Button */}
      <button 
        onClick={handleLike}
        disabled={isLoading || !user || isActionInProgress}
        className={`flex items-center group ${!user ? 'cursor-not-allowed opacity-60' : 'hover:text-red-500'}`}
        aria-label={isLiked ? 'Unlike' : 'Like'}
      >
        <div className="relative">
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width="18" 
            height="18" 
            viewBox="0 0 24 24" 
            fill={isLiked ? 'currentColor' : 'none'} 
            stroke="currentColor" 
            strokeWidth="1.5" 
            strokeLinecap="round" 
            strokeLinejoin="round"
            className={`transition-colors ${isLiked ? 'text-red-500' : 'group-hover:text-red-500'}`}
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
          </svg>
          {isActionInProgress && isLiked !== initialLiked && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-3 h-3 border-t-2 border-red-500 rounded-full animate-spin"></div>
            </div>
          )}
        </div>
        <span className="ml-2 text-sm">{likeCount}</span>
      </button>
      
      {/* Bookmark Button */}
      <button 
        onClick={handleBookmark}
        disabled={isLoading || !user || isActionInProgress}
        className={`flex items-center group ${!user ? 'cursor-not-allowed opacity-60' : 'hover:text-blue-500'}`}
        aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark'}
      >
        <div className="relative">
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width="18" 
            height="18" 
            viewBox="0 0 24 24" 
            fill={isBookmarked ? 'currentColor' : 'none'} 
            stroke="currentColor" 
            strokeWidth="1.5" 
            strokeLinecap="round" 
            strokeLinejoin="round"
            className={`transition-colors ${isBookmarked ? 'text-blue-500' : 'group-hover:text-blue-500'}`}
          >
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
          </svg>
          {isActionInProgress && isBookmarked !== initialBookmarked && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-3 h-3 border-t-2 border-blue-500 rounded-full animate-spin"></div>
            </div>
          )}
        </div>
        <span className="ml-2 text-sm">{bookmarkCount}</span>
      </button>
    </div>
  );
};

export default SocialActions; 