'use client'

import { createClient } from '@/utils/supabase/client'
import PhotoOverviewSection from '../components/PhotoOverviewSection'
import { usePhotoApp } from '../components/PhotoContext'
import { useBackgroundImage } from '@/app/hooks/useBackgroundImage'

export default function PhotoOverviewPage() {
  const { user, isLoading } = usePhotoApp()
  const supabase = createClient()

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

  if (isLoading) {
    return null
  }

  return (
    <>
      {/* Overview Section */}
      {/* <PhotoOverviewSection 
        user={user}
        onBackgroundChange={handleBackgroundChange}
      /> */}
    </>
  )
}

