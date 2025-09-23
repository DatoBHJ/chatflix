import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Brain } from 'lucide-react';
import { ReasoningSection } from './ReasoningSection';
import { CanvasToolsPreview } from './Canvas/CanvasToolsPreview';
import { highlightSearchTerm } from '@/app/utils/searchHighlight';

// Shimmer animation styles
const shimmerStyles = `
  @keyframes shimmer {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }
`;

interface UnifiedInfoPanelProps {
  reasoningPart?: any;
  isAssistant: boolean;
  hasAnyContent: boolean;
  isWaitingForToolResults: boolean;
  isStreaming: boolean;
  reasoningComplete: boolean;
  isReasoningInProgress: boolean;
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
  xSearchData?: any;
  youTubeSearchData?: any;
  youTubeLinkAnalysisData?: any;
  googleSearchData?: any;
  messageId: string;
  togglePanel?: (messageId: string, type: 'canvas' | 'structuredResponse', fileIndex?: number, toolType?: string, fileName?: string) => void;
  activePanel?: { messageId: string; type: string; toolType?: string } | null;
  messageTitle?: string;
  searchTerm?: string | null; // 🚀 FEATURE: Add search term for highlighting
  message?: any; // 🚀 Add message prop to detect title generation started
}

// 제목 생성 시작 신호를 감지하는 헬퍼 함수
const isTitleGenerationStarted = (message: any): boolean => {
  if (!message) return false;
  
  // parts에서 title generation started 신호 확인
  if (message.parts && Array.isArray(message.parts)) {
    const titleStartPart = message.parts.find((part: any) => 
      part.type === 'data-title_generation_started'
    );
    if (titleStartPart) return true;
  }
  
  // annotations에서도 확인 (fallback)
  if (message.annotations && Array.isArray(message.annotations)) {
    const titleStartAnnotation = message.annotations.find((annotation: any) => 
      annotation.type === 'title_generation_started'
    );
    if (titleStartAnnotation) return true;
  }
  
  return false;
};

