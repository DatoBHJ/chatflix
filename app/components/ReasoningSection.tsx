import { useState, useRef, useEffect } from 'react';
import { MarkdownContent } from './MarkdownContent';

interface ReasoningSectionProps {
  content: string;
}

export function ReasoningSection({ content }: ReasoningSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    // 컨텐츠가 변경되거나 확장될 때만 스크롤 처리
    if (!contentRef.current || !isExpanded) return;
    
    // requestAnimationFrame을 사용하여 레이아웃 계산 최적화
    const scrollContainer = contentRef.current;
    
    // DOM 업데이트 후 스크롤 계산을 위해 requestAnimationFrame 사용
    const animationFrame = requestAnimationFrame(() => {
      // 컨텐츠가 충분히 길 때만 스크롤 적용
      const scrollHeight = scrollContainer.scrollHeight;
      const clientHeight = scrollContainer.clientHeight;
      
      if (scrollHeight > clientHeight) {
        scrollContainer.scrollTo({
          top: scrollHeight - clientHeight,
          behavior: 'smooth'
        });
      }
    });
    
    // 클린업 함수에서 애니메이션 프레임 취소
    return () => cancelAnimationFrame(animationFrame);
  }, [content, isExpanded]);

  return (
    <div className="message-reasoning">
      <div 
        className="message-reasoning-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span>Thinking</span>
        <svg 
          className={`message-reasoning-icon ${isExpanded ? 'expanded' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </div>
      <div 
        ref={contentRef}
        className={`message-reasoning-content ${isExpanded ? 'expanded' : ''}`}
        style={{ 
          height: isExpanded ? 'auto' : '0',
          marginTop: isExpanded ? '0.5rem' : '0',
          opacity: isExpanded ? 1 : 0
        }}
      >
        <MarkdownContent content={content} />
      </div>
    </div>
  );
} 