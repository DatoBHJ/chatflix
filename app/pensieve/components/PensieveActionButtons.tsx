'use client'

import { Share, Trash2, Check, Bookmark } from 'lucide-react'
import { usePensieveSelection } from '../context/PensieveSelectionContext'
import { useState } from 'react'
import { getAdaptiveGlassStyleBlur } from '@/app/lib/adaptiveGlassStyle'

interface PensieveActionButtonsProps {
  onShare: () => void
  onDelete?: () => void
  onSave?: () => void
  canShare: boolean
  canDelete?: boolean
  canSave?: boolean
  isSaving?: boolean
  isSaved?: boolean
  isDeleting?: boolean
  selectedImageCount?: number
  selectedProjectCount?: number
  selectedGroupCount?: number
}

export default function PensieveActionButtons({
  onShare,
  onDelete,
  onSave,
  canShare,
  canDelete,
  canSave,
  isSaving = false,
  isSaved = false,
  isDeleting = false,
  selectedImageCount = 0,
  selectedProjectCount = 0,
  selectedGroupCount = 0
}: PensieveActionButtonsProps) {
  const { isSelectionMode } = usePensieveSelection()
  const [isSharing, setIsSharing] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  
  const getGlassStyle = () => {
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

  const handleShare = async () => {
    setIsSharing(true)
    try {
      await onShare()
      setIsSuccess(true)
      setTimeout(() => {
        setIsSuccess(false)
        setIsSharing(false)
      }, 1000)
    } catch (error) {
      setIsSharing(false)
    }
  }

  // 선택된 항목 수 텍스트 생성
  const getSelectionText = () => {
    const totalImages = selectedImageCount + selectedGroupCount
    const totalProjects = selectedProjectCount
    const totalCount = totalImages + totalProjects

    if (totalCount === 0) {
      return 'Select Items'
    }
    
    return `${totalCount} selected`
  }
  
  return (
    <>
      {isSelectionMode && (
        <div className="fixed bottom-0 left-0 right-0 sm:bottom-4 pb-6 sm:pb-0 flex flex-col text-white z-[90] pointer-events-none">
          <div className="flex items-center justify-between sm:grid sm:grid-cols-[1fr_auto_1fr] sm:w-[500px] sm:mx-auto px-6 sm:px-0 pointer-events-auto">
            {/* Share button - left */}
            <div className="flex justify-start">
              <button
                onClick={handleShare}
                disabled={!canShare || isSharing || isSuccess}
                className="flex items-center justify-center w-14 h-14 rounded-full disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all duration-300"
                style={getAdaptiveGlassStyleBlur()}
                title="Share"
              >
                {isSharing ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : isSuccess ? (
                  <Check size={22} className="text-blue-400" />
                ) : (
                  <Share size={22} className="text-white" />
                )}
              </button>
            </div>

            {/* Selection text - center */}
            <div className="flex justify-center items-center min-w-[200px]">
              <span className="text-lg font-medium drop-shadow-md whitespace-nowrap">
                {getSelectionText()}
              </span>
            </div>
            
            {/* Right buttons - Right */}
            <div className="flex justify-end items-center gap-4 sm:gap-4">
              {onDelete && (
                <button
                  onClick={onDelete}
                  disabled={!canDelete || isDeleting}
                  className="flex items-center justify-center w-14 h-14 rounded-full disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all duration-300"
                  style={getAdaptiveGlassStyleBlur()}
                  title="Delete"
                >
                  {isDeleting ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Trash2 size={22} className="text-white" />
                  )}
                </button>
              )}

              {onSave && (
                <button
                  onClick={onSave}
                  disabled={!canSave || isSaving || isSaved}
                  className="flex items-center justify-center w-14 h-14 rounded-full disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all duration-300"
                  style={getAdaptiveGlassStyleBlur()}
                  title="Save to Cabinet"
                >
                  {isSaving ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : isSaved ? (
                    <Check size={22} className="text-blue-400" />
                  ) : (
                    <Bookmark size={22} className="text-white" />
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

