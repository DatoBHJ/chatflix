'use client';

import React, { memo, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, LayoutGrid, Download, Bookmark, ScrollText, Check, Copy } from 'lucide-react';
import { getAdaptiveGlassStyleBlur, getIconClassName } from '@/app/lib/adaptiveGlassStyle';
import { useLazyMedia } from '../hooks/useIntersectionObserver';
import { categorizeAspectRatio, parseImageDimensions, parseMediaDimensions, getAspectCategory } from '@/app/utils/imageUtils';
import { useUrlRefresh } from '../hooks/useUrlRefresh';
import { ImageModal, type ImageModalImage } from './ImageModal';

// 🚀 VENICE STYLE: 고정 컨테이너 크기로 레이아웃 시프트 완전 방지
// 핵심: 컨테이너 크기가 이미지 로드 전후로 절대 변하지 않음
function parseAspectRatioString(ar: string): number | null {
  if (!ar || typeof ar !== 'string') return null;
  const parts = ar.split(/[/:]/).map((n) => parseInt(n.trim(), 10));
  if (parts.length >= 2 && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1]) && parts[0] > 0 && parts[1] > 0) {
    return parts[0] / parts[1];
  }
  return null;
}

const SimpleImageWithLoading = memo(function SimpleImageWithLoadingComponent({ 
  src, 
  alt, 
  className = "",
  style,
  onImageClick,
  showHoverActions = false,
  prompt,
  sourceImageUrl,
  onSourceImageClick,
  chatId,
  messageId,
  aspectRatio: aspectRatioProp
}: { 
  src: string; 
  alt: string; 
  className?: string;
  style?: React.CSSProperties;
  onImageClick?: () => void;
  showHoverActions?: boolean;
  prompt?: string;
  sourceImageUrl?: string;
  onSourceImageClick?: (imageUrl: string) => void;
  chatId?: string;
  messageId?: string;
  aspectRatio?: string; // e.g. "16/9" for layout stability (prop first, then URL, then measure)
}) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  
  // Save 상태
  const [savingImage, setSavingImage] = useState(false);
  const [savedImage, setSavedImage] = useState(false);
  
  // Prompt 오버레이 상태
  const [showPromptOverlay, setShowPromptOverlay] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Mount state for portal
  const [isMounted, setIsMounted] = useState(false);
  
  // Mobile detection
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    setIsMounted(true);
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => {
      window.removeEventListener('resize', checkMobile);
      setIsMounted(false);
    };
  }, []);
  
  const { ref: lazyRef, shouldLoad } = useLazyMedia();

  const { refreshedUrl: refreshedSourceImageUrl } = useUrlRefresh({
    url: sourceImageUrl || '',
    enabled: shouldLoad && !!sourceImageUrl
  });

  // 🚀 prop → URL → hidden image measure; once set, container size never changes
  const [initialAspectRatio, setInitialAspectRatio] = useState<number | null>(() => {
    const fromProp = aspectRatioProp ? parseAspectRatioString(aspectRatioProp) : null;
    if (fromProp != null) return fromProp;
    if (!src) return null;
    const dimensions = parseMediaDimensions(src);
    return dimensions ? dimensions.width / dimensions.height : null;
  });
  const measurementImgRef = useRef<HTMLImageElement | null>(null);

  // 🚀 URL에서 크기 정보를 못 찾았으면 숨겨진 이미지로 빠르게 측정
  // 측정된 비율은 initialAspectRatio에 저장되어 컨테이너 크기가 변경되지 않음
  useEffect(() => {
    if (shouldLoad && src && !initialAspectRatio) {
      const img = new globalThis.Image();
      img.style.display = 'none';
      img.style.position = 'absolute';
      img.style.visibility = 'hidden';
      img.style.width = '1px';
      img.style.height = '1px';
      document.body.appendChild(img);
      measurementImgRef.current = img;
      
      img.src = src;
      
      if (img.complete) {
        if (img.naturalWidth > 0 && img.naturalHeight > 0) {
          setInitialAspectRatio(img.naturalWidth / img.naturalHeight);
        }
        document.body.removeChild(img);
        measurementImgRef.current = null;
      } else {
        img.onload = () => {
          if (img.naturalWidth > 0 && img.naturalHeight > 0) {
            setInitialAspectRatio(img.naturalWidth / img.naturalHeight);
          }
          if (img.parentNode) {
            document.body.removeChild(img);
          }
          measurementImgRef.current = null;
        };
        img.onerror = () => {
          if (img.parentNode) {
            document.body.removeChild(img);
          }
          measurementImgRef.current = null;
        };
      }
    }

    return () => {
      if (measurementImgRef.current?.parentNode) {
        document.body.removeChild(measurementImgRef.current);
        measurementImgRef.current = null;
      }
    };
  }, [src, shouldLoad, initialAspectRatio]);


  // 다운로드 핸들러
  const handleDownload = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const response = await fetch(src);
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
      // Fallback: open in new tab
      window.open(src, '_blank');
    }
  }, [src]);

  // Save to Gallery 핸들러 (호버 시 노출). prompt, sourceImageUrl 포함해 Photo 앱에 저장.
  const handleSave = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (savingImage || savedImage) return;
    setSavingImage(true);
    try {
      const response = await fetch('/api/photo/save-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: src,
          prompt: prompt || null,
          ai_prompt: null,
          ai_json_prompt: null,
          chatId: chatId || null,
          messageId: messageId || null,
          metadata: { sourceImageUrl: sourceImageUrl || null }
        })
      });
      if (response.ok) {
        setSavedImage(true);
      } else {
        const error = await response.json();
        console.error('Save failed:', error);
      }
    } catch (error) {
      console.error('Save error:', error);
    } finally {
      setSavingImage(false);
    }
  }, [src, prompt, sourceImageUrl, chatId, messageId, savingImage, savedImage]);

  // Prompt 복사 핸들러
  const handleCopyPrompt = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!prompt) return;
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (error) {
      console.error('Copy failed:', error);
    }
  }, [prompt]);

  // 이미지 로드 완료 핸들러
  const handleImageLoad = useCallback(() => {
    setIsLoaded(true);
    // initialAspectRatio가 아직 설정되지 않았으면 최종 확인
    if (imgRef.current && !initialAspectRatio) {
      const img = imgRef.current;
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        setInitialAspectRatio(img.naturalWidth / img.naturalHeight);
      }
    }
  }, [initialAspectRatio]);

  // 🚀 근본적 해결: 컨테이너 크기를 초기에 한 번만 설정하고 절대 변경하지 않음
  // aspectRatio가 변경되어도 컨테이너 크기는 유지 (이미지만 크롭)
  // 🚀 근본적 해결: 컨테이너 크기를 초기에 한 번만 설정하고 절대 변경하지 않음
  // initialAspectRatio만 사용하여 레이아웃 시프트 완전 방지
  const containerStyle: React.CSSProperties = useMemo(() => {
    const baseStyle: React.CSSProperties = {
      ...style,
      maxWidth: '100%',
      width: '100%',
      backgroundColor: 'rgb(38, 38, 38)',
      height: 'auto',
    };
    
    // 초기 비율만 사용 (이미지 로드 후에도 변경되지 않음)
    // URL에서 추출한 비율이 있으면 사용, 없으면 안정적인 기본값(16:9)으로 고정
    const finalAspectRatio = initialAspectRatio || 16/9;
    baseStyle.aspectRatio = `${finalAspectRatio}`;
    
    return baseStyle;
  }, [style, initialAspectRatio]);

  if (error) {
    return null;
  }

  return (
    <div 
      ref={lazyRef}
      className="generated-image-container relative rounded-2xl overflow-hidden"
      style={{
        ...containerStyle,
        // GPU 가속으로 레이아웃 변경 성능 향상
        transform: 'translateZ(0)',
        // 레이아웃 격리로 부모에 영향 최소화
        isolation: 'isolate',
      }}
    >
      {/* 🚀 VENICE: Skeleton shimmer while loading */}
      {!isLoaded && (
        <div className="absolute inset-0 skeleton-shimmer" />
      )}
      
      {/* 🚀 이미지가 컨테이너를 꽉 채우도록 표시 */}
      <img
        ref={imgRef}
        src={shouldLoad ? src : undefined}
        alt={alt}
        className={`w-full h-full object-cover transition-opacity duration-200 ${isLoaded ? 'opacity-100' : 'opacity-0'} ${onImageClick ? 'cursor-pointer' : ''} ${className}`}
        onClick={onImageClick}
        onLoad={handleImageLoad}
        onError={() => {
          setError(true);
          setIsLoaded(true);
        }}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        style={{ 
          border: 'none', 
          outline: 'none',
          objectFit: 'cover',
          width: '100%',
          height: '100%',
        }}
      />
      
      {/* 🚀 호버 액션 오버레이 */}
      {showHoverActions && !showPromptOverlay && (
        <div className="image-hover-overlay">
          <div className="image-hover-gradient" />
          <div className="absolute bottom-2 right-2 flex gap-1">
            <button 
              className="image-action-btn"
              onClick={handleDownload}
              aria-label="Download"
            >
              <Download size={18} />
            </button>
            {prompt && (
              <button 
                className="image-action-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowPromptOverlay(true);
                }}
                aria-label="Show prompt"
              >
                <ScrollText size={18} />
              </button>
            )}
            <button 
              className="image-action-btn"
              onClick={handleSave}
              disabled={savingImage || savedImage}
              aria-label={savingImage ? 'Saving...' : savedImage ? 'Saved' : 'Save to Gallery'}
            >
              {savingImage ? (
                <div className="w-[18px] h-[18px] border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : savedImage ? (
                <Check size={18} />
              ) : (
                <Bookmark size={18} />
              )}
            </button>
          </div>
        </div>
      )}

      {/* 프롬프트 오버레이 */}
      {prompt && isMounted ? createPortal(
        <div 
          className={`fixed inset-0 z-[9999] text-white transition-opacity duration-300 ${showPromptOverlay ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
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
            e.stopPropagation();
          }}
        >
          {/* 배경: 블러 처리된 이미지 */}
          <img
            src={src}
            alt={alt}
            className="absolute inset-0 w-full h-full object-cover z-0"
            style={{
              filter: 'brightness(0.3) blur(20px)',
              transform: 'scale(1.1)',
              objectPosition: 'center'
            }}
          />

          <div className="relative w-full h-full flex flex-col justify-center items-center text-center z-20 p-6">
            {/* Prompt content */}
            <div className="flex flex-col items-center w-full flex-1 min-h-0">
              <div className="w-full flex justify-center flex-1 min-h-0 overflow-hidden pt-10 sm:pt-28 pb-22 sm:pb-28">
                <div className="max-w-3xl w-full h-full overflow-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden px-2 flex flex-col items-start justify-start">
                  {/* 소스 이미지 썸네일 */}
                  {sourceImageUrl && (
                    <div className="mb-3 flex justify-center w-full">
                      <img
                        src={refreshedSourceImageUrl || sourceImageUrl}
                        alt="Source image"
                        className="max-w-[150px] max-h-[150px] object-contain rounded-lg"
                        style={{ maxWidth: '150px', maxHeight: '150px' }}
                      />
                    </div>
                  )}
                  
                  {/* 프롬프트 텍스트 */}
                  <div className="text-base md:text-lg font-medium leading-relaxed text-white w-full text-left py-8 whitespace-pre-wrap">
                    {prompt}
                  </div>
                </div>
              </div>
            </div>

            {showPromptOverlay && (
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
                    setShowPromptOverlay(false);
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
                      handleCopyPrompt(e);
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
        </div>,
        document.body
      ) : null}
    </div>
  );
});

interface ImageData {
  src: string;
  alt: string;
  originalMatch?: string;
  prompt?: string;
  sourceImageUrl?: string;
  aspectRatio?: string; // e.g. "16/9" for layout stability (reserve space before load)
}

// 갤러리 그리드 아이템 컴포넌트 (각각 자체 Save 상태 관리)
const GalleryGridItem = memo(function GalleryGridItemComponent({
  image,
  index,
  ratioType,
  onImageLoad,
  onImageClick,
  onSourceImageClick,
  chatId,
  messageId
}: {
  image: ImageData;
  index: number;
  ratioType: string;
  onImageLoad: (index: number, e: React.SyntheticEvent<HTMLImageElement>) => void;
  onImageClick: () => void;
  onSourceImageClick?: (imageUrl: string) => void;
  chatId?: string;
  messageId?: string;
}) {
  const [savingImage, setSavingImage] = useState(false);
  const [savedImage, setSavedImage] = useState(false);
  
  // Prompt 오버레이 상태
  const [showPromptOverlay, setShowPromptOverlay] = useState(false);
  const [copied, setCopied] = useState(false);

  // Mount state for portal
  const [isMounted, setIsMounted] = useState(false);
  
  // Mobile detection
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    setIsMounted(true);
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => {
      window.removeEventListener('resize', checkMobile);
      setIsMounted(false);
    };
  }, []);

  // sourceImageUrl 자동 갱신
  const { refreshedUrl: refreshedSourceImageUrl } = useUrlRefresh({
    url: image.sourceImageUrl || '',
    enabled: !!image.sourceImageUrl
  });

  const handleDownload = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const response = await fetch(image.src);
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
      window.open(image.src, '_blank');
    }
  }, [image.src]);

  // Save to Gallery 핸들러 (호버 시 노출). prompt, sourceImageUrl 포함해 Photo 앱에 저장.
  const handleSave = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (savingImage || savedImage) return;
    setSavingImage(true);
    try {
      const response = await fetch('/api/photo/save-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: image.src,
          prompt: image.prompt || null,
          ai_prompt: null,
          ai_json_prompt: null,
          chatId: chatId || null,
          messageId: messageId || null,
          metadata: { sourceImageUrl: image.sourceImageUrl || null }
        })
      });
      if (response.ok) {
        setSavedImage(true);
      } else {
        const error = await response.json();
        console.error('Save failed:', error);
      }
    } catch (error) {
      console.error('Save error:', error);
    } finally {
      setSavingImage(false);
    }
  }, [image.src, image.prompt, image.sourceImageUrl, chatId, messageId, savingImage, savedImage]);

  // Prompt 복사 핸들러
  const handleCopyPrompt = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!image.prompt) return;
    try {
      await navigator.clipboard.writeText(image.prompt);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (error) {
      console.error('Copy failed:', error);
    }
  }, [image.prompt]);

  return (
    <div 
      className={`generated-image-container relative cursor-pointer overflow-hidden rounded-xl bg-neutral-800 transition-transform hover:scale-[1.02] active:scale-[0.98] w-full min-w-full ${
        ratioType === 'portrait' ? 'aspect-[3/4]' : 
        ratioType === 'landscape' ? 'aspect-[4/3]' : 'aspect-square'
      }`}
      onClick={onImageClick}
    >
      <img
        src={image.src}
        alt={image.alt}
        onLoad={(e) => onImageLoad(index, e)}
        className="w-full h-full object-cover"
        referrerPolicy="no-referrer"
      />
      {/* 호버 시 다운로드/저장 버튼 */}
      {!showPromptOverlay && (
        <div className="image-hover-overlay">
          <div className="image-hover-gradient" />
          <div className="absolute bottom-2 right-2 flex gap-1">
            <button 
              className="image-action-btn"
              onClick={handleDownload}
              aria-label="Download"
            >
              <Download size={18} />
            </button>
            {image.prompt && (
              <button 
                className="image-action-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowPromptOverlay(true);
                }}
                aria-label="Show prompt"
              >
                <ScrollText size={18} />
              </button>
            )}
            <button 
              className="image-action-btn"
              onClick={handleSave}
              disabled={savingImage || savedImage}
              aria-label={savingImage ? 'Saving...' : savedImage ? 'Saved' : 'Save to Gallery'}
            >
              {savingImage ? (
                <div className="w-[18px] h-[18px] border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : savedImage ? (
                <Check size={18} />
              ) : (
                <Bookmark size={18} />
              )}
            </button>
          </div>
        </div>
      )}

      {/* 프롬프트 오버레이 */}
      {image.prompt && isMounted ? createPortal(
        <div 
          className={`fixed inset-0 z-[9999] text-white transition-opacity duration-300 ${showPromptOverlay ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
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
            e.stopPropagation();
          }}
        >
          {/* 배경: 블러 처리된 이미지 */}
          <img
            src={image.src}
            alt={image.alt}
            className="absolute inset-0 w-full h-full object-cover z-0"
            style={{
              filter: 'brightness(0.3) blur(20px)',
              transform: 'scale(1.1)',
              objectPosition: 'center'
            }}
          />

          <div className="relative w-full h-full flex flex-col justify-center items-center text-center z-20 p-6">
            {/* Prompt content */}
            <div className="flex flex-col items-center w-full flex-1 min-h-0">
              <div className="w-full flex justify-center flex-1 min-h-0 overflow-hidden pt-10 sm:pt-28 pb-22 sm:pb-28">
                <div className="max-w-3xl w-full h-full overflow-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden px-2 flex flex-col items-start justify-start">
                  {/* 소스 이미지 썸네일 */}
                  {image.sourceImageUrl && (
                    <div className="mb-3 flex justify-center w-full">
                      <img
                        src={refreshedSourceImageUrl || image.sourceImageUrl}
                        alt="Source image"
                        className="max-w-[150px] max-h-[150px] object-contain rounded-lg"
                        style={{ maxWidth: '150px', maxHeight: '150px' }}
                      />
                    </div>
                  )}
                  
                  {/* 프롬프트 텍스트 */}
                  <div className="text-base md:text-lg font-medium leading-relaxed text-white w-full text-left py-8 whitespace-pre-wrap">
                    {image.prompt}
                  </div>
                </div>
              </div>
            </div>

            {showPromptOverlay && (
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
                    setShowPromptOverlay(false);
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
                      handleCopyPrompt(e);
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
        </div>,
        document.body
      ) : null}
    </div>
  );
});

