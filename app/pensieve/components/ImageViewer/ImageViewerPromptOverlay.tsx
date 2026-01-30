'use client'

import React, { useMemo, useState, useEffect } from 'react'
import { Check, Loader2, ScrollText, Copy, Lock } from 'lucide-react'
import { getAdaptiveGlassStyleBlur } from '@/app/lib/adaptiveGlassStyle'
import { HumanPromptView } from '../UploadImageModal/ui/PromptRenderer'
import { JsonViewer } from '../UploadImageModal/ui/JsonViewer'
import { ImageMetadata as PromptImageMetadata } from '../UploadImageModal/types'
import { createClient } from '@/utils/supabase/client'

// 프로젝트 태그 컴포넌트
function ProjectTag({ projectId, slideId, currentUserId }: { projectId: string, slideId?: string, currentUserId: string | null }) {
  const [projectInfo, setProjectInfo] = useState<{ isPublic: boolean, name: string | null, ownerId: string | null } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkProject = async () => {
      try {
        const response = await fetch(`/api/pensieve/projects/${projectId}`)
        if (response.ok) {
          const data = await response.json()
          setProjectInfo({ 
            isPublic: data.project.is_public, 
            name: data.project.name,
            ownerId: data.project.user_id
          })
        } else {
          // 프로젝트를 불러올 수 없는 경우 (권한 없음 등)
          setProjectInfo({ isPublic: false, name: null, ownerId: null })
        }
      } catch (error) {
        console.error('Error checking project status:', error)
        setProjectInfo({ isPublic: false, name: null, ownerId: null })
      } finally {
        setLoading(false)
      }
    }
    checkProject()
  }, [projectId])

  const onProjectClick = async () => {
    try {
      const [projectResponse, slidesResponse] = await Promise.all([
        fetch(`/api/pensieve/projects/${projectId}`),
        fetch(`/api/pensieve/projects/${projectId}/slides`)
      ])

      if (!projectResponse.ok || !slidesResponse.ok) {
        throw new Error('Failed to load project')
      }

      const projectData = await projectResponse.json()
      const slidesData = await slidesResponse.json()

      // 프로젝트 뷰어 열기
      const projectUrl = `/pensieve/projects/${projectId}`
      window.history.pushState({ projectId, isModal: true }, '', projectUrl)

      // 부모 컴포넌트에 프로젝트 뷰어 열기 이벤트 전달
      if (typeof window !== 'undefined') {
        const channel = new BroadcastChannel('pensieve-open-project')
        channel.postMessage({ 
          type: 'open-project', 
          projectId,
          project: projectData.project,
          slides: slidesData.slides || [],
          slideId // 특정 슬라이드로 이동
        })
        channel.close()
      }
    } catch (error) {
      console.error('Error loading project:', error)
      alert('Failed to load project')
    }
  }

  if (loading) {
    return (
      <div className="mb-4 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white/50 text-xs font-medium flex items-center gap-2">
        <Loader2 size={12} className="animate-spin" />
        <span>Checking project...</span>
      </div>
    )
  }

  const isOwner = currentUserId && projectInfo?.ownerId && currentUserId === projectInfo.ownerId
  if (projectInfo && !projectInfo.isPublic && !isOwner) {
    return (
      <div className="mb-4 px-3 py-1.5 rounded-full bg-white/5 backdrop-blur-md border border-white/10 text-white/40 text-xs font-medium flex items-center gap-1.5">
        <Lock size={12} />
        <span>Edited in a private project</span>
      </div>
    )
  }

  return (
    <button
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onProjectClick()
      }}
      className="mb-4 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-white/90 text-xs font-semibold cursor-pointer flex items-center gap-1.5 hover:bg-black/80 transition-colors duration-200 shadow-xl group/tag"
    >
      <div className="flex items-center justify-center w-4 h-4 rounded-full bg-white/10 group-hover/tag:bg-white/20 transition-colors">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
      </div>
      <span>View in Project</span>
    </button>
  )
}

interface ImageViewerPromptOverlayProps {
  isOverlayVisible: boolean
  setIsOverlayVisible: (visible: boolean) => void
  setShowCopyButton: (show: boolean) => void
  setPromptError: (error: string | null) => void
  setIsPromptGenerating: (generating: boolean) => void
  displayImageUrl: string
  imageUrl: string
  image: any
  availablePrompts: any[]
  promptType: string
  setPromptType: (type: any) => void
  promptLabels: Record<string, string>
  jsonObject: any
  currentPrompt: string
  renderJsonValue: (value: any) => React.ReactNode
  isPromptGenerating: boolean
  handleGeneratePrompt: (e: any) => void
  promptError: string | null
  handleCopyPrompt: () => void
  copied: boolean
  promptOverlayRef: React.RefObject<HTMLDivElement | null>
}

