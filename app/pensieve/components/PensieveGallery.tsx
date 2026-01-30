'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import Masonry from 'react-masonry-css'
import ImageCard, { ImageMetadata } from './ImageCard'
import ImageViewer from './ImageViewer'
import MultiImageCard from './MultiImageCard'
import ImagePreviewModal from './ImagePreviewModal'
import ProjectCard, { ProjectMetadata } from './ProjectCard'
import ProjectViewer from './ProjectViewer/ProjectViewer'
import { generateImageSlugSync } from '../utils/imageSlug'
import { useGalleryImages } from '../hooks/useGalleryImages'
import { usePensieve } from '../context/PensieveContext'
import { createClient } from '@/utils/supabase/client'
import { usePensieveSelection } from '../context/PensieveSelectionContext'
import PensieveActionButtons from './PensieveActionButtons'
import { ShareLinksModal, ShareItem } from './ShareLinksModal'
import { useViewCounts } from '../hooks/useViewCounts'
import { useLikeCounts } from '../hooks/useLikeCounts'
import { useCommentCounts } from '../hooks/useCommentCounts'
import { calculateEngagementScore, calculateTimeFreshnessBonus, getItemRandomValue } from '../utils/engagementScore'

type ImageItem = 
  | { type: 'single', image: ImageMetadata, folder: string }
  | { type: 'group', images: ImageMetadata[], folder: string, id: string }
  | { type: 'project', project: ProjectMetadata }

interface PensieveGalleryProps {
  onCopyPrompt: (prompt: string) => void
  user: any
  searchQuery: string
  refreshToken?: number
  lastUploaded?: any
  showPublicOnly?: boolean
}

const INITIAL_LOAD_COUNT = 36
const LOAD_MORE_COUNT = 36

