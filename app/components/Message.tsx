import type { Message as AIMessage } from 'ai'
import { IconCheck, IconCopy, IconRefresh } from './icons'
import { MarkdownContent } from './MarkdownContent' 
import { ExtendedMessage } from '../chat/[id]/types'
import { Attachment } from '@/lib/types'
import React, { memo, useCallback, useState, useEffect, useMemo, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation';
import { AttachmentPreview } from './Attachment'
import { FileUploadButton } from './ChatInput/FileUpload'; 
import { DragDropOverlay } from './ChatInput/DragDropOverlay'; 
import { 
  getStructuredResponseMainContent, 
  getStructuredResponseDescription, 
  isStructuredResponseInProgress
} from '@/app/lib/messageUtils';
import { ModelNameWithLogo, ModelCapabilityBadges } from './ModelInfo'; 
import { linkifyText } from '../lib/textUtils'
import { UnifiedInfoPanel } from './UnifiedInfoPanel'
import { FilesPreview } from './FilePreview/FilesPreview'
import { EditingFilePreview } from './FilePreview/EditingFilePreview'
import { LinkPreview } from './LinkPreview'
import { formatMessageTime } from '../lib/messageTimeUtils'
import { FollowUpQuestions } from './FollowUpQuestions'
import { User } from '@supabase/supabase-js'


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
  onEditSave: (messageId: string, files?: globalThis.File[], remainingAttachments?: any[]) => void // 브라우저 File 타입 명시
  setEditingContent: (content: string) => void
  chatId?: string
  isStreaming?: boolean
  isWaitingForToolResults?: boolean
  messageHasCanvasData?: boolean
  activePanelMessageId?: string | null
  togglePanel?: (messageId: string, type: 'canvas' | 'structuredResponse' | 'attachment', fileIndex?: number, toolType?: string, fileName?: string) => void
  isLastMessage?: boolean
  webSearchData?: any
  mathCalculationData?: any
  linkReaderData?: any
  imageGeneratorData?: any
  academicSearchData?: any
  xSearchData?: any
  youTubeSearchData?: any
  youTubeLinkAnalysisData?: any
  user?: User | null
  handleFollowUpQuestionClick?: (question: string) => Promise<void>
  allMessages?: AIMessage[]
  isGlobalLoading?: boolean
}

function isReasoningComplete(message: any): boolean {
  // If there are both reasoning and text parts, then reasoning is complete
  if (message.parts) {
    const hasReasoning = message.parts.some((part: any) => part.type === 'reasoning');
    const hasText = message.parts.some((part: any) => part.type === 'text');
    
    // Reasoning is complete if there's both a reasoning part and a text part
    return hasReasoning && hasText;
  }
  
  // Default to false if structure isn't as expected
  return false;
}

interface UserMessageContentProps {
  content: string;
  showGradient?: boolean;
  onClick?: () => void;
  isClickable?: boolean;
}

