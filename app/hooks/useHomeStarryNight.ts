'use client'

import { useState, useEffect } from 'react'

// 홈 화면 별 효과 설정 훅
export function useHomeStarryNight() {
  const [isEnabled, setIsEnabled] = useState(true) // 기본값은 true (활성화)

  useEffect(() => {
    // localStorage에서 설정 읽기
    const saved = localStorage.getItem('homeStarryNightEnabled')
    if (saved !== null) {
      setIsEnabled(JSON.parse(saved))
    }

    // localStorage 변경 감지 (다른 탭/컴포넌트에서 변경된 경우)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'homeStarryNightEnabled' && e.newValue !== null) {
        setIsEnabled(JSON.parse(e.newValue))
      }
    }

    // 커스텀 이벤트 감지 (같은 탭 내에서 변경된 경우)
    const handleCustomEvent = (e: CustomEvent) => {
      setIsEnabled(e.detail.enabled)
    }

    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('homeStarryNightChanged', handleCustomEvent as EventListener)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('homeStarryNightChanged', handleCustomEvent as EventListener)
    }
  }, [])

  const toggle = () => {
    const newValue = !isEnabled
    setIsEnabled(newValue)
    localStorage.setItem('homeStarryNightEnabled', JSON.stringify(newValue))
    
    // 다른 컴포넌트들에게 변경 알림
    window.dispatchEvent(new CustomEvent('homeStarryNightChanged', {
      detail: { enabled: newValue }
    }))
  }

  return { isEnabled, toggle }
} 