// 도구별 로딩 상태를 감지하는 헬퍼 함수
const isToolLoading = (toolData: any, toolType: string): boolean => {
  if (!toolData) return false;

  switch (toolType) {
    case 'webSearch':
      // Web Search: 결과 우선 판단 → 하나라도 완료 결과가 있으면 로딩 아님
      if (Array.isArray(toolData.results)) {
        if (toolData.results.length === 0) {
          // results는 있지만 비어있으면 로딩
          return true;
        }
        // 결과 중 하나라도 완료면 로딩 해제
        const hasComplete = toolData.results.some((r: any) => r && r.isComplete === true);
        if (hasComplete) return false;
        // 모든 결과가 미완료면 로딩
        const allIncomplete = toolData.results.every((r: any) => r && r.isComplete === false);
        if (allIncomplete) return true;
      }
      // 결과가 아직 없고 args만 있으면 로딩으로 간주
      if (toolData.args && (!toolData.results || toolData.results.length === 0)) {
        return true;
      }
      // 마지막으로, 어노테이션만 있는 경우에 한해 로딩으로 간주 (완료 신호가 없을 때만)
      if (toolData.annotations && toolData.annotations.length > 0) {
        const hasQueryCompletion = toolData.annotations.some((a: any) => a.type === 'query_completion');
        const hasWebSearchComplete = toolData.annotations.some((a: any) => a.type === 'web_search_complete');
        if (hasQueryCompletion && !hasWebSearchComplete) return true;
      }
      return false;

    case 'mathCalculation':
      // Math Calculation: 결과가 생기면 로딩 해제
      if (Array.isArray(toolData.calculationSteps) && toolData.calculationSteps.length > 0) {
        return false;
      }
      if (toolData.calculationSteps && toolData.calculationSteps.length === 0) return true;
      if (toolData.status === 'processing' || toolData.status === 'in_progress') return true;
      return false;

    case 'linkReader':
      // Link Reader: 성공 시도가 하나라도 있으면 로딩 해제
      if (Array.isArray(toolData.linkAttempts)) {
        if (toolData.linkAttempts.length === 0) return true;
        const hasSuccess = toolData.linkAttempts.some((attempt: any) => 
          attempt?.status === 'success' || (!!attempt?.title && !attempt?.error)
        );
        if (hasSuccess) return false;
        const hasInProgress = toolData.linkAttempts.some((attempt: any) => 
          attempt?.status === 'in_progress' || attempt?.status === 'processing'
        );
        if (hasInProgress) return true;
        // 실패만 있는 경우 로딩 아님
        return false;
      }
      return false;

    case 'imageGenerator':
      // Image Generator: 이미지가 생성되면 로딩 해제
      if (Array.isArray(toolData.generatedImages) && toolData.generatedImages.length > 0) return false;
      if (toolData.generatedImages && toolData.generatedImages.length === 0) return true;
      if (toolData.status === 'processing' || toolData.status === 'in_progress') return true;
      return false;

    case 'xSearch':
      // X Search: 결과가 하나라도 있으면 로딩 해제
      if (Array.isArray(toolData.xResults) && toolData.xResults.length > 0) return false;
      if (toolData.xResults && toolData.xResults.length === 0) return true;
      if (toolData.status === 'processing' || toolData.status === 'in_progress') return true;
      return false;

    case 'youTubeSearch':
      // YouTube Search: 결과가 하나라도 있으면 로딩 해제
      if (Array.isArray(toolData.youtubeResults) && toolData.youtubeResults.length > 0) return false;
      if (toolData.youtubeResults && toolData.youtubeResults.length === 0) return true;
      if (toolData.status === 'processing' || toolData.status === 'in_progress') return true;
      return false;

    case 'youTubeAnalyzer':
      // YouTube Analyzer: 완료(세부정보 또는 에러)가 하나라도 있으면 로딩 해제
      if (Array.isArray(toolData.analysisResults)) {
        if (toolData.analysisResults.length === 0) return true;
        const hasComplete = toolData.analysisResults.some((r: any) => r?.details || r?.error);
        if (hasComplete) return false;
        const hasIncomplete = toolData.analysisResults.some((r: any) => !r?.error && !r?.details);
        if (hasIncomplete) return true;
      }
      if (toolData.status === 'processing' || toolData.status === 'in_progress') return true;
      return false;

    case 'googleSearch':
      // Google Search: 결과가 하나라도 있으면 로딩 해제
      if (Array.isArray(toolData.results) && toolData.results.length > 0) {
        // 결과 중 하나라도 완료면 로딩 해제
        const hasComplete = toolData.results.some((r: any) => r && r.isComplete === true);
        if (hasComplete) return false;
        // 모든 결과가 미완료면 로딩
        const allIncomplete = toolData.results.every((r: any) => r && r.isComplete === false);
        if (allIncomplete) return true;
      }
      // 결과가 아직 없고 args만 있으면 로딩으로 간주
      if (toolData.args && (!toolData.results || toolData.results.length === 0)) {
        return true;
      }
      // 마지막으로, 어노테이션만 있는 경우에 한해 로딩으로 간주 (완료 신호가 없을 때만)
      if (toolData.annotations && toolData.annotations.length > 0) {
        const hasQueryCompletion = toolData.annotations.some((a: any) => a.type === 'google_search_started');
        const hasGoogleSearchComplete = toolData.annotations.some((a: any) => a.type === 'google_search_complete');
        if (hasQueryCompletion && !hasGoogleSearchComplete) return true;
      }
      return false;

    default:
      return false;
  }
};

