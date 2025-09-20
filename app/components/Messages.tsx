'use client'

import { UIMessage as AIMessage } from 'ai'
import { User } from '@supabase/supabase-js'
import React, { useState, useEffect, useCallback, memo } from 'react'
import { Message as MessageComponent } from '@/app/components/Message'
import { getYouTubeLinkAnalysisData, getYouTubeSearchData, getWebSearchResults, getMathCalculationData, getLinkReaderData, getImageGeneratorData, getGoogleSearchData } from '@/app/hooks/toolFunction';
import { formatMessageGroupTimestamp } from '@/app/lib/messageGroupTimeUtils';
import { createClient } from '@/utils/supabase/client';

interface MessagesProps {
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
}

// ✅ P1 FIX: React.memo로 렌더링 최적화 - 빠른 스트리밍 시 불필요한 리렌더링 방지
export const Messages = memo(function Messages({
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
  searchTerm // 🚀 FEATURE: Search term for highlighting
}: MessagesProps) {
  // Bookmark state management
  const [bookmarkedMessageIds, setBookmarkedMessageIds] = useState<Set<string>>(new Set());
  const [isBookmarksLoading, setIsBookmarksLoading] = useState(false);

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


  // Handle bookmark toggle
  const handleBookmarkToggle = useCallback(async (messageId: string, shouldBookmark: boolean) => {
    if (!user || !chatId || !messageId) return;
    
    try {
      const supabase = createClient();
      const message = messages.find(m => m.id === messageId);
      if (!message) return;
      
      if (shouldBookmark) {
        // Add bookmark
        const { error } = await supabase
          .from('message_bookmarks')
          .insert({
            message_id: messageId,
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
      fetchBookmarks(messages);
    } catch (error) {
      console.error('Error toggling bookmark:', error);
    }
  }, [user, chatId, messages, currentModel, fetchBookmarks]);

  // Function to determine if a separator should be shown
  const shouldShowTimestamp = (currentMessage: undefined, previousMessage?: undefined): boolean => {
    if (!previousMessage) return true; // Always show for the first message

    const currentTimestamp = new Date((currentMessage as any).createdAt || new Date()).getTime();
    const previousTimestamp = new Date((previousMessage as any).createdAt || new Date()).getTime();

    // Show if more than 30 minutes have passed
    return (currentTimestamp - previousTimestamp) > 30 * 60 * 1000;
  };

  return (
    <div className="messages-container mb-4 flex flex-col sm:px-4" style={{ overflow: 'hidden' }}>
      <div className="flex-grow" style={{ overflow: 'hidden' }}>
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
          const imageGeneratorData = getImageGeneratorData(message);
          const googleSearchData = getGoogleSearchData(message);
          
          // Combine web search images and generated images into imageMap
          const imageMap = {
            ...(webSearchData?.imageMap || {}),
            ...(googleSearchData?.imageMap || {}),
            ...(imageGeneratorData?.generatedImages?.reduce((acc: any, image: any, index: number) => {
              // Create a unique key for generated images
              const imageKey = `generated_image_${image.seed || index}`;
              acc[imageKey] = image.imageUrl;
              return acc;
            }, {}) || {})
          };
          
          // Combine link maps and thumbnail maps from both Google Search and Web Search
          const linkMap = {
            ...(webSearchData?.linkMap || {}),
            ...(googleSearchData?.linkMap || {})
          };
          
          const thumbnailMap = {
            ...(webSearchData?.thumbnailMap || {}),
            ...(googleSearchData?.thumbnailMap || {})
          };
          
          const titleMap = {
            ...(webSearchData?.titleMap || {}),
            ...(googleSearchData?.titleMap || {})
          };
          
          const mathCalculationData = getMathCalculationData(message);
          const linkReaderData = getLinkReaderData(message);

          const youTubeSearchData = getYouTubeSearchData(message);
          const youTubeLinkAnalysisData = getYouTubeLinkAnalysisData(message);

          return (
            <React.Fragment key={message.id}>
              {showTimestamp && (
                <div className="message-timestamp" style={{ paddingTop: '0', textTransform: 'none', color: '#737373' }}>
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
                    activePanel={activePanel}
                    togglePanel={togglePanel}
                    isLastMessage={isLastMessage}
                    webSearchData={webSearchData}
                    mathCalculationData={mathCalculationData}
                    linkReaderData={linkReaderData}
                    imageGeneratorData={imageGeneratorData}

                    youTubeSearchData={youTubeSearchData}
                    youTubeLinkAnalysisData={youTubeLinkAnalysisData}
                    googleSearchData={googleSearchData}
                    user={user}
                    handleFollowUpQuestionClick={handleFollowUpQuestionClick}
                    allMessages={messages}
                    isGlobalLoading={isLoading}
                    imageMap={imageMap}
                    linkMap={linkMap}
                    thumbnailMap={thumbnailMap}
                    titleMap={titleMap}
                    isBookmarked={bookmarkedMessageIds.has(message.id)}
                    onBookmarkToggle={handleBookmarkToggle}
                    isBookmarksLoading={isBookmarksLoading}
                    searchTerm={searchTerm}
                  />
                </div>
              </div>
            </React.Fragment>
          );
        })}
        
        {/* Show typing indicator when waiting for AI response after user message */}
        {isLoading && messages.length > 0 && messages[messages.length - 1].role === 'user' && (
          <div className="flex justify-start mb-4">
            <div className="imessage-receive-bubble" style={{ 
              width: 'fit-content', 
              minWidth: 'auto',
              minHeight: 'auto',
              padding: '8px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <div className="typing-indicator-compact">
                <div className="typing-dot-compact"></div>
                <div className="typing-dot-compact"></div>
                <div className="typing-dot-compact"></div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Spacer at the bottom */}
      <div ref={messagesEndRef} />
    </div>
  )
}); // memo 종료 