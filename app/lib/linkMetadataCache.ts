import { useState, useEffect } from 'react';

// 🚀 링크 메타데이터 캐싱 시스템
interface CachedMetadata {
  title: string;
  description: string;
  image: string;
  favicon?: string;
  publisher: string;
  url: string;
  timestamp: number;
  source: 'api' | 'searchapi';
}

class LinkMetadataCache {
  private cache = new Map<string, CachedMetadata>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5분 캐시
  private readonly MAX_CACHE_SIZE = 100; // 최대 100개 캐시

  // 캐시에서 메타데이터 가져오기
  get(url: string): CachedMetadata | null {
    const cached = this.cache.get(url);
    if (!cached) return null;
    
    // 캐시 만료 확인
    if (Date.now() - cached.timestamp > this.CACHE_DURATION) {
      this.cache.delete(url);
      return null;
    }
    
    return cached;
  }

  // 메타데이터 캐시에 저장
  set(url: string, metadata: Omit<CachedMetadata, 'timestamp' | 'source'>, source: 'api' | 'searchapi' = 'api'): void {
    // 캐시 크기 제한
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
    
    this.cache.set(url, {
      ...metadata,
      timestamp: Date.now(),
      source
    });
  }

  // SearchAPI 데이터 우선 캐시
  setSearchApiData(url: string, title: string, thumbnailUrl: string): void {
    const domain = new URL(url).hostname.replace(/^www\./, '');
    this.set(url, {
      title,
      description: '',
      image: thumbnailUrl,
      publisher: domain,
      url
    }, 'searchapi');
  }

  // 캐시 클리어
  clear(): void {
    this.cache.clear();
  }

  // 캐시 통계
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.MAX_CACHE_SIZE,
      cacheDuration: this.CACHE_DURATION
    };
  }
}

// 싱글톤 인스턴스
export const linkMetadataCache = new LinkMetadataCache();

// 🚀 캐시된 메타데이터를 가져오는 훅
export const useCachedLinkMetadata = (url: string) => {
  const [metadata, setMetadata] = useState<CachedMetadata | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // 즉시 캐시에서 확인
    const cached = linkMetadataCache.get(url);
    if (cached) {
      setMetadata(cached);
      return;
    }

    // 캐시에 없으면 백그라운드에서 가져오기
    setLoading(true);
    const fetchMetadata = async () => {
      try {
        const response = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`);
        if (response.ok) {
          const data = await response.json();
          const metadataWithTimestamp = {
            ...data,
            timestamp: Date.now(),
            source: 'api' as const
          };
          
          linkMetadataCache.set(url, data);
          setMetadata(metadataWithTimestamp);
        }
      } catch (error) {
        console.warn('Failed to fetch link metadata:', error);
      } finally {
        setLoading(false);
      }
    };

    // 약간의 지연 후 백그라운드에서 가져오기
    const timeoutId = setTimeout(fetchMetadata, 200);
    return () => clearTimeout(timeoutId);
  }, [url]);

  return { metadata, loading };
};
