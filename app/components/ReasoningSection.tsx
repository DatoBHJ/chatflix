import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';

interface ReasoningSectionProps {
  content: string;
  isComplete?: boolean;
  hideToggle?: boolean;
  isExpanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
}

function ReasoningSectionComponent({ 
  content, 
  isComplete = false, 
  hideToggle = false,
  isExpanded,
  onExpandedChange
}: ReasoningSectionProps) {
  const [internalExpanded, setInternalExpanded] = useState(false);
  const expanded = typeof isExpanded === 'boolean' ? isExpanded : internalExpanded;
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);

  useEffect(() => {
    if (expanded) {
      shouldAutoScrollRef.current = true;
    }
  }, [expanded]);

  useEffect(() => {
    if (expanded && shouldAutoScrollRef.current && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [content, expanded]);

  useEffect(() => {
    if (!expanded || !scrollContainerRef.current) return;

    const container = scrollContainerRef.current;
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isNearBottom = scrollHeight - (scrollTop + clientHeight) < 32;
      shouldAutoScrollRef.current = isNearBottom;
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [expanded]);

  const toggleExpanded = useCallback(() => {
    const next = !expanded;
    if (onExpandedChange) {
      onExpandedChange(next);
    }
    if (isExpanded === undefined) {
      setInternalExpanded(next);
    }
  }, [expanded, isExpanded, onExpandedChange]);

  return (
    <div className="my-0 text-sm font-sans max-w-[85%] md:max-w-[75%] lg:max-w-[65%] xl:max-w-[60%]">
      {!hideToggle && (
        <div className="pt-12 sm:pt-30 pb-8">
          <div className="flex items-center gap-3">
            {!isComplete && (
              <div className="w-2 h-2 bg-gradient-to-r from-amber-400 to-amber-600 rounded-full animate-pulse"></div>
            )}

            <h2 className="text-3xl sm:text-3xl md:text-4xl font-semibold tracking-tight">
              Thinking
            </h2>
          </div>
          
          <div className="mt-10 text-base text-[var(--muted)]">
            <button
              onClick={toggleExpanded}
              className="mb-5 text-base font-normal text-[var(--muted)] pl-1.5 cursor-pointer hover:text-[var(--foreground)] transition-colors"
            >
              <span className="flex items-center gap-2">
                Reasoning Process
                <svg
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </span>
            </button>
          </div>
        </div>
      )}

      <div
        className={`${expanded ? 'block pt-4 sm:pt-5' : 'hidden'}`}
      >
        <div
          ref={scrollContainerRef}
          className="text-[var(--foreground)]/80 leading-relaxed px-0 sm:px-4 max-h-[420px] overflow-y-auto"
          style={{
            wordBreak: 'break-word',
            overflowWrap: 'break-word'
          }}
        >
          <div className="overflow-x-auto">
            <ReactMarkdown
              components={{
                p: ({ children }) => <p className="mb-4">{children}</p>,
                h1: ({ children }) => <h1 className="text-2xl font-bold mb-4 mt-6">{children}</h1>,
                h2: ({ children }) => <h2 className="text-xl font-semibold mb-3 mt-5">{children}</h2>,
                h3: ({ children }) => <h3 className="text-lg font-medium mb-3 mt-4">{children}</h3>,
                strong: ({ children }) => <strong className="font-semibold text-lg">{children}</strong>,
                em: ({ children }) => <em className="italic">{children}</em>,
                ul: ({ children }) => <ul className="list-disc pl-5 mb-4 mt-2">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal pl-5 mb-4 mt-2">{children}</ol>,
                li: ({ children }) => <li className="mb-1">{children}</li>,
                blockquote: ({ children }) => <blockquote className="border-l-4 border-[var(--accent)] pl-4 my-4 italic">{children}</blockquote>,
                hr: () => <hr className="my-6 border-[var(--accent)]" />,
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
}

export const ReasoningSection = React.memo(ReasoningSectionComponent);
