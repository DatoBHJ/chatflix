'use client'

import { useRouter } from 'next/navigation'
import { useChat } from 'ai/react'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ModelSelector } from './components/ModelSelector'
import { ChatInput } from './components/ChatInput'

export default function Home() {
  const router = useRouter()
  const [currentModel, setCurrentModel] = useState('deepseek-reasoner')
  const [nextModel, setNextModel] = useState(currentModel)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { messages, input, handleInputChange, handleSubmit, isLoading, stop } = useChat({
    api: '/api/chat',
    body: {
      model: currentModel
    },
    onResponse: (response) => {
      // API 응답이 시작되면 채팅 페이지로 이동
      const chatId = sessionStorage.getItem('pendingChatId');
      if (chatId) {
        sessionStorage.removeItem('pendingChatId');
        router.push(`/chat/${chatId}`);
      }
    }
  })

  const handleModelSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (isSubmitting || !input.trim()) return
    setIsSubmitting(true)

    try {
      // 1. 새 세션 생성
      const { data: session, error: sessionError } = await supabase
        .from('chat_sessions')
        .insert([{
          id: Date.now().toString(),
          title: input.trim(),
          current_model: nextModel
        }])
        .select()
        .single();

      if (sessionError) {
        console.error('Failed to create session:', sessionError);
        setIsSubmitting(false);
        return;
      }

      // 2. 사용자 메시지 먼저 저장
      await supabase.from('messages').insert([{
        id: Date.now().toString(),
        content: input.trim(),
        role: 'user',
        created_at: new Date().toISOString(),
        model: nextModel,
        chat_session_id: session.id
      }]);

      // 3. 채팅 ID 임시 저장
      sessionStorage.setItem('pendingChatId', session.id);

      // 4. 메시지 전송 시작
      handleSubmit(e, {
        body: {
          model: nextModel,
          chatId: session.id
        }
      });
    } catch (error) {
      console.error('Error in handleModelSubmit:', error);
      sessionStorage.removeItem('pendingChatId');
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex-1 flex flex-col">
      <div className="flex-1 flex items-center justify-center">
        <div className="max-w-2xl text-center">
          <h1 className="text-4xl font-bold mb-4">Welcome GOAT</h1>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-[var(--background)] via-[var(--background)] to-transparent pt-6 pb-4">
        <div className="max-w-2xl mx-auto w-full px-4">
          <div className="flex flex-col gap-4">
            <ModelSelector
              currentModel={currentModel}
              nextModel={nextModel}
              setNextModel={setNextModel}
              disabled={isSubmitting}
            />
            <ChatInput
              input={input}
              handleInputChange={handleInputChange}
              handleSubmit={handleModelSubmit}
              isLoading={isLoading}
              stop={stop}
              disabled={isSubmitting}
              placeholder="How can I help you today?"
            />
          </div>
        </div>
      </div>
    </main>
  )
}
