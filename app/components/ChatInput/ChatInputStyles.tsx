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
          cursor: default;
          user-select: all;
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
        
        /* 토큰 카운터 스타일 */
        .token-counter {
          font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
          font-size: 9px;
          font-weight: 500;
          letter-spacing: 0.01em;
          backdrop-filter: blur(12px);
          background-color: color-mix(in srgb, var(--background) 85%, transparent);
          border-radius: 8px;
          padding: 2px 6px;
          border: 1px solid color-mix(in srgb, var(--foreground) 6%, transparent);
          transition: all 0.2s ease;
          z-index: 1;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
        }
        
        .token-counter.info {
          background-color: color-mix(in srgb, #3b82f6 12%, transparent);
          border-color: color-mix(in srgb, #3b82f6 15%, transparent);
        }
        
        .token-counter.warning {
          background-color: color-mix(in srgb, #f59e0b 15%, transparent);
          border-color: color-mix(in srgb, #f59e0b 20%, transparent);
        }
        
        .token-counter.error {
          background-color: color-mix(in srgb, #ef4444 15%, transparent);
          border-color: color-mix(in srgb, #ef4444 20%, transparent);
          animation: tokenPulse 2s infinite;
        }
        
        .token-counter.critical {
          background-color: color-mix(in srgb, #dc2626 20%, transparent);
          border-color: color-mix(in srgb, #dc2626 30%, transparent);
          animation: tokenCritical 1.5s infinite;
          font-weight: 600;
        }
        
        @keyframes tokenPulse {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.3);
          }
          50% {
            box-shadow: 0 0 0 4px rgba(239, 68, 68, 0);
          }
        }
        
        @keyframes tokenCritical {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.4);
            transform: scale(1);
          }
          50% {
            box-shadow: 0 0 0 6px rgba(220, 38, 38, 0);
            transform: scale(1.02);
          }
        }
        
        /* 토큰 카운터 애니메이션 */
        @keyframes tokenFadeIn {
          from {
            opacity: 0;
            transform: translateY(5px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        
        .token-counter {
          animation: tokenFadeIn 0.2s ease-out;
        }
        
        .token-counter:hover {
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
          background-color: color-mix(in srgb, var(--background) 90%, transparent);
        }
        
        /* 토큰 툴팁 스타일 */
        .token-tooltip {
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
          animation: tokenTooltipFadeIn 0.2s ease-out;
        }
        
        @keyframes tokenTooltipFadeIn {
          from {
            opacity: 0;
            transform: translateY(8px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
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
