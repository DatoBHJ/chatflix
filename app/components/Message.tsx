import type { Message as AIMessage } from 'ai'
import { IconCheck, IconCopy, IconRefresh } from './icons'
import { ReasoningSection } from './ReasoningSection'
import { MarkdownContent } from './MarkdownContent'
import { ExtendedMessage } from '../chat/[id]/types'
import { getModelById } from '@/lib/models/config'
import { Attachment } from '@/lib/types'
import React, { memo, useCallback, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useUser } from '@/app/lib/UserContext'


interface MessageProps {
  message: AIMessage & { experimental_attachments?: Attachment[] }
  currentModel: string
  isRegenerating: boolean
  editingMessageId: string | null
  editingContent: string
  copiedMessageId: string | null
  onRegenerate: (messageId: string) => (e: React.MouseEvent) => void
  onCopy: (message: AIMessage) => void
  onEditStart: (message: AIMessage) => void
  onEditCancel: () => void
  onEditSave: (messageId: string) => void
  setEditingContent: (content: string) => void
  userName?: string
  profileImage?: string | null
}

// Create a memoized Message component to prevent unnecessary re-renders
const Message = memo(function MessageComponent({
  message,
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
  userName: propUserName,
  profileImage: propProfileImage
}: MessageProps) {
  const router = useRouter();
  // Context에서 사용자 정보 가져오기
  const { userName: contextUserName, profileImage: contextProfileImage } = useUser();
  
  // Props와 Context 중 우선순위를 결정하여 최종 값 설정
  const userName = propUserName || contextUserName;
  const profileImage = propProfileImage || contextProfileImage;
  
  // Function to truncate long messages
  const truncateMessage = useCallback((content: string, maxLength: number = 300) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + ' ';
  }, []);

  // State to track which messages are expanded
  const [expandedMessages, setExpandedMessages] = useState<Record<string, boolean>>({});

  // Function to toggle message expansion
  const toggleMessageExpansion = useCallback((messageId: string) => {
    setExpandedMessages(prev => ({
      ...prev,
      [messageId]: !prev[messageId]
    }));
  }, []);
  
  // Navigate to user insights page
  const goToUserInsights = useCallback(() => {
    router.push('/user-insights');
  }, [router]);

  const isEditing = editingMessageId === message.id;
  const isCopied = copiedMessageId === message.id;
  const isAssistant = message.role === 'assistant';
  const isUser = message.role === 'user';
  const hasAttachments = message.experimental_attachments && message.experimental_attachments.length > 0;
  const hasContent = message.content && message.content.trim().length > 0;

  // 어시스턴트 메시지이고 내용이 없으면 렌더링하지 않음
  if (isAssistant && !hasContent) {
    return null;
  }

  return (
    <div className="message-group group animate-fade-in overflow-hidden">
      <div className={`message-role ${isUser ? 'text-right' : ''}`}>
        {isAssistant ? (
          <div className="inline-flex items-center gap-2">
            <div className="w-5 h-5 rounded-full overflow-hidden relative inline-block align-middle">
              <Image 
                src="/favicon-32x32.png" 
                alt="Chatflix" 
                width={20}
                height={20}
                className="object-cover"
              />
            </div>
            <span>Chatflix.app</span>
          </div>
        ) : (
          <div 
            className="inline-flex items-center gap-2 cursor-pointer hover:opacity-80"
            onClick={goToUserInsights}
            title="View your AI Recap"
          >
            {profileImage ? (
              <div className="w-5 h-5 rounded-full overflow-hidden relative inline-block align-middle">
                <Image 
                  src={profileImage} 
                  alt={userName} 
                  fill 
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="w-5 h-5 rounded-full bg-[var(--foreground)] text-[var(--background)] inline-flex items-center justify-center text-xs font-medium">
                {userName.charAt(0).toUpperCase()}
              </div>
            )}
            <span>{userName}</span>
          </div>
        )}
      </div>
      <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
        <div className={`${isUser ? 'message-user' : 'message-assistant'} max-w-full overflow-x-auto ${
          isEditing ? 'w-full' : ''
        }`}>
          {isEditing ? (
            <div className="flex flex-col gap-2 w-full">
              <textarea
                value={editingContent}
                onChange={(e) => {
                  setEditingContent(e.target.value)
                  e.target.style.height = 'auto'
                  e.target.style.height = `${e.target.scrollHeight}px`
                }}
                ref={(textarea) => {
                  if (textarea) {
                    textarea.style.height = 'auto'
                    textarea.style.height = `${textarea.scrollHeight}px`
                  }
                }}
                onFocus={(e) => {
                  e.target.style.height = 'auto'
                  e.target.style.height = `${e.target.scrollHeight}px`
                }}
                className="w-full min-h-[100px] p-4 
                         bg-[var(--foreground)] text-[var(--background)]
                         resize-none overflow-hidden transition-all duration-200
                         focus:outline-none border-none outline-none ring-0
                         placeholder-[var(--background-80)]"
                style={{
                  height: 'auto',
                  minHeight: '100px',
                  caretColor: 'var(--background)'
                }}
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={onEditCancel}
                  className="px-4 py-2 text-sm
                           bg-[var(--foreground)] text-[var(--background)]
                           hover:opacity-80 transition-opacity duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={() => onEditSave(message.id)}
                  className="px-4 py-2 text-sm
                           bg-[var(--foreground)] text-[var(--background)]
                           hover:opacity-80 transition-opacity duration-200"
                >
                  Send
                </button>
              </div>
            </div>
          ) : (
            <>
              {hasAttachments && (
                <AttachmentPreview attachments={message.experimental_attachments!} messageId={message.id} />
              )}
              {message.parts ? (
                <>
                  {message.parts.map((part, index) => {
                    if (part.type === 'reasoning') {
                      return <ReasoningSection key={index} content={part.reasoning} />
                    }
                    if (part.type === 'text') {
                      const shouldTruncate = isUser && !isEditing && !expandedMessages[message.id];
                      const isLongMessage = part.text.length > 300;
                      
                      return (
                        <React.Fragment key={index}>
                          <MarkdownContent content={shouldTruncate ? truncateMessage(part.text) : part.text} />
                          {shouldTruncate && isLongMessage && (
                            <div 
                              onClick={() => toggleMessageExpansion(message.id)}
                              className="text-[var(--muted)] font-medium mt-4 cursor-pointer hover:underline inline-block"
                            >
                              ... Read more
                            </div>
                          )}
                          {!shouldTruncate && isLongMessage && expandedMessages[message.id] && (
                            <div 
                              onClick={() => toggleMessageExpansion(message.id)}
                              className="text-[var(--muted)] font-medium mt-4 cursor-pointer hover:underline inline-block"
                            >
                              Show less
                            </div>
                          )}
                        </React.Fragment>
                      );
                    }
                    return null;
                  })}
                </>
              ) : (
                <>
                  <MarkdownContent content={isUser && !isEditing && !expandedMessages[message.id] ? truncateMessage(message.content) : message.content} />
                  {isUser && !isEditing && message.content.length > 300 && (
                    <div 
                      onClick={() => toggleMessageExpansion(message.id)}
                      className="text-[var(--accent)] font-medium mt-1 cursor-pointer hover:underline inline-block"
                    >
                      {expandedMessages[message.id] ? 'Show less' : '... Read more'}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
      {isAssistant ? (
        <div className="flex justify-start pl-1 mt-2 gap-4">
          <button 
            onClick={onRegenerate(message.id)}
            disabled={isRegenerating}
            className={`text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors flex items-center gap-2 ${
              isRegenerating ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            title="Regenerate response"
          >
            <IconRefresh className={`w-3 h-3 ${isRegenerating ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => onCopy(message)}
            className={`text-xs hover:text-[var(--foreground)] transition-colors flex items-center gap-2 ${
              isCopied ? 'text-green-500' : 'text-[var(--muted)]'
            }`}
            title={isCopied ? "Copied!" : "Copy message"}
          >
            {isCopied ? (
              <IconCheck className="w-3 h-3" />
            ) : (
              <IconCopy className="w-3 h-3" />
            )}
          </button>
          <div className="text-xs text-[var(--muted)] uppercase tracking-wider">
            {getModelById((message as ExtendedMessage).model || currentModel)?.name || 
             ((message as ExtendedMessage).model || currentModel)}
          </div>
        </div>
      ) : (
        <div className="flex justify-end pr-1 mt-2 gap-4">
          <button
            onClick={() => onEditStart(message)}
            className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors flex items-center gap-2"
            title="Edit message"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          <button
            onClick={() => onCopy(message)}
            className={`text-xs hover:text-[var(--foreground)] transition-colors flex items-center gap-2 ${
              isCopied ? 'text-green-500' : 'text-[var(--muted)]'
            }`}
            title={isCopied ? "Copied!" : "Copy message"}
          >
            {isCopied ? (
              <IconCheck className="w-3 h-3" />
            ) : (
              <IconCopy className="w-3 h-3" />
            )}
          </button>
        </div>
      )}
    </div>
  )
});

interface AttachmentPreviewProps {
  attachments: Attachment[]
  messageId: string
}

// Memoize the AttachmentPreview component
const AttachmentPreview = memo(function AttachmentPreviewComponent({ attachments, messageId }: AttachmentPreviewProps) {
  return (
    <div className="flex flex-wrap gap-2 mb-2">
      {attachments.map((attachment, index) => {
        const isImage = attachment.contentType?.startsWith('image/') || false
        const isPdf = attachment.contentType === 'application/pdf' || 
                     (attachment.name && attachment.name.toLowerCase().endsWith('.pdf'))
        const isCode = attachment.contentType?.includes('text') || 
                     (attachment.name && /\.(js|jsx|ts|tsx|html|css|json|md|py|java|c|cpp|cs|go|rb|php|swift|kt|rs)$/i.test(attachment.name))
        
        const getTypeBadge = () => {
          if (isImage && attachment.contentType) {
            return attachment.contentType.split('/')[1].toUpperCase()
          }
          if (attachment.name) {
            const ext = attachment.name.split('.').pop()
            return ext ? ext.toUpperCase() : 'FILE'
          }
          return 'FILE'
        }
        
        return isImage ? (
          <div 
            key={`${messageId}-${index}`} 
            className="relative group image-preview-item cursor-pointer"
            onClick={() => window.open(attachment.url, '_blank')}
          >
            <span className="file-type-badge">
              {getTypeBadge()}
            </span>
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </div>
            <img 
              src={attachment.url} 
              alt={attachment.name || `Image ${index + 1}`}
              className="max-w-[200px] max-h-[200px] rounded-lg object-cover"
            />
          </div>
        ) : (
          <div 
            key={`${messageId}-${index}`} 
            className="relative group file-preview-item cursor-pointer"
            onClick={() => window.open(attachment.url, '_blank')}
          >
            <span className="file-type-badge">
              {getTypeBadge()}
            </span>
            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </div>
            <div className="file-icon">
              {isCode ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="16 18 22 12 16 6"></polyline>
                  <polyline points="8 6 2 12 8 18"></polyline>
                </svg>
              ) : isPdf ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                  <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                  <polyline points="13 2 13 9 20 9"></polyline>
                </svg>
              )}
            </div>
            <div className="file-name">{attachment.name || `File ${index + 1}`}</div>
          </div>
        )
      })}
    </div>
  )
});

export { Message }; 