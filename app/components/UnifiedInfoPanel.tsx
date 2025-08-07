import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Brain, Wrench, Maximize2, X, CheckCircle2 } from 'lucide-react';
import { ReasoningSection } from './ReasoningSection';
import { CanvasToolsPreview } from './Canvas/CanvasToolsPreview';
import { MarkdownContent } from './MarkdownContent';

interface UnifiedInfoPanelProps {
  reasoningPart?: any;
  isAssistant: boolean;
  hasAnyContent: boolean;
  isWaitingForToolResults: boolean;
  isStreaming: boolean;
  reasoningComplete: boolean;
  reasoningPartExpanded: Record<string, boolean>;
  setReasoningPartExpanded: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  userOverrideReasoningPartRef: React.MutableRefObject<Record<string, boolean | null>>;
  loadingReasoningKey: string;
  completeReasoningKey: string;
  hasActualCanvasData: boolean;
  webSearchData?: any;
  mathCalculationData?: any;
  linkReaderData?: any;
  imageGeneratorData?: any;
  academicSearchData?: any;
  xSearchData?: any;
  youTubeSearchData?: any;
  youTubeLinkAnalysisData?: any;
  messageId: string;
  togglePanel?: (messageId: string, type: 'canvas' | 'structuredResponse', fileIndex?: number, toolType?: string, fileName?: string) => void;
}

