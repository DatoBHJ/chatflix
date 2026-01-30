import React, { useMemo } from 'react'
import { Check, Loader2, ScrollText, Copy } from 'lucide-react'
import { getAdaptiveGlassStyleBlur } from '@/app/lib/adaptiveGlassStyle'
import { PromptType, EditSlide } from '../types'
import { HumanPromptView, SlidePromptView } from './PromptRenderer'
import { JsonViewer } from './JsonViewer'
import { cleanInternalKeys } from '@/lib/utils'

interface PromptOverlayProps {
  isOpen: boolean
  displayImageUrl: string | null
  onClose: () => void
  
  // Prompt State
  promptType: PromptType
  setPromptType: (type: PromptType) => void
  availablePrompts: PromptType[]
  promptLabels: Record<PromptType, string>
  
  // Data
  humanPrompt: string
  latestMetadata: any
  
  // Edit Mode
  isEditMode: boolean
  editSlides: EditSlide[]
  currentSlideIndex: number
  setCurrentSlideIndex: (index: number) => void
  
  // AI Generation
  isPromptGenerating: boolean
  handleExtractPrompt: () => void
  
  // Utils
  handleCopyPrompt: () => void
  copied: boolean
  promptError: string | null
  setPromptError: (error: string | null) => void
}

export function PromptOverlay({ 
  isOpen,
  displayImageUrl,
  onClose,
  promptType,
  setPromptType,
  availablePrompts,
  promptLabels,
  humanPrompt,
  latestMetadata,
  isEditMode,
  editSlides,
  currentSlideIndex,
  setCurrentSlideIndex,
  isPromptGenerating,
  handleExtractPrompt,
  handleCopyPrompt,
  copied,
  promptError,
  setPromptError
}: PromptOverlayProps) {
  if (!isOpen || !displayImageUrl) return null

  const currentSlide = isEditMode && editSlides.length > 0 
    ? editSlides[currentSlideIndex] 
    : null

  // JSON 객체 파싱 (내부 계산)
  const jsonObject = useMemo(() => {
    if (promptType !== 'ai_json_prompt') return null
    
    // In edit mode, use current slide's ai_json_prompt if available
    const currentSlideInMemo = isEditMode && editSlides.length > 0 
      ? editSlides[currentSlideIndex] 
      : null
    
    // Priority: current slide's ai_json_prompt > latestMetadata's ai_json_prompt
    const value = currentSlideInMemo?.ai_json_prompt || latestMetadata?.ai_json_prompt
    if (!value) return null
    try {
      const parsed = typeof value === 'string' ? JSON.parse(value) : value
      const cleaned = cleanInternalKeys(parsed)
      
      // If after cleaning it's an empty object, return null to show Generate button
      if (cleaned && typeof cleaned === 'object' && !Array.isArray(cleaned) && Object.keys(cleaned).length === 0) {
        return null
      }
      
      return cleaned
    } catch {
      return null
    }
  }, [latestMetadata, promptType, isEditMode, editSlides, currentSlideIndex])

  return (
    <div 
      className="fixed z-100001 text-white transition-opacity duration-300 opacity-100 pointer-events-auto"
      style={{
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        minWidth: '100vw',
        height: '100vh',
        minHeight: '100vh',
        overflow: 'hidden'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      {/* 검은색 배경 레이어 - 확실히 덮기 */}
      <div 
        className="absolute z-0"
        style={{
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100vw',
          minWidth: '100vw',
          height: '100vh',
          minHeight: '100vh',
          backgroundColor: 'rgba(0, 0, 0, 0.8)'
        }}
      />
      <div 
        className="absolute z-0 overflow-hidden"
        style={{
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100vw',
          minWidth: '100vw',
          height: '100vh',
          minHeight: '100vh'
        }}
      >
        <img
          src={displayImageUrl}
          alt="preview"
          className="absolute w-full h-full object-cover"
          style={{
            top: 0,
            left: 0,
            width: '100vw',
            minWidth: '100vw',
            height: '100vh',
            minHeight: '100vh',
            filter: 'brightness(0.3) blur(20px)',
            transform: 'scale(1.1)',
            objectPosition: 'center'
          }}
        />
      </div>
      
      <div className="relative w-full h-full flex flex-col justify-center items-center text-center z-20 p-6">
        {/* Done / close button (blue check) */}
        <button
          className="absolute top-4 right-4 z-30 w-10 h-10 rounded-full flex items-center justify-center cursor-pointer"
          style={{
            color: 'white',
            backgroundColor: '#007AFF',
            border: '1px solid #007AFF',
            boxShadow:
              '0 8px 40px rgba(0, 122, 255, 0.3), 0 4px 20px rgba(0, 122, 255, 0.2), 0 2px 8px rgba(0, 122, 255, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
          }}
          onClick={(e) => {
            e.stopPropagation()
            onClose()
            setPromptError(null)
          }}
        >
          <Check size={18} />
        </button>
        
        {/* Prompt type tabs */}
        <div className="flex flex-col items-center gap-4 mb-8">
          <span className="text-[10px] font-bold text-white/30 uppercase tracking-[0.3em] mb-1">Prompt</span>
          <div className="flex gap-1 p-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
            <button
              className={`px-6 py-1.5 text-xs font-semibold rounded-full transition-all duration-200 cursor-pointer ${
                promptType === 'prompt'
                  ? 'bg-white/15 text-white shadow-sm'
                  : 'text-white/40 hover:text-white/60'
              }`}
              onClick={(e) => {
                e.stopPropagation()
                setPromptType('prompt')
              }}
            >
              Human
            </button>
            <button
              className={`px-6 py-1.5 text-xs font-semibold rounded-full transition-all duration-200 cursor-pointer ${
                promptType !== 'prompt'
                  ? 'bg-white/15 text-white shadow-sm'
                  : 'text-white/40 hover:text-white/60'
              }`}
              onClick={(e) => {
                e.stopPropagation()
                if (promptType === 'prompt') {
                  setPromptType('ai_prompt')
                }
              }}
            >
              AI
            </button>
          </div>

          {/* AI Prompt Sub-toggle - Generate 버튼이 보일 때는 숨김 */}
          {promptType !== 'prompt' && ((promptType === 'ai_prompt' && (currentSlide?.ai_prompt || latestMetadata?.ai_prompt)) || (promptType === 'ai_json_prompt' && jsonObject)) && (
            <div className="flex items-center gap-3 animate-in fade-in slide-in-from-top-1 duration-300">
              <span className={`text-[10px] uppercase tracking-wider font-bold transition-colors ${promptType === 'ai_prompt' ? 'text-white/80' : 'text-white/30'}`}>Text</span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setPromptType(promptType === 'ai_prompt' ? 'ai_json_prompt' : 'ai_prompt')
                }}
                className="relative w-10 h-5 rounded-full bg-white/10 border border-white/10 transition-colors duration-200"
              >
                <div 
                  className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-all duration-200 shadow-sm ${
                    promptType === 'ai_json_prompt' ? 'left-[22px]' : 'left-0.5'
                  }`}
                />
              </button>
              <span className={`text-[10px] uppercase tracking-wider font-bold transition-colors ${promptType === 'ai_json_prompt' ? 'text-white/80' : 'text-white/30'}`}>JSON</span>
            </div>
          )}
        </div>

        {/* Prompt content */}
        <div className="flex flex-col items-center w-full flex-1 min-h-0">
          <div className="w-full flex justify-center flex-1 min-h-0 overflow-hidden pt-10 sm:pt-28 pb-22 sm:pb-28">
            <div className="max-w-3xl w-full h-full overflow-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden px-2 flex items-start justify-start">
              
              {/* Human Prompt */}
              {promptType === 'prompt' && (
                <div
                  className="w-full bg-transparent font-normal text-left outline-none focus:outline-none ring-0 focus:ring-0 border-none no-underline transition-all duration-200"
                  style={{
                    color: '#FFFFFF',
                    fontSize: '1.125rem',
                    lineHeight: '1.625',
                    minHeight: '1.625em',
                    padding: '2rem 0'
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {isEditMode && editSlides.length > 0 && currentSlideIndex >= 0 ? (
                    <SlidePromptView 
                      currentSlideIndex={currentSlideIndex}
                      editSlides={editSlides}
                      latestMetadata={latestMetadata}
                      humanPrompt={humanPrompt}
                      onSlideClick={setCurrentSlideIndex}
                    />
                  ) : (
                    <HumanPromptView 
                      prompt={latestMetadata?.originalPrompt || latestMetadata?.prompt || humanPrompt || ''}
                      images={latestMetadata?.ai_json_prompt?._inputImages || latestMetadata?.originalPromptImages || []}
                    />
                  )}
                </div>
              )}
              
              {/* AI Prompt */}
              {promptType === 'ai_prompt' && (currentSlide?.ai_prompt || latestMetadata?.ai_prompt) && (
                <p className="text-base md:text-lg font-medium leading-relaxed text-white whitespace-pre-wrap w-full text-center py-8">
                  {currentSlide?.ai_prompt || latestMetadata?.ai_prompt}
                </p>
              )}
              
              {/* AI JSON */}
              {promptType === 'ai_json_prompt' && jsonObject && (
                <div className="text-base md:text-lg font-medium leading-relaxed text-white w-full text-left">
                  <JsonViewer data={jsonObject} />
                </div>
              )}

              {/* Centered Generate button (AI Prompt) */}
              {promptType === 'ai_prompt' && !(currentSlide?.ai_prompt || latestMetadata?.ai_prompt) && (
                <div className="flex justify-center py-8">
                  <button
                    onClick={async (e) => {
                      e.stopPropagation()
                      try {
                        await handleExtractPrompt()
                        // 생성 성공 후 AI 프롬프트 타입으로 전환하여 토글 표시
                        setPromptType('ai_prompt')
                      } catch (error) {
                        // 에러는 handleExtractPrompt 내부에서 처리됨
                      }
                    }}
                    disabled={isPromptGenerating}
                    className="px-8 py-3 md:px-10 md:py-3.5 rounded-full text-sm md:text-base font-semibold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={getAdaptiveGlassStyleBlur()}
                  >
                    {isPromptGenerating ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Analyzing...</span>
                      </>
                    ) : (
                      <>
                        <ScrollText size={20} />
                        <span>Generate</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Centered Generate button (AI JSON) */}
              {promptType === 'ai_json_prompt' && !jsonObject && (
                <div className="flex justify-center py-8">
                  <button
                    onClick={async (e) => {
                      e.stopPropagation()
                      try {
                        await handleExtractPrompt()
                        // 생성 성공 후 AI JSON 타입으로 전환하여 토글 표시
                        setPromptType('ai_json_prompt')
                      } catch (error) {
                        // 에러는 handleExtractPrompt 내부에서 처리됨
                      }
                    }}
                    disabled={isPromptGenerating}
                    className="px-8 py-3 md:px-10 md:py-3.5 rounded-full text-sm md:text-base font-semibold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={getAdaptiveGlassStyleBlur()}
                  >
                    {isPromptGenerating ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Analyzing...</span>
                      </>
                    ) : (
                      <>
                        <ScrollText size={20} />
                        <span>Generate</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Generate & Copy buttons */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2">
          {promptError && (
            <div className="mb-1 px-3 py-1.5 rounded-full bg-red-500/80 text-xs text-white">
              {promptError}
            </div>
          )}
          <div className="flex items-center gap-3">
            {/* Copy button */}
            {((promptType === 'prompt' && humanPrompt.trim()) ||
              (promptType === 'ai_prompt' && (currentSlide?.ai_prompt || latestMetadata?.ai_prompt)) ||
              (promptType === 'ai_json_prompt' && jsonObject)) && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleCopyPrompt()
                }}
                className="px-4 py-2.5 rounded-full text-white transition-colors cursor-pointer flex items-center gap-2"
                style={getAdaptiveGlassStyleBlur()}
              >
                {copied ? <Check size={18} /> : <Copy size={18} />}
                <span className="text-sm font-medium">{copied ? 'Copied!' : 'Copy'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

