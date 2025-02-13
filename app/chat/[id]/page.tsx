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
import { IconRefresh } from '../../components/icons'
import { supabase } from '@/lib/supabase'
import { DatabaseMessage } from '@/lib/types'
import { ModelSelector } from '../../components/ModelSelector'
import { ChatInput } from '../../components/ChatInput'

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

// 메시지 변환 함수를 컴포넌트 외부로 이동
const convertMessage = (msg: DatabaseMessage): Message => {
  const baseMessage = {
    id: msg.id,
    content: msg.content,
    role: msg.role as 'user' | 'assistant' | 'system',
    createdAt: new Date(msg.created_at),
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

  return (
    <ReactMarkdown
      className="message-content"
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw, rehypeSanitize, rehypeHighlight]}
      components={{
        p: ({ children }) => <p className="my-3 leading-relaxed">{children}</p>,
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
          const codeText = String(children).replace(/\n$/, '');
          
          if (isInline) {
            return (
              <code className="font-mono text-sm bg-black/30 px-1.5 py-0.5 rounded" {...props}>
                {children}
              </code>
            );
          }
          
          return (
            <div className="message-code group relative my-6">
              <div className="message-code-header flex items-center justify-between px-4 py-2">
                <span className="text-xs uppercase tracking-wider text-[var(--muted)]">
                  {match?.[1] || 'text'}
                </span>
                <button
                  onClick={() => handleCopy(codeText)}
                  className="text-xs uppercase tracking-wider px-2 py-1 
                           text-[var(--muted)] hover:text-[var(--foreground)] 
                           transition-colors flex items-center gap-1"
                >
                  {copied[codeText] ? (
                    <>
                      <span className="text-green-500">Copied</span>
                    </>
                  ) : (
                    <>Copy</>
                  )}
                </button>
              </div>
              <pre className="overflow-x-auto p-4 m-0 bg-black/20">
                <code className={className} {...props}>
                  {children}
                </code>
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
  const [isExpanded, setIsExpanded] = useState(true);  // 기본값을 true로 변경하여 스트리밍 시 보이도록 함

  return (
    <div className="message-reasoning">
      <div 
        className="message-reasoning-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
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
        <span>Reasoning</span>
      </div>
      <div 
        className={`message-reasoning-content ${isExpanded ? 'expanded' : ''}`}
        style={{ 
          maxHeight: isExpanded ? '1000px' : '0',
          marginTop: isExpanded ? '0.5rem' : '0'
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

  const { messages, input, handleInputChange, handleSubmit, isLoading, stop, setMessages, reload } = useChat({
    api: '/api/chat',
    body: {
      model: currentModel,
      chatId,
    },
    id: chatId,
    initialMessages: [],
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
      if (initialMessageSentRef.current) return;
      
      try {
        // 1. 세션 확인 및 모델 정보 로드
        const { data: session, error: sessionError } = await supabase
          .from('chat_sessions')
          .select('current_model, initial_message')
          .eq('id', chatId)
          .single();

        if (sessionError || !session) {
          console.error('Session error:', sessionError);
          router.push('/');
          return;
        }

        if (session.current_model && isMounted) {
          setCurrentModel(session.current_model);
          setNextModel(session.current_model);
        }

        // 2. 기존 메시지 로드
        const { data: existingMessages, error: messagesError } = await supabase
          .from('messages')
          .select('*')
          .eq('chat_session_id', chatId)
          .order('created_at', { ascending: true });

        if (messagesError) {
          console.error('Failed to load messages:', messagesError);
          return;
        }

        if (existingMessages && existingMessages.length > 0 && isMounted) {
          // 기존 메시지가 있는 경우
          setMessages(existingMessages.map(convertMessage));
          setIsInitialized(true);
        } else if (session.initial_message && isMounted) {
          // 초기 메시지만 있는 경우
          const messageId = Date.now().toString();
          
          // 사용자 메시지 저장
          const { error: insertError } = await supabase.from('messages').insert([{
            id: messageId,
            content: session.initial_message,
            role: 'user',
            created_at: new Date().toISOString(),
            model: session.current_model,
            host: 'user',
            chat_session_id: chatId
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
            // handleSubmit 대신 직접 API 요청
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
  }, [chatId]);

  // 실시간 업데이트 구독 (초기화 완료 후에만)
  useEffect(() => {
    if (!isInitialized) return;

    const channel = supabase
      .channel('chat-messages')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `chat_session_id=eq.${chatId}`
        },
        async (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const { data: message, error } = await supabase
              .from('messages')
              .select('*')
              .eq('id', payload.new.id)
              .single();

            if (!error && message) {
              setMessages(prevMessages => {
                const otherMessages = prevMessages.filter(m => m.id !== message.id);
                const convertedMessage = convertMessage(message);
                return [...otherMessages, convertedMessage];
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

  // 재생성 핸들러 메모이제이션
  const handleReload = useCallback((messageId: string) => async (e: React.MouseEvent) => {
    e.preventDefault()
    
    const messageIndex = messages.findIndex(m => m.id === messageId)
    if (messageIndex === -1) return
    
    // 선택한 AI 답변 이전의 메시지들만 유지
    const previousMessages = messages.slice(0, messageIndex)
    
    // 해당 AI 답변에 대한 사용자 메시지 찾기
    const targetUserMessage = messages
      .slice(0, messageIndex + 1)
      .reverse()
      .find(m => m.role === 'user')
    
    if (targetUserMessage) {
      // UI에서 메시지 즉시 제거
      setMessages(previousMessages)

      try {
        // 데이터베이스에서 선택한 메시지 이후의 모든 메시지 삭제
        const messagesToDelete = messages
          .slice(messageIndex)
          .map(m => m.id)

        await supabase
          .from('messages')
          .delete()
          .in('id', messagesToDelete)

        // 새로운 메시지 생성 요청
        await reload({
          body: {
            messages: [...previousMessages, {
              id: targetUserMessage.id,
              content: targetUserMessage.content,
              role: targetUserMessage.role,
              createdAt: targetUserMessage.createdAt
            }],
            model: currentModel,
            chatId,
            isRegeneration: true
          }
        })
      } catch (error) {
        console.error('Error handling reload:', error)
        // 에러 발생 시 원래 메시지 상태로 복구
        setMessages(messages)
      }
    }
  }, [messages, setMessages, currentModel, chatId, reload]);

  return (
    <main className="flex-1 relative h-full">
      <div className="flex-1 overflow-y-auto pb-40">
        <div className="messages-container py-4 max-w-2xl mx-auto px-4">
          {messages.map((message, i) => (
            <div key={message.id} className="message-group group animate-fade-in">
              <div className={`message-role ${message.role === 'user' ? 'text-right' : ''}`}>
                {message.role === 'assistant' ? 'AI Assistant' : 'You'}
              </div>
              <div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={message.role === 'user' ? 'message-user' : 'message-assistant'}>
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
                </div>
              </div>
              {message.role === 'assistant' && (
                <div className="flex justify-start pl-4 mt-2">
                  <button 
                    onClick={handleReload(message.id)}
                    className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors flex items-center gap-2 uppercase tracking-wider"
                  >
                    <IconRefresh className="w-3 h-3" />
                    <span>Regenerate</span>
                  </button>
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} className="h-px" />
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-10">
        <div className="bg-gradient-to-t from-[var(--background)] from-50% via-[var(--background)]/80 to-transparent pt-8 pb-6">
          <div className="max-w-2xl mx-auto pl-8 relative">
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
              stop={stop}
            />
          </div>
        </div>
      </div>
    </main>
  )
} 