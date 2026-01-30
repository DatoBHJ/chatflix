import { ImageMetadata } from '../components/ImageCard'

/**
 * Generate a unique slug for an image
 * All images now use UUID (either from Supabase or JSON metadata)
 */
export function generateImageSlugSync(image: ImageMetadata): string {
  if (!image.id) {
    console.warn('Image missing id field:', image.path || image.filename)
    throw new Error('Image must have an id field')
  }
  // All images use UUID directly
  return image.id
}

/**
 * Parse a slug - all slugs are now UUIDs
 * Returns the UUID value for lookup
 */
export function parseImageSlug(slug: string): { type: 'id'; value: string } {
  // UUID format: 8-4-4-4-12 hex characters with dashes
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  
  if (!uuidRegex.test(slug)) {
    throw new Error(`Invalid UUID format: ${slug}`)
  }
  
  return { type: 'id', value: slug }
}
