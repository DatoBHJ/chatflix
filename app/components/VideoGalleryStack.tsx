'use client';

import React, { memo, useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, LayoutGrid, Video } from 'lucide-react';
import { DirectVideoEmbed } from './MarkdownContent';
import { useUrlRefresh } from '@/app/hooks/useUrlRefresh';
import { parseMediaDimensions } from '@/app/utils/imageUtils';

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

// Parse numeric aspect ratio (width/height) from VideoData. Fallback 16/9.
function getVideoAspectRatio(video: VideoData): number {
  if (video.aspectRatio) {
    const parts = video.aspectRatio.split(/[/:]/).map(Number);
    if (parts.length >= 2 && parts[0] > 0 && parts[1] > 0) return parts[0] / parts[1];
  }
  const dims = parseMediaDimensions(video.src);
  if (dims && dims.height > 0) return dims.width / dims.height;
  return 16 / 9;
}

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
  
  const baseItemWidth = isMobile ? 280 : 340;
  const extraPadding = 40;
  const contentTop = 24 + extraPadding / 2;

  // Per-video aspect ratio (width/height); fallback 16/9
  const previewAspectRatios = previewVideos.map((v) => getVideoAspectRatio(v));
  const itemHeights = previewAspectRatios.map((ratio) => baseItemWidth / ratio);

  // Container height so all stacked cards fit: contentTop + max(itemHeight_i + offsetY_i) + 70
  const maxStackBottom = Math.max(
    ...itemHeights.map((h, i) => h + i * 5)
  );
  const stackContainerHeight = contentTop + maxStackBottom + 70;
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
          const itemHeight = itemHeights[index];
          
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
                top: `${contentTop}px`,
                left: '50%',
                width: `${baseItemWidth}px`,
                height: `${itemHeight}px`,
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
