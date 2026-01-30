'use client'

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { Lock, Loader2, Check, Layers, Eye, Heart } from 'lucide-react'
import { formatViewCount } from '../hooks/useViewCounts'
import { getAdaptiveGlassStyleBlur } from '@/app/lib/adaptiveGlassStyle'

export interface ProjectMetadata {
  id: string
  user_id: string
  name: string | null
  thumbnail_url: string | null
  thumbnail_path: string | null
  original_image_url?: string | null
  original_image_path?: string | null
  original_bucket_name?: string | null
  prompt: string | null
  ai_prompt: string | null
  ai_json_prompt?: any
  selected_model?: string
  slide_count: number
  is_public: boolean
  created_at: string
  updated_at: string
  view_count?: number // 조회수
  // 슬라이드 미리보기 (최대 3개)
  preview_slides?: Array<{
    id: string
    image_url: string
    slide_index: number
  }>
}

interface ProjectCardProps {
  project: ProjectMetadata
  onViewClick: (projectId: string) => void
  onTogglePublic?: (projectId: string, isPublic: boolean) => Promise<void>
  showVisibilityToggle?: boolean
  isSelectionMode?: boolean
  isSelected?: boolean
  onSelect?: () => void
  viewCount?: number
  viewContext?: 'strands' | 'cabinet'
  likeCount?: number
}

