import { MarkdownContent } from './MarkdownContent' 
import { ExtendedMessage } from '../chat/[id]/types'
import { Attachment } from '@/lib/types'
import React, { memo, useCallback, useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'

import { AttachmentPreview } from './Attachment'
import { DragDropOverlay } from './ChatInput/DragDropOverlay'; 
import { 
  getStructuredResponseMainContent, 
  getStructuredResponseDescription, 
  getStructuredResponseTitle,
  isStructuredResponseInProgress
} from '@/app/lib/messageUtils';
import { ModelNameWithLogo, ModelCapabilityBadges } from './ModelInfo'; 
import { linkifyText } from '../lib/textUtils'
import { highlightSearchTermInChildren } from '@/app/utils/searchHighlight'
import { UnifiedInfoPanel } from './UnifiedInfoPanel'
import { FilesPreview } from './FilePreview/FilesPreview'
import { EditingFilePreview } from './FilePreview/EditingFilePreview'
import { LinkPreview } from './LinkPreview'
import { formatMessageTime } from '../lib/messageTimeUtils'
import { FollowUpQuestions } from './FollowUpQuestions'
import { User } from '@supabase/supabase-js'
import { getModelById } from '../../lib/models/config';
import { getChatInputTranslations } from '@/app/lib/chatInputTranslations';
import { TypingIndicator } from './TypingIndicator';


interface MessageProps {
  message: any & { experimental_attachments?: Attachment[] }
  currentModel: string
  isRegenerating: boolean
  editingMessageId: string | null
  editingContent: string
  copiedMessageId: string | null
  onRegenerate: (messageId: string) => (e: React.MouseEvent) => void
  onCopy: (message: any) => void
  onEditStart: (message: any) => void
  onEditCancel: () => void
  onEditSave: (messageId: string, files?: globalThis.File[], remainingAttachments?: any[]) => void // 브라우저 File 타입 명시
  setEditingContent: (content: string) => void
  chatId?: string
  isStreaming?: boolean
  isWaitingForToolResults?: boolean
  messageHasCanvasData?: boolean
  activePanelMessageId?: string | null
  activePanel?: { messageId: string; type: string; toolType?: string } | null
  togglePanel?: (messageId: string, type: 'canvas' | 'structuredResponse' | 'attachment', fileIndex?: number, toolType?: string, fileName?: string) => void
  isLastMessage?: boolean
  webSearchData?: any
  mathCalculationData?: any
  linkReaderData?: any
  imageGeneratorData?: any

  xSearchData?: any
  youTubeSearchData?: any
  youTubeLinkAnalysisData?: any
  user?: User | null
  handleFollowUpQuestionClick?: (question: string) => Promise<void>
  allMessages?: any[]
  isGlobalLoading?: boolean
  imageMap?: { [key: string]: string }
  isBookmarked?: boolean
  onBookmarkToggle?: (messageId: string, shouldBookmark: boolean) => Promise<void>
  isBookmarksLoading?: boolean
  searchTerm?: string | null // 🚀 FEATURE: Search term for highlighting
}

function isReasoningComplete(message: any, isStreaming: boolean): boolean {
  if (message.parts) {
    const reasoningPart = message.parts.find((part: any) => part.type === 'reasoning');
    
    if (!reasoningPart) {
      return false;
    }
    
    const reasoningText = reasoningPart.reasoningText || reasoningPart.text || '';
    
    // 텍스트 응답이 시작되었으면 reasoning 완료
    const hasTextStarted = message.parts.some((part: any) => 
      part.type === 'text' && (part.text || '').trim().length > 0
    );
    
    if (hasTextStarted) {
      return true;
    }
    
    // 스트리밍이 끝났고 reasoning 내용이 충분하면 완료
    return !isStreaming && reasoningText.trim().length > 20;
  }
  
  return false;
}

interface UserMessageContentProps {
  content: string;
  showGradient?: boolean;
  onClick?: () => void;
  isClickable?: boolean;
  searchTerm?: string | null;
}

function UserMessageContent({ 
  content, 
  showGradient, 
  onClick,
  isClickable,
  searchTerm
}: UserMessageContentProps) {
  // content가 undefined이거나 빈 문자열일 때 안전하게 처리
  const safeContent = content || '';
  const processedContent = safeContent.split('\\n').map((line, index, array) => (
    <React.Fragment key={index}>
      {highlightSearchTermInChildren(linkifyText(line), searchTerm || null, { messageType: 'user' })}
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
  activePanel,
  togglePanel,
  isLastMessage,
  webSearchData,
  mathCalculationData,
  linkReaderData,
  imageGeneratorData,

  xSearchData,
  youTubeSearchData,
  youTubeLinkAnalysisData,
  user,
  handleFollowUpQuestionClick,
  allMessages,
  isGlobalLoading,
  imageMap = {},
  isBookmarked,
  onBookmarkToggle,
  isBookmarksLoading,
  searchTerm, // 🚀 FEATURE: Search term for highlighting
}: MessageProps) {

  // Pre-compiled regex for better performance
  const IMAGE_ID_REGEX = useMemo(() => /\[IMAGE_ID:([^\]]+)\]/g, []);

  // Memoized function to replace image placeholders with actual URLs - AI SDK v5 호환
  const processedContent = useMemo(() => {
    // 1. message.content가 있으면 우선 사용
    let content = message.content;
    
    // 2. message.content가 없으면 parts에서 텍스트 추출
    if (!content && message.parts && Array.isArray(message.parts)) {
      const textParts = message.parts.filter((part: any) => part.type === 'text');
      content = textParts.map((part: any) => part.text || '').join('\n');
    }
    
    if (!content) return content;
    
    // Quick check: if no placeholder exists, return original content immediately
    if (!content.includes('[IMAGE_ID:')) {
      return content;
    }
    
    // Process placeholders only when necessary
    return content.replace(IMAGE_ID_REGEX, (match: string, imageId: string) => {
      // Only show image if imageMap exists AND has the specific URL
      if (imageMap && Object.keys(imageMap).length > 0) {
        const imageUrl = imageMap[imageId];
        if (imageUrl) {
          // Use empty alt text for clean display
          return `![](${imageUrl})`;
        }
      }
      // Remove placeholder completely in all other cases
      return '';
    });
  }, [message.content, message.parts, imageMap, IMAGE_ID_REGEX]);

  // Memoized function for parts processing
  const processedParts = useMemo(() => {
    if (!message.parts) return null;
    
    return message.parts.map((part: any) => {
      if (part.type === 'text' && part.text) {
        // Quick check for performance
        if (!part.text.includes('[IMAGE_ID:')) {
          return part;
        }
        
        return {
          ...part,
          text: part.text.replace(IMAGE_ID_REGEX, (match: string, imageId: string) => {
            if (imageMap && Object.keys(imageMap).length > 0) {
              const imageUrl = imageMap[imageId];
              if (imageUrl) {
                return `![](${imageUrl})`;
              }
            }
            return '';
          })
        };
      }
      return part;
    });
  }, [message.parts, imageMap, IMAGE_ID_REGEX]);

  const bubbleRef = useRef<HTMLDivElement>(null);
  const aiBubbleRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [containerMinHeight, setContainerMinHeight] = useState<string | number>('auto');
  const viewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bubbleRef.current) {
      const bubble = bubbleRef.current;
      // Heuristic to detect multi-line.
      // A single line of text with `text-sm` and `leading-relaxed` in Tailwind
      // has a height of about 22-23px. The bubble has 5px vertical padding (total 10px).
      // So a single-line bubble height is around 32-33px.
      // We set a threshold of 36px to reliably distinguish single from multi-line messages.
      if (bubble.clientHeight > 36) {
        bubble.classList.add('multi-line');
      } else {
        bubble.classList.remove('multi-line');
      }
    }
    
    // AI message multi-line detection
    if (aiBubbleRef.current) {
      const bubble = aiBubbleRef.current;
      if (bubble.clientHeight > 36) {
        bubble.classList.add('multi-line');
      } else {
        bubble.classList.remove('multi-line');
      }
    }
    // Re-run this effect when message content changes or streaming ends.
  }, [message.content, isStreaming]);

  // Apply multi-line detection to segments
  useEffect(() => {
    const segments = document.querySelectorAll('.message-segment');
    segments.forEach((segment) => {
      if (segment.clientHeight > 36) {
        segment.classList.add('multi-line');
      } else {
        segment.classList.remove('multi-line');
      }
    });
  }, [message.content, isStreaming]);

  // Bookmark state - now managed by parent component

  // 편집 모드용 파일 상태 추가
  const [editingFiles, setEditingFiles] = useState<globalThis.File[]>([]);
  const [editingFileMap, setEditingFileMap] = useState<Map<string, { file: globalThis.File, url: string }>>(new Map());
  const [dragActive, setDragActive] = useState(false); // 드래그 상태 추가
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editingContainerRef = useRef<HTMLDivElement>(null); // 편집 컨테이너 참조 추가
  

  
  // Reasoning Part (message.parts) 관련 상태 추가
  const [reasoningPartExpanded, setReasoningPartExpanded] = useState<Record<string, boolean>>({});
  const userOverrideReasoningPartRef = useRef<Record<string, boolean | null>>({});


  
  const handleEditStartClick = () => {
    if (viewRef.current) {
      const originalHeight = viewRef.current.offsetHeight;
      const maxHeight = window.innerHeight * 0.8; // Cap at 80% of viewport height
      setContainerMinHeight(Math.min(originalHeight, maxHeight));
    }
    onEditStart(message);
  };

  // Reasoning part state management
  const reasoningPart = message.parts?.find((part: any) => part.type === 'reasoning');
  const reasoningComplete = isReasoningComplete(message, isStreaming);
  const loadingReasoningKey = `${message.id}-reasoning-loading`;
  const completeReasoningKey = `${message.id}-reasoning-complete`;
  
  const hasReasoningPart = !!reasoningPart;
  
  // Reasoning 진행 상태 감지
  const isReasoningInProgress = useMemo(() => {
    if (!hasReasoningPart) return false;
    
    // 스트리밍 중이고 텍스트가 아직 시작되지 않았으면 reasoning 진행 중
    if (isStreaming && hasReasoningPart) {
      const hasTextStarted = message.parts?.some((part: any) => 
        part.type === 'text' && (part.text || '').trim().length > 0
      );
      return !hasTextStarted;
    }
    
    return !reasoningComplete;
  }, [hasReasoningPart, isStreaming, reasoningComplete, message.parts]);
  
  // Auto-expand/collapse logic for reasoning parts
  useEffect(() => {
    if (!reasoningPart) return;
    setReasoningPartExpanded(prev => {
      const next = { ...prev } as Record<string, boolean>;
      // Initialize keys only once to avoid update loops
      if (next[loadingReasoningKey] === undefined) {
        next[loadingReasoningKey] = !reasoningComplete;
      }
      if (next[completeReasoningKey] === undefined) {
        next[completeReasoningKey] = !reasoningComplete;
      }
      return next;
    });
  }, [reasoningPart, reasoningComplete, loadingReasoningKey, completeReasoningKey]);
  
  // 프리미엄 업그레이드 버튼 클릭 핸들러 (최상위 레벨에 배치)
  // const router = useRouter(); // useRouter 사용
  const handleUpgradeClick = async () => {
    if (!user) {
        window.location.href = '/login';
        return;
    }

    if (!user.id || !user.email) {
        alert('Your account information is incomplete. Please log out and sign in again.');
        return;
    }

    try {
        const response = await fetch('/api/subscription/checkout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: user.user_metadata?.full_name || (user.email ? user.email.split('@')[0] : 'User')
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to create checkout session');
        }

        if (data.checkout && data.checkout.url) {
            window.location.href = data.checkout.url;
        } else {
            throw new Error('Invalid checkout response');
        }
    } catch (error) {
        console.error('Error creating checkout session:', error);
        alert('Failed to create checkout session. Please try again.');
    }
  };

  // AI SDK 5: parts 배열에서 첨부파일 추출하거나 기존 experimental_attachments 사용
  const attachmentsFromParts = useMemo(() => {
    if (message.parts && Array.isArray(message.parts)) {
      return message.parts
        .filter((part: any) => part.type === 'image' || part.type === 'file')
        .map((part: any, index: number) => {
          if (part.type === 'image') {
            return {
              name: `image-${index}`,
              contentType: 'image/jpeg',
              url: part.image,
              fileType: 'image' as const
            };
          } else if (part.type === 'file') {
            return {
              name: part.filename || `file-${index}`,
              contentType: part.mediaType || 'application/octet-stream',
              url: part.url,
              fileType: 'file' as const
            };
          }
        })
        .filter(Boolean);
    }
    return [];
  }, [message.parts]);
  
  const allAttachments = message.experimental_attachments || attachmentsFromParts;

  // 편집 시작 시 기존 첨부파일들을 편집 상태로 복사
  useEffect(() => {
    if (editingMessageId === message.id && allAttachments && allAttachments.length > 0) {
      const attachments = (allAttachments as any[]);
      const files: globalThis.File[] = [];
      const fileMap = new Map<string, { file: globalThis.File, url: string }>();

      attachments.forEach((attachment: any, index: number) => {
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
  }, [editingMessageId, message.id, allAttachments]);

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
    const newFileMapEntries: [string, { file: globalThis.File, url: string }][] = [];

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      const fileId = `new-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Add unique ID for tracking
      (file as any).id = fileId;
      (file as any).isExisting = false;

      // Create object URL for preview
      const url = URL.createObjectURL(file);
      
      newFiles.push(file);
      newFileMapEntries.push([fileId, { file, url }]);
    }

    setEditingFiles(prev => [...prev, ...newFiles]);
    setEditingFileMap(prev => {
      const newMap = new Map(prev);
      newFileMapEntries.forEach(([id, data]) => {
        newMap.set(id, data);
      });
      return newMap;
    });

    // Reset file input
    e.target.value = '';
  }, []);

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
    const newFileMapEntries: [string, { file: globalThis.File, url: string }][] = [];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const fileId = `drop-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Add unique ID for tracking
      (file as any).id = fileId;
      (file as any).isExisting = false;

      // Create object URL for preview
      const url = URL.createObjectURL(file);
      
      newFiles.push(file);
      newFileMapEntries.push([fileId, { file, url }]);
    }

    setEditingFiles(prev => [...prev, ...newFiles]);
    setEditingFileMap(prev => {
      const newMap = new Map(prev);
      newFileMapEntries.forEach(([id, data]) => {
        newMap.set(id, data);
      });
      return newMap;
    });
  }, []);

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
    setContainerMinHeight('auto');
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
    setContainerMinHeight('auto');
  }, [editingFiles, editingFileMap, onEditCancel]);
  

  const isEditing = editingMessageId === message.id;

  // 편집 모드 시작 시 텍스트 영역을 설정하는 효과
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      const textarea = textareaRef.current;

      const resizeTextarea = () => {
        textarea.style.height = 'auto';
        const scrollHeight = textarea.scrollHeight;
        // Ensure getComputedStyle runs only in browser
        if (typeof window !== 'undefined') {
          const maxHeight = parseInt(window.getComputedStyle(textarea).maxHeight, 10);
          
          if (scrollHeight > maxHeight) {
            textarea.style.height = `${maxHeight}px`;
          } else {
            textarea.style.height = `${scrollHeight}px`;
          }
        } else {
           textarea.style.height = `${scrollHeight}px`;
        }
      };

      resizeTextarea();
      textarea.focus();
      const len = textarea.value.length;
      textarea.setSelectionRange(len, len);

      // 메시지 그룹을 화면 중앙으로 스크롤
      setTimeout(() => {
        textarea.closest('.message-group')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100); // DOM 업데이트 후 스크롤
    }
  }, [isEditing, textareaRef]);

  const isCopied = copiedMessageId === message.id;
  const isAssistant = message.role === 'assistant';
  const isUser = message.role === 'user';
  const hasAttachments = allAttachments && allAttachments.length > 0;
  // AI SDK v5: parts 배열에서 텍스트 내용 확인 (message.content는 빈 문자열일 수 있음)
  const hasContent = useMemo(() => {
    // 1. message.content가 있으면 확인
    if (message.content && message.content.trim().length > 0) {
      return true;
    }
    
    // 2. parts 배열에서 text 타입 part 확인
    if (message.parts && Array.isArray(message.parts)) {
      return message.parts.some((part: any) => 
        part.type === 'text' && part.text && part.text.trim().length > 0
      );
    }
    
    return false;
  }, [message.content, message.parts]);
  

  
  const hasActualCanvasData = useMemo(() => {
    return !!(
      webSearchData ||
      mathCalculationData ||
      linkReaderData ||
      imageGeneratorData ||
      xSearchData ||
      youTubeSearchData ||
      youTubeLinkAnalysisData
    );
  }, [
    webSearchData,
    mathCalculationData,
    linkReaderData,
    imageGeneratorData,
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


  const hasAnyContent = hasContent || structuredMainResponse || isInProgress; // hasAnyContent도 진행 중 상태 고려

  // Bookmark status is now managed by parent component

  // 마지막 어시스턴트 메시지인지 확인
  const isLastAssistantMessage = isLastMessage && message.role === 'assistant';

  // 모바일 여부 확인
  const [isMobile, setIsMobile] = useState(false);
  
  // 롱프레스 관련 상태 추가
  const [longPressActive, setLongPressActive] = useState(false);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [touchStartTime, setTouchStartTime] = useState<number>(0);
  const [touchStartY, setTouchStartY] = useState<number>(0);
  const [isLongPressActive, setIsLongPressActive] = useState(false);
  const [bubbleViewportRect, setBubbleViewportRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 640); // sm breakpoint
    };
    
    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);
    return () => window.removeEventListener('resize', checkIfMobile);
  }, []);

  // 롱프레스 타이머 정리
  useEffect(() => {
    return () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
      }
    };
  }, [longPressTimer]);

  // 롱프레스 활성화 시 버블 위치 계산 및 스크롤 잠금
  useEffect(() => {
    if (longPressActive) {
      if (bubbleRef.current) {
        const rect = bubbleRef.current.getBoundingClientRect();
        // 좌측으로 이동하기 위해 left 값을 조정 (말풍선 꼬리 잘림 방지)
        setBubbleViewportRect({ 
          top: rect.top, 
          left: Math.max(8, rect.left - (rect.width * 0.025)), // 2.5% 좌측 이동, 최소 8px 여백
          width: rect.width, 
          height: rect.height 
        });
      }
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      const handleScrollCancel = () => {
        setLongPressActive(false);
        setIsLongPressActive(false);
        setBubbleViewportRect(null);
      };
      window.addEventListener('scroll', handleScrollCancel, { passive: true });
      window.addEventListener('resize', handleScrollCancel);
      return () => {
        document.body.style.overflow = originalOverflow;
        window.removeEventListener('scroll', handleScrollCancel);
        window.removeEventListener('resize', handleScrollCancel);
      };
    } else {
      setBubbleViewportRect(null);
    }
  }, [longPressActive]);

  // 터치 시작 핸들러
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isMobile || !isUser) return;
    
    e.preventDefault();
    setTouchStartTime(Date.now());
    setTouchStartY(e.touches[0].clientY);
    setIsLongPressActive(false);
    
    // 롱프레스 타이머 시작 (500ms)
    const timer = setTimeout(() => {
      setLongPressActive(true);
      setIsLongPressActive(true);
    }, 500);
    
    setLongPressTimer(timer);
  };

  // 터치 종료 핸들러
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isMobile || !isUser) return;
    
    e.preventDefault();
    
    // 타이머 정리
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
    
    const touchEndTime = Date.now();
    const touchDuration = touchEndTime - touchStartTime;
    
    // 롱프레스가 활성화된 상태에서는 일반 클릭 방지
    if (isLongPressActive) {
      return;
    }
    
    // 짧은 터치인 경우 일반 클릭으로 처리 (아무것도 하지 않음)
    if (touchDuration < 500 && !longPressActive) {
      // 일반 클릭은 아무것도 하지 않음
    }
    
    // 롱프레스 상태 초기화
    setLongPressActive(false);
    setIsLongPressActive(false);
  };

  // 터치 이동 핸들러 (스크롤 방지)
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isMobile || !isUser) return;
    
    const currentY = e.touches[0].clientY;
    const deltaY = Math.abs(currentY - touchStartY);
    
    // 수직 이동이 10px 이상이면 롱프레스 취소
    if (deltaY > 10) {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        setLongPressTimer(null);
      }
      setLongPressActive(false);
      setIsLongPressActive(false);
    }
  };

  // 롱프레스 취소 핸들러
  const handleLongPressCancel = () => {
    setLongPressActive(false);
    setIsLongPressActive(false);
  };

  // 메시지가 긴지 또는 파일이 있는지 확인
  const isLongOrHasFiles = useMemo(() => {
    // 파일이 있는 경우
    if (hasAttachments) return true;
    
    // 메시지가 긴 경우 (300자 이상) - AI SDK v5 호환
    if (hasContent) {
      // message.content가 있으면 확인
      if (message.content && message.content.length > 300) return true;
      
      // parts 배열에서 텍스트 길이 확인
      if (message.parts && Array.isArray(message.parts)) {
        const textParts = message.parts.filter((part: any) => part.type === 'text');
        const totalTextLength = textParts.reduce((total: number, part: any) => 
          total + (part.text ? part.text.length : 0), 0
        );
        if (totalTextLength > 300) return true;
      }
    }
    
    return false;
  }, [hasAttachments, hasContent, message.content, message.parts]);

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

  // Toggle bookmark function - now uses parent callback
  const toggleBookmark = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // 🚀 익명 사용자 지원: 익명 사용자는 북마크 불가 - iMessage 스타일로 표시
    if (!user || user.id === 'anonymous' || user.id.startsWith('anonymous_')) {
      // 재생성과 같은 방식으로 iMessage 스타일 메시지 표시
      const signupPromptMessage = {
        id: `signup-prompt-bookmark-${Date.now()}`,
        role: 'assistant',
        content: '',
        createdAt: new Date(),
        parts: [],
        annotations: [
          {
            type: 'signup_prompt',
            data: {
              message: 'Please sign in to bookmark',
              upgradeUrl: '/login'
            }
          }
        ]
      };
      
      // Messages 컴포넌트의 setMessages에 접근하기 위해 이벤트 사용
      window.dispatchEvent(new CustomEvent('addSignupPrompt', {
        detail: { message: signupPromptMessage }
      }));
      return;
    }
    
    if (!message.id || !chatId || isBookmarksLoading || !onBookmarkToggle) return;
    
    try {
      await onBookmarkToggle(message.id, !isBookmarked);
    } catch (error) {
      console.error('Error toggling bookmark:', error);
    }
  };

  const hasTextContent = useMemo(() => {
    if (message.content) return true;
    if (message.parts?.some((p: any) => p.type === 'text' && p.text)) return true;
    return false;
  }, [message]);

  const hasAnyRenderableContent = useMemo(() => {
    if (message.content) return true;
    if (message.parts?.some((p: any) => p.type === 'text' && p.text)) return true;
    if (structuredDescription) return true;
    if (hasAttachments) return true;
    // 도구 데이터만 있고 실제 텍스트 컨텐츠가 없으면 false 반환
    if (hasActualCanvasData && !message.content && !message.parts?.some((p: any) => p.type === 'text' && p.text)) return false;
    return false;
  }, [message, structuredDescription, hasAttachments, hasActualCanvasData]);

  // Check if message has rate limit status annotation
  const rateLimitAnnotation = useMemo(() => {
    if (!message.annotations) return null;
    return message.annotations.find((annotation: any) => annotation?.type === 'rate_limit_status');
  }, [message.annotations]);

  // Check if message has signup prompt annotation
  const signupPromptAnnotation = useMemo(() => {
    if (!message.annotations) return null;
    return message.annotations.find((annotation: any) => annotation?.type === 'signup_prompt');
  }, [message.annotations]);

  // Type guard for rate limit annotation data
  const rateLimitData = useMemo(() => {
    if (!rateLimitAnnotation || typeof rateLimitAnnotation !== 'object' || !('data' in rateLimitAnnotation)) {
      return null;
    }
    return rateLimitAnnotation.data as {
      minutesUntilReset?: number;
      upgradeUrl?: string;
      model?: string;
      level?: string;
      hourlyLimit?: number;
      hourlyWindow?: string;
      dailyLimit?: number;
      dailyWindow?: string;
      reset?: string;
    };
  }, [rateLimitAnnotation]);

  // Type guard for signup prompt annotation data
  const signupPromptData = useMemo(() => {
    if (!signupPromptAnnotation || typeof signupPromptAnnotation !== 'object' || !('data' in signupPromptAnnotation)) {
      return null;
    }
    return signupPromptAnnotation.data as {
      message?: string;
      upgradeUrl?: string;
    };
  }, [signupPromptAnnotation]);

  const chatTranslations = useMemo(() => getChatInputTranslations(), []);

  // 메시지 제목 추출
  const messageTitle = useMemo(() => {
    return getStructuredResponseTitle(message);
  }, [message]);

  return (
    <div className={`message-group group animate-fade-in ${getMinHeight}`} id={message.id}>
      <UnifiedInfoPanel
        reasoningPart={reasoningPart}
        isAssistant={isAssistant}
        hasAnyContent={hasAnyContent}
        isWaitingForToolResults={isWaitingForToolResults}
        isStreaming={isStreaming}
        reasoningComplete={reasoningComplete}
        isReasoningInProgress={isReasoningInProgress}
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
        xSearchData={xSearchData}
        youTubeSearchData={youTubeSearchData}
        youTubeLinkAnalysisData={youTubeLinkAnalysisData}
        messageId={message.id}
        togglePanel={togglePanel}
        activePanel={activePanel}
        messageTitle={messageTitle}
        searchTerm={searchTerm} // 🚀 FEATURE: Pass search term for highlighting
        message={message} // 🚀 Pass message to detect title generation started
      />
      {/* Rate Limit Status Message */}
      {rateLimitAnnotation && (
        <>
          {/* Upgrade Card */}
          <div className="flex justify-start mb-4">
            <div className="max-w-[85%] md:max-w-[75%] w-full">
              {rateLimitData && (
                <div 
                  className="bg-[#1E1E1E] dark:bg-black rounded-2xl p-6 border border-neutral-800 text-center text-white relative overflow-hidden"
                >
                  <div 
                    className="absolute inset-0"
                    style={{
                      backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px)',
                      backgroundSize: '20px 20px',
                    }}
                  />
                  <div className="relative">
                    <h3 className="font-bold text-xl">More with Pro</h3>
                    <p className="text-sm text-gray-400 mt-2">
                      Upgrade to Pro to continue the conversation, or try again later.
                    </p>
                    <div className="mt-6">
                      <button
                        onClick={handleUpgradeClick}
                        className="bg-white text-black font-semibold py-2 px-4 rounded-full transition-transform transform hover:scale-105 cursor-pointer"
                      >
                        {chatTranslations.upgrade}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* AI Message Bubble */}
          <div className="flex justify-start mb-4">
            <div className="max-w-[85%] md:max-w-[75%]">
              {rateLimitData && (
                <div className="imessage-receive-bubble">
                  <p className="text-sm">
                    You've reached your limit of {rateLimitData.hourlyLimit || 10} {getModelById(rateLimitData?.model || '')?.name || 'questions'} per {rateLimitData.hourlyWindow?.replace('h', ' hours') || '12 hours'} (Level {rateLimitData?.level?.replace('level', '') || '0'}) for now. Please sign up for Pro to access more or check back later.
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Signup Prompt Message */}
      {signupPromptAnnotation && (
        <div className="flex justify-start mb-4">
          <div className="max-w-[85%] md:max-w-[75%]">
            {signupPromptData && (
              <div className="imessage-receive-bubble">
                <p className="text-sm">
                  {signupPromptData.message?.includes('sign in') ? (
                    <>
                      {signupPromptData.message?.split('sign in')[0] || ''}
                      <button
                        onClick={() => window.location.href = signupPromptData.upgradeUrl || '/login'}
                        className="text-blue-500 underline hover:text-blue-600 cursor-pointer"
                      >
                        sign in
                      </button>
                      {signupPromptData.message?.split('sign in')[1] || ''}
                    </>
                  ) : (
                    signupPromptData.message || ''
                  )}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
      <div className={`flex ${isUser ? `justify-end` : `justify-start`} ${isUser ? 'mt-10' : ''}`}>
        {isUser ? (
          <div className="w-full" style={{ minHeight: containerMinHeight }}>
            {isEditing ? (
              <div 
                className="w-full animate-edit-in-view"
                ref={editingContainerRef}
                onDragEnter={handleDrag}
                onDragLeave={handleDragLeave}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <div className="flex flex-col items-end gap-0 w-full">
                  {editingFiles.length > 0 && (
                    <div className="flex flex-col items-end gap-0 mb-2 w-full">
                      <EditingFilePreview 
                        files={editingFiles}
                        fileMap={editingFileMap}
                        removeFile={handleRemoveFile}
                      />
                    </div>
                  )}
                  <div className="relative w-full">
                    <div className="imessage-edit-bubble">
                      <textarea
                        ref={textareaRef}
                        value={editingContent}
                        onChange={(e) => {
                          setEditingContent(e.target.value);
                          const textarea = e.currentTarget;
                          textarea.style.height = 'auto';
                          const scrollHeight = textarea.scrollHeight;
                          if (typeof window !== 'undefined') {
                            const maxHeight = parseInt(window.getComputedStyle(textarea).maxHeight, 10);
                            if (scrollHeight > maxHeight) {
                              textarea.style.height = `${maxHeight}px`;
                            } else {
                              textarea.style.height = `${scrollHeight}px`;
                            }
                          } else {
                            textarea.style.height = `${scrollHeight}px`;
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleEditSave();
                          }
                        }}
                        className="imessage-edit-textarea scrollbar-thin"
                        placeholder="Edit your message..."
                      />
                    </div>
                    {dragActive && <DragDropOverlay dragActive={dragActive} supportsPDFs={true} />}
                  </div>

                  <div className="flex w-full items-center justify-between gap-2 mt-2 relative z-20">
                    <div className="flex items-center gap-2">
                      <button onClick={handleFileSelect} className="imessage-edit-control-btn" title="Add files">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14,2 14,8 20,8"/><path d="M12 18v-6"/><path d="M9 15h6"/></svg>
                      </button>
                      <span className="text-xs text-neutral-500/80">or drag & drop files</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <input ref={fileInputRef} type="file" multiple onChange={handleFileChange} className="hidden" accept="image/*,video/*,audio/*,text/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.7z,.tar,.gz" />
                      <button onClick={handleEditCancel} className="imessage-edit-control-btn cancel" title="Cancel">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                      <button onClick={handleEditSave} className="imessage-edit-control-btn save" title="Save">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20,6 9,17 4,12"/></svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div ref={viewRef}>
                <div className="flex flex-col items-end gap-0">
                  {hasAttachments && (allAttachments as any[])!.map((attachment: any, index: number) => (
                    <AttachmentPreview 
                      key={`${message.id}-att-${index}`} 
                      attachment={attachment} 
                      messageId={message.id}
                      attachmentIndex={index}
                      togglePanel={togglePanel}
                    />
                  ))}
                  {(() => {
                    // Prefer parts text when content is empty
                    const sourceText = hasContent
                      ? processedContent
                      : (processedParts?.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('\n') || '');
                    if (!sourceText) return null;
                    
                    // 더 정확한 URL 감지 - HTML 속성이나 코드 내의 URL은 제외
                    const urlRegex = /(https?:\/\/[^\s"'<>]+)/g;
                    const matches = sourceText.match(urlRegex) || [];
                    
                    // URL 유효성 검사 및 필터링
                    const validUrls = matches.filter((url: string) => {
                      try {
                        const parsedUrl = new URL(url);
                        // HTML 속성이나 코드 내의 URL 제외
                        if (url.includes('xmlns=') || url.includes('href=') || url.includes('src=')) {
                          return false;
                        }
                        // 네임스페이스 URL 제외
                        if (parsedUrl.hostname === 'www.w3.org' && parsedUrl.pathname.includes('/2000/svg')) {
                          return false;
                        }
                        // 일반적인 웹사이트 URL만 허용
                        return ['http:', 'https:'].includes(parsedUrl.protocol);
                      } catch {
                        return false;
                      }
                    });
                    
                    return validUrls.map((url: string, index: number) => (
                      <LinkPreview key={`${message.id}-url-${index}`} url={url} />
                    ));
                  })()}
                  {(hasTextContent) && (
                    <div 
                      className="imessage-send-bubble" 
                      ref={bubbleRef}
                      onTouchStart={handleTouchStart}
                      onTouchEnd={handleTouchEnd}
                      onTouchMove={handleTouchMove}
                      style={{
                        WebkitTapHighlightColor: 'transparent',
                        WebkitTouchCallout: 'none',
                        WebkitUserSelect: 'none',
                        userSelect: 'none'
                      }}
                    >
                      <UserMessageContent 
                        content={
                          hasContent 
                            ? processedContent 
                            : (processedParts?.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('\n') || '')
                        }
                        searchTerm={searchTerm}
                      />
                    </div>
                  )}
                  <div className="text-[10px] text-neutral-500 mt-1 pr-1">
                    {formatMessageTime((message as any).createdAt || new Date())}
                  </div>
                </div>
                {/* 편집 버튼들 - 데스크탑 호버 시 표시, 모바일 롱프레스 시 표시 */}
                <div className={`flex justify-end mt-2 gap-2 transition-opacity duration-300 ${
                  isMobile 
                    ? (longPressActive ? 'opacity-100' : 'opacity-0') 
                    : 'opacity-0 md:group-hover:opacity-100'
                }`}>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleEditStartClick();
                      if (isMobile) {
                        handleLongPressCancel();
                      }
                    }}
                    className="imessage-control-btn"
                    title="Edit message"
                    style={{
                      WebkitTapHighlightColor: 'transparent',
                      WebkitTouchCallout: 'none',
                      WebkitUserSelect: 'none',
                      userSelect: 'none'
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onCopy(message);
                      if (isMobile) {
                        handleLongPressCancel();
                      }
                    }}
                    className={`imessage-control-btn ${isCopied ? 'copied' : ''}`}
                    title={isCopied ? "Copied!" : "Copy message"}
                    style={{
                      WebkitTapHighlightColor: 'transparent',
                      WebkitTouchCallout: 'none',
                      WebkitUserSelect: 'none',
                      userSelect: 'none'
                    }}
                  >
                    {isCopied ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20,6 9,17 4,12"/>
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                      </svg>
                    )}
                  </button>
                  {/* 모바일에서만 취소 버튼 표시 */}
                  {isMobile && longPressActive && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleLongPressCancel();
                      }}
                      className="imessage-control-btn text-gray-500 hover:text-gray-700"
                      title="Cancel"
                      style={{
                        WebkitTapHighlightColor: 'transparent',
                        WebkitTouchCallout: 'none',
                        WebkitUserSelect: 'none',
                        userSelect: 'none'
                      }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
          {(hasAnyRenderableContent || structuredDescription) && (
            <div className="imessage-receive-bubble" ref={aiBubbleRef}>
              <div className="imessage-content-wrapper space-y-4">
                {/* 기존 컨텐츠 렌더링 로직 */}
              {hasAttachments && (allAttachments as any[])!.map((attachment: any, index: number) => (
                <AttachmentPreview key={`${message.id}-att-${index}`} attachment={attachment} />
              ))}
            
              {message.parts ? (
                    processedParts?.map((part: any, index: number) => (
                    part.type === 'text' && <MarkdownContent key={index} content={part.text} enableSegmentation={isAssistant} searchTerm={searchTerm} messageType={isAssistant ? 'assistant' : 'user'} />
                  ))
                        ) : (
                      (hasContent && !hasStructuredData) && <MarkdownContent content={processedContent} enableSegmentation={isAssistant} searchTerm={searchTerm} messageType={isAssistant ? 'assistant' : 'user'} />
                  )}
                  
                  <FilesPreview
                    messageId={message.id}
                    togglePanel={togglePanel}
                    message={message}
                  />

              {structuredDescription && (
                    <div className="imessage-receive-bubble mt-2">
                  <p>{structuredDescription}</p>
                </div>
            )}
          </div>
          </div>
          )}
        </>
      )}
    </div>
      {isAssistant && !isStreaming && (
        <div className="flex justify-start mt-2 mb-4 gap-2 items-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300">
          <button 
            onClick={onRegenerate(message.id)}
            disabled={isRegenerating}
            className={`imessage-control-btn ${isRegenerating ? 'loading' : ''}`}
            title="Regenerate response"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={isRegenerating ? 'animate-spin' : ''}>
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
              <path d="M21 3v5h-5"/>
              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
              <path d="M3 21v-5h5"/>
            </svg>
          </button>
          <button
            onClick={() => onCopy(message)}
            className={`imessage-control-btn ${isCopied ? 'copied' : ''}`}
            title={isCopied ? "Copied!" : "Copy message"}
          >
            {isCopied ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20,6 9,17 4,12"/>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
            )}
          </button>
          <button
            onClick={toggleBookmark}
            className={`imessage-control-btn ${isBookmarked ? 'bookmarked' : ''} ${isBookmarksLoading ? 'loading' : ''}`}
            title={isBookmarked ? "Remove bookmark" : "Bookmark message"}
            disabled={isBookmarksLoading}
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              width="14" 
              height="14" 
              viewBox="0 0 24 24" 
              fill={isBookmarked ? "currentColor" : "none"}
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              className={isBookmarksLoading ? "animate-pulse" : ""}
            >
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
            </svg>
          </button>
          
          {/* 구분선 */}
          {/* <div className="w-px h-4 bg-[var(--subtle-divider)] mx-2"></div> */}
          
          {/* Model capability badges first */}
          <ModelCapabilityBadges modelId={(message as ExtendedMessage).model || currentModel} />
          
          {/* Then model name with logo */}
          <ModelNameWithLogo modelId={(message as ExtendedMessage).model || currentModel} />
          
          {/* Canvas 버튼 제거됨 */}
        </div>
      )}
      {/* Add follow-up questions for the last assistant message */}
      {isAssistant && isLastMessage && !isGlobalLoading && !isStreaming && handleFollowUpQuestionClick && allMessages && chatId && (
        <div className="follow-up-questions-section">
          <FollowUpQuestions 
            chatId={chatId} 
            userId={user?.id || 'anonymous'} 
            messages={allMessages} 
            onQuestionClick={handleFollowUpQuestionClick} 
          />
        </div>
      )}
      {/* 최종 로딩 표시: 스트리밍 중인 마지막 메시지에만 표시 */}
      {isAssistant && isStreaming && isLastMessage && (
        <div className="flex justify-start mt-2">
          <div className="imessage-receive-bubble" style={{ 
            width: 'fit-content', 
            minWidth: 'auto',
            minHeight: 'auto',
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <TypingIndicator variant="compact" />
          </div>
        </div>
      )}
      {/* 롱프레스 오버레이: 전체 화면 블러 + 포커스된 메시지 클론 */}
      {longPressActive && bubbleViewportRect && createPortal(
        <div 
          className="fixed inset-0 z-[9999]"
          role="dialog"
          aria-modal="true"
        >
          {/* 블러 레이어 (배경 전체) */}
          <div 
            className="absolute inset-0 bg-black/20 backdrop-blur-md"
            onClick={handleLongPressCancel}
          />

          {/* 포커스된 메시지 클론 (원래 위치에 살짝 확대) */}
          <div
            className="absolute"
            style={{
              top: `${bubbleViewportRect.top}px`,
              left: `${bubbleViewportRect.left}px`,
              width: `${bubbleViewportRect.width}px`,
              // height는 내용에 맞춰 자동
              transform: 'scale(1.05)',
              transformOrigin: 'top left',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 메시지 버블 복제 */}
            <div className="imessage-send-bubble" style={{ boxShadow: '0 12px 32px rgba(0,0,0,0.35)' }}>
              <UserMessageContent 
                content={
                  hasContent 
                    ? processedContent 
                    : (processedParts?.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('\n') || '')
                }
                searchTerm={searchTerm}
              />
            </div>
            {/* 버튼 클론 (원래와 동일 동작) - 모바일에서는 X 버튼 제거 */}
            <div className="flex justify-end mt-2 gap-2 opacity-100 transition-opacity duration-300">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleEditStartClick();
                  handleLongPressCancel();
                }}
                className="imessage-control-btn"
                title="Edit message"
                style={{
                  WebkitTapHighlightColor: 'transparent',
                  WebkitTouchCallout: 'none',
                  WebkitUserSelect: 'none',
                  userSelect: 'none'
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onCopy(message);
                  handleLongPressCancel();
                }}
                className={`imessage-control-btn ${isCopied ? 'copied' : ''}`}
                title={isCopied ? "Copied!" : "Copy message"}
                style={{
                  WebkitTapHighlightColor: 'transparent',
                  WebkitTouchCallout: 'none',
                  WebkitUserSelect: 'none',
                  userSelect: 'none'
                }}
              >
                {isCopied ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20,6 9,17 4,12"/>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2 2v1"/>
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>,
        typeof window !== 'undefined' ? document.body : (null as any)
      )}
    </div>
  );
});


export { Message }; 





