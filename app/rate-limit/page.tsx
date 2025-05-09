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
import { createCheckoutSession, checkSubscription } from '@/lib/polar'

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

// Add countdown component for better visualization
const CountdownTimer = ({ seconds }: { seconds: number }) => {
  // Calculate hours, minutes, seconds
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  return (
    <div className="flex gap-2 sm:gap-4 items-center justify-center">
      <div className="flex flex-col items-center">
        <div className="w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center bg-gradient-to-b from-red-500/10 to-red-500/20 rounded-lg text-xl sm:text-2xl font-medium text-red-500 dark:text-red-400">
          {hours.toString().padStart(2, '0')}
        </div>
        <span className="text-xs mt-1 text-[var(--muted)]">HOURS</span>
      </div>
      <div className="text-red-500 dark:text-red-400 text-xl font-bold">:</div>
      <div className="flex flex-col items-center">
        <div className="w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center bg-gradient-to-b from-red-500/10 to-red-500/20 rounded-lg text-xl sm:text-2xl font-medium text-red-500 dark:text-red-400">
          {minutes.toString().padStart(2, '0')}
        </div>
        <span className="text-xs mt-1 text-[var(--muted)]">MINUTES</span>
      </div>
      <div className="text-red-500 dark:text-red-400 text-xl font-bold">:</div>
      <div className="flex flex-col items-center">
        <div className="w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center bg-gradient-to-b from-red-500/10 to-red-500/20 rounded-lg text-xl sm:text-2xl font-medium text-red-500 dark:text-red-400 relative">
          {secs.toString().padStart(2, '0')}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-red-500/30">
            <div 
              className="h-full bg-red-500" 
              style={{ width: `${(secs / 60) * 100}%`, transition: 'width 1s linear' }}
            ></div>
          </div>
        </div>
        <span className="text-xs mt-1 text-[var(--muted)]">SECONDS</span>
      </div>
    </div>
  );
};

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
  const [isSubscribing, setIsSubscribing] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)
  const [isAgentEnabled, setisAgentEnabled] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isCheckingSubscription, setIsCheckingSubscription] = useState(true)
  
  // Get the rate-limited model and chat session from URL params
  const rateLimitedModelId = searchParams.get('model') || ''
  const chatId = searchParams.get('chatId') || ''
  const currentModel = MODEL_CONFIGS.find(m => m.id === rateLimitedModelId)
  
  // Get the rate-limited level (either from URL or from model config)
  const levelFromUrl = searchParams.get('level') || ''
  const rateLimitedLevel = levelFromUrl || currentModel?.rateLimit.level || ''
  
  // Get all models with the same level as the rate-limited model
  const rateLimitedModels = MODEL_CONFIGS.filter(m => m.rateLimit.level === rateLimitedLevel).map(m => m.id)
  
  // Track all rate limited levels
  const [rateLimitedLevels, setRateLimitedLevels] = useState<string[]>([])
  
  // Set up model selection (default to system default, but not from the rate-limited level)
  const [nextModel, setNextModel] = useState<string>('')
  
  // Store rate limit info in localStorage
  useEffect(() => {
    if (rateLimitedLevel) {
      const resetTime = new Date(searchParams.get('reset') || '').getTime()
      // Get existing rate limit levels from localStorage
      let rateLimitLevels = {}
      try {
        const existingLevelsStr = localStorage.getItem('rateLimitLevels')
        if (existingLevelsStr) {
          rateLimitLevels = JSON.parse(existingLevelsStr)
        }
      } catch (error) {
        console.error('Error parsing existing rate limit levels:', error)
      }
      
      // Add or update the current rate limited level
      rateLimitLevels = {
        ...rateLimitLevels,
        [rateLimitedLevel]: {
          reset: resetTime,
          models: rateLimitedModels
        }
      }
      
      // Store in localStorage
      localStorage.setItem('rateLimitLevels', JSON.stringify(rateLimitLevels))
      
      // For backward compatibility
      const rateLimitInfo = {
        level: rateLimitedLevel,
        reset: resetTime,
        models: rateLimitedModels
      }
      localStorage.setItem('rateLimitInfo', JSON.stringify(rateLimitInfo))
      
      // Set up cleanup for expired rate limits
      const timeoutId = setTimeout(() => {
        try {
          const levelsStr = localStorage.getItem('rateLimitLevels')
          if (levelsStr) {
            const levels = JSON.parse(levelsStr)
            // Remove the expired level
            delete levels[rateLimitedLevel]
            
            if (Object.keys(levels).length > 0) {
              localStorage.setItem('rateLimitLevels', JSON.stringify(levels))
            } else {
              localStorage.removeItem('rateLimitLevels')
            }
          }
          
          // Also remove the legacy rateLimitInfo if it matches this level
          const infoStr = localStorage.getItem('rateLimitInfo')
          if (infoStr) {
            const info = JSON.parse(infoStr)
            if (info.level === rateLimitedLevel) {
              localStorage.removeItem('rateLimitInfo')
            }
          }
        } catch (error) {
          console.error('Error cleaning up rate limit info:', error)
        }
      }, Math.max(0, resetTime - Date.now()))
      
      return () => clearTimeout(timeoutId)
    }
  }, [rateLimitedLevel, rateLimitedModels, searchParams])
  
  // Separate useEffect to update rateLimitedLevels state
  useEffect(() => {
    // Only run on client side
    if (typeof window !== 'undefined') {
      try {
        const rateLimitLevelsStr = localStorage.getItem('rateLimitLevels')
        if (rateLimitLevelsStr) {
          const levelsData = JSON.parse(rateLimitLevelsStr)
          const currentTime = Date.now()
          
          // Filter out expired levels and collect valid ones
          const validLevels = Object.entries(levelsData)
            .filter(([_, data]: [string, any]) => data.reset > currentTime)
            .map(([level, _]: [string, any]) => level)
          
          setRateLimitedLevels(validLevels)
        } else {
          // For backward compatibility
          const rateLimitInfoStr = localStorage.getItem('rateLimitInfo')
          if (rateLimitInfoStr) {
            const rateLimitInfo = JSON.parse(rateLimitInfoStr)
            
            // Check if the rate limit is still valid
            if (rateLimitInfo.reset > Date.now()) {
              setRateLimitedLevels([rateLimitInfo.level])
            } else {
              setRateLimitedLevels([])
            }
          } else {
            setRateLimitedLevels([])
          }
        }
      } catch (error) {
        console.error('Error parsing rate limit info:', error)
        setRateLimitedLevels([])
      }
    }
  }, [])
  
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
        
        // Check subscription status
        setIsCheckingSubscription(true)
        try {
          const hasSubscription = await checkSubscription(user.id)
          setIsSubscribed(hasSubscription)
        } catch (error) {
          console.error('Error checking subscription status:', error)
          setIsSubscribed(false)
        } finally {
          setIsCheckingSubscription(false)
        }
        
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
        
        // Get system default model but make sure it's not from any rate-limited level
        let defaultModel = getSystemDefaultModelId()
        const defaultModelConfig = MODEL_CONFIGS.find(m => m.id === defaultModel)
        
        if (defaultModelConfig && rateLimitedLevels.includes(defaultModelConfig.rateLimit.level)) {
          // If default model is in any rate-limited level, choose another one from a different level
          const alternativeModel = MODEL_CONFIGS.find(m => 
            m.isEnabled && !rateLimitedLevels.includes(m.rateLimit.level)
          )
          defaultModel = alternativeModel?.id || defaultModel
        }
        
        setNextModel(defaultModel)
      } catch (error) {
        console.error('Error loading user or model:', error)
        
        // Fallback to a non-rate-limited model from a different level
        const fallbackModel = MODEL_CONFIGS.find(m => 
          m.isEnabled && !rateLimitedLevels.includes(m.rateLimit.level)
        )?.id || getSystemDefaultModelId()
        setNextModel(fallbackModel)
      } finally {
        setIsModelLoading(false)
      }
    }
    
    getUser()
  }, [supabase.auth, router, chatId, rateLimitedLevels])
  
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
    // Check if the selected model is in any of the rate-limited levels
    const selectedModelConfig = MODEL_CONFIGS.find(m => m.id === newModel)
    if (selectedModelConfig && !rateLimitedLevels.includes(selectedModelConfig.rateLimit.level)) {
      setNextModel(newModel)
    } else {
      console.warn(`Cannot select model ${newModel} as its level is rate limited`)
    }
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
  
  // Handle subscription
  const handleSubscribe = async () => {
    if (!user) return;
    
    setIsSubscribing(true);
    try {
      const checkout = await createCheckoutSession(
        user.id,
        user.email,
        user.user_metadata?.full_name
      );
      
      // Redirect to checkout URL
      window.location.href = checkout.url;
    } catch (error) {
      console.error('Error creating checkout session:', error);
      alert('Failed to create checkout session. Please try again.');
    } finally {
      setIsSubscribing(false);
    }
  };
  
  // Handler for continuing to use subscribed models
  const handleContinueWithSubscription = async () => {
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
  
  // 로딩 중이거나 사용자 정보가 없는 경우 로딩 화면 표시
  if (isModelLoading || !user || isCheckingSubscription) {
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
        user={user}
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
          <div className="w-full max-w-2xl mx-auto px-6 sm:px-8 pt-20 pb-10">
            {/* Rate limit notice */}
            <div className="mb-8 fade-in-up">
              <h1 className="text-2xl md:text-3xl font-medium mb-4 text-[var(--foreground)]">
                {isSubscribed ? "Taking a Quick Break ✨" : "Taking a Quick Break ⏱️"}
              </h1>
              
              <p className="text-base text-[var(--muted)] mb-6 fade-in-up" style={{ animationDelay: '0.1s' }}>
                {isSubscribed 
                  ? "Our systems need a short breather to keep things running smoothly for everyone. Your premium access will be ready again soon!" 
                  : "Just a short pause to keep our AI models happy and responsive for everyone. You'll be back chatting in no time!"}
              </p>
              
              {isSubscribed ? (
                <div className="mb-8 fade-in-up" style={{ animationDelay: '0.2s' }}>
                  <div className="p-4 bg-blue-50/10 border border-blue-200 rounded-sm">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div>
                        <h3 className="text-base font-medium mb-1 text-blue-600 dark:text-blue-400">PREMIUM PERKS 🌟</h3>
                        <p className="text-sm text-[var(--muted)]">Your subscription gives you faster refreshes and more generous usage</p>
                        <div className="flex gap-2 mt-2">
                          <span className="text-xs px-2 py-1 bg-blue-100/20 text-blue-700 rounded  dark:text-blue-300">More Usage</span>
                          <span className="text-xs px-2 py-1 bg-blue-100/20 text-blue-700 rounded  dark:text-blue-300">Priority Access</span>
                          <span className="text-xs px-2 py-1 bg-blue-100/20 text-blue-700 rounded  dark:text-blue-300">All Models</span>
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-blue-600 dark:text-blue-400 font-medium mb-2">Ready in:</div>
                        <CountdownTimer seconds={timeLeft} />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="mb-8 fade-in-up" style={{ animationDelay: '0.2s' }}>
                    <div className="flex flex-col items-center">
                      <div className="text-center mb-3">
                        <span className="text-base font-medium">Hang tight! Ready in:</span>
                      </div>
                      
                      <CountdownTimer seconds={timeLeft} />
                      
                      <div className="text-center mt-5 text-sm text-[var(--muted)]">
                        <p>These short pauses help keep our systems running smoothly for everyone. Thanks for your patience! 🙏</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Subscription Button - only shown to non-subscribers */}
                  <div className="mb-8 fade-in-up" style={{ animationDelay: '0.25s' }}>
                    <div className="p-4 bg-amber-50/10 border border-amber-200 rounded-sm relative overflow-hidden">
                      <div className="absolute top-0 right-0 bg-blue-600 text-xs text-white px-3 py-1 rounded-bl-sm font-medium">
                        UPGRADE OPTION ✨
                      </div>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2">
                        <div>
                          <h3 className="text-base font-medium mb-1 text-amber-800 dark:text-amber-400">WANT FEWER BREAKS?</h3>
                          <p className="text-sm text-[var(--muted)]">Premium users enjoy more chat time and quicker refreshes</p>
                          <div className="flex gap-2 mt-2">
                            <span className="text-xs px-2 py-1 bg-amber-100/20 text-amber-700 rounded">More Chat Time</span>
                            <span className="text-xs px-2 py-1 bg-amber-100/20 text-amber-700 rounded">All Models</span>
                            <span className="text-xs px-2 py-1 bg-amber-100/20 text-amber-700 rounded">Priority Access</span>
                          </div>
                        </div>
                        <div className="relative" onMouseEnter={() => setShowTooltip(true)} onMouseLeave={() => setShowTooltip(false)}>
                          <button
                            onClick={handleSubscribe}
                            disabled={isSubscribing}
                            className="premium-ticket flex items-center gap-2 px-4 py-2 border border-amber-400/30 bg-gradient-to-r from-amber-500 to-amber-400 text-white rounded-sm hover:shadow-md transition-all whitespace-nowrap relative overflow-hidden"
                            aria-label="Get Premium Access"
                          >
                            <span className="text-2xl font-bold tracking-wide relative z-10">
                              <span className="opacity-70 text-sm line-through mr-1">$4</span>
                              $0.8
                            </span>
                            <div className="absolute inset-0 bg-white opacity-0 hover:opacity-10 transition-opacity"></div>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
            
            <div className="mb-4 model-selector-container">
              <ModelSelector
                currentModel={currentModel?.id || ''}
                nextModel={nextModel}
                setNextModel={(model) => {
                  if (typeof model === 'function') {
                    const newModel = model(nextModel);
                    handleModelChange(newModel);
                  } else {
                    handleModelChange(model);
                  }
                }}
                setCurrentModel={setNextModel}
                disabled={isSubmitting}
                disabledLevels={isSubscribed ? [] : rateLimitedLevels}
                isAgentEnabled={isAgentEnabled}
              />
            </div>

            {/* Model selector and action buttons */}
            <div className="space-y-10 fade-in-up" style={{ animationDelay: '0.7s' }}>
              {chatId && (
                <button 
                  onClick={isSubscribed ? handleContinueWithSubscription : handleContinueChat}
                  disabled={isSubmitting || (!isSubscribed && (nextModel === rateLimitedModelId)) || !nextModel}
                  className="continue-button w-full px-4 py-3 bg-[var(--foreground)] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-[var(--background)] transition-colors mb-4"
                >
                  <div className="flex items-center justify-center gap-2">
                    <span>
                      {isSubscribed 
                        ? `CONTINUE WITH ${nextModelDetails?.name.toUpperCase()}` 
                        : `CONTINUE WITH ${nextModelDetails?.name.toUpperCase()}`}
                    </span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-1">
                      <path d="M5 12h14"></path>
                      <path d="m12 5 7 7-7 7"></path>
                    </svg>
                  </div>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}