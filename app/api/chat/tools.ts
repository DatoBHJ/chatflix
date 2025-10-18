import { z } from 'zod';
import { tool } from 'ai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { deduplicateResults, normalizeUrl, getPageTitle } from './utils/toolers';
import * as mathjs from 'mathjs';
import Exa from 'exa-js';
import dotenv from 'dotenv';

// Environment variables
dotenv.config({
  path: '.env.local',
  processEnv: {
    SERPAPI_API_KEY: process.env.SERPAPI_API_KEY || '',
    SEARCH_API_KEY: process.env.SEARCH_API_KEY || '',
    SERPER_API_KEY: process.env.SERPER_API_KEY || '',
    TAVILY_API_KEY: process.env.TAVILY_API_KEY || '',
    EXA_API_KEY: process.env.EXA_API_KEY || '',
    WOLFRAM_ALPHA_APPID: process.env.WOLFRAM_ALPHA_APPID || '',
    POLLINATIONAI_API_KEY: process.env.POLLINATIONAI_API_KEY || '',
    GOOGLE_GENERATIVE_AI_API_KEY: process.env.GOOGLE_GENERATIVE_AI_API_KEY || ''
  }
});

// 도구 설명 및 매개변수 정의
const toolDefinitions = {
  webSearch: {
    description: 'Search the web using Exa for information with multiple queries. This tool automatically optimizes queries. Note: `include_domains` and `exclude_domains` are mutually exclusive. `include_domains` will be prioritized. Use 2-4 queries maximum per tool call. Scale maxResults inversely with query count for balanced results. STRATEGY: Prefer google_search for general information and news. Use this tool when you need Exa\'s strengths (images, niche content, semantic search, academic papers, etc.).',
    inputSchema: {
      queries: 'Array of search queries to look up on the web. Exa\'s autoprompt feature will optimize these. Use 2-4 queries maximum per tool call. Scale maxResults inversely: 1 query=15-20, 2 queries=8-12 each, 3 queries=6-10 each, 4 queries=5-8 each.',
      maxResults: 'Array of maximum number of results to return per query. Scale inversely with query count: 1 query=15-20, 2 queries=8-12 each, 3 queries=6-10 each, 4 queries=5-8 each. Default is 10.',
      topics: 'Array of topic types to search for. Use diverse topic types for comprehensive results. Options: general (for images, niche content, semantic search), financial report, company, research paper, pdf, github, personal site, linkedin profile. Note: news topic removed - use google_search for news. STRATEGY: Prefer google_search for general information. Use "general" topic when you need Exa\'s strengths like images, niche content, or semantic understanding. Choose appropriate topics: research papers for academic info, financial reports for business data, company for corporate info, pdf for official documents, github for code/tech, personal site for blogs, linkedin profile for professional info.',
      include_domains: 'A list of domains to prioritize in search results. Cannot be used with exclude_domains.',
      exclude_domains: 'A list of domains to exclude from all search results. Cannot be used with include_domains.'
    }
  },
  jina_link_reader: {
    description: 'Read and extract content from a specific URL using Jina.ai',
    inputSchema: {
      url: 'The URL to read content from. The URL must be a valid web address starting with http:// or https://'
    }
  },
  calculator: {
    description: 'A tool for evaluating mathematical expressions. Example expressions: \'1.2 * (2 + 4.5)\', \'12.7 cm to inch\', \'sin(45 deg) ^ 2\'.',
    inputSchema: {
      expression: 'The mathematical expression to evaluate.'
    }
  },

  imageGenerator: {
    description: 'Generate images using Pollinations AI based on text prompts. For editing, provide the seed of the original image.',
    inputSchema: {
      prompts: 'Text description(s) of the image(s) to generate. Can be a single string or array of strings. Should be detailed and specific.',
      model: 'The model to use for generation (flux or turbo)',
      width: 'Image width in pixels',
      height: 'Image height in pixels',
      seed: 'Optional. The seed for random number generation. If not provided for a new image, a random seed will be used by the tool. For editing an existing image, provide the exact `seed` of the original image to maintain consistency with the modified prompt.'
    }
  },
  xSearch: {
    description: 'Search X (formerly Twitter) posts.',
    inputSchema: {
      query: 'The search query, if a username is provided put in the query with @username',
      startDate: 'The start date for the search in YYYY-MM-DD format',
      endDate: 'The end date for the search in YYYY-MM-DD format'
    }
  },
  youtubeSearch: {
    description: 'Search YouTube videos using Exa AI and get detailed video information.',
    inputSchema: {
      query: 'The search query for YouTube videos'
    }
  },
  youtubeAnalyzer: {
    description: 'Extract detailed information and transcripts from specific YouTube videos.',
    inputSchema: {
      urls: 'Array of YouTube video URLs to analyze. Each URL should be a valid YouTube watch link.',
      lang: 'Optional language code for the transcript (e.g., "en", "es", "fr"). Default is "en".'
    }
  },
  wolframAlpha: {
    description: 'Advanced computational knowledge engine that can solve complex problems across various academic disciplines including mathematics, physics, chemistry, engineering, computer science, and more.',
    inputSchema: {
      query: 'The query to send to Wolfram Alpha. Can be mathematical expressions, scientific questions, engineering problems, etc.',
      format: 'The desired format of the response (simple, detailed, step-by-step). Default is detailed.',
      includePods: 'Specific Wolfram Alpha pods to include in the response (optional array of strings).',
      timeout: 'Maximum time in seconds to wait for a response. Default is 30.',
      units: 'Unit system to use for results (metric or imperial).',
      domain: 'Academic domain to optimize the query for (math, physics, chemistry, etc.).'
    }
  },
  googleSearch: {
    description: 'Search Google using SearchAPI for comprehensive web search results. This tool provides access to Google\'s search index with location and language customization. Supports both web search and image search.',
    inputSchema: {
      queries: 'The search queries to send to Google. Can be a single query string or an array of queries. Each query can be anything you would use in a regular Google search.',
      engines: 'Optional. The search engines to use. Can be a single engine or array matching queries. Options: "google" (web search), "google_images" (image search), "google_videos" (video search). Default is "google".',
      maxResults: 'Optional. Maximum number of results to return per query. For google search, default is 10. For google_images, this parameter is ignored (all images sent to client, LLM context limited to 20). Can be a single number or array matching queries.',
      locations: 'Optional. The locations from where you want the searches to originate (e.g., "New York", "London", "Tokyo"). Can be a single location or array matching queries.',
      gls: 'Optional. The country codes for search results (e.g., "us", "uk", "jp"). Can be a single code or array matching queries. Default is "us".'
    }
  },
};
// Web Search 도구 생성 함수
export function createWebSearchTool(dataStream: any, forcedTopic?: string) {
  // 검색 결과를 저장할 배열
  const searchResults: any[] = [];
  
  const AllowedTopic = z.enum([
    'general', // 복원됨 - 이미지 검색용
    // 'news', // 제거됨 - Google Search로 대체
    'financial report',
    'company',
    'research paper',
    'pdf',
    'github',
    'personal site',
    'linkedin profile'
  ]);

  const webSearchInputSchema = z.object({
    // Accept string or array; coerce to array
    queries: z
      .union([
        z.array(z.string()),
        z.string()
      ])
      .transform((v) => (Array.isArray(v) ? v : [v]))
      .describe(toolDefinitions.webSearch.inputSchema.queries),
    // Accept number or array of numbers; coerce to array
    maxResults: z
      .union([
        z.array(z.number()),
        z.number()
      ])
      .optional()
      .transform((v) => (v === undefined ? undefined : Array.isArray(v) ? v : [v])),
    // Accept single topic or array; coerce and default to ['general'] if missing (복원됨)
    topics: z
      .union([
        z.array(AllowedTopic),
        AllowedTopic
      ])
      .optional()
      .transform((v) => (v === undefined ? ['general'] : Array.isArray(v) ? v : [v]))
      .describe(toolDefinitions.webSearch.inputSchema.topics),
    // Accept string or array; coerce to array
    include_domains: z
      .union([z.array(z.string()), z.string()])
      .optional()
      .transform((v) => (v === undefined ? undefined : Array.isArray(v) ? v : [v]))
      .describe(toolDefinitions.webSearch.inputSchema.include_domains),
    exclude_domains: z
      .union([z.array(z.string()), z.string()])
      .optional()
      .transform((v) => (v === undefined ? undefined : Array.isArray(v) ? v : [v]))
      .describe(toolDefinitions.webSearch.inputSchema.exclude_domains),
  });

  type WebSearchInput = {
    queries: string[];
    maxResults?: number[];
    topics: ('general' | /* 'news' | */ 'financial report' | 'company' | 'research paper' | 'pdf' | 'github' | 'personal site' | 'linkedin profile')[];
    include_domains?: string[];
    exclude_domains?: string[];
  };
  type WebSearchOutput = {
    searchId: string;
    searches: Array<{
      query: string;
      topic: 'general' | /* 'news' | */ 'financial report' | 'company' | 'research paper' | 'pdf' | 'github' | 'personal site' | 'linkedin profile';
      results: any[];
      images: any[];
    }>;
    imageMap: Record<string, string>;
    totalImagesFound: number;
  };

  const webSearchTool = tool<WebSearchInput, WebSearchOutput>({
    description: toolDefinitions.webSearch.description,
    inputSchema: webSearchInputSchema as unknown as z.ZodType<WebSearchInput>,
    execute: async (input: WebSearchInput) => {
      const { queries, maxResults, topics, include_domains, exclude_domains } = input;
      
      // maxResults가 없으면 기본값 설정
      const finalMaxResults = maxResults || Array(queries.length).fill(10);
      
      // 강제로 지정된 토픽이 있으면 해당 토픽만 사용
      const finalTopics = forcedTopic ? 
        Array(queries.length).fill(forcedTopic as any) : 
        topics;
      const apiKey = process.env.EXA_API_KEY;
      if (!apiKey) {
        throw new Error('EXA_API_KEY is not defined in environment variables');
      }
      
      // Generate a unique search ID for this search attempt
      const searchId = `search_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      const exa = new Exa(apiKey);
      
      // Debug logging for web search
      console.log('=== Web Search (Exa) Debug Info ===');
      console.log('Search ID:', searchId);
      console.log('Generated search queries:', queries);
      console.log('Search parameters:', {
        maxResults: finalMaxResults,
        topics: finalTopics,
        include_domains,
        exclude_domains,
        forcedTopic: forcedTopic || 'none'
      });
      
      // 쿼리 중복 상태 알림 방지를 위한 추적 세트
      const annotatedQueries = new Set<string>();
      
              // Execute searches in parallel
        const searchPromises = queries.map(async (query, index) => {
          // 토픽은 try/catch 외부에서 계산하여 양쪽에서 접근 가능하도록 함
          const currentTopic = (finalTopics && finalTopics[index]) || finalTopics[0] || 'general';
          try {
            // 중복 체크 - 이미 처리한 쿼리는 건너뜀
            const queryKey = `${query}-${index}`;
          
          // 토픽 활용 로깅
          console.log(`[SEARCH_DEBUG] Query ${index + 1}: "${query}" using topic: "${currentTopic}"`);
          
          if (!annotatedQueries.has(queryKey)) {
            // 진행 상태 어노테이션 전송
            if (dataStream?.write) {
              dataStream.write({
                type: 'data-query_completion',
                id: `ann-${searchId}-${index}-start`,
                data: {
                  searchId,
                  query,
                  index,
                  total: queries.length,
                  status: 'in_progress',
                  resultsCount: 0,
                  imagesCount: 0,
                  topic: currentTopic
                }
              });
            }
            // 처리한 쿼리 추적에 추가
            annotatedQueries.add(queryKey);
          }
          const currentMaxResults = (finalMaxResults && finalMaxResults[index]) || finalMaxResults[0] || 10;
          
          const searchOptions: any = {
            livecrawl: "preferred",
            numResults: currentMaxResults,
            useAutoprompt: true,
            text: true,
            summary: true,
            type: "neural",
          };
          
          // general이 아닌 경우에만 category 설정 (general 복원됨)
          if (currentTopic !== 'general') {
            searchOptions.category = currentTopic;
            console.log(`[SEARCH_DEBUG] Using category: "${currentTopic}" for query: "${query}"`);
          } else {
            console.log(`[SEARCH_DEBUG] Using general search (no category) for query: "${query}"`);
          }
          
          
          if (include_domains && include_domains.length > 0) {
            searchOptions.includeDomains = include_domains;
          } else if (exclude_domains && exclude_domains.length > 0) {
            searchOptions.excludeDomains = exclude_domains;
          }
          
          const data = await exa.searchAndContents(query, searchOptions);
          
          // Log total cost for this search
          if (data.costDollars && data.costDollars.total) {
            console.log(`Exa search cost - Query: "${query}", Total Cost: $${data.costDollars.total}`);
          } else {
            console.log(`Exa search cost - Query: "${query}", Cost info not available`);
          }
          
          const rawResults = data.results
            .map((result: any, resultIndex: number) => {
              const linkId = `exa_link_${searchId}_${index}_${resultIndex}`;
              return {
                url: result.url,
                title: result.title || '',
                content: result.text.text || '',
                publishedDate: result.publishedDate,
                author: result.author,
                score: result.score,
                summary: result.summary,
                linkId: linkId,
              };
            });
        
          const rawImages = data.results.filter((r: any) => r.image).map((r: any) => ({
              url: r.image,
              description: r.title || (r.text ? r.text.substring(0, 100) + '...' : ''),
          }));

          const deduplicatedResults = deduplicateResults(rawResults);
          const deduplicatedImages = rawImages.length > 0 ? deduplicateResults(rawImages) : [];
          
          // Generate unique IDs for images and create mapping
          const imagesWithIds = deduplicatedImages.map((image: any, imageIndex: number) => {
            const imageId = `search_img_${searchId}_${index}_${imageIndex}`;
            return {
              ...image,
              id: imageId
            };
          });
          
          // 완료 상태 어노테이션 전송
          const completedQueryKey = `${query}-${index}-completed`;
          if (!annotatedQueries.has(completedQueryKey)) {
            if (dataStream?.write) {
              dataStream.write({
                type: 'data-query_completion',
                id: `ann-${searchId}-${index}-completed`,
                data: {
                  searchId,
                  query,
                  index,
                  total: queries.length,
                  status: 'completed',
                  resultsCount: deduplicatedResults.length,
                  imagesCount: deduplicatedImages.length,
                  topic: currentTopic
                }
              });
            }
            annotatedQueries.add(completedQueryKey);
          }
          
          return {
            query,
            topic: currentTopic,
            results: deduplicatedResults,
            images: imagesWithIds
          };
        } catch (error) {
          console.error(`Error searching with Exa for query "${query}":`, error);
          
          // 에러 상태 어노테이션 전송
          if (dataStream?.write) {
            dataStream.write({
              type: 'data-query_completion',
              id: `ann-${searchId}-${index}-error`,
              data: {
                searchId,
                query,
                index,
                total: queries.length,
                status: 'completed',
                resultsCount: 0,
                imagesCount: 0,
                error: error instanceof Error ? error.message : 'Unknown error',
                topic: currentTopic
              }
            });
          }
          
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
      
      console.log(`=== Exa Search Complete ===`);
      
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
        
        // 해당 쿼리의 topic 정보 찾기
        const queryIndex = queries.findIndex(q => q === search.query);
        const topic = queryIndex >= 0 ? finalTopics[queryIndex] || finalTopics[0] || 'general' : 'general';
        
        return {
          ...search,
          topic,
          results: filteredResults,
          images: filteredImages
        };
      });
      
      // Create image mapping, link mapping, thumbnail mapping, and title mapping for all searches
      const imageMap: { [key: string]: string } = {};
      const linkMap: { [key: string]: string } = {};
      const thumbnailMap: { [key: string]: string } = {};
      const titleMap: { [key: string]: string } = {};
      
      finalSearches.forEach(search => {
        // Process images
        search.images.forEach((image: any) => {
          if (image.id && image.url) {
            imageMap[image.id] = image.url;
          }
        });
        
        // Process links, thumbnails, and titles
        search.results.forEach((result: any) => {
          if (result.linkId && result.url) {
            linkMap[result.linkId] = result.url;
          }
          if (result.linkId && result.thumbnail) {
            thumbnailMap[result.linkId] = result.thumbnail;
          }
          if (result.url && result.title) {
            titleMap[result.url] = result.title;
          }
        });
      });
      
      // 총 이미지 개수 계산
      const totalImagesFound = finalSearches.reduce((total, search) => total + search.images.length, 0);
      
      // 최종 검색 결과를 저장 (AI 응답용 - linkMap, thumbnailMap 제외)
      const finalResult = { searchId, searches: finalSearches, imageMap, totalImagesFound };
      
      // tool_results 저장용으로 linkMap, thumbnailMap, titleMap 포함된 객체도 추가
      const finalResultWithMaps = {
        searchId,
        searches: finalSearches,
        imageMap,
        linkMap,
        thumbnailMap,
        titleMap,
        totalImagesFound
      };
      searchResults.push(finalResultWithMaps);
      
      // 배열에 결과 추가하고 UI를 위한 어노테이션도 전송
      searchResults.push(finalResult);
      
      // 전체 검색 완료 어노테이션 전송 (linkMap, thumbnailMap, titleMap 포함)
      if (dataStream?.write) {
        dataStream.write({
          type: 'data-web_search_complete',
          id: `ann-${searchId}-complete`,
          data: {
            searchId,
            searches: finalSearches,
            imageMap,
            linkMap,
            thumbnailMap,
            titleMap
          }
        });
      }
      
      // 결과 반환
      return finalResult;
    }
  });
  
  // 기능은 웹 검색 도구지만 저장된 결과 배열도 함께 반환
  return Object.assign(webSearchTool, { searchResults });
}

// jina.ai 링크 리더 도구 생성 함수
export function createJinaLinkReaderTool(dataStream?: any) {
  // Track attempts in closure and expose via returned object
  const linkAttempts: Array<{
    url: string;
    timestamp: string;
    status: 'in_progress' | 'success' | 'failed';
    title?: string;
    error?: string;
  }> = [];
  
  // Track raw content in closure
  const rawContent: {
    url: string;
    title: string;
    content: string;
    contentType: string;
    contentLength: number;
    timestamp: string;
  }[] = [];

  const linkReaderTool = tool({
    description: toolDefinitions.jina_link_reader.description,
    inputSchema: z.object({
      url: z.string().url().describe(toolDefinitions.jina_link_reader.inputSchema.url),
    }),
    execute: async ({ url }: { url: string }) => {
      try {
        if (!url) {
          throw new Error("URL parameter is required");
        }
        
        // URL 유효성 검사 & 변환
        const targetUrl = !url.startsWith('http') ? `https://${url}` : url;
        const jinaUrl = `https://r.jina.ai/${targetUrl}`;
        
        console.log(`[DEBUG-JINA] Fetching content from: ${jinaUrl}`);
        
        // Track link reading attempts if dataStream is available
        const attempt = {
          url: url,
          timestamp: new Date().toISOString(),
          status: 'in_progress' as const,
        };
        
          if (dataStream) {
            // Send link reader started signal
            dataStream.write({
              type: 'data-link_reader_started',
              id: `ann-link-start-${Date.now()}`,
              data: {
                url,
                started: true
              }
            });
            
            // Store the attempt
            linkAttempts.push(attempt);
            
            // Send attempt annotation
            dataStream.write({
              type: 'data-link_reader_attempt',
              id: `ann-link-attempt-${Date.now()}`,
              data: attempt
            });
          }
        
        // 내용 가져오기
        const response = await fetch(jinaUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; ChatflixBot/1.0)'
          }
        });
        
        if (!response.ok) {
          throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
        }
        
        // 응답 처리
        const contentType = response.headers.get('content-type') || '';
        const isHtml = contentType.includes('text/html');
        const isJson = contentType.includes('application/json');
        
        // 내용과 타이틀 추출
        const rawResponseContent = isJson 
          ? JSON.stringify(await response.json(), null, 2)
          : await response.text();
          
        let title = '';
        let content = rawResponseContent;
        
        if (isHtml) {
          // HTML에서 타이틀 추출
          const titleMatch = content.match(/<title[^>]*>([^<]+)<\/title>/i);
          title = titleMatch && titleMatch[1] ? titleMatch[1].trim() : '';
          
          // HTML에서 텍스트 추출
          content = content
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
            .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
            .replace(/<[^>]*>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        } else {
          // HTML 아닌 경우 기본 제목 설정
          title = targetUrl.split('/').pop() || targetUrl;
        }
          
        
        console.log(`[DEBUG-JINA] Successfully fetched content, length: ${content.length} characters`);
        // 디버깅을 위해 내용 일부 출력
        console.log(`[DEBUG-JINA] Content preview: ${content.substring(0, 300)}...`);
        
        const result = {
          content,
          url: targetUrl,
          title: title || getPageTitle(content) || targetUrl,
          contentType
        };
        
        // Handle success tracking if dataStream is available
          if (dataStream) {
            const lastIndex = linkAttempts.length - 1;
            const updatedAttempt = {
              url: url,
              title: result.title,
              status: 'success' as const,
              timestamp: new Date().toISOString()
            };
            
            // Update stored attempt
            Object.assign(linkAttempts[lastIndex], updatedAttempt);
            
            // Send update annotation
            dataStream.write({
              type: 'data-link_reader_attempt_update',
              id: `ann-link-success-${Date.now()}`,
              data: updatedAttempt
            });
            
            // Return complete content to the model (not just preview)
            const contentPreview = result.content && result.content.length > 0 
              ? `${result.content.substring(0, 150)}...` 
              : "(No text content available)";
            
            console.log(`[DEBUG-JINA] Returning content to AI, total length: ${result.content.length} characters`);
            
            // Store raw content for tool results collection
            const rawContentData = {
              url: url,
              title: result.title,
              content: result.content,
              contentType: result.contentType,
              contentLength: result.content ? result.content.length : 0,
              timestamp: new Date().toISOString()
            };
            rawContent.push(rawContentData);
            
            // Send raw content to client via annotation for user display
            dataStream.write({
              type: 'data-link_reader_complete',
              id: `ann-link-complete-${Date.now()}`,
              data: rawContentData
            });
            
            return {
              success: true,
              url: url,
              title: result.title,
              contentType: result.contentType,
              contentLength: result.content ? result.content.length : 0,
              contentPreview,
              content: result.content, // Add full content to be accessible to the AI
              message: `Successfully read content from ${url} (${result.content ? result.content.length : 0} characters)`
            };
          }
        
        return result;
      } catch (error) {
        console.error('[DEBUG-JINA] Error fetching URL:', error);
        
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        
        // Handle error tracking if dataStream is available
          if (dataStream) {
            const lastIndex = linkAttempts.length - 1;
            
            const updatedAttempt = {
              url: url,
              error: errorMessage,
              status: 'failed' as const,
              timestamp: new Date().toISOString()
            };
            
            // Update stored attempt
            Object.assign(linkAttempts[lastIndex], updatedAttempt);
            
            // Send error update annotation
            dataStream.write({
              type: 'data-link_reader_attempt_update',
              id: `ann-link-error-${Date.now()}`,
              data: updatedAttempt
            });
            
            // Return simplified error result to model
          return {
              success: false,
              url: url,
              error: errorMessage,
              message: `Failed to read content from ${url}: ${errorMessage}`
            };
          }
        
        return {
          error: errorMessage,
          url
        };
      }
    }
  });

  return Object.assign(linkReaderTool, { linkAttempts, rawContent });
}

