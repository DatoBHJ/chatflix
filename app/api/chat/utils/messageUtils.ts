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

  // Check for various tool results
  const toolResults = (message as any).tool_results;
  const hasStructuredResponse = toolResults?.structuredResponse?.response?.files?.length > 0;
  const hasWebSearchResults = toolResults?.webSearchResults?.length > 0;
  const hasCalculationSteps = toolResults?.calculationSteps?.length > 0;
  const hasLinkReaderAttempts = toolResults?.linkReaderAttempts?.length > 0;
  const hasGeneratedImages = toolResults?.generatedImages?.length > 0;
  const hasAcademicSearchResults = toolResults?.academicSearchResults?.length > 0;
  const hasYoutubeSearchResults = toolResults?.youtubeSearchResults?.length > 0;
  const hasYoutubeLinkAnalysis = toolResults?.youtubeLinkAnalysisResults?.length > 0;
  const hasAgentReasoning = toolResults?.agentReasoning;
  const hasAnyToolResults = hasStructuredResponse || hasWebSearchResults || hasCalculationSteps || 
                           hasLinkReaderAttempts || hasGeneratedImages || hasAcademicSearchResults ||
                           hasYoutubeSearchResults || hasYoutubeLinkAnalysis || hasAgentReasoning;
  
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

  if (!experimental_attachments.length && !hasAnyToolResults) {
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

  // Include agent reasoning if available
  if (hasAgentReasoning) {
    const reasoning = toolResults.agentReasoning;
    let reasoningText = '\n\n### Previous Agent Reasoning:\n';
    
    if (reasoning.plan) {
      // Limit plan text to 1000 characters
      const planText = reasoning.plan.length > 1000 ? reasoning.plan.substring(0, 1000) + '...' : reasoning.plan;
      reasoningText += `**Plan:** ${planText}\n\n`;
    }
    if (reasoning.agentThoughts) {
      // Limit thoughts text to 500 characters
      const thoughtsText = reasoning.agentThoughts.length > 500 ? reasoning.agentThoughts.substring(0, 500) + '...' : reasoning.agentThoughts;
      reasoningText += `**Analysis:** ${thoughtsText}\n\n`;
    }
    if (reasoning.workflowMode) {
      reasoningText += `**Workflow Mode:** ${reasoning.workflowMode}\n`;
    }
    if (reasoning.selectedTools && reasoning.selectedTools.length > 0) {
      reasoningText += `**Tools Used:** ${reasoning.selectedTools.join(', ')}\n`;
    }
    
    parts.push({
      type: 'text',
      text: reasoningText
    });
  }

  // Include calculation steps if available (high priority)
  if (hasCalculationSteps) {
    let calculationText = '\n\n### Previous Calculation Results:\n';
    
    // Limit to last 5 calculations to prevent overflow
    const recentCalculations = toolResults.calculationSteps.slice(-5);
    recentCalculations.forEach((step: any, index: number) => {
      calculationText += `\n**Calculation ${index + 1}:**\n`;
      calculationText += `Expression: ${step.expression || 'N/A'}\n`;
      calculationText += `Result: ${step.result || 'N/A'}\n`;
      if (step.explanation) {
        // Limit explanation to 200 characters
        const explanationText = step.explanation.length > 200 ? step.explanation.substring(0, 200) + '...' : step.explanation;
        calculationText += `Explanation: ${explanationText}\n`;
      }
    });
    
    parts.push({
      type: 'text',
      text: calculationText
    });
  }

  // Include structured response files if available (high priority)
  if (hasStructuredResponse) {
    const structuredResponse = toolResults.structuredResponse.response;
    if (structuredResponse.files && structuredResponse.files.length > 0) {
      // Limit to last 3 files and truncate content if too long
      const recentFiles = structuredResponse.files.slice(-3);
      const filesSection = recentFiles.map((file: any) => {
        let content = file.content;
        // Limit file content to 2000 characters
        if (content && content.length > 2000) {
          content = content.substring(0, 2000) + '...\n[Content truncated for context efficiency]';
        }
        return `\n\n--- ${file.name} ---\n${content}\n`;
      }).join('\n');
      
      parts.push({
        type: 'text',
        text: `\n\n### Previously Generated Files:\n${filesSection}`
      });
    }
  }
  
  // Include web search results if available (medium priority)
  if (hasWebSearchResults) {
    let formattedResults = '\n\n### Previous Web Search Results:\n';
    
    // Limit to last 2 search groups to prevent overflow
    const recentSearches = toolResults.webSearchResults.slice(-2);
    recentSearches.forEach((searchGroup: any, index: number) => {
      if (searchGroup.searches && searchGroup.searches.length > 0) {
        // Limit to first 2 searches per group
        const limitedSearches = searchGroup.searches.slice(0, 2);
        limitedSearches.forEach((search: any, searchIndex: number) => {
          formattedResults += `\n## Search ${index + 1}.${searchIndex + 1}: "${search.query}"\n`;
          
          if (search.results && search.results.length > 0) {
            // Limit to first 3 results per search
            const limitedResults = search.results.slice(0, 3);
            limitedResults.forEach((result: any, resultIndex: number) => {
              formattedResults += `\n### Result ${resultIndex + 1}: ${result.title || 'No Title'}\n`;
              formattedResults += `URL: ${result.url || 'No URL'}\n`;
              // Limit content to 300 characters
              const content = result.content || result.snippet || 'No content available';
              const limitedContent = content.length > 300 ? content.substring(0, 300) + '...' : content;
              formattedResults += `${limitedContent}\n`;
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

  // Include link reader attempts if available (medium priority)
  if (hasLinkReaderAttempts) {
    let linkText = '\n\n### Previous Link Analysis Results:\n';
    
    // Limit to last 3 attempts
    const recentAttempts = toolResults.linkReaderAttempts.slice(-3);
    recentAttempts.forEach((attempt: any, index: number) => {
      linkText += `\n**Link ${index + 1}:** ${attempt.url}\n`;
      linkText += `Status: ${attempt.status}\n`;
      if (attempt.title) {
        linkText += `Title: ${attempt.title}\n`;
      }
      if (attempt.content) {
        // Limit content to 400 characters
        const limitedContent = attempt.content.length > 400 ? attempt.content.substring(0, 400) + '...' : attempt.content;
        linkText += `Content: ${limitedContent}\n`;
      }
    });
    
    parts.push({
      type: 'text',
      text: linkText
    });
  }

  // Include generated images if available (lower priority)
  if (hasGeneratedImages) {
    let imageText = '\n\n### Previously Generated Images:\n';
    
    // Limit to last 3 images
    const recentImages = toolResults.generatedImages.slice(-3);
    recentImages.forEach((image: any, index: number) => {
      imageText += `\n**Image ${index + 1}:**\n`;
      // Limit prompt to 200 characters
      const promptText = image.prompt && image.prompt.length > 200 ? image.prompt.substring(0, 200) + '...' : (image.prompt || 'N/A');
      imageText += `Prompt: ${promptText}\n`;
      imageText += `URL: ${image.url || 'N/A'}\n`;
      if (image.description) {
        // Limit description to 150 characters
        const descText = image.description.length > 150 ? image.description.substring(0, 150) + '...' : image.description;
        imageText += `Description: ${descText}\n`;
      }
    });
    
    parts.push({
      type: 'text',
      text: imageText
    });
  }

  // Include academic search results if available (lower priority)
  if (hasAcademicSearchResults) {
    let academicText = '\n\n### Previous Academic Search Results:\n';
    
    // Limit to last 3 results
    const recentResults = toolResults.academicSearchResults.slice(-3);
    recentResults.forEach((result: any, index: number) => {
      academicText += `\n**Paper ${index + 1}:**\n`;
      academicText += `Title: ${result.title || 'N/A'}\n`;
      academicText += `Authors: ${result.authors || 'N/A'}\n`;
      if (result.abstract) {
        // Limit abstract to 250 characters
        const abstractText = result.abstract.length > 250 ? result.abstract.substring(0, 250) + '...' : result.abstract;
        academicText += `Abstract: ${abstractText}\n`;
      }
      academicText += `URL: ${result.url || 'N/A'}\n`;
    });
    
    parts.push({
      type: 'text',
      text: academicText
    });
  }

  // Include YouTube search results if available (lower priority)
  if (hasYoutubeSearchResults) {
    let youtubeText = '\n\n### Previous YouTube Search Results:\n';
    
    // Limit to last 3 results
    const recentResults = toolResults.youtubeSearchResults.slice(-3);
    recentResults.forEach((result: any, index: number) => {
      youtubeText += `\n**Video ${index + 1}:**\n`;
      youtubeText += `Title: ${result.title || 'N/A'}\n`;
      youtubeText += `Channel: ${result.channel || 'N/A'}\n`;
      youtubeText += `URL: ${result.url || 'N/A'}\n`;
      if (result.description) {
        // Limit description to 150 characters
        const descText = result.description.length > 150 ? result.description.substring(0, 150) + '...' : result.description;
        youtubeText += `Description: ${descText}\n`;
      }
    });
    
    parts.push({
      type: 'text',
      text: youtubeText
    });
  }

  // Include YouTube link analysis if available (lower priority)
  if (hasYoutubeLinkAnalysis) {
    let analysisText = '\n\n### Previous YouTube Video Analysis:\n';
    
    // Limit to last 2 analyses
    const recentAnalyses = toolResults.youtubeLinkAnalysisResults.slice(-2);
    recentAnalyses.forEach((analysis: any, index: number) => {
      analysisText += `\n**Video Analysis ${index + 1}:**\n`;
      analysisText += `URL: ${analysis.url || 'N/A'}\n`;
      analysisText += `Title: ${analysis.title || 'N/A'}\n`;
      if (analysis.transcript) {
        // Limit transcript to 400 characters
        const transcriptText = analysis.transcript.length > 400 ? analysis.transcript.substring(0, 400) + '...' : analysis.transcript;
        analysisText += `Transcript: ${transcriptText}\n`;
      }
      if (analysis.summary) {
        // Limit summary to 200 characters
        const summaryText = analysis.summary.length > 200 ? analysis.summary.substring(0, 200) + '...' : analysis.summary;
        analysisText += `Summary: ${summaryText}\n`;
      }
    });
    
    parts.push({
      type: 'text',
      text: analysisText
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