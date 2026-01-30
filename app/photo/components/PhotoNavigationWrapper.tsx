'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import Image from 'next/image'
import PhotoHeader from './PhotoHeader'
import { usePhotoApp } from './PhotoContext'
import { getChatflixLogo } from '@/lib/models/logoUtils'

export default function PhotoNavigationWrapper() {
  const router = useRouter()
  const pathname = usePathname()
  const [isDark, setIsDark] = useState(false)
  const { activeSection, setActiveSection } = usePhotoApp()

  // pathname 변경 시 activeSection 업데이트
  useEffect(() => {
    const newSection = pathname?.includes('/photo/overview') ? 'overview' 
      : pathname?.includes('/photo/saved') ? 'saved'
      : pathname?.includes('/photo/uploads') ? 'uploads'
      : 'all'
    setActiveSection(newSection)
  }, [pathname, setActiveSection])

  // Detect theme changes
  useEffect(() => {
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

  return (
    <>
      {/* Home Navigation - Non-sticky, scrolls away */}
      <div className="mb-8 sm:mb-12">
        <button
          onClick={() => router.push('/')}
          className="cursor-pointer transition-opacity hover:opacity-80"
        >
          <Image
            src={getChatflixLogo({ isDark })}
            alt="Chatflix"
            width={100}
            height={32}
            className="h-8 w-auto"
          />
        </button>
      </div>

      {/* Sticky Photo Header */}
      <PhotoHeader activeSection={activeSection} />
    </>
  )
}
