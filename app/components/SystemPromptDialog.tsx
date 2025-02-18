'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'

interface SystemPromptDialogProps {
  isOpen: boolean
  onClose: () => void
  user: any
}

export function SystemPromptDialog({ isOpen, onClose, user }: SystemPromptDialogProps) {
  const [prompt, setPrompt] = useState('')
  const [promptId, setPromptId] = useState<string | null>(null)
  const [isResetting, setIsResetting] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (isOpen && user) {
      loadSystemPrompt()
    }
  }, [isOpen, user])

  async function loadSystemPrompt() {
    try {
      const { data: funcData, error: funcError } = await supabase
        .rpc('get_or_create_system_prompt', {
          p_user_id: user.id
        })

      if (funcError) {
        console.error('Error in get_or_create_system_prompt:', funcError)
        return
      }

      const { data, error } = await supabase
        .from('system_prompts')
        .select('id, content')
        .eq('user_id', user.id)
        .single()

      if (error) {
        console.error('Error fetching system prompt:', error)
        return
      }

      setPromptId(data.id)
      setPrompt(data.content || '')
    } catch (error) {
      console.error('Error loading system prompt:', error)
    }
  }

  async function handleSave() {
    if (!promptId) {
      console.error('No prompt ID found')
      return
    }

    try {
      const { error } = await supabase
        .from('system_prompts')
        .update({
          content: prompt
        })
        .eq('id', promptId)
        .eq('user_id', user.id)

      if (error) throw error
      onClose()
    } catch (error) {
      console.error('Error saving system prompt:', error)
    }
  }

  async function handleReset() {
    if (!promptId) {
      console.error('No prompt ID found')
      return
    }

    try {
      setIsResetting(true)
      const { data, error } = await supabase
        .rpc('reset_system_prompt', {
          p_user_id: user.id
        })

      if (error) throw error
      
      setPrompt(data)
    } catch (error) {
      console.error('Error resetting system prompt:', error)
    } finally {
      setIsResetting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 bg-black/95 flex items-start justify-center z-50 overflow-hidden"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-2xl bg-transparent h-full flex flex-col">
        {/* Fixed Header */}
        <div className="pt-12 px-6 pb-6 border-b border-[var(--accent)]">
          <h2 className="w-full h-[46px] flex items-center justify-center text-sm uppercase tracking-wider hover:text-[var(--muted)] transition-colors">System Prompt</h2>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6">
            {/* Usage guide */}
            <div className="mb-8">
              <div className="text-xs tracking-wide space-y-4">
                <div className="flex items-baseline gap-3">
                  <span className="text-[var(--muted)]">01</span>
                  <div className="space-y-1">
                    <span>Set your system prompt</span>
                    <div className="text-[10px] text-[var(--muted)]">Define the AI's behavior and capabilities</div>
                  </div>
                </div>
                <div className="flex items-baseline gap-3">
                  <span className="text-[var(--muted)]">02</span>
                  <div className="space-y-1">
                    <span>Click save to apply changes</span>
                    <div className="text-[10px] text-[var(--muted)]">Changes will affect both new and existing chats</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Prompt Editor */}
            <div className="space-y-1">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full h-[50vh] sm:h-64 p-4 bg-[var(--accent)] text-sm 
                         focus:outline-none placeholder:text-[var(--muted)] 
                         placeholder:uppercase placeholder:text-xs resize-none"
                placeholder="Enter system prompt..."
                spellCheck={false}
              />

              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  className="flex-1 p-4 text-xs uppercase tracking-wider 
                           bg-[var(--foreground)] text-[var(--background)] 
                           hover:opacity-90 transition-opacity"
                >
                  Save
                </button>
                <button
                  onClick={handleReset}
                  disabled={isResetting}
                  className="w-32 p-4 text-xs uppercase tracking-wider 
                           bg-[var(--accent)] hover:opacity-90 transition-opacity
                           disabled:opacity-50"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 