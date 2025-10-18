import { 
  createWebSearchTool, 
  createJinaLinkReaderTool, 
  // createImageGeneratorTool, // DISABLED: pollination.ai image generator
  createCalculatorTool, 
  createYouTubeSearchTool, 
  createYouTubeLinkAnalyzerTool, 
  createGoogleSearchTool,
  createGeminiImageTool,
  createSeedreamImageTool,
} from '../tools';

// 🆕 도구 레지스트리 - 모든 도구를 중앙에서 관리
export const TOOL_REGISTRY = {
  'web_search': {
    createFn: createWebSearchTool,
    resultKey: 'webSearchResults',
    description: 'Real-time information from the internet'
  },
  'calculator': {
    createFn: createCalculatorTool,
    resultKey: 'calculationSteps',
    description: 'Mathematical calculations and computations'
  },
  'link_reader': {
    createFn: createJinaLinkReaderTool,
    resultKey: 'linkReaderAttempts',
    description: 'Reading and analyzing web page content'
  },
  // 'image_generator': { // DISABLED: pollination.ai image generator
  //   createFn: createImageGeneratorTool,
  //   resultKey: 'generatedImages',
  //   description: 'Creating visual content'
  // },

  'youtube_search': {
    createFn: createYouTubeSearchTool,
    resultKey: 'youtubeSearchResults',
    description: 'Searching YouTube videos and content'
  },
  'youtube_link_analyzer': {
    createFn: createYouTubeLinkAnalyzerTool,
    resultKey: 'youtubeLinkAnalysisResults',
    description: 'Analyzing YouTube video content and metadata'
  },
  'google_search': {
    createFn: createGoogleSearchTool,
    resultKey: 'googleSearchResults',
    description: 'Google search using SearchAPI for comprehensive web results'
  },
  'gemini_image_tool': {
    createFn: (dataStream: any, userId: string, messages: any[]) => createGeminiImageTool(dataStream, userId, messages),
    resultKey: 'geminiImageResults',
    description: 'Gemini 2.5 Flash image generation & editing'
  },
  'seedream_image_tool': {
    createFn: (dataStream: any, userId: string, messages: any[]) => createSeedreamImageTool(dataStream, userId, messages),
    resultKey: 'seedreamImageResults',
    description: 'Seedream 4.0 image generation & editing via Replicate'
  }
  // 'x_search': {
  //   createFn: createXSearchTool,
  //   resultKey: 'xSearchResults',
  //   description: 'X (Twitter) social media search'
  // }
} as const;

/**
 * AI SDK v5: 간소화된 도구 초기화 함수
 */
// export function initializeTool(type: string, dataStream: any, userId?: string, messages?: any[]) {
//   const toolConfig = TOOL_REGISTRY[type as keyof typeof TOOL_REGISTRY];
//   if (!toolConfig) {
//     throw new Error(`Unknown tool type: ${type}`);
//   }
  
//   if (type === 'gemini_image_tool' && userId && messages) {
//     return toolConfig.createFn(dataStream, userId, messages);
//   }
  
//   return (toolConfig.createFn as any)(dataStream);
// }

/**
 * AI SDK v5: 간소화된 도구 유틸리티 함수들
 */
export const getAvailableTools = () => Object.keys(TOOL_REGISTRY);

export const getToolDescriptions = () => Object.fromEntries(
  Object.entries(TOOL_REGISTRY).map(([key, config]) => [key, config.description])
);

/**
 * AI SDK v5: 간소화된 도구 결과 수집 함수
 */
export function collectToolResults(tools: Record<string, any>, toolNames: string[]): any {
  return toolNames.reduce((collected, toolName) => {
    const toolConfig = TOOL_REGISTRY[toolName as keyof typeof TOOL_REGISTRY];
    const tool = tools[toolName];
    
    if (!toolConfig || !tool) return collected;
    
    // AI SDK v5: 도구별 결과 추출 매핑
    const resultMap: Record<string, string> = {
      'calculator': 'calculationSteps',
      'web_search': 'searchResults', 
      'link_reader': 'linkAttempts',
      // 'image_generator': 'generatedImages', // DISABLED: pollination.ai image generator
      'youtube_search': 'searchResults',
      'youtube_link_analyzer': 'analysisResults',
      'google_search': 'searchResults',
      'gemini_image_tool': 'generatedImages',
      'seedream_image_tool': 'generatedImages'
    };
    
    const resultKey = resultMap[toolName] || 'results';
    const results = tool[resultKey] || tool.results || tool.data || tool.output;
    
    if (results && (Array.isArray(results) ? results.length > 0 : true)) {
      collected[toolConfig.resultKey] = results;
    }
    
    // Special handling for link_reader to include rawContent
    if (toolName === 'link_reader' && tool.rawContent && Array.isArray(tool.rawContent) && tool.rawContent.length > 0) {
      collected.linkReaderRawContent = tool.rawContent;
    }
    
    return collected;
  }, {} as any);
}
