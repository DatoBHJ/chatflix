'use client'

import { useRouter } from 'next/navigation'
import { useChat } from 'ai/react'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ModelSelector } from './components/ModelSelector'
import { ChatInput } from './components/ChatInput'

export default function Home() {
  const router = useRouter()
  const [currentModel, setCurrentModel] = useState('claude-3-5-sonnet-latest')
  const [nextModel, setNextModel] = useState(currentModel)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { messages, input, handleInputChange, handleSubmit, isLoading, stop } = useChat({
    api: '/api/chat',
    body: {
      model: currentModel
    }
  })

  const handleModelSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (isSubmitting || !input.trim()) return
    setIsSubmitting(true)

    try {
      // Generate session ID immediately
      const sessionId = Date.now().toString();
      
      // Create session with initial message
      const { error: sessionError } = await supabase
        .from('chat_sessions')
        .insert([{
          id: sessionId,
          title: input.trim(),
          current_model: nextModel,
          initial_message: input.trim()  // Save initial message
        }]);

      if (sessionError) {
        console.error('Failed to create session:', sessionError);
        return;
      }

      // Redirect to chat page
      router.push(`/chat/${sessionId}`);
      
    } catch (error) {
      console.error('Error in handleModelSubmit:', error);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex-1 flex flex-col items-center justify-center relative px-8">
      <div className="w-full max-w-2xl space-y-16">
        <div className="text-center space-y-4 mt-44">
        </div>

        <div className="w-full space-y-6">
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
            placeholder="Message..."
          />
        </div>
      </div>
    </main>
  )
}
