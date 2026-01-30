'use client'

import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import Masonry from 'react-masonry-css'
import { createClient } from '@/utils/supabase/client'
import ImageCard, { ImageMetadata } from './ImageCard'
import ImageViewer from './ImageViewer'
import MultiImageCard from './MultiImageCard'
import ProjectCard, { ProjectMetadata } from './ProjectCard'
import ProjectViewer from './ProjectViewer/ProjectViewer'
import { generateImageSlugSync } from '../utils/imageSlug'
import { usePensieve } from '../context/PensieveContext'
import { usePensieveSelection } from '../context/PensieveSelectionContext'
import { isUrlExpired } from '@/app/utils/urlUtils'
import PensieveActionButtons from './PensieveActionButtons'
import { ShareLinksModal, ShareItem } from './ShareLinksModal'
import { useViewCounts } from '../hooks/useViewCounts'
import { useLikeCounts } from '../hooks/useLikeCounts'

interface ImagesMetadata {
  [folder: string]: ImageMetadata[]
}

// 갤러리 아이템 타입 (이미지, 그룹 또는 프로젝트)
type GalleryItem = 
  | { type: 'image'; image: ImageMetadata; folder: string }
  | { type: 'group'; images: ImageMetadata[]; folder: string; id: string }
  | { type: 'project'; project: ProjectMetadata }

interface SavedGalleryProps {
  onCopyPrompt: (prompt: string) => void
  user: any
  searchQuery: string
  refreshToken?: number
  onDelete?: (imageId: string, skipRefresh?: boolean) => Promise<void> | void
}

const INITIAL_LOAD_COUNT = 36
const LOAD_MORE_COUNT = 36

