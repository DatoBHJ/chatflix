'use client';

import React, { useState, useMemo, memo, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Play, Pause, Volume2, VolumeX, Download, Maximize, ScrollText, Info, Copy, Check } from 'lucide-react';
import { useLazyMedia } from '@/app/hooks/useIntersectionObserver';
import { parseMediaDimensions } from '@/app/utils/imageUtils';
import { useUrlRefresh } from '@/app/hooks/useUrlRefresh';
import { getAdaptiveGlassStyleBlur } from '@/app/lib/adaptiveGlassStyle';
import { IMAGE_VIEWER_PROMPT_OVERLAY_Z } from '@/app/lib/zIndex';

interface PhotoVideoPlayerProps {
  url: string;
  aspectRatio?: string;
  isMobile?: boolean;
  maxWidth?: string;
  prompt?: string;
  sourceImageUrl?: string;
  chatId?: string;
  messageId?: string;
}

export const PhotoVideoPlayer = memo(function PhotoVideoPlayerComponent({
  url,
  aspectRatio,
  isMobile = false,
  maxWidth,
  prompt,
  sourceImageUrl,
  chatId,
  messageId
}: PhotoVideoPlayerProps) {
  // 🚀 INSTANT LOAD: 화면 근처(200px)에서 비디오 로드 시작
  const { ref: lazyRef, shouldLoad } = useLazyMedia();
  
  // Source image URL refresh
  const { refreshedUrl: refreshedSourceImageUrl } = useUrlRefresh({
    url: sourceImageUrl || '',
    enabled: !!sourceImageUrl
  });
  
  // 🚀 정확한 비율값 저장 (ChatGPT 방식)
  const [exactAspectRatio, setExactAspectRatio] = useState<number>(1.0); // 기본값: 정사각형
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Custom Controls State
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true); // Default to muted
  const [volume, setVolume] = useState(0); // 0-1, starts at 0 when muted
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isLooping, setIsLooping] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Prompt overlay state
  const [showPromptOverlay, setShowPromptOverlay] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Info modal state
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [chatPreview, setChatPreview] = useState<{ user: string | null; assistant: string | null } | null>(null);
  const [chatPreviewLoading, setChatPreviewLoading] = useState(false);
  
  // Mount state for portal
  const [isMounted, setIsMounted] = useState(false);
  
  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  // Prefetch chat preview as soon as we have chatId (before Info is opened)
  useEffect(() => {
    if (!chatId) {
      setChatPreview(null);
      setChatPreviewLoading(false);
      return;
    }
    setChatPreviewLoading(true);
    const ctrl = new AbortController();
    const url = `/api/chat/preview?chatId=${chatId}${messageId ? `&messageId=${messageId}` : ''}`;
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
  }, [chatId, messageId]);

  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        // 비디오 메타데이터에서 정확한 aspect ratio 감지
        const ratio = video.videoWidth / video.videoHeight;
        setExactAspectRatio(ratio);
      }
      setDuration(video.duration);
    }
  }, []);

  // 전체화면 상태 감지
  useEffect(() => {
    const handleFullscreenChange = () => {
      const fullscreenElement = document.fullscreenElement;
      const isCurrentlyFullscreen = !!fullscreenElement;
      const container = containerRef.current;
      const video = videoRef.current;
      let isOurElementFullscreen = false;
      if (isCurrentlyFullscreen && fullscreenElement) {
        isOurElementFullscreen = 
          fullscreenElement === container || 
          fullscreenElement === video ||
          (container !== null && container.contains(fullscreenElement as Node));
      }
      setIsFullscreen(isOurElementFullscreen);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const handleVideoClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;

    // Simply toggle play/pause without seeking
    if (video.paused) {
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, []);

  const handleProgressBarClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video || !duration) return;

    // Get click position relative to progress bar
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickPercentage = (clickX / rect.width) * 100;
    
    // Calculate target time
    const targetTime = (clickPercentage / 100) * duration;
    
    // Seek to target time
    video.currentTime = Math.max(0, Math.min(targetTime, duration));
    
    // If video is paused, play it
    if (video.paused) {
      video.play();
      setIsPlaying(true);
    }
  }, [duration]);

  const togglePlay = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, []);

  const toggleMute = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;

    if (isMuted) {
      // Unmute: restore to previous volume or default 0.5
      const newVolume = volume > 0 ? volume : 0.5;
      video.muted = false;
      video.volume = newVolume;
      setVolume(newVolume);
      setIsMuted(false);
    } else {
      // Mute
      video.muted = true;
      setIsMuted(true);
    }
  }, [isMuted, volume]);

  const setVolumeValue = useCallback((newVolume: number) => {
    const video = videoRef.current;
    if (!video) return;

    video.volume = newVolume;
    setVolume(newVolume);
    
    if (newVolume === 0) {
      video.muted = true;
      setIsMuted(true);
    } else {
      video.muted = false;
      setIsMuted(false);
    }
  }, []);

  const toggleLoop = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;

    video.loop = !video.loop;
    setIsLooping(video.loop);
  }, []);

  const handleDownload = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!url) return;
    
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = 'video.mp4';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      // Fallback: open in new tab
      window.open(url, '_blank');
    }
  }, [url]);

  const toggleFullScreen = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const container = containerRef.current;
    const video = videoRef.current;
    if (!container || !video) return;

    if (document.fullscreenElement) {
      document.exitFullscreen().catch(err => {
        console.error('Error exiting fullscreen:', err);
      });
    } else {
      // Use container element for fullscreen (works better in modals)
      container.requestFullscreen().catch(err => {
        console.error('Error entering fullscreen:', err);
        // Fallback: try video element if container fails
        video.requestFullscreen().catch(err2 => {
          console.error('Error entering fullscreen (fallback):', err2);
        });
      });
    }
  }, []);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
    }
  }, []);

  // Prompt copy handler
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

  // Format time helper
  const formatTime = (time: number) => {
    if (!time || isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // 초기 aspect ratio 계산 (비디오 로드 전)
  const initialAspectRatio = useMemo(() => {
    // 제공된 aspectRatio prop이 있으면 파싱
    if (aspectRatio) {
      try {
        const [width, height] = aspectRatio.split('/').map(Number);
        if (width && height) {
          return width / height;
        }
      } catch (e) {
        // 파싱 실패 시 기본값 사용
      }
    }
    
    // parseMediaDimensions로 URL에서 크기 정보 추출
    const parsedDims = parseMediaDimensions(url);
    if (parsedDims) {
      return parsedDims.width / parsedDims.height;
    }
    
    return 1.0; // 기본값: 정사각형
  }, [aspectRatio, url]);

  // 감지된 aspect ratio가 있으면 사용, 없으면 초기값 사용
  const finalAspectRatio = exactAspectRatio !== 1.0 ? exactAspectRatio : initialAspectRatio;

  // 🚀 ChatGPT 패턴: 모든 중첩 요소에 동일한 aspect-ratio 적용
  const aspectRatioStyle = `${finalAspectRatio} / 1`;

  // 🚀 ChatGPT 방식: max-width만 제한하고 aspect-ratio로 높이 자동 계산
  const containerStyle: React.CSSProperties = useMemo(() => {
    if (isFullscreen) {
      return {
        width: '100vw',
        height: '100vh',
        maxWidth: 'none',
        aspectRatio: aspectRatioStyle,
      };
    }
    // 모달에서 사용될 때는 화면 크기에 맞게 조정하되 aspect ratio 유지
    const maxWidthValue = maxWidth || '100%';
    return {
      maxWidth: maxWidthValue,
      maxHeight: '100vh',
      width: 'auto',
      height: 'auto',
      aspectRatio: aspectRatioStyle,
    };
  }, [aspectRatioStyle, maxWidth, isFullscreen]);

  return (
    <div 
      ref={lazyRef}
      className="generated-video-container my-1 group relative cursor-pointer"
      style={{
        ...containerStyle,
        borderRadius: 0
      }}
    >
      {/* 🚀 ChatGPT 스타일: 내부 래퍼에도 동일한 aspect-ratio 적용 */}
      <div 
        ref={containerRef}
        className={`relative w-full h-full overflow-hidden bg-black rounded-none transition-opacity duration-300 ${showPromptOverlay ? 'cursor-default opacity-0 pointer-events-none' : 'opacity-100'}`}
        style={{ aspectRatio: aspectRatioStyle }}
        onClick={showPromptOverlay ? undefined : handleVideoClick}
      >
        <video 
          ref={videoRef}
          src={shouldLoad ? url : undefined}
          playsInline
          muted={isMuted}
          loop={isLooping}
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
          onEnded={handleEnded}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          className={`w-full h-full ${isFullscreen ? 'object-contain' : 'object-cover'}`}
          preload="metadata"
          style={{ aspectRatio: aspectRatioStyle }}
          onContextMenu={(e) => {
            // Sync loop state when user changes via right-click context menu
            setTimeout(() => {
              const video = videoRef.current;
              if (video) {
                setIsLooping(video.loop);
              }
            }, 100);
          }}
        >
          Your browser does not support the video tag.
        </video>
        
        {/* Center Play Button - Visible when paused */}
        {!isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-auto" onClick={togglePlay}>
            <div className="w-16 h-16 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white transition-all hover:scale-105 hover:bg-black/50">
              <Play size={32} fill="white" className="ml-1 opacity-95" />
            </div>
          </div>
        )}

        {/* Bottom Controls Overlay */}
        <div className={`absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/80 via-black/40 to-transparent transition-opacity duration-300 pointer-events-none z-20 ${isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
          <div className="absolute bottom-0 left-0 right-0 p-4 pointer-events-auto">
            {/* Progress Bar */}
            <div 
              className="group/progress relative w-full h-1.5 mb-4 bg-white/20 rounded-full cursor-pointer overflow-visible"
              onClick={handleProgressBarClick}
            >
              {/* Hover effect area */}
              <div className="absolute -inset-y-2 left-0 right-0" />
              
              {/* Background Track */}
              <div className="absolute inset-0 bg-white/20 rounded-full" />
              
              {/* Progress Fill */}
              <div 
                className="absolute inset-y-0 left-0 bg-white rounded-full transition-all duration-150"
                style={{ width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%' }}
              >
                {/* Knob */}
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg scale-0 group-hover/progress:scale-100 transition-transform" />
              </div>
            </div>

            {/* Controls Row */}
            <div className="flex items-center justify-between text-white">
              <div className="flex items-center gap-4">
                <button onClick={togglePlay} className="hover:scale-110 transition-transform">
                  {isPlaying ? <Pause size={20} fill="white" /> : <Play size={20} fill="white" />}
                </button>
                
                <div className="text-[13px] font-medium tracking-tight opacity-90">
                  {formatTime(currentTime)} / {formatTime(duration || 0)}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Volume Control with Horizontal Slider */}
                <div 
                  className="group/volume flex items-center"
                  onMouseEnter={() => setShowVolumeSlider(true)}
                  onMouseLeave={() => setShowVolumeSlider(false)}
                >
                  {/* Horizontal Volume Slider - appears on left */}
                  <div 
                    className={`overflow-hidden transition-all duration-200 flex items-center ${showVolumeSlider ? 'w-16 mr-1' : 'w-0'}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div 
                      className="relative w-16 h-1 bg-white/30 rounded-full cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        const rect = e.currentTarget.getBoundingClientRect();
                        const clickX = e.clientX - rect.left;
                        const clickPercentage = (clickX / rect.width) * 100;
                        const newVolume = Math.max(0, Math.min(clickPercentage / 100, 1));
                        setVolumeValue(newVolume);
                      }}
                    >
                      {/* Background Track */}
                      <div className="absolute inset-0 bg-white/30 rounded-full" />
                      
                      {/* Filled Progress */}
                      <div 
                        className="absolute inset-y-0 left-0 bg-white rounded-full transition-all duration-150"
                        style={{ width: `${(isMuted ? 0 : volume) * 100}%` }}
                      />
                    </div>
                  </div>
                  
                  <button onClick={toggleMute} className="hover:scale-110 transition-transform p-1">
                    {isMuted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
                  </button>
                </div>
                
                {/* Download Button */}
                <button onClick={handleDownload} className="hover:scale-110 transition-transform p-1 opacity-80 hover:opacity-100">
                  <Download size={18} />
                </button>

                {/* Prompt Button */}
                {prompt && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowPromptOverlay(true);
                    }}
                    className="hover:scale-110 transition-transform p-1 opacity-80 hover:opacity-100"
                    aria-label="Show prompt"
                  >
                    <ScrollText size={18} />
                  </button>
                )}

                {/* Info Button */}
                {chatId && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowInfoModal(true);
                    }}
                    className="hover:scale-110 transition-transform p-1 opacity-80 hover:opacity-100"
                    aria-label="Show chat info"
                  >
                    <Info size={18} />
                  </button>
                )}

                {/* Loop Toggle */}
                <button 
                  onClick={toggleLoop} 
                  className={`hover:scale-110 transition-transform p-1 relative ${isLooping ? 'opacity-100' : 'opacity-80 hover:opacity-100'}`}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 2l4 4-4 4" />
                    <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
                    <path d="M7 22l-4-4 4-4" />
                    <path d="M21 13v1a4 4 0 0 1-4 4H3" />
                    {isLooping && (
                      <text x="12" y="14" textAnchor="middle" fontSize="8" fill="currentColor" stroke="none" fontWeight="bold">1</text>
                    )}
                  </svg>
                </button>
                
                {/* Fullscreen */}
                <button onClick={toggleFullScreen} className="hover:scale-110 transition-transform p-1 opacity-80 hover:opacity-100">
                  <Maximize size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
        
        {/* 프롬프트 오버레이 */}
        {prompt && isMounted ? createPortal(
          <div 
            className={`fixed inset-0 text-white transition-opacity duration-300 ${showPromptOverlay ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
            style={{
              zIndex: IMAGE_VIEWER_PROMPT_OVERLAY_Z,
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
              // 오버레이 내부 클릭은 무시 (버튼 클릭만 처리)
              e.stopPropagation();
            }}
          >
            {/* 배경: 블러 처리된 비디오 프레임 */}
            <div 
              className="absolute z-0"
              style={{
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                width: '100vw',
                minWidth: '100vw',
                height: '100vh',
                minHeight: '100vh',
                backgroundColor: 'rgba(0, 0, 0, 0.8)'
              }}
            />
            <div 
              className="absolute z-0 overflow-hidden"
              style={{
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                width: '100vw',
                minWidth: '100vw',
                height: '100vh',
                minHeight: '100vh'
              }}
            >
              <video
                src={url}
                className="absolute"
                style={{
                  top: 0,
                  left: 0,
                  width: '100vw',
                  minWidth: '100vw',
                  height: '100vh',
                  minHeight: '100vh',
                  objectFit: 'cover',
                  filter: 'brightness(0.3) blur(20px)',
                  transform: 'scale(1.1)',
                  objectPosition: 'center'
                }}
                muted
                loop
                autoPlay
              />
            </div>

            {/* 콘텐츠 영역 */}
            <div className="relative w-full h-full flex flex-col justify-center items-center text-center z-20 p-6">
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
                  {copied ? <Check size={18} /> : <Copy size={18} />}
                  <span className="text-sm font-medium">{copied ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        ) : null}

        {/* 정보 모달 - Apple-style minimal */}
        {showInfoModal && chatId && (
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-md rounded-none z-30 flex items-center justify-center p-6"
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
                href={`/chat/${chatId}${messageId ? `?messageId=${messageId}` : ''}`}
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
      </div>
    </div>
  );
});

export default PhotoVideoPlayer;
