import { streamText, smoothStream, createDataStreamResponse, streamObject, generateObject, Message } from 'ai';
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
  selectMessagesWithinTokenLimit,
  detectImages,
  detectPDFs,
  detectCodeAttachments
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
import { handleRateLimiting, handleChatflixRateLimiting } from './utils/ratelimit';
// import { toolPrompts } from './prompts/toolPrompts';
import { checkSubscription } from '@/lib/polar';

// 비구독자 컨텍스트 윈도우 제한
const CONTEXT_WINDOW_LIMIT_NON_SUBSCRIBER = 60000; // 60K tokens

// 메모리 관련 import
import { initializeMemoryBank, getAllMemoryBank, getUserPersonalInfo } from '@/utils/memory-bank';
import { smartUpdateMemoryBanks } from './services/memoryService';
import { estimateTokenCount } from '@/utils/context-manager';
import { selectOptimalModel, estimateMultiModalTokens } from './services/modelSelector';
import { 
  analyzeRequestAndDetermineRoute,
  analyzeContextRelevance 
} from './services/analysisService';
import { markdownJoinerTransform } from './markdown-transform';


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

// Helper function to collect tool results from various tools
function collectToolResults(tools: Record<string, any>, toolNames: string[]): any {
  const collectedToolResults: any = {};
  
  toolNames.forEach((toolName: string) => {
    switch (toolName) {
      case 'calculator':
        if (tools.calculator?.calculationSteps?.length > 0) {
          collectedToolResults.calculationSteps = tools.calculator.calculationSteps;
        }
        break;
      case 'web_search':
        if (tools.web_search?.searchResults?.length > 0) {
          collectedToolResults.webSearchResults = tools.web_search.searchResults;
        }
        break;
      case 'link_reader':
        if (tools.link_reader?.linkAttempts?.length > 0) {
          collectedToolResults.linkReaderAttempts = tools.link_reader.linkAttempts;
        }
        break;
      case 'image_generator':
        if (tools.image_generator?.generatedImages?.length > 0) {
          collectedToolResults.generatedImages = tools.image_generator.generatedImages;
        }
        break;
      case 'academic_search':
        if (tools.academic_search?.searchResults?.length > 0) {
          collectedToolResults.academicSearchResults = tools.academic_search.searchResults;
        }
        break;
      case 'youtube_search':
        if (tools.youtube_search?.searchResults?.length > 0) {
          collectedToolResults.youtubeSearchResults = tools.youtube_search.searchResults;
        }
        break;
      case 'youtube_link_analyzer':
        if (tools.youtube_link_analyzer?.analysisResults?.length > 0) {
          collectedToolResults.youtubeLinkAnalysisResults = tools.youtube_link_analyzer.analysisResults;
        }
        break;
    }
  });
  
  return collectedToolResults;
}

async function generateFollowUpQuestions(
  userQuery: string,
  aiResponse: string,
  responseType: 'text' | 'file' = 'text'
): Promise<string[]> {
  try {
    const contextInfo = responseType === 'file' ? 
      'The AI has generated files/documents for the user.' : 
      'The AI has provided a text response to the user.';
    
    const followUpResult = await generateObject({
      model: providers.languageModel('gemini-2.0-flash'),
      prompt: `You are generating follow-up questions that a USER would naturally ask or input to an AI assistant. These should be direct requests, commands, or questions that users would actually type, NOT questions the AI would ask the user.

**CRITICAL INSTRUCTION: Generate user inputs TO the AI, not AI questions TO the user**

User's original query: "${userQuery}"
AI's response: "${aiResponse}"
Context: ${contextInfo}

**WRONG EXAMPLES (AI asking user - DO NOT generate these):**
❌ "What details would you like me to emphasize in this image?"
❌ "Which style would you prefer?"
❌ "Do you want me to modify anything?"
❌ "Would you like me to create variations?"

**CORRECT EXAMPLES (User asking/requesting from AI - Generate these types):**
✅ "Create a similar image with a dog instead"
✅ "Generate a complete code file for this project"
✅ "Search for the latest news about this topic"
✅ "How does this algorithm work?"
✅ "What are the pros and cons of this approach?"
✅ "Make this image in a different style"
✅ "Find research papers about this subject"
✅ "Create a detailed documentation file"
✅ "Search YouTube for tutorials on this"

**Generate 3 different types of user inputs:**
1. **Action Request**: User asks AI to create, generate, search, or make something
2. **Information Question**: User asks AI to explain, analyze, or provide information
3. **Follow-up Inquiry**: User asks about alternatives, improvements, or related topics

**IMPORTANT RULES:**
- Write as natural user inputs TO the AI (commands, requests, or questions)
- Can be imperative ("Create...") or interrogative ("How does...?", "What is...?")
- Respond in the same language as the user's original query
- Make them natural and actionable - things users would actually type
- Each input should be distinctly different in purpose`,
      schema: z.object({
        followup_questions: z.array(z.string()).length(3)
      })
    });
    
    return followUpResult.object.followup_questions;
  } catch (e) { 
    return [];
  }
}

