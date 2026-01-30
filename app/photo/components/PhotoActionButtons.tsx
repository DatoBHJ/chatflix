'use client'

import { RectangleHorizontal, Trash2, Check } from 'lucide-react'
import { usePhotoSelection } from './PhotoContext'

interface PhotoActionButtonsProps {
  onSetAsBackground: () => void
  onDelete?: () => void  // Optional for DefaultBackgrounds
  canSetBackground: boolean  // selectedImageIds.length === 1
  canDelete: boolean  // selectedImageIds.length > 0
  isSettingBackground: boolean
  isSuccess: boolean
}

export default function PhotoActionButtons({
  onSetAsBackground,
  onDelete,
  canSetBackground,
  canDelete,
  isSettingBackground,
  isSuccess
}: PhotoActionButtonsProps) {
  const { isSelectionMode } = usePhotoSelection()
  
  if (!isSelectionMode) return null
  
  const getGlassStyle = () => {
    // 다크모드 전용 스타일
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark' || 
      (document.documentElement.getAttribute('data-theme') === 'system' && 
       window.matchMedia('(prefers-color-scheme: dark)').matches)
    
    return isDark ? {
      backgroundColor: window.innerWidth <= 768 ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.7)',
      backdropFilter: (window.innerWidth <= 768 || /^((?!chrome|android).)*safari/i.test(navigator.userAgent)) ? 'blur(10px)' : 'url(#glass-distortion-dark) blur(1px)',
      WebkitBackdropFilter: (window.innerWidth <= 768 || /^((?!chrome|android).)*safari/i.test(navigator.userAgent)) ? 'blur(10px)' : 'url(#glass-distortion-dark) blur(1px)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      boxShadow: '0 8px 40px rgba(0, 0, 0, 0.15), 0 4px 20px rgba(0, 0, 0, 0.1), 0 2px 8px rgba(0, 0, 0, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
    } : {
      backgroundColor: window.innerWidth <= 768 ? 'rgba(255, 255, 255, 0.6)' : 'rgba(255, 255, 255, 0.8)',
      backdropFilter: (window.innerWidth <= 768 || /^((?!chrome|android).)*safari/i.test(navigator.userAgent)) ? 'blur(10px)' : 'url(#glass-distortion) blur(1px)',
      WebkitBackdropFilter: (window.innerWidth <= 768 || /^((?!chrome|android).)*safari/i.test(navigator.userAgent)) ? 'blur(10px)' : 'url(#glass-distortion) blur(1px)',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      boxShadow: '0 8px 40px rgba(0, 0, 0, 0.06), 0 4px 20px rgba(0, 0, 0, 0.04), 0 2px 8px rgba(0, 0, 0, 0.025), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
    }
  }
  
  return (
    <div className="fixed bottom-0 left-0 right-0 p-3 flex flex-col text-[var(--foreground)] z-[90] pointer-events-none">
      <div className={`flex items-center ${onDelete ? 'justify-around' : 'justify-center'} px-2 pointer-events-auto gap-3`}>
        {/* Set as Background button */}
        <button
          onClick={onSetAsBackground}
          disabled={!canSetBackground || isSettingBackground || isSuccess}
          className="flex items-center gap-2 px-4 py-3 rounded-full disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all duration-300"
          style={getGlassStyle()}
          title="Set as Wallpaper"
        >
          {isSettingBackground ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : isSuccess ? (
            <Check size={20} className="text-blue-500" />
          ) : (
            <RectangleHorizontal size={20} />
          )}
          <span className="text-sm font-medium">Set as Wallpaper</span>
        </button>
        
        {/* Delete button - only if onDelete is provided */}
        {onDelete && (
          <button
            onClick={onDelete}
            disabled={!canDelete}
            className="flex items-center justify-center w-12 h-12 rounded-full disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all duration-300"
            style={getGlassStyle()}
            title="Delete"
          >
            <Trash2 size={20} />
          </button>
        )}
      </div>
    </div>
  )
}
