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
        
        /* 플레이스홀더 스타일 - 빈 상태일 때만 보이게 (사이드바 검색창과 동일) */
        .futuristic-input.empty:before {
          content: attr(data-placeholder);
          color: var(--muted);
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
          filter: blur(0.1px);
        }
        
        /* 모바일에서 플레이스홀더 스타일 개선 - iOS 최적화 */
        @media (max-width: 768px) {
          .futuristic-input.empty:before {
            color: var(--muted);
            font-weight: 500;
            letter-spacing: 0.02em;
            filter: none;
            -webkit-text-fill-color: var(--muted);
            -webkit-opacity: 1;
            opacity: 1;
          }
        }
        
        /* Safari 브라우저 감지 및 모바일과 동일한 스타일 적용 */
        @supports (-webkit-touch-callout: none) {
          .futuristic-input.empty:before {
            color: var(--muted);
            font-weight: 500;
            letter-spacing: 0.02em;
            filter: none;
            -webkit-text-fill-color: var(--muted);
            -webkit-opacity: 1;
            opacity: 1;
          }
        }
        
        /* Safari 데스크탑 감지 - User Agent 기반으로는 CSS에서 직접 감지 불가하므로 
           JavaScript에서 추가한 클래스를 사용 */
        .safari-browser .futuristic-input.empty:before {
          color: var(--muted);
          font-weight: 500;
          letter-spacing: 0.02em;
          filter: none;
          -webkit-text-fill-color: var(--muted);
          -webkit-opacity: 1;
          opacity: 1;
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
        
        /* Tool button styles */
        .tool-button {
          transition: all 0.15s ease-out;
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
        
        
        /* 라이트모드 기본 스타일 (모델 선택창과 동일) */
        .chat-input-tooltip-backdrop {
          background-color: rgba(255, 255, 255, 0.1) !important;
          backdrop-filter: url(#glass-distortion) blur(10px) saturate(180%) !important;
          -webkit-backdrop-filter: url(#glass-distortion) blur(10px) saturate(180%) !important;
          border: 1px solid rgba(255, 255, 255, 0.2) !important;
          box-shadow: 0 8px 40px rgba(0, 0, 0, 0.06), 0 4px 20px rgba(0, 0, 0, 0.04), 0 2px 8px rgba(0, 0, 0, 0.025), inset 0 1px 0 rgba(255, 255, 255, 0.15) !important;
        }
        
        /* 모바일에서 glass distortion 제거 */
        @media (max-width: 768px) {
          .chat-input-tooltip-backdrop {
            backdrop-filter: blur(24px) saturate(180%) !important;
            -webkit-backdrop-filter: blur(10px) saturate(180%) !important;
          }
        }
        
        /* 다크모드 전용 스타일 */
        :root[data-theme="dark"] .chat-input-tooltip-backdrop,
        :root[data-theme="system"] .chat-input-tooltip-backdrop {
          background-color: rgba(0, 0, 0, 0.05) !important;
          backdrop-filter: url(#glass-distortion-dark) blur(24px) !important;
          -webkit-backdrop-filter: url(#glass-distortion-dark) blur(24px) !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 0 4px 16px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05) !important;
        }
        
        /* 다크모드에서 모바일 glass distortion 제거 */
        @media (max-width: 768px) {
          :root[data-theme="dark"] .chat-input-tooltip-backdrop,
          :root[data-theme="system"] .chat-input-tooltip-backdrop {
            backdrop-filter: blur(24px) !important;
            -webkit-backdrop-filter: blur(24px) !important;
          }
        }
        
        /* 다크모드에서 시스템 설정 기반 테마 적용 */
        @media (prefers-color-scheme: dark) {
          :root[data-theme="system"] .chat-input-tooltip-backdrop {
            background-color: rgba(0, 0, 0, 0.05) !important;
            backdrop-filter: url(#glass-distortion-dark) blur(24px) !important;
            -webkit-backdrop-filter: url(#glass-distortion-dark) blur(24px) !important;
            border: 1px solid rgba(255, 255, 255, 0.1) !important;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 0 4px 16px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05) !important;
          }
        }
        
        /* 시스템 다크모드에서 모바일 glass distortion 제거 */
        @media (prefers-color-scheme: dark) and (max-width: 768px) {
          :root[data-theme="system"] .chat-input-tooltip-backdrop {
            backdrop-filter: blur(24px) !important;
            -webkit-backdrop-filter: blur(24px) !important;
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