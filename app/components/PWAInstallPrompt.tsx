'use client'

import { useState, useEffect } from 'react';

export function PWAInstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // iOS 디바이스 체크
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    // PWA가 이미 설치되었는지 확인
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    
    // 모바일 기기이고 PWA가 설치되지 않았을 때만 프롬프트 표시
    if ((isIOSDevice || /Android/i.test(navigator.userAgent)) && !isStandalone) {
      setShowPrompt(true);
      // 애니메이션을 위해 약간의 딜레이 후 표시
      setTimeout(() => setIsVisible(true), 100);
    }
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    // 페이드 아웃 애니메이션 후 완전히 제거
    setTimeout(() => setShowPrompt(false), 300);
  };

  if (!showPrompt) return null;

  return (
    <div className={`fixed inset-x-4 top-4 z-50 transition-all duration-300 ease-in-out ${
      isVisible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'
    }`}>
      <div className="relative bg-[#1C1C1E] rounded-2xl overflow-hidden shadow-2xl">
        <div className="px-5 py-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-white text-lg font-normal tracking-tight mb-2">Install chatflix.app</h2>
              <p className="text-[#8E8E93] text-sm leading-relaxed">
                {isIOS ? (
                  <span className="flex items-center gap-2">
                    Tap
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg ">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                        <path d="M13 5.41V17a1 1 0 0 1-2 0V5.41l-3.3 3.3a1 1 0 0 1-1.4-1.42l5-5a1 1 0 0 1 1.4 0l5 5a1 1 0 1 1-1.4 1.42L13 5.4zM3 17a1 1 0 0 1 2 0v3h14v-3a1 1 0 0 1 2 0v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3z"/>
                      </svg>
                    </span>
                    and then "Add to Home Screen"
                  </span>
                ) 
                : (
                  <span>Only on IOS: Add Chatflix to your home screen to use it as an app </span>
                )
                }
              </p>
            </div>
            <button
              onClick={handleClose}
              className="p-2 -m-2 text-[#8E8E93] hover:text-white transition-colors"
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