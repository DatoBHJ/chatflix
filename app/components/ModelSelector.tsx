import { Dispatch, SetStateAction, useState, useRef, useEffect } from 'react';
import { getEnabledModels, ModelConfig } from '@/lib/models/config';

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
    // 스타일 요소를 생성합니다
    const style = document.createElement('style');
    
    // CSS 텍스트 내용을 정의합니다
    style.textContent = `
      /* 미래적인 선택 버튼 스타일 */
      .futuristic-select-button {
        position: relative;
        transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1); /* 부드러운 전환 효과 */
      }
      
      /* 버튼 하단의 그라데이션 라인 효과 */
      .futuristic-select-button::after {
        content: "";
        position: absolute;
        bottom: -2px;
        left: 0;
        width: 100%;
        height: 1px;
        background: linear-gradient(to right, transparent, var(--muted), transparent); /* 가운데가 밝은 그라데이션 */
        opacity: 0; /* 기본적으로 보이지 않음 */
        transform: scaleX(0.8); /* 기본 너비를 80%로 설정 */
        transition: all 0.3s ease; /* 부드러운 전환 효과 */
      }
      
      /* 호버 상태와 활성 상태에서 라인 표시 */
      .futuristic-select-button:hover::after, 
      .futuristic-select-button.active::after {
        opacity: 0.7; /* 호버/활성 상태에서 가시성 증가 */
        transform: scaleX(1); /* 너비를 100%로 확장 */
      }
      
      /* 드롭다운 메뉴 스타일 */
      .futuristic-dropdown {
        animation: fadeIn 0.3s cubic-bezier(0.25, 0.8, 0.25, 1); /* 페이드 인 애니메이션 */
        backdrop-filter: blur(8px); /* 배경 블러 효과 */
      }
      
      /* 드롭다운 옵션 스타일 */
      .futuristic-option {
        position: relative;
        overflow: hidden;
        transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1); /* 부드러운 전환 효과 */
      }
      
      /* 옵션 왼쪽의 하이라이트 바 */
      .futuristic-option::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 2px;
        height: 100%;
        background: var(--foreground); /* 전경색 사용 */
        opacity: 0; /* 기본적으로 보이지 않음 */
        transform-origin: top center; /* 변형 시작점 설정 */
        transform: scaleY(0); /* 기본 높이를 0으로 설정 */
        transition: transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1), opacity 0.5s ease; /* 부드러운 전환 효과 */
      }
      
      /* 호버 상태와 활성 상태에서 하이라이트 바 표시 */
      .futuristic-option:hover::before, 
      .futuristic-option.active::before {
        transform: scaleY(1); /* 높이를 100%로 확장 */
        opacity: 0.5; /* 가시성 증가 */
      }
      
      /* 호버 상태가 아닐 때 변형 시작점 변경 */
      .futuristic-option:not(:hover)::before {
        transform-origin: bottom center;
      }
      
      /* 페이드 인 애니메이션 정의 */
      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: translateY(8px); /* 위에서 아래로 나타나는 효과 */
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      
      /* 스크롤바 스타일 (웹킷 기반 브라우저) */
      .model-selector-scroll::-webkit-scrollbar {
        width: 4px; /* 스크롤바 너비 */
      }
      
      .model-selector-scroll::-webkit-scrollbar-track {
        background: transparent; /* 스크롤바 트랙 배경 투명 */
      }
      
      .model-selector-scroll::-webkit-scrollbar-thumb {
        background: var(--muted); /* 스크롤바 썸 색상 */
        opacity: 0.3; /* 투명도 설정 */
      }
      
      /* 파이어폭스용 스크롤바 스타일 */
      .model-selector-scroll {
        scrollbar-width: thin;
        scrollbar-color: var(--muted) transparent;
      }
      
      /* 모바일 화면 대응 스타일 */
      @media (max-width: 640px) {
        /* 모바일에서 표시되는 드래그 핸들 */
        .mobile-selector-handle {
          position: absolute;
          top: 8px;
          left: 50%;
          transform: translateX(-50%); /* 중앙 정렬 */
          width: 36px;
          height: 4px;
          background: var(--muted);
          opacity: 0.3;
        }
      }
    `;
    
    // 생성한 스타일을 문서 헤드에 추가합니다
    document.head.appendChild(style);
    
    // 컴포넌트 언마운트 시 스타일 요소를 제거하는 클린업 함수를 반환합니다
    return () => {
      document.head.removeChild(style);
    };
  }, []); // 빈 의존성 배열은 이 효과가 마운트와 언마운트 시에만 실행됨을 의미합니다

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
            <span className="ml-2 opacity-60 text-xs">▾</span>
          </button>
          {isOpen && !disabled && (
            <div 
              className={`
                futuristic-dropdown
                ${isMobile 
                  ? 'fixed inset-x-0 bottom-0 w-full max-h-[80vh] overflow-y-auto pb-6 model-selector-scroll' 
                  : `absolute ${position === 'top' ? 'bottom-full mb-3' : 'top-full mt-3'} left-0 w-[280px] max-h-[400px] overflow-y-auto model-selector-scroll`}
                bg-[var(--background)]/90 shadow-lg z-50
              `}
              role="listbox"
            >
              {isMobile && (
                <div className="sticky top-0 z-10 backdrop-blur-md bg-[var(--background)]/95 pt-6 pb-4">
                  <div className="mobile-selector-handle"></div>
                  <div className="flex items-center justify-between px-6 mt-2">
                    <span className="text-xs uppercase tracking-[0.2em] opacity-70">Select Model</span>
                    <button 
                      onClick={() => setIsOpen(false)}
                      className="text-[var(--muted)] hover:text-[var(--foreground)] text-xs uppercase tracking-[0.2em] transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
              <div className="pt-2">
                {MODEL_OPTIONS.length > 0 ? (
                  MODEL_OPTIONS.map((option, index) => (
                    <div 
                      key={option.id}
                      className={`futuristic-option px-6 py-5 last:border-b-0
                               ${option.id === nextModel ? 'bg-[var(--accent)]/30 active' : ''}
                               hover:bg-[var(--accent)]/10 transition-all cursor-pointer
                               ${isMobile ? 'p-6' : ''}`}
                      onClick={() => {
                        setNextModel(option.id);
                        setIsOpen(false);
                      }}
                      onMouseEnter={() => setHoverIndex(index)}
                      onMouseLeave={() => setHoverIndex(null)}
                      role="option"
                      aria-selected={option.id === nextModel}
                    >
                      <div className={`text-base tracking-wide mb-2 transition-all
                                   ${option.id === nextModel ? 'text-[var(--foreground)]' : 'text-[var(--muted)]'}`}>
                        {option.name}
                      </div>
                      <div className={`text-xs tracking-wide transition-all
                                   ${option.id === nextModel || hoverIndex === index ? 'text-[var(--muted)]' : 'text-[var(--muted)] opacity-60'}`}>
                        {option.description}
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