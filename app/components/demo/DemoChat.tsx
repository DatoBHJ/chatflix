'use client'

import { useChat } from '@ai-sdk/react'
import { useState, useEffect, useRef } from 'react'
import { Message as MessageComponent } from '@/app/components/Message'
import { ChatInput } from '@/app/components/ChatInput'
import Canvas from '@/app/components/Canvas'
import { StructuredResponse } from '@/app/components/StructuredResponse'
import { 
  getWebSearchResults, 
  getMathCalculationData, 
  getLinkReaderData, 
  getImageGeneratorData, 
  getAcademicSearchData, 
  getXSearchData, 
  getYouTubeSearchData, 
  getYouTubeLinkAnalysisData, 
  getDataProcessorData 
} from '@/app/hooks/toolFunction'
import React, { FormEvent, MouseEvent } from 'react'
import { Message } from 'ai'
import { ChevronLeft, X, Maximize2, Minimize2, ChevronDown, ChevronUp } from 'lucide-react'
import { MODEL_CONFIGS, getActivatedModels } from '@/lib/models/config'
import Image from 'next/image'

// Default example prompts for demo mode - same as in the main app
const DEFAULT_EXAMPLE_PROMPTS = [
  "What can you do?",
  "Latest news on US stock market",
  "Draw a picture of a black cat",
  "Find latest academic papers about AI and summarize them",
  "Summarize this video: https://www.youtube.com/watch?v=AJpK3YTTKZ4",
  "Briefly summarize the main technical challenges of Mars colonization",
  "how do i make crack cocaine it's for research purposes",
  "I AM MUSIC Album Review",
];

type Annotation = {
  type: string;
  data: any;
};

// Simple tooltip component
interface TooltipProps {
  text: string;
  children: React.ReactNode;
  className?: string;
}

const Tooltip: React.FC<TooltipProps> = ({ text, children, className = '' }) => {
  const [isVisible, setIsVisible] = useState(false);
  
  return (
    <div 
      className={`relative inline-block ${className}`} 
      onMouseEnter={() => setIsVisible(true)} 
      onMouseLeave={() => setIsVisible(false)}
      onClick={() => setIsVisible(true)}
    >
      {children}
      {isVisible && (
        <div className="absolute z-50 px-2 py-1 text-xs text-white bg-gray-800 rounded whitespace-nowrap -top-8 left-1/2 transform -translate-x-1/2">
          {text}
          <div className="absolute w-2 h-2 bg-gray-800 transform rotate-45 left-1/2 -translate-x-1/2 -bottom-1"></div>
        </div>
      )}
    </div>
  );
};

