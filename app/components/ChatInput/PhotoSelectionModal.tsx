'use client'

import React, { useState, useEffect, useCallback } from 'react'
import ReactDOM from 'react-dom'
import { X, Check } from 'lucide-react'
import { getAdaptiveGlassStyleBlur, getAdaptiveGlassBackgroundColor } from '@/app/lib/adaptiveGlassStyle'
import { MODAL_SHEET_Z } from '@/app/lib/zIndex'
import { PhotoProvider, usePhotoSelection } from '@/app/photo/components/PhotoContext'
import AllSection from '@/app/photo/components/AllSection'
import { createClient } from '@/utils/supabase/client'

interface PhotoSelectionModalProps {
  isOpen: boolean
  onClose: () => void
  user: { id: string; isAnonymous?: boolean } | null
  currentBackground: string
  backgroundType: 'default' | 'custom'
  backgroundId: string | undefined
  onBackgroundChange: (backgroundUrl: string, type: 'default' | 'custom', id?: string) => void
  onSelectImages: (files: File[]) => void
}

// Convert image URL to File object
async function urlToFile(url: string, filename: string): Promise<File> {
  const response = await fetch(url)
  const blob = await response.blob()
  return new File([blob], filename, { type: blob.type || 'image/jpeg' })
}

// Inner component that uses PhotoContext
function PhotoSelectionModalContent({
  user,
  currentBackground,
  backgroundType,
  backgroundId,
  onBackgroundChange,
  onSelectImages,
  onClose,
  isMobile,
  showElements,
  isClosing,
  isProcessing,
  setIsProcessing
}: {
  user: { id: string; isAnonymous?: boolean } | null
  currentBackground: string
  backgroundType: 'default' | 'custom'
  backgroundId: string | undefined
  onBackgroundChange: (backgroundUrl: string, type: 'default' | 'custom', id?: string) => void
  onSelectImages: (files: File[]) => void
  onClose: () => void
  isMobile: boolean
  showElements: { modal: boolean; title: boolean; content: boolean }
  isClosing: boolean
  isProcessing: boolean
  setIsProcessing: (value: boolean) => void
}) {
  const { selectedImageIds, isSelectionMode, setIsSelectionMode, clearSelection } = usePhotoSelection()
  const supabase = createClient()

  // 모달이 열릴 때 선택 모드 활성화 (한 번만 실행)
  useEffect(() => {
    if (!isSelectionMode) {
      setIsSelectionMode(true)
    }
    return () => {
      setIsSelectionMode(false)
      clearSelection()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // 빈 배열로 마운트 시 한 번만 실행

  // Handle confirm selection - convert all selected images to Files and attach
  const handleConfirmSelection = useCallback(async () => {
    if (isProcessing || !user?.id || selectedImageIds.length === 0) return

    setIsProcessing(true)
    try {
      // Fetch all selected images from database
      const { data, error } = await supabase
        .from('user_background_settings')
        .select('id, background_url, background_path, name, url_expires_at, bucket_name, source')
        .eq('user_id', user.id)
        .in('id', selectedImageIds)

      if (error || !data || data.length === 0) {
        console.error('Error fetching selected images:', error)
        return
      }

      // Process images and refresh URLs if needed
      const processedImages = await Promise.all(
        data.map(async (img) => {
          // Check if it's a video (skip videos)
          const isVideo = (img as any).metadata?.mediaType === 'video' || 
                         (img.background_path && /\.(mp4|webm|mov|avi)$/i.test(img.background_path))
          
          if (isVideo) {
            return null
          }

          let url = img.background_url

          // Check if URL needs refresh
          const needsRefresh = !url || 
            !img.url_expires_at || 
            (img.url_expires_at && new Date(img.url_expires_at) < new Date())

          if (needsRefresh && img.background_path) {
            try {
              // Try API first
              const response = await fetch('/api/photo/refresh-url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  userId: user.id,
                  imageId: img.id 
                })
              })

              if (response.ok) {
                const refreshed = await response.json()
                url = refreshed.imageUrl
              } else {
                // Fallback to direct Supabase call
                const bucketName = img.bucket_name || 
                  (img.source === 'upload' ? 'chat_attachments' : 'saved-gallery')

                const { data: signedData } = await supabase.storage
                  .from(bucketName)
                  .createSignedUrl(img.background_path, 24 * 60 * 60)

                if (signedData?.signedUrl) {
                  url = signedData.signedUrl
                }
              }
            } catch (error) {
              console.error('Failed to refresh URL for image:', img.id, error)
            }
          }

          if (!url) {
            return null
          }

          // Convert to File object
          const ext = url.split('.').pop()?.split('?')[0] || 'jpg'
          const filename = img.name || `image-${img.id}.${ext}`
          return urlToFile(url, filename)
        })
      )

      // Filter out null values (videos or failed conversions)
      const files = (await Promise.all(processedImages)).filter((file): file is File => file !== null)

      if (files.length === 0) {
        console.error('No valid images to attach')
        return
      }

      // Attach all images
      onSelectImages(files)
      onClose()
    } catch (error) {
      console.error('Error processing selected images:', error)
    } finally {
      setIsProcessing(false)
    }
  }, [user?.id, supabase, selectedImageIds, onSelectImages, onClose, isProcessing, setIsProcessing])

  return (
    <>
      <AllSection 
        user={user} 
        currentBackground={currentBackground} 
        backgroundType={backgroundType} 
        backgroundId={backgroundId} 
        onBackgroundChange={() => onBackgroundChange('', 'default')}
        hideActionButtons={true}
        disableVideos={true}
      />
      {/* Blue Check Button */}
      {selectedImageIds.length > 0 && (
        <button
          onClick={handleConfirmSelection}
          disabled={isProcessing}
          className={`fixed bottom-4 right-4 w-16 h-16 rounded-full flex items-center justify-center cursor-pointer transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed ${isMobile ? 'z-[100001]' : ''}`}
          style={{
            color: 'white',
            backgroundColor: '#007AFF',
            border: '1px solid #007AFF',
            boxShadow: '0 8px 40px rgba(0, 122, 255, 0.3), 0 4px 20px rgba(0, 122, 255, 0.2), 0 2px 8px rgba(0, 122, 255, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
            ...(isMobile ? {} : { zIndex: MODAL_SHEET_Z + 1 }),
          }}
          aria-label="Confirm selection"
        >
          {isProcessing ? (
            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Check size={24} />
          )}
        </button>
      )}
    </>
  )
}

