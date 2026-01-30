'use client'

import { use, useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { usePensieve } from '../../context/PensieveContext'
import { useLoading } from '@/app/lib/LoadingContext'
import { Lock } from 'lucide-react'
import ProjectViewer from '../../components/ProjectViewer/ProjectViewer'
import { ProjectMetadata } from '../../components/ProjectCard'

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { openProjectForEdit, user, isLoading: contextLoading } = usePensieve()
  const { setIsLoading: setAppLoading } = useLoading()
  const [project, setProject] = useState<ProjectMetadata | null>(null)
  const [slides, setSlides] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isPrivate, setIsPrivate] = useState(false)
  const [isViewerOpen, setIsViewerOpen] = useState(false)

  // Load project on mount
  useEffect(() => {
    const loadProject = async () => {
      try {
        setAppLoading(true)
        setError(null)
        setIsPrivate(false)

        // 프로젝트와 슬라이드 동시 조회
        const [projectRes, slidesRes] = await Promise.all([
          fetch(`/api/pensieve/projects/${id}`),
          fetch(`/api/pensieve/projects/${id}/slides`)
        ])
        
        if (!projectRes.ok) {
          const data = await projectRes.json().catch(() => ({}))
          
          if (projectRes.status === 403 || (projectRes.status === 404 && data.error?.includes('not owned'))) {
            setIsPrivate(true)
            setError('This project is private')
          } else if (projectRes.status === 404) {
            setError('Project not found')
          } else {
            setError('Failed to load project')
          }
          return
        }

        const projectData = await projectRes.json()
        const slidesData = await slidesRes.json()

        setProject(projectData.project)
        setSlides(slidesData.slides || [])
        setIsViewerOpen(true)
      } catch (error) {
        console.error('Error loading project:', error)
        setError('Failed to load project')
      } finally {
        setAppLoading(false)
      }
    }

    if (id && !contextLoading) {
      loadProject()
    }
  }, [id, contextLoading, setAppLoading])

  const handleClose = () => {
    router.push('/pensieve')
  }

  const handleEdit = useCallback(async (projectId: string) => {
    setIsViewerOpen(false)
    await openProjectForEdit(projectId)
  }, [openProjectForEdit])

  const handleDelete = useCallback(async (projectId: string) => {
    try {
      const response = await fetch(`/api/pensieve/projects/${projectId}`, {
        method: 'DELETE'
      })
      if (!response.ok) throw new Error('Failed to delete project')
      router.push('/pensieve')
    } catch (error) {
      console.error('Error deleting project:', error)
      alert('Failed to delete project')
    }
  }, [router])

  const handleTogglePublic = useCallback(async (projectId: string, isPublic: boolean) => {
    try {
      const response = await fetch(`/api/pensieve/projects/${projectId}/toggle-public`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublic })
      })
      if (!response.ok) throw new Error('Failed to toggle public status')
      
      setProject(prev => prev ? { ...prev, is_public: isPublic } : null)
    } catch (error) {
      console.error('Error toggling public status:', error)
      throw error
    }
  }, [])

  if (contextLoading) {
    return null
  }

  if (error) {
    // Private project - show informative UI
    if (isPrivate) {
      return (
        <div className="min-h-screen flex items-center justify-center text-[var(--foreground)]" style={{ backgroundColor: 'var(--background)' }}>
          <div className="text-center max-w-md px-6">
            {/* Lock Icon */}
            <div className="mb-6 flex justify-center">
              <div className="w-20 h-20 rounded-full bg-[var(--subtle-divider)] flex items-center justify-center">
                <Lock className="w-10 h-10 text-[var(--muted)]" />
              </div>
            </div>
            
            {/* Title */}
            <h1 className="text-2xl font-semibold mb-3">Private Project</h1>
            
            {/* Description */}
            <p className="text-[var(--muted)] mb-2">
              This project is set to private by its owner.
            </p>
            <p className="text-[var(--muted)] text-sm mb-8">
              Only the owner can view this project. If you believe this is an error, please contact{' '}
              <a
                href="mailto:sply@chatflix.app"
                className="font-bold text-blue-500 hover:text-blue-600 transition-colors cursor-pointer"
              >
                sply@chatflix.app
              </a>
              {' '}or sign in with the correct account.
            </p>
            
            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => router.push('/login')}
                className="px-5 py-2.5 bg-[var(--foreground)] text-[var(--background)] rounded-lg hover:opacity-90 transition-opacity font-medium"
              >
                Sign In
              </button>
              <button
                onClick={() => router.push('/pensieve')}
                className="px-5 py-2.5 border border-[var(--subtle-divider)] text-[var(--foreground)] rounded-lg hover:bg-[var(--subtle-divider)] transition-colors font-medium"
              >
                Browse Gallery
              </button>
            </div>
          </div>
        </div>
      )
    }

    // Generic error - project not found
    return (
      <div className="min-h-screen flex items-center justify-center text-[var(--foreground)]" style={{ backgroundColor: 'var(--background)' }}>
        <div className="text-center max-w-md px-6">
          {/* Icon */}
          <div className="mb-6 flex justify-center">
            <div className="w-20 h-20 rounded-full bg-[var(--subtle-divider)] flex items-center justify-center">
              <svg className="w-10 h-10 text-[var(--muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
          
          {/* Title */}
          <h1 className="text-2xl font-semibold mb-3">Project Not Found</h1>
          
          {/* Description */}
          <p className="text-[var(--muted)] mb-8">
            {error || 'The project you are looking for does not exist or may have been removed.'}
          </p>
          
          {/* Action */}
          <button
            onClick={() => router.push('/pensieve')}
            className="px-5 py-2.5 bg-[var(--foreground)] text-[var(--background)] rounded-lg hover:opacity-90 transition-opacity font-medium"
          >
            Browse Gallery
          </button>
        </div>
      </div>
    )
  }

  if (!project || !isViewerOpen) {
    return null
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--background)' }}>
      <ProjectViewer
        project={project}
        slides={slides}
        isOpen={isViewerOpen}
        onClose={handleClose}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onTogglePublic={handleTogglePublic}
        user={user}
      />
    </div>
  )
}

