'use client'

import React from 'react'
import { Image, FolderOpen, HardDrive, Cloud, Smartphone, Monitor } from 'lucide-react'
import { getAdaptiveGlassStyleBlur, getAdaptiveGlassBackgroundColor } from '@/app/lib/adaptiveGlassStyle'
import { PhotosIcon } from '@/app/components/SuggestedPrompt/apps/appRegistry'

interface FileSelectionPopoverProps {
  isOpen: boolean
  onClose: () => void
  onSelectPhoto: () => void
  onSelectLocalFile: () => void
  buttonRef: React.RefObject<HTMLButtonElement | null>
  isDark: boolean
}

export function FileSelectionPopover({
  isOpen,
  onClose,
  onSelectPhoto,
  onSelectLocalFile,
  isDark
}: FileSelectionPopoverProps) {
  if (!isOpen) return null

  return (
    <div 
      className="absolute top-0 -translate-y-full -mt-3 sm:-mt-3.5 -left-4 w-[200px] sm:w-[220px] rounded-[22px] z-35 overflow-hidden tool-selector shadow-2xl"
      style={{
        ...getAdaptiveGlassStyleBlur(),
        backgroundColor: getAdaptiveGlassBackgroundColor().backgroundColor,
        backdropFilter: 'blur(40px)',
        WebkitBackdropFilter: 'blur(40px)',
        border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.04)',
      }}
    >
      <div className="p-2 flex flex-col gap-1">
        {/* App Library Option */}
        <button
          type="button"
          onClick={() => {
            onSelectPhoto()
            onClose()
          }}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 transition-all duration-200 text-left cursor-pointer hover:bg-white/5 active:scale-[0.97] rounded-[14px]"
        >
          <div 
            className="w-7 h-7 rounded-[8px] flex items-center justify-center shrink-0 shadow-md relative overflow-hidden"
            style={{ 
              ...getAdaptiveGlassStyleBlur(),
              background: 'linear-gradient(135deg, #9333EA 0%, #A855F7 100%)',
              border: 'none',
            }}
          >
            <div className="absolute inset-0 bg-linear-to-tr from-white/20 to-transparent opacity-40" />
            <PhotosIcon className="w-7 h-7 relative z-10" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[13px] font-semibold leading-tight tracking-tight truncate">Your Chatflix photos</span>
          </div>
        </button>

        {/* Device Storage Option */}
        <button
          type="button"
          onClick={() => {
            onSelectLocalFile()
            onClose()
          }}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 transition-all duration-200 text-left cursor-pointer hover:bg-white/5 active:scale-[0.97] rounded-[14px]"
        >
          <div 
            className="w-7 h-7 rounded-[8px] flex items-center justify-center shrink-0 shadow-md relative overflow-hidden"
            style={{ 
              ...getAdaptiveGlassStyleBlur(),
              background: isDark ? 'linear-gradient(135deg, #4B5563 0%, #1F2937 100%)' : 'linear-gradient(135deg, #D1D5DB 0%, #9CA3AF 100%)',
              border: 'none',
            }}
          >
            <div className="absolute inset-0 bg-linear-to-tr from-white/20 to-transparent opacity-40" />
            <Monitor className="w-4 h-4 text-white relative z-10" strokeWidth={2.5} />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[13px] font-semibold leading-tight tracking-tight truncate">Files on your device</span>
          </div>
        </button>
      </div>
    </div>
  )
}
