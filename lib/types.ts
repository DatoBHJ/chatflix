import { Message as AIMessage } from 'ai'

export interface ChatRequest {
  messages: AIMessage[];
  model: string;
  chatId?: string;
  isRegeneration?: boolean; 
  existingMessageId?: string;  
  isReasoningEnabled?: boolean;
  isWebSearchEnabled?: boolean;
  saveToDb?: boolean;
}

export type MessagePartType = 'text' | 'reasoning';

export interface BaseMessagePart {
  type: MessagePartType;
}

export interface TextMessagePart extends BaseMessagePart {
  type: 'text';
  text: string;
}

export interface ReasoningMessagePart extends BaseMessagePart {
  type: 'reasoning';
  reasoning: string;
}

export type MessagePart = TextMessagePart | ReasoningMessagePart;

export interface CompletionStep {
  stepType: string;
  text: string;
  reasoning?: string;
  finishReason?: string;
}

export interface CompletionResult {
  finishReason: string;
  text: string;
  steps?: CompletionStep[];
  parts?: MessagePart[];
}

// 데이터베이스 타입
export interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  current_model?: string;
}

export interface Attachment {
  name?: string;
  contentType?: string;
  url: string;
  path?: string;
  fileType?: 'image' | 'code' | 'pdf' | 'file';
}

export interface DatabaseMessage {
  id: string;
  content: string;
  reasoning?: string;
  role: 'user' | 'assistant';
  created_at: string;
  model: string;
  host: string;
  chat_session_id: string;
  attachments?: Attachment[];
  experimental_attachments?: Attachment[];
}

// UI 타입
export interface Chat extends ChatSession {
  messages: DatabaseMessage[];
  lastMessage?: string;
  lastMessageTime?: number;
  current_model?: string;
  is_web_search_enabled?: boolean;
}

export interface ModelConfig {
  id: string
  baseURL: string
  apiKey: string
  temperature: number
  maxTokens: number
} 