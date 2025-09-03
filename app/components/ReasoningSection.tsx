import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MarkdownContent } from './MarkdownContent';
import { Brain, CheckCircle2, Maximize2, X } from 'lucide-react';
import ReactDOM from 'react-dom';

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
  const [isFullScreen, setIsFullScreen] = useState(false);
 const scrollContainerRef = useRef<HTMLDivElement>(null);
  const fullScreenScrollRef = useRef<HTMLDivElement>(null);
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
  // Auto scroll for full screen
  useEffect(() => {
    if (isFullScreen && fullScreenScrollRef.current) {
      fullScreenScrollRef.current.scrollTop = fullScreenScrollRef.current.scrollHeight;
    }
  }, [content, isFullScreen]);
  const handleToggle = useCallback(() => {
    setIsExpanded(!isExpanded);
  }, [isExpanded, setIsExpanded]);
  const handleFullScreenToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsFullScreen(!isFullScreen);
  }, [isFullScreen]);
   // 전체 화면 팝업 렌더링
   if (isFullScreen) {
    return ReactDOM.createPortal(
      <div className="fixed inset-0 z-[9999] backdrop-blur-sm flex items-center justify-center p-4" style={{ backgroundColor: 'var(--overlay)' }}>
        <div className="relative w-full max-w-4xl h-full max-h-[90vh] bg-[var(--background)] rounded-2xl overflow-hidden flex flex-col" style={{ boxShadow: '0 25px 50px -12px var(--overlay), 0 10px 20px -5px var(--overlay)' }}>
          {/* 헤더 */}
          <div className="flex items-center justify-between p-4 border-b border-[var(--subtle-divider)]">
            <div className="flex items-center gap-3">
              <Brain className="h-5 w-5" style={{ color: 'var(--reasoning-color)' }} strokeWidth={2} />
              <div>
                <h3 className="font-semibold text-[var(--foreground)]">AI Reasoning</h3>
                <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
                  {!isComplete ? (
                    <>
                      <div className="animate-spin rounded-full border-2 border-transparent border-t-[var(--reasoning-color)] h-3 w-3" style={{ animationDuration: '0.8s' }}></div>
                      <span>Thinking for {elapsedTime}s</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-3 w-3 text-green-500" strokeWidth={2.5} />
                      <span>Completed in {elapsedTime}s</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={handleFullScreenToggle}
              className="p-2 hover:bg-[var(--accent)] rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-[var(--muted)]" />
            </button>
          </div>
          
          {/* 콘텐츠 */}
          <div 
            ref={fullScreenScrollRef}
            className="flex-1 overflow-y-auto p-6 text-[var(--foreground)] leading-relaxed scroll-smooth"
          >
            <MarkdownContent content={content} variant="clean" />
          </div>
        </div>
      </div>,
      document.body
    );
  }
  return (
    <div className="flex justify-start">
      <div 
        className="group relative cursor-pointer"
        onClick={handleToggle}
      >
        {/* 메인 생각 버블 */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-full backdrop-blur-xl border border-[var(--subtle-divider)] hover:scale-[1.02] transition-all duration-200 ease-out" style={{ backgroundColor: 'color-mix(in srgb, var(--background) 80%, transparent)' }}>
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
        {/* <div className="absolute -bottom-0.5 left-4 flex gap-0.5">
          <div className="w-1 h-1 rounded-full" style={{ backgroundColor: 'color-mix(in srgb, var(--background) 60%, transparent)' }}></div>
          <div className="w-0.5 h-0.5 rounded-full" style={{ backgroundColor: 'color-mix(in srgb, var(--background) 40%, transparent)' }}></div>
        </div> */}

        {/* 상세 정보 툴팁 */}

        <div className={`absolute bottom-full left-0 mb-3 w-80 sm:w-96 bg-[var(--background)] backdrop-blur-xl rounded-2xl border border-[var(--subtle-divider)] p-4 z-50 transition-all duration-200 ease-out ${isExpanded ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-1 pointer-events-none'}`} 
        // style={{ boxShadow: '0 10px 25px -5px var(--overlay), 0 4px 6px -2px var(--overlay)' }}
        >         
         {/* 툴팁 화살표 */}
        <div className="absolute -bottom-1.5 left-6 w-3 h-3 bg-[var(--background)] border-r border-b border-[var(--subtle-divider)] rotate-45"></div>          
          {/* 툴팁 상태: 아이콘과 함께 상세 시간 표시 */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
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
            <button
              onClick={handleFullScreenToggle}
              className="p-1 hover:bg-[var(--accent)] rounded-lg transition-colors"
              title="Expand to full screen"
            >
              <Maximize2 className="h-3.5 w-3.5 text-[var(--muted)]" />
            </button>
          </div>
          
          {/* AI의 전체 생각 내용 */}
          <div 
            ref={scrollContainerRef}
            className="text-sm text-[var(--foreground)] max-h-24 overflow-y-auto scrollbar-thin leading-relaxed scroll-smooth"
          >
            <MarkdownContent content={content} variant="clean" />
          </div>
                    {/* 전체 화면으로 보기 힌트 */}
                    {/* <div className="mt-2 pt-2 border-t border-black/5 dark:border-white/10">
            <button
              onClick={handleFullScreenToggle}
              className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            >
              Click <Maximize2 className="inline h-3 w-3 mx-1" /> to expand
            </button>
          </div> */}
        </div>
      </div>
    </div>
  );
}

export const ReasoningSection = React.memo(ReasoningSectionComponent);
