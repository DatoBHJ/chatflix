import { SupabaseClient } from '@supabase/supabase-js';
import { updateProjectStatus as updateStatus, getProjectStatus } from '@/utils/status-tracker';
import { updateMemoryBank } from '@/utils/memory-bank';
import { MultiModalMessage } from '../types';
import { callMemoryBankUpdate } from '@/app/api/chat/utils/callMemoryBankUpdate';

/**
 * 대화 내용을 텍스트로 변환하는 유틸리티 함수
 */
function convertMessagesToText(messages: MultiModalMessage[]): string {
  return messages.map(msg => {
    const role = msg.role.charAt(0).toUpperCase() + msg.role.slice(1);
    const content = typeof msg.content === 'string' 
      ? msg.content 
      : Array.isArray(msg.content) 
        ? msg.content.filter(part => part.type === 'text').map(part => part.text).join('\n')
        : JSON.stringify(msg.content);
    return `${role}: ${content}`;
  }).join('\n\n');
}

/**
 * 프로젝트 상태 업데이트
 */
export async function updateProjectStatus(
  supabase: SupabaseClient, 
  userId: string, 
  chatId: string, 
  userMessage: string, 
  aiMessage: string
): Promise<string | null> {
  try {
    // console.log("[DEBUG-AGENT-BG] Starting project status update");
    const statusUpdatePrompt = `Based on our conversation, please provide a concise update to the project status in markdown format. Focus only on what has changed.`;
    
    // 현재 상태 가져오기
    const currentStatus = await getProjectStatus(supabase, chatId, userId);
    
    // 프롬프트 생성
    const finalPrompt = `${statusUpdatePrompt}\n\nCurrent status:\n${currentStatus}\n\nLatest conversation:\nUser: ${userMessage}\nAI: ${aiMessage}`;
    
    // API 호출
    const statusText = await callMemoryBankUpdate(
      'grok-2-latest',
      'Generate a concise project status update based on the conversation.',
      finalPrompt,
      300,
      0.3
    );
    
    if (statusText) {
      await updateStatus(supabase, chatId, userId, statusText);
      // console.log("[DEBUG-AGENT-BG] Project status updated in database");
      return statusText;
    }
    
    return null;
  } catch (error) {
    // console.error("[DEBUG-AGENT-BG] Error updating project status:", error);
    return null;
  }
}

/**
 * 진행 상황(02-progress) 업데이트
 */
export async function updateProgress(
  supabase: SupabaseClient,
  userId: string,
  statusText: string | null
): Promise<void> {
  if (!statusText) return;
  
  try {
    // console.log("[DEBUG-AGENT-BG] Starting progress update");
    const progressPrompt = `Based on the status update, create a structured project progress document in markdown format. Include current phase, completed items, and next steps.\n\nStatus update:\n${statusText}`;
    
    const progressText = await callMemoryBankUpdate(
      'grok-2-latest',
      'Create a structured project progress document in markdown format.',
      progressPrompt,
      500,
      0.3
    );
    
    if (progressText) {
      await updateMemoryBank(supabase, userId, '02-progress', progressText);
      // console.log("[DEBUG-AGENT-BG] Memory bank 02-progress updated");
    }
  } catch (error) {
    // console.error("[DEBUG-AGENT-BG] Error updating progress:", error);
  }
}

/**
 * 대화 요약(01-summary) 업데이트
 */
export async function updateSummary(
  supabase: SupabaseClient,
  userId: string,
  messages: MultiModalMessage[]
): Promise<void> {
  try {
    // console.log("[DEBUG-AGENT-BG] Starting conversation summary generation");
    const recentMessages = messages.slice(-5);
    const conversationText = convertMessagesToText(recentMessages);
    
    const summaryPrompt = `Summarize the key points of this conversation related to the project and tasks. Include any decisions made and action items.\n\nConversation:\n${conversationText}`;
    
    const summaryText = await callMemoryBankUpdate(
      'grok-2-latest',
      'Create a concise summary of the conversation focusing on project-related information.',
      summaryPrompt,
      500,
      0.3
    );
    
    if (summaryText) {
      await updateMemoryBank(supabase, userId, '01-summary', summaryText);
      // console.log("[DEBUG-AGENT-BG] Memory bank 01-summary updated successfully");
    }
  } catch (error) {
    // console.error("[DEBUG-AGENT-BG] Error updating memory bank summary:", error);
  }
}

/**
 * 프로젝트 개요(00-project-overview) 업데이트
 */
