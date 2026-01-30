'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import AllSection from './components/AllSection'
import { usePhotoApp } from './components/PhotoContext'
import { useBackgroundImage } from '@/app/hooks/useBackgroundImage'
import { OnboardingRenderer } from '@/app/components/Onboarding/OnboardingRenderer'

export default function PhotoPage() {
  const { user, isLoading } = usePhotoApp()
  const pathname = usePathname()
  const supabase = createClient()
  const [targetElementsMap, setTargetElementsMap] = useState<Map<string, HTMLElement>>(new Map())

  // Background management using shared hook with Supabase
  const {
    currentBackground,
    backgroundType,
    backgroundId,
    isBackgroundLoading,
    refreshBackground
  } = useBackgroundImage(user?.id, {
    refreshOnMount: true,
    preload: true,
    useSupabase: true,
    supabaseClient: supabase
  })

  const handleBackgroundChange = (backgroundUrl: string, type: 'default' | 'custom', id?: string) => {
    refreshBackground().then(() => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('backgroundImageChanged'));
      }
    });
  }

  // Track onboarding target elements
  useEffect(() => {
    const updateTargetElements = () => {
      const newMap = new Map<string, HTMLElement>()
      
      // All steps use the same target: photo-header-info
      const target = document.querySelector('[data-onboarding-target="photo-header-info"]') as HTMLElement
      if (target) {
        // Map all feature keys to the same target element
        newMap.set('photo_introduction_step1', target)
        newMap.set('photo_wallpaper_step3', target)
        // Overview onboarding - temporarily disabled
        // newMap.set('photo_overview_step4', target)
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
      {/* All Section */}
      <AllSection 
        user={user}
        currentBackground={currentBackground}
        backgroundType={backgroundType}
        backgroundId={backgroundId}
        onBackgroundChange={handleBackgroundChange}
      />

      {/* Onboarding Renderer */}
      {!isLoading && (
        <OnboardingRenderer
          location="photo"
          context={{ pathname }}
          target={targetElementsMap}
          displayTypes={['tooltip']}
        />
      )}
    </>
  )
}
