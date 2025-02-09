import { Message as AIMessage } from 'ai'

export interface ChatRequest {
  messages: AIMessage[];
  model: string;
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

export interface DatabaseMessage {
  id: string
  content: string
  reasoning?: string
  role: 'user' | 'assistant'
  created_at: string
  model: string
  host: string
}

export interface ModelConfig {
  id: string
  baseURL: string
  apiKey: string
  temperature: number
  maxTokens: number
} 