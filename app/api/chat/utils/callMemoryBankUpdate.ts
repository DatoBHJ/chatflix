/**
 * Utility function for making API calls to AI providers
 */

/**
 * Makes a call to the X.AI API with the given prompts
 * 
 * @param model - The model to use (e.g., 'grok-2-latest')
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
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.XAI_API_KEY}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: maxTokens,
        temperature: temperature
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.choices?.[0]?.message?.content || '';
    }
    
    return null;
  } catch (error) {
    console.error("[DEBUG-API] Error calling AI API:", error);
    return null;
  }
} 
