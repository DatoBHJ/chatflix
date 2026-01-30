/**
 * 이미지/비디오 aspect ratio를 단순화된 카테고리로 분류
 * Pensieve 썸네일 방식과 동일한 로직 - 더 다양한 비율 지원
 * 
 * @param width - 이미지/비디오 너비
 * @param height - 이미지/비디오 높이
 * @returns 카테고리화된 aspect ratio
 *   - 0.7: 매우 세로형 (9:16 등)
 *   - 0.8: 세로형 (3:4, 2:3 등)
 *   - 1.0: 정사각형
 *   - 1.2: 가로형 (4:3 등)
 *   - 1.4: 매우 가로형 (16:9 등)
 */
export function categorizeAspectRatio(width: number, height: number): number {
  const ratio = width / height;
  
  if (ratio < 0.75) {
    // Very tall portrait (e.g., 9:16, phone screenshots)
    return 0.7;
  } else if (ratio < 0.95) {
    // Portrait (e.g., 3:4, 2:3)
    return 0.8;
  } else if (ratio <= 1.05) {
    // Square-ish
    return 1.0;
  } else if (ratio <= 1.35) {
    // Landscape (e.g., 4:3)
    return 1.2;
  } else {
    // Wide landscape (e.g., 16:9)
    return 1.4;
  }
}

/**
 * URL 해시에서 이미지 크기 정보 추출
 * 서버에서 "#w=1024&h=768" 형태로 전달
 */
export function parseImageDimensions(url: string): { width: number; height: number } | null {
  try {
    const hashIndex = url.indexOf('#');
    if (hashIndex === -1) return null;
    
    const hash = url.slice(hashIndex + 1);
    const params = new URLSearchParams(hash);
    const w = parseInt(params.get('w') || '', 10);
    const h = parseInt(params.get('h') || '', 10);
    
    if (isNaN(w) || isNaN(h) || w <= 0 || h <= 0) return null;
    return { width: w, height: h };
  } catch {
    return null;
  }
}

/**
 * 이미지/비디오 공통 크기 정보 추출 함수
 * 해시 형식 (#w=1024&h=768)과 쿼리 파라미터 형식 (?size=1280*720) 모두 지원
 * 
 * @param url - 크기 정보가 포함된 URL
 * @returns { width: number; height: number } | null
 */
export function parseMediaDimensions(url: string): { width: number; height: number } | null {
  // 1. 해시 형식 시도 (#w=1024&h=768) - 이미지/비디오 통일 형식
  const hashResult = parseImageDimensions(url);
  if (hashResult) return hashResult;
  
  // 2. 쿼리 파라미터 형식 시도 (?size=1280*720) - 하위 호환
  try {
    const urlObj = new URL(url);
    const sizeParam = urlObj.searchParams.get('size');
    if (sizeParam) {
      const [width, height] = sizeParam.split('*').map(Number);
      if (!isNaN(width) && !isNaN(height) && width > 0 && height > 0) {
        return { width, height };
      }
    }
  } catch {
    // URL 파싱 실패 시 null 반환
  }
  
  return null;
}

/**
 * 크기 정보로 aspect 카테고리 결정
 */
export function getAspectCategory(width: number, height: number): 'portrait' | 'landscape' | 'square' | 'wide' {
  const ratio = width / height;
  if (ratio < 0.8) return 'portrait';
  if (ratio <= 1.2) return 'square';
  if (ratio <= 1.5) return 'landscape';
  return 'wide';
}
