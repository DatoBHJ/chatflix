'use client'

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { Lock, Check, Eye, Heart } from 'lucide-react'
import { formatViewCount } from '../hooks/useViewCounts'
import { getAdaptiveGlassStyleBlur } from '@/app/lib/adaptiveGlassStyle'

export interface ImageMetadata {
  id?: string
  path: string
  filename: string
  size: string
  createdDate: string
  keywords: string[]
  links: string[]
  prompt: string | object // Can be string or JSON object
  dimensions: string
  url?: string
  ai_json_prompt?: any
  ai_prompt?: string
  is_public?: boolean
  folder?: string // Folder name (saved, uploaded, pensieve_curated, etc.)
  view_count?: number // 조회수
  // pensieve_curated specific fields
  pensieve_curated_queries?: string[]
  pensieve_curated_strategies?: string[]
  pensieve_curated_authors?: string[]
  pensieve_curated_tweetIds?: string[]
  // 하위 호환성을 위한 별칭 (점진적 마이그레이션용)
  x_search_queries?: string[]
  x_search_strategies?: string[]
  x_search_authors?: string[]
  x_search_tweetIds?: string[]
  // Metadata JSONB field (from Supabase)
  metadata?: {
    referenceImages?: Array<{
      blobUrl: string
      base64?: string
      order: number
      tweetId: string
      originalUrl: string
    }>
    [key: string]: any
  }
}

// Parse dimensions string (e.g., "1024x768") to aspect ratio
function parseDimensionsToAspectRatio(dimensions: string | undefined): number | null {
  if (!dimensions) return null
  const match = dimensions.match(/(\d+)\s*[x×]\s*(\d+)/i)
  if (match) {
    const width = parseInt(match[1], 10)
    const height = parseInt(match[2], 10)
    if (width > 0 && height > 0) {
      return width / height
    }
  }
  return null
}

// Categorize aspect ratio to portrait/square/landscape with appropriate display ratios
// Returns a display-friendly aspect ratio (not too extreme)
function categorizeAspectRatio(naturalWidth: number, naturalHeight: number): number {
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

// Generate a consistent initial aspect ratio based on image path/id
// Used as placeholder before actual dimensions are known
function getInitialAspectRatio(seed: string): number {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  // Start with 1 (square) as default, will be updated on image load
  return 1
}

interface ImageCardProps {
  image: ImageMetadata
  folder: string
  onImageClick: (image: ImageMetadata, folder: string) => void
  showLockIcon?: boolean
  isSelectionMode?: boolean
  isSelected?: boolean
  onSelect?: () => void
  viewCount?: number
  viewContext?: 'strands' | 'cabinet'
  likeCount?: number
}

export default function ImageCard({ 
  image, 
  folder, 
  onImageClick, 
  showLockIcon = false,
  isSelectionMode = false,
  isSelected = false,
  onSelect,
  viewCount,
  viewContext,
  likeCount
}: ImageCardProps) {
  const [imageError, setImageError] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [detectedAspectRatio, setDetectedAspectRatio] = useState<number | null>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  const imageUrl = image.url || `/pensieve/${image.path}`

  // Handle cached images: check if image is already complete on mount or URL change
  // Use requestAnimationFrame to allow smooth transition even for cached images
  useEffect(() => {
    const img = imgRef.current
    if (img?.complete && img.naturalHeight > 0) {
      // Delay setting loaded to allow smooth transition
      requestAnimationFrame(() => {
        setLoaded(true)
        const categorized = categorizeAspectRatio(img.naturalWidth, img.naturalHeight)
        setDetectedAspectRatio(categorized)
      })
    }
  }, [imageUrl])

  // Calculate aspect ratio: prefer detected from actual image, then from dimensions string, then initial placeholder
  const aspectRatio = useMemo(() => {
    // Use detected aspect ratio from actual image load
    if (detectedAspectRatio !== null) return detectedAspectRatio
    
    // Try parsing from dimensions string
    const fromDimensions = parseDimensionsToAspectRatio(image.dimensions)
    if (fromDimensions) {
      // Categorize the parsed dimensions to a display-friendly ratio
      const match = image.dimensions.match(/(\d+)\s*[x×]\s*(\d+)/i)
      if (match) {
        return categorizeAspectRatio(parseInt(match[1], 10), parseInt(match[2], 10))
      }
      return fromDimensions
    }
    
    // Use initial placeholder (square) until image loads
    const seed = image.id || image.path || image.filename
    return getInitialAspectRatio(seed)
  }, [image.dimensions, image.id, image.path, image.filename, detectedAspectRatio])

  const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    setLoaded(true)
    const img = e.currentTarget
    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
      const categorized = categorizeAspectRatio(img.naturalWidth, img.naturalHeight)
      setDetectedAspectRatio(categorized)
    }
  }, [])

  const handleClick = () => {
    if (isSelectionMode && onSelect) {
      onSelect()
    } else {
    // 모달로 이미지 표시 (페이지 이동 없이)
    onImageClick(image, folder)
    }
  }

  return (
    <div
      className="relative rounded-lg overflow-hidden cursor-pointer transition-all group mb-3"
      onClick={handleClick}
    >
      {/* Aspect ratio container to prevent layout shift */}
      <div 
        className="relative w-full"
        style={{ 
          paddingBottom: `${100 / aspectRatio}%`
        }}
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

        {/* View Count Badge or Lock Icon - top left */}
        {!isSelectionMode && viewContext && (
          (viewContext === 'strands' || (viewContext === 'cabinet' && image.is_public)) && viewCount !== undefined ? (
            <div 
              className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded-full flex items-center gap-1"
              style={getAdaptiveGlassStyleBlur()}
            >
              <Eye size={12} className="text-white/80" />
              <span className="text-[11px] text-white/80 font-medium">
                {formatViewCount(viewCount)}
              </span>
            </div>
          ) : viewContext === 'cabinet' && !image.is_public ? (
            <div 
              className="absolute top-2 left-2 z-10 p-1.5 rounded-full flex items-center justify-center"
              style={getAdaptiveGlassStyleBlur()}
            >
              <Lock size={14} className="text-white/70" />
            </div>
          ) : null
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

        {/* Skeleton placeholder - shows while image is loading */}
        {!loaded && !imageError && (
          <div className="absolute inset-0 bg-[var(--subtle-divider)] animate-pulse" />
        )}

        {!imageError ? (
          <img
            ref={imgRef}
            src={imageUrl}
            alt={typeof image.prompt === 'string' ? image.prompt : 'Generated image'}
            className={`absolute inset-0 w-full h-full object-cover transform transition-all duration-700 ease-out ${
              loaded ? 'opacity-100 scale-100' : 'opacity-0 scale-105'
            }`}
            style={{ border: 'none', outline: 'none' }}
            onLoad={handleImageLoad}
            onError={() => setImageError(true)}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[var(--muted)] bg-[var(--subtle-divider)]">
            Image not found
          </div>
        )}
      </div>
    </div>
  )
}


