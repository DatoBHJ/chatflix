'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import Image from 'next/image'
import { getInitialTheme } from '@/app/lib/adaptiveGlassStyle'
import WhatsNewHeader from './WhatsNewHeader'
import { getChatflixLogo } from '@/lib/models/logoUtils'

interface WhatsNewNavigationWrapperProps {
  activeSection?: string
}

export default function WhatsNewNavigationWrapper({ activeSection = 'overview' }: WhatsNewNavigationWrapperProps) {
  const router = useRouter()
  const [isDark, setIsDark] = useState(() => getInitialTheme())

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

      {/* Sticky What's New Header */}
      <WhatsNewHeader activeSection={activeSection} />
    </>
  )
}
