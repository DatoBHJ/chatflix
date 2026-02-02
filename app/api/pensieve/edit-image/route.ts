import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@/utils/supabase/server'
import Replicate from 'replicate'
import OpenAI from 'openai'

// AtlasCloud API 상수
const ATLASCLOUD_API_BASE = 'https://api.atlascloud.ai/api/v1'
const ATLASCLOUD_POLL_INTERVAL = 2000 // 2초
const ATLASCLOUD_MAX_POLL_TIME = 120000 // 2분

// Supabase 업로드 헬퍼
async function uploadImageToSupabase(uint8Array: Uint8Array, userId: string): Promise<{ path: string, url: string }> {
  const supabase = await createClient()
  
  const fileName = `edit_${Date.now()}_${Math.random().toString(36).slice(2)}.png`
  const filePath = `${userId}/${fileName}`
  
  const { data, error } = await supabase.storage
    .from('generated-images')
    .upload(filePath, uint8Array, { contentType: 'image/png' })
  
  if (error) {
    throw new Error(`Failed to upload image: ${error.message}`)
  }
  
  // Create signed URL for private bucket
  const { data: signedData, error: signedError } = await supabase.storage
    .from('generated-images')
    .createSignedUrl(filePath, 24 * 60 * 60) // 24 hours
  
  if (signedError || !signedData?.signedUrl) {
    throw new Error(`Failed to create signed URL: ${signedError?.message || 'Unknown error'}`)
  }
  
  return { path: filePath, url: signedData.signedUrl }
}

// 이미지 다운로드 헬퍼
async function downloadImage(url: string): Promise<Uint8Array> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; ChatApp/1.0)',
    },
  })
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.statusText}`)
  }
  const arrayBuffer = await response.arrayBuffer()
  return new Uint8Array(arrayBuffer)
}

// 이미지를 base64 data URI로 변환하는 헬퍼 (Seedream용)
async function convertImageToDataUri(url: string): Promise<string> {
  const uint8Array = await downloadImage(url)
  const base64 = Buffer.from(uint8Array).toString('base64')
  const contentType = 'image/png' // Replicate expects PNG format
  return `data:${contentType};base64,${base64}`
}

// URL을 절대 URL로 변환하는 헬퍼
function normalizeImageUrl(url: string, baseUrl?: string): string {
  // 이미 절대 URL인 경우
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url
  }
  
  // 상대 경로인 경우 baseUrl을 사용하여 절대 URL로 변환
  if (baseUrl) {
    try {
      const base = new URL(baseUrl)
      return new URL(url, base.origin).toString()
    } catch {
      // baseUrl 파싱 실패 시 기본 origin 사용
      return url.startsWith('/') ? `${baseUrl}${url}` : `${baseUrl}/${url}`
    }
  }
  
  // baseUrl이 없으면 그대로 반환 (에러 발생 가능)
  return url
}

// Base64 문자열을 mimeType과 base64로 파싱하는 헬퍼 함수
function parseBase64Image(base64String: string): { base64: string; mimeType: string } {
  // data:image/png;base64,xxxx 형식인 경우
  const dataUriMatch = base64String.match(/^data:image\/(\w+);base64,(.+)$/)
  if (dataUriMatch) {
    const detectedMime = dataUriMatch[1]
    const mimeType = detectedMime === 'png' ? 'image/png' : detectedMime === 'webp' ? 'image/webp' : 'image/jpeg'
    return { base64: dataUriMatch[2], mimeType }
  }
  // 이미 base64만 있는 경우
  return { base64: base64String, mimeType: 'image/jpeg' }
}

// AtlasCloud API 요청 헬퍼
async function callAtlasCloudApi(body: any): Promise<{ id: string }> {
  const response = await fetch(`${ATLASCLOUD_API_BASE}/model/generateVideo`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.ATLASCLOUD_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`AtlasCloud API error: ${response.status} - ${errorText}`)
  }

  const data = await response.json()
  if (!data.data?.id) {
    throw new Error('AtlasCloud API did not return a request ID')
  }

  return { id: data.data.id }
}

// AtlasCloud 결과 폴링 헬퍼
async function pollAtlasCloudResult(requestId: string): Promise<string[]> {
  const startTime = Date.now()

  while (Date.now() - startTime < ATLASCLOUD_MAX_POLL_TIME) {
    const response = await fetch(`${ATLASCLOUD_API_BASE}/model/result/${requestId}`, {
      headers: {
        'Authorization': `Bearer ${process.env.ATLASCLOUD_API_KEY}`,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`AtlasCloud polling error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    const status = data.data?.status || data.status

    if (status === 'completed' || status === 'succeeded') {
      const outputs = data.data?.outputs || data.outputs
      if (!outputs || outputs.length === 0) {
        throw new Error('AtlasCloud returned no output images')
      }
      return outputs
    }

    if (status === 'failed') {
      throw new Error(`AtlasCloud generation failed: ${JSON.stringify(data)}`)
    }

    // 대기 후 재시도
    await new Promise(resolve => setTimeout(resolve, ATLASCLOUD_POLL_INTERVAL))
  }

  throw new Error('AtlasCloud request timed out')
}

