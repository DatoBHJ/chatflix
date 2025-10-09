import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

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

    // 1. 현재 메시지의 첨부파일 가져오기
    const { data: message, error: fetchError } = await supabase
      .from('messages')
      .select('experimental_attachments')
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
    if (!attachments || !Array.isArray(attachments) || attachments.length === 0) {
      return NextResponse.json({ success: true, message: 'No attachments to refresh' });
    }

    // 2. 각 첨부파일의 URL을 갱신
    const refreshedAttachments = await Promise.all(
      attachments.map(async (attachment: any) => {
        const url = attachment.url;
        
        // Supabase Storage URL이 아니면 갱신 불필요
        if (!url || !url.includes('supabase.co/storage/v1/object/sign/')) {
          return attachment;
        }

        try {
          // URL에서 파일 경로 추출
          const filePath = url.split('chat_attachments/')[1]?.split('?')[0];
          if (!filePath) {
            console.error('Failed to extract file path from URL:', url);
            return attachment;
          }

          // 새로운 Signed URL 생성
          const { data: signedData, error: signedError } = await supabase.storage
            .from('chat_attachments')
            .createSignedUrl(filePath, 24 * 60 * 60); // 24시간

          if (signedError || !signedData?.signedUrl) {
            console.error('Failed to create signed URL:', signedError);
            return attachment;
          }

          console.log('✅ [URL_REFRESH_API] Refreshed URL for:', attachment.name);
          
          // 갱신된 URL로 첨부파일 객체 업데이트
          return {
            ...attachment,
            url: signedData.signedUrl
          };
        } catch (error) {
          console.error('Error refreshing URL for attachment:', attachment.name, error);
          return attachment;
        }
      })
    );

    // 3. 데이터베이스에 갱신된 첨부파일 저장
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        experimental_attachments: refreshedAttachments
      })
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

    console.log('✅ [URL_REFRESH_API] Successfully refreshed all URLs for message:', messageId);

    return NextResponse.json({
      success: true,
      refreshedCount: refreshedAttachments.length
    });

  } catch (error) {
    console.error('URL refresh API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