export const UnifiedInfoPanel: React.FC<UnifiedInfoPanelProps> = ({
  reasoningPart,
  isAssistant,
  hasAnyContent,
  isWaitingForToolResults,
  isStreaming,
  reasoningComplete,
  reasoningPartExpanded,
  setReasoningPartExpanded,
  userOverrideReasoningPartRef,
  loadingReasoningKey,
  completeReasoningKey,
  hasActualCanvasData,
  webSearchData,
  mathCalculationData,
  linkReaderData,
  imageGeneratorData,
  academicSearchData,
  xSearchData,
  youTubeSearchData,
  youTubeLinkAnalysisData,
  messageId,
  togglePanel,
}) => {
  const [activeTab, setActiveTab] = useState<'thinking' | 'tools'>('thinking');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [thinkingStartTime, setThinkingStartTime] = useState<number | null>(null);

  const thinkingScrollRef = useRef<HTMLDivElement>(null);
  const fullScreenScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isAssistant && reasoningPart && !thinkingStartTime) {
      setThinkingStartTime(Date.now());
    }
  }, [isAssistant, reasoningPart, thinkingStartTime]);

  const hasReasoning = reasoningPart && isAssistant;
  const hasCanvas = hasActualCanvasData && isAssistant;
  const hasBoth = hasReasoning && hasCanvas;

  const hasProcessingTool = useMemo(() => {
    const toolData = [webSearchData, mathCalculationData, linkReaderData, imageGeneratorData, academicSearchData, xSearchData, youTubeSearchData, youTubeLinkAnalysisData];
    return toolData.some(data => {
      if (!data) return false;
      if (data.results && Array.isArray(data.results)) {
        return data.results.some((r: any) => r.isComplete === false);
      }
      if (data.status && (data.status === 'processing' || data.status === 'loading')) {
        return true;
      }
      return false;
    });
  }, [webSearchData, mathCalculationData, linkReaderData, imageGeneratorData, academicSearchData, xSearchData, youTubeSearchData, youTubeLinkAnalysisData]);

  useEffect(() => {
    if (activeTab === 'thinking' && isExpanded && thinkingScrollRef.current && reasoningPart) {
      const scrollContainer = thinkingScrollRef.current;
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }
  }, [reasoningPart?.reasoning, activeTab, isExpanded]);

  useEffect(() => {
    if (!reasoningComplete && activeTab === 'thinking' && isExpanded && thinkingScrollRef.current) {
      const scrollContainer = thinkingScrollRef.current;
      const scrollToBottom = () => {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      };
      scrollToBottom();
      const timeoutId = setTimeout(scrollToBottom, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [reasoningPart?.reasoning, reasoningComplete, activeTab, isExpanded]);

  useEffect(() => {
    if (hasProcessingTool && hasBoth) {
      setActiveTab('tools');
      setIsExpanded(true);
    }
  }, [hasProcessingTool, hasBoth]);

  // Auto scroll for full screen
  useEffect(() => {
    if (isFullScreen && activeTab === 'thinking' && fullScreenScrollRef.current && reasoningPart) {
      fullScreenScrollRef.current.scrollTop = fullScreenScrollRef.current.scrollHeight;
    }
  }, [reasoningPart?.reasoning, isFullScreen, activeTab]);

  const handleTabChange = useCallback((tab: 'thinking' | 'tools') => {
    setActiveTab(tab);
    setTimeout(() => {
      if (tab === 'thinking' && thinkingScrollRef.current) {
        thinkingScrollRef.current.scrollTop = thinkingScrollRef.current.scrollHeight;
      }
    }, 50);
  }, []);

  const handleBubbleClick = useCallback(() => {
    if (hasBoth) {
      const newExpanded = !isExpanded;
      setIsExpanded(newExpanded);
      if (newExpanded) {
        setTimeout(() => {
          if (activeTab === 'thinking' && thinkingScrollRef.current) {
            thinkingScrollRef.current.scrollTop = thinkingScrollRef.current.scrollHeight;
          }
        }, 50);
      }
    } else if (hasReasoning) {
      const isLoading = !hasAnyContent || isWaitingForToolResults || isStreaming;
      const key = isLoading ? loadingReasoningKey : completeReasoningKey;
      const isReasoningExpanded = reasoningPartExpanded[key] ?? !reasoningComplete;
      const newExpansionState = !isReasoningExpanded;
      setReasoningPartExpanded(prev => ({ ...prev, [key]: newExpansionState }));
      userOverrideReasoningPartRef.current = { ...userOverrideReasoningPartRef.current, [key]: newExpansionState };
    }
  }, [hasBoth, isExpanded, hasReasoning, hasAnyContent, isWaitingForToolResults, isStreaming, loadingReasoningKey, completeReasoningKey, reasoningPartExpanded, reasoningComplete, setReasoningPartExpanded, userOverrideReasoningPartRef, activeTab]);

  const handleFullScreenToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsFullScreen(!isFullScreen);
  }, [isFullScreen]);

  const handleFullScreenTabChange = useCallback((tab: 'thinking' | 'tools') => {
    setActiveTab(tab);
    setTimeout(() => {
      if (tab === 'thinking' && fullScreenScrollRef.current) {
        fullScreenScrollRef.current.scrollTop = fullScreenScrollRef.current.scrollHeight;
      }
    }, 50);
  }, []);

  if (!hasReasoning && !hasCanvas) return null;

  // Full screen popup rendering
  if (isFullScreen) {
    const elapsedTime = thinkingStartTime ? Math.floor((Date.now() - thinkingStartTime) / 1000) : 0;
    
    return ReactDOM.createPortal(
      <div className="fixed inset-0 z-[9999] backdrop-blur-sm flex items-center justify-center p-4" style={{ backgroundColor: 'var(--overlay)' }}>
        <div className="relative w-full max-w-5xl h-full max-h-[90vh] bg-[var(--background)] rounded-2xl overflow-hidden flex flex-col" style={{ boxShadow: '0 25px 50px -12px var(--overlay), 0 10px 20px -5px var(--overlay)' }}>
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-[var(--subtle-divider)]">
            <div className="flex items-center gap-3">
              {activeTab === 'thinking' ? (
                <>
                  <Brain className="h-5 w-5" style={{ color: 'var(--reasoning-color)' }} strokeWidth={2} />
                  <div>
                    <h3 className="font-semibold text-[var(--foreground)]">AI Reasoning</h3>
                    <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
                      {!reasoningComplete ? (
                        <>
                          <div className="animate-spin rounded-full border-2 border-transparent border-t-[var(--reasoning-color)] h-3 w-3" style={{ animationDuration: '0.8s' }}></div>
                          <span>Thinking for {elapsedTime}s</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-3 w-3 text-green-500" strokeWidth={2.5} />
                          <span>Completed in {elapsedTime}s</span>
                        </>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <Wrench className="h-5 w-5" style={{ color: 'var(--tools-color)' }} strokeWidth={2} />
                  <div>
                    <h3 className="font-semibold text-[var(--foreground)]">Tools & Analysis</h3>
                    <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
                      {hasProcessingTool ? (
                        <>
                          <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                          </span>
                          <span>Processing tools...</span>
                        </>
                      ) : (
                        <>
                          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                          <span>Tools completed</span>
                        </>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
            <button
              onClick={handleFullScreenToggle}
              className="p-2 hover:bg-[var(--accent)] rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-[var(--muted)]" />
            </button>
          </div>
          
          {/* Tab switcher */}
          <div className="flex items-center gap-1 mx-4 mt-4 mb-2 bg-[var(--accent)] rounded-lg p-1">
            <button
              onClick={() => handleFullScreenTabChange('thinking')}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors flex-1 justify-center ${activeTab === 'thinking' ? 'bg-[var(--background)] shadow-sm' : 'text-[var(--muted)] hover:text-[var(--foreground)]'}`}
              style={{ color: activeTab === 'thinking' ? 'var(--reasoning-color)' : undefined }}
            >
              <Brain className="h-4 w-4" strokeWidth={2} />
              <span>Thinking</span>
              {!reasoningComplete && (
                <div className="flex gap-0.5">
                  <div className="w-1 h-1 bg-current rounded-full animate-pulse"></div>
                </div>
              )}
            </button>
            <button
              onClick={() => handleFullScreenTabChange('tools')}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors flex-1 justify-center ${activeTab === 'tools' ? 'bg-[var(--background)] shadow-sm' : 'text-[var(--muted)] hover:text-[var(--foreground)]'}`}
              style={{ color: activeTab === 'tools' ? 'var(--tools-color)' : undefined }}
            >
              <Wrench className="h-4 w-4" strokeWidth={2} />
              <span>Tools</span>
              {hasProcessingTool && (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                </span>
              )}
            </button>
          </div>
          
          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {activeTab === 'thinking' ? (
              <div 
                ref={fullScreenScrollRef}
                className="text-[var(--foreground)] leading-relaxed scroll-smooth"
              >
                <MarkdownContent content={reasoningPart.reasoning} variant="clean" />
              </div>
            ) : (
              <CanvasToolsPreview
                webSearchData={webSearchData}
                mathCalculationData={mathCalculationData}
                linkReaderData={linkReaderData}
                imageGeneratorData={imageGeneratorData}
                academicSearchData={academicSearchData}
                xSearchData={xSearchData}
                youTubeSearchData={youTubeSearchData}
                youTubeLinkAnalysisData={youTubeLinkAnalysisData}
                messageId={messageId}
                togglePanel={togglePanel}
                contentOnly={true}
              />
            )}
          </div>
        </div>
      </div>,
      document.body
    );
  }

  if (!hasBoth) {
    return (
      <div className="pl-0 mb-2">
        {hasReasoning && (
          <div className="flex-shrink-0">
            {(() => {
              const isLoading = !hasAnyContent || isWaitingForToolResults || isStreaming;
              const key = isLoading ? loadingReasoningKey : completeReasoningKey;
              const isReasoningExpanded = reasoningPartExpanded[key] ?? !reasoningComplete;

              const handleToggle = (expanded: boolean) => {
                setReasoningPartExpanded(prev => ({ ...prev, [key]: expanded }));
                userOverrideReasoningPartRef.current = { ...userOverrideReasoningPartRef.current, [key]: expanded };
              };

              return (
                <ReasoningSection 
                  content={reasoningPart.reasoning} 
                  isComplete={reasoningComplete}
                  isExpanded={isReasoningExpanded}
                  setIsExpanded={handleToggle}
                  startTime={thinkingStartTime}
                  key={key} 
                />
              );
            })()}
          </div>
        )}
        {hasCanvas && (
          <div className="flex-shrink-0">
            <CanvasToolsPreview
              webSearchData={webSearchData}
              mathCalculationData={mathCalculationData}
              linkReaderData={linkReaderData}
              imageGeneratorData={imageGeneratorData}
              academicSearchData={academicSearchData}
              xSearchData={xSearchData}
              youTubeSearchData={youTubeSearchData}
              youTubeLinkAnalysisData={youTubeLinkAnalysisData}
              messageId={messageId}
              togglePanel={togglePanel}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex justify-start pl-0 mb-2">
      <div className="group relative cursor-pointer" onClick={handleBubbleClick}>
        <div className="flex items-center gap-2 px-3 py-2 rounded-full backdrop-blur-xl border border-[var(--subtle-divider)] hover:shadow-md hover:scale-[1.02] transition-all duration-200 ease-out" style={{ backgroundColor: 'color-mix(in srgb, var(--background) 80%, transparent)' }}>
          {activeTab === 'thinking' ? (
            <Brain className="h-3.5 w-3.5" style={{ color: 'var(--reasoning-color)' }} strokeWidth={2} />
          ) : (
            <Wrench className="h-3.5 w-3.5" style={{ color: 'var(--tools-color)' }} strokeWidth={2} />
          )}
          
          {activeTab === 'thinking' ? (
            !reasoningComplete ? (
              <div className="flex items-center gap-1">
                <div className="flex gap-0.5">
                  <div className="w-0.5 h-0.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-0.5 h-0.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-0.5 h-0.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            ) : (
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
            )
          ) : (
            hasProcessingTool ? (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
            ) : (
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
            )
          )}

          <div className="flex items-center gap-1 text-xs text-[var(--muted)]">
            <span 
              className={activeTab === 'thinking' ? 'font-medium' : ''}
              style={{ color: activeTab === 'thinking' ? 'var(--reasoning-color)' : undefined }}
            >
              Thinking
            </span>
            <span>•</span>
            <span 
              className={activeTab === 'tools' ? 'font-medium' : ''}
              style={{ color: activeTab === 'tools' ? 'var(--tools-color)' : undefined }}
            >
              Tools
            </span>
          </div>
        </div>

        {/* <div className="absolute -bottom-0.5 left-4 flex gap-0.5">
          <div className="w-1 h-1 rounded-full" style={{ backgroundColor: 'color-mix(in srgb, var(--background) 60%, transparent)' }}></div>
          <div className="w-0.5 h-0.5 rounded-full" style={{ backgroundColor: 'color-mix(in srgb, var(--background) 40%, transparent)' }}></div>
        </div> */}

        <div className={`absolute bottom-full left-0 mb-3 w-80 sm:w-96 bg-[var(--background)] backdrop-blur-xl rounded-2xl border border-[var(--subtle-divider)] shadow-lg p-4 z-50 transition-all duration-200 ease-out ${isExpanded ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-1 pointer-events-none'}`} style={{ boxShadow: '0 10px 25px -5px var(--overlay), 0 4px 6px -2px var(--overlay)' }}>
          <div className="absolute -bottom-1.5 left-6 w-3 h-3 bg-[var(--background)] border-r border-b border-[var(--subtle-divider)] rotate-45"></div>
          
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1 bg-[var(--accent)] rounded-lg p-1 flex-1 mr-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleTabChange('thinking');
                }}
                className={`flex items-center gap-2 px-3 py-0 sm:py-1 rounded-md text-xs font-medium transition-colors flex-1 justify-center ${activeTab === 'thinking' ? 'bg-[var(--background)] shadow-sm' : 'text-[var(--muted)] hover:text-[var(--foreground)]'}`}
                style={{ color: activeTab === 'thinking' ? 'var(--reasoning-color)' : undefined }}
              >
                <Brain className="h-3 w-3" strokeWidth={2} />
                <span>Thinking</span>
                {!reasoningComplete && (
                  <div className="flex gap-0.5">
                    <div className="w-1 h-1 bg-current rounded-full animate-pulse"></div>
                  </div>
                )}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleTabChange('tools');
                }}
                className={`flex items-center gap-2 px-3 py-0 sm:py-1 rounded-md text-xs font-medium transition-colors flex-1 justify-center ${activeTab === 'tools' ? 'bg-[var(--background)] shadow-sm' : 'text-[var(--muted)] hover:text-[var(--foreground)]'}`}
                style={{ color: activeTab === 'tools' ? 'var(--tools-color)' : undefined }}
              >
                <Wrench className="h-3 w-3" strokeWidth={2} />
                <span>Tools</span>
                {hasProcessingTool && (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                  </span>
                )}
              </button>
            </div>
            <button
              onClick={handleFullScreenToggle}
              className="p-1 hover:bg-[var(--accent)] rounded-lg transition-colors"
              title="Expand to full screen"
            >
              <Maximize2 className="h-3.5 w-3.5 text-[var(--muted)]" />
            </button>
          </div>
          
          <div className="max-h-24 overflow-y-auto scrollbar-thin">
            {activeTab === 'thinking' ? (
              <div 
                ref={thinkingScrollRef}
                className="text-sm text-[var(--foreground)] leading-relaxed scroll-smooth"
              >
                <MarkdownContent content={reasoningPart.reasoning} variant="clean" />
              </div>
            ) : (
               <CanvasToolsPreview
                 webSearchData={webSearchData}
                 mathCalculationData={mathCalculationData}
                 linkReaderData={linkReaderData}
                 imageGeneratorData={imageGeneratorData}
                 academicSearchData={academicSearchData}
                 xSearchData={xSearchData}
                 youTubeSearchData={youTubeSearchData}
                 youTubeLinkAnalysisData={youTubeLinkAnalysisData}
                 messageId={messageId}
                 togglePanel={togglePanel}
                 contentOnly={true}
               />
            )}
          </div>
          
          
        </div>
      </div>
    </div>
  );
};
