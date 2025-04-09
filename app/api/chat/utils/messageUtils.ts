import { Message } from 'ai';
import { AIMessageContent, MessageRole } from '../types';
import { getModelById } from '@/lib/models/config';

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