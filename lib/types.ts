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
  reasoningText: string;
}

export type MessagePart = TextMessagePart | ReasoningMessagePart;

export interface CompletionStep {
  stepType: string;
  text: string;
  reasoningText?: string;
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
  last_activity_at?: string;
}

// 파일 메타데이터 인터페이스
export interface FileMetadata {
  // 공통 메타데이터
  fileSize: number;
  estimatedTokens?: number;
  
  // 이미지 메타데이터
  width?: number;
  height?: number;
  format?: string; // jpeg, png, gif, etc.
  
  // PDF 메타데이터
  pageCount?: number;
  hasImages?: boolean; // PDF 내부에 이미지가 있는지
  
  // 텍스트/코드 파일 메타데이터
  lineCount?: number;
  characterCount?: number;
}

export interface Attachment {
  name?: string;
  contentType?: string;
  url: string;
  path?: string;
  fileType?: 'image' | 'code' | 'pdf' | 'file';
  metadata?: FileMetadata;
}

export interface DatabaseMessage {
  id: string;
  content: string;
  reasoningText?: string;
  role: 'user' | 'assistant';
  created_at: string;
  model: string;
  host: string;
  chat_session_id: string;
  attachments?: Attachment[];
  experimental_attachments?: Attachment[];
  tool_results?: any;
  annotations?: any[];
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
  maxOutputTokens: number
} 