export function PhotoSelectionModal({
  isOpen,
  onClose,
  user,
  currentBackground,
  backgroundType,
  backgroundId,
  onBackgroundChange,
  onSelectImages
}: PhotoSelectionModalProps) {
  const [isProcessing, setIsProcessing] = useState(false)

  // 드래그·트랜지션 (모바일, BackgroundSettingsModal과 동일)
  const [isMobile, setIsMobile] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStartY, setDragStartY] = useState(0)
  const [currentTranslateY, setCurrentTranslateY] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [showElements, setShowElements] = useState({ modal: false, title: false, content: false })
  const [panelElements, setPanelElements] = useState({ background: false, content: false })

  useEffect(() => {
    const check = () => setIsMobile(typeof window !== 'undefined' && (window.innerWidth < 768 || 'ontouchstart' in window))
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isMobile) return
    setIsDragging(true)
    setDragStartY(e.touches[0].clientY)
    setCurrentTranslateY(0)
  }, [isMobile])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isMobile || !isDragging) return
    e.preventDefault()
    const currentY = e.touches[0].clientY
    const diff = currentY - dragStartY
    if (diff > 0) setCurrentTranslateY(diff)
  }, [isMobile, isDragging, dragStartY])

  const handleClose = useCallback(() => {
    if (isMobile) {
      setIsClosing(true)
      setTimeout(() => setShowElements(prev => ({ ...prev, content: false })), 0)
      setTimeout(() => setShowElements(prev => ({ ...prev, title: false })), 100)
      setTimeout(() => setShowElements(prev => ({ ...prev, modal: false })), 400)
      setTimeout(() => {
        onClose()
        setIsClosing(false)
      }, 500)
    } else {
      onClose()
    }
  }, [isMobile, onClose])

  const handleTouchEnd = useCallback(() => {
    if (!isMobile || !isDragging) return
    setIsDragging(false)
    if (currentTranslateY > 100) {
      handleClose()
    } else {
      setCurrentTranslateY(0)
    }
  }, [isMobile, isDragging, currentTranslateY, handleClose])

  // 모달 오픈/클로즈 시 상태 리셋
  useEffect(() => {
    if (!isOpen) {
      setIsDragging(false)
      setCurrentTranslateY(0)
      setIsAnimating(false)
      setIsClosing(false)
      setShowElements({ modal: false, title: false, content: false })
      setPanelElements({ background: false, content: false })
      setIsProcessing(false)
    }
  }, [isOpen])

  // 모바일: ModelSelector 스태거드 오픈 / 데스크탑: Launchpad 스타일 오픈
  useEffect(() => {
    if (!isOpen) return
    if (isMobile) {
      if (isAnimating) return
      setIsAnimating(true)
      setShowElements({ modal: false, title: false, content: false })
      const t = [
        setTimeout(() => setShowElements(prev => ({ ...prev, modal: true })), 20),
        setTimeout(() => setShowElements(prev => ({ ...prev, title: true })), 250),
        setTimeout(() => setShowElements(prev => ({ ...prev, content: true })), 350),
        setTimeout(() => setIsAnimating(false), 550)
      ]
      return () => t.forEach(clearTimeout)
    } else {
      // 데스크탑: 애니메이션 없이 즉시 표시
      setPanelElements({ background: true, content: true })
    }
  }, [isOpen, isMobile])


  if (!isOpen) return null

  const modalContent = (
    <div className="fixed inset-0" style={{ touchAction: 'none', overflow: 'hidden', zIndex: MODAL_SHEET_Z }}>
      {isMobile ? (
        <>
          <div
            className={`fixed inset-0 bg-transparent transition-all duration-500 ease-out ${showElements.modal ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            onClick={handleClose}
            style={{ touchAction: 'none', zIndex: MODAL_SHEET_Z - 1 }}
          />
          <div
            className="fixed inset-x-0 bottom-0 w-full flex flex-col overflow-hidden rounded-t-3xl"
            style={{
              height: 'calc(100vh - 120px)',
              maxHeight: 'calc(100vh - 120px)',
              transform: !showElements.modal ? 'translateY(calc(100vh - 60px))' : `translateY(${currentTranslateY}px)`,
              transition: isDragging ? 'none' : showElements.modal ? 'transform 0.5s cubic-bezier(0.25, 0.1, 0.25, 1), opacity 0.3s ease-out' : 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease-out',
              willChange: 'transform, opacity',
              opacity: showElements.modal ? 1 : 0,
              ...getAdaptiveGlassStyleBlur(),
              backgroundColor: getAdaptiveGlassBackgroundColor().backgroundColor,
              backdropFilter: 'blur(40px)',
              WebkitBackdropFilter: 'blur(40px)',
              zIndex: MODAL_SHEET_Z
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={`text-center pt-4 pb-2 shrink-0 transition-all duration-250 ease-out ${showElements.title ? 'translate-y-0 opacity-100' : isClosing ? 'translate-y-6 opacity-0' : 'translate-y-6 opacity-0'}`}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              style={{ touchAction: 'none', willChange: 'transform, opacity' }}
            >
              <div className="w-12 h-1.5 rounded-full mx-auto transition-colors duration-200" style={{ backgroundColor: isDragging ? 'rgba(156, 163, 175, 0.4)' : 'rgba(209, 213, 219, 0.3)' }} />
            </div>
            <div
              className={`relative flex items-center justify-center py-6 px-6 shrink-0 transition-all duration-250 ease-out ${showElements.title ? 'translate-y-0 opacity-100' : isClosing ? 'translate-y-6 opacity-0' : 'translate-y-6 opacity-0'}`}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              style={{ touchAction: 'none', willChange: 'transform, opacity' }}
            >
              <h2 className="text-xl font-semibold" style={{ color: 'rgba(255, 255, 255)' }}>Photos</h2>
              <button
                onClick={handleClose}
                className="absolute right-6 p-2 rounded-lg transition-colors hover:bg-white/10"
                style={{ WebkitTapHighlightColor: 'transparent' }}
                aria-label="Close"
              >
                <X size={24} style={{ color: 'rgba(255, 255, 255)' }} />
              </button>
            </div>
            <div className={`flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 pb-6 transition-all duration-300 ease-out ${showElements.content ? 'translate-y-0 opacity-100' : isClosing ? 'translate-y-8 opacity-0' : 'translate-y-8 opacity-0'}`} style={{ willChange: 'transform, opacity' }}>
              <PhotoProvider>
                <PhotoSelectionModalContent
                  user={user}
                  currentBackground={currentBackground}
                  backgroundType={backgroundType}
                  backgroundId={backgroundId}
                  onBackgroundChange={onBackgroundChange}
                  onSelectImages={onSelectImages}
                  onClose={handleClose}
                  isMobile={true}
                  showElements={showElements}
                  isClosing={isClosing}
                  isProcessing={isProcessing}
                  setIsProcessing={setIsProcessing}
                />
              </PhotoProvider>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="fixed inset-0 text-[var(--foreground)] pointer-events-auto">
            <div 
              className="fixed inset-0 bg-cover bg-center bg-no-repeat min-h-screen w-full pointer-events-none" 
              style={{ 
                backgroundImage: currentBackground ? `url("${currentBackground.replace(/"/g, '\\"')}")` : undefined,
                zIndex: 0 
              }} 
            />
            <div className="fixed inset-0 min-h-screen w-full pointer-events-none" style={{ backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)', zIndex: 0.5 }} />
            <div className="absolute inset-0 pointer-events-auto" style={{ backgroundColor: 'transparent', zIndex: 1 }} onClick={handleClose} />
            <div
              className="relative h-full w-full flex flex-col transform-gpu"
              style={{ zIndex: 2 }}
            >
              <button
                aria-label="Close"
                className="absolute top-3 right-3 rounded-full p-2 z-10 cursor-pointer transition-all duration-200 hover:scale-105 active:scale-95"
                onClick={handleClose}
                style={{ outline: '0 !important', WebkitTapHighlightColor: 'transparent', ...getAdaptiveGlassStyleBlur(), color: 'rgba(255, 255, 255)' }}
              >
                <X className="w-5 h-5" />
              </button>
              <div className="px-12 sm:px-16 md:px-20 lg:px-28 pt-12 sm:pt-30 pb-24 overflow-y-auto">
                <div className="flex items-center justify-between">
                  <h2 className="text-3xl sm:text-3xl md:text-4xl font-semibold tracking-tight" style={{ color: 'rgba(255, 255, 255)' }}>Photos</h2>
                  <div />
                </div>
                <div className="mt-8">
                  <PhotoProvider>
                    <PhotoSelectionModalContent
                      user={user}
                      currentBackground={currentBackground}
                      backgroundType={backgroundType}
                      backgroundId={backgroundId}
                      onBackgroundChange={onBackgroundChange}
                      onSelectImages={onSelectImages}
                      onClose={handleClose}
                      isMobile={false}
                      showElements={showElements}
                      isClosing={isClosing}
                      isProcessing={isProcessing}
                      setIsProcessing={setIsProcessing}
                    />
                  </PhotoProvider>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )

  return typeof window !== 'undefined'
    ? ReactDOM.createPortal(modalContent, document.body)
    : null
}
