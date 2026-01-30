'use client'

import { UIMessage as AIMessage } from 'ai'
import { User } from '@supabase/supabase-js'
import React, { useState, useEffect, useCallback, memo, useRef, useMemo, useDeferredValue } from 'react'
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso'
import { Message as MessageComponent } from '@/app/components/Message'
import { getYouTubeLinkAnalysisData, getYouTubeSearchData, getWebSearchResults, getMathCalculationData, getLinkReaderData, getImageGeneratorData, getGeminiImageData, getSeedreamImageData, getQwenImageData, getGoogleSearchData, getTwitterSearchData, getWan25VideoData } from '@/app/hooks/toolFunction';
import { formatMessageGroupTimestamp } from '@/app/lib/messageGroupTimeUtils';
import { createClient } from '@/utils/supabase/client';
import { linkMetaEntryToCardData } from '@/app/lib/linkCardUtils';
import type { LinkCardData, LinkMetaEntry } from '@/app/types/linkPreview';
import { fetchUserName } from '@/app/components/AccountDialog';
import { formatMessageTime } from '@/app/lib/translations/messageTime';

// Type for context summary
interface ContextSummaryData {
  summary: string;
  summarized_until_message_id: string;
  summarized_until_sequence: number;
  created_at: string;
}

// 🚀 OPTIMIZATION: 커스텀 비교 함수로 progress annotation만 변경될 때 리렌더링 방지
const areMessageItemPropsEqual = (prevProps: any, nextProps: any) => {
  // message.annotations의 progress만 변경된 경우 무시
  const prevAnnotationsWithoutProgress = (prevProps.message?.annotations || []).filter(
    (a: any) => a?.type !== 'wan25_video_progress' && a?.type !== 'data-wan25_video_progress'
  );
  const nextAnnotationsWithoutProgress = (nextProps.message?.annotations || []).filter(
    (a: any) => a?.type !== 'wan25_video_progress' && a?.type !== 'data-wan25_video_progress'
  );
  
  // annotations (progress 제외) 비교
  const annotationsEqual = JSON.stringify(prevAnnotationsWithoutProgress) === JSON.stringify(nextAnnotationsWithoutProgress);
  
  // message.parts의 실제 내용 비교 (progress annotation 제외)
  const prevPartsWithoutProgress = (prevProps.message?.parts || []).filter(
    (p: any) => p?.type !== 'data-wan25_video_progress'
  );
  const nextPartsWithoutProgress = (nextProps.message?.parts || []).filter(
    (p: any) => p?.type !== 'data-wan25_video_progress'
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
  
  // 다른 props 비교 (함수와 객체는 참조 비교)
  const otherPropsEqual = 
    prevProps.index === nextProps.index &&
    prevProps.totalMessages === nextProps.totalMessages &&
    prevProps.currentModel === nextProps.currentModel &&
    prevProps.isRegenerating === nextProps.isRegenerating &&
    prevProps.editingMessageId === nextProps.editingMessageId &&
    prevProps.editingContent === nextProps.editingContent &&
    prevProps.copiedMessageId === nextProps.copiedMessageId &&
    prevProps.chatId === nextProps.chatId &&
    prevProps.isLoading === nextProps.isLoading &&
    prevProps.activePanelMessageId === nextProps.activePanelMessageId &&
    prevProps.searchTerm === nextProps.searchTerm &&
    prevProps.previousMessage?.id === nextProps.previousMessage?.id &&
    prevProps.nextMessage?.id === nextProps.nextMessage?.id &&
    prevProps.user?.id === nextProps.user?.id &&
    prevProps.isBookmarksLoading === nextProps.isBookmarksLoading &&
    JSON.stringify(prevProps.activePanel) === JSON.stringify(nextProps.activePanel) &&
    JSON.stringify(prevProps.contextSummary) === JSON.stringify(nextProps.contextSummary) &&
    // 함수와 Set은 참조 비교 (자주 변경되지 않음)
    prevProps.onRegenerate === nextProps.onRegenerate &&
    prevProps.onCopy === nextProps.onCopy &&
    prevProps.onEditStart === nextProps.onEditStart &&
    prevProps.onEditCancel === nextProps.onEditCancel &&
    prevProps.onEditSave === nextProps.onEditSave &&
    prevProps.setEditingContent === nextProps.setEditingContent &&
    prevProps.isWaitingForToolResults === nextProps.isWaitingForToolResults &&
    prevProps.hasCanvasData === nextProps.hasCanvasData &&
    prevProps.togglePanel === nextProps.togglePanel &&
    prevProps.handleFollowUpQuestionClick === nextProps.handleFollowUpQuestionClick &&
    prevProps.handleBookmarkToggle === nextProps.handleBookmarkToggle &&
    // Set과 Map은 참조 비교 (내용이 같으면 참조도 같음)
    prevProps.bookmarkedMessageIds === nextProps.bookmarkedMessageIds &&
    prevProps.globalImageMap === nextProps.globalImageMap &&
    prevProps.globalVideoMap === nextProps.globalVideoMap;
  
  // 모든 핵심 필드가 같으면 리렌더링 방지
  return messageCoreEqual && otherPropsEqual;
};

// 🚀 Performance: MessageItem component to isolate expensive calculations and re-renders
const MessageItem = memo(function MessageItem({
  message,
  previousMessage,
  nextMessage,
  index,
  totalMessages,
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
  isLoading,
  isWaitingForToolResults,
  hasCanvasData,
  activePanelMessageId,
  activePanel,
  togglePanel,
  user,
  handleFollowUpQuestionClick,
  globalImageMap,
  globalVideoMap,
  bookmarkedMessageIds,
  handleBookmarkToggle,
  isBookmarksLoading,
  searchTerm,
  contextSummary,
  allMessages
}: any) {
  // 🚀 OPTIMIZATION: progress annotation만 변경될 때는 재계산 방지
  // message.annotations에서 progress를 제외한 나머지만 비교
  const messageKey = useMemo(() => {
    const annotationsWithoutProgress = (message.annotations || []).filter(
      (a: any) => a?.type !== 'wan25_video_progress' && a?.type !== 'data-wan25_video_progress'
    );
    return JSON.stringify({
      id: message.id,
      parts: message.parts,
      tool_results: (message as any).tool_results,
      annotations: annotationsWithoutProgress
    });
  }, [
    message.id, 
    message.parts, 
    (message as any).tool_results,
    // annotations를 직렬화하여 비교 (progress 제외)
    JSON.stringify((message.annotations || []).filter(
      (a: any) => a?.type !== 'wan25_video_progress' && a?.type !== 'data-wan25_video_progress'
    ))
  ]);

  // Memoize expensive tool data extractions
  // 🚀 OPTIMIZATION: messageKey만 의존성으로 사용하여 progress annotation 변경 시 재계산 방지
  // message는 클로저로 접근하되, messageKey가 변경되지 않으면 재계산하지 않음
  const toolData = useMemo(() => {
    return {
      webSearchData: getWebSearchResults(message),
      imageGeneratorData: getImageGeneratorData(message),
      geminiImageData: getGeminiImageData(message),
      seedreamImageData: getSeedreamImageData(message),
      qwenImageData: getQwenImageData(message),
      googleSearchData: getGoogleSearchData(message),
      twitterSearchData: getTwitterSearchData(message),
      mathCalculationData: getMathCalculationData(message),
      linkReaderData: getLinkReaderData(message),
      youTubeSearchData: getYouTubeSearchData(message),
      youTubeLinkAnalysisData: getYouTubeLinkAnalysisData(message),
      wan25VideoData: getWan25VideoData(message)
    };
  }, [messageKey, message]); // messageKey가 변경되지 않으면 재계산 방지 (progress annotation 제외)

  const {
    webSearchData,
    imageGeneratorData,
    geminiImageData,
    seedreamImageData,
    qwenImageData,
    googleSearchData,
    twitterSearchData,
    mathCalculationData,
    linkReaderData,
    youTubeSearchData,
    youTubeLinkAnalysisData,
    wan25VideoData
  } = toolData;


  // Memoize map generation
  // 🚀 OPTIMIZATION: 각 맵을 별도 useMemo로 분리하여 안정화
  // 새 메시지 추가 시 각 맵의 내용이 변경되지 않으면 참조 유지
  const combinedImageMap = useMemo(() => {
    return {
      ...globalImageMap,
      ...(webSearchData?.imageMap || {}),
      ...(googleSearchData?.imageMap || {}),
      ...(twitterSearchData?.imageMap || {}),
      ...(imageGeneratorData?.generatedImages?.reduce((acc: any, image: any, index: number) => {
        const imageKey = `generated_image_${image.seed || index}`;
        acc[imageKey] = image.imageUrl;
        return acc;
      }, {}) || {}),
      ...(geminiImageData?.generatedImages?.reduce((acc: any, image: any, index: number) => {
        if (image.path) {
          const fileName = image.path.split('/').pop();
          const imageKey = fileName.replace(/\.[^/.]+$/, '');
          acc[imageKey] = image.imageUrl;
        }
        return acc;
      }, {}) || {}),
      ...(seedreamImageData?.generatedImages?.reduce((acc: any, image: any, index: number) => {
        if (image.path) {
          const fileName = image.path.split('/').pop();
          const imageKey = fileName.replace(/\.[^/.]+$/, '');
          acc[imageKey] = image.imageUrl;
        }
        return acc;
      }, {}) || {}),
      ...(qwenImageData?.generatedImages?.reduce((acc: any, image: any, index: number) => {
        if (image.path) {
          const fileName = image.path.split('/').pop();
          const imageKey = fileName.replace(/\.[^/.]+$/, '');
          acc[imageKey] = image.imageUrl;
        }
        return acc;
      }, {}) || {})
    };
  }, [globalImageMap, webSearchData?.imageMap, googleSearchData?.imageMap, twitterSearchData?.imageMap, imageGeneratorData?.generatedImages, geminiImageData?.generatedImages, seedreamImageData?.generatedImages, qwenImageData?.generatedImages]);

  const linkMap = useMemo(() => {
    return {
      ...(webSearchData?.linkMap || {}),
      ...(googleSearchData?.linkMap || {}),
      ...(twitterSearchData?.linkMap || {})
    };
  }, [webSearchData?.linkMap, googleSearchData?.linkMap, twitterSearchData?.linkMap]);

  const thumbnailMap = useMemo(() => {
    return {
      ...(webSearchData?.thumbnailMap || {}),
      ...(googleSearchData?.thumbnailMap || {}),
      ...(twitterSearchData?.thumbnailMap || {})
    };
  }, [webSearchData?.thumbnailMap, googleSearchData?.thumbnailMap, twitterSearchData?.thumbnailMap]);

  const titleMap = useMemo(() => {
    return {
      ...(webSearchData?.titleMap || {}),
      ...(googleSearchData?.titleMap || {}),
      ...(twitterSearchData?.titleMap || {})
    };
  }, [webSearchData?.titleMap, googleSearchData?.titleMap, twitterSearchData?.titleMap]);

  const linkMetaMap = useMemo(() => {
    return {
      ...(webSearchData?.linkMetaMap || {}),
      ...(googleSearchData?.linkMetaMap || {}),
      ...(twitterSearchData?.linkMetaMap || {})
    };
  }, [webSearchData?.linkMetaMap, googleSearchData?.linkMetaMap, twitterSearchData?.linkMetaMap]);

  const linkPreviewData = useMemo(() => {
    const previewData: Record<string, LinkCardData> = {};
    Object.values(linkMetaMap || {}).forEach(entry => {
      const normalized = linkMetaEntryToCardData(entry as LinkMetaEntry);
      if (normalized?.url) {
        previewData[normalized.url] = normalized;
      }
    });
    return previewData;
  }, [linkMetaMap]);

  const combinedVideoMap = useMemo(() => {
    return {
      ...globalVideoMap,
      ...(wan25VideoData?.generatedVideos?.reduce((acc: any, video: any) => {
        if (video.path) {
          const fileName = video.path.split('/').pop();
          const videoKey = fileName.replace(/\.[^/.]+$/, '');
          acc[videoKey] = video.size ? { url: video.videoUrl, size: video.size } : video.videoUrl;
        }
        return acc;
      }, {}) || {})
    };
  }, [globalVideoMap, wan25VideoData?.generatedVideos]);

  const promptMap = useMemo(() => {
    const map: Record<string, string> = {};
    
    // geminiImageData에서 prompt 추출
    geminiImageData?.generatedImages?.forEach((image: any) => {
      if (image.imageUrl && image.prompt) {
        map[image.imageUrl] = image.prompt;
      }
    });
    
    // seedreamImageData에서 prompt 추출
    seedreamImageData?.generatedImages?.forEach((image: any) => {
      if (image.imageUrl && image.prompt) {
        map[image.imageUrl] = image.prompt;
      }
    });
    
    // qwenImageData에서 prompt 추출
    qwenImageData?.generatedImages?.forEach((image: any) => {
      if (image.imageUrl && image.prompt) {
        map[image.imageUrl] = image.prompt;
      }
    });
    
    // imageGeneratorData에서 prompt 추출
    imageGeneratorData?.generatedImages?.forEach((image: any) => {
      if (image.imageUrl && image.prompt) {
        map[image.imageUrl] = image.prompt;
      }
    });

    // wan25VideoData에서 prompt 추출
    wan25VideoData?.generatedVideos?.forEach((video: any) => {
      if (video.videoUrl && video.prompt) {
        map[video.videoUrl] = video.prompt;
      }
    });

    return map;
  }, [geminiImageData?.generatedImages, seedreamImageData?.generatedImages, qwenImageData?.generatedImages, imageGeneratorData?.generatedImages, wan25VideoData?.generatedVideos]);

  const sourceImageMap = useMemo(() => {
    const map: Record<string, string> = {};
    
    // wan25VideoData에서 sourceImageUrl 추출
    wan25VideoData?.generatedVideos?.forEach((video: any) => {
      if (video.videoUrl && video.sourceImageUrl) {
        map[video.videoUrl] = video.sourceImageUrl;
      }
    });

    // geminiImageData에서 originalImageUrl 추출
    geminiImageData?.generatedImages?.forEach((image: any) => {
      if (image.imageUrl) {
        // originalImageUrls가 배열인 경우 첫 번째 사용, 아니면 originalImageUrl 사용
        const originalUrl = image.originalImageUrls && Array.isArray(image.originalImageUrls) && image.originalImageUrls.length > 0
          ? image.originalImageUrls[0]
          : image.originalImageUrl;
        if (originalUrl) {
          map[image.imageUrl] = originalUrl;
        }
      }
    });

    // seedreamImageData에서 originalImageUrl 추출
    seedreamImageData?.generatedImages?.forEach((image: any) => {
      if (image.imageUrl && image.originalImageUrl) {
        map[image.imageUrl] = image.originalImageUrl;
      }
    });

    // qwenImageData에서 originalImageUrl 추출
    qwenImageData?.generatedImages?.forEach((image: any) => {
      if (image.imageUrl && image.originalImageUrl) {
        map[image.imageUrl] = image.originalImageUrl;
      }
    });

    // 스트리밍 중 프롬프트 버튼 클릭 시 소스 이미지가 보이도록: parts의 완료 annotation에서 직접 추출 (tool 데이터 병합/순서 이슈 방지)
    const parts = (message as any).parts;
    if (Array.isArray(parts)) {
      for (const part of parts) {
        if (!part?.data?.imageUrl) continue;
        const d = part.data;
        let originalUrl: string | undefined;
        if (part.type === 'data-gemini_image_complete') {
          originalUrl = (d.originalImageUrls && Array.isArray(d.originalImageUrls) && d.originalImageUrls.length > 0)
            ? d.originalImageUrls[0]
            : d.originalImageUrl;
        } else if (part.type === 'data-seedream_image_complete' || part.type === 'data-qwen_image_complete') {
          originalUrl = d.originalImageUrl;
        }
        if (originalUrl) {
          map[d.imageUrl] = originalUrl;
        }
      }
    }

    return map;
  }, [wan25VideoData?.generatedVideos, geminiImageData?.generatedImages, seedreamImageData?.generatedImages, qwenImageData?.generatedImages, (message as any).parts]);

  // 🚀 OPTIMIZATION: maps 객체 안정화 - 각 맵의 참조가 변경되지 않으면 maps 객체 참조도 유지
  const maps = useMemo(() => {
    return { 
      imageMap: combinedImageMap, 
      linkMap, 
      thumbnailMap, 
      titleMap, 
      linkPreviewData, 
      videoMap: combinedVideoMap, 
      promptMap,
      sourceImageMap
    };
  }, [combinedImageMap, linkMap, thumbnailMap, titleMap, linkPreviewData, combinedVideoMap, promptMap, sourceImageMap]);

  const showTimestamp = useMemo(() => {
    if (!previousMessage) return false;
    const currentTimestamp = new Date((message as any).createdAt || new Date()).getTime();
    const previousTimestamp = new Date((previousMessage as any).createdAt || new Date()).getTime();
    return (currentTimestamp - previousTimestamp) > 30 * 60 * 1000;
  }, [message, previousMessage]);

  const isLastMessage = index === totalMessages - 1;
  const isNextMessageAssistant = nextMessage?.role === 'assistant';
  const isCurrentMessageUser = message.role === 'user';
  const isCurrentMessageAssistant = message.role === 'assistant';

  // 🚀 FIX: margin 대신 padding 사용 - ResizeObserver는 contentRect만 측정하므로 margin은 높이 계산에서 누락됨
  // Virtuoso 버벅임의 핵심 원인!
  let spacingClass = '';
  if (isCurrentMessageUser && isNextMessageAssistant) {
    spacingClass = 'pb-2';
  } else if (isCurrentMessageAssistant && index < totalMessages - 1) {
    spacingClass = 'pb-4';
  } else if (isCurrentMessageAssistant && index === totalMessages - 1) {
    spacingClass = 'pb-0';
  } else {
    spacingClass = 'pb-3';
  }

  const isSummaryBoundary = contextSummary?.summarized_until_message_id === message.id;

  return (
    <React.Fragment>
      {showTimestamp && (
        <div className="thread-content">
          <div className="message-timestamp" style={{ paddingTop: '0', textTransform: 'none', color: '#737373' }}>
            {formatMessageGroupTimestamp((message as any).createdAt || new Date())}
          </div>
        </div>
      )}
      {/* 🚀 FIX: margin 대신 padding으로 간격 처리하여 ResizeObserver 측정 정확도 향상 */}
      <div 
        className={`${spacingClass} thread-content transform-gpu`}
        data-scroll-anchor={isLastMessage ? "true" : "false"}
        data-message-id={message.id}
        style={{ contain: 'layout style' }}
      >
        <div className="relative">
          <MessageComponent
            message={message}
            currentModel={currentModel}
            isRegenerating={isRegenerating}
            editingMessageId={editingMessageId}
            editingContent={editingContent}
            copiedMessageId={copiedMessageId}
            onRegenerate={onRegenerate}
            onCopy={onCopy}
            onEditStart={onEditStart}
            onEditCancel={onEditCancel}
            onEditSave={onEditSave}
            setEditingContent={setEditingContent}
            chatId={chatId}
            isStreaming={isLoading && message.role === 'assistant' && isLastMessage}
            isWaitingForToolResults={isWaitingForToolResults}
            activePanelMessageId={activePanelMessageId}
            activePanel={activePanel}
            togglePanel={togglePanel}
            isLastMessage={isLastMessage}
            webSearchData={webSearchData}
            mathCalculationData={mathCalculationData}
            linkReaderData={linkReaderData}
            imageGeneratorData={imageGeneratorData}
            geminiImageData={geminiImageData}
            seedreamImageData={seedreamImageData}
            qwenImageData={qwenImageData}
            twitterSearchData={twitterSearchData}
            youTubeSearchData={youTubeSearchData}
            youTubeLinkAnalysisData={youTubeLinkAnalysisData}
            googleSearchData={googleSearchData}
            wan25VideoData={wan25VideoData}
            user={user}
            handleFollowUpQuestionClick={handleFollowUpQuestionClick}
            allMessages={allMessages}
            isGlobalLoading={isLoading}
            imageMap={maps.imageMap}
            videoMap={maps.videoMap}
            linkMap={maps.linkMap}
            thumbnailMap={maps.thumbnailMap}
            titleMap={maps.titleMap}
            linkPreviewData={maps.linkPreviewData}
            promptMap={maps.promptMap}
            sourceImageMap={maps.sourceImageMap}
            isBookmarked={bookmarkedMessageIds.has(message.id)}
            onBookmarkToggle={handleBookmarkToggle}
            isBookmarksLoading={isBookmarksLoading}
            searchTerm={searchTerm}
          />
        </div>
      </div>
      {isSummaryBoundary && (
        <div className="thread-content" style={{ contain: 'layout style' }}>
          {/* 🚀 FIX: my-2 (margin) 대신 py-2 추가하여 padding으로 변환 */}
          <div className="flex items-center justify-center gap-2 py-5">
            <div className="h-px flex-1 bg-neutral-200 dark:bg-neutral-700" />
            <span className="text-xs text-neutral-500 dark:text-neutral-400 px-2 whitespace-nowrap">
              Previous messages summarized
            </span>
            <div className="h-px flex-1 bg-neutral-200 dark:bg-neutral-700" />
          </div>
        </div>
      )}
    </React.Fragment>
  );
}, areMessageItemPropsEqual);

interface VirtualizedMessagesProps {
  messages: any[]
  currentModel: string
  isRegenerating: boolean
  editingMessageId: string | null
  editingContent: string
  copiedMessageId: string | null
  onRegenerate: (messageId: string) => (e: React.MouseEvent) => void
  onCopy: (message: any) => void
  onEditStart: (message: any) => void
  onEditCancel: () => void
  onEditSave: (messageId: string, files?: globalThis.File[], remainingAttachments?: any[]) => void
  setEditingContent: (content: string) => void
  chatId?: string
  isLoading?: boolean
  isWaitingForToolResults: (message: any) => boolean
  hasCanvasData: (message: any) => boolean
  activePanelMessageId: string | null
  activePanel?: { messageId: string; type: string; toolType?: string } | null
  togglePanel: (messageId: string, type: 'canvas' | 'structuredResponse' | 'attachment', fileIndex?: number, toolType?: string, fileName?: string) => void
  user: User | null
  handleFollowUpQuestionClick: (question: string) => Promise<void>
  messagesEndRef: React.RefObject<HTMLDivElement | null>
  searchTerm?: string | null // 🚀 FEATURE: Search term for highlighting
  onLoadMore?: () => void // 무한 스크롤을 위한 콜백
  hasMore?: boolean // 더 로드할 메시지가 있는지 여부
  contextSummary?: ContextSummaryData | null // 🚀 Context summary for displaying summarization marker
}

// ✅ P1 FIX: React.memo로 렌더링 최적화 - 빠른 스트리밍 시 불필요한 리렌더링 방지
export const VirtualizedMessages = memo(function VirtualizedMessages({
  messages,
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
  isLoading,
  isWaitingForToolResults,
  hasCanvasData,
  activePanelMessageId,
  activePanel,
  togglePanel,
  user,
  handleFollowUpQuestionClick,
  messagesEndRef,
  searchTerm, // 🚀 FEATURE: Search term for highlighting
  onLoadMore,
  hasMore = false,
  contextSummary = null // 🚀 Context summary for displaying summarization marker
}: VirtualizedMessagesProps) {
  // 🚀 LAZY LOADING: 이미지 프리로딩 로직 제거
  // IntersectionObserver 기반 lazy loading이 각 컴포넌트에서 직접 처리하므로
  // 전역 프리로딩은 불필요하며 오히려 초기 로딩을 느리게 함

  // Virtuoso ref
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  
  // 🚀 INFINITE SCROLL: firstItemIndex를 위한 큰 시작 값
  // 새 메시지가 앞에 추가될 때 스크롤 위치 유지를 위해 필요
  const FIRST_INDEX = 100000;
  
  // 🚀 SCROLL STABILITY: 이전 메시지 길이 추적 (prepend vs append 구분용)
  const prevMessageLengthRef = useRef(messages.length);
  
  // 🔥 서버와 동일한 로직으로 전체 대화 기반 글로벌 이미지 맵 구성
  // InlineToolPreview 및 서버 tools.ts와 완벽히 일치하는 순서로 인덱싱
  const globalImageMap = useMemo(() => {
    const imageMap: Record<string, string> = {};
    let uploadedImageIndex = 1;
    let generatedImageIndex = 1;
    
    // 🔥 path 기반 중복 추적 (같은 path를 가진 이미지는 한 번만 추가)
    const seenPaths = new Set<string>();
    
    // Helper: path에서 파일명 기반 ID 추출 (예: "user-id/seedream_123_abc.png" -> "seedream_123_abc")
    const extractFilenameId = (path: string): string | null => {
      if (!path) return null;
      const filename = path.split('/').pop(); // 마지막 경로 요소
      if (!filename) return null;
      // 확장자 제거
      return filename.replace(/\.[^.]+$/, '');
    };
    
    for (const message of messages) {
      let foundInParts = false;
      
      // 1. [Uploads] experimental_attachments 처리
      if (message.experimental_attachments && Array.isArray(message.experimental_attachments)) {
        for (const attachment of message.experimental_attachments) {
          if (attachment.contentType?.startsWith('image/') || attachment.fileType === 'image') {
            imageMap[`uploaded_image_${uploadedImageIndex++}`] = attachment.url;
          }
        }
      }
      
      // 2. [Primary] AI SDK v5: parts 배열 처리 (Uploads + Generated)
      if (message.parts && Array.isArray(message.parts)) {
        for (const part of message.parts) {
          // v5 업로드 파일 파트
          if (part.type === 'file' && part.mediaType?.startsWith('image/')) {
            if (part.url || part.data) {
              imageMap[`uploaded_image_${uploadedImageIndex++}`] = part.url || part.data;
            }
          }
          
          // 🔥 v5 도구 결과 파트 (DB 저장 형식: tool-${toolName})
          const imageToolNames = ['gemini_image_tool', 'seedream_image_tool', 'qwen_image_edit'];
          const isToolResult = imageToolNames.some(toolName => 
            part.type === `tool-${toolName}` ||                    // DB 저장 형식
            (part.type === 'tool-result' && part.toolName === toolName)  // AI SDK 표준
          );
          
          if (isToolResult) {
            const result = part.output?.value || part.output || part.result;
            if (result && result.success !== false) {
              const images = Array.isArray(result) ? result : (result.images || (result.imageUrl ? [result] : []));
              for (const img of images) {
                if (img.imageUrl) {
                  // 🔥 path 기반 중복 체크 (path가 있으면 path로, 없으면 imageUrl로)
                  const dedupKey = img.path || img.imageUrl;
                  if (!seenPaths.has(dedupKey)) {
                    seenPaths.add(dedupKey);
                    imageMap[`generated_image_${generatedImageIndex++}`] = img.imageUrl;
                    
                    // 🔥 파일명 기반 ID도 추가 매핑 (seedream_123_abc 형식)
                    if (img.path) {
                      const filenameId = extractFilenameId(img.path);
                      if (filenameId) {
                        imageMap[filenameId] = img.imageUrl;
                      }
                    }
                    
                    foundInParts = true;
                  }
                }
              }
            }
          }
          
          // 🔥 data-*_image_complete annotation 처리 (스트리밍 완료 이벤트)
          // ⚠️ tool-* 결과와 중복되므로, path 기반으로 중복 체크
          if (part.type === 'data-seedream_image_complete' || part.type === 'data-gemini_image_complete' || part.type === 'data-qwen_image_complete') {
            const data = part.data;
            if (data?.imageUrl) {
              // 🔥 path 기반 중복 체크 (path가 우선, 없으면 imageUrl)
              const dedupKey = data.path || data.imageUrl;
              if (!seenPaths.has(dedupKey)) {
                seenPaths.add(dedupKey);
                imageMap[`generated_image_${generatedImageIndex++}`] = data.imageUrl;
                
                // 파일명 기반 ID 매핑
                if (data.path) {
                  const filenameId = extractFilenameId(data.path);
                  if (filenameId) {
                    imageMap[filenameId] = data.imageUrl;
                  }
                }
              }
            }
          }
        }
      }
      
      // 3. [Backup] 기존 구조 처리 (parts에서 찾지 못한 경우만 실행)
      if (!foundInParts) {
        // legacy tool_results 객체 체크
        if (message.tool_results) {
          const results = message.tool_results.geminiImageResults || message.tool_results.seedreamImageResults || message.tool_results.qwenImageResults;
          if (Array.isArray(results)) {
            for (const img of results) {
              if (img.imageUrl) {
                imageMap[`generated_image_${generatedImageIndex++}`] = img.imageUrl;
                
                // 파일명 기반 ID 매핑
                if (img.path) {
                  const filenameId = extractFilenameId(img.path);
                  if (filenameId) {
                    imageMap[filenameId] = img.imageUrl;
                  }
                }
              }
            }
          }
        }
      }
    }
    
    return imageMap;
  }, [messages]);
  
  // 🚀 OPTIMIZATION: Helper 함수를 컴포넌트 외부로 이동하여 재생성 방지
  // (하지만 컴포넌트 내부에서 사용하므로 useCallback으로 최적화)
  const extractFilenameId = useCallback((path: string): string | null => {
    if (!path) return null;
    const filename = path.split('/').pop();
    if (!filename) return null;
    return filename.replace(/\.[^.]+$/, '');
  }, []);

  // 🚀 OPTIMIZATION: 각 메시지의 parts를 개별적으로 추적하여 비디오 맵 재계산 최적화
  // messages 배열 자체를 의존성으로 사용하여 input state 변경 시 불필요한 재계산 방지
  const messagePartsKeys = useMemo(() => {
    return messages.map(msg => {
      if (!msg.parts || !Array.isArray(msg.parts)) return '';
      // progress annotation 제외하고 직렬화 (비디오 관련 parts만 포함)
      const videoParts = msg.parts.filter(
        (p: any) => p?.type?.startsWith('tool-wan25_') || p?.type === 'data-wan25_video_complete'
      );
      return JSON.stringify(videoParts);
    });
  }, [messages]); // ✅ messages 배열 자체를 의존성으로 사용 (참조 비교)

  // 🚀 OPTIMIZATION: useDeferredValue를 사용하여 비디오 맵 업데이트 지연
  // 새 메시지 추가 시 비디오 맵 재계산을 지연하여 입력 응답성 향상
  const deferredMessagePartsKeys = useDeferredValue(messagePartsKeys);

  // 🔥 글로벌 비디오 맵 구성 (parts에서 비디오 URL 수집)
  // 🚀 OPTIMIZATION: 계산 결과 안정화 및 불필요한 중복 체크 최소화
  const globalVideoMap = useMemo(() => {
    const videoMap: Record<string, { url: string; size?: string } | string> = {};
    let generatedVideoIndex = 1;
    
    // 🔥 path 기반 중복 추적 (같은 path를 가진 비디오는 한 번만 추가)
    const seenPaths = new Set<string>();
    
    for (const message of messages) {
      let foundInParts = false;
      
      if (message.parts && Array.isArray(message.parts)) {
        for (const part of message.parts) {
          // 🔥 tool-wan25_* 비디오 결과 파트 처리
          if (part.type?.startsWith('tool-wan25_') && part.output?.videos && Array.isArray(part.output.videos)) {
            const result = part.output;
            if (result && result.success !== false) {
              for (const vid of result.videos) {
                if (vid.videoUrl) {
                  // 🔥 path 기반 중복 체크 (path가 있으면 path로, 없으면 videoUrl로)
                  const dedupKey = vid.path || vid.videoUrl;
                  if (!seenPaths.has(dedupKey)) {
                    seenPaths.add(dedupKey);
                    const videoData = vid.size ? { url: vid.videoUrl, size: vid.size } : vid.videoUrl;
                    videoMap[`generated_video_${generatedVideoIndex++}`] = videoData;
                    
                    // 파일명 기반 ID도 추가 매핑
                    if (vid.path) {
                      const filenameId = extractFilenameId(vid.path);
                      if (filenameId && !videoMap[filenameId]) {
                        videoMap[filenameId] = videoData;
                      }
                    }
                    
                    foundInParts = true;
                  }
                }
              }
            }
          }
          
          // 🔥 data-wan25_video_complete annotation 처리
          // ⚠️ tool-wan25_* 결과와 중복되므로, path 기반으로 중복 체크
          if (part.type === 'data-wan25_video_complete') {
            const data = part.data;
            if (data?.videoUrl) {
              // 🔥 path 기반 중복 체크 (path가 우선, 없으면 videoUrl)
              const dedupKey = data.path || data.videoUrl;
              if (!seenPaths.has(dedupKey)) {
                seenPaths.add(dedupKey);
                const videoData = data.size ? { url: data.videoUrl, size: data.size } : data.videoUrl;
                videoMap[`generated_video_${generatedVideoIndex++}`] = videoData;
                
                // 파일명 기반 ID 매핑
                if (data.path) {
                  const filenameId = extractFilenameId(data.path);
                  if (filenameId && !videoMap[filenameId]) {
                    videoMap[filenameId] = videoData;
                  }
                }
              }
            }
          }
        }
      }
      
      // Backup: legacy tool_results 처리
      if (!foundInParts && message.tool_results?.wan25VideoResults) {
        const results = message.tool_results.wan25VideoResults;
        if (Array.isArray(results)) {
          for (const vid of results) {
            if (vid.videoUrl) {
              const videoData = vid.size ? { url: vid.videoUrl, size: vid.size } : vid.videoUrl;
              videoMap[`generated_video_${generatedVideoIndex++}`] = videoData;
              
              if (vid.path) {
                const filenameId = extractFilenameId(vid.path);
                if (filenameId && !videoMap[filenameId]) {
                  videoMap[filenameId] = videoData;
                }
              }
            }
          }
        }
      }
    }
    
    return videoMap;
  }, [deferredMessagePartsKeys, extractFilenameId]); // deferredMessagePartsKeys 사용하여 지연 업데이트
  
  // Bookmark state management
  const [bookmarkedMessageIds, setBookmarkedMessageIds] = useState<Set<string>>(new Set());
  const [isBookmarksLoading, setIsBookmarksLoading] = useState(false);
  
  // User name state for greeting
  const [userName, setUserName] = useState<string>('');
  const [isUserNameLoading, setIsUserNameLoading] = useState(true);

  // 무한 스크롤 상태 관리
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Greeting animation state for staggered entrance
  const [greetingAnimation, setGreetingAnimation] = useState({
    header: false,
    receive: false,
    send: false
  });

  // 🚀 FAST LOAD: 즉시 애니메이션 시작 (로딩 대기 없음)
  useEffect(() => {
    if (messages.length === 0) {
      const timeouts = [
        setTimeout(() => setGreetingAnimation(prev => ({ ...prev, header: true })), 100),
        setTimeout(() => setGreetingAnimation(prev => ({ ...prev, receive: true })), 300),
        setTimeout(() => setGreetingAnimation(prev => ({ ...prev, send: true })), 500)
      ];
      return () => timeouts.forEach(t => clearTimeout(t));
    }
  }, [messages.length]);

  // Fetch bookmarks for current chat session
  const fetchBookmarks = useCallback(async (currentMessages: any[]) => {
    if (!user || !chatId) return;
    
    setIsBookmarksLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('message_bookmarks')
        .select('message_id')
        .eq('user_id', user.id)
        .eq('chat_session_id', chatId);
        
      if (error) {
        console.error('Error fetching bookmarks:', error);
        return;
      }
      
      if (data && data.length > 0) {
        const bookmarkedIds = new Set<string>(data.map(bookmark => bookmark.message_id));
        setBookmarkedMessageIds(bookmarkedIds);
      } else {
        setBookmarkedMessageIds(new Set());
      }
    } catch (error) {
      console.error('Error fetching bookmarks:', error);
    } finally {
      setIsBookmarksLoading(false);
    }
  }, [user, chatId]);

  // Fetch bookmarks when user or chatId changes
  useEffect(() => {
    fetchBookmarks(messages);
  }, [user, chatId, messages.length, fetchBookmarks]);

  // Load user name for greeting
  const loadUserName = useCallback(async () => {
    if (!user) {
      setUserName('');
      setIsUserNameLoading(false);
      return;
    }
    try {
      const supabase = createClient();
      const nameResult = await fetchUserName(user.id, supabase).catch(() => 'You');
      setUserName(nameResult);
    } catch (error) {
      console.error('Error loading user name:', error);
      setUserName('You');
    } finally {
      setIsUserNameLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadUserName();
  }, [loadUserName]);

  // Handle bookmark toggle
  const handleBookmarkToggle = useCallback(async (messageId: string, shouldBookmark: boolean) => {
    if (!user || !chatId || !messageId) return;
    
    // 🚀 즉시 UI 반영 (낙관적 업데이트)
    setBookmarkedMessageIds(prev => {
      const newSet = new Set(prev);
      if (shouldBookmark) {
        newSet.add(messageId);
      } else {
        newSet.delete(messageId);
      }
      return newSet;
    });
    
    try {
      const supabase = createClient();
      const message = messages.find(m => m.id === messageId);
      if (!message) return;
      
      if (shouldBookmark) {
        // 🚀 content 추출 로직
        let messageContent = message.content;
        if (!messageContent && message.parts) {
          const textParts = message.parts.filter((p: any) => p.type === 'text');
          messageContent = textParts.map((p: any) => p.text).join(' ');
        }
        if (!messageContent || messageContent.trim() === '') {
          messageContent = '[Empty message]';
        }
        
        // Add bookmark
        const { error } = await supabase
          .from('message_bookmarks')
          .insert({
            message_id: messageId,
            user_id: user.id,
            chat_session_id: chatId,
            content: messageContent,
            model: (message as any).model || currentModel,
            created_at: new Date().toISOString()
          });
          
        if (error) {
          // 🚀 DB 실패 시 UI 롤백
          setBookmarkedMessageIds(prev => {
            const newSet = new Set(prev);
            newSet.delete(messageId);
            return newSet;
          });
          throw error;
        }
      } else {
        // Remove bookmark - message_id로 정확한 삭제
        const { error } = await supabase
          .from('message_bookmarks')
          .delete()
          .eq('message_id', messageId)
          .eq('user_id', user.id)
          .eq('chat_session_id', chatId);
          
        if (error) {
          // 🚀 DB 실패 시 UI 롤백
          setBookmarkedMessageIds(prev => {
            const newSet = new Set(prev);
            newSet.add(messageId);
            return newSet;
          });
          throw error;
        }
      }
    } catch (error) {
      console.error('Error toggling bookmark:', error);
    }
  }, [user, chatId, messages, currentModel]);

  // 🚀 INFINITE SCROLL: 무한 스크롤 핸들러 (startReached 콜백)
  const handleStartReached = useCallback(async () => {
    if (isLoadingMore || !hasMore || !onLoadMore) return;
    
    console.log('🚀 [LOAD MORE] Start reached, loading more messages...');
    setIsLoadingMore(true);
    try {
      await onLoadMore();
    } catch (error) {
      console.error('Error loading more messages:', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, onLoadMore]);

  // 🚀 INSTANT LOAD: 로딩 인디케이터 제거 - 즉시 컨텐츠 표시

  // 하단 스페이서 컴포넌트 - 적절한 여백 제공 (데스크탑: 300px, 모바일: 100px)
  const BottomSpacer = useCallback(() => (
    <div 
      ref={messagesEndRef} 
      className="h-[200px] min-h-[200px] md:h-[300px] md:min-h-[300px]"
    />
  ), [messagesEndRef]);


  // 🚀 SCROLL STABILITY: 항상 동일한 구조 유지
  const virtualizedData = useMemo(() => {
    // 메시지가 없으면 greeting 표시, 있으면 chatflix-label + messages
    if (messages.length === 0) {
      return [
        { id: 'greeting', type: 'greeting' }
      ];
    }
    return [
      { id: 'chatflix-label', type: 'chatflix-label' },
      ...messages
    ];
  }, [messages]);
  
  // 🚀 SCROLL STABILITY: firstItemIndex를 state로 관리 (Virtuoso에 전달하려면 리렌더 필요)
  // - 이전 메시지 로드(prepend): firstItemIndex 감소
  // - 새 메시지 추가(append): firstItemIndex 유지 (스크롤 점프 방지!)
  const [firstItemIndex, setFirstItemIndex] = useState(() => 
    Math.max(0, FIRST_INDEX - virtualizedData.length)
  );
  
  // 🚀 SCROLL STABILITY: ref로 최신 값 추적 (콜백에서 사용)
  const firstItemIndexRef = useRef(firstItemIndex);
  firstItemIndexRef.current = firstItemIndex;
  
  // 메시지 변경 시 prepend vs append 구분
  useEffect(() => {
    const prevLength = prevMessageLengthRef.current;
    const currentLength = messages.length;
    const diff = currentLength - prevLength;
    
    if (diff > 0 && prevLength > 0) {
      // 메시지가 추가됨 - prepend인지 append인지 확인
      // prepend: diff가 크면 batch load (이전 메시지)
      // append: diff가 1~2면 새 메시지 추가
      
      // 🚀 FIX: 새 메시지 추가(append)는 firstItemIndex를 변경하지 않음!
      // 이전 메시지 로드(prepend)만 firstItemIndex를 감소시킴
      if (hasMore && diff > 2) {
        // prepend: 이전 메시지 batch 로드 (보통 10~20개)
        const newFirstItemIndex = Math.max(0, FIRST_INDEX - virtualizedData.length);
        setFirstItemIndex(newFirstItemIndex);
      }
      // append (새 메시지 1~2개 추가)는 firstItemIndex 유지 → 스크롤 점프 없음!
    }
    // 🚀 SCROLL STABILITY: 첫 메시지 추가(prevLength === 0)도 firstItemIndex 유지!
    // virtualizedData 구조가 일관되므로 (항상 chatflix-label + messages)
    // 첫 메시지 추가 시에도 firstItemIndex를 변경할 필요 없음
    // else if (currentLength > 0 && prevLength === 0) { ... } 제거
    
    prevMessageLengthRef.current = currentLength;
  }, [messages.length, virtualizedData.length, hasMore, FIRST_INDEX]);

  // 🚀 INFINITE SCROLL: 범위 변경 시 미리 로드 트리거
  // 사용자가 상단 근처(15개 이내)에 도달하면 미리 load more 실행
  const handleRangeChanged = useCallback((range: { startIndex: number; endIndex: number }) => {
    // 🚀 FIX: ref에서 직접 읽어서 최신 값 사용
    const relativeStart = range.startIndex - firstItemIndexRef.current;
    
    // 상위 15개 아이템 이내에 도달하면 미리 로드 (더 일찍 트리거)
    if (relativeStart <= 15 && hasMore && !isLoadingMore && onLoadMore) {
      console.log('🚀 [LOAD MORE] Early trigger at relative index:', relativeStart);
      handleStartReached();
    }
  }, [hasMore, isLoadingMore, onLoadMore, handleStartReached]);

  // 🚀 FAST LOAD: 초기 로딩 대기 로직 제거 - Virtuoso의 alignToBottom이 자동으로 처리

  // 🚀 INFINITE SCROLL: 가상화 아이템 렌더링 함수
  const renderVirtualizedItem = useCallback((index: number) => {
    // 🚀 FIX: ref에서 직접 읽어서 최신 값 사용
    const dataIndex = index - firstItemIndexRef.current;
    const item = virtualizedData[dataIndex];
    
    // 🔥 FIX: Virtuoso에서 0 사이즈 요소 경고 방지를 위해 최소 높이 div 반환
    if (!item) return <div style={{ height: 1 }} />;
    
    // Greeting 레이아웃인 경우 (메시지가 없을 때)
    if (item.type === 'greeting') {
      if (isUserNameLoading) {
        return (
          <div className="thread-content" style={{ minHeight: '200px' }}>
          </div>
        );
      }
      
      const greetingText = user ? `Hey ${userName}!` : 'Hey there';
      
      return (
        <div className="thread-content">
          <div className="relative flex flex-col items-end">
            <div className={`w-full flex flex-col items-center mb-4 transform-gpu transition-all duration-500 ease-out ${
              greetingAnimation.header ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-[0.98]'
            }`}>
              <div className="message-timestamp chatflix-header relative z-10" style={{ paddingBottom: '0', textTransform: 'none', color: '#737373' }}>
                Chatflix
              </div>
              <div className="message-timestamp relative z-10" style={{ paddingTop: '0', textTransform: 'none', color: '#737373' }}>
                {formatMessageGroupTimestamp(new Date())}
              </div>
            </div>
            
            <div className={`flex justify-start w-full group mb-2 transform-gpu transition-all duration-500 ease-out ${
              greetingAnimation.receive ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-[0.98]'
            }`}>
              <div className="max-w-[85%] md:max-w-[70%]">
                <div className="imessage-receive-bubble"><span>{greetingText}</span></div>
              </div>
            </div>
            
            <div className={`flex justify-end w-full group mb-4 transform-gpu transition-all duration-500 ease-out ${
              greetingAnimation.send ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-[0.98]'
            }`}>
              <div className="max-w-[85%] md:max-w-[70%]">
                <div className="flex flex-col items-end gap-0">
                  <div className="imessage-send-bubble"><span>Hey</span></div>
                  <div className="text-[10px] text-neutral-500 mt-1 pr-1">{formatMessageTime(new Date())}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }
    
    // Chatflix 레이블인 경우
    if (item.type === 'chatflix-label') {
      // 첫 번째 메시지가 있으면 그 시간을, 없으면 현재 시간을 표시
      const firstMessage = messages[0];
      const displayDate = firstMessage ? (firstMessage.createdAt || new Date()) : new Date();
      
      return (
        <div className="thread-content">
          <div className="message-timestamp chatflix-header" style={{ 
            paddingBottom: '0', 
            textTransform: 'none', 
            color: '#737373'
          }}>
            Chatflix
          </div>
          <div className="message-timestamp" style={{ paddingTop: '0', textTransform: 'none', color: '#737373' }}>
            {formatMessageGroupTimestamp(displayDate)}
          </div>
        </div>
      );
    }
    
    // 일반 메시지인 경우 - dataIndex - 1 (chatflix-label이 첫 번째이므로)
    const messageIndex = dataIndex - 1;
    const message = messages[messageIndex];
    
    // 🔥 FIX: 메시지가 없는 경우도 안전하게 처리
    if (!message) return <div style={{ height: 1 }} />;
    
    // 마지막 메시지 여부
    const isLastMessage = messageIndex === messages.length - 1;

    return (
      <MessageItem
        key={message.id}
        message={message}
        previousMessage={messageIndex > 0 ? messages[messageIndex - 1] : undefined}
        nextMessage={messageIndex < messages.length - 1 ? messages[messageIndex + 1] : undefined}
        index={messageIndex}
        totalMessages={messages.length}
        currentModel={currentModel}
        isRegenerating={isRegenerating}
        editingMessageId={editingMessageId}
        editingContent={editingContent}
        copiedMessageId={copiedMessageId}
        onRegenerate={onRegenerate}
        onCopy={onCopy}
        onEditStart={onEditStart}
        onEditCancel={onEditCancel}
        onEditSave={onEditSave}
        setEditingContent={setEditingContent}
        chatId={chatId}
        isLoading={isLoading}
        isWaitingForToolResults={isWaitingForToolResults(message)}
        hasCanvasData={hasCanvasData}
        activePanelMessageId={activePanelMessageId}
        activePanel={activePanel}
        togglePanel={togglePanel}
        user={user}
        handleFollowUpQuestionClick={handleFollowUpQuestionClick}
        globalImageMap={globalImageMap}
        globalVideoMap={globalVideoMap}
        bookmarkedMessageIds={bookmarkedMessageIds}
        handleBookmarkToggle={handleBookmarkToggle}
        isBookmarksLoading={isBookmarksLoading}
        searchTerm={searchTerm}
        contextSummary={contextSummary}
        allMessages={isLastMessage ? messages : undefined} // 마지막 메시지에만 전체 배열 전달 (FollowUpQuestions용)
      />
    );
  }, [
    virtualizedData, 
    // 🚀 FIX: firstItemIndex는 ref에서 읽으므로 의존성에서 제거 (stale closure 방지)
    messages, 
    user, 
    userName, 
    isUserNameLoading, 
    greetingAnimation,
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
    isLoading,
    isWaitingForToolResults,
    hasCanvasData,
    activePanelMessageId,
    activePanel,
    togglePanel,
    handleFollowUpQuestionClick,
    globalImageMap,
    globalVideoMap,
    bookmarkedMessageIds,
    handleBookmarkToggle,
    isBookmarksLoading,
    searchTerm,
    contextSummary
  ]);

  return (
    <div className="thread-container messages-container flex flex-col">
      <div className="grow">
        {/* Virtuoso 가상화 리스트 - Chatflix 레이블 포함 */}
        {/* 🚀 FIX: Bug 1 수정으로 메시지가 로드된 후 렌더링되므로 조건부 렌더링 제거 */}
        <Virtuoso
          ref={virtuosoRef}
          data={virtualizedData}
          itemContent={renderVirtualizedItem}
          // 🚀 SCROLL STABILITY FIX: alignToBottom 제거!
          // alignToBottom은 margin-top: auto를 사용하여 콘텐츠를 하단 정렬함
          // 문제: 아이템 크기 측정 전후로 margin-top이 변경되어 레이아웃 시프트 발생
          // 해결: initialTopMostItemIndex로 마지막 아이템 표시 + 수동 스크롤
          // alignToBottom={true} // 제거됨!
          
          // 🚀 SCROLL STABILITY: 초기 렌더링 시 마지막 아이템 표시 (greeting일 때는 0, 메시지가 있을 때는 마지막)
          initialTopMostItemIndex={messages.length === 0 ? 0 : virtualizedData.length - 1}
          
          // 🚀 INFINITE SCROLL: firstItemIndex로 스크롤 위치 유지
          firstItemIndex={firstItemIndex}
          // 🚀 SCROLL STABILITY: 조건부 followOutput
          // - 재생성 중: 스크롤 안 함 (점프 방지)
          // - 로딩 중: 'auto'로 즉시 스크롤 (smooth는 연속 높이 변경 시 버벅임 유발)
          // - 사용자가 하단에 있을 때만 스크롤
          // - 그 외: 스크롤 안 함 (사용자 스크롤 위치 유지)
          followOutput={(isAtBottom) => {
            // 재생성 중이면 스크롤하지 않음 (메시지 내용 변경 시 점프 방지)
            if (isRegenerating) return false;
            // 사용자가 하단에 없으면 스크롤하지 않음 (위치 유지)
            if (!isAtBottom) return false;
            // 🚀 FIX: 로딩 중일 때는 'auto'로 즉시 스크롤
            // smooth는 연속적인 높이 변경 시 "내려갔다 올라오는" 현상 유발
            // auto는 즉시 위치 조정으로 더 안정적
            return isLoading ? 'auto' : 'smooth';
          }}
          // 🚀 SCROLL FIX: ResizeObserver에서 requestAnimationFrame 건너뛰기
          // 아이템 크기 변경을 즉시 처리하여 스크롤 버벅임 감소
          skipAnimationFrameInResizeObserver={true}
          // 🚀 SCROLL OPTIMIZATION: 기본 아이템 높이 추정 (레이아웃 점프 감소)
          // 미디어 포함 메시지(400px) 고려하여 200으로 증가
          defaultItemHeight={200}
          // 🚀 SCROLL OPTIMIZATION: 뷰포트 밖 프리렌더 영역 확대 (스무스 스크롤)
          increaseViewportBy={{ top: 500, bottom: 500 }}
          // 🚀 STANDARD: 안정적인 아이템 키 생성
          computeItemKey={(index, item) => item?.id || `item-${index}`}
          // 🚀 STANDARD: atBottomThreshold로 하단 판정 기준 설정
          atBottomThreshold={200}
          // 🚀 INFINITE SCROLL: 스크롤이 상단에 도달하면 이전 메시지 로드
          startReached={handleStartReached}
          // 🚀 INFINITE SCROLL: 범위 변경 시 미리 로드 트리거
          rangeChanged={handleRangeChanged}
          components={{
            // 🚀 INSTANT LOAD: Header 로딩 인디케이터 제거
            Footer: BottomSpacer
          }}
          style={{ 
            height: '100vh', 
            width: '100%',
            overflowX: 'hidden'
          }}
          className="virtuoso-messages"
        />
      </div>
    </div>
  )
});
