import React, { useState, useMemo, useEffect, memo, useRef } from 'react';
import MultiSearch from './MultiSearch';
import MathCalculation from './MathCalculation';
import LinkReader from './LinkReader';
import { ChevronUp, ChevronDown, Brain, Link2, Image as ImageIcon, AlertTriangle, X, ChevronLeft, ChevronRight, ExternalLink, Search, Calculator, BookOpen, FileSearch, Youtube, Database, Video } from 'lucide-react';
import { createPortal } from 'react-dom';
import { Tweet } from 'react-tweet';
import { XLogo, YouTubeLogo } from './CanvasFolder/CanvasLogo';
import { YouTubeVideo, ImageWithLoading } from './CanvasFolder/toolComponent';

type CanvasProps = {
  webSearchData: {
    result: any;
    args: any;
    annotations: any[];
    results: any[];
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
    rawContent?: {
      url: string;
      title: string;
      content: string;
      contentType: string;
      contentLength: number;
      timestamp: string;
    }[];
  } | null;
  imageGeneratorData?: {
    generatedImages: {
      imageUrl: string;
      prompt: string;
      model?: string;
      timestamp?: string;
    }[];
  } | null;
  geminiImageData?: {
    generatedImages: {
      imageUrl: string;
      prompt: string;
      timestamp: string;
      originalImageUrl?: string;
      isEdit?: boolean;
    }[];
  } | null;
  seedreamImageData?: {
    generatedImages: {
      imageUrl: string;
      prompt: string;
      timestamp: string;
      originalImageUrl?: string;
      isEdit?: boolean;
      size?: string;
      aspectRatio?: string;
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
  googleSearchData?: {
    result: any;
    args: any;
    annotations: any[];
    results: any[];
  } | null;
  isCompact?: boolean;
  selectedTool?: string;
  onSearchFilterChange?: (hasActiveFilters: boolean, selectedTopics?: string[], isAllQueriesSelected?: boolean, userHasInteracted?: boolean) => void;
};

/**
 * Canvas Component - An integrated container to display multiple tool results
 * Currently shows web search, math calculation, and link reader results, but can easily be extended to other tools in the future
 */
export default function Canvas({ 
  webSearchData, 
  mathCalculationData, 
  linkReaderData, 
  imageGeneratorData, 
  geminiImageData,
  seedreamImageData,

  xSearchData,
  youTubeSearchData, 
  youTubeLinkAnalysisData,
  googleSearchData,
  isCompact = false,
  selectedTool,
  onSearchFilterChange,
}: CanvasProps) {
  // Merge Web Search and Google Search data for unified display
  const mergedSearchData = useMemo(() => {
    if (!webSearchData && !googleSearchData) return null;
    
    // Combine results from both web search and google search
    const allResults: any[] = [];
    const allArgs: any[] = [];
    const allAnnotations: any[] = [];
    let mergedImageMap: { [key: string]: string } = {};
    let mergedLinkMap: { [key: string]: string } = {};
    let mergedThumbnailMap: { [key: string]: string } = {};
    
    // Add Web Search data
    if (webSearchData) {
      if (webSearchData.results) {
        allResults.push(...webSearchData.results);
      }
      if (webSearchData.args) {
        allArgs.push(webSearchData.args);
      }
      if (webSearchData.annotations) {
        allAnnotations.push(...webSearchData.annotations);
      }
      if ((webSearchData as any).imageMap) {
        mergedImageMap = { ...mergedImageMap, ...(webSearchData as any).imageMap };
      }
    }
    
    // Add Google Search data
    if (googleSearchData) {
      if (googleSearchData.results) {
        allResults.push(...googleSearchData.results);
      }
      if (googleSearchData.args) {
        allArgs.push(googleSearchData.args);
      }
      if (googleSearchData.annotations) {
        allAnnotations.push(...googleSearchData.annotations);
      }
      if ((googleSearchData as any).imageMap) {
        mergedImageMap = { ...mergedImageMap, ...(googleSearchData as any).imageMap };
      }
      if ((googleSearchData as any).linkMap) {
        mergedLinkMap = { ...mergedLinkMap, ...(googleSearchData as any).linkMap };
      }
      if ((googleSearchData as any).thumbnailMap) {
        mergedThumbnailMap = { ...mergedThumbnailMap, ...(googleSearchData as any).thumbnailMap };
      }
    }
    
    if (allResults.length === 0 && allArgs.length === 0) return null;
    
    return {
      result: null, // For backward compatibility
      results: allResults,
      args: allArgs.length > 0 ? allArgs[0] : null, // Use first args for compatibility
      annotations: allAnnotations,
      imageMap: mergedImageMap,
      linkMap: mergedLinkMap,
      thumbnailMap: mergedThumbnailMap
    };
  }, [webSearchData, googleSearchData]);

  // Don't render if there's no data to display
  if (!mergedSearchData && !mathCalculationData && !linkReaderData && !imageGeneratorData && !geminiImageData && !seedreamImageData && !xSearchData && !youTubeSearchData && !youTubeLinkAnalysisData) return null;

  // Simplified state management - all sections are initially open
  // Only track if data is in "generation complete" state
  const [webSearchExpanded, setWebSearchExpanded] = useState(true);
  const [mathCalcExpanded, setMathCalcExpanded] = useState(true);
  const [linkReaderExpanded, setLinkReaderExpanded] = useState(true);
  const [imageGenExpanded, setImageGenExpanded] = useState(true);
  const [seedreamExpanded, setSeedreamExpanded] = useState(true);

  const [xSearchExpanded, setXSearchExpanded] = useState(true);
  const [youTubeSearchExpanded, setYouTubeSearchExpanded] = useState(true);
  const [youTubeLinkAnalysisExpanded, setYouTubeLinkAnalysisExpanded] = useState(true);
  
  // References for content elements
  const webSearchContentRef = useRef<HTMLDivElement>(null);
  const mathCalcContentRef = useRef<HTMLDivElement>(null);
  const linkReaderContentRef = useRef<HTMLDivElement>(null);
  const imageGenContentRef = useRef<HTMLDivElement>(null);
  const seedreamContentRef = useRef<HTMLDivElement>(null);

  const xSearchContentRef = useRef<HTMLDivElement>(null);
  const youTubeSearchContentRef = useRef<HTMLDivElement>(null);
  const youTubeLinkAnalysisContentRef = useRef<HTMLDivElement>(null);
  
  // Simplified height handling - using fixed large height for open sections
  const [isMounted, setIsMounted] = useState(false);

  // Check if we're in browser environment for portal rendering
  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);
  
  // Simplified togglers - only close completed sections, always open if clicked
  const toggleWebSearch = () => setWebSearchExpanded(!webSearchExpanded);
  const toggleMathCalc = () => setMathCalcExpanded(!mathCalcExpanded);
  const toggleLinkReader = () => setLinkReaderExpanded(!linkReaderExpanded);
  const toggleImageGen = () => setImageGenExpanded(!imageGenExpanded);
  const toggleSeedreamImages = () => setSeedreamExpanded(!seedreamExpanded);

  const toggleXSearch = () => setXSearchExpanded(!xSearchExpanded);
  const toggleYouTubeSearch = () => setYouTubeSearchExpanded(!youTubeSearchExpanded);
  const toggleYouTubeLinkAnalysis = () => setYouTubeLinkAnalysisExpanded(!youTubeLinkAnalysisExpanded);
  
  // State for image viewer modal
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(-1);
  
  // Mobile detection and UI state
  const [isMobile, setIsMobile] = useState(false);
  const [showMobileUI, setShowMobileUI] = useState(false);
  
  // Mobile swipe state
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);

  // Mobile detection
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 640); // sm breakpoint
    };
    
    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);
    return () => window.removeEventListener('resize', checkIfMobile);
  }, []);

  // Mobile touch handlers
  const handleMobileTouch = () => {
    if (isMobile) {
      setShowMobileUI(prev => !prev);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isMobile) return;
    
    const touch = e.touches[0];
    setTouchStart({ x: touch.clientX, y: touch.clientY });
    setTouchEnd(null);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isMobile) return;
    
    const touch = e.touches[0];
    setTouchEnd({ x: touch.clientX, y: touch.clientY });
  };

  const handleTouchEnd = () => {
    if (!isMobile || !touchStart || !touchEnd) {
      // If no proper touch sequence, just toggle UI
      if (isMobile) {
        handleMobileTouch();
      }
      return;
    }
    
    const deltaX = touchEnd.x - touchStart.x;
    const deltaY = touchEnd.y - touchStart.y;
    const minSwipeDistance = 50;
    
    // Check if it's a swipe
    const isSwipe = Math.abs(deltaX) > minSwipeDistance || Math.abs(deltaY) > minSwipeDistance;
    
    const allImages = [
      ...(imageGeneratorData?.generatedImages || []),
      ...(geminiImageData?.generatedImages || [])
    ];
    
    if (isSwipe && allImages.length > 1) {
      // Process swipe navigation
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        // Horizontal swipe
        if (deltaX > 0) {
          navigateImage('prev');
        } else {
          navigateImage('next');
        }
      } else {
        // Vertical swipe
        if (deltaY > 0) {
          navigateImage('prev');
        } else {
          navigateImage('next');
        }
      }
    } else {
      // Not a swipe or no gallery - toggle UI
      handleMobileTouch();
    }
    
    setTouchStart(null);
    setTouchEnd(null);
  };

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
  }, [selectedImageIndex, imageGeneratorData, geminiImageData]);

  // Image viewer functions
  const openImageViewer = (index: number) => {
    setSelectedImageIndex(index);
    setShowMobileUI(false); // Reset mobile UI visibility
  };
  
  const closeImageViewer = () => {
    setSelectedImageIndex(-1);
    setShowMobileUI(false); // Reset mobile UI visibility
  };
  
  const navigateImage = (direction: 'prev' | 'next') => {
    const allImages = [
      ...(imageGeneratorData?.generatedImages || []),
      ...(geminiImageData?.generatedImages || [])
    ];
    
    if (allImages.length === 0) return;
    
    const count = allImages.length;
    const newIndex = direction === 'next' 
      ? (selectedImageIndex + 1) % count 
      : (selectedImageIndex - 1 + count) % count;
    
    setSelectedImageIndex(newIndex);
  };

  // Helper function to determine if data is still being generated
  const isGenerating = (data: any) => {
    if (!data) return false;
    return data.isGenerating === true || data.isProgress === true;
  };

  // 컴팩트 모드일 때 적용할 추가 클래스
  const compactModeClasses = isCompact ? 'my-2 space-y-2' : 'my-4 space-y-4';
  
  // 컴팩트 모드에서 컨텐츠 최대 높이 설정 (메시지 내에서 너무 길어지지 않도록)
  const maxContentHeight = isCompact ? '300px' : '5000px';
  const headerClasses = isCompact ? 'mb-2' : 'mb-4';

  return (
    <div className={`tool-results-canvas ${compactModeClasses}`}>
      {/* Unified Search Results (Web Search + Google Search) */}
           {(!selectedTool || selectedTool.startsWith?.('web-search') || selectedTool === 'google-search' || selectedTool.startsWith?.('google-search:topic:') || selectedTool === 'google-images' || selectedTool === 'google-videos') && mergedSearchData && (
        <div className="">
          {!selectedTool && (
          <div 
            className={`flex items-center justify-between w-full ${headerClasses} cursor-pointer`}
            onClick={toggleWebSearch}
          >
            <div className="flex items-center gap-2.5">
              {(() => {
                     // Check if this is specifically Google Images or Google Videos from selectedTool
                     if (selectedTool === 'google-images' || selectedTool === 'google-search:topic:google_images') {
                       return (
                         <>
                           <ImageIcon className="h-4 w-4 text-[var(--foreground)]" strokeWidth={1.5} />
                           <h2 className="font-medium text-left tracking-tight">Google Images</h2>
                         </>
                       );
                     }
                     
                     if (selectedTool === 'google-videos' || selectedTool === 'google-search:topic:google_videos') {
                       return (
                         <>
                           <Video className="h-4 w-4 text-[var(--foreground)]" strokeWidth={1.5} />
                           <h2 className="font-medium text-left tracking-tight">Google Videos</h2>
                         </>
                       );
                     }
                
                     // Check if this is primarily Google Images or Google Videos search from data
                     const allSearches = (mergedSearchData.results || []).flatMap((r: any) => r.searches || []);
                     const hasGoogleImages = allSearches.some((s: any) => s?.topic === 'google_images' || s?.engine === 'google_images');
                     const hasGoogleVideos = allSearches.some((s: any) => s?.topic === 'google_videos' || s?.engine === 'google_videos');
                     const hasOnlyGoogleImages = allSearches.every((s: any) => s?.topic === 'google_images' || s?.engine === 'google_images');
                     const hasOnlyGoogleVideos = allSearches.every((s: any) => s?.topic === 'google_videos' || s?.engine === 'google_videos');
                
                     if (hasOnlyGoogleImages && hasGoogleImages) {
                       return (
                         <>
                           <ImageIcon className="h-4 w-4 text-[var(--foreground)]" strokeWidth={1.5} />
                           <h2 className="font-medium text-left tracking-tight">Google Images</h2>
                         </>
                       );
                     } else if (hasOnlyGoogleVideos && hasGoogleVideos) {
                       return (
                         <>
                           <Video className="h-4 w-4 text-[var(--foreground)]" strokeWidth={1.5} />
                           <h2 className="font-medium text-left tracking-tight">Google Videos</h2>
                         </>
                       );
                     } else if (hasGoogleImages || hasGoogleVideos) {
                  return (
                    <>
                      <Search className="h-4 w-4 text-[var(--foreground)]" strokeWidth={1.5} />
                      <h2 className="font-medium text-left tracking-tight">Searches</h2>
                    </>
                  );
                } else {
                  return (
                    <>
                      <Search className="h-4 w-4 text-[var(--foreground)]" strokeWidth={1.5} />
                      <h2 className="font-medium text-left tracking-tight">Searches</h2>
                    </>
                  );
                }
              })()}
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
          )}
          <div 
            className={selectedTool ? '' : 'overflow-hidden transition-all duration-200 ease-in-out'}
            style={selectedTool ? {} : { 
              maxHeight: webSearchExpanded ? maxContentHeight : '0px',
            }}
          >
            <div
              ref={webSearchContentRef}
              className={selectedTool ? '' : 'transition-opacity duration-200 ease-in-out'}
              style={selectedTool ? {} : {
                opacity: webSearchExpanded ? 1 : 0,
                scrollbarWidth: 'none',
                msOverflowStyle: 'none'
              }}
            >
              <style jsx>{`
                div::-webkit-scrollbar {
                  display: none;
                }
              `}</style>
              <MultiSearch 
                result={mergedSearchData.result} 
                args={mergedSearchData.args}
                annotations={mergedSearchData.annotations}
                results={mergedSearchData.results}
                onFilterChange={onSearchFilterChange}
                {...(() => {
                  // Handle both web-search and google-search topic filtering
                  if (selectedTool && (selectedTool.startsWith?.('web-search:topic:') || selectedTool.startsWith?.('google-search:topic:'))) {
                    const topic = selectedTool.split(':').pop();
                    // Count unique topics present in mergedSearchData
                    const allSearches = (mergedSearchData.results || []).flatMap((r: any) => r.searches || []);
                    const uniqueTopics = new Set(allSearches.map((s: any) => s?.topic || 'general'));
                    if (uniqueTopics.size === 1) {
                      return { highlightedQueries: [], initialAllSelected: true };
                    }
                    // Otherwise, highlight queries for the selected topic
                    const searches = allSearches.filter((s: any) => (s as any).topic === topic);
                    
                    // Only include queries from the relevant search type based on topic
                    let relevantQueries: string[] = [];
                    
                    if (topic === 'google' || topic === 'google_images' || topic === 'google_videos') {
                      // For google search topics, get queries from actual search results filtered by topic
                      // This ensures we only get queries that match the specific topic (google vs google_images)
                      relevantQueries = searches.map((s: any) => s.query).filter(Boolean);
                    } else {
                      // For web search topics (general, company, etc.), only include web search queries
                      relevantQueries = (webSearchData?.args?.queries || []) as string[];
                    }
                    
                    return { highlightedQueries: relevantQueries, initialAllSelected: false };
                  }
                  return { highlightedQueries: [], initialAllSelected: false };
                })()}
              />
            </div>
          </div>
        </div>
      )}
      
      {/* Math Calculation Results */}
      {(!selectedTool || selectedTool === 'calculator') && mathCalculationData && (
        <div className="">
          {!selectedTool && (
          <div 
            className={`flex items-center justify-between w-full ${headerClasses} cursor-pointer`}
            onClick={toggleMathCalc}
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
          )}
          <div 
            className={selectedTool ? '' : 'overflow-hidden transition-all duration-200 ease-in-out'}
            style={selectedTool ? {} : { 
              maxHeight: mathCalcExpanded ? maxContentHeight : '0px',
            }}
          >
            <div
              ref={mathCalcContentRef}
              className={selectedTool ? '' : 'transition-opacity duration-200 ease-in-out'}
              style={selectedTool ? {} : {
                opacity: mathCalcExpanded ? 1 : 0,
                scrollbarWidth: 'none',
                msOverflowStyle: 'none'
              }}
            >
              <style jsx>{`
                div::-webkit-scrollbar {
                  display: none;
                }
              `}</style>
              <MathCalculation
                calculationSteps={mathCalculationData.calculationSteps}
              />
            </div>
          </div>
        </div>
      )}
      
      {/* Link Reader Results */}
      {(!selectedTool || selectedTool === 'link-reader') && linkReaderData && (
        <div className="">
          {!selectedTool && (
          <div 
            className={`flex items-center justify-between w-full ${headerClasses} cursor-pointer`}
            onClick={toggleLinkReader}
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
          )}
          <div 
            className={selectedTool ? '' : 'overflow-hidden transition-all duration-200 ease-in-out'}
            style={selectedTool ? {} : { 
              maxHeight: linkReaderExpanded ? maxContentHeight : '0px',
            }}
          >
            <div
              ref={linkReaderContentRef}
              className={selectedTool ? '' : 'transition-opacity duration-200 ease-in-out'}
              style={selectedTool ? {} : {
                opacity: linkReaderExpanded ? 1 : 0,
                scrollbarWidth: 'none',
                msOverflowStyle: 'none'
              }}
            >
              <style jsx>{`
                div::-webkit-scrollbar {
                  display: none;
                }
              `}</style>
              <LinkReader
                linkAttempts={linkReaderData.linkAttempts}
                rawContent={linkReaderData.rawContent}
              />
            </div>
          </div>
        </div>
      )}

      {/* Image Generator Results */}
      {(!selectedTool || selectedTool === 'image-generator') && imageGeneratorData && imageGeneratorData.generatedImages.length > 0 && (
        <div className="">
          {!selectedTool && (
          <div 
            className={`flex items-center justify-between w-full ${headerClasses} cursor-pointer`}
            onClick={toggleImageGen}
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
          )}
          <div 
            className={selectedTool ? '' : 'overflow-hidden transition-all duration-200 ease-in-out'}
            style={selectedTool ? {} : { 
              maxHeight: imageGenExpanded ? maxContentHeight : '0px',
            }}
          >
            <div
              ref={imageGenContentRef}
              className={selectedTool ? 'p-1' : 'transition-opacity duration-200 ease-in-out p-1'}
              style={selectedTool ? {} : {
                opacity: imageGenExpanded ? 1 : 0,
                scrollbarWidth: 'none',
                msOverflowStyle: 'none'
              }}
            >
              <style jsx>{`
                div::-webkit-scrollbar {
                  display: none;
                }
              `}</style>
              <div className={`grid gap-5 ${
                imageGeneratorData.generatedImages.length === 1 
                  ? 'grid-cols-1' 
                  : 'grid-cols-1 sm:grid-cols-2'
              }`}>
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
          </div>
        </div>
      )}
      

      
      {/* YouTube Search Results */}
      {(!selectedTool || selectedTool === 'youtube-search') && youTubeSearchData && (
        <div className="">
          {!selectedTool && (
          <div 
            className={`flex items-center justify-between w-full ${headerClasses} cursor-pointer`}
            onClick={toggleYouTubeSearch}
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
          )}
          <div 
            className={selectedTool ? '' : 'overflow-hidden transition-all duration-200 ease-in-out'}
            style={selectedTool ? {} : { 
              maxHeight: youTubeSearchExpanded ? maxContentHeight : '0px',
            }}
          >
            <div
              ref={youTubeSearchContentRef}
              className={selectedTool ? 'space-y-6' : 'transition-opacity duration-200 ease-in-out space-y-6'}
              style={selectedTool ? {} : {
                opacity: youTubeSearchExpanded ? 1 : 0,
                scrollbarWidth: 'none',
                msOverflowStyle: 'none'
              }}
            >
              <style jsx>{`
                div::-webkit-scrollbar {
                  display: none;
                }
              `}</style>
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
          </div>
        </div>
      )}

      {/* YouTube Link Analysis Results */}
      {(!selectedTool || selectedTool === 'youtube-analyzer') && youTubeLinkAnalysisData && (
        <div className="">
          {!selectedTool && (
          <div 
            className={`flex items-center justify-between w-full ${headerClasses} cursor-pointer`}
            onClick={toggleYouTubeLinkAnalysis}
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
          )}
          <div 
            className={selectedTool ? '' : 'overflow-hidden transition-all duration-200 ease-in-out'}
            style={selectedTool ? {} : { 
              maxHeight: youTubeLinkAnalysisExpanded ? maxContentHeight : '0px',
            }}
          >
            <div
              ref={youTubeLinkAnalysisContentRef}
              className={selectedTool ? 'space-y-6' : 'transition-opacity duration-200 ease-in-out space-y-6'}
              style={selectedTool ? {} : {
                opacity: youTubeLinkAnalysisExpanded ? 1 : 0,
                scrollbarWidth: 'none',
                msOverflowStyle: 'none'
              }}
            >
              <style jsx>{`
                div::-webkit-scrollbar {
                  display: none;
                }
              `}</style>
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
          </div>
        </div>
      )}

      {/* Gemini Image Results */}
      {(!selectedTool || selectedTool === 'gemini-image') && geminiImageData && geminiImageData.generatedImages && geminiImageData.generatedImages.length > 0 && (
        <div className="">
          {!selectedTool && (
          <div 
            className={`flex items-center justify-between w-full ${headerClasses} cursor-pointer`}
            onClick={toggleImageGen}
          >
            <div className="flex items-center gap-2.5">
              <ImageIcon className="h-4 w-4 text-[var(--foreground)]" strokeWidth={1.5} />
              <h2 className="font-medium text-left tracking-tight">Gemini Images</h2>
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
          )}
          <div 
            className={selectedTool ? '' : 'overflow-hidden transition-all duration-200 ease-in-out'}
            style={selectedTool ? {} : { 
              maxHeight: imageGenExpanded ? maxContentHeight : '0px',
            }}
          >
            <div
              ref={imageGenContentRef}
              className={selectedTool ? 'p-1' : 'transition-opacity duration-200 ease-in-out p-1'}
              style={selectedTool ? {} : {
                opacity: imageGenExpanded ? 1 : 0,
                scrollbarWidth: 'none',
                msOverflowStyle: 'none'
              }}
            >
              <style jsx>{`
                div::-webkit-scrollbar {
                  display: none;
                }
              `}</style>
              <div className={`grid gap-5 ${
                geminiImageData.generatedImages.length === 1 
                  ? 'grid-cols-1' 
                  : 'grid-cols-1 sm:grid-cols-2'
              }`}>
                {geminiImageData.generatedImages.map((image, index) => (
                  <div 
                    key={index} 
                    className="border border-[color-mix(in_srgb,var(--foreground)_7%,transparent)] rounded-xl overflow-hidden shadow-sm hover:shadow-md hover:scale-[1.02] hover:border-[color-mix(in_srgb,var(--foreground)_10%,transparent)] transition-all duration-200 cursor-pointer bg-[color-mix(in_srgb,var(--foreground)_2%,transparent)] hover:bg-[color-mix(in_srgb,var(--foreground)_3%,transparent)]"
                    onClick={() => openImageViewer(index)}
                  >
                    <div className="relative">
                      <ImageWithLoading
                        src={image.imageUrl}
                        alt={image.prompt}
                        className="w-full h-auto object-cover"
                        style={{ aspectRatio: '1/1' }}
                      />
                      {image.isEdit && image.originalImageUrl && (
                        <div className="absolute top-2 left-2 bg-blue-500/80 text-white text-xs px-2 py-1 rounded-full">
                          Edited
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <p className="text-sm text-[color-mix(in_srgb,var(--foreground)_70%,transparent)] line-clamp-2">
                        {image.prompt}
                      </p>
                      <div className="mt-2 text-xs text-[color-mix(in_srgb,var(--foreground)_50%,transparent)]">
                        {new Date(image.timestamp).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Seedream 4.0 Results */}
      {(!selectedTool || selectedTool === 'seedream-image') && seedreamImageData && 
        seedreamImageData.generatedImages && seedreamImageData.generatedImages.length > 0 && (
        <div className="">
          {!selectedTool && (
            <div 
              className={`flex items-center justify-between w-full ${headerClasses} cursor-pointer`}
              onClick={toggleSeedreamImages}
            >
              <div className="flex items-center gap-2.5">
                <ImageIcon className="h-4 w-4 text-[var(--foreground)]" strokeWidth={1.5} />
                <h2 className="font-medium text-left tracking-tight">Seedream 4.0</h2>
              </div>
              <div className="flex items-center gap-2">
                <div className="rounded-full p-1 hover:bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] transition-colors">
                  {seedreamExpanded ? 
                    <ChevronUp size={16} className="text-[color-mix(in_srgb,var(--foreground)_50%,transparent)]" /> : 
                    <ChevronDown size={16} className="text-[color-mix(in_srgb,var(--foreground)_50%,transparent)]" />
                  }
                </div>
              </div>
            </div>
          )}
          <div 
            className={selectedTool ? '' : 'overflow-hidden transition-all duration-200 ease-in-out'}
            style={selectedTool ? {} : { 
              maxHeight: seedreamExpanded ? maxContentHeight : '0px',
            }}
          >
            <div
              ref={seedreamContentRef}
              className={selectedTool ? 'p-1' : 'transition-opacity duration-200 ease-in-out p-1'}
              style={selectedTool ? {} : {
                opacity: seedreamExpanded ? 1 : 0,
                scrollbarWidth: 'none',
                msOverflowStyle: 'none'
              }}
            >
              <style jsx>{`
                div::-webkit-scrollbar {
                  display: none;
                }
              `}</style>
              <div className={`grid gap-5 ${
                seedreamImageData.generatedImages.length === 1 
                  ? 'grid-cols-1' 
                  : 'grid-cols-1 sm:grid-cols-2'
              }`}>
                {seedreamImageData.generatedImages.map((image, index) => {
                  // Calculate global index for image viewer
                  const globalIndex = (imageGeneratorData?.generatedImages?.length || 0) + 
                                    (geminiImageData?.generatedImages?.length || 0) + 
                                    index;
                  return (
                  <div 
                    key={index} 
                    className="border border-[color-mix(in_srgb,var(--foreground)_7%,transparent)] rounded-xl overflow-hidden shadow-sm hover:shadow-md hover:scale-[1.02] hover:border-[color-mix(in_srgb,var(--foreground)_10%,transparent)] transition-all duration-200 cursor-pointer bg-[color-mix(in_srgb,var(--foreground)_2%,transparent)] hover:bg-[color-mix(in_srgb,var(--foreground)_3%,transparent)]"
                    onClick={() => openImageViewer(globalIndex)}
                  >
                    <div className="relative">
                      <ImageWithLoading
                        src={image.imageUrl}
                        alt={image.prompt}
                        className="w-full h-auto object-cover"
                        style={{ aspectRatio: '1/1' }}
                      />
                      {image.isEdit && image.originalImageUrl && (
                        <div className="absolute top-2 left-2 bg-blue-500/80 text-white text-xs px-2 py-1 rounded-full">
                          Edited
                        </div>
                      )}
                      {image.size && (
                        <div className="absolute top-2 right-2 bg-green-500/80 text-white text-xs px-2 py-1 rounded-full">
                          {image.size}
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <p className="text-sm text-[color-mix(in_srgb,var(--foreground)_70%,transparent)] line-clamp-2">
                        {image.prompt}
                      </p>
                      <div className="mt-2 text-xs text-[color-mix(in_srgb,var(--foreground)_50%,transparent)]">
                        {new Date(image.timestamp).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image viewer modal - portal to body to avoid z-index issues */}
      {isMounted && selectedImageIndex >= 0 && (imageGeneratorData?.generatedImages || geminiImageData?.generatedImages || seedreamImageData?.generatedImages) && createPortal(
        <div 
          className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center" 
          onClick={() => setSelectedImageIndex(-1)}
        >
          {/* Close button */}
          <button 
            className="absolute top-4 right-4 bg-black/40 hover:bg-black/60 p-2 rounded-full text-white transition-colors z-10"
            onClick={closeImageViewer}
            aria-label="Close image viewer"
            style={{ display: (!isMobile || showMobileUI) ? 'block' : 'none' }}
          >
            <X size={24} />
          </button>
          
          {/* Main image container */}
          <div 
            className="relative flex items-center justify-center bg-transparent rounded-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{ 
              width: '100vw', 
              height: '100vh' 
            }}
          >
            <div 
              className="relative group cursor-pointer flex flex-col items-center"
            >
              <div className="relative">
                {/* Use a variable to simplify code */}
                {(() => {
                  const allImages = [
                    ...(imageGeneratorData?.generatedImages || []),
                    ...(geminiImageData?.generatedImages || []),
                    ...(seedreamImageData?.generatedImages || [])
                  ];
                  const selectedImage = allImages[selectedImageIndex];
                  return (
                    <ImageWithLoading
                      src={selectedImage.imageUrl}
                      alt={selectedImage.prompt || "Generated image"}
                      className="rounded-md shadow-xl"
                      style={{ 
                        maxWidth: '100%', 
                        maxHeight: '100vh', 
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
                
                
                {/* Image caption overlay - hidden by default, shown only on click */}
                {(() => {
                  const allImages = [
                    ...(imageGeneratorData?.generatedImages || []),
                    ...(geminiImageData?.generatedImages || []),
                    ...(seedreamImageData?.generatedImages || [])
                  ];
                  const selectedImage = allImages[selectedImageIndex];
                  return selectedImage.prompt && (
                    <div className="prompt-overlay absolute inset-0 bg-black/75 backdrop-blur-md text-white rounded-md p-6 flex flex-col justify-center items-center text-center opacity-0 transition-opacity duration-300 overflow-auto pointer-events-none">
                      <p className="text-base md:text-lg font-medium">{selectedImage.prompt}</p>
                      {'model' in selectedImage && selectedImage.model && (
                        <p className="text-xs text-gray-300 mt-3">Model: {selectedImage.model}</p>
                      )}
                    </div>
                  );
                })()}
              </div>
              
              {/* Instruction text below the image (not overlaying) */}
              <div className="text-center text-white text-sm mt-4 z-10 bg-black/30 py-2 px-4 rounded-md flex items-center gap-2 justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="16" x2="12" y2="12"></line>
                  <line x1="12" y1="8" x2="12.01" y2="8"></line>
                </svg>
                Click image to view prompt
              </div>
            </div>
          </div>
          
          {/* Navigation buttons - hidden on mobile */}
          {(() => {
            const allImages = [
              ...(imageGeneratorData?.generatedImages || []),
              ...(geminiImageData?.generatedImages || []),
              ...(seedreamImageData?.generatedImages || [])
            ];
            return allImages.length > 1 && !isMobile;
          })() && (
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