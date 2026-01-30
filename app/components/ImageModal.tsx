'use client'

import { useState, useCallback, useEffect, useMemo, memo } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight, Download, Bookmark, ScrollText, Check, Copy } from 'lucide-react';
import { getAdaptiveGlassStyleBlur, getIconClassName } from '@/app/lib/adaptiveGlassStyle';
import { IMAGE_VIEWER_Z } from '@/app/lib/zIndex';
import { useUrlRefresh } from '../hooks/useUrlRefresh';

export interface ImageModalImage {
  src: string;
  alt?: string;
  prompt?: string;
  sourceImageUrl?: string;
}

export interface ImageModalProps {
  // 필수
  isOpen: boolean;
  imageUrl: string;
  imageAlt?: string;
  onClose: () => void;
  
  // 갤러리 모드
  gallery?: ImageModalImage[];
  currentIndex?: number;
  onNavigate?: (direction: 'prev' | 'next') => void;
  
  // 프롬프트
  prompt?: string;
  showPromptButton?: boolean;
  
  // 기능 제어
  enableDownload?: boolean;
  enableSave?: boolean;
  enableUrlRefresh?: boolean;
  
  // URL 갱신 (enableUrlRefresh가 true일 때만)
  messageId?: string;
  chatId?: string;
  userId?: string;
  
  // 모바일
  isMobile?: boolean;
  
  // 저장 상태 및 핸들러 (외부에서 관리하는 경우)
  isSaving?: boolean;
  isSaved?: boolean;
  /** imageUrl(저장용 URL), prompt, sourceImageUrl, originalSrc(맵/Set 키용, 미갱신 URL) */
  onSave?: (payload: { imageUrl: string; prompt?: string | null; sourceImageUrl?: string | null; originalSrc?: string }) => Promise<void>;
  
  // 소스 이미지
  sourceImageUrl?: string;
  onSourceImageClick?: (imageUrl: string) => void;
}

