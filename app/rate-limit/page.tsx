'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { MODEL_CONFIGS, getSystemDefaultModelId } from '@/lib/models/config'
import { ModelSelector } from '@/app/components/ModelSelector'
import { ChatInput } from '@/app/components/ChatInput'
import { useChat } from '@ai-sdk/react'
import { createClient } from '@/utils/supabase/client'
import { Attachment } from '@/lib/types'
import { uploadFile } from '@/app/chat/[id]/utils'
import { Header } from '@/app/components/Header'
import { Sidebar } from '@/app/components/Sidebar'
import Image from 'next/image'

// Helper function to get the logo path based on provider
const getProviderLogo = (provider: string) => {
  const logoMap: Record<string, string> = {
    anthropic: '/logo/anthropic.svg',
    openai: '/logo/openai.svg',
    google: '/logo/google.svg',
    together: '/logo/together.svg',
    xai: '/logo/grok.svg',
    deepseek: '/logo/deepseek.svg',
    groq: '/logo/groq.svg'
  };
  
  return logoMap[provider] || '';
};

// Helper function to check if a logo exists for a provider
const hasLogo = (provider: string) => {
  const providersWithLogos = ['anthropic', 'openai', 'google', 'together', 'xai', 'deepseek', 'groq'];
  return providersWithLogos.includes(provider);
};

