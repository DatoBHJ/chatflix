'use client'

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getAdaptiveGlassStyleBlur, getInitialTheme } from '@/app/lib/adaptiveGlassStyle';

const LIGHT_MODE_SHADOW = '0 20px 40px -10px rgba(0,0,0,0.35), 0 40px 80px -20px rgba(0,0,0,0.25)';

export function PWAInstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [glassStyle, setGlassStyle] = useState<React.CSSProperties>({});
  const [isLight, setIsLight] = useState(false);

  useEffect(() => {
    // PWA 설치 여부를 여러 방법으로 확인
    const checkIfInstalled = () => {
      // 1. display-mode: standalone 체크 (가장 일반적)
      if (window.matchMedia('(display-mode: standalone)').matches) return true;
      
      // 2. display-mode: fullscreen 체크 (일부 브라우저)
      if (window.matchMedia('(display-mode: fullscreen)').matches) return true;
      
      // 3. display-mode: minimal-ui 체크
      if (window.matchMedia('(display-mode: minimal-ui)').matches) return true;
      
      // 4. iOS Safari standalone 체크
      if ((window.navigator as any).standalone === true) return true;
      
      // 5. 브라우저 모드가 아닌 경우 (standalone, fullscreen, minimal-ui 중 하나)
      const displayMode = window.matchMedia('(display-mode: browser)').matches;
      if (!displayMode) return true;
      
      return false;
    };

    // 이미 설치되어 있으면 프롬프트 표시 안 함
    if (checkIfInstalled()) return;

    // 사용자가 이전에 닫은 기록이 있으면 표시 안 함 (24시간 동안)
    const dismissedKey = 'pwa-install-prompt-dismissed';
    const dismissedTime = localStorage.getItem(dismissedKey);
    if (dismissedTime) {
      const dismissed = parseInt(dismissedTime, 10);
      const now = Date.now();
      // 24시간 이내에 닫았다면 다시 표시 안 함
      if (now - dismissed < 24 * 60 * 60 * 1000) {
        return;
      }
      // 24시간이 지났으면 기록 삭제
      localStorage.removeItem(dismissedKey);
    }

    const show = () => {
      setShowPrompt(true);
      requestAnimationFrame(() => setIsVisible(true));
    };

    if (document.readyState === 'complete') {
      show();
    } else {
      window.addEventListener('load', show);
      // Hydration 시점에 load가 이미 지났을 수 있어, 지연 후 한 번 더 시도
      const fallback = setTimeout(show, 500);
      return () => {
        clearTimeout(fallback);
        window.removeEventListener('load', show);
      };
    }
  }, []);

  useEffect(() => {
    if (!showPrompt) return;
    const apply = () => {
      setGlassStyle(getAdaptiveGlassStyleBlur());
      setIsLight(!getInitialTheme());
    };
    apply();
    const onResize = () => apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      observer.disconnect();
    };
  }, [showPrompt]);

  const handleClose = () => {
    // 닫은 시간을 localStorage에 저장 (24시간 동안 다시 표시 안 함)
    localStorage.setItem('pwa-install-prompt-dismissed', Date.now().toString());
    setIsVisible(false);
    setTimeout(() => setShowPrompt(false), 300);
  };

  if (!showPrompt) return null;

  return (
    <div
      className={`fixed top-[18px] z-[70] w-[calc(100vw-32px)] max-w-[360px] left-1/2 -translate-x-1/2 md:left-auto md:right-[18px] transition-all duration-300 ease-out ${
        isVisible
          ? 'translate-y-0 opacity-100 md:translate-x-0'
          : '-translate-y-full opacity-0 md:translate-y-0 md:translate-x-full'
      }`}
    >
      <div
        className="relative overflow-hidden rounded-[14px]"
        style={{
          ...glassStyle,
          backgroundColor: glassStyle.backgroundColor ?? 'rgba(0,0,0,0.1)',
          boxShadow: isLight ? LIGHT_MODE_SHADOW : glassStyle.boxShadow,
        }}
      >
        <div className="px-4 pt-2.5 pb-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h2 className="text-[15px] font-semibold text-white leading-tight">
                Install Chatflix
              </h2>
              <Link
                href="/pwa-guide"
                onClick={handleClose}
                className="mt-1 inline-block text-[13px] font-medium text-[var(--chat-input-primary)] underline active:opacity-80"
              >
                View installation guide
              </Link>
            </div>
            <button
              onClick={handleClose}
              className="shrink-0 p-1.5 -m-1.5 rounded-full text-white/80 hover:text-white active:opacity-70 transition-colors"
              aria-label="Close"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M6.293 6.293a1 1 0 011.414 0L12 10.586l4.293-4.293a1 1 0 111.414 1.414L13.414 12l4.293 4.293a1 1 0 01-1.414 1.414L12 13.414l-4.293 4.293a1 1 0 01-1.414-1.414L10.586 12 6.293 7.707a1 1 0 010-1.414z"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 