// Helper function to generate tool execution plan
async function generateToolExecutionPlan(
  userQuery: string,
  selectedTools: string[],
  contextMessages: any[],
  toolDescriptions: Record<string, string>
): Promise<{
  plan: string;
  refinedUserInput: string;
  essentialContext: string;
}> {
  try {
    // 🆕 토큰 제한 적용 (Gemini 2.0 Flash의 컨텍스트 윈도우 고려)
    const maxContextTokens = 1000000; // Gemini 2.0 Flash의 안전한 토큰 제한
    
    // 첨부파일 감지
    const hasAttachments = contextMessages.some(msg => {
      if (Array.isArray(msg.content)) {
        return msg.content.some((part: any) => part.type === 'image' || part.type === 'file');
      }
      return Array.isArray(msg.experimental_attachments) && msg.experimental_attachments.length > 0;
    });
    
    // 시스템 프롬프트 (첨부파일 유무에 따라 다르게)
    const currentDate = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      weekday: 'long'
    });
    
    const systemPrompt = `You are an AI assistant analyzing a user's request to create a detailed execution plan for using tools.

**Current Date:** ${currentDate}
**User's Request:** ${userQuery}
**Selected Tools:** ${selectedTools.join(', ')}
**Available Tools:** ${Object.entries(toolDescriptions).map(([key, desc]) => `${key}: ${desc}`).join('\n')}

${hasAttachments ? `**CRITICAL: ATTACHMENTS DETECTED**
The conversation contains attached files (PDFs, images, documents). You MUST:
1. **Extract ALL specific details** from attached files that are relevant to the user's request
2. **List every specific entity** (companies, people, places, dates, numbers, etc.) mentioned in attachments
3. **Include ALL relevant context** from attachments in your plan
4. **Be extremely detailed** about what information to search for based on attachment content
5. **Mention specific search terms** and entities that should be researched
6. **Consider temporal relevance** - if attachments contain dates, check if information is current as of ${currentDate}

**Example for company-related requests:**
- If user asks "check if mentioned companies are listed" and PDF contains companies A, B, C
- Your plan MUST list: "Search for: Company A, Company B, Company C"
- Include any additional details from PDF about these companies

**Example for data analysis requests:**
- If user asks "analyze this data" and PDF contains specific data points
- Your plan MUST include: "Search for: [specific data points], [relevant metrics], [related trends]"

