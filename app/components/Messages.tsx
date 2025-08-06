'use client'

import { Message as AIMessage } from 'ai'
import { User } from '@supabase/supabase-js'
import React, { useState, useEffect, useCallback } from 'react'
import { Message as MessageComponent } from '@/app/components/Message'
import { getYouTubeLinkAnalysisData, getYouTubeSearchData, getWebSearchResults, getMathCalculationData, getLinkReaderData, getImageGeneratorData, getAcademicSearchData } from '@/app/hooks/toolFunction';
import { formatMessageGroupTimestamp } from '@/app/lib/messageGroupTimeUtils';
import { createClient } from '@/utils/supabase/client';

interface MessagesProps {
  messages: AIMessage[]
  currentModel: string
  isRegenerating: boolean
  editingMessageId: string | null
  editingContent: string
  copiedMessageId: string | null
  onRegenerate: (messageId: string) => (e: React.MouseEvent) => void
  onCopy: (message: AIMessage) => void
  onEditStart: (message: AIMessage) => void
  onEditCancel: () => void
  onEditSave: (messageId: string, files?: globalThis.File[], remainingAttachments?: any[]) => void
  setEditingContent: (content: string) => void
  chatId?: string
  isLoading?: boolean
  isWaitingForToolResults: (message: AIMessage) => boolean
  hasCanvasData: (message: AIMessage) => boolean
  activePanelMessageId: string | null
  togglePanel: (messageId: string, type: 'canvas' | 'structuredResponse' | 'attachment', fileIndex?: number, toolType?: string, fileName?: string) => void
  user: User | null
  handleFollowUpQuestionClick: (question: string) => Promise<void>
  messagesEndRef: React.RefObject<HTMLDivElement | null>
}