// 토큰 없이 이미지 생성 도구 생성 함수. (예전 버전) 
// export function createImageGeneratorTool(dataStream?: any) {
//   // 생성된 이미지 추적
//   const generatedImages: Array<{
//     imageUrl: string;
//     prompt: string;
//     model: string;
//     timestamp: string;
//     seed: number; // seed 포함
//   }> = [];

//   const imageGeneratorTool = tool({
//     description: toolDefinitions.imageGenerator.description,
//     parameters: z.object({
//       prompts: z.union([
//         z.string(),
//         z.array(z.string())
//       ]).describe(toolDefinitions.imageGenerator.parameters.prompts),
//       model: z.enum(['flux', 'turbo'])
//         .describe(toolDefinitions.imageGenerator.parameters.model)
//         .default('flux'),
//       width: z.number().describe(toolDefinitions.imageGenerator.parameters.width).default(1024),
//       height: z.number().describe(toolDefinitions.imageGenerator.parameters.height).default(1024),
//       seed: z.number().optional().describe(toolDefinitions.imageGenerator.parameters.seed), // .optional() 다시 추가
//     }),
//     execute: async ({ prompts, model, width, height, seed }: { // seed 타입에 ? 다시 추가
//       prompts: string | string[];
//       model: 'flux' | 'turbo';
//       width: number;
//       height: number;
//       seed?: number; // seed는 이제 optional
//     }) => {
//       // seed가 제공되지 않으면 랜덤 값을 생성 (새 이미지 생성 시), 제공되면 그 값을 사용 (이미지 편집 시)
//       const currentSeed = seed === undefined ? Math.floor(Math.random() * Number.MAX_SAFE_INTEGER) : seed;

