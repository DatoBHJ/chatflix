'use client'

import { ModelSelector } from './ModelSelector'
import { ChatInput } from './ChatInput/index'
import { User } from '@supabase/supabase-js'
import React from 'react'
import { useSidebar } from '../lib/SidebarContext'

interface ChatInputAreaProps {
  // ModelSelector props
  currentModel: string
  nextModel: string
  setNextModel: React.Dispatch<React.SetStateAction<string>>
  disabledLevels: string[]
  isAgentEnabled: boolean
  onAgentAvailabilityChange: (hasAgentModels: boolean) => void
  setisAgentEnabled: React.Dispatch<React.SetStateAction<boolean>>
  
  // ChatInput props
  input: string
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  handleSubmit: (e: React.FormEvent, files?: FileList) => Promise<void>
  isLoading: boolean
  stop: () => void
  user: User & { hasAgentModels?: boolean }
  modelId: string
  
  // Layout props
  layout?: 'fixed' | 'inline' // 'fixed' for chat page, 'inline' for home page
  disabled?: boolean // for home page loading states
  
  // Messages for token counting
  allMessages?: any[] // 전체 대화 메시지 (대화창에서만 사용)
  
  // Global drag and drop props
  globalDragActive?: boolean
  globalShowPDFError?: boolean
  globalShowFolderError?: boolean
  globalShowVideoError?: boolean
  
  // 도구 선택 관련 props
  selectedTool?: string | null
  setSelectedTool?: React.Dispatch<React.SetStateAction<string | null>>
}

export function ChatInputArea({
  // ModelSelector props
  currentModel,
  nextModel,
  setNextModel,
  disabledLevels,
  isAgentEnabled,
  onAgentAvailabilityChange,
  setisAgentEnabled,
  
  // ChatInput props
  input,
  handleInputChange,
  handleSubmit,
  isLoading,
  stop,
  user,
  modelId,
  
  // Layout props
  layout = 'fixed',
  disabled = false,
  
  // Messages
  allMessages = [],
  
  // Global drag and drop props
  globalDragActive = false,
  globalShowPDFError = false,
  globalShowFolderError = false,
  globalShowVideoError = false,
  
  // 도구 선택 관련 props
  selectedTool,
  setSelectedTool
}: ChatInputAreaProps) {
  const { isSidebarOpen, isHovering, isMobile } = useSidebar()
  
  // 데스크탑에서는 호버 상태 또는 사이드바 열림 상태에 따라, 모바일에서는 isSidebarOpen 상태에 따라 사이드바 표시
  const shouldShowSidebar = isMobile ? isSidebarOpen : (isHovering || isSidebarOpen)
  if (layout === 'inline') {
    // Inline layout for home page
    return (
      <div className="space-y-2">
        <ModelSelector
          currentModel={currentModel}
          nextModel={nextModel}
          setNextModel={setNextModel}
          disabled={disabled}
          disabledLevels={disabledLevels}
          isAgentEnabled={isAgentEnabled}
          onAgentAvailabilityChange={onAgentAvailabilityChange}
          user={user}
        />
        <ChatInput
          input={input}
          handleInputChange={handleInputChange}
          handleSubmit={handleSubmit}
          isLoading={isLoading}
          stop={stop}
          disabled={disabled}
          user={user}
          modelId={modelId}
          isAgentEnabled={isAgentEnabled}
          setisAgentEnabled={setisAgentEnabled}
          allMessages={allMessages}
          globalDragActive={globalDragActive}
          globalShowPDFError={globalShowPDFError}
          globalShowFolderError={globalShowFolderError}
          globalShowVideoError={globalShowVideoError}
          selectedTool={selectedTool}
          setSelectedTool={setSelectedTool}
        />
      </div>
    )
  }

  // Fixed layout for chat page (default)
  return (
    <div className={`fixed bottom-0 z-10 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
      shouldShowSidebar ? 'left-0 right-0 md:left-80' : 'left-0 right-0'
    }`}>
      <div className="bg-gradient-to-t from-[var(--background)] via-[var(--background)]/60 to-transparent pt-2 md:pt-8 pb-6 w-full">
      {/* <div className="pt-3 md:pt-4 pb-6 w-full backdrop-blur-md bg-white/80 dark:bg-black/80"> */}
        <div className="max-w-3xl mx-auto w-full px-0 sm:px-8 relative flex flex-col items-center">
          <div className="w-full max-w-[calc(100vw-2rem)] space-y-1">
            <ModelSelector
              currentModel={currentModel}
              nextModel={nextModel}
              setNextModel={setNextModel}
              position="top"
              disabledLevels={disabledLevels}
              isAgentEnabled={isAgentEnabled}
              onAgentAvailabilityChange={onAgentAvailabilityChange}
              user={user}
            />
            <ChatInput
              input={input}
              handleInputChange={handleInputChange}
              handleSubmit={handleSubmit}
              isLoading={isLoading}
              stop={stop}
              user={user}
              modelId={modelId}
              isAgentEnabled={isAgentEnabled}
              setisAgentEnabled={setisAgentEnabled}
              allMessages={allMessages}
              selectedTool={selectedTool}
              setSelectedTool={setSelectedTool}
            />
          </div>
        </div>
      </div>
    </div>
  )
} 