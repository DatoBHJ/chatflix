import { createClient as createServiceClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Refine에 사용할 AI 모델 설정
const REFINE_MODEL = 'gemini-2.5-flash';
const REFINE_MAX_TOKENS = 3000; // 50개 메시지 처리용 토큰 증가
const REFINE_TEMPERATURE = 0.2;

/**
 * 메모리 refine을 위한 AI 호출 (Google AI API 사용)
 */
async function callRefineAI(
  systemPrompt: string,
  userPrompt: string,
  retryCount: number = 0
): Promise<string | null> {
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 2000; // 2초

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${REFINE_MODEL}:generateContent?key=${process.env.GOOGLE_GENERATIVE_AI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `${systemPrompt}\n\n${userPrompt}`
          }]
        }],
        generationConfig: {
          maxOutputTokens: REFINE_MAX_TOKENS,
          temperature: REFINE_TEMPERATURE,
          thinkingConfig: {
            thinking_budget: 0
          }
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`❌ [REFINE] API call failed with status ${response.status}: ${errorData}`);
      
      // 502, 503, 504 에러는 재시도 가능
      if ((response.status === 502 || response.status === 503 || response.status === 504) && retryCount < MAX_RETRIES) {
        console.log(`🔄 [REFINE] Retrying API call (attempt ${retryCount + 1}/${MAX_RETRIES}) after ${response.status} error`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (retryCount + 1)));
        return callRefineAI(systemPrompt, userPrompt, retryCount + 1);
      }
      throw new Error(`Google AI API error: ${response.status} - ${errorData}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch (error) {
    // 네트워크 에러나 기타 에러도 재시도
    if (retryCount < MAX_RETRIES) {
      console.log(`🔄 [REFINE] Retrying API call (attempt ${retryCount + 1}/${MAX_RETRIES}) after error:`, error instanceof Error ? error.message : 'Unknown error');
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (retryCount + 1)));
      return callRefineAI(systemPrompt, userPrompt, retryCount + 1);
    }
    
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

CRITICAL FORMAT REQUIREMENTS:
- MUST preserve all existing section headers (## Basic Details, ## Professional Context, ## Usage Patterns)
- MUST maintain the same language as the existing profile
- DELETE any content that doesn't fit the required format
- Content format within sections can be flexible (bullet points, paragraphs, numbered lists, etc.)

GUIDELINES:
1. Only include information that can be reliably inferred from the conversation or provided user data
2. DO NOT make up information that wasn't mentioned or isn't provided
3. If information isn't available, keep the existing placeholder text in brackets
4. Analyze conversation to detect user's preferred language and maintain consistency`;

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

## Response Format Preferences
- Response format, Follow-up style

CRITICAL FORMAT REQUIREMENTS:
- MUST preserve all existing section headers (## Communication Style, ## Content Preferences, ## Response Format Preferences)
- MUST maintain the same language as the existing profile
- DELETE any content that doesn't fit the required format
- Content format within sections can be flexible (bullet points, paragraphs, numbered lists, etc.)

GUIDELINES:
1. Only include preferences that can be reliably inferred from the conversation
2. If certain preferences can't be determined, indicate "Not enough data" rather than guessing
3. If updating an existing profile, integrate new observations while preserving previous insights
4. Analyze conversation to detect user's preferred language and maintain consistency`;

        userPrompt = `Refine the following preferences using both existing memory and recent conversation context:

EXISTING MEMORY DATA:
${entry.content}

RECENT CONVERSATION CONTEXT (last 50 messages):
${conversationText}

Create a comprehensive preference profile with Communication Style, Content Preferences, and Response Format Preferences sections.`;

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

CRITICAL FORMAT REQUIREMENTS:
- MUST preserve all existing section headers (## Primary Interests, ## Recent Topics, ## Learning Journey)
- MUST maintain the same language as the existing profile
- DELETE any content that doesn't fit the required format
- Content format within sections can be flexible (bullet points, paragraphs, numbered lists, etc.)

GUIDELINES:
1. Focus on identifying genuine interests, not just passing mentions
2. Look for patterns across multiple messages or sessions
3. Prioritize recurring topics that show sustained interest
4. Analyze conversation to detect user's preferred language and maintain consistency`;

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

CRITICAL FORMAT REQUIREMENTS:
- MUST preserve all existing section headers (## Recent Conversations, ## Recurring Questions, ## Unresolved Issues)
- MUST maintain the same language as the existing profile
- DELETE any content that doesn't fit the required format
- Content format within sections can be flexible (bullet points, paragraphs, numbered lists, etc.)

GUIDELINES:
1. Prioritize information that will be useful for future interactions
2. Focus on factual summaries rather than interpretations
3. If updating existing history, place the new interaction at the top of the Recent Conversations section
4. Analyze conversation to detect user's preferred language and maintain consistency`;

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

CRITICAL FORMAT REQUIREMENTS:
- MUST preserve all existing section headers (## Communication Quality, ## Emotional Patterns, ## Personalization Strategy)
- MUST maintain the same language as the existing profile
- DELETE any content that doesn't fit the required format
- Content format within sections can be flexible (bullet points, paragraphs, numbered lists, etc.)

GUIDELINES:
1. Focus on objective observations rather than judgments
2. Be specific about observable communication patterns
3. Don't make assumptions about the user's actual feelings or thoughts
4. Analyze conversation to detect user's preferred language and maintain consistency`;

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

    let usersToProcess: { user_id: string }[] = [];

    if (mode === 'manual' && userId) {
      // 수동 refine: 특정 사용자만 처리
      usersToProcess = [{ user_id: userId }];
      console.log(`🔧 [REFINE] Manual mode: processing user ${userId}`);
    } else {
      // 하이브리드 균형 전략: 고정 비율 유지
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      console.log('🔧 [REFINE] Selecting users with hybrid balance strategy (15 active : 5 inactive)...');

      // Get all memory_bank rows to analyze
      const { data: allRows } = await serviceSupabase
        .from('memory_bank')
        .select('user_id, updated_at, last_refined_at')
        .order('user_id', { ascending: true });

      if (!allRows || allRows.length === 0) {
        usersToProcess = [];
      } else {
        // Group by user_id and get latest updated_at and last_refined_at
        const userMap = new Map<string, { updated_at: string; last_refined_at: string | null }>();
        
        for (const row of allRows) {
          const existing = userMap.get(row.user_id);
          if (!existing || new Date(row.updated_at) > new Date(existing.updated_at)) {
            userMap.set(row.user_id, {
              updated_at: row.updated_at,
              last_refined_at: row.last_refined_at
            });
          }
        }

        // Categorize users by priority tier
        const tier1Users: string[] = []; // Critical active (daily)
        const tier2Users: string[] = []; // Regular active (every 3 days)
        const tier3Users: string[] = []; // Inactive (weekly)

        for (const [userId, data] of userMap.entries()) {
          const updatedAt = new Date(data.updated_at);
          const lastRefinedAt = data.last_refined_at ? new Date(data.last_refined_at) : null;
          
          // Check if needs refinement
          const needsRefinement = !lastRefinedAt || 
            (lastRefinedAt < oneDayAgo && updatedAt > sevenDaysAgo) ||
            (lastRefinedAt < threeDaysAgo && updatedAt > thirtyDaysAgo) ||
            (lastRefinedAt < sevenDaysAgo && updatedAt <= thirtyDaysAgo);

          if (!needsRefinement) continue;

          // Categorize by tier
          if (updatedAt > sevenDaysAgo && (!lastRefinedAt || lastRefinedAt < oneDayAgo)) {
            tier1Users.push(userId);
          } else if (updatedAt > thirtyDaysAgo && (!lastRefinedAt || lastRefinedAt < threeDaysAgo)) {
            tier2Users.push(userId);
          } else if (!lastRefinedAt || lastRefinedAt < sevenDaysAgo) {
            tier3Users.push(userId);
          }
        }

        // Fixed allocation: 12 Tier1 + 3 Tier2 + 5 Tier3 = 20 users
        const selectedUsers = [
          ...tier1Users.slice(0, 12),      // Critical Active: 12 users
          ...tier2Users.slice(0, 3),        // Regular Active: 3 users
          ...tier3Users.slice(0, 5)         // Inactive: 5 users
        ];

        usersToProcess = selectedUsers.map(user_id => ({ user_id }));
        
        console.log(`🔧 [REFINE] Priority breakdown (Hybrid Balance):`);
        console.log(`   - Tier 1 (Critical Active): ${tier1Users.length} eligible, ${Math.min(tier1Users.length, 12)} selected`);
        console.log(`   - Tier 2 (Regular Active): ${tier2Users.length} eligible, ${Math.min(tier2Users.length, 3)} selected`);
        console.log(`   - Tier 3 (Inactive): ${tier3Users.length} eligible, ${Math.min(tier3Users.length, 5)} selected`);
        console.log(`🔧 [REFINE] Total selected: ${usersToProcess.length} users (Target: 20, Ratio: 75% active / 25% inactive)`);
        
        if (usersToProcess.length > 0) {
          console.log(`🔧 [REFINE] Selected users: ${usersToProcess.map(u => u.user_id.substring(0, 8)).join(', ')}`);
        }
      }
    }

    if (usersToProcess.length === 0) {
      return NextResponse.json({ 
        message: 'No users need memory refinement',
        processed: 0 
      });
    }

    console.log(`🔧 [REFINE] Processing ${usersToProcess.length} users in parallel batches of 5`);

    const startTime = Date.now();
    const MAX_RUNTIME = 250000; // 250 seconds safety margin
    const BATCH_SIZE = 5;
    const results = [];

    // Process in batches of 5 users in parallel
    for (let i = 0; i < usersToProcess.length; i += BATCH_SIZE) {
      const elapsedTime = Date.now() - startTime;
      
      // Stop if we're approaching timeout
      if (elapsedTime > MAX_RUNTIME) {
        console.log(`⏱️ [REFINE] Timeout approaching (${elapsedTime}ms), stopping early`);
        break;
      }
      
      const batch = usersToProcess.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      console.log(`🔧 [REFINE] Processing batch ${batchNum}: ${batch.length} users`);
      
      // Process batch in parallel
      const batchResults = await Promise.all(
        batch.map(user => refineUserMemory(user.user_id, serviceSupabase))
      );
      
      // Combine results
      for (let j = 0; j < batch.length; j++) {
        results.push({
          user_id: batch[j].user_id,
          ...batchResults[j]
        });
      }
      
      const batchTime = Date.now() - startTime - elapsedTime;
      console.log(`✅ [REFINE] Batch ${batchNum} completed in ${(batchTime / 1000).toFixed(1)}s`);
    }

    const totalTime = Date.now() - startTime;
    console.log(`🎉 [REFINE] All batches completed in ${(totalTime / 1000).toFixed(1)}s`);

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