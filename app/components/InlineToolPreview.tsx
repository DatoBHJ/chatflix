
'use client';

import React, { memo, useMemo, useCallback, useState, useRef } from 'react';
import { Calculator, Link2, ImageIcon, Search, Youtube, Video } from 'lucide-react';
import { SiGoogle } from 'react-icons/si';
import { XLogo, YouTubeLogo, WanAiLogo, SeedreamLogo } from './CanvasFolder/CanvasLogo';
import { getTopicIconComponent, getTopicName, getTopicIcon } from './MultiSearch';

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

// Tool name to display name mapping
const TOOL_DISPLAY_NAMES: Record<string, string> = {
  'web_search': 'Web Search',
  'multi_search': 'Web Search',
  'calculator': 'Calculator',
  'math_calculation': 'Calculator',
  'link_reader': 'Link Reader',
  'gemini_image_tool': 'Nano Banana Pro',
  'seedream_image_tool': 'Seedream 4.5',
  'qwen_image_edit': 'Qwen Image Edit',
  'twitter_search': 'X Search',
  'youtube_search': 'YouTube Search',
  'youtube_link_analysis': 'YouTube Analyzer',
  'youtube_link_analyzer': 'YouTube Analyzer',
  'google_search': 'Google Search',
  'wan25_video': 'Wan 2.5 Video',
};

// Tool name to icon mapping
const getToolIcon = (toolName: string, toolArgs?: any, toolResult?: any) => {
  const iconProps = { size: 14, strokeWidth: 1.5 };
  
  switch (toolName) {
    case 'web_search':
    case 'multi_search': {
      // Use topic-based icon for web search if available
      // 1. toolArgs에서 topics 확인
      // 2. toolResult에서 실제 사용된 topic 확인 (forcedTopic이 설정된 경우)
      // 3. 기본값 'general'
      let topic = toolArgs?.topics?.[0] || toolArgs?.topic;
      
      // toolArgs에 topics가 없고 toolResult가 있으면, toolResult에서 topic 추출
      if (!topic && toolResult?.searches && Array.isArray(toolResult.searches) && toolResult.searches.length > 0) {
        topic = toolResult.searches[0].topic;
      }
      
      topic = topic || 'general';
      const topicIcon = getTopicIcon(topic);
      return getTopicIconComponent(topicIcon);
    }
    case 'google_search': {
      // Use topic-based icon for google search
      // engines 배열이 있으면 첫 번째 엔진을 topic으로 사용, 없으면 topic 또는 기본값 'google'
      const topic = toolArgs?.engines?.[0] || toolArgs?.topic || toolArgs?.engine || 'google';
      const topicIcon = getTopicIcon(topic);
      return getTopicIconComponent(topicIcon);
    }
    case 'calculator':
    case 'math_calculation':
      return <Calculator {...iconProps} />;
    case 'link_reader':
      return <Link2 {...iconProps} />;
    case 'gemini_image_tool':
      return <SiGoogle strokeWidth={0.5} size={14} />;
    case 'seedream_image_tool':
      return <SeedreamLogo size={14} />;
    case 'qwen_image_edit':
      return <WanAiLogo size={14} />;
    case 'youtube_search':
      return <YouTubeLogo size={iconProps.size} />;
    case 'youtube_link_analysis':
    case 'youtube_link_analyzer':
      return <Youtube {...iconProps} />;
    case 'twitter_search':
      return <XLogo size={iconProps.size} />;
    case 'wan25_video':
      return <WanAiLogo size={iconProps.size} />;
    default:
      return <Search {...iconProps} />;
  }
};

