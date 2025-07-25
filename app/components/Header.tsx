'use client'

import { useRouter } from 'next/navigation'
import { ThemeToggle } from './ThemeToggle'
import WhatsNewContainer from './WhatsNewContainer'
import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link'
import { checkSubscriptionClient } from '@/lib/subscription-client'
import { clearAllSubscriptionCache } from '@/lib/utils'

export interface HeaderProps {
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  showBackButton?: boolean;
  user?: any;
}

export function Header({ isSidebarOpen, toggleSidebar, showBackButton, user }: HeaderProps) {
  const router = useRouter()

  const [isSubscribed, setIsSubscribed] = useState<boolean | null>(null);
  const [isSubscriptionLoading, setIsSubscriptionLoading] = useState(true);
  
  // 최적화를 위한 캐시 관련 상태
  const lastCheckTimeRef = useRef<number>(0);
  const lastCheckedUserIdRef = useRef<string | null>(null);
  const CACHE_DURATION = 2 * 60 * 1000; // 2분 캐시
  
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

  return (
    <header 
      className={`fixed top-0 right-0 z-30 bg-background sm:bg-transparent transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
        isSidebarOpen ? 'left-80' : 'left-0'
      }`}
      style={{
        willChange: 'left'
      }}
    >
      <div className={`flex justify-between items-center py-6 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
        isSidebarOpen ? 'px-4 pr-6' : 'pl-10 sm:pl-16 pr-6'
      }`}>
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
          
          <div className="flex items-center">
            {/* CHATFLIX 로고 - 홈으로 이동 */}
            <Link href="/" className="text-sm px-2 py-0.5 rounded-md bg-[var(--muted)]/10 text-[var(--muted)] font-medium tracking-wide select-none hover:bg-[var(--muted)]/20 transition-colors">
              CHATFLIX
            </Link>
            
            {/* Pro/Free Status */}
            <div className="ml-2 mb-1">
              {isSubscriptionLoading && isSubscribed === null ? (
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-400/15 text-[var(--muted)] font-medium">Loading...</span>
              ) : (
                isSubscribed ? (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/15 text-green-500 font-medium">Pro</span>
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-400/15 text-[var(--muted)] font-medium">Free</span>
                )
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-5">
          <WhatsNewContainer />
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
