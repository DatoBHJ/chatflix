import { DatabaseMessage } from '@/lib/types';
import { ExtendedMessage } from './types';
import { createClient } from '@/utils/supabase/client';

export const uploadFile = async (file: File) => {
  const supabase = createClient();
  
  // Generate unique file name
  const fileExt = file.name.split('.').pop();
  const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
  const filePath = `${fileName}`;

  // Upload file to Supabase Storage
  const { data, error } = await supabase.storage
    .from('chat_attachments')
    .upload(filePath, file);

  if (error) {
    throw error;
  }

  // Get signed URL that expires in 24 hours
  const { data: signedData, error: signedError } = await supabase.storage
    .from('chat_attachments')
    .createSignedUrl(filePath, 24 * 60 * 60); // 24 hours in seconds

  if (signedError || !signedData?.signedUrl) {
    throw new Error('Failed to create signed URL');
  }

  // Determine file type category for UI display
  let fileType: 'image' | 'code' | 'pdf' | 'file' = 'file';
  if (file.type.startsWith('image/')) {
    fileType = 'image';
  } else if (file.type.includes('text') || 
             fileExt === 'js' || fileExt === 'jsx' || fileExt === 'ts' || fileExt === 'tsx' || 
             fileExt === 'html' || fileExt === 'css' || fileExt === 'json' || 
             fileExt === 'md' || fileExt === 'py' || fileExt === 'java' || 
             fileExt === 'c' || fileExt === 'cpp' || fileExt === 'cs' || 
             fileExt === 'go' || fileExt === 'rb' || fileExt === 'php' || 
             fileExt === 'swift' || fileExt === 'kt' || fileExt === 'rs') {
    fileType = 'code';
  } else if (fileExt === 'pdf') {
    fileType = 'pdf';
  }

  return {
    name: file.name,
    contentType: file.type,
    url: signedData.signedUrl,
    path: filePath, // Store the actual storage path for later use
    fileType // Add file type category for UI handling
  };
};

// Keep backward compatibility
export const uploadImage = uploadFile;

export const convertMessage = (msg: DatabaseMessage): ExtendedMessage => {
  const baseMessage = {
    id: msg.id,
    content: msg.content,
    role: msg.role as 'user' | 'assistant' | 'system',
    createdAt: new Date(msg.created_at),
    model: msg.model
  };

  // Add experimental_attachments if they exist
  if (msg.experimental_attachments && msg.experimental_attachments.length > 0) {
    return {
      ...baseMessage,
      experimental_attachments: msg.experimental_attachments
    };
  }

  if (msg.role === 'assistant' && msg.reasoning) {
    return {
      ...baseMessage,
      parts: [
        {
          type: 'reasoning' as const,
          reasoning: msg.reasoning
        },
        {
          type: 'text' as const,
          text: msg.content
        }
      ]
    };
  }

  return baseMessage;
};

export const deleteChat = async (chatId: string) => {
  const supabase = createClient();

  try {
    // 1. Delete all messages for this chat
    const { error: deleteMessagesError } = await supabase
      .from('messages')
      .delete()
      .eq('chat_session_id', chatId);

    if (deleteMessagesError) {
      console.error('Error deleting messages:', deleteMessagesError);
      throw deleteMessagesError;
    }

    // 2. Delete the chat session
    const { error: deleteChatError } = await supabase
      .from('chat_sessions')
      .delete()
      .eq('id', chatId);

    if (deleteChatError) {
      console.error('Error deleting chat session:', deleteChatError);
      throw deleteChatError;
    }

    return true;
  } catch (error) {
    console.error('Error in deleteChat:', error);
    throw error;
  }
}; 