'use client'

import React from 'react'
import { Loader2 } from 'lucide-react'

interface ImageViewerContentProps {
  displayImageUrl: string
  imageError: boolean
  handleImageClick: (e: React.MouseEvent) => void
  handleTouchStart: (e: React.TouchEvent) => void
  handleTouchMove: (e: React.TouchEvent) => void
  handleTouchEnd: (e: React.TouchEvent) => void
  setViewingImageId: (id: string | null) => void
  setViewingImageUrl: (url: string | null) => void
  setImageError: (error: boolean) => void
}

export default function ImageViewerContent({
  displayImageUrl,
  imageError,
  handleImageClick,
  handleTouchStart,
  handleTouchMove,
  handleTouchEnd,
  setViewingImageId,
  setViewingImageUrl,
  setImageError
}: ImageViewerContentProps) {
  return (
    <div 
      className="relative flex items-center justify-center bg-transparent overflow-hidden"
      onClick={(e) => e.stopPropagation()}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ 
        width: '100vw', 
        height: '100vh' 
      }}
    >
      {/* Background image - always visible */}
      {!imageError && displayImageUrl && (
        <img
          src={displayImageUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover z-0"
          style={{
            filter: 'brightness(0.3) blur(20px)',
            transform: 'scale(1.1)',
            objectPosition: 'center'
          }}
          aria-hidden="true"
        />
      )}
      
      <div className="relative group flex flex-col items-center justify-center z-10 w-full h-full cursor-pointer">
        <div className="relative flex items-center justify-center w-full h-full">
          <div 
            className={`relative w-full h-full ${imageError ? 'opacity-0' : 'opacity-100'}`}
            onClick={handleImageClick}
          >
            <img
              src={displayImageUrl}
              alt="view"
              className="w-full h-full object-contain"
              onError={() => setImageError(true)}
            />
          </div>
          
          {imageError && (
            <div className="absolute inset-0 flex items-center justify-center text-white/50">
              <p>Failed to load image</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