export function Messages({
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
  togglePanel,
  user,
  handleFollowUpQuestionClick,
  messagesEndRef
}: MessagesProps) {
  // Bookmark state management
  const [bookmarkedMessageIds, setBookmarkedMessageIds] = useState<Set<string>>(new Set());
  const [isBookmarksLoading, setIsBookmarksLoading] = useState(false);

  // Fetch bookmarks for current chat session (하이브리드 방식)
  const fetchBookmarks = useCallback(async () => {
    if (!user || !chatId) return;
    
    setIsBookmarksLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('message_bookmarks')
        .select('message_id, content')
        .eq('user_id', user.id)
        .eq('chat_session_id', chatId);
        
      if (error) {
        console.error('Error fetching bookmarks:', error);
        return;
      }
      
      if (data && data.length > 0) {
        const matchedMessageIds = new Set<string>();
        
        // 각 북마크에 대해 매칭 시도
        for (const bookmark of data) {
          if (bookmark.message_id.startsWith('msg-')) {
            // 임시 ID인 경우 content로 매칭
            const matchingMessage = messages.find(m => 
              m.content === bookmark.content && 
              m.role === 'assistant'
            );
            if (matchingMessage) {
              matchedMessageIds.add(matchingMessage.id);
            }
          } else {
            // 실제 DB ID인 경우 그대로 사용
            matchedMessageIds.add(bookmark.message_id);
          }
        }
        
        setBookmarkedMessageIds(matchedMessageIds);
      } else {
        setBookmarkedMessageIds(new Set());
      }
    } catch (error) {
      console.error('Error fetching bookmarks:', error);
    } finally {
      setIsBookmarksLoading(false);
    }
  }, [user, chatId, messages]);

  // Fetch bookmarks when user or chatId changes
  useEffect(() => {
    fetchBookmarks();
  }, [fetchBookmarks]);

  // Handle bookmark toggle
  const handleBookmarkToggle = useCallback(async (messageId: string, shouldBookmark: boolean) => {
    if (!user || !chatId || !messageId) return;
    
    try {
      const supabase = createClient();
      const message = messages.find(m => m.id === messageId);
      if (!message) return;
      
      if (shouldBookmark) {
        // 북마크 시점에서 실제 DB ID 조회
        const { data: dbMessage, error: findError } = await supabase
          .from('messages')
          .select('id')
          .eq('content', message.content)
          .eq('role', message.role)
          .eq('chat_session_id', chatId)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
          
        if (findError) {
          console.error('Error finding message in DB:', findError);
          return;
        }
        
        // 실제 DB ID로 북마크 저장
        const { error } = await supabase
          .from('message_bookmarks')
          .insert({
            message_id: dbMessage.id, // 실제 DB ID 사용
            user_id: user.id,
            chat_session_id: chatId,
            content: message.content,
            model: (message as any).model || currentModel,
            created_at: new Date().toISOString()
          });
          
        if (error) throw error;
      } else {
        // Remove bookmark - message_id로 정확한 삭제
        const { error } = await supabase
          .from('message_bookmarks')
          .delete()
          .eq('message_id', messageId)
          .eq('user_id', user.id)
          .eq('chat_session_id', chatId);
          
        if (error) throw error;
      }
      
      // Refresh bookmarks after toggle
      fetchBookmarks();
    } catch (error) {
      console.error('Error toggling bookmark:', error);
    }
  }, [user, chatId, messages, currentModel, fetchBookmarks]);

  // Function to determine if a separator should be shown
  const shouldShowTimestamp = (currentMessage: AIMessage, previousMessage?: AIMessage): boolean => {
    if (!previousMessage) return true; // Always show for the first message

    const currentTimestamp = new Date((currentMessage as any).createdAt || new Date()).getTime();
    const previousTimestamp = new Date((previousMessage as any).createdAt || new Date()).getTime();

    // Show if more than 30 minutes have passed
    return (currentTimestamp - previousTimestamp) > 30 * 60 * 1000;
  };

  return (
    <div className="messages-container mb-4 flex flex-col sm:px-4">
      <div className="flex-grow">
        {/* Chatflix label - iMessage style */}
        {messages.length > 0 && (
          <div className="message-timestamp" style={{ paddingBottom: '0', textTransform: 'none', color: '#737373' }}>
            Chatflix
          </div>
        )}
        
        {messages.map((message, index) => {
          const previousMessage = index > 0 ? messages[index - 1] : undefined;
          const showTimestamp = shouldShowTimestamp(message, previousMessage);
          const messageHasCanvasData = hasCanvasData(message);
          const isLastMessage = index === messages.length - 1;
          const isNextMessageAssistant = index < messages.length - 1 && messages[index + 1].role === 'assistant';
          const isCurrentMessageUser = message.role === 'user';
          const isCurrentMessageAssistant = message.role === 'assistant';

          let messageClasses = '';
          
          if (isCurrentMessageUser && isNextMessageAssistant) {
            messageClasses = 'mb-2';
          } else if (isCurrentMessageAssistant && index < messages.length - 1) {
            messageClasses = 'mb-4';
          } else if (isCurrentMessageAssistant && index === messages.length - 1) {
            messageClasses = 'mb-0';
          } else {
            messageClasses = 'mb-3';
          }
          
          const webSearchData = getWebSearchResults(message);
          const imageMap = webSearchData?.imageMap || {};
          const mathCalculationData = getMathCalculationData(message);
          const linkReaderData = getLinkReaderData(message);
          const imageGeneratorData = getImageGeneratorData(message);
          const academicSearchData = getAcademicSearchData(message);
          const youTubeSearchData = getYouTubeSearchData(message);
          const youTubeLinkAnalysisData = getYouTubeLinkAnalysisData(message);

          return (
            <React.Fragment key={message.id}>
              {showTimestamp && (
                <div className="message-timestamp" style={index === 0 ? { paddingTop: '0' } : {}}>
                  {formatMessageGroupTimestamp((message as any).createdAt || new Date())}
                </div>
              )}
              <div className={messageClasses}>
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
                    isStreaming={isLoading && message.role === 'assistant' && message.id === messages[messages.length - 1]?.id}
                    isWaitingForToolResults={isWaitingForToolResults(message)}
                    messageHasCanvasData={messageHasCanvasData}
                    activePanelMessageId={activePanelMessageId}
                    togglePanel={togglePanel}
                    isLastMessage={isLastMessage}
                    webSearchData={webSearchData}
                    mathCalculationData={mathCalculationData}
                    linkReaderData={linkReaderData}
                    imageGeneratorData={imageGeneratorData}
                    academicSearchData={academicSearchData}
                    youTubeSearchData={youTubeSearchData}
                    youTubeLinkAnalysisData={youTubeLinkAnalysisData}
                    user={user}
                    handleFollowUpQuestionClick={handleFollowUpQuestionClick}
                    allMessages={messages}
                    isGlobalLoading={isLoading}
                    imageMap={imageMap}
                    isBookmarked={bookmarkedMessageIds.has(message.id)}
                    onBookmarkToggle={handleBookmarkToggle}
                    isBookmarksLoading={isBookmarksLoading}
                  />
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>
      
      {/* Spacer at the bottom */}
      <div ref={messagesEndRef} />
    </div>
  )
} 