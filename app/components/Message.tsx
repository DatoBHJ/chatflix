import type { Message as AIMessage } from 'ai'
import { IconCheck, IconCopy, IconRefresh } from './icons'
import { ReasoningSection } from './ReasoningSection'
import { MarkdownContent } from './MarkdownContent' 
import { ExtendedMessage } from '../chat/[id]/types'
import { Attachment } from '@/lib/types'
import React, { memo, useCallback, useState, useEffect, useMemo, useRef } from 'react'
import Image from 'next/image'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation';
import { XLogo, YouTubeLogo } from './CanvasFolder/CanvasLogo';
import { ChevronDown, ChevronUp, Search, Calculator, Link2, ImageIcon, BookOpen, Youtube, Wrench } from 'lucide-react'
import { AttachmentPreview } from './Attachment'
import { PlanningSection } from './PlanningSection'; 
import { FileUploadButton } from './ChatInput/FileUpload'; 
import { DragDropOverlay } from './ChatInput/DragDropOverlay'; 
import { 
  getStructuredResponseMainContent, 
  getStructuredResponseDescription, 
  isStructuredResponseInProgress, 
  extractReasoningForMessage  
} from '@/app/lib/messageUtils';
import { ModelNameWithLogo, ModelCapabilityBadges } from './ModelInfo'; 
import { linkifyText } from '../lib/textUtils'
import { CanvasToolsPreview } from './Canvas/CanvasToolsPreview'
import { FilesPreview } from './FilePreview/FilesPreview'
import { EditingFilePreview } from './FilePreview/EditingFilePreview'


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
  togglePanel?: (messageId: string, type: 'canvas' | 'structuredResponse', fileIndex?: number, toolType?: string, fileName?: string) => void
  isLastMessage?: boolean
  webSearchData?: any
  mathCalculationData?: any
  linkReaderData?: any
  imageGeneratorData?: any
  academicSearchData?: any
  xSearchData?: any
  youTubeSearchData?: any
  youTubeLinkAnalysisData?: any
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
          className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-[var(--accent)] to-transparent pointer-events-none"
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
}: MessageProps) {

  // Bookmark state
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isBookmarkLoading, setIsBookmarkLoading] = useState(false);

  // Get current user
  const [user, setUser] = useState<any>(null);

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
  
  // Reasoning Part (message.parts) 관련 상태 추가
  const [reasoningPartExpanded, setReasoningPartExpanded] = useState<Record<string, boolean>>({});
  const userOverrideReasoningPartRef = useRef<Record<string, boolean | null>>({});
  
  // Planning 관련 상태
  const [currentPlanning, setCurrentPlanning] = useState<any>(null);
  const [planningExpanded, setPlanningExpanded] = useState<Record<string, boolean>>({});
  const userOverridePlanningRef = useRef<Record<string, boolean | null>>({});
  
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
  
  // Planning state management
  const planningKey = `${message.id}-planning`;
  
  // Auto-expand/collapse logic for planning
  useEffect(() => {
    if (currentPlanning) {
      const planningUserOverride = userOverridePlanningRef.current[planningKey];
      
      // Handle planning state
      if (planningUserOverride === null || planningUserOverride === undefined) {
        setPlanningExpanded(prev => ({
          ...prev,
          [planningKey]: !currentPlanning.isComplete
        }));
      }
    }
  }, [currentPlanning?.isComplete, planningKey, currentPlanning]);
  
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
  
  // 로딩 상태에서도 Agent Reasoning 표시 (isAssistant + 로딩 중)
  if (isAssistant && (!hasAnyContent || isWaitingForToolResults || isStreaming)) {
    
    // 구독 상태 확인
    const subscriptionAnnotation = message.annotations?.find(
      (annotation) => annotation && typeof annotation === 'object' && 'type' in annotation && annotation.type === 'subscription_status'
    ) as any;
    
    // rate limit 상태 확인
    const rateLimitAnnotation = message.annotations?.find(
      (annotation) => annotation && typeof annotation === 'object' && 'type' in annotation && annotation.type === 'rate_limit_status'
    ) as any;

    // 마지막 메시지인지 확인
    const isLastAssistantMessage = isLastMessage && message.role === 'assistant';

    // 조건에 따른 최소 높이 계산 (로딩 상태용)
    const getLoadingMinHeight = () => {
      if (!isLastAssistantMessage) return '';
      
      // 로딩 상태에서는 데스크탑 32rem, 모바일은 기본값 사용
      const isMobileCheck = window.innerWidth < 640;
      return isMobileCheck ? 'min-h-[calc(100vh-24rem)]' : 'min-h-[calc(100vh-32rem)]';
    };

    return (
      <div className={`message-group group animate-fade-in overflow-hidden ${getLoadingMinHeight()}`} id={message.id}>
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
              (() => {
                const isPlanningExpanded = planningExpanded[planningKey] ?? !currentPlanning.isComplete;
                
                const handleToggle = (expanded: boolean) => {
                  setPlanningExpanded(prev => ({
                    ...prev,
                    [planningKey]: expanded
                  }));
                  userOverridePlanningRef.current = {
                    ...userOverridePlanningRef.current,
                    [planningKey]: expanded
                  };
                };
                
                return (
                  <PlanningSection 
                    planningData={currentPlanning}
                    isExpanded={isPlanningExpanded}
                    setIsExpanded={handleToggle}
                  />
                );
              })()
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
              (() => {
                const isReasoningExpanded = reasoningPartExpanded[loadingReasoningKey] ?? !reasoningComplete;
                
                const handleToggle = (expanded: boolean) => {
                  setReasoningPartExpanded(prev => ({
                    ...prev,
                    [loadingReasoningKey]: expanded
                  }));
                  userOverrideReasoningPartRef.current = {
                    ...userOverrideReasoningPartRef.current,
                    [loadingReasoningKey]: expanded
                  };
                };
                
                return (
                  <ReasoningSection 
                    content={reasoningPart.reasoning} 
                    isComplete={reasoningComplete}
                    isExpanded={isReasoningExpanded}
                    setIsExpanded={handleToggle}
                  />
                );
              })()
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
    <div className={`message-group group animate-fade-in overflow-hidden ${getMinHeight}`} id={message.id}>
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
            (() => {
              const isPlanningExpanded = planningExpanded[planningKey] ?? !currentPlanning.isComplete;
              
              const handleToggle = (expanded: boolean) => {
                setPlanningExpanded(prev => ({
                  ...prev,
                  [planningKey]: expanded
                }));
                userOverridePlanningRef.current = {
                  ...userOverridePlanningRef.current,
                  [planningKey]: expanded
                };
              };
              
              return (
                <PlanningSection 
                  planningData={currentPlanning}
                  isExpanded={isPlanningExpanded}
                  setIsExpanded={handleToggle}
                />
              );
            })()
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
          {reasoningPart && (
            (() => {
              const isReasoningExpanded = reasoningPartExpanded[completeReasoningKey] ?? !reasoningComplete;
              
              const handleToggle = (expanded: boolean) => {
                setReasoningPartExpanded(prev => ({
                  ...prev,
                  [completeReasoningKey]: expanded
                }));
                userOverrideReasoningPartRef.current = {
                  ...userOverrideReasoningPartRef.current,
                  [completeReasoningKey]: expanded
                };
              };
              
              return (
                <ReasoningSection 
                  key="reasoning" 
                  content={reasoningPart!.reasoning} 
                  isComplete={reasoningComplete}
                  isExpanded={isReasoningExpanded}
                  setIsExpanded={handleToggle}
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


export { Message }; 
