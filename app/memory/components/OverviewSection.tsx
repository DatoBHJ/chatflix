'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { LightBulb, BubbleChat } from 'react-ios-icons'
import { MemoryBankData, CategoryData, categoryNames, categorySubtitles, displayOrder } from './types'

// Touch handling for mobile swipe
const minSwipeDistance = 50;

interface OverviewSectionProps {
  memoryData: MemoryBankData | null
  isLoading: boolean
  error: string | null
  fetchMemoryBankData: () => void
  userName: string
  selectedCategory: CategoryData | null
  setSelectedCategory: (category: CategoryData | null) => void
  editingCategory: CategoryData | null
  setEditingCategory: (category: CategoryData | null) => void
  editingContent: string
  setEditingContent: (content: string) => void
  isSaving: boolean
  handleSaveEdit: () => void
  handleCancelEdit: () => void
  expandedCard: 'conversation' | 'refinement' | null
  setExpandedCard: (card: 'conversation' | 'refinement' | null) => void
  handleEditCategory: (category: CategoryData) => void
}

export default function OverviewSection({
  memoryData,
  isLoading,
  error,
  fetchMemoryBankData,
  userName,
  selectedCategory,
  setSelectedCategory,
  editingCategory,
  setEditingCategory,
  editingContent,
  setEditingContent,
  isSaving,
  handleSaveEdit,
  handleCancelEdit,
  expandedCard,
  setExpandedCard,
  handleEditCategory
}: OverviewSectionProps) {
  const [currentCardIndex, setCurrentCardIndex] = useState(0)
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchEnd, setTouchEnd] = useState<number | null>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const parseMemoryData = (categories: Array<{category: string, content: string, updated_at: string, last_refined_at: string | null}>): CategoryData[] => {
    console.log('Parsing categories:', { categoriesCount: categories?.length })
    
    if (!categories || categories.length === 0) {
      console.log('No categories to parse')
      return []
    }
    
    // Restrict to allowed categories defined in displayOrder
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

  // Helper function to get timestamp for a category
  const getTimestamp = (category: string) => {
    if (!memoryData?.categories) return null
    const cat = memoryData.categories.find(c => c.category === category)
    return cat?.updated_at || null
  }

  // Touch handling for mobile swipe
  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null)
    setTouchStart(e.targetTouches[0].clientX)
  }

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX)
  }

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return
    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > minSwipeDistance
    const isRightSwipe = distance < -minSwipeDistance
    
    if (isLeftSwipe && currentCardIndex < categories.length - 1) {
      setCurrentCardIndex(prev => prev + 1)
    }
    if (isRightSwipe && currentCardIndex > 0) {
      setCurrentCardIndex(prev => prev - 1)
    }
  }

  // Desktop scroll handling
  const checkScrollButtons = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current
      setCanScrollLeft(scrollLeft > 10)
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10)
    }
  }

  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -400, behavior: 'smooth' })
    }
  }

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 400, behavior: 'smooth' })
    }
  }

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', checkScrollButtons)
      checkScrollButtons()
      return () => scrollContainer.removeEventListener('scroll', checkScrollButtons)
    }
  }, [memoryData])

  // Get category icon
  const getCategoryIcon = (category: string) => {
    const iconProps = { className: "w-24 h-24 text-[#2997FF]" }
    
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

  const categories = memoryData ? parseMemoryData(memoryData.categories) : []
  
  // 🚀 게스트 모드 감지: user_id가 'anonymous'이거나 error가 'Sign in to view'인 경우
  const isGuest = memoryData?.user_id === 'anonymous' || error === 'Sign in to view'

  return (
    <>
      <div className="mt-8 sm:mt-12 md:mt-16 lg:mt-20">
        {userName && userName !== 'You' && (
          <div className="text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight text-[var(--foreground)] mb-8 sm:mb-12">
            {userName}
          </div>
        )}
        <h1 className="text-[clamp(3rem,10vw,4.5rem)] font-semibold tracking-tight leading-none text-[var(--foreground)] mb-12 sm:mb-12">
          You're<span className="sm:hidden"><br /></span> remembered.
        </h1>
        <p className="text-[clamp(1.25rem,5vw,1.5rem)] leading-normal text-[var(--foreground)] max-w-3xl mb-16 sm:mb-20">
          Your Memory Bank captures your personal core, primary interests, and active context across conversations. This keeps responses personalized without overloading the model with unnecessary details.
        </p>
      </div>
      
      <div className="text-base text-[var(--muted)] pl-0">
        {error && error !== 'Sign in to view' ? (
          <div className="text-center py-8">
            <p className="text-[var(--foreground)] mb-4">{error}</p>
            <button
              onClick={fetchMemoryBankData}
              className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
            >
              Try Again
            </button>
          </div>
        ) : (
          <>
            {/* Section Header */}
            <div className="mb-8">
              <div className="text-base font-normal text-[var(--muted)] pl-0">
                {displayOrder.length} {displayOrder.length === 1 ? 'Category' : 'Categories'}
              </div>
            </div>
        
        {/* Card Gallery - Responsive: Mobile single card with peek, Desktop horizontal scroll */}
        <div className="card-gallery relative">
          {/* Guest Mode Overlay - 블러 위에 표시되도록 z-index 높게 설정 */}
          {isGuest && (
            <div className="absolute inset-0 z-50 flex items-center justify-start py-8 pointer-events-none">
              <div className="text-left max-w-md pointer-events-auto pl-4 md:pl-8 lg:pl-12">
                <h2 className="text-3xl font-semibold tracking-tight text-[var(--foreground)] mb-4 md:drop-shadow-lg">
                  Sign in to view your memories.
                </h2>
                <p className="text-sm text-[var(--muted)] mb-4 md:text-[var(--foreground)]/90 md:drop-shadow-md">
                  Your memory categories will appear here.
                </p>
                <a 
                  href="/login"
                  className="text-blue-500 hover:underline cursor-pointer text-sm md:text-blue-500 md:drop-shadow-md"
                >
                  Sign in
                </a>
              </div>
            </div>
          )}
          {/* 카드들만 블러 처리 */}
          <div className={isGuest ? 'filter blur-sm' : ''}>
          {/* Mobile Navigation Arrows */}
          {displayOrder.length > 1 && (
            <>
              {/* Left Arrow - Mobile */}
              <button
                onClick={() => setCurrentCardIndex(prev => (prev - 1 + displayOrder.length) % displayOrder.length)}
                className="sm:hidden absolute left-2 top-1/2 -translate-y-1/2 z-50 w-11 h-11 rounded-full bg-[#E5E5E7]/80 active:bg-[#D1D1D6] dark:bg-[#636366]/80 dark:active:bg-[#787878] backdrop-blur-xl shadow-lg flex items-center justify-center transition-all cursor-pointer disabled:opacity-30"
                disabled={currentCardIndex === 0}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              
              {/* Right Arrow - Mobile */}
              <button
                onClick={() => setCurrentCardIndex(prev => (prev + 1) % displayOrder.length)}
                className="sm:hidden absolute right-2 top-1/2 -translate-y-1/2 z-50 w-11 h-11 rounded-full bg-[#E5E5E7]/80 active:bg-[#D1D1D6] dark:bg-[#636366]/80 dark:active:bg-[#787878] backdrop-blur-xl shadow-lg flex items-center justify-center transition-all cursor-pointer disabled:opacity-30"
                disabled={currentCardIndex === displayOrder.length - 1}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          )}
          
          {/* Mobile: Single Card View with Peek Effect */}
          <div className="sm:hidden overflow-visible">
            <div className="flex items-center justify-center relative" style={{ minHeight: 'calc(100vh - 8rem)' }}>
              {/* All cards in absolute positioning with gap simulation */}
              {displayOrder.map((category, index) => {
                const displayName = categoryNames[category] || category
                const subtitle = categorySubtitles[category] || ''
                const cardWidth = 88 // 100%
                const gapPercent = 19  // 20% gap between cards
                const offset = (index - currentCardIndex) * (cardWidth + gapPercent)
                const isActive = index === currentCardIndex
                const zIndex = isActive ? 10 : 1
                
                return (
                  <div
                    key={category}
                    className="gallery-card absolute transition-all duration-500 ease-out"
                    style={{
                      transform: `translateX(${offset}%)`,
                      zIndex: zIndex,
                      width: '88%',
                      maxWidth: '380px',
                      pointerEvents: isActive ? 'auto' : 'none'
                    }}
                    onTouchStart={isActive ? onTouchStart : undefined}
                    onTouchMove={isActive ? onTouchMove : undefined}
                    onTouchEnd={isActive ? onTouchEnd : undefined}
                  >
                    <div className="bg-accent rounded-3xl p-6 py-16 sm:py-6 h-[calc(100vh-8rem)] flex flex-col shadow-sm transition-shadow relative">
                      {/* Icon */}
                      <div className="w-20 h-20 flex items-center justify-start -ml-2">
                        {getCategoryIcon(category)}
                      </div>
                      
                      {/* Title */}
                      <h3 className="text-4xl font-semibold">
                        <span className="text-[#2997FF]">{displayName.split('.')[0]}.</span>
                        {displayName.includes('.') && <span className="text-[#1D1D1F] dark:text-white"> {displayName.split('.')[1]}</span>}
                      </h3>
                      
                      {/* Description */}
                      <p className="text-4xl font-semibold text-[#6E6E73] dark:text-white mb-auto break-words overflow-wrap-anywhere">
                        {subtitle}
                      </p>
                      
                      {/* Edit Button - Top Right */}
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          // 🚀 게스트 모드: Edit 버튼 비활성화
                          if (isGuest) return;
                          // Find the actual category data for editing
                          const categoryData = memoryData?.categories?.find(c => c.category === category);
                          if (categoryData) {
                            handleEditCategory(categoryData);
                          }
                        }}
                        disabled={isGuest}
                        className={`absolute top-4 right-4 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300 ${isGuest ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                        style={{
                          // 다크모드 전용 스타일
                          ...(document.documentElement.getAttribute('data-theme') === 'dark' || 
                              (document.documentElement.getAttribute('data-theme') === 'system' && 
                               window.matchMedia('(prefers-color-scheme: dark)').matches) ? {
                            // backgroundColor: 'rgba(28, 28, 30, 0.8)',
                            backdropFilter: (window.innerWidth <= 768 || /^((?!chrome|android).)*safari/i.test(navigator.userAgent)) ? 'blur(10px)' : 'url(#glass-distortion-dark) blur(1px)',
                            WebkitBackdropFilter: (window.innerWidth <= 768 || /^((?!chrome|android).)*safari/i.test(navigator.userAgent)) ? 'blur(10px)' : 'url(#glass-distortion-dark) blur(1px)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            // boxShadow: '0 8px 40px rgba(0, 0, 0, 0.3), 0 4px 20px rgba(0, 0, 0, 0.2), 0 2px 8px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                            color: 'white'
                          } : {
                            // backgroundColor: 'rgba(242, 242, 247, 0.8)',
                            backdropFilter: (window.innerWidth <= 768 || /^((?!chrome|android).)*safari/i.test(navigator.userAgent)) ? 'blur(10px)' : 'url(#glass-distortion) blur(1px)',
                            WebkitBackdropFilter: (window.innerWidth <= 768 || /^((?!chrome|android).)*safari/i.test(navigator.userAgent)) ? 'blur(10px)' : 'url(#glass-distortion) blur(1px)',
                            border: '1px solid rgba(0, 0, 0, 0.1)',
                            // boxShadow: '0 8px 40px rgba(0, 0, 0, 0.06), 0 4px 20px rgba(0, 0, 0, 0.04), 0 2px 8px rgba(0, 0, 0, 0.025), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
                            color: 'var(--foreground)'
                          })
                        }}
                        title={isGuest ? "Sign in to edit" : "Edit category"}
                      >
                        Edit
                      </button>
                      
                      {/* Bottom Row: Timestamp and Button */}
                      <div className="flex items-center justify-between">
                        {/* Timestamp Badge */}
                        <div className="text-sm text-[var(--muted)]">
                          {getTimestamp(category) ? (
                            <>Updated {formatRelativeDate(getTimestamp(category)!)}</>
                          ) : (
                            <div className="w-20 h-4 bg-[var(--muted)]/20 rounded animate-pulse"></div>
                          )}
                        </div>
                        
                        {/* Expand Button */}
                        <button 
                          onClick={() => {
                            // Find the actual category data for viewing
                            const categoryData = memoryData?.categories?.find(c => c.category === category);
                            if (categoryData) {
                              setSelectedCategory(categoryData);
                            }
                          }}
                          className="w-10 h-10 rounded-full bg-[#E5E5E7] active:bg-[#D1D1D6] dark:bg-[#636366] dark:active:bg-[#787878] text-[#1D1D1F] dark:text-white flex items-center justify-center transition-colors cursor-pointer"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          
          {/* Page Indicator Dots - Mobile Only */}
          {displayOrder.length > 1 && (
            <div className="sm:hidden flex justify-center gap-2 mt-6">
              {displayOrder.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentCardIndex(index)}
                  className={`h-2 rounded-full transition-all cursor-pointer page-indicator-dot ${
                    index === currentCardIndex 
                      ? 'w-8 bg-[#2997FF]' 
                      : 'w-2 bg-[#D1D1D6] dark:bg-[#636366]'
                  }`}
                />
              ))}
            </div>
          )}
          
          {/* Desktop: Horizontal Scroll Gallery */}
          <div className="hidden sm:block relative">
            {/* Desktop Navigation Arrows */}
            {displayOrder.length > 1 && (
              <>
                {/* Left Arrow - Desktop */}
                <button
                  onClick={scrollLeft}
                  className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-[#E5E5E7]/80 hover:bg-[#D1D1D6] dark:bg-[#636366]/80 dark:hover:bg-[#787878] backdrop-blur-xl shadow-lg flex items-center justify-center transition-all cursor-pointer disabled:opacity-30"
                  disabled={!canScrollLeft}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                
                {/* Right Arrow - Desktop */}
                <button
                  onClick={scrollRight}
                  className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-[#E5E5E7]/80 hover:bg-[#D1D1D6] dark:bg-[#636366]/80 dark:hover:bg-[#787878] backdrop-blur-xl shadow-lg flex items-center justify-center transition-all cursor-pointer disabled:opacity-30"
                  disabled={!canScrollRight}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </>
            )}
            
            <div ref={scrollContainerRef} className="scroll-container overflow-x-auto snap-x snap-mandatory pb-8">
              <div className="flex gap-6">
                {displayOrder.map((category) => {
                  const displayName = categoryNames[category] || category
                  const subtitle = categorySubtitles[category] || ''
                  
                  return (
                    <div key={category} className="gallery-card min-w-[320px] md:min-w-[380px] snap-center">
                      <div className="bg-accent rounded-3xl p-8 md:p-11 h-[460px] md:h-[480px] flex flex-col shadow-sm hover:shadow-md transition-shadow relative">
                        {/* Icon */}
                        <div className="w-24 h-24 md:w-32 md:h-32 flex items-center justify-start -ml-2">
                          {getCategoryIcon(category)}
                        </div>
                        
                        {/* Title */}
                        <h3 className="text-4xl font-semibold">
                          <span className="text-[#2997FF]">{displayName.split('.')[0]}.</span>
                          {displayName.includes('.') && <span className="text-[#1D1D1F] dark:text-white"> {displayName.split('.')[1]}</span>}
                        </h3>
                        
                        {/* Description */}
                        <p className="text-4xl font-semibold text-[#6E6E73] dark:text-white mb-auto break-words overflow-wrap-anywhere">
                          {subtitle}
                        </p>
                        
                        {/* Edit Button - Top Right */}
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            // 🚀 게스트 모드: Edit 버튼 비활성화
                            if (isGuest) return;
                            // Find the actual category data for editing
                            const categoryData = memoryData?.categories?.find(c => c.category === category);
                            if (categoryData) {
                              handleEditCategory(categoryData);
                            }
                          }}
                          disabled={isGuest}
                          className={`absolute top-4 right-4 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300 ${isGuest ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                          style={{
                            // 다크모드 전용 스타일
                            ...(document.documentElement.getAttribute('data-theme') === 'dark' || 
                                (document.documentElement.getAttribute('data-theme') === 'system' && 
                                 window.matchMedia('(prefers-color-scheme: dark)').matches) ? {
                              // backgroundColor: 'rgba(28, 28, 30, 0.8)',
                              backdropFilter: (window.innerWidth <= 768 || /^((?!chrome|android).)*safari/i.test(navigator.userAgent)) ? 'blur(10px)' : 'url(#glass-distortion-dark) blur(1px)',
                              WebkitBackdropFilter: (window.innerWidth <= 768 || /^((?!chrome|android).)*safari/i.test(navigator.userAgent)) ? 'blur(10px)' : 'url(#glass-distortion-dark) blur(1px)',
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              // boxShadow: '0 8px 40px rgba(0, 0, 0, 0.3), 0 4px 20px rgba(0, 0, 0, 0.2), 0 2px 8px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                              color: 'white'
                            } : {
                              // backgroundColor: 'rgba(242, 242, 247, 0.8)',
                              backdropFilter: (window.innerWidth <= 768 || /^((?!chrome|android).)*safari/i.test(navigator.userAgent)) ? 'blur(10px)' : 'url(#glass-distortion) blur(1px)',
                              WebkitBackdropFilter: (window.innerWidth <= 768 || /^((?!chrome|android).)*safari/i.test(navigator.userAgent)) ? 'blur(10px)' : 'url(#glass-distortion) blur(1px)',
                              border: '1px solid rgba(0, 0, 0, 0.1)',
                              // boxShadow: '0 8px 40px rgba(0, 0, 0, 0.06), 0 4px 20px rgba(0, 0, 0, 0.04), 0 2px 8px rgba(0, 0, 0, 0.025), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
                              color: 'var(--foreground)'
                            })
                          }}
                          title={isGuest ? "Sign in to edit" : "Edit category"}
                        >
                          Edit
                        </button>
                        
                        {/* Bottom Row: Timestamp and Button */}
                        <div className="flex items-center justify-between">
                          {/* Timestamp Badge */}
                          <div className="text-sm text-[var(--muted)]">
                            {getTimestamp(category) ? (
                              <>Updated {formatRelativeDate(getTimestamp(category)!)}</>
                            ) : (
                              <div className="w-20 h-4 bg-[var(--muted)]/20 rounded animate-pulse"></div>
                            )}
                          </div>
                          
                          {/* Expand Button */}
                          <button 
                            onClick={() => {
                              // Find the actual category data for viewing
                              const categoryData = memoryData?.categories?.find(c => c.category === category);
                              if (categoryData) {
                                setSelectedCategory(categoryData);
                              }
                            }}
                            className="w-10 h-10 rounded-full bg-[#E5E5E7] hover:bg-[#D1D1D6] dark:bg-[#636366] dark:hover:bg-[#787878] text-[#1D1D1F] dark:text-white flex items-center justify-center transition-colors cursor-pointer"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
          </div>
          {/* 블러 div 닫기 */}
        </div>

          </>
        )}
      </div>
      
      {/* Memory Update Explanation Section */}
      <div className="mt-16 sm:mt-32 md:mt-40 lg:mt-48">
        <h1 className="text-[clamp(3rem,10vw,4.5rem)] font-semibold tracking-tight leading-none text-[var(--foreground)] mb-12 sm:mb-12">
          Updates<span className="sm:hidden"><br /></span> automatically.
        </h1>
        <p className="text-[clamp(1.25rem,5vw,1.5rem)] leading-normal text-[var(--foreground)] max-w-3xl mb-16 sm:mb-20">
          Your Memory Bank updates through two distinct processes: real-time updates during conversations and scheduled daily refinement to maintain quality.
        </p>
        
        {/* Card Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-6xl">
          {/* Card 1: Conversation-Based Updates */}
          <div 
            className="relative rounded-3xl bg-[#1C1C1E] dark:bg-[#1C1C1E] p-8 sm:p-10 overflow-hidden group cursor-pointer hover:scale-[1.02] transition-transform duration-300"
            onClick={() => setExpandedCard('conversation')}
          >
            {/* Gradient Background Effect */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-blue-500/20 via-purple-500/20 to-transparent blur-3xl" />
            </div>
            
            {/* Content */}
            <div className="relative z-10">
              <h3 className="text-3xl sm:text-4xl font-semibold mb-4 text-white">
                Conversation-Based Updates
              </h3>
              <p className="text-lg text-[#86868B] leading-relaxed">
                As you send messages, the system automatically analyzes conversations to capture personal core updates, primary interests, and active context changes.
              </p>
            </div>
            
            {/* Expand Button */}
            <button 
              className="absolute bottom-6 right-6 w-12 h-12 rounded-full bg-[#3A3A3C] hover:bg-[#48484A] flex items-center justify-center transition-colors cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                setExpandedCard('conversation');
              }}
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
          
          {/* Card 2: Daily Refinement */}
          <div 
            className="relative rounded-3xl bg-[#1C1C1E] dark:bg-[#1C1C1E] p-8 sm:p-10 overflow-hidden group cursor-pointer hover:scale-[1.02] transition-transform duration-300"
            onClick={() => setExpandedCard('refinement')}
          >
            {/* Gradient Background Effect */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="absolute bottom-0 right-0 w-64 h-64 bg-gradient-to-tl from-orange-500/20 via-pink-500/20 to-transparent blur-3xl" />
            </div>
            
            {/* Content */}
            <div className="relative z-10">
              <h3 className="text-3xl sm:text-4xl font-semibold mb-4 text-white">
                Daily Refinement
              </h3>
              <p className="text-lg text-[#86868B] leading-relaxed">
                The system automatically reviews and refines your Memory Bank based on your activity level to maintain quality.
              </p>
            </div>
            
            {/* Expand Button */}
            <button 
              className="absolute bottom-6 right-6 w-12 h-12 rounded-full bg-[#3A3A3C] hover:bg-[#48484A] flex items-center justify-center transition-colors cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                setExpandedCard('refinement');
              }}
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        </div>
      </div>
      
      {/* Control Navigation Section */}
      <div className="mt-16 sm:mt-32 md:mt-40 lg:mt-48">
        <h1 className="text-[clamp(3rem,10vw,4.5rem)] font-semibold tracking-tight leading-none text-[var(--foreground)] mb-12 sm:mb-12">
          Control<span className="sm:hidden"><br /></span> what's remembered.
        </h1>
        <p className="text-[clamp(1.25rem,5vw,1.5rem)] leading-normal text-[var(--foreground)] max-w-3xl mb-16 sm:mb-20">
          Take full control of your Memory Bank with two powerful methods: explicitly tell Chatflix what to remember during conversations, or directly edit any memory category whenever you want.
        </p>
        
        {/* Clickable Card */}
        <div 
          className="relative rounded-3xl bg-[#1C1C1E] dark:bg-[#1C1C1E] p-8 sm:p-10 overflow-hidden group cursor-pointer hover:scale-[1.02] transition-transform duration-300 max-w-2xl"
          onClick={() => router.push('/memory/control')}
        >
          {/* Gradient Background Effect */}
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-blue-500/20 via-purple-500/20 to-transparent blur-3xl" />
          </div>
          
          {/* Content */}
          <div className="relative z-10">
            <h3 className="text-3xl sm:text-4xl font-semibold mb-4 text-white">
              Learn How to Control Your Memories
            </h3>
            <p className="text-lg text-[#86868B] leading-relaxed">
              Discover how you can manage and edit your Memory Bank through direct input and manual editing.
            </p>
          </div>
          
          {/* Arrow Icon */}
          <div className="absolute bottom-6 right-6 w-12 h-12 rounded-full bg-[#3A3A3C] group-hover:bg-[#48484A] flex items-center justify-center transition-colors">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </div>
      
      {/* Contact Footer */}
      <div className="mt-28 mb-8 text-center">
        <p className="text-sm text-[var(--muted)]">
          If you have any questions,<br className="sm:hidden" /> contact us at <a href="mailto:sply@chatflix.app" className="hover:text-[var(--foreground)] transition-colors">sply@chatflix.app</a>
        </p>
      </div>
    </>
  )
}
