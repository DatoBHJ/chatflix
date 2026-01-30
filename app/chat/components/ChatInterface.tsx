'use client'

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { UIMessage } from 'ai';
import { useState, useEffect, useRef, useCallback, useMemo, startTransition, memo } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useAuth } from '@/app/lib/AuthContext';
import { loadMemoryWithCache } from '@/app/utils/memory-cache-client';
import { uploadFile } from '@/app/chat/[id]/utils';
import { Attachment } from '@/lib/types';
import { useMessages } from '@/app/hooks/useMessages';
import { getSystemDefaultModelId, MODEL_CONFIGS, RATE_LIMITS, isChatflixModel, resolveDefaultModelVariantId } from '@/lib/models/config';
import { getChatflixLogo } from '@/lib/models/logoUtils';
import { VirtualizedMessages } from '@/app/components/VirtualizedMessages';
import { SidePanel } from '@/app/components/SidePanel';
import { ChatInputArea } from './ChatInputArea';
import { getYouTubeLinkAnalysisData, getYouTubeSearchData, getTwitterSearchData, getWebSearchResults, getMathCalculationData, getLinkReaderData, getImageGeneratorData, getGeminiImageData, getSeedreamImageData, getGoogleSearchData } from '@/app/hooks/toolFunction';
import { Annotation } from '@/app/lib/messageUtils';
import { nanoid } from 'nanoid';
import { DragDropOverlay } from '@/app/components/ChatInput/DragDropOverlay';
import { convertMessage } from '@/app/chat/[id]/utils';

type MessageBodyOverrides = {
  model?: string;
  isAgentEnabled?: boolean;
  selectedTool?: string | null;
};

const isImageAttachment = (attachment: Attachment) => {
  const contentType = attachment.contentType || '';
  if (contentType.startsWith('image/')) {
    return true;
  }
  return attachment.fileType === 'image';
};

const createMessageParts = (text: string, attachments: Attachment[] = []) => {
  const trimmed = text.trim();
  const parts: any[] = [];

  if (trimmed) {
    parts.push({ type: 'text', text: trimmed });
  }

  attachments.forEach((attachment) => {
    if (isImageAttachment(attachment)) {
      parts.push({
        type: 'image',
        image: attachment.url,
      });
      return;
    }

    parts.push({
      type: 'file',
      url: attachment.url,
      mediaType: attachment.contentType || 'application/octet-stream',
      filename: attachment.name || 'file',
    });
  });

  return parts;
};

// ChatView 컴포넌트 (메시지가 있을 때 표시)
// 🚀 PERF: memo로 감싸서 불필요한 리렌더 방지
const ChatView = memo(function ChatView({ 
  chatId,
  messages,
  currentModel,
  isRegenerating,
  editingMessageId,
  editingContent,
  copiedMessageId,
  handleRegenerate,
  handleCopyMessage,
  handleEditStart,
  handleEditCancel,
  handleEditSave,
  setEditingContent,
  isLoading,
  activePanel,
  togglePanel,
  user,
  handleFollowUpQuestionClick,
  hasCanvasData,
  isWaitingForToolResults,
  messagesEndRef,
  messagesContainerRef,
  canvasContainerRef,
  input,
  handleInputChange,
  handleSubmit,
  stop,
  nextModel,
  setNextModel,
  rateLimitedLevels,
  isAgentEnabled,
  setisAgentEnabled,
  hasAgentModels,
  setHasAgentModels,
  reload,
  setMessages,
  handleModelSelectorChange,
  handleGlobalDrag,
  handleGlobalDragLeave,
  handleGlobalDrop,
  globalDragActive,
  globalShowPDFError,
  globalShowFolderError,
  globalShowVideoError,
  searchTerm,
  selectedTool,
  setSelectedTool,
  handleMaximizeToggle,
  isPanelMaximized,
  contextSummary,
  onLoadMore,
  hasMore
}: any) {
  // 🚀 PERF: 인라인 함수 메모이제이션으로 VirtualizedMessages memo 유효화
  const memoizedOnRegenerate = useCallback((messageId: string) => {
    return handleRegenerate(messageId, messages, setMessages, nextModel, reload, isAgentEnabled, selectedTool);
  }, [handleRegenerate, messages, setMessages, nextModel, reload, isAgentEnabled, selectedTool]);

  const memoizedOnEditSave = useCallback((messageId: string, files?: globalThis.File[], remainingAttachments?: any[]) => {
    return handleEditSave(messageId, nextModel, messages, setMessages, reload, isAgentEnabled, files, remainingAttachments, selectedTool);
  }, [handleEditSave, nextModel, messages, setMessages, reload, isAgentEnabled, selectedTool]);

  return (
    <main 
      className="flex-1 relative h-screen flex flex-col min-h-0"
      onDragEnter={!editingMessageId ? handleGlobalDrag : undefined}
      onDragOver={!editingMessageId ? handleGlobalDrag : undefined}
      onDragLeave={!editingMessageId ? handleGlobalDragLeave : undefined}
      onDrop={!editingMessageId ? handleGlobalDrop : undefined}
    >
      {/* Global Drag Drop Overlay - 메시지 편집 중일 때는 표시하지 않음 */}
      {!editingMessageId && <DragDropOverlay dragActive={globalDragActive} supportsPDFs={true} />}
      
      {/* Thread container - ChatGPT style layout */}
      <div id="thread" className="flex-1 flex flex-col min-h-0">
        {/* Scrollable message area */}
        <div 
          className="flex-1 min-h-0 overflow-hidden"
          ref={messagesContainerRef}
        >
          {/* 🚀 VIRTUALIZATION: VirtualizedMessages with thread-content layout */}
          {/* 🚀 PERF: 메모이제이션된 콜백 사용으로 불필요한 리렌더 방지 */}
          <VirtualizedMessages
            messages={messages}
            currentModel={currentModel}
            isRegenerating={isRegenerating}
            editingMessageId={editingMessageId}
            editingContent={editingContent}
            copiedMessageId={copiedMessageId}
            onRegenerate={memoizedOnRegenerate}
            onCopy={handleCopyMessage}
            onEditStart={handleEditStart}
            onEditCancel={handleEditCancel}
            onEditSave={memoizedOnEditSave}
            setEditingContent={setEditingContent}
            chatId={chatId}
            isLoading={isLoading}
            activePanelMessageId={activePanel?.messageId ?? null}
            activePanel={activePanel}
            togglePanel={togglePanel}
            user={user}
            handleFollowUpQuestionClick={handleFollowUpQuestionClick}
            hasCanvasData={hasCanvasData}
            isWaitingForToolResults={isWaitingForToolResults}
            messagesEndRef={messagesEndRef}
            searchTerm={searchTerm}
            contextSummary={contextSummary}
            onLoadMore={onLoadMore}
            hasMore={hasMore}
          />
        </div>
      </div>

      {/* SidePanel for both mobile and desktop */}
      <SidePanel
        activePanel={activePanel}
        messages={messages}
        togglePanel={togglePanel}
        canvasContainerRef={canvasContainerRef}
        onMaximizeToggle={handleMaximizeToggle}
        isPanelMaximized={isPanelMaximized}
        chatId={chatId}
        userId={user?.id}
      />

      {/* Fixed composer at bottom */}
      <ChatInputArea
        currentModel={currentModel}
        nextModel={nextModel}
        setNextModel={handleModelSelectorChange}
        disabledLevels={rateLimitedLevels}
        isAgentEnabled={isAgentEnabled}
        onAgentAvailabilityChange={setHasAgentModels}
        setisAgentEnabled={setisAgentEnabled}
        input={input}
        handleInputChange={handleInputChange}
        handleSubmit={handleSubmit}
        isLoading={isLoading}
        stop={stop}
        user={{...user, hasAgentModels}}
        modelId={nextModel}
        allMessages={messages}
        globalDragActive={globalDragActive}
        globalShowPDFError={globalShowPDFError}
        globalShowFolderError={globalShowFolderError}
        globalShowVideoError={globalShowVideoError}
        selectedTool={selectedTool}
        setSelectedTool={setSelectedTool}
        hasBackgroundImage={false}
      />
    </main>
  );
});

