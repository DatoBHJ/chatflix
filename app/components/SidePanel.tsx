'use client'

import { UIMessage } from 'ai'
import Canvas from '@/app/components/Canvas';
import { StructuredResponse } from '@/app/components/StructuredResponse';
import { getYouTubeLinkAnalysisData, getYouTubeSearchData, getTwitterSearchData, getWebSearchResults, getMathCalculationData, getLinkReaderData, getImageGeneratorData, getGeminiImageData, getSeedreamImageData, getQwenImageData, getGoogleSearchData, getWan25VideoData, getGrokVideoData, getFileEditData, getRunCodeData } from '@/app/hooks/toolFunction';
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
// import { AttachmentTextViewer } from './AttachmentTextViewer';
import { AttachmentViewer } from './AttachmentViewer';
// import { useUrlRefresh } from '../hooks/useUrlRefresh';

interface SidePanelProps {
  activePanel: { messageId: string; type: 'canvas' | 'structuredResponse' | 'attachment'; fileIndex?: number; toolType?: string; fileName?: string } | null;
  messages: UIMessage[];
  togglePanel: (messageId: string, type: 'canvas' | 'structuredResponse' | 'attachment', fileIndex?: number, toolType?: string, fileName?: string) => void;
  canvasContainerRef?: React.RefObject<HTMLDivElement | null>;
  onMaximizeToggle?: () => void;
  isPanelMaximized?: boolean;
  chatId?: string;
  userId?: string;
}

