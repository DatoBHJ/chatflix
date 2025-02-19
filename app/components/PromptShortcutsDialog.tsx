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
  const [editingId, setEditingId] = useState<string | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    if (isOpen && user) {
      loadShortcuts()
      // Reset editing state when dialog opens
      setEditingId(null)
      setNewName('')
      setNewContent('')
    }
  }, [isOpen, user])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (openMenuId && !(event.target as Element).closest('.menu-container')) {
        setOpenMenuId(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [openMenuId])

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
      const formattedName = newName.trim().replace(/\s+/g, '_')

      if (editingId) {
        // Update existing shortcut
        const { error } = await supabase
          .from('prompt_shortcuts')
          .update({
            name: formattedName,
            content: newContent.trim(),
          })
          .eq('id', editingId)
          .eq('user_id', user.id)

        if (error) throw error
      } else {
        // Add new shortcut
        const { error } = await supabase
          .from('prompt_shortcuts')
          .insert({
            id: `ps-${Date.now()}`,
            name: formattedName,
            content: newContent.trim(),
            user_id: user.id
          })

        if (error) throw error
      }
      
      setNewName('')
      setNewContent('')
      setEditingId(null)
      loadShortcuts()
    } catch (error) {
      console.error('Error saving shortcut:', error)
    }
  }

  function handleEdit(shortcut: PromptShortcut) {
    setEditingId(shortcut.id)
    setNewName(shortcut.name)
    setNewContent(shortcut.content)
    setOpenMenuId(null)
  }

  function handleCancel() {
    setEditingId(null)
    setNewName('')
    setNewContent('')
  }

  async function handleDelete(id: string) {
    try {
      const { error } = await supabase
        .from('prompt_shortcuts')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

      if (error) throw error
      setOpenMenuId(null)
      loadShortcuts()
    } catch (error) {
      console.error('Error deleting shortcut:', error)
    }
  }

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 overflow-hidden backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-2xl bg-[var(--background)] h-full flex flex-col shadow-xl">
        {/* Fixed Header */}
        <div className="pt-12 px-6 pb-6 border-b border-[var(--accent)]">
          <h2 className="w-full h-[46px] flex items-center justify-center text-sm uppercase tracking-wider hover:text-[var(--muted)] transition-colors">Prompt Shortcuts</h2>
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
                    <span>Name your shortcut</span>
                    <div className="text-[10px] text-[var(--muted)]">This will be your command trigger in chat</div>
                  </div>
                </div>
                <div className="flex items-baseline gap-3">
                  <span className="text-[var(--muted)]">02</span>
                  <div className="space-y-1">
                    <span>Write your prompt template</span>
                    <div className="text-[10px] text-[var(--muted)] space-y-1">
                      <div>Your custom instruction for the AI to follow</div>
                      <div>Use <span className="bg-[var(--accent)] px-2 py-0.5">@nameofshortcut</span> to activate</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Add new shortcut */}
            <div className="space-y-1 mb-8">
              <div className="text-[10px] tracking-[0.2em] uppercase text-[var(--muted)] pl-1">shortcut name</div>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value.replace(/\s+/g, '_'))}
                placeholder="e.g. summarize"
                className="w-full p-4 bg-[var(--accent)] text-[var(--foreground)] focus:outline-none placeholder:text-[var(--muted)]"
              />
              <div className="text-[10px] tracking-[0.2em] uppercase text-[var(--muted)] pl-1 mt-4">shortcut content</div>
              <textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="e.g. Provide a concise summary of the given text: "
                className="w-full h-24 p-4 bg-[var(--accent)] text-[var(--foreground)] focus:outline-none resize-none placeholder:text-[var(--muted)]"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleAdd}
                  disabled={!newName.trim() || !newContent.trim()}
                  className="flex-1 p-4 text-xs uppercase tracking-wider bg-[var(--foreground)] text-[var(--background)] 
                           hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {editingId ? 'Save Changes' : 'Add Shortcut'}
                </button>
                {editingId && (
                  <button
                    onClick={handleCancel}
                    className="w-32 p-4 text-xs uppercase tracking-wider bg-[var(--accent)] 
                             hover:opacity-90 transition-opacity"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>

            {/* Shortcuts list */}
            <div className="space-y-1">
              {shortcuts.map((shortcut) => (
                <div key={shortcut.id} className="group flex items-start gap-4 p-4 bg-[var(--accent)]">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">@{shortcut.name}</div>
                    <div className="text-xs text-[var(--muted)] mt-1 break-words">{shortcut.content}</div>
                  </div>
                  <div className="relative menu-container">
                    <button
                      onClick={() => setOpenMenuId(openMenuId === shortcut.id ? null : shortcut.id)}
                      className="w-6 h-6 flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)] transition-colors text-xs"
                      aria-label="Menu"
                    >
                      •••
                    </button>
                    <div 
                      className={`
                        absolute right-0 mt-1 
                        ${openMenuId === shortcut.id ? 'opacity-100 visible translate-y-0' : 'opacity-0 invisible -translate-y-1'}
                        transition-all duration-150 ease-out z-10
                      `}
                    >
                      <div className="min-w-[110px] py-0.5 bg-[var(--background)] border border-[var(--accent)] backdrop-blur-md">
                        <button
                          onClick={() => handleEdit(shortcut)}
                          className="w-full px-3 py-1.5 text-[11px] tracking-wide hover:bg-[var(--accent)] transition-colors flex items-center justify-between group/btn"
                        >
                          <span>Edit</span>
                          <span className="text-[var(--muted)] group-hover/btn:text-[var(--foreground)] transition-colors scale-x-[-1]">✎</span>
                        </button>
                        <div className="h-px bg-[var(--accent)]"></div>
                        <button
                          onClick={() => handleDelete(shortcut.id)}
                          className="w-full px-3 py-1.5 text-[11px] tracking-wide text-red-500/70 hover:text-red-500 hover:bg-red-500/10 transition-colors flex items-center justify-between group/btn"
                        >
                          <span>Delete</span>
                          <span className="opacity-0 group-hover/btn:opacity-100 transition-opacity">×</span>
                        </button>
                      </div>
                    </div>
                  </div>
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