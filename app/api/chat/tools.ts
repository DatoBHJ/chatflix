import { z } from 'zod';
import { tool } from 'ai';
import { tavily } from '@tavily/core';
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
    WOLFRAM_ALPHA_APPID: process.env.WOLFRAM_ALPHA_APPID || ''
  }
});

// 도구 설명 및 매개변수 정의
const toolDefinitions = {
  webSearch: {
    description: 'Search the web for information with multiple queries.',
    parameters: {
      queries: 'Array of search queries to look up on the web. Generate 3-5 specific queries.',
      maxResults: 'Array of maximum number of results to return per query. Use higher numbers (8-10) for broad topics.',
      topics: 'Array of topic types to search for. Use "news" for current events and recent developments.',
      searchDepth: 'Array of search depths to use. Use "advanced" for complex or technical topics.',
      exclude_domains: 'A list of domains to exclude from all search results.'
    },
    defaultExcludeDomains: ['pinterest.com', 'quora.com']
  },
  jina_link_reader: {
    description: 'Read and extract content from a specific URL using Jina.ai',
    parameters: {
      url: 'The URL to read content from. The URL must be a valid web address starting with http:// or https://'
    }
  },
  calculator: {
    description: 'A tool for evaluating mathematical expressions. Example expressions: \'1.2 * (2 + 4.5)\', \'12.7 cm to inch\', \'sin(45 deg) ^ 2\'.',
    parameters: {
      expression: 'The mathematical expression to evaluate.'
    }
  },
  academicSearch: {
    description: 'Search academic papers and research articles on a specific topic.',
    parameters: {
      query: 'The search query to find relevant academic papers and research articles.'
    }
  },
  imageGenerator: {
    description: 'Generate images using Pollinations AI based on text prompts.',
    parameters: {
      prompts: 'Text description(s) of the image(s) to generate. Can be a single string or array of strings. Should be detailed and specific.',
      model: 'The model to use for generation (flux or turbo)',
      width: 'Image width in pixels',
      height: 'Image height in pixels',
      seed: 'Seed for reproducible results (optional)'
    }
  },
  xSearch: {
    description: 'Search X (formerly Twitter) posts.',
    parameters: {
      query: 'The search query, if a username is provided put in the query with @username',
      startDate: 'The start date for the search in YYYY-MM-DD format',
      endDate: 'The end date for the search in YYYY-MM-DD format'
    }
  },
  youtubeSearch: {
    description: 'Search YouTube videos using Exa AI and get detailed video information.',
    parameters: {
      query: 'The search query for YouTube videos'
    }
  },
  youtubeAnalyzer: {
    description: 'Extract detailed information and transcripts from specific YouTube videos.',
    parameters: {
      urls: 'Array of YouTube video URLs to analyze. Each URL should be a valid YouTube watch link.',
      lang: 'Optional language code for the transcript (e.g., "en", "es", "fr"). Default is "en".'
    }
  },
  wolframAlpha: {
    description: 'Advanced computational knowledge engine that can solve complex problems across various academic disciplines including mathematics, physics, chemistry, engineering, computer science, and more.',
    parameters: {
      query: 'The query to send to Wolfram Alpha. Can be mathematical expressions, scientific questions, engineering problems, etc.',
      format: 'The desired format of the response (simple, detailed, step-by-step). Default is detailed.',
      includePods: 'Specific Wolfram Alpha pods to include in the response (optional array of strings).',
      timeout: 'Maximum time in seconds to wait for a response. Default is 30.',
      units: 'Unit system to use for results (metric or imperial).',
      domain: 'Academic domain to optimize the query for (math, physics, chemistry, etc.).'
    }
  }
};

