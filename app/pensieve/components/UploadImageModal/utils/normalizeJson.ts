/**
 * Normalize JSON prompt text by cleaning whitespace and invisible characters.
 * This ensures JSON pasted from various sources can be properly parsed.
 * 
 * @param text - The text to normalize
 * @returns The normalized text - cleaned JSON if valid, otherwise original text with normalized whitespace
 */
export function normalizeJsonPrompt(text: string): string {
  if (!text || typeof text !== 'string') return text
  
  // First, normalize various invisible/special characters
  let normalized = text
    // Replace non-breaking spaces with regular spaces
    .replace(/\u00A0/g, ' ')
    // Replace various Unicode whitespace characters
    .replace(/[\u2000-\u200B\u2028\u2029\u202F\u205F\u3000]/g, ' ')
    // Remove zero-width characters
    .replace(/[\u200C\u200D\uFEFF]/g, '')
    // Normalize line breaks
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
  
  const trimmed = normalized.trim()
  
  // Check if it looks like JSON (starts and ends with {} or [])
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || 
      (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      // Parse and re-stringify to get clean, properly formatted JSON
      const parsed = JSON.parse(trimmed)
      // Use compact formatting (no extra whitespace)
      return JSON.stringify(parsed)
    } catch {
      // If parsing fails, try some additional cleanup and retry
      try {
        // Replace multiple spaces/whitespace with single space
        const extraCleaned = trimmed
          .replace(/\s+/g, ' ')
          .replace(/,\s+/g, ', ')
          .replace(/:\s+/g, ': ')
          .replace(/{\s+/g, '{')
          .replace(/\s+}/g, '}')
          .replace(/\[\s+/g, '[')
          .replace(/\s+]/g, ']')
        
        const parsed = JSON.parse(extraCleaned)
        return JSON.stringify(parsed)
      } catch {
        // If still fails, return the normalized text as-is
        return normalized
      }
    }
  }
  
  return normalized
}

