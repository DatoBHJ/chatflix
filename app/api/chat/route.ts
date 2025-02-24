import { streamText, createDataStreamResponse, smoothStream } from 'ai';
import { createClient } from '@/utils/supabase/server';
import { providers } from '@/lib/providers';
import { ChatRequest, CompletionResult } from '@/lib/types';
import { getRateLimiter } from '@/lib/ratelimit';

export const runtime = 'edge';
export const maxDuration = 300;

// Types
import { Message, TextPart } from 'ai';

type MessageRole = 'system' | 'user' | 'assistant';

interface ReasoningPart {
  type: 'reasoning';
  reasoning: string;
}

type MessagePart = TextPart | ReasoningPart;

interface ProcessedMessage extends Omit<Message, 'parts'> {
  content: string;
  parts?: MessagePart[];
  role: MessageRole;
}

// Helper Functions
const generateMessageId = () => `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const getProviderFromModel = (model: string): string => {
  const selectedModel = providers.languageModel(model);
  return selectedModel?.provider || 'Unknown Provider';
};

const handleRateLimiting = async (userId: string, model: string) => {
  const modelRateLimiter = getRateLimiter(model);
  const { success, reset } = await modelRateLimiter.limit(`${userId}:${model}`);
  
  if (!success) {
    const retryAfter = Math.floor((reset - Date.now()) / 1000);
    throw new Error(JSON.stringify({
      type: 'rate_limit',
      message: `Rate limit exceeded for ${model}. Please try again in ${retryAfter} seconds.`,
      retryAfter
    }));
  }
};

const fetchSystemPrompt = async (supabase: any, userId: string) => {
  const { data, error } = await supabase
    .from('system_prompts')
    .select('content')
    .eq('user_id', userId)
    .single();

  if (error) {
    console.error('Error fetching system prompt:', error);
  }

  return data?.content || 'You are a helpful AI assistant. When sharing code or command examples, always specify a language for code blocks (e.g., ```javascript, ```python, ```bash, ```text for plain text). Use appropriate markdown syntax for code blocks, lists, tables, and other formatting elements.';
};

interface DatabaseMessage {
  id: string;
  content: string;
  is_edited?: boolean;
}

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
      const dbMessage = sessionMessages.find((dbMsg: DatabaseMessage) => dbMsg.id === msg.id);
      if (dbMessage?.is_edited) {
        messages[index].content = dbMessage.content;
      }
    });
  }
};

const handlePromptShortcuts = async (supabase: any, message: Message, userId: string): Promise<ProcessedMessage> => {
  const processedMessage: ProcessedMessage = {
    id: message.id,
    content: message.content,
    role: message.role as MessageRole,
    parts: message.parts as MessagePart[]
  };
  if (message.role !== 'user') return processedMessage;

  const content = message.content;
  let updatedContent = content;

  try {
    // Handle JSON mentions
    const jsonMatch = content.match(/\{"displayName":"[^"]+","promptContent":"[^"]+"}/g);
    if (jsonMatch) {
      for (const match of jsonMatch) {
        const mentionData = JSON.parse(match);
        updatedContent = updatedContent.replace(match, mentionData.promptContent);
      }
    } else {
      // Handle legacy @ mentions
      const match = content.match(/@([\w?!.,_\-+=@#$%^&*()<>{}\[\]|/\\~`]+)/);
      if (match) {
        const shortcutName = match[1];
        const { data: shortcutData, error: shortcutError } = await supabase
          .from('prompt_shortcuts')
          .select('content')
          .eq('user_id', userId)
          .eq('name', shortcutName)
          .single();

        if (!shortcutError && shortcutData) {
          const remainingText = content.replace(new RegExp(`@${shortcutName}\\s*`), '').trim();
          updatedContent = `${shortcutData.content} ${remainingText}`;
        }
      }
    }
  } catch (error) {
    console.error('[Debug] Error processing mentions:', error);
  }

  return {
    ...processedMessage,
    content: updatedContent,
    parts: processedMessage.parts?.map(part => 
      part.type === 'text' ? { ...part, text: updatedContent } : part
    )
  };
};

