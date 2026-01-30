'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Aperture } from 'lucide-react'
import { Loop } from 'react-ios-icons' //search icon임. 이름만 loop 
import { getAdaptiveGlassStyleBlur, getAdaptiveGlassStyleClean, getInitialTheme } from '@/app/lib/adaptiveGlassStyle'
import UploadImageModal from './UploadImageModal'
import { usePensieve } from '../context/PensieveContext'
import { usePensieveSelection } from '../context/PensieveSelectionContext'

const slideDownAnimation = `
  @keyframes slideDown {
    from {
      transform: scaleY(0);
      transform-origin: top;
    }
    to {
      transform: scaleY(1);
      transform-origin: top;
    }
  }
  @keyframes slideUp {
    from {
      transform: scaleY(1);
      transform-origin: top;
    }
    to {
      transform: scaleY(0);
      transform-origin: top;
    }
  }
`

interface PensieveHeaderWithTabsProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  user?: any
  onUploadComplete?: (metadata: any) => void
  activeSection?: 'all' | 'saved'
}

export default function PensieveHeaderWithTabs({
  searchQuery,
  onSearchChange,
  user,
  onUploadComplete,
  activeSection: propActiveSection
}: PensieveHeaderWithTabsProps) {
  const router = useRouter()
  const pathname = usePathname()
  
  // PensieveContext에서 모달 상태 및 activeSection 가져오기
  const { isUploadModalOpen, setIsUploadModalOpen, activeSection: contextActiveSection, setActiveSection } = usePensieve()
  
  // Selection mode state
  const { isSelectionMode, setIsSelectionMode } = usePensieveSelection()
  
  // context의 activeSection 우선 사용, 없으면 prop, 없으면 pathname 기반
  const activeSection = contextActiveSection || propActiveSection || (pathname?.includes('/pensieve/saved') ? 'saved' : 'all')
  
  // Only show select button on saved page or strands page
  const showSelectButton = (activeSection === 'saved' || activeSection === 'all') && (pathname?.includes('/pensieve/saved') || pathname?.endsWith('/pensieve') || pathname?.endsWith('/pensieve/'))
  
  // Adaptive glass style
  const isDark = getInitialTheme()
  const glassStyle = getAdaptiveGlassStyleClean(isDark)
  const { boxShadow, border, ...styleWithoutBorderAndShadow } = glassStyle
  const { boxShadow: _, backgroundColor: _bg, ...headerGlassStyle } = getAdaptiveGlassStyleBlur()
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isSearchClosing, setIsSearchClosing] = useState(false)
  const [shouldShowHeaderBackground, setShouldShowHeaderBackground] = useState(false)
  const [showSearchContent, setShowSearchContent] = useState(false)
  const [headerHeight, setHeaderHeight] = useState(0)
  const [contentHeight, setContentHeight] = useState(0)
  const headerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  const disabled = !user || user?.isAnonymous || user?.id === 'anonymous'

  const toggleSearch = () => {
    if (isSearchOpen) {
      setIsSearchClosing(true)
      setShouldShowHeaderBackground(false)
      // 내부 요소를 20ms 지연 후 숨김 (열기와 반대)
      setTimeout(() => setShowSearchContent(false), 20)
      setTimeout(() => {
        setIsSearchOpen(false)
        setIsSearchClosing(false)
      }, 200) // 애니메이션 시간과 동일
    } else {
      setIsSearchOpen(true)
      setShouldShowHeaderBackground(true)
      // 내부 요소가 20ms 지연 후 나타나도록
      setTimeout(() => setShowSearchContent(true), 20)
    }
  }
  const closeSearch = () => {
    if (isSearchOpen) {
      setIsSearchClosing(true)
      setShouldShowHeaderBackground(false)
      // 내부 요소를 20ms 지연 후 숨김 (열기와 반대)
      setTimeout(() => setShowSearchContent(false), 20)
      setTimeout(() => {
        setIsSearchOpen(false)
        setIsSearchClosing(false)
      }, 200)
    }
  }

  useEffect(() => {
    const updateHeaderHeight = () => {
      if (headerRef.current) {
        setHeaderHeight(headerRef.current.getBoundingClientRect().height)
      }
      if (contentRef.current) {
        setContentHeight(contentRef.current.getBoundingClientRect().height)
      }
    }
    updateHeaderHeight()
    // 약간의 지연을 두어 DOM 업데이트 후 높이 측정
    const timeoutId = setTimeout(updateHeaderHeight, 0)
    window.addEventListener('resize', updateHeaderHeight)
    return () => {
      clearTimeout(timeoutId)
      window.removeEventListener('resize', updateHeaderHeight)
    }
  }, [isSearchOpen, isSearchClosing])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSearchOpen) {
        closeSearch()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isSearchOpen])

  // Reset search content visibility when search closes
  useEffect(() => {
    if (!isSearchOpen && !isSearchClosing) {
      setShowSearchContent(false)
    }
  }, [isSearchOpen, isSearchClosing])

  const handleSectionChange = (section: 'all' | 'saved') => {
    setActiveSection(section)
    if (section === 'all') router.push('/pensieve')
    else if (section === 'saved') router.push('/pensieve/saved')
  }

  return (
    <>
      <style>{slideDownAnimation}</style>
    <div
      ref={headerRef}
      className="sticky top-0 z-60 -mx-8 sm:-mx-8 md:-mx-40 lg:-mx-48 px-8 sm:px-8 md:px-40 lg:px-48 pb-1.5 sm:pb-0 pt-1.5 sm:pt-0 "
      style={shouldShowHeaderBackground || isSearchOpen || isSearchClosing
        ? { 
            backgroundColor: 'var(--background)', 
            ...styleWithoutBorderAndShadow, 
            ...headerGlassStyle
          }
        : { 
            backgroundColor: 'color-mix(in srgb, var(--background) 95%, transparent)', 
            ...styleWithoutBorderAndShadow, 
            ...headerGlassStyle
          }
      }
    >
      <div className="relative" ref={contentRef}>
        {/* Header top row with search/upload + tabs (responsive) */}
        <div
          className={`relative flex items-stretch justify-between h-[52px]`}
        >
          <h2 className="text-[19px] sm:text-[21px] font-semibold flex items-center" style={{ letterSpacing: '-0.012em' }}>Pensieve</h2>

          {/* Mobile (single-row) actions */}
          <div className="sm:hidden flex items-center self-center gap-3">
            {/* Mobile search icon */}
            <button
              onClick={toggleSearch}
              className="p-0 rounded-md cursor-pointer text-(--foreground) hover:bg-(--muted)/10 transition-colors"
              aria-label={isSearchOpen ? 'Close search' : 'Open search'}
            >
              <Loop className="w-6 h-6" />
            </button>

            {/* Mobile New Project (red pill) - Hidden here, moved to floating button */}
            <button
              type="button"
              onClick={() => setIsUploadModalOpen(true)}
              className="hidden cursor-pointer transition-all ml-1.5"
              aria-label="New Project"
            >
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-all text-xs font-semibold bg-[#FF3B30] text-white hover:bg-[#D32F2F]`}
              >
                <Aperture className="w-3 h-3" />
                New Project
              </span>
            </button>

            {/* Mobile Select button - only on saved page, rightmost position */}
            {showSelectButton && (
              <button
                onClick={() => setIsSelectionMode(!isSelectionMode)}
                className="text-(--foreground) rounded-full flex items-center justify-center group w-[50px] h-[32px] shrink-0 cursor-pointer "
                title="Toggle selection mode"
                aria-label="Toggle selection mode"
                style={{
                  ...(isSelectionMode ? {
                    background: 'transparent',
                    border: '1px solid transparent',
                    boxShadow: 'none',
                    backdropFilter: 'none',
                    WebkitBackdropFilter: 'none',
                  } : getAdaptiveGlassStyleBlur())
                }}
              >
                {isSelectionMode ? (
                  <div 
                    className="flex items-center justify-center w-8 h-8 rounded-full cursor-pointer"
                    style={{
                      color: 'white',
                      backgroundColor: '#007AFF',
                      border: '1px solid #007AFF',
                      boxShadow: '0 8px 40px rgba(0, 122, 255, 0.3), 0 4px 20px rgba(0, 122, 255, 0.2), 0 2px 8px rgba(0, 122, 255, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                    }}
                    title="Done selecting"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  </div>
                ) : (
                  <div className="flex items-center justify-center rounded-full px-2">
                    <span className="text-xs font-semibold text-(--foreground)">Select</span>
                  </div>
                )}
              </button>
            )}
          </div>

          <div className="hidden sm:flex items-center gap-6 h-full">
            {/* Navigation links (desktop) */}
            <nav className="flex items-center gap-6 h-full -mb-px">
              {(['all', 'saved'] as const).map((section) => (
                <button
                  key={section}
                  onClick={() => handleSectionChange(section)}
                  className={`text-[12px] transition-all cursor-pointer flex items-center h-full border-b-[1.5px] text-(--foreground) ${
                    activeSection === section
                      ? 'opacity-100 font-normal border-(--foreground)'
                      : 'opacity-100 font-normal border-transparent hover:border-(--foreground)/30'
                  }`}
                  aria-current={activeSection === section ? 'page' : undefined}
                >
                  {section === 'all' ? 'Strands' : 'Cabinet'}
                </button>
              ))}
            </nav>

            <div className="flex items-center gap-6">
              {/* Search icon - Separate from nav tabs */}
              <button
                onClick={toggleSearch}
                className={`transition-all cursor-pointer flex items-center text-(--foreground) hover:opacity-100 ${
                  isSearchOpen ? 'opacity-100' : 'opacity-60'
                }`}
                aria-label={isSearchOpen ? 'Close search' : 'Open search'}
              >
                <Loop className="w-[22px] h-[22px]" />
              </button>

              {/* Select button - mapped to 'Book a demo' style */}
              {showSelectButton && (
                <button
                  onClick={() => setIsSelectionMode(!isSelectionMode)}
                  className="shrink-0 cursor-pointer transition-all"
                  title="Toggle selection mode"
                  aria-label="Toggle selection mode"
                >
                  {isSelectionMode ? (
                    <div 
                      className="flex items-center justify-center w-[28px] h-[28px] rounded-full cursor-pointer"
                      style={{
                        color: 'white',
                        backgroundColor: '#007AFF',
                        border: '1px solid #007AFF',
                        boxShadow: '0 4px 12px rgba(0, 122, 255, 0.3)',
                      }}
                      title="Done selecting"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center rounded-full px-[11px] h-[28px] border border-(--foreground) hover:bg-(--foreground) hover:text-(--background) transition-colors">
                      <span className="text-[12px] font-normal leading-[1.33337] tracking-[-.01em]">Select</span>
                    </div>
                  )}
                </button>
              )}

              {/* New Project button - mapped to 'Buy' style */}
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(true)}
                className="cursor-pointer transition-all"
                aria-label="New Project"
              >
                <span
                  className="inline-flex items-center px-[11px] h-[28px] rounded-full transition-all bg-[#0071e3] text-white hover:bg-[#0077ed] text-[12px] font-normal leading-[1.33337] tracking-[-.01em]"
                >
                  New Project
                </span>
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Search overlay */}
      {(isSearchOpen || isSearchClosing) && (
        <div
          className="absolute left-8 right-8 sm:left-8 sm:right-8 md:left-40 md:right-40 lg:left-48 lg:right-48 z-71 pointer-events-auto py-4"
          onClick={closeSearch}
          style={{
            top: `${contentHeight}px`, // 헤더 내부 콘텐츠 영역의 끝에서 시작
            backgroundColor: 'var(--background)',
            ...styleWithoutBorderAndShadow,
            ...headerGlassStyle,
            animation: isSearchClosing 
              ? 'slideUp 0.2s cubic-bezier(0.4, 0, 0.2, 1)' 
              : 'slideDown 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          <div className="px-0" onClick={(e) => e.stopPropagation()}>
            <div className={`relative transform-gpu transition-all duration-200 ease-out ${
              showSearchContent ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
            }`}>
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-(--muted) opacity-70">
                <Loop className="w-6 h-6" />
              </div>
              <input
                type="text"
                placeholder="Search by prompt or keywords..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full pl-16 pr-4 py-3 text-base rounded-lg text-(--foreground) placeholder:text-(--muted)/60 focus:outline-none transition-all"
                autoFocus
              />
            </div>
          </div>
        </div>
      )}

      <UploadImageModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUploadComplete={(metadata) => {
          // 부모에만 저장 완료 이벤트 전달, 모달은 닫지 않는다.
          onUploadComplete?.(metadata)
        }}
        user={user}
      />
    </div>
    </>
  )
}



