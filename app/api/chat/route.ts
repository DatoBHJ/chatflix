import { streamText, createDataStreamResponse, smoothStream } from 'ai';
import { createClient } from '@/utils/supabase/server';
import { providers } from '@/lib/providers';
import { ChatRequest, CompletionResult } from '@/lib/types';
import { getRateLimiter } from '@/lib/ratelimit';
import { getModelById } from '@/lib/models/config';

export const runtime = 'edge';
export const maxDuration = 300;

// Types
import { Message, TextPart } from 'ai';

type MessageRole = 'system' | 'user' | 'assistant';

interface ReasoningDetail {
  type: 'text' | 'redacted';
  text?: string;
}

interface ReasoningPart {
  type: 'reasoning';
  reasoning: string;
  details?: ReasoningDetail[];
}

type MessagePart = TextPart | ReasoningPart;

interface ProcessedMessage extends Omit<Message, 'parts' | 'content'> {
  content: string | AIMessageContent[];
  parts?: MessagePart[];
  role: MessageRole;
}

interface AIMessageContent {
  type: 'text' | 'image';
  text?: string;
  image?: string;
}

// Extend Message type to support multi-modal content
interface MultiModalMessage extends Omit<Message, 'content'> {
  content: string | AIMessageContent[];
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

interface DatabaseAttachment {
  name: string;
  content_type: string;
  url: string;
}

interface DatabaseMessage {
  id: string;
  content: string;
  is_edited?: boolean;
  experimental_attachments?: Array<{
    name?: string;
    contentType?: string;
    url: string;
    path?: string;
    fileType?: 'image' | 'code' | 'pdf' | 'file';
  }>;
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

  // Fetch messages with experimental_attachments
  const { data: sessionMessages, error: messagesError } = await supabase
    .from('messages')
    .select('*')
    .eq('chat_session_id', chatId)
    .eq('user_id', userId)
    .order('sequence_number', { ascending: true });

