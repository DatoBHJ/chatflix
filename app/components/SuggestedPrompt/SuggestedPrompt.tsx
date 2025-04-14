import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';

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
      
      // Select random prompt if we have any
      if (allPrompts.length > 0) {
        const randomIndex = Math.floor(Math.random() * allPrompts.length);
        setSuggestedPrompt(allPrompts[randomIndex]);
        
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

