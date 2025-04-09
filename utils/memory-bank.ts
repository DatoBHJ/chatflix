import { SupabaseClient } from '@supabase/supabase-js';

export interface MemoryBankEntry {
  category: string;
  content: string;
}

/**
 * 메모리 뱅크 항목 조회
 */
export async function getMemoryBankEntry(
  supabase: SupabaseClient,
  userId: string,
  category: string
): Promise<{ data: string | null; error: any }> {
  const { data, error } = await supabase
    .from('memory_bank')
    .select('content')
    .eq('user_id', userId)
    .eq('category', category)
    .single();
  
  if (error) {
    return { data: null, error };
  }
  
  return { data: data?.content || null, error: null };
}

/**
 * 메모리 뱅크 전체 조회
 */
export async function getAllMemoryBank(
  supabase: SupabaseClient,
  userId: string,
  categories?: string[]
): Promise<{ data: string | null; error: any }> {
  let query = supabase
    .from('memory_bank')
    .select('category, content')
    .eq('user_id', userId);
  
  if (categories && categories.length > 0) {
    query = query.in('category', categories);
  }
  
  const { data, error } = await query;
  
  if (error) {
    return { data: null, error };
  }
  
  if (!data || data.length === 0) {
    return { data: null, error: null };
  }
  
  // 메모리 뱅크 내용을 마크다운 형식으로 변환
  const memoryContent = data
    .sort((a, b) => a.category.localeCompare(b.category))
    .map(item => `## ${formatCategoryName(item.category)}\n\n${item.content}`)
    .join('\n\n---\n\n');
  
  return { data: memoryContent, error: null };
}

/**
 * 메모리 뱅크 항목 업데이트
 */
export async function updateMemoryBank(
  supabase: SupabaseClient,
  userId: string,
  category: string,
  content: string
): Promise<{ data: any; error: any }> {
  const { data, error } = await supabase
    .from('memory_bank')
    .upsert({
      user_id: userId,
      category,
      content,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id,category' });
  
  return { data, error };
}

/**
 * 카테고리 이름 포맷팅
 */
function formatCategoryName(category: string): string {
  return category
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * 기본 메모리 뱅크 초기화
 */
export async function initializeMemoryBank(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  const defaultEntries = [
    {
      category: '00-project-overview',
      content: '# Project Overview\n\nThis section contains the overall project description and goals.'
    },
    {
      category: '01-architecture',
      content: '# Architecture\n\nThis section contains system architecture and design decisions.'
    },
    {
      category: '02-progress',
      content: '# Progress\n\nThis section tracks the current progress and status of the project.'
    },
    {
      category: '03-decisions',
      content: '# Key Decisions\n\nThis section documents key decisions and their rationales.'
    }
  ];
  
  for (const entry of defaultEntries) {
    await updateMemoryBank(supabase, userId, entry.category, entry.content);
  }
} 