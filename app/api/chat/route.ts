import { streamText, createUIMessageStream, createUIMessageStreamResponse, streamObject, generateObject, UIMessage, type ModelMessage, stepCountIs, convertToModelMessages, smoothStream, NoSuchToolError } from 'ai';
import { createClient } from '@/utils/supabase/server';
import { providers } from '@/lib/providers';
import { getModelById} from '@/lib/models/config';
// AI SDK v5 네이티브 타입만 사용
// import { z } from 'zod';
import { 
  
  // saveUserMessage,
  // createOrUpdateAssistantMessage,
  // handleStreamCompletion,
  saveCompletedMessages,
  buildSystemPrompt,
  getCachedUserMemory
} from './services/chatService';
import { 
  generateMessageId, 
  validateAndUpdateSession,
  getProviderFromModel,
  // convertMultiModalToMessage,
  // selectMessagesWithinTokenLimit,
  // detectImages,
  // detectPDFs,
  // detectCodeAttachments,
  // fetchFileContent,
  extractTextFromMessage,
  extractTextFromCompletion,
  generateFollowUpQuestions,
  processMessagesForAI
} from './utils/messageUtils';
import { 
  TOOL_REGISTRY,
  // initializeTool,
  getAvailableTools,
  getToolDescriptions,
  collectToolResults
} from './utils/toolUtils';
import { handleRateLimiting, handleChatflixRateLimiting } from './utils/ratelimit';
// import { toolPrompts } from './prompts/toolPrompts';
import { checkSubscriptionFromDatabase } from '@/lib/subscription-db';
import { getProviderOptionsWithTools } from './utils/providerOptions';

// 비구독자 컨텍스트 윈도우 제한 제거됨

