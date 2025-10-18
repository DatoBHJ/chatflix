import { streamText, createUIMessageStream, createUIMessageStreamResponse, streamObject, generateObject, UIMessage, type ModelMessage, stepCountIs, convertToModelMessages, smoothStream, NoSuchToolError, generateId } from 'ai';
import { createClient } from '@/utils/supabase/server';
import { providers } from '@/lib/providers';
import { getModelById} from '@/lib/models/config';
// AI SDK v5 네이티브 타입만 사용
// import { z } from 'zod';
import { 
  saveCompletedMessages,
  buildSystemPrompt,
  getCachedUserMemory
} from './services/chatService';
import { 
  getProviderFromModel,
  extractTextFromMessage,
  extractTextFromCompletion,
  generateMessageTitle,
  generateFollowUpQuestions,
  processMessagesForAI
} from './utils/messageUtils';
import { 
  TOOL_REGISTRY,
  getAvailableTools,
  getToolDescriptions,
  collectToolResults
} from './utils/toolUtils';
import { handleRateLimiting, handleChatflixRateLimiting } from './utils/ratelimit';
import { checkSubscriptionFromDatabase } from '@/lib/subscription-db';
import { getProviderOptionsWithTools } from './utils/providerOptions';

// 비구독자 컨텍스트 윈도우 제한 제거됨

