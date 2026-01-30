'use client'

import React from 'react'
import ReactDOM from 'react-dom'
import { X } from 'lucide-react'
import { getAdaptiveGlassStyleBlur, getTextStyle } from '@/app/lib/adaptiveGlassStyle'
import { MODAL_SHEET_SECONDARY_Z } from '@/app/lib/zIndex'
import { PhotoProvider } from '@/app/photo/components/PhotoContext'
import AllSection from '@/app/photo/components/AllSection'

interface PhotoAllModalProps {
  isOpen: boolean
  onClose: () => void
  user: { id: string; isAnonymous?: boolean } | null
  currentBackground: string
  backgroundType: 'default' | 'custom'
  backgroundId: string | undefined
  onBackgroundChange: (backgroundUrl: string, type: 'default' | 'custom', id?: string) => void
}

export function PhotoAllModal({
  isOpen,
  onClose,
  user,
  currentBackground,
  backgroundType,
  backgroundId,
  onBackgroundChange
}: PhotoAllModalProps) {
  if (!isOpen) return null

  const modalContent = (
    <div
      className="fixed inset-0"
      style={{
        touchAction: 'none',
        overflow: 'hidden',
        zIndex: MODAL_SHEET_SECONDARY_Z
      }}
    >
      <div
        className="fixed inset-0 bg-transparent transition-all duration-500 ease-out"
        onClick={onClose}
        style={{ touchAction: 'none' }}
      />

      <div
        className="fixed inset-x-0 bottom-0 w-full flex flex-col overflow-hidden rounded-t-3xl"
        style={{
          height: 'calc(100vh - 120px)',
          maxHeight: 'calc(100vh - 120px)',
          transform: 'translateY(0)',
          transition: 'transform 0.5s cubic-bezier(0.25, 0.1, 0.25, 1), opacity 0.3s ease-out',
          willChange: 'transform, opacity',
          ...getAdaptiveGlassStyleBlur(),
          backgroundColor:
            typeof window !== 'undefined' &&
            (document.documentElement.getAttribute('data-theme') === 'dark' ||
              (document.documentElement.getAttribute('data-theme') === 'system' &&
                window.matchMedia('(prefers-color-scheme: dark)').matches))
              ? 'rgba(30, 30, 30, 0.6)'
              : 'rgba(240, 240, 240, 0.6)',
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
          zIndex: MODAL_SHEET_SECONDARY_Z
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center pt-4 pb-2 shrink-0">
          <div
            className="w-12 h-1.5 rounded-full mx-auto transition-colors duration-200"
            style={{ backgroundColor: 'rgba(209, 213, 219, 0.3)' }}
          />
        </div>

        <div className="relative flex items-center justify-center py-6 px-6 shrink-0">
          <h2 className="text-xl font-semibold" style={getTextStyle(false)}>
            Photos
          </h2>
          <button
            onClick={onClose}
            className="absolute right-6 p-2 rounded-lg transition-colors hover:bg-white/10"
            style={{
              WebkitTapHighlightColor: 'transparent',
              WebkitTouchCallout: 'none',
              WebkitUserSelect: 'none',
              userSelect: 'none'
            }}
          >
            <X size={24} style={{ color: 'var(--foreground)' }} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 pb-4">
          <PhotoProvider>
            <AllSection
              user={user}
              currentBackground={currentBackground}
              backgroundType={backgroundType}
              backgroundId={backgroundId}
              onBackgroundChange={onBackgroundChange}
            />
          </PhotoProvider>
        </div>
      </div>
    </div>
  )

  return typeof window !== 'undefined'
    ? ReactDOM.createPortal(modalContent, document.body)
    : null
}
