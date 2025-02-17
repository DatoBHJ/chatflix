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

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 bg-black/95 flex items-start justify-center z-50 p-4 sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-2xl bg-transparent">
        <div className="p-4 sm:p-6">
          <h2 className="text-xs sm:text-sm uppercase tracking-wider text-[var(--muted)] mt-28 mb-4">System Prompt</h2>

          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="w-full h-[50vh] sm:h-64 p-4 bg-[var(--accent)] text-sm 
                     focus:outline-none placeholder:text-[var(--muted)] 
                     placeholder:uppercase placeholder:text-xs resize-none"
            placeholder="Enter system prompt..."
            spellCheck={false}
          />

          <button
            onClick={handleSave}
            className="w-full mt-4 p-4 text-xs uppercase tracking-wider 
                     bg-[var(--foreground)] text-[var(--background)] 
                     hover:opacity-90 transition-opacity"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
} 