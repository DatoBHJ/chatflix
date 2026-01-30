import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { isUrlExpired, extractBucketName } from '@/app/utils/urlUtils'

// GET /api/pensieve/projects/[id] - 프로젝트 상세 조회 (슬라이드 포함)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // 프로젝트 조회
    const { data: project, error: projectError } = await supabase
      .from('pensieve_projects')
      .select(`
        id,
        user_id,
        name,
        thumbnail_url,
        thumbnail_path,
        original_image_url,
        original_image_path,
        original_bucket_name,
        prompt,
        ai_prompt,
        ai_json_prompt,
        selected_model,
        slide_count,
        is_public,
        created_at,
        updated_at
      `)
      .eq('id', id)
      .single()

    if (projectError) {
      if (projectError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 })
      }
      throw projectError
    }

    // thumbnail_url 갱신
    let refreshedProject = project
    const needsThumbnailRefresh = !project.thumbnail_url || 
      (project.thumbnail_url && isUrlExpired(project.thumbnail_url))
    
    if (needsThumbnailRefresh && project.thumbnail_path) {
      try {
        // 버킷 이름 결정: DB 값 우선, URL에서 추출한 값 fallback
        let bucketName = project.original_bucket_name || 'generated-images'
        
        // DB의 original_bucket_name이 잘못되었을 수 있으므로, URL에서 버킷 이름 추출 시도
        if (project.thumbnail_url) {
          const urlBucketName = extractBucketName(project.thumbnail_url)
          if (urlBucketName) {
            bucketName = urlBucketName
          }
        }
        
        const { data: signedData } = await supabase.storage
          .from(bucketName)
          .createSignedUrl(project.thumbnail_path, 24 * 60 * 60)

        if (signedData?.signedUrl) {
          // DB 업데이트 (올바른 bucket_name도 함께 업데이트)
          await supabase
            .from('pensieve_projects')
            .update({ 
              thumbnail_url: signedData.signedUrl,
              original_bucket_name: bucketName // 올바른 bucket_name으로 업데이트
            })
            .eq('id', project.id)
          
          refreshedProject = { ...project, thumbnail_url: signedData.signedUrl, original_bucket_name: bucketName }
        }
      } catch (e) {
        console.error('Failed to refresh thumbnail URL:', e)
      }
    }

    // original_image_url 갱신
    const needsOriginalRefresh = !project.original_image_url || 
      (project.original_image_url && isUrlExpired(project.original_image_url))
    
    if (needsOriginalRefresh && project.original_image_path) {
      try {
        // 버킷 이름 결정: DB 값 우선, URL에서 추출한 값 fallback
        let bucketName = refreshedProject.original_bucket_name || project.original_bucket_name || 'generated-images'
        
        // DB의 original_bucket_name이 잘못되었을 수 있으므로, URL에서 버킷 이름 추출 시도
        if (project.original_image_url) {
          const urlBucketName = extractBucketName(project.original_image_url)
          if (urlBucketName) {
            bucketName = urlBucketName
          }
        }
        
        const { data: signedData } = await supabase.storage
          .from(bucketName)
          .createSignedUrl(project.original_image_path, 24 * 60 * 60)

        if (signedData?.signedUrl) {
          // DB 업데이트 (올바른 bucket_name도 함께 업데이트)
          await supabase
            .from('pensieve_projects')
            .update({ 
              original_image_url: signedData.signedUrl,
              original_bucket_name: bucketName // 올바른 bucket_name으로 업데이트
            })
            .eq('id', project.id)
          
          refreshedProject = { ...refreshedProject, original_image_url: signedData.signedUrl, original_bucket_name: bucketName }
        }
      } catch (e) {
        console.error('Failed to refresh original image URL:', e)
      }
    }

    // 슬라이드 조회
    const { data: slides, error: slidesError } = await supabase
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
      .eq('project_id', id)
      .order('slide_index', { ascending: true })

    if (slidesError) throw slidesError

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

    return NextResponse.json({
      project: refreshedProject,
      slides: refreshedSlides
    })

  } catch (error) {
    console.error('[PROJECTS] GET [id] error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch project' },
      { status: 500 }
    )
  }
}

// PUT /api/pensieve/projects/[id] - 프로젝트 업데이트
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const {
      name,
      thumbnailUrl,
      thumbnailPath,
      prompt,
      aiPrompt,
      aiJsonPrompt,
      selectedModel,
      isPublic
    } = body

    // 프로젝트 소유권 확인 및 업데이트
    const { data: project, error } = await supabase
      .from('pensieve_projects')
      .update({
        ...(name !== undefined && { name }),
        ...(thumbnailUrl !== undefined && { thumbnail_url: thumbnailUrl }),
        ...(thumbnailPath !== undefined && { thumbnail_path: thumbnailPath }),
        ...(prompt !== undefined && { prompt }),
        ...(aiPrompt !== undefined && { ai_prompt: aiPrompt }),
        ...(aiJsonPrompt !== undefined && { ai_json_prompt: aiJsonPrompt }),
        ...(selectedModel !== undefined && { selected_model: selectedModel }),
        ...(isPublic !== undefined && { is_public: isPublic })
      })
      .eq('id', id)
      .eq('user_id', user.id) // 소유권 확인
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Project not found or not owned by user' }, { status: 404 })
      }
      throw error
    }

    return NextResponse.json({
      success: true,
      project
    })

  } catch (error) {
    console.error('[PROJECTS] PUT [id] error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update project' },
      { status: 500 }
    )
  }
}

