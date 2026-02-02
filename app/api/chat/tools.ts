import { z } from 'zod';
import { tool } from 'ai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { deduplicateResults, normalizeUrl, getPageTitle } from './utils/toolers';
import type { LinkMetaEntry, LinkMetadataResult } from '@/app/types/linkPreview';
import * as mathjs from 'mathjs';
import Exa from 'exa-js';
import Replicate from 'replicate';
import dotenv from 'dotenv';
import { fetchLinkMetadata } from '@/app/lib/linkMetadataFetcher';

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

// Supabase 업로드 헬퍼 (이미지)
async function uploadImageToSupabase(uint8Array: Uint8Array, userId: string, prefix: string = 'image'): Promise<{ path: string, url: string }> {
  const { createClient } = await import('@/utils/supabase/server');
  const supabase = await createClient();
  
  const fileName = `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}.png`;
  const filePath = `${userId}/${fileName}`;
  
  const { error } = await supabase.storage
    .from('generated-images')
    .upload(filePath, uint8Array, { contentType: 'image/png' });
  
  if (error) {
    throw new Error(`Failed to upload image: ${error.message}`);
  }
  
  // Create signed URL for private bucket
  const { data: signedData, error: signedError } = await supabase.storage
    .from('generated-images')
    .createSignedUrl(filePath, 24 * 60 * 60); // 24 hours
  
  if (signedError || !signedData?.signedUrl) {
    throw new Error(`Failed to create signed URL: ${signedError?.message || 'Unknown error'}`);
  }
  
  return { path: filePath, url: signedData.signedUrl };
}

/** Resolve a fresh signed URL for generated images. Use when url may be expired (Supabase 24h TTL). */
async function resolveGeneratedImageUrl(imgData: { url: string; path: string }): Promise<string> {
  if (!imgData.path || !imgData.url) return imgData.url;
  const isSupabaseSigned =
    imgData.url.includes('supabase.co/storage') &&
    (imgData.url.includes('/object/sign/') || imgData.url.includes('token='));
  if (!isSupabaseSigned) return imgData.url;
  try {
    const { createClient } = await import('@/utils/supabase/server');
    const supabase = await createClient();
    const { data: signedData, error: signedError } = await supabase.storage
      .from('generated-images')
      .createSignedUrl(imgData.path, 24 * 60 * 60);
    if (signedError || !signedData?.signedUrl) return imgData.url;
    return signedData.signedUrl;
  } catch {
    return imgData.url;
  }
}

/** Resolve a fresh signed URL for chat_attachments (uploaded images). Use when url may be expired or corrupted (custom domain, 24h TTL). */
async function resolveUploadedImageUrl(url: string): Promise<string> {
  if (!url || !url.includes('/storage/v1/object/sign/') || !url.includes('chat_attachments/')) return url;
  const path = url.split('chat_attachments/')[1]?.split('?')[0];
  if (!path) return url;
  try {
    const { createClient } = await import('@/utils/supabase/server');
    const supabase = await createClient();
    const { data: signedData, error: signedError } = await supabase.storage
      .from('chat_attachments')
      .createSignedUrl(path, 24 * 60 * 60);
    if (signedError || !signedData?.signedUrl) return url;
    return signedData.signedUrl;
  } catch {
    return url;
  }
}

// Utility helpers
const ensureUrlProtocol = (value?: string) => {
  if (!value) return value;
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
};

const getDomainFromUrl = (url?: string) => {
  if (!url) return '';
  try {
    const normalized = ensureUrlProtocol(url) || '';
    if (!normalized) return '';
    return new URL(normalized).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

type MetadataCacheEntry = {
  data: LinkMetadataResult;
  timestamp: number;
};

const METADATA_CACHE_TTL = 5 * 60 * 1000;
const serverMetadataCache = new Map<string, MetadataCacheEntry>();

const normalizeCacheKey = (url?: string) => {
  if (!url) return '';
  try {
    return new URL(url).toString();
  } catch {
    return url;
  }
};

const getCachedServerMetadata = (url?: string): LinkMetadataResult | null => {
  if (!url) return null;
  const key = normalizeCacheKey(url);
  const cached = serverMetadataCache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.timestamp > METADATA_CACHE_TTL) {
    serverMetadataCache.delete(key);
    return null;
  }
  return cached.data;
};

const setCachedServerMetadata = (url: string, data: LinkMetadataResult) => {
  const key = normalizeCacheKey(url);
  if (!key) return;
  serverMetadataCache.set(key, {
    data,
    timestamp: Date.now()
  });
};

// 🛠️ Image Tool Mapping Logger
const logImageMapping = (toolName: string, prompt: string, editImageUrl?: string | string[] | null, resolvedUrls?: string[]) => {
  const shortPrompt = prompt ? (prompt.length > 200 ? prompt.substring(0, 200) + '...' : prompt) : 'No prompt';
  console.log(`\n[${toolName}] [${new Date().toLocaleTimeString()}] 🛠️ PROMPT: "${shortPrompt}"`);
  
  if (editImageUrl) {
    const refs = Array.isArray(editImageUrl) ? editImageUrl : [editImageUrl];
    console.log(`[${toolName}] 🔍 REFS:   [${refs.join(', ')}]`);
    if (resolvedUrls && resolvedUrls.length > 0) {
      resolvedUrls.forEach((url, i) => {
        const ref = refs[i] || `ref_${i+1}`;
        // 🔥 FULL URL LOGGING
        const displayUrl = url; 
        console.log(`[${toolName}] ✅ MAP:    ${ref} -> ${displayUrl}`);
      });
    }
  }
  console.log(''); // Newline for clarity
};

const MAX_METADATA_CONCURRENCY = 8;

const hydrateLinkMetaMapWithMetadata = async ({
  linkMap,
  linkMetaMap,
  thumbnailMap
}: {
  linkMap: Record<string, string>;
  linkMetaMap: Record<string, LinkMetaEntry>;
  thumbnailMap: Record<string, string>;
}) => {
  if (!linkMap || Object.keys(linkMap).length === 0) return;

  const urlToLinkIds = new Map<string, string[]>();
  Object.entries(linkMap).forEach(([linkId, url]) => {
    if (!url) return;
    const key = normalizeCacheKey(url);
    if (!urlToLinkIds.has(key)) {
      urlToLinkIds.set(key, []);
    }
    urlToLinkIds.get(key)!.push(linkId);
  });

  const urls = Array.from(urlToLinkIds.keys());
  if (!urls.length) return;

  const metadataByUrl: Record<string, LinkMetadataResult> = {};
  let nextIndex = 0;
  const workerCount = Math.min(MAX_METADATA_CONCURRENCY, urls.length);

  const createWorker = async () => {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      if (currentIndex >= urls.length) {
        break;
      }
      const url = urls[currentIndex];
      const cached = getCachedServerMetadata(url);
      if (cached) {
        metadataByUrl[url] = cached;
        continue;
      }
      try {
        const metadata = await fetchLinkMetadata(url);
        metadataByUrl[url] = metadata;
        setCachedServerMetadata(url, metadata);
      } catch (error) {
        console.warn(
          '[LinkMetadata] Failed to prefetch metadata for URL:',
          url,
          error instanceof Error ? error.message : error
        );
      }
    }
  };

  await Promise.all(Array.from({ length: workerCount }, () => createWorker()));

  urlToLinkIds.forEach((linkIds, url) => {
    const metadata = metadataByUrl[url];
    if (!metadata) return;
    linkIds.forEach(linkId => {
      const existing = linkMetaMap[linkId] || { url };
      const updatedThumbnail = existing.thumbnail || metadata.image || null;
      const updatedFavicon = existing.favicon || metadata.favicon || null;
      linkMetaMap[linkId] = {
        ...existing,
        metadata,
        thumbnail: updatedThumbnail,
        favicon: updatedFavicon
      };
      if (!thumbnailMap[linkId] && metadata.image) {
        thumbnailMap[linkId] = metadata.image;
      }
    });
  });
};

// Environment variables
dotenv.config({
  path: '.env.local',
  processEnv: {
    SERPAPI_API_KEY: process.env.SERPAPI_API_KEY || '',
    SEARCH_API_KEY: process.env.SEARCH_API_KEY || '',
    SERPER_API_KEY: process.env.SERPER_API_KEY || '',
    TAVILY_API_KEY: process.env.TAVILY_API_KEY || '',
    EXA_API_KEY: process.env.EXA_API_KEY || '',
    GOOGLE_GENERATIVE_AI_API_KEY: process.env.GOOGLE_GENERATIVE_AI_API_KEY || '',
    X_API: process.env.X_API || ''
  }
});

// 🔥 DB에서 채팅 세션의 모든 메시지를 가져오는 헬퍼 함수
// 가상화된 메시지 로딩 문제 해결: 클라이언트가 20개만 로드해도 서버에서는 전체 메시지로 imageMap 구축
async function fetchAllChatMessagesFromDB(chatId: string, userId: string): Promise<any[]> {
  if (!chatId || !userId) {
    console.log('[fetchAllChatMessagesFromDB] Missing chatId or userId, returning empty array');
    return [];
  }
  
  try {
    const { createClient } = await import('@/utils/supabase/server');
    const supabase = await createClient();
    
    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .eq('chat_session_id', chatId)
      .eq('user_id', userId)
      .order('sequence_number', { ascending: true });
    
    if (error) {
      console.error('[fetchAllChatMessagesFromDB] Error fetching messages:', error);
      return [];
    }
    
    console.log('[fetchAllChatMessagesFromDB] Fetched messages from DB:', {
      chatId,
      messageCount: messages?.length || 0
    });
    
    return messages || [];
  } catch (error) {
    console.error('[fetchAllChatMessagesFromDB] Exception:', error);
    return [];
  }
}

// 🔥 DB 메시지에서 이미지 맵을 구축하는 헬퍼 함수
// 🔧 FIX: parts에서 찾은 경우 tool_results를 건너뛰어 중복 카운트 방지
function buildImageMapsFromDBMessages(dbMessages: any[]): {
  imageMap: Map<string, string>;
  generatedImageMap: Map<string, { url: string; path: string }>;
} {
  const imageMap = new Map<string, string>();
  const generatedImageMap = new Map<string, { url: string; path: string }>();
  let uploadedImageIndex = 1;
  let generatedImageIndex = 1;
  
  for (const msg of dbMessages) {
    // 🔧 중복 방지: parts에서 생성된 이미지를 찾았는지 추적
    let foundGeneratedInParts = false;
    
    // 1. experimental_attachments에서 업로드된 이미지 추출
    if (msg.experimental_attachments && Array.isArray(msg.experimental_attachments)) {
      for (const attachment of msg.experimental_attachments) {
        if (attachment.contentType?.startsWith('image/') || attachment.fileType === 'image') {
          const key = `uploaded_image_${uploadedImageIndex++}`;
          imageMap.set(key, attachment.url);
        }
      }
    }
    
    // 2. parts 배열에서 이미지 추출 (PRIMARY SOURCE)
    if (msg.parts && Array.isArray(msg.parts)) {
      for (const part of msg.parts) {
        // 업로드된 파일 이미지
        if (part.type === 'file' && part.mediaType?.startsWith('image/')) {
          if (part.url || part.data) {
            const key = `uploaded_image_${uploadedImageIndex++}`;
            imageMap.set(key, part.url || part.data);
          }
        }
        
        // 생성된 이미지 (tool results)
        const imageToolNames = ['gemini_image_tool', 'seedream_image_tool', 'qwen_image_edit'];
        const isImageToolResult = imageToolNames.some(toolName => 
          part.type === `tool-${toolName}` ||
          (part.type === 'tool-result' && part.toolName === toolName)
        );
        
        if (isImageToolResult && part.state === 'output-available' && part.output) {
          const result = part.output?.value || part.output;
          if (result && result.success !== false) {
            const images = Array.isArray(result) ? result : (result.images || (result.imageUrl ? [result] : []));
            for (const img of images) {
              if (img.imageUrl && img.path) {
                const key = `generated_image_${generatedImageIndex++}`;
                generatedImageMap.set(key, { url: img.imageUrl, path: img.path });
                foundGeneratedInParts = true; // 🔧 parts에서 찾았음을 표시
              }
            }
          }
        }
      }
    }
    
    // 3. content 배열에서 이미지 추출 (레거시 - 업로드 이미지만)
    if (msg.content && Array.isArray(msg.content)) {
      for (const contentItem of msg.content) {
        if (contentItem.type === 'file' && contentItem.mediaType?.startsWith('image/')) {
          const url = contentItem.data || contentItem.url;
          if (url) {
            imageMap.set(`uploaded_image_${uploadedImageIndex++}`, url);
          }
        }
      }
    }
    
    // 4. tool_results에서 이미지 추출 (레거시 - parts에서 못 찾은 경우만!)
    // 🔧 FIX: foundGeneratedInParts가 true면 건너뛰어 중복 방지
    if (!foundGeneratedInParts && msg.tool_results) {
      // Gemini & Seedream 결과
      const results = msg.tool_results.geminiImageResults || msg.tool_results.seedreamImageResults || msg.tool_results.qwenImageResults;
      if (Array.isArray(results)) {
        for (const img of results) {
          if (img.imageUrl && img.path) {
            const key = `generated_image_${generatedImageIndex++}`;
            generatedImageMap.set(key, { url: img.imageUrl, path: img.path });
          }
        }
      }
    }
    
    // 검색 결과 이미지 맵은 항상 처리 (중복 가능성 낮음)
    if (msg.tool_results) {
      const searchResults = [...(msg.tool_results.webSearchResults || []), ...(msg.tool_results.googleSearchResults || [])];
      for (const res of searchResults) {
        if (res.imageMap && typeof res.imageMap === 'object') {
          for (const [imageId, imageUrl] of Object.entries(res.imageMap)) {
            if (typeof imageUrl === 'string') {
              imageMap.set(imageId, imageUrl);
            }
          }
        }
      }
    }
  }
  
  console.log('[buildImageMapsFromDBMessages] Built image maps:', {
    imageMapSize: imageMap.size,
    imageMapKeys: Array.from(imageMap.keys()),
    generatedImageMapSize: generatedImageMap.size,
    generatedImageMapKeys: Array.from(generatedImageMap.keys())
  });
  
  return { imageMap, generatedImageMap };
}

