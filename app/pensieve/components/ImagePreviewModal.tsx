'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { ImageMetadata } from './ImageCard'

interface ImagePreviewModalProps {
  images: ImageMetadata[]
  folder: string
  isOpen: boolean
  onClose: () => void
  onImageSelect: (image: ImageMetadata, folder: string) => void
}

export default function ImagePreviewModal({
  images,
  folder,
  isOpen,
  onClose,
  onImageSelect
}: ImagePreviewModalProps) {
  const [isMounted, setIsMounted] = useState(false)
  const [imageErrors, setImageErrors] = useState<Set<number>>(new Set())
  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set())

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  const handleImageError = (index: number) => {
    setImageErrors((prev) => new Set(prev).add(index))
  }

  const handleImageLoad = (index: number) => {
    setLoadedImages((prev) => new Set(prev).add(index))
  }

  const handleImageClick = (image: ImageMetadata) => {
    onImageSelect(image, folder)
    onClose()
  }

  // Safely convert prompt to string (handles string | object)
  const promptToString = (prompt: string | object | undefined | null): string => {
    if (!prompt) return ''
    if (typeof prompt === 'string') return prompt
    try {
      return JSON.stringify(prompt)
    } catch {
      return ''
    }
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const getImageUrl = (image: ImageMetadata) => {
    return image.url || `/pensieve/${image.path}`
  }

  // Show up to 3 images
  const displayImages = images.slice(0, 3)
  const imageCount = displayImages.length

  const getGridLayout = () => {
    if (imageCount === 1) {
      return 'grid-cols-1 max-w-md'
    } else if (imageCount === 2) {
      return 'grid-cols-2 max-w-2xl'
    } else {
      return 'grid-cols-3 max-w-4xl'
    }
  }

  if (!isMounted || !isOpen) return null

  const modalContent = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="relative w-full h-full flex items-center justify-center p-4">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/60 hover:bg-black/80 text-white transition-colors"
          aria-label="Close"
        >
          <X size={24} />
        </button>

        <div className={`grid gap-4 w-full ${getGridLayout()}`}>
          {displayImages.map((image, index) => {
            const hasError = imageErrors.has(index)
            const isLoaded = loadedImages.has(index)

            return (
              <div
                key={index}
                className="relative rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity bg-[var(--subtle-divider)]"
                style={{ aspectRatio: '1' }}
                onClick={() => handleImageClick(image)}
              >
                {!hasError ? (
                  <>
                    <img
                      src={getImageUrl(image)}
                      alt={promptToString(image.prompt) || `Image ${index + 1}`}
                      className={`w-full h-full object-cover transition-opacity duration-300 ${
                        isLoaded ? 'opacity-100' : 'opacity-0'
                      }`}
                      onLoad={() => handleImageLoad(index)}
                      onError={() => handleImageError(index)}
                    />
                    {!isLoaded && (
                      <div className="absolute inset-0 bg-[var(--subtle-divider)] animate-pulse" />
                    )}
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[var(--muted)]">
                    Image not found
                  </div>
                )}
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors" />
              </div>
            )
          })}
        </div>

        {images.length > 3 && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-full bg-black/60 text-white text-sm">
            +{images.length - 3} more images (click to view all)
          </div>
        )}
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}

