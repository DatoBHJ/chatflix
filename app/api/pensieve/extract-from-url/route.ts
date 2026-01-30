import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@/utils/supabase/server'

// API Route 타임아웃 설정 (3분) - 3단계 처리로 인해 시간이 오래 걸릴 수 있음
// Vercel Pro 이상에서만 60초 초과 가능
export const maxDuration = 180 // 3 minutes

const MAX_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

const API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY

if (!API_KEY) {
  console.warn('GOOGLE_GENERATIVE_AI_API_KEY is not set; /api/pensieve/extract-from-url will fail')
}

const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null
// 동일한 비전/텍스트 모델 설정은 upload-and-extract와 맞춘다
const visionModel = genAI ? genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' }) : null
// const visionModel = genAI ? genAI.getGenerativeModel({ model: 'gemini-3-pro-preview' }) : null
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
  
  let prompt = `You are a professional AI image generation prompt engineer specializing in creating highly detailed, technically precise prompts for photorealistic image generation. Your expertise includes professional photography terminology, cinematography techniques, and advanced image generation best practices.

## YOUR MISSION
Analyze the provided image with the precision of a professional photographer and cinematographer, then extract ALL visual information into a structured JSON prompt optimized for AI image generation models (Midjourney, DALL-E, Stable Diffusion, etc.).

## PROFESSIONAL PROMPT ENGINEERING FRAMEWORK

### 1. SUBJECT & CHARACTER DESCRIPTION
Extract with photographic precision:
- Subject identity: age, gender, ethnicity, distinctive features
- Physical attributes: build, height, hair (color, style, texture), eye color, skin tone
- Facial features: expression, emotion, micro-expressions, distinctive marks
- Pose and body language: stance, gesture, positioning, dynamic or static
- Clothing and accessories: specific garments, brands (if identifiable), materials, fit, colors, patterns, textures
- Use professional terminology: "portrait photography", "full body shot", "three-quarter view", etc.

### 2. CAMERA & TECHNICAL SPECIFICATIONS
Analyze and describe using professional photography terms:
- **Lens characteristics**: focal length (e.g., "85mm portrait lens", "24mm wide angle", "50mm standard"), aperture (e.g., "f/1.8", "f/2.8"), depth of field
- **Camera settings**: ISO sensitivity, shutter speed implications, exposure
- **Shot type**: close-up, medium shot, wide shot, extreme close-up, establishing shot
- **Camera angle**: eye level, low angle, high angle, Dutch angle, bird's eye view
- **Focus**: sharp focus, selective focus, bokeh quality, focus plane
- **Image quality**: 8K, 4K, ultra high resolution, photorealistic, professional photography

### 3. LIGHTING ANALYSIS (Critical for Image Generation)
Identify and describe using cinematography terminology:
- **Light type**: natural light, studio lighting, golden hour, blue hour, artificial lighting
- **Lighting setup**: key light, fill light, rim light, backlight, hair light, kicker light
- **Light direction**: front lighting, side lighting, Rembrandt lighting, butterfly lighting, split lighting
- **Light quality**: soft light, hard light, diffused, harsh, dramatic, ambient
- **Light temperature**: warm (golden, tungsten), cool (daylight, blue), neutral
- **Shadows**: soft shadows, hard shadows, shadow placement, shadow intensity
- **Highlights**: specular highlights, catchlights in eyes, highlight placement
- **Atmosphere**: mood lighting, dramatic lighting, cinematic lighting, naturalistic lighting

### 4. COMPOSITION & FRAMING
Analyze using professional composition rules:
- **Composition technique**: rule of thirds, centered composition, leading lines, symmetry, asymmetry, golden ratio
- **Framing**: tight frame, loose frame, negative space, frame within frame
- **Perspective**: one-point perspective, two-point perspective, forced perspective
- **Depth**: foreground, midground, background separation, depth of field, layering
- **Visual weight**: balance, visual hierarchy, focal points

### 5. COLOR & VISUAL STYLE
Extract with color grading expertise:
- **Color palette**: dominant colors, accent colors, color harmony (complementary, analogous, triadic)
- **Color grading**: warm tones, cool tones, desaturated, vibrant, muted, high contrast, low contrast
- **Color temperature**: warm color grading, cool color grading, neutral
- **Style**: photorealistic, cinematic, film photography, digital photography, vintage, modern
- **Mood**: color psychology, emotional tone conveyed through color

### 6. ENVIRONMENT & SETTING
Describe with location scouting precision:
- **Location type**: indoor, outdoor, studio, natural environment, urban, rural
- **Background elements**: specific objects, textures, architectural elements, natural features
- **Background treatment**: blurred background, sharp background, environmental storytelling
- **Atmosphere**: time of day, weather conditions, seasonal indicators
- **Environmental lighting**: window light, outdoor ambient, artificial environmental lighting

### 7. POST-PROCESSING & FINAL TOUCHES
Identify professional finishing techniques:
- **Image quality**: sharp focus, ultra detailed, professional photography, high resolution
- **Post-processing**: color grading, contrast adjustment, saturation, clarity, sharpening
- **Film look**: film grain, cinematic look, vintage film aesthetic, modern digital
- **Artistic effects**: vignette, lens flare, chromatic aberration (if present), bokeh quality

### 8. TECHNICAL METADATA
Include precise specifications:
- **Aspect ratio**: ${dimensions ? `${(dimensions.width / dimensions.height).toFixed(2)}:1` : 'calculate from image dimensions'}
- **Dimensions**: ${dimensions ? `${dimensions.width}x${dimensions.height} pixels` : 'include if determinable'}
- **Format**: professional photography format indicators

## PROFESSIONAL PROMPT STRUCTURE GUIDELINES

Your JSON output should be structured to optimize for image generation models:

1. **Subject description** (most important, most detailed)
2. **Technical camera settings** (lens, aperture, focal length)
3. **Lighting description** (critical for realism)
4. **Composition and framing**
5. **Color and style**
6. **Environment and background**
7. **Quality and post-processing tags**

## OUTPUT REQUIREMENTS
CRITICAL: You MUST output ONLY valid JSON. No markdown formatting, no code blocks (no \`\`\`json or \`\`\`), no explanatory text, no additional commentary.

- Start directly with { and end with }
- Ensure all strings are properly quoted
- Use arrays for multiple items (e.g., lighting types, colors)
- Use nested objects for hierarchical information
- Include aspect ratio in your JSON output
- Use professional photography terminology throughout

## QUALITY STANDARDS FOR PROMPT ENGINEERING
- **Exhaustive detail**: Capture every visually significant element that would affect image generation
- **Technical precision**: Use correct professional terminology (e.g., "Rembrandt lighting" not "light from side")
- **Generation-optimized**: Structure information in order of importance for AI models
- **Specificity**: Use exact, measurable descriptions (e.g., "85mm lens" not "portrait lens")
- **Completeness**: Include all elements needed to recreate the image accurately
- **Professional terminology**: Use industry-standard photography and cinematography terms

## PROMPT ENGINEERING BEST PRACTICES
- Lead with the most important visual elements (subject, then lighting, then composition)
- Use specific technical terms that image generation models recognize
- Include quality modifiers (8K, ultra detailed, photorealistic, professional photography)
- Describe lighting setup in detail (this is critical for realism)
- Specify camera settings when determinable
- Include color grading and post-processing characteristics
- Maintain consistency in terminology throughout`
  
  // 이미지 비율 정보가 있으면 프롬프트에 추가
  if (dimensions) {
    const aspectRatio = dimensions.width / dimensions.height
    // 일반적인 비율 매핑
    let aspectRatioName = ''
    if (Math.abs(aspectRatio - 16/9) < 0.1) aspectRatioName = '16:9 (widescreen)'
    else if (Math.abs(aspectRatio - 4/3) < 0.1) aspectRatioName = '4:3 (standard)'
    else if (Math.abs(aspectRatio - 1) < 0.1) aspectRatioName = '1:1 (square)'
    else if (Math.abs(aspectRatio - 3/2) < 0.1) aspectRatioName = '3:2 (classic photography)'
    else if (Math.abs(aspectRatio - 21/9) < 0.1) aspectRatioName = '21:9 (ultrawide)'
    else if (Math.abs(aspectRatio - 9/16) < 0.1) aspectRatioName = '9:16 (portrait/vertical)'
    
    prompt += `\n\n## IMAGE SPECIFICATIONS (Reference for Aspect Ratio)\n- Aspect Ratio: ${aspectRatio.toFixed(2)}:1${aspectRatioName ? ` (${aspectRatioName})` : ''}\n- Resolution: ${dimensions.width}x${dimensions.height} pixels\n- Use this aspect ratio information when structuring your JSON output to ensure accurate image generation proportions.`
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

// PASS 2: Gap Analysis - 이미지와 초기 프롬프트를 비교하여 놓친 세부사항 찾기
// DISABLED: analyzeGaps 단계 주석처리됨
/*
async function analyzeGaps(
  base64: string,
  mimeType: string,
  initialPrompt: any
): Promise<{ missing_details: string[]; inaccurate_details: string[] } | null> {
  if (!visionModel) return null

  const prompt = `You are an expert visual analysis AI specializing in comprehensive image-to-prompt comparison. Your task is to perform a systematic gap analysis between a provided image and its corresponding prompt description.

## CONTEXT
IMAGE: [attached image]
PROMPT: ${JSON.stringify(initialPrompt, null, 2)}

## YOUR ROLE
Conduct a meticulous, layer-by-layer visual analysis to identify:
1. MISSING DETAILS: Visual elements present in the image but absent from the prompt
2. INACCURATE DETAILS: Descriptions in the prompt that contradict or misrepresent the actual image

## ANALYSIS METHODOLOGY
Perform your analysis in the following order, examining each category systematically:

### 1. MACRO-LEVEL COMPOSITION
- Overall scene structure and layout
- Subject positioning and spatial arrangement
- Background elements and their relationships to foreground
- Environmental context and setting

### 2. SUBJECT DETAILS
- Physical attributes (build, proportions, features)
- Clothing, accessories, and wearable items
- Facial expressions, emotions, and micro-expressions
- Body language, poses, and gestures
- Distinctive characteristics and unique identifiers

### 3. VISUAL ELEMENTS
- Color palette: exact hues, saturation levels, color temperature
- Color relationships: gradients, transitions, color harmony
- Patterns: textures, prints, decorative elements
- Materials: surface qualities, reflectivity, opacity

### 4. LIGHTING & ATMOSPHERE
- Light source direction and quality
- Shadow placement, softness, and intensity
- Highlights and specular reflections
- Ambient lighting conditions
- Atmospheric effects (fog, haze, depth of field)

### 5. STYLISTIC & TECHNICAL QUALITIES
- Artistic style and rendering technique
- Image quality and resolution characteristics
- Composition rules (rule of thirds, symmetry, etc.)
- Visual effects and post-processing

### 6. MICRO-DETAILS
- Fine textures and surface details
- Small accessories and decorative elements
- Subtle color variations and nuances
- Edge details and boundary definitions

## OUTPUT REQUIREMENTS

CRITICAL: You MUST output ONLY valid JSON. No markdown formatting, no code blocks, no explanatory text, no additional commentary.

Required JSON structure:
{
  "missing_details": ["specific detail 1", "specific detail 2", ...],
  "inaccurate_details": ["incorrect description → correct description", ...]
}

### Guidelines for missing_details:
- Each entry must be a specific, actionable detail that can be added to the prompt
- Use descriptive, precise language
- Prioritize visually significant elements
- Format: "Subject wearing a silver necklace with pendant"
- Format: "Background contains a blurred cityscape at sunset"

### Guidelines for inaccurate_details:
- Each entry must clearly state what is wrong and what is correct
- Use format: "Incorrect → Correct" or "Described as X but actually Y"
- Be specific about the discrepancy
- Format: "Prompt says 'standing' but image shows 'sitting on chair'"
- Format: "Described as 'blue shirt' but actual color is 'navy blue with white stripes'"

## QUALITY STANDARDS
- Be thorough but avoid redundancy
- Focus on details that would meaningfully improve prompt accuracy
- If the prompt is already comprehensive and accurate, return empty arrays
- Each detail should be independently verifiable in the image
- Avoid subjective interpretations; focus on observable facts

## OUTPUT FORMAT
Return ONLY the JSON object. No preamble, no explanation, no markdown code blocks. Start with { and end with }.`

  try {
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
    const gapAnalysis = parseJsonFromText(text)
    
    // 기본 구조 보장
    return {
      missing_details: gapAnalysis.missing_details || [],
      inaccurate_details: gapAnalysis.inaccurate_details || []
    }
  } catch (error) {
    console.error('Gap analysis failed:', error)
    return null
  }
}
*/

// PASS 3a: JSON Update - corrections와 missing details를 JSON에 적용
async function updateJsonWithGaps(
  initialPrompt: any,
  gapAnalysis: { missing_details: string[]; inaccurate_details: string[] }
): Promise<any> {
  if (!textModel) return initialPrompt

  const prompt = `You are updating a JSON prompt based on corrections and additional details.

ORIGINAL JSON PROMPT:
${JSON.stringify(initialPrompt, null, 2)}

CRITICAL CORRECTIONS (MUST override original information):
${gapAnalysis.inaccurate_details.map((item: string, i: number) => `${i + 1}. ${item}`).join('\n')}

MISSING DETAILS (MUST be added):
${gapAnalysis.missing_details.map((item: string, i: number) => `${i + 1}. ${item}`).join('\n')}

INSTRUCTIONS:
1. **APPLY ALL CORRECTIONS**: Find the incorrect information in the JSON and REPLACE it with the corrected version
   Example: If correction says "standing in front of" but JSON says "leaning against", change the JSON value to "standing in front of"
   
2. **ADD ALL MISSING DETAILS**: Add each missing detail to the appropriate section in the JSON structure
   - If it's about the subject, add to "subject" section
   - If it's about lighting, add to "technical_style.lighting"
   - Create new fields if needed to accommodate the details

3. **MAINTAIN JSON STRUCTURE**: Keep the same JSON format and hierarchy

4. **BE PRECISE**: Make surgical edits - only change what needs to be corrected/added

OUTPUT FORMAT: Return ONLY the updated JSON. No markdown, no code blocks, no explanations. Just valid JSON.`

  try {
    const result = await textModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    })

    const text = result.response.text()
    const updatedJson = parseJsonFromText(text)
    
    console.log('[DEBUG] PASS 3a - JSON update completed')
    console.log('[DEBUG] PASS 3a - Updated JSON:', JSON.stringify(updatedJson, null, 2))
    
    return updatedJson
  } catch (error) {
    console.error('[DEBUG] PASS 3a - JSON update failed:', error)
    return initialPrompt
  }
}

