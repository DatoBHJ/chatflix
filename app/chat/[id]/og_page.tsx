// 'use client'

// import { useChat } from '@ai-sdk/react';
// import { Message } from 'ai'
// import { useState, useEffect, use, useRef, useCallback, useMemo } from 'react'
// import { useRouter, useSearchParams } from 'next/navigation'
// import { createClient } from '@/utils/supabase/client'
// import { ModelSelector } from '../../components/ModelSelector'
// import { Header } from '../../components/Header'
// import { Sidebar } from '../../components/Sidebar'
// import { convertMessage, uploadFile } from './utils'
// import { PageProps, ExtendedMessage } from './types'
// import { Attachment } from '@/lib/types'
// import { useMessages } from '@/app/hooks/useMessages'
// import { getDefaultModelId, getSystemDefaultModelId, MODEL_CONFIGS } from '@/lib/models/config'
// import '@/app/styles/attachments.css'
// import '@/app/styles/loading-dots.css'
// import { Message as MessageComponent } from '@/app/components/Message'
// import { ChatInput } from '@/app/components/ChatInput/index';
// import { VirtuosoHandle } from 'react-virtuoso';
// import VirtuosoWrapper from '@/app/components/VirtuosoWrapper';
// import Canvas from '@/app/components/Canvas';
// import { FollowUpQuestions } from '@/app/components/FollowUpQuestions';
// import { getDataProcessorData, getYouTubeLinkAnalysisData, getYouTubeSearchData, getXSearchData, getWebSearchResults, getMathCalculationData, getLinkReaderData, getImageGeneratorData, getAcademicSearchData } from '@/app/hooks/toolFunction';


// // Define a type for the annotations
// type Annotation = {
//   type: string;
//   data: any;
// };

// export default function Chat({ params }: PageProps) {
//   const { id: chatId } = use(params)
//   const router = useRouter()
//   const searchParams = useSearchParams()
//   const scrollToMessageId = searchParams.get('scrollToMessage')
//   const [currentModel, setCurrentModel] = useState('')
//   const [nextModel, setNextModel] = useState('')
//   const messagesEndRef = useRef<HTMLDivElement>(null)
//   const messagesContainerRef = useRef<HTMLDivElement>(null)
//   const virtuosoRef = useRef<VirtuosoHandle>(null);
//   const [isInitialized, setIsInitialized] = useState(false)
//   const initialMessageSentRef = useRef(false)
//   const [user, setUser] = useState<any>(null)
//   const supabase = createClient()
//   const [isSidebarOpen, setIsSidebarOpen] = useState(false)
//   const [existingMessages, setExistingMessages] = useState<Message[]>([])
//   const [isModelLoading, setIsModelLoading] = useState(true)
//   const [isSessionLoaded, setIsSessionLoaded] = useState(false)
//   const [rateLimitedLevels, setRateLimitedLevels] = useState<string[]>([])
//   const [isAgentEnabled, setisAgentEnabled] = useState(false)
//   const [hasAgentModels, setHasAgentModels] = useState(true)
//   const [isSubmitting, setIsSubmitting] = useState(false)
//   const isFullyLoaded = !isModelLoading && isSessionLoaded && !!currentModel

//   const { messages, input, handleInputChange, handleSubmit, isLoading, stop, setMessages, reload } = useChat({
//     api: '/api/chat',
//     body: {
//       id: chatId,
//       model: nextModel || getSystemDefaultModelId(),
//       chatId,
//       experimental_attachments: true,
//       isAgentEnabled
//     },
//     initialMessages: isFullyLoaded ? existingMessages : [],
//     onResponse: (response) => {
//       // print the last message
//       setMessages(prevMessages => {
//         const updatedMessages = [...prevMessages]
//         for (let i = updatedMessages.length - 1; i >= 0; i--) {
//           const message = updatedMessages[i]
//           if (message.role === 'assistant' && !(message as ExtendedMessage).model) {
//             (message as ExtendedMessage).model = nextModel
//             break
//           }
//         }
//         return updatedMessages
//       })
//     },
//     onError: (error: Error & { status?: number }) => {
//       let errorData;
//       try {
//         errorData = error.message ? JSON.parse(error.message) : null;
//       } catch (e) {
//         // If error is not JSON, try to parse from the raw message
//         try {
//           const errorMatch = error.message?.match(/\{.*\}/);
//           if (errorMatch) {
//             errorData = JSON.parse(errorMatch[0]);
//           }
//         } catch (err) {
//           console.error('Failed to parse error data:', err);
//           errorData = null;
//         }
//       }

//       // Check if it's a rate limit error either from status or parsed error data
//       if (error.status === 429 || (errorData && (errorData.error === 'Too many requests' || errorData.type === 'rate_limit'))) {
//         console.log('[Debug] Rate limit error detected:', errorData);
        
//         // Extract data from response
//         const reset = errorData?.reset || new Date(Date.now() + 60000).toISOString();
//         const limit = errorData?.limit || 10;
//         const level = errorData?.level || '';
//         const modelId = errorData?.model || nextModel;
        
//         // Update rate limit information in localStorage
//         if (level) {
//           try {
//             // Get existing rate limit levels
//             let rateLimitLevels = {};
//             const existingLevelsStr = localStorage.getItem('rateLimitLevels');
//             if (existingLevelsStr) {
//               rateLimitLevels = JSON.parse(existingLevelsStr);
//             }
            
