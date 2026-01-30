'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { useLoading } from '@/app/lib/LoadingContext'

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

// 편집할 프로젝트 데이터
interface EditingProject {
  id: string
  user_id: string
  name: string | null
  thumbnail_url: string | null
  thumbnail_path: string | null
  original_image_url: string | null
  original_image_path: string | null
  original_bucket_name: string
  prompt: string | null
  ai_prompt: string | null
  ai_json_prompt: any
  selected_model: string
  slide_count: number
  is_public: boolean
  created_at: string
  updated_at: string
  slides: ProjectSlide[]
}

interface PensieveContextType {
  user: any
  isLoading: boolean
  searchQuery: string
  setSearchQuery: (query: string) => void
  refreshToken: number
  triggerRefresh: () => void
  lastUploaded: any
  setLastUploaded: (data: any) => void
  uploadSuccess: string | null
  setUploadSuccess: (message: string | null) => void
  // 프로젝트 편집 관련
  editingProjectId: string | null
  editingProject: EditingProject | null
  isLoadingProject: boolean
  initialSlideId: string | null
  openProjectForEdit: (projectId: string, initialSlideId?: string) => void
  clearEditingProject: () => void
  isUploadModalOpen: boolean
  setIsUploadModalOpen: (open: boolean) => void
  // 섹션 관리
  activeSection: 'all' | 'saved'
  setActiveSection: (section: 'all' | 'saved') => void
  // 모바일 네비게이션 확장 상태 (동기화용)
  mobileNavExpanded: boolean
  setMobileNavExpanded: (expanded: boolean) => void
}

const PensieveContext = createContext<PensieveContextType | undefined>(undefined)

export function usePensieve() {
  const context = useContext(PensieveContext)
  if (context === undefined) {
    throw new Error('usePensieve must be used within a PensieveProvider')
  }
  return context
}

