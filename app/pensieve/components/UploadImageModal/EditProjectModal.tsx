'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import dynamic from 'next/dynamic'
import { Mode, PromptType, EditSlide } from './types'
import { useContentEditable } from './hooks/useContentEditable'
import { useGallery } from './hooks/useGallery'
import { useGeneration } from './hooks/useGeneration'
import { useUploadLogic } from './hooks/useUploadLogic'
import { GeneratingView } from './ui/GeneratingView'
import { ViewerEditMode } from './ui/ViewerEditMode'
import { PromptOverlay } from './ui/PromptOverlay'
import { SlideHistory } from './ui/SlideHistory'
import { GalleryPreview } from './ui/GalleryPreview'
import { VisibilitySelector } from './ui/VisibilitySelector'
import { getAdaptiveGlassStyleBlur, getTextStyle, getInitialTheme } from '@/app/lib/adaptiveGlassStyle'
import { X, Check } from 'lucide-react'
import Image from 'next/image'
import { usePensieve } from '../../context/PensieveContext'
import { getModelIcon } from './ui/Controls'

const PensieveWaterBackground = dynamic(() => import('../PensieveWaterBackground'), {
  ssr: false,
  loading: () => null
})

interface EditProjectModalProps {
  isOpen: boolean
  onClose: () => void
  onUploadComplete: (metadata: any) => void
  user?: any
  editingProject: any
  editingProjectId: string | null
  clearEditingProject: () => void
}

