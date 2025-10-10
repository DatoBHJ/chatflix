import { createClient as createServiceClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin';

// Refine에 사용할 AI 모델 설정
const REFINE_MODEL = 'gpt-4.1-mini';
const REFINE_MAX_TOKENS = 1000;
const REFINE_TEMPERATURE = 0.2;

/**
 * 메모리 refine을 위한 AI 호출
 */
async function callRefineAI(
  systemPrompt: string,
  userPrompt: string
): Promise<string | null> {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: REFINE_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: REFINE_MAX_TOKENS,
        temperature: REFINE_TEMPERATURE
      })
    });

    if (!response.ok) {
      console.error(`Refine AI call failed: ${response.status}`);
      return null;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (error) {
    console.error('Error calling refine AI:', error);
    return null;
  }
}

/**
 * 사용자 메모리 refine 실행
 */
async function refineUserMemory(userId: string, supabase: any) {
  try {
    console.log(`🔧 [REFINE] Starting memory refine for user ${userId}`);

    // 현재 메모리 데이터 가져오기
    const { data: memoryEntries } = await supabase
      .from('memory_bank')
      .select('category, content')
      .eq('user_id', userId)
      .order('category');

    if (!memoryEntries || memoryEntries.length === 0) {
      console.log(`⚠️ [REFINE] No memory data found for user ${userId}`);
      return { success: false, reason: 'No memory data' };
    }

    const results = [];
    
    // 각 카테고리별로 refine
    for (const entry of memoryEntries) {
      const systemPrompt = `You are a memory refinement specialist. Your task is to clean up and optimize user memory data for the ${entry.category} category ONLY.

CRITICAL RULES FOR ${entry.category}:
1. Remove ALL content that belongs to other categories (00-personal-info, 01-preferences, 02-interests, 03-interaction-history, 04-relationship)
2. Keep ONLY content that is specific to ${entry.category}
3. Remove placeholder text like "Not enough data", "To be determined", etc.
4. Remove redundant explanations and verbose descriptions
5. Use consistent markdown formatting
6. Be concise but comprehensive
7. Focus on actionable insights and concrete facts
8. If no relevant content exists for this category, return a minimal placeholder

CATEGORY-SPECIFIC RULES:
- 00-personal-info: Basic user details, name, member info, basic context ONLY
- 01-preferences: Communication style, content preferences, UI/UX preferences ONLY  
- 02-interests: Topics of interest, hobbies, professional interests ONLY
- 03-interaction-history: Recent conversations, recurring questions, unresolved issues ONLY
- 04-relationship: Communication quality, emotional patterns, personalization strategies ONLY`;

      const userPrompt = `Refine the following ${entry.category} memory data:

${entry.content}

STRICT REQUIREMENTS:
- Remove ALL content that belongs to other categories (00-personal-info, 01-preferences, 02-interests, 03-interaction-history, 04-relationship)
- Keep ONLY content that is specific to ${entry.category}
- Remove placeholder text and "Not enough data" entries
- Use clean, consistent markdown formatting
- Be concise but preserve important details
- Maintain the category's specific purpose
- If content is mostly from other categories, return minimal placeholder

EXAMPLE OF WHAT TO REMOVE:
- If this is 00-personal-info, remove all preferences, interests, interaction history, relationship data
- If this is 01-preferences, remove all personal info, interests, interaction history, relationship data
- Each category should be completely independent`;

      const refinedContent = await callRefineAI(systemPrompt, userPrompt);
      
      if (refinedContent) {
        // 데이터베이스 업데이트
        const { error } = await supabase
          .from('memory_bank')
          .update({
            content: refinedContent,
            updated_at: new Date().toISOString(),
            last_refined_at: new Date().toISOString()
          })
          .eq('user_id', userId)
          .eq('category', entry.category);

        if (error) {
          console.error(`❌ [REFINE] Failed to update ${entry.category}:`, error);
          results.push({ category: entry.category, success: false, error: error.message });
        } else {
          console.log(`✅ [REFINE] Successfully refined ${entry.category}`);
          results.push({ category: entry.category, success: true });
        }
      } else {
        console.error(`❌ [REFINE] AI refinement failed for ${entry.category}`);
        results.push({ category: entry.category, success: false, error: 'AI refinement failed' });
      }
    }

    return { success: true, results };
  } catch (error) {
    console.error(`❌ [REFINE] Error refining memory for user ${userId}:`, error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function GET(req: NextRequest) {
  return handleRefineRequest(req);
}

export async function POST(req: NextRequest) {
  return handleRefineRequest(req);
}

async function handleRefineRequest(req: NextRequest) {
  try {
    // Cron job 보안 검증
    const authHeader = req.headers.get('Authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (authHeader && cronSecret) {
      // Cron job에서 호출된 경우
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized cron request' }, { status: 401 });
      }
    } else {
      // 수동 호출인 경우 - mode=manual일 때는 인증 우회 (테스트용)
      const { searchParams } = new URL(req.url);
      const mode = searchParams.get('mode');
      
      if (mode !== 'manual') {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
      }
    }

    const serviceSupabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { searchParams } = new URL(req.url);
    const mode = searchParams.get('mode') || 'priority'; // 'priority' or 'manual'
    const userId = searchParams.get('user_id'); // 수동 refine용

    let usersToProcess = [];

    if (mode === 'manual' && userId) {
      // 수동 refine: 특정 사용자
      usersToProcess = [{ user_id: userId }];
    } else {
      // 자동 refine: 우선순위 기반
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

      // High Priority: 최근 7일 내 10+ 메시지, 30일 이상 refine 안된 유저
      const { data: highPriorityUsers } = await serviceSupabase
        .from('memory_bank')
        .select('user_id')
        .is('last_refined_at', null)
        .or(`last_refined_at.lt.${thirtyDaysAgo.toISOString()}`)
        .limit(10);

      // Medium Priority: 30일 이상 refine 안된 유저
      const { data: mediumPriorityUsers } = await serviceSupabase
        .from('memory_bank')
        .select('user_id')
        .or(`last_refined_at.lt.${sixtyDaysAgo.toISOString()}`)
        .limit(10);

      usersToProcess = [
        ...(highPriorityUsers || []),
        ...(mediumPriorityUsers || [])
      ].slice(0, 20); // 최대 20명
    }

    if (usersToProcess.length === 0) {
      return NextResponse.json({ 
        message: 'No users need memory refinement',
        processed: 0 
      });
    }

    console.log(`🔧 [REFINE] Processing ${usersToProcess.length} users`);

    const results = [];
    for (const user of usersToProcess) {
      const result = await refineUserMemory(user.user_id, serviceSupabase);
      results.push({
        user_id: user.user_id,
        ...result
      });
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;

    return NextResponse.json({
      message: `Memory refinement completed`,
      processed: results.length,
      successful: successCount,
      failed: failureCount,
      results: results
    });

  } catch (error) {
    console.error('❌ [REFINE] Memory refine API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
