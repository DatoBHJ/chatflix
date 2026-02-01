import React, { useState, useMemo, useEffect, memo, useRef, useCallback } from 'react';
import MultiSearch from './MultiSearch';
import MathCalculation from './MathCalculation';
import LinkReader from './LinkReader';
import { ChevronUp, ChevronDown, Brain, Link2, Image as ImageIcon, AlertTriangle, X, ChevronLeft, ChevronRight, ExternalLink, Search, Calculator, BookOpen, FileSearch, Youtube, Database, Video, Loader2, Share, ScrollText, Info, Check, Copy, Bookmark, Download } from 'lucide-react';
import { getAdaptiveGlassStyleBlur, getIconClassName } from '@/app/lib/adaptiveGlassStyle';
import { createPortal } from 'react-dom';
import { Tweet } from 'react-tweet';
import { SiGoogle } from 'react-icons/si';
import { XLogo, YouTubeLogo, WanAiLogo, SeedreamLogo } from './CanvasFolder/CanvasLogo';
import { YouTubeVideo, VideoWithRefresh } from './CanvasFolder/toolComponent';
import { DirectVideoEmbed } from './MarkdownContent';
import { ImageGalleryStack } from './ImageGalleryStack';
import { VideoGalleryStack } from './VideoGalleryStack';
import type { LinkMetaEntry } from '@/app/types/linkPreview';
import { useUrlRefresh } from '../hooks/useUrlRefresh';
import { ImageModal, type ImageModalImage } from './ImageModal';

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
      partIndex?: number;
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
      partIndex?: number;
    }[];
  } | null;
  qwenImageData?: {
    generatedImages: {
      imageUrl: string;
      prompt: string;
      timestamp: string;
      originalImageUrl?: string;
      isEdit?: boolean;
      aspectRatio?: string;
      partIndex?: number;
    }[];
  } | null;
  wan25VideoData?: {
    generatedVideos: {
      videoUrl: string;
      prompt: string;
      timestamp: string;
      resolution?: string;
      size?: string;
      duration?: number;
      isImageToVideo?: boolean;
      sourceImageUrl?: string;
      path?: string;
    }[];
    status?: 'processing' | 'completed' | 'error';
    startedCount?: number;
    pendingCount?: number;
    pendingPrompts?: string[];
    pendingSourceImages?: string[];
    errorCount?: number;
  } | null;

  twitterSearchData?: {
    result: any;
    args: any;
    annotations: any[];
    results: any[];
    imageMap?: Record<string, string>;
    linkMap?: Record<string, string>;
    thumbnailMap?: Record<string, string>;
    linkMetaMap?: Record<string, any>;
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
  selectedItem?: string;
  onSearchFilterChange?: (hasActiveFilters: boolean, selectedTopics?: string[], isAllQueriesSelected?: boolean, userHasInteracted?: boolean) => void;
  messageId?: string;
  chatId?: string;
  userId?: string;
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
  qwenImageData,
  wan25VideoData,
  twitterSearchData, 
  youTubeSearchData, 
  youTubeLinkAnalysisData,
  googleSearchData,
  isCompact = false,
  selectedTool,
  selectedItem,
  onSearchFilterChange,
  messageId,
  chatId,
  userId,
}: CanvasProps) {
  // Helper function to get aspect ratio from size string
  const getAspectRatioFromSize = (size?: string): string => {
    if (!size) return '16/9';
    const [width, height] = size.split('*').map(Number);
    if (!width || !height) return '16/9';
    return `${width}/${height}`;
  };

  // Track detected aspect ratios for videos without size parameter
  const [detectedAspectRatios, setDetectedAspectRatios] = useState<Record<number, string>>({});
  // Merge Web Search and Google Search data for unified display
  const mergedSearchData = useMemo(() => {
    const sources = [webSearchData, googleSearchData, twitterSearchData].filter(Boolean);
    if (sources.length === 0) {
      return null;
    }
  
    const allResults: any[] = [];
    const allArgs: any[] = [];
    const allAnnotations: any[] = [];
    let mergedImageMap: Record<string, string> = {};
    let mergedLinkMap: Record<string, string> = {};
    let mergedThumbnailMap: Record<string, string> = {};
    let mergedLinkMetaMap: Record<string, LinkMetaEntry> = {};
  
    sources.forEach((source) => {
      if (!source) return;
      
      if (source.results) {
        allResults.push(...source.results);
      }
      if (source.args) {
        allArgs.push(source.args);
      }
      if (source.annotations) {
        allAnnotations.push(...source.annotations);
      }
      if ((source as any).imageMap) {
        mergedImageMap = { ...mergedImageMap, ...(source as any).imageMap };
      }
      if ((source as any).linkMap) {
        mergedLinkMap = { ...mergedLinkMap, ...(source as any).linkMap };
      }
      if ((source as any).thumbnailMap) {
        mergedThumbnailMap = { ...mergedThumbnailMap, ...(source as any).thumbnailMap };
      }
      if ((source as any).linkMetaMap) {
        mergedLinkMetaMap = { ...mergedLinkMetaMap, ...(source as any).linkMetaMap };
      }
    });
  
    if (allResults.length === 0 && allArgs.length === 0) {
      return null;
    }
  
    const finalData = {
      result: null,
      results: allResults,
      args: allArgs.length > 0 ? allArgs[0] : null,
      annotations: allAnnotations,
      imageMap: mergedImageMap,
      linkMap: mergedLinkMap,
      thumbnailMap: mergedThumbnailMap,
      linkMetaMap: mergedLinkMetaMap
    };
    
    return finalData;
  }, [webSearchData, googleSearchData, twitterSearchData]);

  // Simplified state management - all sections are initially open
  // Only track if data is in "generation complete" state
  const [webSearchExpanded, setWebSearchExpanded] = useState(true);
  const [mathCalcExpanded, setMathCalcExpanded] = useState(true);
  const [linkReaderExpanded, setLinkReaderExpanded] = useState(true);
  const [imageGenExpanded, setImageGenExpanded] = useState(true);
  const [seedreamExpanded, setSeedreamExpanded] = useState(true);
  const [qwenExpanded, setQwenExpanded] = useState(true);
  const [wan25Expanded, setWan25Expanded] = useState(true);

  const [youTubeSearchExpanded, setYouTubeSearchExpanded] = useState(true);
  const [youTubeLinkAnalysisExpanded, setYouTubeLinkAnalysisExpanded] = useState(true);
  
  // References for content elements
  const webSearchContentRef = useRef<HTMLDivElement>(null);
  const mathCalcContentRef = useRef<HTMLDivElement>(null);
  const linkReaderContentRef = useRef<HTMLDivElement>(null);
  const imageGenContentRef = useRef<HTMLDivElement>(null);
  const seedreamContentRef = useRef<HTMLDivElement>(null);
  const qwenContentRef = useRef<HTMLDivElement>(null);

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
  const toggleQwenImages = () => setQwenExpanded(!qwenExpanded);
  const toggleWan25Video = () => setWan25Expanded(!wan25Expanded);

  const toggleYouTubeSearch = () => setYouTubeSearchExpanded(!youTubeSearchExpanded);
  const toggleYouTubeLinkAnalysis = () => setYouTubeLinkAnalysisExpanded(!youTubeLinkAnalysisExpanded);
  
  // State for image viewer modal
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(-1);
  const [selectedSourceImageUrl, setSelectedSourceImageUrl] = useState<string | null>(null);
  
  // Save to gallery state
  const [savingImages, setSavingImages] = useState<Set<string>>(new Set());
  const [savedImages, setSavedImages] = useState<Set<string>>(new Set());
  
  // Mobile detection and UI state
  const [isMobile, setIsMobile] = useState(false);
  
  // Mobile swipe state (for Mermaid modal)
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);

  // Image-to-video pending: aspect ratio per index (measured on img load)
  const [pendingImageAspectRatios, setPendingImageAspectRatios] = useState<Record<number, number>>({});

  // Mobile detection
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 640); // sm breakpoint
    };
    
    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);
    return () => window.removeEventListener('resize', checkIfMobile);
  }, []);

  // Mobile touch handlers (for Mermaid modal)

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

  // Touch handlers는 ImageModal 내부에서 처리

  // Keyboard navigation은 ImageModal 내부에서 처리

  // Image viewer functions
  const openImageViewer = (index: number) => {
    setSelectedImageIndex(index);
    setSelectedSourceImageUrl(null); // 소스 이미지 상태 초기화
  };
  
  const closeImageViewer = () => {
    setSelectedImageIndex(-1);
    setSelectedSourceImageUrl(null);
  };


  const saveImageToGallery = async (imageUrl: string) => {
    setSavingImages(prev => new Set(prev).add(imageUrl));
    try {
      const response = await fetch('/api/photo/save-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl })
      });
      if (response.ok) {
        setSavedImages(prev => new Set(prev).add(imageUrl));
      } else {
        const error = await response.json();
        console.error('Save failed:', error);
      }
    } catch (error) {
      console.error('Save error:', error);
    } finally {
      setSavingImages(prev => {
        const next = new Set(prev);
        next.delete(imageUrl);
        return next;
      });
    }
  };

  // Helper function to determine if data is still being generated
  const isGenerating = (data: any) => {
    if (!data) return false;
    return data.isGenerating === true || data.isProgress === true;
  };

  const sortImagesByOrder = useCallback((images: any[]) => {
    return images
      .map((image, index) => ({ image, index }))
      .sort((a, b) => {
        const orderA = a.image.partIndex ?? a.image.contentIndex ?? (a.image.timestamp ? new Date(a.image.timestamp).getTime() : Number.POSITIVE_INFINITY);
        const orderB = b.image.partIndex ?? b.image.contentIndex ?? (b.image.timestamp ? new Date(b.image.timestamp).getTime() : Number.POSITIVE_INFINITY);
        if (orderA !== orderB) return orderA - orderB;
        return a.index - b.index;
      })
      .map(({ image }) => image);
  }, []);

  const orderedImageGeneratorImages = useMemo(
    () => sortImagesByOrder(imageGeneratorData?.generatedImages || []),
    [imageGeneratorData?.generatedImages, sortImagesByOrder]
  );
  const orderedGeminiImages = useMemo(
    () => sortImagesByOrder(geminiImageData?.generatedImages || []),
    [geminiImageData?.generatedImages, sortImagesByOrder]
  );
  const orderedSeedreamImages = useMemo(
    () => sortImagesByOrder(seedreamImageData?.generatedImages || []),
    [seedreamImageData?.generatedImages, sortImagesByOrder]
  );
  const orderedQwenImages = useMemo(
    () => sortImagesByOrder(qwenImageData?.generatedImages || []),
    [qwenImageData?.generatedImages, sortImagesByOrder]
  );
  const orderedAllImages = useMemo(
    () => [...orderedImageGeneratorImages, ...orderedGeminiImages, ...orderedSeedreamImages, ...orderedQwenImages],
    [orderedImageGeneratorImages, orderedGeminiImages, orderedSeedreamImages, orderedQwenImages]
  );
  
  // 이미지를 ImageModalImage 형식으로 변환
  const galleryImages: ImageModalImage[] = useMemo(() => {
    return orderedAllImages.map(img => ({
      src: img.imageUrl,
      alt: img.prompt || 'Generated image',
      prompt: img.prompt,
      sourceImageUrl: img.originalImageUrl
    }));
  }, [orderedAllImages]);
  
  // 현재 이미지 정보
  const currentImage = useMemo(() => {
    return selectedImageIndex >= 0 && selectedImageIndex < orderedAllImages.length 
      ? orderedAllImages[selectedImageIndex] 
      : null;
  }, [selectedImageIndex, orderedAllImages]);


  // Prompt handlers는 ImageModal 내부에서 처리
  const currentPrompt = useMemo(() => {
    if (selectedImageIndex < 0 || !currentImage) return undefined;
    return currentImage.prompt;
  }, [selectedImageIndex, currentImage]);
  
  // 저장 핸들러 (Set 기반). ImageModal에서 { imageUrl, prompt?, sourceImageUrl?, originalSrc? } 페이로드로 호출.
  const handleSave = useCallback(async (payload: { imageUrl: string; prompt?: string | null; sourceImageUrl?: string | null; originalSrc?: string }) => {
    const imageUrl = payload.imageUrl;
    const setKey = payload.originalSrc ?? imageUrl;
    if (savingImages.has(setKey) || savedImages.has(setKey)) return;
    setSavingImages(prev => new Set(prev).add(setKey));
    try {
      const imageToSave = orderedAllImages.find(img => img.imageUrl === (payload.originalSrc ?? imageUrl));
      const promptToSave = payload.prompt ?? imageToSave?.prompt ?? currentPrompt;
      const sourceImageUrl = payload.sourceImageUrl ?? imageToSave?.originalImageUrl;

      const response = await fetch('/api/photo/save-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl,
          prompt: promptToSave || null,
          ai_prompt: null,
          ai_json_prompt: null,
          chatId: chatId || null,
          messageId: messageId || null,
          metadata: { sourceImageUrl: sourceImageUrl || null }
        })
      });
      if (response.ok) {
        setSavedImages(prev => new Set(prev).add(setKey));
      } else {
        const error = await response.json();
        console.error('Save failed:', error);
      }
    } catch (error) {
      console.error('Save error:', error);
    } finally {
      setSavingImages(prev => {
        const next = new Set(prev);
        next.delete(setKey);
        return next;
      });
    }
  }, [savingImages, savedImages, orderedAllImages, currentPrompt, chatId, messageId]);
  
  const navigateImage = (direction: 'prev' | 'next') => {
    if (orderedAllImages.length === 0) return;
    
    const count = orderedAllImages.length;
    const newIndex = direction === 'next' 
      ? (selectedImageIndex + 1) % count 
      : (selectedImageIndex - 1 + count) % count;
    
    setSelectedImageIndex(newIndex);
  };

  // Don't render if there's no data to display
  const shouldRender = !!(mergedSearchData || mathCalculationData || linkReaderData || imageGeneratorData || geminiImageData || seedreamImageData || qwenImageData || wan25VideoData || youTubeSearchData || youTubeLinkAnalysisData);
  
  if (!shouldRender) {
    return null;
  }

  // 컴팩트 모드일 때 적용할 추가 클래스
  const compactModeClasses = isCompact ? 'my-2 space-y-2' : 'my-4 space-y-4';
  
  // 컴팩트 모드에서 컨텐츠 최대 높이 설정 (메시지 내에서 너무 길어지지 않도록)
  const maxContentHeight = isCompact ? '300px' : '5000px';
  const headerClasses = isCompact ? 'mb-2' : 'mb-4';

  return (
    <div className={`tool-results-canvas ${compactModeClasses}`}>
      <style>{`
        @keyframes shimmer {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }
      `}</style>
      {/* Unified Search Results (Web Search + Google Search + Twitter Search) */}
           {(!selectedTool || selectedTool.startsWith?.('web-search') || selectedTool === 'google-search' || selectedTool.startsWith?.('google-search:topic:') || selectedTool === 'google-images' || selectedTool === 'google-videos' || selectedTool === 'twitter_search') && mergedSearchData && (
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
                           <ImageIcon className="h-4 w-4 text-(--foreground)" strokeWidth={1.5} />
                           <h2 className="font-medium text-left tracking-tight">Google Images</h2>
                         </>
                       );
                     }
                     
                     if (selectedTool === 'google-videos' || selectedTool === 'google-search:topic:google_videos') {
                       return (
                         <>
                           <Video className="h-4 w-4 text-(--foreground)" strokeWidth={1.5} />
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
                           <ImageIcon className="h-4 w-4 text-(--foreground)" strokeWidth={1.5} />
                           <h2 className="font-medium text-left tracking-tight">Google Images</h2>
                         </>
                       );
                     } else if (hasOnlyGoogleVideos && hasGoogleVideos) {
                       return (
                         <>
                           <Video className="h-4 w-4 text-(--foreground)" strokeWidth={1.5} />
                           <h2 className="font-medium text-left tracking-tight">Google Videos</h2>
                         </>
                       );
                     } else if (hasGoogleImages || hasGoogleVideos) {
                  return (
                    <>
                      <Search className="h-4 w-4 text-(--foreground)" strokeWidth={1.5} />
                      <h2 className="font-medium text-left tracking-tight">Searches</h2>
                    </>
                  );
                } else {
                  return (
                    <>
                      <Search className="h-4 w-4 text-(--foreground)" strokeWidth={1.5} />
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
                linkMetaMap={mergedSearchData.linkMetaMap}
                onFilterChange={onSearchFilterChange}
                {...(() => {
                  // If selectedItem is provided, highlight only that specific query
                  if (selectedItem && selectedTool && (selectedTool.startsWith?.('web-search') || selectedTool.startsWith?.('google-search') || selectedTool === 'twitter_search' || selectedTool === 'google-search')) {
                    return { highlightedQueries: [selectedItem], initialAllSelected: false };
                  }
                  
                  // Handle both web-search and google-search topic filtering
                  if (selectedTool && (selectedTool.startsWith?.('web-search:topic:') || selectedTool.startsWith?.('google-search:topic:'))) {
                    const topic = selectedTool.split(':').pop();
                    // Gather all search entries across web & google data
                    const allSearches = (mergedSearchData.results || []).flatMap((r: any) => r.searches || []);
                    const uniqueTopics = new Set(
                      allSearches
                        .map((s: any) => s?.topic)
                        .filter(Boolean)
                    );
                    if (uniqueTopics.size === 1) {
                      return { highlightedQueries: [], initialAllSelected: true };
                    }

                    // Highlight only queries belonging to the selected topic
                    const searches = allSearches.filter((s: any) => (s as any).topic === topic);
                    const dedupeQueries = (items: any[]) =>
                      Array.from(
                        new Set(
                          items
                            .map((s: any) => s?.query)
                            .filter(Boolean)
                        )
                      );

                    let relevantQueries: string[] = [];

                    if (topic === 'google' || topic === 'google_images' || topic === 'google_videos') {
                      // For Google search topics, use queries from topic-specific results (already filtered above)
                      relevantQueries = dedupeQueries(searches);
                    } else {
                      // For web search topics (GitHub, research paper, etc.), use topic-specific queries
                      relevantQueries = dedupeQueries(searches);
                    }

                    return { highlightedQueries: relevantQueries, initialAllSelected: false };
              } else if (selectedTool === 'twitter_search') {
                const allSearches = (mergedSearchData.results || []).flatMap((r: any) => r.searches || []);
                const dedupeQueries = (items: any[]) =>
                  Array.from(
                    new Set(
                      items
                        .map((s: any) => s?.query)
                        .filter(Boolean)
                    )
                  );
                const twitterQueries = dedupeQueries(
                  allSearches.filter((s: any) => (s as any).topic === 'twitter')
                );
                return { highlightedQueries: twitterQueries, initialAllSelected: twitterQueries.length === 0 };
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
              <Calculator className="h-4 w-4 text-(--foreground)" strokeWidth={1.5} />
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
                selectedExpression={selectedTool === 'calculator' && selectedItem ? selectedItem : undefined}
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
              <Link2 className="h-4 w-4 text-(--foreground)" strokeWidth={1.5} />
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
                selectedUrl={selectedTool === 'link-reader' && selectedItem ? selectedItem : undefined}
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
              <ImageIcon className="h-4 w-4 text-(--foreground)" strokeWidth={1.5} />
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
              {orderedImageGeneratorImages.length > 0 && (
                <ImageGalleryStack
                  images={orderedImageGeneratorImages.map((image) => ({
                    src: image.imageUrl,
                    alt: image.prompt || 'Generated image',
                    prompt: image.prompt
                  }))}
                  onSingleImageClick={(src, alt, allImages, index) => {
                    openImageViewer(index);
                  }}
                  isMobile={isMobile}
                  chatId={chatId}
                  messageId={messageId}
                />
              )}
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
              <YouTubeLogo className="h-4 w-4 text-(--foreground)" strokeWidth={1.5} />
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
              {/* Loading state when processing */}
              {(((youTubeSearchData as any).status === 'processing' || (youTubeSearchData as any).pendingCount > 0) && 
                (!youTubeSearchData.youtubeResults || youTubeSearchData.youtubeResults.length === 0)) && (
                <div className="space-y-4">
                  <div className="border border-[color-mix(in_srgb,var(--foreground)_7%,transparent)] rounded-xl overflow-hidden shadow-sm bg-[color-mix(in_srgb,var(--foreground)_2%,transparent)] relative min-h-[300px]">
                    {/* Background placeholder */}
                    <div className="absolute inset-0 bg-linear-to-br from-[color-mix(in_srgb,var(--foreground)_5%,transparent)] via-[color-mix(in_srgb,var(--foreground)_3%,transparent)] to-[color-mix(in_srgb,var(--foreground)_5%,transparent)]" />
                    
                    {/* Loading overlay */}
                    <div className="prompt-overlay absolute inset-0 bg-black/75 backdrop-blur-md text-white p-6 flex flex-col justify-center items-center text-center opacity-100 transition-opacity duration-300 overflow-auto pointer-events-none z-20">
                      <div 
                        className="text-base md:text-lg font-medium"
                        style={{
                          background: 'linear-gradient(90deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.9) 25%, rgba(255,255,255,0.3) 50%, rgba(255,255,255,0.9) 75%, rgba(255,255,255,0.3) 100%)',
                          backgroundSize: '200% 100%',
                          backgroundClip: 'text',
                          WebkitBackgroundClip: 'text',
                          color: 'transparent',
                          animation: 'shimmer-text-strong 1.5s ease-in-out infinite'
                        }}
                      >
                        Searching YouTube videos...
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {/* Results display */}
              {youTubeSearchData.youtubeResults && youTubeSearchData.youtubeResults.length > 0 && (
                youTubeSearchData.youtubeResults.map((searchResult, index) => (
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
                              <div className="w-full [&>div]:w-full [&>div]:mx-auto rounded-lg overflow-hidden [&_a]:text-[color-mix(in_srgb,var(--foreground)_75%,transparent)]! [&_a:hover]:text-[color-mix(in_srgb,var(--foreground)_90%,transparent)]! [&_.react-tweet-theme]:bg-[color-mix(in_srgb,var(--background)_97%,var(--foreground)_3%)]! dark:[&_.react-tweet-theme]:bg-[color-mix(in_srgb,var(--background)_97%,var(--foreground)_3%)]! [&_.react-tweet-border]:border-[color-mix(in_srgb,var(--foreground)_5%,transparent)]! [&_hr]:border-[color-mix(in_srgb,var(--foreground)_5%,transparent)]! [&_div[data-separator]]:border-[color-mix(in_srgb,var(--foreground)_5%,transparent)]! [&_.react-tweet-header-border]:border-[color-mix(in_srgb,var(--foreground)_5%,transparent)]! [&_.react-tweet-footer-border]:border-[color-mix(in_srgb,var(--foreground)_5%,transparent)]! **:border-[color-mix(in_srgb,var(--foreground)_5%,transparent)]!">
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
                ))
              )}
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
              <YouTubeLogo className="h-4 w-4 text-(--foreground)" strokeWidth={1.5} />
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
              {/* Loading state when processing */}
              {(((youTubeLinkAnalysisData as any).status === 'processing' || (youTubeLinkAnalysisData as any).pendingCount > 0) && 
                (!youTubeLinkAnalysisData.analysisResults || youTubeLinkAnalysisData.analysisResults.length === 0)) && (
                <div className="space-y-4">
                  <div className="border border-[color-mix(in_srgb,var(--foreground)_7%,transparent)] rounded-xl overflow-hidden shadow-sm bg-[color-mix(in_srgb,var(--foreground)_2%,transparent)] relative min-h-[300px]">
                    {/* Background placeholder */}
                    <div className="absolute inset-0 bg-linear-to-br from-[color-mix(in_srgb,var(--foreground)_5%,transparent)] via-[color-mix(in_srgb,var(--foreground)_3%,transparent)] to-[color-mix(in_srgb,var(--foreground)_5%,transparent)]" />
                    
                    {/* Loading overlay */}
                    <div className="prompt-overlay absolute inset-0 bg-black/75 backdrop-blur-md text-white p-6 flex flex-col justify-center items-center text-center opacity-100 transition-opacity duration-300 overflow-auto pointer-events-none z-20">
                      <div 
                        className="text-base md:text-lg font-medium"
                        style={{
                          background: 'linear-gradient(90deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.9) 25%, rgba(255,255,255,0.3) 50%, rgba(255,255,255,0.9) 75%, rgba(255,255,255,0.3) 100%)',
                          backgroundSize: '200% 100%',
                          backgroundClip: 'text',
                          WebkitBackgroundClip: 'text',
                          color: 'transparent',
                          animation: 'shimmer-text-strong 1.5s ease-in-out infinite'
                        }}
                      >
                        Analyzing YouTube video...
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {/* Results display */}
              {youTubeLinkAnalysisData.analysisResults && youTubeLinkAnalysisData.analysisResults.length > 0 && (
                youTubeLinkAnalysisData.analysisResults.map((result, index) => (
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
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Gemini Image Results */}
      {(!selectedTool || selectedTool === 'gemini-image') && geminiImageData && (
        <div className="">
          {!selectedTool && (
          <div 
            className={`flex items-center justify-between w-full ${headerClasses} cursor-pointer`}
            onClick={toggleImageGen}
          >
            <div className="flex items-center gap-2.5">
                <SiGoogle className="h-4 w-4 text-(--foreground)" />
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
              {/* Render completed images with ImageGalleryStack */}
              {orderedGeminiImages.length > 0 && (
                <ImageGalleryStack
                  images={orderedGeminiImages.map((image) => ({
                    src: image.imageUrl,
                    alt: image.prompt || 'Generated image',
                    prompt: image.prompt,
                    sourceImageUrl: image.originalImageUrl
                  }))}
                  onSingleImageClick={(src, alt, allImages, index) => {
                    const globalIndex = orderedImageGeneratorImages.length + index;
                    openImageViewer(globalIndex);
                  }}
                  isMobile={isMobile}
                  chatId={chatId}
                  messageId={messageId}
                />
              )}
              {/* Render placeholders for pending images */}
              {(geminiImageData as any).pendingCount > 0 && ((geminiImageData as any).pendingItems?.length > 0 || (geminiImageData as any).pendingPrompts?.length > 0) && (
                <div className={`grid gap-5 ${orderedGeminiImages.length > 0 ? 'mt-5' : ''} ${
                  ((geminiImageData as any).startedCount || geminiImageData.generatedImages?.length || 0) === 1 
                    ? 'grid-cols-1' 
                    : 'grid-cols-1 sm:grid-cols-2'
                }`}>
                  {/* 🔥 pendingItems가 있으면 사용 (인덱스 기반 매칭), 없으면 pendingPrompts 사용 (레거시) */}
                  {((geminiImageData as any).pendingItems?.length > 0 || (geminiImageData as any).pendingPrompts?.length > 0) ? (
                    ((geminiImageData as any).pendingItems || (geminiImageData as any).pendingPrompts?.map((p: string, i: number) => ({ prompt: p, index: i }))).map((pendingItem: any, idx: number) => {
                    const prompt = pendingItem.prompt || pendingItem;
                    const itemIndex = pendingItem.index ?? idx;
                    
                    // 🔥 인덱스 기반 매칭으로 변경 (프롬프트 매칭 대신)
                    const failedImages = (geminiImageData as any).failedImages || [];
                    // 인덱스로 먼저 매칭, 없으면 프롬프트로 폴백
                    const failedImage = failedImages.find((f: any) => f.index === itemIndex) || 
                                       failedImages.find((f: any) => f.prompt === prompt && !failedImages.some((ff: any) => ff.index !== undefined));
                    const isFailed = !!failedImage;
                    
                    // Check if this is an edit operation
                    // 🔥 pendingItem에서 editImageUrl 직접 가져오기 (있으면), 없으면 레거시 배열에서
                    const pendingEditImageUrls = (geminiImageData as any).pendingEditImageUrls || [];
                    const editImageUrl = pendingItem.editImageUrl || pendingEditImageUrls[itemIndex];
                    const isEditMode = !!editImageUrl;
                    
                    // Get the original image URL (should be resolved URL from server)
                    let originalImageUrl: string | undefined;
                    if (isEditMode && editImageUrl) {
                      // editImageUrl should now be the resolved URL from server
                      if (typeof editImageUrl === 'string' && (editImageUrl.startsWith('http://') || editImageUrl.startsWith('https://'))) {
                        // Direct URL (resolved from server)
                        originalImageUrl = editImageUrl;
                      } else if (Array.isArray(editImageUrl) && editImageUrl.length > 0) {
                        // Array of URLs - use first one
                        const firstUrl = editImageUrl[0];
                        if (typeof firstUrl === 'string' && (firstUrl.startsWith('http://') || firstUrl.startsWith('https://'))) {
                          originalImageUrl = firstUrl;
                        }
                      } else if (typeof editImageUrl === 'string' && editImageUrl.startsWith('generated_image_')) {
                        // Fallback: if still a reference, try to resolve from generated images
                        const allGeneratedImages = [
                          ...(imageGeneratorData?.generatedImages || []),
                          ...(geminiImageData?.generatedImages || []),
                          ...(seedreamImageData?.generatedImages || [])
                        ];
                        const imageIndex = parseInt(editImageUrl.replace('generated_image_', '')) - 1;
                        if (allGeneratedImages[imageIndex]) {
                          originalImageUrl = allGeneratedImages[imageIndex].imageUrl;
                        }
                      }
                    }
                    
                    return (
                      <div 
                        key={`pending-${idx}`}
                        className={`border border-[color-mix(in_srgb,var(--foreground)_7%,transparent)] rounded-xl ${isEditMode && originalImageUrl && !isFailed ? 'overflow-visible' : 'overflow-hidden'} shadow-sm bg-[color-mix(in_srgb,var(--foreground)_2%,transparent)] relative ${isEditMode && originalImageUrl && !isFailed ? '' : 'min-h-[400px]'}`}
                      >
                        {isFailed ? (
                          // Failed image UI - minimal
                          <>
                            {/* Background placeholder with subtle red tint */}
                            <div className="absolute inset-0 bg-linear-to-br from-[color-mix(in_srgb,var(--foreground)_5%,transparent)] via-red-500/5 to-[color-mix(in_srgb,var(--foreground)_5%,transparent)]" />
                            
                            {/* Minimal error overlay */}
                            <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none z-20">
                              <div className="flex flex-col items-center gap-2 text-red-500">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                <p className="text-xs font-medium truncate max-w-full">
                                  Failed
                                </p>
                              </div>
                            </div>
                          </>
                        ) : (
                          <>
                            {/* Original image background (if editing) */}
                            {isEditMode && originalImageUrl ? (
                              <div className="relative w-full">
                                <img
                                  src={originalImageUrl}
                                  alt="Original image"
                                  className="w-full h-auto block"
                                  style={{ maxWidth: '100%', display: 'block' }}
                                />
                                {/* Prompt overlay - same style as image viewer */}
                                <div className="prompt-overlay absolute inset-0 bg-black/75 backdrop-blur-md text-white p-6 flex flex-col justify-center items-center text-center opacity-100 transition-opacity duration-300 overflow-auto pointer-events-none z-20">
                                  <p 
                                    className="text-base md:text-lg font-medium"
                                    style={{
                                      background: 'linear-gradient(90deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.9) 25%, rgba(255,255,255,0.3) 50%, rgba(255,255,255,0.9) 75%, rgba(255,255,255,0.3) 100%)',
                                      backgroundSize: '200% 100%',
                                      backgroundClip: 'text',
                                      WebkitBackgroundClip: 'text',
                                      color: 'transparent',
                                      animation: 'shimmer-text-strong 1.5s ease-in-out infinite'
                                    }}
                                  >
                                    {prompt}
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <>
                                {/* Background placeholder (if not editing) */}
                                <div className="absolute inset-0 bg-linear-to-br from-[color-mix(in_srgb,var(--foreground)_5%,transparent)] via-[color-mix(in_srgb,var(--foreground)_3%,transparent)] to-[color-mix(in_srgb,var(--foreground)_5%,transparent)]" />
                                
                                {/* Prompt overlay */}
                                <div className="prompt-overlay absolute inset-0 bg-black/75 backdrop-blur-md text-white p-6 flex flex-col justify-center items-center text-center opacity-100 transition-opacity duration-300 overflow-auto pointer-events-none z-20">
                                  <p 
                                    className="text-base md:text-lg font-medium"
                                    style={{
                                      background: 'linear-gradient(90deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.9) 25%, rgba(255,255,255,0.3) 50%, rgba(255,255,255,0.9) 75%, rgba(255,255,255,0.3) 100%)',
                                      backgroundSize: '200% 100%',
                                      backgroundClip: 'text',
                                      WebkitBackgroundClip: 'text',
                                      color: 'transparent',
                                      animation: 'shimmer-text-strong 1.5s ease-in-out infinite'
                                    }}
                                  >
                                    {prompt}
                                  </p>
                                </div>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })
                ) : (
                  // Fallback to skeleton if prompts not available
                  (geminiImageData as any).pendingCount > 0 && Array.from({ length: (geminiImageData as any).pendingCount }).map((_, index) => (
                    <div 
                      key={`pending-${index}`}
                      className="border border-[color-mix(in_srgb,var(--foreground)_7%,transparent)] rounded-xl overflow-hidden shadow-sm bg-[color-mix(in_srgb,var(--foreground)_2%,transparent)] relative min-h-[400px]"
                    >
                      {/* Background placeholder */}
                      <div className="absolute inset-0 bg-linear-to-br from-[color-mix(in_srgb,var(--foreground)_5%,transparent)] via-[color-mix(in_srgb,var(--foreground)_3%,transparent)] to-[color-mix(in_srgb,var(--foreground)_5%,transparent)]" />
                      
                      {/* Prompt overlay */}
                      <div className="prompt-overlay absolute inset-0 bg-black/75 backdrop-blur-md text-white p-6 flex flex-col justify-center items-center text-center opacity-100 transition-opacity duration-300 overflow-auto pointer-events-none z-20">
                        <div 
                          className="text-base md:text-lg font-medium"
                          style={{
                            background: 'linear-gradient(90deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.9) 25%, rgba(255,255,255,0.3) 50%, rgba(255,255,255,0.9) 75%, rgba(255,255,255,0.3) 100%)',
                            backgroundSize: '200% 100%',
                            backgroundClip: 'text',
                            WebkitBackgroundClip: 'text',
                            color: 'transparent',
                            animation: 'shimmer-text-strong 1.5s ease-in-out infinite'
                          }}
                        >
                          Generating image...
                        </div>
                      </div>
                    </div>
                  ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Seedream 4.5 Results */}
      {(!selectedTool || selectedTool === 'seedream-image') && seedreamImageData && (
        <div className="">
          {!selectedTool && (
            <div 
              className={`flex items-center justify-between w-full ${headerClasses} cursor-pointer`}
              onClick={toggleSeedreamImages}
            >
              <div className="flex items-center gap-2.5">
                <SeedreamLogo size={16} className="text-(--foreground)" />
                <h2 className="font-medium text-left tracking-tight">Seedream 4.5</h2>
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
              {/* Render completed images with ImageGalleryStack */}
              {orderedSeedreamImages.length > 0 && (
                <ImageGalleryStack
                  images={orderedSeedreamImages.map((image) => ({
                    src: image.imageUrl,
                    alt: image.prompt || 'Generated image',
                    prompt: image.prompt,
                    sourceImageUrl: image.originalImageUrl
                  }))}
                  onSingleImageClick={(src, alt, allImages, index) => {
                    const globalIndex = orderedImageGeneratorImages.length + orderedGeminiImages.length + index;
                    openImageViewer(globalIndex);
                  }}
                  isMobile={isMobile}
                  chatId={chatId}
                  messageId={messageId}
                />
              )}
              {/* Render placeholders for pending images */}
              {(seedreamImageData as any).pendingCount > 0 && ((seedreamImageData as any).pendingItems?.length > 0 || (seedreamImageData as any).pendingPrompts?.length > 0) && (
                <div className={`grid gap-5 ${orderedSeedreamImages.length > 0 ? 'mt-5' : ''} ${
                  ((seedreamImageData as any).startedCount || seedreamImageData.generatedImages?.length || 0) === 1 
                    ? 'grid-cols-1' 
                    : 'grid-cols-1 sm:grid-cols-2'
                }`}>
                  {/* 🔥 pendingItems가 있으면 사용 (인덱스 기반 매칭), 없으면 pendingPrompts 사용 (레거시) */}
                  {((seedreamImageData as any).pendingItems?.length > 0 || (seedreamImageData as any).pendingPrompts?.length > 0) ? (
                    ((seedreamImageData as any).pendingItems || (seedreamImageData as any).pendingPrompts?.map((p: string, i: number) => ({ prompt: p, index: i }))).map((pendingItem: any, idx: number) => {
                    const prompt = pendingItem.prompt || pendingItem;
                    const itemIndex = pendingItem.index ?? idx;
                    
                    // 🔥 인덱스 기반 매칭으로 변경 (프롬프트 매칭 대신)
                    const failedImages = (seedreamImageData as any).failedImages || [];
                    // 인덱스로 먼저 매칭, 없으면 프롬프트로 폴백
                    const failedImage = failedImages.find((f: any) => f.index === itemIndex) || 
                                       failedImages.find((f: any) => f.prompt === prompt && !failedImages.some((ff: any) => ff.index !== undefined));
                    const isFailed = !!failedImage;
                    
                    // Check if this is an edit operation
                    // 🔥 pendingItem에서 editImageUrl 직접 가져오기 (있으면), 없으면 레거시 배열에서
                    const pendingEditImageUrls = (seedreamImageData as any).pendingEditImageUrls || [];
                    const editImageUrl = pendingItem.editImageUrl || pendingEditImageUrls[itemIndex];
                    const isEditMode = !!editImageUrl;
                    
                    // Get the original image URL (should be resolved URL from server)
                    let originalImageUrl: string | undefined;
                    if (isEditMode && editImageUrl) {
                      // editImageUrl should now be the resolved URL from server
                      if (typeof editImageUrl === 'string' && (editImageUrl.startsWith('http://') || editImageUrl.startsWith('https://'))) {
                        // Direct URL (resolved from server)
                        originalImageUrl = editImageUrl;
                      } else if (Array.isArray(editImageUrl) && editImageUrl.length > 0) {
                        // Array of URLs - use first one
                        const firstUrl = editImageUrl[0];
                        if (typeof firstUrl === 'string' && (firstUrl.startsWith('http://') || firstUrl.startsWith('https://'))) {
                          originalImageUrl = firstUrl;
                        }
                      } else if (typeof editImageUrl === 'string' && editImageUrl.startsWith('generated_image_')) {
                        // Fallback: if still a reference, try to resolve from generated images
                        const allGeneratedImages = [
                          ...(imageGeneratorData?.generatedImages || []),
                          ...(geminiImageData?.generatedImages || []),
                          ...(seedreamImageData?.generatedImages || [])
                        ];
                        const imageIndex = parseInt(editImageUrl.replace('generated_image_', '')) - 1;
                        if (allGeneratedImages[imageIndex]) {
                          originalImageUrl = allGeneratedImages[imageIndex].imageUrl;
                        }
                      }
                    }
                    
                    return (
                      <div 
                        key={`pending-${idx}`}
                        className={`border border-[color-mix(in_srgb,var(--foreground)_7%,transparent)] rounded-xl ${isEditMode && originalImageUrl && !isFailed ? 'overflow-visible' : 'overflow-hidden'} shadow-sm bg-[color-mix(in_srgb,var(--foreground)_2%,transparent)] relative ${isEditMode && originalImageUrl && !isFailed ? '' : 'min-h-[400px]'}`}
                      >
                        {isFailed ? (
                          // Failed image UI - minimal
                          <>
                            {/* Background placeholder with subtle red tint */}
                            <div className="absolute inset-0 bg-linear-to-br from-[color-mix(in_srgb,var(--foreground)_5%,transparent)] via-red-500/5 to-[color-mix(in_srgb,var(--foreground)_5%,transparent)]" />
                            
                            {/* Minimal error overlay */}
                            <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none z-20">
                              <div className="flex flex-col items-center gap-2 text-red-500">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                <p className="text-xs font-medium truncate max-w-full">
                                  Failed
                                </p>
                              </div>
                            </div>
                          </>
                        ) : (
                          <>
                            {/* Original image background (if editing) */}
                            {isEditMode && originalImageUrl ? (
                              <div className="relative w-full">
                                <img
                                  src={originalImageUrl}
                                  alt="Original image"
                                  className="w-full h-auto block"
                                  style={{ maxWidth: '100%', display: 'block' }}
                                />
                                {/* Prompt overlay - same style as image viewer */}
                                <div className="prompt-overlay absolute inset-0 bg-black/75 backdrop-blur-md text-white p-6 flex flex-col justify-center items-center text-center opacity-100 transition-opacity duration-300 overflow-auto pointer-events-none z-20">
                                  <p 
                                    className="text-base md:text-lg font-medium"
                                    style={{
                                      background: 'linear-gradient(90deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.9) 25%, rgba(255,255,255,0.3) 50%, rgba(255,255,255,0.9) 75%, rgba(255,255,255,0.3) 100%)',
                                      backgroundSize: '200% 100%',
                                      backgroundClip: 'text',
                                      WebkitBackgroundClip: 'text',
                                      color: 'transparent',
                                      animation: 'shimmer-text-strong 1.5s ease-in-out infinite'
                                    }}
                                  >
                                    {prompt}
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <>
                                {/* Background placeholder (if not editing) */}
                                <div className="absolute inset-0 bg-linear-to-br from-[color-mix(in_srgb,var(--foreground)_5%,transparent)] via-[color-mix(in_srgb,var(--foreground)_3%,transparent)] to-[color-mix(in_srgb,var(--foreground)_5%,transparent)]" />
                                
                                {/* Prompt overlay */}
                                <div className="prompt-overlay absolute inset-0 bg-black/75 backdrop-blur-md text-white p-6 flex flex-col justify-center items-center text-center opacity-100 transition-opacity duration-300 overflow-auto pointer-events-none z-20">
                                  <p 
                                    className="text-base md:text-lg font-medium"
                                    style={{
                                      background: 'linear-gradient(90deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.9) 25%, rgba(255,255,255,0.3) 50%, rgba(255,255,255,0.9) 75%, rgba(255,255,255,0.3) 100%)',
                                      backgroundSize: '200% 100%',
                                      backgroundClip: 'text',
                                      WebkitBackgroundClip: 'text',
                                      color: 'transparent',
                                      animation: 'shimmer-text-strong 1.5s ease-in-out infinite'
                                    }}
                                  >
                                    {prompt}
                                  </p>
                                </div>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })
                ) : (
                  // Fallback to skeleton if prompts not available
                  (seedreamImageData as any).pendingCount > 0 && Array.from({ length: (seedreamImageData as any).pendingCount }).map((_, index) => (
                    <div 
                      key={`pending-${index}`}
                      className="border border-[color-mix(in_srgb,var(--foreground)_7%,transparent)] rounded-xl overflow-hidden shadow-sm bg-[color-mix(in_srgb,var(--foreground)_2%,transparent)] relative min-h-[400px]"
                    >
                      {/* Background placeholder */}
                      <div className="absolute inset-0 bg-linear-to-br from-[color-mix(in_srgb,var(--foreground)_5%,transparent)] via-[color-mix(in_srgb,var(--foreground)_3%,transparent)] to-[color-mix(in_srgb,var(--foreground)_5%,transparent)]" />
                      
                      {/* Prompt overlay */}
                      <div className="prompt-overlay absolute inset-0 bg-black/75 backdrop-blur-md text-white p-6 flex flex-col justify-center items-center text-center opacity-100 transition-opacity duration-300 overflow-auto pointer-events-none z-20">
                        <div 
                          className="text-base md:text-lg font-medium"
                          style={{
                            background: 'linear-gradient(90deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.9) 25%, rgba(255,255,255,0.3) 50%, rgba(255,255,255,0.9) 75%, rgba(255,255,255,0.3) 100%)',
                            backgroundSize: '200% 100%',
                            backgroundClip: 'text',
                            WebkitBackgroundClip: 'text',
                            color: 'transparent',
                            animation: 'shimmer-text-strong 1.5s ease-in-out infinite'
                          }}
                        >
                          Generating image...
                        </div>
                      </div>
                    </div>
                  ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Qwen Image Edit Results */}
      {(!selectedTool || selectedTool === 'qwen-image') && qwenImageData && (
        <div className="">
          {!selectedTool && (
            <div 
              className={`flex items-center justify-between w-full ${headerClasses} cursor-pointer`}
              onClick={toggleQwenImages}
            >
              <div className="flex items-center gap-2.5">
                <WanAiLogo size={16} className="text-(--foreground)" />
                <h2 className="font-medium text-left tracking-tight">Qwen Image Edit</h2>
              </div>
              <div className="flex items-center gap-2">
                <div className="rounded-full p-1 hover:bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] transition-colors">
                  {qwenExpanded ? 
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
              maxHeight: qwenExpanded ? maxContentHeight : '0px',
            }}
          >
            <div
              ref={qwenContentRef}
              className={selectedTool ? 'p-1' : 'transition-opacity duration-200 ease-in-out p-1'}
              style={selectedTool ? {} : {
                opacity: qwenExpanded ? 1 : 0,
                scrollbarWidth: 'none',
                msOverflowStyle: 'none'
              }}
            >
              <style jsx>{`
                div::-webkit-scrollbar {
                  display: none;
                }
              `}</style>
              {/* Render completed images with ImageGalleryStack */}
              {orderedQwenImages.length > 0 && (
                <ImageGalleryStack
                  images={orderedQwenImages.map((image) => ({
                    src: image.imageUrl,
                    alt: image.prompt || 'Generated image',
                    prompt: image.prompt,
                    sourceImageUrl: image.originalImageUrl
                  }))}
                  onSingleImageClick={(src, alt, allImages, index) => {
                    const globalIndex = orderedImageGeneratorImages.length + orderedGeminiImages.length + orderedSeedreamImages.length + index;
                    openImageViewer(globalIndex);
                  }}
                  isMobile={isMobile}
                  chatId={chatId}
                  messageId={messageId}
                />
              )}
              {/* Render placeholders for pending images */}
              {(qwenImageData as any).pendingCount > 0 && ((qwenImageData as any).pendingItems?.length > 0 || (qwenImageData as any).pendingPrompts?.length > 0) && (
                <div className={`grid gap-5 ${orderedQwenImages.length > 0 ? 'mt-5' : ''} ${
                  ((qwenImageData as any).startedCount || qwenImageData.generatedImages?.length || 0) === 1 
                    ? 'grid-cols-1' 
                    : 'grid-cols-1 sm:grid-cols-2'
                }`}>
                  {((qwenImageData as any).pendingItems?.length > 0 || (qwenImageData as any).pendingPrompts?.length > 0) ? (
                    ((qwenImageData as any).pendingItems || (qwenImageData as any).pendingPrompts?.map((p: string, i: number) => ({ prompt: p, index: i }))).map((pendingItem: any, idx: number) => {
                    const prompt = pendingItem.prompt || pendingItem;
                    const itemIndex = pendingItem.index ?? idx;
                    
                    const failedImages = (qwenImageData as any).failedImages || [];
                    const failedImage = failedImages.find((f: any) => f.index === itemIndex) || 
                                       failedImages.find((f: any) => f.prompt === prompt && !failedImages.some((ff: any) => ff.index !== undefined));
                    const isFailed = !!failedImage;
                    
                    const pendingEditImageUrls = (qwenImageData as any).pendingEditImageUrls || [];
                    const editImageUrl = pendingItem.editImageUrl || pendingEditImageUrls[itemIndex];
                    const isEditMode = !!editImageUrl;
                    
                    let originalImageUrl: string | undefined;
                    if (isEditMode && editImageUrl) {
                      if (typeof editImageUrl === 'string' && (editImageUrl.startsWith('http://') || editImageUrl.startsWith('https://'))) {
                        originalImageUrl = editImageUrl;
                      } else if (Array.isArray(editImageUrl) && editImageUrl.length > 0) {
                        const firstUrl = editImageUrl[0];
                        if (typeof firstUrl === 'string' && (firstUrl.startsWith('http://') || firstUrl.startsWith('https://'))) {
                          originalImageUrl = firstUrl;
                        }
                      }
                    }
                    
                    return (
                      <div 
                        key={`qwen-pending-${idx}`}
                        className={`border border-[color-mix(in_srgb,var(--foreground)_7%,transparent)] rounded-xl ${isEditMode && originalImageUrl && !isFailed ? 'overflow-visible' : 'overflow-hidden'} shadow-sm bg-[color-mix(in_srgb,var(--foreground)_2%,transparent)] relative ${isEditMode && originalImageUrl && !isFailed ? '' : 'min-h-[400px]'}`}
                      >
                        {isFailed ? (
                          <>
                            <div className="absolute inset-0 bg-linear-to-br from-[color-mix(in_srgb,var(--foreground)_5%,transparent)] via-red-500/5 to-[color-mix(in_srgb,var(--foreground)_5%,transparent)]" />
                            <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none z-20">
                              <div className="flex flex-col items-center gap-2 text-red-500">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                <p className="text-xs font-medium truncate max-w-full">Failed</p>
                              </div>
                            </div>
                          </>
                        ) : (
                          <>
                            {isEditMode && originalImageUrl ? (
                              <div className="relative w-full">
                                <img src={originalImageUrl} alt="Original image" className="w-full h-auto block" style={{ maxWidth: '100%', display: 'block' }} />
                                <div className="prompt-overlay absolute inset-0 bg-black/75 backdrop-blur-md text-white p-6 flex flex-col justify-center items-center text-center opacity-100 transition-opacity duration-300 overflow-auto pointer-events-none z-20">
                                  <p 
                                    className="text-base md:text-lg font-medium"
                                    style={{
                                      background: 'linear-gradient(90deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.9) 25%, rgba(255,255,255,0.3) 50%, rgba(255,255,255,0.9) 75%, rgba(255,255,255,0.3) 100%)',
                                      backgroundSize: '200% 100%',
                                      backgroundClip: 'text',
                                      WebkitBackgroundClip: 'text',
                                      color: 'transparent',
                                      animation: 'shimmer-text-strong 1.5s ease-in-out infinite'
                                    }}
                                  >
                                    {prompt}
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="absolute inset-0 bg-linear-to-br from-[color-mix(in_srgb,var(--foreground)_5%,transparent)] via-[color-mix(in_srgb,var(--foreground)_3%,transparent)] to-[color-mix(in_srgb,var(--foreground)_5%,transparent)]" />
                                <div className="prompt-overlay absolute inset-0 bg-black/75 backdrop-blur-md text-white p-6 flex flex-col justify-center items-center text-center opacity-100 transition-opacity duration-300 overflow-auto pointer-events-none z-20">
                                  <p 
                                    className="text-base md:text-lg font-medium"
                                    style={{
                                      background: 'linear-gradient(90deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.9) 25%, rgba(255,255,255,0.3) 50%, rgba(255,255,255,0.9) 75%, rgba(255,255,255,0.3) 100%)',
                                      backgroundSize: '200% 100%',
                                      backgroundClip: 'text',
                                      WebkitBackgroundClip: 'text',
                                      color: 'transparent',
                                      animation: 'shimmer-text-strong 1.5s ease-in-out infinite'
                                    }}
                                  >
                                    {prompt}
                                  </p>
                                </div>
                              </>
                            )}
                            <div className="absolute top-3 right-3 z-30">
                              <div className="bg-black/40 backdrop-blur-md rounded-full p-1.5 border border-white/10 shadow-lg">
                                <Loader2 className="w-4 h-4 text-white animate-spin" />
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })
                ) : (
                  (qwenImageData as any).pendingCount > 0 && Array.from({ length: (qwenImageData as any).pendingCount }).map((_, index) => (
                    <div 
                      key={`qwen-skeleton-${index}`}
                      className="border border-[color-mix(in_srgb,var(--foreground)_7%,transparent)] rounded-xl overflow-hidden shadow-sm bg-[color-mix(in_srgb,var(--foreground)_2%,transparent)] min-h-[400px]"
                    >
                      <div className="w-full h-full relative overflow-hidden">
                        <div 
                          className="absolute inset-0 bg-linear-to-r from-transparent via-white/10 to-transparent"
                          style={{
                            backgroundSize: '200% 100%',
                            animation: 'shimmer 2s ease-in-out infinite'
                          }}
                        />
                      </div>
                    </div>
                  ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Wan 2.5 Video Results */}
      {(!selectedTool || selectedTool === 'wan25-video') && wan25VideoData && (
        <div className="">
          {!selectedTool && (
            <div 
              className={`flex items-center justify-between w-full ${headerClasses} cursor-pointer`}
              onClick={toggleWan25Video}
            >
              <div className="flex items-center gap-2.5">
                <WanAiLogo size={16} className="text-(--foreground)" />
                <h2 className="font-medium text-left tracking-tight">
                  {(wan25VideoData.generatedVideos?.some(v => v.isImageToVideo) || (wan25VideoData.pendingSourceImages && wan25VideoData.pendingSourceImages.length > 0)) ? 'Wan 2.5 Image to Video' : 'Wan 2.5 Text to Video'}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-(--foreground)/5 text-(--muted)">
                  {wan25VideoData.generatedVideos?.length || 0}
                </span>
                {wan25Expanded ? <ChevronUp className="h-4 w-4 text-(--muted)" /> : <ChevronDown className="h-4 w-4 text-(--muted)" />}
              </div>
            </div>
          )}
          
          <div 
            className="overflow-hidden transition-all duration-300 ease-in-out"
            style={{ 
              maxHeight: wan25Expanded ? '2000px' : '0',
              opacity: wan25Expanded ? 1 : 0,
              paddingTop: wan25Expanded ? '0.5rem' : '0'
            }}
          >
            {/* Render completed videos with VideoGalleryStack */}
            {wan25VideoData.generatedVideos && wan25VideoData.generatedVideos.length > 0 && (
              <VideoGalleryStack
                videos={wan25VideoData.generatedVideos.map((video) => ({
                  src: video.videoUrl,
                  prompt: video.prompt,
                  sourceImageUrl: video.sourceImageUrl,
                  aspectRatio: video.size ? getAspectRatioFromSize(video.size) : undefined
                }))}
                messageId={messageId}
                chatId={chatId}
                userId={userId}
                isMobile={isMobile}
              />
            )}
            
            {/* Render placeholders for pending videos */}
            {wan25VideoData.pendingCount && wan25VideoData.pendingCount > 0 && wan25VideoData.pendingPrompts && wan25VideoData.pendingPrompts.length > 0 ? (
              <div className={`grid gap-5 ${wan25VideoData.generatedVideos && wan25VideoData.generatedVideos.length > 0 ? 'mt-5' : ''} ${
                (wan25VideoData.startedCount || wan25VideoData.generatedVideos?.length || 0) === 1 
                  ? 'grid-cols-1' 
                  : 'grid-cols-1 sm:grid-cols-2'
              }`}>
                {wan25VideoData.pendingPrompts.map((prompt: string, index: number) => {
                  const sourceImage = wan25VideoData.pendingSourceImages?.[index];
                  const isImageToVideo = !!sourceImage;

                  return (
                    <div 
                      key={`pending-video-prompt-${index}`}
                      className="border border-[color-mix(in_srgb,var(--foreground)_7%,transparent)] rounded-xl overflow-hidden shadow-sm bg-[color-mix(in_srgb,var(--foreground)_2%,transparent)] relative min-h-[200px]"
                    >
                      {isImageToVideo ? (
                        pendingImageAspectRatios[index] == null ? (
                          <>
                            <div className="relative w-full min-h-[200px] flex items-center justify-center overflow-hidden">
                              <div
                                className="absolute inset-0 bg-linear-to-r from-transparent via-white/10 to-transparent"
                                style={{
                                  backgroundSize: '200% 100%',
                                  animation: 'shimmer 2s ease-in-out infinite'
                                }}
                              />
                              <div className="prompt-overlay absolute inset-0 bg-black/75 backdrop-blur-md text-white p-6 flex flex-col justify-center items-center text-center opacity-100 transition-opacity duration-300 z-20">
                                <div
                                  className="text-base font-medium bg-linear-to-r from-transparent via-gray-300 to-transparent bg-clip-text text-transparent px-4"
                                  style={{
                                    backgroundSize: '200% 100%',
                                    animation: 'shimmer 2s ease-in-out infinite'
                                  }}
                                >
                                  {prompt}
                                </div>
                              </div>
                            </div>
                            <img
                              src={sourceImage}
                              alt=""
                              className="absolute w-0 h-0 opacity-0 pointer-events-none"
                              onLoad={(e) => {
                                const el = e.currentTarget;
                                const w = el.naturalWidth;
                                const h = el.naturalHeight;
                                if (w && h) {
                                  setPendingImageAspectRatios((prev) => ({ ...prev, [index]: w / h }));
                                }
                              }}
                            />
                          </>
                        ) : (
                          <div
                            className="relative w-full"
                            style={{ aspectRatio: `${pendingImageAspectRatios[index]} / 1` }}
                          >
                            <img
                              src={sourceImage}
                              alt="Source image"
                              className="w-full h-full object-contain block"
                            />
                            <div className="prompt-overlay absolute inset-0 bg-black/75 backdrop-blur-md text-white p-6 flex flex-col justify-center items-center text-center opacity-100 transition-opacity duration-300 z-20">
                              <div
                                className="text-base font-medium bg-linear-to-r from-transparent via-gray-300 to-transparent bg-clip-text text-transparent px-4"
                                style={{
                                  backgroundSize: '200% 100%',
                                  animation: 'shimmer 2s ease-in-out infinite'
                                }}
                              >
                                {prompt}
                              </div>
                            </div>
                          </div>
                        )
                      ) : (
                        <>
                          <div className="absolute inset-0 bg-linear-to-br from-[color-mix(in_srgb,var(--foreground)_5%,transparent)] via-[color-mix(in_srgb,var(--foreground)_3%,transparent)] to-[color-mix(in_srgb,var(--foreground)_5%,transparent)]" />
                          <div className="prompt-overlay absolute inset-0 bg-black/75 backdrop-blur-md text-white p-6 flex flex-col justify-center items-center text-center opacity-100 transition-opacity duration-300 z-20">
                            <div 
                              className="text-base font-medium bg-linear-to-r from-transparent via-gray-300 to-transparent bg-clip-text text-transparent px-4"
                              style={{
                                backgroundSize: '200% 100%',
                                animation: 'shimmer 2s ease-in-out infinite'
                              }}
                            >
                              {prompt}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              wan25VideoData.pendingCount && wan25VideoData.pendingCount > 0 ? (
                <div className={`grid gap-5 ${wan25VideoData.generatedVideos && wan25VideoData.generatedVideos.length > 0 ? 'mt-5' : ''} ${
                  (wan25VideoData.startedCount || wan25VideoData.generatedVideos?.length || 0) === 1 
                    ? 'grid-cols-1' 
                    : 'grid-cols-1 sm:grid-cols-2'
                }`}>
                  {Array.from({ length: wan25VideoData.pendingCount }).map((_, index) => (
                    <div 
                      key={`pending-video-skeleton-${index}`}
                      className="border border-[color-mix(in_srgb,var(--foreground)_7%,transparent)] rounded-xl overflow-hidden shadow-sm bg-[color-mix(in_srgb,var(--foreground)_2%,transparent)]"
                    >
                      <div className="relative aspect-video bg-black/50 overflow-hidden flex items-center justify-center">
                        <div className="w-full h-full relative overflow-hidden">
                          <div 
                            className="absolute inset-0 bg-linear-to-r from-transparent via-white/10 to-transparent"
                            style={{
                              backgroundSize: '200% 100%',
                              animation: 'shimmer 2s ease-in-out infinite'
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null
            )}
          </div>
        </div>
      )}

      {/* Image viewer modal */}
      <ImageModal
        isOpen={selectedImageIndex >= 0 && !!currentImage}
        imageUrl={currentImage?.imageUrl || ''}
        imageAlt={currentImage?.prompt || 'Generated image'}
        onClose={closeImageViewer}
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
        userId={userId}
        isMobile={isMobile}
        isSaving={currentImage ? savingImages.has(currentImage.imageUrl) : false}
        isSaved={currentImage ? savedImages.has(currentImage.imageUrl) : false}
        onSave={handleSave}
        sourceImageUrl={currentImage?.originalImageUrl}
      />
    </div>
  );
} 
