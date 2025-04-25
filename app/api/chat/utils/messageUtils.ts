import { Message } from 'ai';
import { AIMessageContent, MessageRole, MultiModalMessage } from '../types';
import { getModelById } from '@/lib/models/config';
import { providers } from '@/lib/providers';
import { estimateTokenCount } from '@/utils/context-manager';

export const generateMessageId = () => `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export const fetchFileContent = async (url: string, supabase?: any, fileType?: string): Promise<{ text?: string; base64?: string } | null> => {
  try {
    // Special handling for PDFs - always get binary data
    const isPDF = fileType === 'pdf' || url.includes('.pdf') || url.includes('application/pdf');
    
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
          
          if (isPDF) {
            // For PDFs, return base64 encoded data
            const arrayBuffer = await data.arrayBuffer();
            const bytes = new Uint8Array(arrayBuffer);
            const binary = bytes.reduce((acc, byte) => acc + String.fromCharCode(byte), '');
            const base64Data = btoa(binary);
            return { base64: base64Data };
          } else {
            // For text files, return text content
            return { text: await data.text() };
          }
        } catch (err) {
          console.error('Error processing Supabase file:', err);
          return null;
        }
      }
    }
    
    if (url.startsWith('http') || url.startsWith('https')) {
      const response = await fetch(url);
      if (!response.ok) {
        console.error(`Failed to fetch file content: ${response.statusText}`);
        return null;
      }
      
      if (isPDF) {
        // For PDFs, return base64 encoded data
        const arrayBuffer = await response.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        const binary = bytes.reduce((acc, byte) => acc + String.fromCharCode(byte), '');
        const base64Data = btoa(binary);
        return { base64: base64Data };
      } else {
        // For text files, return text content
        return { text: await response.text() };
      }
    }
    else if (url.startsWith('data:')) {
      // Data URLs are already properly formatted, no need to modify
      if (url.includes('base64,')) {
        // Extract base64 part if it's already in that format
        const base64Content = url.split(',')[1];
        if (base64Content) {
          if (isPDF) {
            return { base64: base64Content };
          } else {
            return { text: atob(base64Content) };
          }
        }
      }
    }
    return null;
  } catch (error) {
    console.error('Error fetching file content:', error);
    return null;
  }
};

export const convertMessageForAI = async (message: Message, modelId: string, supabase?: any): Promise<{ role: MessageRole; content: string | AIMessageContent[] }> => {
  const modelConfig = getModelById(modelId);
  if (!modelConfig) throw new Error('Invalid model');

  if (!message.experimental_attachments?.length) {
    return {
      role: message.role as MessageRole,
      content: message.content
    };
  }

  const parts: AIMessageContent[] = [];
  
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

  message.experimental_attachments
    .filter(attachment => attachment.contentType?.startsWith('image/'))
    .forEach(attachment => {
      parts.push({
        type: 'image',
        image: attachment.url
      });
    });
  
  const textAttachments = message.experimental_attachments
    .filter(attachment => {
      return (attachment.contentType?.includes('text') || 
              (attachment as any).fileType === 'code' ||
              (attachment.name && /\.(js|jsx|ts|tsx|html|css|json|md|py|java|c|cpp|cs|go|rb|php|swift|kt|rs)$/i.test(attachment.name || '')));
    });
  
  if (textAttachments.length > 0) {
    const fileContents = await Promise.all(
      textAttachments.map(async (attachment) => {
        const fileName = attachment.name || 'Unnamed file';
        const fileType = (attachment as any).fileType || 'Unknown';
        let content = null;
        
        try {
          const fetchResult = await fetchFileContent(attachment.url, supabase, fileType);
          content = fetchResult?.text || `[Could not fetch content for ${fileName}]`;
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
    
    parts.push({
      type: 'text',
      text: `\n\nAttached files:\n${fileContents.map(file => {
        return `File: ${file.fileName}\nType: ${file.fileType}\n\nContent:\n\`\`\`\n${file.content}\n\`\`\`\n`;
      }).join('\n')}`
    });
  }
  
  // Handle PDFs using proper document format for Claude models
  const pdfAttachments = message.experimental_attachments.filter(attachment => 
    attachment.contentType === 'application/pdf' || 
    (attachment.name && attachment.name.toLowerCase().endsWith('.pdf'))
  );
  
  if (pdfAttachments.length > 0) {
    console.log(`Processing ${pdfAttachments.length} PDF attachments`);
    
    // Process each PDF
    for (const attachment of pdfAttachments) {
      const fileName = attachment.name || 'Unnamed PDF';
      try {
        // Download and convert PDF to base64
        const fileResult = await fetchFileContent(attachment.url, supabase, 'pdf');
        
        if (fileResult?.base64) {
          
          // Add as file type
          parts.push({
            type: 'file',
            data: fileResult.base64,
            mimeType: 'application/pdf'
          });
          console.log(`Added PDF "${fileName}" as file type`);
        } else {
          // Fallback: just mention the PDF
          parts.push({
            type: 'text',
            text: `\n\nPDF Document: ${fileName} (Could not process the PDF content)\n`
          });
          console.log(`Could not process PDF "${fileName}"`);
        }
      } catch (error) {
        console.error(`Error processing PDF ${fileName}:`, error);
        parts.push({
          type: 'text',
          text: `\n\nPDF Document: ${fileName} (Error processing the PDF)\n`
        });
      }
    }
  }
  
  const otherAttachments = message.experimental_attachments
    .filter(attachment => {
      return !attachment.contentType?.startsWith('image/') && 
             !attachment.contentType?.includes('text') && 
             (attachment as any).fileType !== 'code' &&
             attachment.contentType !== 'application/pdf' &&
             !(attachment.name && attachment.name.toLowerCase().endsWith('.pdf'));
    });
  
  if (otherAttachments.length > 0) {
    parts.push({
      type: 'text',
      text: `\n\nOther attached files:\n${otherAttachments.map(attachment => {
        return `File: ${attachment.name || 'Unnamed file'}\nType: ${(attachment as any).fileType || attachment.contentType || 'Unknown'}\n`;
      }).join('\n')}`
    });
  }

  return {
    role: message.role as MessageRole,
    content: parts
  };
}; 

export const validateAndUpdateSession = async (supabase: any, chatId: string | undefined, userId: string, messages: Message[]) => {
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

export const getProviderFromModel = (model: string): string => {
  const selectedModel = providers.languageModel(model);
  return selectedModel?.provider || 'Unknown Provider';
};

// MultiModalMessage를 Message로 변환하는 함수 추가
export function convertMultiModalToMessage(messages: MultiModalMessage[]): Message[] {
  return messages.map(msg => {
    // id, role, content 속성만 포함하도록 변환
    return {
      id: msg.id,
      role: msg.role === 'data' ? 'function' : msg.role, // 'data' 역할을 'function'으로 변환
      content: msg.content
    } as Message;
  });
}

/**
 * 토큰 제한 내에서 메시지 선택
 */
export function selectMessagesWithinTokenLimit(messages: MultiModalMessage[], maxTokens: number, isAttachmentsHeavy: boolean = false): MultiModalMessage[] {
  let tokenCount = 0;
  const selectedMessages: MultiModalMessage[] = [];
  
  // 파일 첨부물이 많은 경우 추가 안전 마진 적용
  const safetyMargin = isAttachmentsHeavy ? 0.7 : 0.85; // 70% 또는 85%만 사용
  const adjustedMaxTokens = Math.floor(maxTokens * safetyMargin);
    
  // 필수 포함 메시지 (마지막 사용자 메시지는 항상 포함)
  const lastUserMessageIndex = [...messages].reverse().findIndex(msg => msg.role === 'user');
  const lastUserMessage = lastUserMessageIndex >= 0 ? messages[messages.length - 1 - lastUserMessageIndex] : null;
  
  // 필수 메시지의 토큰 수 계산
  let reservedTokens = 0;
  if (lastUserMessage) {
    const content = typeof lastUserMessage.content === 'string' ? lastUserMessage.content : JSON.stringify(lastUserMessage.content);
    reservedTokens = estimateTokenCount(content);
  }
  
  // 실제 사용 가능한 토큰 수 계산
  const availableTokens = adjustedMaxTokens - reservedTokens;
  
  // 멀티모달 콘텐츠의 토큰 수 추정 함수
  const estimateMultiModalTokens = (msg: MultiModalMessage): number => {
    // 텍스트 콘텐츠
    if (typeof msg.content === 'string') {
      return estimateTokenCount(msg.content);
    }
    
    // 멀티모달 콘텐츠 (이미지, 파일 등)
    if (Array.isArray(msg.content)) {
      let total = 0;
      
      for (const part of msg.content) {
        if (part.type === 'text') {
          total += estimateTokenCount(part.text || '');
        } else if (part.type === 'image') {
          // 이미지는 약 1000 토큰으로 추정
          total += 1000;
        } else if (part.type === 'file') {
          // 파일 내용에 따라 다르지만 평균적으로 파일당 3000~5000 토큰으로 추정
          total += 5000;
        }
      }
      
      return total;
    }
    
    // 기타 형식
    return estimateTokenCount(JSON.stringify(msg.content));
  };
  
  // 최신 메시지부터 역순으로 추가 (중요 대화 컨텍스트 보존)
  const reversedMessages = [...messages].reverse();
  
  // 마지막 사용자 메시지는 별도로 처리했으므로 제외
  const remainingMessages = lastUserMessage 
    ? reversedMessages.filter(msg => msg.id !== lastUserMessage.id)
    : reversedMessages;
  
  // 남은 메시지들에 대해 토큰 계산 및 선택
  for (const message of remainingMessages) {
    const msgTokens = estimateMultiModalTokens(message);
    
    // 토큰 한도 초과 시 중단
    if (tokenCount + msgTokens > availableTokens) {
      break;
    }
    
    tokenCount += msgTokens;
    selectedMessages.unshift(message); // 원래 순서대로 추가
  }
  
  // 마지막 사용자 메시지 추가 (있는 경우)
  if (lastUserMessage && !selectedMessages.some(msg => msg.id === lastUserMessage.id)) {
    selectedMessages.push(lastUserMessage);
  }
    
  return selectedMessages;
}