'use client'

import { useRouter } from 'next/navigation'
import { useChat } from '@ai-sdk/react';
import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { ModelSelector } from './components/ModelSelector'
import { Header } from './components/Header'
import { Sidebar } from './components/Sidebar'
import { uploadFile } from '@/app/chat/[id]/utils'
import { Attachment } from '@/lib/types'
import { getDefaultModelId, getSystemDefaultModelId, updateUserDefaultModel } from '@/lib/models/config'
// import { ChatInput } from '@/app/components/ChatInput'
import { ChatInput } from '@/app/components/ChatInput/index'

export default function Home() {
  const router = useRouter()
  const [currentModel, setCurrentModel] = useState(getSystemDefaultModelId()) // 초기값으로 시스템 기본 모델 사용
  const [nextModel, setNextModel] = useState(getSystemDefaultModelId()) // 초기값으로 시스템 기본 모델 사용
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isModelLoading, setIsModelLoading] = useState(true) // 모델 로딩 상태 추가
  const supabase = createClient()

  useEffect(() => {
    const getUser = async () => {
      try {
        setIsModelLoading(true) // 로딩 시작
        
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push('/login')
          return
        }
        setUser(user)
        
        // 사용자의 기본 모델 가져오기
        const defaultModel = await getDefaultModelId(user.id)
        setCurrentModel(defaultModel)
        setNextModel(defaultModel)
      } catch (error) {
        console.error('사용자 정보 또는 모델 로딩 중 오류:', error)
        // 오류 발생 시 시스템 기본 모델 사용
        const systemDefault = getSystemDefaultModelId()
        setCurrentModel(systemDefault)
        setNextModel(systemDefault)
      } finally {
        setIsModelLoading(false) // 로딩 완료
      }
    }
    getUser()
  }, [supabase.auth, router])

  // 사용자가 모델을 변경할 때 호출되는 함수
  const handleModelChange = async (newModel: string) => {
    // 모델 상태 업데이트
    setNextModel(newModel)
    
    // 사용자가 로그인한 경우에만 기본 모델 업데이트
    if (user) {
      try {
        const success = await updateUserDefaultModel(user.id, newModel)
        if (success) {
          console.log(`사용자 기본 모델이 ${newModel}로 업데이트되었습니다.`)
        } else {
          console.error('사용자 기본 모델 업데이트 실패')
        }
      } catch (error) {
        console.error('사용자 기본 모델 업데이트 중 오류:', error)
      }
    }
  }

  const { input, handleInputChange, isLoading, stop } = useChat({
    api: '/api/chat',
    body: {
      model: currentModel,
      experimental_attachments: true,
    }
  })

  const handleModelSubmit = async (e: React.FormEvent, files?: FileList) => {
    e.preventDefault()
    
    if (isSubmitting || !input.trim() || !user) return
    setIsSubmitting(true)

    try {
      // Generate session ID immediately
      const sessionId = Date.now().toString();
      
      // Upload files first if they exist
      let attachments: Attachment[] = [];
      if (files?.length) {
        try {
          const uploadPromises = Array.from(files).map(file => uploadFile(file));
          attachments = await Promise.all(uploadPromises);
          console.log('[Debug] Uploaded attachments:', attachments);
        } catch (error) {
          console.error('Failed to upload files:', error);
          return;
        }
      }

      // 사용자가 선택한 모델 사용
      const modelToUse = nextModel;

      // Create session with initial message
      const { error: sessionError } = await supabase
        .from('chat_sessions')
        .insert([{
          id: sessionId,
          title: input.trim(),
          current_model: modelToUse,
          initial_message: input.trim(),
          user_id: user.id
        }]);

      if (sessionError) {
        console.error('Failed to create session:', sessionError);
        return;
      }

      // Save initial message with attachments
      const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const { error: messageError } = await supabase
        .from('messages')
        .insert([{
          id: messageId,
          content: input.trim(),
          role: 'user',
          created_at: new Date().toISOString(),
          model: modelToUse,
          host: 'user',
          chat_session_id: sessionId,
          user_id: user.id,
          experimental_attachments: attachments
        }]);

      if (messageError) {
        console.error('Failed to save message:', messageError);
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

  // 로딩 중이거나 사용자 정보가 없는 경우 로딩 화면 표시
  if (isModelLoading || !user) {
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
        <div className="w-full max-w-2xl px-6 sm:px-8 pb-12 sm:pb-32">
          <div className="space-y-0">
            <ModelSelector
              currentModel={currentModel}
              nextModel={nextModel}
              setNextModel={(model) => {
                if (typeof model === 'function') {
                  const newModel = model(nextModel);
                  handleModelChange(newModel);
                } else {
                  handleModelChange(model);
                }
              }}
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
              modelId={nextModel}
              popupPosition="bottom"
            />
          </div>
        </div>
      </div>
    </main>
  )
}