export default function SavedGallery({
  onCopyPrompt,
  user,
  searchQuery,
  refreshToken = 0,
  onDelete
}: SavedGalleryProps) {
  const [metadata, setMetadata] = useState<ImagesMetadata>({})
  const [projects, setProjects] = useState<ProjectMetadata[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [viewerImage, setViewerImage] = useState<{ image: ImageMetadata; folder: string } | null>(null)
  const [viewerIndex, setViewerIndex] = useState(0)
  const [isViewerOpen, setIsViewerOpen] = useState(false)
  const [viewerProject, setViewerProject] = useState<{ project: ProjectMetadata; slides: any[] } | null>(null)
  const [isProjectViewerOpen, setIsProjectViewerOpen] = useState(false)
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)
  const [shareItems, setShareItems] = useState<ShareItem[]>([])
  const [isDeleting, setIsDeleting] = useState(false)
  
  // Pagination / Infinite Scroll State
  const [visibleCount, setVisibleCount] = useState(INITIAL_LOAD_COUNT)
  const loadMoreRef = useRef<HTMLDivElement>(null)
  
  const supabase = createClient()
  const { openProjectForEdit, isUploadModalOpen, triggerRefresh } = usePensieve()
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

  const isGuest = !user || user?.isAnonymous || user?.id === 'anonymous'

  // URL 변경 함수 (history.pushState 사용)
  const updateUrlForImage = useCallback((image: ImageMetadata) => {
    try {
      const slug = generateImageSlugSync(image)
      const newUrl = `/pensieve/saved/${slug}`
      window.history.pushState({ imageSlug: slug, isModal: true }, '', newUrl)
    } catch (error) {
      console.error('Error updating URL:', error)
    }
  }, [])

  // URL 복원 함수
  const restoreOriginalUrl = useCallback(() => {
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

  // popstate 이벤트 핸들러 (브라우저 뒤로가기)
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (isViewerOpen && !event.state?.isModal) {
        setIsViewerOpen(false)
        setViewerImage(null)
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [isViewerOpen])

  const [projectViewerSlideId, setProjectViewerSlideId] = useState<string | null>(null)

  // 프로젝트 뷰어 열기 리스너 및 실시간 업데이트 리스너
  useEffect(() => {
    const projectChannel = new BroadcastChannel('pensieve-open-project')
    projectChannel.onmessage = (event) => {
      if (event.data.type === 'open-project') {
        const { project, slides, slideId } = event.data
        setViewerProject({ project, slides: slides || [] })
        setProjectViewerSlideId(slideId || null)
        setIsProjectViewerOpen(true)
      }
    }

    const refreshChannel = new BroadcastChannel('pensieve-refresh')
    refreshChannel.onmessage = (event) => {
      if (event.data.type === 'project-created' && event.data.project) {
        // 새 프로젝트가 생성되면 목록에 즉시 추가 (중복 방지)
        const newProject = event.data.project
        setProjects(prev => {
          if (prev.some(p => p.id === newProject.id)) return prev
          return [newProject, ...prev]
        })
      } else if (event.data.type === 'project-updated' && event.data.projectId) {
        // 프로젝트가 업데이트되면 (예: 슬라이드 추가) 해당 프로젝트의 정보만 다시 가져옴
        const projectId = event.data.projectId
        fetch(`/api/pensieve/projects/${projectId}`)
          .then(res => res.json())
          .then(data => {
            if (data.project) {
              setProjects(prev => prev.map(p => p.id === projectId ? data.project : p))
            }
          })
          .catch(err => console.error('Error fetching updated project:', err))
      }
    }

    return () => {
      projectChannel.close()
      refreshChannel.close()
    }
  }, [])

  // Load saved images and projects
  useEffect(() => {
    const loadSaved = async () => {
      try {
        if (isGuest) {
          setMetadata({ saved: [] })
          setProjects([])
          return
        }

        // 이미지와 프로젝트 동시 로드
        const [imagesResult, projectsResult] = await Promise.all([
          supabase
            .from('user_background_settings')
            .select('id, background_path, background_url, created_at, name, prompt, ai_prompt, ai_json_prompt, is_public, url_expires_at, bucket_name, metadata')
            .eq('user_id', user.id)
            .eq('source', 'pensieve_saved')
            .order('created_at', { ascending: false }),
          supabase
            .from('pensieve_projects')
            .select('id, user_id, name, thumbnail_url, thumbnail_path, original_image_url, original_image_path, original_bucket_name, prompt, ai_prompt, ai_json_prompt, selected_model, slide_count, is_public, created_at, updated_at')
            .eq('user_id', user.id)
            .order('updated_at', { ascending: false })
        ])

        if (imagesResult.error) throw imagesResult.error

        // Generate URLs in parallel, refreshing expired ones
        const urlPromises = (imagesResult.data || []).map(async (item) => {
          let url = item.background_url
          if (!item.background_url || (item.url_expires_at && new Date(item.url_expires_at) < new Date())) {
            try {
              const { data: signedData } = await supabase.storage
                .from(item.bucket_name || 'saved-gallery')
                .createSignedUrl(item.background_path, 24 * 60 * 60)
              
              if (signedData?.signedUrl) {
                url = signedData.signedUrl
                await supabase
                  .from('user_background_settings')
                  .update({
                    background_url: url,
                    url_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
                  })
                  .eq('id', item.id)
              }
            } catch (error) {
              console.error('Error generating signed URL for', item.background_path, error)
            }
          }

          return {
            id: item.id,
            path: item.background_path,
            filename: item.name || item.background_path?.split('/').pop() || 'image',
            size: '',
            createdDate: item.created_at || new Date().toISOString(),
            keywords: [],
            links: (item.metadata as any)?.links || [],
            prompt: item.prompt ?? null,
            dimensions: '',
            url: url,
            ai_json_prompt: item.ai_json_prompt,
            ai_prompt: item.ai_prompt,
            is_public: item.is_public ?? false,
            // Metadata JSONB field (includes referenceImages)
            metadata: item.metadata || undefined
          } as ImageMetadata
        })

        const images = await Promise.all(urlPromises)
        setMetadata({ saved: images })
        
        // 프로젝트 썸네일 URL 갱신 및 설정
        if (!projectsResult.error && projectsResult.data) {
          const refreshedProjects = await Promise.all(
            (projectsResult.data || []).map(async (project: any) => {
              // thumbnail_url이 없거나 만료되었는지 확인
              const needsRefresh = !project.thumbnail_url || 
                (project.thumbnail_url && isUrlExpired(project.thumbnail_url))
              
              if (needsRefresh && project.thumbnail_path) {
                try {
                  // original_bucket_name이 있으면 사용, 없으면 기본값 사용
                  const bucketName = project.original_bucket_name || 'generated-images'
                  const { data: signedData } = await supabase.storage
                    .from(bucketName)
                    .createSignedUrl(project.thumbnail_path, 24 * 60 * 60)
                  
                  if (signedData?.signedUrl) {
                    // DB 업데이트
                    await supabase
                      .from('pensieve_projects')
                      .update({ thumbnail_url: signedData.signedUrl })
                      .eq('id', project.id)
                    
                    return { ...project, thumbnail_url: signedData.signedUrl }
                  }
                } catch (error) {
                  console.error(`Error generating signed URL for project ${project.id}:`, error)
                }
              }
              
              // original_image_url도 확인 (thumbnail_url이 없을 때 대체용)
              if (!project.thumbnail_url && project.original_image_path) {
                const needsOriginalRefresh = !project.original_image_url || 
                  (project.original_image_url && isUrlExpired(project.original_image_url))
                
                if (needsOriginalRefresh) {
                  try {
                    const bucketName = project.original_bucket_name || 'generated-images'
                    const { data: signedData } = await supabase.storage
                      .from(bucketName)
                      .createSignedUrl(project.original_image_path, 24 * 60 * 60)
                    
                    if (signedData?.signedUrl) {
                      await supabase
                        .from('pensieve_projects')
                        .update({ original_image_url: signedData.signedUrl })
                        .eq('id', project.id)
                      
                      return { ...project, original_image_url: signedData.signedUrl }
                    }
                  } catch (error) {
                    console.error(`Error generating signed URL for original image of project ${project.id}:`, error)
                  }
                }
              }
              
              return project
            })
          )
          
          setProjects(refreshedProjects as ProjectMetadata[])
        }
      } catch (error) {
        console.error('Error loading saved items:', error)
        setMetadata({ saved: [] })
        setProjects([])
      } finally {
        setIsLoading(false)
      }
    }

    loadSaved()
  }, [isGuest, supabase, user?.id, refreshToken])

  // 모든 갤러리 아이템 (이미지 + 그룹 + 프로젝트) 통합 및 정렬
  const allItems = useMemo(() => {
    const items: GalleryItem[] = []
    const groupedImages = new Map<string, { images: ImageMetadata[]; folder: string; createdDate: string }>()
    const singleImages: { image: ImageMetadata; folder: string }[] = []
    
    // 이미지를 saved_group_id로 그룹화
    Object.entries(metadata).forEach(([folder, imageList]) => {
      imageList.forEach((image) => {
        const savedGroupId = (image.metadata as any)?.saved_group_id
        
        if (savedGroupId) {
          // 그룹에 속한 이미지
          if (!groupedImages.has(savedGroupId)) {
            groupedImages.set(savedGroupId, { 
              images: [], 
              folder, 
              createdDate: image.createdDate 
            })
          }
          const group = groupedImages.get(savedGroupId)!
          group.images.push(image)
          // group_index로 정렬하기 위해 이미지 추가 후 정렬
        } else {
          // 단일 이미지
          singleImages.push({ image, folder })
        }
      })
    })
    
    // 그룹 이미지를 group_index로 정렬하고 items에 추가
    groupedImages.forEach((group, groupId) => {
      // group_index로 정렬
      group.images.sort((a, b) => {
        const indexA = (a.metadata as any)?.group_index ?? 0
        const indexB = (b.metadata as any)?.group_index ?? 0
        return indexA - indexB
      })
      
      items.push({
        type: 'group',
        images: group.images,
        folder: group.folder,
        id: groupId
      })
    })
    
    // 단일 이미지 추가
    singleImages.forEach(({ image, folder }) => {
      items.push({ type: 'image', image, folder })
    })
    
    // 프로젝트 추가
    projects.forEach((project) => {
      items.push({ type: 'project', project })
    })
    
    // 날짜순 정렬 (최신순)
    items.sort((a, b) => {
      let dateA: string | undefined
      let dateB: string | undefined
      
      if (a.type === 'image') dateA = a.image.createdDate
      else if (a.type === 'group') dateA = a.images[0]?.createdDate
      else dateA = a.project.updated_at || a.project.created_at
      
      if (b.type === 'image') dateB = b.image.createdDate
      else if (b.type === 'group') dateB = b.images[0]?.createdDate
      else dateB = b.project.updated_at || b.project.created_at
      
      return new Date(dateB || 0).getTime() - new Date(dateA || 0).getTime()
    })
    
    return items
  }, [metadata, projects])

  // 이미지만 추출 (뷰어용) - 그룹 내 이미지도 포함
  const allImages = useMemo(() => {
    const result: { image: ImageMetadata; folder: string }[] = []
    allItems.forEach(item => {
      if (item.type === 'image') {
        result.push({ image: item.image, folder: item.folder })
      } else if (item.type === 'group') {
        item.images.forEach(image => {
          result.push({ image, folder: item.folder })
        })
      }
    })
    return result
  }, [allItems])

  // Filter by search
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return allItems
    
    const query = searchQuery.toLowerCase()
    return allItems.filter((item) => {
      if (item.type === 'image') {
        const promptMatch = typeof item.image.prompt === 'string' 
          ? item.image.prompt.toLowerCase().includes(query)
          : false
        const keywordMatch = item.image.keywords?.some((k) => k.toLowerCase().includes(query))
        return promptMatch || keywordMatch
      } else if (item.type === 'group') {
        // 그룹 내 이미지 중 하나라도 매칭되면 표시
        return item.images.some(image => {
          const promptMatch = typeof image.prompt === 'string' 
            ? image.prompt.toLowerCase().includes(query)
            : false
          const keywordMatch = image.keywords?.some((k) => k.toLowerCase().includes(query))
          return promptMatch || keywordMatch
        })
      } else {
        // 프로젝트 검색
        const nameMatch = item.project.name?.toLowerCase().includes(query) || false
        const promptMatch = item.project.prompt?.toLowerCase().includes(query) || false
        return nameMatch || promptMatch
      }
    })
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
      if (item.type === 'image' && item.image.id) {
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

  const handleImageClick = (image: ImageMetadata, folder: string) => {
    const index = allImages.findIndex(
      (item) => item.image.path === image.path && item.folder === folder
    )
    setViewerIndex(index >= 0 ? index : 0)
    setViewerImage({ image, folder })
    setIsViewerOpen(true)
    updateUrlForImage(image)
  }

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

      // URL 업데이트 - 프로젝트는 항상 /pensieve/projects/${projectId}로 통일
      const projectUrl = `/pensieve/projects/${projectId}`
      window.history.pushState({ projectId, isModal: true }, '', projectUrl)

      setViewerProject({
        project: projectData.project as ProjectMetadata,
        slides: slidesData.slides || []
      })
      setIsProjectViewerOpen(true)
    } catch (error) {
      console.error('Error loading project:', error)
      alert('Failed to load project')
    }
  }, [])

  const handleProjectEdit = useCallback(async (projectId: string, slideId?: string) => {
    // openProjectForEdit 호출 - Context가 ProjectViewer 닫기를 처리
    await openProjectForEdit(projectId, slideId)
  }, [openProjectForEdit])

  const handleProjectDelete = useCallback(async (projectId: string, skipLocalUpdate = false) => {
    try {
      const response = await fetch(`/api/pensieve/projects/${projectId}`, {
        method: 'DELETE'
      })
      
      if (!response.ok) throw new Error('Failed to delete project')
      
      // 로컬 상태에서 제거
      if (!skipLocalUpdate) {
        setProjects((prev) => prev.filter((p) => p.id !== projectId))
        setIsProjectViewerOpen(false)
      }
    } catch (error) {
      console.error('Error deleting project:', error)
      throw error
    }
  }, [])

  const handleProjectUpdate = useCallback((updated: ProjectMetadata) => {
    setProjects((prev) => 
      prev.map((p) => p.id === updated.id ? updated : p)
    )
    if (viewerProject && viewerProject.project.id === updated.id) {
      setViewerProject({ ...viewerProject, project: updated })
    }
  }, [viewerProject])

  const handleProjectTogglePublic = useCallback(async (projectId: string, isPublic: boolean) => {
    try {
      const response = await fetch(`/api/pensieve/projects/${projectId}/toggle-public`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublic })
      })
      
      if (!response.ok) throw new Error('Failed to toggle public status')
      
      // 로컬 상태 업데이트
      setProjects((prev) => 
        prev.map((p) => p.id === projectId ? { ...p, is_public: isPublic } : p)
      )
    } catch (error) {
      console.error('Error toggling project public status:', error)
      throw error
    }
  }, [])

  // Batch operation: Share selected items (open share modal)
  const handleShareSelected = useCallback(() => {
    const totalSelected = selectedImageIds.length + selectedProjectIds.length + selectedGroupIds.length
    if (totalSelected === 0) return

    const baseUrl = window.location.origin
    const items: ShareItem[] = []

    // Collect single image items
    selectedImageIds.forEach(id => {
      const item = allItems.find(i => i.type === 'image' && i.image.id === id)
      if (item && item.type === 'image') {
        items.push({
          id: id,
          title: item.image.filename || 'Image',
          link: `${baseUrl}/pensieve/saved/${id}`,
          type: 'image'
        })
      }
    })

    // Collect group items
    selectedGroupIds.forEach(groupId => {
      const item = allItems.find(i => i.type === 'group' && i.id === groupId)
      if (item && item.type === 'group') {
        // 그룹의 첫 번째 이미지 ID를 링크에 사용
        const firstImageId = item.images[0]?.id
        items.push({
          id: groupId,
          title: `${item.images.length} Images`,
          link: `${baseUrl}/pensieve/saved/${firstImageId || groupId}`,
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

  // Batch operation: Delete selected items
  const handleDeleteSelected = useCallback(async () => {
    const totalSelected = selectedImageIds.length + selectedProjectIds.length + selectedGroupIds.length
    if (totalSelected === 0 || isDeleting) return
    
    // Count actual items (groups contain multiple images)
    let totalImages = selectedImageIds.length
    const imageIdsInGroups: string[] = []
    selectedGroupIds.forEach(groupId => {
      const groupItem = allItems.find(i => i.type === 'group' && i.id === groupId)
      if (groupItem && groupItem.type === 'group') {
        totalImages += groupItem.images.length
        groupItem.images.forEach(img => {
          if (img.id) imageIdsInGroups.push(img.id)
        })
      }
    })
    
    if (!window.confirm(`Are you sure you want to delete ${totalImages} image(s) and ${selectedProjectIds.length} project(s)?`)) {
      return
    }

    setIsDeleting(true)
    
    // --- 최적화: 로컬 상태에서 즉시 제거 (Optimistic Update) ---
    // 삭제할 모든 이미지 ID들 (중복 제거)
    const allDeletedImageIds = Array.from(new Set([...selectedImageIds, ...imageIdsInGroups]))
    
    // 1. 프로젝트 상태 업데이트
    if (selectedProjectIds.length > 0) {
      setProjects(prev => prev.filter(p => !selectedProjectIds.includes(p.id)))
    }
    
    // 2. 이미지(metadata) 상태 업데이트
    if (allDeletedImageIds.length > 0) {
      setMetadata(prev => {
        const next: ImagesMetadata = {}
        Object.entries(prev).forEach(([folder, imageList]) => {
          next[folder] = imageList.filter(img => !img.id || !allDeletedImageIds.includes(img.id))
        })
        return next
      })
    }
    
    // 선택 해제 및 뷰어 닫기
    clearSelection()
    setIsProjectViewerOpen(false)

    try {
      const deletePromises: Promise<any>[] = []

      // Delete all selected images (single + groups)
      if (allDeletedImageIds.length > 0 && onDelete) {
        // onDelete(id, skipRefresh=true)를 호출하여 개별 리프레시 방지
        allDeletedImageIds.forEach(id => {
          const result = onDelete(id, true)
          deletePromises.push(result instanceof Promise ? result : Promise.resolve())
        })
      }
      
      // Delete all selected projects
      if (selectedProjectIds.length > 0) {
        selectedProjectIds.forEach(id => {
          deletePromises.push(handleProjectDelete(id, true))
        })
      }
      
      await Promise.all(deletePromises)
      
      // 모든 삭제 완료 후 마지막에 한 번만 리프레시 (DB 동기화 확인용)
      triggerRefresh()
    } catch (error) {
      console.error('Batch delete error:', error)
      alert('Failed to delete some items. Please try again.')
      // 에러 발생 시 원래대로 복구하는 로직이 있으면 좋지만, 복잡하므로 여기서는 생략
    } finally {
      setIsDeleting(false)
    }
  }, [selectedImageIds, selectedProjectIds, selectedGroupIds, allItems, onDelete, clearSelection, handleProjectDelete, isDeleting, triggerRefresh])

  const handleViewerNext = () => {
    if (!viewerImage || currentGroupImages.length === 0) return
    
    const nextIndex = (currentIndexInGroup + 1) % currentGroupImages.length
    const nextImage = currentGroupImages[nextIndex]
    
    setViewerImage(nextImage)
    
    try {
      const slug = generateImageSlugSync(nextImage.image)
      const newUrl = `/pensieve/saved/${slug}`
      window.history.replaceState({ imageSlug: slug, isModal: true }, '', newUrl)
    } catch (error) {
      console.error('Error updating URL:', error)
    }
  }

  const handleViewerPrevious = () => {
    if (!viewerImage || currentGroupImages.length === 0) return
    
    const prevIndex = (currentIndexInGroup - 1 + currentGroupImages.length) % currentGroupImages.length
    const prevImage = currentGroupImages[prevIndex]
    
    setViewerImage(prevImage)
    
    try {
      const slug = generateImageSlugSync(prevImage.image)
      const newUrl = `/pensieve/saved/${slug}`
      window.history.replaceState({ imageSlug: slug, isModal: true }, '', newUrl)
    } catch (error) {
      console.error('Error updating URL:', error)
    }
  }

  const handleViewerClose = () => {
    setIsViewerOpen(false)
    setViewerImage(null)
    restoreOriginalUrl()
  }

  const handleImageUpdate = useCallback((updatedImage: ImageMetadata) => {
    setMetadata((prev) => {
      const next: ImagesMetadata = {}
      Object.entries(prev).forEach(([folder, imageList]) => {
        next[folder] = imageList.map((img) =>
          img.id && updatedImage.id && img.id === updatedImage.id ? { ...img, ...updatedImage } : img
        )
      })
      return next
    })

    setViewerImage((prev) => {
      if (prev?.image?.id && updatedImage.id && prev.image.id === updatedImage.id) {
        return { ...prev, image: { ...prev.image, ...updatedImage } }
      }
      return prev
    })
  }, [])

  const currentItemIndex = useMemo(() => {
    if (!viewerImage) return -1
    return filteredItems.findIndex(item => {
      if (item.type === 'image') return item.image.id === viewerImage.image.id
      if (item.type === 'group') return item.images.some(img => img.id === viewerImage.image.id)
      return false
    })
  }, [viewerImage, filteredItems])

  const currentGroupImages = useMemo(() => {
    if (currentItemIndex < 0 || currentItemIndex >= filteredItems.length) return []
    const item = filteredItems[currentItemIndex]
    if (item.type === 'image') return [{ image: item.image, folder: item.folder }]
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
        {/* Empty state while loading */}
      </div>
    )
  }

  const hasNoItems = filteredItems.length === 0

  if (hasNoItems) {
    return (
      <div className="flex items-center justify-start py-20 ">
        <div className="text-left max-w-md">
          <h2 className="text-3xl font-semibold tracking-tight text-(--foreground) mb-4">
            No saved items yet.
          </h2>
          <p className="text-sm text-(--muted) mb-4">
            {isGuest ? 'Sign in to save images and projects.' : 'Images and projects you save will appear here.'}
          </p>
          {isGuest ? (
            <a 
              href="/login"
              className="text-blue-500 hover:underline cursor-pointer text-sm"
            >
              Sign in
            </a>
          ) : (
            <a 
              href="/pensieve"
              className="text-blue-500 hover:underline cursor-pointer text-sm"
            >
              Browse images 
            </a>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      <Masonry
        breakpointCols={{
          default: 5,
          1024: 4,
          640: 3,
          480: 2
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
                  isSelectionMode={isSelectionMode}
                  isSelected={selectedProjectIds.includes(item.project.id)}
                  onSelect={() => handleSelectProject(item.project.id)}
                  viewCount={getProjectViewCount(item.project.id)}
                  viewContext="cabinet"
                  likeCount={getProjectLikeCount(item.project.id)}
                />
              </div>
            )
          }

          if (item.type === 'group') {
            return (
              <div key={`group-${item.id}-${idx}`}>
                <MultiImageCard
                  images={item.images}
                  folder={item.folder}
                  onPreviewClick={(images, folder) => {
                    if (images.length > 0) {
                      handleImageClick(images[0], folder)
                    }
                  }}
                  isSelectionMode={isSelectionMode}
                  isSelected={selectedGroupIds.includes(item.id)}
                  onSelect={() => handleSelectGroup(item.id)}
                  viewCount={item.images[0]?.id ? getImageViewCount(item.images[0].id) : undefined}
                  viewContext="cabinet"
                  likeCount={item.images[0]?.id ? getImageLikeCount(item.images[0].id) : undefined}
                />
              </div>
            )
          }

          return (
            <div key={`${item.folder}-${item.image.path}-${idx}`}>
              <ImageCard
                image={item.image}
                folder={item.folder}
                onImageClick={handleImageClick}
                isSelectionMode={isSelectionMode}
                isSelected={item.image.id ? selectedImageIds.includes(item.image.id) : false}
                onSelect={item.image.id ? () => handleSelectImage(item.image.id!) : undefined}
                viewCount={item.image.id ? getImageViewCount(item.image.id) : undefined}
                viewContext="cabinet"
                likeCount={item.image.id ? getImageLikeCount(item.image.id) : undefined}
              />
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
          onCopyPrompt={onCopyPrompt}
          user={user}
          onDelete={onDelete}
          onImageUpdate={handleImageUpdate}
          viewContext="cabinet"
          onViewCountUpdate={viewerImage.image.id ? handleImageViewCountUpdate : undefined}
          onLikeCountUpdate={viewerImage.image.id ? handleImageLikeCountUpdate : undefined}
        />
      )}

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
          user={user}
          onProjectUpdate={handleProjectUpdate}
          initialSlideId={projectViewerSlideId}
          viewContext="cabinet"
          onViewCountUpdate={handleProjectViewCountUpdate}
          onLikeCountUpdate={handleProjectLikeCountUpdate}
        />
      )}

      <PensieveActionButtons
        onShare={handleShareSelected}
        onDelete={handleDeleteSelected}
        canShare={(selectedImageIds.length > 0 || selectedProjectIds.length > 0 || selectedGroupIds.length > 0) && !isGuest}
        canDelete={(selectedImageIds.length > 0 || selectedProjectIds.length > 0 || selectedGroupIds.length > 0) && !isGuest}
        isDeleting={isDeleting}
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
