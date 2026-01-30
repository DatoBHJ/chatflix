import React, { useState } from 'react'
import { ChevronLeft, ChevronRight, LayoutGrid, RectangleHorizontal, Loader2, ScrollText, Check, Copy, Plus } from 'lucide-react'
import { getAdaptiveGlassStyleBlur, getTextStyle as getTextStyleUtil, getIconClassName as getIconClassNameUtil } from '@/app/lib/adaptiveGlassStyle'
import { EditSlide, PromptType } from '../types'
import { InlinePromptView } from './PromptRenderer'
import { ModelSelector } from './Controls'
import { normalizeJsonPrompt } from '../utils/normalizeJson'
import { parsePastedPromptHtml, fetchImageAsFile, hasPensieveImages } from '../utils/richClipboard'

interface ViewerEditModeProps {
  displayImageUrl: string | null
  isEditMode: boolean
  currentSlide: EditSlide | null
  currentSlideIndex: number
  editSlides: EditSlide[]
  isCurrentSlideGenerating: boolean
  editingSourceImageUrl: string | null
  isGuest: boolean
  setShowHistory: (show: boolean) => void
  setShowPromptOverlay: (show: boolean) => void
  setShowVisibilitySelector: (show: boolean) => void
  setCurrentSlideIndex: React.Dispatch<React.SetStateAction<number>>
  selectedModel: 'nano-banana-pro' | 'seadream-4.5' | 'gpt-image-1.5' | 'qwen-image-edit-2511'
  modelSelectorRef: React.RefObject<HTMLDivElement | null>
  setShowModelSelector: React.Dispatch<React.SetStateAction<boolean>>
  setDropdownPosition: React.Dispatch<React.SetStateAction<{ top: number; left: number } | null>>
  isMobile: boolean
  editContentEditableRef: React.RefObject<HTMLDivElement | null>
  editPrompt: string
  setEditPrompt: (text: string) => void
  editInsertedImages: Map<string, { blobUrl: string; base64: string; file: File }>
  handleEditSubmit: () => Promise<void>
  handleCancelGeneration: (slideId?: string) => void
  insertImageIntoEditContentEditable: (file: File) => Promise<any>
  fileInputRef: React.RefObject<HTMLInputElement | null>
  savingSlides: Set<string>
  savedSlides: Set<string>
  handleSaveSlide: (slide: EditSlide, latestMetadata: any) => Promise<void>
  isSaving: boolean
  isOriginalSaved: boolean
  showVisibilitySelector: boolean
  latestMetadata: any
  setViewingImageId: (id: string) => void
  setViewingImageUrl: (url: string) => void
  setEditInsertedImages: React.Dispatch<React.SetStateAction<Map<string, { blobUrl: string; base64: string; file: File }>>>
  onBackgroundImageLoad?: () => void
}

