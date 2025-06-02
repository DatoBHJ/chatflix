import { Message } from 'ai';
import { AIMessageContent, MessageRole, MultiModalMessage } from '../types';
import { getModelById } from '@/lib/models/config';
import { providers } from '@/lib/providers';
import { estimateMultiModalTokens, isAttachmentsHeavy } from '../services/modelSelector';

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

  // Check model capabilities
  const supportsVision = modelConfig.supportsVision;
  const supportsPDFs = modelConfig.supportsPDFs;

  // Check if the message has tool_results with structuredResponse
  const hasToolResults = (message as any).tool_results?.structuredResponse?.response?.files?.length > 0;
  // Check if the message has web search results
  const hasWebSearchResults = (message as any).tool_results?.webSearchResults?.length > 0;
  
  // Ensure experimental_attachments is always an array
  let experimental_attachments = message.experimental_attachments || [];

  // If model doesn't support vision or PDF, filter out unsupported attachments
  if (!supportsVision || !supportsPDFs) {
    experimental_attachments = experimental_attachments.filter(attachment => {
      // Remove images if vision not supported
      if (!supportsVision && (attachment.contentType?.startsWith('image/') || 
                             (attachment as any).fileType === 'image')) {
        return false;
      }

      // Remove PDFs if PDF support not supported
      if (!supportsPDFs && (attachment.contentType === 'application/pdf' || 
                           (attachment.name && attachment.name.toLowerCase().endsWith('.pdf')) ||
                           (attachment as any).fileType === 'pdf')) {
        return false;
      }

      return true;
    });
  }

  if (!experimental_attachments.length && !hasToolResults && !hasWebSearchResults) {
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

  // Always include structured response files from tool_results if available
  if (hasToolResults) {
    const structuredResponse = (message as any).tool_results.structuredResponse.response;
    if (structuredResponse.files && structuredResponse.files.length > 0) {
      const filesSection = structuredResponse.files.map((file: any) => {
        return `\n\n--- ${file.name} ---\n${file.content}\n`;
      }).join('\n');
      
      parts.push({
        type: 'text',
        text: `\n\n### Generated Files:\n${filesSection}`
      });
    }
  }
  
  // Include web search results if available
  if (hasWebSearchResults) {
    const webSearchResults = (message as any).tool_results.webSearchResults;
    
    // Format web search results for inclusion in the conversation context
    let formattedResults = '\n\n### Web Search Results:\n';
    
    webSearchResults.forEach((searchGroup: any, index: number) => {
      if (searchGroup.searches && searchGroup.searches.length > 0) {
        searchGroup.searches.forEach((search: any, searchIndex: number) => {
          formattedResults += `\n## Search ${index + 1}.${searchIndex + 1}: "${search.query}"\n`;
          
          if (search.results && search.results.length > 0) {
            search.results.forEach((result: any, resultIndex: number) => {
              formattedResults += `\n### Result ${resultIndex + 1}: ${result.title || 'No Title'}\n`;
              formattedResults += `URL: ${result.url || 'No URL'}\n`;
              formattedResults += `${result.content || result.snippet || 'No content available'}\n`;
            });
          } else {
            formattedResults += `No results found for this query.\n`;
          }
        });
      }
    });
    
    parts.push({
      type: 'text',
      text: formattedResults
    });
  }

  // Only add images if vision is supported
  if (supportsVision) {
    experimental_attachments
      .filter(attachment => attachment.contentType?.startsWith('image/'))
      .forEach(attachment => {
        parts.push({
          type: 'image',
          image: attachment.url
        });
      });
  }
  
  const textAttachments = experimental_attachments
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
  
  // Only handle PDFs if the model supports them
  if (supportsPDFs) {
    const pdfAttachments = experimental_attachments.filter(attachment => 
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
  }
  
  const otherAttachments = experimental_attachments
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
        // Include tool_results from the database message
        if (dbMessage.tool_results) {
          (messages[index] as any).tool_results = dbMessage.tool_results;
          
          // 🆕 토큰 사용량 정보가 있으면 로그 출력
          if (dbMessage.tool_results.token_usage) {
            const msgId = (msg as any).id || 'unknown';
            console.log('📊 [SESSION SYNC] Loaded message with token usage:', {
              messageId: msgId.substring(0, 8),
              totalTokens: dbMessage.tool_results.token_usage.totalTokens,
              promptTokens: dbMessage.tool_results.token_usage.promptTokens,
              completionTokens: dbMessage.tool_results.token_usage.completionTokens
            });
          }
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
    let content: string;
    
    // content가 AIMessageContent[] 타입인 경우 모든 내용을 텍스트로 변환
    if (Array.isArray(msg.content)) {
      const parts: string[] = [];
      
      msg.content.forEach(part => {
        switch (part.type) {
          case 'text':
            parts.push(part.text || '');
            break;
          case 'image':
            parts.push(`[IMAGE: ${(part as any).image || 'Image content'}]`);
            break;
          case 'file':
            parts.push(`[FILE: ${(part as any).data ? 'File data included' : 'File content'}]`);
            break;
          default:
            // 기타 모든 타입을 문자열로 변환
            parts.push(JSON.stringify(part));
        }
      });
      
      content = parts.join('\n');
    } else {
      content = msg.content;
    }
    
    // 기본 메시지 객체 생성
    const baseMessage: any = {
      id: msg.id,
      role: msg.role === 'data' ? 'function' : msg.role, // 'data' 역할을 'function'으로 변환
      content: content
    };
    
    // tool_results가 있으면 포함
    if ((msg as any).tool_results) {
      baseMessage.tool_results = (msg as any).tool_results;
    }
    
    return baseMessage as Message;
  });
}

