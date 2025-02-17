'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'

interface PromptShortcut {
  id: string
  name: string
  content: string
}

interface PromptShortcutsDialogProps {
  isOpen: boolean
  onClose: () => void
  user: any
}

export function PromptShortcutsDialog({ isOpen, onClose, user }: PromptShortcutsDialogProps) {
  const [shortcuts, setShortcuts] = useState<PromptShortcut[]>([])
  const [newName, setNewName] = useState('')
  const [newContent, setNewContent] = useState('')
  const supabase = createClient()

  useEffect(() => {
    if (isOpen && user) {
      loadShortcuts()
    }
  }, [isOpen, user])

  async function loadShortcuts() {
    try {
      const { data, error } = await supabase
        .from('prompt_shortcuts')
        .select('*')
        .eq('user_id', user.id)
        .order('name')

      if (error) throw error
      setShortcuts(data || [])
    } catch (error) {
      console.error('Error loading shortcuts:', error)
    }
  }

  async function handleAdd() {
    if (!newName.trim() || !newContent.trim()) return

    try {
      const { error } = await supabase
        .from('prompt_shortcuts')
        .insert({
          id: `ps-${Date.now()}`,
          name: newName.trim(),
          content: newContent.trim(),
          user_id: user.id
        })

      if (error) throw error
      
      setNewName('')
      setNewContent('')
      loadShortcuts()
    } catch (error) {
      console.error('Error adding shortcut:', error)
    }
  }

  async function handleDelete(id: string) {
    try {
      const { error } = await supabase
        .from('prompt_shortcuts')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

      if (error) throw error
      loadShortcuts()
    } catch (error) {
      console.error('Error deleting shortcut:', error)
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
          <h2 className="w-full h-[46px] flex items-center justify-center text-sm uppercase tracking-wider hover:text-[var(--muted)] transition-colors">Prompt Shortcuts</h2>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6">
            {/* Usage guide */}
            <div className="mb-8">
              <div className="space-y-1 text-xs tracking-wide">
                <div className="flex items-baseline gap-3">
                  <span className="text-[var(--muted)]">01</span>
                  <span>Add shortcut with name + prompt</span>
                </div>
                <div className="flex items-baseline gap-3">
                  <span className="text-[var(--muted)]">02</span>
                  <span>Type <span className="text-[10px] tracking-[0.2em] uppercase">@name</span> in chat</span>
                </div>
              </div>
            </div>

            {/* Add new shortcut */}
            <div className="space-y-1 mb-8">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Shortcut name (e.g. translate)"
                className="w-full p-4 bg-[var(--accent)] text-sm focus:outline-none"
              />
              <textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="Prompt content (e.g. Translate this text to Korean:)"
                className="w-full h-24 p-4 bg-[var(--accent)] text-sm focus:outline-none resize-none"
              />
              <button
                onClick={handleAdd}
                disabled={!newName.trim() || !newContent.trim()}
                className="w-full p-4 text-xs uppercase tracking-wider bg-[var(--foreground)] text-[var(--background)] 
                         hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                Add Shortcut
              </button>
            </div>

            {/* Shortcuts list */}
            <div className="space-y-1">
              {shortcuts.map((shortcut) => (
                <div key={shortcut.id} className="group flex items-start gap-4 p-4 bg-[var(--accent)]">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">@{shortcut.name}</div>
                    <div className="text-xs text-[var(--muted)] mt-1 break-words">{shortcut.content}</div>
                  </div>
                  <button
                    onClick={() => handleDelete(shortcut.id)}
                    className="opacity-0 group-hover:opacity-100 text-[var(--muted)] hover:text-[var(--foreground)] transition-all"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={onClose}
              className="w-full mt-8 p-4 text-xs uppercase tracking-wider 
                       bg-[var(--foreground)] text-[var(--background)] 
                       hover:opacity-90 transition-opacity"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  )
} 