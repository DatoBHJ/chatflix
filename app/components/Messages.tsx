'use client'

import { Message } from 'ai'
import { Message as MessageComponent } from '@/app/components/Message'
import { getYouTubeLinkAnalysisData, getYouTubeSearchData, getWebSearchResults, getMathCalculationData, getLinkReaderData, getImageGeneratorData, getAcademicSearchData } from '@/app/hooks/toolFunction';
import React from 'react';
import { User } from '@supabase/supabase-js';

interface MessagesProps {
  messages: Message[];
  currentModel: string;
  isRegenerating: boolean;
  editingMessageId: string | null;
  editingContent: string;
  copiedMessageId: string | null;
  onRegenerate: (messageId: string) => (e: React.MouseEvent) => void;
  onCopy: (message: Message) => void;
  onEditStart: (message: Message) => void;
  onEditCancel: () => void;
  onEditSave: (messageId: string, files?: globalThis.File[], remainingAttachments?: any[]) => void;
  setEditingContent: (content: string) => void;
  chatId: string;
  isLoading: boolean;
  activePanelMessageId?: string | null;
  togglePanel: (messageId: string, type: 'canvas' | 'structuredResponse' | 'attachment', fileIndex?: number, toolType?: string, fileName?: string) => void;
  user: User | null;
  handleFollowUpQuestionClick: (question: string) => Promise<void>;
  hasCanvasData: (message: Message) => boolean;
  isWaitingForToolResults: (message: Message) => boolean;
  shouldShowSpacer: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
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
  activePanelMessageId,
  togglePanel,
  user,
  handleFollowUpQuestionClick,
  hasCanvasData,
  isWaitingForToolResults,
  shouldShowSpacer,
  messagesEndRef
}: MessagesProps) {
  return (
    <div className="messages-container mb-4 flex flex-col">
      <div className="flex-grow">
        {messages.map((message, index) => {
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
          const mathCalculationData = getMathCalculationData(message);
          const linkReaderData = getLinkReaderData(message);
          const imageGeneratorData = getImageGeneratorData(message);
          const academicSearchData = getAcademicSearchData(message);
          const youTubeSearchData = getYouTubeSearchData(message);
          const youTubeLinkAnalysisData = getYouTubeLinkAnalysisData(message);

          return (
            <div key={message.id} className={messageClasses}>
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
                />
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Show immediate loading response after sending message - only when no assistant response yet */}
      {isLoading && messages.length > 0 && messages[messages.length - 1]?.role === 'user' && (
        <div className="mb-0">
          <MessageComponent
            message={{
              id: 'loading-message',
              role: 'assistant',
              content: '',
              createdAt: new Date()
            }}
            currentModel={currentModel}
            isRegenerating={false}
            editingMessageId={null}
            editingContent={''}
            copiedMessageId={null}
            onRegenerate={() => () => {}}
            onCopy={() => {}}
            onEditStart={() => {}}
            onEditCancel={() => {}}
            onEditSave={() => {}}
            setEditingContent={() => {}}
            chatId={chatId}
            isStreaming={true}
            isWaitingForToolResults={true}
            messageHasCanvasData={false}
            activePanelMessageId={activePanelMessageId}
            togglePanel={togglePanel}
            isLastMessage={true}
            webSearchData={null}
            mathCalculationData={null}
            linkReaderData={null}
            imageGeneratorData={null}
            academicSearchData={null}
            youTubeSearchData={null}
            youTubeLinkAnalysisData={null}
            user={user}
            handleFollowUpQuestionClick={handleFollowUpQuestionClick}
            allMessages={messages}
            isGlobalLoading={isLoading}
          />
        </div>
      )}
      
      {/* Reserve space to maintain consistent message positioning */}
      {shouldShowSpacer && (
        <div className="mb-4">
          {/* Space reserved for stable UX */}
        </div>
      )}

      <div ref={messagesEndRef} className="h-px" />
    </div>
  );
} 