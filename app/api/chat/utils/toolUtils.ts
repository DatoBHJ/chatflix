import { 
  createWebSearchTool, 
  createJinaLinkReaderTool, 
  createCalculatorTool, 
  createYouTubeSearchTool, 
  createYouTubeLinkAnalyzerTool, 
  createGoogleSearchTool,
  createGeminiImageTool,
  createSeedreamImageTool,
  // createQwenImageTool,
  createTwitterSearchTool,
  createWan25VideoTool,
  createGrokVideoTool,
  createVideoUpscalerTool,
  createImageUpscalerTool,
  createReadFileTool,
  createWriteFileTool,
  createGetFileInfoTool,
  createListWorkspaceTool,
  createDeleteFileTool,
  createGrepFileTool,
  createApplyEditsTool,
  createRunPythonCodeTool,
  createBrowserObserveTool,
} from '../tools';
import { slimRunCodePayload, slimToolResults } from '@/app/utils/prepareMessagesForAPI';

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
  'twitter_search': {
    createFn: createTwitterSearchTool,
    resultKey: 'twitterSearchResults',
    description: 'Advanced Twitter/X search (Latest or Top with full operators)'
  },
  'gemini_image_tool': {
    createFn: (dataStream: any, userId: string, messages: any[], chatId?: string) => createGeminiImageTool(dataStream, userId, messages, chatId),
    resultKey: 'geminiImageResults',
    description: 'Gemini 2.5 Flash image generation & editing'
  },
  'seedream_image_tool': {
    createFn: (dataStream: any, userId: string, messages: any[], chatId?: string) => createSeedreamImageTool(dataStream, userId, messages, chatId),
    resultKey: 'seedreamImageResults',
    description: 'Seedream 4.5 image generation & editing via Replicate'
  },
  // 'qwen_image_edit': {
  //   createFn: (dataStream: any, userId: string, messages: any[], chatId?: string) => createQwenImageTool(dataStream, userId, messages, chatId),
  //   resultKey: 'qwenImageResults',
  //   description: 'Qwen Image Edit 2511 image editing via Replicate'
  // },
  'wan25_video': {
    createFn: (dataStream: any, userId: string, messages: any[], chatId?: string, forcedModel?: 'text-to-video' | 'image-to-video') => createWan25VideoTool(dataStream, userId, messages, chatId, forcedModel),
    resultKey: 'wan25VideoResults',
    description: 'Alibaba Wan 2.5 video generation (text-to-video & image-to-video)'
  },
  'grok_video': {
    createFn: (dataStream: any, userId: string, messages: any[], chatId?: string, forcedModel?: 'text-to-video' | 'image-to-video' | 'video-edit') => createGrokVideoTool(dataStream, userId, messages, chatId, forcedModel),
    resultKey: 'grokVideoResults',
    description: 'xAI Grok Imagine video generation & editing (text-to-video, image-to-video, video-edit)'
  },
  'video_upscaler': {
    createFn: (dataStream: any, userId: string, messages: any[], chatId?: string) => createVideoUpscalerTool(dataStream, userId, messages, chatId),
    resultKey: 'videoUpscalerResults',
    description: 'WaveSpeed FlashVSR video upscaling tool (always 4K output)'
  },
  'image_upscaler': {
    createFn: (dataStream: any, userId: string, messages: any[], chatId?: string) => createImageUpscalerTool(dataStream, userId, messages, chatId),
    resultKey: 'imageUpscalerResults',
    description: 'WaveSpeed Ultimate Image Upscaler (always 8K output)'
  },
  'read_file': {
    createFn: (dataStream: any, chatId: string, supabase: Awaited<ReturnType<typeof import('@/utils/supabase/server').createClient>>) => createReadFileTool(dataStream, chatId, supabase),
    resultKey: 'fileReadResults',
    description: 'Read file contents from the workspace sandbox'
  },
  'write_file': {
    createFn: (dataStream: any, chatId: string, supabase: Awaited<ReturnType<typeof import('@/utils/supabase/server').createClient>>) => createWriteFileTool(dataStream, chatId, supabase),
    resultKey: 'fileWriteResults',
    description: 'Write or overwrite a file in the workspace sandbox'
  },
  'get_file_info': {
    createFn: (dataStream: any, chatId: string, supabase: Awaited<ReturnType<typeof import('@/utils/supabase/server').createClient>>) => createGetFileInfoTool(dataStream, chatId, supabase),
    resultKey: 'fileInfoResults',
    description: 'Get file or directory metadata in the workspace'
  },
  'list_workspace': {
    createFn: (dataStream: any, chatId: string, supabase: Awaited<ReturnType<typeof import('@/utils/supabase/server').createClient>>) => createListWorkspaceTool(dataStream, chatId, supabase),
    resultKey: 'listWorkspaceResults',
    description: 'List workspace file paths'
  },
  'delete_file': {
    createFn: (dataStream: any, chatId: string, supabase: Awaited<ReturnType<typeof import('@/utils/supabase/server').createClient>>) => createDeleteFileTool(dataStream, chatId, supabase),
    resultKey: 'fileDeleteResults',
    description: 'Delete a file from the workspace sandbox'
  },
  'grep_file': {
    createFn: (dataStream: any, chatId: string, supabase: Awaited<ReturnType<typeof import('@/utils/supabase/server').createClient>>) => createGrepFileTool(dataStream, chatId, supabase),
    resultKey: 'grepFileResults',
    description: 'Search inside a file for a pattern (line numbers and content)'
  },
  'apply_edits': {
    createFn: (dataStream: any, chatId: string, supabase: Awaited<ReturnType<typeof import('@/utils/supabase/server').createClient>>) => createApplyEditsTool(dataStream, chatId, supabase),
    resultKey: 'applyEditsResults',
    description: 'Apply multiple line-range edits to a file'
  },
  'run_python_code': {
    createFn: (dataStream: any, chatId: string, supabase: Awaited<ReturnType<typeof import('@/utils/supabase/server').createClient>>) => createRunPythonCodeTool(dataStream, chatId, supabase),
    resultKey: 'runCodeResults',
    description: 'Run Python code for data analysis and charts in the workspace sandbox'
  },
  'browser_observe': {
    createFn: (dataStream: any, chatId: string, supabase: Awaited<ReturnType<typeof import('@/utils/supabase/server').createClient>>) => createBrowserObserveTool(dataStream, chatId, supabase),
    resultKey: 'observeResults',
    description: 'Open remote browser and capture screenshot/HTML for page-flow debugging'
  }
} as const;

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
  const collected = toolNames.reduce((acc, toolName) => {
    const toolConfig = TOOL_REGISTRY[toolName as keyof typeof TOOL_REGISTRY];
    const tool = tools[toolName];
    
    if (!toolConfig || !tool) return acc;
    
    // AI SDK v5: 도구별 결과 추출 매핑
    const resultMap: Record<string, string> = {
      'calculator': 'calculationSteps',
      'web_search': 'searchResults', 
      'link_reader': 'linkAttempts',
      'youtube_search': 'searchResults',
      'youtube_link_analyzer': 'analysisResults',
      'google_search': 'searchResults',
      'twitter_search': 'searchResults',
      'gemini_image_tool': 'generatedImages',
      'seedream_image_tool': 'generatedImages',
      // 'qwen_image_edit': 'generatedImages',
      'wan25_video': 'generatedVideos',
      'grok_video': 'generatedVideos',
      'video_upscaler': 'generatedVideos',
      'image_upscaler': 'generatedImages',
      'run_python_code': 'runCodeResults',
      'browser_observe': 'observeResults'
    };
    
    const resultKey = resultMap[toolName] || 'results';
    const results = tool[resultKey] || tool.results || tool.data || tool.output;
    
    if (results && (Array.isArray(results) ? results.length > 0 : true)) {
      if (toolName === 'run_python_code' && Array.isArray(results)) {
        acc[toolConfig.resultKey] = results.map((entry: unknown) => slimRunCodePayload(entry));
      } else {
        acc[toolConfig.resultKey] = results;
      }
    }
    
    // Special handling for link_reader to include rawContent
    if (toolName === 'link_reader' && tool.rawContent && Array.isArray(tool.rawContent) && tool.rawContent.length > 0) {
      acc.linkReaderRawContent = tool.rawContent;
    }
    
    return acc;
  }, {} as any);

  return slimToolResults(collected) || {};
}
