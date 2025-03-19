import { Message, TextPart } from 'ai';

export type MessageRole = 'system' | 'user' | 'assistant';

export interface ReasoningDetail {
  type: 'text' | 'redacted';
  text?: string;
}

export interface ReasoningPart {
  type: 'reasoning';
  reasoning: string;
  details?: ReasoningDetail[];
}

export type MessagePart = TextPart | ReasoningPart;

export interface ProcessedMessage extends Omit<Message, 'parts' | 'content'> {
  content: string | AIMessageContent[];
  parts?: MessagePart[];
  role: MessageRole;
  useImageSystemPrompt?: boolean;
}

export interface AIMessageContent {
  type: 'text' | 'image';
  text?: string;
  image?: string;
}

export interface MultiModalMessage extends Omit<Message, 'content'> {
  content: string | AIMessageContent[];
}

export interface DatabaseAttachment {
  name: string;
  content_type: string;
  url: string;
}

export interface DatabaseMessage {
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