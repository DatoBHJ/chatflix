import { z } from 'zod';
import { tool } from 'ai';
import { tavily } from '@tavily/core';
import { geolocation } from '@vercel/functions';
import { toolDefinitions } from './prompts';

// URL을 정규화하는 함수 - 변형된 URL을 일관된 형태로 변환
const normalizeUrl = (url: string): string => {
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
const extractDomain = (url: string): string => {
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
const areUrlsSimilar = (url1: string, url2: string): boolean => {
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
const deduplicateResults = <T extends { url: string }>(items: T[]): T[] => {
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

// Web Search 도구 생성 함수
export function createWebSearchTool(processMessages: any[], dataStream: any) {
  return tool({
    description: toolDefinitions.webSearch.description,
    parameters: z.object({
      queries: z.array(z.string().describe(toolDefinitions.webSearch.parameters.queries)),
      maxResults: z.array(
        z.number().describe(toolDefinitions.webSearch.parameters.maxResults).default(8),
      ),
      topics: z.array(
        z.enum(['general', 'news']).describe(toolDefinitions.webSearch.parameters.topics)
      ).default(['general']).transform(topics => topics.map(t => t || 'general')),
      searchDepth: z.array(
        z.enum(['basic', 'advanced']).describe(toolDefinitions.webSearch.parameters.searchDepth).default('basic'),
      ),
      exclude_domains: z
        .array(z.string())
        .describe(toolDefinitions.webSearch.parameters.exclude_domains)
        .default(toolDefinitions.webSearch.defaultExcludeDomains),
    }),
    execute: async ({
      queries,
      maxResults,
      topics,
      searchDepth,
      exclude_domains,
    }: {
      queries: string[];
      maxResults: number[];
      topics: ('general' | 'news')[];
      searchDepth: ('basic' | 'advanced')[];
      exclude_domains?: string[];
    }) => {
      const apiKey = process.env.TAVILY_API_KEY;
      if (!apiKey) {
        throw new Error('TAVILY_API_KEY is not defined in environment variables');
      }
      
      const tvly = tavily({ apiKey });
      const includeImageDescriptions = true;
      
      // Debug logging for web search
      console.log('=== Web Search Debug Info ===');
      console.log('Last user message:', processMessages[processMessages.length - 1].content);
      console.log('Generated search queries:', queries);
      console.log('Search parameters:', {
        maxResults,
        topics,
        searchDepth,
        exclude_domains
      });
      
      // Execute searches in parallel
      const searchPromises = queries.map(async (query, index) => {
        try {
          console.log(`\nExecuting search ${index + 1}/${queries.length}:`, query);
          const data = await tvly.search(query, {
            topic: topics[index] || topics[0] || 'general',
            days: topics[index] === 'news' ? 7 : undefined,
            maxResults: maxResults[index] || maxResults[0] || 10,
            searchDepth: searchDepth[index] || searchDepth[0] || 'basic',
            includeAnswer: true,
            includeImages: true,
            includeImageDescriptions: includeImageDescriptions,
            excludeDomains: exclude_domains,
          });
          
          // 검색 결과에서 중복 제거
          const deduplicatedResults = deduplicateResults(data.results);
          
          // 이미지에서 중복 제거 (대신 이미지는 URL만 중복 제거)
          const deduplicatedImages = data.images ? deduplicateResults(data.images) : [];
          
          console.log(`Search ${index + 1} results:`, {
            query,
            originalResultCount: data.results.length,
            dedupedResultCount: deduplicatedResults.length,
            originalImageCount: data.images?.length || 0,
            dedupedImageCount: deduplicatedImages.length
          });
          
          // Add annotation for query completion
          dataStream.writeMessageAnnotation({
            type: 'query_completion',
            data: {
              query,
              index,
              total: queries.length,
              status: 'completed',
              resultsCount: deduplicatedResults.length,
              imagesCount: deduplicatedImages.length
            }
          });
          
          return {
            query,
            results: deduplicatedResults,
            images: deduplicatedImages
          };
        } catch (error) {
          console.error(`Error searching for query "${query}":`, error);
          
          // Add annotation for failed query
          dataStream.writeMessageAnnotation({
            type: 'query_completion',
            data: {
              query,
              index,
              total: queries.length,
              status: 'completed',
              resultsCount: 0,
              imagesCount: 0,
              error: error instanceof Error ? error.message : 'Unknown error'
            }
          });
          
          // Return empty results for this query
          return {
            query,
            results: [],
            images: []
          };
        }
      });
      
      // 모든 검색 완료 후 결과 수집
      const searches = await Promise.all(searchPromises);
      
      // 모든 검색 결과를 합쳐서 다시 한번 전체 결과에서 중복 제거
      const allResults: Array<{ url: string; query: string; result: any }> = [];
      const allImages: Array<{ url: string; query: string; image: any }> = [];
      
      searches.forEach(search => {
        search.results.forEach(result => {
          allResults.push({
            url: result.url,
            query: search.query,
            result
          });
        });
        
        search.images.forEach(image => {
          allImages.push({
            url: typeof image === 'string' ? image : image.url,
            query: search.query,
            image
          });
        });
      });
      
      // URL 기준으로 전체 결과에서 중복 제거
      const uniqueResultUrls = new Set<string>();
      const uniqueImageUrls = new Set<string>();
      
      // 최종 결과 구성
      const finalSearches = searches.map(search => {
        // 이 검색에서 중복 아닌 결과만 필터링
        const filteredResults = search.results.filter(result => {
          const normalizedUrl = normalizeUrl(result.url);
          if (uniqueResultUrls.has(normalizedUrl)) {
            return false;
          }
          uniqueResultUrls.add(normalizedUrl);
          return true;
        });
        
        // 이 검색에서 중복 아닌 이미지만 필터링
        const filteredImages = search.images.filter(image => {
          const imageUrl = typeof image === 'string' ? image : image.url;
          const normalizedUrl = normalizeUrl(imageUrl);
          if (uniqueImageUrls.has(normalizedUrl)) {
            return false;
          }
          uniqueImageUrls.add(normalizedUrl);
          return true;
        });
        
        return {
          ...search,
          results: filteredResults,
          images: filteredImages
        };
      });
      
      console.log('Final deduplication stats:', {
        originalQueriesCount: searches.length,
        originalResultsTotal: allResults.length,
        finalResultsTotal: [...uniqueResultUrls].length,
        originalImagesTotal: allImages.length, 
        finalImagesTotal: [...uniqueImageUrls].length
      });
      
      return {
        searches: finalSearches
      };
    }
  });
}

// Datetime 도구 생성 함수
export function createDatetimeTool(req: Request) {
  return tool({
    description: toolDefinitions.datetime.description,
    parameters: z.object({}),
    execute: async () => {
      try {
        // Get current date and time
        const now = new Date();
        
        // Get geolocation data from the request
        const geo = geolocation(req);
        
        // Use geolocation to determine timezone
        let userTimezone = 'UTC'; // Default to UTC
        
        if (geo && geo.latitude && geo.longitude) {
          try {
            // Get timezone from coordinates using Google Maps API
            const tzResponse = await fetch(
              `https://maps.googleapis.com/maps/api/timezone/json?location=${geo.latitude},${geo.longitude}&timestamp=${Math.floor(now.getTime() / 1000)}&key=${process.env.GOOGLE_MAPS_API_KEY}`
            );
            
            if (tzResponse.ok) {
              const tzData = await tzResponse.json();
              if (tzData.status === 'OK' && tzData.timeZoneId) {
                userTimezone = tzData.timeZoneId;
                console.log(`Timezone determined from coordinates: ${userTimezone}`);
              } else {
                console.log(`Failed to get timezone from coordinates: ${tzData.status || 'Unknown error'}`);
              }
            } else {
              console.log(`Timezone API request failed with status: ${tzResponse.status}`);
            }
          } catch (error) {
            console.error('Error fetching timezone from coordinates:', error);
          }
        } else {
          console.log('No geolocation data available, using UTC');
        }
        
        // Format date and time using the timezone
        return {
          timestamp: now.getTime(),
          iso: now.toISOString(),
          timezone: userTimezone,
          formatted: {
            date: new Intl.DateTimeFormat('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              timeZone: userTimezone
            }).format(now),
            time: new Intl.DateTimeFormat('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: true,
              timeZone: userTimezone
            }).format(now),
            dateShort: new Intl.DateTimeFormat('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              timeZone: userTimezone
            }).format(now),
            timeShort: new Intl.DateTimeFormat('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: true,
              timeZone: userTimezone
            }).format(now)
          }
        };
      } catch (error) {
        console.error('Datetime error:', error);
        // Fallback to basic time info if there's an error
        const now = new Date();
        return {
          timestamp: now.getTime(),
          iso: now.toISOString(),
          timezone: 'UTC',
          formatted: {
            date: now.toDateString(),
            time: now.toTimeString(),
            dateShort: now.toLocaleDateString(),
            timeShort: now.toLocaleTimeString()
          }
        };
      }
    },
  });
} 