export default function ProjectCard({
  project,
  onViewClick,
  onTogglePublic,
  showVisibilityToggle = false,
  isSelectionMode = false,
  isSelected = false,
  onSelect,
  viewCount,
  viewContext,
  likeCount
}: ProjectCardProps) {
  const [imageError, setImageError] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [isTogglingPublic, setIsTogglingPublic] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [detectedAspectRatio, setDetectedAspectRatio] = useState<number | null>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  // thumbnail_url이 변경되면 imageError, loaded, aspect ratio 리셋
  useEffect(() => {
    setImageError(false)
    setImageLoaded(false)
    setDetectedAspectRatio(null)
  }, [project.thumbnail_url, project.original_image_url])

  // Categorize aspect ratio to portrait/square/landscape with appropriate display ratios
  const categorizeAspectRatio = useCallback((naturalWidth: number, naturalHeight: number): number => {
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
  }, [])

  // Generate aspect ratio from detected image dimensions or default to square
  const aspectRatio = useMemo(() => {
    if (detectedAspectRatio !== null) return detectedAspectRatio
    // Default to square until image loads
    return 1
  }, [detectedAspectRatio])

  const handleImageLoadWithRatio = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    setImageLoaded(true)
    const img = e.currentTarget
    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
      const categorized = categorizeAspectRatio(img.naturalWidth, img.naturalHeight)
      setDetectedAspectRatio(categorized)
    }
  }, [categorizeAspectRatio])

  const handleViewClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (isSelectionMode && onSelect) {
      onSelect()
    } else {
    onViewClick(project.id)
    }
  }, [onViewClick, project.id, isSelectionMode, onSelect])

  const handleTogglePublic = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!onTogglePublic || isTogglingPublic) return
    
    setIsTogglingPublic(true)
    try {
      await onTogglePublic(project.id, !project.is_public)
    } finally {
      setIsTogglingPublic(false)
    }
  }, [onTogglePublic, project.id, project.is_public, isTogglingPublic])

  const thumbnailUrl = useMemo(() => {
    if (imageError) return null
    return project.thumbnail_url || project.original_image_url
  }, [project.thumbnail_url, project.original_image_url, imageError])

  // Handle cached images: check if image is already complete on mount or URL change
  useEffect(() => {
    const img = imgRef.current
    if (img?.complete && img.naturalHeight > 0) {
      setImageLoaded(true)
      const categorized = categorizeAspectRatio(img.naturalWidth, img.naturalHeight)
      setDetectedAspectRatio(categorized)
    }
  }, [thumbnailUrl, categorizeAspectRatio])

  const slideCount = useMemo(() => {
    return project.slide_count || 1
  }, [project.slide_count])

  // 메모이제이션된 이벤트 핸들러
  const handleMouseEnter = useCallback(() => setIsHovered(true), [])
  const handleMouseLeave = useCallback(() => setIsHovered(false), [])

  const imageStyle = useMemo(() => ({
    transform: isHovered ? 'scale(1.02)' : 'scale(1)'
  }), [isHovered])

  return (
    <div
      className="relative mb-3 rounded-xl overflow-hidden cursor-pointer group transition-all duration-300"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleViewClick}
    >
      {/* 메인 슬라이드 (썸네일만 표시) */}
      <div 
        className="relative rounded-xl overflow-hidden transition-all duration-300"
      >
        {/* Aspect ratio container */}
        <div 
          className="relative w-full"
          style={{ paddingBottom: `${100 / aspectRatio}%` }}
        >
          {/* Skeleton placeholder */}
          {!imageLoaded && thumbnailUrl && !imageError && (
            <div className="absolute inset-0 bg-[var(--subtle-divider)] animate-pulse" />
          )}

          {/* 썸네일 이미지 */}
          {thumbnailUrl && !imageError ? (
            <img
              ref={imgRef}
              src={thumbnailUrl}
              alt={project.name || 'Project'}
              className={`absolute inset-0 w-full h-full object-cover transform transition-all duration-700 ease-out ${
                imageLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-105'
              }`}
              style={imageStyle}
              onLoad={handleImageLoadWithRatio}
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="absolute inset-0 bg-[var(--muted)] flex items-center justify-center">
              <span className="text-[var(--muted-foreground)] text-sm">No preview</span>
            </div>
          )}
        </div>

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

        {/* 슬라이드 수 배지 (우측 상단) - 1개일 때는 표시하지 않음 */}
        {slideCount > 1 && (
          <div 
            className="absolute top-2 right-2 z-10 flex items-center gap-1 px-1.5 py-1 rounded-full"
            style={getAdaptiveGlassStyleBlur()}
          >
            <span className="text-xs font-medium text-white/90">{slideCount}</span>
            <Layers size={12} className="text-white/90" />
          </div>
        )}

        {/* 좌측 상단 - View Count 또는 공개/비공개 상태 */}
        {!isSelectionMode && (
          viewContext ? (
            // viewContext가 있으면 조회수/잠금 아이콘 표시 (글로벌 아이콘 없음)
            (viewContext === 'strands' || (viewContext === 'cabinet' && project.is_public)) && viewCount !== undefined ? (
              <div 
                className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded-full flex items-center gap-1"
                style={getAdaptiveGlassStyleBlur()}
              >
                <Eye size={12} className="text-white/80" />
                <span className="text-[11px] text-white/80 font-medium">
                  {formatViewCount(viewCount)}
                </span>
              </div>
            ) : viewContext === 'cabinet' && !project.is_public ? (
              <div 
                className="absolute top-2 left-2 z-10 p-1.5 rounded-full flex items-center justify-center"
                style={getAdaptiveGlassStyleBlur()}
              >
                <Lock size={14} className="text-white/70" />
              </div>
            ) : null
          ) : showVisibilityToggle ? (
            // viewContext가 없고 showVisibilityToggle이 true면 잠금 아이콘만 표시 (글로벌 아이콘 없음)
            <button
              onClick={handleTogglePublic}
              disabled={isTogglingPublic}
              className="absolute top-2 left-2 z-10 p-1.5 rounded-full transition-all cursor-pointer disabled:opacity-50"
              style={getAdaptiveGlassStyleBlur()}
              title={project.is_public ? 'Public - Click to make private' : 'Private - Click to make public'}
            >
              {isTogglingPublic ? (
                <Loader2 size={14} className="text-white animate-spin" />
              ) : (
                <Lock size={14} className="text-white/70" />
              )}
            </button>
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
      </div>
    </div>
  )
}