export const UnifiedInfoPanel: React.FC<UnifiedInfoPanelProps> = ({
  reasoningPart,
  isAssistant,
  hasAnyContent,
  isWaitingForToolResults,
  isStreaming,
  reasoningComplete,
  isReasoningInProgress,
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
  xSearchData,
  youTubeSearchData,
  youTubeLinkAnalysisData,
  googleSearchData,
  messageId,
  togglePanel,
  activePanel,
  messageTitle,
  searchTerm, // 🚀 FEATURE: Add search term for highlighting
  message, // 🚀 Add message prop to detect title generation started
}) => {
  const [thinkingStartTime, setThinkingStartTime] = useState<number | null>(null);
  const [isThinkingModalOpen, setIsThinkingModalOpen] = useState(false);

  // 실제 도구 데이터 기반으로 로딩 상태 감지
  const actualToolLoadingState = useMemo(() => {
    const toolStates = {
      webSearch: isToolLoading(webSearchData, 'webSearch'),
      mathCalculation: isToolLoading(mathCalculationData, 'mathCalculation'),
      linkReader: isToolLoading(linkReaderData, 'linkReader'),
      imageGenerator: isToolLoading(imageGeneratorData, 'imageGenerator'),
      xSearch: isToolLoading(xSearchData, 'xSearch'),
      youTubeSearch: isToolLoading(youTubeSearchData, 'youTubeSearch'),
      youTubeAnalyzer: isToolLoading(youTubeLinkAnalysisData, 'youTubeAnalyzer'),
      googleSearch: isToolLoading(googleSearchData, 'googleSearch'),
    };

    const isLoadingAnyTool = Object.values(toolStates).some(Boolean);
    const loadingTools = Object.entries(toolStates)
      .filter(([_, isLoading]) => isLoading)
      .map(([toolName, _]) => toolName);

    return {
      isLoadingAnyTool,
      loadingTools,
      toolStates
    };
  }, [webSearchData, mathCalculationData, linkReaderData, imageGeneratorData, xSearchData, youTubeSearchData, youTubeLinkAnalysisData, googleSearchData]);

  // 제목이 도착하기 전까지 현재 상태를 간단히 표시
  const derivedTitle = useMemo(() => {
    if (messageTitle) return highlightSearchTerm(messageTitle, searchTerm || null);
    if (isReasoningInProgress) return 'Thinking...';
    
    // 실제 도구 로딩 상태 기반으로 제목 표시
    if (actualToolLoadingState.isLoadingAnyTool) {
      const toolCount = actualToolLoadingState.loadingTools.length;
      if (toolCount === 1) {
        const toolName = actualToolLoadingState.loadingTools[0];
        const toolDisplayNames: { [key: string]: string } = {
          webSearch: 'Searching',
          mathCalculation: 'Calculating',
          linkReader: 'Reading Links',
          imageGenerator: 'Generating Images',
          xSearch: 'Searching X/Twitter',
          youTubeSearch: 'Searching YouTube',
          youTubeAnalyzer: 'Analyzing YouTube',
          googleSearch: 'Searching Google'
        };
        return toolDisplayNames[toolName] || 'Using Tools...';
      } else {
        return `Using ${toolCount} Tools...`;
      }
    }
    
    // 제목 생성 시작 신호가 있으면 "Generating Title..." 표시
    if (isTitleGenerationStarted(message) && !messageTitle) {
      return 'Generating Title...';
    }
    
    if (isStreaming) return 'Answering...';
    return null; // 일반 모드에서 reasoning 완료 후에는 제목을 표시하지 않음
  }, [messageTitle, searchTerm, isReasoningInProgress, actualToolLoadingState, isStreaming, hasAnyContent, message]);

  // 실제 도구 로딩 상태를 포함한 전체 로딩 상태
  const isLoading = !hasAnyContent || actualToolLoadingState.isLoadingAnyTool || isStreaming;
  const key = isLoading ? loadingReasoningKey : completeReasoningKey;

  const handleReasoningToggle = useCallback((expanded: boolean) => {
    setReasoningPartExpanded(prev => ({ ...prev, [key]: expanded }));
    userOverrideReasoningPartRef.current = { ...userOverrideReasoningPartRef.current, [key]: expanded };
  }, [key, setReasoningPartExpanded, userOverrideReasoningPartRef]);

  const handleToggleClick = useCallback(() => {
    setIsThinkingModalOpen(true);
  }, []);

  useEffect(() => {
    if (isAssistant && reasoningPart && !thinkingStartTime) {
      setThinkingStartTime(Date.now());
    }
  }, [isAssistant, reasoningPart, thinkingStartTime]);

  const hasReasoning = reasoningPart && isAssistant;
  const hasCanvas = hasActualCanvasData && isAssistant;
  const hasTitle = isAssistant && messageTitle; // 백엔드에서 제목을 전송한 경우에만 제목 표시
  const shouldShowTitle = derivedTitle !== null; // derivedTitle이 null이면 제목 영역 숨김

  if (!hasReasoning && !hasCanvas && !hasTitle && !shouldShowTitle) {
    return null;
  }

  return (
    <>
      <style>{shimmerStyles}</style>
      <div className="pl-0 mb-2">
      <div className="pt-12 sm:pt-16 pb-2 sm:pb-2 pr-8 sm:pr-0">
        {shouldShowTitle && (
          <div className="flex items-center gap-3">
            <h2
              className={`text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight break-keep text-balance ${
                !messageTitle ? 'text-[var(--accent)]' : 'text-[var(--foreground)]'
              } ${!(hasReasoning || hasCanvas) ? 'mb-8' : ''}`}
              style={{ wordBreak: 'keep-all' }}
            >
              {derivedTitle}
            </h2>
          </div>
        )}
        
        {(hasReasoning || hasCanvas) && (
          <div className="mt-12  text-base text-[var(--muted)]">
            {hasReasoning && (
              <div className="mb-8">
                <div className="mb-5 text-base font-normal text-[var(--muted)] pl-1.5">Thinking</div>
                <div className="space-y-3 pl-1.5">
                  <button
                    onClick={handleToggleClick}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <div className="text-[var(--muted)] group-hover:text-[var(--foreground)] transition-colors">
                      <Brain size={14} />
                    </div>
                    
                    <span className={`text-base font-medium text-[var(--foreground)] ${
                      isReasoningInProgress 
                        ? 'bg-gradient-to-r from-transparent via-gray-400 to-transparent bg-clip-text text-transparent' 
                        : ''
                    }`}
                    style={isReasoningInProgress ? {
                      backgroundSize: '200% 100%',
                      animation: 'shimmer 2s ease-in-out infinite'
                    } : {}}
                    >
                      Reasoning Process
                    </span>
                  </button>
                </div>
              </div>
            )}
            
            {hasCanvas && (
              <div>
                <div className="mb-5 text-base font-normal text-[var(--muted)] pl-1.5">Tools</div>
                <CanvasToolsPreview
                  webSearchData={webSearchData}
                  mathCalculationData={mathCalculationData}
                  linkReaderData={linkReaderData}
                  imageGeneratorData={imageGeneratorData}
                  xSearchData={xSearchData}
                  youTubeSearchData={youTubeSearchData}
                  youTubeLinkAnalysisData={youTubeLinkAnalysisData}
                  googleSearchData={googleSearchData}
                  messageId={messageId}
                  togglePanel={togglePanel}
                  hideToggle={true}
                  activePanel={activePanel}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {isThinkingModalOpen && (
        <ReasoningSection 
          content={reasoningPart.reasoningText || reasoningPart.text} 
          isComplete={reasoningComplete}
          startTime={thinkingStartTime}
          key={`thinking-modal-${key}`}
          hideToggle={true}
          onModalClose={() => setIsThinkingModalOpen(false)}
        />
      )}
      </div>
    </>
  );
};