//       try {
//         console.log('[DEBUG-IMAGE] Generating image(s) with parameters:', { prompts, model, width, height, seed: currentSeed });

//         // 문자열 하나만 받은 경우 배열로 변환
//         const promptsArray = Array.isArray(prompts) ? prompts : [prompts];

//         // 각 프롬프트에 대해 이미지 URL 생성
//         const results = promptsArray.map(prompt => {
//           // URL 인코딩된 프롬프트 준비
//           const encodedPrompt = encodeURIComponent(prompt);

//           // 기본 URL 구성 - 개선된 파라미터 추가 (nologo=true, safe=false, enhance=true)
//           let imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&nologo=true&safe=false&enhance=true`;

//           // 모델 추가
//           imageUrl += `&model=${model}`;

//           // seed 값을 항상 URL에 추가
//           imageUrl += `&seed=${currentSeed}`;

//           // 생성된 이미지 추적
//           const timestamp = new Date().toISOString();
//           const imageData = {
//             imageUrl,
//             prompt,
//             model,
//             timestamp,
//             seed: currentSeed // 생성/사용된 seed 값 저장
//           };

//           generatedImages.push(imageData);

//           // 클라이언트에 이미지 생성 알림 전송
//           if (dataStream) {
//             dataStream.writeMessageAnnotation({
//               type: 'generated_image',
//               data: imageData
//             });
//           }

//           return {
//             url: imageUrl,
//             description: prompt,
//             parameters: { prompt, model, width, height, seed: currentSeed, enhance: true, safe: false } // 반환값에 seed 포함
//           };
//         });

//         // 결과가 하나만 있으면 객체로, 여러 개면 배열로 반환
//         return results.length === 1 && !Array.isArray(prompts)
//           ? results[0]
//           : { images: results };
//       } catch (error) {
//         console.error('[DEBUG-IMAGE] Error generating image:', error);
//         return {
//           error: error instanceof Error ? error.message : 'Unknown error generating image',
//           parameters: { prompts, model, width, height, seed: currentSeed } // 오류 발생 시에도 사용된 seed 값 포함
//         };
//       }
//     }
//   });

//   // 이미지 생성기 도구와 생성된 이미지 리스트를 함께 반환
//   return Object.assign(imageGeneratorTool, { generatedImages });
// }

