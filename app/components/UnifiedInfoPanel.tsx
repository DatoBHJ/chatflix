import React, { useCallback, useMemo, useEffect } from 'react';
import { Brain as BrainIOS } from 'react-ios-icons';
import { ReasoningSection } from './ReasoningSection';

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
  webSearchData?: any;
  mathCalculationData?: any;
  linkReaderData?: any;
  imageGeneratorData?: any;
  geminiImageData?: any;
  seedreamImageData?: any;
  qwenImageData?: any;
  wan25VideoData?: any;
  grokVideoData?: any;
  twitterSearchData?: any;
  youTubeSearchData?: any;
  youTubeLinkAnalysisData?: any;
  googleSearchData?: any;
  messageId: string;
  togglePanel?: (messageId: string, type: 'canvas' | 'structuredResponse', fileIndex?: number, toolType?: string, fileName?: string) => void;
  activePanel?: { messageId: string; type: string; toolType?: string } | null;
  searchTerm?: string | null; // 🚀 FEATURE: Add search term for highlighting
  useInterleavedMode?: boolean; // 🚀 인터리브 모드에서는 도구 미리보기 숨김
  chatId?: string;
  userId?: string;
}

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

    case 'twitterSearch':
      if (Array.isArray(toolData.results) && toolData.results.length > 0) {
        const hasComplete = toolData.results.some((r: any) => r && r.isComplete === true);
        if (hasComplete) return false;
        const allIncomplete = toolData.results.every((r: any) => r && r.isComplete === false);
        if (allIncomplete) return true;
      }
      if (toolData.annotations && toolData.annotations.length > 0) {
        const hasTwitterComplete = toolData.annotations.some((a: any) => a.type === 'twitter_search_complete');
        if (!hasTwitterComplete) return true;
      }
      return false;

    case 'youTubeSearch':
      // YouTube Search: 결과가 하나라도 있으면 로딩 해제
      if (Array.isArray(toolData.youtubeResults) && toolData.youtubeResults.length > 0) return false;
      // pendingCount가 있으면 로딩 중
      if (toolData.pendingCount && toolData.pendingCount > 0) return true;
      // status가 processing이면 로딩 중
      if (toolData.status === 'processing' || toolData.status === 'in_progress') return true;
      // startedCount가 있지만 결과가 없으면 로딩 중
      if (toolData.startedCount && toolData.startedCount > 0 && (!toolData.youtubeResults || toolData.youtubeResults.length === 0)) return true;
      // youtubeResults가 빈 배열이면 로딩 중 (started 신호가 있었을 가능성)
      if (toolData.youtubeResults && toolData.youtubeResults.length === 0) return true;
      return false;

    case 'youTubeAnalyzer':
      // YouTube Analyzer: 완료(세부정보 또는 에러)가 하나라도 있으면 로딩 해제
      if (Array.isArray(toolData.analysisResults) && toolData.analysisResults.length > 0) {
        const hasComplete = toolData.analysisResults.some((r: any) => r?.details || r?.error);
        if (hasComplete) return false;
        const hasIncomplete = toolData.analysisResults.some((r: any) => !r?.error && !r?.details);
        if (hasIncomplete) return true;
      }
      // pendingCount가 있으면 로딩 중
      if (toolData.pendingCount && toolData.pendingCount > 0) return true;
      // status가 processing이면 로딩 중
      if (toolData.status === 'processing' || toolData.status === 'in_progress') return true;
      // startedCount가 있지만 결과가 없으면 로딩 중
      if (toolData.startedCount && toolData.startedCount > 0 && (!toolData.analysisResults || toolData.analysisResults.length === 0)) return true;
      // analysisResults가 빈 배열이면 로딩 중 (started 신호가 있었을 가능성)
      if (toolData.analysisResults && toolData.analysisResults.length === 0) return true;
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

    case 'seedreamImage':
      // Seedream Image: 이미지가 생성되면 로딩 해제
      if (Array.isArray(toolData.generatedImages) && toolData.generatedImages.length > 0) return false;
      if (toolData.generatedImages && toolData.generatedImages.length === 0) return true;
      if (toolData.status === 'processing' || toolData.status === 'in_progress') return true;
      return false;

    case 'qwenImage':
      // Qwen Image: 이미지가 생성되면 로딩 해제
      if (Array.isArray(toolData.generatedImages) && toolData.generatedImages.length > 0) return false;
      if (toolData.generatedImages && toolData.generatedImages.length === 0) return true;
      if (toolData.status === 'processing' || toolData.status === 'in_progress') return true;
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
  webSearchData,
  mathCalculationData,
  linkReaderData,
  imageGeneratorData,
  geminiImageData,
  seedreamImageData,
  qwenImageData,
  wan25VideoData,
  grokVideoData,
  twitterSearchData,
  youTubeSearchData,
  youTubeLinkAnalysisData,
  googleSearchData,
  messageId,
  togglePanel,
  activePanel,
  searchTerm, // 🚀 FEATURE: Add search term for highlighting
  useInterleavedMode = false, // 🚀 인터리브 모드에서는 도구 미리보기 숨김
  chatId,
  userId
}) => {

  // 실제 도구 데이터 기반으로 로딩 상태 감지
  const actualToolLoadingState = useMemo(() => {
    const toolStates = {
      webSearch: isToolLoading(webSearchData, 'webSearch'),
      mathCalculation: isToolLoading(mathCalculationData, 'mathCalculation'),
      linkReader: isToolLoading(linkReaderData, 'linkReader'),
      imageGenerator: isToolLoading(imageGeneratorData, 'imageGenerator'),
      geminiImage: isToolLoading(geminiImageData, 'geminiImage'),
      seedreamImage: isToolLoading(seedreamImageData, 'seedreamImage'),
      qwenImage: isToolLoading(qwenImageData, 'qwenImage'),
      twitterSearch: isToolLoading(twitterSearchData, 'twitterSearch'),
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
  }, [webSearchData, mathCalculationData, linkReaderData, imageGeneratorData, geminiImageData, seedreamImageData, qwenImageData, twitterSearchData, youTubeSearchData, youTubeLinkAnalysisData, googleSearchData]);

  // 실제 도구 로딩 상태를 포함한 전체 로딩 상태
  const isLoading = !hasAnyContent || actualToolLoadingState.isLoadingAnyTool || isStreaming;
  const key = isLoading ? loadingReasoningKey : completeReasoningKey;
  const overrideState = userOverrideReasoningPartRef.current[key];
  // 사용자 오버라이드가 있으면 그것을 사용, 없으면 reasoningPartExpanded 상태를 확인,
  // 그것도 없으면 스트리밍 중이면 기본적으로 열림
  const isReasoningExpanded = typeof overrideState === 'boolean' 
    ? overrideState  // 사용자가 수동으로 설정한 경우
    : (reasoningPartExpanded[key] ?? (isStreaming || isReasoningInProgress));  // 기본값: 스트리밍 중이면 열림

  const handleReasoningToggle = useCallback((expanded: boolean) => {
    setReasoningPartExpanded(prev => ({
      ...prev,
      [loadingReasoningKey]: expanded,
      [completeReasoningKey]: expanded,
    }));
    userOverrideReasoningPartRef.current = {
      ...userOverrideReasoningPartRef.current,
      [loadingReasoningKey]: expanded,
      [completeReasoningKey]: expanded,
    };
  }, [loadingReasoningKey, completeReasoningKey, setReasoningPartExpanded, userOverrideReasoningPartRef]);

  const handleToggleClick = useCallback(() => {
    handleReasoningToggle(!isReasoningExpanded);
  }, [handleReasoningToggle, isReasoningExpanded]);

  const dynamicReasoningTitle = 'Reasoning Process';

  const hasReasoning = reasoningPart && isAssistant;

  if (!hasReasoning) {
    return null;
  }

  return (
    <>
      <style>{shimmerStyles}</style>
      <div className="pl-0 mb-2">
      <div className="pb-2 sm:pb-2 pr-8 sm:pr-0">
        {hasReasoning && (
          <div className="mt-12  text-base text-[var(--muted)]">
            {hasReasoning && (
              <div className="mb-8">
                <div className="mb-5 text-base font-normal text-[var(--muted)] pl-1.5">Thinking</div>
                <div className="space-y-3 pl-2">
                  <button
                    onClick={handleToggleClick}
                    className="flex items-center gap-2 cursor-pointer group"
                  >
                    <div className="text-[var(--muted)] group-hover:text-[var(--foreground)] transition-colors">
                      <BrainIOS className="w-5 h-5" />
                    </div>
                    
                    <span
                      className={`text-base font-medium text-[var(--foreground)] flex items-center gap-2 ${
                        isReasoningInProgress
                          ? 'bg-gradient-to-r from-transparent via-gray-400 to-transparent bg-clip-text text-transparent'
                          : ''
                      }`}
                      style={
                        isReasoningInProgress
                          ? {
                              backgroundSize: '200% 100%',
                              animation: 'shimmer 2s ease-in-out infinite'
                            }
                          : {}
                      }
                    >
                      {dynamicReasoningTitle}
                      <svg
                        className={`w-3.5 h-3.5 transition-transform duration-200 ${
                          isReasoningExpanded ? 'rotate-180' : ''
                        }`}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </span>
                  </button>
                  <div className="pl-1.5">
                    <ReasoningSection
                      content={reasoningPart.reasoningText || reasoningPart.text}
                      isComplete={reasoningComplete}
                      hideToggle={true}
                      isExpanded={isReasoningExpanded}
                      onExpandedChange={handleReasoningToggle}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      </div>
    </>
  );
};





