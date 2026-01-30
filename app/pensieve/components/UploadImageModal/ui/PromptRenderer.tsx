import React from 'react'
import { EditSlide, ImageMetadata } from '../types'
import { getAdaptiveGlassStyleBlur } from '@/app/lib/adaptiveGlassStyle'
import { JsonViewer } from './JsonViewer'

// 하이라이트 함수 (유틸리티)
export function highlightPrompt(prompt: string, searchQuery: string): React.ReactNode {
  if (!searchQuery || !prompt) return prompt
  
  const query = searchQuery.toLowerCase()
  const lowerPrompt = prompt.toLowerCase()
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let index = lowerPrompt.indexOf(query, lastIndex)
  
  while (index !== -1) {
    // Add text before match
    if (index > lastIndex) {
      parts.push(prompt.substring(lastIndex, index))
    }
    // Add highlighted match
    parts.push(
      <mark key={index} className="bg-yellow-400/30 text-yellow-200 rounded px-0.5">
        {prompt.substring(index, index + query.length)}
      </mark>
    )
    lastIndex = index + query.length
    index = lowerPrompt.indexOf(query, lastIndex)
  }
  
  // Add remaining text
  if (lastIndex < prompt.length) {
    parts.push(prompt.substring(lastIndex))
  }
  
  return <>{parts}</>
}

// 이미지 컴포넌트
function PromptImage({ img, className, style }: { img: ImageMetadata, className?: string, style?: React.CSSProperties }) {
  return (
    <div
      className="relative w-full rounded-xl overflow-hidden group"
      style={{ margin: '8px 0' }}
    >
      <img
        src={img.blobUrl}
        alt={`image ${img.order}`}
        className={className || "w-full h-auto block rounded-xl"}
        style={style || {
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.1)',
          transition: 'all 0.3s ease',
          animation: 'inline-image-appear 0.45s cubic-bezier(0.16, 1, 0.3, 1) forwards'
        }}
        onError={(e) => {
          const target = e.currentTarget as HTMLImageElement
          if (img.base64 && !target.src.startsWith('data:')) {
            target.src = img.base64
          }
        }}
      />
      {/* Expand icon - shows on hover */}
      <div
        className="absolute top-3 right-3 w-9 h-9 bg-black/60 backdrop-blur-sm rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
        style={{
          backdropFilter: 'blur(4px)'
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.9 }}>
          <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
        </svg>
      </div>
    </div>
  )
}

// JSON 문자열인지 확인하는 헬퍼 함수
function isJsonString(str: string): boolean {
  if (!str || typeof str !== 'string') return false
  const trimmed = str.trim()
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || 
      (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      JSON.parse(trimmed)
      return true
    } catch {
      return false
    }
  }
  return false
}

// 1. 기본 휴먼 프롬프트 렌더러 (텍스트 + 블록 이미지)
export function HumanPromptView({ prompt, images }: { prompt: any, images?: ImageMetadata[] }) {
  if (!prompt && (!images || images.length === 0)) {
    return (
      <div className="text-white/50 text-left py-8">
        No prompt provided
      </div>
    )
  }

  // If only images without text
  if (!prompt && images && images.length > 0) {
    return (
      <div className="w-full">
        {images.map((img, index) => (
          <div key={`img-only-${index}`} className="my-2">
            <PromptImage img={img} />
          </div>
        ))}
      </div>
    )
  }

  // prompt가 객체인 경우 (JSONB)
  if (typeof prompt === 'object' && prompt !== null) {
    return (
      <div className="w-full">
        {images && images.length > 0 && (
          <div className="mb-4">
            {images.map((img, index) => (
              <div key={`img-${index}`} className="my-2">
                <PromptImage img={img} />
              </div>
            ))}
          </div>
        )}
        <div className="text-base md:text-lg font-medium leading-relaxed text-white w-full text-left">
          <JsonViewer data={prompt} />
        </div>
      </div>
    )
  }

  // JSON 문자열인지 확인하고 파싱
  if (prompt && typeof prompt === 'string' && isJsonString(prompt)) {
    try {
      const jsonObject = JSON.parse(prompt.trim())
      return (
        <div className="w-full">
          {images && images.length > 0 && (
            <div className="mb-4">
              {images.map((img, index) => (
                <div key={`img-${index}`} className="my-2">
                  <PromptImage img={img} />
                </div>
              ))}
            </div>
          )}
          <div className="text-base md:text-lg font-medium leading-relaxed text-white w-full text-left">
            <JsonViewer data={jsonObject} />
          </div>
        </div>
      )
    } catch {
      // JSON 파싱 실패 시 일반 텍스트로 처리
    }
  }

  const parts = prompt && typeof prompt === 'string' ? prompt.split(/(\[image \d+\])/) : ['']

  return (
    <div className="w-full">
      {parts.map((part, index) => {
        const match = part.match(/\[image (\d+)\]/)
        if (match) {
          const order = parseInt(match[1])
          const img = images?.find(i => i.order === order)
          if (img) {
            return (
              <div key={`img-${index}`} className="my-2">
                <PromptImage img={img} />
              </div>
            )
          }
          return null
        }

        const trimmedPart = part.trim()
        if (!trimmedPart) return null

        // 각 part가 JSON인지 확인
        if (isJsonString(trimmedPart)) {
          try {
            const jsonObject = JSON.parse(trimmedPart)
            return (
              <div key={`json-${index}`} className="block my-2">
                <div className="text-base md:text-lg font-medium leading-relaxed text-white w-full text-left">
                  <JsonViewer data={jsonObject} />
                </div>
              </div>
            )
          } catch {
            // JSON 파싱 실패 시 일반 텍스트로 처리
          }
        }

        return (
          <span key={`text-${index}`} className="block whitespace-pre-wrap text-left">
            {part}
          </span>
        )
      })}
    </div>
  )
}

