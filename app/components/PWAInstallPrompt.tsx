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
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    if (isStandalone) return;

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
                Install chatflix.app
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