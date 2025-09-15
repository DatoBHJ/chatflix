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

  if (isLoading || followUpQuestions.length === 0) {
    return null;
  }

  return (
    <div className="follow-up-questions-container">
      <div className="follow-up-questions-wrapper">
        {followUpQuestions.slice(0, 3).map((question, index) => (
          <button
            key={index}
            onClick={() => onQuestionClick(question)}
            className="imessage-send-bubble follow-up-question"
          >
            {question}
          </button>
        ))}
      </div>
    </div>
  );
} 