import React, { useState, useEffect, memo, useMemo, useRef, useCallback } from 'react';
import { useUrlRefresh } from '@/app/hooks/useUrlRefresh';
import { useLazyMedia } from '@/app/hooks/useIntersectionObserver';
import { Play, Download, Share2 } from 'lucide-react';
import { categorizeAspectRatio, parseImageDimensions, parseMediaDimensions, getAspectCategory } from '@/app/utils/imageUtils';

// Simple YouTube Video component
export const YouTubeVideo = ({ videoId, video }: { videoId: string, video?: any }) => {
    const [showDetails, setShowDetails] = useState(false);
    const [showFullDescription, setShowFullDescription] = useState(false);
    
    // Check if description is long enough to truncate
    const isDescriptionLong = video?.description && video.description.length > 300;
    
    return (
      <div className="rounded-lg overflow-hidden">
        <div className="relative pb-[56.25%] h-0">
          <iframe
            src={`https://www.youtube.com/embed/${videoId}`}
            title="YouTube video player"
            className="absolute top-0 left-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          ></iframe>
        </div>
        
        {video && (
          <div className="p-3">
            <div className="flex justify-end items-center">
              <button 
                onClick={() => setShowDetails(!showDetails)}
                className="text-xs text-[color-mix(in_srgb,var(--foreground)_70%,transparent)] hover:text-[color-mix(in_srgb,var(--foreground)_95%,transparent)] transition-all duration-200 flex items-center gap-1.5 whitespace-nowrap"
              >
                <span>{showDetails ? "Hide details" : "Show details"}</span>
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  width="12" 
                  height="12" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                  className={`transition-transform duration-200 ${showDetails ? 'rotate-180' : 'rotate-0'}`}
                >
                  <path d="M6 9l6 6 6-6"/>
                </svg>
              </button>
            </div>
            
            {showDetails && (
              <div className="mt-3 text-xs text-[color-mix(in_srgb,var(--foreground)_80%,transparent)]">
                {/* Stats section - date shown first and fully */}
                <div className="flex flex-wrap gap-4 mb-4">
                  {/* Date - shown first and in full */}
                  {video.publishDate && (
                    <div className="flex items-center gap-1.5">
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[color-mix(in_srgb,var(--foreground)_60%,transparent)]">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                      </svg>
                      <span className="text-[color-mix(in_srgb,var(--foreground)_90%,transparent)]">
                        {/* Display full date without truncation */}
                        {video.publishDate}
                      </span>
                    </div>
                  )}
                  
                  {video.viewCount && (
                    <div className="flex items-center gap-1.5">
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[color-mix(in_srgb,var(--foreground)_60%,transparent)]">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                      </svg>
                      <span>{video.viewCount > 1000000 
                        ? `${(video.viewCount / 1000000).toFixed(1)}M views` 
                        : video.viewCount > 1000 
                          ? `${(video.viewCount / 1000).toFixed(1)}K views` 
                          : `${video.viewCount} views`
                      }</span>
                    </div>
                  )}
                  
                  {video.duration && (
                    <div className="flex items-center gap-1.5">
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[color-mix(in_srgb,var(--foreground)_60%,transparent)]">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12 6 12 12 16 14"></polyline>
                      </svg>
                      <span>{video.duration}</span>
                    </div>
                  )}
                  
                  {video.channelName && (
                    <div className="flex items-center gap-1.5">
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[color-mix(in_srgb,var(--foreground)_60%,transparent)]">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                      </svg>
                      <span className="truncate max-w-[120px]">{video.channelName}</span>
                    </div>
                  )}
                </div>
                
                {/* Description with expand/collapse */}
                {video.description && (
                  <div className="mt-4">
                    <div className={`relative ${isDescriptionLong && !showFullDescription ? 'max-h-20 overflow-hidden' : ''}`}>
                      <p className="whitespace-pre-wrap leading-relaxed">{video.description}</p>
                      
                      {/* Gradient fade effect for long descriptions */}
                      {isDescriptionLong && !showFullDescription && (
                        <div className="absolute bottom-0 left-0 right-0 h-10 bg-linear-to-t from-(--background) to-transparent"></div>
                      )}
                    </div>
                    
                    {/* Show more/less button for long descriptions */}
                    {isDescriptionLong && (
                      <button 
                        onClick={() => setShowFullDescription(!showFullDescription)}
                        className="mt-1 text-xs text-[color-mix(in_srgb,var(--foreground)_70%,transparent)] hover:text-[color-mix(in_srgb,var(--foreground)_95%,transparent)] transition-all duration-200 inline-flex items-center gap-1"
                      >
                        <span>{showFullDescription ? "Show less" : "Show more"}</span>
                        <svg 
                          xmlns="http://www.w3.org/2000/svg" 
                          width="10" 
                          height="10" 
                          viewBox="0 0 24 24" 
                          fill="none" 
                          stroke="currentColor" 
                          strokeWidth="2" 
                          strokeLinecap="round" 
                          strokeLinejoin="round"
                          className={`transition-transform duration-200 ${showFullDescription ? 'rotate-180' : 'rotate-0'}`}
                        >
                          <path d="M6 9l6 6 6-6"/>
                        </svg>
                      </button>
                    )}
                  </div>
                )}
                
                {/* Link to original video */}
                <div className="mt-4 flex justify-end">
                  <a 
                    href={`https://youtube.com/watch?v=${videoId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs py-1 px-2 rounded-md bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] hover:bg-[color-mix(in_srgb,var(--foreground)_8%,transparent)] text-[color-mix(in_srgb,var(--foreground)_85%,transparent)] transition-all duration-200"
                  >
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      width="10" 
                      height="10" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    >
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                      <polyline points="15 3 21 3 21 9"></polyline>
                      <line x1="10" y1="14" x2="21" y2="3"></line>
                    </svg>
                    <span>Watch on YouTube</span>
                  </a>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

// Video component with automatic URL refresh
// 🚀 ChatGPT STYLE: max-width 제한 + aspect-ratio CSS로 정확한 비율 유지 (Virtuoso 스크롤 최적화)
export const VideoWithRefresh = memo(function VideoWithRefreshComponent({ 
  src, 
  poster,
  className = "",
  controls = true,
  playsInline = true,
  preload = "metadata",
  messageId,
  chatId,
  userId,
  onAspectRatioDetected,
  isMobile,
  maxWidth,
  ...props 
}: React.VideoHTMLAttributes<HTMLVideoElement> & { 
  messageId?: string; 
  chatId?: string; 
  userId?: string;
  onAspectRatioDetected?: (aspectRatio: string) => void;
  isMobile?: boolean;
  maxWidth?: string;
}) {
  // 🚀 INSTANT LOAD: 화면 근처(200px)에서 비디오 로드 시작 - 초기 로딩 최대화
  const { ref: lazyRef, shouldLoad } = useLazyMedia();
  
  const { refreshedUrl, isRefreshing } = useUrlRefresh({
    url: typeof src === 'string' ? src : "",
    messageId,
    chatId,
    userId,
    // 🚀 shouldLoad는 기본값이 true이므로 항상 활성화
    enabled: true
  });

  // 🚀 정확한 비율값 저장 (ChatGPT 방식)
  const [exactAspectRatio, setExactAspectRatio] = useState<number>(1.0); // 기본값: 정사각형
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastReportedRatio = useRef<string | undefined>(undefined);

  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (video && video.videoWidth > 0 && video.videoHeight > 0) {
      // 비디오 메타데이터에서 정확한 aspect ratio 감지 (ChatGPT 방식: 카테고리화 없이 정확한 값 사용)
      const ratio = video.videoWidth / video.videoHeight;
      setExactAspectRatio(ratio);
      
      // 기존 콜백 호환성을 위해 원본 비율도 전달
      const ratioStr = `${video.videoWidth}/${video.videoHeight}`;
      if (lastReportedRatio.current !== ratioStr) {
        lastReportedRatio.current = ratioStr;
        onAspectRatioDetected?.(ratioStr);
      }
    }
  }, [onAspectRatioDetected]);

  // 초기 aspect ratio 계산 (비디오 로드 전) - 이미지와 동일한 parseMediaDimensions 사용
  const initialAspectRatio = useMemo(() => {
    // 🚀 이미지와 동일한 방식: parseMediaDimensions로 URL에서 크기 정보 추출
    const parsedDims = parseMediaDimensions(refreshedUrl || (typeof src === 'string' ? src : ''));
    if (parsedDims) {
      return parsedDims.width / parsedDims.height; // 정확한 비율 반환
    }
    
    return 1.0; // 기본값: 정사각형
  }, [refreshedUrl, src]);

  // 감지된 aspect ratio가 있으면 사용, 없으면 초기값 사용
  const finalAspectRatio = exactAspectRatio !== 1.0 ? exactAspectRatio : initialAspectRatio;

  // 🚀 ChatGPT 패턴: 모든 중첩 요소에 동일한 aspect-ratio 적용
  const aspectRatioStyle = `${finalAspectRatio} / 1`;

  // 🚀 ChatGPT 방식: max-width만 제한하고 aspect-ratio로 높이 자동 계산 (이미지와 동일)
  const containerStyle: React.CSSProperties = useMemo(() => {
    return {
      maxWidth: maxWidth || '400px',
      width: '100%',
      aspectRatio: aspectRatioStyle,
    };
  }, [aspectRatioStyle, maxWidth]);

  return (
    <div ref={lazyRef} className="generated-video-container" style={containerStyle}>
      {/* 🚀 ChatGPT 스타일: 내부 래퍼에도 동일한 aspect-ratio 적용 (레이아웃 안정성) */}
      <div 
        className="relative w-full h-full overflow-hidden"
        style={{ aspectRatio: aspectRatioStyle }}
      >
        <video
          ref={videoRef}
          src={refreshedUrl}
          poster={poster}
          controls={controls}
          playsInline={playsInline}
          preload={preload}
          onLoadedMetadata={handleLoadedMetadata}
          className={`w-full h-full object-cover ${className}`}
          style={{ aspectRatio: aspectRatioStyle }}
          {...props}
        >
          Your browser does not support the video tag.
        </video>
        
        {/* 🚀 로딩 중일 때만 placeholder 표시 */}
        {isRefreshing && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-20">
            <div className="w-8 h-8 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
});

