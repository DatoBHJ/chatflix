'use client'

import { UIMessage as AIMessage } from 'ai'
import { User } from '@supabase/supabase-js'
import React, { useState, useEffect, useCallback, memo, useRef, useMemo } from 'react'
import { Message as MessageComponent } from '@/app/components/Message'
import { getYouTubeLinkAnalysisData, getYouTubeSearchData, getWebSearchResults, getMathCalculationData, getLinkReaderData, getImageGeneratorData, getGeminiImageData, getSeedreamImageData, getQwenImageData, getGoogleSearchData, getTwitterSearchData, getWan25VideoData, getGrokVideoData, getVideoUpscalerData, getImageUpscalerData } from '@/app/hooks/toolFunction';
import { formatMessageGroupTimestamp } from '@/app/lib/messageGroupTimeUtils';
import { createClient } from '@/utils/supabase/client';
import { linkMetaEntryToCardData } from '@/app/lib/linkCardUtils';
import type { LinkCardData, LinkMetaEntry } from '@/app/types/linkPreview';
import { fetchUserName } from '@/app/components/AccountDialog';
import { formatMessageTime } from '@/app/lib/translations/messageTime';
import { X, Trash2 } from 'lucide-react';
import { getAdaptiveGlassStyleBlur, getAdaptiveGlassBackgroundColor } from '@/app/lib/adaptiveGlassStyle';

// Type for context summary
interface ContextSummaryData {
  summary: string;
  summarized_until_message_id: string;
  summarized_until_sequence: number;
  created_at: string;
}

// OPTIMIZATION: 커스텀 비교 함수로 progress annotation만 변경될 때 리렌더링 방지
const areMessageItemPropsEqual = (prevProps: any, nextProps: any) => {
  const prevAnnotationsWithoutProgress = (prevProps.message?.annotations || []).filter(
    (a: any) => a?.type !== 'wan25_video_progress' && a?.type !== 'data-wan25_video_progress' && a?.type !== 'grok_video_progress' && a?.type !== 'data-grok_video_progress' && a?.type !== 'video_upscaler_progress' && a?.type !== 'data-video_upscaler_progress' && a?.type !== 'image_upscaler_progress' && a?.type !== 'data-image_upscaler_progress'
  );
  const nextAnnotationsWithoutProgress = (nextProps.message?.annotations || []).filter(
    (a: any) => a?.type !== 'wan25_video_progress' && a?.type !== 'data-wan25_video_progress' && a?.type !== 'grok_video_progress' && a?.type !== 'data-grok_video_progress' && a?.type !== 'video_upscaler_progress' && a?.type !== 'data-video_upscaler_progress' && a?.type !== 'image_upscaler_progress' && a?.type !== 'data-image_upscaler_progress'
  );
  
  const annotationsEqual = JSON.stringify(prevAnnotationsWithoutProgress) === JSON.stringify(nextAnnotationsWithoutProgress);
  
  const prevPartsWithoutProgress = (prevProps.message?.parts || []).filter(
    (p: any) => p?.type !== 'data-wan25_video_progress' && p?.type !== 'data-grok_video_progress' && p?.type !== 'data-video_upscaler_progress' && p?.type !== 'data-image_upscaler_progress'
  );
  const nextPartsWithoutProgress = (nextProps.message?.parts || []).filter(
    (p: any) => p?.type !== 'data-wan25_video_progress' && p?.type !== 'data-grok_video_progress' && p?.type !== 'data-video_upscaler_progress' && p?.type !== 'data-image_upscaler_progress'
  );
  const partsEqual = JSON.stringify(prevPartsWithoutProgress) === JSON.stringify(nextPartsWithoutProgress);
  
  const messageCoreEqual = 
    prevProps.message?.id === nextProps.message?.id &&
    prevProps.message?.content === nextProps.message?.content &&
    prevProps.message?.role === nextProps.message?.role &&
    JSON.stringify(prevProps.message?.tool_results) === JSON.stringify(nextProps.message?.tool_results) &&
    annotationsEqual &&
    partsEqual;
  
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
    prevProps.bookmarkedMessageIds === nextProps.bookmarkedMessageIds &&
    prevProps.globalImageMap === nextProps.globalImageMap &&
    prevProps.globalUploadedImageMetaMap === nextProps.globalUploadedImageMetaMap &&
    prevProps.globalVideoMap === nextProps.globalVideoMap &&
    prevProps.isMessageSelectionMode === nextProps.isMessageSelectionMode &&
    prevProps.selectedMessageIds === nextProps.selectedMessageIds &&
    prevProps.isDeletingSelectedMessages === nextProps.isDeletingSelectedMessages &&
    prevProps.onEnterMessageSelectionMode === nextProps.onEnterMessageSelectionMode &&
    prevProps.onToggleMessageSelection === nextProps.onToggleMessageSelection &&
    prevProps.onCloseMessageSelectionMode === nextProps.onCloseMessageSelectionMode &&
    prevProps.onDeleteSelectedMessages === nextProps.onDeleteSelectedMessages;
  
  return messageCoreEqual && otherPropsEqual;
};

