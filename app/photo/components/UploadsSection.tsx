'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { Trash2, Upload, Check, RectangleHorizontal } from 'lucide-react';
import { CustomBackground, PhotoContentProps } from './types';
import ImageViewer from './ImageViewer';
import { usePhotoSelection } from './PhotoContext';
import PhotoActionButtons from './PhotoActionButtons';
import { usePhotoActions } from './usePhotoActions';

// --- Upload Button Card Component ---
const UploadButtonCard = ({ 
  onClick, 
  isUploading 
}: { 
  onClick: () => void;
  isUploading: boolean;
}) => {
  return (
    <div className="relative group aspect-square w-full">
      <div
        className="relative w-full h-full overflow-hidden rounded-lg bg-(--muted)/10 cursor-pointer transition-all duration-300 ease-out active:scale-95 border border-(--muted)/20 hover:border-(--muted)/40 hover:bg-(--muted)/15 flex items-center justify-center"
        onClick={onClick}
      >
        {isUploading ? (
          <div className="flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-2 border-(--foreground)/30 border-t-(--foreground) rounded-full animate-spin" />
            <p className="text-xs text-(--muted)">Uploading...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2">
            <div className="w-10 h-10 rounded-full bg-(--foreground)/10 flex items-center justify-center">
              <Upload size={20} className="text-(--foreground)/60" strokeWidth={1.5} />
            </div>
            <p className="text-xs text-(--muted) font-medium">Upload</p>
          </div>
        )}
      </div>
    </div>
  );
};

