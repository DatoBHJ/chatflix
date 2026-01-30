import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const { imageUrl, prompt, ai_prompt, ai_json_prompt, appContext, original_user_id, metadata, chatId, messageId } = await req.json();
    
    if (!imageUrl || typeof imageUrl !== 'string') {
      return NextResponse.json({ error: 'Invalid image URL' }, { status: 400 });
    }

    // Validate URL format
    try {
      new URL(imageUrl);
    } catch {
      return NextResponse.json({ error: 'Invalid image URL format' }, { status: 400 });
    }

    const supabase = await createClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Determine source based on appContext
    const source = appContext === 'pensieve' ? 'pensieve_saved' : 'saved';
    
    // Check for duplicate by URL hash (optional)
    const urlHash = crypto.createHash('md5').update(imageUrl).digest('hex');
    const { data: existing } = await supabase
      .from('user_background_settings')
      .select('id')
      .eq('user_id', user.id)
      .eq('source', source)
      .eq('name', urlHash)
      .single();

    if (existing) {
      return NextResponse.json({ error: 'Image already saved' }, { status: 409 });
    }

    // Download image from external URL
    let response: Response;
    try {
      response = await fetch(imageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ChatApp/1.0)',
        },
      });
    } catch (error) {
      return NextResponse.json({ error: 'Failed to download image' }, { status: 403 });
    }

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to download image' }, { status: 403 });
    }

    // Get content type and validate
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    if (!contentType.startsWith('image/')) {
      return NextResponse.json({ error: 'URL does not point to an image' }, { status: 415 });
    }

    // Check supported formats
    const supportedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!supportedTypes.includes(contentType)) {
      return NextResponse.json({ error: 'Unsupported image format' }, { status: 415 });
    }

    // Get content length
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Image too large (max 10MB)' }, { status: 413 });
    }

    // Convert to buffer
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Check actual size
    if (buffer.length > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Image too large (max 10MB)' }, { status: 413 });
    }

    // Generate unique filename with proper extension
    const ext = contentType.split('/')[1] || 'jpg';
    const timestamp = Date.now();
    const randomHash = crypto.randomBytes(8).toString('hex');
    const filename = `image_${timestamp}_${randomHash}.${ext}`;
    const filePath = `${user.id}/${filename}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('saved-gallery')
      .upload(filePath, buffer, { 
        contentType,
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 });
    }

    // Generate signed URL
    const { data: signedData, error: signedError } = await supabase.storage
      .from('saved-gallery')
      .createSignedUrl(filePath, 24 * 60 * 60);

    if (signedError || !signedData?.signedUrl) {
      // Cleanup uploaded file
      await supabase.storage.from('saved-gallery').remove([filePath]);
      return NextResponse.json({ error: 'Failed to generate signed URL' }, { status: 500 });
    }

    // Insert into database
    // user_id: 저장한 사용자 (현재 사용자)
    // original_user_id가 있으면 원본 업로더의 user_id를 저장, 없으면 저장한 사용자의 user_id 사용
    const imageMetadata = {
      ...(metadata || {}),
      chatId: chatId || null,
      messageId: messageId || null
    };
    
    const { data: insertData, error: insertError } = await supabase
      .from('user_background_settings')
      .insert({
        user_id: user.id, // 저장한 사용자
        source: source,
        background_url: signedData.signedUrl,
        background_path: filePath,
        bucket_name: 'saved-gallery',
        url_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        name: `Saved Image ${timestamp}`,
        prompt: prompt || null,
        ai_prompt: ai_prompt || null,
        ai_json_prompt: ai_json_prompt || null,
        metadata: imageMetadata,
        // 원본 업로더의 user_id를 저장 (표시용)
        // 주의: 데이터베이스에 이 필드가 없으면 에러가 발생할 수 있음
        // 대신 user_id를 원본 업로더의 ID로 저장하되, 저장한 사용자 정보는 별도로 관리해야 함
        // 하지만 현재 스키마에서는 user_id가 소유자를 나타내므로, 원본 업로더 ID를 별도 필드에 저장하는 것이 좋음
        // 일단 user_id를 원본 업로더 ID로 저장 (original_user_id가 있는 경우)
        ...(original_user_id && { user_id: original_user_id })
      })
      .select()
      .single();

    if (insertError) {
      // Cleanup uploaded file
      await supabase.storage.from('saved-gallery').remove([filePath]);
      console.error('Database insert error:', insertError);
      return NextResponse.json({ error: 'Failed to save image' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      imageId: insertData.id,
      imageUrl: signedData.signedUrl 
    });

  } catch (error) {
    console.error('Save image error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