// 메모리 관련 import
import { initializeMemoryBank, getAllMemoryBank, getUserPersonalInfo } from '@/utils/memory-bank';
import { smartUpdateMemoryBanks } from './services/memoryService';
import { estimateTokenCount } from '@/utils/context-manager';
import { selectOptimalModel } from './services/modelSelector';
import { estimateMultiModalTokens } from '@/utils/context-manager';
// import { 
//   analyzeRequestAndDetermineRoute
// } from './services/analysisService';
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
    if (status && status !== 400) {
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
  if (model === 'chatflix-ultimate' || model === 'chatflix-ultimate-pro') {
      // Store the original model name for DB storage
      requestData.originalModel = model;
      
      try {
        const modelType = model as 'chatflix-ultimate' | 'chatflix-ultimate-pro';
        const { selectedModel } = await selectOptimalModel(messages, modelType);
        model = selectedModel;
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

        // v5 pattern: do not persist user/assistant mid-stream; save at onFinish only
        const assistantMessageId = isRegeneration && existingMessageId 
          ? existingMessageId 
          : generateMessageId();

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
        try {
          userMemory = !isAnonymousUser ? await getCachedUserMemory(user?.id || anonymousUserId) : null;
        } catch (memoryError) {
          console.error('🧠 [MEMORY] Failed to load user memory, continuing without it:', memoryError);
          userMemory = null;
        }
        const currentSystemPrompt = buildSystemPrompt(
          isAgentEnabled ? 'agent' : 'regular',
          userMemory
        );
        
        // 🔧 MEDIUM PRIORITY OPTIMIZATION: 시스템 프롬프트 토큰 계산 한 번만 수행
        const systemTokensCounts = estimateTokenCount(currentSystemPrompt);
        // 이미 위에서 계산된 maxContextTokens 사용
        let remainingTokens = maxContextTokens - systemTokensCounts;
        
        // 🔧 MEDIUM PRIORITY OPTIMIZATION: 메시지별 토큰 미리 계산 및 캐싱
        const messagesWithTokens = processMessages.map(msg => {
          const tokenCount = estimateMultiModalTokens(msg as any);
          return {
            ...msg,
            _tokenCount: tokenCount
          };
        });
        
        if (isAgentEnabled) {
          
          // Re-calculate system tokens specifically for agent mode for accuracy
          const agentSystemPromptForCalc = buildSystemPrompt('agent', userMemory);
          
          const agentSystemTokens = estimateTokenCount(agentSystemPromptForCalc);
          remainingTokens = maxContextTokens - agentSystemTokens;

          const optimizedMessagesForRouting = messagesWithTokens;

          // 현재 질문 추출을 위한 준비
          let userQuery = '';
          
          // 현재 질문만 userQuery에 할당
          const currentMessage = optimizedMessagesForRouting[optimizedMessagesForRouting.length - 1];
          userQuery = extractTextFromMessage(currentMessage);

                     // 🆕 STEP 0: Request Routing Analysis


          // 🆕 사용자가 직접 도구를 선택한 경우 vs 자동 라우팅
          let selectedActiveTools: Array<keyof typeof TOOL_REGISTRY>;
          
          // 🔧 FIX: 중복 제거 헬퍼 함수
          const addToolsWithPreviousResults = (tools: string[]): Array<keyof typeof TOOL_REGISTRY> => {
            const toolsWithoutPrevious = tools.filter(tool => tool !== 'previous_tool_results');
            const finalTools = ['previous_tool_results', ...toolsWithoutPrevious] as Array<keyof typeof TOOL_REGISTRY>;
            
            // 중복 제거 로그
            if (tools.includes('previous_tool_results')) {
              console.log(`[TOOL_SELECTION] Removed duplicate previous_tool_results from: [${tools.join(', ')}] -> [${finalTools.join(', ')}]`);
            }
            
            return finalTools;
          };
          
          if (selectedTool && selectedTool !== 'file_upload') {
            // 사용자가 직접 도구를 선택한 경우
            console.log(`[TOOL_SELECTION] User selected tool: ${selectedTool}`);
            
            // 웹서치 토픽인 경우 처리
            if (selectedTool.startsWith('web_search:')) {
              const topic = selectedTool.split(':')[1];
              console.log(`[TOOL_SELECTION] Web search with specific topic: ${topic}`);
              
              // 웹서치 도구에 특정 토픽을 강제로 설정
              selectedActiveTools = addToolsWithPreviousResults(['web_search']);
              
              // 웹서치 도구 생성 시 사용할 토픽 정보를 저장
              (writer as any)._selectedWebSearchTopic = topic;
            } else {
              // 일반 도구인 경우
              selectedActiveTools = addToolsWithPreviousResults([selectedTool]);
            }
          } else {
            // 🚀 모든 도구 허용 (라우팅 분석 생략)
            console.log(`[TOOL_SELECTION] Using all available tools (routing analysis skipped)`);
            const allAvailableTools = getAvailableTools();
            selectedActiveTools = addToolsWithPreviousResults(allAvailableTools);
            
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
              
          // 🆕 AI SDK v5: 전체 도구 세트 정의 + 활성 도구 제한
          const allTools = Object.fromEntries(
            Object.entries(TOOL_REGISTRY).map(([toolName, config]) => [
              toolName,
              toolName === 'previous_tool_results' 
                ? (config.createFn as any)(writer, chatId) // previous_tool_results에만 chatId 전달
                : toolName === 'web_search' && (writer as any)._selectedWebSearchTopic
                ? config.createFn(writer, (writer as any)._selectedWebSearchTopic) // 웹서치에 강제 토픽 전달
                : config.createFn(writer)
            ])
          );
              
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
              const finalMessagesForExecution = await processMessagesForAI(messagesWithTokens);
              
              // 시스템 프롬프트 설정 (캐시된 메모리 사용)
              const systemPrompt = buildSystemPrompt(
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
                system: systemPrompt,
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
                  
                  // 간단한 도구 결과 수집 (TOOL_REGISTRY 구조에 맞게)
                  const collectedToolResults = collectToolResults(allTools, selectedActiveTools);
                  await incrementSuccessfulRequestCount(supabase, user?.id || anonymousUserId, today, currentRequestCount, isSubscribed);
                  // 🚀 Kimi K2 모델 호환성: 안전한 텍스트 추출
                  const aiResponse = extractTextFromCompletion(completion);
                  const followUpQuestions = await generateFollowUpQuestions(userQuery, aiResponse);
                  
                  const structuredResponse = {
                    response: { 
                      followup_questions: followUpQuestions 
                    }
                  };
                  collectedToolResults.structuredResponse = structuredResponse;
                  globalCollectedToolResults = { ...collectedToolResults };
                  
                  writer.write({
                    type: 'data-structured_response',
                    id: `structured-${assistantMessageId}`,
                    data: structuredResponse,
                  });
                }
              });

              textResponsePromise.consumeStream();
              writer.merge(textResponsePromise.toUIMessageStream({
                sendReasoning: true,
              }));
        } else {
          // 일반 채팅 흐름 - 원래 코드 사용에 토큰 제한 최적화 추가
          //  이미 계산된 시스템 토큰 재사용

          // 🔧 AI SDK v5: 공통 메시지 처리 함수 사용
          const messages: ModelMessage[] = await processMessagesForAI(messagesWithTokens);
          
          // Get provider options for regular (non-agent) mode
          const regularProviderOptions = getProviderOptionsWithTools(
            model,
            modelConfig,
            user?.id || anonymousUserId,
            false, // No tools in regular mode
            chatId
          );
          
          const result = streamText({
            model: providers.languageModel(model),
            experimental_transform: [
              smoothStream({delayInMs: 25}),
              // markdownJoinerTransform(),
            ],
            system: currentSystemPrompt,
            messages: messages,
            providerOptions: regularProviderOptions,
            stopWhen: stepCountIs(3),
            maxRetries: 20,
            abortSignal: abortController.signal,
            onFinish: async (completion) => {
              if (abortController.signal.aborted) return;

              // Increment daily request count only on successful, non-aborted completion
              if (!abortController.signal.aborted && !isAnonymousUser) {
                await incrementSuccessfulRequestCount(
                  supabase,
                  user?.id || anonymousUserId,
                  today,
                  currentRequestCount,
                  isSubscribed
                );
              }

              // 🚀 일반 모드에서도 followup questions 생성
              const currentMessage = messagesWithTokens[messagesWithTokens.length - 1];
              const userQuery = extractTextFromMessage(currentMessage);
              // 🚀 Kimi K2 모델 호환성: 안전한 텍스트 추출
              const aiResponse = extractTextFromCompletion(completion);
              const followUpQuestions = await generateFollowUpQuestions(userQuery, aiResponse);
              
              const structuredResponse = {
                response: { 
                  followup_questions: followUpQuestions 
                }
              };
              
              writer.write({
                type: 'data-structured_response',
                id: `structured-${assistantMessageId}`,
                data: structuredResponse,
              });
            }
          });
          writer.merge(result.toUIMessageStream({
            sendReasoning: true,
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
                      current_model: model,
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
            
            // 🚀 익명 사용자 지원: 익명 사용자는 DB 저장 건너뛰기
            if (!isAnonymousUser && sessionExists) {
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
                  token_usage: (lastAssistantMessage as any).usage,
                  tool_results: globalCollectedToolResults || {}
                },
                isRegeneration || false
              );

              console.log('✅ [onFinish] Messages saved successfully');
            } else if (isAnonymousUser) {
              console.log('🚀 [ANONYMOUS] Skipping message save for anonymous user');
            } else {
              console.log('⚠️ [SESSION] Skipping message save - session not available');
            }

            // 🆕 Smart Memory Update for regular chat (익명 사용자는 건너뛰기)
            if (chatId && !abortedByClient && !isAnonymousUser) {
              setTimeout(async () => {
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
                    
                    // 기존 메모리 데이터 로드
                    const { data: memoryData } = await getAllMemoryBank(
                      supabase, 
                      user?.id || anonymousUserId
                    );
                    
                    await smartUpdateMemoryBanks(
                          supabase, 
                          user?.id || anonymousUserId, 
                          chatId, 
                          originalMessages, 
                          userMessage, 
                          aiMessage,
                          memoryData // 기존 메모리 데이터 전달
                        );
                    console.log('✅ [MEMORY] Smart memory update completed');
                  }
                } catch (error) {
                  console.error('💥 [MEMORY] Smart memory update failed:', error);
                }
              }, 1000);
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
