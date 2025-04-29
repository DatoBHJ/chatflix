'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import SocialActions from '@/app/components/SocialActions';
import { useUser } from '@/app/lib/UserContext';
import { motion, AnimatePresence } from 'framer-motion';

interface FeatureUpdate {
  id: string;
  title: string;
  description: string;
  created_at: string;
  images?: string[];
  like_count?: number;
  bookmark_count?: number;
}

interface ImageModalProps {
  images: string[];
  selectedIndex: number;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
}

const ImageModal: React.FC<ImageModalProps> = ({ 
  images, 
  selectedIndex, 
  onClose, 
  onNext, 
  onPrev 
}) => {
  // Prevent scrolling of body when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute top-4 right-4">
        <button 
          onClick={onClose}
          className="text-white p-2 rounded-full hover:bg-white hover:bg-opacity-20 transition-colors"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      
      <button 
        onClick={(e) => {
          e.stopPropagation();
          onPrev();
        }}
        className="absolute left-4 text-white p-2 rounded-full hover:bg-white hover:bg-opacity-20 transition-colors"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
      </button>
      
      <div 
        className="max-w-4xl max-h-[90vh] relative"
        onClick={(e) => e.stopPropagation()}
      >
        <Image 
          src={images[selectedIndex]}
          alt={`Image ${selectedIndex + 1}`}
          width={1200}
          height={900}
          className="max-h-[90vh] max-w-full h-auto object-contain"
        />
      </div>
      
      <button 
        onClick={(e) => {
          e.stopPropagation();
          onNext();
        }}
        className="absolute right-4 text-white p-2 rounded-full hover:bg-white hover:bg-opacity-20 transition-colors"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
      </button>
      
      <div className="absolute bottom-4 text-white text-sm">
        {selectedIndex + 1} / {images.length}
      </div>
    </div>
  );
};

// Update SkeletonLoader component to perfectly match actual content design
const SkeletonLoader = () => {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 sm:px-2 md:px-4 mt-0 sm:mt-4 animate-pulse">
      <div className="relative w-full max-w-4xl flex justify-center items-center">
        <div className="w-full md:w-[640px] lg:w-[700px] bg-[var(--background)] rounded-xl border border-[var(--subtle-divider)] shadow-lg overflow-hidden">
          <div className="p-4 md:p-6">
            <div className="flex items-start">
              {/* Profile skeleton */}
              <div className="mr-3 md:mr-4 flex-shrink-0">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-[var(--accent)] bg-opacity-30"></div>
              </div>
              
              <div className="flex-1">
                {/* Header skeleton */}
                <div className="flex items-center">
                  <div className="h-4 md:h-5 w-20 md:w-24 bg-[var(--accent)] bg-opacity-30 rounded-md"></div>
                  <span className="mx-1.5 text-[var(--muted)]">·</span>
                  <div className="h-3 md:h-4 w-16 md:w-20 bg-[var(--accent)] bg-opacity-30 rounded-md"></div>
                </div>
                
                {/* Title skeleton */}
                <div className="h-6 md:h-7 w-3/4 bg-[var(--accent)] bg-opacity-30 rounded-md mt-2 md:mt-3"></div>
                
                {/* Description skeleton */}
                <div className="mt-2 md:mt-3 space-y-2">
                  <div className="h-3 md:h-4 bg-[var(--accent)] bg-opacity-30 rounded-md"></div>
                  <div className="h-3 md:h-4 bg-[var(--accent)] bg-opacity-30 rounded-md"></div>
                  <div className="h-3 md:h-4 w-2/3 bg-[var(--accent)] bg-opacity-30 rounded-md"></div>
                </div>
                
                {/* Image skeleton */}
                <div className="mt-3 md:mt-5 rounded-xl overflow-hidden border border-[var(--subtle-divider)]">
                  <div className="aspect-video bg-[var(--accent)] bg-opacity-30 max-h-[300px]"></div>
                </div>
                
                {/* Action buttons skeleton */}
                <div className="flex justify-between items-center mt-4 md:mt-6 pt-3 md:pt-4 border-t border-[var(--subtle-divider)]">
                  <div className="flex space-x-3 md:space-x-4">
                    <div className="h-6 md:h-8 w-12 md:w-16 bg-[var(--accent)] bg-opacity-30 rounded-md"></div>
                    <div className="h-6 md:h-8 w-12 md:w-16 bg-[var(--accent)] bg-opacity-30 rounded-md"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Navigation buttons - exactly matching actual content */}
        <div className="absolute right-0 md:right-[-12px] lg:right-[-12px] top-1/2 transform -translate-y-1/2 z-20 flex flex-col space-y-8">
          <button className="text-[var(--foreground)] pointer-events-none opacity-60" aria-label="Previous post">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="18 15 12 9 6 15"></polyline>
            </svg>
          </button>
          
          <button className="text-[var(--foreground)] pointer-events-none opacity-60" aria-label="Next post">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

