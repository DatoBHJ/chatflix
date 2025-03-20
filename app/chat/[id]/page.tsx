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
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import MultiSearch from '@/app/components/MultiSearch';


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
  const [isWebSearchEnabled, setIsWebSearchEnabled] = useState(false)

  const isFullyLoaded = !isModelLoading && isSessionLoaded && !!currentModel

  const { messages, input, handleInputChange, handleSubmit, isLoading, stop, setMessages, reload } = useChat({
    api: '/api/chat',
    body: {
      model: nextModel || getSystemDefaultModelId(),
      chatId,
      experimental_attachments: true,
      isWebSearchEnabled
    },
    id: chatId,
    initialMessages: isFullyLoaded ? existingMessages : [],
    onResponse: (response) => {
      // print the last message
      console.log('[Debug] Response in chat/[id]/page.tsx:', messages)
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
        errorData = null;
      }

      // Check if it's a rate limit error either from status or parsed error data
      if (error.status === 429 || errorData?.error === 'Too many requests') {
        const reset = errorData?.reset || new Date(Date.now() + 60000).toISOString();
        const limit = errorData?.limit || 10;
        
        // Get the model level
        const modelConfig = MODEL_CONFIGS.find(m => m.id === nextModel);
        const modelLevel = modelConfig?.rateLimit.level || '';
        
        // Include chatId and level in the redirect URL
        router.push(`/rate-limit?${new URLSearchParams({
          limit: limit.toString(),
          reset: reset,
          model: nextModel,
          chatId: chatId,
          level: modelLevel
        }).toString()}`);
        
        return;
      }

      // Only log non-rate-limit errors
      console.error('Unexpected chat error:', error)
    }
  })

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
        
        // First check URL query parameter for web search setting
        if (isMounted && typeof window !== 'undefined') {
          console.log('[Debug] Chat page - Checking web search settings for chatId:', chatId);
          
          const urlParams = new URLSearchParams(window.location.search);
          const webSearchParam = urlParams.get('web_search');
          console.log('[Debug] Chat page - URL web_search parameter:', webSearchParam);
          
          let shouldEnableWebSearch = false;
          
          if (webSearchParam === 'true') {
            console.log('[Debug] Chat page - Setting web search enabled from URL parameter');
            shouldEnableWebSearch = true;
            // Also update localStorage for persistence
            localStorage.setItem(`websearch_${chatId}`, 'true');
            
            // Clean up URL by removing the query parameter
            const newUrl = window.location.pathname;
            window.history.replaceState({}, document.title, newUrl);
            console.log('[Debug] Chat page - Cleaned up URL, removed query parameter');
          } else {
            // If not in URL, check localStorage as fallback
            const savedWebSearchState = localStorage.getItem(`websearch_${chatId}`);
            console.log('[Debug] Chat page - localStorage web search state:', savedWebSearchState);
            
            if (savedWebSearchState === 'true') {
              console.log('[Debug] Chat page - Setting web search enabled from localStorage');
              shouldEnableWebSearch = true;
            } else {
              console.log('[Debug] Chat page - Web search is disabled');
            }
          }
          
          // Update state synchronously before proceeding
          setIsWebSearchEnabled(shouldEnableWebSearch);
          
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
              console.log('[Debug] Chat page - Reloading with initial message, web search:', shouldEnableWebSearch);
              
              // Only reload if we don't have an assistant message yet (fresh conversation)
              // This prevents unnecessary API calls when refreshing a page with existing conversation
              reload({
                body: {
                  model: session.current_model || currentModel,
                  chatId,
                  messages: sortedMessages,
                  isWebSearchEnabled: shouldEnableWebSearch
                }
              });
            }
          } else if (session.initial_message && isMounted) {
            // Only create initial message if there are no existing messages
            console.log('[Debug] Chat page - Creating initial message, web search:', shouldEnableWebSearch);
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
                isWebSearchEnabled: shouldEnableWebSearch
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
    console.log('[Debug] Chat page - handleModelSubmit called with web search:', isWebSearchEnabled);
    
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

    // Update web search setting in localStorage instead of database
    if (typeof window !== 'undefined') {
      if (isWebSearchEnabled) {
        localStorage.setItem(`websearch_${chatId}`, 'true');
      } else {
        localStorage.removeItem(`websearch_${chatId}`);
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
        isWebSearchEnabled
      },
      experimental_attachments: attachments
    })

  }, [nextModel, currentModel, chatId, handleSubmit, input, messages, user?.id, isWebSearchEnabled])

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

  // Get window dimensions for virtualization
  const [windowDimensions, setWindowDimensions] = useState<{
    width: number;
    height: number;
  }>({
    width: typeof window !== 'undefined' ? window.innerWidth : 1200,
    height: typeof window !== 'undefined' ? window.innerHeight : 800,
  });
  
  // Update window dimensions on resize
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleResize = () => {
      setWindowDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Optimize virtualization condition
  const useVirtualization = useMemo(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      return messages.length > 10;
    }
    return messages.length > 20;
  }, [messages.length]);

  // Add back initialization scroll effect only
  useEffect(() => {
    if (isInitialized && isFullyLoaded) {
      scrollToBottom();
    }
  }, [isInitialized, isFullyLoaded, scrollToBottom]);

  // 모든 데이터가 로드되기 전에는 로딩 화면 표시
  if (!isFullyLoaded || !user) {
    return <div className="flex h-screen items-center justify-center">Chatflix.app</div>
  }

  // Determine if we should use virtualization based on message count
  const listHeight = windowDimensions.height ? Math.max(windowDimensions.height - 300, 400) : 600;

  // Find web search tool results to display
  const getWebSearchResults = (message: Message) => {
    if (!message.parts) return null;
    
    for (const part of message.parts) {
      if (part.type === 'tool-invocation' && part.toolInvocation.toolName === 'web_search') {
        try {
          // Use type assertion to handle 'result' property that may not be explicitly defined in ToolInvocation type
          const invocation = part.toolInvocation as any;
          return {
            result: invocation.result ? JSON.parse(JSON.stringify(invocation.result)) : null,
            args: invocation.args ? JSON.parse(JSON.stringify(invocation.args)) : null
          };
        } catch (error) {
          console.error('Error parsing web search results:', error);
          return null;
        }
      }
    }
    return null;
  };

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

      <div className="flex-1 overflow-y-auto pb-32 pt-10 sm:pt-16">
        <div 
          className="messages-container py-4 max-w-2xl mx-auto px-4 sm:px-6 w-full"
          ref={messagesContainerRef}
        >
          {useVirtualization ? (
            <Virtuoso
              ref={virtuosoRef}
              data={messages}
              totalCount={messages.length}
              style={{ height: listHeight }}
              overscan={800}
              initialTopMostItemIndex={messages.length - 1}
              components={{
                Footer: () => <div ref={messagesEndRef} className="h-px" />
              }}
              itemContent={(index, message) => {
                const webSearchData = getWebSearchResults(message);
                return (
                  <>
                    {webSearchData && (
                      <MultiSearch 
                        result={webSearchData.result} 
                        args={webSearchData.args}
                        annotations={(message.annotations as any[] || []).filter(a => a && typeof a === 'object' && 'type' in a && a.type === 'query_completion')}
                      />
                    )}
                    <MessageComponent
                      key={message.id}
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
              return (
                <div key={message.id}>
                  {webSearchData && (
                    <MultiSearch 
                      result={webSearchData.result} 
                      args={webSearchData.args}
                      annotations={(message.annotations as any[] || []).filter(a => a && typeof a === 'object' && 'type' in a && a.type === 'query_completion')}
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
        <div className="bg-gradient-to-t from-[var(--background)] from-50% via-[var(--background)]/80 to-transparent pt-8 pb-6 w-full">
          <div className="max-w-2xl mx-auto w-full px-6 sm:px-8 sm:pl-10 relative flex flex-col items-center">
            <div className="w-full max-w-[calc(100vw-2rem)]">
              <ModelSelector
                currentModel={currentModel}
                nextModel={nextModel}
                setNextModel={setNextModel}
                position="top"
                disabledLevels={rateLimitedLevels}
                isWebSearchEnabled={isWebSearchEnabled}
              />
              <ChatInput
                input={input}
                handleInputChange={handleInputChange}
                handleSubmit={handleModelSubmit}
                isLoading={isLoading}
                stop={handleStop}
                user={user}
                modelId={nextModel}
                isWebSearchEnabled={isWebSearchEnabled}
                setIsWebSearchEnabled={setIsWebSearchEnabled}
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  )
} 