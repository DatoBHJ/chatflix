import { MarkdownContent } from './MarkdownContent' 
import { ExtendedMessage } from '../chat/[id]/types'
import { Attachment } from '@/lib/types'
import { ensureFreshAttachmentUrls } from '@/app/utils/attachmentUrlHelpers';
import React, { memo, useCallback, useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import { IoCreateOutline, IoCopyOutline, IoCheckmarkOutline, IoBookmarkOutline, IoBookmark, IoDocumentTextOutline, IoClose, IoEllipsisHorizontal } from 'react-icons/io5'

import { AttachmentPreview } from './Attachment'
import { DragDropOverlay } from './ChatInput/DragDropOverlay'; 
import { 
  getStructuredResponseMainContent, 
  getStructuredResponseDescription, 
  isStructuredResponseInProgress
} from '@/app/lib/messageUtils';
import { ModelNameWithLogo, ModelCapabilityBadges } from './ModelInfo'; 
import { linkifyText } from '../lib/textUtils'
import { highlightSearchTermInChildren } from '@/app/utils/searchHighlight'
import { UnifiedInfoPanel } from './UnifiedInfoPanel'
import { FilesPreview } from './FilePreview/FilesPreview'
import { EditingFilePreview } from './FilePreview/EditingFilePreview'
import { LinkPreview } from './LinkPreview'
import { formatMessageTime } from '../lib/translations/messageTime'
import { FollowUpQuestions } from './FollowUpQuestions'
import { User } from '@supabase/supabase-js'
import { getModelById, isChatflixModel } from '../../lib/models/config';
import { getProviderLogo, hasLogo, getChatflixLogo } from '@/lib/models/logoUtils';
import { getChatInputTranslations } from '@/app/lib/translations/chatInput';
import { TypingIndicator } from './TypingIndicator';
import type { LinkCardData } from '@/app/types/linkPreview';
import { usePartsRenderer, type RenderSegment, type ToolSegmentContent } from '@/app/hooks/usePartsRenderer';
import { InlineToolPreview } from './InlineToolPreview';
import { getRunCodeData, getBrowserObserveData } from '../hooks/toolFunction';
import { getWebSearchResults, getGoogleSearchData } from '@/app/hooks/toolFunction';
import { getAdaptiveGlassStyleBlur, getAdaptiveGlassBackgroundColor, getTextStyle, getInitialTheme } from '@/app/lib/adaptiveGlassStyle';
import { UploadedImageChip } from '@/app/components/UploadedImageChip';


interface MessageProps {
  message: any & { experimental_attachments?: Attachment[] }
  currentModel: string
  isRegenerating: boolean
  editingMessageId: string | null
  editingContent: string
  copiedMessageId: string | null
  onRegenerate: (messageId: string) => (e: React.MouseEvent) => void
  onCopy: (message: any) => void
  onEditStart: (message: any) => void
  onEditCancel: () => void
  onEditSave: (messageId: string, files?: globalThis.File[], remainingAttachments?: any[]) => void // 브라우저 File 타입 명시
  setEditingContent: (content: string) => void
  chatId?: string
  isStreaming?: boolean
  isWaitingForToolResults?: boolean
  activePanelMessageId?: string | null
  activePanel?: { messageId: string; type: string; toolType?: string } | null
  togglePanel?: (messageId: string, type: 'canvas' | 'structuredResponse' | 'attachment', fileIndex?: number, toolType?: string, fileName?: string) => void
  isLastMessage?: boolean
  webSearchData?: any
  mathCalculationData?: any
  linkReaderData?: any
  imageGeneratorData?: any
  geminiImageData?: any
  seedreamImageData?: any
  qwenImageData?: any
  wan25VideoData?: any;
  grokVideoData?: any;
  videoUpscalerData?: any;
  imageUpscalerData?: any;
  twitterSearchData?: any
  youTubeSearchData?: any
  youTubeLinkAnalysisData?: any
  googleSearchData?: any
  user?: User | null
  handleFollowUpQuestionClick?: (question: string) => Promise<void>
  allMessages?: any[]
  isGlobalLoading?: boolean
  imageMap?: { [key: string]: string }
  uploadedImageMetaMap?: { [key: string]: { url: string; filename: string } }
  videoMap?: { [key: string]: { url: string; size?: string } | string }
  linkMap?: { [key: string]: string }
  thumbnailMap?: { [key: string]: string }
  titleMap?: { [key: string]: string }
  linkPreviewData?: Record<string, LinkCardData>
  promptMap?: { [key: string]: string }
  sourceImageMap?: { [key: string]: string }
  mediaDimensionsMap?: { [key: string]: { width: number; height: number } }
  isBookmarked?: boolean
  onBookmarkToggle?: (messageId: string, shouldBookmark: boolean) => Promise<void>
  isBookmarksLoading?: boolean
  searchTerm?: string | null // 🚀 FEATURE: Search term for highlighting
  isMessageSelectionMode?: boolean
  isMessageSelected?: boolean
  onEnterMessageSelectionMode?: (messageId: string) => void
  onToggleMessageSelection?: (messageId: string) => void
}

function isReasoningComplete(message: any, isStreaming: boolean): boolean {
  if (message.parts) {
    const reasoningPart = message.parts.find((part: any) => part.type === 'reasoning');
    
    if (!reasoningPart) {
      return false;
    }
    
    const reasoningText = reasoningPart.reasoningText || reasoningPart.text || '';
    
    // 텍스트 응답이 시작되었으면 reasoning 완료
    const hasTextStarted = message.parts.some((part: any) => 
      part.type === 'text' && (part.text || '').trim().length > 0
    );
    
    if (hasTextStarted) {
      return true;
    }
    
    // 스트리밍이 끝났고 reasoning 내용이 충분하면 완료
    return !isStreaming && reasoningText.trim().length > 20;
  }
  
  return false;
}

type UserMessageSegment =
  | { type: 'text'; value: string }
  | { type: 'uploaded_image'; id: string };

function parseUserContentWithUploadedImages(content: string): UserMessageSegment[] {
  if (!content) return [];
  if (!/uploaded_image_\d+/.test(content)) {
    return [{ type: 'text', value: content }];
  }
  const segments: UserMessageSegment[] = [];
  let lastIndex = 0;
  const re = /uploaded_image_(\d+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    if (m.index > lastIndex) {
      segments.push({ type: 'text', value: content.slice(lastIndex, m.index) });
    }
    segments.push({ type: 'uploaded_image', id: m[0] });
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < content.length) {
    segments.push({ type: 'text', value: content.slice(lastIndex) });
  }
  return segments;
}

interface UserMessageContentProps {
  content: string;
  showGradient?: boolean;
  onClick?: () => void;
  isClickable?: boolean;
  searchTerm?: string | null;
}

function UserMessageContent({ 
  content, 
  showGradient, 
  onClick,
  isClickable,
  searchTerm
}: UserMessageContentProps) {
  // content가 undefined이거나 빈 문자열일 때 안전하게 처리
  const safeContent = content || '';
  const processedContent = safeContent.split('\\n').map((line, index, array) => (
    <React.Fragment key={index}>
      {highlightSearchTermInChildren(linkifyText(line), searchTerm || null, { messageType: 'user' })}
      {index < array.length - 1 && <br />}
    </React.Fragment>
  ));
  
  return (
    <div 
      className={`user-message-content relative ${isClickable ? 'cursor-pointer' : ''}`}
      style={{
        whiteSpace: 'pre-wrap',       
        wordBreak: 'break-word',      
        overflowWrap: 'break-word',   
      }}
      onClick={onClick}
    >
      {processedContent}
      {showGradient && (
        <div 
          className="absolute bottom-0 left-0 right-0 h-12 bg-linear-to-t from-[#0B93F6] to-transparent pointer-events-none"
        />
      )}
    </div>
  );
}

function UserMessageContentWithUploads({
  segments,
  uploadedImageMetaMap,
  imageMap,
  showGradient,
  onClick,
  isClickable,
  searchTerm,
}: {
  segments: UserMessageSegment[];
  uploadedImageMetaMap: { [key: string]: { url: string; filename: string } };
  imageMap: { [key: string]: string };
  showGradient?: boolean;
  onClick?: () => void;
  isClickable?: boolean;
  searchTerm?: string | null;
}) {
  return (
    <div 
      className={`user-message-content relative ${isClickable ? 'cursor-pointer' : ''}`}
      style={{
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        overflowWrap: 'break-word',
      }}
      onClick={onClick}
    >
      {segments.map((seg, idx) => {
        if (seg.type === 'text') {
          const lines = seg.value.split('\\n');
          return (
            <React.Fragment key={idx}>
              {lines.map((line, i) => (
                <React.Fragment key={i}>
                  {highlightSearchTermInChildren(linkifyText(line), searchTerm || null, { messageType: 'user' })}
                  {i < lines.length - 1 && <br />}
                </React.Fragment>
              ))}
            </React.Fragment>
          );
        }
        const meta = uploadedImageMetaMap[seg.id];
        const url = meta?.url ?? imageMap[seg.id];
        const num = seg.id.replace(/^uploaded_image_/, '') || '1';
        const label = `image ${num}`;
        if (!url) return null;
        return <React.Fragment key={idx}><UploadedImageChip url={url} label={label} className="my-0.5 mr-1" />{' '}</React.Fragment>;
      })}
      {showGradient && (
        <div 
          className="absolute bottom-0 left-0 right-0 h-12 bg-linear-to-t from-[#0B93F6] to-transparent pointer-events-none"
        />
      )}
    </div>
  );
}

// 검색 도구 여부 확인 함수
const isOutcomeFileTool = (name: string) => ['write_file', 'apply_edits', 'read_file', 'delete_file', 'grep_file', 'get_file_info', 'list_workspace'].includes(name);

const isSearchTool = (name: string) => [
  'web_search',
  'multi_search',
  'google_search',
  'twitter_search',
  'youtube_search',
  'youtube_link_analysis',
  'search'
].includes(name);

/** 파일/코드 실행 도구 (검색도구와 동일한 꼬리 로직: 연속 시 마지막만 꼬리) */
const isFileOrCodeTool = (name: string) =>
  isOutcomeFileTool(name) || name === 'run_python_code' || name === 'browser_observe';

// Assistant Avatar Component
const AssistantAvatar = ({ modelId, onClick }: { modelId: string; onClick?: () => void }) => {
  const model = getModelById(modelId);
  const [isDarkTheme, setIsDarkTheme] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const evaluateTheme = () => {
      const themeAttr = document.documentElement.getAttribute('data-theme');
      if (themeAttr === 'dark') return true;
      if (themeAttr === 'system') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
      }
      return false;
    };

    setIsDarkTheme(evaluateTheme());

    const observer = new MutationObserver(() => {
      setIsDarkTheme(evaluateTheme());
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });

    return () => observer.disconnect();
  }, []);

  // if (!model) return null; // Allow rendering default logo if model not found

  const isChatflix = model?.id ? isChatflixModel(model.id) : false;
  const chatflixLogoSrc = getChatflixLogo({ isDark: isDarkTheme });
  const providerLogoSrc = model?.provider 
    ? (isChatflix ? chatflixLogoSrc : getProviderLogo(model.provider, model.id))
    : chatflixLogoSrc; // Fallback to Chatflix logo

  return (
    <div 
      onClick={onClick}
      className="shrink-0 flex items-center justify-center rounded-full transition-all duration-200 hover:scale-110 active:scale-95 cursor-pointer w-12 h-12"
      style={{
        ...getAdaptiveGlassStyleBlur(),
        ...getAdaptiveGlassBackgroundColor(),
        overflow: 'visible', // 🚀 FIX: 그림자 잘림 방지 (overflow-hidden 제거)
      }}
    >
      {providerLogoSrc && (
        <Image 
          src={providerLogoSrc}
          alt="Model logo"
          width={28}
          height={28}
          className="object-contain p-1"
        />
      )}
    </div>
  );
};

// 🚀 OPTIMIZATION: 커스텀 비교 함수로 progress annotation만 변경될 때 리렌더링 방지
const areMessagePropsEqual = (prevProps: any, nextProps: any) => {
  // message.annotations의 progress만 변경된 경우 무시
  const prevAnnotationsWithoutProgress = (prevProps.message?.annotations || []).filter(
    (a: any) => a?.type !== 'wan25_video_progress' && a?.type !== 'data-wan25_video_progress' && a?.type !== 'grok_video_progress' && a?.type !== 'data-grok_video_progress' && a?.type !== 'video_upscaler_progress' && a?.type !== 'data-video_upscaler_progress' && a?.type !== 'image_upscaler_progress' && a?.type !== 'data-image_upscaler_progress'
  );
  const nextAnnotationsWithoutProgress = (nextProps.message?.annotations || []).filter(
    (a: any) => a?.type !== 'wan25_video_progress' && a?.type !== 'data-wan25_video_progress' && a?.type !== 'grok_video_progress' && a?.type !== 'data-grok_video_progress' && a?.type !== 'video_upscaler_progress' && a?.type !== 'data-video_upscaler_progress' && a?.type !== 'image_upscaler_progress' && a?.type !== 'data-image_upscaler_progress'
  );
  
  // annotations (progress 제외) 비교
  const annotationsEqual = JSON.stringify(prevAnnotationsWithoutProgress) === JSON.stringify(nextAnnotationsWithoutProgress);
  
  // message.parts의 실제 내용 비교 (progress annotation 제외)
  const prevPartsWithoutProgress = (prevProps.message?.parts || []).filter(
    (p: any) => p?.type !== 'data-wan25_video_progress' && p?.type !== 'data-grok_video_progress' && p?.type !== 'data-video_upscaler_progress' && p?.type !== 'data-image_upscaler_progress'
  );
  const nextPartsWithoutProgress = (nextProps.message?.parts || []).filter(
    (p: any) => p?.type !== 'data-wan25_video_progress' && p?.type !== 'data-grok_video_progress' && p?.type !== 'data-video_upscaler_progress' && p?.type !== 'data-image_upscaler_progress'
  );
  const partsEqual = JSON.stringify(prevPartsWithoutProgress) === JSON.stringify(nextPartsWithoutProgress);
  
  // message의 핵심 필드 비교
  const messageCoreEqual = 
    prevProps.message?.id === nextProps.message?.id &&
    prevProps.message?.content === nextProps.message?.content &&
    prevProps.message?.role === nextProps.message?.role &&
    JSON.stringify(prevProps.message?.tool_results) === JSON.stringify(nextProps.message?.tool_results) &&
    annotationsEqual &&
    partsEqual;
  
  // wan25VideoData 비교 (progress는 더 이상 사용하지 않으므로 전체 비교)
  const wan25VideoDataPropsEqual = 
    JSON.stringify(prevProps.wan25VideoData) === JSON.stringify(nextProps.wan25VideoData);
  const grokVideoDataPropsEqual = 
    JSON.stringify(prevProps.grokVideoData) === JSON.stringify(nextProps.grokVideoData);
  const videoUpscalerDataPropsEqual =
    JSON.stringify(prevProps.videoUpscalerData) === JSON.stringify(nextProps.videoUpscalerData);
  const imageUpscalerDataPropsEqual =
    JSON.stringify(prevProps.imageUpscalerData) === JSON.stringify(nextProps.imageUpscalerData);
  
  // 다른 props 비교 (toolData는 참조 비교 - 내용이 같으면 참조도 같음)
  const otherPropsEqual = 
    prevProps.currentModel === nextProps.currentModel &&
    prevProps.isRegenerating === nextProps.isRegenerating &&
    prevProps.editingMessageId === nextProps.editingMessageId &&
    prevProps.editingContent === nextProps.editingContent &&
    prevProps.copiedMessageId === nextProps.copiedMessageId &&
    prevProps.chatId === nextProps.chatId &&
    prevProps.isStreaming === nextProps.isStreaming &&
    prevProps.isWaitingForToolResults === nextProps.isWaitingForToolResults &&
    prevProps.isLastMessage === nextProps.isLastMessage &&
    prevProps.searchTerm === nextProps.searchTerm &&
    prevProps.user?.id === nextProps.user?.id &&
    prevProps.isBookmarked === nextProps.isBookmarked &&
    prevProps.isBookmarksLoading === nextProps.isBookmarksLoading &&
    JSON.stringify(prevProps.activePanel) === JSON.stringify(nextProps.activePanel) &&
    // toolData props는 참조 비교 (내용이 같으면 참조도 같음)
    prevProps.webSearchData === nextProps.webSearchData &&
    prevProps.mathCalculationData === nextProps.mathCalculationData &&
    prevProps.linkReaderData === nextProps.linkReaderData &&
    prevProps.imageGeneratorData === nextProps.imageGeneratorData &&
    prevProps.geminiImageData === nextProps.geminiImageData &&
    prevProps.seedreamImageData === nextProps.seedreamImageData &&
    prevProps.qwenImageData === nextProps.qwenImageData &&
    prevProps.twitterSearchData === nextProps.twitterSearchData &&
    prevProps.youTubeSearchData === nextProps.youTubeSearchData &&
    prevProps.youTubeLinkAnalysisData === nextProps.youTubeLinkAnalysisData &&
    prevProps.googleSearchData === nextProps.googleSearchData &&
    wan25VideoDataPropsEqual &&
    grokVideoDataPropsEqual &&
    videoUpscalerDataPropsEqual &&
    imageUpscalerDataPropsEqual &&
    // 함수 props는 참조 비교
    prevProps.onRegenerate === nextProps.onRegenerate &&
    prevProps.onCopy === nextProps.onCopy &&
    prevProps.onEditStart === nextProps.onEditStart &&
    prevProps.onEditCancel === nextProps.onEditCancel &&
    prevProps.onEditSave === nextProps.onEditSave &&
    prevProps.setEditingContent === nextProps.setEditingContent &&
    prevProps.togglePanel === nextProps.togglePanel &&
    prevProps.handleFollowUpQuestionClick === nextProps.handleFollowUpQuestionClick &&
    prevProps.onBookmarkToggle === nextProps.onBookmarkToggle &&
    // Map props는 참조 비교
    prevProps.imageMap === nextProps.imageMap &&
    prevProps.videoMap === nextProps.videoMap &&
    prevProps.linkMap === nextProps.linkMap &&
    prevProps.thumbnailMap === nextProps.thumbnailMap &&
    prevProps.titleMap === nextProps.titleMap &&
    prevProps.linkPreviewData === nextProps.linkPreviewData &&
    prevProps.promptMap === nextProps.promptMap &&
    prevProps.sourceImageMap === nextProps.sourceImageMap &&
    prevProps.mediaDimensionsMap === nextProps.mediaDimensionsMap &&
    prevProps.isMessageSelectionMode === nextProps.isMessageSelectionMode &&
    prevProps.isMessageSelected === nextProps.isMessageSelected &&
    prevProps.onEnterMessageSelectionMode === nextProps.onEnterMessageSelectionMode &&
    prevProps.onToggleMessageSelection === nextProps.onToggleMessageSelection;
  
  // 모든 핵심 필드가 같으면 리렌더링 방지
  return messageCoreEqual && otherPropsEqual;
};

