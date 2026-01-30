import React from 'react'
import { X } from 'lucide-react'
import { getAdaptiveGlassStyleBlur } from '@/app/lib/adaptiveGlassStyle'

interface VisibilitySelectorProps {
  isOpen: boolean
  onClose: () => void
  isSaving: boolean
  isPublic: boolean | null
  setIsPublic: (isPublic: boolean | null) => void
  isOriginalSaved: boolean
  onSave: () => void
}

export function VisibilitySelector({
  isOpen,
  onClose,
  isSaving,
  isPublic,
  setIsPublic,
  isOriginalSaved,
  onSave
}: VisibilitySelectorProps) {
  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 z-9998 flex items-center justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSaving) {
          onClose()
        }
      }}
    >
      {/* Visibility selector card */}
      <div 
        className="relative rounded-3xl p-6 max-w-sm w-full mx-4"
        style={{
          ...(() => {
            const glassStyle = getAdaptiveGlassStyleBlur()
            // Remove 'background' property to avoid conflict with backgroundColor
            const { background, ...restStyle } = glassStyle as any
            return restStyle
          })(),
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 p-2 rounded-full text-white transition-colors cursor-pointer"
          onClick={() => {
            if (!isSaving) {
              onClose()
            }
          }}
          disabled={isSaving}
        >
          <X size={18} />
        </button>
        
        <h3 className="text-lg font-semibold text-white mb-4 text-center">
          Choose Visibility
        </h3>
        
        <div className="flex gap-3 justify-center mb-4">
          <button
            type="button"
            className={`px-6 py-3 rounded-2xl border text-sm font-semibold transition-all ${
              isPublic === true
                ? 'border-white/60 bg-white/20 text-white shadow-lg'
                : 'border-white/20 bg-white/5 text-white/80 hover:border-white/40'
            }`}
            onClick={() => setIsPublic(true)}
            disabled={isSaving}
          >
            Public
          </button>
          <button
            type="button"
            className={`px-6 py-3 rounded-2xl border text-sm font-semibold transition-all ${
              isPublic === false
                ? 'border-white/60 bg-white/20 text-white shadow-lg'
                : 'border-white/20 bg-white/5 text-white/80 hover:border-white/40'
            }`}
            onClick={() => setIsPublic(false)}
            disabled={isSaving}
          >
            Private
          </button>
        </div>
        
        <p className="text-xs text-white/60 text-center mb-4">
          {isPublic === null
            ? 'Select visibility to continue'
            : isPublic
              ? 'Anyone can see this image and its prompt'
              : 'Only you can see this image and its prompt'}
        </p>
      
        {/* Save button */}
        <button
          onClick={onSave}
          disabled={isSaving || isPublic === null || isOriginalSaved}
          className="w-full py-3 rounded-full text-white font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          style={{
            backgroundColor: isPublic !== null ? '#007AFF' : 'rgba(255, 255, 255, 0.1)',
            boxShadow: isPublic !== null ? '0 4px 20px rgba(0, 122, 255, 0.3)' : 'none',
          }}
        >
          {isSaving ? (
            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : isOriginalSaved ? (
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
            </svg>
          )}
          {isSaving ? (
            <span>Saving...</span>
          ) : isOriginalSaved ? (
            <span>Saved</span>
          ) : (
            <span>Save</span>
          )}
        </button>
      </div>
    </div>
  )
}