//             // Add or update this level
//             rateLimitLevels = {
//               ...rateLimitLevels,
//               [level]: {
//                 reset: new Date(reset).getTime(),
//                 models: MODEL_CONFIGS
//                   .filter(m => m.rateLimit.level === level)
//                   .map(m => m.id)
//               }
//             };
            
//             // Save to localStorage
//             localStorage.setItem('rateLimitLevels', JSON.stringify(rateLimitLevels));
            
//             // For backward compatibility
//             const rateLimitInfo = {
//               level,
//               reset: new Date(reset).getTime(),
//               models: MODEL_CONFIGS
//                 .filter(m => m.rateLimit.level === level)
//                 .map(m => m.id)
//             };
//             localStorage.setItem('rateLimitInfo', JSON.stringify(rateLimitInfo));
//           } catch (storageError) {
//             console.error('Error storing rate limit info:', storageError);
//           }
//         }
        
//         // Include chatId and level in the redirect URL
//         router.push(`/rate-limit?${new URLSearchParams({
//           limit: limit.toString(),
//           reset,
//           model: modelId,
//           chatId: chatId,
//           level: level
//         }).toString()}`);
        
//         return;
//       }

//       // Only log non-rate-limit errors
//       console.error('Unexpected chat error:', error);
//     }
//   });

//   // Check if conversation exceeds maximum length
//   const isConversationTooLong = useMemo(() => {
//     return messages.length > 30;
//   }, [messages.length]);

//   // Determine whether to use virtualization based on message count
//   const useVirtualization = useMemo(() => {
//     if (typeof window !== 'undefined' && window.innerWidth < 768) {
//       return messages.length > 10;
//     }
//     return messages.length > 20;
//   }, [messages.length]);

//   const {
//     isRegenerating,
//     editingMessageId,
//     editingContent,
//     copiedMessageId,
//     handleCopyMessage,
//     handleEditStart,
//     handleEditCancel,
//     handleEditSave,
//     handleRegenerate,
//     setEditingContent
//   } = useMessages(chatId, user?.id)

//   const scrollToBottom = useCallback(() => {
//     if (virtuosoRef.current) {
//       virtuosoRef.current.scrollToIndex({
//         index: messages.length - 1,
//         behavior: 'smooth'
//       });
//     } else if (messagesEndRef.current) {
//       messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
//     }
//   }, [messages.length]);

//   // 특정 메시지로 스크롤하는 함수
//   const scrollToMessage = useCallback((messageId: string) => {
//     if (!messageId) return;
    
//     // 메시지 요소 찾기
//     const messageElement = document.getElementById(messageId);
//     if (messageElement) {
//       messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
//       // 메시지 강조 효과
//       messageElement.classList.add('highlight-message');
//       setTimeout(() => {
//         messageElement.classList.remove('highlight-message');
//       }, 2000);
//     }
//   }, []);

//   // URL 쿼리 파라미터로 지정된 메시지로 스크롤
//   useEffect(() => {
//     if (scrollToMessageId && messages.length > 0) {
//       // 모든 메시지가 렌더링된 후 스크롤하기 위해 짧은 지연 추가
//       setTimeout(() => {
//         scrollToMessage(scrollToMessageId);
        
//         // 스크롤 작업 후 URL에서 쿼리 파라미터 제거
//         if (typeof window !== 'undefined') {
//           const url = new URL(window.location.href);
//           url.searchParams.delete('scrollToMessage');
//           window.history.replaceState({}, '', url.pathname);
//         }
//       }, 500);
//     }
//   }, [scrollToMessageId, messages.length, scrollToMessage]);

//   useEffect(() => {
//     const getUser = async () => {
//       try {
//         setIsModelLoading(true)
        
//         const { data: { user } } = await supabase.auth.getUser()
//         if (!user) {
//           router.push('/login')
//           return
//         }
//         setUser(user)
        
//         // 사용자의 기본 모델 가져오기
//         const defaultModel = await getDefaultModelId(user.id)
//         setCurrentModel(defaultModel)
//         setNextModel(defaultModel)
//       } catch (error) {
//         console.error('사용자 정보 또는 모델 로딩 중 오류:', error)
//         // 오류 발생 시 시스템 기본 모델 사용
//         const systemDefault = getSystemDefaultModelId()
//         setCurrentModel(systemDefault)
//         setNextModel(systemDefault)
//       } finally {
//         setIsModelLoading(false)
//       }
//     }
//     getUser()
//   }, [supabase.auth, router])

//   useEffect(() => {
//     let isMounted = true

//     async function initialize() {
//       if (initialMessageSentRef.current || !user) return
      
//       try {
//         setIsModelLoading(true)
//         setIsSessionLoaded(false)
        
//         // First check URL query parameter for Agent setting
//         if (isMounted && typeof window !== 'undefined') {
//           // console.log('[Debug] Chat page - Checking Agent settings for chatId:', chatId);
          
//           const urlParams = new URLSearchParams(window.location.search);
//           const AgentSearchParam = urlParams.get('Agent');
//           // console.log('[Debug] Chat page - URL Agent parameter:', AgentSearchParam);
          
//           let shouldEnableAgent = false;
          
