import { Message } from 'ai';
import { CompletionResult } from '@/lib/types';
import { generateMessageId } from '../utils/messageUtils';
import { MultiModalMessage, ProcessedMessage } from '../types';

export const fetchSystemPrompt = async (supabase: any, userId: string) => {
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

export const handlePromptShortcuts = async (supabase: any, message: MultiModalMessage | Message, userId: string): Promise<ProcessedMessage> => {
  const processedMessage: ProcessedMessage = {
    id: message.id,
    content: message.content,
    role: message.role as any,
    parts: (message as any).parts
  };

  if (message.role !== 'user') return processedMessage;

  // Handle multimodal messages (array content)
  if (Array.isArray(message.content)) {
    const updatedContent = [...message.content];
    
    // Process each text part in the array
    for (let i = 0; i < updatedContent.length; i++) {
      const part = updatedContent[i];
      if (part.type === 'text' && typeof part.text === 'string') {
        let updatedText = part.text;

        // Process shortcuts and mentions
        try {
          const jsonMatch = updatedText.match(/\{"displayName":"[^"]+","promptContent":"[^"]+"}/g);
          if (jsonMatch) {
            for (const match of jsonMatch) {
              const mentionData = JSON.parse(match);
              updatedText = updatedText.replace(match, mentionData.promptContent);
            }
          } else {
            const match = updatedText.match(/@([\w?!.,_\-+=@#$%^&*()<>{}\[\]|/\\~`]+)/);
            if (match) {
              const shortcutName = match[1];
              const { data: shortcutData, error: shortcutError } = await supabase
                .from('prompt_shortcuts')
                .select('content')
                .eq('user_id', userId)
                .eq('name', shortcutName)
                .single();
              if (!shortcutError && shortcutData) {
                updatedText = updatedText.replace(new RegExp(`@${shortcutName}`), shortcutData.content);
              }
            }
          }
        } catch (error) {
          console.error('[Debug] Error processing mentions:', error);
        }

        // Update the part with processed text
        updatedContent[i] = {
          ...part,
          text: updatedText
        };
      }
    }

    return {
      ...processedMessage,
      content: updatedContent
    };
  } 
  // Handle string content (original implementation)
  else {
    let updatedContent = typeof message.content === 'string' ? message.content : '';

    try {
      const jsonMatch = updatedContent.match(/\{"displayName":"[^"]+","promptContent":"[^"]+"}/g);
      if (jsonMatch) {
        for (const match of jsonMatch) {
          const mentionData = JSON.parse(match);
          updatedContent = updatedContent.replace(match, mentionData.promptContent);
        }
      } else {
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
            updatedContent = updatedContent.replace(new RegExp(`@${shortcutName}`), shortcutData.content);
          }
        }
      }
    } catch (error) {
      console.error('[Debug] Error processing mentions:', error);
    }

    return {
      ...processedMessage,
      content: updatedContent
    };
  }
};

export const saveUserMessage = async (supabase: any, chatId: string | undefined, userId: string, message: MultiModalMessage | Message, model: string) => {
  let messageContent = '';
  let attachments: Array<{
    name?: string;
    contentType?: string;
    url: string;
    path?: string;
    fileType?: 'image' | 'code' | 'pdf' | 'file';
  }> = [];

  if (typeof message.content === 'string') {
    messageContent = message.content;
    attachments = message.experimental_attachments || [];
  } else {
    const textParts = message.content.filter(part => part.type === 'text');
    messageContent = textParts.map(part => part.text).join(' ');
    
    const imageParts = message.content.filter(part => part.type === 'image');
    if (imageParts.length > 0) {
      attachments = imageParts.map(part => ({
        url: (part as any).image || '',
        contentType: 'image/jpeg',
        fileType: 'image' as 'image'
      }));
    } else if (message.experimental_attachments && message.experimental_attachments.length > 0) {
      attachments = message.experimental_attachments;
    }
  }

  const { data: existingMessage } = await supabase
    .from('messages')
    .select('id, sequence_number')
    .eq('chat_session_id', chatId)
    .eq('content', messageContent)
    .eq('role', 'user')
    .eq('user_id', userId)
    .maybeSingle();

  if (existingMessage) return;

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

  const { error } = await supabase.from('messages').insert([messageData]);

  if (error) {
    console.error('[Debug] Error saving message:', error);
  }

  return sequence;
};

export const createOrUpdateAssistantMessage = async (
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

export const handleStreamCompletion = async (
  supabase: any,
  messageId: string,
  userId: string,
  model: string,
  provider: string,
  completion: CompletionResult,
  isRegeneration: boolean = false,
  extraData: any = {}
) => {
  // finalContent 결정 - 우선순위: full_text > steps > parts > text
  let finalContent = '';
  let finalReasoning = '';
  
  if (extraData.full_text) {
    finalContent = extraData.full_text;
  } else if (completion.steps && completion.steps.length > 0) {
    finalContent = completion.steps.map(step => step.text || '').join('\n\n');
    finalReasoning = completion.steps
      .filter(step => step.reasoning)
      .map(step => step.reasoning)
      .join('\n\n');
  } else if (completion.parts) {
    // 텍스트 파트 추출
    finalContent = completion.parts
      .filter(part => part.type === 'text')
      .map(part => part.text)
      .join('\n');
    
    // 추론 파트 추출
    const reasoningParts = completion.parts.filter(part => part.type === 'reasoning') as any[];
    if (reasoningParts.length > 0) {
      finalReasoning = reasoningParts.map(part => part.reasoning).join('\n');
    }
  } else {
    finalContent = completion.text || '';
  }

  // 데이터베이스 업데이트
  await supabase
    .from('messages')
    .update({
      content: finalContent,
      reasoning: finalReasoning && finalReasoning !== finalContent ? finalReasoning : null,
      model,
      host: provider,
      created_at: new Date().toISOString(),
      tool_results: extraData.tool_results || null
    })
    .eq('id', messageId)
    .eq('user_id', userId);
}; 