**ATTACHMENT ANALYSIS REQUIREMENTS:**
- Extract ALL company names, product names, dates, locations, numbers, statistics
- Include ALL relevant keywords and search terms
- Be comprehensive - don't miss any important details
- If attachment contains lists, include ALL items in the list
- If attachment contains tables, extract ALL relevant data points
- **Temporal Analysis**: If attachments contain dates, determine if information needs current verification as of ${currentDate}` : ''}

**Your Task:**
1. **Analyze User Intent**: Understand what the user really wants
2. **Refine User Input**: If the user's input is vague or incomplete, create a more specific version
3. **Create Execution Plan**: Detail how to use each selected tool effectively${hasAttachments ? ', including ALL specific details from attachments' : ''}
4. **Extract Essential Context**: Identify only the most relevant context from conversation history${hasAttachments ? ', with comprehensive details from attached files' : ''}

**Requirements:**
- Respond in the user's language
- Be specific about tool usage order and purpose
- Focus on what will help the user most
- Extract only context that directly relates to the current request
- **Consider temporal relevance** - if the request involves time-sensitive information, prioritize current data as of ${currentDate}${hasAttachments ? `
- **MANDATORY**: Include ALL specific entities, numbers, dates, and details from attachments
- **MANDATORY**: List every search term and entity that should be researched
- **MANDATORY**: Be exhaustive - don't skip any relevant details from attachments
- **MANDATORY**: For any dates in attachments, determine if current verification is needed as of ${currentDate}` : ''}

**Output Format:**
- Plan: Step-by-step tool execution strategy${hasAttachments ? ' with ALL specific details from attachments' : ''}
- Refined User Input: Clear, specific version of user's request
- Essential Context: Only the most relevant parts of conversation history${hasAttachments ? ', including comprehensive attachment details' : ''}`;

    const systemTokens = estimateTokenCount(systemPrompt);
    const remainingTokens = maxContextTokens - systemTokens;
    
    // 🆕 토큰 제한 내에서 메시지 선택
    const optimizedContextMessages = selectMessagesWithinTokenLimit(
      contextMessages,
      remainingTokens,
    );
    
    // 🆕 메시지 변환
    const convertedMessages = convertMultiModalToMessage(optimizedContextMessages);
    
    const planResult = await generateObject({
      model: providers.languageModel('gemini-2.0-flash'),
      system: systemPrompt,
      messages: convertedMessages,
      schema: z.object({
        plan: z.string().describe('Detailed step-by-step plan for tool execution'),
        refinedUserInput: z.string().describe('Clear, specific version of user\'s request'),
        essentialContext: z.string().describe('Only the most relevant context from conversation history')
      })
    });
    
    return planResult.object;
  } catch (error) {
    console.error('Failed to generate tool execution plan:', error);
    return {
      plan: 'Execute tools in order to fulfill user request',
      refinedUserInput: userQuery,
      essentialContext: 'No specific context available'
    };
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
          model = 'gemini-2.5-pro';
        }
      }

    // 구독 상태 확인
    const isSubscribed = await checkSubscription(user.id);
    
    // 모델이 바뀐 후 최종 모델 설정으로 maxContextTokens 재계산
    const finalModelConfig = getModelById(model);
    const maxContextTokens = isSubscribed 
      ? (finalModelConfig?.contextWindow || 120000)
      : CONTEXT_WINDOW_LIMIT_NON_SUBSCRIBER;
    
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
  
    // 🆕 Handle rate limiting based on model type
    const originalModel = requestData.originalModel;
    const isChatflixModel = originalModel === 'chatflix-ultimate' || originalModel === 'chatflix-ultimate-pro';
    
    // rate limit 체크
    if (isChatflixModel) {
      // Chatflix 모델은 자체 rate limit만 체크 (선택된 개별 모델 rate limit 무시)
      const chatflixRateLimitResult = await handleChatflixRateLimiting(user.id, originalModel, isSubscribed);
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
      // 일반 모델은 기존 로직 사용
      const rateLimitResult = await handleRateLimiting(user.id, model, isSubscribed);
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

    return createDataStreamResponse({
      execute: async (dataStream) => {

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
          const processMessagesPromises = messages.map(async (msg: Message) => {
            const converted = await convertMessageForAI(msg, model, supabase);
            return {
              id: msg.id,
              ...converted
            } as MultiModalMessage;
          });
          
          // 🔧 HIGH PRIORITY OPTIMIZATION: 병렬 처리 확대
          // Wait for message processing and memory initialization in parallel
          const [
            processMessages
          ] = await Promise.all([
            Promise.all(processMessagesPromises),
            memoryInitPromise
          ]);
          
          // Process last message shortcut if needed
          const lastMessage = processMessages[processMessages.length - 1];
          const processedLastMessage = await handlePromptShortcuts(supabase, lastMessage, user.id) as MultiModalMessage;
          
          // Update the last message with processed shortcuts
          processMessages[processMessages.length - 1] = processedLastMessage;

          // Get memory data in parallel with other operations
          const memoryDataPromise = getAllMemoryBank(supabase, user.id);
          
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

          const abortController = new AbortController();

          const modelConfig = getModelById(model);
          const supportsReasoning = modelConfig?.reasoning?.enabled || false;
          // Get max output tokens for this model (if defined)
          // const maxOutputTokens = modelConfig?.maxOutputTokens;

          const providerOptions: any = {};

          // setting provider options
          if (supportsReasoning) {

            providerOptions.groq = {
              reasoningEffort: 'high',
              parallelToolCalls: true,
            };
            
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
          
          // Get memory data result
          const { data: memoryData } = await memoryDataPromise;
          
          // 메모리 뱅크 내용이 초기화 값인지 확인
          const isDefaultMemory = memoryData && 
            memoryData.includes('This section contains basic information about the user') &&
            memoryData.includes('This section tracks user preferences such as UI style');
                    
          // 3. 향상된 시스템 프롬프트 (사용자 프로필 컨텍스트 추가)
          const currentSystemPrompt = buildSystemPrompt(
            isAgentEnabled ? 'agent' : 'regular',
            'TEXT_RESPONSE',
            // 초기 템플릿인 경우에는 사용자 프로필 컨텍스트를 추가하지 않음
            isDefaultMemory ? undefined : (memoryData || undefined)
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
            let contextFilter: any | null = null;
            
            // Re-calculate system tokens specifically for agent mode for accuracy
            const agentSystemPromptForCalc = buildSystemPrompt(
              'agent',
              'FILE_RESPONSE', // Use the potentially longest prompt for a safe calculation
              isDefaultMemory ? undefined : (memoryData || undefined)
            );
            const agentSystemTokens = estimateTokenCount(agentSystemPromptForCalc);
            remainingTokens = maxContextTokens - agentSystemTokens;

            const optimizedMessagesForRouting = selectMessagesWithinTokenLimit(
              messagesWithTokens, 
              remainingTokens,
            );

            // 🔧 HIGH PRIORITY OPTIMIZATION: 메시지 변환 중복 제거

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
            const currentMessage = optimizedMessagesForRouting[optimizedMessagesForRouting.length - 1];
            userQuery = extractTextFromMessage(currentMessage);

            // 🆕 STEP 0: Parallel Analysis - Context Relevance & Request Routing
            const hasToolResultsInHistory = messagesWithTokens.slice(0, -1).some(msg => 
              (msg as any).tool_results && 
              Object.keys((msg as any).tool_results).some(key => key !== 'token_usage')
            );

            const hasPreviousConversation = messagesWithTokens.length > 1;
            const shouldAnalyzeContext = hasPreviousConversation && hasToolResultsInHistory


            // Define available tools list early for analysis
            let baseAvailableToolsList = [
              'web_search',
              'calculator',
              'link_reader',
              'image_generator',
              'academic_search',
              'youtube_search',
              'youtube_link_analyzer'
            ];

            const analysisModel = 'gemini-2.0-flash';

            // 도구 설명 객체 정의 (분석에서 사용)
            const toolDescriptions = {
              'web_search': 'Real-time information from the internet',
              'calculator': 'Mathematical calculations and computations',
              'link_reader': 'Reading and analyzing web page content',
              'image_generator': 'Creating visual content',
              'academic_search': 'Finding scholarly and research materials',
              'youtube_search': 'Finding relevant video content',
              'youtube_link_analyzer': 'Analyzing specific YouTube videos'
            };

            // 🚀 V6 Plan: New unified analysis and routing
            const [
              routeAnalysisResult,
              contextAnalysisResult
            ] = await Promise.all([
              analyzeRequestAndDetermineRoute(
                analysisModel,
                model,
                baseAvailableToolsList,
                convertMultiModalToMessage(messagesWithTokens, undefined), // Use all messages for routing analysis
                toolDescriptions
              ),
              shouldAnalyzeContext
                ? analyzeContextRelevance(analysisModel, convertMultiModalToMessage(messagesWithTokens, undefined))
                : Promise.resolve(null),
            ]);
            
            // Process context analysis results
            if (contextAnalysisResult) {
              try {
                contextFilter = contextAnalysisResult.object;
              } catch (error) {
                contextFilter = null;
              }
            }
            
            // V7 Optimization: Convert messages ONCE with the final context filter.
            const finalMessagesForAI = convertMultiModalToMessage(messagesWithTokens, contextFilter);
            
            // Recalculate token budget with the now-finalized message list.
            const messagesWithTokensFinal = finalMessagesForAI.map(msg => ({
              ...msg,
              _tokenCount: estimateMultiModalTokens(msg as any)
            }));
            
            const routingDecision = routeAnalysisResult.object;

            const hasImage = messagesWithTokens.some(msg => detectImages(msg));
            const hasFile = messagesWithTokens.some(msg => detectPDFs(msg) || detectCodeAttachments(msg));
            
            switch (routingDecision.route) {
              case 'CLARIFY':
                // Route to ask the user a clarifying question.
                const clarificationResult = streamText({
                  model: providers.languageModel('gemini-2.0-flash'),
                  experimental_transform: [
                    smoothStream({delayInMs: 25}),
                    markdownJoinerTransform(),
                  ],
                  system: `You are Chatflix, a friendly and helpful AI assistant. The user's request needs more information. Your task is to ask the user the clarifying question provided below in a natural, conversational way.

**Core Instruction: ALWAYS respond in the user's language.**

**Instructions:**
- Start with a brief, friendly acknowledgment.
- Then, ask the clarifying question naturally.
- Be conversational and helpful.

**Style Examples (adapt to user's language):**
The following are English examples of the TONE. Do NOT use them literally if the user is not speaking English.
- "I can help with that! First, could you tell me [question]?"
- "Happy to help! I just need a bit more info - [question]"
- "Sure thing! Quick question for you - [question]"

**Bad Examples (wrong tone):**
- Asking the question without any lead-in.
- Being too formal or robotic.

Now, ask the following question in a conversational manner in the user's language: "${routingDecision.question}"`,
                  prompt: `Ask this question naturally: ${routingDecision.question}`,
                  onFinish: async (completion) => {
                    if (abortController.signal.aborted) return;
                    await handleStreamCompletion(
                      supabase,
                      assistantMessageId,
                      user!.id,
                      'gemini-2.0-flash',
                      getProviderFromModel('gemini-2.0-flash'),
                      completion,
                      isRegeneration,
                      { original_model: requestData.originalModel || model, token_usage: completion.usage }
                    );
                  }
                });
                clarificationResult.mergeIntoDataStream(dataStream);
                break;

              case 'TEXT_RESPONSE': {
                // Route A: Generate a complete text-based response, using tools conversationally.
                const tools: Record<string, any> = {};
                routingDecision.tools.forEach((toolName: string) => {
                  tools[toolName] = initializeTool(toolName, dataStream);
                });



                // 🆕 STEP 1: Tool Execution Planning (only when tools are selected)
                let executionPlan: any = null;
                let refinedUserInput = userQuery;
                let essentialContext = '';
                
                const needsTools = routingDecision.tools.length > 0;
                
                if (needsTools) {

                  console.log('--------------------------------');
                  console.log('tools', tools);
                  console.log('--------------------------------');
                  
                  // 계획 수립 (전체 메시지 컨텍스트 사용)
                  const planResult = await generateToolExecutionPlan(
                    userQuery,
                    routingDecision.tools,
                    messagesWithTokensFinal,
                    toolDescriptions
                  );
                  
                  executionPlan = planResult.plan;
                  refinedUserInput = planResult.refinedUserInput;
                  essentialContext = planResult.essentialContext;

                  console.log('--------------------------------');
                  console.log('executionPlan', executionPlan);
                  console.log('refinedUserInput', refinedUserInput);
                  console.log('essentialContext', essentialContext);
                  console.log('--------------------------------');

                }

                // TEXT_RESPONSE: 도구 실행 모델 결정
                let toolExecutionModel = model;
                
                // 도구가 있는 경우에만 Gemini 모델을 다른 모델로 변경
                if (needsTools) {
                  if (model === 'gemini-2.5-pro') {
                    toolExecutionModel = 'claude-sonnet-4-20250514';
                  } else if (model === 'gemini-2.5-flash') {
                    toolExecutionModel = 'claude-sonnet-4-20250514';
                  } else if (model === 'gemini-2.0-flash') {
                    toolExecutionModel = 'claude-sonnet-4-20250514';
                  }
                }
                
                if (toolExecutionModel !== model) {
                  console.log(`[모델 변경] 도구 실행: ${model} → ${toolExecutionModel}`);
                }
                
                // if (toolExecutionModel === 'moonshotai/kimi-k2-instruct') {
                //   console.log(`[모델 변경] 도구 실행: moonshotai/kimi-k2-instruct → moonshotai/Kimi-K2-Instruct`);
                //   toolExecutionModel = 'moonshotai/Kimi-K2-Instruct';
                // }

                // 모델이 바뀐 경우 maxContextTokens 재계산
                const toolExecutionModelConfig = getModelById(toolExecutionModel);
                const toolExecutionMaxContextTokens = isSubscribed 
                  ? (toolExecutionModelConfig?.contextWindow || 120000)
                  : CONTEXT_WINDOW_LIMIT_NON_SUBSCRIBER;

                // 🆕 STEP 2: Prepare optimized messages for final execution
                let finalMessagesForExecution: any[];
                let systemPrompt: string;
                
                if (needsTools && executionPlan) {
                  // 도구가 선택된 경우: 계획 + 사용자 최종 메시지만 전달
                  const personalInfo = await getUserPersonalInfo(supabase, user.id);
                  systemPrompt = buildSystemPrompt(
                    'agent', 
                    'TEXT_RESPONSE', 
                    personalInfo || undefined,
                    {
                      selectedTools: routingDecision.tools,
                      executionPlan: executionPlan,
                      refinedUserInput: refinedUserInput,
                      essentialContext: essentialContext
                    }
                  );

                  console.log('--------------------------------');
                  console.log('systemPrompt', systemPrompt);
                  console.log('--------------------------------');

                  const preciseSystemTokens = estimateTokenCount(systemPrompt);
                  const preciseRemainingTokens = toolExecutionMaxContextTokens - preciseSystemTokens;
                  
                  // 사용자의 최종 메시지만 선택 (계획과 함께 전달)
                  const lastMessage = messagesWithTokensFinal[messagesWithTokensFinal.length - 1];
                  const lastMessageTokens = estimateMultiModalTokens(lastMessage as any);
                  
                  if (lastMessageTokens <= preciseRemainingTokens) {
                    finalMessagesForExecution = [convertMultiModalToMessage([lastMessage])[0]];
                  } else {
                    // 토큰 제한이 있는 경우 메시지 축약
                    const optimizedMessages = selectMessagesWithinTokenLimit(
                      [lastMessage],
                      preciseRemainingTokens,
                    );
                    finalMessagesForExecution = convertMultiModalToMessage(optimizedMessages);
                  }
                  

                } else {
                  // 도구가 없는 경우: 기존 방식 사용
                  // const personalInfo = await getUserPersonalInfo(supabase, user.id);
                  systemPrompt = buildSystemPrompt(
                    'agent', 
                    'TEXT_RESPONSE', 
                    memoryData || undefined,
                    {
                      selectedTools: routingDecision.tools
                    }
                  );

                  const preciseSystemTokens = estimateTokenCount(systemPrompt);
                  const preciseRemainingTokens = toolExecutionMaxContextTokens - preciseSystemTokens;
                  const prefinalMessages = selectMessagesWithinTokenLimit(
                    messagesWithTokensFinal,
                    preciseRemainingTokens,
                  );

                  finalMessagesForExecution = convertMultiModalToMessage(prefinalMessages);
                }

                // console.log('--------------------------------');
                // console.log('finalMessagesForExecution', finalMessagesForExecution);
                // console.log('--------------------------------');

                const textResponsePromise = streamText({
                  model: providers.languageModel(toolExecutionModel),
                  experimental_transform: [
                    smoothStream({delayInMs: 25}),
                    markdownJoinerTransform(),
                  ],
                  system: systemPrompt,
                  messages: finalMessagesForExecution,
                  tools,
                  maxSteps: 20,
                  maxRetries:3,
                  providerOptions,
                  onFinish: async (completion) => {
                    if (abortController.signal.aborted) return;
                    
                    // 🔧 FIX: 도구별 결과 수집 (통합 함수 사용)
                    const collectedToolResults = collectToolResults(tools, routingDecision.tools);
                    
                    // 2. Increment request count
                    await incrementSuccessfulRequestCount(supabase, user!.id, today, currentRequestCount, isSubscribed);

                    // 3. Generate and stream follow-up questions (개선된 전략 적용)
                    const followUpQuestions = await generateFollowUpQuestions(userQuery, completion.text, 'text');
                    
                    const structuredResponse = {
                      response: { 
                        followup_questions: followUpQuestions 
                      }
                    };
                    collectedToolResults.structuredResponse = structuredResponse;
                    
                    // Send as structured_response to match client expectations
                    dataStream.writeMessageAnnotation({
                      type: 'structured_response',
                      data: structuredResponse
                    });
                    
                    // 1. Save main completion to DB (이제 followup question 포함)
                    await handleStreamCompletion(
                      supabase,
                      assistantMessageId,
                      user!.id,
                      model,
                      getProviderFromModel(model),
                      completion,
                      isRegeneration,
                      {
                        original_model: requestData.originalModel || model,
                        token_usage: completion.usage,
                        tool_results: collectedToolResults
                      }
                    );

                    // 4. 🆕 Smart Memory Update - AI 분석 기반 지능적 업데이트
                    setTimeout(async () => {
                      try {
                        await smartUpdateMemoryBanks(
                          supabase, 
                          user!.id, 
                          chatId, 
                          finalMessagesForExecution, 
                          userQuery, 
                          completion.text
                        );
                      } catch (error) {
                        console.error('Smart memory update failed:', error);
                      }
                    }, 1000);
                  }
                });

                textResponsePromise.mergeIntoDataStream(dataStream, { sendReasoning: true });
                      break;
                  }
                  
              case 'FILE_RESPONSE': {
                // Route B: A two-step process to reliably generate files.
                const tools: Record<string, any> = {};
                routingDecision.tools.forEach((toolName: string) => {
                  tools[toolName] = initializeTool(toolName, dataStream);
                });

                // Check if tools are needed
                const needsTools = routingDecision.tools.length > 0;

                // 🆕 STEP 1: 도구가 선택된 경우 계획 생성 단계 추가
                let executionPlan: string | undefined;
                let refinedUserInput: string | undefined;
                let essentialContext: string | undefined;

                if (needsTools) {
                  try {
                    const planResult = await generateToolExecutionPlan(
                      userQuery,
                      routingDecision.tools,
                      messagesWithTokensFinal,
                      toolDescriptions
                    );

                    executionPlan = planResult.plan;
                    refinedUserInput = planResult.refinedUserInput;
                    essentialContext = planResult.essentialContext;
                  } catch (error) {
                    console.error('Tool execution plan generation failed:', error);
                  }
                }

                // Check if using DeepSeek or Claude Sonnet models (these may take longer for file generation)
                const isSlowerModel = model.toLowerCase().includes('deepseek') || 
                                     (model.includes('claude') && model.includes('sonnet'));
                
                const personalInfo = await getUserPersonalInfo(supabase, user.id);
                const systemPromptForFileStep1 = buildSystemPrompt(
                  'agent',
                  'FILE_STEP1',
                  personalInfo || undefined,
                  {
                    needsTools,
                    isSlowerModel,
                    model,
                    selectedTools: 'tools' in routingDecision ? routingDecision.tools : [],
                    executionPlan,
                    refinedUserInput,
                    essentialContext
                  }
                );

                // FILE_RESPONSE (도구 실행 단계) - 모델 결정을 먼저 수행
                let toolExecutionModel = model;
                
                // 도구가 있는 경우에만 Gemini 모델을 다른 모델로 변경
                if (needsTools) {
                  if (model === 'gemini-2.5-pro') {
                    toolExecutionModel = 'claude-sonnet-4-20250514';
                  } else if (model === 'gemini-2.5-flash') {
                    toolExecutionModel = 'claude-sonnet-4-20250514';
                  } else if (model === 'gemini-2.0-flash') {
                    toolExecutionModel = 'claude-sonnet-4-20250514';
                  }
                }
                
                if (toolExecutionModel !== model) {
                    console.log(`[모델 변경] 파일 도구 실행: ${model} → ${toolExecutionModel}`);
                  }

                // if (toolExecutionModel === 'moonshotai/kimi-k2-instruct') {
                //   console.log(`[모델 변경] 파일 도구 실행: moonshotai/kimi-k2-instruct → moonshotai/Kimi-K2-Instruct`);
                //   toolExecutionModel = 'moonshotai/Kimi-K2-Instruct';
                // }

                // 🆕 STEP 2: 최종 실행을 위한 메시지 최적화
                let finalMessagesForExecution: any[];
                let systemPromptForExecution: string;

                if (needsTools && executionPlan && refinedUserInput && essentialContext) {
                  // 계획이 있는 경우: 마지막 메시지만 사용
                  finalMessagesForExecution = [lastMessage];
                  systemPromptForExecution = buildSystemPrompt(
                    'agent',
                    'FILE_STEP1',
                    personalInfo || undefined,
                    {
                      needsTools,
                      isSlowerModel,
                      model,
                      selectedTools: routingDecision.tools,
                      executionPlan,
                      refinedUserInput,
                      essentialContext
                    }
                  );
                } else {
                  // 전통 방식: 토큰 제한 내에서 메시지 선택
                  const fileToolExecutionModelConfig = getModelById(toolExecutionModel);
                  const fileToolExecutionMaxContextTokens = isSubscribed 
                    ? (fileToolExecutionModelConfig?.contextWindow || 120000)
                    : CONTEXT_WINDOW_LIMIT_NON_SUBSCRIBER;

                  const preciseSystemTokensFile = estimateTokenCount(systemPromptForFileStep1);
                  const preciseRemainingTokensFile = fileToolExecutionMaxContextTokens - preciseSystemTokensFile;
                  finalMessagesForExecution = selectMessagesWithinTokenLimit(
                    messagesWithTokensFinal,
                    preciseRemainingTokensFile,
                  );
                  systemPromptForExecution = systemPromptForFileStep1;
                }

                const finalMessagesConverted = convertMultiModalToMessage(finalMessagesForExecution);


                if (needsTools) {
                  // Step 1: Execute tools and interact with the user (only if tools are needed)

                  const toolExecutionPromise = streamText({
                    model: providers.languageModel(toolExecutionModel),
                      experimental_transform: [
                        smoothStream({delayInMs: 25}),
                        markdownJoinerTransform(),
                      ],
                      system: systemPromptForExecution,
                      messages: finalMessagesConverted,
                      tools,
                      maxSteps: 20, 
                      maxRetries:3,
                      providerOptions,
                      onFinish: async (toolExecutionCompletion) => {
                        if (abortController.signal.aborted) return;
                        
                        // 🔧 FIX: 도구별 결과 수집 (FILE_RESPONSE - 도구 사용 케이스, 통합 함수 사용)
                        const collectedToolResults = collectToolResults(tools, routingDecision.tools);
                        
                        await generateFileWithToolResults(collectedToolResults, toolExecutionCompletion, finalMessagesConverted);
                      }
                    });
                    
                    toolExecutionPromise.mergeIntoDataStream(dataStream, { sendReasoning: true });
                } else {
                  // No tools needed - but still provide a brief explanation before file generation
                  const briefExplanationPromise = streamText({
                    model: providers.languageModel('gemini-2.0-flash'),
                    experimental_transform: [
                      smoothStream({delayInMs: 25}),
                      markdownJoinerTransform(),
                    ],
                    // providerOptions,
                    temperature: 0.0,
                    maxTokens: 3000,
                    system: systemPromptForExecution, // Use the optimized system prompt
                    messages: finalMessagesConverted,
                    onFinish: async (briefCompletion) => {
                      if (abortController.signal.aborted) return;
                      // Call file generation after brief explanation is complete
                      // briefCompletion을 전달하여 최종 저장 시 포함시킴
                      await generateFileWithToolResults(null, briefCompletion, finalMessagesConverted);
                    }
                  });
                  
                  briefExplanationPromise.mergeIntoDataStream(dataStream, { sendReasoning: true });
                }

                // Helper function to generate files (extracted to avoid code duplication)
                async function generateFileWithToolResults(toolResults: any, stepCompletion: any, messagesForGeneration: any[]) {
                  // Setup progress tracking
                  const startTime = Date.now();
                  let progressCount = 0;
                  let progressInterval: NodeJS.Timeout | null = null;
                  let isFileGenerationComplete = false;
                  let accumulatedContent = ''; // 누적된 컨텐츠 저장
                  let sentProgressMessages: string[] = []; // 전송된 진행 메시지들 추적
                                
                  // FILE_RESPONSE (파일 생성 단계)
                  let fileGenerationModel = model;
                  if (model === 'moonshotai/kimi-k2-instruct') {
                    fileGenerationModel = 'gpt-4.1';
                  }

                  // Helper function to generate intermediate progress messages
                  async function generateProgressMessage(progressCount: number, userQuery: string, estimatedTimeElapsed: number, memoryData?: string) {
                    try {
                      // 진행 메시지 생성 중단 체크
                      if (isFileGenerationComplete) return null;
                      
                      const progressResult = streamText({
                        model: providers.languageModel('gemini-2.0-flash'),
                        experimental_transform: [
                          smoothStream({delayInMs: 25}),
                          markdownJoinerTransform(),
                        ],
                        system: `You are Chatflix, an AI assistant generating a file for the user. This can take some time, so you need to send a brief, natural-sounding waiting message.

**Core Instruction: ALWAYS respond in the user's language.** Your message should sound like a real person sending a quick text.

**User's Request:** ${userQuery}
**Time Elapsed:** About ${estimatedTimeElapsed} seconds.

**Your Task:**
- Send a short, reassuring message (1 sentence).
- Acknowledge that file generation can take time.
- Vary your message each time.

**Message Type Examples (adapt to user's language):**
Rotate between these types of messages. Do NOT use the English text literally if the user speaks another language.
- **Time Expectation:** "Just a heads-up, this file is taking a moment to generate..."
- **Patience Request:** "Thanks for your patience, still working on this file for you."
- **Process Explanation:** "Still getting everything ready for your file..."
- **Reassurance:** "Still here and working on it! Complex files can sometimes take a bit longer."

**Previously Sent Messages:** ${sentProgressMessages.join(', ')}

${memoryData ? `**User Profile Context:**
${memoryData}

**CRITICAL: Respond in the user's preferred language from their profile. If none, use the language of their query.**` : '**IMPORTANT: Always respond in the language of the user\'s query.**'}

Generate a new, different waiting message.`,
                        prompt: `Brief waiting message #${progressCount}`,
                        temperature: 0.8,
                        maxTokens: 50,
                        onFinish: async (completion) => {
                          // 이중 체크: 완료 처리 중에도 중단 상태 확인
                          if (isFileGenerationComplete) return;
                          
                          // 전송된 메시지 추적에 추가
                          sentProgressMessages.push(completion.text);
                          
                          // 진행 메시지를 누적 컨텐츠에 구분자와 함께 추가
                          const separator = accumulatedContent ? '\n\n---\n\n' : '';
                          accumulatedContent += separator + completion.text;
                          
                          // 기존 assistant 메시지를 업데이트 (별도 메시지로 저장하지 않음)
                          await supabase
                            .from('messages')
                            .update({
                              content: accumulatedContent,
                              model: 'gemini-2.0-flash',
                              host: getProviderFromModel('gemini-2.0-flash'),
                              created_at: new Date().toISOString()
                            })
                            .eq('id', assistantMessageId)
                            .eq('user_id', user!.id);
                        }
                      });

                      // 스트림을 클라이언트로 전송
                      progressResult.mergeIntoDataStream(dataStream);
                      
                      return progressResult;
                    } catch (error) {
                      return null;
                    }
                  }

                  // Start progress message timer
                  const startProgressUpdates = () => {
                    const sendProgressMessage = async () => {
                      // 진행 메시지 생성 자체를 중단
                      if (isFileGenerationComplete) return;
                      
                      progressCount++;
                      const elapsedTime = Math.floor((Date.now() - startTime) / 1000);
                      
                      // 다시 한 번 체크 (비동기 함수이므로)
                      if (isFileGenerationComplete) return;
                      
                      const progressResult = await generateProgressMessage(progressCount, userQuery, elapsedTime, memoryData || undefined);
                    };

                    // Send first progress message after 15 seconds
                    setTimeout(sendProgressMessage, 15000);
                    
                    // Then send progress messages every 90-120 seconds (randomized)
                    const scheduleNextProgressMessage = () => {
                      if (isFileGenerationComplete) return;
                      
                      const randomInterval = 90000 + Math.random() * 30000; // 90-120 seconds
                      progressInterval = setTimeout(async () => {
                        await sendProgressMessage();
                        scheduleNextProgressMessage();
                      }, randomInterval);
                    };
                    
                    scheduleNextProgressMessage();
                  };

                  // Start the progress tracking
                  startProgressUpdates();
                  
                  // Handle abort scenarios
                  if (abortController.signal.aborted) {
                    isFileGenerationComplete = true;
                    if (progressInterval) {
                      clearTimeout(progressInterval);
                      progressInterval = null;
                    }
                    return;
                  }
                  
                  // Step 2: Generate the file using the collected results
                  const fileGenerationSystemPrompt = buildSystemPrompt(
                    'agent', 
                    'FILE_RESPONSE', 
                    memoryData || undefined,
                    {
                      toolResults,
                      hasImage,
                      hasFile,
                      selectedTools: 'tools' in routingDecision ? routingDecision.tools : [] // 선택된 도구 정보 전달
                    }
                  );

                  const fileGenerationResult = await streamObject({
                    model: providers.languageModel(fileGenerationModel),
                    system: fileGenerationSystemPrompt,
                    messages: messagesForGeneration,
                    schema: z.object({
                      response: z.object({
                        description: z.string().describe('A casual, friendly sentence to present the files to the user in their language. Sound like a friend handing over completed work. Examples: "All set! Here are your files." or "Perfect! Got everything ready for you." or "Here you go - all done!" Keep it relaxed and casual.'),
                        files: z.array(z.object({
                            name: z.string().describe('Name of the file with appropriate extension.'),
                            content: z.string().describe('COMPREHENSIVE content of the file with ALL details, explanations, and information. This should contain the actual answer to the user\'s request. Format appropriately for the file type. **CRITICAL**: For code files, ALWAYS start with proper code block syntax (```language). Never generate bare code without markdown code blocks!'),
                          })
                        ).describe("Array of files containing ALL the detailed content and answers."),
                      })
                    })
                  });

                  // Stream partial file object to the client for a responsive UI
                  (async () => {
                    let firstPartialReceived = false;
                    for await (const partial of fileGenerationResult.partialObjectStream) {
                      if (abortController.signal.aborted) break;
                      
                      // 첫 번째 스트림이 시작되면 진행 메시지 중단
                      if (!firstPartialReceived) {
                        firstPartialReceived = true;
                        isFileGenerationComplete = true;
                        if (progressInterval) {
                          clearTimeout(progressInterval);
                          progressInterval = null;
                        }
                      }
                      
                      dataStream.writeMessageAnnotation({ type: 'structured_response_progress', data: JSON.parse(JSON.stringify(partial)) });
                    }
                  })();
                  
                  const finalFileObjectFromStream = await fileGenerationResult.object;
                  const fileDescription = finalFileObjectFromStream.response.description || "Here are the files you requested.";

                  // Mark file generation as complete and cleanup progress tracking
                  isFileGenerationComplete = true;
                  if (progressInterval) {
                    clearTimeout(progressInterval);
                    progressInterval = null;
                  }

                  // Start with the base object and add follow-up questions to it.
                  const finalFileObject: any = finalFileObjectFromStream;

                  // Send final structured response and follow-up questions (개선된 전략 적용)
                  const followUpQuestions = await generateFollowUpQuestions(userQuery, fileDescription, 'file');
                  finalFileObject.response.followup_questions = followUpQuestions;
                  
                  dataStream.writeMessageAnnotation({
                    type: 'structured_response',
                    data: finalFileObject
                  });

                  // Manually construct a 'completion' object for saving
                  let finalCompletionForDB;
                  
                  if (stepCompletion) {
                    // Case: Tools were used OR brief explanation was provided
                    const [
                      stepUsage,
                      fileUsage,
                      finishReason
                    ] = await Promise.all([
                      stepCompletion.usage,
                      fileGenerationResult.usage,
                      stepCompletion.finishReason,
                    ]);

                    // 첫 번째 단계 텍스트를 누적 컨텐츠에 추가
                    if (stepCompletion.text) {
                      const separator = accumulatedContent ? '\n\n---\n\n' : '';
                      accumulatedContent += separator + stepCompletion.text;
                    }

                    // 🔧 FIX: 이전 단계(도구 실행 또는 간단 설명)의 텍스트만 포함
                    // fileDescription은 별도로 추가하지 않음 (이미 진행 메시지에 포함됨)
                    const combinedText = accumulatedContent || fileDescription;

                    finalCompletionForDB = {
                      text: combinedText,
                      usage: {
                        promptTokens: (stepUsage.promptTokens || 0) + (fileUsage.promptTokens || 0),
                        completionTokens: (stepUsage.completionTokens || 0) + (fileUsage.completionTokens || 0),
                        totalTokens: (stepUsage.totalTokens || 0) + (fileUsage.totalTokens || 0),
                      },
                      finishReason: finishReason
                    };
                  } else {
                    // Case: No tools were used but brief explanation was provided
                    if (stepCompletion && stepCompletion.text) {
                      const separator = accumulatedContent ? '\n\n---\n\n' : '';
                      accumulatedContent += separator + stepCompletion.text;
                    }
                    
                    const fileUsage = await fileGenerationResult.usage;
                    const finalText = accumulatedContent || fileDescription;
                    
                    finalCompletionForDB = {
                      text: finalText,
                      usage: fileUsage,
                      finishReason: 'stop'
                    };
                  }
                  
                  // 🔧 FIX: 도구 결과 올바르게 처리
                  let finalToolResults: any = {
                    structuredResponse: finalFileObject
                  };
                  
                  // toolResults가 이미 수집된 도구 결과라면 그것을 사용
                  if (toolResults && typeof toolResults === 'object' && !Array.isArray(toolResults)) {
                    // toolResults에 이미 사용자 정의 결과들이 포함되어 있다면 병합
                    finalToolResults = {
                      ...toolResults,
                      structuredResponse: finalFileObject
                    };
                  }

                  // 이미 finalCompletionForDB.text에 모든 누적 컨텐츠가 포함되어 있음

                  // Finalize the process (save to DB, increment count, update memory)
                  await handleStreamCompletion(
                    supabase,
                    assistantMessageId,
                    user!.id,
                    fileGenerationModel,
                    getProviderFromModel(fileGenerationModel),
                    finalCompletionForDB as any,
                    isRegeneration,
                    { 
                      original_model: requestData.originalModel || model,
                      token_usage: finalCompletionForDB.usage,
                      tool_results: finalToolResults
                    }
                  );

                  await incrementSuccessfulRequestCount(supabase, user!.id, today, currentRequestCount, isSubscribed);
                  
                  // 🆕 Smart Memory Update for file generation
                  setTimeout(async () => {
                    try {
                      await smartUpdateMemoryBanks(
                        supabase, 
                        user!.id, 
                        chatId, 
                        finalMessagesForExecution, 
                        userQuery, 
                        fileDescription
                      );
                    } catch (error) {
                      console.error('Smart memory update failed:', error);
                    }
                  }, 1000);
                }
                
                break;
              }
            }
            // =================================================================
            // END: NEW V6 LOGIC
            // =================================================================

          } else {
            // 일반 채팅 흐름 - 원래 코드 사용에 토큰 제한 최적화 추가
            //  이미 계산된 시스템 토큰 재사용

            const optimizedMessages = selectMessagesWithinTokenLimit(
              messagesWithTokens, 
              remainingTokens,
            );

            const messages = convertMultiModalToMessage(optimizedMessages);

            const result = streamText({
              model: providers.languageModel(model),
              experimental_transform: [
                smoothStream({delayInMs: 25}),
                markdownJoinerTransform(),
              ],
              system: currentSystemPrompt, // Use the 'regular' prompt calculated earlier
              messages: messages,
              // temperature: 0.7,
              // maxTokens: 20000,
              providerOptions: providerOptions,
              onFinish: async (completion) => {
                if (abortController.signal.aborted) return;

                // 🆕 실제 토큰 사용량 추출 및 로깅
                const actualTokenUsage = completion.usage;
                // if (actualTokenUsage) {
                //   console.log('🔢 [TOKEN USAGE] Regular mode actual tokens:', {
                //     promptTokens: actualTokenUsage.promptTokens,
                //     completionTokens: actualTokenUsage.completionTokens,
                //     totalTokens: actualTokenUsage.totalTokens,
                //     model: model,
                //     messageId: assistantMessageId
                //   });
                // }

                await handleStreamCompletion(
                  supabase,
                  assistantMessageId,
                  user!.id,
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
                    user!.id,
                    today,
                    currentRequestCount,
                    isSubscribed
                  );
                }

                // 🆕 Smart Memory Update for regular chat
                if (chatId && !abortController.signal.aborted) {
                  // AI의 응답과 사용자 메시지 준비
                  const userMessage = typeof processedLastMessage.content === 'string' 
                    ? processedLastMessage.content 
                    : JSON.stringify(processedLastMessage.content);
                  const aiMessage = completion.text;
                  
                  // 1초 딜레이로 Smart 업데이트 실행
                  setTimeout(async () => {
                    try {
                      await smartUpdateMemoryBanks(
                        supabase, 
                        user!.id, 
                        chatId, 
                        optimizedMessages, 
                        userMessage, 
                        aiMessage
                      );
                    } catch (error) {
                      console.error('Smart memory update failed:', error);
                    }
                  }, 1000);
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


