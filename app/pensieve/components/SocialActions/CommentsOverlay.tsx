'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Send, Trash2, Loader2 } from 'lucide-react'
import { getAdaptiveGlassStyleBlur } from '@/app/lib/adaptiveGlassStyle'
import { Comment } from '../../hooks/useSocialActions'

interface CommentsOverlayProps {
  isOpen: boolean
  onClose: () => void
  comments: Comment[]
  isLoading: boolean
  onAddComment: (content: string) => Promise<boolean>
  onDeleteComment: (commentId: string) => Promise<boolean>
  isGuest: boolean
  onShowGuestModal?: () => void
  currentUserId?: string
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'now'
  if (diffMins < 60) return `${diffMins}m`
  if (diffHours < 24) return `${diffHours}h`
  if (diffDays < 7) return `${diffDays}d`
  return date.toLocaleDateString()
}

export default function CommentsOverlay({
  isOpen,
  onClose,
  comments,
  isLoading,
  onAddComment,
  onDeleteComment,
  isGuest,
  onShowGuestModal,
  currentUserId
}: CommentsOverlayProps) {
  const [newComment, setNewComment] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  // Scroll to bottom when new comment is added
  useEffect(() => {
    if (listRef.current && comments.length > 0) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [comments.length])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim() || isSending) return

    if (isGuest && onShowGuestModal) {
      onShowGuestModal()
      return
    }

    setIsSending(true)
    const success = await onAddComment(newComment)
    if (success) {
      setNewComment('')
    }
    setIsSending(false)
  }

  const handleDelete = async (commentId: string) => {
    setDeletingId(commentId)
    await onDeleteComment(commentId)
    setDeletingId(null)
  }

  if (!isMounted || !isOpen) return null

  const content = (
    <div 
      className="fixed inset-0 z-100001 flex items-end justify-center sm:items-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="relative w-full sm:w-[480px] max-h-[70vh] sm:max-h-[60vh] overflow-hidden rounded-t-[24px] sm:rounded-[24px] shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95 duration-300"
        style={{
          ...getAdaptiveGlassStyleBlur(),
          backgroundColor: 'rgba(23, 23, 23, 0.95)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h3 className="text-lg font-semibold text-white">Comments</h3>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X size={20} className="text-white/70" />
          </button>
        </div>

        {/* Comments List */}
        <div 
          ref={listRef}
          className="flex-1 overflow-y-auto px-6 py-4 space-y-4 max-h-[calc(70vh-140px)] sm:max-h-[calc(60vh-140px)]"
        >
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 text-white/50 animate-spin" />
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center py-8 text-white/40 text-sm">
              No comments yet. Be the first!
            </div>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="flex gap-3 group">
                {/* Avatar placeholder */}
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex-shrink-0 flex items-center justify-center">
                  <span className="text-white text-xs font-bold">
                    {comment.author_name?.charAt(0).toUpperCase() || 'U'}
                  </span>
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-white font-medium text-sm truncate">
                      {comment.author_name || 'User'}
                    </span>
                    <span className="text-white/40 text-xs flex-shrink-0">
                      {formatTimeAgo(comment.created_at)}
                    </span>
                  </div>
                  <p className="text-white/80 text-sm mt-0.5 break-words">
                    {comment.content}
                  </p>
                </div>

                {/* Delete button (only for own comments) */}
                {currentUserId === comment.user_id && (
                  <button
                    onClick={() => handleDelete(comment.id)}
                    disabled={deletingId === comment.id}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-full hover:bg-white/10 transition-all cursor-pointer disabled:opacity-50"
                    aria-label="Delete comment"
                  >
                    {deletingId === comment.id ? (
                      <Loader2 size={14} className="text-white/50 animate-spin" />
                    ) : (
                      <Trash2 size={14} className="text-white/50 hover:text-red-400" />
                    )}
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="px-6 py-4 border-t border-white/10">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder={isGuest ? "Sign in to comment..." : "Add a comment..."}
              maxLength={500}
              disabled={isGuest}
              className="flex-1 bg-white/10 text-white placeholder:text-white/40 rounded-full px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-white/20 transition-all disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!newComment.trim() || isSending || isGuest}
              className="p-2.5 rounded-full bg-[#007AFF] text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:bg-[#0066DD] active:scale-95 cursor-pointer"
              aria-label="Send"
            >
              {isSending ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Send size={18} />
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )

  return createPortal(content, document.body)
}
