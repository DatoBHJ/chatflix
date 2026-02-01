'use client';

import React, { memo, useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, LayoutGrid, Video } from 'lucide-react';
import { DirectVideoEmbed } from './MarkdownContent';
import { useUrlRefresh } from '@/app/hooks/useUrlRefresh';
import { parseMediaDimensions } from '@/app/utils/imageUtils';
import { getAdaptiveGlassStyleBlur, getIconClassName } from '@/app/lib/adaptiveGlassStyle';

interface VideoData {
  src: string;
  prompt?: string;
  sourceImageUrl?: string;
  aspectRatio?: string;
}

// iOS Safari 감지 (iOS 또는 iPadOS Safari)
const isIOSSafari = () => {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isSafari = /Safari/.test(ua) && !/Chrome|CriOS|FxiOS|EdgiOS/.test(ua);
  return isIOS && isSafari;
};

// 스택 미리보기용 비디오 썸네일 컴포넌트
const VideoStackThumbnail = memo(function VideoStackThumbnailComponent({
  src,
  style,
  className
}: {
  src: string;
  style: React.CSSProperties;
  className?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isIOS] = useState(() => isIOSSafari());
  
  // URL refresh for signed URLs
  const { refreshedUrl } = useUrlRefresh({
    url: src,
    enabled: true
  });

  // iOS Safari에서 비디오 로드 처리
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !refreshedUrl) return;

    const handleLoadedData = () => {
      setIsLoaded(true);
    };

    const handleCanPlay = () => {
      setIsLoaded(true);
    };

    // iOS Safari에서는 canplay 이벤트가 더 안정적
    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('canplay', handleCanPlay);

    // iOS Safari에서 비디오 로드 강제
    if (isIOS) {
      video.load();
    }

    return () => {
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('canplay', handleCanPlay);
    };
  }, [refreshedUrl, isIOS]);

  return (
    <video
      ref={videoRef}
      src={refreshedUrl}
      style={{
        ...style,
        opacity: isLoaded ? 1 : 0,
        transition: 'opacity 0.3s ease'
      }}
      className={className}
      // iOS Safari 필수 속성들
      preload={isIOS ? 'auto' : 'metadata'}
      muted
      playsInline
      // @ts-ignore - webkit-playsinline for older iOS
      webkit-playsinline="true"
    />
  );
});

interface VideoGalleryStackProps {
  videos: VideoData[];
  messageId?: string;
  chatId?: string;
  userId?: string;
  isMobile?: boolean;
  onSourceImageClick?: (imageUrl: string) => void;
}

