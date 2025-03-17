import { streamText, createDataStreamResponse, smoothStream } from 'ai';
import { createClient } from '@/utils/supabase/server';
import { providers } from '@/lib/providers';
import { ChatRequest } from '@/lib/types';
import { getRateLimiter } from '@/lib/ratelimit';
import { getModelById } from '@/lib/models/config';
import { Message, tool } from 'ai';
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
import { z } from 'zod';
import { tavily } from '@tavily/core';
import { geolocation } from '@vercel/functions';

export const runtime = 'edge';
export const maxDuration = 300;

const getProviderFromModel = (model: string): string => {
  const selectedModel = providers.languageModel(model);
  return selectedModel?.provider || 'Unknown Provider';
};

const handleRateLimiting = async (userId: string, model: string) => {
  const modelConfig = getModelById(model);
  if (!modelConfig) {
    throw new Error(`Model ${model} not found in configuration`);
  }
  
  const modelRateLimiter = await getRateLimiter(model, userId);
  const level = modelConfig.rateLimit.level;
  const { success, reset } = await modelRateLimiter.limit(`${userId}:${level}`);
  
  if (!success) {
    const retryAfter = Math.floor((reset - Date.now()) / 1000);
    throw new Error(JSON.stringify({
      type: 'rate_limit',
      message: `Rate limit exceeded for ${level} models. Please try again in ${retryAfter} seconds.`,
      retryAfter
    }));
  }
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

const extractDomain = (url: string): string => {
  const urlPattern = /^https?:\/\/([^/?#]+)(?:[/?#]|$)/i;
  return url.match(urlPattern)?.[1] || url;
};

const deduplicateByDomainAndUrl = <T extends { url: string }>(items: T[]): T[] => {
  const seenDomains = new Set<string>();
  const seenUrls = new Set<string>();

  return items.filter(item => {
      const domain = extractDomain(item.url);
      const isNewUrl = !seenUrls.has(item.url);
      const isNewDomain = !seenDomains.has(domain);

      if (isNewUrl && isNewDomain) {
          seenUrls.add(item.url);
          seenDomains.add(domain);
          return true;
      }
      return false;
  });
};
function sanitizeUrl(url: string): string {
  return url.replace(/\s+/g, '%20');
}

async function isValidImageUrl(url: string): Promise<boolean> {
  try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url, {
          method: 'HEAD',
          signal: controller.signal,
      });

      clearTimeout(timeout);

      return response.ok && (response.headers.get('content-type')?.startsWith('image/') ?? false);
  } catch {
      return false;
  }
}

export async function POST(req: Request) {
  return createDataStreamResponse({
    execute: async (dataStream) => {
      try {
        console.log('[Debug-API] Starting chat request processing');
        
        const supabase = await createClient();
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError || !user) {
          console.log('[Debug-API] Authentication error:', userError);
          throw new Error('Unauthorized');
        }

        const requestData = await req.json();
        console.log('[Debug-API] Request data:', {
          chatId: requestData.chatId,
          model: requestData.model,
          isWebSearchEnabled: requestData.isWebSearchEnabled,
          messageCount: requestData.messages?.length
        });

        const { messages, model, chatId, isRegeneration, existingMessageId, isReasoningEnabled = true, saveToDb = true, isWebSearchEnabled = false } = requestData;

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
          console.log('[Debug-API] Invalid messages format');
          throw new Error('Invalid messages format');
        }

        await handleRateLimiting(user.id, model);
        await validateAndUpdateSession(supabase, chatId, user.id, messages);

        const systemPrompt = await fetchSystemPrompt(supabase, user.id);
        const provider = getProviderFromModel(model);
        
        const processMessagesPromises = messages.map(async (msg) => {
          const converted = await convertMessageForAI(msg, model, supabase);
          return {
            id: msg.id,
            ...converted
          } as MultiModalMessage;
        });
        
        const processMessages = await Promise.all(processMessagesPromises);

        const lastMessage = processMessages[processMessages.length - 1];
        const processedLastMessage = await handlePromptShortcuts(supabase, lastMessage, user.id) as MultiModalMessage;
        processMessages[processMessages.length - 1] = processedLastMessage;

        if (lastMessage.role === 'user' && !isRegeneration && saveToDb) {
          const { data: existingMessages } = await supabase
            .from('messages')
            .select('id')
            .eq('chat_session_id', chatId)
            .eq('user_id', user.id)
            .order('created_at', { ascending: true })
            .limit(2);
          
          const isInitialMessage = existingMessages?.length === 1;
          
          if (!isInitialMessage) {
            await saveUserMessage(supabase, chatId, user.id, lastMessage, model);
          }
        }

        const assistantMessageId = isRegeneration && existingMessageId 
          ? existingMessageId 
          : generateMessageId();

        if (chatId) {
          await createOrUpdateAssistantMessage(
            supabase,
            chatId,
            user.id,
            model,
            provider,
            isRegeneration,
            assistantMessageId
          );
        }

        const abortController = new AbortController();
        let isStreamFinished = false;

        const modelConfig = getModelById(model);
        const supportsReasoning = modelConfig?.reasoning?.enabled || false;
        const geo = geolocation(req);

        const providerOptions: any = {};
        if (supportsReasoning) {
          providerOptions.anthropic = {
            thinking: {
              type: isReasoningEnabled ? 'enabled' : 'disabled',
              budgetTokens: modelConfig?.reasoning?.budgetTokens || 12000
            }
          };
        }
        
        if (isWebSearchEnabled) {
          console.log('[Debug-API] Web search is enabled, starting multi-step approach');
          // Step 1: Call web search tool
          const webSearchResult = streamText({
            model: providers.languageModel(model),
            messages: [
              { role: 'system', content: webSearchQueryGeneratorPrompt },
              ...processMessages as unknown as Message[]
            ],
            temperature: 0,
            experimental_activeTools: ['web_search', 'datetime'],
            toolChoice: 'required',
            tools: {
              web_search: tool({
                  description: 'Search the web for information with multiple queries, max results and search depth.',
                  parameters: z.object({
                      queries: z.array(z.string().describe('Array of search queries to look up on the web.')),
                      maxResults: z.array(
                          z.number().describe('Array of maximum number of results to return per query.').default(10),
                      ),
                      topics: z.array(
                          z.enum(['general', 'news']).describe('Array of topic types to search for.').default('general'),
                      ),
                      searchDepth: z.array(
                          z.enum(['basic', 'advanced']).describe('Array of search depths to use.').default('basic'),
                      ),
                      exclude_domains: z
                          .array(z.string())
                          .describe('A list of domains to exclude from all search results.')
                          .default([]),
                  }),
                  execute: async ({
                      queries,
                      maxResults,
                      topics,
                      searchDepth,
                      exclude_domains,
                  }: {
                      queries: string[];
                      maxResults: number[];
                      topics: ('general' | 'news')[];
                      searchDepth: ('basic' | 'advanced')[];
                      exclude_domains?: string[];
                  }) => {
                      const apiKey = process.env.TAVILY_API_KEY;
                      const tvly = tavily({ apiKey });
                      const includeImageDescriptions = true;

                      console.log('Queries:', queries);
                      console.log('Max Results:', maxResults);
                      console.log('Topics:', topics);
                      console.log('Search Depths:', searchDepth);
                      console.log('Exclude Domains:', exclude_domains);

                      // Execute searches in parallel
                      const searchPromises = queries.map(async (query, index) => {
                          const data = await tvly.search(query, {
                              topic: topics[index] || topics[0] || 'general',
                              days: topics[index] === 'news' ? 7 : undefined,
                              maxResults: maxResults[index] || maxResults[0] || 10,
                              searchDepth: searchDepth[index] || searchDepth[0] || 'basic',
                              includeAnswer: true,
                              includeImages: true,
                              includeImageDescriptions: includeImageDescriptions,
                              excludeDomains: exclude_domains,
                          });

                          // Add annotation for query completion
                          dataStream.writeMessageAnnotation({
                              type: 'query_completion',
                              data: {
                                  query,
                                  index,
                                  total: queries.length,
                                  status: 'completed',
                                  resultsCount: data.results.length,
                                  imagesCount: data.images.length
                              }
                          });

                          return {
                              query,
                              results: deduplicateByDomainAndUrl(data.results).map((obj: any) => ({
                                  url: obj.url,
                                  title: obj.title,
                                  content: obj.content,
                                  raw_content: obj.raw_content,
                                  published_date: topics[index] === 'news' ? obj.published_date : undefined,
                              })),
                              images: includeImageDescriptions
                                  ? await Promise.all(
                                      deduplicateByDomainAndUrl(data.images).map(
                                          async ({ url, description }: { url: string; description?: string }) => {
                                              const sanitizedUrl = sanitizeUrl(url);
                                              const isValid = await isValidImageUrl(sanitizedUrl);
                                              return isValid
                                                  ? {
                                                      url: sanitizedUrl,
                                                      description: description ?? '',
                                                  }
                                                  : null;
                                          },
                                      ),
                                  ).then((results) =>
                                      results.filter(
                                          (image): image is { url: string; description: string } =>
                                              image !== null &&
                                              typeof image === 'object' &&
                                              typeof image.description === 'string' &&
                                              image.description !== '',
                                      ),
                                  )
                                  : await Promise.all(
                                      deduplicateByDomainAndUrl(data.images).map(async ({ url }: { url: string }) => {
                                          const sanitizedUrl = sanitizeUrl(url);
                                          return (await isValidImageUrl(sanitizedUrl)) ? sanitizedUrl : null;
                                      }),
                                  ).then((results) => results.filter((url) => url !== null) as string[]),
                          };
                      });

                      const searchResults = await Promise.all(searchPromises);

                      return {
                          searches: searchResults,
                      };
                  },
              }),
             datetime: tool({
                  description: 'Get the current date and time in the user\'s timezone',
                  parameters: z.object({}),
                  execute: async () => {
                      try {
                          // Get current date and time
                          const now = new Date();

                          // Use geolocation to determine timezone
                          let userTimezone = 'UTC'; // Default to UTC

                          if (geo && geo.latitude && geo.longitude) {
                              try {
                                  // Get timezone from coordinates using Google Maps API
                                  const tzResponse = await fetch(
                                      `https://maps.googleapis.com/maps/api/timezone/json?location=${geo.latitude},${geo.longitude}&timestamp=${Math.floor(now.getTime() / 1000)}&key=${process.env.GOOGLE_MAPS_API_KEY}`
                                  );

                                  if (tzResponse.ok) {
                                      const tzData = await tzResponse.json();
                                      if (tzData.status === 'OK' && tzData.timeZoneId) {
                                          userTimezone = tzData.timeZoneId;
                                          console.log(`Timezone determined from coordinates: ${userTimezone}`);
                                      } else {
                                          console.log(`Failed to get timezone from coordinates: ${tzData.status || 'Unknown error'}`);
                                      }
                                  } else {
                                      console.log(`Timezone API request failed with status: ${tzResponse.status}`);
                                  }
                              } catch (error) {
                                  console.error('Error fetching timezone from coordinates:', error);
                              }
                          } else {
                              console.log('No geolocation data available, using UTC');
                          }

                          // Format date and time using the timezone
                          return {
                              timestamp: now.getTime(),
                              iso: now.toISOString(),
                              timezone: userTimezone,
                              formatted: {
                                  date: new Intl.DateTimeFormat('en-US', {
                                      weekday: 'long',
                                      year: 'numeric',
                                      month: 'long',
                                      day: 'numeric',
                                      timeZone: userTimezone
                                  }).format(now),
                                  time: new Intl.DateTimeFormat('en-US', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                      second: '2-digit',
                                      hour12: true,
                                      timeZone: userTimezone
                                  }).format(now),
                                  dateShort: new Intl.DateTimeFormat('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                      year: 'numeric',
                                      timeZone: userTimezone
                                  }).format(now),
                                  timeShort: new Intl.DateTimeFormat('en-US', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                      hour12: true,
                                      timeZone: userTimezone
                                  }).format(now)
                              }
                          };
                      } catch (error) {
                          console.error('Datetime error:', error);
                          throw error;
                      }
                  },
              }),
          },
      
          onChunk(event) {
            if (event.chunk.type === 'tool-call') {
                console.log('Called Tool: ', event.chunk.toolName);
            }
        },
        onStepFinish(event) {
            if (event.warnings) {
                console.log('Warnings: ', event.warnings);
            }
        },
        onFinish(event) {
            console.log('Fin reason[1]: ', event.finishReason);
            console.log('Reasoning[1]: ', event.reasoning);
            console.log('reasoning details[1]: ', event.reasoningDetails);
            console.log('Steps[1] ', event.steps);
            console.log('Messages[1]: ', event.response.messages);
        },
        onError(event) {
            console.log('Error: ', event.error);
        },
          });
          
          // Forward the web search step results without finish event
          webSearchResult.mergeIntoDataStream(dataStream, {
            experimental_sendFinish: false
          });
          
          // Step 2: Continue with assistant response
          const searchResults = await webSearchResult.response;
          console.log('[Debug-API] Search results:', searchResults);

          // // 로그: 웹 검색 결과 통계
          // const searchesData = searchResults.messages
          //   .filter(msg => msg.role === 'assistant')
          //   .flatMap(msg => {
          //     // 타입 안전하게 처리
          //     const anyMsg = msg as any;
          //     if (!anyMsg.toolCalls || !Array.isArray(anyMsg.toolCalls)) {
          //       return [];
          //     }
          //     return anyMsg.toolCalls;
          //   })
          //   .filter(toolCall => toolCall && typeof toolCall === 'object' && toolCall.name === 'web_search')
          //   .map(toolCall => {
          //     try {
          //       return JSON.parse(toolCall.result).searches || [];
          //     } catch (e) {
          //       return [];
          //     }
          //   })
          //   .flat();
          
          // const totalSearchResults = searchesData.reduce((sum, search) => sum + (search.results?.length || 0), 0);
          // const totalImages = searchesData.reduce((sum, search) => sum + (search.images?.length || 0), 0);
          
          // console.log('[Debug-API] Web search complete stats:', {
          //   queriesCount: searchesData.length,
          //   totalResults: totalSearchResults,
          //   totalImages: totalImages,
          //   queries: searchesData.map(s => s.query)
          // });
          
          const assistantResult = streamText({
            model: providers.languageModel(model),
            messages: [
              { role: 'system', content: getWebSearchResponsePrompt(systemPrompt) },
              ...processMessages as unknown as Message[],
              ...searchResults.messages as unknown as Message[]
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
                provider,
                completion,
                isRegeneration
              );
            }
          });
          
          // Forward assistant response with start event
          return assistantResult.mergeIntoDataStream(dataStream, {
            experimental_sendStart: false
          });
        } else {
          // Standard chat flow without web search
          const result = streamText({
            model: providers.languageModel(model),
            messages: [
              { role: 'system', content: systemPrompt },
              ...processMessages as unknown as Message[]
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
                provider,
                completion,
                isRegeneration
              );
            }
          });

          const stream = result.mergeIntoDataStream(dataStream, {
            sendReasoning: true
          });

          req.signal.addEventListener('abort', () => {
            abortController.abort();
            isStreamFinished = true;
          });

          return stream;
        }
      } catch (error) {
        console.log('Unknown error', error);
        return;
      }
    }
  });
}