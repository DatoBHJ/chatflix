'use client'

import { useRouter } from 'next/navigation'
import { useChat } from '@ai-sdk/react';
import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { ModelSelector } from './components/ModelSelector'
import { ChatInput } from './components/ChatInput'
import { Header } from './components/Header'
import { Sidebar } from './components/Sidebar'

export default function Home() {
  const router = useRouter()
  const [currentModel, setCurrentModel] = useState('claude-3-5-sonnet-latest')
  const [nextModel, setNextModel] = useState(currentModel)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
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
      
      // // Create new chat object for immediate UI update
      // const newChat = {
      //   id: sessionId,
      //   title: input.trim(),
      //   messages: [],
      //   created_at: new Date().toISOString(),
      //   lastMessageTime: Date.now(),
      //   current_model: nextModel,
      //   user_id: user.id
      // };

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

      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="w-full max-w-2xl px-10 sm:px-8 pb-2 sm:pb-14">
          <div className="space-y-0">
            {/* <h1 className="pl-1 sm:pl-0 text-xs sm:text-base uppercase tracking-wider mb-0 text-[var(--muted)] text-start font-extralight">chatflix.app</h1> */}
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
            {/* <h1 className="pl-1 sm:pl-0 text-xs sm:text-base uppercase tracking-wider text-[var(--muted)] text-start font-extralight">chatflix.app</h1> */}

          </div>
        </div>
      </div>
    </main>
  )
}