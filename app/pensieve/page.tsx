'use client'

import { createClient } from '@/utils/supabase/client'
import PensieveGallery from './components/PensieveGallery'
import { useBackgroundImage } from '@/app/hooks/useBackgroundImage'
import { usePensieve } from './context/PensieveContext'

export default function PensievePage() {
  const { user, searchQuery, refreshToken, lastUploaded } = usePensieve()
  const supabase = createClient()

  const handleCopyPrompt = async (prompt: string) => {
    try {
      await navigator.clipboard.writeText(prompt)
      // Toast handled by parent layout via uploadSuccess state if needed, 
      // but for copy prompt we might just log or show a small tooltip
      // setCopiedPrompt(prompt) -> local state removed as it wasn't used effectively in previous code
    } catch (error) {
      console.error('Failed to copy prompt:', error)
    }
  }

  // Layout wrapper removed as it's now in layout.tsx
  return (
    <>
      {/* Gallery - Full Width */}
      <PensieveGallery 
        onCopyPrompt={handleCopyPrompt} 
        user={user}
        searchQuery={searchQuery}
        refreshToken={refreshToken}
        lastUploaded={lastUploaded || undefined}
        showPublicOnly={true}
      />
    </>
  )
}
