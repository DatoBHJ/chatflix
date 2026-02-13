import { createClient as createServiceClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { ALLOWED_MEMORY_CATEGORY_ARRAY, isAllowedMemoryCategory } from '@/utils/memory-bank';
import { getUserLocaleInfo, getUserTrendsPreferences, formatTrendsPreferencesForPrompt } from '@/lib/user-locale';
import { getGeoOptions } from '@/lib/trends/options';

type AllowedMemoryCategory = typeof ALLOWED_MEMORY_CATEGORY_ARRAY[number];

// AI model configuration used for memory refinement
const REFINE_MODEL = 'gemini-2.5-flash-lite';
const REFINE_MAX_TOKENS = 4000; // Increased to cover roughly 50 messages per run

const MEMORY_CATEGORIES = {
  PERSONAL_CORE: '00-personal-core',
  INTEREST_CORE: '01-interest-core',
  ACTIVE_CONTEXT: '02-active-context'
} as const;

function describeTrendsPreference(preference?: ReturnType<typeof formatTrendsPreferencesForPrompt>): string {
  if (!preference) {
    return '';
  }

  const countryLabel = preference.countryName || preference.countryCode || '';
  const regionLabel = preference.regionName || preference.regionCode || '';

  if (countryLabel && regionLabel) {
    return `${countryLabel}, ${regionLabel}`;
  }

  return countryLabel || regionLabel || '';
}

/**
 * Generic helper to call the Google AI API for memory refinement.
 */
async function callRefineAI(
  systemPrompt: string,
  userPrompt: string,
  retryCount: number = 0
): Promise<string | null> {
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 2000; // 2 seconds

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
          thinkingConfig: {
            thinking_budget: 0
          }
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`❌ [REFINE] API call failed with status ${response.status}: ${errorData}`);
      
      // Retry transient 502/503/504 errors
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
    // Retry for network or generic fetch failures as well
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
 * Execute the memory refine workflow for a single user.
 */
async function refineUserMemory(userId: string, supabase: any, categoryFilter?: AllowedMemoryCategory) {
  try {
    console.log(`🔧 [REFINE] Starting memory refine for user ${userId}`);

    // Fetch current memory entries (allowed categories only)
    const query = supabase
      .from('memory_bank')
      .select('category, content')
      .eq('user_id', userId)
      .in('category', ALLOWED_MEMORY_CATEGORY_ARRAY)
      .order('category');

    if (categoryFilter) {
      query.eq('category', categoryFilter);
    }

    const { data: memoryEntries } = await query;

    if (!memoryEntries || memoryEntries.length === 0) {
      return { success: false, error: 'No memory entries found' };
    }

    // Fetch a larger batch of recent messages to give the model context
    const { data: recentMessages, error: messagesError } = await supabase
      .from('messages')
      .select('role, content, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50); // allow up to 50 messages for richer refinement context

    if (messagesError) {
      console.warn(`⚠️ [REFINE] Could not fetch recent messages for user ${userId}:`, messagesError.message);
    }

    // Flatten the conversation into a single text block
    const conversationText = recentMessages && recentMessages.length > 0 
      ? recentMessages.map((msg: any) => `${msg.role}: ${msg.content}`).join('\n')
      : 'No recent conversation data available';

    // Store refined content in map (for multi-category refine flows)
    const refinedContentMap: Record<string, string> = {};

    console.log(`📝 [REFINE] Fetched ${recentMessages?.length || 0} recent messages for user ${userId}`);

    let successCount = 0;
    let errorCount = 0;

    // Sort entries: personal-core, interest-core, active-context
    const sortedEntries = [...memoryEntries].sort((a, b) => {
      const order = ['00-personal-core', '01-interest-core', '02-active-context'];
      const aIndex = order.indexOf(a.category);
      const bIndex = order.indexOf(b.category);
      if (aIndex === -1 && bIndex === -1) return 0;
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });

    // Iterate over each category in the correct order
    for (const entry of sortedEntries) {
      let systemPrompt = '';
      let userPrompt = '';

      if (entry.category === MEMORY_CATEGORIES.PERSONAL_CORE) {
        const [localeInfo, trendsPreferencesRaw] = await Promise.all([
          getUserLocaleInfo(userId, supabase),
          getUserTrendsPreferences(userId, supabase),
        ]);

        const localeContext = localeInfo ? JSON.stringify(localeInfo) : '';
        const geoOptions = trendsPreferencesRaw ? await getGeoOptions() : null;
        const formattedTrendsPreferences = trendsPreferencesRaw
          ? formatTrendsPreferencesForPrompt(trendsPreferencesRaw, geoOptions || [])
          : null;
        const trendsDescription = describeTrendsPreference(formattedTrendsPreferences || undefined);
        const trendsContext = formattedTrendsPreferences
          ? {
              country_code: formattedTrendsPreferences.countryCode,
              country_name: formattedTrendsPreferences.countryName,
              region_code: formattedTrendsPreferences.regionCode,
              region_name: formattedTrendsPreferences.regionName,
              description: trendsDescription,
            }
          : null;
        const trendsContextBlock = trendsContext
          ? `TRENDS PREFERENCES CONTEXT:\n${JSON.stringify(trendsContext)}\n\nIMPORTANT: The user manually tracks trending topics from ${trendsDescription || 'the specified location'}. Mention this interest naturally in ## Basic Details (e.g., "Interested in trends from United States, California") and avoid duplicating the same location info if USER LOCALE CONTEXT already covers it.\n\n`
          : '';

        systemPrompt = `You are a memory refinement specialist for personal information. Rewrite the profile so it reads like how a close colleague would describe the user.

CRITICAL FORMAT REQUIREMENTS:
- Output ONLY these sections in this exact order: ## Basic Details, ## Professional Context, ## Key Characteristics
- Each section may contain up to 3 short bullet sentences (no nested lists, no enumerated examples)
- Never repeat the same fact in multiple sections
- Start each sentence directly with the fact; avoid generic openings like "the user...", "they...", or "he/she..."
- No meta commentary or additional prose outside the sections
- Treat EXISTING MEMORY DATA as durable baseline and preserve established facts unless clearly contradicted.
- Do not erase long-term profile facts just because they are absent from recent messages.

LOCALE INFORMATION USAGE:
- If USER LOCALE CONTEXT is provided, use it to determine the user's primary language and location
- The language field in locale context indicates the user's preferred language (e.g., "ko" = Korean, "en" = English)
- Use this language to write the entire profile in the same language
- Include location information (country, region) in Basic Details section if available
- Store the language preference explicitly in Basic Details section

TRENDS PREFERENCES USAGE:
- If TRENDS PREFERENCES CONTEXT is provided, the user manually selected a specific country/region for the Trending widget
- Treat it as an active interest and weave it naturally into ## Basic Details (e.g., "Interested in trends from United States, California")
- Prefer the provided human-readable names; fall back to codes when names are missing
- Do not duplicate locale information—merge the trend interest with existing location facts when they refer to the same place

GUIDELINES:
1. Compress long lists into memorable sentences capturing only core traits
2. If data is missing use "- [To be determined]" instead of fabricating info
3. If locale information is provided, prioritize it over inferring from conversation content`;

        userPrompt = `Refine the following personal information by combining existing memory with recent conversation context. Keep only the essence.

${localeContext ? `USER LOCALE CONTEXT:\n${localeContext}\n\nIMPORTANT: Use the language field from the locale context to determine the output language. If language is "ko", write in Korean. If "en", write in English. Include location and language information in the Basic Details section.\n\n` : ''}${trendsContextBlock}EXISTING MEMORY DATA:
${entry.content}

RECENT CONVERSATION CONTEXT (last 50 messages):
${conversationText}

Return a markdown profile containing ONLY the sections ## Basic Details, ## Professional Context, ## Key Characteristics abiding by the rules above.`;

      } else if (entry.category === MEMORY_CATEGORIES.INTEREST_CORE) {
        systemPrompt = `You are a memory refinement specialist for user interest core.

CRITICAL FORMAT REQUIREMENTS:
- Output ONLY this section: ## Primary Interests
- Keep 3-6 bullets maximum
- Each bullet must use this format: "<topic>: <engagement-strength>"
- Keep only stable, recurring interest themes
- Remove tool logs, micro experiments, and one-off details
- Merge semantically similar topics
- No additional commentary outside the section
- Treat EXISTING MEMORY DATA as baseline; preserve durable interests unless contradicted by strong evidence.
- Recent conversation may add/tune interests, but must not replace the whole profile with one transient topic.`;

        userPrompt = `Refine the following interest-core profile using existing memory and recent conversation context.

EXISTING MEMORY DATA:
${entry.content}

RECENT CONVERSATION CONTEXT (last 50 messages):
${conversationText}

Return markdown with ONLY the section ## Primary Interests.`;
      } else if (entry.category === MEMORY_CATEGORIES.ACTIVE_CONTEXT) {
        systemPrompt = `You are a memory refinement specialist for active context.

CRITICAL FORMAT REQUIREMENTS:
- Output ONLY these sections in order: ## Current Focus, ## Learning Snapshot
- Keep each section 1-3 bullets maximum
- Keep content short-lived and recent
- Remove stale, duplicated, or outdated items
- No additional commentary outside the sections`;

        userPrompt = `Refine the following active-context profile using existing memory and recent conversation context.

EXISTING MEMORY DATA:
${entry.content}

RECENT CONVERSATION CONTEXT (last 50 messages):
${conversationText}

Return markdown with ONLY the sections ## Current Focus and ## Learning Snapshot.`;

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
        refinedContentMap[entry.category] = refinedContent;

        // Persist the refined content back to the database
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
    let mode = searchParams.get('mode') || 'priority'; // 'priority' or 'manual'
    let userId = searchParams.get('user_id'); // manual refine target
    let categoryParam = searchParams.get('category'); // optional category filter

    if (req.method === 'POST') {
      const contentType = req.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        try {
          const body = await req.json();
          mode = body.mode || mode;
          userId = body.user_id || userId;
          categoryParam = body.category ?? categoryParam;
        } catch (bodyError) {
          console.warn('⚠️ [REFINE] Failed to parse JSON body for refine request:', bodyError);
        }
      }
    }
    let normalizedCategory: AllowedMemoryCategory | undefined = undefined;

    if (categoryParam) {
      if (isAllowedMemoryCategory(categoryParam)) {
        normalizedCategory = categoryParam;
      } else {
        return NextResponse.json({ error: 'Invalid category parameter' }, { status: 400 });
      }
    }

    let usersToProcess: { user_id: string }[] = [];

    if (mode === 'manual' && userId) {
      // Manual refine mode: process only the requested user
      usersToProcess = [{ user_id: userId }];
      console.log(`🔧 [REFINE] Manual mode: processing user ${userId}${normalizedCategory ? `, category ${normalizedCategory}` : ''}`);
    } else {
      // Hybrid strategy placeholder: keep a fixed ratio if needed
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      console.log('🔧 [REFINE] Selecting users with hybrid balance strategy (15 active : 5 inactive)...');

      // Get all memory_bank rows to analyze (already filtered by allowed categories)
      const { data: allRows } = await serviceSupabase
        .from('memory_bank')
        .select('user_id, updated_at, last_refined_at')
        .in('category', ALLOWED_MEMORY_CATEGORY_ARRAY)
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
        batch.map(user => refineUserMemory(user.user_id, serviceSupabase, normalizedCategory))
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