// Performance: MessageItem component to isolate expensive calculations and re-renders
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
  globalUploadedImageMetaMap,
  globalVideoMap,
  bookmarkedMessageIds,
  handleBookmarkToggle,
  isBookmarksLoading,
  searchTerm,
  contextSummary,
  allMessages,
  isMessageSelectionMode,
  selectedMessageIds,
  onEnterMessageSelectionMode,
  onToggleMessageSelection,
  onCloseMessageSelectionMode,
  onDeleteSelectedMessages,
  isDeletingSelectedMessages
}: any) {
  const messageKey = useMemo(() => {
    const annotationsWithoutProgress = (message.annotations || []).filter(
      (a: any) => a?.type !== 'wan25_video_progress' && a?.type !== 'data-wan25_video_progress' && a?.type !== 'grok_video_progress' && a?.type !== 'data-grok_video_progress' && a?.type !== 'video_upscaler_progress' && a?.type !== 'data-video_upscaler_progress'
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
    JSON.stringify((message.annotations || []).filter(
      (a: any) => a?.type !== 'wan25_video_progress' && a?.type !== 'data-wan25_video_progress' && a?.type !== 'grok_video_progress' && a?.type !== 'data-grok_video_progress' && a?.type !== 'video_upscaler_progress' && a?.type !== 'data-video_upscaler_progress'
    ))
  ]);

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
      wan25VideoData: getWan25VideoData(message),
      grokVideoData: getGrokVideoData(message),
      videoUpscalerData: getVideoUpscalerData(message),
      imageUpscalerData: getImageUpscalerData(message)
    };
  }, [messageKey, message]);

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
    wan25VideoData,
    grokVideoData,
    videoUpscalerData,
    imageUpscalerData
  } = toolData;

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
      }, {}) || {}),
      ...(imageUpscalerData?.generatedImages?.reduce((acc: any, image: any, index: number) => {
        if (image.path) {
          const fileName = image.path.split('/').pop();
          const imageKey = fileName.replace(/\.[^/.]+$/, '');
          acc[imageKey] = image.imageUrl;
        }
        return acc;
      }, {}) || {})
    };
  }, [globalImageMap, webSearchData?.imageMap, googleSearchData?.imageMap, twitterSearchData?.imageMap, imageGeneratorData?.generatedImages, geminiImageData?.generatedImages, seedreamImageData?.generatedImages, qwenImageData?.generatedImages, imageUpscalerData?.generatedImages]);

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
      }, {}) || {}),
      ...(grokVideoData?.generatedVideos?.reduce((acc: any, video: any) => {
        if (video.path) {
          const fileName = video.path.split('/').pop();
          const videoKey = fileName.replace(/\.[^/.]+$/, '');
          acc[videoKey] = video.videoUrl;
        }
        return acc;
      }, {}) || {}),
      ...(videoUpscalerData?.generatedVideos?.reduce((acc: any, video: any) => {
        if (video.path) {
          const fileName = video.path.split('/').pop();
          const videoKey = fileName.replace(/\.[^/.]+$/, '');
          acc[videoKey] = video.videoUrl;
        }
        return acc;
      }, {}) || {})
    };
  }, [globalVideoMap, wan25VideoData?.generatedVideos, grokVideoData?.generatedVideos, videoUpscalerData?.generatedVideos]);

  const promptMap = useMemo(() => {
    const map: Record<string, string> = {};
    
    geminiImageData?.generatedImages?.forEach((image: any) => {
      if (image.imageUrl && image.prompt) {
        map[image.imageUrl] = image.prompt;
      }
    });
    
    seedreamImageData?.generatedImages?.forEach((image: any) => {
      if (image.imageUrl && image.prompt) {
        map[image.imageUrl] = image.prompt;
      }
    });
    
    qwenImageData?.generatedImages?.forEach((image: any) => {
      if (image.imageUrl && image.prompt) {
        map[image.imageUrl] = image.prompt;
      }
    });
    
    imageGeneratorData?.generatedImages?.forEach((image: any) => {
      if (image.imageUrl && image.prompt) {
        map[image.imageUrl] = image.prompt;
      }
    });

    wan25VideoData?.generatedVideos?.forEach((video: any) => {
      if (video.videoUrl && video.prompt) {
        map[video.videoUrl] = video.prompt;
      }
    });

    grokVideoData?.generatedVideos?.forEach((video: any) => {
      if (video.videoUrl && video.prompt) {
        map[video.videoUrl] = video.prompt;
      }
    });
    videoUpscalerData?.generatedVideos?.forEach((video: any) => {
      if (video.videoUrl && video.prompt) {
        map[video.videoUrl] = video.prompt;
      }
    });
    imageUpscalerData?.generatedImages?.forEach((image: any) => {
      if (image.imageUrl && image.prompt) {
        map[image.imageUrl] = image.prompt;
      }
    });

    return map;
  }, [geminiImageData?.generatedImages, seedreamImageData?.generatedImages, qwenImageData?.generatedImages, imageGeneratorData?.generatedImages, wan25VideoData?.generatedVideos, grokVideoData?.generatedVideos, videoUpscalerData?.generatedVideos, imageUpscalerData?.generatedImages]);

  const sourceImageMap = useMemo(() => {
    const map: Record<string, string> = {};
    
    wan25VideoData?.generatedVideos?.forEach((video: any) => {
      if (video.videoUrl && video.sourceImageUrl) {
        map[video.videoUrl] = video.sourceImageUrl;
      }
    });

    grokVideoData?.generatedVideos?.forEach((video: any) => {
      if (video.videoUrl && video.sourceImageUrl) {
        map[video.videoUrl] = video.sourceImageUrl;
      }
    });

    geminiImageData?.generatedImages?.forEach((image: any) => {
      if (image.imageUrl) {
        const originalUrl = image.originalImageUrls && Array.isArray(image.originalImageUrls) && image.originalImageUrls.length > 0
          ? image.originalImageUrls[0]
          : image.originalImageUrl;
        if (originalUrl) {
          map[image.imageUrl] = originalUrl;
        }
      }
    });

    seedreamImageData?.generatedImages?.forEach((image: any) => {
      if (image.imageUrl && image.originalImageUrl) {
        map[image.imageUrl] = image.originalImageUrl;
      }
    });

    qwenImageData?.generatedImages?.forEach((image: any) => {
      if (image.imageUrl && image.originalImageUrl) {
        map[image.imageUrl] = image.originalImageUrl;
      }
    });
    imageUpscalerData?.generatedImages?.forEach((image: any) => {
      if (image.imageUrl && image.sourceImageUrl) {
        map[image.imageUrl] = image.sourceImageUrl;
      }
    });

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
  }, [wan25VideoData?.generatedVideos, grokVideoData?.generatedVideos, geminiImageData?.generatedImages, seedreamImageData?.generatedImages, qwenImageData?.generatedImages, imageUpscalerData?.generatedImages, (message as any).parts]);

  // url -> { width, height } for layout stability (reserve exact space before media load)
  const mediaDimensionsMap = useMemo(() => {
    const map: Record<string, { width: number; height: number }> = {};
    const parseSize = (size: string): { width: number; height: number } | null => {
      if (!size || typeof size !== 'string') return null;
      const parts = size.split(/[x*×]/i).map((n) => parseInt(n.trim(), 10));
      if (parts.length >= 2 && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1]) && parts[0] > 0 && parts[1] > 0) {
        return { width: parts[0], height: parts[1] };
      }
      return null;
    };
    const parseAspectRatio = (ar: string): { width: number; height: number } | null => {
      if (!ar || typeof ar !== 'string') return null;
      const parts = ar.split(/[/:]/).map((n) => parseInt(n.trim(), 10));
      if (parts.length >= 2 && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1]) && parts[0] > 0 && parts[1] > 0) {
        return { width: parts[0], height: parts[1] };
      }
      return null;
    };

    (message as any).experimental_attachments?.forEach((att: any) => {
      if (!att?.url) return;
      const w = att.metadata?.width;
      const h = att.metadata?.height;
      if (typeof w === 'number' && typeof h === 'number' && w > 0 && h > 0) {
        map[att.url] = { width: w, height: h };
      }
    });

    geminiImageData?.generatedImages?.forEach((image: any) => {
      if (!image.imageUrl || map[image.imageUrl]) return;
      const dims = (image.metadata && typeof image.metadata.width === 'number' && typeof image.metadata.height === 'number')
        ? { width: image.metadata.width, height: image.metadata.height }
        : (image.size && parseSize(image.size)) || (image.aspectRatio && parseAspectRatio(image.aspectRatio));
      if (dims) map[image.imageUrl] = dims;
    });
    seedreamImageData?.generatedImages?.forEach((image: any) => {
      if (!image.imageUrl || map[image.imageUrl]) return;
      const dims = (image.width != null && image.height != null) ? { width: image.width, height: image.height }
        : (image.size && parseSize(image.size)) || (image.aspectRatio && parseAspectRatio(image.aspectRatio));
      if (dims) map[image.imageUrl] = dims;
    });
    qwenImageData?.generatedImages?.forEach((image: any) => {
      if (!image.imageUrl || map[image.imageUrl]) return;
      const dims = (image.width != null && image.height != null) ? { width: image.width, height: image.height }
        : (image.size && parseSize(image.size)) || (image.aspectRatio && parseAspectRatio(image.aspectRatio));
      if (dims) map[image.imageUrl] = dims;
    });
    imageGeneratorData?.generatedImages?.forEach((image: any) => {
      if (!image.imageUrl || map[image.imageUrl]) return;
      const dims = (image.width != null && image.height != null) ? { width: image.width, height: image.height }
        : (image.size && parseSize(image.size)) || (image.aspectRatio && parseAspectRatio(image.aspectRatio));
      if (dims) map[image.imageUrl] = dims;
    });
    wan25VideoData?.generatedVideos?.forEach((video: any) => {
      if (!video.videoUrl || map[video.videoUrl]) return;
      const dims = (video.width != null && video.height != null) ? { width: video.width, height: video.height }
        : (video.size && parseSize(video.size)) || (video.aspectRatio && parseAspectRatio(video.aspectRatio))
        || (video.resolution && parseSize(video.resolution));
      if (dims) map[video.videoUrl] = dims;
    });

    return map;
  }, [(message as any).experimental_attachments, geminiImageData?.generatedImages, seedreamImageData?.generatedImages, qwenImageData?.generatedImages, imageGeneratorData?.generatedImages, wan25VideoData?.generatedVideos]);

  const maps = useMemo(() => {
    return { 
      imageMap: combinedImageMap, 
      uploadedImageMetaMap: globalUploadedImageMetaMap ?? {},
      linkMap, 
      thumbnailMap, 
      titleMap, 
      linkPreviewData, 
      videoMap: combinedVideoMap, 
      promptMap,
      sourceImageMap,
      mediaDimensionsMap
    };
  }, [combinedImageMap, globalUploadedImageMetaMap, linkMap, thumbnailMap, titleMap, linkPreviewData, combinedVideoMap, promptMap, sourceImageMap, mediaDimensionsMap]);

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
      <div 
        className={`${spacingClass} thread-content transform-gpu ${(isLastMessage || (isLoading && message.role === 'assistant' && isLastMessage)) ? 'message-always-visible' : ''}`}
        data-scroll-anchor={isLastMessage ? "true" : "false"}
        data-message-id={message.id}
        style={{ contain: 'layout style', minHeight: '60px' }}
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
            grokVideoData={grokVideoData}
            videoUpscalerData={videoUpscalerData}
            imageUpscalerData={imageUpscalerData}
            user={user}
            handleFollowUpQuestionClick={handleFollowUpQuestionClick}
            allMessages={allMessages}
            isGlobalLoading={isLoading}
            imageMap={maps.imageMap}
            uploadedImageMetaMap={maps.uploadedImageMetaMap}
            videoMap={maps.videoMap}
            linkMap={maps.linkMap}
            thumbnailMap={maps.thumbnailMap}
            titleMap={maps.titleMap}
            linkPreviewData={maps.linkPreviewData}
            promptMap={maps.promptMap}
            sourceImageMap={maps.sourceImageMap}
            mediaDimensionsMap={maps.mediaDimensionsMap}
            isBookmarked={bookmarkedMessageIds.has(message.id)}
            onBookmarkToggle={handleBookmarkToggle}
            isBookmarksLoading={isBookmarksLoading}
            searchTerm={searchTerm}
            isMessageSelectionMode={isMessageSelectionMode}
            isMessageSelected={selectedMessageIds.has(message.id)}
            onEnterMessageSelectionMode={onEnterMessageSelectionMode}
            onToggleMessageSelection={onToggleMessageSelection}
          />
        </div>
      </div>
      {isSummaryBoundary && (
        <div className="thread-content" style={{ contain: 'layout style' }}>
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

interface SimpleMessagesProps {
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
  searchTerm?: string | null
  onLoadMore?: () => void
  hasMore?: boolean
  contextSummary?: ContextSummaryData | null
  isMessageSelectionMode?: boolean
  selectedMessageIds?: Set<string>
  onEnterMessageSelectionMode?: (messageId: string) => void
  onToggleMessageSelection?: (messageId: string) => void
  onCloseMessageSelectionMode?: () => void
  onDeleteSelectedMessages?: () => Promise<void> | void
  isDeletingSelectedMessages?: boolean
}

export const SimpleMessages = memo(function SimpleMessages({
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
  searchTerm,
  onLoadMore,
  hasMore = false,
  contextSummary = null,
  isMessageSelectionMode = false,
  selectedMessageIds = new Set<string>(),
  onEnterMessageSelectionMode,
  onToggleMessageSelection,
  onCloseMessageSelectionMode,
  onDeleteSelectedMessages,
  isDeletingSelectedMessages = false
}: SimpleMessagesProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollSentinelRef = useRef<HTMLDivElement>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isScrollingRef = useRef(false);
  const hasScrolledToBottomRef = useRef(false);
  const prevMessagesLengthRef = useRef(messages.length);
  const scrollMaintainRef = useRef<NodeJS.Timeout | null>(null);
  const scrollPositionBeforeLoadRef = useRef<{ scrollTop: number; scrollHeight: number } | null>(null);
  const isInitialLoadCompleteRef = useRef(false);
  const userScrolledRef = useRef(false);
  const userScrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastScrollTopRef = useRef(0);
  const glassFloatingButtonStyle = useMemo(() => ({
    ...getAdaptiveGlassStyleBlur(),
    ...getAdaptiveGlassBackgroundColor(),
    border: '1px solid rgba(255, 255, 255, 0.14)',
  }), []);

  const globalImageMap = useMemo(() => {
    const imageMap: Record<string, string> = {};
    let uploadedImageIndex = 1;
    let generatedImageIndex = 1;
    const seenPaths = new Set<string>();
    
    const extractFilenameId = (path: string): string | null => {
      if (!path) return null;
      const filename = path.split('/').pop();
      if (!filename) return null;
      return filename.replace(/\.[^.]+$/, '');
    };
    
    for (const message of messages) {
      let foundInParts = false;
      const partsUrls: string[] = [];
      const expUrls: string[] = [];
      if (message.parts && Array.isArray(message.parts)) {
        for (const part of message.parts) {
          if (part.type === 'file' && part.mediaType?.startsWith('image/') && (part.url || part.data)) {
            partsUrls.push(part.url || part.data);
          } else if (part.type === 'image' && (part.image || part.url)) {
            partsUrls.push(part.image || part.url);
          }
        }
      }
      if (message.experimental_attachments && Array.isArray(message.experimental_attachments)) {
        for (const attachment of message.experimental_attachments) {
          if (attachment.contentType?.startsWith('image/') || attachment.fileType === 'image') {
            expUrls.push(attachment.url);
          }
        }
      }
      const uploadUrls = expUrls.length > partsUrls.length ? expUrls : partsUrls;
      for (const url of uploadUrls) {
        imageMap[`uploaded_image_${uploadedImageIndex++}`] = url;
      }
      
      if (message.parts && Array.isArray(message.parts)) {
        for (const part of message.parts) {
          const imageToolNames = ['gemini_image_tool', 'seedream_image_tool', 'qwen_image_edit'];
          const isToolResult = imageToolNames.some(toolName => 
            part.type === `tool-${toolName}` ||
            (part.type === 'tool-result' && part.toolName === toolName)
          );
          
          if (isToolResult) {
            const result = part.output?.value || part.output || part.result;
            if (result && result.success !== false) {
              const images = Array.isArray(result) ? result : (result.images || (result.imageUrl ? [result] : []));
              for (const img of images) {
                if (img.imageUrl) {
                  const dedupKey = img.path || img.imageUrl;
                  if (!seenPaths.has(dedupKey)) {
                    seenPaths.add(dedupKey);
                    imageMap[`generated_image_${generatedImageIndex++}`] = img.imageUrl;
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
          
          if (part.type === 'data-seedream_image_complete' || part.type === 'data-gemini_image_complete' || part.type === 'data-qwen_image_complete') {
            const data = part.data;
            if (data?.imageUrl) {
              const dedupKey = data.path || data.imageUrl;
              if (!seenPaths.has(dedupKey)) {
                seenPaths.add(dedupKey);
                imageMap[`generated_image_${generatedImageIndex++}`] = data.imageUrl;
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
      
      if (!foundInParts) {
        if (message.tool_results) {
          const results = message.tool_results.geminiImageResults || message.tool_results.seedreamImageResults || message.tool_results.qwenImageResults;
          if (Array.isArray(results)) {
            for (const img of results) {
              if (img.imageUrl) {
                imageMap[`generated_image_${generatedImageIndex++}`] = img.imageUrl;
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

  const globalUploadedImageMetaMap = useMemo(() => {
    const metaMap: Record<string, { url: string; filename: string }> = {};
    let uploadedImageIndex = 1;
    for (const message of messages) {
      const partsUrls: string[] = [];
      const partsFilenames: string[] = [];
      const expUrls: string[] = [];
      const expFilenames: string[] = [];
      if (message.parts && Array.isArray(message.parts)) {
        for (const part of message.parts) {
          if (part.type === 'file' && part.mediaType?.startsWith('image/') && (part.url || part.data)) {
            partsUrls.push(part.url || part.data);
            partsFilenames.push(part.filename || part.name || 'image.jpg');
          } else if (part.type === 'image' && (part.image || part.url)) {
            partsUrls.push(part.image || part.url);
            partsFilenames.push(part.filename || part.name || 'image.jpg');
          }
        }
      }
      if (message.experimental_attachments && Array.isArray(message.experimental_attachments)) {
        for (const attachment of message.experimental_attachments) {
          if (attachment.contentType?.startsWith('image/') || attachment.fileType === 'image') {
            expUrls.push(attachment.url);
            expFilenames.push(attachment.name || 'image.jpg');
          }
        }
      }
      const useExp = expUrls.length > partsUrls.length;
      const uploadUrls = useExp ? expUrls : partsUrls;
      const uploadFilenames = useExp ? expFilenames : partsFilenames;
      for (let i = 0; i < uploadUrls.length; i++) {
        metaMap[`uploaded_image_${uploadedImageIndex++}`] = {
          url: uploadUrls[i],
          filename: uploadFilenames[i] ?? 'image.jpg',
        };
      }
    }
    return metaMap;
  }, [messages]);

  const extractFilenameId = useCallback((path: string): string | null => {
    if (!path) return null;
    const filename = path.split('/').pop();
    if (!filename) return null;
    return filename.replace(/\.[^.]+$/, '');
  }, []);

  const messagePartsKeys = useMemo(() => {
    return messages.map(msg => {
      if (!msg.parts || !Array.isArray(msg.parts)) return '';
      const videoParts = msg.parts.filter(
        (p: any) => p?.type?.startsWith('tool-wan25_') || p?.type === 'data-wan25_video_complete' || p?.type?.startsWith('tool-grok_') || p?.type === 'data-grok_video_complete' || p?.type?.startsWith('tool-video_upscaler') || p?.type === 'data-video_upscaler_complete'
      );
      return JSON.stringify(videoParts);
    });
  }, [messages]);

  const globalVideoMap = useMemo(() => {
    const videoMap: Record<string, { url: string; size?: string } | string> = {};
    let generatedVideoIndex = 1;
    const seenPaths = new Set<string>();
    
    for (const message of messages) {
      let foundInParts = false;
      
      if (message.parts && Array.isArray(message.parts)) {
        for (const part of message.parts) {
          if ((part.type?.startsWith('tool-wan25_') || part.type?.startsWith('tool-grok_') || part.type?.startsWith('tool-video_upscaler')) && part.output?.videos && Array.isArray(part.output.videos)) {
            const result = part.output;
            if (result && result.success !== false) {
              for (const vid of result.videos) {
                if (vid.videoUrl) {
                  const dedupKey = vid.path || vid.videoUrl;
                  if (!seenPaths.has(dedupKey)) {
                    seenPaths.add(dedupKey);
                    const videoData = vid.size ? { url: vid.videoUrl, size: vid.size } : vid.videoUrl;
                    videoMap[`generated_video_${generatedVideoIndex++}`] = videoData;
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
          
          if ((part.type === 'data-wan25_video_complete' || part.type === 'data-grok_video_complete' || part.type === 'data-video_upscaler_complete') && part.data?.videoUrl) {
            const data = part.data;
            const dedupKey = data.path || data.videoUrl;
            if (!seenPaths.has(dedupKey)) {
              seenPaths.add(dedupKey);
              const videoData = data.size ? { url: data.videoUrl, size: data.size } : data.videoUrl;
              videoMap[`generated_video_${generatedVideoIndex++}`] = videoData;
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
      
      if (!foundInParts && (message.tool_results?.wan25VideoResults || message.tool_results?.grokVideoResults || message.tool_results?.videoUpscalerResults)) {
        const wan25 = message.tool_results?.wan25VideoResults;
        const grok = message.tool_results?.grokVideoResults;
        const upscaled = message.tool_results?.videoUpscalerResults;
        const list = [...(Array.isArray(wan25) ? wan25 : []), ...(Array.isArray(grok) ? grok : []), ...(Array.isArray(upscaled) ? upscaled : [])];
        for (const vid of list) {
          if (vid.videoUrl) {
            const dedupKey = vid.path || vid.videoUrl;
            if (!seenPaths.has(dedupKey)) {
              seenPaths.add(dedupKey);
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
  }, [messagePartsKeys, extractFilenameId]);

  const [bookmarkedMessageIds, setBookmarkedMessageIds] = useState<Set<string>>(new Set());
  const [isBookmarksLoading, setIsBookmarksLoading] = useState(false);
  const [userName, setUserName] = useState<string>('');
  const [isUserNameLoading, setIsUserNameLoading] = useState(true);
  const [greetingAnimation, setGreetingAnimation] = useState({
    header: false,
    receive: false,
    send: false
  });

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

  useEffect(() => {
    fetchBookmarks(messages);
  }, [user, chatId, messages.length, fetchBookmarks]);

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

  const handleBookmarkToggle = useCallback(async (messageId: string, shouldBookmark: boolean) => {
    if (!user || !chatId || !messageId) return;
    
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
        let messageContent = message.content;
        if (!messageContent && message.parts) {
          const textParts = message.parts.filter((p: any) => p.type === 'text');
          messageContent = textParts.map((p: any) => p.text).join(' ');
        }
        if (!messageContent || messageContent.trim() === '') {
          messageContent = '[Empty message]';
        }
        
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
          setBookmarkedMessageIds(prev => {
            const newSet = new Set(prev);
            newSet.delete(messageId);
            return newSet;
          });
          throw error;
        }
      } else {
        const { error } = await supabase
          .from('message_bookmarks')
          .delete()
          .eq('message_id', messageId)
          .eq('user_id', user.id)
          .eq('chat_session_id', chatId);
          
        if (error) {
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

  const allMessagesRef = useRef(messages);
  if (allMessagesRef.current !== messages) allMessagesRef.current = messages;

  const renderMessageItem = useCallback((item: any, index: number) => {
    if (item.type === 'greeting') {
      if (isUserNameLoading) {
        return (
          <div key="greeting-loading" className="thread-content" style={{ minHeight: '200px' }}>
          </div>
        );
      }
      const greetingText = user ? `Hey ${userName}!` : 'Hey there';
      return (
        <div key="greeting" className="thread-content">
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

    if (item.type === 'chatflix-label') {
      const firstMessage = messages[0];
      const displayDate = firstMessage ? (firstMessage.createdAt || new Date()) : new Date();
      return (
        <div key="chatflix-label" className="thread-content">
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

    const messageIndex = index - 1;
    const message = messages[messageIndex];
    if (!message) return null;

    const isLastMessage = messageIndex === messages.length - 1;
    const allMessagesForItem = isLastMessage ? allMessagesRef.current : undefined;

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
        isWaitingForToolResults={isWaitingForToolResults}
        hasCanvasData={hasCanvasData}
        activePanelMessageId={activePanelMessageId}
        activePanel={activePanel}
        togglePanel={togglePanel}
        user={user}
        handleFollowUpQuestionClick={handleFollowUpQuestionClick}
        globalImageMap={globalImageMap}
        globalUploadedImageMetaMap={globalUploadedImageMetaMap}
        globalVideoMap={globalVideoMap}
        bookmarkedMessageIds={bookmarkedMessageIds}
        handleBookmarkToggle={handleBookmarkToggle}
        isBookmarksLoading={isBookmarksLoading}
        searchTerm={searchTerm}
        contextSummary={contextSummary}
        allMessages={allMessagesForItem}
        isMessageSelectionMode={isMessageSelectionMode}
        selectedMessageIds={selectedMessageIds}
        onEnterMessageSelectionMode={onEnterMessageSelectionMode}
        onToggleMessageSelection={onToggleMessageSelection}
        onCloseMessageSelectionMode={onCloseMessageSelectionMode}
        onDeleteSelectedMessages={onDeleteSelectedMessages}
        isDeletingSelectedMessages={isDeletingSelectedMessages}
      />
    );
  }, [
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
    globalUploadedImageMetaMap,
    globalVideoMap,
    bookmarkedMessageIds,
    handleBookmarkToggle,
    isBookmarksLoading,
    searchTerm,
    contextSummary
    ,
    isMessageSelectionMode,
    selectedMessageIds,
    onEnterMessageSelectionMode,
    onToggleMessageSelection,
    isDeletingSelectedMessages,
    onCloseMessageSelectionMode,
    onDeleteSelectedMessages
  ]);

  const messageData = useMemo(() => {
    if (messages.length === 0) {
      return [{ id: 'greeting', type: 'greeting' }];
    }
    // 중복 제거: 메시지 ID를 기준으로 중복 제거
    const seenIds = new Set<string>();
    const uniqueMessages = messages.filter(msg => {
      if (seenIds.has(msg.id)) {
        return false;
      }
      seenIds.add(msg.id);
      return true;
    });
    
    return [
      { id: 'chatflix-label', type: 'chatflix-label' },
      ...uniqueMessages
    ];
  }, [messages]);

  const handleLoadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore || !onLoadMore) return;
    
    // 현재 스크롤 위치와 높이 저장 (DOM 업데이트 직전)
    if (containerRef.current) {
      scrollPositionBeforeLoadRef.current = {
        scrollTop: containerRef.current.scrollTop,
        scrollHeight: containerRef.current.scrollHeight
      };
    }
    
    setIsLoadingMore(true);
    try {
      await onLoadMore();
    } catch (error) {
      console.error('Error loading more messages:', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, onLoadMore]);

  // 초기 스크롤 위치 설정 - 하단부터 표시
  useEffect(() => {
    if (!containerRef.current || hasScrolledToBottomRef.current) return;
    
    const scrollToBottom = () => {
      if (containerRef.current) {
        containerRef.current.scrollTop = containerRef.current.scrollHeight;
        hasScrolledToBottomRef.current = true;
        
        // 초기 스크롤 완료 후 약간의 지연을 두고 무한 스크롤 활성화
        setTimeout(() => {
          isInitialLoadCompleteRef.current = true;
        }, 500);
      }
    };
    
    // DOM 렌더링 완료 대기
    requestAnimationFrame(() => {
      requestAnimationFrame(scrollToBottom);
    });
  }, [messageData.length]);

  // 새 메시지 추가 시 하단 스크롤 (append만)
  useEffect(() => {
    if (!containerRef.current) return;
    
    const prevLength = prevMessagesLengthRef.current;
    const currentLength = messages.length;
    
    // 메시지가 추가된 경우
    if (currentLength > prevLength && prevLength > 0) {
      // prepend인지 append인지 구분
      // prepend: 이전 메시지 로드 (diff가 크고, scrollPositionBeforeLoadRef가 설정됨)
      // append: 새 메시지 추가 (diff가 1~2이고, scrollPositionBeforeLoadRef가 없음)
      const diff = currentLength - prevLength;
      const isPrepend = scrollPositionBeforeLoadRef.current !== null || diff > 2;
      
      // append인 경우에만 하단으로 스크롤
      if (!isPrepend && !userScrolledRef.current) {
        // 사용자가 하단에 있을 때만 하단으로 스크롤
        const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
        const isAtBottom = scrollTop + clientHeight >= scrollHeight - 200; // 임계값 증가
        
        if (isAtBottom) {
          requestAnimationFrame(() => {
            if (containerRef.current && !userScrolledRef.current) {
              containerRef.current.scrollTop = containerRef.current.scrollHeight;
            }
          });
        }
      }
    }
    
    prevMessagesLengthRef.current = currentLength;
  }, [messages.length]);

  // 이전 메시지 로드 시 스크롤 위치 유지 및 연속 로드 체크
  useEffect(() => {
    if (scrollPositionBeforeLoadRef.current && !isLoadingMore) {
      const { scrollTop: oldScrollTop, scrollHeight: oldScrollHeight } = scrollPositionBeforeLoadRef.current;
      
      // DOM 업데이트 완료 대기
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (containerRef.current) {
            const newScrollHeight = containerRef.current.scrollHeight;
            const heightDiff = newScrollHeight - oldScrollHeight;
            
            // 정확한 스크롤 위치 복원
            containerRef.current.scrollTop = oldScrollTop + heightDiff;
            scrollPositionBeforeLoadRef.current = null;
            
            // 로딩 완료 후 즉시 다음 로드 체크 (연속 로드)
            if (hasMore && onLoadMore && isInitialLoadCompleteRef.current) {
              setTimeout(() => {
                if (containerRef.current && hasMore && !isLoadingMore) {
                  const scrollTop = containerRef.current.scrollTop;
                  if (scrollTop <= 1500) {
                    handleLoadMore();
                  }
                }
              }, 50);
            }
          }
        });
      });
    }
  }, [messages.length, isLoadingMore, hasMore, onLoadMore, handleLoadMore]);

  // 스트리밍 중 하단 유지
  useEffect(() => {
    if (!containerRef.current || !isLoading || isRegenerating || userScrolledRef.current) {
      if (scrollMaintainRef.current) {
        clearInterval(scrollMaintainRef.current);
        scrollMaintainRef.current = null;
      }
      return;
    }
    
    const maintainScroll = () => {
      if (!containerRef.current || userScrolledRef.current) return;
      
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 200; // 임계값 증가
      
      if (isAtBottom) {
        containerRef.current.scrollTop = scrollHeight;
      }
    };
    
    // 50ms마다 스크롤 유지 (더 부드럽게)
    scrollMaintainRef.current = setInterval(() => {
      requestAnimationFrame(maintainScroll);
    }, 50); // 100 → 50
    
    return () => {
      if (scrollMaintainRef.current) {
        clearInterval(scrollMaintainRef.current);
        scrollMaintainRef.current = null;
      }
    };
  }, [isLoading, isRegenerating]);

  useEffect(() => {
    if (!scrollSentinelRef.current || !onLoadMore || !hasMore || !containerRef.current) return;
    
    // 초기 로드 완료 전에는 무한 스크롤 비활성화
    if (!isInitialLoadCompleteRef.current) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore) {
          // 로딩 중이어도 다음 로드를 미리 시작할 수 있도록 (연속 로드)
          if (isLoadingMore) {
            setTimeout(() => {
              if (hasMore && !isLoadingMore && containerRef.current) {
                const scrollTop = containerRef.current.scrollTop;
                if (scrollTop <= 1500) {
                  handleLoadMore();
                }
              }
            }, 100);
          } else {
            handleLoadMore();
          }
        }
      },
      { 
        root: containerRef.current,
        rootMargin: '2000px 0px 0px 0px', // 상단에만 2000px 마진 - 매우 일찍 로드
        threshold: 0
      }
    );
    
    observer.observe(scrollSentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, onLoadMore, handleLoadMore]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    if (!containerRef.current) return;
    
    if (behavior === 'smooth') {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    } else {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, []);

  const checkIfAtBottom = useCallback(() => {
    if (!containerRef.current) return false;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    return scrollTop + clientHeight >= scrollHeight - 200; // 100 → 200 (하단 근처 판정 확대)
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    
    const container = containerRef.current;
    let rafId: number | null = null;
    let lastScrollTime = 0;
    const SCROLL_THROTTLE_MS = 100;
    let lastLoadCheckTime = 0;
    const LOAD_CHECK_THROTTLE_MS = 10; // throttle을 10ms로 줄여 매우 빠르게 반응

    // 초기 스크롤 위치 저장
    lastScrollTopRef.current = container.scrollTop;

    const handleScroll = () => {
      const now = Date.now();
      if (now - lastScrollTime < SCROLL_THROTTLE_MS) return;
      lastScrollTime = now;
      
      // 사용자 스크롤 감지
      const currentScrollTop = container.scrollTop;
      const scrollDelta = Math.abs(currentScrollTop - lastScrollTopRef.current);
      
      if (scrollDelta > 5) { // 5px 이상 움직이면 사용자 스크롤로 간주
        userScrolledRef.current = true;
        
        // 1초 후 자동 스크롤 재활성화
        if (userScrollTimeoutRef.current) {
          clearTimeout(userScrollTimeoutRef.current);
        }
        userScrollTimeoutRef.current = setTimeout(() => {
          userScrolledRef.current = false;
        }, 1000);
      }
      
      lastScrollTopRef.current = currentScrollTop;
      
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        isScrollingRef.current = container.scrollTop + container.clientHeight < container.scrollHeight - 50;
        rafId = null;
      });

      // 상단 근처에서 미리 로드 체크 (스크롤 이벤트 기반)
      if (isInitialLoadCompleteRef.current && hasMore && onLoadMore) {
        const checkTime = Date.now();
        if (checkTime - lastLoadCheckTime < LOAD_CHECK_THROTTLE_MS) return;
        lastLoadCheckTime = checkTime;

        const scrollTop = container.scrollTop;
        // 상단에서 1500px 이내에 있으면 미리 로드 (매우 일찍 로드)
        // 로딩 중이어도 다음 로드를 미리 시작할 수 있도록 (연속 로드)
        if (scrollTop <= 1500) {
          // 로딩 중이면 약간의 지연 후 다음 로드 시작
          if (isLoadingMore) {
            setTimeout(() => {
              if (hasMore && !isLoadingMore && container.scrollTop <= 1500) {
                handleLoadMore();
              }
            }, 100);
          } else {
            handleLoadMore();
          }
        }
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (userScrollTimeoutRef.current) clearTimeout(userScrollTimeoutRef.current);
    };
  }, [hasMore, isLoadingMore, onLoadMore, handleLoadMore]);


  return (
    <div className="thread-container messages-container flex flex-col">
      <div 
        ref={containerRef}
        className="grow messages-scroll-container"
        style={{ 
          height: '100vh', 
          overflowY: 'auto',
          overflowX: 'hidden'
        }}
      >
        {hasMore && (
          <div 
            ref={scrollSentinelRef} 
            style={{ height: '1px', width: '100%', position: 'relative' }}
            aria-hidden="true"
          />
        )}
        {messageData.map((item, index) => {
          const rendered = renderMessageItem(item, index);
          if (!rendered) return null;
          // React element를 복제하여 고유한 key 설정
          return React.cloneElement(rendered, { key: item.id || `item-${index}` });
        })}
        <div 
          ref={messagesEndRef} 
          className="h-[200px] min-h-[200px] md:h-[300px] md:min-h-[300px]"
        />
      </div>
      {isMessageSelectionMode && (
        <>
          <button
            type="button"
            onClick={onCloseMessageSelectionMode}
            className="message-selection-close-button fixed top-5 z-100001 flex h-12 w-12 items-center justify-center rounded-full"
            style={{
              ...glassFloatingButtonStyle,
              color: 'var(--foreground)'
            }}
            aria-label="Close message selection"
          >
            <X size={20} />
          </button>
          <button
            type="button"
            onClick={onDeleteSelectedMessages}
            disabled={selectedMessageIds.size === 0 || isDeletingSelectedMessages}
            className="message-selection-delete-button fixed bottom-7 z-100001 flex min-h-12 items-center justify-center gap-2 rounded-full px-4"
            style={{
              ...glassFloatingButtonStyle,
              color: selectedMessageIds.size === 0 ? 'var(--foreground)' : '#ff3b30',
              opacity: (isDeletingSelectedMessages || selectedMessageIds.size === 0) ? 0.65 : 1
            }}
          >
            <Trash2 size={18} />
            <span className="text-sm font-medium">
              {isDeletingSelectedMessages ? 'Deleting...' : `Delete${selectedMessageIds.size > 0 ? ` (${selectedMessageIds.size})` : ''}`}
            </span>
          </button>
        </>
      )}
    </div>
  );
});
