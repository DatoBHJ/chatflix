import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Message } from 'ai';

interface FollowUpQuestionsProps {
  chatId: string;
  userId: string;
  messages: Message[];
  onQuestionClick: (question: string) => void;
}

export function FollowUpQuestions({ chatId, userId, messages, onQuestionClick }: FollowUpQuestionsProps) {
  const [followUpQuestions, setFollowUpQuestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const supabase = createClient();

  // Update follow-up questions whenever messages change
  useEffect(() => {
    if (!chatId || !userId || messages.length === 0) return;

    const generateFollowUpQuestions = async () => {
      setIsLoading(true);
      try {
        // Get the last 3 messages for context
        const recentMessages = messages.slice(-3).map(msg => ({
          role: msg.role,
          content: msg.content
        }));

        // First check if we have existing questions
        const { data: sessionData } = await supabase
          .from('chat_sessions')
          .select('followupQuestion')
          .eq('id', chatId)
          .single();

        // If we have questions and they're still relevant, use them
        if (sessionData?.followupQuestion?.questions && 
            Array.isArray(sessionData.followupQuestion.questions) && 
            sessionData.followupQuestion.questions.length > 0 &&
            sessionData.followupQuestion.messageCount === messages.length) {
          setFollowUpQuestions(sessionData.followupQuestion.questions);
          setIsLoading(false);
          return;
        }

        // Generate new questions through API
        const response = await fetch('/api/generate-followup', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            messages: recentMessages,
            chatId,
            userId
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to generate follow-up questions');
        }

        const data = await response.json();
        
        if (data.questions && Array.isArray(data.questions)) {
          setFollowUpQuestions(data.questions);
          
          // Store the questions in the database
          await supabase
            .from('chat_sessions')
            .update({
              followupQuestion: {
                questions: data.questions,
                messageCount: messages.length,
                updatedAt: new Date().toISOString()
              }
            })
            .eq('id', chatId);
        }
      } catch (error) {
        console.error('Error generating follow-up questions:', error);
      } finally {
        setIsLoading(false);
      }
    };

    generateFollowUpQuestions();
  }, [chatId, userId, messages]);

  if (isLoading || followUpQuestions.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2 py-2 px-0 mt-2">
      {followUpQuestions.map((question, index) => (
        <button
          key={index}
          onClick={() => onQuestionClick(question)}
          className="text-xs text-left bg-foreground/5 hover:bg-foreground/10 text-foreground/80 hover:text-foreground/90 px-3 py-1.5 rounded-full transition-colors"
        >
          {question}
        </button>
      ))}
    </div>
  );
} 