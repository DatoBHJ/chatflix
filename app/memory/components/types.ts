export interface MemoryBankData {
  user_id: string
  categories: Array<{
    category: string
    content: string
    updated_at: string
    last_refined_at: string | null
  }>
  last_updated: string | null
  timestamp: string
}

export interface CategoryData {
  category: string
  content: string
  updated_at: string
  last_refined_at: string | null
}

// Category display names
export const categoryNames: Record<string, string> = {
  '00-personal-info': 'About You',
  '01-preferences': 'Preferences', 
  '02-interests': 'Interests'
}

// Category subtitles
export const categorySubtitles: Record<string, string> = {
  '00-personal-info': 'Basic details and professional context',
  '01-preferences': 'Communication style and response format',
  '02-interests': 'Primary interests and recent topics'
}

// Display order for cards
export const displayOrder = [
  '00-personal-info',
  '02-interests',
  '01-preferences'
]
