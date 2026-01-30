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
  
  const fileName = `generate_${Date.now()}_${Math.random().toString(36).slice(2)}.png`
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

// Base64 문자열을 mimeType과 base64로 파싱하는 헬퍼
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

// Gemini 이미지 생성 처리 (텍스트에서 이미지 생성, 또는 텍스트 + 이미지)
async function processGeminiGenerate(
  prompt: string,
  userId: string,
  geminiModel: 'nano-banana-pro' = 'nano-banana-pro',
  images?: string[]
): Promise<{ imageUrl: string; path: string; aiPrompt: string | null }> {
  console.log('[GENERATE-IMAGE] Request:', { prompt, geminiModel, hasImages: !!images, imageCount: images?.length })
  
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!)
  const modelName = 'gemini-3-pro-image-preview'
  const model = genAI.getGenerativeModel({ model: modelName })

  // parts 배열 구성: 텍스트와 이미지
  const parts: any[] = [{ text: prompt }]
  
  // 이미지가 있으면 parts에 추가
  if (images && images.length > 0) {
    for (const imageBase64 of images) {
      const { base64, mimeType } = parseBase64Image(imageBase64)
      parts.push({
        inlineData: {
          data: base64,
          mimeType
        }
      })
    }
  }

  const contents = [{
    role: 'user',
    parts
  }]

  const requestOptions: any = {
    contents,
    generationConfig: {
      response_modalities: ['Text', 'Image']
    }
  }

  // nano-banana-pro만 google_search 도구 활성화
  if (geminiModel === 'nano-banana-pro') {
    requestOptions.tools = [{"google_search": {}}] as any
  }

  const result = await model.generateContent(requestOptions as any)

  // Extract image and text data
  let imageData: Uint8Array | null = null
  let aiPrompt: string | null = null

  if (result.response?.candidates?.[0]?.content?.parts) {
    for (const part of result.response.candidates[0].content.parts) {
      if (part.inlineData) {
        imageData = Buffer.from(part.inlineData.data, 'base64')
      } else if (part.text) {
        aiPrompt = part.text.trim()
      }
    }
  }

  if (!imageData) {
    throw new Error('No image data returned from Gemini API')
  }

  // Supabase에 업로드
  const { path, url } = await uploadImageToSupabase(imageData, userId)

  return { imageUrl: url, path, aiPrompt }
}

// OpenAI 이미지 생성 처리
async function processOpenAIGenerate(
  prompt: string,
  userId: string,
  images?: string[]
): Promise<{ imageUrl: string; path: string }> {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })

  let result: any
  
  if (images && images.length > 0) {
    const imageFiles = await Promise.all(
      images.map(async (imgBase64, index) => {
        const { base64, mimeType } = parseBase64Image(imgBase64)
        const buffer = Buffer.from(base64, 'base64')
        const extension = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg'
        // toFile의 세 번째 파라미터로 type 전달
        return OpenAI.toFile(buffer, `image_${index}.${extension}`, { type: mimeType })
      })
    )

    result = await openai.images.edit({
      model: "gpt-image-1.5",
      image: imageFiles as any,
      prompt,
      input_fidelity: "high"
    })
  } else {
    result = await openai.images.generate({
      model: "gpt-image-1.5",
      prompt,
      quality: "high",
      size: "1024x1024"
    })
  }

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

// AtlasCloud Seedream 이미지 생성 처리 (텍스트에서 이미지 생성)
async function processAtlasCloudSeedreamGenerate(
  prompt: string,
  userId: string,
  images?: string[]
): Promise<{ imageUrl: string; path: string }> {
  // 이미지가 있으면 edit 모델 사용, 없으면 생성 모델 사용
  const hasImages = images && images.length > 0
  const model = hasImages ? 'bytedance/seedream-v4.5/edit' : 'bytedance/seedream-v4.5'

  const requestBody: any = {
    model,
    prompt,
    size: '2048*2048',
  }

  // edit 모델은 images 필수
  if (hasImages) {
    const imageInputs: string[] = []
    for (const imageBase64 of images) {
      const { base64, mimeType } = parseBase64Image(imageBase64)
      const dataUri = `data:${mimeType};base64,${base64}`
      imageInputs.push(dataUri)
    }
    requestBody.images = imageInputs
  }

  // AtlasCloud API 호출
  const { id: requestId } = await callAtlasCloudApi(requestBody)
  console.log('[AtlasCloud Seedream Generate] Request ID:', requestId, 'Model:', model)

  // 결과 폴링
  const outputs = await pollAtlasCloudResult(requestId)
  const imageUrl = outputs[0]

  // 이미지 다운로드 및 Supabase 업로드
  const imageData = await downloadImage(imageUrl)
  const { path, url } = await uploadImageToSupabase(imageData, userId)

  return { imageUrl: url, path }
}

// Seedream 이미지 생성 처리 (텍스트에서 이미지 생성, 또는 텍스트 + 이미지) - Replicate (deprecated)
async function processSeedreamGenerate(
  prompt: string,
  userId: string,
  images?: string[]
): Promise<{ imageUrl: string; path: string }> {
  const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
  })

  const replicateInput: any = {
    prompt
    // size 제거: 기본값 '2K' 사용
    // aspect_ratio 제거: 기본값 사용
    // sequential_image_generation 제거: 기본값 'disabled' 사용
    // max_images 제거: 기본값 1 사용
  }

  // 이미지가 있으면 image_input 배열에 추가
  if (images && images.length > 0) {
    const imageInputs: string[] = []
    for (const imageBase64 of images) {
      // data URI 형식으로 변환
      const { base64, mimeType } = parseBase64Image(imageBase64)
      const dataUri = `data:${mimeType};base64,${base64}`
      imageInputs.push(dataUri)
    }
    replicateInput.image_input = imageInputs
  }

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

export async function POST(req: NextRequest) {
  try {
    const { model, prompt, images } = await req.json()

    if (!model || !prompt) {
      return NextResponse.json(
        { error: 'Missing required fields: model, prompt' },
        { status: 400 }
      )
    }

    if (model === 'qwen-image-edit-2511') {
      return NextResponse.json(
        { error: 'qwen-image-edit-2511 is edit-only and cannot be used for generation' },
        { status: 400 }
      )
    }

    if (model !== 'nano-banana-pro' && model !== 'seadream-4.5' && model !== 'gpt-image-1.5') {
      return NextResponse.json(
        { error: 'Invalid model. Must be "nano-banana-pro", "seadream-4.5", or "gpt-image-1.5"' },
        { status: 400 }
      )
    }

    // Get authenticated user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let result: { imageUrl: string; path: string; aiPrompt?: string | null }

    if (model === 'nano-banana-pro') {
      result = await processGeminiGenerate(prompt, user.id, model, images)
    } else if (model === 'gpt-image-1.5') {
      result = await processOpenAIGenerate(prompt, user.id, images)
    } else {
      // seadream-4.5: AtlasCloud API 사용 (Replicate 대체)
      result = await processAtlasCloudSeedreamGenerate(prompt, user.id, images)
    }

    return NextResponse.json({
      success: true,
      imageUrl: result.imageUrl,
      path: result.path,
      ai_prompt: result.aiPrompt
    })

  } catch (error) {
    console.error('[GENERATE-IMAGE] Error:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        success: false 
      },
      { status: 500 }
    )
  }
}