  if (!messagesError && sessionMessages) {
    messages.forEach((msg, index) => {
      const dbMessage = sessionMessages.find((dbMsg: DatabaseMessage) => dbMsg.id === msg.id);
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

const handlePromptShortcuts = async (supabase: any, message: MultiModalMessage | Message, userId: string): Promise<ProcessedMessage> => {
  const processedMessage: ProcessedMessage = {
    id: message.id,
    content: message.content,
    role: message.role as MessageRole,
    parts: (message as any).parts
  };

  if (message.role !== 'user') return processedMessage;

  let updatedContent = typeof message.content === 'string' ? message.content : '';

  try {
    // Handle JSON mentions
    const jsonMatch = updatedContent.match(/\{"displayName":"[^"]+","promptContent":"[^"]+"}/g);
    if (jsonMatch) {
      for (const match of jsonMatch) {
        const mentionData = JSON.parse(match);
        updatedContent = updatedContent.replace(match, mentionData.promptContent);
      }
    } else {
      // Handle legacy @ mentions
      const match = updatedContent.match(/@([\w?!.,_\-+=@#$%^&*()<>{}\[\]|/\\~`]+)/);
      if (match) {
        const shortcutName = match[1];
        const { data: shortcutData, error: shortcutError } = await supabase
          .from('prompt_shortcuts')
          .select('content')
          .eq('user_id', userId)
          .eq('name', shortcutName)
          .single();

        if (!shortcutError && shortcutData) {
          const remainingText = updatedContent.replace(new RegExp(`@${shortcutName}\\s*`), '').trim();
          updatedContent = `${shortcutData.content} ${remainingText}`;
        }
      }
    }
  } catch (error) {
    console.error('[Debug] Error processing mentions:', error);
  }

  return {
    ...processedMessage,
    content: Array.isArray(message.content) ? message.content : updatedContent
  };
};

const saveUserMessage = async (supabase: any, chatId: string | undefined, userId: string, message: MultiModalMessage | Message, model: string) => {
  // Extract content and attachments based on message type
  let messageContent = '';
  let attachments: Array<{
    name?: string;
    contentType?: string;
    url: string;
    path?: string;
    fileType?: 'image' | 'code' | 'pdf' | 'file';
  }> = [];

  console.log('[Debug] Original message:', {
    content: message.content,
    experimental_attachments: message.experimental_attachments
  });

  if (typeof message.content === 'string') {
    messageContent = message.content;
    attachments = message.experimental_attachments || [];
  } else {
    // Handle multi-modal content
    const textPart = message.content.find(part => part.type === 'text');
    messageContent = textPart?.text || '';
    
    // Extract attachments from content array if they exist
    const imageParts = message.content.filter(part => part.type === 'image');
    if (imageParts.length > 0) {
      attachments = imageParts.map(part => ({
        url: (part as AIMessageContent).image || '',
        contentType: 'image/jpeg', // Default to JPEG if not specified
        fileType: 'image' as 'image' | 'code' | 'pdf' | 'file'
      }));
    } else if (message.experimental_attachments && message.experimental_attachments.length > 0) {
      attachments = message.experimental_attachments;
    }
  }

  console.log('[Debug] Processed message:', {
    messageContent,
    attachments
  });

  // 해당 메시지가 이미 존재하는지 확인
  const { data: existingMessage } = await supabase
    .from('messages')
    .select('id, sequence_number')
    .eq('chat_session_id', chatId)
    .eq('content', messageContent)
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

  const messageData = {
    id: messageId,
    content: messageContent,
    role: 'user',
    created_at: new Date().toISOString(),
    model,
    host: 'user',
    chat_session_id: chatId,
    user_id: userId,
    sequence_number: sequence,
    experimental_attachments: attachments
  };

  console.log('[Debug] Saving message data:', messageData);

  // Save message with experimental_attachments
  const { data, error } = await supabase.from('messages').insert([messageData]);

  if (error) {
    console.error('[Debug] Error saving message:', error);
  } else {
    console.log('[Debug] Message saved successfully:', data);
  }

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
    
    // Extract reasoning from parts
    const reasoningParts = completion.parts.filter(part => part.type === 'reasoning') as any[];
    
    if (reasoningParts.length > 0) {
      // First use reasoning property if available
      finalReasoning = reasoningParts.map(part => part.reasoning).join('\n');
      
      // If no direct reasoning, try to extract from details
      if (!finalReasoning && reasoningParts.some(part => part.details)) {
        finalReasoning = reasoningParts
          .flatMap(part => 
            part.details?.filter((detail: any) => detail.type === 'text')
              .map((detail: any) => detail.text) || []
          )
          .join('\n');
      }
    }
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

// 파일 내용을 가져오는 함수 추가
const fetchFileContent = async (url: string, supabase?: any): Promise<string | null> => {
  try {
    // Supabase 스토리지 URL인 경우 (chat_attachments 버킷에서 가져오기)
    if (url.includes('chat_attachments') && supabase) {
      const filePath = url.split('chat_attachments/')[1]?.split('?')[0];
      if (filePath) {
        try {
          const { data, error } = await supabase.storage
            .from('chat_attachments')
            .download(filePath);
            
          if (error) {
            console.error('Error downloading from Supabase:', error);
            return null;
          }
          
          return await data.text();
        } catch (err) {
          console.error('Error processing Supabase file:', err);
          return null;
        }
      }
    }
    
    // 외부 URL인 경우
    if (url.startsWith('http') || url.startsWith('https')) {
      const response = await fetch(url);
      if (!response.ok) {
        console.error(`Failed to fetch file content: ${response.statusText}`);
        return null;
      }
      return await response.text();
    }
    // Data URL인 경우
    else if (url.startsWith('data:')) {
      const base64Content = url.split(',')[1];
      if (base64Content) {
        return atob(base64Content);
      }
    }
    return null;
  } catch (error) {
    console.error('Error fetching file content:', error);
    return null;
  }
};

const convertMessageForAI = async (message: Message, modelId: string, supabase?: any): Promise<{ role: MessageRole; content: string | AIMessageContent[] }> => {
  const modelConfig = getModelById(modelId);
  if (!modelConfig) throw new Error('Invalid model');

  if (!modelConfig.supportsVision) {
    // For non-vision models, ensure content is string and remove image attachments
    return {
      role: message.role as MessageRole,
      content: typeof message.content === 'string' ? message.content :
               Array.isArray(message.content) ? 
               (message.content as Array<{ type: string; text: string }>)
                 .filter(part => part.type === 'text')
                 .map(part => part.text)
                 .join('\n') :
               'Content not available'
    };
  }

  if (!message.experimental_attachments?.length) {
    return {
      role: message.role as MessageRole,
      content: message.content
    };
  }

  // Convert message with attachments to multi-modal format for vision models
  const parts: AIMessageContent[] = [];
  
  // Add text content if exists
  if (message.content) {
    parts.push({
      type: 'text',
      text: typeof message.content === 'string' ? message.content : 
            Array.isArray(message.content) ? 
            (message.content as Array<{ type: string; text: string }>)
              .filter(part => part.type === 'text')
              .map(part => part.text)
              .join('\n') : 
            'Content not available'
    });
  }

  // Add image parts
  message.experimental_attachments
    .filter(attachment => attachment.contentType?.startsWith('image/'))
    .forEach(attachment => {
      parts.push({
        type: 'image',
        image: attachment.url
      });
    });
  
  // Add text content from non-image attachments (text, code, etc.)
  const textAttachments = message.experimental_attachments
    .filter(attachment => {
      // 텍스트 파일 또는 코드 파일인 경우
      return (attachment.contentType?.includes('text') || 
              (attachment as any).fileType === 'code' ||
              (attachment.name && /\.(js|jsx|ts|tsx|html|css|json|md|py|java|c|cpp|cs|go|rb|php|swift|kt|rs)$/i.test(attachment.name || '')));
    });
  
  if (textAttachments.length > 0) {
    // 각 텍스트 파일의 내용을 가져와서 추가
    const fileContents = await Promise.all(
      textAttachments.map(async (attachment) => {
        const fileName = attachment.name || 'Unnamed file';
        const fileType = (attachment as any).fileType || 'Unknown';
        let content = null;
        
        try {
          content = await fetchFileContent(attachment.url, supabase);
        } catch (error) {
          console.error(`Error fetching content for ${fileName}:`, error);
        }
        
        return {
          fileName,
          fileType,
          content: content || `[Could not fetch content for ${fileName}]`
        };
      })
    );
    
    // 파일 내용을 텍스트로 추가
    parts.push({
      type: 'text',
      text: `\n\nAttached files:\n${fileContents.map(file => {
        return `File: ${file.fileName}\nType: ${file.fileType}\n\nContent:\n\`\`\`\n${file.content}\n\`\`\`\n`;
      }).join('\n')}`
    });
  }
  
  // Add PDF and other file types as references
  const otherAttachments = message.experimental_attachments
    .filter(attachment => {
      return !attachment.contentType?.startsWith('image/') && 
             !attachment.contentType?.includes('text') && 
             (attachment as any).fileType !== 'code';
    });
  
  if (otherAttachments.length > 0) {
    parts.push({
      type: 'text',
      text: `\n\nOther attached files:\n${otherAttachments.map(attachment => {
        return `File: ${attachment.name || 'Unnamed file'}\nURL: ${attachment.url}\nType: ${(attachment as any).fileType || attachment.contentType || 'Unknown'}\n`;
      }).join('\n')}`
    });
  }

  return {
    role: message.role as MessageRole,
    content: parts
  };
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

        const { messages, model, chatId, isRegeneration, existingMessageId, isReasoningEnabled = true }: ChatRequest & { isReasoningEnabled?: boolean } = await req.json();

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
          throw new Error('Invalid messages format');
        }

        await handleRateLimiting(user.id, model);
        await validateAndUpdateSession(supabase, chatId, user.id, messages);

        const systemPrompt = await fetchSystemPrompt(supabase, user.id);
        const provider = getProviderFromModel(model);
        
        // Process messages with image conversion - 비동기 처리로 변경
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

        // Check if the model supports reasoning
        const modelConfig = getModelById(model);
        const supportsReasoning = modelConfig?.reasoning?.enabled || false;

        // Prepare provider options
        const providerOptions: any = {};
        if (supportsReasoning) {
          providerOptions.anthropic = {
            thinking: {
              type: isReasoningEnabled ? 'enabled' : 'disabled',
              budgetTokens: modelConfig?.reasoning?.budgetTokens || 12000
            }
          };
        }

        const result = streamText({
          model: providers.languageModel(model),
          messages: [
            { role: 'system', content: systemPrompt },
            ...processMessages as unknown as Message[]
          ],
          temperature: 0.7,
          maxTokens: 4000,
          providerOptions,
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
              console.log('[Debug] Rate limit error:', errorData);
              dataStream.write(errorData.message);
              return;
            }
          } catch (e) {
            // If parsing fails, treat it as a regular error
          }
        } else {
          dataStream.writeMessageAnnotation({
            type: 'error',
            data: {
              message: 'An unknown error occurred',
              details: error ? JSON.stringify(error) : null
            }
          });
        }
      }
    }
  });
}