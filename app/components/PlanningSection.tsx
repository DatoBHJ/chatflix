import React, { useState, useRef, useEffect } from 'react';
import { MarkdownContent } from './MarkdownContent';
import { Brain, ChevronDown, ChevronUp } from 'lucide-react';

interface PlanningSectionProps {
  planningData: {
    planningThoughts: string;
    isComplete: boolean;
    timestamp?: string;
  };
}

function PlanningSectionComponent({ planningData }: PlanningSectionProps) {
  // Default to false (closed) unless user overrides.
  const [isExpanded, setIsExpanded] = useState(false); 
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number | undefined>(undefined);
  
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

  useEffect(() => {
    if (!planningData) {
      setIsExpanded(false);
      userOverrideRef.current = null; // Reset override if no data
      return;
    }

    const { planningThoughts, isComplete } = planningData;

    if (prevIsCompleteRef.current === true && isComplete === false) {
      userOverrideRef.current = null;
      // When a new planning phase starts, ensure it's closed by default
      // unless the user immediately clicks to open it AFTER this reset.
      // This specific setIsExpanded(false) ensures it respects the new default closed state.
      setIsExpanded(false); 
    }
    
    // If user has manually toggled the section, respect their choice.
    if (userOverrideRef.current !== null) {
      setIsExpanded(userOverrideRef.current);
    } else {
      // If no user override, it remains in its current state (which would be closed by default
      // or after a reset, or whatever state it was programmatically set to if ever).
      // For this logic, it means it defaults to closed.
      // No automatic opening here; it remains closed unless userOverrideRef is set.
      // If it was reset above due to new planning phase, it became false.
      // If it was already false and no user override, it stays false.
      if (isExpanded && isComplete) { // Only auto-close if it was somehow open and then completes
        setIsExpanded(false);
      } else if (userOverrideRef.current === null) {
        // Ensures that if userOverride is cleared, it respects the default closed state
        // This covers the case where it might have been open due to a previous user action in a prior cycle
        // and now it's a new cycle without user interaction yet.
        setIsExpanded(false);
      }
    }
    
    prevIsCompleteRef.current = isComplete;
    prevPlanningThoughtsRef.current = planningThoughts;

  }, [planningData]);

  const handleToggle = () => {
    const newExpansionState = !isExpanded;
    setIsExpanded(newExpansionState);
    userOverrideRef.current = newExpansionState; 
  };

  if (!planningData || !planningData.planningThoughts) {
    return null;
  }

  return (
    <div className="p-4 sm:p-5 bg-gradient-to-br from-[color-mix(in_srgb,var(--background)_97%,var(--foreground)_3%)] to-[color-mix(in_srgb,var(--background)_99%,var(--foreground)_1%)] backdrop-blur-xl rounded-xl border border-[color-mix(in_srgb,var(--foreground)_7%,transparent)] shadow-sm mb-8">
      <div 
        className="flex items-center justify-between w-full mb-4 cursor-pointer"
        onClick={handleToggle}
      >
        <div className="flex items-center gap-2.5">
          <Brain className="h-4 w-4 text-[var(--foreground)]" strokeWidth={1.5} />
          <h2 className="font-medium text-left tracking-tight">Creating Plan</h2>
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