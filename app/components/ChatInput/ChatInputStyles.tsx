// app/components/chat/ChatInput/ChatInputStyles.tsx
import { useEffect } from 'react';

export function useChatInputStyles() {
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      /* 멘션 태그 스타일 개선 */
      .mention-tag-wrapper {
        display: inline-block;
        position: relative;
        margin: 0 2px;
        white-space: nowrap;
      }
      
      /* 검색 결과 스타일 개선 */
      .shortcut-item {
        width: 100%;
        padding: 16px 24px;
        text-align: left;
        transition: all 0.2s ease;
        position: relative;
        overflow: hidden;
      }
      
      .shortcut-item.selected {
        background: rgba(var(--accent-rgb), 0.3);
      }
      
      .shortcut-item:hover {
        background: rgba(var(--accent-rgb), 0.2);
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
        background: rgba(var(--accent-rgb), 0.5);
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
      
      .shortcuts-container {
        max-height: 300px;
        overflow-y: auto;
        scrollbar-width: thin;
        scrollbar-color: rgba(var(--foreground-rgb), 0.2) transparent;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        backdrop-filter: blur(16px);
        border: 1px solid rgba(var(--foreground-rgb), 0.1);
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
        background: rgba(var(--foreground-rgb), 0.2);
        border-radius: 4px;
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
      
      /* 기존 스타일 유지 */
      .futuristic-input {
        position: relative;
        transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
        background: transparent;
        outline: none !important;
      }
      
      
      .futuristic-input:focus,
      .futuristic-input:focus-visible {
        outline: none !important;
        box-shadow: none !important;
        background: transparent !important;
      }

      .futuristic-input::after,
      .futuristic-input.theme-changing::after {
        content: "";
        position: absolute;
        bottom: 0;
        left: 0;
        width: 100%;
        height: 2px;
        background: linear-gradient(to right, var(--muted), transparent);
        opacity: 0;
        transform-origin: left center;
        transform: scaleX(0.95) scaleY(0.8) translateY(-0.5px);
        transition: opacity 0.3s ease;
      }

      .futuristic-input.focused::after,
      .futuristic-input.theme-changing::after {
        opacity: 0.7;
        animation: pencilStroke 0.4s cubic-bezier(0.22, 0.61, 0.36, 1) forwards;
      }
      
      @keyframes pencilStroke {
        0% {
          transform: scaleX(0) scaleY(0.8) translateY(-0.5px);
        }
        100% {
          transform: scaleX(0.95) scaleY(0.8) translateY(-0.5px);
        }
      }

      .futuristic-button {
        position: relative;
        overflow: hidden;
        transition: all 0.3s ease;
      }

      .futuristic-button:before {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        width: 0;
        height: 0;
        background: rgba(255, 255, 255, 0.05);
        transform: translate(-50%, -50%);
        transition: width 0.6s ease, height 0.6s ease;
      }

      .futuristic-button:hover:before {
        width: 120%;
        height: 120%;
      }

      .image-preview-container {
        backdrop-filter: blur(12px);
        transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
        overflow: hidden;
        z-index: 30;
      }
      
      .image-preview-scroll {
        overflow-x: auto;
        scrollbar-width: thin;
        scrollbar-color: var(--muted) transparent;
      }
      
      .image-preview-scroll::-webkit-scrollbar {
        height: 4px;
      }
      
      .image-preview-scroll::-webkit-scrollbar-track {
        background: transparent;
      }
      
      .image-preview-scroll::-webkit-scrollbar-thumb {
        background: var(--muted);
        border-radius: 4px;
        opacity: 0.5;
      }

      .file-preview-item {
        position: relative;
        overflow: hidden;
        transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
        border-radius: 8px;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
        background: var(--accent);
        width: 160px;
        height: 100px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
      }
      
      .file-preview-item:hover {
        transform: scale(1.03);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
      }
      
      .file-preview-item .file-icon {
        font-size: 24px;
        margin-bottom: 8px;
        opacity: 0.8;
      }
      
      .file-preview-item .file-name {
        font-size: 12px;
        max-width: 140px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        opacity: 0.9;
      }
      
      .file-preview-item .file-size {
        font-size: 10px;
        opacity: 0.7;
        margin-top: 4px;
      }

      .image-preview-item {
        position: relative;
        overflow: hidden;
        transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
        border-radius: 8px;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
      }
      
      .image-preview-item:hover {
        transform: scale(1.03);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
      }

      .preview-img {
        transition: all 0.3s ease;
        filter: contrast(1.05);
      }

      .image-preview-item:hover .preview-img {
        filter: contrast(1.1) brightness(1.05);
      }

      .remove-file-btn {
        position: absolute;
        top: 6px;
        right: 6px;
        width: 22px;
        height: 22px;
        border-radius: 50%;
        background: rgba(0, 0, 0, 0.5);
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transform: translateY(-6px);
        transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
        backdrop-filter: blur(4px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        font-size: 14px;
        z-index: 10;
      }

      .file-preview-item:hover .remove-file-btn,
      .image-preview-item:hover .remove-file-btn {
        opacity: 1;
        transform: translateY(0);
      }

      .preview-overlay {
        position: absolute;
        inset: 0;
        background: linear-gradient(to top, rgba(0, 0, 0, 0.6) 0%, rgba(0, 0, 0, 0) 50%);
        opacity: 0;
        transition: opacity 0.3s ease;
      }

      .image-preview-item:hover .preview-overlay {
        opacity: 1;
      }

      .drag-upload-overlay {
        backdrop-filter: blur(12px);
        background: rgba(var(--background-rgb), 0.85);
        border: 2px dashed rgba(var(--foreground-rgb), 0.2);
        border-radius: 12px;
        box-shadow: 0 0 0 6px rgba(var(--background-rgb), 0.5);
        animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
      }

      @keyframes pulse {
        0%, 100% {
          border-color: rgba(var(--foreground-rgb), 0.2);
          box-shadow: 0 0 0 6px rgba(var(--background-rgb), 0.5);
        }
        50% {
          border-color: rgba(var(--foreground-rgb), 0.4);
          box-shadow: 0 0 0 12px rgba(var(--background-rgb), 0.3);
        }
      }

      .drag-upload-icon {
        background: rgba(var(--accent-rgb), 0.15);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
        transition: all 0.3s ease;
        animation: bounce 1s infinite;
      }

      @keyframes bounce {
        0%, 100% {
          transform: translateY(0);
        }
        50% {
          transform: translateY(-6px);
        }
      }

      .drag-upload-text {
        font-size: 16px;
        font-weight: 500;
        letter-spacing: 0.02em;
        color: var(--foreground);
        opacity: 0.9;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
      }

      /* Placeholder implementation */
      .yeezy-input:empty:before {
        content: attr(data-placeholder);
        color: var(--muted);
        opacity: 0.7;
        pointer-events: none;
      }
      
      .input-container {
        padding-left: 1px;
        padding-right: 1px;
      }
      
      @media (max-width: 640px) {
        .input-container {
          padding-left: 1px;
          padding-right: 1px;
        }
      }

      .upload-button {
        position: relative;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.3s ease;
      }

      .upload-button-indicator {
        position: absolute;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--accent);
        bottom: 8px;
        right: 8px;
        opacity: 0;
        transform: scale(0);
        transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
        box-shadow: 0 0 8px var(--accent);
      }

      .upload-button-active .upload-button-indicator {
        opacity: 1;
        transform: scale(1);
      }

      .upload-icon {
        transition: all 0.3s ease;
      }

      .upload-button:hover .upload-icon {
        transform: scale(1.1);
        opacity: 0.9;
      }
      
      .code-preview {
        background: var(--code-bg);
        color: var(--code-text);
        font-family: monospace;
        font-size: 12px;
        padding: 8px;
        border-radius: 6px;
        max-height: 80px;
        overflow: hidden;
        position: relative;
        width: 100%;
      }
      
      .code-preview::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 24px;
        background: linear-gradient(to bottom, transparent, var(--code-bg));
      }
      
      .file-type-badge {
        position: absolute;
        top: 6px;
        left: 6px;
        font-size: 10px;
        padding: 2px 6px;
        border-radius: 4px;
        background: rgba(0, 0, 0, 0.5);
        color: white;
        backdrop-filter: blur(4px);
        z-index: 5;
      }

      .drag-target-active {
        position: relative;
        z-index: 40;
      }

      .drag-target-active::before {
        content: '';
        position: absolute;
        inset: -20px;
        background: transparent;
        z-index: 30;
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
      
      .animate-fadeIn {
        animation: fadeIn 0.2s ease-out forwards;
        transform-origin: center left;
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);
}