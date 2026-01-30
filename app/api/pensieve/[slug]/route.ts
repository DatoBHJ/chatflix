import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { parseImageSlug } from '@/app/pensieve/utils/imageSlug'
import { PENSIEVE_CURATED_EXCLUDED_IDS } from '@/app/pensieve/utils/pensieveConstants'
import { ImageMetadata } from '@/app/pensieve/components/ImageCard'
import fs from 'fs'
import path from 'path'

interface ImagesMetadata {
  [folder: string]: ImageMetadata[]
}

interface XSearchEntry {
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

interface XSearchData {
  x_search: XSearchEntry[]
}

// Service role client to bypass RLS for checking image existence
function createServiceRoleClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    if (!slug) {
      return NextResponse.json({ error: 'Slug is required' }, { status: 400 })
    }

    const parsed = parseImageSlug(slug)
    const imageId = parsed.value

    // Use service role client to bypass RLS and check image existence
    const adminClient = createServiceRoleClient()
    const supabase = await createClient()
    
    // First, check if image exists and get its privacy status (bypassing RLS)
    // pensieve_curated는 group_id로도 조회 가능
    // group_id로 조회할 경우 여러 레코드가 있을 수 있으므로 모두 가져옴
    const { data: imageDataList, error: imageError } = await adminClient
      .from('user_background_settings')
      .select('id, background_path, background_url, created_at, name, prompt, ai_prompt, ai_json_prompt, url_expires_at, bucket_name, is_public, user_id, source, pensieve_curated_group_id, pensieve_curated_tweet_ids, pensieve_curated_authors, pensieve_curated_queries, pensieve_curated_strategies, metadata')
      .or(`id.eq.${imageId},pensieve_curated_group_id.eq.${imageId}`)
    
    // id로 직접 조회한 경우 또는 단일 레코드인 경우
    let imageData = imageDataList?.[0] || null
    
    // group_id로 조회한 경우, id와 일치하는 레코드를 찾거나 첫 번째 레코드 사용
    if (imageDataList && imageDataList.length > 1) {
      // id와 정확히 일치하는 레코드 찾기
      const exactMatch = imageDataList.find(item => item.id === imageId)
      if (exactMatch) {
        imageData = exactMatch
      } else {
        // 일치하는 것이 없으면 첫 번째 레코드 사용
        imageData = imageDataList[0]
      }
    }

    if (imageData && !imageError) {
      // Found in Supabase - check if user has access
      const {
        data: { user }
      } = await supabase.auth.getUser()

      if (!imageData.is_public && (!user || imageData.user_id !== user.id)) {
        // Private image - return specific error for better UX
        return NextResponse.json({ error: 'private_image' }, { status: 403 })
      }

      // User has access - continue with the data
      const supabaseData = imageData

      // Refresh URL if expired
      let url = supabaseData.background_url
      if (!url || (supabaseData.url_expires_at && new Date(supabaseData.url_expires_at) < new Date())) {
        try {
          const { data: signedData, error: signedError } = await supabase.storage
            .from(supabaseData.bucket_name || 'saved-gallery')
            .createSignedUrl(supabaseData.background_path, 24 * 60 * 60)

          if (signedData?.signedUrl) {
            url = signedData.signedUrl
            // Update the URL in database
            await supabase
              .from('user_background_settings')
              .update({
                background_url: url,
                url_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
              })
              .eq('id', supabaseData.id)
          }
        } catch (error) {
          console.error('Error generating signed URL:', error)
        }
      }

      // Determine folder based on source
      let folder = 'share' // default
      if (supabaseData.source === 'pensieve_saved') {
        folder = 'saved'
      } else if (supabaseData.source === 'pensieve_uploaded') {
        folder = 'uploaded'
      } else if (supabaseData.source === 'pensieve_curated') {
        folder = 'pensieve_curated'
      } else if (supabaseData.source) {
        // For other sources, try to extract folder name from source
        // e.g., 'pensieve_myphotos' -> 'myphotos'
        const sourceMatch = supabaseData.source.match(/^pensieve_(.+)$/)
        if (sourceMatch) {
          folder = sourceMatch[1]
        }
      }

      // pensieve_curated인 경우 제외 ID 체크
      if (supabaseData.source === 'pensieve_curated') {
        const groupId = supabaseData.pensieve_curated_group_id || supabaseData.id
        if (PENSIEVE_CURATED_EXCLUDED_IDS.includes(groupId)) {
          return NextResponse.json({ error: 'Image not found' }, { status: 404 })
        }
      }

      const metadataObj = (supabaseData.metadata as any) || {}

      const imageMetadata: ImageMetadata = {
        id: supabaseData.pensieve_curated_group_id || supabaseData.id, // 그룹 ID 사용
        path: supabaseData.background_path,
        filename: supabaseData.name || supabaseData.background_path?.split('/').pop() || 'image',
        size: '',
        createdDate: supabaseData.created_at || new Date().toISOString(),
        keywords: [],
        links: metadataObj.links || [],
        prompt: supabaseData.ai_json_prompt || supabaseData.ai_prompt || supabaseData.prompt || '',
        dimensions: '',
        url: url,
        ai_json_prompt: supabaseData.ai_json_prompt,
        ai_prompt: supabaseData.ai_prompt,
        is_public: supabaseData.is_public ?? false,
        folder: folder,
        // pensieve_curated 전용 필드
        pensieve_curated_queries: supabaseData.pensieve_curated_queries || [],
        pensieve_curated_strategies: supabaseData.pensieve_curated_strategies || [],
        pensieve_curated_authors: supabaseData.pensieve_curated_authors || [],
        pensieve_curated_tweetIds: supabaseData.pensieve_curated_tweet_ids || [],
        // 하위 호환성
        x_search_queries: supabaseData.pensieve_curated_queries || [],
        x_search_strategies: supabaseData.pensieve_curated_strategies || [],
        x_search_authors: supabaseData.pensieve_curated_authors || [],
        x_search_tweetIds: supabaseData.pensieve_curated_tweet_ids || [],
        // Metadata JSONB field (includes referenceImages)
        metadata: supabaseData.metadata || undefined
      }

      return NextResponse.json(imageMetadata)
    }

