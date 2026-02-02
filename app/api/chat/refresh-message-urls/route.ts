import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * tool_results의 생성된 이미지 URL 갱신 함수
 */
async function refreshGeneratedImages(supabase: any, tool_results: any): Promise<any> {
  if (!tool_results) return tool_results;
  
  const refreshed = { ...tool_results };
  
  // Refresh Gemini images
  if (refreshed.geminiImageResults && Array.isArray(refreshed.geminiImageResults)) {
    refreshed.geminiImageResults = await Promise.all(
      refreshed.geminiImageResults.map(async (img: any) => {
        if (img.path && img.bucket === 'generated-images') {
          const { data: signedData, error } = await supabase.storage
            .from('generated-images')
            .createSignedUrl(img.path, 24 * 60 * 60);
          
          if (signedData?.signedUrl) {
            return { ...img, imageUrl: signedData.signedUrl };
          }
        }
        return img; // Fallback for old public URLs
      })
    );
  }
  
  // Refresh Seedream images
  if (refreshed.seedreamImageResults && Array.isArray(refreshed.seedreamImageResults)) {
    refreshed.seedreamImageResults = await Promise.all(
      refreshed.seedreamImageResults.map(async (img: any) => {
        if (img.path && img.bucket === 'generated-images') {
          const { data: signedData, error } = await supabase.storage
            .from('generated-images')
            .createSignedUrl(img.path, 24 * 60 * 60);
          
          if (signedData?.signedUrl) {
            return { ...img, imageUrl: signedData.signedUrl };
          }
        }
        return img; // Fallback for old public URLs
      })
    );
  }
  
  // Refresh Qwen images
  if (refreshed.qwenImageResults && Array.isArray(refreshed.qwenImageResults)) {
    refreshed.qwenImageResults = await Promise.all(
      refreshed.qwenImageResults.map(async (img: any) => {
        if (img.path && img.bucket === 'generated-images') {
          const { data: signedData, error } = await supabase.storage
            .from('generated-images')
            .createSignedUrl(img.path, 24 * 60 * 60);
          
          if (signedData?.signedUrl) {
            return { ...img, imageUrl: signedData.signedUrl };
          }
        }
        return img;
      })
    );
  }
  
  // Refresh Wan 2.5 videos
  if (refreshed.wan25VideoResults && Array.isArray(refreshed.wan25VideoResults)) {
    refreshed.wan25VideoResults = await Promise.all(
      refreshed.wan25VideoResults.map(async (vid: any) => {
        if (vid.path && vid.bucket === 'generated-videos') {
          const { data: signedData, error } = await supabase.storage
            .from('generated-videos')
            .createSignedUrl(vid.path, 24 * 60 * 60);
          
          if (signedData?.signedUrl) {
            return { ...vid, videoUrl: signedData.signedUrl };
          }
        }
        return vid;
      })
    );
  }
  
  // Refresh Grok videos
  if (refreshed.grokVideoResults && Array.isArray(refreshed.grokVideoResults)) {
    refreshed.grokVideoResults = await Promise.all(
      refreshed.grokVideoResults.map(async (vid: any) => {
        const updates: any = { ...vid };
        if (vid.path && vid.bucket === 'generated-videos') {
          const { data: signedData } = await supabase.storage
            .from('generated-videos')
            .createSignedUrl(vid.path, 24 * 60 * 60);
          if (signedData?.signedUrl) updates.videoUrl = signedData.signedUrl;
        }
        return updates;
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
    // 1. tool-seedream_image_tool, tool-gemini_image_tool 또는 tool-qwen_image_edit 처리 (output.images)
    if (part.type?.startsWith('tool-') && part.output?.images && Array.isArray(part.output.images)) {
      const refreshedImages = await Promise.all(part.output.images.map(async (img: any) => {
        if (img.path && (img.bucket === 'generated-images' || img.imageUrl?.includes('generated-images'))) {
          const { data: signedData, error } = await supabase.storage
            .from('generated-images')
            .createSignedUrl(img.path, 24 * 60 * 60);
          
          if (signedData?.signedUrl && signedData.signedUrl !== img.imageUrl) {
            changed = true;
            return { ...img, imageUrl: signedData.signedUrl };
          }
        }
        return img;
      }));
      
      return {
        ...part,
        output: { ...part.output, images: refreshedImages }
      };
    }
    
    // 2. tool-wan25_* / tool-grok_* 처리 (output.videos)
    if ((part.type?.startsWith('tool-wan25_') || part.type?.startsWith('tool-grok_')) && part.output?.videos && Array.isArray(part.output.videos)) {
      const refreshedVideos = await Promise.all(part.output.videos.map(async (vid: any) => {
        if (vid.path && (vid.bucket === 'generated-videos' || vid.videoUrl?.includes('generated-videos'))) {
          const { data: signedData, error } = await supabase.storage
            .from('generated-videos')
            .createSignedUrl(vid.path, 24 * 60 * 60);
          
          if (signedData?.signedUrl && signedData.signedUrl !== vid.videoUrl) {
            changed = true;
            return { ...vid, videoUrl: signedData.signedUrl };
          }
        }
        return vid;
      }));
      
      return {
        ...part,
        output: { ...part.output, videos: refreshedVideos }
      };
    }
    
    // 3. data-seedream_image_complete, data-gemini_image_complete 또는 data-qwen_image_complete 처리
    if ((part.type === 'data-seedream_image_complete' || part.type === 'data-gemini_image_complete' || part.type === 'data-qwen_image_complete') && part.data?.path) {
      const { data: signedData, error } = await supabase.storage
        .from('generated-images')
        .createSignedUrl(part.data.path, 24 * 60 * 60);
      
      if (signedData?.signedUrl && signedData.signedUrl !== part.data.imageUrl) {
        changed = true;
        return {
          ...part,
          data: { ...part.data, imageUrl: signedData.signedUrl }
        };
      }
    }
    
    // 4. data-wan25_video_complete / data-grok_video_complete 처리
    if ((part.type === 'data-wan25_video_complete' || part.type === 'data-grok_video_complete') && part.data?.path) {
      const { data: signedData, error } = await supabase.storage
        .from('generated-videos')
        .createSignedUrl(part.data.path, 24 * 60 * 60);
      
      if (signedData?.signedUrl && signedData.signedUrl !== part.data.videoUrl) {
        changed = true;
        return {
          ...part,
          data: { ...part.data, videoUrl: signedData.signedUrl }
        };
      }
    }
    
    return part;
  }));
  
  return { parts: refreshedParts, changed };
}

/**
 * 메시지 로드 시 만료된 첨부파일 URL과 생성된 이미지 URL을 자동 갱신
 */
export async function POST(req: NextRequest) {
  try {
    const { chatId, userId } = await req.json();

    if (!chatId || !userId) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // 1. 채팅의 모든 메시지 가져오기 (tool_results + parts 모두 포함)
    const { data: messages, error: fetchError } = await supabase
      .from('messages')
      .select('id, chat_session_id, experimental_attachments, tool_results, parts')
      .eq('chat_session_id', chatId)
      .eq('user_id', userId);

    if (fetchError || !messages) {
      return NextResponse.json(
        { error: 'Failed to fetch messages' },
        { status: 500 }
      );
    }

    let refreshCount = 0;
    let toolResultsRefreshCount = 0;
    let partsRefreshCount = 0;

    // 2. 각 메시지의 첨부파일 및 생성된 이미지 URL 갱신
    for (const message of messages) {
      const attachments = message.experimental_attachments;
      const toolResults = message.tool_results;
      const parts = message.parts;
      
      let needsUpdate = false;
      let needsToolResultsUpdate = false;
      let needsPartsUpdate = false;
      let refreshedAttachments = attachments;
      let refreshedToolResults = toolResults;
      let refreshedParts = parts;

      // 2-1. 첨부파일 URL 갱신
      if (attachments && Array.isArray(attachments) && attachments.length > 0) {
        refreshedAttachments = await Promise.all(
          attachments.map(async (attachment: any) => {
            const url = attachment.url;
            
            // Supabase Storage signed URL이 아니면 갱신 불필요 (custom domain 포함: auth.chatflix.app 등)
            if (!url || !url.includes('/storage/v1/object/sign/')) {
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
                console.warn('Failed to extract file path from attachment:', attachment.name);
                return attachment;
              }

              // 새로운 Signed URL 생성
              const { data: signedData, error: signedError } = await supabase.storage
                .from('chat_attachments')
                .createSignedUrl(filePath, 24 * 60 * 60); // 24시간

              if (signedError || !signedData?.signedUrl) {
                console.warn('Failed to create signed URL for:', filePath, signedError);
                return attachment;
              }

              needsUpdate = true;
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

      // 2-2. 생성된 이미지 URL 갱신 (tool_results - 레거시)
      if (toolResults && typeof toolResults === 'object') {
        const originalToolResults = JSON.stringify(toolResults);
        refreshedToolResults = await refreshGeneratedImages(supabase, toolResults);
        const refreshedToolResultsStr = JSON.stringify(refreshedToolResults);
        
        // 실제로 변경되었는지 확인
        if (originalToolResults !== refreshedToolResultsStr) {
          needsToolResultsUpdate = true;
        }
      }
      
      // 2-3. 🔥 parts 배열 내의 이미지/비디오 URL 갱신 (AI SDK v5)
      if (parts && Array.isArray(parts) && parts.length > 0) {
        const { parts: newParts, changed } = await refreshPartsUrls(supabase, parts);
        if (changed) {
          refreshedParts = newParts;
          needsPartsUpdate = true;
        }
      }

      // 3. 갱신이 필요한 경우에만 DB 업데이트
      if (needsUpdate || needsToolResultsUpdate || needsPartsUpdate) {
        const updateData: any = {};
        if (needsUpdate) updateData.experimental_attachments = refreshedAttachments;
        if (needsToolResultsUpdate) updateData.tool_results = refreshedToolResults;
        if (needsPartsUpdate) updateData.parts = refreshedParts;

        await supabase
          .from('messages')
          .update(updateData)
          .eq('id', message.id)
          .eq('chat_session_id', chatId)
          .eq('user_id', userId);
        
        if (needsUpdate) refreshCount++;
        if (needsToolResultsUpdate) toolResultsRefreshCount++;
        if (needsPartsUpdate) partsRefreshCount++;
      }
    }

    return NextResponse.json({
      success: true,
      refreshedCount: refreshCount,
      toolResultsRefreshCount: toolResultsRefreshCount,
      partsRefreshCount: partsRefreshCount
    });

  } catch (error) {
    console.error('Error refreshing message URLs:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

