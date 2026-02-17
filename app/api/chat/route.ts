import {
  streamText,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateObject,
  type ModelMessage,
  smoothStream,
  NoSuchToolError,
  generateId,
  stepCountIs,
} from 'ai';
import { createClient } from '@/utils/supabase/server';
import { providers } from '@/lib/providers';
import { getModelById, getModelByIdWithReasoningEffort, parseModelVariantId, resolveDefaultModelVariantId} from '@/lib/models/config';

import { 
  saveCompletedMessages,
  buildSystemPrompt,
  getCachedUserMemory,
  getFileEditToolIds
} from './services/chatService';
import {
  getProviderFromModel,
  extractTextFromMessage,
  processMessagesForAI,
  removeExtraContentFromMessages,
} from './utils/messageUtils';
import { refreshChatAttachmentUrlsInMessages } from './utils/refreshChatAttachmentUrls';
import { 
  TOOL_REGISTRY,
  getAvailableTools,
} from './utils/toolUtils';
import { handleRateLimiting, handleChatflixRateLimiting } from './utils/ratelimit';
import { checkSubscriptionFromDatabase } from '@/lib/subscription-db';
import { getProviderOptionsWithTools } from './utils/providerOptions';
import { processCompletionArtifacts } from './services/responsePostProcessor';

// 메모리 관련 import
import { smartUpdateMemoryBanks } from './services/memoryService';
import { selectOptimalModel } from './services/modelSelector';
import { estimateMultiModalTokens } from '@/utils/context-manager';
import { compressContextIfNeeded } from '@/utils/context-summarizer';
import { estimatePayloadBytes } from '@/app/utils/prepareMessagesForAPI';
import { stripHistoricalSearchFromMessages } from '@/utils/stripHistoricalSearch';
// import { markdownJoinerTransform } from './markdown-transform';

// Vercel Pro 플랜 + fluid compute: 최대 800초 (13분 20초)까지 가능
export const maxDuration = 800;
export const dynamic = 'force-dynamic';
const MAX_PARSED_CHAT_REQUEST_BYTES = 12 * 1024 * 1024;

