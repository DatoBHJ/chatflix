'use client'

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { UIMessage } from 'ai';
import { useState, useEffect, useRef, useCallback, useMemo, startTransition } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useAuth } from '@/app/lib/AuthContext';
import { convertMessage, uploadFile } from '@/app/chat/[id]/utils';
import { Attachment } from '@/lib/types';
import { useMessages } from '@/app/hooks/useMessages';
import { getSystemDefaultModelId, MODEL_CONFIGS, RATE_LIMITS, isChatflixModel, getModelById } from '@/lib/models/config';
import { Messages } from '@/app/components/Messages';
import { SidePanel } from '@/app/components/SidePanel';
import { ChatInputArea } from '@/app/components/ChatInputArea';
import { getYouTubeLinkAnalysisData, getYouTubeSearchData, getXSearchData, getWebSearchResults, getMathCalculationData, getLinkReaderData, getImageGeneratorData, getGoogleSearchData } from '@/app/hooks/toolFunction';
import { Annotation } from '@/app/lib/messageUtils';
import { nanoid } from 'nanoid';
import { SuggestedPrompt } from '@/app/components/SuggestedPrompt/SuggestedPrompt';
// import { useHomeStarryNight } from '@/app/hooks/useHomeStarryNight';
import { useMouseIdleDetection } from '@/app/hooks/useMouseIdleDetection';
import { useDarkMode } from '@/app/hooks/useDarkMode';
import { formatMessageGroupTimestamp } from '@/app/lib/messageGroupTimeUtils';
// import { StarryNightBackground } from './StarryNightBackground.backup';
import { DragDropOverlay } from './ChatInput/DragDropOverlay';

