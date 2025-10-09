import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * 메시지 로드 시 만료된 첨부파일 URL을 자동 갱신
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

    // 1. 채팅의 모든 메시지 가져오기
    const { data: messages, error: fetchError } = await supabase
      .from('messages')
      .select('id, chat_session_id, experimental_attachments')
      .eq('chat_session_id', chatId)
      .eq('user_id', userId);

    if (fetchError || !messages) {
      return NextResponse.json(
        { error: 'Failed to fetch messages' },
        { status: 500 }
      );
    }

    let refreshCount = 0;

    // 2. 각 메시지의 첨부파일 URL 갱신
    for (const message of messages) {
      const attachments = message.experimental_attachments;
      
      if (!attachments || !Array.isArray(attachments) || attachments.length === 0) {
        continue;
      }

      let needsUpdate = false;
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
              return attachment;
            }

            // 새로운 Signed URL 생성
            const { data: signedData, error: signedError } = await supabase.storage
              .from('chat_attachments')
              .createSignedUrl(filePath, 24 * 60 * 60); // 24시간

            if (signedError || !signedData?.signedUrl) {
              return attachment;
            }

            needsUpdate = true;
            return {
              ...attachment,
              url: signedData.signedUrl
            };
          } catch (error) {
            return attachment;
          }
        })
      );

      // 3. 갱신이 필요한 경우에만 DB 업데이트
      if (needsUpdate) {
        await supabase
          .from('messages')
          .update({ experimental_attachments: refreshedAttachments })
          .eq('id', message.id)
          .eq('chat_session_id', chatId)
          .eq('user_id', userId);
        
        refreshCount++;
      }
    }


    return NextResponse.json({
      success: true,
      refreshedCount: refreshCount
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

