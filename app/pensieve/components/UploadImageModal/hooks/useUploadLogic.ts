import { useState, useCallback, useEffect, useRef } from 'react'
import { Mode, EditSlide, PromptType } from '../types'
import { createClient } from '@/utils/supabase/client'

export function useUploadLogic(
  user: any,
  selectedModel: string,
  onUploadComplete: (metadata: any) => void,
  onClose: () => void,
  generationHook: any,
  contentEditableHook: any,
  galleryHook: any,
  onProjectCreated?: (projectId: string) => void,
  editingProjectId?: string | null
) {
  const [mode, setMode] = useState<Mode>('initial')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imagePath, setImagePath] = useState<string | null>(null)
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null)
  const [originalImagePath, setOriginalImagePath] = useState<string | null>(null)
  const [latestMetadata, setLatestMetadata] = useState<any | null>(null)
  const [humanPrompt, setHumanPrompt] = useState<string>('')
  const [isPublic, setIsPublic] = useState<boolean | null>(null)
  const [isOriginalSaved, setIsOriginalSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shouldAutoEnterEdit, setShouldAutoEnterEdit] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isPromptGenerating, setIsPromptGenerating] = useState(false)
  const [promptError, setPromptError] = useState<string | null>(null)
  const [generatingPrompt, setGeneratingPrompt] = useState('')
  const [generatingImages, setGeneratingImages] = useState<any[]>([])

  const [projectId, setProjectId] = useState<string | null>(editingProjectId || null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const { setIsGeneratingImage, setIsGenerating, setEditSlides, setCurrentSlideIndex, editSlides, currentSlideIndex, convertBlobToBase64 } = generationHook
  const { extractContentFromEditable, setInsertedImages, setEditInsertedImages, contentEditableRef, editContentEditableRef, insertedImages } = contentEditableHook

  // Upload input images to storage and save to user_background_settings
  const uploadInputImagesToGallery = useCallback(async () => {
    if (!user?.id || user.id === 'anonymous' || user.id.startsWith('anonymous_')) {
      return
    }

    if (!insertedImages || insertedImages.size === 0) {
      return
    }

    const supabase = createClient()
    
    try {
      // Upload each input image
      type ImageData = { blobUrl: string; base64: string; file: File }
      const uploadPromises = Array.from<ImageData>(insertedImages.values()).map(async (imageData) => {
        const file = imageData.file
        if (!file) return

        // Generate unique filename
        const fileExt = file.name.split('.').pop() || 'jpg'
        const fileName = `pensieve_${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
        const filePath = `${user.id}/${fileName}`

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from('chat_attachments')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
          })

        if (uploadError) {
          console.error('Failed to upload input image:', uploadError)
          return null
        }

        // Generate signed URL
        const { data: signedData, error: signedError } = await supabase.storage
          .from('chat_attachments')
          .createSignedUrl(filePath, 24 * 60 * 60)

        if (signedError || !signedData?.signedUrl) {
          console.error('Failed to create signed URL for input image:', signedError)
          return null
        }

        // Save to user_background_settings
        try {
          await supabase.from('user_background_settings').insert({
            user_id: user.id,
            background_path: filePath,
            background_url: signedData.signedUrl,
            url_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            name: file.name,
            source: 'pensieve_upload',
            bucket_name: 'chat_attachments'
          })
          console.log('✅ Input image saved to gallery:', file.name)
        } catch (dbError) {
          // Don't fail the upload if gallery save fails
          console.error('⚠️ Failed to save input image to gallery:', dbError)
        }

        return { success: true, filePath, url: signedData.signedUrl }
      })

      await Promise.all(uploadPromises)
    } catch (error) {
      console.error('Error uploading input images to gallery:', error)
    }
  }, [user?.id, insertedImages])

  const createProject = async (
    imageUrl: string,
    imagePath: string,
    prompt: string,
    aiPrompt: string,
    aiJsonPrompt: any,
    inputImages?: Array<{ blobUrl: string; base64: string; order: number; imageId?: string }>
  ) => {
    try {
      // 입력 이미지 정보를 ai_json_prompt에 포함
      const aiJsonPromptWithInputs = aiJsonPrompt ? { ...aiJsonPrompt } : {}
      if (inputImages && inputImages.length > 0) {
        aiJsonPromptWithInputs._inputImages = inputImages
      }
      
      // 버킷 이름 결정: URL에서 추출하거나 path에서 추론
      let bucketName = 'generated-images' // 기본값
      
      // URL에서 버킷 이름 추출 시도
      if (imageUrl && imageUrl.includes('/storage/v1/object/sign/')) {
        const match = imageUrl.match(/\/storage\/v1\/object\/sign\/([^\/]+)\//)
        if (match && match[1]) {
          bucketName = match[1]
        }
      }
      
      // URL에서 추출 실패 시 path에서 추론
      if (bucketName === 'generated-images') {
        if (imagePath.includes('saved-gallery') || imagePath.includes('pensieve_upload')) {
          bucketName = 'saved-gallery'
        } else if (imagePath.includes('generate_') || imagePath.includes('edit_')) {
          bucketName = 'generated-images'
        }
      }
      
      const response = await fetch('/api/pensieve/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: prompt.substring(0, 50) || 'Untitled Project',
          originalImageUrl: imageUrl,
          originalImagePath: imagePath,
          originalBucketName: bucketName,
          prompt,
          aiPrompt,
          aiJsonPrompt: aiJsonPromptWithInputs,
          selectedModel,
          isPublic: isPublic ?? false,
          firstSlide: {
            imageUrl,
            imagePath,
            bucketName: bucketName,
            prompt,
            aiPrompt,
            aiJsonPrompt: aiJsonPromptWithInputs
          }
        })
      })

      if (!response.ok) throw new Error('Failed to create project')
      
      const data = await response.json()
      if (data.success && data.project) {
        // 브로드캐스트 채널을 통해 프로젝트 목록 갱신 요청
        if (typeof window !== 'undefined') {
          const channel = new BroadcastChannel('pensieve-refresh')
          channel.postMessage({ 
            type: 'project-created', 
            project: data.project,
            // 같은 탭에서의 리프레시 방지를 위한 식별자 (필요시)
            sourceTabId: (window as any)._tabId 
          })
          channel.close()
        }
        
        // 상위 컴포넌트에 알림
        if (onProjectCreated) {
          onProjectCreated(data.project.id)
        }
        
        // 프로젝트 ID와 첫 슬라이드 ID를 모두 반환
        return {
          projectId: data.project.id,
          firstSlideId: data.firstSlide?.id || null
        }
      }
    } catch (error) {
      console.error('Error creating project:', error)
    }
    return null
  }

  const handleGenerateImage = async () => {
    if (!user || user.id === 'anonymous') {
      setError('Sign in required.')
      return
    }
    
    const content = extractContentFromEditable()
    const promptText = content.text
    const images = content.images.length > 0 ? content.images : undefined
    const imagesForDisplay = content.metadata

    if (!promptText.trim() && (!images || images.length === 0)) return

    setIsGeneratingImage(true)
    setError(null)

    try {
      // qwen-image-edit-2511 모델이고 이미지가 있으면 편집 API 사용
      const isQwenEditWithImages = selectedModel === 'qwen-image-edit-2511' && images && images.length > 0
      
      let data: any
      if (isQwenEditWithImages) {
        // 편집 모드: 첫 번째 이미지를 sourceImage로, 나머지를 추가 이미지로 사용
        const sourceImageBase64 = images[0]
        const additionalImages = images.length > 1 ? images.slice(1) : undefined
        
        const response = await fetch('/api/pensieve/edit-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: selectedModel,
            prompt: promptText || 'Edit image',
            sourceImageBase64: sourceImageBase64,
            images: additionalImages
          })
        })
        
        data = await response.json()
        if (!data.success || !data.imageUrl) throw new Error(data.error || 'Failed to edit image')
      } else {
        // 생성 모드
        const response = await fetch('/api/pensieve/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: promptText || 'Generate image', model: selectedModel, images })
        })
        
        data = await response.json()
        if (!data.success || !data.imageUrl) throw new Error(data.error || 'Failed to generate')
      }

      setImageUrl(data.imageUrl)
      setImagePath(data.path)
      setOriginalImageUrl(data.imageUrl)
      setOriginalImagePath(data.path)
      setLatestMetadata({ prompt: promptText.trim(), originalPrompt: promptText.trim(), originalPromptImages: imagesForDisplay })
      setHumanPrompt(promptText.trim())
      
      // 프로젝트 즉시 생성 (슬라이드 ID를 받기 위해 먼저 생성)
      const projectData = await createProject(
        data.imageUrl,
        data.path,
        promptText.trim(),
        data.ai_prompt,
        data.ai_json_prompt,
        imagesForDisplay.length > 0 ? imagesForDisplay : undefined
      )
      
      if (projectData) {
        setProjectId(projectData.projectId)
        
        // Upload input images to gallery after project creation succeeds
        if (imagesForDisplay && imagesForDisplay.length > 0) {
          await uploadInputImagesToGallery()
        }
        
        // 바로 Edit 모드로 진입하며 초기 슬라이드 설정 (실제 DB 슬라이드 ID 사용)
        const initialSlide: EditSlide = {
          id: projectData.firstSlideId || `slide-${Date.now()}`, // 실제 DB ID 사용
          imageUrl: data.imageUrl,
          path: data.path,
          prompt: promptText.trim(),
          isOriginal: true,
          isGenerating: false,
          isSaved: false,
          timestamp: new Date().toISOString(),
          parentSlideId: null,
          ai_prompt: data.ai_prompt,
          ai_json_prompt: data.ai_json_prompt
        }
        setEditSlides([initialSlide])
        setCurrentSlideIndex(0)
        setMode('edit')
        
        setShouldAutoEnterEdit(true)
      }

    } catch (err: any) {
      setError(err.message)
      setMode('initial')
    } finally {
      setIsGeneratingImage(false)
    }
  }

  const handleFinalSave = async () => {
    if (isSaving || isPublic === null) return
    setIsSaving(true)
    try {
      let finalPath = imagePath, finalUrl = imageUrl, isSavingOriginal = true
      
      if (mode === 'edit' && editSlides[currentSlideIndex]) {
        const slide = editSlides[currentSlideIndex]
        finalUrl = slide.imageUrl; finalPath = slide.path; isSavingOriginal = slide.isOriginal
      }

      const res = await fetch('/api/pensieve/save-extracted', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imagePath: finalPath, imageUrl: finalUrl, prompt: humanPrompt, isPublic })
      })
      if (!res.ok) throw new Error('Save failed')
      
      const data = await res.json()
      onUploadComplete({ ...latestMetadata, isPublic, imageId: data.imageId })
      if (isSavingOriginal) setIsOriginalSaved(true)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleExtractPrompt = async () => {
    // 현재 모드와 슬라이드에 따라 적절한 이미지 URL 결정
    let targetImageUrl: string | null = null
    
    if (mode === 'edit' && generationHook.editSlides[generationHook.currentSlideIndex]) {
      // 편집 모드: 현재 슬라이드의 이미지 URL 사용
      targetImageUrl = generationHook.editSlides[generationHook.currentSlideIndex].imageUrl
      console.log('[handleExtractPrompt] Edit mode - using current slide URL:', targetImageUrl)
    } else if (mode === 'initial') {
      // 초기 모드: 삽입된 이미지가 있으면 그것을 사용
      const content = extractContentFromEditable()
      if (content.metadata.length === 1) {
        targetImageUrl = content.metadata[0].blobUrl
        console.log('[handleExtractPrompt] Initial mode - using inserted image:', targetImageUrl)
      }
    }
    
    // 폴백: 상태의 imageUrl 사용
    if (!targetImageUrl) {
      targetImageUrl = imageUrl
      console.log('[handleExtractPrompt] Using fallback imageUrl:', targetImageUrl)
    }

    if (!targetImageUrl || isPromptGenerating) return
    
    console.log('[handleExtractPrompt] Starting extraction for URL:', targetImageUrl)
    console.log('[handleExtractPrompt] Current projectId:', projectId)
    console.log('[handleExtractPrompt] Current mode:', mode)
    console.log('[handleExtractPrompt] Current slide index:', generationHook.currentSlideIndex)
    
    setIsPromptGenerating(true)
    setPromptError(null)
    try {
      // Determine if it's a blob URL or a regular URL
      let body: any = {}
      if (targetImageUrl.startsWith('blob:')) {
        const base64 = await convertBlobToBase64(targetImageUrl)
        body = { imageBase64: base64 }
      } else {
        body = { imageUrl: targetImageUrl }
      }

      // 3-Pass Verification이 오래 걸릴 수 있으므로 타임아웃 설정 (3분)
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 180000) // 3 minutes
      
      const res = await fetch('/api/pensieve/extract-from-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal
      })
      clearTimeout(timeoutId)
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to extract prompt')
      }
      const data = await res.json()
      
      // Debug 정보 콘솔에 출력
      if (data.debug) {
        console.log('[handleExtractPrompt] Debug info:', data.debug)
        if (data.debug.pass2) {
          console.log('[handleExtractPrompt] Missing details:', data.debug.pass2.missing_details?.length || 0)
          console.log('[handleExtractPrompt] Inaccurate details:', data.debug.pass2.inaccurate_details?.length || 0)
        }
      }
      
      // 편집 모드인 경우: 현재 슬라이드만 업데이트 (다른 슬라이드에 영향 없음)
      if (mode === 'edit' && generationHook.editSlides[generationHook.currentSlideIndex]) {
        const currentSlide = generationHook.editSlides[generationHook.currentSlideIndex]
        
        console.log('[handleExtractPrompt] Updating current slide:', {
          slideId: currentSlide.id,
          isOriginal: currentSlide.isOriginal,
          projectId: projectId
        })
        
        // 현재 슬라이드의 ai_prompt, ai_json_prompt 업데이트
        generationHook.setEditSlides((prev: EditSlide[]) => prev.map((s: EditSlide, i: number) => 
          i === generationHook.currentSlideIndex 
            ? { ...s, ai_prompt: data.ai_prompt, ai_json_prompt: data.ai_json_prompt }
            : s
        ))

        // Persist to database if project and slide exist
        if (projectId && currentSlide.id && !currentSlide.id.startsWith('slide-')) {
          console.log('[handleExtractPrompt] Updating slide in DB:', currentSlide.id)
          try {
            const response = await fetch(`/api/pensieve/projects/${projectId}/slides/${currentSlide.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ai_prompt: data.ai_prompt,
                ai_json_prompt: data.ai_json_prompt
              })
            })
            
            if (!response.ok) {
              const errorData = await response.json()
              console.error('[handleExtractPrompt] Failed to update slide:', errorData)
            } else {
              console.log('[handleExtractPrompt] Successfully updated slide in DB')
            }
          } catch (dbErr) {
            console.error('Failed to update slide metadata:', dbErr)
          }
        }
        
        // If it's the original slide, also update the project itself
        if (projectId && currentSlide.isOriginal) {
          console.log('[handleExtractPrompt] Updating original project in DB')
          try {
            const response = await fetch(`/api/pensieve/projects/${projectId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                aiPrompt: data.ai_prompt,
                aiJsonPrompt: data.ai_json_prompt
              })
            })
            
            if (!response.ok) {
              const errorData = await response.json()
              console.error('[handleExtractPrompt] Failed to update project:', errorData)
            } else {
              console.log('[handleExtractPrompt] Successfully updated project in DB')
            }
          } catch (dbErr) {
            console.error('Failed to update project metadata:', dbErr)
          }
        } else {
          console.log('[handleExtractPrompt] Skipping DB update - temporary slide or no projectId:', {
            projectId,
            slideId: currentSlide.id,
            isOriginal: currentSlide.isOriginal
          })
        }
      } else {
        // 초기 모드인 경우: latestMetadata와 프롬프트 업데이트
        console.log('[handleExtractPrompt] Initial mode - updating latestMetadata and editor')
        
        setLatestMetadata((prev: any) => ({
          ...prev,
          ai_prompt: data.ai_prompt,
          ai_json_prompt: data.ai_json_prompt
        }))

        // Update human prompt (editor text) with the extracted prompt
        if (data.ai_prompt) {
          setHumanPrompt(data.ai_prompt)
          setGeneratingPrompt(data.ai_prompt)
          
          // Also update contentEditable DOM if it exists
          if (contentEditableRef.current) {
            // Keep images but update text
            const domImages = contentEditableRef.current.querySelectorAll('div[contenteditable="false"]')
            contentEditableRef.current.innerHTML = data.ai_prompt
            domImages.forEach((img: any) => contentEditableRef.current?.appendChild(img))
          }
        }
      }

      console.log('[handleExtractPrompt] Extraction complete')
      return data
    } catch (err: any) {
      console.error('[handleExtractPrompt] Error:', err)
      
      // 타임아웃 에러 처리
      if (err.name === 'AbortError') {
        setPromptError('Request timed out. The image analysis is taking longer than expected. Please try again.')
      } else {
        setPromptError(err.message || 'Failed to extract prompt')
      }
    } finally {
      setIsPromptGenerating(false)
    }
  }

  return {
    mode, setMode,
    imageUrl, setImageUrl,
    imagePath, setImagePath,
    originalImageUrl, setOriginalImageUrl,
    originalImagePath, setOriginalImagePath,
    latestMetadata, setLatestMetadata,
    humanPrompt, setHumanPrompt,
    isPublic, setIsPublic,
    isOriginalSaved, setIsOriginalSaved,
    error, setError,
    shouldAutoEnterEdit, setShouldAutoEnterEdit,
    isSaving, handleFinalSave,
    isPromptGenerating, setIsPromptGenerating,
    handleExtractPrompt,
    promptError, setPromptError,
    generatingPrompt, setGeneratingPrompt,
    generatingImages, setGeneratingImages,
    handleGenerateImage,
    fileInputRef,
    projectId
  }
}

