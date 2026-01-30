import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

const SIGNED_URL_TTL_SECONDS = 24 * 60 * 60 // 24h

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const {
    imagePath,
    imageUrl,
    prompt,
    ai_prompt,
    ai_json_prompt,
    isPublic,
    fileName
  } = body

  if (!imagePath || !imageUrl || !fileName) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Determine bucket based on file path
  // pensieve_upload_ -> saved-gallery (user uploads)
  // generate_/edit_ -> generated-images (AI generated)
  const isGenerated = imagePath.includes('generate_') || imagePath.includes('edit_')
  const bucketName = isGenerated ? 'generated-images' : 'saved-gallery'

  // Refresh signed URL if needed
  let finalImageUrl = imageUrl
  try {
    const { data: signedData, error: signedError } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(imagePath, SIGNED_URL_TTL_SECONDS)

    if (!signedError && signedData?.signedUrl) {
      finalImageUrl = signedData.signedUrl
    }
  } catch (error) {
    console.error('Error refreshing signed URL:', error)
    // Continue with existing URL if refresh fails
  }

  // Insert DB record
  const { data: insertedData, error: insertError } = await supabase
    .from('user_background_settings')
    .insert({
      user_id: user.id,
      background_path: imagePath,
      background_url: finalImageUrl,
      url_expires_at: new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000).toISOString(),
      name: fileName,
      source: 'pensieve_saved',
      bucket_name: bucketName,
      prompt: prompt || null,
      ai_prompt: ai_prompt || null,
      ai_json_prompt: ai_json_prompt || null,
      is_public: isPublic ?? false
    })
    .select('id')
    .single()

  if (insertError) {
    console.error('DB insert error:', insertError)
    return NextResponse.json({ error: 'Failed to save metadata' }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    imageId: insertedData.id
  })
}








