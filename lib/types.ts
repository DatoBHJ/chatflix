import { Message as AIMessage } from 'ai'

// API 요청 타입
export interface ChatRequest {
  messages: AIMessage[];
  model: string;
  chatId?: string;
  isRegeneration?: boolean;  // 재생성 요청인지 여부
  existingMessageId?: string;  // 재생성시 기존 메시지 ID
}

// UI 메시지 파트 타입
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

// 완료 결과 타입
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

export interface DatabaseMessage {
  id: string;
  content: string;
  reasoning?: string;
  role: 'user' | 'assistant';
  created_at: string;
  model: string;
  host: string;
  chat_session_id: string;
}

// UI 타입
export interface Chat extends ChatSession {
  messages: DatabaseMessage[];
  lastMessage?: string;
  lastMessageTime?: number;
  current_model?: string;
}

export interface ModelConfig {
  id: string
  baseURL: string
  apiKey: string
  temperature: number
  maxTokens: number
} 