// 메모리 관련 import
import { initializeMemoryBank, getAllMemoryBank, getUserPersonalInfo } from '@/utils/memory-bank';
import { smartUpdateMemoryBanks } from './services/memoryService';
import { selectOptimalModel } from './services/modelSelector';
import { estimateMultiModalTokens } from '@/utils/context-manager';
// import { markdownJoinerTransform } from './markdown-transform';

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
    // console.error('Failed to update successful request count:', error);
  }
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

  const requestData = await req.json();
  
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
  
  // 🚀 chatId 검증 및 정리
  if (!chatId || typeof chatId !== 'string' || chatId.trim() === '') {
    console.error('💥 [CHAT] Invalid chatId:', chatId);
    return new Response('Invalid chatId', { status: 400 });
  }
  chatId = chatId.trim();
  console.log('🔍 [CHAT] Processing chatId:', chatId);
  
  // 🚀 첨부파일 처리: 마지막 사용자 메시지에 experimental_attachments 추가
  if (experimental_attachments && experimental_attachments.length > 0 && messages.length > 0) {
    const lastUserMessage = messages[messages.length - 1];
    if (lastUserMessage.role === 'user') {
      lastUserMessage.experimental_attachments = experimental_attachments;
    }
  }

  
  // 🚀 익명 사용자 지원: 일단 모든 기능 허용 (나중에 제한 추가 예정)
  // if (isAnonymousUser) {
  //   // 익명 사용자는 기본 모델만 사용 가능
  //   const allowedModels = ['gpt-4o-mini', 'gemini-2.0-flash-exp', 'claude-3-5-sonnet'];
  //   if (!allowedModels.includes(model)) {
  //     model = 'gpt-4o-mini'; // 기본 모델로 변경
  //   }
  //   
  //   // 익명 사용자는 에이전트 모드 비활성화
  //   isAgentEnabled = false;
  //   selectedTool = null;
  //   
  //   // 익명 사용자는 DB 저장하지 않음
  //   saveToDb = false;
  // }
  
  // 원본 메시지 배열 보존 (모든 스코프에서 사용 가능)
  const originalMessages = messages.slice();

  // Map Chatflix Ultimate model to appropriate model based on agent mode
  let originalModelForDB = model; // Store original model for database storage
  if (model === 'chatflix-ultimate' || model === 'chatflix-ultimate-pro') {
      // Store the original model name for DB storage
      requestData.originalModel = model;
      
      try {
        const modelType = model as 'chatflix-ultimate' | 'chatflix-ultimate-pro';
        const { selectedModel } = await selectOptimalModel(messages, modelType);
        model = selectedModel;
        
        // 🆕 에이전트 모드에서만 Kimi K2를 gemini-2.5-flash로 대체
        if (isAgentEnabled && model === 'moonshotai/kimi-k2-instruct-0905') {
          model = 'gemini-2.5-flash';
          console.log('🔄 [MODEL_SELECTION] Replaced Kimi K2 with gemini-2.5-flash for agent mode');
        }
      } catch (error) {
        model = 'gemini-2.5-pro';
      }
    }

  // 구독 상태 확인 (데이터베이스 기반) - 익명 사용자는 바로 false로 처리하여 불필요한 DB/Polar/Redis 호출 제거
  const isSubscribed = isAnonymousUser
    ? false
    : await checkSubscriptionFromDatabase(user!.id);
  
  // 모델이 바뀐 후 최종 모델 설정으로 maxContextTokens 재계산
  const finalModelConfig = getModelById(model);
  const maxContextTokens = finalModelConfig?.contextWindow || 120000;
  
  // 사용자의 오늘 요청 횟수 확인
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD 형식
  const { data: userRequests, error: requestsError } = await supabase
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
  
  // 🚀 익명 사용자 rate limit: 일단 일반 사용자와 동일하게 처리
  // if (isAnonymousUser) {
  //   // 익명 사용자는 더 엄격한 rate limit 적용 (구독하지 않은 사용자로 처리)
  //   const anonymousRateLimitResult = await handleRateLimiting(anonymousUserId, model, false);
  //   if (!anonymousRateLimitResult.success) {
  //     const { error } = anonymousRateLimitResult;
  //     return new Response(JSON.stringify(error), {
  //       status: 429,
  //       headers: { 'Content-Type': 'application/json' }
  //     });
  //   }
  // } else 
  
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
    // 일반 모델은 기존 로직 사용 (익명 사용자는 rate limit 체크 건너뛰기)
    if (!isAnonymousUser) {
      const rateLimitResult = await handleRateLimiting(user?.id || anonymousUserId, model, isSubscribed);
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
  }

  let globalCollectedToolResults: any = {}; // Store tool results globally
  
  const stream = createUIMessageStream({
    originalMessages: messages,
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

        // Add abort handler to prevent message saving when stream is stopped
        let abortSavePromise: Promise<void> | null = null;
        abortController.signal.addEventListener('abort', () => {
          console.log('🛑 [ABORT] Stream aborted, but will save partial response');
          
          // 🚀 중단 시에도 부분 저장 허용 (abortedByClient = false 유지)
          // abortedByClient = true; // 이 줄 제거
          
          // Prevent multiple abort saves
          if (abortSavePromise) return;
          
          abortSavePromise = (async () => {
            try {
              // Give a small delay for any in-flight UI updates
              await new Promise(resolve => setTimeout(resolve, 100));
              
              console.log('🛑 [ABORT] Server-side abort completed, partial save will be attempted');
            } catch (error) {
              console.error('🛑 [ABORT] Failed to handle abort:', error);
            }
          })();
        });

        const modelConfig = getModelById(model);

        // 3. 향상된 시스템 프롬프트 (캐시된 메모리 사용) - 에러 시에도 계속 진행
        let userMemory = null;
        userMemory = !isAnonymousUser ? await getCachedUserMemory(user?.id || anonymousUserId) : null;
        
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
            console.log(`[TOOL_SELECTION] User selected tool: ${selectedTool}`);
            
            // 웹서치 토픽인 경우 처리
            if (selectedTool.startsWith('web_search:')) {
              const topic = selectedTool.split(':')[1];
              console.log(`[TOOL_SELECTION] Web search with specific topic: ${topic}`);
              
              // 웹서치 도구에 특정 토픽을 강제로 설정
              selectedActiveTools = ['web_search'] as Array<keyof typeof TOOL_REGISTRY>;
              
              // 웹서치 도구 생성 시 사용할 토픽 정보를 저장
              (writer as any)._selectedWebSearchTopic = topic;
            } else if (selectedTool === 'google-images') {
              // Google Images 도구 선택 시 처리
              console.log(`[TOOL_SELECTION] Google Images selected`);
              
              // Google Search 도구에 google_images 엔진을 강제로 설정
              selectedActiveTools = ['google_search'] as Array<keyof typeof TOOL_REGISTRY>;
              
              // Google Search 도구 생성 시 사용할 엔진 정보를 저장
              (writer as any)._selectedGoogleSearchEngine = 'google_images';
            } else if (selectedTool === 'google-videos') {
              // Google Videos 도구 선택 시 처리
              console.log(`[TOOL_SELECTION] Google Videos selected`);
              
              // Google Search 도구에 google_videos 엔진을 강제로 설정
              selectedActiveTools = ['google_search'] as Array<keyof typeof TOOL_REGISTRY>;
              
              // Google Search 도구 생성 시 사용할 엔진 정보를 저장
              (writer as any)._selectedGoogleSearchEngine = 'google_videos';
            } else {
              // 일반 도구인 경우
              selectedActiveTools = [selectedTool] as Array<keyof typeof TOOL_REGISTRY>;
            }
          } else {
            // 🚀 모든 도구 허용 (라우팅 분석 생략)
            console.log(`[TOOL_SELECTION] Using all available tools (routing analysis skipped)`);
            const allAvailableTools = getAvailableTools();
            selectedActiveTools = allAvailableTools as Array<keyof typeof TOOL_REGISTRY>;
            
            // 🔧 기존 라우팅 분석 코드 (주석 처리 - 필요시 복원 가능)
            /*
            // 자동 라우팅 사용
            console.log(`[TOOL_SELECTION] Using automatic routing`);
            const baseAvailableToolsList = getAvailableTools();
            const analysisModel = 'gemini-2.0-flash';
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
            model,
            modelConfig,
            user?.id || anonymousUserId,
            selectedActiveTools.length > 0,
            chatId
          );

          // RESPOND: 도구 실행 모델 결정
          let toolExecutionModel = model;

          // 🆕 STEP 2: Prepare optimized messages for final execution
          // 🔧 AI SDK v5: 공통 메시지 처리 함수 사용 (도구 유무와 관계없이 동일)
          const finalMessagesForExecution = await processMessagesForAI(messagesWithTokens, model);
          console.log('finalMessagesForExecution', JSON.stringify(finalMessagesForExecution, null, 2));

          // 🆕 AI SDK v5: 전체 도구 세트 정의 + 활성 도구 제한 (finalMessagesForExecution 이후에 생성)
          const allTools = Object.fromEntries(
            Object.entries(TOOL_REGISTRY).map(([toolName, config]) => [
              toolName,
              toolName === 'web_search' && (writer as any)._selectedWebSearchTopic
                ? (config.createFn as any)(writer, (writer as any)._selectedWebSearchTopic) // 웹서치에 강제 토픽 전달
                : toolName === 'google_search' && (writer as any)._selectedGoogleSearchEngine
                ? (config.createFn as any)(writer, (writer as any)._selectedGoogleSearchEngine) // Google Search에 강제 엔진 전달
                : toolName === 'gemini_image_tool'
                ? (config.createFn as any)(writer, user?.id || anonymousUserId, finalMessagesForExecution) // gemini_image_tool에 finalMessagesForExecution 전달
                : toolName === 'seedream_image_tool'
                ? (config.createFn as any)(writer, user?.id || anonymousUserId, finalMessagesForExecution) // seedream_image_tool에 finalMessagesForExecution 전달
                : (config.createFn as any)(writer)
            ])
          );
          // 시스템 프롬프트 설정 (캐시된 메모리 사용)
          const agentSystemPrompt = buildSystemPrompt(
            'agent', 
            userMemory,
            {
              selectedTools: selectedActiveTools
            }
          );

          // 도구 호출이 있는 경우 텍스트 응답을 조건부로 처리
          const textResponsePromise = streamText({
            model: providers.languageModel(toolExecutionModel),
            experimental_transform: [
              smoothStream({delayInMs: 25}),
              // markdownJoinerTransform(),
            ],
            system: agentSystemPrompt,
            messages: finalMessagesForExecution,
            tools: allTools,
            activeTools: selectedActiveTools,
            providerOptions,
            // Allow up to 10 tool-using steps; then force a final answer without tools on step 11
            stopWhen: stepCountIs(selectedActiveTools?.length > 0 ? 11 : 3),
            prepareStep: ({ stepNumber }) => {
              // After 10 steps of potential tool usage, force a text-only answer
              if (stepNumber > 10) {
                return {
                  toolChoice: 'none',
                  activeTools: []
                };
              }
              return undefined;
            },
            toolChoice: 'auto',
            maxRetries: 20,
            abortSignal: abortController.signal,
            experimental_repairToolCall: async ({ toolCall, tools, inputSchema, error }) => {
              if (NoSuchToolError.isInstance(error)) {
                return null; // do not attempt to fix invalid tool names
              }

              console.log('🔧 [REPAIR] Fixing tool call');
              console.log('🔧 [REPAIR] toolCall:', toolCall);
              console.log('🔧 [REPAIR] tools:', Object.keys(tools));
              console.log('🔧 [REPAIR] parameterSchema:', inputSchema);
              console.log('🔧 [REPAIR] error:', error);

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
                model: providers.languageModel('moonshotai/kimi-k2-instruct'),
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

              console.log('🔧 [REPAIR] repairedArgs:', repairedArgs);

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
              
              // 🚀 Kimi K2 모델 호환성: 안전한 텍스트 추출
              const aiResponse = extractTextFromCompletion(completion);
      
              // 🚀 제목 생성 시작 신호 전송
              writer.write({
                type: 'data-title_generation_started',
                id: `title-start-${assistantMessageId}`,
                data: { started: true },
              });
      
              // 🚀 제목 먼저 생성하고 즉시 전송 (메모리 제거로 성능 최적화)
              const messageTitle = await generateMessageTitle(userQuery, aiResponse);
              
              const titleResponse = {
                response: { 
                  title: messageTitle
                }
              };
              
              writer.write({
                type: 'data-structured_response',
                id: `title-${assistantMessageId}`,
                data: titleResponse,
              });
              
              // 🚀 Follow-up 질문은 별도로 생성하고 나중에 전송 (메모리 제거로 성능 최적화)
              const followUpQuestions = await generateFollowUpQuestions(userQuery, aiResponse);
              
              const followUpResponse = {
                response: { 
                  followup_questions: followUpQuestions 
                }
              };
              
              writer.write({
                type: 'data-structured_response',
                id: `followup-${assistantMessageId}`,
                data: followUpResponse,
              });
              
              // 🚀 제목과 질문 생성 후 도구 결과 수집 (빠른 인메모리 작업이므로 동기 처리 유지)
              const collectedToolResults = collectToolResults(allTools, selectedActiveTools);
              
              // 최종 structuredResponse 구성 (기존 호환성 유지)
              const structuredResponse = {
                response: { 
                  title: messageTitle,
                  followup_questions: followUpQuestions 
                }
              };
              collectedToolResults.structuredResponse = structuredResponse;
              
              // 🆕 토큰 사용량을 completion에서 직접 추출 (AI SDK v5 방식) - usage와 totalUsage 분리 저장
              collectedToolResults.token_usage = {
                usage: completion.usage || null,
                totalUsage: completion.totalUsage || null
              };
              
              globalCollectedToolResults = { ...collectedToolResults };
            }
          });

          textResponsePromise.consumeStream();
          writer.merge(textResponsePromise.toUIMessageStream({
            sendReasoning: true,
            sendStart: false, // 🚀 서버-측 ID 사용을 위해 자체 start 이벤트 비활성화
          }));
        } else {
          // 일반 채팅 흐름 - 원래 코드 사용에 토큰 제한 최적화 추가
          //  이미 계산된 시스템 토큰 재사용

          // 🔧 AI SDK v5: 공통 메시지 처리 함수 사용
          const messages: ModelMessage[] = await processMessagesForAI(messagesWithTokens, model);
          
          // Get provider options for regular (non-agent) mode
          const regularProviderOptions = getProviderOptionsWithTools(
            model,
            modelConfig,
            user?.id || anonymousUserId,
            false, // No tools in regular mode
            chatId
          );
          
          const regularSystemPrompt = buildSystemPrompt('regular', userMemory);
          
          const result = streamText({
            model: providers.languageModel(model),
            experimental_transform: [
              smoothStream({delayInMs: 25}),
              // markdownJoinerTransform(),
            ],
            system: regularSystemPrompt,
            messages: messages,
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
                    usage: completion.usage || null,
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
      console.error('💥 [onError]:', error);
      return 'Oops, an error occurred!';
    },
    onFinish: async ({ messages: completedMessages }) => {
      // 🚀 중단된 응답도 부분 저장 허용 (abortedByClient 체크 제거)
      // if (abortedByClient) {
      //   console.log('🛑 [onFinish] Client aborted; skipping final save');
      //   return;
      // }
      
      // v5 스타일: 스트림 완료 시 모든 새 메시지를 저장
      if (chatId && (user?.id || anonymousUserId) && completedMessages.length >= 1) {
        try {
          // 마지막 유저 메시지와 새로운 어시스턴트 메시지 찾기
          const userMessages = completedMessages.filter(m => m.role === 'user');
          const assistantMessages = completedMessages.filter(m => m.role === 'assistant');
          
          const lastUserMessage = userMessages[userMessages.length - 1];
          const lastAssistantMessage = assistantMessages[assistantMessages.length - 1];
          
          if (lastUserMessage && lastAssistantMessage) {
            // 🚀 부분 저장 허용: 빈 assistant 메시지 체크 완화
            const assistantContent = lastAssistantMessage.parts
              ?.filter((p: any) => p.type === 'text')
              ?.map((p: any) => p.text)
              ?.join('')?.trim() || '';
            
            // 부분 내용이 있어도 저장 허용 (중단된 응답도 저장)
            if (assistantContent === '' && !abortedByClient) {
              console.log('🛑 [onFinish] Skipping save - assistant message is empty and not aborted');
              return;
            }

            // 중단된 응답인 경우 로그
            if (abortedByClient) {
              console.log('🛑 [onFinish] Saving partial response (aborted)');
            }

            // 원본 사용자 메시지 찾기 (experimental_attachments 포함)
            const originalUserMessage = originalMessages.find((msg: any) => 
              msg.role === 'user' && 
              (msg.id === lastUserMessage.id || !lastUserMessage.id)
            ) || lastUserMessage;

            // 재생성 시 기존 메시지 ID 사용
            if (isRegeneration && existingMessageId) {
              lastAssistantMessage.id = existingMessageId;
              console.log('🔄 [onFinish] Using existing message ID for regeneration:', existingMessageId);
            }

            // 🚀 세션 upsert (안전하게)
            let finalChatId = chatId;
            let sessionExists = false;
            
            if (!isAnonymousUser) {
              try {
                // 먼저 세션이 존재하는지 확인
                const { data: existingSession, error: checkError } = await supabase
                  .from('chat_sessions')
                  .select('id')
                  .eq('id', chatId)
                  .eq('user_id', user?.id || anonymousUserId)
                  .single();

                if (checkError || !existingSession) {
                  // 세션이 없으면 새로 생성
                  // 🚀 초기 메시지에서 제목 생성 (사이드바와 동기화)
                  const initialMessage = originalUserMessage.content || 
                    (originalUserMessage.parts
                      ?.filter((p: any) => p.type === 'text')
                      ?.map((p: any) => p.text)
                      ?.join(' ')) || '';
                  
                  const autoTitle = initialMessage.length > 30 
                    ? initialMessage.slice(0, 30) + '...' 
                    : initialMessage || 'New Chat';

                  const { data: newSession, error: createError } = await supabase
                    .from('chat_sessions')
                    .insert([{
                      id: chatId,
                      title: autoTitle, // 🚀 자동 생성된 제목 사용
                      current_model: originalModelForDB, // 🚀 사용자가 선택한 원본 모델 저장
                      initial_message: initialMessage,
                      user_id: user?.id || anonymousUserId,
                    }])
                    .select()
                    .single();

                  if (createError) {
                    console.error('💥 [SESSION] Failed to create session:', createError);
                    // 세션 생성 실패 시 메시지 저장 건너뛰기
                    return;
                  } else {
                    console.log('✅ [SESSION] Session created successfully');
                    finalChatId = newSession.id;
                    sessionExists = true;
                    
                    // 🚀 제목 생성 완전 제거 - 사이드바에서 독립적으로 처리
                    // 메인 API 응답 속도 최대화
                  }
                } else {
                  // 세션이 이미 존재함
                  sessionExists = true;
                  console.log('✅ [SESSION] Session already exists');
                }
              } catch (error) {
                console.error('💥 [SESSION] Session handling error:', error);
                // 에러 발생 시 메시지 저장 건너뛰기
                return;
              }
            }

            console.log('💾 [onFinish] Saving completed messages via v5 stream');
            
            // 🚀 최적화: 메시지 저장을 비동기로 처리 (사용자 응답 블로킹 방지)
            if (!isAnonymousUser && sessionExists) {
              // 백그라운드에서 메시지 저장 실행 (사용자 응답과 완전 분리)
              setImmediate(async () => {
                try {
                  await saveCompletedMessages(
                    supabase,
                    finalChatId,
                    user?.id || anonymousUserId,
                    originalUserMessage,
                    lastAssistantMessage,
                    model,
                    getProviderFromModel(model),
                    {
                      original_model: requestData.originalModel || model,
                      token_usage: globalCollectedToolResults.token_usage || null,
                      tool_results: globalCollectedToolResults || {}
                    },
                    isRegeneration || false
                  );

                  console.log('✅ [onFinish] Messages saved successfully');
                } catch (error) {
                  console.error('💥 [onFinish] Failed to save messages:', error);
                }
              });
            } else if (isAnonymousUser) {
              console.log('🚀 [ANONYMOUS] Skipping message save for anonymous user');
            } else {
              console.log('⚠️ [SESSION] Skipping message save - session not available');
            }

            // 🚀 최적화: Smart Memory Update를 백그라운드 작업으로 처리 (사용자 응답 블로킹 방지)
            if (chatId && !abortedByClient && !isAnonymousUser) {
              // 백그라운드에서 메모리 업데이트 실행 (사용자 응답과 완전 분리)
              setImmediate(async () => {
                try {
                  // 사용자 메시지 내용 추출
                  const userMessage = originalUserMessage.content || 
                    (originalUserMessage.parts
                      ?.filter((p: any) => p.type === 'text')
                      ?.map((p: any) => p.text)
                      ?.join(' ')) || '';
                  
                  // AI 메시지 내용 추출
                  const aiMessage = lastAssistantMessage.parts
                    ?.filter((p: any) => p.type === 'text')
                    ?.map((p: any) => p.text)
                    ?.join('\n') || '';

                  if (userMessage && aiMessage) {
                    console.log('🧠 [MEMORY] Starting smart memory update...');
                    
                    await smartUpdateMemoryBanks(
                          supabase, 
                          user?.id || anonymousUserId, 
                          chatId, 
                          originalMessages, 
                          userMessage, 
                          aiMessage
                        );
                    console.log('✅ [MEMORY] Smart memory update completed');
                  }
                } catch (error) {
                  console.error('💥 [MEMORY] Smart memory update failed:', error);
                }
              });
            }
          }
        } catch (error) {
          console.error('💥 [onFinish] Error saving messages:', error);
        }
      }
    }
  });

  return createUIMessageStreamResponse({ stream });
}
