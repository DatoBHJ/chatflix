/**
 * Utility function for making API calls to AI providers for memory bank updates
 */

/**
 * 폴백 메모리 컨텐츠 생성 (OpenAI API 사용 불가시)
 */
function generateFallbackMemoryContent(systemPrompt: string, userPrompt: string): string {
  const currentDate = new Date().toLocaleDateString();
  
  // 시스템 프롬프트에서 메모리 카테고리 추출 시도
  let category = 'general';
  if (systemPrompt.includes('personal information') || userPrompt.includes('personal')) {
    category = 'personal-info';
  } else if (systemPrompt.includes('preferences')) {
    category = 'preferences';
  } else if (systemPrompt.includes('interests')) {
    category = 'interests';
  } else if (systemPrompt.includes('interaction') || systemPrompt.includes('history')) {
    category = 'interaction-history';
  } else if (systemPrompt.includes('relationship')) {
    category = 'relationship';
  }
  
  return `# ${category.charAt(0).toUpperCase() + category.slice(1)} (Fallback Mode)

⚠️ **Note**: This memory entry was created in fallback mode due to AI service unavailability.

## Last Updated
${currentDate}

## Status
Memory update temporarily unavailable - AI analysis service offline.
Basic structure maintained for future updates.

## Notes
- Full analysis will be performed when AI service is restored
- User activity continues to be tracked
- This placeholder ensures memory structure consistency
`;
}

/**
 * Makes a call to the Google AI API with the given prompts to update user memory
 * 
 * @param model - The model to use (e.g., 'gemini-2.5-flash')
 * @param systemPrompt - The system prompt for context
 * @param userPrompt - The user prompt with the actual query
 * @param maxTokens - Maximum tokens to generate (default: 500)
 * @param temperature - Temperature for generation (default: 0.3)
 * @returns The generated content or null if the request fails
 */
export async function callMemoryBankUpdate(
  model: string, 
  systemPrompt: string, 
  userPrompt: string, 
  maxTokens: number = 500, 
  temperature: number = 0.3
): Promise<string | null> {
  try {
    console.log(`🤖 [MEMORY AI] Calling Google AI API with model: ${model}`);
    
    // Check if API key exists
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      console.error("❌ [MEMORY AI] Missing GOOGLE_GENERATIVE_AI_API_KEY environment variable - memory update skipped");
      
      // 🆕 간단한 폴백 메커니즘 제공
      return generateFallbackMemoryContent(systemPrompt, userPrompt);
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GOOGLE_GENERATIVE_AI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `${systemPrompt}\n\n${userPrompt}`
          }]
        }],
        generationConfig: {
          maxOutputTokens: maxTokens,
          temperature: temperature,
          thinkingConfig: {
            thinking_budget: 0
          }
        }
      })
    });
    
    if (!response.ok) {
      const errorData = await response.text();
      console.error(`❌ [MEMORY AI] API call failed with status ${response.status}: ${errorData}`);
      
      // 🆕 특정 에러 코드에 대한 폴백 제공
      if (response.status === 429 || response.status >= 500) {
        console.log(`🔄 [MEMORY AI] Providing fallback content due to API issues`);
        return generateFallbackMemoryContent(systemPrompt, userPrompt);
      }
      
      return null;
    }
    
    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    if (content) {
      console.log(`✅ [MEMORY AI] Successfully generated memory content (${content.length} chars)`);
    } else {
      console.error(`❌ [MEMORY AI] No content received from Google AI API`);
    }
    
    return content;
  } catch (error) {
    console.error("❌ [MEMORY AI] Error calling memory bank update API:", error);
    return null;
  }
} 
