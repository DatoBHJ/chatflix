import type { Message as AIMessage } from 'ai'
import { IconCheck, IconCopy, IconRefresh } from './icons'
import { ReasoningSection } from './ReasoningSection'
import { MarkdownContent } from './MarkdownContent'
import { ExtendedMessage } from '../chat/[id]/types'
import { getModelById } from '@/lib/models/config'
import { Attachment } from '@/lib/types'
import React, { memo, useCallback, useState, useEffect, useMemo, useRef } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { fetchUserName } from './AccountDialog'
import { XLogo, YouTubeLogo } from './CanvasFolder/CanvasLogo';
import { Brain, ChevronDown, ChevronUp, Search, Calculator, Link2, ImageIcon, BookOpen, Database, Youtube, FileText, Download, Copy, Check } from 'lucide-react'
// 파일 타입 정의
type File = {
  name: string;
  content: string;
  description?: string;
};

import ReactMarkdown from 'react-markdown';
import { AttachmentPreview } from './Attachment'

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
  chatId?: string
  isStreaming?: boolean
  isWaitingForToolResults?: boolean
  agentReasoning?: any | null
  agentReasoningProgress?: any[]
  messageHasCanvasData?: boolean
  activePanelMessageId?: string | null
  togglePanel?: (messageId: string) => void
}

// Helper function to get structured response main content
function getStructuredResponseMainContent(message: any) {
  // 1. 먼저 annotations에서 확인
  const structuredResponseAnnotation = message.annotations?.find(
    (annotation: any) => annotation.type === 'structured_response'
  );
  
  if (structuredResponseAnnotation?.data?.response?.main_response) {
    return structuredResponseAnnotation.data.response.main_response;
  }
  
  // 2. tool_results에서 확인
  if (message.tool_results?.structuredResponse?.response?.main_response) {
    return message.tool_results.structuredResponse.response.main_response;
  }
  
  // 3. 진행 중인 응답 확인 (가장 최신 것)
  const progressAnnotations = message.annotations?.filter(
    (annotation: any) => annotation.type === 'structured_response_progress'
  );
  
  if (progressAnnotations?.length > 0) {
    const latestProgress = progressAnnotations[progressAnnotations.length - 1];
    if (latestProgress.data?.response?.main_response) {
      return latestProgress.data.response.main_response;
    }
  }
  
  return null;
}

// Helper function to get structured response description
function getStructuredResponseDescription(message: any) {
  // 1. 먼저 annotations에서 확인
  const structuredResponseAnnotation = message.annotations?.find(
    (annotation: any) => annotation.type === 'structured_response'
  );
  
  if (structuredResponseAnnotation?.data?.response?.description) {
    return structuredResponseAnnotation.data.response.description;
  }
  
  // 2. tool_results에서 확인
  if (message.tool_results?.structuredResponse?.response?.description) {
    return message.tool_results.structuredResponse.response.description;
  }
  
  // 3. 진행 중인 응답 확인 (가장 최신 것)
  const progressAnnotations = message.annotations?.filter(
    (annotation: any) => annotation.type === 'structured_response_progress'
  );
  
  if (progressAnnotations?.length > 0) {
    const latestProgress = progressAnnotations[progressAnnotations.length - 1];
    if (latestProgress.data?.response?.description) {
      return latestProgress.data.response.description;
    }
  }
  
  return null;
}

// Helper function to get structured response files
function getStructuredResponseFiles(message: any): File[] | null {
  // 1. 먼저 annotations에서 확인
  const structuredResponseAnnotation = message.annotations?.find(
    (annotation: any) => annotation.type === 'structured_response'
  );
  
  if (structuredResponseAnnotation?.data?.response?.files && 
      Array.isArray(structuredResponseAnnotation.data.response.files) && 
      structuredResponseAnnotation.data.response.files.length > 0) {
    return structuredResponseAnnotation.data.response.files;
  }
  
  // 2. tool_results에서 확인
  if (message.tool_results?.structuredResponse?.response?.files && 
      Array.isArray(message.tool_results.structuredResponse.response.files) && 
      message.tool_results.structuredResponse.response.files.length > 0) {
    return message.tool_results.structuredResponse.response.files;
  }
  
  // 3. 진행 중인 응답 확인 (가장 최신 것)
  const progressAnnotations = message.annotations?.filter(
    (annotation: any) => annotation.type === 'structured_response_progress'
  );
  
  if (progressAnnotations?.length > 0) {
    const latestProgress = progressAnnotations[progressAnnotations.length - 1];
    if (latestProgress.data?.response?.files && 
        Array.isArray(latestProgress.data.response.files) && 
        latestProgress.data.response.files.length > 0) {
      return latestProgress.data.response.files;
    }
  }
  
  return null;
}

