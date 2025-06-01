import { streamText, createDataStreamResponse, smoothStream, Message, streamObject, generateText, generateObject } from 'ai';
import { createClient } from '@/utils/supabase/server';
import { providers } from '@/lib/providers';
import { getModelById} from '@/lib/models/config';
import { MultiModalMessage } from './types';
import { z } from 'zod';
import { 
  handlePromptShortcuts,
  saveUserMessage,
  createOrUpdateAssistantMessage,
  handleStreamCompletion,
  buildSystemPrompt
} from './services/chatService';
import { 
  generateMessageId, 
  convertMessageForAI, 
  validateAndUpdateSession,
  getProviderFromModel,
  convertMultiModalToMessage,
  selectMessagesWithinTokenLimit
} from './utils/messageUtils';
import { 
  createWebSearchTool, 
  createJinaLinkReaderTool, 
  createImageGeneratorTool, 
  createCalculatorTool, 
  createAcademicSearchTool, 
  // createXSearchTool, 
  createYouTubeSearchTool, 
  createYouTubeLinkAnalyzerTool, 
} from './tools';
import { handleRateLimiting } from './utils/ratelimit';
import { toolPrompts } from './prompts/toolPrompts';
import { checkSubscription } from '@/lib/polar';

// 메모리 관련 import
import { initializeMemoryBank, getAllMemoryBank } from '@/utils/memory-bank';
import { estimateTokenCount } from '@/utils/context-manager';
import { updateAllMemoryBanks } from './services/memoryService';
import { selectOptimalModel } from './services/modelSelector';


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
        onConflict: 'user_id,date' // This ensures that if a record for the user and date already exists, it's updated.
      });
  } catch (error) {
    console.error('Failed to update successful request count:', error);
  }
}

// Tool initialization helper function
function initializeTool(type: string, dataStream: any) {
  switch (type) {
    case 'web_search':
      return createWebSearchTool(dataStream);
    case 'calculator':
      return createCalculatorTool(dataStream);
    case 'link_reader':
      return createJinaLinkReaderTool(dataStream);
    case 'image_generator':
      return createImageGeneratorTool(dataStream);
    case 'academic_search':
      return createAcademicSearchTool(dataStream);
    // case 'x_search':
    //   return createXSearchTool(dataStream);
    case 'youtube_search':
      return createYouTubeSearchTool(dataStream);
    case 'youtube_link_analyzer':
      return createYouTubeLinkAnalyzerTool(dataStream);
    default:
      throw new Error(`Unknown tool type: ${type}`);
  }
}

