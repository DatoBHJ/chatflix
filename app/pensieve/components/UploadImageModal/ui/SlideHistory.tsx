import React, { useState } from 'react'
import { X, Loader2, Check, Copy } from 'lucide-react'
import { getAdaptiveGlassStyleBlur, getTextStyle } from '@/app/lib/adaptiveGlassStyle'
import { EditSlide } from '../types'

interface SlideHistoryProps {
  isOpen: boolean
  displayImageUrl: string | null
  onClose: () => void
  editSlides: EditSlide[]
  currentSlideIndex: number
  isEditMode: boolean
  enterEditMode: () => void
  setCurrentSlideIndex: (index: number) => void
  isMobile: boolean
}

export function SlideHistory({ 
  isOpen,
  displayImageUrl,
  onClose,
  editSlides,
  currentSlideIndex,
  isEditMode,
  enterEditMode,
  setCurrentSlideIndex,
  isMobile
}: SlideHistoryProps) {
  const [imageAspectRatios, setImageAspectRatios] = useState<Record<string, number>>({})
  const [copiedSlideId, setCopiedSlideId] = useState<string | null>(null)

  if (!isOpen || editSlides.length === 0 || !displayImageUrl) return null

  return (
    <div 
      className="fixed inset-0 z-100001 text-white transition-opacity duration-300 h-full"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      {/* Blurred image background (same style as prompt overlay) */}
      <img
        src={displayImageUrl}
        alt="Slides background"
        className="absolute inset-0 w-full h-full object-cover z-0"
        style={{
          filter: 'brightness(0.3) blur(20px)',
          transform: 'scale(1.1)',
          objectPosition: 'center'
        }}
      />

      {/* Foreground content */}
      <div className="relative w-full h-full flex flex-col z-20">
        {/* Close button */}
        <button
          className="absolute top-4 right-4 rounded-full p-3 transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer z-100002"
          onClick={onClose}
          style={{
            ...getAdaptiveGlassStyleBlur(),
            color: 'rgba(255, 255, 255)',
          }}
        >
          <X size={20} />
        </button>
      
        {/* Header */}
        <div className="pt-20 pb-8 px-4 text-center">
          <h2 className="text-2xl font-semibold mb-2" style={getTextStyle(true)}>
            Slides
          </h2>
          <p className="text-sm opacity-60" style={getTextStyle(true)}>
            {editSlides.length} slide{editSlides.length !== 1 ? 's' : ''}
          </p>
        </div>
      
        {/* Slides grid */}
        <div className="flex-1 overflow-y-auto px-4 pb-8">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-w-7xl mx-auto">
            {editSlides.map((slide, index) => {
              const isActive = index === currentSlideIndex && isEditMode
              const aspectRatio = imageAspectRatios[slide.id] || 1
              
              return (
                <div
                  key={slide.id}
                  onClick={() => {
                    if (!isEditMode) {
                      enterEditMode()
                    }
                    setCurrentSlideIndex(index)
                    onClose()
                  }}
                  className="relative group cursor-pointer rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                  style={{
                    ...getAdaptiveGlassStyleBlur(),
                    opacity: isActive ? 1 : 0.85
                  }}
                >
                  <div 
                    className="relative overflow-hidden w-full"
                    style={{
                      aspectRatio: `${aspectRatio}`,
                      minHeight: '120px',
                      maxHeight: '400px'
                    }}
                  >
                    {slide.isGenerating ? (
                      <div className="w-full h-full flex items-center justify-center bg-black/20">
                        <Loader2 className="w-6 h-6 animate-spin text-white/40" />
                      </div>
                    ) : slide.imageUrl ? (
                      <img
                        src={slide.imageUrl}
                        alt={slide.prompt || `Slide ${index + 1}`}
                        className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
                        onLoad={(e) => {
                          const img = e.currentTarget
                          const ratio = img.naturalWidth / img.naturalHeight
                          setImageAspectRatios(prev => ({
                            ...prev,
                            [slide.id]: ratio
                          }))
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-black/20">
                        <span className="text-sm opacity-40" style={getTextStyle(true)}>No image</span>
                      </div>
                    )}
                    
                    {slide.isOriginal && (
                      <div 
                        className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-medium backdrop-blur-md"
                        style={{
                          backgroundColor: 'rgba(255, 255, 255, 0.12)',
                          color: 'rgba(255, 255, 255, 0.85)',
                        }}
                      >
                        Original
                      </div>
                    )}
                    
                    {isActive && (
                      <div 
                        className="absolute inset-0 pointer-events-none rounded-2xl"
                        style={{
                          backgroundColor: 'rgba(255, 255, 255, 0.08)',
                        }}
                      />
                    )}
                  </div>
                  
                  <div className="p-4 relative">
                    {slide.prompt ? (
                      <>
                        <p 
                          className="text-sm line-clamp-2 transition-opacity duration-200 group-hover:opacity-100 pr-8"
                          style={{
                            ...getTextStyle(true),
                            opacity: 0.8
                          }}
                        >
                          {slide.prompt}
                        </p>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            navigator.clipboard?.writeText(slide.prompt).catch(() => {})
                            setCopiedSlideId(slide.id)
                            setTimeout(() => setCopiedSlideId(null), 2000)
                          }}
                          className={`absolute top-4 right-4 p-1.5 rounded-full transition-all duration-200 hover:scale-110 active:scale-95 ${
                            isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                          }`}
                          style={{
                            ...getAdaptiveGlassStyleBlur(),
                            color: 'rgba(255, 255, 255, 0.8)',
                          }}
                        >
                          {copiedSlideId === slide.id ? (
                            <Check size={14} />
                          ) : (
                            <Copy size={14} />
                          )}
                        </button>
                      </>
                    ) : slide.isOriginal ? (
                      <p className="text-sm italic opacity-60" style={getTextStyle(true)}>
                        Original image
                      </p>
                    ) : (
                      <p className="text-sm opacity-40" style={getTextStyle(true)}>
                        No prompt
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

