import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@/utils/supabase/server'

const MAX_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

const API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY

if (!API_KEY) {
  console.warn('GOOGLE_GENERATIVE_AI_API_KEY is not set; /api/pensieve/extract-from-url will fail')
}

const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null
// 동일한 비전/텍스트 모델 설정은 upload-and-extract와 맞춘다
const visionModel = genAI ? genAI.getGenerativeModel({ model: 'gemini-3-pro-preview' }) : null
// const visionModel = genAI ? genAI.getGenerativeModel({ model: 'gemini-3-pro-image-preview' }) : null
const textModel = genAI ? genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' }) : null

function parseJsonFromText(text: string) {
  let cleaned = text.trim()
  const block = cleaned.match(/```json\s*([\s\S]*?)\s*```/) || cleaned.match(/```\s*([\s\S]*?)\s*```/)
  if (block) cleaned = block[1].trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start !== -1 && end !== -1 && end > start) {
    cleaned = cleaned.slice(start, end + 1)
  }
  return JSON.parse(cleaned)
}

// 이미지 크기 추출 함수
function getImageDimensions(buffer: Buffer, mimeType: string): { width: number; height: number } | null {
    try {
      if (mimeType === 'image/png') {
        // PNG: IHDR 청크에서 크기 읽기 (offset 16-23)
        if (buffer.length < 24) return null
        const width = buffer.readUInt32BE(16)
        const height = buffer.readUInt32BE(20)
        return { width, height }
      } else if (mimeType === 'image/jpeg') {
        // JPEG: SOF 마커에서 크기 읽기
        let offset = 2 // Skip FF D8
        while (offset < buffer.length - 1) {
          // 범위 체크: offset + 1이 버퍼 범위 내인지 확인
          if (offset + 1 >= buffer.length) break
          
          // SOF 마커 확인 (0xFF 0xC0~0xC3)
          if (buffer[offset] === 0xff && (buffer[offset + 1] >= 0xc0 && buffer[offset + 1] <= 0xc3)) {
            // SOF 마커에서 크기 읽기 (최소 9바이트 필요: offset + 8)
            if (offset + 8 < buffer.length) {
              const height = buffer.readUInt16BE(offset + 5)
              const width = buffer.readUInt16BE(offset + 7)
              return { width, height }
            }
            break
          }
          
          // 세그먼트 길이 읽기
          if (buffer[offset] === 0xff) {
            // 범위 체크: offset + 2가 버퍼 범위 내인지 확인
            if (offset + 2 >= buffer.length) break
            
            const segmentLength = buffer.readUInt16BE(offset + 1)
            
            // segmentLength가 유효한지 확인 (최소 2바이트, 최대 남은 버퍼 크기)
            if (segmentLength < 2 || offset + 2 + segmentLength > buffer.length) {
              break
            }
            
            offset += 2 + segmentLength
          } else {
            offset++
          }
        }
      } else if (mimeType === 'image/webp') {
        // WebP: RIFF 헤더에서 크기 읽기
        if (buffer.length < 30) return null
        if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
          const format = buffer.toString('ascii', 12, 16)
          if (format === 'VP8 ') {
            // VP8 format
            const width = buffer.readUInt16LE(26) & 0x3fff
            const height = buffer.readUInt16LE(28) & 0x3fff
            return { width, height }
          } else if (format === 'VP8L') {
            // VP8L format
            const bits = buffer.readUInt32LE(21)
            const width = (bits & 0x3fff) + 1
            const height = ((bits >> 14) & 0x3fff) + 1
            return { width, height }
          } else if (format === 'VP8X') {
            // VP8X format (extended)
            const width = buffer.readUIntLE(24, 3) + 1
            const height = buffer.readUIntLE(27, 3) + 1
            return { width, height }
          }
        }
      } else if (mimeType === 'image/gif') {
        // GIF: 헤더에서 크기 읽기 (offset 6-9)
        if (buffer.length < 10) return null
        const width = buffer.readUInt16LE(6)
        const height = buffer.readUInt16LE(8)
        return { width, height }
      }
    } catch (error) {
      console.error('Error extracting image dimensions:', error)
    }
    return null
  }

async function extractAiJsonPrompt(base64: string, mimeType: string, dimensions?: { width: number; height: number } | null) {
  if (!visionModel) throw new Error('Gemini vision model not configured')
  
  let prompt = 'Extract all visual details from this image and convert them into a clean, well-structured JSON prompt. Include the aspect ratio in the JSON output. Output ONLY valid JSON format, no markdown code blocks, no explanations.'
  
  // 이미지 비율 정보가 있으면 프롬프트에 추가
  if (dimensions) {
    const aspectRatio = dimensions.width / dimensions.height
    prompt += ` The image aspect ratio is ${aspectRatio.toFixed(2)}:1.`
  }
  
  const result = await visionModel.generateContent({
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt },
          {
            inlineData: {
              data: base64,
              mimeType
            }
          }
        ]
      }
    ]
  })

  const text = result.response.text()
  return parseJsonFromText(text)
}

