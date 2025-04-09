'use client'

import { useChat } from '@ai-sdk/react';
import { Message } from 'ai'
import { useState, useEffect, use, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
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
import { Message as MessageComponent } from '@/app/components/Message'
import { ChatInput } from '@/app/components/ChatInput/index';
import { VirtuosoHandle } from 'react-virtuoso';
import VirtuosoWrapper from '@/app/components/VirtuosoWrapper';
import Canvas from '@/app/components/Canvas';

// Define data type structures for annotations
type AgentReasoningData = {
  reasoning: string;
  needsWebSearch: boolean;
  needsCalculator: boolean;
  needsLinkReader: boolean;
  needsImageGenerator: boolean;
  needsAcademicSearch: boolean;
  needsXSearch: boolean;
  needsYouTubeSearch?: boolean;
  needsYouTubeLinkAnalyzer?: boolean;
  timestamp: string;
  isComplete?: boolean;
};

type AgentReasoningProgressData = {
  reasoning: string;
  needsWebSearch: boolean;
  needsCalculator: boolean;
  needsLinkReader: boolean;
  needsImageGenerator: boolean;
  needsAcademicSearch: boolean;
  needsXSearch: boolean;
  needsYouTubeSearch?: boolean;
  needsYouTubeLinkAnalyzer?: boolean;
  timestamp: string;
  isComplete: boolean;
};

// Define data type for X search results
type XSearchData = {
  xResults: {
    query: string;
    timestamp?: string;
    results: {
      text: string;
      username: string;
      url: string;
      date?: string;
    }[];
  }[];
};

// Define data type for YouTube search results
type YouTubeSearchData = {
  youtubeResults: {
    query: string;
    timestamp?: string;
    results: {
      videoId: string;
      url: string;
      details?: {
        title?: string;
        description?: string;
        channelName?: string;
        publishDate?: string;
        viewCount?: number;
        duration?: string;
        thumbnailUrl?: string;
      };
      captions?: string;
      timestamps?: {
        time: string;
        text: string;
      }[];
    }[];
  }[];
};

// Define data type for YouTube link analysis results
type YouTubeLinkAnalysisData = {
  analysisResults: {
    url: string;
    videoId: string;
    timestamp: string;
    details?: {
      title?: string;
      description?: string;
      author?: string;
      publishedTime?: string;
      views?: number;
      likes?: number;
      category?: string;
      duration?: number;
    };
    channel?: {
      name?: string;
      id?: string;
      subscribers?: string;
      link?: string;
    };
    transcript?: {
      language: string;
      segments: {
        timestamp: string;
        start: number;
        duration: number;
        text: string;
      }[];
      fullText: string;
    };
    transcriptError?: string;
    error?: string;
  }[];
};

// Define data type for Wolfram Alpha results
type WolframAlphaData = {
  query: string;
  pods: {
    title: string;
    subpods: {
      plaintext?: string;
      img?: {
        src: string;
        alt: string;
        width: number;
        height: number;
      };
      markdown?: string;
    }[];
  }[];
  error?: string;
  timing?: string;
};

// Define a type for the annotations
type Annotation = {
  type: string;
  data: any;
};

export default function Chat({ params }: PageProps) {
  const { id: chatId } = use(params)
  const router = useRouter()
  const [currentModel, setCurrentModel] = useState('')
  const [nextModel, setNextModel] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const virtuosoRef = useRef<VirtuosoHandle>(null);
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
  const isFullyLoaded = !isModelLoading && isSessionLoaded && !!currentModel

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
        
        // Include chatId and level in the redirect URL
        router.push(`/rate-limit?${new URLSearchParams({
          limit: limit.toString(),
          reset,
          model: modelId,
          chatId: chatId,
          level: level
        }).toString()}`);
        
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
  const useVirtualization = useMemo(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      return messages.length > 10;
    }
    return messages.length > 20;
  }, [messages.length]);

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

  const scrollToBottom = useCallback(() => {
    if (virtuosoRef.current) {
      virtuosoRef.current.scrollToIndex({
        index: messages.length - 1,
        behavior: 'smooth'
      });
    } else if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
    }
  }, [messages.length]);

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
            .filter(([_, data]: [string, any]) => data.reset > currentTime)
            .map(([level, _]: [string, any]) => level)
          
          if (validLevels.length > 0) {
            setRateLimitedLevels(validLevels)
            
            // If current model is rate limited, switch to a different model
            if (currentModel) {
              const currentModelConfig = MODEL_CONFIGS.find(m => m.id === currentModel)
              if (currentModelConfig && validLevels.includes(currentModelConfig.rateLimit.level)) {
                // Find a model from a different level that's not rate limited
                const alternativeModel = MODEL_CONFIGS.find(m => 
                  m.isEnabled && !validLevels.includes(m.rateLimit.level)
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
    if (input.trim()) {
      messageContent.push({
        type: 'text',
        text: input.trim()
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

  // Add back initialization scroll effect only
  useEffect(() => {
    if (isInitialized && isFullyLoaded) {
      scrollToBottom();
    }
  }, [isInitialized, isFullyLoaded, scrollToBottom]);

  // Find web search tool results to display
  const getWebSearchResults = (message: Message) => {
    if (!message) return null;
    
    // Get query completion annotations
    const queryCompletions = message.annotations 
      ? (message.annotations as any[]).filter(a => a?.type === 'query_completion')
      : [];
    
    // Get web search complete annotations
    const webSearchCompletions = message.annotations 
      ? (message.annotations as any[]).filter(a => a?.type === 'web_search_complete')
      : [];

    // 모든 웹 검색 결과를 병합합니다
    if (webSearchCompletions.length > 0) {
      // 각 검색 결과에서 모든 searches 항목을 추출
      const allSearches: any[] = [];
      
      // web_search_complete 어노테이션에서 검색 결과 수집
      webSearchCompletions.forEach(completion => {
        if (completion.data && completion.data.searches) {
          allSearches.push(...completion.data.searches);
        }
      });
      
      if (allSearches.length > 0) {
        // 중복 제거를 위한 맵 생성 (query와 URL 조합으로 유일성 확인)
        const uniqueResults = new Map<string, any>();
        
        // 모든 검색 결과를 정리하고 중복 제거
        allSearches.forEach(search => {
          const query = search.query;
          
          if (!uniqueResults.has(query)) {
            uniqueResults.set(query, {
              query,
              results: [],
              images: []
            });
          }
          
          // 현재 저장된 결과
          const currentSearch = uniqueResults.get(query);
          
          // URL 기반으로 중복 체크를 위한 집합
          const urlSet = new Set(currentSearch.results.map((r: any) => r.url));
          const imageUrlSet = new Set(currentSearch.images.map((img: any) => 
            typeof img === 'string' ? img : img.url
          ));
          
          // 결과 추가 (중복 제거)
          if (search.results) {
            search.results.forEach((result: any) => {
              if (!urlSet.has(result.url)) {
                currentSearch.results.push(result);
                urlSet.add(result.url);
              }
            });
          }
          
          // 이미지 추가 (중복 제거)
          if (search.images) {
            search.images.forEach((image: any) => {
              const imageUrl = typeof image === 'string' ? image : image.url;
              if (!imageUrlSet.has(imageUrl)) {
                currentSearch.images.push(image);
                imageUrlSet.add(imageUrl);
              }
            });
          }
        });
        
        return {
          result: { searches: Array.from(uniqueResults.values()) } as any,
          args: null,
          annotations: queryCompletions
        };
      }
    }
    
    // Check for stored tool results first
    if ((message as any).tool_results) {
      const toolResults = (message as any).tool_results;
      
      // Handle both new and legacy formats
      let mergedSearches: any[] = [];
      
      if (toolResults.webSearchResults) {
        // New format with webSearchResults key
        mergedSearches = Array.isArray(toolResults.webSearchResults)
          ? toolResults.webSearchResults.flatMap((r: any) => r.searches || [])
          : [];
      } else if (Array.isArray(toolResults) && toolResults[0]?.searches) {
        // Legacy format with searches key
        mergedSearches = toolResults.flatMap((r: any) => r.searches || []);
      }
      
      if (mergedSearches.length > 0) {
        return {
          result: { searches: mergedSearches } as any,
          args: null,
          annotations: queryCompletions
        };
      }
    }
    
    // If no parts property or it's empty, return null or loading state
    if (!message.parts || message.parts.length === 0) {
      // If we have query completions, we can show a loading state
      if (queryCompletions.length > 0) {
        return {
          result: null,
          args: { queries: [], maxResults: [], topics: [], searchDepth: [] },
          annotations: queryCompletions
        };
      }
      return null;
    }
    
    // Collect all results and args from tool invocations
    const allResults: any[] = [];
    const allArgs: any[] = [];
    
    for (const part of message.parts) {
      if (part?.type === 'tool-invocation' && part.toolInvocation?.toolName === 'web_search') {
        try {
          const invocation = part.toolInvocation as any;
          if (invocation.args) allArgs.push(JSON.parse(JSON.stringify(invocation.args)));
          if (invocation.result) allResults.push(JSON.parse(JSON.stringify(invocation.result)));
        } catch (error) {
          console.error('Error parsing web search results:', error);
        }
      }
    }
    
    // Check web_search_complete annotations
    if (message.annotations && allResults.length === 0) {
      const webSearchAnnotations = (message.annotations as any[])
        .filter(a => a?.type === 'web_search_complete');
      
      if (webSearchAnnotations.length > 0) {
        const searches = webSearchAnnotations
          .filter(a => a.data?.searches)
          .flatMap(a => {
            // Ensure each search has an images array
            if (a.data.searches) {
              a.data.searches.forEach((s: any) => {
                if (!s.images) s.images = [];
              });
            }
            return a.data.searches || [];
          });
        
        if (searches.length > 0) {
          return {
            result: { searches } as any,
            args: allArgs[0] || null,
            annotations: queryCompletions
          };
        }
      }
    }
    
    // Process real-time search results
    if (allResults.length > 0) {
      const mergedSearches = allResults.flatMap(result => result.searches || []);
      
      if (mergedSearches.length > 0) {
        return {
          result: { searches: mergedSearches } as any,
          args: allArgs[0] || null,
          annotations: queryCompletions
        };
      }
    }
    
    // Extract queries for loading state
    if (allArgs.length > 0) {
      return {
        result: null,
        args: allArgs[0],
        annotations: queryCompletions
      };
    }
    
    return null;
  };

  // Extract math calculation annotations
  const getMathCalculationData = (message: Message) => {
    // 1. 데이터베이스에서 저장된 tool_results가 있는지 확인
    if ((message as any).tool_results) {
      const toolResults = (message as any).tool_results;
      
      // 새로운 구조: calculationSteps 키 확인
      if (toolResults.calculationSteps && Array.isArray(toolResults.calculationSteps) && 
          toolResults.calculationSteps.length > 0) {
        return {
          calculationSteps: toolResults.calculationSteps
        };
      }
      
      // 이전 구조와의 호환성 유지
      else if (Array.isArray(toolResults) && toolResults.length > 0 && 
          typeof toolResults[0] === 'object' && 
          'step' in toolResults[0] && 
          'expression' in toolResults[0] && 
          'result' in toolResults[0]) {
        return {
          calculationSteps: toolResults
        };
      }
      
      // tool_results가 있지만 수학 계산 결과가 아니면 반환하지 않음
      return null;
    }
    
    // 2. 실시간 주석에서 계산 단계 추출
    if (!message.annotations) return null;
    
    const mathAnnotations = (message.annotations as any[])
      .filter(a => a && typeof a === 'object' && a.type && 
        ['math_calculation', 'math_calculation_complete'].includes(a.type));
    
    if (mathAnnotations.length === 0) return null;
    
    // 최신 계산 단계 반환
    const calculationSteps = mathAnnotations
      .filter(a => a.type === 'math_calculation' && a.calculationSteps)
      .flatMap(a => a.calculationSteps)
      .filter((step, index, self) => 
        index === self.findIndex(s => s.step === step.step)
      )
      .sort((a, b) => a.step - b.step);
    
    return calculationSteps.length > 0 ? { calculationSteps } : null;
  };

  // Extract link reader attempts from message annotations and tool_results
  const getLinkReaderData = (message: Message) => {
    // Check if there are stored link reader attempts in tool_results
    if ((message as any).tool_results?.linkReaderAttempts) {
      const linkAttempts = (message as any).tool_results.linkReaderAttempts;
      if (Array.isArray(linkAttempts) && linkAttempts.length > 0) {
        return { linkAttempts };
      }
    }
    
    // Check for link reader annotations
    if (!message.annotations) return null;
    
    // Get initial attempts
    const linkReaderAnnotations = (message.annotations as any[])
      .filter(a => a && typeof a === 'object' && a.type === 'link_reader_attempt')
      .map(a => a.data)
      .filter(Boolean);
    
    if (linkReaderAnnotations.length === 0) return null;
    
    // Create a map of attempts by URL for easy updating
    const attemptsMap = new Map(
      linkReaderAnnotations.map(attempt => [attempt.url, attempt])
    );
    
    // Apply updates from annotations
    (message.annotations as any[])
      .filter(a => a && typeof a === 'object' && a.type === 'link_reader_attempt_update')
      .forEach(update => {
        const data = update.data;
        if (data?.url && attemptsMap.has(data.url)) {
          // Update the attempt with latest data
          Object.assign(attemptsMap.get(data.url), data);
        }
      });
    
    return { linkAttempts: Array.from(attemptsMap.values()) };
  };

  // Extract image generator data from message annotations and tool_results
  const getImageGeneratorData = (message: Message) => {
    // Check if there are stored generated images in tool_results
    if ((message as any).tool_results?.generatedImages) {
      const generatedImages = (message as any).tool_results.generatedImages;
      if (Array.isArray(generatedImages) && generatedImages.length > 0) {
        return { generatedImages };
      }
    }
    
    // Check for image generator annotations
    if (!message.annotations) return null;
    
    // Get image generation annotations
    const imageAnnotations = (message.annotations as any[])
      .filter(a => a && typeof a === 'object' && a.type === 'generated_image')
      .map(a => a.data)
      .filter(Boolean);
    
    if (imageAnnotations.length === 0) return null;
    
    return { generatedImages: imageAnnotations };
  };

  // Extract academic search data from message annotations and tool_results
  const getAcademicSearchData = (message: Message) => {
    // Check if there are stored academic search results in tool_results
    if ((message as any).tool_results?.academicSearchResults) {
      const academicResults = (message as any).tool_results.academicSearchResults;
      if (Array.isArray(academicResults) && academicResults.length > 0) {
        return { academicResults };
      }
    }
    
    // Check for academic search annotations
    if (!message.annotations) return null;
    
    // Get academic search annotations
    const academicAnnotations = (message.annotations as any[])
      .filter(a => a && typeof a === 'object' && a.type === 'academic_search_complete')
      .map(a => a.data)
      .filter(Boolean);
    
    if (academicAnnotations.length === 0) return null;
    
    return { academicResults: academicAnnotations };
  };

  // Extract X search data from message annotations and tool_results
  const getXSearchData = (message: Message) => {
    // Check if there are stored X search results in tool_results
    if ((message as any).tool_results?.xSearchResults) {
      const xResults = (message as any).tool_results.xSearchResults;
      if (Array.isArray(xResults) && xResults.length > 0) {
        return { xResults };
      }
    }
    
    // Check for X search annotations
    if (!message.annotations) return null;
    
    // Get X search annotations
    const xSearchAnnotations = (message.annotations as any[])
      .filter(a => a && typeof a === 'object' && a.type === 'x_search_complete')
      .map(a => a.data)
      .filter(Boolean);
    
    if (xSearchAnnotations.length === 0) return null;
    
    return { xResults: xSearchAnnotations };
  };

  // Extract YouTube search data from message annotations and tool_results
  const getYouTubeSearchData = (message: Message) => {
    // Check if there are stored YouTube search results in tool_results
    if ((message as any).tool_results?.youtubeSearchResults) {
      const youtubeResults = (message as any).tool_results.youtubeSearchResults;
      if (Array.isArray(youtubeResults) && youtubeResults.length > 0) {
        return { youtubeResults };
      }
    }
    
    // Check for YouTube search annotations
    if (!message.annotations) return null;
    
    // Get YouTube search annotations
    const youtubeSearchAnnotations = (message.annotations as any[])
      .filter(a => a && typeof a === 'object' && a.type === 'youtube_search_complete')
      .map(a => a.data)
      .filter(Boolean);
    
    if (youtubeSearchAnnotations.length === 0) return null;
    
    return { youtubeResults: youtubeSearchAnnotations };
  };

  // Extract YouTube link analysis data from message annotations and tool_results
  const getYouTubeLinkAnalysisData = (message: Message) => {
    // Check tool_results first
    if ((message as any).tool_results?.youtubeLinkAnalysisResults) {
      const analysisResults = (message as any).tool_results.youtubeLinkAnalysisResults;
      if (Array.isArray(analysisResults) && analysisResults.length > 0) {
        return { analysisResults };
      }
    }
    
    // Check annotations if no tool_results found
    if (!message.annotations) return null;
    
    const youtubeAnalysisAnnotations = (message.annotations as any[])
      .filter(a => a && typeof a === 'object' && 
        (a.type === 'youtube_analysis_complete' || a.type === 'youtube_link_analysis_complete'))
      .map(a => a.data?.results || a.data)
      .filter(Boolean)
      .flat();
    
    return youtubeAnalysisAnnotations.length > 0 ? { analysisResults: youtubeAnalysisAnnotations } : null;
  };

  // Extract agent reasoning data from annotations and tool_results
  function getAgentReasoningData(messages: Message[]) {
    const reasoningData = messages.flatMap(message => {
      const annotations = ((message.annotations || []) as Annotation[])
        .filter(a => a.type === 'agent_reasoning' || a.type === 'agent_reasoning_progress');
        
      const toolResultsReasoning = (message as any).tool_results?.agentReasoning 
        ? [{ type: 'agent_reasoning', data: (message as any).tool_results.agentReasoning }] 
        : [];
        
      return [...annotations, ...toolResultsReasoning];
    });
    
    const completeAnnotation = reasoningData.find(a => 
      a.type === 'agent_reasoning' && (a.data.isComplete === true || a.data.isComplete === undefined)
    );
    
    const progressAnnotations = reasoningData
      .filter(a => a.type === 'agent_reasoning_progress')
      .sort((a, b) => new Date(a.data.timestamp).getTime() - new Date(b.data.timestamp).getTime());
    
    const formatReasoningData = (data: any) => ({
      reasoning: data.reasoning || '',
      needsWebSearch: Boolean(data.needsWebSearch),
      needsCalculator: Boolean(data.needsCalculator),
      needsLinkReader: Boolean(data.needsLinkReader),
      needsImageGenerator: Boolean(data.needsImageGenerator),
      needsAcademicSearch: Boolean(data.needsAcademicSearch),
      needsXSearch: Boolean(data.needsXSearch),
      needsYouTubeSearch: Boolean(data.needsYouTubeSearch),
      needsYouTubeLinkAnalyzer: Boolean(data.needsYouTubeLinkAnalyzer),
      needsWolframAlpha: Boolean(data.needsWolframAlpha),
      timestamp: data.timestamp,
      isComplete: data.isComplete ?? true
    });
    
    return {
      completeData: completeAnnotation ? formatReasoningData(completeAnnotation.data) : null,
      progressData: progressAnnotations.map(a => ({ ...formatReasoningData(a.data), isComplete: false }))
    };
  }

  // Extract Wolfram Alpha data from message annotations and tool_results
  const getWolframAlphaData = (message: Message) => {
    // 디버그 로그 추가
    console.log("[DEBUG-WOLFRAM] Checking message for Wolfram Alpha data:", message.id);
    
    // 1. 가장 일반적인 케이스 - tool_results.wolframAlphaResults
    if ((message as any).tool_results?.wolframAlphaResults) {
      const wolframResults = (message as any).tool_results.wolframAlphaResults;
      console.log("[DEBUG-WOLFRAM] Found wolframAlphaResults:", wolframResults);
      
      // searchData 형식 변환 (query, timestamp, result)
      // 백엔드에서 주로 이 형식으로 저장함
      if (Array.isArray(wolframResults) && wolframResults.length > 0) {
        const searchData = wolframResults[0];
        if (searchData.result) {
          // 백엔드에서 사용하는 결과 구조를 프론트엔드 WolframAlphaData 타입으로 변환
          return transformToWolframAlphaDataFormat(searchData.query, searchData.result);
        }
        return transformToWolframAlphaDataFormat(searchData.query, searchData);
      }
      
      // 결과가 바로 result 객체로 저장된 경우
      if (wolframResults.result) {
        return transformToWolframAlphaDataFormat(wolframResults.query, wolframResults.result);
      }
      
      // 직접 API 결과 형식으로 저장된 경우
      if (wolframResults.pods || wolframResults.success !== undefined) {
        return transformToWolframAlphaDataFormat(wolframResults.query, wolframResults);
      }
      
      // 일반 객체인 경우
      if (wolframResults && typeof wolframResults === 'object') {
        return transformToWolframAlphaDataFormat(
          wolframResults.query || "Unknown query", 
          wolframResults
        );
      }
    }
    
    // 2. 스네이크 케이스 변형
    if ((message as any).tool_results?.wolfram_alpha_results) {
      const wolframResults = (message as any).tool_results.wolfram_alpha_results;
      console.log("[DEBUG-WOLFRAM] Found wolfram_alpha_results:", wolframResults);
      
      if (Array.isArray(wolframResults) && wolframResults.length > 0) {
        const searchData = wolframResults[0];
        if (searchData.result) {
          return transformToWolframAlphaDataFormat(searchData.query, searchData.result);
        }
        return transformToWolframAlphaDataFormat(searchData.query, searchData);
      }
      
      if (wolframResults && typeof wolframResults === 'object') {
        return transformToWolframAlphaDataFormat(
          wolframResults.query || "Unknown query", 
          wolframResults
        );
      }
    }
    
    // 3. tools 객체에 직접 저장된 경우
    if ((message as any).tool_results?.tools?.wolfram_alpha?.queryResults) {
      const wolframResults = (message as any).tool_results.tools.wolfram_alpha.queryResults;
      console.log("[DEBUG-WOLFRAM] Found queryResults in tools:", wolframResults);
      
      if (Array.isArray(wolframResults) && wolframResults.length > 0) {
        const searchData = wolframResults[0];
        if (searchData.result) {
          return transformToWolframAlphaDataFormat(searchData.query, searchData.result);
        }
        return transformToWolframAlphaDataFormat(searchData.query, searchData);
      }
    }
    
    // 4. 전체 tool_results 객체 확인 (디버깅용)
    if ((message as any).tool_results) {
      console.log("[DEBUG-WOLFRAM] Full tool_results:", JSON.stringify((message as any).tool_results).substring(0, 500) + "...");
      
      // tool_results 내부에서 wolfram 관련 키를 검색
      const toolResults = (message as any).tool_results;
      for (const key in toolResults) {
        if (key.toLowerCase().includes('wolfram')) {
          console.log(`[DEBUG-WOLFRAM] Found key: ${key}`, toolResults[key]);
          return transformToWolframAlphaDataFormat(
            toolResults[key].query || "Unknown query", 
            toolResults[key]
          );
        }
      }
    }
    
    // 5. 실시간 주석에서 확인
    if (message.annotations && message.annotations.length > 0) {
      console.log("[DEBUG-WOLFRAM] Checking annotations, count:", message.annotations.length);
      
      const wolframAnnotations = (message.annotations as any[])
        .filter(a => a && typeof a === 'object' && (
          a.type === 'wolfram_alpha_complete' || 
          a.type === 'wolfram_alpha_results' ||
          a.type === 'wolfram_alpha_result'
        ));
      
      if (wolframAnnotations.length > 0) {
        console.log("[DEBUG-WOLFRAM] Found annotations:", wolframAnnotations.length);
        
        // 최신 주석의 데이터 사용
        const latestAnnotation = wolframAnnotations[wolframAnnotations.length - 1];
        
        // searchData 형식 처리
        if (latestAnnotation.data?.result) {
          return transformToWolframAlphaDataFormat(
            latestAnnotation.data.query, 
            latestAnnotation.data.result
          );
        }
        
        return transformToWolframAlphaDataFormat(
          latestAnnotation.data?.query || "Unknown query", 
          latestAnnotation.data
        );
      }
    }
    
    console.log("[DEBUG-WOLFRAM] No Wolfram Alpha data found for message:", message.id);
    
    // Check if this is an agent message with tool results
    const isAgentMessage = !!(message as any).tool_results;
    
    // 계산 관련 쿼리일 경우, 에이전트 모드에서만 오류 메시지 표시
    if (isAgentMessage) {
      const query = (message.content || "").toString();
      if (query && (query.includes("solve") || query.includes("compute") || query.includes("calculate") || 
                   query.includes("math") || query.includes("equation"))) {
        return {
          query: query,
          pods: [],
          error: "No Wolfram Alpha results were found for this query."
        };
      }
    }
    
    // 일반 모드에서는 항상 null 반환 (UI 표시 안함)
    return null;
  };
  
  // Helper function to transform backend result format to frontend WolframAlphaData format
  const transformToWolframAlphaDataFormat = (query: string, result: any): WolframAlphaData => {
    // 결과 없음
    if (!result) {
      return {
        query: query || "Unknown query",
        pods: [],
        error: "No results were found for this query."
      };
    }
    
    // 이미 오류가 있는 경우
    if (result.error || result.success === false) {
      return {
        query: query || "Unknown query",
        pods: [],
        error: result.error || "Query failed to return results."
      };
    }
    
    // 이미 적절한 형식인 경우
    if (result.pods && Array.isArray(result.pods)) {
      return {
        query: query || "Unknown query",
        pods: result.pods,
        timing: result.timing || undefined,
        error: result.error || undefined
      };
    }
    
    // processedPods 형식인 경우
    if (result.processedPods && Array.isArray(result.processedPods)) {
      return {
        query: query || "Unknown query",
        pods: result.processedPods,
        timing: result.timing || undefined,
        error: result.error || undefined
      };
    }
    
    // 백엔드 API 응답 형식에서 변환 (queryresult 구조)
    if (result.queryresult) {
      const pods = result.queryresult.pods || [];
      return {
        query: query || "Unknown query",
        pods: pods.map((pod: any) => ({
          title: pod.title,
          subpods: (pod.subpods || []).map((subpod: any) => ({
            plaintext: subpod.plaintext,
            img: subpod.img ? {
              src: subpod.img.src,
              alt: subpod.img.alt || pod.title,
              width: subpod.img.width,
              height: subpod.img.height
            } : undefined
          }))
        })),
        timing: result.queryresult.timing || undefined,
        error: !result.queryresult.success ? "Query unsuccessful" : undefined
      };
    }
    
    // mainResult, inputInterpretation, steps 등 우리 백엔드에서 처리한 형식인 경우
    const pods = [];
    
    // inputInterpretation 추가
    if (result.inputInterpretation) {
      pods.push({
        title: "Input interpretation",
        subpods: [{
          plaintext: result.inputInterpretation
        }]
      });
    }
    
    // mainResult 추가
    if (result.mainResult) {
      pods.push({
        title: result.mainResult.title || "Result",
        subpods: [{
          plaintext: result.mainResult.plaintext,
          img: result.mainResult.img
        }]
      });
    }
    
    // steps 추가
    if (result.steps && result.steps.length > 0) {
      pods.push({
        title: "Step-by-step solution",
        subpods: result.steps.map((step: any, index: number) => ({
          plaintext: `Step ${index + 1}: ${step.plaintext}`,
          img: step.img
        }))
      });
    }
    
    // markdown이 있는 경우 추가
    if (result.markdown) {
      pods.push({
        title: "Complete Results",
        subpods: [{
          markdown: result.markdown
        }]
      });
    }
    
    // 결과 반환
    return {
      query: query || "Unknown query",
      pods: pods,
      timing: result.timing || undefined,
      error: result.error || undefined
    };
  };

  // Check if required environment variables exist
  useEffect(() => {
    const checkEnvironmentVariables = async () => {
      try {
        const exaApiKey = process.env.EXA_API_KEY;
        if (!exaApiKey) {
          console.warn('[WARNING] EXA_API_KEY environment variable is not set. Academic search tool will not work properly.');
        }
      } catch (error) {
        console.error('Error checking environment variables:', error);
      }
    };
    
    checkEnvironmentVariables();
  }, []);

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

      <div className="flex-1 overflow-y-auto pb-4 sm:pb-12 pt-10 sm:pt-16" style={{ height: 'calc(100vh - 76px)' }}>
        <div 
          className="messages-container py-4 max-w-2xl mx-auto px-4 sm:px-6 w-full"
          ref={messagesContainerRef}
        >
          {useVirtualization ? (
            <VirtuosoWrapper
              messages={messages}
              messagesEndRef={messagesEndRef}
              parentContainerRef={messagesContainerRef}
              renderMessage={(message, index) => {
                const webSearchData = getWebSearchResults(message);
                const mathCalculationData = getMathCalculationData(message);
                const linkReaderData = getLinkReaderData(message);
                const imageGeneratorData = getImageGeneratorData(message);
                const academicSearchData = getAcademicSearchData(message);
                const { completeData: agentReasoningData, progressData: agentReasoningProgress } = getAgentReasoningData([message]);
                const xSearchData = getXSearchData(message);
                const youTubeSearchData = getYouTubeSearchData(message);
                const youTubeLinkAnalysisData = getYouTubeLinkAnalysisData(message);
                const wolframAlphaData = getWolframAlphaData(message);
                
                return (
                  <>
                    {(webSearchData || mathCalculationData || linkReaderData || imageGeneratorData || academicSearchData || agentReasoningData || agentReasoningProgress.length > 0 || xSearchData || youTubeSearchData || youTubeLinkAnalysisData || wolframAlphaData) && (
                      <Canvas 
                        webSearchData={webSearchData}
                        mathCalculationData={mathCalculationData}
                        linkReaderData={linkReaderData}
                        imageGeneratorData={imageGeneratorData}
                        academicSearchData={academicSearchData}
                        agentReasoningData={agentReasoningData}
                        agentReasoningProgress={agentReasoningProgress}
                        xSearchData={xSearchData}
                        youTubeSearchData={youTubeSearchData}
                        youTubeLinkAnalysisData={youTubeLinkAnalysisData}
                        wolframAlphaData={wolframAlphaData}
                      />
                    )}
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
                    />
                  </>
                );
              }}
            />
          ) : (
            messages.map((message) => {
              const webSearchData = getWebSearchResults(message);
              const mathCalculationData = getMathCalculationData(message);
              const linkReaderData = getLinkReaderData(message);
              const imageGeneratorData = getImageGeneratorData(message);
              const academicSearchData = getAcademicSearchData(message);
              const { completeData: agentReasoningData, progressData: agentReasoningProgress } = getAgentReasoningData([message]);
              const xSearchData = getXSearchData(message);
              const youTubeSearchData = getYouTubeSearchData(message);
              const youTubeLinkAnalysisData = getYouTubeLinkAnalysisData(message);
              const wolframAlphaData = getWolframAlphaData(message);
              return (
                <div key={message.id}>
                  {(webSearchData || mathCalculationData || linkReaderData || imageGeneratorData || academicSearchData || agentReasoningData || agentReasoningProgress.length > 0 || xSearchData || youTubeSearchData || youTubeLinkAnalysisData || wolframAlphaData) && (
                    <Canvas 
                      webSearchData={webSearchData}
                      mathCalculationData={mathCalculationData}
                      linkReaderData={linkReaderData}
                      imageGeneratorData={imageGeneratorData}
                      academicSearchData={academicSearchData}
                      agentReasoningData={agentReasoningData}
                      agentReasoningProgress={agentReasoningProgress}
                      xSearchData={xSearchData}
                      youTubeSearchData={youTubeSearchData}
                      youTubeLinkAnalysisData={youTubeLinkAnalysisData}
                      wolframAlphaData={wolframAlphaData}
                    />
                  )}
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
                  />
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} className="h-px" />
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-10 w-full">
        <div className="bg-gradient-to-t from-[var(--background)] from-50% via-[var(--background)]/80 to-transparent pt-0 pb-6 w-full">
          <div className="max-w-2xl mx-auto w-full px-6 sm:px-8 relative flex flex-col items-center">
            <div className="w-full max-w-[calc(100vw-2rem)]">
              {isConversationTooLong && (
                <div className="p-3 text-center text-[var(--foreground-secondary)] backdrop-blur-md text-sm sm:text-base rounded-md">
                  Hmm, I might be forgetting our earlier conversation. <br />
                  Want to start a <a href="/" className="text-blue-500 hover:underline">fresh chat</a> for better results? 😊
                </div>
              )}
              <ModelSelector
                currentModel={currentModel}
                nextModel={nextModel}
                setNextModel={setNextModel}
                position="top"
                disabledLevels={rateLimitedLevels}
                isAgentEnabled={isAgentEnabled}
              />
              <ChatInput
                input={input}
                handleInputChange={handleInputChange}
                handleSubmit={handleModelSubmit}
                isLoading={isLoading}
                stop={handleStop}
                user={user}
                modelId={nextModel}
                isAgentEnabled={isAgentEnabled}
                setisAgentEnabled={setisAgentEnabled}
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  )
} 