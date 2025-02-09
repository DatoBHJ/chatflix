import { Message as AIMessage } from 'ai'

export interface ChatRequest {
  messages: AIMessage[];
  model: string;
  chatId?: string;
}

export interface TextUIPart {
  type: 'text';
  text: string;
}

export interface ReasoningUIPart {
  type: 'reasoning';
  reasoning: string;
}

export interface MessagePart {
  type: 'text' | 'reasoning';
  text?: string;
  reasoning?: string;
}

interface Step {
  stepType: string;
  text: string;
  reasoning?: string;
  finishReason?: string;
}

export interface CompletionResult {
  text: string;
  steps?: Step[];
  parts?: MessagePart[];
}

export interface ChatSession {
  id: string;
  title: string;
  created_at: string;
}

export interface DatabaseMessage {
  id: string
  content: string
  reasoning?: string
  role: 'user' | 'assistant'
  created_at: string
  model: string
  host: string
  chat_session_id: string
}

export interface ModelConfig {
  id: string
  baseURL: string
  apiKey: string
  temperature: number
  maxTokens: number
}

export interface Chat {
  id: string;
  title: string;
  messages: DatabaseMessage[];
  lastMessage?: string;
  created_at: string;
} 