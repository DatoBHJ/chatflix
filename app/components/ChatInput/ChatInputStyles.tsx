// app/components/chat/ChatInput/ChatInputStyles.tsx
import { useEffect } from 'react';

export function useChatInputStyles() {
  useEffect(() => {
    // CSS를 동적으로 주입
    const styleId = 'chat-input-styles';
    
    // 이미 존재하는 스타일 요소가 있는지 확인
    if (!document.getElementById(styleId)) {
      const styleEl = document.createElement('style');
      styleEl.id = styleId;
      styleEl.textContent = `
        /* 입력 컴포넌트 내 버튼 스타일 */
        .input-btn {
          transition: all 0.2s ease;
        }
        
        /* 에이전트 버튼 스타일 */
        .input-btn-active svg {
          filter: drop-shadow(0 0 2px var(--accent));
        }
        
        /* 에이전트 활성화 효과 */
        button[title="Disable Agent"] svg {
          animation: pulseGlow 2s infinite alternate;
        }
        
        @keyframes pulseGlow {
          0% {
            filter: drop-shadow(0 0 1px var(--accent));
          }
          100% {
            filter: drop-shadow(0 0 3px var(--accent));
          }
        }
        
        /* 퓨처리스틱 입력 필드 스타일 - 공백 및 줄바꿈 개선 */
        .futuristic-input {
          position: relative;
          caret-color: currentColor;
          white-space: pre-wrap;
          font-weight: 400;
          overflow-y: auto;
          max-height: 100%;
          line-height: 1.3;
          word-wrap: break-word;
          word-break: break-word;
          
          /* 컨텐츠 렌더링 최적화 */
          contain: content;
          will-change: transform;
          transform: translateZ(0);
        }
        
        /* 대용량 텍스트 처리 시 렌더링 최적화 */
        .futuristic-input:has(> *:nth-child(n+100)) {
          content-visibility: auto;
          contain-intrinsic-size: 0 500px;
        }
        
        /* 공백 보존을 위한 스타일 */
        .futuristic-input br {
          content: "";
          display: block;
          margin-bottom: 0.5em;
        }
        
        /* 연속된 공백 표시 보장 */
        .futuristic-input span, 
        .futuristic-input div, 
        .futuristic-input p {
          white-space: pre-wrap;
        }
        
        /* 대용량 텍스트 처리 중 표시 스타일 */
        .futuristic-input .processing-text {
          color: var(--muted);
          animation: pulse 1.5s infinite;
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        
        /* 플레이스홀더 스타일 - 빈 상태일 때만 보이게 */
        .futuristic-input.empty:before {
          content: attr(data-placeholder);
          color: color-mix(in srgb, var(--muted) 80%, transparent);
          pointer-events: none;
          position: absolute;
          top: 50%;
          left: 0;
          right: 0;
          padding: inherit;
          padding-left: 1.1rem;
          font-weight: 400;
          letter-spacing: 0.01em;
          transform: translateY(-50%);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          z-index: 1;
        }
        
        /* placeholder가 있을 때만 표시되도록 보장 */
        .futuristic-input:not(.empty):before {
          display: none;
        }
        
        /* Apple-style minimal tool selector - 별도 클래스로 분리 */
        .tool-selector {
          animation: toolSelectorFadeIn 0.2s ease-out;
        }
        
        @keyframes toolSelectorFadeIn {
          from {
            opacity: 0;
            transform: translateY(4px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        
        /* Tool button hover effects */
        .tool-button {
          transition: all 0.15s ease-out;
        }
        
        .tool-button:hover {
          transform: translateY(-1px);
        }
        
        .tool-button:active {
          transform: translateY(0);
        }
        
        /* 활성화된 버튼 스타일 통합 */
        .input-btn-active {
          background-color: var(--background);
          color: var(--foreground);
        }
        
        
        /* 드래그 & 드롭 활성 */
        .drag-target-active {
          position: relative;
        }
        
        .drag-target-active:after {
          content: '';
          position: absolute;
          top: -8px;
          left: -8px;
          right: -8px;
          bottom: -8px;
          border: 2px dashed color-mix(in srgb, var(--foreground) 10%, transparent);
          border-radius: 12px;
          pointer-events: none;
          z-index: 0;
        }
        
        
        /* Trending terms styles */
        .trending-term {
          font-size: 0.75rem;
          padding: 0.25rem 0.5rem;
          border-radius: 9999px;
          white-space: nowrap;
          transition: all 0.2s ease;
          background-color: color-mix(in srgb, var(--foreground) 5%, transparent);
          color: var(--foreground);
          border: 1px solid color-mix(in srgb, var(--foreground) 8%, transparent);
        }
        
        .trending-term:hover {
          background-color: color-mix(in srgb, var(--foreground) 10%, transparent);
          transform: translateY(-1px);
        }
        
        /* Agent dropdown styles */
        .agent-dropdown {
          backdrop-filter: blur(16px);
          border: 1px solid color-mix(in srgb, var(--foreground) 10%, transparent);
          animation: slideUpFadeIn 0.2s ease-out;
          transform-origin: bottom left;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        }
        
        .agent-dropdown::before {
          content: '';
          position: absolute;
          bottom: -6px;
          left: 20px;
          width: 0;
          height: 0;
          border-left: 6px solid transparent;
          border-right: 6px solid transparent;
          border-top: 6px solid color-mix(in srgb, var(--foreground) 10%, transparent);
        }
        
        .agent-dropdown::after {
          content: '';
          position: absolute;
          bottom: -5px;
          left: 21px;
          width: 0;
          height: 0;
          border-left: 5px solid transparent;
          border-right: 5px solid transparent;
          border-top: 5px solid var(--accent);
        }
        
        @keyframes slideUpFadeIn {
          from {
            opacity: 0;
            transform: translateY(10px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        
        /* Agent dropdown button states */
        .agent-dropdown button:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }
        
        .agent-dropdown button:active:not(:disabled) {
          transform: translateY(0);
        }
        
      `;
      document.head.appendChild(styleEl);
    }
    
    // 컴포넌트 언마운트 시 스타일 제거
    return () => {
      const styleEl = document.getElementById(styleId);
      if (styleEl && styleEl.parentNode) {
        styleEl.parentNode.removeChild(styleEl);
      }
    };
  }, []);
}