function formatTimeLeft(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} seconds`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes} minute${minutes > 1 ? 's' : ''}${remainingSeconds > 0 ? ` and ${remainingSeconds} seconds` : ''}`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours} hour${hours > 1 ? 's' : ''}${minutes > 0 ? ` and ${minutes} minutes` : ''}`;
  }
}

export default function RateLimitPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const supabase = createClient()
  
  const [timeLeft, setTimeLeft] = useState<number>(0)
  const [user, setUser] = useState<any>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isModelLoading, setIsModelLoading] = useState(true)
  const [chatTitle, setChatTitle] = useState<string>('')
  
  // Get the rate-limited model and chat session from URL params
  const rateLimitedModelId = searchParams.get('model') || ''
  const chatId = searchParams.get('chatId') || ''
  const currentModel = MODEL_CONFIGS.find(m => m.id === rateLimitedModelId)
  
  // Set up model selection (default to system default, but not the rate-limited one)
  const [nextModel, setNextModel] = useState<string>('')
  
  // Add styles to the document head for animations and effects
  useEffect(() => {
    const style = document.createElement('style');
    
    style.textContent = `
      @keyframes fadeInUp {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      
      .fade-in-up {
        animation: fadeInUp 0.4s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
      }
      
      .gradient-line {
        position: relative;
      }
      
      .gradient-line::after {
        content: "";
        position: absolute;
        bottom: -2px;
        left: 0;
        width: 100%;
        height: 1px;
        background: linear-gradient(to right, transparent, var(--muted), transparent);
        opacity: 0.7;
        transform: scaleX(1);
      }
      
      .continue-button {
        position: relative;
        overflow: hidden;
        transition: all 0.3s ease;
      }
      
      .continue-button::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(to right, transparent, rgba(255,255,255,0.1), transparent);
        transform: translateX(-100%);
        transition: transform 0.8s ease;
      }
      
      .continue-button:hover::before {
        transform: translateX(100%);
      }
      
      .pulse {
        animation: pulse 2s infinite;
      }
      
      @keyframes pulse {
        0% {
          opacity: 0.7;
        }
        50% {
          opacity: 0.3;
        }
        100% {
          opacity: 0.7;
        }
      }
      
      .model-badge {
        transition: all 0.3s ease;
      }
      
      .model-badge:hover {
        transform: translateY(-2px);
      }
      
      /* Fix for mobile double scrolling */
      @media (max-width: 640px) {
        body {
          position: fixed;
          width: 100%;
          height: 100%;
          overflow: hidden;
        }
        
        .mobile-container {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
        }
        
        .model-selector-container {
          position: relative;
          z-index: 30;
        }
      }
    `;
    
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);
  
  useEffect(() => {
    const getUser = async () => {
      try {
        setIsModelLoading(true)
        
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push('/login')
          return
        }
        setUser(user)
        
        // Fetch chat title if chatId exists
        if (chatId) {
          const { data: chatData } = await supabase
            .from('chat_sessions')
            .select('title')
            .eq('id', chatId)
            .single()
            
          if (chatData) {
            setChatTitle(chatData.title)
          }
        }
        
        // Get system default model but make sure it's not the rate-limited one
        let defaultModel = getSystemDefaultModelId()
        if (defaultModel === rateLimitedModelId) {
          // If rate-limited model is the default, choose another one
          const alternativeModel = MODEL_CONFIGS.find(m => m.id !== rateLimitedModelId)
          defaultModel = alternativeModel?.id || defaultModel
        }
        
        setNextModel(defaultModel)
      } catch (error) {
        console.error('Error loading user or model:', error)
        
        // Fallback to a non-rate-limited model
        const fallbackModel = MODEL_CONFIGS.find(m => m.id !== rateLimitedModelId)?.id || getSystemDefaultModelId()
        setNextModel(fallbackModel)
      } finally {
        setIsModelLoading(false)
      }
    }
    
    getUser()
  }, [supabase.auth, router, rateLimitedModelId, chatId])
  
  // Timer for rate limit countdown
  useEffect(() => {
    const resetTime = new Date(searchParams.get('reset') || '').getTime()
    
    const updateTimer = () => {
      const now = new Date().getTime()
      const remaining = Math.max(0, Math.ceil((resetTime - now) / 1000))
      setTimeLeft(remaining)
    }
    
    updateTimer()
    const timer = setInterval(updateTimer, 1000)
    
    return () => clearInterval(timer)
  }, [searchParams])
  
  // Chat functionality
  const { input, handleInputChange, isLoading, stop } = useChat({
    api: '/api/chat',
    body: {
      model: nextModel,
      experimental_attachments: true,
      chatId: chatId // Pass existing chatId if continuing conversation
    }
  })
  
  const handleModelChange = (newModel: string) => {
    setNextModel(newModel)
  }
  
  const handleContinueChat = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!chatId || !nextModel || !user) return
    
    try {
      // Update the chat session with the new model
      const { error: updateError } = await supabase
        .from('chat_sessions')
        .update({ current_model: nextModel })
        .eq('id', chatId)
        .eq('user_id', user.id)
        
      if (updateError) {
        console.error('Failed to update chat session:', updateError)
        return
      }
      
      // Redirect back to the chat page
      router.push(`/chat/${chatId}`)
    } catch (error) {
      console.error('Error continuing chat:', error)
    }
  }
  
  const handleNewChat = async (e: React.FormEvent, files?: FileList) => {
    e.preventDefault()
    if (isSubmitting || !input.trim() || !user) return
    
    setIsSubmitting(true)
    
    try {
      // Generate session ID immediately
      const sessionId = Date.now().toString();
      
      // Upload files first if they exist
      let attachments: Attachment[] = [];
      if (files?.length) {
        try {
          const uploadPromises = Array.from(files).map(file => uploadFile(file));
          attachments = await Promise.all(uploadPromises);
        } catch (error) {
          console.error('Failed to upload files:', error);
          return;
        }
      }

      // Create session with initial message
      const { error: sessionError } = await supabase
        .from('chat_sessions')
        .insert([{
          id: sessionId,
          title: input.trim(),
          current_model: nextModel,
          initial_message: input.trim(),
          user_id: user.id
        }]);

      if (sessionError) {
        console.error('Failed to create session:', sessionError);
        return;
      }

      // Save initial message with attachments
      const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const { error: messageError } = await supabase
        .from('messages')
        .insert([{
          id: messageId,
          content: input.trim(),
          role: 'user',
          created_at: new Date().toISOString(),
          model: nextModel,
          host: 'user',
          chat_session_id: sessionId,
          user_id: user.id,
          experimental_attachments: attachments
        }]);

      if (messageError) {
        console.error('Failed to save message:', messageError);
        return;
      }

      // Redirect to chat page
      router.push(`/chat/${sessionId}`);
    } catch (error) {
      console.error('Error in handleNewChat:', error);
    } finally {
      setIsSubmitting(false);
    }
  }
  
  // 로딩 중이거나 사용자 정보가 없는 경우 로딩 화면 표시
  if (isModelLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="w-8 h-8 border-2 border-[var(--foreground)] border-t-transparent rounded-full animate-spin mb-4"></div>
          <span className="text-[var(--muted)]">Chatflix.app</span>
        </div>
      </div>
    )
  }
  
  // Get the next model details
  const nextModelDetails = MODEL_CONFIGS.find(m => m.id === nextModel)
  
  return (
    <main className="flex-1 flex flex-col min-h-screen">
      <Header 
        isSidebarOpen={isSidebarOpen}
        onSidebarToggle={() => setIsSidebarOpen(!isSidebarOpen)}
      />
      
      {/* Sidebar with improved transition */}
      <div 
        className={`fixed left-0 top-0 h-full transform transition-all duration-300 ease-in-out z-50 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar user={user} onClose={() => setIsSidebarOpen(false)} />
      </div>

      {/* Overlay with improved transition */}
      <div
        className={`fixed inset-0 backdrop-blur-[1px] bg-black transition-all duration-200 ease-in-out z-40 ${
          isSidebarOpen 
            ? 'opacity-40 pointer-events-auto' 
            : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="mobile-container w-full h-full">
          <div className="w-full max-w-2xl mx-auto px-6 sm:px-8 pt-6 sm:pt-12 pb-12 sm:pb-32">
            {/* Rate limit notice */}
            <div className="mb-8 fade-in-up">
              <h1 className="text-2xl md:text-3xl font-medium mb-4 text-[var(--foreground)]">
                Rate Limit Exceeded
              </h1>
              
              {currentModel && (
                <div className="mb-6 fade-in-up" style={{ animationDelay: '0.1s' }}>
                  <div className="text-xs uppercase tracking-wider text-[var(--muted)] mb-2">Rate Limited Model</div>
                  <div className="flex items-center gap-2">
                    {hasLogo(currentModel.provider) && (
                      <div className="w-5 h-5 flex-shrink-0">
                        <Image 
                          src={getProviderLogo(currentModel.provider)}
                          alt={`${currentModel.provider} logo`}
                          width={20}
                          height={20}
                          className="object-contain opacity-70"
                        />
                      </div>)}
                    <div className="text-base font-medium text-red-500 dark:text-red-400">
                      {currentModel.name} 
                    </div>
                  </div>
                </div>
              )}
              
              <div className="mb-8 fade-in-up" style={{ animationDelay: '0.2s' }}>
                <div className="text-xs uppercase tracking-wider text-[var(--muted)] mb-2">Time Until Reset</div>
                <div className="text-lg font-medium text-red-500 dark:text-red-400">
                  {formatTimeLeft(timeLeft)}
                </div>
              </div>
              
              {/* 사용자 메시지 스타일로 현재 채팅 표시 */}
              {chatId && chatTitle && (
                <div className="mb-8 fade-in-up" style={{ animationDelay: '0.3s' }}>
                  <div className="text-xs uppercase tracking-wider text-[var(--muted)] mb-3">Current Chat</div>
                  <div className="message-group">
                    <div className="message-role text-right">
                      You
                    </div>
                    <div className="flex justify-end">
                      <div className="message-user">
                        <div className="message-content">
                          {chatTitle}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* <div className="text-sm text-[var(--muted)] mt-4 mb-8 fade-in-up" style={{ animationDelay: '0.4s' }}>
                Continue your conversation with another model below.
              </div> */}
            </div>
            <div className="mb-4 model-selector-container">
                <ModelSelector
                  currentModel={nextModel}
                  nextModel={nextModel}
                  setNextModel={(model) => {
                    if (typeof model === 'function') {
                      const newModel = model(nextModel);
                      handleModelChange(newModel);
                    } else {
                      handleModelChange(model);
                    }
                  }}
                  disabled={isSubmitting}
                />
              </div>

            {/* Model selector and action buttons */}
            <div className="space-y-10 fade-in-up" style={{ animationDelay: '0.7s' }}>
      
              
              {chatId && (
                <button 
                  onClick={handleContinueChat}
                  disabled={isSubmitting || nextModel === rateLimitedModelId}
                  className="continue-button w-full px-4 py-3 bg-[var(--foreground)] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-[var(--background)] transition-colors mb-4"
                >
                  <div className="flex items-center justify-center gap-2">
                    <span>CONTINUE WITH {nextModelDetails?.name.toUpperCase()}</span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-1">
                      <path d="M5 12h14"></path>
                      <path d="m12 5 7 7-7 7"></path>
                    </svg>
                  </div>
                </button>
              )}
            
            {/* 구분선을 여기로 이동 */}
            <div className="h-px w-full bg-[var(--accent)] opacity-30 fade-in-up" style={{ animationDelay: '0.5s' }} />
            
              <div className={`transition-opacity duration-300 ${chatId ? 'opacity-80 hover:opacity-100' : 'opacity-100'}`}>
                <ChatInput
                  input={input}
                  handleInputChange={handleInputChange}
                  handleSubmit={handleNewChat}
                  isLoading={isLoading}
                  stop={stop}
                  disabled={isSubmitting}
                  placeholder={chatId 
                    ? `Start a new conversation with ${nextModelDetails?.name} ...`
                    : `Continue your conversation with ${nextModelDetails?.name} ...`
                  }
                  user={user}
                  modelId={nextModel}
                  popupPosition="bottom"
                />
              </div>
            </div>
            
            {/* Help text */}
            <div className="mt-12 text-xs text-[var(--muted)] opacity-70 text-center fade-in-up" style={{ animationDelay: '0.8s' }}>
              Rate limits help us maintain service quality and prevent abuse.
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}