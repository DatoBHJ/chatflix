'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { MarkdownContent } from '../components/MarkdownContent'
import { fetchUserName } from '../components/AccountDialog'
import { createClient } from '@/utils/supabase/client'

interface MemoryBankData {
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

interface CategoryData {
  category: string
  content: string
  updated_at: string
  last_refined_at: string | null
}

export default function MemoryBankPage() {
  const [memoryData, setMemoryData] = useState<MemoryBankData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [userName, setUserName] = useState<string>('')
  const router = useRouter()

  // Category display names
  const categoryNames: Record<string, string> = {
    '00-personal-info': 'Personal Information',
    '01-preferences': 'Your Preferences', 
    '02-interests': 'Your Interests',
    '03-interaction-history': 'Interaction History',
    '04-relationship': 'Relationship Development'
  }

  // Category subtitles
  const categorySubtitles: Record<string, string> = {
    '00-personal-info': 'Basic details and professional context',
    '01-preferences': 'Communication style and content preferences',
    '02-interests': 'Primary interests and recent topics',
    '03-interaction-history': 'Recent conversations and patterns',
    '04-relationship': 'Trust level and personalization strategy'
  }

  useEffect(() => {
    fetchMemoryBankData()
    fetchUserNameData()
  }, [])

  const fetchUserNameData = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        const name = await fetchUserName(user.id, supabase)
        setUserName(name)
      }
    } catch (error) {
      console.error('Error fetching user name:', error)
    }
  }

  const fetchMemoryBankData = async () => {
    try {
      setIsLoading(true)
      setError(null)

      console.log('Fetching memory bank data...')
      const response = await fetch('/api/memory-bank')
      const data = await response.json()

      console.log('Memory bank API response:', { 
        status: response.status, 
        ok: response.ok, 
        data: data 
      })

      if (!response.ok) {
        if (response.status === 401) {
          console.log('Not authenticated, redirecting to login')
          // Redirect to login if not authenticated
          router.push('/login')
          return
        }
        throw new Error(data.error || 'Failed to fetch memory bank data')
      }

      setMemoryData(data)
      
      // All categories start collapsed (no auto-expand)
    } catch (error) {
      console.error('Error fetching memory bank data:', error)
      setError(error instanceof Error ? error.message : 'Failed to fetch memory bank data')
    } finally {
      setIsLoading(false)
    }
  }

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev)
      if (newSet.has(category)) {
        newSet.delete(category)
      } else {
        newSet.add(category)
      }
      return newSet
    })
  }

  const parseMemoryData = (categories: Array<{category: string, content: string, updated_at: string, last_refined_at: string | null}>): CategoryData[] => {
    console.log('Parsing categories:', { categoriesCount: categories?.length })
    
    if (!categories || categories.length === 0) {
      console.log('No categories to parse')
      return []
    }
    
    // Directly use the categories data from API
    const parsedCategories: CategoryData[] = categories.map(categoryMeta => ({
      category: categoryMeta.category,
      content: categoryMeta.content,
      updated_at: categoryMeta.updated_at,
      last_refined_at: categoryMeta.last_refined_at
    }))
    
    console.log('Parsed categories:', parsedCategories.length)
    return parsedCategories
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  // Format relative date
  const formatRelativeDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)
    
    if (diffMins < 60) return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`
    if (diffDays < 30) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`
    return date.toLocaleDateString()
  }

  const categories = memoryData ? parseMemoryData(memoryData.categories) : []

  // Check if all categories are expanded
  const allExpanded = expandedCategories.size === categories.length

  // Toggle all categories
  const handleExpandCollapseAll = () => {
    if (allExpanded) {
      setExpandedCategories(new Set())
    } else {
      setExpandedCategories(new Set(categories.map(c => c.category)))
    }
  }

  return (
    <div className="min-h-screen text-[var(--foreground)]" style={{ backgroundColor: 'var(--background)' }}>
      <div className="px-20 sm:px-32 md:px-40 lg:px-48 pt-20 sm:pt-24 md:pt-28 pb-8">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl sm:text-3xl md:text-4xl font-semibold tracking-tight">
            {userName ? `Hi, ${userName}` : 'Hi'}
          </h2>
          
          {/* Hero Section */}
          <div className="mt-16 sm:mt-20">
            <h1 className="text-5xl sm:text-6xl md:text-7xl font-semibold tracking-tight text-[var(--foreground)] mb-8 sm:mb-12">
              Control is yours.
            </h1>
            <p className="text-xl sm:text-2xl text-[var(--foreground)] max-w-3xl mb-16 sm:mb-24">
              Your Memory Bank stores what matters most from your conversations. As you chat, Chatflix learns your preferences, interests, and communication style. This helps provide more personalized and contextual responses every time you interact.
            </p>
          </div>
          
          <div className="text-base text-[var(--muted)] pl-0">
            {isLoading ? (
              <div className="flex justify-center items-center h-64">
                <div className="w-8 h-8 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : error ? (
              <div className="text-center py-8">
                <p className="text-[var(--foreground)] mb-4">{error}</p>
                <button
                  onClick={fetchMemoryBankData}
                  className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
                >
                  Try Again
                </button>
              </div>
            ) : !memoryData || categories.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-[var(--foreground)]">Your memory bank is empty. Start chatting to build your profile!</p>
              </div>
            ) : (
              <>
                {/* Section Header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="text-base font-normal text-[var(--muted)] pl-0">
                    {categories.length} {categories.length === 1 ? 'Category' : 'Categories'}
                  </div>
                  <button
                    onClick={handleExpandCollapseAll}
                    className="text-base font-normal text-[var(--muted)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
                  >
                    {allExpanded ? 'Collapse all' : 'Expand all'}
                  </button>
                </div>
                
                <div>
                  {categories.map((category) => {
                    const isExpanded = expandedCategories.has(category.category)
                    const displayName = categoryNames[category.category] || category.category
                    const subtitle = categorySubtitles[category.category] || ''
                    
                    return (
                      <div key={category.category}>
                        <button
                          onClick={() => toggleCategory(category.category)}
                          className="w-full text-left py-4 group cursor-pointer"
                        >
                          <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <span className="text-lg font-semibold text-[var(--foreground)]">
                                  {displayName}
                                </span>
                              <div className="flex items-center gap-2 mt-0.5">
                                <p className="text-xs text-[var(--muted)] font-light">
                                  {subtitle}
                                </p>
                                <span className="text-xs text-[var(--muted)] font-light">
                                  • Updated {formatRelativeDate(category.updated_at)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </button>
                        
                        {/* Expanded Content */}
                        <div className={`transition-all duration-500 ease-out ${
                          isExpanded ? 'max-h-none opacity-100' : 'max-h-0 opacity-0 overflow-hidden'
                        }`}>
                          <div className="pb-6 pt-10">
                            <div className="mb-6 pl-2">
                              <div className="text-[var(--foreground)] -ml-2">
                                <MarkdownContent 
                                  content={category.content} 
                                  enableSegmentation={true}
                                  messageType="assistant"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
