import { createClient as createServiceClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Refine에 사용할 AI 모델 설정
const REFINE_MODEL = 'gpt-4.1-mini';
const REFINE_MAX_TOKENS = 3000; // 50개 메시지 처리용 토큰 증가
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
      throw new Error(`OpenAI API error: ${response.status}`);
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
      return { success: false, error: 'No memory entries found' };
    }

    // 최신 대화 메시지 가져오기 (refine용으로 더 많은 메시지 사용)
    const { data: recentMessages, error: messagesError } = await supabase
      .from('messages')
      .select('role, content, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50); // refine용으로 50개 메시지 사용

    if (messagesError) {
      console.warn(`⚠️ [REFINE] Could not fetch recent messages for user ${userId}:`, messagesError.message);
    }

    // 대화 메시지를 텍스트로 변환
    const conversationText = recentMessages && recentMessages.length > 0 
      ? recentMessages.map((msg: any) => `${msg.role}: ${msg.content}`).join('\n')
      : 'No recent conversation data available';

    console.log(`📝 [REFINE] Fetched ${recentMessages?.length || 0} recent messages for user ${userId}`);

    let successCount = 0;
    let errorCount = 0;

    // 각 카테고리별로 refine
    for (const entry of memoryEntries) {
      const systemPrompt = `You are a memory refinement specialist. Your task is to clean up and optimize user memory data for the ${entry.category} category ONLY.

CRITICAL RULES FOR ${entry.category}:
- 00-personal-info: Basic user details, name, age range, location, occupation, family, languages, time zone ONLY
- 01-preferences: Communication style, lifestyle preferences (food, entertainment, travel), work style, learning preferences ONLY  
- 02-interests: Detailed hobbies with time investment, sports & fitness, creative activities, technology interests, current projects ONLY
- 03-interaction-history: Chat patterns, response styles, engagement levels, communication preferences ONLY
- 04-relationship: Relationship context, interaction history, personal connection details ONLY

STRICT REQUIREMENTS:
- Remove ALL content that belongs to other categories
- Keep ONLY content that is specific to ${entry.category}
- Make content concise and well-organized
- Remove duplicates and outdated information
- Update outdated information based on recent conversations
- Add new insights that weren't captured in the original memory
- Ensure all information is accurate and up-to-date`;

      const userPrompt = `Refine the following ${entry.category} memory data using both the existing memory and recent conversation context:

EXISTING MEMORY DATA:
${entry.content}

RECENT CONVERSATION CONTEXT (last 50 messages):
${conversationText}

STRICT REQUIREMENTS:
- Remove ALL content that belongs to other categories (00-personal-info, 01-preferences, 02-interests, 03-interaction-history, 04-relationship)
- Keep ONLY content that is specific to ${entry.category}
- Make content concise and well-organized
- Remove duplicates and outdated information
- Update outdated information based on recent conversations
- Add new insights that weren't captured in the original memory
- Ensure all information is accurate and up-to-date

EXAMPLE OF WHAT TO REMOVE:
- If refining 00-personal-info: Remove any communication preferences, lifestyle choices, hobbies, or relationship details
- If refining 01-preferences: Remove any personal demographics, specific interests, or relationship information
- If refining 02-interests: Remove any personal info, preferences, or relationship details
- If refining 03-interaction-history: Remove any personal demographics, preferences, or interests
- If refining 04-relationship: Remove any personal info, preferences, or interests

Return ONLY the refined content for ${entry.category} category.`;

      const refinedContent = await callRefineAI(systemPrompt, userPrompt);
      
      if (refinedContent) {
        // 데이터베이스 업데이트
        const { error } = await supabase
          .from('memory_bank')
          .update({ 
            content: refinedContent,
            last_refined_at: new Date().toISOString()
          })
          .eq('user_id', userId)
          .eq('category', entry.category);

        if (error) {
          console.error(`❌ [REFINE] Failed to update ${entry.category} for user ${userId}:`, error);
          errorCount++;
        } else {
          console.log(`✅ [REFINE] Successfully refined ${entry.category} for user ${userId}`);
          successCount++;
        }
      } else {
        console.error(`❌ [REFINE] Failed to refine ${entry.category} for user ${userId}`);
        errorCount++;
      }
    }

    return { 
      success: successCount > 0, 
      successCount, 
      errorCount,
      totalCategories: memoryEntries.length
    };

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
    console.log('🔧 [REFINE] Starting memory refine request');

    const serviceSupabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { searchParams } = new URL(req.url);
    const mode = searchParams.get('mode') || 'priority'; // 'priority' or 'manual'
    const userId = searchParams.get('user_id'); // 수동 refine용

    let usersToProcess = [];

    if (mode === 'manual' && userId) {
      // 수동 refine: 특정 사용자만 처리
      usersToProcess = [{ user_id: userId }];
      console.log(`🔧 [REFINE] Manual mode: processing user ${userId}`);
    } else {
      // 자동 refine: 하루에 5명씩 순차 처리 (성능 최적화)
      // 아직 refine되지 않은 사용자들부터 처리
      const { data: users } = await serviceSupabase
        .from('memory_bank')
        .select('user_id, last_refined_at')
        .is('last_refined_at', null)
        .order('created_at', { ascending: true })
        .limit(10);

      usersToProcess = users || [];
      console.log(`🔧 [REFINE] Daily batch: processing ${usersToProcess.length} users`);
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