/**
 * Context Summarization Module
 * 
 * Manages conversation context by summarizing older messages when token usage
 * exceeds 80% of the model's context window.
 * 
 * Key design:
 * - Fixed structure: Summary (max 32K) + Recent 4 messages (~40K) + Current input (~10K) = ~87K
 * - Guarantees under 128K tokens for any model
 * - Reuses existing valid summaries
 */

import { generateText } from 'ai';
import { providers } from '@/lib/providers';
import { getModelById } from '@/lib/models/config';
import { 
  estimateTokenCount, 
  estimateMultiModalTokens, 
  calculateTotalContextTokens 
} from './context-manager';

// Constants
const MAX_SUMMARY_TOKENS = 32000;
const RECENT_MESSAGE_COUNT = 4;
const CONTEXT_THRESHOLD_RATIO = 0.8;

// Types
export interface SummaryData {
  summary: string;
  summarized_until_message_id: string;
  summarized_until_sequence: number;
  created_at: string;
  usedExisting?: boolean;
}

export interface CompressResult {
  finalMessages: any[];
  summaryData: SummaryData | null;
}

/**
 * Check if existing summary is valid
 * 요약이 존재하면 유효하다고 판단 (클라이언트가 요약 이후 메시지만 로드하므로)
 */
function isValidSummary(summary: SummaryData | null, messages: any[]): boolean {
  if (!summary?.summarized_until_message_id || !summary?.summary) return false;
  
  // 요약이 존재하면 유효
  // 메시지 목록에 summarized_until_message_id가 없어도 됨 (요약 이후 메시지만 로드된 경우)
  return true;
}

/**
 * Create a summary message to prepend to recent messages
 * AI SDK v5 형식에 맞게 id와 parts를 포함
 */
function createSummaryMessage(summary: string): any {
  return {
    id: `summary-${Date.now()}`,
    role: 'assistant',
    content: `[Previous Conversation Summary]\n${summary}\n---\nPlease continue the conversation based on the above summary.`,
    // AI SDK v5 호환을 위한 parts 배열
    parts: [
      {
        type: 'text',
        text: `[Previous Conversation Summary]\n${summary}\n---\nPlease continue the conversation based on the above summary.`
      }
    ]
  };
}

/**
 * Extract text content from a message (handles various message formats)
 * Includes tool_results for comprehensive summarization
 */
function extractTextContent(message: any): string {
  let textContent = '';
  
  // v5 parts format - 모든 타입 포함
  if (Array.isArray(message.parts)) {
    const partsText = message.parts
      .map((part: any) => {
        if (part.type === 'text') {
          return part.text;
        } else if (part.type === 'tool-result') {
          // tool-result의 결과 텍스트 포함
          const resultText = typeof part.result === 'string' 
            ? part.result 
            : JSON.stringify(part.result);
          return `[Tool: ${part.toolName}] ${resultText.slice(0, 1000)}`;
        }
        return '';
      })
      .filter(Boolean)
      .join('\n');
    textContent += partsText;
  }
  
  // String content
  if (typeof message.content === 'string') {
    textContent += (textContent ? '\n' : '') + message.content;
  }
  
  // Array content format
  if (Array.isArray(message.content)) {
    const contentText = message.content
      .filter((part: any) => part.type === 'text')
      .map((part: any) => part.text)
      .join('\n');
    textContent += (textContent ? '\n' : '') + contentText;
  }
  
  // tool_results 포함 (중요한 컨텍스트)
  if (message.tool_results && typeof message.tool_results === 'object') {
    const toolResultsText = Object.entries(message.tool_results)
      .map(([toolName, result]: [string, any]) => {
        // token_usage는 제외
        if (toolName === 'token_usage') return '';
        
        const resultStr = typeof result === 'string' 
          ? result 
          : JSON.stringify(result);
        // 각 도구 결과를 최대 1000자로 제한
        return `[Tool: ${toolName}] ${resultStr.slice(0, 1000)}`;
      })
      .filter(Boolean)
      .join('\n');
    
    if (toolResultsText) {
      textContent += (textContent ? '\n' : '') + toolResultsText;
    }
  }
  
  return textContent;
}

/**
 * Generate a concise summary of conversation messages
 */
