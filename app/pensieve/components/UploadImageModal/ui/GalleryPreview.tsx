import React, { useMemo, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Send } from 'lucide-react'
import { getAdaptiveGlassStyleBlur } from '@/app/lib/adaptiveGlassStyle'
import { PromptType, ImageMetadata } from '../types'
import { highlightPrompt } from './PromptRenderer'

// 프롬프트 타입별 라벨
const PROMPT_LABELS: Record<PromptType, string> = {
  prompt: 'Human Prompt',
  ai_prompt: 'AI Prompt',
  ai_json_prompt: 'AI JSON'
}

interface GalleryPreviewProps {
  isOpen: boolean
  selectedImage: any | null // TODO: Define ImageMetadata properly in types
  onClose: () => void
  onUsePrompt: (prompt: string) => void
  searchQuery: string
  promptType: PromptType
  setPromptType: (type: PromptType) => void
}

export function GalleryPreview({
  isOpen,
  selectedImage,
  onClose,
  onUsePrompt,
  searchQuery,
  promptType,
  setPromptType
}: GalleryPreviewProps) {
  const galleryPromptContentRef = useRef<HTMLDivElement>(null)

  // 사용 가능한 프롬프트 타입 목록 계산
  const availablePrompts = useMemo(() => {
    if (!selectedImage) return []
    const types: PromptType[] = []
    
    // Check if values exist
    const hasStringValue = (value: any) => {
      if (typeof value === 'string') return value.trim().length > 0
      return !!value
    }
    
    if (hasStringValue(selectedImage.prompt)) types.push('prompt')
    if (hasStringValue(selectedImage.ai_prompt)) types.push('ai_prompt')
    if (hasStringValue(selectedImage.ai_json_prompt)) types.push('ai_json_prompt')
    
    return types
  }, [selectedImage])

  // 현재 선택된 프롬프트 내용
  const currentPromptContent = useMemo(() => {
    if (!selectedImage) return ''
    
    const value = (() => {
      if (promptType === 'prompt') return selectedImage.prompt
      if (promptType === 'ai_prompt') return selectedImage.ai_prompt
      if (promptType === 'ai_json_prompt') return selectedImage.ai_json_prompt
      return ''
    })()
    
    if (value === undefined || value === null) return ''
    
    if (promptType === 'ai_json_prompt') {
      try {
        return typeof value === 'string' ? value : JSON.stringify(value, null, 2)
      } catch {
        return ''
      }
    }
    
    return typeof value === 'string' ? value : ''
  }, [selectedImage, promptType])

  // JSON 객체 (JSON 모드일 때)
  const jsonObject = useMemo(() => {
    if (promptType !== 'ai_json_prompt') return null
    if (!selectedImage) return null
    
    const value = selectedImage.ai_json_prompt
    if (!value) return null
    
    try {
      return typeof value === 'string' ? JSON.parse(value) : value
    } catch {
      return null
    }
  }, [selectedImage, promptType])

  // Auto-select prompt type (prefer AI prompt)
  useEffect(() => {
    if (!availablePrompts.length) return
    if (availablePrompts.includes(promptType)) return

    const priority: PromptType[] = ['ai_prompt', 'prompt', 'ai_json_prompt']
    const next = priority.find((type) => availablePrompts.includes(type))
    if (next) {
      setPromptType(next)
    }
  }, [availablePrompts, promptType, setPromptType])

  // Auto-scroll to highlighted search query
  useEffect(() => {
    if (!isOpen || !galleryPromptContentRef.current || !searchQuery) return
    
    setTimeout(() => {
      const highlightedElement = galleryPromptContentRef.current?.querySelector('.bg-yellow-400\\/30')
      if (highlightedElement) {
        highlightedElement.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center',
          inline: 'nearest'
        })
      }
    }, 100)
  }, [isOpen, currentPromptContent, searchQuery])

  if (!isOpen || !selectedImage) return null

  // TODO: JsonViewer 컴포넌트 필요 (순환 참조 방지 위해 나중에 import하거나 prop으로 받을지 결정)
  // 여기서는 간단한 텍스트 렌더링으로 대체하거나, JsonViewer를 별도로 import해야 함.
  // 상위에서 JsonViewer 로직을 재사용하기 위해 별도 파일로 분리했으므로 import 가능.
  
  // 하지만 JsonViewer는 재귀 컴포넌트라 여기서 import하면 됨.
  const { JsonViewer } = require('./JsonViewer') // Dynamic require or standard import

  return createPortal(
    <div
      className="fixed inset-0 z-100 bg-black/80 backdrop-blur-sm flex items-center justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-full text-white transition-colors cursor-pointer z-10000"
        aria-label="Close"
        style={getAdaptiveGlassStyleBlur()}
      >
        <X size={24} />
      </button>

      {/* Main container */}
      <div 
        className="relative flex items-center justify-center w-full h-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Background image blur */}
        <img
          src={selectedImage.url || `/pensieve/${selectedImage.path}`}
          alt=""
          className="absolute inset-0 w-full h-full object-cover z-0"
          style={{
            filter: 'brightness(0.3) blur(20px)',
            transform: 'scale(1.1)',
            objectPosition: 'center'
          }}
          aria-hidden="true"
        />
        
        {/* Content */}
        <div className="relative w-full h-full flex flex-col justify-center items-center text-center z-20 p-6">
          {/* Prompt type selector */}
          {availablePrompts.length > 1 && (
            <div className="flex flex-wrap gap-2 justify-center mb-6">
              {availablePrompts.map((type) => (
                <button
                  key={type}
                  className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                    promptType === type
                      ? 'border-white/60 bg-white/10 text-white'
                      : 'border-white/20 text-white/70 hover:border-white/40 hover:text-white'
                  }`}
                  onClick={(e) => {
                    e.stopPropagation()
                    setPromptType(type)
                  }}
                >
                  {PROMPT_LABELS[type]}
                </button>
              ))}
            </div>
          )}

          {/* Scrollable prompt content */}
          <div className="flex flex-col items-center w-full flex-1 min-h-0">
            <div className="w-full flex justify-center flex-1 min-h-0 overflow-hidden pt-10 sm:pt-28 pb-22 sm:pb-28">
              <div 
                ref={galleryPromptContentRef}
                className="max-w-3xl w-full h-full overflow-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden px-2 flex items-start justify-center"
              >
                {jsonObject && promptType === 'ai_json_prompt' ? (
                  <div className="text-base md:text-lg font-medium leading-relaxed text-white w-full text-left">
                    <JsonViewer data={jsonObject} searchQuery={searchQuery} />
                  </div>
                ) : (
                  <p
                    className={`text-base md:text-lg font-medium leading-relaxed text-white whitespace-pre-wrap w-full ${
                      promptType === 'ai_json_prompt'
                        ? 'text-left'
                        : 'text-center'
                    } py-8`}
                  >
                    {highlightPrompt(currentPromptContent, searchQuery)}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Use Prompt button - Fixed at bottom */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2">
            <button
              onClick={() => onUsePrompt(currentPromptContent)}
              className="bg-blue-500 hover:bg-blue-600 px-5 py-2.5 rounded-full text-white transition-colors cursor-pointer flex items-center gap-2"
              aria-label="Use This Prompt"
            >
              <Send size={18} />
              <span className="text-sm font-medium">Use This Prompt</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

