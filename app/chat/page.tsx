'use client'

import { useChat } from 'ai/react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { IconRefresh, IconStop } from '../components/icons'
import { Message } from 'ai'
import { supabase } from '@/lib/supabase'

export default function NewChat() {
  const router = useRouter()
  const [currentModel, setCurrentModel] = useState('deepseek-reasoner')
  const [nextModel, setNextModel] = useState(currentModel)

  const { messages, input, handleInputChange, handleSubmit, isLoading, stop } = useChat({
    api: '/api/chat',
    body: {
      model: currentModel,
    },
    onFinish: async (message) => {
      // 첫 메시지가 완료되면 새 세션 생성 및 리다이렉트
      if (messages.length === 0) {  // 첫 메시지인 경우만 체크
        try {
          const { data: session, error: sessionError } = await supabase
            .from('chat_sessions')
            .insert([{
              id: Date.now().toString(),
              title: message.content
            }])
            .select()
            .single();

          if (session) {
            // 세션이 생성되면 즉시 해당 URL로 이동
            router.push(`/chat/${session.id}`);
          }
        } catch (error) {
          console.error('Error creating session:', error);
        }
      }
    }
  })

  const handleModelSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setCurrentModel(nextModel)
    await handleSubmit(e)
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
                    {message.content}
                  </div>
                </div>
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