import React, { useState, useEffect } from 'react';

// 기본 영어 예시 쿼리 목록
export const DEFAULT_EXAMPLE_PROMPTS = [
  // "Write a masterpiece that describes my aura",
  "4, 8, 15, 16, 23, 42",
  "Draw a Catwoman", 
  "I AM MUSIC Album Review",
  "Summarize this PDF: https://www.nasa.gov/wp-content/uploads/2023/01/55583main_vision_space_exploration2.pdf",
  "Summarize this link: https://www.numeroberlin.de/2023/11/numero-berlin-zukunft-x-playboi-carti/",
  "Summarize this youtube video: https://youtu.be/rHO6TiPLHqw?si=EeNnPSQqUCHRFkCC",
  "Latest US stock market news in the style of a bedtime story",
  "Find scientific reasons why cats ignore humans",
  "Research why programmers are obsessed with dark mode",
  "Explain why people love horror movies using psychological theories",
  "List the top 5 weirdest trends in AI right now",
  "Calculate how much coffee a developer needs to finish a project in 3 days",
  "Research the psychological effects of drug use on creativity",
  "List the most controversial moments in human history",
  "Analyze the impact of Elon Musk's tweets on cryptocurrency markets",
  "Latest on the Mars mission?",
  "Why do some dumbass people think the earth is flat?",
  "Explain the movie Tenet like I'm 5",
  "Find the most absurd laws that still exist and research their historical origins",
  "Calculate how much money influencers actually make and compare it to real jobs",
  "Find the most ridiculous startup ideas that actually got funded",
  "Provide me a digest of world news in the last 24 hours",
  "What is the most viral meme in 2022?",
  "Can you recommend the top 10 burger places in London?",
  "Where is the best place to go skiing this year?",
  "What are some recently discovered alternative DNA shapes?",
  "What are the latest releases at OpenAI?",
  "Latest updates on Israel Gaza war",
  "What is the most popular song in 2025?",
  "The most popular movie in 2025?",
  "Latest IOS update",
  "What can you do?"
];

export interface SuggestedPromptProps {
  userId: string;
  onPromptClick: (prompt: string) => void;
  className?: string;
  isVisible?: boolean;
}

export function SuggestedPrompt({ userId, onPromptClick, className = '', isVisible = true }: SuggestedPromptProps) {
  const [suggestedPrompt, setSuggestedPrompt] = useState<string | null>(null);
  const [displayedText, setDisplayedText] = useState<string>('');
  const [isTyping, setIsTyping] = useState(false);
  const [showCursor, setShowCursor] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [typingIndex, setTypingIndex] = useState(0);

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
            className="text-muted underline break-all hover:text-blue-800"
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
    if (isHovered || !isVisible) return; // 호버 중이거나 숨겨진 상태일 때는 변경하지 않음

    // 기본 예시 목록에서 랜덤하게 선택
    const randomIndex = Math.floor(Math.random() * DEFAULT_EXAMPLE_PROMPTS.length);
    const newPrompt = DEFAULT_EXAMPLE_PROMPTS[randomIndex];
    
    // 현재 프롬프트와 다른 것을 선택하도록 보장
    if (newPrompt === suggestedPrompt && DEFAULT_EXAMPLE_PROMPTS.length > 1) {
      showRandomPrompt();
      return;
    }

    setSuggestedPrompt(newPrompt);
    setDisplayedText('');
    setTypingIndex(0);
    setIsTyping(true);
  };

  // 타이핑 효과
  useEffect(() => {
    if (!suggestedPrompt || !isTyping || !isVisible) return; // isVisible 체크 추가

    if (typingIndex < suggestedPrompt.length) {
      const timer = setTimeout(() => {
        setDisplayedText(suggestedPrompt.slice(0, typingIndex + 1));
        setTypingIndex(prev => prev + 1);
      }, 50 + Math.random() * 30); // 50-80ms 사이의 랜덤한 타이핑 속도

      return () => clearTimeout(timer);
    } else {
      // 타이핑 완료
      setIsTyping(false);
    }
  }, [suggestedPrompt, typingIndex, isTyping, isVisible]);

  // 커서 깜빡임 효과 (타이핑 중일 때만) - 블록 스타일
  useEffect(() => {
    if (!isTyping || !isVisible) { // isVisible 체크 추가
      setShowCursor(false); // 타이핑 완료 시 커서 숨기기
      return;
    }

    const cursorInterval = setInterval(() => {
      setShowCursor(prev => !prev);
    }, 400); // 더 빠른 깜빡임으로 터미널 느낌

    return () => clearInterval(cursorInterval);
  }, [isTyping, isVisible]);

  // 초기 프롬프트 설정
  useEffect(() => {
    if (isVisible) {
      showRandomPrompt();
    }
  }, [userId, isVisible]);

  // 자동 프롬프트 변경
  useEffect(() => {
    if (isHovered || isTyping || !isVisible) return; // isVisible 체크 추가

    const timer = setTimeout(() => {
      showRandomPrompt();
    }, 4000); // 타이핑 완료 후 4초 대기

    return () => clearTimeout(timer);
  }, [isHovered, isTyping, suggestedPrompt, isVisible]);

  // 마우스 이벤트 핸들러
  const handleMouseEnter = () => {
    if (isVisible) {
      setIsHovered(true);
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  const handleClick = () => {
    if (suggestedPrompt && isVisible) {
      onPromptClick(suggestedPrompt);
    }
  };

  return (
    <div className={`min-h-16 relative flex items-start justify-start ${className}`}>
      {suggestedPrompt && (
        <div
          className={`px-4 sm:px-4 text-sm sm:text-base cursor-pointer transition-all duration-300 text-left break-words whitespace-normal max-w-full font-mono leading-snug sm:leading-relaxed group ${
            isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          onClick={handleClick}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {/* 터미널 스타일 프롬프트 */}
          <div className="flex items-start gap-2">
            <span className="text-green-500 dark:text-green-400 opacity-70 select-none shrink-0 text-sm sm:text-base">
              ›
            </span>
            <span className="inline-block text-green-500 dark:text-green-400 group-hover:text-green-400 dark:group-hover:text-green-300 transition-colors duration-300">
              {renderPromptWithLinks(displayedText)}
              {/* 터미널 스타일 블록 커서 - 조건부 너비로 간격 문제 해결 */}
              <span 
                className={`inline-block h-4 sm:h-5 ml-0.5 bg-green-500 dark:bg-green-400 transition-all duration-100 ${
                  isTyping && showCursor ? 'opacity-70 w-2' : 'opacity-0 w-0 ml-0'
                }`}
                style={{
                  animation: isTyping ? 'none' : undefined,
                }}
              />
            </span>
          </div>
        </div>
      )}
      
      {/* 향상된 스타일 */}
      <style jsx>{`
        @keyframes blink {
          0%, 50% { opacity: 0.7; }
          51%, 100% { opacity: 0; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 0.8; }
        }
      `}</style>
    </div>
  );
}