interface ImageGalleryStackProps {
  images: ImageData[];
  onSingleImageClick?: (src: string, alt: string, allImages: ImageData[], index: number) => void;
  onSourceImageClick?: (imageUrl: string) => void;
  isMobile?: boolean;
  chatId?: string;
  messageId?: string;
}

/**
 * Apple iMessage-style image gallery stack component
 * - 1-2 images: Display normally with proper sizing
 * - 3+ images: Display as a stacked preview, click to open gallery grid
 */
export const ImageGalleryStack = memo(function ImageGalleryStackComponent({
  images,
  onSingleImageClick,
  onSourceImageClick,
  isMobile = false,
  chatId,
  messageId
}: ImageGalleryStackProps) {
  const [showGalleryGrid, setShowGalleryGrid] = useState(false);
  const [showFullImage, setShowFullImage] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isMounted, setIsMounted] = useState(false);
  const [savingImage, setSavingImage] = useState(false);
  const [savedImage, setSavedImage] = useState(false);
  
  // 🚀 이미지 비율 감지를 위한 상태 (정형화용)
  const [imageRatios, setImageRatios] = useState<Record<number, 'portrait' | 'landscape' | 'square'>>({});

  const handleImageLoad = useCallback((index: number, e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = e.currentTarget;
    const ratio = naturalWidth / naturalHeight;
    let type: 'portrait' | 'landscape' | 'square' = 'square';
    
    if (ratio < 0.8) type = 'portrait';
    else if (ratio > 1.2) type = 'landscape';
    
    setImageRatios(prev => ({ ...prev, [index]: type }));
  }, []);

  // Touch state for swipe navigation
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  // Keyboard navigation은 ImageModal 내부에서 처리

  // Handle gallery grid keyboard
  useEffect(() => {
    if (!showGalleryGrid || showFullImage) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowGalleryGrid(false);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [showGalleryGrid, showFullImage]);

  // Touch handlers는 ImageModal 내부에서 처리

  const openGalleryGrid = useCallback(() => {
    setShowGalleryGrid(true);
  }, []);

  const closeGalleryGrid = useCallback(() => {
    setShowGalleryGrid(false);
  }, []);

  const openFullImage = useCallback((index: number) => {
    setSelectedImageIndex(index);
    setShowFullImage(true);
    setSavedImage(false);
  }, []);

  const closeFullImage = useCallback(() => {
    setShowFullImage(false);
    setSavedImage(false);
  }, []);

  // Prompt handlers는 ImageModal 내부에서 처리

  const navigateImage = useCallback((direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      setSelectedImageIndex(prev => prev === 0 ? images.length - 1 : prev - 1);
    } else {
      setSelectedImageIndex(prev => (prev + 1) % images.length);
    }
    setSavedImage(false);
  }, [images.length]);
  
  // 이미지를 ImageModalImage 형식으로 변환
  const galleryImages: ImageModalImage[] = useMemo(() => {
    return images.map(img => ({
      src: img.src,
      alt: img.alt,
      prompt: img.prompt,
      sourceImageUrl: img.sourceImageUrl
    }));
  }, [images]);
  
  // 현재 이미지의 프롬프트 확인
  const currentImage = images[selectedImageIndex];
  const currentPrompt = useMemo(() => {
    if (!currentImage) return undefined;
    if (currentImage.prompt) return currentImage.prompt;
    if (currentImage.alt && currentImage.alt.length > 20 && currentImage.alt !== 'Image' && currentImage.alt !== 'image' && !currentImage.alt.startsWith('http')) {
      return currentImage.alt;
    }
    return undefined;
  }, [currentImage]);
  
  // 현재 이미지의 소스 이미지 URL
  const currentSourceImageUrl = useMemo(() => {
    return currentImage?.sourceImageUrl;
  }, [currentImage]);
  
  // 저장 핸들러. ImageModal에서 { imageUrl, prompt?, sourceImageUrl?, originalSrc? } 페이로드로 호출.
  const handleSave = useCallback(async (payload: { imageUrl: string; prompt?: string | null; sourceImageUrl?: string | null; originalSrc?: string }) => {
    if (savingImage || savedImage) return;
    setSavingImage(true);
    try {
      const imageUrl = payload.imageUrl;
      const response = await fetch('/api/photo/save-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl,
          prompt: payload.prompt || null,
          ai_prompt: null,
          ai_json_prompt: null,
          chatId: chatId ?? null,
          messageId: messageId ?? null,
          metadata: { sourceImageUrl: payload.sourceImageUrl || null }
        })
      });
      if (response.ok) {
        setSavedImage(true);
        setTimeout(() => {
          setSavedImage(false);
        }, 2000);
      }
    } catch (error) {
      console.error('Save error:', error);
    } finally {
      setSavingImage(false);
    }
  }, [savingImage, savedImage, chatId, messageId]);

  // For 1-2 images, parent (bubble or .message-media-max-width) constrains width
  if (images.length <= 2) {
    return (
      <div className="flex flex-col gap-2">
        {images.map((image, index) => (
          <div 
            key={index} 
            className="cursor-pointer"
            style={{
              maxWidth: '100%'
            }}
            onClick={() => {
              if (onSingleImageClick) {
                onSingleImageClick(image.src, image.alt, images, index);
              }
            }}
          >
            <SimpleImageWithLoading
              src={image.src}
              alt={image.alt}
              className="w-full h-auto hover:opacity-90 transition-opacity"
              style={{ borderRadius: '18px' }}
              showHoverActions={true}
              prompt={image.prompt}
              sourceImageUrl={image.sourceImageUrl}
              aspectRatio={image.aspectRatio}
              onSourceImageClick={onSourceImageClick}
              chatId={chatId}
              messageId={messageId}
              onImageClick={() => {
                if (onSingleImageClick) {
                  onSingleImageClick(image.src, image.alt, images, index);
                }
              }}
            />
          </div>
        ))}
      </div>
    );
  }

  const previewImages = images.slice(0, 5);

  // 🚀 스택 전체의 베이스 비율 카테고리 (첫 번째 이미지 기준)
  const baseRatioCategory = imageRatios[0] || 'square';
  
  // 🚀 비율에 따른 높이 배수 계산 (baseItemWidth 기준, 단일 미디어와 비례)
  const heightMultiplier = baseRatioCategory === 'portrait' ? 1.33 : baseRatioCategory === 'landscape' ? 0.75 : 1;
  const baseItemWidth = isMobile ? 280 : 360; // 스택 시 개별 이미지 크기 (단일 미디어와 비례)
  const stackItemHeight = baseItemWidth * heightMultiplier;
  const stackContainerHeight = stackItemHeight + 70;

  return (
    <>
      {/* Stacked Preview */}
      <div 
        className="apple-image-stack cursor-pointer"
        onClick={openGalleryGrid}
        style={{
          position: 'relative',
          width: isMobile ? '320px' : '400px',
          height: `${stackContainerHeight}px`
        }}
      >
        {/* Stack label - 좌측 정렬 및 아이콘 추가 */}
        <div className="apple-image-stack-label">
          <LayoutGrid size={14} className="apple-stack-icon" />
          <span>{images.length} Photos</span>
        </div>
        
        {/* Stacked images - 5개까지 쌓기 */}
        {previewImages.map((image, index) => {
          // 🚀 스택 순서: 첫 번째 이미지가 가장 위에 보이도록 역순으로 zIndex 설정
          // index 0 (첫 번째) → zIndex 5 (가장 위)
          // index 4 (다섯 번째) → zIndex 1 (가장 아래)
          const stackIndex = previewImages.length - 1 - index;
          const zIndexValue = previewImages.length - index; // 첫 번째가 가장 위에
          
          // 🚀 5개 스택을 위한 회전 및 오프셋 조정
          const rotation = (index - 2) * 2.5; 
          const offsetX = (index - 2) * 10; 
          const offsetY = index * 5;
          const scale = 1 - (stackIndex * 0.015); 
          
          return (
            <div
              key={index}
              className="apple-image-stack-item"
              style={{
                position: 'absolute',
                top: '24px',
                left: '50%',
                width: `${baseItemWidth}px`,
                height: `${stackItemHeight}px`,
                transform: `translateX(-50%) translateX(${offsetX}px) translateY(${offsetY}px) rotate(${rotation}deg) scale(${scale})`,
                zIndex: zIndexValue, // 🚀 첫 번째 이미지가 가장 위에 보이도록
                borderRadius: '16px',
                overflow: 'hidden',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.18)',
                transition: 'all 0.3s ease'
              }}
            >
              <img
                src={image.src}
                alt={image.alt}
                onLoad={(e) => handleImageLoad(index, e)}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover'
                }}
                referrerPolicy="no-referrer"
              />
            </div>
          );
        })}
      </div>

      {/* Gallery Grid Modal */}
      {isMounted && showGalleryGrid && !showFullImage && createPortal(
        <div 
          className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-sm"
          onClick={closeGalleryGrid}
        >
          {/* Header */}
          <div className="absolute top-0 left-0 right-0 flex items-center justify-center p-4 z-10">
            <span className="text-white text-lg font-medium">{images.length} Photos</span>
            <button 
              className="absolute top-4 right-4 bg-black/40 hover:bg-black/60 p-2 rounded-full text-white transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                closeGalleryGrid();
              }}
              aria-label="Close gallery"
            >
              <X size={24} />
            </button>
          </div>

          {/* Grid - 정형화된 비율 적용 */}
          <div 
            className={`absolute inset-0 overflow-y-auto pt-20 pb-12 ${isMobile ? 'px-0' : 'px-4'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`grid ${isMobile ? 'grid-cols-1 w-full px-4' : 'grid-cols-2 max-w-3xl'} gap-3 mx-auto justify-items-center`}>
              {images.map((image, index) => (
                <GalleryGridItem
                  key={index}
                  image={image}
                  index={index}
                  ratioType={imageRatios[index] || 'square'}
                  onImageLoad={handleImageLoad}
                  onImageClick={() => openFullImage(index)}
                  onSourceImageClick={onSourceImageClick}
                  chatId={chatId}
                  messageId={messageId}
                />
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Full Image Modal */}
      <ImageModal
        isOpen={showFullImage}
        imageUrl={currentImage?.src || ''}
        imageAlt={currentImage?.alt}
        onClose={closeFullImage}
        gallery={galleryImages.length > 1 ? galleryImages : undefined}
        currentIndex={selectedImageIndex}
        onNavigate={galleryImages.length > 1 ? navigateImage : undefined}
        prompt={currentPrompt}
        showPromptButton={!!currentPrompt}
        enableDownload={true}
        enableSave={true}
        enableUrlRefresh={true}
        messageId={messageId}
        chatId={chatId}
        userId={undefined}
        isMobile={isMobile}
        isSaving={savingImage}
        isSaved={savedImage}
        onSave={handleSave}
        sourceImageUrl={currentSourceImageUrl}
        onSourceImageClick={onSourceImageClick}
      />
    </>
  );
});

export default ImageGalleryStack;
