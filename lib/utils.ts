/**
 * 사용자의 rate limit 정보를 localStorage에서 제거하는 유틸리티 함수
 * 이 함수는 다음 상황에서만 호출됩니다:
 * 1. 사용자가 새로 구독했을 때
 * 2. 구독이 갱신됐을 때
 * 3. 관리자가 수동으로 rate limit을 해제할 때
 * 
 * 주의: 일반적인 로그인이나 페이지 로드시에는 호출하지 않습니다.
 * rate limit 페이지에서는 절대 호출하지 않아야 합니다.
 */
export function clearRateLimitInfo(reason?: 'subscription' | 'admin' | 'renewal') {
  if (typeof window === 'undefined') return;
  
  // rate limit 페이지에서는 실행하지 않음
  if (window.location.pathname.includes('/rate-limit')) {
    console.log('Skipping rate limit clear on rate-limit page');
    return;
  }
  
  try {
    // 새로운 형식의 rate limit 정보 제거
    localStorage.removeItem('rateLimitLevels');
    
    // 레거시 형식의 rate limit 정보도 제거
    localStorage.removeItem('rateLimitInfo');
    
    console.log(`Rate limit information cleared from localStorage. Reason: ${reason || 'unknown'}`);
  } catch (error) {
    console.error('Error clearing rate limit information:', error);
  }
}

/**
 * 구독 관련 캐시를 정리하는 유틸리티 함수
 * 사용자 로그아웃, 구독 상태 변경 시 호출
 */
export function clearAllSubscriptionCache() {
  if (typeof window === 'undefined') return;
  
  try {
    // Clear localStorage subscription cache
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('subscription_status_')) {
        localStorage.removeItem(key);
      }
    });
    
    // Clear client-side cache (importing here to avoid circular dependency)
    import('@/lib/subscription-client').then(module => {
      module.clearSubscriptionCache();
    });
    
    console.log('All subscription caches cleared');
  } catch (error) {
    console.error('Error clearing subscription cache:', error);
  }
} 