import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Message } from 'ai';

interface FollowUpQuestionsProps {
  chatId: string;
  userId: string;
  messages: Message[];
  onQuestionClick: (question: string) => void;
}

// Assistant message의 확장된 타입 정의
interface ExtendedMessage extends Message {
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
    if (!lastAssistantMessage) return;

    // Extract follow-up questions from structured response
    const getFollowUpQuestions = () => {
      setIsLoading(true);
      
      try {
        // 1. Check in structured_response annotation
        const structuredResponseAnnotation = lastAssistantMessage.annotations?.find(
          (annotation: any) => annotation.type === 'structured_response'
        );
        
        if (structuredResponseAnnotation?.data?.response?.followup_questions) {
          setFollowUpQuestions(structuredResponseAnnotation.data.response.followup_questions);
          return;
        }
        
        // 2. Check in tool_results
        if (lastAssistantMessage.tool_results?.structuredResponse?.response?.followup_questions) {
          setFollowUpQuestions(lastAssistantMessage.tool_results.structuredResponse.response.followup_questions);
          return;
        }
        
        // 3. Check in progress annotations (latest one)
        const progressAnnotations = lastAssistantMessage.annotations?.filter(
          (annotation: any) => annotation.type === 'structured_response_progress'
        );
        
        if (progressAnnotations && progressAnnotations.length > 0) {
          const latestProgress = progressAnnotations[progressAnnotations.length - 1];
          if (latestProgress && latestProgress.data?.response?.followup_questions) {
            setFollowUpQuestions(latestProgress.data.response.followup_questions);
            return;
          }
        }
        
        // No follow-up questions found, clear any existing ones
        setFollowUpQuestions([]);
      } catch (error) {
        console.error('Error extracting follow-up questions:', error);
        setFollowUpQuestions([]);
      } finally {
        setIsLoading(false);
      }
    };

    getFollowUpQuestions();
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