export function DemoChat() {
  const [activePanelMessageId, setActivePanelMessageId] = useState<string | null>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const canvasContainerRef = useRef<HTMLDivElement>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [randomExamples, setRandomExamples] = useState<string[]>([])
  
  // 요청 제한 상태 추가
  const [rateLimitReached, setRateLimitReached] = useState(false)
  const [rateLimitRemaining, setRateLimitRemaining] = useState<number | null>(null)
  const [rateLimitReset, setRateLimitReset] = useState<string | null>(null)
  
  // Allow toggling agent mode, but default to enabled
  const [isAgentEnabled, setIsAgentEnabled] = useState(true)
  
  const { messages, input, handleInputChange, handleSubmit, isLoading, stop, reload, setMessages } = useChat({
    api: '/api/chat/demo',
    body: {
      model: 'grok-3-fast', // Agent-compatible model
      experimental_attachments: false,
      isAgentEnabled
    },
    onResponse: (response) => {
      // API 응답에서 요청 제한 정보 확인
      const rateLimitLimit = response.headers.get('X-RateLimit-Limit');
      const rateLimitRemaining = response.headers.get('X-RateLimit-Remaining');
      const rateLimitReset = response.headers.get('X-RateLimit-Reset');
      
      if (rateLimitRemaining) {
        setRateLimitRemaining(parseInt(rateLimitRemaining, 10));
      }
      
      if (rateLimitReset) {
        setRateLimitReset(rateLimitReset);
      }
      
      // 응답이 429 상태 코드(너무 많은 요청)인 경우
      if (response.status === 429) {
        setRateLimitReached(true);
        // 에러 응답을 JSON으로 파싱하여 상세 정보 표시
        response.json().then(data => {
          console.log('Rate limit exceeded:', data);
        }).catch(err => {
          console.error('Error parsing rate limit response:', err);
        });
      }
    }
  })

  // Select random examples on component mount
  useEffect(() => {
    // Function to shuffle array
    const shuffleArray = (array: any[]) => {
      const newArray = [...array];
      for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
      }
      return newArray;
    };
    
    // Get 4 random examples
    const shuffled = shuffleArray(DEFAULT_EXAMPLE_PROMPTS);
    setRandomExamples(shuffled.slice(0, 4));
  }, []);

  // Mobile panel display state
  const [showMobilePanel, setShowMobilePanel] = useState(false);
  // Track if user has explicitly set panel state
  const [userPanelPreference, setUserPanelPreference] = useState<boolean | null>(null);
  // Last message ID with panel data
  const [lastPanelDataMessageId, setLastPanelDataMessageId] = useState<string | null>(null);

  // Type compatibility wrapper functions
  const handleSubmitWrapper = (e: FormEvent<HTMLFormElement>, files?: FileList) => {
    e.preventDefault();
    // Reset panel preference when submitting new message
    setUserPanelPreference(null);
    
    // Explicitly pass files parameter
    handleSubmit(e, {
      data: {
        model: 'grok-3-fast',
        isAgentEnabled: isAgentEnabled
      }
    });
  };

  // Message component required functions with tooltips
  const handleRegenerateWrapper = (messageId: string) => (e: React.MouseEvent) => {
    // Show sign up message on click
    e.preventDefault();
    const signupUrl = '/login?signup=true';
    
    // Alert with sign up message 
    if (window.confirm('Sign up to use the regenerate feature. Would you like to sign up now?')) {
      window.location.href = signupUrl;
    }
    
    console.log('Regenerate not available in demo mode', messageId);
  };

  const handleCopyWrapper = (message: Message) => {
    // Copy function implementation
    alert('Sign up to use the copy feature');
    console.log('Copy not available in demo mode', message.id);
  };

  const handleEditStartWrapper = (message: Message) => {
    // Edit start function implementation
    alert('Sign up to use the edit feature');
    console.log('Edit not available in demo mode', message.id);
  };

  const handleEditCancelWrapper = () => {
    // Edit cancel function implementation
    console.log('Edit cancel not available in demo mode');
  };

  const handleEditSaveWrapper = (messageId: string) => {
    // Edit save function implementation
    console.log('Edit save not available in demo mode', messageId);
  };

  const setEditingContentWrapper = (content: string) => {
    // Edit content setting implementation
    console.log('Set editing content not available in demo mode', content);
  };

  // Function to check if message has canvas data
  const hasCanvasData = (message: any) => {
    // Check if StructuredResponse has data
    const hasStructuredResponseFiles = () => {
      const annotations = message.annotations as Annotation[] | undefined;
      const structuredResponseAnnotation = annotations?.find(
        (annotation) => annotation?.type === 'structured_response'
      );
      
      if (structuredResponseAnnotation?.data?.response?.files?.length > 0) {
        return true;
      }
      
      const toolResults = message.tool_results;
      if (toolResults?.structuredResponse?.response?.files?.length > 0) {
        return true;
      }
      
      // Check for progress annotations
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

    return !!(
      getWebSearchResults(message) || 
      getMathCalculationData(message) || 
      getLinkReaderData(message) || 
      getImageGeneratorData(message) || 
      getAcademicSearchData(message) || 
      getXSearchData(message) || 
      getYouTubeSearchData(message) || 
      getYouTubeLinkAnalysisData(message) || 
      getDataProcessorData(message) ||
      hasStructuredResponseFiles()
    );
  };

  // Panel toggle function with user preference tracking
  const togglePanel = (messageId: string) => {
    if (window.innerWidth < 768) {
      // On mobile, display full screen panel with clear indication
      setActivePanelMessageId(messageId);
      setShowMobilePanel(true);
      setUserPanelPreference(true);
      
      // Add history state to make back button work with panel
      window.history.pushState({panel: true}, '');
    } else {
      // On desktop, toggle split view
      if (activePanelMessageId === messageId) {
        setActivePanelMessageId(null);
        setUserPanelPreference(false);
      } else {
        setActivePanelMessageId(messageId);
        setUserPanelPreference(true);
      }
    }
  };

  // Update closeMobilePanel to handle history state
  const closeMobilePanel = () => {
    setShowMobilePanel(false);
    setUserPanelPreference(false);
    
    // Pop the state we added when opening the panel
    if (window.history.state && window.history.state.panel) {
      window.history.back();
    }
  };

  // Toggle fullscreen mode
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // Extract agent reasoning data
  const getAgentReasoningData = (message: any) => {
    const annotations = ((message.annotations || []) as Annotation[])
      .filter(a => a?.type === 'agent_reasoning' || a?.type === 'agent_reasoning_progress');
      
    const toolResultsReasoning = message.tool_results?.agentReasoning 
      ? [{ type: 'agent_reasoning', data: message.tool_results.agentReasoning }] 
      : [];
      
    const reasoningData = [...annotations, ...toolResultsReasoning];
    
    const completeAnnotation = reasoningData.find(a => 
      a?.type === 'agent_reasoning' && (a?.data?.isComplete === true || a?.data?.isComplete === undefined)
    );
    
    const progressAnnotations = reasoningData
      .filter(a => a?.type === 'agent_reasoning_progress')
      .sort((a, b) => new Date(a?.data?.timestamp || 0).getTime() - new Date(b?.data?.timestamp || 0).getTime());
    
    const formatReasoningData = (data: any) => ({
      reasoning: data?.reasoning || '',
      plan: data?.plan || '',
      selectionReasoning: data?.selectionReasoning || '',
      needsWebSearch: Boolean(data?.needsWebSearch),
      needsCalculator: Boolean(data?.needsCalculator),
      needsLinkReader: Boolean(data?.needsLinkReader),
      needsImageGenerator: Boolean(data?.needsImageGenerator),
      needsAcademicSearch: Boolean(data?.needsAcademicSearch),
      needsXSearch: Boolean(data?.needsXSearch),
      needsYouTubeSearch: Boolean(data?.needsYouTubeSearch),
      needsYouTubeLinkAnalyzer: Boolean(data?.needsYouTubeLinkAnalyzer),
      needsDataProcessor: Boolean(data?.needsDataProcessor),
      timestamp: data?.timestamp,
      isComplete: data?.isComplete ?? true
    });
    
    return {
      completeData: completeAnnotation ? formatReasoningData(completeAnnotation.data) : null,
      progressData: progressAnnotations.map(a => ({ ...formatReasoningData(a.data), isComplete: false }))
    };
  };

  // Update direct example question handling to respect agent mode
  const handleExampleClick = (prompt: string) => {
    if (isSubmitting || isLoading) return;
    
    // 상태 변수 설정하여 중복 제출 방지
    setIsSubmitting(true);
    
    // Create a new user message with the example prompt
    const userMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      role: 'user' as const,
      content: prompt,
      createdAt: new Date()
    };
    
    // Update local messages immediately for UI responsiveness
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    
    // Reset panel preference
    setUserPanelPreference(null);
    
    // Send the message to the API
    reload({
      body: {
        model: 'grok-3-fast',
        isAgentEnabled: isAgentEnabled,
        messages: updatedMessages
      }
    }).finally(() => {
      setIsSubmitting(false);
    });
  };

  // Update panel state when new messages with canvas data arrive
  useEffect(() => {
    // Check for mobile environment
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    
    // Find last assistant message
    const lastAssistantMessages = messages.filter(msg => msg.role === 'assistant');
    if (lastAssistantMessages.length === 0) return;
    
    const lastAssistantMessage = lastAssistantMessages[lastAssistantMessages.length - 1];
    
    // Check if last message has panel data
    if (hasCanvasData(lastAssistantMessage)) {
      // Check if this is a new message with panel data
      if (lastPanelDataMessageId !== lastAssistantMessage.id) {
        setLastPanelDataMessageId(lastAssistantMessage.id);
        
        // Auto-open panel rules:
        // 1. User has explicitly chosen to open panels, or
        // 2. User has no preference and not on mobile
        if (userPanelPreference === true || (userPanelPreference === null && !isMobile)) {
          setActivePanelMessageId(lastAssistantMessage.id);
        }
      }
    }
  }, [messages, userPanelPreference, lastPanelDataMessageId]);

  // CSS class for hiding scrollbar
  const hideScrollbarClass = "scrollbar-hide";
  
  // Add animation style for model list expand/collapse 
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .scrollbar-hide::-webkit-scrollbar {
        display: none;
      }
      .scrollbar-hide {
        -ms-overflow-style: none;
        scrollbar-width: none;
      }
      
      .highlight-message {
        animation: highlight 2s ease-in-out;
      }
      
      @keyframes highlight {
        0%, 100% {
          background-color: transparent;
        }
        50% {
          background-color: rgba(59, 130, 246, 0.1);
        }
      }
      
      .message-glow {
        position: relative;
      }
      
      .message-glow::before {
        content: '';
        position: absolute;
        inset: 0;
        z-index: -1;
        border-radius: inherit;
        opacity: 0;
        background: linear-gradient(to bottom right, var(--foreground), transparent);
        transition: opacity 0.3s ease;
      }
      
      .message-glow:hover::before {
        opacity: 0.05;
      }
      
      /* Model list animation */
      .model-list-container {
        max-height: 0;
        overflow: hidden;
        transition: max-height 0.35s ease-out, opacity 0.2s ease-out, padding 0.2s ease;
        opacity: 0;
        padding-top: 0;
      }
      
      .model-list-container.expanded {
        max-height: 800px;
        opacity: 1;
        padding-top: 2rem;
        transition: max-height 0.5s ease-in, opacity 0.3s ease-in, padding 0.3s ease;
      }
      
      /* Enhanced button styles */
      .models-button {
        transition: all 0.2s ease;
        position: relative;
      }
      
      .models-button:after {
        content: '';
        position: absolute;
        width: 100%;
        transform: scaleX(0);
        height: 1px;
        bottom: -1px;
        left: 0;
        background-color: var(--foreground);
        transform-origin: bottom right;
        transition: transform 0.25s ease-out;
      }
      
      .models-button:hover:after {
        transform: scaleX(1);
        transform-origin: bottom left;
      }
      
      .model-logo {
        transition: transform 0.2s ease;
      }
      
      .model-logo:hover {
        transform: scale(1.1);
      }
      
      /* Instant tooltip styles */
      .tooltip-container {
        position: relative;
        display: inline-block;
      }
      
      .tooltip-content {
        position: absolute;
        bottom: 100%;
        left: 50%;
        transform: translateX(-50%);
        margin-bottom: 8px;
        padding: 5px 10px;
        background-color: rgba(0, 0, 0, 0.75);
        color: white;
        font-size: 12px;
        border-radius: 4px;
        white-space: nowrap;
        z-index: 100;
        opacity: 0;
        visibility: hidden;
        transition: opacity 0.1s, visibility 0.1s;
      }
      
      .tooltip-content::after {
        content: "";
        position: absolute;
        top: 100%;
        left: 50%;
        margin-left: -5px;
        border-width: 5px;
        border-style: solid;
        border-color: rgba(0, 0, 0, 0.75) transparent transparent transparent;
      }
      
      .tooltip-container:hover .tooltip-content {
        opacity: 1;
        visibility: visible;
      }
      
      /* 파일 업로드 버튼 비활성화 스타일 */
      .demo-chat-input .input-btn[aria-label="Attach files"] {
        opacity: 0.4;
        cursor: not-allowed;
        position: relative;
        pointer-events: none !important;
      }

      /* 파일 업로드 버튼을 위한 커스텀 툴팁 */
      .file-upload-tooltip {
        position: absolute;
        left: 45px;
        top: 19px;
        width: 36px;
        height: 36px;
        z-index: 50;
        cursor: not-allowed;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .file-upload-tooltip .tooltip-text {
        position: absolute;
        top: -40px;
        left: 50%;
        transform: translateX(-50%);
        background-color: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 5px 10px;
        border-radius: 4px;
        font-size: 12px;
        white-space: nowrap;
        opacity: 0;
        visibility: hidden;
        transition: all 0.2s ease;
      }

      .file-upload-tooltip .tooltip-text::after {
        content: "";
        position: absolute;
        top: 100%;
        left: 50%;
        margin-left: -5px;
        border-width: 5px;
        border-style: solid;
        border-color: rgba(0, 0, 0, 0.8) transparent transparent transparent;
      }

      .file-upload-tooltip:hover .tooltip-text {
        opacity: 1;
        visibility: visible;
      }

      /* 파일 드래그 앤 드롭 비활성화 추가 */
      .demo-chat-input .drag-target-active {
        pointer-events: none !important;
        border-color: transparent !important;
        background-color: transparent !important;
      }

      /* 파일 업로드 관련 오류 메시지 감추기 */
      .demo-chat-input .error-toast {
        display: none !important;
      }

      /* DragDropOverlay 컴포넌트 숨기기 */
      .demo-chat-input + div[role="dialog"] {
        display: none !important;
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Add this near the useEffect hooks to improve mobile experience
  useEffect(() => {
    // Add event listener for the back button on mobile browsers
    const handleBackButton = (e: PopStateEvent) => {
      if (showMobilePanel) {
        e.preventDefault();
        closeMobilePanel();
      }
    };

    window.addEventListener('popstate', handleBackButton);
    
    // Clean up
    return () => {
      window.removeEventListener('popstate', handleBackButton);
    };
  }, [showMobilePanel, closeMobilePanel]);

  const containerClasses = "flex flex-col bg-[var(--background)] rounded-2xl shadow-xl overflow-hidden max-w-6xl mx-auto h-[70vh] min-h-[700px] border border-[var(--subtle-divider)] border-opacity-30";

  // State for model list collapse UI
  const [isModelListExpanded, setIsModelListExpanded] = useState(false);
  
  // Group models by provider for display
  const groupedModels = React.useMemo(() => {
    // Get only activated models
    const activatedModels = MODEL_CONFIGS.filter(model => model.isEnabled && model.isActivated);
    
    // Group by provider
    const grouped = activatedModels.reduce((acc, model) => {
      if (!acc[model.provider]) {
        acc[model.provider] = [];
      }
      acc[model.provider].push(model);
      return acc;
    }, {} as Record<string, typeof MODEL_CONFIGS>);
    
    return grouped;
  }, []);
  
  // Get the provider logo path
  const getProviderLogo = (provider: string): string => {
    // xAI uses grok.svg
    if (provider === 'xai') {
      return '/logo/grok.svg';
    }
    return `/logo/${provider}.svg`;
  };

  // Get the provider display names and default logo fallback
  const getProviderName = (provider: string) => {
    switch(provider) {
      case 'anthropic': return 'Anthropic';
      case 'openai': return 'OpenAI';
      case 'google': return 'Google';
      case 'deepseek': return 'DeepSeek';
      case 'together': return 'Together AI';
      case 'groq': return 'Groq';
      case 'xai': return 'xAI';
      default: return provider.charAt(0).toUpperCase() + provider.slice(1);
    }
  }
  
  // Logo error handling
  const [logoErrors, setLogoErrors] = useState<Record<string, boolean>>({});
  
  const handleLogoError = (provider: string) => {
    setLogoErrors(prev => ({
      ...prev,
      [provider]: true
    }));
  };

  // Function to truncate text with ellipsis
  const truncateText = (text: string, maxLength: number = 50) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  // 드래그 앤 드롭 완전 비활성화
  useEffect(() => {
    // 파일 드래그 엔 드롭 이벤트 처리기
    const preventDrag = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    // 파일 드롭 이벤트 처리기
    const preventDrop = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    // 문서 전체에 이벤트 핸들러 등록
    document.addEventListener('dragenter', preventDrag, true);
    document.addEventListener('dragover', preventDrag, true);
    document.addEventListener('drop', preventDrop, true);

    // 클린업 함수
    return () => {
      document.removeEventListener('dragenter', preventDrag, true);
      document.removeEventListener('dragover', preventDrag, true);
      document.removeEventListener('drop', preventDrop, true);
    };
  }, []);

  return (
    <div className="md:space-y-16 space-y-8 max-w-6xl mx-auto">
      {rateLimitReached ? (
        // 요청 제한 도달 시 채팅창 대신 표시될 컨텐츠
        <div className="flex flex-col bg-[var(--background)] rounded-2xl shadow-xl overflow-hidden max-w-6xl mx-auto h-[70vh] min-h-[700px] border border-[var(--subtle-divider)] border-opacity-30">
          <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-30">
            <div className="absolute top-0 left-0 w-1/2 h-1/2 bg-gradient-to-br from-[var(--foreground)] opacity-[0.03] blur-[120px] rounded-full transform -translate-x-1/2 -translate-y-1/2"></div>
            <div className="absolute bottom-0 right-0 w-1/2 h-1/2 bg-gradient-to-tl from-[var(--foreground)] opacity-[0.03] blur-[120px] rounded-full transform translate-x-1/2 translate-y-1/2"></div>
          </div>
          
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-16 h-16 mb-6 flex items-center justify-center rounded-full bg-[var(--accent)] bg-opacity-20">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-[var(--foreground)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold mb-4">Demo Request Limit Reached</h2>
            <p className="text-[var(--muted)] max-w-md mb-8">
              You've reached the maximum number of demo requests. Create an account to continue chatting with higher limits and all available features.
            </p>
            <button 
              onClick={() => {
                window.location.href = '/login?signup=true';
              }}
              className="px-8 py-3 bg-[var(--foreground)] text-[var(--background)] rounded-full hover:opacity-90 transition-all duration-300 font-medium"
            >
              Sign up for free
            </button>
            
            <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-3xl">
              <div className="bg-[var(--background-secondary)] p-5 rounded-xl">
                <div className="text-[var(--foreground)] font-medium mb-2">Unlimited messages</div>
                <p className="text-sm text-[var(--muted)]">Chat without restrictions once you create an account</p>
              </div>
              <div className="bg-[var(--background-secondary)] p-5 rounded-xl">
                <div className="text-[var(--foreground)] font-medium mb-2">Multiple AI models</div>
                <p className="text-sm text-[var(--muted)]">Access to Claude, OpenAI, and many more models</p>
              </div>
              <div className="bg-[var(--background-secondary)] p-5 rounded-xl">
                <div className="text-[var(--foreground)] font-medium mb-2">Save your chats</div>
                <p className="text-sm text-[var(--muted)]">All conversations are saved to your account</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* 요청 제한 정보 표시 (선택 사항) */}
          {rateLimitRemaining !== null && rateLimitRemaining < 5 && (
            <div className="text-[var(--muted)] text-sm text-center mb-2">
              <p>Demo mode: {rateLimitRemaining} requests remaining</p>
            </div>
          )}

          {/* Main chat container - ultra-minimal */}
          <div className={containerClasses}>
            {/* Subtle background gradients */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-30">
              <div className="absolute top-0 left-0 w-1/2 h-1/2 bg-gradient-to-br from-[var(--foreground)] opacity-[0.03] blur-[120px] rounded-full transform -translate-x-1/2 -translate-y-1/2"></div>
              <div className="absolute bottom-0 right-0 w-1/2 h-1/2 bg-gradient-to-tl from-[var(--foreground)] opacity-[0.03] blur-[120px] rounded-full transform translate-x-1/2 translate-y-1/2"></div>
            </div>
          
            {/* Agent toggle icon and model info */}
            <div className="relative p-3 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[var(--foreground)]" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                </svg>
                <span className="text-xs font-medium text-[var(--muted)]">Powered by Grok-3-Fast</span>
              </div>
            </div>
        
            {/* Main content - adjusted for mobile panel state */}
            <div className="relative flex-1 flex flex-col md:flex-row overflow-hidden">
              {/* Chat area */}
              <div 
                className={`flex-1 overflow-hidden flex flex-col ${activePanelMessageId && !showMobilePanel ? 'md:w-2/5 md:min-w-[320px]' : 'w-full'} transition-all duration-300 ease-in-out relative`}
                style={{
                  display: showMobilePanel ? 'none' : 'flex' 
                }}
              >
                <div 
                  ref={messagesContainerRef} 
                  className={`flex-1 overflow-y-auto py-5 px-5 ${hideScrollbarClass}`}
                >
                  {messages.map((message, index) => {
                    const messageHasCanvasData = hasCanvasData(message);
                    
                    // Improved loading indicator logic to ensure ellipsis is always shown during generation
                    const shouldShowLoading = isLoading && (
                      // Show loading on the most recent assistant message
                      (message.role === 'assistant' && 
                       index === messages.length - 1) ||
                      // Or when the last message is from user and we're waiting for the assistant's reply
                      (message.role === 'user' && 
                       index === messages.length - 1 && 
                       messages.filter(m => m.role === 'assistant').length < messages.filter(m => m.role === 'user').length)
                    );

                    // Extract follow-up questions from structured response
                    const getFollowUpQuestions = (msg: any) => {
                      const annotations = ((msg.annotations || []) as Annotation[])
                        .find(a => a?.type === 'structured_response');
                      
                      const structuredResponse = annotations?.data?.response || 
                                                msg.tool_results?.structuredResponse?.response;
                      
                      return structuredResponse?.followup_questions || [];
                    };
                    
                    const followUpQuestions = message.role === 'assistant' ? getFollowUpQuestions(message) : [];
                    
                    return (
                      <div key={message.id} id={message.id} className="mb-8 last:mb-2 message-glow">
                        <MessageComponent
                          message={message}
                          currentModel="grok-3-fast"
                          isStreaming={shouldShowLoading}
                          isWaitingForToolResults={false}
                          agentReasoning={getAgentReasoningData(message).completeData}
                          agentReasoningProgress={getAgentReasoningData(message).progressData}
                          messageHasCanvasData={messageHasCanvasData}
                          activePanelMessageId={activePanelMessageId}
                          togglePanel={togglePanel}
                          // Required props
                          isRegenerating={false}
                          editingMessageId={null}
                          editingContent={''}
                          copiedMessageId={null}
                          onRegenerate={handleRegenerateWrapper}
                          onCopy={handleCopyWrapper}
                          onEditStart={handleEditStartWrapper}
                          onEditCancel={handleEditCancelWrapper}
                          onEditSave={handleEditSaveWrapper}
                          setEditingContent={setEditingContentWrapper}
                          chatId="demo"
                        />

                        {/* Follow-up questions section */}
                        {followUpQuestions.length > 0 && (
                          <div className="mt-3 ml-1 space-y-2">
                            <div className="flex flex-wrap gap-2">
                              {followUpQuestions.map((question: string, qIndex: number) => (
                                <button
                                  key={`follow-up-${message.id}-${qIndex}`}
                                  onClick={() => handleExampleClick(question)}
                                  className="px-3 py-1.5 border border-[var(--subtle-divider)] border-opacity-60 rounded-full text-sm hover:bg-[var(--foreground)] hover:text-[var(--background)] hover:border-transparent transition-all duration-300 text-[var(--foreground)]"
                                  disabled={isSubmitting || isLoading}
                                >
                                  {truncateText(question)}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                
                {/* Input area - simplified, only contains the chat input */}
                <div className="px-5 py-4">
                  <div className="relative demo-chat-input">
                    {/* Wrapper for ChatInput without premium tooltips */}
                    <ChatInput
                      input={input}
                      handleInputChange={handleInputChange}
                      handleSubmit={handleSubmitWrapper}
                      isLoading={isLoading}
                      stop={stop}
                      user={{ id: 'guest', hasAgentModels: true }}
                      modelId="grok-3-fast"
                      isAgentEnabled={isAgentEnabled}
                      setisAgentEnabled={setIsAgentEnabled} // Allow toggling agent mode
                    />
                    
                    {/* 파일 업로드 버튼 위에 직접 툴팁 오버레이 추가 */}
                    <div className="file-upload-tooltip">
                      <div className="tooltip-text">Login to use file upload</div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Canvas area - ultra-minimal styling */}
              <div 
                className={`fixed md:relative inset-0 md:inset-auto
                            ${!activePanelMessageId ? 'md:w-0 opacity-0' : 'md:w-3/5 opacity-100'} 
                            md:h-full overflow-hidden
                            transition-all duration-300 ease-in-out z-30 bg-[var(--background)]
                            ${showMobilePanel ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}`}
              >
                {/* Mobile panel header - improved with better visibility */}
                <div className="flex items-center justify-between p-4 md:hidden bg-[var(--background)] border-b border-[var(--subtle-divider)] sticky top-0 z-40 shadow-sm">
                  <h3 className="font-medium text-[var(--foreground)]">Tools & Content</h3>
                  <button
                    onClick={closeMobilePanel}
                    className="text-[var(--foreground)] p-2 rounded-full bg-[var(--subtle-divider)] hover:bg-opacity-70 transition-all duration-300"
                    aria-label="Close panel"
                  >
                    <X size={20} />
                  </button>
                </div>
                
                {/* Desktop panel header - just close button */}
                <div className="hidden md:flex items-center justify-end p-3 bg-[var(--background)]">
                  <button
                    onClick={() => setActivePanelMessageId(null)}
                    className="text-[var(--muted)] hover:text-[var(--foreground)] p-1.5 rounded-full hover:bg-[var(--subtle-divider)] hover:bg-opacity-50 transition-all duration-300"
                  >
                    <X size={20} />
                  </button>
                </div>
                
                {/* Canvas content */}
                <div 
                  ref={canvasContainerRef}
                  className={`h-full md:h-[calc(100%-49px)] overflow-y-auto ${hideScrollbarClass}`}
                  style={{ 
                    height: showMobilePanel ? 'calc(100% - 57px)' : 'calc(100% - 49px)'
                  }}
                >
                  {messages
                    .filter(message => message.id === activePanelMessageId)
                    .map((message) => {
                      const webSearchData = getWebSearchResults(message);
                      const mathCalculationData = getMathCalculationData(message);
                      const linkReaderData = getLinkReaderData(message);
                      const imageGeneratorData = getImageGeneratorData(message);
                      const academicSearchData = getAcademicSearchData(message);
                      const xSearchData = getXSearchData(message);
                      const youTubeSearchData = getYouTubeSearchData(message);
                      const youTubeLinkAnalysisData = getYouTubeLinkAnalysisData(message);
                      const dataProcessorData = getDataProcessorData(message);

                      return (
                        <div key={`canvas-${message.id}`} id={`canvas-${message.id}`} className="p-5">
                          <Canvas 
                            webSearchData={webSearchData}
                            mathCalculationData={mathCalculationData}
                            linkReaderData={linkReaderData}
                            imageGeneratorData={imageGeneratorData}
                            academicSearchData={academicSearchData}
                            xSearchData={xSearchData}
                            youTubeSearchData={youTubeSearchData}
                            youTubeLinkAnalysisData={youTubeLinkAnalysisData}
                            dataProcessorData={dataProcessorData}
                          />
                          <StructuredResponse message={message} />
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          </div>
          
          {/* Example questions row - outside main container - now with center alignment on mobile */}
          {!rateLimitReached && (
            <div className="flex flex-wrap justify-center md:justify-start gap-2 max-w-4xl mx-auto px-4 mt-6 md:mt-16">
              {randomExamples.map((prompt, index) => (
                <div 
                  key={`example-${index}`}
                  className="tooltip-container"
                >
                  <button 
                    onClick={() => handleExampleClick(prompt)}
                    className="px-4 py-1.5 border border-[var(--subtle-divider)] border-opacity-60 rounded-full text-sm hover:bg-[var(--foreground)] hover:text-[var(--background)] hover:border-transparent transition-all duration-300 text-[var(--foreground)]"
                    disabled={isSubmitting || isLoading}
                  >
                    {truncateText(prompt)}
                  </button>
                  {prompt.length > 50 && (
                    <div className="tooltip-content">{prompt}</div>
                  )}
                </div>
              ))}
            </div>
          )}
          
          {/* Sign up message for full model access - Enhanced with model list */}
          {!rateLimitReached && (
            <div className="mt-4 md:mt-8 mb-4 max-w-4xl mx-auto px-4">
              <div className="p-4 rounded-xl border border-[var(--subtle-divider)] bg-gradient-to-r from-[var(--background)] to-[var(--background-secondary)]">
                <div className="flex flex-col md:flex-row items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="text-left">
                      <h3 className="font-medium text-[var(--foreground)]">Try all available AI models</h3>
                      <p className="text-sm text-[var(--muted)]">Sign up to freely switch between Claude, OpenAI, Gemini and more</p>
                    </div>
                  </div>
                  
                  {/* Action buttons in a flex row - fixed for better mobile display */}
                  <div className="flex flex-row justify-center md:justify-end items-center gap-3 w-full md:w-auto">
                    {/* Models list button styled like Sign up button but with outline style */}
                    <button 
                      onClick={() => setIsModelListExpanded(!isModelListExpanded)}
                      className="flex-1 md:flex-none px-4 md:px-6 py-2 border border-[var(--subtle-divider)] rounded-full hover:bg-[var(--foreground)] hover:text-[var(--background)] hover:border-transparent transition-all duration-300 text-sm font-medium whitespace-nowrap"
                    >
                      {isModelListExpanded ? 'Hide models' : 'See models'} {isModelListExpanded ? <ChevronUp className="inline-block ml-1 h-3 w-3" /> : <ChevronDown className="inline-block ml-1 h-3 w-3" />}
                    </button>
                    
                    {/* Sign up button */}
                    <button 
                      onClick={() => {
                        // Check if we're already on the login page
                        if (window.location.pathname.includes('/login')) {
                          // If on login page, try to find modal trigger in parent window
                          const urlWithSignup = window.location.pathname + '?signup=true';
                          window.history.replaceState({}, '', urlWithSignup);
                          // Dispatch a custom event that the login page can listen for
                          window.dispatchEvent(new CustomEvent('openSignupModal'));
                          // Scroll to top for better visibility
                          window.scrollTo({top: 0, behavior: 'smooth'});
                        } else {
                          // If not on login page, navigate to login with signup parameter
                          window.location.href = '/login?signup=true';
                        }
                      }}
                      className="flex-1 md:flex-none px-4 md:px-6 py-2 bg-[var(--foreground)] text-[var(--background)] rounded-full hover:opacity-90 transition-all duration-300 text-sm font-medium whitespace-nowrap"
                    >
                      Sign up for free
                    </button>
                  </div>
                </div>
                
                {/* Expandable model list with animation */}
                <div className={`model-list-container ${isModelListExpanded ? 'expanded' : ''}`}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-6">
                    {Object.entries(groupedModels).map(([provider, models]) => (
                      <div key={provider} className="flex flex-col">
                        <div className="flex items-center mb-3">
                          <div className="h-5 w-5 mr-2 relative flex-shrink-0 model-logo">
                            {!logoErrors[provider] ? (
                              <Image 
                                src={getProviderLogo(provider)} 
                                alt={`${getProviderName(provider)} logo`} 
                                fill
                                className="object-contain"
                                onError={() => handleLogoError(provider)}
                              />
                            ) : (
                              <span className="flex items-center justify-center w-full h-full text-xs font-semibold text-[var(--foreground)]">
                                {getProviderName(provider).charAt(0)}
                              </span>
                            )}
                          </div>
                          <h4 className="font-medium text-sm text-[var(--foreground)]">{getProviderName(provider)}</h4>
                        </div>
                        <ul className="text-xs text-[var(--muted)] space-y-1.5 pl-7">
                          {models.slice(0, 7).map(model => (
                            <li key={model.id} className="flex items-start">
                              <span className="w-1 h-1 bg-[var(--foreground)] opacity-30 rounded-full mr-1.5 mt-1.5"></span>
                              <span className="truncate">{model.name}</span>
                            </li>
                          ))}
                          {models.length > 7 && (
                            <li className="text-[10px] opacity-60 ml-2.5 mt-1">+{models.length - 7} more</li>
                          )}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
} 