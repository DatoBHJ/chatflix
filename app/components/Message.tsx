import type { Message as AIMessage } from 'ai'
import { IconCheck, IconCopy, IconRefresh } from './icons'
import { ReasoningSection } from './ReasoningSection'
import { MarkdownContent } from './MarkdownContent' // MarkdownContent import 확인
import { ExtendedMessage } from '../chat/[id]/types'
import { getModelById } from '@/lib/models/config'
import { Attachment } from '@/lib/types'
import React, { memo, useCallback, useState, useEffect, useMemo, useRef } from 'react'
import Image from 'next/image'
import { createClient } from '@/utils/supabase/client' // createClient import 추가
import { useRouter } from 'next/navigation'; // useRouter import 추가
import { XLogo, YouTubeLogo } from './CanvasFolder/CanvasLogo';
import { Brain, ChevronDown, ChevronUp, Search, Calculator, Link2, ImageIcon, BookOpen, Youtube, FileText, Download, Copy, Check, Wrench, Monitor } from 'lucide-react'
import { getProviderLogo, hasLogo } from '@/app/lib/models/logoUtils';
import { AttachmentPreview } from './Attachment'
import { PlanningSection } from './PlanningSection'; // Import PlanningSection
import { FileUploadButton, fileHelpers } from './ChatInput/FileUpload'; // FileUpload 컴포넌트들 임포트
import { DragDropOverlay } from './ChatInput/DragDropOverlay'; // DragDropOverlay 추가
import { 
  File, 
  getStructuredResponseMainContent, 
  getStructuredResponseDescription, 
  isStructuredResponseInProgress, 
  extractReasoningForMessage // Added import
} from '@/app/lib/messageUtils';

// Model name with logo component
const ModelNameWithLogo = ({ modelId }: { modelId: string }) => {
  const model = getModelById(modelId);
  
  if (!model) {
    return (
      <div className="text-xs text-[var(--muted)] uppercase tracking-wider">
        {modelId}
      </div>
    );
  }
  
  // Always use abbreviation when available
  const displayName = model.abbreviation || model.name || modelId;
  
  return (
    <div className="flex items-center gap-1.5">
      {/* Provider Logo */}
      {model.provider && hasLogo(model.provider) && (
        <div className="w-3.5 h-3.5 flex-shrink-0 rounded-full overflow-hidden border border-[color-mix(in_srgb,var(--foreground)_10%,transparent)]">
          <Image 
            src={getProviderLogo(model.provider, model.id)}
            alt={`${model.provider} logo`}
            width={14}
            height={14}
            className="object-contain"
          />
        </div>
      )}
      <div className="text-xs text-[var(--muted)] uppercase tracking-wider">
        {displayName}
      </div>
    </div>
  );
};