// Gemini 이미지 편집 처리 - 현재 이미지 + 현재 프롬프트 + 추가 이미지들
async function processGeminiEdit(
  prompt: string,
  sourceImageUrl: string | undefined,
  userId: string,
  baseUrl: string | undefined,
  geminiModel: 'nano-banana-pro' = 'nano-banana-pro',
  sourceImageBase64?: string,
  images?: string[]
): Promise<{ imageUrl: string; path: string }> {
  console.log('[EDIT-IMAGE] Request:', { prompt, sourceImageUrl, geminiModel, hasBase64: !!sourceImageBase64, hasImages: !!images, imageCount: images?.length })
  
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!)
  const modelName = 'gemini-3-pro-image-preview'
  const model = genAI.getGenerativeModel({ model: modelName })

  let base64: string
  let mimeType: string

  // Base64 데이터가 제공된 경우 (blob URL에서 변환된 경우)
  if (sourceImageBase64) {
    // data:image/png;base64,xxxx 형식에서 base64 부분만 추출
    const base64Match = sourceImageBase64.match(/^data:image\/(\w+);base64,(.+)$/)
    if (base64Match) {
      base64 = base64Match[2]
      const detectedMime = base64Match[1]
      mimeType = detectedMime === 'png' ? 'image/png' : detectedMime === 'webp' ? 'image/webp' : 'image/jpeg'
    } else {
      // 이미 base64만 있는 경우
      base64 = sourceImageBase64
      mimeType = 'image/jpeg'
    }
  } else if (sourceImageUrl) {
    // URL에서 이미지 다운로드
    const normalizedImageUrl = normalizeImageUrl(sourceImageUrl, baseUrl)
    
    // Blob URL인 경우 에러
    if (normalizedImageUrl.startsWith('blob:')) {
      throw new Error('Blob URLs are not supported. Please provide sourceImageBase64 instead.')
    }
    
    const response = await fetch(normalizedImageUrl)
    if (!response.ok) {
      throw new Error(`Failed to fetch source image: ${response.statusText}`)
    }
    
    const arrayBuffer = await response.arrayBuffer()
    base64 = Buffer.from(arrayBuffer).toString('base64')
    
    mimeType = 'image/jpeg'
    if (sourceImageUrl.includes('.png')) mimeType = 'image/png'
    else if (sourceImageUrl.includes('.webp')) mimeType = 'image/webp'
  } else {
    throw new Error('Either sourceImageUrl or sourceImageBase64 must be provided')
  }

  // parts 배열 구성: 텍스트, 소스 이미지, 추가 이미지들
  const parts: any[] = [{ text: prompt }]
  
  // 소스 이미지 추가
  parts.push({
    inlineData: {
      data: base64,
      mimeType
    }
  })
  
  // 추가 이미지들이 있으면 parts에 추가
  if (images && images.length > 0) {
    for (const imageBase64 of images) {
      const { base64: imgBase64, mimeType: imgMimeType } = parseBase64Image(imageBase64)
      parts.push({
        inlineData: {
          data: imgBase64,
          mimeType: imgMimeType
        }
      })
    }
  }

  const contents = [{
    role: 'user',
    parts
  }]

  // 최소한의 설정만 사용 (모든 설정은 API 기본값 사용)
  // 단, nano-banana-pro는 Google Search 도구 지원 (실시간 데이터 기반 이미지 생성)
  const requestOptions: any = {
    contents
    // generationConfig 제거: response_modalities는 기본값 ['Text', 'Image'] 사용
    // imageSize 제거: nano-banana-pro는 기본 1K 사용
    // aspectRatio 제거: 기본값 사용 (입력 이미지 비율 유지 또는 프롬프트에 따라 변경)
  }

  // nano-banana-pro만 google_search 도구 활성화
  if (geminiModel === 'nano-banana-pro') {
    requestOptions.tools = [{"google_search": {}}] as any
  }

  const result = await model.generateContent(requestOptions as any)

  // Extract image data
  let imageData: Uint8Array | null = null

  if (result.response?.candidates?.[0]?.content?.parts) {
    for (const part of result.response.candidates[0].content.parts) {
      if (part.inlineData) {
        imageData = Buffer.from(part.inlineData.data, 'base64')
        break
      }
    }
  }

  if (!imageData) {
    throw new Error('No image data returned from Gemini API')
  }

  // Supabase에 업로드
  const { path, url } = await uploadImageToSupabase(imageData, userId)

  return { imageUrl: url, path }
}

