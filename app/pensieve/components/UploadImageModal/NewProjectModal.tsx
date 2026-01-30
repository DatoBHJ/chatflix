'use client'

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import dynamic from 'next/dynamic'
import { usePensieve } from '../../context/PensieveContext'
import { Mode, PromptType } from './types'
import { useContentEditable } from './hooks/useContentEditable'
import { useGallery } from './hooks/useGallery'
import { useGeneration } from './hooks/useGeneration'
import { useUploadLogic } from './hooks/useUploadLogic'
import { InitialEditor } from './ui/InitialEditor'
import { ViewerEditMode } from './ui/ViewerEditMode'
import { PromptOverlay } from './ui/PromptOverlay'
import { SlideHistory } from './ui/SlideHistory'
import { GalleryPreview } from './ui/GalleryPreview'
import { VisibilitySelector } from './ui/VisibilitySelector'
import { getAdaptiveGlassStyleBlur, getTextStyle, getInitialTheme } from '@/app/lib/adaptiveGlassStyle'
import { X, Check, LogIn } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { getModelIcon } from './ui/Controls'

// const PensieveWaterBackground = dynamic(() => import('../PensieveWaterBackground'), {
//   ssr: false,
//   loading: () => null
// })

function GuestSignInView() {
  return (
    <div className="flex items-center justify-center w-full h-full pt-20">
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
  )
}
// function GuestSignInView() {
//   return (
//     <div className="flex items-center justify-center w-full h-full p-6">
//       <div className="text-left max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500">
//         <h2 className="text-3xl font-semibold tracking-tight text-white mb-4">
//           Unlock your vision.
//         </h2>
//         <p className="text-base text-white/60 mb-4 leading-relaxed">
//         Patterns become clear once your imagination takes a visual form.
//         </p>
//         <Link 
//           href="/login"
//           className="text-[#007AFF] hover:underline cursor-pointer text-base font-medium inline-flex items-center gap-2 transition-all active:scale-95"
//         >
//           Sign in
//           <LogIn size={16} />
//         </Link>
//       </div>
//     </div>
//   )
// }

interface NewProjectModalProps {
  isOpen: boolean
  onClose: () => void
  onUploadComplete: (metadata: any) => void
  user?: any
}

