import { NextRequest } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { createClient } from '@/utils/supabase/server'
import { getAllMemoryBank } from '@/utils/memory-bank'
import { getCachedJSON, setCachedJSON } from '@/lib/redis-json'
import { buildIpInfoCacheKey, getCacheExpiryIso, GEO_CACHE_TTL_SECONDS } from '@/lib/trends/cache'

// Country code to language code mapping (reverse of languageToGeoMapping)
const COUNTRY_TO_LANGUAGE: Record<string, string> = {
  'KR': 'ko',    // South Korea -> Korean
  'US': 'en',    // United States -> English
  'GB': 'en',    // United Kingdom -> English
  'CA': 'en',    // Canada -> English
  'AU': 'en',    // Australia -> English
  'NZ': 'en',    // New Zealand -> English
  'JP': 'ja',    // Japan -> Japanese
  'CN': 'zh',    // China -> Chinese
  'TW': 'zh',    // Taiwan -> Chinese
  'HK': 'zh',    // Hong Kong -> Chinese
  'SG': 'zh',    // Singapore -> Chinese
  'ES': 'es',    // Spain -> Spanish
  'MX': 'es',    // Mexico -> Spanish
  'AR': 'es',    // Argentina -> Spanish
  'CL': 'es',    // Chile -> Spanish
  'CO': 'es',    // Colombia -> Spanish
  'PE': 'es',    // Peru -> Spanish
  'FR': 'fr',    // France -> French
  'BE': 'fr',    // Belgium -> French
  'CH': 'de',    // Switzerland -> German (primary)
  'DE': 'de',    // Germany -> German
  'IT': 'it',    // Italy -> Italian
  'PT': 'pt',    // Portugal -> Portuguese
  'BR': 'pt',    // Brazil -> Portuguese
  'RU': 'ru',    // Russia -> Russian
  'SA': 'ar',    // Saudi Arabia -> Arabic
  'IN': 'hi',    // India -> Hindi
  'ID': 'id',    // Indonesia -> Indonesian
  'TH': 'th',    // Thailand -> Thai
  'VN': 'vi',    // Vietnam -> Vietnamese
  'TR': 'tr',    // Turkey -> Turkish
  'PL': 'pl',    // Poland -> Polish
  'NL': 'nl',    // Netherlands -> Dutch
  'SE': 'sv',    // Sweden -> Swedish
  'DK': 'da',    // Denmark -> Danish
  'FI': 'fi',    // Finland -> Finnish
  'NO': 'no',    // Norway -> Norwegian
  'CZ': 'cs',    // Czech Republic -> Czech
  'HU': 'hu',    // Hungary -> Hungarian
  'RO': 'ro',    // Romania -> Romanian
  'UA': 'uk',    // Ukraine -> Ukrainian
  'GR': 'el',    // Greece -> Greek
  'IL': 'he',    // Israel -> Hebrew
  'BD': 'bn',    // Bangladesh -> Bengali
}

type IpInfoPayload = {
  country?: string
  [key: string]: any
}

type IpInfoCacheEntry = {
  payload: IpInfoPayload
  resolvedAt: string
  cacheExpiresAt: string
}

const IPINFO_TOKEN = process.env.INFO_TOKEN || process.env.IPINFO_TOKEN

const isPrivateIp = (ip?: string | null) => {
  if (!ip) return true
  if (ip === '::1' || ip === '127.0.0.1') return true
  if (ip.startsWith('10.') || ip.startsWith('192.168.') || ip.startsWith('172.16.')) {
    return true
  }
  return false
}

const extractClientIp = (req: NextRequest) => {
  const headerCandidates = [
    req.headers.get('x-client-ip'),
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
    req.headers.get('x-real-ip'),
  ]
  return headerCandidates.find(Boolean) || null
}

const fetchIpinfo = async (ip?: string | null): Promise<IpInfoPayload> => {
  if (!IPINFO_TOKEN) {
    throw new Error('INFO_TOKEN (or IPINFO_TOKEN) is not configured')
  }

  const baseUrl = 'https://ipinfo.io'
  const path = !ip || isPrivateIp(ip) ? '/json' : `/${ip}/json`
  const url = `${baseUrl}${path}?token=${IPINFO_TOKEN}`

  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) {
    const msg = await response.text()
    throw new Error(`IPinfo request failed: ${response.status} ${msg}`)
  }

  return response.json()
}