// OpenAI 이미지 편집 처리
async function processOpenAIEdit(
  prompt: string,
  sourceImageUrl: string | undefined,
  userId: string,
  baseUrl: string | undefined,
  sourceImageBase64?: string,
  images?: string[]
): Promise<{ imageUrl: string; path: string }> {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })

  // 이미지들 준비
  const imageInputs: any[] = []

  // 소스 이미지 준비
  if (sourceImageBase64) {
    const { base64, mimeType } = parseBase64Image(sourceImageBase64)
    const buffer = Buffer.from(base64, 'base64')
    const extension = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg'
    // toFile의 세 번째 파라미터로 type 전달
    imageInputs.push(await OpenAI.toFile(buffer, `source_image.${extension}`, { type: mimeType }))
  } else if (sourceImageUrl) {
    const normalizedImageUrl = normalizeImageUrl(sourceImageUrl, baseUrl)
    const imageData = await downloadImage(normalizedImageUrl)
    // URL에서 MIME 타입 추론
    const urlLower = normalizedImageUrl.toLowerCase()
    let mimeType = 'image/png'
    let extension = 'png'
    if (urlLower.includes('.jpg') || urlLower.includes('.jpeg')) {
      mimeType = 'image/jpeg'
      extension = 'jpg'
    } else if (urlLower.includes('.webp')) {
      mimeType = 'image/webp'
      extension = 'webp'
    }
    imageInputs.push(await OpenAI.toFile(Buffer.from(imageData), `source_image.${extension}`, { type: mimeType }))
  }

  // 추가 이미지들 준비
  if (images && images.length > 0) {
    for (const [index, imgBase64] of images.entries()) {
      const { base64, mimeType } = parseBase64Image(imgBase64)
      const buffer = Buffer.from(base64, 'base64')
      const extension = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg'
      // toFile의 세 번째 파라미터로 type 전달
      imageInputs.push(await OpenAI.toFile(buffer, `ref_image_${index}.${extension}`, { type: mimeType }))
    }
  }

  if (imageInputs.length === 0) {
    throw new Error('At least one image input is required for editing')
  }

  const result = await openai.images.edit({
    model: "gpt-image-1.5",
    image: imageInputs as any,
    prompt,
    input_fidelity: "high"
  })

  if (!result.data || result.data.length === 0) {
    throw new Error('No images generated by OpenAI')
  }

  const imageUrl = result.data[0].url
  if (!imageUrl) {
    const b64 = result.data[0].b64_json
    if (b64) {
      const imageData = Buffer.from(b64, 'base64')
      const { path, url } = await uploadImageToSupabase(imageData, userId)
      return { imageUrl: url, path }
    }
    throw new Error('No image URL or data returned from OpenAI')
  }

  const imageData = await downloadImage(imageUrl)
  const { path, url } = await uploadImageToSupabase(imageData, userId)

  return { imageUrl: url, path }
}

