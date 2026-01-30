import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { UIMessage } from 'ai';
import { getFollowUpQuestions } from '@/app/lib/messageUtils';

interface FollowUpQuestionsProps {
  chatId: string;
  userId: string;
  messages: UIMessage[];
  onQuestionClick: (question: string) => void;
}

// Assistant message의 확장된 타입 정의
interface ExtendedMessage extends UIMessage {
  annotations?: any[];
  tool_results?: {
    structuredResponse?: {
      response?: {
        followup_questions?: string[];
      };
    };
  };
}

export function FollowUpQuestions({ chatId, userId, messages, onQuestionClick }: FollowUpQuestionsProps) {
  const [followUpQuestions, setFollowUpQuestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const supabase = createClient();

  // Get follow-up questions from the last assistant message's annotations
  useEffect(() => {
    if (!messages || messages.length === 0) return;

    // Find the last assistant message
    const lastAssistantMessage = [...messages].reverse().find(msg => msg.role === 'assistant') as ExtendedMessage | undefined;
    console.log('[FollowUpQuestions] Last assistant message:', lastAssistantMessage);
    if (!lastAssistantMessage) return;

    // 🚀 Extract follow-up questions using the new utility function
    const extractFollowUpQuestions = () => {
      setIsLoading(true);
      
      try {
        const questions = getFollowUpQuestions(lastAssistantMessage);
        console.log('[FollowUpQuestions] Found followup_questions:', questions);
        setFollowUpQuestions(questions || []);
      } catch (error) {
        console.error('Error extracting follow-up questions:', error);
        setFollowUpQuestions([]);
      } finally {
        setIsLoading(false);
      }
    };

    extractFollowUpQuestions();
  }, [messages]);

  // 롱프레스 상태 감지 및 클릭 핸들러
  const handleQuestionClick = (question: string, e: React.MouseEvent) => {
    // 롱프레스가 활성화된 상태에서 follow-up question 클릭 시 롱프레스 취소
    const isLongPressActive = document.querySelector('.chat-input-tooltip-backdrop');
    if (isLongPressActive) {
      // 롱프레스 취소 이벤트 발생
      const cancelEvent = new CustomEvent('longPressCancel');
      window.dispatchEvent(cancelEvent);
      return;
    }
    
    // 일반적인 follow-up question 클릭 처리
    onQuestionClick(question);
  };

  // 🚀 SCROLL STABILITY: 항상 컨테이너 렌더링 (높이 예약)
  // 질문이 없거나 로딩 중일 때도 빈 컨테이너 유지하여 레이아웃 시프트 방지
  const hasQuestions = !isLoading && followUpQuestions.length > 0;

  return (
    <div 
      className="follow-up-questions-container"
      style={{
        // 질문이 없을 때 높이 0으로 축소하되 transition으로 부드럽게
        minHeight: hasQuestions ? 'auto' : 0,
        opacity: hasQuestions ? 1 : 0,
        transition: 'opacity 0.2s ease-out, min-height 0.2s ease-out',
        // 🚀 FIX: overflow: 'visible'로 변경하여 bubble tail 표시 허용
        // imessage-send-bubble의 ::before, ::after는 bubble 밖에 위치 (right: -7px, -26px)
        overflow: 'visible',
      }}
    >
      {hasQuestions && (
        <div className="follow-up-questions-wrapper">
          {followUpQuestions.slice(0, 3).map((question, index) => (
            <button
              key={index}
              onClick={(e) => handleQuestionClick(question, e)}
              className="imessage-send-bubble follow-up-question"
            >
              {question}
            </button>
          ))}
        </div>
      )}
    </div>
  );
} 