export const VideoGalleryStack = memo(function VideoGalleryStackComponent({
  videos,
  messageId,
  chatId,
  userId,
  isMobile = false,
  onSourceImageClick
}: VideoGalleryStackProps) {
  const [showGalleryGrid, setShowGalleryGrid] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  // Handle gallery grid keyboard
  useEffect(() => {
    if (!showGalleryGrid) return;
    
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
  }, [showGalleryGrid]);

  const openGalleryGrid = useCallback(() => {
    setShowGalleryGrid(true);
  }, []);

  const closeGalleryGrid = useCallback(() => {
    setShowGalleryGrid(false);
  }, []);

  // 1개 비디오: 일반 렌더링
  if (videos.length === 1) {
    return (
      <DirectVideoEmbed
        url={videos[0].src}
        aspectRatio={videos[0].aspectRatio}
        messageId={messageId}
        chatId={chatId}
        userId={userId}
        isMobile={isMobile}
        prompt={videos[0].prompt}
        sourceImageUrl={videos[0].sourceImageUrl}
        onSourceImageClick={onSourceImageClick}
      />
    );
  }

  // 2개 이상: 쌓여있는 스타일로 표시, 클릭하면 모달 열림
  const previewVideos = videos.slice(0, 5);
  const remainingCount = Math.max(0, videos.length - 5);
  
  // 🚀 prop/URL에서 알 수 있는 비율 (video.size 또는 URL 크기 정보)
  const ratioFromPropOrUrl = (() => {
    const first = videos[0];
    if (!first) return null;
    if (first.aspectRatio) {
      try {
        const [w, h] = first.aspectRatio.split('/').map(Number);
        if (w > 0 && h > 0) return w / h;
      } catch {
        // ignore
      }
    }
    const dimensions = parseMediaDimensions(first.src);
    return dimensions ? dimensions.width / dimensions.height : null;
  })();
  
  // video.size가 없을 때: 첫 번째 비디오 메타데이터를 로드해 실제 비율 사용
  const [detectedStackRatio, setDetectedStackRatio] = useState<number | null>(null);
  useEffect(() => {
    if (ratioFromPropOrUrl != null || videos.length < 2 || !videos[0]?.src) return;
    setDetectedStackRatio(null);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.src = videos[0].src;
    const onLoaded = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        setDetectedStackRatio(video.videoWidth / video.videoHeight);
      }
      video.src = '';
      video.load();
    };
    video.addEventListener('loadedmetadata', onLoaded);
    video.addEventListener('error', () => {
      video.src = '';
      video.load();
    });
    return () => {
      video.removeEventListener('loadedmetadata', onLoaded);
      video.removeEventListener('error', () => {});
      if (video.src) {
        video.src = '';
        video.load();
      }
    };
  }, [videos.length, videos[0]?.src, ratioFromPropOrUrl]);
  
  const DEFAULT_VIDEO_RATIO = 16 / 9;
  const firstVideoRatio = ratioFromPropOrUrl ?? detectedStackRatio ?? DEFAULT_VIDEO_RATIO;
  const baseRatioCategory: 'portrait' | 'landscape' | 'square' =
    firstVideoRatio < 0.8 ? 'portrait' : firstVideoRatio > 1.2 ? 'landscape' : 'square';
  const heightMultiplier = baseRatioCategory === 'portrait' ? 1.33 : baseRatioCategory === 'landscape' ? 0.75 : 1;
  const baseItemWidth = isMobile ? 280 : 340;
  const stackItemHeight = baseItemWidth * heightMultiplier;
  // 회전과 오프셋을 고려한 여유 공간 추가
  const extraPadding = 40;
  const stackContainerHeight = stackItemHeight + 70 + extraPadding;
  const stackContainerWidth = isMobile ? 320 + extraPadding : 380 + extraPadding;

  return (
    <>
      {/* Stacked Preview */}
      <div 
        className="apple-image-stack cursor-pointer"
        onClick={openGalleryGrid}
        style={{
          position: 'relative',
          width: `${stackContainerWidth}px`,
          height: `${stackContainerHeight}px`,
          overflow: 'visible'
        }}
      >
        {/* Stack label */}
        <div className="apple-image-stack-label">
          <LayoutGrid size={14} className="apple-stack-icon" />
          <span>{videos.length} Videos</span>
        </div>
        
        {/* Stacked videos - 5개까지 쌓기 */}
        {previewVideos.map((video, index) => {
          const stackIndex = previewVideos.length - 1 - index;
          const zIndexValue = previewVideos.length - index;
          
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
                top: `${24 + extraPadding / 2}px`,
                left: '50%',
                width: `${baseItemWidth}px`,
                height: `${stackItemHeight}px`,
                transform: `translateX(-50%) translateX(${offsetX}px) translateY(${offsetY}px) rotate(${rotation}deg) scale(${scale})`,
                zIndex: zIndexValue,
                borderRadius: '16px',
                overflow: 'hidden',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.18)',
                transition: 'all 0.3s ease',
                pointerEvents: 'none',
                backgroundColor: '#1a1a1a'
              }}
            >
              <VideoStackThumbnail
                src={video.src}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover'
                }}
              />
            </div>
          );
        })}
        
        {/* Remaining count badge */}
        {remainingCount > 0 && (
          <div className="apple-image-stack-badge">
            +{remainingCount}
          </div>
        )}
      </div>

      {/* Gallery Grid Modal */}
      {isMounted && showGalleryGrid && createPortal(
        <div 
          className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-sm"
          onClick={closeGalleryGrid}
        >
          {/* Header */}
          <div className="absolute top-0 left-0 right-0 flex items-center justify-center p-4 z-10">
            <span className="text-white text-lg font-medium">{videos.length} Videos</span>
            <button 
              className="absolute top-4 right-4 p-2 rounded-full text-white transition-colors cursor-pointer z-10"
              style={getAdaptiveGlassStyleBlur()}
              onClick={(e) => {
                e.stopPropagation();
                closeGalleryGrid();
              }}
              aria-label="Close gallery"
            >
              <X size={24} className={getIconClassName(true)} />
            </button>
          </div>

          {/* Grid */}
          <div 
            className="absolute inset-0 overflow-y-auto pt-20 pb-12 px-4"
            onClick={(e) => {
              // Don't close modal if clicking on video or video controls
              const target = e.target as HTMLElement;
              if (target.closest('.generated-video-container') || 
                  target.closest('video') || 
                  target.closest('button') ||
                  target.closest('input')) {
                e.stopPropagation();
                return;
              }
              e.stopPropagation();
            }}
          >
            <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-2'} gap-3 max-w-3xl mx-auto`}>
              {videos.map((video, index) => (
                <div key={index} className="w-full">
                  <DirectVideoEmbed
                    url={video.src}
                    aspectRatio={video.aspectRatio}
                    messageId={messageId}
                    chatId={chatId}
                    userId={userId}
                    isMobile={isMobile}
                    prompt={video.prompt}
                    sourceImageUrl={video.sourceImageUrl}
                    onSourceImageClick={onSourceImageClick}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
});

export default VideoGalleryStack;
