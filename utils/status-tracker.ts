import { SupabaseClient } from '@supabase/supabase-js';

/**
 * 프로젝트 상태 조회
 */
export async function getProjectStatus(
  supabase: SupabaseClient,
  chat_session_id: string,
  userId: string
): Promise<string> {
  console.log("[DEBUG-STATUS] Getting project status for user:", userId, "chat:", chat_session_id);
  
  const { data, error } = await supabase
    .from('project_status')
    .select('content')
    .eq('chat_session_id', chat_session_id)
    .eq('user_id', userId)
    .single();
  
  if (error || !data) {
    console.log("[DEBUG-STATUS] No existing status found, creating default");
    // 기본 상태 템플릿 생성
    return createDefaultStatus();
  }
  
  console.log("[DEBUG-STATUS] Existing status found");
  return data.content;
}

/**
 * 프로젝트 상태 업데이트
 */
export async function updateProjectStatus(
  supabase: SupabaseClient,
  chat_session_id: string,
  userId: string,
  content: string
): Promise<{ data: any; error: any }> {
  console.log("[DEBUG-STATUS] Updating project status for user:", userId, "chat:", chat_session_id);
  console.log("[DEBUG-STATUS] Content:", content.substring(0, 100) + "...");
  
  const { data, error } = await supabase
    .from('project_status')
    .upsert({
      chat_session_id: chat_session_id,
      user_id: userId,
      content,
      updated_at: new Date().toISOString()
    }, { onConflict: 'chat_session_id,user_id' });
  
  if (error) {
    console.error("[DEBUG-STATUS] Error updating project status:", error);
  } else {
    console.log("[DEBUG-STATUS] Project status update successful, data:", data);
  }
  
  return { data, error };
}

/**
 * 워크플로우 상태 파일 생성
 */
export function createWorkflowState(
  currentTask: string,
  steps: { text: string; completed: boolean }[],
  context: string[]
): string {
  const stepsMarkdown = steps
    .map(step => `- [${step.completed ? 'x' : ' '}] ${step.text}`)
    .join('\n');
  
  const contextMarkdown = context.join('\n- ');
  
  return `# Workflow State

## Current Task
${currentTask}

## Steps
${stepsMarkdown}

## Context
- ${contextMarkdown}
`;
}

/**
 * 기본 상태 템플릿 생성
 */
function createDefaultStatus(): string {
  return `## Project Status
- Current phase: Initial setup
- Last updated: ${new Date().toISOString()}

## Technical Context
- No specifications yet

## Recent Changes
- Project initialized`;
} 