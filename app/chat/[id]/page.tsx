'use client'

import { use, useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { convertMessage } from './utils'
import { PageProps } from './types'
import UnifiedChatInterface from '@/app/components/UnifiedChatInterface'

export default function Chat({ params }: PageProps) {
  const { id: chatId } = use(params)
  
  // 서버 사이드에서 초기 메시지 로드를 위한 래퍼 컴포넌트
  return <ChatPageWrapper chatId={chatId} />
}

function ChatPageWrapper({ chatId }: { chatId: string }) {
  const [initialMessages, setInitialMessages] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const loadInitialMessages = async () => {
      try {
        // 🚀 익명 사용자 체크 - 채팅 메시지 로드 전에 인증 상태 확인
        const { data: { user } } = await supabase.auth.getUser();
        
        // 익명 사용자는 채팅 페이지 접근 불가 - UnifiedChatInterface에서 처리하도록 함
        if (!user) {
          console.log('🚀 Anonymous user accessing chat page, will be handled by UnifiedChatInterface');
          setIsLoading(false);
          return;
        }
        
        // 기존 메시지 로드
        const { data: existingMessages, error: messagesError } = await supabase
            .from('messages')
            .select('*')
            .eq('chat_session_id', chatId)
            .order('sequence_number', { ascending: true });

          if (messagesError) {
          console.error('Failed to load messages:', messagesError);
          setIsLoading(false);
          return;
          }

        if (existingMessages?.length > 0) {
            const sortedMessages = existingMessages
              .map(convertMessage)
              .sort((a: any, b: any) => {
              const seqA = (a as any).sequence_number || 0;
              const seqB = (b as any).sequence_number || 0;
              return seqA - seqB;
            });
          setInitialMessages(sortedMessages);
        }
      } catch (error) {
        console.error('Error loading initial messages:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialMessages();
  }, [chatId, supabase]);

  return (
    <UnifiedChatInterface 
      // key 제거하여 컴파일 시 리마운트 방지 - 에이전트 모드 안정성 확보
      initialChatId={chatId}
      initialMessages={isLoading ? [] : initialMessages} // 로딩 중에도 컴포넌트는 렌더링하되 메시지만 빈 배열
    />
  );
} 