export async function POST(req: Request) {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const requestData = await req.json();
    let { messages, model, chatId, isRegeneration, existingMessageId, saveToDb = true, isAgentEnabled = false } = requestData;

    // Map Chatflix Ultimate model to appropriate model based on agent mode
    if (model === 'chatflix-ultimate' || model === 'chatflix-ultimate-pro') {
        // Store the original model name for DB storage
        requestData.originalModel = model;
        
        try {
          const modelType = model as 'chatflix-ultimate' | 'chatflix-ultimate-pro';
          const { selectedModel } = await selectOptimalModel(messages, modelType);
          model = selectedModel;
        } catch (error) {
          console.error('Error in model selection:', error);
          // 오류 발생 시 기본 모델 사용
          model = 'gemini-2.5-pro-preview-05-06';
        }
      }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'Invalid messages format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 구독 상태 확인
    const isSubscribed = await checkSubscription(user.id);
    
    // 사용자의 오늘 요청 횟수 확인
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD 형식
    const { data: userRequests, error: requestsError } = await supabase
      .from('user_daily_requests')
      .select('count')
      .eq('user_id', user.id)
      .eq('date', today)
      .single();
    
    // 현재 요청 횟수 (없으면 0으로 시작)
    const currentRequestCount = userRequests?.count || 0;
    
    // 임계값 설정: 일일 5회 요청
    const REQUEST_THRESHOLD = 5;
    
    // 구독하지 않았고 임계값 이상이면 지연 효과 적용 예정
    const shouldDelay = !isSubscribed && currentRequestCount >= REQUEST_THRESHOLD;

    // Check rate limiting with potentially updated model
    // const rateLimitResult = await handleRateLimiting(user.id, model);
    const rateLimitResult = await handleRateLimiting(user.id, requestData.originalModel === 'chatflix-ultimate' ? 'chatflix-ultimate' : model);
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
          model: model
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
          message: 'Rate limit exceeded'
        }), {
          status: 429,
          headers: {
            'Content-Type': 'application/json'
          }
        });
      }
    }

    return createDataStreamResponse({
      execute: async (dataStream) => {
          // 비구독자이고 임계값 이상일 때만 지연 적용
          if (shouldDelay) {
            dataStream.writeMessageAnnotation({
              type: 'subscription_status',
              data: { 
                isSubscribed: false,
                message: "... slow request, get fast access here",
                requestCount: currentRequestCount
              }
            });
            
            // 인위적 지연 적용 (약 15초)
            await new Promise(resolve => setTimeout(resolve, 15000));
          }
          
          let sessionValidationPromise;
          if (chatId) {
            sessionValidationPromise = validateAndUpdateSession(supabase, chatId, user.id, messages);
          } else {
            sessionValidationPromise = Promise.resolve();
          }

          // 메모리 뱅크 초기화 (Agent 모드 여부와 상관없이)
          let memoryInitPromise = initializeMemoryBank(
            supabase, 
            user.id,
            // user 객체 전체 전달
            user
          ).catch(err => {
            // 실패해도 계속 진행
          });
          
          // Process messages in parallel
          const processMessagesPromises = messages.map(async (msg) => {
            const converted = await convertMessageForAI(msg, model, supabase);
            return {
              id: msg.id,
              ...converted
            } as MultiModalMessage;
          });
          
          // Wait for message processing to complete
          const processMessages = await Promise.all(processMessagesPromises);

          // Process last message shortcut if needed
          const lastMessage = processMessages[processMessages.length - 1];
          const processedLastMessagePromise = handlePromptShortcuts(supabase, lastMessage, user.id) as Promise<MultiModalMessage>;
          
          // Prepare DB operations (but don't wait)
          let dbOperationsPromise = Promise.resolve();
          
          if (lastMessage.role === 'user' && !isRegeneration && saveToDb && chatId) {
            dbOperationsPromise = new Promise(async (resolve) => {
              try {
                const { data: existingMessages } = await supabase
                  .from('messages')
                  .select('id')
                  .eq('chat_session_id', chatId)
                  .eq('user_id', user.id)
                  .order('created_at', { ascending: true })
                  .limit(2);
                
                const isInitialDbMessage = existingMessages?.length === 1;
                
                if (!isInitialDbMessage) {
                  await saveUserMessage(supabase, chatId, user.id, lastMessage, model);
                }
                resolve(undefined);
              } catch (error) {
                resolve(undefined);
              }
            });
          }

          const assistantMessageId = isRegeneration && existingMessageId 
            ? existingMessageId 
            : generateMessageId();

          if (chatId) {
            dbOperationsPromise = dbOperationsPromise.then(() => 
              createOrUpdateAssistantMessage(
                supabase,
                chatId,
                user.id,
                model,
                getProviderFromModel(model),
                isRegeneration,
                assistantMessageId
              )
            );
          }

          // Now wait for the processed message and system prompt
          const [processedLastMessage] = await Promise.all([
            processedLastMessagePromise,
          ]);
          
          processMessages[processMessages.length - 1] = processedLastMessage;

          const abortController = new AbortController();

          const modelConfig = getModelById(model);
          const supportsReasoning = modelConfig?.reasoning?.enabled || false;
          // Get max output tokens for this model (if defined)
          // const maxOutputTokens = modelConfig?.maxOutputTokens;

          const providerOptions: any = {};

          if (supportsReasoning) {
            providerOptions.anthropic = { 
              thinking: { 
                type: 'enabled', 
                budgetTokens: 12000 
              } 
            };
            
            providerOptions.xai = { 
              reasoningEffort: 'high' 
            };
            
            providerOptions.openai = { 
              reasoningEffort: 'high',
            };
            
            providerOptions.google = { 
              thinkingConfig: { 
                thinkingBudget: 2048,
                includeThoughts: true // this shit doesnt work. don't know why.
              }, 
              safetySettings: [
                { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
              ],
            };
          }
          
          
          // 메모리 뱅크 초기화 완료 대기 (Agent 모드 여부와 상관없이)
          await memoryInitPromise;

          // 1. 메모리 뱅크 전체 내용 조회
          const { data: memoryData } = await getAllMemoryBank(supabase, user.id);
          
          // 메모리 뱅크 내용이 초기화 값인지 확인
          const isDefaultMemory = memoryData && 
            memoryData.includes('This section contains basic information about the user') &&
            memoryData.includes('This section tracks user preferences such as UI style');
                    
          // 3. 향상된 시스템 프롬프트 (사용자 프로필 컨텍스트 추가)
          const currentSystemPrompt = buildSystemPrompt(
            isAgentEnabled ? 'agent' : 'regular',
            'initial',
            // 초기 템플릿인 경우에는 사용자 프로필 컨텍스트를 추가하지 않음
            isDefaultMemory ? undefined : (memoryData || undefined)
          );
          
          if (isAgentEnabled) {
            // 4. 시스템 프롬프트 토큰 수 추정
            const systemTokens = estimateTokenCount(currentSystemPrompt);
            
            // 5. 토큰 한도를 고려한 메시지 선택 - 모델의 contextWindow 또는 기본값 사용
            const maxContextTokens = modelConfig?.contextWindow || 8000;
            const remainingTokens = maxContextTokens - systemTokens;
            
            const optimizedMessages = selectMessagesWithinTokenLimit(
              processMessages, 
              remainingTokens,
            );

            // 현재 질문 추출을 위한 준비
            let userQuery = '';
            
            // 각 메시지에서 텍스트 및 첨부파일 정보 추출 함수
            const extractTextFromMessage = (msg: any) => {
              if (typeof msg.content === 'string') {
                return msg.content;
              } else if (Array.isArray(msg.content)) {
                // 텍스트 부분 추출
                const textContent = msg.content
                  .filter((part: any) => part.type === 'text')
                  .map((part: any) => part.text)
                  .join('\n');
                
                // 첨부파일 메타데이터 추출
                const attachmentInfo = [];
                
                // 이미지 처리
                const images = msg.content.filter((part: any) => part.type === 'image');
                if (images.length > 0) {
                  attachmentInfo.push(`[ATTACHED: ${images.length} image(s)]`);
                }
                
                // 파일 처리
                const files = msg.content.filter((part: any) => part.type === 'file');
                files.forEach((file: any) => {
                  if (file.file) {
                    const fileName = file.file.name || '';
                    const fileType = file.file.contentType || '';
                    
                    // 파일 유형에 따른 구체적인 정보 제공
                    if (fileType.startsWith('image/') || fileName.match(/\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i)) {
                      attachmentInfo.push(`[ATTACHED: Image file - ${fileName}]`);
                    } else if (fileType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')) {
                      attachmentInfo.push(`[ATTACHED: PDF document - ${fileName}]`);
                    } else if (fileName.match(/\.(js|ts|jsx|tsx|py|java|c|cpp|cs|go|rb|php|html|css|sql|swift|kt|rs|dart|json|xml|yaml|yml)$/i)) {
                      const extension = fileName.split('.').pop();
                      attachmentInfo.push(`[ATTACHED: Code file (${extension}) - ${fileName}]`);
                    } else {
                      attachmentInfo.push(`[ATTACHED: File - ${fileName} (${fileType})]`);
                    }
                  }
                });
                
                // experimental_attachments 처리
                if (Array.isArray(msg.experimental_attachments)) {
                  msg.experimental_attachments.forEach((attachment: any) => {
                    const fileName = attachment.name || '';
                    const fileType = attachment.contentType || attachment.fileType || '';
                    
                    if (fileType === 'image' || fileType.startsWith('image/') || 
                        fileName.match(/\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i)) {
                      attachmentInfo.push(`[ATTACHED: Image file - ${fileName}]`);
                    } else if (fileType === 'pdf' || fileType === 'application/pdf' || 
                              fileName.toLowerCase().endsWith('.pdf')) {
                      attachmentInfo.push(`[ATTACHED: PDF document - ${fileName}]`);
                    } else if (fileType === 'code' || 
                              fileName.match(/\.(js|ts|jsx|tsx|py|java|c|cpp|cs|go|rb|php|html|css|sql|swift|kt|rs|dart|json|xml|yaml|yml)$/i)) {
                      const extension = fileName.split('.').pop();
                      attachmentInfo.push(`[ATTACHED: Code file (${extension}) - ${fileName}]`);
                    } else if (fileName) {
                      attachmentInfo.push(`[ATTACHED: File - ${fileName} (${fileType})]`);
                    }
                  });
                }
                
                // 텍스트와 첨부파일 정보 결합
                if (textContent) {
                  return attachmentInfo.length > 0 
                    ? `${textContent}\n${attachmentInfo.join('\n')}` 
                    : textContent;
                } else if (attachmentInfo.length > 0) {
                  return attachmentInfo.join('\n');
                }
              }
              return '';
            };
            
            // 현재 질문만 userQuery에 할당
            const currentMessage = optimizedMessages[optimizedMessages.length - 1];
            userQuery = extractTextFromMessage(currentMessage);

            // 이전 대화 컨텍스트 추출 (현재 질문 제외한 모든 최적화된 메시지)
            // 이미 토큰 제한을 고려하여 최적화된 메시지에서 마지막 메시지(현재 질문)만 제외
            const conversationHistory = convertMultiModalToMessage(optimizedMessages.slice(0, -1));
            
                        // 모델에 따라 사용 가능한 도구 필터링 (Gemini 2.5 Pro 또는 Flash인 경우 link_reader와 youtube_link_analyzer 제거)
              let availableToolsList = [
                'web_search',
                'calculator',
                'link_reader',
                'image_generator',
                'academic_search',
                'youtube_search',
                'youtube_link_analyzer'
              ];

              if (model === 'gemini-2.5-pro-preview-05-06' || model === 'gemini-2.5-flash-preview-04-17') {
                availableToolsList = availableToolsList.filter(tool => tool !== 'link_reader' && tool !== 'youtube_link_analyzer');
              }

              // 도구 설명 객체 정의 (프롬프트에서 사용)
              const toolDescriptions = {
                'web_search': 'Real-time information from the internet',
                'calculator': 'Mathematical calculations and computations',
                'link_reader': 'Reading and analyzing web page content',
                'image_generator': 'Creating visual content',
                'academic_search': 'Finding scholarly and research materials',
                'youtube_search': 'Finding relevant video content',
                'youtube_link_analyzer': 'Analyzing specific YouTube videos'
              };

              // 첫 번째 단계: 계획 수립 (Planning) - 수정된 프롬프트
              const planningSystemPrompt = buildSystemPrompt(
                'agent',
                'initial',
                memoryData || undefined
              );

              // console.log('planningSystemPrompt', planningSystemPrompt);
              // console.log('conversationHistory', conversationHistory);
              // console.log('userQuery', userQuery);
              
              const planningResult = await streamText({
                model: providers.languageModel(model), 
                providerOptions: supportsReasoning ? providerOptions : undefined,
                prompt: `
${planningSystemPrompt}

              # Model Information
              - Current model: ${model}
              - Available tools are limited based on the model. For Gemini 2.5 Pro and Gemini 2.5 Flash, 'link_reader' and 'youtube_link_analyzer' are not available. If the user requests these tools, you must respond with an error message.

# Previous Conversation
${conversationHistory}

# User Query
${userQuery}

# File Attachment Analysis Instructions
- For all attachments, incorporate the file information in your analysis plan

              Your task is to first check if the user query explicitly requests any unavailable tools:
              - If the current model is 'gemini-2.5-pro-preview-05-06' or 'gemini-2.5-flash-preview-04-17' and the user query mentions or requests 'link_reader' or 'youtube_link_analyzer' (e.g., words like "link reader", "youtube analyzer", or their equivalents in any language), respond ONLY with a clear error message in the same language as the user's query: "This model does not support the 'link_reader' or 'youtube_link_analyzer' tool. Please use a different model or rephrase your query to avoid these tools."
              - Do not create a plan or proceed further if an unavailable tool is requested.
              - Otherwise, create a comprehensive plan to address the user's query.
              1. What is the user really asking for? Analyze the query to identify key needs.
              2. What information or capabilities will be needed? Review the available tools and determine if any are suitable by comparing them to the user's query.
              3. If suitable tools are available, select and justify their use in the plan. If no tools are appropriate based on your analysis, rely solely on the model's built-in capabilities without attempting to use tools.
              4. What is the best approach to provide a complete and helpful response?
              5. What workflow mode would be most appropriate?

              Available capabilities include:
              ${availableToolsList.length > 0 
                ? availableToolsList.map(tool => `- ${tool.charAt(0).toUpperCase() + tool.slice(1).replace('_', ' ')}: ${toolDescriptions[tool as keyof typeof toolDescriptions]}`).join('\n')
                : '- No specific tools available for this model. In this case, I will rely on the model\'s built-in capabilities to handle the query.'
              }

              IMPORTANT LANGUAGE REQUIREMENT:
              - Respond in the same language as the user's query
              - If user writes in Korean, respond in Korean
              - If user writes in English, respond in English
              - If user writes in another language, respond in that language

              Create a detailed plan explaining your approach to helping the user.
              `,
              });

              // Merge planningResult into dataStream with sendReasoning: true
              // planningResult.mergeIntoDataStream(dataStream, { sendReasoning: true });

                        let planningText = '';
            for await (const textPart of planningResult.textStream) {
              planningText += textPart;
              dataStream.writeMessageAnnotation({
                type: 'agent_reasoning_progress',
                data: JSON.parse(JSON.stringify({
                  agentThoughts: '', // 빈 값으로 시작
                  plan: planningText,
                  selectionReasoning: '',
                  workflowMode: '',
                  modeReasoning: '',
                  selectedTools: [],
                  timestamp: new Date().toISOString(),
                  isComplete: false,
                  stage: 'planning' // 계획 단계임을 표시
                }))
              });
            }

            // 계획 수립 완료 표시
            dataStream.writeMessageAnnotation({
              type: 'agent_reasoning_progress',
              data: JSON.parse(JSON.stringify({
                agentThoughts: '', 
                plan: planningText,
                selectionReasoning: '',
                workflowMode: '',
                modeReasoning: '',
                selectedTools: [],
                timestamp: new Date().toISOString(),
                isComplete: true,
                stage: 'planning' // 계획 단계임을 표시
              }))
            });

            // 두 번째 단계: 도구 선택 (generateObject 사용)
            const routingDecision = await generateObject({
              model: providers.languageModel('gemini-2.0-flash'),
              prompt: `
            Based on the following comprehensive plan, quickly select the specific tools needed:

            # Plan Created
            ${planningText}

            # User Query
            ${userQuery}

            Now select the specific tools needed to execute this plan effectively.

            Available Tools (use exact names):
            ${availableToolsList.map(tool => `- "${tool}": For ${toolDescriptions[tool as keyof typeof toolDescriptions]}`).join('\n')}

            ## Workflow Modes:
            1. **information_response**: Information-focused tasks (Q&A, explanations, research)
            2. **content_creation**: Creation-focused tasks (writing, coding, design)
            3. **balanced**: Both information gathering and content creation needed

            IMPORTANT LANGUAGE REQUIREMENT:
            - Tool selection must use exact English names from the available tools list above
            - All other fields (reasoning, selectionReasoning, modeReasoning) MUST be written in the same language as the user's query
            - If user writes in Korean, respond in Korean (except for tool names)
            - If user writes in English, respond in English (except for tool names which are already in English)
            - If user writes in another language, respond in that language (except for tool names)
            `,
              schema: z.object({
                selectedTools: z.array(z.enum(availableToolsList as [string, ...string[]])).describe('Array of tools needed for this query'),
                reasoning: z.string().describe('Brief reasoning for tool selection'),
                selectionReasoning: z.string().describe('Brief justification for the selected tools'),
                workflowMode: z.enum(['information_response', 'content_creation', 'balanced']).describe('The optimal workflow mode for this query'),
                modeReasoning: z.string().describe('Brief explanation for the selected workflow mode')
              })
            });
            
            
            const hasImage = optimizedMessages.some(msg => {
              if (Array.isArray(msg.content)) {
                return msg.content.some(part => part.type === 'image');
              }
              return false;
            });

            const hasFile = optimizedMessages.some(msg => {
              if (Array.isArray(msg.content)) {
                return msg.content.some(part => part.type === 'file');
              }
              return false;
            });
            
            
            // 최종 라우팅 결정에 대한 추론 과정을 사용자에게 표시
            const agentReasoningAnnotation = {
              type: 'agent_reasoning',
              data: JSON.parse(JSON.stringify({
                agentThoughts: routingDecision.object.reasoning,
                plan: planningText, // 계획은 첫 번째 단계에서 생성됨
                selectionReasoning: routingDecision.object.selectionReasoning,
                workflowMode: routingDecision.object.workflowMode,
                modeReasoning: routingDecision.object.modeReasoning,
                selectedTools: routingDecision.object.selectedTools,
                timestamp: new Date().toISOString(),
                isComplete: true
              }))
            };
            // JSON.parse/stringify를 통해 JSONValue 타입으로 변환하여 타입 오류 해결
            dataStream.writeMessageAnnotation(agentReasoningAnnotation);
            
            // 저장용 추론 데이터 객체 생성
            const agentReasoningData = {
              agentThoughts: routingDecision.object.reasoning,
              plan: planningText, // 계획은 첫 번째 단계에서 생성됨
              selectionReasoning: routingDecision.object.selectionReasoning,
              workflowMode: routingDecision.object.workflowMode,
              modeReasoning: routingDecision.object.modeReasoning,
              selectedTools: routingDecision.object.selectedTools,
              timestamp: new Date().toISOString(),
              isComplete: true
            };
            
            // 두 번째 단계: 도구별 맞춤형 시스템 프롬프트 구성
            let toolSpecificPrompts: string[] = [];
            const tools: Record<string, any> = {};
            
            // 선택된 도구들을 기반으로 도구 초기화
            routingDecision.object.selectedTools.forEach((toolName: string) => {
              switch (toolName) {
                case 'web_search':
              tools.web_search = initializeTool('web_search', dataStream);
              toolSpecificPrompts.push(toolPrompts.webSearch);
                  break;
                case 'calculator':
              tools.calculator = initializeTool('calculator', dataStream);
              toolSpecificPrompts.push(toolPrompts.calculator);
                  break;
                case 'link_reader':
              tools.link_reader = initializeTool('link_reader', dataStream);
              toolSpecificPrompts.push(toolPrompts.linkReader);
                  break;
                case 'image_generator':
              tools.image_generator = initializeTool('image_generator', dataStream);
              toolSpecificPrompts.push(toolPrompts.imageGenerator);
                  break;
                case 'academic_search':
              tools.academic_search = initializeTool('academic_search', dataStream);
              toolSpecificPrompts.push(toolPrompts.academicSearch);
                  break;
                case 'youtube_search':
              tools.youtube_search = initializeTool('youtube_search', dataStream);
              toolSpecificPrompts.push(toolPrompts.youtubeSearch);
                  break;
                case 'youtube_link_analyzer':
              tools.youtube_link_analyzer = initializeTool('youtube_link_analyzer', dataStream);
              toolSpecificPrompts.push(toolPrompts.youtubeLinkAnalyzer);
                  break;
            }
            });
              
            // 날짜 정보 추가
            const todayDate = new Date().toLocaleDateString("en-US", { 
              year: "numeric", 
              month: "short", 
              day: "2-digit", 
              weekday: "short" 
            });
            
            // 워크플로우 모드에 따른 추가 지침 생성
            let workflowGuidelines = "";
            
            switch(routingDecision.object.workflowMode) {
              case 'information_response':
                workflowGuidelines = `
# WORKFLOW: INFORMATION RESPONSE MODE
You're operating in information response mode. This means:
1. Focus on gathering comprehensive information using the tools
2. Provide a detailed, comprehensive main response
3. Your output in this phase should be the complete answer to the user's query
4. Keep your tools usage efficient but thorough

After collecting information, create a complete response that addresses all aspects of the user's query.
`;
                break;
              case 'content_creation':
                workflowGuidelines = `
# WORKFLOW: CONTENT CREATION MODE
You're operating in content creation mode (the preferred mode for organized responses). This means:
1. Use tools efficiently to gather just the necessary information and context
2. Keep your main response brief, concise and focused
3. Your main response should be a short introduction or summary ONLY (1-3 paragraphs)
4. Mention that detailed content will follow in files
5. DO NOT include detailed explanations, code, or elaborate content in this phase

In this phase, focus ONLY on collecting necessary information and providing a very brief introduction.
The detailed content (code, written text, analysis, etc.) will be created in the files during the next phase.
Users prefer this approach as it keeps the chat clean while providing organized content in files.
`;
                break;
              case 'balanced':
              default:
                workflowGuidelines = `
# WORKFLOW: BALANCED MODE
You're operating in balanced mode. This means:
1. Gather comprehensive information using the tools
2. Provide a substantial main response that addresses the core query
3. Balance your effort between the main response and preparing for supporting files
4. Cover the essential explanations in your main response

In this phase, create a thorough response while keeping in mind that supporting files will complement your answer.
`;
                break;
            }
            
            // 결합된 시스템 프롬프트 구성 (enhancedSystemPrompt 사용)
            const agentSystemPrompt = buildSystemPrompt(
              'agent',
              'second',
              memoryData || undefined
            ) + `
            # SECOND STAGE: TOOL EXECUTION AND MAIN RESPONSE CREATION
Today's Date: ${todayDate}

            ## User Query
            ${userQuery}
            
            ## User Query Analysis
            ${routingDecision.object.reasoning}

            ## Plan -- This is just for your reference. You don't need to explicitly follow it. 
            ${planningText}
            
            ## Selected Workflow Mode: ${routingDecision.object.workflowMode}
            ${routingDecision.object.modeReasoning}
${workflowGuidelines}
            
${toolSpecificPrompts.join("\n\n")}

${hasImage ? `
            # ABOUT THE IMAGE:
            - Describe the image in detail.
            - Use appropriate tools to get more information if needed
            - Do not provide detailed analysis - just determine what tools to use
` : ''}

${hasFile ? `
            # ABOUT THE FILE:
            - Briefly identify what's in the file (1-2 sentences)
            - Use appropriate tools to process it if needed
            - Do not provide detailed analysis - just determine what tools to use
` : ''}

            **IMPORTANT: Use the same language as the user for all responses.**
            `;
            // 활성화할 도구 목록 결정
            const activeTools = routingDecision.object.selectedTools;
            // 도구 결과 저장 - agentReasoning을 포함하여 초기화
            const toolResults: any = {
              agentReasoning: agentReasoningData
            };
            
            // 워크플로우 모드에 따른 추가 지침 생성
            let responseInstructions = "";
            
            switch(routingDecision.object.workflowMode) {
              case 'information_response':
                responseInstructions = `
# FINAL RESPONSE INSTRUCTIONS
After using the tools, create a comprehensive answer that:
- Directly addresses the user's original query with all relevant findings from the tools
- Presents information in a logical, easy-to-follow manner
- Maintains a helpful, conversational tone
- Ensures factual accuracy based on tool results
- Provides a complete and detailed response to the user's question

Remember that you're in INFORMATION RESPONSE mode, so your main focus should be creating a detailed, comprehensive textual response. Supporting files will be minimal, if any.
`;
                break;
              case 'content_creation':
                responseInstructions = `
# FINAL RESPONSE INSTRUCTIONS
After using the tools, create a VERY BRIEF introductory response that:
- Briefly acknowledges the user's request (1 sentence)
- Provides a very concise overview of what will be in the files (1-2 sentences)
- Keeps the entire response under 3-5 sentences maximum
- DOES NOT include detailed explanations or content - save this for the files
- Mentions that the detailed information is organized in the files that follow

IMPORTANT: Your response must be extremely concise. The main value will be delivered in the files, not in this chat response. Users prefer brief chat responses with well-organized files.

Examples of good brief responses:
"I've gathered information about climate change impacts. You'll find a comprehensive analysis in the attached research paper, which covers current evidence, future projections, and mitigation strategies."

"Here's the Python game you requested. I've created a main.py file with the game logic and a README.md with instructions for running and playing the game."
`;
                break;
              case 'balanced':
              default:
                responseInstructions = `
# FINAL RESPONSE INSTRUCTIONS
After using the tools, create a balanced response that:
- Addresses the user's original query with relevant findings from the tools
- Provides enough detail to be useful on its own
- Maintains a helpful, conversational tone
- Ensures factual accuracy based on tool results
- Balances between explanation and implementation details

Remember that you're in BALANCED mode, so provide a substantial response while keeping in mind that supporting files will complement your answer with additional details or implementations.
`;
                break;
            }
            
            const systemPromptAgent = `${agentSystemPrompt}
            
${responseInstructions}
            
Remember to maintain the language of the user's query throughout your response.
            `;

            const messages = convertMultiModalToMessage(optimizedMessages);

            const finalstep = streamText({
              model: providers.languageModel(model),
              system: systemPromptAgent,
              // 토큰 제한을 고려한 최적화된 메시지 사용
              messages: messages,
              // temperature: 0.2,
              toolChoice: 'auto',
              experimental_activeTools: activeTools,
              tools,
              maxSteps: 15,
              providerOptions: providerOptions,
              onFinish: async (completion) => {
                if (abortController.signal.aborted) return;
                
                // 🆕 실제 토큰 사용량 추출 및 로깅
                const actualTokenUsage = completion.usage;
                if (actualTokenUsage) {
                  console.log('🔢 [TOKEN USAGE] Regular mode actual tokens:', {
                    promptTokens: actualTokenUsage.promptTokens,
                    completionTokens: actualTokenUsage.completionTokens,
                    totalTokens: actualTokenUsage.totalTokens,
                    model: model,
                    messageId: assistantMessageId
                  });
                }
                
                // 최종 계산 결과 주석 전송 (계산기가 사용된 경우에만)
                if (routingDecision.object.selectedTools.includes('calculator')) {
                dataStream.writeMessageAnnotation({
                  type: 'math_calculation_complete',
                    steps: tools.calculator.calculationSteps,
                  finalAnswer: completion.text || "Calculation completed"
                });
                }
                // 에이전트 추론 과정은 이미 toolResults에 포함되어 있음
                
                // 각 도구의 결과 수집
                routingDecision.object.selectedTools.forEach((toolName: string) => {
                  switch (toolName) {
                    case 'calculator':
                      if (tools.calculator?.calculationSteps?.length > 0) {
                        toolResults.calculationSteps = tools.calculator.calculationSteps;
                      }
                      break;
                    case 'web_search':
                      if (tools.web_search?.searchResults?.length > 0) {
                        toolResults.webSearchResults = tools.web_search.searchResults;
                      }
                      break;
                    case 'link_reader':
                      if (tools.link_reader?.linkAttempts?.length > 0) {
                        toolResults.linkReaderAttempts = tools.link_reader.linkAttempts;
                      }
                      break;
                    case 'image_generator':
                      if (tools.image_generator?.generatedImages?.length > 0) {
                        toolResults.generatedImages = tools.image_generator.generatedImages;
                      }
                      break;
                    case 'academic_search':
                      if (tools.academic_search?.searchResults?.length > 0) {
                        toolResults.academicSearchResults = tools.academic_search.searchResults;
                      }
                      break;
                    case 'youtube_search':
                      if (tools.youtube_search?.searchResults?.length > 0) {
                        toolResults.youtubeSearchResults = tools.youtube_search.searchResults;
                      }
                      break;
                    case 'youtube_link_analyzer':
                      if (tools.youtube_link_analyzer?.analysisResults?.length > 0) {
                        toolResults.youtubeLinkAnalysisResults = tools.youtube_link_analyzer.analysisResults;
                      }
                      break;
                  }
                });


                // 도구 사용 완료 후 구조화된 응답 생성 부분 (streamObject 사용)
                dataStream.writeMessageAnnotation({
                  type: 'status',
                  data: { message: 'Creating supporting files and follow-up questions...' }
                });

                try {
                  // 최종 결과 기다리기 
                  const finalResult = await finalstep.text;

                  // 도구 결과 요약을 위한 객체 생성
                  const toolSummaries = [];
                  
                  // 웹 검색 결과 - 핵심 정보만 추출
                  if (toolResults.webSearchResults && toolResults.webSearchResults.length > 0) {
                    const simplifiedResults = toolResults.webSearchResults.map((search: any) => {
                      const simplifiedSearches = search.searches.map((s: any) => ({
                        query: s.query,
                        results: s.results.map((r: any) => ({
                          title: r.title,
                          url: r.url,
                          content: r.content || r.snippet
                        }))
                      }));
                      
                      return { searches: simplifiedSearches };
                    });
                    
                    toolSummaries.push(`WEB SEARCH RESULTS: ${JSON.stringify(simplifiedResults)}`);
                  }
                  
                  if (toolResults.calculationSteps && toolResults.calculationSteps.length > 0) {
                    toolSummaries.push(`CALCULATION RESULTS: ${JSON.stringify(toolResults.calculationSteps)}`);
                  }
                  
                  // 링크 리더 결과 - 콘텐츠 정보 요약
                  if (toolResults.linkReaderAttempts && toolResults.linkReaderAttempts.length > 0) {
                    const simplifiedLinks = toolResults.linkReaderAttempts
                      .filter((l: any) => l.status === 'success')
                      .map((l: any) => ({
                        url: l.url,
                        title: l.title,
                        status: l.status,
                        content: l.content || "Content not available"
                      }));
                    
                    toolSummaries.push(`LINK READER RESULTS: ${JSON.stringify(simplifiedLinks)}`);
                    
                  }
                  
                  if (toolResults.generatedImages && toolResults.generatedImages.length > 0) {
                    toolSummaries.push(`IMAGE GENERATOR RESULTS: ${JSON.stringify(toolResults.generatedImages)}`);
                  }
                  
                  if (toolResults.academicSearchResults && toolResults.academicSearchResults.length > 0) {
                    toolSummaries.push(`ACADEMIC SEARCH RESULTS: ${JSON.stringify(toolResults.academicSearchResults)}`);
                  }
                  
                  // if (toolResults.xSearchResults && toolResults.xSearchResults.length > 0) {
                  //   toolSummaries.push(`X SEARCH RESULTS: ${JSON.stringify(toolResults.xSearchResults)}`);
                  // }
                  
                  if (toolResults.youtubeSearchResults && toolResults.youtubeSearchResults.length > 0) {
                    toolSummaries.push(`YOUTUBE SEARCH RESULTS: ${JSON.stringify(toolResults.youtubeSearchResults)}`);
                  }
                  
                  if (toolResults.youtubeLinkAnalysisResults && toolResults.youtubeLinkAnalysisResults.length > 0) {
                    toolSummaries.push(`YOUTUBE LINK ANALYSIS RESULTS: ${JSON.stringify(toolResults.youtubeLinkAnalysisResults)}`);
                  }
                  
                  
                  // 워크플로우 모드에 따른 파일 생성 지침 조정
                  let fileCreationGuidelines = "";
                  
                  switch(routingDecision.object.workflowMode) {
                    case 'information_response':
                      fileCreationGuidelines = `
# FILE CREATION GUIDELINES (INFORMATION RESPONSE MODE)
In information response mode, the focus was on providing a comprehensive main response.
At this stage, you may create minimal supporting files if necessary, but they're optional and should only be created if they add significant value.

If you create files:
- They should complement the main response, not duplicate it
- Focus on structured references, checklists, or summary tables that organize the information
- Consider creating reference sheets, diagrams, or quick-reference guides if helpful
`;
                      break;
                    case 'content_creation':
                      fileCreationGuidelines = `
# FILE CREATION GUIDELINES (CONTENT CREATION MODE)
In content creation mode, this is the CRITICAL PHASE where you create detailed, well-structured files.
This is the MAIN DELIVERABLE that provides value to the user.

Your files should:
- Be extremely comprehensive and complete based on what was requested
- Include ALL content that would answer the user's query in appropriate format and structure
- Create multiple files if necessary to properly organize different aspects of the content
- Follow professional standards for the type of content being created:
  * For code: include proper organization, comments, documentation, and example usage
  * For written content: use proper structure with clear sections, headings, and professional formatting
  * For data/analysis: include clear organization, labels, explanations, and visualizations where helpful
- Be immediately usable without further modifications or additions
- Include all relevant information that was mentioned in the brief chat response

File naming and organization:
- Use descriptive filenames that clearly indicate the content
- For complex deliverables, include a README.md file that explains the structure and purpose of each file
- Organize content logically with appropriate sections, headings, and structure

Content types to consider:
- Code files (.py, .js, etc.): For complete, executable code examples
- Markdown (.md): For documentation, reports, articles, guides
- Data files (.json, .csv): For structured data
- Configuration files: For system setups, environment configurations
- Templates: For reusable content patterns

IMPORTANT: Put your MAXIMUM effort into creating these files. This is where the user gets the most value from your response.
`;
                      break;
                    case 'balanced':
                    default:
                      fileCreationGuidelines = `
# FILE CREATION GUIDELINES (BALANCED MODE)
In balanced mode, your files should complement the main response you've already provided.

Your files should:
- Extend the main response with additional details, examples, or implementations
- Avoid duplicating content from the main response
- Provide organized, structured content that's ready for use
- Focus on aspects that benefit from being in a separate file format

Files can include a variety of content types based on what best serves the user's query:
- Code samples or implementations
- Detailed written content that expands on concepts from the main response
- Charts, diagrams, or other visual representations
- Step-by-step procedures or templates
- Structured data or analysis
`;
                      break;
                  }
                  
                  // 최종 응답 생성을 위한 프롬프트 구성
                  const responsePrompt = `
${buildSystemPrompt('agent', 'third', memoryData || undefined)}

You are now in the third stage of the Chatflix Agentic Process - creating supporting files based on the information gathered and the main response already provided.
Here's the blueprint and the previous steps we've already taken:
# Original User Query
"${userQuery}"

# Stage 1: Agentic Plan and Workflow Analysis
## Analysis:
${routingDecision.object.reasoning}

## Plan:
${planningText}

## Selected Workflow Mode: ${routingDecision.object.workflowMode}
${routingDecision.object.modeReasoning}

# Stage 2: Tool Execution and Main Response Creation
## Information Gathered by Tools Execution:
${toolSummaries.join('\n\n')}

## Main Response Already Provided to User:
${finalResult}

# Stage 3: Supporting Files Creation - You're here

${fileCreationGuidelines}

## Your Task
Create supporting files that complement the main response already provided:

1. SUPPORTING FILES: Additional content for the canvas area (adaptive based on workflow mode)
   - Each file should have a clear purpose and be self-contained
   - Use appropriate file extensions (.py, .js, .md, .json, etc.)
   - Follow best practices for the content type (code, data, etc.)
   - IMPORTANT: ALL file content MUST be formatted with proper Markdown syntax. Use the following guidelines:
     - For code blocks, use triple backticks with language specification: \`\`\`python, \`\`\`javascript, etc.
     - For charts, use \`\`\`chartjs with VALID JSON format (see Chart Guidelines below)
     - For tables, use proper Markdown table syntax with pipes and dashes
     - For headings, use # symbols (e.g., # Heading 1, ## Heading 2)
     - For lists, use proper Markdown list syntax (-, *, or numbered lists)
     - For emphasis, use *italic* or **bold** syntax
     - For links, use [text](url) syntax
     - Ensure proper indentation and spacing for nested structures

## Chart Guidelines for Supporting Files
When creating data visualizations from gathered information, use \`\`\`chartjs with VALID JSON format:

**CRITICAL: All property names and string values MUST be in double quotes for valid JSON**

Example chart format:
\`\`\`chartjs
{
  "type": "bar",
  "data": {
    "labels": ["Data Point 1", "Data Point 2"],
    "datasets": [{
      "label": "Research Results",
      "data": [25, 75],
      "backgroundColor": ["#FF6B6B", "#4ECDC4"]
    }]
  },
  "options": {
    "responsive": true,
    "plugins": 
      "title": {
        "display": true,
        "text": "Data Analysis from Tools"
      }
    }
  }
}
\`\`\`

**IMPORTANT RESTRICTIONS FOR CHART CREATION:**
- **NEVER use callback functions in tooltip, scales, or any other options**
- **AVOID complex JavaScript functions inside JSON - they cannot be parsed**
- **Use simple, static configurations only**
- **For tooltips, rely on Chart.js default formatting - it's sufficient for most cases**

**FORBIDDEN PATTERNS (will cause parsing errors):**
❌ "callbacks": { "label": "function(context) { ... }" }
❌ "callback": "function(value) { return ['A', 'B'][value]; }"
❌ Any string containing backslashes like "text with \\\\ backslash"
❌ Multi-line strings with \\ line continuation

**SAFE ALTERNATIVE APPROACHES:**
✅ Use default Chart.js tooltips (no custom callbacks needed)
✅ Use simple static labels: "labels": ["Category A", "Category B", "Category C"]
✅ Use basic title and legend configurations without functions
✅ Rely on Chart.js automatic formatting for most data displays

**Chart Creation Scenarios:**
- Web search results: Create comparison or trend charts
- Academic research data: Visualize research findings or statistics
- YouTube video analysis: Show engagement metrics or trends
- Calculator results: Display mathematical relationships
- Multi-source data: Create comprehensive comparison visualizations

   - File Types to Consider (ONLY if needed):
    - code files (.py, .js, etc.): For complete, executable code examples
    - data files (.json, .csv): For structured data
    - chart files (.md): For data visualizations using chartjs blocks
    - explanation files (.md): For detailed explanations or background information
    - step-by-step guides (.md): For procedures or tutorials
    - comparison tables (.md): For comparing multiple options or data points



IMPORTANT: 
- Respond in the same language as the user's query
- You MUST NOT create a main response again - the user has already been given the main response
- DO NOT create files unless they provide substantial additional value
- NEVER use HTML tags in file content
- Consider creating charts when you have gathered quantitative data that would benefit from visualization
`;


                    let finalModel = model;

                  // Claude Sonnet 시리즈가 선택된 경우 무조건 Gemini 2.5 Pro로 대체
                  if (model.includes('claude') && model.includes('sonnet')) {
                    finalModel = 'gemini-2.5-pro-preview-05-06';
                  } 
            
                  // 세번째 단계: 구조화된 응답 생성 (파일만)
                  const objectResult = await streamObject({
                    model: providers.languageModel(finalModel),
                    schema: z.object({
                      response: z.object({
                        description: z.string().optional().describe('Brief description of the supporting files being provided (if any). If no files are needed, don\'t include this field.'),
                        files: z.array(
                          z.object({
                            name: z.string().describe('Name of the file with appropriate extension (e.g., code.py, data.json, explanation.md)'),
                            content: z.string().describe('Content of the file formatted with proper Markdown syntax, including code blocks with language specification'),
                            description: z.string().optional().describe('Optional short description of what this file contains')
                          })
                        ).optional().describe('Optional list of files to display in the canvas area - ONLY include when necessary for complex information that cannot be fully communicated in the main response')
                      })
                    }),
                    // providerOptions: providerOptions,
                    prompt: responsePrompt,
                    // temperature: 0.3,
                  });
                  
                  // 라우팅과 유사한 방식으로 비동기 처리
                  let lastResponse: any = {};
                  let partialCount = 0;
                  
                  
                  (async () => {
                    try {
                      for await (const partialObject of objectResult.partialObjectStream) {
                        if (abortController.signal.aborted) break;
                        
                        partialCount++;
                        
                        // 변경된 내용이 있을 때만 전송 (라우팅과 유사하게)
                        const partialResponse = partialObject.response || {};
                        
                        // 각 필드별로 변경 여부 확인
                        if (partialResponse.description !== lastResponse.description || 
                            JSON.stringify(partialResponse.files) !== JSON.stringify(lastResponse.files)) {
                          
                          dataStream.writeMessageAnnotation({
                            type: 'structured_response_progress',
                            data: JSON.parse(JSON.stringify(partialObject))
                          });
                          
                          // 마지막 응답 업데이트
                          lastResponse = JSON.parse(JSON.stringify(partialResponse));
                        }
                      }
                    } catch (error) {
                    }
                  })();
                  
                  // 최종 객체를 가져오기 전에 스트리밍이 어느정도 진행되도록 약간의 지연
                  if (partialCount < 3) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                  }
                  
                  // 최종 객체 처리
                  const finalObject = await objectResult.object;
                  
                  // 4단계: Follow-up 질문 생성
                  try {
                    // 3단계 결과 요약 생성
                    const stage3Summary = [];
                    if (finalObject.response.description) {
                      stage3Summary.push(`Supporting Files Description: ${finalObject.response.description}`);
                    }
                    if (finalObject.response.files && finalObject.response.files.length > 0) {
                      stage3Summary.push(`Generated Files:`);
                      finalObject.response.files.forEach(file => {
                        stage3Summary.push(`- ${file.name}${file.description ? ` (${file.description})` : ''}`);
                      });
                    }

                    const followUpPrompt = `
You are generating follow-up questions for a conversation. Based on the previous context and all the content created, create 3 natural follow-up questions that the user might want to ask next.

# Original User Query
"${userQuery}"

# Main Response Already Provided
${finalResult}

# Supporting Content Created (Stage 3)
${stage3Summary.length > 0 ? stage3Summary.join('\n') : 'No additional files were created.'}

# Your Task
Generate 3 natural follow-up questions that continue the conversation, taking into account both the main response AND any supporting files that were created:

REQUIREMENTS:
- Consider both the main response AND any supporting files created when generating questions
- If code files were created, suggest improvements, modifications, or related functionality
- If data/analysis files were created, suggest deeper analysis, comparisons, or related topics
- If documentation files were created, suggest related topics or practical applications
- Do NOT generate questions asking to display the content of a file that was created or mentioned (e.g., "Show me the content of main.py"). The user can already see file contents through the UI.
- Each follow-up should be a short, natural input that a user might actually type to an AI in a chat (not a question to the user)
- Use statements, requests, or short phrases that a user would enter as their next message (not questions like "Would you like to know more?")
- Avoid polite or indirect forms (e.g., "Would you like to know more?" X)
- Prefer direct, conversational, and actionable inputs (e.g., "Tell me more about Nvidia stock", "I want to know more about the tech sector", "Show me recent semiconductor market trends", "Analyze the outlook for tech stocks")
- The follow-ups can be questions, but only if they are in the form a user would type to an AI (e.g., "What's the outlook for Nvidia?", "Show me recent trends in tech stocks")
- Do NOT use "Would you like me to...", "Shall I...", "Do you need..." or similar forms
- Make sure each follow-up is suitable for direct input by the user
- Keep each follow-up under 15 words if possible
- Examples:
  * "Tell me more about Nvidia stock"
  * "I want to know more about the tech sector"
  * "Show me recent semiconductor market trends"
  * "Analyze the outlook for tech stocks"
  * "Recent trends in the AI industry"
  * "Improve the error handling in this code"
  * "Add more features to this application"
  * "Create a visualization of this data"

**LANGUAGE RULE**: Respond in the same language as the user's original query.

Format your response as exactly 3 lines, one question per line, with no numbering or bullets:
`;
                    
                    const followUpResult = await generateObject({
                      model: providers.languageModel('gemini-2.0-flash'),
                      prompt: followUpPrompt,
                      temperature: 0.7,
                      schema: z.object({
                        followup_questions: z.array(z.string()).length(3).describe('Exactly 3 natural follow-up questions that the user might want to ask next')
                      })
                    });

                    // Get follow-up questions from the structured result
                    const followUpQuestions = followUpResult.object.followup_questions;

                    // 구조화된 응답 생성 (파일과 follow-up 질문 포함)
                    const structuredResponse = {
                      response: {
                        description: finalObject.response.description,
                        files: finalObject.response.files,
                        followup_questions: followUpQuestions
                      }
                    };
                    
                    dataStream.writeMessageAnnotation({
                      type: 'structured_response',
                      data: JSON.parse(JSON.stringify(structuredResponse))
                    });
                    
                    // 구조화된 응답도 도구 결과에 포함
                    toolResults.structuredResponse = structuredResponse;
                  } catch (followUpError) {
                    console.error('Follow-up question generation failed:', followUpError);
                    // Follow-up 질문 생성 실패 시에도 파일만 포함한 응답 전송
                    const structuredResponse = {
                      response: {
                        description: finalObject.response.description,
                        files: finalObject.response.files,
                        followup_questions: [] // 빈 배열로 설정
                      }
                    };
                    
                    dataStream.writeMessageAnnotation({
                      type: 'structured_response',
                      data: JSON.parse(JSON.stringify(structuredResponse))
                    });
                    
                    toolResults.structuredResponse = structuredResponse;
                  }
                } catch (objError) {
                  // 오류 발생 시에도 기존 텍스트는 유지
                }

                // 먼저 DB에 저장하여 응답을 완료
                await handleStreamCompletion(
                  supabase,
                  assistantMessageId,
                  user.id,
                  model,
                  getProviderFromModel(model),
                  completion,
                  isRegeneration,
                  { 
                    original_model: requestData.originalModel || model,
                    token_usage: actualTokenUsage, // 🆕 실제 토큰 사용량 추가
                    tool_results: toolResults // 🆕 도구 결과 추가
                  }
                );

                // Increment daily request count only on successful, non-aborted completion
                if (!abortController.signal.aborted) {
                  await incrementSuccessfulRequestCount(
                    supabase,
                    user.id,
                    today,
                    currentRequestCount,
                    isSubscribed
                  );
                }

                // 백그라운드에서 메모리 업데이트 수행
                if (chatId && !abortController.signal.aborted) {
                  // AI의 응답과 사용자 메시지 준비
                  const userMessage = typeof processedLastMessage.content === 'string' 
                    ? processedLastMessage.content 
                    : JSON.stringify(processedLastMessage.content);
                  const aiMessage = completion.text;
                  
                  // 백그라운드에서 비동기 메모리 업데이트 실행
                  updateAllMemoryBanks(
                    supabase, 
                    user.id, 
                    chatId, 
                    optimizedMessages, 
                    userMessage, 
                    aiMessage
                  ).catch((error: Error) => {
                  });
                }
              }
            });
            
            finalstep.mergeIntoDataStream(dataStream, {
              sendReasoning: true
            });

          } else {
            // 일반 채팅 흐름 - 원래 코드 사용에 토큰 제한 최적화 추가            // 시스템 프롬프트 토큰 수 추정
            const systemTokens = estimateTokenCount(currentSystemPrompt);
            
            // 모델의 컨텍스트 윈도우 또는 기본값 사용
            const maxContextTokens = modelConfig?.contextWindow || 8000;
            const remainingTokens = maxContextTokens - systemTokens;

            const optimizedMessages = selectMessagesWithinTokenLimit(
              processMessages, 
              remainingTokens,
            );

            const messages = convertMultiModalToMessage(optimizedMessages);

            const result = streamText({
              model: providers.languageModel(model),
              system: currentSystemPrompt,
              messages: messages,
              // temperature: 0.7,
              // maxTokens: 20000,
              providerOptions: providerOptions,
              onFinish: async (completion) => {
                if (abortController.signal.aborted) return;

                // 🆕 실제 토큰 사용량 추출 및 로깅
                const actualTokenUsage = completion.usage;
                if (actualTokenUsage) {
                  console.log('🔢 [TOKEN USAGE] Regular mode actual tokens:', {
                    promptTokens: actualTokenUsage.promptTokens,
                    completionTokens: actualTokenUsage.completionTokens,
                    totalTokens: actualTokenUsage.totalTokens,
                    model: model,
                    messageId: assistantMessageId
                  });
                }

                await handleStreamCompletion(
                  supabase,
                  assistantMessageId,
                  user.id,
                  model,
                  getProviderFromModel(model),
                  completion,
                  isRegeneration,
                  { 
                    original_model: requestData.originalModel || model,
                    token_usage: actualTokenUsage // 🆕 실제 토큰 사용량 추가
                  }
                );

                // Increment daily request count only on successful, non-aborted completion
                if (!abortController.signal.aborted) {
                  await incrementSuccessfulRequestCount(
                    supabase,
                    user.id,
                    today,
                    currentRequestCount,
                    isSubscribed
                  );
                }

                // 백그라운드에서 메모리 업데이트 수행
                if (chatId && !abortController.signal.aborted) {
                  // AI의 응답과 사용자 메시지 준비
                  const userMessage = typeof processedLastMessage.content === 'string' 
                    ? processedLastMessage.content 
                    : JSON.stringify(processedLastMessage.content);
                  const aiMessage = completion.text;
                  
                  // 백그라운드에서 비동기 메모리 업데이트 실행
                  updateAllMemoryBanks(
                    supabase, 
                    user.id, 
                    chatId, 
                    optimizedMessages, 
                    userMessage, 
                    aiMessage
                  ).catch((error: Error) => {
                  });
                }
              }
            });

            result.mergeIntoDataStream(dataStream, {
              sendReasoning: true
            });

          }

      }
    });
}