// 이미지 생성 도구 생성 함수
export function createImageGeneratorTool(dataStream?: any) {
  // 생성된 이미지 추적
  const generatedImages: Array<{
    imageUrl: string;
    prompt: string;
    model: string;
    timestamp: string;
    seed: number; // seed 포함
    hasToken: boolean; // 토큰 사용 여부 기록
    authMethod: string; // 인증 방식 명시
    secure: boolean; // 토큰이 URL에 노출되지 않음을 표시
  }> = [];

  const imageGeneratorInputSchema = z.object({
    prompts: z.union([
      z.string(),
      z.array(z.string())
    ]).describe(toolDefinitions.imageGenerator.inputSchema.prompts),
    model: z.enum(['flux', 'turbo'])
      .describe(toolDefinitions.imageGenerator.inputSchema.model),
    width: z.number().describe(toolDefinitions.imageGenerator.inputSchema.width),
    height: z.number().describe(toolDefinitions.imageGenerator.inputSchema.height),
    seed: z.number().optional().describe(toolDefinitions.imageGenerator.inputSchema.seed),
  });

  type ImageGeneratorInput = z.infer<typeof imageGeneratorInputSchema>;

  const imageGeneratorTool = tool<ImageGeneratorInput, unknown>({
    description: toolDefinitions.imageGenerator.description,
    inputSchema: imageGeneratorInputSchema,
    execute: async ({ prompts, model, width, height, seed }: ImageGeneratorInput) => {
      // seed가 제공되지 않으면 랜덤 값을 생성 (새 이미지 생성 시), 제공되면 그 값을 사용 (이미지 편집 시)
      const currentSeed = seed === undefined ? Math.floor(Math.random() * Number.MAX_SAFE_INTEGER) : seed;

      // 이미지 생성 시작 신호 전송
      if (dataStream) {
        dataStream.write({
          type: 'data-image_generation_started',
          id: `ann-image-start-${Date.now()}`,
          data: {
            prompts: Array.isArray(prompts) ? prompts : [prompts],
            model,
            width,
            height,
            seed: currentSeed,
            started: true
          }
        });
      }

      try {
        // Pollinations.AI API 토큰 확인 (서버 사이드에서만 사용)
        const apiToken = process.env.POLLINATIONAI_API_KEY;
        
        console.log('[DEBUG-IMAGE] Generating image(s) with parameters:', { prompts, model, width, height, seed: currentSeed });
        
        if (apiToken) {
          console.log('[DEBUG-IMAGE] API token available for server-side operations');
        } else {
          console.log('[DEBUG-IMAGE] Using referrer-based authentication (recommended for frontend apps)');
        }

        // 문자열 하나만 받은 경우 배열로 변환
        const promptsArray = Array.isArray(prompts) ? prompts : [prompts];

        // 각 프롬프트에 대해 이미지 URL 생성
        const results = promptsArray.map(prompt => {
          // URL 인코딩된 프롬프트 준비
          const encodedPrompt = encodeURIComponent(prompt);

          // 기본 URL 구성 - 개선된 파라미터 추가 (nologo=true, safe=false, enhance=true)
          let imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&nologo=true&safe=false&enhance=true`;

          // 모델 추가
          imageUrl += `&model=${model}`;

          // seed 값을 항상 URL에 추가
          imageUrl += `&seed=${currentSeed}`;
          
          // 보안을 위해 토큰을 URL에 포함하지 않음
          // 대신 referrer 기반 인증 사용 (프론트엔드 앱에 권장되는 방식)
          imageUrl += `&referrer=Chatflix`;

          // 생성된 이미지 추적 (토큰은 서버에서만 사용, URL에는 포함하지 않음)
          const timestamp = new Date().toISOString();
          const imageData = {
            imageUrl,
            prompt,
            model,
            timestamp,
            seed: currentSeed, // 생성/사용된 seed 값 저장
            hasToken: !!apiToken, // 서버에 토큰이 있는지만 기록
            authMethod: 'referrer', // 인증 방식 명시
            secure: true // 토큰이 URL에 노출되지 않음을 표시
          };

          generatedImages.push(imageData);

          // 클라이언트에 이미지 생성 알림 전송 (토큰 없는 안전한 URL)
          if (dataStream) {
            dataStream.write({
              type: 'data-generated_image',
              id: `ann-image-${Date.now()}-${currentSeed}`,
              data: imageData
            });
          }

          return {
            url: imageUrl,
            description: prompt,
            inputSchema: { 
              prompt, 
              model, 
              width, 
              height, 
              seed: currentSeed, 
              enhance: true, 
              safe: false,
              authMethod: 'referrer', // 인증 방식
              secure: true // 토큰이 URL에 노출되지 않음을 표시
            }
          };
        });

        // 결과가 하나만 있으면 객체로, 여러 개면 배열로 반환
        return results.length === 1 && !Array.isArray(prompts)
          ? results[0]
          : { images: results };
      } catch (error) {
        console.error('[DEBUG-IMAGE] Error generating image:', error);
        return {
          error: error instanceof Error ? error.message : 'Unknown error generating image',
          parameters: { prompts, model, width, height, seed: currentSeed } // 오류 발생 시에도 사용된 seed 값 포함
        };
      }
    }
  });

  // 이미지 생성기 도구와 생성된 이미지 리스트를 함께 반환
  return Object.assign(imageGeneratorTool, { generatedImages });
}

// 계산기 도구 생성 함수
export function createCalculatorTool(dataStream: any) {
  // 계산 단계 추적용 초기화
  let stepCounter = 0;
  const calculationSteps: Array<{step: number; expression: string; result: any; timestamp: string;}> = [];
  
  const calculatorTool = tool({
    description: toolDefinitions.calculator.description,
    inputSchema: z.object({ expression: z.string().describe(toolDefinitions.calculator.inputSchema.expression) }),
    execute: async ({ expression }) => {
      // 계산 시작 신호 전송
      dataStream.write({
        type: 'data-math_calculation_started',
        id: `ann-math-start-${Date.now()}`,
        data: {
          expression,
          started: true
        }
      });
      
      stepCounter++;
      const result = mathjs.evaluate(expression);
      calculationSteps.push({
        step: stepCounter,
        expression,
        result,
        timestamp: new Date().toISOString()
      });
      
       // UI에 실시간 계산 단계 표시
       dataStream.write({
         type: 'data-math_calculation',
         id: `ann-math-${Date.now()}-${stepCounter}`,
         data: {
           step: stepCounter,
           expression,
           result: result.toString(),
           calculationSteps
         }
       });
      
      return result;
    },
  });

  // 계산기 도구와 저장된 계산 단계를 함께 반환
  return Object.assign(calculatorTool, { calculationSteps });
}


export function createYouTubeSearchTool(dataStream: any) {
  // 검색 결과를 저장할 배열
  const searchResults: any[] = [];
  
  // VideoResult 타입 정의
  interface VideoResult {
    videoId: string;
    url: string;
    title?: string;
    description?: string;
    channelName?: string;
    publishDate?: string;
    viewCount?: number;
    duration?: string;
    thumbnailUrl?: string;
    debug_info?: {
      timestamp: string;
      message: string;
      [key: string]: any;
    };
  }
  
  const youtubeSearchTool = tool({
    description: toolDefinitions.youtubeSearch.description,
    inputSchema: z.object({
      query: z.string().describe(toolDefinitions.youtubeSearch.inputSchema.query),
    }),
    execute: async ({ query }: { query: string }) => {
      // YouTube 검색 시작 신호 전송
      dataStream.write({
        type: 'data-youtube_search_started',
        id: `ann-youtube-start-${Date.now()}`,
        data: {
          query,
          started: true
        }
      });
      
      try {
        const searchApiKey = process.env.SEARCH_API_KEY;
        if (!searchApiKey) {
          throw new Error('SEARCH_API_KEY is not defined in environment variables');
        }
        
        console.log('[YouTube Search] Searching for videos on:', query);
        
        // Step 1: Search YouTube videos
        const searchUrl = 'https://www.searchapi.io/api/v1/search';
        const searchParams = new URLSearchParams({
          engine: 'youtube',
          q: query,
          api_key: searchApiKey,
        });
        
        const searchResponse = await fetch(`${searchUrl}?${searchParams}`);
        if (!searchResponse.ok) {
          throw new Error(`SearchAPI YouTube search failed: ${searchResponse.status} ${searchResponse.statusText}`);
        }
        
        const searchData = await searchResponse.json();
        console.log(`[YOUTUBE_DEBUG] Found ${searchData.videos?.length || 0} videos from SearchAPI`);
        
        // Process results
        const processedResults = await Promise.all(
          (searchData.videos || []).slice(0, 10).map(async (video: any): Promise<VideoResult | null> => {
            if (!video.id) {
              console.log(`[YOUTUBE_DEBUG] Missing video ID in search result`);
              return null;
            }
            
            // Base result with data from search
            const baseResult: VideoResult = {
              videoId: video.id,
              url: video.link || `https://www.youtube.com/watch?v=${video.id}`,
              title: video.title,
              description: video.description,
              duration: video.length,
              thumbnailUrl: video.thumbnail?.rich || video.thumbnail?.static,
              viewCount: video.extracted_views,
              channelName: video.channel?.title,
              publishDate: video.published_time,
            };
            
            try {
              // Get more detailed info using YouTube Video API
              const videoUrl = 'https://www.searchapi.io/api/v1/search';
              const videoParams = new URLSearchParams({
                engine: 'youtube_video',
                video_id: video.id,
                api_key: searchApiKey,
              });
              
              const videoResponse = await fetch(`${videoUrl}?${videoParams}`);
              if (!videoResponse.ok) {
                console.warn(`[YOUTUBE_DEBUG] Couldn't get detailed info for video ${video.id}: ${videoResponse.status}`);
                return baseResult;
              }
              
              const videoData = await videoResponse.json();
              
              // Enhance with video details
              if (videoData.video) {
                return {
                  ...baseResult,
                  title: videoData.video.title || baseResult.title,
                  description: videoData.video.description || baseResult.description,
                  viewCount: videoData.video.views || baseResult.viewCount,
                  channelName: videoData.video.author || baseResult.channelName,
                  publishDate: videoData.video.published_time || baseResult.publishDate,
                };
              }
              
              return baseResult;
            } catch (error) {
              console.error(`[YOUTUBE_DEBUG] Error fetching details for video ${video.id}:`, error);
              return baseResult;
            }
          }),
        );
        
        // Filter out null results
        const validResults = processedResults.filter(
          (result): result is VideoResult => result !== null,
        );
        
        console.log(`[YOUTUBE_DEBUG] Final result count after filtering: ${validResults.length}`);
        
        // 각 결과의 간단한 요약 출력
        validResults.forEach((result, index) => {
          // Remove thumbnailUrl from debug output
          const { thumbnailUrl, ...resultWithoutThumbnail } = result;
          console.log(`[YOUTUBE_DEBUG] Result #${index + 1}:`, resultWithoutThumbnail);
        });

        // Track this search in our array
        const searchResult = {
          query,
          timestamp: new Date().toISOString(),
          results: validResults
        };
        
        searchResults.push(searchResult);
        
        // YouTube 검색 완료 어노테이션 전송
        if (dataStream?.write) {
          dataStream.write({
            type: 'data-youtube_search_complete',
            id: `ann-youtube-complete-${Date.now()}`,
            data: searchResult
          });
        }
        
        return {
          results: validResults,
        };
      } catch (error) {
        console.error('YouTube search error:', error);
        
        // YouTube 검색 에러 어노테이션 전송
        if (dataStream?.write) {
          dataStream.write({
            type: 'data-youtube_search_error',
            id: `ann-youtube-error-${Date.now()}`,
            data: {
              query,
              timestamp: new Date().toISOString(),
              error: error instanceof Error ? error.message : 'Unknown error'
            }
          });
        }
        
        return {
          error: error instanceof Error ? error.message : 'Unknown error',
          results: []
        };
      }
    },
  });
  
  // YouTube 검색 도구와 저장된 결과 배열을 함께 반환
  return Object.assign(youtubeSearchTool, { searchResults });
}

