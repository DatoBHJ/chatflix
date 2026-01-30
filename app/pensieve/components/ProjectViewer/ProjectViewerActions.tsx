'use client'

import React from 'react'
import { Share, Info, ScrollText, Trash2, Aperture, Loader2, Check } from 'lucide-react'
import { getAdaptiveGlassStyleBlur, getIconClassName as getIconClassNameUtil } from '@/app/lib/adaptiveGlassStyle'

interface ProjectViewerActionsProps {
  isOverlayVisible: boolean
  isMobile: boolean
  showMobileButtons: boolean
  showCopyButton: boolean
  copied: boolean
  availablePrompts: any[]
  handleCopyPrompt: () => void
  setIsOverlayVisible: (visible: boolean) => void
  setShowCopyButton: (show: boolean) => void
  onEdit: () => void
  isEditing: boolean
  isGuest?: boolean
  onShowGuestModal?: () => void
  // New props for iOS Photos-like bar
  onShare?: () => void
  onDelete?: () => void
  onSave?: () => void
  onInfo?: () => void
  isDeleting?: boolean
  isSaving?: boolean
  isSaved?: boolean
}

export default function ProjectViewerActions({
  isOverlayVisible,
  isMobile,
  showMobileButtons,
  showCopyButton,
  copied,
  availablePrompts,
  handleCopyPrompt,
  setIsOverlayVisible,
  setShowCopyButton,
  onEdit,
  isEditing,
  isGuest = false,
  onShowGuestModal,
  onShare,
  onDelete,
  onSave,
  onInfo,
  isDeleting = false,
  isSaving = false,
  isSaved = false
}: ProjectViewerActionsProps) {
  // Common button style for the bottom bar
  const buttonBaseClass = "p-3 rounded-full text-white transition-all cursor-pointer flex items-center justify-center active:scale-95"
  
  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isGuest && onShowGuestModal) {
      onShowGuestModal()
      return
    }
    onEdit()
  }

  return (
    <>
      {/* iOS Photos-like Bottom Bar */}
      {!isOverlayVisible && (isMobile ? showMobileButtons : true) && (
        <div className="fixed bottom-0 left-0 right-0 z-30 pb-6 pt-4 px-4">
          <div className="max-w-lg mx-auto flex items-center justify-between">
            {/* Share button - left */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                if (isGuest && onShowGuestModal) {
                  onShowGuestModal()
                  return
                }
                onShare?.()
              }}
              className={`${buttonBaseClass}`}
              style={getAdaptiveGlassStyleBlur()}
              aria-label="Share"
            >
              <Share size={22} className={getIconClassNameUtil(true)} />
            </button>

            {/* Center group - Prompt/Sliders, Info, Edit/Pencil */}
            <div 
              className="flex items-center gap-1 rounded-full px-2 py-1"
              style={getAdaptiveGlassStyleBlur()}
            >
              {/* Prompt/Sliders button */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  if (availablePrompts.length > 0) {
                    setIsOverlayVisible(true)
                    setShowCopyButton(true)
                  }
                }}
                className={buttonBaseClass}
                aria-label="Show prompt"
              >
                <ScrollText size={22} className={getIconClassNameUtil(true)} />
              </button>

              {/* Info button */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onInfo?.()
                }}
                className={buttonBaseClass}
                aria-label="Info"
              >
                <Info size={22} className={getIconClassNameUtil(true)} />
              </button>

              {/* Edit button */}
              <button
                onClick={handleEditClick}
                disabled={isEditing}
                className={`${buttonBaseClass} disabled:opacity-50 disabled:cursor-not-allowed`}
                aria-label="Edit"
              >
                {isEditing ? (
                  <Loader2 size={22} className={`${getIconClassNameUtil(true)} animate-spin`} />
                ) : (
                  <Aperture size={22} className={getIconClassNameUtil(true)} />
                )}
              </button>
            </div>

            {/* Delete (owner) or Save (non-owner) */}
            {onDelete && !isGuest ? (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete()
                }}
                disabled={isDeleting}
                className={`${buttonBaseClass} disabled:opacity-50 disabled:cursor-not-allowed`}
                style={getAdaptiveGlassStyleBlur()}
                aria-label="Delete"
              >
                {isDeleting ? (
                  <Loader2 size={22} className={`${getIconClassNameUtil(true)} animate-spin`} />
                ) : (
                  <Trash2 size={22} className={getIconClassNameUtil(true)} />
                )}
              </button>
            ) : onSave ? (
              /* Save button - for non-owner or public view */
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  if (isGuest && onShowGuestModal) {
                    onShowGuestModal()
                    return
                  }
                  onSave?.()
                }}
                disabled={isSaving}
                className={`${buttonBaseClass} disabled:opacity-50 disabled:cursor-not-allowed`}
                style={getAdaptiveGlassStyleBlur()}
                aria-label="Save"
              >
                {isSaving ? (
                  <Loader2 size={22} className={`${getIconClassNameUtil(true)} animate-spin`} />
                ) : isSaved ? (
                  <Check size={22} className={getIconClassNameUtil(true)} />
                ) : (
                  <svg className={`w-[22px] h-[22px] ${getIconClassNameUtil(true)}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
                  </svg>
                )}
              </button>
            ) : (
              /* Placeholder for layout balance */
              <div className="p-3 w-12 h-12" />
            )}
          </div>
        </div>
      )}
    </>
  )
}
