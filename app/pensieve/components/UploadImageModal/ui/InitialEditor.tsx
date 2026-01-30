import React, { useEffect } from 'react'
import { Type, Image, Loader2 } from 'lucide-react'
import { getAdaptiveGlassStyleBlur, getTextStyle as getTextStyleUtil, getIconClassName as getIconClassNameUtil } from '@/app/lib/adaptiveGlassStyle'
import { ImageMetadata } from '../types'
import { highlightPrompt } from './PromptRenderer'
import { ModelSelector, UploadButton, GenerateButton, ExtractPromptButton } from './Controls'
import { normalizeJsonPrompt } from '../utils/normalizeJson'
import { parsePastedPromptHtml, fetchImageAsFile, hasPensieveImages } from '../utils/richClipboard'

interface InitialEditorProps {
  shouldUseDarkText: boolean
  isDragging: boolean
  setIsDragging: (isDragging: boolean) => void
  modelSelectorRef: React.RefObject<HTMLDivElement | null>
  isGeneratingImage: boolean
  setShowModelSelector: React.Dispatch<React.SetStateAction<boolean>>
  setDropdownPosition: React.Dispatch<React.SetStateAction<{ top: number; left: number } | null>>
  selectedModel: 'nano-banana-pro' | 'seadream-4.5' | 'gpt-image-1.5' | 'qwen-image-edit-2511'
  hasInitialBackgroundImage: boolean
  contentEditableRef: React.RefObject<HTMLDivElement | null>
  setGeneratePrompt: (text: string) => void
  setInsertedImages: React.Dispatch<React.SetStateAction<Map<string, { blobUrl: string; base64: string; file: File }>>>
  insertImageIntoContentEditable: (file: File) => Promise<any>
  handleGenerateImage: () => Promise<void>
  onDrop: (e: React.DragEvent<HTMLDivElement>) => Promise<void>
  fileInputRef: React.RefObject<HTMLInputElement | null>
  extractSearchQuery: () => { query: string; hasQuery: boolean }
  filteredGalleryImages: Array<{ image: any; folder: string }> // TODO: Use proper type
  handleGalleryImageClick: (image: any) => void
  promptToString: (prompt: string | object | undefined | null) => string
  isLoadingGallery: boolean
  insertedImages: Map<string, { blobUrl: string; base64: string; file: File }>
  handleExtractPromptAndGenerate?: () => Promise<void>
  isPromptGenerating?: boolean
  generatePrompt: string
  isMobile: boolean
  prevTextRef: React.MutableRefObject<string>
  showExtractButton?: boolean
}

