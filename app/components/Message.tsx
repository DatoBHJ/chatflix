import { MarkdownContent } from './MarkdownContent' 
import { ExtendedMessage } from '../chat/[id]/types'
import { Attachment } from '@/lib/types'
import React, { memo, useCallback, useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { IoCreateOutline, IoCopyOutline, IoCheckmarkOutline, IoBookmarkOutline, IoBookmark } from 'react-icons/io5'

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
  googleSearchData?: any
  user?: User | null
  handleFollowUpQuestionClick?: (question: string) => Promise<void>
  allMessages?: any[]
  isGlobalLoading?: boolean
  imageMap?: { [key: string]: string }
  linkMap?: { [key: string]: string }
  thumbnailMap?: { [key: string]: string }
  titleMap?: { [key: string]: string }
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
  googleSearchData,
  user,
  handleFollowUpQuestionClick,
  allMessages,
  isGlobalLoading,
  imageMap = {},
  linkMap = {},
  thumbnailMap = {},
  titleMap = {},
  isBookmarked,
  onBookmarkToggle,
  isBookmarksLoading,
  searchTerm, // 🚀 FEATURE: Search term for highlighting
}: MessageProps) {

  // Pre-compiled regex for better performance
  const IMAGE_ID_REGEX = useMemo(() => /\[IMAGE_ID:([^\]]+)\]/g, []);
  const LINK_ID_REGEX = useMemo(() => /\[LINK_ID:([^\]]+)\]/g, []);

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
    
    // Quick check: if no placeholders exist, return original content immediately
    if (!content.includes('[IMAGE_ID:') && !content.includes('[LINK_ID:')) {
      return content;
    }
    
    // Process placeholders only when necessary
    let processedContent = content;
    
    // Process image placeholders
    if (content.includes('[IMAGE_ID:')) {
      processedContent = processedContent.replace(IMAGE_ID_REGEX, (match: string, imageId: string) => {
        // Only show image if imageMap exists AND has the specific URL
        if (imageMap && Object.keys(imageMap).length > 0) {
          const imageUrl = imageMap[imageId];
          if (imageUrl) {
            // Debug logging
            console.log('Processing IMAGE_ID:', imageId, 'URL:', imageUrl);
            // Use empty alt text for clean display
            return `![](${imageUrl})`;
          }
        }
        // Remove placeholder completely in all other cases
        return '';
      });
    }
    
    // Process link placeholders
    if (content.includes('[LINK_ID:')) {
      processedContent = processedContent.replace(LINK_ID_REGEX, (match: string, linkId: string) => {
        // Only show link if linkMap exists AND has the specific URL
        if (linkMap && Object.keys(linkMap).length > 0) {
          const linkUrl = linkMap[linkId];
          if (linkUrl) {
            // Return the URL directly - MarkdownContent will handle LinkPreview rendering
            return linkUrl;
          }
        }
        // Remove placeholder completely in all other cases
        return '';
      });
    }
    
    return processedContent;
  }, [message.content, message.parts, imageMap, linkMap, IMAGE_ID_REGEX, LINK_ID_REGEX]);

  // Memoized function for parts processing
  const processedParts = useMemo(() => {
    if (!message.parts) return null;
    
    return message.parts.map((part: any) => {
      if (part.type === 'text' && part.text) {
        // Quick check for performance
        if (!part.text.includes('[IMAGE_ID:') && !part.text.includes('[LINK_ID:')) {
          return part;
        }
        
        let processedText = part.text;
        
        // Process image placeholders
        if (part.text.includes('[IMAGE_ID:')) {
          processedText = processedText.replace(IMAGE_ID_REGEX, (match: string, imageId: string) => {
            if (imageMap && Object.keys(imageMap).length > 0) {
              const imageUrl = imageMap[imageId];
              if (imageUrl) {
                return `![](${imageUrl})`;
              }
            }
            return '';
          });
        }
        
        // Process link placeholders
        if (part.text.includes('[LINK_ID:')) {
          processedText = processedText.replace(LINK_ID_REGEX, (match: string, linkId: string) => {
            if (linkMap && Object.keys(linkMap).length > 0) {
              const linkUrl = linkMap[linkId];
              if (linkUrl) {
                // Return the URL directly - MarkdownContent will handle LinkPreview rendering
                return linkUrl;
              }
            }
            return '';
          });
        }
        
        return {
          ...part,
          text: processedText
        };
      }
      return part;
    });
  }, [message.parts, imageMap, linkMap, IMAGE_ID_REGEX, LINK_ID_REGEX]);

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
      // 세그먼트 내의 가장 큰 텍스트 크기를 찾기
      const getLargestFontSize = (element: Element): number => {
        const computedStyle = window.getComputedStyle(element);
        const fontSize = parseFloat(computedStyle.fontSize);
        
        let maxFontSize = fontSize;
        
        // 자식 요소들도 확인
        const children = element.children;
        for (let i = 0; i < children.length; i++) {
          const childMaxSize = getLargestFontSize(children[i]);
          maxFontSize = Math.max(maxFontSize, childMaxSize);
        }
        
        return maxFontSize;
      };
      
      const maxFontSize = getLargestFontSize(segment);
      
      // 글꼴 크기에 따른 동적 임계값 계산
      // 기본 16px 기준으로 36px 임계값, 글꼴이 클수록 임계값도 증가
      const baseFontSize = 16;
      const baseThreshold = 36;
      const threshold = (maxFontSize / baseFontSize) * baseThreshold;
      
      // 텍스트 크기에 따른 패딩 클래스 추가
      const removePaddingClasses = () => {
        segment.classList.remove('text-size-sm', 'text-size-base', 'text-size-lg', 'text-size-xl', 'text-size-2xl', 'text-size-3xl', 'text-size-4xl');
      };
      
      removePaddingClasses();
      
      // 글꼴 크기에 따른 클래스 추가
      if (maxFontSize <= 14) {
        segment.classList.add('text-size-sm');
      } else if (maxFontSize <= 16) {
        segment.classList.add('text-size-base');
      } else if (maxFontSize <= 18) {
        segment.classList.add('text-size-lg');
      } else if (maxFontSize <= 20) {
        segment.classList.add('text-size-xl');
      } else if (maxFontSize <= 24) {
        segment.classList.add('text-size-2xl');
      } else if (maxFontSize <= 30) {
        segment.classList.add('text-size-3xl');
      } else {
        segment.classList.add('text-size-4xl');
      }
      
      if (segment.clientHeight > threshold) {
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
      youTubeLinkAnalysisData ||
      googleSearchData
    );
  }, [
    webSearchData,
    mathCalculationData,
    linkReaderData,
    imageGeneratorData,
    xSearchData,
    youTubeSearchData,
    youTubeLinkAnalysisData,
    googleSearchData
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
  
  // 마지막 사용자 메시지인지 확인
  const isLastUserMessage = useMemo(() => {
    if (message.role !== 'user' || !allMessages) return false;
    
    const currentIndex = allMessages.findIndex((msg: any) => msg.id === message.id);
    if (currentIndex === -1) return false;
    
    // 현재 메시지 이후에 사용자 메시지가 있는지 확인
    const hasLaterUserMessage = allMessages
      .slice(currentIndex + 1)
      .some((msg: any) => msg.role === 'user');
    
    return !hasLaterUserMessage;
  }, [message.id, message.role, allMessages]);

  // 모바일 여부 확인
  const [isMobile, setIsMobile] = useState(false);
  
  // 롱프레스 관련 상태 추가 (단순화)
  const [longPressActive, setLongPressActive] = useState(false);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [touchStartTime, setTouchStartTime] = useState<number>(0);
  const [touchStartY, setTouchStartY] = useState<number>(0);
  const [isLongPressActive, setIsLongPressActive] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<'top' | 'bottom'>('top');
  const [bubbleTransform, setBubbleTransform] = useState('scale(1) translateY(0)');
  const [preCalculatedMenuPosition, setPreCalculatedMenuPosition] = useState<{top: string, left: string, right: string, display: string} | null>(null);

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

  // 롱프레스 활성화 시 단순한 상태 관리 (스크롤 잠금 제거)
  useEffect(() => {
    if (longPressActive) {
      // 강력한 스크롤 방지
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.height = '100%';
      
      // 터치 이벤트 전역 방지
      const preventTouchMove = (e: TouchEvent) => {
        e.preventDefault();
        e.stopPropagation();
      };
      
      const preventScroll = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
      };
      
      // iMessage와 유사한 하단 위치 조정 로직
      let newTransform = 'scale(1.05)'; 
      
      // 사용자 메시지: 하이브리드 접근 - 메시지 근처 우선, 화면 벗어날 때만 하단 고정
      if (dropdownPosition === 'bottom' && bubbleRef.current && isUser) {
        const rect = bubbleRef.current.getBoundingClientRect();
        const menuHeight = 120;
        const margin = 16;
        const viewportHeight = window.innerHeight;
        const menuBottomMargin = 20;
        const messageToMenuMargin = 8;
        
        // 1. 먼저 메시지 바로 아래에 메뉴를 배치해보기
        const preferredMenuTop = rect.bottom + margin;
        const preferredMenuBottom = preferredMenuTop + menuHeight;
        
        // 2. 메뉴가 화면을 벗어나는지 확인
        const menuWouldGoOffscreen = preferredMenuBottom > viewportHeight - menuBottomMargin;
        
        if (menuWouldGoOffscreen) {
          // 3. 화면을 벗어나면 메뉴를 하단에 고정하고 메시지 조정
          const menuTop = viewportHeight - menuBottomMargin - menuHeight;
          
          // 메시지가 메뉴와 겹치는지 확인
          const messageBottom = rect.bottom;
          const messageWouldOverlap = messageBottom + messageToMenuMargin > menuTop;
          
          if (messageWouldOverlap) {
            // 메시지를 메뉴 위로 이동 (겹치지 않도록)
            const targetBubbleBottom = menuTop - messageToMenuMargin;
            const translateY = targetBubbleBottom - messageBottom;
            newTransform = `translateY(${translateY}px) scale(1.05)`;
          } else {
            // 겹치지 않으면 단순 확대만
            newTransform = 'scale(1.05)';
          }
        } else {
          // 4. 공간이 충분하면 메시지 근처에 메뉴 배치 (메시지 이동 없음)
          newTransform = 'scale(1.05)';
        }
      }
      
      // AI 메시지: 하이브리드 접근 - 메시지 근처 우선, 화면 벗어날 때만 하단 고정
      if (dropdownPosition === 'bottom' && aiBubbleRef.current && isAssistant) {
        // 확대 전 원본 위치를 기준으로 계산 (glitch 방지)
        const rect = aiBubbleRef.current.getBoundingClientRect();
        const menuHeight = 120;
        const margin = 16;
        const viewportHeight = window.innerHeight;
        const menuBottomMargin = 20;
        const messageToMenuMargin = 8;
        
        // 1. 먼저 메시지 바로 아래에 메뉴를 배치해보기 (원본 위치 기준)
        const preferredMenuTop = rect.bottom + margin;
        const preferredMenuBottom = preferredMenuTop + menuHeight;
        
        // 2. 메뉴가 화면을 벗어나는지 확인
        const menuWouldGoOffscreen = preferredMenuBottom > viewportHeight - menuBottomMargin;
        
        if (menuWouldGoOffscreen) {
          // 3. 화면을 벗어나면 메뉴를 하단에 고정하고 메시지 조정
          const menuTop = viewportHeight - menuBottomMargin - menuHeight;
          
          // 메시지가 메뉴와 겹치는지 확인 (원본 위치 기준)
          const messageBottom = rect.bottom;
          const messageWouldOverlap = messageBottom + messageToMenuMargin > menuTop;
          
          if (messageWouldOverlap) {
            // 메시지를 메뉴 위로 이동 (겹치지 않도록)
            const targetBubbleBottom = menuTop - messageToMenuMargin;
            const translateY = targetBubbleBottom - messageBottom;
            newTransform = `translateX(3px) translateY(${translateY - 3}px) scale(1.005)`;
          } else {
            // 겹치지 않으면 단순 확대만
            newTransform = 'translateX(3px) translateY(-3px) scale(1.005)';
          }
        } else {
          // 4. 공간이 충분하면 메시지 근처에 메뉴 배치 (메시지 이동 없음)
          newTransform = 'translateX(3px) translateY(-3px) scale(1.005)';
        }
      }
      
      setBubbleTransform(newTransform);

      const handleScrollCancel = () => {
        setLongPressActive(false);
        setIsLongPressActive(false);
      };
      
      const handleClickOutside = (e: MouseEvent) => {
        const target = e.target as Element;
        // 메시지 버블이나 드롭다운 메뉴가 아닌 다른 곳을 클릭했을 때 닫기
        if (!target.closest('.imessage-send-bubble') && !target.closest('.chat-input-tooltip-backdrop')) {
          setLongPressActive(false);
          setIsLongPressActive(false);
        }
      };
      
      // 모든 스크롤 및 터치 이벤트 방지
      document.addEventListener('touchmove', preventTouchMove, { passive: false });
      document.addEventListener('scroll', preventScroll, { passive: false });
      document.addEventListener('wheel', preventScroll, { passive: false });
      window.addEventListener('scroll', handleScrollCancel, { passive: true });
      window.addEventListener('resize', handleScrollCancel);
      document.addEventListener('click', handleClickOutside);
      
      return () => {
        // 스크롤 복원
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.width = '';
        document.body.style.height = '';
        
        document.removeEventListener('touchmove', preventTouchMove);
        document.removeEventListener('scroll', preventScroll);
        document.removeEventListener('wheel', preventScroll);
        window.removeEventListener('scroll', handleScrollCancel);
        window.removeEventListener('resize', handleScrollCancel);
        document.removeEventListener('click', handleClickOutside);
      };
    } else {
      // 롱프레스 비활성화 시 변환 초기화
      setBubbleTransform('scale(1) translateY(0)');
    }
  }, [longPressActive, dropdownPosition]);

  // 터치 시작 핸들러 (사용자 메시지용)
  const handleUserTouchStart = (e: React.TouchEvent) => {
    if (!isMobile || !isUser) return;
    
    // 스크롤 방지를 위한 preventDefault
    e.preventDefault();
    e.stopPropagation();
    
    setTouchStartTime(Date.now());
    setTouchStartY(e.touches[0].clientY);
    setIsLongPressActive(false);
    
    // 항상 메뉴가 메시지 아래에 나오도록 설정
    setDropdownPosition('bottom');
    
    // 롱프레스 타이머 시작 (500ms)
    const timer = setTimeout(() => {
      setLongPressActive(true);
      setIsLongPressActive(true);
    }, 500);
    
    setLongPressTimer(timer);
  };

  // 터치 시작 핸들러 (AI 메시지용) - iOS Safari 호환성 개선
  const handleAITouchStart = (e: React.TouchEvent) => {
    if (!isMobile || !isAssistant) return;
    
    // iOS Safari: 하위 요소의 이벤트를 즉시 차단
    e.stopPropagation();
    
    setTouchStartTime(Date.now());
    setTouchStartY(e.touches[0].clientY);
    setIsLongPressActive(false);
    
    // 항상 메뉴가 메시지 아래에 나오도록 설정
    setDropdownPosition('bottom');
    
    // 터치 시작 시점에 메뉴 위치 미리 계산 (glitch 방지)
    if (aiBubbleRef.current) {
      const rect = aiBubbleRef.current.getBoundingClientRect();
      const menuHeight = 120;
      const margin = 16;
      const viewportHeight = window.innerHeight;
      const menuBottomMargin = 20;
      
      // 1. 먼저 메시지 바로 아래에 메뉴를 배치해보기 (원본 위치 기준)
      const preferredMenuTop = rect.bottom + margin;
      const preferredMenuBottom = preferredMenuTop + menuHeight;
      
      // 2. 메뉴가 화면을 벗어나는지 확인
      const menuWouldGoOffscreen = preferredMenuBottom > viewportHeight - menuBottomMargin;
      
      let menuPosition;
      if (menuWouldGoOffscreen) {
        // 3. 화면을 벗어나면 하단에 고정
        menuPosition = {
          top: `${viewportHeight - menuHeight - menuBottomMargin}px`,
          left: '16px',
          right: 'auto',
          display: 'block'
        };
      } else {
        // 4. 공간이 충분하면 메시지 바로 아래에 배치 (약간의 여유 공간 추가)
        menuPosition = {
          top: `${preferredMenuTop + 2}px`, // 2px 여유 공간 추가
          left: '16px',
          right: 'auto',
          display: 'block'
        };
      }
      
      setPreCalculatedMenuPosition(menuPosition);
    }
    
    // 롱프레스 타이머 시작 (500ms)
    const timer = setTimeout(() => {
      setLongPressActive(true);
      setIsLongPressActive(true);
      
      // iOS Safari: 롱프레스 활성화 시 스크롤 방지
      if (typeof window !== 'undefined' && navigator.userAgent.includes('Safari') && !navigator.userAgent.includes('Chrome')) {
        document.body.style.overflow = 'hidden';
        document.body.style.position = 'fixed';
        document.body.style.width = '100%';
      }
    }, 500);
    
    setLongPressTimer(timer);
  };

  // 터치 종료 핸들러 (사용자 메시지용)
  const handleUserTouchEnd = (e: React.TouchEvent) => {
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
    
    // 롱프레스 상태 초기화 (touchStartY는 유지)
    setLongPressActive(false);
    setIsLongPressActive(false);
  };

  // 터치 종료 핸들러 (AI 메시지용) - iOS Safari 호환성 개선
  const handleAITouchEnd = (e: React.TouchEvent) => {
    if (!isMobile || !isAssistant) return;
    
    e.stopPropagation();
    
    // 타이머 정리
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
    
    const touchEndTime = Date.now();
    const touchDuration = touchEndTime - touchStartTime;
    
    // 롱프레스가 활성화된 상태에서는 일반 클릭 방지
    if (isLongPressActive) {
      // iOS Safari: 스크롤 복원은 handleLongPressCancel에서 처리
      return;
    }
    
    // 짧은 터치인 경우 일반 클릭으로 처리 (아무것도 하지 않음)
    if (touchDuration < 500 && !longPressActive) {
      // 일반 클릭은 아무것도 하지 않음
    }
    
    // 롱프레스 상태 초기화 (touchStartY는 유지)
    setLongPressActive(false);
    setIsLongPressActive(false);
  };

  // 터치 이동 핸들러 (스크롤 방지) - 사용자 메시지용
  const handleUserTouchMove = (e: React.TouchEvent) => {
    if (!isMobile || !isUser) return;
    
    // 롱프레스 활성화 시 스크롤 완전 방지
    if (longPressActive || isLongPressActive) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  // 터치 이동 핸들러 (스크롤 방지) - AI 메시지용
  const handleAITouchMove = (e: React.TouchEvent) => {
    if (!isMobile || !isAssistant) return;
    
    const currentY = e.touches[0].clientY;
    const deltaY = Math.abs(currentY - touchStartY);
    
    // iOS Safari: 약간의 움직임이 있으면 롱프레스 취소 (10px 이상)
    if (deltaY > 10 && !longPressActive) {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        setLongPressTimer(null);
      }
      return;
    }
    
    // 롱프레스 활성화 시 스크롤 완전 방지
    if (longPressActive || isLongPressActive) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  // 롱프레스 취소 핸들러 (단순화)
  const handleLongPressCancel = () => {
    setLongPressActive(false);
    setIsLongPressActive(false);
    setPreCalculatedMenuPosition(null); // 미리 계산된 위치 초기화
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
        googleSearchData={googleSearchData}
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
            <div className="max-w-[85%] md:max-w-[75%] w-full" style={{ overflow: 'visible' }}>
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
            <div className="max-w-[85%] md:max-w-[75%]" style={{ overflow: 'visible' }}>
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
          <div className="max-w-[85%] md:max-w-[75%]" style={{ overflow: 'visible' }}>
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
      <div className={`flex ${isUser ? `justify-end` : `justify-start`} ${isUser ? 'mt-10 sm:mt-12 mb-0 sm:mb-10' : ''}`}>
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
                    <div className="relative">
                      <div 
                        className={`imessage-send-bubble ${longPressActive ? 'long-press-scaled' : ''}`}
                        ref={bubbleRef}
                        onTouchStart={handleUserTouchStart}
                        onTouchEnd={handleUserTouchEnd}
                        onTouchMove={handleUserTouchMove}
                        onClick={!isMobile ? (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleEditStartClick();
                        } : undefined}
                  style={{
                    WebkitTapHighlightColor: 'transparent',
                    WebkitTouchCallout: 'none',
                    WebkitUserSelect: 'none',
                    userSelect: 'none',
                    cursor: !isMobile ? 'pointer' : 'default',
                    transform: bubbleTransform,
                    transition: 'transform 0.3s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
                    boxShadow: 'none',
                    touchAction: longPressActive ? 'none' : 'auto',
                    overscrollBehavior: 'contain',
                    zIndex: longPressActive ? 10 : 'auto',
                    position: longPressActive ? 'relative' : 'static',
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
                      
                      {/* 롱프레스 드롭다운: Portal 사용으로 DOM 계층 분리 */}
                      {longPressActive && createPortal(
                        <>
                          {/* SVG 필터 정의: 유리 질감 왜곡 효과 */}
                          <svg style={{ position: 'absolute', width: 0, height: 0 }}>
                            <defs>
                              <filter id="glass-distortion" x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
                                <feTurbulence type="fractalNoise" baseFrequency="0.02 0.05" numOctaves="3" seed="7" result="noise" />
                                <feImage result="radialMask" preserveAspectRatio="none" x="0" y="0" width="100%" height="100%" xlinkHref="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><defs><radialGradient id='g' cx='50%25' cy='50%25' r='70%25'><stop offset='0%25' stop-color='black'/><stop offset='100%25' stop-color='white'/></radialGradient></defs><rect width='100%25' height='100%25' fill='url(%23g)'/></svg>" />
                                <feComposite in="noise" in2="radialMask" operator="arithmetic" k1="0" k2="0" k3="1" k4="0" result="modulatedNoise" />
                                <feGaussianBlur in="modulatedNoise" stdDeviation="0.3" edgeMode="duplicate" result="smoothNoise" />
                                <feDisplacementMap in="SourceGraphic" in2="smoothNoise" scale="18" xChannelSelector="R" yChannelSelector="G" />
                              </filter>
                            </defs>
                          </svg>
                          
                          <div 
                            className="fixed w-48 chat-input-tooltip-backdrop rounded-2xl z-[99999] overflow-hidden tool-selector"
                style={{
                  // 하이브리드 접근: 메시지 근처 우선, 화면 벗어날 때만 하단 고정
                  ...(() => {
                    if (!bubbleRef.current) return { display: 'none' };
                    const rect = bubbleRef.current.getBoundingClientRect();
                    const menuHeight = 120;
                    const margin = 16;
                    const viewportHeight = window.innerHeight;
                    const menuBottomMargin = 20;
                    
                    if (dropdownPosition === 'top') {
                      return {
                        top: `${rect.top - menuHeight - margin}px`,
                        right: '16px',
                        left: 'auto',
                        display: 'block'
                      };
                    } else {
                      // 1. 먼저 메시지 바로 아래에 메뉴를 배치해보기
                      const preferredMenuTop = rect.bottom + margin;
                      const preferredMenuBottom = preferredMenuTop + menuHeight;
                      
                      // 2. 메뉴가 화면을 벗어나는지 확인
                      const menuWouldGoOffscreen = preferredMenuBottom > viewportHeight - menuBottomMargin;
                      
                      if (menuWouldGoOffscreen) {
                        // 3. 화면을 벗어나면 하단에 고정
                        return {
                          top: `${viewportHeight - menuHeight - menuBottomMargin}px`,
                          right: '16px',
                          left: 'auto',
                          display: 'block'
                        };
                      } else {
                        // 4. 공간이 충분하면 메시지 바로 아래에 배치
                        return {
                          top: `${preferredMenuTop}px`,
                          right: '16px',
                          left: 'auto',
                          display: 'block'
                        };
                      }
                    }
                  })(),
                              // 기존 스타일 + 드롭다운
                              backgroundColor: 'rgba(255, 255, 255, 0.5)',
                              backdropFilter: isMobile ? 'blur(10px) saturate(180%)' : 'url(#glass-distortion) blur(10px) saturate(180%)',
                              WebkitBackdropFilter: isMobile ? 'blur(10px) saturate(180%)' : 'url(#glass-distortion) blur(10px) saturate(180%)',
                              border: '1px solid rgba(255, 255, 255, 0.2)',
                              boxShadow: '0 8px 40px rgba(0, 0, 0, 0.06), 0 4px 20px rgba(0, 0, 0, 0.04), 0 2px 8px rgba(0, 0, 0, 0.025), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
                              // 다크모드 전용 스타일
                              ...(typeof window !== 'undefined' && (
                                document.documentElement.getAttribute('data-theme') === 'dark' || 
                                (document.documentElement.getAttribute('data-theme') === 'system' && 
                                 window.matchMedia('(prefers-color-scheme: dark)').matches)
                              ) ? {
                                backgroundColor: 'rgba(0, 0, 0, 0.05)',
                                backdropFilter: isMobile ? 'blur(24px)' : 'url(#glass-distortion-dark) blur(24px)',
                                WebkitBackdropFilter: isMobile ? 'blur(24px)' : 'url(#glass-distortion-dark) blur(24px)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), 0 4px 16px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                              } : {})
                            }}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              // 드롭다운 내부 클릭은 닫지 않음
                            }}
                          >
                          <div className="flex flex-col gap-2 space-y-2">
                            {/* 편집 버튼 */}
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                e.nativeEvent.stopImmediatePropagation();
                                handleEditStartClick();
                                handleLongPressCancel();
                              }}
                              onTouchEnd={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                e.nativeEvent.stopImmediatePropagation();
                                handleEditStartClick();
                                handleLongPressCancel();
                              }}
                              className="flex items-center gap-3 px-5 pt-4 transition-colors duration-150 rounded-xl tool-button"
                              style={{
                                '--hover-bg': 'color-mix(in srgb, var(--foreground) 3%, transparent)',
                                '--active-bg': 'color-mix(in srgb, var(--foreground) 5%, transparent)',
                                WebkitTapHighlightColor: 'transparent',
                                WebkitTouchCallout: 'none',
                                WebkitUserSelect: 'none',
                                userSelect: 'none'
                              } as any}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--hover-bg)'}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                              onMouseDown={(e) => e.currentTarget.style.backgroundColor = 'var(--active-bg)'}
                              onMouseUp={(e) => e.currentTarget.style.backgroundColor = 'var(--hover-bg)'}
                            > 
                              <div className="w-6 h-6 flex items-center justify-center">
                                <IoCreateOutline size={20} style={{ color: 'var(--foreground)' }} />
                              </div>
                              <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Edit</span>
                            </button>

                            {/* 복사 버튼 */}
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                e.nativeEvent.stopImmediatePropagation();
                                onCopy(message);
                                handleLongPressCancel();
                              }}
                              onTouchEnd={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                e.nativeEvent.stopImmediatePropagation();
                                onCopy(message);
                                handleLongPressCancel();
                              }}
                              className="flex items-center gap-3 px-5 pb-4 transition-colors duration-150 rounded-xl tool-button"
                              style={{
                                '--hover-bg': 'color-mix(in srgb, var(--foreground) 3%, transparent)',
                                '--active-bg': 'color-mix(in srgb, var(--foreground) 5%, transparent)',
                                WebkitTapHighlightColor: 'transparent',
                                WebkitTouchCallout: 'none',
                                WebkitUserSelect: 'none',
                                userSelect: 'none'
                              } as any}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--hover-bg)'}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                              onMouseDown={(e) => e.currentTarget.style.backgroundColor = 'var(--active-bg)'}
                              onMouseUp={(e) => e.currentTarget.style.backgroundColor = 'var(--hover-bg)'}
                            >
                              <div className="w-6 h-6 flex items-center justify-center">
                                {isCopied ? (
                                  <IoCheckmarkOutline size={20} style={{ color: 'var(--status-text-complete)' }} />
                                ) : (
                                  <IoCopyOutline size={20} style={{ color: 'var(--foreground)' }} />
                                )}
                              </div>
                              <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                                {isCopied ? 'Copied' : 'Copy'}
                              </span>
                            </button>
                          </div>
                        </div>
                        </>,
                        typeof window !== 'undefined' ? document.body : (null as any)
                      )}
                    </div>
                  )}

                  {/* AI 메시지용 롱프레스 드롭다운: Portal 사용으로 DOM 계층 분리 */}
                  {longPressActive && isAssistant && createPortal(
                    <>
                      {/* SVG 필터 정의: 유리 질감 왜곡 효과 */}
                      <svg style={{ position: 'absolute', width: 0, height: 0 }}>
                        <defs>
                          <filter id="glass-distortion-ai" x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
                            <feTurbulence type="fractalNoise" baseFrequency="0.02 0.05" numOctaves="3" seed="7" result="noise" />
                            <feImage result="radialMask" preserveAspectRatio="none" x="0" y="0" width="100%" height="100%" xlinkHref="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><defs><radialGradient id='g' cx='50%25' cy='50%25' r='70%25'><stop offset='0%25' stop-color='black'/><stop offset='100%25' stop-color='white'/></defs><rect width='100%25' height='100%25' fill='url(%23g)'/></svg>" />
                            <feComposite in="noise" in2="radialMask" operator="arithmetic" k1="0" k2="0" k3="1" k4="0" result="modulatedNoise" />
                            <feGaussianBlur in="modulatedNoise" stdDeviation="0.3" edgeMode="duplicate" result="smoothNoise" />
                            <feDisplacementMap in="SourceGraphic" in2="smoothNoise" scale="18" xChannelSelector="R" yChannelSelector="G" />
                          </filter>
                        </defs>
                      </svg>
                      
                      <div 
                        className="fixed w-48 chat-input-tooltip-backdrop rounded-2xl z-[99999] overflow-hidden tool-selector"
                        style={{
                          // 메시지 버블 위치 계산
                          ...(() => {
                            if (!aiBubbleRef.current) return { display: 'none' };
                            const rect = aiBubbleRef.current.getBoundingClientRect();
                            const dropdownHeight = 120;
                            const margin = 16;
                            
                            if (dropdownPosition === 'top') {
                              return {
                                top: `${rect.top - dropdownHeight - margin}px`,
                                left: '16px', // 화면 좌측에서 16px 떨어진 고정 위치
                                right: 'auto',
                                display: 'block'
                              };
                            } else {
                              const menuHeight = 120;
                              const menuBottomMargin = 20;
                              const viewportHeight = window.innerHeight;
                              
                              const menuWouldGoOffscreen = rect.bottom + margin + menuHeight > viewportHeight;

                              if (menuWouldGoOffscreen) {
                                // 메뉴가 화면을 벗어날 경우: 화면 하단에 고정
                                const menuBottomMargin = 20;
                                return {
                                  top: `${viewportHeight - menuHeight - menuBottomMargin}px`,
                                  left: '16px',
                                  right: 'auto',
                                  display: 'block'
                                };
                              } else {
                                // 공간이 충분할 경우: 메시지 바로 아래에 위치
                                return {
                                  top: `${rect.bottom + margin}px`,
                                  left: '16px',
                                  right: 'auto',
                                  display: 'block'
                                };
                              }
                            }
                          })(),
                          // 기존 스타일 + 드롭다운
                          backgroundColor: 'rgba(255, 255, 255, 0.5)',
                          backdropFilter: isMobile ? 'blur(10px) saturate(180%)' : 'url(#glass-distortion-ai) blur(10px) saturate(180%)',
                          WebkitBackdropFilter: isMobile ? 'blur(10px) saturate(180%)' : 'url(#glass-distortion-ai) blur(10px) saturate(180%)',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          boxShadow: '0 8px 40px rgba(0, 0, 0, 0.06), 0 4px 20px rgba(0, 0, 0, 0.04), 0 2px 8px rgba(0, 0, 0, 0.025), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
                          // 다크모드 전용 스타일
                          ...(typeof window !== 'undefined' && (
                            document.documentElement.getAttribute('data-theme') === 'dark' || 
                            (document.documentElement.getAttribute('data-theme') === 'system' && 
                             window.matchMedia('(prefers-color-scheme: dark)').matches)
                          ) ? {
                            backgroundColor: 'rgba(0, 0, 0, 0.05)',
                            backdropFilter: isMobile ? 'blur(24px)' : 'url(#glass-distortion-ai) blur(24px)',
                            WebkitBackdropFilter: isMobile ? 'blur(24px)' : 'url(#glass-distortion-ai) blur(24px)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), 0 4px 16px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                          } : {})
                        }}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          // 드롭다운 내부 클릭은 닫지 않음
                        }}
                      >
                        <div className="flex flex-col gap-2 space-y-2">
                          {/* 재생성 버튼 */}
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              e.nativeEvent.stopImmediatePropagation();
                              onRegenerate(message.id)(e as any);
                              handleLongPressCancel();
                            }}
                            onTouchEnd={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              e.nativeEvent.stopImmediatePropagation();
                              onRegenerate(message.id)(e as any);
                              handleLongPressCancel();
                            }}
                            disabled={isRegenerating}
                            className="flex items-center gap-3 px-5 pt-4 transition-colors duration-150 rounded-xl tool-button"
                            style={{
                              '--hover-bg': 'color-mix(in srgb, var(--foreground) 3%, transparent)',
                              '--active-bg': 'color-mix(in srgb, var(--foreground) 5%, transparent)',
                              WebkitTapHighlightColor: 'transparent',
                              WebkitTouchCallout: 'none',
                              WebkitUserSelect: 'none',
                              userSelect: 'none',
                              opacity: isRegenerating ? 0.5 : 1
                            } as any}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--hover-bg)'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            onMouseDown={(e) => e.currentTarget.style.backgroundColor = 'var(--active-bg)'}
                            onMouseUp={(e) => e.currentTarget.style.backgroundColor = 'var(--hover-bg)'}
                          > 
                            <div className="w-6 h-6 flex items-center justify-center">
                              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={isRegenerating ? 'animate-spin' : ''} style={{ color: 'var(--foreground)' }}>
                                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                                <path d="M21 3v5h-5"/>
                                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                                <path d="M3 21v-5h5"/>
                              </svg>
                            </div>
                            <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                              {isRegenerating ? 'Regenerating...' : 'Regenerate'}
                            </span>
                          </button>

                          {/* 복사 버튼 */}
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              e.nativeEvent.stopImmediatePropagation();
                              onCopy(message);
                              handleLongPressCancel();
                            }}
                            onTouchEnd={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              e.nativeEvent.stopImmediatePropagation();
                              onCopy(message);
                              handleLongPressCancel();
                            }}
                            className="flex items-center gap-3 px-5 transition-colors duration-150 rounded-xl tool-button"
                            style={{
                              '--hover-bg': 'color-mix(in srgb, var(--foreground) 3%, transparent)',
                              '--active-bg': 'color-mix(in srgb, var(--foreground) 5%, transparent)',
                              WebkitTapHighlightColor: 'transparent',
                              WebkitTouchCallout: 'none',
                              WebkitUserSelect: 'none',
                              userSelect: 'none'
                            } as any}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--hover-bg)'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            onMouseDown={(e) => e.currentTarget.style.backgroundColor = 'var(--active-bg)'}
                            onMouseUp={(e) => e.currentTarget.style.backgroundColor = 'var(--hover-bg)'}
                          >
                            <div className="w-6 h-6 flex items-center justify-center">
                              {isCopied ? (
                                <IoCheckmarkOutline size={20} style={{ color: 'var(--status-text-complete)' }} />
                              ) : (
                                <IoCopyOutline size={20} style={{ color: 'var(--foreground)' }} />
                              )}
                            </div>
                            <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                              {isCopied ? 'Copied' : 'Copy'}
                            </span>
                          </button>

                          {/* 북마크 버튼 */}
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              e.nativeEvent.stopImmediatePropagation();
                              toggleBookmark(e as any);
                              handleLongPressCancel();
                            }}
                            onTouchEnd={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              e.nativeEvent.stopImmediatePropagation();
                              toggleBookmark(e as any);
                              handleLongPressCancel();
                            }}
                            disabled={isBookmarksLoading}
                            className="flex items-center gap-3 px-5 pb-4 transition-colors duration-150 rounded-xl tool-button"
                            style={{
                              '--hover-bg': 'color-mix(in srgb, var(--foreground) 3%, transparent)',
                              '--active-bg': 'color-mix(in srgb, var(--foreground) 5%, transparent)',
                              WebkitTapHighlightColor: 'transparent',
                              WebkitTouchCallout: 'none',
                              WebkitUserSelect: 'none',
                              userSelect: 'none',
                              opacity: isBookmarksLoading ? 0.5 : 1
                            } as any}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--hover-bg)'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            onMouseDown={(e) => e.currentTarget.style.backgroundColor = 'var(--active-bg)'}
                            onMouseUp={(e) => e.currentTarget.style.backgroundColor = 'var(--hover-bg)'}
                          >
                            <div className="w-6 h-6 flex items-center justify-center">
                              {isBookmarked ? (
                                <IoBookmark size={20} style={{ color: 'var(--foreground)' }} className={isBookmarksLoading ? "animate-pulse" : ""} />
                              ) : (
                                <IoBookmarkOutline size={20} style={{ color: 'var(--foreground)' }} className={isBookmarksLoading ? "animate-pulse" : ""} />
                              )}
                            </div>
                            <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                              {isBookmarked ? 'Remove bookmark' : 'Bookmark'}
                            </span>
                          </button>
                        </div>
                      </div>
                    </>,
                    typeof window !== 'undefined' ? document.body : (null as any)
                  )}
                  <div className="text-[10px] text-neutral-500 mt-1 pr-1 h-[14px]">
                    {isLastUserMessage && formatMessageTime((message as any).createdAt || new Date())}
                  </div>
                </div>              
              </div>
            )}
          </div>
        ) : (
          <>
          {(hasAnyRenderableContent || structuredDescription) && (
            <div className="relative">
              <div 
                className={`imessage-receive-bubble ${longPressActive ? 'long-press-scaled' : ''}`} 
                ref={aiBubbleRef} 
                style={{ 
                  overflow: 'visible',
                  WebkitTapHighlightColor: 'transparent',
                  WebkitTouchCallout: 'none',
                  WebkitUserSelect: 'none',
                  userSelect: 'none',
                  cursor: 'default',
                  transform: bubbleTransform,
                  transition: 'transform 0.3s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
                  boxShadow: 'none',
                  touchAction: longPressActive ? 'none' : 'auto',
                  overscrollBehavior: 'contain',
                  zIndex: longPressActive ? 10 : 'auto',
                  position: longPressActive ? 'relative' : 'static',
                }}
                onTouchStart={handleAITouchStart}
                onTouchEnd={handleAITouchEnd}
                onTouchMove={handleAITouchMove}
              >
                <div 
                  className="imessage-content-wrapper space-y-4"
                  style={{
                    pointerEvents: longPressActive && isMobile ? 'none' : 'auto',
                  }}
                >
                  {/* 기존 컨텐츠 렌더링 로직 */}
                  {hasAttachments && (allAttachments as any[])!.map((attachment: any, index: number) => (
                    <AttachmentPreview key={`${message.id}-att-${index}`} attachment={attachment} />
                  ))}
                
                  {message.parts ? (
                    processedParts?.map((part: any, index: number) => (
                      part.type === 'text' && <MarkdownContent key={index} content={part.text} enableSegmentation={isAssistant} searchTerm={searchTerm} messageType={isAssistant ? 'assistant' : 'user'} thumbnailMap={thumbnailMap} titleMap={titleMap} isMobile={isMobile}/>
                    ))
                  ) : (
                    (hasContent && !hasStructuredData) && <MarkdownContent content={processedContent} enableSegmentation={isAssistant} searchTerm={searchTerm} messageType={isAssistant ? 'assistant' : 'user'} thumbnailMap={thumbnailMap} titleMap={titleMap} isMobile={isMobile}/>
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
            </div>
          )}

          {/* AI 메시지용 롱프레스 드롭다운: Portal 사용으로 DOM 계층 분리 */}
          {longPressActive && isAssistant && createPortal(
            <>
              {/* SVG 필터 정의: 유리 질감 왜곡 효과 */}
              <svg style={{ position: 'absolute', width: 0, height: 0 }}>
                <defs>
                  <filter id="glass-distortion-ai" x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
                    <feTurbulence type="fractalNoise" baseFrequency="0.02 0.05" numOctaves="3" seed="7" result="noise" />
                    <feImage result="radialMask" preserveAspectRatio="none" x="0" y="0" width="100%" height="100%" xlinkHref="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><defs><radialGradient id='g' cx='50%25' cy='50%25' r='70%25'><stop offset='0%25' stop-color='black'/><stop offset='100%25' stop-color='white'/></defs><rect width='100%25' height='100%25' fill='url(%23g)'/></svg>" />
                    <feComposite in="noise" in2="radialMask" operator="arithmetic" k1="0" k2="0" k3="1" k4="0" result="modulatedNoise" />
                    <feGaussianBlur in="modulatedNoise" stdDeviation="0.3" edgeMode="duplicate" result="smoothNoise" />
                    <feDisplacementMap in="SourceGraphic" in2="smoothNoise" scale="18" xChannelSelector="R" yChannelSelector="G" />
                  </filter>
                </defs>
              </svg>
              
              <div 
                className="fixed w-48 chat-input-tooltip-backdrop rounded-2xl z-[99999] overflow-hidden tool-selector"
                style={{
                  // 미리 계산된 메뉴 위치 사용 (glitch 완전 방지)
                  ...(() => {
                    if (!aiBubbleRef.current) return { display: 'none' };
                    
                    // 미리 계산된 위치가 있으면 사용, 없으면 실시간 계산
                    if (preCalculatedMenuPosition) {
                      return preCalculatedMenuPosition;
                    }
                    
                    // fallback: 실시간 계산
                    const rect = aiBubbleRef.current.getBoundingClientRect();
                    const menuHeight = 120;
                    const margin = 16;
                    const viewportHeight = window.innerHeight;
                    const menuBottomMargin = 20;
                    
                    if (dropdownPosition === 'top') {
                      return {
                        top: `${rect.top - menuHeight - margin}px`,
                        left: '16px',
                        right: 'auto',
                        display: 'block'
                      };
                    } else {
                      // 1. 먼저 메시지 바로 아래에 메뉴를 배치해보기 (원본 위치 기준)
                      const preferredMenuTop = rect.bottom + margin;
                      const preferredMenuBottom = preferredMenuTop + menuHeight;
                      
                      // 2. 메뉴가 화면을 벗어나는지 확인
                      const menuWouldGoOffscreen = preferredMenuBottom > viewportHeight - menuBottomMargin;
                      
                      if (menuWouldGoOffscreen) {
                        // 3. 화면을 벗어나면 하단에 고정
                        return {
                          top: `${viewportHeight - menuHeight - menuBottomMargin}px`,
                          left: '16px',
                          right: 'auto',
                          display: 'block'
                        };
                      } else {
                        // 4. 공간이 충분하면 메시지 바로 아래에 배치 (약간의 여유 공간 추가)
                        return {
                          top: `${preferredMenuTop + 2}px`, // 2px 여유 공간 추가
                          left: '16px',
                          right: 'auto',
                          display: 'block'
                        };
                      }
                    }
                  })(),
                  // 기존 스타일 + 드롭다운
                  backgroundColor: 'rgba(255, 255, 255, 0.5)',
                  backdropFilter: isMobile ? 'blur(10px) saturate(180%)' : 'url(#glass-distortion-ai) blur(10px) saturate(180%)',
                  WebkitBackdropFilter: isMobile ? 'blur(10px) saturate(180%)' : 'url(#glass-distortion-ai) blur(10px) saturate(180%)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  boxShadow: '0 8px 40px rgba(0, 0, 0, 0.06), 0 4px 20px rgba(0, 0, 0, 0.04), 0 2px 8px rgba(0, 0, 0, 0.025), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
                  // 다크모드 전용 스타일
                  ...(typeof window !== 'undefined' && (
                    document.documentElement.getAttribute('data-theme') === 'dark' || 
                    (document.documentElement.getAttribute('data-theme') === 'system' && 
                     window.matchMedia('(prefers-color-scheme: dark)').matches)
                  ) ? {
                    backgroundColor: 'rgba(0, 0, 0, 0.05)',
                    backdropFilter: isMobile ? 'blur(24px)' : 'url(#glass-distortion-ai) blur(24px)',
                    WebkitBackdropFilter: isMobile ? 'blur(24px)' : 'url(#glass-distortion-ai) blur(24px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), 0 4px 16px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                  } : {})
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  // 드롭다운 내부 클릭은 닫지 않음
                }}
              >
                <div className="flex flex-col gap-2 space-y-2">
                  {/* 재생성 버튼 */}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      e.nativeEvent.stopImmediatePropagation();
                      onRegenerate(message.id)(e as any);
                      handleLongPressCancel();
                    }}
                    onTouchEnd={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      e.nativeEvent.stopImmediatePropagation();
                      onRegenerate(message.id)(e as any);
                      handleLongPressCancel();
                    }}
                    disabled={isRegenerating}
                    className="flex items-center gap-3 px-5 pt-4 transition-colors duration-150 rounded-xl tool-button"
                    style={{
                      '--hover-bg': 'color-mix(in srgb, var(--foreground) 3%, transparent)',
                      '--active-bg': 'color-mix(in srgb, var(--foreground) 5%, transparent)',
                      WebkitTapHighlightColor: 'transparent',
                      WebkitTouchCallout: 'none',
                      WebkitUserSelect: 'none',
                      userSelect: 'none',
                      opacity: isRegenerating ? 0.5 : 1
                    } as any}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--hover-bg)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    onMouseDown={(e) => e.currentTarget.style.backgroundColor = 'var(--active-bg)'}
                    onMouseUp={(e) => e.currentTarget.style.backgroundColor = 'var(--hover-bg)'}
                  > 
                    <div className="w-6 h-6 flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={isRegenerating ? 'animate-spin' : ''} style={{ color: 'var(--foreground)' }}>
                        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                        <path d="M21 3v5h-5"/>
                        <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                        <path d="M3 21v-5h5"/>
                      </svg>
                    </div>
                    <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                      {isRegenerating ? 'Regenerating...' : 'Regenerate'}
                    </span>
                  </button>

                  {/* 복사 버튼 */}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      e.nativeEvent.stopImmediatePropagation();
                      onCopy(message);
                      handleLongPressCancel();
                    }}
                    onTouchEnd={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      e.nativeEvent.stopImmediatePropagation();
                      onCopy(message);
                      handleLongPressCancel();
                    }}
                    className="flex items-center gap-3 px-5 transition-colors duration-150 rounded-xl tool-button"
                    style={{
                      '--hover-bg': 'color-mix(in srgb, var(--foreground) 3%, transparent)',
                      '--active-bg': 'color-mix(in srgb, var(--foreground) 5%, transparent)',
                      WebkitTapHighlightColor: 'transparent',
                      WebkitTouchCallout: 'none',
                      WebkitUserSelect: 'none',
                      userSelect: 'none'
                    } as any}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--hover-bg)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    onMouseDown={(e) => e.currentTarget.style.backgroundColor = 'var(--active-bg)'}
                    onMouseUp={(e) => e.currentTarget.style.backgroundColor = 'var(--hover-bg)'}
                  >
                    <div className="w-6 h-6 flex items-center justify-center">
                      {isCopied ? (
                        <IoCheckmarkOutline size={20} style={{ color: 'var(--status-text-complete)' }} />
                      ) : (
                        <IoCopyOutline size={20} style={{ color: 'var(--foreground)' }} />
                      )}
                    </div>
                    <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                      {isCopied ? 'Copied' : 'Copy'}
                    </span>
                  </button>

                  {/* 북마크 버튼 */}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      e.nativeEvent.stopImmediatePropagation();
                      toggleBookmark(e as any);
                      handleLongPressCancel();
                    }}
                    onTouchEnd={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      e.nativeEvent.stopImmediatePropagation();
                      toggleBookmark(e as any);
                      handleLongPressCancel();
                    }}
                    disabled={isBookmarksLoading}
                    className="flex items-center gap-3 px-5 pb-4 transition-colors duration-150 rounded-xl tool-button"
                    style={{
                      '--hover-bg': 'color-mix(in srgb, var(--foreground) 3%, transparent)',
                      '--active-bg': 'color-mix(in srgb, var(--foreground) 5%, transparent)',
                      WebkitTapHighlightColor: 'transparent',
                      WebkitTouchCallout: 'none',
                      WebkitUserSelect: 'none',
                      userSelect: 'none',
                      opacity: isBookmarksLoading ? 0.5 : 1
                    } as any}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--hover-bg)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    onMouseDown={(e) => e.currentTarget.style.backgroundColor = 'var(--active-bg)'}
                    onMouseUp={(e) => e.currentTarget.style.backgroundColor = 'var(--hover-bg)'}
                  >
                    <div className="w-6 h-6 flex items-center justify-center">
                      {isBookmarked ? (
                        <IoBookmark size={20} style={{ color: 'var(--foreground)' }} className={isBookmarksLoading ? "animate-pulse" : ""} />
                      ) : (
                        <IoBookmarkOutline size={20} style={{ color: 'var(--foreground)' }} className={isBookmarksLoading ? "animate-pulse" : ""} />
                      )}
                    </div>
                    <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                      {isBookmarked ? 'Remove bookmark' : 'Bookmark'}
                    </span>
                  </button>
                </div>
              </div>
            </>,
            typeof window !== 'undefined' ? document.body : (null as any)
          )}
        </>
      )}
    </div>
      {isAssistant && !isStreaming && (
        <div className={`flex justify-start mt-2 mb-0 gap-2 items-center transition-opacity duration-300 ${
          isMobile 
            ? 'hidden' 
            : 'opacity-0 md:group-hover:opacity-100'
        }`}>
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
          
          {/* Model name with logo */}
          <ModelNameWithLogo modelId={(message as ExtendedMessage).model || currentModel} />
        </div>
      )}
      {/* Add follow-up questions for the last assistant message */}
      {isAssistant && isLastMessage && !isGlobalLoading && !isStreaming && handleFollowUpQuestionClick && allMessages && chatId && (
        <div 
          className="follow-up-questions-section"
          style={{
            zIndex: longPressActive ? 1 : 'auto',
            position: longPressActive ? 'relative' : 'static'
          }}
        >
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
    </div>
  );
});


export { Message }; 