// 도구 설명 및 매개변수 정의
const toolDefinitions = {
  webSearch: {
    description: 'IMPORTANT: Always prefer google_search for general information. Use this tool only for Exa\'s specialized strengths (academic papers, financial reports, GitHub, LinkedIn profiles, PDFs, personal sites). Search the web using Exa for specialized content with multiple queries. This tool automatically optimizes queries. Note: `include_domains` and `exclude_domains` are mutually exclusive. `include_domains` will be prioritized. Use 1-4 queries per tool call. Each query should return at least 5 results.',
    inputSchema: {
      queries: 'Array of search queries to look up on the web. Exa\'s autoprompt feature will optimize these. Use 1-4 queries per tool call. Each query should return at least 5 results.',
      maxResults: 'Array of maximum number of results to return per query. Use 5-10 per query to ensure at least 5 results per query. Default is 10.',
      topics: 'Array of topic types to search for specialized content. Options: financial report, company, research paper, pdf, github, personal site, linkedin profile. Note: "general" and "news" topics removed - use google_search for general information and news. Choose appropriate topics: research papers for academic info, financial reports for business data, company for corporate info, pdf for official documents, github for code/tech, personal site for blogs, linkedin profile for professional info.',
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
  googleSearch: {
    description: 'Search Google using SearchAPI for comprehensive web search results. This tool provides access to Google\'s search index with location and language customization. Supports both web search and image search.',
    inputSchema: {
      queries: 'The search queries to send to Google. Can be a single query string or an array of queries. Each query can be anything you would use in a regular Google search.',
      engines: 'Optional. The search engines to use. Can be a single engine or array matching queries. Options: "google" (web search), "google_images" (image search), "google_videos" (video search). Default is "google".',
      maxResults: 'Optional. Maximum number of results to return per query. For google search, default is 10. For google_images, this parameter is ignored (all images sent to client, LLM context limited to 20). Can be a single number or array matching queries.',
      locations: 'Optional. The locations from where you want the searches to originate (e.g., "New York", "London", "Tokyo"). Can be a single location or array matching queries.',
      gls: 'Optional. The country codes for search results (e.g., "us", "uk", "jp"). Can be a single code or array matching queries. Default is "us".',
      hls: 'Optional. Interface/result language code(s) (e.g. "en", "ko", "ja"). Single value or array matching queries. Default "en" for broader coverage.'
    }
  },
  twitterSearch: {
    description: 'Advanced X (Twitter) search powered by twitterapi.io. Supports the full Twitter advanced search syntax (boolean operators, filters, date ranges, engagement thresholds, geo, lists) and lets you choose between Latest or Top ranking plus cursor-based pagination.',
    inputSchema: {
      query: 'Complete Twitter advanced search query string. Combine operators such as from:, to:, @mentions, hashtags, "exact phrases", (A OR B), -negations, filter:images, lang:, since:/until:, min_faves:, geocode:, list:, etc.',
      queryType: 'Search ranking to target. Use "Latest" for chronological results or "Top" for high-engagement tweets. Default is Latest.',
      cursor: 'Optional pagination cursor returned by the previous response. Pass it to fetch the next page of tweets when has_next_page is true.'
    }
  },
};
// Web Search 도구 생성 함수
export function createWebSearchTool(dataStream: any, forcedTopic?: string) {
  // 검색 결과를 저장할 배열
  const searchResults: any[] = [];
  
  const AllowedTopic = z.enum([
    'general', // Deprecated - use google_search for general information. Kept for backward compatibility.
    // 'news', // 제거됨 - Google Search로 대체
    'financial report',
    'company',
    'research paper',
    'pdf',
    'github',
    'personal site',
    'linkedin profile'
  ]);

  // forcedTopic이 있을 때 topics 파라미터를 스키마에서 완전히 제거
  const baseSchemaFields = {
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
  };

  const webSearchInputSchema = forcedTopic
    ? z.object(baseSchemaFields) // topics 파라미터 제외
    : z.object({
        ...baseSchemaFields,
        // Accept single topic or array; coerce and default to ['general'] if missing (deprecated - use google_search for general info)
        topics: z
          .union([
            z.array(AllowedTopic),
            AllowedTopic
          ])
          .optional()
          .transform((v) => (v === undefined ? ['general'] : Array.isArray(v) ? v : [v]))
          .describe(toolDefinitions.webSearch.inputSchema.topics),
      });

  type WebSearchInput = {
    queries: string[];
    maxResults?: number[];
    topics?: ('general' | /* 'news' | */ 'financial report' | 'company' | 'research paper' | 'pdf' | 'github' | 'personal site' | 'linkedin profile')[]; // optional: forcedTopic이 있을 때는 스키마에 없음
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
    linkMap?: Record<string, string>;
    thumbnailMap?: Record<string, string>;
    titleMap?: Record<string, string>;
    linkMetaMap?: Record<string, LinkMetaEntry>;
    totalImagesFound: number;
  };

  // forcedTopic이 있을 때 description을 동적으로 수정
  const toolDescription = forcedTopic
    ? `CRITICAL: You MUST use only the '${forcedTopic}' topic. Do not use any other topics. The 'topics' parameter is not available - the topic is automatically set to '${forcedTopic}'. ${toolDefinitions.webSearch.description}`
    : toolDefinitions.webSearch.description;

  const webSearchTool = tool<WebSearchInput, WebSearchOutput>({
    description: toolDescription,
    inputSchema: webSearchInputSchema as unknown as z.ZodType<WebSearchInput>,
    execute: async (input: WebSearchInput) => {
      const { queries, maxResults, topics, include_domains, exclude_domains } = input;
      
      // maxResults가 없으면 기본값 설정
      const finalMaxResults = maxResults || Array(queries.length).fill(10);
      
      // 강제로 지정된 토픽이 있으면 해당 토픽만 사용 (topics 파라미터는 무시)
      const finalTopics: ('general' | 'financial report' | 'company' | 'research paper' | 'pdf' | 'github' | 'personal site' | 'linkedin profile')[] = forcedTopic ? 
        Array(queries.length).fill(forcedTopic as any) : 
        (topics || ['general']);
      const apiKey = process.env.EXA_API_KEY;
      if (!apiKey) {
        throw new Error('EXA_API_KEY is not defined in environment variables');
      }
      
      // Generate a unique search ID for this search attempt
      const searchId = `search_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      const exa = new Exa(apiKey);
      
      // 쿼리 중복 상태 알림 방지를 위한 추적 세트
      const annotatedQueries = new Set<string>();
      
              // Execute searches in parallel
        const searchPromises = queries.map(async (query, index) => {
          // 토픽은 try/catch 외부에서 계산하여 양쪽에서 접근 가능하도록 함
          const currentTopic = (finalTopics && finalTopics[index]) || finalTopics[0] || 'general';
          try {
            // 중복 체크 - 이미 처리한 쿼리는 건너뜀
            const queryKey = `${query}-${index}`;
          
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
          }
          
          if (include_domains && include_domains.length > 0) {
            searchOptions.includeDomains = include_domains;
          } else if (exclude_domains && exclude_domains.length > 0) {
            searchOptions.excludeDomains = exclude_domains;
          }
          
          const data = await exa.searchAndContents(query, searchOptions);
          
          const rawResults = data.results
            .map((result: any, resultIndex: number) => {
              const linkId = `exa_link_${searchId}_${index}_${resultIndex}`;
              return {
                url: result.url,
                title: result.title || '',
                content: result.text.text || '',
                publishedDate: result.publishedDate,
                author: result.author,
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
      const linkMetaMap: { [key: string]: LinkMetaEntry } = {};
      
      finalSearches.forEach(search => {
        // Process images
        search.images.forEach((image: any) => {
          if (image.id && image.url) {
            // 이미지 크기 정보가 있으면 URL에 포함시켜 프론트엔드에서 레이아웃 시프트 방지에 사용
            if (image.width && image.height) {
              imageMap[image.id] = `${image.url}#w=${image.width}&h=${image.height}`;
            } else {
              imageMap[image.id] = image.url;
            }
          }
        });
        
        // Process links, thumbnails, and titles
        search.results.forEach((result: any) => {
          if (result.linkId && result.url) {
            linkMap[result.linkId] = result.url;
            const domain = getDomainFromUrl(result.url);
            linkMetaMap[result.linkId] = {
              url: result.url,
              title: result.title,
              summary: result.summary || result.content,
              domain,
              topic: search.topic,
              query: search.query,
              thumbnail: result.thumbnail || null,
              author: result.author || null,
              publishedDate: result.publishedDate || result.published_date || null,
              score: typeof result.score === 'number' ? result.score : null,
              snippetHighlightedWords: result.snippetHighlightedWords || [],
              source: result.source || null,
              favicon: result.favicon || null,
              metadata: null
            };
          }
          if (result.linkId && result.thumbnail) {
            thumbnailMap[result.linkId] = result.thumbnail;
          }
          if (result.url && result.title) {
            titleMap[result.url] = result.title;
          }
        });
      });
      
      await hydrateLinkMetaMapWithMetadata({ linkMap, linkMetaMap, thumbnailMap });
      
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
        linkMetaMap,
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
            titleMap,
            linkMetaMap
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
        
        // Process results
        const processedResults = await Promise.all(
          (searchData.videos || []).slice(0, 10).map(async (video: any): Promise<VideoResult | null> => {
            if (!video.id) {
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
              return baseResult;
            }
          }),
        );
        
        // Filter out null results
        const validResults = processedResults.filter(
          (result): result is VideoResult => result !== null,
        );

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
              result.transcriptError = transcriptError instanceof Error ? transcriptError.message : 'Unknown error';
            }
            
            return result;
          } catch (videoError) {
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
    // Accept string or array; coerce to array
    hls: z
      .union([
        z.array(z.string()),
        z.string()
      ])
      .optional()
      .transform((v) => (v === undefined ? undefined : Array.isArray(v) ? v : [v]))
      .describe(toolDefinitions.googleSearch.inputSchema.hls),
  });

  type GoogleSearchInput = {
    queries: string[];
    engines?: ('google' | 'google_images' | 'google_videos')[];
    maxResults?: number[];
    locations?: string[];
    gls?: string[];
    hls?: string[];
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
    linkMap?: Record<string, string>;
    thumbnailMap?: Record<string, string>;
    titleMap?: Record<string, string>;
    linkMetaMap?: Record<string, LinkMetaEntry>;
    totalImagesFound: number;
    totalVideosFound: number;
    // linkMap: Record<string, string>;
    // thumbnailMap: Record<string, string>;
  };

  const googleSearchTool = tool<GoogleSearchInput, GoogleSearchOutput>({
    description: toolDefinitions.googleSearch.description,
    inputSchema: googleSearchInputSchema as unknown as z.ZodType<GoogleSearchInput>,
    execute: async (input: GoogleSearchInput) => {
      const { queries, engines, maxResults, locations, gls, hls } = input;
      
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
      
      try {
        // Execute searches in parallel (like Web Search)
        const searchPromises = queries.map(async (query, index) => {
          const currentEngine = (finalEngines && finalEngines[index]) || finalEngines?.[0] || 'google';
          const currentMaxResults = (maxResults && maxResults[index]) || maxResults?.[0];
          const currentLocation = (locations && locations[index]) || locations?.[0];
          const currentGl = (gls && gls[index]) || gls?.[0] || 'us';
          const currentHl = (hls && hls[index]) || hls?.[0] || 'en';
          
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
            if (currentHl) {
              searchParams.append('hl', currentHl);
            }
            
            const response = await fetch(`${searchUrl}?${searchParams}`);
            if (!response.ok) {
              throw new Error(`SearchAPI Google search failed: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            
            // Process results based on engine type
            let rawResults: any[] = [];
            let rawImages: any[] = [];
            let rawVideos: any[] = [];
            
            if (currentEngine === 'google_images') {
              // For Google Images, send all images to client but limit LLM context to 20
              const allImages = data.images || [];
              const maxImagesForLLM = 20;
              const limitedImagesForLLM = allImages.slice(0, maxImagesForLLM);
              
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
                  publishedDate: null, // Images typically don't have dates
                  author: image.source?.name || null,
                  score: image.position,
                  summary: image.title || '',
                  linkId: linkId,
                  thumbnail: image.thumbnail || null, // thumbnail is optional
                  isImageResult: true
                };
              });
            } else if (currentEngine === 'google_videos') {
              // For Google Videos, send all videos to client but limit LLM context to 20
              const allVideos = data.videos || [];
              const maxVideosForLLM = 20;
              const limitedVideosForLLM = allVideos.slice(0, maxVideosForLLM);
              
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
                  publishedDate: video.date || null, // date is optional in Google Search API
                  author: video.channel || null,
                  score: video.position,
                  summary: video.snippet || '',
                  linkId: linkId,
                  thumbnail: video.thumbnail || null, // thumbnail is optional
                  isVideoResult: true,
                  length: video.length || null,
                  source: video.source || null
                };
              });

              // For Google Videos, don't collect images
              rawImages = [];
            } else {
              // For regular Google search, process all organic results without limit
              const allOrganicResults = data.organic_results || [];
              
              rawResults = allOrganicResults.map((result: any, resultIndex: number) => {
                const linkId = `google_link_${searchId}_${index}_${resultIndex}`;
                return {
                  url: result.link,
                  title: result.title || '',
                  content: result.snippet || '',
                  publishedDate: result.date || null, // date is optional in Google Search API
                  author: result.source || null,
                  score: result.position,
                  summary: result.snippet || '',
                  linkId: linkId,
                  thumbnail: result.thumbnail || null, // thumbnail is optional in Google Search API
                  snippetHighlightedWords: result.snippet_highlighted_words || [] // highlighted words from Google Search API
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
        const linkMetaMap: { [key: string]: LinkMetaEntry } = {};
        
        searchResultsData.forEach((search, index) => {
          // Process images
          search.images.forEach((image: any) => {
            if (image.id && image.url) {
              // 이미지 크기 정보가 있으면 URL에 포함시켜 프론트엔드에서 레이아웃 시프트 방지에 사용
              if (image.width && image.height) {
                imageMap[image.id] = `${image.url}#w=${image.width}&h=${image.height}`;
              } else {
                imageMap[image.id] = image.url;
              }
            }
          });
          
          // Process links, thumbnails, and titles
          search.results.forEach((result: any) => {
            if (result.linkId && result.url) {
              linkMap[result.linkId] = result.url;
              const domain = getDomainFromUrl(result.url);
              linkMetaMap[result.linkId] = {
                url: result.url,
                title: result.title,
                summary: result.summary || result.content,
                domain,
                topic: search.topic,
                query: search.query,
                thumbnail: result.thumbnail || null,
                author: result.author || null,
                publishedDate: result.publishedDate || result.published_date || null,
                score: typeof result.score === 'number' ? result.score : null,
                snippetHighlightedWords: result.snippetHighlightedWords || [],
                source: result.source || null,
                favicon: result.favicon || null,
                metadata: null
              };
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

        await hydrateLinkMetaMapWithMetadata({ linkMap, linkMetaMap, thumbnailMap });

        const finalResultWithMaps = {
          searchId,
          searches: searchResultsData,
          imageMap,
          linkMap,
          thumbnailMap,
          titleMap,
          linkMetaMap,
          totalImagesFound,
          totalVideosFound
        };

        const finalResultForTool = {
          searchId,
          searches: searchResultsData,
          imageMap,
          totalImagesFound,
          totalVideosFound
        };

        // 배열에 결과 추가 (tool_results 저장용)
        searchResults.push(finalResultWithMaps);
        searchResults.push(finalResultForTool);
        
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
            titleMap,
              linkMetaMap
            }
          });
        }
        
        // 결과 반환
        return finalResultForTool;
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
        const emptySearches = queries.map((query, index) => {
          const currentEngine = (finalEngines && finalEngines[index]) || finalEngines?.[0] || 'google';
          return {
            query,
            topic: currentEngine as 'google' | 'google_images' | 'google_videos',
            engine: currentEngine,
            results: [],
            images: [],
            videos: []
          };
        });

        const emptyResultWithMaps = {
          searchId,
          searches: emptySearches,
          imageMap: {},
          linkMap: {},
          thumbnailMap: {},
          titleMap: {},
          linkMetaMap: {},
          totalImagesFound: 0,
          totalVideosFound: 0
        };

        const emptyResultForTool = {
          searchId,
          searches: emptySearches,
          imageMap: {},
          totalImagesFound: 0,
          totalVideosFound: 0
        };
        
        searchResults.push(emptyResultWithMaps);
        
        // Return empty results
        return emptyResultForTool;
      }
    }
  });
  
  // 기능은 Google 검색 도구지만 저장된 결과 배열도 함께 반환
  return Object.assign(googleSearchTool, { searchResults });
}

