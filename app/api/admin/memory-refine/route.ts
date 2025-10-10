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

    // 각 카테고리별로 refine - memoryService.ts 구조에 맞춘 카테고리별 프롬프트
    for (const entry of memoryEntries) {
      let systemPrompt = '';
      let userPrompt = '';

      if (entry.category === '00-personal-info') {
        systemPrompt = `You are a memory refinement specialist for personal information. Create a comprehensive user profile in markdown format with the following sections:

## Basic Details
- Name, Member since, Last active, Language preference

## Professional Context  
- Occupation, Expertise level, Fields

## Usage Patterns
- Typical activity, Session frequency

IMPORTANT GUIDELINES:
1. Only include information that can be reliably inferred from the conversation or provided user data.
2. DO NOT make up information that wasn't mentioned or isn't provided.
3. If information isn't available, keep the existing placeholder text in brackets.
4. If updating an existing profile, integrate new observations while preserving previous insights.
5. Format as a structured markdown document with clear sections.
6. Focus on creating a useful reference that helps understand the user's background and context.`;

        userPrompt = `Refine the following personal information using both existing memory and recent conversation context:

EXISTING MEMORY DATA:
${entry.content}

RECENT CONVERSATION CONTEXT (last 50 messages):
${conversationText}

Create a comprehensive user profile with Basic Details, Professional Context, and Usage Patterns sections (excluding preferred models).`;

      } else if (entry.category === '01-preferences') {
        systemPrompt = `You are a memory refinement specialist for user preferences. Create a comprehensive preference profile in markdown format with the following sections:

## Communication Style
- Preferred response length, Technical detail level, Tone preference, Language style

## Content Preferences
- Code examples, Visual elements, Step-by-step guides, References inclusion

## UI/UX Preferences
- Response format, Follow-up style

IMPORTANT GUIDELINES:
1. If this is the first time analyzing preferences, create a complete profile based on available information.
2. If updating an existing profile, integrate new observations while preserving previous insights.
3. Only include preferences that can be reliably inferred from the conversation.
4. If certain preferences can't be determined, indicate "Not enough data" rather than guessing.
5. Format as a structured markdown document with clear sections.`;

        userPrompt = `Refine the following preferences using both existing memory and recent conversation context:

EXISTING MEMORY DATA:
${entry.content}

RECENT CONVERSATION CONTEXT (last 50 messages):
${conversationText}

Create a comprehensive preference profile with Communication Style, Content Preferences, and UI/UX Preferences sections.`;

      } else if (entry.category === '02-interests') {
        systemPrompt = `You are a memory refinement specialist for user interests. Create a comprehensive interest profile in markdown format with the following sections:

## Primary Interests
- Identify 3-5 main topics the user frequently discusses or asks about
- For each interest, note subtopics and engagement level (high/medium/low)

## Recent Topics
- List 2-3 topics from recent conversations
- Include when they were last discussed (if possible)

## Learning Journey
- Current focus: Topics the user is actively learning or exploring
- Progress areas: Topics where the user shows increasing expertise
- Challenging areas: Topics where the user seems to need more support

IMPORTANT GUIDELINES:
1. Focus on identifying genuine interests, not just passing mentions.
2. Look for patterns across multiple messages or sessions.
3. Prioritize recurring topics that show sustained interest.
4. If updating an existing profile, integrate new observations while preserving previous insights.
5. Format as a structured markdown document with clear sections.
6. Be specific about topics rather than using generic categories.`;

        userPrompt = `Refine the following interests using both existing memory and recent conversation context:

EXISTING MEMORY DATA:
${entry.content}

RECENT CONVERSATION CONTEXT (last 50 messages):
${conversationText}

Create a comprehensive interest profile with Primary Interests, Recent Topics, and Learning Journey sections.`;

      } else if (entry.category === '03-interaction-history') {
        systemPrompt = `You are a memory refinement specialist for interaction history. Create a comprehensive interaction history in markdown format with the following sections:

## Recent Conversations
- Today's conversation summary with main topics and any conclusions reached
- Focus on capturing actionable information and important outcomes

## Recurring Questions
- Identify any questions or topics that seem to repeat across conversations
- Note the frequency and context of these recurring patterns

## Unresolved Issues
- Note any questions or problems that weren't fully addressed
- Include any tasks the user mentioned they wanted to complete

IMPORTANT GUIDELINES:
1. Prioritize information that will be useful for future interactions.
2. Focus on factual summaries rather than interpretations.
3. If updating existing history, place the new interaction at the top of the Recent Conversations section.
4. Include dates wherever possible to maintain chronology.
5. Format as a structured markdown document with clear sections.
6. Keep the history concise but comprehensive.`;

        userPrompt = `Refine the following interaction history using both existing memory and recent conversation context:

EXISTING MEMORY DATA:
${entry.content}

RECENT CONVERSATION CONTEXT (last 50 messages):
${conversationText}

Create a comprehensive interaction history with Recent Conversations, Recurring Questions, and Unresolved Issues sections.`;

      } else if (entry.category === '04-relationship') {
        systemPrompt = `You are a memory refinement specialist for AI-user relationship. Create a comprehensive relationship profile in markdown format with the following sections:

## Communication Quality
- Trust level: How much does the user seem to trust the AI's responses?
- Satisfaction indicators: Evidence of satisfaction or dissatisfaction
- Engagement level: How detailed and engaged are their messages?

## Emotional Patterns
- Typical emotional tone: Neutral/Positive/Negative patterns in communication
- Response to feedback: How they react when corrected or given new information
- Frustration triggers: Topics or response styles that seem to cause frustration

## Personalization Strategy
- Effective approaches: Communication strategies that work well with this user
- Approaches to avoid: Communication patterns that don't resonate with this user
- Relationship goals: How to improve the interaction quality over time

IMPORTANT GUIDELINES:
1. Focus on objective observations rather than judgments.
2. If updating existing data, integrate new observations while preserving previous insights.
3. Be specific about observable communication patterns.
4. Don't make assumptions about the user's actual feelings or thoughts.
5. Format as a structured markdown document with clear sections.
6. Focus on insights that will help improve future interactions.`;

        userPrompt = `Refine the following relationship profile using both existing memory and recent conversation context:

EXISTING MEMORY DATA:
${entry.content}

RECENT CONVERSATION CONTEXT (last 50 messages):
${conversationText}

Create a comprehensive relationship profile with Communication Quality, Emotional Patterns, and Personalization Strategy sections.`;

      } else {
        // Fallback for unknown categories
        systemPrompt = `You are a memory refinement specialist. Clean up and optimize user memory data for the ${entry.category} category.`;
        userPrompt = `Refine the following ${entry.category} memory data:

EXISTING MEMORY DATA:
${entry.content}

RECENT CONVERSATION CONTEXT (last 50 messages):
${conversationText}

Make the content concise, well-organized, and up-to-date.`;
      }

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