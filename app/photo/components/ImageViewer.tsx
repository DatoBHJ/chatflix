'use client'

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight, RectangleHorizontal, Trash2, Check, Copy, Code, ChevronDown, Download, Info, ScrollText, Bookmark } from 'lucide-react';
import { getAdaptiveGlassStyleBlur, getIconClassName as getIconClassNameUtil } from '@/app/lib/adaptiveGlassStyle';
import { IMAGE_VIEWER_Z } from '@/app/lib/zIndex';
import { PhotoVideoPlayer } from './PhotoVideoPlayer';
import { useUrlRefresh } from '@/app/hooks/useUrlRefresh';
import { JsonViewer } from '@/app/pensieve/components/UploadImageModal/ui/JsonViewer';

interface ImageViewerProps {
  images: { src: string; alt: string; id?: string; prompt?: string; ai_prompt?: string; ai_json_prompt?: any; isVideo?: boolean; aspectRatio?: string; chatId?: string; messageId?: string; sourceImageUrl?: string }[];
  currentIndex: number;
  isOpen: boolean;
  onClose: () => void;
  user?: { id: string; isAnonymous?: boolean } | null;
  isMobile?: boolean;
  onSetAsBackground?: (imageId: string) => void;
  onDelete?: (imageId: string) => void;
  isSettingBackground?: boolean;
  isDeleting?: boolean;
  isSuccess?: boolean;
  enableSave?: boolean;
  promptMode?: 'all' | 'ai_json_only';
}

