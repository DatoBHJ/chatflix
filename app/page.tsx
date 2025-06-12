'use client'

import { useRouter } from 'next/navigation'
import { useChat } from '@ai-sdk/react';
import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { ModelSelector } from './components/ModelSelector'
import { Header } from './components/Header'
import { Sidebar } from './components/Sidebar'
import { uploadFile } from '@/app/chat/[id]/utils'
import { Attachment } from '@/lib/types'
import { nanoid } from 'nanoid'
import { getDefaultModelId, getSystemDefaultModelId, updateUserDefaultModel, MODEL_CONFIGS } from '@/lib/models/config'
import { ChatInput } from '@/app/components/ChatInput/index'
import { SuggestedPrompt } from '@/app/components/SuggestedPrompt/SuggestedPrompt'
export default function Home() {
  const router = useRouter()
  const [currentModel, setCurrentModel] = useState(getSystemDefaultModelId()) // 초기값으로 시스템 기본 모델 사용
  const [nextModel, setNextModel] = useState(getSystemDefaultModelId()) // 초기값으로 시스템 기본 모델 사용
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isModelLoading, setIsModelLoading] = useState(true) // 모델 로딩 상태 추가
  const [rateLimitedLevels, setRateLimitedLevels] = useState<string[]>([])
  const [isAgentEnabled, setisAgentEnabled] = useState(false)
  const [hasAgentModels, setHasAgentModels] = useState(true)
  const supabase = createClient()

  // Handle toggling the agent with rate-limit awareness
  const handleAgentToggle = (newState: boolean) => {
    // Only allow enabling agent if agent models are available
    if (newState && !hasAgentModels) {
      console.warn('Cannot enable agent: No non-rate-limited agent models available')
      return
    }
    setisAgentEnabled(newState)
  }

  // Create a handler that matches the Dispatch<SetStateAction<boolean>> type
  const setAgentEnabledHandler: React.Dispatch<React.SetStateAction<boolean>> = (value) => {
    const newValue = typeof value === 'function' ? value(isAgentEnabled) : value;
    handleAgentToggle(newValue);
  };

  // Check for rate limited levels from localStorage
  useEffect(() => {
    // Only run on client side
    if (typeof window !== 'undefined') {
      const checkRateLimits = () => {
        try {
          // Check for multiple rate limited levels
          const rateLimitLevelsStr = localStorage.getItem('rateLimitLevels')
          let newRateLimitedLevels: string[] = [];
          let shouldUpdateState = false;
          
          if (rateLimitLevelsStr) {
            const levelsData = JSON.parse(rateLimitLevelsStr)
            const currentTime = Date.now()
            
            // Filter out expired levels and collect valid ones
            const validLevels = Object.entries(levelsData)
              .filter(([_, data]: [string, any]) => data.reset > currentTime)
              .map(([level, _]: [string, any]) => level)
            
            if (validLevels.length > 0) {
              // Only update state if the levels have changed
              if (JSON.stringify(validLevels) !== JSON.stringify(rateLimitedLevels)) {
                newRateLimitedLevels = validLevels;
                shouldUpdateState = true;
              }
              
              // If current model is rate limited, switch to a different model
              if (currentModel) {
                const currentModelConfig = MODEL_CONFIGS.find(m => m.id === currentModel)
                if (currentModelConfig && validLevels.includes(currentModelConfig.rateLimit.level)) {
                  // Find a model from a different level that's not rate limited
                  const alternativeModel = MODEL_CONFIGS.find(m => 
                    m.isEnabled && !validLevels.includes(m.rateLimit.level)
                  )
                  if (alternativeModel && alternativeModel.id !== nextModel) {
                    setNextModel(alternativeModel.id)
                  }
                }
              }
            } else {
              // All rate limits have expired, remove the data
              localStorage.removeItem('rateLimitLevels')
              if (rateLimitedLevels.length > 0) {
                shouldUpdateState = true;
              }
            }
          } else {
            // For backward compatibility, check the old format
            const rateLimitInfoStr = localStorage.getItem('rateLimitInfo')
            if (rateLimitInfoStr) {
              const rateLimitInfo = JSON.parse(rateLimitInfoStr)
              
              // Check if the rate limit is still valid
              if (rateLimitInfo.reset > Date.now()) {
                if (rateLimitedLevels.length !== 1 || rateLimitedLevels[0] !== rateLimitInfo.level) {
                  newRateLimitedLevels = [rateLimitInfo.level];
                  shouldUpdateState = true;
                }
                
                // If current model is rate limited, switch to a different model
                if (currentModel) {
                  const currentModelConfig = MODEL_CONFIGS.find(m => m.id === currentModel)
                  if (currentModelConfig && currentModelConfig.rateLimit.level === rateLimitInfo.level) {
                    // Find a model from a different level
                    const alternativeModel = MODEL_CONFIGS.find(m => 
                      m.isEnabled && m.rateLimit.level !== rateLimitInfo.level
                    )
                    if (alternativeModel && alternativeModel.id !== nextModel) {
                      setNextModel(alternativeModel.id)
                    }
                  }
                }
              } else {
                // Rate limit has expired, remove it
                localStorage.removeItem('rateLimitInfo')
                if (rateLimitedLevels.length > 0) {
                  shouldUpdateState = true;
                }
              }
            }
          }
          
          // Only update state if necessary
          if (shouldUpdateState) {
            setRateLimitedLevels(newRateLimitedLevels);
          }
        } catch (error) {
          console.error('Error checking rate limits:', error)
        }
      }

      // Initial check
      checkRateLimits()

      // Set up interval to check every 5 seconds instead of every second
      const intervalId = setInterval(checkRateLimits, 5000)

      // Cleanup interval on unmount
      return () => clearInterval(intervalId)
    }
  }, [currentModel, nextModel, rateLimitedLevels]) // Add rateLimitedLevels to dependencies

  useEffect(() => {
    const getUser = async () => {
      try {
        setIsModelLoading(true) // 로딩 시작
        
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push('/login')
          return
        }
        setUser(user)
        
        // 사용자의 기본 모델 가져오기
        const defaultModel = await getDefaultModelId(user.id)
        
        // Check if the default model is in a rate-limited level
        if (rateLimitedLevels.length > 0) {
          const modelConfig = MODEL_CONFIGS.find(m => m.id === defaultModel)
          if (modelConfig && rateLimitedLevels.includes(modelConfig.rateLimit.level)) {
            // Find a model from a different level
            const alternativeModel = MODEL_CONFIGS.find(m => 
              m.isEnabled && !rateLimitedLevels.includes(m.rateLimit.level)
            )
            if (alternativeModel) {
              setCurrentModel(alternativeModel.id)
              setNextModel(alternativeModel.id)
            } else {
              setCurrentModel(defaultModel)
              setNextModel(defaultModel)
            }
          } else {
            setCurrentModel(defaultModel)
            setNextModel(defaultModel)
          }
        } else {
          setCurrentModel(defaultModel)
          setNextModel(defaultModel)
        }
      } catch (error) {
        console.error('사용자 정보 또는 모델 로딩 중 오류:', error)
        // 오류 발생 시 시스템 기본 모델 사용
        const systemDefault = getSystemDefaultModelId()
        setCurrentModel(systemDefault)
        setNextModel(systemDefault)
      } finally {
        setIsModelLoading(false) // 로딩 완료
      }
    }
    getUser()
  }, [supabase.auth, router, rateLimitedLevels])

  // 사용자가 모델을 변경할 때 호출되는 함수
  const handleModelChange = async (newModel: string) => {
    // Check if the selected model is in a rate-limited level
    if (rateLimitedLevels.length > 0) {
      const modelConfig = MODEL_CONFIGS.find(m => m.id === newModel)
      if (modelConfig && rateLimitedLevels.includes(modelConfig.rateLimit.level)) {
        // Don't allow changing to a rate-limited model
        console.warn('Cannot change to a rate-limited model')
        return
      }
    }
    
    // 모델 상태 업데이트 - 즉시 currentModel도 업데이트
    setNextModel(newModel)
    setCurrentModel(newModel)
    
    // 사용자가 로그인한 경우에만 기본 모델 업데이트
    if (user) {
      try {
        const success = await updateUserDefaultModel(user.id, newModel)
        if (success) {
          console.log(`사용자 기본 모델이 ${newModel}로 업데이트되었습니다.`)
        } else {
          console.error('사용자 기본 모델 업데이트 실패')
        }
      } catch (error) {
        console.error('사용자 기본 모델 업데이트 중 오류:', error)
      }
    }
  }

  const { input, handleInputChange, isLoading, stop } = useChat({
    api: '/api/chat',
    body: {
      model: currentModel,
      experimental_attachments: true,
      isAgentEnabled,
    }
  })

  const handleModelSubmit = async (e: React.FormEvent, files?: FileList) => {
    e.preventDefault()
    
    if (isSubmitting || !input.trim() || !user) return
    setIsSubmitting(true)

    try {
      // 디버깅: 웹 검색 상태 확인
      console.log('[Debug] Home page - Agent enabled:', isAgentEnabled);
      
      // Create session ID
      const sessionId = nanoid();
      
      // Upload files first if they exist
      let attachments: Attachment[] = [];
      if (files?.length) {
        try {
          const uploadPromises = Array.from(files).map(file => uploadFile(file));
          attachments = await Promise.all(uploadPromises);
          console.log('[Debug] Uploaded attachments:', attachments);
        } catch (error) {
          console.error('Failed to upload files:', error);
          return;
        }
      }

      // 사용자가 선택한 모델 사용
      const modelToUse = currentModel;

      // First create the session and wait for it to complete
      const { error: sessionError } = await supabase
        .from('chat_sessions')
        .insert([{
          id: sessionId,
          title: 'New Chat',
          current_model: modelToUse,
          initial_message: input.trim(),
          user_id: user.id,
        }]);

      if (sessionError) {
        console.error('Failed to create session:', sessionError);
        return;
      }

      // Now save the message after the session is created
      const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 15)}`;
      const { error: messageError } = await supabase
        .from('messages')
        .insert([{
          id: messageId,
          content: input.trim(),
          role: 'user',
          created_at: new Date().toISOString(),
          model: modelToUse,
          host: 'user',
          chat_session_id: sessionId,
          user_id: user.id,
          experimental_attachments: attachments
        }]);

      if (messageError) {
        console.error('Failed to save message:', messageError);
        return;
      }

      // Before redirect, save Agent state to localStorage
      if (isAgentEnabled) {
        localStorage.setItem(`Agent_${sessionId}`, 'true');
        console.log('[Debug] Home page - Saved Agent state to localStorage:', sessionId);
      }

      // 디버깅: 리다이렉트 URL 출력
      const redirectUrl = `/chat/${sessionId}${isAgentEnabled ? '?Agent=true' : ''}`;
      console.log('[Debug] Home page - Redirecting to:', redirectUrl);
      
      // Redirect to chat page with query parameter to indicate Agent
      router.push(redirectUrl);
      
    } catch (error) {
      console.error('Error in handleModelSubmit:', error);
    } finally {
      setIsSubmitting(false);
    }
  }

  // Add a handler for suggested prompts
  const handleSuggestedPromptClick = async (prompt: string) => {
    if (isSubmitting || !user) return;
    setIsSubmitting(true);

    try {
      // Check if we should enable agent mode
      let useAgent = isAgentEnabled;
      if (!isAgentEnabled && hasAgentModels) {
        useAgent = true;
        setisAgentEnabled(true);
      }

      console.log('[Debug] Submitting suggested prompt directly:', prompt);
      
      // Create session ID
      const sessionId = nanoid();
      
      // Get appropriate model for agent mode if needed
      let modelToUse = nextModel;
      
      // If agent mode is enabled, ensure we're using an agent-compatible model
      if (useAgent) {
        const allModels = MODEL_CONFIGS.filter(model => model.isEnabled && model.isActivated);
        const currentModelData = allModels.find(m => m.id === nextModel);
        
        // Check if current model supports agent mode
        if (!currentModelData?.isAgentEnabled) {
          // Find a non-rate-limited agent-enabled model
          const nonRateLimitedAgentModels = allModels.filter(model => 
            model.isAgentEnabled === true && 
            model.isActivated && 
            !rateLimitedLevels.includes(model.rateLimit.level)
          );
          
          // If we have non-rate-limited agent models, use the first one
          if (nonRateLimitedAgentModels.length > 0) {
            modelToUse = nonRateLimitedAgentModels[0].id;
            console.log('[Debug] Switched to agent-compatible model:', modelToUse);
            // Also update the UI model selection states to keep in sync
            setNextModel(modelToUse);
            setCurrentModel(modelToUse);
            
            // Update user's default model preference if logged in
            if (user) {
              updateUserDefaultModel(user.id, modelToUse)
                .then(success => {
                  if (success) {
                    console.log('[Debug] Updated user default model to:', modelToUse);
                  }
                })
                .catch(err => {
                  console.error('Failed to update user default model:', err);
                });
            }
          } else {
            // No agent-compatible models available, revert to non-agent mode
            console.warn('[Debug] No agent-compatible models available, disabling agent');
            useAgent = false;
            setisAgentEnabled(false);
          }
        }
      }

      // Create the session directly
      const { error: sessionError } = await supabase
        .from('chat_sessions')
        .insert([{
          id: sessionId,
          title: prompt.trim(),
          current_model: modelToUse,
          initial_message: prompt.trim(),
          user_id: user.id,
        }]);

      if (sessionError) {
        console.error('Failed to create session:', sessionError);
        return;
      }

      // Save the message directly
      const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 15)}`;
      const { error: messageError } = await supabase
        .from('messages')
        .insert([{
          id: messageId,
          content: prompt.trim(),
          role: 'user',
          created_at: new Date().toISOString(),
          model: modelToUse,
          host: 'user',
          chat_session_id: sessionId,
          user_id: user.id,
          experimental_attachments: []
        }]);

      if (messageError) {
        console.error('Failed to save message:', messageError);
        return;
      }

      // Save Agent state to localStorage if needed
      if (useAgent) {
        localStorage.setItem(`Agent_${sessionId}`, 'true');
        console.log('[Debug] Saved Agent state to localStorage:', sessionId);
      }

      // Redirect to chat page
      const redirectUrl = `/chat/${sessionId}${useAgent ? '?Agent=true' : ''}`;
      console.log('[Debug] Redirecting to:', redirectUrl);
      router.push(redirectUrl);
      
    } catch (error) {
      console.error('Error in handleSuggestedPromptClick:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Effect to handle model compatibility with agent mode
  useEffect(() => {
    // If we just enabled agent mode, check if current model supports it
    if (isAgentEnabled) {
      const currentModelConfig = MODEL_CONFIGS.find(m => m.id === currentModel);
      
      // If current model doesn't support agent, find a compatible one
      if (!currentModelConfig?.isAgentEnabled) {
        // Find non-rate-limited agent-enabled models
        const nonRateLimitedAgentModels = MODEL_CONFIGS.filter(model => 
          model.isAgentEnabled === true && 
          model.isActivated && 
          model.isEnabled && 
          !rateLimitedLevels.includes(model.rateLimit.level)
        );
        
        // Switch to first available agent-compatible model
        if (nonRateLimitedAgentModels.length > 0) {
          const newModelId = nonRateLimitedAgentModels[0].id;
          setCurrentModel(newModelId);
          setNextModel(newModelId);
          console.log('[Debug] Switched to agent-compatible model:', newModelId);
        } else {
          // No agent models available, disable agent mode
          setisAgentEnabled(false);
          console.warn('[Debug] No agent-compatible models available, disabling agent');
        }
      }
    }
  }, [isAgentEnabled, currentModel, rateLimitedLevels]);

  // 로딩 중이거나 사용자 정보가 없는 경우 로딩 화면 표시
  if (isModelLoading || !user) {
    return <div className="flex h-screen items-center justify-center">Chatflix.app</div>
  }

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
        <div className="w-full max-w-2xl px-6 sm:px-8 pb-12 sm:pb-32">
          <div className="space-y-2">
            <ModelSelector
              currentModel={currentModel}
              nextModel={nextModel}
              setNextModel={(model) => {
                if (typeof model === 'function') {
                  const newModel = model(nextModel);
                  handleModelChange(newModel);
                } else {
                  handleModelChange(model);
                }
              }}
              setCurrentModel={setCurrentModel}
              disabled={isSubmitting}
              disabledLevels={rateLimitedLevels}
              isAgentEnabled={isAgentEnabled}
              onAgentAvailabilityChange={setHasAgentModels}
              user={user}
            />     
            
            <ChatInput
              input={input}
              handleInputChange={handleInputChange}
              handleSubmit={handleModelSubmit}
              isLoading={isLoading}
              stop={stop}
              disabled={isSubmitting}
              user={{...user, hasAgentModels}}
              modelId={currentModel}
              isAgentEnabled={isAgentEnabled}
              setisAgentEnabled={setAgentEnabledHandler}
            />
          </div>
          
          {/* Display suggested prompt below the chat input with more spacing */}
          {user?.id && (
            <div className="mt-4">
              <SuggestedPrompt 
                userId={user.id} 
                onPromptClick={handleSuggestedPromptClick}
                isVisible={!input.trim()}
              />
            </div>
          )}
        </div>
      </div>
    </main>
  )
}