import React, { useState, useRef, useEffect } from 'react';
import { MarkdownContent } from './MarkdownContent';
import { Brain, ChevronDown, ChevronUp } from 'lucide-react';

interface PlanningSectionProps {
  planningData: {
    planningThoughts: string;
    isComplete: boolean;
    timestamp?: string;
  };
  isExpanded?: boolean;
  setIsExpanded?: (expanded: boolean) => void;
}

function PlanningSectionComponent({ 
  planningData,
  isExpanded: externalIsExpanded,
  setIsExpanded: externalSetIsExpanded 
}: PlanningSectionProps) {
  // Default to false (closed) unless user overrides.
  const [internalIsExpanded, setInternalIsExpanded] = useState(false); 
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number | undefined>(undefined);
  
  // Use external state if provided, otherwise use internal state
  const isExpanded = externalIsExpanded !== undefined ? externalIsExpanded : internalIsExpanded;
  const setIsExpanded = externalSetIsExpanded || setInternalIsExpanded;
  
  const userOverrideRef = useRef<boolean | null>(null);
  const prevIsCompleteRef = useRef<boolean | undefined>(planningData?.isComplete);
  const prevPlanningThoughtsRef = useRef<string | undefined>(planningData?.planningThoughts);

  useEffect(() => {
    if (contentRef.current) {
      const currentScrollHeight = contentRef.current.scrollHeight;
      setContentHeight(currentScrollHeight);
      if (isExpanded) {
        contentRef.current.scrollTop = currentScrollHeight;
      }
    }
  }, [planningData?.planningThoughts, isExpanded]);

  // Auto-expand when not complete, auto-collapse when complete (only for internal state)
  useEffect(() => {
    if (!planningData) {
      if (externalIsExpanded === undefined) {
        setInternalIsExpanded(false);
      }
      userOverrideRef.current = null; // Reset override if no data
      return;
    }

    const { planningThoughts, isComplete } = planningData;

    // Only apply automatic behavior when external state is not controlling
    if (externalIsExpanded === undefined) {
      if (prevIsCompleteRef.current === true && isComplete === false) {
        userOverrideRef.current = null;
        // When a new planning phase starts, ensure it's closed by default
        setInternalIsExpanded(false); 
      }
      
      // If user has manually toggled the section, respect their choice.
      if (userOverrideRef.current !== null) {
        setInternalIsExpanded(userOverrideRef.current);
      } else {
        // Auto-expand when not complete, auto-collapse when complete
        if (!isComplete) {
          setInternalIsExpanded(true);
        } else {
          setInternalIsExpanded(false);
        }
      }
    }
    
    prevIsCompleteRef.current = isComplete;
    prevPlanningThoughtsRef.current = planningThoughts;

  }, [planningData, externalIsExpanded]);

  const handleToggle = () => {
    const newExpansionState = !isExpanded;
    setIsExpanded(newExpansionState);
    
    // Only track user override for internal state management
    if (externalIsExpanded === undefined) {
      userOverrideRef.current = newExpansionState; 
    }
  };

  if (!planningData || !planningData.planningThoughts) {
    return null;
  }

  return (
    <div className="p-4 sm:p-5 bg-gradient-to-br from-[color-mix(in_srgb,var(--background)_97%,var(--foreground)_3%)] to-[color-mix(in_srgb,var(--background)_99%,var(--foreground)_1%)] backdrop-blur-xl rounded-xl border border-[color-mix(in_srgb,var(--foreground)_7%,transparent)] shadow-sm mb-6">
      <div 
        className="flex items-center justify-between w-full mb-4 cursor-pointer"
        onClick={handleToggle}
      >
        <div className="flex items-center gap-2.5">
          <Brain className="h-4 w-4 text-[var(--foreground)]" strokeWidth={1.5} />
          <h2 className="font-medium text-left tracking-tight">Planning next moves</h2>
        </div>
        <div className="flex items-center gap-2">
          {!planningData.isComplete && planningData.planningThoughts && (
            <div className="inline-flex text-xs items-center gap-1.5 text-blue-400 mr-2">
              <span className="relative flex h-2.5 w-2.5 mr-0.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
              </span>
              In progress
            </div>
          )}
          {planningData.isComplete && (
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
          <MarkdownContent content={planningData.planningThoughts} />
        </div>
      </div>
    </div>
  );
}

export const PlanningSection = React.memo(PlanningSectionComponent); 