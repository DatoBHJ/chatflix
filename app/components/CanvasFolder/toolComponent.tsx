import React, { useState, useEffect, memo } from 'react';

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
                        <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-[var(--background)] to-transparent"></div>
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

// Image component with loading state
export const ImageWithLoading = memo(function ImageWithLoadingComponent({ 
    src, 
    alt, 
    className = "",
    onClick,
    ...props 
  }: React.ImgHTMLAttributes<HTMLImageElement> & { onClick?: (e: React.MouseEvent) => void }) {
    const [isLoaded, setIsLoaded] = useState(false);
    const [error, setError] = useState(false);
    const [loadingProgress, setLoadingProgress] = useState(0);
    
    // Animation effect for loading simulation
    const [loadingTime, setLoadingTime] = useState(0);
    
    // pollination 이미지인지 확인
    const isPollinationImage = src && typeof src === 'string' && src.includes('image.pollinations.ai');
    
    // Simulate progress when loading starts
    useEffect(() => {
      if (!isLoaded && !error) {
        const timer = setInterval(() => {
          setLoadingTime(prev => {
            const newTime = prev + 1;
            // Calculate progress (0-95% range, jumps to 100% on actual load completion)
            const progress = Math.min(95, Math.floor(newTime * 1.5));
            setLoadingProgress(progress);
            return newTime;
          });
        }, 100);
        
        return () => clearInterval(timer);
      }
    }, [isLoaded, error]);
    
    // Check if URL is valid (simple check) - ensure src is string
    const isValidUrl = src && typeof src === 'string' && (
      src.startsWith('http://') || 
      src.startsWith('https://') || 
      src.startsWith('data:')
    );
  
    if (!isValidUrl) {
      return (
        <div className="bg-[var(--accent)] rounded-lg p-4 text-center text-[var(--muted)]">
          <svg className="w-8 h-8 mx-auto mb-2 text-[var(--muted)]" fill="none" strokeWidth="1.5" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <p>Invalid image URL</p>
        </div>
      );
    }
    
    return (
      <div className="relative w-full">
        {!isLoaded && !error && (
          <div className="bg-[var(--accent)] animate-pulse rounded-lg overflow-hidden" style={{ aspectRatio: "16/9" }}>
            {isPollinationImage ? (
              // AI 이미지 생성용 완전 미니멀 로딩 UI
              <div className="absolute inset-0 bg-[var(--accent)] flex flex-col items-center justify-center p-6">
                <div className="flex flex-col items-center space-y-4">
                  {/* 미니멀한 회전 애니메이션만 */}
                  <div className="w-6 h-6 border border-[color-mix(in_srgb,var(--foreground)_20%,transparent)] border-t-[var(--foreground)] rounded-full animate-spin"></div>
                  
                  {/* 미니멀한 로딩 텍스트 */}
                  <div className="text-center space-y-1">
                    <div className="text-[var(--foreground)] font-medium text-sm">
                      Creating image
                    </div>
                    <div className="text-[color-mix(in_srgb,var(--foreground)_60%,transparent)] text-xs">
                      This may take a moment
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              // 일반 검색 이미지용 기존 로딩 UI
              <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
                {/* Image loading icon */}
                <svg 
                  className="w-12 h-12 text-[var(--muted)] mb-2 animate-spin" 
                  fill="none" 
                  strokeWidth="1.5" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                  style={{ animationDuration: '2s' }}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                </svg>
                
                {/* Loading text - Changed from p to span to avoid nesting issues */}
                <span className="text-[var(--muted)] text-sm font-medium block">
                  Loading image... {loadingProgress}%
                </span>
                
                {/* Loading progress indicator - Avoid div inside p issue */}
                <span className="w-3/4 h-1.5 bg-[var(--muted)] bg-opacity-20 rounded-full mt-3 overflow-hidden block">
                  <span 
                    className="h-full bg-[var(--muted)] rounded-full transition-all duration-300 ease-out block"
                    style={{ width: `${loadingProgress}%` }}
                  ></span>
                </span>
                
                {/* Image description display (if available) */}
                {alt && (
                  <span className="mt-3 text-xs text-[var(--muted)] italic opacity-70 block">
                    {alt}
                  </span>
                )}
              </div>
            )}
            
            {/* Background pattern - only for non-AI images */}
            {!isPollinationImage && (
              <div className="absolute inset-0 opacity-5">
                <div className="h-full w-full" 
                  style={{ 
                    backgroundImage: 'radial-gradient(var(--muted) 1px, transparent 1px)', 
                    backgroundSize: '20px 20px' 
                  }}>
                </div>
              </div>
            )}
          </div>
        )}
        
        {error && (
          <div className="bg-[var(--accent)] rounded-lg p-6 text-center text-[var(--muted)]">
            <svg className="w-10 h-10 mx-auto mb-3 text-[var(--muted)]" fill="none" strokeWidth="1.5" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <div className="mb-1">Image failed to load</div>
            {alt && <div className="text-sm italic mb-2 opacity-75">{alt}</div>}
            {src && typeof src === 'string' && (
              <a 
                href={src}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[var(--muted-foreground)] hover:underline mt-1 block"
              >
                View image directly
              </a>
            )}
          </div>
        )}
        
        <img
          src={src}
          alt={alt || ""}
          className={`${className} ${isLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-500 rounded-lg ${onClick ? 'cursor-pointer' : ''}`}
          onLoad={() => {
            setLoadingProgress(100);
            setTimeout(() => setIsLoaded(true), 200); // Slight delay for smooth transition
          }}
          onError={() => {
            console.log('Image load error:', src);
            setError(true);
            setIsLoaded(true);
          }}
          onClick={onClick}
          loading="lazy"
          referrerPolicy="no-referrer"
          {...props}
        />
      </div>
    );
  });
