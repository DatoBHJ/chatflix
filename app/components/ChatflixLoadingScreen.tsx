'use client'

import { createPortal } from 'react-dom'
import { useState, useEffect } from 'react'
import { getChatflixLogo } from '@/lib/models/logoUtils'

interface ChatflixLoadingScreenProps {
  className?: string
}

export function ChatflixLoadingScreen({ className = '' }: ChatflixLoadingScreenProps) {
  const [mounted, setMounted] = useState(false)
  const [isDark, setIsDark] = useState(true)

  useEffect(() => {
    setMounted(true)
    // 브라우저 설정에 따른 테마 감지
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    setIsDark(mediaQuery.matches)

    const handler = (e: MediaQueryListEvent) => setIsDark(e.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  const loadingScreen = (
    <div className={`chatflix-loading-screen fixed inset-0 flex h-screen items-center justify-center ${isDark ? 'bg-black' : 'bg-white'} z-[9999] overflow-hidden ${className}`}>
      {/* 배경 방사형 그라데이션 펄스 */}
      <div className={`absolute inset-0 background-radial-pulse ${!isDark ? 'opacity-30' : ''}`} />
      <div className="flex flex-col items-center gap-6 animate-fade-in relative z-10">
        <div className="relative logo-container">
          <div className={`absolute inset-0 logo-glow-pulse ${!isDark ? 'opacity-40' : ''}`} />
          <div className="relative logo-float">
            <img
              src={getChatflixLogo({ isDark })}
              alt="Chatflix"
              className="w-32 h-32 md:w-40 md:h-48 logo-gradient-shimmer"
            />
          </div>
        </div>
      </div>
    </div>
  )

  // SSR 및 hydration 직후: null 반환. hydration 이후에만 body에 포탈하여 mismatch 방지
  if (!mounted || typeof document === 'undefined' || !document.body) {
    return null
  }
  return createPortal(loadingScreen, document.body)
}