// PASS 3b: Integration - 최종 JSON을 텍스트 프롬프트로 변환
async function integratePrompts(
  initialPrompt: any,
  gapAnalysis: { missing_details: string[]; inaccurate_details: string[] } | null
): Promise<{ updatedJson: any; finalPrompt: string }> {
  if (!textModel) return { updatedJson: initialPrompt, finalPrompt: '' }

  // Gap analysis가 없으면 바로 refinePrompt 사용
  if (!gapAnalysis || (gapAnalysis.missing_details.length === 0 && gapAnalysis.inaccurate_details.length === 0)) {
    console.log('[DEBUG] PASS 3 - No gaps found, using original JSON')
    const finalPrompt = await refinePrompt(initialPrompt)
    return { updatedJson: initialPrompt, finalPrompt }
  }

  // Step 1: JSON 업데이트 (textModel 사용)
  console.log('[DEBUG] PASS 3a - Updating JSON with corrections and missing details...')
  const updatedJson = await updateJsonWithGaps(initialPrompt, gapAnalysis)
  
  // Step 2: 업데이트된 JSON을 텍스트로 변환 (textModel 사용)
  console.log('[DEBUG] PASS 3b - Converting updated JSON to text prompt...')
  const finalPrompt = await refinePrompt(updatedJson)
  
  console.log('[DEBUG] PASS 3 - Integration completed')
  console.log('[DEBUG] PASS 3 - Corrections applied:', gapAnalysis.inaccurate_details.length)
  console.log('[DEBUG] PASS 3 - Details added:', gapAnalysis.missing_details.length)
  console.log('[DEBUG] PASS 3 - Final prompt preview:', finalPrompt.substring(0, 200) + '...')
  
  return { updatedJson, finalPrompt }
}

