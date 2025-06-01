/**
 * 토큰 수 추정 함수
 */
export function estimateTokenCount(text: string): number {
  // 대략적인 토큰 수 계산 (영어 기준 4자당 1토큰, 한글은 1-2자당 1토큰)
  const isMainlyKorean = /[\uAC00-\uD7AF]/.test(text) && 
                         (text.match(/[\uAC00-\uD7AF]/g)?.length || 0) / text.length > 0.3;
  
  if (isMainlyKorean) {
    return Math.ceil(text.length / 1.5); // 한글은 더 많은 토큰 사용
  }
  return Math.ceil(text.length / 4); // 영어 기준
} 