import React, { useState, useMemo, useEffect, memo, useRef } from 'react';
import MultiSearch from './MultiSearch';
import MathCalculation from './MathCalculation';
import LinkReader from './LinkReader';
import { ChevronUp, ChevronDown, Brain, Link2, Image as ImageIcon, AlertTriangle, X, ChevronLeft, ChevronRight, ExternalLink, Search, Calculator, BookOpen, FileSearch, Youtube } from 'lucide-react';
import { createPortal } from 'react-dom';
import { Tweet } from 'react-tweet';
import { motion } from 'framer-motion';
import { useRouter } from "next/navigation";
import Image from "next/image";

// Wolfram Alpha logo component
const WolframAlphaLogo = ({ size = 24, className = "", strokeWidth = 1.5 }: { size?: number, className?: string, strokeWidth?: number }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      className={className}
    >
      {/* Wolfram Alpha's red background square */}
      <rect x="2" y="2" width="20" height="20" rx="2" fill="currentColor" opacity="0.9" />
      
      {/* Wolfram "W" stylized logo in white */}
      <path 
        d="M19.5 7L17.5 17H16L14.5 10L13 17H11.5L9.5 7H11L12.25 15L13.75 7H15.25L16.75 15L18 7H19.5Z" 
        fill="white" 
        stroke="none"
      />
      <path 
        d="M8 7L6 17H4.5L6.5 7H8Z" 
        fill="white" 
        stroke="none"
      />
    </svg>
  );
};

// Custom X logo component based on the new design
const XLogo = ({ size = 24, className = "", strokeWidth = 1.5 }: { size?: number, className?: string, strokeWidth?: number }) => {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      fill="currentColor"
      viewBox="0 0 256 256" 
      className={className}
    >
      <path d="M214.75,211.71l-62.6-98.38,61.77-67.95a8,8,0,0,0-11.84-10.76L143.24,99.34,102.75,35.71A8,8,0,0,0,96,32H48a8,8,0,0,0-6.75,12.3l62.6,98.37-61.77,68a8,8,0,1,0,11.84,10.76l58.84-64.72,40.49,63.63A8,8,0,0,0,160,224h48a8,8,0,0,0,6.75-12.29ZM164.39,208,62.57,48h29L193.43,208Z"></path>
    </svg>
  );
};

// YouTube logo component
const YouTubeLogo = ({ size = 24, className = "", strokeWidth = 1.5 }: { size?: number, className?: string, strokeWidth?: number }) => {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="currentColor"
      className={className}
      strokeWidth={strokeWidth}
    >
      <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
    </svg>
  );
};

