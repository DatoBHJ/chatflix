'use client'

import { useRouter, usePathname } from 'next/navigation'
import { ThemeToggle } from './ThemeToggle'
import WhatsNewContainer from './WhatsNewContainer'
import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link'
import { checkSubscriptionClient } from '@/lib/subscription-client'
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

  const [isSubscribed, setIsSubscribed] = useState<boolean | null>(null);
  const [isSubscriptionLoading, setIsSubscriptionLoading] = useState(true);
  const [showBatteryTooltip, setShowBatteryTooltip] = useState(false);
  const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // 최적화를 위한 캐시 관련 상태
  const lastCheckTimeRef = useRef<number>(0);
  const lastCheckedUserIdRef = useRef<string | null>(null);
  const CACHE_DURATION = 2 * 60 * 1000; // 2분 캐시
  
  // 툴팁 표시/숨김 함수
  const showTooltip = () => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
    }
    setShowBatteryTooltip(true);
  };

  const hideTooltip = () => {
    tooltipTimeoutRef.current = setTimeout(() => {
      setShowBatteryTooltip(false);
    }, 150); // 150ms 지연으로 자연스러운 이동 가능
  };
  
  // 구독 상태 확인 함수 최적화
  const checkSubscriptionStatus = useCallback(async (forceCheck = false) => {
    if (!user?.id) {
      setIsSubscribed(false);
      setIsSubscriptionLoading(false);
      lastCheckedUserIdRef.current = null;
      return;
    }

    // 캐시 확인
    const now = Date.now();
    const isCacheValid = now - lastCheckTimeRef.current < CACHE_DURATION;
    const isSameUser = lastCheckedUserIdRef.current === user.id;
    
    if (!forceCheck && isCacheValid && isSameUser && isSubscribed !== null) {
      console.log('[Header] Using cached subscription status');
      setIsSubscriptionLoading(false);
      return;
    }

    // 새로운 사용자이거나 첫 로드인 경우에만 로딩 상태 표시
    if (!isSameUser || isSubscribed === null) {
      setIsSubscriptionLoading(true);
    }
    
    try {
      const has = await checkSubscriptionClient();
      setIsSubscribed(has);
      lastCheckTimeRef.current = now;
      lastCheckedUserIdRef.current = user.id;
    } catch (error) {
      console.error('Failed to check subscription status:', error);
      setIsSubscribed(false);
    } finally {
      setIsSubscriptionLoading(false);
    }
  }, [user?.id, isSubscribed]);
  
  useEffect(() => {
    checkSubscriptionStatus();
  }, [checkSubscriptionStatus]);

  // 백그라운드 새로고침 함수 (로딩 상태 표시 안 함)
  const refreshSubscriptionStatusInBackground = useCallback(async () => {
    if (!user?.id) return;
    
    // 캐시 확인 - 최근에 확인했다면 재확인하지 않음
    const now = Date.now();
    const isCacheValid = now - lastCheckTimeRef.current < CACHE_DURATION;
    const isSameUser = lastCheckedUserIdRef.current === user.id;
    
    if (isCacheValid && isSameUser && isSubscribed !== null) {
      console.log('Header: Using cached subscription status, skipping refresh');
      return;
    }
    
    // Clear cache and check subscription status
    clearAllSubscriptionCache();
    
    // Small delay to ensure cache is cleared
    setTimeout(async () => {
      try {
        // 백그라운드에서 확인 (로딩 상태 표시 안 함)
        const has = await checkSubscriptionClient();
        setIsSubscribed(has);
        lastCheckTimeRef.current = now;
        lastCheckedUserIdRef.current = user.id;
        console.log('Header: Subscription status refreshed:', has);
      } catch (error) {
        console.error('Header: Error refreshing subscription status:', error);
        setIsSubscribed(false);
      }
    }, 300); // Slightly shorter delay for header
  }, [user?.id, isSubscribed]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && user?.id) {
        console.log('Header: Page became visible, checking subscription status...');
        refreshSubscriptionStatusInBackground();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user?.id, refreshSubscriptionStatusInBackground]);

  // 컴포넌트 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current);
      }
    };
  }, []);

  return (
    <header 
      className={`fixed top-0 right-0 left-0 z-30 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
        isHovering || isSidebarOpen 
          ? 'bg-transparent' 
          : 'bg-[var(--accent)] dark:bg-transparent'
      }`}
    >
      <div className="flex justify-between items-center py-2 sm:py-2 pl-10 sm:pl-4 pr-4 h-12">
        <div className="flex items-center gap-3 relative">
          {showBackButton && (
            <button
              onClick={() => router.back()}
              className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
              title="Go back"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
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

        <div className="flex items-center gap-5">
          {/* Pro/Free Status - moved next to notification */}
          <div className="flex items-center justify-center relative ml-1">
            {isSubscriptionLoading && isSubscribed === null ? (
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-400/15 text-[var(--muted)] font-medium">Loading...</span>
            ) : (
              <div className="flex items-center justify-center relative">
                {/* iPhone Battery Icon from react-ios-icons */}
                <div 
                  className="relative flex items-center justify-center cursor-pointer group"
                  onMouseEnter={showTooltip}
                  onMouseLeave={hideTooltip}
                >
                  <Battery 
                    progression={isSubscribed ? 100 : 30}
                    className={`transition-all duration-300 scale-100 transform translate-x-1 group-hover:scale-110 ${
                      isSubscribed 
                        ? 'text-green-500' 
                        : 'text-red-500'
                    }`}
                  />
                  
                  {/* Tooltip */}
                  {showBatteryTooltip && (
                    <div 
                      className="absolute top-full mt-3 left-1/2 transform -translate-x-3/4 z-50 animate-in fade-in-0 zoom-in-95 duration-200"
                      onMouseEnter={showTooltip}
                      onMouseLeave={hideTooltip}
                    >
                      <div className="bg-[var(--background)]/95 backdrop-blur-xl border border-[var(--accent)] rounded-2xl shadow-2xl px-5 py-3 whitespace-nowrap min-w-[140px]">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-sm font-medium text-[var(--foreground)]">
                            {isSubscribed ? 'Pro Plan' : 'Free Plan'}
                          </div>
                          <div className={`w-2 h-2 rounded-full ${
                            isSubscribed ? 'bg-green-500' : 'bg-red-500'
                          }`}></div>
                        </div>
                        <div className="text-xs text-[var(--muted)] mb-3">
                          {isSubscribed 
                            ? 'You have access to all features' 
                            : 'Upgrade to unlock all features'
                          }
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
                      {/* Arrow */}
                      <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1">
                        <div className="w-3 h-3 bg-[var(--background)]/95 backdrop-blur-xl border-l border-t border-[var(--accent)] transform rotate-45"></div>
                      </div>
                    </div>
                  )}
                  
                  {/* Text overlay */}
                  {/* <div className="absolute inset-0 flex items-center justify-center">
                    <span className={`text-[5px] font-bold leading-none ${
                      isSubscribed 
                        ? 'text-white' 
                        : 'text-gray-800'
                    }`}>
                      {isSubscribed ? 'PRO' : 'FREE'}
                    </span>
                  </div> */}
                </div>
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
