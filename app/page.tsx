'use client'

import { useRouter } from 'next/navigation'
import { useChat } from 'ai/react'
import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { ModelSelector } from './components/ModelSelector'
import { ChatInput } from './components/ChatInput'

export default function Home() {
  const router = useRouter()
  const [currentModel, setCurrentModel] = useState('claude-3-5-sonnet-latest')
  const [nextModel, setNextModel] = useState(currentModel)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [user, setUser] = useState<any>(null)
  const supabase = createClient()

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

  const { messages, input, handleInputChange, handleSubmit, isLoading, stop } = useChat({
    api: '/api/chat',
    body: {
      model: currentModel
    }
  })

  const handleModelSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (isSubmitting || !input.trim() || !user) return
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
        current_model: nextModel,
        user_id: user.id
      };

      // Create session with initial message
      const { error: sessionError } = await supabase
        .from('chat_sessions')
        .insert([{
          id: sessionId,
          title: input.trim(),
          current_model: nextModel,
          initial_message: input.trim(),
          user_id: user.id
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

  if (!user) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>
  }

  return (
    <main className="flex-1 flex flex-col min-h-screen">
      <div className="flex-1 flex flex-col items-center justify-center -mt-16 sm:-mt-32">
        <div className="w-full max-w-2xl pl-9 sm:px-8">
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
              placeholder="Chat is this real?"
              user={user}
            />
          </div>
        </div>
      </div>
    </main>
  )
}
