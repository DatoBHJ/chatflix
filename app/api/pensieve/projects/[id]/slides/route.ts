import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { isUrlExpired, extractBucketName } from '@/app/utils/urlUtils'

// POST /api/pensieve/projects/[id]/slides - 슬라이드 추가
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 프로젝트 소유권 확인
    const { data: project, error: projectError } = await supabase
      .from('pensieve_projects')
      .select('id, user_id, slide_count')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found or not owned by user' }, { status: 404 })
    }

    const body = await req.json()
    const {
      parentSlideId,
      imageUrl,
      imagePath,
      bucketName,
      urlExpiresAt,
      prompt,
      aiPrompt,
      aiJsonPrompt,
      isOriginal
    } = body

    if (!imageUrl || !imagePath) {
      return NextResponse.json({ error: 'imageUrl and imagePath are required' }, { status: 400 })
    }

    // 다음 슬라이드 인덱스 계산
    const nextSlideIndex = project.slide_count || 0

    // 슬라이드 생성
    const { data: slide, error: slideError } = await supabase
      .from('pensieve_project_slides')
      .insert({
        project_id: projectId,
        slide_index: nextSlideIndex,
        parent_slide_id: parentSlideId || null,
        image_url: imageUrl,
        image_path: imagePath,
        bucket_name: bucketName || 'generated-images',
        url_expires_at: urlExpiresAt || null,
        prompt: prompt || null,
        ai_prompt: aiPrompt || null,
        ai_json_prompt: aiJsonPrompt || null,
        is_original: isOriginal || false
      })
      .select()
      .single()

    if (slideError) throw slideError

    // 프로젝트 썸네일 및 slide_count 업데이트
    await supabase
      .from('pensieve_projects')
      .update({
        thumbnail_url: imageUrl,
        thumbnail_path: imagePath,
        slide_count: nextSlideIndex + 1
      })
      .eq('id', projectId)

    return NextResponse.json({
      success: true,
      slide
    })

  } catch (error) {
    console.error('[PROJECTS] POST slides error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to add slide' },
      { status: 500 }
    )
  }
}

// GET /api/pensieve/projects/[id]/slides - 슬라이드 목록 조회
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params
    const supabase = await createClient()

    const { data: slides, error } = await supabase
      .from('pensieve_project_slides')
      .select(`
        id,
        slide_index,
        parent_slide_id,
        image_url,
        image_path,
        bucket_name,
        url_expires_at,
        prompt,
        ai_prompt,
        ai_json_prompt,
        is_original,
        created_at
      `)
      .eq('project_id', projectId)
      .order('slide_index', { ascending: true })

    if (error) throw error

    // URL 만료 확인 및 갱신
    const refreshedSlides = await Promise.all(
      (slides || []).map(async (slide) => {
        // url_expires_at이 있으면 확인, 없으면 URL에서 직접 확인
        const needsRefresh = slide.url_expires_at 
          ? new Date(slide.url_expires_at) < new Date()
          : (slide.image_url && isUrlExpired(slide.image_url))
        
        if (needsRefresh && slide.image_path) {
          // 버킷 이름 결정: DB 값 우선, URL에서 추출한 값 fallback
          let bucketName = slide.bucket_name || 'generated-images'
          
          // DB의 bucket_name이 잘못되었을 수 있으므로, URL에서 버킷 이름 추출 시도
          if (slide.image_url) {
            const urlBucketName = extractBucketName(slide.image_url)
            if (urlBucketName) {
              bucketName = urlBucketName
            }
          }
          
          try {
            const { data: signedData } = await supabase.storage
              .from(bucketName)
              .createSignedUrl(slide.image_path, 24 * 60 * 60)

            if (signedData?.signedUrl) {
              // URL 갱신 및 올바른 bucket_name 업데이트
              await supabase
                .from('pensieve_project_slides')
                .update({
                  image_url: signedData.signedUrl,
                  bucket_name: bucketName, // 올바른 bucket_name으로 업데이트
                  url_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
                })
                .eq('id', slide.id)

              return { ...slide, image_url: signedData.signedUrl, bucket_name: bucketName }
            }
          } catch (e) {
            console.error('Failed to refresh slide URL:', e)
          }
        }
        return slide
      })
    )

    return NextResponse.json({ slides: refreshedSlides })

  } catch (error) {
    console.error('[PROJECTS] GET slides error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch slides' },
      { status: 500 }
    )
  }
}

