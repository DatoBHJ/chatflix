import { streamText, createDataStreamResponse, smoothStream } from 'ai';
import { createClient } from '@/utils/supabase/server';
import { providers } from '@/lib/providers';
import { getRateLimiter, createRateLimitKey } from '@/lib/ratelimit';
import { getModelById, RATE_LIMITS, getEnabledModels, ModelConfig } from '@/lib/models/config';
import { Message } from 'ai';
import { MultiModalMessage } from './types';
import { 
  fetchSystemPrompt,
  handlePromptShortcuts,
  saveUserMessage,
  createOrUpdateAssistantMessage,
  handleStreamCompletion
} from './services/chatService';
import { generateMessageId, convertMessageForAI } from './utils/messageUtils';
import { 
  webSearchQueryGeneratorPrompt, 
  getWebSearchResponsePrompt 
} from './prompts';
import { createWebSearchTool, createDatetimeTool } from './tools';

// Helper function to check if messages contain PDF
const messagesContainPDF = (messages: Message[]): boolean => {
  return messages.some(message => 
    message.experimental_attachments?.some(
      a => a.contentType === 'application/pdf'
    )
  );
};

export const maxDuration = 300;

const getProviderFromModel = (model: string): string => {
  const selectedModel = providers.languageModel(model);
  return selectedModel?.provider || 'Unknown Provider';
};

const handleRateLimiting = async (userId: string, model: string) => {
  if (!userId) {
    throw new Error('User ID is required for rate limiting');
  }
  
  const modelConfig = getModelById(model);
  if (!modelConfig) {
    throw new Error(`Model ${model} not found in configuration`);
  }
  
  const now = new Date();
  console.log(`[DEBUG-RATELIMIT][${now.toISOString()}] Checking rate limit for user ${userId}, model ${model}, level ${modelConfig.rateLimit.level}`);
  
  const rateLimiters = await getRateLimiter(model, userId);
  const level = modelConfig.rateLimit.level;
  
  // 시간당 제한 체크
  const hourlyKey = createRateLimitKey(userId, level, 'hourly');
  const hourlyResult = await rateLimiters.hourly.limit(hourlyKey);
  
  const hourlyReset = new Date(hourlyResult.reset);
  const hourlyTimeToReset = Math.floor((hourlyResult.reset - Date.now()) / 1000);
  console.log(`[DEBUG-RATELIMIT][${now.toISOString()}] Hourly rate limit result: success=${hourlyResult.success}, remaining=${hourlyResult.remaining}/${hourlyResult.limit}, reset=${hourlyReset.toISOString()}, seconds_to_reset=${hourlyTimeToReset}`);
  
  // 시간당 제한 초과시
  if (!hourlyResult.success) {
    const retryAfter = Math.floor((hourlyResult.reset - Date.now()) / 1000);
    // Get the actual window from config
    const configLevel = RATE_LIMITS[level as keyof typeof RATE_LIMITS];
    const windowText = configLevel ? configLevel.hourly.window : '1 h';
    
    return {
      success: false,
      error: {
        type: 'rate_limit',
        message: `Hourly rate limit exceeded for ${level} models. You've used all ${hourlyResult.limit} requests in the sliding ${windowText} window. Next request allowed in ${retryAfter} seconds.`,
        retryAfter,
        level,
        reset: hourlyResult.reset,
        limit: hourlyResult.limit
      }
    };
  }
  
  // 일일 제한 체크
  const dailyKey = createRateLimitKey(userId, level, 'daily');
  const dailyResult = await rateLimiters.daily.limit(dailyKey);
  
  const dailyReset = new Date(dailyResult.reset);
  const dailyTimeToReset = Math.floor((dailyResult.reset - Date.now()) / 1000);
  console.log(`[DEBUG-RATELIMIT][${now.toISOString()}] Daily rate limit result: success=${dailyResult.success}, remaining=${dailyResult.remaining}/${dailyResult.limit}, reset=${dailyReset.toISOString()}, seconds_to_reset=${dailyTimeToReset}`);
  
  // 일일 제한 초과시
  if (!dailyResult.success) {
    const retryAfter = Math.floor((dailyResult.reset - Date.now()) / 1000);
    // Get the actual window from config
    const configLevel = RATE_LIMITS[level as keyof typeof RATE_LIMITS];
    const windowText = configLevel ? configLevel.daily.window : '24 h';
    
    return {
      success: false,
      error: {
        type: 'rate_limit',
        message: `Daily rate limit exceeded for ${level} models. You've used all ${dailyResult.limit} requests for today. Limit resets in ${Math.floor(retryAfter / 3600)} hours and ${Math.floor((retryAfter % 3600) / 60)} minutes.`,
        retryAfter,
        level,
        reset: dailyResult.reset,
        limit: dailyResult.limit
      }
    };
  }
  
  return { success: true };
};