// YouTube Link Analyzer tool creation function
export function createYouTubeLinkAnalyzerTool(dataStream: any) {
  // Store analysis results
  const analysisResults: any[] = [];
  
  // Define helper function to extract video ID from URL
  const extractVideoId = (url: string): string | null => {
    const regExp = /^.*(youtu.be\/|v\/|e\/|u\/\w+\/|embed\/|v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };
  
  const youtubeAnalyzerTool = tool({
    description: toolDefinitions.youtubeAnalyzer.description,
    inputSchema: z.object({
      urls: z.array(z.string().url()).describe(toolDefinitions.youtubeAnalyzer.inputSchema.urls),
      lang: z.string().optional().describe('Optional preferred language code for transcript. If not specified or not available, the first available language will be used.')
    }),
    execute: async ({
      urls,
      lang,
    }: {
      urls: string[];
      lang?: string;
    }) => {
      // YouTube 분석 시작 신호 전송
      dataStream.write({
        type: 'data-youtube_analysis_started',
        id: `ann-youtube-analysis-start-${Date.now()}`,
        data: {
          urls,
          lang,
          started: true
        }
      });
      
      try {
        const searchApiKey = process.env.SEARCH_API_KEY;
        if (!searchApiKey) {
          throw new Error('SEARCH_API_KEY is not defined in environment variables');
        }
        
        console.log('[YouTube Link Analyzer] Processing URLs:', urls);
        
        // Process each URL in parallel
        const analysisPromises = urls.map(async (url) => {
          // Extract video ID from URL
          const videoId = extractVideoId(url);
          if (!videoId) {
            return {
              url,
              error: 'Invalid YouTube URL. Could not extract video ID.',
              timestamp: new Date().toISOString()
            };
          }
          
          try {
            // Step 1: Get video details from YouTube Video API
            const videoUrl = 'https://www.searchapi.io/api/v1/search';
            const videoParams = new URLSearchParams({
              engine: 'youtube_video',
              video_id: videoId,
              api_key: searchApiKey,
            });
            
            const videoResponse = await fetch(`${videoUrl}?${videoParams}`);
            if (!videoResponse.ok) {
              throw new Error(`SearchAPI YouTube video API failed: ${videoResponse.status} ${videoResponse.statusText}`);
            }
            
            const videoData = await videoResponse.json();
            console.log(`[YOUTUBE_ANALYZER] Retrieved details for video ${videoId}`);
            
            // Initialize the result object with video details
            const result: any = {
              url,
              videoId,
              timestamp: new Date().toISOString(),
              details: {
                title: videoData.video?.title,
                description: videoData.video?.description,
                author: videoData.video?.author,
                publishedTime: videoData.video?.published_time,
                views: videoData.video?.views,
                likes: videoData.video?.likes,
                category: videoData.video?.category,
                duration: videoData.video?.length_seconds,
              },
              channel: videoData.channel ? {
                name: videoData.channel.name,
                id: videoData.channel.id,
                subscribers: videoData.channel.subscribers,
                link: videoData.channel.link,
              } : undefined,
            };
            
            // Step 2: Always fetch transcript using available languages
            try {
              // Check available languages from video data
              const availableLanguages = videoData.available_transcripts_languages || [];
              
              // Determine which language to use
              let transcriptLang = lang; // Use requested language if provided
              
              // If no language provided or the requested language is not available
              if (!transcriptLang || !availableLanguages.some((l: any) => l.lang === transcriptLang)) {
                // Try to find English first if it's available
                const englishOption = availableLanguages.find((l: any) => 
                  l.lang === 'en' || l.lang === 'en-US' || l.lang === 'en-GB'
                );
                
                // If English is available, use it; otherwise use the first available language
                transcriptLang = englishOption ? englishOption.lang : (availableLanguages[0]?.lang || 'en');
              }
              
              // Log the language selection
              console.log(`[YOUTUBE_ANALYZER] Using language '${transcriptLang}' for transcript of video ${videoId}`);
              
              // Fetch transcript with selected language
              const transcriptUrl = 'https://www.searchapi.io/api/v1/search';
              const transcriptParams = new URLSearchParams({
                engine: 'youtube_transcripts',
                video_id: videoId,
                api_key: searchApiKey,
                lang: transcriptLang || 'en' // Ensure lang is never undefined
              });
              
              const transcriptResponse = await fetch(`${transcriptUrl}?${transcriptParams}`);
              if (!transcriptResponse.ok) {
                throw new Error(`SearchAPI YouTube transcripts API failed: ${transcriptResponse.status} ${transcriptResponse.statusText}`);
              }
              
              const transcriptData = await transcriptResponse.json();
              
              // Handle language availability
              if (transcriptData.error && transcriptData.available_languages) {
                result.transcriptError = transcriptData.error;
                result.availableLanguages = transcriptData.available_languages;
                
                // If we have available languages but initial attempt failed, try with the first available language
                if (transcriptData.available_languages.length > 0) {
                  const firstAvailableLanguage = transcriptData.available_languages[0].lang;
                  
                  console.log(`[YOUTUBE_ANALYZER] Retrying with first available language: ${firstAvailableLanguage}`);
                  
                  // Retry with the first available language
                  const retryParams = new URLSearchParams({
                    engine: 'youtube_transcripts',
                    video_id: videoId,
                    api_key: searchApiKey,
                    lang: firstAvailableLanguage
                  });
                  
                  const retryResponse = await fetch(`${transcriptUrl}?${retryParams}`);
                  if (retryResponse.ok) {
                    const retryData = await retryResponse.json();
                    if (retryData.transcripts && retryData.transcripts.length > 0) {
                      // Format and add the transcript from retry
                      const formattedTranscript = formatTranscript(retryData.transcripts);
                      result.transcript = {
                        language: firstAvailableLanguage,
                        segments: formattedTranscript,
                        fullText: formattedTranscript.map((segment: any) => segment.text).join(' '),
                      };
                    }
                  }
                }
              }
              // Add transcript if available from first attempt
              else if (transcriptData.transcripts && transcriptData.transcripts.length > 0) {
                const formattedTranscript = formatTranscript(transcriptData.transcripts);
                result.transcript = {
                  language: transcriptLang,
                  segments: formattedTranscript,
                  fullText: formattedTranscript.map((segment: any) => segment.text).join(' '),
                };
              } else {
                result.transcriptError = "No transcript segments found in the response";
              }
            } catch (transcriptError) {
              console.error(`[YOUTUBE_ANALYZER] Error fetching transcript for ${videoId}:`, transcriptError);
              result.transcriptError = transcriptError instanceof Error ? transcriptError.message : 'Unknown error';
            }
            
            return result;
          } catch (videoError) {
            console.error(`[YOUTUBE_ANALYZER] Error processing video ${videoId}:`, videoError);
            return {
              url,
              videoId,
              timestamp: new Date().toISOString(),
              error: videoError instanceof Error ? videoError.message : 'Unknown error'
            };
          }
        });
        
        // Wait for all analysis to complete
        const results = await Promise.all(analysisPromises);
        
        // Add to our tracking array
        analysisResults.push(...results);
        
        // YouTube 링크 분석 완료 어노테이션 전송
        if (dataStream?.write) {
          dataStream.write({
            type: 'data-youtube_analysis_complete',
            id: `ann-yt-analysis-complete-${Date.now()}`,
            data: {
              timestamp: new Date().toISOString(),
              results
            }
          });
        }
        
        return {
          results
        };
      } catch (error) {
        console.error('[YouTube Link Analyzer] Error:', error);
        
        // YouTube 링크 분석 에러 어노테이션 전송
        if (dataStream?.write) {
          dataStream.write({
            type: 'data-youtube_analysis_error',
            id: `ann-yt-analysis-error-${Date.now()}`,
            data: {
              timestamp: new Date().toISOString(),
              error: error instanceof Error ? error.message : 'Unknown error',
              urls
            }
          });
        }
        
        return {
          error: error instanceof Error ? error.message : 'Unknown error',
          results: []
        };
      }
    },
  });
  
  // Helper function to format transcript segments
  function formatTranscript(transcripts: any[]) {
    return transcripts.map((segment: any) => {
      // Convert seconds to timestamp (MM:SS format)
      const minutes = Math.floor(segment.start / 60);
      const seconds = Math.floor(segment.start % 60);
      const timestamp = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      
      return {
        timestamp,
        start: segment.start,
        duration: segment.duration,
        text: segment.text,
      };
    });
  }
  
  // Return the tool along with the analysis results array
  return Object.assign(youtubeAnalyzerTool, { analysisResults });
}

// Google Search 도구 생성 함수
export function createGoogleSearchTool(dataStream: any, forcedEngine?: string) {
  // 검색 결과를 저장할 배열
  const searchResults: Array<{
    searchId: string;
    searches: Array<{
      query: string;
      topic: 'google' | 'google_images' | 'google_videos';
      engine: 'google' | 'google_images' | 'google_videos';
      results: any[];
      images: any[];
      videos?: any[];
    }>;
    imageMap: Record<string, string>;
  }> = [];
  
  const googleSearchInputSchema = z.object({
    // Accept string or array; coerce to array for consistency with Web Search
    queries: z
      .union([
        z.array(z.string()),
        z.string()
      ])
      .transform((v) => (Array.isArray(v) ? v : [v]))
      .describe(toolDefinitions.googleSearch.inputSchema.queries),
    // Accept string or array; coerce to array
    engines: z
      .union([
        z.array(z.enum(['google', 'google_images', 'google_videos'])),
        z.enum(['google', 'google_images', 'google_videos'])
      ])
      .optional()
      .transform((v) => (v === undefined ? ['google'] : Array.isArray(v) ? v : [v]))
      .describe(toolDefinitions.googleSearch.inputSchema.engines),
    // Accept number or array of numbers; coerce to array
    maxResults: z
      .union([
        z.array(z.number()),
        z.number()
      ])
      .optional()
      .transform((v) => (v === undefined ? undefined : Array.isArray(v) ? v : [v]))
      .describe(toolDefinitions.googleSearch.inputSchema.maxResults),
    // Accept string or array; coerce to array
    locations: z
      .union([
        z.array(z.string()),
        z.string()
      ])
      .optional()
      .transform((v) => (v === undefined ? undefined : Array.isArray(v) ? v : [v]))
      .describe(toolDefinitions.googleSearch.inputSchema.locations),
    // Accept string or array; coerce to array
    gls: z
      .union([
        z.array(z.string()),
        z.string()
      ])
      .optional()
      .transform((v) => (v === undefined ? undefined : Array.isArray(v) ? v : [v]))
      .describe(toolDefinitions.googleSearch.inputSchema.gls),
  });

  type GoogleSearchInput = {
    queries: string[];
    engines?: ('google' | 'google_images' | 'google_videos')[];
    maxResults?: number[];
    locations?: string[];
    gls?: string[];
  };
  type GoogleSearchOutput = {
    searchId: string;
    searches: Array<{
      query: string;
      topic: 'google' | 'google_images' | 'google_videos';
      engine: 'google' | 'google_images' | 'google_videos';
      results: any[];
      images: any[];
      videos?: any[];
    }>;
    imageMap: Record<string, string>;
    totalImagesFound: number;
    totalVideosFound: number;
    // linkMap: Record<string, string>;
    // thumbnailMap: Record<string, string>;
  };

  const googleSearchTool = tool<GoogleSearchInput, GoogleSearchOutput>({
    description: toolDefinitions.googleSearch.description,
    inputSchema: googleSearchInputSchema as unknown as z.ZodType<GoogleSearchInput>,
    execute: async (input: GoogleSearchInput) => {
      const { queries, engines, maxResults, locations, gls } = input;
      
      // 강제로 지정된 엔진이 있으면 해당 엔진만 사용
      const finalEngines = forcedEngine ? 
        Array(queries.length).fill(forcedEngine as 'google' | 'google_images') : 
        engines;
      
      const apiKey = process.env.SEARCH_API_KEY;
      if (!apiKey) {
        throw new Error('SEARCH_API_KEY is not defined in environment variables');
      }
      
      // Generate a unique search ID for this search attempt
      const searchId = `google_search_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      // Debug logging for Google search
      console.log('=== Google Search (SearchAPI) Debug Info ===');
      console.log('Search ID:', searchId);
      console.log('Search queries:', queries);
      console.log('Search parameters:', {
        engines: engines || ['google'],
        locations: locations || ['none'],
        gls: gls || ['us']
      });
      
      try {
        // Execute searches in parallel (like Web Search)
        const searchPromises = queries.map(async (query, index) => {
          const currentEngine = (finalEngines && finalEngines[index]) || finalEngines?.[0] || 'google';
          const currentMaxResults = (maxResults && maxResults[index]) || maxResults?.[0];
          const currentLocation = (locations && locations[index]) || locations?.[0];
          const currentGl = (gls && gls[index]) || gls?.[0] || 'us';
          
          try {
            // Google 검색 시작 신호 전송
            if (dataStream?.write) {
              dataStream.write({
                type: 'data-google_search_started',
                id: `ann-google-start-${searchId}-${index}`,
                data: {
                  searchId,
                  query,
                  index,
                  total: queries.length,
                  started: true
                }
              });
            }

            // SearchAPI Google Search 요청
            const searchUrl = 'https://www.searchapi.io/api/v1/search';
            const searchParams = new URLSearchParams({
              engine: currentEngine,
              q: query,
              api_key: apiKey,
              safe: 'off' // Safe search off as requested
            });

            // Optional parameters
            if (currentLocation) {
              searchParams.append('location', currentLocation);
            }
            if (currentGl) {
              searchParams.append('gl', currentGl);
            }

            console.log(`[GOOGLE_SEARCH] Making request to: ${searchUrl}?${searchParams.toString()}`);
            
            const response = await fetch(`${searchUrl}?${searchParams}`);
            if (!response.ok) {
              throw new Error(`SearchAPI Google search failed: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log(`[GOOGLE_SEARCH] Received response with ${data.organic_results?.length || 0} organic results and ${data.images?.length || 0} images`);
            
            // Process results based on engine type
            let rawResults: any[] = [];
            let rawImages: any[] = [];
            let rawVideos: any[] = [];
            
            if (currentEngine === 'google_images') {
              // For Google Images, send all images to client but limit LLM context to 20
              const allImages = data.images || [];
              const maxImagesForLLM = 20;
              const limitedImagesForLLM = allImages.slice(0, maxImagesForLLM);
              
              console.log(`[GOOGLE_IMAGES] Total images: ${allImages.length}, sending all to client, limiting LLM context to ${limitedImagesForLLM.length} images`);
              
              // For Google Images, process ALL images for client display
              rawImages = allImages.map((image: any, imageIndex: number) => ({
                url: image.original?.link || image.original,
                description: image.title || image.source?.name || '',
                width: image.original?.width,
                height: image.original?.height,
                thumbnail: image.thumbnail,
                source: image.source?.name,
                sourceLink: image.source?.link,
                position: image.position
              }));
              
              // For LLM context, create "results" from LIMITED image metadata (20 max)
              rawResults = limitedImagesForLLM.map((image: any, resultIndex: number) => {
                const linkId = `google_img_link_${searchId}_${index}_${resultIndex}`;
                return {
                  url: image.source?.link || image.original?.link || image.original,
                  title: image.title || image.source?.name || '',
                  content: `Image from ${image.source?.name || 'Unknown source'}`,
                  publishedDate: null,
                  author: image.source?.name,
                  score: image.position,
                  summary: image.title || '',
                  linkId: linkId,
                  thumbnail: image.thumbnail,
                  isImageResult: true
                };
              });
            } else if (currentEngine === 'google_videos') {
              // For Google Videos, send all videos to client but limit LLM context to 20
              const allVideos = data.videos || [];
              const maxVideosForLLM = 20;
              const limitedVideosForLLM = allVideos.slice(0, maxVideosForLLM);
              
              console.log(`[GOOGLE_VIDEOS] Total videos: ${allVideos.length}, sending all to client, limiting LLM context to ${limitedVideosForLLM.length} videos`);
              
              // For Google Videos, process ALL videos for client display
              rawVideos = allVideos.map((video: any, videoIndex: number) => ({
                url: video.link,
                title: video.title || '',
                description: video.snippet || '',
                thumbnail: video.thumbnail,
                source: video.source,
                channel: video.channel,
                length: video.length,
                date: video.date,
                position: video.position
              }));
              
              // For LLM context, create "results" from LIMITED video metadata (20 max)
              rawResults = limitedVideosForLLM.map((video: any, resultIndex: number) => {
                const linkId = `google_video_link_${searchId}_${index}_${resultIndex}`;
                return {
                  url: video.link,
                  title: video.title || '',
                  content: video.snippet || '',
                  publishedDate: video.date,
                  author: video.channel,
                  score: video.position,
                  summary: video.snippet,
                  linkId: linkId,
                  thumbnail: video.thumbnail,
                  isVideoResult: true,
                  length: video.length,
                  source: video.source
                };
              });

              // For Google Videos, don't collect images
              rawImages = [];
            } else {
              // For regular Google search, process organic results with optional limit
              const defaultMaxResults = 10;
              const maxResults = currentMaxResults || defaultMaxResults;
              const limitedOrganicResults = (data.organic_results || []).slice(0, maxResults);
              
              console.log(`[GOOGLE_SEARCH] Limiting organic results from ${data.organic_results?.length || 0} to ${limitedOrganicResults.length} results (max: ${maxResults})`);
              
              rawResults = limitedOrganicResults.map((result: any, resultIndex: number) => {
                const linkId = `google_link_${searchId}_${index}_${resultIndex}`;
                return {
                  url: result.link,
                  title: result.title || '',
                  content: result.snippet || '',
                  publishedDate: result.date,
                  author: result.source,
                  score: result.rank,
                  summary: result.snippet,
                  linkId: linkId,
                  thumbnail: result.thumbnail || null
                };
              });

              // For regular Google search, don't collect images - only use image search tool for images
              rawImages = [];
            }

            const deduplicatedResults = deduplicateResults(rawResults);
            const deduplicatedImages = rawImages.length > 0 ? deduplicateResults(rawImages) : [];
            
            // Generate unique IDs for images and create mapping
            const imagesWithIds = deduplicatedImages.map((image: any, imageIndex: number) => {
              const imageId = `google_img_${searchId}_${index}_${imageIndex}`;
              return {
                ...image,
                id: imageId
              };
            });
            
            // 개별 쿼리 완료 어노테이션 (UI 업데이트용)
            if (dataStream?.write) {
              dataStream.write({
                type: 'data-google_search_query_complete',
                id: `ann-google-query-${searchId}-${index}`,
                data: {
                  searchId,
                  query,
                  index,
                  total: queries.length,
                  status: 'completed',
                  resultsCount: deduplicatedResults.length,
                  imagesCount: imagesWithIds.length,
                  topic: currentEngine as 'google' | 'google_images' | 'google_videos',
                  engine: currentEngine,
                  results: deduplicatedResults,
                  images: imagesWithIds
                }
              });
            }
            
            return {
              query,
              topic: currentEngine as 'google' | 'google_images' | 'google_videos',
              engine: currentEngine,
              results: deduplicatedResults,
              images: imagesWithIds,
              videos: currentEngine === 'google_videos' ? rawVideos : []
            };
          } catch (error) {
            console.error(`Error searching with Google for query "${query}":`, error);
            
            // 에러 상태 어노테이션 전송
            if (dataStream?.write) {
              dataStream.write({
                type: 'data-google_search_error',
                id: `ann-google-error-${searchId}-${index}`,
                data: {
                  searchId,
                  query,
                  error: error instanceof Error ? error.message : 'Unknown error'
                }
              });
            }
            
            return {
              query,
              topic: currentEngine as 'google' | 'google_images' | 'google_videos',
              engine: currentEngine,
              results: [],
              images: [],
              videos: []
            };
          }
        });
        
        // Wait for all searches to complete
        const searchResultsData = await Promise.all(searchPromises);
        
        // Create unified image map, link map, thumbnail map, and title map
        const imageMap: { [key: string]: string } = {};
        const linkMap: { [key: string]: string } = {};
        const thumbnailMap: { [key: string]: string } = {};
        const titleMap: { [key: string]: string } = {};
        
        searchResultsData.forEach((search, index) => {
          // Process images
          search.images.forEach((image: any) => {
            if (image.id && image.url) {
              imageMap[image.id] = image.url;
            }
          });
          
          // Process links, thumbnails, and titles
          search.results.forEach((result: any) => {
            if (result.linkId && result.url) {
              linkMap[result.linkId] = result.url;
            }
            if (result.linkId && result.thumbnail) {
              thumbnailMap[result.linkId] = result.thumbnail;
            }
            if (result.url && result.title) {
              titleMap[result.url] = result.title;
            }
          });
        });

        // 총 이미지와 비디오 개수 계산
        const totalImagesFound = searchResultsData.reduce((total, search) => total + search.images.length, 0);
        const totalVideosFound = searchResultsData.reduce((total, search) => total + (search.videos?.length || 0), 0);
        
        // 최종 검색 결과를 저장 (AI 응답용 - linkMap, thumbnailMap 제외)
        const finalResult = { 
          searchId, 
          searches: searchResultsData,
          imageMap,
          totalImagesFound,
          totalVideosFound
        };
        
        // 배열에 결과 추가 (AI용)
        searchResults.push(finalResult);
        
        // tool_results 저장용으로 linkMap, thumbnailMap, titleMap 포함된 객체도 추가
        const finalResultWithMaps = {
          searchId,
          searches: searchResultsData,
          imageMap,
          linkMap,
          thumbnailMap,
          titleMap,
          totalImagesFound,
          totalVideosFound
        };
        searchResults.push(finalResultWithMaps);
        
        
        // 전체 검색 완료 어노테이션 전송 (웹 검색과 동일한 방식)
        if (dataStream?.write) {
          dataStream.write({
            type: 'data-google_search_complete',
            id: `ann-google-complete-${searchId}`,
            data: {
              searchId,
              searches: searchResultsData,
              imageMap,
              linkMap,
              thumbnailMap,
              titleMap
            }
          });
        }
        
        // 결과 반환
        return finalResult;
      } catch (error) {
        console.error(`Error in Google search execution:`, error);
        
        // 에러 상태 어노테이션 전송
        if (dataStream?.write) {
          dataStream.write({
            type: 'data-google_search_error',
            id: `ann-google-error-${searchId}`,
            data: {
              searchId,
              queries,
              error: error instanceof Error ? error.message : 'Unknown error'
            }
          });
        }
        
        // 에러 시에도 빈 결과를 searchResults 배열에 추가
        const emptyResult = {
          searchId,
          searches: queries.map((query, index) => {
            const currentEngine = (finalEngines && finalEngines[index]) || finalEngines?.[0] || 'google';
            return {
              query,
              topic: currentEngine as 'google' | 'google_images' | 'google_videos',
              engine: currentEngine,
              results: [],
              images: [],
              videos: []
            };
          }),
          imageMap: {},
          totalImagesFound: 0,
          totalVideosFound: 0
        };
        
        const emptyResultWithMaps = {
          ...emptyResult,
          linkMap: {},
          thumbnailMap: {},
          titleMap: {}
        };
        
        searchResults.push(emptyResult);
        searchResults.push(emptyResultWithMaps);
        
        // Return empty results (AI 응답용 - linkMap, thumbnailMap 제외)
        return emptyResult;
      }
    }
  });
  
  // 기능은 Google 검색 도구지만 저장된 결과 배열도 함께 반환
  return Object.assign(googleSearchTool, { searchResults });
}


