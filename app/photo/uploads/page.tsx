'use client'

import { createClient } from '@/utils/supabase/client'
import UploadsSection from '../components/UploadsSection'
import { useBackgroundImage } from '@/app/hooks/useBackgroundImage'
import { usePhotoApp } from '../components/PhotoContext'

export default function MyPhotosPage() {
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
      {/* Gallery Content - Full Width */}
      <UploadsSection
        user={user}
        currentBackground={currentBackground}
        backgroundType={backgroundType}
        backgroundId={backgroundId}
        onBackgroundChange={handleBackgroundChange}
      />
    </>
  )
}