// 2. 슬라이드 라벨이 포함된 프롬프트 렌더러 (편집 모드용)
export function SlidePromptView({ 
  currentSlideIndex, 
  editSlides, 
  latestMetadata, 
  humanPrompt,
  onSlideClick 
}: { 
  currentSlideIndex: number
  editSlides: EditSlide[]
  latestMetadata: any
  humanPrompt: string
  onSlideClick?: (index: number) => void
}) {
  const currentSlide = editSlides[currentSlideIndex]
  if (!currentSlide) return null

  // 1. 원본 슬라이드인 경우
  if (currentSlide.isOriginal) {
    const prompt = latestMetadata?.originalPrompt || latestMetadata?.prompt || humanPrompt || ''
    let images = latestMetadata?.originalPromptImages || []
    
    // ai_json_prompt에서 _inputImages 추출 (있는 경우)
    const slideJsonPrompt = currentSlide.ai_json_prompt
    const metadataJsonPrompt = latestMetadata?.ai_json_prompt
    
    if (slideJsonPrompt && typeof slideJsonPrompt === 'object' && '_inputImages' in slideJsonPrompt && Array.isArray((slideJsonPrompt as any)._inputImages)) {
      images = (slideJsonPrompt as any)._inputImages
    } else if (metadataJsonPrompt && typeof metadataJsonPrompt === 'object' && '_inputImages' in metadataJsonPrompt && Array.isArray((metadataJsonPrompt as any)._inputImages)) {
      images = (metadataJsonPrompt as any)._inputImages
    }
    
    return (
      <div className="w-full">
        <HumanPromptView prompt={prompt} images={images} />
      </div>
    )
  }

  // 2. 편집된 슬라이드인 경우
  const parentSlide = editSlides.find(s => s.id === currentSlide.parentSlideId)
  const parentIndex = parentSlide ? editSlides.indexOf(parentSlide) : -1
  
  // ai_json_prompt에서 _inputImages 추출 (있는 경우)
  let editImages = currentSlide.editImages || []
  const slideJsonPrompt = currentSlide.ai_json_prompt
  if (slideJsonPrompt && typeof slideJsonPrompt === 'object' && '_inputImages' in slideJsonPrompt && Array.isArray((slideJsonPrompt as any)._inputImages)) {
    editImages = (slideJsonPrompt as any)._inputImages
  }
  
  return (
    <div className="w-full">
      {/* 기반이 된 소스 슬라이드 이미지 */}
      {parentSlide?.imageUrl && (
        <div className="relative w-full mb-4 group">
          <div className="relative w-full rounded-xl overflow-hidden">
            <img 
              src={parentSlide.imageUrl} 
              alt="Source"
              className="w-full h-auto block rounded-xl"
              style={{ boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)' }}
            />
          </div>
          
          {/* 슬라이드 이동 태그 */}
          {parentIndex !== -1 && (
            <button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onSlideClick?.(parentIndex)
              }}
              className="absolute top-3 left-3 px-2.5 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-white/90 text-[11px] font-semibold cursor-pointer z-30 flex items-center gap-1.5 hover:bg-black/80 transition-colors duration-200 shadow-xl group/tag"
            >
              <div className="flex items-center justify-center w-4 h-4 rounded-full bg-white/10 group-hover/tag:bg-white/20 transition-colors">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5M12 19l-7-7 7-7"/>
                </svg>
              </div>
              <span>Slide {parentIndex}</span>
            </button>
          )}
        </div>
      )}

      {/* 편집 프롬프트 및 추가 이미지 */}
      <div className="w-full">
        <HumanPromptView prompt={currentSlide.prompt} images={editImages} />
      </div>
    </div>
  )
}

// 3. 인라인 이미지 프롬프트 렌더러 (생성 중 텍스트 효과용)
export function InlinePromptView({ prompt, images }: { prompt: string, images?: ImageMetadata[] }) {
  if (!prompt) return null
  
  const parts = prompt.split(/(\[image \d+\])/)
  
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-1 gap-y-2 leading-relaxed">
      {parts.map((part, index) => {
        const match = part.match(/\[image (\d+)\]/)
        if (match) {
          const order = parseInt(match[1])
          const img = images?.find(i => i.order === order)
          if (img) {
            return (
              <div 
                key={index} 
                className="inline-block align-middle mx-0.5 relative"
              >
                <div className="relative group">
                  <img 
                    src={img.blobUrl}
                    alt={`image ${order}`}
                    className="h-10 w-auto rounded-md border border-white/30 shadow-md object-cover"
                    style={{ maxHeight: '40px', minWidth: '40px' }}
                    onError={(e) => {
                      const target = e.currentTarget as HTMLImageElement
                      if (img.base64 && !target.src.startsWith('data:')) {
                        target.src = img.base64
                      }
                    }}
                  />
                </div>
              </div>
            )
          }
        }
        
        const trimmedPart = part.trim()
        if (!trimmedPart) return null
        
        return (
          <span key={index} style={{ color: 'inherit' }}>
            {part}
          </span>
        )
      })}
    </div>
  )
}
