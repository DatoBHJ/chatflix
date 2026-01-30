/**
 * Utilities for copying and pasting prompts with embedded images
 */

/**
 * Copy prompt text with embedded images to clipboard using both text and HTML formats.
 * The HTML format includes <img> tags with data attributes that can be detected when pasting.
 * 
 * @param promptText - The text content with [image N] placeholders
 * @param images - Array of image data with order, url, and optional path/bucketName
 */
export async function copyPromptWithImages(
  promptText: string,
  images: Array<{ order: number; url: string; path?: string; bucketName?: string }>
): Promise<void> {
  // Create plain text version (keeps [image N] tags)
  const plainText = promptText

  // Create HTML version with actual images
  let htmlContent = promptText
  
  // Sort images by order for consistent replacement
  const sortedImages = [...images].sort((a, b) => a.order - b.order)
  
  for (const img of sortedImages) {
    const tag = `[image ${img.order}]`
    const imgHtml = `<img src="${img.url}" data-pensieve-image="true" data-image-order="${img.order}" ${img.path ? `data-image-path="${img.path}"` : ''} ${img.bucketName ? `data-bucket-name="${img.bucketName}"` : ''} style="max-width: 300px; max-height: 200px; display: block; margin: 8px 0;" />`
    htmlContent = htmlContent.replace(tag, imgHtml)
  }
  
  // Wrap in HTML structure
  const fullHtml = `<div data-pensieve-prompt="true">${htmlContent}</div>`

  try {
    // Use Clipboard API to write both formats
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/plain': new Blob([plainText], { type: 'text/plain' }),
        'text/html': new Blob([fullHtml], { type: 'text/html' })
      })
    ])
  } catch (err) {
    // Fallback to plain text only
    console.warn('Rich clipboard not supported, falling back to plain text:', err)
    await navigator.clipboard.writeText(plainText)
  }
}

/**
 * Parse pasted HTML content to extract images and text.
 * Returns the text with [image N] placeholders and an array of image data to be inserted.
 * 
 * @param html - The HTML string from clipboard
 * @returns Object with parsed text and images array, or null if not a pensieve prompt
 */
export function parsePastedPromptHtml(html: string): { 
  text: string; 
  images: Array<{ order: number; url: string; path?: string; bucketName?: string }> 
} | null {
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    
    // Check if it's a pensieve prompt (has the marker attribute or contains pensieve images)
    const pensieveContainer = doc.querySelector('[data-pensieve-prompt]')
    const pensieveImages = doc.querySelectorAll('img[data-pensieve-image]')
    
    if (!pensieveContainer && pensieveImages.length === 0) {
      return null
    }
    
    const container = pensieveContainer || doc.body
    const images: Array<{ order: number; url: string; path?: string; bucketName?: string }> = []
    
    // Extract images and their metadata
    const imgElements = container.querySelectorAll('img[data-pensieve-image]')
    imgElements.forEach((img) => {
      const order = parseInt(img.getAttribute('data-image-order') || '1', 10)
      const url = img.getAttribute('src') || ''
      const path = img.getAttribute('data-image-path') || undefined
      const bucketName = img.getAttribute('data-bucket-name') || undefined
      
      if (url) {
        images.push({ order, url, path, bucketName })
        // Replace img with placeholder for text extraction
        const placeholder = doc.createTextNode(`[image ${order}]`)
        img.parentNode?.replaceChild(placeholder, img)
      }
    })
    
    // Get the text content
    const text = container.textContent?.trim() || ''
    
    return { text, images }
  } catch (err) {
    console.error('Error parsing pasted HTML:', err)
    return null
  }
}

/**
 * Fetch an image URL and convert it to a File object for insertion into contentEditable
 * 
 * @param url - The image URL to fetch
 * @param filename - Optional filename for the resulting File
 * @returns File object or null if fetch fails
 */
export async function fetchImageAsFile(url: string, filename?: string): Promise<File | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) throw new Error('Failed to fetch image')
    
    const blob = await response.blob()
    const name = filename || `image-${Date.now()}.${blob.type.split('/')[1] || 'png'}`
    
    return new File([blob], name, { type: blob.type })
  } catch (err) {
    console.error('Error fetching image as file:', err)
    return null
  }
}

/**
 * Check if clipboard HTML contains pensieve images
 */
export function hasPensieveImages(html: string): boolean {
  return html.includes('data-pensieve-image') || html.includes('data-pensieve-prompt')
}

