import { useState, useCallback } from 'react'
import { Message } from 'ai'
import { createClient } from '@/utils/supabase/client'

export function useMessages(chatId: string, userId: string) {
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState('')
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)
  const supabase = createClient()

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
      messageContent: editingContent.substring(0, 100) + '...' // Log first 100 chars for debugging
    });
    
    try {
      // First verify all required parameters are present
      if (!messageId || !userId || !chatId) {
        throw new Error('Missing required parameters for edit save operation');
      }

      console.log('Fetching existing message...');
      // First try to find the message in local state
      const localMessage = messages.find(msg => msg.id === messageId);
      
      if (!localMessage) {
        console.warn('Message not found in local state:', messageId);
        setEditingMessageId(null);
        setEditingContent('');
        return;
      }

      // Get the sequence number from local messages
      const messageIndex = messages.findIndex(msg => msg.id === messageId);
      const localSequenceNumber = messageIndex + 1; // 1-based sequence number

      console.log('Local message found:', {
        messageId,
        messageIndex,
        localSequenceNumber,
        role: localMessage.role
      });

      // Then verify in database with proper error handling
      const { data: existingMessages, error: queryError } = await supabase
        .from('messages')
        .select('id, sequence_number, chat_session_id')
        .eq('id', messageId)
        .eq('user_id', userId)
        .eq('chat_session_id', chatId);

      if (queryError) {
        console.error('Database query error:', { 
          error: queryError,
          code: queryError.code,
          message: queryError.message,
          details: queryError.details,
          hint: queryError.hint
        });
        throw new Error(`Database query failed: ${queryError.message}`);
      }

      let existingMessage = existingMessages?.[0];
      
      if (!existingMessage) {
        console.log('Message not found in database, creating new record:', { 
          messageId,
          localSequenceNumber,
          model: currentModel
        });
        
        // Create the message in the database
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

        if (insertError) {
          console.error('Failed to create message in database:', insertError);
          throw insertError;
        }

        existingMessage = insertedMessage;
      } else {
        console.log('Updating message content...');
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

        if (updateError) {
          console.error('Update operation failed:', updateError);
          throw updateError;
        }
      }

      console.log('Updating local message state...');
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

      console.log('Deleting subsequent messages...');
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
      console.log('Creating new assistant message:', assistantMessageId);

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

      if (insertError) {
        console.error('Error creating assistant message:', insertError);
        throw insertError;
      }

      console.log('Triggering reload with updated messages...');
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
      console.error('Failed to update message:', {
        error: error?.message || error,
        stack: error?.stack,
        supabaseError: error?.error_description || error?.details,
        statusCode: error?.status || error?.code,
        messageId,
        userId,
        chatId
      });
      
      // 에러 발생 시 편집 상태 유지하고 사용자에게 피드백
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

      const { data: validMessages } = await supabase
        .from('messages')
        .select('sequence_number')
        .eq('chat_session_id', chatId)
        .eq('user_id', userId)
        .order('sequence_number', { ascending: true })
        .limit(messageIndex)

      const lastSequenceNumber = validMessages?.[validMessages.length - 1]?.sequence_number || 0

      await supabase
        .from('messages')
        .delete()
        .eq('chat_session_id', chatId)
        .eq('user_id', userId)
        .gt('sequence_number', lastSequenceNumber)

      const updatedMessages = messages.slice(0, messageIndex)
      setMessages(updatedMessages)

      await reload({
        body: {
          messages: [...updatedMessages, {
            id: targetUserMessage.id,
            content: targetUserMessage.content,
            role: targetUserMessage.role,
            createdAt: targetUserMessage.createdAt
          }],
          model: currentModel,
          chatId
        }
      })
    } catch (error) {
      console.error('Regeneration failed:', error)
    } finally {
      setIsRegenerating(false)
    }
  }, [chatId, userId])

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