// 🚀 익명 사용자용 UUID 생성 함수
function generateAnonymousUserId(): string {
  // UUID v4 형식으로 익명 사용자 ID 생성
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Helper function to increment user daily request count
async function incrementSuccessfulRequestCount(
  supabaseClient: any,
  userId: string,
  requestDate: string,
  currentCount: number,
  isUserSubscribed: boolean
) {
  try {
    await supabaseClient
      .from('user_daily_requests')
      .upsert({
        user_id: userId,
        date: requestDate,
        count: currentCount + 1,
        last_request_at: new Date().toISOString(),
        is_subscribed: isUserSubscribed
      }, {
        onConflict: 'user_id,date' 
      });
  } catch (error) {
    // Error handling - request count update is non-critical
  }
}

function enforcePayloadBudget(
  messages: ModelMessage[],
  systemPrompt: string,
  modelId: string,
  maxBytes = 1_900_000,
): ModelMessage[] {
  const maxPromptTokens = (() => {
    const id = (modelId || '').toLowerCase();
    if (id.includes('claude') || id.includes('anthropic')) return 165_000;
    return 190_000;
  })();
  const buildPayload = (msgs: ModelMessage[]) => ({
    model: modelId,
    system: systemPrompt,
    messages: msgs,
  });
  const estimatePromptTokens = (msgs: ModelMessage[]) => {
    const systemTokens = Math.ceil((systemPrompt?.length || 0) / 4);
    const messageTokens = msgs.reduce((sum, msg) => {
      try {
        return sum + estimateMultiModalTokens(msg as any);
      } catch {
        return sum + 0;
      }
    }, 0);
    return systemTokens + messageTokens;
  };

  let trimmed = [...messages];
  let bytes = estimatePayloadBytes(buildPayload(trimmed));
  let tokens = estimatePromptTokens(trimmed);
  if (bytes <= maxBytes && tokens <= maxPromptTokens) return trimmed;

  // Prefer dropping oldest messages first while preserving the latest turn context.
  while (trimmed.length > 6 && (bytes > maxBytes || tokens > maxPromptTokens)) {
    trimmed = trimmed.slice(1);
    bytes = estimatePayloadBytes(buildPayload(trimmed));
    tokens = estimatePromptTokens(trimmed);
  }

  return trimmed;
}


export async function POST(req: Request): Promise<Response> {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  // 🚀 익명 사용자 지원: 로그인하지 않은 사용자도 기본 채팅 기능 사용 가능
  if (userError) {
    // AuthSessionMissingError(400)은 익명 시 정상 동작이므로 로깅하지 않음
    const status = (userError as any)?.status;
    const errorMessage = (userError as any)?.message;
    
    // 게스트 모드에서 발생하는 일반적인 auth 에러들은 로깅하지 않음
    if (status && status !== 400 && 
        !errorMessage?.includes('Auth session missing') &&
        !errorMessage?.includes('session not found')) {
      console.error('Auth error:', userError);
    }
    // 익명 사용자로 처리 계속 진행
  }
  
  // 익명 사용자 헤더 확인
  const isAnonymousUser = !user;
  const anonymousUserId = req.headers.get('X-Anonymous-Id') || generateAnonymousUserId();

  const contentLengthHeader = req.headers.get('content-length');
  if (contentLengthHeader) {
    const contentLength = Number(contentLengthHeader);
    if (Number.isFinite(contentLength) && contentLength > MAX_PARSED_CHAT_REQUEST_BYTES) {
      return Response.json(
        {
          error: 'Request payload too large',
          detail: 'Please shorten the conversation or remove heavy tool outputs before retrying.',
        },
        { status: 413 },
      );
    }
  }

  let requestData: any;
  try {
    requestData = await req.json();
  } catch {
    return Response.json(
      {
        error: 'Invalid request body',
        detail: 'Request body was truncated or malformed. Please retry with a smaller conversation payload.',
      },
      { status: 413 },
    );
  }
  const parsedBodyBytes = estimatePayloadBytes(requestData);
  if (parsedBodyBytes > MAX_PARSED_CHAT_REQUEST_BYTES) {
    return Response.json(
      {
        error: 'Request payload too large',
        detail: 'Please shorten the conversation or remove heavy tool outputs before retrying.',
      },
      { status: 413 },
    );
  }
  
  // Track client aborts and wire to internal streams
  let abortedByClient = false;
  let internalAbortController: AbortController | null = null;
  try {
    // In Next.js/Fetch, Request has an AbortSignal
    const reqSignal: any = (req as any).signal;
    if (reqSignal && typeof reqSignal.addEventListener === 'function') {
      reqSignal.addEventListener('abort', () => {
        abortedByClient = true;
        try { internalAbortController?.abort(); } catch {}
      });
    }
  } catch {}
  let { messages, model, chatId, isRegeneration, existingMessageId, saveToDb = true, isAgentEnabled = false, selectedTool, experimental_attachments } = requestData;
  let resolvedModelVariant: string | undefined;

  const normalizeModelId = (modelId: string) => {
    resolvedModelVariant = modelId;
    const { baseId } = parseModelVariantId(modelId);
    return baseId;
  };

  model = normalizeModelId(model);
  
  // === CHAT ID VALIDATION ===
  // Trust the client-provided chatId - it's generated by nanoid on the client
  // This ensures client and server stay in sync for edit/regenerate operations
  if (!chatId || chatId.trim() === '') {
    return new Response('Invalid chatId', { status: 400 });
  }
  chatId = chatId.trim();
  
  // 🚀 첨부파일 처리: 마지막 사용자 메시지에 experimental_attachments 추가
  if (experimental_attachments && experimental_attachments.length > 0 && messages.length > 0) {
    const lastUserMessage = messages[messages.length - 1];
    if (lastUserMessage.role === 'user') {
      lastUserMessage.experimental_attachments = experimental_attachments;
    }
  }

  // 원본 메시지 배열 보존 (모든 스코프에서 사용 가능)
  const originalMessages = messages.slice();

  // Strip historical search outputs from the LLM context to avoid context_length_exceeded.
  // We keep the latest assistant+user turn intact (last user message plus its preceding assistant).
  messages = stripHistoricalSearchFromMessages(messages, {
    keepLastTurns: 1,
    leavePlaceholder: false,
    stripSearchPartsInKeptTurns: true,
  });

  // Map Chatflix Ultimate model to appropriate model based on agent mode
  if (model === 'chatflix-ultimate' || model === 'chatflix-ultimate-pro') {
      // Store the original model name for DB storage
      requestData.originalModel = model;
      
      try {
        const modelType = model as 'chatflix-ultimate' | 'chatflix-ultimate-pro';
        const { selectedModel } = await selectOptimalModel(messages, modelType);
        model = normalizeModelId(selectedModel);
        
        // 🆕 에이전트 모드에서만 Kimi K2를 gemini-2.5-flash로 대체
        if (isAgentEnabled && model === 'accounts/fireworks/models/kimi-k2p5-none') {
          model = 'gemini-2.5-flash';
        }
      } catch (error) {
        const fallbackVariant = resolveDefaultModelVariantId('gemini-3-pro-preview');
        model = normalizeModelId(fallbackVariant);
      }
    }

  if (resolvedModelVariant) {
    requestData.resolvedModelVariant = resolvedModelVariant;
  }

  const executionModelId = resolvedModelVariant || model;

  // 구독 상태 확인 (데이터베이스 기반) - 익명 사용자는 바로 false로 처리하여 불필요한 DB/Polar/Redis 호출 제거
  const isSubscribed = isAnonymousUser
    ? false
    : await checkSubscriptionFromDatabase(user!.id);
  
  // Helper function to parse model ID and get model config
  const parseModelIdAndGetConfig = (modelId: string) => {
    const { baseId, reasoningEffort } = parseModelVariantId(modelId);
    if (reasoningEffort) {
      return getModelByIdWithReasoningEffort(baseId, reasoningEffort);
    }
    return getModelById(baseId);
  };
  
  // 사용자의 오늘 요청 횟수 확인
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD 형식
  const { data: userRequests } = await supabase
    .from('user_daily_requests')
    .select('count')
    .eq('user_id', user?.id || anonymousUserId)
    .eq('date', today)
    .single();
  
  // 현재 요청 횟수 (없으면 0으로 시작)
  const currentRequestCount = userRequests?.count || 0;

  // 🆕 Handle rate limiting based on model type
  const originalModel = requestData.originalModel;
  const isChatflixModel = originalModel === 'chatflix-ultimate' || originalModel === 'chatflix-ultimate-pro';
  
  if (isChatflixModel) {
    // Chatflix 모델은 자체 rate limit만 체크 (선택된 개별 모델 rate limit 무시)
    const chatflixRateLimitResult = await handleChatflixRateLimiting(user?.id || anonymousUserId, originalModel, isSubscribed);
    if (!chatflixRateLimitResult.success) {
      const { error } = chatflixRateLimitResult;
      
      if (error) {
        return new Response(JSON.stringify({
          error: 'Too many requests',
          message: error.message,
          retryAfter: error.retryAfter,
          reset: new Date(error.reset).toISOString(),
          limit: error.limit,
          level: error.level,
          model: originalModel, // Use original Chatflix model name
          isSubscribed: isSubscribed // 구독 상태 포함
        }), {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': error.limit.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(error.reset).toISOString(),
          }
        });
      }
    }
  } else {
    // 일반 모델은 기존 로직 사용 (익명 사용자도 rate limit 체크 적용)
    // 🔧 FIX: resolvedModelVariant를 사용하여 variant ID로 rate limit 체크
    // model은 이미 normalizeModelId로 baseId로 변환되었으므로, variant ID가 필요함
    const modelForRateLimit = resolvedModelVariant || requestData.model || model;
    const rateLimitResult = await handleRateLimiting(user?.id || anonymousUserId, modelForRateLimit, isSubscribed);
    if (!rateLimitResult.success) {
      const { error } = rateLimitResult;
      
      if (error) {
        return new Response(JSON.stringify({
          error: 'Too many requests',
          message: error.message,
          retryAfter: error.retryAfter,
          reset: new Date(error.reset).toISOString(),
          limit: error.limit,
          level: error.level,
          model: model,
          isSubscribed: isSubscribed // 구독 상태 포함
        }), {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': error.limit.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(error.reset).toISOString(),
          }
        });
      } else {
        // Fallback in case error is undefined
        return new Response(JSON.stringify({
          error: 'Too many requests',
          message: 'Rate limit exceeded',
          isSubscribed: isSubscribed // 구독 상태 포함
        }), {
          status: 429,
          headers: {
            'Content-Type': 'application/json'
          }
        });
      }
    }
  }

  let globalCollectedToolResults: any = {}; // Store tool results globally
  
  const stream = createUIMessageStream({
    // Preserve full originals for persistence/memory bookkeeping.
    originalMessages,
    execute: async ({ writer }): Promise<void> => {
        // 🚀 AI 응답 즉시 시작 (세션 처리와 완전 분리)
        const processMessages = [...messages];

        // 🚀 서버-측 ID 생성: 기본은 서버에서 생성, 재생성만 기존 ID 유지
        let assistantMessageId: string;
        if (isRegeneration && existingMessageId) {
          // 재생성: 기존 메시지 ID 유지 (덮어쓰기)
          assistantMessageId = existingMessageId;
        } else {
          // 새 메시지/편집 후 전송: 서버에서 새로 생성
          assistantMessageId = generateId();
        }

        // 🚀 서버-측 ID를 스트림 start 이벤트에서 즉시 전송
        writer.write({
          type: 'start',
          messageId: assistantMessageId,
        });

        // Expose for onError/onFinish handlers
        // assistantMessageIdGlobal = assistantMessageId;

        const abortController = new AbortController();
        // expose the internal controller for client abort wiring
        internalAbortController = abortController;

        // Track aborts so downstream save logic can allow partial storage when needed
        abortController.signal.addEventListener('abort', () => {
          abortedByClient = true;
        });

        // Get model config using the helper function
        const modelConfig = parseModelIdAndGetConfig(executionModelId);

        // 3. 향상된 시스템 프롬프트 (캐시된 메모리 사용) - 에러 시에도 계속 진행
        // 🚀 최적화: 클라이언트에서 전달된 메모리를 우선 사용 (localStorage 캐시 활용)
        let userMemory = requestData.userMemory || null;
        
        // 클라이언트에서 메모리를 전달하지 않은 경우에만 서버에서 로드
        if (!userMemory && !isAnonymousUser) {
          userMemory = await getCachedUserMemory(user?.id || anonymousUserId);
        }
        
        // 🔧 MEDIUM PRIORITY OPTIMIZATION: 메시지별 토큰 미리 계산 및 캐싱
        const messagesWithTokens = processMessages.map(msg => {
          const tokenCount = estimateMultiModalTokens(msg as any);
          return {
            ...msg,
            _tokenCount: tokenCount
          };
        });
        
        if (isAgentEnabled) {
          const optimizedMessagesForRouting = messagesWithTokens;

          // 현재 질문 추출을 위한 준비
          let userQuery = '';
          
          // 현재 질문만 userQuery에 할당
          const currentMessage = optimizedMessagesForRouting[optimizedMessagesForRouting.length - 1];
          userQuery = extractTextFromMessage(currentMessage);

          // 🆕 사용자가 직접 도구를 선택한 경우 vs 자동 라우팅
          let selectedActiveTools: Array<keyof typeof TOOL_REGISTRY>;
          
          
          if (selectedTool && selectedTool !== 'file_upload') {
            // 사용자가 직접 도구를 선택한 경우
            // 웹서치 토픽인 경우 처리
            if (selectedTool.startsWith('web_search:')) {
              const topic = selectedTool.split(':')[1];
              
              // 웹서치 도구에 특정 토픽을 강제로 설정
              selectedActiveTools = ['web_search'] as Array<keyof typeof TOOL_REGISTRY>;
              
              // 웹서치 도구 생성 시 사용할 토픽 정보를 저장
              (writer as any)._selectedWebSearchTopic = topic;
            } else if (selectedTool === 'google-images') {
              // Google Images 도구 선택 시 처리
              // Google Search 도구에 google_images 엔진을 강제로 설정
              selectedActiveTools = ['google_search'] as Array<keyof typeof TOOL_REGISTRY>;
              
              // Google Search 도구 생성 시 사용할 엔진 정보를 저장
              (writer as any)._selectedGoogleSearchEngine = 'google_images';
            } else if (selectedTool === 'google-videos') {
              // Google Videos 도구 선택 시 처리
              // Google Search 도구에 google_videos 엔진을 강제로 설정
              selectedActiveTools = ['google_search'] as Array<keyof typeof TOOL_REGISTRY>;
              
              // Google Search 도구 생성 시 사용할 엔진 정보를 저장
              (writer as any)._selectedGoogleSearchEngine = 'google_videos';
            } else if (selectedTool === 'wan25_text_to_video') {
              // Wan 2.5 Text to Video 선택 시 처리
              selectedActiveTools = ['wan25_video'] as Array<keyof typeof TOOL_REGISTRY>;
              (writer as any)._selectedWan25VideoModel = 'text-to-video';
            } else if (selectedTool === 'wan25_image_to_video') {
              // Wan 2.5 Image to Video 선택 시 처리
              selectedActiveTools = ['wan25_video'] as Array<keyof typeof TOOL_REGISTRY>;
              (writer as any)._selectedWan25VideoModel = 'image-to-video';
            } else if (selectedTool === 'grok_text_to_video') {
              selectedActiveTools = ['grok_video'] as Array<keyof typeof TOOL_REGISTRY>;
              (writer as any)._selectedGrokVideoModel = 'text-to-video';
            } else if (selectedTool === 'grok_image_to_video') {
              selectedActiveTools = ['grok_video'] as Array<keyof typeof TOOL_REGISTRY>;
              (writer as any)._selectedGrokVideoModel = 'image-to-video';
            } else if (selectedTool === 'grok_video_edit') {
              selectedActiveTools = ['grok_video'] as Array<keyof typeof TOOL_REGISTRY>;
              (writer as any)._selectedGrokVideoModel = 'video-edit';
            } else if (selectedTool === 'video_upscaler') {
              selectedActiveTools = ['video_upscaler'] as Array<keyof typeof TOOL_REGISTRY>;
            } else if (selectedTool === 'image_upscaler') {
              selectedActiveTools = ['image_upscaler'] as Array<keyof typeof TOOL_REGISTRY>;
            } else if (selectedTool === 'workspace') {
              selectedActiveTools = getFileEditToolIds() as Array<keyof typeof TOOL_REGISTRY>;
            } else if (selectedTool === 'browser_observe') {
              selectedActiveTools = ['browser_observe', 'run_python_code', 'gemini_image_tool'] as Array<keyof typeof TOOL_REGISTRY>;
            } else {
              // 일반 도구인 경우
              selectedActiveTools = [selectedTool] as Array<keyof typeof TOOL_REGISTRY>;
            }
          } else {
            // 🚀 모든 도구 허용 (라우팅 분석 생략)
            const allAvailableTools = getAvailableTools();
            selectedActiveTools = allAvailableTools as Array<keyof typeof TOOL_REGISTRY>;
            
            // 🔧 기존 라우팅 분석 코드 (주석 처리 - 필요시 복원 가능)
            /*
            // 자동 라우팅 사용
            const baseAvailableToolsList = getAvailableTools();
            const analysisModel = 'gemini-2.5-flash-lite';
            const toolDescriptions = getToolDescriptions();

            // 🚀 V6 Plan: New unified analysis and routing
            // 🔧 FIX: Use unified converter for analysis
            const messagesForAnalysis = convertToModelMessages(messagesWithTokens);

            const routeAnalysisResult = await analyzeRequestAndDetermineRoute(
              analysisModel,
              model,
              baseAvailableToolsList,
              messagesForAnalysis, // Use converted messages for routing analysis
              toolDescriptions
            );
            
            const routingDecision = routeAnalysisResult.object;
            selectedActiveTools = addToolsWithPreviousResults(routingDecision.tools);
            */
          }
              
          // Provider options with tools
          const providerOptions = getProviderOptionsWithTools(
            executionModelId,
            modelConfig,
            user?.id || anonymousUserId,
            selectedActiveTools.length > 0,
            chatId
          );

          // RESPOND: 도구 실행 모델 결정
          let toolExecutionModel = executionModelId;
          const maxAgentSteps = selectedActiveTools.length > 0 ? 30 : 3;

          // 🆕 AI SDK v5: 전체 도구 세트 정의 + 활성 도구 제한
          // 🔥 chatId 추가: 이미지/비디오 도구에서 DB에서 전체 메시지 가져와 imageMap 구축 (가상화 문제 해결)
          const allTools = Object.fromEntries(
            Object.entries(TOOL_REGISTRY).map(([toolName, config]) => [
              toolName,
              toolName === 'web_search' && (writer as any)._selectedWebSearchTopic
                ? (config.createFn as any)(writer, (writer as any)._selectedWebSearchTopic) // 웹서치에 강제 토픽 전달
                : toolName === 'google_search' && (writer as any)._selectedGoogleSearchEngine
                ? (config.createFn as any)(writer, (writer as any)._selectedGoogleSearchEngine) // Google Search에 강제 엔진 전달
                : toolName === 'gemini_image_tool'
                ? (config.createFn as any)(writer, user?.id || anonymousUserId, messagesWithTokens, chatId) // chatId 추가
                : toolName === 'seedream_image_tool'
                ? (config.createFn as any)(writer, user?.id || anonymousUserId, messagesWithTokens, chatId) // chatId 추가
                // : toolName === 'qwen_image_edit'
                // ? (config.createFn as any)(writer, user?.id || anonymousUserId, messagesWithTokens, chatId) // chatId 추가
                : toolName === 'wan25_video'
                ? (config.createFn as any)(writer, user?.id || anonymousUserId, messagesWithTokens, chatId, (writer as any)._selectedWan25VideoModel) // forcedModel 전달
                : toolName === 'grok_video'
                ? (config.createFn as any)(writer, user?.id || anonymousUserId, messagesWithTokens, chatId, (writer as any)._selectedGrokVideoModel) // forcedModel 전달
                : toolName === 'video_upscaler'
                ? (config.createFn as any)(writer, user?.id || anonymousUserId, messagesWithTokens, chatId)
                : toolName === 'image_upscaler'
                ? (config.createFn as any)(writer, user?.id || anonymousUserId, messagesWithTokens, chatId)
                : ['db_search_tool_results', 'db_read_tool_result_window'].includes(toolName)
                ? (config.createFn as any)(writer, chatId, user?.id || anonymousUserId, supabase)
                : [...getFileEditToolIds(), 'run_python_code', 'browser_observe'].includes(toolName)
                ? (config.createFn as any)(writer, chatId, supabase) // file-edit / code run: sandbox per chat
                : (config.createFn as any)(writer)
            ])
          );
          
          // 시스템 프롬프트 설정 (캐시된 메모리 사용)
          const agentSystemPrompt = buildSystemPrompt(
            'agent', 
            userMemory,
            {
              selectedTools: selectedActiveTools,
              forcedWebSearchTopic: (writer as any)._selectedWebSearchTopic,
              isAnonymousUser,
              isSubscribed
            }
          );

          // 🆕 STEP 2: Prepare optimized messages for final execution
          // 🔧 Context compression: Summarize if exceeding 80% of context window
          const { finalMessages: compressedMessages } = await compressContextIfNeeded(
            messagesWithTokens,
            agentSystemPrompt,
            executionModelId,
            supabase,
            chatId,
            isAnonymousUser
          );
          
          // chat_attachments signed URL 갱신 (AI SDK 다운로드 시 400 InvalidJWT 방지)
          const messagesWithFreshUrls = await refreshChatAttachmentUrlsInMessages(compressedMessages);
          // 파일 편집/코드 실행 도구 사용 시: 사용자 첨부 파일을 샌드박스에 업로드하고 워크스페이스 경로 추적
          const fileAndCodeToolIds = [...getFileEditToolIds(), 'run_python_code', 'browser_observe'];
          const hasFileEditTools = selectedActiveTools.some((t: string) => fileAndCodeToolIds.includes(t));
          let messagesForProcess = messagesWithFreshUrls;
          if (hasFileEditTools && messagesWithFreshUrls.length > 0) {
            const { uploadMessageAttachmentsToSandbox, getWorkspaceContextText, workspacePathForFilename } = await import('./lib/sandboxService');
            // Upload attachments from ALL user messages (not just last) so that
            // files from earlier messages are restored when the sandbox has expired.
            const userMessages = messagesWithFreshUrls.filter((m: any) => m.role === 'user');
            for (const userMsg of userMessages) {
              await uploadMessageAttachmentsToSandbox(chatId, userMsg, supabase);
            }
            messagesForProcess = messagesWithFreshUrls.map((m: any) => ({ ...m, parts: Array.isArray(m.parts) ? [...m.parts] : m.parts }));
            const isTextOrCodePart = (part: { type?: string; mediaType?: string; filename?: string }) => {
              if (part.type !== 'file') return false;
              const ct = (part.mediaType || '').toLowerCase();
              const name = part.filename || '';
              if (ct.startsWith('image/') || ct === 'application/pdf') return false;
              const codeExt = /\.(js|ts|jsx|tsx|py|java|c|cpp|cs|go|rb|php|html|css|sql|scala|swift|kt|rs|dart|json|xml|yaml|yml|md|txt|csv)$/i;
              return !!name.match(codeExt) || ct.includes('text/') || ct.includes('javascript') || ct.includes('json');
            };
            // Replace file attachment parts with workspace path hints in ALL user messages
            let lastUserMsgIdx = -1;
            for (let i = 0; i < messagesForProcess.length; i++) {
              const msg = messagesForProcess[i];
              if (msg.role === 'user' && msg.parts && Array.isArray(msg.parts)) {
                lastUserMsgIdx = i;
                msg.parts = msg.parts.map((part: any) => {
                  if (isTextOrCodePart(part)) {
                    const path = workspacePathForFilename(part.filename || 'file');
                    return { type: 'text', text: `Attached file in workspace: ${path}. Use read_file("${path}") to read content.` };
                  }
                  return part;
                });
              }
            }
            const workspaceText = await getWorkspaceContextText(chatId, supabase);
            if (workspaceText && lastUserMsgIdx >= 0 && messagesForProcess[lastUserMsgIdx].parts) {
              messagesForProcess[lastUserMsgIdx].parts.push({ type: 'text', text: workspaceText });
            }
          }
          // 🔧 AI SDK v5: 공통 메시지 처리 함수 사용 (도구 유무와 관계없이 동일)
          const finalMessagesForExecution = await processMessagesForAI(messagesForProcess, executionModelId);
          
          // 🔥 Fireworks API 호환성: extra_content 제거 (API 호출 직전 최종 정리)
          const cleanedMessages = removeExtraContentFromMessages(finalMessagesForExecution, executionModelId);
          const budgetedMessages = enforcePayloadBudget(cleanedMessages, agentSystemPrompt, toolExecutionModel);

          // system prompt 로그
          // console.log('[API Request - Agent Mode] System prompt:', agentSystemPrompt);

          // 🔍 DEBUG: 최종 전달 메시지 로그
          console.log('[API Request - Agent Mode] Final messages being sent to AI:', {
            chatId,
            messageCount: finalMessagesForExecution.length,
            compressedCount: compressedMessages.length,
            messages: finalMessagesForExecution.map((m: any, idx: number) => {
              let fullTextContent = '';
              if (Array.isArray(m.parts)) {
                fullTextContent = m.parts
                  .filter((p: any) => p.type === 'text' && p.text)
                  .map((p: any) => p.text)
                  .join(' ');
              } else if (Array.isArray(m.content)) {
                fullTextContent = m.content
                  .filter((p: any) => p.type === 'text' && p.text)
                  .map((p: any) => p.text)
                  .join(' ');
              } else if (typeof m.content === 'string') {
                fullTextContent = m.content;
              }
              const isSummary = fullTextContent.includes('[Previous Conversation Summary]');
              // 요약 메시지는 전체 내용 출력, 그 외는 300자만
              const displayContent = isSummary 
                ? fullTextContent 
                : (fullTextContent.slice(0, 300) + (fullTextContent.length > 300 ? '...' : ''));
              return {
                index: idx,
                role: m.role,
                isSummary,
                content: displayContent || `[no text - content type: ${Array.isArray(m.content) ? 'array' : typeof m.content}]`,
                contentLength: fullTextContent.length,
                partsCount: Array.isArray(m.parts) ? m.parts.length : 0
              };
            })
          });

          // console.log('agentSystemPrompt', agentSystemPrompt);
          
          // 도구 호출이 있는 경우 텍스트 응답을 조건부로 처리
          const textResponsePromise = streamText({
            model: providers.languageModel(toolExecutionModel),
            experimental_transform: [
              smoothStream({delayInMs: 25}),
              // markdownJoinerTransform(),
            ],
            system: agentSystemPrompt,
            messages: budgetedMessages,
            tools: allTools,
            activeTools: selectedActiveTools,
            providerOptions,
            stopWhen: stepCountIs(maxAgentSteps),
            toolChoice: 'auto',
            maxRetries: 20,
            abortSignal: abortController.signal,
            experimental_repairToolCall: async ({ toolCall, tools, inputSchema, error }) => {
              if (NoSuchToolError.isInstance(error)) {
                return null; // do not attempt to fix invalid tool names
              }

              const tool = tools[toolCall.toolName as keyof typeof tools];

              // Pre-process the input to handle JSON string cases
              let processedInput = toolCall.input;
              if (typeof toolCall.input === 'string') {
                try {
                  processedInput = JSON.parse(toolCall.input);
                } catch {
                  // If it's not valid JSON, keep as is
                }
              }

              const { object: repairedArgs } = await generateObject({
                model: providers.languageModel('accounts/fireworks/models/kimi-k2p5'),
                schema: tool.inputSchema,
                prompt: [
                  `The model tried to call the tool "${toolCall.toolName}" with the following arguments:`,
                  JSON.stringify(processedInput),
                  `The tool accepts the following schema:`,
                  JSON.stringify(inputSchema(toolCall)),
                  'Please fix the arguments to match the schema exactly.',
                  'Ensure all required fields are provided and data types are correct.',
                  'If you see JSON strings that should be arrays, parse them properly.',
                  `Today's date is ${new Date().toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}`,
                ].join('\n'),
              });

              return { ...toolCall, args: JSON.stringify(repairedArgs) };
            },
            onChunk: process.env.NODE_ENV === 'development' ? (event) => {
              const { chunk } = event;
              if (chunk?.type === 'tool-call' || chunk?.type === 'tool-result') {
                // 개발 환경에서만 도구 호출 로깅
              }
            } : undefined,
            onFinish: async (completion) => {
              if (abortController.signal.aborted) return;
              
              // 🚀 최적화: 요청 카운트 증가를 비동기로 처리 (사용자 응답 블로킹 방지)
              incrementSuccessfulRequestCount(supabase, user?.id || anonymousUserId, today, currentRequestCount, isSubscribed)
                .catch(error => console.error('Failed to increment request count:', error));
             
              const { collectedToolResults } = await processCompletionArtifacts({
                writer,
                assistantMessageId,
                userQuery,
                completion,
                userMemory,
                isAnonymousUser,
                allTools,
                selectedActiveTools,
              });

              globalCollectedToolResults = { ...collectedToolResults };
            }
          });

          // textResponsePromise.consumeStream(); // 🚀 AI SDK v5: toUIMessageStream internally handles consumption
          writer.merge(textResponsePromise.toUIMessageStream({
            sendReasoning: true,
            sendStart: false, // 🚀 서버-측 ID 사용을 위해 자체 start 이벤트 비활성화
          }));
        } else {
          // 일반 채팅 흐름 - 원래 코드 사용에 토큰 제한 최적화 추가
          //  이미 계산된 시스템 토큰 재사용

          // Get provider options for regular (non-agent) mode
          const regularProviderOptions = getProviderOptionsWithTools(
            executionModelId,
            modelConfig,
            user?.id || anonymousUserId,
            false, // No tools in regular mode
            chatId
          );
          
          const regularSystemPrompt = buildSystemPrompt('regular', userMemory, {
            isAnonymousUser,
            isSubscribed
          });

          // 🔧 Context compression: Summarize if exceeding 80% of context window
          const { finalMessages: compressedMessages } = await compressContextIfNeeded(
            messagesWithTokens,
            regularSystemPrompt,
            executionModelId,
            supabase,
            chatId,
            isAnonymousUser
          );
          
          // chat_attachments signed URL 갱신 (AI SDK 다운로드 시 400 InvalidJWT 방지)
          const messagesWithFreshUrls = await refreshChatAttachmentUrlsInMessages(compressedMessages);
          // 🔧 AI SDK v5: 공통 메시지 처리 함수 사용
          const messages: ModelMessage[] = await processMessagesForAI(messagesWithFreshUrls, executionModelId);
          
          // 🔥 Fireworks API 호환성: extra_content 제거 (API 호출 직전 최종 정리)
          const cleanedMessages = removeExtraContentFromMessages(messages, executionModelId);
          const budgetedMessages = enforcePayloadBudget(cleanedMessages, regularSystemPrompt, executionModelId);
          
          // 🔍 DEBUG: 최종 전달 메시지 로그
          // console.log('[API Request - Regular Mode] Final messages being sent to AI:', {
          //   chatId,
          //   messageCount: messages.length,
          //   compressedCount: compressedMessages.length,
          //   messages: messages.map((m: any, idx: number) => {
          //     let fullTextContent = '';
          //     if (Array.isArray(m.parts)) {
          //       fullTextContent = m.parts
          //         .filter((p: any) => p.type === 'text' && p.text)
          //         .map((p: any) => p.text)
          //         .join(' ');
          //     } else if (Array.isArray(m.content)) {
          //       fullTextContent = m.content
          //         .filter((p: any) => p.type === 'text' && p.text)
          //         .map((p: any) => p.text)
          //         .join(' ');
          //     } else if (typeof m.content === 'string') {
          //       fullTextContent = m.content;
          //     }
          //     const isSummary = fullTextContent.includes('[Previous Conversation Summary]');
          //     // 요약 메시지는 전체 내용 출력, 그 외는 300자만
          //     const displayContent = isSummary 
          //       ? fullTextContent 
          //       : (fullTextContent.slice(0, 300) + (fullTextContent.length > 300 ? '...' : ''));
          //     return {
          //       index: idx,
          //       role: m.role,
          //       isSummary,
          //       content: displayContent || `[no text - content type: ${Array.isArray(m.content) ? 'array' : typeof m.content}]`,
          //       contentLength: fullTextContent.length,
          //       partsCount: Array.isArray(m.parts) ? m.parts.length : 0
          //     };
          //   })
          // });
          
          const result = streamText({
            model: providers.languageModel(executionModelId),
            experimental_transform: [
              smoothStream({delayInMs: 25}),
              // markdownJoinerTransform(),
            ],
            system: regularSystemPrompt,
            messages: budgetedMessages,
            providerOptions: regularProviderOptions,
            stopWhen: stepCountIs(3),
            maxRetries: 20,
            abortSignal: abortController.signal,
            onFinish: async (completion) => {
              if (abortController.signal.aborted) return;

              // 🚀 최적화: 요청 카운트 증가를 비동기로 처리 (사용자 응답 블로킹 방지)
              if (!abortController.signal.aborted && !isAnonymousUser) {
                incrementSuccessfulRequestCount(
                  supabase,
                  user?.id || anonymousUserId,
                  today,
                  currentRequestCount,
                  isSubscribed
                ).catch(error => console.error('Failed to increment request count:', error));
              }

              // 🚀 일반 모드에서는 follow-up question 제거 (성능 최적화)
              
              // 🚀 최적화: 토큰 사용량 저장을 비동기로 처리 (사용자 응답 블로킹 방지)
              setTimeout(() => {
                try {
                  globalCollectedToolResults.token_usage = {
                    totalUsage: completion.totalUsage || null
                  };
                } catch (error) {
                  console.error('Failed to save token usage:', error);
                }
              }, 0);
            }
          });
          writer.merge(result.toUIMessageStream({
            sendReasoning: true,
            sendStart: false, // 🚀 서버-측 ID 사용을 위해 자체 start 이벤트 비활성화
          }));
    }
    },
    onError: (error) => {
      return 'Oops, an error occurred!';
    },
    onFinish: async ({ messages: completedMessages }) => {
      // Skip for anonymous users
      if (isAnonymousUser) {
        return;
      }
      if (abortedByClient) return;

      if (!chatId || !user?.id) {
        return;
      }

      // Get last messages
      const userMessages = completedMessages.filter(m => m.role === 'user');
      const assistantMessages = completedMessages.filter(m => m.role === 'assistant');
      
      const lastUserMessage = userMessages[userMessages.length - 1];
      const lastAssistantMessage = assistantMessages[assistantMessages.length - 1];
      
      if (!lastUserMessage || !lastAssistantMessage) {
        return;
      }

      // Validate assistant has content
      const assistantContent = lastAssistantMessage.parts
        ?.filter((p: any) => p.type === 'text')
        ?.map((p: any) => p.text)
        ?.join('')?.trim() || '';
      
      if (!assistantContent) {
        return;
      }

      // Find original user message with attachments
      const originalUserMessage = originalMessages.find((msg: any) => 
        msg.role === 'user' && (msg.id === lastUserMessage.id || !lastUserMessage.id)
      ) || lastUserMessage;

      // Handle regeneration
      if (isRegeneration && existingMessageId) {
        lastAssistantMessage.id = existingMessageId;
      }

      // === SAVE MESSAGES (synchronous with retry) ===
      try {
        await saveCompletedMessages(
          supabase,
          chatId,
          user.id,
          originalUserMessage,
          lastAssistantMessage,
          executionModelId,
          getProviderFromModel(executionModelId),
          {
            original_model: requestData.originalModel || model,
            token_usage: globalCollectedToolResults.token_usage || null,
            tool_results: globalCollectedToolResults || {},
            parts: lastAssistantMessage.parts || null
          },
          isRegeneration || false
        );
      } catch (error) {
        // Message is in user's local state, will persist on next interaction
      }

      // === MEMORY UPDATE (background - not critical) ===
      if (!abortedByClient) {
        setImmediate(async () => {
          try {
            const userMsg = originalUserMessage.content || 
              (originalUserMessage.parts?.filter((p: any) => p.type === 'text')?.map((p: any) => p.text)?.join(' ')) || '';
            const aiMsg = assistantContent;
            
            if (userMsg && aiMsg) {
              await smartUpdateMemoryBanks(supabase, user.id, chatId, originalMessages, userMsg, aiMsg);
            }
          } catch (error) {
            // Memory update failed - non-critical
          }
        });
      }
    }
  });

  return createUIMessageStreamResponse({ stream });
}
