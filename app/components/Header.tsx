'use client'

import { useRouter, usePathname } from 'next/navigation'
import { ThemeToggle } from './ThemeToggle'
import WhatsNewContainer from './WhatsNewContainer'
import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link'
import { checkSubscriptionClient, clearClientSubscriptionCache } from '@/lib/subscription-client'
import { clearAllSubscriptionCache } from '@/lib/utils'
import { Battery, SquarePencil } from 'react-ios-icons'

export interface HeaderProps {
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  showBackButton?: boolean;
  user?: any;
  isHovering?: boolean; // Add hover state prop
}

export function Header({ isSidebarOpen, toggleSidebar, showBackButton, user, isHovering }: HeaderProps) {
  const router = useRouter()
  const pathname = usePathname()
  
  // 홈 화면이 아닌지 확인
  const isNotHomePage = pathname !== '/'

  // 🚀 익명 사용자 지원: 익명 사용자 식별
  const isAnonymousUser = user?.isAnonymous || user?.id === 'anonymous';

  const [isSubscribed, setIsSubscribed] = useState<boolean | null>(null);
  const [isSubscriptionLoading, setIsSubscriptionLoading] = useState(true);
  const [showBatteryTooltip, setShowBatteryTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<'left' | 'center' | 'right'>('center');
  const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const batteryRef = useRef<HTMLDivElement>(null);
  const batteryRef2 = useRef<HTMLDivElement>(null);
  
  // 최적화를 위한 캐시 관련 상태
  const lastCheckTimeRef = useRef<number>(0);
  const lastCheckedUserIdRef = useRef<string | null>(null);
  const CACHE_DURATION = 5 * 60 * 1000; // 5분 캐시 (공백 현상을 방지를 위해 단축)
  
  // 인증 사용자에서는 과거 익명 ID를 정리
  useEffect(() => {
    if (!isAnonymousUser) {
      try { localStorage.removeItem('anonymousId'); } catch {}
    }
  }, [isAnonymousUser]);

  // 툴팁 위치 계산 함수
  const calculateTooltipPosition = () => {
    // 현재 활성화된 배터리 요소 찾기
    const activeBattery = batteryRef.current || batteryRef2.current;
    if (!activeBattery) return 'center';
    
    const rect = activeBattery.getBoundingClientRect();
    const tooltipWidth = 200; // 툴팁의 예상 너비 (여백 포함)
    const screenWidth = window.innerWidth;
    const margin = 20; // 화면 경계에서의 여백
    
    // 툴팁이 화면 우측 끝에서 잘릴 경우
    if (rect.left + (tooltipWidth / 2) > screenWidth - margin) {
      return 'right';
    }
    // 툴팁이 화면 좌측 끝에서 잘릴 경우
    if (rect.left - (tooltipWidth / 2) < margin) {
      return 'left';
    }
    // 중앙 정렬이 가능한 경우
    return 'center';
  };
  
  // 툴팁 표시/숨김 함수
  const showTooltip = () => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
    }
    const position = calculateTooltipPosition();
    setTooltipPosition(position);
    setShowBatteryTooltip(true);
  };

  const hideTooltip = () => {
    tooltipTimeoutRef.current = setTimeout(() => {
      setShowBatteryTooltip(false);
    }, 150); // 150ms 지연으로 자연스러운 이동 가능
  };
  
  // 🔧 FIX: 구독 상태 확인 함수 최적화 - 단순화
  const checkSubscriptionStatus = useCallback(async (forceCheck = false) => {
    // 🚀 익명 사용자 지원: 익명 사용자는 Free Plan으로 처리 (캐싱 불필요)
    if (!user?.id || isAnonymousUser) {
      setIsSubscribed(false);
      setIsSubscriptionLoading(false);
      lastCheckedUserIdRef.current = null;
      // 익명 전환 시 남아있을 수 있는 클라이언트 캐시 제거
      try { clearClientSubscriptionCache(); } catch {}
      return;
    }

    const now = Date.now();
    const isSameUser = lastCheckedUserIdRef.current === user.id;

    // 새로운 사용자이거나 첫 로드인 경우에만 로딩 상태 표시
    if (!isSameUser || isSubscribed === null) {
      setIsSubscriptionLoading(true);
    }
    
    try {
      // 서버 캐시(Upstash) 의존. 필요 시 강제 새로고침만 사용
      const has = await checkSubscriptionClient(forceCheck);
      setIsSubscribed(has);
      lastCheckTimeRef.current = now;
      lastCheckedUserIdRef.current = user.id;
    } catch (error) {
      console.error('Failed to check subscription status:', error);
      setIsSubscribed(false);
    } finally {
      setIsSubscriptionLoading(false);
    }
  }, [user?.id, isSubscribed, isAnonymousUser]);
  
  useEffect(() => {
    // 🚀 익명 사용자 지원: 익명 사용자는 구독 상태 확인 건너뛰기
    if (isAnonymousUser) {
      setIsSubscribed(false);
      setIsSubscriptionLoading(false);
      try { clearClientSubscriptionCache(); } catch {}
      return;
    }
    
    // 첫 로드 시에만 구독 상태 확인
    if (isSubscribed === null) {
      checkSubscriptionStatus();
    }
  }, [checkSubscriptionStatus, isAnonymousUser]); // ✅ P0 FIX: isSubscribed 의존성 제거

  // 백그라운드 새로고침 함수 (로딩 상태 표시 안 함)
  const refreshSubscriptionStatusInBackground = useCallback(async () => {
    // 🚀 익명 사용자 지원: 익명 사용자는 구독 상태 확인 건너뛰기
    if (!user?.id || isAnonymousUser) return;
    
    // 캐시 확인 - 최근에 확인했다면 재확인하지 않음
    const now = Date.now();
    const isCacheValid = now - lastCheckTimeRef.current < CACHE_DURATION;
    const isSameUser = lastCheckedUserIdRef.current === user.id;
    
    // ✅ P0 FIX: isSubscribed 상태 의존성 제거로 무한 루프 방지
    if (isCacheValid && isSameUser) {
      return;
    }
    
    try {
      // 서버측 캐시만 신뢰, 강제 새로고침으로 최신화
      const has = await checkSubscriptionClient(true);
      setIsSubscribed(has);
      lastCheckTimeRef.current = now;
      lastCheckedUserIdRef.current = user.id;
    } catch (error) {
      console.error('Header: Error refreshing subscription status:', error);
      setIsSubscribed(false);
    }
  }, [user?.id, isAnonymousUser]); // ✅ P0 FIX: isSubscribed 의존성 제거

  useEffect(() => {
    const handleVisibilityChange = () => {
      // 🚀 익명 사용자 지원: 익명 사용자는 구독 상태 확인 건너뛰기
      if (!document.hidden && user?.id && !isAnonymousUser) {
        // 캐시가 유효한 경우 재확인하지 않음
        const now = Date.now();
        const isCacheValid = now - lastCheckTimeRef.current < CACHE_DURATION;
        const isSameUser = lastCheckedUserIdRef.current === user.id;
        
        // ✅ P0 FIX: isSubscribed 상태 체크 제거로 안정성 증대
        if (isCacheValid && isSameUser) {
          return;
        }
        
        refreshSubscriptionStatusInBackground();
      }
    };

    // 🔧 FIX: 구독 성공 이벤트 리스너 - 강제 새로고침만 수행
    const handleSubscriptionSuccess = () => {
      if (isAnonymousUser) return;
      checkSubscriptionStatus(true); // 강제 재확인
    };

    // 🔧 FIX: 주기적 구독 상태 확인 (웹훅 지연 대응)
    const periodicCheck = () => {
      if (user?.id && !isAnonymousUser && !document.hidden) {
        const now = Date.now();
        const isCacheValid = now - lastCheckTimeRef.current < CACHE_DURATION;
        const isSameUser = lastCheckedUserIdRef.current === user.id;
        
        if (!isCacheValid || !isSameUser) {
          refreshSubscriptionStatusInBackground();
        }
      }
    };

    // 5분마다 구독 상태 확인
    const intervalId = setInterval(periodicCheck, 5 * 60 * 1000);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('subscriptionSuccess', handleSubscriptionSuccess);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('subscriptionSuccess', handleSubscriptionSuccess);
      clearInterval(intervalId);
    };
  }, [user?.id, refreshSubscriptionStatusInBackground, checkSubscriptionStatus, isAnonymousUser]); // ✅ P0 FIX: isSubscribed 의존성 제거로 무한 루프 방지

  // 화면 크기 변경 시 툴팁 위치 재계산
  useEffect(() => {
    const handleResize = () => {
      if (showBatteryTooltip) {
        const position = calculateTooltipPosition();
        setTooltipPosition(position);
      }
    };

    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current);
      }
    };
  }, [showBatteryTooltip]);

  return (
    <header 
      className={`fixed top-0 right-0 left-0 z-30 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
        isHovering || isSidebarOpen 
          ? 'bg-transparent' 
          : 'bg-[var(--accent)] dark:bg-transparent'
      }`}
    >
      <div className="flex justify-between items-center py-1.5 sm:py-1 md:py-0.5 pl-10 sm:pl-4 pr-5 h-10 md:h-8">
        <div className="flex items-center gap-2 md:gap-1.5 relative">
          {showBackButton && (
            <button
              onClick={() => router.back()}
              className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
              title="Go back"
            >
              <svg className="w-4 h-4 md:w-3.5 md:h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M19 12H5" />
                <path d="M12 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          
          <div className={`flex items-center transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
            (isHovering || isSidebarOpen) ? 'ml-0 sm:ml-[80px]' : 'ml-1 sm:ml-4'
          }`}>
             {/* CHATFLIX 로고 - 홈으로 이동 */}
             {/* <Link href="/" className="text-sm px-2 py-0.5 rounded-md bg-[var(--muted)]/10 text-[var(--muted)] font-base tracking-wide select-none hover:bg-[var(--muted)]/20 transition-colors">
              Chatflix
              </Link> */}
          </div>
        </div>

        <div className="flex items-center gap-1.5 md:gap-[0.6rem]">
          {/* Sign In Button for Anonymous Users */}
          {isAnonymousUser && (
            <Link 
              href="/login"
              className="inline-flex items-center justify-center p-[6px] md:px-[2px] text-[var(--foreground)] text-sm md:text-xs transition-all duration-200 cursor-pointer"
            >
                                             <svg className="w-6.5 h-6.5 md:w-5.5 md:h-5.5 mr-1.5 md:mr-1" viewBox="0 0 16 25" fill="none">
                 <g id="person.crop.circle_compact">
                   <rect id="box_" width="16" height="25" fill="none"></rect>
                   <path id="art_" d="M15.09,12.5a7.1,7.1,0,1,1-7.1-7.1A7.1077,7.1077,0,0,1,15.09,12.5ZM7.99,6.6a5.89,5.89,0,0,0-4.4609,9.7471c.6069-.9658,2.48-1.6787,4.4609-1.6787s3.8545.7129,4.4615,1.6787A5.89,5.89,0,0,0,7.99,6.6ZM7.99,8.4A2.5425,2.5425,0,0,0,5.5151,11,2.5425,2.5425,0,0,0,7.99,13.6,2.5424,2.5424,0,0,0,10.4653,11,2.5424,2.5424,0,0,0,7.99,8.4Z" fill="currentColor"></path>
                 </g>
               </svg>
               Sign in
            </Link>
          )}
          
          {/* Pro/Free Status - moved next to notification */}
          <div className="flex items-center justify-center">
            {isSubscriptionLoading && isSubscribed === null ? (
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-400/15 text-[var(--muted)] font-medium">Loading...</span>
            ) : (
              <div className="flex items-center justify-center relative">
                {isAnonymousUser ? (
                  <>
                    {/* Decorative Battery for Anonymous Users */}
                    <div 
                      ref={batteryRef}
                      className="flex items-center justify-center relative group cursor-pointer"
                      onMouseEnter={showTooltip}
                      onMouseLeave={hideTooltip}
                    >
                      <svg 
                        className="w-8 h-9 text-[var(--foreground)] transition-all duration-300 scale-100" 
                        viewBox="0 0 35 30" 
                        fill="none" 
                      >
                        {/* Battery Body */}
                        <rect 
                          x="9" 
                          y="9" 
                          width="22" 
                          height="11" 
                          rx="2.2" 
                          fill="none" 
                          stroke="currentColor" 
                          strokeWidth="1.2"
                        />
                        {/* Battery Terminal */}
                        <polygon 
                          points="33,12.5 33.3,15 33,17.5" 
                          fill="none" 
                          stroke="currentColor" 
                          strokeWidth="1.2"
                        />
                        <rect 
                          x="10.5" 
                          y="10.5" 
                          rx="1.2" 
                          height="8" 
                          width="2.5" 
                          fill="#ef4444"
                          // fill="currentColor" // 통일된 foreground 색상
                        />
                      </svg>
                      
                      {/* Tooltip for Anonymous Users */}
                      {showBatteryTooltip && (
                        <div 
                          className={`absolute top-full mt-2 z-50 animate-in fade-in-0 zoom-in-95 duration-200 ${
                            tooltipPosition === 'left' ? 'left-0' :
                            tooltipPosition === 'right' ? 'right-0' :
                            'left-1/2 transform -translate-x-1/2'
                          }`}
                          onMouseEnter={showTooltip}
                          onMouseLeave={hideTooltip}
                        >
                          <div className="bg-[var(--background)]/95 backdrop-blur-xl border border-[var(--accent)] rounded-2xl shadow-2xl px-5 py-3 whitespace-nowrap min-w-[160px] max-w-[200px]">
                            <div className="flex items-center justify-between mb-2">
                              <div className="text-sm font-medium text-[var(--foreground)]">
                                Guest Mode
                              </div>
                              {/* <div className="w-2 h-2 rounded-full bg-red-500"></div> */}
                            </div>
                            {/* <div className="text-xs text-[var(--muted)] mb-3">
                              Create an account to save conversations
                            </div> */}
                            <Link 
                              href="/pricing"
                              className="inline-flex items-center justify-center w-full px-3 py-2 text-xs font-medium text-white bg-[var(--chat-input-primary)] hover:bg-[var(--chat-input-primary)]/90 rounded-xl transition-all duration-200 hover:shadow-lg hover:scale-105"
                            >
                              View Plans
                            </Link>
                          </div>
                          {/* Arrow removed */}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    {/* iPhone Battery Icon from react-ios-icons */}
                    <div 
                      ref={batteryRef2}
                      className="relative flex items-center justify-center cursor-pointer group"
                      onMouseEnter={showTooltip}
                      onMouseLeave={hideTooltip}
                    >
                      <svg 
                        className={`w-8 h-9 text-[var(--foreground)] transition-all duration-300 scale-100 cursor-pointer`}
                        viewBox="0 0 35 30" 
                        fill="none" 
                      >
                        {/* Battery Body */}
                        <rect 
                          x="9" 
                          y="9" 
                          width="22" 
                          height="11" 
                          rx="2.2" 
                          fill="none" 
                          stroke="currentColor" 
                          strokeWidth="1.2"
                        />
                        {/* Battery Terminal */}
                        <polygon 
                          points="33,12.5 33.3,15 33,17.5" 
                          fill="none" 
                          stroke="currentColor" 
                          strokeWidth="1.2"
                        />
                        <rect 
                          x="10.5" 
                          y="10.5" 
                          rx="1.2" 
                          height="8" 
                          width={isSubscribed ? "19" : "7"} 
                          fill={isSubscribed ? "#22c55e" : "#eab308"}
                          // fill="currentColor" // 통일된 foreground 색상
                        />
                      </svg>
                      
                      {/* Tooltip */}
                      {showBatteryTooltip && (
                        <div 
                          className={`absolute top-full mt-2 z-50 animate-in fade-in-0 zoom-in-95 duration-200 ${
                            tooltipPosition === 'left' ? 'left-0' :
                            tooltipPosition === 'right' ? 'right-0' :
                            'left-1/2 transform -translate-x-1/2'
                          }`}
                          onMouseEnter={showTooltip}
                          onMouseLeave={hideTooltip}
                        >
                          <div className="bg-[var(--background)]/95 backdrop-blur-xl border border-[var(--accent)] rounded-2xl shadow-2xl px-5 py-3 whitespace-nowrap min-w-[160px] max-w-[200px]">
                            <div className="flex items-center justify-between mb-2">
                              <div className="text-sm font-medium text-[var(--foreground)]">
                                {isSubscribed ? 'Pro Plan' : 'Free Plan'}
                              </div>
                              {/* <div className={`w-2 h-2 rounded-full ${
                                isSubscribed ? 'bg-green-500' : 'bg-yellow-500'
                              }`}></div> */}
                            </div>
                            <Link 
                              href="/pricing"
                              className="inline-flex items-center justify-center w-full px-3 py-2 text-xs font-medium text-white bg-[var(--chat-input-primary)] hover:bg-[var(--chat-input-primary)]/90 rounded-xl transition-all duration-200 hover:shadow-lg hover:scale-105"
                            >
                              {isSubscribed ? 'Manage Plan' : 'View Plans'}
                              <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </Link>
                          </div>
                          {/* Arrow removed */}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
          
          <WhatsNewContainer />
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
