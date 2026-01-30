import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import { ImageMetadata } from '../components/ImageCard'
import { ProjectMetadata } from '../components/ProjectCard'
import { PENSIEVE_CURATED_EXCLUDED_IDS } from '../utils/pensieveConstants'

export interface ImagesMetadata {
  [folder: string]: ImageMetadata[]
}

interface PensieveCuratedEntry {
  id: string
  prompt: string | object
  paths: string[]
  createdDate: string
  links: string[]
  tweetIds: string[]
  authors: string[]
  searchQueries: string[]
  searchStrategies: string[]
}

interface PensieveCuratedData {
  pensieve_curated: PensieveCuratedEntry[]
  // 하위 호환성
  x_search?: PensieveCuratedEntry[]
}

interface UseGalleryImagesProps {
  showPublicOnly?: boolean
  refreshToken?: number
  lastUploaded?: any
}

export function useGalleryImages({
  showPublicOnly = false,
  refreshToken = 0,
  lastUploaded
}: UseGalleryImagesProps) {
  const [metadata, setMetadata] = useState<ImagesMetadata>({})
  const [projects, setProjects] = useState<ProjectMetadata[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()

  // Supabase에서 pensieve_curated 이미지 로드
  const loadPensieveCuratedFromSupabase = useCallback(async (): Promise<ImageMetadata[]> => {
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

      // 제외할 ID 필터링
      const filtered = (data || []).filter(item => {
        const groupId = item.pensieve_curated_group_id || item.id
        return !PENSIEVE_CURATED_EXCLUDED_IDS.includes(groupId)
      })

      // URL 갱신 및 ImageMetadata 변환
      const withUrls = await Promise.all(
        filtered.map(async (item) => {
          let url = item.background_url

          // URL 만료 체크 및 갱신
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
            id: groupId, // 그룹 ID 사용 (같은 id로 그룹화)
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
            folder: 'pensieve_curated',
            // pensieve_curated 전용 필드
            pensieve_curated_queries: item.pensieve_curated_queries || [],
            pensieve_curated_strategies: item.pensieve_curated_strategies || [],
            pensieve_curated_authors: item.pensieve_curated_authors || [],
            pensieve_curated_tweetIds: item.pensieve_curated_tweet_ids || [],
            // 하위 호환성
            x_search_queries: item.pensieve_curated_queries || [],
            x_search_strategies: item.pensieve_curated_strategies || [],
            x_search_authors: item.pensieve_curated_authors || [],
            x_search_tweetIds: item.pensieve_curated_tweet_ids || [],
            // Metadata JSONB field (includes referenceImages)
            metadata: item.metadata || undefined
          } as ImageMetadata
        })
      )

      // 중복 제거: 같은 background_path를 가진 이미지는 하나만 유지
      const seenPaths = new Set<string>()
      const uniqueImages = withUrls.filter((image) => {
        if (seenPaths.has(image.path)) {
          return false // 중복된 path는 제외
        }
        seenPaths.add(image.path)
        return true
      })

      return uniqueImages
    } catch (error) {
      console.error('Error loading pensieve_curated from Supabase:', error)
      return []
    }
  }, [supabase])

  // Convert PensieveCuratedEntry to ImageMetadata[] (JSON fallback용)
  const convertPensieveCuratedToImageMetadata = useCallback((entry: PensieveCuratedEntry): ImageMetadata[] => {
    if (!entry.paths || entry.paths.length === 0) {
      return []
    }

    // Keep prompt as-is (string or object), and also store in ai_json_prompt if it's an object
    const isPromptObject = typeof entry.prompt === 'object' && entry.prompt !== null

    return entry.paths.map((path) => ({
      id: entry.id, // 동일한 id 공유
      path: path, // "pensieve_curated/media/twitter_xxx_0.jpeg"
      filename: path.split('/').pop() || 'image', // 파일명 추출
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
      // pensieve_curated 전용 필드
      pensieve_curated_queries: entry.searchQueries,
      pensieve_curated_strategies: entry.searchStrategies,
      pensieve_curated_authors: entry.authors,
      pensieve_curated_tweetIds: entry.tweetIds,
      // 하위 호환성
      x_search_queries: entry.searchQueries,
      x_search_strategies: entry.searchStrategies,
      x_search_authors: entry.authors,
      x_search_tweetIds: entry.tweetIds
    }))
  }, [])

  // Load metadata
  useEffect(() => {
    const loadMetadata = async () => {
      try {
        if (showPublicOnly) {
          // 공개 이미지와 공개 프로젝트 동시 조회
          const [
            { data: imageData, error: imageError },
            { data: projectData, error: projectError },
            jsonResponse
          ] = await Promise.all([
            supabase
              .from('user_background_settings')
              .select('id, background_path, background_url, created_at, name, prompt, ai_prompt, ai_json_prompt, url_expires_at, bucket_name, metadata')
              .eq('is_public', true)
              .in('source', ['pensieve_saved', 'upload'])
              .eq('bucket_name', 'saved-gallery')
              .order('created_at', { ascending: false }),
            supabase
              .from('pensieve_projects')
              .select('id, user_id, name, thumbnail_url, thumbnail_path, prompt, ai_prompt, slide_count, is_public, created_at, updated_at')
              .eq('is_public', true)
              .order('created_at', { ascending: false }),
            fetch('/pensieve/images_metadata.json')
          ])

          if (imageError) throw imageError
          if (projectError) console.warn('Failed to load public projects:', projectError)

          // Generate URLs in parallel, refreshing expired ones
          const urlPromises = (imageData || []).map(async (item) => {
            // Check if URL is still valid, refresh if needed
            let url = item.background_url
            if (!item.background_url || (item.url_expires_at && new Date(item.url_expires_at) < new Date())) {
              try {
                // Use correct bucket name from database
                const { data: signedData } = await supabase.storage
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
              links: [],
              prompt: item.prompt ?? null,
              dimensions: '',
              url: url,
              ai_json_prompt: item.ai_json_prompt,
              ai_prompt: item.ai_prompt,
              metadata: item.metadata || undefined
            } as ImageMetadata
          })

          const images = await Promise.all(urlPromises)

          let jsonData: ImagesMetadata = {}
          if (jsonResponse?.ok) {
            jsonData = (await jsonResponse.json()) as ImagesMetadata
          } else {
            console.warn('Failed to load local metadata, showing Supabase images only')
          }

          // pensieve_curated 로드 (Supabase 우선, JSON fallback)
          let pensieveCuratedImages: ImageMetadata[] = []
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
                  const xSearchData: PensieveCuratedData = (await xSearchResponse.json()) as any
                  const entries = xSearchData.x_search || xSearchData.pensieve_curated || []
                  pensieveCuratedImages = entries
                    .filter((entry) => !PENSIEVE_CURATED_EXCLUDED_IDS.includes(entry.id))
                    .flatMap((entry) => convertPensieveCuratedToImageMetadata(entry))
                }
              } else {
                const curatedData: PensieveCuratedData = (await curatedResponse.json()) as PensieveCuratedData
                const entries = curatedData.pensieve_curated || curatedData.x_search || []
                pensieveCuratedImages = entries
                  .filter((entry) => !PENSIEVE_CURATED_EXCLUDED_IDS.includes(entry.id))
                  .flatMap((entry) => convertPensieveCuratedToImageMetadata(entry))
              }
            } catch (error) {
              console.warn('Failed to load pensieve_curated from JSON fallback:', error)
            }
          }

          setMetadata({
            ...jsonData,
            public: images,
            pensieve_curated: pensieveCuratedImages,
            // 하위 호환성
            x_search: pensieveCuratedImages
          })

          // 공개 프로젝트 설정
          setProjects((projectData || []) as ProjectMetadata[])
        } else {
          // Load images_metadata.json
          const imagesResponse = await fetch('/pensieve/images_metadata.json')

          let imagesData: ImagesMetadata = {}
          if (imagesResponse.ok) {
            imagesData = (await imagesResponse.json()) as ImagesMetadata
          } else {
            console.warn('Failed to load images_metadata.json')
          }

          // pensieve_curated 로드 (Supabase 우선, JSON fallback)
          let pensieveCuratedImages: ImageMetadata[] = []
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
                  const xSearchData: PensieveCuratedData = (await xSearchResponse.json()) as any
                  const entries = xSearchData.x_search || xSearchData.pensieve_curated || []
                  pensieveCuratedImages = entries
                    .filter((entry) => !PENSIEVE_CURATED_EXCLUDED_IDS.includes(entry.id))
                    .flatMap((entry) => convertPensieveCuratedToImageMetadata(entry))
                }
              } else {
                const curatedData: PensieveCuratedData = (await curatedResponse.json()) as PensieveCuratedData
                const entries = curatedData.pensieve_curated || curatedData.x_search || []
                pensieveCuratedImages = entries
                  .filter((entry) => !PENSIEVE_CURATED_EXCLUDED_IDS.includes(entry.id))
                  .flatMap((entry) => convertPensieveCuratedToImageMetadata(entry))
              }
            } catch (error) {
              console.warn('Failed to load pensieve_curated from JSON fallback:', error)
            }
          }

          // Merge pensieve_curated images into metadata
          setMetadata({
            ...imagesData,
            pensieve_curated: pensieveCuratedImages,
            // 하위 호환성
            x_search: pensieveCuratedImages
          })
        }
      } catch (error) {
        console.error('Error loading metadata:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadMetadata()
  }, [refreshToken, showPublicOnly, supabase, loadPensieveCuratedFromSupabase, convertPensieveCuratedToImageMetadata])

  // Inject newly uploaded image into local state
  useEffect(() => {
    if (!lastUploaded || showPublicOnly) return
    setMetadata((prev) => {
      const folder = 'uploads'
      const copy = { ...prev }
      const list = copy[folder] ? [...copy[folder]] : []
      const exists = list.find((item) => item.path === lastUploaded.path)
      if (exists) return prev
      const entry: ImageMetadata = {
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
        ai_prompt: lastUploaded.ai_prompt
      }
      list.unshift(entry)
      copy[folder] = list
      return copy
    })
  }, [lastUploaded, showPublicOnly])

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
  }, [])

  const handleProjectUpdate = useCallback((updatedProject: ProjectMetadata) => {
    setProjects((prev) => 
      prev.map((p) => p.id === updatedProject.id ? { ...p, ...updatedProject } : p)
    )
  }, [])

  const handleProjectTogglePublic = useCallback(async (projectId: string, isPublic: boolean) => {
    try {
      const response = await fetch(`/api/pensieve/projects/${projectId}/toggle-public`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublic })
      })
      
      if (!response.ok) throw new Error('Failed to toggle public status')
      
      // 로컬 상태 업데이트
      setProjects((prev) => 
        prev.map((p) => p.id === projectId ? { ...p, is_public: isPublic } : p)
      )
    } catch (error) {
      console.error('Error toggling project public status:', error)
      throw error
    }
  }, [])

  return {
    metadata,
    projects,
    isLoading,
    handleImageUpdate,
    handleProjectUpdate,
    handleProjectTogglePublic
  }
}


