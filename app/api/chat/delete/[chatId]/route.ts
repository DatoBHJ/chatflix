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
  geminiImages: string[];
} {
  const chatAttachments: string[] = [];
  const geminiImages: string[] = [];

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

    // 2. tool_results에서 gemini-images URL 수집 (재귀 검색)
    if (message.tool_results && typeof message.tool_results === 'object') {
      // tool_results는 복잡한 구조일 수 있으므로 재귀적으로 검색
      const searchForImageUrls = (obj: any): void => {
        if (typeof obj === 'string' && obj.includes('gemini-images')) {
          const path = extractStoragePath(obj, 'gemini-images');
          if (path) geminiImages.push(path);
        } else if (typeof obj === 'object' && obj !== null) {
          Object.values(obj).forEach(value => searchForImageUrls(value));
        }
      };
      searchForImageUrls(message.tool_results);
    }
  }

  // 중복 제거
  return {
    chatAttachments: [...new Set(chatAttachments)],
    geminiImages: [...new Set(geminiImages)]
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
    const { chatAttachments, geminiImages } = collectStorageFiles(messages || []);

    console.log(`🗑️ [DELETE_CHAT] Found files to delete:`, {
      chatId,
      chatAttachments: chatAttachments.length,
      geminiImages: geminiImages.length
    });

    // 5. Storage 파일 삭제 (bucket별 일괄 처리)
    const storageErrors: string[] = [];

    // chat_attachments 삭제
    if (chatAttachments.length > 0) {
      try {
        const { error: chatAttachmentsError } = await supabase.storage
          .from('chat_attachments')
          .remove(chatAttachments);

        if (chatAttachmentsError) {
          console.warn('⚠️ [DELETE_CHAT] Failed to delete chat attachments:', chatAttachmentsError);
          storageErrors.push(`chat_attachments: ${chatAttachmentsError.message}`);
        } else {
          console.log(`✅ [DELETE_CHAT] Deleted ${chatAttachments.length} chat attachments`);
        }
      } catch (error) {
        console.warn('⚠️ [DELETE_CHAT] Error deleting chat attachments:', error);
        storageErrors.push(`chat_attachments: ${error}`);
      }
    }

    // gemini-images 삭제
    if (geminiImages.length > 0) {
      try {
        const { error: geminiImagesError } = await supabase.storage
          .from('gemini-images')
          .remove(geminiImages);

        if (geminiImagesError) {
          console.warn('⚠️ [DELETE_CHAT] Failed to delete gemini images:', geminiImagesError);
          storageErrors.push(`gemini-images: ${geminiImagesError.message}`);
        } else {
          console.log(`✅ [DELETE_CHAT] Deleted ${geminiImages.length} gemini images`);
        }
      } catch (error) {
        console.warn('⚠️ [DELETE_CHAT] Error deleting gemini images:', error);
        storageErrors.push(`gemini-images: ${error}`);
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
        geminiImages: geminiImages.length
      }
    };

    if (storageErrors.length > 0) {
      response.warnings = storageErrors;
      console.warn('⚠️ [DELETE_CHAT] Storage deletion warnings:', storageErrors);
    }

    console.log(`✅ [DELETE_CHAT] Successfully deleted chat ${chatId}`);
    return NextResponse.json(response);

  } catch (error) {
    console.error('Error in DELETE /api/chat/delete/[chatId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
