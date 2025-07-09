'use client'

import { useRouter } from 'next/navigation'
import { ThemeToggle } from './ThemeToggle'
import WhatsNewContainer from './WhatsNewContainer'
import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link'
import { checkSubscriptionClient } from '@/lib/subscription-client'
import { clearAllSubscriptionCache } from '@/lib/utils'
import { getChatInputTranslations } from '@/app/lib/chatInputTranslations'

export interface HeaderProps {
  isSidebarOpen: boolean;
  onSidebarToggle?: () => void;
  showBackButton?: boolean;
  user?: any;
}

export function Header({ isSidebarOpen, onSidebarToggle, showBackButton, user }: HeaderProps) {
  const router = useRouter()
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [isSubscribed, setIsSubscribed] = useState<boolean | null>(null);
  const [isSubscriptionLoading, setIsSubscriptionLoading] = useState(true);
  const [translations, setTranslations] = useState({
    upgrade: 'Upgrade'
  });
  
  // 최적화를 위한 캐시 관련 상태
  const lastCheckTimeRef = useRef<number>(0);
  const lastCheckedUserIdRef = useRef<string | null>(null);
  const CACHE_DURATION = 2 * 60 * 1000; // 2분 캐시
  
  // 번역 초기화
  useEffect(() => {
    const chatTranslations = getChatInputTranslations();
    setTranslations({
      upgrade: chatTranslations.upgrade
    });
  }, []);
  
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

  // 드롭다운 토글 함수
  const toggleDropdown = useCallback(() => {
    setDropdownOpen((v) => !v);
  }, []);

  // 드롭다운 닫기 함수
  const closeDropdown = useCallback(() => {
    setDropdownOpen(false);
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [dropdownOpen]);

  return (
    <header 
      className={`fixed top-0 right-0 z-30 bg-background transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
        isSidebarOpen ? 'left-80' : 'left-0'
      }`}
      style={{
        willChange: 'left'
      }}
    >
      <div className={`flex justify-between items-center py-6 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
        isSidebarOpen ? 'px-6' : 'pl-16 pr-6'
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
            
            {/* PRO 태그 - 드롭다운 표시 */}
            <div className="relative" ref={dropdownRef}>
              <button
                className="text-sm px-2 py-0.5 rounded-full bg-[var(--muted)]/10 text-[var(--muted)] font-medium tracking-wide select-none flex items-center gap-1 hover:bg-[var(--muted)]/20 transition-colors"
                onClick={toggleDropdown}
                aria-haspopup="listbox"
                aria-expanded={dropdownOpen}
              >
                {isSubscriptionLoading && isSubscribed === null ? (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-400/15 text-[var(--muted)] font-medium">Loading...</span>
                ) : (
                  isSubscribed ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/15 text-green-500 font-medium">Pro</span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-400/15 text-[var(--muted)] font-medium">Free</span>
                  )
                )}
                <svg width="14" height="14" viewBox="0 0 20 20" fill="none" className="ml-1 opacity-60"><path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              {dropdownOpen && (
                <div 
                  className="absolute left-0 mt-3 w-56 bg-white/90 dark:bg-black/80 backdrop-blur-2xl border border-black/5 dark:border-white/10 rounded-2xl shadow-2xl shadow-black/20 dark:shadow-black/60 z-50 p-2.5 animate-in fade-in duration-200 slide-in-from-top-2 min-w-[224px] flex flex-col gap-1.5"
                  style={{
                    transform: 'translateY(4px)',
                    WebkitBackdropFilter: 'blur(24px)',
                    backdropFilter: 'blur(24px)'
                  }}
                >
                  {/* Apple-style arrow */}
                  <div className="absolute bottom-full left-6 mb-1.5 w-3 h-3 bg-white/90 dark:bg-black/80 border-l border-t border-black/5 dark:border-white/10 rotate-45 backdrop-blur-2xl -z-10"></div>
                  {/* Pro Plan Card */}
                  <div
                    className={`flex justify-between items-center rounded-xl px-3 py-3 transition-all duration-200 ${
                      (isSubscribed ?? false)
                        ? 'bg-green-500/10 border border-green-500/20 shadow-sm'
                        : 'bg-gray-50/50 dark:bg-gray-800/30 hover:bg-gray-100/50 dark:hover:bg-gray-700/30 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      {/* <div className="w-10 h-10 rounded-full bg-green-500/15 flex items-center justify-center">
                        <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M7 11V7a5 5 0 0 1 9.9-1" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div> */}
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-gray-900 dark:text-white tracking-tight">
                          Pro
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center">
                      {(isSubscribed ?? false) ? (
                        <div className="w-7 h-7 rounded-full bg-green-500/20 flex items-center justify-center">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-green-600 dark:text-green-400">
                            <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      ) : (
                        <Link
                          href="/pricing"
                          className="group inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold transition-all duration-200 shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 hover:scale-[1.02] active:scale-[0.98]"
                          onClick={closeDropdown}
                        >
                          {translations.upgrade}
                          <svg className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                          </svg>
                        </Link>
                      )}
                    </div>
                  </div>

                  {/* Free Plan Card */}
                  <div
                    className={`flex justify-between items-center rounded-xl px-3 py-3 transition-all duration-200 ${
                      !(isSubscribed ?? false)
                        ? 'bg-gray-100/50 dark:bg-gray-700/30 border border-gray-200/50 dark:border-gray-600/30 shadow-sm'
                        : 'bg-gray-50/30 dark:bg-gray-800/20 hover:bg-gray-100/30 dark:hover:bg-gray-700/20 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      {/* <div className="w-10 h-10 rounded-full bg-gray-500/10 dark:bg-gray-400/10 flex items-center justify-center">
                        <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </div> */}
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-gray-900 dark:text-white tracking-tight">
                          Free
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center">
                      {!(isSubscribed ?? false) ? (
                        <div className="w-7 h-7 rounded-full bg-gray-500/15 dark:bg-gray-400/15 flex items-center justify-center">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-gray-600 dark:text-gray-400">
                            <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      ) : (
                        <Link
                          href="/pricing"
                          className="group inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gray-500/10 dark:bg-gray-400/10 hover:bg-gray-500/20 dark:hover:bg-gray-400/20 text-gray-700 dark:text-gray-300 text-xs font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                          onClick={closeDropdown}
                        >
                          Manage
                          <svg className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                          </svg>
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
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
