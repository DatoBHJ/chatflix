import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const { videoUrl, prompt, ai_prompt, ai_json_prompt, appContext, original_user_id, metadata, chatId, messageId } = await req.json();
    
    if (!videoUrl || typeof videoUrl !== 'string') {
      return NextResponse.json({ error: 'Invalid video URL' }, { status: 400 });
    }

    // Validate URL format
    try {
      new URL(videoUrl);
    } catch {
      return NextResponse.json({ error: 'Invalid video URL format' }, { status: 400 });
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
    const urlHash = crypto.createHash('md5').update(videoUrl).digest('hex');
    const { data: existing } = await supabase
      .from('user_background_settings')
      .select('id')
      .eq('user_id', user.id)
      .eq('source', source)
      .eq('name', urlHash)
      .single();

    if (existing) {
      return NextResponse.json({ error: 'Video already saved' }, { status: 409 });
    }

    // Download video from external URL
    let response: Response;
    try {
      response = await fetch(videoUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ChatApp/1.0)',
        },
      });
    } catch (error) {
      return NextResponse.json({ error: 'Failed to download video' }, { status: 403 });
    }

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to download video' }, { status: 403 });
    }

    // Get content type and validate
    const contentType = response.headers.get('content-type') || 'video/mp4';
    if (!contentType.startsWith('video/')) {
      return NextResponse.json({ error: 'URL does not point to a video' }, { status: 415 });
    }

    // Check supported formats
    const supportedTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];
    if (!supportedTypes.includes(contentType)) {
      return NextResponse.json({ error: 'Unsupported video format' }, { status: 415 });
    }

    // Get content length
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > 100 * 1024 * 1024) {
      return NextResponse.json({ error: 'Video too large (max 100MB)' }, { status: 413 });
    }

    // Convert to buffer
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Check actual size
    if (buffer.length > 100 * 1024 * 1024) {
      return NextResponse.json({ error: 'Video too large (max 100MB)' }, { status: 413 });
    }

    // Generate unique filename with proper extension
    const ext = contentType.split('/')[1] || 'mp4';
    // Handle special cases
    let fileExt = ext;
    if (contentType === 'video/quicktime') {
      fileExt = 'mov';
    } else if (contentType === 'video/x-msvideo') {
      fileExt = 'avi';
    } else {
      fileExt = ext;
    }
    
    const timestamp = Date.now();
    const randomHash = crypto.randomBytes(8).toString('hex');
    const filename = `video_${timestamp}_${randomHash}.${fileExt}`;
    const filePath = `${user.id}/${filename}`;

    // Upload to Supabase Storage (use saved-gallery bucket, same as images)
    const { error: uploadError } = await supabase.storage
      .from('saved-gallery')
      .upload(filePath, buffer, { 
        contentType,
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return NextResponse.json({ error: 'Failed to upload video' }, { status: 500 });
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
    // Store video metadata to distinguish from images
    const videoMetadata = {
      ...(metadata || {}),
      mediaType: 'video',
      contentType: contentType,
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
        name: `Saved Video ${timestamp}`,
        prompt: prompt || null,
        ai_prompt: ai_prompt || null,
        ai_json_prompt: ai_json_prompt || null,
        metadata: videoMetadata,
        // 원본 업로더의 user_id를 저장 (표시용)
        ...(original_user_id && { user_id: original_user_id })
      })
      .select()
      .single();

    if (insertError) {
      // Cleanup uploaded file
      await supabase.storage.from('saved-gallery').remove([filePath]);
      console.error('Database insert error:', insertError);
      return NextResponse.json({ error: 'Failed to save video' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      videoId: insertData.id,
      videoUrl: signedData.signedUrl 
    });

  } catch (error) {
    console.error('Save video error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
