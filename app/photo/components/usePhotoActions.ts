'use client'

import { useState } from 'react'
import { DEFAULT_BACKGROUNDS } from '../constants/backgrounds'

interface UsePhotoActionsProps {
  user: any
  images: Array<{ id: string; url: string; name?: string }>
  onBackgroundChange: (backgroundUrl: string, backgroundType: 'default' | 'custom', backgroundId?: string) => void
  handleDeleteBackground: (imageId: string) => Promise<void>
  setIsViewerOpen: (open: boolean) => void
}

export function usePhotoActions({
  user,
  images,
  onBackgroundChange,
  handleDeleteBackground,
  setIsViewerOpen
}: UsePhotoActionsProps) {
  const [isSettingBackground, setIsSettingBackground] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [viewerDeletingId, setViewerDeletingId] = useState<string | null>(null)

  const handleViewerSetBackground = async (imageId: string) => {
    const image = images.find(img => img.id === imageId)
    if (!image) return

    setIsSettingBackground(true)

    try {
      // Determine if this is a default background or custom background
      const isDefaultBackground = DEFAULT_BACKGROUNDS.some(bg => bg.id === imageId)
      const backgroundType = isDefaultBackground ? 'default' : 'custom'

      // Save preference to database
      const response = await fetch('/api/background/set-preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          backgroundType: backgroundType,
          backgroundId: imageId
        })
      })

      if (!response.ok) {
        console.error('Failed to save preference')
        alert('Failed to save background preference. Please try again.')
        return
      }

      // Update local state
      onBackgroundChange(image.url, backgroundType, image.id)
      
      // Show success state briefly
      setIsSettingBackground(false)
      setIsSuccess(true)
      setTimeout(() => {
        setIsSuccess(false)
      }, 1000)
    } catch (error) {
      console.error('Error applying background:', error)
      alert('Failed to apply background. Please try again.')
      setIsSettingBackground(false)
    }
  }

  const handleViewerDelete = async (imageId: string) => {
    setViewerDeletingId(imageId)
    
    try {
      await handleDeleteBackground(imageId)
      // Close viewer after successful deletion
      setIsViewerOpen(false)
    } catch (error) {
      console.error('Error deleting image:', error)
    } finally {
      setViewerDeletingId(null)
    }
  }

  return {
    isSettingBackground,
    isSuccess,
    viewerDeletingId,
    handleViewerSetBackground,
    handleViewerDelete
  }
}
