'use client'

import { ModelSelector } from './ModelSelector'
import { ChatInput } from './ChatInput/index'
import { User } from '@supabase/supabase-js'
import React from 'react'

interface ChatInputAreaProps {
  // ModelSelector props
  currentModel: string
  nextModel: string
  setNextModel: React.Dispatch<React.SetStateAction<string>>
  setCurrentModel: React.Dispatch<React.SetStateAction<string>>
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
}

export function ChatInputArea({
  // ModelSelector props
  currentModel,
  nextModel,
  setNextModel,
  setCurrentModel,
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
  disabled = false
}: ChatInputAreaProps) {
  if (layout === 'inline') {
    // Inline layout for home page
    return (
      <div className="space-y-2">
        <ModelSelector
          currentModel={currentModel}
          nextModel={nextModel}
          setNextModel={setNextModel}
          setCurrentModel={setCurrentModel}
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
        />
      </div>
    )
  }

  // Fixed layout for chat page (default)
  return (
    <div className="fixed inset-x-0 bottom-0 z-10 w-full">
      <div className="bg-gradient-to-t from-[var(--background)] from-50% via-[var(--background)]/80 to-transparent pt-0 pb-6 w-full">
        <div className="max-w-3xl mx-auto w-full px-6 sm:px-8 relative flex flex-col items-center">
          <div className="w-full max-w-[calc(100vw-2rem)]">
            <ModelSelector
              currentModel={currentModel}
              nextModel={nextModel}
              setNextModel={setNextModel}
              setCurrentModel={setCurrentModel}
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
            />
          </div>
        </div>
      </div>
    </div>
  )
} 