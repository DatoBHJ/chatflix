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
          return null;
        }
      }
    }
    
    if (url.startsWith('http') || url.startsWith('https')) {
      const response = await fetch(url);
      if (!response.ok) {
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
    return null;
  }
};

export const convertMessageForAI = async (
  message: Message, 
  modelId: string, 
  supabase?: any, 
  contextFilter?: {
    calculationSteps?: boolean;
    webSearchResults?: boolean;
    linkReaderAttempts?: boolean;
    youtubeLinkAnalysisResults?: boolean;
    youtubeSearchResults?: boolean;
    academicSearchResults?: boolean;
    structuredResponse?: boolean;
    generatedImages?: boolean;
  }
): Promise<{ role: MessageRole; content: string | AIMessageContent[]; tool_results?: any }> => {
  const modelConfig = getModelById(modelId);
  if (!modelConfig) throw new Error('Invalid model');

  // Helper function to safely convert any value to string
  const safeStringify = (value: any): string => {
    if (value === null || value === undefined) {
      return 'N/A';
    }
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    if (typeof value === 'object') {
      // Try to extract meaningful text from common object properties
      if (value.text) return String(value.text);
      if (value.content) return String(value.content);
      if (value.message) return String(value.message);
      if (value.description) return String(value.description);
      if (value.summary) return String(value.summary);
      // If no meaningful text property, stringify the object
      try {
        return JSON.stringify(value);
      } catch (error) {
        return '[Object - could not stringify]';
      }
    }
    return String(value);
  };

  // Check model capabilities
  const supportsVision = modelConfig.supportsVision;
  const supportsPDFs = modelConfig.supportsPDFs;

  // Check for various tool results
  const toolResults = (message as any).tool_results;
  
  // Apply context filter if provided
  const hasStructuredResponse = contextFilter ? 
    (contextFilter.structuredResponse && toolResults?.structuredResponse?.response?.files?.length > 0) :
    (toolResults?.structuredResponse?.response?.files?.length > 0);
    
  const hasWebSearchResults = contextFilter ?
    (contextFilter.webSearchResults && toolResults?.webSearchResults?.length > 0) :
    (toolResults?.webSearchResults?.length > 0);
    
  const hasCalculationSteps = contextFilter ?
    (contextFilter.calculationSteps && toolResults?.calculationSteps?.length > 0) :
    (toolResults?.calculationSteps?.length > 0);
    
  const hasLinkReaderAttempts = contextFilter ?
    (contextFilter.linkReaderAttempts && toolResults?.linkReaderAttempts?.length > 0) :
    (toolResults?.linkReaderAttempts?.length > 0);
    
  const hasGeneratedImages = contextFilter ?
    (contextFilter.generatedImages && toolResults?.generatedImages?.length > 0) :
    (toolResults?.generatedImages?.length > 0);
    
  const hasAcademicSearchResults = contextFilter ?
    (contextFilter.academicSearchResults && toolResults?.academicSearchResults?.length > 0) :
    (toolResults?.academicSearchResults?.length > 0);
    
  const hasYoutubeSearchResults = contextFilter ?
    (contextFilter.youtubeSearchResults && toolResults?.youtubeSearchResults?.length > 0) :
    (toolResults?.youtubeSearchResults?.length > 0);
    
  const hasYoutubeLinkAnalysis = contextFilter ?
    (contextFilter.youtubeLinkAnalysisResults && toolResults?.youtubeLinkAnalysisResults?.length > 0) :
    (toolResults?.youtubeLinkAnalysisResults?.length > 0);

  const hasAnyToolResults = hasStructuredResponse || hasWebSearchResults || hasCalculationSteps || 
                           hasLinkReaderAttempts || hasGeneratedImages || hasAcademicSearchResults ||
                           hasYoutubeSearchResults || hasYoutubeLinkAnalysis;
  
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

  // 🔧 FIX: Check if message content contains images or files
  const hasMultiModalContent = Array.isArray(message.content) && 
    message.content.some(part => part.type === 'image' || part.type === 'file');

  if (!experimental_attachments.length && !hasAnyToolResults && !hasMultiModalContent) {
    return {
      role: message.role as MessageRole,
      content: message.content,
      // 🆕 Include tool_results even when no processing is needed
      ...(toolResults && { tool_results: toolResults })
    };
  }

  const parts: AIMessageContent[] = [];
  
  // 🔧 FIX: Handle multimodal content in message.content
  if (message.content) {
    if (typeof message.content === 'string') {
      parts.push({
        type: 'text',
        text: message.content
      });
    } else if (Array.isArray(message.content)) {
      // Process each part of the multimodal content
      (message.content as any[]).forEach((part: any) => {
        if (part.type === 'text') {
          parts.push({
            type: 'text',
            text: part.text || ''
          });
        } else if (part.type === 'image' && supportsVision) {
          // 🔧 FIX: Preserve image data instead of converting to text
          parts.push({
            type: 'image',
            image: part.image
          });
        } else if (part.type === 'file') {
          // Handle file content
          if (part.file) {
            const fileName = part.file.name || 'Unnamed file';
            const fileType = part.file.contentType || 'Unknown';
            
            if (supportsPDFs && (fileType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf'))) {
              // Handle PDF files
              parts.push({
                type: 'file',
                data: part.file.data || part.file.content,
                mimeType: 'application/pdf'
              });
            } else {
              // Handle other files as text
              parts.push({
                type: 'text',
                text: `\n\nFile: ${fileName}\nType: ${fileType}\nContent: ${part.file.content || part.file.data || '[File content not available]'}\n`
              });
            }
          }
        }
      });
    } else {
      parts.push({
        type: 'text',
        text: 'Content not available'
      });
    }
  }

  // PRIORITY 1: Calculation results (highly relevant for conversation continuity)
  if (hasCalculationSteps) {
    let calculationText = '\n\n### Previous Calculation Results:\n';
    
    // Include ALL calculations with full explanations
    toolResults.calculationSteps.forEach((step: any, index: number) => {
      calculationText += `\n**Calculation ${index + 1}:**\n`;
      calculationText += `Expression: ${safeStringify(step.expression)}\n`;
      calculationText += `Result: ${safeStringify(step.result)}\n`;
      if (step.explanation) {
        // Include full explanation without truncation
        const explanationText = safeStringify(step.explanation);
        calculationText += `Explanation: ${explanationText}\n`;
      }
    });
    
    parts.push({
      type: 'text',
      text: calculationText
    });
  }

  // PRIORITY 2: Web search results (very relevant for information continuity)
  if (hasWebSearchResults) {
    let formattedResults = '\n\n### Previous Web Search Results:\n';
    
    // Include ALL search groups with ALL results
    toolResults.webSearchResults.forEach((searchGroup: any, index: number) => {
      if (searchGroup.searches && searchGroup.searches.length > 0) {
        // Include ALL searches per group
        searchGroup.searches.forEach((search: any, searchIndex: number) => {
          const query = safeStringify(search.query);
          formattedResults += `\n## Search ${index + 1}.${searchIndex + 1}: "${query}"\n`;
          
          if (search.results && search.results.length > 0) {
            // Include ALL results per search
            search.results.forEach((result: any, resultIndex: number) => {
              const title = safeStringify(result.title);
              const url = safeStringify(result.url);
              formattedResults += `\n### Result ${resultIndex + 1}: ${title}\n`;
              formattedResults += `URL: ${url}\n`;
              // Include FULL content without truncation
              const content = safeStringify(result.content || result.snippet || 'No content available');
              formattedResults += `${content}\n`;
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

  // PRIORITY 3: Link analysis results (very relevant for conversation)
  if (hasLinkReaderAttempts) {
    let linkText = '\n\n### Previous Link Analysis Results:\n';
    
    // Include ALL attempts
    toolResults.linkReaderAttempts.forEach((attempt: any, index: number) => {
      const url = safeStringify(attempt.url);
      const status = safeStringify(attempt.status);
      linkText += `\n**Link ${index + 1}:** ${url}\n`;
      linkText += `Status: ${status}\n`;
      if (attempt.title) {
        const title = safeStringify(attempt.title);
        linkText += `Title: ${title}\n`;
      }
      if (attempt.content) {
        // Include FULL content without truncation
        const content = safeStringify(attempt.content);
        linkText += `Content: ${content}\n`;
      }
    });
    
    parts.push({
      type: 'text',
      text: linkText
    });
  }

  // PRIORITY 4: YouTube analysis results (very relevant for conversation)
  if (hasYoutubeLinkAnalysis) {
    let analysisText = '\n\n### Previous YouTube Video Analysis:\n';
    
    // Include ALL analyses
    toolResults.youtubeLinkAnalysisResults.forEach((analysis: any, index: number) => {
      analysisText += `\n**Video Analysis ${index + 1}:**\n`;
      analysisText += `URL: ${safeStringify(analysis.url)}\n`;
      analysisText += `Title: ${safeStringify(analysis.title)}\n`;
      if (analysis.transcript) {
        // Include FULL transcript without truncation
        const transcriptText = safeStringify(analysis.transcript);
        analysisText += `Transcript: ${transcriptText}\n`;
      }
      if (analysis.summary) {
        // Include FULL summary without truncation
        const summaryText = safeStringify(analysis.summary);
        analysisText += `Summary: ${summaryText}\n`;
      }
    });
    
    parts.push({
      type: 'text',
      text: analysisText
    });
  }

  // PRIORITY 5: YouTube search results (relevant for conversation)
  if (hasYoutubeSearchResults) {
    let youtubeText = '\n\n### Previous YouTube Search Results:\n';
    
    // Include ALL results
    toolResults.youtubeSearchResults.forEach((result: any, index: number) => {
      youtubeText += `\n**Video ${index + 1}:**\n`;
      youtubeText += `Title: ${safeStringify(result.title)}\n`;
      youtubeText += `Channel: ${safeStringify(result.channel)}\n`;
      youtubeText += `URL: ${safeStringify(result.url)}\n`;
      if (result.description) {
        // Include FULL description without truncation
        const descText = safeStringify(result.description);
        youtubeText += `Description: ${descText}\n`;
      }
    });
    
    parts.push({
      type: 'text',
      text: youtubeText
    });
  }

  // PRIORITY 6: Academic search results (moderately relevant)
  if (hasAcademicSearchResults) {
    let academicText = '\n\n### Previous Academic Search Results:\n';
    
    // Include ALL results
    toolResults.academicSearchResults.forEach((result: any, index: number) => {
      academicText += `\n**Paper ${index + 1}:**\n`;
      academicText += `Title: ${safeStringify(result.title)}\n`;
      academicText += `Authors: ${safeStringify(result.authors)}\n`;
      if (result.abstract) {
        // Include FULL abstract without truncation
        const abstractText = safeStringify(result.abstract);
        academicText += `Abstract: ${abstractText}\n`;
      }
      academicText += `URL: ${safeStringify(result.url)}\n`;
    });
    
    parts.push({
      type: 'text',
      text: academicText
    });
  }

  // PRIORITY 7: Generated files (include ALL files with FULL content)
  if (hasStructuredResponse) {
    const structuredResponse = toolResults.structuredResponse.response;
    if (structuredResponse.files && structuredResponse.files.length > 0) {
      // Include ALL files with FULL content
      const filesSection = structuredResponse.files.map((file: any) => {
        const fileName = safeStringify(file.name);
        const content = safeStringify(file.content);
        // Include FULL file content without truncation
        return `\n\n--- ${fileName} ---\n${content}\n`;
      }).join('\n');
      
      parts.push({
        type: 'text',
        text: `\n\n### Previously Generated Files:\n${filesSection}`
      });
    }
  }

  // PRIORITY 8: Generated images (include ALL images with FULL information)
  if (hasGeneratedImages) {
    let imageText = '\n\n### Previously Generated Images:\n';
    
    // Include ALL images
    toolResults.generatedImages.forEach((image: any, index: number) => {
      imageText += `\n**Image ${index + 1}:**\n`;
      // Include FULL prompt without truncation
      const promptText = safeStringify(image.prompt || 'N/A');
      imageText += `Prompt: ${promptText}\n`;
      imageText += `URL: ${safeStringify(image.url)}\n`;
      if (image.description) {
        // Include FULL description without truncation
        const descText = safeStringify(image.description);
        imageText += `Description: ${descText}\n`;
      }
    });
    
    parts.push({
      type: 'text',
      text: imageText
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
          // console.error(`Error fetching content for ${fileName}:`, error);
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
      // console.log(`Processing ${pdfAttachments.length} PDF attachments`);
      
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
            // console.log(`Added PDF "${fileName}" as file type`);
          } else {
            // Fallback: just mention the PDF
            parts.push({
              type: 'text',
              text: `\n\nPDF Document: ${fileName} (Could not process the PDF content)\n`
            });
            // console.log(`Could not process PDF "${fileName}"`);
          }
        } catch (error) {
          // console.error(`Error processing PDF ${fileName}:`, error);
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
    content: parts,
    // 🆕 Include tool_results in the return value
    ...(toolResults && { tool_results: toolResults })
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
        
        // 🆕 새로운 token_usage 칼럼에서 토큰 사용량 정보 로드
        if (dbMessage.token_usage) {
          (messages[index] as any).token_usage = dbMessage.token_usage;
          
          // console.log('📊 [SESSION SYNC] Loaded message with token usage from dedicated column:', {
          //   messageId: msg.id.substring(0, 8),
          //   totalTokens: dbMessage.token_usage.totalTokens,
          //   promptTokens: dbMessage.token_usage.promptTokens,
          //   completionTokens: dbMessage.token_usage.completionTokens
          // });
        }
        
        // Include tool_results from the database message
        if (dbMessage.tool_results) {
          (messages[index] as any).tool_results = dbMessage.tool_results;
          
          // 🆕 백워드 호환성: tool_results에 token_usage가 있고 dedicated column에 없는 경우 처리
          if (dbMessage.tool_results.token_usage && !dbMessage.token_usage) {
            (messages[index] as any).token_usage = dbMessage.tool_results.token_usage;
            
            // console.log('📊 [SESSION SYNC] Loaded message with token usage from tool_results (legacy):', {
            //   messageId: msg.id.substring(0, 8),
            //   totalTokens: dbMessage.tool_results.token_usage.totalTokens,
            //   promptTokens: dbMessage.tool_results.token_usage.promptTokens,
            //   completionTokens: dbMessage.tool_results.token_usage.completionTokens
            // });
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
export function convertMultiModalToMessage(
  messages: MultiModalMessage[], 
  contextFilter?: {
    calculationSteps?: boolean;
    webSearchResults?: boolean;
    linkReaderAttempts?: boolean;
    youtubeLinkAnalysisResults?: boolean;
    youtubeSearchResults?: boolean;
    academicSearchResults?: boolean;
    structuredResponse?: boolean;
    generatedImages?: boolean;
  }
): Message[] {
  const result = messages.map(msg => {
    // If a contextFilter is provided, decide whether to include the tool_results
    if (contextFilter && (msg as any).tool_results) {
      const toolResults = (msg as any).tool_results;
      const filteredToolResults: any = {};
      
      if (contextFilter.calculationSteps && toolResults.calculationSteps) filteredToolResults.calculationSteps = toolResults.calculationSteps;
      if (contextFilter.webSearchResults && toolResults.webSearchResults) filteredToolResults.webSearchResults = toolResults.webSearchResults;
      if (contextFilter.linkReaderAttempts && toolResults.linkReaderAttempts) filteredToolResults.linkReaderAttempts = toolResults.linkReaderAttempts;
      if (contextFilter.youtubeLinkAnalysisResults && toolResults.youtubeLinkAnalysisResults) filteredToolResults.youtubeLinkAnalysisResults = toolResults.youtubeLinkAnalysisResults;
      if (contextFilter.youtubeSearchResults && toolResults.youtubeSearchResults) filteredToolResults.youtubeSearchResults = toolResults.youtubeSearchResults;
      if (contextFilter.academicSearchResults && toolResults.academicSearchResults) filteredToolResults.academicSearchResults = toolResults.academicSearchResults;
      if (contextFilter.structuredResponse && toolResults.structuredResponse) filteredToolResults.structuredResponse = toolResults.structuredResponse;
      if (contextFilter.generatedImages && toolResults.generatedImages) filteredToolResults.generatedImages = toolResults.generatedImages;

      // If any relevant tool results were found, include them. Otherwise, omit tool_results.
      if (Object.keys(filteredToolResults).length > 0) {
        (msg as any).tool_results = filteredToolResults;
      } else {
        delete (msg as any).tool_results;
      }
    }

    // Convert the message content
    let content: string | any[];
    
    // 🔧 FIX: Preserve multimodal content instead of converting to text
    if (Array.isArray(msg.content)) {
      // Check if content contains images or files that should be preserved
      const hasVisualContent = msg.content.some(part => part.type === 'image' || part.type === 'file');
      
      if (hasVisualContent) {
        // Preserve the multimodal structure for AI models
        content = msg.content.map(part => {
          switch (part.type) {
            case 'text':
              return { type: 'text', text: part.text || '' };
            case 'image':
              return { type: 'image', image: (part as any).image };
            case 'file':
              return { 
                type: 'file', 
                data: (part as any).data,
                mimeType: (part as any).mimeType
              };
            default:
              return part;
          }
        });
      } else {
        // If no visual content, convert to text as before
        const parts: string[] = [];
        
        msg.content.forEach(part => {
          switch (part.type) {
            case 'text':
              parts.push(part.text || '');
              break;
            default:
              parts.push(JSON.stringify(part));
          }
        });
        
        content = parts.join('\n');
      }
    } else {
      content = msg.content;
    }
    
    // 기본 메시지 객체 생성
    const baseMessage: any = {
      id: msg.id,
      role: msg.role === 'data' ? 'function' : msg.role, // 'data' 역할을 'function'으로 변환
      content: content
    };
    
    return baseMessage as Message; // Return as Message type
  });

  // 디버깅 로그 출력
  if (contextFilter) {
    // console.log('🔧 [TOOL RESULTS DEBUG]', {
    //   totalMessages: toolResultsStats.totalMessages,
    //   messagesWithToolResults: toolResultsStats.messagesWithToolResults,
    //   includedAfterFilter: toolResultsStats.includedToolResults,
    //   includedToolTypes: [...new Set(toolResultsStats.toolTypes)],
    //   filterEnabled: Object.entries(contextFilter).filter(([k,v]) => k !== 'reasoning' && v).map(([k]) => k)
    // });
  }

  return result;
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
    // 🔧 MEDIUM PRIORITY OPTIMIZATION: 미리 계산된 토큰 사용
    reservedTokens = (lastUserMessage as any)._tokenCount || estimateMultiModalTokens(lastUserMessage as any);
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
    // 🔧 MEDIUM PRIORITY OPTIMIZATION: 미리 계산된 토큰 사용
    const msgTokens = (message as any)._tokenCount || estimateMultiModalTokens(message as any);
    
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
export function detectImages(message: any): boolean {
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

export function detectPDFs(message: any): boolean {
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

export function detectCodeAttachments(message: any): boolean {
  return Array.isArray(message.experimental_attachments) && 
    message.experimental_attachments.some((attachment: any) => 
      attachment.fileType === 'code' || 
      (attachment.name && attachment.name.match(/\.(js|ts|jsx|tsx|py|java|c|cpp|cs|go|rb|php|html|css|sql|scala|swift|kt|rs|dart|json|xml|yaml|yml)$/i))
    );
}
