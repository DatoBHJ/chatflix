import { streamText, createDataStreamResponse, smoothStream } from 'ai';
import { createClient } from '@/utils/supabase/server';
import { providers } from '@/lib/providers';
import { getRateLimiter } from '@/lib/ratelimit';
import { getModelById } from '@/lib/models/config';
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
          // Step 1: Web search query generation and execution
          const webSearchResult = streamText({
            model: providers.languageModel(model),
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

          console.log('[Debug-API] Starting assistant response');
          const assistantResult = streamText({
            model: providers.languageModel(model),
            system: getWebSearchResponsePrompt(systemPrompt),
            messages: [
              ...processMessages as unknown as Message[],
              ...(await webSearchResult.response).messages as unknown as Message[]
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