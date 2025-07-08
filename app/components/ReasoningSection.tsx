import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MarkdownContent } from './MarkdownContent';
import { Brain, CheckCircle2 } from 'lucide-react';

interface ReasoningSectionProps {
  content: string;
  isComplete?: boolean;
  isExpanded?: boolean;
  setIsExpanded?: (expanded: boolean) => void;
  startTime?: number | null;
}

function ReasoningSectionComponent({ 
  content, 
  isComplete = false, 
  isExpanded: externalIsExpanded,
  setIsExpanded: externalSetIsExpanded,
  startTime = null
}: ReasoningSectionProps) {
  const [internalIsExpanded, setInternalIsExpanded] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  const isExpanded = externalIsExpanded !== undefined ? externalIsExpanded : internalIsExpanded;
  const setIsExpanded = externalSetIsExpanded || setInternalIsExpanded;

  // Timer effect
  useEffect(() => {
    if (startTime && !isComplete) {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      const timer = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
      return () => clearInterval(timer);
    } else if (isComplete && startTime) {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }
  }, [startTime, isComplete]);

  // Auto scroll when content changes or panel is expanded
  useEffect(() => {
    if (isExpanded && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [content, isExpanded]);

  const handleToggle = useCallback(() => {
    setIsExpanded(!isExpanded);
  }, [isExpanded, setIsExpanded]);

  return (
    <div className="flex justify-start">
      <div 
        className="group relative cursor-pointer"
        onClick={handleToggle}
      >
        {/* 메인 생각 버블 */}
        <div className="flex items-center gap-2 px-3 py-2 bg-white/80 dark:bg-black/30 rounded-full backdrop-blur-xl border border-black/5 dark:border-white/10 shadow-sm hover:shadow-md hover:scale-[1.02] transition-all duration-200 ease-out">
          <Brain className="h-3.5 w-3.5" style={{ color: 'var(--reasoning-color)' }} strokeWidth={2} />
          
          {/* 버블 상태: 기존의 ... 애니메이션으로 복원 */}
          {!isComplete ? (
            <div className="flex items-center gap-1">
              <div className="flex gap-0.5">
                <div className="w-0.5 h-0.5 bg-[var(--muted)] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-0.5 h-0.5 bg-[var(--muted)] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-0.5 h-0.5 bg-[var(--muted)] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" strokeWidth={2.5} />
          )}
        </div>

        {/* 작은 연결 버블들 */}
        <div className="absolute -bottom-0.5 left-4 flex gap-0.5">
          <div className="w-1 h-1 bg-white/60 dark:bg-black/20 rounded-full"></div>
          <div className="w-0.5 h-0.5 bg-white/40 dark:bg-black/15 rounded-full"></div>
        </div>

        {/* 상세 정보 툴팁 */}
        <div className={`absolute top-full left-0 mt-3 w-72 sm:w-96 bg-white/95 dark:bg-black/90 backdrop-blur-xl rounded-2xl border border-black/8 dark:border-white/10 shadow-xl p-4 z-50 transition-all duration-200 ease-out ${isExpanded ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-1 pointer-events-none'}`}>
          {/* 툴팁 화살표 */}
          <div className="absolute -top-1.5 left-6 w-3 h-3 bg-white/95 dark:bg-black/90 border-l border-t border-black/8 dark:border-white/10 rotate-45"></div>
          
          {/* 툴팁 상태: 아이콘과 함께 상세 시간 표시 */}
          <div className="flex items-center gap-2 mb-3">
            {!isComplete ? (
              <>
                <div className="animate-spin rounded-full border-2 border-transparent border-t-[var(--reasoning-color)] h-4 w-4" style={{ animationDuration: '0.8s' }}></div>
                <span className="text-sm font-medium text-[var(--foreground)]">
                  Thinking for {elapsedTime}s
                </span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 text-green-500" strokeWidth={2.5} />
                <span className="text-sm font-medium text-[var(--muted)]">
                  Took {elapsedTime}s
                </span>
              </>
            )}
          </div>
          
          {/* AI의 전체 생각 내용 */}
          <div 
            ref={scrollContainerRef}
            className="text-sm text-[var(--foreground)] max-h-64 overflow-y-auto scrollbar-thin leading-relaxed scroll-smooth"
          >
            <MarkdownContent content={content} variant="clean" />
          </div>
        </div>
      </div>
    </div>
  );
}

export const ReasoningSection = React.memo(ReasoningSectionComponent);
