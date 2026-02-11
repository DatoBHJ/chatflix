import { NextRequest } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { createClient } from '@/utils/supabase/server'
import { getAllMemoryBank } from '@/utils/memory-bank'

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      year,
      headline,
      summary,
      title,
      articleUrl,
      language,
      isFollowUp,
      conversationHistory,
      initialSummary,
    } = body

    if (!headline || !year) {
      return new Response(JSON.stringify({ error: 'Headline and year are required' }), {
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

    // Get user and load personal core memory
    // 🚀 최적화: 클라이언트에서 전달된 메모리를 우선 사용 (localStorage 캐시 활용)
    const { personalInfoMemory: clientMemory } = body
    let personalInfoMemory: string | null = clientMemory || null
    
    // 클라이언트에서 메모리를 전달하지 않은 경우에만 서버에서 로드
    if (!personalInfoMemory) {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        const { data: memoryData } = await getAllMemoryBank(supabase, user.id, ['00-personal-core'])
        personalInfoMemory = memoryData || null
      }
    }

    // Detect language for guest mode (when no personalInfoMemory)
    // Priority: browser language > provided language > English default
    let detectedLanguageCode: string | null = null
    if (!personalInfoMemory) {
      // Try browser language first (most accurate)
      detectedLanguageCode = getBrowserLanguageCode(req) || language || null
    }

    // Determine language instruction based on available information
    let languageInstruction: string
    if (personalInfoMemory) {
      languageInstruction = `USER PERSONAL INFORMATION MEMORY (contains language preference - use this language for all responses):\n${personalInfoMemory}\n\nIMPORTANT: Generate the summary and questions in the language specified in the user's personal information memory above. Extract the language preference from that memory and use that exact language for all responses.`
    } else if (detectedLanguageCode) {
      languageInstruction = `No user memory available. The user's language is detected as ${detectedLanguageCode} (based on browser settings or provided language). Generate the summary and questions in language code ${detectedLanguageCode}.`
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

      prompt = `You are a helpful friend chatting casually about historical events. Use a very casual, friendly tone as if texting a close friend.

${languageInstruction}

CURRENT DATE: ${currentDateFormatted} (${currentDate})

ORIGINAL HISTORICAL EVENT CONTEXT:
Year: ${year}
Headline: ${headline}
Summary: ${summary || 'No summary available'}
Title: ${title || headline}
Language: ${language || 'en'}
Wikipedia Article: ${articleUrl || 'Not available'}

INITIAL SUMMARY (for context):
${initialSummary}

CONVERSATION HISTORY:
${conversationText}

CURRENT USER QUESTION:
${lastUserQuestion}

INSTRUCTIONS:
- Use a very casual, friendly tone - like texting a close friend. Be natural and conversational
- Use emojis naturally and appropriately to make responses more friendly and engaging
- Provide a direct, immediate answer without formal introductory phrases
- Keep responses concise (2-4 sentences, maximum 100 words)
- For questions about very recent news, breaking news, or detailed information that requires real-time data, casually suggest they message Chatflix directly (use casual, friendly phrases in the user's language - like "message Chatflix" or similar casual expressions)
- You can provide brief answers based on the context provided, but acknowledge that for the latest developments or comprehensive details, Chatflix would be better
- If the question is unrelated to the historical event or conversation context, casually suggest they message Chatflix directly for more info (use the same casual, friendly tone)
- Only suggest 1-3 follow-up questions if directly related to the current historical event - make them casual and conversational, like questions you'd ask a friend
- Respond in the same language as the conversation history`

      responseJsonSchema = {
        type: 'object',
        properties: {
          answer: {
            type: 'string',
            description: 'A concise answer to the user\'s question formatted as valid Markdown in the user\'s language',
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
      prompt = `You are a helpful friend that summarizes historical events in a casual, friendly way - like explaining to a close friend.

${languageInstruction}

Historical Event Information:
Year: ${year}
Headline: ${headline}
Summary: ${summary || 'No summary available'}
Title: ${title || headline}
Language: ${language || 'en'}
Wikipedia Article: ${articleUrl || 'Not available'}

CRITICAL FORMATTING REQUIREMENT:
The summary field MUST be formatted as valid Markdown. Use Markdown syntax such as:
- Headers: # for main title (focus on explaining what this historical event is about), ## for sections, ### for subsections
- Bold text: **text** for emphasis
- Italic text: *text* for subtle emphasis
- Lists: - or * for bullet points, 1. for numbered lists
- Line breaks: Use double newlines for paragraph separation
- Code: \`code\` for inline code
- Use emojis naturally and appropriately to make the summary more engaging

CRITICAL CONTENT REQUIREMENT:
The main title (# header) MUST focus on explaining what this historical event is about and why it's significant. Start with a clear, concise explanation of what happened on this day in history. Then provide key details about the event, its historical context, and its significance using proper Markdown formatting. Also generate 3 follow-up questions that users might ask about this historical event - make them casual and conversational, like questions you'd ask a friend. Use a friendly, casual tone for the questions.`

      responseJsonSchema = {
        type: 'object',
        properties: {
          summary: {
            type: 'string',
            description: 'A concise summary formatted as valid Markdown in user\'s language',
          },
          questions: {
            type: 'array',
            items: { type: 'string' },
            minItems: 3,
            maxItems: 3,
            description: 'Three follow-up questions users might ask about this historical event',
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
          console.error('[onthisday/summary] streaming error', error)
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
    console.error('[onthisday/summary] error', error)
    return new Response(
      JSON.stringify({ error: 'Failed to generate summary', details: error?.message || 'Unknown error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}

