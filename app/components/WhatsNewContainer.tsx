import React, { useState, useEffect, useRef } from 'react';
import WhatsNew, { FeatureUpdate } from './WhatsNew';
import { useLastSeenUpdate } from '../hooks/useLastSeenUpdate';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
// import { useUser } from '@/app/lib/UserContext';
import { User } from '@supabase/supabase-js';

// FeatureUpdate 타입을 확장하여 필요한 필드 추가
interface ExtendedFeatureUpdate extends FeatureUpdate {
  like_count?: number;
  bookmark_count?: number;
  is_bookmarked?: boolean;
}

const WhatsNewContainer: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [hasNewUpdates, setHasNewUpdates] = useState(false);
  const [newUpdatesCount, setNewUpdatesCount] = useState(0);
  const [updates, setUpdates] = useState<ExtendedFeatureUpdate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { lastSeenUpdateId, lastSeenTimestamp, updateLastSeen, isLoaded } = useLastSeenUpdate();
  const supabase = createClient();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const buttonRef = useRef<HTMLButtonElement>(null);
  // const { user } = useUser();
  const [user, setUser] = useState<User | null>(null);
  
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
  
  // Fetch updates from Supabase
  useEffect(() => {
    const fetchUpdates = async () => {
      try {
        const { data, error } = await supabase
          .from('feature_updates')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (error) {
          console.error('Error fetching updates:', error);
          return;
        }

        // Transform database records to FeatureUpdate objects
        const formattedUpdates: ExtendedFeatureUpdate[] = await Promise.all(data.map(async (update) => {
          // Get like count
          const { data: likeCountData, error: likeCountError } = await supabase
            .rpc('get_like_count', { update_id_param: update.id });
          
          // Get bookmark count
          const { data: bookmarkCountData, error: bookmarkCountError } = await supabase
            .from('update_bookmarks')
            .select('id', { count: 'exact' })
            .eq('update_id', update.id);
          
          // 현재 사용자가 북마크했는지 확인
          let isBookmarked = false;
          if (user?.id) {
            const { data: bookmarkData } = await supabase
              .from('update_bookmarks')
              .select('id')
              .eq('update_id', update.id)
              .eq('user_id', user.id)
              .single();
            
            isBookmarked = !!bookmarkData;
          }
          
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
            like_count: likeCountError ? 0 : (likeCountData || 0),
            bookmark_count: bookmarkCountError ? 0 : (bookmarkCountData?.length || 0),
            is_bookmarked: isBookmarked
          };
        }));
        
        setUpdates(formattedUpdates);
      } catch (error) {
        console.error('Error in fetchUpdates:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUpdates();
    
    // Set up a real-time subscription for new updates
    const subscription = supabase
      .channel('feature_updates_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'feature_updates' }, 
        () => {
          fetchUpdates();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, user]);
  
  // Check if there are updates the user hasn't seen
  useEffect(() => {
    if (!isLoaded || !updates.length || isLoading) return;

    const checkForNewUpdates = () => {
      if (!lastSeenUpdateId && lastSeenTimestamp === 0) {
        // First time user - all updates are new
        setNewUpdatesCount(updates.length);
        setHasNewUpdates(updates.length > 0);
        return;
      }

      // Find the last update the user has seen
      const lastSeenUpdate = updates.find(update => update.id === lastSeenUpdateId);
      
      if (!lastSeenUpdate) {
        // If the last seen update no longer exists, use timestamp approach
        const newUpdates = updates.filter(update => update.timestamp > lastSeenTimestamp);
        setNewUpdatesCount(newUpdates.length);
        setHasNewUpdates(newUpdates.length > 0);
      } else {
        // Count updates with newer timestamps than the last seen
        const newUpdates = updates.filter(
          update => update.timestamp > lastSeenUpdate.timestamp
        );
        setNewUpdatesCount(newUpdates.length);
        setHasNewUpdates(newUpdates.length > 0);
      }
    };

    checkForNewUpdates();
  }, [lastSeenUpdateId, lastSeenTimestamp, isLoaded, updates, isLoading]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
          buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Check if device is mobile
  const isMobile = () => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768;
    }
    return false;
  };

  // Mobile and desktop positioning
  const [mobileView, setMobileView] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });

  useEffect(() => {
    const updatePosition = () => {
      if (isOpen && buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        const mobile = window.innerWidth < 768;
        
        setMobileView(mobile);
        
        if (mobile) {
          // For mobile: position dropdown at the top of screen
          setDropdownPosition({
            top: window.scrollY + 60, // Position below header
            right: 0
          });
        } else {
          // For desktop: position relative to button
          setDropdownPosition({
            top: rect.bottom + window.scrollY + 10,
            right: window.innerWidth - rect.right - window.scrollX
          });
        }
      }
    };
    
    updatePosition();
    
    // Update position when window is resized
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition);
    };
  }, [isOpen]);
  
  const handleOpen = () => {
    setIsOpen(prev => !prev);
    
    if (!isOpen && updates.length > 0) {
      // Store both the ID and timestamp of the newest update
      const newestUpdate = updates[0];
      updateLastSeen(newestUpdate.id, newestUpdate.timestamp);
      
      setHasNewUpdates(false);
      setNewUpdatesCount(0);
    }
  };

  const handleClickUpdate = (updateId: string) => {
    router.push(`/whats-new/${updateId}`);
    setIsOpen(false);
  };
  
  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  // Format description with bullet points for preview
  const formatPreviewDescription = (description: string, maxLength: number) => {
    if (!description) return '';
    
    // If description is already short enough, process it directly
    const needsTruncation = description.length > maxLength;
    
    // Split by newlines to handle bullet points
    const lines = description.split('\n');
    const formattedLines = lines.map((line, index) => {
      // Check if line is a bullet point
      const isBulletPoint = line.trim().startsWith('- ');
      
      // Remove the bullet dash prefix if it exists
      const cleanLine = isBulletPoint ? line.replace(/^\s*-\s+/, '') : line;
      
      // Format as a bullet point if needed
      if (isBulletPoint) {
        return (
          <div key={index} className="flex items-start mb-0.5">
            <span className="mr-1 font-bold text-xs">•</span>
            <span>{cleanLine}</span>
          </div>
        );
      }
      
      // Regular text line
      return <div key={index} className="mb-0.5">{cleanLine}</div>;
    });
    
    // If no truncation needed, return the formatted lines
    if (!needsTruncation) {
      return <>{formattedLines}</>;
    }
    
    // Truncate the content for previews that are too long
    // Find how many lines we can show
    let totalLength = 0;
    let linesToShow = [];
    
    for (let i = 0; i < formattedLines.length; i++) {
      const lineContent = lines[i];
      const lineLength = lineContent.length;
      
      if (totalLength + lineLength <= maxLength) {
        linesToShow.push(formattedLines[i]);
        totalLength += lineLength;
      } else {
        // If we can't show the full line, show a truncated version
        const remainingLength = maxLength - totalLength;
        if (remainingLength > 3) { // Only if we can show something meaningful
          const truncatedLine = (isBulletPoint: boolean) => {
            const content = lineContent.replace(/^\s*-\s+/, '');
            const truncated = content.substring(0, remainingLength - 3) + '...';
            
            if (isBulletPoint) {
              return (
                <div key={i} className="flex items-start mb-0.5">
                  <span className="mr-1 font-bold text-xs">•</span>
                  <span>{truncated}</span>
                </div>
              );
            }
            return <div key={i} className="mb-0.5">{truncated}</div>;
          };
          
          linesToShow.push(truncatedLine(lineContent.trim().startsWith('- ')));
        }
        break;
      }
    }
    
    // If we couldn't show all lines, add an indicator
    if (linesToShow.length < formattedLines.length) {
      linesToShow.push(<div key="more" className="text-xs text-[var(--muted)]">...</div>);
    }
    
    return <>{linesToShow}</>;
  };

  // Function to get time ago string (like "2h" or "3d")
  const getTimeAgo = (timestamp: number) => {
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
  
  // 북마크 토글 함수
  const toggleBookmark = async (updateId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // 이벤트 버블링 방지

    if (!user) {
      alert('로그인이 필요한 기능입니다.');
      return;
    }

    try {
      const update = updates.find(u => u.id === updateId);
      if (!update) return;

      const isCurrentlyBookmarked = update.is_bookmarked;

      if (isCurrentlyBookmarked) {
        // 북마크 삭제
        const { error } = await supabase
          .from('update_bookmarks')
          .delete()
          .eq('update_id', updateId)
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        // 북마크 추가
        const { error } = await supabase
          .from('update_bookmarks')
          .insert({
            update_id: updateId,
            user_id: user.id
          });

        if (error) throw error;
      }

      // UI 즉시 업데이트
      setUpdates(prevUpdates => 
        prevUpdates.map(update => 
          update.id === updateId 
            ? { 
                ...update, 
                is_bookmarked: !isCurrentlyBookmarked,
                bookmark_count: (update.bookmark_count || 0) + (isCurrentlyBookmarked ? -1 : 1)
              } 
            : update
        )
      );
    } catch (error) {
      console.error('Error toggling bookmark:', error);
    }
  };
  
  if (isLoading) {
    return null; // or a loading spinner
  }
  
  return (
    <div className="inline-flex items-center">
      <style jsx global>{`
        .hide-scrollbar {
          -ms-overflow-style: none;  /* IE and Edge */
          scrollbar-width: none;  /* Firefox */
        }
        .hide-scrollbar::-webkit-scrollbar {
          display: none;  /* Chrome, Safari and Opera */
        }
      `}</style>
      <button
        onClick={handleOpen}
        className="relative flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
        aria-label="What's New"
        ref={buttonRef}
      >
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          width="18" 
          height="18" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
        {hasNewUpdates && (
          <span className="absolute -top-2 -right-2 flex items-center justify-center min-w-[16px] h-[16px] px-1 text-[10px] font-semibold bg-[var(--foreground)] text-[var(--background)] rounded-full">
            {newUpdatesCount >= 10 ? '10+' : newUpdatesCount}
          </span>
        )}
      </button>
      
      {isOpen && (
        <div 
          ref={dropdownRef}
          className={`fixed max-h-[80vh] overflow-y-auto bg-[var(--background)] rounded-xl shadow-lg border border-[var(--subtle-divider)] z-50 ${mobileView ? 'mobile-dropdown' : 'mt-1'} hide-scrollbar`}
          style={{ 
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
            top: dropdownPosition.top,
            right: dropdownPosition.right,
            ...(mobileView 
              ? { left: '10px', width: 'calc(100vw - 20px)', maxWidth: 'calc(100vw - 20px)' }
              : { width: '380px', maxWidth: '380px' })
          }}
        >
          <div className="flex items-center justify-between p-4 border-b border-[var(--subtle-divider)]">
            <h3 className="font-bold text-lg">Notifications</h3>
            <Link 
              href="/whats-new" 
              className="text-sm text-blue-500 hover:underline"
              onClick={() => setIsOpen(false)}
            >
              See all
            </Link>
          </div>
          
          {updates.length === 0 ? (
            <div className="p-6 text-center text-[var(--muted)]">
              No new updates to show
            </div>
          ) : (
            <div>
              {updates.map((update) => (
                <div 
                  key={update.id}
                  className="p-4 border-b border-[var(--subtle-divider)] hover:bg-[var(--accent)] cursor-pointer transition-colors"
                  onClick={() => handleClickUpdate(update.id)}
                >
                  <div className="flex">
                    <div className="flex-shrink-0 mr-3">
                      <div className="w-10 h-10 rounded-full overflow-hidden cursor-pointer" onClick={(e) => {
                        e.stopPropagation();
                        router.push('/whats-new');
                        setIsOpen(false);
                      }}>
                        <Image 
                          src="/android-chrome-512x512.png" 
                          alt="Profile" 
                          width={48} 
                          height={48}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold">Chatflix</span>
                        <span className="text-xs text-[var(--muted)]">{getTimeAgo(update.timestamp)}</span>
                      </div>
                      <h4 className="font-medium text-sm">{update.title}</h4>
                      <div className="text-sm text-[var(--muted)] mt-1">
                        {formatPreviewDescription(update.description, 100)}
                      </div>
                      
                      {update.images && update.images.length > 0 && (
                        <div className="mt-2">
                          {update.images.length === 1 ? (
                            <div className="rounded-xl overflow-hidden border border-[var(--subtle-divider)]">
                              <Image 
                                src={update.images[0]}
                                alt={update.title}
                                width={300}
                                height={150}
                                className="w-full h-auto object-cover"
                              />
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 gap-1">
                              {update.images.slice(0, 4).map((img, i) => (
                                <div 
                                  key={i} 
                                  className={`${i >= 2 ? 'mt-1' : ''} rounded-xl overflow-hidden border border-[var(--subtle-divider)]`}
                                >
                                  <Image 
                                    src={img}
                                    alt={`${update.title} image ${i+1}`}
                                    width={150}
                                    height={150}
                                    className="w-full h-auto object-cover"
                                    style={{ aspectRatio: '1/1' }}
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Add social stats to each update card */}
                      <div className="flex items-center text-xs text-[var(--muted)] mt-2">
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
                        
                        {/* Bookmarks count */}
                        <div 
                          className="flex items-center cursor-pointer"
                          onClick={(e) => toggleBookmark(update.id, e)}
                        >
                          <svg 
                            xmlns="http://www.w3.org/2000/svg" 
                            width="14" 
                            height="14" 
                            viewBox="0 0 24 24" 
                            fill={update.is_bookmarked ? "currentColor" : "none"}
                            stroke="currentColor" 
                            strokeWidth="1.5" 
                            strokeLinecap="round" 
                            strokeLinejoin="round"
                            className={`mr-1 ${update.is_bookmarked ? 'text-blue-500' : ''}`}
                          >
                            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                          </svg>
                          {update.bookmark_count || 0}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default WhatsNewContainer; 