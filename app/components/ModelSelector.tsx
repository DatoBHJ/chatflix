import { Dispatch, SetStateAction, useState, useRef, useEffect } from 'react';
import { getEnabledModels } from '@/lib/models/config';
import Image from 'next/image';
import type { ModelConfig } from '@/lib/models/config';

// Helper function to get the logo path based on provider
const getProviderLogo = (provider: ModelConfig['provider']) => {
  const logoMap: Partial<Record<ModelConfig['provider'], string>> = {
    anthropic: '/logo/anthropic.svg',
    openai: '/logo/openai.svg',
    google: '/logo/google.svg',
    together: '/logo/together.svg',
    xai: '/logo/grok.svg',
    deepseek: '/logo/deepseek.svg',
    groq: '/logo/groq.svg'
  };
  
  // For providers without specific logos, we'll use a text-based fallback
  return logoMap[provider] || '';
};

// Helper function to check if a logo exists for a provider
const hasLogo = (provider: ModelConfig['provider']) => {
  const providersWithLogos: ModelConfig['provider'][] = ['anthropic', 'openai', 'google', 'together', 'xai', 'deepseek', 'groq'];
  return providersWithLogos.includes(provider);
};

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
      
      /* 모델 옵션 내 로고 스타일 */
      .provider-logo {
        transition: all 0.3s ease;
        opacity: 0.7;
      }
      
      .model-option:hover .provider-logo {
        opacity: 1;
      }
      
      /* 툴팁 스타일 */
      .tooltip {
        position: relative;
      }
      
      .tooltip::before {
        content: attr(data-tooltip);
        position: absolute;
        bottom: 100%;
        left: 50%;
        transform: translateX(-50%) translateY(-4px);
        padding: 4px 8px;
        background: var(--background);
        color: var(--foreground);
        font-size: 10px;
        border-radius: 4px;
        white-space: nowrap;
        opacity: 0;
        visibility: hidden;
        transition: all 0.2s ease;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        pointer-events: none;
        z-index: 100;
      }
      
      .tooltip:hover::before {
        opacity: 1;
        visibility: visible;
        transform: translateX(-50%) translateY(-8px);
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
            className={`futuristic-select-button px-3 py-1 text-sm tracking-wide transition-all flex items-center ${isOpen ? 'text-[var(--foreground)] active' : 'text-[var(--muted)] hover:text-[var(--foreground)]'}`}
            disabled={disabled}
            aria-expanded={isOpen}
            aria-haspopup="listbox"
          >
            <div className="flex items-center gap-2">
              {currentModelOption?.provider && (
                <div 
                  className="provider-logo w-4 h-4 flex-shrink-0 tooltip" 
                  data-tooltip={currentModelOption.provider.charAt(0).toUpperCase() + currentModelOption.provider.slice(1)}
                >
                  {hasLogo(currentModelOption.provider) ? (
                    <Image 
                      src={getProviderLogo(currentModelOption.provider)}
                      alt={`${currentModelOption.provider} logo`}
                      width={16}
                      height={16}
                      className="object-contain"
                    />
                  ) : (
                    <div className="w-4 h-4 flex items-center justify-center text-[8px] uppercase bg-[var(--accent)]/10 rounded-sm">
                      {currentModelOption.provider.substring(0, 1)}
                    </div>
                  )}
                </div>
              )}
              <span>{currentModelOption?.name || nextModel}</span>
            </div>
            <span className="ml-1 opacity-60 text-xl">▾</span>
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
                      <div className="flex flex-col">
                        <div className="text-base font-normal mb-1 transition-all flex items-center gap-2">
                          {/* Provider Logo */}
                          {option.provider && (
                            <div 
                              className="provider-logo w-4 h-4 flex-shrink-0 tooltip" 
                              data-tooltip={option.provider.charAt(0).toUpperCase() + option.provider.slice(1)}
                            >
                              {hasLogo(option.provider) ? (
                                <Image 
                                  src={getProviderLogo(option.provider)}
                                  alt={`${option.provider} logo`}
                                  width={16}
                                  height={16}
                                  className="object-contain"
                                />
                              ) : (
                                <div className="w-4 h-4 flex items-center justify-center text-[8px] uppercase bg-[var(--accent)]/10 rounded-sm">
                                  {option.provider.substring(0, 1)}
                                </div>
                              )}
                            </div>
                          )}
                          <span className="model-name">
                            {option.name}
                          </span>
                        </div>
                        <div className="flex items-start">
                          <div className="w-4 mr-2 flex-shrink-0"></div>
                          <div className={`text-xs transition-all
                                    ${option.id === nextModel || hoverIndex === index ? 'text-[var(--muted)]' : 'text-[var(--muted)] opacity-60'}`}>
                            {option.description}
                          </div>
                        </div>
                      </div>
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