    // If not found in Supabase (with service role), try JSON metadata files
    try {
      // 1. Try images_metadata.json first
      const jsonPath = path.join(process.cwd(), 'public', 'pensieve', 'images_metadata.json')
      const jsonContent = fs.readFileSync(jsonPath, 'utf-8')
      const jsonData: ImagesMetadata = JSON.parse(jsonContent)

      // Search through all folders and images by id
      for (const [folder, images] of Object.entries(jsonData)) {
        for (const image of images) {
          if (image.id === imageId) {
            // Found the image
            const imageMetadata: ImageMetadata = {
              ...image,
              url: image.url || `/pensieve/${image.path}`,
              folder: folder // Include folder information
            }
            return NextResponse.json(imageMetadata)
          }
        }
      }

      // 2. Try pensieve_curated_prompt.json (fallback)
      try {
        // 먼저 새 경로 시도
        let curatedPath = path.join(process.cwd(), 'public', 'pensieve', 'pensieve_curated', 'pensieve_curated_prompt.json')
        let curatedContent: string
        let curatedData: any

        try {
          curatedContent = fs.readFileSync(curatedPath, 'utf-8')
          curatedData = JSON.parse(curatedContent)
        } catch {
          // 하위 호환성: 기존 경로도 시도
          curatedPath = path.join(process.cwd(), 'public', 'pensieve', 'x_search', 'x_search_prompt.json')
          curatedContent = fs.readFileSync(curatedPath, 'utf-8')
          curatedData = JSON.parse(curatedContent)
        }

        // pensieve_curated 또는 x_search 배열 찾기
        const entries = curatedData.pensieve_curated || curatedData.x_search || []

        // Search through pensieve_curated entries
        for (const entry of entries) {
          // 제외할 ID는 404 반환
          if (PENSIEVE_CURATED_EXCLUDED_IDS.includes(entry.id)) {
            continue
          }
          
          if (entry.id === imageId) {
            // Found the image - return the first path (or could handle multiple paths)
            const isPromptObject = typeof entry.prompt === 'object' && entry.prompt !== null
            
            const imageMetadata: ImageMetadata = {
              id: entry.id,
              path: entry.paths[0], // Use first path
              filename: entry.paths[0].split('/').pop() || 'image',
              size: '',
              createdDate: entry.createdDate,
              keywords: [],
              links: entry.links,
              prompt: entry.prompt,
              dimensions: '',
              url: `/pensieve/${entry.paths[0]}`,
              ai_json_prompt: isPromptObject ? entry.prompt : undefined,
              ai_prompt: undefined,
              folder: 'pensieve_curated',
              // pensieve_curated 전용 필드
              pensieve_curated_queries: entry.searchQueries || [],
              pensieve_curated_strategies: entry.searchStrategies || [],
              pensieve_curated_authors: entry.authors || [],
              pensieve_curated_tweetIds: entry.tweetIds || [],
              // 하위 호환성
              x_search_queries: entry.searchQueries || [],
              x_search_strategies: entry.searchStrategies || [],
              x_search_authors: entry.authors || [],
              x_search_tweetIds: entry.tweetIds || []
            }
            return NextResponse.json(imageMetadata)
          }
        }
      } catch (curatedError) {
        // pensieve_curated_prompt.json might not exist or be invalid, continue to 404
        console.error('Error loading pensieve_curated_prompt.json:', curatedError)
      }

      return NextResponse.json({ error: 'Image not found' }, { status: 404 })
    } catch (error) {
      console.error('Error loading JSON metadata:', error)
      return NextResponse.json({ error: 'Failed to load image metadata' }, { status: 500 })
    }
  } catch (error) {
    console.error('Error in share API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

