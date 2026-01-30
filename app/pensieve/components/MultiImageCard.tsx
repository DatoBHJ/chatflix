'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { ImageMetadata } from './ImageCard'
import { createClient } from '@/utils/supabase/client'
import { Check, Eye, Heart } from 'lucide-react'
import { formatViewCount } from '../hooks/useViewCounts'
import { getAdaptiveGlassStyleBlur } from '@/app/lib/adaptiveGlassStyle'

interface MultiImageCardProps {
  images: ImageMetadata[]
  folder: string
  onPreviewClick: (images: ImageMetadata[], folder: string) => void
  isSelectionMode?: boolean
  isSelected?: boolean
  onSelect?: () => void
  viewCount?: number
  viewContext?: 'strands' | 'cabinet'
  likeCount?: number
}

export default function MultiImageCard({ 
  images, 
  folder, 
  onPreviewClick,
  isSelectionMode = false,
  isSelected = false,
  onSelect,
  viewCount,
  viewContext,
  likeCount
}: MultiImageCardProps) {
  const supabase = createClient()
  const [imageErrors, setImageErrors] = useState<Set<number>>(new Set())
  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set())
  const [imageUrls, setImageUrls] = useState<Map<number, string>>(new Map())

  const handleImageError = (index: number) => {
    setImageErrors((prev) => new Set(prev).add(index))
  }

  const handleImageLoad = (index: number) => {
    setLoadedImages((prev) => new Set(prev).add(index))
  }

  // Ref callback to handle cached images that are already complete
  // Use requestAnimationFrame to allow smooth transition even for cached images
  const handleImgRef = useCallback((img: HTMLImageElement | null, index: number) => {
    if (img?.complete && img.naturalHeight > 0) {
      requestAnimationFrame(() => {
        setLoadedImages((prev) => {
          if (prev.has(index)) return prev
          return new Set(prev).add(index)
        })
      })
    }
  }, [])

  const handleClick = () => {
    if (isSelectionMode && onSelect) {
      onSelect()
    } else {
      onPreviewClick(images, folder)
    }
  }

  // 레퍼런스 이미지의 URL 로드
  useEffect(() => {
    const loadImageUrls = async () => {
      const urlMap = new Map<number, string>()
      
      await Promise.all(
        images.map(async (image, index) => {
          // 이미 url이 있으면 그대로 사용
          if (image.url) {
            urlMap.set(index, image.url)
            return
          }

          // 레퍼런스 이미지인 경우 Supabase Storage URL 생성
          if (image.metadata?.isReferenceImage && image.path) {
            try {
              const { data: signedData, error } = await supabase.storage
                .from('saved-gallery')
                .createSignedUrl(image.path, 24 * 60 * 60)
              
              if (signedData?.signedUrl && !error) {
                urlMap.set(index, signedData.signedUrl)
                return
              }
            } catch (error) {
              console.warn('Failed to load reference image from Supabase Storage:', image.path, error)
            }

            // Fallback to originalUrl if available
            if (image.metadata?.originalUrl) {
              urlMap.set(index, image.metadata.originalUrl)
              return
            }
          }

          // 일반 이미지의 경우
          urlMap.set(index, image.path ? `/pensieve/${image.path}` : '')
        })
      )
      
      setImageUrls(urlMap)
    }

    loadImageUrls()
  }, [images, supabase])

  const getImageUrl = (image: ImageMetadata, index: number) => {
    // 레퍼런스 이미지의 경우 로드된 URL 사용
    if (imageUrls.has(index)) {
      return imageUrls.get(index) || image.url || `/pensieve/${image.path}`
    }
    return image.url || `/pensieve/${image.path}`
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

  const imageCount = images.length

  // Layout based on image count
  const getGridLayout = () => {
    if (imageCount === 1) {
      return 'grid-cols-1'
    } else if (imageCount === 2) {
      return 'grid-cols-2'
    } else if (imageCount === 3) {
      return 'grid-cols-2 grid-rows-2'
    } else {
      return 'grid-cols-2 grid-rows-2'
    }
  }

  const getImageStyle = (index: number) => {
    if (imageCount === 1) {
      return {}
    } else if (imageCount === 2) {
      return {}
    } else if (imageCount === 3) {
      if (index === 0) {
        return { gridColumn: '1 / 2', gridRow: '1 / 2' }
      } else if (index === 1) {
        return { gridColumn: '2 / 3', gridRow: '1 / 2' }
      } else {
        return { gridColumn: '1 / 3', gridRow: '2 / 3' }
      }
    } else {
      return {}
    }
  }

  const displayImages = imageCount > 4 ? images.slice(0, 4) : images
  const remainingCount = imageCount > 4 ? imageCount - 4 : 0

  const [detectedAspectRatio, setDetectedAspectRatio] = useState<number | null>(null)

  // Categorize aspect ratio to portrait/square/landscape with appropriate display ratios
  const categorizeAspectRatio = (naturalWidth: number, naturalHeight: number): number => {
    const ratio = naturalWidth / naturalHeight
    
    if (ratio < 0.75) {
      // Very tall portrait (e.g., 9:16, phone screenshots)
      return 0.7
    } else if (ratio < 0.95) {
      // Portrait (e.g., 3:4, 2:3)
      return 0.8
    } else if (ratio <= 1.05) {
      // Square-ish
      return 1
    } else if (ratio <= 1.35) {
      // Landscape (e.g., 4:3)
      return 1.2
    } else {
      // Wide landscape (e.g., 16:9)
      return 1.4
    }
  }

  // For single image, detect aspect ratio from actual image
  const singleImageAspectRatio = useMemo(() => {
    if (imageCount !== 1 || !images[0]) return 1
    
    // Use detected aspect ratio from actual image load
    if (detectedAspectRatio !== null) return detectedAspectRatio
    
    // Try to parse from dimensions if available
    const dimensions = images[0].dimensions
    if (dimensions) {
      const match = dimensions.match(/(\d+)\s*[x×]\s*(\d+)/i)
      if (match) {
        const width = parseInt(match[1], 10)
        const height = parseInt(match[2], 10)
        if (width > 0 && height > 0) {
          return categorizeAspectRatio(width, height)
        }
      }
    }
    
    // Default to square until image loads
    return 1
  }, [images, imageCount, detectedAspectRatio])

  const handleFirstImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    handleImageLoad(0)
    // Only detect aspect ratio for single image cards
    if (imageCount === 1) {
      const img = e.currentTarget
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        const categorized = categorizeAspectRatio(img.naturalWidth, img.naturalHeight)
        setDetectedAspectRatio(categorized)
      }
    }
  }

  return (
    <div
      className="relative rounded-lg overflow-hidden cursor-pointer transition-all group mb-3"
      onClick={handleClick}
    >
      {/* Selection Checkmark */}
      {isSelectionMode && isSelected && (
        <div className="absolute bottom-2 right-2 z-20">
          <div className="bg-[#007AFF] rounded-full p-1 shadow-sm">
            <Check size={14} strokeWidth={3} className="text-white" />
          </div>
        </div>
      )}

      {/* Selection Overlay (Dimming) */}
      {isSelectionMode && isSelected && (
        <div className="absolute inset-0 bg-black/20 z-10 transition-all duration-300" />
      )}

      {/* View Count Badge - top left (for groups in strands) */}
      {!isSelectionMode && viewContext === 'strands' && viewCount !== undefined && (
        <div 
          className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded-full flex items-center gap-1"
          style={getAdaptiveGlassStyleBlur()}
        >
          <Eye size={12} className="text-white/80" />
          <span className="text-[11px] text-white/80 font-medium">
            {formatViewCount(viewCount)}
          </span>
        </div>
      )}

      {/* Like Count Badge - bottom right */}
      {!isSelectionMode && likeCount !== undefined && likeCount > 0 && (
        <div 
          className="absolute bottom-2 right-2 z-10 px-2 py-0.5 rounded-full flex items-center gap-1"
          style={getAdaptiveGlassStyleBlur()}
        >
          <Heart size={12} className="text-white/80 fill-white/80" />
          <span className="text-[11px] text-white/80 font-medium">
            {formatViewCount(likeCount)}
          </span>
        </div>
      )}

      <div 
        className={`grid gap-0.5 ${getGridLayout()}`} 
        style={{ 
          aspectRatio: imageCount === 1 ? singleImageAspectRatio : 1
        }}
      >
        {displayImages.map((image, index) => {
          const hasError = imageErrors.has(index)
          const isLoaded = loadedImages.has(index)
          
          return (
            <div
              key={index}
              className="relative overflow-hidden bg-[var(--subtle-divider)]"
              style={getImageStyle(index)}
            >
              {!hasError ? (
                <>
                  <img
                    ref={(el) => handleImgRef(el, index)}
                    src={getImageUrl(image, index)}
                    alt={promptToString(image.prompt) || `Image ${index + 1}`}
                    className={`w-full h-full object-cover transform transition-all duration-700 ease-out ${
                      isLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-105'
                    }`}
                    style={{ border: 'none', outline: 'none' }}
                    onLoad={index === 0 ? handleFirstImageLoad : () => handleImageLoad(index)}
                    onError={() => handleImageError(index)}
                    loading="lazy"
                    decoding="async"
                  />
                  {!isLoaded && (
                    <div className="absolute inset-0 bg-[var(--subtle-divider)] animate-pulse" />
                  )}
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[var(--muted)] text-xs">
                  Error
                </div>
              )}
              {/* Show remaining count overlay for 5+ images */}
              {index === 3 && remainingCount > 0 && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <span className="text-white text-lg font-semibold">+{remainingCount}</span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}