// Tool name to Canvas toolType mapping for togglePanel
const getCanvasToolType = (toolName: string, toolArgs?: any, toolResult?: any): string => {
  switch (toolName) {
    case 'web_search':
    case 'multi_search': {
      // toolArgs에서 topics 확인, 없으면 toolResult에서 추출
      let topic = toolArgs?.topics?.[0] || toolArgs?.topic;
      
      // toolArgs에 topics가 없고 toolResult가 있으면, toolResult에서 topic 추출
      if (!topic && toolResult?.searches && Array.isArray(toolResult.searches) && toolResult.searches.length > 0) {
        topic = toolResult.searches[0].topic;
      }
      
      topic = topic || 'general';
      return `web-search:topic:${topic}`;
    }
    case 'google_search': {
      // engines 배열이 있으면 첫 번째 엔진을 topic으로 사용
      const topic = toolArgs?.engines?.[0] || toolArgs?.topic || toolArgs?.engine || 'google';
      return `google-search:topic:${topic}`;
    }
    case 'calculator':
    case 'math_calculation':
      return 'calculator';
    case 'link_reader':
      return 'link-reader';
    case 'gemini_image_tool':
      return 'gemini-image';
    case 'seedream_image_tool':
      return 'seedream-image';
    case 'qwen_image_edit':
      return 'qwen-image';
    case 'twitter_search':
      return 'twitter_search';
    case 'youtube_search':
      return 'youtube-search';
    case 'youtube_link_analysis':
    case 'youtube_link_analyzer':
      return 'youtube-analyzer';
    case 'wan25_video':
      return 'wan25-video';
    default:
      return toolName;
  }
};

interface InlineToolPreviewProps {
  toolName: string;
  toolArgs?: any;
  toolResult?: any;
  messageId: string;
  togglePanel?: (messageId: string, type: 'canvas' | 'structuredResponse', fileIndex?: number, toolType?: string, fileName?: string) => void;
  activePanel?: { messageId: string; type: string; toolType?: string } | null;
  isProcessing?: boolean;
}

