import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import WhatsNew, { FeatureUpdate } from './WhatsNew';
import { useLastSeenUpdate } from '../hooks/useLastSeenUpdate';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
// import { useUser } from '@/app/lib/UserContext';
import { User } from '@supabase/supabase-js';
import { motion, AnimatePresence } from 'framer-motion';
import { getSidebarTranslations } from '../lib/sidebarTranslations';

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
  const [translations, setTranslations] = useState({
    notifications: 'Notifications',
    seeAll: 'See all',
  });
  
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

        // Transform database records to FeatureUpdate objects with optimized queries
        const formattedUpdates: ExtendedFeatureUpdate[] = await Promise.all(data.map(async (update) => {
          // Batch queries for better performance
          const [likeCountResult, bookmarkCountResult, userBookmarkResult] = await Promise.all([
            // Get like count
            supabase.rpc('get_like_count', { update_id_param: update.id }),
            // Get bookmark count
            supabase.from('update_bookmarks').select('id', { count: 'exact' }).eq('update_id', update.id),
            // Check if current user bookmarked (only if user exists)
            user?.id ? supabase.from('update_bookmarks').select('id').eq('update_id', update.id).eq('user_id', user.id) : Promise.resolve({ data: null, error: null })
          ]);
          
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
            like_count: likeCountResult.error ? 0 : (likeCountResult.data || 0),
            bookmark_count: bookmarkCountResult.error ? 0 : (bookmarkCountResult.data?.length || 0),
            is_bookmarked: userBookmarkResult.data !== null && userBookmarkResult.data.length > 0
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
    const channelSuffix = Date.now() + Math.random().toString(36).substr(2, 9);
    
    const subscription = supabase
      .channel(`feature_updates_changes-${channelSuffix}`)
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'feature_updates' }, 
        () => {
          fetchUpdates();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
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

  // Pre-calculate position and update on window changes
  useLayoutEffect(() => {
    const updatePosition = () => {
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        const mobile = window.innerWidth < 768;
        
        setMobileView(mobile);
        
        if (mobile) {
          // For mobile: position dropdown at the top of screen
          const headerHeight = 48; // Header height is h-12 (48px)
          setDropdownPosition({
            top: window.scrollY + headerHeight + 12, // Position below header with 12px gap
            right: 0
          });
        } else {
          // For desktop: position relative to button with proper header offset
          const buttonBottom = rect.bottom + window.scrollY;
          const dropdownTop = buttonBottom + 8; // 8px gap from button
          
          setDropdownPosition({
            top: dropdownTop,
            right: window.innerWidth - rect.right - window.scrollX
          });
        }
      }
    };
    
    // Calculate position immediately
    updatePosition();
    
    // Update position when window is resized or scrolled
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition);
    };
  }, []); // Pre-calculate position on mount
  
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

  // Update position when dropdown opens
  useLayoutEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const mobile = window.innerWidth < 768;
      
      setMobileView(mobile);
      
      if (mobile) {
        const headerHeight = 48;
        setDropdownPosition({
          top: window.scrollY + headerHeight + 12,
          right: 0
        });
      } else {
        const buttonBottom = rect.bottom + window.scrollY;
        const dropdownTop = buttonBottom + 8;
        
        setDropdownPosition({
          top: dropdownTop,
          right: window.innerWidth - rect.right - window.scrollX
        });
      }
    }
  }, [isOpen]);

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
    return (
      <div className="inline-flex items-center">
        <button
          className="relative flex items-center justify-center text-[var(--foreground)] transition-all duration-200 cursor-pointer p-2.5 md:p-2 rounded-lg"
          aria-label="What's New"
          disabled
        >
                  <svg 
          xmlns="http://www.w3.org/2000/svg" 
          className="w-4 h-4 md:w-4 md:h-4 animate-pulse"
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
        </button>
      </div>
    );
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
        className="relative flex items-center justify-center text-[var(--foreground)] transition-all duration-200 cursor-pointer p-2.5 md:p-2 rounded-lg"
        aria-label="What's New"
        ref={buttonRef}
      >
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          className="w-4 h-4 md:w-4 md:h-4"
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
          <span className={`absolute top-0.5 right-1 flex items-center justify-center px-0.5 text-[8px] font-bold notification-badge text-white rounded-full ${
            newUpdatesCount >= 10 
              ? 'min-w-[12px] h-[12px]' 
              : 'min-w-[14px] h-[14px]'
          }`}>
            {newUpdatesCount >= 10 ? '10+' : newUpdatesCount}
          </span>
        )}
      </button>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            ref={dropdownRef}
            className={`fixed max-h-[80vh] overflow-y-auto notification-dropdown rounded-2xl z-50 ${mobileView ? 'mobile-dropdown' : 'mt-2'} hide-scrollbar`}
            style={{ 
              top: dropdownPosition.top,
              right: dropdownPosition.right,
              ...(mobileView 
                ? { left: '10px', width: 'calc(100vw - 20px)', maxWidth: 'calc(100vw - 20px)' }
                : { width: '320px', maxWidth: '320px' })
            }}
            initial={{ opacity: 0, y: -5, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -5, scale: 0.99 }}
            transition={{ 
              duration: 0.15, 
              ease: [0.25, 0.46, 0.45, 0.94]
            }}
          >
            <div className="notification-header flex items-center justify-between p-4">
              <div className="flex items-center space-x-3">
                <h3 className="font-semibold text-base notification-title">{translations.notifications}</h3>
                {hasNewUpdates && (
                  <span className="notification-badge text-white text-xs px-2 py-1 rounded-full font-semibold">
                    {newUpdatesCount} new
                  </span>
                )}
              </div>
              <Link 
                href="/whats-new" 
                className="notification-see-all"
                onClick={() => setIsOpen(false)}
              >
                {translations.seeAll}
              </Link>
            </div>
            
            {updates.length === 0 ? (
              <div className="p-6 text-center notification-empty">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[var(--accent)] flex items-center justify-center">
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
                      className="text-[var(--muted)]"
                    >
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                  </svg>
                </div>
                <p className="text-[var(--muted)] font-medium text-sm">No new updates to show</p>
                <p className="text-xs text-[var(--muted)] mt-1 opacity-70">Check back later for new features</p>
              </div>
            ) : (
              <div className="p-1.5">
                {updates.map((update, index) => (
                  <motion.div 
                    key={update.id}
                    className="border-b border-black/5 dark:border-white/5 last:border-b-0"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ 
                      duration: 0.15, 
                      delay: index * 0.02,
                      ease: [0.25, 0.46, 0.45, 0.94]
                    }}
                  >
                    <motion.div 
                      className="group relative transition-all p-2.5 rounded-lg cursor-pointer hover:bg-black/5 dark:hover:bg-white/5"
                      onClick={() => handleClickUpdate(update.id)}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                    >
                                              <div className="flex items-start gap-2.5 w-full">
                          {/* Avatar - ModelSelector 스타일 적용 */}
                          <div className="flex-shrink-0">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-[var(--accent)] transition-colors group-hover:bg-[var(--accent)]/80 cursor-pointer" onClick={(e) => {
                              e.stopPropagation();
                              router.push('/whats-new');
                              setIsOpen(false);
                            }}>
                                                          <Image 
                                src="/android-chrome-512x512.png" 
                                alt="Profile" 
                                width={16}
                                height={16}
                                className="w-full h-full object-cover rounded-full"
                              />
                          </div>
                        </div>
                        
                                                  {/* Content */}
                          <div className="flex-1 min-w-0 flex flex-col gap-1">
                          {/* Top line: Author + Time */}
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm text-[var(--foreground)]">Chatflix</span>
                              <span className="text-xs text-[var(--muted)] bg-[var(--accent)] px-2 py-0.5 rounded-full">
                                {getTimeAgo(update.timestamp)}
                              </span>
                            </div>
                          </div>
                          
                          {/* Title */}
                          <h4 className="font-semibold text-xs text-[var(--foreground)] leading-tight">
                            {update.title}
                          </h4>
                          
                          {/* Description */}
                          <div className="text-xs text-[var(--muted)] leading-relaxed">
                            {formatPreviewDescription(update.description, 100)}
                          </div>
                          
                          {/* Images */}
                          {update.images && update.images.length > 0 && (
                            <div className="mt-1.5">
                              {update.images.length === 1 ? (
                                <div className="rounded-lg overflow-hidden border border-[var(--accent)] transition-all">
                                  <Image 
                                    src={update.images[0]}
                                    alt={update.title}
                                    width={300}
                                    height={150}
                                    className="w-full h-auto object-cover"
                                  />
                                </div>
                              ) : (
                                                                  <div className="grid grid-cols-2 gap-1.5">
                                  {update.images.slice(0, 4).map((img, i) => (
                                                                      <div 
                                    key={i} 
                                    className="rounded-lg overflow-hidden border border-[var(--accent)] transition-all"
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
                          
                          {/* Stats - ModelSelector 스타일 적용 */}
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <div className="flex items-center gap-1 bg-[var(--accent)]/40 rounded-full px-1.5 py-0.5 transition-all hover:bg-[var(--accent)]/60 hover:scale-105">
                                                              <svg 
                                  xmlns="http://www.w3.org/2000/svg" 
                                  width="10" 
                                  height="10" 
                                  viewBox="0 0 24 24" 
                                  fill="none" 
                                  stroke="currentColor" 
                                  strokeWidth="1.5" 
                                  strokeLinecap="round" 
                                  strokeLinejoin="round"
                                  className="text-[var(--muted)]"
                                >
                                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                              </svg>
                              <span className="text-[10px] font-medium text-[var(--muted)]">{update.like_count || 0}</span>
                            </div>
                            
                            <div 
                              className={`flex items-center gap-1 rounded-full px-1.5 py-0.5 transition-all hover:scale-105 cursor-pointer ${
                                update.is_bookmarked 
                                  ? 'bg-[#007AFF]/20 text-[#007AFF]' 
                                  : 'bg-[var(--accent)]/40 text-[var(--muted)] hover:bg-[var(--accent)]/60'
                              }`}
                              onClick={(e) => toggleBookmark(update.id, e)}
                            >
                              <svg 
                                xmlns="http://www.w3.org/2000/svg" 
                                width="10" 
                                height="10" 
                                viewBox="0 0 24 24" 
                                fill={update.is_bookmarked ? "currentColor" : "none"}
                                stroke="currentColor" 
                                strokeWidth="1.5" 
                                strokeLinecap="round" 
                                strokeLinejoin="round"
                              >
                                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                              </svg>
                              <span className="text-[10px] font-medium">{update.bookmark_count || 0}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default WhatsNewContainer;