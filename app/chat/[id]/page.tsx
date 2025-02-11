'use client'

import { useChat } from 'ai/react'
import { Message } from 'ai'
import { useState, useEffect, use, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
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

export default function Chat({ params }: PageProps) {
  const { id: chatId } = use(params)
  const router = useRouter()
  const [currentModel, setCurrentModel] = useState('deepseek-reasoner')
  const [nextModel, setNextModel] = useState(currentModel)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [])

  // 메시지가 업데이트될 때마다 스크롤
  useEffect(() => {
    scrollToBottom()
  }, [scrollToBottom])

  // 세션 로드 시 저장된 모델 정보 불러오기
  useEffect(() => {
    async function loadSessionModel() {
      const { data: session, error } = await supabase
        .from('chat_sessions')
        .select('current_model')
        .eq('id', chatId)
        .single();

      if (session?.current_model) {
        setCurrentModel(session.current_model);
        setNextModel(session.current_model);
      }
    }

    loadSessionModel();
  }, [chatId]);

  const { messages, input, handleInputChange, handleSubmit, isLoading, stop, setMessages, reload } = useChat({
    api: '/api/chat',
    body: {
      model: currentModel,
      chatId,
    },
    id: chatId,
    onFinish: async (message) => {
      // 스트리밍 완료 후 최종 메시지만 표시하기 위해 DB에서 다시 불러오지 않음
      // 스트리밍된 메시지가 이미 UI에 표시되어 있음
    }
  });

  // 실시간 업데이트 구독 최적화
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
          // INSERT나 UPDATE된 메시지만 처리
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const { data: message, error } = await supabase
              .from('messages')
              .select('*')
              .eq('id', payload.new.id)
              .single();

            if (!error && message) {
              setMessages(prevMessages => {
                const otherMessages = prevMessages.filter(m => m.id !== message.id);
                return [...otherMessages, convertMessage(message)];
              });
            }
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
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto w-full">
          <div className="space-y-6 p-4 pb-32">
            {messages.map((message) => (
              <div key={message.id} className="group animate-fade-in">
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
            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-64 right-0 bg-gradient-to-t from-[var(--background)] via-[var(--background)] to-transparent pt-6 pb-4">
        <div className="max-w-2xl mx-auto w-full px-4">
          <div className="flex flex-col gap-4">
            <ModelSelector
              currentModel={currentModel}
              nextModel={nextModel}
              setNextModel={setNextModel}
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