async function generateSummary(messages: any[]): Promise<string> {
  const conversationText = messages.map(m => {
    const role = m.role === 'user' ? 'User' : 'Assistant';
    const content = extractTextContent(m);
    // Truncate very long messages to avoid token limits in summary generation
    const truncatedContent = content.length > 2000 
      ? content.slice(0, 2000) + '... [truncated]' 
      : content;
    return `${role}: ${truncatedContent}`;
  }).join('\n\n');
  
  try {
    const { text } = await generateText({
      model: providers.languageModel('gemini-2.5-flash-lite'),
      prompt: `Summarize the following conversation concisely. Include only essential information:
- Main topics and decisions made
- User's requests and preferences
- Important code snippets, data, or file contents (key parts only)
- Incomplete tasks or next steps
- Any specific context that would be needed to continue the conversation

Conversation:
${conversationText}

Summary (be concise, focus on what's needed to continue the conversation):`,
      // 'maxTokens' is not a valid option for generateText in this usage; remove it:
    });
    
    return text;
  } catch (error) {
    console.error('Failed to generate summary:', error);
    // Return a minimal fallback summary
    return `Previous conversation contained ${messages.length} messages. Topics discussed: ${extractTextContent(messages[0]).slice(0, 100)}...`;
  }
}

/**
 * Trim messages to fit within context window (for anonymous users)
 */
function trimToFitContext(
  messages: any[],
  threshold: number,
  systemPrompt: string,
  model: string
): any[] {
  const systemTokens = estimateTokenCount(systemPrompt, model);
  let currentTokens = systemTokens;
  const result: any[] = [];
  
  // Add messages from newest to oldest
  for (let i = messages.length - 1; i >= 0; i--) {
    const msgTokens = messages[i]._tokenCount || estimateMultiModalTokens(messages[i]);
    if (currentTokens + msgTokens > threshold) break;
    currentTokens += msgTokens;
    result.unshift(messages[i]);
  }
  
  return result;
}

/**
 * Main function: Compress context if needed by summarizing older messages
 * 
 * Logic:
 * 1. If anonymous user and exceeds threshold: trim old messages
 * 2. First check for existing valid summary - if found, use summary + recent messages
 * 3. If under threshold: use all messages
 * 4. If exceeds threshold and no valid summary: generate new summary + recent messages
 * 
 * 핵심: 요약이 있으면 요약 이전 메시지는 아예 로드하지 않음
 */
