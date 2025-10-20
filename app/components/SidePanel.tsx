'use client'

import { UIMessage } from 'ai'
import Canvas from '@/app/components/Canvas';
import { StructuredResponse } from '@/app/components/StructuredResponse';
import { getYouTubeLinkAnalysisData, getYouTubeSearchData, getWebSearchResults, getMathCalculationData, getLinkReaderData, getImageGeneratorData, getGeminiImageData, getSeedreamImageData, getGoogleSearchData } from '@/app/hooks/toolFunction';
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
// import { AttachmentTextViewer } from './AttachmentTextViewer';
import { AttachmentViewer } from './AttachmentViewer';
// import { useUrlRefresh } from '../hooks/useUrlRefresh';

interface SidePanelProps {
  activePanel: { messageId: string; type: 'canvas' | 'structuredResponse' | 'attachment'; fileIndex?: number; toolType?: string; fileName?: string } | null;
  messages: UIMessage[];
  togglePanel: (messageId: string, type: 'canvas' | 'structuredResponse' | 'attachment', fileIndex?: number, toolType?: string, fileName?: string) => void;
  canvasContainerRef?: React.RefObject<HTMLDivElement>;
  onMaximizeToggle?: () => void;
  isPanelMaximized?: boolean;
}

export const SidePanel: React.FC<SidePanelProps> = ({
  activePanel,
  messages,
  togglePanel,
  // canvasContainerRef,
  // onMaximizeToggle,
  // isPanelMaximized = false
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

  // Early return when no panel is visible
  if (!isMobilePanelVisible) {
    return null;
  }

  const panelData = activePanel || activePanelRef.current;
  
  if (!panelData) {
    return null;
  }

  // From this point on, panelData is guaranteed to be non-null.
  const nonNullPanelData = panelData!;

  const activeMessage = messages.find(msg => msg.id === nonNullPanelData.messageId);
  if (!activeMessage) return null;

  const webSearchData = getWebSearchResults(activeMessage);
  const mathCalculationData = getMathCalculationData(activeMessage);
  const linkReaderData = getLinkReaderData(activeMessage);
  const imageGeneratorData = getImageGeneratorData(activeMessage);
  const geminiImageData = getGeminiImageData(activeMessage);
  const seedreamImageData = getSeedreamImageData(activeMessage);
  const youTubeSearchData = getYouTubeSearchData(activeMessage);
  const youTubeLinkAnalysisData = getYouTubeLinkAnalysisData(activeMessage);
  const googleSearchData = getGoogleSearchData(activeMessage);

  // Helper function to get topic display name
  const getTopicDisplayName = (topic: string): string => {
    switch (topic) {
      case 'general': return 'Advanced Search';
      case 'news': return 'News Search';
      case 'github': return 'GitHub Search';
      case 'personal site': return 'Personal Sites';
      case 'linkedin profile': return 'LinkedIn Profiles';
      case 'company': return 'Company Search';
      case 'financial report': return 'Financial Reports';
      case 'research paper': return 'Academic Papers';
      case 'pdf': return 'PDF Search';
      case 'google': return 'Google Search';
      case 'google_images': return 'Google Images';
    case 'google_videos': return 'Google Videos';
      default: return 'Advanced Search';
    }
  };

  const getPanelTitle = () => {
    if (nonNullPanelData.type === 'canvas') {
      if (nonNullPanelData.toolType) {
        
        // web-search:topic:xxx 패턴 처리
        if (nonNullPanelData.toolType.startsWith('web-search:topic:')) {
          // If "All Queries" is selected, show "Searches"
          if (isAllQueriesSelected) {
            return 'Searches';
          }
          
          // If search filters are active, determine title based on selected topics
          if (hasActiveSearchFilters && selectedTopics.length > 0) {
            // Get unique topics
            const uniqueTopics = [...new Set(selectedTopics)];
            
            // If all selected queries are from the same topic, show that topic's title
            if (uniqueTopics.length === 1) {
              return getTopicDisplayName(uniqueTopics[0]);
            } else {
              // Mixed topics, show generic "Searches"
              return 'Searches';
            }
          }
          
          // Check if user has interacted with filters but no specific queries are selected
          // In mixed search scenarios (both web and google data), show "Searches"
          if (webSearchData && googleSearchData && userHasInteracted && !isAllQueriesSelected) {
            return 'Searches';
          }
          
          // No active filters - show the topic that was directly clicked from preview
          const topic = nonNullPanelData.toolType.replace('web-search:topic:', '');
          return getTopicDisplayName(topic);
        }
        
        // google-search:topic:xxx 패턴 처리
        if (nonNullPanelData.toolType.startsWith('google-search:topic:')) {
          // If "All Queries" is selected, show "Searches" (unified with web search)
          if (isAllQueriesSelected) {
            return webSearchData && googleSearchData ? 'Searches' : 'Google Search';
          }
          
          // If search filters are active, determine title based on selected topics
          if (hasActiveSearchFilters && selectedTopics.length > 0) {
            // Get unique topics
            const uniqueTopics = [...new Set(selectedTopics)];
            
            // If all selected queries are from the same topic, show that topic's title
            if (uniqueTopics.length === 1) {
              return getTopicDisplayName(uniqueTopics[0]);
            } else {
              // Mixed topics, show generic "Searches"
              return 'Searches';
            }
          }
          
          // Check if user has interacted with filters but no specific queries are selected
          // In mixed search scenarios (both web and google data), show "Searches"
          if (webSearchData && googleSearchData && userHasInteracted && !isAllQueriesSelected) {
            return 'Searches';
          }
          
          // No active filters - show the topic that was directly clicked from preview
          const topic = nonNullPanelData.toolType.replace('google-search:topic:', '');
          return getTopicDisplayName(topic);
        }
        
        // 기타 도구들
        switch (nonNullPanelData.toolType) {
          case 'calculator': return 'Calculator';
          case 'link-reader': return 'Link Reader';
          case 'image-generator': return 'Image Generator';
          case 'gemini-image': return '🍌 Nano Banana';
          case 'seedream-image': return 'Seedream 4.0';
          case 'youtube-search': return 'YouTube Search';
          case 'youtube-analyzer': return 'YouTube Analyzer';
          case 'x-search': return 'X Search';
          case 'google-search': return 'Google Search';
          case 'google-images': return 'Google Images';
          case 'google-videos': return 'Google Videos';
          default: return 'Canvas Results';
        }
      }
      
      // If no toolType specified, determine title based on available data
        // Unified search: if either web search or google search data exists, show "Searches"
        if (webSearchData || googleSearchData) return 'Searches';
        if (mathCalculationData) return 'Calculator';
        if (linkReaderData) return 'Link Reader';
        if (imageGeneratorData) return 'Image Generator';
        if (youTubeSearchData) return 'YouTube Search';
        if (youTubeLinkAnalysisData) return 'YouTube Analysis';
      
      return 'Canvas';
    }
    if (nonNullPanelData.type === 'structuredResponse') {
      return 'Tool Result';
    }
    if (nonNullPanelData.type === 'attachment') {
      return 'User uploaded file';
    }
    return null;
  };

  // 사용자 첨부파일 렌더링 함수
  const renderAttachmentContent = () => {
    if (nonNullPanelData.type !== 'attachment' || typeof nonNullPanelData.fileIndex !== 'number') {
      return null;
    }

    const attachmentsFromParts = (() => {
      const parts = (activeMessage as any)?.parts;
      if (!parts) return [];
      return parts
        .filter((part: any) => part.type === 'attachment')
        .map((part: any) => part.attachment);
    })();

    const attachments = (activeMessage as any).experimental_attachments || attachmentsFromParts;
    if (!attachments || nonNullPanelData.fileIndex < 0 || nonNullPanelData.fileIndex >= attachments.length) {
      return <div className="text-center text-[var(--muted)]">Attachment not found</div>;
    }

    const attachment = attachments[nonNullPanelData.fileIndex];
    
    // 새로운 AttachmentViewer 컴포넌트 사용 (URL 자동 갱신 포함)
    return <AttachmentViewer attachment={attachment} />;
  };

  // 모든 경우에 Header 스타일의 애니메이션 패널 사용 (모바일과 데스크톱 동일)
  return createPortal(
      <div className={`fixed inset-0 z-[70] text-[var(--foreground)] pointer-events-auto transition-all duration-500 ease-out ${
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
          <div className={`flex-grow overflow-y-auto px-12 sm:px-16 md:px-20 lg:px-32 xl:px-40 2xl:px-48 pt-12 sm:pt-30 pb-8 transform-gpu transition-all duration-400 ease-out ${
            mobilePanelElements.content ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-6'
          }`}>
            <h2 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-medium tracking-tight pl-0.5">
              {getPanelTitle()}
            </h2>
            <div className={`sm:mt-20 mt-10 text-base text-[var(--muted)] transform-gpu transition-all duration-400 ease-out ${
              mobilePanelElements.content ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
            }`}>
              <div className="mb-6 text-base font-normal text-[var(--muted)] pl-0 sm:pl-3.5">Tool Results</div>
              <div className="text-[var(--foreground)]/80 leading-relaxed">
                {nonNullPanelData.type === 'canvas' && (
        <Canvas
          webSearchData={webSearchData}
          mathCalculationData={mathCalculationData}
          linkReaderData={linkReaderData}
          imageGeneratorData={imageGeneratorData}
          geminiImageData={geminiImageData}
          seedreamImageData={seedreamImageData}
          youTubeSearchData={youTubeSearchData}
          youTubeLinkAnalysisData={youTubeLinkAnalysisData}
          googleSearchData={googleSearchData}
                    isCompact={false}
                    selectedTool={nonNullPanelData.toolType}
                    onSearchFilterChange={handleSearchFilterChange}
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