export const InlineToolPreview = memo(function InlineToolPreview({
  toolName,
  toolArgs,
  toolResult,
  messageId,
  togglePanel,
  activePanel,
  isProcessing = false,
}: InlineToolPreviewProps) {
  // Determine status
  const status = useMemo(() => {
    if (isProcessing) return 'processing';
    
    // 이미지 생성 도구: success 필드와 실제 이미지 데이터 확인
    if (toolName === 'gemini_image_tool' || toolName === 'seedream_image_tool' || toolName === 'qwen_image_edit') {
      if (toolResult) {
        // 명시적 실패 케이스
        if (toolResult.success === false) {
          return 'error';
        }
        // 성공 케이스: 이미지 데이터 확인
        const hasImage = toolResult.imageUrl || 
                        toolResult.path || 
                        (toolResult.images && toolResult.images.length > 0);
        return hasImage ? 'completed' : 'processing';
      }
      return 'processing';
    }
    
    // 비디오 생성 도구: success 필드와 실제 비디오 데이터 확인
    if (toolName === 'wan25_video') {
      if (toolResult) {
        if (toolResult.success === false) {
          return 'error';
        }
        const hasVideo = toolResult.videoUrl || 
                        toolResult.path || 
                        (toolResult.videos && toolResult.videos.length > 0);
        return hasVideo ? 'completed' : 'processing';
      }
      return 'processing';
    }
    
    // 기타 도구는 기존 로직 유지
    if (toolResult) return 'completed';
    return 'processing';
  }, [isProcessing, toolResult, toolName]);

  // Get display name and icon (with topic support for search tools)
  const displayName = useMemo(() => {
    // Use topic-based names for search tools
    if (toolName === 'web_search' || toolName === 'multi_search') {
      // toolArgs에서 topics 확인, 없으면 toolResult에서 추출
      let topic = toolArgs?.topics?.[0] || toolArgs?.topic;
      
      // toolArgs에 topics가 없고 toolResult가 있으면, toolResult에서 topic 추출
      if (!topic && toolResult?.searches && Array.isArray(toolResult.searches) && toolResult.searches.length > 0) {
        topic = toolResult.searches[0].topic;
      }
      
      if (topic) {
        return getTopicName(topic);
      }
    }
    if (toolName === 'google_search') {
      // engines 배열이 있으면 첫 번째 엔진을 topic으로 사용
      const topic = toolArgs?.engines?.[0] || toolArgs?.topic || toolArgs?.engine || 'google';
      return getTopicName(topic);
    }
    // wan25_video: model에 따라 동적 이름
    if (toolName === 'wan25_video') {
      return toolArgs?.model === 'image-to-video' 
        ? 'Wan 2.5 Image to Video' 
        : 'Wan 2.5 Text to Video';
    }
    return TOOL_DISPLAY_NAMES[toolName] || toolName;
  }, [toolName, toolArgs]);

  const icon = getToolIcon(toolName, toolArgs, toolResult); // Pass toolArgs and toolResult for topic-based icons
  const canvasToolType = getCanvasToolType(toolName, toolArgs, toolResult); // Pass toolArgs and toolResult for topic-based routing

  // Extract display text from args
  const displayText = useMemo(() => {
    if (!toolArgs) return '';
    
    // Handle different tool argument structures
    if (toolArgs.queries && Array.isArray(toolArgs.queries)) {
      return toolArgs.queries.map((q: string) => `"${q}"`).join(', ');
    }
    if (toolArgs.query) {
      return `"${toolArgs.query}"`;
    }
    if (toolArgs.expression) {
      return toolArgs.expression;
    }
    // Handle YouTube link analyzer URLs array
    if (toolArgs.urls && Array.isArray(toolArgs.urls)) {
      if (toolArgs.urls.length === 1) {
        try {
          const domain = new URL(toolArgs.urls[0]).hostname.replace('www.', '');
          return domain;
        } catch {
          return toolArgs.urls[0];
        }
      } else {
        try {
          const firstDomain = new URL(toolArgs.urls[0]).hostname.replace('www.', '');
          return `${firstDomain} (+${toolArgs.urls.length - 1} more)`;
        } catch {
          return `${toolArgs.urls.length} URLs`;
        }
      }
    }
    if (toolArgs.url) {
      try {
        const domain = new URL(toolArgs.url).hostname.replace('www.', '');
        return domain;
      } catch {
        return toolArgs.url;
      }
    }
    if (toolArgs.prompt) {
      return toolArgs.prompt.length > 50 
        ? toolArgs.prompt.substring(0, 50) + '...' 
        : toolArgs.prompt;
    }
    return '';
  }, [toolArgs]);

  // 롱프레스와 클릭 구분을 위한 상태
  const [touchStartTime, setTouchStartTime] = useState<number>(0);
  const [isLongPressing, setIsLongPressing] = useState(false);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Extract item identifier from toolArgs for filtering
  const itemIdentifier = useMemo(() => {
    if (!toolArgs) return undefined;
    
    // For search tools: use query/queries (prefer query field, fallback to first query in queries array)
    if (toolName === 'web_search' || toolName === 'multi_search' || toolName === 'google_search' || toolName === 'twitter_search') {
      // Prefer toolArgs.query if available (single query)
      if (toolArgs.query) {
        return toolArgs.query;
      }
      // Fallback to first query in queries array
      if (toolArgs.queries && Array.isArray(toolArgs.queries) && toolArgs.queries.length > 0) {
        return toolArgs.queries[0];
      }
    }
    
    // For link reader: use URL
    if (toolName === 'link_reader' && toolArgs.url) {
      return toolArgs.url;
    }
    
    // For YouTube link analyzer: use first URL from urls array
    if ((toolName === 'youtube_link_analyzer' || toolName === 'youtube_link_analysis') && toolArgs.urls && Array.isArray(toolArgs.urls) && toolArgs.urls.length > 0) {
      return toolArgs.urls[0];
    }
    
    // For calculator: use expression
    if ((toolName === 'calculator' || toolName === 'math_calculation') && toolArgs.expression) {
      return toolArgs.expression;
    }
    
    return undefined;
  }, [toolArgs, toolName]);

  // Handle click - 롱프레스가 아닌 경우에만 실행
  const handleClick = useCallback((e: React.MouseEvent) => {
    // 롱프레스가 활성화된 경우 클릭 무시
    if (isLongPressing) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    
    if (togglePanel) {
      // Pass item identifier as fileName parameter (repurposed for item filtering)
      togglePanel(messageId, 'canvas', undefined, canvasToolType, itemIdentifier);
    }
  }, [togglePanel, messageId, canvasToolType, itemIdentifier, isLongPressing]);

  // 터치 시작 핸들러 - 부모로 이벤트 전파하되 롱프레스 감지
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const startTime = Date.now();
    setTouchStartTime(startTime);
    setIsLongPressing(false);
    
    // 롱프레스 타이머 시작 (500ms)
    longPressTimerRef.current = setTimeout(() => {
      setIsLongPressing(true);
      // 롱프레스가 활성화되면 부모로 이벤트 전파를 위해 버블링 허용
      // 부모의 handleAITouchStart가 호출되어 롱프레스 메뉴가 표시됨
    }, 500);
    
    // 이벤트를 부모로 전파 (롱프레스 처리용)
    // stopPropagation을 호출하지 않아 부모의 터치 핸들러도 실행됨
  }, []);

  // 터치 종료 핸들러
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const touchEndTime = Date.now();
    const currentTouchStartTime = touchStartTime;
    const touchDuration = currentTouchStartTime > 0 ? touchEndTime - currentTouchStartTime : 0;
    
    // 타이머 정리
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    
    // 롱프레스가 활성화된 경우 클릭 방지
    if (isLongPressing || touchDuration >= 500) {
      setIsLongPressing(false);
      setTouchStartTime(0);
      // 롱프레스가 활성화된 경우 클릭 이벤트 방지
      e.preventDefault();
      // 부모로 이벤트 전파 (롱프레스 취소 처리용)
      return;
    }
    
    // 짧은 터치인 경우 클릭 처리 (일반 클릭은 onClick에서 처리)
    setIsLongPressing(false);
    setTouchStartTime(0);
    // 짧은 터치인 경우 부모로 이벤트 전파하지 않음 (클릭만 처리)
  }, [touchStartTime, isLongPressing]);

  // 터치 이동 핸들러 - 스크롤 감지 시 롱프레스 취소
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    // 스크롤이 감지되면 롱프레스 타이머 취소
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
      setIsLongPressing(false);
    }
  }, []);

  // 컴포넌트 언마운트 시 타이머 정리
  React.useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  // Check if this tool is currently active in the panel
  const isActive = activePanel?.messageId === messageId && 
                   activePanel?.type === 'canvas' && 
                   activePanel?.toolType === canvasToolType;

  return (
    <>
      <style>{shimmerStyles}</style>
      {/* Tool preview inside message bubble */}
      <div className="text-base md:text-sm text-(--muted) ml-1">
        <button
          onClick={handleClick}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchMove={handleTouchMove}
          className="flex items-center gap-3 cursor-pointer w-full flex-nowrap overflow-hidden"
          style={{ touchAction: 'manipulation' }}
        >
          {/* Tool icon */}
          <div className="text-(--muted) group-hover:text-(--foreground) transition-colors shrink-0">
            {icon}
          </div>
          
          {/* Tool name with shimmer effect when processing */}
          <span 
            className={`text-base md:text-sm font-medium text-(--foreground) shrink-0 ${
              status === 'processing'
                ? 'bg-linear-to-r from-transparent via-gray-400 to-transparent bg-clip-text text-transparent'
                : ''
            }`}
            style={status === 'processing' ? {
              backgroundSize: '200% 100%',
              animation: 'shimmer 2s ease-in-out infinite'
            } : {}}
          >
            {displayName}
          </span>
          
          {/* Display text */}
          {displayText && (
            <span className="text-xs text-(--muted) truncate shrink min-w-0">
              {displayText}
            </span>
          )}
          
          {/* Status indicator */}
          {status === 'processing' && (
            <span className="inline-tool-status-dot" />
          )}
          {status === 'completed' && (
            <svg 
              className="w-3.5 h-3.5 text-green-500 shrink-0" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          )}
          {status === 'error' && (
            <svg 
              className="w-3.5 h-3.5 text-red-500 shrink-0" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
        </button>
      </div>
    </>
  );
});

export default InlineToolPreview;