// --- Pinterest/Apple Style Image Component ---
const MasonryPhotoCard = ({ 
  bg, 
  onClick, 
  onSelect,
  isSelected,
  isSelectionMode,
  selectedBackground,
  selectedType
}: { 
  bg: CustomBackground; 
  onClick: () => void;
  onSelect: () => void;
  isSelected: boolean;
  isSelectionMode: boolean;
  selectedBackground: string;
  selectedType: 'default' | 'custom';
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const imageUrl = bg.url;

  // Handle cached images: check if image is already complete on mount or URL change
  // Use requestAnimationFrame to allow smooth transition even for cached images
  useEffect(() => {
    const imgElement = imgRef.current;
    if (imgElement?.complete && imgElement.naturalHeight > 0) {
      requestAnimationFrame(() => {
        setIsLoaded(true);
      });
    }
  }, [imageUrl]);

  const handleImageLoad = useCallback(() => {
    setIsLoaded(true);
  }, []);

  return (
    <div
      className={`relative group aspect-square w-full ${
        selectedBackground === bg.id && selectedType === 'custom'
          ? 'ring-4 ring-blue-500 rounded-lg'
          : ''
      }`}
    >
      <div
        className={`relative w-full h-full overflow-hidden rounded-lg bg-[var(--muted)]/10 cursor-pointer transition-all duration-300 ease-out active:scale-95 ${
          selectedBackground === bg.id && selectedType === 'custom'
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
            <img
              ref={imgRef}
              src={imageUrl}
              alt={bg.name}
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
          </>
        ) : (
          <div className="w-full h-full min-h-0 flex items-center justify-center bg-[var(--subtle-divider)] rounded-lg">
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
        {!isSelectionMode && selectedBackground === bg.id && selectedType === 'custom' && (
          <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center pointer-events-none">
            <Check size={24} className="text-white" />
          </div>
        )}
      </div>
    </div>
  );
};

export default function UploadsSection({ 
  user, 
  currentBackground, 
  backgroundType, 
  backgroundId, 
  onBackgroundChange 
}: PhotoContentProps) {
  const [customBackgrounds, setCustomBackgrounds] = useState<CustomBackground[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedBackground, setSelectedBackground] = useState<string>('');
  const [selectedType, setSelectedType] = useState<'default' | 'custom'>('custom');
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  
  // Selection mode state
  const { isSelectionMode, selectedImageIds, handleSelectImage, clearSelection } = usePhotoSelection();
  
  // Image viewer state
  const [viewerImages, setViewerImages] = useState<{src: string, alt: string, id?: string, ai_prompt?: string, ai_json_prompt?: any}[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  
  // Pagination state
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const ITEMS_PER_PAGE = 20;
  const loadMoreRef = useRef<HTMLDivElement>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();
  const router = useRouter();

  // 🚀 게스트 모드 감지
  const isGuest = user?.isAnonymous || user?.id === 'anonymous'

  // Load user's custom backgrounds with pagination
  const loadCustomBackgrounds = useCallback(async (pageNum: number = 0) => {
    if (!user?.id || isGuest) return;
    
    const isInitialLoad = pageNum === 0;
    if (isInitialLoad) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }
    
    try {
      const from = pageNum * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;
      
      const { data, error, count } = await supabase
        .from('user_background_settings')
        .select('*', { count: 'exact' })
        .eq('user_id', user.id)
        .in('source', ['upload', 'pensieve_upload'])
        .eq('bucket_name', 'chat_attachments')
        .order('created_at', { ascending: false })
        .range(from, to);

      // if (error) {
      //   console.error('Error loading custom backgrounds:', error);
      //   return;
      // }

      if (!data || data.length === 0) {
        setHasMore(false);
        return;
      }

      // Generate URLs in parallel (batch of 20)
      const urlPromises = data.map(async (bg) => {
        // Check if URL is still valid, refresh if needed
        let url = bg.background_url;
        if (!bg.background_url || (bg.url_expires_at && new Date(bg.url_expires_at) < new Date())) {
          try {
            // Use correct bucket name from database
            const { data: signedData, error: signedError } = await supabase.storage
              .from(bg.bucket_name || 'chat_attachments')  // ✅ Fix: Use bg.bucket_name
              .createSignedUrl(bg.background_path, 24 * 60 * 60);
            
            if (signedData?.signedUrl) {
              url = signedData.signedUrl;
              // Update the URL in database
              await supabase
                .from('user_background_settings')
                .update({
                  background_url: url,
                  url_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
                })
                .eq('id', bg.id);
            }
          } catch (error) {
            console.error('Error generating signed URL for', bg.background_path, error);
          }
        }

        return {
          id: bg.id,
          path: bg.background_path,
          url: url,
          name: bg.name || 'Custom Background',
          created_at: bg.created_at,
          bucket_name: bg.bucket_name,
          prompt: bg.prompt,
          ai_prompt: bg.ai_prompt,
          ai_json_prompt: bg.ai_json_prompt
        };
      });

      const backgrounds = await Promise.all(urlPromises);
      
      if (isInitialLoad) {
        setCustomBackgrounds(backgrounds);
      } else {
        // Deduplicate by ID before appending to prevent duplicate keys
        setCustomBackgrounds(prev => {
          const existingIds = new Set(prev.map(bg => bg.id));
          const newBackgrounds = backgrounds.filter(bg => !existingIds.has(bg.id));
          return [...prev, ...newBackgrounds];
        });
      }
      
      setHasMore(data.length === ITEMS_PER_PAGE);
    } catch (error) {
      console.error('Error loading custom backgrounds:', error);
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
    // Don't auto-select any background, let user choose
    setSelectedBackground('');
    setSelectedType('custom');
  }, []);

  // Reset pagination when user changes (like Sidebar does)
  useEffect(() => {
    setPage(0);
    setCustomBackgrounds([]);
    setHasMore(true);
    setIsLoadingMore(false);
  }, [user?.id]);

  // Load backgrounds on mount
  useEffect(() => {
    loadCustomBackgrounds(0);
  }, [loadCustomBackgrounds]);

  // Intersection Observer for infinite scroll (improved like Sidebar)
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
      loadCustomBackgrounds(page);
    }
  }, [page, loadCustomBackgrounds]);

  // Image compression function
  const compressImage = async (file: File, maxSizeMB = 2): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = document.createElement('img');
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          // Calculate new dimensions
          let { width, height } = img;
          const maxDimension = 1920; // Max width/height
          
          if (width > height && width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
          
          canvas.width = width;
          canvas.height = height;
          
          ctx?.drawImage(img, 0, 0, width, height);
          
          // Convert PNG to JPEG for better compression, or use original type
          const outputType = file.type === 'image/png' ? 'image/jpeg' : file.type;
          const maxSizeBytes = maxSizeMB * 1024 * 1024;
          
          // Try compression with decreasing quality until size is acceptable
          const tryCompress = (quality: number): void => {
            canvas.toBlob((blob) => {
              if (!blob) {
                reject(new Error('Failed to compress image'));
                return;
              }
              
              // If size is acceptable or quality is too low, use this blob
              if (blob.size <= maxSizeBytes || quality <= 0.5) {
                const compressedFile = new File([blob], file.name.replace(/\.png$/i, '.jpg'), {
                  type: outputType,
                  lastModified: Date.now()
                });
                resolve(compressedFile);
              } else {
                // Try lower quality
                tryCompress(quality - 0.1);
              }
            }, outputType, quality);
          };
          
          // Start with 0.8 quality
          tryCompress(0.8);
        };
        img.onerror = () => {
          reject(new Error('Error loading image'));
        };
      };
      reader.onerror = () => {
        reject(new Error('Error reading file'));
      };
    });
  };

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id || isGuest) return;

    setIsUploading(true);
    try {
      // Compress image if needed
      let fileToUpload = file;
      if (file.size > 2 * 1024 * 1024) { // Compress if larger than 2MB
        try {
          fileToUpload = await compressImage(file, 2);
          console.log(`✅ Compressed image from ${(file.size / 1024 / 1024).toFixed(2)}MB to ${(fileToUpload.size / 1024 / 1024).toFixed(2)}MB`);
        } catch (compressError) {
          console.warn('⚠️ Compression failed, using original file:', compressError);
          // Use original file if compression fails
          fileToUpload = file;
        }
      }

      // Generate unique filename
      const timestamp = new Date().getTime();
      const fileExt = file.name.split('.').pop();
      const fileName = `background_${timestamp}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('chat_attachments')
        .upload(filePath, fileToUpload, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        alert('Failed to upload image. Please try again.');
        // Reset file input on error
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        return;
      }

      // Generate signed URL
      const { data: signedData, error: signedError } = await supabase.storage
        .from('chat_attachments')
        .createSignedUrl(filePath, 24 * 60 * 60);

      if (signedError || !signedData?.signedUrl) {
        console.error('Failed to create signed URL:', signedError);
        alert('Failed to process uploaded image. Please try again.');
        // Reset file input on error
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        return;
      }

      // Save to database
      const { data: insertData, error: insertError } = await supabase
        .from('user_background_settings')
        .insert({
          user_id: user.id,
          background_path: filePath,
          background_url: signedData.signedUrl,
          url_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          name: file.name,
          source: 'upload',
          bucket_name: 'chat_attachments'
        })
        .select()
        .single();

      if (insertError) {
        console.error('Database error:', insertError);
        alert('Failed to save image. Please try again.');
        // Reset file input on error
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        return;
      }

      // Add to local state
      const newBackground: CustomBackground = {
        id: insertData.id,
        path: filePath,
        url: signedData.signedUrl,
        name: file.name,
        created_at: insertData.created_at
      };

      setCustomBackgrounds(prev => [newBackground, ...prev]);
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload image. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

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
      const customBg = customBackgrounds.find(bg => bg.id === selectedBackground);
      if (customBg) {
        onBackgroundChange(customBg.url, 'custom', customBg.id);
      }
    } catch (error) {
      console.error('Error applying background:', error);
      alert('Failed to apply background. Please try again.');
    }
  };

  // Handle image viewer
  const handleImageClick = (imageId: string, e: React.MouseEvent) => {
    // Check if click is on image or container (not delete button)
    const target = e.target as HTMLElement;
    if (target.tagName === 'IMG' || target === e.currentTarget) {
      setViewerImages(customBackgrounds.map(bg => ({ 
        src: bg.url, 
        alt: bg.name || 'Custom background',
        id: bg.id,
        prompt: bg.prompt,
        ai_prompt: bg.ai_prompt,
        ai_json_prompt: bg.ai_json_prompt
      })));
      setViewerIndex(customBackgrounds.findIndex(bg => bg.id === imageId));
      setIsViewerOpen(true);
    } else {
      // If clicking on delete button or other elements, handle background selection
      handleBackgroundSelect(imageId, 'custom');
    }
  };

  // Handle delete custom background
  const handleDeleteBackground = async (backgroundId: string) => {
    if (!user?.id || isGuest) return;
    
    setIsDeleting(backgroundId);
    try {
      const background = customBackgrounds.find(bg => bg.id === backgroundId);
      if (!background) return;

      // Check if this image is set as current background in user_preferences
      const { data: preference } = await supabase
        .from('user_preferences')
        .select('id, selected_background_id, selected_background_type')
        .eq('user_id', user.id)
        .single()

      if (preference && 
          preference.selected_background_type === 'custom' && 
          preference.selected_background_id === backgroundId) {
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
        .from(background.bucket_name || (background.path.includes('chat_attachments') ? 'chat_attachments' : 'background-images'))
        .remove([background.path]);

      if (storageError) {
        console.error('Storage deletion error:', storageError);
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('user_background_settings')
        .delete()
        .eq('id', backgroundId)
        .eq('user_id', user.id);

      if (dbError) {
        console.error('Database deletion error:', dbError);
        alert('Failed to delete image. Please try again.');
        return;
      }

      // Remove from local state
      setCustomBackgrounds(prev => prev.filter(bg => bg.id !== backgroundId));
      
      // If this was the selected background, reset selection
      if (selectedBackground === backgroundId) {
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
    images: customBackgrounds,
    onBackgroundChange,
    handleDeleteBackground,
    setIsViewerOpen: setIsViewerOpen
  });

  // Handle batch delete selected images
  const handleDeleteSelected = async () => {
    if (selectedImageIds.length === 0 || isGuest) return;
    
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
    if (selectedImageIds.length !== 1 || isGuest) return;
    
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
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Content Area with Scroll */}
      <div className="flex-1 overflow-y-auto pb-20">
        {/* Custom Backgrounds Grid */}
        {isLoading && customBackgrounds.length === 0 ? null : (customBackgrounds.length === 0 || isGuest) ? (
          <div className="flex items-center justify-start py-8">
            <div className="text-left max-w-md">
              <h2 className="text-3xl font-semibold tracking-tight text-[var(--foreground)] mb-4">
                No uploads yet.
              </h2>
              <p className="text-sm text-[var(--muted)] mb-4">
                {isGuest ? 'Sign in to upload images.' : 'Images you upload in Messages or Pensieve will appear here.'}
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
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {!isGuest && (
              <UploadButtonCard
                onClick={() => fileInputRef.current?.click()}
                isUploading={isUploading}
              />
            )}
            {customBackgrounds.map((bg, index) => (
              <MasonryPhotoCard
                key={`${bg.id}-${index}`}
                bg={bg}
                isSelectionMode={isSelectionMode}
                isSelected={selectedImageIds.includes(bg.id)}
                onSelect={() => handleSelectImage(bg.id)}
                onClick={() => {
                  setViewerImages(customBackgrounds.map(b => ({
                    src: b.url,
                    alt: b.name || 'Custom background',
                    id: b.id,
                    ai_prompt: b.ai_prompt,
                    ai_json_prompt: b.ai_json_prompt
                  })));
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