export default function PensieveGallery({ 
  onCopyPrompt, 
  user, 
  searchQuery,
  refreshToken = 0,
  lastUploaded,
  showPublicOnly = false
}: PensieveGalleryProps) {
  // Use custom hook for data fetching
  const { metadata, projects, isLoading, handleImageUpdate: updateMetadata, handleProjectTogglePublic } = useGalleryImages({
    showPublicOnly,
    refreshToken,
    lastUploaded
  })

  const { openProjectForEdit, isUploadModalOpen } = usePensieve()
  const { 
    isSelectionMode, 
    selectedImageIds, 
    selectedProjectIds, 
    selectedGroupIds,
    handleSelectImage, 
    handleSelectProject, 
    handleSelectGroup,
    clearSelection 
  } = usePensieveSelection()

  const [viewerImage, setViewerImage] = useState<{ image: ImageMetadata; folder: string } | null>(null)
  const [viewerIndex, setViewerIndex] = useState(0)
  const [isViewerOpen, setIsViewerOpen] = useState(false)
  const [previewImages, setPreviewImages] = useState<ImageMetadata[] | null>(null)
  const [previewFolder, setPreviewFolder] = useState<string>('')
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [viewerProject, setViewerProject] = useState<{ project: ProjectMetadata; slides: any[] } | null>(null)
  const [isProjectViewerOpen, setIsProjectViewerOpen] = useState(false)
  const [projectViewerSlideId, setProjectViewerSlideId] = useState<string | null>(null)
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)
  const [shareItems, setShareItems] = useState<ShareItem[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [currentItemIndex, setCurrentItemIndex] = useState<number>(-1)
  
  // Pagination / Infinite Scroll State
  const [visibleCount, setVisibleCount] = useState(INITIAL_LOAD_COUNT)
  const loadMoreRef = useRef<HTMLDivElement>(null)

  const isGuest = !user || user?.isAnonymous || user?.id === 'anonymous'
  
  // URL 변경 함수 (history.pushState 사용)
  const updateUrlForImage = useCallback((image: ImageMetadata) => {
    try {
      const slug = generateImageSlugSync(image)
      const newUrl = `/pensieve/${slug}`
      window.history.pushState({ imageSlug: slug, isModal: true }, '', newUrl)
    } catch (error) {
      console.error('Error updating URL:', error)
    }
  }, [])

  // URL 복원 함수
  const restoreOriginalUrl = useCallback(() => {
    // history.back()을 사용하면 pushState로 추가한 항목을 제거
    if (window.history.state?.isModal) {
      window.history.back()
    }
  }, [])

  // 프로젝트 뷰어 URL 복원 함수
  const restoreProjectViewerUrl = useCallback(() => {
    if (window.history.state?.isModal && window.history.state?.projectId) {
      window.history.back()
    }
  }, [])

  // 프로젝트 뷰어 열기 리스너
  useEffect(() => {
    const channel = new BroadcastChannel('pensieve-open-project')
    channel.onmessage = (event) => {
      if (event.data.type === 'open-project') {
        const { project, slides, slideId } = event.data
        setViewerProject({ project, slides: slides || [] })
        setProjectViewerSlideId(slideId || null)
        setIsProjectViewerOpen(true)
        
        // URL 업데이트
        const projectUrl = `/pensieve/projects/${project.id}`
        window.history.pushState({ projectId: project.id, isModal: true }, '', projectUrl)
      }
    }
    return () => channel.close()
  }, [])

  // popstate 이벤트 핸들러 (브라우저 뒤로가기)
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      // 모달이 열려있고, 뒤로가기를 눌렀을 때
      if (isViewerOpen && !event.state?.isModal) {
        setIsViewerOpen(false)
        setViewerImage(null)
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [isViewerOpen])

  // Collect all item IDs before creating allItems (for engagement data fetching)
  const allImageIds = useMemo(() => {
    const ids: string[] = []
    Object.entries(metadata).forEach(([folder, imageList]) => {
      imageList.forEach((image) => {
        if (image.id) {
          ids.push(image.id)
        }
      })
    })
    return ids
  }, [metadata])

  const allProjectIds = useMemo(() => {
    if (!showPublicOnly) return []
    return projects.map(project => project.id)
  }, [projects, showPublicOnly])

  // Fetch engagement data for all items (before sorting)
  const { getViewCount: getAllImageViewCount } = useViewCounts({ 
    targetType: 'saved_image', 
    targetIds: allImageIds 
  })
  const { getViewCount: getAllProjectViewCount } = useViewCounts({ 
    targetType: 'project', 
    targetIds: allProjectIds 
  })
  const { getLikeCount: getAllImageLikeCount } = useLikeCounts({ 
    targetType: 'saved_image', 
    targetIds: allImageIds 
  })
  const { getLikeCount: getAllProjectLikeCount } = useLikeCounts({ 
    targetType: 'project', 
    targetIds: allProjectIds 
  })
  const { getCommentCount: getAllImageCommentCount } = useCommentCounts({ 
    targetType: 'saved_image', 
    targetIds: allImageIds 
  })
  const { getCommentCount: getAllProjectCommentCount } = useCommentCounts({ 
    targetType: 'project', 
    targetIds: allProjectIds 
  })

  // Helper function to calculate item score
  const calculateItemScore = useCallback((item: ImageItem): { engagement: number; timeFreshness: number } => {
    let itemId: string | undefined
    let createdDate: string | undefined
    let getViewCount: (id: string) => number
    let getLikeCount: (id: string) => number
    let getCommentCount: (id: string) => number

    if (item.type === 'single') {
      itemId = item.image.id
      createdDate = item.image.createdDate
      getViewCount = getAllImageViewCount
      getLikeCount = getAllImageLikeCount
      getCommentCount = getAllImageCommentCount
    } else if (item.type === 'group') {
      // For groups, use the first image's ID
      itemId = item.images[0]?.id
      createdDate = item.images[0]?.createdDate
      getViewCount = getAllImageViewCount
      getLikeCount = getAllImageLikeCount
      getCommentCount = getAllImageCommentCount
    } else {
      itemId = item.project.id
      createdDate = item.project.created_at
      getViewCount = getAllProjectViewCount
      getLikeCount = getAllProjectLikeCount
      getCommentCount = getAllProjectCommentCount
    }

    if (!itemId || !createdDate) {
      return { engagement: 0, timeFreshness: 0 }
    }

    const views = getViewCount(itemId) || 0
    const likes = getLikeCount(itemId) || 0
    const comments = getCommentCount(itemId) || 0

    const engagement = calculateEngagementScore(likes, views, comments)
    const timeFreshness = calculateTimeFreshnessBonus(createdDate)

    return { engagement, timeFreshness }
  }, [getAllImageViewCount, getAllProjectViewCount, getAllImageLikeCount, getAllProjectLikeCount, getAllImageCommentCount, getAllProjectCommentCount])

  // Flatten all images with folder info and group by id, include projects
  const allItems = useMemo(() => {
    const images: { image: ImageMetadata; folder: string }[] = []
    Object.entries(metadata).forEach(([folder, imageList]) => {
      imageList.forEach((image) => {
        images.push({ image, folder })
      })
    })
    const getTimestamp = (value: string | undefined) => {
      if (!value) return 0
      const ts = new Date(value).getTime()
      return Number.isNaN(ts) ? 0 : ts
    }
    const sorted = images
      .slice()
      .sort((a, b) => getTimestamp(b.image.createdDate) - getTimestamp(a.image.createdDate))

    // Group images by id (only if id exists and multiple images share the same id)
    const grouped = new Map<string, { image: ImageMetadata; folder: string }[]>()
    const singles: { image: ImageMetadata; folder: string }[] = []
    const seenPaths = new Set<string>() // 중복 path 추적

    sorted.forEach((item) => {
      // 같은 path를 가진 이미지는 중복이므로 제외
      if (seenPaths.has(item.image.path)) {
        return
      }
      seenPaths.add(item.image.path)

      if (item.image.id) {
        if (!grouped.has(item.image.id)) {
          grouped.set(item.image.id, [])
        }
        grouped.get(item.image.id)!.push(item)
      } else {
        singles.push(item)
      }
    })

    // Convert to ImageItem array
    const result: ImageItem[] = []
    
    // Add grouped items (only if more than 1 image)
    grouped.forEach((items, id) => {
      if (items.length > 1) {
        result.push({
          type: 'group',
          images: items.map(i => i.image),
          folder: items[0].folder, // Use first item's folder
          id: id
        })
      } else {
        // Single image with id, treat as single
        singles.push(items[0])
      }
    })

    // Add single images
    singles.forEach((item) => {
      result.push({
        type: 'single',
        image: item.image,
        folder: item.folder
      })
    })

    // Add projects (only for showPublicOnly mode - Strands 탭)
    if (showPublicOnly && projects.length > 0) {
      projects.forEach((project) => {
        result.push({
          type: 'project',
          project
        })
      })
    }

    // Sort by hybrid score: engagement 20% + time freshness 50% + random 30%
    // 랜덤 비중을 높여서 새로고침할 때마다 충분히 다른 순서가 되도록 함
    result.sort((a, b) => {
      const scoreA = calculateItemScore(a)
      const scoreB = calculateItemScore(b)
      
      // 아이템 ID 가져오기 (랜덤 값 생성용)
      let itemIdA: string | undefined
      let itemIdB: string | undefined
      
      if (a.type === 'single') itemIdA = a.image.id
      else if (a.type === 'group') itemIdA = a.images[0]?.id || a.id
      else itemIdA = a.project.id
      
      if (b.type === 'single') itemIdB = b.image.id
      else if (b.type === 'group') itemIdB = b.images[0]?.id || b.id
      else itemIdB = b.project.id
      
      // 각 아이템마다 랜덤 값 생성 (새로고침 시 변경됨)
      const randomA = itemIdA ? getItemRandomValue(itemIdA) : Math.random()
      const randomB = itemIdB ? getItemRandomValue(itemIdB) : Math.random()
      
      // 하이브리드 스코어 계산: engagement 20% + timeFreshness 50% + random 30%
      const finalScoreA = scoreA.engagement * 0.2 + scoreA.timeFreshness * 0.5 + randomA * 0.3
      const finalScoreB = scoreB.engagement * 0.2 + scoreB.timeFreshness * 0.5 + randomB * 0.3
      
      return finalScoreB - finalScoreA
    })

    return result
  }, [metadata, projects, showPublicOnly, calculateItemScore])

  // Filter images and projects
  const filteredItems = useMemo(() => {
    let filtered = allItems

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter((item) => {
        if (item.type === 'single') {
          // Check prompt: if string, search in it; if object, stringify and search
          const promptText = typeof item.image.prompt === 'string' 
            ? item.image.prompt
            : typeof item.image.prompt === 'object' && item.image.prompt !== null
            ? JSON.stringify(item.image.prompt).toLowerCase()
            : ''
          const promptMatch = promptText.toLowerCase().includes(query)
          const keywordMatch = item.image.keywords?.some((k) => typeof k === 'string' && k.toLowerCase().includes(query))
          
          // For pensieve_curated images, also search in additional fields
          const pensieveCuratedQueriesMatch = item.image.pensieve_curated_queries?.some((q) => q.toLowerCase().includes(query))
          const pensieveCuratedStrategiesMatch = item.image.pensieve_curated_strategies?.some((s) => s.toLowerCase().includes(query))
          const pensieveCuratedAuthorsMatch = item.image.pensieve_curated_authors?.some((a) => a.toLowerCase().includes(query))
          const pensieveCuratedTweetIdsMatch = item.image.pensieve_curated_tweetIds?.some((t) => t.toLowerCase().includes(query))
          // 하위 호환성
          const xSearchQueriesMatch = item.image.x_search_queries?.some((q) => q.toLowerCase().includes(query))
          const xSearchStrategiesMatch = item.image.x_search_strategies?.some((s) => s.toLowerCase().includes(query))
          const xSearchAuthorsMatch = item.image.x_search_authors?.some((a) => a.toLowerCase().includes(query))
          const xSearchTweetIdsMatch = item.image.x_search_tweetIds?.some((t) => t.toLowerCase().includes(query))
          const linksMatch = item.image.links?.some((l) => l.toLowerCase().includes(query))
          
          return promptMatch || keywordMatch || 
            pensieveCuratedQueriesMatch || pensieveCuratedStrategiesMatch || pensieveCuratedAuthorsMatch || pensieveCuratedTweetIdsMatch ||
            xSearchQueriesMatch || xSearchStrategiesMatch || xSearchAuthorsMatch || xSearchTweetIdsMatch || 
            linksMatch
        } else if (item.type === 'group') {
          // For groups, check if any image matches
          return item.images.some((image) => {
            const promptText = typeof image.prompt === 'string' 
              ? image.prompt
              : typeof image.prompt === 'object' && image.prompt !== null
              ? JSON.stringify(image.prompt).toLowerCase()
              : ''
            const promptMatch = promptText.toLowerCase().includes(query)
            const keywordMatch = image.keywords?.some((k) => typeof k === 'string' && k.toLowerCase().includes(query))
            
            // For pensieve_curated images, also search in additional fields
            const pensieveCuratedQueriesMatch = image.pensieve_curated_queries?.some((q) => q.toLowerCase().includes(query))
            const pensieveCuratedStrategiesMatch = image.pensieve_curated_strategies?.some((s) => s.toLowerCase().includes(query))
            const pensieveCuratedAuthorsMatch = image.pensieve_curated_authors?.some((a) => a.toLowerCase().includes(query))
            const pensieveCuratedTweetIdsMatch = image.pensieve_curated_tweetIds?.some((t) => t.toLowerCase().includes(query))
            // 하위 호환성
            const xSearchQueriesMatch = image.x_search_queries?.some((q) => q.toLowerCase().includes(query))
            const xSearchStrategiesMatch = image.x_search_strategies?.some((s) => s.toLowerCase().includes(query))
            const xSearchAuthorsMatch = image.x_search_authors?.some((a) => a.toLowerCase().includes(query))
            const xSearchTweetIdsMatch = image.x_search_tweetIds?.some((t) => t.toLowerCase().includes(query))
            const linksMatch = image.links?.some((l) => l.toLowerCase().includes(query))
            
            return promptMatch || keywordMatch || 
              pensieveCuratedQueriesMatch || pensieveCuratedStrategiesMatch || pensieveCuratedAuthorsMatch || pensieveCuratedTweetIdsMatch ||
              xSearchQueriesMatch || xSearchStrategiesMatch || xSearchAuthorsMatch || xSearchTweetIdsMatch || 
              linksMatch
          })
        } else {
          // Project search
          const nameMatch = item.project.name?.toLowerCase().includes(query) || false
          const promptMatch = item.project.prompt?.toLowerCase().includes(query) || false
          return nameMatch || promptMatch
        }
      })
    }

    return filtered
  }, [allItems, searchQuery])

  // Reset pagination when filter changes
  useEffect(() => {
    setVisibleCount(INITIAL_LOAD_COUNT)
  }, [searchQuery, metadata, projects])

  // Infinite Scroll Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => prev + LOAD_MORE_COUNT)
        }
      },
      { 
        rootMargin: '200px',
        threshold: 0.1
      }
    )

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current)
    }

    return () => {
      observer.disconnect()
    }
  }, [filteredItems.length])

  // Memoize visible items
  const visibleItems = useMemo(() => {
    return filteredItems.slice(0, visibleCount)
  }, [filteredItems, visibleCount])

  // Collect IDs for batch view count fetching
  const imageIds = useMemo(() => {
    const ids: string[] = []
    visibleItems.forEach(item => {
      if (item.type === 'single' && item.image.id) {
        ids.push(item.image.id)
      } else if (item.type === 'group') {
        item.images.forEach(img => {
          if (img.id) ids.push(img.id)
        })
      }
    })
    return ids
  }, [visibleItems])

  const projectIds = useMemo(() => {
    return visibleItems
      .filter(item => item.type === 'project')
      .map(item => (item as { type: 'project', project: ProjectMetadata }).project.id)
  }, [visibleItems])

  // Fetch view counts in batches
  const { getViewCount: getImageViewCount, updateViewCount: updateImageViewCount } = useViewCounts({ 
    targetType: 'saved_image', 
    targetIds: imageIds 
  })
  const { getViewCount: getProjectViewCount, updateViewCount: updateProjectViewCount } = useViewCounts({ 
    targetType: 'project', 
    targetIds: projectIds 
  })

  // Fetch like counts in batches
  const { getLikeCount: getImageLikeCount, updateLikeCount: updateImageLikeCount } = useLikeCounts({ 
    targetType: 'saved_image', 
    targetIds: imageIds 
  })
  const { getLikeCount: getProjectLikeCount, updateLikeCount: updateProjectLikeCount } = useLikeCounts({ 
    targetType: 'project', 
    targetIds: projectIds 
  })

  // Handle view count updates from viewer
  const handleImageViewCountUpdate = useCallback((targetId: string, newCount: number) => {
    updateImageViewCount(targetId, 1) // Increment by 1
  }, [updateImageViewCount])

  const handleProjectViewCountUpdate = useCallback((targetId: string, newCount: number) => {
    updateProjectViewCount(targetId, 1) // Increment by 1
  }, [updateProjectViewCount])

  // Handle like count updates from viewer
  const handleImageLikeCountUpdate = useCallback((targetId: string, newCount: number) => {
    // Update to the exact count from server
    updateImageLikeCount(targetId, newCount - (getImageLikeCount(targetId) || 0))
  }, [updateImageLikeCount, getImageLikeCount])

  const handleProjectLikeCountUpdate = useCallback((targetId: string, newCount: number) => {
    // Update to the exact count from server
    updateProjectLikeCount(targetId, newCount - (getProjectLikeCount(targetId) || 0))
  }, [updateProjectLikeCount, getProjectLikeCount])

  const handleSaveSelected = useCallback(async () => {
    const totalSelected = selectedImageIds.length + selectedProjectIds.length + selectedGroupIds.length
    if (totalSelected === 0 || isSaving || isGuest) return

    setIsSaving(true)
    let successCount = 0
    let errorCount = 0

    try {
      // Save single images
      if (selectedImageIds.length > 0) {
        await Promise.all(selectedImageIds.map(async (id) => {
          // Find the image in allItems (single images only)
          let image: ImageMetadata | undefined
          for (const item of allItems) {
            if (item.type === 'single' && item.image.id === id) {
              image = item.image
              break
            }
          }

          if (image) {
            try {
              const res = await fetch('/api/photo/save-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  imageUrl: image.url || `${window.location.origin}/pensieve/${image.path}`,
                  prompt: image.prompt,
                  ai_prompt: image.ai_prompt,
                  ai_json_prompt: image.ai_json_prompt,
                  appContext: 'pensieve',
                  metadata: image.metadata
                })
              })
              if (res.ok) successCount++
              else errorCount++
            } catch (err) {
              errorCount++
            }
          }
        }))
      }

      // Save image groups (multi-image posts)
      if (selectedGroupIds.length > 0) {
        for (const groupId of selectedGroupIds) {
          // Find the group in allItems
          const groupItem = allItems.find(item => item.type === 'group' && item.id === groupId)
          if (groupItem && groupItem.type === 'group') {
            // Generate a new saved_group_id for this group in cabinet
            const savedGroupId = crypto.randomUUID()
            
            // Save each image in the group with the same saved_group_id
            const savePromises = groupItem.images.map(async (image, index) => {
              try {
                const res = await fetch('/api/photo/save-image', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    imageUrl: image.url || `${window.location.origin}/pensieve/${image.path}`,
                    prompt: image.prompt,
                    ai_prompt: image.ai_prompt,
                    ai_json_prompt: image.ai_json_prompt,
                    appContext: 'pensieve',
                    metadata: {
                      ...image.metadata,
                      saved_group_id: savedGroupId,
                      group_index: index,
                      group_total: groupItem.images.length,
                      original_group_id: groupId
                    }
                  })
                })
                return res.ok
              } catch (err) {
                return false
              }
            })
            
            const results = await Promise.all(savePromises)
            const groupSuccessCount = results.filter(r => r).length
            if (groupSuccessCount === groupItem.images.length) {
              successCount++
            } else if (groupSuccessCount > 0) {
              successCount++
              errorCount++
            } else {
              errorCount++
            }
          }
        }
      }

      // Save projects
      if (selectedProjectIds.length > 0) {
        await Promise.all(selectedProjectIds.map(async (id) => {
          const projectItem = allItems.find(item => item.type === 'project' && item.project.id === id)
          if (projectItem && projectItem.type === 'project') {
            const project = projectItem.project
            try {
              // Get slides for the project first
              const slidesRes = await fetch(`/api/pensieve/projects/${id}/slides`)
              const slidesData = await slidesRes.json()
              const slides = slidesData.slides || []

              const res = await fetch('/api/pensieve/projects', {
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
                  isPublic: false,
                  firstSlide: slides[0] ? {
                    imageUrl: slides[0].image_url,
                    imagePath: slides[0].image_path,
                    bucketName: slides[0].bucket_name,
                    prompt: slides[0].prompt,
                    aiPrompt: slides[0].ai_prompt,
                    aiJsonPrompt: slides[0].ai_json_prompt
                  } : null
                })
              })
              if (res.ok) successCount++
              else errorCount++
            } catch (err) {
              errorCount++
            }
          }
        }))
      }

      if (successCount > 0) {
        setIsSaved(true)
        setTimeout(() => setIsSaved(false), 2000)
        
        // Refresh Cabinet if it's open in another tab/window
        const channel = new BroadcastChannel('pensieve-saved-refresh')
        channel.postMessage({ type: 'image-saved' })
      }

      if (errorCount > 0) {
        alert(`Successfully saved ${successCount} items, but ${errorCount} items failed.`)
      }
      
      clearSelection()
    } catch (error) {
      console.error('Batch save error:', error)
      alert('An error occurred during batch save.')
    } finally {
      setIsSaving(false)
    }
  }, [selectedImageIds, selectedProjectIds, selectedGroupIds, allItems, isSaving, isGuest, clearSelection])

  const handleShareSelected = useCallback(() => {
    const totalSelected = selectedImageIds.length + selectedProjectIds.length + selectedGroupIds.length
    if (totalSelected === 0) return

    const baseUrl = window.location.origin
    const items: ShareItem[] = []

    // Collect single image items
    selectedImageIds.forEach(id => {
      // Find image in allItems (single images only)
      let image: ImageMetadata | undefined
      for (const item of allItems) {
        if (item.type === 'single' && item.image.id === id) {
          image = item.image
          break
        }
      }

      if (image) {
        items.push({
          id: id,
          title: image.filename || 'Image',
          link: `${baseUrl}/pensieve/${id}`,
          type: 'image'
        })
      }
    })

    // Collect group items
    selectedGroupIds.forEach(groupId => {
      const groupItem = allItems.find(item => item.type === 'group' && item.id === groupId)
      if (groupItem && groupItem.type === 'group') {
        items.push({
          id: groupId,
          title: `${groupItem.images.length} Images`,
          link: `${baseUrl}/pensieve/${groupId}`,
          type: 'image'
        })
      }
    })

    // Collect project items
    selectedProjectIds.forEach(id => {
      const item = allItems.find(i => i.type === 'project' && i.project.id === id)
      if (item && item.type === 'project') {
        items.push({
          id: id,
          title: item.project.name || 'Project',
          link: `${baseUrl}/pensieve/projects/${id}`,
          type: 'project'
        })
      }
    })

    if (items.length === 0) return
    
    setShareItems(items)
    setIsShareModalOpen(true)
  }, [selectedImageIds, selectedProjectIds, selectedGroupIds, allItems])

  const handleImageUpdate = useCallback((updatedImage: ImageMetadata) => {
    // Update global metadata state via hook
    updateMetadata(updatedImage)

    // Update local viewer state if needed
    setViewerImage((prev) => {
      if (prev?.image?.id && updatedImage.id && prev.image.id === updatedImage.id) {
        return { ...prev, image: { ...prev.image, ...updatedImage } }
      }
      return prev
    })
  }, [updateMetadata])

  // Flatten filtered images for navigation (exclude projects)
  // Include reference images as well so they can be navigated like regular images
  const flattenedImages = useMemo(() => {
    const result: Array<{ image: ImageMetadata, folder: string }> = []
    
    filteredItems.forEach((item) => {
      if (item.type === 'single') {
        result.push({ image: item.image, folder: item.folder })
      } else if (item.type === 'group') {
        // 모든 이미지를 그대로 포함
        item.images.forEach((img) => {
          result.push({ image: img, folder: item.folder })
        })
      }
    })
    
    return result
  }, [filteredItems])

  const handleImageClick = useCallback((image: ImageMetadata, folder: string) => {
    // For reference images, find by URL or metadata
    const index = flattenedImages.findIndex((item) => {
      if (image.metadata?.isReferenceImage) {
        // Match reference images by their original URL or blobUrl
        const refInfo = image.metadata.referenceImageInfo
        const itemRefInfo = item.image.metadata?.referenceImageInfo
        return (
          item.image.metadata?.isReferenceImage &&
          (refInfo?.originalUrl === itemRefInfo?.originalUrl ||
           refInfo?.blobUrl === itemRefInfo?.blobUrl)
        )
      } else {
        return item.image.path === image.path && item.folder === folder
      }
    })
    setViewerIndex(index >= 0 ? index : 0)
    setViewerImage({ image, folder })
    setIsViewerOpen(true)
    
    // Find item index in allItems for navigation
    const itemIndex = filteredItems.findIndex((item) => {
      if (item.type === 'single') {
        return item.image.path === image.path && item.folder === folder
      } else if (item.type === 'group') {
        return item.images.some(img => img.path === image.path)
      }
      return false
    })
    if (itemIndex >= 0) {
      setCurrentItemIndex(itemIndex)
    }
    
    // URL 변경 (history.pushState) - skip for reference images
    if (!image.metadata?.isReferenceImage) {
      updateUrlForImage(image)
    }
  }, [flattenedImages, updateUrlForImage, filteredItems])

  const handlePreviewClick = useCallback((images: ImageMetadata[], folder: string) => {
    // 바로 첫 번째 이미지로 ImageViewer 열기 (ImagePreviewModal 건너뛰기)
    if (images.length > 0) {
      handleImageClick(images[0], folder)
    }
  }, [handleImageClick])

  const handlePreviewImageSelect = useCallback((image: ImageMetadata, folder: string) => {
    handleImageClick(image, folder)
  }, [handleImageClick])

  const handleProjectViewClick = useCallback(async (projectId: string) => {
    try {
      // 프로젝트와 슬라이드 로드
      const [projectResponse, slidesResponse] = await Promise.all([
        fetch(`/api/pensieve/projects/${projectId}`),
        fetch(`/api/pensieve/projects/${projectId}/slides`)
      ])

      if (!projectResponse.ok || !slidesResponse.ok) {
        throw new Error('Failed to load project')
      }

      const projectData = await projectResponse.json()
      const slidesData = await slidesResponse.json()

      // URL 업데이트
      const projectUrl = `/pensieve/projects/${projectId}`
      window.history.pushState({ projectId, isModal: true }, '', projectUrl)

      setViewerProject({
        project: projectData.project as ProjectMetadata,
        slides: slidesData.slides || []
      })
      setIsProjectViewerOpen(true)
      
      // Find item index in allItems for navigation
      const itemIndex = filteredItems.findIndex((item) => {
        return item.type === 'project' && item.project.id === projectId
      })
      if (itemIndex >= 0) {
        setCurrentItemIndex(itemIndex)
      }
    } catch (error) {
      console.error('Error loading project:', error)
      alert('Failed to load project')
    }
  }, [filteredItems])

  const handleProjectEdit = useCallback(async (projectId: string, slideId?: string) => {
    // openProjectForEdit 호출 - Context가 ProjectViewer 닫기를 처리
    await openProjectForEdit(projectId, slideId)
  }, [openProjectForEdit])

  const handleProjectDelete = useCallback(async (projectId: string) => {
    try {
      const response = await fetch(`/api/pensieve/projects/${projectId}`, {
        method: 'DELETE'
      })
      
      if (!response.ok) throw new Error('Failed to delete project')
      
      // 갤러리 새로고침 필요 (useGalleryImages hook이 자동으로 처리할 수 있도록)
      window.location.reload() // 간단한 방법, 또는 refreshToken 업데이트
    } catch (error) {
      console.error('Error deleting project:', error)
      throw error
    }
  }, [])

  const handleProjectUpdate = useCallback((updated: ProjectMetadata) => {
    // useGalleryImages hook이 관리하므로 여기서는 특별한 처리가 필요 없을 수 있음
    // 필요시 refreshToken을 트리거할 수 있음
  }, [])

  const handleViewerNext = () => {
    if (!viewerImage) return
    
    // Find which item (group or single) the current image belongs to
    const currentItem = filteredItems.find((item) => {
      if (item.type === 'single') {
        return item.image.path === viewerImage.image.path && item.folder === viewerImage.folder
      } else if (item.type === 'group') {
        return item.images.some(img => img.path === viewerImage.image.path)
      }
      return false
    })
    
    if (!currentItem) return
    
    // Get images for the current item (group or single)
    let currentGroupImages: Array<{ image: ImageMetadata, folder: string }> = []
    if (currentItem.type === 'single') {
      currentGroupImages = [{ image: currentItem.image, folder: currentItem.folder }]
    } else if (currentItem.type === 'group') {
      currentGroupImages = currentItem.images.map(img => ({ image: img, folder: currentItem.folder }))
    }
    
    // Find current index within the group
    const currentGroupIndex = currentGroupImages.findIndex(
      item => item.image.path === viewerImage.image.path && item.folder === viewerImage.folder
    )
    
    if (currentGroupIndex < 0) return
    
    // Navigate within the group (circular)
    const nextGroupIndex = (currentGroupIndex + 1) % currentGroupImages.length
    const nextImage = currentGroupImages[nextGroupIndex]
    
    // Find the index in flattenedImages for URL update
    const nextFlattenedIndex = flattenedImages.findIndex(
      item => item.image.path === nextImage.image.path && item.folder === nextImage.folder
    )
    
    if (nextFlattenedIndex >= 0) {
      setViewerIndex(nextFlattenedIndex)
    }
    setViewerImage(nextImage)
    
    // URL 업데이트
    try {
      const slug = generateImageSlugSync(nextImage.image)
      const newUrl = `/pensieve/${slug}`
      window.history.replaceState({ imageSlug: slug, isModal: true }, '', newUrl)
    } catch (error) {
      console.error('Error updating URL:', error)
    }
  }

  const handleViewerPrevious = () => {
    if (!viewerImage) return
    
    // Find which item (group or single) the current image belongs to
    const currentItem = filteredItems.find((item) => {
      if (item.type === 'single') {
        return item.image.path === viewerImage.image.path && item.folder === viewerImage.folder
      } else if (item.type === 'group') {
        return item.images.some(img => img.path === viewerImage.image.path)
      }
      return false
    })
    
    if (!currentItem) return
    
    // Get images for the current item (group or single)
    let currentGroupImages: Array<{ image: ImageMetadata, folder: string }> = []
    if (currentItem.type === 'single') {
      currentGroupImages = [{ image: currentItem.image, folder: currentItem.folder }]
    } else if (currentItem.type === 'group') {
      currentGroupImages = currentItem.images.map(img => ({ image: img, folder: currentItem.folder }))
    }
    
    // Find current index within the group
    const currentGroupIndex = currentGroupImages.findIndex(
      item => item.image.path === viewerImage.image.path && item.folder === viewerImage.folder
    )
    
    if (currentGroupIndex < 0) return
    
    // Navigate within the group (circular)
    const prevGroupIndex = (currentGroupIndex - 1 + currentGroupImages.length) % currentGroupImages.length
    const prevImage = currentGroupImages[prevGroupIndex]
    
    // Find the index in flattenedImages for URL update
    const prevFlattenedIndex = flattenedImages.findIndex(
      item => item.image.path === prevImage.image.path && item.folder === prevImage.folder
    )
    
    if (prevFlattenedIndex >= 0) {
      setViewerIndex(prevFlattenedIndex)
    }
    setViewerImage(prevImage)
    
    // URL 업데이트
    try {
      const slug = generateImageSlugSync(prevImage.image)
      const newUrl = `/pensieve/${slug}`
      window.history.replaceState({ imageSlug: slug, isModal: true }, '', newUrl)
    } catch (error) {
      console.error('Error updating URL:', error)
    }
  }

  const handleViewerClose = () => {
    setIsViewerOpen(false)
    setViewerImage(null)
    
    // URL 복원
    restoreOriginalUrl()
  }

  // Navigate to next item in allItems (image or project)
  const handleItemNext = useCallback(async () => {
    if (currentItemIndex < 0 || currentItemIndex >= filteredItems.length - 1) return
    
    const nextIndex = currentItemIndex + 1
    const nextItem = filteredItems[nextIndex]
    
    if (nextItem.type === 'project') {
      // Close image viewer if open
      if (isViewerOpen) {
        setIsViewerOpen(false)
        setViewerImage(null)
        restoreOriginalUrl()
      }
      
      // Open project viewer
      try {
        const [projectResponse, slidesResponse] = await Promise.all([
          fetch(`/api/pensieve/projects/${nextItem.project.id}`),
          fetch(`/api/pensieve/projects/${nextItem.project.id}/slides`)
        ])

        if (!projectResponse.ok || !slidesResponse.ok) {
          throw new Error('Failed to load project')
        }

        const projectData = await projectResponse.json()
        const slidesData = await slidesResponse.json()

        const projectUrl = `/pensieve/projects/${nextItem.project.id}`
        window.history.pushState({ projectId: nextItem.project.id, isModal: true }, '', projectUrl)

        setViewerProject({
          project: projectData.project as ProjectMetadata,
          slides: slidesData.slides || []
        })
        setIsProjectViewerOpen(true)
        setCurrentItemIndex(nextIndex)
      } catch (error) {
        console.error('Error loading project:', error)
      }
    } else {
      // Close project viewer if open
      if (isProjectViewerOpen) {
        setIsProjectViewerOpen(false)
        setViewerProject(null)
        restoreProjectViewerUrl()
      }
      
      // Open image viewer with first image from the item
      let targetImage: ImageMetadata
      let targetFolder: string
      
      if (nextItem.type === 'single') {
        targetImage = nextItem.image
        targetFolder = nextItem.folder
      } else {
        // For groups, use first image
        targetImage = nextItem.images[0]
        targetFolder = nextItem.folder
      }
      
      const imageIndex = flattenedImages.findIndex((item) => {
        return item.image.path === targetImage.path && item.folder === targetFolder
      })
      
      setViewerIndex(imageIndex >= 0 ? imageIndex : 0)
      setViewerImage({ image: targetImage, folder: targetFolder })
      setIsViewerOpen(true)
      setCurrentItemIndex(nextIndex)
      
      // URL 업데이트
      if (!targetImage.metadata?.isReferenceImage) {
        updateUrlForImage(targetImage)
      }
    }
  }, [currentItemIndex, filteredItems, isViewerOpen, isProjectViewerOpen, flattenedImages, updateUrlForImage, restoreOriginalUrl, restoreProjectViewerUrl])

  // Navigate to previous item in allItems (image or project)
  const handleItemPrevious = useCallback(async () => {
    if (currentItemIndex <= 0) return
    
    const prevIndex = currentItemIndex - 1
    const prevItem = filteredItems[prevIndex]
    
    if (prevItem.type === 'project') {
      // Close image viewer if open
      if (isViewerOpen) {
        setIsViewerOpen(false)
        setViewerImage(null)
        restoreOriginalUrl()
      }
      
      // Open project viewer
      try {
        const [projectResponse, slidesResponse] = await Promise.all([
          fetch(`/api/pensieve/projects/${prevItem.project.id}`),
          fetch(`/api/pensieve/projects/${prevItem.project.id}/slides`)
        ])

        if (!projectResponse.ok || !slidesResponse.ok) {
          throw new Error('Failed to load project')
        }

        const projectData = await projectResponse.json()
        const slidesData = await slidesResponse.json()

        const projectUrl = `/pensieve/projects/${prevItem.project.id}`
        window.history.pushState({ projectId: prevItem.project.id, isModal: true }, '', projectUrl)

        setViewerProject({
          project: projectData.project as ProjectMetadata,
          slides: slidesData.slides || []
        })
        setIsProjectViewerOpen(true)
        setCurrentItemIndex(prevIndex)
      } catch (error) {
        console.error('Error loading project:', error)
      }
    } else {
      // Close project viewer if open
      if (isProjectViewerOpen) {
        setIsProjectViewerOpen(false)
        setViewerProject(null)
        restoreProjectViewerUrl()
      }
      
      // Open image viewer with first image from the item
      let targetImage: ImageMetadata
      let targetFolder: string
      
      if (prevItem.type === 'single') {
        targetImage = prevItem.image
        targetFolder = prevItem.folder
      } else {
        // For groups, use first image
        targetImage = prevItem.images[0]
        targetFolder = prevItem.folder
      }
      
      const imageIndex = flattenedImages.findIndex((item) => {
        return item.image.path === targetImage.path && item.folder === targetFolder
      })
      
      setViewerIndex(imageIndex >= 0 ? imageIndex : 0)
      setViewerImage({ image: targetImage, folder: targetFolder })
      setIsViewerOpen(true)
      setCurrentItemIndex(prevIndex)
      
      // URL 업데이트
      if (!targetImage.metadata?.isReferenceImage) {
        updateUrlForImage(targetImage)
      }
    }
  }, [currentItemIndex, filteredItems, isViewerOpen, isProjectViewerOpen, flattenedImages, updateUrlForImage, restoreOriginalUrl, restoreProjectViewerUrl])

  // 현재 보고 있는 이미지 그룹의 모든 이미지들과 인덱스 계산
  const currentGroupImages = useMemo(() => {
    if (currentItemIndex < 0 || currentItemIndex >= filteredItems.length) return []
    const item = filteredItems[currentItemIndex]
    if (item.type === 'single') return [{ image: item.image, folder: item.folder }]
    if (item.type === 'group') return item.images.map(img => ({ image: img, folder: item.folder }))
    return []
  }, [currentItemIndex, filteredItems])

  const currentIndexInGroup = useMemo(() => {
    if (!viewerImage || currentGroupImages.length === 0) return 0
    const idx = currentGroupImages.findIndex(img => img.image.path === viewerImage.image.path)
    return idx >= 0 ? idx : 0
  }, [viewerImage, currentGroupImages])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 min-h-[200px]">
        {/* Empty state while loading, skeleton could be added here if needed */}
      </div>
    )
  }

  if (Object.keys(metadata).length === 0 && projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-[var(--muted)] mb-2">No images found</p>
        <p className="text-sm text-[var(--muted)]">Metadata file may be missing or empty</p>
      </div>
    )
  }

  return (
    <>
      {visibleItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-[var(--muted)] mb-2">No items match your filters</p>
        </div>
      ) : (
        <>
          <Masonry
            breakpointCols={{
              default: 5,      // Desktop: 5 columns
              1024: 4,         // Large tablet: 4 columns  
              640: 3,          // Tablet: 3 columns
              480: 2           // Mobile: 2 columns
            }}
            className="flex -ml-3 w-auto"
            columnClassName="pl-3 bg-clip-padding"
          >
            {visibleItems.map((item, idx) => {
              if (item.type === 'project') {
                return (
                  <div key={`project-${item.project.id}`}>
                    <ProjectCard
                      project={item.project}
                      onViewClick={handleProjectViewClick}
                      onTogglePublic={handleProjectTogglePublic}
                      showVisibilityToggle={false} // Strands에서는 토글 숨김
                      isSelectionMode={isSelectionMode}
                      isSelected={selectedProjectIds.includes(item.project.id)}
                      onSelect={() => handleSelectProject(item.project.id)}
                      viewCount={getProjectViewCount(item.project.id)}
                      viewContext="strands"
                      likeCount={getProjectLikeCount(item.project.id)}
                    />
                  </div>
                )
              }
              
              return (
                <div key={`${item.folder}-${item.type === 'single' ? item.image.path : item.id}-${idx}`}>
                  {item.type === 'single' ? (
                    <ImageCard
                      image={item.image}
                      folder={item.folder}
                      onImageClick={handleImageClick}
                      isSelectionMode={isSelectionMode}
                      isSelected={item.image.id ? selectedImageIds.includes(item.image.id) : false}
                      onSelect={item.image.id ? () => handleSelectImage(item.image.id!) : undefined}
                      viewCount={item.image.id ? getImageViewCount(item.image.id) : undefined}
                      viewContext="strands"
                      likeCount={item.image.id ? getImageLikeCount(item.image.id) : undefined}
                    />
                  ) : (
                    <MultiImageCard
                      images={item.images}
                      folder={item.folder}
                      onPreviewClick={handlePreviewClick}
                      isSelectionMode={isSelectionMode}
                      isSelected={selectedGroupIds.includes(item.id)}
                      onSelect={() => handleSelectGroup(item.id)}
                      viewCount={item.images[0]?.id ? getImageViewCount(item.images[0].id) : undefined}
                      viewContext="strands"
                      likeCount={item.images[0]?.id ? getImageLikeCount(item.images[0].id) : undefined}
                    />
                  )}
                </div>
              )
            })}
          </Masonry>
          
          {/* Load More Sentinel */}
          {visibleCount < filteredItems.length && (
            <div 
              ref={loadMoreRef} 
              className="h-20 w-full flex items-center justify-center mt-8 opacity-0"
            >
              Loading more...
            </div>
          )}
        </>
      )}

      {/* Image Preview Modal */}
      {isPreviewOpen && previewImages && (
        <ImagePreviewModal
          images={previewImages}
          folder={previewFolder}
          isOpen={isPreviewOpen}
          onClose={() => {
            setIsPreviewOpen(false)
            setPreviewImages(null)
            setPreviewFolder('')
          }}
          onImageSelect={handlePreviewImageSelect}
        />
      )}

      {/* Image Viewer */}
      {isViewerOpen && viewerImage && (
        <ImageViewer
          image={viewerImage.image}
          folder={viewerImage.folder}
          allImages={currentGroupImages}
          currentIndex={currentIndexInGroup}
          isOpen={isViewerOpen}
          onClose={handleViewerClose}
          onNext={handleViewerNext}
          onPrevious={handleViewerPrevious}
          onItemNext={handleItemNext}
          onItemPrevious={handleItemPrevious}
          onCopyPrompt={onCopyPrompt}
          user={user}
          onImageUpdate={handleImageUpdate}
          viewContext="strands"
          onViewCountUpdate={viewerImage.image.id ? handleImageViewCountUpdate : undefined}
          onLikeCountUpdate={viewerImage.image.id ? handleImageLikeCountUpdate : undefined}
        />
      )}

      {/* Project Viewer */}
      {isProjectViewerOpen && viewerProject && (
        <ProjectViewer
          project={viewerProject.project}
          slides={viewerProject.slides}
          isOpen={isProjectViewerOpen}
          onClose={() => {
            setIsProjectViewerOpen(false)
            setViewerProject(null)
            setProjectViewerSlideId(null)
            restoreProjectViewerUrl()
          }}
          onEdit={handleProjectEdit}
          onDelete={handleProjectDelete}
          onTogglePublic={handleProjectTogglePublic}
          onItemNext={handleItemNext}
          onItemPrevious={handleItemPrevious}
          user={user}
          onProjectUpdate={handleProjectUpdate}
          initialSlideId={projectViewerSlideId}
          viewContext="strands"
          onViewCountUpdate={handleProjectViewCountUpdate}
          onLikeCountUpdate={handleProjectLikeCountUpdate}
        />
      )}

      {/* Action Buttons and Modals */}
      <PensieveActionButtons
        onShare={handleShareSelected}
        onSave={handleSaveSelected}
        canShare={(selectedImageIds.length > 0 || selectedProjectIds.length > 0 || selectedGroupIds.length > 0) && !isGuest}
        canSave={(selectedImageIds.length > 0 || selectedProjectIds.length > 0 || selectedGroupIds.length > 0) && !isGuest}
        isSaving={isSaving}
        isSaved={isSaved}
        selectedImageCount={selectedImageIds.length}
        selectedProjectCount={selectedProjectIds.length}
        selectedGroupCount={selectedGroupIds.length}
      />

      <ShareLinksModal 
        isOpen={isShareModalOpen}
        onClose={() => {
          setIsShareModalOpen(false)
          clearSelection()
        }}
        items={shareItems}
      />
    </>
  )
}
