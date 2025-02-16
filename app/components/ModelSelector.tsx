import { Dispatch, SetStateAction, useState, useRef, useEffect } from 'react';

interface ModelOption {
  id: string;
  name: string;
  description: string;
}

interface ModelSelectorProps {
  currentModel: string;
  nextModel: string;
  setNextModel: Dispatch<SetStateAction<string>>;
  disabled?: boolean;
  position?: 'top' | 'bottom';
}

export const MODEL_OPTIONS: ModelOption[] = [
  {
    id: 'claude-3-5-sonnet-latest',
    name: 'Claude 3.5 Sonnet',
    description: 'GOAT'
  },
  // {
  //   id: 'deepseek-reasoner',
  //   name: 'DeepSeek Reasoner',
  //   description: 'Shows step-by-step reasoning. Great for math and problem-solving.'
  // },
  // {
  //   id: 'deepseek-chat',
  //   name: 'DeepSeek Chat',
  //   description: 'Fast and efficient. Perfect for casual conversations.'
  // },
  {
    id: 'deepseek-ai/DeepSeek-R1',
    name: 'DeepSeek R1',
    description: 'DeepSeek R1 by together.ai.\n Advanced reasoning model.'
  },
  // {
  //   id: 'deepseek-ai/DeepSeek-R1-Distill-Llama-70B-free',
  //   name: 'DeepSeek R1 Distill 70B (Free)',
  //   description: 'Free version of DeepSeek R1. Good for general use and coding.'
  // },
  {
    id: 'deepseek-ai/DeepSeek-V3',
    name: 'DeepSeek V3',
    description: 'DeepSeek V3 by together.ai.\n Good for general use.'
  },
  {
    id: 'DeepSeek r1 distill llama 70b',
    name: 'DeepSeek R1 distill llama 70b',
    description: 'DeepSeek R1 distill llama 70b by groq.\n High-speed reasoning model.'
  }
];

export function ModelSelector({ currentModel, nextModel, setNextModel, disabled, position = 'bottom' }: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Check if mobile on mount and window resize
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 640); // sm breakpoint
    };
    
    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);
    return () => window.removeEventListener('resize', checkIfMobile);
  }, []);

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <div className="flex items-center gap-4">
        <span className="text-xs sm:text-sm uppercase tracking-wider text-[var(--muted)]">Model</span>
        <div className={`relative ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
          <button
            onClick={() => !disabled && setIsOpen(!isOpen)}
            className={`yeezy-model-selector text-[var(--muted)] ${isOpen ? 'text-[var(--foreground)]' : ''}`}
            disabled={disabled}
            aria-expanded={isOpen}
            aria-haspopup="listbox"
          >
            {MODEL_OPTIONS.find(option => option.id === nextModel)?.name || nextModel}
          </button>
          {isOpen && !disabled && (
            <div 
              className={`
                ${isMobile 
                  ? 'fixed inset-x-0 bottom-0 w-full max-h-[80vh] overflow-y-auto rounded-t-lg' 
                  : `absolute ${position === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'} left-0 w-[280px]`}
                bg-[var(--background)] border border-[var(--accent)] shadow-lg z-50
                animate-fade-in
              `}
              role="listbox"
            >
              {isMobile && (
                <div className="sticky top-0 flex items-center justify-between p-3 bg-[var(--background)] border-b border-[var(--accent)]">
                  <span className="text-sm font-medium">Select Model</span>
                  <button 
                    onClick={() => setIsOpen(false)}
                    className="text-[var(--muted)] hover:text-[var(--foreground)]"
                  >
                    Close
                  </button>
                </div>
              )}
              {MODEL_OPTIONS.map(option => (
                <div 
                  key={option.id}
                  className={`p-3 ${!isMobile ? 'border-b border-[var(--accent)]' : ''} last:border-b-0
                             ${option.id === nextModel ? 'bg-[var(--accent)]' : ''}
                             hover:bg-[var(--accent)] transition-colors cursor-pointer
                             ${isMobile ? 'p-4' : ''}`}
                  onClick={() => {
                    setNextModel(option.id);
                    setIsOpen(false);
                  }}
                  role="option"
                  aria-selected={option.id === nextModel}
                >
                  <div className={`text-sm sm:text-base font-medium mb-1 ${isMobile ? 'text-base' : ''}`}>
                    {option.name}
                  </div>
                  <div className={`text-xs text-[var(--muted)] whitespace-pre-line ${isMobile ? 'text-sm' : ''}`}>
                    {option.description}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 