export function createTwitterSearchTool(dataStream: any) {
  const searchResults: any[] = [];
  const twitterQueryType = z.enum(['Latest', 'Top']);
  const twitterSearchInputSchema = z.object({
    query: z.string().min(1).describe(toolDefinitions.twitterSearch.inputSchema.query),
    queryType: twitterQueryType
      .optional()
      .default('Latest')
      .describe(toolDefinitions.twitterSearch.inputSchema.queryType),
    cursor: z.string().optional().describe(toolDefinitions.twitterSearch.inputSchema.cursor)
  });

  type TwitterSearchInput = z.infer<typeof twitterSearchInputSchema>;

  const buildTweetPermalink = (tweetId?: string | null, username?: string | null, fallback?: string) => {
    if (fallback) return fallback;
    if (tweetId && username) {
      return `https://twitter.com/${username}/status/${tweetId}`;
    }
    if (tweetId) {
      return `https://twitter.com/i/web/status/${tweetId}`;
    }
    return undefined;
  };

  const collectTweetMedia = (tweet: any, permalink?: string, fallbackPrefix?: string) => {
    const sources = [
      Array.isArray(tweet?.entities?.media) ? tweet.entities.media : [],
      Array.isArray(tweet?.media) ? tweet.media : [],
      Array.isArray(tweet?.attachments?.media?.data) ? tweet.attachments.media.data : [],
      Array.isArray(tweet?.attachments?.media) ? tweet.attachments.media : [],
    ];

    const results: Array<{ id: string; url: string; description?: string; type?: string; sourceLink?: string }> = [];
    const seenIds = new Set<string>();

    sources.flat().forEach((item: any, index: number) => {
      if (!item) return;
      const url = item.media_url_https || item.media_url || item.url || item.src || item.preview_image_url;
      if (!url) return;
      const id = item.media_key || item.id || item.mediaId || `${fallbackPrefix || 'tweet_media'}_${index}`;
      if (seenIds.has(id)) return;
      seenIds.add(id);
      const protocolUrl = ensureUrlProtocol(url);
      if (!protocolUrl) return;
      results.push({
        id,
        url: protocolUrl,
        description: item.alt_text || item.description || undefined,
        type: item.type || undefined,
        sourceLink: permalink
      });
    });

    return results;
  };

  const normalizeTweet = (tweet: any, fallbackIndex: number) => {
    const tweetId =
      tweet?.id ||
      tweet?.tweet_id ||
      tweet?.tweetId ||
      tweet?.conversationId ||
      tweet?.conversation_id ||
      `tweet_${fallbackIndex}`;

    const author = tweet?.author || tweet?.user || tweet?.user_info || {};
    const username =
      author?.userName ||
      author?.username ||
      author?.screen_name ||
      author?.handle ||
      author?.user_name ||
      undefined;

    const permalink = buildTweetPermalink(tweetId, username, tweet?.url || tweet?.permalink);
    const profileImage = ensureUrlProtocol(
      author?.profilePicture || author?.profile_image_url_https || author?.profile_image_url || author?.avatar,
    );
    const metricsSource = tweet?.metrics || tweet?.public_metrics || {};

    // NOTE:
    // - We intentionally keep this normalized structure lean.
    // - Large raw API payloads are NOT stored here to avoid bloating AI tool context.
    return {
      tweetId: tweetId?.toString(),
      url: permalink,
      text: tweet?.text || tweet?.full_text || tweet?.content || '',
      lang: tweet?.lang || tweet?.language || null,
      createdAt: tweet?.createdAt || tweet?.created_at || tweet?.date || tweet?.datetime || null,
      source: tweet?.source,
      conversationId: tweet?.conversationId || tweet?.conversation_id || null,
      inReplyToId: tweet?.inReplyToId || tweet?.in_reply_to_status_id || null,
      isReply: tweet?.isReply ?? Boolean(tweet?.inReplyToId || tweet?.in_reply_to_status_id),
      author: {
        id: author?.id || author?.user_id || null,
        username,
        name: author?.name || author?.fullname || null,
        verifiedType: author?.verifiedType || author?.verified_type || null,
        profileImage,
        profileUrl: username ? `https://twitter.com/${username}` : undefined,
        // Follower/following counts are omitted for token efficiency; rarely needed for reasoning.
      },
      metrics: {
        retweets: tweet?.retweetCount ?? tweet?.retweet_count ?? metricsSource?.retweet_count ?? null,
        replies: tweet?.replyCount ?? tweet?.reply_count ?? metricsSource?.reply_count ?? null,
        likes: tweet?.likeCount ?? tweet?.favorite_count ?? metricsSource?.like_count ?? null,
        quotes: tweet?.quoteCount ?? metricsSource?.quote_count ?? null,
        bookmarks: tweet?.bookmarkCount ?? null,
        views: tweet?.viewCount ?? tweet?.views ?? metricsSource?.view_count ?? null,
      },
      media: collectTweetMedia(tweet, permalink, tweetId),
    };
  };

  const twitterSearchTool = tool<TwitterSearchInput, any>({
    description: toolDefinitions.twitterSearch.description,
    inputSchema: twitterSearchInputSchema as unknown as z.ZodType<TwitterSearchInput>,
    execute: async ({ query, queryType = 'Latest', cursor }: TwitterSearchInput) => {
      const apiKey = process.env.X_API;
      if (!apiKey) {
        throw new Error('X_API is not defined in environment variables');
      }

      const searchId = `twitter_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

      if (dataStream?.write) {
        dataStream.write({
          type: 'data-twitter_search_started',
          id: `ann-twitter-start-${searchId}`,
          data: {
            searchId,
            query,
            queryType,
            cursor: cursor || null,
            timestamp: new Date().toISOString()
          }
        });
      }

      const params = new URLSearchParams({ query, queryType });
      if (cursor) {
        params.set('cursor', cursor);
      }

      const endpoint = `https://api.twitterapi.io/twitter/tweet/advanced_search?${params.toString()}`;

      try {
        const response = await fetch(endpoint, {
          headers: {
            'X-API-Key': apiKey
          }
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => '');
          throw new Error(`Twitter advanced search failed: ${response.status} ${response.statusText} ${errorText}`.trim());
        }

        const responseData = await response.json();

        const tweets = Array.isArray(responseData?.tweets) ? responseData.tweets : [];
        const hasNextPage = Boolean(responseData?.has_next_page);
        const nextCursor = responseData?.next_cursor || null;

        const normalizedTweets = tweets.map((tweet: any, index: number) => {
          return normalizeTweet(tweet, index);
        });

        const formatAuthor = (author: { name?: string | null; username?: string | undefined | null }) => {
          if (author?.name && author?.username) {
            return `${author.name} (@${author.username})`;
          }
          if (author?.username) {
            return `@${author.username}`;
          }
          return author?.name || 'Tweet';
        };

        const aggregatedImages: any[] = [];
        normalizedTweets.forEach((tweet: any, tweetIndex: number) => {
          tweet.media.forEach((media: any, mediaIndex: number) => {
            if (media?.url) {
              aggregatedImages.push({
                id: media.id,
                url: media.url,
                description: media.description || media.type || `Image from ${formatAuthor(tweet.author)}`,
                sourceLink: tweet.url
              });
            }
          });
        });

        const results = normalizedTweets.map((tweet: any, index: number) => {
          const linkId = tweet.tweetId ? `twitter_link_${tweet.tweetId}` : `twitter_link_${searchId}_${index}`;
          const publishedDate = tweet.createdAt || null;
          const authorLabel = formatAuthor(tweet.author);

          // Compact per-tweet payload exposed to the AI:
          // - Keeps all behavior needed by prompts (IDs, text, metrics, media, timestamps)
          // - Avoids embedding the full raw Twitter API response.
          const result = {
            // Core link identity (used for LINK_ID:twitter_link_... embedding)
            linkId,
            url: tweet.url || undefined,

            // Human-readable title/author used in UI and summaries
            title: `${authorLabel}${publishedDate ? ` · ${publishedDate}` : ''}`,
            author: authorLabel,

            // Tweet text (kept in the same fields used by other search tools)
            summary: tweet.text,
            content: tweet.text,
            raw_content: tweet.text,

            // Basic metadata
            published_date: publishedDate,
            publishedDate,
            topic: 'twitter',
            topicIcon: 'twitter',
            source: 'twitter',
            thumbnail: tweet.author?.profileImage || null,

            // Tweet identifiers & structure
            tweetId: tweet.tweetId,
            lang: tweet.lang,
            createdAt: tweet.createdAt,
            isReply: tweet.isReply,
            conversationId: tweet.conversationId,
            inReplyToId: tweet.inReplyToId,

            // Author summary for reasoning (kept minimal)
            authorInfo: tweet.author
              ? {
                  id: tweet.author.id ?? null,
                  username: tweet.author.username,
                  name: tweet.author.name,
                  verifiedType: tweet.author.verifiedType ?? null,
                  profileImage: tweet.author.profileImage,
                  profileUrl: tweet.author.profileUrl,
                }
              : null,

            // Engagement metrics (needed for prompt scenarios like \"high engagement\" or \"popular takes\")
            metrics: tweet.metrics,

            // Media summary (URLs + basic description)
            media: tweet.media,
          };

          return result;
        });

        const searchEntry = {
          query,
          queryType,
          cursor: cursor || null,
          nextCursor,
          hasNextPage,
          topic: 'twitter',
          topicIcon: 'twitter',
          engine: 'twitter',
          results,
          images: aggregatedImages
        };

        const linkMap: Record<string, string> = {};

        searchEntry.results.forEach((result: any, index: number) => {
          if (result.linkId && result.url) {
            linkMap[result.linkId] = result.url;
          }
        });

        const finalResult = {
          searchId,
          searches: [searchEntry],
          linkMap
        };

        searchResults.push(finalResult);

        if (dataStream?.write) {
          dataStream.write({
            type: 'data-twitter_search_complete',
            id: `ann-twitter-complete-${searchId}`,
            data: {
              searchId,
              searches: [searchEntry],
              linkMap
            }
          });
        }

        return finalResult;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown Twitter search error';

        if (dataStream?.write) {
          dataStream.write({
            type: 'data-twitter_search_error',
            id: `ann-twitter-error-${Date.now()}`,
            data: {
              query,
              queryType,
              cursor: cursor || null,
              error: message,
              timestamp: new Date().toISOString()
            }
          });
        }

        throw error;
      }
    }
  });

  return Object.assign(twitterSearchTool, { searchResults });
}

