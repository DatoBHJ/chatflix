import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { DEFAULT_BACKGROUND_ID } from '@/app/photo/constants/backgrounds';
import path from 'path';
import fs from 'fs';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** images_metadata.json에서 id(UUID)로 path 조회. 없으면 null */
function resolveStaticPathFromId(staticId: string): string | null {
  try {
    const metadataPath = path.join(process.cwd(), 'public', 'wallpaper', 'Chatflix bg', 'images_metadata.json');
    const raw = fs.readFileSync(metadataPath, 'utf-8');
    const data: Record<string, { path?: string; id?: string }[]> = JSON.parse(raw);
    const arr = Object.values(data).flat();
    const found = arr.find((o) => o.id === staticId && o.path);
    return found?.path ?? null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    let userId: string | undefined;

    if (req.headers.get('content-type')?.includes('application/json')) {
      try {
        const body = await req.json();
        userId = body?.userId;
      } catch (jsonError) {
        // Ignore JSON parse errors and fall back to anonymous handling below
      }
    }

    if (!userId) {
      return NextResponse.json({
        backgroundType: 'default',
        backgroundId: DEFAULT_BACKGROUND_ID
      });
    }

    const supabase = await createClient();
    
    // Get user's preference first
    const { data: preference, error: prefError } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (prefError || !preference) {
      // No preference saved, return default
      return NextResponse.json({
        backgroundType: 'default',
        backgroundId: DEFAULT_BACKGROUND_ID
      });
    }

    // If it's a default background, just return the ID
    if (preference.selected_background_type === 'default') {
      return NextResponse.json({
        backgroundType: 'default',
        backgroundId: preference.selected_background_id
      });
    }

    // If it's a static background (Chatflix bg), return the public URL
    if (preference.selected_background_type === 'static') {
      let resolvedPath = (preference.selected_background_id ?? '').trim();
      if (!resolvedPath) {
        return NextResponse.json({
          backgroundType: 'default',
          backgroundId: DEFAULT_BACKGROUND_ID
        });
      }
      // 과거에 static 선택 시 id(UUID)가 저장된 경우: images_metadata에서 path로 변환
      if (UUID_REGEX.test(resolvedPath)) {
        const fromMetadata = resolveStaticPathFromId(resolvedPath);
        if (fromMetadata) resolvedPath = fromMetadata;
        else {
          return NextResponse.json({
            backgroundType: 'default',
            backgroundId: DEFAULT_BACKGROUND_ID
          });
        }
      }
      // Normalize to .jpeg for backward compat with DB records that have .png or .png.jpeg
      resolvedPath = resolvedPath.replace(/\.png\.jpeg$/i, '.jpeg').replace(/\.png$/i, '.jpeg').replace(/\.jpg$/i, '.jpeg');
      const raw = `/wallpaper/Chatflix bg/${resolvedPath}`;
      const backgroundUrl = encodeURI(raw);
      return NextResponse.json({
        backgroundType: 'custom',
        backgroundUrl,
        backgroundId: preference.selected_background_id
      });
    }

    // If it's a custom background, get the image details
    const { data: backgroundSettings, error: fetchError } = await supabase
      .from('user_background_settings')
      .select('*')
      .eq('id', preference.selected_background_id)
      .single();

    if (fetchError || !backgroundSettings) {
      // Custom background was deleted, fallback to default
      return NextResponse.json({
        backgroundType: 'default',
        backgroundId: DEFAULT_BACKGROUND_ID
      });
    }

    // Check if URL needs refresh (expires in less than 2 hours)
    const expiresAt = new Date(backgroundSettings.url_expires_at);
    const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000);
    
    if (expiresAt > twoHoursFromNow) {
      // URL is still valid, return current URL
      return NextResponse.json({
        backgroundType: 'custom',
        backgroundId: backgroundSettings.id,
        backgroundUrl: backgroundSettings.background_url
      });
    }

    // Get bucket name, default to 'background-images' for backward compatibility
    const bucketName = backgroundSettings.bucket_name || 'background-images';

    // Generate new signed URL from appropriate bucket
    const { data: signedData, error: signedError } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(backgroundSettings.background_path, 24 * 60 * 60);

    if (signedError || !signedData?.signedUrl) {
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
      .eq('id', backgroundSettings.id);

    if (updateError) {
      console.error('Failed to update background URL:', updateError);
      // Still return the new URL even if DB update fails
    }

    return NextResponse.json({
      backgroundType: 'custom',
      backgroundId: backgroundSettings.id,
      backgroundUrl: signedData.signedUrl
    });

  } catch (error) {
    console.error('Background URL refresh error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
