import { SupabaseClient } from '@supabase/supabase-js';
import { getAllMemoryBank } from './memory-bank';
import { getProjectStatus } from './status-tracker';
import { 
  fetchSystemPrompt,
} from '@/app/api/chat/services/chatService';

// 메시지 타입 정의 (실제 프로젝트의 타입에 맞게 조정)
export interface Message {
  id: string;
  role: 'system' | 'user' | 'assistant' | 'function';
  content: string | any;
  createdAt?: string;
}

/**
 * 토큰 수 추정 함수
 */
export function estimateTokenCount(text: string): number {
  // 대략적인 토큰 수 계산 (영어 기준 4자당 1토큰, 한글은 1-2자당 1토큰)
  const isMainlyKorean = /[\uAC00-\uD7AF]/.test(text) && 
                         (text.match(/[\uAC00-\uD7AF]/g)?.length || 0) / text.length > 0.3;
  
  if (isMainlyKorean) {
    return Math.ceil(text.length / 1.5); // 한글은 더 많은 토큰 사용
  }
  return Math.ceil(text.length / 4); // 영어 기준
}

/**
 * 향상된 컨텍스트 생성 함수
 */
export async function getEnhancedContext(
  supabase: SupabaseClient,
  chatId: string,
  userId: string,
  messages: Message[],
  maxTokens: number = 8000,
  isAgentMode: boolean = true
): Promise<{ enhancedSystemPrompt: string; contextMessages: Message[] }> {
  // 1. 메모리 뱅크 조회
  const { data: memoryData } = await getAllMemoryBank(supabase, userId);
  
  // 2. 프로젝트 상태 조회
  const statusContent = await getProjectStatus(supabase, chatId, userId);
  
  // 3. 시스템 프롬프트 조회 - Agent 모드 파라미터 전달
  const systemPrompt = await fetchSystemPrompt(isAgentMode);
  
  // 4. 메모리 컨텍스트 구성
  const memoryContext = memoryData ? 
    `## MEMORY BANK\n\n${memoryData}\n\n## PROJECT STATUS\n\n${statusContent}` : 
    `## PROJECT STATUS\n\n${statusContent}`;
  
  // 5. 시스템 메시지에 메모리 컨텍스트 추가
  const enhancedSystemPrompt = `${systemPrompt}\n\n${memoryContext}`;
  
  // 6. 토큰 제한을 고려한 메시지 선택
  const systemTokens = estimateTokenCount(enhancedSystemPrompt);
  const remainingTokens = maxTokens - systemTokens;
  
  // 7. 메시지 토큰 수 계산 및 선택
  const contextMessages = selectMessagesWithinTokenLimit(messages, remainingTokens);
  
  return {
    enhancedSystemPrompt,
    contextMessages
  };
}

/**
 * 토큰 제한 내에서 메시지 선택
 */
function selectMessagesWithinTokenLimit(messages: Message[], maxTokens: number): Message[] {
  let tokenCount = 0;
  const selectedMessages: Message[] = [];
  
  // 최신 메시지부터 역순으로 추가
  const reversedMessages = [...messages].reverse();
  
  for (const message of reversedMessages) {
    const content = typeof message.content === 'string' ? message.content : JSON.stringify(message.content);
    const msgTokens = estimateTokenCount(content);
    
    // 토큰 한도 초과 시 중단
    if (tokenCount + msgTokens > maxTokens) break;
    
    tokenCount += msgTokens;
    selectedMessages.unshift(message); // 원래 순서대로 추가
  }
  
  return selectedMessages;
} 