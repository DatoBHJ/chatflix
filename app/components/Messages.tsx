'use client'

import { Message as AIMessage } from 'ai'
import { User } from '@supabase/supabase-js'
import React from 'react'
import { Message as MessageComponent } from '@/app/components/Message'
import { getYouTubeLinkAnalysisData, getYouTubeSearchData, getWebSearchResults, getMathCalculationData, getLinkReaderData, getImageGeneratorData, getAcademicSearchData } from '@/app/hooks/toolFunction';
import { formatMessageGroupTimestamp } from '@/app/lib/messageGroupTimeUtils';

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
                <div className="message-timestamp">
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