//           if (AgentSearchParam === 'true') {
//             // console.log('[Debug] Chat page - Setting Agent enabled from URL parameter');
//             shouldEnableAgent = true;
//             // Also update localStorage for persistence
//             localStorage.setItem(`Agent_${chatId}`, 'true');
            
//             // Clean up URL by removing the query parameter
//             const newUrl = window.location.pathname;
//             window.history.replaceState({}, document.title, newUrl);
//             // console.log('[Debug] Chat page - Cleaned up URL, removed query parameter');
//           } else {
//             // If not in URL, check localStorage as fallback
//             const savedAgentState = localStorage.getItem(`Agent_${chatId}`);
//             // console.log('[Debug] Chat page - localStorage Agent state:', savedAgentState);
            
//             if (savedAgentState === 'true') {
//               // console.log('[Debug] Chat page - Setting Agent enabled from localStorage');
//               shouldEnableAgent = true;
//             } else {
//               // console.log('[Debug] Chat page - Agent is disabled');
//             }
//           }
          
//           // Update state synchronously before proceeding
//           setisAgentEnabled(shouldEnableAgent);
          
//           // Fetch session and messages in parallel
//           const sessionPromise = supabase
//             .from('chat_sessions')
//             .select('current_model, initial_message')
//             .eq('id', chatId)
//             .eq('user_id', user.id)
//             .single();
            
//           const messagesPromise = supabase
//             .from('messages')
//             .select('*')
//             .eq('chat_session_id', chatId)
//             .eq('user_id', user.id)
//             .order('sequence_number', { ascending: true });
            
//           // Wait for both promises to resolve
//           const [sessionResult, messagesResult] = await Promise.all([
//             sessionPromise,
//             messagesPromise
//           ]);
          
//           const { data: session, error: sessionError } = sessionResult;
//           const { data: existingMessages, error: messagesError } = messagesResult;

//           if (sessionError || !session) {
//             console.error('Session error:', sessionError)
//             router.push('/')
//             return
//           }

//           // 세션에 저장된 모델이 있으면 사용, 없으면 사용자의 기본 모델 사용
//           if (session.current_model && isMounted) {
//             setCurrentModel(session.current_model)
//             setNextModel(session.current_model)
//           } else if (isMounted) {
//             // 세션에 모델이 없는 경우 사용자의 기본 모델 가져오기
//             const userDefaultModel = await getDefaultModelId(user.id)
//             setCurrentModel(userDefaultModel)
//             setNextModel(userDefaultModel)
            
//             // 세션 업데이트
//             await supabase
//               .from('chat_sessions')
//               .update({ current_model: userDefaultModel })
//               .eq('id', chatId)
//               .eq('user_id', user.id)
//           }

//           if (messagesError) {
//             console.error('Failed to load messages:', messagesError)
//             return
//           }

//           if (existingMessages?.length > 0 && isMounted) {
//             const sortedMessages = existingMessages
//               .map(convertMessage)
//               .sort((a: any, b: any) => {
//                 const seqA = (a as any).sequence_number || 0
//                 const seqB = (b as any).sequence_number || 0
//                 return seqA - seqB
//               })
//             setExistingMessages(sortedMessages)
//             setMessages(sortedMessages)
//             setIsInitialized(true)

//             if (sortedMessages.length === 1 && sortedMessages[0].role === 'user') {
//               // console.log('[Debug] Chat page - Reloading with initial message, Agent:', shouldEnableAgent);
              
//               // Only reload if we don't have an assistant message yet (fresh conversation)
//               // This prevents unnecessary API calls when refreshing a page with existing conversation
//               reload({
//                 body: {
//                   model: session.current_model || currentModel,
//                   chatId,
//                   messages: sortedMessages,
//                   isAgentEnabled: shouldEnableAgent
//                 }
//               });
//             }
//           } else if (session.initial_message && isMounted) {
//             // Only create initial message if there are no existing messages
//             // console.log('[Debug] Chat page - Creating initial message, Agent:', shouldEnableAgent);
//             const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            
//             // Start the API request immediately before updating the database
//             const initialMessage = {
//               id: messageId,
//               content: session.initial_message,
//               role: 'user' as const,
//               createdAt: new Date()
//             };
            
//             setMessages([initialMessage]);
            
//             // Start API request immediately (don't wait for DB update)
//             reload({
//               body: {
//                 model: session.current_model,
//                 chatId,
//                 messages: [initialMessage],
//                 isAgentEnabled: shouldEnableAgent
//               }
//             });
            
//             // In parallel, save the message to the database - but we know the chat session already exists
//             // since we're on the chat page and fetched the session successfully
//             Promise.resolve().then(async () => {
//               try {
//                 // Verify the session exists before inserting message
//                 const { error: checkSessionError } = await supabase
//                   .from('chat_sessions')
//                   .select('id')
//                   .eq('id', chatId)
//                   .eq('user_id', user.id)
//                   .single();
                  
//                 if (checkSessionError) {
//                   console.error('Session not found when saving initial message:', checkSessionError);
//                   return;
//                 }
                
//                 await supabase.from('messages').insert([{
//                   id: messageId,
//                   content: session.initial_message,
//                   role: 'user',
//                   created_at: new Date().toISOString(),
//                   model: session.current_model,
//                   host: 'user',
//                   chat_session_id: chatId,
//                   user_id: user.id
//                 }]);
                