// HomeView 컴포넌트 (메시지가 없을 때 표시)
function HomeView({ 
  user, 
  input, 
  handleInputChange, 
  handleSubmit, 
  isLoading, 
  stop, 
  currentModel, 
  nextModel, 
  setNextModel, 
  rateLimitedLevels, 
  isAgentEnabled, 
  setisAgentEnabled, 
  hasAgentModels, 
  setHasAgentModels,
  onSuggestedPromptClick,
  isDarkMode,
  // isStarryNightEnabled,
  handleModelSelectorChange,
  handleGlobalDrag,
  handleGlobalDragLeave,
  handleGlobalDrop,
  globalDragActive,
  selectedTool,
  setSelectedTool,
  editingMessageId
}: any) {
  const isMouseIdle = useMouseIdleDetection(3000); // 3초 동안 마우스가 움직이지 않으면 idle로 간주

  return (
    <main 
      className="flex-1 relative h-screen flex flex-col"
      onDragEnter={!editingMessageId ? handleGlobalDrag : undefined}
      onDragOver={!editingMessageId ? handleGlobalDrag : undefined}
      onDragLeave={!editingMessageId ? handleGlobalDragLeave : undefined}
      onDrop={!editingMessageId ? handleGlobalDrop : undefined}
    >
      {/* Global Drag Drop Overlay - 메시지 편집 중일 때는 표시하지 않음 */}
      {!editingMessageId && <DragDropOverlay dragActive={globalDragActive} supportsPDFs={true} />}
      
      {/* StarryNightBackground - 홈화면에서만 다크모드이고 설정이 활성화되고 마우스가 idle일 때만 표시 */}
      {/* {isDarkMode && isStarryNightEnabled && isMouseIdle && <StarryNightBackground />} */}
      
      {/* Header is positioned fixed, so content area starts from the top */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* 주 컨텐츠 영역 - Mobile/Desktop Responsive */}
        {/* Mobile Layout */}
        <div className="flex flex-col sm:hidden min-h-0 flex-1">
          <div className="overflow-y-auto  flex-1 scrollbar-minimal">
            <div className="messages-container mb-4 flex flex-col sm:px-4">
              <div className="flex-grow">
                {/* Chatflix label - iMessage style */}
                <div className="message-timestamp relative z-10" style={{ paddingBottom: '0', textTransform: 'none', color: '#737373' }}>
                  Chatflix
                </div>
                
                {/* Date display - centered at the top */}
                <div className="message-timestamp relative z-10" style={{ paddingTop: '0', textTransform: 'none', color: '#737373' }}>
                  {user?.created_at ? formatMessageGroupTimestamp(new Date(user.created_at)) : formatMessageGroupTimestamp(new Date())}
                </div>
                
                {/* Center section for suggested prompts */}
                <div className="flex-1 flex flex-col items-center justify-center">
                  {/* Display suggested prompt in the center area - with message-group styling */}
                  {/* 🚀 익명 사용자 지원: 익명 사용자도 SuggestedPrompt 사용 가능 */}
                  {(user?.id || !user) && (
                    <div className="w-full max-w-2xl mb-2 pt-2">
                      <div className="message-group group animate-fade-in">
                                              <SuggestedPrompt 
                        userId={user?.id || 'anonymous'} 
                        onPromptClick={onSuggestedPromptClick}
                        isVisible={true}
                      />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Desktop Layout */}
        <div className="hidden sm:flex min-h-0 flex-1">
          <div className="overflow-y-auto flex-1 scrollbar-minimal">
            <div className="w-full mx-auto">
              <div className="messages-container mb-4 flex flex-col sm:px-4">
                <div className="flex-grow">
                  {/* Chatflix label - iMessage style */}
                  <div className="message-timestamp relative z-10" style={{ paddingBottom: '0', textTransform: 'none', color: '#737373' }}>
                    Chatflix
                  </div>
                  
                  {/* Date display - centered at the top */}
                  <div className="message-timestamp relative z-10" style={{ paddingTop: '0', textTransform: 'none', color: '#737373' }}>
                    {user?.created_at ? formatMessageGroupTimestamp(new Date(user.created_at)) : formatMessageGroupTimestamp(new Date())}
                  </div>
                  
                  {/* Center section for suggested prompts */}
                  <div className="flex-1 flex flex-col items-center justify-center">
                    {/* Display suggested prompt in the center area - with message-group styling */}
                    {/* 🚀 익명 사용자 지원: 익명 사용자도 SuggestedPrompt 사용 가능 */}
                    {(user?.id || !user) && (
                      <div className="w-full max-w-3xl mb-2 pt-2">
                        <div className="message-group group animate-fade-in">
                                                <SuggestedPrompt 
                        userId={user?.id || 'anonymous'} 
                        onPromptClick={onSuggestedPromptClick}
                        isVisible={true}
                      />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom fixed chat input area */}
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
        disabled={isLoading}
        selectedTool={selectedTool}
        setSelectedTool={setSelectedTool}
      />
    </main>
  );
}

// ChatView 컴포넌트 (메시지가 있을 때 표시)
function ChatView({ 
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
  searchTerm, // 🚀 FEATURE: Add search term for highlighting
  selectedTool,
  setSelectedTool,
  handleMaximizeToggle,
  isPanelMaximized
}: any) {
  
  return (
    <main 
      className="flex-1 relative h-screen flex flex-col"
      onDragEnter={!editingMessageId ? handleGlobalDrag : undefined}
      onDragOver={!editingMessageId ? handleGlobalDrag : undefined}
      onDragLeave={!editingMessageId ? handleGlobalDragLeave : undefined}
      onDrop={!editingMessageId ? handleGlobalDrop : undefined}
    >
      {/* Global Drag Drop Overlay - 메시지 편집 중일 때는 표시하지 않음 */}
      {!editingMessageId && <DragDropOverlay dragActive={globalDragActive} supportsPDFs={true} />}
      
      {/* Header is positioned fixed, so content area starts from the top */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* 주 컨텐츠 영역 - Mobile/Desktop Responsive */}
        {/* Mobile Layout */}
        <div className="flex flex-col sm:hidden min-h-0 flex-1">
          <div className="overflow-y-auto pb-20 flex-1 scrollbar-minimal" ref={messagesContainerRef}>
            <Messages
              messages={messages}
              currentModel={currentModel}
              isRegenerating={isRegenerating}
              editingMessageId={editingMessageId}
              editingContent={editingContent}
              copiedMessageId={copiedMessageId}
                                  onRegenerate={(messageId: string) => handleRegenerate(messageId, messages, setMessages, nextModel, reload, isAgentEnabled, selectedTool)}
              onCopy={handleCopyMessage}
              onEditStart={handleEditStart}
              onEditCancel={handleEditCancel}
                                  onEditSave={(messageId: string, files?: globalThis.File[], remainingAttachments?: any[]) => handleEditSave(messageId, nextModel, messages, setMessages, reload, isAgentEnabled, files, remainingAttachments, selectedTool)}
              setEditingContent={setEditingContent}
              chatId={chatId}
              isLoading={isLoading}
              activePanelMessageId={activePanel?.messageId ?? null}
              togglePanel={togglePanel}
              user={user}
              handleFollowUpQuestionClick={handleFollowUpQuestionClick}
              hasCanvasData={hasCanvasData}
              isWaitingForToolResults={isWaitingForToolResults}
              messagesEndRef={messagesEndRef}
              searchTerm={searchTerm} // 🚀 FEATURE: Pass search term for highlighting
            />
          </div>
          {activePanel?.messageId && (
            <SidePanel
              activePanel={activePanel}
              messages={messages}
              togglePanel={togglePanel}
              canvasContainerRef={canvasContainerRef}
            />
          )}
        </div>
        
        {/* Desktop Layout */}
        <div className="hidden sm:flex min-h-0 flex-1">
          <div className="flex-1 flex flex-col">
            <div className="overflow-y-auto pb-20 flex-1 scrollbar-minimal" ref={messagesContainerRef}>
              <div className="w-full mx-auto">
                <Messages
                  messages={messages}
                  currentModel={currentModel}
                  isRegenerating={isRegenerating}
                  editingMessageId={editingMessageId}
                  editingContent={editingContent}
                  copiedMessageId={copiedMessageId}
                  onRegenerate={(messageId: string) => handleRegenerate(messageId, messages, setMessages, nextModel, reload, isAgentEnabled, selectedTool)}
                  onCopy={handleCopyMessage}
                  onEditStart={handleEditStart}
                  onEditCancel={handleEditCancel}
                  onEditSave={(messageId: string, files?: globalThis.File[], remainingAttachments?: any[]) => handleEditSave(messageId, nextModel, messages, setMessages, reload, isAgentEnabled, files, remainingAttachments, selectedTool)}
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
                  searchTerm={searchTerm} // 🚀 FEATURE: Pass search term for highlighting
                />
              </div>
            </div>
          </div>
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
      />

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
      />
    </main>
  );
}

interface UnifiedChatInterfaceProps {
  initialChatId?: string;
  initialMessages?: any[];
}

// Main chat interface component
function ChatInterface({ 
  initialChatId, 
  initialMessages = []
}: UnifiedChatInterfaceProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const scrollToMessageId = searchParams.get('scrollToMessage');
  const searchTerm = searchParams.get('search'); // 🚀 FEATURE: Get search term from URL
  const { user, isLoading: authLoading, isAuthenticated, isAnonymous } = useAuth();
  const isDarkMode = useDarkMode();
  // const { isEnabled: isStarryNightEnabled } = useHomeStarryNight();



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
  
  const [currentModel, setCurrentModel] = useState('');
  const [nextModel, setNextModel] = useState('');
  const [input, setInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [rateLimitedLevels, setRateLimitedLevels] = useState<string[]>([]);
  const [isAgentEnabled, setisAgentEnabled] = useState(false);
  const [hasAgentModels, setHasAgentModels] = useState(true);
  const [selectedTool, setSelectedTool] = useState<string | null>(null);


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
      // setChatId(initialChatId); // 이 줄 제거하여 useChat ID 변경 방지
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
    // 🚀 익명 사용자 지원: 익명 사용자를 위한 헤더 추가
    headers: {
      'X-Anonymous-User': user ? 'false' : 'true',
      'X-Anonymous-Id': user ? '' : anonymousId
    }
  }), [user, anonymousId]);

  // ✅ P0 FIX: onFinish 콜백 메모이제이션으로 무한 렌더링 방지
  const onFinish = useCallback(({ message }: { message: any }) => {
    console.log('🎯 [useChat] onFinish called:', {
      messageId: message.id,
      role: message.role,
      chatId: chatId,
      // messagesLength: messages.length, // 🚨 클로저 참조 제거로 안정성 증대
      initialChatId
      // sessionCreated // 🚨 클로저 참조 제거로 안정성 증대
    });
  }, [chatId, initialChatId]);

  // ✅ P0 FIX: onError 콜백 메모이제이션으로 무한 렌더링 방지
  const onError = useCallback((error: Error & { status?: number }) => {
    // Rate limit 처리 등 기존 로직 유지
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
      const modelId = errorData?.model || nextModel;
      const resetTime = new Date(reset);
      const minutesUntilReset = Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 60000));
      
      const rateLimitInfo = RATE_LIMITS[level as keyof typeof RATE_LIMITS] || {
        hourly: { requests: 10, window: '4 h' },
        daily: { requests: 20, window: '24 h' }
      };
      
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
      
      // ✅ 함수형 업데이트 사용으로 setMessages 의존성 제거
      // setMessages는 useChat에서 나올 예정이므로 클로저로 참조하지 않음
      return;
    }

    console.error('🚨 [CHAT_ERROR] Unexpected chat error:', error);
    console.log('🔧 [CHAT_ERROR] Preserving chat state despite error');
  }, [nextModel]); // setMessages, setRateLimitedLevels 의존성 제거

  // useChat hook - simplified like scira
  const {
    messages,
    sendMessage,
    setMessages,
    regenerate,
    status,
    stop,
  } = useChat({
    id: chatId, // 🚀 항상 동일한 chatId 사용하여 useChat 재초기화 방지
    transport, // ✅ 메모이제이션된 transport 사용
    experimental_throttle: 150, // ✅ P0 FIX: AI 응답 속도가 빠를 때 maximum update depth 에러 방지 (50ms → 150ms)
    onFinish, // ✅ 메모이제이션된 콜백 사용
    onError: (error: Error & { status?: number }) => {
      // ✅ 인라인으로 정의하여 setMessages, setRateLimitedLevels에 접근
      onError(error);
      
      // Rate limit 메시지 추가 (onError 콜백 후)
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
        
        // ✅ P0 FIX: 비긴급 업데이트로 처리하여 maximum update depth 예방
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

    // 폴더 확인
    let hasFolder = false;
    for (let i = 0; i < items.length; i++) {
      const entry = items[i].webkitGetAsEntry();
      if (entry?.isDirectory) {
        hasFolder = true;
        break;
      }
    }

    // 폴더가 있으면 에러 표시하고 처리 중단
    if (hasFolder) {
      setGlobalShowFolderError(true);
      setTimeout(() => setGlobalShowFolderError(false), 3000);
      return;
    }

    // 폴더가 없으면 파일 처리 - ChatInput으로 전달
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      // ChatInput의 파일 처리 함수를 호출하기 위해 이벤트를 전달
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) {
        // FileList를 DataTransfer로 변환하여 ChatInput의 handleFiles 함수가 처리할 수 있도록 함
        const dataTransfer = new DataTransfer();
        Array.from(e.dataTransfer.files).forEach(file => {
          dataTransfer.items.add(file);
        });
        fileInput.files = dataTransfer.files;
        
        // change 이벤트 발생시켜 ChatInput의 파일 처리 로직 실행
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
        currentChatId: chatId 
      });
      
      // 현재 스트림이 있다면 중단
      if (status === 'streaming' || status === 'submitted') {
        stop();
      }
      
      // 🚀 새 채팅은 URL 변경으로만 처리, useChat 재초기화 방지
      // 새로운 chatId 생성
      const newChatId = nanoid();
      setChatId(newChatId);
      
      // ✅ P0 FIX: 비긴급 업데이트로 처리하여 새 채팅 생성 시 maximum update depth 예방
      startTransition(() => {
        // 상태 리셋 (setMessages 제외)
        setInput('');
        setIsSubmitting(false);
        setActivePanel(null);
        setUserPanelPreference(null);
        setLastPanelDataMessageId(null);
        setisAgentEnabled(false);
        setSessionCreated(false);
      });
      
      // 🚀 메시지 초기화 제거 - useChat이 자체적으로 관리하도록 함
      // setMessages([]);
      
      console.log('🚀 [NEW_CHAT] New chatId generated:', newChatId, 'Previous messages cleared');
    };

    const handleSubscriptionSuccess = () => {
      console.log('UnifiedChatInterface: Subscription success event received, clearing rate limits...');
      // Rate Limit 즉시 해제
      setRateLimitedLevels([]);
      // localStorage에서도 삭제
      localStorage.removeItem('rateLimitLevels');
      localStorage.removeItem('rateLimitInfo');
    };

    // 커스텀 이벤트 리스너 등록
    window.addEventListener('requestNewChat', handleNewChatRequest);
    window.addEventListener('subscriptionSuccess', handleSubscriptionSuccess);
    
    return () => {
      window.removeEventListener('requestNewChat', handleNewChatRequest);
      window.removeEventListener('subscriptionSuccess', handleSubscriptionSuccess);
    };
  }, [status, stop, setInput, setIsSubmitting, setActivePanel, setUserPanelPreference, setLastPanelDataMessageId, setisAgentEnabled, setSessionCreated]); // setMessages 제거



  // useMessages hook - use the current active chatId instead of initialChatId
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

  // 모델 초기화 - 인증 상태에 따라
  useEffect(() => {
    const initializeModel = async () => {
      try {
        setIsModelLoading(true);
        
        // 🚀 익명 사용자 지원: 로그인하지 않은 사용자도 채팅 사용 가능
        if (!user) {
          // 🚀 익명 사용자가 채팅 URL에 접근한 경우 홈으로 리디렉션
          if (initialChatId) {
            console.log('🚀 Anonymous user accessing chat URL, redirecting to home');
            router.push('/');
            return;
          }
          
          // 익명 사용자는 기본 모델 사용하되, 로컬 선택값이 있으면 우선 사용
          const systemDefault = getSystemDefaultModelId();
          const storedSelected = typeof window !== 'undefined' ? localStorage.getItem('selectedModel') : null;
          const modelToUse = storedSelected || systemDefault;
          setCurrentModel(modelToUse);
          setNextModel(modelToUse);
          
          // 🚀 익명 사용자도 에이전트 모델 사용 가능하도록 설정
          setHasAgentModels(true);
          
          setIsModelLoading(false);
          return;
        }
        
        // 🔧 단순화: 홈에서는 최신 사용 모델을 가져옴
        const { createClient } = await import('@/utils/supabase/client');
        const supabase = createClient();
        
        const { data: latestSession } = await supabase
          .from('chat_sessions')
          .select('current_model')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        
        const storedSelected = typeof window !== 'undefined' ? localStorage.getItem('selectedModel') : null;
        const modelToUse = storedSelected || latestSession?.current_model || getSystemDefaultModelId();
        setCurrentModel(modelToUse);
        setNextModel(modelToUse);
      } catch (error) {
        console.error('사용자 정보 또는 모델 로딩 중 오류:', error);
        const systemDefault = getSystemDefaultModelId();
        const storedSelected = typeof window !== 'undefined' ? localStorage.getItem('selectedModel') : null;
        const modelToUse = storedSelected || systemDefault;
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

  // ✅ P1 FIX: 초기 메시지 하이드레이션 1회 보장으로 무한 렌더링 방지
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current) return;
    if (initialChatId && initialMessages?.length > 0) {
      hydratedRef.current = true;
      setMessages(prev => (prev.length ? prev : initialMessages));
    }
    // 🚀 새 채팅 시 메시지 초기화 제거 - useChat이 자체적으로 관리
  }, [initialChatId, initialMessages, setMessages]); // .length 의존성 제거

  // 새 메시지 제출 처리
  const handleModelSubmit = useCallback(async (e: React.FormEvent, files?: FileList) => {
    e.preventDefault();
    
    const submittedText = ((e as any)?.target?.value ?? input) as string;
    if (isSubmitting || (!submittedText.trim() && !(files && files.length > 0))) return;
    setIsSubmitting(true);
    // 입력은 즉시 비우되, 이미 읽은 submittedText를 사용하여 전송
    setInput('');

    try {
      // 🚀 1. UI 즉시 업데이트 (최우선) - 첫 메시지에서만
      if (!initialChatId && chatId && messages.length === 0) {
        // URL 즉시 변경 (페이지 이동 없음) - 브라우저 히스토리만 변경하여 즉시성 보장
        window.history.pushState(null, '', `/chat/${chatId}`);
        
        // 🚀 사이드바 동기화 - DB와 같은 제목 생성 로직 사용 (첫 메시지에서만)
        const autoTitle = submittedText.trim().length > 30 
          ? submittedText.trim().slice(0, 30) + '...' 
          : submittedText.trim();
          
        window.dispatchEvent(new CustomEvent('newChatCreated', {
          detail: {
            id: chatId,
            title: autoTitle, // 🚀 DB와 동일한 제목 생성 로직
            created_at: new Date().toISOString(),
            current_model: nextModel,
            initial_message: submittedText.trim()
          }
        }));
      }

      // 🚀 2. 파일 업로드 최소화 (필요한 경우만)
      let attachments: Attachment[] = [];
      if (files?.length) {
        try {
          // 익명 사용자 감지를 위한 userId 전달
          const userId = user?.id || 'anonymous';
          const uploadPromises = Array.from(files).map(file => uploadFile(file, userId));
          attachments = await Promise.all(uploadPromises);
        } catch (error) {
          console.warn('File upload failed, proceeding with text-only message');
          attachments = [];
        }
      }

      // 🚀 3. 메시지 parts 구성 (텍스트 + 파일)
      const messageParts: any[] = [];
      
      // 텍스트 부분 추가
      if (submittedText.trim()) {
        messageParts.push({ type: 'text', text: submittedText.trim() });
      }
      
      // 파일 부분 추가
      attachments.forEach((attachment) => {
        if (attachment.contentType?.startsWith('image/')) {
          messageParts.push({
            type: 'image',
            image: attachment.url
          });
        } else {
          messageParts.push({
            type: 'file',
            url: attachment.url,
            mediaType: attachment.contentType || 'application/octet-stream',
            filename: attachment.name || 'file'
          });
        }
      });
      
      // 🚀 4. 즉시 메시지 전송 (세션 생성 대기 없음)
      await sendMessage({
        role: 'user',
        parts: messageParts
      }, {
        body: {
          model: nextModel,
          chatId: chatId,
          saveToDb: true,
          isAgentEnabled,
          selectedTool: selectedTool || null,
          experimental_attachments: attachments // 서버에서 처리용
        },
      });

      // 🚀 5. UI 상태 즉시 업데이트
      setCurrentModel(nextModel);
      try { if (typeof window !== 'undefined') localStorage.setItem('selectedModel', nextModel); } catch {}

      // 🚀 제목 생성 제거 - 사이드바에서 자체 처리하도록 단순화
      // 제목 생성은 불필요한 복잡성과 충돌을 야기하므로 제거
    } catch (error) {
      console.error('Message submission error:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [input, isSubmitting, user, chatId, nextModel, isAgentEnabled, selectedTool, sendMessage, setCurrentModel, setInput, initialChatId, uploadFile]);

  // Suggested prompt 클릭 처리
  const handleSuggestedPromptClick = useCallback(async (prompt: string) => {
    if (isSubmitting) return;
    
    setInput(prompt);
    
    // 🚀 prompt를 직접 사용하여 비동기 상태 업데이트 문제 해결
    const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
    
    // 즉시 제출 (prompt 직접 사용)
    if (prompt.trim()) {
      setIsSubmitting(true);
      
      try {
        // 🚀 도구가 선택된 상태라면 해당 도구 유지, 그렇지 않으면 에이전트 모드 활성화
        const shouldEnableAgent = selectedTool ? true : true; // 항상 에이전트 모드 활성화
        const toolToUse = selectedTool || null; // 현재 선택된 도구 유지
        
        // 도구가 선택된 상태가 아니라면 에이전트 모드만 활성화 (도구 선택은 하지 않음)
        if (!selectedTool) {
          setisAgentEnabled(shouldEnableAgent);
        }
        
        // 🚀 1. UI 즉시 업데이트 (최우선) - 첫 메시지에서만
        if (!initialChatId && chatId && messages.length === 0) {
          // URL 즉시 변경 (페이지 이동 없음) - 브라우저 히스토리만 변경하여 즉시성 보장
          window.history.pushState(null, '', `/chat/${chatId}`);
          
          // 🚀 사이드바 동기화 - DB와 같은 제목 생성 로직 사용 (첫 메시지에서만)
          const autoTitle = prompt.trim().length > 30 
            ? prompt.trim().slice(0, 30) + '...' 
            : prompt.trim();
            
          window.dispatchEvent(new CustomEvent('newChatCreated', {
            detail: {
              id: chatId,
              title: autoTitle, // 🚀 DB와 동일한 제목 생성 로직
              created_at: new Date().toISOString(),
              current_model: nextModel,
              initial_message: prompt.trim()
            }
          }));
        }

        // 🚀 2. 메시지 parts 구성 (텍스트만)
        const messageParts: any[] = [{ type: 'text', text: prompt.trim() }];
        
        // 🚀 3. 즉시 메시지 전송 (선택된 도구 유지)
        await sendMessage({
          role: 'user',
          parts: messageParts
        }, {
          body: {
            model: nextModel,
            chatId: chatId,
            saveToDb: true,
            isAgentEnabled: shouldEnableAgent,
            selectedTool: toolToUse, // 🚀 현재 선택된 도구 유지
          },
        });

        // 🚀 4. UI 상태 즉시 업데이트
        setCurrentModel(nextModel);
        try { if (typeof window !== 'undefined') localStorage.setItem('selectedModel', nextModel); } catch {}
        setInput('');

        // 🚀 제목 생성 제거 - 사이드바에서 자체 처리하도록 단순화
        // 제목 생성은 불필요한 복잡성과 충돌을 야기하므로 제거
      } catch (error) {
        console.error('Message submission error:', error);
      } finally {
        setIsSubmitting(false);
      }
    }
  }, [isSubmitting, user, chatId, nextModel, isAgentEnabled, selectedTool, sendMessage, setCurrentModel, setInput, initialChatId, setisAgentEnabled]);

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
          const tokenUsage = (lastMessage as any).usage || null;
          
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

          setMessages((prevMessages: UIMessage[]) => {
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
  }, [stop, messages, currentModel, initialChatId, user?.id]);

  // Agent 토글 처리
  const handleAgentToggle = (newState: boolean) => {
    if (isChatflixModel(currentModel)) {
      setisAgentEnabled(newState);
      return;
    }
    
    // 🚀 익명 사용자 지원: 익명 사용자도 에이전트 모델 사용 가능
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

    // Follow-up question 처리 - 일반 메시지 전송과 동일한 방식 사용
  const handleFollowUpQuestionClick = async (question: string) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    
    try {
      // 🚀 sendMessage 사용 (reload 대신) - 새로고침 방지
      const messageParts: any[] = [{ type: 'text', text: question.trim() }];
      
      await sendMessage(
        { role: 'user', parts: messageParts }, 
        { 
          body: { 
            model: nextModel,
            chatId: chatId, // 🚀 항상 현재 chatId 사용 (동적으로 업데이트됨)
            isAgentEnabled,
            selectedTool,
            saveToDb: true
          } 
        }
      );

      // 🔧 FIX: Follow-up question 전송 후에만 currentModel 업데이트
      setCurrentModel(nextModel);
    } catch (error) {
      console.error('Error submitting follow-up question:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 패널 토글 - 간단한 열림/닫힘 (전체 화면 모달 방식)
  const togglePanel = (messageId: string, type: 'canvas' | 'structuredResponse' | 'attachment', fileIndex?: number, toolType?: string, fileName?: string) => {
    const isSameOpen = activePanel?.messageId === messageId && activePanel.type === type && activePanel?.fileIndex === fileIndex && activePanel?.toolType === toolType;
    if (isSameOpen) {
      // 닫기: 즉시 상태 해제
      setActivePanel(null);
      setUserPanelPreference(false);
      setIsPanelMaximized(false);
      return;
    }

    // 열기: 상태 설정
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

    return !!(
      hasWebSearchData || 
      getMathCalculationData(message) || 
      getLinkReaderData(message) || 
      getImageGeneratorData(message) || 
      getYouTubeSearchData(message) || 
      getYouTubeLinkAnalysisData(message) || 
      getGoogleSearchData(message) ||
      hasStructuredResponseFiles()
    );
  };

  // 로딩 중인 도구 결과 확인 - 실제 도구 데이터 기반으로 판단
  const isWaitingForToolResults = (message: any) => {
    if (message.role === 'assistant' && isLoading && message.id === messages[messages.length - 1]?.id) {
      // 1. 도구 호출이 시작되었는지 확인 (tool-call parts가 있는지)
      const hasToolCalls = message.parts?.some((part: any) => part.type === 'tool-call');
      
      if (!hasToolCalls) {
        return false; // 도구 호출이 없으면 도구 결과 대기 상태가 아님
      }
      
      // 2. 도구 결과가 완료되었는지 확인
      const hasToolResults = message.parts?.some((part: any) => part.type === 'tool-result');
      
      if (hasToolResults) {
        return false; // 도구 결과가 있으면 대기 상태가 아님
      }
      
      // 3. 텍스트 응답이 시작되었는지 확인
      const hasTextStarted = message.parts?.some((part: any) => 
        part.type === 'text' && (part.text || '').trim().length > 0
      );
      
      if (hasTextStarted) {
        return false; // 텍스트 응답이 시작되었으면 도구 대기 상태가 아님
      }
      
      // 4. 도구 호출은 있지만 결과나 텍스트 응답이 없는 경우 = 도구 결과 대기 중
      return true;
    }
    
    return false;
  };

  // 🔧 FIX: ModelSelector용 모델 변경 핸들러 - API 요청용 모델만 변경
  const handleModelSelectorChange = useCallback((newModel: string) => {
    setNextModel(newModel);
    setCurrentModel(newModel); // UI 표시는 즉시 변경
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('selectedModel', newModel);
      }
    } catch {}
  }, []);

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

  // 🚀 경로 의존도를 줄이고 상태 기반으로 ChatView 표시 - 라우터 불일치 시 빈 화면 방지
  const shouldShowChatView = Boolean(initialChatId) || messages.length > 0;

  if (shouldShowChatView) {
    return (
      <ChatView
        chatId={initialChatId || chatId} // 🚀 첫 메시지에서도 올바른 chatId 전달
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
      />
    );
  }

  // 기본적으로 HomeView 표시 (URL이 홈이고 initialChatId가 없는 경우)
  return (
    <HomeView
      user={user}
      input={input}
      handleInputChange={handleInputChange}
      handleSubmit={handleModelSubmitWithReset}
      isLoading={isLoading || isSubmitting}
      stop={handleStop}
      currentModel={currentModel}
      nextModel={nextModel}
      setNextModel={handleModelSelectorChange}
      rateLimitedLevels={rateLimitedLevels}
      isAgentEnabled={isAgentEnabled}
      setisAgentEnabled={setAgentEnabledHandler}
      hasAgentModels={hasAgentModels}
      setHasAgentModels={setHasAgentModels}
      onSuggestedPromptClick={handleSuggestedPromptClick}
      isDarkMode={isDarkMode}
      // isStarryNightEnabled={isStarryNightEnabled}
      handleModelSelectorChange={handleModelSelectorChange}
      handleGlobalDrag={handleGlobalDrag}
      handleGlobalDragLeave={handleGlobalDragLeave}
      handleGlobalDrop={handleGlobalDrop}
      globalDragActive={globalDragActive}
      selectedTool={selectedTool}
      setSelectedTool={setSelectedTool}
      editingMessageId={editingMessageId}
    />
  );
}

// Main export - simplified without wrapper
export default function UnifiedChatInterface({ 
  initialChatId, 
  initialMessages = [] 
}: UnifiedChatInterfaceProps) {
  return (
    <ChatInterface
      initialChatId={initialChatId}
      initialMessages={initialMessages}
    />
  );
}
