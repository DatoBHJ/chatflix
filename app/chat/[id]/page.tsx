'use client'

import { useChat } from 'ai/react'
import { Message } from 'ai'
import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { IconRefresh, IconStop } from '../../components/icons'
import { supabase } from '@/lib/supabase'
import { DatabaseMessage } from '@/lib/types'

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function Chat({ params }: PageProps) {
  const { id: chatId } = use(params)
  const router = useRouter()
  const [currentModel, setCurrentModel] = useState('deepseek-reasoner')
  const [nextModel, setNextModel] = useState(currentModel)

  const { messages, input, handleInputChange, handleSubmit, isLoading, stop, setMessages, reload } = useChat({
    api: '/api/chat',
    body: {
      model: currentModel,
      chatId,
    },
    id: chatId,
    onFinish: async (message) => {
      // 메시지가 완료되면 전체 대화 내용을 다시 로드
      const { data: updatedMessages, error } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_session_id', chatId)
        .order('created_at', { ascending: true });

      if (!error && updatedMessages) {
        const convertedMessages = updatedMessages.map(msg => {
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
        }) as Message[];

        setMessages(convertedMessages);
      }
    }
  });

  // 실시간 업데이트 구독
  useEffect(() => {
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
          // 메시지가 업데이트되면 전체 대화 내용을 다시 로드
          const { data: messages, error } = await supabase
            .from('messages')
            .select('*')
            .eq('chat_session_id', chatId)
            .order('created_at', { ascending: true });

          if (!error && messages) {
            const convertedMessages = messages.map(msg => {
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
            }) as Message[];

            setMessages(convertedMessages);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatId, setMessages]);

  useEffect(() => {
    async function loadChat() {
      console.log('Loading chat session:', chatId);
      
      try {
        // 세션 확인
        const { data: session, error: sessionError } = await supabase
          .from('chat_sessions')
          .select()
          .eq('id', chatId)
          .single();

        console.log('Session data:', session);
        console.log('Session error:', sessionError);

        if (sessionError) {
          console.error('Session error:', sessionError);
          router.push('/chat');
          return;
        }

        if (!session) {
          console.error('Session not found');
          router.push('/chat');
          return;
        }

        // 메시지 로드
        const { data: messages, error: messagesError } = await supabase
          .from('messages')
          .select('*')
          .eq('chat_session_id', chatId)
          .order('created_at', { ascending: true });

        console.log('Messages data:', messages);
        console.log('Messages error:', messagesError);

        if (messagesError) {
          console.error('Failed to load messages:', messagesError);
          return;
        }

        if (messages) {
          const convertedMessages = messages.map(msg => {
            const baseMessage = {
              id: msg.id,
              content: msg.content,
              role: msg.role as 'user' | 'assistant' | 'system',
              createdAt: new Date(msg.created_at),
            };

            // assistant 메시지이고 reasoning이 있는 경우에만 parts 추가
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
          }) as Message[];

          console.log('Converted messages:', convertedMessages);
          setMessages(convertedMessages);
        }
      } catch (error) {
        console.error('Unexpected error:', error);
        router.push('/chat');
      }
    }

    loadChat();
  }, [chatId, router, setMessages]);

  const handleModelSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setCurrentModel(nextModel)
    await handleSubmit(e)
  }

  const handleReload = (messageId: string) => async (e: React.MouseEvent) => {
    e.preventDefault()
    
    const messageIndex = messages.findIndex(m => m.id === messageId)
    if (messageIndex === -1) return
    
    const previousMessages = messages.slice(0, messageIndex)
    const lastUserMessage = messages
      .slice(0, messageIndex + 1)
      .reverse()
      .find(m => m.role === 'user')
    
    if (lastUserMessage) {
      setMessages(previousMessages)
      await reload({
        body: {
          messages: [...previousMessages, lastUserMessage],
          model: currentModel,
          chatId,  // 업데이트된 chatId 사용
        }
      })
    }
  }

  return (
    <main className="flex-1 relative h-full">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto w-full">
          <div className="space-y-6 p-4 pb-32">
            {messages.map((message) => (
              <div key={message.id} className="group">
                <div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-4 ${
                    message.role === 'user' 
                      ? 'bg-[var(--accent)]' 
                      : 'bg-[var(--background)] border border-[var(--accent)]'
                  }`}>
                    {message.parts ? (
                      <>
                        {message.parts.map((part, index) => {
                          if (part.type === 'reasoning') {
                            return (
                              <div key={index} className="bg-[var(--accent)] bg-opacity-30 p-2 mb-2">
                                <div className="text-sm opacity-70">Reasoning:</div>
                                <div className="whitespace-pre-wrap">{part.reasoning}</div>
                              </div>
                            );
                          }
                          if (part.type === 'text') {
                            return (
                              <div key={index} className="whitespace-pre-wrap">
                                {part.text}
                              </div>
                            );
                          }
                        })}
                      </>
                    ) : (
                      <div className="whitespace-pre-wrap">{message.content}</div>
                    )}
                  </div>
                </div>
                {message.role === 'assistant' && (
                  <div className="flex justify-start pl-4 mt-1">
                    <button 
                      onClick={handleReload(message.id)}
                      className="text-xs opacity-50 hover:opacity-100 transition-opacity flex items-center gap-1"
                    >
                      <IconRefresh className="w-3 h-3" />
                      <span>Regenerate response</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-64 right-0 bg-gradient-to-t from-[var(--background)] via-[var(--background)] to-transparent pt-6 pb-4">
        <div className="max-w-2xl mx-auto w-full px-4">
          <form onSubmit={handleModelSubmit} className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs opacity-70">Using:</span>
              <select
                value={nextModel}
                onChange={(e) => setNextModel(e.target.value)}
                className="text-xs bg-transparent border-none focus:outline-none hover:opacity-100 opacity-70"
              >
                <option value="deepseek-reasoner">DeepSeek Reasoner</option>
                <option value="deepseek-chat">DeepSeek Chat</option>
                <option value="deepseek-ai/DeepSeek-R1">DeepSeek R1 (Together)</option>
                <option value="deepseek-ai/DeepSeek-V3">DeepSeek V3 (Together)</option>
                <option value="DeepSeek r1 distill llama 70b">DeepSeek R1 (Groq)</option>
                <option value="claude-3-5-sonnet-latest">Claude 3.5 Sonnet</option>
              </select>
            </div>

            <div className="flex gap-2">
              <input
                value={input}
                onChange={handleInputChange}
                placeholder="Type your message..."
                className="yeezy-input flex-1 text-lg"
              />
              {isLoading ? (
                <button 
                  onClick={(e) => { e.preventDefault(); stop() }} 
                  type="button"
                  className="yeezy-button flex items-center gap-2"
                >
                  <IconStop />
                  <span>Stop</span>
                </button>
              ) : (
                <button 
                  type="submit" 
                  className="yeezy-button"
                  disabled={isLoading}
                >
                  Send
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </main>
  )
} 