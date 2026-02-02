import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// NEW: Refresh generated images in tool_results
async function refreshGeneratedImages(supabase: any, tool_results: any): Promise<any> {
  if (!tool_results) return tool_results;
  
  const refreshed = { ...tool_results };
  
  // Refresh Gemini images
  if (refreshed.geminiImageResults && Array.isArray(refreshed.geminiImageResults)) {
    refreshed.geminiImageResults = await Promise.all(
      refreshed.geminiImageResults.map(async (img: any) => {
        const updates: any = {};
        
        // imageUrl 갱신 (기존)
        if (img.path && img.bucket === 'generated-images') {
          const { data: signedData, error } = await supabase.storage
            .from('generated-images')
            .createSignedUrl(img.path, 24 * 60 * 60);
          
          if (signedData?.signedUrl) {
            updates.imageUrl = signedData.signedUrl;
          }
        }
        
        // originalImageUrls 갱신 (배열 - 이미지 편집 시 사용된 소스 이미지)
        if (img.originalImageUrls && Array.isArray(img.originalImageUrls) && img.originalImageUrls.length > 0) {
          const refreshedOriginalUrls = await Promise.all(
            img.originalImageUrls.map(async (originalUrl: string) => {
              if (originalUrl && originalUrl.includes('generated-images')) {
                const imagePathMatch = originalUrl.match(/generated-images\/(.+?)\?/);
                if (imagePathMatch && imagePathMatch[1]) {
                  const imagePath = decodeURIComponent(imagePathMatch[1]);
                  const { data: signedData, error } = await supabase.storage
                    .from('generated-images')
                    .createSignedUrl(imagePath, 24 * 60 * 60);
                  
                  if (signedData?.signedUrl) {
                    return signedData.signedUrl;
                  }
                }
              }
              return originalUrl;
            })
          );
          updates.originalImageUrls = refreshedOriginalUrls;
        }
        
        // originalImageUrl 갱신 (단일 - fallback)
        if (img.originalImageUrl && !img.originalImageUrls && img.originalImageUrl.includes('generated-images')) {
          const imagePathMatch = img.originalImageUrl.match(/generated-images\/(.+?)\?/);
          if (imagePathMatch && imagePathMatch[1]) {
            const imagePath = decodeURIComponent(imagePathMatch[1]);
            const { data: signedData, error } = await supabase.storage
              .from('generated-images')
              .createSignedUrl(imagePath, 24 * 60 * 60);
            
            if (signedData?.signedUrl) {
              updates.originalImageUrl = signedData.signedUrl;
            }
          }
        }
        
        return Object.keys(updates).length > 0 ? { ...img, ...updates } : img;
      })
    );
  }
  
  // Refresh Seedream images
  if (refreshed.seedreamImageResults && Array.isArray(refreshed.seedreamImageResults)) {
    refreshed.seedreamImageResults = await Promise.all(
      refreshed.seedreamImageResults.map(async (img: any) => {
        const updates: any = {};
        
        // imageUrl 갱신 (기존)
        if (img.path && img.bucket === 'generated-images') {
          const { data: signedData, error } = await supabase.storage
            .from('generated-images')
            .createSignedUrl(img.path, 24 * 60 * 60);
          
          if (signedData?.signedUrl) {
            updates.imageUrl = signedData.signedUrl;
          }
        }
        
        // originalImageUrl 갱신 (이미지 편집 시 사용된 소스 이미지)
        if (img.originalImageUrl && img.originalImageUrl.includes('generated-images')) {
          const imagePathMatch = img.originalImageUrl.match(/generated-images\/(.+?)\?/);
          if (imagePathMatch && imagePathMatch[1]) {
            const imagePath = decodeURIComponent(imagePathMatch[1]);
            const { data: signedData, error } = await supabase.storage
              .from('generated-images')
              .createSignedUrl(imagePath, 24 * 60 * 60);
            
            if (signedData?.signedUrl) {
              updates.originalImageUrl = signedData.signedUrl;
            }
          }
        }
        
        return Object.keys(updates).length > 0 ? { ...img, ...updates } : img;
      })
    );
  }
  
  // Refresh Qwen images
  if (refreshed.qwenImageResults && Array.isArray(refreshed.qwenImageResults)) {
    refreshed.qwenImageResults = await Promise.all(
      refreshed.qwenImageResults.map(async (img: any) => {
        const updates: any = {};
        
        // imageUrl 갱신 (기존)
        if (img.path && img.bucket === 'generated-images') {
          const { data: signedData, error } = await supabase.storage
            .from('generated-images')
            .createSignedUrl(img.path, 24 * 60 * 60);
          
          if (signedData?.signedUrl) {
            updates.imageUrl = signedData.signedUrl;
          }
        }
        
        // originalImageUrl 갱신 (이미지 편집 시 사용된 소스 이미지)
        if (img.originalImageUrl && img.originalImageUrl.includes('generated-images')) {
          const imagePathMatch = img.originalImageUrl.match(/generated-images\/(.+?)\?/);
          if (imagePathMatch && imagePathMatch[1]) {
            const imagePath = decodeURIComponent(imagePathMatch[1]);
            const { data: signedData, error } = await supabase.storage
              .from('generated-images')
              .createSignedUrl(imagePath, 24 * 60 * 60);
            
            if (signedData?.signedUrl) {
              updates.originalImageUrl = signedData.signedUrl;
            }
          }
        }
        
        return Object.keys(updates).length > 0 ? { ...img, ...updates } : img;
      })
    );
  }
  
  // Refresh Wan 2.5 videos
  if (refreshed.wan25VideoResults && Array.isArray(refreshed.wan25VideoResults)) {
    refreshed.wan25VideoResults = await Promise.all(
      refreshed.wan25VideoResults.map(async (vid: any) => {
        const updates: any = {};
        
        // videoUrl 갱신 (기존 로직)
        if (vid.path && vid.bucket === 'generated-videos') {
          const { data: signedData, error } = await supabase.storage
            .from('generated-videos')
            .createSignedUrl(vid.path, 24 * 60 * 60);
          
          if (signedData?.signedUrl) {
            updates.videoUrl = signedData.signedUrl;
          }
        }
        
        // sourceImageUrl 갱신 (새로 추가)
        if (vid.sourceImageUrl && vid.sourceImageUrl.includes('generated-images')) {
          // URL에서 path 추출
          const imagePathMatch = vid.sourceImageUrl.match(/generated-images\/(.+?)\?/);
          if (imagePathMatch && imagePathMatch[1]) {
            const imagePath = decodeURIComponent(imagePathMatch[1]);
            const { data: signedData, error } = await supabase.storage
              .from('generated-images')
              .createSignedUrl(imagePath, 24 * 60 * 60);
            
            if (signedData?.signedUrl) {
              updates.sourceImageUrl = signedData.signedUrl;
            }
          }
        }
        
        return Object.keys(updates).length > 0 ? { ...vid, ...updates } : vid;
      })
    );
  }
  
  // Refresh Grok videos
  if (refreshed.grokVideoResults && Array.isArray(refreshed.grokVideoResults)) {
    refreshed.grokVideoResults = await Promise.all(
      refreshed.grokVideoResults.map(async (vid: any) => {
        const updates: any = {};
        if (vid.path && vid.bucket === 'generated-videos') {
          const { data: signedData } = await supabase.storage
            .from('generated-videos')
            .createSignedUrl(vid.path, 24 * 60 * 60);
          if (signedData?.signedUrl) updates.videoUrl = signedData.signedUrl;
        }
        if (vid.sourceImageUrl && vid.sourceImageUrl.includes('generated-images')) {
          const imagePathMatch = vid.sourceImageUrl.match(/generated-images\/(.+?)\?/);
          if (imagePathMatch?.[1]) {
            const imagePath = decodeURIComponent(imagePathMatch[1]);
            const { data: signedData } = await supabase.storage
              .from('generated-images')
              .createSignedUrl(imagePath, 24 * 60 * 60);
            if (signedData?.signedUrl) updates.sourceImageUrl = signedData.signedUrl;
          }
        }
        if (vid.sourceVideoUrl && vid.sourceVideoUrl.includes('generated-videos')) {
          const videoPathMatch = vid.sourceVideoUrl.match(/generated-videos\/(.+?)\?/);
          if (videoPathMatch?.[1]) {
            const videoPath = decodeURIComponent(videoPathMatch[1]);
            const { data: signedData } = await supabase.storage
              .from('generated-videos')
              .createSignedUrl(videoPath, 24 * 60 * 60);
            if (signedData?.signedUrl) updates.sourceVideoUrl = signedData.signedUrl;
          }
        }
        return Object.keys(updates).length > 0 ? { ...vid, ...updates } : vid;
      })
    );
  }
  
  return refreshed;
}