export default function ImageViewer({ 
  images, 
  currentIndex, 
  isOpen, 
  onClose, 
  user,
  isMobile = false,
  onSetAsBackground,
  onDelete,
  isSettingBackground = false,
  isDeleting = false,
  isSuccess = false,
  enableSave = false,
  promptMode = 'all'
}: ImageViewerProps) {
  const [selectedImage, setSelectedImage] = useState<{ src: string; alt: string; id?: string; prompt?: string; ai_prompt?: string; ai_json_prompt?: any; isVideo?: boolean; aspectRatio?: string; chatId?: string; messageId?: string; sourceImageUrl?: string } | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isGalleryMode, setIsGalleryMode] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  
  // Mobile UI visibility state
  const [showMobileUI, setShowMobileUI] = useState(false);
  
  // Mobile swipe state
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);

  // Prompt display state
  const [isOverlayVisible, setIsOverlayVisible] = useState(false);
  const [showCopyButton, setShowCopyButton] = useState(false);
  const [copied, setCopied] = useState(false);
  const [promptType, setPromptType] = useState<'prompt' | 'ai_prompt' | 'ai_json_prompt'>('prompt');

  // Save to Gallery state
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  
  // Source image URL refresh
  const { refreshedUrl: refreshedSourceImageUrl } = useUrlRefresh({
    url: selectedImage?.sourceImageUrl || '',
    enabled: !!selectedImage?.sourceImageUrl && isOpen
  });
  const promptOverlayRef = useRef<HTMLDivElement>(null);

  // Check if we're in browser environment for portal rendering
  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  // Collapsed keys for JSON display
  const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(new Set());

  const toggleKey = useCallback((keyPath: string) => {
    setCollapsedKeys(prev => {
      const next = new Set(prev);
      if (next.has(keyPath)) {
        next.delete(keyPath);
      } else {
        next.add(keyPath);
      }
      return next;
    });
  }, []);

  const renderJsonValue = useCallback((value: any, keyPath: string = '', depth: number = 0): React.ReactNode => {
    if (value === null) {
      return <span className="text-white/60">null</span>
    }
    
    if (typeof value === 'string') {
      return <span className="text-white/60">"{value}"</span>
    }
    
    if (typeof value === 'number' || typeof value === 'boolean') {
      return <span className="text-white/60">{String(value)}</span>
    }
    
    if (Array.isArray(value)) {
      const isCollapsed = collapsedKeys.has(keyPath);
      return (
        <div className="ml-4">
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleKey(keyPath);
            }}
            className="flex items-center gap-1 text-white/80 hover:text-white transition-colors"
          >
            {isCollapsed ? (
              <ChevronRight size={14} className="mt-0.5" />
            ) : (
              <ChevronDown size={14} className="mt-0.5" />
            )}
            <span className="text-white/60">[</span>
            <span className="text-white/60">{value.length} items</span>
            <span className="text-white/60">]</span>
          </button>
          {!isCollapsed && (
            <div className="ml-4 mt-1">
              {value.map((item, idx) => (
                <div key={idx} className="mb-1">
                  {renderJsonValue(item, `${keyPath}[${idx}]`, depth + 1)}
                </div>
              ))}
            </div>
          )}
        </div>
      )
    }
    
    if (typeof value === 'object') {
      const isCollapsed = collapsedKeys.has(keyPath);
      const keys = Object.keys(value);
      return (
        <div className="ml-4">
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleKey(keyPath);
            }}
            className="flex items-center gap-1 text-white/80 hover:text-white transition-colors"
          >
            {isCollapsed ? (
              <ChevronRight size={14} className="mt-0.5" />
            ) : (
              <ChevronDown size={14} className="mt-0.5" />
            )}
            <span className="text-white/60">{'{'}</span>
            <span className="text-white/60">{keys.length} keys</span>
            <span className="text-white/60">{'}'}</span>
          </button>
          {!isCollapsed && (
            <div className="ml-4 mt-1">
              {keys.map((key) => {
                const newKeyPath = keyPath ? `${keyPath}.${key}` : key;
                return (
                  <div key={key} className="mb-1">
                    <span className="text-white font-medium">"{key}": </span>
                    {renderJsonValue(value[key], newKeyPath, depth + 1)}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )
    }
    
    return <span className="text-white/60">{String(value)}</span>
  }, [collapsedKeys, toggleKey]);

  const hasStringValue = (value: any) => {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    // 객체나 배열도 truthy로 처리 (ai_json_prompt의 경우)
    if (typeof value === 'object') return Object.keys(value).length > 0;
    return !!value;
  };

  const availablePrompts = useMemo(() => {
    if (!selectedImage) return [];
    const types: Array<'prompt' | 'ai_prompt' | 'ai_json_prompt'> = [];
    if (promptMode === 'ai_json_only') {
      if (hasStringValue(selectedImage.ai_json_prompt)) types.push('ai_json_prompt');
      return types;
    }
    if (hasStringValue(selectedImage.prompt)) types.push('prompt');
    if (hasStringValue(selectedImage.ai_prompt)) types.push('ai_prompt');
    if (hasStringValue(selectedImage.ai_json_prompt)) types.push('ai_json_prompt');
    return types;
  }, [selectedImage, promptMode]);

  const promptLabels: Record<'prompt' | 'ai_prompt' | 'ai_json_prompt', string> = {
    prompt: 'Human Prompt',
    ai_prompt: 'AI Prompt',
    ai_json_prompt: 'AI JSON'
  };

  const currentPrompt = useMemo(() => {
    if (!selectedImage) return '';
    const value = (() => {
      if (promptType === 'prompt') return selectedImage.prompt;
      if (promptType === 'ai_prompt') return selectedImage.ai_prompt;
      if (promptType === 'ai_json_prompt') return selectedImage.ai_json_prompt;
      return '';
    })();
    
    if (value === undefined || value === null) return '';
    
    if (promptType === 'ai_json_prompt') {
      try {
        // ai_json_prompt는 객체일 수 있음
        if (typeof value === 'string') {
          // 이미 문자열이면 JSON 파싱 시도
          try {
            const parsed = JSON.parse(value);
            return JSON.stringify(parsed, null, 2);
          } catch {
            return value;
          }
        } else {
          // 객체면 직접 JSON.stringify
          return JSON.stringify(value, null, 2);
        }
      } catch {
        return '';
      }
    }
    
    // prompt와 ai_prompt는 문자열로 변환
    if (typeof value === 'string') {
      return value;
    } else if (value != null) {
      // null이나 undefined가 아니면 문자열로 변환 시도
      return String(value);
    }
    
    return '';
  }, [selectedImage, promptType]);

  const jsonObject = useMemo(() => {
    if (promptType !== 'ai_json_prompt') return null;
    if (!selectedImage) return null;
    
    const value = selectedImage.ai_json_prompt;
    if (!value) return null;
    
    try {
      return typeof value === 'string' ? JSON.parse(value) : value;
    } catch {
      return null;
    }
  }, [selectedImage, promptType]);

  // Initialize viewer when opened
  useEffect(() => {
    if (isOpen && images.length > 0) {
      const selected = images[currentIndex];
      setSelectedImage(selected);
      setCurrentImageIndex(currentIndex);
      setIsGalleryMode(images.length > 1);
      setShowMobileUI(false);
      setIsOverlayVisible(false);
      setShowCopyButton(false);
      setCollapsedKeys(new Set());
      
      // 디버깅: selectedImage 데이터 확인
      console.log('[ImageViewer] Selected image set:', {
        id: selected.id,
        prompt: selected.prompt,
        ai_prompt: selected.ai_prompt,
        ai_json_prompt: selected.ai_json_prompt,
        chatId: selected.chatId,
        messageId: selected.messageId,
        sourceImageUrl: selected.sourceImageUrl,
        isVideo: selected.isVideo,
        promptType: typeof selected.prompt,
        ai_promptType: typeof selected.ai_prompt,
        chatIdType: typeof selected.chatId
      });
    }
  }, [isOpen, images, currentIndex]);

  useEffect(() => {
    if (!availablePrompts.length) return;
    const priority: Array<'prompt' | 'ai_prompt' | 'ai_json_prompt'> = ['prompt', 'ai_prompt', 'ai_json_prompt'];
    const next = priority.find((type) => availablePrompts.includes(type));
    if (next) {
      setPromptType(next);
      setCollapsedKeys(new Set());
    }
  }, [availablePrompts]);

  useEffect(() => {
    setCollapsedKeys(new Set());
  }, [promptType]);

  const handleCopyPrompt = useCallback(async () => {
    if (!currentPrompt) return;
    try {
      await navigator.clipboard.writeText(currentPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy prompt:', error);
    }
  }, [currentPrompt]);

  // Download handler
  const handleDownload = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedImage) return;
    try {
      const response = await fetch(selectedImage.src);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = selectedImage.alt || 'image';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
    }
  }, [selectedImage]);

  // Save to Gallery handler
  const handleSave = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedImage || selectedImage.isVideo) return;
    
    // Check if user is guest
    const isGuest = !user || user.isAnonymous || user.id === 'anonymous';
    if (isGuest) {
      alert('Please sign in to save images to your gallery.');
      return;
    }
    
    if (isSaving || isSaved) return;
    const src = selectedImage.src;
    const absoluteUrl = src.startsWith('http') ? src : (typeof window !== 'undefined' ? new URL(src, window.location.origin).href : src);
    setIsSaving(true);
    try {
      const response = await fetch('/api/photo/save-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          promptMode === 'ai_json_only'
            ? {
                imageUrl: absoluteUrl,
                prompt: null,
                ai_prompt: null,
                ai_json_prompt: selectedImage.ai_json_prompt ?? null,
                chatId: selectedImage.chatId || null,
                messageId: selectedImage.messageId || null
              }
            : {
                imageUrl: absoluteUrl,
                prompt: selectedImage.prompt || null,
                ai_prompt: selectedImage.ai_prompt || null,
                ai_json_prompt: selectedImage.ai_json_prompt || null,
                chatId: selectedImage.chatId || null,
                messageId: selectedImage.messageId || null
              }
        )
      });
      if (response.ok || response.status === 409) {
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 2000);
      } else {
        const err = await response.json().catch(() => ({}));
        console.error('Save failed:', err);
      }
    } catch (error) {
      console.error('Save error:', error);
    } finally {
      setIsSaving(false);
    }
  }, [selectedImage, promptMode]);

  // Reset Save state when image or open state changes
  useEffect(() => {
    setIsSaving(false);
    setIsSaved(false);
  }, [selectedImage?.src, isOpen]);

  // Info modal state
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [chatPreview, setChatPreview] = useState<{ user: string | null; assistant: string | null } | null>(null);
  const [chatPreviewLoading, setChatPreviewLoading] = useState(false);

  // Prefetch chat preview as soon as an image with chatId is selected (before Info is opened)
  useEffect(() => {
    if (!selectedImage?.chatId) {
      setChatPreview(null);
      setChatPreviewLoading(false);
      return;
    }
    setChatPreviewLoading(true);
    const ctrl = new AbortController();
    const url = `/api/chat/preview?chatId=${selectedImage.chatId}${selectedImage?.messageId ? `&messageId=${selectedImage.messageId}` : ''}`;
    fetch(url, { signal: ctrl.signal })
      .then((res) => (res.ok ? res.json() : { user: null, assistant: null }))
      .then((data: { user: string | null; assistant: string | null }) => {
        setChatPreview(data);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setChatPreview(null);
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setChatPreviewLoading(false);
      });
    return () => ctrl.abort();
  }, [selectedImage?.chatId, selectedImage?.messageId]);

  const handleImageClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isMobile) {
      if (!availablePrompts.length) return;
      setIsOverlayVisible((prev) => !prev);
      setShowCopyButton((prev) => !prev);
    }
  }, [availablePrompts.length, isMobile]);

  const closeImageModal = useCallback(() => {
    setSelectedImage(null);
    setCurrentImageIndex(0);
    setIsGalleryMode(false);
    setShowMobileUI(false);
    onClose();
  }, [onClose]);

  // Gallery navigation functions
  const navigateToNextImage = useCallback(() => {
    if (images.length > 1) {
      const nextIndex = (currentImageIndex + 1) % images.length;
      setCurrentImageIndex(nextIndex);
      setSelectedImage(images[nextIndex]);
    }
  }, [images, currentImageIndex]);

  const navigateToPreviousImage = useCallback(() => {
    if (images.length > 1) {
      const prevIndex = currentImageIndex === 0 ? images.length - 1 : currentImageIndex - 1;
      setCurrentImageIndex(prevIndex);
      setSelectedImage(images[prevIndex]);
    }
  }, [images, currentImageIndex]);

  // Mobile touch handler to toggle UI visibility
  const handleMobileTouch = useCallback(() => {
    if (isMobile) {
      setShowMobileUI(prev => !prev);
    }
  }, [isMobile]);

  // Mobile touch handlers - separate for UI toggle and swipe detection
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isMobile || isOverlayVisible) return;
    
    const touch = e.touches[0];
    setTouchStart({ x: touch.clientX, y: touch.clientY });
    setTouchEnd(null);
  }, [isMobile, isOverlayVisible]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isMobile || isOverlayVisible) return;
    
    const touch = e.touches[0];
    setTouchEnd({ x: touch.clientX, y: touch.clientY });
  }, [isMobile, isOverlayVisible]);

  const handleTouchEnd = useCallback(() => {
    if (!isMobile || !touchStart || !touchEnd || isOverlayVisible) {
      if (isMobile && !isOverlayVisible) {
        handleMobileTouch();
      }
      return;
    }
    
    const deltaX = touchEnd.x - touchStart.x;
    const deltaY = touchEnd.y - touchStart.y;
    const minSwipeDistance = 50;
    
    // Check if it's a swipe
    const isSwipe = Math.abs(deltaX) > minSwipeDistance || Math.abs(deltaY) > minSwipeDistance;
    
    if (isSwipe && isGalleryMode && images.length > 1) {
      // Process swipe navigation
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        // Horizontal swipe
        if (deltaX > 0) {
          navigateToPreviousImage();
        } else {
          navigateToNextImage();
        }
      } else {
        // Vertical swipe
        if (deltaY > 0) {
          navigateToPreviousImage();
        } else {
          navigateToNextImage();
        }
      }
    } else {
      // Not a swipe or no gallery - toggle UI
      handleMobileTouch();
    }
    
    setTouchStart(null);
    setTouchEnd(null);
  }, [isMobile, isGalleryMode, images.length, touchStart, touchEnd, isOverlayVisible, navigateToPreviousImage, navigateToNextImage, handleMobileTouch]);

  // Handle keyboard navigation for image modal and gallery
  useEffect(() => {
    if (!selectedImage && !isGalleryMode) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeImageModal();
      } else if (isGalleryMode && images.length > 1) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          navigateToPreviousImage();
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          navigateToNextImage();
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [selectedImage, isGalleryMode, images.length, navigateToNextImage, navigateToPreviousImage, closeImageModal]);

  if (!isMounted || !isOpen || !selectedImage) {
    return null;
  }

  return createPortal(
    <div 
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center" 
      style={{ zIndex: IMAGE_VIEWER_Z }}
      onClick={closeImageModal}
    >
      {/* Action buttons */}
      {(!isMobile || showMobileUI) && (
        <>
          {/* Set as Wallpaper button - bottom left (only for images) */}
          {onSetAsBackground && selectedImage && !selectedImage.isVideo && (
            <button 
              className="absolute top-4 left-4 px-4 py-3 rounded-full text-white transition-colors z-10 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              style={getAdaptiveGlassStyleBlur()}
              onClick={(e) => {
                e.stopPropagation();
                if (selectedImage.id) {
                  onSetAsBackground(selectedImage.id);
                }
              }}
              disabled={isSettingBackground || isDeleting}
              aria-label="Set as wallpaper"
            >
              {isSettingBackground ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : isSuccess ? (
                <Check size={20} className="text-blue-400" />
              ) : (
                <RectangleHorizontal size={20} className={getIconClassNameUtil(true)} />
              )}
              <span className="text-sm font-medium">Set as Wallpaper</span>
            </button>
          )}

          {/* Close button - top right */}
          <button 
            className="absolute top-4 right-4 p-2 rounded-full text-white transition-colors z-10 cursor-pointer"
            style={getAdaptiveGlassStyleBlur()}
            onClick={closeImageModal}
            aria-label="Close image viewer"
          >
            <X size={24} className={getIconClassNameUtil(true)} />
          </button>

        </>
      )}
      
      {/* Gallery navigation buttons - hidden on mobile */}
      {isGalleryMode && images.length > 1 && !isMobile && (
        <>
          {/* Previous button */}
          <button
            className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full text-white transition-colors z-10 cursor-pointer"
            style={getAdaptiveGlassStyleBlur()}
            onClick={(e) => {
              e.stopPropagation();
              navigateToPreviousImage();
            }}
            aria-label="Previous image"
          >
            <ChevronLeft size={24} className={getIconClassNameUtil(true)} />
          </button>
          
          {/* Next button */}
          <button
            className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full text-white transition-colors z-10 cursor-pointer"
            style={getAdaptiveGlassStyleBlur()}
            onClick={(e) => {
              e.stopPropagation();
              navigateToNextImage();
            }}
            aria-label="Next image"
          >
            <ChevronRight size={24} className={getIconClassNameUtil(true)} />
          </button>
        </>
      )}
      
      {/* Main image/video container */}
      <div 
        className="relative flex items-center justify-center bg-transparent rounded-none overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ 
          width: '100vw', 
          height: '100vh' 
        }}
      >
        <div className={`relative group flex flex-col items-center justify-center w-full h-full ${availablePrompts.length > 0 && !selectedImage.isVideo ? 'cursor-pointer' : ''}`}>
          <div className="relative flex items-center justify-center w-full h-full">
            {selectedImage.isVideo ? (
              <div className="flex items-center justify-center" style={{ maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto' }}>
                <PhotoVideoPlayer
                  url={selectedImage.src}
                  aspectRatio={selectedImage.aspectRatio}
                  isMobile={isMobile}
                  maxWidth="100%"
                  prompt={selectedImage.prompt}
                  sourceImageUrl={selectedImage.sourceImageUrl}
                  chatId={selectedImage.chatId}
                  messageId={selectedImage.messageId}
                />
              </div>
            ) : (
              <img
                src={selectedImage.src}
                alt={selectedImage.alt}
                className={`max-w-full max-h-full w-auto h-auto object-contain transition-opacity duration-300 ${isOverlayVisible ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
                referrerPolicy="no-referrer"
              />
            )}
          </div>

          {/* Prompt overlay - hidden by default, shown on click (only for images) */}
          {!selectedImage.isVideo && availablePrompts.length > 0 && currentPrompt && (
            <div 
              ref={promptOverlayRef}
              className={`prompt-overlay ${isMobile ? 'fixed inset-0 z-[9999]' : 'absolute inset-0 z-20'} text-white transition-opacity duration-300 h-full ${isOverlayVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
            >
              <img
                src={selectedImage.src}
                alt={selectedImage.alt}
                className="absolute inset-0 w-full h-full object-cover z-0"
                style={{
                  filter: 'brightness(0.3) blur(20px)',
                  transform: 'scale(1.1)',
                  objectPosition: 'center'
                }}
              />

              <div className={`relative w-full h-full flex flex-col justify-center items-center text-center ${isMobile ? 'z-20 p-6' : 'z-20 p-6'}`}>
                {availablePrompts.length > 1 && promptMode !== 'ai_json_only' && (
                  <div className="flex flex-wrap gap-2 justify-center">
                    {availablePrompts.map((type) => (
                      <button
                        key={type}
                        className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                          promptType === type
                            ? 'border-white/60 bg-white/10 text-white'
                            : 'border-white/20 text-white/70 hover:border-white/40 hover:text-white'
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setPromptType(type);
                        }}
                      >
                        {promptLabels[type]}
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex flex-col items-center w-full flex-1 min-h-0">
                  <div className="w-full flex justify-center flex-1 min-h-0 overflow-hidden pt-10 sm:pt-28 pb-22 sm:pb-28">
                    <div className={`max-w-3xl w-full h-full overflow-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden px-2 flex flex-col items-start justify-start`}>
                      {/* Source image thumbnail */}
                      {selectedImage.sourceImageUrl && (
                        <div className="mb-3 flex justify-center w-full">
                          <img
                            src={refreshedSourceImageUrl || selectedImage.sourceImageUrl}
                            alt="Source image"
                            className="max-w-[150px] max-h-[150px] object-contain rounded-lg"
                            style={{ maxWidth: '150px', maxHeight: '150px' }}
                          />
                        </div>
                      )}
                      
                      {/* Prompt text */}
                      {promptMode === 'ai_json_only' ? (
                        jsonObject ? (
                          <div className="text-base md:text-lg font-medium leading-relaxed text-white w-full text-left">
                            <JsonViewer data={jsonObject} />
                          </div>
                        ) : (
                          <div className="text-white/50 text-left py-8">No prompt provided</div>
                        )
                      ) : jsonObject && promptType === 'ai_json_prompt' ? (
                        <div className="text-base md:text-lg font-medium leading-relaxed text-white w-full text-left">
                          <JsonViewer data={jsonObject} />
                        </div>
                      ) : (
                        <p
                          className={`text-base md:text-lg font-medium leading-relaxed text-white whitespace-pre-wrap w-full ${
                            promptType === 'ai_json_prompt'
                              ? 'text-left'
                              : 'text-center'
                          } py-8`}
                        >
                          {currentPrompt}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {isOverlayVisible && (
                  <>
                    {/* Done / close button - top right (desktop) / bottom right (mobile) */}
                    <button
                      className={`absolute ${isMobile ? 'bottom-6 right-4' : 'top-4 right-4'} z-30 w-12 h-12 rounded-full flex items-center justify-center cursor-pointer`}
                      style={{
                        color: 'white',
                        backgroundColor: '#007AFF',
                        border: '1px solid #007AFF',
                        boxShadow:
                          '0 8px 40px rgba(0, 122, 255, 0.3), 0 4px 20px rgba(0, 122, 255, 0.2), 0 2px 8px rgba(0, 122, 255, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsOverlayVisible(false);
                        setShowCopyButton(false);
                      }}
                      aria-label="Close prompt overlay"
                    >
                      <Check size={18} />
                    </button>
                    {/* Copy button - center bottom */}
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyPrompt();
                        }}
                        className="px-4 py-2.5 rounded-full text-white transition-colors cursor-pointer flex items-center gap-2"
                        style={getAdaptiveGlassStyleBlur()}
                        aria-label="Copy"
                      >
                        {copied ? <Check size={18} className={getIconClassNameUtil(true)} /> : <Copy size={18} className={getIconClassNameUtil(true)} />}
                        <span className="text-sm font-medium">{copied ? 'Copied!' : 'Copy'}</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Info modal - Apple-style minimal */}
      {showInfoModal && selectedImage?.chatId && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-md z-[10000] flex items-center justify-center p-6"
          onClick={(e) => {
            e.stopPropagation();
            setShowInfoModal(false);
          }}
        >
          <div 
            className="bg-white/5 backdrop-blur-xl rounded-2xl px-6 py-5 max-w-md w-full border border-white/10 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-[300px] overflow-y-auto shrink-0 mb-4">
              {(chatPreviewLoading || (chatPreview?.user || chatPreview?.assistant)) && (
                <div className="mb-4">
                  <p className="text-[10px] uppercase tracking-wider text-white/50 mb-1.5">Conversation</p>
                  {chatPreviewLoading ? (
                    <p className="text-white/50 text-xs">…</p>
                  ) : (
                    <div className="max-h-[260px] overflow-y-auto space-y-0">
                      {chatPreview?.user != null && chatPreview.user !== '' && (
                        <div className="rounded-lg bg-[#007AFF]/10 px-3 py-2 mb-2">
                          <p className="text-[10px] uppercase tracking-wider text-[#007AFF]/80 mb-0.5">You</p>
                          <p className="text-white/80 text-xs leading-relaxed break-words">{chatPreview.user}</p>
                        </div>
                      )}
                      {chatPreview?.assistant != null && chatPreview.assistant !== '' && (
                        <div className="rounded-lg bg-white/5 px-3 py-2">
                          <p className="text-[10px] uppercase tracking-wider text-white/50 mb-0.5">AI</p>
                          <p className="text-white/75 text-xs leading-relaxed break-words">{chatPreview.assistant}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            <a
              href={`/chat/${selectedImage.chatId}${selectedImage.messageId ? `?messageId=${selectedImage.messageId}` : ''}`}
              className="flex items-center justify-center gap-2 w-full py-3 mb-3 rounded-xl text-white font-medium bg-[#007AFF] hover:bg-[#0056b3] active:opacity-90 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              Go to this conversation
            </a>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowInfoModal(false);
              }}
              className="w-full mt-3 py-2.5 text-white/70 text-sm font-medium hover:text-white/90 transition-colors"
              aria-label="Cancel"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Bottom action bar - Download (left), Prompt/Info (center), Delete or Save (right, same slot as Photo app trash) */}
      {!selectedImage.isVideo && !isOverlayVisible && (isMobile ? showMobileUI : true) && (
        <div 
          className="fixed bottom-0 left-0 right-0 z-30 pb-6 pt-4 px-4"
          style={isMobile && !showMobileUI ? { pointerEvents: 'none' } : {}}
        >
          <div 
            className="max-w-lg mx-auto flex items-center justify-between"
            style={isMobile && !showMobileUI ? { pointerEvents: 'auto' } : {}}
          >
            {/* Download button - left */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleDownload}
                className="p-3 rounded-full text-white transition-all cursor-pointer flex items-center justify-center active:scale-95"
                style={getAdaptiveGlassStyleBlur()}
                aria-label="Download"
              >
                <Download size={22} className={getIconClassNameUtil(true)} />
              </button>
            </div>

            {/* Prompt or Info button - center */}
            <div className="flex items-center gap-2">
              {(() => {
                const shouldShowPrompt = availablePrompts.length > 0;
                const shouldShowInfo = !!selectedImage.chatId;
                
                // Button visibility check
                console.log('[ImageViewer] Button visibility check:', {
                  availablePromptsLength: availablePrompts.length,
                  shouldShowPrompt,
                  chatId: selectedImage.chatId,
                  shouldShowInfo,
                  prompt: selectedImage.prompt,
                  ai_prompt: selectedImage.ai_prompt,
                  ai_json_prompt: selectedImage.ai_json_prompt
                });
                
                return (
                  <>
                    {shouldShowPrompt && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsOverlayVisible(true);
                        }}
                        className="px-4 py-2.5 rounded-full text-white transition-all cursor-pointer flex items-center gap-2 active:scale-95"
                        style={getAdaptiveGlassStyleBlur()}
                        aria-label="Show prompt"
                      >
                        <ScrollText size={18} className={getIconClassNameUtil(true)} />
                        <span className="text-sm font-medium">Prompt</span>
                      </button>
                    )}
                    {shouldShowInfo && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowInfoModal(true);
                        }}
                        className="px-4 py-2.5 rounded-full text-white transition-all cursor-pointer flex items-center gap-2 active:scale-95"
                        style={getAdaptiveGlassStyleBlur()}
                        aria-label="Show chat info"
                      >
                        <Info size={18} className={getIconClassNameUtil(true)} />
                        <span className="text-sm font-medium">Info</span>
                      </button>
                    )}
                  </>
                );
              })()}
            </div>

            {/* Delete or Save button - right (same position as Photo app's trash) */}
            {onDelete && selectedImage ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (selectedImage.id && confirm('Are you sure you want to delete this image?')) {
                    onDelete(selectedImage.id);
                  }
                }}
                disabled={isSettingBackground || isDeleting}
                className="p-3 rounded-full text-white transition-all cursor-pointer flex items-center justify-center active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                style={getAdaptiveGlassStyleBlur()}
                aria-label="Delete image"
              >
                {isDeleting ? (
                  <div className="w-[22px] h-[22px] border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Trash2 size={22} className={getIconClassNameUtil(true)} />
                )}
              </button>
            ) : enableSave ? (
              <button
                onClick={handleSave}
                disabled={isSaving || isSaved}
                className="p-3 rounded-full text-white transition-all cursor-pointer flex items-center justify-center active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                style={getAdaptiveGlassStyleBlur()}
                aria-label={isSaving ? 'Saving...' : isSaved ? 'Saved' : 'Save to Gallery'}
              >
                {isSaving ? (
                  <div className="w-[22px] h-[22px] border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : isSaved ? (
                  <Check size={22} className={getIconClassNameUtil(true)} />
                ) : (
                  <Bookmark size={22} className={getIconClassNameUtil(true)} />
                )}
              </button>
            ) : null}
          </div>
        </div>
      )}

    </div>,
    document.body
  );
}