async function refinePrompt(aiJsonPrompt: unknown) {
  if (!textModel) return ''
  const prompt = `Convert the following structured JSON prompt into a single, natural, flowing sentence that describes the image in complete detail. Include ALL visual elements, details, and technical specifications from the JSON - do not omit any information. Every detail from the JSON structure must be incorporated into the final prompt. Output ONLY the refined prompt text, no markdown, no code blocks, no explanations.\n\nJSON Prompt:\n${JSON.stringify(aiJsonPrompt, null, 2)}`

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

    // 2-Pass Verification Loop: Extract prompts with gap analysis
    let aiJsonPrompt: any = {}
    let refinedPrompt = ''
    const debugInfo: any = {
      pass1: null,
      pass2: null,
      pass3: null,
      errors: []
    }

    try {
      // PASS 1: Initial Extraction
      console.log('[DEBUG] Starting PASS 1: Initial Extraction...')
      aiJsonPrompt = await extractAiJsonPrompt(base64, mimeType, dimensions)
      debugInfo.pass1 = {
        json_prompt: aiJsonPrompt,
        refined_prompt: await refinePrompt(aiJsonPrompt) // Pass 1의 초기 refined 버전
      }
      console.log('[DEBUG] PASS 1 completed:', JSON.stringify(aiJsonPrompt, null, 2))

      // PASS 2: Gap Analysis - DISABLED
      // console.log('[DEBUG] Starting PASS 2: Gap Analysis...')
      // const gapAnalysis = await analyzeGaps(base64, mimeType, aiJsonPrompt)
      const gapAnalysis = null // analyzeGaps 단계 비활성화
      debugInfo.pass2 = null
      
      // if (gapAnalysis) {
      //   console.log('[DEBUG] PASS 2 completed:')
      //   console.log('[DEBUG] - Missing details:', gapAnalysis.missing_details.length)
      //   console.log('[DEBUG] - Inaccurate details:', gapAnalysis.inaccurate_details.length)
      //   if (gapAnalysis.missing_details.length > 0) {
      //     console.log('[DEBUG] - Missing:', gapAnalysis.missing_details)
      //   }
      //   if (gapAnalysis.inaccurate_details.length > 0) {
      //     console.log('[DEBUG] - Inaccurate:', gapAnalysis.inaccurate_details)
      //   }
      // } else {
      //   console.log('[DEBUG] PASS 2 failed or returned null')
      //   debugInfo.errors.push('Gap analysis failed')
      // }

      // PASS 3: Integration
      console.log('[DEBUG] Starting PASS 3: Integration...')
      const integrationResult = await integratePrompts(aiJsonPrompt, gapAnalysis)
      
      // 업데이트된 JSON을 aiJsonPrompt에 반영
      aiJsonPrompt = integrationResult.updatedJson
      refinedPrompt = integrationResult.finalPrompt
      
      debugInfo.pass3 = {
        updated_json: integrationResult.updatedJson,
        final_prompt: integrationResult.finalPrompt
      }
      console.log('[DEBUG] PASS 3 completed')
      console.log('[DEBUG] Final prompt length:', refinedPrompt.length)

    } catch (error: any) {
      console.error('[DEBUG] Gemini extraction failed:', error?.message || error)
      debugInfo.errors.push(error?.message || 'Unknown error')
      
      // Pass 1이라도 성공했다면 그것을 사용
      if (Object.keys(aiJsonPrompt).length > 0) {
        console.log('[DEBUG] Using Pass 1 result as fallback')
        refinedPrompt = await refinePrompt(aiJsonPrompt).catch(() => '')
      } else {
        return NextResponse.json({ 
          error: 'Failed to extract prompt from image',
          debug: debugInfo
        }, { status: 502 })
      }
    }

    return NextResponse.json({
      success: true,
      ai_prompt: refinedPrompt || '',
      ai_json_prompt: aiJsonPrompt,
      debug: debugInfo // 디버깅 정보 포함
    })
  } catch (error) {
    console.error('Error in /api/pensieve/extract-from-url:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