function UserMessageContent({ 
  content, 
  showGradient, 
  onClick,
  isClickable 
}: UserMessageContentProps) {
  const processedContent = content.split('\\n').map((line, index, array) => (
    <React.Fragment key={index}>
      {linkifyText(line)}
      {index < array.length - 1 && <br />}
    </React.Fragment>
  ));
  
  return (
    <div 
      className={`user-message-content relative ${isClickable ? 'cursor-pointer' : ''}`}
      style={{
        whiteSpace: 'pre-wrap',       
        wordBreak: 'break-word',      
        overflowWrap: 'break-word',   
      }}
      onClick={onClick}
    >
      {processedContent}
      {showGradient && (
        <div 
          className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-[#0B93F6] to-transparent pointer-events-none"
        />
      )}
    </div>
  );
}

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
  chatId,
  isStreaming = false,
  isWaitingForToolResults = false,
  togglePanel,
  isLastMessage,
  webSearchData,
  mathCalculationData,
  linkReaderData,
  imageGeneratorData,
  academicSearchData,
  xSearchData,
  youTubeSearchData,
  youTubeLinkAnalysisData,
  user,
  handleFollowUpQuestionClick,
  allMessages,
  isGlobalLoading,
}: MessageProps) {

  const bubbleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bubbleRef.current) {
      const bubble = bubbleRef.current;
      // Heuristic to detect multi-line.
      // A single line of text with `text-sm` and `leading-relaxed` in Tailwind
      // has a height of about 22-23px. The bubble has 4px vertical padding (total 8px).
      // So a single-line bubble height is around 30-31px.
      // We set a threshold of 35px to reliably distinguish single from multi-line messages.
      if (bubble.clientHeight > 35) {
        bubble.classList.add('multi-line');
      } else {
        bubble.classList.remove('multi-line');
      }
    }
    // Re-run this effect when message content changes or streaming ends.
  }, [message.content, isStreaming]);

  // Bookmark state
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isBookmarkLoading, setIsBookmarkLoading] = useState(false);

  // 편집 모드용 파일 상태 추가
  const [editingFiles, setEditingFiles] = useState<globalThis.File[]>([]);
  const [editingFileMap, setEditingFileMap] = useState<Map<string, { file: globalThis.File, url: string }>>(new Map());
  const [dragActive, setDragActive] = useState(false); // 드래그 상태 추가
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editingContainerRef = useRef<HTMLDivElement>(null); // 편집 컨테이너 참조 추가
  

  
  // Reasoning Part (message.parts) 관련 상태 추가
  const [reasoningPartExpanded, setReasoningPartExpanded] = useState<Record<string, boolean>>({});
  const userOverrideReasoningPartRef = useRef<Record<string, boolean | null>>({});


  
  // Reasoning part state management
  const reasoningPart = message.parts?.find(part => part.type === 'reasoning');
  const reasoningComplete = isReasoningComplete(message);
  const loadingReasoningKey = `${message.id}-reasoning-loading`;
  const completeReasoningKey = `${message.id}-reasoning-complete`;
  
  // Auto-expand/collapse logic for reasoning parts
  useEffect(() => {
    if (reasoningPart) {
      const loadingUserOverride = userOverrideReasoningPartRef.current[loadingReasoningKey];
      const completeUserOverride = userOverrideReasoningPartRef.current[completeReasoningKey];
      
      // Handle loading state reasoning
      if (loadingUserOverride === null || loadingUserOverride === undefined) {
        setReasoningPartExpanded(prev => ({
          ...prev,
          [loadingReasoningKey]: !reasoningComplete
        }));
      }
      
      // Handle complete state reasoning
      if (completeUserOverride === null || completeUserOverride === undefined) {
        setReasoningPartExpanded(prev => ({
          ...prev,
          [completeReasoningKey]: !reasoningComplete
        }));
      }
    }
  }, [reasoningComplete, loadingReasoningKey, completeReasoningKey, reasoningPart]);
  
  // 프리미엄 업그레이드 버튼 클릭 핸들러 (최상위 레벨에 배치)
  const router = useRouter(); // useRouter 사용
  const handleUpgradeClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    router.push('/pricing'); // 주석 해제
  }, [router]); // router 의존성 추가

  // 편집 시작 시 기존 첨부파일들을 편집 상태로 복사
  useEffect(() => {
    if (editingMessageId === message.id && message.experimental_attachments) {
      const attachments = message.experimental_attachments;
      const files: globalThis.File[] = [];
      const fileMap = new Map<string, { file: globalThis.File, url: string }>();

      attachments.forEach((attachment, index) => {
        // Create a File-like object from attachment
        const file = new globalThis.File(
          [new Blob()], // 실제 파일 내용은 필요없고 메타데이터만 유지
          attachment.name || `attachment-${index}`,
          { type: attachment.contentType || 'application/octet-stream' }
        );
        
        // Add unique ID for file tracking
        (file as any).id = `existing-${attachment.url}-${index}`;
        (file as any).isExisting = true;
        (file as any).attachmentData = attachment;

        files.push(file);
        fileMap.set((file as any).id, {
          file,
          url: attachment.url
        });
      });

      setEditingFiles(files);
      setEditingFileMap(fileMap);
    } else if (editingMessageId !== message.id) {
      // 편집이 끝나면 파일 상태 초기화
      setEditingFiles([]);
      setEditingFileMap(new Map());
    }
  }, [editingMessageId, message.id, message.experimental_attachments]);

  // 파일 추가 핸들러
  const handleFileSelect = useCallback(async () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, []);

  // 파일 변경 핸들러
  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    const newFiles: globalThis.File[] = [];
    const newFileMap = new Map(editingFileMap);

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      const fileId = `new-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Add unique ID for tracking
      (file as any).id = fileId;
      (file as any).isExisting = false;

      // Create object URL for preview
      const url = URL.createObjectURL(file);
      
      newFiles.push(file);
      newFileMap.set(fileId, { file, url });
    }

    setEditingFiles(prev => [...prev, ...newFiles]);
    setEditingFileMap(newFileMap);

    // Reset file input
    e.target.value = '';
  }, [editingFileMap]);

  // 드래그&드롭 핸들러들 추가
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (editingContainerRef.current && !editingContainerRef.current.contains(e.relatedTarget as Node)) {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await handleFilesFromDrop(files);
    }
  }, []);

  // 파일 처리 핸들러 (ChatInput의 handleFiles와 유사하게 구현)
  const handleFilesFromDrop = useCallback(async (fileList: FileList) => {
    const newFiles: globalThis.File[] = [];
    const newFileMap = new Map(editingFileMap);

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const fileId = `new-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Add unique ID for tracking
      (file as any).id = fileId;
      (file as any).isExisting = false;

      // Create object URL for preview
      const url = URL.createObjectURL(file);
      
      newFiles.push(file);
      newFileMap.set(fileId, { file, url });
    }

    setEditingFiles(prev => [...prev, ...newFiles]);
    setEditingFileMap(newFileMap);
  }, [editingFileMap]);

  // 파일 제거 핸들러
  const handleRemoveFile = useCallback((fileToRemove: globalThis.File) => {
    const fileId = (fileToRemove as any).id;
    
    setEditingFiles(prev => prev.filter(file => (file as any).id !== fileId));
    
    setEditingFileMap(prev => {
      const newMap = new Map(prev);
      const fileData = newMap.get(fileId);
      
      // Clean up object URL if it's a new file
      if (fileData && !(fileToRemove as any).isExisting) {
        URL.revokeObjectURL(fileData.url);
      }
      
      newMap.delete(fileId);
      return newMap;
    });
  }, []);

  // 편집 저장 핸들러 수정
  const handleEditSave = useCallback(() => {
    // 새로 추가된 파일들만 필터링 (기존 파일은 제외)
    const newFiles = editingFiles.filter(file => !(file as any).isExisting);
    // 기존 파일 중 유지되는 파일들의 첨부파일 데이터 추출
    const remainingExistingAttachments = editingFiles
      .filter(file => (file as any).isExisting)
      .map(file => (file as any).attachmentData)
      .filter(Boolean);
    
    onEditSave(message.id, newFiles, remainingExistingAttachments);
  }, [editingFiles, onEditSave, message.id]);

  // 편집 취소 핸들러 수정
  const handleEditCancel = useCallback(() => {
    // 새로 추가된 파일들의 Object URL 정리
    editingFiles.forEach(file => {
      if (!(file as any).isExisting) {
        const fileId = (file as any).id;
        const fileData = editingFileMap.get(fileId);
        if (fileData) {
          URL.revokeObjectURL(fileData.url);
        }
      }
    });
    
    setEditingFiles([]);
    setEditingFileMap(new Map());
    onEditCancel();
  }, [editingFiles, editingFileMap, onEditCancel]);
  


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

  const isEditing = editingMessageId === message.id;
  const isCopied = copiedMessageId === message.id;
  const isAssistant = message.role === 'assistant';
  const isUser = message.role === 'user';
  const hasAttachments = message.experimental_attachments && message.experimental_attachments.length > 0;
  const hasContent = message.content && message.content.trim().length > 0;
  
  const hasActualCanvasData = useMemo(() => {
    return !!(
      webSearchData ||
      mathCalculationData ||
      linkReaderData ||
      imageGeneratorData ||
      academicSearchData ||
      xSearchData ||
      youTubeSearchData ||
      youTubeLinkAnalysisData
    );
  }, [
    webSearchData,
    mathCalculationData,
    linkReaderData,
    imageGeneratorData,
    academicSearchData,
    xSearchData,
    youTubeSearchData,
    youTubeLinkAnalysisData
  ]);

  const structuredMainResponse = useMemo(() => getStructuredResponseMainContent(message), [message]);
  const structuredDescription = useMemo(() => getStructuredResponseDescription(message), [message]);
  
  // 구조화된 응답이 진행 중인지 여부를 useMemo로 관리
  const isInProgress = useMemo(() => isStructuredResponseInProgress(message), [message]);

  const hasStructuredData = useMemo(() => {
    // 메인 응답 내용이 있거나, 구조화된 응답이 진행 중일 때 true
    return !!(structuredMainResponse || isInProgress);
  }, [structuredMainResponse, isInProgress]);

  const isFileGenerationRelated = hasStructuredData || isStructuredResponseInProgress(message);

  const hasAnyContent = hasContent || structuredMainResponse || isInProgress; // hasAnyContent도 진행 중 상태 고려

  // Check if message is bookmarked when component mounts
  useEffect(() => {
    if (!user || !isAssistant || !message.id) return;
    
    const checkBookmarkStatus = async () => {
      try {
        const supabase = createClient(); // supabase client 생성
        const { data, error } = await supabase
          .from('message_bookmarks')
          .select('id')
          .eq('message_id', message.id)
          .eq('user_id', user.id)
          .maybeSingle();
          
        if (!error && data) {
          setIsBookmarked(true);
        }
      } catch (error) {
        console.error('Error checking bookmark status:', error);
      }
    };
    
    checkBookmarkStatus();
  }, [user, message.id, isAssistant]); // supabase 의존성 제거 (함수 내부에서 생성)

  // 마지막 어시스턴트 메시지인지 확인
  const isLastAssistantMessage = isLastMessage && message.role === 'assistant';

  // 모바일 여부 확인
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 640); // sm breakpoint
    };
    
    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);
    return () => window.removeEventListener('resize', checkIfMobile);
  }, []);

  // 메시지가 긴지 또는 파일이 있는지 확인
  const isLongOrHasFiles = useMemo(() => {
    // 파일이 있는 경우
    if (hasAttachments) return true;
    
    // 메시지가 긴 경우 (300자 이상)
    if (hasContent && message.content.length > 300) return true;
    
    return false;
  }, [hasAttachments, hasContent, message.content]);

  // 조건에 따른 최소 높이 계산
  const getMinHeight = useMemo(() => {
    if (!isLastAssistantMessage) return '';
    
    if (isMobile) {
      return isLongOrHasFiles ? 'min-h-[calc(100vh-16rem)]' : 'min-h-[calc(100vh-24rem)]';
    } else {
      // 데스크탑은 항상 32rem으로 통일
      return 'min-h-[calc(100vh-32rem)]';
    }
  }, [isLastAssistantMessage, isLongOrHasFiles, isMobile]);

  // Toggle bookmark function
  const toggleBookmark = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!user || !message.id || !chatId || isBookmarkLoading) return;
    
    setIsBookmarkLoading(true);
    
    try {
      if (isBookmarked) {
        // Remove bookmark
        const supabase = createClient(); // supabase client 생성
        const { error } = await supabase
          .from('message_bookmarks')
          .delete()
          .eq('message_id', message.id)
          .eq('user_id', user.id);
          
        if (error) throw error;
        setIsBookmarked(false);
      } else {
        // Add bookmark
        const supabase = createClient(); // supabase client 생성
        const { error } = await supabase
          .from('message_bookmarks')
          .insert({
            message_id: message.id,
            user_id: user.id,
            chat_session_id: chatId,
            content: message.content,
            model: (message as ExtendedMessage).model || currentModel,
            created_at: new Date().toISOString()
          });
          
        if (error) throw error;
        setIsBookmarked(true);
      }
    } catch (error) {
      console.error('Error toggling bookmark:', error);
    } finally {
      setIsBookmarkLoading(false);
    }
  };

  const hasTextContent = useMemo(() => {
    if (message.content) return true;
    if (message.parts?.some(p => p.type === 'text' && p.text)) return true;
    return false;
  }, [message]);

  const hasAnyRenderableContent = useMemo(() => {
    if (message.content) return true;
    if (message.parts?.some(p => p.type === 'text' && p.text)) return true;
    if (structuredDescription) return true;
    if (hasAttachments) return true;
    if (hasActualCanvasData) return true;
    return false;
  }, [message, structuredDescription, hasAttachments, hasActualCanvasData]);

  return (
    <div className={`message-group group animate-fade-in ${getMinHeight}`} id={message.id}>
      <UnifiedInfoPanel
        reasoningPart={reasoningPart}
        isAssistant={isAssistant}
        hasAnyContent={hasAnyContent}
        isWaitingForToolResults={isWaitingForToolResults}
        isStreaming={isStreaming}
        reasoningComplete={reasoningComplete}
        reasoningPartExpanded={reasoningPartExpanded}
        setReasoningPartExpanded={setReasoningPartExpanded}
        userOverrideReasoningPartRef={userOverrideReasoningPartRef}
        loadingReasoningKey={loadingReasoningKey}
        completeReasoningKey={completeReasoningKey}
        hasActualCanvasData={hasActualCanvasData}
        webSearchData={webSearchData}
        mathCalculationData={mathCalculationData}
        linkReaderData={linkReaderData}
        imageGeneratorData={imageGeneratorData}
        academicSearchData={academicSearchData}
        xSearchData={xSearchData}
        youTubeSearchData={youTubeSearchData}
        youTubeLinkAnalysisData={youTubeLinkAnalysisData}
        messageId={message.id}
        togglePanel={togglePanel}
      />
      <div className={`flex ${isUser ? `justify-end` : `justify-start ${!isEditing ? 'pl-2' : ''}`}`}>
        {isUser && !isEditing ? (
          <div className="flex flex-col items-end gap-1">
            {hasAttachments && message.experimental_attachments!.map((attachment, index) => (
              <AttachmentPreview 
                key={`${message.id}-att-${index}`} 
                attachment={attachment} 
                messageId={message.id}
                attachmentIndex={index}
                togglePanel={togglePanel}
              />
            ))}
            {hasContent && (() => {
              const urlRegex = /(https?:\/\/[^\s]+)/g;
              const urls = message.content.match(urlRegex) || [];
              
              return urls.map((url, index) => (
                <LinkPreview key={`${message.id}-url-${index}`} url={url} />
              ));
            })()}
            {hasContent && (
              <div className="imessage-send-bubble" ref={bubbleRef}>
                <UserMessageContent content={message.content} />
              </div>
            )}
            <div className="text-xs text-neutral-500 mt-1 pr-1">
              {formatMessageTime((message as any).createdAt || new Date())}
            </div>
          </div>
        ) : isUser && isEditing ? (
          <div 
            className="w-full max-w-4xl mx-auto relative animate-edit-in-view"
            ref={editingContainerRef}
            onDragEnter={handleDrag}
            onDragLeave={handleDragLeave}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <div className="bg-[var(--background)] border border-[var(--accent)] rounded-lg p-4 flex flex-col gap-4">
              
              {/* 파일 미리보기 영역 */}
              {editingFiles.length > 0 && (
                <EditingFilePreview 
                  files={editingFiles}
                  fileMap={editingFileMap}
                  removeFile={handleRemoveFile}
                />
              )}

              {/* 자동 높이 조절 Textarea */}
              <textarea
                value={editingContent}
                onChange={(e) => {
                    setEditingContent(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = `${e.target.scrollHeight}px`;
                }}
                onFocus={(e) => {
                    e.target.style.height = 'auto';
                    e.target.style.height = `${e.target.scrollHeight}px`;
                    const len = e.target.value.length;
                    e.target.setSelectionRange(len, len);
                }}
                ref={(textarea) => {
                  if (textarea) {
                      setTimeout(() => {
                        textarea.style.height = 'auto';
                        textarea.style.height = `${textarea.scrollHeight}px`;
                      }, 0);
                    }
                }}
                className="w-full min-h-[120px] p-3 rounded-lg bg-[var(--accent)] text-[var(--foreground)] resize-none focus:outline-none"
                placeholder="Edit your message..."
                autoFocus
              />
              
              {/* 액션 버튼 및 파일 업로드 */}
              <div className="flex items-center justify-between">
                {/* 좌측: 파일 업로드 */}
                <div className="flex items-center gap-2">
                  <FileUploadButton 
                    filesCount={editingFiles.length}
                    onClick={handleFileSelect}
                  />
                  <input
                    ref={fileInputRef}
                        type="file"
                    multiple
                        onChange={handleFileChange}
                        className="hidden"
                        accept="image/*,video/*,audio/*,text/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.7z,.tar,.gz"
                  />
                  <span className="text-xs text-[var(--muted)]">
                        or drag and drop files here
                  </span>
                </div>
                
                {/* 우측: 취소/저장 버튼 */}
                <div className="flex justify-end gap-2">
                <button
                    onClick={handleEditCancel}
                        className="px-4 py-2 text-sm border border-[var(--accent)] text-[var(--muted)] rounded-lg hover:bg-[var(--accent)] transition-colors"
                >
                  Cancel
                </button>
                <button
                    onClick={handleEditSave}
                        className="px-4 py-2 text-sm bg-[var(--accent)] text-[var(--foreground)] rounded-lg hover:opacity-80 transition-opacity"
                >
                        Save
                </button>
                </div>
              </div>
            </div>

            {/* 드래그 앤 드롭 오버레이 */}
            {dragActive && (
              <DragDropOverlay 
                dragActive={dragActive}
                supportsPDFs={true}
              />
            )}
          </div>
        ) : (
          <>
          {(hasAnyContent || structuredDescription) && (
            <div className="imessage-receive-bubble max-w-full" ref={bubbleRef}>
              <div className="imessage-content-wrapper">
                {/* 기존 컨텐츠 렌더링 로직 */}
              {hasAttachments && message.experimental_attachments!.map((attachment, index) => (
                <AttachmentPreview key={`${message.id}-att-${index}`} attachment={attachment} />
              ))}
            
            {message.parts ? (
                  message.parts.map((part, index) => (
                    part.type === 'text' && <MarkdownContent key={index} content={part.text} enableSegmentation={isAssistant && !isFileGenerationRelated} />
                  ))
                        ) : (
                    (hasContent && !hasStructuredData) && <MarkdownContent content={message.content} enableSegmentation={isAssistant && !isFileGenerationRelated} />
                  )}
                  
                  <FilesPreview
                    messageId={message.id}
                    togglePanel={togglePanel}
                    message={message}
                  />

              {structuredDescription && (
                    <div className="imessage-receive-bubble mt-2">
                  <p className="text-sm">{structuredDescription}</p>
                </div>
            )}
          </div>
          </div>
          )}
        </>
      )}
    </div>
    {isAssistant && !isStreaming && (
      <div className="flex justify-start pl-2 mt-2 gap-4 items-center opacity-100 transition-opacity duration-300">
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
        <button
          onClick={toggleBookmark}
          className={`text-xs transition-colors flex items-center gap-2 ${ 
            isBookmarked ? 'text-blue-500' : 'text-[var(--muted)] hover:text-[var(--foreground)]'
          } ${isBookmarkLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          title={isBookmarked ? "Remove bookmark" : "Bookmark message"}
          disabled={isBookmarkLoading}
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width="12" 
            height="12" 
            viewBox="0 0 24 24" 
            fill={isBookmarked ? "currentColor" : "none"}
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
            className={isBookmarkLoading ? "animate-pulse" : ""}
          >
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
          </svg>
        </button>
        
        {/* Model capability badges first */}
        <ModelCapabilityBadges modelId={(message as ExtendedMessage).model || currentModel} />
        
        {/* Then model name with logo */}
        <ModelNameWithLogo modelId={(message as ExtendedMessage).model || currentModel} />
        
        {/* Canvas 버튼 제거됨 */}
      </div>
    )}
    {isUser && (
      <div className="flex justify-end mt-2 gap-4 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300">
        <button
          onClick={() => onEditStart(message)}
          className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors flex items-center gap-2"
          title="Edit message"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
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

    {/* Add follow-up questions for the last assistant message */}
    {isAssistant && isLastMessage && !isGlobalLoading && !isStreaming && user && handleFollowUpQuestionClick && allMessages && chatId && (
      <div className="mt-4 sm:mt-6 pl-2">
        <FollowUpQuestions 
          chatId={chatId} 
          userId={user.id} 
          messages={allMessages} 
          onQuestionClick={handleFollowUpQuestionClick} 
        />
      </div>
    )}

    {/* 최종 로딩 표시: 스트리밍 중인 마지막 메시지에만 표시 */}
    {isAssistant && isStreaming && isLastMessage && (
      <div className="flex justify-start pl-2 mt-2">
        {hasAnyRenderableContent ? (
          // 컨텐츠가 있으면 버블 없는 로딩 dots
          <div className="loading-dots text-sm inline-block ml-1">
            <span>.</span>
            <span>.</span>
            <span>.</span>
          </div>
        ) : (
          // 컨텐츠가 없으면 로딩 버블 (작은 크기)
          <div className="imessage-receive-bubble" style={{ 
            width: 'fit-content', 
            minWidth: 'auto',
            padding: '8px 12px',
            minHeight: 'auto'
          }}>
            <div className="loading-dots text-sm inline-block">
              <span>.</span>
              <span>.</span>
              <span>.</span>
            </div>
          </div>
        )}
      </div>
    )}
  </div>
)
});


export { Message }; 
