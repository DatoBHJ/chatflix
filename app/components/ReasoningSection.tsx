import { useState, useRef, useEffect } from 'react';
import { MarkdownContent } from './MarkdownContent';

interface ReasoningSectionProps {
  content: string;
}

export function ReasoningSection({ content }: ReasoningSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);
  
  // useEffect(() => {
  //   if (contentRef.current && isExpanded) {
  //     const scrollContainer = contentRef.current;
  //     const scrollHeight = scrollContainer.scrollHeight;
      
  //     const startScroll = () => {
  //       const currentScroll = scrollContainer.scrollTop;
  //       const targetScroll = scrollHeight - scrollContainer.clientHeight;
  //       const distance = targetScroll - currentScroll;
        
  //       if (distance > 0) {
  //         scrollContainer.scrollTo({
  //           top: targetScroll,
  //           behavior: 'smooth'
  //         });
  //       }
  //     };

  //     startScroll();
  //   }
  // }, [content, isExpanded]);

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