
'use client';

import React, { memo, useMemo, useCallback, useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Calculator, Link2, ImageIcon, Search, Youtube, Video, FileText, Code2, Copy, Download } from 'lucide-react';
import { SiGoogle } from 'react-icons/si';
import { getIcon } from 'material-file-icons';
import { XLogo, YouTubeLogo, WanAiLogo, SeedreamLogo, XaiLogo } from './CanvasFolder/CanvasLogo';
import { getTopicIconComponent, getTopicName, getTopicIcon } from './MultiSearch';
import { fileHelpers } from './ChatInput/FileUpload';
import { e2bChartToEChartsOption } from '@/app/utils/e2bChartToECharts';
import { computeDiffHunks, type DiffSummary } from '@/app/utils/diffUtils';

const E2BChartEChartsInline = dynamic(
  () => import('./charts/E2BChartECharts').then((m) => ({ default: m.E2BChartECharts })),
  { ssr: false }
);

// Outcome file tools (write/edit) - UI as result/attachment style
const OUTCOME_FILE_TOOLS = ['write_file', 'apply_edits', 'read_file', 'delete_file', 'grep_file', 'get_file_info'] as const;
const isOutcomeFileTool = (name: string): boolean =>
  (OUTCOME_FILE_TOOLS as readonly string[]).includes(name);