// Gemini 이미지 생성/편집 도구 생성 함수
// 🔥 chatId 추가: 가상화된 메시지 로딩 문제 해결 - DB에서 전체 메시지 가져옴
export function createGeminiImageTool(dataStream?: any, userId?: string, allMessages: any[] = [], chatId?: string) {
  // 생성된 이미지 추적
  const generatedImages: Array<{
    imageUrl: string;
    prompt: string;
    timestamp: string;
    originalImageUrl?: string;
    isEdit?: boolean;
    path?: string;
    bucket?: string;
    generatedBy?: string;
  }> = [];

  // 🔥 이미지 맵은 실행 시점에 빌드됨 (lazy initialization)
  let imageMap: Map<string, string> | null = null;
  let generatedImageMap: Map<string, { url: string, path: string }> | null = null;
  let imageMapsInitialized = false;
  let generatedImageIndex = 1;
  
  // 🔥 이미지 맵 초기화 함수
  async function ensureImageMapsInitialized() {
    if (imageMapsInitialized) return;
    
    // chatId와 userId가 있으면 DB에서 전체 메시지 가져오기
    if (chatId && userId) {
      const dbMessages = await fetchAllChatMessagesFromDB(chatId, userId);
      
      // 🔥 병합 로직: DB 메시지 + 현재 요청의 메시지들(allMessages) 중 DB에 없는 것
      let messagesToProcess = dbMessages;
      if (allMessages.length > 0) {
        const dbMessageIds = new Set(dbMessages.map(m => m.id).filter(Boolean));
        const newMessages = allMessages.filter(m => m.id && !dbMessageIds.has(m.id));
        if (newMessages.length > 0) {
           messagesToProcess = [...dbMessages, ...newMessages];
        } else if (dbMessages.length === 0) {
           messagesToProcess = allMessages;
        }
      }

      if (messagesToProcess.length > 0) {
        const maps = buildImageMapsFromDBMessages(messagesToProcess);
        imageMap = maps.imageMap;
        generatedImageMap = maps.generatedImageMap;
        generatedImageIndex = generatedImageMap.size + 1;
        imageMapsInitialized = true;
        console.log(`[GEMINI_IMAGE] Image maps built: ${imageMap.size} uploads, ${generatedImageMap.size} generations`);
        return;
      }
    }
    
    // Fallback: 클라이언트에서 전달받은 메시지 사용
    imageMap = new Map<string, string>();
    generatedImageMap = new Map<string, { url: string, path: string }>();
    let uploadedImageIndex = 1;
    generatedImageIndex = 1;
    
    for (const message of allMessages) {
      let foundInParts = false;

      if (message.experimental_attachments && Array.isArray(message.experimental_attachments)) {
        for (const attachment of message.experimental_attachments) {
          if (attachment.contentType?.startsWith('image/') || attachment.fileType === 'image') {
            imageMap.set(`uploaded_image_${uploadedImageIndex++}`, attachment.url);
          }
        }
      }
      
      if (message.parts && Array.isArray(message.parts)) {
        for (const part of message.parts) {
          if (part.type === 'file' && part.mediaType?.startsWith('image/')) {
            if (part.url || part.data) {
              imageMap.set(`uploaded_image_${uploadedImageIndex++}`, part.url || part.data);
            }
          }
          
          const imageToolNames = ['gemini_image_tool', 'seedream_image_tool', 'qwen_image_edit'];
          const isImageToolResult = imageToolNames.some(toolName => 
            part.type === `tool-${toolName}` ||
            (part.type === 'tool-result' && part.toolName === toolName)
          );
          
          if (isImageToolResult && part.state === 'output-available' && part.output) {
            const result = part.output?.value || part.output;
            if (result && result.success !== false) {
              const images = Array.isArray(result) ? result : (result.images || (result.imageUrl ? [result] : []));
              for (const img of images) {
                if (img.imageUrl && img.path) {
                  generatedImageMap.set(`generated_image_${generatedImageIndex++}`, { url: img.imageUrl, path: img.path });
                  foundInParts = true;
                }
              }
            }
          }
        }
      }
      
      if (!foundInParts) {
        if (message.content && Array.isArray(message.content)) {
          for (const contentItem of message.content) {
            if (contentItem.type === 'file' && contentItem.mediaType?.startsWith('image/')) {
              const url = contentItem.data || contentItem.url;
              if (url) {
                imageMap.set(`uploaded_image_${uploadedImageIndex++}`, url);
              }
            }
          }
        }
        
        if (message.tool_results) {
          const results = message.tool_results.geminiImageResults || message.tool_results.seedreamImageResults || message.tool_results.qwenImageResults;
          if (Array.isArray(results)) {
            for (const img of results) {
              if (img.imageUrl && img.path) {
                generatedImageMap.set(`generated_image_${generatedImageIndex++}`, { url: img.imageUrl, path: img.path });
              }
            }
          }
          
          const searchResults = [...(message.tool_results.webSearchResults || []), ...(message.tool_results.googleSearchResults || [])];
          for (const res of searchResults) {
            if (res.imageMap && typeof res.imageMap === 'object') {
              for (const [imageId, imageUrl] of Object.entries(res.imageMap)) {
                if (typeof imageUrl === 'string') {
                  imageMap.set(imageId, imageUrl);
                }
              }
            }
          }
        }
      }
    }
    imageMapsInitialized = true;
  }

  // Supabase 업로드 헬퍼
  async function uploadImageToSupabase(uint8Array: Uint8Array, userId: string): Promise<{ path: string, url: string }> {
    const { createClient } = await import('@/utils/supabase/server');
    const supabase = await createClient();
    
    const fileName = `gemini_${Date.now()}_${Math.random().toString(36).slice(2)}.png`;
    const filePath = `${userId}/${fileName}`;
    
    const { data, error } = await supabase.storage
      .from('generated-images')
      .upload(filePath, uint8Array, { contentType: 'image/png' });
    
    if (error) {
      throw new Error(`Failed to upload image: ${error.message}`);
    }
    
    // Create signed URL for private bucket
    const { data: signedData, error: signedError } = await supabase.storage
      .from('generated-images')
      .createSignedUrl(filePath, 24 * 60 * 60); // 24 hours
    
    if (signedError || !signedData?.signedUrl) {
      throw new Error(`Failed to create signed URL: ${signedError?.message || 'Unknown error'}`);
    }
    
    return { path: filePath, url: signedData.signedUrl };
  }

  const geminiImageInputSchema = z.object({
    prompt: z.string().describe('Text description for image generation or editing instructions'),
    editImageUrl: z.union([
      z.string(), 
      z.array(z.string()),
      z.null()
    ]).optional().describe('Image reference(s): For user-uploaded images use "uploaded_image_N" (e.g., uploaded_image_1). For previously generated Gemini images, use "generated_image_N" (e.g., generated_image_1). For search images from web_search or google_search, use "search_img_XXX" or "google_img_XXX" (exact ID from search results). Can be a single string or array of up to 14 images.'),
    aspectRatio: z.enum(['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9', 'match_input_image']).optional().describe('Image aspect ratio. Use "match_input_image" when editing user-uploaded images to preserve original proportions. Otherwise, choose based on content type: 1:1 for social media/square, 16:9 for landscape/presentations, 9:16 for mobile/stories, 3:4 or 4:3 for portraits, 21:9 for cinematic. Default is 1:1.'),
    imageSize: z.enum(['1K', '2K', '4K']).optional().describe('Image resolution. 1K (default): fast iterations, general purpose. 2K: presentations, web graphics. 4K: final deliverables, print materials, professional portfolios. Token usage: 1K/2K = 1210 tokens, 4K = 2000 tokens.')
  });

  type GeminiImageInput = z.infer<typeof geminiImageInputSchema>;

  const geminiImageTool = tool<GeminiImageInput, unknown>({
    description: 'Generate and edit images using Google Gemini 3 Pro Image Preview model with configurable aspect ratios and resolutions (1K, 2K, 4K). Can create new images from text prompts or edit existing images with natural language instructions. Supports up to 14 input images, high-resolution output, Google search integration for real-time data, and advanced thinking mode for complex prompts.',
    inputSchema: geminiImageInputSchema,
    execute: async ({ prompt, editImageUrl, aspectRatio, imageSize }: GeminiImageInput) => {
      try {
        // 🔥 이미지 맵 초기화 (DB에서 전체 메시지 가져옴)
        await ensureImageMapsInitialized();
        
        // 🔥 이미지 참조를 실제 URL로 변환 (단일 또는 배열)
        let actualEditImageUrls: string[] = [];
        
        if (editImageUrl) {
          const urlsToResolve = Array.isArray(editImageUrl) ? editImageUrl : [editImageUrl];
          
          for (const url of urlsToResolve) {
            if (url.startsWith('uploaded_image_')) {
              const resolvedUrl = imageMap?.get(url);
              if (resolvedUrl) {
                actualEditImageUrls.push(await resolveUploadedImageUrl(resolvedUrl));
              } else {
                throw new Error(`Image reference "${url}" not found in conversation history`);
              }
            } else if (url.startsWith('generated_image_')) {
              // Generated image reference
              const imgData = generatedImageMap?.get(url);
              if (imgData) {
                actualEditImageUrls.push(await resolveGeneratedImageUrl(imgData));
              } else {
                throw new Error(`Generated image reference "${url}" not found in conversation history`);
              }
            } else if (url.startsWith('search_img_') || url.startsWith('google_img_')) {
              // Search image reference (from web_search or google_search)
              const resolvedUrl = imageMap?.get(url);
              if (resolvedUrl) {
                actualEditImageUrls.push(resolvedUrl);
              } else {
                throw new Error(`Search image reference "${url}" not found in conversation history`);
              }
            } else {
              actualEditImageUrls.push(url); // Direct URL (for backward compatibility)
            }
          }
        }

        // 🛠️ Simple Mapping Log
        logImageMapping('GEMINI_IMAGE', prompt, editImageUrl, actualEditImageUrls);

        // 이미지 생성/편집 시작 신호 전송 (해결된 URL 포함)
        if (dataStream) {
          dataStream.write({
            type: 'data-gemini_image_started',
            id: `ann-gemini-start-${Date.now()}`,
            data: {
              prompt,
              editImageUrl,
              resolvedEditImageUrl: actualEditImageUrls.length > 0 ? (actualEditImageUrls.length === 1 ? actualEditImageUrls[0] : actualEditImageUrls) : undefined,
              started: true
            }
          });
        }

        // Initialize Google Generative AI client
        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!);
        const model = genAI.getGenerativeModel({ model: 'gemini-3-pro-image-preview' });

        let result;
        
        if (actualEditImageUrls.length > 0) {
          // 편집 모드: 기존 이미지 URL(들)에서 로드
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

          const generationConfig: any = {
            response_modalities: ['Text', 'Image']
          };
          let finalAspectRatio = aspectRatio;
          
          // match_input_image 처리: 입력 이미지 비율 계산
          if (aspectRatio === 'match_input_image' && actualEditImageUrls.length > 0) {
            try {
              const sharp = (await import('sharp')).default;
              const firstImageBuffer = Buffer.from(await (await fetch(actualEditImageUrls[0])).arrayBuffer());
              const metadata = await sharp(firstImageBuffer).metadata();
              
              if (metadata.width && metadata.height) {
                const imageRatio = metadata.width / metadata.height;
                
                // 가장 가까운 지원되는 aspect ratio 찾기
                const supportedRatios: Array<[string, number]> = [
                  ['1:1', 1.0],
                  ['4:5', 0.8],
                  ['3:4', 0.75],
                  ['2:3', 0.667],
                  ['9:16', 0.5625],
                  ['5:4', 1.25],
                  ['4:3', 1.333],
                  ['3:2', 1.5],
                  ['16:9', 1.778],
                  ['21:9', 2.333]
                ];
                
                let closestRatio = '1:1';
                let minDiff = Infinity;
                
                for (const [ratio, value] of supportedRatios) {
                  const diff = Math.abs(imageRatio - value);
                  if (diff < minDiff) {
                    minDiff = diff;
                    closestRatio = ratio;
                  }
                }
                
                finalAspectRatio = closestRatio as '1:1' | '2:3' | '3:2' | '3:4' | '4:3' | '4:5' | '5:4' | '9:16' | '16:9' | '21:9';
              }
            } catch (error) {
              finalAspectRatio = '1:1';
            }
          }
          
          // Image config 설정
          const finalImageSize = imageSize || '1K';
          generationConfig.imageConfig = {
            aspectRatio: finalAspectRatio || '1:1',
            imageSize: finalImageSize
          };

          result = await model.generateContent({
            contents: [{ role: 'user', parts: contentParts }],
            generationConfig,
            tools: [{"google_search": {}}] as any  // Google 검색 도구 기본 탑재, 모델이 필요할 때 자동 사용
          } as any);
        } else {
          // 생성 모드: 새 이미지 생성
          const contentParts = [{ text: prompt }];

          const generationConfig: any = {
            response_modalities: ['Text', 'Image']
          };
          
          // 생성 모드에서는 match_input_image가 의미 없으므로 기본값 사용
          const finalAspectRatio = aspectRatio === 'match_input_image' ? '1:1' : (aspectRatio || '1:1');
          
          // Image config 설정
          const finalImageSize = imageSize || '1K';
          generationConfig.imageConfig = {
            aspectRatio: finalAspectRatio,
            imageSize: finalImageSize
          };

          result = await model.generateContent({
            contents: [{ role: 'user', parts: contentParts }],
            generationConfig,
            tools: [{"google_search": {}}] as any  // Google 검색 도구 기본 탑재, 모델이 필요할 때 자동 사용
          } as any);
        }

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

        
        // Supabase에 업로드 (새 private bucket 사용)
        const { path, url } = await uploadImageToSupabase(imageData, userId || 'anonymous');
        
        // 생성된 이미지 추적
        generatedImageMap?.set(`generated_image_${generatedImageIndex}`, { url, path });
        generatedImageIndex++;
        
        // 도구 결과에 URL 저장 (스트리밍 시 프롬프트 모달에서 소스 이미지 표시를 위해 originalImageUrl 단수 필드도 포함)
        const imageResult = {
          imageUrl: url,
          path: path,  // NEW: Store path for URL refresh
          bucket: 'generated-images',  // NEW: Store bucket name
          prompt,
          timestamp: new Date().toISOString(),
          generatedBy: 'gemini',
          ...(actualEditImageUrls.length > 0 && { 
            originalImageUrls: actualEditImageUrls, 
            originalImageUrl: actualEditImageUrls[0],
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
          imageUrl: url,
          path: path,
          prompt,
          textResponse, // Include text in AI context
          isEdit: actualEditImageUrls.length > 0,
          isComposition: actualEditImageUrls.length > 1,
          originalImageUrls: actualEditImageUrls
        };

      } catch (error) {
        // 디버깅 로그 출력
        console.error('[GEMINI_IMAGE] Error:', {
          error: error instanceof Error ? error.message : 'Unknown error',
          errorStack: error instanceof Error ? error.stack : undefined,
          prompt,
          editImageUrl,
          userId
        });
        
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

// Seedream 4.5 이미지 생성/편집 도구 생성 함수
// 🔥 chatId 추가: 가상화된 메시지 로딩 문제 해결 - DB에서 전체 메시지 가져옴
export function createSeedreamImageTool(dataStream?: any, userId?: string, allMessages: any[] = [], chatId?: string) {
  
  const generatedImages: Array<{
    imageUrl: string;
    prompt: string;
    timestamp: string;
    originalImageUrl?: string;
    isEdit?: boolean;
    size?: string;
    aspectRatio?: string;
    path?: string;
    bucket?: string;
    generatedBy?: string;
  }> = [];

  // 🔥 이미지 맵은 실행 시점에 빌드됨 (lazy initialization)
  // chatId가 제공되면 DB에서 전체 메시지를 가져와서 사용
  let imageMap: Map<string, string> | null = null;
  let generatedImageMap: Map<string, { url: string, path: string }> | null = null;
  let imageMapsInitialized = false;
  
  // 🔥 새로 생성되는 이미지의 인덱스 (초기화 후 맵 크기 기반으로 설정)
  let generatedImageIndex = 1;
  
  // 🔥 이미지 맵 초기화 함수 (lazy - 실제로 이미지 참조가 필요할 때만 호출)
  async function ensureImageMapsInitialized() {
    if (imageMapsInitialized) return;
    
    console.log('[SEEDREAM_DEBUG] Initializing image maps...', {
      chatId,
      userId,
      allMessagesCount: allMessages.length
    });
    
    // chatId와 userId가 있으면 DB에서 전체 메시지 가져오기
    if (chatId && userId) {
      console.log('[SEEDREAM_DEBUG] Fetching all messages from DB for complete image map...');
      const dbMessages = await fetchAllChatMessagesFromDB(chatId, userId);
      
      // 🔥 병합 로직: DB 메시지 + 현재 요청의 메시지들(allMessages) 중 DB에 없는 것
      let messagesToProcess = dbMessages;
      if (allMessages.length > 0) {
        const dbMessageIds = new Set(dbMessages.map(m => m.id).filter(Boolean));
        const newMessages = allMessages.filter(m => m.id && !dbMessageIds.has(m.id));
        if (newMessages.length > 0) {
           console.log('[SEEDREAM_DEBUG] Merging new messages not in DB:', newMessages.length);
           messagesToProcess = [...dbMessages, ...newMessages];
        } else if (dbMessages.length === 0) {
           messagesToProcess = allMessages;
        }
      }
      
      if (messagesToProcess.length > 0) {
        const maps = buildImageMapsFromDBMessages(messagesToProcess);
        imageMap = maps.imageMap;
        generatedImageMap = maps.generatedImageMap;
        // 새 이미지 인덱스는 기존 맵 크기 + 1
        generatedImageIndex = generatedImageMap.size + 1;
        imageMapsInitialized = true;
        console.log(`[SEEDREAM_IMAGE] Image maps built: ${imageMap.size} uploads, ${generatedImageMap.size} generations`);
        return;
      }
    }
    
    // Fallback: 클라이언트에서 전달받은 메시지 사용
    console.log('[SEEDREAM_DEBUG] Falling back to client messages for image map');
    imageMap = new Map<string, string>();
    generatedImageMap = new Map<string, { url: string, path: string }>();
    let uploadedImageIndex = 1;
    // 🔥 outer scope의 generatedImageIndex를 사용 (1로 시작)
    generatedImageIndex = 1;
    
    for (const message of allMessages) {
      let foundInParts = false;

      if (message.experimental_attachments && Array.isArray(message.experimental_attachments)) {
        for (const attachment of message.experimental_attachments) {
          if (attachment.contentType?.startsWith('image/') || attachment.fileType === 'image') {
            const key = `uploaded_image_${uploadedImageIndex++}`;
            imageMap.set(key, attachment.url);
          }
        }
      }
      
      if (message.parts && Array.isArray(message.parts)) {
        for (const part of message.parts) {
          if (part.type === 'file' && part.mediaType?.startsWith('image/')) {
            if (part.url || part.data) {
              const key = `uploaded_image_${uploadedImageIndex++}`;
              imageMap.set(key, part.url || part.data);
            }
          }
          
          const imageToolNames = ['gemini_image_tool', 'seedream_image_tool', 'qwen_image_edit'];
          const isImageToolResult = imageToolNames.some(toolName => 
            part.type === `tool-${toolName}` ||
            (part.type === 'tool-result' && part.toolName === toolName)
          );
          
          if (isImageToolResult && part.state === 'output-available' && part.output) {
            const result = part.output?.value || part.output;
            if (result && result.success !== false) {
              const images = Array.isArray(result) ? result : (result.images || (result.imageUrl ? [result] : []));
              for (const img of images) {
                if (img.imageUrl && img.path) {
                  const key = `generated_image_${generatedImageIndex++}`;
                  generatedImageMap.set(key, { url: img.imageUrl, path: img.path });
                  foundInParts = true;
                }
              }
            }
          }
        }
      }
      
      if (!foundInParts) {
        if (message.content && Array.isArray(message.content)) {
          for (const contentItem of message.content) {
            if (contentItem.type === 'file' && contentItem.mediaType?.startsWith('image/')) {
              const url = contentItem.data || contentItem.url;
              if (url) {
                imageMap.set(`uploaded_image_${uploadedImageIndex++}`, url);
              }
            }
          }
        }
        
        if (message.tool_results) {
          const results = message.tool_results.geminiImageResults || message.tool_results.seedreamImageResults || message.tool_results.qwenImageResults;
          if (Array.isArray(results)) {
            for (const img of results) {
              if (img.imageUrl && img.path) {
                const key = `generated_image_${generatedImageIndex++}`;
                generatedImageMap.set(key, { url: img.imageUrl, path: img.path });
              }
            }
          }
          
          const searchResults = [...(message.tool_results.webSearchResults || []), ...(message.tool_results.googleSearchResults || [])];
          for (const res of searchResults) {
            if (res.imageMap && typeof res.imageMap === 'object') {
              for (const [imageId, imageUrl] of Object.entries(res.imageMap)) {
                if (typeof imageUrl === 'string') {
                  imageMap.set(imageId, imageUrl);
                }
              }
            }
          }
        }
      }
    }
    
    imageMapsInitialized = true;
    console.log('[SEEDREAM_DEBUG] Image maps initialized from client messages:', {
      imageMapSize: imageMap.size,
      imageMapKeys: Array.from(imageMap.keys()),
      generatedImageMapSize: generatedImageMap.size,
      generatedImageMapKeys: Array.from(generatedImageMap.keys())
    });
  }

  const seedreamImageInputSchema = z.object({
    prompt: z.string().describe('Text description for image generation or editing instructions'),
    editImageUrl: z.union([
      z.string(), 
      z.array(z.string()),
      z.null()
    ]).optional().describe('Image reference(s): For user-uploaded images use "uploaded_image_N" (e.g., uploaded_image_1). For previously generated Seedream images, use "generated_image_N" (e.g., generated_image_1). For search images from web_search or google_search, use "search_img_XXX" or "google_img_XXX" (exact ID from search results). Can be a single string or array of up to 10 images.'),
    size: z.enum(['1K', '2K', '4K', 'custom']).optional().describe('Image resolution: 1K (1024px), 2K (2048px), 4K (4096px), or custom dimensions. Default: 2K'),
    aspectRatio: z.string().optional().describe('Image aspect ratio. For editing: defaults to "match_input_image" (auto-preserves input ratio). For generation or override: use "1:1", "16:9", "9:16", "4:3" etc. Combined with size to calculate output dimensions.'),
    width: z.number().min(1024).max(4096).optional().describe('Custom image width (only used when size is "custom")'),
    height: z.number().min(1024).max(4096).optional().describe('Custom image height (only used when size is "custom")')
  });

  type SeedreamImageInput = z.infer<typeof seedreamImageInputSchema>;

  const seedreamImageTool = tool<SeedreamImageInput, unknown>({
    description: 'Generate and edit images using ByteDance Seedream 4.5 model via AtlasCloud. Supports up to 4K resolution (1K/2K/4K), custom aspect ratios, and multi-image composition (up to 10 input images for editing).',
    inputSchema: seedreamImageInputSchema,
    execute: async ({ prompt, editImageUrl, size, aspectRatio, width, height }: SeedreamImageInput) => {
      try {
        // 🔥 이미지 맵 초기화 (DB에서 전체 메시지 가져옴)
        await ensureImageMapsInitialized();
        
        // 🔍 DEBUG: editImageUrl이 JSON 문자열인지 확인
        if (editImageUrl && typeof editImageUrl === 'string' && editImageUrl.trim().startsWith('[') && editImageUrl.trim().endsWith(']')) {
          try {
            const parsed = JSON.parse(editImageUrl);
            if (Array.isArray(parsed)) {
              editImageUrl = parsed as any; // 타입 캐스팅하여 재할당
            }
          } catch (e) {
            // Silence errors
          }
        }

        // 🔥 이미지 참조를 실제 URL로 변환 (단일 또는 배열)
        let actualEditImageUrls: string[] = [];
        
        if (editImageUrl) {
          const urlsToResolve = Array.isArray(editImageUrl) ? editImageUrl : [editImageUrl];
          
          for (const url of urlsToResolve) {
            if (url.startsWith('uploaded_image_')) {
              const resolvedUrl = imageMap?.get(url);
              if (resolvedUrl) {
                actualEditImageUrls.push(await resolveUploadedImageUrl(resolvedUrl));
              } else {
                throw new Error(`Image reference "${url}" not found in conversation history`);
              }
            } else if (url.startsWith('generated_image_')) {
              // Generated image reference (always resolve fresh URL when path exists to avoid expired JWT)
              const imgData = generatedImageMap?.get(url);
              if (imgData) {
                const finalUrl = await resolveGeneratedImageUrl(imgData);
                if (finalUrl) {
                  actualEditImageUrls.push(finalUrl);
                  if (imgData.path && finalUrl !== imgData.url) {
                    generatedImageMap?.set(url, { url: finalUrl, path: imgData.path });
                  }
                } else {
                  throw new Error(`Generated image reference "${url}" has no valid URL`);
                }
              } else {
                throw new Error(`Generated image reference "${url}" not found in conversation history`);
              }
            } else if (url.startsWith('search_img_') || url.startsWith('google_img_')) {
              // Search image reference (from web_search or google_search)
              const resolvedUrl = imageMap?.get(url);
              if (resolvedUrl) {
                actualEditImageUrls.push(resolvedUrl);
              } else {
                throw new Error(`Search image reference "${url}" not found in conversation history`);
              }
            } else {
              actualEditImageUrls.push(url); // Direct URL (for backward compatibility)
            }
          }
        }

        // 🛠️ Simple Mapping Log
        logImageMapping('SEEDREAM_IMAGE', prompt, editImageUrl, actualEditImageUrls);

        // 이미지 생성/편집 시작 신호 전송 (해결된 URL 포함)
        if (dataStream) {
          dataStream.write({
            type: 'data-seedream_image_started',
            id: `ann-seedream-start-${Date.now()}`,
            data: {
              prompt,
              editImageUrl,
              resolvedEditImageUrl: actualEditImageUrls.length > 0 ? (actualEditImageUrls.length === 1 ? actualEditImageUrls[0] : actualEditImageUrls) : undefined,
              size,
              aspectRatio,
              started: true
            }
          });
        }

        // AtlasCloud API 호출
        const ATLASCLOUD_API_BASE = 'https://api.atlascloud.ai/api/v1';
        const ATLASCLOUD_POLL_INTERVAL = 2000; // 2초
        const ATLASCLOUD_MAX_POLL_TIME = 120000; // 2분

        // base64 이미지에서 크기 추출하는 함수
        const getImageDimensionsFromBase64 = (dataUri: string): { width: number; height: number } | null => {
          try {
            // data:image/png;base64,xxx 형식에서 base64 추출
            const base64Match = dataUri.match(/^data:image\/(\w+);base64,(.+)$/);
            if (!base64Match) return null;
            
            const base64 = base64Match[2];
            const buffer = Buffer.from(base64, 'base64');
            
            // PNG 헤더에서 크기 읽기 (PNG signature + IHDR chunk)
            if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
              const width = buffer.readUInt32BE(16);
              const height = buffer.readUInt32BE(20);
              return { width, height };
            }
            
            // JPEG 헤더에서 크기 읽기
            if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
              let offset = 2;
              while (offset < buffer.length) {
                if (buffer[offset] !== 0xFF) break;
                const marker = buffer[offset + 1];
                
                // SOF0, SOF1, SOF2 마커 (프레임 시작)
                if (marker >= 0xC0 && marker <= 0xC2) {
                  const height = buffer.readUInt16BE(offset + 5);
                  const width = buffer.readUInt16BE(offset + 7);
                  return { width, height };
                }
                
                // 다음 마커로 이동
                const segmentLength = buffer.readUInt16BE(offset + 2);
                offset += 2 + segmentLength;
              }
            }
            
            // WebP 헤더에서 크기 읽기
            if (buffer.toString('utf8', 0, 4) === 'RIFF' && buffer.toString('utf8', 8, 12) === 'WEBP') {
              // VP8 chunk
              if (buffer.toString('utf8', 12, 16) === 'VP8 ') {
                const width = buffer.readUInt16LE(26) & 0x3FFF;
                const height = buffer.readUInt16LE(28) & 0x3FFF;
                return { width, height };
              }
              // VP8L chunk (lossless)
              if (buffer.toString('utf8', 12, 16) === 'VP8L') {
                const bits = buffer.readUInt32LE(21);
                const width = (bits & 0x3FFF) + 1;
                const height = ((bits >> 14) & 0x3FFF) + 1;
                return { width, height };
              }
            }
            
            return null;
          } catch (error) {
            return null;
          }
        };

        // size 변환 함수: 사용자 요청을 AtlasCloud 형식(width*height)으로 변환
        const convertToAtlasCloudSize = (
          sizeOption?: string,
          aspectRatioOption?: string,
          customWidth?: number,
          customHeight?: number,
          inputImageDataUri?: string
        ): string => {
          // AtlasCloud 최소 픽셀 수 요구사항: 3,686,400 pixels (약 1920x1920)
          const MIN_PIXELS = 3686400;

          // 기본 해상도 매핑 (1K, 2K, 4K)
          const resolutionMap: Record<string, number> = {
            '1K': 1024,
            '2K': 2048,
            '4K': 4096
          };

          // 기본 해상도 결정
          let baseSize = resolutionMap[sizeOption || '2K'] || 2048;

          // custom size인 경우
          if (sizeOption === 'custom' && customWidth && customHeight) {
            // custom size도 최소 픽셀 수 확인
            const customPixels = customWidth * customHeight;
            if (customPixels < MIN_PIXELS) {
              // 비율 유지하면서 스케일 업
              const scale = Math.sqrt(MIN_PIXELS / customPixels);
              const scaledW = Math.round(customWidth * scale);
              const scaledH = Math.round(customHeight * scale);
              return `${scaledW}*${scaledH}`;
            }
            return `${customWidth}*${customHeight}`;
          }

          // "match_input_image" 처리: 입력 이미지 비율 자동 감지
          if (aspectRatioOption === 'match_input_image' && inputImageDataUri) {
            const dimensions = getImageDimensionsFromBase64(inputImageDataUri);
            if (dimensions) {
              const { width: imgW, height: imgH } = dimensions;
              const aspectW = imgW / Math.max(imgW, imgH);
              const aspectH = imgH / Math.max(imgW, imgH);
              
              // baseSize를 기준으로 비율 유지하며 크기 계산
              let outW = Math.round(baseSize * aspectW);
              let outH = Math.round(baseSize * aspectH);
              
              // 최소 픽셀 수 확인 및 스케일 업
              const pixels = outW * outH;
              if (pixels < MIN_PIXELS) {
                const scale = Math.sqrt(MIN_PIXELS / pixels);
                outW = Math.round(outW * scale);
                outH = Math.round(outH * scale);
              }
              
              return `${outW}*${outH}`;
            }
          }

          // aspectRatio 처리 (예: "16:9", "4:3")
          if (aspectRatioOption && aspectRatioOption !== 'match_input_image') {
            const ratioMatch = aspectRatioOption.match(/^(\d+):(\d+)$/);
            if (ratioMatch) {
              const ratioW = parseInt(ratioMatch[1]);
              const ratioH = parseInt(ratioMatch[2]);
              
              // 비율에 맞게 width, height 계산 (긴 쪽이 baseSize)
              let w: number, h: number;
              if (ratioW >= ratioH) {
                w = baseSize;
                h = Math.round(baseSize * ratioH / ratioW);
              } else {
                h = baseSize;
                w = Math.round(baseSize * ratioW / ratioH);
              }
              
              // 최소 픽셀 수 확인 및 스케일 업
              const pixels = w * h;
              if (pixels < MIN_PIXELS) {
                const scale = Math.sqrt(MIN_PIXELS / pixels);
                w = Math.round(w * scale);
                h = Math.round(h * scale);
              }
              
              return `${w}*${h}`;
            }
          }

          // 기본: 정사각형
          // 정사각형도 최소 픽셀 수 확인
          const squarePixels = baseSize * baseSize;
          if (squarePixels < MIN_PIXELS) {
            const minBaseSize = Math.ceil(Math.sqrt(MIN_PIXELS));
            return `${minBaseSize}*${minBaseSize}`;
          }
          return `${baseSize}*${baseSize}`;
        };

        // 이미지가 있으면 edit 모델, 없으면 생성 모델 사용
        const hasImages = actualEditImageUrls.length > 0;
        const atlasModel = hasImages ? 'bytedance/seedream-v4.5/edit' : 'bytedance/seedream-v4.5';

        // 편집 모드인 경우 이미지를 base64로 변환
        let imageInputsForAtlas: string[] = [];
        if (hasImages) {
          imageInputsForAtlas = await Promise.all(
            actualEditImageUrls.map(url => convertImageToDataUri(url))
          );
        }

        // AtlasCloud size 계산 (aspectRatio 고려, 입력 이미지 비율 자동 감지)
        const firstInputImage = imageInputsForAtlas.length > 0 ? imageInputsForAtlas[0] : undefined;
        const atlasSize = convertToAtlasCloudSize(size, aspectRatio || (hasImages ? 'match_input_image' : undefined), width, height, firstInputImage);

        const atlasRequestBody: any = {
          model: atlasModel,
          prompt,
          size: atlasSize,
        };

        // edit 모델은 images 필수
        if (hasImages && imageInputsForAtlas.length > 0) {
          atlasRequestBody.images = imageInputsForAtlas;
        }

        // AtlasCloud API 요청
        const atlasStartResponse = await fetch(`${ATLASCLOUD_API_BASE}/model/generateVideo`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.ATLASCLOUD_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(atlasRequestBody),
        });

        if (!atlasStartResponse.ok) {
          const errorText = await atlasStartResponse.text();
          throw new Error(`AtlasCloud API error: ${atlasStartResponse.status} - ${errorText}`);
        }

        const atlasStartData = await atlasStartResponse.json();
        const requestId = atlasStartData.data?.id;
        if (!requestId) {
          throw new Error('AtlasCloud API did not return a request ID');
        }

        // 결과 폴링
        const pollStartTime = Date.now();
        let output: string[] = [];

        while (Date.now() - pollStartTime < ATLASCLOUD_MAX_POLL_TIME) {
          const pollResponse = await fetch(`${ATLASCLOUD_API_BASE}/model/result/${requestId}`, {
            headers: {
              'Authorization': `Bearer ${process.env.ATLASCLOUD_API_KEY}`,
            },
          });

          if (!pollResponse.ok) {
            const errorText = await pollResponse.text();
            throw new Error(`AtlasCloud polling error: ${pollResponse.status} - ${errorText}`);
          }

          const pollData = await pollResponse.json();
          const status = pollData.data?.status || pollData.status;

          if (status === 'completed' || status === 'succeeded') {
            output = pollData.data?.outputs || pollData.outputs || [];
            break;
          }

          if (status === 'failed') {
            throw new Error(`AtlasCloud generation failed: ${JSON.stringify(pollData)}`);
          }

          // 대기 후 재시도
          await new Promise(resolve => setTimeout(resolve, ATLASCLOUD_POLL_INTERVAL));
        }

        if (!Array.isArray(output) || output.length === 0) {
          throw new Error('No images generated by AtlasCloud');
        }

        // 생성된 이미지들을 Supabase에 업로드
        const uploadedImages = await Promise.all(
          output.map(async (imageUrl: string, index: number) => {
            try {
              const imageData = await downloadImage(imageUrl);
              const { path, url } = await uploadImageToSupabase(imageData, userId || 'anonymous', 'seedream');
              
              // 생성된 이미지 추적
              generatedImageMap?.set(`generated_image_${generatedImageIndex}`, { url, path });
              generatedImageIndex++;
              
              const imageResult = {
                imageUrl: url,
                path: path,  // NEW: Store path for URL refresh
                bucket: 'generated-images',  // NEW: Store bucket name
                prompt,
                timestamp: new Date().toISOString(),
                generatedBy: 'seedream',
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
              throw error;
            }
          })
        );

        return {
          success: true,
          images: uploadedImages,
          count: uploadedImages.length,
          prompt,
          size,
          aspectRatio
        };

      } catch (error) {
        // 디버깅 로그 출력
        console.error('[SEEDREAM_IMAGE] Error:', {
          error: error instanceof Error ? error.message : 'Unknown error',
          errorStack: error instanceof Error ? error.stack : undefined,
          prompt,
          editImageUrl,
          size,
          aspectRatio,
          userId
        });
        
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

// Qwen Image Edit 도구 생성 함수
export function createQwenImageTool(dataStream?: any, userId?: string, allMessages: any[] = [], chatId?: string) {
  const generatedImages: Array<{
    imageUrl: string;
    path: string;
    bucket: string;
    prompt: string;
    timestamp: string;
    generatedBy: string;
    originalImageUrl?: string;
    isEdit: boolean;
    aspectRatio?: string;
  }> = [];

  // 🔥 이미지 맵은 실행 시점에 빌드됨 (lazy initialization)
  let imageMap: Map<string, string> | null = null;
  let generatedImageMap: Map<string, { url: string, path: string }> | null = null;
  let imageMapsInitialized = false;
  let generatedImageIndex = 1;
  
  // 🔥 이미지 맵 초기화 함수
  async function ensureImageMapsInitialized() {
    if (imageMapsInitialized) return;
    
    // chatId와 userId가 있으면 DB에서 전체 메시지 가져오기
    if (chatId && userId) {
      const dbMessages = await fetchAllChatMessagesFromDB(chatId, userId);
      
      // 🔥 병합 로직: DB 메시지 + 현재 요청의 메시지들(allMessages) 중 DB에 없는 것
      let messagesToProcess = dbMessages;
      if (allMessages.length > 0) {
        const dbMessageIds = new Set(dbMessages.map(m => m.id).filter(Boolean));
        const newMessages = allMessages.filter(m => m.id && !dbMessageIds.has(m.id));
        if (newMessages.length > 0) {
           messagesToProcess = [...dbMessages, ...newMessages];
        } else if (dbMessages.length === 0) {
           messagesToProcess = allMessages;
        }
      }
      
      if (messagesToProcess.length > 0) {
        const maps = buildImageMapsFromDBMessages(messagesToProcess);
        imageMap = maps.imageMap;
        generatedImageMap = maps.generatedImageMap;
        imageMapsInitialized = true;
        console.log(`[QWEN_IMAGE] Image maps built: ${imageMap.size} uploads, ${generatedImageMap.size} generations`);
        return;
      }
    }
    
    // Fallback: 클라이언트에서 전달받은 메시지 사용
    imageMap = new Map<string, string>();
    generatedImageMap = new Map<string, { url: string, path: string }>();
    let uploadedImageIndex = 1;
    let localGeneratedImageIndex = 1;
    
    for (const message of allMessages) {
      let foundInParts = false;

      if (message.experimental_attachments && Array.isArray(message.experimental_attachments)) {
        for (const attachment of message.experimental_attachments) {
          if (attachment.contentType?.startsWith('image/') || attachment.fileType === 'image') {
            imageMap.set(`uploaded_image_${uploadedImageIndex++}`, attachment.url);
          }
        }
      }
      
      if (message.parts && Array.isArray(message.parts)) {
        for (const part of message.parts) {
          if (part.type === 'file' && part.mediaType?.startsWith('image/')) {
            if (part.url || part.data) {
              imageMap.set(`uploaded_image_${uploadedImageIndex++}`, part.url || part.data);
            }
          }
          
          const imageToolNames = ['gemini_image_tool', 'seedream_image_tool', 'qwen_image_edit'];
          const isImageToolResult = imageToolNames.some(toolName => 
            part.type === `tool-${toolName}` ||
            (part.type === 'tool-result' && part.toolName === toolName)
          );
          
          if (isImageToolResult && part.state === 'output-available' && part.output) {
            const result = part.output?.value || part.output;
            if (result && result.success !== false) {
              const images = Array.isArray(result) ? result : (result.images || (result.imageUrl ? [result] : []));
              for (const img of images) {
                if (img.imageUrl && img.path) {
                  generatedImageMap.set(`generated_image_${localGeneratedImageIndex++}`, { url: img.imageUrl, path: img.path });
                  foundInParts = true;
                }
              }
            }
          }
        }
      }

      if (!foundInParts) {
        if (message.tool_results) {
          const results = message.tool_results.geminiImageResults || message.tool_results.seedreamImageResults || message.tool_results.qwenImageResults;
          if (Array.isArray(results)) {
            for (const img of results) {
              if (img.imageUrl && img.path) {
                generatedImageMap.set(`generated_image_${localGeneratedImageIndex++}`, { url: img.imageUrl, path: img.path });
              }
            }
          }
        }
      }
    }
    imageMapsInitialized = true;
  }

  const qwenImageInputSchema = z.object({
    prompt: z.string().describe('Text instruction on how to edit the given image.'),
    editImageUrl: z.union([
      z.string(), 
      z.array(z.string())
    ]).describe('Image reference(s): For user-uploaded images use "uploaded_image_N" (e.g., uploaded_image_1). For previously generated images, use "generated_image_N" (e.g., generated_image_1). For search images, use "search_img_XXX" (exact ID from search results).'),
    aspectRatio: z.string().optional().describe('Aspect ratio for the generated image. Default: "match_input_image" (auto-preserves input ratio). For override: use "1:1", "16:9", "9:16", "4:3" etc.')
  });

  type QwenImageInput = z.infer<typeof qwenImageInputSchema>;

  const qwenImageTool = tool<QwenImageInput, unknown>({
    description: 'Edit images with precise control using Qwen Image Edit 2511 model. This model excels at multi-image composition, identity preservation, and precise text editing while keeping original style intact. Supports combining up to 3 images.',
    inputSchema: qwenImageInputSchema,
    execute: async ({ prompt, editImageUrl, aspectRatio }: QwenImageInput) => {
      // 🔥 이미지 참조를 실제 URL로 변환 (단일 또는 배열) - catch 블록에서도 접근 가능하도록 try 전에 선언
      let actualEditImageUrls: string[] = [];
      
      try {
        // 🔥 이미지 맵 초기화 (DB에서 전체 메시지 가져옴)
        await ensureImageMapsInitialized();
        
        // 🔍 DEBUG: editImageUrl이 JSON 문자열인지 확인
        if (editImageUrl && typeof editImageUrl === 'string' && editImageUrl.trim().startsWith('[') && editImageUrl.trim().endsWith(']')) {
          try {
            const parsed = JSON.parse(editImageUrl);
            if (Array.isArray(parsed)) {
              editImageUrl = parsed as any; // 타입 캐스팅하여 재할당
            }
          } catch (e) {
            // Silence errors
          }
        }
        
        if (editImageUrl) {
          const urlsToResolve = Array.isArray(editImageUrl) ? editImageUrl : [editImageUrl];
          
          for (const url of urlsToResolve) {
            if (url.startsWith('uploaded_image_')) {
              const resolvedUrl = imageMap?.get(url);
              if (resolvedUrl) {
                actualEditImageUrls.push(await resolveUploadedImageUrl(resolvedUrl));
              } else {
                throw new Error(`Image reference "${url}" not found in conversation history`);
              }
            } else if (url.startsWith('generated_image_')) {
              // Generated image reference (always resolve fresh URL when path exists to avoid expired JWT)
              const imgData = generatedImageMap?.get(url);
              if (imgData) {
                const finalUrl = await resolveGeneratedImageUrl(imgData);
                if (finalUrl) {
                  actualEditImageUrls.push(finalUrl);
                  if (imgData.path && finalUrl !== imgData.url) {
                    generatedImageMap?.set(url, { url: finalUrl, path: imgData.path });
                  }
                } else {
                  throw new Error(`Generated image reference "${url}" has no valid URL`);
                }
              } else {
                throw new Error(`Generated image reference "${url}" not found in conversation history`);
              }
            } else if (url.startsWith('search_img_') || url.startsWith('google_img_')) {
              // Search image reference (from web_search or google_search)
              const resolvedUrl = imageMap?.get(url);
              if (resolvedUrl) {
                actualEditImageUrls.push(resolvedUrl);
              } else {
                throw new Error(`Search image reference "${url}" not found in conversation history`);
              }
            } else {
              actualEditImageUrls.push(url); // Direct URL (for backward compatibility)
            }
          }
        }

        // 🛠️ Simple Mapping Log
        logImageMapping('QWEN_IMAGE', prompt, editImageUrl, actualEditImageUrls);

        // 이미지 편집 시작 신호 전송 (해결된 URL 포함)
        if (dataStream) {
          dataStream.write({
            type: 'data-qwen_image_started',
            id: `ann-qwen-start-${Date.now()}`,
            data: {
              prompt,
              editImageUrl,
              resolvedEditImageUrl: actualEditImageUrls.length > 0 ? (actualEditImageUrls.length === 1 ? actualEditImageUrls[0] : actualEditImageUrls) : undefined,
              aspectRatio,
              started: true
            }
          });
        }

        const replicate = new Replicate({
          auth: process.env.REPLICATE_API_TOKEN,
        });

        // 이미지를 base64 data URI로 변환
        const imageInputs = await Promise.all(
          actualEditImageUrls.map(url => convertImageToDataUri(url))
        );

        const replicateInput: any = {
          prompt: prompt,
          image: imageInputs,
          go_fast: true,
          disable_safety_checker: true,
          aspect_ratio: aspectRatio || "match_input_image",
          output_format: "webp",
          output_quality: 95
        };

        const output = await replicate.run("qwen/qwen-image-edit-2511", { input: replicateInput });
        
        if (!output || (Array.isArray(output) && output.length === 0)) {
          throw new Error('No images generated by Replicate');
        }

        let finalImageUrl = Array.isArray(output) ? output[0] : output;
        let finalPath: string;

        // ReadableStream인 경우 처리 (드문 경우지만 Pensieve에서 처리함)
        if (finalImageUrl instanceof ReadableStream) {
          const reader = finalImageUrl.getReader();
          const chunks: Uint8Array[] = [];
          let done = false;
          while (!done) {
            const { value, done: streamDone } = await reader.read();
            done = streamDone;
            if (value) {
              chunks.push(value);
            }
          }
          const imageBuffer = Buffer.concat(chunks);
          const uploadRes = await uploadImageToSupabase(imageBuffer, userId || 'anonymous', 'qwen');
          finalImageUrl = uploadRes.url;
          finalPath = uploadRes.path;
        } else {
          // URL string인 경우
          const imageData = await downloadImage(finalImageUrl);
          const uploadRes = await uploadImageToSupabase(imageData, userId || 'anonymous', 'qwen');
          finalImageUrl = uploadRes.url;
          finalPath = uploadRes.path;
        }

        const imageResult = {
          imageUrl: finalImageUrl,
          path: finalPath,
          bucket: 'generated-images',
          prompt,
          timestamp: new Date().toISOString(),
          generatedBy: 'qwen',
          originalImageUrl: actualEditImageUrls.length > 0 ? actualEditImageUrls[0] : undefined,
          isEdit: true,
          aspectRatio
        };

        // 생성된 이미지 추적
        generatedImageMap?.set(`generated_image_${generatedImageIndex}`, { url: finalImageUrl, path: finalPath });
        generatedImageIndex++;
        generatedImages.push(imageResult);

        // 클라이언트에 이미지 생성 완료 신호 전송
        if (dataStream) {
          dataStream.write({
            type: 'data-qwen_image_complete',
            id: `ann-qwen-complete-${Date.now()}`,
            data: imageResult
          });
        }

        return {
          success: true,
          images: [imageResult],
          count: 1,
          prompt,
          aspectRatio
        };

      } catch (error) {
        // 디버깅 로그 출력
        console.error('[QWEN_IMAGE] Error:', {
          error: error instanceof Error ? error.message : 'Unknown error',
          errorStack: error instanceof Error ? error.stack : undefined,
          prompt,
          editImageUrl,
          aspectRatio,
          resolvedEditImageUrl: actualEditImageUrls.length > 0 ? (actualEditImageUrls.length === 1 ? actualEditImageUrls[0] : actualEditImageUrls) : undefined,
          userId
        });
        
        // 에러 신호 전송
        if (dataStream) {
          dataStream.write({
            type: 'data-qwen_image_error',
            id: `ann-qwen-error-${Date.now()}`,
            data: {
              error: error instanceof Error ? error.message : 'Unknown error',
              prompt,
              editImageUrl,
              resolvedEditImageUrl: actualEditImageUrls.length > 0 ? (actualEditImageUrls.length === 1 ? actualEditImageUrls[0] : actualEditImageUrls) : undefined
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
  return Object.assign(qwenImageTool, { generatedImages });
}

// Wan 2.5 비디오 생성 도구 생성 함수
// 🔥 chatId 추가: 가상화된 메시지 로딩 문제 해결 - DB에서 전체 메시지 가져옴
// 🔥 forcedModel 추가: UI에서 선택한 모드(text-to-video/image-to-video)를 강제 적용
export function createWan25VideoTool(dataStream?: any, userId?: string, allMessages: any[] = [], chatId?: string, forcedModel?: 'text-to-video' | 'image-to-video') {
  const generatedVideos: Array<{
    videoUrl: string;
    prompt: string;
    timestamp: string;
    path?: string;
    bucket?: string;
    resolution?: string;
    duration?: number;
    isImageToVideo?: boolean;
    sourceImageUrl?: string;
  }> = [];

  // 🔥 이미지 맵은 실행 시점에 빌드됨 (lazy initialization)
  let imageMap: Map<string, string> | null = null;
  let generatedImageMap: Map<string, { url: string, path: string }> | null = null;
  let imageMapsInitialized = false;
  
  // 🔥 이미지 맵 초기화 함수
  async function ensureImageMapsInitialized() {
    if (imageMapsInitialized) return;
    
    // chatId와 userId가 있으면 DB에서 전체 메시지 가져오기
    if (chatId && userId) {
      const dbMessages = await fetchAllChatMessagesFromDB(chatId, userId);
      
      // 🔥 병합 로직: DB 메시지 + 현재 요청의 메시지들(allMessages) 중 DB에 없는 것
      let messagesToProcess = dbMessages;
      if (allMessages.length > 0) {
        const dbMessageIds = new Set(dbMessages.map(m => m.id).filter(Boolean));
        const newMessages = allMessages.filter(m => m.id && !dbMessageIds.has(m.id));
        if (newMessages.length > 0) {
           messagesToProcess = [...dbMessages, ...newMessages];
        } else if (dbMessages.length === 0) {
           messagesToProcess = allMessages;
        }
      }
      
      if (messagesToProcess.length > 0) {
        const maps = buildImageMapsFromDBMessages(messagesToProcess);
        imageMap = maps.imageMap;
        generatedImageMap = maps.generatedImageMap;
        imageMapsInitialized = true;
        console.log(`[WAN25_VIDEO] Image maps built: ${imageMap.size} uploads, ${generatedImageMap.size} generations`);
        return;
      }
    }
    
    // Fallback: 클라이언트에서 전달받은 메시지 사용
    imageMap = new Map<string, string>();
    generatedImageMap = new Map<string, { url: string, path: string }>();
    let uploadedImageIndex = 1;
    let generatedImageIndex = 1;
    
    for (const message of allMessages) {
      let foundInParts = false;

      if (message.experimental_attachments && Array.isArray(message.experimental_attachments)) {
        for (const attachment of message.experimental_attachments) {
          if (attachment.contentType?.startsWith('image/') || attachment.fileType === 'image') {
            imageMap.set(`uploaded_image_${uploadedImageIndex++}`, attachment.url);
          }
        }
      }
      
      if (message.parts && Array.isArray(message.parts)) {
        for (const part of message.parts) {
          if (part.type === 'file' && part.mediaType?.startsWith('image/')) {
            if (part.url || part.data) {
              imageMap.set(`uploaded_image_${uploadedImageIndex++}`, part.url || part.data);
            }
          }
          
          const imageToolNames = ['gemini_image_tool', 'seedream_image_tool', 'qwen_image_edit'];
          const isImageToolResult = imageToolNames.some(toolName => 
            part.type === `tool-${toolName}` ||
            (part.type === 'tool-result' && part.toolName === toolName)
          );
          
          if (isImageToolResult && part.state === 'output-available' && part.output) {
            const result = part.output?.value || part.output;
            if (result && result.success !== false) {
              const images = Array.isArray(result) ? result : (result.images || (result.imageUrl ? [result] : []));
              for (const img of images) {
                if (img.imageUrl && img.path) {
                  generatedImageMap.set(`generated_image_${generatedImageIndex++}`, { url: img.imageUrl, path: img.path });
                  foundInParts = true;
                }
              }
            }
          }
        }
      }

      if (!foundInParts) {
        if (message.tool_results) {
          const results = message.tool_results.geminiImageResults || message.tool_results.seedreamImageResults || message.tool_results.qwenImageResults;
          if (Array.isArray(results)) {
            for (const img of results) {
              if (img.imageUrl && img.path) {
                generatedImageMap.set(`generated_image_${generatedImageIndex++}`, { url: img.imageUrl, path: img.path });
              }
            }
          }
        }
      }
    }
    imageMapsInitialized = true;
  }

  async function uploadVideoToSupabase(uint8Array: Uint8Array, userId: string): Promise<{ path: string, url: string }> {
    const { createClient } = await import('@/utils/supabase/server');
    const supabase = await createClient();
    
    const fileName = `wan25_${Date.now()}_${Math.random().toString(36).slice(2)}.mp4`;
    const filePath = `${userId}/${fileName}`;
    
    const { error } = await supabase.storage
      .from('generated-videos')
      .upload(filePath, uint8Array, { contentType: 'video/mp4' });
    
    if (error) {
      throw new Error(`Failed to upload video: ${error.message}`);
    }
    
    const { data: signedData, error: signedError } = await supabase.storage
      .from('generated-videos')
      .createSignedUrl(filePath, 24 * 60 * 60);
    
    if (signedError || !signedData?.signedUrl) {
      throw new Error(`Failed to create signed URL: ${signedError?.message || 'Unknown error'}`);
    }
    
    return { path: filePath, url: signedData.signedUrl };
  }

  async function downloadVideo(url: string): Promise<Uint8Array> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download video: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  }

  async function convertImageToDataUri(url: string): Promise<string> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Base64 인코딩 시 크기가 약 1.33배 증가하므로, 안전하게 7MB(약 9.3MB Base64)를 기준으로 최적화
    // AtlasCloud 10MB 제한 준수
    if (buffer.length > 7 * 1024 * 1024) {
      try {
        const sharp = (await import('sharp')).default;
        // 해상도는 유지하면서 고화질 JPEG로 변환하여 용량 축소
        const optimizedBuffer = await sharp(buffer)
          .jpeg({ 
            quality: 90, 
            chromaSubsampling: '4:4:4', // 색상 정보 손실 최소화 (해상도 유지 효과)
            force: true 
          })
          .toBuffer();
        
        // 최적화 후에도 크면 품질을 더 낮춤 (최종 수단)
        let finalBuffer = optimizedBuffer;
        if (finalBuffer.length > 7 * 1024 * 1024) {
          finalBuffer = await sharp(buffer)
            .jpeg({ quality: 80 })
            .toBuffer();
        }

        const base64 = finalBuffer.toString('base64');
        return `data:image/jpeg;base64,${base64}`;
      } catch (err) {
        console.error('Image optimization failed, falling back to original:', err);
      }
    }
    
    const base64 = buffer.toString('base64');
    return `data:${contentType};base64,${base64}`;
  }

  const wan25VideoInputSchema = z.object({
    prompt: z.string().describe('Text description of the video to generate. Be detailed and specific about the motion, scene, and style.'),
    model: z.enum(['text-to-video', 'image-to-video']).describe('Video generation mode. text-to-video creates videos from text prompts, image-to-video animates static images.'),
    imageUrl: z.string().optional().describe('Image reference for image-to-video: use "uploaded_image_N" (e.g., uploaded_image_1) for user uploads or "generated_image_N" for AI-generated images. When provided, creates video from the image.'),
    size: z.string().optional().describe('Video size for text-to-video mode in format "width*height" (e.g., "1280*720", "720*1280", "960*960"). Supported formats: "832*480", "480*832", "624*624", "1280*720", "720*1280", "960*960", "1088*832", "832*1088", "1920*1080", "1080*1920", "1440*1440", "1632*1248", "1248*1632". Only used for text-to-video mode.'),
    resolution: z.enum(['480p', '720p', '1080p']).describe('Video resolution. Required for image-to-video mode (480p/720p/1080p). For text-to-video this value is ignored; use size instead.'),
    duration: z.enum(['5', '10']).optional().describe('Video duration in seconds. Options: 5 or 10. Default: 5'),
    negative_prompt: z.string().optional().describe('Negative prompt describing what to exclude from the generation. Use this to specify unwanted elements, styles, or characteristics.'),
    seed: z.number().optional().describe('Random seed for reproducible generation. -1 for random. Default: -1')
  });

  type Wan25VideoInput = z.infer<typeof wan25VideoInputSchema>;

  const wan25VideoTool = tool<Wan25VideoInput, unknown>({
    description: 'Generate videos using Alibaba Wan 2.5 model. Supports text-to-video (create video from text prompt) and image-to-video (animate a static image). Videos are 5-10 seconds with audio.',
    inputSchema: wan25VideoInputSchema,
    execute: async ({ model, prompt, imageUrl, size, resolution, duration, negative_prompt, seed }: Wan25VideoInput) => {
      try {
        // 🔥 forcedModel이 있으면 사용 (UI에서 선택한 모드 강제 적용)
        const effectiveModel = forcedModel || model;
        
        // 🔥 이미지 맵 초기화 (DB에서 전체 메시지 가져옴)
        await ensureImageMapsInitialized();
        
        // 이미지 참조를 실제 URL로 변환
        let actualImageUrl: string | undefined;
        
        if (imageUrl) {
          if (imageUrl.startsWith('uploaded_image_')) {
            const resolvedUrl = imageMap?.get(imageUrl);
            if (resolvedUrl) {
              actualImageUrl = await resolveUploadedImageUrl(resolvedUrl);
            } else {
              throw new Error(`Image reference "${imageUrl}" not found in conversation history`);
            }
          } else if (imageUrl.startsWith('generated_image_')) {
            const imgData = generatedImageMap?.get(imageUrl);
            if (imgData) {
              actualImageUrl = await resolveGeneratedImageUrl(imgData);
            } else {
              throw new Error(`Generated image reference "${imageUrl}" not found in conversation history`);
            }
          } else {
            actualImageUrl = imageUrl;
          }
        }

        // 🛠️ Simple Mapping Log
        if (actualImageUrl) {
          logImageMapping('WAN25_VIDEO', prompt, imageUrl, [actualImageUrl]);
        }

        const atlasModel = `alibaba/wan-2.5/${effectiveModel}`;
        const isImageToVideo = effectiveModel === 'image-to-video';

        if (dataStream) {
          dataStream.write({
            type: 'data-wan25_video_started',
            id: `ann-wan25-start-${Date.now()}`,
            data: {
              prompt,
              model: effectiveModel,
              imageUrl,
              resolvedImageUrl: actualImageUrl,
              size,
              resolution,
              duration,
              started: true
            }
          });
        }

        const ATLASCLOUD_API_BASE = 'https://api.atlascloud.ai/api/v1';
        const ATLASCLOUD_POLL_INTERVAL = 2000;
        const ATLASCLOUD_MAX_POLL_TIME = 780000; // 780초 (13분) - Vercel Pro 최대 800초 내에서 여유 확보

        const atlasRequestBody: any = {
          model: atlasModel,
          prompt,
          duration: duration ? parseInt(duration) : 5,
          generate_audio: true,
          seed: seed ?? -1,
          enable_prompt_expansion: false
        };

        // Add negative_prompt if provided
        if (negative_prompt) {
          atlasRequestBody.negative_prompt = negative_prompt;
        }

        if (isImageToVideo) {
          atlasRequestBody.resolution = resolution;
          atlasRequestBody.image = await convertImageToDataUri(actualImageUrl!);
        } else {
          atlasRequestBody.size = size;
        }

        const atlasStartResponse = await fetch(`${ATLASCLOUD_API_BASE}/model/generateVideo`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.ATLASCLOUD_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(atlasRequestBody),
        });

        if (!atlasStartResponse.ok) {
          const errorText = await atlasStartResponse.text();
          throw new Error(`AtlasCloud API error: ${atlasStartResponse.status} - ${errorText}`);
        }

        const atlasStartData = await atlasStartResponse.json();
        const requestId = atlasStartData.data?.id;
        if (!requestId) {
          throw new Error('AtlasCloud API did not return a request ID');
        }

        const pollStartTime = Date.now();
        let output: string[] = [];
        let lastStatus = 'processing';
        let lastProgressUpdate = 0;

        while (Date.now() - pollStartTime < ATLASCLOUD_MAX_POLL_TIME) {
          const pollResponse = await fetch(`${ATLASCLOUD_API_BASE}/model/result/${requestId}`, {
            headers: {
              'Authorization': `Bearer ${process.env.ATLASCLOUD_API_KEY}`,
            },
          });

          if (!pollResponse.ok) {
            const errorText = await pollResponse.text();
            throw new Error(`AtlasCloud polling error: ${pollResponse.status} - ${errorText}`);
          }

          const pollData = await pollResponse.json();
          const status = pollData.data?.status || pollData.status;
          
          // 상태가 변경되거나 10초마다 진행 상황 전송
          const elapsedSeconds = Math.floor((Date.now() - pollStartTime) / 1000);
          if (dataStream && (status !== lastStatus || elapsedSeconds - lastProgressUpdate >= 10)) {
            dataStream.write({
              type: 'data-wan25_video_progress',
              id: `ann-wan25-progress-${Date.now()}`,
              data: {
                status,
                elapsedSeconds,
                requestId
              }
            });
            lastStatus = status;
            lastProgressUpdate = elapsedSeconds;
          }

          if (status === 'completed' || status === 'succeeded') {
            output = pollData.data?.outputs || pollData.outputs || [];
            break;
          }

          if (status === 'failed') {
            throw new Error(`AtlasCloud video generation failed: ${JSON.stringify(pollData)}`);
          }

          await new Promise(resolve => setTimeout(resolve, ATLASCLOUD_POLL_INTERVAL));
        }

        // 타임아웃 체크 및 명확한 에러 메시지
        if (!Array.isArray(output) || output.length === 0) {
          const elapsedSeconds = Math.floor((Date.now() - pollStartTime) / 1000);
          const elapsedMinutes = Math.floor(elapsedSeconds / 60);
          const remainingSeconds = elapsedSeconds % 60;
          
          if (Date.now() - pollStartTime >= ATLASCLOUD_MAX_POLL_TIME) {
            throw new Error(
              `Video generation timed out after ${elapsedMinutes} minutes ${remainingSeconds} seconds. ` +
              `The request may still be processing on AtlasCloud. Last status: "${lastStatus}". ` +
              `Request ID: ${requestId}. Please check the AtlasCloud dashboard or try again later.`
            );
          } else {
            throw new Error(
              `No videos generated by AtlasCloud. Last status: "${lastStatus}". ` +
              `Elapsed time: ${elapsedSeconds}s (${elapsedMinutes}m ${remainingSeconds}s). Request ID: ${requestId}`
            );
          }
        }

        // 생성된 비디오를 Supabase에 업로드
        const uploadedVideos = await Promise.all(
          output.map(async (videoUrl: string, index: number) => {
            const videoData = await downloadVideo(videoUrl);
            const { path, url } = await uploadVideoToSupabase(videoData, userId || 'anonymous');
            
            const videoResult = {
              videoUrl: url,
              path,
              bucket: 'generated-videos',
              prompt,
              timestamp: new Date().toISOString(),
              resolution,
              size,
              duration: duration ? parseInt(duration) : 5,
              isImageToVideo,
              sourceImageUrl: actualImageUrl
            };

            generatedVideos.push(videoResult);

            // 디버깅: 생성된 비디오 풀링크 출력 (링크로 직접 확인용)
            console.log('[WAN25_VIDEO] 생성된 비디오 풀링크 (반드시 풀링크):', videoResult.videoUrl);

            if (dataStream) {
              dataStream.write({
                type: 'data-wan25_video_complete',
                id: `ann-wan25-complete-${Date.now()}-${index}`,
                data: videoResult
              });
            }

            return videoResult;
          })
        );

        return {
          success: true,
          videos: uploadedVideos,
          count: uploadedVideos.length,
          prompt,
          model,
          resolution,
          size,
          duration
        };

      } catch (error) {
        console.error('[WAN25_VIDEO] Error:', {
          error: error instanceof Error ? error.message : 'Unknown error',
          errorStack: error instanceof Error ? error.stack : undefined,
          prompt,
          model,
          resolution,
          imageUrl,
          size,
          duration
        });

        if (dataStream) {
          dataStream.write({
            type: 'data-wan25_video_error',
            id: `ann-wan25-error-${Date.now()}`,
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

  return Object.assign(wan25VideoTool, { generatedVideos });
}

// xAI Grok Imagine 비디오 생성/편집 도구
// Wan 패턴 + video-edit: 대화 내 이전 비디오(grok/wan25) 참조로 편집
export function createGrokVideoTool(
  dataStream?: any,
  userId?: string,
  allMessages: any[] = [],
  chatId?: string,
  forcedModel?: 'text-to-video' | 'image-to-video' | 'video-edit'
) {
  const generatedVideos: Array<{
    videoUrl: string;
    prompt: string;
    timestamp: string;
    path?: string;
    bucket?: string;
    resolution?: string;
    duration?: number;
    aspect_ratio?: string;
    isImageToVideo?: boolean;
    isVideoEdit?: boolean;
    sourceImageUrl?: string;
    sourceVideoUrl?: string;
  }> = [];

  let imageMap: Map<string, string> | null = null;
  let generatedImageMap: Map<string, { url: string; path: string }> | null = null;
  let imageMapsInitialized = false;
  let videoMap: Map<string, string> | null = null;
  let videoMapsInitialized = false;

  async function ensureImageMapsInitialized() {
    if (imageMapsInitialized) return;
    if (chatId && userId) {
      const dbMessages = await fetchAllChatMessagesFromDB(chatId, userId);
      let messagesToProcess = dbMessages;
      if (allMessages.length > 0) {
        const dbMessageIds = new Set(dbMessages.map(m => m.id).filter(Boolean));
        const newMessages = allMessages.filter(m => m.id && !dbMessageIds.has(m.id));
        if (newMessages.length > 0) {
          messagesToProcess = [...dbMessages, ...newMessages];
        } else if (dbMessages.length === 0) {
          messagesToProcess = allMessages;
        }
      }
      if (messagesToProcess.length > 0) {
        const maps = buildImageMapsFromDBMessages(messagesToProcess);
        imageMap = maps.imageMap;
        generatedImageMap = maps.generatedImageMap;
        imageMapsInitialized = true;
        return;
      }
    }
    imageMap = new Map<string, string>();
    generatedImageMap = new Map<string, { url: string; path: string }>();
    let uploadedImageIndex = 1;
    let generatedImageIndex = 1;
    for (const message of allMessages) {
      let foundInParts = false;
      if (message.experimental_attachments && Array.isArray(message.experimental_attachments)) {
        for (const attachment of message.experimental_attachments) {
          if (attachment.contentType?.startsWith('image/') || attachment.fileType === 'image') {
            imageMap.set(`uploaded_image_${uploadedImageIndex++}`, attachment.url);
          }
        }
      }
      if (message.parts && Array.isArray(message.parts)) {
        for (const part of message.parts) {
          if (part.type === 'file' && part.mediaType?.startsWith('image/')) {
            if (part.url || part.data) {
              imageMap.set(`uploaded_image_${uploadedImageIndex++}`, part.url || part.data);
            }
          }
          const imageToolNames = ['gemini_image_tool', 'seedream_image_tool', 'qwen_image_edit'];
          const isImageToolResult = imageToolNames.some(toolName =>
            part.type === `tool-${toolName}` || (part.type === 'tool-result' && part.toolName === toolName)
          );
          if (isImageToolResult && part.state === 'output-available' && part.output) {
            const result = part.output?.value || part.output;
            if (result && result.success !== false) {
              const images = Array.isArray(result) ? result : (result.images || (result.imageUrl ? [result] : []));
              for (const img of images) {
                if (img.imageUrl && img.path) {
                  generatedImageMap.set(`generated_image_${generatedImageIndex++}`, { url: img.imageUrl, path: img.path });
                  foundInParts = true;
                }
              }
            }
          }
        }
      }
      if (!foundInParts && message.tool_results) {
        const results = message.tool_results.geminiImageResults || message.tool_results.seedreamImageResults || message.tool_results.qwenImageResults;
        if (Array.isArray(results)) {
          for (const img of results) {
            if (img.imageUrl && img.path) {
              generatedImageMap.set(`generated_image_${generatedImageIndex++}`, { url: img.imageUrl, path: img.path });
            }
          }
        }
      }
    }
    imageMapsInitialized = true;
  }

  async function ensureVideoMapInitialized() {
    if (videoMapsInitialized) return;
    const { createClient } = await import('@/utils/supabase/server');
    const supabase = await createClient();
    let messagesToProcess = allMessages;
    if (chatId && userId) {
      const dbMessages = await fetchAllChatMessagesFromDB(chatId, userId);
      if (dbMessages.length > 0) {
        const dbMessageIds = new Set(dbMessages.map(m => m.id).filter(Boolean));
        const newMessages = allMessages.filter(m => m.id && !dbMessageIds.has(m.id));
        messagesToProcess = newMessages.length > 0 ? [...dbMessages, ...newMessages] : dbMessages.length > 0 ? dbMessages : allMessages;
      }
    }
    videoMap = new Map<string, string>();
    let generatedVideoIndex = 1;
    const seenPaths = new Set<string>();

    function extractFilenameId(path: string): string | null {
      if (!path) return null;
      const filename = path.split('/').pop();
      return filename ? filename.replace(/\.[^.]+$/, '') : null;
    }

    for (const msg of messagesToProcess) {
      let foundInParts = false;
      if (msg.parts && Array.isArray(msg.parts)) {
        for (const part of msg.parts) {
          if ((part.type?.startsWith('tool-wan25_') || part.type?.startsWith('tool-grok_')) && part.output?.videos && Array.isArray(part.output.videos)) {
            const result = part.output;
            if (result && result.success !== false) {
              for (const vid of result.videos) {
                if (vid.path && !seenPaths.has(vid.path)) {
                  seenPaths.add(vid.path);
                  const { data: signedData } = await supabase.storage.from('generated-videos').createSignedUrl(vid.path, 24 * 60 * 60);
                  if (signedData?.signedUrl) {
                    videoMap!.set(`generated_video_${generatedVideoIndex++}`, signedData.signedUrl);
                    const fid = extractFilenameId(vid.path);
                    if (fid) videoMap!.set(fid, signedData.signedUrl);
                  }
                  foundInParts = true;
                }
              }
            }
          }
          if ((part.type === 'data-wan25_video_complete' || part.type === 'data-grok_video_complete') && part.data?.path) {
            const path = part.data.path;
            if (!seenPaths.has(path)) {
              seenPaths.add(path);
              const { data: signedData } = await supabase.storage.from('generated-videos').createSignedUrl(path, 24 * 60 * 60);
              if (signedData?.signedUrl) {
                videoMap!.set(`generated_video_${generatedVideoIndex++}`, signedData.signedUrl);
                const fid = extractFilenameId(path);
                if (fid) videoMap!.set(fid, signedData.signedUrl);
              }
            }
          }
        }
      }
      if (!foundInParts && msg.tool_results) {
        const wan25 = msg.tool_results.wan25VideoResults;
        const grok = msg.tool_results.grokVideoResults;
        const list = Array.isArray(wan25) ? wan25 : [];
        const grokList = Array.isArray(grok) ? grok : [];
        for (const vid of [...list, ...grokList]) {
          if (vid.path && !seenPaths.has(vid.path)) {
            seenPaths.add(vid.path);
            const { data: signedData } = await supabase.storage.from('generated-videos').createSignedUrl(vid.path, 24 * 60 * 60);
            if (signedData?.signedUrl) {
              videoMap!.set(`generated_video_${generatedVideoIndex++}`, signedData.signedUrl);
              const fid = extractFilenameId(vid.path);
              if (fid) videoMap!.set(fid, signedData.signedUrl);
            }
          }
        }
      }
    }
    videoMapsInitialized = true;
  }

  async function uploadVideoToSupabase(uint8Array: Uint8Array, userId: string): Promise<{ path: string; url: string }> {
    const { createClient } = await import('@/utils/supabase/server');
    const supabase = await createClient();
    const fileName = `grok_${Date.now()}_${Math.random().toString(36).slice(2)}.mp4`;
    const filePath = `${userId}/${fileName}`;
    const { error } = await supabase.storage.from('generated-videos').upload(filePath, uint8Array, { contentType: 'video/mp4' });
    if (error) throw new Error(`Failed to upload video: ${error.message}`);
    const { data: signedData, error: signedError } = await supabase.storage.from('generated-videos').createSignedUrl(filePath, 24 * 60 * 60);
    if (signedError || !signedData?.signedUrl) throw new Error(`Failed to create signed URL: ${signedError?.message || 'Unknown error'}`);
    return { path: filePath, url: signedData.signedUrl };
  }

  async function downloadVideo(url: string): Promise<Uint8Array> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to download video: ${response.statusText}`);
    return new Uint8Array(await response.arrayBuffer());
  }

  const XAI_API_BASE = 'https://api.x.ai/v1';
  const XAI_POLL_INTERVAL = 2000;
  const XAI_MAX_POLL_TIME = 300000; // 5 min

  const grokVideoInputSchema = z.object({
    prompt: z.string().describe('Text description of the video to generate or edit. Be detailed about motion, scene, and style.'),
    model: z.enum(['text-to-video', 'image-to-video', 'video-edit']).describe('Mode: text-to-video (from scratch), image-to-video (animate image), video-edit (edit existing video from conversation).'),
    imageUrl: z.string().optional().describe('For image-to-video: use uploaded_image_N or generated_image_N.'),
    videoUrl: z.string().optional().describe('For video-edit: use generated_video_N or filename id (e.g. grok_1760_xxx, wan25_1760_xxx) from conversation.'),
    duration: z.number().min(1).max(15).optional().describe('Video duration in seconds (1-15). Not used for video-edit.'),
    aspect_ratio: z.enum(['16:9', '4:3', '1:1', '9:16', '3:4', '3:2', '2:3']).optional().describe('Aspect ratio. Default 16:9.'),
    resolution: z.enum(['720p', '480p']).optional().describe('Resolution. Default 720p.'),
  });

  type GrokVideoInput = z.infer<typeof grokVideoInputSchema>;

  const grokVideoTool = tool<GrokVideoInput, unknown>({
    description: 'Generate or edit videos using xAI Grok Imagine. Supports text-to-video, image-to-video, and video-edit (modify existing video from conversation). Duration 1-15s. Use videoUrl for edit mode (generated_video_N or filename id).',
    inputSchema: grokVideoInputSchema,
    execute: async ({ model, prompt, imageUrl, videoUrl, duration, aspect_ratio, resolution }: GrokVideoInput) => {
      try {
        const effectiveModel = forcedModel || model;
        await ensureImageMapsInitialized();
        if (effectiveModel === 'video-edit') {
          await ensureVideoMapInitialized();
        }

        let actualImageUrl: string | undefined;
        if (imageUrl) {
          if (imageUrl.startsWith('uploaded_image_')) {
            const resolvedUrl = imageMap?.get(imageUrl) ?? undefined;
            if (!resolvedUrl) throw new Error(`Image reference "${imageUrl}" not found`);
            actualImageUrl = await resolveUploadedImageUrl(resolvedUrl);
          } else if (imageUrl.startsWith('generated_image_')) {
            const imgData = generatedImageMap?.get(imageUrl);
            if (!imgData) throw new Error(`Generated image reference "${imageUrl}" not found`);
            actualImageUrl = await resolveGeneratedImageUrl(imgData);
          } else {
            actualImageUrl = imageUrl;
          }
        }

        let actualVideoUrl: string | undefined;
        if (effectiveModel === 'video-edit' && videoUrl) {
          actualVideoUrl = videoMap?.get(videoUrl) ?? (videoUrl.startsWith('http') ? videoUrl : undefined);
          if (!actualVideoUrl) throw new Error(`Video reference "${videoUrl}" not found in conversation. Use generated_video_N or a previous video filename id.`);
        }

        if (actualImageUrl) {
          logImageMapping('GROK_VIDEO', prompt, imageUrl, [actualImageUrl]);
        }

        const isImageToVideo = effectiveModel === 'image-to-video';
        const isVideoEdit = effectiveModel === 'video-edit';

        if (dataStream) {
          dataStream.write({
            type: 'data-grok_video_started',
            id: `ann-grok-start-${Date.now()}`,
            data: { prompt, model: effectiveModel, imageUrl, resolvedImageUrl: actualImageUrl, videoUrl, resolvedVideoUrl: actualVideoUrl, duration, aspect_ratio, resolution, started: true },
          });
        }

        const apiKey = process.env.XAI_API_KEY;
        if (!apiKey) throw new Error('XAI_API_KEY is not set');

        let requestId: string;

        if (isVideoEdit) {
          const editRes = await fetch(`${XAI_API_BASE}/videos/edits`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({ prompt, video: { url: actualVideoUrl }, model: 'grok-imagine-video' }),
          });
          if (!editRes.ok) throw new Error(`xAI edit API error: ${editRes.status} - ${await editRes.text()}`);
          const editData = await editRes.json();
          requestId = editData.request_id;
          if (!requestId) throw new Error('xAI did not return request_id');
        } else {
          const body: Record<string, unknown> = {
            prompt,
            model: 'grok-imagine-video',
            ...(duration != null && { duration }),
            ...(aspect_ratio && { aspect_ratio }),
            ...(resolution && { resolution }),
          };
          if (isImageToVideo && actualImageUrl) {
            body.image = { url: actualImageUrl };
          }
          const genRes = await fetch(`${XAI_API_BASE}/videos/generations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify(body),
          });
          if (!genRes.ok) throw new Error(`xAI generations API error: ${genRes.status} - ${await genRes.text()}`);
          const genData = await genRes.json();
          requestId = genData.request_id;
          if (!requestId) throw new Error('xAI did not return request_id');
        }

        const pollStartTime = Date.now();
        let lastStatus = 'processing';
        let lastProgressUpdate = 0;
        let videoUrlResult: string | null = null;

        while (Date.now() - pollStartTime < XAI_MAX_POLL_TIME) {
          const pollRes = await fetch(`${XAI_API_BASE}/videos/${requestId}`, {
            headers: { 'Authorization': `Bearer ${apiKey}` },
          });
          if (!pollRes.ok) throw new Error(`xAI poll error: ${pollRes.status} - ${await pollRes.text()}`);
          const pollData = await pollRes.json();
          const status = pollData.status ?? pollData.state;
          const elapsedSeconds = Math.floor((Date.now() - pollStartTime) / 1000);
          if (dataStream && (status !== lastStatus || elapsedSeconds - lastProgressUpdate >= 10)) {
            dataStream.write({
              type: 'data-grok_video_progress',
              id: `ann-grok-progress-${Date.now()}`,
              data: { status, elapsedSeconds, requestId },
            });
            lastStatus = status;
            lastProgressUpdate = elapsedSeconds;
          }
          // URL 체크: pollData.video.url (중첩 구조), pollData.url, pollData.video_url 모두 확인
          const url = pollData.video?.url ?? pollData.url ?? pollData.video_url;
          // 완료 조건: status가 'completed'/'succeeded'이거나, status가 없지만 URL이 존재하는 경우
          // (실제 API 응답: status 없이 video.url만 있는 경우가 있음)
          if (status === 'completed' || status === 'succeeded' || (!status && url)) {
            if (url) {
              videoUrlResult = url;
              break;
            }
          }
          if (status === 'failed') throw new Error(`xAI video failed: ${JSON.stringify(pollData)}`);
          await new Promise(r => setTimeout(r, XAI_POLL_INTERVAL));
        }

        if (!videoUrlResult) {
          const elapsed = Math.floor((Date.now() - pollStartTime) / 1000);
          throw new Error(`xAI video timed out or no URL. Elapsed: ${elapsed}s. Request ID: ${requestId}`);
        }

        const videoData = await downloadVideo(videoUrlResult);
        const { path, url } = await uploadVideoToSupabase(videoData, userId || 'anonymous');
        const videoResult = {
          videoUrl: url,
          path,
          bucket: 'generated-videos',
          prompt,
          timestamp: new Date().toISOString(),
          resolution,
          duration: duration ?? undefined,
          aspect_ratio,
          isImageToVideo,
          isVideoEdit,
          sourceImageUrl: actualImageUrl,
          sourceVideoUrl: actualVideoUrl,
        };
        generatedVideos.push(videoResult);
        if (dataStream) {
          dataStream.write({
            type: 'data-grok_video_complete',
            id: `ann-grok-complete-${Date.now()}`,
            data: videoResult,
          });
        }
        return {
          success: true,
          videos: [videoResult],
          count: 1,
          prompt,
          model: effectiveModel,
          resolution,
          duration,
          aspect_ratio,
        };
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error('[GROK_VIDEO] Error:', errMsg);
        if (dataStream) {
          dataStream.write({
            type: 'data-grok_video_error',
            id: `ann-grok-error-${Date.now()}`,
            data: { error: errMsg, prompt },
          });
        }
        return { success: false, error: errMsg, prompt };
      }
    },
  });

  return Object.assign(grokVideoTool, { generatedVideos });
}
