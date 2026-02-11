/**
 * 클라이언트 사이드 메모리 캐싱 유틸리티
 * localStorage를 사용하여 가장 빠른 메모리 로드 제공
 */

const MEMORY_CACHE_PREFIX = 'user_memory_';
const CACHE_DURATION = 30 * 60 * 1000; // 30분

interface CachedMemory {
  data: string | null;
  timestamp: number;
  expiresAt: number;
}

/**
 * localStorage에서 사용자 메모리 가져오기
 * @param userId - 사용자 ID
 * @param categories - 로드할 카테고리 (선택사항, 없으면 전체)
 * @returns 캐시된 메모리 데이터 또는 null
 */
export function getCachedMemoryFromStorage(
  userId: string | null | undefined,
  categories?: string[]
): string | null {
  if (!userId || userId === 'anonymous') {
    return null;
  }

  try {
    const cacheKey = categories
      ? `${MEMORY_CACHE_PREFIX}${userId}_${categories.join('_')}`
      : `${MEMORY_CACHE_PREFIX}${userId}_all`;

    const cached = localStorage.getItem(cacheKey);
    if (!cached) {
      return null;
    }

    const parsed: CachedMemory = JSON.parse(cached);
    const now = Date.now();

    // 캐시가 유효한 경우
    if (parsed.expiresAt && now < parsed.expiresAt) {
      console.log(`⚡ [CLIENT CACHE] Using cached memory for user ${userId}`);
      return parsed.data;
    }

    // 만료된 캐시 삭제
    localStorage.removeItem(cacheKey);
    return null;
  } catch (error) {
    console.warn('Failed to load cached memory from localStorage:', error);
    return null;
  }
}

/**
 * localStorage에 사용자 메모리 저장
 * @param userId - 사용자 ID
 * @param memoryData - 메모리 데이터
 * @param categories - 저장할 카테고리 (선택사항)
 */
export function setCachedMemoryToStorage(
  userId: string | null | undefined,
  memoryData: string | null,
  categories?: string[]
): void {
  if (!userId || userId === 'anonymous') {
    return;
  }

  try {
    const cacheKey = categories
      ? `${MEMORY_CACHE_PREFIX}${userId}_${categories.join('_')}`
      : `${MEMORY_CACHE_PREFIX}${userId}_all`;

    const now = Date.now();
    const cached: CachedMemory = {
      data: memoryData,
      timestamp: now,
      expiresAt: now + CACHE_DURATION,
    };

    localStorage.setItem(cacheKey, JSON.stringify(cached));
    console.log(`💾 [CLIENT CACHE] Saved memory to localStorage for user ${userId}`);
  } catch (error) {
    console.warn('Failed to save memory to localStorage:', error);
    // localStorage 용량 초과 등의 경우 무시
  }
}

/**
 * 특정 사용자의 메모리 캐시 무효화
 * @param userId - 사용자 ID
 * @param categories - 무효화할 카테고리 (선택사항, 없으면 전체)
 */
export function invalidateMemoryCache(
  userId: string | null | undefined,
  categories?: string[]
): void {
  if (!userId || userId === 'anonymous') {
    return;
  }

  try {
    if (categories) {
      // 특정 카테고리만 무효화
      const cacheKey = `${MEMORY_CACHE_PREFIX}${userId}_${categories.join('_')}`;
      localStorage.removeItem(cacheKey);
    } else {
      // 해당 사용자의 모든 메모리 캐시 무효화
      const prefix = `${MEMORY_CACHE_PREFIX}${userId}_`;
      const keysToRemove: string[] = [];
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
          keysToRemove.push(key);
        }
      }
      
      keysToRemove.forEach(key => localStorage.removeItem(key));
    }
    
    console.log(`🗑️ [CLIENT CACHE] Invalidated memory cache for user ${userId}`);
  } catch (error) {
    console.warn('Failed to invalidate memory cache:', error);
  }
}

/**
 * 서버에서 메모리를 로드하고 localStorage에 캐싱
 * @param userId - 사용자 ID
 * @param categories - 로드할 카테고리 (선택사항)
 * @returns 메모리 데이터 또는 null
 */
export async function loadMemoryWithCache(
  userId: string | null | undefined,
  categories?: string[]
): Promise<string | null> {
  if (!userId || userId === 'anonymous') {
    return null;
  }

  // 1. localStorage에서 먼저 확인
  const cached = getCachedMemoryFromStorage(userId, categories);
  if (cached !== null) {
    return cached;
  }

  // 2. 캐시가 없으면 서버에서 로드
  try {
    const response = await fetch('/api/memory-bank');
    
    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    
    // API 응답 형식: { categories: [{ category, content }, ...] }
    if (!data.categories || !Array.isArray(data.categories)) {
      return null;
    }

    // 메모리 데이터를 문자열로 변환 (전체 메모리 형식)
    let memoryData: string | null = null;
    
    if (categories && categories.length === 1) {
      // 단일 카테고리인 경우
      const category = categories[0];
      const categoryEntry = data.categories.find((c: any) => c.category === category);
      if (categoryEntry?.content) {
        memoryData = `## ${formatCategoryName(category)}\n\n${categoryEntry.content}`;
      }
    } else {
      // 전체 또는 여러 카테고리
      const parts: string[] = [];
      
      // 카테고리 순서대로 정렬
      const categoryOrder = ['00-personal-core', '01-interest-core', '02-active-context'];
      const filteredCategories = categories 
        ? data.categories.filter((c: any) => categories.includes(c.category))
        : data.categories;
      
      categoryOrder.forEach(catKey => {
        const categoryEntry = filteredCategories.find((c: any) => c.category === catKey);
        if (categoryEntry?.content) {
          parts.push(`## ${formatCategoryName(catKey)}\n\n${categoryEntry.content}`);
        }
      });
      
      memoryData = parts.length > 0 ? parts.join('\n\n---\n\n') : null;
    }

    // 3. localStorage에 저장
    setCachedMemoryToStorage(userId, memoryData, categories);
    
    return memoryData;
  } catch (error) {
    console.error('Failed to load memory from server:', error);
    return null;
  }
}

/**
 * 카테고리 이름 포맷팅
 */
function formatCategoryName(category: string): string {
  return category
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

