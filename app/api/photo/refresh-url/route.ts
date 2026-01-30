import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const { imageId, userId } = await req.json();
    
    if (!imageId || !userId) {
      return NextResponse.json({ error: 'Image ID and User ID are required' }, { status: 400 });
    }

    const supabase = await createClient();
    
    // Get image from database (removed source filter to support all source types)
    const { data: image, error: fetchError } = await supabase
      .from('user_background_settings')
      .select('*')
      .eq('id', imageId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !image) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }

    // Validate background_path exists
    if (!image.background_path) {
      console.error('Background path is missing for image:', imageId);
      return NextResponse.json({ error: 'Background path is missing' }, { status: 400 });
    }

    // Determine bucket name based on source or use default
    const bucketName = image.bucket_name || 
      (image.source === 'upload' ? 'chat_attachments' : 'saved-gallery');

    // Generate new signed URL using correct bucket
    const { data: signedData, error: signedError } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(image.background_path, 24 * 60 * 60);

    if (signedError || !signedData?.signedUrl) {
      console.error('Failed to create signed URL:', signedError, 'for path:', image.background_path, 'bucket:', bucketName);
      return NextResponse.json({ error: 'Failed to generate signed URL' }, { status: 500 });
    }

    // Update database with new URL
    const newExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const { error: updateError } = await supabase
      .from('user_background_settings')
      .update({
        background_url: signedData.signedUrl,
        url_expires_at: newExpiresAt.toISOString()
      })
      .eq('id', imageId);

    if (updateError) {
      console.error('Failed to update background URL:', updateError);
      // Still return the new URL even if DB update fails
    }

    return NextResponse.json({
      success: true,
      imageUrl: signedData.signedUrl
    });

  } catch (error) {
    console.error('Photo URL refresh error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
