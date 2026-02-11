'use client'

import { useState, useEffect } from 'react'
import { MemoryBankData, CategoryData, categoryNames, categorySubtitles, displayOrder } from './types'
import { LightBulb, BubbleChat } from 'react-ios-icons'
import MemoryModals from './MemoryModals'

interface MemoryCardsSectionProps {
  user: any
}

export default function MemoryCardsSection({ user }: MemoryCardsSectionProps) {
  const [memoryData, setMemoryData] = useState<MemoryBankData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<CategoryData | null>(null)
  const [editingCategory, setEditingCategory] = useState<CategoryData | null>(null)
  const [editingContent, setEditingContent] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    fetchMemoryBankData()
  }, [])

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
          console.log('Not authenticated, showing guest mode')
          // 🚀 게스트 모드 지원: 로그인 리다이렉트 대신 빈 데이터로 표시
          setMemoryData({
            user_id: 'anonymous',
            categories: [],
            last_updated: null,
            timestamp: new Date().toISOString()
          })
          setError('Sign in to view')
          return
        }
        throw new Error(data.error || 'Failed to fetch memory bank data')
      }

      setMemoryData(data)
    } catch (error) {
      console.error('Error fetching memory bank data:', error)
      setError(error instanceof Error ? error.message : 'Failed to fetch memory bank data')
    } finally {
      setIsLoading(false)
    }
  }

  const parseMemoryData = (categories: Array<{category: string, content: string, updated_at: string, last_refined_at: string | null}>): CategoryData[] => {
    console.log('Parsing categories:', { categoriesCount: categories?.length })
    
    if (!categories || categories.length === 0) {
      console.log('No categories to parse')
      return []
    }
    
    // Only keep allowed categories (based on display order)
    const filteredCategories = categories.filter(categoryMeta => displayOrder.includes(categoryMeta.category))
    
    if (filteredCategories.length === 0) {
      return []
    }
    
    const parsedCategories: CategoryData[] = filteredCategories.map(categoryMeta => ({
      category: categoryMeta.category,
      content: categoryMeta.content,
      updated_at: categoryMeta.updated_at,
      last_refined_at: categoryMeta.last_refined_at
    }))
    
    // Sort using the component-level displayOrder
    parsedCategories.sort((a, b) => {
      const indexA = displayOrder.indexOf(a.category)
      const indexB = displayOrder.indexOf(b.category)
      return indexA - indexB
    })
    
    console.log('Parsed categories:', parsedCategories.length)
    return parsedCategories
  }

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

  // Get category icon
  const getCategoryIcon = (category: string) => {
    const iconProps = { className: "w-20 h-20 text-[#2997FF]" }
    
    switch (category) {
      case '00-personal-core':
        return (
          <svg {...iconProps} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        )
      case '01-interest-core':
        return (
          <LightBulb {...iconProps} />
        )
      case '02-active-context':
        return (
          <BubbleChat {...iconProps} />
        )
      default:
        return (
          <svg {...iconProps} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        )
    }
  }

  // Edit category handlers
  const handleEditCategory = (category: CategoryData) => {
    setEditingCategory(category)
    setEditingContent(category.content)
  }

  const handleSaveEdit = async () => {
    if (!editingCategory || !editingContent.trim()) return

    setIsSaving(true)
    try {
      const response = await fetch('/api/memory-bank', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: editingCategory.category,
          content: editingContent.trim()
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update category')
      }

      const result = await response.json()
      
      // Update local state immediately
      setMemoryData(prevData => {
        if (!prevData) return prevData
        
        const updatedCategories = prevData.categories.map(cat => 
          cat.category === editingCategory.category 
            ? { ...cat, content: editingContent.trim(), updated_at: result.category.updated_at }
            : cat
        )
        
        return {
          ...prevData,
          categories: updatedCategories
        }
      })

      // 🚀 최적화: localStorage 캐시 무효화 및 갱신
      if (user?.id) {
        try {
          const { invalidateMemoryCache, loadMemoryWithCache } = await import('@/app/utils/memory-cache-client');
          invalidateMemoryCache(user.id, [editingCategory.category]);
          await loadMemoryWithCache(user.id); // 캐시 갱신
          console.log('🔄 [MEMORY] Client cache refreshed after manual update');
        } catch (error) {
          console.warn('Failed to refresh memory cache:', error);
        }
      }

      setEditingCategory(null)
      setEditingContent('')
    } catch (error) {
      console.error('Error saving category:', error)
      alert('Failed to save changes. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancelEdit = () => {
    setEditingCategory(null)
    setEditingContent('')
  }

  const categories = memoryData ? parseMemoryData(memoryData.categories) : []
  
  // 🚀 게스트 모드 감지: user가 게스트이거나 memoryData.user_id가 'anonymous'인 경우
  const isGuest = user?.isAnonymous || user?.id === 'anonymous' || memoryData?.user_id === 'anonymous' || error === 'Sign in to view'

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-6 h-6 border-2 border-[var(--muted)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error && error !== 'Sign in to view') {
    return (
      <div className="text-center py-8">
        <p className="text-[var(--foreground)] mb-4">{error}</p>
        <button
          onClick={fetchMemoryBankData}
          className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
        >
          Try Again
        </button>
      </div>
    )
  }

  // 🚀 게스트 모드: 카드가 없어도 displayOrder를 사용해서 카드 형태 표시
  const cardsToDisplay = isGuest && categories.length === 0 ? displayOrder.map(cat => ({
    category: cat,
    content: '',
    updated_at: new Date().toISOString(),
    last_refined_at: null
  })) : categories

  return (
    <>
      <div className="mt-8 sm:mt-12 md:mt-16 lg:mt-20">
        {cardsToDisplay.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-[var(--muted)]">
              No memory categories yet. Start chatting to build your memory bank!
            </div>
          </div>
        ) : (
          <div className="relative">
            {/* Guest Mode Overlay - 블러 위에 표시되도록 z-index 높게 설정 */}
            {isGuest && (
              <div className="absolute inset-0 z-50 flex items-start md:items-center justify-start py-8 pointer-events-none">
                <div className="text-left max-w-md pointer-events-auto pl-4 md:pl-8 lg:pl-12">
                  <h2 className="text-3xl font-semibold tracking-tight text-[var(--foreground)] mb-4">
                    Sign in to view your memories.
                  </h2>
                  <p className="text-sm text-[var(--muted)] mb-4">
                    Your memory categories will appear here.
                  </p>
                  <a 
                    href="/login"
                    className="text-blue-500 hover:underline cursor-pointer text-sm"
                  >
                    Sign in
                  </a>
                </div>
              </div>
            )}
            {/* 카드들만 블러 처리 */}
            <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${isGuest ? 'filter blur-sm' : ''}`}>
            {cardsToDisplay.map((category) => {
              const displayName = categoryNames[category.category] || category.category
              const subtitle = categorySubtitles[category.category] || ''
              
              return (
                <div
                  key={category.category}
                  className="bg-accent rounded-3xl p-8 md:p-11 h-[380px] md:h-[420px] flex flex-col shadow-sm hover:shadow-md transition-shadow relative"
                >
                  {/* Icon */}
                  <div className="w-20 h-20 md:w-24 md:h-24 flex items-center justify-start -ml-2">
                    {getCategoryIcon(category.category)}
                  </div>
                  
                  {/* Title */}
                  <h3 className="text-2xl md:text-3xl font-semibold">
                    <span className="text-[#2997FF]">{displayName.split('.')[0]}.</span>
                    {displayName.includes('.') && <span className="text-[#1D1D1F] dark:text-white"> {displayName.split('.')[1]}</span>}
                  </h3>
                  
                  {/* Description */}
                  <p className="text-xl md:text-2xl font-semibold text-[#6E6E73] dark:text-white mb-auto break-words overflow-wrap-anywhere">
                    {subtitle}
                  </p>
                  
                  {/* Edit Button - Top Right */}
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      // 🚀 게스트 모드: Edit 버튼 비활성화
                      if (isGuest) return;
                      handleEditCategory(category);
                    }}
                    disabled={isGuest}
                    className={`absolute top-4 right-4 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300 ${isGuest ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                    style={{
                      // 다크모드 전용 스타일
                      ...(document.documentElement.getAttribute('data-theme') === 'dark' || 
                          (document.documentElement.getAttribute('data-theme') === 'system' && 
                           window.matchMedia('(prefers-color-scheme: dark)').matches) ? {
                        backdropFilter: (window.innerWidth <= 768 || /^((?!chrome|android).)*safari/i.test(navigator.userAgent)) ? 'blur(10px)' : 'url(#glass-distortion-dark) blur(1px)',
                        WebkitBackdropFilter: (window.innerWidth <= 768 || /^((?!chrome|android).)*safari/i.test(navigator.userAgent)) ? 'blur(10px)' : 'url(#glass-distortion-dark) blur(1px)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        color: 'white'
                      } : {
                        backdropFilter: (window.innerWidth <= 768 || /^((?!chrome|android).)*safari/i.test(navigator.userAgent)) ? 'blur(10px)' : 'url(#glass-distortion) blur(1px)',
                        WebkitBackdropFilter: (window.innerWidth <= 768 || /^((?!chrome|android).)*safari/i.test(navigator.userAgent)) ? 'blur(10px)' : 'url(#glass-distortion) blur(1px)',
                        border: '1px solid rgba(0, 0, 0, 0.1)',
                        color: 'var(--foreground)'
                      })
                    }}
                    title={isGuest ? "Sign in to edit" : "Edit category"}
                  >
                    Edit
                  </button>
                  
                  {/* Bottom Row: Timestamp and + Button */}
                  <div className="flex items-center justify-between">
                    {/* Timestamp */}
                    <div className="text-sm text-[var(--muted)]">
                      Updated {formatRelativeDate(category.updated_at)}
                    </div>
                    
                    {/* + Button */}
                    <button 
                      onClick={() => setSelectedCategory(category)}
                      className="w-10 h-10 rounded-full bg-[#E5E5E7] hover:bg-[#D1D1D6] dark:bg-[#636366] dark:hover:bg-[#787878] text-[#1D1D1F] dark:text-white flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    </button>
                  </div>
                </div>
              )
            })}
            </div>
            {/* 블러 div 닫기 */}
          </div>
        )}
      </div>

      {/* Modals */}
      <MemoryModals
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        editingCategory={editingCategory}
        setEditingCategory={setEditingCategory}
        editingContent={editingContent}
        setEditingContent={setEditingContent}
        isSaving={isSaving}
        handleSaveEdit={handleSaveEdit}
        handleCancelEdit={handleCancelEdit}
        expandedCard={null}
        setExpandedCard={() => {}}
      />
    </>
  )
}
