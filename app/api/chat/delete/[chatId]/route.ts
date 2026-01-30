import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// Storage URL에서 파일 경로 추출
function extractStoragePath(url: string, bucketName: string): string | null {
  if (!url || !url.includes(bucketName)) return null;
  
  try {
    // URL 패턴: .../bucketName/FILE_PATH?token=... 또는 .../bucketName/FILE_PATH
    const path = url.split(`${bucketName}/`)[1]?.split('?')[0];
    return path || null;
  } catch (error) {
    console.error(`Error extracting path from URL: ${url}`, error);
    return null;
  }
}

// 메시지에서 모든 Storage 파일 경로 수집
function collectStorageFiles(messages: any[]): {
  chatAttachments: string[];
  generatedImages: Array<{ path: string, bucket: string }>;
} {
  const chatAttachments: string[] = [];
  const generatedImages: Array<{ path: string, bucket: string }> = [];

  for (const message of messages) {
    // 1. experimental_attachments에서 chat_attachments 파일 수집
    if (message.experimental_attachments && Array.isArray(message.experimental_attachments)) {
      for (const attachment of message.experimental_attachments) {
        if (attachment.path) {
          // path 필드가 있으면 직접 사용
          chatAttachments.push(attachment.path);
        } else if (attachment.url) {
          // path가 없으면 URL에서 추출
          const path = extractStoragePath(attachment.url, 'chat_attachments');
          if (path) chatAttachments.push(path);
        }
      }
    }

    // 2. tool_results에서 generated-images URL 수집 (재귀 검색)
    if (message.tool_results && typeof message.tool_results === 'object') {
      // tool_results는 복잡한 구조일 수 있으므로 재귀적으로 검색
      const searchForImageUrls = (obj: any): void => {
        if (typeof obj === 'string') {
          // Support both old and new bucket names
          if (obj.includes('generated-images') || obj.includes('gemini-images')) {
            const bucket = obj.includes('generated-images') ? 'generated-images' : 'gemini-images';
            const path = extractStoragePath(obj, bucket);
            if (path) generatedImages.push({ path, bucket });
          }
        } else if (typeof obj === 'object' && obj !== null) {
          Object.values(obj).forEach(value => searchForImageUrls(value));
        }
      };
      searchForImageUrls(message.tool_results);
    }
  }

  // 중복 제거
  const uniqueGeneratedImages = generatedImages.filter((img, index, self) => 
    index === self.findIndex((i) => i.path === img.path && i.bucket === img.bucket)
  );

  return {
    chatAttachments: [...new Set(chatAttachments)],
    generatedImages: uniqueGeneratedImages
  };
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const { chatId } = await params;
    
    if (!chatId) {
      return NextResponse.json({ error: 'Chat ID is required' }, { status: 400 });
    }

    const supabase = await createClient();
    
    // 1. 사용자 인증 확인
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. chatId 소유권 검증
    const { data: chatSession, error: chatError } = await supabase
      .from('chat_sessions')
      .select('id, user_id')
      .eq('id', chatId)
      .eq('user_id', user.id)
      .single();

    if (chatError || !chatSession) {
      return NextResponse.json({ error: 'Chat not found or access denied' }, { status: 403 });
    }

    // 3. 모든 메시지 조회 (experimental_attachments, tool_results 포함)
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('id, experimental_attachments, tool_results')
      .eq('chat_session_id', chatId)
      .eq('user_id', user.id);

    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
      return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
    }

    // 4. Storage 파일 경로 수집
    const { chatAttachments, generatedImages } = collectStorageFiles(messages || []);

    // 5. Storage 파일 삭제 (bucket별 일괄 처리)
    const storageErrors: string[] = [];

    // chat_attachments 삭제
    if (chatAttachments.length > 0) {
      try {
        const { error: chatAttachmentsError } = await supabase.storage
          .from('chat_attachments')
          .remove(chatAttachments);

        if (chatAttachmentsError) {
          storageErrors.push(`chat_attachments: ${chatAttachmentsError.message}`);
        }
      } catch (error) {
        storageErrors.push(`chat_attachments: ${error}`);
      }
    }

    // generated-images 삭제 (both old and new buckets)
    if (generatedImages.length > 0) {
      // Group by bucket
      const imagesByBucket = generatedImages.reduce((acc, { path, bucket }) => {
        if (!acc[bucket]) acc[bucket] = [];
        acc[bucket].push(path);
        return acc;
      }, {} as Record<string, string[]>);
      
      // Delete from each bucket
      for (const [bucket, paths] of Object.entries(imagesByBucket)) {
        try {
          const { error } = await supabase.storage
            .from(bucket)
            .remove(paths);
          
          if (error) {
            storageErrors.push(`${bucket}: ${error.message}`);
          }
        } catch (error) {
          storageErrors.push(`${bucket}: ${error}`);
        }
      }
    }

    // 6. 메시지 테이블 삭제
    const { error: deleteMessagesError } = await supabase
      .from('messages')
      .delete()
      .eq('chat_session_id', chatId)
      .eq('user_id', user.id);

    if (deleteMessagesError) {
      console.error('Error deleting messages:', deleteMessagesError);
      return NextResponse.json({ error: 'Failed to delete messages' }, { status: 500 });
    }

    // 7. chat_sessions 테이블 삭제
    const { error: deleteChatError } = await supabase
      .from('chat_sessions')
      .delete()
      .eq('id', chatId)
      .eq('user_id', user.id);

    if (deleteChatError) {
      console.error('Error deleting chat session:', deleteChatError);
      return NextResponse.json({ error: 'Failed to delete chat session' }, { status: 500 });
    }

    // 8. 성공 응답 (Storage 에러가 있어도 DB 삭제는 성공으로 간주)
    const response: any = { 
      success: true, 
      message: 'Chat deleted successfully',
      deletedFiles: {
        chatAttachments: chatAttachments.length,
        generatedImages: generatedImages.length
      }
    };

    if (storageErrors.length > 0) {
      response.warnings = storageErrors;
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error in DELETE /api/chat/delete/[chatId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
