'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useState } from 'react'
import { getAdaptiveGlassStyleClean, getInitialTheme } from '@/app/lib/adaptiveGlassStyle'
import { usePhotoSelection } from './PhotoContext'

interface PhotoHeaderProps {
  activeSection?: 'overview' | 'all' | 'uploads' | 'saved'
}

export default function PhotoHeader({ activeSection }: PhotoHeaderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const { isSelectionMode, setIsSelectionMode } = usePhotoSelection()

  const handleSectionChange = (section: 'overview' | 'all' | 'uploads' | 'saved') => {
    if (section === 'overview') {
      router.push('/photo/overview')
    } else if (section === 'all') {
      router.push('/photo')
    } else if (section === 'uploads') {
      router.push('/photo/uploads')
    } else {
      router.push('/photo/saved')
    }
    setIsMobileMenuOpen(false)
  }

  // Get adaptive glass style (Clean: backdropFilter, WebkitBackdropFilter, border, boxShadow)
  const isDark = getInitialTheme()
  const glassStyle = getAdaptiveGlassStyleClean(isDark)
  const { boxShadow, border, ...headerGlass } = glassStyle

  // Only show select button when not on overview
  const showSelectButton = activeSection !== 'overview'

  // Tab labels mapping
  const tabLabels: Record<'overview' | 'all' | 'saved' | 'uploads', string> = {
    overview: 'Overview',
    all: 'All',
    saved: 'Saved',
    uploads: 'Uploaded'
  }

  return (
    <div 
      className="sticky top-0 z-60 -mx-8 sm:-mx-8 md:-mx-40 lg:-mx-48 px-8 sm:px-8 md:px-40 lg:px-48 pb-1.5 sm:pb-0 pt-1.5 sm:pt-0"
      style={{ 
        backgroundColor: 'color-mix(in srgb, var(--background) 95%, transparent)', 
        ...headerGlass
      }}
    >
      <div className="relative">
        {/* Header top row */}
        <div className="relative flex items-stretch justify-between h-[52px]">
          <h2 className="text-[19px] sm:text-[21px] font-semibold flex items-center" style={{ letterSpacing: '-0.012em' }}>
            Photos
          </h2>
          
          {/* Mobile actions */}
          <div className="sm:hidden flex items-center self-center gap-3">
            {/* Mobile chevron toggle */}
            <button
              className="p-0 rounded-md cursor-pointer text-(--foreground) hover:bg-(--muted)/10 transition-colors"
              aria-expanded={isMobileMenuOpen}
              aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
              onClick={() => setIsMobileMenuOpen(v => !v)}
            >
              <svg className={`w-5 h-5 transition-transform ${isMobileMenuOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {/* Mobile Select button */}
            {showSelectButton && (
              <button
                onClick={() => setIsSelectionMode(!isSelectionMode)}
                className="text-(--foreground) rounded-full flex items-center justify-center group w-[50px] h-[32px] shrink-0 cursor-pointer"
                title="Toggle selection mode"
                aria-label="Toggle selection mode"
                style={{
                  ...(isSelectionMode ? {
                    background: 'transparent',
                    border: '1px solid transparent',
                    boxShadow: 'none',
                    backdropFilter: 'none',
                    WebkitBackdropFilter: 'none',
                  } : getAdaptiveGlassStyleClean(isDark))
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

          {/* Desktop navigation and actions */}
          <div className="hidden sm:flex items-center gap-6 h-full">
            {/* Navigation tabs (desktop) */}
            <nav className="flex items-center gap-6 h-full -mb-px">
              {(['overview', 'all', 'saved', 'uploads'] as const).map((section) => {
                // Overview section is temporarily disabled
                if (section === 'overview') return null
                
                return (
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
                    {tabLabels[section]}
                  </button>
                )
              })}
              {/* Overview tab - temporarily disabled
              {(['overview'] as const).map((section) => (
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
                  {tabLabels[section]}
                </button>
              ))}
              */}
            </nav>

            {/* Desktop Select button */}
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
            </div>

          {/* Onboarding target */}
          <div 
            data-onboarding-target="photo-header-info"
            className="absolute bottom-0 left-0 sm:left-20 w-20 h-6"
            style={{ visibility: 'hidden', pointerEvents: 'none' }}
            aria-hidden="true"
          />
          </div>
        </div>

      {/* Mobile vertical menu */}
      {isMobileMenuOpen && (
        <div className="sm:hidden">
          <div className="flex flex-col gap-1 pb-4 pt-2">
            {(['overview', 'all', 'saved', 'uploads'] as const).map((section) => {
              // Overview section is temporarily disabled
              if (section === 'overview') return null
              
              return (
                <button
                  key={section}
                  onClick={() => handleSectionChange(section)}
                  className={`flex items-center gap-3 pr-2 py-1.5 text-[12px] cursor-pointer transition-colors ${
                    activeSection === section ? 'text-(--foreground)' : 'text-(--muted) hover:text-(--foreground)'
                  }`}
                  aria-current={activeSection === section ? 'page' : undefined}
                >
                  <span
                    className="inline-block"
                    style={{
                      borderLeft: activeSection === section ? '1.5px solid var(--foreground)' : '1.5px solid transparent',
                      paddingLeft: '12px',
                      height: '10px',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    {tabLabels[section]}
                  </span>
                </button>
              )
            })}
            {/* Overview tab - temporarily disabled
            {(['overview'] as const).map((section) => (
              <button
                key={section}
                onClick={() => handleSectionChange(section)}
                className={`flex items-center gap-3 pr-2 py-1.5 text-[12px] cursor-pointer transition-colors ${
                  activeSection === section ? 'text-(--foreground)' : 'text-(--muted) hover:text-(--foreground)'
                }`}
                aria-current={activeSection === section ? 'page' : undefined}
              >
                <span
                  className="inline-block"
                  style={{
                    borderLeft: activeSection === section ? '1.5px solid var(--foreground)' : '1.5px solid transparent',
                    paddingLeft: '12px',
                    height: '10px',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  {tabLabels[section]}
                </span>
              </button>
            ))}
            */}
          </div>
        </div>
      )}
    </div>
  )
}