// Seedream 이미지 편집 처리
async function processSeedreamEdit(
  prompt: string,
  sourceImageUrl: string | undefined,
  userId: string,
  baseUrl: string | undefined,
  sourceImageBase64?: string,
  images?: string[]
): Promise<{ imageUrl: string; path: string }> {
  const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
  })

  let imageInput: string

  // Base64 데이터가 제공된 경우 (blob URL에서 변환된 경우)
  if (sourceImageBase64) {
    // 이미 data URI 형식인 경우 그대로 사용, 아니면 변환
    if (sourceImageBase64.startsWith('data:')) {
      imageInput = sourceImageBase64
    } else {
      // base64만 있는 경우 data URI로 변환
      imageInput = `data:image/png;base64,${sourceImageBase64}`
    }
  } else if (sourceImageUrl) {
    // URL에서 이미지 다운로드
    const normalizedImageUrl = normalizeImageUrl(sourceImageUrl, baseUrl)
    
    // Blob URL인 경우 에러
    if (normalizedImageUrl.startsWith('blob:')) {
      throw new Error('Blob URLs are not supported. Please provide sourceImageBase64 instead.')
    }
    
    // 이미지를 base64 data URI로 변환
    imageInput = await convertImageToDataUri(normalizedImageUrl)
  } else {
    throw new Error('Either sourceImageUrl or sourceImageBase64 must be provided')
  }

  const replicateInput: any = {
    prompt
    // size 제거: 기본값 '2K' 사용
    // aspect_ratio 제거: 기본값 'match_input_image' 사용
    // sequential_image_generation 제거: 기본값 'disabled' 사용
    // max_images 제거: 기본값 1 사용
  }

  // image_input 배열 구성: 소스 이미지 + 추가 이미지들
  const imageInputs: string[] = [imageInput]
  
  // 추가 이미지들이 있으면 image_input 배열에 추가
  if (images && images.length > 0) {
    for (const imageBase64 of images) {
      // data URI 형식으로 변환
      const { base64, mimeType } = parseBase64Image(imageBase64)
      const dataUri = `data:${mimeType};base64,${base64}`
      imageInputs.push(dataUri)
    }
  }
  
  replicateInput.image_input = imageInputs

  const output = await replicate.run("bytedance/seedream-4.5", { input: replicateInput })
  
  if (!Array.isArray(output) || output.length === 0) {
    throw new Error('No images generated by Replicate')
  }

  // 첫 번째 이미지만 사용
  const imageUrl = output[0]
  const imageData = await downloadImage(imageUrl)

  // Supabase에 업로드
  const { path, url } = await uploadImageToSupabase(imageData, userId)

  return { imageUrl: url, path }
}

