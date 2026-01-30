'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Check, X, Copy, Loader2, ScrollText, Globe, Lock, Menu, LogIn } from 'lucide-react'
import Link from 'next/link'
import { ProjectMetadata } from '../ProjectCard'
import ProjectViewerHeader from './ProjectViewerHeader'
import ProjectViewerActions from './ProjectViewerActions'
import ProjectViewerContent from './ProjectViewerContent'
import PensieveWaterBackground from '../PensieveWaterBackground'
import { ShareLinksModal, ShareItem } from '../ShareLinksModal'
import { getAdaptiveGlassStyleBlur, getIconClassName as getIconClassNameUtil, getTextStyle } from '@/app/lib/adaptiveGlassStyle'
import { useBackgroundImageBrightness } from '@/app/hooks/useBackgroundImageBrightness'
import { HumanPromptView } from '../UploadImageModal/ui/PromptRenderer'
import { JsonViewer } from '../UploadImageModal/ui/JsonViewer'
import { ImageMetadata } from '../UploadImageModal/types'
import { cleanInternalKeys } from '@/lib/utils'
import { copyPromptWithImages } from '../UploadImageModal/utils/richClipboard'
import { SocialActions } from '../SocialActions'
import { useSocialActions } from '../../hooks/useSocialActions'

// 프로젝트 슬라이드 타입
interface ProjectSlide {
  id: string
  slide_index: number
  parent_slide_id: string | null
  image_url: string
  image_path: string
  bucket_name: string
  url_expires_at: string | null
  prompt: string | null
  ai_prompt: string | null
  ai_json_prompt: any
  is_original: boolean
  created_at: string
}

interface ProjectViewerProps {
  project: ProjectMetadata
  slides: ProjectSlide[]
  isOpen: boolean
  onClose: () => void
  onEdit: (projectId: string, slideId?: string) => void
  onDelete?: (projectId: string) => Promise<void> | void
  onTogglePublic?: (projectId: string, isPublic: boolean) => Promise<void>
  onItemNext?: () => void
  onItemPrevious?: () => void
  user: any
  onProjectUpdate?: (updated: ProjectMetadata) => void
  initialSlideId?: string | null
  viewContext?: 'strands' | 'cabinet'
  onViewCountUpdate?: (targetId: string, newCount: number) => void
  onLikeCountUpdate?: (targetId: string, newCount: number) => void
}

