import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';

// 기본 영어 예시 쿼리 목록
const DEFAULT_EXAMPLE_PROMPTS = [
  "What can you do?",
  "What are the key features of Chatflix?",
  // 도구 사용을 유도하는 질문 추가
  "Search the web for the latest news about AI development",
  "Can you generate an image of a sunset over mountains?",
  "Draw a picture of Darth Vader wearing a bikini",
  "Calculate the derivative of x^2 * sin(x)",
  "Find academic papers about renewable energy",
  "What are people saying on X about Tesla?",
  "Summarize this YouTube video: https://www.youtube.com/watch?v=AJpK3YTTKZ4",
  "Read and summarize this article: https://www.anthropic.com/news/claude-3-7-sonnet",
  "Convert 250 kg to pounds and calculate 15% of the result",
  "Solve the equation 3x^2 - 12x + 7 = 0",
  // 복합적인 도구 사용을 유도하는 질문 추가
  "Calculate the combined net worth of the five richest people in the world",
  "Research the 3 most fuel-efficient electric cars, compare their prices, and calculate the 5-year cost of ownership",
  "Find a popular TED talk about AI, summarize its key points, and research the speaker's background",
  "Look up the nutritional information for avocados, calculate how many I need to eat to get 30g of protein",
  "Find recent SpaceX launch news, summarize it, and analyze related social media reactions",
  "Find the top 5 cryptocurrencies by market cap and calculate what $1000 invested equally would be worth",
  "Search for the most viewed YouTube videos of all time and analyze what they have in common"
];

export interface SuggestedPromptProps {
  userId: string;
  onPromptClick: (prompt: string) => void;
  className?: string;
}

export function SuggestedPrompt({ userId, onPromptClick, className = '' }: SuggestedPromptProps) {
  const [suggestedPrompt, setSuggestedPrompt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isVisible, setIsVisible] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    const fetchSuggestedPrompt = async () => {
      setIsLoading(true);
      setIsVisible(false);
      
      // 1. Fetch user-specific prompts from active_user_profiles
      const { data: profileData, error: profileError } = await supabase
        .from('active_user_profiles')
        .select('profile_data')
        .eq('user_id', userId)
        .single();
      
      // 2. Fetch user-specific prompts from suggested_prompts table
      const { data: userPromptsData, error: userPromptsError } = await supabase
        .from('suggested_prompts')
        .select('prompts')
        .eq('user_id', userId);
      
      let allPrompts: string[] = [];
      
      // 항상 기본 예시 프롬프트를 추가 (모든 사용자에게 표시)
      allPrompts = [...allPrompts, ...DEFAULT_EXAMPLE_PROMPTS];
      
      // Add user-specific prompts from profile if available
      if (!profileError && profileData && profileData.profile_data?.suggested_prompts) {
        const profilePrompts = profileData.profile_data.suggested_prompts;
        if (Array.isArray(profilePrompts) && profilePrompts.length > 0) {
          allPrompts = [...allPrompts, ...profilePrompts];
        }
      }
      
      // Add user-specific prompts from suggested_prompts table if available
      if (!userPromptsError && userPromptsData && userPromptsData.length > 0) {
        userPromptsData.forEach(item => {
          if (item.prompts && Array.isArray(item.prompts)) {
            allPrompts = [...allPrompts, ...item.prompts];
          }
        });
      }
      
      // 중복 제거 (Set 사용)
      const uniquePrompts = [...new Set(allPrompts)];
      
      // 사용자 프롬프트가 없는 경우에도 기본 예시는 이미 추가되어 있음
      if (uniquePrompts.length > 0) {
        const randomIndex = Math.floor(Math.random() * uniquePrompts.length);
        setSuggestedPrompt(uniquePrompts[randomIndex]);
        
        // Small delay before showing to ensure smooth transition
        setTimeout(() => {
          setIsLoading(false);
          setTimeout(() => {
            setIsVisible(true);
          }, 50);
        }, 300);
      } else {
        setIsLoading(false);
      }
    };

    if (userId) {
      fetchSuggestedPrompt();
    }
    
    return () => {
      setIsVisible(false);
      setIsLoading(true);
    };
  }, [userId]);

  return (
    <div className={`min-h-[28px] relative ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-4 w-24 bg-foreground/10 animate-pulse rounded"></div>
        </div>
      )}
      
      {suggestedPrompt && (
        <div 
          className={`text-xs text-foreground/60 px-4 py-1.5 cursor-pointer hover:text-foreground/80 transition-all duration-300 text-center
            ${isVisible ? 'opacity-100' : 'opacity-0'}`}
          onClick={() => onPromptClick(suggestedPrompt)}
        >
          {suggestedPrompt}
        </div>
      )}
    </div>
  );
} 