/**
 * parts 배열 내의 이미지/비디오 URL 갱신 함수
 * AI SDK v5 형식: tool-${toolName}, data-*_image_complete 등
 */
async function refreshPartsUrls(supabase: any, parts: any[]): Promise<{ parts: any[]; changed: boolean }> {
  if (!parts || !Array.isArray(parts) || parts.length === 0) {
    return { parts, changed: false };
  }
  
  let changed = false;
  
  const refreshedParts = await Promise.all(parts.map(async (part: any) => {
    // 1. tool-* 이미지 도구 결과 처리 (output.images)
    if (part.type?.startsWith('tool-') && part.output?.images && Array.isArray(part.output.images)) {
      const refreshedImages = await Promise.all(part.output.images.map(async (img: any) => {
        const updates: any = {};
        
        // imageUrl 갱신 (기존)
        if (img.path && (img.bucket === 'generated-images' || img.imageUrl?.includes('generated-images'))) {
          const { data: signedData, error } = await supabase.storage
            .from('generated-images')
            .createSignedUrl(img.path, 24 * 60 * 60);
          
          if (signedData?.signedUrl && signedData.signedUrl !== img.imageUrl) {
            changed = true;
            updates.imageUrl = signedData.signedUrl;
          }
        }
        
        // originalImageUrls 갱신 (배열 - Gemini 이미지 편집 시)
        if (img.originalImageUrls && Array.isArray(img.originalImageUrls) && img.originalImageUrls.length > 0) {
          const refreshedOriginalUrls = await Promise.all(
            img.originalImageUrls.map(async (originalUrl: string) => {
              if (originalUrl && originalUrl.includes('generated-images')) {
                const imagePathMatch = originalUrl.match(/generated-images\/(.+?)\?/);
                if (imagePathMatch && imagePathMatch[1]) {
                  const imagePath = decodeURIComponent(imagePathMatch[1]);
                  const { data: signedData, error } = await supabase.storage
                    .from('generated-images')
                    .createSignedUrl(imagePath, 24 * 60 * 60);
                  
                  if (signedData?.signedUrl && signedData.signedUrl !== originalUrl) {
                    changed = true;
                    return signedData.signedUrl;
                  }
                }
              }
              return originalUrl;
            })
          );
          updates.originalImageUrls = refreshedOriginalUrls;
        }
        
        // originalImageUrl 갱신 (단일 - Seedream, Qwen 이미지 편집 시)
        if (img.originalImageUrl && !img.originalImageUrls && img.originalImageUrl.includes('generated-images')) {
          const imagePathMatch = img.originalImageUrl.match(/generated-images\/(.+?)\?/);
          if (imagePathMatch && imagePathMatch[1]) {
            const imagePath = decodeURIComponent(imagePathMatch[1]);
            const { data: signedData, error } = await supabase.storage
              .from('generated-images')
              .createSignedUrl(imagePath, 24 * 60 * 60);
            
            if (signedData?.signedUrl && signedData.signedUrl !== img.originalImageUrl) {
              changed = true;
              updates.originalImageUrl = signedData.signedUrl;
            }
          }
        }
        
        return Object.keys(updates).length > 0 ? { ...img, ...updates } : img;
      }));
      
      return {
        ...part,
        output: { ...part.output, images: refreshedImages }
      };
    }
    
    // 2. tool-wan25_* / tool-grok_* 비디오 도구 결과 처리 (output.videos)
    if ((part.type?.startsWith('tool-wan25_') || part.type?.startsWith('tool-grok_')) && part.output?.videos && Array.isArray(part.output.videos)) {
      const refreshedVideos = await Promise.all(part.output.videos.map(async (vid: any) => {
        const updates: any = {};
        
        // videoUrl 갱신 (기존)
        if (vid.path && (vid.bucket === 'generated-videos' || vid.videoUrl?.includes('generated-videos'))) {
          const { data: signedData, error } = await supabase.storage
            .from('generated-videos')
            .createSignedUrl(vid.path, 24 * 60 * 60);
          
          if (signedData?.signedUrl && signedData.signedUrl !== vid.videoUrl) {
            changed = true;
            updates.videoUrl = signedData.signedUrl;
          }
        }
        
        // sourceImageUrl 갱신 (새로 추가)
        if (vid.sourceImageUrl && vid.sourceImageUrl.includes('generated-images')) {
          const imagePathMatch = vid.sourceImageUrl.match(/generated-images\/(.+?)\?/);
          if (imagePathMatch && imagePathMatch[1]) {
            const imagePath = decodeURIComponent(imagePathMatch[1]);
            const { data: signedData, error } = await supabase.storage
              .from('generated-images')
              .createSignedUrl(imagePath, 24 * 60 * 60);
            
            if (signedData?.signedUrl && signedData.signedUrl !== vid.sourceImageUrl) {
              changed = true;
              updates.sourceImageUrl = signedData.signedUrl;
            }
          }
        }
        
        return Object.keys(updates).length > 0 ? { ...vid, ...updates } : vid;
      }));
      
      return {
        ...part,
        output: { ...part.output, videos: refreshedVideos }
      };
    }
    
    // 3. data-*_image_complete annotation 처리
    if ((part.type === 'data-seedream_image_complete' || part.type === 'data-gemini_image_complete' || part.type === 'data-qwen_image_complete') && part.data?.path) {
      const updates: any = {};
      
      // imageUrl 갱신 (기존)
      const { data: signedData, error } = await supabase.storage
        .from('generated-images')
        .createSignedUrl(part.data.path, 24 * 60 * 60);
      
      if (signedData?.signedUrl && signedData.signedUrl !== part.data.imageUrl) {
        changed = true;
        updates.imageUrl = signedData.signedUrl;
      }
      
      // originalImageUrls 갱신 (배열 - Gemini 이미지 편집 시)
      if (part.data.originalImageUrls && Array.isArray(part.data.originalImageUrls) && part.data.originalImageUrls.length > 0) {
        const refreshedOriginalUrls = await Promise.all(
          part.data.originalImageUrls.map(async (originalUrl: string) => {
            if (originalUrl && originalUrl.includes('generated-images')) {
              const imagePathMatch = originalUrl.match(/generated-images\/(.+?)\?/);
              if (imagePathMatch && imagePathMatch[1]) {
                const imagePath = decodeURIComponent(imagePathMatch[1]);
                const { data: signedData, error } = await supabase.storage
                  .from('generated-images')
                  .createSignedUrl(imagePath, 24 * 60 * 60);
                
                if (signedData?.signedUrl && signedData.signedUrl !== originalUrl) {
                  changed = true;
                  return signedData.signedUrl;
                }
              }
            }
            return originalUrl;
          })
        );
        updates.originalImageUrls = refreshedOriginalUrls;
      }
      
      // originalImageUrl 갱신 (단일 - Seedream, Qwen 이미지 편집 시)
      if (part.data.originalImageUrl && !part.data.originalImageUrls && part.data.originalImageUrl.includes('generated-images')) {
        const imagePathMatch = part.data.originalImageUrl.match(/generated-images\/(.+?)\?/);
        if (imagePathMatch && imagePathMatch[1]) {
          const imagePath = decodeURIComponent(imagePathMatch[1]);
          const { data: imageSignedData, error } = await supabase.storage
            .from('generated-images')
            .createSignedUrl(imagePath, 24 * 60 * 60);
          
          if (imageSignedData?.signedUrl && imageSignedData.signedUrl !== part.data.originalImageUrl) {
            changed = true;
            updates.originalImageUrl = imageSignedData.signedUrl;
          }
        }
      }
      
      if (Object.keys(updates).length > 0) {
        return {
          ...part,
          data: { ...part.data, ...updates }
        };
      }
    }
    
    // 4. data-wan25_video_complete / data-grok_video_complete annotation 처리
    if ((part.type === 'data-wan25_video_complete' || part.type === 'data-grok_video_complete') && part.data?.path) {
      const updates: any = {};
      const { data: signedData } = await supabase.storage
        .from('generated-videos')
        .createSignedUrl(part.data.path, 24 * 60 * 60);
      if (signedData?.signedUrl && signedData.signedUrl !== part.data.videoUrl) {
        changed = true;
        updates.videoUrl = signedData.signedUrl;
      }
      if (part.data.sourceImageUrl && part.data.sourceImageUrl.includes('generated-images')) {
        const imagePathMatch = part.data.sourceImageUrl.match(/generated-images\/(.+?)\?/);
        if (imagePathMatch?.[1]) {
          const imagePath = decodeURIComponent(imagePathMatch[1]);
          const { data: imageSignedData } = await supabase.storage
            .from('generated-images')
            .createSignedUrl(imagePath, 24 * 60 * 60);
          if (imageSignedData?.signedUrl && imageSignedData.signedUrl !== part.data.sourceImageUrl) {
            changed = true;
            updates.sourceImageUrl = imageSignedData.signedUrl;
          }
        }
      }
      if (part.data.sourceVideoUrl && part.data.sourceVideoUrl.includes('generated-videos')) {
        const videoPathMatch = part.data.sourceVideoUrl.match(/generated-videos\/(.+?)\?/);
        if (videoPathMatch?.[1]) {
          const videoPath = decodeURIComponent(videoPathMatch[1]);
          const { data: videoSignedData } = await supabase.storage
            .from('generated-videos')
            .createSignedUrl(videoPath, 24 * 60 * 60);
          if (videoSignedData?.signedUrl && videoSignedData.signedUrl !== part.data.sourceVideoUrl) {
            changed = true;
            updates.sourceVideoUrl = videoSignedData.signedUrl;
          }
        }
      }
      if (Object.keys(updates).length > 0) {
        return {
          ...part,
          data: { ...part.data, ...updates }
        };
      }
    }
    
    return part;
  }));
  
  return { parts: refreshedParts, changed };
}

