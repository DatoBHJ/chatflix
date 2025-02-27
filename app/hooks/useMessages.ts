import { useState, useCallback } from 'react'
import { Message } from 'ai'
import { createClient } from '@/utils/supabase/client'
import { ExtendedMessage } from '../chat/[id]/types'

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

  const handleEditStart = (message: Message) => {
    setEditingMessageId(message.id)
    setEditingContent(message.content)
  }

  const handleEditCancel = () => {
    setEditingMessageId(null)
    setEditingContent('')
  }

  const generateMessageId = () => `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

  const handleEditSave = async (messageId: string, currentModel: string, messages: Message[], setMessages: (messages: Message[]) => void, reload: any) => {
    try {
      const { data: existingMessage, error: queryError } = await supabase
        .from('messages')
        .select('id, sequence_number, chat_session_id')
        .match({ id: messageId, user_id: userId, chat_session_id: chatId })
        .single()

      if (queryError || !existingMessage) {
        console.error('Error fetching message:', queryError)
        const messageIndex = messages.findIndex(msg => msg.id === messageId)
        if (messageIndex !== -1) {
          setMessages(messages.map(msg =>
            msg.id === messageId ? { ...msg, content: editingContent } : msg
          ))
        }
        setEditingMessageId(null)
        setEditingContent('')
        return
      }

      const { error: updateError } = await supabase
        .from('messages')
        .update({
          content: editingContent,
          is_edited: true,
          edited_at: new Date().toISOString()
        })
        .match({ 
          id: messageId, 
          user_id: userId,
          chat_session_id: chatId 
        })

      if (updateError) {
        console.error('Error updating message:', updateError)
        throw updateError
      }

      const messageIndex = messages.findIndex(msg => msg.id === messageId)
      if (messageIndex === -1) return

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
      )

      setMessages(updatedMessages)
      setEditingMessageId(null)
      setEditingContent('')

      const { error: deleteError } = await supabase
        .from('messages')
        .delete()
        .match({ chat_session_id: chatId, user_id: userId })
        .gt('sequence_number', existingMessage.sequence_number)

      if (deleteError) {
        console.error('Error deleting subsequent messages:', deleteError)
      }

      const assistantMessageId = generateMessageId()

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
        }])

      if (insertError) {
        console.error('Error creating assistant message:', insertError)
        throw insertError
      }

      await reload({
        body: {
          messages: updatedMessages,
          model: currentModel,
          chatId,
          isRegeneration: true,
          existingMessageId: assistantMessageId
        }
      })
    } catch (error) {
      console.error('Failed to update message:', error)
      setEditingMessageId(null)
      setEditingContent('')
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