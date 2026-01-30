'use client'

import { use, useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { convertMessage } from './utils'
import { PageProps } from './types'
import ChatInterface from '@/app/chat/components/ChatInterface'

export default function Chat({ params }: PageProps) {
  const { id: chatId } = use(params)
  
  // 서버 사이드에서 초기 메시지 로드를 위한 래퍼 컴포넌트
  return <ChatPageWrapper chatId={chatId} />
}

// Type for context summary from database
interface ContextSummary {
  summary: string;
  summarized_until_message_id: string;
  summarized_until_sequence: number;
  created_at: string;
}

function ChatPageWrapper({ chatId }: { chatId: string }) {
  const [initialMessages, setInitialMessages] = useState<any[]>([])
  const [contextSummary, setContextSummary] = useState<ContextSummary | null>(null)
  const [totalMessageCount, setTotalMessageCount] = useState<number>(0)
  
  // 🚀 FIX: 데이터 로드 완료 여부를 명확히 추적
  const [hasLoadedData, setHasLoadedData] = useState(false)
  
  const supabase = createClient()

  useEffect(() => {
    const loadInitialMessages = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          setHasLoadedData(true);
          return;
        }
        
        // 1. context_summary 확인 (UI 마커 표시용)
        const { data: sessionData } = await supabase
          .from('chat_sessions')
          .select('context_summary')
          .eq('id', chatId)
          .eq('user_id', user.id)
          .single();
        
        const summary = sessionData?.context_summary as ContextSummary | null;
        if (summary) {
          setContextSummary(summary);
        }
        
        // 2. URL 갱신 (메시지 로드 전에 실행하여 갱신된 URL이 메시지에 포함되도록)
        try {
          await fetch('/api/chat/refresh-message-urls', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chatId, userId: user.id })
          });
        } catch (refreshError) {
          // URL 갱신 실패해도 메시지 로드는 계속 진행
          console.warn('Failed to refresh message URLs:', refreshError);
        }
        
        // 3. 메시지 로드 (UI에는 모든 메시지 표시, 요약은 백엔드에서만 처리)
        let messagesData;
        
        const { count } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('chat_session_id', chatId)
          .eq('user_id', user.id);
        
        // 전체 메시지 수 저장 (hasMore 계산용)
        setTotalMessageCount(count || 0);
        
        if (!count || count <= 20) {
          // Small chat - load all
          const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('chat_session_id', chatId)
            .eq('user_id', user.id)
            .order('sequence_number', { ascending: true });
          
          if (error) throw error;
          messagesData = data;
        } else {
          // Large chat - load latest 20 messages
          const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('chat_session_id', chatId)
            .eq('user_id', user.id)
            .order('sequence_number', { ascending: false })
            .limit(20);
          
          if (error) throw error;
          messagesData = data?.reverse(); // Reverse to get chronological order
        }

        if (messagesData?.length > 0) {
          setInitialMessages(messagesData.map(convertMessage));
        }
        
        // 🚀 FIX: 데이터 로드 완료 플래그 설정
        setHasLoadedData(true);
      } catch (error) {
        console.error('Error loading messages:', error);
        // 에러가 발생해도 로드 완료로 처리 (빈 상태로 표시)
        setHasLoadedData(true);
      }
    };

    loadInitialMessages();
  }, [chatId, supabase]);

  // 🚀 FIX Bug 1: 데이터 로드가 완료될 때까지 ChatInterface를 렌더링하지 않음
  // useChat의 initialMessages는 hook 초기화 시점에만 사용되므로,
  // 빈 배열로 초기화하면 이후 메시지가 로드되어도 반영되지 않음
  if (!hasLoadedData) {
    return (
      <div className="flex-1 flex items-center justify-center h-screen">
        <div className="typing-indicator-compact">
          <div className="typing-dot-compact"></div>
          <div className="typing-dot-compact"></div>
          <div className="typing-dot-compact"></div>
        </div>
      </div>
    );
  }

  return (
    <ChatInterface 
      key={chatId}
      initialChatId={chatId}
      initialMessages={initialMessages}
      contextSummary={contextSummary}
      totalMessageCount={totalMessageCount}
    />
  );
} 
