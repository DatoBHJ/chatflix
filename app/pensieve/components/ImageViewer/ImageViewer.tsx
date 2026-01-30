'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Check, RectangleHorizontal, X, Copy, Loader2, Save, Menu, Globe, Lock, ChevronLeft, ChevronRight } from 'lucide-react'
import { ImageMetadata } from '../ImageCard'
import ImageViewerHeader from './ImageViewerHeader'
import ImageViewerActions from './ImageViewerActions'
import ImageViewerContent from './ImageViewerContent'
import ImageViewerPromptOverlay from './ImageViewerPromptOverlay'
import { ShareLinksModal, ShareItem } from '../ShareLinksModal'
import { getAdaptiveGlassStyleBlur, getIconClassName as getIconClassNameUtil, getTextStyle } from '@/app/lib/adaptiveGlassStyle'
import { useBackgroundImageBrightness } from '@/app/hooks/useBackgroundImageBrightness'
import { usePensieve } from '../../context/PensieveContext'
import { createClient } from '@/utils/supabase/client'
import { cleanInternalKeys } from '@/lib/utils'
import { copyPromptWithImages } from '../UploadImageModal/utils/richClipboard'
import { SocialActions } from '../SocialActions'
import { useSocialActions } from '../../hooks/useSocialActions'

interface ImageViewerProps {
  image: ImageMetadata | null
  folder: string
  allImages: { image: ImageMetadata; folder: string }[]
  currentIndex: number
  isOpen: boolean
  onClose: () => void
  onNext: () => void
  onPrevious: () => void
  onItemNext?: () => void
  onItemPrevious?: () => void
  onCopyPrompt: (prompt: string) => void
  user: any
  onDelete?: (imageId: string) => Promise<void> | void
  onImageUpdate?: (updated: ImageMetadata) => void
  viewContext?: 'strands' | 'cabinet'
  onViewCountUpdate?: (targetId: string, newCount: number) => void
  onLikeCountUpdate?: (targetId: string, newCount: number) => void
}

