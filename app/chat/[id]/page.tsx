'use client'

import { useChat } from '@ai-sdk/react';
import { Message } from 'ai'
import { useState, useEffect, use, useRef, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { ModelSelector } from '../../components/ModelSelector'
import { Header } from '../../components/Header'
import { Sidebar } from '../../components/Sidebar'
import { convertMessage, uploadFile } from './utils'
import { PageProps, ExtendedMessage } from './types'
import { Attachment } from '@/lib/types'
import { useMessages } from '@/app/hooks/useMessages'
import { getDefaultModelId, getSystemDefaultModelId, MODEL_CONFIGS } from '@/lib/models/config'
import '@/app/styles/attachments.css'
import '@/app/styles/loading-dots.css'
import { Message as MessageComponent } from '@/app/components/Message'
import { ChatInput } from '@/app/components/ChatInput/index';
import Canvas from '@/app/components/Canvas';
import { FollowUpQuestions } from '@/app/components/FollowUpQuestions';
import { getYouTubeLinkAnalysisData, getYouTubeSearchData, getXSearchData, getWebSearchResults, getMathCalculationData, getLinkReaderData, getImageGeneratorData, getAcademicSearchData } from '@/app/hooks/toolFunction';
import { StructuredResponse } from '@/app/components/StructuredResponse';
import { Annotation, File, getStructuredResponseFiles } from '@/app/lib/messageUtils';

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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [existingMessages, setExistingMessages] = useState<Message[]>([])
  const [isModelLoading, setIsModelLoading] = useState(true)
  const [isSessionLoaded, setIsSessionLoaded] = useState(false)
  const [rateLimitedLevels, setRateLimitedLevels] = useState<string[]>([])
  const [isAgentEnabled, setisAgentEnabled] = useState(false)
  const [hasAgentModels, setHasAgentModels] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isFullyLoaded = !isModelLoading && isSessionLoaded && !!currentModel
  const summaryAttemptedRef = useRef(false); // 요약 시도 여부 플래그
  const prevIsLoadingRef = useRef(false); // 이전 isLoading 상태 추적
  
  // 활성화된 패널과 관련 메시지 ID 상태 관리
  const [activePanel, setActivePanel] = useState<{ messageId: string; type: 'canvas' | 'structuredResponse' } | null>(null);
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
        console.log('[Debug] Rate limit error detected:', errorData);
        
        // Extract data from response
        const reset = errorData?.reset || new Date(Date.now() + 60000).toISOString();
        const limit = errorData?.limit || 10;
        const level = errorData?.level || '';
        const modelId = errorData?.model || nextModel;
        const resetTime = new Date(reset);
        const minutesUntilReset = Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 60000));
        
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
                  message: `Rate limit reached. Try again in ${minutesUntilReset} minute${minutesUntilReset > 1 ? 's' : ''}, switch to a different model, or`,
                  reset: reset,
                  limit: limit,
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

  // Check if conversation exceeds maximum length
  const isConversationTooLong = useMemo(() => {
    return messages.length > 30;
  }, [messages.length]);

  // Determine whether to use virtualization based on message count
  // const useVirtualization = useMemo(() => {
  //   if (typeof window !== 'undefined' && window.innerWidth < 768) {
  //     return messages.length > 10;
  //   }
  //   return messages.length > 20;
  // }, [messages.length]);

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

  // 스크롤 함수 개선 - 채팅과 캔버스 모두 스크롤
  const scrollToBottom = useCallback(() => {
    // if (virtuosoRef.current) {
    //   virtuosoRef.current.scrollToIndex({
    //     index: messages.length - 1,
    //     behavior: 'smooth'
    //   });
    // } else if (messagesEndRef.current) {
    //   messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
    // }
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
    }
    
    // 캔버스도 맨 아래로 스크롤
    if (canvasContainerRef.current) {
      canvasContainerRef.current.scrollTop = canvasContainerRef.current.scrollHeight;
    }
  }, [messages.length]);

  // 특정 메시지로 스크롤하는 함수 개선 - 캔버스 동기화
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
      
      // 관련 캔버스 요소 찾기 및 스크롤
      const canvasElement = document.getElementById(`canvas-${messageId}`);
      if (canvasElement && canvasContainerRef.current) {
        canvasContainerRef.current.scrollTo({
          top: canvasElement.offsetTop - 20,
          behavior: 'smooth'
        });
      }
    }
  }, []);

  // 스크롤바 숨기는 CSS 클래스를 추가
  const hideScrollbarClass = "scrollbar-hide";

  // 스타일 추가를 위한 useEffect
  useEffect(() => {
    // 스크롤바 숨기는 스타일을 적용할 스타일시트 추가
    const style = document.createElement('style');
    style.textContent = `
      .scrollbar-hide::-webkit-scrollbar {
        display: none;
      }
      .scrollbar-hide {
        -ms-overflow-style: none;
        scrollbar-width: none;
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
        console.log('user', user)
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
          // console.log('[Debug] Chat page - Checking Agent settings for chatId:', chatId);
          
          const urlParams = new URLSearchParams(window.location.search);
          const AgentSearchParam = urlParams.get('Agent');
          // console.log('[Debug] Chat page - URL Agent parameter:', AgentSearchParam);
          
          let shouldEnableAgent = false;
          
          if (AgentSearchParam === 'true') {
            // console.log('[Debug] Chat page - Setting Agent enabled from URL parameter');
            shouldEnableAgent = true;
            // Also update localStorage for persistence
            localStorage.setItem(`Agent_${chatId}`, 'true');
            
            // Clean up URL by removing the query parameter
            const newUrl = window.location.pathname;
            window.history.replaceState({}, document.title, newUrl);
            // console.log('[Debug] Chat page - Cleaned up URL, removed query parameter');
          } else {
            // If not in URL, check localStorage as fallback
            const savedAgentState = localStorage.getItem(`Agent_${chatId}`);
            // console.log('[Debug] Chat page - localStorage Agent state:', savedAgentState);
            
            if (savedAgentState === 'true') {
              // console.log('[Debug] Chat page - Setting Agent enabled from localStorage');
              shouldEnableAgent = true;
            } else {
              // console.log('[Debug] Chat page - Agent is disabled');
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
              // console.log('[Debug] Chat page - Reloading with initial message, Agent:', shouldEnableAgent);
              
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
            // console.log('[Debug] Chat page - Creating initial message, Agent:', shouldEnableAgent);
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

    const channel = supabase
      .channel('chat-messages')
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
  }, [chatId, setMessages, isInitialized])

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

  // Add back initialization scroll effect only
  useEffect(() => {
    if (isInitialized && isFullyLoaded) {
      scrollToBottom();
    }
  }, [isInitialized, isFullyLoaded, scrollToBottom]);

  // 활성화된 패널이 변경될 때 캔버스 패널 스크롤
  useEffect(() => {
    // 캔버스가 아닐 때만 자동 스크롤 동작
    if (
      activePanel?.messageId &&
      activePanel.type !== 'canvas' &&
      canvasContainerRef.current
    ) {
      setTimeout(() => {
        if (!canvasContainerRef.current) return;
        // 관련 캔버스 요소 찾기 및 스크롤
        const canvasElement = document.getElementById(`canvas-${activePanel.messageId}`);
        if (canvasElement) {
          canvasContainerRef.current.scrollTo({
            top: canvasElement.offsetTop - 20,
            behavior: 'smooth'
          });
        } else {
          // 요소가 없으면 맨 아래로 스크롤
          canvasContainerRef.current.scrollTop = canvasContainerRef.current.scrollHeight;
        }
      }, 100);
    }
  }, [activePanel]);


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
    
    // 디버깅: 폼 제출 시 웹 검색 상태 출력
    // console.log('[Debug] Chat page - handleModelSubmit called with Agent:', isAgentEnabled);
    
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
        console.log('[Debug] Uploaded attachments:', attachments)
      } catch (error) {
        console.error('Failed to upload files:', error)
        return
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
      console.log('[Debug] Directly submitting follow-up question:', question);
      
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
  const togglePanel = (messageId: string, type: 'canvas' | 'structuredResponse') => {
    if (activePanel?.messageId === messageId && activePanel?.type === type) {
      setActivePanel(null);
      setUserPanelPreference(false);
    } else {
      setActivePanel({ messageId, type });
      setUserPanelPreference(true);
    }
  };

  // 사용자가 새로운 메시지를 전송할 때 스크롤 플래그 재설정
  const handleModelSubmitWithReset = useCallback(async (e: React.FormEvent, files?: FileList) => {
    // 패널 상태 선호도 초기화 - 새 데이터에 대해 자동 표시 허용
    setUserPanelPreference(null);
    
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
    // 모바일 환경 여부 확인
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
    
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
          // 패널 열기
          togglePanel(lastAssistantMessage.id, 'canvas');
        }
      }
    }
  }, [messages, userPanelPreference, lastPanelDataMessageId]);

  // LLM 요약 effect: 첫 user+assistant 메시지 쌍이 모두 있고, 스트리밍이 완료되었을 때만 동작
  useEffect(() => {
    // isLoading이 true에서 false로 막 변경된 시점인지 확인
    const justFinishedLoading = prevIsLoadingRef.current && !isLoading;
    prevIsLoadingRef.current = isLoading; // 현재 isLoading 상태를 다음 실행을 위해 저장

    if (
      !chatId ||
      !user ||
      !messages ||
      messages.length < 2 ||
      summaryAttemptedRef.current // 이미 요약 시도했으면 중단
    ) {
      return;
    }

    // 로딩이 방금 끝난 경우에만 요약 로직 진행
    if (!justFinishedLoading) {
      return;
    }

    const firstUserMsg = messages.find(m => m.role === 'user');
    const firstAssistantMsg = messages.find(m => m.role === 'assistant');

    // 첫 사용자 메시지, 첫 어시스턴트 메시지, 그리고 어시스턴트 메시지 내용이 모두 있어야 함
    if (!firstUserMsg || !firstAssistantMsg || !firstAssistantMsg.content || firstAssistantMsg.content.trim() === '') {
      return;
    }

    // 이 시점에서 isLoading은 false이고 justFinishedLoading이 true이므로,
    // firstAssistantMsg.content는 완전한 상태여야 합니다.
    // 요약 시도 플래그를 true로 설정
    summaryAttemptedRef.current = true;

    (async () => {
      try {
        const { data: session, error: sessionError } = await supabase
          .from('chat_sessions')
          .select('title')
          .eq('id', chatId)
          .eq('user_id', user.id)
          .single();

        if (sessionError) {
          console.error('Error fetching session for summary check:', sessionError);
          summaryAttemptedRef.current = false; // 세션 조회 실패 시, 다음 effect 실행에서 재시도 허용
          return;
        }

        if (session && session.title && session.title.trim().length > 0 && session.title !== 'New Chat') {
          console.log('Title already exists, skipping summary.');
          return;
        }

        const summaryInput = `User: ${firstUserMsg.content}\nAssistant: ${firstAssistantMsg.content}`;
        console.log('[Debug] Attempting to summarize (Agent aware) with FULL input:', summaryInput);
        const res = await fetch('/api/chat/summarize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: summaryInput })
        });

        if (res.ok) {
          const data = await res.json();
          if (data.summary) {
            const { error: updateError } = await supabase
              .from('chat_sessions')
              .update({ title: data.summary })
              .eq('id', chatId)
              .eq('user_id', user.id);
            if (updateError) {
              console.error('Failed to update chat title with LLM summary:', updateError);
            } else {
              console.log('Chat title updated with LLM summary:', data.summary);
            }
          }
        } else {
          console.warn('LLM summary API failed.');
        }
      } catch (err) {
        console.error('Error in summary effect:', err);
      }
    })();
  }, [chatId, user, messages, supabase, isLoading]);

  // 모든 데이터가 로드되기 전에는 로딩 화면 표시
  if (!isFullyLoaded || !user) {
    return <div className="flex h-screen items-center justify-center">Chatflix.app</div>
  }

  return (
    <main className="flex-1 relative h-full">
      <Header 
        isSidebarOpen={isSidebarOpen}
        onSidebarToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        user={user}
      />
      
      <div className={`fixed left-0 top-0 h-full transform transition-all duration-300 ease-in-out z-50 ${
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <Sidebar user={user} onClose={() => setIsSidebarOpen(false)} />
      </div>

      <div
        className={`fixed inset-0 backdrop-blur-[1px] bg-black transition-all duration-200 ease-in-out z-40 ${
          isSidebarOpen ? 'opacity-40 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsSidebarOpen(false)}
      />

      {/* Main content area - adjusted to account for header height */}
      <div className="pt-[60px] h-[calc(100vh-60px)]">
        {/* 주 컨텐츠 영역 */}
        <div className="flex flex-col sm:flex-row h-full sm:px-10 relative">
          {/* 채팅 패널 - 항상 표시 */}
          <div 
            className={`overflow-y-auto pb-4 sm:pb-4 mx-auto max-w-3xl w-full 
              ${activePanel?.messageId ? 'sm:w-2/6' : ''} 
              ${hideScrollbarClass}
              transition-all duration-300 ease-in-out`}
            style={{ height: '100%' }}
          >
            <div 
              className="messages-container"
              ref={messagesContainerRef}
            >
              {/* {useVirtualization ? (
                <VirtuosoWrapper
                  messages={messages}
                  messagesEndRef={messagesEndRef}
                  parentContainerRef={messagesContainerRef}
                  renderMessage={(message, index) => {
                    // Get reasoning parts directly from message.parts during streaming
                    const messageHasCanvasData = hasCanvasData(message);
                    
                    // 각 메시지의 캔버스 데이터 가져오기
                    const webSearchData = getWebSearchResults(message);
                    const mathCalculationData = getMathCalculationData(message);
                    const linkReaderData = getLinkReaderData(message);
                    const imageGeneratorData = getImageGeneratorData(message);
                    const academicSearchData = getAcademicSearchData(message);
                    const youTubeSearchData = getYouTubeSearchData(message);
                    const youTubeLinkAnalysisData = getYouTubeLinkAnalysisData(message);

                    // Call the helper function directly, no useMemo here
                    const reasoningData = extractReasoningForMessage(message);
                    const agentReasoning = reasoningData.completeData;
                    const agentReasoningProgress = reasoningData.progressData;
                    
                    return (
                      <>
                        <div className="relative">
                          <MessageComponent
                            message={message}
                            currentModel={currentModel}
                            isRegenerating={isRegenerating}
                            editingMessageId={editingMessageId}
                            editingContent={editingContent}
                            copiedMessageId={copiedMessageId}
                            onRegenerate={(messageId: string) => handleRegenerate(messageId, messages, setMessages, currentModel, reload)}
                            onCopy={handleCopyMessage}
                            onEditStart={handleEditStart}
                            onEditCancel={handleEditCancel}
                            onEditSave={(messageId: string) => handleEditSave(messageId, currentModel, messages, setMessages, reload)}
                            setEditingContent={setEditingContent}
                            chatId={chatId}
                            isStreaming={isLoading && message.role === 'assistant' && message.id === messages[messages.length - 1]?.id}
                            isWaitingForToolResults={isWaitingForToolResults(message)}
                            messageHasCanvasData={messageHasCanvasData}
                            activePanelMessageId={activePanel?.messageId}
                            togglePanel={togglePanel}
                            webSearchData={webSearchData}
                            mathCalculationData={mathCalculationData}
                            linkReaderData={linkReaderData}
                            imageGeneratorData={imageGeneratorData}
                            academicSearchData={academicSearchData}
                            youTubeSearchData={youTubeSearchData}
                            youTubeLinkAnalysisData={youTubeLinkAnalysisData}
                          />
                        </div>
                        
                        {/* Add loading message at the end if the last message is from the user and we're loading */}
                        {/* {isLoading && index === messages.length - 1 && message.role === 'user' && (
                          <MessageComponent
                            message={{
                              id: 'loading-message',
                              role: 'assistant',
                              content: '',
                              createdAt: new Date()
                            }}
                            currentModel={currentModel}
                            isRegenerating={false}
                            editingMessageId={null}
                            editingContent={''}
                            copiedMessageId={null}
                            onRegenerate={() => () => {}}
                            onCopy={() => {}}
                            onEditStart={() => {}}
                            onEditCancel={() => {}}
                            onEditSave={() => {}}
                            setEditingContent={() => {}}
                            chatId={chatId}
                            isStreaming={true}
                            isWaitingForToolResults={true}
                            agentReasoning={null}
                            agentReasoningProgress={[]}
                            messageHasCanvasData={false}
                            activePanelMessageId={activePanel?.messageId}
                            togglePanel={togglePanel}
                            webSearchData={null}
                            mathCalculationData={null}
                            linkReaderData={null}
                            imageGeneratorData={null}
                            academicSearchData={null}
                            youTubeSearchData={null}
                            youTubeLinkAnalysisData={null}
                          />
                        )} */}
                        
                        {/* Add follow-up questions after the last assistant message */}
                        {/* {useVirtualization && !isLoading && index === messages.length - 1 && message.role === 'assistant' && user && (
                          <FollowUpQuestions 
                            chatId={chatId} 
                            userId={user.id} 
                            messages={messages} 
                            onQuestionClick={handleFollowUpQuestionClick} 
                          />
                        )} */}
                      {/* </>
                    );
                  }}
                />
              ) : ( */}
                {messages.map((message, index) => {
                  const messageHasCanvasData = hasCanvasData(message);
                  
                  // 각 메시지의 캔버스 데이터 가져오기
                  const webSearchData = getWebSearchResults(message);
                  const mathCalculationData = getMathCalculationData(message);
                  const linkReaderData = getLinkReaderData(message);
                  const imageGeneratorData = getImageGeneratorData(message);
                  const academicSearchData = getAcademicSearchData(message);
                  const youTubeSearchData = getYouTubeSearchData(message);
                  const youTubeLinkAnalysisData = getYouTubeLinkAnalysisData(message);

                  // Removed: Call the helper function directly, no useMemo here
                  // const reasoningData = extractReasoningForMessage(message);
                  // const agentReasoning = reasoningData.completeData;
                  // const agentReasoningProgress = reasoningData.progressData;
                  
                  return (
                    <div key={message.id}>
                      <div className="relative">
                        <MessageComponent
                          message={message}
                          currentModel={currentModel}
                          isRegenerating={isRegenerating}
                          editingMessageId={editingMessageId}
                          editingContent={editingContent}
                          copiedMessageId={copiedMessageId}
                          onRegenerate={(messageId: string) => handleRegenerate(messageId, messages, setMessages, currentModel, reload)}
                          onCopy={handleCopyMessage}
                          onEditStart={handleEditStart}
                          onEditCancel={handleEditCancel}
                          onEditSave={(messageId: string) => handleEditSave(messageId, currentModel, messages, setMessages, reload)}
                          setEditingContent={setEditingContent}
                          chatId={chatId}
                          isStreaming={isLoading && message.role === 'assistant' && message.id === messages[messages.length - 1]?.id}
                          isWaitingForToolResults={isWaitingForToolResults(message)}
                          messageHasCanvasData={messageHasCanvasData}
                          activePanelMessageId={activePanel?.messageId}
                          togglePanel={togglePanel}
                          webSearchData={webSearchData}
                          mathCalculationData={mathCalculationData}
                          linkReaderData={linkReaderData}
                          imageGeneratorData={imageGeneratorData}
                          academicSearchData={academicSearchData}
                          youTubeSearchData={youTubeSearchData}
                          youTubeLinkAnalysisData={youTubeLinkAnalysisData}
                        />
                      </div>
                    </div>
                  );
                })}
              {/* )} */}
              {/* Show immediate loading response after sending message */}
              {isLoading && messages.length > 0 && messages[messages.length - 1]?.role === 'user' && (
                <div>
                  <MessageComponent
                    message={{
                      id: 'loading-message',
                      role: 'assistant',
                      content: '',
                      createdAt: new Date()
                    }}
                    currentModel={currentModel}
                    isRegenerating={false}
                    editingMessageId={null}
                    editingContent={''}
                    copiedMessageId={null}
                    onRegenerate={() => () => {}}
                    onCopy={() => {}}
                    onEditStart={() => {}}
                    onEditCancel={() => {}}
                    onEditSave={() => {}}
                    setEditingContent={() => {}}
                    chatId={chatId}
                    isStreaming={true}
                    isWaitingForToolResults={true}
                    messageHasCanvasData={false}
                    activePanelMessageId={activePanel?.messageId}
                    togglePanel={togglePanel}
                    webSearchData={null}
                    mathCalculationData={null}
                    linkReaderData={null}
                    imageGeneratorData={null}
                    academicSearchData={null}
                    youTubeSearchData={null}
                    youTubeLinkAnalysisData={null}
                  />
                </div>
              )}
              
              {/* Add follow-up questions only if virtualization is not used */}
              {/* {!useVirtualization && !isLoading && messages.length > 0 && messages[messages.length - 1]?.role === 'assistant' && user && ( */}
              {!isLoading && messages.length > 0 && messages[messages.length - 1]?.role === 'assistant' && user && (
                <FollowUpQuestions 
                  chatId={chatId} 
                  userId={user.id} 
                  messages={messages} 
                  onQuestionClick={handleFollowUpQuestionClick} 
                />
              )}
              
              <div ref={messagesEndRef} className="h-px" />
            </div>
          </div>

          {/* 우측 사이드 패널 - 조건부 렌더링이 아닌 항상 렌더링하되 상태에 따라 표시/숨김 */}
          <div 
            className={`fixed sm:relative top-[60px] sm:top-0 right-0 bottom-0 
              w-full sm:w-4/6 bg-[var(--background)] sm:border-l 
              border-[color-mix(in_srgb,var(--foreground)_7%,transparent)] 
              overflow-y-auto z-0 
              transition-all duration-300 ease-in-out transform 
              ${activePanel?.messageId ? 'translate-x-0 opacity-100 sm:max-w-[66.666667%]' : 'translate-x-full sm:translate-x-0 sm:max-w-0 sm:opacity-0 sm:overflow-hidden'} 
              ${hideScrollbarClass}`}
            style={{ 
              height: 'calc(100vh - 60px)',
              maxHeight: '100%'
            }}
            ref={canvasContainerRef}
          >
            {/* 패널 헤더 (모바일/데스크탑 공통) */}
            {activePanel?.messageId && (
              <div className="sticky top-0 z-10 bg-[var(--background)] flex items-center justify-between px-4 h-auto py-2.5 border-b border-[color-mix(in_srgb,var(--foreground)_7%,transparent)]">
                <div className="flex items-center">
                  <button 
                    onClick={() => togglePanel(activePanel?.messageId || '', activePanel?.type || 'canvas')}
                    className="w-8 h-8 flex items-center justify-center mr-3"
                    aria-label="Close panel"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                  <div className="flex flex-col">
                    <h3 className="text-lg font-semibold">
                      {activePanel.type === 'canvas' ? 'Canvas' : 'Attachment Details'}
                    </h3>
                    {activePanel.type === 'canvas' && (() => {
                      const activeMessageForCanvas = messages.find(msg => msg.id === activePanel?.messageId);
                      if (!activeMessageForCanvas) return null;

                      const canvasDataSummary: string[] = [];
                      if (getWebSearchResults(activeMessageForCanvas)) canvasDataSummary.push('Web Search');
                      if (getMathCalculationData(activeMessageForCanvas)) canvasDataSummary.push('Calculator');
                      if (getLinkReaderData(activeMessageForCanvas)) canvasDataSummary.push('Link Reader');
                      if (getImageGeneratorData(activeMessageForCanvas)) canvasDataSummary.push('Image Gen');
                      if (getAcademicSearchData(activeMessageForCanvas)) canvasDataSummary.push('Academic Search');
                      if (getYouTubeSearchData(activeMessageForCanvas)) canvasDataSummary.push('YouTube Search');
                      if (getYouTubeLinkAnalysisData(activeMessageForCanvas)) canvasDataSummary.push('YouTube Analysis');
                      // Add other canvas data types here as needed

                      if (canvasDataSummary.length > 0) {
                        return <p className="text-xs text-[var(--muted)] mt-0.5">{canvasDataSummary.join(', ')}</p>;
                      }
                      return null;
                    })()}
                    {activePanel.type === 'structuredResponse' && (() => {
                      const activeMessageForPanel = messages.find(msg => msg.id === activePanel?.messageId);
                      if (!activeMessageForPanel) return null;
                      const filesForPanel = getStructuredResponseFiles(activeMessageForPanel);
                      if (filesForPanel && filesForPanel.length > 0) {
                        // Display up to 3 file names, then 'and X more'
                        const maxFilesToShow = 3;
                        const fileNames = filesForPanel.map((file: File) => file.name);
                        let summaryText = fileNames.slice(0, maxFilesToShow).join(', ');
                        if (fileNames.length > maxFilesToShow) {
                          summaryText += `, and ${fileNames.length - maxFilesToShow} more`;
                        }
                        return <p className="text-xs text-[var(--muted)] mt-0.5">{summaryText}</p>;
                      }
                      return null;
                    })()}
                  </div>
                </div>
                <div></div> {/* Empty div to maintain justify-between spacing */}
              </div>
            )}

            {/* 패널 내용 - 선택된 메시지의 캔버스 데이터만 표시 */}
            <div className="px-4 pt-4 mb-10">
              {messages
                .filter(message => message.id === activePanel?.messageId)
                .map((message) => {
                  const webSearchData = getWebSearchResults(message);
                  const mathCalculationData = getMathCalculationData(message);
                  const linkReaderData = getLinkReaderData(message);
                  const imageGeneratorData = getImageGeneratorData(message);
                  const academicSearchData = getAcademicSearchData(message);
                  const youTubeSearchData = getYouTubeSearchData(message);
                  const youTubeLinkAnalysisData = getYouTubeLinkAnalysisData(message);

                  return (
                    <div key={`panel-content-${message.id}`}>
                      {activePanel?.type === 'canvas' && (
                        <Canvas
                          webSearchData={webSearchData}
                          mathCalculationData={mathCalculationData}
                          linkReaderData={linkReaderData}
                          imageGeneratorData={imageGeneratorData}
                          academicSearchData={academicSearchData}
                          youTubeSearchData={youTubeSearchData}
                          youTubeLinkAnalysisData={youTubeLinkAnalysisData}
                          isCompact={false} // 패널에서는 항상 전체 보기
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

      <div className="fixed inset-x-0 bottom-0 z-10 w-full">
        <div className="bg-gradient-to-t from-[var(--background)] from-50% via-[var(--background)]/80 to-transparent pt-0 pb-6 w-full">
          <div className="max-w-2xl mx-auto w-full px-6 sm:px-8 relative flex flex-col items-center">
            <div className="w-full max-w-[calc(100vw-2rem)]">
              {/* {isConversationTooLong && (
                <div className="p-3 text-center text-[var(--foreground-secondary)] backdrop-blur-md text-sm sm:text-base rounded-md">
                  Hmm, I might be forgetting our earlier conversation. <br />
                  Want to start a <a href="/" className="text-blue-500 hover:underline">fresh chat</a> for better results? 😊
                </div>
              )} */}
              <ModelSelector
                currentModel={currentModel}
                nextModel={nextModel}
                setNextModel={setNextModel}
                setCurrentModel={setCurrentModel}
                position="top"
                disabledLevels={rateLimitedLevels}
                isAgentEnabled={isAgentEnabled}
                onAgentAvailabilityChange={setHasAgentModels}
                user={user}
              />
              <ChatInput
                input={input}
                handleInputChange={handleInputChange}
                handleSubmit={handleModelSubmitWithReset}
                isLoading={isLoading}
                stop={handleStop}
                user={{...user, hasAgentModels}}
                modelId={nextModel}
                isAgentEnabled={isAgentEnabled}
                setisAgentEnabled={setAgentEnabledHandler}
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  )
} 