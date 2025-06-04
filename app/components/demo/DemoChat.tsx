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
} from '@/app/hooks/toolFunction'
import React, { FormEvent, MouseEvent } from 'react'
import { Message } from 'ai'
import { ChevronLeft, X, Maximize2, Minimize2, ChevronDown, ChevronUp } from 'lucide-react'
import { MODEL_CONFIGS, getActivatedModels } from '@/lib/models/config'
import Image from 'next/image'
import { FollowUpQuestions } from '@/app/components/FollowUpQuestions'

// Default example prompts for demo mode - same as in the main app
const DEFAULT_EXAMPLE_PROMPTS = [
  "Draw a Catwoman",
  "I AM MUSIC Album Review",
  "Summarize this PDF: https://www.nasa.gov/wp-content/uploads/2023/01/55583main_vision_space_exploration2.pdf",
  "Summarize this link: https://www.numeroberlin.de/2023/11/numero-berlin-zukunft-x-playboi-carti/",
  "Summarize this video: https://youtu.be/rHO6TiPLHqw?si=EeNnPSQqUCHRFkCC",
  "Latest US stock market news in the style of a bedtime story.",
  "Find scientific reasons why cats ignore humans.",
  "Research why programmers are obsessed with dark mode.",
  "Explain why people love horror movies using psychological theories",
  "List the top 5 weirdest trends in AI right now.",
  "Calculate how much coffee a developer needs to finish a project in 3 days.",
  "Explain the stock market crash of 2008 in the style of a rap battle.",
  "Research the psychological effects of drug use on creativity.",
  "List the most controversial moments in hip-hop history.",
  "Analyze the impact of Elon Musk's tweets on cryptocurrency markets.",
  "Summarize the most popular 9/11 conspiracy theories",
  "What's the latest on the Mars mission?",
  "What’s the wildest thing Kanye did this year?",
  "Is Threads still a thing or did everyone go back to X?",
  "Describe the Mandela Effect and give the most famous examples.",
  "Summarize the Kanye West and Taylor Swift feud as a Shakespearean drama.",
  "Why do people think the earth is flat?",
  "Explain the movie Tenet like I'm 5",
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
  const [activePanel, setActivePanel] = useState<{ messageId: string; type: 'canvas' | 'structuredResponse' } | null>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const canvasContainerRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // 요청 제한 상태 추가
  const [rateLimitReached, setRateLimitReached] = useState(false)
  const [rateLimitRemaining, setRateLimitRemaining] = useState<number | null>(null)
  const [rateLimitReset, setRateLimitReset] = useState<string | null>(null)
  
  // Allow toggling agent mode, but default to enabled
  const [isAgentEnabled, setIsAgentEnabled] = useState(true)
  
  const { messages, input, handleInputChange, handleSubmit, isLoading, stop, reload, setMessages } = useChat({
    api: '/api/chat/demo',
    body: {
      model: 'gpt-4.1', // Agent-compatible model
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

  // Mobile panel display state 제거 (activePanel로 통합)
  // const [showMobilePanel, setShowMobilePanel] = useState(false);
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
        model: 'gpt-4.1',
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
    const hasStructuredResponseFiles = () => {
      const annotations = message.annotations as Annotation[] | undefined;
      const structuredResponseAnnotation = annotations?.find(
        (annotation) => annotation?.type === 'structured_response'
      );
      if (structuredResponseAnnotation?.data?.response?.files?.length > 0) return true;
      const toolResults = message.tool_results;
      if (toolResults?.structuredResponse?.response?.files?.length > 0) return true;
      const progressAnnotations = annotations?.filter(
        (annotation) => annotation?.type === 'structured_response_progress'
      );
      if (progressAnnotations && progressAnnotations.length > 0) {
        const latestProgress = progressAnnotations[progressAnnotations.length - 1];
        if (latestProgress?.data?.response?.files?.length > 0) return true;
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
      getAcademicSearchData(message) ||
      getXSearchData(message) ||
      getYouTubeSearchData(message) ||
      getYouTubeLinkAnalysisData(message) ||
      hasStructuredResponseFiles()
    );
  };

  // Panel toggle function with user preference tracking
  const togglePanel = (messageId: string, type: 'canvas' | 'structuredResponse') => {
    if (activePanel?.messageId === messageId && activePanel?.type === type) {
      setActivePanel(null);
      setUserPanelPreference(false);
    } else {
      setActivePanel({ messageId, type });
      setUserPanelPreference(true);
    }
  };

  // Update closeMobilePanel to handle history state - activePanel을 사용하도록 수정 또는 제거
  const closePanel = () => { // closeMobilePanel -> closePanel 이름 변경 및 로직 간소화
    setActivePanel(null);
    setUserPanelPreference(false);
    // 데모에서는 window.history 조작 제거
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
        model: 'gpt-4.1',
        isAgentEnabled: isAgentEnabled,
        messages: updatedMessages
      }
    }).finally(() => {
      setIsSubmitting(false);
    });
  };

  // Update panel state when new messages with canvas data arrive
  useEffect(() => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
    const lastAssistantMessages = messages.filter(msg => msg.role === 'assistant');
    if (lastAssistantMessages.length === 0) return;
    const lastAssistantMessage = lastAssistantMessages[lastAssistantMessages.length - 1];
    if (hasCanvasData(lastAssistantMessage)) {
      if (lastPanelDataMessageId !== lastAssistantMessage.id) {
        setLastPanelDataMessageId(lastAssistantMessage.id);
        if (userPanelPreference === true) {
          togglePanel(lastAssistantMessage.id, 'canvas');
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
        border-top: 0px solid var(--subtle-divider);
      }
      
      .model-list-container.expanded {
        max-height: 800px;
        opacity: 1;
        padding-top: 1.5rem;
        padding-bottom: 0.5rem;
        border-top: 1px solid var(--subtle-divider);
        margin-top: 1rem;
        transition: max-height 0.5s ease-in, opacity 0.3s ease-in, padding 0.3s ease, border-top 0.3s ease;
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
      
      /* 파일 업로드 버튼 비활성화 스타일 */
      .demo-chat-input .input-btn[aria-label="Attach files"] {
        opacity: 0.4;
        cursor: not-allowed;
        position: relative;
        pointer-events: none !important;
      }

      /* 파일 업로드 버튼을 위한 커스텀 툴크 */
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

  // Add this near the useEffect hooks to improve mobile experience - activePanel 기준으로 수정 또는 제거
  useEffect(() => {
    const handleBackButton = (e: PopStateEvent) => {
      if (activePanel) { // showMobilePanel -> activePanel
        e.preventDefault();
        closePanel(); // closeMobilePanel -> closePanel
      }
    };

    window.addEventListener('popstate', handleBackButton);
    
    return () => {
      window.removeEventListener('popstate', handleBackButton);
    };
  }, [activePanel, closePanel]); // showMobilePanel -> activePanel

  const containerClasses = "flex flex-col bg-[var(--background)] rounded-2xl shadow-xl overflow-hidden max-w-6xl mx-auto h-[70vh] min-h-[400px] border border-[var(--subtle-divider)] border-opacity-30";

  // State for model list collapse UI
  const [isModelListExpanded, setIsModelListExpanded] = useState(false)
  
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

  // 예시 프롬프트 상태 (SuggestedPrompt.tsx와 동일한 방식)
  const [suggestedPrompt, setSuggestedPrompt] = useState<string | null>(null);
  const [isPromptLoading, setIsPromptLoading] = useState(true);
  const [isPromptVisible, setIsPromptVisible] = useState(false);

  useEffect(() => {
    const showRandomPrompt = () => {
      setIsPromptVisible(false);
      setTimeout(() => {
        setIsPromptLoading(true);
        const randomIndex = Math.floor(Math.random() * DEFAULT_EXAMPLE_PROMPTS.length);
        setSuggestedPrompt(DEFAULT_EXAMPLE_PROMPTS[randomIndex]);
        setTimeout(() => {
          setIsPromptLoading(false);
          setTimeout(() => {
            setIsPromptVisible(true);
          }, 100);
        }, 200);
      }, 300);
    };
    showRandomPrompt();
    const intervalId = setInterval(showRandomPrompt, 3000);
    return () => {
      clearInterval(intervalId);
      setIsPromptVisible(false);
      setIsPromptLoading(true);
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
                <div className="text-[var(--foreground)] font-medium mb-2">Personalized Memory</div>
                <p className="text-sm text-[var(--muted)]">Unlock an AI that remembers your preferences and conversation history.</p>
              </div>
              <div className="bg-[var(--background-secondary)] p-5 rounded-xl">
                <div className="text-[var(--foreground)] font-medium mb-2">Full Tool Access</div>
                <p className="text-sm text-[var(--muted)]">Gain agent mode, file uploads, and the complete suite of powerful tools.</p>
              </div>
              <div className="bg-[var(--background-secondary)] p-5 rounded-xl">
                <div className="text-[var(--foreground)] font-medium mb-2">Saved Conversations</div>
                <p className="text-sm text-[var(--muted)]">All chats are saved to your account for seamless recall and reference.</p>
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
                <span className="text-xs font-medium text-[var(--muted)]">Demo - Powered by GPT-4.1</span>
              </div>
            </div>
        
            {/* Main content - adjusted for mobile panel state -> 실제 페이지 구조 참고하여 수정 */}
            <div className="relative flex-1 flex flex-col md:flex-row overflow-hidden h-full"> {/* h-full 추가 */}
              {/* Chat area */}
              <div 
                className={`flex-1 overflow-hidden flex flex-col transition-all duration-300 ease-in-out relative
                            ${activePanel?.messageId ? 'md:w-1/3' : 'w-full'}`} // 패널 활성 시 md 이상에서 너비 1/3로 수정
              >
                <div 
                  ref={messagesContainerRef} 
                  className={`flex-1 overflow-y-auto py-5 px-5 ${hideScrollbarClass}`}
                >
                  {messages.map((message, index) => {
                    const messageHasCanvasData = hasCanvasData(message);
                    const webSearchData = getWebSearchResults(message);
                    const mathCalculationData = getMathCalculationData(message);
                    const linkReaderData = getLinkReaderData(message);
                    const imageGeneratorData = getImageGeneratorData(message);
                    const academicSearchData = getAcademicSearchData(message);
                    const xSearchData = getXSearchData(message);
                    const youTubeSearchData = getYouTubeSearchData(message);
                    const youTubeLinkAnalysisData = getYouTubeLinkAnalysisData(message);
                    return (
                      <div key={message.id} id={message.id} className="mb-8 last:mb-2 message-glow">
                        <MessageComponent
                          message={message}
                          currentModel="gpt-4.1"
                          isStreaming={isLoading && message.role === 'assistant' && message.id === messages[messages.length - 1]?.id}
                          isWaitingForToolResults={false}
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
                          messageHasCanvasData={messageHasCanvasData}
                          activePanelMessageId={activePanel?.messageId}
                          togglePanel={togglePanel}
                          webSearchData={webSearchData}
                          mathCalculationData={mathCalculationData}
                          linkReaderData={linkReaderData}
                          imageGeneratorData={imageGeneratorData}
                          academicSearchData={academicSearchData}
                          xSearchData={xSearchData}
                          youTubeSearchData={youTubeSearchData}
                          youTubeLinkAnalysisData={youTubeLinkAnalysisData}
                        />
                      </div>
                    );
                  })}
                  {/* FollowUpQuestions 위치 이동 및 조건부 렌더링 추가 */}
                  {!isLoading && messages.length > 0 && messages[messages.length - 1]?.role === 'assistant' && (
                    <FollowUpQuestions 
                      chatId="demo"
                      userId="guest"
                      messages={messages}
                      onQuestionClick={handleExampleClick} // DemoChat의 handleExampleClick 사용
                    />
                  )}
                  <div ref={messagesEndRef} className="h-px" /> {/* messagesEndRef는 FollowUpQuestions 뒤에 위치 */}
                </div>
                
                {/* Input area - simplified, only contains the chat input */}
                <div className="px-5 py-4">
                  <div className="relative demo-chat-input">
                    <ChatInput
                      input={input}
                      handleInputChange={handleInputChange}
                      handleSubmit={handleSubmitWrapper}
                      isLoading={isLoading}
                      stop={stop}
                      user={{ id: 'guest', hasAgentModels: true }}
                      modelId="gpt-4.1"
                      isAgentEnabled={isAgentEnabled}
                      setisAgentEnabled={setIsAgentEnabled}
                    />
                    
                    {/* 파일 업로드 버튼 위에 직접 툴팁 오버레이 추가 */}
                    <div className="file-upload-tooltip">
                      <div className="tooltip-text">Login to use file upload</div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Canvas area - 실제 페이지 레이아웃 및 스타일 적용 */}
              <div 
                className={`fixed md:relative top-0 md:top-auto right-0 bottom-0 md:bottom-auto
                            w-full md:w-2/3 
                            bg-[var(--background)] md:border-l 
                            border-[color-mix(in_srgb,var(--foreground)_7%,transparent)] 
                            overflow-y-auto z-30  /* z-index 조정 */
                            transition-all duration-300 ease-in-out transform 
                            ${activePanel?.messageId ? 'translate-x-0 opacity-100' : 'translate-x-full md:translate-x-0 md:opacity-0 md:max-w-0 md:overflow-hidden'} 
                            ${hideScrollbarClass}`}
                style={{ 
                  height: '100%', // md 이상에서는 부모 높이(h-full)를 따름
                  maxHeight: '100%' // md 이상에서는 부모 높이(h-full)를 따름
                }}
                ref={canvasContainerRef}
              >
                {/* Panel header (Mobile/Desktop common) - 실제 페이지와 유사하게 */}
                {activePanel?.messageId && (
                  <div className="sticky top-0 z-10 bg-[var(--background)] flex items-center justify-between px-4 h-auto py-2.5 border-b border-[color-mix(in_srgb,var(--foreground)_7%,transparent)]">
                    <div className="flex items-center">
                      <button 
                        onClick={() => setActivePanel(null)} // togglePanel 대신 직접 null로 설정
                        className="w-8 h-8 flex items-center justify-center mr-3 text-[var(--muted)] hover:text-[var(--foreground)]"
                        aria-label="Close panel"
                      >
                        <X size={20} />
                      </button>
                      <div className="flex flex-col">
                        <h3 className="text-lg font-semibold text-[var(--foreground)]">
                          {activePanel.type === 'canvas' ? 'Canvas' : 'Attachment Details'}
                        </h3>
                        {/* 실제 페이지의 미리보기 요약 로직은 데모에서 단순화 또는 제거 가능 */}
                      </div>
                    </div>
                    <div></div> {/* Empty div for spacing */}
                  </div>
                )}
                
                {/* Desktop panel header 제거 (위에서 공통 헤더로 통합) */}
                
                {/* Canvas content */}
                <div 
                  // ref={canvasContainerRef} // ref는 부모 div로 이동
                  className={`h-full overflow-y-auto ${hideScrollbarClass} px-4 pt-4 pb-10`} // 패딩 조정
                  // style={{ // height는 부모 div에서 관리
                  //   height: activePanel ? 'calc(100% - 57px)' : 'calc(100% - 49px)' 
                  // }}
                >
                  {messages
                    .filter(message => message.id === activePanel?.messageId)
                    .map((message) => {
                      const webSearchData = getWebSearchResults(message);
                      const mathCalculationData = getMathCalculationData(message);
                      const linkReaderData = getLinkReaderData(message);
                      const imageGeneratorData = getImageGeneratorData(message);
                      const academicSearchData = getAcademicSearchData(message);
                      const xSearchData = getXSearchData(message);
                      const youTubeSearchData = getYouTubeSearchData(message);
                      const youTubeLinkAnalysisData = getYouTubeLinkAnalysisData(message);

                      return (
                        <div key={`panel-content-${message.id}`} id={`canvas-${message.id}`} className="p-5">
                          {activePanel?.type === 'canvas' && (
                            <Canvas 
                              webSearchData={webSearchData}
                              mathCalculationData={mathCalculationData}
                              linkReaderData={linkReaderData}
                              imageGeneratorData={imageGeneratorData}
                              academicSearchData={academicSearchData}
                              xSearchData={xSearchData}
                              youTubeSearchData={youTubeSearchData}
                              youTubeLinkAnalysisData={youTubeLinkAnalysisData}
                              isCompact={false}
                            />
                          )}
                          {activePanel?.type === 'structuredResponse' && (
                            <StructuredResponse message={message} />
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          </div>
          
          {/* FollowUpQuestions - 실제 페이지와 동일하게 */}
          {/* <FollowUpQuestions 
            chatId="demo"
            userId="guest"
            messages={messages}
            onQuestionClick={handleExampleClick}
          /> */}
          {/* Example prompt - SuggestedPrompt 스타일 */}
          <div className="flex justify-center mt-6 md:mt-16">
            <div className="min-h-[28px] relative w-full max-w-xl">
              {isPromptLoading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-4 w-24 bg-foreground/10 animate-pulse rounded"></div>
                </div>
              )}
              {suggestedPrompt && (
                <div
                  className={`text-xs sm:text-base text-[var(--muted)] cursor-pointer transition-all duration-300 text-center break-words whitespace-normal max-w-full max-h-16 overflow-y-auto ${
                    isPromptVisible ? 'opacity-100' : 'opacity-0'
                  } hover:text-[var(--foreground)]`}
                  onClick={() => handleExampleClick(suggestedPrompt)}
                >
                  {suggestedPrompt}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
} 