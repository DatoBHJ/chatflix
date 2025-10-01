import { useState, useCallback } from 'react'
import { UIMessage } from 'ai'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { MODEL_CONFIGS } from '@/lib/models/config'
import { enrichAttachmentsWithMetadata } from '@/app/chat/[id]/utils'
import { uploadFile } from '@/app/chat/[id]/utils'

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

  const handleCopyMessage = async (message: UIMessage) => {
    try {
      // Aggregate message text from parts with legacy fallback
      let textToCopy = getMessageText(message);

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
      const retainedAttachments = remainingAttachments || [];
      const allAttachments = [...retainedAttachments, ...newAttachments];
      
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
        
        // 기존 파일들을 보존하면서 텍스트만 업데이트
        const newParts = Array.isArray(msg.parts)
          ? msg.parts.map(part => {
              if ((part as any).type === 'text') {
                // 텍스트 부분만 내용 업데이트
                return { ...(part as any), text: currentEditingContent };
              } else {
                // 파일 부분은 그대로 유지
                return part;
              }
            })
          : [{ type: 'text', text: currentEditingContent } as any];
        
        // 🚀 새로 업로드된 첨부파일들을 parts에 추가
        newAttachments.forEach((attachment) => {
          if (attachment.contentType?.startsWith('image/')) {
            newParts.push({
              type: 'image',
              image: attachment.url
            });
          } else {
            newParts.push({
              type: 'file',
              url: attachment.url,
              mediaType: attachment.contentType || 'application/octet-stream',
              filename: attachment.name || 'file'
            });
          }
        });
        
        return {
          ...(msg as any),
          content: currentEditingContent, // legacy UI paths still read .content
          experimental_attachments: allAttachments.length > 0 ? allAttachments : null, // 🚀 기존 파일 + 새 파일 모두 포함
          parts: newParts,
        } as any;
      });
      
      // 즉시 메시지 상태 업데이트하여 UI에 반영
      setMessages(updatedMessages as unknown as UIMessage[]);
      
      // 2. 편집 모드 종료 (레퍼런스 코드 패턴)
      setEditingMessageId(null);
      setEditingContent('');

      const { data: existingMessages, error: queryError } = await supabase
        .from('messages')
        .select('id, sequence_number, chat_session_id')
        .eq('id', messageId)
        .eq('user_id', userId)
        .eq('chat_session_id', chatId);

      if (queryError) {
        throw queryError;
      }

      let existingMessage = existingMessages?.[0];
      
      if (!existingMessage) {
        // console.log('Message not found in database, inserting new message');
        const { data: insertedMessage, error: insertError } = await supabase
          .from('messages')
          .insert([{
            id: messageId,
            role: localMessage.role,
            content: currentEditingContent,
            created_at: new Date().toISOString(),
            chat_session_id: chatId,
            user_id: userId,
            sequence_number: localSequenceNumber,
            is_edited: true,
            edited_at: new Date().toISOString(),
            host: localMessage.role === 'assistant' ? 'assistant' : 'user',
            experimental_attachments: allAttachments.length > 0 ? allAttachments : null // 🚀 기존 파일 + 새 파일 모두 저장
          }])
          .select()
          .single();

        if (insertError) throw insertError;
        existingMessage = insertedMessage;
      } else {
        // console.log('Message found in database, updating message', existingMessage);
        const { error: updateError } = await supabase
          .from('messages')
          .update({
            content: currentEditingContent,
            is_edited: true,
            edited_at: new Date().toISOString(),
            experimental_attachments: allAttachments.length > 0 ? allAttachments : null // 🚀 기존 파일 + 새 파일 모두 저장
          })
          .eq('id', messageId)
          .eq('user_id', userId)
          .eq('chat_session_id', chatId);

        if (updateError) throw updateError;
      }

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
        .eq('chat_session_id', chatId)
        .eq('user_id', userId)
        .gt('sequence_number', existingMessage.sequence_number);

      if (deleteError) {
        // console.error('Error deleting subsequent messages:', deleteError);
      }
      // else {
      //   console.log('Subsequent messages deleted successfully');
      // }

      // v5: 빈 어시스턴트 메시지 미리 생성하지 않음 - 스트림 완료 시 저장

      // Check if current model is rate limited
      let modelToUse = currentModel;
      // Removed automatic model switching logic - let rate limits be handled properly

      try {
        // console.log('Reloading with model:', modelToUse);
        // console.log('🔍 [DEBUG] Final editingContent before reload:', currentEditingContent); // 디버깅 추가
        
        // 🆕 편집된 메시지의 첨부파일 메타데이터 추출
        const messagesWithMetadata = await Promise.all(
          updatedMessages.map(async (msg) => {
            if ((msg as any).experimental_attachments && (msg as any).experimental_attachments.length > 0) {
              // console.log('📎 [DEBUG] Processing attachments for edited message:', msg.id);
              const enrichedAttachments = await enrichAttachmentsWithMetadata((msg as any).experimental_attachments);
              return {
                ...msg,
                experimental_attachments: enrichedAttachments
              };
            }
            return msg;
          })
        );
        
        // 최종 메시지 내용 디버깅
        // console.log('🔍 [DEBUG] Final messages with metadata:', messagesWithMetadata.map(msg => ({
        //   id: msg.id,
        //   content: msg.content.substring(0, 100) + '...',
        //   role: msg.role
        // })));
        
        await reload({
          body: {
            messages: messagesWithMetadata,
            model: modelToUse, // Use original model - rate limits will be handled by error handlers
            chatId,
            isRegeneration: false, // 편집 후 전송은 새로운 대화이므로 재생성이 아님
            isAgentEnabled: !!isAgentEnabled,
            selectedTool: selectedTool || null, // 현재 선택된 도구 사용
            experimental_attachments: newAttachments // 🚀 새로 업로드된 파일들 전달
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

      // 메시지의 sequence_number를 찾거나 계산
      let sequenceNumber: number;
      const { data: messageData, error: messageError } = await supabase
        .from('messages')
        .select('sequence_number')
        .eq('id', messageId)
        .eq('user_id', userId)
        .eq('chat_session_id', chatId)
        .single()

      if (messageError || !messageData) {
        // 데이터베이스에서 메시지를 찾지 못한 경우, 현재 메시지 인덱스 + 1을 sequence number로 사용
        // console.log('Message not found in database, using index-based sequence number')
        sequenceNumber = messageIndex 
      } else {
        sequenceNumber = messageData.sequence_number
      }

      // 재생성하려는 메시지 이후의 메시지들만 삭제 (재생성 메시지는 유지)
      const { error: deleteError } = await supabase
        .from('messages')
        .delete()
        .eq('chat_session_id', chatId)
        .eq('user_id', userId)
        .gt('sequence_number', sequenceNumber)

      if (deleteError) {
        // console.error('Error deleting subsequent messages:', deleteError)
        return
      }

      // v5: 빈 어시스턴트 메시지 미리 생성하지 않음 - 스트림 완료 시 저장

      // Check if current model is rate limited
      let modelToUse = currentModel;
      // Removed automatic model switching logic - let rate limits be handled properly

      try {
        // 🆕 재생성할 메시지의 첨부파일 메타데이터 추출
        let enrichedTargetMessage: any = { ...(targetUserMessage as any) };
        
        if ((targetUserMessage as any).experimental_attachments && (targetUserMessage as any).experimental_attachments.length > 0) {
          // console.log('📎 [DEBUG] Processing attachments for regeneration message:', targetUserMessage.id);
          // console.log('📎 [DEBUG] Original attachments:', (targetUserMessage as any).experimental_attachments);
          
          const enrichedAttachments = await enrichAttachmentsWithMetadata((targetUserMessage as any).experimental_attachments);
          enrichedTargetMessage = {
            ...targetUserMessage,
            experimental_attachments: enrichedAttachments
          };
          
          // console.log('📎 [DEBUG] Enriched attachments:', enrichedAttachments);
        }
        
        await reload({
          body: {
            messages: [
              ...updatedMessages,
              {
                id: enrichedTargetMessage.id,
                role: enrichedTargetMessage.role,
                parts: Array.isArray(enrichedTargetMessage.parts)
                  ? enrichedTargetMessage.parts
                  : [{ type: 'text', text: getMessageText(enrichedTargetMessage) }],
                content: enrichedTargetMessage.content, // legacy
                createdAt: enrichedTargetMessage.createdAt,
                experimental_attachments: (enrichedTargetMessage as any).experimental_attachments,
              } as any,
            ],
            model: modelToUse, // Use original model - rate limits will be handled by error handlers
            chatId,
            isRegeneration: true,
            existingMessageId: assistantMessageId,
            saveToDb: true,
            isAgentEnabled: !!isAgentEnabled,
            selectedTool: selectedTool || null // 현재 선택된 도구 사용
          }
        });
      } catch (error: any) {
        if (!handleRateLimitError(error, modelToUse)) {
          throw error;
        }
      }
    } catch (error: any) {
      if (!handleRateLimitError(error, currentModel)) {
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