'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import Image from 'next/image'
import PensieveHeaderWithTabs from './PensieveHeaderWithTabs'
import MobileSectionSwitcher from './MobileSectionSwitcher'
import MobileNewProjectButton from './MobileNewProjectButton'
import BottomGradient from './BottomGradient'
import { usePensieve } from '../context/PensieveContext'
import { usePensieveSelection } from '../context/PensieveSelectionContext'
import { getChatflixLogo } from '@/lib/models/logoUtils'

import PensieveIntro from './PensieveIntro'
// import PensieveWaterBackground from './PensieveWaterBackground'

export default function PensieveNavigationWrapper() {
  const router = useRouter()
  const pathname = usePathname()
  const [isDark, setIsDark] = useState(false)
  
  const { searchQuery, setSearchQuery, user, triggerRefresh, setLastUploaded, setUploadSuccess, activeSection, setActiveSection } = usePensieve()
  const { isSelectionMode } = usePensieveSelection()

  const handleUploadComplete = (metadata: any) => {
    triggerRefresh()
    const isPublic = metadata?.is_public ?? metadata?.isPublic ?? false
    const message = isPublic 
      ? 'Thanks for sharing! Image and prompt saved successfully'
      : 'Image and prompt saved successfully'
    setUploadSuccess(message)
    setLastUploaded(metadata)
  }
  
  // Show intro only on main pensieve page (and not in sub-routes unless desired)
  // Adjust logic if intro should appear elsewhere
  const showIntro = !pathname?.includes('/pensieve/projects/') && !pathname?.includes('/pensieve/saved')

  // Detect theme changes
  useEffect(() => {
    // ... (keep existing theme logic)
    const detectTheme = () => {
      const theme = document.documentElement.getAttribute('data-theme')
      if (theme === 'dark') {
        setIsDark(true)
      } else if (theme === 'light') {
        setIsDark(false)
      } else {
        // System theme
        const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        setIsDark(systemDark)
      }
    }

    // Initial detection
    detectTheme()

    // Listen for theme changes
    const observer = new MutationObserver(detectTheme)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    })

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleMediaChange = () => detectTheme()
    mediaQuery.addEventListener('change', handleMediaChange)

    return () => {
      observer.disconnect()
      mediaQuery.removeEventListener('change', handleMediaChange)
    }
  }, [])

  // pathname 변경 시 activeSection 업데이트 (프로젝트 편집 모드가 아닐 때만)
  useEffect(() => {
    if (!pathname?.includes('/pensieve/projects/')) {
      const newSection = pathname?.includes('/pensieve/saved') ? 'saved' : 'all'
      setActiveSection(newSection)
    }
  }, [pathname, setActiveSection])

  return (
    <>
      {/* Background Layer - Covers top area including header */}
      {showIntro && (
        <div 
          className="absolute top-0 left-0 right-0 h-svh z-0 overflow-hidden pointer-events-none"
          style={{ willChange: 'transform' }}
        >
          {/* Background base */}
          <div className="absolute inset-0 bg-background" />
          
          {/* Water Background - Commented out, replaced with bg-background */}
          {/* <div className="absolute inset-0 opacity-90">
            <PensieveWaterBackground opacity={1} interactive={true} />
          </div> */}
          
          {/* Bottom fade gradient - REMOVED */}
          {/* <div className="absolute inset-x-0 bottom-0 h-[30%] bg-linear-to-t from-[var(--background)] via-[var(--background)]/80 to-transparent z-10" /> */}
        </div>
      )}

      {/* Home Navigation - Non-sticky, scrolls away */}
      <div className="relative z-10 mb-0 sm:mb-12 ml-0">
        <button
          onClick={() => router.push('/')}
          className="cursor-pointer transition-opacity hover:opacity-80"
        >
          <Image
            src={getChatflixLogo()} // Always dark logo on black background
            alt="Chatflix"
            width={100}
            height={32}
            className="h-7.5 w-auto"
          />
        </button>
      </div>

      {/* Intro Section - Scrolls away before sticky header */}
      <div className="relative z-10 -mx-8 sm:-mx-8 md:-mx-40 lg:-mx-48 mb-0 sm:mb-0">
        {showIntro && <PensieveIntro user={user} onUploadComplete={handleUploadComplete} showBackground={false} />}
      </div>

      {/* Sticky Pensieve Header */}
      <PensieveHeaderWithTabs
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        user={user}
        onUploadComplete={handleUploadComplete}
        activeSection={activeSection}
      />

      <BottomGradient />
      <MobileSectionSwitcher />
      <MobileNewProjectButton />
    </>
  )
}