// Helper function to check if a structured response is still in progress
function isStructuredResponseInProgress(message: any): boolean {
  // 진행 중인 응답이 있는지 확인
  const progressAnnotations = message.annotations?.filter(
    (annotation: any) => annotation.type === 'structured_response_progress'
  );
  
  if (progressAnnotations?.length > 0) {
    const latestProgress = progressAnnotations[progressAnnotations.length - 1];
    return latestProgress.data?.response?.isProgress === true;
  }
  
  return false;
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
  profileImage: propProfileImage,
  chatId,
  isStreaming = false,
  isWaitingForToolResults = false,
  agentReasoning,
  agentReasoningProgress,
  messageHasCanvasData,
  activePanelMessageId,
  togglePanel
}: MessageProps) {
  const router = useRouter();
  const supabase = createClient();
  
  // Replace context with direct state management
  const [userName, setUserName] = useState(propUserName || 'You');
  const [profileImage, setProfileImage] = useState<string | null>(propProfileImage || null);
  
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
  
  // 프리미엄 업그레이드 버튼 클릭 핸들러 (최상위 레벨에 배치)
  const handleUpgradeClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    router.push('/pricing');
  }, [router]);
  
  // Measure reasoning content height when content changes
  useEffect(() => {
    if (reasoningContentRef.current && currentReasoning) {
      setReasoningContentHeight(reasoningContentRef.current.scrollHeight);
    }
  }, [currentReasoning, reasoningExpanded]);
  
  // Fetch user data when component mounts
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      if (user && !propUserName) {
        // If userName wasn't provided as prop, fetch it from database
        const name = await fetchUserName(user.id, supabase);
        setUserName(name);
      }

      if (user && !propProfileImage) {
        // If profileImage wasn't provided as prop, fetch it from storage
        fetchProfileImage(user.id);
      }
    };

    fetchUser();
  }, [propUserName, propProfileImage]);
  
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
    // 1. isComplete가 true인 완료된 데이터가 이미 있으면 우선 보존
    if (currentReasoning?.isComplete) {
      return;
    }
    
    // 2. 완료된 새 데이터가 있으면 업데이트
    if (agentReasoning?.isComplete) {
      setCurrentReasoning({
        ...agentReasoning,
        isComplete: true // 명시적으로 boolean으로 설정
      });
      return;
    }
    
    // 3. 진행 중인 데이터 중 가장 최신 것 사용 (타임스탬프 기준)
    if (agentReasoningProgress && agentReasoningProgress.length > 0) {
      // 가장 최신 항목 찾기
      const latestProgress = [...agentReasoningProgress].sort((a, b) => {
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      })[0];
      
      // 기존 상태와 비교하여 다른 경우에만 업데이트
      if (!currentReasoning || 
          currentReasoning.reasoning !== latestProgress.reasoning ||
          currentReasoning.timestamp !== latestProgress.timestamp) {
        // isComplete 속성이 확실히 boolean 타입이 되도록 보장
        setCurrentReasoning({
          ...latestProgress,
          isComplete: !!latestProgress.isComplete
        });
      }
    }
  }, [agentReasoning, agentReasoningProgress, currentReasoning, message]);
  
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

  // Function to fetch profile image
  const fetchProfileImage = async (userId: string) => {
    try {
      // Try to get profile image from storage
      const { data: profileData, error: profileError } = await supabase
        .storage
        .from('profile-pics')
        .list(`${userId}`);

      if (profileError) {
        console.error('Error fetching profile image list:', profileError);
        return;
      }

      // If profile image exists, get public URL
      if (profileData && profileData.length > 0) {
        try {
          const fileName = profileData[0].name;
          const filePath = `${userId}/${fileName}`;
          
          // 유효성 검사 추가
          if (!fileName || typeof fileName !== 'string') {
            console.error('Invalid file name returned from storage');
            return;
          }
          
          const { data } = supabase
            .storage
            .from('profile-pics')
            .getPublicUrl(filePath);
          
          if (data && data.publicUrl) {
            // URL이 유효한지 검사
            try {
              new URL(data.publicUrl);
              setProfileImage(data.publicUrl);
            } catch (urlError) {
              console.error('Invalid URL format:', urlError);
            }
          } else {
            console.error('No valid public URL returned');
          }
        } catch (error) {
          console.error('Error getting public URL for profile image:', error);
        }
      }
    } catch (error) {
      console.error('Error in profile image fetch process:', error);
    }
  };

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
  
  // 구조화된 응답에서 main_response 가져오기
  const structuredMainResponse = isAssistant ? getStructuredResponseMainContent(message) : null;
  const structuredDescription = isAssistant ? getStructuredResponseDescription(message) : null;
  
  // 일반 메시지 내용이 있거나 구조화된 응답이 있는 경우 true
  const hasAnyContent = hasContent || structuredMainResponse;

  // Check if message is bookmarked when component mounts
  useEffect(() => {
    if (!user || !isAssistant || !message.id) return;
    
    const checkBookmarkStatus = async () => {
      try {
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
  }, [user, message.id, isAssistant, supabase]);

  // Toggle bookmark function
  const toggleBookmark = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!user || !message.id || !chatId || isBookmarkLoading) return;
    
    setIsBookmarkLoading(true);
    
    try {
      if (isBookmarked) {
        // Remove bookmark
        const { error } = await supabase
          .from('message_bookmarks')
          .delete()
          .eq('message_id', message.id)
          .eq('user_id', user.id);
          
        if (error) throw error;
        setIsBookmarked(false);
      } else {
        // Add bookmark
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
    router.push(`/chat/${chatSessionId}#${messageId}`);
  }, [router]);
  
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
                    <h2 className="font-medium text-left tracking-tight">Chatflix Reasoning</h2>
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
                      <h4 className="text-sm font-medium mb-2">Reasoning Process</h4>
                      <div className="whitespace-pre-wrap text-sm">{currentReasoning.reasoning}</div>
                    </div>
                    
                    {currentReasoning.plan && (
                      <div className="bg-[color-mix(in_srgb,var(--foreground)_4%,transparent)] p-3 rounded-md">
                        <h4 className="text-sm font-medium mb-2">Execution Plan</h4>
                        <div className="whitespace-pre-wrap text-sm">{currentReasoning.plan}</div>
                      </div>
                    )}
                    
                    {currentReasoning.selectionReasoning && (
                      <div className="bg-[color-mix(in_srgb,var(--foreground)_4%,transparent)] p-3 rounded-md">
                        <h4 className="text-sm font-medium mb-2">Tool Selection Rationale</h4>
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
            
            {/* Rate Limit 메시지 표시 */}
            {rateLimitAnnotation && rateLimitAnnotation.data && (
              <div className="text-sm text-[color-mix(in_srgb,var(--foreground)_70%,transparent)] mb-2">
                {rateLimitAnnotation.data.message.replace('upgrade for higher limits', 'get higher limits')}&nbsp;
                <button 
                  onClick={handleUpgradeClick}
                  className="text-blue-500 hover:underline font-medium"
                >
                  here
                </button>
              </div>
            )}
            
            {hasAnyContent ? (
              <div className="flex flex-col gap-2">
                {structuredMainResponse ? (
                  <>
                    {hasContent && <MarkdownContent content={message.content} />}
                    <div className="mt-4 pt-4 border-t border-[color-mix(in_srgb,var(--foreground)_10%,transparent)]">
                      <div className="text-xs text-[var(--muted)] mb-2">Final Response</div>
                      <MarkdownContent content={structuredMainResponse} />
                    </div>
                  </>
                ) : (
                  <MarkdownContent content={message.content} />
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
                    &nbsp;slow request, get fast access&nbsp;
                    <button 
                      onClick={handleUpgradeClick}
                      className="text-blue-500 hover:underline font-medium"
                    >
                      here
                    </button>
                  </span>
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
          <div className="text-xs text-[var(--muted)] uppercase tracking-wider">
            {getModelById((message as ExtendedMessage).model || currentModel)?.name || 
             ((message as ExtendedMessage).model || currentModel)}
          </div>
          
          {/* Canvas 버튼 추가 */}
          {messageHasCanvasData && (
            <button
              className="text-xs flex items-center gap-1.5 ml-auto transition-colors text-[var(--muted)] hover:text-[var(--foreground)]"
              onClick={() => togglePanel && togglePanel(message.id)}
              title="View Canvas"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sm:w-3 sm:h-3">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                <line x1="8" y1="21" x2="16" y2="21"></line>
                <line x1="12" y1="17" x2="12" y2="21"></line>
              </svg>
              <span className="hidden sm:inline">View Canvas</span>
            </button>
          )}
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
                  sizes="20px"
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
          {/* Agent Reasoning은 항상 상단에 표시 */}
          {currentReasoning && (
            <div className="p-4 sm:p-5 bg-gradient-to-br from-[color-mix(in_srgb,var(--background)_97%,var(--foreground)_3%)] to-[color-mix(in_srgb,var(--background)_99%,var(--foreground)_1%)] backdrop-blur-xl rounded-xl border border-[color-mix(in_srgb,var(--foreground)_7%,transparent)] shadow-sm mb-8">
              <div 
                className="flex items-center justify-between w-full mb-4 cursor-pointer"
                onClick={() => setReasoningExpanded(!reasoningExpanded)}
              >
                <div className="flex items-center gap-2.5">
                  <Brain className="h-4 w-4 text-[var(--foreground)]" strokeWidth={1.5} />
                  <h2 className="font-medium text-left tracking-tight">Chatflix Reasoning</h2>
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
                    <h4 className="text-sm font-medium mb-2">Reasoning Process</h4>
                    <div className="whitespace-pre-wrap text-sm">{currentReasoning.reasoning}</div>
                  </div>
                  
                  {currentReasoning.plan && (
                    <div className="bg-[color-mix(in_srgb,var(--foreground)_4%,transparent)] p-3 rounded-md">
                      <h4 className="text-sm font-medium mb-2">Execution Plan</h4>
                      <div className="whitespace-pre-wrap text-sm">{currentReasoning.plan}</div>
                    </div>
                  )}
                  
                  {currentReasoning.selectionReasoning && (
                    <div className="bg-[color-mix(in_srgb,var(--foreground)_4%,transparent)] p-3 rounded-md">
                      <h4 className="text-sm font-medium mb-2">Tool Selection Rationale</h4>
                      <div className="whitespace-pre-wrap text-sm">{currentReasoning.selectionReasoning}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
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
              
              {/* 그 다음 텍스트 파트 표시 */}
              {message.parts ? (
                <>
                  {/* 먼저 reasoning 파트를 찾아서 표시 */}
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
                  
                  {/* 그 다음 텍스트 파트 표시 */}
                  {message.parts.map((part, index) => {
                    if (part.type === 'text') {
                      const shouldTruncate = isUser && !isEditing && !expandedMessages[message.id];
                      const isLongMessage = part.text.length > 300;
                      
                      // 텍스트 파트가 여러 개 있을 때 마지막 텍스트 파트에만 로딩 표시 
                      const textParts = message.parts ? message.parts.filter(p => p.type === 'text') : [];
                      const isLastTextPart = textParts.length > 0 && textParts[textParts.length - 1] === part;
                      
                      return (
                        <React.Fragment key={index}>
                          <MarkdownContent content={shouldTruncate ? truncateMessage(part.text) : part.text} />
                          {isAssistant && isStreaming && isLastTextPart && (
                            <div className="loading-dots text-sm inline-block ml-0">
                              <span>.</span>
                              <span>.</span>
                              <span>.</span>
                            </div>
                          )}
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
                  {isAssistant && isStreaming && (
                    <div className="loading-dots text-sm inline-block ml-1">
                      <span>.</span>
                      <span>.</span>
                      <span>.</span>
                    </div>
                  )}
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
              
              {/* 구조화된 응답이 있는 경우 추가로 표시 */}
              {isAssistant && (structuredDescription || structuredFiles) && !structuredMainResponse && (
                <div className="mt-4 pt-4 border-t border-[color-mix(in_srgb,var(--foreground)_10%,transparent)]">
                  {structuredDescription && (
                    <div className="mb-4">
                      <div className="text-xs text-[var(--muted)] mb-2">Supporting Files</div>
                      <p className="text-sm">{structuredDescription}</p>
                    </div>
                  )}
                  
                  {/* 파일 목록 표시 - 파일이 있는 경우에만 */}
                  {structuredFiles && structuredFiles.length > 0 && (
                    <div className="mt-4">
                      <div className="space-y-3">
                        {structuredFiles.map((file, index) => (
                          <div key={index} className="border border-[color-mix(in_srgb,var(--foreground)_5%,transparent)] rounded-lg overflow-hidden shadow-sm transition-all hover:shadow-md hover:border-[color-mix(in_srgb,var(--foreground)_10%,transparent)]">
                            <div className="bg-[color-mix(in_srgb,var(--foreground)_3%,transparent)] hover:bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] transition-colors">
                              {/* 파일 헤더 영역 - 이름과 액션 버튼 */}
                              <div className="px-3 py-2.5 flex justify-between items-center">
                                <div 
                                  className="flex items-center gap-2.5 truncate cursor-pointer flex-grow"
                                  onClick={() => toggleFile(index)}
                                >
                                  <FileText className="h-4 w-4 flex-shrink-0" strokeWidth={1.5} />
                                  <span className="font-mono text-sm font-medium bg-[color-mix(in_srgb,var(--foreground)_6%,transparent)] px-2 py-0.5 rounded-md">
                                    {file.name}
                                  </span>
                                </div>
                                
                                <div className="flex items-center gap-2">
                                  {/* 다운로드 버튼 */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      downloadFile(file);
                                    }}
                                    className="rounded-full p-1.5 hover:bg-[color-mix(in_srgb,var(--foreground)_10%,transparent)] transition-colors flex-shrink-0"
                                    title="Download file"
                                  >
                                    <Download size={16} className="text-[color-mix(in_srgb,var(--foreground)_60%,transparent)]" />
                                  </button>
                                  
                                  {/* 복사 버튼 */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      copyFileContent(file);
                                    }}
                                    className="rounded-full p-1.5 hover:bg-[color-mix(in_srgb,var(--foreground)_10%,transparent)] transition-colors flex-shrink-0"
                                    title={copiedFileId === file.name ? "Copied!" : "Copy file content"}
                                  >
                                    {copiedFileId === file.name ? (
                                      <Check size={16} className="text-green-500" />
                                    ) : (
                                      <Copy size={16} className="text-[color-mix(in_srgb,var(--foreground)_60%,transparent)]" />
                                    )}
                                  </button>
                                  
                                  {/* 토글 버튼 */}
                                  <div 
                                    className="rounded-full p-1.5 hover:bg-[color-mix(in_srgb,var(--foreground)_10%,transparent)] transition-colors flex-shrink-0 cursor-pointer"
                                    onClick={() => toggleFile(index)}
                                  >
                                    {openFileIndexes.includes(index) ? 
                                      <ChevronUp size={16} className="text-[color-mix(in_srgb,var(--foreground)_60%,transparent)]" /> : 
                                      <ChevronDown size={16} className="text-[color-mix(in_srgb,var(--foreground)_60%,transparent)]" />
                                    }
                                  </div>
                                </div>
                              </div>
                              
                              {/* 파일 설명 영역 - 별도 행에 배치 */}
                              {file.description && (
                                <div 
                                  className="px-3 pb-2 pt-0.5 cursor-pointer"
                                  onClick={() => toggleFile(index)}
                                >
                                  <p className="text-xs text-[color-mix(in_srgb,var(--foreground)_60%,transparent)] line-clamp-2">
                                    {file.description}
                                  </p>
                                </div>
                              )}
                            </div>
                            
                            {openFileIndexes.includes(index) && (
                              <div className="border-t border-[color-mix(in_srgb,var(--foreground)_7%,transparent)] bg-[color-mix(in_srgb,var(--foreground)_1%,transparent)] p-4 overflow-auto">
                                <MarkdownContent content={file.content} />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
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
          <div className="text-xs text-[var(--muted)] uppercase tracking-wider">
            {getModelById((message as ExtendedMessage).model || currentModel)?.name || 
             ((message as ExtendedMessage).model || currentModel)}
          </div>
          
          {/* Canvas 버튼 추가 */}
          {messageHasCanvasData && (
            <button
              className="text-xs flex items-center gap-1.5 ml-auto transition-colors text-[var(--muted)] hover:text-[var(--foreground)]"
              onClick={() => togglePanel && togglePanel(message.id)}
              title="View Canvas"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sm:w-3 sm:h-3">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                <line x1="8" y1="21" x2="16" y2="21"></line>
                <line x1="12" y1="17" x2="12" y2="21"></line>
              </svg>
              <span className="hidden sm:inline">View Canvas</span>
            </button>
          )}
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

export { Message }; 