// Function to convert URLs in text to clickable links
const convertLinksToHtml = (text: string) => {
  if (!text) return '';
  
  // URL regex pattern to detect links
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  
  // Replace URLs with anchor tags
  return text.split(urlRegex).map((part, i) => {
    // Check if this part matches a URL
    if (urlRegex.test(part)) {
      return (
        <a 
          key={i} 
          href={part} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline break-words"
        >
          {part}
        </a>
      );
    }
    // Return regular text
    return part;
  });
};

export default function SingleUpdatePage() {
  const params = useParams();
  const router = useRouter();
  const updateId = params.id as string;
  
  const [currentUpdate, setCurrentUpdate] = useState<FeatureUpdate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedImages, setSelectedImages] = useState<string[] | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [likeCount, setLikeCount] = useState(0);
  const [bookmarkCount, setBookmarkCount] = useState(0);
  const [hasLiked, setHasLiked] = useState(false);
  const [hasBookmarked, setHasBookmarked] = useState(false);
  const [prevPostId, setPrevPostId] = useState<string | null>(null);
  const [nextPostId, setNextPostId] = useState<string | null>(null);
  
  // Touch handling for swipe navigation
  const touchStartY = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const supabase = createClient();
  const { user } = useUser();

  useEffect(() => {
    const fetchUpdate = async () => {
      try {
        setIsLoading(true);
        
        // Get the current update
        const { data: currentUpdateData, error: currentUpdateError } = await supabase
          .from('feature_updates')
          .select('*')
          .eq('id', updateId)
          .single();
          
        if (currentUpdateError) {
          console.error('Error fetching current update:', currentUpdateError);
          setIsLoading(false);
          return;
        }
        
        // Get all update IDs ordered by created_at to determine prev/next
        const { data: allUpdatesIds, error: allUpdatesError } = await supabase
          .from('feature_updates')
          .select('id, created_at')
          .order('created_at', { ascending: false });
          
        if (allUpdatesError) {
          console.error('Error fetching all updates:', allUpdatesError);
        } else {
          // Find current index
          const currentIndex = allUpdatesIds.findIndex(item => item.id === updateId);
          
          if (currentIndex > 0) {
            setPrevPostId(allUpdatesIds[currentIndex - 1].id);
          } else {
            setPrevPostId(null);
          }
          
          if (currentIndex < allUpdatesIds.length - 1) {
            setNextPostId(allUpdatesIds[currentIndex + 1].id);
          } else {
            setNextPostId(null);
          }
        }
        
        // Format the current update
        const formattedUpdate: FeatureUpdate = {
          id: currentUpdateData.id,
          title: currentUpdateData.title,
          description: currentUpdateData.description,
          created_at: currentUpdateData.created_at,
          images: currentUpdateData.images || [],
          like_count: currentUpdateData.like_count,
          bookmark_count: currentUpdateData.bookmark_count,
        };
        
        setCurrentUpdate(formattedUpdate);
        
          // Get like count
          const { data: likeCountData, error: likeCountError } = await supabase
            .rpc('get_like_count', { update_id_param: updateId });
          
          if (!likeCountError) {
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
              setHasLiked(!!likedData);
            }
            
            // Check bookmark status
            const { data: bookmarkedData, error: bookmarkedError } = await supabase
              .rpc('has_user_bookmarked', { 
                update_id_param: updateId,
                user_id_param: user.id 
              });
            
            if (!bookmarkedError) {
              setHasBookmarked(!!bookmarkedData);
            }
          }
      } catch (error) {
        console.error('Error in fetchUpdate:', error);
      } finally {
        setIsLoading(false);
      }
    };

    // Setup real-time subscriptions for likes and bookmarks
    let likesChannel: ReturnType<typeof supabase.channel> | null = null;
    let bookmarksChannel: ReturnType<typeof supabase.channel> | null = null;

    if (updateId) {
      fetchUpdate();
      
      likesChannel = supabase
        .channel(`page-likes-${updateId}`)
        .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'update_likes', filter: `update_id=eq.${updateId}` }, 
          () => {
            updateLikeCount();
          }
        )
        .subscribe();
        
      bookmarksChannel = supabase
        .channel(`page-bookmarks-${updateId}`)
        .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'update_bookmarks', filter: `update_id=eq.${updateId}` }, 
          () => {
            updateBookmarkCount();
          }
        )
        .subscribe();
    }
    
    // Cleanup function
    return () => {
      if (likesChannel) likesChannel.unsubscribe();
      if (bookmarksChannel) bookmarksChannel.unsubscribe();
    };
  }, [updateId, user, supabase]);
  
  // Like count updater
  const updateLikeCount = async () => {
    try {
      const { data, error } = await supabase
        .rpc('get_like_count', { update_id_param: updateId });
      
      if (!error) {
        setLikeCount(data || 0);
      }
    } catch (error) {
      console.error('Error updating like count:', error);
    }
  };
  
  // Bookmark count updater
  const updateBookmarkCount = async () => {
    try {
      const { data, error } = await supabase
        .from('update_bookmarks')
        .select('id', { count: 'exact' })
        .eq('update_id', updateId);
      
      if (!error) {
        setBookmarkCount(data?.length || 0);
      }
    } catch (error) {
      console.error('Error updating bookmark count:', error);
    }
  };

  // Navigate to previous post
  const goToPrevPost = () => {
    if (prevPostId) {
      router.push(`/whats-new/${prevPostId}`);
    }
  };

  // Navigate to next post
  const goToNextPost = () => {
    if (nextPostId) {
      router.push(`/whats-new/${nextPostId}`);
    }
  };

  // Handle touch start
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  // Handle touch end
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    
    const touchEndY = e.changedTouches[0].clientY;
    const deltaY = touchEndY - touchStartY.current;
    
    // Threshold for swipe detection - adjust as needed
    const threshold = 50;
    
    if (deltaY > threshold) {
      // Swipe down - go to previous post
      goToPrevPost();
    } else if (deltaY < -threshold) {
      // Swipe up - go to next post
      goToNextPost();
    }
    
    touchStartY.current = null;
  };

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp') {
        goToPrevPost();
      } else if (e.key === 'ArrowDown') {
        goToNextPost();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [prevPostId, nextPostId]);

  const handleImageClick = (images: string[], index: number) => {
    setSelectedImages(images);
    setSelectedImageIndex(index);
  };

  const closeImageModal = () => {
    setSelectedImages(null);
  };

  const nextImage = () => {
    if (!selectedImages) return;
    setSelectedImageIndex((prev) => (prev + 1) % selectedImages.length);
  };

  const prevImage = () => {
    if (!selectedImages) return;
    setSelectedImageIndex((prev) => (prev - 1 + selectedImages.length) % selectedImages.length);
  };

  // Format relative time (Twitter-style)
  const getRelativeTime = (timestamp: string) => {
    const createdAt = new Date(timestamp).getTime();
    const now = Date.now();
    const seconds = Math.floor((now - createdAt) / 1000);
    
    let interval = Math.floor(seconds / 31536000);
    if (interval >= 1) {
      return interval === 1 ? `${interval} year ago` : `${interval} years ago`;
    }
    
    interval = Math.floor(seconds / 2592000);
    if (interval >= 1) {
      return interval === 1 ? `${interval} month ago` : `${interval} months ago`;
    }
    
    interval = Math.floor(seconds / 86400);
    if (interval >= 1) {
      return interval === 1 ? `${interval} day ago` : `${interval} days ago`;
    }
    
    interval = Math.floor(seconds / 3600);
    if (interval >= 1) {
      return interval === 1 ? `${interval} hour ago` : `${interval} hours ago`;
    }
    
    interval = Math.floor(seconds / 60);
    if (interval >= 1) {
      return interval === 1 ? `${interval} minute ago` : `${interval} minutes ago`;
    }
    
    return seconds < 10 ? 'just now' : `${Math.floor(seconds)} seconds ago`;
  };

  const shareCurrentPage = () => {
    if (navigator.share) {
      navigator.share({
        title: currentUpdate?.title || 'What\'s New',
        text: currentUpdate?.description || '',
        url: window.location.href,
      })
      .catch((error) => console.log('Error sharing:', error));
    } else {
      navigator.clipboard.writeText(window.location.href)
        .then(() => alert('Link copied to clipboard!'))
        .catch(err => console.error('Could not copy link: ', err));
    }
  };

  return (
    <main 
      className="min-h-screen bg-[var(--background)] overflow-hidden"
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="fixed top-0 left-0 w-full z-10 bg-gradient-to-b from-[var(--background)] via-[var(--background-80)] to-transparent h-20 pointer-events-none"></div>
      
      {/* Navigation hints - hide on mobile */}
      {prevPostId && !isLoading && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-20 hidden md:flex items-center justify-center">
          <div className="bg-black bg-opacity-50 text-white text-xs py-1 px-3 rounded-full flex items-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="18 15 12 9 6 15"></polyline>
            </svg>
            <span className="ml-1">Swipe up for previous</span>
          </div>
        </div>
      )}
      
      {/* <div className="fixed top-4 right-4 z-20">
        <Link href="/whats-new" className="bg-black bg-opacity-50 p-2 rounded-full text-white">
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
          >
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </Link>
      </div> */}
      
      <AnimatePresence mode="wait">
        {isLoading ? (
          <SkeletonLoader />
        ) : !currentUpdate ? (
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-center py-8 text-[var(--muted)]">
              Update not found
            </div>
          </div>
        ) : (
          <motion.div 
            key={currentUpdate.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="min-h-screen flex items-center justify-center px-4 sm:px-2 md:px-4 mt-0 sm:mt-4"
          >
            {/* Container for post content and navigation buttons */}
            <div className="relative w-full max-w-4xl flex justify-center items-center">
              {/* Post content with responsive width */}
              <div className="w-full md:w-[640px] lg:w-[700px] bg-[var(--background)] rounded-xl border border-[var(--subtle-divider)] shadow-lg overflow-hidden">
                <div className="p-4 md:p-6">
                  <div className="flex items-start">
                    <div className="mr-3 md:mr-4 flex-shrink-0">
                      <Link href="/whats-new">
                        <div className="w-10 h-10 md:w-12 md:h-12 rounded-full overflow-hidden border border-[var(--subtle-divider)] cursor-pointer">
                          <Image 
                            src="/android-chrome-512x512.png" 
                            alt="Profile" 
                            width={48} 
                            height={48}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </Link>
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center">
                        <h2 className="font-bold text-base md:text-lg text-[var(--foreground)]">Chatflix</h2>
                        <span className="mx-1.5 text-[var(--muted)]">·</span>
                        <span className="text-xs md:text-sm text-[var(--muted)]">{getRelativeTime(currentUpdate.created_at)}</span>
                      </div>
                      
                      <h3 className="font-medium text-lg md:text-xl mt-2 md:mt-3">{currentUpdate.title}</h3>
                      <p className="mt-2 md:mt-3 text-sm md:text-base text-[var(--foreground)]">
                        {convertLinksToHtml(currentUpdate.description)}
                      </p>
                      
                      {currentUpdate.images && currentUpdate.images.length > 0 && (
                        <div className="mt-3 md:mt-5 rounded-xl overflow-hidden border border-[var(--subtle-divider)]">
                          {currentUpdate.images.length === 1 ? (
                            <div 
                              className="cursor-pointer"
                              onClick={() => handleImageClick(currentUpdate.images!, 0)}
                            >
                              <Image 
                                src={currentUpdate.images[0]}
                                alt={currentUpdate.title}
                                width={700}
                                height={400}
                                className="w-full h-auto object-cover max-h-[300px]"
                              />
                            </div>
                          ) : currentUpdate.images.length === 2 ? (
                            <div className="grid grid-cols-2 gap-0.5">
                              {currentUpdate.images.map((img, i) => (
                                <div 
                                  key={i} 
                                  className="cursor-pointer"
                                  onClick={() => handleImageClick(currentUpdate.images!, i)}
                                >
                                  <Image 
                                    src={img}
                                    alt={`${currentUpdate.title} image ${i+1}`}
                                    width={350}
                                    height={350}
                                    className="w-full h-auto object-cover"
                                    style={{ aspectRatio: '1/1' }}
                                  />
                                </div>
                              ))}
                            </div>
                          ) : currentUpdate.images.length === 3 ? (
                            <div className="grid grid-cols-2 gap-0.5">
                              <div 
                                className="row-span-2 cursor-pointer"
                                onClick={() => handleImageClick(currentUpdate.images!, 0)}
                              >
                                <Image 
                                  src={currentUpdate.images[0]}
                                  alt={`${currentUpdate.title} image 1`}
                                  width={350}
                                  height={700}
                                  className="w-full h-full object-cover"
                                  style={{ maxHeight: '350px' }}
                                />
                              </div>
                              <div 
                                className="cursor-pointer"
                                onClick={() => handleImageClick(currentUpdate.images!, 1)}
                              >
                                <Image 
                                  src={currentUpdate.images[1]}
                                  alt={`${currentUpdate.title} image 2`}
                                  width={350}
                                  height={350}
                                  className="w-full h-auto object-cover"
                                  style={{ aspectRatio: '1/1' }}
                                />
                              </div>
                              <div 
                                className="cursor-pointer"
                                onClick={() => handleImageClick(currentUpdate.images!, 2)}
                              >
                                <Image 
                                  src={currentUpdate.images[2]}
                                  alt={`${currentUpdate.title} image 3`}
                                  width={350}
                                  height={350}
                                  className="w-full h-auto object-cover"
                                  style={{ aspectRatio: '1/1' }}
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 gap-0.5">
                              {currentUpdate.images.slice(0, 4).map((img, i) => (
                                <div 
                                  key={i} 
                                  className="cursor-pointer relative"
                                  onClick={() => handleImageClick(currentUpdate.images!, i)}
                                >
                                  <Image 
                                    src={img}
                                    alt={`${currentUpdate.title} image ${i+1}`}
                                    width={350}
                                    height={350}
                                    className="w-full h-auto object-cover"
                                    style={{ aspectRatio: '1/1' }}
                                  />
                                  {i === 3 && currentUpdate.images!.length > 4 && (
                                    <div className="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center">
                                      <span className="text-white font-bold text-2xl">+{currentUpdate.images!.length - 4}</span>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      
                      <div className="flex justify-between items-center mt-4 md:mt-6 pt-3 md:pt-4 border-t border-[var(--subtle-divider)]">
                        {/* Social Actions Component (Like & Bookmark) */}
                        <SocialActions 
                          updateId={updateId}
                          initialLikeCount={likeCount}
                          initialLiked={hasLiked}
                          initialBookmarked={hasBookmarked}
                          initialBookmarkCount={bookmarkCount}
                        />
                        
                        {/* Share Button */}
                        {/* <button 
                          onClick={shareCurrentPage}
                          className="flex items-center text-sm md:text-base text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                        >
                          <svg 
                            xmlns="http://www.w3.org/2000/svg" 
                            width="16" 
                            height="16" 
                            viewBox="0 0 24 24" 
                            fill="none" 
                            stroke="currentColor" 
                            strokeWidth="1.5" 
                            strokeLinecap="round" 
                            strokeLinejoin="round"
                            className="mr-1.5"
                          >
                            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
                            <polyline points="16 6 12 2 8 6"></polyline>
                            <line x1="12" y1="2" x2="12" y2="15"></line>
                          </svg>
                          Share
                        </button> */}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Minimalist navigation buttons */}
              <div className="absolute right-0 md:right-[-12px] lg:right-[-12px] top-1/2 transform -translate-y-1/2 z-20 flex flex-col space-y-8">
                {prevPostId && (
                  <button 
                    onClick={goToPrevPost}
                    className="text-[var(--foreground)] hover:text-[var(--accent)] transition-colors"
                    aria-label="Previous post"
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="18 15 12 9 6 15"></polyline>
                    </svg>
                  </button>
                )}
                
                {nextPostId && (
                  <button 
                    onClick={goToNextPost}
                    className="text-[var(--foreground)] hover:text-[var(--accent)] transition-colors"
                    aria-label="Next post"
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Bottom navigation hint - hide on mobile */}
      {/* {nextPostId && !isLoading && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-20 hidden md:flex items-center justify-center">
          <div className="bg-black bg-opacity-50 text-white text-xs py-1 px-3 rounded-full flex items-center">
            <span className="mr-1">Swipe down for next</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </div>
        </div>
      )} */}
      
      <div className="fixed bottom-0 left-0 w-full z-10 bg-gradient-to-t from-[var(--background)] via-[var(--background-80)] to-transparent h-20 pointer-events-none"></div>
      
      {selectedImages && (
        <ImageModal
          images={selectedImages}
          selectedIndex={selectedImageIndex}
          onClose={closeImageModal}
          onNext={nextImage}
          onPrev={prevImage}
        />
      )}
    </main>
  );
} 