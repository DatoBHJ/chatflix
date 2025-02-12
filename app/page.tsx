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
      
      // Create new chat object for immediate UI update
      const newChat = {
        id: sessionId,
        title: input.trim(),
        messages: [],
        created_at: new Date().toISOString(),
        lastMessageTime: Date.now(),
        current_model: nextModel
      };

      // Emit event for sidebar update
      window.dispatchEvent(new CustomEvent('chatCreated', { detail: newChat }));
      
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
    <main className="flex-1 flex flex-col min-h-screen">
      <div className="flex-1 flex flex-col items-center justify-center -mt-16 sm:-mt-32">
        <div className="w-full max-w-2xl px-10 sm:px-8">
          {/* <div className="mb-12 sm:mb-16 text-left sm:text-center">
            <h1 className="text-2xl sm:text-2xl font-light mb-3 uppercase tracking-wider">Chat is this real?</h1>
            <p className="text-[var(--muted)] text-sm sm:text-sm tracking-wide">Chat with multiple AI models</p>
          </div> */}
          <div className="space-y-0">
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
              placeholder="chat is this real?"
            />
          </div>
        </div>
      </div>
    </main>
  )
}
