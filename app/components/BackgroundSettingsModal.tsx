'use client'

import React, { useState, useEffect, useCallback } from 'react'
import ReactDOM from 'react-dom'
import { X, Image, ChevronRight, ChevronLeft } from 'lucide-react'
import Masonry from 'react-masonry-css'
import { getAdaptiveGlassStyleBlur, getTextStyle, getAdaptiveGlassBackgroundColor } from '@/app/lib/adaptiveGlassStyle'
import { MODAL_SHEET_Z } from '@/app/lib/zIndex'
import ImageViewer from '@/app/photo/components/ImageViewer'
import { PhotoProvider } from '@/app/photo/components/PhotoContext'
import AllSection from '@/app/photo/components/AllSection'
import { DEFAULT_BACKGROUND_ID } from '@/app/photo/constants/backgrounds'

type ChatflixImage = { path: string; url: string; filename?: string; prompt?: string; ai_prompt?: string; ai_json_prompt?: unknown; id?: string }

interface BackgroundSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  user: { id: string } | null
  currentBackground: string
  backgroundType: 'default' | 'custom'
  backgroundId: string | undefined
  onBackgroundChange: () => void
}

export function BackgroundSettingsModal({
  isOpen,
  onClose,
  user,
  currentBackground,
  backgroundType,
  backgroundId,
  onBackgroundChange
}: BackgroundSettingsModalProps) {
  const [view, setView] = useState<'main' | 'photos'>('main')
  const [chatflixImages, setChatflixImages] = useState<ChatflixImage[]>([])
  const [chatflixLoading, setChatflixLoading] = useState(true)
  const [chatflixError, setChatflixError] = useState(false)
  const [viewerOpen, setViewerOpen] = useState(false)
  const [viewerIndex, setViewerIndex] = useState(0)
  const [viewerSettingBackground, setViewerSettingBackground] = useState(false)
  const [viewerSuccess, setViewerSuccess] = useState(false)

  // 드래그·트랜지션 (모바일, ModelSelector와 동일)
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
      setView('main')
      setIsDragging(false)
      setCurrentTranslateY(0)
      setIsAnimating(false)
      setIsClosing(false)
      setShowElements({ modal: false, title: false, content: false })
      setPanelElements({ background: false, content: false })
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

  // 배경 세팅창에 표시하지 않을 카테고리 (파일/메타데이터는 유지, UI에서만 숨김)
  const HIDDEN_WALLPAPER_KEYS = ['251113 seoul', '251115 football', '251115 Camp Nou'] as const

  const fetchChatflixImages = useCallback(async () => {
    setChatflixLoading(true)
    setChatflixError(false)
    try {
      const res = await fetch('/wallpaper/Chatflix bg/images_metadata.json')
      if (!res.ok) throw new Error('Failed to fetch')
      const data: Record<string, { path: string; filename?: string }[] | unknown> = await res.json()
      const flat = Object.entries(data)
        .filter(([key]) => !HIDDEN_WALLPAPER_KEYS.includes(key as (typeof HIDDEN_WALLPAPER_KEYS)[number]))
        .flatMap(([, arr]) =>
          (Array.isArray(arr) ? arr : []).map((o) => ({
            ...o,
            url: `/wallpaper/Chatflix bg/${o.path}`
          }))
        )
      setChatflixImages(flat)
    } catch {
      setChatflixError(true)
      setChatflixImages([])
    } finally {
      setChatflixLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) fetchChatflixImages()
  }, [isOpen, fetchChatflixImages])

  const allImages: ChatflixImage[] = chatflixImages

  const handleStaticSelect = async (id: string) => {
    if (!user?.id || user?.id === 'anonymous') {
      alert('Please sign in to change the wallpaper.')
      return
    }
    try {
      // static: refresh-url이 path 기반으로 URL을 만들므로, path를 저장 (UUID 대신).
      // default: id 그대로 사용.
      const img = allImages.find((i) => (i.id ?? i.path) === id)
      const backgroundId =
        id === DEFAULT_BACKGROUND_ID ? id : (img && 'path' in img && img.path ? img.path : id)

      await fetch('/api/background/set-preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          backgroundType: id === DEFAULT_BACKGROUND_ID ? 'default' : 'static',
          backgroundId
        })
      })
      onBackgroundChange()
    } catch (e) {
      console.error('Failed to set static background:', e)
    }
  }

  if (!isOpen) return null

  // Your Photos + Wallpaper (모바일/데스크탑 공통 컨텐츠)
  const sharedBody = (
    <>
      <button
        type="button"
        onClick={() => setView('photos')}
        className="w-full flex items-center gap-4 py-4 pl-1 pr-2 rounded-xl text-left cursor-pointer"
      >
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0"
          style={getAdaptiveGlassStyleBlur()}
        >
          <Image className="w-7 h-7 *:stroke-[1.5] text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[17px] text-white font-medium">Your Photos</span>
            <ChevronRight className="w-5 h-5 shrink-0 text-white/50" />
          </div>
          <span className="block text-[13px] text-white/55 mt-0.5">Select from Photos app</span>
        </div>
      </button>
      <div className="pt-4 mt-2 border-t border-white/10">
        <div className="mb-3">
          <h3 className="text-[11px] font-medium text-white/50 uppercase tracking-widest">
            Chatflix Originals
          </h3>
        </div>
        {chatflixLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-[4/3] rounded-lg bg-white/10 animate-pulse" />
            ))}
          </div>
        ) : chatflixError ? (
          <p className="text-white/50 text-sm py-4">Could not load images.</p>
        ) : (
          <Masonry
            breakpointCols={{ default: 5, 1024: 4, 640: 3, 480: 2 }}
            className="flex -ml-3 w-auto"
            columnClassName="pl-3 bg-clip-padding"
          >
            {allImages.map((img) => (
              <button
                key={img.id ?? img.path}
                type="button"
                className="mb-3 break-inside-avoid block w-full text-left rounded-lg overflow-hidden focus:outline-none focus:ring-2 focus:ring-white/30 transition-transform active:scale-[0.98] hover:opacity-90"
                onClick={() => {
                  const idx = allImages.findIndex((i) => (i.id ?? i.path) === (img.id ?? img.path))
                  setViewerIndex(idx >= 0 ? idx : 0)
                  setViewerOpen(true)
                }}
              >
                <img src={img.url} alt={img.filename || img.path} className="w-full h-auto object-cover rounded-lg" loading="lazy" />
              </button>
            ))}
          </Masonry>
        )}
      </div>
    </>
  )

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
              {view === 'photos' && (
                <button onClick={() => setView('main')} className="absolute left-6 p-2 rounded-lg transition-colors hover:bg-white/10" style={{ WebkitTapHighlightColor: 'transparent' }} aria-label="Back">
                  <ChevronLeft size={24} style={{ color: 'rgba(255, 255, 255)' }} />
                </button>
              )}
              <h2 className="text-xl font-semibold" style={{ color: 'rgba(255, 255, 255)' }}>{view === 'main' ? 'Wallpapers' : 'Photos'}</h2>
            </div>
            <div className={`flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 pb-6 transition-all duration-300 ease-out ${showElements.content ? 'translate-y-0 opacity-100' : isClosing ? 'translate-y-8 opacity-0' : 'translate-y-8 opacity-0'}`} style={{ willChange: 'transform, opacity' }}>
              {view === 'main' ? sharedBody : (
                <PhotoProvider>
                  <AllSection user={user} currentBackground={currentBackground} backgroundType={backgroundType} backgroundId={backgroundId} onBackgroundChange={() => onBackgroundChange()} />
                </PhotoProvider>
              )}
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
            {view === 'main' && (
              <button
                aria-label="Close"
                className="absolute top-3 right-3 rounded-full p-2 z-10 cursor-pointer transition-all duration-200 hover:scale-105 active:scale-95"
                onClick={handleClose}
                style={{ outline: '0 !important', WebkitTapHighlightColor: 'transparent', ...getAdaptiveGlassStyleBlur(), color: 'rgba(255, 255, 255)' }}
              >
                <X className="w-5 h-5" />
              </button>
            )}
            <div className="px-12 sm:px-16 md:px-20 lg:px-28 pt-12 sm:pt-30 pb-24 overflow-y-auto">
              <div className={`flex items-center ${view === 'photos' ? 'gap-3' : 'justify-between'}`}>
                {view === 'photos' && (
                  <button onClick={() => setView('main')} className="p-2 rounded-lg transition-colors hover:bg-white/10 -ml-2" aria-label="Back">
                    <ChevronLeft className="w-5 h-5" style={{ color: 'rgba(255, 255, 255)' }} />
                  </button>
                )}
                <h2 className="text-3xl sm:text-3xl md:text-4xl font-semibold tracking-tight" style={{ color: 'rgba(255, 255, 255)' }}>{view === 'main' ? 'Wallpapers' : 'Photos'}</h2>
                {view === 'main' && <div />}
              </div>
              <div className="mt-8">
                {view === 'main' ? sharedBody : (
                  <PhotoProvider>
                    <AllSection user={user} currentBackground={currentBackground} backgroundType={backgroundType} backgroundId={backgroundId} onBackgroundChange={() => onBackgroundChange()} />
                  </PhotoProvider>
                )}
              </div>
            </div>
            </div>
          </div>
        </>
      )}

      <ImageViewer
        images={allImages.map((i) => ({
          src: i.url,
          alt: i.filename || i.path,
          id: i.id ?? i.path,
          prompt: i.prompt,
          ai_prompt: i.ai_prompt,
          ai_json_prompt: i.ai_json_prompt
        }))}
        currentIndex={viewerIndex}
        isOpen={viewerOpen}
        onClose={() => setViewerOpen(false)}
        user={user}
        isMobile={typeof window !== 'undefined' && window.innerWidth < 768}
        enableSave={true}
        promptMode="ai_json_only"
        onSetAsBackground={async (id) => {
          if (!user?.id || user?.id === 'anonymous') {
            alert('Please sign in to change the wallpaper.')
            return
          }
          setViewerSettingBackground(true)
          try {
            await handleStaticSelect(id)
            onBackgroundChange()
            setViewerSuccess(true)
          } finally {
            setViewerSettingBackground(false)
          }
        }}
        isSettingBackground={viewerSettingBackground}
        isDeleting={false}
        isSuccess={viewerSuccess}
      />
    </div>
  )

  return typeof window !== 'undefined'
    ? ReactDOM.createPortal(modalContent, document.body)
    : null
}