// Gemini 이미지 생성/편집 도구 생성 함수
export function createGeminiImageTool(dataStream?: any, userId?: string, allMessages: any[] = []) {
  // 생성된 이미지 추적
  const generatedImages: Array<{
    imageUrl: string;
    prompt: string;
    timestamp: string;
    originalImageUrl?: string;
    isEdit?: boolean;
  }> = [];

  // 🔥 대화 히스토리에서 사용자 업로드 이미지만 수집 및 인덱스 생성
  const imageMap = new Map<string, string>();
  let uploadedImageIndex = 1;
  
  console.log('[DEBUG-GEMINI] All messages:', allMessages);
  for (const message of allMessages) {
    // 업로드된 이미지 (experimental_attachments)
    if (message.experimental_attachments && Array.isArray(message.experimental_attachments)) {
      for (const attachment of message.experimental_attachments) {
        if (attachment.contentType?.startsWith('image/') || attachment.fileType === 'image') {
          imageMap.set(`uploaded_image_${uploadedImageIndex}`, attachment.url);
          uploadedImageIndex++;
        }
      }
    }
    
    // 🔥 finalMessagesForExecution의 content 배열에서 이미지 파일 찾기
    if (message.content && Array.isArray(message.content)) {
      for (const contentItem of message.content) {
        if (contentItem.type === 'file' && contentItem.mediaType?.startsWith('image/')) {
          // data 필드에 URL이 있는 경우 (finalMessagesForExecution 형식)
          if (contentItem.data && typeof contentItem.data === 'string') {
            imageMap.set(`uploaded_image_${uploadedImageIndex}`, contentItem.data);
            uploadedImageIndex++;
          }
        }
      }
    }
  }
  
  console.log('[DEBUG-GEMINI] Image map created:', Array.from(imageMap.keys()));

  // Supabase 업로드 헬퍼
  async function uploadImageToSupabase(uint8Array: Uint8Array): Promise<string> {
    const { createClient } = await import('@/utils/supabase/server');
    const supabase = await createClient();
    
    const fileName = `gemini_${Date.now()}_${Math.random().toString(36).slice(2)}.png`;
    const { data, error } = await supabase.storage
      .from('gemini-images')
      .upload(fileName, uint8Array, { contentType: 'image/png' });
    
    if (error) {
      throw new Error(`Failed to upload image: ${error.message}`);
    }
    
    const { data: { publicUrl } } = supabase.storage
      .from('gemini-images')
      .getPublicUrl(fileName);
    
    return publicUrl;
  }

  const geminiImageInputSchema = z.object({
    prompt: z.string().describe('Text description for image generation or editing instructions'),
    editImageUrl: z.union([
      z.string(), 
      z.array(z.string()),
      z.null()
    ]).optional().describe('Image reference(s): For user-uploaded images use "uploaded_image_N" (e.g., uploaded_image_1). For previously generated Gemini images, use the full Supabase public URL from the previous response. Can be a single string or array of up to 3 images.'),
    aspectRatio: z.enum(['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9']).optional().describe('Image aspect ratio. AI should choose based on content type: 1:1 for social media/square, 16:9 for landscape/presentations, 9:16 for mobile/stories, 3:4 or 4:3 for portraits, 21:9 for cinematic. Default is 1:1.')
  });

  type GeminiImageInput = z.infer<typeof geminiImageInputSchema>;

  const geminiImageTool = tool<GeminiImageInput, unknown>({
    description: 'Generate and edit images using Google Gemini 2.5 Flash Image model with configurable aspect ratios. Can create new images from text prompts or edit existing images with natural language instructions. Supports various aspect ratios optimized for different use cases.',
    inputSchema: geminiImageInputSchema,
    execute: async ({ prompt, editImageUrl, aspectRatio }: GeminiImageInput) => {
      try {
        console.log('[DEBUG-GEMINI] Processing image request:', { prompt, editImageUrl });

        // 이미지 생성/편집 시작 신호 전송
        if (dataStream) {
          dataStream.write({
            type: 'data-gemini_image_started',
            id: `ann-gemini-start-${Date.now()}`,
            data: {
              prompt,
              editImageUrl,
              started: true
            }
          });
        }

        // 🔥 이미지 참조를 실제 URL로 변환 (단일 또는 배열)
        let actualEditImageUrls: string[] = [];
        
        if (editImageUrl) {
          const urlsToResolve = Array.isArray(editImageUrl) ? editImageUrl : [editImageUrl];
          
          for (const url of urlsToResolve) {
            if (url.startsWith('uploaded_image_')) {
              const resolvedUrl = imageMap.get(url);
              if (resolvedUrl) {
                actualEditImageUrls.push(resolvedUrl);
                console.log(`[DEBUG-GEMINI] Resolved ${url} to:`, resolvedUrl);
              } else {
                throw new Error(`Image reference "${url}" not found in conversation history`);
              }
            } else {
              actualEditImageUrls.push(url); // Direct URL (for generated images or external URLs)
            }
          }
        }

        // Initialize Google Generative AI client
        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-image' });

        let result;
        
        if (actualEditImageUrls.length > 0) {
          // 편집 모드: 기존 이미지 URL(들)에서 로드
          console.log('[DEBUG-GEMINI] Editing/composing with images:', actualEditImageUrls);
          
          // Convert images to base64 inlineData format for official API
          const imageParts = await Promise.all(
            actualEditImageUrls.map(async (imageUrl) => {
              const response = await fetch(imageUrl);
              if (!response.ok) {
                throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
              }
              
              const arrayBuffer = await response.arrayBuffer();
              const base64 = Buffer.from(arrayBuffer).toString('base64');
              
              let mimeType = 'image/jpeg';
              if (imageUrl.includes('.png')) mimeType = 'image/png';
              else if (imageUrl.includes('.webp')) mimeType = 'image/webp';
              
              return {
                inlineData: {
                  data: base64,
                  mimeType
                }
              };
            })
          );

          const contentParts = [{ text: prompt }, ...imageParts];

          const generationConfig: any = {};
          if (aspectRatio) {
            generationConfig.imageConfig = { aspectRatio };
          }

          result = await model.generateContent({
            contents: [{ role: 'user', parts: contentParts }],
            generationConfig
          });
        } else {
          // 생성 모드: 새 이미지 생성
          console.log('[DEBUG-GEMINI] Generating new image');
          
          const contentParts = [{ text: prompt }];

          const generationConfig: any = {};
          if (aspectRatio) {
            generationConfig.imageConfig = { aspectRatio };
          }

          result = await model.generateContent({
            contents: [{ role: 'user', parts: contentParts }],
            generationConfig
          });
        }

        console.log('[DEBUG-GEMINI] Result:', result);

        // Extract image data and text response from official API response
        let imageData: Uint8Array | null = null;
        let textResponse = '';

        if (result.response?.candidates?.[0]?.content?.parts) {
          for (const part of result.response.candidates[0].content.parts) {
            if (part.text) {
              textResponse = part.text;
            }
            if (part.inlineData) {
              imageData = Buffer.from(part.inlineData.data, 'base64');
            }
          }
        }

        // 이미지가 없으면 에러
        if (!imageData) {
          throw new Error('No image data returned from Gemini API. The model may have blocked the request or returned only text.');
        }

        
        // Supabase에 업로드
        const imageUrl = await uploadImageToSupabase(imageData);
        
        // 도구 결과에 URL 저장
        const imageResult = {
          imageUrl,
          prompt,
          timestamp: new Date().toISOString(),
          ...(actualEditImageUrls.length > 0 && { 
            originalImageUrls: actualEditImageUrls, 
            isEdit: true,
            isComposition: actualEditImageUrls.length > 1
          })
        };
        
        generatedImages.push(imageResult);

        // 클라이언트에 완료 신호 전송
        if (dataStream) {
          dataStream.write({
            type: 'data-gemini_image_complete',
            id: `ann-gemini-complete-${Date.now()}`,
            data: imageResult
          });
        }

        return {
          success: true,
          imageUrl,
          prompt,
          textResponse, // Include text in AI context
          isEdit: actualEditImageUrls.length > 0,
          isComposition: actualEditImageUrls.length > 1,
          originalImageUrls: actualEditImageUrls
        };

      } catch (error) {
        console.error('[DEBUG-GEMINI] Error processing image:', error);
        
        // 에러 신호 전송
        if (dataStream) {
          dataStream.write({
            type: 'data-gemini_image_error',
            id: `ann-gemini-error-${Date.now()}`,
            data: {
              error: error instanceof Error ? error.message : 'Unknown error',
              prompt,
              editImageUrl: editImageUrl
            }
          });
        }
        
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error generating image',
          prompt,
          editImageUrl
        };
      }
    }
  });

  // 도구와 생성된 이미지 리스트를 함께 반환
  return Object.assign(geminiImageTool, { generatedImages });
}