// PATCH /api/pensieve/projects/[id] - 프로젝트 타임스탬프 업데이트 (편집 모드 진입 시)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { updateTimestamp } = body

    // updated_at만 업데이트 (편집 모드 진입 시)
    if (updateTimestamp) {
      const { data: project, error } = await supabase
        .from('pensieve_projects')
        .update({
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('user_id', user.id) // 소유권 확인
        .select()
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          return NextResponse.json({ error: 'Project not found or not owned by user' }, { status: 404 })
        }
        throw error
      }

      // 브로드캐스트 채널을 통해 프로젝트 목록 갱신 요청
      // (이 부분은 클라이언트에서 처리하므로 여기서는 업데이트만 수행)

      return NextResponse.json({
        success: true,
        project
      })
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  } catch (error) {
    console.error('[PROJECTS] PATCH [id] error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update project timestamp' },
      { status: 500 }
    )
  }
}

// DELETE /api/pensieve/projects/[id] - 프로젝트 삭제
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 프로젝트 정보 조회 (스토리지 파일 삭제용) - 삭제 전에 정보를 먼저 가져와야 함
    const { data: project, error: projectFetchError } = await supabase
      .from('pensieve_projects')
      .select('thumbnail_path, original_image_path, original_bucket_name')
      .eq('id', id)
      .eq('user_id', user.id) // 소유권 확인
      .single()

    if (projectFetchError) {
      if (projectFetchError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Project not found or not owned by user' }, { status: 404 })
      }
      throw projectFetchError
    }

    // 프로젝트 및 관련 슬라이드 조회 (스토리지 파일 삭제용)
    const { data: slides } = await supabase
      .from('pensieve_project_slides')
      .select('image_path, bucket_name')
      .eq('project_id', id)

    // user_preferences에서 이 프로젝트를 참조하는 경우 확인 및 리셋
    // (프로젝트는 직접 배경으로 설정될 수 없지만, 안전을 위해 확인)
    const { data: preference } = await supabase
      .from('user_preferences')
      .select('id, selected_background_id, selected_background_type')
      .eq('user_id', user.id)
      .single()

    if (preference && 
        preference.selected_background_type === 'custom' && 
        preference.selected_background_id === id) {
      // 기본 배경으로 리셋
      await supabase
        .from('user_preferences')
        .update({
          selected_background_type: 'default',
          selected_background_id: 'default-1'
        })
        .eq('user_id', user.id)
    }

    // 프로젝트 삭제 (CASCADE로 슬라이드도 자동 삭제)
    const { error } = await supabase
      .from('pensieve_projects')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id) // 소유권 확인

    if (error) throw error

    // 스토리지에서 모든 관련 이미지 파일 삭제
    const mainBucketName = project.original_bucket_name || 'generated-images'
    
    // 버킷별로 파일 그룹화 (중복 제거를 위해 Set 사용)
    const filesByBucket: Record<string, Set<string>> = {}

    // 썸네일 이미지 추가
    if (project.thumbnail_path) {
      if (!filesByBucket[mainBucketName]) filesByBucket[mainBucketName] = new Set()
      filesByBucket[mainBucketName].add(project.thumbnail_path)
    }

    // 원본 이미지 추가
    if (project.original_image_path) {
      if (!filesByBucket[mainBucketName]) filesByBucket[mainBucketName] = new Set()
      filesByBucket[mainBucketName].add(project.original_image_path)
    }

    // 슬라이드 이미지 추가 (썸네일/원본과 중복될 수 있으므로 Set으로 중복 제거)
    if (slides && slides.length > 0) {
      slides.forEach(slide => {
        if (slide.image_path) {
          const slideBucket = slide.bucket_name || mainBucketName
          if (!filesByBucket[slideBucket]) filesByBucket[slideBucket] = new Set()
          filesByBucket[slideBucket].add(slide.image_path)
        }
      })
    }

    // 각 버킷에서 파일 삭제 (Set을 배열로 변환)
    const deletePromises = Object.entries(filesByBucket).map(async ([bucket, pathSet]) => {
      const paths = Array.from(pathSet)
        if (paths.length > 0) {
        try {
          await supabase.storage.from(bucket).remove(paths)
        } catch (err) {
          console.error(`Failed to delete files from bucket ${bucket}:`, err)
          // 에러가 발생해도 계속 진행 (일부 파일 삭제 실패해도 프로젝트는 삭제됨)
        }
      }
    })

    await Promise.all(deletePromises)

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('[PROJECTS] DELETE [id] error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete project' },
      { status: 500 }
    )
  }
}