// AtlasCloud Seedream 이미지 편집 처리
async function processAtlasCloudSeedreamEdit(
  prompt: string,
  sourceImageUrl: string | undefined,
  userId: string,
  baseUrl: string | undefined,
  sourceImageBase64?: string,
  images?: string[]
): Promise<{ imageUrl: string; path: string }> {
  // 이미지 배열 구성
  const imageInputs: string[] = []

  // 소스 이미지 추가
  if (sourceImageBase64) {
    // data URI 형식으로 변환
    if (sourceImageBase64.startsWith('data:')) {
      imageInputs.push(sourceImageBase64)
    } else {
      imageInputs.push(`data:image/png;base64,${sourceImageBase64}`)
    }
  } else if (sourceImageUrl) {
    const normalizedImageUrl = normalizeImageUrl(sourceImageUrl, baseUrl)
    if (normalizedImageUrl.startsWith('blob:')) {
      throw new Error('Blob URLs are not supported. Please provide sourceImageBase64 instead.')
    }
    // 이미지를 base64 data URI로 변환
    const dataUri = await convertImageToDataUri(normalizedImageUrl)
    imageInputs.push(dataUri)
  } else {
    throw new Error('Either sourceImageUrl or sourceImageBase64 must be provided')
  }

  // 추가 이미지들 추가
  if (images && images.length > 0) {
    for (const imageBase64 of images) {
      const { base64, mimeType } = parseBase64Image(imageBase64)
      const dataUri = `data:${mimeType};base64,${base64}`
      imageInputs.push(dataUri)
    }
  }

  // AtlasCloud API 호출
  const { id: requestId } = await callAtlasCloudApi({
    model: 'bytedance/seedream-v4.5/edit',
    prompt,
    images: imageInputs,
    size: '2048*2048',
  })

  console.log('[AtlasCloud Seedream Edit] Request ID:', requestId)

  // 결과 폴링
  const outputs = await pollAtlasCloudResult(requestId)
  const imageUrl = outputs[0]

  // 이미지 다운로드 및 Supabase 업로드
  const imageData = await downloadImage(imageUrl)
  const { path, url } = await uploadImageToSupabase(imageData, userId)

  return { imageUrl: url, path }
}

// Qwen Image Edit 이미지 편집 처리
async function processQwenImageEdit(
  prompt: string,
  sourceImageUrl: string | undefined,
  userId: string,
  baseUrl: string | undefined,
  sourceImageBase64?: string,
  images?: string[]
): Promise<{ imageUrl: string; path: string }> {
  const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
  })

  let imageInput: string

  // Base64 데이터가 제공된 경우 (blob URL에서 변환된 경우)
  if (sourceImageBase64) {
    // 이미 data URI 형식인 경우 그대로 사용, 아니면 변환
    if (sourceImageBase64.startsWith('data:')) {
      imageInput = sourceImageBase64
    } else {
      // base64만 있는 경우 data URI로 변환
      imageInput = `data:image/png;base64,${sourceImageBase64}`
    }
  } else if (sourceImageUrl) {
    // URL에서 이미지 다운로드
    const normalizedImageUrl = normalizeImageUrl(sourceImageUrl, baseUrl)
    
    // Blob URL인 경우 에러
    if (normalizedImageUrl.startsWith('blob:')) {
      throw new Error('Blob URLs are not supported. Please provide sourceImageBase64 instead.')
    }
    
    // 이미지를 base64 data URI로 변환
    imageInput = await convertImageToDataUri(normalizedImageUrl)
  } else {
    throw new Error('Either sourceImageUrl or sourceImageBase64 must be provided')
  }

  const replicateInput: any = {
    prompt: prompt,
    image: [imageInput], // qwen-image-edit expects array
    disable_safety_checker: true,
    go_fast: true, // 성능 최적화
    aspect_ratio: "match_input_image", // 입력 이미지 비율 유지
    output_format: "webp", // 효율적인 파일 형식
    output_quality: 95 // 높은 품질 유지
  }

  // 추가 이미지들이 있으면 image 배열에 추가
  if (images && images.length > 0) {
    for (const imageBase64 of images) {
      // data URI 형식으로 변환
      const { base64, mimeType } = parseBase64Image(imageBase64)
      const dataUri = `data:${mimeType};base64,${base64}`
      replicateInput.image.push(dataUri)
    }
  }

  const output = await replicate.run("qwen/qwen-image-edit-2511", { input: replicateInput })
  
  if (!output) {
    throw new Error('No output from Replicate')
  }

  // Handle ReadableStream output
  let imageBuffer: Buffer
  if (Array.isArray(output) && output.length > 0) {
    const firstItem = output[0]
    if (firstItem instanceof ReadableStream) {
      // Convert ReadableStream to buffer
      const reader = firstItem.getReader()
      const chunks: Uint8Array[] = []
      let done = false
      while (!done) {
        const { value, done: streamDone } = await reader.read()
        done = streamDone
        if (value) {
          chunks.push(value)
        }
      }
      imageBuffer = Buffer.concat(chunks)
    } else if (typeof firstItem === 'string') {
      // URL string
      const imageData = await downloadImage(firstItem)
      imageBuffer = Buffer.from(imageData)
    } else {
      throw new Error('Unexpected output format from Replicate')
    }
  } else if (typeof output === 'string') {
    // Direct URL string
    const imageData = await downloadImage(output)
    imageBuffer = Buffer.from(imageData)
  } else {
    throw new Error('Unexpected output format from Replicate')
  }

  // Supabase에 업로드
  const { path, url } = await uploadImageToSupabase(imageBuffer, userId)

  return { imageUrl: url, path }
}

