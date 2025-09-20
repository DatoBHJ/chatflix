'use client'

import { UIMessage } from 'ai'
import Canvas from '@/app/components/Canvas';
import { StructuredResponse } from '@/app/components/StructuredResponse';
import { getYouTubeLinkAnalysisData, getYouTubeSearchData, getWebSearchResults, getMathCalculationData, getLinkReaderData, getImageGeneratorData, getGoogleSearchData } from '@/app/hooks/toolFunction';
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { AttachmentTextViewer } from './AttachmentTextViewer';

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
  canvasContainerRef,
  onMaximizeToggle,
  isPanelMaximized = false
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

  const getPanelSubtitle = () => {
    if (nonNullPanelData.type === 'canvas' && !nonNullPanelData.toolType) {
      const canvasDataSummary: string[] = [];
      if (webSearchData) canvasDataSummary.push('Advanced Search');
      if (mathCalculationData) canvasDataSummary.push('Calculator');
      if (linkReaderData) canvasDataSummary.push('Link Reader');
      if (imageGeneratorData) canvasDataSummary.push('Image Gen');

      if (youTubeSearchData) canvasDataSummary.push('YouTube Search');
      if (youTubeLinkAnalysisData) canvasDataSummary.push('YouTube Analysis');
      if (googleSearchData) canvasDataSummary.push('Google Search');

      // Only show subtitle if there are multiple tools (since single tool name is already in title)
      if (canvasDataSummary.length > 1) {
        return canvasDataSummary.join(', ');
      }
    }
    if (nonNullPanelData.type === 'attachment') {
      return 'User uploaded file';
    }
    return null;
  };

  const renderFileActions = () => {
    // StructuredResponse 파일 액션
    if (nonNullPanelData.type === 'structuredResponse' && typeof nonNullPanelData.fileIndex === 'number') {
      // StructuredResponse.tsx와 동일한 방식으로 파일 데이터 가져오기
      const getStructuredResponseData = (message: any) => {
        const structuredResponseAnnotation = message.annotations?.find(
          (annotation: any) => annotation.type === 'structured_response'
        );
        
        if (structuredResponseAnnotation?.data?.response) {
          return structuredResponseAnnotation.data.response;
        }
        
        if (message.tool_results?.structuredResponse?.response) {
          return message.tool_results.structuredResponse.response;
        }
        
        return null;
      }

      const fileData = getStructuredResponseData(activeMessage);

      if (fileData && fileData[nonNullPanelData.fileIndex]) {
        const file = fileData[nonNullPanelData.fileIndex];
        const isCopied = copiedFileIndex === `${nonNullPanelData.messageId}-${nonNullPanelData.fileIndex}`;
      
      return (
          <div className="flex items-center gap-2">
          <button
              onClick={() => {
                navigator.clipboard.writeText(file.content || '');
                setCopiedFileIndex(`${nonNullPanelData.messageId}-${nonNullPanelData.fileIndex}`);
                setTimeout(() => setCopiedFileIndex(null), 2000);
              }}
              className="p-1.5 hover:bg-[var(--accent)] rounded-md transition-colors"
              title="Copy to clipboard"
          >
            {isCopied ? (
                <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
                <svg className="w-3.5 h-3.5 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            )}
          </button>
          </div>
      );
      }
    }

    // Attachment 파일 액션
    if (nonNullPanelData.type === 'attachment' && typeof nonNullPanelData.fileIndex === 'number') {
      const attachmentsFromParts = (() => {
        const parts = (activeMessage as any)?.parts;
        if (!parts) return [];
        return parts
          .filter((part: any) => part.type === 'attachment')
          .map((part: any) => part.attachment);
      })();

      const attachments = (activeMessage as any).experimental_attachments || attachmentsFromParts;
      if (!attachments || nonNullPanelData.fileIndex < 0 || nonNullPanelData.fileIndex >= attachments.length) {
        return null;
      }

      const selectedAttachment = attachments[nonNullPanelData.fileIndex];
      
      const downloadAttachment = () => {
        const link = document.createElement('a');
        link.href = selectedAttachment.url;
        link.download = selectedAttachment.name || 'download';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      };
      
      return (
        <div className="flex items-center gap-2">
          <button
            onClick={downloadAttachment}
            className="p-1.5 hover:bg-[var(--accent)] rounded-md transition-colors"
            title="Download file"
          >
            <svg className="w-3.5 h-3.5 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </button>
        </div>
      );
    }
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
    const isImage = attachment.contentType?.startsWith('image/');
    const isPDF = attachment.contentType === 'application/pdf' || attachment.name?.toLowerCase().endsWith('.pdf');
    const isText = attachment.contentType?.startsWith('text/') || 
                   attachment.contentType?.includes('json') ||
                   attachment.contentType?.includes('xml') ||
                   attachment.contentType?.includes('javascript') ||
                   attachment.contentType?.includes('typescript') ||
                   attachment.contentType?.includes('html') ||
                   attachment.contentType?.includes('css') ||
                   (attachment.name && /(\.txt|\.md|\.js|\.jsx|\.ts|\.tsx|\.html|\.css|\.json|\.xml|\.py|\.java|\.c|\.cpp|\.cs|\.go|\.rb|\.php|\.swift|\.kt|\.rs|\.sql|\.sh|\.yml|\.yaml|\.toml|\.ini|\.cfg|\.conf|\.log)$/i.test(attachment.name));

    if (isImage) {
      return (
        <div className="flex justify-center">
          <img 
            src={attachment.url} 
            alt={attachment.name || 'Attachment'} 
            className="max-w-full h-auto rounded-lg"
            style={{ maxHeight: '70vh' }}
          />
        </div>
      );
    } else if (isPDF) {
      return (
        <div className="w-full h-full">
          <iframe
            src={`${attachment.url}#toolbar=1&navpanes=1&scrollbar=1`}
            className="w-full border border-[color-mix(in_srgb,var(--foreground)_10%,transparent)] rounded-lg"
            style={{ height: '80vh', minHeight: '600px' }}
            title={attachment.name || 'PDF Document'}
          />
          <div className="text-center mt-2 text-sm text-[color-mix(in_srgb,var(--foreground)_60%,transparent)]">
            <p>PDF preview - Use browser controls to navigate</p>
          </div>
        </div>
      );
    } else if (isText) {
      return <AttachmentTextViewer attachment={attachment} />;
    } else {
      // 기타 파일의 경우
      return (
        <div className="space-y-4">
          <div className="p-4 border border-[color-mix(in_srgb,var(--foreground)_10%,transparent)] rounded-lg">
            <h4 className="font-medium text-sm mb-2">File Information</h4>
            <div className="text-sm text-[var(--muted)] space-y-1">
              <p><strong>Name:</strong> {attachment.name || 'Unknown'}</p>
              <p><strong>Type:</strong> {attachment.contentType || 'Unknown'}</p>
              {attachment.metadata?.fileSize && (
                <p><strong>Size:</strong> {Math.round(attachment.metadata.fileSize / 1024)} KB</p>
              )}
            </div>
          </div>
          
          <div className="text-center text-[var(--muted)]">
            <p>Preview not available for this file type.</p>
            <p className="text-sm mt-2">Click download to view the file.</p>
          </div>
        </div>
      );
    }
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