/**
 * 만료된 첨부파일 URL을 갱신하는 API
 * 클라이언트에서 호출하여 DB의 URL을 갱신
 */
export async function POST(req: NextRequest) {
  try {
    const { messageId, chatId, userId } = await req.json();

    if (!messageId || !chatId || !userId) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // 1. 현재 메시지의 첨부파일, tool_results, parts 가져오기
    const { data: message, error: fetchError } = await supabase
      .from('messages')
      .select('experimental_attachments, tool_results, parts')
      .eq('id', messageId)
      .eq('chat_session_id', chatId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !message) {
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      );
    }

    const attachments = message.experimental_attachments;
    const toolResults = message.tool_results;
    const parts = message.parts;
    
    // Check if there are any data to refresh
    const hasAttachments = attachments && Array.isArray(attachments) && attachments.length > 0;
    const hasToolResults = toolResults && typeof toolResults === 'object';
    const hasParts = parts && Array.isArray(parts) && parts.length > 0;
    
    if (!hasAttachments && !hasToolResults && !hasParts) {
      return NextResponse.json({ success: true, message: 'No attachments or generated media to refresh' });
    }

    // 2. 각 첨부파일의 URL을 갱신 (기존 로직)
    let refreshedAttachments = attachments;
    if (hasAttachments) {
      refreshedAttachments = await Promise.all(
        attachments.map(async (attachment: any) => {
          const url = attachment.url;
          
          // Supabase Storage URL이 아니면 갱신 불필요
          if (!url || !url.includes('supabase.co/storage/v1/object/sign/')) {
            return attachment;
          }

          try {
            // path 필드가 있으면 직접 사용 (더 안전하고 효율적)
            // 없을 때만 URL에서 추출 (하위 호환성)
            let filePath = attachment.path;
            
            if (!filePath) {
              // URL에서 파일 경로 추출
              filePath = url.split('chat_attachments/')[1]?.split('?')[0];
            }
            
            if (!filePath) {
              console.error('Failed to extract file path from attachment:', attachment.name);
              return attachment;
            }

            // 새로운 Signed URL 생성
            const { data: signedData, error: signedError } = await supabase.storage
              .from('chat_attachments')
              .createSignedUrl(filePath, 24 * 60 * 60); // 24시간

            if (signedError || !signedData?.signedUrl) {
              console.error('Failed to create signed URL for:', filePath, signedError);
              return attachment;
            }

            console.log('✅ [URL_REFRESH_API] Refreshed URL for:', attachment.name);
            
            // 갱신된 URL로 첨부파일 객체 업데이트
            return {
              ...attachment,
              url: signedData.signedUrl,
              // path 필드가 없었으면 추가 (향후 갱신 시 효율성 향상)
              path: attachment.path || filePath
            };
          } catch (error) {
            console.error('Error refreshing URL for attachment:', attachment.name, error);
            return attachment;
          }
        })
      );
    }

    // 3. 생성된 이미지의 URL을 갱신 (tool_results - 레거시)
    let refreshedToolResults = toolResults;
    if (hasToolResults) {
      refreshedToolResults = await refreshGeneratedImages(supabase, toolResults);
    }

    // 4. 🔥 parts 배열 내의 이미지/비디오 URL 갱신 (AI SDK v5)
    let refreshedParts = parts;
    let partsChanged = false;
    if (hasParts) {
      const result = await refreshPartsUrls(supabase, parts);
      refreshedParts = result.parts;
      partsChanged = result.changed;
    }

    // 5. 데이터베이스에 갱신된 데이터 저장
    const updateData: any = {};
    if (hasAttachments) updateData.experimental_attachments = refreshedAttachments;
    if (hasToolResults) updateData.tool_results = refreshedToolResults;
    if (partsChanged) updateData.parts = refreshedParts;

    if (Object.keys(updateData).length > 0) {
    const { error: updateError } = await supabase
      .from('messages')
      .update(updateData)
      .eq('id', messageId)
      .eq('chat_session_id', chatId)
      .eq('user_id', userId);

    if (updateError) {
      console.error('Failed to update message with refreshed URLs:', updateError);
      return NextResponse.json(
        { error: 'Failed to update message' },
        { status: 500 }
      );
      }
    }

    console.log('✅ [URL_REFRESH_API] Successfully refreshed all URLs for message:', messageId);

    const response: any = { success: true };
    if (hasAttachments) response.attachmentsRefreshed = refreshedAttachments.length;
    if (hasToolResults) response.generatedImagesRefreshed = true;
    if (partsChanged) response.partsRefreshed = true;

    return NextResponse.json(response);

  } catch (error) {
    console.error('URL refresh API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

