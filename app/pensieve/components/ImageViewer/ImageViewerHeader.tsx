'use client'

import React from 'react'
import { X, Globe, Lock, Loader2, Eye } from 'lucide-react'
import { getAdaptiveGlassStyleBlur, getIconClassName as getIconClassNameUtil } from '@/app/lib/adaptiveGlassStyle'
import { formatViewCount } from '../../hooks/useViewCounts'

interface ImageViewerHeaderProps {
  isOverlayVisible: boolean
  isMobile: boolean
  showMobileButtons: boolean
  folder: string
  isGuest: boolean
  handleClose: () => void
  isPublic: boolean
  onTogglePublic: (e: React.MouseEvent) => void
  isTogglingPublic: boolean
  viewCount?: number
  viewContext?: 'strands' | 'cabinet'
  currentIndex?: number
  totalImages?: number
}

export default function ImageViewerHeader({
  isOverlayVisible,
  isMobile,
  showMobileButtons,
  folder,
  isGuest,
  handleClose,
  isPublic,
  onTogglePublic,
  isTogglingPublic,
  viewCount,
  viewContext,
  currentIndex = 0,
  totalImages = 0
}: ImageViewerHeaderProps) {
  // Determine what to show in top-left
  const showViewCount = viewContext === 'strands' && viewCount !== undefined
  const showPrivateLockIcon = viewContext === 'cabinet' && !isPublic && isGuest
  const showVisibilityToggle = (folder === 'saved' && !isGuest && !viewContext) || (viewContext === 'cabinet' && !isGuest)

  return (
    <>
      {/* Top Left - View Count (for strands or public items) */}
      {!isOverlayVisible && (isMobile ? showMobileButtons : true) && showViewCount && (
        <div 
          className={`absolute top-5 left-4 px-3 py-1.5 rounded-full flex items-center gap-1.5 ${isOverlayVisible ? 'z-10' : 'z-10000'}`}
          style={getAdaptiveGlassStyleBlur()}
        >
          <Eye size={18} className="text-white/80" />
          <span className="text-sm text-white/80 font-medium">
            {formatViewCount(viewCount!)}
          </span>
        </div>
      )}

      {/* Top Left - Lock Icon (for private items when guest is viewing) */}
      {!isOverlayVisible && (isMobile ? showMobileButtons : true) && showPrivateLockIcon && (
        <div 
          className={`absolute top-4 left-4 p-2 rounded-full flex items-center justify-center ${isOverlayVisible ? 'z-10' : 'z-10000'}`}
          style={getAdaptiveGlassStyleBlur()}
        >
          <Lock size={24} className="text-white/70" />
        </div>
      )}

      {/* Visibility Toggle - top left (only for saved folder, owner only, no viewContext) */}
      {!isOverlayVisible && (isMobile ? showMobileButtons : true) && showVisibilityToggle && (
        <button 
          className={`absolute top-4 left-4 p-2 rounded-full text-white transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center ${isOverlayVisible ? 'z-10' : 'z-10000'}`}
              style={getAdaptiveGlassStyleBlur()}
              onClick={onTogglePublic}
              disabled={isTogglingPublic}
              title={isPublic ? 'Public - Click to make private' : 'Private - Click to make public'}
              aria-label={isPublic ? 'Make private' : 'Make public'}
            >
              {isTogglingPublic ? (
                <Loader2 size={24} className="text-white animate-spin" />
              ) : isPublic ? (
                <Globe size={24} className="text-green-400" />
              ) : (
                <Lock size={24} className="text-white/70" />
              )}
            </button>
          )}

      {/* Close button - top right (hidden when prompt overlay is visible) */}
      {!isOverlayVisible && (isMobile ? showMobileButtons : true) && (
        <button 
          className={`absolute top-4 right-4 p-2 rounded-full text-white transition-colors cursor-pointer ${isOverlayVisible ? 'z-10' : 'z-10000'}`}
          style={getAdaptiveGlassStyleBlur()}
          onClick={handleClose}
          aria-label="Close image viewer"
        >
          <X size={24} className={getIconClassNameUtil(true)} />
        </button>
      )}

      {/* Pagination dots - top center */}
      {!isOverlayVisible && totalImages > 1 && (
        <div className="absolute top-8 left-1/2 -translate-x-1/2 z-10000 flex gap-1.5 px-3 py-1.5 rounded-full" style={getAdaptiveGlassStyleBlur()}>
          {totalImages <= 3 ? (
            // If 3 or fewer, show actual dots
            Array.from({ length: totalImages }).map((_, idx) => (
              <div 
                key={idx}
                className={`w-1 h-1 rounded-full transition-all duration-300 ${
                  idx === currentIndex ? 'bg-white scale-125' : 'bg-white/30'
                }`}
              />
            ))
          ) : (
            // If more than 3, show minimal 3-dot indicators
            [0, 1, 2].map((dotIdx) => {
              let isActive = false;
              if (currentIndex === 0) isActive = dotIdx === 0;
              else if (currentIndex === totalImages - 1) isActive = dotIdx === 2;
              else isActive = dotIdx === 1;

              return (
                <div 
                  key={dotIdx}
                  className={`w-1 h-1 rounded-full transition-all duration-300 ${
                    isActive ? 'bg-white scale-125' : 'bg-white/30'
                  }`}
                />
              );
            })
          )}
        </div>
      )}
    </>
  )
}
