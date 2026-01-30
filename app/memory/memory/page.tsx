'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import MemoryCardsSection from '@/app/memory/components/MemoryCardsSection'
import { OnboardingRenderer } from '@/app/components/Onboarding/OnboardingRenderer'
import { useMemoryApp } from '../components/MemoryContext'

export default function MemoryPage() {
  const { user, isLoading } = useMemoryApp()
  const pathname = usePathname()
  const [targetElementsMap, setTargetElementsMap] = useState<Map<string, HTMLElement>>(new Map())

  // Track onboarding target elements
  useEffect(() => {
    const updateTargetElements = () => {
      const newMap = new Map<string, HTMLElement>()
      
      // Both steps use the same target: memory-header-info
      const target = document.querySelector('[data-onboarding-target="memory-header-info"]') as HTMLElement
      if (target) {
        // Map both feature keys to the same target element
        newMap.set('memory_introduction_step1', target)
        newMap.set('memory_overview_step2', target)
      }
      
      // Update state with new map (always create new map instance for React to detect changes)
      setTargetElementsMap(new Map(newMap))
    }

    // Initial update
    updateTargetElements()

    // Update when DOM changes (for dynamic elements)
    const observer = new MutationObserver(updateTargetElements)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-onboarding-target']
    })

    // Also update on resize and after a short delay to catch dynamic elements
    window.addEventListener('resize', updateTargetElements)
    const timeoutId = setTimeout(updateTargetElements, 100)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateTargetElements)
      clearTimeout(timeoutId)
    }
  }, [pathname])

  if (isLoading) {
    return null
  }

  return (
    <>
      {/* Memory Cards Section */}
      <MemoryCardsSection user={user} />

      {/* Onboarding Renderer */}
      {!isLoading && (
        <OnboardingRenderer
          location="memory"
          context={{ pathname }}
          target={targetElementsMap}
          displayTypes={['tooltip']}
        />
      )}
    </>
  )
}