//                 initialMessageSentRef.current = true;
//                 setIsInitialized(true);
//               } catch (error: any) {
//                 console.error('Failed to save initial message:', error);
//               }
//             });
//           }
//         }
//       } catch (error) {
//         console.error('Error in initialization:', error)
//         if (isMounted) {
//           router.push('/')
//         }
//       } finally {
//         if (isMounted) {
//           setIsModelLoading(false)
//           setIsSessionLoaded(true)
//         }
//       }
//     }

//     initialize()

//     return () => {
//       isMounted = false
//     }
//   }, [chatId, user])

//   useEffect(() => {
//     if (!isInitialized || !user) return

//     const channel = supabase
//       .channel('chat-messages')
//       .on(
//         'postgres_changes',
//         {
//           event: '*',
//           schema: 'public',
//           table: 'messages',
//           filter: `chat_session_id=eq.${chatId} AND user_id=eq.${user.id}`
//         },
//         async (payload) => {
//           if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
//             const { data: allMessages, error } = await supabase
//               .from('messages')
//               .select('*')
//               .eq('chat_session_id', chatId)
//               .eq('user_id', user.id)
//               .order('sequence_number', { ascending: true })

//             if (!error && allMessages) {
//               const hasSequenceGap = allMessages.some((msg, index) => {
//                 if (index === 0) return false
//                 return allMessages[index].sequence_number - allMessages[index - 1].sequence_number > 1
//               })

//               if (hasSequenceGap) {
//                 const lastMessage = allMessages[allMessages.length - 1]
//                 if (lastMessage?.role === 'assistant') {
//                   await supabase
//                     .from('messages')
//                     .delete()
//                     .eq('id', lastMessage.id)
//                     .eq('user_id', user.id)
                
//                   setMessages(allMessages.slice(0, -1).map(convertMessage))
//                   return
//                 }
//               }

//               setMessages(allMessages.map(convertMessage))
//             }
//           }
//         }
//       )
//       .subscribe()

//     return () => {
//       supabase.removeChannel(channel)
//     }
//   }, [chatId, setMessages, isInitialized])

//   // Check for rate limited levels from localStorage
//   useEffect(() => {
//     // Only run on client side
//     if (typeof window !== 'undefined') {
//       try {
//         // Check for multiple rate limited levels
//         const rateLimitLevelsStr = localStorage.getItem('rateLimitLevels')
//         if (rateLimitLevelsStr) {
//           const levelsData = JSON.parse(rateLimitLevelsStr)
//           const currentTime = Date.now()
          
//           // Filter out expired levels and collect valid ones
//           const validLevels = Object.entries(levelsData)
//             .filter(([_, data]: [string, any]) => data.reset > currentTime)
//             .map(([level, _]: [string, any]) => level)
          
//           if (validLevels.length > 0) {
//             setRateLimitedLevels(validLevels)
            
//             // If current model is rate limited, switch to a different model
//             if (currentModel) {
//               const currentModelConfig = MODEL_CONFIGS.find(m => m.id === currentModel)
//               if (currentModelConfig && validLevels.includes(currentModelConfig.rateLimit.level)) {
//                 // Find a model from a different level that's not rate limited
//                 const alternativeModel = MODEL_CONFIGS.find(m => 
//                   m.isEnabled && !validLevels.includes(m.rateLimit.level)
//                 )
//                 if (alternativeModel) {
//                   setNextModel(alternativeModel.id)
//                 }
//               }
//             }
//           } else {
//             // All rate limits have expired, remove the data
//             localStorage.removeItem('rateLimitLevels')
//           }
//         } else {
//           // For backward compatibility, check the old format
//           const rateLimitInfoStr = localStorage.getItem('rateLimitInfo')
//           if (rateLimitInfoStr) {
//             const rateLimitInfo = JSON.parse(rateLimitInfoStr)
            
//             // Check if the rate limit is still valid
//             if (rateLimitInfo.reset > Date.now()) {
//               setRateLimitedLevels([rateLimitInfo.level])
              
//               // If current model is rate limited, switch to a different model
//               if (currentModel) {
//                 const currentModelConfig = MODEL_CONFIGS.find(m => m.id === currentModel)
//                 if (currentModelConfig && currentModelConfig.rateLimit.level === rateLimitInfo.level) {
//                   // Find a model from a different level
//                   const alternativeModel = MODEL_CONFIGS.find(m => 
//                     m.isEnabled && m.rateLimit.level !== rateLimitInfo.level
//                   )
//                   if (alternativeModel) {
//                     setNextModel(alternativeModel.id)
//                   }
//                 }
//               }
//             } else {
//               // Rate limit has expired, remove it
//               localStorage.removeItem('rateLimitInfo')
//             }
//           }
//         }
//       } catch (error) {
//         console.error('Error parsing rate limit info:', error)
//       }
//     }
//   }, [currentModel])

//   // Add back initialization scroll effect only
//   useEffect(() => {
//     if (isInitialized && isFullyLoaded) {
//       scrollToBottom();
//     }
//   }, [isInitialized, isFullyLoaded, scrollToBottom]);


