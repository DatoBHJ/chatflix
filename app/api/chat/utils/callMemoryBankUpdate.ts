/**
 * Utility function for making API calls to AI providers for memory bank updates
 */

/**
 * Makes a call to the OpenAI API with the given prompts to update user memory
 * 
 * @param model - The model to use (e.g., 'gpt-4.1-nano')
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
    // Check if API key exists
    if (!process.env.OPENAI_API_KEY) {
      console.error("Missing OPENAI_API_KEY environment variable");
      return null;
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
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
    
    if (!response.ok) {
      const errorData = await response.text();
      console.error(`API call failed with status ${response.status}: ${errorData}`);
      return null;
    }
    
    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  } catch (error) {
    console.error("Error calling memory bank update API:", error);
    return null;
  }
} 