export default function ProjectViewer({
  project,
  slides,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  onTogglePublic,
  onItemNext,
  onItemPrevious,
  user,
  onProjectUpdate,
  initialSlideId,
  viewContext = 'cabinet',
  onViewCountUpdate,
  onLikeCountUpdate
}: ProjectViewerProps) {
  const [isMounted, setIsMounted] = useState(false)
  const [copied, setCopied] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [showCopyButton, setShowCopyButton] = useState(false)
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null)
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null)
  const [promptType, setPromptType] = useState<'prompt' | 'ai_prompt' | 'ai_json_prompt'>('prompt')
  const [isOverlayVisible, setIsOverlayVisible] = useState(false)
  const [showMobileButtons, setShowMobileButtons] = useState(true)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [isTogglingPublic, setIsTogglingPublic] = useState(false)
  const [localIsPublic, setLocalIsPublic] = useState<boolean>(project?.is_public ?? false)
  const [viewingImageUrl, setViewingImageUrl] = useState<string | null>(null)
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0)
  const [isEditing, setIsEditing] = useState(false)
  const [isPromptGenerating, setIsPromptGenerating] = useState(false)
  const [promptError, setPromptError] = useState<string | null>(null)
  const [showGuestModal, setShowGuestModal] = useState(false)
  // 추출된 프롬프트를 슬라이드별로 임시 저장 (읽기 전용 뷰어에서는 DB에 저장하지 않음)
  const [extractedPrompts, setExtractedPrompts] = useState<Map<string, { ai_prompt: string, ai_json_prompt: any }>>(new Map())
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)
  const [shareItems, setShareItems] = useState<ShareItem[]>([])
  const [showInfoOverlay, setShowInfoOverlay] = useState(false)

  const promptOverlayRef = useRef<HTMLDivElement>(null)

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
  const isTouchDevice = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0)
  const isGuest = !user || user?.isAnonymous || user?.id === 'anonymous'
  const isOwner = user?.id === project.user_id

  // Social actions (likes/comments)
  const socialActions = useSocialActions({
    targetType: 'project',
    targetId: project?.id,
    isOpen,
    onViewCountUpdate,
    onLikeCountUpdate
  })

  // 슬라이드 정렬 (slide_index 기준)
  const sortedSlides = useMemo(() => {
    return [...slides].sort((a, b) => a.slide_index - b.slide_index)
  }, [slides])

  // 현재 슬라이드
  const currentSlide = sortedSlides[currentSlideIndex] || sortedSlides[0]

  // displayImageUrl 결정: 슬라이드가 있으면 슬라이드 이미지, 없으면 오리지널 이미지
  const displayImageUrl = useMemo(() => {
    if (currentSlide?.image_url) {
      return currentSlide.image_url
    }
    // 슬라이드가 없으면 오리지널 이미지 사용
    return project.original_image_url || ''
  }, [currentSlide, project.original_image_url])

  useEffect(() => {
    setIsMounted(true)
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      document.body.style.overflowX = 'hidden'
      document.documentElement.style.overflowX = 'hidden'
      setImageError(false)
      setIsOverlayVisible(false)
      setShowMobileButtons(true)
      setViewingImageUrl(null)
      
      // initialSlideId가 있으면 해당 슬라이드로 이동
      if (initialSlideId && sortedSlides.length > 0) {
        const slideIndex = sortedSlides.findIndex(s => s.id === initialSlideId)
        if (slideIndex >= 0) {
          setCurrentSlideIndex(slideIndex)
        } else {
          setCurrentSlideIndex(0)
        }
      } else {
        // initialSlideId가 없으면 마지막 슬라이드 표시 (썸네일과 일치)
        setCurrentSlideIndex(sortedSlides.length > 0 ? sortedSlides.length - 1 : 0)
      }
      
      setLocalIsPublic(project?.is_public ?? false)
    } else {
      document.body.style.overflow = ''
      document.body.style.overflowX = ''
      document.documentElement.style.overflowX = ''
    }
    return () => { 
      document.body.style.overflow = ''
      document.body.style.overflowX = ''
      document.documentElement.style.overflowX = ''
    }
  }, [isOpen, project?.is_public, initialSlideId, sortedSlides])

  const handleClose = () => onClose()

  const handleEdit = useCallback(async () => {
    if (isEditing) return
    if (isGuest) {
      setShowGuestModal(true)
      return
    }
    setIsEditing(true)
    try {
      // onEdit가 URL을 업데이트하므로, onClose를 호출하지 않음
      // onEdit 내부에서 뷰어를 닫도록 처리
      // 현재 보고 있는 슬라이드 ID를 전달
      await onEdit(project.id, currentSlide?.id)
      // onClose는 onEdit 내부에서 호출되므로 여기서는 호출하지 않음
    } catch (error) {
      console.error('Error opening project for edit:', error)
    } finally {
      setIsEditing(false)
    }
  }, [project.id, currentSlide?.id, onEdit, isEditing, isGuest])


  const handleDelete = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!onDelete || !project?.id) return
    if (!confirm('Are you sure you want to delete this project?')) return
    try {
      setIsDeleting(true)
      await onDelete(project.id)
      onClose()
    } catch (err) { 
      alert('Failed to delete project') 
    } finally { 
      setIsDeleting(false) 
    }
  }, [onDelete, project, onClose])

  // Delete handler for bottom bar (without event parameter)
  const handleDeleteFromBar = useCallback(async () => {
    if (!onDelete || !project?.id) return
    if (!confirm('Are you sure you want to delete this project?')) return
    try {
      setIsDeleting(true)
      await onDelete(project.id)
      onClose()
    } catch (err) { 
      alert('Failed to delete project') 
    } finally { 
      setIsDeleting(false) 
    }
  }, [onDelete, project, onClose])

  const handleSaveProject = useCallback(async () => {
    if (!project || isGuest || isSaving) return
    setIsSaving(true)
    try {
      // 프로젝트 생성 API 호출 (클론)
      const response = await fetch('/api/pensieve/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: project.name,
          originalImageUrl: project.original_image_url,
          originalImagePath: project.original_image_path,
          originalBucketName: project.original_bucket_name,
          prompt: project.prompt,
          aiPrompt: project.ai_prompt,
          aiJsonPrompt: project.ai_json_prompt,
          selectedModel: project.selected_model,
          isPublic: false, // 복사본은 기본적으로 비공개
          // 첫 번째 슬라이드 (원본) 포함
          firstSlide: sortedSlides[0] ? {
            imageUrl: sortedSlides[0].image_url,
            imagePath: sortedSlides[0].image_path,
            bucketName: sortedSlides[0].bucket_name,
            prompt: sortedSlides[0].prompt,
            aiPrompt: sortedSlides[0].ai_prompt,
            aiJsonPrompt: sortedSlides[0].ai_json_prompt
          } : null
        })
      })

      if (!response.ok) throw new Error('Failed to save project')
      
      setIsSaved(true)
      setTimeout(() => setIsSaved(false), 2000)
    } catch (err) {
      console.error('Error saving project:', err)
      alert('Failed to save project')
    } finally {
      setIsSaving(false)
    }
  }, [project, isGuest, isSaving, sortedSlides])

  // Share handler - opens share modal with project link
  const handleShare = useCallback(() => {
    if (!project?.id) return
    const baseUrl = window.location.origin
    const shareLink = `${baseUrl}/pensieve/projects/${project.id}`
    
    setShareItems([{
      id: project.id,
      title: project.name || 'Project',
      link: shareLink,
      type: 'project'
    }])
    setIsShareModalOpen(true)
  }, [project])

  // Info handler - shows project metadata overlay
  const handleInfo = useCallback(() => {
    setShowInfoOverlay(true)
  }, [])

  const handleTogglePublic = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!project?.id || isGuest || !onTogglePublic) return
    
    // Optimistic Update
    const nextValue = !localIsPublic
    setLocalIsPublic(nextValue)
    
    try {
      await onTogglePublic(project.id, nextValue)
      if (onProjectUpdate) {
        onProjectUpdate({ ...project, is_public: nextValue })
      }
    } catch (err) { 
      // Rollback on failure
      setLocalIsPublic(!nextValue)
      alert('Failed to toggle public status') 
    }
  }, [project, isGuest, localIsPublic, onTogglePublic, onProjectUpdate])

  const handleImageClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (!currentSlide) return
    const url = currentSlide.image_url
    if (viewingImageUrl) setViewingImageUrl(null); else if (url) setViewingImageUrl(url)
  }, [currentSlide, viewingImageUrl])

  const handleNextSlide = useCallback(() => {
    if (sortedSlides.length === 0) return
    // Circular navigation: wrap around to first slide if at the end
    setCurrentSlideIndex(prev => (prev + 1) % sortedSlides.length)
    setImageError(false)
  }, [sortedSlides.length])

  const handlePreviousSlide = useCallback(() => {
    if (sortedSlides.length === 0) return
    // Circular navigation: wrap around to last slide if at the beginning
    setCurrentSlideIndex(prev => (prev - 1 + sortedSlides.length) % sortedSlides.length)
    setImageError(false)
  }, [sortedSlides.length])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isTouchDevice || isOverlayVisible) return
    const touch = e.touches[0]
    setTouchStart({ x: touch.clientX, y: touch.clientY })
    setTouchEnd(null)
  }, [isTouchDevice, isOverlayVisible])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isTouchDevice || isOverlayVisible) return
    const touch = e.touches[0]
    setTouchEnd({ x: touch.clientX, y: touch.clientY })
  }, [isTouchDevice, isOverlayVisible])

  const handleTouchEnd = useCallback(() => {
    if (!isTouchDevice || !touchStart || !touchEnd || isOverlayVisible) return
    
    const deltaX = touchEnd.x - touchStart.x
    const deltaY = touchEnd.y - touchStart.y
    const minSwipeDistance = 50
    
    if (Math.abs(deltaX) > minSwipeDistance || Math.abs(deltaY) > minSwipeDistance) {
      // 위아래 스와이프: 항목 간 네비게이션 (프로젝트 간)
      if (Math.abs(deltaY) > Math.abs(deltaX)) {
        if (deltaY > 0 && onItemPrevious) {
          // 위로 스와이프: 이전 항목
          onItemPrevious()
        } else if (deltaY < 0 && onItemNext) {
          // 아래로 스와이프: 다음 항목
          onItemNext()
        }
      } else {
        // 좌우 스와이프: 슬라이드 간 네비게이션 (기존 동작)
        if (deltaX > 0) {
          handlePreviousSlide()
        } else {
          handleNextSlide()
        }
      }
    }
    
    setTouchStart(null)
    setTouchEnd(null)
  }, [isTouchDevice, touchStart, touchEnd, isOverlayVisible, handleNextSlide, handlePreviousSlide, onItemNext, onItemPrevious])

  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => { if (isOpen && !e.state?.isModal) onClose() }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [isOpen, onClose])

  // 슬라이드 변경 시 promptError 초기화
  useEffect(() => {
    setPromptError(null)
  }, [currentSlideIndex])

  const { isVeryBright } = useBackgroundImageBrightness(displayImageUrl)

  const availablePrompts = useMemo(() => ['prompt', 'ai_prompt', 'ai_json_prompt'] as const, [])
  const promptLabels = { prompt: 'Human Prompt', ai_prompt: 'AI Prompt', ai_json_prompt: 'AI JSON' }

  const currentPrompt = useMemo(() => {
    if (!currentSlide) return ''
    
    // 먼저 추출된 프롬프트 확인 (우선순위 1)
    const extracted = extractedPrompts.get(currentSlide.id)
    
    const value = (() => {
      if (promptType === 'prompt') return currentSlide.prompt || project.prompt || ''
      if (promptType === 'ai_prompt') return extracted?.ai_prompt || currentSlide.ai_prompt || project.ai_prompt || ''
      if (promptType === 'ai_json_prompt') return extracted?.ai_json_prompt || currentSlide.ai_json_prompt || project.ai_json_prompt || ''
      return ''
    })()
    if (!value) return ''
    if (promptType === 'ai_json_prompt') {
      const parsed = typeof value === 'string' ? JSON.parse(value) : value
      return JSON.stringify(cleanInternalKeys(parsed), null, 2)
    }
    return value
  }, [currentSlide, project, promptType, extractedPrompts])

  const jsonObject = useMemo(() => {
    if (!currentSlide) return null
    
    // 추출된 프롬프트 확인
    const extracted = extractedPrompts.get(currentSlide.id)
    
    if (promptType === 'prompt') {
      if (!project) return null
      const promptValue = currentSlide?.prompt || project?.prompt
      if (typeof promptValue === 'object' && promptValue !== null) return cleanInternalKeys(promptValue)
      if (typeof promptValue === 'string' && promptValue.trim()) {
        try {
          const parsed = JSON.parse(promptValue)
          if (typeof parsed === 'object' && parsed !== null) return cleanInternalKeys(parsed)
        } catch {}
      }
      return null
    }
    if (promptType !== 'ai_json_prompt') return null
    
    // ai_json_prompt: 추출된 것 우선, 없으면 기존 것 사용
    const value = extracted?.ai_json_prompt || currentSlide?.ai_json_prompt || project?.ai_json_prompt
    if (!value) return null
    try { 
      const parsed = typeof value === 'string' ? JSON.parse(value) : value 
      const cleaned = cleanInternalKeys(parsed)
      
      // If after cleaning it's an empty object, return null to show Generate button
      if (cleaned && typeof cleaned === 'object' && !Array.isArray(cleaned) && Object.keys(cleaned).length === 0) {
        return null
      }
      
      return cleaned
    } catch { return null }
  }, [currentSlide, project, promptType, extractedPrompts])

  const handleCopyPrompt = useCallback(async () => {
    if (!currentPrompt) return
    
    const promptText = typeof currentPrompt === 'string' ? currentPrompt : JSON.stringify(currentPrompt, null, 2)
    
    // Collect images to include in the copy
    const imagesToCopy: Array<{ order: number; url: string; path?: string; bucketName?: string }> = []
    
    // 편집된 슬라이드인 경우 부모 슬라이드 이미지 포함
    if (currentSlide && !currentSlide.is_original && currentSlide.parent_slide_id) {
      const parentSlide = sortedSlides.find(s => s.id === currentSlide.parent_slide_id)
      
      if (parentSlide?.image_url) {
        imagesToCopy.push({
          order: 1,
          url: parentSlide.image_url,
          path: parentSlide.image_path,
          bucketName: parentSlide.bucket_name
        })
      }
    }
    
    // ai_json_prompt에서 _inputImages 추출 (추가 참조 이미지가 있는 경우)
    if (currentSlide?.ai_json_prompt && typeof currentSlide.ai_json_prompt === 'object') {
      const inputImages = (currentSlide.ai_json_prompt as any)._inputImages
      if (Array.isArray(inputImages)) {
        inputImages.forEach((img: any) => {
          // 이미 추가된 이미지는 건너뜀 (order 1은 부모 이미지)
          if (img.order !== 1 || imagesToCopy.length === 0) {
            const existingOrder = imagesToCopy.find(i => i.order === img.order)
            if (!existingOrder && (img.originalUrl || img.blobUrl)) {
              imagesToCopy.push({
                order: img.order,
                url: img.originalUrl || img.blobUrl,
                path: img.path,
                bucketName: img.bucketName
              })
            }
          }
        })
      }
    }
    
    // 이미지가 있으면 rich clipboard 사용
    if (imagesToCopy.length > 0 && promptText.includes('[image')) {
      try {
        await copyPromptWithImages(promptText, imagesToCopy)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
        return
      } catch (err) {
        console.warn('Rich clipboard failed, falling back to plain text:', err)
      }
    }
    
    // 원본 슬라이드이거나 이미지가 없는 경우 plain text 복사
    navigator.clipboard.writeText(promptText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [currentSlide, sortedSlides, currentPrompt])

  const handleGeneratePrompt = useCallback(async () => {
    if (!currentSlide || isPromptGenerating) return
    if (isGuest) {
      setShowGuestModal(true)
      return
    }
    
    setIsPromptGenerating(true)
    setPromptError(null)
    
    try {
      const targetImageUrl = currentSlide.image_url
      
      if (!targetImageUrl) {
        throw new Error('No image URL available')
      }
      
      console.log('[ProjectViewer] Extracting prompt for slide:', currentSlide.id, targetImageUrl)
      
      const response = await fetch('/api/pensieve/extract-from-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: targetImageUrl })
      })
      
      if (!response.ok) {
        throw new Error('Failed to extract prompt')
      }
      
      const data = await response.json()
      
      // 추출된 프롬프트를 로컬 상태에 저장
      setExtractedPrompts(prev => {
        const next = new Map(prev)
        next.set(currentSlide.id, {
          ai_prompt: data.ai_prompt,
          ai_json_prompt: data.ai_json_prompt
        })
        return next
      })
      
      // 데이터베이스에 저장
      try {
        if (currentSlide.id && !currentSlide.id.startsWith('slide-')) {
          // 슬라이드 업데이트
          const slideResponse = await fetch(`/api/pensieve/projects/${project.id}/slides/${currentSlide.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ai_prompt: data.ai_prompt,
              ai_json_prompt: data.ai_json_prompt
            })
          })
          
          if (!slideResponse.ok) {
            console.error('[ProjectViewer] Failed to update slide:', await slideResponse.json().catch(() => ({})))
          } else {
            console.log('[ProjectViewer] Successfully updated slide in DB')
          }
        }
        
        // 원본 슬라이드인 경우 프로젝트도 업데이트
        if (currentSlide.is_original) {
          const projectResponse = await fetch(`/api/pensieve/projects/${project.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              aiPrompt: data.ai_prompt,
              aiJsonPrompt: data.ai_json_prompt
            })
          })
          
          if (!projectResponse.ok) {
            console.error('[ProjectViewer] Failed to update project:', await projectResponse.json().catch(() => ({})))
          } else {
            console.log('[ProjectViewer] Successfully updated project in DB')
          }
        }
      } catch (dbErr) {
        console.error('[ProjectViewer] Failed to persist extracted prompt:', dbErr)
      }
      
      console.log('[ProjectViewer] Prompt extracted successfully (stored locally and in DB)')
      
      // 생성 성공 후 AI 프롬프트 타입으로 전환하여 토글 표시
      setPromptType('ai_prompt')
    } catch (error) {
      console.error('[ProjectViewer] Failed to extract prompt:', error)
      setPromptError(error instanceof Error ? error.message : 'Failed to extract prompt')
    } finally {
      setIsPromptGenerating(false)
    }
  }, [currentSlide, isPromptGenerating])

  if (!isMounted || !isOpen || !project || sortedSlides.length === 0) return null

  const viewerContent = (
    <div 
      className="fixed inset-0 z-9999 flex items-center justify-center bg-black/80 backdrop-blur-sm" 
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <ProjectViewerHeader
        isOverlayVisible={isOverlayVisible}
        isMobile={isMobile}
        showMobileButtons={showMobileButtons}
        isGuest={isGuest}
        handleClose={handleClose}
        isPublic={localIsPublic}
        onTogglePublic={handleTogglePublic}
        isTogglingPublic={isTogglingPublic}
        viewCount={socialActions.viewCount}
        viewContext={viewContext}
        currentIndex={currentSlideIndex}
        totalSlides={sortedSlides.length}
      />

      <ProjectViewerContent
        displayImageUrl={displayImageUrl}
        imageError={imageError}
        handleImageClick={handleImageClick}
        handleTouchStart={handleTouchStart}
        handleTouchMove={handleTouchMove}
        handleTouchEnd={handleTouchEnd}
        setViewingImageId={() => {}}
        setViewingImageUrl={setViewingImageUrl}
        setImageError={setImageError}
        currentSlideIndex={currentSlideIndex}
        totalSlides={sortedSlides.length}
      />

      {/* Social Actions (Likes/Comments) */}
      {project?.id && !isOverlayVisible && (
        <SocialActions
          liked={socialActions.liked}
          likeCount={socialActions.likeCount}
          commentCount={socialActions.commentCount}
          comments={socialActions.comments}
          isLiking={socialActions.isLiking}
          isLoadingComments={socialActions.isLoadingComments}
          onToggleLike={socialActions.toggleLike}
          onFetchComments={socialActions.fetchComments}
          onAddComment={socialActions.addComment}
          onDeleteComment={socialActions.deleteComment}
          isGuest={isGuest}
          onShowGuestModal={() => setShowGuestModal(true)}
          currentUserId={user?.id}
        />
      )}

      <ProjectViewerActions
        isOverlayVisible={isOverlayVisible}
        isMobile={isMobile}
        showMobileButtons={showMobileButtons}
        showCopyButton={showCopyButton}
        copied={copied}
        availablePrompts={availablePrompts as any}
        handleCopyPrompt={handleCopyPrompt}
        setIsOverlayVisible={setIsOverlayVisible}
        setShowCopyButton={setShowCopyButton}
        onEdit={handleEdit}
        isEditing={isEditing}
        isGuest={isGuest}
        onShowGuestModal={() => setShowGuestModal(true)}
        onShare={handleShare}
        onDelete={isOwner && onDelete && !isGuest ? handleDeleteFromBar : undefined}
        onSave={!isOwner ? handleSaveProject : undefined}
        onInfo={handleInfo}
        isDeleting={isDeleting}
        isSaving={isSaving}
        isSaved={isSaved}
      />

      {/* Prompt Overlay */}
      {isOverlayVisible && (
        <div 
          ref={promptOverlayRef}
          className={`prompt-overlay fixed z-9999 text-white transition-opacity duration-300 ${isOverlayVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
          style={{
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100vw',
            minWidth: '100vw',
            height: '100vh',
            minHeight: '100vh',
            overflow: 'hidden'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsOverlayVisible(false)
              setShowCopyButton(false)
            }
          }}
        >
          {displayImageUrl && (
            <>
              {/* 검은색 배경 레이어 - 확실히 덮기 */}
              <div 
                className="absolute z-0"
                style={{
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  width: '100vw',
                  minWidth: '100vw',
                  height: '100vh',
                  minHeight: '100vh',
                  backgroundColor: 'rgba(0, 0, 0, 0.8)'
                }}
              />
              <div 
                className="absolute z-0 overflow-hidden"
                style={{
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  width: '100vw',
                  minWidth: '100vw',
                  height: '100vh',
                  minHeight: '100vh'
                }}
              >
                <img
                  src={displayImageUrl}
                  alt=""
                  className="absolute w-full h-full object-cover"
                  style={{
                    top: 0,
                    left: 0,
                    width: '100vw',
                    minWidth: '100vw',
                    height: '100vh',
                    minHeight: '100vh',
                    filter: 'brightness(0.3) blur(20px)',
                    transform: 'scale(1.1)',
                    objectPosition: 'center'
                  }}
                />
              </div>
            </>
          )}

          <div className="relative w-full h-full flex flex-col justify-center items-center text-center z-20 p-6">
            <button
              className="absolute top-4 right-4 z-30 w-10 h-10 rounded-full flex items-center justify-center cursor-pointer"
              style={{
                color: 'white',
                backgroundColor: '#007AFF',
                border: '1px solid #007AFF',
                boxShadow: '0 8px 40px rgba(0, 122, 255, 0.3), 0 4px 20px rgba(0, 122, 255, 0.2), 0 2px 8px rgba(0, 122, 255, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
              }}
              onClick={(e) => {
                e.stopPropagation()
                setIsOverlayVisible(false)
                setShowCopyButton(false)
              }}
            >
              <Check size={18} />
            </button>
            
            {/* Prompt type tabs */}
            <div className="flex flex-col items-center gap-4 mb-8">
              <span className="text-[10px] font-bold text-white/30 uppercase tracking-[0.3em] mb-1">Prompt</span>
              <div className="flex gap-1 p-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
                <button
                  className={`px-6 py-1.5 text-xs font-semibold rounded-full transition-all duration-200 cursor-pointer ${
                    promptType === 'prompt'
                      ? 'bg-white/15 text-white shadow-sm'
                      : 'text-white/40 hover:text-white/60'
                  }`}
                  onClick={(e) => {
                    e.stopPropagation()
                    setPromptType('prompt')
                  }}
                >
                  Human
                </button>
                <button
                  className={`px-6 py-1.5 text-xs font-semibold rounded-full transition-all duration-200 cursor-pointer ${
                    promptType !== 'prompt'
                      ? 'bg-white/15 text-white shadow-sm'
                      : 'text-white/40 hover:text-white/60'
                  }`}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (promptType === 'prompt') {
                      setPromptType('ai_prompt')
                    }
                  }}
                >
                  AI
                </button>
              </div>

              {/* AI Prompt Sub-toggle - Generate 버튼이 보일 때는 숨김 */}
              {promptType !== 'prompt' && ((promptType === 'ai_prompt' && currentPrompt) || (promptType === 'ai_json_prompt' && jsonObject)) && (
                <div className="flex items-center gap-3 animate-in fade-in slide-in-from-top-1 duration-300">
                  <span className={`text-[10px] uppercase tracking-wider font-bold transition-colors ${promptType === 'ai_prompt' ? 'text-white/80' : 'text-white/30'}`}>Text</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setPromptType(promptType === 'ai_prompt' ? 'ai_json_prompt' : 'ai_prompt')
                    }}
                    className="relative w-10 h-5 rounded-full bg-white/10 border border-white/10 transition-colors duration-200"
                  >
                    <div 
                      className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-all duration-200 shadow-sm ${
                        promptType === 'ai_json_prompt' ? 'left-[22px]' : 'left-0.5'
                      }`}
                    />
                  </button>
                  <span className={`text-[10px] uppercase tracking-wider font-bold transition-colors ${promptType === 'ai_json_prompt' ? 'text-white/80' : 'text-white/30'}`}>JSON</span>
                </div>
              )}
            </div>

            <div className="flex flex-col items-center w-full flex-1 min-h-0">
              <div className="w-full flex justify-center flex-1 min-h-0 overflow-hidden pt-10 sm:pt-28 pb-22 sm:pb-28">
                <div className="max-w-3xl w-full h-full overflow-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden px-2 flex items-start justify-center">
                  {promptType === 'prompt' && (
                    jsonObject ? (
                      <div className="text-base md:text-lg font-medium leading-relaxed text-white w-full text-left">
                        <JsonViewer data={jsonObject} />
                      </div>
                    ) : (
                      <div className="w-full bg-transparent font-normal text-left outline-none focus:outline-none ring-0 focus:ring-0 border-none no-underline transition-all duration-200" style={{ color: '#FFFFFF', fontSize: '1.125rem', lineHeight: '1.625', minHeight: '1.625em', padding: '2rem 0' }} onClick={(e) => e.stopPropagation()}>
                        {(() => {
                          // 부모 슬라이드 찾기
                          const parentSlide = currentSlide?.parent_slide_id 
                            ? sortedSlides.find(s => s.id === currentSlide.parent_slide_id)
                            : null
                          const parentIndex = parentSlide ? sortedSlides.findIndex(s => s.id === parentSlide.id) : -1
                          
                          // 원본 슬라이드인 경우
                          if (!currentSlide || currentSlide.is_original || !parentSlide) {
                            // ai_json_prompt._inputImages에서 이미지 메타데이터 추출
                            const images = (() => {
                              if (!currentSlide) return []
                              const aiJsonPrompt = currentSlide.ai_json_prompt
                              if (aiJsonPrompt && typeof aiJsonPrompt === 'object' && '_inputImages' in aiJsonPrompt) {
                                return (aiJsonPrompt as any)._inputImages
                              }
                              return []
                            })()
                            
                            return (
                              <HumanPromptView 
                                prompt={currentPrompt || ''} 
                                images={images}
                              />
                            )
                          }
                          
                          // 편집된 슬라이드인 경우 - 부모 슬라이드 이미지 표시
                          return (
                            <div className="w-full">
                              {/* 기반이 된 소스 슬라이드 이미지 */}
                              {parentSlide.image_url && (
                                <div className="relative w-full mb-4 group">
                                  <div className="relative w-full rounded-xl overflow-hidden">
                                    <img 
                                      src={parentSlide.image_url} 
                                      alt="Source"
                                      className="w-full h-auto block rounded-xl"
                                      style={{ boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)' }}
                                    />
                                  </div>
                                  
                                  {/* 슬라이드 이동 태그 */}
                                  {parentIndex !== -1 && (
                                    <button
                                      onClick={(e) => {
                                        e.preventDefault()
                                        e.stopPropagation()
                                        setCurrentSlideIndex(parentIndex)
                                      }}
                                      className="absolute top-3 left-3 px-2.5 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-white/90 text-[11px] font-semibold cursor-pointer z-30 flex items-center gap-1.5 hover:bg-black/80 transition-colors duration-200 shadow-xl group/tag"
                                    >
                                      <div className="flex items-center justify-center w-4 h-4 rounded-full bg-white/10 group-hover/tag:bg-white/20 transition-colors">
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                          <path d="M19 12H5M12 19l-7-7 7-7"/>
                                        </svg>
                                      </div>
                                      <span>Slide {parentIndex}</span>
                                    </button>
                                  )}
                                </div>
                              )}

                              {/* 편집 프롬프트 */}
                              <div className="w-full">
                                <HumanPromptView 
                                  prompt={currentPrompt || ''} 
                                  images={(() => {
                                    // ai_json_prompt._inputImages에서 이미지 메타데이터 추출
                                    const aiJsonPrompt = currentSlide.ai_json_prompt
                                    if (aiJsonPrompt && typeof aiJsonPrompt === 'object' && '_inputImages' in aiJsonPrompt) {
                                      return (aiJsonPrompt as any)._inputImages
                                    }
                                    return []
                                  })()}
                                />
                              </div>
                            </div>
                          )
                        })()}
                      </div>
                    )
                  )}

                  {promptType === 'ai_prompt' && currentPrompt && (
                    <p className="text-base md:text-lg font-medium leading-relaxed text-white whitespace-pre-wrap w-full text-center py-8">
                      {currentPrompt}
                    </p>
                  )}

                  {promptType === 'ai_json_prompt' && jsonObject && (
                    <div className="text-base md:text-lg font-medium leading-relaxed text-white w-full text-left">
                      <JsonViewer data={jsonObject} />
                    </div>
                  )}

                  {/* Generate button for AI Prompt when not available */}
                  {promptType === 'ai_prompt' && !currentPrompt && (
                    <div className="flex justify-center py-8">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleGeneratePrompt()
                        }}
                        disabled={isPromptGenerating}
                        className="px-8 py-3 md:px-10 md:py-3.5 rounded-full text-sm md:text-base font-semibold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        style={getAdaptiveGlassStyleBlur()}
                      >
                        {isPromptGenerating ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span>Analyzing...</span>
                          </>
                        ) : (
                          <>
                            <ScrollText size={20} />
                            <span>Generate</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Generate button for AI JSON when not available */}
                  {promptType === 'ai_json_prompt' && !jsonObject && (
                    <div className="flex justify-center py-8">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleGeneratePrompt()
                        }}
                        disabled={isPromptGenerating}
                        className="px-8 py-3 md:px-10 md:py-3.5 rounded-full text-sm md:text-base font-semibold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        style={getAdaptiveGlassStyleBlur()}
                      >
                        {isPromptGenerating ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span>Analyzing...</span>
                          </>
                        ) : (
                          <>
                            <ScrollText size={20} />
                            <span>Generate</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {currentPrompt && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2">
                {promptError && (
                  <div className="mb-1 px-3 py-1.5 rounded-full bg-red-500/80 text-xs text-white">
                    {promptError}
                  </div>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleCopyPrompt()
                  }}
                  className="px-4 py-2.5 rounded-full text-white transition-colors cursor-pointer flex items-center gap-2"
                  style={getAdaptiveGlassStyleBlur()}
                  aria-label="Copy"
                >
                  {copied ? <Check size={18} /> : <Copy size={18} />}
                  <span className="text-sm font-medium">{copied ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Navigation arrows */}
      {sortedSlides.length > 1 && !isOverlayVisible && (
        <>
          {currentSlideIndex > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                handlePreviousSlide()
              }}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-30 p-3 rounded-full text-white transition-colors cursor-pointer"
              style={getAdaptiveGlassStyleBlur()}
              aria-label="Previous slide"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
            </button>
          )}
          {currentSlideIndex < sortedSlides.length - 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleNextSlide()
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-30 p-3 rounded-full text-white transition-colors cursor-pointer"
              style={getAdaptiveGlassStyleBlur()}
              aria-label="Next slide"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
          )}
        </>
      )}
    </div>
  )

  const simpleImageViewer = isMounted && createPortal(
    <div 
      className={`fixed inset-0 z-100000 flex items-center justify-center cursor-pointer transition-opacity duration-200 ${
        viewingImageUrl ? 'opacity-100 pointer-events-auto bg-black/95' : 'opacity-0 pointer-events-none'
      }`}
      onClick={() => setViewingImageUrl(null)}
    >
      {viewingImageUrl && (
        <>
          <img src={viewingImageUrl} alt="" className="absolute inset-0 w-full h-full object-cover z-0" style={{ filter: 'brightness(0.3) blur(20px)', transform: 'scale(1.1)', objectPosition: 'center' }} aria-hidden="true" />
          <img src={viewingImageUrl} alt="Fullscreen view" className="relative z-10 w-full h-full object-contain" />
        </>
      )}
    </div>,
    document.body
  )

  // Guest Sign In Modal
  const guestModal = showGuestModal && isMounted && createPortal(
    <div 
      className="fixed inset-0 z-100001 flex items-center justify-center animate-in fade-in duration-200"
      onClick={() => setShowGuestModal(false)}
    >
      {/* Pensieve Water Background */}
      <div className="absolute inset-0 z-0">
        <PensieveWaterBackground />
      </div>
      
      {/* Close button */}
      <button
        onClick={() => setShowGuestModal(false)}
        className="absolute top-4 right-4 p-2 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer z-10"
        aria-label="Close"
      >
        <X size={24} />
      </button>
      
      <div 
        className="flex items-center justify-center w-full h-full pt-20 z-2 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-left max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500 px-8">
          <div className="relative mb-12">
            <span className="absolute -left-6 -top-8 text-7xl sm:text-8xl text-white/10 font-serif select-none">“</span>
            <div className="relative z-10">
              <h2 className="text-xl sm:text-2xl font-medium tracking-tight text-white/90 leading-relaxed italic mb-4">
                One simply siphons the excess thoughts from one’s mind, pours them into the basin, and examines them at one’s leisure.
              </h2>
              <div className="flex justify-end mt-6">
                <p className="text-[10px] font-medium text-white/30 uppercase tracking-[0.2em]">
                  — Albus Dumbledore
                </p>
              </div>
            </div>
          </div>
          <Link 
            href="/login"
            className="text-[#007AFF] hover:underline cursor-pointer text-base font-medium inline-flex items-center gap-2 transition-all active:scale-95 ml-1"
          >
            Sign in
            <LogIn size={16} />
          </Link>
        </div>
      </div>
    </div>,
    document.body
  )

  // Info overlay portal
  const infoOverlayPortal = showInfoOverlay && isMounted && createPortal(
    <div 
      className="fixed inset-0 z-100001 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={() => setShowInfoOverlay(false)}
    >
      <div 
        className="relative w-full max-w-md overflow-hidden rounded-[24px] shadow-2xl animate-in zoom-in-95 duration-200"
        style={{
          ...getAdaptiveGlassStyleBlur(),
          backgroundColor: 'rgba(23, 23, 23, 0.9)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Project Info</h3>
          <div className="space-y-3 text-sm">
            {/* {project?.name && (
              <div className="flex justify-between">
                <span className="text-white/60">Name</span>
                <span className="text-white truncate ml-4 max-w-[200px]">{project.name}</span>
              </div>
            )} */}
            {project?.created_at && (
              <div className="flex justify-between">
                <span className="text-white/60">Created</span>
                <span className="text-white">{new Date(project.created_at).toLocaleDateString()}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-white/60">Slides</span>
              <span className="text-white">{sortedSlides.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">Visibility</span>
              <span className="text-white">{viewContext === 'strands' ? 'Public' : (localIsPublic ? 'Public' : 'Private')}</span>
            </div>
            {currentSlide?.prompt && (
              <div className="flex justify-between">
                <span className="text-white/60">Has Prompt</span>
                <span className="text-white">Yes</span>
              </div>
            )}
          </div>
          <button
            onClick={() => setShowInfoOverlay(false)}
            className="w-full mt-6 py-3 bg-white/10 hover:bg-white/20 text-white font-medium rounded-xl transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  )

  const shareModalPortal = isShareModalOpen && isMounted && createPortal(
    <ShareLinksModal 
      isOpen={isShareModalOpen}
      onClose={() => setIsShareModalOpen(false)}
      items={shareItems}
    />,
    document.body
  )

  return (
    <>
      {createPortal(viewerContent, document.body)}
      {simpleImageViewer}
      {guestModal}
      {infoOverlayPortal}
      {shareModalPortal}
    </>
  )
}

