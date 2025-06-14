import { useState, useCallback } from 'react'
import { Message } from 'ai'
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

  const handleCopyMessage = async (message: Message) => {
    try {
      // Get regular message content - in our new approach, the main response is already in the content
      let textToCopy = message.parts
        ? message.parts
            .filter(part => part.type === 'text')
            .map(part => (part as { text: string }).text || '')
            .join('\n')
            .trim()
        : message.content

      // If the message has a structured response with description, include it
      const annotations = (message.annotations || []) as any[];
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

  const generateMessageId = () => `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

  const handleEditStart = (message: Message) => {
    setEditingMessageId(message.id)
    setEditingContent(message.content)
  }

  const handleEditCancel = () => {
    setEditingMessageId(null)
    setEditingContent('')
  }

  const handleEditSave = async (messageId: string, currentModel: string, messages: Message[], setMessages: (messages: Message[]) => void, reload: any, files?: globalThis.File[], remainingAttachments?: any[]) => {
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
        
        // 기존의 uploadFile 함수 사용
        const uploadPromises = files.map(async (file) => {
          try {
            const result = await uploadFile(file);
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
      const updatedMessages = messages.slice(0, messageIndex + 1).map(msg =>
        msg.id === messageId
          ? {
              ...msg,
              content: currentEditingContent,
              experimental_attachments: allAttachments,
              parts: msg.parts ? msg.parts.map(part => 
                part.type === 'text' ? { ...part, text: currentEditingContent } : part
              ) : undefined
            }
          : msg
      );
      
      // 즉시 메시지 상태 업데이트하여 UI에 반영
      setMessages(updatedMessages);
      
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
            model: currentModel,
            host: localMessage.role === 'assistant' ? 'assistant' : 'user',
            experimental_attachments: allAttachments.length > 0 ? allAttachments : null
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
            experimental_attachments: allAttachments.length > 0 ? allAttachments : null
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

      const assistantMessageId = generateMessageId();

      const { error: insertError } = await supabase
        .from('messages')
        .insert([{
          id: assistantMessageId,
          role: 'assistant',
          content: '',
          created_at: new Date().toISOString(),
          model: currentModel,
          host: 'assistant',
          chat_session_id: chatId,
          user_id: userId,
          sequence_number: existingMessage.sequence_number + 1
        }]);

      if (insertError) throw insertError;

      // Check if current model is rate limited
      let modelToUse = currentModel;
      if (typeof window !== 'undefined') {
        try {
          // Check for multiple rate limited levels
          const rateLimitLevelsStr = localStorage.getItem('rateLimitLevels')
          if (rateLimitLevelsStr) {
            const levelsData = JSON.parse(rateLimitLevelsStr)
            const currentTime = Date.now()
            
            // Filter out expired levels and collect valid ones
            const validLevels = Object.entries(levelsData)
              .filter(([_, data]: [string, any]) => data.reset > currentTime)
              .map(([level, _]: [string, any]) => level)
            
            if (validLevels.length > 0) {
              const currentModelConfig = MODEL_CONFIGS.find(m => m.id === currentModel)
              if (currentModelConfig && validLevels.includes(currentModelConfig.rateLimit.level)) {
                // Find a model from a different level that's not rate limited
                const alternativeModel = MODEL_CONFIGS.find(m => 
                  m.isEnabled && !validLevels.includes(m.rateLimit.level)
                )
                if (alternativeModel) {
                  modelToUse = alternativeModel.id
                  // console.log(`Current model ${currentModel} is rate limited. Using alternative model: ${modelToUse}`)
                }
              }
            }
          } else {
            // For backward compatibility, check the old format
            const rateLimitInfoStr = localStorage.getItem('rateLimitInfo')
            if (rateLimitInfoStr) {
              const rateLimitInfo = JSON.parse(rateLimitInfoStr)
              
              // Check if the rate limit is still valid
              if (rateLimitInfo.reset > Date.now()) {
                const currentModelConfig = MODEL_CONFIGS.find(m => m.id === currentModel)
                if (currentModelConfig && currentModelConfig.rateLimit.level === rateLimitInfo.level) {
                  // Find a model from a different level
                  const alternativeModel = MODEL_CONFIGS.find(m => 
                    m.isEnabled && m.rateLimit.level !== rateLimitInfo.level
                  )
                  if (alternativeModel) {
                    modelToUse = alternativeModel.id
                    // console.log(`Current model ${currentModel} is rate limited. Using alternative model: ${modelToUse}`)
                  }
                }
              }
            }
          }
        } catch (error) {
          // console.error('Error parsing rate limit info:', error)
        }
      }

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
            model: modelToUse, // Use alternative model if current is rate limited
            chatId,
            isRegeneration: true,
            existingMessageId: assistantMessageId
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

  const handleRegenerate = useCallback((messageId: string, messages: Message[], setMessages: (messages: Message[]) => void, currentModel: string, reload: any) => async (e: React.MouseEvent) => {
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

      // 이후 메시지들 삭제
      const { error: deleteError } = await supabase
        .from('messages')
        .delete()
        .eq('chat_session_id', chatId)
        .eq('user_id', userId)
        .gte('sequence_number', sequenceNumber)

      if (deleteError) {
        // console.error('Error deleting subsequent messages:', deleteError)
        return
      }

      // 새로운 assistant 메시지 삽입
      const { error: insertError } = await supabase
        .from('messages')
        .insert([{
          id: assistantMessageId,
          role: 'assistant',
          content: '',
          created_at: new Date().toISOString(),
          model: currentModel,
          host: 'assistant',
          chat_session_id: chatId,
          user_id: userId,
          sequence_number: sequenceNumber
        }])

      if (insertError) {
        // console.error('Error inserting new assistant message:', insertError)
        return
      }

      // Check if current model is rate limited
      let modelToUse = currentModel;
      if (typeof window !== 'undefined') {
        try {
          // Check for multiple rate limited levels
          const rateLimitLevelsStr = localStorage.getItem('rateLimitLevels')
          if (rateLimitLevelsStr) {
            const levelsData = JSON.parse(rateLimitLevelsStr)
            const currentTime = Date.now()
            
            // Filter out expired levels and collect valid ones
            const validLevels = Object.entries(levelsData)
              .filter(([_, data]: [string, any]) => data.reset > currentTime)
              .map(([level, _]: [string, any]) => level)
            
            if (validLevels.length > 0) {
              const currentModelConfig = MODEL_CONFIGS.find(m => m.id === currentModel)
              if (currentModelConfig && validLevels.includes(currentModelConfig.rateLimit.level)) {
                // Find a model from a different level that's not rate limited
                const alternativeModel = MODEL_CONFIGS.find(m => 
                  m.isEnabled && !validLevels.includes(m.rateLimit.level)
                )
                if (alternativeModel) {
                  modelToUse = alternativeModel.id
                  // console.log(`Current model ${currentModel} is rate limited. Using alternative model: ${modelToUse}`)
                }
              }
            }
          } else {
            // For backward compatibility, check the old format
            const rateLimitInfoStr = localStorage.getItem('rateLimitInfo')
            if (rateLimitInfoStr) {
              const rateLimitInfo = JSON.parse(rateLimitInfoStr)
              
              // Check if the rate limit is still valid
              if (rateLimitInfo.reset > Date.now()) {
                const currentModelConfig = MODEL_CONFIGS.find(m => m.id === currentModel)
                if (currentModelConfig && currentModelConfig.rateLimit.level === rateLimitInfo.level) {
                  // Find a model from a different level
                  const alternativeModel = MODEL_CONFIGS.find(m => 
                    m.isEnabled && m.rateLimit.level !== rateLimitInfo.level
                  )
                  if (alternativeModel) {
                    modelToUse = alternativeModel.id
                    // console.log(`Current model ${currentModel} is rate limited. Using alternative model: ${modelToUse}`)
                  }
                }
              }
            }
          }
        } catch (error) {
          // console.error('Error parsing rate limit info:', error)
        }
      }

      try {
        // 🆕 재생성할 메시지의 첨부파일 메타데이터 추출
        let enrichedTargetMessage = { ...targetUserMessage };
        
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
            messages: [...updatedMessages, {
              id: enrichedTargetMessage.id,
              content: enrichedTargetMessage.content,
              role: enrichedTargetMessage.role,
              createdAt: enrichedTargetMessage.createdAt,
              experimental_attachments: (enrichedTargetMessage as any).experimental_attachments
            }],
            model: modelToUse, // Use alternative model if current is rate limited
            chatId,
            isRegeneration: true,
            existingMessageId: assistantMessageId,
            saveToDb: false
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