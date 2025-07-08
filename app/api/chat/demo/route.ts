import { streamText, createDataStreamResponse, streamObject, generateText, generateObject } from 'ai';
import { providers } from '@/lib/providers';
import { getModelById } from '@/lib/models/config';
import { MultiModalMessage } from '../types';
import { z } from 'zod';
import { 
  handlePromptShortcuts,
  buildSystemPrompt
} from '../services/chatService';
import { 
  generateMessageId, 
  convertMessageForAI, 
  getProviderFromModel,
  convertMultiModalToMessage,
  selectMessagesWithinTokenLimit,
  detectImages,
  detectPDFs,
  detectCodeAttachments
} from '../utils/messageUtils';
import { 
  createWebSearchTool, 
  createJinaLinkReaderTool, 
  createImageGeneratorTool, 
  createCalculatorTool, 
  createAcademicSearchTool, 
  createYouTubeSearchTool, 
  createYouTubeLinkAnalyzerTool, 
} from '../tools';
import { handleRateLimiting } from '../utils/ratelimit';
import { estimateTokenCount } from '@/utils/context-manager';
import { 
  analyzeRequestAndDetermineRoute,
  analyzeContextRelevance 
} from '../services/analysisService';
import { estimateMultiModalTokens } from '../services/modelSelector';

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
    case 'youtube_search':
      return createYouTubeSearchTool(dataStream);
    case 'youtube_link_analyzer':
      return createYouTubeLinkAnalyzerTool(dataStream);
    default:
      throw new Error(`Unknown tool type: ${type}`);
  }
}

