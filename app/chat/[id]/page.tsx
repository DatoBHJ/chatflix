'use client'

import { useChat } from 'ai/react'
import { Message } from 'ai'
import { useState, useEffect, use, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'
import rehypeHighlight from 'rehype-highlight'
import { IconRefresh, IconCopy, IconCheck } from '../../components/icons'
import { createClient } from '@/utils/supabase/client'
import { DatabaseMessage } from '@/lib/types'
import { ModelSelector } from '../../components/ModelSelector'
import { ChatInput } from '../../components/ChatInput'
import { MODEL_OPTIONS } from '../../components/ModelSelector'
import { Header } from '../../components/Header'
import { Sidebar } from '../../components/Sidebar'

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

interface ExtendedMessage extends Message {
  model?: string;
  isEditing?: boolean;
  sequence_number?: number;
}

// 메시지 변환 함수를 컴포넌트 외부로 이동
const convertMessage = (msg: DatabaseMessage): ExtendedMessage => {
  const baseMessage = {
    id: msg.id,
    content: msg.content,
    role: msg.role as 'user' | 'assistant' | 'system',
    createdAt: new Date(msg.created_at),
    model: msg.model
  };

  if (msg.role === 'assistant' && msg.reasoning) {
    return {
      ...baseMessage,
      parts: [
        {
          type: 'reasoning' as const,
          reasoning: msg.reasoning
        },
        {
          type: 'text' as const,
          text: msg.content
        }
      ]
    };
  }

  return baseMessage;
};

function MarkdownContent({ content }: { content: string }) {
  const [copied, setCopied] = useState<{[key: string]: boolean}>({});

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(prev => ({ ...prev, [text]: true }));
    setTimeout(() => {
      setCopied(prev => ({ ...prev, [text]: false }));
    }, 2000);
  };

  // Add mention styling function
  const styleMentions = (text: string) => {
    // 확장된 정규식: 더 많은 특수문자 포함
    const mentionRegex = /@([\w?!.,_\-+=@#$%^&*()<>{}\[\]|/\\~`]+)/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = mentionRegex.exec(text)) !== null) {
      // Add text before mention
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }
      
      // Add styled mention
      parts.push(
        <span key={match.index} className="mention-tag">
          {match[0]}
        </span>
      );
      
      lastIndex = match.index + match[0].length;
    }
    
    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }
    
    return parts;
  };

  return (
    <ReactMarkdown
      className="message-content"
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw, rehypeSanitize, rehypeHighlight]}
      components={{
        p: ({ children }) => {
          if (typeof children === 'string') {
            return <p className="my-3 leading-relaxed">{styleMentions(children)}</p>;
          }
          return <p className="my-3 leading-relaxed">{children}</p>;
        },
        a: ({ href, children }) => (
          <a 
            href={href} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-[var(--foreground)] border-b border-[var(--muted)] hover:border-[var(--foreground)] transition-colors"
          >
            {children}
          </a>
        ),
        code: ({ className, children, ...props }: any) => {
          const match = /language-(\w+)/.exec(className || '');
          const isInline = !match;
          
          const extractText = (node: any): string => {
            if (typeof node === 'string') return node;
            if (Array.isArray(node)) return node.map(extractText).join('');
            if (node?.props?.children) return extractText(node.props.children);
            return String(node || '');
          };
          
          const codeText = extractText(children);
          
          if (isInline) {
            return (
              <code className="font-mono text-sm bg-[var(--inline-code-bg)] text-[var(--inline-code-text)] px-1.5 py-0.5 rounded" {...props}>
                {children}
              </code>
            );
          }
          
          return (
            <div className="message-code group relative my-6 max-w-full overflow-hidden">
              <div className="message-code-header flex items-center justify-between px-4 py-2">
                <span className="text-xs uppercase tracking-wider text-[var(--muted)] break-all">
                  {match?.[1] || 'text'}
                </span>
                <button
                  onClick={() => handleCopy(codeText)}
                  className="text-xs uppercase tracking-wider px-2 py-1 
                           text-[var(--muted)] hover:text-[var(--foreground)] 
                           transition-colors flex items-center gap-1 whitespace-nowrap ml-2"
                >
                  {copied[codeText] ? (
                    <>
                      <span className="">Copied</span>
                    </>
                  ) : (
                    <>Copy</>
                  )}
                </button>
              </div>
              <pre className="overflow-x-auto p-4 m-0 bg-[var(--code-bg)] text-[var(--code-text)] max-w-full whitespace-pre-wrap break-all">
                {/* <code className={`${className} break-words whitespace-pre-wrap`} {...props}> */}
                  {children}
                {/* </code> */}
              </pre>
            </div>
          );
        },
        table: ({ children }) => (
          <div className="overflow-x-auto my-6">
            <table className="w-full border-collapse">{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th className="bg-[var(--accent)] font-medium text-[var(--muted)] uppercase tracking-wider p-3 border border-[var(--accent)]">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="p-3 border border-[var(--accent)]">{children}</td>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-[var(--muted)] pl-4 my-6 text-[var(--muted)] italic">
            {children}
          </blockquote>
        ),
        ul: ({ children }) => (
          <ul className="list-disc list-inside space-y-2 my-4 ml-4">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-inside space-y-2 my-4 ml-4">
            {children}
          </ol>
        ),
        h1: ({ children }) => (
          <h1 className="text-2xl font-bold mt-8 mb-4">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-xl font-bold mt-6 mb-3">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-lg font-bold mt-5 mb-2">{children}</h3>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

// Add this component for the reasoning section
function ReasoningSection({ content }: { content: string }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);
  
  // 컨텐츠가 변경될 때마다 자동 스크롤
  useEffect(() => {
    if (contentRef.current && isExpanded) {
      const scrollContainer = contentRef.current;
      const scrollHeight = scrollContainer.scrollHeight;
      
      // 부드러운 스크롤 애니메이션
      const startScroll = () => {
        const currentScroll = scrollContainer.scrollTop;
        const targetScroll = scrollHeight - scrollContainer.clientHeight;
        const distance = targetScroll - currentScroll;
        
        if (distance > 0) {
          // 현재 위치에서 목표 위치까지 부드럽게 스크롤
          scrollContainer.scrollTo({
            top: targetScroll,
            behavior: 'smooth'
          });
        }
      };

      // 스크롤 시작
      startScroll();
    }
  }, [content, isExpanded]); // content가 변경될 때마다 실행

  return (
    <div className="message-reasoning">
      <div 
        className="message-reasoning-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span>Thinking</span>
        <svg 
          className={`message-reasoning-icon ${isExpanded ? 'expanded' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </div>
      <div 
        ref={contentRef}
        className={`message-reasoning-content ${isExpanded ? 'expanded' : ''}`}
        style={{ 
          height: isExpanded ? 'auto' : '0',
          marginTop: isExpanded ? '0.5rem' : '0',
          opacity: isExpanded ? 1 : 0
        }}
      >
        <MarkdownContent content={content} />
      </div>
    </div>
  );
}

export default function Chat({ params }: PageProps) {
  const { id: chatId } = use(params)
  const router = useRouter()
  const [currentModel, setCurrentModel] = useState('claude-3-5-sonnet-latest')
  const [nextModel, setNextModel] = useState(currentModel)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const initialMessageSentRef = useRef(false)
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)
  const [user, setUser] = useState<any>(null)
  const supabase = createClient()
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  // Add user authentication check
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setUser(user)
    }
    getUser()
  }, [supabase.auth, router])

  const { messages, input, handleInputChange, handleSubmit, isLoading, stop, setMessages, reload } = useChat({
    api: '/api/chat',
    body: {
      model: currentModel,
      chatId,
    },
    id: chatId,
    initialMessages: [],
    onResponse: (response) => {
      console.log('[Client] Response received:', response);
      
      // Add model information as soon as the message is created
      setMessages(prevMessages => {
        const updatedMessages = [...prevMessages];
        // 마지막 메시지부터 역순으로 검색하여 모델이 없는 첫 번째 assistant 메시지를 찾음
        for (let i = updatedMessages.length - 1; i >= 0; i--) {
          const message = updatedMessages[i];
          if (message.role === 'assistant' && !(message as ExtendedMessage).model) {
            (message as ExtendedMessage).model = currentModel;
            break; // 첫 번째 메시지를 찾은 후 즉시 종료
          }
        }
        return updatedMessages;
      });
    },
    onError: (error: Error & { data?: string }) => {
      // Add error message as AI response
      const errorResponse = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Rate limit reached. Please try other models.',
        // content: 'Rate limit reached. Please try again later.',
        createdAt: new Date(),
        model: currentModel
      } as ExtendedMessage;

      setMessages(prevMessages => [...prevMessages, errorResponse]);
    }
  });

  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [])

  // 메시지가 업데이트될 때마다 스크롤
  useEffect(() => {
    scrollToBottom()
  }, [scrollToBottom])

  // 초기 데이터 로드
  useEffect(() => {
    let isMounted = true;

    async function initialize() {
      if (initialMessageSentRef.current || !user) return;
      
      try {
        // 1. 세션 확인 및 모델 정보 로드
        const { data: session, error: sessionError } = await supabase
          .from('chat_sessions')
          .select('current_model, initial_message')
          .eq('id', chatId)
          .eq('user_id', user.id)
          .single();

        if (sessionError) {
          console.error('Session error:', sessionError);
          router.push('/');
          return;
        }

        if (!session) {
          console.error('Session not found');
          router.push('/');
          return;
        }

        if (session.current_model && isMounted) {
          setCurrentModel(session.current_model);
          setNextModel(session.current_model);
        }

        // 2. 기존 메시지 로드 (시퀀스 번호로 정렬)
        const { data: existingMessages, error: messagesError } = await supabase
          .from('messages')
          .select('*')
          .eq('chat_session_id', chatId)
          .eq('user_id', user.id)
          .order('sequence_number', { ascending: true });

        if (messagesError) {
          console.error('Failed to load messages:', messagesError);
          return;
        }

        if (existingMessages && existingMessages.length > 0 && isMounted) {
          // 기존 메시지가 있는 경우
          const sortedMessages = existingMessages
            .map(convertMessage)
            .sort((a: any, b: any) => {
              const seqA = (a as any).sequence_number || 0;
              const seqB = (b as any).sequence_number || 0;
              return seqA - seqB;
            });
          setMessages(sortedMessages);
          setIsInitialized(true);
        } else if (session.initial_message && isMounted) {
          // 초기 메시지만 있는 경우
          const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          
          // 사용자 메시지 저장
          const { error: insertError } = await supabase.from('messages').insert([{
            id: messageId,
            content: session.initial_message,
            role: 'user',
            created_at: new Date().toISOString(),
            model: session.current_model,
            host: 'user',
            chat_session_id: chatId,
            user_id: user.id
          }]);

          if (insertError) {
            console.error('Failed to insert message:', insertError);
            return;
          }

          // UI에 메시지 추가
          setMessages([{
            id: messageId,
            content: session.initial_message,
            role: 'user',
            createdAt: new Date()
          }]);

          initialMessageSentRef.current = true;
          setIsInitialized(true);

          // AI 응답 요청 시작
          if (isMounted) {
            reload({
              body: {
                model: session.current_model,
                chatId,
                messages: [{
                  id: messageId,
                  content: session.initial_message,
                  role: 'user',
                  createdAt: new Date()
                }]
              }
            });
          }
        }
      } catch (error) {
        console.error('Error in initialization:', error);
        if (isMounted) {
          router.push('/');
        }
      }
    }

    initialize();

    return () => {
      isMounted = false;
    };
  }, [chatId, user]);

  // 실시간 업데이트 구독
  useEffect(() => {
    if (!isInitialized || !user) return;

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
            // 모든 메시지를 다시 로드하여 시퀀스 순서 보장
            const { data: allMessages, error } = await supabase
              .from('messages')
              .select('*')
              .eq('chat_session_id', chatId)
              .eq('user_id', user.id)
              .order('sequence_number', { ascending: true });

            if (!error && allMessages) {
              // 시퀀스 번호의 연속성 검사
              const hasSequenceGap = allMessages.some((msg, index) => {
                if (index === 0) return false;
                const prevSeq = allMessages[index - 1].sequence_number;
                const currentSeq = msg.sequence_number;
                return currentSeq - prevSeq > 1;
              });

              if (hasSequenceGap) {
                console.error('Sequence number gap detected, removing last message');
                // 마지막 메시지 삭제
                const lastMessage = allMessages[allMessages.length - 1];
                if (lastMessage && lastMessage.role === 'assistant') {
                  await supabase
                    .from('messages')
                    .delete()
                    .eq('id', lastMessage.id)
                    .eq('user_id', user.id);
                
                  // 마지막 메시지를 제외한 메시지들만 UI에 표시
                  const validMessages = allMessages.slice(0, -1);
                  setMessages(prevMessages => {
                    const convertedMessages = validMessages.map(msg => {
                      const convertedMsg = convertMessage(msg);
                      if (convertedMsg.role === 'assistant') {
                        (convertedMsg as ExtendedMessage).model = msg.model;
                      }
                      return convertedMsg;
                    });

                    return convertedMessages.sort((a: any, b: any) => {
                      const seqA = (a as any).sequence_number || 0;
                      const seqB = (b as any).sequence_number || 0;
                      return seqA - seqB;
                    });
                  });
                  return;
                }
              }

              // 시퀀스 번호가 정상인 경우 기존 로직 실행
              setMessages(prevMessages => {
                const convertedMessages = allMessages.map(msg => {
                  const convertedMsg = convertMessage(msg);
                  if (convertedMsg.role === 'assistant') {
                    (convertedMsg as ExtendedMessage).model = msg.model;
                  }
                  return convertedMsg;
                });

                return convertedMessages.sort((a: any, b: any) => {
                  const seqA = (a as any).sequence_number || 0;
                  const seqB = (b as any).sequence_number || 0;
                  return seqA - seqB;
                });
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatId, setMessages, isInitialized]);

  // 모델 변경 핸들러 메모이제이션
  const handleModelSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (nextModel !== currentModel) {
      try {
        await supabase
          .from('chat_sessions')
          .update({ current_model: nextModel })
          .eq('id', chatId);
        
        setCurrentModel(nextModel);
      } catch (error) {
        console.error('Failed to update model:', error);
      }
    }

    await handleSubmit(e, {
      body: {
        model: nextModel,
        chatId
      }
    });
  }, [nextModel, currentModel, chatId, handleSubmit, setCurrentModel]);

  // 재생성 핸들러
  const handleReload = useCallback((messageId: string) => async (e: React.MouseEvent) => {
    e.preventDefault()
    
    try {
      setIsRegenerating(true);
      
      // 메시지 ID 유효성 검사
      if (!messageId || typeof messageId !== 'string') {
        console.error('Invalid message ID');
        return;
      }
      
      const messageIndex = messages.findIndex(m => m.id === messageId)
      if (messageIndex === -1) {
        console.error('Message not found in current messages');
        return;
      }

      const currentMessage = messages[messageIndex];
      if (!currentMessage) {
        console.error('Current message not found');
        return;
      }
      
      // 이전 사용자 메시지 찾기
      const targetUserMessage = messages
        .slice(0, messageIndex)
        .reverse()
        .find(m => m.role === 'user')
      
      if (!targetUserMessage) {
        console.error('Previous user message not found');
        return;
      }

      try {
        // 1. 현재 메시지 인덱스까지의 모든 메시지의 시퀀스 번호 가져오기
        const { data: validMessages, error: messagesError } = await supabase
          .from('messages')
          .select('sequence_number')
          .eq('chat_session_id', chatId)
          .eq('user_id', user.id)
          .order('sequence_number', { ascending: true })
          .limit(messageIndex);

        if (messagesError) {
          console.error('Messages error:', messagesError);
          throw new Error('Failed to get messages');
        }

        // 2. 마지막으로 저장된 메시지의 시퀀스 번호 이후의 메시지들 삭제
        const lastSequenceNumber = validMessages && validMessages.length > 0
          ? validMessages[validMessages.length - 1].sequence_number
          : 0;

        const { error: deleteError } = await supabase
          .from('messages')
          .delete()
          .eq('chat_session_id', chatId)
          .eq('user_id', user.id)
          .gt('sequence_number', lastSequenceNumber);

        if (deleteError) {
          throw new Error('Failed to delete messages: ' + deleteError.message);
        }

        // 3. UI 업데이트 - 현재 메시지 이전까지만 유지
        const updatedMessages = messages.slice(0, messageIndex);
        setMessages(updatedMessages);

        // 4. 새로운 메시지 생성 요청
        await reload({
          body: {
            messages: [...updatedMessages, {
              id: targetUserMessage.id,
              content: targetUserMessage.content,
              role: targetUserMessage.role,
              createdAt: targetUserMessage.createdAt
            }],
            model: currentModel,
            chatId
          }
        });

      } catch (error) {
        console.error('Error in regeneration:', error);
        // 에러 발생 시 원래 메시지 상태로 복구
        setMessages(messages);
        throw error;
      }
    } catch (error) {
      console.error('Regeneration failed:', error);
    } finally {
      setIsRegenerating(false);
    }
  }, [messages, setMessages, currentModel, chatId, reload, user?.id, supabase]);

  const handleCopyMessage = async (message: Message) => {
    let textToCopy = '';
    if (message.parts) {
      textToCopy = message.parts
        .filter(part => part.type === 'text')
        .map(part => (part as { text: string }).text)
        .join('\n');
    } else {
      textToCopy = message.content;
    }
    
    await navigator.clipboard.writeText(textToCopy);
    setCopiedMessageId(message.id);
    setTimeout(() => {
      setCopiedMessageId(null);
    }, 2000);
  };

  // 중단 핸들러 추가
  const handleStop = useCallback(async () => {
    try {
      // 먼저 스트리밍을 중단
      stop();

      // 현재 메시지 상태 가져오기
      const currentMessages = messages;
      const lastMessage = currentMessages[currentMessages.length - 1];
      
      if (lastMessage && lastMessage.role === 'assistant') {
        try {
          // 메시지 ID 가져오기
          const { data: messageData, error: messageError } = await supabase
            .from('messages')
            .select('id')
            .eq('chat_session_id', chatId)
            .eq('user_id', user.id)
            .eq('role', 'assistant')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          if (messageError) {
            console.error('Failed to get message ID:', messageError);
            return;
          }

          // 현재까지의 내용을 데이터베이스에 저장
          const { error: updateError } = await supabase
            .from('messages')
            .update({
              content: lastMessage.content || 'Response interrupted',
              reasoning: lastMessage.parts?.find(part => part.type === 'reasoning')?.reasoning || null,
              model: currentModel,
              created_at: new Date().toISOString()
            })
            .eq('id', messageData.id)
            .eq('user_id', user.id);

          if (updateError) {
            console.error('Failed to update message on stop:', updateError);
          }

          // UI 메시지 업데이트 및 상태 정리
          setMessages(prevMessages => {
            const updatedMessages = [...prevMessages];
            const lastIndex = updatedMessages.length - 1;
            if (lastIndex >= 0 && updatedMessages[lastIndex].role === 'assistant') {
              updatedMessages[lastIndex] = {
                ...updatedMessages[lastIndex],
                content: lastMessage.content || 'Response interrupted',
                parts: lastMessage.parts || undefined
              };
            }
            return updatedMessages;
          });

          // 스트리밍 상태 초기화를 위해 약간의 지연 추가
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.error('Error saving stopped message:', error);
        }
      }
    } catch (error) {
      console.error('Error in handleStop:', error);
    }
  }, [stop, messages, currentModel, chatId, user?.id, supabase, setMessages]);

  const handleEditStart = (message: Message) => {
    setEditingMessageId(message.id);
    setEditingContent(message.content);
  };

  const handleEditCancel = () => {
    setEditingMessageId(null);
    setEditingContent('');
  };

  const handleEditSave = async (messageId: string) => {
    try {
      // 현재 메시지의 인덱스 찾기
      const messageIndex = messages.findIndex(msg => msg.id === messageId);
      if (messageIndex === -1) return;

      const currentMessage = messages[messageIndex];

      // 먼저 UI 업데이트 (즉각적인 반응을 위해)
      const updatedMessages = messages.slice(0, messageIndex + 1).map(msg =>
        msg.id === messageId
          ? {
              ...msg,
              content: editingContent,
              parts: msg.parts ? [
                ...msg.parts.map(part => 
                  part.type === 'text' 
                    ? { ...part, text: editingContent }
                    : part
                )
              ] : undefined
            }
          : msg
      );
      setMessages(updatedMessages);

      // 편집 모드 종료 (UI 업데이트 후 즉시)
      setEditingMessageId(null);
      setEditingContent('');

      // 데이터베이스 업데이트
      const { data: dbMessage, error: seqError } = await supabase
        .from('messages')
        .select('sequence_number')
        .eq('id', messageId)
        .eq('user_id', user.id)
        .single();

      if (seqError) {
        console.error('Failed to get message sequence:', seqError);
        return;
      }

      // 메시지 내용 업데이트
      const { error } = await supabase
        .from('messages')
        .update({
          content: editingContent,
          is_edited: true,
          edited_at: new Date().toISOString()
        })
        .eq('id', messageId)
        .eq('user_id', user.id);

      if (error) throw error;

      // 편집된 메시지 이후의 메시지 삭제
      const { error: deleteError } = await supabase
        .from('messages')
        .delete()
        .eq('chat_session_id', chatId)
        .eq('user_id', user.id)
        .gt('sequence_number', dbMessage.sequence_number);

      if (deleteError) {
        console.error('Failed to delete subsequent messages:', deleteError);
        return;
      }

      // AI에 새로운 응답 요청
      await reload({
        body: {
          messages: updatedMessages,
          model: currentModel,
          chatId
        }
      });
    } catch (error) {
      console.error('Failed to update message:', error);
      // 에러 발생 시 편집 모드로 되돌리기
      setEditingMessageId(messageId);
      setEditingContent(messages.find(msg => msg.id === messageId)?.content || '');
    }
  };

  return (
    <main className="flex-1 relative h-full">
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

      <div className="flex-1 overflow-y-auto pb-32 pt-16">
        <div className="messages-container py-4 max-w-2xl mx-auto px-4 sm:px-6 w-full">
          {messages.map((message, i) => (
            <div key={message.id} className="message-group group animate-fade-in overflow-hidden">
              <div className={`message-role ${message.role === 'user' ? 'text-right' : ''}`}>
                {message.role === 'assistant' ? 'Chatflix.app' : 'You'}
              </div>
              <div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`${message.role === 'user' ? 'message-user' : 'message-assistant'} max-w-full overflow-x-auto ${
                  editingMessageId === message.id ? 'w-full' : ''
                }`}>
                  {editingMessageId === message.id ? (
                    <div className="flex flex-col gap-2 w-full">
                      <textarea
                        value={editingContent}
                        onChange={(e) => {
                          setEditingContent(e.target.value);
                          // 자동 높이 조절
                          e.target.style.height = 'auto';
                          e.target.style.height = `${e.target.scrollHeight}px`;
                        }}
                        onFocus={(e) => {
                          // 포커스 시 자동 높이 조절
                          e.target.style.height = 'auto';
                          e.target.style.height = `${e.target.scrollHeight}px`;
                        }}
                        className="w-full min-h-[100px] p-4 
                                 bg-[var(--foreground)] text-[var(--background)]
                                 resize-none overflow-hidden transition-all duration-200
                                 focus:outline-none border-none outline-none ring-0
                                 placeholder-[var(--background-80)]"
                        style={{
                          height: 'auto',
                          minHeight: '100px',
                          caretColor: 'var(--background)'
                        }}
                      />
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => handleEditCancel()}
                          className="px-4 py-2 text-sm
                                   bg-[var(--foreground)] text-[var(--background)]
                                   hover:opacity-80 transition-opacity duration-200"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleEditSave(message.id)}
                          className="px-4 py-2 text-sm
                                   bg-[var(--foreground)] text-[var(--background)]
                                   hover:opacity-80 transition-opacity duration-200"
                        >
                          Send
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {message.parts ? (
                        <>
                          {message.parts.map((part, index) => {
                            if (part.type === 'reasoning') {
                              return (
                                <ReasoningSection key={index} content={part.reasoning} />
                              );
                            }
                            if (part.type === 'text') {
                              return (
                                <div key={index}>
                                  <MarkdownContent content={part.text} />
                                </div>
                              );
                            }
                          })}
                        </>
                      ) : (
                        <MarkdownContent content={message.content} />
                      )}
                    </>
                  )}
                </div>
              </div>
              {message.role === 'assistant' ? (
                <div className="flex justify-start pl-1 mt-2 gap-4">
                  <button 
                    onClick={handleReload(message.id)}
                    disabled={isRegenerating}
                    className={`text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors flex items-center gap-2 ${
                      isRegenerating ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    title="Regenerate response"
                  >
                    <IconRefresh className={`w-3 h-3 ${isRegenerating ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    onClick={() => handleCopyMessage(message)}
                    className={`text-xs hover:text-[var(--foreground)] transition-colors flex items-center gap-2 ${
                      copiedMessageId === message.id ? 'text-green-500' : 'text-[var(--muted)]'
                    }`}
                    title={copiedMessageId === message.id ? "Copied!" : "Copy message"}
                  >
                    {copiedMessageId === message.id ? (
                      <IconCheck className="w-3 h-3" />
                    ) : (
                      <IconCopy className="w-3 h-3" />
                    )}
                  </button>
                  <div className="text-xs text-[var(--muted)] uppercase tracking-wider">
                    {MODEL_OPTIONS.find(option => option.id === ((message as ExtendedMessage).model || currentModel))?.name || 
                     ((message as ExtendedMessage).model || currentModel)}
                  </div>
                </div>
              ) : (
                <div className="flex justify-end pr-1 mt-2 gap-4">
                  <button
                    onClick={() => handleEditStart(message)}
                    className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors flex items-center gap-2"
                    title="Edit message"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleCopyMessage(message)}
                    className={`text-xs hover:text-[var(--foreground)] transition-colors flex items-center gap-2 ${
                      copiedMessageId === message.id ? 'text-green-500' : 'text-[var(--muted)]'
                    }`}
                    title={copiedMessageId === message.id ? "Copied!" : "Copy message"}
                  >
                    {copiedMessageId === message.id ? (
                      <IconCheck className="w-3 h-3" />
                    ) : (
                      <IconCopy className="w-3 h-3" />
                    )}
                  </button>
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} className="h-px" />
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-10 w-full">
        <div className="bg-gradient-to-t from-[var(--background)] from-50% via-[var(--background)]/80 to-transparent pt-8 pb-6 w-full">
          <div className="max-w-2xl mx-auto w-full px-10 pl-13 relative flex flex-col items-center">
            <div className="w-full max-w-[calc(100vw-2rem)]">
              <ModelSelector
                currentModel={currentModel}
                nextModel={nextModel}
                setNextModel={setNextModel}
                position="top"
              />
              <ChatInput
                input={input}
                handleInputChange={handleInputChange}
                handleSubmit={handleModelSubmit}
                isLoading={isLoading}
                stop={handleStop}
                user={user}
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  )
} 