//   const handleModelChange = async (newModel: string) => {
//     try {
//       // Check if the selected model is in a rate-limited level
//       if (rateLimitedLevels.length > 0) {
//         const modelConfig = MODEL_CONFIGS.find(m => m.id === newModel)
//         if (modelConfig && rateLimitedLevels.includes(modelConfig.rateLimit.level)) {
//           // Don't allow changing to a rate-limited model
//           console.warn('Cannot change to a rate-limited model')
//           return false
//         }
//       }

//       const { error: sessionError } = await supabase
//         .from('chat_sessions')
//         .update({ current_model: newModel })
//         .eq('id', chatId)

//       if (sessionError) {
//         console.error('Failed to update model:', sessionError)
//         return false
//       }

//       setCurrentModel(newModel)
//       setNextModel(newModel)
//       return true
//     } catch (error) {
//       console.error('Failed to update model:', error)
//       return false
//     }
//   }

//   const handleModelSubmit = useCallback(async (e: React.FormEvent, files?: FileList) => {
//     e.preventDefault();
    
//     // 디버깅: 폼 제출 시 웹 검색 상태 출력
//     // console.log('[Debug] Chat page - handleModelSubmit called with Agent:', isAgentEnabled);
    
//     if (nextModel !== currentModel) {
//       const success = await handleModelChange(nextModel)
//       if (!success) {
//         console.error('Failed to update model. Aborting message submission.')
//         return
//       }
//     }

//     let attachments: Attachment[] = []
//     if (files?.length) {
//       try {
//         const uploadPromises = Array.from(files).map(file => uploadFile(file))
//         attachments = await Promise.all(uploadPromises)
//         console.log('[Debug] Uploaded attachments:', attachments)
//       } catch (error) {
//         console.error('Failed to upload files:', error)
//         return
//       }
//     }

//     const messageContent = []
//     if (input.trim()) {
//       messageContent.push({
//         type: 'text',
//         text: input.trim()
//       })
//     }
    
//     if (attachments.length > 0) {
//       attachments.forEach(attachment => {
//         if (attachment.contentType?.startsWith('image/')) {
//           messageContent.push({
//             type: 'image',
//             image: attachment.url
//           })
//         } else if (attachment.contentType?.includes('text') || 
//                   (attachment.name && /\.(js|jsx|ts|tsx|html|css|json|md|py|java|c|cpp|cs|go|rb|php|swift|kt|rs)$/i.test(attachment.name))) {
//           messageContent.push({
//             type: 'text_file',
//             file_url: attachment.url,
//             file_name: attachment.name
//           })
//         }
//       })
//     }

//     // Save message to Supabase first
//     const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

//     // Get the latest sequence number
//     const { data: currentMax } = await supabase
//       .from('messages')
//       .select('sequence_number')
//       .eq('chat_session_id', chatId)
//       .eq('user_id', user?.id)
//       .order('sequence_number', { ascending: false })
//       .limit(1)
//       .single()

//     const sequence = (currentMax?.sequence_number || 0) + 1

//     // Extract only text content for the content field
//     const textContent = messageContent.length === 1 ? 
//       messageContent[0].text : 
//       messageContent.filter(part => part.type === 'text')
//                    .map(part => part.text)
//                    .join(' ');

//     // Update Agent setting in localStorage instead of database
//     if (typeof window !== 'undefined') {
//       if (isAgentEnabled) {
//         localStorage.setItem(`Agent_${chatId}`, 'true');
//       } else {
//         localStorage.removeItem(`Agent_${chatId}`);
//       }
//     }

//     const { error: messageError } = await supabase
//       .from('messages')
//       .insert([{
//         id: messageId,
//         content: textContent, // Save only text content
//         role: 'user',
//         created_at: new Date().toISOString(),
//         model: nextModel,
//         host: 'user',
//         chat_session_id: chatId,
//         user_id: user?.id,
//         experimental_attachments: attachments,
//         sequence_number: sequence
//       }])

//     if (messageError) {
//       console.error('Failed to save message:', messageError)
//       return
//     }

//     // Only call API without saving to database
//     await handleSubmit(e, {
//       body: {
//         model: nextModel,
//         chatId,
//         messages: [
//           ...messages,
//           {
//             id: messageId,
//             role: 'user',
//             content: textContent,
//             experimental_attachments: attachments
//           }
//         ],
//         saveToDb: false, // Add flag to prevent saving in API
//         isAgentEnabled
//       },
//       experimental_attachments: attachments
//     })

//   }, [nextModel, currentModel, chatId, handleSubmit, input, messages, user?.id, isAgentEnabled])

//   const handleStop = useCallback(async () => {
//     try {
//       stop()

//       const lastMessage = messages[messages.length - 1]
//       if (lastMessage?.role === 'assistant') {
//         const { data: messageData } = await supabase
//           .from('messages')
//           .select('id')
//           .eq('chat_session_id', chatId)
//           .eq('user_id', user.id)
//           .eq('role', 'assistant')
//           .order('created_at', { ascending: false })
//           .limit(1)
//           .single()

//         if (messageData) {
//           await supabase
//             .from('messages')
//             .update({
//               content: lastMessage.content ,
//               reasoning: lastMessage.parts?.find(part => part.type === 'reasoning')?.reasoning || null,
//               model: currentModel,
//               created_at: new Date().toISOString()
//             })
//             .eq('id', messageData.id)
//             .eq('user_id', user.id)

