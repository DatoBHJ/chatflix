'use client'

import { useRouter } from 'next/navigation'
import { ThemeToggle } from './ThemeToggle'
import WhatsNewContainer from './WhatsNewContainer'
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link'
import { checkSubscriptionClient } from '@/lib/subscription-client'
import { clearAllSubscriptionCache } from '@/lib/utils'

export interface HeaderProps {
  isSidebarOpen: boolean;
  onSidebarToggle: () => void;
  showBackButton?: boolean;
  user?: any;
}

export function Header({ isSidebarOpen, onSidebarToggle, showBackButton, user }: HeaderProps) {
  const router = useRouter()
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [isSubscribed, setIsSubscribed] = useState<boolean | null>(null);
  const [isSubscriptionLoading, setIsSubscriptionLoading] = useState(true);
  
  useEffect(() => {
    let ignore = false;
    
    async function check() {
      if (!user?.id) {
        setIsSubscribed(false);
        setIsSubscriptionLoading(false);
        return;
      }

      setIsSubscriptionLoading(true);
      try {
        const has = await checkSubscriptionClient();
        if (!ignore) {
          setIsSubscribed(has);
        }
      } catch (error) {
        console.error('Failed to check subscription status:', error);
        if (!ignore) {
          setIsSubscribed(false);
        }
      } finally {
        if (!ignore) {
          setIsSubscriptionLoading(false);
        }
      }
    }
    
    check();
    return () => { ignore = true; };
  }, [user?.id]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && user?.id) {
        console.log('Header: Page became visible, refreshing subscription status...');
        
        // Clear cache and check subscription status
        clearAllSubscriptionCache();
        
        // Small delay to ensure cache is cleared
        setTimeout(async () => {
          try {
            setIsSubscriptionLoading(true);
            const has = await checkSubscriptionClient();
            setIsSubscribed(has);
            console.log('Header: Subscription status refreshed:', has);
          } catch (error) {
            console.error('Header: Error refreshing subscription status:', error);
            setIsSubscribed(false);
          } finally {
            setIsSubscriptionLoading(false);
          }
        }, 300); // Slightly shorter delay for header
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user?.id]);

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
    <header className="fixed top-0 left-0 right-0 z-40 bg-background">
      <div className="flex justify-between items-center px-6 py-6">
        <div className="flex items-center gap-3 relative">
          {showBackButton ? (
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
          ) : (
            <button
              onClick={onSidebarToggle}
              className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
              title={isSidebarOpen ? "Close menu" : "Open menu"}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
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
                onClick={() => {
                  if (!isSubscriptionLoading) {
                    setDropdownOpen((v) => !v);
                  }
                }}
                aria-haspopup="listbox"
                aria-expanded={dropdownOpen}
              >
                {isSubscriptionLoading ? (
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
                <div className="absolute left-0 mt-2 w-64 bg-background border border-[var(--subtle-divider)] rounded-xl shadow-lg z-50 py-3 px-2 animate-fade-in min-w-[220px] flex flex-col gap-2">
                  {/* Unlimited Plan Card */}
                  <div
                    className={`flex justify-between items-center rounded-lg px-4 py-3 transition-all ${
                      (isSubscribed ?? false)
                        ? 'border border-green-500/20 bg-green-500/5'
                        : 'hover:bg-[var(--accent)]/10'
                    }`}
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-semibold text-green-500">
                        Pro
                      </span>
                      <span className="text-xs text-[var(--muted)]">Unlimited access to all features</span>
                    </div>
                    
                    <div className="flex items-center">
                      {!isSubscriptionLoading && (isSubscribed ?? false) ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-green-500"><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      ) : (
                        <Link
                          href="/pricing"
                          className="px-3 py-1 rounded-full border border-green-500 text-green-500 text-xs font-medium hover:bg-green-500/10 transition-all inline-block"
                          onClick={() => setDropdownOpen(false)}
                        >
                          Upgrade
                        </Link>
                      )}
                    </div>
                  </div>

                  {/* Free Plan Card */}
                  <div
                    className={`flex justify-between items-center rounded-lg px-4 py-3 transition-all ${
                      !(isSubscribed ?? false)
                        ? 'border border-[var(--subtle-divider)] bg-[var(--muted)]/5'
                        : 'hover:bg-[var(--accent)]/10'
                    }`}
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-semibold text-[var(--muted)]">
                        Free
                      </span>
                      <span className="text-xs text-[var(--muted)]">Basic access with limitations</span>
                    </div>
                    
                    <div className="flex items-center">
                      {!isSubscriptionLoading && !(isSubscribed ?? false) ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-[var(--muted)]"><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      ) : (
                        <Link
                          href="/pricing"
                          className="px-3 py-1 rounded-full border border-[var(--subtle-divider)] text-[var(--muted)] text-xs font-medium hover:bg-[var(--muted)]/20 transition-all inline-block"
                          onClick={() => setDropdownOpen(false)}
                        >
                          Downgrade
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