// Web Search 도구 생성 함수
export function createWebSearchTool(processMessages: any[], dataStream: any) {
  // 검색 결과를 저장할 배열
  const searchResults: any[] = [];
  
  const webSearchTool = tool({
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
          // console.log(`\nExecuting search ${index + 1}/${queries.length}:`, query);
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
      
      // 최종 검색 결과를 저장
      const finalResult = { searches: finalSearches };
      
      // 배열에 결과 추가하고 UI를 위한 어노테이션도 전송
      searchResults.push(finalResult);
      
      // 모든 검색 결과가 합쳐진 결과를 어노테이션으로 전송
      dataStream.writeMessageAnnotation({
        type: 'web_search_complete',
        data: finalResult
      });
      
      // 결과 반환
      return finalResult;
    }
  });
  
  // 기능은 웹 검색 도구지만 저장된 결과 배열도 함께 반환
  return Object.assign(webSearchTool, { searchResults });
}
// jina.ai 링크 리더 도구 생성 함수
export function createJinaLinkReaderTool() {
  return tool({
    description: toolDefinitions.jina_link_reader.description,
    parameters: z.object({
      url: z.string().url().describe(toolDefinitions.jina_link_reader.parameters.url),
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
        const rawContent = isJson 
          ? JSON.stringify(await response.json(), null, 2)
          : await response.text();
          
        let title = '';
        let content = rawContent;
        
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
          
          // 내용이 너무 길면 잘라내기
          if (content.length > 8000) {
            content = content.substring(0, 8000) + '... (content truncated)';
        }
        
        console.log(`[DEBUG-JINA] Successfully fetched content, length: ${content.length} characters`);
        
        return {
          content,
          url: targetUrl,
          title: title || getPageTitle(content) || targetUrl,
          contentType
        };
      } catch (error) {
        console.error('[DEBUG-JINA] Error fetching URL:', error);
        return {
          error: error instanceof Error ? error.message : 'Unknown error occurred',
          url
        };
      }
    }
  });
}