//           setMessages(prevMessages => {
//             const updatedMessages = [...prevMessages]
//             const lastIndex = updatedMessages.length - 1
//             if (lastIndex >= 0 && updatedMessages[lastIndex].role === 'assistant') {
//               updatedMessages[lastIndex] = {
//                 ...updatedMessages[lastIndex],
//                 content: lastMessage.content,
//                 parts: lastMessage.parts
//               }
//             }
//             return updatedMessages
//           })
//         }
//       }
//     } catch (error) {
//       console.error('Error in handleStop:', error)
//     }
//   }, [stop, messages, currentModel, chatId, user?.id, setMessages])


//   // Handle toggling the agent with rate-limit awareness
//   const handleAgentToggle = (newState: boolean) => {
//     // Only allow enabling agent if agent models are available
//     if (newState && !hasAgentModels) {
//       console.warn('Cannot enable agent: No non-rate-limited agent models available')
//       return
//     }
//     setisAgentEnabled(newState)
//   }
  
//   // Create a handler that matches the Dispatch<SetStateAction<boolean>> type
//   const setAgentEnabledHandler: React.Dispatch<React.SetStateAction<boolean>> = (value) => {
//     const newValue = typeof value === 'function' ? value(isAgentEnabled) : value;
//     handleAgentToggle(newValue);
//   };

//   // Add a handler for follow-up question clicks
//   const handleFollowUpQuestionClick = async (question: string) => {
//     if (isSubmitting) return;
//     setIsSubmitting(true);
    
//     try {
//       // Skip updating the input value first and go straight to submission
//       console.log('[Debug] Directly submitting follow-up question:', question);
      
//       // Create a message ID for the new message
//       const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 15)}`;
      
//       // Get the latest sequence number first
//       const { data: currentMax } = await supabase
//         .from('messages')
//         .select('sequence_number')
//         .eq('chat_session_id', chatId)
//         .eq('user_id', user.id)
//         .order('sequence_number', { ascending: false })
//         .limit(1)
//         .single();

//       const sequence = (currentMax?.sequence_number || 0) + 1;
      
//       // Add the question to the message list directly
//       const newMessage = {
//         id: messageId,
//         content: question,
//         role: 'user',
//         createdAt: new Date(),
//         sequence_number: sequence
//       } as Message;
      
//       // Add to UI messages right away
//       setMessages(prev => [...prev, newMessage]);
      
//       // Save to database with sequence number
//       await supabase
//         .from('messages')
//         .insert([{
//           id: messageId,
//           content: question,
//           role: 'user',
//           created_at: new Date().toISOString(),
//           model: nextModel,
//           host: 'user',
//           chat_session_id: chatId,
//           user_id: user.id,
//           sequence_number: sequence
//         }]);
      
//       // Trigger the AI response via the chat API
//       reload({
//         body: {
//           model: nextModel,
//           chatId,
//           experimental_attachments: [],
//           isAgentEnabled,
//           messages: [...messages, newMessage]
//         }
//       });
//     } catch (error) {
//       console.error('Error submitting follow-up question:', error);
//     } finally {
//       setIsSubmitting(false);
//     }
//   };

//   // 모든 데이터가 로드되기 전에는 로딩 화면 표시
//   if (!isFullyLoaded || !user) {
//     return <div className="flex h-screen items-center justify-center">Chatflix.app</div>
//   }

    
//   // Extract agent reasoning data from annotations and tool_results
//   function getAgentReasoningData(messages: Message[]) {
//     const reasoningData = messages.flatMap(message => {
//       const annotations = ((message.annotations || []) as Annotation[])
//         .filter(a => a.type === 'agent_reasoning' || a.type === 'agent_reasoning_progress');
        
//       const toolResultsReasoning = (message as any).tool_results?.agentReasoning 
//         ? [{ type: 'agent_reasoning', data: (message as any).tool_results.agentReasoning }] 
//         : [];
        
//       return [...annotations, ...toolResultsReasoning];
//     });
    
//     const completeAnnotation = reasoningData.find(a => 
//       a.type === 'agent_reasoning' && (a.data.isComplete === true || a.data.isComplete === undefined)
//     );
    
//     const progressAnnotations = reasoningData
//       .filter(a => a.type === 'agent_reasoning_progress')
//       .sort((a, b) => new Date(a.data.timestamp).getTime() - new Date(b.data.timestamp).getTime());
    
//     const formatReasoningData = (data: any) => ({
//       reasoning: data.reasoning || '',
//       needsWebSearch: Boolean(data.needsWebSearch),
//       needsCalculator: Boolean(data.needsCalculator),
//       needsLinkReader: Boolean(data.needsLinkReader),
//       needsImageGenerator: Boolean(data.needsImageGenerator),
//       needsAcademicSearch: Boolean(data.needsAcademicSearch),
//       needsXSearch: Boolean(data.needsXSearch),
//       needsYouTubeSearch: Boolean(data.needsYouTubeSearch),
//       needsYouTubeLinkAnalyzer: Boolean(data.needsYouTubeLinkAnalyzer),
//       needsDataProcessor: Boolean(data.needsDataProcessor),
//       timestamp: data.timestamp,
//       isComplete: data.isComplete ?? true
//     });
    
//     return {
//       completeData: completeAnnotation ? formatReasoningData(completeAnnotation.data) : null,
//       progressData: progressAnnotations.map(a => ({ ...formatReasoningData(a.data), isComplete: false }))
//     };
//   }

