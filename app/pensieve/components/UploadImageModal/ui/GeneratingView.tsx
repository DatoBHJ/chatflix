import React, { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { InlinePromptView } from './PromptRenderer'
import { ImageMetadata } from '../types'

interface GeneratingViewProps {
  generatingPrompt: string
  generatingImages: ImageMetadata[]
  setViewingImageId: (id: string) => void
  setViewingImageUrl: (url: string) => void
  blurStyle: React.CSSProperties
}

export function GeneratingView({
  generatingPrompt,
  generatingImages,
  setViewingImageId,
  setViewingImageUrl,
  blurStyle
}: GeneratingViewProps) {
  const [imageAspectRatios, setImageAspectRatios] = useState<Map<number, number>>(new Map())
  return (
    <div className="relative w-full h-full overflow-hidden text-white flex flex-col items-center justify-center">
      {/* Background blur */}
      <div className="absolute inset-0 z-0" style={blurStyle} />
      
      {/* Content */}
      <div className="relative z-10 w-full h-full flex flex-col items-center justify-center px-4 py-8">
        {/* Prompt text if available */}
        {generatingPrompt && (
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
              <InlinePromptView prompt={generatingPrompt} images={generatingImages} />
            </div>
          </div>
        )}
        
        {/* Image grid */}
        {generatingImages.length > 0 && (
          <div className={`grid gap-4 max-w-4xl w-full px-4 ${
            generatingImages.length === 1 ? 'grid-cols-1 max-w-xs' :
            generatingImages.length === 2 ? 'grid-cols-1 md:grid-cols-2 max-w-2xl' :
            generatingImages.length === 3 ? 'grid-cols-1 md:grid-cols-3 max-w-3xl' :
            'grid-cols-2 md:grid-cols-4 max-w-4xl'
          }`}>
            {generatingImages.map((img, index) => (
              <div 
                key={index} 
                className="relative rounded-lg overflow-hidden mx-auto cursor-pointer hover:opacity-90 transition-opacity"
                style={{
                  aspectRatio: imageAspectRatios.get(index)?.toString() || '1',
                  width: '100%',
                  maxWidth: generatingImages.length === 1 ? '300px' : 
                           generatingImages.length === 2 ? '250px' :
                           generatingImages.length === 3 ? '200px' : '180px'
                }}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setViewingImageId(img.imageId || `generating_${img.order}`)
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
                {/* Scan line animation overlay */}
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
        )}
        
        {/* Loading spinner - positioned to not overlap with images */}
        {generatingImages.length > 0 && (
          <div className="flex items-center justify-center mt-8 md:mt-10">
          <Loader2 className="w-5 h-5 md:w-6 md:h-6 animate-spin text-white/60" />
        </div>
        )}
        {generatingImages.length === 0 && (
          <div className="flex items-center justify-center">
            <Loader2 className="w-5 h-5 md:w-6 md:h-6 animate-spin text-white/60" />
          </div>
        )}
        
      </div>
    </div>
  )
}