export const ImageModal = memo(function ImageModalComponent({
  isOpen,
  imageUrl,
  imageAlt,
  onClose,
  gallery,
  currentIndex = 0,
  onNavigate,
  prompt,
  showPromptButton = false,
  enableDownload = true,
  enableSave = true,
  enableUrlRefresh = false,
  messageId,
  chatId,
  userId,
  isMobile = false,
  isSaving: externalIsSaving,
  isSaved: externalIsSaved,
  onSave: externalOnSave,
  sourceImageUrl,
  onSourceImageClick,
}: ImageModalProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [isOverlayVisible, setIsOverlayVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [showMobileUI, setShowMobileUI] = useState(false);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);
  
  // 내부 저장 상태 (외부에서 제공하지 않는 경우)
  const [internalIsSaving, setInternalIsSaving] = useState(false);
  const [internalIsSaved, setInternalIsSaved] = useState(false);
  
  // 저장 상태 결정 (외부 우선, 없으면 내부)
  const isSaving = externalIsSaving !== undefined ? externalIsSaving : internalIsSaving;
  const isSaved = externalIsSaved !== undefined ? externalIsSaved : internalIsSaved;
  
  // 현재 이미지 정보
  const currentImage = useMemo(() => {
    if (gallery && gallery.length > 0 && currentIndex >= 0 && currentIndex < gallery.length) {
      return gallery[currentIndex];
    }
    return { src: imageUrl, alt: imageAlt, prompt, sourceImageUrl };
  }, [gallery, currentIndex, imageUrl, imageAlt, prompt, sourceImageUrl]);
  
  // 현재 이미지의 소스 이미지 URL (갤러리 모드에서는 gallery에서, 단일 모드에서는 prop에서)
  const currentSourceImageUrl = useMemo(() => {
    if (gallery && gallery.length > 0 && currentIndex >= 0 && currentIndex < gallery.length) {
      return gallery[currentIndex].sourceImageUrl;
    }
    return sourceImageUrl;
  }, [gallery, currentIndex, sourceImageUrl]);
  
  const isGalleryMode = gallery && gallery.length > 1;
  const currentPrompt = currentImage.prompt || prompt;
  const showPrompt = showPromptButton && !!currentPrompt;
  
  // URL 갱신
  const { refreshedUrl: refreshedImageUrl, isRefreshing, refreshUrl } = useUrlRefresh({
    url: currentImage.src,
    messageId,
    chatId,
    userId,
    enabled: enableUrlRefresh && isOpen && !!currentImage.src
  });
  
  // URL 갱신 중이거나 갱신된 URL이 있으면 갱신된 URL 사용, 아니면 원본 URL 사용
  const displayImageUrl = refreshedImageUrl || currentImage.src;
  
  // 소스 이미지 URL 갱신
  const { refreshedUrl: refreshedSourceImageUrl } = useUrlRefresh({
    url: currentSourceImageUrl || '',
    messageId,
    chatId,
    userId,
    enabled: enableUrlRefresh && isOpen && !!currentSourceImageUrl
  });
  
  // 이미지 로드 실패 시 URL 갱신 재시도
  const handleImageError = useCallback(() => {
    if (enableUrlRefresh && !isRefreshing && refreshUrl) {
      // 에러 상태를 초기화하고 URL 갱신 재시도
      setImageError(false);
      refreshUrl();
    } else {
      setImageError(true);
    }
  }, [enableUrlRefresh, isRefreshing, refreshUrl]);
  
  // 마운트 체크
  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);
  
  // 모달이 열릴 때 상태 리셋
  useEffect(() => {
    if (isOpen) {
      setIsOverlayVisible(false);
      setCopied(false);
      setImageError(false);
      setShowMobileUI(false);
      setTouchStart(null);
      setTouchEnd(null);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    
    return () => {
      if (!isOpen) {
        document.body.style.overflow = '';
      }
    };
  }, [isOpen]);
  
  // 키보드 네비게이션
  useEffect(() => {
    if (!isOpen) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isOverlayVisible) {
          setIsOverlayVisible(false);
        } else {
          onClose();
        }
      } else if (!isOverlayVisible && isGalleryMode && onNavigate) {
        if (e.key === 'ArrowLeft') {
          onNavigate('prev');
        } else if (e.key === 'ArrowRight') {
          onNavigate('next');
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isOverlayVisible, isGalleryMode, onNavigate, onClose]);
  
  // 터치 제스처 핸들러
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isMobile) return;
    const touch = e.touches[0];
    setTouchStart({ x: touch.clientX, y: touch.clientY });
    setTouchEnd(null);
  }, [isMobile]);
  
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isMobile) return;
    const touch = e.touches[0];
    setTouchEnd({ x: touch.clientX, y: touch.clientY });
  }, [isMobile]);
  
  const handleTouchEnd = useCallback(() => {
    if (!isMobile || !touchStart || !touchEnd) {
      if (isMobile) {
        setShowMobileUI(prev => !prev);
      }
      return;
    }
    
    const deltaX = touchEnd.x - touchStart.x;
    const deltaY = touchEnd.y - touchStart.y;
    const minSwipeDistance = 50;
    
    const isSwipe = Math.abs(deltaX) > minSwipeDistance || Math.abs(deltaY) > minSwipeDistance;
    
    if (isSwipe && isGalleryMode && onNavigate) {
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        // Horizontal swipe
        if (deltaX > 0) {
          onNavigate('prev');
        } else {
          onNavigate('next');
        }
      } else {
        // Vertical swipe
        if (deltaY > 0) {
          onNavigate('prev');
        } else {
          onNavigate('next');
        }
      }
    } else {
      // Not a swipe or no gallery - toggle UI
      setShowMobileUI(prev => !prev);
    }
    
    setTouchStart(null);
    setTouchEnd(null);
  }, [isMobile, isGalleryMode, onNavigate, touchStart, touchEnd]);
  
  // 프롬프트 복사
  const handleCopyPrompt = useCallback(() => {
    if (!currentPrompt) return;
    navigator.clipboard.writeText(currentPrompt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => {
      console.error('Failed to copy prompt:', err);
    });
  }, [currentPrompt]);
  
  // 다운로드 핸들러
  const handleDownload = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const response = await fetch(displayImageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'image.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      window.open(displayImageUrl, '_blank');
    }
  }, [displayImageUrl]);
  
  // 저장 핸들러
  const handleSave = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // 외부 저장 핸들러가 있으면 사용. displayImageUrl만 넘기면 map lookup 실패할 수 있으므로
    // prompt/sourceImageUrl을 함께 전달 (refreshed URL과 map 키 불일치 해소). originalSrc는 Set/맵 키용.
    if (externalOnSave) {
      await externalOnSave({ imageUrl: displayImageUrl, prompt: currentPrompt || null, sourceImageUrl: currentSourceImageUrl || null, originalSrc: currentImage.src });
      return;
    }
    
    // 내부 저장 로직
    setInternalIsSaving(true);
    try {
      const response = await fetch('/api/photo/save-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          imageUrl: displayImageUrl,
          prompt: currentPrompt || null,
          ai_prompt: null,
          ai_json_prompt: null,
          chatId: chatId || null,
          messageId: messageId || null,
          metadata: {
            sourceImageUrl: currentSourceImageUrl || null
          }
        })
      });
      if (response.ok) {
        setInternalIsSaved(true);
        setTimeout(() => {
          setInternalIsSaved(false);
        }, 2000);
      } else {
        const error = await response.json();
        console.error('Save failed:', error);
      }
    } catch (error) {
      console.error('Save error:', error);
    } finally {
      setInternalIsSaving(false);
    }
  }, [displayImageUrl, externalOnSave, currentPrompt, chatId, messageId, currentSourceImageUrl]);
  
  if (!isMounted || !isOpen) return null;
  
  return createPortal(
    <div 
      className="fixed inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      style={{ zIndex: IMAGE_VIEWER_Z }} 
      onClick={(e) => { if (e.target === e.currentTarget && !isOverlayVisible) onClose() }}
    >
      {/* Blurred background image */}
      {!imageError && displayImageUrl && (
        <img
          src={displayImageUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover z-0"
          style={{
            filter: 'brightness(0.3) blur(20px)',
            transform: 'scale(1.1)',
            objectPosition: 'center'
          }}
          aria-hidden="true"
          onError={() => setImageError(true)}
        />
      )}

      {/* Header - Close button (top right) */}
      {!isOverlayVisible && (isMobile ? showMobileUI : true) && (
        <button 
          className="absolute top-4 right-4 p-2 rounded-full text-white transition-colors cursor-pointer z-10000"
          style={getAdaptiveGlassStyleBlur()}
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          aria-label="Close"
        >
          <X size={24} className={getIconClassName(true)} />
        </button>
      )}

      {/* Pagination dots (top center) */}
      {!isOverlayVisible && isGalleryMode && gallery && gallery.length > 1 && (
        <div className="absolute top-8 left-1/2 -translate-x-1/2 z-10000 flex gap-1.5 px-3 py-1.5 rounded-full" style={getAdaptiveGlassStyleBlur()}>
          {gallery.length <= 3 ? (
            Array.from({ length: gallery.length }).map((_, idx) => (
              <div 
                key={idx}
                className={`w-1 h-1 rounded-full transition-all duration-300 ${
                  idx === currentIndex ? 'bg-white scale-125' : 'bg-white/30'
                }`}
              />
            ))
          ) : (
            [0, 1, 2].map((dotIdx) => {
              let isActive = false;
              if (currentIndex === 0) isActive = dotIdx === 0;
              else if (currentIndex === gallery.length - 1) isActive = dotIdx === 2;
              else isActive = dotIdx === 1;

              return (
                <div 
                  key={dotIdx}
                  className={`w-1 h-1 rounded-full transition-all duration-300 ${
                    isActive ? 'bg-white scale-125' : 'bg-white/30'
                  }`}
                />
              );
            })
          )}
        </div>
      )}

      {/* Content - Main image */}
      <div 
        className="relative flex items-center justify-center bg-transparent overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ 
          width: '100vw', 
          height: '100vh' 
        }}
      >
        <div className="relative group flex flex-col items-center justify-center z-10 w-full h-full">
          <div className="relative flex items-center justify-center w-full h-full">
            <div 
              className={`relative w-full h-full ${imageError ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
            >
              <img
                src={displayImageUrl}
                alt={currentImage.alt || 'Image'}
                className={`w-full h-full object-contain transition-opacity duration-300 ${isOverlayVisible ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
                onError={handleImageError}
                referrerPolicy="no-referrer"
                key={displayImageUrl} // URL이 변경되면 이미지 재로드
              />
            </div>
            
            {imageError && (
              <div className="absolute inset-0 flex items-center justify-center text-white/50">
                <p>Failed to load image</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Navigation buttons (desktop only) */}
      {!isMobile && !isOverlayVisible && isGalleryMode && gallery && gallery.length > 1 && onNavigate && (
        <>
          {currentIndex > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onNavigate('prev');
              }}
              className="fixed left-4 top-1/2 -translate-y-1/2 z-30 p-3 rounded-full text-white transition-all hover:scale-110 active:scale-95 cursor-pointer"
              style={getAdaptiveGlassStyleBlur()}
              aria-label="Previous image"
            >
              <ChevronLeft size={24} className={getIconClassName(true)} />
            </button>
          )}
          
          {currentIndex < gallery.length - 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onNavigate('next');
              }}
              className="fixed right-4 top-1/2 -translate-y-1/2 z-30 p-3 rounded-full text-white transition-all hover:scale-110 active:scale-95 cursor-pointer"
              style={getAdaptiveGlassStyleBlur()}
              aria-label="Next image"
            >
              <ChevronRight size={24} className={getIconClassName(true)} />
            </button>
          )}
        </>
      )}

      {/* Bottom action bar - Download, Prompt, Save */}
      {!isOverlayVisible && (isMobile ? showMobileUI : true) && (
        <div className="fixed bottom-0 left-0 right-0 z-30 pb-6 pt-4 px-4">
          <div className="max-w-lg mx-auto flex items-center justify-between">
            {/* Download button - left */}
            {enableDownload && (
              <button
                onClick={handleDownload}
                className="p-3 rounded-full text-white transition-all cursor-pointer flex items-center justify-center active:scale-95"
                style={getAdaptiveGlassStyleBlur()}
                aria-label="Download"
              >
                <Download size={22} className={getIconClassName(true)} />
              </button>
            )}

            {/* Prompt button - center */}
            {showPrompt && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOverlayVisible(true);
                }}
                className="px-4 py-2.5 rounded-full text-white transition-all cursor-pointer flex items-center gap-2 active:scale-95"
                style={getAdaptiveGlassStyleBlur()}
                aria-label="Show prompt"
              >
                <ScrollText size={18} className={getIconClassName(true)} />
                <span className="text-sm font-medium">Prompt</span>
              </button>
            )}

            {/* Save button - right */}
            {enableSave && (
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="p-3 rounded-full text-white transition-all cursor-pointer flex items-center justify-center active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                style={getAdaptiveGlassStyleBlur()}
                aria-label="Save"
              >
                {isSaving ? (
                  <div className="w-[22px] h-[22px] border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : isSaved ? (
                  <Check size={22} className={getIconClassName(true)} />
                ) : (
                  <Bookmark size={22} className={getIconClassName(true)} />
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Prompt Overlay */}
      {currentPrompt && (
        <div 
          className={`fixed inset-0 z-9999 text-white transition-opacity duration-300 ${isOverlayVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
          style={{
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100vw',
            minWidth: '100vw',
            height: '100vh',
            minHeight: '100vh',
            overflow: 'hidden'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsOverlayVisible(false);
            }
          }}
        >
          {/* Background */}
          {displayImageUrl && (
            <img
              src={displayImageUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover z-0"
              style={{
                filter: 'brightness(0.3) blur(20px)',
                transform: 'scale(1.1)',
                objectPosition: 'center'
              }}
            />
          )}

          <div className="relative w-full h-full flex flex-col justify-center items-center text-center z-20 p-6">
            {/* Prompt content */}
            <div className="flex flex-col items-center w-full flex-1 min-h-0">
              <div className="w-full flex justify-center flex-1 min-h-0 overflow-hidden pt-10 sm:pt-28 pb-22 sm:pb-28">
                <div className="max-w-3xl w-full h-full overflow-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden px-2 flex flex-col items-start justify-start">
                  {/* 소스 이미지 썸네일 */}
                  {currentSourceImageUrl && (
                    <div className="mb-3 flex justify-center w-full">
                      <img
                        src={refreshedSourceImageUrl || currentSourceImageUrl}
                        alt="Source image"
                        className={`max-w-[150px] max-h-[150px] object-contain rounded-lg ${onSourceImageClick ? 'cursor-pointer' : ''}`}
                        style={{ maxWidth: '150px', maxHeight: '150px' }}
                        onClick={() => onSourceImageClick?.(refreshedSourceImageUrl || currentSourceImageUrl)}
                        role={onSourceImageClick ? 'button' : undefined}
                      />
                    </div>
                  )}
                  
                  {/* 프롬프트 텍스트 */}
                  {currentPrompt ? (
                    <div className="text-base md:text-lg font-medium leading-relaxed text-white w-full text-left py-8 whitespace-pre-wrap">
                      {currentPrompt}
                    </div>
                  ) : (
                    <div className="text-white/50 text-left py-8">
                      No prompt available
                    </div>
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
                    {copied ? <Check size={18} className={getIconClassName(true)} /> : <Copy size={18} className={getIconClassName(true)} />}
                    <span className="text-sm font-medium">{copied ? 'Copied!' : 'Copy'}</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>,
    document.body
  );
});
