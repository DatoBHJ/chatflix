///Users/hajunbae/deepseek/chatbot-app/supabase/sql/handle_message_edit.sql 이 코드를 적용한 함수임. 


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
    // Add guard to prevent re-entry
    if (isSavingEdit) {
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
        setEditingMessageId(null);
        setEditingContent('');
        return;
      }

      // 파일 업로드 처리
      let newAttachments: any[] = [];
      if (files && files.length > 0) {
        const uploadPromises = files.map(async (file) => {
          try {
            const result = await uploadFile(file);
            return result;
          } catch (error) {
            return null;
          }
        });
        
        const uploadResults = await Promise.all(uploadPromises);
        newAttachments = uploadResults.filter(result => result !== null);
      }

      // 편집된 파일 목록 처리: 유지되는 기존 파일 + 새로 업로드된 파일
      const retainedAttachments = remainingAttachments || [];
      const allAttachments = [...retainedAttachments, ...newAttachments];

      const messageIndex = messages.findIndex(msg => msg.id === messageId);
      const localSequenceNumber = messageIndex + 1;

      // 1. 먼저 UI 상태 업데이트
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
      
      // 2. 편집 모드 종료
      setEditingMessageId(null);
      setEditingContent('');

      // 3. 원자적 데이터베이스 작업을 위한 RPC 함수 호출
      const { data: rpcResult, error: rpcError } = await supabase.rpc('handle_message_edit', {
        p_message_id: messageId,
        p_user_id: userId,
        p_chat_session_id: chatId,
        p_content: currentEditingContent,
        p_model: currentModel,
        p_role: localMessage.role,
        p_sequence_number: localSequenceNumber,
        p_attachments: allAttachments.length > 0 ? allAttachments : null
      });

      if (rpcError) {
        throw new Error(`Database operation failed: ${rpcError.message}`);
      }

      // RPC 함수가 성공적으로 완료되었는지 확인
      if (!rpcResult?.success) {
        throw new Error(`Message edit failed: ${rpcResult?.error || 'Unknown error'}`);
      }

      const assistantMessageId = generateMessageId();

      // 새로운 어시스턴트 메시지 삽입
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
          sequence_number: rpcResult.new_sequence_number
        }]);

      if (insertError) throw insertError;

      let modelToUse = currentModel;

      try {
        // 첨부파일 메타데이터 추출
        const messagesWithMetadata = await Promise.all(
          updatedMessages.map(async (msg) => {
            if ((msg as any).experimental_attachments && (msg as any).experimental_attachments.length > 0) {
              const enrichedAttachments = await enrichAttachmentsWithMetadata((msg as any).experimental_attachments);
              return {
                ...msg,
                experimental_attachments: enrichedAttachments
              };
            }
            return msg;
          })
        );
        
        await reload({
          body: {
            messages: messagesWithMetadata,
            model: modelToUse,
            chatId,
            isRegeneration: true,
            existingMessageId: assistantMessageId
          }
        });
      } catch (error: any) {
        if (!handleRateLimitError(error, modelToUse)) {
          throw error;
        }
      }
    } catch (error: any) {
      if (!handleRateLimitError(error, currentModel)) {
        console.error('Failed to update message:', {
          error: error?.message || error,
          messageId,
          userId,
          chatId
        });
      }
      
      // 에러 발생 시 편집 상태 복원
      setEditingMessageId(messageId);
      setEditingContent(currentEditingContent);
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
      // Removed automatic model switching logic - let rate limits be handled properly

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
            model: modelToUse, // Use original model - rate limits will be handled by error handlers
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