// Type for context summary
export interface ContextSummaryData {
  summary: string;
  summarized_until_message_id: string;
  summarized_until_sequence: number;
  created_at: string;
}

export interface ChatInterfaceProps {
  initialChatId?: string;
  initialMessages?: any[];
  contextSummary?: ContextSummaryData | null;
  totalMessageCount?: number;
}

// Main chat interface component
export default function ChatInterface({ 
  initialChatId, 
  initialMessages = [],
  contextSummary = null,
  totalMessageCount = 0
}: ChatInterfaceProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const scrollToMessageId = searchParams.get('scrollToMessage');
  const searchTerm = searchParams.get('search');
  const initialPrompt = searchParams.get('prompt'); // 홈 위젯에서 전달된 프롬프트
  const { user, isLoading: authLoading, isAuthenticated, isAnonymous } = useAuth();

  // 🚀 최적화: 클라이언트 사이드 메모리 캐싱 (localStorage)
  const [userMemory, setUserMemory] = useState<string | null>(null);
  
  // 사용자 변경 시 메모리 로드
  useEffect(() => {
    const loadMemory = async () => {
      if (user?.id && !isAnonymous) {
        try {
          const memory = await loadMemoryWithCache(user.id, ['00-personal-info', '02-interests']);
          setUserMemory(memory);
        } catch (error) {
          console.warn('Failed to load user memory:', error);
          setUserMemory(null);
        }
      } else {
        setUserMemory(null);
      }
    };
    
    loadMemory();
  }, [user?.id, isAnonymous]);

  // 🔧 FIX: 동적 chatId 관리 - 새 채팅 시 갱신 가능
  const [chatId, setChatId] = useState(() => initialChatId || nanoid());
  
  // 🚀 익명 사용자용 UUID 생성 함수
  const generateAnonymousUserId = useCallback(() => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }, []);

  // 🔒 Stable anonymous ID persisted locally to avoid per-request changes
  const anonymousId = useMemo(() => {
    try {
      const stored = typeof window !== 'undefined' ? localStorage.getItem('anonymousId') : null;
      if (stored && stored.trim() !== '') return stored;
      const id = generateAnonymousUserId();
      if (typeof window !== 'undefined') {
        localStorage.setItem('anonymousId', id);
      }
      return id;
    } catch {
      return generateAnonymousUserId();
    }
  }, [generateAnonymousUserId]);

  // 🔄 첨부파일 URL 자동 갱신 (채팅 로드 시)
  useEffect(() => {
    const userId = user?.id || anonymousId;
    if (chatId && userId) {
      fetch('/api/chat/refresh-message-urls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, userId })
      })
        .then(res => res.json())
        .catch(() => {
          // 조용히 실패 처리
        });
    }
  }, [chatId, user?.id, anonymousId]);
  
  const [currentModel, setCurrentModel] = useState('');
  const [nextModel, setNextModel] = useState('');
  const [input, setInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [rateLimitedLevels, setRateLimitedLevels] = useState<string[]>([]);
  const [isAgentEnabled, setisAgentEnabled] = useState(true);
  const [hasAgentModels, setHasAgentModels] = useState(true);
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  
  // 로고 경로 결정 (테마 기반) - 로딩 화면용
  const [logoSrc, setLogoSrc] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const theme = document.documentElement.getAttribute('data-theme');
      const isDarkMode = theme === 'dark' || 
        (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      return getChatflixLogo({ isDark: isDarkMode });
    }
    return getChatflixLogo({ isDark: false });
  });
  
  // 페이지 가시성 추적 (탭 전환 감지용)
  const [isPageVisible, setIsPageVisible] = useState<boolean>(true);
  const isInitialMountRef = useRef<boolean>(true);
  
  // 테마 감지 및 로고 경로 업데이트
  useEffect(() => {
    const checkTheme = () => {
      const theme = document.documentElement.getAttribute('data-theme');
      const isDarkMode = theme === 'dark' || 
        (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      setLogoSrc(getChatflixLogo({ isDark: isDarkMode }));
    };
    
    checkTheme();
    
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });
    
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', checkTheme);
    
    return () => {
      observer.disconnect();
      mediaQuery.removeEventListener('change', checkTheme);
    };
  }, []);

  // Chat interface state
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [activePanel, setActivePanel] = useState<{ messageId: string; type: 'canvas' | 'structuredResponse' | 'attachment'; fileIndex?: number; toolType?: string; fileName?: string } | null>(null);
  const [userPanelPreference, setUserPanelPreference] = useState<boolean | null>(null);
  const [lastPanelDataMessageId, setLastPanelDataMessageId] = useState<string | null>(null);
  const [isPanelMaximized, setIsPanelMaximized] = useState(false);

  // Track if session has been created to prevent duplicate creation
  const [sessionCreated, setSessionCreated] = useState<boolean>(!!initialChatId);
  
  // 🔧 FIX: initialChatId 변경 시 chatId 동기화 - useChat ID 변경 방지
  useEffect(() => {
    if (initialChatId && initialChatId !== chatId) {
      // chatId 변경하지 않고 sessionCreated만 업데이트
    }
    setSessionCreated(!!initialChatId);
  }, [initialChatId, chatId]);
  
  // 🔧 FIX: 세션 생성 중복 방지를 위한 ref 추가
  const sessionCreationInProgress = useRef<boolean>(false);
  const sessionCreationPromise = useRef<Promise<any> | null>(null);

  // ✅ P0 FIX: Transport 메모이제이션으로 무한 렌더링 방지
  const transport = useMemo(() => new DefaultChatTransport({ 
    api: '/api/chat', 
    credentials: 'include',
    headers: {
      'X-Anonymous-User': user ? 'false' : 'true',
      'X-Anonymous-Id': user ? '' : anonymousId
    }
  }), [user, anonymousId]);

  // ✅ P0 FIX: onFinish 콜백 메모이제이션으로 무한 렌더링 방지
  const onFinish = useCallback(async ({ message }: { message: any }) => {
    console.log('🎯 [useChat] onFinish called:', {
      messageId: message.id,
      role: message.role,
      chatId: chatId,
      initialChatId
    });
    
    // 🚀 최적화: 메시지 완료 후 메모리 캐시 갱신 (서버에서 업데이트되었을 수 있음)
    if (message.role === 'assistant' && user?.id && !isAnonymous) {
      try {
        const { invalidateMemoryCache, loadMemoryWithCache } = await import('@/app/utils/memory-cache-client');
        invalidateMemoryCache(user.id);
        const freshMemory = await loadMemoryWithCache(user.id, ['00-personal-info', '02-interests']);
        setUserMemory(freshMemory);
        console.log('🔄 [MEMORY] Client cache refreshed after message completion');
      } catch (error) {
        console.warn('Failed to refresh memory cache:', error);
      }
    }
  }, [chatId, initialChatId, user?.id, isAnonymous]);

  // ✅ P0 FIX: onError 콜백 메모이제이션으로 무한 렌더링 방지
  const onError = useCallback((error: Error & { status?: number }) => {
    let errorData;
    try {
      errorData = error.message ? JSON.parse(error.message) : null;
    } catch (e) {
      try {
        const errorMatch = error.message?.match(/\{.*\}/);
        if (errorMatch) {
          errorData = JSON.parse(errorMatch[0]);
        }
      } catch (err) {
        console.error('Failed to parse error data:', err);
        errorData = null;
      }
    }

    if (error.status === 429 || (errorData && (errorData.error === 'Too many requests' || errorData.type === 'rate_limit'))) {
      const reset = errorData?.reset || new Date(Date.now() + 60000).toISOString();
      const level = errorData?.level || '';
      
      if (level) {
        try {
          let rateLimitLevels = {};
          const existingLevelsStr = localStorage.getItem('rateLimitLevels');
          if (existingLevelsStr) {
            rateLimitLevels = JSON.parse(existingLevelsStr);
          }
          
          rateLimitLevels = {
            ...rateLimitLevels,
            [level]: {
              reset: new Date(reset).getTime(),
              models: MODEL_CONFIGS
                .filter(m => m.rateLimit.level === level)
                .map(m => m.id)
            }
          };
          
          localStorage.setItem('rateLimitLevels', JSON.stringify(rateLimitLevels));
          
          const rateLimitInfo = {
            level,
            reset: new Date(reset).getTime(),
            models: MODEL_CONFIGS
              .filter(m => m.rateLimit.level === level)
              .map(m => m.id)
          };
          localStorage.setItem('rateLimitInfo', JSON.stringify(rateLimitInfo));
        } catch (storageError) {
          console.error('Error storing rate limit info:', storageError);
        }
      }
      
      return;
    }

    console.error('🚨 [CHAT_ERROR] Unexpected chat error:', error);
    console.log('🔧 [CHAT_ERROR] Preserving chat state despite error');
  }, []);

  // useChat hook - simplified like scira
  const {
    messages,
    sendMessage,
    setMessages,
    regenerate,
    status,
    stop,
  } = useChat({
    id: chatId,
    transport: transport as any,
    experimental_throttle: 150,
    onFinish,
    onError: (error: Error & { status?: number }) => {
      onError(error);
      
      let errorData;
      try {
        errorData = error.message ? JSON.parse(error.message) : null;
      } catch (e) {
        try {
          const errorMatch = error.message?.match(/\{.*\}/);
          if (errorMatch) {
            errorData = JSON.parse(errorMatch[0]);
          }
        } catch (err) {
          errorData = null;
        }
      }

      if (error.status === 429 || (errorData && (errorData.error === 'Too many requests' || errorData.type === 'rate_limit'))) {
        const reset = errorData?.reset || new Date(Date.now() + 60000).toISOString();
        const level = errorData?.level || '';
        const modelId = errorData?.model || nextModel;
        const resetTime = new Date(reset);
        const minutesUntilReset = Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 60000));
        
        const rateLimitInfo = RATE_LIMITS[level as keyof typeof RATE_LIMITS] || {
          hourly: { requests: 10, window: '4 h' },
          daily: { requests: 20, window: '24 h' }
        };
        
        startTransition(() => {
          setMessages(prevMessages => [
            ...prevMessages,
            {
              id: `rate-limit-${Date.now()}`,
              role: 'assistant',
              content: '',
              createdAt: new Date(),
              parts: [],
              annotations: [
                {
                  type: 'rate_limit_status',
                  data: {
                    minutesUntilReset: minutesUntilReset,
                    reset: reset,
                    hourlyLimit: rateLimitInfo.hourly.requests,
                    hourlyWindow: rateLimitInfo.hourly.window,
                    dailyLimit: rateLimitInfo.daily.requests,
                    dailyWindow: rateLimitInfo.daily.window,
                    level: level,
                    model: modelId,
                    upgradeUrl: '/api/subscription/checkout'
                  }
                }
              ]
            } as any
          ]);
          
          setRateLimitedLevels(prev => 
            level && !prev.includes(level) ? [...prev, level] : prev
          );
        });
      }
    }
  });

  const isLoading = status === 'submitted' || status === 'streaming';
  const reload = regenerate;

  // 🚀 FIX: 초기 메시지 하이드레이션 (page.tsx에서 로딩 완료 후 렌더링되므로 한 번만 실행)
  useEffect(() => {
    if (initialMessages.length > 0 && messages.length === 0) {
      setMessages(initialMessages as any[]);
    }
  }, [initialMessages, messages.length, setMessages]);

  // Track if we've already handled URL sync for this chat
  const urlSyncedRef = useRef(false);
  
  // Handle URL update and sidebar notification when first assistant message arrives
  useEffect(() => {
    if (!initialChatId && messages.length > 0 && !urlSyncedRef.current) {
      const hasAssistantMessage = messages.some(m => m.role === 'assistant');
      if (hasAssistantMessage && chatId) {
        const currentPath = window.location.pathname;
        if (!currentPath.includes(`/chat/${chatId}`)) {
          window.history.replaceState(null, '', `/chat/${chatId}`);
          urlSyncedRef.current = true;
          
          const userMessage = messages.find(m => m.role === 'user');
          const messageText = (userMessage as any)?.content || 
            (userMessage?.parts?.filter((p: any) => p.type === 'text')?.map((p: any) => p.text)?.join(' ')) || '';
          
          window.dispatchEvent(new CustomEvent('newChatCreated', {
            detail: {
              id: chatId,
              title: messageText.slice(0, 30) + (messageText.length > 30 ? '...' : '') || 'New Chat',
              created_at: new Date().toISOString(),
              last_activity_at: new Date().toISOString(),
              current_model: nextModel,
            }
          }));
        }
      }
    }
  }, [messages.length, chatId, initialChatId, nextModel, messages]);

  const persistSelectedModel = useCallback(async (modelId: string) => {
    setCurrentModel(modelId);
    
    // localStorage에 마지막 선택 모델 저장 (새 채팅의 기본값으로 사용)
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('selectedModel', modelId);
      }
    } catch {
      // Ignore storage errors
    }
    
    // 🔧 FIX: 현재 채팅 세션의 current_model을 DB에 업데이트
    const currentChatId = initialChatId || chatId;
    if (user && currentChatId) {
      try {
        const { createClient } = await import('@/utils/supabase/client');
        const supabase = createClient();
        
        const { error } = await supabase
          .from('chat_sessions')
          .update({ current_model: modelId })
          .eq('id', currentChatId)
          .eq('user_id', user.id);
        
        if (error) {
          console.warn('Failed to update chat session model:', error);
        }
      } catch (error) {
        console.warn('Error updating chat session model:', error);
      }
    }
  }, [initialChatId, chatId, user]);

  const buildMessagePayload = useCallback((
    text: string,
    attachments: Attachment[] = [],
    overrides: Partial<MessageBodyOverrides> = {}
  ) => {
    const resolvedSelectedTool =
      overrides.selectedTool === undefined ? (selectedTool || null) : overrides.selectedTool;

    return {
      parts: createMessageParts(text, attachments),
      body: {
        model: overrides.model ?? nextModel,
        chatId: chatId,
        saveToDb: true,
        isAgentEnabled: overrides.isAgentEnabled ?? isAgentEnabled,
        selectedTool: resolvedSelectedTool,
        experimental_attachments: attachments.length > 0 ? attachments : undefined,
        userMemory,
      },
    };
  }, [chatId, nextModel, isAgentEnabled, selectedTool, userMemory]);

  const sendUserMessage = useCallback(async (
    text: string,
    attachments: Attachment[] = [],
    overrides?: Partial<MessageBodyOverrides>
  ) => {
    const { parts, body } = buildMessagePayload(text, attachments, overrides || {});
    await sendMessage({ role: 'user', parts }, { body });
    await persistSelectedModel(body.model);
  }, [buildMessagePayload, sendMessage, persistSelectedModel]);

  // 🚀 홈 위젯에서 전달된 prompt 자동 전송
  const initialPromptSentRef = useRef(false);
  useEffect(() => {
    if (initialPrompt && !initialPromptSentRef.current && !authLoading && nextModel) {
      initialPromptSentRef.current = true;
      // URL에서 prompt 파라미터 제거
      const newUrl = pathname;
      window.history.replaceState(null, '', newUrl);
      // 프롬프트 자동 전송
      sendUserMessage(initialPrompt, [], { isAgentEnabled: true });
    }
  }, [initialPrompt, authLoading, nextModel, pathname, sendUserMessage]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setInput(e.target.value);

  // 전역 드롭 이벤트 상태
  const [globalDragActive, setGlobalDragActive] = useState(false);
  const [globalShowPDFError, setGlobalShowPDFError] = useState(false);
  const [globalShowFolderError, setGlobalShowFolderError] = useState(false);
  const [globalShowVideoError, setGlobalShowVideoError] = useState(false);

  // 전역 드롭 이벤트 핸들러들
  const handleGlobalDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.dataTransfer.types.includes('Files')) {
      if (e.type === "dragenter" || e.type === "dragover") {
        setGlobalDragActive(true);
      }
    }
  };

  const handleGlobalDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.currentTarget.contains(e.relatedTarget as Node)) {
      return;
    }
    setGlobalDragActive(false);
  };

  const handleGlobalDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setGlobalDragActive(false);
    
    const items = e.dataTransfer.items;
    if (!items) return;

    let hasFolder = false;
    for (let i = 0; i < items.length; i++) {
      const entry = items[i].webkitGetAsEntry();
      if (entry?.isDirectory) {
        hasFolder = true;
        break;
      }
    }

    if (hasFolder) {
      setGlobalShowFolderError(true);
      setTimeout(() => setGlobalShowFolderError(false), 3000);
      return;
    }

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) {
        const dataTransfer = new DataTransfer();
        Array.from(e.dataTransfer.files).forEach(file => {
          dataTransfer.items.add(file);
        });
        fileInput.files = dataTransfer.files;
        
        const event = new Event('change', { bubbles: true });
        fileInput.dispatchEvent(event);
      }
    }
  };

  // Handle signup prompt events from Message components
  useEffect(() => {
    const handleAddSignupPrompt = (event: CustomEvent) => {
      const { message } = event.detail;
      setMessages((prevMessages: UIMessage[]) => [...prevMessages, message]);
    };

    window.addEventListener('addSignupPrompt', handleAddSignupPrompt as EventListener);
    
    return () => {
      window.removeEventListener('addSignupPrompt', handleAddSignupPrompt as EventListener);
    };
  }, [setMessages]);

  // 🔧 FIX: 새 채팅 요청 및 구독 성공 이벤트 리스너 추가
  useEffect(() => {
    const handleNewChatRequest = () => {
      console.log('🚀 [NEW_CHAT] Starting new chat...', { 
        messagesLength: messages.length, 
        initialChatId,
        currentChatId: chatId,
        pathname
      });
      
      if (status === 'streaming' || status === 'submitted') {
        stop();
      }
      
      const newChatId = nanoid();
      setChatId(newChatId);
      
      // 🔧 FIX: 메시지 및 플래그 초기화 추가
      setMessages([]);
      urlSyncedRef.current = false;
      
      startTransition(() => {
        setInput('');
        setIsSubmitting(false);
        setActivePanel(null);
        setUserPanelPreference(null);
        setLastPanelDataMessageId(null);
        setSessionCreated(false);
      });
      
      console.log('🚀 [NEW_CHAT] New chatId generated:', newChatId, 'Previous messages cleared');
    };

    const handleSubscriptionSuccess = () => {
      console.log('ChatInterface: Subscription success event received, clearing rate limits...');
      setRateLimitedLevels([]);
      localStorage.removeItem('rateLimitLevels');
      localStorage.removeItem('rateLimitInfo');
    };

    window.addEventListener('requestNewChat', handleNewChatRequest);
    window.addEventListener('subscriptionSuccess', handleSubscriptionSuccess);
    
    return () => {
      window.removeEventListener('requestNewChat', handleNewChatRequest);
      window.removeEventListener('subscriptionSuccess', handleSubscriptionSuccess);
    };
  }, [status, stop, pathname, messages.length, initialChatId, chatId]);

  // useMessages hook
  const {
    isRegenerating,
    editingMessageId,
    editingContent,
    copiedMessageId,
    handleCopyMessage,
    handleEditStart,
    handleEditCancel,
    handleEditSave,
    handleRegenerate,
    setEditingContent
  } = useMessages(initialChatId || chatId, user?.id || 'anonymous');

  // 🔧 FIX: totalMessageCount를 사용하여 정확한 hasMore 계산
  // - totalMessageCount > 20: 부분 로드됨, 더 로드할 메시지 있음
  // - totalMessageCount <= 20: 전체 로드됨, 더 로드할 메시지 없음
  const [hasMore, setHasMore] = useState(totalMessageCount > 20);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // 🔧 FIX: totalMessageCount가 비동기로 로드되므로 hasMore 상태 업데이트
  useEffect(() => {
    if (totalMessageCount > 0) {
      setHasMore(totalMessageCount > 20);
    }
  }, [totalMessageCount]);

  const handleLoadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore || messages.length === 0) return;
    
    setIsLoadingMore(true);
    try {
      const { createClient } = await import('@/utils/supabase/client');
      const supabase = createClient();
      
      const oldestMessageId = messages[0].id;
      
      const { data: messageData, error: msgError } = await supabase
        .from('messages')
        .select('sequence_number')
        .eq('id', oldestMessageId)
        .single();
        
      if (msgError || !messageData) {
        console.warn('Could not find oldest message sequence number');
        setHasMore(false);
        return;
      }
      
      const currentSequence = messageData.sequence_number;
      const userId = user?.id || anonymousId;
      
      const { data: previousMessages, error } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_session_id', chatId)
        .eq('user_id', userId)
        .lt('sequence_number', currentSequence)
        .order('sequence_number', { ascending: false })
        .limit(20);
        
      if (error) throw error;
      
      if (previousMessages && previousMessages.length > 0) {
        const newMessages = previousMessages.reverse().map(convertMessage);
        
        // We need to cast to any because UIMessage type might be slightly different from ExtendedMessage
        setMessages((prevMessages: UIMessage[]) => [...(newMessages as any[]), ...prevMessages]);
        
        if (previousMessages.length < 20) {
          setHasMore(false);
        }
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error('Error loading more messages:', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [chatId, hasMore, isLoadingMore, messages, user?.id, anonymousId, setMessages]);

  // 모델 초기화 - 인증 상태에 따라
  useEffect(() => {
    const initializeModel = async () => {
      try {
        setIsModelLoading(true);
        
        if (!user) {
          // 익명 사용자가 채팅 URL에 접근한 경우 채팅 목록으로 리디렉션
          if (initialChatId) {
            console.log('🚀 Anonymous user accessing chat URL, redirecting to chat list');
            router.push('/chat');
            return;
          }
          
          const systemDefault = getSystemDefaultModelId();
          const storedSelected = typeof window !== 'undefined' ? localStorage.getItem('selectedModel') : null;
          const rawModel = storedSelected || systemDefault;
          const modelToUse = resolveDefaultModelVariantId(rawModel);
          setCurrentModel(modelToUse);
          setNextModel(modelToUse);
          
          setHasAgentModels(true);
          
          setIsModelLoading(false);
          return;
        }
        
        const { createClient } = await import('@/utils/supabase/client');
        const supabase = createClient();
        
        // 🔧 FIX: 기존 채팅은 해당 채팅의 current_model을 우선 사용
        if (initialChatId) {
          const { data: currentSession } = await supabase
            .from('chat_sessions')
            .select('current_model')
            .eq('id', initialChatId)
            .eq('user_id', user.id)
            .single();
          
          if (currentSession?.current_model) {
            // 기존 채팅의 모델 사용
            const modelToUse = resolveDefaultModelVariantId(currentSession.current_model);
            setCurrentModel(modelToUse);
            setNextModel(modelToUse);
            setIsModelLoading(false);
            return;
          }
        }
        
        // 새 채팅이거나 기존 채팅에 current_model이 없는 경우
        // localStorage의 마지막 선택 모델을 기본값으로 사용
        const storedSelected = typeof window !== 'undefined' ? localStorage.getItem('selectedModel') : null;
        const systemDefault = getSystemDefaultModelId();
        const rawModel = storedSelected || systemDefault;
        const modelToUse = resolveDefaultModelVariantId(rawModel);
        setCurrentModel(modelToUse);
        setNextModel(modelToUse);
      } catch (error) {
        console.error('Error loading user info or model:', error);
        const systemDefault = getSystemDefaultModelId();
        const storedSelected = typeof window !== 'undefined' ? localStorage.getItem('selectedModel') : null;
        const rawModel = storedSelected || systemDefault;
        const modelToUse = resolveDefaultModelVariantId(rawModel);
        setCurrentModel(modelToUse);
        setNextModel(modelToUse);
      } finally {
        setIsModelLoading(false);
      }
    };
    
    if (!authLoading) {
      initializeModel();
    }
  }, [user, authLoading, initialChatId, router]);

  // ✅ P1 FIX: 초기 메시지 하이드레이션 1회 보장으로 무한 렌더링 방지 (Removed as redundant)
  // const hydratedRef = useRef(false);
  // useEffect(() => {
  //   if (hydratedRef.current) return;
  //   if (initialChatId && initialMessages?.length > 0) {
  //     hydratedRef.current = true;
  //     setMessages(prev => (prev.length ? prev : initialMessages));
  //   }
  // }, [initialChatId, initialMessages, setMessages]);

  // 페이지 가시성 추적
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsPageVisible(!document.hidden);
    };
    
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        setIsPageVisible(true);
      }
    };
    
    setIsPageVisible(!document.hidden);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pageshow', handlePageShow);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, []);

  // 초기 메시지 로딩 상태 감지: initialChatId가 있고 메시지가 아직 로드되지 않았을 때
  // 단, 탭 전환(페이지가 이미 visible 상태)인 경우는 로딩 표시하지 않음
  const isInitialLoading = (() => {
    // 🚀 최적화: 이미 메시지가 존재하는 상황에서는 어떠한 경우에도 로딩을 표시하지 않음
    if (messages.length > 0) {
      return false;
    }

    // 🚀 최적화: 이미 세션에서 로드된 적이 있는 채팅이면 로딩 표시하지 않음
    if (typeof window !== 'undefined' && initialChatId) {
      const loadedChats = JSON.parse(sessionStorage.getItem('loaded_chats') || '{}')
      if (loadedChats[initialChatId]) {
        return false
      }
    }

    // 초기 마운트가 아니고 페이지가 visible 상태인 경우는 탭 전환이므로 로딩 표시하지 않음
    if (!isInitialMountRef.current && isPageVisible && messages.length > 0) {
      return false;
    }
    
    // 실제로 메시지가 로드되지 않은 경우에만 로딩 표시
    return initialChatId && (!initialMessages || initialMessages.length === 0) && messages.length === 0;
  })();
  
  // 초기 마운트 플래그 업데이트
  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
    }
  }, []);

  // 새 메시지 제출 처리
  const handleModelSubmit = useCallback(async (e: React.FormEvent, files?: FileList) => {
    e.preventDefault();
    
    const submittedText = ((e as any)?.target?.value ?? input) as string;
    const hasText = submittedText.trim().length > 0;
    const hasFiles = Boolean(files?.length);

    if (isSubmitting || (!hasText && !hasFiles)) return;

    setIsSubmitting(true);
    setInput('');

    try {
      let attachments: Attachment[] = [];
      if (files?.length) {
        try {
          const userId = user?.id || 'anonymous';
          const uploadPromises = Array.from(files).map(file => uploadFile(file, userId));
          attachments = await Promise.all(uploadPromises);
        } catch (error) {
          console.warn('File upload failed, proceeding with text-only message');
          attachments = [];
        }
      }

      await sendUserMessage(submittedText, attachments);
     } catch (error) {
       console.error('Message submission error:', error);
     } finally {
      setIsSubmitting(false);
    }
  }, [input, isSubmitting, user?.id, sendUserMessage]);

  // Stop 처리
  const handleStop = useCallback(async () => {
    try {
      console.log('🛑 [STOP] Stopping stream and saving partial message...');
      stop();

      const lastMessage = messages[messages.length - 1];
      
      if (lastMessage?.role === 'assistant' && initialChatId && user) {
        const { createClient } = await import('@/utils/supabase/client');
        const supabase = createClient();
        
        const { data: messageData, error: selectError } = await supabase
          .from('messages')
          .select('id')
          .eq('chat_session_id', initialChatId)
          .eq('user_id', user.id)
          .eq('role', 'assistant')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (selectError) {
          console.error('🛑 [STOP] Error finding message:', selectError);
          return;
        }

        if (messageData) {
          const toolResults = lastMessage.parts?.filter((p: any) => p.type === 'tool-result') || [];
          // 스트림 중단 시점에는 token_usage가 아직 설정되지 않았을 수 있음
          // 서버의 onFinish에서 나중에 업데이트될 것임
          const tokenUsage = (lastMessage as any).token_usage || null;
          
          const updateData = {
            content: (() => {
              const text = lastMessage.parts?.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('\n');
              return text ?? ((lastMessage as any).content ?? '');
            })(),
            reasoning: (() => {
              const reasoningPart = lastMessage.parts?.find((part: any) => part.type === 'reasoning');
              const reasoning = (reasoningPart as any)?.text || (reasoningPart as any)?.reasoningText;
              return reasoning && reasoning.trim() ? reasoning : null;
            })(),
            tool_results: toolResults.length > 0 ? toolResults : null,
            token_usage: tokenUsage,
            model: currentModel,
            created_at: new Date().toISOString()
          };

          const { error: updateError } = await supabase
            .from('messages')
            .update(updateData)
            .eq('id', messageData.id)
            .eq('user_id', user!.id);

          if (updateError) {
            console.error('🛑 [STOP] Error updating message:', updateError);
            return;
          }

          setMessages((prevMessages: any) => {
            const updatedMessages = [...prevMessages];
            const lastIndex = updatedMessages.length - 1;
            if (lastIndex >= 0 && updatedMessages[lastIndex].role === 'assistant') {
              const lastMessageText = (lastMessage.parts?.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('\n')) ?? ((lastMessage as any).content ?? '');
              updatedMessages[lastIndex] = {
                ...(updatedMessages[lastIndex] as any),
                content: lastMessageText,
                parts: lastMessage.parts,
              } as any;
            }
            return updatedMessages;
          });
        }
      }
    } catch (error) {
      console.error('🛑 [STOP] Error in handleStop:', error);
    }
  }, [stop, messages, currentModel, initialChatId, user?.id, setMessages]);

  // Agent 토글 처리
  const handleAgentToggle = (newState: boolean) => {
    if (isChatflixModel(currentModel)) {
      setisAgentEnabled(newState);
      return;
    }
    
    if (newState && !hasAgentModels && user) {
      console.warn('Cannot enable agent: No non-rate-limited agent models available');
      return;
    }
    setisAgentEnabled(newState);
  };

  const setAgentEnabledHandler: React.Dispatch<React.SetStateAction<boolean>> = (value) => {
    const newValue = typeof value === 'function' ? value(isAgentEnabled) : value;
    handleAgentToggle(newValue);
  };

  // Follow-up question 처리
  const handleFollowUpQuestionClick = async (question: string) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    
    try {
      await sendUserMessage(question);
    } catch (error) {
      console.error('Error submitting follow-up question:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 패널 토글
  const togglePanel = (messageId: string, type: 'canvas' | 'structuredResponse' | 'attachment', fileIndex?: number, toolType?: string, fileName?: string) => {
    const isSameOpen = activePanel?.messageId === messageId && activePanel.type === type && activePanel?.fileIndex === fileIndex && activePanel?.toolType === toolType;
    if (isSameOpen) {
      setActivePanel(null);
      setUserPanelPreference(false);
      setIsPanelMaximized(false);
      return;
    }

    setActivePanel({ messageId, type, fileIndex, toolType, fileName });
    setUserPanelPreference(true);
  };

  // 패널 최대화/복원 토글 핸들러
  const handleMaximizeToggle = useCallback(() => {
    setIsPanelMaximized(!isPanelMaximized);
  }, [isPanelMaximized]);

  // 캔버스 데이터 확인
  const hasCanvasData = (message: any) => {
    const hasStructuredResponseFiles = () => {
      const annotations = (message as any).annotations as Annotation[] | undefined;
      const structuredResponseAnnotation = annotations?.find(
        (annotation) => annotation?.type === 'structured_response'
      );
      
      if (structuredResponseAnnotation?.data?.response?.files?.length > 0) {
        return true;
      }
      
      const toolResults = (message as any).tool_results;
      if (toolResults?.structuredResponse?.response?.files?.length > 0) {
        return true;
      }
      
      const progressAnnotations = annotations?.filter(
        (annotation) => annotation?.type === 'structured_response_progress'
      );
      
      if (progressAnnotations && progressAnnotations.length > 0) {
        const latestProgress = progressAnnotations[progressAnnotations.length - 1];
        if (latestProgress?.data?.response?.files?.length > 0) {
          return true;
        }
      }
      
      return false;
    };

    const webSearchData = getWebSearchResults(message);
    const hasWebSearchData = !!webSearchData && (
      (webSearchData.results && webSearchData.results.length > 0) || 
      (webSearchData.result && (webSearchData.result as any)?.searches && (webSearchData.result as any).searches.length > 0)
    );
    const twitterSearchData = getTwitterSearchData(message);
    const hasTwitterSearchData = !!twitterSearchData && (
      (twitterSearchData.results && twitterSearchData.results.length > 0)
    );

    return !!(
      hasWebSearchData || 
      hasTwitterSearchData ||
      getMathCalculationData(message) || 
      getLinkReaderData(message) || 
      getImageGeneratorData(message) || 
      getGeminiImageData(message) ||
      getSeedreamImageData(message) ||
      getYouTubeSearchData(message) || 
      getYouTubeLinkAnalysisData(message) || 
      getGoogleSearchData(message) ||
      hasStructuredResponseFiles()
    );
  };

  // 로딩 중인 도구 결과 확인
  const isWaitingForToolResults = (message: any) => {
    if (!message) return false;
    
    if (message.role === 'assistant' && isLoading && message.id === messages[messages.length - 1]?.id) {
      const hasToolCalls = message.parts?.some((part: any) => part.type === 'tool-call');
      
      if (!hasToolCalls) {
        return false;
      }
      
      const hasToolResults = message.parts?.some((part: any) => part.type === 'tool-result');
      
      if (hasToolResults) {
        return false;
      }
      
      const hasTextStarted = message.parts?.some((part: any) => 
        part.type === 'text' && (part.text || '').trim().length > 0
      );
      
      if (hasTextStarted) {
        return false;
      }
      
      return true;
    }
    
    return false;
  };

  // 🔧 FIX: ModelSelector용 모델 변경 핸들러
  const handleModelSelectorChange = useCallback(async (newModel: string) => {
    setNextModel(newModel);
    setCurrentModel(newModel);
    
    // localStorage에 마지막 선택 모델 저장 (새 채팅의 기본값으로 사용)
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('selectedModel', newModel);
      }
    } catch {}
    
    // 🔧 FIX: 현재 채팅 세션의 current_model을 DB에 업데이트
    const currentChatId = initialChatId || chatId;
    if (user && currentChatId) {
      try {
        const { createClient } = await import('@/utils/supabase/client');
        const supabase = createClient();
        
        const { error } = await supabase
          .from('chat_sessions')
          .update({ current_model: newModel })
          .eq('id', currentChatId)
          .eq('user_id', user.id);
        
        if (error) {
          console.warn('Failed to update chat session model:', error);
        }
      } catch (error) {
        console.warn('Error updating chat session model:', error);
      }
    }
  }, [initialChatId, chatId, user]);

  // Enhanced submit with reset
  const handleModelSubmitWithReset = useCallback(async (e: React.FormEvent, files?: FileList) => {
    setUserPanelPreference(null);
    await handleModelSubmit(e, files);
  }, [handleModelSubmit]);

  // 패널 데이터 업데이트
  useEffect(() => {
    const lastAssistantMessages = messages.filter(msg => msg.role === 'assistant');
    if (lastAssistantMessages.length === 0) return;
    
    const lastAssistantMessage = lastAssistantMessages[lastAssistantMessages.length - 1];
    
    if (hasCanvasData(lastAssistantMessage)) {
      if (lastPanelDataMessageId !== lastAssistantMessage.id) {
        setLastPanelDataMessageId(lastAssistantMessage.id);
        
        if (userPanelPreference === true) {
          if (activePanel?.messageId === lastAssistantMessage.id) {
            return;
          }
          togglePanel(lastAssistantMessage.id, 'canvas');
        }
      }
    }
  }, [
    messages.length,
    messages[messages.length - 1]?.id,
    userPanelPreference, 
    lastPanelDataMessageId
  ]);

  // 초기 로딩 상태일 때 로딩 스피너 표시
  // 🚀 최적화: messages가 이미 있는 경우는 절대로 로딩을 보여주지 않음
  if (messages.length === 0 && (isInitialLoading || (isModelLoading && initialChatId))) {
    return (
      <main className="flex-1 relative h-screen flex flex-col items-center justify-center bg-background overflow-hidden">
        {/* 배경 방사형 그라데이션 펄스 */}
        <div className="absolute inset-0 chat-loading-bg-pulse"></div>
        
        <div className="flex flex-col items-center gap-6 animate-fade-in relative z-10">
          {/* 로고 컨테이너 */}
          <div className="relative chat-loading-logo-container">
            {/* 글로우 효과 레이어 */}
            <div className="absolute inset-0 chat-loading-glow-pulse"></div>
            
            {/* 로고 */}
            <div className="relative chat-loading-logo-float">
              <img
                src={logoSrc}
                alt="Chatflix"
                className="w-24 h-24 md:w-32 md:h-32 chat-loading-logo-shimmer"
              />
            </div>
          </div>
        </div>
        
        <style jsx>{`
          @keyframes fade-in {
            from { 
              opacity: 0; 
              transform: translateY(-10px); 
            }
            to { 
              opacity: 1; 
              transform: translateY(0); 
            }
          }
          
          @keyframes chat-loading-glow-pulse {
            0%, 100% { 
              opacity: 0.3;
              transform: scale(1.2);
              filter: blur(20px);
            }
            50% { 
              opacity: 0.6;
              transform: scale(1.4);
              filter: blur(30px);
            }
          }
          
          @keyframes chat-loading-logo-shimmer {
            0% {
              filter: drop-shadow(0 0 10px rgba(59, 130, 246, 0.5));
            }
            50% {
              filter: drop-shadow(0 0 20px rgba(139, 92, 246, 0.7));
            }
            100% {
              filter: drop-shadow(0 0 10px rgba(59, 130, 246, 0.5));
            }
          }
          
          @keyframes chat-loading-logo-float {
            0%, 100% { 
              transform: translateY(0px);
            }
            50% { 
              transform: translateY(-8px);
            }
          }
          
          @keyframes chat-loading-bg-pulse {
            0%, 100% {
              opacity: 0.1;
              background: radial-gradient(
                circle at center,
                rgba(59, 130, 246, 0.15) 0%,
                transparent 70%
              );
            }
            50% {
              opacity: 0.2;
              background: radial-gradient(
                circle at center,
                rgba(139, 92, 246, 0.25) 0%,
                transparent 70%
              );
            }
          }
          
          .animate-fade-in {
            animation: fade-in 0.6s ease-out;
          }
          
          .chat-loading-logo-container {
            position: relative;
          }
          
          .chat-loading-glow-pulse {
            background: radial-gradient(circle, rgba(59, 130, 246, 0.4), transparent 70%);
            border-radius: 50%;
            animation: chat-loading-glow-pulse 2.5s ease-in-out infinite;
            pointer-events: none;
          }
          
          .chat-loading-logo-float {
            animation: chat-loading-logo-float 3s ease-in-out infinite;
          }
          
          .chat-loading-logo-shimmer {
            position: relative;
            animation: chat-loading-logo-shimmer 3s ease-in-out infinite;
            transition: filter 0.3s ease;
          }
          
          .chat-loading-bg-pulse {
            animation: chat-loading-bg-pulse 4s ease-in-out infinite;
            pointer-events: none;
          }
        `}</style>
      </main>
    );
  }

  // Always show ChatView in chat app
  return (
    <ChatView
      chatId={initialChatId || chatId}
      messages={messages}
      currentModel={currentModel}
      isRegenerating={isRegenerating}
      editingMessageId={editingMessageId}
      editingContent={editingContent}
      copiedMessageId={copiedMessageId}
      handleRegenerate={handleRegenerate}
      handleCopyMessage={handleCopyMessage}
      handleEditStart={handleEditStart}
      handleEditCancel={handleEditCancel}
      handleEditSave={handleEditSave}
      setEditingContent={setEditingContent}
      isLoading={isLoading}
      activePanel={activePanel}
      togglePanel={togglePanel}
      user={user}
      handleFollowUpQuestionClick={handleFollowUpQuestionClick}
      hasCanvasData={hasCanvasData}
      isWaitingForToolResults={isWaitingForToolResults}
      messagesEndRef={messagesEndRef}
      messagesContainerRef={messagesContainerRef}
      canvasContainerRef={canvasContainerRef}
      input={input}
      handleInputChange={handleInputChange}
      handleSubmit={handleModelSubmitWithReset}
      stop={handleStop}
      nextModel={nextModel}
      setNextModel={handleModelSelectorChange}
      rateLimitedLevels={rateLimitedLevels}
      isAgentEnabled={isAgentEnabled}
      setisAgentEnabled={setAgentEnabledHandler}
      hasAgentModels={hasAgentModels}
      setHasAgentModels={setHasAgentModels}
      reload={reload}
      setMessages={setMessages}
      handleModelSelectorChange={handleModelSelectorChange}
      handleGlobalDrag={handleGlobalDrag}
      handleGlobalDragLeave={handleGlobalDragLeave}
      handleGlobalDrop={handleGlobalDrop}
      globalDragActive={globalDragActive}
      globalShowPDFError={globalShowPDFError}
      globalShowFolderError={globalShowFolderError}
      globalShowVideoError={globalShowVideoError}
      searchTerm={searchTerm}
      selectedTool={selectedTool}
      setSelectedTool={setSelectedTool}
      handleMaximizeToggle={handleMaximizeToggle}
      isPanelMaximized={isPanelMaximized}
      contextSummary={contextSummary}
      onLoadMore={handleLoadMore}
      hasMore={hasMore}
    />
  );
}