export async function compressContextIfNeeded(
  messages: any[],
  systemPrompt: string,
  model: string,
  supabase: any,
  chatId: string | undefined,
  isAnonymousUser: boolean
): Promise<CompressResult> {
  
  const modelConfig = getModelById(model);
  const contextWindow = modelConfig?.contextWindow || 128000;
  const threshold = contextWindow * CONTEXT_THRESHOLD_RATIO;
  
  // Anonymous user handling - 요약 불가, 토큰 기반 트림만
  if (isAnonymousUser) {
    const totalTokens = calculateTotalContextTokens(messages, systemPrompt, model);
    if (totalTokens > threshold) {
      const trimmedMessages = trimToFitContext(messages, threshold, systemPrompt, model);
      return { finalMessages: trimmedMessages, summaryData: null };
    }
    return { finalMessages: messages, summaryData: null };
  }
  
  // No chatId means we can't save/retrieve summaries
  if (!chatId) {
    return { finalMessages: messages, summaryData: null };
  }
  
  // === Step 0: 먼저 전체 토큰 계산 (모델 변경 시 자동 대응) ===
  // 전체 메시지가 threshold 이하면 요약 필요 없음 (기존 요약도 무시)
  const totalTokens = calculateTotalContextTokens(messages, systemPrompt, model);
  
  if (totalTokens <= threshold) {
    // 전체 메시지가 threshold 이내 → 요약 불필요, 전체 메시지 사용
    return { finalMessages: messages, summaryData: null };
  }
  
  // === Step 1: threshold 초과 → 기존 요약 확인 ===
  let existingSummary: SummaryData | null = null;
  try {
    const { data: session } = await supabase
      .from('chat_sessions')
      .select('context_summary')
      .eq('id', chatId)
      .single();
    
    existingSummary = session?.context_summary as SummaryData | null;
  } catch (error) {
    // 요약 조회 실패는 무시하고 진행
  }
  
  // === Step 2: 기존 요약이 있으면 요약 포함해서 처리 (우선순위 최고) ===
  const isValid = existingSummary ? isValidSummary(existingSummary, messages) : false;
  
  // 요약 유효성 추가 검증: 요약 범위 내 메시지가 편집/삭제되었는지 확인
  let summaryInvalidated = false;
  if (existingSummary && isValid && chatId) {
    const summaryIndex = messages.findIndex(
      m => m.id === existingSummary!.summarized_until_message_id
    );
    
    // summaryIndex가 -1이면 요약 기준 메시지가 없음
    // 두 가지 경우 구분 필요:
    // 1. 클라이언트가 요약 이후 메시지만 로드 (정상 - 요약 재사용)
    // 2. 요약 범위 내 메시지가 편집/삭제됨 (무효화 필요)
    if (summaryIndex === -1 && messages.length > 0) {
      // DB에서 첫 번째 메시지의 sequence_number 확인 (가장 확실한 방법)
      const firstMsgId = messages[0]?.id;
      if (firstMsgId) {
        try {
          const { data: msgData } = await supabase
            .from('messages')
            .select('sequence_number')
            .eq('id', firstMsgId)
            .eq('chat_session_id', chatId)
            .single();
          
          if (msgData?.sequence_number && msgData.sequence_number <= existingSummary!.summarized_until_sequence) {
            // 첫 번째 메시지가 요약 범위 내에 있음 → 무효화
            summaryInvalidated = true;
          }
          // msgData가 없으면 새 메시지이므로 요약 유지 (정상)
        } catch {
          // DB 쿼리 실패 시 fallback: sequence_number 필드로 확인
          const hasMessageBeforeOrAtSummary = messages.some((m: any) => {
            const seqNum = m.sequence_number || 0;
            return seqNum > 0 && seqNum <= existingSummary!.summarized_until_sequence;
          });
          if (hasMessageBeforeOrAtSummary) {
            summaryInvalidated = true;
          }
        }
      }
    }
  }
  
  if (existingSummary && isValid && !summaryInvalidated) {
    const summaryIndex = messages.findIndex(
      m => m.id === existingSummary!.summarized_until_message_id
    );
    
    // 요약 기준 메시지가 요약 생성 후 편집되었는지 확인
    if (summaryIndex !== -1) {
      const summaryMessage = messages[summaryIndex] as any;
      if (summaryMessage.is_edited && summaryMessage.edited_at) {
        const editedAt = new Date(summaryMessage.edited_at).getTime();
        const summaryCreatedAt = new Date(existingSummary.created_at).getTime();
        if (editedAt > summaryCreatedAt) {
          // 요약 생성 후 편집됨 → Step 3으로 진행 (새 요약 생성)
          summaryInvalidated = true;
        }
      }
    }
  }
  
  if (existingSummary && isValid && !summaryInvalidated) {
    const summaryIndex = messages.findIndex(
      m => m.id === existingSummary!.summarized_until_message_id
    );
    
    // summaryIndex === -1: 모든 메시지가 요약 이후 (정상)
    // summaryIndex >= 0: 요약 기준 메시지가 메시지 배열에 있음
    const messagesAfterSummary = summaryIndex === -1 
      ? messages  // 모든 메시지가 요약 이후
      : messages.slice(summaryIndex + 1);
    
    // 요약 메시지 생성
    const summaryMessage = createSummaryMessage(existingSummary.summary);
    
    // 요약 + 요약 이후 메시지들의 토큰 계산
    const summaryTokens = estimateTokenCount(summaryMessage.content, model);
    const afterSummaryTokens = messagesAfterSummary.reduce((sum, msg) => {
      return sum + (msg._tokenCount || estimateMultiModalTokens(msg));
    }, 0);
    const systemTokens = estimateTokenCount(systemPrompt, model);
    const combinedTokens = systemTokens + summaryTokens + afterSummaryTokens;
    
    // 토큰이 80% 미만이면 기존 요약 + 모든 요약 이후 메시지 사용
    if (combinedTokens <= threshold) {
      return {
        finalMessages: [summaryMessage, ...messagesAfterSummary],
        summaryData: { ...existingSummary, usedExisting: true }
      };
    }
    
    // 토큰이 80% 초과하면 새 요약 생성 필요
    // 요약할 메시지가 없으면 (요약 이후 메시지가 4개 이하) 그냥 사용
    if (messagesAfterSummary.length <= RECENT_MESSAGE_COUNT) {
      return {
        finalMessages: [summaryMessage, ...messagesAfterSummary],
        summaryData: { ...existingSummary, usedExisting: true }
      };
    }
    
    // 기존 요약 내용 + 요약 이후 메시지들 중 최근 4개 제외한 것들을 새로 요약
    const existingSummaryAsMessage = {
      role: 'system',
      content: `[Previous Summary Context]\n${existingSummary.summary}`
    };
    
    const messagesToSummarize = messagesAfterSummary.slice(0, -RECENT_MESSAGE_COUNT);
    const allMessagesToSummarize = [existingSummaryAsMessage, ...messagesToSummarize];
    
    const summary = await generateSummary(allMessagesToSummarize);
    const recentMessages = messagesAfterSummary.slice(-RECENT_MESSAGE_COUNT);
    const lastMsg = messagesToSummarize[messagesToSummarize.length - 1];
    
    // 새 요약의 sequence는 기존 요약의 sequence + 요약된 메시지 수
    const newSummaryData: SummaryData = {
      summary,
      summarized_until_message_id: lastMsg.id,
      summarized_until_sequence: existingSummary.summarized_until_sequence + messagesToSummarize.length,
      created_at: new Date().toISOString()
    };
    
    // 비동기 DB 저장
    setImmediate(async () => {
      try {
        await supabase
          .from('chat_sessions')
          .update({ context_summary: newSummaryData })
          .eq('id', chatId);
      } catch (e) {
        console.error('Failed to save context summary:', e);
      }
    });
    
    return {
      finalMessages: [createSummaryMessage(summary), ...recentMessages],
      summaryData: { ...newSummaryData, usedExisting: false }
    };
  }
  
  // === Step 3: 기존 요약이 없거나 무효 → 새 요약 생성 ===
  // (이미 Step 0에서 threshold 초과 확인됨)
  const messagesToSummarize = messages.slice(0, -RECENT_MESSAGE_COUNT);
  
  // 요약할 메시지가 없으면 전체 사용
  if (messagesToSummarize.length === 0) {
    return { finalMessages: messages, summaryData: null };
  }
  
  const summary = await generateSummary(messagesToSummarize);
  let recentMessages = messages.slice(-RECENT_MESSAGE_COUNT);
  let lastMsg = messagesToSummarize[messagesToSummarize.length - 1];
  
  // 요약 생성 후 최종 토큰 검증 (대용량 파일 포함 시 여전히 초과할 수 있음)
  const summaryMessage = createSummaryMessage(summary);
  const summaryTokens = estimateTokenCount(summaryMessage.content, model);
  const recentTokens = recentMessages.reduce((sum, msg) => {
    return sum + (msg._tokenCount || estimateMultiModalTokens(msg));
  }, 0);
  const systemTokens = estimateTokenCount(systemPrompt, model);
  let finalTokens = systemTokens + summaryTokens + recentTokens;
  
  // 여전히 초과하면 최근 메시지 수를 줄여서 재시도 (최소 1개는 유지)
  while (finalTokens > threshold && recentMessages.length > 1) {
    // 가장 오래된 최근 메시지를 요약에 포함
    const [oldestRecent, ...remainingRecent] = recentMessages;
    recentMessages = remainingRecent;
    
    // lastMsg 업데이트 (요약 범위 확장)
    lastMsg = oldestRecent;
    
    // 토큰 재계산
    const newRecentTokens = recentMessages.reduce((sum, msg) => {
      return sum + (msg._tokenCount || estimateMultiModalTokens(msg));
    }, 0);
    finalTokens = systemTokens + summaryTokens + newRecentTokens;
  }
  
  const newSummaryData: SummaryData = {
    summary,
    summarized_until_message_id: lastMsg.id,
    summarized_until_sequence: messages.length - recentMessages.length,
    created_at: new Date().toISOString()
  };
  
  // 비동기 DB 저장 (응답 차단하지 않음)
  setImmediate(async () => {
    try {
      await supabase
        .from('chat_sessions')
        .update({ context_summary: newSummaryData })
        .eq('id', chatId);
    } catch (e) {
      console.error('Failed to save context summary:', e);
    }
  });
  
  return {
    finalMessages: [summaryMessage, ...recentMessages],
    summaryData: { ...newSummaryData, usedExisting: false }
  };
}
