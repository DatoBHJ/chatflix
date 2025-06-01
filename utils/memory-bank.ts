import { SupabaseClient } from '@supabase/supabase-js';

export interface MemoryBankEntry {
  category: string;
  content: string;
}

/**
 * Retrieve a specific memory bank entry
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
 * Retrieve all memory bank entries for a user
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
  
  // Convert memory bank content to markdown format
  const memoryContent = data
    .sort((a, b) => a.category.localeCompare(b.category))
    .map(item => `## ${formatCategoryName(item.category)}\n\n${item.content}`)
    .join('\n\n---\n\n');

  
  return { data: memoryContent, error: null };
}

/**
 * Update a memory bank entry
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
 * Format category name for display
 */
function formatCategoryName(category: string): string {
  return category
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Initialize default memory bank categories for a user profile
 * @param supabase SupabaseClient 인스턴스
 * @param userId 사용자 ID
 * @param user 사용자 객체 (Supabase User 객체)
 */
export async function initializeMemoryBank(
  supabase: SupabaseClient,
  userId: string,
  user?: any
): Promise<void> {
  // 먼저 기존 데이터가 있는지 확인
  const { data: existingData } = await supabase
    .from('memory_bank')
    .select('category')
    .eq('user_id', userId);
    
  // 이미 있는 카테고리 목록
  const existingCategories = new Set(existingData?.map(item => item.category) || []);
  
  // 사용자 정보 추출 (있는 경우만)
  let userName = 'User';
  let joinDate = 'Recently';
  let emailInfo = '';
  
  if (user) {
    // 이름 정보 추출
    userName = user.user_metadata?.full_name || 
              user.user_metadata?.name || 
              (user.email ? user.email.split('@')[0] : 'User');
    
    // 가입일 추출
    joinDate = user.created_at ? new Date(user.created_at).toLocaleDateString() : 'Recently';
    
    // 이메일 정보 추출 (있는 경우만)
    if (user.email) {
      const emailDomain = user.email.split('@')[1];
      // 간단한 도메인 기반 분석 (필요한 경우만)
      if (emailDomain?.includes('edu') || emailDomain?.includes('ac.')) {
        emailInfo = '- Possibly in education or academia';
      }
    }
  }
  
  const defaultEntries = [
    {
      category: '00-personal-info',
      content: `# Personal Information

## Basic Details
- Name: ${userName}
- Member since: ${joinDate}
- Last active: ${new Date().toLocaleDateString()}

## Professional Context
- Occupation: [To be determined from conversations]
- Expertise level: [To be determined from conversations]
- Fields: [To be determined from conversations]
${emailInfo}

## Usage Patterns
- New user, patterns will be identified with more interactions
`
    },
    {
      category: '01-preferences',
      content: `# User Preferences

## Communication Style
- Preferred response length: [To be determined from interactions]
- Technical detail level: [To be determined from interactions]
- Tone preference: [To be determined from interactions]

## Content Preferences
- Code examples: [To be determined from interactions]
- Visual elements: [To be determined from interactions]
- Step-by-step guides: [To be determined from interactions]
`
    },
    {
      category: '02-interests',
      content: `# User Interests

## Primary Interests
- [To be determined from conversations]

## Recent Topics
- First interactions with the system
`
    },
    {
      category: '03-interaction-history',
      content: `# Interaction History

## Recent Conversations
- Initial interaction (${new Date().toLocaleDateString()})
- Building user profile
`
    },
    {
      category: '04-relationship',
      content: `# Relationship Development

## Communication Quality
- Trust level: Initial relationship being established
- Engagement level: [To be determined from interactions]

## Personalization Strategy
- Establish rapport and understand user's specific needs
`
    }
  ];
  
  // 존재하지 않는 카테고리만 초기화
  for (const entry of defaultEntries) {
    if (!existingCategories.has(entry.category)) {
      // console.log(`Initializing memory bank category: ${entry.category} for user: ${userId}`);
      await updateMemoryBank(supabase, userId, entry.category, entry.content);
    } else {
      // console.log(`Skipping initialization for existing category: ${entry.category} for user: ${userId}`);
    }
  }
} 