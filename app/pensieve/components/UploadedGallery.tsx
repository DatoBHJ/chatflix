'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import Masonry from 'react-masonry-css'
import { createClient } from '@/utils/supabase/client'
import ImageCard, { ImageMetadata } from './ImageCard'
import ImageViewer from './ImageViewer'
import { generateImageSlugSync } from '../utils/imageSlug'

interface ImagesMetadata {
  [folder: string]: ImageMetadata[]
}

interface UploadedGalleryProps {
  onCopyPrompt: (prompt: string) => void
  user: any
  searchQuery: string
  refreshToken?: number
  lastUploaded?: any
  onDelete?: (imageId: string) => Promise<void> | void
}

export default function UploadedGallery({
  onCopyPrompt,
  user,
  searchQuery,
  refreshToken = 0,
  lastUploaded,
  onDelete
}: UploadedGalleryProps) {
  const [metadata, setMetadata] = useState<ImagesMetadata>({})
  const [isLoading, setIsLoading] = useState(true)
  const [viewerImage, setViewerImage] = useState<{ image: ImageMetadata; folder: string } | null>(null)
  const [viewerIndex, setViewerIndex] = useState(0)
  const [isViewerOpen, setIsViewerOpen] = useState(false)
  const supabase = createClient()

  const isGuest = !user || user?.isAnonymous || user?.id === 'anonymous'

  // Safely convert prompt to string (handles string | object)
  const promptToString = (prompt: string | object | undefined | null): string => {
    if (!prompt) return ''
    if (typeof prompt === 'string') return prompt
    try {
      return JSON.stringify(prompt)
    } catch {
      return ''
    }
  }

  // URL 변경 함수 (history.pushState 사용)
  const updateUrlForImage = useCallback((image: ImageMetadata) => {
    try {
      const slug = generateImageSlugSync(image)
      const newUrl = `/pensieve/${slug}`
      window.history.pushState({ imageSlug: slug, isModal: true }, '', newUrl)
    } catch (error) {
      console.error('Error updating URL:', error)
    }
  }, [])

  // URL 복원 함수
  const restoreOriginalUrl = useCallback(() => {
    if (window.history.state?.isModal) {
      window.history.back()
    }
  }, [])

  // popstate 이벤트 핸들러 (브라우저 뒤로가기)
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (isViewerOpen && !event.state?.isModal) {
        setIsViewerOpen(false)
        setViewerImage(null)
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [isViewerOpen])

  // Load user's uploads
  useEffect(() => {
    const loadUploads = async () => {
      try {
        if (isGuest) {
          setMetadata({ uploaded: [] })
          return
        }

        const { data, error } = await supabase
          .from('user_background_settings')
          .select('id, background_path, background_url, created_at, name, prompt, ai_prompt, ai_json_prompt, is_public, url_expires_at, bucket_name, metadata')
          .eq('user_id', user.id)
          .eq('source', 'upload')
          .eq('bucket_name', 'saved-gallery')
          .like('background_path', '%pensieve_upload_%')
          .order('created_at', { ascending: false })

        if (error) throw error

        // Generate URLs in parallel, refreshing expired ones
        const urlPromises = (data || []).map(async (item) => {
          // Check if URL is still valid, refresh if needed
          let url = item.background_url
          if (!item.background_url || (item.url_expires_at && new Date(item.url_expires_at) < new Date())) {
            try {
              // Use correct bucket name from database
              const { data: signedData, error: signedError } = await supabase.storage
                .from(item.bucket_name || 'saved-gallery')
                .createSignedUrl(item.background_path, 24 * 60 * 60)
              
              if (signedData?.signedUrl) {
                url = signedData.signedUrl
                // Update the URL in database
                await supabase
                  .from('user_background_settings')
                  .update({
                    background_url: url,
                    url_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
                  })
                  .eq('id', item.id)
              }
            } catch (error) {
              console.error('Error generating signed URL for', item.background_path, error)
            }
          }

          return {
            id: item.id,
            path: item.background_path,
            filename: item.name || item.background_path?.split('/').pop() || 'image',
            size: '',
            createdDate: item.created_at || new Date().toISOString(),
            keywords: [],
            links: (item.metadata as any)?.links || [],
            prompt: item.prompt ?? null,
            dimensions: '',
            url: url,
            ai_json_prompt: item.ai_json_prompt,
            ai_prompt: item.ai_prompt,
            is_public: item.is_public ?? false,
            // Metadata JSONB field (includes referenceImages)
            metadata: item.metadata || undefined
          } as ImageMetadata
        })

        const images = await Promise.all(urlPromises)

        setMetadata({ uploaded: images })
      } catch (error) {
        console.error('Error loading uploads:', error)
        setMetadata({ uploaded: [] })
      } finally {
        setIsLoading(false)
      }
    }

    loadUploads()
  }, [isGuest, supabase, user?.id, refreshToken])

  // Inject newly uploaded image into local state
  useEffect(() => {
    if (!lastUploaded || isGuest) return
    setMetadata((prev) => {
      const folder = 'uploaded'
      const copy = { ...prev }
      const list = copy[folder] ? [...copy[folder]] : []
      const exists = list.find((item) => item.path === lastUploaded.path)
      if (exists) return prev
      const entry: ImageMetadata = {
        id: lastUploaded.id,
        path: lastUploaded.path || lastUploaded.filename || `uploads/${Date.now()}`,
        filename: lastUploaded.filename || lastUploaded.name || lastUploaded.path || 'upload',
        size: lastUploaded.size || '',
        createdDate: lastUploaded.createdDate || new Date().toISOString(),
        keywords: lastUploaded.keywords || [],
        links: lastUploaded.links || [],
        prompt: lastUploaded.prompt || lastUploaded.ai_prompt || '',
        dimensions: lastUploaded.dimensions || '',
        url: lastUploaded.url,
        ai_json_prompt: lastUploaded.ai_json_prompt,
        ai_prompt: lastUploaded.ai_prompt,
        is_public: lastUploaded.is_public ?? false
      }
      list.unshift(entry)
      copy[folder] = list
      return copy
    })
  }, [lastUploaded, isGuest])

  // Flatten images
  const allImages = useMemo(() => {
    const images: { image: ImageMetadata; folder: string }[] = []
    Object.entries(metadata).forEach(([folder, imageList]) => {
      imageList.forEach((image) => images.push({ image, folder }))
    })
    return images
  }, [metadata])

  // Filter by search
  const filteredImages = useMemo(() => {
    let filtered = allImages
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter((item) => {
        const promptStr = promptToString(item.image.prompt)
        const promptMatch = promptStr.toLowerCase().includes(query)
        const keywordMatch = item.image.keywords?.some((k) => k.toLowerCase().includes(query))
        return promptMatch || keywordMatch
      })
    }
    return filtered
  }, [allImages, searchQuery])

  const handleImageClick = (image: ImageMetadata, folder: string) => {
    const index = filteredImages.findIndex(
      (item) => item.image.path === image.path && item.folder === folder
    )
    setViewerIndex(index >= 0 ? index : 0)
    setViewerImage({ image, folder })
    setIsViewerOpen(true)
    
    // URL 변경 (history.pushState)
    updateUrlForImage(image)
  }

  const handleViewerNext = () => {
    if (viewerIndex < filteredImages.length - 1) {
      const nextIndex = viewerIndex + 1
      const nextImage = filteredImages[nextIndex]
      setViewerIndex(nextIndex)
      setViewerImage(nextImage)
      
      // URL 업데이트 (replaceState로 히스토리 항목 교체)
      try {
        const slug = generateImageSlugSync(nextImage.image)
        const newUrl = `/pensieve/${slug}`
        window.history.replaceState({ imageSlug: slug, isModal: true }, '', newUrl)
      } catch (error) {
        console.error('Error updating URL:', error)
      }
    }
  }

  const handleViewerPrevious = () => {
    if (viewerIndex > 0) {
      const prevIndex = viewerIndex - 1
      const prevImage = filteredImages[prevIndex]
      setViewerIndex(prevIndex)
      setViewerImage(prevImage)
      
      // URL 업데이트 (replaceState로 히스토리 항목 교체)
      try {
        const slug = generateImageSlugSync(prevImage.image)
        const newUrl = `/pensieve/${slug}`
        window.history.replaceState({ imageSlug: slug, isModal: true }, '', newUrl)
      } catch (error) {
        console.error('Error updating URL:', error)
      }
    }
  }

  const handleViewerClose = () => {
    setIsViewerOpen(false)
    setViewerImage(null)
    
    // URL 복원 (history.back)
    restoreOriginalUrl()
  }

  const handleImageUpdate = useCallback((updatedImage: ImageMetadata) => {
    setMetadata((prev) => {
      const next: ImagesMetadata = {}
      Object.entries(prev).forEach(([folder, imageList]) => {
        next[folder] = imageList.map((img) =>
          img.id && updatedImage.id && img.id === updatedImage.id ? { ...img, ...updatedImage } : img
        )
      })
      return next
    })

    setViewerImage((prev) => {
      if (prev?.image?.id && updatedImage.id && prev.image.id === updatedImage.id) {
        return { ...prev, image: { ...prev.image, ...updatedImage } }
      }
      return prev
    })
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-[var(--muted)]">Loading your uploads...</div>
      </div>
    )
  }

  if (Object.keys(metadata).length === 0 || filteredImages.length === 0) {
    return (
      <div className="flex items-center justify-start py-20">
        <div className="text-left max-w-md">
          <h2 className="text-3xl font-semibold tracking-tight text-[var(--foreground)] mb-4">
            Nothing uploaded yet.
          </h2>
          <p className="text-sm text-[var(--muted)] mb-4">
            {isGuest ? 'Sign in to upload images.' : 'Your uploads will appear here.'}
          </p>
          {isGuest ? (
            <a 
              href="/login"
              className="text-blue-500 hover:underline cursor-pointer text-sm"
            >
              Sign in
            </a>
          ) : (
            <a 
              href="/pensieve"
              className="text-blue-500 hover:underline cursor-pointer text-sm"
            >
              Upload an image
            </a>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      <Masonry
        breakpointCols={{
          default: 5,
          1024: 4,
          640: 3,
          480: 2
        }}
        className="flex -ml-3 w-auto"
        columnClassName="pl-3 bg-clip-padding"
      >
        {/* Regular image cards */}
        {filteredImages.map((item, idx) => (
          <ImageCard
            key={`${item.folder}-${item.image.path}-${idx}`}
            image={item.image}
            folder={item.folder}
            onImageClick={handleImageClick}
            viewContext="cabinet"
          />
        ))}
      </Masonry>

      {isViewerOpen && viewerImage && (
        <ImageViewer
          image={viewerImage.image}
          folder={viewerImage.folder}
          allImages={filteredImages}
          currentIndex={viewerIndex}
          isOpen={isViewerOpen}
          onClose={handleViewerClose}
          onNext={handleViewerNext}
          onPrevious={handleViewerPrevious}
          onCopyPrompt={onCopyPrompt}
          user={user}
          onDelete={onDelete}
          onImageUpdate={handleImageUpdate}
        />
      )}
    </>
  )
}

