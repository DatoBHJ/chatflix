// URL을 정규화하는 함수 - 변형된 URL을 일관된 형태로 변환
export const normalizeUrl = (url: string): string => {
    try {
      // URL 객체 생성으로 기본 정규화
      const urlObj = new URL(url);
      
      // 프로토콜 표준화 (http -> https)
      urlObj.protocol = 'https:';
      
      // 마지막 슬래시 제거
      let path = urlObj.pathname;
      if (path.length > 1 && path.endsWith('/')) {
        urlObj.pathname = path.slice(0, -1);
      }
      
      // 일반적인 추적 파라미터 제거
      const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid'];
      const params = new URLSearchParams(urlObj.search);
      let modified = false;
      
      trackingParams.forEach(param => {
        if (params.has(param)) {
          params.delete(param);
          modified = true;
        }
      });
      
      if (modified) {
        urlObj.search = params.toString();
      }
      
      return urlObj.toString();
    } catch (e) {
      // 정규화할 수 없는 경우 원래 URL 반환
      return url;
    }
  };
  
// 도메인 추출 함수
export const extractDomain = (url: string): string => {
    try {
      const hostname = new URL(url).hostname;
      const parts = hostname.split('.');
      if (parts.length > 2 && parts[0] === 'www') {
        return parts.slice(1).join('.');
      }
      return hostname;
    } catch (e) {
      return url;
    }
  };
  
// URL 유사성 검사 함수 (두 URL이 실질적으로 같은 리소스를 가리키는지 확인)
export const areUrlsSimilar = (url1: string, url2: string): boolean => {
    try {
        if (url1 === url2) return true;
        
        const norm1 = normalizeUrl(url1);
        const norm2 = normalizeUrl(url2);
        
        // 정규화 후 같은 URL인지 확인
        if (norm1 === norm2) return true;
        
        // 도메인이 같고 경로가 거의 같은지 확인 (쿼리 파라미터 무시)
        const obj1 = new URL(norm1);
        const obj2 = new URL(norm2);
        
        if (obj1.hostname === obj2.hostname) {
        // 경로에서 마지막 슬래시 제거
        const path1 = obj1.pathname.endsWith('/') ? obj1.pathname.slice(0, -1) : obj1.pathname;
        const path2 = obj2.pathname.endsWith('/') ? obj2.pathname.slice(0, -1) : obj2.pathname;
        
        // 경로가 동일하거나 하나가 다른 하나의 상위 경로인 경우
        return path1 === path2 || 
                path1.startsWith(path2 + '/') || 
                path2.startsWith(path1 + '/');
        }
        
        return false;
    } catch (e) {
        return false;
    }
};
  
// 도메인 및 URL을 기준으로 중복 결과 제거 함수
export const deduplicateResults = <T extends { url: string }>(items: T[]): T[] => {
    if (!items || items.length <= 1) return items;

    const result: T[] = [];
    const seenDomains = new Set<string>();
    const seenUrls: string[] = [];

    items.forEach(item => {
        try {
        // URL 유효성 검사
        const url = item.url;
        if (!url || typeof url !== 'string') return;
        
        // 도메인 추출
        const domain = extractDomain(url);
        
        // URL 유사성 검사
        const isDuplicate = seenUrls.some(seenUrl => areUrlsSimilar(url, seenUrl));
        
        // 새로운 도메인과 중복되지 않은 URL이면 추가
        if (!isDuplicate) {
            result.push(item);
            seenUrls.push(url);
            seenDomains.add(domain);
        }
        } catch (error) {
        console.error('Error processing URL for deduplication:', error);
        }
    });

    return result;
};

// 간단한 HTML에서 제목 추출 함수
export function getPageTitle(html: string): string | null {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return titleMatch ? titleMatch[1].trim() : null;
}