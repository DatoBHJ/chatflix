import React, { useState, useRef, useEffect } from 'react';
import { MarkdownContent } from './MarkdownContent';
import { Brain, ChevronDown, ChevronUp } from 'lucide-react';

interface ReasoningSectionProps {
  content: string;
  isComplete?: boolean;
}

function ReasoningSectionComponent({ content, isComplete }: ReasoningSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number | undefined>(undefined);
  
  const userOverrideRef = useRef<boolean | null>(null);
  const prevIsCompleteRef = useRef<boolean | undefined>(isComplete);
  const prevContentRef = useRef<string>(content);

  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
      if (isExpanded) {
        contentRef.current.scrollTop = contentRef.current.scrollHeight;
      }
    }
  }, [content, isExpanded]);

  useEffect(() => {
    if (prevIsCompleteRef.current === true && isComplete === false) {
      userOverrideRef.current = null;
    }

    if (userOverrideRef.current !== null) {
      setIsExpanded(userOverrideRef.current);
    } else {
      if (isComplete) {
        setIsExpanded(false);
      } else {
        setIsExpanded(false);
      }
    }
    prevIsCompleteRef.current = isComplete;
  }, [isComplete]);

  const handleToggle = () => {
    const newExpansionState = !isExpanded;
    setIsExpanded(newExpansionState);
    userOverrideRef.current = newExpansionState;
  };

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
          {!isComplete && (
            <div className="inline-flex text-xs items-center gap-1.5 text-blue-400 mr-2">
              <span className="relative flex h-2.5 w-2.5 mr-0.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
              </span>
              In Progress
            </div>
          )}
          {isComplete && (
            <div className="inline-flex text-xs items-center gap-1.5 text-green-400 mr-2">
              <span className="relative flex h-2.5 w-2.5 mr-0.5">
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
              </span>
              Complete
            </div>
          )}
          <div className="rounded-full p-1 hover:bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] transition-colors">
            {isExpanded ? 
              <ChevronUp size={16} className="text-[color-mix(in_srgb,var(--foreground)_50%,transparent)]" /> : 
              <ChevronDown size={16} className="text-[color-mix(in_srgb,var(--foreground)_50%,transparent)]" />
            }
          </div>
        </div>
      </div>
      <div 
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{ 
          maxHeight: isExpanded ? (contentHeight ? `${contentHeight}px` : '400px') : '0px',
        }}
      >
        <div
          ref={contentRef}
          className="max-h-[400px] overflow-auto transition-opacity duration-300 ease-in-out px-4 sm:px-10 py-4 sm:py-6"
          style={{
            opacity: isExpanded ? 1 : 0,
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}
        >
          <style jsx>{`
            div::-webkit-scrollbar {
              display: none;
            }
          `}</style>
          <MarkdownContent content={content} />
        </div>
      </div>
    </div>
  );
}

export const ReasoningSection = React.memo(ReasoningSectionComponent); 