const saveUserMessage = async (supabase: any, chatId: string | undefined, userId: string, message: Message, model: string) => {
  // 해당 메시지가 이미 존재하는지 확인
  const { data: existingMessage } = await supabase
    .from('messages')
    .select('id, sequence_number')
    .eq('chat_session_id', chatId)
    .eq('content', message.content)
    .eq('role', 'user')
    .eq('user_id', userId)
    .maybeSingle();

  if (existingMessage) return;

  // 저장 직전에 현재 최대 시퀀스 번호 다시 확인
  const { data: currentMax } = await supabase
    .from('messages')
    .select('sequence_number')
    .eq('chat_session_id', chatId)
    .eq('user_id', userId)
    .order('sequence_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  const sequence = (currentMax?.sequence_number || 0) + 1;
  const messageId = generateMessageId();

  await supabase.from('messages').insert([{
    id: messageId,
    content: message.content,
    role: 'user',
    created_at: new Date().toISOString(),
    model,
    host: 'user',
    chat_session_id: chatId,
    user_id: userId,
    sequence_number: sequence
  }]);

  return sequence;
};

const createOrUpdateAssistantMessage = async (
  supabase: any,
  chatId: string | undefined,
  userId: string,
  model: string,
  provider: string,
  isRegeneration: boolean | undefined,
  messageId: string
) => {
  if (isRegeneration) {
    await supabase
      .from('messages')
      .update({
        content: '',
        reasoning: '',
        model,
        host: provider,
        created_at: new Date().toISOString()
      })
      .eq('id', messageId)
      .eq('user_id', userId);
    return;
  }

  // 저장 직전에 현재 최대 시퀀스 번호 확인
  const { data: currentMax } = await supabase
    .from('messages')
    .select('sequence_number')
    .eq('chat_session_id', chatId)
    .eq('user_id', userId)
    .order('sequence_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  const sequence = (currentMax?.sequence_number || 0) + 1;

  await supabase.from('messages').insert([{
    id: messageId,
    role: 'assistant',
    content: '',
    reasoning: '',
    created_at: new Date().toISOString(),
    model,
    host: provider,
    chat_session_id: chatId,
    user_id: userId,
    sequence_number: sequence
  }]);
};

const handleStreamCompletion = async (
  supabase: any,
  messageId: string,
  userId: string,
  model: string,
  provider: string,
  completion: CompletionResult,
  isRegeneration: boolean = false
) => {
  let finalContent = '';
  let finalReasoning = '';

  if (completion.steps?.[0]) {
    const step = completion.steps[0];
    finalContent = step.text || '';
    finalReasoning = step.reasoning || '';
  } else if (completion.parts) {
    finalContent = completion.parts
      .filter(part => part.type === 'text')
      .map(part => part.text)
      .join('\n');
    
    finalReasoning = completion.parts
      .filter(part => part.type === 'reasoning')
      .map(part => part.reasoning)
      .join('\n');
  } else {
    finalContent = completion.text || '';
    const reasoningMatch = finalContent.match(/<think>(.*?)<\/think>/s);
    if (reasoningMatch) {
      finalReasoning = reasoningMatch[1].trim();
      finalContent = finalContent.replace(/<think>.*?<\/think>/s, '').trim();
    }
  }

  await supabase
    .from('messages')
    .update({
      content: finalContent,
      reasoning: finalReasoning && finalReasoning !== finalContent ? finalReasoning : null,
      model,
      host: provider,
      created_at: new Date().toISOString()
    })
    .eq('id', messageId)
    .eq('user_id', userId);
};

// Main Handler
export async function POST(req: Request) {
  return createDataStreamResponse({
    execute: async (dataStream) => {
      try {
        const supabase = await createClient();
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError || !user) {
          throw new Error('Unauthorized');
        }

        const { messages, model, chatId, isRegeneration, existingMessageId }: ChatRequest = await req.json();

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
          throw new Error('Invalid messages format');
        }

        await handleRateLimiting(user.id, model);
        await validateAndUpdateSession(supabase, chatId, user.id, messages);

        const systemPrompt = await fetchSystemPrompt(supabase, user.id);
        const provider = getProviderFromModel(model);
        
        // Process messages
        const processMessages = messages.map(msg => ({
  ...msg,
  role: msg.role as MessageRole
}));
        const lastMessage = processMessages[processMessages.length - 1];
        processMessages[processMessages.length - 1] = await handlePromptShortcuts(supabase, lastMessage, user.id);

        // Save messages
        if (lastMessage.role === 'user' && !isRegeneration) {
          await saveUserMessage(supabase, chatId, user.id, lastMessage, model);
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

        // Handle streaming
        const abortController = new AbortController();
        let isStreamFinished = false;

        const result = streamText({
          model: providers.languageModel(model),
          messages: [
            { role: 'system', content: systemPrompt },
            ...processMessages
          ],
          temperature: 0.7,
          maxTokens: 4000,
          experimental_transform: smoothStream({}),
          onFinish: async (completion: CompletionResult) => {
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

      } catch (error) {
        if (error instanceof Error) {
          try {
            const errorData = JSON.parse(error.message);
            if (errorData.type === 'rate_limit') {
              dataStream.write(`0:${errorData.message}\n`);
              dataStream.write(`e:{"finishReason":"error"}\n`);
              return;
            }
          } catch (e) {
            // If parsing fails, treat it as a regular error
          }
          
          dataStream.writeMessageAnnotation({
            type: 'error',
            data: { message: error.message }
          });
        } else {
          dataStream.writeMessageAnnotation({
            type: 'error',
            data: { message: 'An unknown error occurred' }
          });
        }
      }
    }
  });
}