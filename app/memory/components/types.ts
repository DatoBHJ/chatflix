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
  '02-interests': 'Interests',
  '03-interaction-history': 'Interaction History',
  '04-relationship': 'Tone & Approach'
}

// Category subtitles
export const categorySubtitles: Record<string, string> = {
  '00-personal-info': 'Basic details and professional context',
  '01-preferences': 'Communication style and content preferences',
  '02-interests': 'Primary interests and recent topics',
  '03-interaction-history': 'Recent conversations and patterns',
  '04-relationship': 'Tone, formality, and how Chatflix adapts your experience'
}

// Display order for cards
export const displayOrder = [
  '00-personal-info',
  '02-interests',
  '01-preferences',
  '03-interaction-history',
  '04-relationship'
]
