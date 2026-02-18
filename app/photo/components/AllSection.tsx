'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Check, Play } from 'lucide-react';
import { PhotoContentProps } from './types';
import ImageViewer from './ImageViewer';
import { usePhotoSelection } from './PhotoContext';
import PhotoActionButtons from './PhotoActionButtons';
import { usePhotoActions } from './usePhotoActions';

// Unified image/video type for all sources
type AllImage = {
  id: string;
  url: string;
  name: string;
  created_at: string;
  source: 'saved' | 'upload';
  path?: string;
  bucket_name?: string;
  prompt?: string;
  ai_prompt?: string;
  ai_json_prompt?: any;
  metadata?: any;
  isVideo?: boolean;
  chatId?: string;
  messageId?: string;
  sourceImageUrl?: string;
};

// --- Pinterest/Apple Style Image/Video Component ---
const MasonryPhotoCard = ({ 
  img, 
  onClick, 
  onSelect,
  isSelected,
  isSelectionMode,
  selectedBackground,
  selectedType,
  disableVideos = false
}: { 
  img: AllImage; 
  onClick: () => void;
  onSelect: () => void;
  isSelected: boolean;
  isSelectionMode: boolean;
  selectedBackground: string;
  selectedType: 'default' | 'custom';
  disableVideos?: boolean;
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const imageUrl = img.url;
  const isVideo = img.isVideo || (img.metadata?.mediaType === 'video');

  // Handle cached images: check if image is already complete on mount or URL change
  // Use requestAnimationFrame to allow smooth transition even for cached images
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
    setIsLoaded(true);
  }, []);

  return (
    <div
      className={`relative group aspect-square w-full ${
        selectedBackground === img.id && selectedType === 'custom'
          ? 'ring-4 ring-blue-500 rounded-lg'
          : ''
      }`}
    >
      <div
        className={`relative w-full h-full overflow-hidden rounded-lg bg-[var(--muted)]/10 transition-all duration-300 ease-out active:scale-95 ${
          selectedBackground === img.id && selectedType === 'custom'
            ? 'ring-2 ring-blue-500'
            : ''
        } ${
          isVideo && disableVideos ? 'opacity-50 pointer-events-none' : 'cursor-pointer'
        }`}
        onClick={(e) => {
          if (isVideo && disableVideos) {
            e.preventDefault()
            e.stopPropagation()
            return
          }
          if (isSelectionMode) {
            onSelect()
          } else {
            onClick()
          }
        }}
      >
        {!imageError ? (
          <>
            {/* Loading Skeleton (Placeholder) */}
            {!isLoaded && (
              <div className="absolute inset-0 bg-[var(--subtle-divider)] animate-pulse z-0" />
            )}
            {isVideo ? (
              <div className="absolute inset-0">
                <video
                  ref={videoRef}
                  src={imageUrl}
                  className={`
                    w-full h-full object-cover transform transition-all duration-700 ease-out
                    ${isLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-105'}
                  `}
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
                alt={img.name || 'Photo'}
                className={`
                  w-full h-full object-cover transform transition-all duration-700 ease-out
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
          <div className="w-full h-full min-h-0 flex items-center justify-center bg-[var(--subtle-divider)] rounded-lg">
                <p className="text-white/70 text-sm">Failed to load</p>
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

export default function AllSection({ 
  user, 
  currentBackground, 
  backgroundType, 
  backgroundId, 
  onBackgroundChange,
  hideActionButtons = false,
  onImageClick,
  disableVideos = false
}: PhotoContentProps) {
  const [allImages, setAllImages] = useState<AllImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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

  // 🚀 게스트 모드 감지
  const isGuest = user?.isAnonymous || user?.id === 'anonymous'

  // Load all images from all sources with pagination
  const loadAllImages = useCallback(async (pageNum: number = 0) => {
    if (!user?.id || isGuest) {
      setIsLoading(false);
      return;
    }

    const isInitialLoad = pageNum === 0;
    if (isInitialLoad) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }
    
    try {
      // Use OR query to combine both conditions in a single query
      // This ensures proper sorting and pagination across all images
      const from = pageNum * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;
      
      const { data, error } = await supabase
        .from('user_background_settings')
        .select('id, background_url, background_path, created_at, name, url_expires_at, bucket_name, source, prompt, ai_prompt, ai_json_prompt, metadata')
        .eq('user_id', user.id)
        .or(`source.in.(saved,pensieve_upload,pensieve_saved),and(source.eq.upload,bucket_name.eq.chat_attachments)`)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) {
        console.error('Error loading images:', error);
        return;
      }

      if (!data || data.length === 0) {
        setHasMore(false);
        if (isInitialLoad) {
          setAllImages([]);
        }
        return;
      }

      // Process all images in parallel (URL refresh no longer blocks sequentially)
      const processedImages = await Promise.all(
        data.map(async (img) => {
          let url = img.background_url;

          // Check if URL needs refresh: missing, expired, or url_expires_at is null
          const needsRefresh = !url ||
            !img.url_expires_at ||
            (img.url_expires_at && new Date(img.url_expires_at) < new Date());

          if (needsRefresh && img.background_path) {
            try {
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
                const bucketName = img.bucket_name ||
                  (img.source === 'upload' ? 'chat_attachments' : 'saved-gallery');

                const { data: signedData } = await supabase.storage
                  .from(bucketName)
                  .createSignedUrl(img.background_path, 24 * 60 * 60);

                if (signedData?.signedUrl) {
                  url = signedData.signedUrl;
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
              if (!url && img.background_path) {
                try {
                  const bucketName = img.bucket_name ||
                    (img.source === 'upload' ? 'chat_attachments' : 'saved-gallery');

                  const { data: signedData } = await supabase.storage
                    .from(bucketName)
                    .createSignedUrl(img.background_path, 24 * 60 * 60);

                  if (signedData?.signedUrl) {
                    url = signedData.signedUrl;
                  }
                } catch {
                  // Fallback failed, url remains as-is
                }
              }
            }
          }

          const sourceValue = img.source === 'pensieve_saved' ? 'saved' : (img.source as 'saved' | 'upload');
          const isVideo = img.metadata?.mediaType === 'video' ||
            (img.background_path && /\.(mp4|webm|mov|avi)$/i.test(img.background_path));
          const chatId = img.metadata?.chatId || null;
          const messageId = img.metadata?.messageId || null;
          const sourceImageUrl = img.metadata?.sourceImageUrl || null;

          return {
            id: img.id,
            url,
            name: img.name || (img.source === 'upload' ? (isVideo ? 'Uploaded video' : 'Uploaded image') : (isVideo ? 'Saved video' : 'Saved image')),
            created_at: img.created_at,
            source: sourceValue,
            path: img.background_path,
            bucket_name: img.bucket_name,
            prompt: img.prompt,
            ai_prompt: img.ai_prompt,
            ai_json_prompt: img.ai_json_prompt,
            metadata: img.metadata,
            isVideo,
            chatId,
            messageId,
            sourceImageUrl
          };
        })
      );
      
      if (isInitialLoad) {
        setAllImages(processedImages);
      } else {
        // Deduplicate by ID before appending
        setAllImages(prev => {
          const existingIds = new Set(prev.map(img => img.id));
          const newImages = processedImages.filter(img => !existingIds.has(img.id));
          return [...prev, ...newImages];
        });
      }
      
      // Check if we have more items
      setHasMore(data.length === ITEMS_PER_PAGE);
    } catch (error) {
      console.error('Error loading all images:', error);
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

  // Initialize selected background
  useEffect(() => {
    setSelectedBackground('');
    setSelectedType('custom');
  }, []);

  // Reset pagination when user changes
  useEffect(() => {
    setPage(0);
    setAllImages([]);
    setHasMore(true);
    setIsLoadingMore(false);
  }, [user?.id]);

  // Load images on mount
  useEffect(() => {
    loadAllImages(0);
  }, [loadAllImages]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    if (!loadMoreRef.current || !hasMore || isLoadingMore) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoadingMore && hasMore) {
          setPage(prev => prev + 1);
        }
      },
      { threshold: 0.1, rootMargin: '200px' }
    );
    
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, page]);

  // Load more when page changes
  useEffect(() => {
    if (page > 0) {
      loadAllImages(page);
    }
  }, [page, loadAllImages]);

  // Handle background selection
  const handleBackgroundSelect = (backgroundId: string, type: 'default' | 'custom') => {
    setSelectedBackground(backgroundId);
    setSelectedType(type);
  };

  // Handle image viewer
  const handleImageClick = (imageId: string, e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'IMG' || target.tagName === 'VIDEO' || target === e.currentTarget) {
      const viewerData = allImages.map(img => ({
        src: img.url,
        alt: img.name || 'Photo',
        id: img.id,
        prompt: img.prompt,
        ai_prompt: img.ai_prompt,
        ai_json_prompt: img.ai_json_prompt,
        isVideo: img.isVideo,
        aspectRatio: img.metadata?.aspectRatio || undefined,
        chatId: img.chatId,
        messageId: img.messageId,
        sourceImageUrl: img.sourceImageUrl
      }));
      setViewerImages(viewerData);
      setViewerIndex(allImages.findIndex(img => img.id === imageId));
      setIsViewerOpen(true);
    } else {
      handleBackgroundSelect(imageId, 'custom');
    }
  };

  // Handle delete image
  const handleDeleteBackground = async (imageId: string) => {
    if (!user?.id || isGuest) return;
    
    setIsDeleting(imageId);
    try {
      const image = allImages.find(img => img.id === imageId);
      if (!image) return;

      // Get the full image data from database
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

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from(imageData.bucket_name || (image.source === 'upload' ? 'chat_attachments' : 'saved-gallery'))
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
      setAllImages(prev => prev.filter(img => img.id !== imageId));

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
    images: allImages.map(img => ({
      id: img.id,
      url: img.url,
      name: img.name
    })),
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
      await Promise.all(selectedImageIds.map(id => handleDeleteBackground(id)));
      clearSelection();
    } catch (error) {
      console.error('Batch delete error:', error);
      alert('Failed to delete some images. Please try again.');
    }
  };

  // Handle set as background for selected image
  const handleSetAsBackground = async () => {
    if (!user?.id || isGuest) {
      alert('Please sign in to change the wallpaper.')
      return
    }
    if (selectedImageIds.length !== 1) return;
    
    const imageId = selectedImageIds[0];
    await handleViewerSetBackground(imageId);
    
    setTimeout(() => {
      clearSelection();
    }, 1000);
  };

  return (
    <div className="w-full flex flex-col h-full">
      {/* Content Area with Scroll */}
      <div className="flex-1 overflow-y-auto pb-20">
        {/* All Images Grid */}
        {isLoading && allImages.length === 0 ? null : (allImages.length === 0 || isGuest) ? (
          <div className="flex items-center justify-start py-8">
            <div className="text-left max-w-md">
              <h2 className="text-3xl font-semibold tracking-tight text-white mb-4">
                No photos yet.
              </h2>
              <p className="text-sm text-white/70 mb-4">
                {isGuest ? 'Sign in to see your photos.' : 'Your photos will appear here.'}
              </p>
              {isGuest ? (
                <a 
                  href="/login"
                  className="text-white/80 hover:text-white hover:underline cursor-pointer text-sm"
                >
                  Sign in
                </a>
              ) : (
                /* Overview link - temporarily disabled
                <a 
                  href="/photo/overview"
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
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {allImages.map((img, index) => (
              <MasonryPhotoCard
                key={`${img.id}-${index}`}
                img={img}
                isSelectionMode={isSelectionMode}
                isSelected={selectedImageIds.includes(img.id)}
                onSelect={() => handleSelectImage(img.id)}
                disableVideos={disableVideos}
                onClick={() => {
                  if (onImageClick) {
                    onImageClick(img.id)
                    return
                  }
                  if (isSelectionMode) {
                    handleSelectImage(img.id)
                    return
                  }
                  const viewerData = allImages.map(i => ({
                    src: i.url,
                    alt: i.name || 'Photo',
                    id: i.id,
                    prompt: i.prompt,
                    ai_prompt: i.ai_prompt,
                    ai_json_prompt: i.ai_json_prompt,
                    isVideo: i.isVideo,
                    aspectRatio: i.metadata?.aspectRatio || undefined,
                    chatId: i.chatId,
                    messageId: i.messageId,
                    sourceImageUrl: i.sourceImageUrl
                  }));
                  setViewerImages(viewerData);
                  setViewerIndex(index);
                  setIsViewerOpen(true);
                }}
                selectedBackground={selectedBackground}
                selectedType={selectedType}
              />
            ))}
          </div>
        )}

        {/* Infinite Scroll Sentinel */}
        {hasMore && (
          <div ref={loadMoreRef} className="w-full h-20" />
        )}

      </div>

      {!hideActionButtons && (
        <PhotoActionButtons
          onSetAsBackground={handleSetAsBackground}
          onDelete={handleDeleteSelected}
          canSetBackground={selectedImageIds.length === 1 && !isGuest}
          canDelete={selectedImageIds.length > 0 && !isGuest}
          isSettingBackground={isSettingBackground}
          isSuccess={isSuccess}
        />
      )}

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

