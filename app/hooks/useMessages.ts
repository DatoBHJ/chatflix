import { useState, useCallback } from 'react'
import { Message } from 'ai'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

export function useMessages(chatId: string, userId: string) {
  const [isRegenerating, setIsRegenerating] = useState(false)
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
      
      router.push(`/rate-limit?${new URLSearchParams({
        limit: limit.toString(),
        reset: reset,
        model: model,
        chatId: chatId
      }).toString()}`);
      return true;
    }
    return false;
  }

  const handleCopyMessage = async (message: Message) => {
    try {
      const textToCopy = message.parts
        ? message.parts
            .filter(part => part.type === 'text')
            .map(part => (part as { text: string }).text || '')
            .join('\n')
            .trim()
        : message.content

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

  const handleEditSave = async (messageId: string, currentModel: string, messages: Message[], setMessages: (messages: Message[]) => void, reload: any) => {
    console.log('Starting edit save operation:', { 
      messageId, 
      userId, 
      chatId,
      messageContent: editingContent.substring(0, 100) + '...'
    });
    
    try {
      if (!messageId || !userId || !chatId) {
        throw new Error('Missing required parameters for edit save operation');
      }

      const localMessage = messages.find(msg => msg.id === messageId);
      
      if (!localMessage) {
        console.warn('Message not found in local state:', messageId);
        setEditingMessageId(null);
        setEditingContent('');
        return;
      }

      const messageIndex = messages.findIndex(msg => msg.id === messageId);
      const localSequenceNumber = messageIndex + 1;

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
        const { data: insertedMessage, error: insertError } = await supabase
          .from('messages')
          .insert([{
            id: messageId,
            role: localMessage.role,
            content: editingContent,
            created_at: new Date().toISOString(),
            chat_session_id: chatId,
            user_id: userId,
            sequence_number: localSequenceNumber,
            is_edited: true,
            edited_at: new Date().toISOString(),
            model: currentModel,
            host: localMessage.role === 'assistant' ? 'assistant' : 'user'
          }])
          .select()
          .single();

        if (insertError) throw insertError;
        existingMessage = insertedMessage;
      } else {
        const { error: updateError } = await supabase
          .from('messages')
          .update({
            content: editingContent,
            is_edited: true,
            edited_at: new Date().toISOString()
          })
          .eq('id', messageId)
          .eq('user_id', userId)
          .eq('chat_session_id', chatId);

        if (updateError) throw updateError;
      }

      const updatedMessages = messages.slice(0, messageIndex + 1).map(msg =>
        msg.id === messageId
          ? {
              ...msg,
              content: editingContent,
              parts: msg.parts ? msg.parts.map(part => 
                part.type === 'text' ? { ...part, text: editingContent } : part
              ) : undefined
            }
          : msg
      );

      setMessages(updatedMessages);
      setEditingMessageId(null);
      setEditingContent('');

      const { error: deleteError } = await supabase
        .from('messages')
        .delete()
        .eq('chat_session_id', chatId)
        .eq('user_id', userId)
        .gt('sequence_number', existingMessage.sequence_number);

      if (deleteError) {
        console.error('Error deleting subsequent messages:', deleteError);
      }

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

      try {
        await reload({
          body: {
            messages: updatedMessages,
            model: currentModel,
            chatId,
            isRegeneration: true,
            existingMessageId: assistantMessageId
          }
        });
      } catch (error: any) {
        if (!handleRateLimitError(error, currentModel)) {
          throw error;
        }
      }
    } catch (error: any) {
      if (!handleRateLimitError(error, currentModel)) {
        console.error('Failed to update message:', {
          error: error?.message || error,
          stack: error?.stack,
          supabaseError: error?.error_description || error?.details,
          statusCode: error?.status || error?.code,
          messageId,
          userId,
          chatId
        });
      }
      
      setEditingMessageId(messageId);
      const originalContent = messages.find(msg => msg.id === messageId)?.content || '';
      setEditingContent(originalContent);
    }
  }

  const handleRegenerate = useCallback((messageId: string, messages: Message[], setMessages: (messages: Message[]) => void, currentModel: string, reload: any) => async (e: React.MouseEvent) => {
    e.preventDefault()
    setIsRegenerating(true)
    
    try {
      const messageIndex = messages.findIndex(m => m.id === messageId)
      if (messageIndex === -1) return

      const targetUserMessage = messages
        .slice(0, messageIndex)
        .reverse()
        .find(m => m.role === 'user')
      
      if (!targetUserMessage) return

      const assistantMessageId = messageId
      const updatedMessages = messages.slice(0, messageIndex)

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
        console.log('Message not found in database, using index-based sequence number')
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
        console.error('Error deleting subsequent messages:', deleteError)
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
        console.error('Error inserting new assistant message:', insertError)
        return
      }

      setMessages(updatedMessages)

      try {
        await reload({
          body: {
            messages: [...updatedMessages, {
              id: targetUserMessage.id,
              content: targetUserMessage.content,
              role: targetUserMessage.role,
              createdAt: targetUserMessage.createdAt,
              experimental_attachments: (targetUserMessage as any).experimental_attachments
            }],
            model: currentModel,
            chatId,
            isRegeneration: true,
            existingMessageId: assistantMessageId,
            saveToDb: false
          }
        });
      } catch (error: any) {
        if (!handleRateLimitError(error, currentModel)) {
          throw error;
        }
      }
    } catch (error: any) {
      if (!handleRateLimitError(error, currentModel)) {
        console.error('Regeneration failed:', error);
      }
    } finally {
      setIsRegenerating(false)
    }
  }, [chatId, userId, handleRateLimitError, supabase])

  return {
    isRegenerating,
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