/**
 * 토큰 제한 내에서 메시지 선택
 */
export function selectMessagesWithinTokenLimit(
  messages: MultiModalMessage[], 
  maxTokens: number, 
  isAttachmentsHeavyOverride?: boolean
): MultiModalMessage[] {
  let tokenCount = 0;
  const selectedMessages: MultiModalMessage[] = [];
  
  // 🆕 첨부파일 무거움 판단 (공통 함수 사용)
  const hasImage = messages.some(msg => detectImages(msg));
  const hasPDF = messages.some(msg => detectPDFs(msg));
  const hasCodeAttachment = messages.some(msg => detectCodeAttachments(msg));
  
  // 오버라이드가 제공되면 사용, 아니면 자동 판단
  const isHeavy = isAttachmentsHeavyOverride !== undefined 
    ? isAttachmentsHeavyOverride 
    : isAttachmentsHeavy(messages as any[], hasImage, hasPDF, hasCodeAttachment);
  
  // 파일 첨부물이 많은 경우 추가 안전 마진 적용
  const safetyMargin = isHeavy ? 0.7 : 0.85; // 70% 또는 85%만 사용
  const adjustedMaxTokens = Math.floor(maxTokens * safetyMargin);
    
  // 필수 포함 메시지 (마지막 사용자 메시지는 항상 포함)
  const lastUserMessageIndex = [...messages].reverse().findIndex(msg => msg.role === 'user');
  const lastUserMessage = lastUserMessageIndex >= 0 ? messages[messages.length - 1 - lastUserMessageIndex] : null;
  
  // 필수 메시지의 토큰 수 계산
  let reservedTokens = 0;
  if (lastUserMessage) {
    // 🆕 공통 함수 사용
    reservedTokens = estimateMultiModalTokens(lastUserMessage as any);
  }
  
  // 실제 사용 가능한 토큰 수 계산
  const availableTokens = adjustedMaxTokens - reservedTokens;
  
  // 최신 메시지부터 역순으로 추가 (중요 대화 컨텍스트 보존)
  const reversedMessages = [...messages].reverse();
  
  // 마지막 사용자 메시지는 별도로 처리했으므로 제외
  const remainingMessages = lastUserMessage 
    ? reversedMessages.filter(msg => msg.id !== lastUserMessage.id)
    : reversedMessages;
  
  // 남은 메시지들에 대해 토큰 계산 및 선택
  for (const message of remainingMessages) {
    // 🆕 공통 함수 사용
    const msgTokens = estimateMultiModalTokens(message as any);
    
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

// 🆕 감지 함수들 (modelSelector와 동일한 로직)
function detectImages(message: any): boolean {
  if (Array.isArray(message.experimental_attachments)) {
    return message.experimental_attachments.some((attachment: any) => 
      attachment.fileType === 'image' || 
      (attachment.contentType && attachment.contentType.startsWith('image/')) ||
      (attachment.name && attachment.name.match(/\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i))
    );
  }
  
  if (Array.isArray(message.content)) {
    return message.content.some((part: { type: string }) => part.type === 'image') ||
      message.content.some((part: any) => 
        part.type === 'file' && 
        (part.file?.contentType?.startsWith('image/') || 
        part.file?.name?.match(/\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i))
      );
  }
  
  return false;
}

function detectPDFs(message: any): boolean {
  if (Array.isArray(message.experimental_attachments)) {
    return message.experimental_attachments.some((attachment: any) => 
      attachment.fileType === 'pdf' || 
      attachment.contentType === 'application/pdf' ||
      (attachment.name && attachment.name.toLowerCase().endsWith('.pdf'))
    );
  }
  
  if (Array.isArray(message.content)) {
    return message.content.some((part: any) => 
      (part.type === 'file' && part.file?.name?.toLowerCase().endsWith('.pdf')) ||
      (part.type === 'file' && part.file?.contentType === 'application/pdf')
    );
  }
  
  return false;
}

function detectCodeAttachments(message: any): boolean {
  return Array.isArray(message.experimental_attachments) && 
    message.experimental_attachments.some((attachment: any) => 
      attachment.fileType === 'code' || 
      (attachment.name && attachment.name.match(/\.(js|ts|jsx|tsx|py|java|c|cpp|cs|go|rb|php|html|css|sql|scala|swift|kt|rs|dart|json|xml|yaml|yml)$/i))
    );
}