// Seedream 4.0 이미지 생성/편집 도구 생성 함수
export function createSeedreamImageTool(dataStream?: any, userId?: string, allMessages: any[] = []) {
  
  const generatedImages: Array<{
    imageUrl: string;
    prompt: string;
    timestamp: string;
    originalImageUrl?: string;
    isEdit?: boolean;
    size?: string;
    aspectRatio?: string;
  }> = [];

  // 🔥 대화 히스토리에서 사용자 업로드 이미지만 수집 및 인덱스 생성
  const imageMap = new Map<string, string>();
  let uploadedImageIndex = 1;
  
  console.log('[DEBUG-SEEDREAM] All messages:', allMessages);
  for (const message of allMessages) {
    // 업로드된 이미지 (experimental_attachments)
    if (message.experimental_attachments && Array.isArray(message.experimental_attachments)) {
      for (const attachment of message.experimental_attachments) {
        if (attachment.contentType?.startsWith('image/') || attachment.fileType === 'image') {
          imageMap.set(`uploaded_image_${uploadedImageIndex}`, attachment.url);
          uploadedImageIndex++;
        }
      }
    }
    
    // 🔥 finalMessagesForExecution의 content 배열에서 이미지 파일 찾기
    if (message.content && Array.isArray(message.content)) {
      for (const contentItem of message.content) {
        if (contentItem.type === 'file' && contentItem.mediaType?.startsWith('image/')) {
          // data 필드에 URL이 있는 경우 (finalMessagesForExecution 형식)
          if (contentItem.data && typeof contentItem.data === 'string') {
            imageMap.set(`uploaded_image_${uploadedImageIndex}`, contentItem.data);
            uploadedImageIndex++;
          }
        }
      }
    }
  }
  
  console.log('[DEBUG-SEEDREAM] Image map created:', Array.from(imageMap.keys()));

  // Supabase 업로드 헬퍼
  async function uploadImageToSupabase(uint8Array: Uint8Array): Promise<string> {
    const { createClient } = await import('@/utils/supabase/server');
    const supabase = await createClient();
    
    const fileName = `seedream_${Date.now()}_${Math.random().toString(36).slice(2)}.png`;
    const { data, error } = await supabase.storage
      .from('gemini-images')
      .upload(fileName, uint8Array, { contentType: 'image/png' });
    
    if (error) {
      throw new Error(`Failed to upload image: ${error.message}`);
    }
    
    const { data: { publicUrl } } = supabase.storage
      .from('gemini-images')
      .getPublicUrl(fileName);
    
    return publicUrl;
  }

  // 이미지 다운로드 헬퍼
  async function downloadImage(url: string): Promise<Uint8Array> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  }

  // 이미지를 base64 data URI로 변환하는 헬퍼
  async function convertImageToDataUri(url: string): Promise<string> {
    const uint8Array = await downloadImage(url);
    const base64 = Buffer.from(uint8Array).toString('base64');
    const contentType = 'image/png'; // Replicate expects PNG format
    return `data:${contentType};base64,${base64}`;
  }

  const seedreamImageInputSchema = z.object({
    prompt: z.string().describe('Text description for image generation or editing instructions'),
    editImageUrl: z.union([
      z.string(), 
      z.array(z.string()),
      z.null()
    ]).optional().describe('Image reference(s): For user-uploaded images use "uploaded_image_N" (e.g., uploaded_image_1). For previously generated images, use the full Supabase public URL from the previous response. Can be a single string or array of up to 10 images.'),
    size: z.enum(['1K', '2K', '4K', 'custom']).optional().describe('Image resolution: 1K (1024px), 2K (2048px), 4K (4096px), or custom dimensions'),
    aspectRatio: z.string().optional().describe('Image aspect ratio (e.g., "1:1", "16:9", "4:3") or "match_input_image" to match input image aspect ratio'),
    width: z.number().min(1024).max(4096).optional().describe('Custom image width (only used when size is "custom")'),
    height: z.number().min(1024).max(4096).optional().describe('Custom image height (only used when size is "custom")'),
    sequentialImageGeneration: z.enum(['disabled', 'auto']).optional().describe('Sequential image generation mode: "disabled" for single image, "auto" for multiple related images'),
    maxImages: z.number().min(1).max(15).optional().describe('Maximum number of images to generate when sequentialImageGeneration is "auto"')
  });

  type SeedreamImageInput = z.infer<typeof seedreamImageInputSchema>;

  const seedreamImageTool = tool<SeedreamImageInput, unknown>({
    description: 'Generate and edit images using ByteDance Seedream 4.0 model via Replicate. Supports up to 4K resolution, batch generation, and multi-image composition.',
    inputSchema: seedreamImageInputSchema,
    execute: async ({ prompt, editImageUrl, size, aspectRatio, width, height, sequentialImageGeneration, maxImages }: SeedreamImageInput) => {
      try {
        console.log('[DEBUG-SEEDREAM] Processing image request:', { prompt, editImageUrl, size, aspectRatio, width, height, sequentialImageGeneration, maxImages });

        // 이미지 생성/편집 시작 신호 전송
        if (dataStream) {
          dataStream.write({
            type: 'data-seedream_image_started',
            id: `ann-seedream-start-${Date.now()}`,
            data: {
              prompt,
              editImageUrl,
              size,
              aspectRatio,
              started: true
            }
          });
        }

        // 🔥 이미지 참조를 실제 URL로 변환 (단일 또는 배열)
        let actualEditImageUrls: string[] = [];
        
        if (editImageUrl) {
          const urlsToResolve = Array.isArray(editImageUrl) ? editImageUrl : [editImageUrl];
          
          for (const url of urlsToResolve) {
            if (url.startsWith('uploaded_image_')) {
              const resolvedUrl = imageMap.get(url);
              if (resolvedUrl) {
                actualEditImageUrls.push(resolvedUrl);
                console.log(`[DEBUG-SEEDREAM] Resolved ${url} to:`, resolvedUrl);
              } else {
                throw new Error(`Image reference "${url}" not found in conversation history`);
              }
            } else {
              actualEditImageUrls.push(url); // Direct URL (for generated images or external URLs)
            }
          }
        }

        // Replicate API 호출을 위한 입력 준비
        const replicateInput: any = {
          prompt,
          size: size || '2K',
          aspect_ratio: aspectRatio || 'match_input_image',
          sequential_image_generation: sequentialImageGeneration || 'disabled',
          max_images: maxImages || 1
        };

        // Custom size인 경우 width, height 추가
        if (size === 'custom') {
          replicateInput.width = width || 2048;
          replicateInput.height = height || 2048;
        }

        // 편집 모드인 경우 이미지 입력 추가
        if (actualEditImageUrls.length > 0) {
          // 이미지를 base64 data URI로 변환
          const imageInputs = await Promise.all(
            actualEditImageUrls.map(url => convertImageToDataUri(url))
          );
          replicateInput.image_input = imageInputs;
        }

        console.log('[DEBUG-SEEDREAM] Calling Replicate API with input:', replicateInput);

        // Replicate API 호출
        const Replicate = (await import('replicate')).default;
        const replicate = new Replicate({
          auth: process.env.REPLICATE_API_TOKEN,
        });

        const output = await replicate.run("bytedance/seedream-4", { input: replicateInput });
        
        console.log('[DEBUG-SEEDREAM] Replicate output:', output);

        if (!Array.isArray(output) || output.length === 0) {
          throw new Error('No images generated by Replicate');
        }

        // 생성된 이미지들을 Supabase에 업로드
        const uploadedImages = await Promise.all(
          output.map(async (imageUrl: string, index: number) => {
            try {
              const imageData = await downloadImage(imageUrl);
              const supabaseUrl = await uploadImageToSupabase(imageData);
              
              const imageResult = {
                imageUrl: supabaseUrl,
                prompt,
                timestamp: new Date().toISOString(),
                originalImageUrl: actualEditImageUrls.length > 0 ? actualEditImageUrls[0] : undefined,
                isEdit: actualEditImageUrls.length > 0,
                size,
                aspectRatio
              };

              generatedImages.push(imageResult);

              // 클라이언트에 이미지 생성 완료 신호 전송
              if (dataStream) {
                dataStream.write({
                  type: 'data-seedream_image_complete',
                  id: `ann-seedream-complete-${Date.now()}-${index}`,
                  data: imageResult
                });
              }

              return imageResult;
            } catch (error) {
              console.error(`[DEBUG-SEEDREAM] Error processing image ${index}:`, error);
              throw error;
            }
          })
        );

        console.log('[DEBUG-SEEDREAM] Successfully processed', uploadedImages.length, 'images');

        return {
          success: true,
          images: uploadedImages,
          count: uploadedImages.length,
          prompt,
          size,
          aspectRatio
        };

      } catch (error) {
        console.error('[DEBUG-SEEDREAM] Error in seedream image tool:', error);
        
        // 에러 신호 전송
        if (dataStream) {
          dataStream.write({
            type: 'data-seedream_image_error',
            id: `ann-seedream-error-${Date.now()}`,
            data: {
              error: error instanceof Error ? error.message : 'Unknown error',
              prompt
            }
          });
        }

        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred',
          prompt
        };
      }
    }
  });

  // 도구와 생성된 이미지 리스트를 함께 반환
  return Object.assign(seedreamImageTool, { generatedImages });
}


