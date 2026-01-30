'use client'

import { use, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import ImageViewer from '../../components/ImageViewer'
import { ImageMetadata } from '../../components/ImageCard'
import { useBackgroundImage } from '@/app/hooks/useBackgroundImage'
import { Lock } from 'lucide-react'
import { useLoading } from '@/app/lib/LoadingContext'

export default function SavedImagePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const router = useRouter()
  const [image, setImage] = useState<ImageMetadata | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { setIsLoading: setAppLoading } = useLoading()
  const [error, setError] = useState<string | null>(null)
  const [isPrivate, setIsPrivate] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null)
  const supabase = createClient()

  // Background management
  useBackgroundImage(user?.id, {
    refreshOnMount: true,
    preload: true,
    useSupabase: true,
    supabaseClient: supabase
  })

  // Load user
  useEffect(() => {
    const loadUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          const guestUser = {
            id: 'anonymous',
            email: 'guest@chatflix.app',
            user_metadata: {
              full_name: 'Guest User',
              name: 'Guest'
            },
            isAnonymous: true
          }
          setUser(guestUser)
        } else {
          setUser(user)
        }
      } catch (error) {
        console.error('Error loading user:', error)
        const guestUser = {
          id: 'anonymous',
          email: 'guest@chatflix.app',
          user_metadata: {
            full_name: 'Guest User',
            name: 'Guest'
          },
          isAnonymous: true
        }
        setUser(guestUser)
      }
    }
    loadUser()
  }, [supabase])

  // Load image data
  useEffect(() => {
    const loadImage = async () => {
      try {
        setIsLoading(true)
        setAppLoading(true)
        setError(null)
        setIsPrivate(false)

        const response = await fetch(`/api/pensieve/${slug}`)
        
        if (!response.ok) {
          const data = await response.json().catch(() => ({}))
          
          if (response.status === 403 && data.error === 'private_image') {
            setIsPrivate(true)
            setError('This image is private')
          } else if (response.status === 404) {
            setError('Image not found')
          } else {
            setError('Failed to load image')
          }
          return
        }

        const imageData: ImageMetadata = await response.json()
        setImage(imageData)
      } catch (error) {
        console.error('Error loading image:', error)
        setError('Failed to load image')
      } finally {
        setIsLoading(false)
        setAppLoading(false)
      }
    }

    if (slug) {
      loadImage()
    }
  }, [slug, setAppLoading])

  const handleCopyPrompt = async (prompt: string) => {
    try {
      await navigator.clipboard.writeText(prompt)
      setCopiedPrompt(prompt)
      setTimeout(() => setCopiedPrompt(null), 2000)
    } catch (error) {
      console.error('Failed to copy prompt:', error)
    }
  }

  const handleClose = () => {
    // Navigate back to the cabinet page
    router.push('/pensieve/saved')
  }

  const handleDeleteImage = async (imageId: string) => {
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

      // Navigate back to saved gallery after delete
      router.push('/pensieve/saved')
    } catch (err) {
      console.error('Delete error:', err)
      alert('Failed to delete image. Please try again.')
    }
  }

  if (isLoading) {
    return null
  }

  if (error || !image) {
    // Private image - show a more informative UI
    if (isPrivate) {
      return (
        <div className="min-h-screen flex items-center justify-center text-[var(--foreground)]" style={{ backgroundColor: 'var(--background)' }}>
          <div className="text-center max-w-md px-6">
            {/* Lock Icon */}
            <div className="mb-6 flex justify-center">
              <div className="w-20 h-20 rounded-full bg-[var(--subtle-divider)] flex items-center justify-center">
                <Lock className="w-10 h-10 text-[var(--muted)]" />
              </div>
            </div>
            
            {/* Title */}
            <h1 className="text-2xl font-semibold mb-3">Private Image</h1>
            
            {/* Description */}
            <p className="text-[var(--muted)] mb-2">
              This image is set to private by its owner.
            </p>
            <p className="text-[var(--muted)] text-sm mb-8">
              Only the owner can view this image. If you believe this is an error, please contact{' '}
              <a
                href="mailto:sply@chatflix.app"
                className="font-bold text-blue-500 hover:text-blue-600 transition-colors cursor-pointer"
              >
                sply@chatflix.app
              </a>
              {' '}or sign in with the correct account.
            </p>
            
            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => router.push('/login')}
                className="px-5 py-2.5 bg-[var(--foreground)] text-[var(--background)] rounded-lg hover:opacity-90 transition-opacity font-medium"
              >
                Sign In
              </button>
              <button
                onClick={() => router.push('/pensieve/saved')}
                className="px-5 py-2.5 border border-[var(--subtle-divider)] text-[var(--foreground)] rounded-lg hover:bg-[var(--subtle-divider)] transition-colors font-medium"
              >
                Back to Cabinet
              </button>
            </div>
          </div>
        </div>
      )
    }

    // Generic error - image not found
    return (
      <div className="min-h-screen flex items-center justify-center text-[var(--foreground)]" style={{ backgroundColor: 'var(--background)' }}>
        <div className="text-center max-w-md px-6">
          {/* Icon */}
          <div className="mb-6 flex justify-center">
            <div className="w-20 h-20 rounded-full bg-[var(--subtle-divider)] flex items-center justify-center">
              <svg className="w-10 h-10 text-[var(--muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
          
          {/* Title */}
          <h1 className="text-2xl font-semibold mb-3">Image Not Found</h1>
          
          {/* Description */}
          <p className="text-[var(--muted)] mb-8">
            {error || 'The image you are looking for does not exist or may have been removed.'}
          </p>
          
          {/* Action */}
          <button
            onClick={() => router.push('/pensieve/saved')}
            className="px-5 py-2.5 bg-[var(--foreground)] text-[var(--background)] rounded-lg hover:opacity-90 transition-opacity font-medium"
          >
            Back to Cabinet
          </button>
        </div>
      </div>
    )
  }

  // Use folder="saved" for images in the cabinet
  const imageFolder = 'saved'
  const singleImageArray = [{ image, folder: imageFolder }]

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--background)' }}>
      <ImageViewer
        image={image}
        folder={imageFolder}
        allImages={singleImageArray}
        currentIndex={0}
        isOpen={true}
        onClose={handleClose}
        onNext={() => {}} // No next in single image mode
        onPrevious={() => {}} // No previous in single image mode
        onCopyPrompt={handleCopyPrompt}
        user={user}
        onDelete={handleDeleteImage}
      />
    </div>
  )
}


