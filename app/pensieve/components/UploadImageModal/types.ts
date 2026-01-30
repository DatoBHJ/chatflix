export interface XSearchEntry {
  id: string
  prompt: string | object // Can be string or JSON object
  paths: string[]
  createdDate: string
  links: string[]
  tweetIds: string[]
  authors: string[]
  searchQueries: string[]
  searchStrategies: string[]
}

export interface XSearchData {
  x_search: XSearchEntry[]
}

export type Mode = 'initial' | 'generating' | 'edit'

export interface EditSlide {
  id: string
  imageUrl: string
  path: string
  prompt: string
  isOriginal: boolean
  isGenerating: boolean
  isSaved?: boolean
  timestamp: string
  parentSlideId: string | null  // 부모 slide의 id (Original은 null)
  editImages?: Array<{ blobUrl: string; base64: string; order: number; imageId?: string }> // 편집 시 추가로 넣은 이미지들
  ai_prompt?: string  // 슬라이드별 AI prompt
  ai_json_prompt?: string  // 슬라이드별 AI JSON prompt
}

export interface UploadImageModalProps {
  isOpen: boolean
  onClose: () => void
  onUploadComplete: (metadata: any) => void
  user?: any
}

export type PromptType = 'prompt' | 'ai_prompt' | 'ai_json_prompt'

export interface ImageMetadata {
  blobUrl: string
  base64: string
  order: number
  imageId?: string
}