const validateAndUpdateSession = async (supabase: any, chatId: string | undefined, userId: string, messages: Message[]) => {
  if (!chatId) return;

  const { data: existingSession, error: sessionError } = await supabase
    .from('chat_sessions')
    .select()
    .eq('id', chatId)
    .eq('user_id', userId)
    .single();

  if (sessionError || !existingSession) {
    throw new Error('Chat session not found');
  }

  const { data: sessionMessages, error: messagesError } = await supabase
    .from('messages')
    .select('*')
    .eq('chat_session_id', chatId)
    .eq('user_id', userId)
    .order('sequence_number', { ascending: true });

  if (!messagesError && sessionMessages) {
    messages.forEach((msg, index) => {
      const dbMessage = sessionMessages.find((dbMsg: any) => dbMsg.id === msg.id);
      if (dbMessage) {
        if (dbMessage.is_edited) {
          messages[index].content = dbMessage.content;
        }
        if (dbMessage.experimental_attachments?.length > 0) {
          messages[index].experimental_attachments = dbMessage.experimental_attachments;
        }
      }
    });
  }
};

export async function POST(req: Request) {
  const requestStart = new Date();
  console.log(`[DEBUG-TIMING][${requestStart.toISOString()}] Starting request processing`);
  
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const requestData = await req.json();
    console.log(`[DEBUG-RATELIMIT][${requestStart.toISOString()}] Chat request:`, {
      userId: user.id,
      model: requestData.model,
      timestamp: requestStart.toISOString()
    });

    let { messages, model, chatId, isRegeneration, existingMessageId, isReasoningEnabled = true, saveToDb = true, isWebSearchEnabled = false } = requestData;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'Invalid messages format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if messages contain PDF and adjust model if needed
    const hasPDF = messagesContainPDF(messages);
    const originalModel = model;
    
    if (hasPDF) {
      // Get the current model config
      const modelConfig = getModelById(model);
      
      // If current model doesn't support PDFs, find a suitable one
      if (modelConfig && !modelConfig.supportsPDFs) {
        const pdfModels = getEnabledModels().filter((m: ModelConfig) => m.supportsPDFs);
        if (pdfModels.length > 0) {
          // Use the first available PDF-supporting model
          model = pdfModels[0].id;
          console.log(`[DEBUG-PDF] Switched model from ${originalModel} to ${model} for PDF support`);
        } else {
          return new Response(JSON.stringify({ 
            error: 'PDF not supported', 
            message: 'No PDF-supporting models available'
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }
    }

    // Check rate limiting with potentially updated model
    const rateLimitResult = await handleRateLimiting(user.id, model);
    if (!rateLimitResult.success) {
      const { error } = rateLimitResult;
      console.log(`[DEBUG-RATELIMIT][${new Date().toISOString()}] Rate limit exceeded:`, error);
      
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
        try {
          // Prioritize API request for faster response
          // Only validate session if we have a chatId
          let sessionValidationPromise;
          if (chatId) {
            sessionValidationPromise = validateAndUpdateSession(supabase, chatId, user.id, messages);
          } else {
            sessionValidationPromise = Promise.resolve();
          }

          // Fetch system prompt in parallel - don't wait
          const systemPromptPromise = fetchSystemPrompt(supabase, user.id);
          
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
          // const isInitialMessage = messages.length === 1 && lastMessage.role === 'user';
          
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
                console.error('[Debug-API] Error in DB operations:', error);
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
          const [processedLastMessage, systemPrompt] = await Promise.all([
            processedLastMessagePromise,
            systemPromptPromise
          ]);
          
          processMessages[processMessages.length - 1] = processedLastMessage;

          // Continue with session validation in the background
          sessionValidationPromise.catch(error => {
            console.error('[Debug-API] Session validation error (non-blocking):', error);
          });

          // Continue with DB operations in the background
          dbOperationsPromise.catch(error => {
            console.error('[Debug-API] DB operations error (non-blocking):', error);
          });

          const abortController = new AbortController();
          let isStreamFinished = false;

          const modelConfig = getModelById(model);
          const supportsReasoning = modelConfig?.reasoning?.enabled || false;

          const providerOptions: any = {};
          if (supportsReasoning) {
            providerOptions.anthropic = {
              thinking: {
                type: isReasoningEnabled ? 'enabled' : 'disabled',
                budgetTokens: modelConfig?.reasoning?.budgetTokens || 12000
              }
            };
          }
          
          // Check if we need to use the image generator system prompt
          let currentSystemPrompt = systemPrompt;
          if ((processedLastMessage as any).useImageSystemPrompt) {
            currentSystemPrompt = `
# Image Generator Instructions

You are an image generator. The user provides a prompt. Please infer the following parameters for image generation:

- **Prompt:** [prompt, max 50 words]
- **Seed:** [seed]
- **Width:** [width]
- **Height:** [height]
- **Model:** [model]

## Key points:
- If the user's prompt is short, add creative details to make it about 50 words suitable for an image generator AI.
- Each seed value creates a unique image for a given prompt.
- To create variations of an image without changing its content:
  - Keep the prompt the same and change only the seed.
- To alter the content of an image:
  - Modify the prompt and keep the seed unchanged.
- Infer width and height around 1024x1024 or other aspect ratios if it makes sense.
- Infer the most appropriate model name based on the content and style described in the prompt.

## Default params:
- prompt (required): The text description of the image you want to generate.
- model (optional): The model to use for generation. Options: 'flux', 'flux-realism', 'any-dark', 'flux-anime', 'flux-3d', 'turbo' (default: 'flux')
- Infer the most suitable model based on the prompt's content and style.
- seed (optional): Seed for reproducible results (default: random).
- width/height (optional): Default 1024x1024.
- nologo (required): Always set to true.

## IMPORTANT FORMAT INSTRUCTIONS:
- DO NOT wrap the response in code blocks, text blocks, or any other formatting container
- ALWAYS use this exact format (no variations):

![{description}](https://image.pollinations.ai/prompt/{description}?width={width}&height={height}&nologo=true)
*{description}*

- The image should be directly rendered in the chat, not shown as a URL or code
- Under no circumstances should you return a plain URL or wrap the URL in a code block

## Example format:
![A vibrant sunset over mountains](https://image.pollinations.ai/prompt/{description}?width={width}&height={height}&nologo=true)
*A vibrant sunset over mountains*
`;
          }
          
          if (isWebSearchEnabled) {
            console.log('[Debug-API] Web search is enabled, starting multi-step approach');
            console.log('[Debug-API] Web search model:', model);  
            console.log('[Debug-API] full prompt:', [
              { role: 'system', content: webSearchQueryGeneratorPrompt },
              ...processMessages as unknown as Message[]
            ]);
            // Step 1: Web search query generation and execution
            const webSearchResult = streamText({
              model: providers.languageModel('grok-2-vision-latest'),
              messages: [
                { role: 'system', content: webSearchQueryGeneratorPrompt },
                ...processMessages as unknown as Message[]
              ],
              temperature: 0,
              toolChoice: 'required',
              experimental_activeTools: [
                'web_search', 
                'datetime'
              ],
              tools: {
                web_search: createWebSearchTool(processMessages, dataStream),
                datetime: createDatetimeTool(req)
              },
              onChunk(event) {
                if (event.chunk.type === 'tool-call') {
                  console.log('[Debug-API] Called Tool:', event.chunk.toolName);
                }
              },
              onFinish(event) {
                console.log('[Debug-API] Web search generator finished:', {
                  finishReason: event.finishReason,
                  messageCount: event.response.messages.length
                });
              }
            });

            // Forward the web search step results without finish event
            webSearchResult.mergeIntoDataStream(dataStream, {
              experimental_sendFinish: false
            });

            console.log('[Debug-API] Web search result:', webSearchResult);

            console.log('[Debug-API] Starting assistant response');
            console.log('[Debug-API] Assistant model:', model);
            
            // Process web search results to extract only essential content
            const processWebSearchResults = async (result: any) => {
              const webSearchResponse = await result.response;
              const toolResults = webSearchResponse.messages.find((m: any) => m.role === 'tool')?.content || [];
              
              if (!toolResults.length) return [];
              
              const searchContent = toolResults[0]?.result?.searches || [];
              const processedResults: Message[] = [];
              
              // Extract only the essential content from search results
              for (const search of searchContent) {
                const query = search.query;
                const sources = search.results.map((r: any) => ({
                  title: r.title,
                  content: r.content,
                  url: r.url,
                  publishedDate: r.publishedDate
                }));
                
                processedResults.push({
                  id: generateMessageId(),
                  role: 'assistant',
                  content: `### Search results for: "${query}"\n\n${sources.map((s: any, i: number) => 
                    `[${i+1}] ${s.title}\n${s.content}\nSource: ${s.url}${s.publishedDate ? ` (${s.publishedDate})` : ''}\n`
                  ).join('\n')}`
                });
              }
              
              return processedResults;
            };
            
            // Get processed web search results
            const webSearchProcessedResults = await processWebSearchResults(webSearchResult);
            
            const assistantPrompt = [
              { role: 'system', content: currentSystemPrompt },
              ...processMessages as unknown as Message[],
              ...webSearchProcessedResults
            ];
            
            // Log the full prompt contents with proper formatting
            console.log('[Debug-API] Assistant full prompt:', JSON.stringify(assistantPrompt, null, 2));
            
            const assistantResult = streamText({
              model: providers.languageModel(model),
              system: getWebSearchResponsePrompt(currentSystemPrompt),
              messages: [
                ...processMessages as unknown as Message[],
                ...webSearchProcessedResults
              ],
              temperature: 0.7,
              maxTokens: 8000,
              providerOptions,
              experimental_transform: smoothStream({}),
              onFinish: async (completion) => {
                if (abortController.signal.aborted || isStreamFinished) return;
                isStreamFinished = true;

                await handleStreamCompletion(
                  supabase,
                  assistantMessageId,
                  user.id,
                  model,
                  getProviderFromModel(model),
                  completion,
                  isRegeneration
                );
              }
            });

            // Forward assistant response
            return assistantResult.mergeIntoDataStream(dataStream, {
              experimental_sendStart: false,
              sendReasoning: true
            });
          } else {
            // Standard chat flow without web search
            const result = streamText({
              model: providers.languageModel(model),
              messages: [
                { role: 'system', content: currentSystemPrompt },
                ...processMessages as unknown as Message[]
              ],
              temperature: 0.7,
              maxTokens: 8000,
              providerOptions,
              experimental_transform: smoothStream({}),
              onFinish: async (completion) => {
                if (abortController.signal.aborted || isStreamFinished) return;
                isStreamFinished = true;

                const finishTime = new Date();
                console.log(`[DEBUG-TIMING][${finishTime.toISOString()}] Stream finished, total request time: ${finishTime.getTime() - requestStart.getTime()}ms`);

                await handleStreamCompletion(
                  supabase,
                  assistantMessageId,
                  user.id,
                  model,
                  getProviderFromModel(model),
                  completion,
                  isRegeneration
                );
              }
            });

            const stream = result.mergeIntoDataStream(dataStream, {
              experimental_sendStart: false,
              sendReasoning: true
            });

            req.signal.addEventListener('abort', () => {
              abortController.abort();
              isStreamFinished = true;
              console.log(`[DEBUG-TIMING][${new Date().toISOString()}] Request aborted`);
            });

            // Use try-catch for stream error handling instead
            try {
              console.log(`[DEBUG-TIMING][${new Date().toISOString()}] Stream starting, request processing time: ${new Date().getTime() - requestStart.getTime()}ms`);
              return stream;
            } catch (streamError) {
              console.error(`[DEBUG][${new Date().toISOString()}] Stream error:`, streamError);
              isStreamFinished = true;
              return;
            }
          }
        } catch (error) {
          console.error(`[DEBUG][${new Date().toISOString()}] Error in stream execution:`, error);
          return;
        }
      }
    });
  } catch (error) {
    console.error('[DEBUG] Unknown error in POST handler:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}