export async function POST(req: Request) {
    const requestData = await req.json();
    let { messages, model, isAgentEnabled = false } = requestData;

    // 데모에서는 고정된 userId 사용
    const userId = 'guest-demo-user'; 

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'Invalid messages format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 데모용 Rate Limiting
    const rateLimitResult = await handleRateLimiting(userId, model); 
    // if (!rateLimitResult.success) {
    //   const { error } = rateLimitResult;
    //   return new Response(JSON.stringify({
    //     error: 'Too many requests',
    //     message: error?.message || 'Rate limit exceeded',
    //     retryAfter: error?.retryAfter,
    //     reset: error?.reset ? new Date(error.reset).toISOString() : undefined,
    //     limit: error?.limit,
    //     level: error?.level,
    //     model: model
    //   }), {
    //     status: 429,
    //     headers: {
    //       'Content-Type': 'application/json',
    //       ...(error?.limit && { 'X-RateLimit-Limit': error.limit.toString() }),
    //       'X-RateLimit-Remaining': '0',
    //       ...(error?.reset && { 'X-RateLimit-Reset': new Date(error.reset).toISOString() }),
    //     }
    //   });
    // }

    return createDataStreamResponse({
      execute: async (dataStream) => {
          const processMessagesPromises = messages.map(async (msg: any) => {
            // Demo API는 Supabase 클라이언트가 없으므로, 해당 의존성 제거
            const converted = await convertMessageForAI(msg, model, null);
            return {
              id: msg.id || generateMessageId(), // ID가 없을 경우 생성
              ...converted
            } as MultiModalMessage;
          });
          
          const processMessages = await Promise.all(processMessagesPromises);

          // 마지막 메시지에 대한 단축키 처리 (데모에서는 Supabase 의존성 제거)
          const lastMessage = processMessages[processMessages.length - 1];
          const processedLastMessage = await handlePromptShortcuts(null, lastMessage, userId) as MultiModalMessage; 
          
          processMessages[processMessages.length - 1] = processedLastMessage;

          const abortController = new AbortController();
          const modelConfig = getModelById(model);
          const supportsReasoning = modelConfig?.reasoning?.enabled || false;

          const providerOptions: any = {};
          if (supportsReasoning) {
            providerOptions.anthropic = { thinking: { type: 'enabled', budgetTokens: 12000 } };
            providerOptions.xai = { reasoningEffort: 'high' };
            providerOptions.openai = { reasoningEffort: 'high' };
            providerOptions.google = { 
              thinkingConfig: { thinkingBudget: 2048, includeThoughts: true }, 
              safetySettings: [
                { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
              ],
            };
          }
          
          // 데모에서는 메모리 데이터 없음
          const currentSystemPrompt = buildSystemPrompt(
            isAgentEnabled ? 'agent' : 'regular',
            'text',
            undefined // 데모에서는 메모리 데이터 없음
          );
          
            const systemTokens = estimateTokenCount(currentSystemPrompt);
            const maxContextTokens = modelConfig?.contextWindow || 8000;
          let remainingTokens = maxContextTokens - systemTokens;
          
          // 메시지별 토큰 미리 계산 및 캐싱
          const messagesWithTokens = processMessages.map(msg => {
            const tokenCount = estimateMultiModalTokens(msg as any);
            return {
              ...msg,
              _tokenCount: tokenCount
            };
          });
          
          if (isAgentEnabled) {
            // Agent mode - V6 routing system
            const agentSystemPromptForCalc = buildSystemPrompt(
              'agent',
              'file_generation',
              undefined // 데모에서는 메모리 데이터 없음
            );
            const agentSystemTokens = estimateTokenCount(agentSystemPromptForCalc);
            remainingTokens = maxContextTokens - agentSystemTokens;

            const optimizedMessagesForRouting = selectMessagesWithinTokenLimit(
              messagesWithTokens, 
              remainingTokens,
            );

            // 현재 질문 추출
            let userQuery = '';
            const extractTextFromMessage = (msg: any) => {
              if (typeof msg.content === 'string') {
                return msg.content;
              } else if (Array.isArray(msg.content)) {
                const textContent = msg.content
                  .filter((part: any) => part.type === 'text')
                  .map((part: any) => part.text)
                  .join('\n');
                
                const attachmentInfo: string[] = [];
                const images = msg.content.filter((part: any) => part.type === 'image');
                if (images.length > 0) attachmentInfo.push(`[ATTACHED: ${images.length} image(s)]`);
                const files = msg.content.filter((part: any) => part.type === 'file');
                files.forEach((file: any) => {
                  if (file.file) {
                    const fileName = file.file.name || '';
                    const fileType = file.file.contentType || '';
                    if (fileType.startsWith('image/') || fileName.match(/\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i)) attachmentInfo.push(`[ATTACHED: Image file - ${fileName}]`);
                    else if (fileType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')) attachmentInfo.push(`[ATTACHED: PDF document - ${fileName}]`);
                    else if (fileName.match(/\.(js|ts|jsx|tsx|py|java|c|cpp|cs|go|rb|php|html|css|sql|swift|kt|rs|dart|json|xml|yaml|yml)$/i)) {
                      const extension = fileName.split('.').pop();
                      attachmentInfo.push(`[ATTACHED: Code file (${extension}) - ${fileName}]`);
                    } else attachmentInfo.push(`[ATTACHED: File - ${fileName} (${fileType})]`);
                  }
                });
                
                if (Array.isArray(msg.experimental_attachments)) {
                  msg.experimental_attachments.forEach((attachment: any) => {
                    const fileName = attachment.name || '';
                    const fileType = attachment.contentType || attachment.fileType || '';
                    if (fileType === 'image' || fileType.startsWith('image/') || fileName.match(/\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i)) attachmentInfo.push(`[ATTACHED: Image file - ${fileName}]`);
                    else if (fileType === 'pdf' || fileType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')) attachmentInfo.push(`[ATTACHED: PDF document - ${fileName}]`);
                    else if (fileType === 'code' || fileName.match(/\.(js|ts|jsx|tsx|py|java|c|cpp|cs|go|rb|php|html|css|sql|swift|kt|rs|dart|json|xml|yaml|yml)$/i)) {
                      const extension = fileName.split('.').pop();
                      attachmentInfo.push(`[ATTACHED: Code file (${extension}) - ${fileName}]`);
                    } else if (fileName) attachmentInfo.push(`[ATTACHED: File - ${fileName} (${fileType})]`);
                  });
                }
                
                if (textContent) return attachmentInfo.length > 0 ? `${textContent}\n${attachmentInfo.join('\n')}` : textContent;
                if (attachmentInfo.length > 0) return attachmentInfo.join('\n');
              }
              return '';
            };
            
            const currentMessage = optimizedMessagesForRouting[optimizedMessagesForRouting.length - 1];
            userQuery = extractTextFromMessage(currentMessage);

            // Context relevance analysis for demo
            const hasToolResultsInHistory = messagesWithTokens.slice(0, -1).some(msg => 
              (msg as any).tool_results && 
              Object.keys((msg as any).tool_results).some(key => key !== 'token_usage')
            );
            const hasPreviousConversation = messagesWithTokens.length > 1;
            const shouldAnalyzeContext = hasPreviousConversation && hasToolResultsInHistory && messagesWithTokens.length > 3;

            // Define available tools list
            let baseAvailableToolsList = [
              'web_search',
              'calculator',
              'link_reader',
              'image_generator',
              'academic_search',
              'youtube_search',
              'youtube_link_analyzer'
            ];

            // Filter tools based on model capabilities
            if (model === 'gemini-2.5-pro-preview-05-06' || model === 'gemini-2.5-flash-preview-04-17') {
              baseAvailableToolsList = baseAvailableToolsList.filter(tool => tool !== 'link_reader' && tool !== 'youtube_link_analyzer');
            }

            const analysisModel = 'gemini-2.0-flash';

            const toolDescriptions = {
              'web_search': 'Real-time information from the internet',
              'calculator': 'Mathematical calculations and computations',
              'link_reader': 'Reading and analyzing web page content',
              'image_generator': 'Creating visual content',
              'academic_search': 'Finding scholarly and research materials',
              'youtube_search': 'Finding relevant video content',
              'youtube_link_analyzer': 'Analyzing specific YouTube videos'
            };

            // V6 unified analysis and routing
            const [
              routeAnalysisResult,
              contextAnalysisResult
            ] = await Promise.all([
              analyzeRequestAndDetermineRoute(
                analysisModel,
                model,
                baseAvailableToolsList,
                convertMultiModalToMessage(messagesWithTokens, undefined),
                toolDescriptions
              ),
              shouldAnalyzeContext
                ? analyzeContextRelevance(analysisModel, convertMultiModalToMessage(messagesWithTokens, undefined))
                : Promise.resolve(null),
            ]);
            
            // Process context analysis results
            let contextFilter: any | null = null;
            if (contextAnalysisResult) {
              try {
                contextFilter = contextAnalysisResult.object;
              } catch (error) {
                contextFilter = null;
              }
            }
            
            // Convert messages ONCE with the final context filter
            const finalMessagesForAI = convertMultiModalToMessage(messagesWithTokens, contextFilter);
            
            const messagesWithTokensFinal = finalMessagesForAI.map(msg => ({
              ...msg,
              _tokenCount: estimateMultiModalTokens(msg as any)
            }));
            
            const routingDecision = routeAnalysisResult.object;

            const hasImage = messagesWithTokens.some(msg => detectImages(msg));
            const hasFile = messagesWithTokens.some(msg => detectPDFs(msg) || detectCodeAttachments(msg));
            
            switch (routingDecision.route) {
              case 'CLARIFY':
                const clarificationResult = streamText({
                  model: providers.languageModel('gemini-2.0-flash'),
                  system: `You are an assistant. The user's request was unclear. Ask the following clarifying question exactly as written, in the user's language. Do not add any extra conversational text. Question: "${routingDecision.question}"`,
                  prompt: `Ask this question: ${routingDecision.question}`,
                  onFinish: async (completion) => {
                    if (abortController.signal.aborted) return;
                    // 데모에서는 DB 저장 없음
                  }
                });
                clarificationResult.mergeIntoDataStream(dataStream);
                break;

              case 'TEXT_RESPONSE': {
                const tools: Record<string, any> = {};
                routingDecision.tools.forEach((toolName: string) => {
                  tools[toolName] = initializeTool(toolName, dataStream);
                });

                const systemPrompt = buildSystemPrompt('agent', 'text', undefined);
                const preciseSystemTokens = estimateTokenCount(systemPrompt);
                const preciseRemainingTokens = maxContextTokens - preciseSystemTokens;
                const finalMessages = selectMessagesWithinTokenLimit(
                  messagesWithTokensFinal,
                  preciseRemainingTokens,
                );

                const textResponsePromise = streamText({
              model: providers.languageModel(model),
                  system: systemPrompt,
                  messages: convertMultiModalToMessage(finalMessages),
              tools,
              maxSteps: 15,
                  providerOptions,
              onFinish: async (completion) => {
                if (abortController.signal.aborted) return;
                
                    // 데모에서는 DB 저장 없음 - 바로 follow-up questions 생성
                    try {
                      const followUpResult = await generateObject({
                        model: providers.languageModel('gemini-2.0-flash'),
                        prompt: `Based on the user's query ("${userQuery}") and the response ("${completion.text}"), generate 3 natural follow-up questions. Respond in the user's language.`,
                        schema: z.object({
                          followup_questions: z.array(z.string()).length(3)
                        })
                      });
                      dataStream.writeMessageAnnotation({
                        type: 'structured_response',
                        data: { 
                          response: { 
                            followup_questions: followUpResult.object.followup_questions 
                          } 
                        }
                      });
                    } catch (e) { 
                  dataStream.writeMessageAnnotation({ 
                        type: 'structured_response',
                        data: { 
                          response: { 
                            followup_questions: [] 
                          } 
                        }
                      });
                    }
                  }
                });

                textResponsePromise.mergeIntoDataStream(dataStream, { sendReasoning: true });
                break;
              }
                  
              case 'FILE_RESPONSE': {
                const tools: Record<string, any> = {};
                routingDecision.tools.forEach((toolName: string) => {
                  tools[toolName] = initializeTool(toolName, dataStream);
                });

                const needsTools = routingDecision.tools.length > 0;

                const fileStage = needsTools ? 'file_tool_execution' : 'file_announcement';
                const systemPromptForFileStep1 = buildSystemPrompt('agent', fileStage, undefined);
                const preciseSystemTokensFile = estimateTokenCount(systemPromptForFileStep1);
                const preciseRemainingTokensFile = maxContextTokens - preciseSystemTokensFile;
                const finalMessages = selectMessagesWithinTokenLimit(
                  messagesWithTokensFinal,
                  preciseRemainingTokensFile,
                );
                const finalMessagesConverted = convertMultiModalToMessage(finalMessages);

                if (needsTools) {
                  const toolExecutionPromise = streamText({
                    model: providers.languageModel(model),
                    system: systemPromptForFileStep1,
                    messages: finalMessagesConverted,
                    tools,
                    maxSteps: 10,
                    providerOptions,
                    onFinish: async (toolExecutionCompletion) => {
                      if (abortController.signal.aborted) return;
                      await generateFileWithToolResults(await toolExecutionCompletion.toolResults, toolExecutionCompletion, finalMessagesConverted);
                    }
                  });
                  
                  toolExecutionPromise.mergeIntoDataStream(dataStream, { sendReasoning: true });
                } else {
                  const briefExplanationPromise = streamText({
                    model: providers.languageModel('gemini-2.0-flash'),
                    system: systemPromptForFileStep1,
                    messages: finalMessagesConverted,
                    maxSteps: 1,
                    onFinish: async (briefCompletion) => {
                      if (abortController.signal.aborted) return;
                      await generateFileWithToolResults(null, null, finalMessagesConverted);
                    }
                  });
                  
                  briefExplanationPromise.mergeIntoDataStream(dataStream, { sendReasoning: true });
                }

                async function generateFileWithToolResults(toolResults: any, toolExecutionCompletion: any, messagesForGeneration: any[]) {
                  let fileGenerationModel = model;
                  if (model.includes('claude') && model.includes('sonnet')) {
                    fileGenerationModel = 'gemini-2.5-pro-preview-05-06';
                  }

                  const fileGenerationSystemPrompt = toolResults 
                    ? `${buildSystemPrompt('agent', 'file_generation', undefined)}

Tool results available:
<tool_results>
${JSON.stringify(toolResults, null, 2)}
</tool_results>`
                    : `${buildSystemPrompt('agent', 'file_generation', undefined)}
${hasImage ? `\n- An image has been provided. You can analyze it to inform your file creation.` : ''}
${hasFile ? `\n- A file has been provided. You can read its content to inform your file creation.` : ''}`;
                  
                  const fileGenerationResult = await streamObject({
                    model: providers.languageModel(fileGenerationModel),
                    system: fileGenerationSystemPrompt,
                    messages: messagesForGeneration,
                    schema: z.object({ 
                      response: z.object({ 
                        description: z.string().describe('A single, brief sentence about what the files contain in the USER\'S LANGUAGE. Do NOT include detailed explanations here - put those in the files.'),
                        files: z.array(z.object({
                            name: z.string().describe('Name of the file with appropriate extension.'),
                            content: z.string().describe('COMPREHENSIVE content of the file with ALL details, explanations, and information. This should contain the actual answer to the user\'s request. Format appropriately for the file type.'),
                          })
                        ).describe("Array of files containing ALL the detailed content and answers."),
                      })
                    })
                  });

                  (async () => {
                    for await (const partial of fileGenerationResult.partialObjectStream) {
                        if (abortController.signal.aborted) break;
                      dataStream.writeMessageAnnotation({ type: 'structured_response_progress', data: JSON.parse(JSON.stringify(partial)) });
                    }
                  })();
                  
                  const finalFileObjectFromStream = await fileGenerationResult.object;
                  const fileDescription = finalFileObjectFromStream.response.description || "Here are the files you requested.";

                  const finalFileObject: any = finalFileObjectFromStream;

                  try {
                    const followUpResult = await generateObject({ 
                        model: providers.languageModel('gemini-2.0-flash'), 
                      prompt: `Based on the user's query ("${userQuery}") and the response ("${fileDescription}"), generate 3 natural follow-up questions. Respond in the user's language.`,
                      schema: z.object({
                        followup_questions: z.array(z.string()).length(3)
                      })
                    });
                    finalFileObject.response.followup_questions = followUpResult.object.followup_questions;
                  } catch (e) { 
                    finalFileObject.response.followup_questions = [];
                  }
                  
                  dataStream.writeMessageAnnotation({
                    type: 'structured_response',
                    data: finalFileObject
                  });

                  // 데모에서는 DB 저장 없음
                }
                
                break;
              }
            }

          } else {
            // 일반 채팅 흐름
            const optimizedMessages = selectMessagesWithinTokenLimit(
              messagesWithTokens, 
              remainingTokens,
            );

            const messages = convertMultiModalToMessage(optimizedMessages);

            const result = streamText({
              model: providers.languageModel(model),
              system: currentSystemPrompt,
              messages: messages,
              providerOptions: providerOptions,
              onFinish: async (completion) => {
                if (abortController.signal.aborted) return;
                // 데모에서는 DB 저장 및 메모리 업데이트 안 함
              }
            });

            result.mergeIntoDataStream(dataStream, { sendReasoning: true });
          }
      }
    });
}