async function refinePrompt(aiJsonPrompt: unknown) {
  if (!textModel) return ''
  const prompt = `Convert the following structured JSON prompt into a single, natural, flowing sentence that describes the image in complete detail. Include ALL visual elements, details, and technical specifications from the JSON - do not omit any information. Every detail from the JSON structure must be incorporated into the final description. Output ONLY the refined prompt text, no markdown, no code blocks, no explanations.\n\nJSON Prompt:\n${JSON.stringify(aiJsonPrompt, null, 2)}`

  const result = await textModel.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }]
  })

  let text = result.response.text().trim()
  const block = text.match(/```[\s\S]*?\n([\s\S]*?)\n```/)
  if (block) {
    text = block[1].trim()
  }
  return text
}

export async function POST(req: NextRequest) {
  if (!API_KEY || !genAI) {
    return NextResponse.json({ error: 'Gemini API key is not configured' }, { status: 500 })
  }

  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const imageUrl: string | undefined = body?.imageUrl
    const imageBase64: string | undefined = body?.imageBase64

    let base64: string
    let mimeType: string
    let imageBuffer: Buffer | null = null

    // Base64 데이터가 제공된 경우 (blob URL에서 변환된 경우)
    if (imageBase64 && typeof imageBase64 === 'string') {
      // data:image/png;base64,xxxx 형식에서 base64 부분만 추출
      const base64Match = imageBase64.match(/^data:image\/(\w+);base64,(.+)$/)
      if (base64Match) {
        base64 = base64Match[2]
        const detectedMime = base64Match[1]
        mimeType = detectedMime === 'png' ? 'image/png' : detectedMime === 'webp' ? 'image/webp' : detectedMime === 'gif' ? 'image/gif' : 'image/jpeg'
      } else {
        // 이미 base64만 있는 경우
        base64 = imageBase64
        mimeType = 'image/jpeg'
      }

      // Base64 크기 체크 (대략적인 크기 추정)
      const estimatedSize = (base64.length * 3) / 4
      if (estimatedSize > MAX_SIZE) {
        return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 413 })
      }

      // 이미지 크기 추출을 위해 buffer 생성
      try {
        imageBuffer = Buffer.from(base64, 'base64')
      } catch (error) {
        console.error('Failed to decode base64:', error)
      }
    } else if (imageUrl && typeof imageUrl === 'string') {
      // URL에서 이미지 다운로드
      const response = await fetch(imageUrl)
      if (!response.ok) {
        return NextResponse.json(
          { error: `Failed to fetch image: ${response.status} ${response.statusText}` },
          { status: 502 }
        )
      }

      const contentTypeHeader = response.headers.get('content-type') || 'image/jpeg'
      mimeType = contentTypeHeader.split(';')[0].trim()

      if (!ALLOWED_TYPES.includes(mimeType)) {
        return NextResponse.json({ error: 'Unsupported file type' }, { status: 415 })
      }

      const arrayBuffer = await response.arrayBuffer()
      imageBuffer = Buffer.from(arrayBuffer)

      if (imageBuffer.length > MAX_SIZE) {
        return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 413 })
      }

      base64 = imageBuffer.toString('base64')
    } else {
      return NextResponse.json(
        { error: 'Either imageUrl or imageBase64 is required' },
        { status: 400 }
      )
    }

    // 이미지 크기 추출
    let dimensions: { width: number; height: number } | null = null
    if (imageBuffer) {
      dimensions = getImageDimensions(imageBuffer, mimeType)
    }

    // Extract prompts
    let aiJsonPrompt: any = {}
    let refinedPrompt = ''

    try {
      aiJsonPrompt = await extractAiJsonPrompt(base64, mimeType, dimensions)
      refinedPrompt = await refinePrompt(aiJsonPrompt)
    } catch (error: any) {
      console.error('Gemini extraction from URL failed:', error?.message || error)
      return NextResponse.json({ error: 'Failed to extract prompt from image' }, { status: 502 })
    }

    return NextResponse.json({
      success: true,
      ai_prompt: refinedPrompt || '',
      ai_json_prompt: aiJsonPrompt
    })
  } catch (error) {
    console.error('Error in /api/pensieve/extract-from-url:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