//   return (
//     <main className="flex-1 relative h-full">
//       <Header 
//         isSidebarOpen={isSidebarOpen}
//         onSidebarToggle={() => setIsSidebarOpen(!isSidebarOpen)}
//         user={user}
//       />
      
//       <div className={`fixed left-0 top-0 h-full transform transition-all duration-300 ease-in-out z-50 ${
//         isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
//       }`}>
//         <Sidebar user={user} onClose={() => setIsSidebarOpen(false)} />
//       </div>

//       <div
//         className={`fixed inset-0 backdrop-blur-[1px] bg-black transition-all duration-200 ease-in-out z-40 ${
//           isSidebarOpen ? 'opacity-40 pointer-events-auto' : 'opacity-0 pointer-events-none'
//         }`}
//         onClick={() => setIsSidebarOpen(false)}
//       />

//       <div className="flex-1 overflow-y-auto pb-4 sm:pb-12 pt-10 sm:pt-16" style={{ height: 'calc(100vh - 76px)' }}>
//         <div 
//           className="messages-container py-4 max-w-2xl mx-auto px-4 sm:px-6 w-full"
//           ref={messagesContainerRef}
//         >
//           {useVirtualization ? (
//             <VirtuosoWrapper
//               messages={messages}
//               messagesEndRef={messagesEndRef}
//               parentContainerRef={messagesContainerRef}
//               renderMessage={(message, index) => {
//                 const webSearchData = getWebSearchResults(message);
//                 const mathCalculationData = getMathCalculationData(message);
//                 const linkReaderData = getLinkReaderData(message);
//                 const imageGeneratorData = getImageGeneratorData(message);
//                 const academicSearchData = getAcademicSearchData(message);
//                 const { completeData: agentReasoningData, progressData: agentReasoningProgress } = getAgentReasoningData([message]);
//                 const xSearchData = getXSearchData(message);
//                 const youTubeSearchData = getYouTubeSearchData(message);
//                 const youTubeLinkAnalysisData = getYouTubeLinkAnalysisData(message);
//                 const dataProcessorData = getDataProcessorData(message);
                
//                 return (
//                   <>
//                     {(webSearchData || mathCalculationData || linkReaderData || imageGeneratorData || academicSearchData || agentReasoningData || agentReasoningProgress.length > 0 || xSearchData || youTubeSearchData || youTubeLinkAnalysisData || dataProcessorData) && (
//                       <Canvas 
//                         webSearchData={webSearchData}
//                         mathCalculationData={mathCalculationData}
//                         linkReaderData={linkReaderData}
//                         imageGeneratorData={imageGeneratorData}
//                         academicSearchData={academicSearchData}
//                         agentReasoningData={agentReasoningData}
//                         agentReasoningProgress={agentReasoningProgress}
//                         xSearchData={xSearchData}
//                         youTubeSearchData={youTubeSearchData}
//                         youTubeLinkAnalysisData={youTubeLinkAnalysisData}
//                         dataProcessorData={dataProcessorData}
//                       />
//                     )}
//                     <MessageComponent
//                       message={message}
//                       currentModel={currentModel}
//                       isRegenerating={isRegenerating}
//                       editingMessageId={editingMessageId}
//                       editingContent={editingContent}
//                       copiedMessageId={copiedMessageId}
//                       onRegenerate={(messageId: string) => handleRegenerate(messageId, messages, setMessages, currentModel, reload)}
//                       onCopy={handleCopyMessage}
//                       onEditStart={handleEditStart}
//                       onEditCancel={handleEditCancel}
//                       onEditSave={(messageId: string) => handleEditSave(messageId, currentModel, messages, setMessages, reload)}
//                       setEditingContent={setEditingContent}
//                       chatId={chatId}
//                       isStreaming={isLoading && message.role === 'assistant' && message.id === messages[messages.length - 1]?.id}
//                     />
//                     {/* Add loading message at the end if the last message is from the user and we're loading */}
//                     {isLoading && index === messages.length - 1 && message.role === 'user' && (
//                       <MessageComponent
//                         message={{
//                           id: 'loading-message',
//                           role: 'assistant',
//                           content: '',
//                           createdAt: new Date()
//                         }}
//                         currentModel={currentModel}
//                         isRegenerating={false}
//                         editingMessageId={null}
//                         editingContent={''}
//                         copiedMessageId={null}
//                         onRegenerate={() => () => {}}
//                         onCopy={() => {}}
//                         onEditStart={() => {}}
//                         onEditCancel={() => {}}
//                         onEditSave={() => {}}
//                         setEditingContent={() => {}}
//                         chatId={chatId}
//                         isStreaming={true}
//                       />
//                     )}
                    