// 이미지 생성 도구 생성 함수
export function createImageGeneratorTool(dataStream?: any) {
  // 생성된 이미지 추적
  const generatedImages: Array<{
    imageUrl: string;
    prompt: string;
    model: string;
    timestamp: string;
  }> = [];
  
  const imageGeneratorTool = tool({
    description: toolDefinitions.imageGenerator.description,
    parameters: z.object({
      prompts: z.union([
        z.string(),
        z.array(z.string())
      ]).describe(toolDefinitions.imageGenerator.parameters.prompts),
      model: z.enum(['flux','turbo'])
      // model: z.enum(['flux', 'flux-realism', 'any-dark', 'flux-anime', 'flux-3d', 'turbo'])
             .describe(toolDefinitions.imageGenerator.parameters.model)
             .default('flux'),
      width: z.number().describe(toolDefinitions.imageGenerator.parameters.width).default(1024),
      height: z.number().describe(toolDefinitions.imageGenerator.parameters.height).default(1024),
      seed: z.number().optional().describe(toolDefinitions.imageGenerator.parameters.seed),
    }),
    execute: async ({ prompts, model, width, height, seed }: {
      prompts: string | string[];
      model: 'flux'|'turbo';
      // model: 'flux' | 'flux-realism' | 'any-dark' | 'flux-anime' | 'flux-3d' | 'turbo';
      width: number;
      height: number;
      seed?: number;
    }) => {
      try {
        console.log('[DEBUG-IMAGE] Generating image(s) with parameters:', { prompts, model, width, height, seed });
        
        // 문자열 하나만 받은 경우 배열로 변환
        const promptsArray = Array.isArray(prompts) ? prompts : [prompts];
        
        // 각 프롬프트에 대해 이미지 URL 생성
        const results = promptsArray.map(prompt => {
          // URL 인코딩된 프롬프트 준비
          const encodedPrompt = encodeURIComponent(prompt);
          
          // 기본 URL 구성 - 개선된 파라미터 추가 (nologo=true, safe=false, enhance=true)
          let imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&nologo=true&safe=false&enhance=true`;
          
          // 모델과 시드 추가 (선택 사항)
          if (model) {
            imageUrl += `&model=${model}`;
          }
          
          if (seed !== undefined) {
            imageUrl += `&seed=${seed}`;
          }
          
          // 생성된 이미지 추적
          const timestamp = new Date().toISOString();
          const imageData = {
            imageUrl,
            prompt,
            model,
            timestamp
          };
          
          generatedImages.push(imageData);
          
          // 클라이언트에 이미지 생성 알림 전송
          if (dataStream) {
            dataStream.writeMessageAnnotation({
              type: 'generated_image',
              data: imageData
            });
          }
          
          return {
            url: imageUrl,
            description: prompt,
            parameters: { prompt, model, width, height, seed, enhance: true, safe: false }
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
          parameters: { prompts, model, width, height, seed }
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
    parameters: z.object({ expression: z.string().describe(toolDefinitions.calculator.parameters.expression) }),
    execute: async ({ expression }) => {
      stepCounter++;
      const result = mathjs.evaluate(expression);
      calculationSteps.push({
        step: stepCounter,
        expression,
        result,
        timestamp: new Date().toISOString()
      });
      
      // UI에 실시간 계산 단계 표시
      dataStream.writeMessageAnnotation({
        type: 'math_calculation',
        step: stepCounter,
        expression,
        result: result.toString(),
        calculationSteps
      });
      
      return result;
    },
  });

  // 계산기 도구와 저장된 계산 단계를 함께 반환
  return Object.assign(calculatorTool, { calculationSteps });
}

// 학술 검색 도구 생성 함수
export function createAcademicSearchTool(dataStream: any) {
  // 검색 결과를 저장할 배열
  const searchResults: any[] = [];
  
  const academicSearchTool = tool({
    description: toolDefinitions.academicSearch.description,
    parameters: z.object({
      query: z.string().describe(toolDefinitions.academicSearch.parameters.query),
    }),
    execute: async ({ query }: { query: string }) => {
      try {
        const apiKey = process.env.EXA_API_KEY;
        if (!apiKey) {
          throw new Error('EXA_API_KEY is not defined in environment variables');
        }
        
        console.log('[Academic Search] Searching for papers on:', query);
        
        const exa = new Exa(apiKey);
        
        // Search academic papers with content summary
        const result = await exa.searchAndContents(query, {
          type: 'auto',
          numResults: 20,
          category: 'research paper',
          summary: {
            query: 'Abstract of the Paper',
          },
        });
        
        // Process and clean results
        const processedResults = result.results.reduce<typeof result.results>((acc: any[], paper: any) => {
          // Skip if URL already exists or if no summary available
          if (acc.some((p: any) => p.url === paper.url) || !paper.summary) return acc;
          
          // Clean up summary (remove "Summary:" prefix if exists)
          const cleanSummary = paper.summary.replace(/^Summary:\s*/i, '');
          
          // Clean up title (remove [...] suffixes)
          const cleanTitle = paper.title?.replace(/\s\[.*?\]$/, '');
          
          acc.push({
            ...paper,
            title: cleanTitle || '',
            summary: cleanSummary,
          });
          
          return acc;
        }, []);
        
        // Take only the first 10 unique, valid results
        const limitedResults = processedResults.slice(0, 10);
        
        // Track this search in our array
        const searchData = {
          query,
          timestamp: new Date().toISOString(),
          results: limitedResults
        };
        
        searchResults.push(searchData);
        
        // Send annotation for visualization in the UI
        dataStream.writeMessageAnnotation({
          type: 'academic_search_complete',
          data: searchData
        });
        
        return {
          results: limitedResults,
        };
      } catch (error) {
        console.error('Academic search error:', error);
        
        // Send error annotation
        dataStream.writeMessageAnnotation({
          type: 'academic_search_error',
          data: {
            query,
            timestamp: new Date().toISOString(),
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        });
        
        return {
          error: error instanceof Error ? error.message : 'Unknown error',
          results: []
        };
      }
    },
  });
  
  // 학술 검색 도구와 저장된 결과 배열을 함께 반환
  return Object.assign(academicSearchTool, { searchResults });
}

// X (Twitter) 검색 도구 생성 함수
export function createXSearchTool(dataStream: any) {
  // 검색 결과를 저장할 배열
  const searchResults: any[] = [];
  
  const xSearchTool = tool({
    description: toolDefinitions.xSearch.description,
    parameters: z.object({
      query: z.string().describe(toolDefinitions.xSearch.parameters.query),
      startDate: z.string().optional().describe(toolDefinitions.xSearch.parameters.startDate),
      endDate: z.string().optional().describe(toolDefinitions.xSearch.parameters.endDate),
    }),
    execute: async ({
      query,
      startDate,
      endDate,
    }: {
      query: string;
      startDate?: string;
      endDate?: string;
    }) => {
      try {
        const apiKey = process.env.EXA_API_KEY;
        if (!apiKey) {
          throw new Error('EXA_API_KEY is not defined in environment variables');
        }
        
        console.log('[X Search] Searching for posts on:', query);
        
        const exa = new Exa(apiKey);
        
        // Search X (Twitter) posts
        const result = await exa.searchAndContents(query, {
          type: 'keyword',
          numResults: 20,
          text: true,
          highlights: true,
          includeDomains: ['twitter.com', 'x.com'],
          startPublishedDate: startDate,
          endPublishedDate: endDate,
        });
        
        // Extract tweet ID from URL
        const extractTweetId = (url: string): string | null => {
          const match = url.match(/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/);
          return match ? match[1] : null;
        };
        
        // Process and filter results
        const processedResults = result.results.reduce<any[]>((acc, post) => {
          const tweetId = extractTweetId(post.url);
          if (tweetId) {
            acc.push({
              ...post,
              tweetId,
              title: post.title || '',
            });
          }
          return acc;
        }, []);
        
        // Track this search in our array
        const searchData = {
          query,
          timestamp: new Date().toISOString(),
          results: processedResults
        };
        
        searchResults.push(searchData);
        
        // Send annotation for visualization in the UI
        dataStream.writeMessageAnnotation({
          type: 'x_search_complete',
          data: searchData
        });
        
        return {
          results: processedResults,
        };
      } catch (error) {
        console.error('X search error:', error);
        
        // Send error annotation
        dataStream.writeMessageAnnotation({
          type: 'x_search_error',
          data: {
            query,
            timestamp: new Date().toISOString(),
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        });
        
        return {
          error: error instanceof Error ? error.message : 'Unknown error',
          results: []
        };
      }
    },
  });
  
  // X 검색 도구와 저장된 결과 배열을 함께 반환
  return Object.assign(xSearchTool, { searchResults });
}

// YouTube 검색 도구 생성 함수
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
    parameters: z.object({
      query: z.string().describe(toolDefinitions.youtubeSearch.parameters.query),
    }),
    execute: async ({ query }: { query: string }) => {
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
        
        // Send annotation for visualization in the UI
        dataStream.writeMessageAnnotation({
          type: 'youtube_search_complete',
          data: searchResult
        });
        
        return {
          results: validResults,
        };
      } catch (error) {
        console.error('YouTube search error:', error);
        
        // Send error annotation
        dataStream.writeMessageAnnotation({
          type: 'youtube_search_error',
          data: {
            query,
            timestamp: new Date().toISOString(),
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        });
        
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
    parameters: z.object({
      urls: z.array(z.string().url()).describe(toolDefinitions.youtubeAnalyzer.parameters.urls),
      lang: z.string().optional().describe('Optional preferred language code for transcript. If not specified or not available, the first available language will be used.')
    }),
    execute: async ({
      urls,
      lang,
    }: {
      urls: string[];
      lang?: string;
    }) => {
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
        
        // Send annotation for UI
        dataStream.writeMessageAnnotation({
          type: 'youtube_analysis_complete',
          data: {
            timestamp: new Date().toISOString(),
            results
          }
        });
        
        return {
          results
        };
      } catch (error) {
        console.error('[YouTube Link Analyzer] Error:', error);
        
        // Send error annotation
        dataStream.writeMessageAnnotation({
          type: 'youtube_analysis_error',
          data: {
            timestamp: new Date().toISOString(),
            error: error instanceof Error ? error.message : 'Unknown error',
            urls
          }
        });
        
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

// Wolfram Alpha Ultimate tool creation function
export function createWolframAlphaUltimateTool(dataStream: any) {
  // Array to store query results
  const queryResults: any[] = [];

  const wolframAlphaUltimateTool = tool({
    description: toolDefinitions.wolframAlpha.description,
    parameters: z.object({
      query: z.string().describe(toolDefinitions.wolframAlpha.parameters.query),
      format: z.enum(['simple', 'detailed', 'step-by-step'])
              .describe(toolDefinitions.wolframAlpha.parameters.format)
              .default('detailed'),
      includePods: z.array(z.string())
                   .describe(toolDefinitions.wolframAlpha.parameters.includePods)
                   .optional(),
      timeout: z.number()
               .describe(toolDefinitions.wolframAlpha.parameters.timeout)
               .default(30),
      units: z.enum(['metric', 'imperial'])
             .describe(toolDefinitions.wolframAlpha.parameters.units)
             .optional(),
      domain: z.enum([
        'math', 'physics', 'chemistry', 'engineering', 'electronics', 
        'biology', 'medicine', 'economics', 'statistics', 'general'
      ]).describe(toolDefinitions.wolframAlpha.parameters.domain).optional(),
    }),
    execute: async ({ 
      query, 
      format, 
      includePods, 
      timeout, 
      units, 
      domain 
    }: {
      query: string;
      format: 'simple' | 'detailed' | 'step-by-step';
      includePods?: string[];
      timeout: number;
      units?: 'metric' | 'imperial';
      domain?: 'math' | 'physics' | 'chemistry' | 'engineering' | 'electronics' | 
               'biology' | 'medicine' | 'economics' | 'statistics' | 'general';
    }) => {
      try {
        // Check API key
        const apiKey = process.env.WOLFRAM_ALPHA_APPID;
        if (!apiKey) {
          throw new Error('WOLFRAM_ALPHA_APPID is not defined in environment variables');
        }
        
        // Query start notification
        dataStream.writeMessageAnnotation({
          type: 'wolfram_alpha_query_start',
          data: {
            query,
            timestamp: new Date().toISOString(),
            status: 'processing'
          }
        });

        // API parameters
        const params = new URLSearchParams({
          input: query,
          appid: apiKey,
          output: 'json',
          format: 'image,plaintext',
          scantimeout: timeout.toString(),
          podtimeout: timeout.toString(),
          formattimeout: timeout.toString(),
          parsetimeout: timeout.toString(),
          totaltimeout: (timeout * 2).toString(),
          reinterpret: 'true',
          translation: 'true',
        });

        // Set units if provided
        if (units) {
          params.append('units', units);
        }

        // Add format-specific parameters
        if (format === 'step-by-step') {
          params.append('podstate', 'Step-by-step solution');
          params.append('podstate', 'Show work');
        }

        // Add pod inclusion parameters if specified
        if (includePods && includePods.length > 0) {
          params.append('includepodid', includePods.join(','));
        }

        // Add domain-specific assumptions
        if (domain) {
          params.append('assumption', `*C.${domain}-_*`);
        }

        // API request notification
        dataStream.writeMessageAnnotation({
          type: 'wolfram_alpha_query_progress',
          data: {
            query,
            timestamp: new Date().toISOString(),
            status: 'sending_request',
            message: 'Sending request to Wolfram Alpha...'
          }
        });

        // API call URL
        const apiUrl = `https://api.wolframalpha.com/v2/query?${params.toString()}`;
        
        // Execute API call with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout * 1000);
        
        try {
          const response = await fetch(apiUrl, {
            signal: controller.signal,
            headers: {
              'User-Agent': 'ChatBot/1.0'
            }
          });
          
          clearTimeout(timeoutId);
          
          if (!response.ok) {
            throw new Error(`Wolfram Alpha API failed with status ${response.status}: ${response.statusText}`);
          }

          const data = await response.json();
          
          // Response received notification
          dataStream.writeMessageAnnotation({
            type: 'wolfram_alpha_query_progress',
            data: {
              query,
              timestamp: new Date().toISOString(),
              status: 'processing_response',
              message: 'Processing Wolfram Alpha response...'
            }
          });

          // Process results
          const result = processWolframAlphaResponse(data, format);
          
          // Save and send results
          const timestamp = new Date().toISOString();
          const searchData = {
            query,
            timestamp,
            result
          };
          
          queryResults.push(searchData);
          
          // Send result annotation
          dataStream.writeMessageAnnotation({
            type: 'wolfram_alpha_result',
            data: searchData
          });
          
          // Return markdown result for LLM
          return {
            markdown: result.markdown,
            query,
            success: result.success
          };
        } catch (fetchError) {
          clearTimeout(timeoutId);
          
          if (fetchError instanceof Error) {
            throw new Error(`Wolfram Alpha API request failed: ${fetchError.message}`);
          }
          throw fetchError;
        }
      } catch (error) {
        console.error('[Wolfram Alpha] Error:', error);
        
        // Send error annotation
        dataStream.writeMessageAnnotation({
          type: 'wolfram_alpha_error',
          data: {
            query,
            timestamp: new Date().toISOString(),
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        });
        
        // Return error markdown
        return {
          markdown: `## Wolfram Alpha Error\n\n${error instanceof Error ? error.message : 'Unknown error'}\n\nQuery attempted: \`${query}\``,
          query,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }
  });

  // Response processing function
  function processWolframAlphaResponse(data: any, format: string) {
    // Check query success
    if (!data.queryresult || data.queryresult.success === false) {
      const errorResult: {
        success: boolean;
        error: string;
        didyoumeans: any[];
        tips: any[];
        markdown: string;
      } = {
        success: false,
        error: data.queryresult?.error?.msg || 'No results found',
        didyoumeans: data.queryresult?.didyoumeans || [],
        tips: data.queryresult?.tips || [],
        markdown: formatFailedQueryForLLM({
          error: data.queryresult?.error?.msg || 'No results found',
          didyoumeans: data.queryresult?.didyoumeans || [],
          tips: data.queryresult?.tips || []
        })
      };
      return errorResult;
    }
    
    // Process pods
    const pods = data.queryresult.pods || [];
    const processedPods = pods.map((pod: any) => {
      const subpods = pod.subpods || [];
      return {
        title: pod.title,
        id: pod.id,
        scanner: pod.scanner,
        position: pod.position,
        subpods: subpods.map((subpod: any) => ({
          title: subpod.title,
          plaintext: subpod.plaintext,
          img: subpod.img ? {
            src: subpod.img.src,
            alt: subpod.img.alt,
            width: subpod.img.width,
            height: subpod.img.height
          } : null
        }))
      };
    });
    
    // Extract main results
    const inputInterpretation = getInputInterpretation(pods);
    const mainResult = getMainResult(pods);
    const steps = format === 'step-by-step' ? getStepByStepSolution(pods) : [];
    
    // Create result object
    const result: {
      success: boolean;
      inputInterpretation: any;
      mainResult: any;
      steps: any[];
      pods: any[];
      assumptions: any;
      warnings: any;
      timing: any;
      timedout: any;
      dataTypes: any;
      rawOutput?: any;
      markdown?: string;
    } = {
      success: true,
      inputInterpretation,
      mainResult,
      steps,
      pods: processedPods,
      assumptions: data.queryresult.assumptions || [],
      warnings: data.queryresult.warnings || [],
      timing: data.queryresult.timing || 0,
      timedout: data.queryresult.timedout || '',
      dataTypes: data.queryresult.datatypes || '',
      rawOutput: format === 'detailed' ? data : undefined
    };
    
    // Create markdown for LLM display
    result.markdown = formatForLLM(result);
    
    return result;
  }
  
  // Input interpretation extraction function
  function getInputInterpretation(pods: any[]) {
    const inputPod = pods.find((pod: any) => 
      pod.id === 'Input' || pod.id === 'Input interpretation'
    );
    
    if (inputPod && inputPod.subpods && inputPod.subpods.length > 0) {
      return inputPod.subpods[0].plaintext;
    }
    
    return null;
  }

  // Main result extraction function
  function getMainResult(pods: any[]) {
    // Result pod ID priority order
    const resultPodIds = [
      'Result', 
      'Solution', 
      'DecimalApproximation', 
      'Value',
      'Derivative',
      'Integral',
      'IndefiniteIntegral',
      'DefiniteIntegral',
      'Roots',
      'Plot',
      'NumberLine'
    ];
    
    // Find result pod by priority
    for (const podId of resultPodIds) {
      const resultPod = pods.find((pod: any) => pod.id === podId);
      if (resultPod && resultPod.subpods && resultPod.subpods.length > 0) {
        return {
          title: resultPod.title,
          plaintext: resultPod.subpods[0].plaintext,
          img: resultPod.subpods[0].img
        };
      }
    }
    
    // Use first non-input pod if no priority pod found
    const firstNonInputPod = pods.find((pod: any) => 
      pod.id !== 'Input' && pod.id !== 'Input interpretation'
    );
    
    if (firstNonInputPod && firstNonInputPod.subpods && firstNonInputPod.subpods.length > 0) {
      return {
        title: firstNonInputPod.title,
        plaintext: firstNonInputPod.subpods[0].plaintext,
        img: firstNonInputPod.subpods[0].img
      };
    }
    
    return null;
  }

  // Step-by-step solution extraction function
  function getStepByStepSolution(pods: any[]) {
    const stepPods = pods.filter((pod: any) => 
      pod.id === 'Step-by-step solution' || 
      pod.id === 'Steps' ||
      pod.title.includes('step') ||
      pod.title.includes('Step')
    );
    
    if (stepPods.length === 0) {
      return [];
    }
    
    // Collect all steps
    const steps: any[] = [];
    
    stepPods.forEach((pod: any) => {
      if (pod.subpods && pod.subpods.length > 0) {
        pod.subpods.forEach((subpod: any) => {
          if (subpod.plaintext) {
            steps.push({
              title: subpod.title || pod.title,
              plaintext: subpod.plaintext,
              img: subpod.img
            });
          }
        });
      }
    });
    
    return steps;
  }

  // Format math expressions using mathjs
  function formatMathExpression(text: string) {
    if (!text) return '';
    
    // Try to convert simple math expressions to LaTeX
    try {
      // Only process simple math expressions
      if (/^[\d\s+\-*/^()=.<>!,]+$/.test(text) && !text.includes('\n')) {
        try {
          // Use mathjs to parse expression and convert to LaTeX
          const node = mathjs.parse(text);
          const latex = node.toTex();
          return `$${latex}$`;
        } catch {
          // Fall back to code block on conversion failure
          return `\`\`\`\n${text}\n\`\`\``;
        }
      }
    } catch {
      // Fall back to code block on any error
    }
    
    // Default to code block
    return `\`\`\`\n${text}\n\`\`\``;
  }

  // Format results for LLM display
  function formatForLLM(result: any) {
    if (!result.success) {
      return formatFailedQueryForLLM(result);
    }
    
    let markdown = `## Wolfram Alpha Results\n\n`;
    
    // Input interpretation
    if (result.inputInterpretation) {
      markdown += `**Input interpretation**: ${result.inputInterpretation}\n\n`;
    }
    
    // Main result
    if (result.mainResult) {
      markdown += `### Result\n\n`;
      
      // Text result
      if (result.mainResult.plaintext) {
        // Format math expressions
        markdown += formatMathExpression(result.mainResult.plaintext) + '\n\n';
      }
      
      // Image result
      if (result.mainResult.img && result.mainResult.img.src) {
        // Make sure image URL is complete and encoded correctly
        const imageUrl = ensureValidImageUrl(result.mainResult.img.src);
        markdown += `![${result.mainResult.img.alt || 'Result image'}](${imageUrl})\n\n`;
      }
    }
    
    // Assumptions
    if (result.assumptions && result.assumptions.length > 0) {
      markdown += `### Assumptions\n\n`;
      
      result.assumptions.forEach((assumption: any) => {
        if (assumption.values && assumption.values.length > 0) {
          markdown += `- **${assumption.type || 'Assumption'}**: `;
          markdown += assumption.values.map((value: any) => value.desc || value.name).join(', ');
          markdown += '\n';
        }
      });
      
      markdown += '\n';
    }
    
    // Step-by-step solution
    if (result.steps && result.steps.length > 0) {
      markdown += `### Step-by-step Solution\n\n`;
      
      result.steps.forEach((step: any, index: number) => {
        markdown += `**Step ${index + 1}**: `;
        
        if (step.title && step.title !== 'Step-by-step solution') {
          markdown += `${step.title}\n\n`;
        }
        
        if (step.plaintext) {
          markdown += formatMathExpression(step.plaintext) + '\n\n';
        }
        
        if (step.img && step.img.src) {
          // Make sure image URL is complete and encoded correctly
          const imageUrl = ensureValidImageUrl(step.img.src);
          markdown += `![${step.img.alt || 'Step image'}](${imageUrl})\n\n`;
        }
      });
    }
    
    // Additional information (other pods)
    const additionalPods = result.pods.filter((pod: any) => 
      pod.id !== 'Input' && 
      pod.id !== 'Input interpretation' &&
      pod.id !== 'Result' &&
      pod.id !== 'Solution' &&
      pod.id !== 'Step-by-step solution' &&
      pod.id !== 'Steps'
    );
    
    if (additionalPods.length > 0) {
      markdown += `### Additional Information\n\n`;
      
      additionalPods.forEach((pod: any) => {
        markdown += `#### ${pod.title}\n\n`;
        
        pod.subpods.forEach((subpod: any) => {
          if (subpod.plaintext) {
            markdown += formatMathExpression(subpod.plaintext) + '\n\n';
          }
          
          if (subpod.img && subpod.img.src) {
            // Make sure image URL is complete and encoded correctly
            const imageUrl = ensureValidImageUrl(subpod.img.src);
            markdown += `![${subpod.img.alt || pod.title}](${imageUrl})\n\n`;
          }
        });
      });
    }
    
    return markdown;
  }

  // Ensure Wolfram Alpha image URLs are valid and complete
  function ensureValidImageUrl(url: string): string {
    // Return unmodified URL if it's already a complete URL
    if (url.startsWith('https://') || url.startsWith('http://')) {
      return url;
    }

    // Add https protocol if missing
    if (url.startsWith('//')) {
      return `https:${url}`;
    }

    // Assume it's a relative URL if it doesn't have a protocol, add Wolfram Alpha domain
    if (!url.includes('://')) {
      // If it starts with /, keep as is, otherwise add /
      const urlPath = url.startsWith('/') ? url : `/${url}`;
      return `https://www4b.wolframalpha.com${urlPath}`;
    }

    // Return original URL if none of the above conditions match
    return url;
  }

  // Format failed query for LLM
  function formatFailedQueryForLLM(result: any) {
    let markdown = `## Wolfram Alpha Query Failed\n\n`;
    
    if (result.error) {
      markdown += `**Error**: ${result.error}\n\n`;
    }
    
    // Suggested alternative queries
    if (result.didyoumeans && result.didyoumeans.length > 0) {
      markdown += `**Did you mean?**\n\n`;
      
      // Process didyoumeans (can be array or object)
      const suggestions = Array.isArray(result.didyoumeans) 
        ? result.didyoumeans 
        : [result.didyoumeans];
      
      suggestions.forEach((suggestion: any) => {
        const suggestionText = suggestion.val || suggestion;
        markdown += `- ${suggestionText}\n`;
      });
      
      markdown += '\n';
    }
    
    // Tips
    if (result.tips && result.tips.length > 0) {
      markdown += `**Tips**:\n\n`;
      
      result.tips.forEach((tip: any) => {
        markdown += `- ${tip.text}\n`;
      });
    }
    
    return markdown;
  }

  // Return the tool with query results
  return Object.assign(wolframAlphaUltimateTool, { queryResults });
}