export default function NewProjectModal({ isOpen, onClose, onUploadComplete, user }: NewProjectModalProps) {
  const [isMounted, setIsMounted] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [panelElements, setPanelElements] = useState({ background: false, content: false })
  const [isMobile, setIsMobile] = useState(false)
  const [selectedModel, setSelectedModel] = useState<'nano-banana-pro' | 'seadream-4.5' | 'gpt-image-1.5' | 'qwen-image-edit-2511'>('nano-banana-pro')
  const [showModelSelector, setShowModelSelector] = useState(false)
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(null)
  const modelSelectorRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Local UI states
  const [isDragging, setIsDragging] = useState(false)

  const { triggerRefresh } = usePensieve()

  const contentEditableHook = useContentEditable()
  const generationHook = useGeneration(user, selectedModel)
  
  const uploadLogic = useUploadLogic(
    user, selectedModel, onUploadComplete, onClose,
    generationHook, contentEditableHook, {} as any,
    (projectId) => {
      // 프로젝트 생성 시 triggerRefresh()를 호출하지 않음
      // SavedGallery가 브로드캐스트를 받아 직접 상태를 업데이트하도록 변경함
      console.log('[NewProjectModal] Project created:', projectId, 'skipping triggerRefresh as Gallery handles it')
    },
    undefined // 새 프로젝트 모드이므로 editingProjectId는 없음
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
  const [isImageLoaded, setIsImageLoaded] = useState(false)

  const isGuest = !user || user.id === 'anonymous'

  useEffect(() => {
    setIsMounted(true)
    if (isOpen) {
      setIsVisible(true)
      setTimeout(() => setPanelElements({ background: true, content: true }), 10)
      // 새 프로젝트 모드는 항상 initial 모드로 시작
      setCurrentMode('initial')
    }
  }, [isOpen, setCurrentMode])
  
  // Auto-focus contentEditable when modal opens in initial mode
  useEffect(() => {
    if (isOpen && currentMode === 'initial' && !isGuest) {
      // Use requestAnimationFrame for immediate focus after DOM is ready
      const rafId = requestAnimationFrame(() => {
        // Double RAF to ensure modal animation has started
        requestAnimationFrame(() => {
          if (contentEditableHook.contentEditableRef.current) {
            contentEditableHook.contentEditableRef.current.focus()
            
            // Move cursor to start if empty, or end if has content
            const range = document.createRange()
            const selection = window.getSelection()
            
            if (contentEditableHook.contentEditableRef.current.childNodes.length > 0) {
              const lastNode = contentEditableHook.contentEditableRef.current.lastChild
              if (lastNode?.nodeType === Node.TEXT_NODE) {
                range.setStart(lastNode, lastNode.textContent?.length || 0)
              } else {
                range.selectNodeContents(contentEditableHook.contentEditableRef.current)
                range.collapse(false)
              }
            } else {
              range.setStart(contentEditableHook.contentEditableRef.current, 0)
              range.collapse(true)
            }
            
            selection?.removeAllRanges()
            selection?.addRange(range)
          }
        })
      })
      return () => cancelAnimationFrame(rafId)
    }
  }, [isOpen, currentMode, contentEditableHook.contentEditableRef, isGuest])

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const handleClose = () => {
    if (generationHook.isGenerating || generationHook.isGeneratingImage || isPromptGenerating) return
    setIsVisible(false)
    setTimeout(() => {
      onClose()
      // 새 프로젝트 모드: 모든 상태 초기화
      setCurrentMode('initial')
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
    const contentEditable = contentEditableHook.contentEditableRef.current
    if (!contentEditable) {
      galleryHook.setShowGalleryPreview(false)
      return
    }

    // Use generatingPrompt for finding current word position
    const currentText = generatingPrompt || contentEditable.textContent || ''
    
    // Find current word boundaries
    // Word is separated by spaces or at start/end of text
    const words = currentText.split(/(\s+)/)
    let charPos = 0
    let wordStartIndex = 0
    let wordEndIndex = currentText.length
    let foundWord = false

    // Find the last non-whitespace word (current typing word)
    for (let i = words.length - 1; i >= 0; i--) {
      if (words[i].trim().length > 0) {
        // Calculate position
        wordStartIndex = words.slice(0, i).join('').length
        wordEndIndex = wordStartIndex + words[i].length
        foundWord = true
        break
      }
    }

    if (!foundWord || currentText.trim().length === 0) {
      // No word found, just append the prompt at the end
      const textNode = document.createTextNode(prompt)
      contentEditable.appendChild(textNode)
      
      // Set cursor after the inserted text
      const range = document.createRange()
      range.setStartAfter(textNode)
      range.collapse(true)
      const selection = window.getSelection()
      if (selection) {
        selection.removeAllRanges()
        selection.addRange(range)
      }
      
      // Update state
      const newText = contentEditable.textContent || ''
      setHumanPrompt(newText)
      uploadLogic.setGeneratingPrompt(newText)
      galleryHook.setShowGalleryPreview(false)
      return
    }

    // Walk through DOM to find word position in text nodes
    const walker = document.createTreeWalker(
      contentEditable,
      NodeFilter.SHOW_TEXT,
      null
    )

    const textNodes: Array<{ node: Text; startPos: number; endPos: number }> = []
    let charCount = 0
    let node: Node | null

    while (node = walker.nextNode()) {
      if (node.nodeType === Node.TEXT_NODE && node.textContent) {
        const length = node.textContent.length
        textNodes.push({
          node: node as Text,
          startPos: charCount,
          endPos: charCount + length
        })
        charCount += length
      }
    }

    // Find which text node contains word start and end position
    let startNode: Text | null = null
    let startOffset = 0
    let endNode: Text | null = null
    let endOffset = 0

    for (const { node, startPos, endPos } of textNodes) {
      if (startPos <= wordStartIndex && wordStartIndex < endPos) {
        startNode = node
        startOffset = wordStartIndex - startPos
      }
      if (startPos <= wordEndIndex && wordEndIndex <= endPos) {
        endNode = node
        endOffset = wordEndIndex - startPos
        break
      }
    }

    if (!startNode) {
      // Fallback: couldn't find word, just append
      const textNode = document.createTextNode(prompt)
      contentEditable.appendChild(textNode)
      
      const range = document.createRange()
      range.setStartAfter(textNode)
      range.collapse(true)
      const selection = window.getSelection()
      if (selection) {
        selection.removeAllRanges()
        selection.addRange(range)
      }
      
      const newText = contentEditable.textContent || ''
      setHumanPrompt(newText)
      uploadLogic.setGeneratingPrompt(newText)
      galleryHook.setShowGalleryPreview(false)
      return
    }

    // If endNode is null, use startNode
    if (!endNode) {
      endNode = startNode
      endOffset = startNode.textContent?.length || 0
    }

    // Create range and replace with prompt
    const range = document.createRange()
    range.setStart(startNode, startOffset)
    range.setEnd(endNode, endOffset)
    range.deleteContents()
    
    const promptTextNode = document.createTextNode(prompt)
    range.insertNode(promptTextNode)
    
    // Set cursor after the inserted prompt
    range.setStartAfter(promptTextNode)
    range.collapse(true)
    const selection = window.getSelection()
    if (selection) {
      selection.removeAllRanges()
      selection.addRange(range)
    }

    // Update state
    const newText = contentEditable.textContent || ''
    setHumanPrompt(newText)
    uploadLogic.setGeneratingPrompt(newText)
    galleryHook.setShowGalleryPreview(false)
  }

  // Extract search query from contentEditable - always extract current word
  const extractSearchQuery = useCallback(() => {
    // First try to get text from generatePrompt (most up-to-date)
    let text = generatingPrompt || ''
    
    // Fallback to contentEditable if generatePrompt is empty
    if (!text && contentEditableHook.contentEditableRef.current) {
      text = contentEditableHook.contentEditableRef.current.textContent || ''
    }

    if (!text || text.trim().length === 0) {
      return { query: '', hasQuery: false }
    }

    // Extract the last word (current typing word)
    // Split by spaces and get the last non-empty part
    const words = text.split(/(\s+)/)
    let lastWord = ''
    
    for (let i = words.length - 1; i >= 0; i--) {
      const word = words[i].trim()
      if (word.length > 0) {
        lastWord = word
        break
      }
    }

    return { query: lastWord, hasQuery: lastWord.length > 0 }
  }, [contentEditableHook.contentEditableRef, generatingPrompt])

  // Filter gallery images based on search query
  const filteredGalleryImages = useMemo(() => {
    const searchResult = extractSearchQuery()
    if (!searchResult.hasQuery || !searchResult.query.trim()) {
      return galleryHook.galleryImages
    }

    const query = searchResult.query.toLowerCase()
    return galleryHook.galleryImages.filter((item) => {
      const image = item.image
      
      // Check prompt: if string, search in it; if object, stringify and search
      const promptText = typeof image.prompt === 'string' 
        ? image.prompt
        : typeof image.prompt === 'object' && image.prompt !== null
        ? JSON.stringify(image.prompt)
        : ''
      const promptMatch = promptText.toLowerCase().includes(query)
      
      // Check keywords
      const keywordMatch = image.keywords?.some((k: any) => typeof k === 'string' && k.toLowerCase().includes(query)) || false
      
      // For x_search images, also search in additional fields
      const xSearchQueriesMatch = image.x_search_queries?.some((q: any) => q.toLowerCase().includes(query)) || false
      const xSearchStrategiesMatch = image.x_search_strategies?.some((s: any) => s.toLowerCase().includes(query)) || false
      const xSearchAuthorsMatch = image.x_search_authors?.some((a: any) => a.toLowerCase().includes(query)) || false
      const xSearchTweetIdsMatch = image.x_search_tweetIds?.some((t: any) => t.toLowerCase().includes(query)) || false
      const linksMatch = image.links?.some((l: any) => l.toLowerCase().includes(query)) || false
      
      return promptMatch || keywordMatch || xSearchQueriesMatch || xSearchStrategiesMatch || xSearchAuthorsMatch || xSearchTweetIdsMatch || linksMatch
    })
  }, [galleryHook.galleryImages, extractSearchQuery, generatingPrompt])

  const isDark = useMemo(() => getInitialTheme(), [])
  const hasInitialBackgroundImage = currentMode === 'initial'
  const shouldUseDarkText = currentMode === 'initial' && contentEditableHook.insertedImages.size === 0 && !isDark

  const displayImageUrl = (() => {
    const currentSlide = generationHook.editSlides[generationHook.currentSlideIndex]
    if (currentMode === 'edit' && currentSlide) {
      return currentSlide.imageUrl || imageUrl
    }
    return imageUrl
  })()

  // displayImageUrl이 변경되면 이미지 로드 상태 리셋
  useEffect(() => {
    if (displayImageUrl) {
      setIsImageLoaded(false)
    }
  }, [displayImageUrl])

  if (!isMounted || !isVisible) return null

  return createPortal(
    <>
      <div 
        className={`fixed inset-0 z-95 transition-all duration-250 ease-out ${panelElements.background ? 'opacity-100' : 'opacity-0'}`} 
        onClick={(e) => {
          // Only close if clicking directly on the backdrop, not on any child elements
          const target = e.target as HTMLElement
          if (e.target === e.currentTarget && !target.closest('button') && !target.closest('.fixed')) {
            handleClose()
          }
        }}
      >
        {!showPromptOverlay && !showHistory && (
          <button onClick={handleClose} className="absolute top-4 right-4 z-100 w-10 h-10 rounded-full flex items-center justify-center cursor-pointer transition-all" style={getAdaptiveGlassStyleBlur()}>
            <X className="w-6 h-6" style={getTextStyle(true)} />
          </button>
        )}

        <div className="w-full h-full flex items-center justify-center relative">
          {/* Background layer - PensieveWaterBackground */}
          {/* Guest 모드이거나 initial 모드이거나, edit 모드에서 이미지가 로드되기 전까지 표시 */}
          {(isGuest || currentMode === 'initial' || (currentMode === 'edit' && (!displayImageUrl || !isImageLoaded))) && (
            <>
              {/* Background - Commented out PensieveWaterBackground, replaced with bg-background */}
              <div className="absolute inset-0 z-0 bg-background">
                {/* <PensieveWaterBackground opacity={1} /> */}
              </div>
              {!isGuest && contentEditableHook.insertedImages.size > 0 && (
                <img
                  src={Array.from(contentEditableHook.insertedImages.values()).pop()?.blobUrl}
                  className="absolute inset-0 w-full h-full object-cover z-1"
                  style={{ filter: 'brightness(0.3) blur(20px)', transform: 'scale(1.1)' }}
                />
              )}
            </>
          )}
          
          {/* Content layer */}
          <div className="relative w-full h-full flex items-center justify-center transition-opacity duration-200 z-10" style={currentMode === 'initial' ? {} : getAdaptiveGlassStyleBlur()}>
            {isGuest ? (
              <GuestSignInView />
            ) : currentMode === 'initial' ? (
              <InitialEditor
                shouldUseDarkText={shouldUseDarkText}
                isDragging={isDragging}
                setIsDragging={setIsDragging}
                modelSelectorRef={modelSelectorRef}
                isGeneratingImage={generationHook.isGeneratingImage}
                setShowModelSelector={setShowModelSelector}
                setDropdownPosition={setDropdownPosition}
                selectedModel={selectedModel}
                hasInitialBackgroundImage={hasInitialBackgroundImage}
                contentEditableRef={contentEditableHook.contentEditableRef}
                setGeneratePrompt={uploadLogic.setGeneratingPrompt}
                setInsertedImages={contentEditableHook.setInsertedImages}
                insertImageIntoContentEditable={contentEditableHook.insertImageIntoContentEditable}
                handleGenerateImage={handleGenerateImage}
                onDrop={handleDrop}
                fileInputRef={fileInputRef}
                extractSearchQuery={extractSearchQuery}
                filteredGalleryImages={filteredGalleryImages}
                handleGalleryImageClick={(image) => {
                  galleryHook.setSelectedGalleryImage(image)
                  galleryHook.setShowGalleryPreview(true)
                }}
                promptToString={galleryHook.promptToString}
                isLoadingGallery={galleryHook.isLoadingGallery}
                insertedImages={contentEditableHook.insertedImages}
                showExtractButton={false}
                generatePrompt={generatingPrompt}
                isMobile={isMobile}
                prevTextRef={{ current: '' }}
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
                isGuest={isGuest}
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
                setEditPrompt={setHumanPrompt}
                editInsertedImages={contentEditableHook.editInsertedImages}
                handleEditSubmit={async () => {
                  // extractContentFromEditable을 사용하여 이미지 태그가 포함된 프롬프트 생성
                  const content = contentEditableHook.extractContentFromEditable(true)
                  const promptTextWithImageTags = content.text
                  const imagesMetadata = content.metadata
                  
                  await generationHook.handleEditSubmit(
                    promptTextWithImageTags || humanPrompt,
                    contentEditableHook.editInsertedImages,
                    selectedModel,
                    generationHook.convertBlobToBase64,
                    uploadLogic.projectId,
                    imagesMetadata
                  )
                }}
                handleCancelGeneration={generationHook.handleCancelGeneration}
                insertImageIntoEditContentEditable={(file) => contentEditableHook.insertImageIntoContentEditable(file, true)}
                fileInputRef={fileInputRef}
                savingSlides={generationHook.savingSlides}
                savedSlides={generationHook.savedSlides}
                handleSaveSlide={(slide, metadata) => generationHook.handleSaveSlide(slide, metadata, uploadLogic.projectId)}
                isSaving={isSaving}
                isOriginalSaved={isOriginalSaved}
                showVisibilitySelector={showVisibilitySelector}
                latestMetadata={latestMetadata}
                setViewingImageId={setViewingImageId}
                setViewingImageUrl={setViewingImageUrl}
                setEditInsertedImages={contentEditableHook.setEditInsertedImages}
                onBackgroundImageLoad={() => setIsImageLoaded(true)}
              />
            )}
          </div>
        </div>
      </div>

      {showModelSelector && dropdownPosition && createPortal(
        <div ref={dropdownRef} className="fixed rounded-2xl z-10002 overflow-hidden" style={{ top: `${dropdownPosition.top}px`, left: `${dropdownPosition.left}px`, transform: 'translateX(-50%)', width: '280px', color: 'rgba(255, 255, 255, 1)', ...getAdaptiveGlassStyleBlur() }}>
          <div className="p-2 space-y-1">
            {['nano-banana-pro', 'seadream-4.5', 'gpt-image-1.5'].map((m) => (
              <button key={m} onClick={() => { setSelectedModel(m as any); setShowModelSelector(false); }} className={`flex items-center gap-2 w-full p-2 rounded-xl text-left transition-all text-white ${selectedModel === m ? 'bg-white/20' : 'hover:bg-white/10'}`} style={{ color: 'rgba(255, 255, 255, 1)' }}>
                {selectedModel === m && <Check size={16} style={{ color: 'rgba(255, 255, 255, 1)' }} />}
                <div className="flex items-center justify-center w-7 h-7 shrink-0">
                  {getModelIcon(m, 14)}
                </div>
                <span className="text-[0.95rem] font-medium" style={{ color: 'rgba(255, 255, 255, 1)' }}>
                  {m === 'nano-banana-pro' ? '🍌 Nano Banana Pro' : m === 'seadream-4.5' ? 'Seedream 4.5 Uncensored' : 'GPT Image 1.5'}
                </span>
              </button>
            ))}
            {/* Qwen Image Edit - enabled when images are uploaded, disabled otherwise */}
            {contentEditableHook.insertedImages.size > 0 ? (
              <button onClick={() => { setSelectedModel('qwen-image-edit-2511' as any); setShowModelSelector(false); }} className={`flex items-center gap-2 w-full p-2 rounded-xl text-left transition-all text-white ${selectedModel === 'qwen-image-edit-2511' ? 'bg-white/20' : 'hover:bg-white/10'}`} style={{ color: 'rgba(255, 255, 255, 1)' }}>
                {selectedModel === 'qwen-image-edit-2511' && <Check size={16} style={{ color: 'rgba(255, 255, 255, 1)' }} />}
                <div className="flex items-center justify-center w-7 h-7 shrink-0">
                  {getModelIcon('qwen-image-edit-2511', 14)}
                </div>
                <span className="text-[0.95rem] font-medium" style={{ color: 'rgba(255, 255, 255, 1)' }}>
                  Qwen Image Edit Uncensored
                </span>
              </button>
            ) : (
              <div className="flex items-center gap-2 w-full p-2 rounded-xl text-left opacity-50 cursor-not-allowed">
                <div className="flex items-center justify-center w-7 h-7 shrink-0">
                  {getModelIcon('qwen-image-edit-2511', 14)}
                </div>
                <span className="text-[0.95rem] font-medium" style={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                  Qwen Image Edit Uncensored
                </span>
                <span className="text-[0.75rem] font-normal ml-auto" style={{ color: 'rgba(255, 255, 255, 0.4)' }}>
                  Edit only
                </span>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      <PromptOverlay isOpen={showPromptOverlay} displayImageUrl={displayImageUrl} onClose={() => setShowPromptOverlay(false)} promptType={promptType} setPromptType={setPromptType} availablePrompts={['prompt', 'ai_prompt', 'ai_json_prompt']} promptLabels={{ prompt: 'Human Prompt', ai_prompt: 'AI Prompt', ai_json_prompt: 'AI JSON' }} humanPrompt={humanPrompt} latestMetadata={latestMetadata} isEditMode={currentMode === 'edit'} editSlides={generationHook.editSlides} currentSlideIndex={generationHook.currentSlideIndex} setCurrentSlideIndex={generationHook.setCurrentSlideIndex} isPromptGenerating={isPromptGenerating} handleExtractPrompt={handleExtractPrompt} handleCopyPrompt={handleCopyPrompt} copied={copied} promptError={promptError} setPromptError={setPromptError} />
      <SlideHistory isOpen={showHistory} displayImageUrl={displayImageUrl} onClose={() => setShowHistory(false)} editSlides={generationHook.editSlides} currentSlideIndex={generationHook.currentSlideIndex} isEditMode={currentMode === 'edit'} enterEditMode={() => setCurrentMode('edit')} setCurrentSlideIndex={generationHook.setCurrentSlideIndex} isMobile={isMobile} />
      <GalleryPreview isOpen={galleryHook.showGalleryPreview} selectedImage={galleryHook.selectedGalleryImage} onClose={() => galleryHook.setShowGalleryPreview(false)} onUsePrompt={handleUseGalleryPrompt} searchQuery={extractSearchQuery().query} promptType={galleryHook.galleryPromptType} setPromptType={galleryHook.setGalleryPromptType} />
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
