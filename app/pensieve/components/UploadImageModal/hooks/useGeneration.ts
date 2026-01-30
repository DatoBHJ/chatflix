import { useState, useCallback, useRef } from 'react'
import { EditSlide } from '../types'

export function useGeneration(user: any, selectedModel: string) {
  const [editSlides, setEditSlides] = useState<EditSlide[]>([])
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)
  const [savingSlides, setSavingSlides] = useState<Set<string>>(new Set())
  const [savedSlides, setSavedSlides] = useState<Set<string>>(new Set())
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map())

  const convertBlobToBase64 = async (blobUrl: string): Promise<string> => {
    const response = await fetch(blobUrl)
    const blob = await response.blob()
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }

  const handleSaveSlide = useCallback(async (slide: EditSlide, latestMetadata: any, editingProjectId?: string | null) => {
    if (!slide.imageUrl || slide.isOriginal || !user) return
    
    setSavingSlides(prev => new Set(prev).add(slide.id))
    
    try {
      // 편집된 슬라이드의 human prompt 생성
      let humanPrompt = slide.prompt || ''
      let referenceImages: any[] = []
      
      // 부모 슬라이드가 있으면 부모 이미지 정보를 referenceImages에 추가
      if (slide.parentSlideId) {
        const parentSlide = editSlides.find(s => s.id === slide.parentSlideId)
        if (parentSlide?.imageUrl) {
          // 프롬프트에 [image 1] 태그가 없으면 추가
          if (!humanPrompt.match(/\[image \d+\]/)) {
            humanPrompt = `[image 1]\n\n${humanPrompt}`
          }
          
          // referenceImages에 부모 이미지 추가
          referenceImages.push({
            blobUrl: parentSlide.imageUrl,
            base64: '',
            order: 1,
            originalUrl: parentSlide.imageUrl,
            path: parentSlide.path, // path 정보 추가
            bucketName: parentSlide.path.includes('saved-gallery') ? 'saved-gallery' : 'generated-images'
          })
        }
      }
      
      // editImages가 있으면 referenceImages에 추가
      if (slide.editImages && slide.editImages.length > 0) {
        slide.editImages.forEach((img, index) => {
          const order = referenceImages.length + 1
          // 프롬프트에 해당 이미지 태그가 없으면 추가
          if (!humanPrompt.includes(`[image ${order}]`)) {
            humanPrompt = `${humanPrompt}\n[image ${order}]`
          }
          referenceImages.push({
            blobUrl: img.blobUrl,
            base64: img.base64 || '',
            order: order,
            originalUrl: img.blobUrl
          })
        })
      }
      
      // 프로젝트 정보를 metadata에 추가
      const metadata: any = {}
      if (referenceImages.length > 0) {
        metadata.referenceImages = referenceImages
      }
      if (editingProjectId) {
        metadata.projectId = editingProjectId
        metadata.slideId = slide.id
      }
      
      const response = await fetch('/api/photo/save-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          imageUrl: slide.imageUrl,
          prompt: humanPrompt,
          ai_prompt: slide.ai_prompt || latestMetadata?.ai_prompt,
          ai_json_prompt: slide.ai_json_prompt || latestMetadata?.ai_json_prompt,
          appContext: 'pensieve',
          metadata: Object.keys(metadata).length > 0 ? metadata : undefined
        })
      })
      
      if (!response.ok) throw new Error('Failed to save image')
      
      setSavingSlides(prev => {
        const next = new Set(prev)
        next.delete(slide.id)
        return next
      })
      setSavedSlides(prev => new Set(prev).add(slide.id))
      setEditSlides(prev => prev.map(s => s.id === slide.id ? { ...s, isSaved: true } : s))
      
      if (typeof window !== 'undefined') {
        const channel = new BroadcastChannel('pensieve-saved-refresh')
        channel.postMessage({ type: 'image-saved' })
        channel.close()
      }
    } catch (error) {
      console.error('Save slide error:', error)
      setSavingSlides(prev => {
        const next = new Set(prev)
        next.delete(slide.id)
        return next
      })
    }
  }, [user, editSlides])

  const handleCancelGeneration = useCallback((slideId?: string) => {
    const idToCancel = slideId || (editSlides[currentSlideIndex]?.id)
    if (!idToCancel) return

    const controller = abortControllersRef.current.get(idToCancel)
    if (controller) {
      controller.abort()
      abortControllersRef.current.delete(idToCancel)
    }

    setEditSlides(prev => prev.filter(slide => slide.id !== idToCancel))
    setCurrentSlideIndex(prev => Math.max(0, prev - 1))
    setIsGenerating(abortControllersRef.current.size > 0)
  }, [editSlides, currentSlideIndex])

  const handleEditSubmit = useCallback(async (
    editPrompt: string,
    editInsertedImages: Map<string, { blobUrl: string; base64: string; file: File }>,
    selectedModel: string,
    convertBlobToBase64: (blobUrl: string) => Promise<string>,
    editingProjectId?: string | null,
    imagesMetadata?: Array<{ blobUrl: string; base64: string; order: number; imageId?: string }>
  ) => {
    const currentSlide = editSlides[currentSlideIndex]
    if (!currentSlide || currentSlide.isGenerating) return

    // 입력 이미지 메타데이터 수집 (매개변수로 전달받거나 직접 생성)
    let inputImagesMetadata: Array<{ blobUrl: string; base64: string; order: number; imageId?: string }> = imagesMetadata || []
    
    // imagesMetadata가 전달된 경우, 부모 슬라이드 이미지가 order: 1로 포함되어 있는지 확인
    // 포함되어 있지 않으면 추가 (부모 슬라이드가 [image 1]이어야 함)
    if (imagesMetadata && imagesMetadata.length > 0) {
      const hasParentImage = inputImagesMetadata.some(img => img.order === 1)
      if (!hasParentImage && currentSlide.imageUrl) {
        // 부모 슬라이드 이미지를 order: 1로 맨 앞에 추가
        inputImagesMetadata = [
          {
            blobUrl: currentSlide.imageUrl,
            base64: '',
            order: 1,
            imageId: 'parent'
          },
          ...inputImagesMetadata
        ]
      }
    } else if (editInsertedImages.size > 0) {
      // imagesMetadata가 전달되지 않은 경우, 메타데이터 생성
      // 부모 슬라이드 이미지를 order: 1로 추가
      if (currentSlide.imageUrl) {
        inputImagesMetadata.push({
          blobUrl: currentSlide.imageUrl,
          base64: '',
          order: 1,
          imageId: 'parent'
        })
      }
      
      // editInsertedImages의 이미지들을 order: 2부터 추가
      let order = 1 // 부모 슬라이드가 [image 1]이므로 추가 이미지는 2부터
      Array.from(editInsertedImages.entries()).forEach(([imageId, imgData]) => {
        order++
        inputImagesMetadata.push({
          blobUrl: imgData.blobUrl,
          base64: imgData.base64,
          order,
          imageId
        })
      })
    }

    const newSlideId = `slide-${Date.now()}`
    const newSlide: EditSlide = {
      id: newSlideId,
      imageUrl: '',
      path: '',
      prompt: editPrompt,
      isOriginal: false,
      isGenerating: true,
      timestamp: new Date().toISOString(),
      parentSlideId: currentSlide.id,
      editImages: inputImagesMetadata, // 생성 중 표시를 위해 추가
      ai_json_prompt: JSON.stringify({ _inputImages: inputImagesMetadata }) // 생성 중 표시를 위해 추가 (ViewerEditMode에서 사용)
    }

    console.log('[handleEditSubmit] Creating new slide:', newSlideId, 'with isGenerating: true')
    setEditSlides(prev => [...prev, newSlide])
    setCurrentSlideIndex(editSlides.length)
    setIsGenerating(true)

    const ctrl = new AbortController()
    abortControllersRef.current.set(newSlideId, ctrl)

    try {
      // 추가 이미지들을 base64 배열로 변환
      let images: string[] | undefined
      if (editInsertedImages.size > 0) {
        images = await Promise.all(
          Array.from(editInsertedImages.values()).map(img => 
            img.base64.startsWith('data:') ? img.base64 : `data:image/png;base64,${img.base64}`
          )
        )
      }

      // 현재 슬라이드 이미지를 base64로 변환 (blob URL인 경우)
      let sourceImageBase64: string | undefined
      if (currentSlide.imageUrl.startsWith('blob:')) {
        sourceImageBase64 = await convertBlobToBase64(currentSlide.imageUrl)
      }

      const res = await fetch('/api/pensieve/edit-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: selectedModel,
          prompt: editPrompt,
          sourceImageUrl: currentSlide.imageUrl.startsWith('blob:') ? undefined : currentSlide.imageUrl,
          sourceImageBase64: sourceImageBase64,
          images: images
        }),
        signal: ctrl.signal
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to edit image')
      }

      const data = await res.json()
      if (!data.success || !data.imageUrl) {
        throw new Error(data.error || 'Failed to edit image')
      }

      // ai_json_prompt에 입력 이미지 정보 추가
      const aiJsonPromptWithInputs = data.ai_json_prompt ? { ...data.ai_json_prompt } : {}
      if (inputImagesMetadata.length > 0) {
        aiJsonPromptWithInputs._inputImages = inputImagesMetadata
        console.log('[handleEditSubmit] Added _inputImages to ai_json_prompt:', inputImagesMetadata.length, 'images')
      }

      // 생성된 슬라이드 업데이트
      console.log('[handleEditSubmit] Image generation complete for slide:', newSlideId, 'setting isGenerating: false')
      console.log('[handleEditSubmit] aiJsonPromptWithInputs:', JSON.stringify(aiJsonPromptWithInputs, null, 2))
      setEditSlides(prev => prev.map(s => 
        s.id === newSlideId 
          ? { 
              ...s, 
              imageUrl: data.imageUrl, 
              path: data.path, 
              isGenerating: false, 
              isSaved: !!editingProjectId,
              ai_prompt: data.ai_prompt,
              ai_json_prompt: aiJsonPromptWithInputs,
              editImages: inputImagesMetadata // 완료 후에도 유지
            }
          : s
      ))

      // 프로젝트 편집 중이면 DB에 슬라이드 저장
      if (editingProjectId) {
        try {
          const saveRes = await fetch(`/api/pensieve/projects/${editingProjectId}/slides`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              parentSlideId: currentSlide.id,
              imageUrl: data.imageUrl,
              imagePath: data.path,
              prompt: editPrompt,
              aiPrompt: data.ai_prompt,
              aiJsonPrompt: aiJsonPromptWithInputs,
              isOriginal: false
            })
          })

          if (!saveRes.ok) {
            console.error('Failed to save slide to project')
          } else {
            const savedSlide = await saveRes.json()
            // 저장된 ID로 업데이트
            if (savedSlide.slide && savedSlide.slide.id) {
              setEditSlides(prev => prev.map(s => 
                s.id === newSlideId 
                  ? { ...s, id: savedSlide.slide.id } // 실제 DB ID로 교체
                  : s
              ))
              
              // 브로드캐스트 채널을 통해 프로젝트 목록 갱신 요청
              if (typeof window !== 'undefined') {
                const channel = new BroadcastChannel('pensieve-refresh')
                channel.postMessage({ type: 'project-updated', projectId: editingProjectId })
                channel.close()
              }
            }
          }
        } catch (saveError) {
          console.error('Error saving slide to project:', saveError)
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // 취소된 경우 슬라이드 제거
        console.log('[handleEditSubmit] Generation aborted for slide:', newSlideId, 'removing slide')
        setEditSlides(prev => prev.filter(s => s.id !== newSlideId))
        setCurrentSlideIndex(prev => Math.max(0, prev - 1))
      } else {
        console.error('[handleEditSubmit] Edit image error:', err)
        // 에러 발생 시 슬라이드 제거
        setEditSlides(prev => prev.filter(s => s.id !== newSlideId))
        setCurrentSlideIndex(prev => Math.max(0, prev - 1))
      }
    } finally {
      abortControllersRef.current.delete(newSlideId)
      setIsGenerating(abortControllersRef.current.size > 0)
      console.log('[handleEditSubmit] Generation cleanup complete, isGenerating:', abortControllersRef.current.size > 0)
    }
  }, [editSlides, currentSlideIndex, isGenerating, selectedModel])

  return {
    editSlides,
    setEditSlides,
    currentSlideIndex,
    setCurrentSlideIndex,
    isGenerating,
    setIsGenerating,
    isGeneratingImage,
    setIsGeneratingImage,
    savingSlides,
    setSavingSlides,
    savedSlides,
    setSavedSlides,
    handleSaveSlide,
    handleCancelGeneration,
    handleEditSubmit,
    convertBlobToBase64,
    abortControllersRef
  }
}