//                     {/* Add follow-up questions after the last assistant message */}
//                     {useVirtualization && !isLoading && index === messages.length - 1 && message.role === 'assistant' && user && (
//                       <FollowUpQuestions 
//                         chatId={chatId} 
//                         userId={user.id} 
//                         messages={messages} 
//                         onQuestionClick={handleFollowUpQuestionClick} 
//                       />
//                     )}
//                   </>
//                 );
//               }}
//             />
//           ) : (
//             messages.map((message) => {
//               const webSearchData = getWebSearchResults(message);
//               const mathCalculationData = getMathCalculationData(message);
//               const linkReaderData = getLinkReaderData(message);
//               const imageGeneratorData = getImageGeneratorData(message);
//               const academicSearchData = getAcademicSearchData(message);
//               const { completeData: agentReasoningData, progressData: agentReasoningProgress } = getAgentReasoningData([message]);
//               const xSearchData = getXSearchData(message);
//               const youTubeSearchData = getYouTubeSearchData(message);
//               const youTubeLinkAnalysisData = getYouTubeLinkAnalysisData(message);
//               const dataProcessorData = getDataProcessorData(message);
//               return (
//                 <div key={message.id}>
//                   {(webSearchData || mathCalculationData || linkReaderData || imageGeneratorData || academicSearchData || agentReasoningData || agentReasoningProgress.length > 0 || xSearchData || youTubeSearchData || youTubeLinkAnalysisData || dataProcessorData) && (
//                     <Canvas 
//                       webSearchData={webSearchData}
//                       mathCalculationData={mathCalculationData}
//                       linkReaderData={linkReaderData}
//                       imageGeneratorData={imageGeneratorData}
//                       academicSearchData={academicSearchData}
//                       agentReasoningData={agentReasoningData}
//                       agentReasoningProgress={agentReasoningProgress}
//                       xSearchData={xSearchData}
//                       youTubeSearchData={youTubeSearchData}
//                       youTubeLinkAnalysisData={youTubeLinkAnalysisData}
//                       dataProcessorData={dataProcessorData}
//                     />
//                   )}
//                   <MessageComponent
//                     message={message}
//                     currentModel={currentModel}
//                     isRegenerating={isRegenerating}
//                     editingMessageId={editingMessageId}
//                     editingContent={editingContent}
//                     copiedMessageId={copiedMessageId}
//                     onRegenerate={(messageId: string) => handleRegenerate(messageId, messages, setMessages, currentModel, reload)}
//                     onCopy={handleCopyMessage}
//                     onEditStart={handleEditStart}
//                     onEditCancel={handleEditCancel}
//                     onEditSave={(messageId: string) => handleEditSave(messageId, currentModel, messages, setMessages, reload)}
//                     setEditingContent={setEditingContent}
//                     chatId={chatId}
//                     isStreaming={isLoading && message.role === 'assistant' && message.id === messages[messages.length - 1]?.id}
//                   />
//                 </div>
//               );
//             })
//           )}
//           {/* Show immediate loading response after sending message */}
//           {isLoading && messages.length > 0 && messages[messages.length - 1]?.role === 'user' && (
//             <div>
//               <MessageComponent
//                 message={{
//                   id: 'loading-message',
//                   role: 'assistant',
//                   content: '',
//                   createdAt: new Date()
//                 }}
//                 currentModel={currentModel}
//                 isRegenerating={false}
//                 editingMessageId={null}
//                 editingContent={''}
//                 copiedMessageId={null}
//                 onRegenerate={() => () => {}}
//                 onCopy={() => {}}
//                 onEditStart={() => {}}
//                 onEditCancel={() => {}}
//                 onEditSave={() => {}}
//                 setEditingContent={() => {}}
//                 chatId={chatId}
//                 isStreaming={true}
//               />
//             </div>
//           )}
          
//           {/* Add follow-up questions only if virtualization is not used */}
//           {!useVirtualization && !isLoading && messages.length > 0 && messages[messages.length - 1]?.role === 'assistant' && user && (
//             <FollowUpQuestions 
//               chatId={chatId} 
//               userId={user.id} 
//               messages={messages} 
//               onQuestionClick={handleFollowUpQuestionClick} 
//             />
//           )}
          
//           <div ref={messagesEndRef} className="h-px" />
//         </div>
//       </div>

//       <div className="fixed inset-x-0 bottom-0 z-10 w-full">
//         <div className="bg-gradient-to-t from-[var(--background)] from-50% via-[var(--background)]/80 to-transparent pt-0 pb-6 w-full">
//           <div className="max-w-2xl mx-auto w-full px-6 sm:px-8 relative flex flex-col items-center">
//             <div className="w-full max-w-[calc(100vw-2rem)]">
//               {isConversationTooLong && (
//                 <div className="p-3 text-center text-[var(--foreground-secondary)] backdrop-blur-md text-sm sm:text-base rounded-md">
//                   Hmm, I might be forgetting our earlier conversation. <br />
//                   Want to start a <a href="/" className="text-blue-500 hover:underline">fresh chat</a> for better results? 😊
//                 </div>
//               )}
//               <ModelSelector
//                 currentModel={currentModel}
//                 nextModel={nextModel}
//                 setNextModel={setNextModel}
//                 position="top"
//                 disabledLevels={rateLimitedLevels}
//                 isAgentEnabled={isAgentEnabled}
//                 onAgentAvailabilityChange={setHasAgentModels}
//               />
//               <ChatInput
//                 input={input}
//                 handleInputChange={handleInputChange}
//                 handleSubmit={handleModelSubmit}
//                 isLoading={isLoading}
//                 stop={handleStop}
//                 user={{...user, hasAgentModels}}
//                 modelId={nextModel}
//                 isAgentEnabled={isAgentEnabled}
//                 setisAgentEnabled={setAgentEnabledHandler}
//               />
//             </div>
//           </div>
//         </div>
//       </div>
//     </main>
//   )
// } 