export default function ImageViewer({
  image,
  folder,
  allImages,
  currentIndex,
  isOpen,
  onClose,
  onNext,
  onPrevious,
  onItemNext,
  onItemPrevious,
  onCopyPrompt,
  user,
  onDelete,
  onImageUpdate,
  viewContext,
  onViewCountUpdate,
  onLikeCountUpdate
}: ImageViewerProps) {
  const supabase = createClient()
  const [isMounted, setIsMounted] = useState(false)
  const [copied, setCopied] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [resolvedImageUrl, setResolvedImageUrl] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showCopyButton, setShowCopyButton] = useState(false)
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null)
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null)
  const [promptType, setPromptType] = useState<'prompt' | 'ai_prompt' | 'ai_json_prompt'>('prompt')
  const [isOverlayVisible, setIsOverlayVisible] = useState(false)
  const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(new Set())
  const [showSignInMessage, setShowSignInMessage] = useState(false)
  const [isTogglingPublic, setIsTogglingPublic] = useState(false)
  const [localIsPublic, setLocalIsPublic] = useState<boolean>(image?.is_public ?? false)
  const [showMobileButtons, setShowMobileButtons] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null)
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null)
  const [isPromptGenerating, setIsPromptGenerating] = useState(false)
  const [promptError, setPromptError] = useState<string | null>(null)
  const [viewingImageUrl, setViewingImageUrl] = useState<string | null>(null)
  const [showVisibilitySelector, setShowVisibilitySelector] = useState(false)
  const [isCreatingProject, setIsCreatingProject] = useState(false)
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)
  const [shareItems, setShareItems] = useState<ShareItem[]>([])
  const [showInfoOverlay, setShowInfoOverlay] = useState(false)
  const [copiedLinkIndex, setCopiedLinkIndex] = useState<number | null>(null)

  const promptOverlayRef = useRef<HTMLDivElement>(null)
  const signInMessageTimerRef = useRef<NodeJS.Timeout | null>(null)
  const saveMessageTimerRef = useRef<NodeJS.Timeout | null>(null)

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
  const isTouchDevice = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0)
  const isGuest = !user || user?.isAnonymous || user?.id === 'anonymous'
  const { openProjectForEdit, setIsUploadModalOpen } = usePensieve()

  // Social actions (likes/comments) - for all images with id
  const socialActions = useSocialActions({
    targetType: 'saved_image',
    targetId: image?.id,
    isOpen,
    onViewCountUpdate,
    onLikeCountUpdate
  })

  const toggleKey = useCallback((keyPath: string) => {
    setCollapsedKeys(prev => {
      const next = new Set(prev)
      if (next.has(keyPath)) next.delete(keyPath)
      else next.add(keyPath)
      return next
    })
  }, [])

  const renderJsonValue = useCallback((value: any, keyPath: string = '', depth: number = 0): React.ReactNode => {
    return JSON.stringify(value, null, 2)
  }, [])

  const availablePrompts = useMemo(() => ['prompt', 'ai_prompt', 'ai_json_prompt'] as const, [])
  const promptLabels = { prompt: 'Human Prompt', ai_prompt: 'AI Prompt', ai_json_prompt: 'AI JSON' }

  const currentPrompt = useMemo(() => {
    const value = (() => {
      if (promptType === 'prompt') return image?.prompt || ''
      if (promptType === 'ai_prompt') return image?.ai_prompt || ''
      if (promptType === 'ai_json_prompt') return image?.ai_json_prompt || ''
      return ''
    })()
    if (!value) return ''
    if (promptType === 'ai_json_prompt') {
      const parsed = typeof value === 'string' ? JSON.parse(value) : value
      return JSON.stringify(cleanInternalKeys(parsed), null, 2)
    }
    return value
  }, [image, promptType])

  const jsonObject = useMemo(() => {
    if (promptType === 'prompt') {
      if (!image) return null
      const promptValue = image.prompt
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
    if (!image) return null
    const value = image.ai_json_prompt
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
  }, [image, promptType])

  useEffect(() => {
    setIsMounted(true)
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      document.body.style.overflowX = 'hidden'
      document.documentElement.style.overflowX = 'hidden'
      setImageError(false)
      setShowCopyButton(false)
      setIsOverlayVisible(false)
      setShowMobileButtons(true)
      setViewingImageUrl(null)
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
  }, [isOpen])

  const handleClose = () => onClose()

  const createNewProjectFromImage = useCallback(async () => {
    if (!image || isCreatingProject) return
    if (isGuest) {
      alert('Please sign in to edit images.')
      return
    }
    
    setIsCreatingProject(true)
    try {
      const imageUrl = image.url || `${window.location.origin}/pensieve/${image.path}`
      const imagePath = image.path || ''
      const prompt = typeof image.prompt === 'string' ? image.prompt : (typeof image.prompt === 'object' && image.prompt !== null ? JSON.stringify(image.prompt) : '')
      
      // 이미지에서 bucket_name 추출 (path에서)
      let bucketName = 'generated-images'
      if (imagePath.includes('saved-gallery')) {
        bucketName = 'saved-gallery'
      } else if (imagePath.includes('pensieve_upload')) {
        bucketName = 'pensieve-upload'
      }

      // 프로젝트 생성
      const response = await fetch('/api/pensieve/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalImageUrl: imageUrl,
          originalImagePath: imagePath,
          originalBucketName: bucketName,
          prompt: prompt || null,
          aiPrompt: image.ai_prompt || null,
          aiJsonPrompt: image.ai_json_prompt || null,
          selectedModel: 'nano-banana-pro',
          isPublic: false, // 이미지 수정 시 생성되는 프로젝트는 기본적으로 비공개
          firstSlide: {
            imageUrl: imageUrl,
            imagePath: imagePath,
            bucketName: bucketName,
            prompt: prompt || null,
            aiPrompt: image.ai_prompt || null,
            aiJsonPrompt: image.ai_json_prompt || null
          }
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to create project')
      }

      const data = await response.json()
      if (!data.success || !data.project) {
        throw new Error('Failed to create project')
      }

      // 생성된 프로젝트로 편집 모달 열기
      await openProjectForEdit(data.project.id)
      
      // ImageViewer 닫기
      onClose()
    } catch (error) {
      console.error('Error creating project from image:', error)
      alert(error instanceof Error ? error.message : 'Failed to create project')
    } finally {
      setIsCreatingProject(false)
    }
  }, [image, isGuest, isCreatingProject, openProjectForEdit, onClose])

  const handleCopyPrompt = useCallback(async () => {
    if (!currentPrompt) return
    const textToCopy = typeof currentPrompt === 'string' ? currentPrompt : JSON.stringify(currentPrompt, null, 2)
    
    // Check if there are reference images in metadata
    const referenceImages = image?.metadata?.referenceImages as Array<{ order: number; originalUrl?: string; blobUrl?: string; path?: string; bucketName?: string }> | undefined
    
    if (referenceImages && referenceImages.length > 0 && textToCopy.includes('[image')) {
      try {
        const imagesToCopy = referenceImages.map(img => ({
          order: img.order,
          url: img.originalUrl || img.blobUrl || '',
          path: img.path,
          bucketName: img.bucketName
        })).filter(img => img.url)
        
        if (imagesToCopy.length > 0) {
          await copyPromptWithImages(textToCopy, imagesToCopy)
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
          return
        }
      } catch (err) {
        console.warn('Rich clipboard failed, falling back to plain text:', err)
      }
    }
    
    onCopyPrompt(textToCopy)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [currentPrompt, onCopyPrompt, image])

  const handleGeneratePrompt = useCallback(async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    if (!image || isPromptGenerating) return
    try {
      setIsPromptGenerating(true)
      setPromptError(null)
      let targetUrl = image.url
      if (!targetUrl && image.path) targetUrl = `${window.location.origin}/pensieve/${image.path}`
      if (!targetUrl) throw new Error('No URL')
      const res = await fetch('/api/pensieve/extract-from-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: targetUrl })
      })
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      
      // Update database with extracted prompt
      if (image.id) {
        try {
          if (folder === 'saved') {
            await fetch('/api/pensieve/update-image-metadata', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                imageId: image.id, 
                ai_prompt: data.ai_prompt, 
                ai_json_prompt: data.ai_json_prompt 
              })
            })
          } else if (image.metadata?.projectId) {
            const projectId = image.metadata.projectId
            const slideId = image.metadata.slideId
            
            if (slideId && !slideId.startsWith('slide-')) {
              // Update specific slide
              await fetch(`/api/pensieve/projects/${projectId}/slides/${slideId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  ai_prompt: data.ai_prompt, 
                  ai_json_prompt: data.ai_json_prompt 
                })
              })
            }
            
            // If it's the original slide, also update the project metadata
            if (image.metadata?.isOriginal) {
              await fetch(`/api/pensieve/projects/${projectId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  aiPrompt: data.ai_prompt, 
                  aiJsonPrompt: data.ai_json_prompt 
                })
              })
            }
          }
        } catch (dbErr) {
          console.error('Failed to persist extracted prompt:', dbErr)
        }
      }

      if (onImageUpdate) onImageUpdate({ ...image, ai_prompt: data.ai_prompt, ai_json_prompt: data.ai_json_prompt })
      
      // 생성 성공 후 AI 프롬프트 타입으로 전환하여 토글 표시
      setPromptType('ai_prompt')
    } catch (err: any) { setPromptError(err.message) } finally { setIsPromptGenerating(false) }
  }, [image, isPromptGenerating, onImageUpdate])

  const handleDelete = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!onDelete || !image?.id) return
    try {
      setIsDeleting(true)
      await onDelete(image.id)
      onClose()
    } catch (err) { alert('Failed') } finally { setIsDeleting(false) }
  }, [onDelete, image, onClose])

  const handleTogglePublic = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!image?.id) return
    if (isGuest) {
      alert('Please sign in to change visibility.')
      return
    }
    
    // Optimistic Update
    const nextValue = !localIsPublic
    setLocalIsPublic(nextValue)
    
    try {
      const res = await fetch('/api/pensieve/toggle-public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageId: image.id, isPublic: nextValue })
      })
      if (!res.ok) throw new Error('Failed')
      if (onImageUpdate) onImageUpdate({ ...image, is_public: nextValue })
    } catch (err) { 
      // Rollback on failure
      setLocalIsPublic(!nextValue)
      alert('Failed') 
    }
  }, [image, isGuest, localIsPublic, onImageUpdate])

  const handleSaveImage = useCallback(async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    if (!image) return
    if (isGuest) {
      alert('Please sign in to save images to your gallery.')
      return
    }
    setIsSaving(true)
    try {
      const imageUrl = image.url || `${window.location.origin}/pensieve/${image.path}`
      const res = await fetch('/api/photo/save-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl, prompt: image.prompt, ai_prompt: image.ai_prompt, ai_json_prompt: image.ai_json_prompt, appContext: 'pensieve' })
      })
      if (!res.ok) throw new Error('Failed')
      setIsSaved(true)
      setSaveSuccessMessage('Saved!')
      setTimeout(() => {
        setIsSaved(false)
        setSaveSuccessMessage(null)
      }, 2000)
    } catch (err: any) { setSaveErrorMessage(err.message) } finally { setIsSaving(false) }
  }, [image, isGuest])

  // Share handler - opens share modal with current image link
  const handleShare = useCallback(() => {
    if (!image) return
    const baseUrl = window.location.origin
    const shareLink = image.id 
      ? `${baseUrl}/pensieve/saved/${image.id}` 
      : (image.url || `${baseUrl}/pensieve/${image.path}`)
    
    setShareItems([{
      id: image.id || 'current-image',
      title: image.filename || 'Image',
      link: shareLink,
      type: 'image'
    }])
    setIsShareModalOpen(true)
  }, [image])

  // Info handler - shows image metadata overlay
  const handleInfo = useCallback(() => {
    setShowInfoOverlay(true)
  }, [])

  // Copy link to clipboard
  const handleCopyLink = useCallback(async (link: string, index: number, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(link)
      setCopiedLinkIndex(index)
      setTimeout(() => setCopiedLinkIndex(null), 2000)
    } catch (error) {
      console.error('Failed to copy link:', error)
    }
  }, [])

  // Open link in new tab
  const handleOpenLink = useCallback((link: string) => {
    window.open(link, '_blank', 'noopener,noreferrer')
  }, [])

  // Extract username from Twitter/X URL
  const extractUsernameFromLink = useCallback((link: string): string | null => {
    try {
      const url = new URL(link)
      const pathParts = url.pathname.split('/').filter(Boolean)
      // Twitter/X URL format: /username/status/tweetId or /username
      if (pathParts.length > 0) {
        return pathParts[0]
      }
    } catch (error) {
      // Invalid URL
    }
    return null
  }, [])

  // Get profile URL from Twitter/X link
  const getProfileUrl = useCallback((link: string): string | null => {
    const username = extractUsernameFromLink(link)
    if (!username) return null
    
    // Use x.com for profile links (modern Twitter)
    if (link.includes('x.com') || link.includes('twitter.com')) {
      return `https://x.com/${username}`
    }
    return null
  }, [extractUsernameFromLink])

  // Delete handler for bottom bar (without event parameter)
  const handleDeleteFromBar = useCallback(async () => {
    if (!onDelete || !image?.id) return
    try {
      setIsDeleting(true)
      await onDelete(image.id)
      onClose()
    } catch (err) { alert('Failed') } finally { setIsDeleting(false) }
  }, [onDelete, image, onClose])

  const handleImageClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (!image) return
    const url = image.url || `/pensieve/${image.path}`
    if (viewingImageUrl) setViewingImageUrl(null); else if (url) setViewingImageUrl(url)
  }, [image, viewingImageUrl])

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
      // 위아래 스와이프: 항목 간 네비게이션 (이미지/프로젝트 간)
      if (Math.abs(deltaY) > Math.abs(deltaX)) {
        if (deltaY > 0 && onItemPrevious) {
          // 위로 스와이프: 이전 항목
          onItemPrevious()
        } else if (deltaY < 0 && onItemNext) {
          // 아래로 스와이프: 다음 항목
          onItemNext()
        }
      } else {
        // 좌우 스와이프: 이미지 간 네비게이션 (기존 동작)
        if (deltaX > 0) {
          onPrevious()
        } else {
          onNext()
        }
      }
    }
    
    setTouchStart(null)
    setTouchEnd(null)
  }, [isTouchDevice, touchStart, touchEnd, isOverlayVisible, onNext, onPrevious, onItemNext, onItemPrevious])


  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => { if (isOpen && !e.state?.isModal) onClose() }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [isOpen, onClose])

  // 레퍼런스 이미지의 경우 Supabase Storage URL 생성
  useEffect(() => {
    const loadImageUrl = async () => {
      if (!image) {
        setResolvedImageUrl(null)
        return
      }

      // 이미 url이 있으면 그대로 사용
      if (image.url) {
        setResolvedImageUrl(image.url)
        return
      }

      // 레퍼런스 이미지인 경우 Supabase Storage URL 생성
      if (image.metadata?.isReferenceImage && image.path) {
        try {
          const { data: signedData, error } = await supabase.storage
            .from('saved-gallery')
            .createSignedUrl(image.path, 24 * 60 * 60)
          
          if (signedData?.signedUrl && !error) {
            setResolvedImageUrl(signedData.signedUrl)
            return
          }
        } catch (error) {
          console.warn('Failed to load reference image from Supabase Storage:', image.path, error)
        }

        // Fallback to originalUrl if available
        if (image.metadata?.originalUrl) {
          setResolvedImageUrl(image.metadata.originalUrl)
          return
        }
      }

      // 일반 이미지의 경우
      setResolvedImageUrl(image.path ? `/pensieve/${image.path}` : '')
    }

    loadImageUrl()
  }, [image, supabase])

  const imageUrlForMemo = resolvedImageUrl || image?.url || (image ? `/pensieve/${image.path}` : '')
  const displayImageUrl = imageUrlForMemo
  const { isVeryBright } = useBackgroundImageBrightness(displayImageUrl)
  const overlayBackgroundColor = isVeryBright ? 'rgba(0, 0, 0, 0.2)' : undefined

  if (!isMounted || !isOpen || !image) return null

  const viewerContent = (
    <div 
      className="fixed inset-0 z-9999 flex items-center justify-center bg-black/80 backdrop-blur-sm" 
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <ImageViewerHeader
        isOverlayVisible={isOverlayVisible}
        isMobile={isMobile}
        showMobileButtons={showMobileButtons}
        folder={folder}
        isGuest={isGuest}
        handleClose={handleClose}
        isPublic={localIsPublic}
        onTogglePublic={handleTogglePublic}
        isTogglingPublic={isTogglingPublic}
        viewCount={socialActions.viewCount}
        viewContext={viewContext}
        currentIndex={currentIndex}
        totalImages={allImages.length}
      />

      <ImageViewerContent
        displayImageUrl={displayImageUrl}
        imageError={imageError}
        handleImageClick={handleImageClick}
        handleTouchStart={handleTouchStart}
        handleTouchMove={handleTouchMove}
        handleTouchEnd={handleTouchEnd}
        setViewingImageId={() => {}}
        setViewingImageUrl={setViewingImageUrl}
        setImageError={setImageError}
      />

      {/* 좌우 네비게이션 버튼 (데스크톱) */}
      {!isMobile && allImages.length > 1 && (
        <>
          {/* 이전 버튼 */}
          {currentIndex > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onPrevious()
              }}
              className="fixed left-4 top-1/2 -translate-y-1/2 z-30 p-3 rounded-full text-white transition-all hover:scale-110 active:scale-95 cursor-pointer"
              style={getAdaptiveGlassStyleBlur()}
              aria-label="Previous image"
            >
              <ChevronLeft size={24} className={getIconClassNameUtil(true)} />
            </button>
          )}
          
          {/* 다음 버튼 */}
          {currentIndex < allImages.length - 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onNext()
              }}
              className="fixed right-4 top-1/2 -translate-y-1/2 z-30 p-3 rounded-full text-white transition-all hover:scale-110 active:scale-95 cursor-pointer"
              style={getAdaptiveGlassStyleBlur()}
              aria-label="Next image"
            >
              <ChevronRight size={24} className={getIconClassNameUtil(true)} />
            </button>
          )}
        </>
      )}

      {/* Social Actions (Likes/Comments) */}
      {image?.id && !isOverlayVisible && (
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
          currentUserId={user?.id}
        />
      )}

      <ImageViewerActions
        isOverlayVisible={isOverlayVisible}
        isMobile={isMobile}
        showMobileButtons={showMobileButtons}
        showCopyButton={showCopyButton}
        copied={copied}
        availablePrompts={availablePrompts as any}
        handleCopyPrompt={handleCopyPrompt}
        setIsOverlayVisible={setIsOverlayVisible}
        setShowCopyButton={setShowCopyButton}
        createNewProjectFromImage={createNewProjectFromImage}
        isCreatingProject={isCreatingProject}
        folder={folder}
        image={image}
        onShare={handleShare}
        onSave={() => handleSaveImage()}
        onDelete={folder === 'saved' && onDelete ? handleDeleteFromBar : undefined}
        onInfo={handleInfo}
        isSaving={isSaving}
        isSaved={isSaved}
        isDeleting={isDeleting}
        isGuest={isGuest}
      />

      <ImageViewerPromptOverlay
        isOverlayVisible={isOverlayVisible}
        setIsOverlayVisible={setIsOverlayVisible}
        setShowCopyButton={setShowCopyButton}
        setPromptError={setPromptError}
        setIsPromptGenerating={setIsPromptGenerating}
        displayImageUrl={displayImageUrl}
        imageUrl={imageUrlForMemo}
        image={image}
        availablePrompts={availablePrompts as any}
        promptType={promptType}
        setPromptType={setPromptType}
        promptLabels={promptLabels}
        jsonObject={jsonObject}
        currentPrompt={currentPrompt}
        renderJsonValue={renderJsonValue}
        isPromptGenerating={isPromptGenerating}
        handleGeneratePrompt={handleGeneratePrompt}
        promptError={promptError}
        handleCopyPrompt={handleCopyPrompt}
        copied={copied}
        promptOverlayRef={promptOverlayRef}
      />
        </div>
  )

  const simpleImageViewer = viewingImageUrl && isMounted && createPortal(
    <div className="fixed inset-0 z-100000 bg-black/95 flex items-center justify-center cursor-pointer" onClick={() => setViewingImageUrl(null)}>
      <img src={viewingImageUrl} alt="" className="absolute inset-0 w-full h-full object-cover z-0" style={{ filter: 'brightness(0.3) blur(20px)', transform: 'scale(1.1)', objectPosition: 'center' }} aria-hidden="true" />
      <img src={viewingImageUrl} alt="Fullscreen view" className="relative z-10 w-full h-full object-contain" />
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
          <h3 className="text-lg font-semibold text-white mb-4">Image Info</h3>
          <div className="space-y-3 text-sm">
            {/* {image?.filename && (
              <div className="flex justify-between">
                <span className="text-white/60">Filename</span>
                <span className="text-white truncate ml-4 max-w-[200px]">{image.filename}</span>
              </div>
            )} */}
            {image?.createdDate && (
              <div className="flex justify-between">
                <span className="text-white/60">Created</span>
                <span className="text-white">{new Date(image.createdDate).toLocaleDateString()}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-white/60">Visibility</span>
              <span className="text-white">{folder === 'saved' ? (localIsPublic ? 'Public' : 'Private') : 'Public'}</span>
            </div>
            {image?.prompt && (
              <div className="flex justify-between">
                <span className="text-white/60">Has Prompt</span>
                <span className="text-white">Yes</span>
              </div>
            )}

            {/* Creator */}
            {image?.links && image.links.length > 0 && (() => {
              // Get unique usernames from all links
              const creators = image.links
                .map(link => {
                  const username = extractUsernameFromLink(link)
                  const profileUrl = getProfileUrl(link)
                  return username && profileUrl ? { username, profileUrl } : null
                })
                .filter((creator): creator is { username: string; profileUrl: string } => creator !== null)
                .filter((creator, index, self) => 
                  index === self.findIndex(c => c.username === creator.username)
                ) // Remove duplicates

              if (creators.length === 0) return null

              return (
                <>
                  <div className="border-t border-white/10 my-3"></div>
                  <div className="space-y-2">
                    {creators.map((creator, index) => (
                      <div key={index} className="flex justify-between">
                        <span className="text-white/60">Creator</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleOpenLink(creator.profileUrl)
                          }}
                          className="text-blue-400 hover:text-blue-300 text-sm transition-colors underline"
                          title={`View @${creator.username}'s profile`}
                        >
                          {creator.username}
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )
            })()}

            {/* Source */}
            {image?.links && image.links.length > 0 && (
              <>
                <div className="border-t border-white/10 my-3"></div>
                <div className="space-y-2">
                  {image.links.map((link, index) => (
                    <div key={index} className="flex justify-between">
                      <span className="text-white/60">Source</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleOpenLink(link)
                        }}
                        className="text-blue-400 hover:text-blue-300 text-sm truncate max-w-[200px] transition-colors underline"
                        title={link}
                      >
                        {link}
                      </button>
                    </div>
                  ))}
                </div>
              </>
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
      {infoOverlayPortal}
      {shareModalPortal}
    </>
  )
}