export function ViewerEditMode({
  displayImageUrl,
  isEditMode,
  currentSlide,
  currentSlideIndex,
  editSlides,
  isCurrentSlideGenerating,
  editingSourceImageUrl,
  isGuest,
  setShowHistory,
  setShowPromptOverlay,
  setShowVisibilitySelector,
  setCurrentSlideIndex,
  selectedModel,
  modelSelectorRef,
  setShowModelSelector,
  setDropdownPosition,
  isMobile,
  editContentEditableRef,
  editPrompt,
  setEditPrompt,
  editInsertedImages,
  handleEditSubmit,
  handleCancelGeneration,
  insertImageIntoEditContentEditable,
  fileInputRef,
  savingSlides,
  savedSlides,
  handleSaveSlide,
  isSaving,
  isOriginalSaved,
  showVisibilitySelector,
  latestMetadata,
  setViewingImageId,
  setViewingImageUrl,
  setEditInsertedImages,
  onBackgroundImageLoad
}: ViewerEditModeProps) {
  if (!displayImageUrl) return null

  const getTextStyle = (hasBg: boolean) => getTextStyleUtil(hasBg)
  const getIconClassName = (hasBg: boolean) => getIconClassNameUtil(hasBg)
  const [imageAspectRatios, setImageAspectRatios] = useState<Map<number, number>>(new Map())

  return (
    <div className="relative w-full h-full overflow-hidden text-white flex flex-col">
      {/* Background image */}
      <div className="absolute inset-0 z-0">
        <img
          src={displayImageUrl}
          alt="preview background"
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            filter: 'brightness(0.3) blur(20px)',
            transform: 'scale(1.1)',
            objectPosition: 'center'
          }}
          onLoad={() => {
            if (onBackgroundImageLoad) {
              onBackgroundImageLoad()
            }
          }}
        />
      </div>
        
      {/* Main image / Generating area */}
      <div className="relative flex items-center justify-center w-full h-full z-10 group/main-image">
        {isCurrentSlideGenerating && currentSlide ? (
          <div className="relative w-full h-full overflow-hidden text-white flex flex-col items-center justify-center">
            <div className="relative z-10 w-full h-full flex flex-col items-center justify-center px-4 py-8">
              {currentSlide.prompt && (
                <div className="text-center mb-6 md:mb-8 max-w-2xl px-4 w-full">
                  <div 
                    className="text-base md:text-lg font-medium overflow-y-auto max-h-[30vh] md:max-h-[40vh] px-2"
                    style={{
                      background: 'linear-gradient(90deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.9) 25%, rgba(255,255,255,0.3) 50%, rgba(255,255,255,0.9) 75%, rgba(255,255,255,0.3) 100%)',
                      backgroundSize: '200% 100%',
                      backgroundClip: 'text',
                      WebkitBackgroundClip: 'text',
                      color: 'transparent',
                      animation: 'shimmer-text-strong 1.5s ease-in-out infinite'
                    }}
                  >
                    <InlinePromptView 
                      prompt={currentSlide.prompt}
                      images={(() => {
                        // 생성 중인 슬라이드는 editInsertedImages에서 가져옴
                        if (currentSlide.isGenerating && editInsertedImages.size > 0) {
                          const images: Array<{ blobUrl: string; base64: string; order: number; imageId?: string }> = []
                          
                          // 부모 슬라이드 이미지를 order: 1로 추가
                          if (currentSlide.parentSlideId) {
                            const parentSlide = editSlides.find(s => s.id === currentSlide.parentSlideId)
                            if (parentSlide?.imageUrl) {
                              images.push({
                                blobUrl: parentSlide.imageUrl,
                                base64: '',
                                order: 1,
                                imageId: 'parent'
                              })
                            }
                          }
                          
                          // editInsertedImages의 이미지들을 order: 2부터 추가
                          Array.from(editInsertedImages.values()).forEach((img, index) => {
                            images.push({
                              blobUrl: img.blobUrl,
                              base64: img.base64,
                              order: index + 2, // 부모 슬라이드가 1이므로 2부터 시작
                              imageId: undefined
                            })
                          })
                          
                          return images
                        }
                        
                        // 생성 완료된 슬라이드는 ai_json_prompt._inputImages에서 가져옴
                        const aiJsonPrompt = currentSlide.ai_json_prompt
                        if (aiJsonPrompt && typeof aiJsonPrompt === 'object' && '_inputImages' in aiJsonPrompt) {
                          return (aiJsonPrompt as any)._inputImages
                        }
                        return currentSlide.editImages || []
                      })()}
                    />
                  </div>
                </div>
              )}
              
              {/* Image grid during generation */}
              {(() => {
                // currentSlide.editImages에 이미 부모 슬라이드 이미지가 order: 1로 포함되어 있으므로
                // sourceUrl을 별도로 추가하지 않고 editImages만 사용
                const imagesToShow: Array<{ blobUrl: string; base64: string; order: number; imageId?: string }> = []
                
                if (currentSlide.editImages && currentSlide.editImages.length > 0) {
                  // editImages의 order를 그대로 사용 (이미 부모 슬라이드가 order: 1로 포함됨)
                  currentSlide.editImages.forEach((img) => {
                    imagesToShow.push({ ...img })
                  })
                }
                
                if (imagesToShow.length > 0) {
                  return (
                    <div className={`grid gap-4 max-w-4xl w-full px-4 ${
                      imagesToShow.length === 1 ? 'grid-cols-1 max-w-xs' :
                      imagesToShow.length === 2 ? 'grid-cols-1 md:grid-cols-2 max-w-2xl' :
                      imagesToShow.length === 3 ? 'grid-cols-1 md:grid-cols-3 max-w-3xl' :
                      'grid-cols-2 md:grid-cols-4 max-w-4xl'
                    }`}>
                      {imagesToShow.map((img, index) => (
                        <div 
                          key={img.imageId || index} 
                          className="relative rounded-lg overflow-hidden mx-auto cursor-pointer hover:opacity-90 transition-opacity"
                          style={{
                            aspectRatio: imageAspectRatios.get(index)?.toString() || '1',
                            width: '100%',
                            maxWidth: imagesToShow.length === 1 ? '300px' : 
                                     imagesToShow.length === 2 ? '250px' :
                                     imagesToShow.length === 3 ? '200px' : '180px'
                          }}
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setViewingImageId(img.imageId || `edit_generating_${index}`)
                            setViewingImageUrl(img.blobUrl)
                          }}
                        >
                          <img 
                            src={img.blobUrl} 
                            alt={`Input ${img.order}`}
                            className="w-full h-full object-contain rounded-lg"
                            onLoad={(e) => {
                              const imgElement = e.currentTarget
                              if (imgElement.naturalWidth && imgElement.naturalHeight) {
                                const ratio = imgElement.naturalWidth / imgElement.naturalHeight
                                setImageAspectRatios(prev => new Map(prev).set(index, ratio))
                              }
                            }}
                            onError={(e) => {
                              const target = e.currentTarget as HTMLImageElement
                              if (img.base64 && !target.src.startsWith('data:')) {
                                target.src = img.base64
                              }
                            }}
                          />
                          <div className="absolute inset-0 overflow-hidden rounded-lg pointer-events-none">
                            <div 
                              className="absolute w-full h-1 bg-linear-to-r from-transparent via-white to-transparent"
                              style={{
                                top: '0%',
                                left: '0%',
                                animation: `scan 2.4s ease-in-out infinite`,
                                animationDelay: `${index * 0.2}s`,
                                boxShadow: '0 0 20px rgba(255, 255, 255, 0.8), 0 0 40px rgba(59, 130, 246, 0.6)',
                                opacity: 0.9
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                }
                return null
              })()}
              
              <div className="flex items-center justify-center mt-8 md:mt-10">
                <Loader2 className="w-5 h-5 md:w-6 md:h-6 animate-spin text-white/60" />
              </div>
            </div>
          </div>
        ) : (
          <div className="relative cursor-pointer transition-all duration-300 shadow-xl rounded-md overflow-hidden hover:opacity-95"
            onClick={(e) => {
              e.stopPropagation()
              const currentSlideId = isEditMode && editSlides[currentSlideIndex] 
                ? editSlides[currentSlideIndex].id 
                : 'main_preview'
              setViewingImageId(currentSlideId)
              setViewingImageUrl(displayImageUrl)
            }}
          >
            <img
              src={displayImageUrl}
              alt="preview"
              className="transition-opacity duration-300"
              style={{
                maxWidth: '100vw', 
                maxHeight: '100vh',
                width: '100%',
                height: '100%',
                objectFit: 'contain'
              }}
            />
          </div>
        )}
      </div>
      
      {/* Top controls */}
      {!isEditMode && (
        <>
          {editSlides.length > 0 && (
            <button 
              className={`absolute top-4 left-4 px-4 py-3 rounded-full text-white transition-colors cursor-pointer flex items-center gap-2 z-10000`}
              onClick={(e) => {
                e.stopPropagation()
                setShowPromptOverlay(false)
                setShowHistory(true)
              }}
              style={getAdaptiveGlassStyleBlur()}
            >
              <LayoutGrid size={20} />
              <span className="text-sm font-medium hidden md:inline">Slides</span>
            </button>
          )}
        </>
      )}
      
      {/* Edit mode Top controls */}
      {isEditMode && (
        <>
          {editSlides.length > 1 && (
            <button 
              className="absolute top-4 left-4 px-4 py-2 rounded-full text-white transition-colors cursor-pointer flex items-center gap-2 z-10000"
              onClick={(e) => {
                e.stopPropagation()
                setShowPromptOverlay(false)
                setShowHistory(true)
              }}
              style={getAdaptiveGlassStyleBlur()}
            >
              <LayoutGrid size={18} />
              <span className="text-sm font-medium hidden md:inline">Slides</span>
            </button>
          )}
          
          <ModelSelector
            modelSelectorRef={modelSelectorRef}
            selectedModel={selectedModel}
            isGenerating={currentSlide?.isGenerating || false}
            hasBg={true}
              onClick={(e) => {
                e.stopPropagation()
                if (modelSelectorRef.current) {
                  const rect = modelSelectorRef.current.getBoundingClientRect()
                  setDropdownPosition({
                    top: rect.bottom + 8,
                    left: rect.left + (rect.width / 2)
                  })
                }
                setShowModelSelector(prev => !prev)
              }}
          />
          
          {editSlides.length > 1 && (
            <>
              <button
                className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full text-white transition-colors z-10000 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={(e) => {
                  e.stopPropagation()
                  if (currentSlideIndex > 0) setCurrentSlideIndex(prev => prev - 1)
                }}
                disabled={currentSlideIndex === 0}
                style={getAdaptiveGlassStyleBlur()}
              >
                <ChevronLeft size={24} />
              </button>
              <button 
                className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full text-white transition-colors z-10000 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={(e) => {
                  e.stopPropagation()
                  if (currentSlideIndex < editSlides.length - 1) setCurrentSlideIndex(prev => prev + 1)
                }}
                disabled={currentSlideIndex === editSlides.length - 1}
                style={getAdaptiveGlassStyleBlur()}
              >
                <ChevronRight size={24} />
              </button>
            </>
          )}
        </>
      )}

      {/* Edit Input (Desktop) */}
      {isEditMode && !isMobile && !currentSlide?.isGenerating && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-10000 w-full max-w-2xl px-4">
          <div className="rounded-[24px] px-2 py-2 flex items-end gap-2" style={getAdaptiveGlassStyleBlur()}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                fileInputRef.current?.click()
              }}
              disabled={currentSlide?.isGenerating}
              className="flex items-center justify-center w-8 h-8 rounded-full transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0 mb-0.5"
              style={getAdaptiveGlassStyleBlur()}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={getTextStyle(true)}>
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
            
            <div
              ref={editContentEditableRef}
              contentEditable
              suppressContentEditableWarning
              onInput={(e) => setEditPrompt(e.currentTarget.textContent || '')}
              onPaste={async (e) => {
                e.preventDefault()
                
                // Capture references before async operations (React pools events)
                const target = e.currentTarget as HTMLDivElement
                const clipboardItems = Array.from(e.clipboardData.items)
                const html = e.clipboardData.getData('text/html')
                const plainText = e.clipboardData.getData('text/plain')
                
                let hasDirectImage = false
                
                for (const item of clipboardItems) {
                  if (item.type.indexOf('image') !== -1) {
                    const file = item.getAsFile()
                    if (file) {
                      insertImageIntoEditContentEditable(file)
                      hasDirectImage = true
                    }
                  }
                }
                if (hasDirectImage) return
                
                // Check for HTML with pensieve images
                if (html && hasPensieveImages(html)) {
                  const parsed = parsePastedPromptHtml(html)
                  if (parsed && parsed.images.length > 0) {
                    // Fetch images first
                    const imageFiles: Map<number, File> = new Map()
                    for (const img of parsed.images) {
                      const file = await fetchImageAsFile(img.url)
                      if (file) {
                        imageFiles.set(img.order, file)
                      }
                    }
                    
                    // Split text by [image N] tags and insert text/images in order
                    const parts = parsed.text.split(/(\[image \d+\])/)
                    
                    for (const part of parts) {
                      const match = part.match(/\[image (\d+)\]/)
                      if (match) {
                        const order = parseInt(match[1], 10)
                        const file = imageFiles.get(order)
                        if (file) {
                          await insertImageIntoEditContentEditable(file)
                        }
                      } else if (part.trim()) {
                        const normalizedPart = normalizeJsonPrompt(part)
                        document.execCommand('insertText', false, normalizedPart)
                      }
                    }
                    
                    setEditPrompt(target?.textContent || '')
                    return
                  }
                }
                
                // If no image, paste text normally with JSON normalization
                let text = normalizeJsonPrompt(plainText)
                document.execCommand('insertText', false, text)
                setEditPrompt(target?.textContent || '')
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleEditSubmit()
                }
              }}
              className={`pensieve-edit-input flex-1 bg-transparent text-white outline-none text-sm min-h-[36px] max-h-[150px] overflow-y-auto ${!editPrompt.trim() && editInsertedImages.size === 0 ? 'empty' : ''}`}
              data-placeholder="Describe how you want to edit the image..."
              style={{ padding: '8px 12px', lineHeight: '1.4' }}
            />
            
            {currentSlide?.isGenerating ? (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleCancelGeneration(currentSlide.id)
                }}
                className="flex items-center justify-center w-8 h-8 rounded-full bg-red-500/80 hover:bg-red-500 text-white shrink-0 cursor-pointer mb-0.5"
              >
                <div className="w-2.5 h-2.5 bg-current rounded-sm"></div>
              </button>
            ) : (
              (editPrompt.trim() || editInsertedImages.size > 0) && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleEditSubmit()
                  }}
                  className="w-8 h-8 rounded-full flex items-center justify-center bg-(--chat-input-primary) text-(--chat-input-primary-foreground) mb-0.5"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4">
                    <path d="M12 2L12 22M5 9L12 2L19 9" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              )
            )}
          </div>
        </div>
      )}

      {/* Mobile action bar */}
      {isMobile && isEditMode && !currentSlide?.isGenerating && (
        <div className="fixed bottom-0 left-0 right-0 z-10000 px-3 pb-4 pt-2 flex items-end gap-2.5">
          <button
            onClick={(e) => {
              e.stopPropagation()
              setShowPromptOverlay(true)
            }}
            className="flex items-center justify-center w-10 h-10 rounded-full text-white transition-colors cursor-pointer shrink-0"
            style={getAdaptiveGlassStyleBlur()}
            aria-label="Open prompt inspector"
          >
            <ScrollText size={18} className={getIconClassNameUtil(true)} />
          </button>

          <div 
            className="rounded-[20px] px-1 py-1 flex items-end gap-1.5 flex-1 min-w-0"
            style={getAdaptiveGlassStyleBlur()}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                if (fileInputRef.current) {
                  fileInputRef.current.value = ''
                  fileInputRef.current.click()
                }
              }}
              disabled={currentSlide?.isGenerating}
              className="flex items-center justify-center w-7 h-7 rounded-full transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0 mb-0.5"
              style={getAdaptiveGlassStyleBlur()}
              title="Add image"
            >
              <Plus size={14} className={getIconClassNameUtil(true)} />
            </button>

            <div
              ref={editContentEditableRef}
              contentEditable={!currentSlide?.isGenerating}
              suppressContentEditableWarning
              onInput={(e) => {
                const target = e.currentTarget
                const text = target.textContent || ''
                setEditPrompt(text)
              }}
              onPaste={async (e) => {
                e.preventDefault()
                
                // Capture references before async operations (React pools events)
                const target = e.currentTarget as HTMLDivElement
                const clipboardItems = Array.from(e.clipboardData.items)
                const html = e.clipboardData.getData('text/html')
                const plainText = e.clipboardData.getData('text/plain')
                
                let hasDirectImage = false
                
                for (const item of clipboardItems) {
                  if (item.type.indexOf('image') !== -1) {
                    const file = item.getAsFile()
                    if (file) {
                      insertImageIntoEditContentEditable(file)
                      hasDirectImage = true
                    }
                  }
                }
                if (hasDirectImage) return
                
                // Check for HTML with pensieve images
                if (html && hasPensieveImages(html)) {
                  const parsed = parsePastedPromptHtml(html)
                  if (parsed && parsed.images.length > 0) {
                    // Fetch images first
                    const imageFiles: Map<number, File> = new Map()
                    for (const img of parsed.images) {
                      const file = await fetchImageAsFile(img.url)
                      if (file) {
                        imageFiles.set(img.order, file)
                      }
                    }
                    
                    // Split text by [image N] tags and insert text/images in order
                    const parts = parsed.text.split(/(\[image \d+\])/)
                    
                    for (const part of parts) {
                      const match = part.match(/\[image (\d+)\]/)
                      if (match) {
                        const order = parseInt(match[1], 10)
                        const file = imageFiles.get(order)
                        if (file) {
                          await insertImageIntoEditContentEditable(file)
                        }
                      } else if (part.trim()) {
                        const normalizedPart = normalizeJsonPrompt(part)
                        document.execCommand('insertText', false, normalizedPart)
                      }
                    }
                    
                    setEditPrompt(target?.textContent || '')
                    return
                  }
                }
                
                // If no image, paste text normally with JSON normalization
                let text = normalizeJsonPrompt(plainText)
                document.execCommand('insertText', false, text)
                setEditPrompt(target?.textContent || '')
              }}
              onClick={(e) => e.stopPropagation()}
              data-placeholder="Describe your edit..."
              className={`flex-1 bg-transparent text-white outline-none text-sm min-h-[32px] max-h-[120px] overflow-y-auto min-w-0 ${!editPrompt.trim() && editInsertedImages.size === 0 ? 'empty' : ''}`}
              style={{
                color: 'var(--foreground)',
                caretColor: 'var(--foreground)',
                lineHeight: '1.4',
                padding: '6px 8px',
                wordBreak: 'break-word',
                overflowWrap: 'break-word',
                whiteSpace: 'pre-wrap'
              }}
            />

            {currentSlide?.isGenerating ? (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleCancelGeneration(currentSlide.id)
                }}
                className="flex items-center justify-center w-7 h-7 rounded-full transition-all duration-300 bg-red-500/80 hover:bg-red-500 text-white shrink-0 cursor-pointer mb-0.5"
                aria-label="Cancel edit"
              >
                <div className="w-2 h-2 bg-current rounded-sm"></div>
              </button>
            ) : (
              (editPrompt.trim() || editInsertedImages.size > 0) && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleEditSubmit()
                  }}
                  className="w-7 h-7 rounded-full flex items-center justify-center transition-all duration-300 shrink-0 cursor-pointer bg-(--chat-input-primary) text-(--chat-input-primary-foreground) mb-0.5"
                  style={{ border: 'none' }}
                  aria-label="Apply edit"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" className="transition-transform duration-300">
                    <path
                      d="M12 2L12 22M5 9L12 2L19 9"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    ></path>
                  </svg>
                </button>
              )
            )}
          </div>

          {currentSlide && !currentSlide.isGenerating && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                if (currentSlide.isOriginal) {
                  setShowVisibilitySelector(true)
                } else {
                  handleSaveSlide(currentSlide, latestMetadata)
                }
              }}
              className="flex items-center justify-center w-10 h-10 rounded-full text-white transition-colors cursor-pointer shrink-0"
              disabled={savingSlides.has(currentSlide.id) || savedSlides.has(currentSlide.id)}
              style={{
                ...getAdaptiveGlassStyleBlur(),
                backgroundColor: (savingSlides.has(currentSlide.id) || savedSlides.has(currentSlide.id)) ? 'rgba(34, 197, 94, 0.6)' : undefined
              }}
              title={savingSlides.has(currentSlide.id) ? 'Saving...' : savedSlides.has(currentSlide.id) ? 'Saved' : 'Save image'}
            >
              {savingSlides.has(currentSlide.id) ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : savedSlides.has(currentSlide.id) ? (
                <Check className="w-6 h-6" />
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
                </svg>
              )}
            </button>
          )}
        </div>
      )}

      {/* Bottom controls (Non-edit or Desktop edit) */}
      {!showVisibilitySelector && !(isEditMode && isMobile) && (
        <div className="fixed bottom-4 left-4 z-30 flex items-center gap-3">
          <button
            onClick={() => { setShowHistory(false); setShowPromptOverlay(true); }}
            className={`px-4 py-3 rounded-full text-white transition-colors cursor-pointer flex items-center ${isMobile ? 'p-3' : 'gap-2'}`}
            style={getAdaptiveGlassStyleBlur()}
          >
            <ScrollText size={20} />
            {!isMobile && <span className="text-sm font-medium">Prompt</span>}
          </button>
        </div>
      )}

      {!isEditMode && (
        <button
          onClick={() => setShowVisibilitySelector(true)}
          className="absolute bottom-4 right-4 z-30 p-2 rounded-full text-white transition-colors cursor-pointer"
          disabled={isSaving || isOriginalSaved}
          style={{
            ...getAdaptiveGlassStyleBlur(),
            ...((isSaving || isOriginalSaved) && { backgroundColor: 'rgba(34, 197, 94, 0.6)' })
          }}
        >
          {isSaving ? (
            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : isOriginalSaved ? (
            <Check size={24} />
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" /></svg>
          )}
        </button>
      )}

      {isEditMode && !isMobile && currentSlide && !currentSlide.isGenerating && (
        <button
          className="absolute bottom-4 right-4 p-2.5 rounded-full text-white transition-colors z-10000 cursor-pointer"
          onClick={() => currentSlide.isOriginal ? setShowVisibilitySelector(true) : handleSaveSlide(currentSlide, latestMetadata)}
          disabled={savingSlides.has(currentSlide.id) || savedSlides.has(currentSlide.id)}
          style={{
            ...getAdaptiveGlassStyleBlur(),
            ...((savingSlides.has(currentSlide.id) || savedSlides.has(currentSlide.id)) && { backgroundColor: 'rgba(34, 197, 94, 0.6)' })
          }}
        >
          {savingSlides.has(currentSlide.id) ? (
            <div className="w-7 h-7 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : savedSlides.has(currentSlide.id) ? (
            <Check size={28} />
          ) : (
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" /></svg>
          )}
        </button>
      )}

      {/* Hidden file input for image upload in edit mode */}
      {isEditMode && (
        <input
          type="file"
          accept="image/*"
          multiple={true}
          ref={fileInputRef}
          className="hidden"
          onChange={async (e) => {
            if (e.target.files && e.target.files.length > 0) {
              // Ensure contentEditable is focused
              if (editContentEditableRef.current && !editContentEditableRef.current.contains(document.activeElement)) {
                editContentEditableRef.current.focus()
              }
              // Insert images at cursor
              const files = Array.from(e.target.files)
              for (const file of files) {
                if (file.type.startsWith('image/')) {
                  await insertImageIntoEditContentEditable(file)
                }
              }
              // Reset file input
              e.target.value = ''
            }
          }}
          disabled={isCurrentSlideGenerating}
        />
      )}
    </div>
  )
}

