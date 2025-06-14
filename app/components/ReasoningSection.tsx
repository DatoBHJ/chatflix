import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MarkdownContent } from './MarkdownContent';
import { Brain, ChevronDown, ChevronUp } from 'lucide-react';

interface ReasoningSectionProps {
  content: string;
  isComplete?: boolean;
  isExpanded?: boolean;
  setIsExpanded?: (expanded: boolean) => void;
}

// MarkdownContent를 memo로 감싸서 불필요한 리렌더링 방지
const MemoizedMarkdownContent = React.memo(MarkdownContent);

function ReasoningSectionComponent({ 
  content, 
  isComplete = false, 
  isExpanded: externalIsExpanded,
  setIsExpanded: externalSetIsExpanded 
}: ReasoningSectionProps) {
  const [internalIsExpanded, setInternalIsExpanded] = useState(!isComplete);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number | undefined>(undefined);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Use external state if provided, otherwise use internal state
  const isExpanded = externalIsExpanded !== undefined ? externalIsExpanded : internalIsExpanded;
  const setIsExpanded = externalSetIsExpanded || setInternalIsExpanded;

  // 스크롤 조정을 지연시켜 성능 개선
  const handleScrollToBottom = useCallback(() => {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    
    scrollTimeoutRef.current = setTimeout(() => {
      if (contentRef.current && isExpanded && !isComplete) {
        contentRef.current.scrollTop = contentRef.current.scrollHeight;
      }
    }, 50); // 50ms 지연으로 렌더링 완료 후 스크롤
  }, [isExpanded, isComplete]);

  // contentHeight 계산도 지연시켜 성능 개선
  const updateContentHeight = useCallback(() => {
    if (contentRef.current) {
      const newHeight = contentRef.current.scrollHeight;
      if (newHeight !== contentHeight) {
        setContentHeight(newHeight);
      }
    }
  }, [contentHeight]);

  useEffect(() => {
    updateContentHeight();
    handleScrollToBottom();
  }, [content, updateContentHeight, handleScrollToBottom]);

  // Auto-expand when not complete, auto-collapse when complete (only for internal state)
  useEffect(() => {
    if (externalIsExpanded === undefined) {
      if (!isComplete) {
        setInternalIsExpanded(true);
      } else {
        setInternalIsExpanded(false);
      }
    }
  }, [isComplete, externalIsExpanded]);

  // cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  const handleToggle = useCallback(() => {
    const newExpansionState = !isExpanded;
    setIsExpanded(newExpansionState);
  }, [isExpanded, setIsExpanded]);

  // Status indicator를 memo로 최적화
  const statusIndicator = useMemo(() => {
    if (!isComplete) {
      return (
        <div className="inline-flex text-xs items-center gap-1.5 text-blue-400 mr-2">
          <span className="relative flex h-2.5 w-2.5 mr-0.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
          </span>
          In Progress
        </div>
      );
    }
    
    return (
      <div className="inline-flex text-xs items-center gap-1.5 text-green-400 mr-2">
        <span className="relative flex h-2.5 w-2.5 mr-0.5">
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
        </span>
        Complete
      </div>
    );
  }, [isComplete]);

  return (
    <div className="p-4 sm:p-5 bg-gradient-to-br from-[color-mix(in_srgb,var(--background)_97%,var(--foreground)_3%)] to-[color-mix(in_srgb,var(--background)_99%,var(--foreground)_1%)] backdrop-blur-xl rounded-xl border border-[color-mix(in_srgb,var(--foreground)_7%,transparent)] shadow-sm mb-6">
      <div 
        className="flex items-center justify-between w-full mb-4 cursor-pointer"
        onClick={handleToggle}
      >
        <div className="flex items-center gap-2.5">
          <Brain className="h-4 w-4 text-[var(--foreground)]" strokeWidth={1.5} />
          <h2 className="font-medium text-left tracking-tight">Thinking</h2>
        </div>
        <div className="flex items-center gap-2">
          {statusIndicator}
          <div className="rounded-full p-1 hover:bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] transition-colors">
            {isExpanded ? 
              <ChevronUp size={16} className="text-[color-mix(in_srgb,var(--foreground)_50%,transparent)]" /> : 
              <ChevronDown size={16} className="text-[color-mix(in_srgb,var(--foreground)_50%,transparent)]" />
            }
          </div>
        </div>
      </div>
      
      {/* framer-motion으로 부드러운 애니메이션 */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ 
              height: contentHeight ? `${Math.min(contentHeight, 400)}px` : 'auto',
              opacity: 1 
            }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ 
              duration: 0.3, 
              ease: [0.4, 0, 0.2, 1] // easeOutCubic for smoother animation
            }}
            className="overflow-hidden"
          >
            <div
              ref={contentRef}
              className="max-h-[400px] overflow-auto px-4 sm:px-10 py-4 sm:py-6"
              style={{
                scrollbarWidth: 'none',
                msOverflowStyle: 'none'
              }}
            >
              <style jsx>{`
                div::-webkit-scrollbar {
                  display: none;
                }
              `}</style>
              <MemoizedMarkdownContent content={content} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export const ReasoningSection = React.memo(ReasoningSectionComponent); 