export const SidePanel: React.FC<SidePanelProps> = ({
  activePanel,
  messages,
  togglePanel,
  // canvasContainerRef,
  // onMaximizeToggle,
  // isPanelMaximized = false,
  chatId,
  userId
}: SidePanelProps) => {
  const [copiedFileIndex, setCopiedFileIndex] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isMobilePanelVisible, setIsMobilePanelVisible] = useState(false);
  const [mobilePanelElements, setMobilePanelElements] = useState({
    background: false,
    content: false
  });
  const [hasActiveSearchFilters, setHasActiveSearchFilters] = useState(false);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [isAllQueriesSelected, setIsAllQueriesSelected] = useState(false);
  const [userHasInteracted, setUserHasInteracted] = useState(false);

  // Memoized callback for search filter changes
  const handleSearchFilterChange = useCallback((hasActiveFilters: boolean, topics?: string[], isAllSelected?: boolean, userInteracted?: boolean) => {
    console.log('SidePanel: handleSearchFilterChange called with:', hasActiveFilters, topics, 'isAllSelected:', isAllSelected);
    console.log('SidePanel: Current state - hasActiveSearchFilters:', hasActiveSearchFilters, 'selectedTopics:', selectedTopics, 'isAllQueriesSelected:', isAllQueriesSelected);
    
    // Only update if values actually changed
    if (hasActiveFilters !== hasActiveSearchFilters) {
      console.log('SidePanel: Updating hasActiveSearchFilters from', hasActiveSearchFilters, 'to', hasActiveFilters);
      setHasActiveSearchFilters(hasActiveFilters);
    }
    
    const newTopics = topics || [];
    const currentTopicsString = JSON.stringify(selectedTopics);
    const newTopicsString = JSON.stringify(newTopics);
    
    if (currentTopicsString !== newTopicsString) {
      console.log('SidePanel: Updating selectedTopics from', selectedTopics, 'to', newTopics);
      setSelectedTopics(newTopics);
    }
    
    const newIsAllSelected = isAllSelected || false;
    if (newIsAllSelected !== isAllQueriesSelected) {
      console.log('SidePanel: Updating isAllQueriesSelected from', isAllQueriesSelected, 'to', newIsAllSelected);
      setIsAllQueriesSelected(newIsAllSelected);
    }
    
    const newUserInteracted = userInteracted || false;
    if (newUserInteracted !== userHasInteracted) {
      console.log('SidePanel: Updating userHasInteracted from', userHasInteracted, 'to', newUserInteracted);
      setUserHasInteracted(newUserInteracted);
    }
  }, [hasActiveSearchFilters, selectedTopics, isAllQueriesSelected, userHasInteracted]);

  // Debug: Log filter state changes
  useEffect(() => {
    console.log('SidePanel: hasActiveSearchFilters changed to:', hasActiveSearchFilters, 'selectedTopics:', selectedTopics);
  }, [hasActiveSearchFilters, selectedTopics]);

  // Keep a ref to the activePanel data so we can still render it during the exit animation
  const activePanelRef = useRef(activePanel);
  
  // Memoize the mobile panel open state to avoid recalculation
  const isMobilePanelOpen = useMemo(() => !!activePanel?.messageId, [activePanel?.messageId]);
  
  // Update ref only when activePanel changes
  useEffect(() => {
    if (activePanel) {
      activePanelRef.current = activePanel;
    }
  }, [activePanel]);

  // Get panel data early (before early returns) for useMemo
  const panelData = activePanel || activePanelRef.current;
  const activeMessage = panelData ? messages.find(msg => msg.id === panelData.messageId) : null;
  
  // Get tool data early (before early returns) for useMemo
  const webSearchData = activeMessage ? getWebSearchResults(activeMessage) : null;
  const mathCalculationData = activeMessage ? getMathCalculationData(activeMessage) : null;
  const linkReaderData = activeMessage ? getLinkReaderData(activeMessage) : null;
  const imageGeneratorData = activeMessage ? getImageGeneratorData(activeMessage) : null;
  const geminiImageData = activeMessage ? getGeminiImageData(activeMessage) : null;
  const seedreamImageData = activeMessage ? getSeedreamImageData(activeMessage) : null;
  const qwenImageData = activeMessage ? getQwenImageData(activeMessage) : null;
  const twitterSearchData = activeMessage ? getTwitterSearchData(activeMessage) : null;
  const youTubeSearchData = activeMessage ? getYouTubeSearchData(activeMessage) : null;
  const youTubeLinkAnalysisData = activeMessage ? getYouTubeLinkAnalysisData(activeMessage) : null;
  const googleSearchData = activeMessage ? getGoogleSearchData(activeMessage) : null;
  const wan25VideoData = activeMessage ? getWan25VideoData(activeMessage) : null;
  const grokVideoData = activeMessage ? getGrokVideoData(activeMessage) : null;
  const fileEditData = activeMessage ? getFileEditData(activeMessage) : null;
  const runCodeData = activeMessage ? getRunCodeData(activeMessage) : null;

  // Helper function to get topic display name (moved before useMemo)
  const getTopicDisplayName = (topic: string): string => {
    switch (topic) {
      // case 'general': return 'Advanced Search'; // Removed - use google_search for general information
      case 'news': return 'News Searches';
      case 'github': return 'GitHub Searches';
      case 'personal site': return 'Personal Sites';
      case 'linkedin profile': return 'LinkedIn Profiles';
      case 'company': return 'Company Searches';
      case 'financial report': return 'Financial Reports';
      case 'research paper': return 'Research Papers';
      case 'pdf': return 'PDF Searches';
      case 'google': return 'Google Searches';
      case 'google_images': return 'Google Images';
      case 'google_videos': return 'Google Videos';
      case 'twitter': return 'X Searches';
      default: return 'Advanced Search';
    }
  };

  // 모바일 화면 여부 확인
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 640); // sm breakpoint
    };
    
    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);
    return () => window.removeEventListener('resize', checkIfMobile);
  }, []);

  // Disable body scroll when mobile panel is visible and add ESC listener
  useEffect(() => {
    if (isMobilePanelVisible) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          if (activePanelRef.current) {
            togglePanel(activePanelRef.current.messageId, activePanelRef.current.type, activePanelRef.current.fileIndex, activePanelRef.current.toolType);
          }
        }
      };
      window.addEventListener('keydown', onKey);
      return () => {
        document.body.style.overflow = originalOverflow;
        window.removeEventListener('keydown', onKey);
      };
    }
  }, [isMobilePanelVisible, togglePanel]);

  // Stage mount/unmount for smooth enter/exit with staggered animation
  useEffect(() => {
    if (isMobilePanelOpen) {
      // ensure visible when opening
      setIsMobilePanelVisible(true);
      
      // Staggered sequence - background first, then content (like Header battery panel)
      const timeouts = [
        setTimeout(() => setMobilePanelElements(prev => ({ ...prev, background: true })), 10),
        setTimeout(() => setMobilePanelElements(prev => ({ ...prev, content: true })), 200)
      ];
      
      return () => {
        timeouts.forEach(timeout => clearTimeout(timeout));
      };
    } else if (isMobilePanelVisible) {
      // closing: reverse sequence - start immediately
      setMobilePanelElements({ background: false, content: false });
      const timeoutId = setTimeout(() => {
        setIsMobilePanelVisible(false);
      }, 300);
      return () => clearTimeout(timeoutId);
    }
  }, [isMobilePanelOpen, isMobilePanelVisible]);

  // Handle immediate close animation when activePanel becomes null
  useEffect(() => {
    if (!activePanel && isMobilePanelVisible) {
      // Start closing animation immediately when activePanel becomes null
      setMobilePanelElements({ background: false, content: false });
      const timeoutId = setTimeout(() => {
        setIsMobilePanelVisible(false);
      }, 300);
      return () => clearTimeout(timeoutId);
    }
  }, [activePanel, isMobilePanelVisible]);

  // Memoize panel title to ensure it updates when dependencies change
  // This must be called before any early returns to follow React Hooks rules
  const panelTitle = useMemo(() => {
    if (!panelData) return null;
    
    if (panelData.type === 'canvas') {
      if (panelData.toolType) {
        
        // 모든 검색 도구는 "Search Results"로 통일
        if (panelData.toolType.startsWith('web-search:topic:') || 
            panelData.toolType.startsWith('google-search:topic:') ||
            panelData.toolType === 'twitter_search' ||
            panelData.toolType === 'google-search' ||
            panelData.toolType === 'google-images' ||
            panelData.toolType === 'google-videos') {
          return 'Search Results';
        }
        
        // 기타 도구들
        switch (panelData.toolType) {
          case 'calculator': return 'Calculator';
          case 'link-reader': return 'Link Reader';
          case 'image-generator': return 'Image Generator';
          case 'gemini-image': return '🍌 Nano Banana Pro';
          case 'seedream-image': return 'Seedream 4.5';
          case 'qwen-image': return 'Qwen Image Edit';
          case 'youtube-search': return 'YouTube Search';
          case 'youtube-analyzer': return 'YouTube Analyzer';
          case 'wan25-video': return wan25VideoData?.isImageToVideo ? 'Wan 2.5 Image to Video' : 'Wan 2.5 Text to Video';
          case 'grok-video': return grokVideoData?.isVideoEdit ? 'Grok Video to Video' : (grokVideoData?.isImageToVideo ? 'Grok Image to Video' : 'Grok Text to Video');
          case 'run-code': return 'Code output';
          default:
            if (panelData.toolType?.startsWith('file-edit:')) {
              const sub = panelData.toolType.replace('file-edit:', '');
              if (sub === 'read_file') return 'Read file';
              if (sub === 'write_file') return 'Write file';
              if (sub === 'get_file_info') return 'File info';
              if (sub === 'list_workspace') return 'List workspace';
              if (sub === 'delete_file') return 'Delete file';
              if (sub === 'grep_file') return 'Search in file';
              if (sub === 'apply_edits') return 'Apply edits';
              return 'File';
            }
            return 'Results';
        }
      }
      
      // If no toolType specified, determine title based on available data
      // Unified search: if either web search or google search data exists, show "Search Results"
      if (webSearchData || googleSearchData || twitterSearchData) return 'Search Results';
      if (mathCalculationData) return 'Calculator';
      if (linkReaderData) return 'Link Reader';
      if (imageGeneratorData) return 'Image Generator';
      if (geminiImageData || seedreamImageData || qwenImageData) return 'Creative Results';
      if (youTubeSearchData) return 'YouTube Search';
      if (youTubeLinkAnalysisData) return 'YouTube Analysis';
      if (wan25VideoData) return wan25VideoData.isImageToVideo ? 'Wan 2.5 Image to Video' : 'Wan 2.5 Text to Video';
      if (grokVideoData) return grokVideoData.isVideoEdit ? 'Grok Video to Video' : (grokVideoData.isImageToVideo ? 'Grok Image to Video' : 'Grok Text to Video');
      if (fileEditData) return 'File';
      if (runCodeData) return 'Code output';
      
      return 'Canvas';
    }
    if (panelData.type === 'structuredResponse') {
      return 'Tool Result';
    }
    if (panelData.type === 'attachment') {
      return 'User uploaded file';
    }
    return null;
  }, [
    panelData,
    wan25VideoData,
    grokVideoData,
    fileEditData,
    runCodeData,
    webSearchData,
    googleSearchData,
    twitterSearchData,
    mathCalculationData,
    linkReaderData,
    imageGeneratorData,
    geminiImageData,
    seedreamImageData,
    qwenImageData,
    youTubeSearchData,
    youTubeLinkAnalysisData
  ]);

  // Early return when no panel is visible
  if (!isMobilePanelVisible) {
    return null;
  }
  
  if (!panelData) {
    return null;
  }

  // From this point on, panelData is guaranteed to be non-null.
  const nonNullPanelData = panelData!;

  if (!activeMessage) return null;

  // 사용자 첨부파일 렌더링 함수
  const renderAttachmentContent = () => {
    if (nonNullPanelData.type !== 'attachment' || typeof nonNullPanelData.fileIndex !== 'number') {
      return null;
    }

    const attachmentsFromParts = (() => {
      const parts = (activeMessage as any)?.parts;
      if (!parts || !Array.isArray(parts)) return [];
      
      return parts
        .filter((part: any) => part.type === 'attachment' || part.type === 'image' || part.type === 'file')
        .map((part: any, index: number) => {
          if (part.type === 'attachment') return part.attachment;
          
          if (part.type === 'image') {
            return {
              name: `image-${index}`,
              contentType: 'image/jpeg',
              url: part.image,
              fileType: 'image'
            };
          }
          
          if (part.type === 'file') {
            return {
              name: part.filename || `file-${index}`,
              contentType: part.mediaType || 'application/octet-stream',
              url: part.url,
              fileType: 'file'
            };
          }
          
          return null;
        })
        .filter(Boolean);
    })();

    const attachments = (activeMessage as any).experimental_attachments || (attachmentsFromParts.length > 0 ? attachmentsFromParts : null);
    if (!attachments || nonNullPanelData.fileIndex < 0 || nonNullPanelData.fileIndex >= attachments.length) {
      return <div className="text-center text-(--muted)">Attachment not found</div>;
    }

    const attachment = attachments[nonNullPanelData.fileIndex];
    
    // 새로운 AttachmentViewer 컴포넌트 사용 (URL 자동 갱신 포함)
    return <AttachmentViewer attachment={attachment} />;
  };

  // 모든 경우에 Header 스타일의 애니메이션 패널 사용 (모바일과 데스크톱 동일)
  return createPortal(
      <div className={`fixed inset-0 z-70 text-(--foreground) pointer-events-auto transition-all duration-500 ease-out ${
        mobilePanelElements.background ? 'opacity-100' : 'opacity-0'
      }`}
        style={{ backgroundColor: 'var(--background)' }}
      >
        <div className="absolute inset-0" onClick={() => {
          if (activePanelRef.current) {
            togglePanel(activePanelRef.current.messageId, activePanelRef.current.type, activePanelRef.current.fileIndex, activePanelRef.current.toolType);
          }
        }} />
        <div 
          className={`relative h-full w-full flex flex-col transform-gpu transition-all duration-400 ease-out ${
            mobilePanelElements.content ? 'opacity-100 translate-y-0 scale-y-100' : 'opacity-0 -translate-y-4 scale-y-[0.95]'
          }`} 
          style={{ transformOrigin: 'top center' }}
        >
          <button 
            aria-label="Close"
            className="absolute top-3 right-3 p-2 rounded-full z-10 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              if (activePanelRef.current) {
                togglePanel(activePanelRef.current.messageId, activePanelRef.current.type, activePanelRef.current.fileIndex, activePanelRef.current.toolType);
              }
            }}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <div className={`grow overflow-y-auto px-12 sm:px-16 md:px-20 lg:px-32 xl:px-40 2xl:px-48 pt-12 sm:pt-30 pb-8 transform-gpu transition-all duration-400 ease-out ${
            mobilePanelElements.content ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-6'
          }`}>
            {nonNullPanelData.type !== 'attachment' && panelTitle && (
              <h2 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-medium tracking-tight pl-0.5">
                {panelTitle}
              </h2>
            )}
            <div className={`sm:mt-18 mt-10 text-base text-(--muted) transform-gpu transition-all duration-400 ease-out ${
              mobilePanelElements.content ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
            }`}>
              {nonNullPanelData.type !== 'attachment' && (
                <div className="mb-6 text-base font-normal text-(--muted) pl-0 sm:pl-3.5">Tool Results</div>
              )}
              <div className="text-(--foreground)/80 leading-relaxed">
                {nonNullPanelData.type === 'canvas' && (
        <Canvas
          webSearchData={webSearchData}
          mathCalculationData={mathCalculationData}
          linkReaderData={linkReaderData}
          imageGeneratorData={imageGeneratorData}
          geminiImageData={geminiImageData}
          seedreamImageData={seedreamImageData}
          qwenImageData={qwenImageData}
          wan25VideoData={wan25VideoData}
          grokVideoData={grokVideoData}
          twitterSearchData={twitterSearchData}
          youTubeSearchData={youTubeSearchData}
          youTubeLinkAnalysisData={youTubeLinkAnalysisData}
          googleSearchData={googleSearchData}
          fileEditData={fileEditData}
          runCodeData={runCodeData}
                    isCompact={false}
                    selectedTool={nonNullPanelData.toolType}
                    selectedItem={nonNullPanelData.fileName}
                    onSearchFilterChange={handleSearchFilterChange}
                    messageId={nonNullPanelData.messageId}
                    chatId={chatId}
                    userId={userId}
        />
      )}
                {nonNullPanelData.type === 'structuredResponse' && (
                  <StructuredResponse message={activeMessage} fileIndex={nonNullPanelData.fileIndex} />
      )}
                {nonNullPanelData.type === 'attachment' && renderAttachmentContent()}
              </div>
    </div>
  </div>
</div>
      </div>,
      document.body
);
} 