const isFileToolName = (name: string): boolean =>
  ([
    'read_file',
    'grep_file',
    'get_file_info',
    'list_workspace',
    'delete_file',
    'write_file',
    'apply_edits',
  ] as readonly string[]).includes(name);

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
  'grok_video': 'Grok Imagine Video',
  'read_file': 'Read file',
  'write_file': 'Write file',
  'get_file_info': 'File info',
  'list_workspace': 'List workspace',
  'delete_file': 'Delete file',
  'grep_file': 'Search in file',
  'apply_edits': 'Apply edits',
  'run_python_code': 'Run code',
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
    case 'grok_video':
      return <XaiLogo size={iconProps.size} />;
    case 'read_file':
    case 'write_file':
    case 'get_file_info':
    case 'list_workspace':
    case 'delete_file':
    case 'grep_file':
    case 'apply_edits':
      return <FileText {...iconProps} />;
    case 'run_python_code':
      return <Code2 {...iconProps} />;
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
    case 'grok_video':
      return 'grok-video';
    case 'read_file':
    case 'write_file':
    case 'get_file_info':
    case 'list_workspace':
    case 'delete_file':
    case 'grep_file':
    case 'apply_edits':
      return `file-edit:${toolName}`;
    case 'run_python_code':
      return 'run-code';
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
    
    // 파일 편집 도구
    if (toolName === 'read_file' || toolName === 'write_file' || toolName === 'get_file_info' || toolName === 'list_workspace' || toolName === 'delete_file' || toolName === 'grep_file' || toolName === 'apply_edits') {
      if (toolResult) return toolResult.success === false ? 'error' : 'completed';
      return 'processing';
    }
    // 코드 실행 도구
    if (toolName === 'run_python_code') {
      // toolResult가 있으면 성공 여부에 따라 상태 결정
      if (toolResult) return toolResult.success === false ? 'error' : 'completed';
      
      // toolResult가 없더라도 message.parts에 관련 데이터가 있으면 completed로 간주
      // (일부 환경에서 tool_results 대신 parts에 결과가 포함되는 경우 대응)
      return 'processing';
    }
    
    // 비디오 생성 도구: success 필드와 실제 비디오 데이터 확인
    if (toolName === 'wan25_video' || toolName === 'grok_video') {
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
    // wan25_video: model에 따라 동적 이름 (toolResult 우선 - forcedModel 반영)
    if (toolName === 'wan25_video') {
      const model = toolResult?.model ?? toolArgs?.model;
      const isImageToVideo =
        toolResult?.isImageToVideo ??
        toolResult?.videos?.[0]?.isImageToVideo ??
        model === 'image-to-video';
      return isImageToVideo
        ? 'Wan 2.5 Image to Video'
        : 'Wan 2.5 Text to Video';
    }
    // grok_video: model에 따라 동적 이름 (toolResult 우선 - forcedModel 반영, flicker 방지)
    if (toolName === 'grok_video') {
      const model = toolResult?.model ?? toolArgs?.model;
      const isVideoEdit = toolResult?.isVideoEdit ?? model === 'video-edit';
      const isImageToVideo = toolResult?.isImageToVideo ?? model === 'image-to-video';
      if (isVideoEdit) return 'Grok Video to Video';
      if (isImageToVideo) return 'Grok Image to Video';
      return 'Grok Text to Video';
    }
    return TOOL_DISPLAY_NAMES[toolName] || toolName;
  }, [toolName, toolArgs, toolResult]);

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
    if (toolArgs.path) {
      const p = toolArgs.path as string;
      return p.length > 40 ? p.slice(0, 40) + '…' : p;
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
    
    if ((toolName === 'read_file' || toolName === 'write_file' || toolName === 'get_file_info' || toolName === 'delete_file' || toolName === 'grep_file' || toolName === 'apply_edits') && toolArgs.path) {
      return toolArgs.path;
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

  const filePath = toolResult?.path ?? toolArgs?.path ?? '';
  const fileName = filePath ? filePath.replace(/^.*\//, '') || 'file' : 'file';
  const fileBubbleTitle = toolName === 'list_workspace' ? 'Workspace' : fileName;
  const iconNameForBubble = toolName === 'list_workspace' ? 'workspace' : fileName;

  const fileBubbleSubtitle = useMemo(() => {
    if (status === 'processing') return '…';
    if (toolName === 'read_file') {
      const start = toolArgs?.startLine ?? toolResult?.startLine;
      const end = toolArgs?.endLine ?? toolResult?.endLine;
      if (typeof start === 'number' && typeof end === 'number') return `L${start}-${end}`;
      if (typeof toolResult?.content === 'string') return fileHelpers.formatFileSize(new Blob([toolResult.content]).size);
      return '—';
    }
    if (toolName === 'write_file') {
      if (typeof toolArgs?.content === 'string') return fileHelpers.formatFileSize(new Blob([toolArgs.content]).size);
      return '—';
    }
    if (toolName === 'apply_edits') {
      if (typeof toolResult?.content === 'string') return fileHelpers.formatFileSize(new Blob([toolResult.content]).size);
      return '—';
    }
    if (toolName === 'get_file_info') {
      const size = typeof toolResult?.size === 'number' ? toolResult.size : (toolResult?.info && typeof (toolResult.info as any).size === 'number' ? (toolResult.info as any).size : undefined);
      if (size != null) return fileHelpers.formatFileSize(size);
      return filePath ? filePath : '—';
    }
    if (toolName === 'list_workspace') {
      const list = Array.isArray(toolResult?.paths) ? toolResult.paths : toolResult?.entries;
      const n = Array.isArray(list) ? list.length : 0;
      return `${n} entr${n === 1 ? 'y' : 'ies'}`;
    }
    if (toolName === 'delete_file') {
      if (toolResult?.success === false && toolResult?.error) return toolResult.error;
      return 'Deleted';
    }
    if (toolName === 'grep_file') {
      const matches = toolResult?.matches;
      const n = Array.isArray(matches) ? matches.length : (typeof toolResult?.matchesCount === 'number' ? toolResult.matchesCount : 0);
      const lines = typeof toolResult?.totalLines === 'number' ? ` · ${toolResult.totalLines} lines` : '';
      return `${n} match(es)${lines}`;
    }
    return '—';
  }, [status, toolName, toolArgs, toolResult, filePath]);

  const hasFileBubbleDownload =
    (toolName === 'write_file' && typeof toolArgs?.content === 'string') ||
    (toolName === 'apply_edits' && typeof toolResult?.content === 'string') ||
    (toolName === 'read_file' && typeof toolResult?.content === 'string') ||
    (toolName === 'grep_file' && (typeof (toolResult?.output ?? toolResult?.content) === 'string'));

  const handleFileDownload = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    let content: string | undefined;
    let name = fileName || 'download.txt';
    if (toolName === 'write_file') content = toolArgs?.content;
    else if (toolName === 'apply_edits' || toolName === 'read_file') content = toolResult?.content;
    else if (toolName === 'grep_file') content = toolResult?.output ?? toolResult?.content;
    if (typeof content !== 'string') return;
    if (toolName === 'grep_file') name = (fileName || 'grep') + '.txt';
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }, [toolName, toolArgs, toolResult, fileName]);

  const inlineSubtitle = useMemo(() => {
    if (isFileToolName(toolName) && !isOutcomeFileTool(toolName)) {
      if (displayText && fileBubbleSubtitle && fileBubbleSubtitle !== '—') {
        return `${displayText} · ${fileBubbleSubtitle}`;
      }
      return displayText || (fileBubbleSubtitle !== '—' ? fileBubbleSubtitle : '');
    }
    return displayText;
  }, [toolName, displayText, fileBubbleSubtitle]);

  // Outcome: use same labels as canvas panel title (TOOL_DISPLAY_NAMES) for consistency
  const outcomeActionLabel = useMemo(() => {
    return TOOL_DISPLAY_NAMES[toolName] ?? 'Processed';
  }, [toolName]);
  const outcomeSubtitle = fileBubbleSubtitle !== '—' ? `${outcomeActionLabel} · ${fileBubbleSubtitle}` : outcomeActionLabel;

  // run_python_code: compact outcome preview when results include chart/png
  const runCodeResults = useMemo(() => {
    if (Array.isArray(toolResult?.results)) return toolResult.results;
    // toolResult가 null이거나 results가 없을 때, toolResult 자체가 runCodeResults 배열인 경우 대응
    if (toolName === 'run_python_code' && Array.isArray(toolResult)) {
      const last = toolResult[toolResult.length - 1];
      return last?.results || [];
    }
    return [];
  }, [toolResult, toolName]);

  const runCodeStdout = useMemo(() => {
    if (Array.isArray(toolResult?.stdout)) return toolResult.stdout;
    if (toolName === 'run_python_code' && Array.isArray(toolResult)) {
      const last = toolResult[toolResult.length - 1];
      return last?.stdout || [];
    }
    return [];
  }, [toolResult, toolName]);

  const runCodeStderr = useMemo(() => {
    if (Array.isArray(toolResult?.stderr)) return toolResult.stderr;
    if (toolName === 'run_python_code' && Array.isArray(toolResult)) {
      const last = toolResult[toolResult.length - 1];
      return last?.stderr || [];
    }
    return [];
  }, [toolResult, toolName]);

  const runCodeHasChartOrPng = runCodeResults.some((r: any) => r?.png || r?.jpeg || r?.chart);
  const runCodeFirstPng = runCodeResults.find((r: any) => r?.png || r?.jpeg);
  const runCodePngCount = runCodeResults.filter((r: any) => r?.png || r?.jpeg).length;
  const runCodeSubtitle = useMemo(() => {
    if (status === 'processing') return '…';
    if (runCodePngCount > 0) return runCodePngCount === 1 ? '1 chart' : `${runCodePngCount} figures`;
    if (runCodeResults.some((r: any) => r?.chart)) return '1 chart';
    if (runCodeResults.some((r: any) => r?.text || r?.html)) return 'Text output';
    if (runCodeStdout.length > 0 || runCodeStderr.length > 0) return 'Output';
    return 'Output';
  }, [status, runCodePngCount, runCodeResults, runCodeStdout, runCodeStderr]);

  if (toolName === 'run_python_code') {
    const codeIcon = getToolIcon(toolName, toolArgs, toolResult);
    const runCodeFirstChartResult = runCodeResults.find((r: any) => r?.chart);
    const runCodeEChartsOption = runCodeFirstChartResult ? e2bChartToEChartsOption(runCodeFirstChartResult.chart) : null;
    
    // Determine best content to show
    const hasChartPreview = runCodeFirstPng || runCodeEChartsOption;
    const hasConsoleOutput = runCodeStdout.length > 0 || runCodeStderr.length > 0;
    
    return (
      <>
        <style>{shimmerStyles}</style>
        <div
          className="diff-inline-preview"
          onClick={handleClick}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchMove={handleTouchMove}
          style={{ cursor: togglePanel ? 'pointer' : 'default', touchAction: 'manipulation' }}
        >
          {/* Header - same style as file tools */}
          <div className="diff-header">
            <div className="shrink-0 text-(--muted)">{codeIcon}</div>
            <span className="diff-filename">Code output</span>
            {status === 'processing' ? (
              <span
                className="text-xs font-medium shrink-0 bg-linear-to-r from-transparent via-gray-400 to-transparent bg-clip-text text-transparent"
                style={{ backgroundSize: '200% 100%', animation: 'shimmer 2s ease-in-out infinite' }}
              >
                Running…
              </span>
            ) : (
              <span className="text-xs text-(--muted) shrink-0">{runCodeSubtitle}</span>
            )}
            {status === 'processing' && <span className="inline-tool-status-dot shrink-0" />}
            {status === 'completed' && (
              <svg className="w-3.5 h-3.5 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
            {status === 'error' && (
              <svg className="w-3.5 h-3.5 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
          </div>

          {/* Content preview */}
          {hasChartPreview ? (
            runCodeFirstPng && (runCodeFirstPng.png || runCodeFirstPng.jpeg) ? (
              <div className="p-2.5">
                <div className="rounded-lg overflow-hidden bg-[color-mix(in_srgb,var(--foreground)_3%,transparent)] flex items-center justify-center" style={{ maxHeight: 140 }}>
                  <img
                    src={runCodeFirstPng.png ? `data:image/png;base64,${runCodeFirstPng.png}` : `data:image/jpeg;base64,${runCodeFirstPng.jpeg}`}
                    alt="Chart"
                    className="max-w-full max-h-[140px] object-contain"
                  />
                </div>
              </div>
            ) : runCodeEChartsOption ? (
              <div className="p-2.5">
                <div className="rounded-lg overflow-hidden bg-[color-mix(in_srgb,var(--foreground)_3%,transparent)]">
                  <E2BChartEChartsInline option={runCodeEChartsOption} height={120} hideSaveButton />
                </div>
              </div>
            ) : null
          ) : hasConsoleOutput ? (
            <div className="diff-code">
              {runCodeStdout.slice(0, 4).map((line: string, li: number) => (
                <div key={`stdout-${li}`} className="diff-line">
                  <span className="diff-line-num">{li + 1}</span>
                  <span className="diff-line-sign" />
                  <span className="diff-line-text">{line}</span>
                </div>
              ))}
              {runCodeStderr.slice(0, 2).map((line: string, li: number) => (
                <div key={`stderr-${li}`} className="diff-line removed">
                  <span className="diff-line-num">!</span>
                  <span className="diff-line-sign" />
                  <span className="diff-line-text">{line}</span>
                </div>
              ))}
              {(runCodeStdout.length > 4 || runCodeStderr.length > 2) && (
                <div className="diff-hunk-sep">+{(runCodeStdout.length - 4) + (runCodeStderr.length - 2)} more lines</div>
              )}
            </div>
          ) : status === 'processing' && toolArgs?.code ? (
            <div className="diff-code diff-streaming">
              {toolArgs.code.split('\n').slice(0, 4).map((line: string, li: number) => (
                <div key={`code-${li}`} className="diff-line">
                  <span className="diff-line-num">{li + 1}</span>
                  <span className="diff-line-sign" />
                  <span className="diff-line-text">{line}</span>
                </div>
              ))}
              {toolArgs.code.split('\n').length > 4 && (
                <div className="diff-hunk-sep">running…</div>
              )}
            </div>
          ) : null}
        </div>
      </>
    );
  }

  // ── Diff preview for write_file / apply_edits ──
  const INLINE_MAX_LINES = 8;

  // Completed: compute real diff from originalContent + newContent
  const diffData: DiffSummary | null = useMemo(() => {
    if (!isOutcomeFileTool(toolName)) return null;
    if (status !== 'completed') return null;
    const hasOriginalField = toolResult && 'originalContent' in toolResult;
    if (!hasOriginalField) return null;
    const originalContent: string | null = toolResult.originalContent ?? null;
    let newContent: string | undefined;
    if (toolName === 'write_file') {
      newContent = toolResult?.content ?? toolArgs?.content;
    } else {
      newContent = toolResult?.content;
    }
    if (typeof newContent !== 'string') return null;
    return computeDiffHunks(originalContent, newContent, 2);
  }, [toolName, toolArgs, toolResult, status]);

  // For inline diff, only changed lines, limited count
  const inlineDiffLines = useMemo(() => {
    if (!diffData) return null;
    const changedLines = diffData.hunks.flatMap(h =>
      h.lines.filter(l => l.type === 'added' || l.type === 'removed')
    );
    if (changedLines.length === 0) return null;
    const truncated = changedLines.length > INLINE_MAX_LINES;
    return { lines: changedLines.slice(0, INLINE_MAX_LINES), truncated, total: changedLines.length };
  }, [diffData]);

  // Streaming preview: show content from toolArgs as it arrives (before result is ready)
  const streamingLines = useMemo(() => {
    if (!isOutcomeFileTool(toolName)) return null;
    if (status !== 'processing') return null;
    if (toolName === 'write_file' && typeof toolArgs?.content === 'string' && toolArgs.content.length > 0) {
      const lines = toolArgs.content.split('\n');
      const display = lines.slice(0, INLINE_MAX_LINES);
      return { lines: display, total: lines.length, truncated: lines.length > INLINE_MAX_LINES };
    }
    if (toolName === 'apply_edits' && Array.isArray(toolArgs?.edits) && toolArgs.edits.length > 0) {
      const editLines: string[] = [];
      for (const edit of toolArgs.edits) {
        if (edit.newContent) {
          const nc = edit.newContent.split('\n');
          editLines.push(...nc);
        }
      }
      if (editLines.length > 0) {
        const display = editLines.slice(0, INLINE_MAX_LINES);
        return { lines: display, total: editLines.length, truncated: editLines.length > INLINE_MAX_LINES };
      }
    }
    return null;
  }, [toolName, toolArgs, status]);

  if (isOutcomeFileTool(toolName)) {
    const fileIcon = getIcon(iconNameForBubble);
    const hasDiff = diffData && inlineDiffLines && inlineDiffLines.lines.length > 0;
    const isStreaming = status === 'processing' && streamingLines;

    return (
      <>
        <style>{shimmerStyles}</style>
        <div
          className="diff-inline-preview"
          onClick={handleClick}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchMove={handleTouchMove}
          style={{ cursor: togglePanel ? 'pointer' : 'default', touchAction: 'manipulation' }}
          title={filePath || undefined}
        >
          {/* Header: icon + filename + stats/status */}
          <div className="diff-header">
            <div className="shrink-0" style={{ width: 18, height: 18 }} dangerouslySetInnerHTML={{ __html: fileIcon.svg }} />
            <span className="diff-filename">{fileBubbleTitle}</span>
            {hasDiff ? (
              <span className="diff-stats">
                {diffData.additions > 0 && <span className="diff-stat-add">+{diffData.additions}</span>}
                {diffData.deletions > 0 && <span className="diff-stat-del">-{diffData.deletions}</span>}
              </span>
            ) : status === 'processing' ? (
              <span
                className="text-xs font-medium shrink-0 bg-linear-to-r from-transparent via-gray-400 to-transparent bg-clip-text text-transparent"
                style={{ backgroundSize: '200% 100%', animation: 'shimmer 2s ease-in-out infinite' }}
              >
                {toolName === 'write_file' ? 'Writing…' : 
                 toolName === 'apply_edits' ? 'Editing…' :
                 toolName === 'read_file' ? 'Reading…' :
                 toolName === 'delete_file' ? 'Deleting…' :
                 toolName === 'grep_file' ? 'Grepping…' :
                 'Processing…'}
              </span>
            ) : (
              <span className="text-xs text-(--muted) shrink-0">{outcomeSubtitle}</span>
            )}
            {status === 'processing' && <span className="inline-tool-status-dot shrink-0" />}
            {status === 'completed' && (
              <svg className="w-3.5 h-3.5 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
            {status === 'error' && (
              <svg className="w-3.5 h-3.5 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
          </div>

          {/* Streaming preview: show code as it arrives */}
          {isStreaming && (
            <div className="diff-code diff-streaming">
              {streamingLines.lines.map((line: string, li: number) => (
                <div key={`stream-${li}`} className="diff-line added">
                  <span className="diff-line-num">{li + 1}</span>
                  <span className="diff-line-sign">+</span>
                  <span className="diff-line-text">{line}</span>
                </div>
              ))}
              {streamingLines.truncated && (
                <div className="diff-hunk-sep">+{streamingLines.total - INLINE_MAX_LINES} more lines</div>
              )}
            </div>
          )}

          {/* Completed diff: only changed lines, limited */}
          {hasDiff && (
            <div className="diff-code">
              {inlineDiffLines.lines.map((line, li) => (
                <div key={`inline-${li}`} className={`diff-line ${line.type}`}>
                  <span className="diff-line-num">
                    {line.type === 'removed' ? (line.oldLineNo ?? '') : (line.newLineNo ?? '')}
                  </span>
                  <span className="diff-line-sign">
                    {line.type === 'added' ? '+' : '-'}
                  </span>
                  <span className="diff-line-text">{line.content}</span>
                </div>
              ))}
              {inlineDiffLines.truncated && (
                <div className="diff-hunk-sep">+{inlineDiffLines.total - INLINE_MAX_LINES} more changes</div>
              )}
            </div>
          )}
        </div>
      </>
    );
  }

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
          {inlineSubtitle && (
            <span className="text-xs text-(--muted) truncate shrink min-w-0">
              {inlineSubtitle}
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
