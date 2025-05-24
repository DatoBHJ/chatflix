import type { Message as AIMessage } from 'ai'
import { IconCheck, IconCopy, IconRefresh } from './icons'
import { ReasoningSection } from './ReasoningSection'
import { MarkdownContent } from './MarkdownContent'
import { ExtendedMessage } from '../chat/[id]/types'
import { getModelById } from '@/lib/models/config'
import { Attachment } from '@/lib/types'
import React, { memo, useCallback, useState, useEffect, useMemo, useRef } from 'react'
import Image from 'next/image'
import { createClient } from '@/utils/supabase/client' // createClient import 추가
import { XLogo, YouTubeLogo } from './CanvasFolder/CanvasLogo';
import { Brain, ChevronDown, ChevronUp, Search, Calculator, Link2, ImageIcon, BookOpen, Database, Youtube, FileText, Download, Copy, Check } from 'lucide-react'
import { getProviderLogo, hasLogo } from '@/app/lib/models/logoUtils';
import { AttachmentPreview } from './Attachment'
import Canvas from './Canvas';
import { StructuredResponse } from './StructuredResponse';
import { 
  File, 
  getStructuredResponseMainContent, 
  getStructuredResponseDescription, 
  getStructuredResponseFiles, 
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
  onEditSave: (messageId: string) => void
  setEditingContent: (content: string) => void
  chatId?: string
  isStreaming?: boolean
  isWaitingForToolResults?: boolean
  messageHasCanvasData?: boolean
  activePanelMessageId?: string | null
  togglePanel?: (messageId: string, type: 'canvas' | 'structuredResponse') => void
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
  // const router = useRouter(); // 삭제
  // const supabase = createClient(); // 삭제
  
  // Replace context with direct state management
  // const [userName, setUserName] = useState(propUserName || 'You'); // 삭제
  // const [profileImage, setProfileImage] = useState<string | null>(propProfileImage || null); // 삭제
  
  // Bookmark state
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isBookmarkLoading, setIsBookmarkLoading] = useState(false);

  // Get current user
  const [user, setUser] = useState<any>(null);
  
  // 파일 관련 상태
  const [openFileIndexes, setOpenFileIndexes] = useState<number[]>([]);
  const [structuredFiles, setStructuredFiles] = useState<File[] | null>(null);
  const [isResponseInProgress, setIsResponseInProgress] = useState(false);
  const [copiedFileId, setCopiedFileId] = useState<string | null>(null);
  
  // Agent Reasoning 관련 상태
  const [currentReasoning, setCurrentReasoning] = useState<any>(null);
  const [reasoningExpanded, setReasoningExpanded] = useState(true);
  const [reasoningContentHeight, setReasoningContentHeight] = useState<number | undefined>(undefined);
  const reasoningContentRef = useRef<HTMLDivElement>(null);
  
  // Use useMemo to derive reasoning data from the message prop
  const derivedReasoningData = useMemo(() => {
    return extractReasoningForMessage(message);
  }, [message]);
  
  // 프리미엄 업그레이드 버튼 클릭 핸들러 (최상위 레벨에 배치)
  const handleUpgradeClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // router.push('/pricing'); // router 사용 코드 삭제
  }, []);
  
  // Measure reasoning content height when content changes
  useEffect(() => {
    if (reasoningContentRef.current && currentReasoning) {
      setReasoningContentHeight(reasoningContentRef.current.scrollHeight);
    }
  }, [currentReasoning, reasoningExpanded]);
  
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
  useEffect(() => {
    const files = getStructuredResponseFiles(message);
    const inProgress = isStructuredResponseInProgress(message);
    
    setStructuredFiles(files);
    setIsResponseInProgress(inProgress);
    
    // 생성 중일 때는 모든 파일을 열고, 완료되면 모두 닫기
    if (inProgress && files && files.length > 0) {
      // 생성 중일 때는 모든 파일 열기
      setOpenFileIndexes(files.map((_, idx) => idx));
    } else if (!inProgress && isResponseInProgress) {
      // 생성이 완료되면 모든 파일 닫기
      setOpenFileIndexes([]);
    }
  }, [message, message.annotations]);
  
  // Agent Reasoning 데이터 처리 (Canvas와 동일한 로직)
  useEffect(() => {
    let newDerivedReasoning: any | null = null;
    const { completeData, progressData } = derivedReasoningData;

    // Prefer fully complete reasoning if available
    if (completeData?.isComplete) { 
      newDerivedReasoning = completeData;
    } else if (progressData && progressData.length > 0) {
      // If no complete reasoning, take the latest progress (already sorted newest first)
      newDerivedReasoning = progressData[0]; 
    } else if (completeData) { 
      // Fallback: if there's a completeData (but not marked complete) and no progress, use it.
      newDerivedReasoning = completeData;
    }

    // Compare the derived new state with the current state to prevent unnecessary updates
    const hasChanged = () => {
      if (currentReasoning === newDerivedReasoning) return false; // Same object instance or both null
      if (!newDerivedReasoning && !currentReasoning) return false; // Both are null (covered by above, but explicit)
      if (!newDerivedReasoning || !currentReasoning) return true; // One is null, the other isn't

      // Both are objects, compare relevant fields to determine semantic difference
      return currentReasoning.agentThoughts !== newDerivedReasoning.agentThoughts ||
             currentReasoning.plan !== newDerivedReasoning.plan ||
             currentReasoning.selectionReasoning !== newDerivedReasoning.selectionReasoning ||
             currentReasoning.timestamp !== newDerivedReasoning.timestamp ||
             currentReasoning.isComplete !== newDerivedReasoning.isComplete || // Crucial
             currentReasoning.needsWebSearch !== newDerivedReasoning.needsWebSearch ||
             currentReasoning.needsCalculator !== newDerivedReasoning.needsCalculator ||
             currentReasoning.needsLinkReader !== newDerivedReasoning.needsLinkReader ||
             currentReasoning.needsImageGenerator !== newDerivedReasoning.needsImageGenerator ||
             currentReasoning.needsAcademicSearch !== newDerivedReasoning.needsAcademicSearch ||
             // currentReasoning.needsXSearch !== newDerivedReasoning.needsXSearch, // Was commented out
             currentReasoning.needsYouTubeSearch !== newDerivedReasoning.needsYouTubeSearch ||
             currentReasoning.needsYouTubeLinkAnalyzer !== newDerivedReasoning.needsYouTubeLinkAnalyzer ||
             currentReasoning.needsDataProcessor !== newDerivedReasoning.needsDataProcessor;
    };

    if (hasChanged()) {
      setCurrentReasoning(newDerivedReasoning);
    }
  }, [derivedReasoningData, currentReasoning]); // Dependencies are the memoized derivedReasoningData and currentReasoning
  
  // 파일 토글 핸들러
  const toggleFile = useCallback((index: number) => {
    setOpenFileIndexes(prev => 
      prev.includes(index) 
        ? prev.filter(i => i !== index) 
        : [...prev, index]
    );
  }, []);

  // 파일 내용 복사 핸들러
  const copyFileContent = useCallback((file: File) => {
    navigator.clipboard.writeText(file.content)
      .then(() => {
        setCopiedFileId(file.name);
        // 복사 상태 2초 후 초기화
        setTimeout(() => {
          setCopiedFileId(null);
        }, 2000);
      })
      .catch((err) => {
        console.error('Failed to copy file content:', err);
      });
  }, []);

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
  const structuredFilesData = useMemo(() => getStructuredResponseFiles(message), [message]);
  const structuredDescription = useMemo(() => getStructuredResponseDescription(message), [message]);
  
  // 구조화된 응답이 진행 중인지 여부를 useMemo로 관리
  const isInProgress = useMemo(() => isStructuredResponseInProgress(message), [message]);

  const hasStructuredData = useMemo(() => {
    // 메인 응답 내용이 있거나, 파일 데이터가 있거나, 또는 구조화된 응답이 진행 중일 때 true
    return !!(structuredMainResponse || (structuredFilesData && structuredFilesData.length > 0) || isInProgress);
  }, [structuredMainResponse, structuredFilesData, isInProgress]);

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

  // Function to navigate to the specific message in the chat
  const navigateToMessage = useCallback((messageId: string, chatSessionId: string) => {
    if (!chatSessionId) return;
    // Next.js 13+ app router에서는 window.location 사용 가능 (권장되지는 않음)
    window.location.href = `/chat/${chatSessionId}#${messageId}`;
  }, [chatId]); // chatId 의존성 제거 (이미 파라미터로 받고 있음)
  
  // 파일 다운로드 핸들러
  const downloadFile = useCallback((file: File) => {
    const blob = new Blob([file.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);
  
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
            {/* Show agent reasoning section first */}
            {currentReasoning && (
              <div className="p-4 sm:p-5 bg-gradient-to-br from-[color-mix(in_srgb,var(--background)_97%,var(--foreground)_3%)] to-[color-mix(in_srgb,var(--background)_99%,var(--foreground)_1%)] backdrop-blur-xl rounded-xl border border-[color-mix(in_srgb,var(--foreground)_7%,transparent)] shadow-sm mb-8">
                <div 
                  className="flex items-center justify-between w-full mb-4 cursor-pointer"
                  onClick={() => setReasoningExpanded(!reasoningExpanded)}
                >
                  <div className="flex items-center gap-2.5">
                    <Brain className="h-4 w-4 text-[var(--foreground)]" strokeWidth={1.5} />
                    <h2 className="font-medium text-left tracking-tight">Planning Next Move</h2>
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
                      
                      {/* 데이터 처리기 */}
                      <div className={`flex items-center gap-1.5 text-xs rounded-full px-2 py-1 transition-colors ${
                        currentReasoning.needsDataProcessor 
                          ? 'bg-green-500/15 text-green-500 font-medium'
                          : 'bg-[color-mix(in_srgb,var(--foreground)_3%,transparent)] text-[color-mix(in_srgb,var(--foreground)_60%,transparent)]'
                      }`}>
                        <Database size={14} /> Data Processor
                      </div>
                    </div>
                    
                    {/* 추론 내용 표시 */}
                    <div className="bg-[color-mix(in_srgb,var(--foreground)_4%,transparent)] p-3 rounded-md">
                      <h4 className="text-sm font-medium mb-2">Reasoning</h4>
                      <div className="whitespace-pre-wrap text-sm">{currentReasoning.agentThoughts}</div>
                    </div>
                    
                    {currentReasoning.plan && (
                      <div className="bg-[color-mix(in_srgb,var(--foreground)_4%,transparent)] p-3 rounded-md">
                        <h4 className="text-sm font-medium mb-2">Planning</h4>
                        <div className="whitespace-pre-wrap text-sm">{currentReasoning.plan}</div>
                      </div>
                    )}
                    
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
                isStreaming={isStreaming && !reasoningComplete} 
                isComplete={reasoningComplete}
              />
            )}
            {/* 로딩 중 Canvas 미리보기 */}
            {hasActualCanvasData && (
              <div 
                className="mb-6 relative max-h-[300px] overflow-hidden cursor-pointer" 
                onClick={() => togglePanel && togglePanel(message.id, 'canvas')}
              >
                <Canvas
                  webSearchData={webSearchData}
                  mathCalculationData={mathCalculationData}
                  linkReaderData={linkReaderData}
                  imageGeneratorData={imageGeneratorData}
                  academicSearchData={academicSearchData}
                  xSearchData={xSearchData}
                  youTubeSearchData={youTubeSearchData}
                  youTubeLinkAnalysisData={youTubeLinkAnalysisData}
                  isCompact={true}
                />
                <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-[var(--background)] to-transparent pointer-events-none"></div>
                <div className="flex items-center justify-center mt-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
                  <span>View Canvas</span>
                  <ChevronDown size={16} className="ml-1" />
                </div>
              </div>
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
                  <MarkdownContent content={message.content} />
                )}

                {/* structuredDescription */}
                {structuredDescription && (
                  <div className={`mt-4 ${!(structuredFilesData && structuredFilesData.length > 0) ? 'pt-4' : ''}`}>
                    <p className="text-sm">{structuredDescription}</p>
                  </div>
                )}

                {/* StructuredResponse Clickable Preview */}
                {hasStructuredData && (
                  <div 
                    className="mt-4 pt-4 mb-6 relative max-h-[300px] overflow-hidden cursor-pointer"
                    onClick={() => togglePanel && togglePanel(message.id, 'structuredResponse')}
                  >
                    <StructuredResponse message={message} />
                    <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-[var(--background)] to-transparent pointer-events-none"></div>
                    <div className="flex items-center justify-center mt-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
                      <span>View Details</span>
                      <ChevronDown size={16} className="ml-1" />
                    </div>
                  </div>
                )}

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
                  <div className={`mt-4 ${!(structuredFilesData && structuredFilesData.length > 0) ? 'pt-4' : ''}`}>
                    <p className="text-sm">{structuredDescription}</p>
                  </div>
                )}

                {hasStructuredData && (
                  <div 
                    className="mt-4 pt-4 mb-6 relative max-h-[300px] overflow-hidden cursor-pointer"
                    onClick={() => togglePanel && togglePanel(message.id, 'structuredResponse')}
                  >
                    <StructuredResponse message={message} />
                    <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-[var(--background)] to-transparent pointer-events-none"></div>
                    <div className="flex items-center justify-center mt-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
                      <span>View Details</span>
                      <ChevronDown size={16} className="ml-1" />
                    </div>
                  </div>
                )}
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
          
          {/* Canvas 버튼 추가 */}
          {/* {messageHasCanvasData && (
            <button
              className="text-xs flex items-center gap-1.5 ml-auto transition-colors text-[var(--muted)] hover:text-[var(--foreground)]"
              onClick={() => togglePanel && togglePanel(message.id, 'canvas')}
              title="View Canvas"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sm:w-3 sm:h-3">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                <line x1="8" y1="21" x2="16" y2="21"></line>
                <line x1="12" y1="17" x2="12" y2="21"></line>
              </svg>
              <span className="hidden sm:inline">View Canvas</span>
            </button>
          )} */}
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
          {/* Agent Reasoning은 항상 상단에 표시 */}
          {currentReasoning && (
            <div className="p-4 sm:p-5 bg-gradient-to-br from-[color-mix(in_srgb,var(--background)_97%,var(--foreground)_3%)] to-[color-mix(in_srgb,var(--background)_99%,var(--foreground)_1%)] backdrop-blur-xl rounded-xl border border-[color-mix(in_srgb,var(--foreground)_7%,transparent)] shadow-sm mb-8">
              <div 
                className="flex items-center justify-between w-full mb-4 cursor-pointer"
                onClick={() => setReasoningExpanded(!reasoningExpanded)}
              >
                <div className="flex items-center gap-2.5">
                  <Brain className="h-4 w-4 text-[var(--foreground)]" strokeWidth={1.5} />
                  <h2 className="font-medium text-left tracking-tight">Planning Next Move</h2>
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
                    
                    {/* 데이터 처리기 */}
                    <div className={`flex items-center gap-1.5 text-xs rounded-full px-2 py-1 transition-colors ${
                      currentReasoning.needsDataProcessor 
                        ? 'bg-green-500/15 text-green-500 font-medium'
                        : 'bg-[color-mix(in_srgb,var(--foreground)_3%,transparent)] text-[color-mix(in_srgb,var(--foreground)_60%,transparent)]'
                      }`}>
                      <Database size={14} /> Data Processor
                    </div>
                  </div>
                  
                  {/* 추론 내용 표시 */}
                  <div className="bg-[color-mix(in_srgb,var(--foreground)_4%,transparent)] p-3 rounded-md">
                    <h4 className="text-sm font-medium mb-2">Reasoning</h4>
                    <div className="whitespace-pre-wrap text-sm">{currentReasoning.agentThoughts}</div>
                  </div>
                  
                  {currentReasoning.plan && (
                    <div className="bg-[color-mix(in_srgb,var(--foreground)_4%,transparent)] p-3 rounded-md">
                      <h4 className="text-sm font-medium mb-2">Planning</h4>
                      <div className="whitespace-pre-wrap text-sm">{currentReasoning.plan}</div>
                    </div>
                  )}
                  
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
          {/* {!currentReasoning && message.parts && message.parts.find(part => part.type === 'reasoning') && (
            (() => {
              const reasoningPart = message.parts.find(part => part.type === 'reasoning');
              const reasoningComplete = isReasoningComplete(message);
              return (
                <ReasoningSection 
                  key="reasoning" 
                  content={reasoningPart!.reasoning} 
                  isStreaming={isStreaming && !reasoningComplete} 
                  isComplete={reasoningComplete}
                />
              );
            })()
          )} */}

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
                         bg-[var(--accent)] text-[var(--foreground)]
                         resize-none overflow-hidden transition-all duration-200
                         focus:outline-none border-none outline-none ring-0
                         placeholder-[var(--foreground-80)]"
                style={{
                  height: 'auto',
                  minHeight: '100px',
                  caretColor: 'var(--foreground)'
                }}
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={onEditCancel}
                  className="px-4 py-2 text-sm
                           bg-[var(--accent)] text-[var(--foreground)]
                           hover:opacity-80 transition-opacity duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={() => onEditSave(message.id)}
                  className="px-4 py-2 text-sm
                           bg-[var(--accent)] text-[var(--foreground)]
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
              
              {/* 텍스트 파트 렌더링 (기존 로직 유지, 단, structuredMainResponse를 직접 렌더링하는 부분은 제거됨) */}
              {message.parts ? (
                <>
                  {message.parts.find(part => part.type === 'reasoning') && (
                    (() => {
                      const reasoningPart = message.parts.find(part => part.type === 'reasoning');
                      const reasoningComplete = isReasoningComplete(message);
                      
                      return (
                        <ReasoningSection 
                          key="reasoning" 
                          content={reasoningPart!.reasoning} 
                          isStreaming={isStreaming && !reasoningComplete} 
                          isComplete={reasoningComplete}
                        />
                      );
                    })()
                  )}
                  {/* INSERT CANVAS PREVIEW HERE IF message.parts EXISTS */}
                  {isAssistant && message.parts && hasActualCanvasData && (
                    <div 
                      className="mb-6 relative max-h-[300px] overflow-hidden cursor-pointer" 
                      onClick={() => togglePanel && togglePanel(message.id, 'canvas')}
                    >
                      <Canvas
                        webSearchData={webSearchData}
                        mathCalculationData={mathCalculationData}
                        linkReaderData={linkReaderData}
                        imageGeneratorData={imageGeneratorData}
                        academicSearchData={academicSearchData}
                        xSearchData={xSearchData}
                        youTubeSearchData={youTubeSearchData}
                        youTubeLinkAnalysisData={youTubeLinkAnalysisData}
                        isCompact={true}
                      />
                      <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-[var(--background)] to-transparent pointer-events-none"></div>
                      <div className="flex items-center justify-center mt-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
                        <span>View Canvas</span>
                        <ChevronDown size={16} className="ml-1" />
                      </div>
                    </div>
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
                    <div 
                      className="mb-6 relative max-h-[300px] overflow-hidden cursor-pointer" 
                      onClick={() => togglePanel && togglePanel(message.id, 'canvas')}
                    >
                      <Canvas
                        webSearchData={webSearchData}
                        mathCalculationData={mathCalculationData}
                        linkReaderData={linkReaderData}
                        imageGeneratorData={imageGeneratorData}
                        academicSearchData={academicSearchData}
                        xSearchData={xSearchData}
                        youTubeSearchData={youTubeSearchData}
                        youTubeLinkAnalysisData={youTubeLinkAnalysisData}
                        isCompact={true}
                      />
                      <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-[var(--background)] to-transparent pointer-events-none"></div>
                      <div className="flex items-center justify-center mt-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
                        <span>View Canvas</span>
                        <ChevronDown size={16} className="ml-1" />
                      </div>
                    </div>
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
                <div className={`mt-4 ${!(structuredFilesData && structuredFilesData.length > 0) ? 'pt-4' : ''}`}>
                  <p className="text-sm">{structuredDescription}</p>
                </div>
              )}

              {/* StructuredResponse Clickable Preview */}
              {hasStructuredData && (
                <div 
                  className="mt-4 pt-4 mb-6 relative max-h-[300px] overflow-hidden cursor-pointer"
                  onClick={() => togglePanel && togglePanel(message.id, 'structuredResponse')}
                >
                  <StructuredResponse message={message} />
                  <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-[var(--background)] to-transparent pointer-events-none"></div>
                  <div className="flex items-center justify-center mt-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
                    <span>View Details</span>
                    <ChevronDown size={16} className="ml-1" />
                  </div>
                </div>
              )}
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

export { Message }; 