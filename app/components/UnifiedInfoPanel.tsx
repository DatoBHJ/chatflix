import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Brain, Wrench } from 'lucide-react';
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
  const [thinkingStartTime, setThinkingStartTime] = useState<number | null>(null);

  const thinkingScrollRef = useRef<HTMLDivElement>(null);

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

  if (!hasReasoning && !hasCanvas) return null;

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
        <div className="flex items-center gap-2 px-3 py-2 bg-white/80 dark:bg-black/30 rounded-full backdrop-blur-xl border border-black/5 dark:border-white/10 shadow-sm hover:shadow-md hover:scale-[1.02] transition-all duration-200 ease-out">
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

        <div className="absolute -bottom-0.5 left-4 flex gap-0.5">
          <div className="w-1 h-1 bg-white/60 dark:bg-black/20 rounded-full"></div>
          <div className="w-0.5 h-0.5 bg-white/40 dark:bg-black/15 rounded-full"></div>
        </div>

        <div className={`absolute top-full left-0 mt-3 w-72 sm:w-96 bg-white/95 dark:bg-black/90 backdrop-blur-xl rounded-2xl border border-black/8 dark:border-white/10 shadow-xl p-4 z-50 transition-all duration-200 ease-out ${isExpanded ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-1 pointer-events-none'}`}>
          <div className="absolute -top-1.5 left-6 w-3 h-3 bg-white/95 dark:bg-black/90 border-l border-t border-black/8 dark:border-white/10 rotate-45"></div>
          
          <div className="flex items-center gap-1 mb-3 bg-[var(--accent)] rounded-lg p-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleTabChange('thinking');
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex-1 justify-center ${activeTab === 'thinking' ? 'bg-[var(--background)] shadow-sm' : 'text-[var(--muted)] hover:text-[var(--foreground)]'}`}
              style={{ color: activeTab === 'thinking' ? 'var(--reasoning-color)' : undefined }}
            >
              <Brain className="h-3.5 w-3.5" strokeWidth={2} />
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
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex-1 justify-center ${activeTab === 'tools' ? 'bg-[var(--background)] shadow-sm' : 'text-[var(--muted)] hover:text-[var(--foreground)]'}`}
              style={{ color: activeTab === 'tools' ? 'var(--tools-color)' : undefined }}
            >
              <Wrench className="h-3.5 w-3.5" strokeWidth={2} />
              <span>Tools</span>
              {hasProcessingTool && (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                </span>
              )}
            </button>
          </div>
          
          <div className="max-h-64 overflow-y-auto scrollbar-thin">
            {activeTab === 'thinking' ? (
              <div 
                ref={thinkingScrollRef}
                className="text-sm text-[var(--foreground)] leading-relaxed max-h-64 overflow-y-auto scrollbar-thin scroll-smooth"
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
