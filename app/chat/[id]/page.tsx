'use client'

import { useChat } from '@ai-sdk/react';
import { Message } from 'ai'
import { useState, useEffect, use, useRef, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { convertMessage, uploadFile } from './utils'
import { PageProps, ExtendedMessage } from './types'
import { Attachment } from '@/lib/types'
import { useMessages } from '@/app/hooks/useMessages'
import { getDefaultModelId, getSystemDefaultModelId, MODEL_CONFIGS, RATE_LIMITS } from '@/lib/models/config'
import '@/app/styles/loading-dots.css'
import { Messages } from '@/app/components/Messages'
import { SidePanel } from '@/app/components/SidePanel'
import { ChatInputArea } from '@/app/components/ChatInputArea';
import { getYouTubeLinkAnalysisData, getYouTubeSearchData, getXSearchData, getWebSearchResults, getMathCalculationData, getLinkReaderData, getImageGeneratorData, getAcademicSearchData } from '@/app/hooks/toolFunction';
import { Annotation } from '@/app/lib/messageUtils';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

export default function Chat({ params }: PageProps) {
  const { id: chatId } = use(params)
  const router = useRouter()
  const searchParams = useSearchParams()
  const scrollToMessageId = searchParams.get('scrollToMessage')
  const [currentModel, setCurrentModel] = useState('')
  const [nextModel, setNextModel] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const canvasContainerRef = useRef<HTMLDivElement>(null);  // 캔버스 컨테이너 참조 추가
  const [isInitialized, setIsInitialized] = useState(false)
  const initialMessageSentRef = useRef(false)
  const [user, setUser] = useState<any>(null)
  const supabase = createClient()

  const [existingMessages, setExistingMessages] = useState<Message[]>([])
  const [isModelLoading, setIsModelLoading] = useState(true)
  const [isSessionLoaded, setIsSessionLoaded] = useState(false)
  const [rateLimitedLevels, setRateLimitedLevels] = useState<string[]>([])
  const [isAgentEnabled, setisAgentEnabled] = useState(false)
  const [hasAgentModels, setHasAgentModels] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isFullyLoaded = !isModelLoading && isSessionLoaded && !!currentModel
  const prevEditingMessageIdRef = useRef<string | null>(null);
  
  // 활성화된 패널과 관련 메시지 ID 상태 관리
  const [activePanel, setActivePanel] = useState<{ messageId: string; type: 'canvas' | 'structuredResponse' | 'attachment'; fileIndex?: number; toolType?: string; fileName?: string } | null>(null);
  // 사용자가 패널 상태를 명시적으로 제어했는지 추적하는 상태
  const [userPanelPreference, setUserPanelPreference] = useState<boolean | null>(null)
  // 마지막으로 생성된 패널 데이터가 있는 메시지 ID
  const [lastPanelDataMessageId, setLastPanelDataMessageId] = useState<string | null>(null)
  
  const { messages, input, handleInputChange, handleSubmit, isLoading, stop, setMessages, reload } = useChat({
    api: '/api/chat',
    body: {
      id: chatId,
      model: nextModel || getSystemDefaultModelId(),
      chatId,
      experimental_attachments: true,
      isAgentEnabled
    },
    initialMessages: isFullyLoaded ? existingMessages : [],
    onResponse: (response) => {
      // print the last message
      setMessages(prevMessages => {
        const updatedMessages = [...prevMessages]
        for (let i = updatedMessages.length - 1; i >= 0; i--) {
          const message = updatedMessages[i]
          if (message.role === 'assistant' && !(message as ExtendedMessage).model) {
            (message as ExtendedMessage).model = nextModel
            break
          }
        }
        return updatedMessages
      })
    },
    onError: (error: Error & { status?: number }) => {
      let errorData;
      try {
        errorData = error.message ? JSON.parse(error.message) : null;
      } catch (e) {
        // If error is not JSON, try to parse from the raw message
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

      // Check if it's a rate limit error either from status or parsed error data
      if (error.status === 429 || (errorData && (errorData.error === 'Too many requests' || errorData.type === 'rate_limit'))) {
        
        // Extract data from response
        const reset = errorData?.reset || new Date(Date.now() + 60000).toISOString();
        const level = errorData?.level || '';
        const modelId = errorData?.model || nextModel;
        const resetTime = new Date(reset);
        const minutesUntilReset = Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 60000));
        
        // Get detailed rate limit info from RATE_LIMITS configuration
        const rateLimitInfo = RATE_LIMITS[level as keyof typeof RATE_LIMITS] || {
          hourly: { requests: 10, window: '4 h' },
          daily: { requests: 20, window: '24 h' }
        };
        
        // Update rate limit information in localStorage
        if (level) {
          try {
            // Get existing rate limit levels
            let rateLimitLevels = {};
            const existingLevelsStr = localStorage.getItem('rateLimitLevels');
            if (existingLevelsStr) {
              rateLimitLevels = JSON.parse(existingLevelsStr);
            }
            
            // Add or update this level
            rateLimitLevels = {
              ...rateLimitLevels,
              [level]: {
                reset: new Date(reset).getTime(),
                models: MODEL_CONFIGS
                  .filter(m => m.rateLimit.level === level)
                  .map(m => m.id)
              }
            };
            
            // Save to localStorage
            localStorage.setItem('rateLimitLevels', JSON.stringify(rateLimitLevels));
            
            // For backward compatibility
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
        
        // 리다이렉션 대신 메시지 추가
        setMessages(prevMessages => [
          ...prevMessages,
          {
            id: `rate-limit-${Date.now()}`,
            role: 'assistant',
            content: '',
            createdAt: new Date(),
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
                  upgradeUrl: '/pricing'
                }
              }
            ]
          } as Message
        ]);
        
        // 새로운 rate limit 상태 설정
        setRateLimitedLevels(prev => 
          level && !prev.includes(level) ? [...prev, level] : prev
        );
        
        return;
      }

      // Only log non-rate-limit errors
      console.error('Unexpected chat error:', error);
    }
  });

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
  } = useMessages(chatId, user?.id)

  // 특정 메시지로 스크롤하는 함수
  const scrollToMessage = useCallback((messageId: string) => {
    if (!messageId) return;
    
    // 메시지 요소 찾기
    const messageElement = document.getElementById(messageId);
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      // 메시지 강조 효과
      messageElement.classList.add('highlight-message');
      setTimeout(() => {
        messageElement.classList.remove('highlight-message');
      }, 2000);
    }
  }, []);

  // 스타일 추가를 위한 useEffect
  useEffect(() => {
    // 스크롤바 숨기는 스타일을 적용할 스타일시트 추가
    const style = document.createElement('style');
    style.textContent = `
      .scrollbar-minimal::-webkit-scrollbar {
        width: 6px;
        height: 6px;
      }
      .scrollbar-minimal::-webkit-scrollbar-track {
        background: transparent;
      }
      .scrollbar-minimal::-webkit-scrollbar-thumb {
        background: color-mix(in srgb, var(--foreground) 15%, transparent);
        border-radius: 3px;
        transition: background 0.2s ease;
      }
      .scrollbar-minimal::-webkit-scrollbar-thumb:hover {
        background: color-mix(in srgb, var(--foreground) 25%, transparent);
      }
      .scrollbar-minimal {
        scrollbar-width: thin;
        scrollbar-color: color-mix(in srgb, var(--foreground) 15%, transparent) transparent;
      }
      .scrollbar-minimal:hover {
        scrollbar-color: color-mix(in srgb, var(--foreground) 25%, transparent) transparent;
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // URL 쿼리 파라미터로 지정된 메시지로 스크롤
  useEffect(() => {
    if (scrollToMessageId && messages.length > 0) {
      // 모든 메시지가 렌더링된 후 스크롤하기 위해 짧은 지연 추가
      setTimeout(() => {
        scrollToMessage(scrollToMessageId);
        
        // 스크롤 작업 후 URL에서 쿼리 파라미터 제거
        if (typeof window !== 'undefined') {
          const url = new URL(window.location.href);
          url.searchParams.delete('scrollToMessage');
          window.history.replaceState({}, '', url.pathname);
        }
      }, 500);
    }
  }, [scrollToMessageId, messages.length, scrollToMessage]);

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
        
        // 사용자의 기본 모델 가져오기
        const defaultModel = await getDefaultModelId(user.id)
        setCurrentModel(defaultModel)
        setNextModel(defaultModel)
      } catch (error) {
        console.error('사용자 정보 또는 모델 로딩 중 오류:', error)
        // 오류 발생 시 시스템 기본 모델 사용
        const systemDefault = getSystemDefaultModelId()
        setCurrentModel(systemDefault)
        setNextModel(systemDefault)
      } finally {
        setIsModelLoading(false)
      }
    }
    getUser()
  }, [supabase.auth, router])

  useEffect(() => {
    let isMounted = true

    async function initialize() {
      if (initialMessageSentRef.current || !user) return
      
      try {
        setIsModelLoading(true)
        setIsSessionLoaded(false)
        
        // First check URL query parameter for Agent setting
        if (isMounted && typeof window !== 'undefined') {
          
          const urlParams = new URLSearchParams(window.location.search);
          const AgentSearchParam = urlParams.get('Agent');
          
          let shouldEnableAgent = false;
          
          if (AgentSearchParam === 'true') {
            shouldEnableAgent = true;
            // Also update localStorage for persistence
            localStorage.setItem(`Agent_${chatId}`, 'true');
            
            // Clean up URL by removing the query parameter
            const newUrl = window.location.pathname;
            window.history.replaceState({}, document.title, newUrl);
          } else {
            // If not in URL, check localStorage as fallback
            const savedAgentState = localStorage.getItem(`Agent_${chatId}`);
            
            if (savedAgentState === 'true') {
              shouldEnableAgent = true;
            } else {
            }
          }
          
          // Update state synchronously before proceeding
          setisAgentEnabled(shouldEnableAgent);
          
          // Fetch session and messages in parallel
          const sessionPromise = supabase
            .from('chat_sessions')
            .select('current_model, initial_message')
            .eq('id', chatId)
            .eq('user_id', user.id)
            .single();
            
          const messagesPromise = supabase
            .from('messages')
            .select('*')
            .eq('chat_session_id', chatId)
            .eq('user_id', user.id)
            .order('sequence_number', { ascending: true });
            
          // Wait for both promises to resolve
          const [sessionResult, messagesResult] = await Promise.all([
            sessionPromise,
            messagesPromise
          ]);
          
          const { data: session, error: sessionError } = sessionResult;
          const { data: existingMessages, error: messagesError } = messagesResult;

          if (sessionError || !session) {
            console.error('Session error:', sessionError)
            router.push('/')
            return
          }

          // 세션에 저장된 모델이 있으면 사용, 없으면 사용자의 기본 모델 사용
          if (session.current_model && isMounted) {
            setCurrentModel(session.current_model)
            setNextModel(session.current_model)
          } else if (isMounted) {
            // 세션에 모델이 없는 경우 사용자의 기본 모델 가져오기
            const userDefaultModel = await getDefaultModelId(user.id)
            setCurrentModel(userDefaultModel)
            setNextModel(userDefaultModel)
            
            // 세션 업데이트
            await supabase
              .from('chat_sessions')
              .update({ current_model: userDefaultModel })
              .eq('id', chatId)
              .eq('user_id', user.id)
          }

          if (messagesError) {
            console.error('Failed to load messages:', messagesError)
            return
          }

          if (existingMessages?.length > 0 && isMounted) {
            const sortedMessages = existingMessages
              .map(convertMessage)
              .sort((a: any, b: any) => {
                const seqA = (a as any).sequence_number || 0
                const seqB = (b as any).sequence_number || 0
                return seqA - seqB
              })
            setExistingMessages(sortedMessages)
            setMessages(sortedMessages)
            setIsInitialized(true)

            if (sortedMessages.length === 1 && sortedMessages[0].role === 'user') {
              
              // Only reload if we don't have an assistant message yet (fresh conversation)
              // This prevents unnecessary API calls when refreshing a page with existing conversation
              reload({
                body: {
                  model: session.current_model || currentModel,
                  chatId,
                  messages: sortedMessages,
                  isAgentEnabled: shouldEnableAgent
                }
              });
            }
          } else if (session.initial_message && isMounted) {
            // Only create initial message if there are no existing messages
            const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            
            // Start the API request immediately before updating the database
            const initialMessage = {
              id: messageId,
              content: session.initial_message,
              role: 'user' as const,
              createdAt: new Date()
            };
            
            setMessages([initialMessage]);
            
            // Start API request immediately (don't wait for DB update)
            reload({
              body: {
                model: session.current_model,
                chatId,
                messages: [initialMessage],
                isAgentEnabled: shouldEnableAgent
              }
            });
            
            // In parallel, save the message to the database - but we know the chat session already exists
            // since we're on the chat page and fetched the session successfully
            Promise.resolve().then(async () => {
              try {
                // Verify the session exists before inserting message
                const { error: checkSessionError } = await supabase
                  .from('chat_sessions')
                  .select('id')
                  .eq('id', chatId)
                  .eq('user_id', user.id)
                  .single();
                  
                if (checkSessionError) {
                  console.error('Session not found when saving initial message:', checkSessionError);
                  return;
                }
                
                await supabase.from('messages').insert([{
                  id: messageId,
                  content: session.initial_message,
                  role: 'user',
                  created_at: new Date().toISOString(),
                  model: session.current_model,
                  host: 'user',
                  chat_session_id: chatId,
                  user_id: user.id
                }]);
                
                initialMessageSentRef.current = true;
                setIsInitialized(true);
              } catch (error: any) {
                console.error('Failed to save initial message:', error);
              }
            });
          }
        }
      } catch (error) {
        console.error('Error in initialization:', error)
        if (isMounted) {
          router.push('/')
        }
      } finally {
        if (isMounted) {
          setIsModelLoading(false)
          setIsSessionLoaded(true)
        }
      }
    }

    initialize()

    return () => {
      isMounted = false
    }
  }, [chatId, user])

  useEffect(() => {
    if (!isInitialized || !user) return

    const channelSuffix = Date.now() + Math.random().toString(36).substr(2, 9);
    
    const channel = supabase
      .channel(`chat-messages-${chatId}-${channelSuffix}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `chat_session_id=eq.${chatId} AND user_id=eq.${user.id}`
        },
        async (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const { data: allMessages, error } = await supabase
              .from('messages')
              .select('*')
              .eq('chat_session_id', chatId)
              .eq('user_id', user.id)
              .order('sequence_number', { ascending: true })

            if (!error && allMessages) {
              const hasSequenceGap = allMessages.some((msg, index) => {
                if (index === 0) return false
                return allMessages[index].sequence_number - allMessages[index - 1].sequence_number > 1
              })

              if (hasSequenceGap) {
                const lastMessage = allMessages[allMessages.length - 1]
                if (lastMessage?.role === 'assistant') {
                  await supabase
                    .from('messages')
                    .delete()
                    .eq('id', lastMessage.id)
                    .eq('user_id', user.id)
                
                  setMessages(allMessages.slice(0, -1).map(convertMessage))
                  return
                }
              }

              setMessages(allMessages.map(convertMessage))
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [chatId, setMessages, isInitialized, user?.id])

  // Check for rate limited levels from localStorage
  useEffect(() => {
    // Only run on client side
    if (typeof window !== 'undefined') {
      try {
        // Check for multiple rate limited levels
        const rateLimitLevelsStr = localStorage.getItem('rateLimitLevels')
        if (rateLimitLevelsStr) {
          const levelsData = JSON.parse(rateLimitLevelsStr)
          const currentTime = Date.now()
          
          // Filter out expired levels and collect valid ones
          const validLevels = Object.entries(levelsData)
            .filter(([_, data]: [string, any]) => data?.reset > currentTime)
            .map(([level, _]: [string, any]) => level)
          
          if (validLevels.length > 0) {
            setRateLimitedLevels(validLevels)
            
            // If current model is rate limited, switch to a different model
            if (currentModel) {
              const currentModelConfig = MODEL_CONFIGS.find(m => m.id === currentModel)
              if (currentModelConfig?.rateLimit?.level && validLevels.includes(currentModelConfig.rateLimit.level)) {
                // Find a model from a different level that's not rate limited
                const alternativeModel = MODEL_CONFIGS.find(m => 
                  m.isEnabled && !validLevels.includes(m.rateLimit?.level || '')
                )
                if (alternativeModel) {
                  setNextModel(alternativeModel.id)
                }
              }
            }
          } else {
            // All rate limits have expired, remove the data
            localStorage.removeItem('rateLimitLevels')
          }
        } else {
          // For backward compatibility, check the old format
          const rateLimitInfoStr = localStorage.getItem('rateLimitInfo')
          if (rateLimitInfoStr) {
            const rateLimitInfo = JSON.parse(rateLimitInfoStr)
            
            // Check if the rate limit is still valid
            if (rateLimitInfo.reset > Date.now()) {
              setRateLimitedLevels([rateLimitInfo.level])
              
              // If current model is rate limited, switch to a different model
              if (currentModel) {
                const currentModelConfig = MODEL_CONFIGS.find(m => m.id === currentModel)
                if (currentModelConfig && currentModelConfig.rateLimit.level === rateLimitInfo.level) {
                  // Find a model from a different level
                  const alternativeModel = MODEL_CONFIGS.find(m => 
                    m.isEnabled && m.rateLimit.level !== rateLimitInfo.level
                  )
                  if (alternativeModel) {
                    setNextModel(alternativeModel.id)
                  }
                }
              }
            } else {
              // Rate limit has expired, remove it
              localStorage.removeItem('rateLimitInfo')
            }
          }
        }
      } catch (error) {
        console.error('Error parsing rate limit info:', error)
      }
    }
  }, [currentModel])

  // Stable scroll management
  useEffect(() => {
    if (!messagesEndRef.current) return;
  
    const wasEditingAndCanceled = 
      prevEditingMessageIdRef.current !== null && 
      editingMessageId === null && 
      !isLoading && 
      !isRegenerating;
  
    if (wasEditingAndCanceled) {
      // Do nothing, keep scroll position
      return;
    }
  
    const shouldScroll = 
      isLoading || 
      isRegenerating ||
      (isInitialized && messages.length > 0 && editingMessageId === null);

    if (shouldScroll) {
      // 페이지 첫 로드나 세션 로드 시에는 instant로, 실시간 채팅 중에는 smooth로
      const isPageLoad = !isInitialized || !isFullyLoaded;
      const isRealTimeChat = isInitialized && isFullyLoaded && (isLoading || isRegenerating);
      
      setTimeout(() => {
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ 
            behavior: isPageLoad ? 'instant' : (isRealTimeChat ? 'smooth' : 'instant')
          });
        }
      }, isPageLoad ? 0 : (isRealTimeChat ? 100 : 0));
    }
  }, [messages.length, isLoading, isRegenerating, isInitialized, editingMessageId, isFullyLoaded]);

  // Update previous editing state after all effects have run
  useEffect(() => {
    prevEditingMessageIdRef.current = editingMessageId;
  }, [editingMessageId]);

  const handleModelChange = async (newModel: string) => {
    try {
      // Check if the selected model is in a rate-limited level
      if (rateLimitedLevels.length > 0) {
        const modelConfig = MODEL_CONFIGS.find(m => m.id === newModel)
        if (modelConfig && rateLimitedLevels.includes(modelConfig.rateLimit.level)) {
          // Don't allow changing to a rate-limited model
          console.warn('Cannot change to a rate-limited model')
          return false
        }
      }

      const { error: sessionError } = await supabase
        .from('chat_sessions')
        .update({ current_model: newModel })
        .eq('id', chatId)

      if (sessionError) {
        console.error('Failed to update model:', sessionError)
        return false
      }

      setCurrentModel(newModel)
      setNextModel(newModel)
      return true
    } catch (error) {
      console.error('Failed to update model:', error)
      return false
    }
  }

  const handleModelSubmit = useCallback(async (e: React.FormEvent, files?: FileList) => {
    e.preventDefault();
    
    if (nextModel !== currentModel) {
      const success = await handleModelChange(nextModel)
      if (!success) {
        console.error('Failed to update model. Aborting message submission.')
        return
      }
    }

    let attachments: Attachment[] = []
    if (files?.length) {
      try {
        const uploadPromises = Array.from(files).map(file => uploadFile(file))
        attachments = await Promise.all(uploadPromises)
      } catch (error) {
        console.error('Failed to upload files:', error)
        // 파일 업로드 실패 시에도 텍스트가 있으면 전송 계속
        if (!input?.trim()) {
          console.error('No text content and file upload failed. Aborting message submission.')
          return
        }
        console.warn('File upload failed, proceeding with text-only message')
        attachments = []
      }
    }

    const messageContent = []
    if (input) {
      messageContent.push({
        type: 'text',
        text: input
      })
    }
    
    if (attachments.length > 0) {
      attachments.forEach(attachment => {
        if (attachment.contentType?.startsWith('image/')) {
          messageContent.push({
            type: 'image',
            image: attachment.url
          })
        } else if (attachment.contentType?.includes('text') || 
                  (attachment.name && /\.(js|jsx|ts|tsx|html|css|json|md|py|java|c|cpp|cs|go|rb|php|swift|kt|rs)$/i.test(attachment.name))) {
          messageContent.push({
            type: 'text_file',
            file_url: attachment.url,
            file_name: attachment.name
          })
        }
      })
    }

    // Save message to Supabase first
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // Get the latest sequence number
    const { data: currentMax } = await supabase
      .from('messages')
      .select('sequence_number')
      .eq('chat_session_id', chatId)
      .eq('user_id', user?.id)
      .order('sequence_number', { ascending: false })
      .limit(1)
      .single()

    const sequence = (currentMax?.sequence_number || 0) + 1

    // Extract only text content for the content field
    const textContent = messageContent.length === 1 ? 
      messageContent[0].text : 
      messageContent.filter(part => part.type === 'text')
                   .map(part => part.text)
                   .join(' ');

    // Update Agent setting in localStorage instead of database
    if (typeof window !== 'undefined') {
      if (isAgentEnabled) {
        localStorage.setItem(`Agent_${chatId}`, 'true');
      } else {
        localStorage.removeItem(`Agent_${chatId}`);
      }
    }

    const { error: messageError } = await supabase
      .from('messages')
      .insert([{
        id: messageId,
        content: textContent, // Save only text content
        role: 'user',
        created_at: new Date().toISOString(),
        model: nextModel,
        host: 'user',
        chat_session_id: chatId,
        user_id: user?.id,
        experimental_attachments: attachments,
        sequence_number: sequence
      }])

    if (messageError) {
      console.error('Failed to save message:', messageError)
      return
    }

    // Only call API without saving to database
    await handleSubmit(e, {
      body: {
        model: nextModel,
        chatId,
        messages: [
          ...messages,
          {
            id: messageId,
            role: 'user',
            content: textContent,
            experimental_attachments: attachments
          }
        ],
        saveToDb: false, // Add flag to prevent saving in API
        isAgentEnabled
      },
      experimental_attachments: attachments
    })

  }, [nextModel, currentModel, chatId, handleSubmit, input, messages, user?.id, isAgentEnabled])

  const handleStop = useCallback(async () => {
    try {
      stop()

      const lastMessage = messages[messages.length - 1]
      if (lastMessage?.role === 'assistant') {
        const { data: messageData } = await supabase
          .from('messages')
          .select('id')
          .eq('chat_session_id', chatId)
          .eq('user_id', user.id)
          .eq('role', 'assistant')
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (messageData) {
          await supabase
            .from('messages')
            .update({
              content: lastMessage.content ,
              reasoning: lastMessage.parts?.find(part => part.type === 'reasoning')?.reasoning || null,
              model: currentModel,
              created_at: new Date().toISOString()
            })
            .eq('id', messageData.id)
            .eq('user_id', user.id)

          setMessages(prevMessages => {
            const updatedMessages = [...prevMessages]
            const lastIndex = updatedMessages.length - 1
            if (lastIndex >= 0 && updatedMessages[lastIndex].role === 'assistant') {
              updatedMessages[lastIndex] = {
                ...updatedMessages[lastIndex],
                content: lastMessage.content,
                parts: lastMessage.parts
              }
            }
            return updatedMessages
          })
        }
      }
    } catch (error) {
      console.error('Error in handleStop:', error)
    }
  }, [stop, messages, currentModel, chatId, user?.id, setMessages])

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

  // Add a handler for follow-up question clicks
  const handleFollowUpQuestionClick = async (question: string) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    
    try {
      // Skip updating the input value first and go straight to submission
      
      // Create a message ID for the new message
      const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 15)}`;
      
      // Get the latest sequence number first
      const { data: currentMax } = await supabase
        .from('messages')
        .select('sequence_number')
        .eq('chat_session_id', chatId)
        .eq('user_id', user.id)
        .order('sequence_number', { ascending: false })
        .limit(1)
        .single();

      const sequence = (currentMax?.sequence_number || 0) + 1;
      
      // Add the question to the message list directly
      const newMessage = {
        id: messageId,
        content: question,
        role: 'user',
        createdAt: new Date(),
        sequence_number: sequence
      } as Message;
      
      // Add to UI messages right away
      setMessages(prev => [...prev, newMessage]);
      
      // Save to database with sequence number
      await supabase
        .from('messages')
        .insert([{
          id: messageId,
          content: question,
          role: 'user',
          created_at: new Date().toISOString(),
          model: nextModel,
          host: 'user',
          chat_session_id: chatId,
          user_id: user.id,
          sequence_number: sequence
        }]);
      
      // Trigger the AI response via the chat API
      reload({
        body: {
          model: nextModel,
          chatId,
          experimental_attachments: [],
          isAgentEnabled,
          messages: [...messages, newMessage]
        }
      });
    } catch (error) {
      console.error('Error submitting follow-up question:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 개선된 로딩 상태 확인 함수
  const isWaitingForToolResults = (message: Message) => {
    // 어시스턴트 메시지이고 마지막 메시지이면 로딩 중 체크
    if (message.role === 'assistant' && isLoading && message.id === messages[messages.length - 1]?.id) {
      // 메시지 파트를 확인하여 reasoning 완료 여부 판단
      if (message.parts) {
        const hasReasoning = message.parts.some((part: any) => part.type === 'reasoning');
        const hasText = message.parts.some((part: any) => part.type === 'text');
        
        // 텍스트 부분이 있으면 reasoning은 완료된 것으로 간주
        if (hasReasoning && hasText) {
          // 텍스트가 있으면 여전히 스트리밍 중이지만 더 이상 로딩 표시 필요 없음
          return false;
        }
      }
      
      // 완료를 나타내는 최종 구조화된 응답이 있는지 확인
      const annotations = (message.annotations || []) as Annotation[];
      const hasStructuredResponse = annotations.some(a => a?.type === 'structured_response');
      
      // 구조화된 응답이 없으면 계속 로딩 중
      return !hasStructuredResponse;
    }
    
    return false;
  };


  // 패널 토글 함수 - 사용자 선호도 기록
  const togglePanel = (messageId: string, type: 'canvas' | 'structuredResponse' | 'attachment', fileIndex?: number, toolType?: string, fileName?: string) => {
    if (activePanel?.messageId === messageId && activePanel.type === type && activePanel?.fileIndex === fileIndex && activePanel?.toolType === toolType) {
      setActivePanel(null);
      setUserPanelPreference(false);
    } else {
      setActivePanel({ messageId, type, fileIndex, toolType, fileName });
      setUserPanelPreference(true);
    }
  };

  // Enhanced message submission with stable scroll behavior
  const handleModelSubmitWithReset = useCallback(async (e: React.FormEvent, files?: FileList) => {
    // 패널 상태 선호도 초기화 - 새 데이터에 대해 자동 표시 허용
    setUserPanelPreference(null);
    
    // Ensure consistent scroll behavior for all submission types
    // The scroll will be handled by the useEffect that watches isLoading
    
    // 기존 handleModelSubmit 호출
    await handleModelSubmit(e, files);
  }, [handleModelSubmit]);

  // 해당 메시지에 캔버스 데이터가 있는지 확인하는 함수
  const hasCanvasData = (message: Message) => {
    // StructuredResponse에 데이터가 있는지 확인
    const hasStructuredResponseFiles = () => {
      // 1. annotations에서 확인
      const annotations = message.annotations as Annotation[] | undefined;
      const structuredResponseAnnotation = annotations?.find(
        (annotation) => annotation?.type === 'structured_response'
      );
      
      if (structuredResponseAnnotation?.data?.response?.files?.length > 0) {
        return true;
      }
      
      // 2. tool_results에서 확인
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const toolResults = (message as any).tool_results;
      if (toolResults?.structuredResponse?.response?.files?.length > 0) {
        return true;
      }
      
      // 3. 진행 중인 응답 확인
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

    // Check if webSearchData exists and has content
    const webSearchData = getWebSearchResults(message);
    const hasWebSearchData = !!webSearchData && (
      // Check for results array (new format)
      (webSearchData.results && webSearchData.results.length > 0) ||
      // Check for legacy result object
      (webSearchData.result && (webSearchData.result as any)?.searches && (webSearchData.result as any).searches.length > 0)
    );

    return !!(
      hasWebSearchData || 
      getMathCalculationData(message) || 
      getLinkReaderData(message) || 
      getImageGeneratorData(message) || 
      getAcademicSearchData(message) || 
      // getXSearchData(message) || 
      getYouTubeSearchData(message) || 
      getYouTubeLinkAnalysisData(message) || 
      hasStructuredResponseFiles()
    );
  };
  // 새 메시지가 추가되거나 메시지 내용이 변경될 때 패널 데이터 업데이트
  useEffect(() => {
    // 마지막 어시스턴트 메시지 찾기
    const lastAssistantMessages = messages.filter(msg => msg.role === 'assistant');
    if (lastAssistantMessages.length === 0) return;
    
    const lastAssistantMessage = lastAssistantMessages[lastAssistantMessages.length - 1];
    
    // 마지막 메시지에 패널 데이터가 있는지 확인
    if (hasCanvasData(lastAssistantMessage)) {
      // 이 메시지가 새 패널 데이터를 가진 메시지인지 확인
      if (lastPanelDataMessageId !== lastAssistantMessage.id) {
        setLastPanelDataMessageId(lastAssistantMessage.id);
        
        // 패널 자동 열기 규칙:
        // 사용자가 명시적으로 패널 열기를 선택한 경우에만 열기
        if (userPanelPreference === true) {
          // 이미 활성화된 패널이 있고 같은 메시지라면 패널 타입 유지
          if (activePanel?.messageId === lastAssistantMessage.id) {
            // 같은 메시지의 패널이 이미 열려있으면 타입과 기타 정보 유지
            return;
          }
          // 새로운 메시지면 canvas 패널로 열기
          togglePanel(lastAssistantMessage.id, 'canvas');
        }
      }
    }
  }, [
    messages.length, // 메시지 수만 체크
    messages[messages.length - 1]?.id, // 마지막 메시지 ID만 체크
    userPanelPreference, 
    lastPanelDataMessageId
  ]);

  // 모든 데이터가 로드되기 전에는 로딩 화면 표시
  if (!isFullyLoaded || !user) {
    return <div className="flex h-screen items-center justify-center"></div>
  }

  return (
    <main className="flex-1 relative h-screen flex flex-col">
      {/* Header is positioned fixed, so content area starts from the top */}
      <div className="flex-1 pt-[60px] flex flex-col min-h-0">
        {/* 주 컨텐츠 영역 - Mobile/Desktop Responsive */}
        {/* Mobile Layout */}
        <div className="flex flex-col sm:hidden min-h-0 flex-1">
          <div className="overflow-y-auto pb-44 flex-1 scrollbar-minimal" ref={messagesContainerRef}>
            <Messages
              messages={messages}
              currentModel={currentModel}
              isRegenerating={isRegenerating}
              editingMessageId={editingMessageId}
              editingContent={editingContent}
              copiedMessageId={copiedMessageId}
              onRegenerate={(messageId: string) => handleRegenerate(messageId, messages, setMessages, currentModel, reload)}
              onCopy={handleCopyMessage}
              onEditStart={handleEditStart}
              onEditCancel={handleEditCancel}
              onEditSave={(messageId: string, files?: globalThis.File[], remainingAttachments?: any[]) => handleEditSave(messageId, currentModel, messages, setMessages, reload, files, remainingAttachments)}
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
          <PanelGroup direction="horizontal" className="flex-1">
            <Panel defaultSize={100} minSize={20} className="flex flex-col">
              <div className="overflow-y-auto pb-44 flex-1 scrollbar-minimal" ref={messagesContainerRef}>
                <div className={`${activePanel?.messageId ? 'max-w-none' : 'w-full mx-auto'}`}>
                  <Messages
                    messages={messages}
                    currentModel={currentModel}
                    isRegenerating={isRegenerating}
                    editingMessageId={editingMessageId}
                    editingContent={editingContent}
                    copiedMessageId={copiedMessageId}
                    onRegenerate={(messageId: string) => handleRegenerate(messageId, messages, setMessages, currentModel, reload)}
                    onCopy={handleCopyMessage}
                    onEditStart={handleEditStart}
                    onEditCancel={handleEditCancel}
                    onEditSave={(messageId: string, files?: globalThis.File[], remainingAttachments?: any[]) => handleEditSave(messageId, currentModel, messages, setMessages, reload, files, remainingAttachments)}
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
                  />
                </div>
              </div>
            </Panel>
            {activePanel?.messageId && (
              <>
                <PanelResizeHandle className="group relative flex w-5 cursor-col-resize items-center justify-center focus:outline-none">
                  {/* Handle */}
                  <div className="h-14 w-[8px] rounded-full bg-[var(--accent)] transition-colors group-hover:bg-[var(--muted)]" />
                </PanelResizeHandle>
                <Panel defaultSize={50} minSize={20} className="flex flex-col">
                  <SidePanel
                    activePanel={activePanel}
                    messages={messages}
                    togglePanel={togglePanel}
                    canvasContainerRef={canvasContainerRef}
                  />
                </Panel>
              </>
            )}
          </PanelGroup>
        </div>
      </div>

      <ChatInputArea
        currentModel={currentModel}
        nextModel={nextModel}
        setNextModel={setNextModel}
        setCurrentModel={setCurrentModel}
        disabledLevels={rateLimitedLevels}
        isAgentEnabled={isAgentEnabled}
        onAgentAvailabilityChange={setHasAgentModels}
        setisAgentEnabled={setAgentEnabledHandler}
        input={input}
        handleInputChange={handleInputChange}
        handleSubmit={handleModelSubmitWithReset}
        isLoading={isLoading}
        stop={handleStop}
        user={{...user, hasAgentModels}}
        modelId={nextModel}
        allMessages={messages}
      />
    </main>
  )
} 