export default function EditProjectModal({ 
  isOpen, 
  onClose, 
  onUploadComplete, 
  user,
  editingProject,
  editingProjectId,
  clearEditingProject
}: EditProjectModalProps) {
  const [isMounted, setIsMounted] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [panelElements, setPanelElements] = useState({ background: false, content: false })
  const [isMobile, setIsMobile] = useState(false)
  const [selectedModel, setSelectedModel] = useState<'nano-banana-pro' | 'seadream-4.5' | 'gpt-image-1.5' | 'qwen-image-edit-2511'>('nano-banana-pro')
  const [showModelSelector, setShowModelSelector] = useState(false)
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(null)
  const modelSelectorRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [isProjectLoaded, setIsProjectLoaded] = useState(false)

  // Local UI states
  const [isDragging, setIsDragging] = useState(false)

  // 슬라이드별 인풋 상태 관리
  interface SlideInputState {
    prompt: string
    images: Map<string, { blobUrl: string; base64: string; file: File }>
  }
  const [slideInputs, setSlideInputs] = useState<Map<string, SlideInputState>>(new Map())

  const { initialSlideId } = usePensieve()
  
  const contentEditableHook = useContentEditable()
  const generationHook = useGeneration(user, selectedModel)
  
  const uploadLogic = useUploadLogic(
    user, selectedModel, onUploadComplete, onClose,
    generationHook, contentEditableHook, {} as any,
    undefined, // onProjectCreated - 편집 모드에서는 불필요
    editingProjectId // 편집 중인 프로젝트 ID 전달
  )

  const galleryHook = useGallery(isOpen, uploadLogic.mode)

  const {
    mode: currentMode, setMode: setCurrentMode, imageUrl, imagePath, originalImageUrl,
    originalImagePath, latestMetadata, humanPrompt, setHumanPrompt, isPublic, setIsPublic,
    isOriginalSaved, error, setError, isSaving, handleFinalSave, isPromptGenerating,
    promptError, setPromptError,
    generatingPrompt, setGeneratingPrompt, generatingImages, handleGenerateImage,
    handleExtractPrompt,
    setImageUrl, setImagePath, setOriginalImageUrl, setOriginalImagePath, setLatestMetadata,
    fileInputRef
  } = uploadLogic

  const [showPromptOverlay, setShowPromptOverlay] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showVisibilitySelector, setShowVisibilitySelector] = useState(false)
  const [promptType, setPromptType] = useState<PromptType>('prompt')
  const [viewingImageId, setViewingImageId] = useState<string | null>(null)
  const [viewingImageUrl, setViewingImageUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setIsMounted(true)
    if (isOpen) {
      setIsVisible(true)
      setTimeout(() => setPanelElements({ background: true, content: true }), 10)
    }
  }, [isOpen])

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // 프로젝트 편집 모드: editingProject가 설정되면 슬라이드 로드
  useEffect(() => {
    if (!isOpen || !editingProject || !editingProject.slides || editingProject.slides.length === 0) {
      return
    }

    // 이미 로드된 프로젝트는 다시 로드하지 않음
    if (isProjectLoaded) {
      return
    }

    console.log('[EditProjectModal] Loading project for edit:', editingProjectId, 'slides:', editingProject.slides?.length)

    const loadProjectSlides = async () => {
      try {
        // 프로젝트 슬라이드를 EditSlide 형식으로 변환
        const loadedSlides: EditSlide[] = editingProject.slides.map((slide: any) => {
          console.log('[EditProjectModal] Loading slide:', slide.id, 'ai_json_prompt:', slide.ai_json_prompt)
          return {
            id: slide.id,
            imageUrl: slide.image_url,
            path: slide.image_path,
            prompt: slide.prompt || '',
            isOriginal: slide.is_original || false,
            isGenerating: false,
            isSaved: false, // 저장 여부는 저장 버튼 클릭 시에만 추적
            timestamp: slide.created_at,
            parentSlideId: slide.parent_slide_id,
            ai_prompt: slide.ai_prompt || undefined,
            ai_json_prompt: slide.ai_json_prompt || undefined,
            editImages: undefined // 편집 시 추가된 이미지는 없음
          }
        })

        console.log('[EditProjectModal] Setting slides:', loadedSlides.length)
        
        // 슬라이드 설정
        generationHook.setEditSlides(loadedSlides)
        
        // initialSlideId가 있으면 해당 슬라이드로 설정, 없으면 마지막 슬라이드로 설정
        let targetSlideIndex: number
        if (initialSlideId) {
          const slideIndex = loadedSlides.findIndex(s => s.id === initialSlideId)
          if (slideIndex >= 0) {
            targetSlideIndex = slideIndex
            console.log('[EditProjectModal] Setting to slide index:', slideIndex, 'slideId:', initialSlideId)
          } else {
            // 슬라이드를 찾지 못한 경우 마지막 슬라이드로 폴백
            targetSlideIndex = loadedSlides.length - 1
            console.log('[EditProjectModal] Slide not found, falling back to last slide')
          }
        } else {
          // 기존 동작: 마지막 슬라이드
          targetSlideIndex = loadedSlides.length - 1
          console.log('[EditProjectModal] No initialSlideId, using last slide')
        }
        generationHook.setCurrentSlideIndex(targetSlideIndex)

        // 타겟 슬라이드 정보로 초기 상태 설정
        const targetSlide = loadedSlides[targetSlideIndex]
        if (targetSlide) {
          setImageUrl(targetSlide.imageUrl)
          setImagePath(targetSlide.path)
          
          // 원본 슬라이드 찾기
          const originalSlide = loadedSlides.find(s => s.isOriginal) || targetSlide
          setOriginalImageUrl(originalSlide.imageUrl)
          setOriginalImagePath(originalSlide.path)

          // 메타데이터 설정
          setLatestMetadata({
            prompt: editingProject.prompt || targetSlide.prompt,
            originalPrompt: editingProject.prompt || targetSlide.prompt,
            ai_prompt: editingProject.ai_prompt || targetSlide.ai_prompt,
            ai_json_prompt: editingProject.ai_json_prompt || targetSlide.ai_json_prompt,
            originalPromptImages: [] // 프로젝트에는 원본 프롬프트 이미지가 없을 수 있음
          })

          // 프롬프트 설정
          setHumanPrompt(editingProject.prompt || targetSlide.prompt || '')
          
          // 공개 설정
          setIsPublic(editingProject.is_public ?? null)
          
          // 모델 선택
          if (editingProject.selected_model) {
            setSelectedModel(editingProject.selected_model as 'nano-banana-pro' | 'seadream-4.5' | 'gpt-image-1.5')
          }

          // 모드를 edit로 변경 (프로젝트 편집 시 바로 편집 모드로 진입)
          setCurrentMode('edit')
          setIsProjectLoaded(true)
        }
      } catch (error) {
        console.error('[EditProjectModal] Error loading project:', error)
        setError('Failed to load project slides')
      }
    }

    loadProjectSlides()
  }, [editingProject, editingProjectId, initialSlideId, isOpen, isProjectLoaded, generationHook.setEditSlides, generationHook.setCurrentSlideIndex, setCurrentMode, setImageUrl, setImagePath, setOriginalImageUrl, setOriginalImagePath, setLatestMetadata, setHumanPrompt, setIsPublic, setSelectedModel, setError])

  // 모달이 닫히면 프로젝트 로드 상태 초기화
  useEffect(() => {
    if (!isOpen) {
      setIsProjectLoaded(false)
    }
  }, [isOpen])

  // 슬라이드 변경 시 인풋창 비우기 (사용자가 직접 입력하지 않는 이상 항상 비어있어야 함)
  const prevSlideIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (!isOpen || !isProjectLoaded || generationHook.editSlides.length === 0) return
    
    const currentSlideIndex = generationHook.currentSlideIndex
    const currentSlide = generationHook.editSlides[currentSlideIndex]
    
    // 슬라이드 ID가 실제로 변경되었을 때만 실행
    if (currentSlide && prevSlideIdRef.current !== currentSlide.id) {
      prevSlideIdRef.current = currentSlide.id
      
      // 슬라이드 변경 시 인풋창을 항상 비움
      setHumanPrompt('')
      contentEditableHook.setEditInsertedImages(new Map())
      
      // contentEditable의 내용도 비우기
      if (contentEditableHook.editContentEditableRef.current) {
        contentEditableHook.editContentEditableRef.current.innerHTML = ''
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generationHook.currentSlideIndex, isOpen, isProjectLoaded, generationHook.editSlides])

  // editInsertedImages 변경 시 슬라이드별 상태에 저장 (슬라이드 변경으로 인한 업데이트는 제외)
  useEffect(() => {
    if (!isOpen || !isProjectLoaded || generationHook.editSlides.length === 0) return
    
    const currentSlide = generationHook.editSlides[generationHook.currentSlideIndex]
    if (!currentSlide) return
    
    const slideInput = slideInputs.get(currentSlide.id)
    const currentImages = contentEditableHook.editInsertedImages
    
    // 슬라이드별 상태와 현재 editInsertedImages가 다를 때만 업데이트
    const imagesChanged = !slideInput || 
      slideInput.images.size !== currentImages.size ||
      Array.from(slideInput.images.keys()).some(key => !currentImages.has(key)) ||
      Array.from(currentImages.keys()).some(key => !slideInput.images.has(key))
    
    if (imagesChanged) {
      setSlideInputs(prev => {
        const next = new Map(prev)
        const existing = next.get(currentSlide.id) || { prompt: humanPrompt, images: new Map() }
        // editInsertedImages를 슬라이드별 상태에 저장
        next.set(currentSlide.id, { ...existing, images: new Map(currentImages) })
        return next
      })
    }
  }, [contentEditableHook.editInsertedImages, generationHook.currentSlideIndex, isOpen, isProjectLoaded, generationHook.editSlides, slideInputs, humanPrompt])

  const handleClose = () => {
    // 생성 중이어도 모달을 닫을 수 있도록 허용 (다른 슬라이드에서 작업 가능)
    setIsVisible(false)
    setTimeout(() => {
      onClose()
      // 프로젝트 편집 모드: clearEditingProject 호출
      clearEditingProject()
      // 상태 초기화
      setCurrentMode('edit')
      generationHook.setEditSlides([])
      generationHook.setCurrentSlideIndex(0)
      setImageUrl(null)
      setImagePath(null)
      setOriginalImageUrl(null)
      setOriginalImagePath(null)
      setLatestMetadata(null)
      setHumanPrompt('')
      setIsPublic(null)
      contentEditableHook.setInsertedImages(new Map())
      contentEditableHook.setEditInsertedImages(new Map())
    }, 250)
  }

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files)
      for (const file of files) {
        if (file.type.startsWith('image/')) {
          await contentEditableHook.insertImageIntoContentEditable(file, currentMode === 'edit')
        }
      }
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files)
      for (const file of files) {
        if (file.type.startsWith('image/')) {
          await contentEditableHook.insertImageIntoContentEditable(file, currentMode === 'edit')
        }
      }
    }
  }

  const handleCopyPrompt = async () => {
    // Get current slide if in edit mode
    const currentSlide = currentMode === 'edit' && generationHook.editSlides.length > 0 
      ? generationHook.editSlides[generationHook.currentSlideIndex] 
      : null
    
    let textToCopy: string | any = null
    
    if (promptType === 'prompt') {
      textToCopy = humanPrompt
    } else if (promptType === 'ai_prompt') {
      textToCopy = currentSlide?.ai_prompt || latestMetadata?.ai_prompt
    } else if (promptType === 'ai_json_prompt') {
      // Use current slide's ai_json_prompt if available, otherwise use latestMetadata's
      const jsonValue = currentSlide?.ai_json_prompt || latestMetadata?.ai_json_prompt
      if (jsonValue) {
        textToCopy = jsonValue
      }
    }
    
    if (!textToCopy) return
    
    try {
      const promptText = typeof textToCopy === 'string' ? textToCopy : JSON.stringify(textToCopy, null, 2)
      await navigator.clipboard.writeText(promptText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy to clipboard:', err)
      // Still show copied state even if it fails, as the user clicked the button
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleUseGalleryPrompt = (prompt: string) => {
    setHumanPrompt(prompt)
    galleryHook.setShowGalleryPreview(false)
    // Optionally insert into content editable if needed
  }

  const isDark = useMemo(() => getInitialTheme(), [])
  const displayImageUrl = (() => {
    const currentSlide = generationHook.editSlides[generationHook.currentSlideIndex]
    if (currentMode === 'edit' && currentSlide) {
      return currentSlide.imageUrl || imageUrl
    }
    return imageUrl
  })()

  if (!isMounted || !isVisible || !editingProject) return null

  return createPortal(
    <>
      <div className={`fixed inset-0 z-99999 transition-all duration-250 ease-out ${panelElements.background ? 'opacity-100' : 'opacity-0'}`} onClick={(e) => e.target === e.currentTarget && handleClose()}>
        {!showPromptOverlay && !showHistory && (
          <button onClick={handleClose} className="absolute top-4 right-4 z-100 w-10 h-10 rounded-full flex items-center justify-center cursor-pointer transition-all" style={getAdaptiveGlassStyleBlur()}>
            <X className="w-6 h-6" style={getTextStyle(true)} />
          </button>
        )}

        <div className="w-full h-full flex items-center justify-center relative">
          <div className="relative w-full h-full flex items-center justify-center transition-opacity duration-200" style={getAdaptiveGlassStyleBlur()}>
            {currentMode === 'generating' ? (
              <GeneratingView
                generatingPrompt={generatingPrompt}
                generatingImages={generatingImages}
                setViewingImageId={setViewingImageId}
                setViewingImageUrl={setViewingImageUrl}
                blurStyle={{}}
              />
            ) : (
              <ViewerEditMode
                displayImageUrl={displayImageUrl}
                isEditMode={currentMode === 'edit'}
                currentSlide={generationHook.editSlides[generationHook.currentSlideIndex]}
                currentSlideIndex={generationHook.currentSlideIndex}
                editSlides={generationHook.editSlides}
                isCurrentSlideGenerating={generationHook.editSlides[generationHook.currentSlideIndex]?.isGenerating || false}
                editingSourceImageUrl={null}
                isGuest={!user || user.id === 'anonymous'}
                setShowHistory={setShowHistory}
                setShowPromptOverlay={setShowPromptOverlay}
                setShowVisibilitySelector={setShowVisibilitySelector}
                setCurrentSlideIndex={generationHook.setCurrentSlideIndex}
                selectedModel={selectedModel}
                modelSelectorRef={modelSelectorRef}
                setShowModelSelector={setShowModelSelector}
                setDropdownPosition={setDropdownPosition}
                isMobile={isMobile}
                editContentEditableRef={contentEditableHook.editContentEditableRef}
                editPrompt={humanPrompt}
                setEditPrompt={(prompt: string) => {
                  setHumanPrompt(prompt)
                  // 현재 슬라이드의 인풋 상태에 저장
                  const currentSlide = generationHook.editSlides[generationHook.currentSlideIndex]
                  if (currentSlide) {
                    setSlideInputs(prev => {
                      const next = new Map(prev)
                      const existing = next.get(currentSlide.id) || { prompt: '', images: new Map() }
                      next.set(currentSlide.id, { ...existing, prompt })
                      return next
                    })
                  }
                }}
                editInsertedImages={contentEditableHook.editInsertedImages}
                handleEditSubmit={async () => {
                  const currentSlide = generationHook.editSlides[generationHook.currentSlideIndex]
                  if (!currentSlide) return
                  
                  // extractContentFromEditable을 사용하여 이미지 태그가 포함된 프롬프트 생성
                  const content = contentEditableHook.extractContentFromEditable(true)
                  const promptTextWithImageTags = content.text
                  const imagesMetadata = content.metadata
                  
                  // 제출할 때 사용할 현재 상태 저장
                  const currentPrompt = promptTextWithImageTags || humanPrompt
                  const currentImages = new Map(contentEditableHook.editInsertedImages)
                  
                  // 제출 직후 인풋창 비우기
                  setHumanPrompt('')
                  contentEditableHook.setEditInsertedImages(new Map())
                  
                  // 현재 슬라이드의 인풋 상태 초기화
                  setSlideInputs(prev => {
                    const next = new Map(prev)
                    next.set(currentSlide.id, { prompt: '', images: new Map() })
                    return next
                  })
                  
                  // contentEditable의 내용도 비우기
                  if (contentEditableHook.editContentEditableRef.current) {
                    contentEditableHook.editContentEditableRef.current.innerHTML = ''
                  }
                  
                  // 제출 실행 (저장된 상태 사용, 이미지 메타데이터 포함)
                  await generationHook.handleEditSubmit(
                    currentPrompt,
                    currentImages,
                    selectedModel,
                    generationHook.convertBlobToBase64,
                    editingProjectId,
                    imagesMetadata
                  )
                }}
                handleCancelGeneration={generationHook.handleCancelGeneration}
                insertImageIntoEditContentEditable={async (file) => {
                  const result = await contentEditableHook.insertImageIntoContentEditable(file, true)
                  // 이미지 삽입 후 현재 슬라이드의 인풋 상태에 저장
                  const currentSlide = generationHook.editSlides[generationHook.currentSlideIndex]
                  if (currentSlide && result.success) {
                    setSlideInputs(prev => {
                      const next = new Map(prev)
                      const existing = next.get(currentSlide.id) || { prompt: '', images: new Map() }
                      const updatedImages = new Map(existing.images)
                      // contentEditableHook의 editInsertedImages에서 최신 이미지 정보 가져오기
                      const latestImages = contentEditableHook.editInsertedImages
                      latestImages.forEach((imgData, imageId) => {
                        updatedImages.set(imageId, imgData)
                      })
                      next.set(currentSlide.id, { ...existing, images: updatedImages })
                      return next
                    })
                  }
                }}
                fileInputRef={fileInputRef}
                savingSlides={generationHook.savingSlides}
                savedSlides={generationHook.savedSlides}
                handleSaveSlide={(slide, metadata) => generationHook.handleSaveSlide(slide, metadata, editingProjectId)}
                isSaving={isSaving}
                isOriginalSaved={isOriginalSaved}
                showVisibilitySelector={showVisibilitySelector}
                latestMetadata={latestMetadata}
                setViewingImageId={setViewingImageId}
                setViewingImageUrl={setViewingImageUrl}
                setEditInsertedImages={contentEditableHook.setEditInsertedImages}
              />
            )}
          </div>
        </div>
      </div>

      {showModelSelector && dropdownPosition && createPortal(
        <div ref={dropdownRef} className="fixed rounded-2xl z-[100000] overflow-hidden" style={{ top: `${dropdownPosition.top}px`, left: `${dropdownPosition.left}px`, transform: 'translateX(-50%)', width: '280px', color: 'rgba(255, 255, 255, 1)', ...getAdaptiveGlassStyleBlur() }}>
          <div className="p-2 space-y-1">
            {['nano-banana-pro', 'seadream-4.5', 'gpt-image-1.5', 'qwen-image-edit-2511'].map((m) => (
              <button key={m} onClick={() => { setSelectedModel(m as any); setShowModelSelector(false); }} className={`flex items-center gap-2 w-full p-2 rounded-xl text-left transition-all text-white ${selectedModel === m ? 'bg-white/20' : 'hover:bg-white/10'}`} style={{ color: 'rgba(255, 255, 255, 1)' }}>
                {selectedModel === m && <Check size={16} style={{ color: 'rgba(255, 255, 255, 1)' }} />}
                <div className="flex items-center justify-center w-7 h-7 shrink-0">
                  {getModelIcon(m, 14)}
                </div>
                <span className="text-[0.95rem] font-medium" style={{ color: 'rgba(255, 255, 255, 1)' }}>
                  {m === 'nano-banana-pro' ? '🍌 Nano Banana Pro' : m === 'seadream-4.5' ? 'Seedream 4.5 Uncensored' : m === 'qwen-image-edit-2511' ? 'Qwen Image Edit Uncensored' : 'GPT Image 1.5'}
                </span>
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}

      {showPromptOverlay && createPortal(
        <PromptOverlay isOpen={showPromptOverlay} displayImageUrl={displayImageUrl} onClose={() => setShowPromptOverlay(false)} promptType={promptType} setPromptType={setPromptType} availablePrompts={['prompt', 'ai_prompt', 'ai_json_prompt']} promptLabels={{ prompt: 'Human Prompt', ai_prompt: 'AI Prompt', ai_json_prompt: 'AI JSON' }} humanPrompt={humanPrompt} latestMetadata={latestMetadata} isEditMode={currentMode === 'edit'} editSlides={generationHook.editSlides} currentSlideIndex={generationHook.currentSlideIndex} setCurrentSlideIndex={generationHook.setCurrentSlideIndex} isPromptGenerating={isPromptGenerating} handleExtractPrompt={handleExtractPrompt} handleCopyPrompt={handleCopyPrompt} copied={copied} promptError={promptError} setPromptError={setPromptError} />,
        document.body
      )}
      
      {showHistory && createPortal(
        <SlideHistory isOpen={showHistory} displayImageUrl={displayImageUrl} onClose={() => setShowHistory(false)} editSlides={generationHook.editSlides} currentSlideIndex={generationHook.currentSlideIndex} isEditMode={currentMode === 'edit'} enterEditMode={() => setCurrentMode('edit')} setCurrentSlideIndex={generationHook.setCurrentSlideIndex} isMobile={isMobile} />,
        document.body
      )}
      
      <GalleryPreview isOpen={galleryHook.showGalleryPreview} selectedImage={galleryHook.selectedGalleryImage} onClose={() => galleryHook.setShowGalleryPreview(false)} onUsePrompt={handleUseGalleryPrompt} searchQuery="" promptType={galleryHook.galleryPromptType} setPromptType={galleryHook.setGalleryPromptType} />
      <VisibilitySelector isOpen={showVisibilitySelector} onClose={() => setShowVisibilitySelector(false)} isSaving={isSaving} isPublic={isPublic} setIsPublic={setIsPublic} isOriginalSaved={isOriginalSaved} onSave={handleFinalSave} />
      
      {viewingImageId && viewingImageUrl && createPortal(
        <div className="fixed inset-0 z-100000 bg-black/95 flex items-center justify-center cursor-pointer" onClick={() => { setViewingImageId(null); setViewingImageUrl(null); }}>
          <img src={viewingImageUrl} className="absolute inset-0 w-full h-full object-cover z-0" style={{ filter: 'brightness(0.3) blur(20px)', transform: 'scale(1.1)' }} />
          <img src={viewingImageUrl} className="relative z-10 w-full h-full object-contain shadow-2xl transition-all duration-300" />
        </div>,
        document.body
      )}
    </>,
    document.body
  )
}