export default function ImageViewerPromptOverlay({
  isOverlayVisible,
  setIsOverlayVisible,
  setShowCopyButton,
  setPromptError,
  setIsPromptGenerating,
  displayImageUrl,
  imageUrl,
  image,
  availablePrompts,
  promptType,
  setPromptType,
  promptLabels,
  jsonObject,
  currentPrompt,
  renderJsonValue,
  isPromptGenerating,
  handleGeneratePrompt,
  promptError,
  handleCopyPrompt,
  copied,
  promptOverlayRef
}: ImageViewerPromptOverlayProps) {
  
  const supabase = createClient()
  const [referenceImages, setReferenceImages] = useState<PromptImageMetadata[]>([])
  const [isPrivateProject, setIsPrivateProject] = useState(false)
  const [isCheckingProject, setIsCheckingProject] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // Check project privacy status
  useEffect(() => {
    const checkProjectStatus = async () => {
      const projectId = image?.metadata?.projectId
      if (!projectId) {
        setIsPrivateProject(false)
        return
      }

      setIsCheckingProject(true)
      try {
        const [projectResponse, userResponse] = await Promise.all([
          fetch(`/api/pensieve/projects/${projectId}`),
          supabase.auth.getUser()
        ])

        const user = userResponse.data.user
        setCurrentUserId(user?.id || null)

        if (projectResponse.ok) {
          const data = await projectResponse.json()
          const isOwner = user && user.id === data.project.user_id
          setIsPrivateProject(!data.project.is_public && !isOwner)
        } else if (projectResponse.status === 404 || projectResponse.status === 401 || projectResponse.status === 403) {
          // 권한이 없거나 찾을 수 없는 경우 비공개로 간주
          setIsPrivateProject(true)
        }
      } catch (error) {
        console.error('Error checking project privacy:', error)
        setIsPrivateProject(true)
      } finally {
        setIsCheckingProject(false)
      }
    }

    checkProjectStatus()
  }, [image, supabase])

  // Convert reference images from metadata to PromptImageMetadata format and load URLs
  useEffect(() => {
    const loadReferenceImages = async () => {
      if (!image?.metadata || isPrivateProject) {
        setReferenceImages([])
        return
      }

      // Parse referenceImages - it might be a string (from Supabase JSONB) or an array
      let refImagesArray: any[] = []
      const refImagesRaw = image.metadata.referenceImages
      
      if (!refImagesRaw) {
        setReferenceImages([])
        return
      }

      // Handle string (JSONB from Supabase)
      if (typeof refImagesRaw === 'string') {
        try {
          refImagesArray = JSON.parse(refImagesRaw)
        } catch (error) {
          console.warn('Failed to parse referenceImages as JSON:', error)
          setReferenceImages([])
          return
        }
      } else if (Array.isArray(refImagesRaw)) {
        refImagesArray = refImagesRaw
      } else {
        setReferenceImages([])
        return
      }

      if (refImagesArray.length === 0) {
        setReferenceImages([])
        return
      }

      console.log('[ImageViewerPromptOverlay] Reference images found:', refImagesArray.length, refImagesArray)

      // Load Supabase Storage URLs for reference images
      const loadedImages = await Promise.all(
        refImagesArray.map(async (ref: any) => {
          // path가 있으면 이를 사용하여 signed URL 생성 시도
          const storagePath = ref.path || ref.blobUrl
          const bucketName = ref.bucketName || 'saved-gallery'
          
          // storagePath가 Supabase 경로인지 확인 (http로 시작하지 않으면 경로로 간주)
          if (storagePath && !storagePath.startsWith('http')) {
            try {
              // Generate signed URL from Supabase Storage
              const { data: signedData, error } = await supabase.storage
                .from(bucketName)
                .createSignedUrl(storagePath, 24 * 60 * 60)
              
              if (signedData?.signedUrl && !error) {
                return {
                  blobUrl: signedData.signedUrl,
                  base64: ref.base64 || '',
                  order: ref.order
                }
              }
            } catch (error) {
              console.warn('Failed to load reference image from Supabase Storage:', storagePath, error)
            }
          }
          
          // Supabase 경로가 아니거나 실패한 경우 기존 URL 사용
          if (ref.blobUrl && ref.blobUrl.startsWith('http')) {
            return {
              blobUrl: ref.blobUrl,
              base64: ref.base64 || '',
              order: ref.order
            }
          }

          // Fallback to originalUrl if Supabase Storage URL generation fails
          if (ref.originalUrl) {
            return {
              blobUrl: ref.originalUrl,
              base64: ref.base64 || '',
              order: ref.order
            }
          }
          
          // Last resort: use blobUrl as-is
          return {
            blobUrl: ref.blobUrl,
            base64: ref.base64 || '',
            order: ref.order
          }
        })
      )

      setReferenceImages(loadedImages)
    }

    loadReferenceImages()
  }, [image, supabase])

  if (availablePrompts.length === 0) return null

  return (
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
          setPromptError(null)
          setIsPromptGenerating(false)
        }
      }}
    >
      {/* Background */}
      {imageUrl && (
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
              src={imageUrl}
              alt={image?.prompt ? (typeof image.prompt === 'string' ? image.prompt : (typeof image.prompt === 'object' && image.prompt !== null ? JSON.stringify(image.prompt) : 'Generated image')) : 'Generated image'}
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
        {/* Done / close button */}
        <button
          className="absolute top-4 right-4 z-30 w-10 h-10 rounded-full flex items-center justify-center cursor-pointer"
          style={{
            color: 'white',
            backgroundColor: '#007AFF',
            border: '1px solid #007AFF',
            boxShadow:
              '0 8px 40px rgba(0, 122, 255, 0.3), 0 4px 20px rgba(0, 122, 255, 0.2), 0 2px 8px rgba(0, 122, 255, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
          }}
          onClick={(e) => {
            e.stopPropagation()
            setIsOverlayVisible(false)
            setShowCopyButton(false)
            setPromptError(null)
            setIsPromptGenerating(false)
          }}
        >
          <Check size={18} />
        </button>
        
        {/* Prompt type tabs */}
        {!isPrivateProject && availablePrompts.length > 1 && (
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
        )}

        <div className="flex flex-col items-center w-full flex-1 min-h-0">
          <div className="w-full flex justify-center flex-1 min-h-0 overflow-hidden pt-10 sm:pt-28 pb-22 sm:pb-28">
            <div className="max-w-3xl w-full h-full overflow-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden px-2 flex items-start justify-center">
              {isCheckingProject ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3 text-white/40">
                  <Loader2 size={24} className="animate-spin" />
                  <span className="text-sm font-medium">Checking project status...</span>
                </div>
              ) : isPrivateProject ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4 text-white/50">
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl">
                    <Lock size={32} className="opacity-40" />
                  </div>
                  <div className="text-center space-y-1">
                    <h3 className="text-lg font-semibold text-white/90">Private Prompt</h3>
                    <p className="text-sm">Edited in a private project</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Human Prompt */}
                  {promptType === 'prompt' && (
                    jsonObject ? (
                      <div className="text-base md:text-lg font-medium leading-relaxed text-white w-full text-left">
                        <JsonViewer data={jsonObject} />
                      </div>
                    ) : currentPrompt ? (
                      <div className="text-base md:text-lg font-medium leading-relaxed text-white w-full text-left py-8">
                        {(() => {
                          // 프로젝트 정보 확인
                          const projectId = image?.metadata?.projectId
                          const slideId = image?.metadata?.slideId
                          
                          return (
                            <div className="w-full">
                              {/* 프로젝트 태그 */}
                              {projectId && (
                                <ProjectTag 
                                  projectId={projectId} 
                                  slideId={slideId}
                                  currentUserId={currentUserId}
                                />
                              )}
                              
                              {/* Debug logging */}
                              {currentPrompt.includes('[image') && (
                                <>
                                  {console.log('[ImageViewerPromptOverlay] Prompt contains [image]:', currentPrompt.substring(0, 100))}
                                  {console.log('[ImageViewerPromptOverlay] Reference images:', referenceImages)}
                                </>
                              )}
                              
                              <HumanPromptView 
                                prompt={currentPrompt} 
                                images={referenceImages}
                              />
                            </div>
                          )
                        })()}
                      </div>
                    ) : (
                      <div className="text-white/50 text-left py-8">
                        No prompt provided
                      </div>
                    )
                  )}

                  {/* AI Prompt */}
                  {promptType === 'ai_prompt' && currentPrompt && (
                    <p className="text-base md:text-lg font-medium leading-relaxed text-white whitespace-pre-wrap w-full text-center py-8">
                      {currentPrompt}
                    </p>
                  )}

                  {/* AI JSON */}
                  {promptType === 'ai_json_prompt' && jsonObject && (
                    <div className="text-base md:text-lg font-medium leading-relaxed text-white w-full text-left">
                      <JsonViewer data={jsonObject} />
                    </div>
                  )}

                  {/* Generate button for AI prompt */}
                  {promptType === 'ai_prompt' && !currentPrompt && (
                    <div className="flex justify-center py-8">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleGeneratePrompt(e)
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

                  {/* Generate button for AI JSON */}
                  {promptType === 'ai_json_prompt' && !jsonObject && (
                    <div className="flex justify-center py-8">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleGeneratePrompt(e)
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
                </>
              )}
            </div>
          </div>
        </div>

        {/* Copy button */}
        {!isPrivateProject && currentPrompt && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2">
            {promptError && (
              <div className="mb-1 px-3 py-1.5 rounded-full bg-red-500/80 text-xs text-white">
                {promptError}
              </div>
            )}
            <div className="flex items-center gap-3">
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
          </div>
        )}
      </div>
    </div>
  )
}

