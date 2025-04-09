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
        
        /* 퓨처리스틱 입력 필드 스타일 */
        .futuristic-input {
          position: relative;
          caret-color: currentColor;
          white-space: pre-wrap;
          font-weight: 400;
          color: var(--background);
          overflow-y: auto;
          max-height: 100%;
        }
        
        /* 플레이스홀더 스타일 - 빈 상태일 때만 보이게 */
        .futuristic-input.empty:before {
          content: attr(data-placeholder);
          color: var(--muted);
          pointer-events: none;
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          padding: inherit;
          font-weight: 400;
          letter-spacing: 0.01em;
        }
        
        /* 활성화된 버튼 스타일 통합 */
        .input-btn-active {
          background-color: var(--background);
          color: var(--foreground);
        }
        
        /* 멘션 스타일 */
        .mention-tag-wrapper {
          display: inline-flex;
          align-items: center;
          margin: 0 1px;
        }
        
        .mention-tag {
          display: inline-block;
          background-color: color-mix(in srgb, var(--foreground) 7%, transparent);
          padding: 1px 5px;
          border-radius: 4px;
          font-size: 0.95em;
          font-weight: 500;
          white-space: nowrap;
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
        
        /* 숏컷 스타일 (원래 디자인) */
        .shortcuts-container {
          max-height: 300px;
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: color-mix(in srgb, var(--foreground) 20%, transparent) transparent;
          border-radius: 8px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
          backdrop-filter: blur(16px);
          border: 1px solid color-mix(in srgb, var(--foreground) 10%, transparent);
          animation: slideDown 0.2s ease-out;
          transform-origin: top center;
        }
        
        .shortcuts-container::-webkit-scrollbar {
          width: 4px;
        }
        
        .shortcuts-container::-webkit-scrollbar-track {
          background: transparent;
        }
        
        .shortcuts-container::-webkit-scrollbar-thumb {
          background: color-mix(in srgb, var(--foreground) 20%, transparent);
          border-radius: 4px;
        }
        
        .shortcut-item {
          width: 100%;
          padding: 16px 24px;
          text-align: left;
          transition: all 0.2s ease;
          position: relative;
          overflow: hidden;
        }
        
        .shortcut-item.selected {
          background: color-mix(in srgb, var(--accent) 30%, transparent);
        }
        
        .shortcut-item:hover {
          background: color-mix(in srgb, var(--accent) 20%, transparent);
        }
        
        .shortcut-item .highlight {
          color: var(--foreground);
          font-weight: 500;
          position: relative;
        }
        
        .shortcut-item .highlight::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          width: 100%;
          height: 2px;
          background: color-mix(in srgb, var(--accent) 50%, transparent);
        }
        
        .shortcut-item.selected .indicator {
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 3px;
          background: var(--foreground);
          animation: fadeIn 0.2s ease-out;
        }
        
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: scaleY(0.8);
          }
          to {
            opacity: 1;
            transform: scaleY(1);
          }
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