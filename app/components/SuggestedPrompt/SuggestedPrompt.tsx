import React, { useState, useEffect } from 'react';

// 기본 영어 예시 쿼리 목록
const DEFAULT_EXAMPLE_PROMPTS = [
  "Write a masterpiece that describes my aura",
  "Draw a Catwoman",
  "Draw a cute cat",  
  "I AM MUSIC Album Review",
  "Summarize this PDF: https://www.nasa.gov/wp-content/uploads/2023/01/55583main_vision_space_exploration2.pdf",
  "Summarize this link: https://www.numeroberlin.de/2023/11/numero-berlin-zukunft-x-playboi-carti/",
  "Summarize this video: https://youtu.be/rHO6TiPLHqw?si=EeNnPSQqUCHRFkCC",
  "Latest US stock market news in the style of a bedtime story.",
  "Find scientific reasons why cats ignore humans.",
  "Research why programmers are obsessed with dark mode.",
  "Explain why people love horror movies using psychological theories",
  "List the top 5 weirdest trends in AI right now.",
  "Calculate how much coffee a developer needs to finish a project in 3 days.",
  "Explain the stock market crash of 2008 in the style of a rap battle.",
  "Research the psychological effects of drug use on creativity.",
  "List the most controversial moments in hip-hop history.",
  "Analyze the impact of Elon Musk's tweets on cryptocurrency markets.",
  "Summarize the most popular 9/11 conspiracy theories",
  "What's the latest on the Mars mission?",
  "What’s the wildest thing Kanye did this year?",
  "Is Threads still a thing or did everyone go back to X?",
  "Describe the Mandela Effect and give the most famous examples.",
  "Summarize the Kanye West and Taylor Swift feud as a Shakespearean drama.",
  "Why do people think the earth is flat?",
  "Explain the movie Tenet like I'm 5",
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

  // URL 정규식 (http, https, www)
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;

  // 링크를 감지해서 React 요소로 변환
  function renderPromptWithLinks(text: string) {
    const parts = text.split(urlRegex);
    return parts.map((part, i) => {
      if (urlRegex.test(part)) {
        let href = part;
        if (!href.startsWith('http')) {
          href = 'https://' + href;
        }
        // 너무 긴 링크는 30자까지만 보여주고 ... 처리
        const displayText = part.length > 30 ? part.slice(0, 30) + '...' : part;
        return (
          <a
            key={i}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline break-all hover:text-blue-800"
            onClick={e => e.stopPropagation()} // 링크 클릭 시 부모 클릭 방지
            title={part}
          >
            {displayText}
          </a>
        );
      } else {
        return <React.Fragment key={i}>{part}</React.Fragment>;
      }
    });
  }

  useEffect(() => {
    const showRandomPrompt = () => {
      setIsVisible(false);
      
      // 페이드 아웃이 완전히 끝난 후에 새로운 프롬프트 설정
      setTimeout(() => {
        setIsLoading(true);
        
        // 기본 예시 목록에서 랜덤하게 선택
        const randomIndex = Math.floor(Math.random() * DEFAULT_EXAMPLE_PROMPTS.length);
        setSuggestedPrompt(DEFAULT_EXAMPLE_PROMPTS[randomIndex]);
        
        // 로딩 상태를 잠깐 유지한 후 새로운 프롬프트 표시
        setTimeout(() => {
          setIsLoading(false);
          setTimeout(() => {
            setIsVisible(true);
          }, 100);
        }, 200);
      }, 300);
    };

    // 초기 프롬프트 표시
    showRandomPrompt();

    // 5초마다 새로운 프롬프트 표시
    const intervalId = setInterval(showRandomPrompt, 3000);

    return () => {
      clearInterval(intervalId);
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
          className={`text-xs text-[var(--muted)] cursor-pointer transition-all duration-300 text-center break-words whitespace-normal max-w-full max-h-16 overflow-y-auto ${
            isVisible ? 'opacity-100' : 'opacity-0'
          } hover:text-[var(--foreground)]`}
          onClick={() => onPromptClick(suggestedPrompt)}
        >
          {renderPromptWithLinks(suggestedPrompt)}
        </div>
      )}
    </div>
  );
}