export async function updateOverview(
  supabase: SupabaseClient,
  userId: string,
  messages: MultiModalMessage[]
): Promise<void> {
  try {
    // console.log("[DEBUG-AGENT-BG] Starting project overview update");
    const recentMessages = messages.slice(-5);
    const conversationText = convertMessagesToText(recentMessages);
    
    const overviewPrompt = `Based on the current project state and conversation, provide a comprehensive project overview in markdown format. Include the project's purpose, goals, and scope.\n\nConversation:\n${conversationText}`;
    
    const overviewText = await callMemoryBankUpdate(
      'grok-2-latest',
      'Create a comprehensive project overview focusing on purpose, goals, and scope.',
      overviewPrompt,
      500,
      0.3
    );
    
    if (overviewText) {
      await updateMemoryBank(supabase, userId, '00-project-overview', overviewText);
      // console.log("[DEBUG-AGENT-BG] Memory bank 00-project-overview updated successfully");
    }
  } catch (error) {
    // console.error("[DEBUG-AGENT-BG] Error updating project overview:", error);
  }
}

/**
 * 아키텍처(01-architecture) 업데이트
 */
export async function updateArchitecture(
  supabase: SupabaseClient,
  userId: string,
  messages: MultiModalMessage[]
): Promise<void> {
  try {
    // console.log("[DEBUG-AGENT-BG] Starting architecture update");
    const recentMessages = messages.slice(-5);
    const conversationText = convertMessagesToText(recentMessages);
    
    const architecturePrompt = `Based on the current project state and conversation, provide a detailed description of the system architecture in markdown format. Include technical details, design decisions, and component relationships.\n\nConversation:\n${conversationText}`;
    
    const architectureText = await callMemoryBankUpdate(
      'grok-2-latest',
      'Create a detailed description of the system architecture and design decisions.',
      architecturePrompt,
      500,
      0.3
    );
    
    if (architectureText) {
      await updateMemoryBank(supabase, userId, '01-architecture', architectureText);
      // console.log("[DEBUG-AGENT-BG] Memory bank 01-architecture updated successfully");
    }
  } catch (error) {
    // console.error("[DEBUG-AGENT-BG] Error updating architecture:", error);
  }
}

/**
 * 결정사항(03-decisions) 업데이트
 */
export async function updateDecisions(
  supabase: SupabaseClient,
  userId: string,
  messages: MultiModalMessage[]
): Promise<void> {
  try {
    // console.log("[DEBUG-AGENT-BG] Starting decisions update");
    const recentMessages = messages.slice(-5);
    const conversationText = convertMessagesToText(recentMessages);
    
    const decisionsPrompt = `Extract any key decisions or important choices made in this conversation. Format as a markdown list with rationales for each decision.\n\nConversation:\n${conversationText}`;
    
    const decisionsText = await callMemoryBankUpdate(
      'grok-2-latest',
      'Extract key decisions and their rationales from the conversation.',
      decisionsPrompt,
      500,
      0.3
    );
    
    if (decisionsText) {
      await updateMemoryBank(supabase, userId, '03-decisions', decisionsText);
      // console.log("[DEBUG-AGENT-BG] Memory bank 03-decisions updated successfully");
    }
  } catch (error) {
    // console.error("[DEBUG-AGENT-BG] Error updating decisions:", error);
  }
}

/**
 * 모든 메모리 뱅크를 병렬로 업데이트하는 함수
 */
export async function updateAllMemoryBanks(
  supabase: SupabaseClient, 
  userId: string, 
  chatId: string, 
  messages: MultiModalMessage[], 
  userMessage: string, 
  aiMessage: string
): Promise<void> {
  try {
    // console.log("[DEBUG-AGENT-BG] Starting background memory update in parallel");
    
    // 프로젝트 상태 먼저 업데이트 (02-progress가 이에 의존하기 때문)
    const statusText = await updateProjectStatus(supabase, userId, chatId, userMessage, aiMessage);
    
    // 나머지 모든 업데이트를 병렬로 실행
    await Promise.all([
      updateProgress(supabase, userId, statusText),
      updateSummary(supabase, userId, messages),
      updateOverview(supabase, userId, messages),
      updateArchitecture(supabase, userId, messages),
      updateDecisions(supabase, userId, messages)
    ]);
    
    // console.log("[DEBUG-AGENT-BG] All memory bank updates completed in parallel");
  } catch (error) {
    // console.error("[DEBUG-AGENT-BG] Memory update process failed:", error);
  }
} 