/**
 * Extract browser language code from Accept-Language header
 * Returns language code (e.g., "ko", "en", "ja") or null
 */
function getBrowserLanguageCode(req: NextRequest): string | null {
  const acceptLanguage = req.headers.get('accept-language')
  if (!acceptLanguage) return null

  // Parse Accept-Language header (e.g., "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7")
  // Extract the first preferred language code
  const firstLang = acceptLanguage.split(',')[0]?.split(';')[0]?.trim().toLowerCase()
  if (!firstLang) return null

  // Return base language code (e.g., "ko" from "ko-KR", "en" from "en-US")
  return firstLang.split('-')[0]
}

/**
 * Get language code from IP-based country detection
 * Returns language code (e.g., "ko", "en", "ja") or null
 */
async function getIpBasedLanguageCode(req: NextRequest): Promise<string | null> {
  if (!IPINFO_TOKEN) {
    return null
  }

  try {
    const clientIp = extractClientIp(req)
    const cacheKey = buildIpInfoCacheKey(clientIp)

    // Try to get cached IP info
    let cached = await getCachedJSON<IpInfoCacheEntry>(cacheKey)

    if (!cached) {
      const payload = await fetchIpinfo(clientIp)
      const resolvedAt = new Date().toISOString()
      const cacheExpiresAt = getCacheExpiryIso(GEO_CACHE_TTL_SECONDS)

      cached = { payload, resolvedAt, cacheExpiresAt }
      await setCachedJSON(cacheKey, cached, GEO_CACHE_TTL_SECONDS)
    }

    const countryCode = cached.payload.country?.toUpperCase()
    if (!countryCode) return null

    // Map country code to language code
    return COUNTRY_TO_LANGUAGE[countryCode] || null
  } catch (error) {
    // Silently fail - IP-based detection is a fallback
    console.warn('[trends/summary] Failed to get IP-based language:', error)
    return null
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      query,
      location,
      news,
      categories,
      keywords,
      position,
      searchVolume,
      percentageIncrease,
      isFollowUp,
      conversationHistory,
      initialSummary,
    } = body

    if (!query) {
      return new Response(JSON.stringify({ error: 'Query is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    
    // Validate follow-up request
    if (isFollowUp && (!conversationHistory || !Array.isArray(conversationHistory) || conversationHistory.length === 0)) {
      return new Response(JSON.stringify({ error: 'conversationHistory is required for follow-up questions' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    
    if (isFollowUp && !initialSummary) {
      return new Response(JSON.stringify({ error: 'initialSummary is required for follow-up questions' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API key not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Get user and load only personal info memory
    // 🚀 최적화: 클라이언트에서 전달된 메모리를 우선 사용 (localStorage 캐시 활용)
    const { personalInfoMemory: clientMemory } = body
    let personalInfoMemory: string | null = clientMemory || null
    
    // 클라이언트에서 메모리를 전달하지 않은 경우에만 서버에서 로드
    if (!personalInfoMemory) {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        const { data: memoryData } = await getAllMemoryBank(supabase, user.id, ['00-personal-info'])
        personalInfoMemory = memoryData || null
      }
    }

    // Detect language for guest mode (when no personalInfoMemory)
    // Priority: browser language > IP-based language > English default
    let detectedLanguageCode: string | null = null
    if (!personalInfoMemory) {
      // Try browser language first (most accurate)
      detectedLanguageCode = getBrowserLanguageCode(req)
      
      // Fallback to IP-based detection if browser language not available
      if (!detectedLanguageCode) {
        detectedLanguageCode = await getIpBasedLanguageCode(req)
      }
    }

    // Build combined prompt (system + user in one)
    const newsTitles = news?.map((n: any) => n.title).filter(Boolean).join(', ') || 'None'
    const categoriesStr = categories?.join(', ') || 'None'
    const keywordsStr = keywords?.join(', ') || 'None'

    // Determine language instruction based on available information
    let languageInstruction: string
    if (personalInfoMemory) {
      languageInstruction = `USER PERSONAL INFORMATION MEMORY (contains language preference - use this language for all responses):\n${personalInfoMemory}\n\nIMPORTANT: Generate the summary and questions in the language specified in the user's personal information memory above. Extract the language preference from that memory and use that exact language for all responses.`
    } else if (detectedLanguageCode) {
      languageInstruction = `No user memory available. The user's language is detected as ${detectedLanguageCode} (based on browser settings or IP location). Generate the summary and questions in language code ${detectedLanguageCode}.`
    } else {
      languageInstruction = 'No user memory available. Use English as default. Generate the summary and questions in English (default).'
    }

    let prompt: string
    let responseJsonSchema: any

    if (isFollowUp) {
      // Handle follow-up question
      const conversationText = conversationHistory
        .map((msg: { role: string; content: string }) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
        .join('\n\n')
      
      const lastUserQuestion = conversationHistory
        .filter((msg: { role: string }) => msg.role === 'user')
        .slice(-1)[0]?.content || ''

      // Get current date
      const currentDate = new Date().toISOString().split('T')[0]
      const currentDateFormatted = new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })

      prompt = `You are a helpful friend chatting casually about trending topics. Use a very casual, friendly tone as if texting a close friend.

${languageInstruction}

CURRENT DATE: ${currentDateFormatted} (${currentDate})

SITUATION:
The user is asking a follow-up question about a trending topic. An initial summary was provided earlier (see below). Answer naturally using all available context.

TRENDING TOPIC:
Query: ${query}
Location: ${location || 'Global'}
Rank: ${position || 'N/A'}
Search Volume: ${searchVolume || 'N/A'}
Increase: ${percentageIncrease ? `${percentageIncrease}%` : 'N/A'}
Categories: ${categoriesStr}
Related News: ${newsTitles}
Related Keywords: ${keywordsStr}

INITIAL SUMMARY:
${initialSummary}

CONVERSATION HISTORY:
${conversationText}

USER'S QUESTION:
${lastUserQuestion}

YOUR RESPONSE:
- Use a casual, friendly tone - natural and conversational
- Use emojis sparingly and only when it feels natural (don't overdo it)
- Answer directly and concisely without formal intros
- CRITICAL: Do NOT use repetitive opening phrases like "Hey!", "So," etc. Jump straight into the answer - this is a continuing conversation, not a new one.
- Keep it short: 2-4 sentences, max 100 words
- Answer using all available context (summary, conversation, news, keywords). Do your best to provide a helpful answer from what's available
- CRITICAL: The "answer" field must contain ONLY the answer to the user's question - NO questions should be included in the answer field. Questions are generated separately in the "followUpQuestions" field.
- Only mention Chatflix if the question is completely impossible to answer with the provided context AND requires real-time data that doesn't exist in the context. When mentioning Chatflix, tell the user to send a message to Chatflix (e.g., "You should message Chatflix about this" or similar in the user's language)
- Generate 1-3 SHORT follow-up questions in the "followUpQuestions" field (NOT in the answer field). These should be about basic facts from the news or suggestions to use Chatflix's features. Use a casual, direct tone - like texting a friend. Examples: "뭐가 일어났음?", "누구임?", "언제?", "배경이 뭐임?", "이걸로 이미지 만들어줘", "관련 영상 찾아줘". Avoid formal question endings. Keep questions super short and casual. CRITICAL: Instead of asking about obvious numbers, percentages, or basic definitions, ask about specific events, people, details, or context that adds value. NO complex analysis questions like "How will this affect...?" or "What are the implications...?"
- Respond in the same language as the conversation`

      responseJsonSchema = {
        type: 'object',
        properties: {
          answer: {
            type: 'string',
            description: 'A concise answer to the user\'s question formatted as valid Markdown in the user\'s language. This field must contain ONLY the answer - do NOT include any questions in this field. Questions should be in the followUpQuestions field.',
          },
          followUpQuestions: {
            type: 'array',
            items: { type: 'string' },
            minItems: 0,
            maxItems: 3,
            description: 'Optional follow-up questions (0-3) that the user might want to ask next',
          },
        },
        required: ['answer'],
      }
    } else {
      // Handle initial summary generation
      prompt = `You are a helpful friend that summarizes trending topics in a casual, friendly way - like explaining to a close friend. Keep it short and focus on why it's trending.

${languageInstruction}

TRENDING TOPIC:
Query: ${query}
Location: ${location || 'Global'}
Rank: ${position || 'N/A'}
Search Volume: ${searchVolume || 'N/A'}
Increase: ${percentageIncrease ? `${percentageIncrease}%` : 'N/A'}
Categories: ${categoriesStr}
Related News: ${newsTitles}
Related Keywords: ${keywordsStr}

FORMATTING (MUST use Markdown extensively):
- # for main title, ## for sections, ### for subsections
- **bold** for emphasis on key terms, names, numbers, or important facts
- Use lists (- or *) to organize information when presenting multiple points, facts, or details
- Use numbered lists (1.) for sequential information or steps
- Double newlines for paragraph separation
- Use emojis sparingly and only when natural (don't overdo it)
- Structure the body content with Markdown: use **bold** for key information, lists for multiple facts, and proper paragraph breaks

CONTENT REQUIREMENTS:
- MAIN TITLE (# header): One-line explanation of WHY this is trending right now. Make it clear and instantly informative.
- BODY CONTENT: Write the summary body using Markdown formatting extensively. Use **bold** for important names, numbers, key terms, or facts. Use lists (- or *) when presenting multiple related points or details. Use ## for section headers if breaking down into sections. Keep a casual, friendly tone but structure the information clearly with Markdown.
- TONE: Use a casual, friendly tone - natural and conversational. BUT never sacrifice accuracy for casualness. Be precise and include all key facts. The tone stays casual, but the formatting should be clear and structured. Write directly and concisely without formal intros or unnecessary formal endings. Get straight to the point as if texting a friend.
- ACCURACY: Include ALL key facts, numbers, and important details from the data. Never skip critical info just to sound casual. Use **bold** to highlight these important facts.
- LENGTH: 2-3 paragraphs max. Focus on the core reason and key facts only. Keep it straightforward. Use Markdown to make it readable and well-structured. Be direct and concise - avoid unnecessary words or formal structures.
- FOLLOW-UP QUESTIONS: Generate 3 SHORT questions (5-10 words max). Use a casual, direct tone - like texting a friend. Avoid formal question endings. Examples: "뭐임?", "누구임?", "어쨌던거?", "배경이 뭐임?", "언제?". CRITICAL: The FIRST question MUST be about something from the main title (# header). If the title mentions a phrase, quote, term, or concept, ask about that in a casual way (e.g., "[person]이 뭐라고 했음?", "[event]의 배경이 뭐임?"). The other 2 questions should be about basic facts from the news in a casual style (e.g., "[person] 누구임?", "[event] 언제 일어났음?", "[detail]이 뭐임?"). You can also suggest using Chatflix for more creative tasks like "이걸로 이미지 만들어줘" or "관련된 영상 보여줘". IMPORTANT: Instead of asking about obvious numbers, percentages, or basic definitions, ask about specific events, people, details, or context that adds real value. NO deep analysis questions - those need Chatflix.`

      responseJsonSchema = {
        type: 'object',
        properties: {
          summary: {
            type: 'string',
            description: 'A concise summary formatted as valid Markdown in user\'s language. Must use Markdown formatting extensively: **bold** for key terms/names/numbers, lists (- or *) for multiple points, ## for sections if needed, proper paragraph breaks. Keep a casual, friendly tone but structure with Markdown.',
          },
          questions: {
            type: 'array',
            items: { type: 'string' },
            minItems: 3,
            maxItems: 3,
            description: 'Three follow-up questions users might ask about this trend',
          },
        },
        required: ['summary', 'questions'],
      }
    }

    // Initialize Gemini API (following example structure exactly)
    const ai = new GoogleGenAI({ apiKey })

    // Generate content stream (following example structure exactly)
    const stream = await ai.models.generateContentStream({
      model: 'gemini-2.5-flash-lite',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseJsonSchema: responseJsonSchema,
      },
    })

    // Create streaming response (following example: for await (const chunk of stream))
    const readableStream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        try {
          for await (const chunk of stream) {
            const chunkText = chunk.candidates?.[0]?.content?.parts?.[0]?.text
            if (chunkText) {
              controller.enqueue(encoder.encode(chunkText))
            }
          }
          controller.close()
        } catch (error: any) {
          console.error('[trends/summary] streaming error', error)
          controller.error(error)
        }
      },
    })

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'application/json',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache',
      },
    })
  } catch (error: any) {
    console.error('[trends/summary] error', error)
    return new Response(
      JSON.stringify({ error: 'Failed to generate summary', details: error?.message || 'Unknown error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}