// Model capability badges component
const ModelCapabilityBadges = ({ modelId }: { modelId: string }) => {
  const model = getModelById(modelId);
  if (!model) return null;
  
  // Add state to check if on mobile
  const [isMobile, setIsMobile] = useState(false);
  
  // Check if mobile on mount and window resize
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 640); // sm breakpoint
    };
    
    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);
    return () => window.removeEventListener('resize', checkIfMobile);
  }, []);
  
  return (
    <div className="flex items-center gap-2">
      {/* Knowledge Cutoff - New badge */}
      {model.cutoff && (
        <div 
          className="rounded-full px-1.5 py-0.5 text-xs flex items-center gap-1 hover:bg-[var(--foreground)]/5" 
          title={`Knowledge Cutoff: ${model.cutoff} - This model's training data includes information up until this date. It may not be aware of events, facts, or developments that occurred after this date.`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
            <path d="M12.75 12.75a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM7.5 15.75a.75.75 0 100-1.5.75.75 0 000 1.5zM8.25 17.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM9.75 15.75a.75.75 0 100-1.5.75.75 0 000 1.5zM10.5 17.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12 15.75a.75.75 0 100-1.5.75.75 0 000 1.5zM12.75 17.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM14.25 15.75a.75.75 0 100-1.5.75.75 0 000 1.5zM15 17.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM16.5 15.75a.75.75 0 100-1.5.75.75 0 000 1.5zM15 12.75a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM16.5 13.5a.75.75 0 100-1.5.75.75 0 000 1.5z" />
            <path fillRule="evenodd" d="M6.75 2.25A.75.75 0 017.5 3v1.5h9V3A.75.75 0 0118 3v1.5h.75a3 3 0 013 3v11.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3V7.5a3 3 0 013-3H6V3a.75.75 0 01.75-.75zm13.5 9a1.5 1.5 0 00-1.5-1.5H5.25a1.5 1.5 0 00-1.5 1.5v7.5a1.5 1.5 0 001.5 1.5h13.5a1.5 1.5 0 001.5-1.5v-7.5z" clipRule="evenodd" />
          </svg>
          {!isMobile && (
            <span className="text-xs">{model.cutoff}</span>
          )}
        </div>
      )}

      {/* Vision/Image Support - existing badge */}
      <div className={`rounded-full px-1.5 py-0.5 text-xs flex items-center gap-1 ${ 
        model.supportsVision 
          ? 'bg-[var(--accent)]/20' 
          : 'bg-[var(--muted)]/20'
      }`} title={model.supportsVision ? "Supports image input" : "Text-only model"}>
        {model.supportsVision ? (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
            <path d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
            <path d="M3.53 2.47a.75.75 0 0 0-1.06 1.06l18 18a.75.75 0 1 0 1.06-1.06l-18-18ZM22.676 12.553a11.249 11.249 0 0 1-2.631 4.31l-3.099-3.099a5.25 5.25 0 0 0-6.71-6.71L7.759 4.577a11.217 11.217 0 0 1 4.242-.827c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113Z" />
            <path d="M15.75 12c0 .18-.013.357-.037.53l-4.244-4.243A3.75 3.75 0 0 1 15.75 12ZM12.53 15.713l-4.243-4.244a3.75 3.75 0 0 0 4.244 4.243Z" />
            <path d="M6.75 12c0-.619.107-1.213.304-1.764l-3.1-3.1a11.25 11.25 0 0 0-2.63 4.31c-.12.362-.12.752 0 1.114 1.489 4.467 5.704 7.69 10.675 7.69 1.5 0 2.933-.294 4.242-.827l-2.477-2.477A5.25 5.25 0 0 1 6.75 12Z" />
          </svg>
        )}
        {/* Show text only on desktop */}
        {!isMobile && (
          <span className="text-[9px] font-medium">
            {model.supportsVision ? 'Image' : 'Text-only'}
          </span>
        )}
      </div>
      
      {/* PDF Support - Use the exact ModelSelector.tsx styling */}
      {model.supportsPDFs && (
        <div className="rounded-full px-1.5 py-0.5 text-xs bg-[var(--accent)]/20 flex items-center gap-1" title="Can process PDF documents">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
            <path fillRule="evenodd" d="M5.625 1.5H9a3.75 3.75 0 013.75 3.75v1.875c0 1.036.84 1.875 1.875 1.875H16.5a3.75 3.75 0 013.75 3.75v7.875c0 1.035-.84 1.875-1.875 1.875H5.625a1.875 1.875 0 01-1.875-1.875V3.375c0-1.036.84-1.875 1.875-1.875zM9.75 14.25a.75.75 0 000 1.5H15a.75.75 0 000-1.5H9.75z" clipRule="evenodd" />
            <path d="M14.25 5.25a5.23 5.23 0 00-1.279-3.434 9.768 9.768 0 016.963 6.963A5.23 5.23 0 0016.5 7.5h-1.875a.375.375 0 01-.375-.375V5.25z" />
          </svg>
          {/* Show text only on desktop */}
          {!isMobile && <span className="text-[9px] font-medium">PDF</span>}
        </div>
      )}
      
      {/* Censorship Status - Use the exact ModelSelector.tsx styling */}
      {typeof model.censored !== 'undefined' && (
        <div className={`rounded-full px-1.5 py-0.5 text-xs flex items-center gap-1 ${ 
          model.censored 
            ? 'bg-[#FFA07A]/20' 
            : 'bg-[#90EE90]/20'
        }`} title={model.censored ? "Content may be filtered" : "Uncensored"}>
          {model.censored ? (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
              <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 0 0-5.25 5.25v3a3 3 0 0 0-3 3v6.75a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3v-6.75a3 3 0 0 0-3-3v-3c0-2.9-2.35-5.25-5.25-5.25Zm3.75 8.25v-3a3.75 3.75 0 1 0-7.5 0v3h7.5Z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
              <path d="M18 1.5c2.9 0 5.25 2.35 5.25 5.25v3.75a.75.75 0 0 1-1.5 0V6.75a3.75 3.75 0 1 0-7.5 0v3a3 3 0 0 1 3 3v6.75a3 3 0 0 1-3 3H3.75a3 3 0 0 1-3-3v-6.75a3 3 0 0 1 3-3h9v-3c0-2.9 2.35-5.25 5.25-5.25Z" />
            </svg>
          )}
          {/* Show text only on desktop */}
          {!isMobile && (
            <span className="text-[9px] font-medium">
              {model.censored ? 'Censored' : 'Uncensored'}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

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
  togglePanel?: (messageId: string, type: 'canvas' | 'structuredResponse', fileIndex?: number) => void
  // Canvas 데이터 props 추가
  webSearchData?: any
  mathCalculationData?: any
  linkReaderData?: any
  imageGeneratorData?: any
  academicSearchData?: any
  xSearchData?: any
  youTubeSearchData?: any
  youTubeLinkAnalysisData?: any
}

// Update the helper function to check if reasoning is complete
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

// URL을 자동으로 감지하여 링크로 변환하는 유틸리티 함수 추가
function linkifyText(text: string) {
  // URL 패턴 (http, https로 시작하는 URL 감지)
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  
  const parts = text.split(urlRegex);
  const result = [];
  
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part.match(urlRegex)) {
      // URL인 경우 a 태그로 감싸기
      result.push(
        <a 
          key={i} 
          href={part} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-blue-500 hover:underline break-all"
        >
          {part}
        </a>
      );
    } else if (part) {
      // 일반 텍스트인 경우 그대로 추가
      result.push(<React.Fragment key={i}>{part}</React.Fragment>);
    }
  }
  
  return result;
}

// 사용자 메시지 전용 렌더링 컴포넌트
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
  // 줄바꿈 처리 (텍스트에서 \\n을 <br />로 변환)
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
        whiteSpace: 'pre-wrap',        // 공백과 줄바꿈 보존
        wordBreak: 'break-word',       // 긴 단어 줄바꿈
        overflowWrap: 'break-word',    // 긴 단어가 컨테이너를 넘어갈 때 줄바꿈
      }}
      onClick={onClick}
    >
      {processedContent}
      {showGradient && (
        <div 
          className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-[var(--accent)] to-transparent pointer-events-none"
        />
      )}
    </div>
  );
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
  chatId,
  isStreaming = false,
  isWaitingForToolResults = false,
  messageHasCanvasData,
  activePanelMessageId,
  togglePanel,
  webSearchData,
  mathCalculationData,
  linkReaderData,
  imageGeneratorData,
  academicSearchData,
  xSearchData,
  youTubeSearchData,
  youTubeLinkAnalysisData,
}: MessageProps) {

  // Bookmark state
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isBookmarkLoading, setIsBookmarkLoading] = useState(false);

  // Get current user
  const [user, setUser] = useState<any>(null);
  
  // 파일 관련 상태
  // const [openFileIndexes, setOpenFileIndexes] = useState<number[]>([]);
  // const [structuredFiles, setStructuredFiles] = useState<File[] | null>(null);
  // const [isResponseInProgress, setIsResponseInProgress] = useState(false);
  
  // 편집 모드용 파일 상태 추가
  const [editingFiles, setEditingFiles] = useState<globalThis.File[]>([]);
  const [editingFileMap, setEditingFileMap] = useState<Map<string, { file: globalThis.File, url: string }>>(new Map());
  const [dragActive, setDragActive] = useState(false); // 드래그 상태 추가
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editingContainerRef = useRef<HTMLDivElement>(null); // 편집 컨테이너 참조 추가
  
  // Agent Reasoning 관련 상태 (for "Selecting Tools" section)
  const [currentReasoning, setCurrentReasoning] = useState<any>(null);
  const [reasoningExpanded, setReasoningExpanded] = useState(false); // Default to closed
  const [reasoningContentHeight, setReasoningContentHeight] = useState<number | undefined>(undefined);
  const reasoningContentRef = useRef<HTMLDivElement>(null);
  const userOverrideReasoningRef = useRef<boolean | null>(null);
  const prevIsReasoningCompleteRef = useRef<boolean | undefined>(undefined);
  // const prevReasoningContentRef = useRef<any>(null); // Not strictly needed if only relying on isComplete and userOverride
  
  // Planning 관련 상태 - 이제 PlanningSection에서 관리됩니다.
  const [currentPlanning, setCurrentPlanning] = useState<any>(null);
  
  // Use useMemo to derive reasoning data from the message prop with stable dependencies
  const derivedReasoningData = useMemo(() => {
    return extractReasoningForMessage(message);
  }, [
    message.id,
    message.annotations?.length,
    JSON.stringify(message.annotations?.filter(a => 
      a && typeof a === 'object' && 'type' in a && 
      (a.type === 'agent_reasoning' || a.type === 'agent_reasoning_progress')
    )),
    JSON.stringify((message as any).tool_results?.agentReasoning)
  ]);
  
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
  
  // Measure reasoning content height when content changes
  useEffect(() => {
    if (reasoningContentRef.current && currentReasoning && reasoningExpanded) {
      const newHeight = reasoningContentRef.current.scrollHeight;
      if (reasoningContentHeight !== newHeight) {
        setReasoningContentHeight(newHeight);
      }
      reasoningContentRef.current.scrollTop = reasoningContentRef.current.scrollHeight;
    }
  }, [
    currentReasoning?.agentThoughts,
    currentReasoning?.selectionReasoning,
    reasoningExpanded,
    reasoningContentHeight
  ]);

  // Auto-collapse/expand for "Selecting Tools" (Agent Reasoning section)
  useEffect(() => {
    // Ensure currentReasoning data is available
    if (!currentReasoning) {
      if (reasoningExpanded) {
        setReasoningExpanded(false);
      }
      userOverrideReasoningRef.current = null; // Reset override if no data
      return;
    }

    const isSectionComplete = currentReasoning?.isComplete;

    // Reset user override if the reasoning section logically restarts 
    // (e.g., goes from complete to incomplete for a new analysis).
    if (prevIsReasoningCompleteRef.current === true && isSectionComplete === false) {
      userOverrideReasoningRef.current = null;
      // When a new reasoning phase starts, ensure it's closed by default.
      if (reasoningExpanded) {
        setReasoningExpanded(false);
      }
    }

    // If user has manually toggled the section, respect their choice.
    if (userOverrideReasoningRef.current !== null) {
      if (reasoningExpanded !== userOverrideReasoningRef.current) {
        setReasoningExpanded(userOverrideReasoningRef.current);
      }
    } else {
      // If no user override, it remains in its current state (which would be closed by default
      // or after a reset). No automatic opening.
      // It only auto-closes if it was somehow open and then completes without user override.
      if (reasoningExpanded && isSectionComplete) { 
        setReasoningExpanded(false);
      } else if (userOverrideReasoningRef.current === null && reasoningExpanded) {
        // Ensures that if userOverride is cleared, it respects the default closed state
        setReasoningExpanded(false);
      }
    }
    prevIsReasoningCompleteRef.current = isSectionComplete;
  }, [
    currentReasoning?.isComplete,
    currentReasoning?.agentThoughts,
    reasoningExpanded
  ]); // More specific dependencies
  
  
  // Fetch user data when component mounts
  useEffect(() => {
    const fetchUser = async () => {
      const supabase = createClient(); // supabase client 생성
      const { data: { user: authUser } } = await supabase.auth.getUser();
      setUser(authUser);
    };

    fetchUser();
  }, []);
  
  // 구조화된 응답 파일 목록 가져오기
  // useEffect(() => {
  //   const files = getStructuredResponseFiles(message);
  //   const inProgress = isStructuredResponseInProgress(message);
    
  //   setStructuredFiles(files);
  //   setIsResponseInProgress(inProgress);
    
  //   // 생성 중일 때는 모든 파일을 열고, 완료되면 모두 닫기
  //   if (inProgress && files && files.length > 0) {
  //     // 생성 중일 때는 모든 파일 열기
  //     setOpenFileIndexes(files.map((_, idx) => idx));
  //   } else if (!inProgress && isResponseInProgress) {
  //     // 생성이 완료되면 모든 파일 닫기
  //     setOpenFileIndexes([]);
  //   }
  // }, [message, message.annotations]);
  
  // Agent Reasoning 데이터 처리 (Canvas와 동일한 로직)
  useEffect(() => {
    const newReasoningData = derivedReasoningData.completeData || derivedReasoningData.progressData || null;
    
    // Only update if the actual content has changed
    if (JSON.stringify(currentReasoning) !== JSON.stringify(newReasoningData)) {
      setCurrentReasoning(newReasoningData);
    }
  }, [derivedReasoningData, currentReasoning]); // Only depend on derivedReasoningData

  // Planning 데이터 처리 (progress/partial 무시, 마지막 결과만)
  useEffect(() => {
    const annotations = (message.annotations || []) as any[];
    // 마지막 planning 결과만 사용
    const planningAnnotations = annotations.filter(
      (annotation) => annotation?.type === 'agent_reasoning_progress' && annotation?.data?.stage === 'planning'
    );
    
    let newPlanningState = null;
    
    if (planningAnnotations.length > 0) {
      const latestPlanning = planningAnnotations[planningAnnotations.length - 1];
      const planningData = latestPlanning?.data;
      if (planningData && planningData.plan) {
        newPlanningState = {
          planningThoughts: planningData.plan,
          isComplete: planningData.isComplete || false,
          timestamp: planningData.timestamp
        };
      }
    } else {
      // tool_results에서 마지막 결과만 사용
      const extendedMessage = message as any;
      const toolResults = extendedMessage?.tool_results;
      const agentReasoning = toolResults?.agentReasoning;
      if (agentReasoning && agentReasoning.plan) {
        newPlanningState = {
          planningThoughts: agentReasoning.plan,
          isComplete: true,
          timestamp: agentReasoning.timestamp
        };
      }
    }
    
    // Only update if the actual content has changed
    if (JSON.stringify(currentPlanning) !== JSON.stringify(newPlanningState)) {
      setCurrentPlanning(newPlanningState);
    }
  }, [
    message.id,
    JSON.stringify(message.annotations?.filter(a => 
      a && typeof a === 'object' && 'type' in a && 
      a.type === 'agent_reasoning_progress' && 
      (a as any).data?.stage === 'planning'
    )),
    JSON.stringify((message as any).tool_results?.agentReasoning?.plan),
    currentPlanning
  ]);

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
    // Next.js 13+ app router에서는 window.location 사용 가능 (권장되지는 않음)
    window.location.href = '/user-insights';
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
  
  // 로딩 상태에서도 Agent Reasoning 표시 (isAssistant + 로딩 중)
  if (isAssistant && (!hasAnyContent || isWaitingForToolResults || isStreaming)) {
    // Look for reasoning parts in the message even during streaming
    const reasoningPart = message.parts?.find(part => part.type === 'reasoning');
    const reasoningComplete = isReasoningComplete(message);
    
    // 구독 상태 확인
    const subscriptionAnnotation = message.annotations?.find(
      (annotation) => annotation && typeof annotation === 'object' && 'type' in annotation && annotation.type === 'subscription_status'
    ) as any;
    
    // rate limit 상태 확인
    const rateLimitAnnotation = message.annotations?.find(
      (annotation) => annotation && typeof annotation === 'object' && 'type' in annotation && annotation.type === 'rate_limit_status'
    ) as any;

    return (
      <div className="message-group group animate-fade-in overflow-hidden" id={message.id}>
        <div className="message-role">
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
        </div>
        <div className="flex justify-start">
          <div className="message-assistant max-w-full">
            {/* Show planning section first */}
            {currentPlanning && (
               <PlanningSection planningData={currentPlanning} />
            )}
            {/* Show agent reasoning section - only show when it has meaningful tool selection data */}
            {currentReasoning && (currentReasoning.agentThoughts || currentReasoning.selectionReasoning || (currentReasoning.selectedTools && currentReasoning.selectedTools.length > 0)) && (
              <div className="p-4 sm:p-5 bg-gradient-to-br from-[color-mix(in_srgb,var(--background)_97%,var(--foreground)_3%)] to-[color-mix(in_srgb,var(--background)_99%,var(--foreground)_1%)] backdrop-blur-xl rounded-xl border border-[color-mix(in_srgb,var(--foreground)_7%,transparent)] shadow-sm mb-6">
                <div 
                  className="flex items-center justify-between w-full mb-4 cursor-pointer"
                  onClick={() => {
                    const newExpansionState = !reasoningExpanded;
                    setReasoningExpanded(newExpansionState);
                    userOverrideReasoningRef.current = newExpansionState;
                  }}
                >
                  <div className="flex items-center gap-2.5">
                    <Wrench className="h-4 w-4 text-[var(--foreground)]" strokeWidth={1.5} /> {/* Use Wrench */}
                    <h2 className="font-medium text-left tracking-tight">Selecting Tools</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* 상태 표시기를 여기로 이동 */}
                    {!currentReasoning.isComplete && (
                      <div className="inline-flex text-xs items-center gap-1.5 text-amber-400 mr-2">
                        <span className="relative flex h-2.5 w-2.5 mr-0.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                        </span>
                        Processing
                      </div>
                    )}
                    {currentReasoning.isComplete && (
                      <div className="inline-flex text-xs items-center gap-1.5 text-green-400 mr-2">
                        <span className="relative flex h-2.5 w-2.5 mr-0.5">
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                        </span>
                        Complete
                      </div>
                    )}
                    
                    <div className="rounded-full p-1 hover:bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] transition-colors">
                      {reasoningExpanded ? 
                        <ChevronUp size={16} className="text-[color-mix(in_srgb,var(--foreground)_50%,transparent)]" /> : 
                        <ChevronDown size={16} className="text-[color-mix(in_srgb,var(--foreground)_50%,transparent)]" />
                      }
                    </div>
                  </div>
                </div>
                
                <div 
                  className="overflow-hidden transition-all duration-300 ease-in-out"
                  style={{ 
                    maxHeight: reasoningExpanded ? (reasoningContentHeight ? `${reasoningContentHeight}px` : '1000px') : '0px',
                  }}
                >
                  <div
                    ref={reasoningContentRef}
                    className="flex flex-col gap-3 transition-opacity duration-300 ease-in-out"
                    style={{
                      opacity: reasoningExpanded ? 1 : 0,
                      scrollbarWidth: 'none',
                      msOverflowStyle: 'none'
                    }}
                  >
                    {/* 툴 아이콘 표시 - 모든 가능한 도구 표시 */}
                    <div className="flex flex-wrap gap-2 text-foreground-secondary mt-3">
                      {/* 웹 검색 */}
                      <div className={`flex items-center gap-1.5 text-xs rounded-full px-2 py-1 transition-colors ${ 
                        currentReasoning.needsWebSearch 
                          ? 'bg-green-500/15 text-green-500 font-medium'
                          : 'bg-[color-mix(in_srgb,var(--foreground)_3%,transparent)] text-[color-mix(in_srgb,var(--foreground)_60%,transparent)]'
                      }`}>
                        <Search size={14} /> Web Search
                      </div>
                      
                      {/* 계산기 */}
                      <div className={`flex items-center gap-1.5 text-xs rounded-full px-2 py-1 transition-colors ${ 
                        currentReasoning.needsCalculator 
                          ? 'bg-green-500/15 text-green-500 font-medium'
                          : 'bg-[color-mix(in_srgb,var(--foreground)_3%,transparent)] text-[color-mix(in_srgb,var(--foreground)_60%,transparent)]'
                      }`}>
                        <Calculator size={14} /> Calculator
                      </div>
                      
                      {/* 링크 리더 */}
                      <div className={`flex items-center gap-1.5 text-xs rounded-full px-2 py-1 transition-colors ${ 
                        currentReasoning.needsLinkReader 
                          ? 'bg-green-500/15 text-green-500 font-medium'
                          : 'bg-[color-mix(in_srgb,var(--foreground)_3%,transparent)] text-[color-mix(in_srgb,var(--foreground)_60%,transparent)]'
                      }`}>
                        <Link2 size={14} /> Link Reader
                      </div>
                      
                      {/* 이미지 생성기 */}
                      <div className={`flex items-center gap-1.5 text-xs rounded-full px-2 py-1 transition-colors ${ 
                        currentReasoning.needsImageGenerator 
                          ? 'bg-green-500/15 text-green-500 font-medium'
                          : 'bg-[color-mix(in_srgb,var(--foreground)_3%,transparent)] text-[color-mix(in_srgb,var(--foreground)_60%,transparent)]'
                      }`}>
                        <ImageIcon size={14} /> Image Generator
                      </div>
                      
                      {/* 학술 검색 */}
                      <div className={`flex items-center gap-1.5 text-xs rounded-full px-2 py-1 transition-colors ${ 
                        currentReasoning.needsAcademicSearch 
                          ? 'bg-green-500/15 text-green-500 font-medium'
                          : 'bg-[color-mix(in_srgb,var(--foreground)_3%,transparent)] text-[color-mix(in_srgb,var(--foreground)_60%,transparent)]'
                      }`}>
                        <BookOpen size={14} /> Academic Search
                      </div>
                      
                      {/* X 검색 */}
                      {/* <div className={`flex items-center gap-1.5 text-xs rounded-full px-2 py-1 transition-colors ${ 
                        currentReasoning.needsXSearch 
                          ? 'bg-green-500/15 text-green-500 font-medium'
                          : 'bg-[color-mix(in_srgb,var(--foreground)_3%,transparent)] text-[color-mix(in_srgb,var(--foreground)_60%,transparent)]'
                      }`}>
                        <XLogo size={14} /> X Search
                      </div> */}
                      
                      {/* YouTube 검색 */}
                      <div className={`flex items-center gap-1.5 text-xs rounded-full px-2 py-1 transition-colors ${ 
                        currentReasoning.needsYouTubeSearch 
                          ? 'bg-green-500/15 text-green-500 font-medium'
                          : 'bg-[color-mix(in_srgb,var(--foreground)_3%,transparent)] text-[color-mix(in_srgb,var(--foreground)_60%,transparent)]'
                      }`}>
                        <YouTubeLogo size={14} /> YouTube Search
                      </div>
                      
                      {/* YouTube 분석기 */}
                      <div className={`flex items-center gap-1.5 text-xs rounded-full px-2 py-1 transition-colors ${ 
                        currentReasoning.needsYouTubeLinkAnalyzer 
                          ? 'bg-green-500/15 text-green-500 font-medium'
                          : 'bg-[color-mix(in_srgb,var(--foreground)_3%,transparent)] text-[color-mix(in_srgb,var(--foreground)_60%,transparent)]'
                      }`}>
                        <Youtube size={14} /> YouTube Analyzer
                      </div>
                    </div>
                    
                    {/* 추론 내용 표시 */}
                    <div className="bg-[color-mix(in_srgb,var(--foreground)_4%,transparent)] p-3 rounded-md">
                      <h4 className="text-sm font-medium mb-2">Reasoning</h4>
                      <div className="whitespace-pre-wrap text-sm">{currentReasoning.agentThoughts}</div>
                    </div>
                    
                    {currentReasoning.selectionReasoning && (
                      <div className="bg-[color-mix(in_srgb,var(--foreground)_4%,transparent)] p-3 rounded-md">
                        <h4 className="text-sm font-medium mb-2">Selecting Tools</h4>
                        <div className="whitespace-pre-wrap text-sm">{currentReasoning.selectionReasoning}</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            {/* Show reasoning section if available during streaming */}
            {reasoningPart && (
              <ReasoningSection 
                content={reasoningPart.reasoning} 
                isComplete={reasoningComplete} // Pass isComplete
              />
            )}
            {/* 로딩 중 Canvas 미리보기 - 새로운 CanvasToolsPreview 사용 */}
            {hasActualCanvasData && (
              <CanvasToolsPreview
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
            )}
            
            {/* Rate Limit 메시지 표시 */}
            {rateLimitAnnotation && rateLimitAnnotation.data && (
              <div className="text-sm text-[color-mix(in_srgb,var(--foreground)_70%,transparent)] mb-2">
                {rateLimitAnnotation.data.message}
                <button 
                  onClick={handleUpgradeClick}
                  className="text-blue-500 hover:underline font-semibold ml-1"
                >
                get unlimited access here →
                </button>
              </div>
            )}
            
            {hasAnyContent ? (
              <div className="flex flex-col gap-2">
                {structuredMainResponse ? (
                  <>
                    {hasContent && <MarkdownContent content={message.content} />}
                    <div className="mt-4 pt-4">
                      <div className="text-xs text-[var(--muted)] mb-2">Final Response</div>
                      <MarkdownContent content={structuredMainResponse} />
                    </div>
                  </>
                ) : (
                  hasContent && <MarkdownContent content={message.content} />
                )}

                {/* structuredDescription */}
                {structuredDescription && (
                  <div className="mt-4 pt-4">
                    <p className="text-sm">{structuredDescription}</p>
                  </div>
                )}

                {/* FilesPreview - 항상 렌더링하고 내부에서 파일 존재 여부 판단 */}
                <FilesPreview
                  messageId={message.id}
                  togglePanel={togglePanel}
                  message={message}
                />

                {!rateLimitAnnotation && (
                  <div className="loading-dots text-xl">
                    <span>.</span>
                    <span>.</span>
                    <span>.</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex items-center">
                  {!rateLimitAnnotation && (
                    <div className="loading-dots text-xl inline-flex mr-1">
                      <span>.</span>
                      <span>.</span>
                      <span>.</span>
                    </div>
                  )}
                  
                  {/* 구독 상태 메시지 (로딩 중이고 비구독자일 때만 표시) */}
                  {!rateLimitAnnotation && subscriptionAnnotation && subscriptionAnnotation.data && !subscriptionAnnotation.data.isSubscribed && (
                    <span className="text-[color-mix(in_srgb,var(--foreground)_70%,transparent)] text-sm inline-flex items-center">
                      &nbsp;Slow request,
                      <button 
                        onClick={handleUpgradeClick}
                        className="text-blue-500 hover:underline font-semibold ml-1"
                      >
                        get premium speed here →
                      </button>
                    </span>
                  )}
                </div>

                {/* Show structured content even during loading */}
                {structuredDescription && (
                  <div className="mt-4 pt-4">
                    <p className="text-sm">{structuredDescription}</p>
                  </div>
                )}
                
                {/* FilesPreview for empty content loading state */}
                <FilesPreview
                  messageId={message.id}
                  togglePanel={togglePanel}
                  message={message}
                />
              </div>
            )}
          </div>
        </div>
        
        {/* Always show regenerate button in loading state */}
        <div className="flex justify-start px-2 mt-2 gap-4 items-center">
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

        </div>
      </div>
    );
  }

  return (
    <div className="message-group group animate-fade-in overflow-hidden" id={message.id}>
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
          null // 사용자 정보 대신 null을 반환하여 아무것도 표시하지 않음
        )}
      </div>
      <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
        <div className={`${isUser ? 'message-user' : 'message-assistant'} max-w-full overflow-x-auto ${ 
          isEditing ? 'w-full' : ''
        }`}>
          {/* Planning은 항상 최상단에 표시 */}
          {currentPlanning && (
            <PlanningSection planningData={currentPlanning} />
          )}

          {/* Agent Reasoning은 Planning 다음에 표시 - only show when it has meaningful tool selection data */}
          {currentReasoning && (currentReasoning.agentThoughts || currentReasoning.selectionReasoning || (currentReasoning.selectedTools && currentReasoning.selectedTools.length > 0)) && (
            <div className="p-4 sm:p-5 bg-gradient-to-br from-[color-mix(in_srgb,var(--background)_97%,var(--foreground)_3%)] to-[color-mix(in_srgb,var(--background)_99%,var(--foreground)_1%)] backdrop-blur-xl rounded-xl border border-[color-mix(in_srgb,var(--foreground)_7%,transparent)] shadow-sm mb-6">
              <div 
                className="flex items-center justify-between w-full mb-4 cursor-pointer"
                onClick={() => {
                  const newExpansionState = !reasoningExpanded;
                  setReasoningExpanded(newExpansionState);
                  userOverrideReasoningRef.current = newExpansionState;
                }}
              >
                <div className="flex items-center gap-2.5">
                  <Wrench className="h-4 w-4 text-[var(--foreground)]" strokeWidth={1.5} /> {/* Use Wrench */}
                  <h2 className="font-medium text-left tracking-tight">Selecting Tools</h2>
                </div>
                <div className="flex items-center gap-2">
                  {/* 상태 표시기를 여기로 이동 */}
                  {!currentReasoning.isComplete && (
                    <div className="inline-flex text-xs items-center gap-1.5 text-amber-400 mr-2">
                      <span className="relative flex h-2.5 w-2.5 mr-0.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                      </span>
                      Processing
                    </div>
                  )}
                  {currentReasoning.isComplete && (
                    <div className="inline-flex text-xs items-center gap-1.5 text-green-400 mr-2">
                      <span className="relative flex h-2.5 w-2.5 mr-0.5">
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                      </span>
                      Complete
                    </div>
                  )}
                  
                  <div className="rounded-full p-1 hover:bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] transition-colors">
                    {reasoningExpanded ? 
                      <ChevronUp size={16} className="text-[color-mix(in_srgb,var(--foreground)_50%,transparent)]" /> : 
                      <ChevronDown size={16} className="text-[color-mix(in_srgb,var(--foreground)_50%,transparent)]" />
                    }
                  </div>
                </div>
              </div>
              
              <div 
                className="overflow-hidden transition-all duration-300 ease-in-out"
                style={{ 
                  maxHeight: reasoningExpanded ? (reasoningContentHeight ? `${reasoningContentHeight}px` : '1000px') : '0px',
                }}
              >
                <div
                  ref={reasoningContentRef}
                  className="flex flex-col gap-3 transition-opacity duration-300 ease-in-out"
                  style={{
                    opacity: reasoningExpanded ? 1 : 0,
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none'
                  }}
                >
                  {/* 툴 아이콘 표시 - 모든 가능한 도구 표시 */}
                  <div className="flex flex-wrap gap-2 text-foreground-secondary mt-3">
                    {/* 웹 검색 */}
                    <div className={`flex items-center gap-1.5 text-xs rounded-full px-2 py-1 transition-colors ${ 
                      currentReasoning.needsWebSearch 
                        ? 'bg-green-500/15 text-green-500 font-medium'
                        : 'bg-[color-mix(in_srgb,var(--foreground)_3%,transparent)] text-[color-mix(in_srgb,var(--foreground)_60%,transparent)]'
                      }`}>
                      <Search size={14} /> Web Search
                    </div>
                    
                    {/* 계산기 */}
                    <div className={`flex items-center gap-1.5 text-xs rounded-full px-2 py-1 transition-colors ${ 
                      currentReasoning.needsCalculator 
                        ? 'bg-green-500/15 text-green-500 font-medium'
                        : 'bg-[color-mix(in_srgb,var(--foreground)_3%,transparent)] text-[color-mix(in_srgb,var(--foreground)_60%,transparent)]'
                      }`}>
                      <Calculator size={14} /> Calculator
                    </div>
                    
                    {/* 링크 리더 */}
                    <div className={`flex items-center gap-1.5 text-xs rounded-full px-2 py-1 transition-colors ${ 
                      currentReasoning.needsLinkReader 
                        ? 'bg-green-500/15 text-green-500 font-medium'
                        : 'bg-[color-mix(in_srgb,var(--foreground)_3%,transparent)] text-[color-mix(in_srgb,var(--foreground)_60%,transparent)]'
                      }`}>
                      <Link2 size={14} /> Link Reader
                    </div>
                    
                    {/* 이미지 생성기 */}
                    <div className={`flex items-center gap-1.5 text-xs rounded-full px-2 py-1 transition-colors ${ 
                      currentReasoning.needsImageGenerator 
                        ? 'bg-green-500/15 text-green-500 font-medium'
                        : 'bg-[color-mix(in_srgb,var(--foreground)_3%,transparent)] text-[color-mix(in_srgb,var(--foreground)_60%,transparent)]'
                      }`}>
                      <ImageIcon size={14} /> Image Generator
                    </div>
                    
                    {/* 학술 검색 */}
                    <div className={`flex items-center gap-1.5 text-xs rounded-full px-2 py-1 transition-colors ${ 
                      currentReasoning.needsAcademicSearch 
                        ? 'bg-green-500/15 text-green-500 font-medium'
                        : 'bg-[color-mix(in_srgb,var(--foreground)_3%,transparent)] text-[color-mix(in_srgb,var(--foreground)_60%,transparent)]'
                      }`}>
                      <BookOpen size={14} /> Academic Search
                    </div>
                    
                    {/* X 검색 */}
                    {/* <div className={`flex items-center gap-1.5 text-xs rounded-full px-2 py-1 transition-colors ${ 
                      currentReasoning.needsXSearch 
                        ? 'bg-green-500/15 text-green-500 font-medium'
                        : 'bg-[color-mix(in_srgb,var(--foreground)_3%,transparent)] text-[color-mix(in_srgb,var(--foreground)_60%,transparent)]'
                      }`}>
                        <XLogo size={14} /> X Search
                      </div> */}
                      
                    {/* YouTube 검색 */}
                    <div className={`flex items-center gap-1.5 text-xs rounded-full px-2 py-1 transition-colors ${ 
                      currentReasoning.needsYouTubeSearch 
                        ? 'bg-green-500/15 text-green-500 font-medium'
                        : 'bg-[color-mix(in_srgb,var(--foreground)_3%,transparent)] text-[color-mix(in_srgb,var(--foreground)_60%,transparent)]'
                      }`}>
                      <YouTubeLogo size={14} /> YouTube Search
                    </div>
                    
                    {/* YouTube 분석기 */}
                    <div className={`flex items-center gap-1.5 text-xs rounded-full px-2 py-1 transition-colors ${ 
                      currentReasoning.needsYouTubeLinkAnalyzer 
                        ? 'bg-green-500/15 text-green-500 font-medium'
                        : 'bg-[color-mix(in_srgb,var(--foreground)_3%,transparent)] text-[color-mix(in_srgb,var(--foreground)_60%,transparent)]'
                      }`}>
                      <Youtube size={14} /> YouTube Analyzer
                    </div>
                  </div>
                  
                  {/* 추론 내용 표시 */}
                  <div className="bg-[color-mix(in_srgb,var(--foreground)_4%,transparent)] p-3 rounded-md">
                    <h4 className="text-sm font-medium mb-2">Reasoning</h4>
                    <div className="whitespace-pre-wrap text-sm">{currentReasoning.agentThoughts}</div>
                  </div>
                  
                  {currentReasoning.selectionReasoning && (
                    <div className="bg-[color-mix(in_srgb,var(--foreground)_4%,transparent)] p-3 rounded-md">
                      <h4 className="text-sm font-medium mb-2">Selecting Tools</h4>
                      <div className="whitespace-pre-wrap text-sm">{currentReasoning.selectionReasoning}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ReasoningSection for streaming or message.parts */}
          {message.parts?.find(part => part.type === 'reasoning') && (
            (() => {
              const reasoningPart = message.parts?.find(part => part.type === 'reasoning');
              return (
                <ReasoningSection 
                  key="reasoning" 
                  content={reasoningPart!.reasoning} 
                  isComplete={isReasoningComplete(message)} // Pass isComplete
                />
              );
            })()
          )}

          {isEditing ? (
            <div 
              ref={editingContainerRef}
              className="flex flex-col gap-4 w-full relative"
              onDragEnter={handleDrag}
              onDragLeave={handleDragLeave}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              {/* 드래그&드롭 오버레이 */}
              <DragDropOverlay dragActive={dragActive} supportsPDFs={true} />
              
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
                         bg-[var(--accent)] text-[var(--foreground)]
                         resize-none overflow-hidden transition-all duration-200
                         focus:outline-none border-none outline-none ring-0
                         placeholder-[var(--foreground-80)]"
                style={{
                  height: 'auto',
                  minHeight: '100px',
                  caretColor: 'var(--foreground)'
                }}
                placeholder="Edit your message..."
              />
              
              {/* 파일 미리보기 영역 */}
              {editingFiles.length > 0 && (
                <EditingFilePreview 
                  files={editingFiles}
                  fileMap={editingFileMap}
                  removeFile={handleRemoveFile}
                />
              )}
              
              {/* 파일 업로드 및 버튼 영역 */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {/* 파일 업로드 버튼 */}
                  <FileUploadButton 
                    filesCount={editingFiles.length}
                    onClick={handleFileSelect}
                  />
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    multiple
                    accept="image/*,.pdf,.txt,.js,.jsx,.ts,.tsx,.html,.css,.json,.md,.py,.java,.c,.cpp,.cs,.go,.rb,.php,.swift,.kt,.rs"
                    style={{ display: 'none' }}
                  />
                  <span className="text-xs text-[var(--muted)]">
                    {editingFiles.length === 0 ? 'Add files' : `${editingFiles.length} file${editingFiles.length > 1 ? 's' : ''}`}
                  </span>
                </div>
                
                <div className="flex gap-2">
                <button
                    onClick={handleEditCancel}
                  className="px-4 py-2 text-sm
                           bg-[var(--accent)] text-[var(--foreground)]
                           hover:opacity-80 transition-opacity duration-200"
                >
                  Cancel
                </button>
                <button
                    onClick={handleEditSave}
                  className="px-4 py-2 text-sm
                           bg-[var(--accent)] text-[var(--foreground)]
                           hover:opacity-80 transition-opacity duration-200"
                >
                  Send
                </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {hasAttachments && (
                <AttachmentPreview attachments={message.experimental_attachments!} messageId={message.id} />
              )}
              
              {/* 텍스트 파트 렌더링 (기존 로직 유지, 단, structuredMainResponse를 직접 렌더링하는 부분은 제거됨) */}
              {message.parts ? (
                <>
                  {/* INSERT CANVAS PREVIEW HERE IF message.parts EXISTS */}
                  {isAssistant && message.parts && hasActualCanvasData && (
                    <CanvasToolsPreview
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
                  )}
                  {message.parts.map((part, index) => {
                    if (part.type === 'text') {
                      const shouldTruncate = isUser && !isEditing && !expandedMessages[message.id];
                      const isLongMessage = part.text.length > 300;
                      
                      const textParts = message.parts ? message.parts.filter(p => p.type === 'text') : [];
                      const isLastTextPart = textParts.length > 0 && textParts[textParts.length - 1] === part;
                      
                      return (
                        <React.Fragment key={index}>
                          {isUser ? (
                            (() => {
                              const isActuallyLongMessage = part.text.length > 300;
                              const isCurrentlyExpanded = expandedMessages[message.id];
                              const shouldBeTruncated = isUser && !isEditing && !isCurrentlyExpanded && isActuallyLongMessage;
                              
                              const textToShow = shouldBeTruncated ? truncateMessage(part.text) : part.text;
                              const showGradientEffect = shouldBeTruncated;

                              return (
                                <UserMessageContent 
                                  content={textToShow}
                                  showGradient={showGradientEffect}
                                  isClickable={isActuallyLongMessage}
                                  onClick={isActuallyLongMessage ? () => toggleMessageExpansion(message.id) : undefined}
                                />
                              );
                            })()
                          ) : (
                            <MarkdownContent content={part.text} />
                          )}
                          
                          {isAssistant && isStreaming && isLastTextPart && (
                            <div className="loading-dots text-sm inline-block ml-0">
                              <span>.</span>
                              <span>.</span>
                              <span>.</span>
                            </div>
                          )}
                          
                          {/* Removed Read more/Show less buttons for user messages with parts */}
                        </React.Fragment>
                      );
                    }
                    return null;
                  })}
                </>
              ) : (
                <>
                  {isUser ? (
                    (() => {
                      const isActuallyLongMessage = message.content.length > 300;
                      const isCurrentlyExpanded = expandedMessages[message.id];
                      const shouldBeTruncated = isUser && !isEditing && !isCurrentlyExpanded && isActuallyLongMessage;
                      
                      const textToShow = shouldBeTruncated ? truncateMessage(message.content) : message.content;
                      const showGradientEffect = shouldBeTruncated;

                      return (
                        <UserMessageContent 
                          content={textToShow}
                          showGradient={showGradientEffect}
                          isClickable={isActuallyLongMessage}
                          onClick={isActuallyLongMessage ? () => toggleMessageExpansion(message.id) : undefined}
                        />
                      );
                    })()
                  ) : (
                    (hasContent && !hasStructuredData) && <MarkdownContent content={message.content} />
                  )}
                  
                  {/* INSERT CANVAS PREVIEW HERE IF !message.parts EXISTS FOR ASSISTANT */}
                  {isAssistant && !message.parts && hasActualCanvasData && (
                    <CanvasToolsPreview
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
                  )}

                  {isAssistant && isStreaming && (
                    <div className="loading-dots text-sm inline-block ml-1">
                      <span>.</span>
                      <span>.</span>
                      <span>.</span>
                    </div>
                  )}
                  
                  {/* Removed Read more/Show less button for user messages (fallback content) */}
                </>
              )}

              {/* structuredDescription */}
              {structuredDescription && (
                <div className="mt-4 pt-4">
                  <p className="text-sm">{structuredDescription}</p>
                </div>
              )}

              {/* FilesPreview - 항상 렌더링하고 내부에서 파일 존재 여부 판단 */}
              <FilesPreview
                messageId={message.id}
                togglePanel={togglePanel}
                message={message}
              />
            </>
          )}
        </div>
      </div>
      {isAssistant ? (
        <div className="flex justify-start px-2 mt-2 gap-4 items-center">
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
      ) : (
        <div className="flex justify-end pr-1 mt-2 gap-4">
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
    </div>
  )
});

// 편집 모드 전용 파일 미리보기 컴포넌트
const EditingFilePreview = memo(function EditingFilePreview({ 
  files, 
  fileMap, 
  removeFile 
}: { 
  files: globalThis.File[];
  fileMap: Map<string, { file: globalThis.File, url: string }>;
  removeFile: (file: globalThis.File) => void;
}) {
  if (!files.length) return null;

  return (
    <div className="file-preview-wrapper -mx-2 px-4 pt-4 pb-1 mt-3 mb-3 relative">
      <div className="file-preview-container grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 gap-y-3 pb-2">
        {files.map((file) => {
          const fileId = (file as any).id;
          const fileData = fileMap.get(fileId);
          const isImage = file.type.startsWith('image/');
          const fileExt = file.name.split('.').pop()?.toUpperCase() || 'FILE';
          
          return (
            <div 
              key={fileId}
              className="file-preview-item relative rounded-lg flex flex-col overflow-hidden transition-all duration-200 hover:translate-y-[-2px]"
              style={{ 
                aspectRatio: '1',
                backgroundColor: `var(--accent)`,
              }}
            >
              <button
                onClick={() => removeFile(file)}
                className="absolute top-1.5 right-1.5 w-7 h-7 md:w-6 md:h-6 md:top-2 md:right-2 flex items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--background)_80%,var(--foreground)_20%)] text-[var(--foreground)] text-xs z-10 transition-all duration-200 hover:opacity-100 hover:bg-[color-mix(in_srgb,var(--background)_70%,var(--foreground)_30%)] opacity-70"
                aria-label={`Remove file ${file.name}`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
              
              <div className="flex-1 w-full flex items-center justify-center overflow-hidden">
                {isImage && fileData?.url ? (
                  <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                    <img 
                      src={fileData.url} 
                      alt={file.name} 
                      className="w-full h-full object-contain"
                      loading="lazy"
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center text-center p-3 h-full">
                    <span className="text-[10px] font-mono mt-2 px-1.5 py-0.5 rounded bg-[color-mix(in_srgb,var(--background)_7%,transparent)]">
                      {fileExt}
                    </span>
                  </div>
                )}
              </div>
              
              <div className="w-full px-2.5 py-2">
                <div className="text-[12px] font-normal truncate tracking-tight" title={file.name}>
                  {file.name}
                </div>
                <div className="text-[9px] opacity-60 mt-0.5 font-medium tracking-tight">
                  {fileHelpers.formatFileSize(file.size)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

// Create CanvasToolsPreview component
const CanvasToolsPreview = memo(function CanvasToolsPreview({
  webSearchData,
  mathCalculationData,
  linkReaderData,
  imageGeneratorData,
  academicSearchData,
  xSearchData,
  youTubeSearchData,
  youTubeLinkAnalysisData,
  messageId,
  togglePanel
}: {
  webSearchData?: any;
  mathCalculationData?: any;
  linkReaderData?: any;
  imageGeneratorData?: any;
  academicSearchData?: any;
  xSearchData?: any;
  youTubeSearchData?: any;
  youTubeLinkAnalysisData?: any;
  messageId: string;
  togglePanel?: (messageId: string, type: 'canvas' | 'structuredResponse', fileIndex?: number, toolType?: string) => void;
}) {
  const tools = useMemo(() => {
    const activeTools = [];
    
    if (webSearchData) {
      // Extract search queries from args.queries (the actual search terms used)
      const queries = (webSearchData.args?.queries || []) as string[];
      let displayText = '';
      
      if (queries.length > 0) {
        // Show up to 2 search queries with quotes
        displayText = queries.slice(0, 2).map((q: string) => `"${q}"`).join(', ');
        if (queries.length > 2) {
          displayText += ` +${queries.length - 2} more`;
        }
      } else {
        // Fallback: try to get queries from other sources
        const fallbackQueries = webSearchData.results?.flatMap((r: any) => 
          r.searches?.map((s: any) => s.query).filter(Boolean) || []
        ) || [];
        
        if (fallbackQueries.length > 0) {
          const uniqueQueries = [...new Set(fallbackQueries)] as string[];
          displayText = uniqueQueries.slice(0, 2).map((q: string) => `"${q}"`).join(', ');
          if (uniqueQueries.length > 2) {
            displayText += ` +${uniqueQueries.length - 2} more`;
          }
        } else {
          displayText = 'Web search performed';
        }
      }
      
      // Determine the actual status based on search results completion
      let actualStatus = 'completed';
      if (webSearchData.results && webSearchData.results.length > 0) {
        // Check if any search is still in progress
        const hasInProgressSearch = webSearchData.results.some((r: any) => r.isComplete === false);
        if (hasInProgressSearch) {
          actualStatus = 'processing';
        }
      } else if (webSearchData.status) {
        // Use explicit status if available
        actualStatus = webSearchData.status;
      } else if (queries.length > 0 && (!webSearchData.results || webSearchData.results.length === 0)) {
        // If we have queries but no results yet, it's still processing
        actualStatus = 'processing';
      }
      
      activeTools.push({
        id: 'web-search',
        name: 'Web Search',
        icon: <Search size={16} />,
        status: actualStatus,
        displayText
      });
    }
    
    if (mathCalculationData) {
      // Extract all calculation expressions to show multiple calculations
      const steps = mathCalculationData.calculationSteps || [];
      let displayText = '';
      
      if (steps.length > 0) {
        // Get all expressions without duplicate removal (duplicates don't occur anyway)
        const expressions = steps
          .map((step: any) => step.expression)
          .filter(Boolean);
        
        if (expressions.length > 0) {
          // Show up to 2 expressions with proper formatting
          if (expressions.length === 1) {
            displayText = expressions[0].length > 30 ? expressions[0].substring(0, 30) + '...' : expressions[0];
          } else {
            const firstExpr = expressions[0].length > 20 ? expressions[0].substring(0, 20) + '...' : expressions[0];
            const secondExpr = expressions[1].length > 20 ? expressions[1].substring(0, 20) + '...' : expressions[1];
            displayText = `${firstExpr}, ${secondExpr}`;
            if (expressions.length > 2) {
              displayText += ` +${expressions.length - 2} more`;
            }
          }
        } else {
          displayText = `${steps.length} calculation step${steps.length > 1 ? 's' : ''}`;
        }
      } else {
        displayText = 'Mathematical calculation';
      }
      
      // Determine actual status - math calculation is completed when steps exist
      let actualStatus = 'completed';
      if (mathCalculationData.status) {
        actualStatus = mathCalculationData.status;
      } else if (steps.length === 0) {
        // If no calculation steps yet, it might be processing
        actualStatus = 'processing';
      }
      
      activeTools.push({
        id: 'calculator',
        name: 'Calculator',
        icon: <Calculator size={16} />,
        status: actualStatus,
        displayText
      });
    }
    
    if (linkReaderData) {
      // Extract URLs and titles from linkAttempts
      const attempts = linkReaderData.linkAttempts || [];
      let displayText = '';
      
      if (attempts.length > 0) {
        const validAttempts = attempts.filter((attempt: any) => !attempt.error);
        
        if (validAttempts.length > 0) {
          // Show domain or title of the first successful attempt
          const attempt = validAttempts[0];
          const url = attempt.url || '';
          const title = attempt.title || '';
          
          try {
            const domain = url ? new URL(url).hostname.replace('www.', '') : '';
            displayText = title && title.length < 30 ? title : domain || url;
          } catch {
            displayText = url;
          }
        } else {
          // All attempts failed
          displayText = `${attempts.length} link${attempts.length > 1 ? 's' : ''} (failed)`;
        }
      } else {
        displayText = 'Link analysis';
      }
      
      // Determine actual status based on completion of all attempts
      let actualStatus = 'completed';
      if (linkReaderData.status) {
        actualStatus = linkReaderData.status;
      } else if (attempts.length > 0) {
        // Check if any attempts are still in progress using explicit status field
        const inProgressAttempts = attempts.filter((attempt: any) => 
          attempt.status === 'in_progress'
        );
        
        if (inProgressAttempts.length > 0) {
          actualStatus = 'processing';
        } else {
          // All attempts have completed - determine success or error using status field
          const hasSuccess = attempts.some((a: any) => a.status === 'success');
          actualStatus = hasSuccess ? 'completed' : 'error';
        }
      }
      
      activeTools.push({
        id: 'link-reader',
        name: 'Link Reader',
        icon: <Link2 size={16} />,
        status: actualStatus,
        displayText: displayText.length > 40 ? displayText.substring(0, 40) + '...' : displayText
      });
    }
    
    if (imageGeneratorData) {
      // Extract prompts from generated images
      const images = imageGeneratorData.generatedImages || [];
      let displayText = '';
      
      if (images.length > 0) {
        const firstImage = images[0];
        const prompt = firstImage.prompt || '';
        
        if (prompt) {
          // Just show the prompt itself, truncated if too long
          displayText = prompt.length > 40 ? prompt.substring(0, 40) + '...' : prompt;
        } else {
          displayText = `${images.length} image${images.length > 1 ? 's' : ''} generated`;
        }
      } else {
        displayText = 'Image generation';
      }
      
      // Determine actual status - image generation is completed when images exist
      let actualStatus = 'completed';
      if (imageGeneratorData.status) {
        actualStatus = imageGeneratorData.status;
      } else if (images.length === 0) {
        // If no generated images yet, it might be processing
        actualStatus = 'processing';
      }
      
      activeTools.push({
        id: 'image-generator',
        name: 'Image Generator',
        icon: <ImageIcon size={16} />,
        status: actualStatus,
        displayText: displayText.length > 40 ? displayText.substring(0, 40) + '...' : displayText
      });
    }
    
    if (academicSearchData) {
      // Extract search queries from academic results
      const results = academicSearchData.academicResults || [];
      let displayText = '';
      
      if (results.length > 0) {
        const queries = results.map((r: any) => r.query).filter(Boolean);
        
        if (queries.length > 0) {
          // Show first query or combine multiple queries
          displayText = queries.length === 1 
            ? `"${queries[0]}"` 
            : `"${queries[0]}" +${queries.length - 1} more topics`;
        } else {
          displayText = `${results.length} academic search${results.length > 1 ? 'es' : ''}`;
        }
      } else {
        displayText = 'Academic research';
      }
      
      // Determine actual status - academic search is usually completed when results exist
      let actualStatus = 'completed';
      if (academicSearchData.status) {
        actualStatus = academicSearchData.status;
      } else if (results.length === 0) {
        // If no results yet but we have academic search data, it might be processing
        actualStatus = 'processing';
      }
      
      activeTools.push({
        id: 'academic-search',
        name: 'Academic Search',
        icon: <BookOpen size={16} />,
        status: actualStatus,
        displayText: displayText.length > 40 ? displayText.substring(0, 40) + '...' : displayText
      });
    }
    
    if (xSearchData) {
      // Extract search queries from X results
      const results = xSearchData.xResults || [];
      let displayText = '';
      
      if (results.length > 0) {
        const queries = results.map((r: { query: any }) => r.query).filter(Boolean);
        
        if (queries.length > 0) {
          displayText = queries.length === 1 
            ? `"${queries[0]}"` 
            : `"${queries[0]}" +${queries.length - 1} more`;
        } else {
          displayText = `${results.length} X search${results.length > 1 ? 'es' : ''}`;
        }
      } else {
        displayText = 'X/Twitter search';
      }
      
      // Determine actual status - X search is completed when results exist
      let actualStatus = 'completed';
      if (xSearchData.status) {
        actualStatus = xSearchData.status;
      } else if (results.length === 0) {
        // If no results yet, it might be processing
        actualStatus = 'processing';
      }
      
      activeTools.push({
        id: 'x-search',
        name: 'X Search',
        icon: <XLogo size={16} />,
        status: actualStatus,
        displayText: displayText.length > 40 ? displayText.substring(0, 40) + '...' : displayText
      });
    }
    
    if (youTubeSearchData) {
      // Extract search queries from YouTube results
      const results = youTubeSearchData.youtubeResults || [];
      let displayText = '';
      
      if (results.length > 0) {
        const queries = results.map((r: { query: any }) => r.query).filter(Boolean);
        
        if (queries.length > 0) {
          displayText = queries.length === 1 
            ? `"${queries[0]}"` 
            : `"${queries[0]}" +${queries.length - 1} more`;
        } else {
          displayText = `${results.length} YouTube search${results.length > 1 ? 'es' : ''}`;
        }
      } else {
        displayText = 'YouTube search';
      }
      
      // Determine actual status - YouTube search is completed when results exist
      let actualStatus = 'completed';
      if (youTubeSearchData.status) {
        actualStatus = youTubeSearchData.status;
      } else if (results.length === 0) {
        // If no results yet, it might be processing
        actualStatus = 'processing';
      }
      
      activeTools.push({
        id: 'youtube-search',
        name: 'YouTube Search',
        icon: <YouTubeLogo size={16} />,
        status: actualStatus,
        displayText: displayText.length > 40 ? displayText.substring(0, 40) + '...' : displayText
      });
    }
    
    if (youTubeLinkAnalysisData) {
      // Extract video titles or details from analysis results
      const results = youTubeLinkAnalysisData.analysisResults || [];
      let displayText = '';
      
      if (results.length > 0) {
        const firstResult = results[0];
        
        if (firstResult.error) {
          displayText = 'Analysis failed';
        } else {
          const title = firstResult.details?.title || '';
          const channel = firstResult.channel?.name || '';
          
          if (title) {
            displayText = title;
          } else if (channel) {
            displayText = `Video from ${channel}`;
          } else {
            displayText = 'YouTube video analyzed';
          }
        }
      } else {
        displayText = 'YouTube analysis';
      }
      
      // Determine actual status based on analysis completion
      let actualStatus = 'completed';
      if (youTubeLinkAnalysisData.status) {
        actualStatus = youTubeLinkAnalysisData.status;
      } else if (results.length === 0) {
        // If no analysis results yet, it might be processing
        actualStatus = 'processing';
      } else {
        // Check if all analysis have completed (either success or error)
        const hasIncompleteAnalysis = results.some((r: { error: any, details?: any }) => 
          !r.error && !r.details
        );
        
        if (hasIncompleteAnalysis) {
          actualStatus = 'processing';
        } else {
          // All analysis completed - determine success or error
          const hasSuccess = results.some((r: { error: any }) => !r.error);
          actualStatus = hasSuccess ? 'completed' : 'error';
        }
      }
      
      activeTools.push({
        id: 'youtube-analyzer',
        name: 'YouTube Analyzer',
        icon: <Youtube size={16} />,
        status: actualStatus,
        displayText: displayText.length > 40 ? displayText.substring(0, 40) + '...' : displayText
      });
    }
    
    return activeTools;
  }, [webSearchData, mathCalculationData, linkReaderData, imageGeneratorData, academicSearchData, xSearchData, youTubeSearchData, youTubeLinkAnalysisData]);
  
  if (tools.length === 0) return null;
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'processing':
      case 'loading':
        return 'text-amber-400';
      case 'completed':
      case 'success':
        return 'text-green-400';
      case 'error':
      case 'failed':
        return 'text-red-400';
      default:
        return 'text-blue-400';
    }
  };
  
  const getStatusIndicator = (status: string) => {
    switch (status) {
      case 'processing':
      case 'loading':
        return (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
          </span>
        );
      case 'completed':
      case 'success':
        return (
          <span className="relative flex h-2 w-2">
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
        );
      case 'error':
      case 'failed':
        return (
          <span className="relative flex h-2 w-2">
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
          </span>
        );
      default:
        return (
          <span className="relative flex h-2 w-2">
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
          </span>
        );
    }
  };
  
  return (
    <div className="mb-6 p-4 sm:p-5 bg-gradient-to-br from-[color-mix(in_srgb,var(--background)_97%,var(--foreground)_3%)] to-[color-mix(in_srgb,var(--background)_99%,var(--foreground)_1%)] backdrop-blur-xl rounded-xl border border-[color-mix(in_srgb,var(--foreground)_7%,transparent)] shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <Monitor className="h-4 w-4 text-[var(--foreground)]" strokeWidth={1.5} />
          <h2 className="font-medium text-left tracking-tight">Canvas Preview</h2>
        </div>
        <button
          onClick={() => togglePanel && togglePanel(messageId, 'canvas')}
          className="flex items-center gap-2 px-3 py-1.5 text-xs bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] hover:bg-[color-mix(in_srgb,var(--foreground)_8%,transparent)] rounded-lg transition-colors"
        >
          <span>View All</span>
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 17 17 7" />
            <path d="M7 7h10v10" />
          </svg>
        </button>
      </div>
      
      <div className="grid gap-3">
        {tools.map((tool, index) => (
          <div
            key={tool.id}
            className="flex items-center gap-3 p-3 bg-[color-mix(in_srgb,var(--foreground)_3%,transparent)] rounded-lg min-w-0 cursor-pointer hover:bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] transition-colors"
            onClick={() => togglePanel && togglePanel(messageId, 'canvas', undefined, tool.id)}
          >
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] flex-shrink-0">
              {tool.icon}
            </div>
            <div className="flex-1 min-w-0 overflow-hidden">
              <div className="flex items-center gap-2 mb-1 min-w-0">
                <span className="text-sm font-medium truncate">{tool.name}</span>
                <div className="flex-shrink-0">
                  {getStatusIndicator(tool.status)}
                </div>
              </div>
              <div className="text-xs text-[var(--muted)] truncate">
                {tool.displayText}
              </div>
            </div>
            <div className={`text-xs font-medium flex-shrink-0 max-w-[80px] sm:max-w-none truncate ${getStatusColor(tool.status)}`}>
              <span className="hidden sm:inline">
                {tool.status === 'processing' || tool.status === 'loading' ? 'Processing' : 
                 tool.status === 'completed' || tool.status === 'success' ? 'Complete' :
                 tool.status === 'error' || tool.status === 'failed' ? 'Failed' : 'Ready'}
              </span>
              <span className="sm:hidden">
                {tool.status === 'processing' || tool.status === 'loading' ? 'Processing' : 
                 tool.status === 'completed' || tool.status === 'success' ? 'Complete' :
                 tool.status === 'error' || tool.status === 'failed' ? 'Error' : 'Ready'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

// 새로운 FilesPreview 컴포넌트
const FilesPreview = memo(function FilesPreview({
  messageId,
  togglePanel,
  message
}: {
  messageId: string;
  togglePanel?: (messageId: string, type: 'canvas' | 'structuredResponse', fileIndex?: number) => void;
  message: any; // message 객체를 직접 받아서 스트리밍 데이터에 접근
}) {
  // StructuredResponse.tsx와 동일한 방식으로 스트리밍 데이터 처리
  const getStructuredResponseData = (message: any) => {
    // 1. 먼저 annotations에서 확인
    const structuredResponseAnnotation = message.annotations?.find(
      (annotation: any) => annotation.type === 'structured_response'
    );
    
    if (structuredResponseAnnotation?.data?.response) {
      return structuredResponseAnnotation.data.response;
    }
    
    // 2. tool_results에서 확인
    if (message.tool_results?.structuredResponse?.response) {
      return message.tool_results.structuredResponse.response;
    }
    
    // 3. 진행 중인 응답 확인 (가장 최신 것)
    const progressAnnotations = message.annotations?.filter(
      (annotation: any) => annotation.type === 'structured_response_progress'
    );
    
    if (progressAnnotations?.length > 0) {
      const latestProgress = progressAnnotations[progressAnnotations.length - 1];
      if (latestProgress.data?.response) {
        return {
          ...latestProgress.data.response,
          isProgress: true
        };
      }
    }
    
    return null;
  };

  const responseData = getStructuredResponseData(message);
  
  // 파일이 없으면 렌더링하지 않음
  if (!responseData || !responseData.files || responseData.files.length === 0) {
    return null;
  }

  const getFileIcon = (fileType?: string) => {
    if (fileType?.startsWith('image/')) return <ImageIcon size={16} />;
    if (fileType === 'application/pdf') return <FileText size={16} />;
    if (fileType?.includes('text') || fileType?.includes('script')) return <FileText size={16} />;
    return <FileText size={16} />; // 기본 아이콘
  };

  // 파일명을 확장자 유지하면서 중간 부분을 ... 로 처리하는 함수
  const truncateFileName = (fileName?: string, maxLength: number = 35) => {
    if (!fileName || typeof fileName !== 'string') {
      return 'Loading file...'; // 이름이 없으면 로딩 중으로 표시
    }
    
    if (fileName.length <= maxLength) return fileName;
    
    const lastDotIndex = fileName.lastIndexOf('.');
    if (lastDotIndex === -1) {
      // 확장자가 없는 경우
      return fileName.slice(0, maxLength - 3) + '...';
    }
    
    const name = fileName.slice(0, lastDotIndex);
    const extension = fileName.slice(lastDotIndex);
    
    // 확장자를 포함한 길이가 maxLength를 초과하는 경우
    const availableLength = maxLength - extension.length - 3; // 3은 ... 의 길이
    if (availableLength <= 0) {
      return '...' + extension;
    }
    
    return name.slice(0, availableLength) + '...' + extension;
  };

  return (
    <div className="mt-6">
      <div className="grid grid-cols-1 gap-2">
        {responseData.files.map((file: any, index: number) => {
          return (
            <div
              key={index}
              className="flex items-center gap-2 p-2.5 bg-[color-mix(in_srgb,var(--foreground)_3%,transparent)] rounded-lg min-w-0 border border-[color-mix(in_srgb,var(--foreground)_7%,transparent)] hover:border-[color-mix(in_srgb,var(--foreground)_10%,transparent)] transition-colors cursor-pointer max-w-md"
              onClick={() => togglePanel && togglePanel(messageId, 'structuredResponse', index)} 
              title={file.name ? `View ${file.name}` : 'View loading file...'}
            >
              <div className="flex items-center justify-center w-7 h-7 rounded-md bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] flex-shrink-0">
                {getFileIcon(file.type)}
              </div>
              <div className="flex-1 min-w-0 overflow-hidden">
                <div className="text-sm font-medium" title={file.name || 'Loading file...'}>
                  {truncateFileName(file.name)}
                </div>
                <div className="text-xs text-[var(--muted)] truncate">
                  {file.size ? fileHelpers.formatFileSize(file.size) : (file.type || (file.name ? '' : 'Processing...'))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

export { Message }; 