// Simple YouTube Video component
const YouTubeVideo = ({ videoId, video }: { videoId: string, video?: any }) => {
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
const ImageWithLoading = memo(function ImageWithLoadingComponent({ 
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
  
  // Check if URL is valid (simple check)
  const isValidUrl = src && (
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
          {/* Skeleton loading effect */}
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
          
          {/* Background pattern */}
          <div className="absolute inset-0 opacity-5">
            <div className="h-full w-full" 
              style={{ 
                backgroundImage: 'radial-gradient(var(--muted) 1px, transparent 1px)', 
                backgroundSize: '20px 20px' 
              }}>
            </div>
          </div>
        </div>
      )}
      
      {error && (
        <div className="bg-[var(--accent)] rounded-lg p-6 text-center text-[var(--muted)]">
          <svg className="w-10 h-10 mx-auto mb-3 text-[var(--muted)]" fill="none" strokeWidth="1.5" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <div className="mb-1">Image failed to load</div>
          {alt && <div className="text-sm italic mb-2 opacity-75">{alt}</div>}
          {src && (
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

type CanvasProps = {
  webSearchData: {
    result: any;
    args: any;
    annotations: any[];
  } | null;
  mathCalculationData: {
    calculationSteps: any[];
  } | null;
  linkReaderData?: {
    linkAttempts: {
      url: string;
      title?: string;
      error?: string;
      timestamp?: string;
    }[];
  } | null;
  agentReasoningData?: {
    reasoning: string;
    needsWebSearch: boolean;
    needsCalculator: boolean;
    needsLinkReader?: boolean;
    needsImageGenerator?: boolean;
    needsAcademicSearch?: boolean;
    needsXSearch?: boolean;
    needsYouTubeSearch?: boolean;
    needsYouTubeLinkAnalyzer?: boolean;
    timestamp: string;
    isComplete?: boolean;
  } | null;
  agentReasoningProgress?: {
    reasoning: string;
    needsWebSearch: boolean;
    needsCalculator: boolean;
    needsLinkReader?: boolean;
    needsImageGenerator?: boolean;
    needsAcademicSearch?: boolean;
    needsXSearch?: boolean;
    needsYouTubeSearch?: boolean;
    needsYouTubeLinkAnalyzer?: boolean;
    timestamp: string;
    isComplete: boolean;
  }[];
  imageGeneratorData?: {
    generatedImages: {
      imageUrl: string;
      prompt: string;
      model?: string;
      timestamp?: string;
    }[];
  } | null;
  academicSearchData?: {
    academicResults: {
      query: string;
      timestamp?: string;
      results: {
        title: string;
        url: string;
        summary?: string;
      }[];
    }[];
  } | null;
  xSearchData?: {
    xResults: {
      query: string;
      timestamp?: string;
      results: {
        text: string;
        username: string;
        url: string;
        date?: string;
        tweetId?: string;
      }[];
    }[];
  } | null;
  youTubeSearchData?: {
    youtubeResults: {
      query: string;
      timestamp?: string;
      results: {
        videoId: string;
        url: string;
        details?: {
          title?: string;
          description?: string;
          channelName?: string;
          publishDate?: string;
          viewCount?: number;
          duration?: string;
          thumbnailUrl?: string;
        };
        captions?: string;
        timestamps?: {
          time: string;
          text: string;
        }[];
      }[];
    }[];
  } | null;
  youTubeLinkAnalysisData?: {
    analysisResults: {
      url: string;
      videoId: string;
      timestamp: string;
      details?: {
        title?: string;
        description?: string;
        author?: string;
        publishedTime?: string;
        views?: number;
        likes?: number;
        category?: string;
        duration?: number;
      };
      channel?: {
        name?: string;
        id?: string;
        subscribers?: string;
        link?: string;
      };
      transcript?: {
        language: string;
        segments: {
          timestamp: string;
          start: number;
          duration: number;
          text: string;
        }[];
        fullText: string;
      };
      transcriptError?: string;
      error?: string;
    }[];
  } | null;
  wolframAlphaData?: {
    query: string;
    pods: {
      title: string;
      subpods: {
        plaintext?: string;
        img?: {
          src: string;
          alt: string;
          width: number;
          height: number;
        };
        markdown?: string;
      }[];
    }[];
    error?: string;
    timing?: string;
  } | null;
};

// Wolfram Alpha Results Component
const WolframAlphaResults = ({ data }: { data: NonNullable<CanvasProps["wolframAlphaData"]> }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  
  if (!data) {
    return (
      <div className="my-4 p-4 bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] rounded-lg">
        <div className="flex items-center gap-2 text-[color-mix(in_srgb,var(--foreground)_75%,transparent)]">
          <WolframAlphaLogo size={18} className="text-red-500" />
          <h3 className="font-medium">Wolfram Alpha</h3>
        </div>
        <p className="mt-2 text-sm text-[color-mix(in_srgb,var(--foreground)_65%,transparent)]">
          Failed to get results from Wolfram Alpha.
        </p>
      </div>
    );
  }

  if (data.error) {
    return (
      <div className="my-4 p-4 bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] rounded-lg">
        <div className="flex items-center gap-2 text-[color-mix(in_srgb,var(--foreground)_75%,transparent)]">
          <WolframAlphaLogo size={18} className="text-red-500" />
          <h3 className="font-medium">Wolfram Alpha</h3>
        </div>
        <p className="mt-2 text-sm text-[color-mix(in_srgb,var(--foreground)_65%,transparent)]">
          {data.error}
        </p>
      </div>
    );
  }

  if (!data.pods || !Array.isArray(data.pods) || data.pods.length === 0) {
    return (
      <div className="my-4 p-4 bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] rounded-lg">
        <div className="flex items-center gap-2 text-[color-mix(in_srgb,var(--foreground)_75%,transparent)]">
          <WolframAlphaLogo size={18} className="text-[color-mix(in_srgb,var(--foreground)_60%,transparent)]" />
          <h3 className="font-medium">Wolfram Alpha Results</h3>
        </div>
        <p className="mt-2 text-sm text-[color-mix(in_srgb,var(--foreground)_65%,transparent)]">
          {data.query ? `Query: "${data.query}"` : ""}
        </p>
        <p className="mt-2 text-sm text-[color-mix(in_srgb,var(--foreground)_65%,transparent)]">
          No results were found for this query.
        </p>
      </div>
    );
  }

  return (
    <div className="my-4 bg-[color-mix(in_srgb,var(--foreground)_4%,transparent)] rounded-lg overflow-hidden">
      <div 
        className="flex items-center justify-between p-3 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <WolframAlphaLogo size={18} className="text-[color-mix(in_srgb,var(--foreground)_60%,transparent)]" />
          <h3 className="text-sm font-medium">
            Wolfram Alpha Results
            {data.query && <span className="ml-1 font-normal text-[color-mix(in_srgb,var(--foreground)_70%,transparent)]">for "{data.query}"</span>}
          </h3>
        </div>
        
        <div className="flex items-center gap-2">
          {data.timing && (
            <span className="text-xs text-[color-mix(in_srgb,var(--foreground)_50%,transparent)]">
              {data.timing}
            </span>
          )}
          <button
            className="p-1 rounded-full hover:bg-[color-mix(in_srgb,var(--foreground)_10%,transparent)]"
            aria-label={isExpanded ? "Collapse results" : "Expand results"}
          >
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="p-3 border-t border-[color-mix(in_srgb,var(--foreground)_10%,transparent)]">
          {data.pods.map((pod, index) => (
            <div key={index} className="mb-4 last:mb-0">
              <div className="mb-2">
                <h4 className="text-sm font-medium">{pod.title}</h4>
              </div>
              
              <div className="pl-4">
                {pod.subpods && Array.isArray(pod.subpods) && pod.subpods.map((subpod, subIndex) => (
                  <div key={subIndex} className="mb-3 last:mb-0">
                    {subpod.markdown ? (
                      <div 
                        className="text-sm"
                        dangerouslySetInnerHTML={{ __html: subpod.markdown }}
                      />
                    ) : subpod.img ? (
                      <a 
                        href={subpod.img.src} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="block"
                      >
                        <img 
                          src={subpod.img.src} 
                          alt={subpod.img.alt || pod.title}
                          className="max-w-full rounded"
                        />
                      </a>
                    ) : subpod.plaintext ? (
                      <div className="text-sm whitespace-pre-wrap font-mono text-[color-mix(in_srgb,var(--foreground)_85%,transparent)]">
                        {subpod.plaintext}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Canvas Component - An integrated container to display multiple tool results
 * Currently shows web search, math calculation, and link reader results, but can easily be extended to other tools in the future
 */
export default function Canvas({ 
  webSearchData, 
  mathCalculationData, 
  linkReaderData, 
  agentReasoningData, 
  agentReasoningProgress = [], 
  imageGeneratorData, 
  academicSearchData, 
  xSearchData, 
  youTubeSearchData, 
  youTubeLinkAnalysisData,
  wolframAlphaData
}: CanvasProps) {
  // Don't render if there's no data to display
  if (!webSearchData && !mathCalculationData && !linkReaderData && !agentReasoningData && agentReasoningProgress.length === 0 && !imageGeneratorData && !academicSearchData && !xSearchData && !youTubeSearchData && !youTubeLinkAnalysisData && !wolframAlphaData) return null;

  // Manage expanded/collapsed state for each section
  const [webSearchExpanded, setWebSearchExpanded] = useState(true);
  const [mathCalcExpanded, setMathCalcExpanded] = useState(true);
  const [linkReaderExpanded, setLinkReaderExpanded] = useState(true);
  const [reasoningExpanded, setReasoningExpanded] = useState(true);
  const [imageGenExpanded, setImageGenExpanded] = useState(true);
  const [academicSearchExpanded, setAcademicSearchExpanded] = useState(true);
  const [xSearchExpanded, setXSearchExpanded] = useState(true);
  const [youTubeSearchExpanded, setYouTubeSearchExpanded] = useState(true);
  const [youTubeLinkAnalysisExpanded, setYouTubeLinkAnalysisExpanded] = useState(true);
  
  // State for image viewer modal
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(-1);
  const [isMounted, setIsMounted] = useState(false);
  
  // State to store the latest reasoning data (either complete or in progress)
  const [currentReasoning, setCurrentReasoning] = useState<{
    [x: string]: any;
    reasoning: string;
    needsWebSearch: boolean;
    needsCalculator: boolean;
    needsLinkReader?: boolean;
    needsImageGenerator?: boolean;
    needsAcademicSearch?: boolean;
    needsXSearch?: boolean;
    needsYouTubeSearch?: boolean;
    needsYouTubeLinkAnalyzer?: boolean;
    timestamp: string;
    isComplete: boolean;
  } | null>(null);

  // Use ref to track previous data
  const prevReasoningDataRef = useRef<typeof agentReasoningData>(null);
  const prevProgressRef = useRef<typeof agentReasoningProgress>([]);

  // Check if we're in browser environment for portal rendering
  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);
  
  // Add keyboard navigation for image viewer
  useEffect(() => {
    if (selectedImageIndex === -1) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeImageViewer();
      } else if (e.key === 'ArrowRight') {
        navigateImage('next');
      } else if (e.key === 'ArrowLeft') {
        navigateImage('prev');
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [selectedImageIndex, imageGeneratorData]);

  // Effect to handle reasoning data updates (both complete and in progress)
  useEffect(() => {
    // 1. isComplete가 true인 완료된 데이터가 이미 있으면 우선 보존
    if (currentReasoning?.isComplete) {
      return;
    }
    
    // 2. 완료된 새 데이터가 있으면 업데이트
    if (agentReasoningData) {
      const newReasoning = {
        ...agentReasoningData,
        isComplete: agentReasoningData.isComplete ?? true
      };
      setCurrentReasoning(newReasoning);
      return;
    }
    
    // 3. 진행 중인 데이터만 있고 현재 데이터가 없는 경우에만 업데이트
    if (agentReasoningProgress?.length > 0 && !currentReasoning) {
      const latestProgress = agentReasoningProgress[agentReasoningProgress.length - 1];
      setCurrentReasoning(latestProgress);
    }
  }, [agentReasoningData, agentReasoningProgress, currentReasoning]);
  
  // Image viewer functions
  const openImageViewer = (index: number) => {
    setSelectedImageIndex(index);
  };
  
  const closeImageViewer = () => {
    setSelectedImageIndex(-1);
  };
  
  const navigateImage = (direction: 'prev' | 'next') => {
    if (!imageGeneratorData?.generatedImages || imageGeneratorData.generatedImages.length === 0) return;
    
    const count = imageGeneratorData.generatedImages.length;
    const newIndex = direction === 'next' 
      ? (selectedImageIndex + 1) % count 
      : (selectedImageIndex - 1 + count) % count;
    
    setSelectedImageIndex(newIndex);
  };

  return (
    <div className="tool-results-canvas my-4 space-y-4">
      {/* Agent Reasoning Section */}
      {currentReasoning && (
        <div className="p-4 sm:p-5 bg-gradient-to-br from-[color-mix(in_srgb,var(--background)_97%,var(--foreground)_3%)] to-[color-mix(in_srgb,var(--background)_99%,var(--foreground)_1%)] backdrop-blur-xl rounded-xl border border-[color-mix(in_srgb,var(--foreground)_7%,transparent)] shadow-sm">
          <div 
            className="flex items-center justify-between w-full mb-4 cursor-pointer"
            onClick={() => setReasoningExpanded(!reasoningExpanded)}
          >
            <div className="flex items-center gap-2.5">
              <Brain className="h-4 w-4 text-[var(--foreground)]" strokeWidth={1.5} />
              <h2 className="font-medium text-left tracking-tight">Chatflix Agent Analysis</h2>
            </div>
            <div className="flex items-center gap-2">
              {!currentReasoning.isComplete && 
                <span className="text-xs font-normal text-blue-500 animate-pulse mr-2">(thinking...)</span>
              }
              <div className="rounded-full p-1 hover:bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] transition-colors">
                {reasoningExpanded ? 
                  <ChevronUp size={16} className="text-[color-mix(in_srgb,var(--foreground)_50%,transparent)]" /> : 
                  <ChevronDown size={16} className="text-[color-mix(in_srgb,var(--foreground)_50%,transparent)]" />
                }
              </div>
            </div>
          </div>
          {reasoningExpanded && (
            <div className="px-0">
              <div className="mb-3">
                {/* <div className="text-xs uppercase tracking-wide text-[var(--muted)] mb-2">Reasoning Process</div> */}
                <p className="text-sm whitespace-pre-wrap text-[color-mix(in_srgb,var(--foreground)_85%,transparent)]">{currentReasoning.reasoning}</p>
              </div>
              <div className="mt-4">
                {/* <div className="text-xs uppercase tracking-wide text-[var(--muted)] mb-2">Tool Selection</div> */}
                <div className="flex flex-wrap items-start gap-2 text-sm">
                  <div className={`px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all ${
                    currentReasoning.needsWebSearch 
                      ? "bg-gradient-to-r from-green-500/20 to-green-500/10 shadow-sm border border-green-500/20" 
                      : "bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] border border-transparent"
                  }`}>
                    <Search size={14} className={currentReasoning.needsWebSearch ? "text-green-500" : "text-[var(--muted)]"} strokeWidth={1.5} />
                    <span className={`text-xs font-medium ${currentReasoning.needsWebSearch ? "text-green-500" : ""}`}>Web Search</span>
                  </div>
                  
                  <div className={`px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all ${
                    currentReasoning.needsCalculator 
                      ? "bg-gradient-to-r from-green-500/20 to-green-500/10 shadow-sm border border-green-500/20" 
                      : "bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] border border-transparent"
                  }`}>
                    <Calculator size={14} className={currentReasoning.needsCalculator ? "text-green-500" : "text-[var(--muted)]"} strokeWidth={1.5} />
                    <span className={`text-xs font-medium ${currentReasoning.needsCalculator ? "text-green-500" : ""}`}>Calculator</span>
                  </div>
                  
                  <div className={`px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all ${
                    currentReasoning.needsLinkReader 
                      ? "bg-gradient-to-r from-green-500/20 to-green-500/10 shadow-sm border border-green-500/20" 
                      : "bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] border border-transparent"
                  }`}>
                    <Link2 size={14} className={currentReasoning.needsLinkReader ? "text-green-500" : "text-[var(--muted)]"} strokeWidth={1.5} />
                    <span className={`text-xs font-medium ${currentReasoning.needsLinkReader ? "text-green-500" : ""}`}>Link Reader</span>
                  </div>
                  
                  <div className={`px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all ${
                    currentReasoning.needsImageGenerator 
                      ? "bg-gradient-to-r from-green-500/20 to-green-500/10 shadow-sm border border-green-500/20" 
                      : "bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] border border-transparent"
                  }`}>
                    <ImageIcon size={14} className={currentReasoning.needsImageGenerator ? "text-green-500" : "text-[var(--muted)]"} strokeWidth={1.5} />
                    <span className={`text-xs font-medium ${currentReasoning.needsImageGenerator ? "text-green-500" : ""}`}>Image Gen</span>
                  </div>
                  
                  <div className={`px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all ${
                    currentReasoning.needsAcademicSearch 
                      ? "bg-gradient-to-r from-green-500/20 to-green-500/10 shadow-sm border border-green-500/20" 
                      : "bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] border border-transparent"
                  }`}>
                    <BookOpen size={14} className={currentReasoning.needsAcademicSearch ? "text-green-500" : "text-[var(--muted)]"} strokeWidth={1.5} />
                    <span className={`text-xs font-medium ${currentReasoning.needsAcademicSearch ? "text-green-500" : ""}`}>Academic Search</span>
                  </div>
                  
                  <div className={`px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all ${
                    currentReasoning.needsXSearch 
                      ? "bg-gradient-to-r from-green-500/20 to-green-500/10 shadow-sm border border-green-500/20" 
                      : "bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] border border-transparent"
                  }`}>
                    <XLogo size={14} className={currentReasoning.needsXSearch ? "text-green-500" : "text-[var(--muted)]"} strokeWidth={1.5} />
                    <span className={`text-xs font-medium ${currentReasoning.needsXSearch ? "text-green-500" : ""}`}>X Search</span>
                  </div>
                  
                  <div className={`px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all ${
                    currentReasoning.needsYouTubeSearch 
                      ? "bg-gradient-to-r from-green-500/20 to-green-500/10 shadow-sm border border-green-500/20" 
                      : "bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] border border-transparent"
                  }`}>
                    <YouTubeLogo size={14} className={currentReasoning.needsYouTubeSearch ? "text-green-500" : "text-[var(--muted)]"} strokeWidth={1.5} />
                    <span className={`text-xs font-medium ${currentReasoning.needsYouTubeSearch ? "text-green-500" : ""}`}>YouTube</span>
                </div>

                  <div className={`px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all ${
                    currentReasoning.needsYouTubeLinkAnalyzer 
                      ? "bg-gradient-to-r from-green-500/20 to-green-500/10 shadow-sm border border-green-500/20" 
                      : "bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] border border-transparent"
                  }`}>
                    <YouTubeLogo size={14} className={currentReasoning.needsYouTubeLinkAnalyzer ? "text-green-500" : "text-[var(--muted)]"} strokeWidth={1.5} />
                    <span className={`text-xs font-medium ${currentReasoning.needsYouTubeLinkAnalyzer ? "text-green-500" : ""}`}>Video Analysis</span>
                  </div>

                  <div className={`px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all ${
                    currentReasoning.needsWolframAlpha 
                      ? "bg-gradient-to-r from-green-500/20 to-green-500/10 shadow-sm border border-green-500/20" 
                      : "bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] border border-transparent"
                  }`}>
                    <WolframAlphaLogo size={14} className={currentReasoning.needsWolframAlpha ? "text-green-500" : "text-[var(--muted)]"} strokeWidth={1.5} />
                    <span className={`text-xs font-medium ${currentReasoning.needsWolframAlpha ? "text-green-500" : ""}`}>Wolfram Alpha</span>
                  </div>
        
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Web Search Results or Loading State */}
      {webSearchData && (
        <div className="p-4 sm:p-5 bg-gradient-to-br from-[color-mix(in_srgb,var(--background)_97%,var(--foreground)_3%)] to-[color-mix(in_srgb,var(--background)_99%,var(--foreground)_1%)] backdrop-blur-xl rounded-xl border border-[color-mix(in_srgb,var(--foreground)_7%,transparent)] shadow-sm">
          <div 
            className="flex items-center justify-between w-full mb-4 cursor-pointer"
            onClick={() => setWebSearchExpanded(!webSearchExpanded)}
          >
            <div className="flex items-center gap-2.5">
              <Search className="h-4 w-4 text-[var(--foreground)]" strokeWidth={1.5} />
              <h2 className="font-medium text-left tracking-tight">Web Search</h2>
            </div>
            <div className="flex items-center gap-2">
              <div className="rounded-full p-1 hover:bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] transition-colors">
                {webSearchExpanded ? 
                  <ChevronUp size={16} className="text-[color-mix(in_srgb,var(--foreground)_50%,transparent)]" /> : 
                  <ChevronDown size={16} className="text-[color-mix(in_srgb,var(--foreground)_50%,transparent)]" />
                }
              </div>
            </div>
          </div>
          {webSearchExpanded && (
            <div className="overflow-hidden">
            <MultiSearch 
              result={webSearchData.result} 
              args={webSearchData.args}
              annotations={webSearchData.annotations}
            />
            </div>
          )}
        </div>
      )}
      
      {/* Math Calculation Results */}
      {mathCalculationData && (
        <div className="p-4 sm:p-5 bg-gradient-to-br from-[color-mix(in_srgb,var(--background)_97%,var(--foreground)_3%)] to-[color-mix(in_srgb,var(--background)_99%,var(--foreground)_1%)] backdrop-blur-xl rounded-xl border border-[color-mix(in_srgb,var(--foreground)_7%,transparent)] shadow-sm">
          <div 
            className="flex items-center justify-between w-full mb-4 cursor-pointer"
            onClick={() => setMathCalcExpanded(!mathCalcExpanded)}
          >
            <div className="flex items-center gap-2.5">
              <Calculator className="h-4 w-4 text-[var(--foreground)]" strokeWidth={1.5} />
              <h2 className="font-medium text-left tracking-tight">Math Calculation</h2>
            </div>
            <div className="flex items-center gap-2">
              <div className="rounded-full p-1 hover:bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] transition-colors">
                {mathCalcExpanded ? 
                  <ChevronUp size={16} className="text-[color-mix(in_srgb,var(--foreground)_50%,transparent)]" /> : 
                  <ChevronDown size={16} className="text-[color-mix(in_srgb,var(--foreground)_50%,transparent)]" />
                }
              </div>
            </div>
          </div>
          {mathCalcExpanded && (
            <MathCalculation
              calculationSteps={mathCalculationData.calculationSteps}
            />
          )}
        </div>
      )}
      
      {/* Link Reader Results */}
      {linkReaderData && (
        <div className="p-4 sm:p-5 bg-gradient-to-br from-[color-mix(in_srgb,var(--background)_97%,var(--foreground)_3%)] to-[color-mix(in_srgb,var(--background)_99%,var(--foreground)_1%)] backdrop-blur-xl rounded-xl border border-[color-mix(in_srgb,var(--foreground)_7%,transparent)] shadow-sm">
          <div 
            className="flex items-center justify-between w-full mb-4 cursor-pointer"
            onClick={() => setLinkReaderExpanded(!linkReaderExpanded)}
          >
            <div className="flex items-center gap-2.5">
              <Link2 className="h-4 w-4 text-[var(--foreground)]" strokeWidth={1.5} />
              <h2 className="font-medium text-left tracking-tight">Link Reading</h2>
            </div>
            <div className="flex items-center gap-2">
              <div className="rounded-full p-1 hover:bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] transition-colors">
                {linkReaderExpanded ? 
                  <ChevronUp size={16} className="text-[color-mix(in_srgb,var(--foreground)_50%,transparent)]" /> : 
                  <ChevronDown size={16} className="text-[color-mix(in_srgb,var(--foreground)_50%,transparent)]" />
                }
              </div>
            </div>
          </div>
          {linkReaderExpanded && (
            <LinkReader
              linkAttempts={linkReaderData.linkAttempts}
            />
          )}
        </div>
      )}

      {/* Image Generator Results */}
      {imageGeneratorData && imageGeneratorData.generatedImages.length > 0 && (
        <div className="p-4 sm:p-5 bg-gradient-to-br from-[color-mix(in_srgb,var(--background)_97%,var(--foreground)_3%)] to-[color-mix(in_srgb,var(--background)_99%,var(--foreground)_1%)] backdrop-blur-xl rounded-xl border border-[color-mix(in_srgb,var(--foreground)_7%,transparent)] shadow-sm">
          <div 
            className="flex items-center justify-between w-full mb-4 cursor-pointer"
            onClick={() => setImageGenExpanded(!imageGenExpanded)}
          >
            <div className="flex items-center gap-2.5">
              <ImageIcon className="h-4 w-4 text-[var(--foreground)]" strokeWidth={1.5} />
              <h2 className="font-medium text-left tracking-tight">Generated Images</h2>
            </div>
            <div className="flex items-center gap-2">
              <div className="rounded-full p-1 hover:bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] transition-colors">
                {imageGenExpanded ? 
                  <ChevronUp size={16} className="text-[color-mix(in_srgb,var(--foreground)_50%,transparent)]" /> : 
                  <ChevronDown size={16} className="text-[color-mix(in_srgb,var(--foreground)_50%,transparent)]" />
                }
              </div>
            </div>
          </div>
          {imageGenExpanded && (
            <div className="p-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {imageGeneratorData.generatedImages.map((image, index) => (
                  <div 
                    key={index} 
                    className="border border-[color-mix(in_srgb,var(--foreground)_7%,transparent)] rounded-xl overflow-hidden shadow-sm hover:shadow-md hover:scale-[1.02] hover:border-[color-mix(in_srgb,var(--foreground)_10%,transparent)] transition-all duration-200 cursor-pointer bg-[color-mix(in_srgb,var(--foreground)_2%,transparent)] hover:bg-[color-mix(in_srgb,var(--foreground)_3%,transparent)]"
                    onClick={() => openImageViewer(index)}
                  >
                    <ImageWithLoading 
                      src={image.imageUrl} 
                      alt={`Generated image: ${image.prompt}`}
                      className="w-full h-auto object-contain transition-opacity hover:opacity-95"
                      onClick={() => openImageViewer(index)}
                    />
                    <div className="p-3.5 bg-[color-mix(in_srgb,var(--foreground)_2%,transparent)]">
                      <p className="text-xs text-[color-mix(in_srgb,var(--foreground)_80%,transparent)] line-clamp-2">{image.prompt}</p>
                      {image.model && (
                        <div className="mt-2 text-xs text-[color-mix(in_srgb,var(--foreground)_60%,transparent)]">
                          <span className="font-medium">Model:</span> {image.model}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Academic Search Results */}
      {academicSearchData && academicSearchData.academicResults.length > 0 && (
        <div className="p-4 sm:p-5 bg-gradient-to-br from-[color-mix(in_srgb,var(--background)_97%,var(--foreground)_3%)] to-[color-mix(in_srgb,var(--background)_99%,var(--foreground)_1%)] backdrop-blur-xl rounded-xl border border-[color-mix(in_srgb,var(--foreground)_7%,transparent)] shadow-sm">
          <div 
            className="flex items-center justify-between w-full mb-4 cursor-pointer"
            onClick={() => setAcademicSearchExpanded(!academicSearchExpanded)}
          >
            <div className="flex items-center gap-2.5">
              <BookOpen className="h-4 w-4 text-[var(--foreground)]" strokeWidth={1.5} />
              <h2 className="font-medium text-left tracking-tight">Academic Search</h2>
            </div>
            <div className="flex items-center gap-2">
              <div className="rounded-full p-1 hover:bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] transition-colors">
                {academicSearchExpanded ? 
                  <ChevronUp size={16} className="text-[color-mix(in_srgb,var(--foreground)_50%,transparent)]" /> : 
                  <ChevronDown size={16} className="text-[color-mix(in_srgb,var(--foreground)_50%,transparent)]" />
                }
              </div>
            </div>
          </div>
          {academicSearchExpanded && (
            <div className="px-1">
              {academicSearchData.academicResults.map((searchResult, index) => (
                <div key={index} className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Search className="h-3 w-3" strokeWidth={1.5} />
                    <h4 className="text-sm font-medium">"{searchResult.query}"</h4>
                  </div>
                  <ul className="space-y-3">
                    {searchResult.results.map((paper, paperIndex) => (
                      <li key={paperIndex} className="p-3 border border-[color-mix(in_srgb,var(--foreground)_5%,transparent)] rounded-lg bg-[color-mix(in_srgb,var(--foreground)_1%,transparent)] hover:bg-[color-mix(in_srgb,var(--foreground)_2%,transparent)] transition-colors">
                        <h5 className="text-sm font-medium mb-1">{paper.title}</h5>
                        {paper.summary && (
                          <p className="text-sm whitespace-pre-wrap text-[color-mix(in_srgb,var(--foreground)_75%,transparent)] my-1">
                            {paper.summary}
                          </p>
                        )}
                        {paper.url && (
                          <a 
                            href={paper.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-500 hover:underline mt-2 inline-flex items-center gap-1"
                          >
                            <span>Read paper</span>
                            <ExternalLink size={12} />
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      
      {/* X Search Results */}
      {xSearchData && xSearchData.xResults.length > 0 && (
        <div className="p-4 sm:p-5 bg-gradient-to-br from-[color-mix(in_srgb,var(--background)_97%,var(--foreground)_3%)] to-[color-mix(in_srgb,var(--background)_99%,var(--foreground)_1%)] backdrop-blur-xl rounded-xl border border-[color-mix(in_srgb,var(--foreground)_7%,transparent)] shadow-sm">
          <div 
            className="flex items-center justify-between w-full mb-4 cursor-pointer"
            onClick={() => setXSearchExpanded(!xSearchExpanded)}
          >
            <div className="flex items-center gap-2.5">
              <XLogo className="h-4 w-4 text-[var(--foreground)]" strokeWidth={1.5} />
              <h2 className="font-medium text-left tracking-tight">X Search</h2>
            </div>
            <div className="flex items-center gap-2">
              <div className="rounded-full p-1 hover:bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] transition-colors">
                {xSearchExpanded ? 
                  <ChevronUp size={16} className="text-[color-mix(in_srgb,var(--foreground)_50%,transparent)]" /> : 
                  <ChevronDown size={16} className="text-[color-mix(in_srgb,var(--foreground)_50%,transparent)]" />
                }
              </div>
            </div>
          </div>
          {xSearchExpanded && (
            <div className="px-1">
              {xSearchData.xResults.map((searchResult, index) => (
                <div key={index} className="mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <XLogo className="h-3 w-3" strokeWidth={1.5} />
                    <h4 className="text-sm font-medium">"{searchResult.query}"</h4>
                  </div>
                  
                  {/* Tweet display section */}
                  <div className="mb-4">
                    {/* Tweets with embedded rendering if tweetId exists */}
                    <div className="grid grid-cols-1 gap-4">
                      {searchResult.results.map((post, postIndex) => (
                        <div key={postIndex} className="w-full overflow-hidden transition-all hover:shadow-md rounded-lg">
                          {post.tweetId ? (
                            // If tweetId is available, use the Tweet component
                            <div className="w-full [&>div]:w-full [&>div]:mx-auto rounded-lg overflow-hidden [&_a]:!text-[color-mix(in_srgb,var(--foreground)_75%,transparent)] [&_a:hover]:!text-[color-mix(in_srgb,var(--foreground)_90%,transparent)] [&_.react-tweet-theme]:!bg-[color-mix(in_srgb,var(--background)_97%,var(--foreground)_3%)] dark:[&_.react-tweet-theme]:!bg-[color-mix(in_srgb,var(--background)_97%,var(--foreground)_3%)] [&_.react-tweet-border]:!border-[color-mix(in_srgb,var(--foreground)_5%,transparent)] [&_hr]:!border-[color-mix(in_srgb,var(--foreground)_5%,transparent)] [&_div[data-separator]]:!border-[color-mix(in_srgb,var(--foreground)_5%,transparent)] [&_.react-tweet-header-border]:!border-[color-mix(in_srgb,var(--foreground)_5%,transparent)] [&_.react-tweet-footer-border]:!border-[color-mix(in_srgb,var(--foreground)_5%,transparent)] [&_*]:!border-[color-mix(in_srgb,var(--foreground)_5%,transparent)]">
                              <Tweet id={post.tweetId} />
                            </div>
                          ) : (
                            // Fallback to text representation if no tweetId
                            <div className="p-3 border border-[color-mix(in_srgb,var(--foreground)_5%,transparent)] rounded-lg bg-[color-mix(in_srgb,var(--foreground)_1%,transparent)] hover:bg-[color-mix(in_srgb,var(--foreground)_2%,transparent)] transition-colors">
                              <div className="flex gap-2 mb-1">
                                <span className="text-sm font-medium">@{post.username}</span>
                                {post.date && <span className="text-xs text-[color-mix(in_srgb,var(--foreground)_60%,transparent)]">{post.date}</span>}
                              </div>
                              <p className="text-sm whitespace-pre-wrap text-[color-mix(in_srgb,var(--foreground)_75%,transparent)] my-1">
                                {post.text}
                              </p>
                              {post.url && (
                                <a 
                                  href={post.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-[color-mix(in_srgb,var(--foreground)_75%,transparent)] hover:text-[color-mix(in_srgb,var(--foreground)_90%,transparent)] hover:underline mt-2 inline-flex items-center gap-1"
                                >
                                  <span>View post</span>
                                  <ExternalLink size={12} />
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      
      {/* YouTube Search Results */}
      {youTubeSearchData && (
        <div className="p-4 sm:p-5 bg-gradient-to-br from-[color-mix(in_srgb,var(--background)_97%,var(--foreground)_3%)] to-[color-mix(in_srgb,var(--background)_99%,var(--foreground)_1%)] backdrop-blur-xl rounded-xl border border-[color-mix(in_srgb,var(--foreground)_7%,transparent)] shadow-sm">
          <div 
            className="flex items-center justify-between w-full mb-4 cursor-pointer"
            onClick={() => setYouTubeSearchExpanded(!youTubeSearchExpanded)}
          >
            <div className="flex items-center gap-2.5">
              <YouTubeLogo className="h-4 w-4 text-[var(--foreground)]" strokeWidth={1.5} />
              <h2 className="font-medium text-left tracking-tight">YouTube Search</h2>
            </div>
            <div className="flex items-center gap-2">
              <div className="rounded-full p-1 hover:bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] transition-colors">
                {youTubeSearchExpanded ? 
                  <ChevronUp size={16} className="text-[color-mix(in_srgb,var(--foreground)_50%,transparent)]" /> : 
                  <ChevronDown size={16} className="text-[color-mix(in_srgb,var(--foreground)_50%,transparent)]" />
                }
              </div>
            </div>
          </div>
          {youTubeSearchExpanded && (
            <div className="space-y-6">
              {youTubeSearchData.youtubeResults.map((searchResult, index) => (
                <div key={index} className="space-y-4">
                  <div className="text-sm font-medium text-[color-mix(in_srgb,var(--foreground)_90%,transparent)]">
                    Search: <span className="italic">"{searchResult.query}"</span>
                  </div>
                  
                  {/* Video display section */}
                  <div className="mb-4">
                    {/* Videos with embedded rendering if videoId exists */}
                    <div className="grid grid-cols-1 gap-4">
                      {searchResult.results.map((video, videoIndex) => (
                        <div key={videoIndex} className="w-full overflow-hidden transition-all hover:shadow-md rounded-lg">
                          {video.videoId ? (
                            // If videoId is available, use the YouTube video component
                            <div className="w-full [&>div]:w-full [&>div]:mx-auto rounded-lg overflow-hidden [&_a]:!text-[color-mix(in_srgb,var(--foreground)_75%,transparent)] [&_a:hover]:!text-[color-mix(in_srgb,var(--foreground)_90%,transparent)] [&_.react-tweet-theme]:!bg-[color-mix(in_srgb,var(--background)_97%,var(--foreground)_3%)] dark:[&_.react-tweet-theme]:!bg-[color-mix(in_srgb,var(--background)_97%,var(--foreground)_3%)] [&_.react-tweet-border]:!border-[color-mix(in_srgb,var(--foreground)_5%,transparent)] [&_hr]:!border-[color-mix(in_srgb,var(--foreground)_5%,transparent)] [&_div[data-separator]]:!border-[color-mix(in_srgb,var(--foreground)_5%,transparent)] [&_.react-tweet-header-border]:!border-[color-mix(in_srgb,var(--foreground)_5%,transparent)] [&_.react-tweet-footer-border]:!border-[color-mix(in_srgb,var(--foreground)_5%,transparent)] [&_*]:!border-[color-mix(in_srgb,var(--foreground)_5%,transparent)]">
                              <YouTubeVideo videoId={video.videoId} video={video.details || video} />
                            </div>
                          ) : (
                            // Fallback to text representation if no videoId
                            <div className="p-3 border border-[color-mix(in_srgb,var(--foreground)_5%,transparent)] rounded-lg bg-[color-mix(in_srgb,var(--foreground)_1%,transparent)] hover:bg-[color-mix(in_srgb,var(--foreground)_2%,transparent)] transition-colors">
                              <div className="flex gap-2 mb-1">
                                <span className="text-sm font-medium">{video.details?.title || "Untitled Video"}</span>
                                {video.details?.publishDate && <span className="text-xs text-[color-mix(in_srgb,var(--foreground)_60%,transparent)]">{video.details.publishDate}</span>}
                              </div>
                              <p className="text-sm whitespace-pre-wrap text-[color-mix(in_srgb,var(--foreground)_75%,transparent)] my-1">
                                {video.details?.description || "No description available"}
                              </p>
                              {video.url && (
                                <a 
                                  href={video.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-[color-mix(in_srgb,var(--foreground)_75%,transparent)] hover:text-[color-mix(in_srgb,var(--foreground)_90%,transparent)] hover:underline mt-2 inline-flex items-center gap-1"
                                >
                                  <span>View video</span>
                                  <ExternalLink size={12} />
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
            {youTubeLinkAnalysisData && (
        <div className="p-4 sm:p-5 bg-gradient-to-br from-[color-mix(in_srgb,var(--background)_97%,var(--foreground)_3%)] to-[color-mix(in_srgb,var(--background)_99%,var(--foreground)_1%)] backdrop-blur-xl rounded-xl border border-[color-mix(in_srgb,var(--foreground)_7%,transparent)] shadow-sm">
          <div 
            className="flex items-center justify-between w-full mb-4 cursor-pointer"
            onClick={() => setYouTubeLinkAnalysisExpanded(!youTubeLinkAnalysisExpanded)}
          >
            <div className="flex items-center gap-2.5">
              <YouTubeLogo className="h-4 w-4 text-[var(--foreground)]" strokeWidth={1.5} />
              <h2 className="font-medium text-left tracking-tight">YouTube Analysis</h2>
            </div>
            <div className="flex items-center gap-2">
              <div className="rounded-full p-1 hover:bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] transition-colors">
                {youTubeLinkAnalysisExpanded ? 
                  <ChevronUp size={16} className="text-[color-mix(in_srgb,var(--foreground)_50%,transparent)]" /> : 
                  <ChevronDown size={16} className="text-[color-mix(in_srgb,var(--foreground)_50%,transparent)]" />
                }
              </div>
            </div>
          </div>
          {youTubeLinkAnalysisExpanded && (
            <div className="space-y-6">
              {youTubeLinkAnalysisData.analysisResults.map((result, index) => (
                <div key={index} className="space-y-4">
                  {result.error ? (
                    <div className="flex items-center gap-2 text-red-500 text-sm">
                      <AlertTriangle size={16} />
                      <span>Error: {result.error}</span>
                    </div>
                  ) : (
                    <>
                      <div className="rounded-lg overflow-hidden shadow-sm border border-[color-mix(in_srgb,var(--foreground)_7%,transparent)]">
                        <YouTubeVideo 
                          videoId={result.videoId} 
                          video={{
                            title: result.details?.title,
                            description: result.details?.description,
                            publishDate: result.details?.publishedTime,
                            viewCount: result.details?.views,
                            duration: result.details?.duration ? `${Math.floor(result.details.duration / 60)}:${(result.details.duration % 60).toString().padStart(2, '0')}` : undefined,
                            channelName: result.channel?.name
                          }} 
                        />
                      </div>
                      
                      {result.transcript && (
                        <div className="text-sm mt-4">
                          <div className="font-medium mb-2">Transcript ({result.transcript.language}):</div>
                          <div className="max-h-60 overflow-y-auto p-3 rounded-md bg-[color-mix(in_srgb,var(--foreground)_3%,transparent)] text-[color-mix(in_srgb,var(--foreground)_80%,transparent)]">
                            {result.transcript.segments.map((segment, i) => (
                              <div key={i} className="mb-2">
                                <span className="inline-block w-12 text-[color-mix(in_srgb,var(--foreground)_60%,transparent)]">[{segment.timestamp}]</span>
                                <span>{segment.text}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {result.transcriptError && (
                        <div className="text-sm text-red-500 mt-2">
                          Transcript error: {result.transcriptError}
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {wolframAlphaData && (
        <WolframAlphaResults data={wolframAlphaData} />
      )}

      {/* Image viewer modal - portal to body to avoid z-index issues */}
      {isMounted && selectedImageIndex >= 0 && imageGeneratorData?.generatedImages && createPortal(
        <div 
          className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center" 
          onClick={() => setSelectedImageIndex(-1)}
        >
          {/* Close button */}
          <button 
            className="absolute top-4 right-4 bg-black/40 hover:bg-black/60 p-2 rounded-full text-white transition-colors"
            onClick={closeImageViewer}
            aria-label="Close image viewer"
          >
            <X size={24} />
          </button>
          
          {/* Main image container */}
          <div 
            className="relative flex items-center justify-center bg-transparent rounded-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            style={{ width: '90vw', height: '90vh' }}
          >
            <div 
              className="relative group cursor-pointer flex flex-col items-center"
            >
              <div className="relative">
                {/* Use a variable to simplify code */}
                {(() => {
                  const selectedImage = imageGeneratorData.generatedImages[selectedImageIndex];
                  return (
                    <ImageWithLoading
                      src={selectedImage.imageUrl}
                      alt={selectedImage.prompt || "Generated image"}
                      className="rounded-md shadow-xl"
                      style={{ 
                        maxWidth: '100%', 
                        maxHeight: '75vh', 
                        objectFit: 'contain',
                        width: 'auto',
                        height: 'auto'
                      }}
                      referrerPolicy="no-referrer"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Toggle prompt visibility on click
                        const promptElement = document.querySelector('.prompt-overlay');
                        if (promptElement) {
                          promptElement.classList.toggle('opacity-0');
                          promptElement.classList.toggle('opacity-100');
                        }
                      }}
                    />
                  );
                })()}
                
                {/* Download button */}
                <button
                  className="absolute bottom-4 right-4 bg-black/40 hover:bg-black/60 p-2 rounded-full text-white transition-colors z-20"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Download image by first fetching it as a blob
                    const imageUrl = imageGeneratorData.generatedImages[selectedImageIndex].imageUrl;
                    
                    fetch(imageUrl)
                      .then(response => response.blob())
                      .then(blob => {
                        // Create an object URL from the blob
                        const blobUrl = URL.createObjectURL(blob);
                        
                        // Create and trigger download
                        const link = document.createElement('a');
                        link.href = blobUrl;
                        link.download = `image-${Date.now()}.jpg`;
                        document.body.appendChild(link);
                        link.click();
                        
                        // Clean up
                        setTimeout(() => {
                          document.body.removeChild(link);
                          URL.revokeObjectURL(blobUrl);
                        }, 100);
                      })
                      .catch(error => {
                        console.error('Download failed:', error);
                      });
                  }}
                  aria-label="Download image"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                </button>
                
                {/* Image caption overlay - hidden by default, shown on hover or click */}
                {(() => {
                  const selectedImage = imageGeneratorData.generatedImages[selectedImageIndex];
                  return selectedImage.prompt && (
                    <div className="prompt-overlay absolute inset-0 bg-black/60 backdrop-blur-sm text-white rounded-md p-4 flex flex-col justify-center items-center text-center opacity-0 transition-opacity duration-300 group-hover:opacity-100 overflow-auto pointer-events-none">
                      <p className="text-base md:text-lg">{selectedImage.prompt}</p>
                      {selectedImage.model && (
                        <p className="text-xs text-gray-300 mt-3">Model: {selectedImage.model}</p>
                      )}
                    </div>
                  );
                })()}
              </div>
              
              {/* Instruction text below the image (not overlaying) */}
              <div className="text-center text-white text-xs mt-4 z-10">
                Click for prompt
              </div>
            </div>
          </div>
          
          {/* Navigation buttons */}
          {imageGeneratorData.generatedImages.length > 1 && (
            <>
              <button 
                className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 p-3 rounded-full text-white transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  navigateImage('prev');
                }}
                aria-label="Previous image"
              >
                <ChevronLeft size={24} />
              </button>
              <button 
                className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 p-3 rounded-full text-white transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  navigateImage('next');
                }}
                aria-label="Next image"
              >
                <ChevronRight size={24} />
              </button>
            </>
          )}
        </div>,
        document.body
      )}
    </div>
  );
} 