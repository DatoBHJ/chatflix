import { linkMetadataCache } from './linkMetadataCache';

// 🚀 하이브리드 캐싱 전략: 메모리 + Redis
interface HybridCacheConfig {
  useRedis: boolean;
  redisEndpoint?: string;
  redisToken?: string;
  fallbackToMemory: boolean;
}

class HybridLinkCache {
  private memoryCache = linkMetadataCache;
  private redisClient: any = null;
  private config: HybridCacheConfig;
  private isRedisConnected = false;

  constructor(config: HybridCacheConfig) {
    this.config = config;
    this.initializeRedis();
  }

  // 🚀 Redis 초기화 (선택적)
  private async initializeRedis() {
    if (!this.config.useRedis) return;

    try {
      // Upstash Redis 클라이언트 초기화
      const { Redis } = await import('@upstash/redis');
      this.redisClient = new Redis({
        url: this.config.redisEndpoint!,
        token: this.config.redisToken!,
      });
      this.isRedisConnected = true;
    } catch (error) {
      console.warn('Redis connection failed, falling back to memory cache:', error);
      this.isRedisConnected = false;
    }
  }

  // 🚀 캐시에서 메타데이터 가져오기 (우선순위: Redis → Memory)
  async get(url: string) {
    // 1. Redis에서 먼저 확인
    if (this.isRedisConnected) {
      try {
        const redisData = await this.redisClient.get(`link:${url}`);
        if (redisData) {
          // Redis에서 찾았으면 메모리 캐시에도 저장
          this.memoryCache.set(url, redisData);
          return redisData;
        }
      } catch (error) {
        console.warn('Redis get failed:', error);
      }
    }

    // 2. 메모리 캐시에서 확인
    const memoryData = this.memoryCache.get(url);
    if (memoryData) {
      // 메모리에서 찾았으면 Redis에도 저장 (백그라운드)
      this.setToRedis(url, memoryData);
      return memoryData;
    }

    return null;
  }

  // 🚀 캐시에 메타데이터 저장 (Memory + Redis)
  async set(url: string, metadata: any, source: 'api' | 'searchapi' = 'api') {
    // 1. 메모리 캐시에 저장 (즉시)
    this.memoryCache.set(url, metadata, source);

    // 2. Redis에 저장 (백그라운드)
    this.setToRedis(url, metadata);
  }

  // 🚀 Redis에 비동기 저장
  private async setToRedis(url: string, metadata: any) {
    if (!this.isRedisConnected) return;

    try {
      await this.redisClient.setex(`link:${url}`, 300, JSON.stringify(metadata)); // 5분 TTL
    } catch (error) {
      console.warn('Redis set failed:', error);
    }
  }

  // 🚀 SearchAPI 데이터 우선 저장
  async setSearchApiData(url: string, title: string, thumbnailUrl: string) {
    const domain = new URL(url).hostname.replace(/^www\./, '');
    const metadata = {
      title,
      description: '',
      image: thumbnailUrl,
      publisher: domain,
      url
    };
    
    await this.set(url, metadata, 'searchapi');
  }

  // 🚀 캐시 통계
  getStats() {
    return {
      memory: this.memoryCache.getStats(),
      redis: this.isRedisConnected,
      hybrid: true
    };
  }
}

// 🚀 환경에 따른 설정
const getCacheConfig = (): HybridCacheConfig => {
  const useRedis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN;
  
  return {
    useRedis: !!useRedis,
    redisEndpoint: process.env.UPSTASH_REDIS_REST_URL,
    redisToken: process.env.UPSTASH_REDIS_REST_TOKEN,
    fallbackToMemory: true
  };
};

// 🚀 싱글톤 인스턴스
export const hybridLinkCache = new HybridLinkCache(getCacheConfig());
