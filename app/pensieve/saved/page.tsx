'use client'

import { useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import SavedGallery from '../components/SavedGallery'
import { useBackgroundImage } from '@/app/hooks/useBackgroundImage'
import { usePensieve } from '../context/PensieveContext'

export default function PensieveSavedPage() {
  const { user, searchQuery, refreshToken, triggerRefresh } = usePensieve()
  const supabase = createClient()

  const handleCopyPrompt = async (prompt: string) => {
    try {
      await navigator.clipboard.writeText(prompt)
    } catch (error) {
      console.error('Failed to copy prompt:', error)
    }
  }

  const handleDeleteImage = async (imageId: string, skipRefresh = false) => {
    if (!imageId || !user || user?.isAnonymous || user?.id === 'anonymous') return

    try {
      // 1. 이미지 정보 조회 (스토리지 파일 삭제용)
      const { data, error } = await supabase
        .from('user_background_settings')
        .select('bucket_name, background_path')
        .eq('id', imageId)
        .eq('user_id', user.id)
        .single()

      if (error) throw error

      // 2. user_preferences에서 이 이미지를 참조하는 경우 기본값으로 리셋
      const { data: preference } = await supabase
        .from('user_preferences')
        .select('id, selected_background_id, selected_background_type')
        .eq('user_id', user.id)
        .single()

      if (preference && 
          preference.selected_background_type === 'custom' && 
          preference.selected_background_id === imageId) {
        // 기본 배경으로 리셋
        await supabase
          .from('user_preferences')
          .update({
            selected_background_type: 'default',
            selected_background_id: 'default-1'
          })
          .eq('user_id', user.id)
      }

      // 3. 스토리지에서 파일 삭제
      if (data?.bucket_name && data?.background_path) {
        await supabase.storage.from(data.bucket_name).remove([data.background_path])
      }

      // 4. 데이터베이스에서 레코드 삭제
      await supabase.from('user_background_settings').delete().eq('id', imageId)

      if (!skipRefresh) {
        triggerRefresh()
      }
    } catch (err) {
      console.error('Delete error:', err)
      alert('Failed to delete image. Please try again.')
    }
  }

  // Listen for save events from other pages
  useEffect(() => {
    const savedChannel = new BroadcastChannel('pensieve-saved-refresh')
    const refreshChannel = new BroadcastChannel('pensieve-refresh')
    
    const handleMessage = (event: MessageEvent) => {
      // 프로젝트 생성/업데이트는 SavedGallery에서 자체적으로 최적화 처리하므로 
      // 여기서 triggerRefresh()를 호출하여 전체를 다시 불러오지 않도록 함
      // 단, image-saved는 아직 전체 리프레시가 필요할 수 있음
      if (event.data?.type === 'image-saved') {
        triggerRefresh()
      } else if (event.data?.type === 'project-created' || event.data?.type === 'project-updated') {
        // 프로젝트 관련은 Gallery 내부에서 처리하거나, 
        // 필요한 경우에만 아주 가끔 전체 리프레시를 하도록 설계 변경 가능
        // 현재는 Gallery가 BroadCast를 직접 들으므로 여기서 중복 호출 방지
        console.log('[PensieveSavedPage] Project event received, skipping global refresh as Gallery handles it')
      }
    }
    
    savedChannel.addEventListener('message', handleMessage)
    refreshChannel.addEventListener('message', handleMessage)

    return () => {
      savedChannel.close()
      refreshChannel.close()
    }
  }, [triggerRefresh])

  return (
    <>
      <SavedGallery
        onCopyPrompt={handleCopyPrompt}
        user={user}
        searchQuery={searchQuery}
        refreshToken={refreshToken}
        onDelete={handleDeleteImage}
      />
    </>
  )
}
