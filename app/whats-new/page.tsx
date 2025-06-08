'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLastSeenUpdate } from '../hooks/useLastSeenUpdate';

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

// Function to convert URLs in text to clickable links and handle bullet points
const convertLinksToHtml = (text: string) => {
  if (!text) return '';
  
  // URL regex pattern to detect links
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  
  // Split by newlines first to handle bullet points
  return text.split('\n').map((line, lineIndex) => {
    // Check if line starts with bullet point (- )
    const isBulletPoint = line.trim().startsWith('- ');
    
    // Remove the bullet dash prefix if it exists
    const cleanLine = isBulletPoint ? line.replace(/^\s*-\s+/, '') : line;
    
    // Process the line for URLs
    const processedLine = cleanLine.split(urlRegex).map((part, i) => {
      // Check if this part matches a URL
      if (urlRegex.test(part)) {
        return (
          <a 
            key={`${lineIndex}-${i}`} 
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
    
    // If it's a bullet point, wrap in list item styling
    if (isBulletPoint) {
      return (
        <div key={lineIndex} className="flex items-start mb-1">
          <span className="mr-2 font-bold">•</span>
          <span>{processedLine}</span>
        </div>
      );
    }
    
    // If it's a normal line, add margin bottom except for the last line
    return (
      <div key={lineIndex} className="mb-1">
        {processedLine}
      </div>
    );
  });
};

export default function WhatsNewPage() {
  const [updates, setUpdates] = useState<FeatureUpdate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { updateLastSeen } = useLastSeenUpdate();
  const [selectedImages, setSelectedImages] = useState<string[] | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [followerCount, setFollowerCount] = useState<number>(0);
  const router = useRouter();
  
  const supabase = createClient();

  // Fetch user count from Supabase auth
  useEffect(() => {
    const fetchUserCount = async () => {
      try {
        // Call the RPC function that accesses auth.users
        const { data, error } = await supabase.rpc('get_auth_user_count');
        
        if (error) {
          console.error('Error fetching auth user count:', error);
          // Fallback to hardcoded value
          // setFollowerCount(351);
          return;
        }
        
        // Set the follower count from the actual data
        setFollowerCount(data);
      } catch (error) {
        console.error('Error in fetchUserCount:', error);
        // Fallback to hardcoded value
        // setFollowerCount(351);
      }
    };

    fetchUserCount();
  }, [supabase]);

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

        // Transform data to include like and bookmark counts
        const updatesWithCounts = await Promise.all(data.map(async (update) => {
          // Get like count
          const { data: likeCountData, error: likeCountError } = await supabase
            .rpc('get_like_count', { update_id_param: update.id });
          
          // Get bookmark count
          const { data: bookmarkCountData, error: bookmarkCountError } = await supabase
            .from('update_bookmarks')
            .select('id', { count: 'exact' })
            .eq('update_id', update.id);
          
          return {
            id: update.id,
            title: update.title,
            description: update.description,
            created_at: update.created_at,
            images: update.images || [],
            like_count: likeCountError ? 0 : (likeCountData || 0),
            bookmark_count: bookmarkCountError ? 0 : (bookmarkCountData?.length || 0)
          };
        }));
        
        setUpdates(updatesWithCounts);

        // Update the last seen update
        if (data.length > 0) {
          updateLastSeen(data[0].id, new Date(data[0].created_at).getTime());
        }
      } catch (error) {
        console.error('Error in fetchUpdates:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUpdates();
    
    // 게시물에 대한 실시간 변경사항 구독
    const featureChannel = supabase
      .channel('public:feature_updates')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'feature_updates' }, 
        () => {
          fetchUpdates();
        }
      )
      .subscribe();
      
    return () => {
      featureChannel.unsubscribe();
    };
  }, [supabase, updateLastSeen]);
  
  // 좋아요 및 북마크에 대한 실시간 변경사항 구독
  useEffect(() => {
    if (updates.length === 0) return;
    
    // 각 게시물별로 좋아요와 북마크 변경 감지를 위한 채널 생성
    const channels = updates.map(update => {
      // 좋아요 변경 감지
      const likesChannel = supabase
        .channel(`likes-${update.id}`)
        .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'update_likes', filter: `update_id=eq.${update.id}` }, 
          () => {
            updateLikeCount(update.id);
          }
        )
        .subscribe();

      // 북마크 변경 감지
      const bookmarksChannel = supabase
        .channel(`bookmarks-${update.id}`)
        .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'update_bookmarks', filter: `update_id=eq.${update.id}` }, 
          () => {
            updateBookmarkCount(update.id);
          }
        )
        .subscribe();
        
      return { likesChannel, bookmarksChannel };
    });
    
    return () => {
      channels.forEach(({ likesChannel, bookmarksChannel }) => {
        likesChannel.unsubscribe();
        bookmarksChannel.unsubscribe();
      });
    };
  }, [supabase, updates]);

  const handleImageClick = (e: React.MouseEvent, images: string[], index: number) => {
    e.stopPropagation(); // Prevent navigating to the post page
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
      return interval === 1 ? `${interval}y` : `${interval}y`;
    }
    
    interval = Math.floor(seconds / 2592000);
    if (interval >= 1) {
      return interval === 1 ? `${interval}mo` : `${interval}mo`;
    }
    
    interval = Math.floor(seconds / 86400);
    if (interval >= 1) {
      return interval === 1 ? `${interval}d` : `${interval}d`;
    }
    
    interval = Math.floor(seconds / 3600);
    if (interval >= 1) {
      return interval === 1 ? `${interval}h` : `${interval}h`;
    }
    
    interval = Math.floor(seconds / 60);
    if (interval >= 1) {
      return interval === 1 ? `${interval}m` : `${interval}m`;
    }
    
    return seconds < 10 ? `now` : `${Math.floor(seconds)}s`;
  };

  // Navigate to single post page
  const navigateToPost = (updateId: string) => {
    router.push(`/whats-new/${updateId}`);
  };

  // 좋아요 수만 업데이트하는 함수
  const updateLikeCount = async (updateId: string) => {
    try {
      const { data, error } = await supabase
        .rpc('get_like_count', { update_id_param: updateId });
      
      if (!error) {
        setUpdates(prevUpdates => 
          prevUpdates.map(update => 
            update.id === updateId 
              ? { ...update, like_count: data || 0 } 
              : update
          )
        );
      }
    } catch (error) {
      console.error('Error updating like count:', error);
    }
  };

  // 북마크 수만 업데이트하는 함수
  const updateBookmarkCount = async (updateId: string) => {
    try {
      const { data, error } = await supabase
        .from('update_bookmarks')
        .select('id', { count: 'exact' })
        .eq('update_id', updateId);
      
      if (!error) {
        setUpdates(prevUpdates => 
          prevUpdates.map(update => 
            update.id === updateId 
              ? { ...update, bookmark_count: data?.length || 0 } 
              : update
          )
        );
      }
    } catch (error) {
      console.error('Error updating bookmark count:', error);
    }
  };

  return (
    <main className="min-h-screen bg-[var(--background)]">
      <div className="max-w-2xl mx-auto py-8 px-4">
        <div className="flex items-center mb-8">
          <Link href="/" className="mr-4">
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
          <h1 className="text-2xl font-bold text-[var(--foreground)]">What's New</h1>
        </div>
        
        {/* Twitter-like profile banner */}
        <div className="mb-8 rounded-xl overflow-hidden border border-[var(--subtle-divider)]">
          {/* Cover image */}
          <div className="h-32 sm:h-48 relative">
            <Image 
              src="/music2.png"
              alt="Cover"
              fill
              className="object-cover"
              priority
            />
            <div className="absolute -bottom-12 left-4 border-4 border-[var(--background)] rounded-full bg-[var(--background)]">
              <Image 
                src="/android-chrome-512x512.png" 
                alt="Chatflix" 
                width={80} 
                height={80}
                className="w-20 h-20 rounded-full object-cover"
              />
            </div>
          </div>
          
          {/* Profile info */}
          <div className="pt-14 pb-4 px-4">
            <div className="flex flex-col">
              <h2 className="text-xl font-bold">Chatflix</h2>
              <span className="text-[var(--muted)] text-sm">@chatflix</span>
              
              <p className="my-3">
                {/* Keep up with the latest features and improvements to Chatflix. 
                <br /> */}
                Inquiry: <a href="mailto:sply@chatflix.app" className="text-[#1d9bf0] hover:underline">sply@chatflix.app</a>
              </p>
              
              {/* Github link in Twitter style */}
              {/* <div className="flex items-center text-sm mb-3">
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  width="18" 
                  height="18" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="1.5" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                  className="mr-2 text-[#536471]"
                >
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                </svg>
                <a 
                  href="https://github.com/DatoBHJ/chatflix" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-[#1d9bf0] hover:underline"
                >
                  github.com/DatoBHJ/chatflix
                </a>
              </div> */}
              <div className="flex items-center text-sm mb-3">
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  width="18" 
                  height="18" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="1.5" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                  className="mr-2 text-[#536471]"
                >
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                </svg>
                <a 
                  href="https://open.spotify.com/album/7sFZGbkCitoqQz7Rt3LoKg" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-[#1d9bf0] hover:underline"
                >
                  open.spotify.com/album/7sFZGbkCito...
                </a>
              </div>
              
              <div className="flex items-center mt-1 text-sm">
                {/* <span className="mr-4">
                  <span className="font-semibold">{updates.length}</span> <span className="text-[var(--muted)]">Posts</span>
                </span> */}
                {/* <span className="mr-4">
                  <span className="font-semibold">{followerCount}</span> <span className="text-[var(--muted)]">Followers</span>
                </span> */}
                {/* <span className="mr-4">
                  <span className="font-semibold">{new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span> <span className="text-[var(--muted)]">Joined</span>
                </span> */}
              </div>
            </div>
          </div>
        </div>
        
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--foreground)]"></div>
          </div>
        ) : updates.length === 0 ? (
          <div className="text-center py-8 text-[var(--muted)]">
            No updates available
          </div>
        ) : (
          <div className="space-y-6">
            {updates.map((update) => (
              <div 
                key={update.id} 
                className="p-4 rounded-xl border border-[var(--subtle-divider)] bg-[var(--background)] hover:bg-[var(--accent)] cursor-pointer transition-colors"
                onClick={() => navigateToPost(update.id)}
              >
                <div className="flex items-start">
                  <div className="mr-3 flex-shrink-0">
                    <div className="w-12 h-12 rounded-full overflow-hidden border border-[var(--subtle-divider)] cursor-pointer" onClick={(e) => e.stopPropagation()}>
                      <Link href="/whats-new">
                        <Image 
                          src="/android-chrome-512x512.png" 
                          alt="Profile" 
                          width={48} 
                          height={48}
                          className="w-full h-full object-cover"
                        />
                      </Link>
                    </div>
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center">
                      <h2 className="font-bold text-[var(--foreground)]">Chatflix</h2>
                      <span className="mx-1 text-[var(--muted)]">·</span>
                      <span className="text-sm text-[var(--muted)]">{getRelativeTime(update.created_at)}</span>
                    </div>
                    
                    <h3 className="font-medium text-lg mt-1">{update.title}</h3>
                    <div className="mt-1 text-[var(--foreground)]">
                      {convertLinksToHtml(update.description)}
                    </div>
                    
                    {update.images && update.images.length > 0 && (
                      <div className="mt-3 rounded-xl overflow-hidden border border-[var(--subtle-divider)]">
                        {update.images.length === 1 ? (
                          <div 
                            className="cursor-pointer"
                            onClick={(e) => handleImageClick(e, update.images!, 0)}
                          >
                            <Image 
                              src={update.images[0]}
                              alt={update.title}
                              width={500}
                              height={280}
                              className="w-full h-auto object-cover"
                            />
                          </div>
                        ) : update.images.length === 2 ? (
                          <div className="grid grid-cols-2 gap-0.5">
                            {update.images.map((img, i) => (
                              <div 
                                key={i} 
                                className="cursor-pointer"
                                onClick={(e) => handleImageClick(e, update.images!, i)}
                              >
                                <Image 
                                  src={img}
                                  alt={`${update.title} image ${i+1}`}
                                  width={250}
                                  height={250}
                                  className="w-full h-auto object-cover"
                                  style={{ aspectRatio: '1/1' }}
                                />
                              </div>
                            ))}
                          </div>
                        ) : update.images.length === 3 ? (
                          <div className="grid grid-cols-2 gap-0.5">
                            <div 
                              className="row-span-2 cursor-pointer"
                              onClick={(e) => handleImageClick(e, update.images!, 0)}
                            >
                              <Image 
                                src={update.images[0]}
                                alt={`${update.title} image 1`}
                                width={250}
                                height={500}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div 
                              className="cursor-pointer"
                              onClick={(e) => handleImageClick(e, update.images!, 1)}
                            >
                              <Image 
                                src={update.images[1]}
                                alt={`${update.title} image 2`}
                                width={250}
                                height={250}
                                className="w-full h-auto object-cover"
                                style={{ aspectRatio: '1/1' }}
                              />
                            </div>
                            <div 
                              className="cursor-pointer"
                              onClick={(e) => handleImageClick(e, update.images!, 2)}
                            >
                              <Image 
                                src={update.images[2]}
                                alt={`${update.title} image 3`}
                                width={250}
                                height={250}
                                className="w-full h-auto object-cover"
                                style={{ aspectRatio: '1/1' }}
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-0.5">
                            {update.images.slice(0, 4).map((img, i) => (
                              <div 
                                key={i} 
                                className="cursor-pointer relative"
                                onClick={(e) => handleImageClick(e, update.images!, i)}
                              >
                                <Image 
                                  src={img}
                                  alt={`${update.title} image ${i+1}`}
                                  width={250}
                                  height={250}
                                  className="w-full h-auto object-cover"
                                  style={{ aspectRatio: '1/1' }}
                                />
                                {i === 3 && update.images!.length > 4 && (
                                  <div className="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center">
                                    <span className="text-white font-bold text-xl">+{update.images!.length - 4}</span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div className="flex justify-between items-center mt-4 pt-2 text-[var(--muted)]">
                      <span className="text-sm">{new Date(update.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                      <div className="flex items-center space-x-4">
                        {/* Like count */}
                        <div className="flex items-center text-sm">
                          <svg 
                            xmlns="http://www.w3.org/2000/svg" 
                            width="16" 
                            height="16" 
                            viewBox="0 0 24 24" 
                            fill="none" 
                            stroke="currentColor" 
                            strokeWidth="2" 
                            strokeLinecap="round" 
                            strokeLinejoin="round"
                            className="mr-1"
                          >
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                          </svg>
                          <span>{update.like_count || 0}</span>
                        </div>
                        {/* Bookmark count */}
                        <div className="flex items-center text-sm">
                          <svg 
                            xmlns="http://www.w3.org/2000/svg" 
                            width="16" 
                            height="16" 
                            viewBox="0 0 24 24" 
                            fill="none" 
                            stroke="currentColor" 
                            strokeWidth="2" 
                            strokeLinecap="round" 
                            strokeLinejoin="round"
                            className="mr-1"
                          >
                            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                          </svg>
                          <span>{update.bookmark_count || 0}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
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