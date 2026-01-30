import { useState, useEffect, useCallback, useMemo } from 'react'
import { XSearchData, XSearchEntry, PromptType } from '../types'
import { PENSIEVE_CURATED_EXCLUDED_IDS } from '../../../utils/pensieveConstants'
import { createClient } from '@/utils/supabase/client'

export function useGallery(isOpen: boolean, mode: string) {
  const [galleryImages, setGalleryImages] = useState<Array<{ image: any; folder: string }>>([])
  const [isLoadingGallery, setIsLoadingGallery] = useState(false)
  const [selectedGalleryImage, setSelectedGalleryImage] = useState<any | null>(null)
  const [showGalleryPreview, setShowGalleryPreview] = useState(false)
  const [galleryPromptType, setGalleryPromptType] = useState<PromptType>('prompt')
  const supabase = createClient()

  const promptToString = (prompt: string | object | undefined | null): string => {
    if (!prompt) return ''
    if (typeof prompt === 'string') return prompt
    try {
      return JSON.stringify(prompt)
    } catch {
      return ''
    }
  }

  // Supabase에서 pensieve_curated 로드
  const loadPensieveCuratedFromSupabase = useCallback(async (): Promise<any[]> => {
    try {
      const { data, error } = await supabase
        .from('user_background_settings')
        .select('id, background_path, background_url, created_at, name, prompt, ai_prompt, ai_json_prompt, url_expires_at, bucket_name, pensieve_curated_group_id, pensieve_curated_tweet_ids, pensieve_curated_authors, pensieve_curated_queries, pensieve_curated_strategies, metadata')
        .eq('source', 'pensieve_curated')
        .order('created_at', { ascending: false })

      if (error) {
        console.warn('Failed to load pensieve_curated from Supabase:', error)
        return []
      }

      const filtered = (data || []).filter(item => {
        const groupId = item.pensieve_curated_group_id || item.id
        return !PENSIEVE_CURATED_EXCLUDED_IDS.includes(groupId)
      })

      const withUrls = await Promise.all(
        filtered.map(async (item) => {
          let url = item.background_url
          if (!item.background_url ||
              (item.url_expires_at && new Date(item.url_expires_at) < new Date())) {
            try {
              const { data: signedData } = await supabase.storage
                .from(item.bucket_name || 'saved-gallery')
                .createSignedUrl(item.background_path, 24 * 60 * 60)
              if (signedData?.signedUrl) {
                url = signedData.signedUrl
              }
            } catch (error) {
              console.error('Failed to refresh URL:', error)
            }
          }

          const metadataObj = (item.metadata as any) || {}
          const groupId = item.pensieve_curated_group_id || item.id

          return {
            id: groupId,
            path: item.background_path,
            filename: item.name || item.background_path?.split('/').pop() || 'image',
            size: '',
            createdDate: item.created_at || new Date().toISOString(),
            keywords: [],
            links: metadataObj.links || [],
            prompt: item.ai_json_prompt || item.ai_prompt || item.prompt || '',
            dimensions: '',
            url: url,
            ai_json_prompt: item.ai_json_prompt,
            ai_prompt: item.ai_prompt,
            pensieve_curated_queries: item.pensieve_curated_queries || [],
            pensieve_curated_strategies: item.pensieve_curated_strategies || [],
            pensieve_curated_authors: item.pensieve_curated_authors || [],
            pensieve_curated_tweetIds: item.pensieve_curated_tweet_ids || [],
            x_search_queries: item.pensieve_curated_queries || [],
            x_search_strategies: item.pensieve_curated_strategies || [],
            x_search_authors: item.pensieve_curated_authors || [],
            x_search_tweetIds: item.pensieve_curated_tweet_ids || [],
            // Metadata JSONB field (includes referenceImages)
            metadata: item.metadata || undefined
          }
        })
      )

      return withUrls
    } catch (error) {
      console.error('Error loading pensieve_curated from Supabase:', error)
      return []
    }
  }, [supabase])

  const convertPensieveCuratedToImageMetadata = useCallback((entry: XSearchEntry) => {
    if (!entry.paths || entry.paths.length === 0) return []
    const isPromptObject = typeof entry.prompt === 'object' && entry.prompt !== null
    
    return entry.paths.map((path, index) => {
      // Get reference images for this specific path
      const referenceImages = (entry as any).referenceImagesByPath?.[path] || []
      
      return {
        id: entry.id,
        path: path,
        filename: path.split('/').pop() || 'image',
        size: '',
        createdDate: entry.createdDate,
        keywords: [],
        links: entry.links,
        prompt: entry.prompt,
        dimensions: '',
        url: undefined,
        ai_json_prompt: isPromptObject ? entry.prompt : undefined,
        ai_prompt: undefined,
        folder: 'pensieve_curated',
        pensieve_curated_queries: entry.searchQueries,
        pensieve_curated_strategies: entry.searchStrategies,
        pensieve_curated_authors: entry.authors,
        pensieve_curated_tweetIds: entry.tweetIds,
        x_search_queries: entry.searchQueries,
        x_search_strategies: entry.searchStrategies,
        x_search_authors: entry.authors,
        x_search_tweetIds: entry.tweetIds,
        // Metadata JSONB field (includes referenceImages for this path)
        metadata: referenceImages.length > 0 ? { referenceImages } : undefined
      }
    })
  }, [])

  const loadGallery = async () => {
    setIsLoadingGallery(true)
    try {
      const imagesResponse = await fetch('/pensieve/images_metadata.json')

      let imagesData: { [folder: string]: any[] } = {}
      if (imagesResponse.ok) imagesData = await imagesResponse.json()

      // pensieve_curated 로드 (Supabase 우선, JSON fallback)
      let pensieveCuratedImages: any[] = []
      try {
        pensieveCuratedImages = await loadPensieveCuratedFromSupabase()
      } catch (error) {
        console.warn('Failed to load pensieve_curated from Supabase, trying JSON fallback:', error)
      }

      // Supabase에서 로드 실패한 경우 JSON fallback
      if (pensieveCuratedImages.length === 0) {
        try {
          const curatedResponse = await fetch('/pensieve/pensieve_curated/pensieve_curated_prompt.json')
          if (!curatedResponse.ok) {
            // 하위 호환성: 기존 경로도 시도
            const xSearchResponse = await fetch('/pensieve/x_search/x_search_prompt.json')
            if (xSearchResponse.ok) {
              const xSearchData: XSearchData = await xSearchResponse.json()
              const entries = (xSearchData as any).x_search || (xSearchData as any).pensieve_curated || []
              pensieveCuratedImages = entries
                .filter((entry: XSearchEntry) => !PENSIEVE_CURATED_EXCLUDED_IDS.includes(entry.id))
                .flatMap((entry: XSearchEntry) => convertPensieveCuratedToImageMetadata(entry))
            }
          } else {
            const curatedData = await curatedResponse.json()
            const entries = curatedData.pensieve_curated || curatedData.x_search || []
            pensieveCuratedImages = entries
              .filter((entry: XSearchEntry) => !PENSIEVE_CURATED_EXCLUDED_IDS.includes(entry.id))
              .flatMap((entry: XSearchEntry) => convertPensieveCuratedToImageMetadata(entry))
          }
        } catch (error) {
          console.warn('Failed to load pensieve_curated from JSON fallback:', error)
        }
      }
      
      const images: Array<{ image: any; folder: string }> = []
      Object.entries(imagesData).forEach(([folder, imageList]) => {
        imageList.forEach((image) => images.push({ image, folder }))
      })
      pensieveCuratedImages.forEach((image) => images.push({ image, folder: 'pensieve_curated' }))
      
      const getTimestamp = (value: string | undefined) => {
        if (!value) return 0
        const ts = new Date(value).getTime()
        return isNaN(ts) ? 0 : ts
      }
      images.sort((a, b) => getTimestamp(b.image.createdDate) - getTimestamp(a.image.createdDate))
      
      setGalleryImages(images)
    } catch (error) {
      console.error('Error loading gallery:', error)
    } finally {
      setIsLoadingGallery(false)
    }
  }

  useEffect(() => {
    if (isOpen && mode === 'initial') loadGallery()
  }, [isOpen, mode, loadPensieveCuratedFromSupabase, convertPensieveCuratedToImageMetadata])

  return {
    galleryImages,
    isLoadingGallery,
    selectedGalleryImage,
    setSelectedGalleryImage,
    showGalleryPreview,
    setShowGalleryPreview,
    galleryPromptType,
    setGalleryPromptType,
    promptToString
  }
}