const Message = memo(function MessageComponent({
  message,
  currentModel,
  isRegenerating,
  editingMessageId,
  editingContent,
  copiedMessageId,
  onRegenerate,
  onCopy,
  onEditStart,
  onEditCancel,
  onEditSave,
  setEditingContent,
  chatId,
  isStreaming = false,
  isWaitingForToolResults = false,
  activePanel,
  togglePanel,
  isLastMessage,
  webSearchData,
  mathCalculationData,
  linkReaderData,
  imageGeneratorData,
  geminiImageData,
  seedreamImageData,
  qwenImageData,
  wan25VideoData,
  grokVideoData,
  videoUpscalerData,
  imageUpscalerData,

  twitterSearchData,
  youTubeSearchData,
  youTubeLinkAnalysisData,
  googleSearchData,
  user,
  handleFollowUpQuestionClick,
  allMessages,
  isGlobalLoading,
  imageMap = {},
  uploadedImageMetaMap = {},
  videoMap = {},
  linkMap = {},
  thumbnailMap = {},
  titleMap = {},
  linkPreviewData = {},
  promptMap = {},
  sourceImageMap = {},
  mediaDimensionsMap = {},
  isBookmarked,
  onBookmarkToggle,
  isBookmarksLoading,
  searchTerm, // 🚀 FEATURE: Search term for highlighting
  isMessageSelectionMode = false,
  isMessageSelected = false,
  onEnterMessageSelectionMode,
  onToggleMessageSelection,
}: MessageProps) {

  // 스트리밍 시작 시 모델 고정 (중간에 모델 변경 시 로고 변경 방지)
  const streamingModelRef = useRef<string | null>(null);
  
  useEffect(() => {
    // 스트리밍이 시작되면 현재 모델을 캡처 (이미 캡처된 경우 유지)
    if (isStreaming && !streamingModelRef.current) {
      streamingModelRef.current = currentModel;
    } 
    // 스트리밍이 끝나면 ref 초기화하지 않음 (렌더링 안정성을 위해)
    // 다음 스트리밍 시작 시 새로운 모델로 갱신됨
  }, [isStreaming, currentModel]);

  // 표시할 모델 결정
  const displayModel = useMemo(() => {
    // 1. 메시지에 저장된 모델이 있으면 최우선 사용
    if ((message as ExtendedMessage).model) {
      return (message as ExtendedMessage).model;
    }
    
    // 2. 스트리밍 중이면 캡처된 모델 사용
    if (isStreaming && streamingModelRef.current) {
      return streamingModelRef.current;
    }
    
    // 3. 둘 다 없으면 현재 선택된 모델 사용 (새 채팅 등)
    return currentModel;
  }, [message, isStreaming, currentModel]);

  // Pre-compiled regex for better performance
  const IMAGE_ID_REGEX = useMemo(() => /\[IMAGE_ID:([^\]]+)\]/g, []);
  const VIDEO_ID_REGEX = useMemo(() => /\[VIDEO_ID:([^\]]+)\]/g, []);
  const LINK_ID_REGEX = useMemo(() => /\[LINK_ID:([^\]]+)\]/g, []);
  
  // Helper function to extract video URL and size from videoMap entry
  // 이미지와 동일한 해시 형식 (#w=1280&h=720)으로 통일
  const getVideoUrlWithSize = useCallback((videoEntry: { url: string; size?: string } | string): string => {
    if (typeof videoEntry === 'string') {
      return videoEntry;
    }
    const url = videoEntry.url;
    if (videoEntry.size) {
      // size 형식: "1280*720" -> 해시 형식: "#w=1280&h=720"
      const [w, h] = videoEntry.size.split('*');
      if (w && h) {
        return `${url}#w=${w}&h=${h}`;
      }
    }
    return url;
  }, []);
  
  // 🔥 parts 기반으로 이미지 순서를 재정렬하는 함수 (InlineToolPreview 순서와 일치)
  const reorderImagesByPartsOrder = useCallback((content: string, parts: any[]) => {
    if (!parts || !Array.isArray(parts) || !content.includes('[IMAGE_ID:')) {
      return content;
    }
    
    // 1. parts에서 이미지 도구 결과의 이미지 ID 순서 추출 (InlineToolPreview와 동일)
    const partsImageOrder: string[] = [];
    for (const part of parts) {
      // tool-result 또는 tool-xxx_image_tool 형식 모두 처리
      const isToolResult = part.type === 'tool-result' || 
                          (part.type?.startsWith('tool-') && part.output);
      const toolName = part.toolName || part.type?.replace('tool-', '');
      
      if (isToolResult && ['gemini_image_tool', 'seedream_image_tool', 'qwen_image_edit'].includes(toolName)) {
        const result = part.output?.value || part.output;
        if (result && result.success !== false) {
          const images = Array.isArray(result) ? result : (result.images || (result.imageUrl ? [result] : []));
          for (const img of images) {
            if (img.path) {
              // 파일 이름에서 확장자 제거하여 ID 추출
              const fileName = img.path.split('/').pop();
              const imageId = fileName?.replace(/\.[^/.]+$/, '');
              if (imageId) {
                partsImageOrder.push(imageId);
              }
            }
          }
        }
      }
    }
    
    if (partsImageOrder.length === 0) return content;
    
    // 2. 텍스트에서 연속된 이미지 그룹 찾아서 재정렬
    // 연속된 IMAGE_ID들 (줄바꿈으로 구분된)을 하나의 그룹으로 처리
    const imageGroupRegex = /(\[IMAGE_ID:[^\]]+\](?:\s*\[IMAGE_ID:[^\]]+\])*)/g;
    let processedContent = content;
    
    processedContent = processedContent.replace(imageGroupRegex, (imageGroup) => {
      // 그룹 내의 모든 이미지 ID 추출
      const imageIds = [...imageGroup.matchAll(/\[IMAGE_ID:([^\]]+)\]/g)].map(m => m[1]);
      
      // 이미 순서가 맞는지 확인
      let needsReorder = false;
      const indicesInParts = imageIds.map(id => partsImageOrder.indexOf(id)).filter(idx => idx !== -1);
      for (let i = 1; i < indicesInParts.length; i++) {
        if (indicesInParts[i] < indicesInParts[i - 1]) {
          needsReorder = true;
          break;
        }
      }
      
      if (!needsReorder) return imageGroup;
      
      // parts 순서에 따라 정렬
      const sortedIds = [...imageIds].sort((a, b) => {
        const indexA = partsImageOrder.indexOf(a);
        const indexB = partsImageOrder.indexOf(b);
        // parts에 없는 ID는 원래 위치 유지
        if (indexA === -1 && indexB === -1) return 0;
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
      });
      
      // 재정렬된 순서로 이미지 그룹 재구성
      return sortedIds.map(id => `[IMAGE_ID:${id}]`).join('\n\n');
    });
    
    return processedContent;
  }, []);

  // Helper function to remove consecutive duplicate links
  const removeConsecutiveDuplicateLinks = useCallback((content: string, linkMap: { [key: string]: string }) => {
    if (!content.includes('[LINK_ID:')) return content;
    
    // Find consecutive LINK_ID groups (one or more LINK_IDs in a row)
    const consecutiveLinkRegex = /(\[LINK_ID:[^\]]+\](?:\s*\[LINK_ID:[^\]]+\])*)/g;
    let processedContent = content;
    
    let match;
    while ((match = consecutiveLinkRegex.exec(content)) !== null) {
      const linkGroup = match[1];
      const linkIds = linkGroup.match(/\[LINK_ID:([^\]]+)\]/g);
      
      if (linkIds && linkIds.length > 1) {
        const seenUrls = new Set<string>();
        const uniqueLinks: string[] = [];
        
        for (const linkIdMatch of linkIds) {
          const linkId = linkIdMatch.match(/\[LINK_ID:([^\]]+)\]/)?.[1];
          if (linkId && linkMap[linkId]) {
            const url = linkMap[linkId];
            if (!seenUrls.has(url)) {
              seenUrls.add(url);
              uniqueLinks.push(linkIdMatch);
            }
          } else {
            // Keep links that don't have URLs in linkMap
            uniqueLinks.push(linkIdMatch);
          }
        }
        
        // Replace the original group with deduplicated links
        if (uniqueLinks.length !== linkIds.length) {
          const deduplicatedGroup = uniqueLinks.join('\n');
          processedContent = processedContent.replace(linkGroup, deduplicatedGroup);
        }
      }
    }
    
    return processedContent;
  }, []);

  // 🚀 OPTIMIZATION: 비디오 관련 parts만 추출하여 의존성으로 사용
  const videoPartsKey = useMemo(() => {
    if (!message.parts || !Array.isArray(message.parts)) return '';
    const videoParts = message.parts.filter(
      (p: any) => p?.type?.startsWith('tool-wan25_') || p?.type === 'data-wan25_video_complete' || p?.type?.startsWith('tool-grok_') || p?.type === 'data-grok_video_complete' || p?.type?.startsWith('tool-video_upscaler') || p?.type === 'data-video_upscaler_complete'
    );
    return JSON.stringify(videoParts);
  }, [message.parts]);

  // Memoized function to replace image placeholders with actual URLs - AI SDK v5 호환
  const processedContent = useMemo(() => {
    // 1. message.content가 있으면 우선 사용
    let content = message.content;
    
    // 2. message.content가 없으면 parts에서 텍스트 추출
    if (!content && message.parts && Array.isArray(message.parts)) {
      const textParts = message.parts.filter((part: any) => part.type === 'text');
      content = textParts.map((part: any) => part.text || '').join('\n');
    }
    
    if (!content) return content;
    
    // Quick check: if no placeholders exist, return original content immediately
    if (!content.includes('[IMAGE_ID:') && !content.includes('[LINK_ID:') && !content.includes('[VIDEO_ID:')) {
      return content;
    }
    
    // Process placeholders only when necessary
    let processedContent = content;
    
    // 🔥 parts 기반으로 이미지 순서 재정렬 (InlineToolPreview 순서와 일치)
    if (content.includes('[IMAGE_ID:') && message.parts) {
      processedContent = reorderImagesByPartsOrder(processedContent, message.parts);
    }
    
    // Remove consecutive duplicate links before processing placeholders
    if (content.includes('[LINK_ID:')) {
      processedContent = removeConsecutiveDuplicateLinks(processedContent, linkMap);
    }
    
    // Process image placeholders
    if (processedContent.includes('[IMAGE_ID:')) {
      processedContent = processedContent.replace(IMAGE_ID_REGEX, (match: string, imageId: string) => {
        // Only show image if imageMap exists AND has the specific URL
        if (imageMap && Object.keys(imageMap).length > 0) {
          const imageUrl = imageMap[imageId];
          if (imageUrl) {
            // Debug logging
            console.log('Processing IMAGE_ID:', imageId, 'URL:', imageUrl);
            // Use empty alt text for clean display
            return `![](${imageUrl})`;
          }
        }
        // Remove placeholder completely in all other cases
        return '';
      });
    }
    
    // Process link placeholders
    if (content.includes('[LINK_ID:')) {
      processedContent = processedContent.replace(LINK_ID_REGEX, (match: string, linkId: string) => {
        // Only show link if linkMap exists AND has the specific URL
        if (linkMap && Object.keys(linkMap).length > 0) {
          const linkUrl = linkMap[linkId];
          if (linkUrl) {
            // Return the URL directly - MarkdownContent will handle LinkPreview rendering
            return linkUrl;
          }
        }
        // Remove placeholder completely in all other cases
        return '';
      });
    }

    // Process video placeholders
    if (content.includes('[VIDEO_ID:')) {
      processedContent = processedContent.replace(VIDEO_ID_REGEX, (match: string, videoId: string) => {
        if (videoMap && Object.keys(videoMap).length > 0) {
          const videoEntry = videoMap[videoId];
          if (videoEntry) {
            // Return the URL with size info - MarkdownContent will handle direct video rendering
            return getVideoUrlWithSize(videoEntry);
          }
        }
        return '';
      });
    }
    
    return processedContent;
  }, [message.content, videoPartsKey, imageMap, videoMap, linkMap, IMAGE_ID_REGEX, VIDEO_ID_REGEX, LINK_ID_REGEX, removeConsecutiveDuplicateLinks, reorderImagesByPartsOrder, getVideoUrlWithSize]);

  // Memoized function for parts processing
  const processedParts = useMemo(() => {
    if (!message.parts) return null;
    
    return message.parts.map((part: any) => {
      if (part.type === 'text' && part.text) {
        // Quick check for performance
        if (!part.text.includes('[IMAGE_ID:') && !part.text.includes('[LINK_ID:')) {
          return part;
        }
        
        let processedText = part.text;
        
        // 🔥 parts 기반으로 이미지 순서 재정렬 (InlineToolPreview 순서와 일치)
        if (processedText.includes('[IMAGE_ID:')) {
          processedText = reorderImagesByPartsOrder(processedText, message.parts);
        }
        
        // Remove consecutive duplicate links first
        if (processedText.includes('[LINK_ID:')) {
          processedText = removeConsecutiveDuplicateLinks(processedText, linkMap);
        }
        
        // Process image placeholders
        if (processedText.includes('[IMAGE_ID:')) {
          processedText = processedText.replace(IMAGE_ID_REGEX, (match: string, imageId: string) => {
            if (imageMap && Object.keys(imageMap).length > 0) {
              const imageUrl = imageMap[imageId];
              if (imageUrl) {
                return `![](${imageUrl})`;
              }
            }
            return '';
          });
        }
        
        // Process link placeholders
        if (part.text.includes('[LINK_ID:')) {
          processedText = processedText.replace(LINK_ID_REGEX, (match: string, linkId: string) => {
            if (linkMap && Object.keys(linkMap).length > 0) {
              const linkUrl = linkMap[linkId];
              if (linkUrl) {
                // Return the URL directly - MarkdownContent will handle LinkPreview rendering
                return linkUrl;
              }
            }
            return '';
          });
        }

        // Process video placeholders
        if (part.text.includes('[VIDEO_ID:')) {
          processedText = processedText.replace(VIDEO_ID_REGEX, (match: string, videoId: string) => {
            if (videoMap && Object.keys(videoMap).length > 0) {
              const videoEntry = videoMap[videoId];
              if (videoEntry) {
                return getVideoUrlWithSize(videoEntry);
              }
            }
            return '';
          });
        }
        
        return {
          ...part,
          text: processedText
        };
      }
      return part;
    });
  }, [message.parts, imageMap, videoMap, linkMap, IMAGE_ID_REGEX, VIDEO_ID_REGEX, LINK_ID_REGEX, removeConsecutiveDuplicateLinks, reorderImagesByPartsOrder, getVideoUrlWithSize]);

  const userMessageDisplayContent = useMemo(() => {
    if (message.role !== 'user') return '';
    const hasContent = !!(message.content && String(message.content).trim().length > 0) ||
      (message.parts && message.parts.some((p: any) => p.type === 'text' && (p.text || '').trim().length > 0));
    if (!hasContent) return '';
    return processedContent ?? (processedParts?.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('\n') || '') ?? '';
  }, [message.role, message.content, message.parts, processedContent, processedParts]);

  const userMessageSegments = useMemo(() => {
    if (message.role !== 'user' || !userMessageDisplayContent) return null;
    if (Object.keys(uploadedImageMetaMap).length === 0) return null;
    const segments = parseUserContentWithUploadedImages(userMessageDisplayContent);
    const hasUploadedImage = segments.some((s) => s.type === 'uploaded_image');
    return hasUploadedImage ? segments : null;
  }, [message.role, userMessageDisplayContent, uploadedImageMetaMap]);

  const bubbleRef = useRef<HTMLDivElement>(null);
  const aiBubbleRef = useRef<HTMLDivElement>(null);
  const targetBubbleRef = useRef<HTMLElement | null>(null); // 🚀 FIX: 실제 탭한 버블 추적 (인터리브 모드용)
  const avatarRef = useRef<HTMLDivElement>(null); // 데스크탑 프로필 사진 참조
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [containerMinHeight, setContainerMinHeight] = useState<string | number>('auto');
  const viewRef = useRef<HTMLDivElement>(null);
  const interleavedContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bubbleRef.current) {
      const bubble = bubbleRef.current;
      // Heuristic to detect multi-line.
      // A single line of text with `text-sm` and `leading-relaxed` in Tailwind
      // has a height of about 22-23px. The bubble has 5px vertical padding (total 10px).
      // So a single-line bubble height is around 32-33px.
      // We set a threshold of 36px to reliably distinguish single from multi-line messages.
      if (bubble.clientHeight > 36) {
        bubble.classList.add('multi-line');
      } else {
        bubble.classList.remove('multi-line');
      }
    }
    
    // AI message multi-line detection
    if (aiBubbleRef.current) {
      const bubble = aiBubbleRef.current;
      if (bubble.clientHeight > 36) {
        bubble.classList.add('multi-line');
      } else {
        bubble.classList.remove('multi-line');
      }
    }
    // Re-run this effect when message content changes or streaming ends.
  }, [message.content, isStreaming]);

  // Apply multi-line detection to segments
  useEffect(() => {
    const segments = document.querySelectorAll('.message-segment');
    segments.forEach((segment) => {
      // 세그먼트 내의 가장 큰 텍스트 크기를 찾기
      const getLargestFontSize = (element: Element): number => {
        const computedStyle = window.getComputedStyle(element);
        const fontSize = parseFloat(computedStyle.fontSize);
        
        let maxFontSize = fontSize;
        
        // 자식 요소들도 확인
        const children = element.children;
        for (let i = 0; i < children.length; i++) {
          const childMaxSize = getLargestFontSize(children[i]);
          maxFontSize = Math.max(maxFontSize, childMaxSize);
        }
        
        return maxFontSize;
      };
      
      const maxFontSize = getLargestFontSize(segment);
      
      // 글꼴 크기에 따른 동적 임계값 계산
      // 기본 16px 기준으로 36px 임계값, 글꼴이 클수록 임계값도 증가
      const baseFontSize = 16;
      const baseThreshold = 36;
      const threshold = (maxFontSize / baseFontSize) * baseThreshold;
      
      // 텍스트 크기에 따른 패딩 클래스 추가
      const removePaddingClasses = () => {
        segment.classList.remove('text-size-sm', 'text-size-base', 'text-size-lg', 'text-size-xl', 'text-size-2xl', 'text-size-3xl', 'text-size-4xl');
      };
      
      removePaddingClasses();
      
      // 글꼴 크기에 따른 클래스 추가
      if (maxFontSize <= 14) {
        segment.classList.add('text-size-sm');
      } else if (maxFontSize <= 16) {
        segment.classList.add('text-size-base');
      } else if (maxFontSize <= 18) {
        segment.classList.add('text-size-lg');
      } else if (maxFontSize <= 20) {
        segment.classList.add('text-size-xl');
      } else if (maxFontSize <= 24) {
        segment.classList.add('text-size-2xl');
      } else if (maxFontSize <= 30) {
        segment.classList.add('text-size-3xl');
      } else {
        segment.classList.add('text-size-4xl');
      }
      
      if (segment.clientHeight > threshold) {
        segment.classList.add('multi-line');
      } else {
        segment.classList.remove('multi-line');
      }
    });
  }, [message.content, isStreaming]);

  // Bookmark state - now managed by parent component

  // 편집 모드용 파일 상태 추가
  const [editingFiles, setEditingFiles] = useState<globalThis.File[]>([]);
  const [editingFileMap, setEditingFileMap] = useState<Map<string, { file: globalThis.File, url: string }>>(new Map());
  const [dragActive, setDragActive] = useState(false); // 드래그 상태 추가
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editingContainerRef = useRef<HTMLDivElement>(null); // 편집 컨테이너 참조 추가
  

  
  // Reasoning Part (message.parts) 관련 상태 추가
  const [reasoningPartExpanded, setReasoningPartExpanded] = useState<Record<string, boolean>>({});
  const userOverrideReasoningPartRef = useRef<Record<string, boolean | null>>({});


  
  const handleEditStartClick = () => {
    if (viewRef.current) {
      const originalHeight = viewRef.current.offsetHeight;
      const maxHeight = window.innerHeight * 0.8; // Cap at 80% of viewport height
      setContainerMinHeight(Math.min(originalHeight, maxHeight));
    }
    onEditStart(message);
  };

  // Reasoning part state management
  const reasoningPart = message.parts?.find((part: any) => part.type === 'reasoning');
  const reasoningComplete = isReasoningComplete(message, isStreaming);
  const loadingReasoningKey = `${message.id}-reasoning-loading`;
  const completeReasoningKey = `${message.id}-reasoning-complete`;
  
  const hasReasoningPart = !!reasoningPart;
  
  // Reasoning 진행 상태 감지
  const isReasoningInProgress = useMemo(() => {
    if (!hasReasoningPart) return false;
    
    // 스트리밍 중이고 텍스트가 아직 시작되지 않았으면 reasoning 진행 중
    if (isStreaming && hasReasoningPart) {
      const hasTextStarted = message.parts?.some((part: any) => 
        part.type === 'text' && (part.text || '').trim().length > 0
      );
      return !hasTextStarted;
    }
    
    return !reasoningComplete;
  }, [hasReasoningPart, isStreaming, reasoningComplete, message.parts]);
  
  // Auto-expand/collapse logic for reasoning parts
  // 기본적으로 스트리밍 중에는 열려있고, 완료되면 닫힘
  // 사용자가 수동으로 토글한 경우는 이 로직이 적용되지 않음 (undefined 체크)
  useEffect(() => {
    if (!reasoningPart) return;
    setReasoningPartExpanded(prev => {
      const next = { ...prev } as Record<string, boolean>;
      // Initialize keys only once to avoid update loops
      // 스트리밍 중(reasoningComplete=false)이면 true(열림), 완료되면 false(닫힘)
      if (next[loadingReasoningKey] === undefined) {
        next[loadingReasoningKey] = !reasoningComplete;
      }
      if (next[completeReasoningKey] === undefined) {
        next[completeReasoningKey] = !reasoningComplete;
      }
      return next;
    });
  }, [reasoningPart, reasoningComplete, loadingReasoningKey, completeReasoningKey]);
  
  // 프리미엄 업그레이드 버튼 클릭 핸들러 (최상위 레벨에 배치)
  // const router = useRouter(); // useRouter 사용
  const handleUpgradeClick = async () => {
    if (!user) {
        window.location.href = '/login';
        return;
    }

    if (!user.id || !user.email) {
        alert('Your account information is incomplete. Please log out and sign in again.');
        return;
    }

    try {
        const response = await fetch('/api/subscription/checkout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: user.user_metadata?.full_name || (user.email ? user.email.split('@')[0] : 'User')
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to create checkout session');
        }

        if (data.checkout && data.checkout.url) {
            window.location.href = data.checkout.url;
        } else {
            throw new Error('Invalid checkout response');
        }
    } catch (error) {
        console.error('Error creating checkout session:', error);
        alert('Failed to create checkout session. Please try again.');
    }
  };

  // AI SDK 5: parts 배열에서 첨부파일 추출하거나 기존 experimental_attachments 사용
  const attachmentsFromParts = useMemo(() => {
    if (message.parts && Array.isArray(message.parts)) {
      return message.parts
        .filter((part: any) => part.type === 'image' || part.type === 'file')
        .map((part: any, index: number) => {
          if (part.type === 'image') {
            return {
              name: `image-${index}`,
              contentType: 'image/jpeg',
              url: part.image,
              fileType: 'image' as const,
              metadata: part.metadata
            };
          } else if (part.type === 'file') {
            return {
              name: part.filename || `file-${index}`,
              contentType: part.mediaType || 'application/octet-stream',
              url: part.url,
              fileType: 'file' as const
            };
          }
        })
        .filter(Boolean);
    }
    return [];
  }, [message.parts]);
  
  const allAttachments = message.experimental_attachments || attachmentsFromParts;

  // 편집 시작 시 기존 첨부파일들을 편집 상태로 복사
  useEffect(() => {
    let isMounted = true;

    const hydrateEditingAttachments = async () => {
      if (editingMessageId === message.id && allAttachments && allAttachments.length > 0) {
        const refreshedAttachments = await ensureFreshAttachmentUrls(allAttachments as Attachment[]);
        if (!isMounted) {
          return;
        }

        const files: globalThis.File[] = [];
        const fileMap = new Map<string, { file: globalThis.File, url: string }>();

        refreshedAttachments.forEach((attachment: Attachment, index: number) => {
          // Create a File-like object from attachment
          const file = new globalThis.File(
            [new Blob()], // 실제 파일 내용은 필요없고 메타데이터만 유지
            attachment.name || `attachment-${index}`,
            { type: attachment.contentType || 'application/octet-stream' }
          );
          
          // Add unique ID for file tracking
          (file as any).id = `existing-${attachment.url}-${index}`;
          (file as any).isExisting = true;
          (file as any).attachmentData = attachment;

          files.push(file);
          fileMap.set((file as any).id, {
            file,
            url: attachment.url
          });
        });

        setEditingFiles(files);
        setEditingFileMap(fileMap);
      } else if (editingMessageId !== message.id) {
        // 편집이 끝나면 파일 상태 초기화
        if (!isMounted) return;
        setEditingFiles([]);
        setEditingFileMap(new Map());
      }
    };

    hydrateEditingAttachments();

    return () => {
      isMounted = false;
    };
  }, [editingMessageId, message.id, allAttachments]);

  // 파일 추가 핸들러
  const handleFileSelect = useCallback(async () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, []);

  // 파일 변경 핸들러
  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    const newFiles: globalThis.File[] = [];
    const newFileMapEntries: [string, { file: globalThis.File, url: string }][] = [];

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      const fileId = `new-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Add unique ID for tracking
      (file as any).id = fileId;
      (file as any).isExisting = false;

      // Create object URL for preview
      const url = URL.createObjectURL(file);
      
      newFiles.push(file);
      newFileMapEntries.push([fileId, { file, url }]);
    }

    setEditingFiles(prev => [...prev, ...newFiles]);
    setEditingFileMap(prev => {
      const newMap = new Map(prev);
      newFileMapEntries.forEach(([id, data]) => {
        newMap.set(id, data);
      });
      return newMap;
    });

    // Reset file input
    e.target.value = '';
  }, []);

  // 드래그&드롭 핸들러들 추가
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (editingContainerRef.current && !editingContainerRef.current.contains(e.relatedTarget as Node)) {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await handleFilesFromDrop(files);
    }
  }, []);

  // 파일 처리 핸들러 (ChatInput의 handleFiles와 유사하게 구현)
  const handleFilesFromDrop = useCallback(async (fileList: FileList) => {
    const newFiles: globalThis.File[] = [];
    const newFileMapEntries: [string, { file: globalThis.File, url: string }][] = [];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const fileId = `drop-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Add unique ID for tracking
      (file as any).id = fileId;
      (file as any).isExisting = false;

      // Create object URL for preview
      const url = URL.createObjectURL(file);
      
      newFiles.push(file);
      newFileMapEntries.push([fileId, { file, url }]);
    }

    setEditingFiles(prev => [...prev, ...newFiles]);
    setEditingFileMap(prev => {
      const newMap = new Map(prev);
      newFileMapEntries.forEach(([id, data]) => {
        newMap.set(id, data);
      });
      return newMap;
    });
  }, []);

  // 파일 제거 핸들러
  const handleRemoveFile = useCallback((fileToRemove: globalThis.File) => {
    const fileId = (fileToRemove as any).id;
    
    setEditingFiles(prev => prev.filter(file => (file as any).id !== fileId));
    
    setEditingFileMap(prev => {
      const newMap = new Map(prev);
      const fileData = newMap.get(fileId);
      
      // Clean up object URL if it's a new file
      if (fileData && !(fileToRemove as any).isExisting) {
        URL.revokeObjectURL(fileData.url);
      }
      
      newMap.delete(fileId);
      return newMap;
    });
  }, []);

  // 편집 저장 핸들러 수정
  const handleEditSave = useCallback(() => {
    // 새로 추가된 파일들만 필터링 (기존 파일은 제외)
    const newFiles = editingFiles.filter(file => !(file as any).isExisting);
    // 기존 파일 중 유지되는 파일들의 첨부파일 데이터 추출
    const remainingExistingAttachments = editingFiles
      .filter(file => (file as any).isExisting)
      .map(file => (file as any).attachmentData)
      .filter(Boolean);
    
    onEditSave(message.id, newFiles, remainingExistingAttachments);
    setContainerMinHeight('auto');
  }, [editingFiles, onEditSave, message.id]);

  // 편집 취소 핸들러 수정
  const handleEditCancel = useCallback(() => {
    // 새로 추가된 파일들의 Object URL 정리
    editingFiles.forEach(file => {
      if (!(file as any).isExisting) {
        const fileId = (file as any).id;
        const fileData = editingFileMap.get(fileId);
        if (fileData) {
          URL.revokeObjectURL(fileData.url);
        }
      }
    });
    
    setEditingFiles([]);
    setEditingFileMap(new Map());
    onEditCancel();
    setContainerMinHeight('auto');
  }, [editingFiles, editingFileMap, onEditCancel]);
  

  const isEditing = editingMessageId === message.id;

  // 편집 모드 시작 시 텍스트 영역을 설정하는 효과
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      const textarea = textareaRef.current;

      const resizeTextarea = () => {
        textarea.style.height = 'auto';
        const scrollHeight = textarea.scrollHeight;
        // Ensure getComputedStyle runs only in browser
        if (typeof window !== 'undefined') {
          const maxHeight = parseInt(window.getComputedStyle(textarea).maxHeight, 10);
          
          if (scrollHeight > maxHeight) {
            textarea.style.height = `${maxHeight}px`;
          } else {
            textarea.style.height = `${scrollHeight}px`;
          }
        } else {
           textarea.style.height = `${scrollHeight}px`;
        }
      };

      resizeTextarea();
      textarea.focus();
      const len = textarea.value.length;
      textarea.setSelectionRange(len, len);

      // 메시지 그룹을 화면 중앙으로 스크롤
      setTimeout(() => {
        textarea.closest('.message-group')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100); // DOM 업데이트 후 스크롤
    }
  }, [isEditing, textareaRef]);

  const isCopied = copiedMessageId === message.id;
  const isAssistant = message.role === 'assistant';
  const isUser = message.role === 'user';
  const hasAttachments = allAttachments && allAttachments.length > 0;
  // AI SDK v5: parts 배열에서 텍스트 내용 확인 (message.content는 빈 문자열일 수 있음)
  const hasContent = useMemo(() => {
    // 1. message.content가 있으면 확인
    if (message.content && message.content.trim().length > 0) {
      return true;
    }
    
    // 2. parts 배열에서 text 타입 part 확인
    if (message.parts && Array.isArray(message.parts)) {
      return message.parts.some((part: any) => 
        part.type === 'text' && part.text && part.text.trim().length > 0
      );
    }
    
    return false;
  }, [message.content, message.parts]);
  

  
  // 🚀 인터리브 렌더링을 위한 parts 세그먼트 분류
  const { segments, useInterleavedMode } = usePartsRenderer(
    message.parts,
    (message as any)._hasStoredParts
  );

  const preferredRunCodeToolCallId = useMemo(() => {
    if (!Array.isArray(message.parts)) return undefined;
    let lastRunToolCallId: string | undefined;
    let lastSuccessfulRunToolCallId: string | undefined;

    for (const part of message.parts as any[]) {
      if (part?.type === 'tool-run_python_code' && typeof part.toolCallId === 'string') {
        lastRunToolCallId = part.toolCallId;
      }
      if (part?.type === 'data-run_code_complete') {
        const toolCallId = typeof part?.data?.toolCallId === 'string' ? part.data.toolCallId : undefined;
        if (toolCallId) {
          lastRunToolCallId = toolCallId;
          if (part?.data?.success === true) {
            lastSuccessfulRunToolCallId = toolCallId;
          }
        }
      }
    }

    return lastSuccessfulRunToolCallId ?? lastRunToolCallId;
  }, [message.parts]);

  const structuredMainResponse = useMemo(() => getStructuredResponseMainContent(message), [message]);
  const structuredDescription = useMemo(() => getStructuredResponseDescription(message), [message]);
  
  // 구조화된 응답이 진행 중인지 여부를 useMemo로 관리
  const isInProgress = useMemo(() => isStructuredResponseInProgress(message), [message]);

  const hasStructuredData = useMemo(() => {
    // 메인 응답 내용이 있거나, 구조화된 응답이 진행 중일 때 true
    return !!(structuredMainResponse || isInProgress);
  }, [structuredMainResponse, isInProgress]);


  const hasAnyContent = hasContent || structuredMainResponse || isInProgress; // hasAnyContent도 진행 중 상태 고려

  // Bookmark status is now managed by parent component

  // 마지막 어시스턴트 메시지인지 확인
  const isLastAssistantMessage = isLastMessage && message.role === 'assistant';
  
  // 마지막 사용자 메시지인지 확인
  const isLastUserMessage = useMemo(() => {
    if (message.role !== 'user' || !allMessages) return false;
    
    const currentIndex = allMessages.findIndex((msg: any) => msg.id === message.id);
    if (currentIndex === -1) return false;
    
    // 현재 메시지 이후에 사용자 메시지가 있는지 확인
    const hasLaterUserMessage = allMessages
      .slice(currentIndex + 1)
      .some((msg: any) => msg.role === 'user');
    
    return !hasLaterUserMessage;
  }, [message.id, message.role, allMessages]);

  // 모바일 여부 확인
  const [isMobile, setIsMobile] = useState(false);
  
  // 롱프레스 관련 상태 추가 (단순화)
  const [longPressActive, setLongPressActive] = useState(false);
  const [showActionsDesktop, setShowActionsDesktop] = useState(false);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [touchStartTime, setTouchStartTime] = useState<number>(0);
  const [touchStartY, setTouchStartY] = useState<number>(0);
  const [isLongPressActive, setIsLongPressActive] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<'top' | 'bottom'>('top');
  const [bubbleTransform, setBubbleTransform] = useState('scale(1) translateY(0)');
  const [preCalculatedMenuPosition, setPreCalculatedMenuPosition] = useState<{top: string, left: string, right: string, display: string} | null>(null);
  const isSelectionModeActive = isMessageSelectionMode && typeof onToggleMessageSelection === 'function';
  
  // 오버레이 메트릭스 상태 추가 (긴 메시지 축소용)
  const [overlayMetrics, setOverlayMetrics] = useState<{
    scale: number;
    originalRect: DOMRect;
    overlayPosition: { top: number; left: number };
    needsScaling: boolean;
  } | null>(null);
  
  // 애니메이션 상태 추가
  const [overlayPhase, setOverlayPhase] = useState<'idle' | 'entering' | 'active' | 'exiting'>('idle');
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // 텍스트 선택 모달 관련 상태
  const [showTextSelectionModal, setShowTextSelectionModal] = useState(false);
  const [convertedText, setConvertedText] = useState('');
  const [markdownText, setMarkdownText] = useState('');
  const [isMarkdownView, setIsMarkdownView] = useState(true);
  const textSelectionRef = useRef<HTMLPreElement>(null);
  // Select Text 모달: 닫을 때만 애니메이션 + 손잡이 드래그 (모바일)
  const [selectTextElements, setSelectTextElements] = useState({ modal: false, title: false, content: false });
  const [selectTextClosing, setSelectTextClosing] = useState(false);
  const [selectTextDragging, setSelectTextDragging] = useState(false);
  const [selectTextDragStartY, setSelectTextDragStartY] = useState(0);
  const [selectTextCurrentTranslateY, setSelectTextCurrentTranslateY] = useState(0);
  // 데스크탑: Launchpad 스타일 (panelElements: background → content)
  const [selectTextPanelElements, setSelectTextPanelElements] = useState({ background: false, content: false });

  // 애니메이션 타임아웃 정리 함수
  const clearAnimationTimeout = useCallback(() => {
    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current);
      animationTimeoutRef.current = null;
    }
  }, []);
  
  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      clearAnimationTimeout();
    };
  }, [clearAnimationTimeout]);

  // 데스크탑 프로필 사진 메뉴 애니메이션
  useEffect(() => {
    if (showActionsDesktop && !isMobile && avatarRef.current) {
      // 다음 프레임에서 애니메이션 시작
      requestAnimationFrame(() => {
        const menuElement = document.querySelector('.desktop-avatar-menu') as HTMLElement;
        if (menuElement) {
          menuElement.style.transform = 'translateY(0)';
          menuElement.style.opacity = '1';
        }
      });
    }
  }, [showActionsDesktop, isMobile]);

  // 롱프레스 취소 핸들러 (UI 복귀 애니메이션 후 상태 초기화)
  const handleLongPressCancel = useCallback(() => {
    clearAnimationTimeout();
    
    // 세그먼트 그림자 효과 제거
    if (aiBubbleRef.current) {
      const segments = aiBubbleRef.current.querySelectorAll('.message-segment');
      segments.forEach((segment) => {
        segment.classList.remove('touch-start-shadow');
        segment.classList.remove('long-press-shadow');
      });
    }
    
    // 🚀 FIX: targetBubbleRef 초기화
    targetBubbleRef.current = null;
    
    // 일반 메시지(긴 메시지가 아닌)인 경우 즉시 취소
    if (!overlayMetrics?.needsScaling) {
      setLongPressActive(false);
      setIsLongPressActive(false);
      setPreCalculatedMenuPosition(null);
      setOverlayMetrics(null);
      setBubbleTransform('scale(1) translateY(0)');
      setOverlayPhase('idle');
      return;
    }
    
    // 긴 메시지인 경우: 적용 과정의 역순으로 진행
    // 1. 먼저 오버레이를 축소 상태로 유지하면서 원본 메시지를 다시 보이게 함
    setOverlayPhase('exiting');
    
    // 2. 150ms 후 원본 메시지가 완전히 나타나면 오버레이 제거
    animationTimeoutRef.current = setTimeout(() => {
      setLongPressActive(false);
      setIsLongPressActive(false);
      setPreCalculatedMenuPosition(null);
      setOverlayMetrics(null);
      setBubbleTransform('scale(1) translateY(0)');
      setOverlayPhase('idle');
      targetBubbleRef.current = null; // 🚀 FIX: targetBubbleRef 초기화
    }, 300); // 150ms (원본 메시지 페이드인) + 150ms (오버레이 페이드아웃)
  }, [clearAnimationTimeout, overlayMetrics]);

  useEffect(() => {
    if (!isSelectionModeActive) return;
    if (longPressActive) {
      handleLongPressCancel();
    }
    if (showActionsDesktop) {
      setShowActionsDesktop(false);
    }
  }, [isSelectionModeActive, longPressActive, showActionsDesktop, handleLongPressCancel]);

  const handleSelectionToggle = useCallback((e?: React.SyntheticEvent) => {
    if (!isSelectionModeActive || !onToggleMessageSelection) return;
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    onToggleMessageSelection(message.id);
  }, [isSelectionModeActive, onToggleMessageSelection, message.id]);

  // 메시지 컨텐츠를 순수 텍스트로 변환하는 함수
  const convertMessageToText = useCallback((message: any, preserveMarkdown?: boolean): string => {
    // 1. 기본 텍스트 추출
    let text = '';
    if (message.content) {
      text = message.content;
    } else if (message.parts && Array.isArray(message.parts)) {
      const textParts = message.parts.filter((part: any) => part.type === 'text');
      text = textParts.map((part: any) => part.text || '').join('\n');
    }

    if (!text) return '';

    // 2. linkMap과 imageMap 추출
    const webSearchData = getWebSearchResults(message);
    const googleSearchData = getGoogleSearchData(message);
    
    const combinedLinkMap = {
      ...(linkMap || {}),
      ...(webSearchData?.linkMap || {}),
      ...(googleSearchData?.linkMap || {})
    };
    
    const combinedImageMap = {
      ...(imageMap || {}),
      ...(webSearchData?.imageMap || {}),
      ...(googleSearchData?.imageMap || {})
    };

    const combinedVideoMap = {
      ...(videoMap || {})
    };

    // 3. 중복 링크 제거
    if (text.includes('[LINK_ID:')) {
      text = removeConsecutiveDuplicateLinks(text, combinedLinkMap);
    }

    // 4. 이미지 플레이스홀더 처리
    if (text.includes('[IMAGE_ID:')) {
      text = text.replace(IMAGE_ID_REGEX, (match: string, imageId: string) => {
        if (combinedImageMap && Object.keys(combinedImageMap).length > 0) {
          const imageUrl = combinedImageMap[imageId];
          if (imageUrl) {
            return imageUrl;
          }
        }
        return '';
      });
    }

    // 5. 링크 플레이스홀더 처리
    if (text.includes('[LINK_ID:')) {
      text = text.replace(LINK_ID_REGEX, (match: string, linkId: string) => {
        if (combinedLinkMap && Object.keys(combinedLinkMap).length > 0) {
          const linkUrl = combinedLinkMap[linkId];
          if (linkUrl) {
            return linkUrl;
          }
        }
        return '';
      });
    }

    // 6. 비디오 플레이스홀더 처리
    if (text.includes('[VIDEO_ID:')) {
      text = text.replace(VIDEO_ID_REGEX, (match: string, videoId: string) => {
        if (combinedVideoMap && Object.keys(combinedVideoMap).length > 0) {
          const videoEntry = combinedVideoMap[videoId];
          if (videoEntry) {
            return getVideoUrlWithSize(videoEntry);
          }
        }
        return '';
      });
    }

    // 7–12. 마크다운 스트립 (preserveMarkdown일 때 생략)
    if (!preserveMarkdown) {
      // 7. 마크다운 이미지 처리: ![alt](url) -> url
      text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, url) => {
        return url;
      });

      // 7. 마크다운 링크 처리: [text](url) -> text (url)
      text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, linkText, url) => {
        return `${linkText} (${url})`;
      });

      // 8. 마크다운 헤더 제거: # Header -> Header
      text = text.replace(/^#{1,6}\s+(.+)$/gm, '$1');

      // 9. 볼드/이탤릭 제거: **bold** -> bold, *italic* -> italic
      text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
      text = text.replace(/\*([^*]+)\*/g, '$1');
      text = text.replace(/__([^_]+)__/g, '$1');
      text = text.replace(/_([^_]+)_/g, '$1');

      // 10. 인라인 코드: `code` -> code
      text = text.replace(/`([^`]+)`/g, '$1');

      // 11. 코드 블록: ```language\ncode\n``` -> code (언어 정보는 제거)
      text = text.replace(/```[\w]*\n([\s\S]*?)```/g, '$1');

      // 12. 리스트 마커 제거: - item -> item, 1. item -> item
      text = text.replace(/^[\s]*[-*+]\s+(.+)$/gm, '$1');
      text = text.replace(/^[\s]*\d+\.\s+(.+)$/gm, '$1');
    }

    // 13. 첨부파일 정보 추가
    if (message.experimental_attachments && Array.isArray(message.experimental_attachments)) {
      const attachmentInfo: string[] = [];
      message.experimental_attachments.forEach((attachment: any) => {
        if (attachment.contentType?.startsWith('image/')) {
          attachmentInfo.push(`[Image: ${attachment.name || attachment.url || 'image'}]`);
        } else {
          attachmentInfo.push(`[File: ${attachment.name || 'file'} (${attachment.contentType || 'unknown'})]`);
        }
      });
      if (attachmentInfo.length > 0) {
        text += '\n\n' + attachmentInfo.join('\n');
      }
    }

    // 14. 구조화된 응답 파일 정보 추가
    const annotations = (message.annotations || []) as any[];
    const structuredResponseAnnotation = annotations.find(
      annotation => annotation.type === 'structured_response'
    );
    
    let fileInfo = '';
    if (structuredResponseAnnotation?.data?.response?.files?.length > 0) {
      const files = structuredResponseAnnotation.data.response.files;
      fileInfo = '\n\nSupporting files:\n' + 
        files.map((file: any) => `- ${file.name}${file.description ? `: ${file.description}` : ''}`).join('\n');
    }
    
    const messageWithTools = message as any;
    if (!fileInfo && messageWithTools.tool_results?.structuredResponse?.response?.files?.length > 0) {
      const files = messageWithTools.tool_results.structuredResponse.response.files;
      fileInfo = '\n\nSupporting files:\n' + 
        files.map((file: any) => `- ${file.name}${file.description ? `: ${file.description}` : ''}`).join('\n');
    }
    
    if (fileInfo) {
      text += fileInfo;
    }

    return text.trim();
  }, [linkMap, imageMap, videoMap, IMAGE_ID_REGEX, VIDEO_ID_REGEX, LINK_ID_REGEX, removeConsecutiveDuplicateLinks, getVideoUrlWithSize]);

  // 텍스트 선택 모달 열기 핸들러 (나올 땐 바로 표시, 닫을 때만 애니메이션)
  const handleOpenTextSelectionModal = useCallback(() => {
    const plain = convertMessageToText(message, false);
    const markdown = convertMessageToText(message, true);
    setConvertedText(plain);
    setMarkdownText(markdown);
    setIsMarkdownView(true);
    if (isMobile) {
      setSelectTextElements({ modal: true, title: true, content: true });
    } else {
      // 데스크탑: 애니메이션 없이 즉시 표시
      setSelectTextPanelElements({ background: true, content: true });
    }
    setShowTextSelectionModal(true);
    handleLongPressCancel();
  }, [message, convertMessageToText, handleLongPressCancel, isMobile]);

  // 텍스트 선택 모달 닫기 핸들러
  const handleCloseTextSelectionModal = useCallback(() => {
    if (isMobile) {
      setSelectTextClosing(true);
      setTimeout(() => setSelectTextElements((prev) => ({ ...prev, content: false })), 0);
      setTimeout(() => setSelectTextElements((prev) => ({ ...prev, title: false })), 100);
      setTimeout(() => setSelectTextElements((prev) => ({ ...prev, modal: false })), 400);
      setTimeout(() => {
        setShowTextSelectionModal(false);
        setConvertedText('');
        setMarkdownText('');
        setSelectTextClosing(false);
      }, 500);
    } else {
      setShowTextSelectionModal(false);
      setConvertedText('');
      setMarkdownText('');
    }
  }, [isMobile]);

  // Select Text 모달: 모바일 드래그하여 닫기
  const handleSelectTextTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isMobile) return;
    setSelectTextDragging(true);
    setSelectTextDragStartY(e.touches[0].clientY);
    setSelectTextCurrentTranslateY(0);
  }, [isMobile]);

  const handleSelectTextTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isMobile || !selectTextDragging) return;
    e.preventDefault();
    const currentY = e.touches[0].clientY;
    const diff = currentY - selectTextDragStartY;
    if (diff > 0) setSelectTextCurrentTranslateY(diff);
  }, [isMobile, selectTextDragging, selectTextDragStartY]);

  const handleSelectTextTouchEnd = useCallback(() => {
    if (!isMobile || !selectTextDragging) return;
    setSelectTextDragging(false);
    if (selectTextCurrentTranslateY > 100) {
      handleCloseTextSelectionModal();
    } else {
      setSelectTextCurrentTranslateY(0);
    }
  }, [isMobile, selectTextDragging, selectTextCurrentTranslateY, handleCloseTextSelectionModal]);

  // 모달이 열릴 때 전체 텍스트 자동 선택
  useEffect(() => {
    const displayed = isMarkdownView ? markdownText : convertedText;
    if (showTextSelectionModal && displayed && textSelectionRef.current) {
      // DOM이 렌더링된 후 선택 실행
      const selectAllText = () => {
        try {
          const selection = window.getSelection();
          const range = document.createRange();
          
          if (textSelectionRef.current) {
            range.selectNodeContents(textSelectionRef.current);
            selection?.removeAllRanges();
            selection?.addRange(range);
          }
        } catch (error) {
          console.error('Failed to select text:', error);
        }
      };

      // 애니메이션이 완료된 후 선택 (약간의 지연)
      const timeoutId = setTimeout(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(selectAllText);
        });
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [showTextSelectionModal, isMarkdownView, markdownText, convertedText]);

  // Select Text 모달: 닫힐 때 애니메이션 상태 리셋
  useEffect(() => {
    if (!showTextSelectionModal) {
      setSelectTextElements({ modal: false, title: false, content: false });
      setSelectTextClosing(false);
      setSelectTextDragging(false);
      setSelectTextCurrentTranslateY(0);
      setSelectTextPanelElements({ background: false, content: false });
    }
  }, [showTextSelectionModal]);


  useEffect(() => {
    const checkIfMobile = () => {
      const isTouchDevice = typeof window !== 'undefined' && ('ontouchstart' in window || (navigator.maxTouchPoints != null && navigator.maxTouchPoints > 0));
      setIsMobile(window.innerWidth < 640 || !!isTouchDevice);
    };
    
    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);
    return () => window.removeEventListener('resize', checkIfMobile);
  }, []);

  // 화면 크기 변경 시 오버레이 메트릭스 재계산
  useEffect(() => {
    const handleResize = () => {
      if (longPressActive && overlayMetrics?.needsScaling) {
        // 화면 크기가 변경되면 롱프레스 취소
        handleLongPressCancel();
      }
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [longPressActive, overlayMetrics, handleLongPressCancel]);

  // 롱프레스 타이머 정리
  useEffect(() => {
    return () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
      }
    };
  }, [longPressTimer]);

  // 롱프레스 활성화 시 단순한 상태 관리 (스크롤 잠금 제거)
  useEffect(() => {
    if (longPressActive) {
      // 강력한 스크롤 방지
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.height = '100%';
      
      // 터치 이벤트 전역 방지
      const preventTouchMove = (e: TouchEvent) => {
        e.preventDefault();
        e.stopPropagation();
      };
      
      const preventScroll = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
      };
      
      // iMessage와 유사한 하단 위치 조정 로직
      let newTransform = 'scale(1.05)'; 
      
      // 사용자 메시지: 하이브리드 접근 - 메시지 근처 우선, 화면 벗어날 때만 하단 고정
      if (dropdownPosition === 'bottom' && bubbleRef.current && isUser) {
        const rect = bubbleRef.current.getBoundingClientRect();
        const menuHeight = 220; // 더보기 버튼 추가 반영
        const margin = 16;
        const viewportHeight = window.innerHeight;
        const menuBottomMargin = 20;
        const messageToMenuMargin = 8;
        
        // 1. 먼저 메시지 바로 아래에 메뉴를 배치해보기
        const preferredMenuTop = rect.bottom + margin;
        const preferredMenuBottom = preferredMenuTop + menuHeight;
        
        // 2. 메뉴가 화면을 벗어나는지 확인
        const menuWouldGoOffscreen = preferredMenuBottom > viewportHeight - menuBottomMargin;
        
        if (menuWouldGoOffscreen) {
          // 3. 화면을 벗어나면 메뉴를 하단에 고정하고 메시지 조정
          const menuTop = viewportHeight - menuBottomMargin - menuHeight;
          
          // 메시지가 메뉴와 겹치는지 확인
          const messageBottom = rect.bottom;
          const messageWouldOverlap = messageBottom + messageToMenuMargin > menuTop;
          
          if (messageWouldOverlap) {
            // 메시지를 메뉴 위로 이동 (겹치지 않도록)
            const targetBubbleBottom = menuTop - messageToMenuMargin;
            const translateY = targetBubbleBottom - messageBottom;
            newTransform = `translateY(${translateY}px) scale(1.05)`;
          } else {
            // 겹치지 않으면 단순 확대만
            newTransform = 'scale(1.05)';
          }
        } else {
          // 4. 공간이 충분하면 메시지 근처에 메뉴 배치 (메시지 이동 없음)
          newTransform = 'scale(1.05)';
        }
      }
      
      // AI 메시지: 메뉴 위치에 따라 메시지 위치 조정
      if (dropdownPosition === 'bottom' && aiBubbleRef.current && isAssistant) {
        if (overlayMetrics === null) {
          // 일반 메시지: 메뉴가 하단에 고정될 때만 메시지 이동
          const rect = aiBubbleRef.current.getBoundingClientRect();
          const menuHeight = 260; // 더보기 버튼 추가 반영
          const margin = 16;
          const viewportHeight = window.innerHeight;
          const menuBottomMargin = 40;
          const messageToMenuMargin = 8;
          
          // 메뉴가 화면을 벗어나는지 확인
          const preferredMenuTop = rect.bottom + margin;
          const preferredMenuBottom = preferredMenuTop + menuHeight;
          const menuWouldGoOffscreen = preferredMenuBottom > viewportHeight - menuBottomMargin;
          
          if (menuWouldGoOffscreen) {
            // 메뉴가 하단에 고정될 때 메시지를 메뉴 위로 이동
            const menuTop = viewportHeight - menuBottomMargin - menuHeight;
            const messageBottom = rect.bottom;
            const messageWouldOverlap = messageBottom + messageToMenuMargin > menuTop;
            
            if (messageWouldOverlap) {
              // 메시지를 메뉴 위로 이동 (겹치지 않도록)
              const targetBubbleBottom = menuTop - messageToMenuMargin;
              const translateY = targetBubbleBottom - messageBottom;
              newTransform = `translateX(3px) translateY(${translateY - 8}px) scale(1.005)`;
            } else {
              // 겹치지 않으면 단순 확대만
              newTransform = 'translateX(3px) translateY(-8px) scale(1.005)';
            }
          } else {
            // 공간이 충분하면 모바일에서 살짝 우측 이동 + 확대
            if (isMobile) {
              newTransform = 'translateX(3px) scale(1.005)';
            } else {
              newTransform = 'scale(1) translateY(0)';
            }
          }
        } else if (!overlayMetrics?.needsScaling) {
          newTransform = 'translateX(3px) translateY(-8px) scale(1.005)';
        }
      }
      
      // 긴 메시지의 경우 오버레이를 사용하므로 원본 메시지 transform 제거
      if (overlayMetrics?.needsScaling) {
        setBubbleTransform('scale(1) translateY(0)');
      } else {
        setBubbleTransform(newTransform);
      }

      const handleScrollCancel = () => {
        handleLongPressCancel();
      };
      
      const handleClickOutside = (e: MouseEvent) => {
        const target = e.target as Element;
        // 메시지 버블, 드롭다운 메뉴, follow-up questions가 아닌 다른 곳을 클릭했을 때 닫기
        if (!target.closest('.imessage-send-bubble') && 
            !target.closest('.chat-input-tooltip-backdrop') &&
            !target.closest('.follow-up-questions-container') &&
            !target.closest('.follow-up-questions-wrapper')) {
          handleLongPressCancel();
        }
      };
      
      // 모든 스크롤 및 터치 이벤트 방지
      document.addEventListener('touchmove', preventTouchMove, { passive: false });
      document.addEventListener('scroll', preventScroll, { passive: false });
      document.addEventListener('wheel', preventScroll, { passive: false });
      window.addEventListener('scroll', handleScrollCancel, { passive: true });
      window.addEventListener('resize', handleScrollCancel);
      document.addEventListener('click', handleClickOutside);
      
      // 🚀 FollowUpQuestions에서 롱프레스 취소 이벤트 듣기
      const handleLongPressCancelEvent = () => {
        handleLongPressCancel();
      };
      window.addEventListener('longPressCancel', handleLongPressCancelEvent);
      
      return () => {
        // 스크롤 복원
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.width = '';
        document.body.style.height = '';
        
        document.removeEventListener('touchmove', preventTouchMove);
        document.removeEventListener('scroll', preventScroll);
        document.removeEventListener('wheel', preventScroll);
        window.removeEventListener('scroll', handleScrollCancel);
        window.removeEventListener('resize', handleScrollCancel);
        document.removeEventListener('click', handleClickOutside);
        window.removeEventListener('longPressCancel', handleLongPressCancelEvent);
      };
    } else {
      // 롱프레스 비활성화 시 변환 초기화
      setBubbleTransform('scale(1) translateY(0)');
    }
  }, [longPressActive, dropdownPosition]);

  // 터치 시작 핸들러 (사용자 메시지용)
  const handleUserTouchStart = (e: React.TouchEvent) => {
    if (isSelectionModeActive) return;
    if (!isMobile || !isUser) return;
    
    // 스크롤 방지를 위한 preventDefault
    e.preventDefault();
    e.stopPropagation();
    
    setTouchStartTime(Date.now());
    setTouchStartY(e.touches[0].clientY);
    setIsLongPressActive(false);
    
    // 항상 메뉴가 메시지 아래에 나오도록 설정
    setDropdownPosition('bottom');
    
    // 롱프레스 타이머 시작 (500ms)
    const timer = setTimeout(() => {
      setLongPressActive(true);
      setIsLongPressActive(true);
    }, 500);
    
    setLongPressTimer(timer);
  };

  // 터치 시작 핸들러 (AI 메시지용) - iOS Safari 호환성 개선
  const handleAITouchStart = (e: React.TouchEvent, targetBubble?: HTMLElement | null) => {
    if (isSelectionModeActive) return;
    if (!isMobile || !isAssistant) return;
    
    // iOS Safari: 하위 요소의 이벤트를 즉시 차단
    e.stopPropagation();
    
    setTouchStartTime(Date.now());
    setTouchStartY(e.touches[0].clientY);
    setIsLongPressActive(false);
    
    // 항상 메뉴가 메시지 아래에 나오도록 설정
    setDropdownPosition('bottom');
    
    // 타겟 버블 결정: 전달된 버블 또는 aiBubbleRef 또는 이벤트 타겟의 부모
    const bubbleElement = targetBubble || aiBubbleRef.current || (e.currentTarget as HTMLElement);
    
    // 🚀 FIX: 실제 탭한 버블 저장 (메뉴 위치 계산용)
    targetBubbleRef.current = bubbleElement;
    
    // 인터리브 모드인 경우 컨테이너 전체를 기준으로 계산
    const containerElement = useInterleavedMode && interleavedContainerRef.current
      ? interleavedContainerRef.current
      : bubbleElement;
    
    // 터치 시작 직후 세그먼트에 그림자 효과 추가 (롱프레스 전)
    if (bubbleElement) {
      // 현재 버블에 그림자 효과 추가
      bubbleElement.classList.add('touch-start-shadow');
      bubbleElement.classList.add('long-press-shadow');
      
      // 첫 번째 세그먼트인 경우 모든 세그먼트에 효과 추가 (기존 동작 유지)
      if (aiBubbleRef.current && bubbleElement === aiBubbleRef.current) {
        const segments = aiBubbleRef.current.querySelectorAll('.message-segment');
        segments.forEach((segment) => {
          segment.classList.add('touch-start-shadow');
          segment.classList.add('long-press-shadow');
        });
      }
    }
    
    // 인터리브 모드인 경우 컨테이너의 모든 버블에 그림자 효과 추가
    if (useInterleavedMode && interleavedContainerRef.current) {
      const allBubbles = interleavedContainerRef.current.querySelectorAll('.imessage-receive-bubble');
      allBubbles.forEach((bubble) => {
        bubble.classList.add('touch-start-shadow');
        bubble.classList.add('long-press-shadow');
      });
    }
    
    // 터치 시작 시점에 메뉴 위치 미리 계산 (glitch 방지)
    if (containerElement) {
      const rect = containerElement.getBoundingClientRect();
      const menuHeight = 260; // 더보기 버튼 추가 반영
      const margin = 16;
      const viewportHeight = window.innerHeight;
      const menuBottomMargin = 40;
      
      // 긴 메시지 축소 로직 계산
      const availableSpace = viewportHeight - menuBottomMargin - menuHeight - margin;
      const needsScaling = rect.height > availableSpace;
      
      let scale = 1;
      let overlayPosition = { top: rect.top, left: rect.left };
      
      if (needsScaling) {
        // 축소 비율 계산 (최소 0.3, 최대 1.0)
        scale = Math.max(0.3, Math.min(1.0, availableSpace / rect.height));
        
        // 축소된 높이
        const scaledHeight = rect.height * scale;
        
        // 오버레이 위치 계산: 메뉴 바로 위에 배치
        const targetBottom = viewportHeight - menuBottomMargin - menuHeight;
        const overlayTop = Math.max(margin, targetBottom - scaledHeight);
        
        // 수평 중앙 정렬 (화면 너비 내에서)
        const maxWidth = window.innerWidth - (margin * 2);
        const scaledWidth = rect.width * scale;
        const overlayLeft = Math.max(margin, Math.min(
          rect.left, 
          window.innerWidth - scaledWidth - margin
        ));
        
        overlayPosition = { top: overlayTop, left: overlayLeft };
        
        // 오버레이 메트릭스 저장 (긴 메시지만)
        setOverlayMetrics({
          scale,
          originalRect: rect,
          overlayPosition,
          needsScaling: true
        });
      } else {
        // 일반 메시지는 오버레이 메트릭스를 설정하지 않음 (위치 변화 방지)
        setOverlayMetrics(null);
      }
      
      // 1. 먼저 메시지 바로 아래에 메뉴를 배치해보기 (일반 메시지는 원본 위치 기준)
      const preferredMenuTop = needsScaling ? overlayPosition.top + (rect.height * scale) + margin : rect.bottom + margin;
      const preferredMenuBottom = preferredMenuTop + menuHeight;
      
      // 2. 메뉴가 화면을 벗어나는지 확인
      const menuWouldGoOffscreen = preferredMenuBottom > viewportHeight - menuBottomMargin;
      
      let menuPosition;
      if (menuWouldGoOffscreen) {
        // 3. 화면을 벗어나면 하단에 고정
        menuPosition = {
          top: `${viewportHeight - menuHeight - menuBottomMargin}px`,
          left: '16px',
          right: 'auto',
          display: 'block'
        };
      } else {
        // 4. 공간이 충분하면 메시지 바로 아래에 배치 (약간의 여유 공간 추가)
        menuPosition = {
          top: `${preferredMenuTop + 2}px`, // 2px 여유 공간 추가
          left: '16px',
          right: 'auto',
          display: 'block'
        };
      }
      
      setPreCalculatedMenuPosition(menuPosition);
    }
    
    // 롱프레스 타이머 시작 (500ms)
    const timer = setTimeout(() => {
      setLongPressActive(true);
      setIsLongPressActive(true);
      
      // 롱프레스 활성화 시 세그먼트에 그림자 효과 추가
      if (bubbleElement) {
        bubbleElement.classList.add('long-press-shadow');
        
        // 첫 번째 세그먼트인 경우 모든 세그먼트에 효과 추가 (기존 동작 유지)
        if (aiBubbleRef.current && bubbleElement === aiBubbleRef.current) {
          const segments = aiBubbleRef.current.querySelectorAll('.message-segment');
          segments.forEach((segment) => {
            segment.classList.add('long-press-shadow');
          });
        }
      }
      
      // 인터리브 모드인 경우 컨테이너의 모든 버블에 롱프레스 그림자 효과 추가
      if (useInterleavedMode && interleavedContainerRef.current) {
        const allBubbles = interleavedContainerRef.current.querySelectorAll('.imessage-receive-bubble');
        allBubbles.forEach((bubble) => {
          bubble.classList.add('long-press-shadow');
        });
      }
      
      // 모든 롱프레스에 애니메이션 시작 (축소 필요 여부와 관계없이)
      setOverlayPhase('entering');
      animationTimeoutRef.current = setTimeout(() => {
        setOverlayPhase('active');
      }, 150); // 150ms 후 active 상태로 전환
      
      // iOS Safari: 롱프레스 활성화 시 스크롤 방지
      if (typeof window !== 'undefined' && navigator.userAgent.includes('Safari') && !navigator.userAgent.includes('Chrome')) {
        document.body.style.overflow = 'hidden';
        document.body.style.position = 'fixed';
        document.body.style.width = '100%';
      }
    }, 500);
    
    setLongPressTimer(timer);
  };

  // 터치 종료 핸들러 (사용자 메시지용)
  const handleUserTouchEnd = (e: React.TouchEvent) => {
    if (isSelectionModeActive) return;
    if (!isMobile || !isUser) return;
    
    e.preventDefault();
    
    // 타이머 정리
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
    
    const touchEndTime = Date.now();
    const touchDuration = touchEndTime - touchStartTime;
    
    // 롱프레스가 활성화된 상태에서는 일반 클릭 방지
    if (isLongPressActive) {
      return;
    }
    
    // 짧은 터치인 경우 일반 클릭으로 처리 (아무것도 하지 않음)
    if (touchDuration < 500 && !longPressActive) {
      // 일반 클릭은 아무것도 하지 않음
    }
    
    // 롱프레스 상태 초기화 (touchStartY는 유지)
    setLongPressActive(false);
    setIsLongPressActive(false);
  };

  // 터치 종료 핸들러 (AI 메시지용) - iOS Safari 호환성 개선
  const handleAITouchEnd = (e: React.TouchEvent, targetBubble?: HTMLElement | null) => {
    if (isSelectionModeActive) return;
    if (!isMobile || !isAssistant) return;
    
    e.stopPropagation();
    
    // 타이머 정리
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
    
    const touchEndTime = Date.now();
    const touchDuration = touchEndTime - touchStartTime;
    
    // 롱프레스가 활성화된 상태에서는 일반 클릭 방지
    if (isLongPressActive) {
      // iOS Safari: 스크롤 복원은 handleLongPressCancel에서 처리
      return;
    }
    
    // 짧은 터치인 경우 일반 클릭으로 처리 (아무것도 하지 않음)
    if (touchDuration < 500 && !longPressActive) {
      // 일반 클릭은 아무것도 하지 않음
    }
    
    // 타겟 버블 결정: 전달된 버블 또는 aiBubbleRef 또는 이벤트 타겟
    const bubbleElement = targetBubble || aiBubbleRef.current || (e.currentTarget as HTMLElement);
    
    // 터치 종료 시 세그먼트 그림자 효과 제거
    if (bubbleElement) {
      bubbleElement.classList.remove('touch-start-shadow');
      bubbleElement.classList.remove('long-press-shadow');
      
      // 첫 번째 세그먼트인 경우 모든 세그먼트에서 효과 제거 (기존 동작 유지)
      if (aiBubbleRef.current && bubbleElement === aiBubbleRef.current) {
        const segments = aiBubbleRef.current.querySelectorAll('.message-segment');
        segments.forEach((segment) => {
          segment.classList.remove('touch-start-shadow');
          segment.classList.remove('long-press-shadow');
        });
      }
    }
    
    // 롱프레스 상태 초기화 (touchStartY는 유지)
    setLongPressActive(false);
    setIsLongPressActive(false);
  };

  // 터치 이동 핸들러 (스크롤 방지) - 사용자 메시지용
  const handleUserTouchMove = (e: React.TouchEvent) => {
    if (isSelectionModeActive) return;
    if (!isMobile || !isUser) return;
    
    // 롱프레스 활성화 시 스크롤 완전 방지
    if (longPressActive || isLongPressActive) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  // 터치 이동 핸들러 (스크롤 방지) - AI 메시지용
  const handleAITouchMove = (e: React.TouchEvent, targetBubble?: HTMLElement | null) => {
    if (isSelectionModeActive) return;
    if (!isMobile || !isAssistant) return;
    
    const currentY = e.touches[0].clientY;
    const deltaY = Math.abs(currentY - touchStartY);
    
    // iOS Safari: 약간의 움직임이 있으면 롱프레스 취소 (10px 이상)
    if (deltaY > 10 && !longPressActive) {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        setLongPressTimer(null);
      }
      
      // 타겟 버블 결정: 전달된 버블 또는 aiBubbleRef 또는 이벤트 타겟
      const bubbleElement = targetBubble || aiBubbleRef.current || (e.currentTarget as HTMLElement);
      
      // 스크롤 감지 시 세그먼트 그림자 효과 제거
      if (bubbleElement) {
        bubbleElement.classList.remove('touch-start-shadow');
        bubbleElement.classList.remove('long-press-shadow');
        
        // 첫 번째 세그먼트인 경우 모든 세그먼트에서 효과 제거 (기존 동작 유지)
        if (aiBubbleRef.current && bubbleElement === aiBubbleRef.current) {
          const segments = aiBubbleRef.current.querySelectorAll('.message-segment');
          segments.forEach((segment) => {
            segment.classList.remove('touch-start-shadow');
            segment.classList.remove('long-press-shadow');
          });
        }
      }
      return;
    }
    
    // 롱프레스 활성화 시 스크롤 완전 방지
    if (longPressActive || isLongPressActive) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  // 메시지가 긴지 또는 파일이 있는지 확인
  const isLongOrHasFiles = useMemo(() => {
    // 파일이 있는 경우
    if (hasAttachments) return true;
    
    // 메시지가 긴 경우 (200자 이상) - AI SDK v5 호환
    if (hasContent) {
      // message.content가 있으면 확인
      if (message.content && message.content.length > 200) return true;
      
      // parts 배열에서 텍스트 길이 확인
      if (message.parts && Array.isArray(message.parts)) {
        const textParts = message.parts.filter((part: any) => part.type === 'text');
        const totalTextLength = textParts.reduce((total: number, part: any) => 
          total + (part.text ? part.text.length : 0), 0
        );
        if (totalTextLength > 200) return true;
      }
    }
    
    return false;
  }, [hasAttachments, hasContent, message.content, message.parts]);

  // 조건에 따른 최소 높이 계산
  const getMinHeight = useMemo(() => {
    if (!isLastAssistantMessage) return '';
    
    if (isMobile) {
      return isLongOrHasFiles ? 'min-h-[calc(100vh-16rem)]' : 'min-h-[calc(100vh-24rem)]';
    } else {
      // 데스크탑은 항상 32rem으로 통일
      return 'min-h-[calc(100vh-32rem)]';
    }
  }, [isLastAssistantMessage, isLongOrHasFiles, isMobile]);

  // Toggle bookmark function - now uses parent callback
  const toggleBookmark = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // 🚀 익명 사용자 지원: 익명 사용자는 북마크 불가 - iMessage 스타일로 표시
    if (!user || user.id === 'anonymous' || user.id.startsWith('anonymous_')) {
      // 재생성과 같은 방식으로 iMessage 스타일 메시지 표시
      const signupPromptMessage = {
        id: `signup-prompt-bookmark-${Date.now()}`,
        role: 'assistant',
        content: '',
        createdAt: new Date(),
        parts: [],
        annotations: [
          {
            type: 'signup_prompt',
            data: {
              message: 'Please sign in to bookmark',
              upgradeUrl: '/login'
            }
          }
        ]
      };
      
      // Messages 컴포넌트의 setMessages에 접근하기 위해 이벤트 사용
      window.dispatchEvent(new CustomEvent('addSignupPrompt', {
        detail: { message: signupPromptMessage }
      }));
      return;
    }
    
    if (!message.id || !chatId || isBookmarksLoading || !onBookmarkToggle) return;
    
    try {
      await onBookmarkToggle(message.id, !isBookmarked);
    } catch (error) {
      console.error('Error toggling bookmark:', error);
    }
  };

  const hasTextContent = useMemo(() => {
    if (message.content) return true;
    if (message.parts?.some((p: any) => p.type === 'text' && p.text)) return true;
    return false;
  }, [message]);

  const hasAnyRenderableContent = useMemo(() => {
    if (message.content) return true;
    if (message.parts?.some((p: any) => p.type === 'text' && p.text)) return true;
    if (structuredDescription) return true;
    if (hasAttachments) return true;
    
    // 🚀 도구 프리뷰 데이터가 있는 경우도 렌더링할 컨텐츠가 있는 것으로 간주
    if (webSearchData || mathCalculationData || linkReaderData || imageGeneratorData || 
        geminiImageData || seedreamImageData || qwenImageData || wan25VideoData || grokVideoData || videoUpscalerData || imageUpscalerData || twitterSearchData || 
        youTubeSearchData || youTubeLinkAnalysisData || googleSearchData) return true;

    return false;
  }, [message, structuredDescription, hasAttachments, 
      webSearchData, mathCalculationData, linkReaderData, imageGeneratorData, 
      geminiImageData, seedreamImageData, qwenImageData, wan25VideoData, grokVideoData, videoUpscalerData, imageUpscalerData, twitterSearchData, 
      youTubeSearchData, youTubeLinkAnalysisData, googleSearchData]);

  const hasInlineToolPreview = useMemo(() => {
    if (!useInterleavedMode) return false;
    return segments.some((segment) => segment.type === 'tool');
  }, [useInterleavedMode, segments]);

  // Check if message has rate limit status annotation
  const rateLimitAnnotation = useMemo(() => {
    if (!message.annotations) return null;
    return message.annotations.find((annotation: any) => annotation?.type === 'rate_limit_status');
  }, [message.annotations]);

  // Check if message has signup prompt annotation
  const signupPromptAnnotation = useMemo(() => {
    if (!message.annotations) return null;
    return message.annotations.find((annotation: any) => annotation?.type === 'signup_prompt');
  }, [message.annotations]);

  // Type guard for rate limit annotation data
  const rateLimitData = useMemo(() => {
    if (!rateLimitAnnotation || typeof rateLimitAnnotation !== 'object' || !('data' in rateLimitAnnotation)) {
      return null;
    }
    return rateLimitAnnotation.data as {
      minutesUntilReset?: number;
      upgradeUrl?: string;
      model?: string;
      level?: string;
      hourlyLimit?: number;
      hourlyWindow?: string;
      dailyLimit?: number;
      dailyWindow?: string;
      reset?: string;
    };
  }, [rateLimitAnnotation]);

  // Type guard for signup prompt annotation data
  const signupPromptData = useMemo(() => {
    if (!signupPromptAnnotation || typeof signupPromptAnnotation !== 'object' || !('data' in signupPromptAnnotation)) {
      return null;
    }
    return signupPromptAnnotation.data as {
      message?: string;
      upgradeUrl?: string;
    };
  }, [signupPromptAnnotation]);

  const chatTranslations = useMemo(() => getChatInputTranslations(), []);

  return (
    <div className={`message-group group animate-fade-in md:text-sm ${getMinHeight}`} id={message.id}>
      <UnifiedInfoPanel
        reasoningPart={reasoningPart}
        isAssistant={isAssistant}
        hasAnyContent={hasAnyContent}
        isWaitingForToolResults={isWaitingForToolResults}
        isStreaming={isStreaming}
        reasoningComplete={reasoningComplete}
        isReasoningInProgress={isReasoningInProgress}
        reasoningPartExpanded={reasoningPartExpanded}
        setReasoningPartExpanded={setReasoningPartExpanded}
        userOverrideReasoningPartRef={userOverrideReasoningPartRef}
        loadingReasoningKey={loadingReasoningKey}
        completeReasoningKey={completeReasoningKey}
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
        messageId={message.id}
        togglePanel={togglePanel}
        activePanel={activePanel}
        searchTerm={searchTerm} // 🚀 FEATURE: Pass search term for highlighting
        useInterleavedMode={useInterleavedMode} // 🚀 인터리브 모드에서는 도구 미리보기 숨김
        chatId={chatId}
        userId={user?.id}
      />
      {/* Rate Limit Status Message */}
      {rateLimitAnnotation && (
        <>
          {/* Upgrade Card */}
          <div className="flex justify-start mb-4">
            <div className="max-w-[85%] md:max-w-[75%] w-full" style={{ overflow: 'visible' }}>
              {rateLimitData && (
                <div 
                  className="bg-[#1E1E1E] dark:bg-black rounded-2xl p-6 border border-neutral-800 text-center text-white relative overflow-hidden"
                >
                  <div 
                    className="absolute inset-0"
                    style={{
                      backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px)',
                      backgroundSize: '20px 20px',
                    }}
                  />
                  <div className="relative">
                    <h3 className="font-bold text-xl">More with Pro</h3>
                    <p className="text-sm text-gray-400 mt-2">
                      Upgrade to Pro to continue the conversation, or try again later.
                    </p>
                    <div className="mt-6">
                      <button
                        onClick={handleUpgradeClick}
                        className="bg-white text-black font-semibold py-2 px-4 rounded-full transition-transform transform hover:scale-105 cursor-pointer"
                      >
                        {chatTranslations.upgrade}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* AI Message Bubble */}
          <div className="flex justify-start mb-4">
            <div className="max-w-[85%] md:max-w-[75%]" style={{ overflow: 'visible' }}>
              {rateLimitData && (
                <div className="imessage-receive-bubble">
                  <p className="text-sm">
                    You've reached your limit of {rateLimitData.hourlyLimit || 10} {getModelById(rateLimitData?.model || '')?.name || 'questions'} per {rateLimitData.hourlyWindow?.replace('h', ' hours') || '12 hours'} (Level {rateLimitData?.level?.replace('level', '') || '0'}) for now. Please sign up for Pro to access more or check back later.
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Signup Prompt Message */}
      {signupPromptAnnotation && (
        <div className="flex justify-start mb-4">
          <div className="max-w-[85%] md:max-w-[75%]" style={{ overflow: 'visible' }}>
            {signupPromptData && (
              <div className="imessage-receive-bubble">
                <p className="text-sm">
                  {signupPromptData.message?.includes('sign in') ? (
                    <>
                      {signupPromptData.message?.split('sign in')[0] || ''}
                      <button
                        onClick={() => window.location.href = signupPromptData.upgradeUrl || '/login'}
                        className="text-blue-500 underline hover:text-blue-600 cursor-pointer"
                      >
                        sign in
                      </button>
                      {signupPromptData.message?.split('sign in')[1] || ''}
                    </>
                  ) : (
                    signupPromptData.message || ''
                  )}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
      <div
        className={`relative flex ${isUser ? `justify-end` : `justify-start`} ${isUser ? 'mt-10 sm:mt-12 mb-0 sm:mb-10' : ''} ${isSelectionModeActive ? 'cursor-pointer' : ''} ${isSelectionModeActive && isUser ? 'pl-8' : ''}`}
        onClick={isSelectionModeActive ? handleSelectionToggle : undefined}
      >
        {isSelectionModeActive && isUser && (
          <div className="absolute left-0 top-1/2 z-30 -translate-y-1/2 sm:-left-16">
            <div
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                isMessageSelected
                  ? 'border-[#007AFF] bg-[#007AFF]'
                  : 'border-(--muted) opacity-50'
              }`}
              onClick={(e) => {
                e.stopPropagation();
                handleSelectionToggle();
              }}
            >
              {isMessageSelected && (
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              )}
            </div>
          </div>
        )}
        {isUser ? (
          <div className="w-full" style={{ minHeight: containerMinHeight }}>
            {isEditing ? (
              <div 
                className="w-full animate-edit-in-view"
                ref={editingContainerRef}
                onDragEnter={handleDrag}
                onDragLeave={handleDragLeave}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <div className="flex flex-col items-end gap-0 w-full">
                  {editingFiles.length > 0 && (
                    <div className="flex flex-col items-end gap-0 mb-2 w-full">
                      <EditingFilePreview 
                        files={editingFiles}
                        fileMap={editingFileMap}
                        removeFile={handleRemoveFile}
                      />
                    </div>
                  )}
                  <div className="relative w-full">
                    <div className="imessage-edit-bubble">
                      <textarea
                        ref={textareaRef}
                        value={editingContent}
                        onChange={(e) => {
                          setEditingContent(e.target.value);
                          const textarea = e.currentTarget;
                          textarea.style.height = 'auto';
                          const scrollHeight = textarea.scrollHeight;
                          if (typeof window !== 'undefined') {
                            const maxHeight = parseInt(window.getComputedStyle(textarea).maxHeight, 10);
                            if (scrollHeight > maxHeight) {
                              textarea.style.height = `${maxHeight}px`;
                            } else {
                              textarea.style.height = `${scrollHeight}px`;
                            }
                          } else {
                            textarea.style.height = `${scrollHeight}px`;
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleEditSave();
                          }
                        }}
                        className="imessage-edit-textarea scrollbar-thin"
                        placeholder="Edit your message..."
                      />
                    </div>
                    {dragActive && <DragDropOverlay dragActive={dragActive} supportsPDFs={true} />}
                  </div>

                  <div className="flex w-full items-center justify-between gap-2 mt-2 relative z-20">
                    <div className="flex items-center gap-2">
                      <button onClick={handleFileSelect} className="imessage-edit-control-btn" title="Add files">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14,2 14,8 20,8"/><path d="M12 18v-6"/><path d="M9 15h6"/></svg>
                      </button>
                      <span className="text-xs text-neutral-500/80">or drag & drop files</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <input ref={fileInputRef} type="file" multiple onChange={handleFileChange} className="hidden" accept="image/*,video/*,audio/*,text/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.7z,.tar,.gz" />
                      <button onClick={handleEditCancel} className="imessage-edit-control-btn cancel" title="Cancel">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                      <button onClick={handleEditSave} className="imessage-edit-control-btn save" title="Save">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20,6 9,17 4,12"/></svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div ref={viewRef}>
                <div className="flex flex-col items-end gap-1">
                  {hasAttachments && (allAttachments as any[])!.map((attachment: any, index: number) => (
                    <AttachmentPreview 
                      key={`${message.id}-att-${index}`} 
                      attachment={attachment} 
                      messageId={message.id}
                      chatId={chatId}
                      attachmentIndex={index}
                      togglePanel={togglePanel}
                      isMobile={isMobile}
                    />
                  ))}
                  {(() => {
                    // Prefer parts text when content is empty
                    const sourceText = hasContent
                      ? processedContent
                      : (processedParts?.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('\n') || '');
                    if (!sourceText) return null;
                    
                    // 더 정확한 URL 감지 - HTML 속성이나 코드 내의 URL은 제외
                    const urlRegex = /(https?:\/\/[^\s"'<>]+)/g;
                    const matches = sourceText.match(urlRegex) || [];
                    
                    // URL 유효성 검사 및 필터링
                    const validUrls = matches.filter((url: string) => {
                      try {
                        const parsedUrl = new URL(url);
                        // HTML 속성이나 코드 내의 URL 제외
                        if (url.includes('xmlns=') || url.includes('href=') || url.includes('src=')) {
                          return false;
                        }
                        // 네임스페이스 URL 제외
                        if (parsedUrl.hostname === 'www.w3.org' && parsedUrl.pathname.includes('/2000/svg')) {
                          return false;
                        }
                        // 일반적인 웹사이트 URL만 허용
                        return ['http:', 'https:'].includes(parsedUrl.protocol);
                      } catch {
                        return false;
                      }
                    });
                    
                    if (isStreaming) return null;
                    
                    return validUrls.map((url: string, index: number) => (
                      <LinkPreview key={`${message.id}-url-${index}`} url={url} isStreaming={isStreaming} hideThumbnail />
                    ));
                  })()}
                  {(hasTextContent) && (
                    <div className="relative">
                      <div 
                        className={`imessage-send-bubble ${longPressActive ? 'long-press-scaled no-tail' : ''}`}
                        ref={bubbleRef}
                        onTouchStart={handleUserTouchStart}
                        onTouchEnd={handleUserTouchEnd}
                        onTouchMove={handleUserTouchMove}
                        onClick={!isMobile && !isSelectionModeActive ? (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleEditStartClick();
                        } : undefined}
                  style={{
                    WebkitTapHighlightColor: 'transparent',
                    WebkitTouchCallout: 'none',
                    WebkitUserSelect: 'none',
                    userSelect: 'none',
                    cursor: isSelectionModeActive ? 'pointer' : (!isMobile ? 'pointer' : 'default'),
                    transform: bubbleTransform,
                    transition: 'transform 0.3s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
                    boxShadow: 'none',
                    touchAction: longPressActive ? 'none' : 'auto',
                    overscrollBehavior: 'contain',
                    zIndex: longPressActive ? 10 : 'auto',
                    position: longPressActive ? 'relative' : 'static',
                  }}
                      >
                        {userMessageSegments ? (
                          <UserMessageContentWithUploads
                            segments={userMessageSegments}
                            uploadedImageMetaMap={uploadedImageMetaMap}
                            imageMap={imageMap}
                            searchTerm={searchTerm}
                          />
                        ) : (
                          <UserMessageContent 
                            content={
                              hasContent 
                                ? processedContent 
                                : (processedParts?.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('\n') || '')
                            }
                            searchTerm={searchTerm}
                          />
                        )}
                      </div>
                      
                      {/* 롱프레스 드롭다운: Portal 사용으로 DOM 계층 분리 */}
                      {longPressActive && !isSelectionModeActive && createPortal(
                        <>
                          <div 
                            className="fixed w-56 chat-input-tooltip-backdrop rounded-2xl z-99999 overflow-hidden tool-selector"
                style={{
                  // 하이브리드 접근: 메시지 근처 우선, 화면 벗어날 때만 하단 고정
                  ...(() => {
                    if (!bubbleRef.current) return { display: 'none' };
                    const rect = bubbleRef.current.getBoundingClientRect();
                    const menuHeight = 220; // 더보기 버튼 추가 반영
                    const margin = 16;
                    const viewportHeight = window.innerHeight;
                    const menuBottomMargin = 20;
                    
                    if (dropdownPosition === 'top') {
                      return {
                        top: `${rect.top - menuHeight - margin}px`,
                        right: '16px',
                        left: 'auto',
                        display: 'block'
                      };
                    } else {
                      // 1. 먼저 메시지 바로 아래에 메뉴를 배치해보기
                      const preferredMenuTop = rect.bottom + margin;
                      const preferredMenuBottom = preferredMenuTop + menuHeight;
                      
                      // 2. 메뉴가 화면을 벗어나는지 확인
                      const menuWouldGoOffscreen = preferredMenuBottom > viewportHeight - menuBottomMargin;
                      
                      if (menuWouldGoOffscreen) {
                        // 3. 화면을 벗어나면 하단에 고정
                        return {
                          top: `${viewportHeight - menuHeight - menuBottomMargin}px`,
                          right: '16px',
                          left: 'auto',
                          display: 'block'
                        };
                      } else {
                        // 4. 공간이 충분하면 메시지 바로 아래에 배치
                        return {
                          top: `${preferredMenuTop}px`,
                          right: '16px',
                          left: 'auto',
                          display: 'block'
                        };
                      }
                    }
                  })(),
                              // 기존 스타일 + 드롭다운
                              backgroundColor: 'rgba(255, 255, 255, 0.5)',
                              backdropFilter: isMobile ? 'blur(10px) saturate(180%)' : 'url(#glass-distortion) blur(10px) saturate(180%)',
                              WebkitBackdropFilter: isMobile ? 'blur(10px) saturate(180%)' : 'url(#glass-distortion) blur(10px) saturate(180%)',
                              border: '1px solid rgba(255, 255, 255, 0.2)',
                              boxShadow: '0 8px 40px rgba(0, 0, 0, 0.06), 0 4px 20px rgba(0, 0, 0, 0.04), 0 2px 8px rgba(0, 0, 0, 0.025), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
                              // 다크모드 전용 스타일
                              ...(typeof window !== 'undefined' && (
                                document.documentElement.getAttribute('data-theme') === 'dark' || 
                                (document.documentElement.getAttribute('data-theme') === 'system' && 
                                 window.matchMedia('(prefers-color-scheme: dark)').matches)
                              ) ? {
                                backgroundColor: 'rgba(0, 0, 0, 0.05)',
                                backdropFilter: isMobile ? 'blur(24px)' : 'url(#glass-distortion-dark) blur(24px)',
                                WebkitBackdropFilter: isMobile ? 'blur(24px)' : 'url(#glass-distortion-dark) blur(24px)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25), 0 4px 16px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                              } : {})
                            }}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              // 드롭다운 내부 클릭은 닫지 않음
                            }}
                          >
                          <div className="flex flex-col gap-2 space-y-2">
                            {/* 편집 버튼 */}
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                e.nativeEvent.stopImmediatePropagation();
                                handleEditStartClick();
                                handleLongPressCancel();
                              }}
                              onTouchEnd={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                e.nativeEvent.stopImmediatePropagation();
                                handleEditStartClick();
                                handleLongPressCancel();
                              }}
                              className="flex items-center gap-3 px-5 pt-4 transition-colors duration-150 rounded-xl tool-button"
                              style={{
                                '--hover-bg': 'color-mix(in srgb, var(--foreground) 3%, transparent)',
                                '--active-bg': 'color-mix(in srgb, var(--foreground) 5%, transparent)',
                                WebkitTapHighlightColor: 'transparent',
                                WebkitTouchCallout: 'none',
                                WebkitUserSelect: 'none',
                                userSelect: 'none'
                              } as any}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--hover-bg)'}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                              onMouseDown={(e) => e.currentTarget.style.backgroundColor = 'var(--active-bg)'}
                              onMouseUp={(e) => e.currentTarget.style.backgroundColor = 'var(--hover-bg)'}
                            > 
                              <div className="w-6 h-6 flex items-center justify-center">
                                <IoCreateOutline size={20} style={{ color: 'var(--foreground)' }} />
                              </div>
                              <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Edit</span>
                            </button>

                            {/* 텍스트 선택 버튼 */}
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                e.nativeEvent.stopImmediatePropagation();
                                handleOpenTextSelectionModal();
                              }}
                              onTouchEnd={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                e.nativeEvent.stopImmediatePropagation();
                                handleOpenTextSelectionModal();
                              }}
                              className="flex items-center gap-3 px-5 transition-colors duration-150 rounded-xl tool-button"
                              style={{
                                '--hover-bg': 'color-mix(in srgb, var(--foreground) 3%, transparent)',
                                '--active-bg': 'color-mix(in srgb, var(--foreground) 5%, transparent)',
                                WebkitTapHighlightColor: 'transparent',
                                WebkitTouchCallout: 'none',
                                WebkitUserSelect: 'none',
                                userSelect: 'none'
                              } as any}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--hover-bg)'}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                              onMouseDown={(e) => e.currentTarget.style.backgroundColor = 'var(--active-bg)'}
                              onMouseUp={(e) => e.currentTarget.style.backgroundColor = 'var(--hover-bg)'}
                            >
                              <div className="w-6 h-6 flex items-center justify-center">
                                <IoDocumentTextOutline size={20} style={{ color: 'var(--foreground)' }} />
                              </div>
                              <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Select Text</span>
                            </button>

                            {/* 복사 버튼 */}
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                e.nativeEvent.stopImmediatePropagation();
                                onCopy(message);
                                handleLongPressCancel();
                              }}
                              onTouchEnd={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                e.nativeEvent.stopImmediatePropagation();
                                onCopy(message);
                                handleLongPressCancel();
                              }}
                              className="flex items-center gap-3 px-5 transition-colors duration-150 rounded-xl tool-button"
                              style={{
                                '--hover-bg': 'color-mix(in srgb, var(--foreground) 3%, transparent)',
                                '--active-bg': 'color-mix(in srgb, var(--foreground) 5%, transparent)',
                                WebkitTapHighlightColor: 'transparent',
                                WebkitTouchCallout: 'none',
                                WebkitUserSelect: 'none',
                                userSelect: 'none'
                              } as any}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--hover-bg)'}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                              onMouseDown={(e) => e.currentTarget.style.backgroundColor = 'var(--active-bg)'}
                              onMouseUp={(e) => e.currentTarget.style.backgroundColor = 'var(--hover-bg)'}
                            >
                              <div className="w-6 h-6 flex items-center justify-center">
                                {isCopied ? (
                                  <IoCheckmarkOutline size={20} style={{ color: 'var(--status-text-complete)' }} />
                                ) : (
                                  <IoCopyOutline size={20} style={{ color: 'var(--foreground)' }} />
                                )}
                              </div>
                              <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                                {isCopied ? 'Copied' : 'Copy'}
                              </span>
                            </button>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                e.nativeEvent.stopImmediatePropagation();
                                onEnterMessageSelectionMode?.(message.id);
                                handleLongPressCancel();
                              }}
                              onTouchEnd={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                e.nativeEvent.stopImmediatePropagation();
                                onEnterMessageSelectionMode?.(message.id);
                                handleLongPressCancel();
                              }}
                              className="flex items-center gap-3 px-5 pb-4 transition-colors duration-150 rounded-xl tool-button"
                              style={{
                                '--hover-bg': 'color-mix(in srgb, var(--foreground) 3%, transparent)',
                                '--active-bg': 'color-mix(in srgb, var(--foreground) 5%, transparent)',
                                WebkitTapHighlightColor: 'transparent',
                                WebkitTouchCallout: 'none',
                                WebkitUserSelect: 'none',
                                userSelect: 'none'
                              } as any}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--hover-bg)'}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                              onMouseDown={(e) => e.currentTarget.style.backgroundColor = 'var(--active-bg)'}
                              onMouseUp={(e) => e.currentTarget.style.backgroundColor = 'var(--hover-bg)'}
                            >
                              <div className="w-6 h-6 flex items-center justify-center">
                                <IoEllipsisHorizontal size={20} style={{ color: 'var(--foreground)' }} />
                              </div>
                              <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>More</span>
                            </button>
                          </div>
                        </div>
                        </>,
                        typeof window !== 'undefined' ? document.body : (null as any)
                      )}
                    </div>
                  )}
                  <div className="text-[10px] text-neutral-500 mt-1 pr-1 h-[14px]">
                    {isLastUserMessage && formatMessageTime((message as any).createdAt || new Date())}
                  </div>
                </div>              
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-end gap-5 group/assistant relative max-w-full assistant-message-container">
              {!isSelectionModeActive && !isMobile && (
                <div ref={avatarRef} className="shrink-0 -mb-1 z-10 avatar-container -ml-12 sm:-ml-16" style={{ overflow: 'visible' }}>
                  <AssistantAvatar
                    modelId={displayModel || ''}
                    onClick={() => {
                      if (isSelectionModeActive) return;
                      setShowActionsDesktop(!showActionsDesktop);
                    }}
                  />
                </div>
              )}
              {isSelectionModeActive && (
                <div
                  className={`shrink-0 -mb-1 z-10 avatar-container ${isMobile ? 'ml-0 mr-1' : '-ml-12 sm:-ml-16'}`}
                  style={{ overflow: 'visible' }}
                >
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                      isMessageSelected
                        ? 'border-[#007AFF] bg-[#007AFF]'
                        : 'border-(--muted) opacity-50'
                    }`}
                  >
                    {isMessageSelected && (
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    )}
                  </div>
                </div>
              )}
              <div className="flex flex-col min-w-0 flex-1 assistant-bubbles-wrapper">
                {/* 🚀 응답 시작 전 로딩 표시: 프사와 나란히 배치 */}
                {/* 🚀 SCROLL STABILITY: 항상 렌더링하되 조건에 따라 숨김 (레이아웃 시프트 방지) */}
                {isAssistant && isLastMessage && (
                  <div 
                    className="flex justify-start"
                    style={{
                      // 🚀 SCROLL STABILITY: 조건에 따라 높이/마진 조절
                      height: (isStreaming && !hasAnyRenderableContent && !structuredDescription && !hasInlineToolPreview) ? 'auto' : 0,
                      marginBottom: (isStreaming && !hasAnyRenderableContent && !structuredDescription && !hasInlineToolPreview) ? '0.5rem' : 0,
                      opacity: (isStreaming && !hasAnyRenderableContent && !structuredDescription && !hasInlineToolPreview) ? 1 : 0,
                      // 🚀 FIX: overflow: 'visible'로 변경하여 bubble tail 표시 허용
                      // imessage-receive-bubble의 ::before, ::after는 bubble 밖에 위치 (left: -8px, -26px)
                      overflow: 'visible',
                      transition: 'height 0.15s ease-out, opacity 0.15s ease-out, margin-bottom 0.15s ease-out',
                      contain: 'layout style',
                    }}
                  >
                    <div className="imessage-receive-bubble" style={{ 
                      width: 'fit-content', 
                      minWidth: 'auto',
                      minHeight: 'auto',
                      padding: '8px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <TypingIndicator variant="compact" />
                    </div>
                  </div>
                )}
          {/* 🚀 인터리브 모드: 세그먼트 기반 렌더링 (Cursor 스타일) */}
          {useInterleavedMode && segments.length > 0 ? (
            <div className="interleaved-message-container" ref={interleavedContainerRef}>
              {/*
                Resolve video tool mode during processing:
                - toolArgs.model can be missing when UI forces a mode (e.g., grok_video_edit)
                - data-* started annotations include the effective model for Grok
                - use these to avoid showing "text-to-video" before the real mode is known
              */}
              {(() => {
                let runCodeInvocationIndex = -1;
                return segments.map((segment, idx) => {
                const isLastSegment = idx === segments.length - 1;
                const nextSegment = segments[idx + 1];
                const isNextText = nextSegment?.type === 'text';

                // 다음 세그먼트가 검색 도구인지 확인
                const nextIsSearch = nextSegment?.type === 'tool' && isSearchTool(nextSegment.content.call.toolName);
                // 다음 세그먼트가 파일/코드 도구인지 확인 (검색과 동일 꼬리 로직)
                const nextIsFileOrCode = nextSegment?.type === 'tool' && isFileOrCodeTool(nextSegment.content.call.toolName);

                const hasSubsequentContent = hasAttachments || (allAttachments && allAttachments.length > 0) || !!structuredDescription;

                if (segment.type === 'text') {
                  const nextIsTool = nextSegment?.type === 'tool';
                  const textHasTail = isLastSegment || nextIsTool;
                  const textMarginClass = (textHasTail && (!isLastSegment || hasSubsequentContent)) ? "mb-4" : "";

                  return (
                    <div key={`segment-text-${idx}`} className={`relative ${textMarginClass}`}>
                      <div 
                        className={`imessage-receive-bubble ${longPressActive ? 'long-press-scaled no-tail' : ''} ${!textHasTail ? 'no-tail' : ''}`}
                        ref={idx === 0 ? aiBubbleRef : undefined}
                        style={{ 
                          overflow: 'visible',
                          WebkitTapHighlightColor: 'transparent',
                          touchAction: longPressActive ? 'none' : 'auto',
                        }}
                        onTouchStart={(e) => {
                          const targetBubble = idx === 0 ? aiBubbleRef.current : (e.currentTarget as HTMLElement);
                          handleAITouchStart(e, targetBubble);
                        }}
                        onTouchEnd={(e) => {
                          const targetBubble = idx === 0 ? aiBubbleRef.current : (e.currentTarget as HTMLElement);
                          handleAITouchEnd(e, targetBubble);
                        }}
                        onTouchMove={(e) => {
                          const targetBubble = idx === 0 ? aiBubbleRef.current : (e.currentTarget as HTMLElement);
                          handleAITouchMove(e, targetBubble);
                        }}
                      >
                        <div className="imessage-content-wrapper">
                            <MarkdownContent 
                            content={(() => {
                              // 🚀 인터리브 모드에서도 IMAGE_ID/LINK_ID 변환 적용
                              let processedContent = segment.content;
                              
                              // 🔥 parts 기반으로 이미지 순서 재정렬 (InlineToolPreview 순서와 일치)
                              if (processedContent.includes('[IMAGE_ID:') && message.parts) {
                                processedContent = reorderImagesByPartsOrder(processedContent, message.parts);
                              }
                              
                              // IMAGE_ID 변환 (기존 로직과 동일)
                              if (processedContent.includes('[IMAGE_ID:')) {
                                processedContent = processedContent.replace(
                                  IMAGE_ID_REGEX,
                                  (match: string, imageId: string) => {
                                    if (imageMap && Object.keys(imageMap).length > 0) {
                                      const imageUrl = imageMap[imageId];
                                      if (imageUrl) {
                                        return `![](${imageUrl})`;
                                      }
                                    }
                                    return '';
                                  }
                                );
                              }

                              // VIDEO_ID 변환
                              if (processedContent.includes('[VIDEO_ID:')) {
                                processedContent = processedContent.replace(
                                  VIDEO_ID_REGEX,
                                  (match: string, videoId: string) => {
                                    if (videoMap && Object.keys(videoMap).length > 0) {
                                      const videoEntry = videoMap[videoId];
                                      if (videoEntry) {
                                        return getVideoUrlWithSize(videoEntry);
                                      }
                                    }
                                    return '';
                                  }
                                );
                              }
                              
                              // LINK_ID 변환도 동일하게 적용
                              if (processedContent.includes('[LINK_ID:')) {
                                processedContent = removeConsecutiveDuplicateLinks(processedContent, linkMap);
                                processedContent = processedContent.replace(
                                  LINK_ID_REGEX,
                                  (match: string, linkId: string) => {
                                    const linkUrl = linkMap[linkId];
                                    return linkUrl ? linkUrl : '';
                                  }
                                );
                              }
                              
                              return processedContent;
                            })()} 
                            enableSegmentation={isAssistant} 
                            searchTerm={searchTerm} 
                            messageType="assistant" 
                            thumbnailMap={thumbnailMap} 
                            titleMap={titleMap} 
                            linkPreviewData={linkPreviewData} 
                            isMobile={isMobile} 
                            isLongPressActive={longPressActive && !overlayMetrics?.needsScaling} 
                            isStreaming={isStreaming && isLastSegment}
                            messageId={message.id}
                            chatId={chatId}
                            userId={user?.id}
                            promptMap={promptMap}
                            sourceImageMap={sourceImageMap}
                            mediaDimensionsMap={mediaDimensionsMap}
                            linkMap={linkMap}
                            imageMap={imageMap}
                            videoMap={videoMap}
                            hideLinkThumbnail
                          />
                        </div>
                      </div>
                    </div>
                  );
                }
                
                if (segment.type === 'tool') {
                  const toolContent = segment.content as ToolSegmentContent;
                  const toolName = toolContent.call.toolName;
                  if (
                    toolName === 'run_python_code' &&
                    preferredRunCodeToolCallId &&
                    toolContent.call.toolCallId !== preferredRunCodeToolCallId
                  ) {
                    return null;
                  }
                  const toolArgs = toolContent.call.args;
                  const runCodeIndex = toolName === 'run_python_code' ? ++runCodeInvocationIndex : null;
                  const resolvedToolArgs = (() => {
                    if (!toolArgs || toolArgs.model) return toolArgs;
                    if (!Array.isArray(message.parts) || message.parts.length === 0) return toolArgs;
                    const prompt = toolArgs.prompt;
                    if (toolName === 'grok_video') {
                      const startPart = message.parts.find(
                        (p: any) =>
                          p?.type === 'data-grok_video_started' &&
                          (!prompt || p?.data?.prompt === prompt)
                      );
                      const startedModel = startPart?.data?.model;
                      if (startedModel) return { ...toolArgs, model: startedModel };
                      const isVideoEdit = message.parts.find(
                        (p: any) =>
                          p?.type === 'data-grok_video_complete' &&
                          (!prompt || p?.data?.prompt === prompt) &&
                          p?.data?.isVideoEdit
                      );
                      if (isVideoEdit) return { ...toolArgs, model: 'video-edit' };
                      const isImageToVideo = message.parts.find(
                        (p: any) =>
                          p?.type === 'data-grok_video_complete' &&
                          (!prompt || p?.data?.prompt === prompt) &&
                          p?.data?.isImageToVideo
                      );
                      if (isImageToVideo) return { ...toolArgs, model: 'image-to-video' };
                    }
                    if (toolName === 'wan25_video') {
                      const startPart = message.parts.find(
                        (p: any) =>
                          p?.type === 'data-wan25_video_started' &&
                          (!prompt || p?.data?.prompt === prompt)
                      );
                      const startedModel = startPart?.data?.model;
                      if (startedModel) return { ...toolArgs, model: startedModel };
                      const completePart = message.parts.find(
                        (p: any) =>
                          p?.type === 'data-wan25_video_complete' &&
                          (!prompt || p?.data?.prompt === prompt)
                      );
                      if (typeof completePart?.data?.isImageToVideo === 'boolean') {
                        return {
                          ...toolArgs,
                          model: completePart.data.isImageToVideo ? 'image-to-video' : 'text-to-video'
                        };
                      }
                    }
                    return toolArgs;
                  })();
                  
                  // 🚀 web_search/multi_search의 경우 topics 배열이 여러 개면 각 topic별로 별도 렌더링
                  const isMultiTopicSearch = (toolName === 'web_search' || toolName === 'multi_search') && 
                                            toolArgs?.topics && 
                                            Array.isArray(toolArgs.topics) && 
                                            toolArgs.topics.length > 1;
                  
                  // 🚀 google_search의 경우 engines 배열이 여러 개면 각 엔진별로 별도 렌더링
                  const isMultiEngineSearch = toolName === 'google_search' && 
                                            toolArgs?.engines && 
                                            Array.isArray(toolArgs.engines) && 
                                            toolArgs.engines.length > 1;
                  
                  // 🚀 google_search의 경우 queries 배열이 여러 개이고 engines가 1개 이하일 때 각 쿼리별로 별도 렌더링
                  const isMultiQuerySearch = toolName === 'google_search' && 
                                           toolArgs?.queries && 
                                           Array.isArray(toolArgs.queries) && 
                                           toolArgs.queries.length > 1 &&
                                           (!toolArgs.engines || !Array.isArray(toolArgs.engines) || toolArgs.engines.length <= 1);
                  
                  if (isMultiTopicSearch) {
                    return (
                      <React.Fragment key={`segment-tool-${idx}`}>
                        {toolArgs.topics.map((topic: string, topicIdx: number) => {
                          const isLastTopic = topicIdx === toolArgs.topics.length - 1;
                          const topicHasTail = !(!isLastTopic || nextIsSearch);
                          const topicMargin = (topicHasTail && (!isLastSegment || hasSubsequentContent)) ? "mb-4" : "";
                          
                          // 해당 topic에 속한 queries만 추출
                          let topicQueries: string[] = [];
                          
                          // toolResult에서 topic별 queries 추출
                          if (toolContent.result?.result) {
                            const toolResult = toolContent.result.result;
                            // results 배열에서 searches를 찾아 해당 topic의 queries 추출
                            if (toolResult.results && Array.isArray(toolResult.results)) {
                              toolResult.results.forEach((result: any) => {
                                if (result.searches && Array.isArray(result.searches)) {
                                  result.searches.forEach((search: any) => {
                                    if (search.topic === topic && search.query) {
                                      if (!topicQueries.includes(search.query)) {
                                        topicQueries.push(search.query);
                                      }
                                    }
                                  });
                                }
                              });
                            }
                            // 직접 searches 배열이 있는 경우
                            if (toolResult.searches && Array.isArray(toolResult.searches)) {
                              toolResult.searches.forEach((search: any) => {
                                if (search.topic === topic && search.query) {
                                  if (!topicQueries.includes(search.query)) {
                                    topicQueries.push(search.query);
                                  }
                                }
                              });
                            }
                          }
                          
                          // toolResult에서 찾지 못한 경우, toolArgs.queries와 topics의 인덱스 매핑 사용
                          if (topicQueries.length === 0 && toolArgs.queries && Array.isArray(toolArgs.queries)) {
                            // topics와 queries가 같은 인덱스로 매핑되어 있다고 가정
                            if (toolArgs.queries[topicIdx] !== undefined) {
                              topicQueries = [toolArgs.queries[topicIdx]];
                            } else {
                              // 인덱스 매핑이 안 되는 경우, 모든 queries를 포함 (fallback)
                              topicQueries = toolArgs.queries;
                            }
                          }
                          
                          return (
                            <div key={`segment-tool-${idx}-topic-${topicIdx}`} className={`relative ${topicMargin}`}>
                              <div 
                                className={`imessage-receive-bubble ${longPressActive ? 'long-press-scaled no-tail' : ''} ${!topicHasTail ? 'no-tail' : ''}`}
                                style={{ 
                                  overflow: 'visible',
                                  WebkitTapHighlightColor: 'transparent',
                                  touchAction: longPressActive ? 'none' : 'auto',
                                }}
                                onTouchStart={(e) => {
                                  const targetBubble = e.currentTarget as HTMLElement;
                                  handleAITouchStart(e, targetBubble);
                                }}
                                onTouchEnd={(e) => {
                                  const targetBubble = e.currentTarget as HTMLElement;
                                  handleAITouchEnd(e, targetBubble);
                                }}
                                onTouchMove={(e) => {
                                  const targetBubble = e.currentTarget as HTMLElement;
                                  handleAITouchMove(e, targetBubble);
                                }}
                              >
                                <InlineToolPreview
                                  toolName={toolName}
                                  toolArgs={{
                                    ...resolvedToolArgs,
                                    topics: [topic], // 단일 topic만 전달
                                    topic: topic, // topic도 개별로 설정
                                    queries: topicQueries.length > 0 ? topicQueries : (toolArgs.queries || []), // 해당 topic의 queries만 전달
                                    query: topicQueries.length > 0 ? topicQueries[0] : (toolArgs.query || ''), // 첫 번째 query도 설정
                                  }}
                                  toolResult={toolContent.result?.result}
                                  messageId={message.id}
                                  togglePanel={togglePanel}
                                  activePanel={activePanel}
                                  isProcessing={!toolContent.result}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </React.Fragment>
                    );
                  }
                  
                  if (isMultiEngineSearch) {
                    return (
                      <React.Fragment key={`segment-tool-${idx}`}>
                        {toolArgs.engines.map((engine: string, engineIdx: number) => {
                          const isLastEngine = engineIdx === toolArgs.engines.length - 1;
                          const engineHasTail = !(!isLastEngine || nextIsSearch);
                          const engineMargin = (engineHasTail && (!isLastSegment || hasSubsequentContent)) ? "mb-4" : "";
                          
                          // 각 엔진에 해당하는 쿼리만 추출
                          const correspondingQuery = toolArgs.queries && Array.isArray(toolArgs.queries) && toolArgs.queries[engineIdx] !== undefined
                            ? toolArgs.queries[engineIdx]
                            : toolArgs.query || '';
                          
                          return (
                            <div key={`segment-tool-${idx}-engine-${engineIdx}`} className={`relative ${engineMargin}`}>
                              <div 
                                className={`imessage-receive-bubble ${longPressActive ? 'long-press-scaled no-tail' : ''} ${!engineHasTail ? 'no-tail' : ''}`}
                                style={{ 
                                  overflow: 'visible',
                                  WebkitTapHighlightColor: 'transparent',
                                  touchAction: longPressActive ? 'none' : 'auto',
                                }}
                                onTouchStart={(e) => {
                                  const targetBubble = e.currentTarget as HTMLElement;
                                  handleAITouchStart(e, targetBubble);
                                }}
                                onTouchEnd={(e) => {
                                  const targetBubble = e.currentTarget as HTMLElement;
                                  handleAITouchEnd(e, targetBubble);
                                }}
                                onTouchMove={(e) => {
                                  const targetBubble = e.currentTarget as HTMLElement;
                                  handleAITouchMove(e, targetBubble);
                                }}
                              >
                                <InlineToolPreview
                                  toolName={toolName}
                                  toolArgs={{
                                    ...resolvedToolArgs,
                                    engines: [engine], // 단일 engine만 전달
                                    queries: correspondingQuery ? [correspondingQuery] : (toolArgs.queries || []), // 해당 인덱스의 쿼리만
                                    query: correspondingQuery || toolArgs.query, // 단일 쿼리도 설정
                                    topic: engine, // engine을 topic으로도 설정 (아이콘/이름 매핑용)
                                    engine: engine, // engine도 개별로 설정
                                  }}
                                  toolResult={toolContent.result?.result}
                                  messageId={message.id}
                                  togglePanel={togglePanel}
                                  activePanel={activePanel}
                                  isProcessing={!toolContent.result}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </React.Fragment>
                    );
                  }
                  
                  if (isMultiQuerySearch) {
                    return (
                      <React.Fragment key={`segment-tool-${idx}`}>
                        {toolArgs.queries.map((query: string, queryIdx: number) => {
                          const isLastQuery = queryIdx === toolArgs.queries.length - 1;
                          const queryHasTail = !(!isLastQuery || nextIsSearch);
                          const queryMargin = (queryHasTail && (!isLastSegment || hasSubsequentContent)) ? "mb-4" : "";
                          
                          // 각 쿼리에 해당하는 엔진 추출 (있으면)
                          const correspondingEngine = toolArgs.engines && Array.isArray(toolArgs.engines) && toolArgs.engines[queryIdx] !== undefined
                            ? toolArgs.engines[queryIdx]
                            : toolArgs.engines?.[0] || toolArgs.engine || 'google';
                          
                          return (
                            <div key={`segment-tool-${idx}-query-${queryIdx}`} className={`relative ${queryMargin}`}>
                              <div 
                                className={`imessage-receive-bubble ${longPressActive ? 'long-press-scaled no-tail' : ''} ${!queryHasTail ? 'no-tail' : ''}`}
                                style={{ 
                                  overflow: 'visible',
                                  WebkitTapHighlightColor: 'transparent',
                                  touchAction: longPressActive ? 'none' : 'auto',
                                }}
                                onTouchStart={(e) => {
                                  const targetBubble = e.currentTarget as HTMLElement;
                                  handleAITouchStart(e, targetBubble);
                                }}
                                onTouchEnd={(e) => {
                                  const targetBubble = e.currentTarget as HTMLElement;
                                  handleAITouchEnd(e, targetBubble);
                                }}
                                onTouchMove={(e) => {
                                  const targetBubble = e.currentTarget as HTMLElement;
                                  handleAITouchMove(e, targetBubble);
                                }}
                              >
                                <InlineToolPreview
                                  toolName={toolName}
                                  toolArgs={{
                                    ...resolvedToolArgs,
                                    queries: [query], // 단일 쿼리만 전달
                                    query: query, // 단일 쿼리 필드도 설정
                                    engines: [correspondingEngine], // 해당 인덱스의 엔진 또는 기본값
                                    topic: correspondingEngine, // engine을 topic으로도 설정 (아이콘/이름 매핑용)
                                    engine: correspondingEngine, // engine도 개별로 설정
                                  }}
                                  toolResult={toolContent.result?.result}
                                  messageId={message.id}
                                  togglePanel={togglePanel}
                                  activePanel={activePanel}
                                  isProcessing={!toolContent.result}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </React.Fragment>
                    );
                  }
                  
                  // 단일 도구 또는 단일 topic/engine/query인 경우 기존 로직
                  // 검색/파일·코드 도구 모두: 연속 시 마지막만 꼬리
                  const toolHasTail = !(
                    (isSearchTool(toolName) && nextIsSearch) ||
                    (isFileOrCodeTool(toolName) && nextIsFileOrCode)
                  );
                  const toolMargin = (toolHasTail && (!isLastSegment || hasSubsequentContent)) ? "mb-4" : "";

                          // write_file / apply_edits / run_python_code / browser_observe: diff card without bubble wrapper
                          if (isOutcomeFileTool(toolName) || toolName === 'run_python_code' || toolName === 'browser_observe') {
                            const runCodeData = toolName === 'run_python_code'
                              ? getRunCodeData(message, toolContent.call.toolCallId, runCodeIndex ?? undefined)
                              : null;
                            const browserObserveData = toolName === 'browser_observe'
                              ? getBrowserObserveData(message, toolContent.call.toolCallId)
                              : null;
                            return (
                              <div key={`segment-tool-${idx}`} className={`relative ${toolMargin}`}>
                                <InlineToolPreview
                                  toolName={toolName}
                                  toolArgs={resolvedToolArgs}
                                  toolResult={toolName === 'run_python_code' ? runCodeData : (toolName === 'browser_observe' ? browserObserveData : toolContent.result?.result)}
                                  messageId={message.id}
                                  togglePanel={togglePanel}
                                  activePanel={activePanel}
                                  isProcessing={!toolContent.result && !runCodeData && !browserObserveData}
                                  chatId={chatId}
                                  toolCallId={toolContent.call.toolCallId}
                                  isLastBubble={toolHasTail}
                                  isNoTail={!toolHasTail}
                                />
                              </div>
                            );
                          }

                  return (
                    <div key={`segment-tool-${idx}`} className={`relative ${toolMargin}`}>
                      <div 
                        className={`imessage-receive-bubble ${longPressActive ? 'long-press-scaled no-tail' : ''} ${!toolHasTail ? 'no-tail' : ''}`}
                        style={{ 
                          overflow: 'visible',
                          WebkitTapHighlightColor: 'transparent',
                          touchAction: longPressActive ? 'none' : 'auto',
                        }}
                        onTouchStart={(e) => {
                          const targetBubble = e.currentTarget as HTMLElement;
                          handleAITouchStart(e, targetBubble);
                        }}
                        onTouchEnd={(e) => {
                          const targetBubble = e.currentTarget as HTMLElement;
                          handleAITouchEnd(e, targetBubble);
                        }}
                        onTouchMove={(e) => {
                          const targetBubble = e.currentTarget as HTMLElement;
                          handleAITouchMove(e, targetBubble);
                        }}
                      >
                        <InlineToolPreview
                          toolName={toolName}
                          toolArgs={resolvedToolArgs}
                          toolResult={toolContent.result?.result}
                          messageId={message.id}
                          togglePanel={togglePanel}
                          activePanel={activePanel}
                          isProcessing={!toolContent.result}
                        />
                      </div>
                    </div>
                  );
                }
                
                if (segment.type === 'reasoning') {
                  // Reasoning은 UnifiedInfoPanel에서 처리되므로 여기서는 스킵
                  return null;
                }
                
                return null;
                });
              })()}
              
              {/* 첨부파일 (인터리브 모드에서도 표시) */}
              {hasAttachments && (
                <div className={`space-y-1 ${!!structuredDescription ? 'mb-4' : 'mb-2'}`}>
                  {(allAttachments as any[])!.map((attachment: any, index: number) => (
                    <AttachmentPreview key={`${message.id}-att-${index}`} attachment={attachment} isMobile={isMobile} messageId={message.id} chatId={chatId} />
                  ))}
                </div>
              )}
              
              <div className={!!structuredDescription ? 'mb-4' : ''}>
                <FilesPreview
                  messageId={message.id}
                  togglePanel={togglePanel}
                  message={message}
                />
              </div>

              {structuredDescription && (
                <div className="imessage-receive-bubble">
                  <p>{structuredDescription}</p>
                </div>
              )}
            </div>
          ) : (
            /* 🚀 기존 방식: Fallback 렌더링 */
            (hasAnyRenderableContent || structuredDescription) && (
            <div className="relative">
              <div 
                className={`imessage-receive-bubble ${longPressActive ? 'long-press-scaled no-tail' : ''}`} 
                ref={aiBubbleRef} 
                style={{ 
                  overflow: 'visible',
                  WebkitTapHighlightColor: 'transparent',
                  WebkitTouchCallout: 'none',
                  WebkitUserSelect: 'none',
                  userSelect: 'none',
                  cursor: 'default',
                  transform: bubbleTransform,
                  transition: 'transform 0.4s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.3s cubic-bezier(0.22, 1, 0.36, 1), opacity 150ms cubic-bezier(0.22, 1, 0.36, 1), visibility 150ms cubic-bezier(0.22, 1, 0.36, 1)',
                  boxShadow: 'none',
                  touchAction: longPressActive ? 'none' : 'auto',
                  overscrollBehavior: 'contain',
                  zIndex: longPressActive ? 10 : 'auto',
                  position: longPressActive ? 'relative' : 'static',
                  // 긴 메시지에서 원본 버블 숨기기 (active 상태에서만, exiting에서는 다시 보이기)
                  opacity: (overlayMetrics?.needsScaling && overlayPhase === 'active') ? 0 : 1,
                  visibility: (overlayMetrics?.needsScaling && overlayPhase === 'active') ? 'hidden' : 'visible',
                }}
                onTouchStart={handleAITouchStart}
                onTouchEnd={handleAITouchEnd}
                onTouchMove={handleAITouchMove}
              >
                <div 
                  className="imessage-content-wrapper space-y-2"
                  style={{
                    pointerEvents: longPressActive && isMobile ? 'none' : 'auto',
                  }}
                >
                  {/* 기존 컨텐츠 렌더링 로직 */}
                  {hasAttachments && (
                    <div className={`space-y-1 ${ (processedParts?.length > 0 || hasContent || structuredDescription) ? 'mb-4' : ''}`}>
                      {(allAttachments as any[])!.map((attachment: any, index: number) => (
                        <AttachmentPreview key={`${message.id}-att-${index}`} attachment={attachment} messageId={message.id} chatId={chatId} />
                      ))}
                    </div>
                  )}
                
                  {message.parts ? (
                    processedParts?.map((part: any, index: number) => (
                    part.type === 'text' && <MarkdownContent key={index} content={part.text} enableSegmentation={isAssistant} searchTerm={searchTerm} messageType={isAssistant ? 'assistant' : 'user'} thumbnailMap={thumbnailMap} titleMap={titleMap} linkPreviewData={linkPreviewData} isMobile={isMobile} isLongPressActive={longPressActive && !overlayMetrics?.needsScaling} isStreaming={isStreaming} messageId={message.id} chatId={chatId} userId={user?.id} promptMap={promptMap} sourceImageMap={sourceImageMap} mediaDimensionsMap={mediaDimensionsMap} linkMap={linkMap} imageMap={imageMap} videoMap={videoMap} hideLinkThumbnail/>
                    ))
                  ) : (
                    (hasContent && !hasStructuredData) && <MarkdownContent content={processedContent} enableSegmentation={isAssistant} searchTerm={searchTerm} messageType={isAssistant ? 'assistant' : 'user'} thumbnailMap={thumbnailMap} titleMap={titleMap} linkPreviewData={linkPreviewData} isMobile={isMobile} isLongPressActive={longPressActive && !overlayMetrics?.needsScaling} isStreaming={isStreaming} messageId={message.id} chatId={chatId} userId={user?.id} promptMap={promptMap} sourceImageMap={sourceImageMap} mediaDimensionsMap={mediaDimensionsMap} linkMap={linkMap} imageMap={imageMap} videoMap={videoMap} hideLinkThumbnail/>
                  )}
                  
                  <div className={!!structuredDescription ? 'mb-4' : ''}>
                    <FilesPreview
                      messageId={message.id}
                      togglePanel={togglePanel}
                      message={message}
                    />
                  </div>

                  {structuredDescription && (
                    <div className="imessage-receive-bubble">
                      <p>{structuredDescription}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 배경 블러 오버레이: 긴 메시지만 적용 */}
          {longPressActive && !isSelectionModeActive && overlayMetrics?.needsScaling && isAssistant && (overlayPhase === 'entering' || overlayPhase === 'active' || overlayPhase === 'exiting') && createPortal(
            <div
              className="fixed inset-0 z-99998"
              style={{
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                transition: 'backdrop-filter 150ms cubic-bezier(0.22, 1, 0.36, 1), opacity 150ms cubic-bezier(0.22, 1, 0.36, 1)',
                opacity: (overlayPhase === 'entering' || overlayPhase === 'exiting') ? 0 : 1,
                pointerEvents: 'auto', // 🚀 FIX: 클릭 이벤트를 받을 수 있도록 설정
                cursor: 'pointer' // 🚀 FIX: 클릭 가능함을 시각적으로 표시
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                // 🚀 FIX: 배경 블러 클릭 시 롱프레스 취소
                handleLongPressCancel();
              }}
            />,
            typeof window !== 'undefined' ? document.body : (null as any)
          )}

          {/* 오버레이 렌더링: 긴 메시지만 적용 */}
          {longPressActive && !isSelectionModeActive && overlayMetrics?.needsScaling && isAssistant && (overlayPhase === 'entering' || overlayPhase === 'active' || overlayPhase === 'exiting') && createPortal(
            <div
              className="fixed z-99999"
              style={{
                top: `${overlayPhase === 'entering' ? overlayMetrics.overlayPosition.top : overlayPhase === 'exiting' ? overlayMetrics.originalRect.top : overlayMetrics.overlayPosition.top}px`,
                left: `${overlayPhase === 'entering' ? overlayMetrics.overlayPosition.left : overlayPhase === 'exiting' ? overlayMetrics.originalRect.left : overlayMetrics.overlayPosition.left}px`,
                transform: `scale(${overlayPhase === 'entering' ? overlayMetrics.scale : overlayPhase === 'exiting' ? 1 : overlayMetrics.scale})`,
                transformOrigin: 'top center',
                width: `${overlayMetrics.originalRect.width}px`,
                height: `${overlayMetrics.originalRect.height + 16}px`, // 하단 여유 공간 추가
                opacity: overlayPhase === 'entering' ? 0 : overlayPhase === 'exiting' ? 0 : 1,
                transition: 'top 300ms cubic-bezier(0.22, 1, 0.36, 1), left 300ms cubic-bezier(0.22, 1, 0.36, 1), transform 300ms cubic-bezier(0.22, 1, 0.36, 1), opacity 150ms cubic-bezier(0.22, 1, 0.36, 1)',
                overflow: 'visible', // 잘림 방지
                pointerEvents: 'auto', // 🚀 FIX: 클릭 이벤트를 받을 수 있도록 설정
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                // 🚀 FIX: 오버레이 클릭 시 롱프레스 취소
                handleLongPressCancel();
              }}
            >
              <div 
                className="imessage-receive-bubble md:text-sm"
                style={{ 
                  width: '100%',
                  height: '100%',
                  overflow: 'visible', // 잘림 방지
                  pointerEvents: 'auto', // 🚀 FIX: 클릭 이벤트를 받을 수 있도록 설정
                }}
              >
              <div className="imessage-content-wrapper space-y-2">
                {/* 인터리브 모드인 경우 세그먼트 기반 렌더링 */}
                {useInterleavedMode && segments.length > 0 ? (
                  <div className="interleaved-message-container">
                    {(() => {
                      let runCodeInvocationIndex = -1;
                      return segments.map((segment, idx) => {
                      const isLastSegment = idx === segments.length - 1;
                      const nextSegment = segments[idx + 1];

                      // 다음 세그먼트가 검색 도구인지 확인
                      const nextIsSearch = nextSegment?.type === 'tool' && isSearchTool(nextSegment.content.call.toolName);
                      const nextIsFileOrCode = nextSegment?.type === 'tool' && isFileOrCodeTool(nextSegment.content.call.toolName);

                      const hasSubsequentContent = hasAttachments || (allAttachments && allAttachments.length > 0) || !!structuredDescription;

                      if (segment.type === 'text') {
                        const nextIsTool = nextSegment?.type === 'tool';
                        const textHasTail = isLastSegment || nextIsTool;
                        const textMarginClass = (textHasTail && (!isLastSegment || hasSubsequentContent)) ? "mb-4" : "";

                        return (
                          <div key={`overlay-segment-text-${idx}`} className={`relative ${textMarginClass}`}>
                            <div className={`imessage-receive-bubble no-tail ${!textHasTail ? 'no-tail' : ''}`}>
                              <div className="imessage-content-wrapper">
                                <MarkdownContent 
                                  content={(() => {
                                    let processedContent = segment.content;
                                    
                                    // 🔥 parts 기반으로 이미지 순서 재정렬 (InlineToolPreview 순서와 일치)
                                    if (processedContent.includes('[IMAGE_ID:') && message.parts) {
                                      processedContent = reorderImagesByPartsOrder(processedContent, message.parts);
                                    }
                                    
                                    if (processedContent.includes('[IMAGE_ID:')) {
                                      processedContent = processedContent.replace(
                                        IMAGE_ID_REGEX,
                                        (match: string, imageId: string) => {
                                          if (imageMap && Object.keys(imageMap).length > 0) {
                                            const imageUrl = imageMap[imageId];
                                            if (imageUrl) {
                                              return `![](${imageUrl})`;
                                            }
                                          }
                                          return '';
                                        }
                                      );
                                    }

                                    if (processedContent.includes('[VIDEO_ID:')) {
                                      processedContent = processedContent.replace(
                                        VIDEO_ID_REGEX,
                                        (match: string, videoId: string) => {
                                          if (videoMap && Object.keys(videoMap).length > 0) {
                                            const videoEntry = videoMap[videoId];
                                            if (videoEntry) {
                                              return getVideoUrlWithSize(videoEntry);
                                            }
                                          }
                                          return '';
                                        }
                                      );
                                    }
                                    
                                    if (processedContent.includes('[LINK_ID:')) {
                                      processedContent = removeConsecutiveDuplicateLinks(processedContent, linkMap);
                                      processedContent = processedContent.replace(
                                        LINK_ID_REGEX,
                                        (match: string, linkId: string) => {
                                          const linkUrl = linkMap[linkId];
                                          return linkUrl ? linkUrl : '';
                                        }
                                      );
                                    }
                                    
                                    return processedContent;
                                  })()} 
                                  enableSegmentation={isAssistant} 
                                  searchTerm={searchTerm} 
                                  messageType="assistant" 
                                  thumbnailMap={thumbnailMap} 
                                  titleMap={titleMap} 
                                  linkPreviewData={linkPreviewData} 
                                  isMobile={isMobile} 
                                  isLongPressActive={true}
                                  noTail={true}
                                  isStreaming={isStreaming && isLastSegment}
                                  messageId={message.id}
                                  chatId={chatId}
                                  userId={user?.id}
                                  promptMap={promptMap}
                                  sourceImageMap={sourceImageMap}
                                  mediaDimensionsMap={mediaDimensionsMap}
                                  linkMap={linkMap}
                                  imageMap={imageMap}
                                  videoMap={videoMap}
                                  hideLinkThumbnail
                                />
                              </div>
                            </div>
                          </div>
                        );
                      }
                      
                      if (segment.type === 'tool') {
                        const toolContent = segment.content as ToolSegmentContent;
                        const toolName = toolContent.call.toolName;
                        if (
                          toolName === 'run_python_code' &&
                          preferredRunCodeToolCallId &&
                          toolContent.call.toolCallId !== preferredRunCodeToolCallId
                        ) {
                          return null;
                        }
                        const toolArgs = toolContent.call.args;
                        const resolvedToolArgs = (() => {
                          if (!toolArgs || toolArgs.model) return toolArgs;
                          if (!Array.isArray(message.parts) || message.parts.length === 0) return toolArgs;
                          const prompt = toolArgs.prompt;
                          if (toolName === 'grok_video') {
                            const startPart = message.parts.find(
                              (p: any) =>
                                p?.type === 'data-grok_video_started' &&
                                (!prompt || p?.data?.prompt === prompt)
                            );
                            const startedModel = startPart?.data?.model;
                            if (startedModel) return { ...toolArgs, model: startedModel };
                            const isVideoEdit = message.parts.find(
                              (p: any) =>
                                p?.type === 'data-grok_video_complete' &&
                                (!prompt || p?.data?.prompt === prompt) &&
                                p?.data?.isVideoEdit
                            );
                            if (isVideoEdit) return { ...toolArgs, model: 'video-edit' };
                            const isImageToVideo = message.parts.find(
                              (p: any) =>
                                p?.type === 'data-grok_video_complete' &&
                                (!prompt || p?.data?.prompt === prompt) &&
                                p?.data?.isImageToVideo
                            );
                            if (isImageToVideo) return { ...toolArgs, model: 'image-to-video' };
                          }
                          if (toolName === 'wan25_video') {
                            const startPart = message.parts.find(
                              (p: any) =>
                                p?.type === 'data-wan25_video_started' &&
                                (!prompt || p?.data?.prompt === prompt)
                            );
                            const startedModel = startPart?.data?.model;
                            if (startedModel) return { ...toolArgs, model: startedModel };
                            const completePart = message.parts.find(
                              (p: any) =>
                                p?.type === 'data-wan25_video_complete' &&
                                (!prompt || p?.data?.prompt === prompt)
                            );
                            if (typeof completePart?.data?.isImageToVideo === 'boolean') {
                              return {
                                ...toolArgs,
                                model: completePart.data.isImageToVideo ? 'image-to-video' : 'text-to-video'
                              };
                            }
                          }
                          return toolArgs;
                        })();
                        
                        const isMultiTopicSearch = (toolName === 'web_search' || toolName === 'multi_search') && 
                                                  toolArgs?.topics && 
                                                  Array.isArray(toolArgs.topics) && 
                                                  toolArgs.topics.length > 1;
                        
                        const isMultiEngineSearch = toolName === 'google_search' && 
                                                  toolArgs?.engines && 
                                                  Array.isArray(toolArgs.engines) && 
                                                  toolArgs.engines.length > 1;
                        
                        const isMultiQuerySearch = toolName === 'google_search' && 
                                                 toolArgs?.queries && 
                                                 Array.isArray(toolArgs.queries) && 
                                                 toolArgs.queries.length > 1 &&
                                                 (!toolArgs.engines || !Array.isArray(toolArgs.engines) || toolArgs.engines.length <= 1);
                        
                        if (isMultiTopicSearch) {
                          return (
                            <React.Fragment key={`overlay-segment-tool-${idx}`}>
                              {toolArgs.topics.map((topic: string, topicIdx: number) => {
                                const isLastTopic = topicIdx === toolArgs.topics.length - 1;
                                const topicHasTail = !(!isLastTopic || nextIsSearch);
                                const topicMargin = (topicHasTail && (!isLastSegment || hasSubsequentContent)) ? "mb-4" : "";
                                let topicQueries: string[] = [];
                                
                                if (toolContent.result?.result) {
                                  const toolResult = toolContent.result.result;
                                  if (toolResult.results && Array.isArray(toolResult.results)) {
                                    toolResult.results.forEach((result: any) => {
                                      if (result.searches && Array.isArray(result.searches)) {
                                        result.searches.forEach((search: any) => {
                                          if (search.topic === topic && search.query) {
                                            if (!topicQueries.includes(search.query)) {
                                              topicQueries.push(search.query);
                                            }
                                          }
                                        });
                                      }
                                    });
                                  }
                                  if (toolResult.searches && Array.isArray(toolResult.searches)) {
                                    toolResult.searches.forEach((search: any) => {
                                      if (search.topic === topic && search.query) {
                                        if (!topicQueries.includes(search.query)) {
                                          topicQueries.push(search.query);
                                        }
                                      }
                                    });
                                  }
                                }
                                
                                if (topicQueries.length === 0 && toolArgs.queries && Array.isArray(toolArgs.queries)) {
                                  if (toolArgs.queries[topicIdx] !== undefined) {
                                    topicQueries = [toolArgs.queries[topicIdx]];
                                  } else {
                                    topicQueries = toolArgs.queries;
                                  }
                                }
                                
                                return (
                                  <div key={`overlay-segment-tool-${idx}-topic-${topicIdx}`} className={`relative ${topicMargin}`}>
                                    <div className={`imessage-receive-bubble no-tail ${!topicHasTail ? 'no-tail' : ''}`}>
                                      <InlineToolPreview
                                        toolName={toolName}
                                        toolArgs={{
                                          ...resolvedToolArgs,
                                          topics: [topic],
                                          topic: topic,
                                          queries: topicQueries.length > 0 ? topicQueries : (toolArgs.queries || []),
                                          query: topicQueries.length > 0 ? topicQueries[0] : (toolArgs.query || ''),
                                        }}
                                        toolResult={toolContent.result?.result}
                                        messageId={message.id}
                                        togglePanel={togglePanel}
                                        activePanel={activePanel}
                                        isProcessing={!toolContent.result}
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </React.Fragment>
                          );
                        }
                        
                        if (isMultiEngineSearch) {
                          return (
                            <React.Fragment key={`overlay-segment-tool-${idx}`}>
                              {toolArgs.engines.map((engine: string, engineIdx: number) => {
                                const isLastEngine = engineIdx === toolArgs.engines.length - 1;
                                const engineHasTail = !(!isLastEngine || nextIsSearch);
                                const engineMargin = (engineHasTail && (!isLastSegment || hasSubsequentContent)) ? "mb-4" : "";
                                const correspondingQuery = toolArgs.queries && Array.isArray(toolArgs.queries) && toolArgs.queries[engineIdx] !== undefined
                                  ? toolArgs.queries[engineIdx]
                                  : toolArgs.query || '';
                                
                                return (
                                  <div key={`overlay-segment-tool-${idx}-engine-${engineIdx}`} className={`relative ${engineMargin}`}>
                                    <div className={`imessage-receive-bubble no-tail ${!engineHasTail ? 'no-tail' : ''}`}>
                                      <InlineToolPreview
                                        toolName={toolName}
                                        toolArgs={{
                                          ...resolvedToolArgs,
                                          engines: [engine],
                                          queries: correspondingQuery ? [correspondingQuery] : (toolArgs.queries || []),
                                          query: correspondingQuery || toolArgs.query,
                                          topic: engine,
                                          engine: engine,
                                        }}
                                        toolResult={toolContent.result?.result}
                                        messageId={message.id}
                                        togglePanel={togglePanel}
                                        activePanel={activePanel}
                                        isProcessing={!toolContent.result}
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </React.Fragment>
                          );
                        }
                        
                        if (isMultiQuerySearch) {
                          return (
                            <React.Fragment key={`overlay-segment-tool-${idx}`}>
                              {toolArgs.queries.map((query: string, queryIdx: number) => {
                                const isLastQuery = queryIdx === toolArgs.queries.length - 1;
                                const queryHasTail = !(!isLastQuery || nextIsSearch);
                                const queryMargin = (queryHasTail && (!isLastSegment || hasSubsequentContent)) ? "mb-4" : "";
                                const correspondingEngine = toolArgs.engines && Array.isArray(toolArgs.engines) && toolArgs.engines[queryIdx] !== undefined
                                  ? toolArgs.engines[queryIdx]
                                  : toolArgs.engines?.[0] || toolArgs.engine || 'google';
                                
                                return (
                                  <div key={`overlay-segment-tool-${idx}-query-${queryIdx}`} className={`relative ${queryMargin}`}>
                                    <div className={`imessage-receive-bubble no-tail ${!queryHasTail ? 'no-tail' : ''}`}>
                                <InlineToolPreview
                                  toolName={toolName}
                                  toolArgs={{
                                    ...resolvedToolArgs,
                                    queries: [query],
                                    query: query,
                                    engines: [correspondingEngine],
                                    topic: correspondingEngine,
                                    engine: correspondingEngine,
                                  }}
                                  toolResult={toolContent.result?.result}
                                  messageId={message.id}
                                  togglePanel={togglePanel}
                                  activePanel={activePanel}
                                  isProcessing={!toolContent.result}
                                />
                                    </div>
                                  </div>
                                );
                              })}
                            </React.Fragment>
                          );
                        }
                        
                        const runCodeIndex = toolName === 'run_python_code' ? ++runCodeInvocationIndex : null;

                        if (isOutcomeFileTool(toolName) || toolName === 'run_python_code' || toolName === 'browser_observe') {
                          const runCodeData = toolName === 'run_python_code'
                            ? getRunCodeData(message, toolContent.call.toolCallId, runCodeIndex ?? undefined)
                            : null;
                          const browserObserveData = toolName === 'browser_observe'
                            ? getBrowserObserveData(message, toolContent.call.toolCallId)
                            : null;
                          const overlayToolHasTail = !(
                            (isSearchTool(toolName) && nextIsSearch) ||
                            (isFileOrCodeTool(toolName) && nextIsFileOrCode)
                          );
                          return (
                            <div key={`overlay-segment-tool-${idx}`} className={`relative ${overlayToolHasTail && (!isLastSegment || hasSubsequentContent) ? 'mb-4' : ''}`}>
                              <InlineToolPreview
                                toolName={toolName}
                                toolArgs={resolvedToolArgs}
                                toolResult={toolName === 'run_python_code' ? runCodeData : (toolName === 'browser_observe' ? browserObserveData : toolContent.result?.result)}
                                messageId={message.id}
                                togglePanel={togglePanel}
                                activePanel={activePanel}
                                isProcessing={!toolContent.result && !runCodeData && !browserObserveData}
                                chatId={chatId}
                                toolCallId={toolContent.call.toolCallId}
                                isLastBubble={overlayToolHasTail}
                                isNoTail={!overlayToolHasTail}
                              />
                            </div>
                          );
                        }

                        // 단일 도구 또는 단일 topic/engine/query인 경우 기존 로직
                        const toolHasTail = !(
                          (isSearchTool(toolName) && nextIsSearch) ||
                          (isFileOrCodeTool(toolName) && nextIsFileOrCode)
                        );
                        const toolMargin = (toolHasTail && (!isLastSegment || hasSubsequentContent)) ? "mb-4" : "";

                        return (
                          <div key={`overlay-segment-tool-${idx}`} className={`relative ${toolMargin}`}>
                            <div className={`imessage-receive-bubble no-tail ${!toolHasTail ? 'no-tail' : ''}`}>
                              <InlineToolPreview
                                toolName={toolName}
                                toolArgs={resolvedToolArgs}
                                toolResult={toolContent.result?.result}
                                messageId={message.id}
                                togglePanel={togglePanel}
                                activePanel={activePanel}
                                isProcessing={!toolContent.result}
                              />
                            </div>
                          </div>
                        );
                      }
                      
                      return null;
                      });
                    })()}
                    
                    {hasAttachments && (
                      <div className="space-y-1 mb-2">
                        {(allAttachments as any[])!.map((attachment: any, index: number) => (
                          <AttachmentPreview key={`${message.id}-att-${index}`} attachment={attachment} messageId={message.id} chatId={chatId} />
                        ))}
                      </div>
                    )}
                    
                    <FilesPreview
                      messageId={message.id}
                      togglePanel={togglePanel}
                      message={message}
                    />

                    {structuredDescription && (
                      <div className="imessage-receive-bubble no-tail">
                        <p>{structuredDescription}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  /* 기존 렌더링 로직 (인터리브 모드가 아닌 경우) */
                  <>
                    {hasAttachments && (
                      <div className="space-y-1">
                        {(allAttachments as any[])!.map((attachment: any, index: number) => (
                          <AttachmentPreview key={`${message.id}-att-${index}`} attachment={attachment} messageId={message.id} chatId={chatId} />
                        ))}
                      </div>
                    )}
                  
                    {message.parts ? (
                      processedParts?.map((part: any, index: number) => (
part.type === 'text' && <MarkdownContent key={index} content={part.text} enableSegmentation={isAssistant} searchTerm={searchTerm} messageType={isAssistant ? 'assistant' : 'user'} thumbnailMap={thumbnailMap} titleMap={titleMap} linkPreviewData={linkPreviewData} isMobile={isMobile} isLongPressActive={true} noTail={true} isStreaming={isStreaming} messageId={message.id} chatId={chatId} userId={user?.id} promptMap={promptMap} sourceImageMap={sourceImageMap} mediaDimensionsMap={mediaDimensionsMap} linkMap={linkMap} imageMap={imageMap} videoMap={videoMap} hideLinkThumbnail/>
                      ))
                    ) : (
                      (hasContent && !hasStructuredData) && <MarkdownContent content={processedContent} enableSegmentation={isAssistant} searchTerm={searchTerm} messageType={isAssistant ? 'assistant' : 'user'} thumbnailMap={thumbnailMap} titleMap={titleMap} linkPreviewData={linkPreviewData} isMobile={isMobile} isLongPressActive={true} noTail={true} isStreaming={isStreaming} messageId={message.id} chatId={chatId} userId={user?.id} promptMap={promptMap} sourceImageMap={sourceImageMap} mediaDimensionsMap={mediaDimensionsMap} linkMap={linkMap} imageMap={imageMap} videoMap={videoMap} hideLinkThumbnail/>
                    )}
                    
                      <FilesPreview
                        messageId={message.id}
                        togglePanel={togglePanel}
                        message={message}
                      />

                      {structuredDescription && (
                        <div className="imessage-receive-bubble">
                          <p>{structuredDescription}</p>
                        </div>
                      )}
                  </>
                )}
                </div>
              </div>
            </div>,
            typeof window !== 'undefined' ? document.body : (null as any)
          )}

          {/* 🚀 FIX: 일반 AI 메시지용 배경 오버레이 - 긴 메시지가 아닌 경우에도 배경 클릭으로 롱프레스 취소 가능 */}
          {longPressActive && !isSelectionModeActive && isAssistant && !overlayMetrics?.needsScaling && createPortal(
            <div
              className="fixed inset-0 z-99997"
              style={{
                pointerEvents: 'auto',
                cursor: 'pointer',
                backgroundColor: 'transparent' // 투명하지만 클릭 가능
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                // 🚀 FIX: 일반 AI 메시지 배경 클릭 시 롱프레스 취소
                handleLongPressCancel();
              }}
            />,
            typeof window !== 'undefined' ? document.body : (null as any)
          )}

          {/* AI 메시지용 롱프레스 드롭다운: Portal 사용으로 DOM 계층 분리 */}
          {longPressActive && !isSelectionModeActive && isAssistant && (overlayPhase === 'entering' || overlayPhase === 'active' || overlayPhase === 'exiting') && createPortal(
            <>
              <div 
                className="fixed w-56 chat-input-tooltip-backdrop rounded-2xl z-100000 overflow-hidden tool-selector"
                style={{
                  transform: overlayPhase === 'entering' ? 'translateY(8px)' : overlayPhase === 'exiting' ? 'translateY(-4px)' : 'translateY(0)',
                  opacity: (overlayPhase === 'entering' || overlayPhase === 'exiting') ? 0 : 1,
                  transition: 'transform 150ms cubic-bezier(0.22, 1, 0.36, 1), opacity 150ms cubic-bezier(0.22, 1, 0.36, 1)',
                  // 미리 계산된 메뉴 위치 사용 (glitch 완전 방지)
                  ...(() => {
                    // 🚀 FIX: 실제 탭한 버블 우선 사용 (인터리브 모드에서 정확한 위치 계산)
                    const bubbleForPosition = targetBubbleRef.current || aiBubbleRef.current;
                    if (!bubbleForPosition) return { display: 'none' };
                    
                    // 미리 계산된 위치가 있으면 사용, 없으면 실시간 계산
                    if (preCalculatedMenuPosition) {
                      return preCalculatedMenuPosition;
                    }
                    
                    // fallback: 실시간 계산
                    const rect = bubbleForPosition.getBoundingClientRect();
                    const menuHeight = 260; // 더보기 버튼 추가 반영
                    const margin = 16;
                    const viewportHeight = window.innerHeight;
                    const menuBottomMargin = 40;
                    
                    if (dropdownPosition === 'top') {
                      return {
                        top: `${rect.top - menuHeight - margin}px`,
                        left: '16px',
                        right: 'auto',
                        display: 'block'
                      };
                    } else {
                      // 오버레이 기준으로 메뉴 위치 계산 (축소 여부와 관계없이)
                      if (overlayMetrics) {
                        const scaledHeight = overlayMetrics.originalRect.height * overlayMetrics.scale;
                        const menuTop = overlayMetrics.overlayPosition.top + scaledHeight + margin;
                        
                        return {
                          top: `${menuTop}px`,
                          left: '16px',
                          right: 'auto',
                          display: 'block'
                        };
                      }
                      
                      // 1. 먼저 메시지 바로 아래에 메뉴를 배치해보기 (원본 위치 기준)
                      const preferredMenuTop = rect.bottom + margin;
                      const preferredMenuBottom = preferredMenuTop + menuHeight;
                      
                      // 2. 메뉴가 화면을 벗어나는지 확인
                      const menuWouldGoOffscreen = preferredMenuBottom > viewportHeight - menuBottomMargin;
                      
                      if (menuWouldGoOffscreen) {
                        // 3. 화면을 벗어나면 하단에 고정
                        return {
                          top: `${viewportHeight - menuHeight - menuBottomMargin}px`,
                          left: '16px',
                          right: 'auto',
                          display: 'block'
                        };
                      } else {
                        // 4. 공간이 충분하면 메시지 바로 아래에 배치 (약간의 여유 공간 추가)
                        return {
                          top: `${preferredMenuTop + 2}px`, // 2px 여유 공간 추가
                          left: '16px',
                          right: 'auto',
                          display: 'block'
                        };
                      }
                    }
                  })(),
                  // 기존 스타일 + 드롭다운
                  backgroundColor: 'rgba(255, 255, 255, 0.5)',
                  backdropFilter: isMobile ? 'blur(10px) saturate(180%)' : 'url(#glass-distortion-ai) blur(10px) saturate(180%)',
                  WebkitBackdropFilter: isMobile ? 'blur(10px) saturate(180%)' : 'url(#glass-distortion-ai) blur(10px) saturate(180%)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  boxShadow: '0 8px 40px rgba(0, 0, 0, 0.06), 0 4px 20px rgba(0, 0, 0, 0.04), 0 2px 8px rgba(0, 0, 0, 0.025), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
                  // 다크모드 전용 스타일
                  ...(typeof window !== 'undefined' && (
                    document.documentElement.getAttribute('data-theme') === 'dark' || 
                    (document.documentElement.getAttribute('data-theme') === 'system' && 
                     window.matchMedia('(prefers-color-scheme: dark)').matches)
                  ) ? {
                    backgroundColor: 'rgba(0, 0, 0, 0.05)',
                    backdropFilter: isMobile ? 'blur(24px)' : 'url(#glass-distortion-ai) blur(24px)',
                    WebkitBackdropFilter: isMobile ? 'blur(24px)' : 'url(#glass-distortion-ai) blur(24px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), 0 4px 16px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                  } : {})
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  // 드롭다운 내부 클릭은 닫지 않음
                }}
              >
                <div className="flex flex-col gap-2 space-y-2">
                  {/* 재생성 버튼 */}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      e.nativeEvent.stopImmediatePropagation();
                      onRegenerate(message.id)(e as any);
                      handleLongPressCancel();
                    }}
                    onTouchEnd={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      e.nativeEvent.stopImmediatePropagation();
                      onRegenerate(message.id)(e as any);
                      handleLongPressCancel();
                    }}
                    disabled={isRegenerating}
                    className="flex items-center gap-3 px-5 pt-4 transition-colors duration-150 rounded-xl tool-button"
                    style={{
                      '--hover-bg': 'color-mix(in srgb, var(--foreground) 3%, transparent)',
                      '--active-bg': 'color-mix(in srgb, var(--foreground) 5%, transparent)',
                      WebkitTapHighlightColor: 'transparent',
                      WebkitTouchCallout: 'none',
                      WebkitUserSelect: 'none',
                      userSelect: 'none',
                      opacity: isRegenerating ? 0.5 : 1
                    } as any}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--hover-bg)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    onMouseDown={(e) => e.currentTarget.style.backgroundColor = 'var(--active-bg)'}
                    onMouseUp={(e) => e.currentTarget.style.backgroundColor = 'var(--hover-bg)'}
                  > 
                    <div className="w-6 h-6 flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={isRegenerating ? 'animate-spin' : ''} style={{ color: 'var(--foreground)' }}>
                        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                        <path d="M21 3v5h-5"/>
                        <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                        <path d="M3 21v-5h5"/>
                      </svg>
                    </div>
                    <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                      {isRegenerating ? 'Regenerating...' : 'Regenerate'}
                    </span>
                  </button>

                  {/* 텍스트 선택 버튼 */}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      e.nativeEvent.stopImmediatePropagation();
                      handleOpenTextSelectionModal();
                    }}
                    onTouchEnd={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      e.nativeEvent.stopImmediatePropagation();
                      handleOpenTextSelectionModal();
                    }}
                    className="flex items-center gap-3 px-5 transition-colors duration-150 rounded-xl tool-button"
                    style={{
                      '--hover-bg': 'color-mix(in srgb, var(--foreground) 3%, transparent)',
                      '--active-bg': 'color-mix(in srgb, var(--foreground) 5%, transparent)',
                      WebkitTapHighlightColor: 'transparent',
                      WebkitTouchCallout: 'none',
                      WebkitUserSelect: 'none',
                      userSelect: 'none'
                    } as any}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--hover-bg)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    onMouseDown={(e) => e.currentTarget.style.backgroundColor = 'var(--active-bg)'}
                    onMouseUp={(e) => e.currentTarget.style.backgroundColor = 'var(--hover-bg)'}
                  >
                    <div className="w-6 h-6 flex items-center justify-center">
                      <IoDocumentTextOutline size={20} style={{ color: 'var(--foreground)' }} />
                    </div>
                    <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Select Text</span>
                  </button>

                  {/* 복사 버튼 */}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      e.nativeEvent.stopImmediatePropagation();
                      onCopy(message);
                      handleLongPressCancel();
                    }}
                    onTouchEnd={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      e.nativeEvent.stopImmediatePropagation();
                      onCopy(message);
                      handleLongPressCancel();
                    }}
                    className="flex items-center gap-3 px-5 transition-colors duration-150 rounded-xl tool-button"
                    style={{
                      '--hover-bg': 'color-mix(in srgb, var(--foreground) 3%, transparent)',
                      '--active-bg': 'color-mix(in srgb, var(--foreground) 5%, transparent)',
                      WebkitTapHighlightColor: 'transparent',
                      WebkitTouchCallout: 'none',
                      WebkitUserSelect: 'none',
                      userSelect: 'none'
                    } as any}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--hover-bg)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    onMouseDown={(e) => e.currentTarget.style.backgroundColor = 'var(--active-bg)'}
                    onMouseUp={(e) => e.currentTarget.style.backgroundColor = 'var(--hover-bg)'}
                  >
                    <div className="w-6 h-6 flex items-center justify-center">
                      {isCopied ? (
                        <IoCheckmarkOutline size={20} style={{ color: 'var(--status-text-complete)' }} />
                      ) : (
                        <IoCopyOutline size={20} style={{ color: 'var(--foreground)' }} />
                      )}
                    </div>
                    <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                      {isCopied ? 'Copied' : 'Copy'}
                    </span>
                  </button>

                  {/* 북마크 버튼 */}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      e.nativeEvent.stopImmediatePropagation();
                      toggleBookmark(e as any);
                      handleLongPressCancel();
                    }}
                    onTouchEnd={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      e.nativeEvent.stopImmediatePropagation();
                      toggleBookmark(e as any);
                      handleLongPressCancel();
                    }}
                    disabled={isBookmarksLoading}
                    className="flex items-center gap-3 px-5 transition-colors duration-150 rounded-xl tool-button"
                    style={{
                      '--hover-bg': 'color-mix(in srgb, var(--foreground) 3%, transparent)',
                      '--active-bg': 'color-mix(in srgb, var(--foreground) 5%, transparent)',
                      WebkitTapHighlightColor: 'transparent',
                      WebkitTouchCallout: 'none',
                      WebkitUserSelect: 'none',
                      userSelect: 'none',
                      opacity: isBookmarksLoading ? 0.5 : 1
                    } as any}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--hover-bg)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    onMouseDown={(e) => e.currentTarget.style.backgroundColor = 'var(--active-bg)'}
                    onMouseUp={(e) => e.currentTarget.style.backgroundColor = 'var(--hover-bg)'}
                  >
                    <div className="w-6 h-6 flex items-center justify-center">
                      {isBookmarked ? (
                        <IoBookmark size={20} style={{ color: 'var(--foreground)' }} className={isBookmarksLoading ? "animate-pulse" : ""} />
                      ) : (
                        <IoBookmarkOutline size={20} style={{ color: 'var(--foreground)' }} className={isBookmarksLoading ? "animate-pulse" : ""} />
                      )}
                    </div>
                    <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                      {isBookmarked ? 'Remove bookmark' : 'Bookmark'}
                    </span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      e.nativeEvent.stopImmediatePropagation();
                      onEnterMessageSelectionMode?.(message.id);
                      handleLongPressCancel();
                    }}
                    onTouchEnd={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      e.nativeEvent.stopImmediatePropagation();
                      onEnterMessageSelectionMode?.(message.id);
                      handleLongPressCancel();
                    }}
                    className="flex items-center gap-3 px-5 pb-4 transition-colors duration-150 rounded-xl tool-button"
                    style={{
                      '--hover-bg': 'color-mix(in srgb, var(--foreground) 3%, transparent)',
                      '--active-bg': 'color-mix(in srgb, var(--foreground) 5%, transparent)',
                      WebkitTapHighlightColor: 'transparent',
                      WebkitTouchCallout: 'none',
                      WebkitUserSelect: 'none',
                      userSelect: 'none'
                    } as any}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--hover-bg)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    onMouseDown={(e) => e.currentTarget.style.backgroundColor = 'var(--active-bg)'}
                    onMouseUp={(e) => e.currentTarget.style.backgroundColor = 'var(--hover-bg)'}
                  >
                    <div className="w-6 h-6 flex items-center justify-center">
                      <IoEllipsisHorizontal size={20} style={{ color: 'var(--foreground)' }} />
                    </div>
                    <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>More</span>
                  </button>
              </div>
            </div>
          </>,
          typeof window !== 'undefined' ? document.body : (null as any)
        )}
      </>
    )
  }
</div>
      {/* 데스크탑 프로필 사진 클릭 시 모바일 스타일 드롭다운 메뉴 */}
      {isAssistant && !isStreaming && !isMobile && showActionsDesktop && !isSelectionModeActive && createPortal(
        <>
          {/* 배경 오버레이 */}
          <div
            className="fixed inset-0 z-99997"
            style={{
              pointerEvents: 'auto',
              cursor: 'pointer',
              backgroundColor: 'transparent'
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowActionsDesktop(false);
            }}
          />
          {/* 드롭다운 메뉴 */}
          <div 
            className="fixed w-56 chat-input-tooltip-backdrop rounded-2xl z-100000 overflow-hidden tool-selector desktop-avatar-menu"
            style={{
              ...(() => {
                if (!avatarRef.current) return { display: 'none' };
                const rect = avatarRef.current.getBoundingClientRect();
                // Keep fallback height close to real menu size so "top" placement
                // doesn't leave an excessive gap from the avatar.
                const menuHeight = 220;
                const margin = 16;
                const viewportHeight = window.innerHeight;
                const menuBottomMargin = 40;
                
                // 프로필 사진 아래에 배치 시도
                const preferredMenuTop = rect.bottom + margin;
                const preferredMenuBottom = preferredMenuTop + menuHeight;
                
                // 화면을 벗어나는지 확인
                const menuWouldGoOffscreen = preferredMenuBottom > viewportHeight - menuBottomMargin;
                
                if (menuWouldGoOffscreen) {
                  // 화면을 벗어나면 프로필 사진 위에 배치
                  return {
                    top: `${rect.top - menuHeight - margin}px`,
                    left: `${rect.left}px`,
                    right: 'auto',
                    display: 'block',
                    transform: 'translateY(-8px)',
                    opacity: 0,
                    transition: 'transform 150ms cubic-bezier(0.22, 1, 0.36, 1), opacity 150ms cubic-bezier(0.22, 1, 0.36, 1)'
                  };
                } else {
                  // 공간이 충분하면 프로필 사진 아래에 배치
                  return {
                    top: `${preferredMenuTop}px`,
                    left: `${rect.left}px`,
                    right: 'auto',
                    display: 'block',
                    transform: 'translateY(8px)',
                    opacity: 0,
                    transition: 'transform 150ms cubic-bezier(0.22, 1, 0.36, 1), opacity 150ms cubic-bezier(0.22, 1, 0.36, 1)'
                  };
                }
              })(),
              backgroundColor: 'rgba(255, 255, 255, 0.5)',
              backdropFilter: 'url(#glass-distortion-ai) blur(10px) saturate(180%)',
              WebkitBackdropFilter: 'url(#glass-distortion-ai) blur(10px) saturate(180%)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              boxShadow: '0 8px 40px rgba(0, 0, 0, 0.06), 0 4px 20px rgba(0, 0, 0, 0.04), 0 2px 8px rgba(0, 0, 0, 0.025), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
              ...(typeof window !== 'undefined' && (
                document.documentElement.getAttribute('data-theme') === 'dark' || 
                (document.documentElement.getAttribute('data-theme') === 'system' && 
                 window.matchMedia('(prefers-color-scheme: dark)').matches)
              ) ? {
                backgroundColor: 'rgba(0, 0, 0, 0.05)',
                backdropFilter: 'url(#glass-distortion-ai) blur(24px)',
                WebkitBackdropFilter: 'url(#glass-distortion-ai) blur(24px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), 0 4px 16px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
              } : {})
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <div className="flex flex-col gap-2 space-y-2">
              {/* 재생성 버튼 */}
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onRegenerate(message.id)(e as any);
                  setShowActionsDesktop(false);
                }}
                disabled={isRegenerating}
                className="flex items-center gap-3 px-5 pt-4 rounded-xl tool-button"
                style={{
                  WebkitTapHighlightColor: 'transparent',
                  WebkitTouchCallout: 'none',
                  WebkitUserSelect: 'none',
                  userSelect: 'none',
                  opacity: isRegenerating ? 0.5 : 1,
                  backgroundColor: 'transparent',
                  cursor: 'pointer'
                } as any}
              > 
                <div className="w-6 h-6 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={isRegenerating ? 'animate-spin' : ''} style={{ color: 'var(--foreground)' }}>
                    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                    <path d="M21 3v5h-5"/>
                    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                    <path d="M3 21v-5h5"/>
                  </svg>
                </div>
                <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                  {isRegenerating ? 'Regenerating...' : 'Regenerate'}
                </span>
              </button>

              {/* 텍스트 선택 버튼 */}
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleOpenTextSelectionModal();
                  setShowActionsDesktop(false);
                }}
                className="flex items-center gap-3 px-5 rounded-xl tool-button"
                style={{
                  WebkitTapHighlightColor: 'transparent',
                  WebkitTouchCallout: 'none',
                  WebkitUserSelect: 'none',
                  userSelect: 'none',
                  backgroundColor: 'transparent',
                  cursor: 'pointer'
                } as any}
              >
                <div className="w-6 h-6 flex items-center justify-center">
                  <IoDocumentTextOutline size={20} style={{ color: 'var(--foreground)' }} />
                </div>
                <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Select Text</span>
              </button>

              {/* 복사 버튼 */}
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onCopy(message);
                  setShowActionsDesktop(false);
                }}
                className="flex items-center gap-3 px-5 rounded-xl tool-button"
                style={{
                  WebkitTapHighlightColor: 'transparent',
                  WebkitTouchCallout: 'none',
                  WebkitUserSelect: 'none',
                  userSelect: 'none',
                  backgroundColor: 'transparent',
                  cursor: 'pointer'
                } as any}
              >
                <div className="w-6 h-6 flex items-center justify-center">
                  {isCopied ? (
                    <IoCheckmarkOutline size={20} style={{ color: 'var(--status-text-complete)' }} />
                  ) : (
                    <IoCopyOutline size={20} style={{ color: 'var(--foreground)' }} />
                  )}
                </div>
                <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                  {isCopied ? 'Copied' : 'Copy'}
                </span>
              </button>

              {/* 북마크 버튼 */}
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleBookmark(e as any);
                  setShowActionsDesktop(false);
                }}
                disabled={isBookmarksLoading}
                className="flex items-center gap-3 px-5 rounded-xl tool-button"
                style={{
                  WebkitTapHighlightColor: 'transparent',
                  WebkitTouchCallout: 'none',
                  WebkitUserSelect: 'none',
                  userSelect: 'none',
                  opacity: isBookmarksLoading ? 0.5 : 1,
                  backgroundColor: 'transparent',
                  cursor: 'pointer'
                } as any}
              >
                <div className="w-6 h-6 flex items-center justify-center">
                  {isBookmarked ? (
                    <IoBookmark size={20} style={{ color: 'var(--foreground)' }} className={isBookmarksLoading ? "animate-pulse" : ""} />
                  ) : (
                    <IoBookmarkOutline size={20} style={{ color: 'var(--foreground)' }} className={isBookmarksLoading ? "animate-pulse" : ""} />
                  )}
                </div>
                <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                  {isBookmarked ? 'Remove bookmark' : 'Bookmark'}
                </span>
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onEnterMessageSelectionMode?.(message.id);
                  setShowActionsDesktop(false);
                }}
                className="flex items-center gap-3 px-5 pb-4 rounded-xl tool-button"
                style={{
                  WebkitTapHighlightColor: 'transparent',
                  WebkitTouchCallout: 'none',
                  WebkitUserSelect: 'none',
                  userSelect: 'none',
                  backgroundColor: 'transparent',
                  cursor: 'pointer'
                } as any}
              >
                <div className="w-6 h-6 flex items-center justify-center">
                  <IoEllipsisHorizontal size={20} style={{ color: 'var(--foreground)' }} />
                </div>
                <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                  More
                </span>
              </button>
            </div>
          </div>
        </>,
        typeof window !== 'undefined' ? document.body : (null as any)
      )}
      {/* Add follow-up questions for assistant messages */}
      {/* 🚀 SCROLL STABILITY: 항상 영역 렌더링하여 레이아웃 시프트 방지 */}
      {/* isLastMessage가 아니어도 영역은 유지하되 숨김 처리 */}
      {isAssistant && handleFollowUpQuestionClick && chatId && (
        <div 
          className="follow-up-questions-section"
          style={{
            zIndex: longPressActive ? -1 : 'auto',
            position: longPressActive ? 'relative' : 'static',
            pointerEvents: isLastMessage ? 'auto' : 'none',
            // 🚀 SCROLL STABILITY: 
            // - 마지막 메시지가 아니면: 완전히 숨김 (height: 0)
            // - 스트리밍/로딩 중이면: 숨김
            // - 그 외: 표시
            visibility: (!isLastMessage || isGlobalLoading || isStreaming) ? 'hidden' : 'visible',
            height: (!isLastMessage || isGlobalLoading || isStreaming) ? 0 : 'auto',
            // 🚀 FIX: overflow: 'visible'로 변경하여 bubble tail 표시 허용
            // imessage-send-bubble의 ::before, ::after는 bubble 밖에 위치 (right: -7px, -26px)
            overflow: 'visible',
            transition: 'height 0.15s ease-out, opacity 0.15s ease-out',
            opacity: (!isLastMessage || isGlobalLoading || isStreaming) ? 0 : 1,
          }}
        >
          {/* allMessages가 있을 때만 FollowUpQuestions 렌더링 */}
          {allMessages && (
            <FollowUpQuestions 
              chatId={chatId} 
              userId={user?.id || 'anonymous'} 
              messages={allMessages} 
              onQuestionClick={handleFollowUpQuestionClick} 
            />
          )}
        </div>
      )}

      {/* 텍스트 선택 모달 */}
      {showTextSelectionModal && createPortal(
        <div 
          className="fixed inset-0 z-99999"
          style={{
            touchAction: 'none',
            overflow: 'hidden'
          }}
        >
          {isMobile ? (
            <>
              {/* 배경 오버레이 */}
              <div 
                className={`fixed inset-0 bg-transparent transition-all duration-500 ease-out ${!selectTextElements.modal ? 'opacity-0 pointer-events-none' : ''}`}
                onClick={handleCloseTextSelectionModal}
                style={{ touchAction: 'none' }}
              />
              {/* 모달 컨텐츠 - 열 때는 바로 표시, 닫을 때만 밑으로 슬라이드 + 손잡이 드래그 (모바일) */}
              <div 
                className="fixed inset-x-0 bottom-0 w-full flex flex-col overflow-hidden rounded-t-3xl"
                style={{
                  height: 'calc(100vh - 120px)',
                  maxHeight: 'calc(100vh - 120px)',
                  transform: !selectTextElements.modal ? 'translateY(calc(100vh - 60px))' : `translateY(${selectTextCurrentTranslateY}px)`,
                  transition: selectTextDragging ? 'none' : (selectTextElements.modal ? 'transform 0.5s cubic-bezier(0.25, 0.1, 0.25, 1), opacity 0.3s ease-out' : 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease-out'),
                  willChange: 'transform, opacity',
                  opacity: selectTextElements.modal ? 1 : 0,
                  ...getAdaptiveGlassStyleBlur(),
                  ...(!getInitialTheme() && {
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05), 0 4px 20px rgba(0, 0, 0, 0.025), 0 8px 40px rgba(0, 0, 0, 0.012)',
                  }),
                  backgroundColor: (typeof window !== 'undefined' && (
                    document.documentElement.getAttribute('data-theme') === 'dark' || 
                    (document.documentElement.getAttribute('data-theme') === 'system' && 
                     window.matchMedia('(prefers-color-scheme: dark)').matches)
                  )) ? 'rgba(30, 30, 30, 0.6)' : 'rgba(240, 240, 240, 0.6)',
                  backdropFilter: 'blur(40px)',
                  WebkitBackdropFilter: 'blur(40px)',
                  zIndex: 99999
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* 드래그 핸들 */}
                <div
                  className={`text-center pt-4 pb-4 shrink-0 transition-all duration-250 ease-out ${selectTextElements.title ? 'translate-y-0 opacity-100' : selectTextClosing ? 'translate-y-6 opacity-0' : 'translate-y-6 opacity-0'}`}
                  onTouchStart={handleSelectTextTouchStart}
                  onTouchMove={handleSelectTextTouchMove}
                  onTouchEnd={handleSelectTextTouchEnd}
                  style={{ touchAction: 'none', willChange: 'transform, opacity' }}
                >
                  <div 
                    className="w-12 h-1.5 rounded-full mx-auto transition-colors duration-200"
                    style={{
                      backgroundColor: selectTextDragging ? 'rgba(156, 163, 175, 0.4)' : 'rgba(209, 213, 219, 0.3)'
                    }} 
                  />
                </div>

                {/* 헤더: 제목만 (Background와 동일) */}
                <div
                  className={`relative flex items-center justify-center py-6 px-6 shrink-0 transition-all duration-250 ease-out ${selectTextElements.title ? 'translate-y-0 opacity-100' : selectTextClosing ? 'translate-y-6 opacity-0' : 'translate-y-6 opacity-0'}`}
                  onTouchStart={handleSelectTextTouchStart}
                  onTouchMove={handleSelectTextTouchMove}
                  onTouchEnd={handleSelectTextTouchEnd}
                  style={{ touchAction: 'none', willChange: 'transform, opacity' }}
                >
                  <h2 className="text-2xl font-bold" style={getTextStyle(false)}>Select Text</h2>
                </div>

                {/* 컨텐츠: 토글(md/txt) + 텍스트 영역 (제목 아래, Background의 mt-8 영역처럼) */}
                <div className={`flex-1 min-h-0 flex flex-col overflow-hidden px-4 pb-6 transition-all duration-300 ease-out ${selectTextElements.content ? 'translate-y-0 opacity-100' : selectTextClosing ? 'translate-y-8 opacity-0' : 'translate-y-8 opacity-0'}`} style={{ willChange: 'transform, opacity' }}>
                  {/* md/txt 토글 - 제목보다 밑에 */}
                  <div className="shrink-0 flex items-center gap-3 pt-2 pb-6">
                    <span className={`text-[10px] tracking-wider font-bold transition-colors ${isMarkdownView ? 'opacity-80' : 'opacity-40'}`} style={{ color: 'var(--foreground)' }}>md</span>
                    <button
                      type="button"
                      onClick={() => setIsMarkdownView(!isMarkdownView)}
                      className="relative w-10 h-5 rounded-full bg-white/10 border border-white/10 transition-colors duration-200 cursor-pointer"
                      style={{ WebkitTapHighlightColor: 'transparent', WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
                      aria-label={isMarkdownView ? 'Switch to plain text' : 'Switch to markdown'}
                    >
                      <div className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-all duration-200 shadow-sm ${isMarkdownView ? 'left-0.5' : 'left-[22px]'}`} />
                    </button>
                    <span className={`text-[10px] tracking-wider font-bold transition-colors ${!isMarkdownView ? 'opacity-80' : 'opacity-40'}`} style={{ color: 'var(--foreground)' }}>txt</span>
                  </div>

                  {/* 텍스트 영역 */}
                  <div
                    data-text-selection-area
                    className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
                  style={{
                    WebkitUserSelect: 'text',
                    MozUserSelect: 'text',
                    msUserSelect: 'text',
                    userSelect: 'text',
                    touchAction: 'pan-y',
                    WebkitTouchCallout: 'default',
                    backgroundColor: 'transparent',
                    minHeight: '200px',
                    overflowX: 'hidden',
                    wordBreak: 'break-word',
                    overflowWrap: 'break-word'
                  }}
                  onTouchStart={(e) => {
                    const t = e.touches[0];
                    (e.currentTarget as any).touchStartY = t.clientY;
                    (e.currentTarget as any).touchStartX = t.clientX;
                  }}
                  onTouchMove={(e) => {
                    const selection = window.getSelection();
                    const t = e.touches[0];
                    const target = e.currentTarget as any;
                    const dy = Math.abs(t.clientY - (target.touchStartY || t.clientY));
                    const dx = Math.abs(t.clientX - (target.touchStartX || t.clientX));
                    if (selection?.rangeCount && ((dx >= dy && dx < 50) || (dy < 10 && dx < 10))) { e.preventDefault(); e.stopPropagation(); }
                  }}
                >
                  <pre ref={textSelectionRef} className="whitespace-pre-wrap font-sans text-sm leading-relaxed" style={{ color: 'var(--foreground)', margin: 0, fontFamily: 'inherit', wordBreak: 'break-word', overflowWrap: 'break-word', whiteSpace: 'pre-wrap', maxWidth: '100%', overflowX: 'hidden' }}>
                    {(isMarkdownView ? markdownText : convertedText) || 'No text available'}
                  </pre>
                </div>
              </div>
            </div>
            </>
          ) : (
            <div className="fixed inset-0 text-(--foreground) pointer-events-auto" style={{ zIndex: 99999 }}>
              {/* Blur overlay */}
              <div 
                className="fixed inset-0 min-h-screen w-full pointer-events-none"
                style={{
                  backdropFilter: 'blur(40px)',
                  WebkitBackdropFilter: 'blur(40px)',
                  zIndex: 0.5
                }}
              />
              
              {/* Invisible overlay for backdrop click handling */}
              <div 
                className="absolute inset-0 pointer-events-auto"
                style={{ 
                  backgroundColor: 'transparent',
                  zIndex: 1
                }}
                onClick={handleCloseTextSelectionModal}
              />
              
              <div
                className="relative h-full w-full flex flex-col transform-gpu"
                style={{ zIndex: 2 }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  aria-label="Close"
                  className="absolute top-3 right-3 rounded-full p-2 z-10 cursor-pointer transition-all duration-200 hover:scale-105 active:scale-95"
                  onClick={handleCloseTextSelectionModal}
                  style={{ outline: '0 !important', WebkitTapHighlightColor: 'transparent', ...getAdaptiveGlassStyleBlur(), color: 'var(--foreground)' }}
                >
                  <IoClose size={20} style={{ color: 'var(--foreground)' }} />
                </button>
                <div className="px-12 sm:px-16 md:px-20 lg:px-28 pt-12 sm:pt-30 pb-24 overflow-y-auto">
                  {/* 제목만 (Background와 동일) */}
                  <div className="flex items-center justify-between">
                    <h2 className="text-3xl sm:text-3xl md:text-4xl font-semibold tracking-tight" style={getTextStyle(false)}>Select Text</h2>
                    <div />
                  </div>
                  {/* mt-12: 제목 아래 컨텐츠 (제목-토글 간격 늘림) */}
                  <div className="mt-12 ml-1">
                    {/* md/txt 토글 - 제목보다 밑에 */}
                    <div className="flex items-center gap-3 mb-8">
                      <span className={`text-[10px] tracking-wider font-bold ${isMarkdownView ? 'opacity-80' : 'opacity-40'}`} style={{ color: 'var(--foreground)' }}>md</span>
                      <button
                        type="button"
                        onClick={() => setIsMarkdownView(!isMarkdownView)}
                        className="relative w-10 h-5 rounded-full bg-white/10 border border-white/10 transition-colors duration-200 cursor-pointer"
                        style={{ WebkitTapHighlightColor: 'transparent', WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
                        aria-label={isMarkdownView ? 'Switch to plain text' : 'Switch to markdown'}
                      >
                        <div className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-all duration-200 shadow-sm ${isMarkdownView ? 'left-0.5' : 'left-[22px]'}`} />
                      </button>
                      <span className={`text-[10px] tracking-wider font-bold ${!isMarkdownView ? 'opacity-80' : 'opacity-40'}`} style={{ color: 'var(--foreground)' }}>txt</span>
                    </div>
                    {/* 텍스트 영역 */}
                    <div
                      data-text-selection-area
                      className="min-h-[200px] overflow-y-auto overflow-x-hidden"
                      style={{
                        WebkitUserSelect: 'text',
                        MozUserSelect: 'text',
                        msUserSelect: 'text',
                        userSelect: 'text',
                        touchAction: 'pan-y',
                        wordBreak: 'break-word',
                        overflowWrap: 'break-word'
                      }}
                    >
                      <pre ref={textSelectionRef} className="whitespace-pre-wrap font-sans text-sm leading-relaxed" style={{ color: 'var(--foreground)', margin: 0, fontFamily: 'inherit', wordBreak: 'break-word', overflowWrap: 'break-word', whiteSpace: 'pre-wrap', maxWidth: '100%', overflowX: 'hidden' }}>
                        {(isMarkdownView ? markdownText : convertedText) || 'No text available'}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>,
        typeof window !== 'undefined' ? document.body : (null as any)
      )}
    </div>
  );
}, areMessagePropsEqual);


export { Message }; 






