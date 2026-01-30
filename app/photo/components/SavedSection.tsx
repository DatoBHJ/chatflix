'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { Check, Trash2, RectangleHorizontal, Image as ImageIcon, Play } from 'lucide-react';
import Masonry from 'react-masonry-css';
import { SavedImage, PhotoContentProps } from './types';
import ImageViewer from './ImageViewer';
import { usePhotoSelection } from './PhotoContext';
import PhotoActionButtons from './PhotoActionButtons';
import { usePhotoActions } from './usePhotoActions';

// --- Pinterest/Apple Style Image/Video Component ---
const MasonryPhotoCard = ({ 
  img, 
  onClick, 
  onSelect,
  isSelected,
  isSelectionMode,
  selectedBackground,
  selectedType
}: { 
  img: SavedImage; 
  onClick: () => void;
  onSelect: () => void;
  isSelected: boolean;
  isSelectionMode: boolean;
  selectedBackground: string;
  selectedType: 'default' | 'custom';
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [videoAspectRatio, setVideoAspectRatio] = useState<number | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const imageUrl = img.url;
  const isVideo = (img as any).isVideo || ((img as any).metadata?.mediaType === 'video');

  // Handle cached images/videos: check if image/video is already complete on mount or URL change
  // Use requestAnimationFrame to allow smooth transition even for cached media
  useEffect(() => {
    if (isVideo) {
      const videoElement = videoRef.current;
      if (videoElement && videoElement.readyState >= 2) {
        requestAnimationFrame(() => {
          setIsLoaded(true);
        });
      }
    } else {
      const imgElement = imgRef.current;
      if (imgElement?.complete && imgElement.naturalHeight > 0) {
        requestAnimationFrame(() => {
          setIsLoaded(true);
        });
      }
    }
  }, [imageUrl, isVideo]);

  const handleImageLoad = useCallback(() => {
    setIsLoaded(true);
  }, []);

  const handleVideoLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (video && video.videoWidth > 0 && video.videoHeight > 0) {
      // 비디오 메타데이터에서 정확한 aspect ratio 감지
      const ratio = video.videoWidth / video.videoHeight;
      setVideoAspectRatio(ratio);
    }
    setIsLoaded(true);
  }, []);

  return (
    <div 
      className={`relative group mb-3 break-inside-avoid ${
        selectedBackground === img.id && selectedType === 'custom'
          ? 'ring-4 ring-blue-500 rounded-lg'
          : ''
      }`}
    >
      <div 
        className={`relative overflow-hidden rounded-lg bg-[var(--muted)]/10 cursor-pointer transition-all duration-300 ease-out active:scale-95 ${
          selectedBackground === img.id && selectedType === 'custom'
            ? 'ring-2 ring-blue-500'
            : ''
        }`}
        onClick={isSelectionMode ? onSelect : onClick}
      >
        {!imageError ? (
          <>
            {/* Loading Skeleton (Placeholder) */}
            {!isLoaded && (
              <div className="absolute inset-0 bg-[var(--subtle-divider)] animate-pulse z-0" />
            )}
            {isVideo ? (
              <div 
                className="relative w-full"
                style={videoAspectRatio ? { aspectRatio: `${videoAspectRatio} / 1` } : undefined}
              >
                <video
                  ref={videoRef}
                  src={imageUrl}
                  className={`
                    w-full h-full object-cover transform transition-all duration-700 ease-out
                    ${isLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-105'}
                  `}
                  style={videoAspectRatio ? { aspectRatio: `${videoAspectRatio} / 1` } : undefined}
                  onLoadedMetadata={handleVideoLoadedMetadata}
                  onError={() => {
                    setImageError(true);
                    setIsLoaded(false);
                  }}
                  preload="metadata"
                  muted
                  playsInline
                />
              </div>
            ) : (
              <img
                ref={imgRef}
                src={imageUrl}
                alt={img.name || 'Saved image'}
                className={`
                  w-full h-auto object-cover transform transition-all duration-700 ease-out
                  ${isLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-105'}
                `}
                onLoad={handleImageLoad}
                onError={() => {
                  setImageError(true);
                  setIsLoaded(false);
                }}
                loading="lazy"
                decoding="async"
              />
            )}
          </>
        ) : (
          <div className="w-full min-h-[200px] flex items-center justify-center bg-[var(--subtle-divider)] rounded-lg">
            <p className="text-[var(--muted)] text-sm">Failed to load</p>
          </div>
        )}

        {/* Selection Checkmark */}
        {isSelectionMode && isSelected && (
          <div className="absolute bottom-2 right-2 z-20">
            <div className="bg-[#007AFF] rounded-full p-1 shadow-sm">
              <Check size={14} strokeWidth={3} className="text-white" />
            </div>
          </div>
        )}

        {/* Selection Overlay (Dimming) */}
        {isSelectionMode && isSelected && (
          <div className="absolute inset-0 bg-black/20 z-10 transition-all duration-300" />
        )}

        {/* Selected Indicator */}
        {!isSelectionMode && selectedBackground === img.id && selectedType === 'custom' && (
          <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center pointer-events-none">
            <Check size={24} className="text-white" />
          </div>
        )}

        {/* Video Icon Overlay */}
        {isVideo && !isSelectionMode && (
          <div className="absolute top-2 right-2 z-20">
            <div className="bg-black/60 backdrop-blur-sm rounded-full p-1.5 flex items-center justify-center">
              <Play size={14} fill="white" className="text-white ml-0.5" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default function SavedSection({ 
  user, 
  currentBackground, 
  backgroundType, 
  backgroundId, 
  onBackgroundChange 
}: PhotoContentProps) {
  const [savedImages, setSavedImages] = useState<SavedImage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedBackground, setSelectedBackground] = useState<string>('');
  const [selectedType, setSelectedType] = useState<'default' | 'custom'>('custom');
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  
  // Selection mode state
  const { isSelectionMode, selectedImageIds, handleSelectImage, clearSelection } = usePhotoSelection();
  
  // Image viewer state
  const [viewerImages, setViewerImages] = useState<{src: string, alt: string, id?: string, prompt?: string, ai_prompt?: string, ai_json_prompt?: any, isVideo?: boolean, aspectRatio?: string, chatId?: string, messageId?: string, sourceImageUrl?: string}[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  
  // Pagination state
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const ITEMS_PER_PAGE = 20;
  const loadMoreRef = useRef<HTMLDivElement>(null);
  
  const supabase = createClient();
  const router = useRouter();


  // 🚀 게스트 모드 감지
  const isGuest = user?.isAnonymous || user?.id === 'anonymous'

  // Load saved images from database with pagination
  const loadSavedImages = useCallback(async (pageNum: number = 0) => {
    if (!user?.id || isGuest) return;
    
    console.log(`🔄 [SavedSection] Loading page ${pageNum} for user ${user.id}`);
    
    const isInitialLoad = pageNum === 0;
    if (isInitialLoad) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }
    
    try {
      const from = pageNum * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;
      
      const { data, error } = await supabase
        .from('user_background_settings')
        .select('id, background_url, background_path, created_at, name, url_expires_at, bucket_name, source, prompt, ai_prompt, ai_json_prompt, metadata')
        .eq('user_id', user.id)
        .in('source', ['saved', 'pensieve_upload', 'pensieve_saved'])
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) {
        console.error('Error loading saved images:', error);
        return;
      }

      if (!data || data.length === 0) {
        setHasMore(false);
        return;
      }

      // 디버깅: 데이터베이스에서 가져온 원본 데이터 확인
      console.log('[SavedSection] Raw data from DB:', data.slice(0, 2).map(img => ({
        id: img.id,
        prompt: img.prompt,
        ai_prompt: img.ai_prompt,
        ai_json_prompt: img.ai_json_prompt,
        metadata: img.metadata,
        promptType: typeof img.prompt,
        ai_promptType: typeof img.ai_prompt
      })));

      // Check and refresh expired URLs
      const refreshedData = await Promise.all(
        data.map(async (img) => {
          let url = img.background_url;
          
          // Check if URL needs refresh: missing, expired, or url_expires_at is null
          const needsRefresh = !url || 
            !img.url_expires_at || 
            (img.url_expires_at && new Date(img.url_expires_at) < new Date());
          
          if (needsRefresh && img.background_path) {
            try {
              // Try API first (works for all source types now)
              const response = await fetch('/api/photo/refresh-url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  userId: user.id,
                  imageId: img.id 
                })
              });
              
              if (response.ok) {
                const refreshed = await response.json();
                url = refreshed.imageUrl;
              } else {
                // Fallback to direct Supabase call if API fails
                const bucketName = img.bucket_name || 'saved-gallery';
                
                const { data: signedData } = await supabase.storage
                  .from(bucketName)
                  .createSignedUrl(img.background_path, 24 * 60 * 60);
                
                if (signedData?.signedUrl) {
                  url = signedData.signedUrl;
                  // Update database
                  await supabase
                    .from('user_background_settings')
                    .update({
                      background_url: url,
                      url_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
                    })
                    .eq('id', img.id);
                }
              }
            } catch (error) {
              console.error('Failed to refresh URL for image:', img.id, error);
              // If both API and direct call fail, try direct Supabase as last resort
              if (!url && img.background_path) {
                try {
                  const bucketName = img.bucket_name || 'saved-gallery';
                  
                  const { data: signedData } = await supabase.storage
                    .from(bucketName)
                    .createSignedUrl(img.background_path, 24 * 60 * 60);
                  
                  if (signedData?.signedUrl) {
                    url = signedData.signedUrl;
                  }
                } catch (fallbackError) {
                  console.error('Fallback URL generation also failed:', fallbackError);
                }
              }
            }
          }
          
          // Check if this is a video based on metadata
          const isVideo = img.metadata?.mediaType === 'video' || 
                         (img.background_path && /\.(mp4|webm|mov|avi)$/i.test(img.background_path));
          
          // Extract chatId, messageId, and sourceImageUrl from metadata
          const chatId = img.metadata?.chatId || null;
          const messageId = img.metadata?.messageId || null;
          const sourceImageUrl = img.metadata?.sourceImageUrl || null;
          
          return { 
            id: img.id, 
            url: url, 
            created_at: img.created_at,
            name: img.name || (isVideo ? 'Saved video' : 'Saved image'),
            prompt: img.prompt,
            ai_prompt: img.ai_prompt,
            ai_json_prompt: img.ai_json_prompt,
            metadata: img.metadata,
            isVideo: isVideo,
            chatId: chatId,
            messageId: messageId,
            sourceImageUrl: sourceImageUrl
          };
        })
      );
      
      if (isInitialLoad) {
        setSavedImages(refreshedData);
      } else {
        setSavedImages(prev => [...prev, ...refreshedData]);
      }
      
      setHasMore(data.length === ITEMS_PER_PAGE);
    } catch (error) {
      console.error('Error loading saved images:', error);
    } finally {
      if (isInitialLoad) {
        setIsLoading(false);
      } else {
        setIsLoadingMore(false);
      }
    }
  }, [user?.id, supabase, ITEMS_PER_PAGE, isGuest]);

  // 🚀 게스트 모드: 로딩 완료 처리
  useEffect(() => {
    if (isGuest && isLoading) {
      setIsLoading(false);
    }
  }, [isGuest, isLoading]);

  // Initialize selected background - don't auto-select anything
  useEffect(() => {
    setSelectedBackground('');
    setSelectedType('custom');
  }, []);

  // Reset pagination when user changes
  useEffect(() => {
    setPage(0);
    setSavedImages([]);
    setHasMore(true);
    setIsLoadingMore(false);
    console.log(`🔄 [SavedSection] Reset state for user: ${user?.id}`);
  }, [user?.id]);

  // Load images on mount
  useEffect(() => {
    loadSavedImages(0);
  }, [loadSavedImages]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    if (!loadMoreRef.current || !hasMore || isLoadingMore) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoadingMore && hasMore) {
          console.log(`🔄 [SavedSection] Loading page ${page + 1}`);
          setPage(prev => prev + 1);
        }
      },
      { threshold: 0.1 }
    );
    
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, page]);

  // Load more when page changes
  useEffect(() => {
    if (page > 0) {
      loadSavedImages(page);
    }
  }, [page, loadSavedImages]);

  // Handle background selection
  const handleBackgroundSelect = (backgroundId: string, type: 'default' | 'custom') => {
    setSelectedBackground(backgroundId);
    setSelectedType(type);
  };

  // Glass style for hover buttons
  const getGlassStyle = () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark' || 
      (document.documentElement.getAttribute('data-theme') === 'system' && 
       window.matchMedia('(prefers-color-scheme: dark)').matches)
    
    return isDark ? {
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      boxShadow: '0 8px 40px rgba(0, 0, 0, 0.15), 0 4px 20px rgba(0, 0, 0, 0.1), 0 2px 8px rgba(0, 0, 0, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
    } : {
      backgroundColor: 'rgba(255, 255, 255, 0.8)',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      boxShadow: '0 8px 40px rgba(0, 0, 0, 0.06), 0 4px 20px rgba(0, 0, 0, 0.04), 0 2px 8px rgba(0, 0, 0, 0.025), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
    }
  };

  // Handle apply background
  const handleApplyBackground = async () => {
    if (!user?.id || isGuest) return;

    try {
      // Save preference to database
      const response = await fetch('/api/background/set-preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          backgroundType: selectedType,
          backgroundId: selectedBackground
        })
      });

      if (!response.ok) {
        console.error('Failed to save preference');
        alert('Failed to save background preference. Please try again.');
        return;
      }

      // Update local state
      const savedImg = savedImages.find(img => img.id === selectedBackground);
      if (savedImg) {
        onBackgroundChange(savedImg.url, 'custom', savedImg.id);
      }
    } catch (error) {
      console.error('Error applying background:', error);
      alert('Failed to apply background. Please try again.');
    }
  };

  // Handle image viewer
  const handleImageClick = (imageId: string, e: React.MouseEvent) => {
    // Check if click is on image/video or container (not delete button)
    const target = e.target as HTMLElement;
    if (target.tagName === 'IMG' || target.tagName === 'VIDEO' || target === e.currentTarget) {
      const viewerData = savedImages.map(img => ({ 
        src: img.url, 
        alt: img.name || 'Saved image',
        id: img.id,
        prompt: img.prompt,
        ai_prompt: img.ai_prompt,
        ai_json_prompt: img.ai_json_prompt,
        isVideo: (img as any).isVideo,
        aspectRatio: (img as any).metadata?.aspectRatio || undefined,
        chatId: img.chatId,
        messageId: img.messageId,
        sourceImageUrl: img.sourceImageUrl
      }));
      
      // 디버깅: 전달되는 데이터 확인
      const clickedImage = savedImages.find(img => img.id === imageId);
      if (clickedImage) {
        console.log('[SavedSection] Image clicked:', {
          id: clickedImage.id,
          prompt: clickedImage.prompt,
          ai_prompt: clickedImage.ai_prompt,
          ai_json_prompt: clickedImage.ai_json_prompt,
          chatId: clickedImage.chatId,
          messageId: clickedImage.messageId,
          sourceImageUrl: clickedImage.sourceImageUrl,
          metadata: (clickedImage as any).metadata
        });
      }
      
      setViewerImages(viewerData);
      setViewerIndex(savedImages.findIndex(img => img.id === imageId));
      setIsViewerOpen(true);
    } else {
      // If clicking on delete button or other elements, handle background selection
      handleBackgroundSelect(imageId, 'custom');
    }
  };

  // Handle delete background
  const handleDeleteBackground = async (imageId: string) => {
    if (!user?.id || isGuest) return;
    
    setIsDeleting(imageId);
    try {
      const image = savedImages.find(img => img.id === imageId);
      if (!image) return;

      // Get the full image data from database to access bucket_name and path
      const { data: imageData, error: fetchError } = await supabase
        .from('user_background_settings')
        .select('background_path, bucket_name')
        .eq('id', imageId)
        .single();

      if (fetchError || !imageData) {
        console.error('Failed to fetch image data:', fetchError);
        alert('Failed to delete image. Please try again.');
        return;
      }

      // Check if this image is set as current background in user_preferences
      const { data: preference } = await supabase
        .from('user_preferences')
        .select('id, selected_background_id, selected_background_type')
        .eq('user_id', user.id)
        .single()

      if (preference && 
          preference.selected_background_type === 'custom' && 
          preference.selected_background_id === imageId) {
        // Reset to default background
        await supabase
          .from('user_preferences')
          .update({
            selected_background_type: 'default',
            selected_background_id: 'default-1'
          })
          .eq('user_id', user.id)
      }

      // Delete from storage using bucket_name from database
      const { error: storageError } = await supabase.storage
        .from(imageData.bucket_name || 'saved-gallery')
        .remove([imageData.background_path]);

      if (storageError) {
        console.error('Storage deletion error:', storageError);
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('user_background_settings')
        .delete()
        .eq('id', imageId)
        .eq('user_id', user.id);

      if (dbError) {
        console.error('Database deletion error:', dbError);
        alert('Failed to delete image. Please try again.');
        return;
      }

      // Remove from local state
      setSavedImages(prev => prev.filter(img => img.id !== imageId));

      // If the deleted image was selected, clear selection
      if (selectedBackground === imageId) {
        setSelectedBackground('');
        setSelectedType('custom');
      }

    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete image. Please try again.');
    } finally {
      setIsDeleting(null);
    }
  };

  // Photo actions hook
  const {
    isSettingBackground,
    isSuccess,
    viewerDeletingId,
    handleViewerSetBackground,
    handleViewerDelete
  } = usePhotoActions({
    user,
    images: savedImages,
    onBackgroundChange,
    handleDeleteBackground,
    setIsViewerOpen: setIsViewerOpen
  });

  // Handle batch delete selected images
  const handleDeleteSelected = async () => {
    if (selectedImageIds.length === 0) return;
    
    if (!window.confirm(`Are you sure you want to delete ${selectedImageIds.length} image(s)?`)) {
      return;
    }

    try {
      // Delete all selected images
      await Promise.all(selectedImageIds.map(id => handleDeleteBackground(id)));
      
      // Clear selection
      clearSelection();
    } catch (error) {
      console.error('Batch delete error:', error);
      alert('Failed to delete some images. Please try again.');
    }
  };


  // Handle set as background for selected image
  const handleSetAsBackground = async () => {
    if (selectedImageIds.length !== 1) return;
    
    const imageId = selectedImageIds[0];
    // Use the hook's function for consistency
    await handleViewerSetBackground(imageId);
    
    // Clear selection after success
    setTimeout(() => {
      clearSelection();
    }, 1000);
  };

  return (
    <div className="w-full flex flex-col h-full">
      {/* Content Area with Scroll */}
      <div className="flex-1 overflow-y-auto pb-20">
        {/* Saved Images Grid */}
        {isLoading && savedImages.length === 0 ? null : (savedImages.length === 0 || isGuest) ? (
          <div className="flex items-center justify-start py-8">
            <div className="text-left max-w-md">
              <h2 className="text-3xl font-semibold tracking-tight text-[var(--foreground)] mb-4">
                Nothing saved yet.
              </h2>
              <p className="text-sm text-[var(--muted)] mb-4">
                {isGuest ? 'Sign in to save images.' : 'Saved images will appear here.'}
              </p>
              {isGuest ? (
                <a 
                  href="/login"
                  className="text-blue-500 hover:underline cursor-pointer text-sm"
                >
                  Sign in
                </a>
              ) : (
                /* Overview link - temporarily disabled
                <a 
                  href="/photo"
                  className="text-blue-500 hover:underline cursor-pointer text-sm"
                >
                  Explore the Overview
                </a>
                */
                null
              )}
            </div>
          </div>
        ) : (
          <Masonry
            breakpointCols={{
              default: 5,      // Desktop: 5 columns
              1024: 4,         // Large tablet: 4 columns  
              640: 3,          // Tablet: 3 columns
              480: 2           // Mobile: 2 columns
            }}
            className="flex -ml-3 w-auto"
            columnClassName="pl-3 bg-clip-padding"
          >
            {/* Render Images using new Component */}
            {savedImages.map((img, index) => (
              <MasonryPhotoCard
                key={`${img.id}-${index}`}
                img={img}
                isSelectionMode={isSelectionMode}
                isSelected={selectedImageIds.includes(img.id)}
                onSelect={() => handleSelectImage(img.id)}
                onClick={() => {
                  const viewerData = savedImages.map(i => ({ 
                    src: i.url, 
                    alt: i.name || 'Saved image',
                    id: i.id,
                    prompt: i.prompt,
                    ai_prompt: i.ai_prompt,
                    ai_json_prompt: i.ai_json_prompt,
                    isVideo: (i as any).isVideo,
                    aspectRatio: (i as any).metadata?.aspectRatio || undefined,
                    chatId: i.chatId,
                    messageId: i.messageId,
                    sourceImageUrl: i.sourceImageUrl
                  }));
                  
                  // 디버깅: 전달되는 데이터 확인
                  const clickedImage = savedImages[index];
                  if (clickedImage) {
                    console.log('[SavedSection] Image clicked (Masonry):', {
                      id: clickedImage.id,
                      prompt: clickedImage.prompt,
                      ai_prompt: clickedImage.ai_prompt,
                      ai_json_prompt: clickedImage.ai_json_prompt,
                      chatId: clickedImage.chatId,
                      messageId: clickedImage.messageId,
                      sourceImageUrl: clickedImage.sourceImageUrl,
                      metadata: (clickedImage as any).metadata
                    });
                  }
                  
                  setViewerImages(viewerData);
                  setViewerIndex(index);
                  setIsViewerOpen(true);
                }}
                selectedBackground={selectedBackground}
                selectedType={selectedType}
              />
            ))}
          </Masonry>
        )}

        {/* Infinite Scroll Sentinel */}
        {hasMore && (
          <div ref={loadMoreRef} className="w-full h-20" />
        )}

      </div>

      <PhotoActionButtons
        onSetAsBackground={handleSetAsBackground}
        onDelete={handleDeleteSelected}
        canSetBackground={selectedImageIds.length === 1 && !isGuest}
        canDelete={selectedImageIds.length > 0 && !isGuest}
        isSettingBackground={isSettingBackground}
        isSuccess={isSuccess}
      />

      {/* Image Viewer */}
      <ImageViewer
        images={viewerImages}
        currentIndex={viewerIndex}
        isOpen={isViewerOpen}
        onClose={() => setIsViewerOpen(false)}
        user={user}
        isMobile={typeof window !== 'undefined' && window.innerWidth < 768}
        onSetAsBackground={handleViewerSetBackground}
        onDelete={handleViewerDelete}
        isSettingBackground={isSettingBackground}
        isDeleting={viewerDeletingId !== null}
        isSuccess={isSuccess}
      />
    </div>
  );
}

