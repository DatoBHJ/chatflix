import React, { useState, useEffect } from 'react';

// 기본 영어 예시 쿼리 목록
export const DEFAULT_EXAMPLE_PROMPTS = [
  "Write a masterpiece that describes my aura",
  "Draw a Catwoman", 
  "I AM MUSIC Album Review",
  "Summarize this PDF: https://www.nasa.gov/wp-content/uploads/2023/01/55583main_vision_space_exploration2.pdf",
  "Summarize this link: https://www.numeroberlin.de/2023/11/numero-berlin-zukunft-x-playboi-carti/",
  "Summarize this youtube video: https://youtu.be/rHO6TiPLHqw?si=EeNnPSQqUCHRFkCC",
  "Latest US stock market news in the style of a bedtime story.",
  "Find scientific reasons why cats ignore humans.",
  "Research why programmers are obsessed with dark mode.",
  "Explain why people love horror movies using psychological theories",
  "List the top 5 weirdest trends in AI right now.",
  "Calculate how much coffee a developer needs to finish a project in 3 days.",
  "Research the psychological effects of drug use on creativity.",
  "List the most controversial moments in human history.",
  "Analyze the impact of Elon Musk's tweets on cryptocurrency markets.",
  "Summarize the most popular 9/11 conspiracy theories",
  "Latest on the Mars mission?",
  "Why do some dumbass people think the earth is flat?",
  "Explain the movie Tenet like I'm 5",
  "Find the most ridiculous celebrity business ventures and analyze their success rates.",
  "Find the most absurd laws that still exist and research their historical origins.",
  "Calculate how much money influencers actually make per post and compare it to real jobs.",
  "Find the most ridiculous startup ideas that actually got funded and calculate their burn rates.",
  "Provide me a digest of world news in the last 24 hours.",
  "What is the most viral meme in 2022?",
  "Can you recommend the top 10 burger places in London?",
  "Where is the best place to go skiing this year?",
  "What are some recently discovered alternative DNA shapes?",
  "What are the latest releases at OpenAI?",
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
  const [isHovered, setIsHovered] = useState(false); // 호버 상태 추가

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
        // 너무 긴 링크는 20자까지만 보여주고 ... 처리
        const displayText = part.length > 20 ? part.slice(0, 20) + '...' : part;
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

  // 새로운 프롬프트를 표시하는 함수
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
        }, 200); // 페이드 인 더 느리게
      }, 400); // 로딩 더 오래
    }, 500); // 페이드 아웃 더 오래
  };

  useEffect(() => {
    // 초기 프롬프트 표시
    showRandomPrompt();
  }, [userId]);

  // 호버 상태에 따라 interval 관리
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    // 호버되지 않은 상태에서만 자동 변경
    if (!isHovered) {
      intervalId = setInterval(() => {
        showRandomPrompt();
      }, 4000);
    }

    // cleanup: interval 정리
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isHovered]); // isHovered 상태가 변경될 때마다 실행

  // 마우스 이벤트 핸들러
  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  return (
    <div className={`min-h-[28px] relative ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-4 w-24 bg-foreground/10 animate-pulse rounded"></div>
        </div>
      )}
      {suggestedPrompt && (
        <div
          className={`text-xs text-[var(--muted)] cursor-pointer transition-all duration-500 text-center break-words whitespace-normal max-w-full max-h-16 overflow-y-auto ${
            isVisible ? 'opacity-100' : 'opacity-0'
          } hover:text-[var(--foreground)]`}
          onClick={() => onPromptClick(suggestedPrompt)}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {renderPromptWithLinks(suggestedPrompt)}
        </div>
      )}
    </div>
  );
}