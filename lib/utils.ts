/**
 * 사용자의 rate limit 정보를 localStorage에서 제거하는 유틸리티 함수
 * 이 함수는 다음 상황에서 호출됩니다:
 * 1. 사용자가 로그인할 때
 * 2. 사용자가 구독했을 때 
 * 3. 구독 상태가 변경됐을 때
 * 이렇게 하면 구독자가 rate limit UI에 갇히는 상황을 방지할 수 있습니다.
 */
export function clearRateLimitInfo() {
  if (typeof window === 'undefined') return;
  
  try {
    // 새로운 형식의 rate limit 정보 제거
    localStorage.removeItem('rateLimitLevels');
    
    // 레거시 형식의 rate limit 정보도 제거
    localStorage.removeItem('rateLimitInfo');
    
    console.log('Rate limit information cleared from localStorage');
  } catch (error) {
    console.error('Error clearing rate limit information:', error);
  }
} 