export function PensieveProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [refreshToken, setRefreshToken] = useState(0)
  const [lastUploaded, setLastUploaded] = useState<any | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null)
  
  // 프로젝트 편집 상태
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null)
  const [editingProject, setEditingProject] = useState<EditingProject | null>(null)
  const [isLoadingProject, setIsLoadingProject] = useState(false)
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [initialSlideId, setInitialSlideId] = useState<string | null>(null)
  
  // 섹션 관리 (Cabinet/Strands)
  const [activeSection, setActiveSection] = useState<'all' | 'saved'>('all')
  
  // 모바일 네비게이션 확장 상태 (동기화용)
  const [mobileNavExpanded, setMobileNavExpanded] = useState(true)
  
  const { setIsLoading: setAppLoading } = useLoading()
  const router = useRouter()
  const supabase = createClient()

  const triggerRefresh = () => {
    setRefreshToken((prev) => prev + 1)
  }

  // 프로젝트 편집 열기
  const openProjectForEdit = useCallback(async (projectId: string, slideId?: string) => {
    console.log('[PensieveContext] openProjectForEdit called with projectId:', projectId, 'slideId:', slideId)
    setEditingProjectId(projectId)
    setInitialSlideId(slideId || null)
    setIsLoadingProject(true)
    
    try {
      // 편집 모드 진입 시 updated_at 즉시 업데이트 (최상단 배치를 위해)
      try {
        await fetch(`/api/pensieve/projects/${projectId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updateTimestamp: true })
        })
      } catch (error) {
        console.error('Failed to update project timestamp:', error)
        // 타임스탬프 업데이트 실패해도 프로젝트 로드는 계속 진행
      }

      const response = await fetch(`/api/pensieve/projects/${projectId}`)
      if (!response.ok) {
        throw new Error('Failed to load project')
      }
      
      const data = await response.json()
      console.log('[PensieveContext] Project data loaded:', data.project?.id, 'slides:', data.slides?.length)
      
      const projectData = {
        ...data.project,
        slides: data.slides || []
      }
      
      // 프로젝트 데이터 설정
      setEditingProject(projectData)
      
      // URL 업데이트 - 프로젝트 편집 모드로 표시
      const projectUrl = `/pensieve/projects/${projectId}`
      // 현재 URL이 이미 프로젝트 URL이 아닐 때만 업데이트 (중복 업데이트 방지)
      if (typeof window !== 'undefined' && !window.location.pathname.includes(`/pensieve/projects/${projectId}`)) {
        window.history.pushState({ projectId, isEditMode: true }, '', projectUrl)
        console.log('[PensieveContext] URL updated to:', projectUrl)
      }
      
      // 상태 업데이트가 완료된 후 모달 열기 (다음 틱에서 실행)
      // React의 상태 업데이트는 비동기이므로, 다음 렌더링 사이클에서 모달 열기
      requestAnimationFrame(() => {
        setTimeout(() => {
          console.log('[PensieveContext] Opening modal after project data is set')
          setIsUploadModalOpen(true)
        }, 0)
      })
    } catch (error) {
      console.error('Error loading project for edit:', error)
      setEditingProjectId(null)
      setEditingProject(null)
    } finally {
      setIsLoadingProject(false)
    }
  }, [])
  
  // editingProject가 설정되면 자동으로 모달 열기 (추가 안전장치)
  useEffect(() => {
    if (editingProject && editingProjectId && !isUploadModalOpen) {
      console.log('[PensieveContext] Auto-opening modal because editingProject is set')
      setIsUploadModalOpen(true)
    }
  }, [editingProject, editingProjectId, isUploadModalOpen])

  // 프로젝트 편집 종료
  const clearEditingProject = useCallback(() => {
    // URL 복원 - 프로젝트 편집 모드에서 나갈 때
    if (typeof window !== 'undefined' && window.history.state?.isEditMode) {
      window.history.back()
    }
    setEditingProjectId(null)
    setEditingProject(null)
    setInitialSlideId(null)
  }, [])
  
  // 브라우저 뒤로가기 처리: 프로젝트 편집 모드에서 나갈 때 모달 닫기
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      // 프로젝트 편집 모드에서 뒤로가기를 눌렀을 때
      if (editingProjectId && !event.state?.isEditMode) {
        setIsUploadModalOpen(false)
        clearEditingProject()
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [editingProjectId, clearEditingProject])

  // Load user on mount
  useEffect(() => {
    const loadUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        
        if (!user) {
          // Guest User
          const guestUser = {
            id: 'anonymous',
            email: 'guest@chatflix.app',
            user_metadata: {
              full_name: 'Guest User',
              name: 'Guest'
            },
            isAnonymous: true
          }
          setUser(guestUser)
        } else {
          setUser(user)
        }
      } catch (error) {
        console.error('Error loading user:', error)
        // Guest User Fallback
        const guestUser = {
          id: 'anonymous',
          email: 'guest@chatflix.app',
          user_metadata: {
            full_name: 'Guest User',
            name: 'Guest'
          },
          isAnonymous: true
        }
        setUser(guestUser)
      } finally {
        setIsLoading(false)
        setAppLoading(false)
      }
    }

    // Only set global loading if we don't have user yet
    if (!user) {
      setAppLoading(true)
    }
    loadUser()
  }, [supabase, setAppLoading])

  return (
    <PensieveContext.Provider
      value={{
        user,
        isLoading,
        searchQuery,
        setSearchQuery,
        refreshToken,
        triggerRefresh,
        lastUploaded,
        setLastUploaded,
        uploadSuccess,
        setUploadSuccess,
        // 프로젝트 편집 관련
        editingProjectId,
        editingProject,
        isLoadingProject,
        initialSlideId,
        openProjectForEdit,
        clearEditingProject,
        isUploadModalOpen,
        setIsUploadModalOpen,
        // 섹션 관리
        activeSection,
        setActiveSection,
        // 모바일 네비게이션 확장 상태 (동기화용)
        mobileNavExpanded,
        setMobileNavExpanded
      }}
    >
      {children}
    </PensieveContext.Provider>
  )
}
