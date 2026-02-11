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
  '00-personal-core': 'Personal Core',
  '01-interest-core': 'Interest Core',
  '02-active-context': 'Active Context'
}

// Category subtitles
export const categorySubtitles: Record<string, string> = {
  '00-personal-core': 'High-level profile and stable user traits',
  '01-interest-core': 'Primary interests only (durable taxonomy)',
  '02-active-context': 'Current focus and short-term learning snapshot'
}

// Display order for cards
export const displayOrder = [
  '00-personal-core',
  '01-interest-core',
  '02-active-context'
]