export async function POST(req: NextRequest) {
  try {
    const { model, prompt, sourceImageUrl, sourceImageBase64, images } = await req.json()

    if (!model || !prompt || (!sourceImageUrl && !sourceImageBase64)) {
      return NextResponse.json(
        { error: 'Missing required fields: model, prompt, and either sourceImageUrl or sourceImageBase64' },
        { status: 400 }
      )
    }

    if (model !== 'nano-banana-pro' && model !== 'seadream-4.5' && model !== 'gpt-image-1.5' && model !== 'qwen-image-edit-2511') {
      return NextResponse.json(
        { error: 'Invalid model. Must be "nano-banana-pro", "seadream-4.5", "gpt-image-1.5", or "qwen-image-edit-2511"' },
        { status: 400 }
      )
    }

    // Get authenticated user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Request origin을 가져와서 상대 경로를 절대 URL로 변환
    const origin = req.headers.get('origin') || req.nextUrl.origin
    const baseUrl = origin

    let result: { imageUrl: string; path: string }

    if (model === 'nano-banana-pro') {
      result = await processGeminiEdit(prompt, sourceImageUrl, user.id, baseUrl, model, sourceImageBase64, images)
    } else if (model === 'gpt-image-1.5') {
      result = await processOpenAIEdit(prompt, sourceImageUrl, user.id, baseUrl, sourceImageBase64, images)
    } else if (model === 'qwen-image-edit-2511') {
      result = await processQwenImageEdit(prompt, sourceImageUrl, user.id, baseUrl, sourceImageBase64, images)
    } else {
      // seadream-4.5: AtlasCloud API 사용 (Replicate 대체)
      result = await processAtlasCloudSeedreamEdit(prompt, sourceImageUrl, user.id, baseUrl, sourceImageBase64, images)
    }

    return NextResponse.json({
      success: true,
      imageUrl: result.imageUrl,
      path: result.path
    })

  } catch (error) {
    console.error('[EDIT-IMAGE] Error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error occurred'
    // Expired Supabase signed URL (24h TTL) returns 400 / InvalidJWT
    const isExpiredImageUrl =
      message.includes('Bad Request') ||
      message.includes('Failed to fetch image') ||
      message.includes('Failed to download image') ||
      message.includes('InvalidJWT') ||
      message.includes('exp claim')
    if (isExpiredImageUrl) {
      return NextResponse.json(
        { error: 'Image link expired. Please refresh the page and try again.', success: false },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: message, success: false },
      { status: 500 }
    )
  }
}
