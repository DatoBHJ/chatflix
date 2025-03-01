import { Dispatch, SetStateAction, useState, useRef, useEffect } from 'react';
import { getEnabledModels } from '@/lib/models/config';

interface ModelSelectorProps {
  currentModel: string;
  nextModel: string;
  setNextModel: Dispatch<SetStateAction<string>>;
  disabled?: boolean;
  position?: 'top' | 'bottom';
}

export function ModelSelector({ currentModel, nextModel, setNextModel, disabled, position = 'bottom' }: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  const MODEL_OPTIONS = getEnabledModels();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

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

  // Add styles to the document head
  useEffect(() => {
    const style = document.createElement('style');
    
    style.textContent = `
      /* 미래적인 선택 버튼 스타일 */
      .futuristic-select-button {
        position: relative;
        transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
      }
      
      /* 버튼 하단의 그라데이션 라인 효과 */
      .futuristic-select-button::after {
        content: "";
        position: absolute;
        bottom: -2px;
        left: 0;
        width: 100%;
        height: 1px;
        background: linear-gradient(to right, transparent, var(--muted), transparent);
        opacity: 0;
        transform: scaleX(0.8);
        transition: all 0.3s ease;
      }
      
      /* 호버 상태와 활성 상태에서 라인 표시 */
      .futuristic-select-button:hover::after, 
      .futuristic-select-button.active::after {
        opacity: 0.7;
        transform: scaleX(1);
      }
      
      /* 드롭다운 메뉴 스타일 */
      .model-dropdown {
        animation: fadeInUp 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
        backdrop-filter: blur(12px);
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
      }
      
      /* 드롭다운 옵션 스타일 */
      .model-option {
        position: relative;
        overflow: hidden;
        transition: all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
      }
      
      /* 선택된 모델 표시 효과 */
      .selected-indicator {
        position: absolute;
        right: 12px;
        opacity: 0;
        transition: opacity 0.25s ease, transform 0.25s ease;
      }
      
      .model-option.active .selected-indicator {
        opacity: 0.8;
        transform: scale(1);
      }
      
      /* 모델 이름 호버 효과 */
      .model-name {
        position: relative;
        display: inline-block;
        transition: all 0.3s ease;
      }
      
      /* 모델 이름 밑에 그라데이션 라인 */
      .model-name::after {
        content: '';
        position: absolute;
        bottom: -2px;
        left: 0;
        width: 100%;
        height: 1px;
        background: linear-gradient(to right, transparent, var(--foreground), transparent);
        transform: scaleX(0);
        opacity: 0;
        transition: transform 0.3s ease, opacity 0.3s ease;
        transform-origin: center;
      }
      
      /* 호버 시 모델 이름 효과 */
      .model-option:hover .model-name {
        transform: translateY(-1px);
      }
      
      /* 호버 시 밑줄 효과 */
      .model-option:hover .model-name::after {
        transform: scaleX(1);
        opacity: 0.6;
      }
      
      /* 페이드 인 업 애니메이션 */
      @keyframes fadeInUp {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      
      /* 스크롤바 스타일 */
      .model-selector-scroll::-webkit-scrollbar {
        width: 3px;
      }
      
      .model-selector-scroll::-webkit-scrollbar-track {
        background: transparent;
      }
      
      .model-selector-scroll::-webkit-scrollbar-thumb {
        background: var(--accent);
        opacity: 0.2;
        border-radius: 3px;
      }
      
      .model-selector-scroll {
        scrollbar-width: thin;
        scrollbar-color: var(--accent) transparent;
      }
      
      /* 모바일 스타일 */
      @media (max-width: 640px) {
        .mobile-handle {
          position: absolute;
          top: 8px;
          left: 50%;
          transform: translateX(-50%);
          width: 36px;
          height: 4px;
          background: var(--accent);
          opacity: 0.2;
          border-radius: 2px;
        }
      }
    `;
    
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const currentModelOption = MODEL_OPTIONS.find(option => option.id === nextModel);

  return (
    <div className="relative" ref={containerRef}>
      <div className="flex items-center gap-4">
        <div className={`relative ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
          <button
            onClick={() => !disabled && setIsOpen(!isOpen)}
            className={`futuristic-select-button px-3 py-1 text-sm tracking-wide transition-all ${isOpen ? 'text-[var(--foreground)] active' : 'text-[var(--muted)] hover:text-[var(--foreground)]'}`}
            disabled={disabled}
            aria-expanded={isOpen}
            aria-haspopup="listbox"
          >
            {currentModelOption?.name || nextModel}
            <span className="ml-2 opacity-60 text-xl">▾</span>
          </button>
          
          {isOpen && !disabled && (
            <div 
              className={`
                model-dropdown
                ${isMobile 
                  ? 'fixed inset-x-0 bottom-0 w-full max-h-[80vh] overflow-y-auto pb-6 model-selector-scroll rounded-t-xl' 
                  : `absolute ${position === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'} left-0 w-[280px] max-h-[400px] overflow-y-auto model-selector-scroll rounded-md`}
                bg-[var(--background)]/90 z-50
              `}
              role="listbox"
            >
              {isMobile && (
                <div className="sticky top-0 z-10 backdrop-blur-md bg-[var(--background)]/95 pt-6 pb-3">
                  <div className="mobile-handle"></div>
                  <div className="flex items-center justify-between px-4 mt-2">
                    <span className="text-xs uppercase tracking-wider opacity-70">Models</span>
                    <button 
                      onClick={() => setIsOpen(false)}
                      className="text-[var(--muted)] hover:text-[var(--foreground)] text-xs"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
              
              <div className="py-1">
                {MODEL_OPTIONS.length > 0 ? (
                  MODEL_OPTIONS.map((option, index) => (
                    <div 
                      key={option.id}
                      className={`model-option px-4 py-4 last:border-b-0 relative
                               ${option.id === nextModel ? 'bg-[var(--accent)]/10 active' : ''}
                               hover:bg-[var(--accent)]/5 transition-all cursor-pointer
                               ${isMobile ? 'p-5' : ''}`}
                      onClick={() => {
                        setNextModel(option.id);
                        setIsOpen(false);
                      }}
                      onMouseEnter={() => setHoverIndex(index)}
                      onMouseLeave={() => setHoverIndex(null)}
                      role="option"
                      aria-selected={option.id === nextModel}
                    >
                      <div className="text-base font-normal mb-1 transition-all">
                        <span className="model-name">
                          {option.name}
                        </span>
                      </div>
                      <div className={`text-xs transition-all
                                   ${option.id === nextModel || hoverIndex === index ? 'text-[var(--muted)]' : 'text-[var(--muted)] opacity-60'}`}>
                        {option.description}
                      </div>
                      
                      {/* {option.id === nextModel && (
                        <div className="selected-indicator text-[var(--accent)]">
                          ✓
                        </div>
                      )} */}
                    </div>
                  ))
                ) : (
                  <div className="px-4 py-3 text-sm text-[var(--muted)] opacity-70">
                    No models available
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}