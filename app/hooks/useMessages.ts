import { useState, useCallback } from 'react'
import { UIMessage } from 'ai'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { MODEL_CONFIGS } from '@/lib/models/config'
import { uploadFile } from '@/app/chat/[id]/utils'
import { ensureFreshAttachmentUrls } from '@/app/utils/attachmentUrlHelpers';
import { Attachment } from '@/lib/types';
import { getWebSearchResults, getGoogleSearchData } from './toolFunction'
import { trimMessagesToByteLimit } from '@/app/utils/prepareMessagesForAPI';

const MAX_CHAT_REQUEST_BYTES = 9 * 1024 * 1024;

export function useMessages(chatId: string, userId: string) {
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState('')
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)
  const supabase = createClient()
  const router = useRouter()

  const handleRateLimitError = (error: any, model: string) => {
    let errorData;
    try {
      errorData = error.message ? JSON.parse(error.message) : null;
    } catch (e) {
      errorData = null;
    }

    if (error.status === 429 || errorData?.error === 'Too many requests') {
      const reset = errorData?.reset || new Date(Date.now() + 60000).toISOString();
      const limit = errorData?.limit || 10;
      
      // Get the model level
      const modelConfig = MODEL_CONFIGS.find(m => m.id === model);
      const modelLevel = modelConfig?.rateLimit.level || '';
      
      router.push(`/rate-limit?${new URLSearchParams({
        limit: limit.toString(),
        reset: reset,
        model: model,
        chatId: chatId,
        level: modelLevel
      }).toString()}`);
      return true;
    }
    return false;
  }

  // Helper to get displayable text from a UIMessage (v5 parts-first with legacy fallback)
  const getMessageText = (message: UIMessage): string => {
    if (message && Array.isArray(message.parts) && message.parts.length > 0) {
      return message.parts
        .filter(part => (part as any)?.type === 'text')
        .map(part => ((part as any)?.text as string) || '')
        .join('\n')
        .trim();
    }
    return (message as any).content || '';
  };

  // Helper function to remove consecutive duplicate links
  const removeConsecutiveDuplicateLinks = (content: string, linkMap: { [key: string]: string }) => {
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
  };

  const handleCopyMessage = async (message: UIMessage) => {
    try {
      // Aggregate message text from parts with legacy fallback
      let textToCopy = getMessageText(message);

      // Extract linkMap and imageMap from message data (same as VirtualizedMessages.tsx)
      const webSearchData = getWebSearchResults(message);
      const googleSearchData = getGoogleSearchData(message);
      
      // Combine link maps and image maps from both sources
      const linkMap = {
        ...(webSearchData?.linkMap || {}),
        ...(googleSearchData?.linkMap || {})
      };
      
      const imageMap = {
        ...(webSearchData?.imageMap || {}),
        ...(googleSearchData?.imageMap || {})
      };

      // Remove consecutive duplicate links before processing placeholders
      if (textToCopy.includes('[LINK_ID:')) {
        textToCopy = removeConsecutiveDuplicateLinks(textToCopy, linkMap);
      }

      // Process placeholders if they exist in the text
      if (textToCopy.includes('[LINK_ID:') || textToCopy.includes('[IMAGE_ID:')) {
        // Pre-compiled regex for better performance (same as Message.tsx)
        const IMAGE_ID_REGEX = /\[IMAGE_ID:([^\]]+)\]/g;
        const LINK_ID_REGEX = /\[LINK_ID:([^\]]+)\]/g;
        
        // Process image placeholders
        if (textToCopy.includes('[IMAGE_ID:')) {
          textToCopy = textToCopy.replace(IMAGE_ID_REGEX, (match: string, imageId: string) => {
            if (imageMap && Object.keys(imageMap).length > 0) {
              const imageUrl = imageMap[imageId];
              if (imageUrl) {
                return imageUrl;
              }
            }
            // Remove placeholder if no matching URL exists
            return '';
          });
        }
        
        // Process link placeholders
        if (textToCopy.includes('[LINK_ID:')) {
          textToCopy = textToCopy.replace(LINK_ID_REGEX, (match: string, linkId: string) => {
            if (linkMap && Object.keys(linkMap).length > 0) {
              const linkUrl = linkMap[linkId];
              if (linkUrl) {
                return linkUrl;
              }
            }
            // Remove placeholder if no matching URL exists
            return '';
          });
        }
      }

      // If the message has a structured response with description, include it
      const annotations = ((message as any).annotations || []) as any[];
      const structuredResponseAnnotation = annotations.find(
        annotation => annotation.type === 'structured_response'
      );
      
      // Include file names and descriptions if available
      let fileInfo = '';
      
      // Check in annotations
      if (structuredResponseAnnotation?.data?.response?.files?.length > 0) {
        const files = structuredResponseAnnotation.data.response.files;
        fileInfo = '\n\nSupporting files:\n' + 
          files.map((file: any) => `- ${file.name}${file.description ? `: ${file.description}` : ''}`).join('\n');
      }
      
      // If not found in annotations, check in tool_results
      const messageWithTools = message as any;
      if (!fileInfo && messageWithTools.tool_results?.structuredResponse?.response?.files?.length > 0) {
        const files = messageWithTools.tool_results.structuredResponse.response.files;
        fileInfo = '\n\nSupporting files:\n' + 
          files.map((file: any) => `- ${file.name}${file.description ? `: ${file.description}` : ''}`).join('\n');
      }
      
      // Add file info if available
      if (fileInfo) {
        textToCopy += fileInfo;
      }

      await navigator.clipboard.writeText(textToCopy)
      setCopiedMessageId(message.id)
      setTimeout(() => setCopiedMessageId(null), 2000)
    } catch (error) {
      console.error('Failed to copy message:', error)
    }
  }

  // 🚀 서버-측 ID 생성으로 변경: 클라이언트 ID 생성 함수 제거
  // const generateMessageId = () => `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

  const handleEditStart = (message: UIMessage) => {
    setEditingMessageId(message.id)
    setEditingContent(getMessageText(message))
  }

  const handleEditCancel = () => {
    setEditingMessageId(null)
    setEditingContent('')
  }

  const handleEditSave = async (messageId: string, currentModel: string, messages: UIMessage[], setMessages: (messages: UIMessage[]) => void, reload: any, isAgentEnabled?: boolean, files?: globalThis.File[], remainingAttachments?: any[], selectedTool?: string | null) => {
    // 🚀 익명 사용자 지원: 익명 사용자는 편집 저장 불가
    if (userId === 'anonymous' || userId.startsWith('anonymous_')) {
      alert('Please sign in to edit messages');
      return;
    }

    // 🚀 비전 모델 검증: 편집 시에도 이미지가 있는데 비전 모델이 아닌 경우 에러 표시
    const { detectImages } = await import('../api/chat/utils/messageUtils');
    const { getModelById } = await import('../../lib/models/config');
    const hasImages = messages.some(msg => detectImages(msg));
    const modelConfig = getModelById(currentModel);
    
    if (hasImages && modelConfig && !modelConfig.supportsVision) {
      // 비전 모델 에러 메시지를 사용자에게 표시
      const errorMessageElement = document.createElement('div');
        errorMessageElement.className = 'fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 text-center max-w-md';
      errorMessageElement.textContent = 'This conversation contains images. Please select a vision-enabled model to continue.';
      document.body.appendChild(errorMessageElement);
      
      // 5초 후 에러 메시지 제거
      setTimeout(() => {
        if (errorMessageElement.parentNode) {
          errorMessageElement.parentNode.removeChild(errorMessageElement);
        }
      }, 5000);
      return;
    }
    
    // console.log('Starting edit save operation:', { 
    //   currentModel,
    //   messageId, 
    //   userId, 
    //   chatId,
    //   messageContent: editingContent.substring(0, 100) + '...',
    //   hasNewFiles: files && files.length > 0
    // });
    
    // Add guard to prevent re-entry
    if (isSavingEdit) {
      // console.log('Edit save already in progress, skipping')
      return
    }
    
    setIsSavingEdit(true)
    
    // 편집 내용 백업
    const currentEditingContent = editingContent;
    
    try {
      if (!messageId || !userId || !chatId) {
        throw new Error('Missing required parameters for edit save operation');
      }

      const localMessage = messages.find(msg => msg.id === messageId);
      
      if (!localMessage) {
        // console.warn('Message not found in local state:', messageId);
        setEditingMessageId(null);
        setEditingContent('');
        return;
      }
      // else {
      //   console.log('Message found in local state:', localMessage);
      // }

      // 파일 업로드 처리
      let newAttachments: any[] = [];
      if (files && files.length > 0) {
        // console.log('Processing new files for edit:', files.length);
        
        // 기존의 uploadFile 함수 사용 (userId 전달)
        const uploadPromises = files.map(async (file) => {
          try {
            const result = await uploadFile(file, userId);
            return result;
          } catch (error) {
            // console.error(`Failed to upload file ${file.name}:`, error);
            return null;
          }
        });
        
        const uploadResults = await Promise.all(uploadPromises);
        newAttachments = uploadResults.filter(result => result !== null);
      }

      // 편집된 파일 목록 처리: 유지되는 기존 파일 + 새로 업로드된 파일
      const retainedAttachments: Attachment[] = remainingAttachments && remainingAttachments.length > 0
        ? await ensureFreshAttachmentUrls(remainingAttachments as Attachment[])
        : [];
      const allAttachments = [...retainedAttachments, ...newAttachments];

      const buildAttachmentPart = (attachment: Attachment) => {
        const isImage =
          attachment.fileType === 'image' ||
          attachment.contentType?.startsWith('image/');

        if (isImage) {
          return {
            type: 'image',
            image: attachment.url
          };
        }

        return {
          type: 'file',
          url: attachment.url,
          mediaType: attachment.contentType || 'application/octet-stream',
          filename: attachment.name || 'file'
        };
      };

      const attachmentParts = allAttachments.map(buildAttachmentPart);
      const updatedParts = [
        {
          type: 'text',
          text: currentEditingContent
        },
        ...attachmentParts
      ];
      
      // console.log('🔍 [DEBUG] File processing for edit:', {
      //   originalAttachmentCount: (localMessage as any).experimental_attachments?.length || 0,
      //   retainedAttachmentCount: retainedAttachments.length,
      //   newAttachmentCount: newAttachments.length,
      //   finalAttachmentCount: allAttachments.length
      // });

      const messageIndex = messages.findIndex(msg => msg.id === messageId);
      const localSequenceNumber = messageIndex + 1;

      // 1. 먼저 UI 상태 업데이트 (레퍼런스 코드 패턴)
      const updatedMessages = messages.slice(0, messageIndex + 1).map(msg => {
        if (msg.id !== messageId) return msg;

        return {
          ...(msg as any),
          content: currentEditingContent, // legacy UI paths still read .content
          experimental_attachments: allAttachments.length > 0 ? allAttachments : null, // 🚀 기존 파일 + 새 파일 모두 포함
          parts: updatedParts,
        } as any;
      });
      
      // 즉시 메시지 상태 업데이트하여 UI에 반영
      setMessages(updatedMessages as unknown as UIMessage[]);
      
      // 2. 편집 모드 종료 (레퍼런스 코드 패턴)
      setEditingMessageId(null);
      setEditingContent('');

      // Use upsert pattern to handle race conditions with server-generated chatIds
      // Query by messageId only (not chatId) since chatId might be different on server
      const { data: existingMessages, error: queryError } = await supabase
        .from('messages')
        .select('id, sequence_number, chat_session_id')
        .eq('id', messageId)
        .eq('user_id', userId);

      if (queryError) {
        throw queryError;
      }

      let existingMessage = existingMessages?.[0];
      
      // Use the actual chatId from DB if message exists (handles server-generated chatId)
      const actualChatId = existingMessage?.chat_session_id || chatId;
      
      // Upsert pattern: handles both insert and update atomically
      const { data: upsertedMessage, error: upsertError } = await supabase
        .from('messages')
        .upsert({
          id: messageId,
          role: localMessage.role,
          content: currentEditingContent,
          created_at: existingMessage ? undefined : new Date().toISOString(), // Only set on insert
          chat_session_id: actualChatId,
          user_id: userId,
          sequence_number: existingMessage?.sequence_number || localSequenceNumber,
          is_edited: true,
          edited_at: new Date().toISOString(),
          host: localMessage.role === 'assistant' ? 'assistant' : 'user',
          experimental_attachments: allAttachments.length > 0 ? allAttachments : null
        }, {
          onConflict: 'id',
          ignoreDuplicates: false
        })
        .select()
        .single();

      if (upsertError) throw upsertError;
      existingMessage = upsertedMessage;

      // 🆕 디버깅: 편집된 메시지들의 첨부파일 정보 출력
      // console.log('🔍 [DEBUG] Messages for edit save:', {
      //   totalMessages: updatedMessages.length,
      //   messagesWithAttachments: updatedMessages.filter(msg => (msg as any).experimental_attachments?.length > 0).length,
      //   newFilesUploaded: newAttachments.length,
      //   totalAttachments: allAttachments.length,
      //   editingContentLength: currentEditingContent.length, // 편집 내용 길이 디버깅 추가
      //   attachmentDetails: updatedMessages.map(msg => ({
      //     id: msg.id,
      //     role: msg.role,
      //     hasAttachments: !!(msg as any).experimental_attachments,
      //     attachmentCount: (msg as any).experimental_attachments?.length || 0,
      //     attachments: (msg as any).experimental_attachments?.map((att: any) => ({
      //       name: att.name,
      //       type: att.fileType || att.contentType,
      //       hasMetadata: !!att.metadata
      //     })) || []
      //   })).filter(msgInfo => msgInfo.hasAttachments)
      // });

      const { error: deleteError } = await supabase
        .from('messages')
        .delete()
        .eq('chat_session_id', actualChatId) // Use actualChatId for consistency
        .eq('user_id', userId)
        .gt('sequence_number', existingMessage.sequence_number);

      if (deleteError) {
        // console.error('Error deleting subsequent messages:', deleteError);
      }
      // else {
      //   console.log('Subsequent messages deleted successfully');
      // }

      const rollbackRes = await fetch('/api/chat/rollback-workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: actualChatId, upToSequenceNumber: existingMessage.sequence_number }),
      });
      if (!rollbackRes.ok) {
        setIsSavingEdit(false);
        return;
      }

      // v5: 빈 어시스턴트 메시지 미리 생성하지 않음 - 스트림 완료 시 저장

      // Check if current model is rate limited
      let modelToUse = currentModel;
      // Removed automatic model switching logic - let rate limits be handled properly

      try {
        // console.log('Reloading with model:', modelToUse);
        // console.log('🔍 [DEBUG] Final editingContent before reload:', currentEditingContent); // 디버깅 추가
        
        const commonBody = {
          model: modelToUse, // Use original model - rate limits will be handled by error handlers
          chatId: actualChatId, // Use actualChatId from DB for consistency
          isRegeneration: false, // 편집 후 전송은 새로운 대화이므로 재생성이 아님
          isAgentEnabled: !!isAgentEnabled,
          selectedTool: selectedTool || null, // 현재 선택된 도구 사용
          experimental_attachments: newAttachments // 🚀 새로 업로드된 파일들 전달
        };
        const trimmedPayload = trimMessagesToByteLimit(
          updatedMessages as any[],
          (candidateMessages) => ({ ...commonBody, messages: candidateMessages }),
          MAX_CHAT_REQUEST_BYTES
        );
        if (trimmedPayload.bytes > MAX_CHAT_REQUEST_BYTES) {
          throw new Error('Request payload is too large after optimization. Please shorten the conversation and try again.');
        }

        await reload({
          body: {
            ...commonBody,
            messages: trimmedPayload.messages,
          }
        });
      } catch (error: any) {
        // console.error('Error reloading:', error);
        if (!handleRateLimitError(error, modelToUse)) {
          throw error;
        }
      }
    } catch (error: any) {
      if (!handleRateLimitError(error, currentModel)) {
        const message = typeof error?.message === 'string' ? error.message : '';
        if (message.toLowerCase().includes('payload is too large')) {
          alert('Conversation is too large to resend as-is. Please continue from a newer message or remove heavy tool outputs.');
        }
        // console.error('Failed to update message:', {
        //   error: error?.message || error,
        //   stack: error?.stack,
        //   supabaseError: error?.error_description || error?.details,
        //   statusCode: error?.status || error?.code,
        //   messageId,
        //   userId,
        //   chatId
        // });
      }
      
      // 에러 발생 시 편집 상태 복원 - 백업된 편집 내용 복원
      setEditingMessageId(messageId);
      setEditingContent(currentEditingContent); // 백업된 편집 내용으로 복원
    } finally {
      setIsSavingEdit(false)
    }
  }

  const handleRegenerate = useCallback((messageId: string, messages: UIMessage[], setMessages: (messages: UIMessage[]) => void, currentModel: string, reload: any, isAgentEnabled?: boolean, selectedTool?: string | null) => async (e: React.MouseEvent) => {
    // 🚀 익명 사용자 지원: 익명 사용자는 재생성 불가 - iMessage 스타일로 표시
    if (userId === 'anonymous' || userId.startsWith('anonymous_')) {
      // Rate limit과 같은 방식으로 iMessage 스타일 메시지 표시
      const signupPromptMessage: UIMessage = {
        id: `signup-prompt-${Date.now()}`,
        role: 'assistant',
        content: '',
        createdAt: new Date(),
        parts: [],
        annotations: [
          {
            type: 'signup_prompt',
            data: {
              message: 'Please sign in to ask again',
              upgradeUrl: '/login'
            }
          }
        ]
      } as UIMessage;
      
      setMessages([...messages, signupPromptMessage]);
      return;
    }

    // 🚀 비전 모델 검증: 재생성 시에도 이미지가 있는데 비전 모델이 아닌 경우 에러 표시
    const { detectImages } = await import('../api/chat/utils/messageUtils');
    const { getModelById } = await import('../../lib/models/config');
    const hasImages = messages.some(msg => detectImages(msg));
    const modelConfig = getModelById(currentModel);
    
    if (hasImages && modelConfig && !modelConfig.supportsVision) {
      // 비전 모델 에러 메시지를 사용자에게 표시
      const errorMessageElement = document.createElement('div');
        errorMessageElement.className = 'fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 text-center max-w-md';
      errorMessageElement.textContent = 'This conversation contains images. Please select a vision-enabled model to continue.';
      document.body.appendChild(errorMessageElement);
      
      // 5초 후 에러 메시지 제거
      setTimeout(() => {
        if (errorMessageElement.parentNode) {
          errorMessageElement.parentNode.removeChild(errorMessageElement);
        }
      }, 5000);
      return;
    }
    
    // console.log('Starting regenerate operation:', { 
    //   currentModel,
    //   messageId, 
    //   userId, 
    //   chatId,
    //   messageContent: editingContent.substring(0, 100) + '...'
    // });
    
    e.preventDefault()
    
    // Add a guard to prevent re-entry
    if (isRegenerating) {
      // console.log('Regeneration already in progress, skipping')
      return
    }
    
    setIsRegenerating(true)
    
    try {
      const messageIndex = messages.findIndex(m => m.id === messageId)
      if (messageIndex === -1) return

      const targetUserMessage = messages
        .slice(0, messageIndex)
        .reverse()
        .find(m => m.role === 'user')
      
      if (!targetUserMessage) return

      // 🆕 디버깅: 대상 메시지의 첨부파일 정보 출력
      // console.log('🔍 [DEBUG] Target user message for regeneration:', {
      //   id: targetUserMessage.id,
      //   content: targetUserMessage.content.substring(0, 100) + '...',
      //   hasAttachments: !!(targetUserMessage as any).experimental_attachments,
      //   attachmentCount: (targetUserMessage as any).experimental_attachments?.length || 0,
      //   attachments: (targetUserMessage as any).experimental_attachments?.map((att: any) => ({
      //     name: att.name,
      //     type: att.fileType || att.contentType,
      //     hasMetadata: !!att.metadata,
      //     url: att.url?.substring(0, 50) + '...'
      //   })) || []
      // });

      const assistantMessageId = messageId
      const updatedMessages = messages.slice(0, messageIndex)
      
      // 1. 먼저 UI 상태 업데이트 (레퍼런스 코드 패턴)
      setMessages(updatedMessages)

      // 메시지의 sequence_number와 실제 chatId를 찾거나 계산
      let sequenceNumber: number;
      let actualChatId = chatId;
      
      // Query by messageId only to handle server-generated chatId mismatch
      const { data: messageData, error: messageError } = await supabase
        .from('messages')
        .select('sequence_number, chat_session_id')
        .eq('id', messageId)
        .eq('user_id', userId)
        .single()

      if (messageError || !messageData) {
        // 데이터베이스에서 메시지를 찾지 못한 경우, 현재 메시지 인덱스 + 1을 sequence number로 사용
        // console.log('Message not found in database, using index-based sequence number')
        sequenceNumber = messageIndex + 1
      } else {
        sequenceNumber = messageData.sequence_number
        actualChatId = messageData.chat_session_id || chatId
      }

      // 재생성하려는 메시지 이후의 메시지들만 삭제 (재생성 메시지는 유지)
      const { error: deleteError } = await supabase
        .from('messages')
        .delete()
        .eq('chat_session_id', actualChatId) // Use actual chatId from DB
        .eq('user_id', userId)
        .gt('sequence_number', sequenceNumber)

      if (deleteError) {
        // console.error('Error deleting subsequent messages:', deleteError)
        return
      }

      const rollbackRes = await fetch('/api/chat/rollback-workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: actualChatId, upToSequenceNumber: sequenceNumber }),
      });
      if (!rollbackRes.ok) {
        setIsRegenerating(false);
        return;
      }

      // v5: 빈 어시스턴트 메시지 미리 생성하지 않음 - 스트림 완료 시 저장

      // Check if current model is rate limited
      let modelToUse = currentModel;
      // Removed automatic model switching logic - let rate limits be handled properly

      try {
        const targetMessagePayload = {
          id: targetUserMessage.id,
          role: targetUserMessage.role,
          parts: Array.isArray((targetUserMessage as any).parts)
            ? (targetUserMessage as any).parts
            : [{ type: 'text', text: getMessageText(targetUserMessage) }],
          content: (targetUserMessage as any).content, // legacy
          createdAt: (targetUserMessage as any).createdAt,
          experimental_attachments: (targetUserMessage as any).experimental_attachments,
        } as any;

        const commonBody = {
          model: modelToUse, // Use original model - rate limits will be handled by error handlers
          chatId: actualChatId, // Use actual chatId from DB
          isRegeneration: true,
          existingMessageId: assistantMessageId,
          saveToDb: true,
          isAgentEnabled: !!isAgentEnabled,
          selectedTool: selectedTool || null // 현재 선택된 도구 사용
        };
        const rawMessagesForReload = [
          ...updatedMessages,
          targetMessagePayload,
        ];
        const trimmedPayload = trimMessagesToByteLimit(
          rawMessagesForReload as any[],
          (candidateMessages) => ({ ...commonBody, messages: candidateMessages }),
          MAX_CHAT_REQUEST_BYTES
        );
        if (trimmedPayload.bytes > MAX_CHAT_REQUEST_BYTES) {
          throw new Error('Request payload is too large after optimization. Please shorten the conversation and try again.');
        }

        await reload({
          body: {
            ...commonBody,
            messages: trimmedPayload.messages,
          }
        });
      } catch (error: any) {
        if (!handleRateLimitError(error, modelToUse)) {
          throw error;
        }
      }
    } catch (error: any) {
      if (!handleRateLimitError(error, currentModel)) {
        const message = typeof error?.message === 'string' ? error.message : '';
        if (message.toLowerCase().includes('payload is too large')) {
          alert('Conversation is too large to resend as-is. Please continue from a newer message or remove heavy tool outputs.');
        }
        // console.error('Regeneration failed:', error);
      }
    } finally {
      setIsRegenerating(false)
    }
  }, [chatId, userId, handleRateLimitError, supabase, isRegenerating])

  return {
    isRegenerating,
    isSavingEdit,
    editingMessageId,
    editingContent,
    copiedMessageId,
    handleCopyMessage,
    handleEditStart,
    handleEditCancel,
    handleEditSave,
    handleRegenerate,
    setEditingContent
  }
} 