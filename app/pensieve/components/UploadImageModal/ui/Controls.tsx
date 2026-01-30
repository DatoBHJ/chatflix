import React from 'react'
import Image from 'next/image'
import { ChevronDown, Loader2, ScrollText, Check, Plus, Send } from 'lucide-react'
import { SiGoogle } from 'react-icons/si'
import { getAdaptiveGlassStyleBlur, getTextStyle as getTextStyleUtil, getIconClassName as getIconClassNameUtil } from '@/app/lib/adaptiveGlassStyle'
import { SeedreamLogo, WanAiLogo } from '@/app/components/CanvasFolder/CanvasLogo'

// 모델 아이콘 렌더링 헬퍼 함수
export function getModelIcon(model: string, size: number = 14) {
  switch (model) {
    case 'nano-banana-pro':
      return <SiGoogle strokeWidth={0.5} size={size} />
    case 'seadream-4.5':
      return <SeedreamLogo size={size} />
    case 'gpt-image-1.5':
      return (
        <Image
          src="/logo/openai.svg"
          alt="OpenAI"
          width={size}
          height={size}
          className="object-contain"
        />
      )
    case 'qwen-image-edit-2511':
      return <WanAiLogo size={size} />
    default:
      return null
  }
}

// 1. 모델 선택기 컴포넌트
interface ModelSelectorProps {
  modelSelectorRef: React.RefObject<HTMLDivElement | null>
  selectedModel: string
  isGenerating: boolean
  hasBg?: boolean
  onClick: (e: React.MouseEvent) => void
}

export function ModelSelector({
  modelSelectorRef,
  selectedModel,
  isGenerating,
  hasBg = true,
  onClick
}: ModelSelectorProps) {
  const getTextStyle = (hasBg: boolean) => getTextStyleUtil(hasBg)
  const getIconClassName = (hasBg: boolean) => getIconClassNameUtil(hasBg)

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-10001" ref={modelSelectorRef}>
      <button
        type="button"
        onClick={onClick}
        disabled={isGenerating}
        className="flex items-center gap-2 px-4 py-2 rounded-full transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        style={getAdaptiveGlassStyleBlur()}
      >
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-5 h-5 shrink-0">
            {getModelIcon(selectedModel, 16)}
          </div>
          <span className="text-sm font-medium" style={getTextStyle(hasBg)}>
            {selectedModel === 'nano-banana-pro' ? '🍌 Nano Banana Pro' : selectedModel === 'seadream-4.5' ? 'Seedream 4.5 Uncensored' : selectedModel === 'qwen-image-edit-2511' ? 'Qwen Image Edit Uncensored' : 'GPT Image 1.5'}
          </span>
        </div>
        <ChevronDown 
          size={16} 
          className={getIconClassName(hasBg)}
          strokeWidth={1.8}
        />
      </button>
    </div>
  )
}

// 2. 업로드 버튼 (하단 좌측 +)
interface UploadButtonProps {
  onClick: (e: React.MouseEvent) => void
  disabled?: boolean
  hasBg?: boolean
}

export function UploadButton({ onClick, disabled, hasBg = true }: UploadButtonProps) {
  const getTextStyle = (hasBg: boolean) => getTextStyleUtil(hasBg)
  
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="fixed bottom-6 left-6 w-12 h-12 rounded-full flex items-center justify-center transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed z-10000"
      style={{ ...getAdaptiveGlassStyleBlur(), pointerEvents: disabled ? 'none' : 'auto' }}
      title="Upload image"
      onMouseDown={(e) => {
        // Prevent event from bubbling to parent
        e.stopPropagation()
      }}
    >
      <Plus size={24} style={getTextStyle(hasBg)} strokeWidth={1.5} />
    </button>
  )
}

// 3. 전송/생성 버튼 (하단 우측 화살표)
interface GenerateButtonProps {
  onClick: (e: React.MouseEvent) => void
  disabled?: boolean
  isGenerating?: boolean
}

export function GenerateButton({ onClick, disabled, isGenerating }: GenerateButtonProps) {
  if (isGenerating) {
    return (
      <div className="fixed bottom-6 right-6 w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center z-10000">
        <Loader2 className="w-6 h-6 animate-spin text-white" />
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="fixed bottom-6 right-6 w-12 h-12 rounded-full flex items-center justify-center bg-(--chat-input-primary) text-(--chat-input-primary-foreground) z-10000"
      title="Generate"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
        <path d="M12 2L12 22M5 9L12 2L19 9" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}

// 4. 프롬프트 추출 버튼
interface ExtractPromptButtonProps {
  onClick: (e: React.MouseEvent) => void
  isGenerating: boolean
}

export function ExtractPromptButton({ onClick, isGenerating }: ExtractPromptButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isGenerating}
      className="fixed bottom-6 right-28 px-4 py-3.5 rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center text-white shadow-lg z-10000 gap-2"
      style={getAdaptiveGlassStyleBlur()}
      title="Extract Prompt"
    >
      {isGenerating ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm font-medium">Analyzing...</span>
        </>
      ) : (
        <>
          <ScrollText size={18} />
          <span className="text-sm font-medium">Extract Prompt</span>
        </>
      )}
    </button>
  )
}