export function InitialEditor({
  shouldUseDarkText,
  isDragging,
  setIsDragging,
  modelSelectorRef,
  isGeneratingImage,
  setShowModelSelector,
  setDropdownPosition,
  selectedModel,
  hasInitialBackgroundImage,
  contentEditableRef,
  setGeneratePrompt,
  setInsertedImages,
  insertImageIntoContentEditable,
  handleGenerateImage,
  onDrop,
  fileInputRef,
  extractSearchQuery,
  filteredGalleryImages,
  handleGalleryImageClick,
  promptToString,
  isLoadingGallery,
  insertedImages,
  handleExtractPromptAndGenerate,
  isPromptGenerating = false,
  generatePrompt,
  isMobile,
  prevTextRef,
  showExtractButton = true
}: InitialEditorProps) {
  // Helper to get styles
  const getTextStyle = (hasBg: boolean) => getTextStyleUtil(hasBg)
  const getIconClassName = (hasBg: boolean) => getIconClassNameUtil(hasBg)
  
  // Auto-focus on mount
  useEffect(() => {
    if (!isGeneratingImage && contentEditableRef.current) {
      // Use requestAnimationFrame to ensure DOM is ready
      const rafId = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (contentEditableRef.current && document.activeElement !== contentEditableRef.current) {
            contentEditableRef.current.focus()
            
            // Move cursor to start if empty
            const range = document.createRange()
            const selection = window.getSelection()
            
            if (contentEditableRef.current.childNodes.length > 0) {
              const lastNode = contentEditableRef.current.lastChild
              if (lastNode?.nodeType === Node.TEXT_NODE) {
                range.setStart(lastNode, lastNode.textContent?.length || 0)
              } else {
                range.selectNodeContents(contentEditableRef.current)
                range.collapse(false)
              }
            } else {
              range.setStart(contentEditableRef.current, 0)
              range.collapse(true)
            }
            
            selection?.removeAllRanges()
            selection?.addRange(range)
          }
        })
      })
      return () => cancelAnimationFrame(rafId)
    }
  }, [contentEditableRef, isGeneratingImage])
  
  // Initial text color calculation
  const initialEditorTextColor = (() => {
    if (hasInitialBackgroundImage) return '#FFFFFF'
    return shouldUseDarkText ? 'rgba(15, 23, 42, 0.95)' : '#FFFFFF'
  })()

  // Check if editor has content
  const hasContent = generatePrompt.trim() || insertedImages.size > 0

  // Handle click anywhere on screen to focus editor
  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement
    
    // 텍스트 선택이 진행 중이거나 선택된 텍스트가 있으면 커서 이동하지 않음
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      // 선택된 텍스트가 있고, 선택이 collapsed되지 않았으면 (실제로 텍스트가 선택된 상태)
      if (!range.collapsed && range.toString().trim().length > 0) {
        return // 텍스트 선택을 유지하고 커서 이동하지 않음
      }
    }
    
    // Don't interfere with buttons, images, or interactive elements
    const isButton = target.closest('button') || target.closest('[role="button"]')
    const isFixedButton = target.closest('.fixed')
    const isImage = target.closest('img[data-image-id]') || target.closest('div[contenteditable="false"]')
    const isGallery = target.closest('[class*="grid"]') || target.closest('[class*="Gallery"]')
    const isModelSelector = target.closest('[class*="ModelSelector"]') || modelSelectorRef.current?.contains(target)
    
    // If clicking on contentEditable itself, let it handle the click
    if (target.closest('[contenteditable="true"]')) {
      return
    }
    
    // Focus editor on any other click - be more aggressive
    if (!isButton && !isFixedButton && !isImage && !isGallery && !isModelSelector && !isGeneratingImage) {
      // Don't prevent default or stop propagation - just focus
      if (contentEditableRef.current) {
        // Use requestAnimationFrame to ensure DOM is ready
        requestAnimationFrame(() => {
          if (contentEditableRef.current) {
            contentEditableRef.current.focus()
            
            // Move cursor to end or create new line if empty
            const range = document.createRange()
            const selection = window.getSelection()
            
            if (contentEditableRef.current.childNodes.length > 0) {
              const lastNode = contentEditableRef.current.lastChild
              if (lastNode?.nodeType === Node.TEXT_NODE) {
                range.setStart(lastNode, lastNode.textContent?.length || 0)
              } else if (lastNode?.nodeType === Node.ELEMENT_NODE) {
                // If last node is an element (like image container), place cursor after it
                range.setStartAfter(lastNode)
              } else {
                range.selectNodeContents(contentEditableRef.current)
                range.collapse(false)
              }
            } else {
              // Empty editor - set cursor at start
              range.setStart(contentEditableRef.current, 0)
              range.collapse(true)
            }
            
            selection?.removeAllRanges()
            selection?.addRange(range)
          }
        })
      }
    }
  }

  return (
    <div 
      className={`relative w-full h-full flex flex-col overflow-hidden ${shouldUseDarkText ? 'text-slate-950' : 'text-white'}`}
      onClick={handleContainerClick}
      onDragOver={(e) => {
        e.preventDefault()
        setIsDragging(true)
      }}
      onDragLeave={(e) => {
        e.preventDefault()
        setIsDragging(false)
      }}
      onDrop={onDrop}
    >
      {/* Model selector - top center */}
      <ModelSelector
        modelSelectorRef={modelSelectorRef}
        selectedModel={selectedModel}
        isGenerating={isGeneratingImage}
        hasBg={hasInitialBackgroundImage}
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

      {/* Placeholder - Minimal quote style centered on screen */}
      {!hasContent && !isGeneratingImage && (
        <>
          <div 
            className="fixed inset-0 flex items-center justify-center pointer-events-none select-none z-5 transition-opacity duration-200 pt-20"
            style={{ outline: 'none' }}
          >
            <div className="text-left max-w-md animate-in fade-in slide-in-from-bottom-4 duration-1000 px-8">
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
            </div>
          </div>

          {/* Input hint icons - Positioned at cursor location */}
          <div className="absolute inset-0 pointer-events-none z-5 overflow-hidden flex flex-col items-center" style={{ paddingTop: '80px' }}>
            <div className="w-full max-w-3xl px-6 md:px-8">
              <div className="pt-3 pl-1 flex items-center gap-4 text-white/40 animate-in fade-in slide-in-from-left-2 duration-700">
                <Type size={18} strokeWidth={1.5} />
                <Image size={18} strokeWidth={1.5} />
              </div>
            </div>
          </div>
        </>
      )}

      {/* Main interaction area - Simple Notion style */}
      <div 
        className={`relative z-10 w-full h-full flex flex-col items-center overflow-y-auto ${
          isDragging ? 'opacity-50' : ''
        }`} 
        onClick={handleContainerClick}
        style={{
          paddingTop: '80px',
          paddingBottom: '350px',
          transform: 'translateX(calc(var(--direction, 1) * 0px))',
          transitionDuration: '200ms',
          transitionTimingFunction: 'ease',
          transitionProperty: 'transform'
        }}
      >
        {/* Editor container - Full height for clickable area */}
        <div className="w-full max-w-3xl px-6 md:px-8 relative flex-1 flex flex-col">
          {/* ContentEditable - Always rendered like Notion, full height */}
          <div
            ref={contentEditableRef}
            contentEditable={!isGeneratingImage}
            suppressContentEditableWarning
            onInput={(e) => {
                const target = e.currentTarget
                const text = target.textContent || ''
                setGeneratePrompt(text)
                
                // Sync insertedImages with actual DOM images
                const domImages = target.querySelectorAll('img[data-image-id]')
                const domImageIds = new Set(Array.from(domImages).map(img => img.getAttribute('data-image-id')).filter(Boolean) as string[])
                
                // Remove images from state that are no longer in DOM
                setInsertedImages(prev => {
                  const next = new Map(prev)
                  let hasChanges = false
                  for (const [imageId] of prev) {
                    if (!domImageIds.has(imageId)) {
                      next.delete(imageId)
                      hasChanges = true
                    }
                  }
                  return hasChanges ? next : prev
                })
                
                prevTextRef.current = text
              }}
              onPaste={async (e) => {
                e.preventDefault()
                
                // Capture references before async operations (React pools events)
                const target = e.currentTarget as HTMLDivElement
                const clipboardItems = Array.from(e.clipboardData.items)
                const html = e.clipboardData.getData('text/html')
                const plainText = e.clipboardData.getData('text/plain')
                
                let hasDirectImage = false
                
                // Check for direct image paste (file)
                for (const item of clipboardItems) {
                  if (item.type.indexOf('image') !== -1) {
                    const file = item.getAsFile()
                    if (file) {
                      insertImageIntoContentEditable(file)
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
                          await insertImageIntoContentEditable(file)
                        }
                      } else if (part.trim()) {
                        const normalizedPart = normalizeJsonPrompt(part)
                        document.execCommand('insertText', false, normalizedPart)
                      }
                    }
                    
                    // Update state using captured target
                    const newText = target?.textContent || ''
                    setGeneratePrompt(newText)
                    return
                  }
                }

                // If no image, paste text normally
                let text = plainText
                
                // Clean and normalize JSON if detected
                text = normalizeJsonPrompt(text)
                
                document.execCommand('insertText', false, text)
                
                // Update state using captured target
                const newText = target?.textContent || ''
                setGeneratePrompt(newText)
              }}
              onDrop={(e) => {
                e.preventDefault()
                e.stopPropagation()
                const files = e.dataTransfer.files
                if (files.length > 0) {
                  const fileList = Array.from(files)
                  for (const file of fileList) {
                    if (file.type.startsWith('image/')) {
                      insertImageIntoContentEditable(file)
                    }
                  }
                }
              }}
              onKeyDown={(e) => {
                // Handle Backspace/Delete to remove images properly
                if ((e.key === 'Backspace' || e.key === 'Delete') && contentEditableRef.current) {
                  const selection = window.getSelection()
                  if (selection && selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0)
                    let nodeToDelete: HTMLElement | null = null
                    
                    if (e.key === 'Backspace') {
                      // Check node before cursor
                      if (range.collapsed) {
                        const startContainer = range.startContainer
                        const startOffset = range.startOffset
                        
                        if (startContainer.nodeType === Node.TEXT_NODE) {
                          if (startOffset === 0) {
                            const prevSibling = startContainer.previousSibling
                            // Check if it's a DIV container with an image
                            if (prevSibling && prevSibling.nodeName === 'DIV') {
                              const img = (prevSibling as HTMLElement).querySelector('img[data-image-id]')
                              if (img) {
                                nodeToDelete = prevSibling as HTMLElement
                              }
                            } else if (prevSibling && prevSibling.nodeName === 'IMG') {
                              nodeToDelete = prevSibling as HTMLElement
                            }
                          }
                        } else if (startContainer.nodeType === Node.ELEMENT_NODE) {
                          const prevSibling = startContainer.childNodes[startOffset - 1]
                          // Check if it's a DIV container with an image
                          if (prevSibling && prevSibling.nodeName === 'DIV') {
                            const img = (prevSibling as HTMLElement).querySelector('img[data-image-id]')
                            if (img) {
                              nodeToDelete = prevSibling as HTMLElement
                            }
                          } else if (prevSibling && prevSibling.nodeName === 'IMG') {
                            nodeToDelete = prevSibling as HTMLElement
                          }
                        }
                      }
                    } else if (e.key === 'Delete') {
                      // Check node after cursor
                      if (range.collapsed) {
                        const startContainer = range.startContainer
                        const startOffset = range.startOffset
                        
                        if (startContainer.nodeType === Node.TEXT_NODE) {
                          if (startOffset === startContainer.textContent?.length) {
                            const nextSibling = startContainer.nextSibling
                            // Check if it's a DIV container with an image
                            if (nextSibling && nextSibling.nodeName === 'DIV') {
                              const img = (nextSibling as HTMLElement).querySelector('img[data-image-id]')
                              if (img) {
                                nodeToDelete = nextSibling as HTMLElement
                              }
                            } else if (nextSibling && nextSibling.nodeName === 'IMG') {
                              nodeToDelete = nextSibling as HTMLElement
                            }
                          }
                        } else if (startContainer.nodeType === Node.ELEMENT_NODE) {
                          const nextSibling = startContainer.childNodes[startOffset]
                          // Check if it's a DIV container with an image
                          if (nextSibling && nextSibling.nodeName === 'DIV') {
                            const img = (nextSibling as HTMLElement).querySelector('img[data-image-id]')
                            if (img) {
                              nodeToDelete = nextSibling as HTMLElement
                            }
                          } else if (nextSibling && nextSibling.nodeName === 'IMG') {
                            nodeToDelete = nextSibling as HTMLElement
                          }
                        }
                      }
                    }
                    
                    if (nodeToDelete) {
                      e.preventDefault()
                      // If it's a container, find the image inside
                      let img: HTMLImageElement | null = null
                      if (nodeToDelete.nodeName === 'DIV') {
                        img = nodeToDelete.querySelector('img[data-image-id]')
                      } else if (nodeToDelete.nodeName === 'IMG') {
                        img = nodeToDelete as HTMLImageElement
                      }
                      
                      const imageId = img?.getAttribute('data-image-id')
                      if (imageId) {
                        // Remove the container (DIV) or the image itself first
                        nodeToDelete.remove()
                        
                        // Update state - remove image from insertedImages
                        setInsertedImages(prev => {
                          const next = new Map(prev)
                          next.delete(imageId)
                          return next
                        })
                        
                        // Update prompt text
                        const currentText = contentEditableRef.current?.textContent || ''
                        setGeneratePrompt(currentText)
                      }
                      return
                    }
                  }
                }

                // Shift+Enter: new line, Enter: submit
                if (e.key === 'Enter' && !e.shiftKey) {
                  const text = contentEditableRef.current?.textContent || ''
                  const hasImages = insertedImages.size > 0
                  if (text.trim() || hasImages) {
                    e.preventDefault()
                    handleGenerateImage()
                  }
                }
                // Escape: clear and exit typing mode
                if (e.key === 'Escape') {
                  if (contentEditableRef.current) {
                    contentEditableRef.current.textContent = ''
                    contentEditableRef.current.innerHTML = ''
                  }
                  setGeneratePrompt('')
                  setInsertedImages(new Map())
                  contentEditableRef.current?.blur()
                }
              }}
              onClick={(e) => {
                const target = e.target as HTMLElement
                const selection = window.getSelection()
                
                // If clicking on an image container, don't interfere
                if (target.closest('div[contenteditable="false"]')?.querySelector('img[data-image-id]')) {
                  return
                }
                
                // 텍스트 선택이 진행 중이거나 선택된 텍스트가 있으면 부모 핸들러 실행 방지
                if (selection && selection.rangeCount > 0) {
                  const range = selection.getRangeAt(0)
                  if (!range.collapsed && range.toString().trim().length > 0) {
                    e.stopPropagation()
                    return // 텍스트 선택을 유지
                  }
                }
                
                // 부모의 handleContainerClick이 실행되지 않도록 stopPropagation
                e.stopPropagation()
                
                // Ensure contentEditable is focused
                if (contentEditableRef.current && document.activeElement !== contentEditableRef.current) {
                  contentEditableRef.current.focus()
                }
                
                // Use caretRangeFromPoint to place cursor at click position
                if (document.caretRangeFromPoint && selection) {
                  try {
                    const range = document.caretRangeFromPoint(e.clientX, e.clientY)
                    if (range && contentEditableRef.current?.contains(range.commonAncestorContainer)) {
                      selection.removeAllRanges()
                      selection.addRange(range)
                    }
                  } catch (err) {
                    // Fallback: if no valid range, place cursor at end
                    if (contentEditableRef.current) {
                      const range = document.createRange()
                      const lastNode = contentEditableRef.current.lastChild
                      if (lastNode?.nodeType === Node.TEXT_NODE) {
                        range.setStart(lastNode, lastNode.textContent?.length || 0)
                      } else {
                        range.selectNodeContents(contentEditableRef.current)
                        range.collapse(false)
                      }
                      selection?.removeAllRanges()
                      selection?.addRange(range)
                    }
                  }
                }
              }}
              className="w-full flex-1 bg-transparent font-normal text-left outline-none focus:outline-none ring-0 focus:ring-0 border-none no-underline transition-all duration-200 cursor-text"
              style={{
                color: initialEditorTextColor,
                caretColor: initialEditorTextColor,
                fontSize: '1.125rem',
                lineHeight: '1.625',
                minHeight: '100%',
                textDecoration: 'none',
                textDecorationLine: 'none',
                WebkitTextFillColor: initialEditorTextColor,
                WebkitBoxShadow: 'none',
                boxShadow: 'none',
                border: 'none',
                outline: 'none',
                paddingTop: '0.5rem',
                paddingBottom: '0.5rem'
              }}
            />
        </div>

        {/* Gallery - shown when there's a query */}
        {extractSearchQuery().hasQuery && (
          <div 
            className="w-full max-w-3xl px-6 md:px-8 mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500"
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {filteredGalleryImages.slice(0, 20).map((item, idx) => (
                <div
                  key={`${item.folder}-${item.image.path}-${idx}`}
                  className="relative aspect-square rounded-2xl overflow-hidden cursor-pointer border-2 transition-all duration-300 group border-white/5 hover:border-white/40 hover:scale-[1.02] active:scale-95 shadow-lg"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleGalleryImageClick(item.image)
                  }}
                >
                  <img
                    src={item.image.url || `/pensieve/${item.image.path}`}
                    alt={promptToString(item.image.prompt) || 'Gallery image'}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    onError={(e) => {
                      const target = e.currentTarget as HTMLImageElement
                      target.style.display = 'none'
                    }}
                  />
                  {/* Prompt preview with highlight - only shown on hover */}
                  {item.image.prompt && (
                    <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-3">
                      <div className="text-xs text-white/90 line-clamp-3 font-medium leading-relaxed">
                        {highlightPrompt(promptToString(item.image.prompt), extractSearchQuery().query)}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Loading state for gallery */}
        {isLoadingGallery && extractSearchQuery().hasQuery && (
          <div className="w-full max-w-3xl px-6 md:px-8 mt-4 text-left text-white/60 text-sm">
            Loading gallery...
          </div>
        )}
      </div>

      {/* Bottom left + button (for upload) */}
      <UploadButton
        onClick={async (e) => {
          e.preventDefault()
          e.stopPropagation()
          if (!isGeneratingImage && fileInputRef.current) {
            // Focus the contentEditable first to ensure cursor position is set
            contentEditableRef.current?.focus()
            // Click file input
            fileInputRef.current.click()
          }
        }}
        disabled={isGeneratingImage}
        hasBg={hasInitialBackgroundImage}
      />

      {/* Extract Prompt button - only when single image only (no text) */}
      {showExtractButton && handleExtractPromptAndGenerate && (() => {
        const domImages = contentEditableRef.current?.querySelectorAll('img[data-image-id]') || []
        const hasSingleImage = domImages.length === 1 && insertedImages.size === 1
        const hasNoText = !contentEditableRef.current?.textContent?.trim() && !generatePrompt.trim()
        return hasSingleImage && hasNoText && !isGeneratingImage
      })() && (
        <ExtractPromptButton
          onClick={(e) => {
            e.stopPropagation()
            handleExtractPromptAndGenerate()
          }}
          isGenerating={isPromptGenerating}
        />
      )}

      {/* Bottom right send button (blue arrow) - only when has content */}
      {hasContent && !isGeneratingImage && (
        <GenerateButton
          onClick={(e) => {
            e.stopPropagation()
            handleGenerateImage()
          }}
          disabled={isGeneratingImage}
        />
      )}

      {/* Loading indicator */}
      {isGeneratingImage && (
        <GenerateButton onClick={() => {}} isGenerating={true} />
      )}
      
      {/* Hidden file input */}
      <input
        type="file"
        accept="image/*"
        multiple={true}
        ref={fileInputRef}
        className="hidden"
        onChange={async (e) => {
          if (e.target.files && e.target.files.length > 0) {
            // Ensure contentEditable is focused
            if (contentEditableRef.current && !contentEditableRef.current.contains(document.activeElement)) {
              contentEditableRef.current.focus()
            }
            // Insert images at cursor
            const files = Array.from(e.target.files)
            for (const file of files) {
              if (file.type.startsWith('image/')) {
                await insertImageIntoContentEditable(file)
              }
            }
            // Reset file input
            e.target.value = ''
          }
        }}
        disabled={isGeneratingImage}
      />
    </div>
  )
}

