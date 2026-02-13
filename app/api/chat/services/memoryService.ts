import { SupabaseClient } from '@supabase/supabase-js';
import { updateMemoryBank, getLastMemoryUpdate, getMemoryBankEntry, getAllMemoryBank } from '@/utils/memory-bank';
// import { MultiModalMessage } from '../types';
import { callMemoryBankUpdate } from '@/app/api/chat/utils/callMemoryBankUpdate';
import { getCachedUserName } from '@/lib/user-name-cache';
import { getUserLocaleInfo, getUserTrendsPreferences, formatTrendsPreferencesForPrompt } from '@/lib/user-locale';
import { getGeoOptions } from '@/lib/trends/options';

// Internal function to fetch user name from database (without cache)
const fetchUserNameFromDB = async (userId: string, supabase: SupabaseClient) => {
  try {
    // First try to get name from all_user table
    const { data, error } = await supabase
      .from('all_user')
      .select('name')
      .eq('id', userId)
      .single();

    if (error) {
      // Single auth call with better error handling
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user) {
          return 'You';
        }
        
        const authName = user.user_metadata?.full_name || user.user_metadata?.name || 'You';
        return authName;
      } catch (authErr) {
        return 'You';
      }
    } else if (data?.name) {
      return data.name;
    } else {
      return 'You';
    }
  } catch (error) {
    return 'You'; // 안전한 폴백
  }
};

// fetchUserName 함수 - Redis 캐시를 사용하는 최적화된 버전
const fetchUserName = async (userId: string, supabase: SupabaseClient) => {
  // Use cached version for better performance
  return await getCachedUserName(userId, () => fetchUserNameFromDB(userId, supabase));
};

// 메모리 뱅크 업데이트에 사용할 AI 모델 및 설정
const MEMORY_UPDATE_MODEL = 'gemini-2.5-flash';
const MEMORY_UPDATE_MAX_TOKENS = 4000;

// 🆕 Smart Trigger 관련 상수
const MEMORY_ANALYSIS_MODEL = 'gemini-2.5-flash-lite'; // Gemini 2.5 Flash Lite 모델 사용
const MAX_TIME_SINCE_LAST_UPDATE = 24 * 60 * 60 * 1000; // 최대 24시간

const describeTrendsPreference = (
  preference?: ReturnType<typeof formatTrendsPreferencesForPrompt>,
): string => {
  if (!preference) {
    return '';
  }

  const countryLabel = preference.countryName || preference.countryCode || '';
  const regionLabel = preference.regionName || preference.regionCode || '';

  if (countryLabel && regionLabel) {
    return `${countryLabel}, ${regionLabel}`;
  }

  return countryLabel || regionLabel || '';
};

/**
 * 메모리 업데이트 필요성 분석 (Smart Trigger)
 */
export async function shouldUpdateMemory(
  supabase: SupabaseClient,
  userId: string,
  messages: any[],
  userMessage: string,
  aiMessage: string,
  memoryData?: string | null
): Promise<{
  shouldUpdate: boolean;
  reasons: string[];
  categories: string[];
  edits?: Array<{
    category: string;
    editIntent: 'add' | 'delete' | 'modify';
    targetContent: string;
  }>;
}> {
  try {
    // 1. 기본 조건 확인
    const lastUpdate = await getLastMemoryUpdate(supabase, userId);
    const now = new Date();
    const timeSinceLastUpdate = lastUpdate ? (now.getTime() - lastUpdate.getTime()) : Infinity;
    
    // 메모리 데이터가 기본값인지 확인 (먼저 선언)
    const isDefaultMemory = memoryData &&
      memoryData.includes('This section contains basic information about the user');
    
    // 2. 강제 업데이트 조건들 (더 엄격하게)
    if (!lastUpdate) {
      // 첫 업데이트인 경우에만 강제 업데이트
      return {
        shouldUpdate: true,
        reasons: ['First memory update'],
        categories: ['all']
      };
    }
    
    // 24시간이 지났으면 업데이트 (기본 메모리 데이터가 있어도 시간 기반으로 업데이트)
    if (timeSinceLastUpdate > MAX_TIME_SINCE_LAST_UPDATE) {
      return {
        shouldUpdate: true,
        reasons: ['Maximum time threshold reached'],
        categories: ['all']
      };
    }
    
    
    // 3. AI 분석을 통한 컨텍스트 중요도 판단
    const recentConversation = convertMessagesToText(messages.slice(-3));
    
    // Define the analysis response schema for structured output
    const analysisSchema = {
      type: "object",
      properties: {
        shouldUpdate: { type: "boolean" },
        categories: {
          type: "array", 
          items: { type: "string" },
          description: "Categories eligible for real-time updates: personal-core, interest-core, active-context"
        },
        reasons: { 
          type: "array", 
          items: { type: "string" },
          description: "Brief reasons for the decision"
        },
        edits: {
          type: "array",
          items: {
            type: "object",
            properties: {
              category: { 
                type: "string",
                description: "Category to apply this edit to: personal-core, interest-core, or active-context"
              },
              editIntent: { 
                type: "string",
                enum: ["add", "delete", "modify"]
              },
              targetContent: { type: "string" }
            },
            required: ["category", "editIntent", "targetContent"]
          },
          description: "Array of specific edit operations requested by user (only set if user explicitly requests edit operations)"
        }
      },
      required: ["shouldUpdate", "categories", "reasons"]
    };

    const analysisPrompt = `Analyze this conversation to determine if user memory should be updated.
    
USER MESSAGE: "${userMessage}"
AI RESPONSE: "${aiMessage}"
RECENT CONTEXT: "${recentConversation}"
${memoryData ? `EXISTING MEMORY DATA: "${memoryData}"` : 'NO EXISTING MEMORY DATA'}
${isDefaultMemory ? 'NOTE: User has default/initial memory data - prioritize updates' : ''}
${!memoryData ? '⚠️ CRITICAL: User has NO memory data yet. This is a prime opportunity to capture information naturally shared during the conversation.' : ''}

Determine:
1. Should memory be updated? (yes/no)
2. What categories need updating? (personal-core, interest-core, active-context)
3. Brief reasons
4. If user explicitly requests an edit operation, set editIntent and targetContent

NOTE: Realtime writes support three paths:
- 00-personal-core: stable profile facts about the person and context
- 01-interest-core: durable primary interests only (no detailed logs)
- 02-active-context: short-lived current focus and learning snapshot

CRITICAL RULES FOR MEMORY UPDATES:

${!memoryData ? `**SPECIAL RULES FOR USERS WITH NO EXISTING MEMORY:**
- User has NO memory data yet - this is the foundation for future personalization
- Be MORE PERMISSIVE in capturing information - any naturally shared information is valuable
- If the user naturally shares ANY personal information (name, interests, work) capture it under personal-core or interest-core
- Even subtle information is valuable when there's no existing memory (e.g., "I'm learning Python" → interest-core)
- If the AI asked natural follow-up questions and the user responded, capture that information
- Focus on building a basic profile from available information
- However, still maintain quality - don't capture meaningless greetings or single-word responses
- Priority categories when no memory exists: personal-core and interest-core

**Examples for Users with No Memory:**
✅ User: "Hi, I'm working on a React project" → Update personal-core (work/project), interest-core (React)
✅ User: "I'm a beginner in programming" → Update personal-core (expertise level), active-context (learning snapshot)
✅ AI: "What are you working on?" → User: "A web app for my startup" → Update personal-core (work), active-context (current focus)
❌ User: "Hi" → AI: "Hello!" → User: "Thanks" → Skip (no meaningful information)
` : ''}
- ALWAYS update when user EXPLICITLY requests to remember something (e.g., "remember this", "save this", "keep this in mind", "memorize this")
- UPDATE for:
  * User explicitly requests memory updates ("remember this", "save this", "keep this in mind", etc.)
  * Major personal profile changes (name, occupation, location)
  * Strong emotional responses or preferences that contradict existing data (log inside personal-core key characteristics unless it's an explicit command)
  * Completely new topics/interests not mentioned before (store in interest-core)
  * New users with default memory (first few interactions)
  * New learning patterns or expertise level changes
  * Significant technical discussions on new subjects
  * Regular updates for users with established profiles (every 24h)

SKIP update for:
  * Purely factual Q&A without personal context
  * Information already well-documented in memory
  * Routine conversations without new insights
  * Repeated topics already recorded
  * Minor clarifications or elaborations on existing topics
  * Simple questions or greetings
  * Information already present in memory

EXPLICIT MEMORY REQUESTS:
- Look for phrases like: "remember this", "save this", "keep this in mind", "memorize this", "remember that", "save that"
- When user asks to remember something specific, ALWAYS update memory regardless of other factors

EDIT INTENT DETECTION:
- DELETION keywords: "delete", "remove", "forget", "erase", "clear", "eliminate"
- MODIFICATION keywords: "modify", "change", "update", "edit", "revise", "alter"
- ADDITION keywords: "add", "save", "remember", "store", "keep", "record"
- When these keywords are detected, create an edits array with each operation
- Each edit must specify: category, editIntent, and targetContent
- Support multiple operations in one request (e.g., "delete X and add Y")

COMPARISON LOGIC:
- Compare new information with existing memory data
- Only update if the new information is substantially different or adds significant value
- If the information is already well-covered in memory, skip the update
- Focus on capturing truly unique or changing aspects of the user's profile
- EXCEPTION: Always update when user explicitly requests it`;

    // AI 분석 호출 (경량 모델 사용) - with structured output
    const analysisResult = await callMemoryBankUpdate(
      MEMORY_ANALYSIS_MODEL,
      'You are an AI assistant that analyzes conversations to determine memory update necessity.',
      analysisPrompt,
      200,
      analysisSchema
    );
    
    if (analysisResult) {
      try {
        const analysis = JSON.parse(analysisResult);
        const allowedCategories = new Set(AI_CATEGORY_KEYS);
        const rawCategories: string[] = analysis.categories || [];
        const includeAll = rawCategories.includes('all');
        let filteredCategories = includeAll
          ? ['all']
          : rawCategories.filter(category => allowedCategories.has(category as typeof AI_CATEGORY_KEYS[number]));
        const filteredEdits = Array.isArray(analysis.edits)
          ? analysis.edits.filter((edit: { category: string }) => allowedCategories.has(edit.category as typeof AI_CATEGORY_KEYS[number]))
          : undefined;
        const reasons = analysis.reasons || [];
        if ((analysis.shouldUpdate && filteredCategories.length === 0) && !includeAll) {
          return {
            shouldUpdate: false,
            reasons: [...reasons, 'Realtime updates require personal-core, interest-core, or active-context context.'],
            categories: [],
            edits: filteredEdits
          };
        }
        return {
          shouldUpdate: analysis.shouldUpdate || false,
          reasons,
          categories: filteredCategories,
          edits: filteredEdits
        };
      } catch (parseError) {
        // Failed to parse analysis result
      }
    }
    
    // AI 분석 실패 시 업데이트 건너뛰기
    return {
      shouldUpdate: false,
      reasons: ['AI analysis failed'],
      categories: []
    };
    
  } catch (error) {
    // AI 분석 실패 시 업데이트 건너뛰기
    return {
      shouldUpdate: false,
      reasons: ['Analysis failed'],
      categories: []
    };
  }
}

// 최근 메시지 추출을 위한 상수
// 가장 최근 메시지 5개만 고려 - 현재 대화의 직접적인 컨텍스트를 캡처하기 위함
const RECENT_MESSAGES_COUNT = 20;

// 메모리 뱅크 카테고리 상수
const MEMORY_CATEGORIES = {
  PERSONAL_CORE: '00-personal-core',
  INTEREST_CORE: '01-interest-core',
  ACTIVE_CONTEXT: '02-active-context'
};

const AI_CATEGORY_KEYS = ['personal-core', 'interest-core', 'active-context'] as const;

function hasExplicitMemoryIntent(text: string): boolean {
  const normalized = (text || '').toLowerCase();
  if (!normalized) return false;

  return [
    /remember this/,
    /remember that/,
    /save this/,
    /save that/,
    /keep this in mind/,
    /memorize this/,
    /update memory/,
    /store this/,
    /기억해/,
    /기억해줘/,
    /메모해/,
    /메모해줘/,
    /저장해/,
    /저장해줘/,
    /메모리에/,
    /업데이트해/,
  ].some((pattern) => pattern.test(normalized));
}

/**
 * Map category name from AI analysis format to database format
 * @param category - Category name from AI (e.g., 'personal-core')
 * @returns Database category name (e.g., '00-personal-core')
 */
function mapCategoryToDb(category: string): string | null {
  const mapping: Record<string, string> = {
    'personal-core': MEMORY_CATEGORIES.PERSONAL_CORE,
    'interest-core': MEMORY_CATEGORIES.INTEREST_CORE,
    'active-context': MEMORY_CATEGORIES.ACTIVE_CONTEXT
  };
  
  return mapping[category] || null;
}


/**
 * Utility function to convert messages to text
 */
function convertMessagesToText(messages: any[]): string {
  return messages.map(msg => {
    const role = msg.role.charAt(0).toUpperCase() + msg.role.slice(1);
    
    // Handle different message structures
    let content = '';
    
    if (typeof msg.content === 'string') {
      content = msg.content;
    } else if (Array.isArray(msg.content)) {
      // Handle content array (AI SDK v4 style)
      content = msg.content
        .filter((part: any) => part.type === 'text')
        .map((part: any) => part.text)
        .join('\n');
    } else if (Array.isArray(msg.parts)) {
      // Handle parts array (AI SDK v5 style)
      content = msg.parts
        .filter((part: any) => part.type === 'text')
        .map((part: any) => part.text)
        .join('\n');
    } else {
      content = JSON.stringify(msg.content);
    }
    
    return `${role}: ${content}`;
  }).join('\n\n');
}

/**
 * Extract recent messages from the conversation
 */
function getRecentConversationText(messages: any[], count: number = RECENT_MESSAGES_COUNT): string {
  return convertMessagesToText(messages.slice(-count));
}

/**
 * Retrieve user basic information from auth.users and all_user table
 */
async function getUserBasicInfo(supabase: SupabaseClient, userId: string): Promise<any> {
  try {
    // 현재 인증된 사용자 정보 가져오기
    const { data, error } = await supabase.auth.getUser();
    
    if (error) {
      return {};
    }
    
    if (!data || !data.user) {
      return {};
    }
    
    // 현재 인증된 사용자와 요청된 userId가 다른 경우 확인
    if (data.user.id !== userId) {
      console.warn(`Requested user ID (${userId}) does not match authenticated user (${data.user.id})`);
      // 보안을 위해 권한이 있는지 추가로 확인할 수 있는 로직을 여기에 구현
      // 예: 관리자 권한 확인 등
      // 현재는 보안을 위해 빈 객체 반환
      return {};
    }
    
    // Extract relevant information
    const user = data.user;
    
    // 🚀 개선: fetchUserName 함수를 사용하여 더 정확한 사용자 이름 가져오기
    const userName = await fetchUserName(userId, supabase);
    
    const basicInfo = {
      email: user.email,
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at,
      name: userName, // 개선된 이름 가져오기 로직 사용
      avatar_url: user.user_metadata?.avatar_url,
      provider: user.app_metadata?.provider
    };
    
    return basicInfo;
  } catch (error) {
    return {};
  }
}


/**
 * 공통 메모리 뱅크 업데이트 함수
 */
async function updateMemoryCategory(
  supabase: SupabaseClient, 
  userId: string, 
  category: string,
  systemPromptText: string,
  promptContent: string,
  maxTokens: number = MEMORY_UPDATE_MAX_TOKENS
): Promise<string | null> {
  try {
    const result = await callMemoryBankUpdate(
      MEMORY_UPDATE_MODEL,
      systemPromptText,
      promptContent,
      maxTokens
    );
    
    if (result) {
      const dbResult = await updateMemoryBank(supabase, userId, category, result);
      
      if (dbResult.error) {
        return null;
      }
      
      return result;
    } else {
      // AI generation failed for category
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Update the user's personal information
 * 🚀 EXPORTED: 이름 변경 등 즉시 반영이 필요한 경우 사용
 */
export async function updatePersonalInfo(
  supabase: SupabaseClient,
  userId: string,
  messages: any[],
  memoryData?: string | null,
  edits?: Array<{
    editIntent: 'add' | 'delete' | 'modify';
    targetContent: string;
  }>
): Promise<string | null> {
  try {
    // 🆕 If memoryData is undefined (not explicitly passed), fetch it
    let categoryMemory = memoryData;
    if (categoryMemory === undefined) {
      const { data } = await getMemoryBankEntry(
        supabase, 
        userId, 
        MEMORY_CATEGORIES.PERSONAL_CORE
      );
      categoryMemory = data;
    }
    
    // Get basic user info from auth.users
    const basicInfo = await getUserBasicInfo(supabase, userId);
    
    // Get user locale and trends preference information
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
      ? `TRENDS PREFERENCES CONTEXT:\n${JSON.stringify(trendsContext)}\n\nIMPORTANT: The user manually follows trending topics from ${trendsDescription || 'the specified location'}. Mention this interest naturally in ## Basic Details and avoid duplicating the same location if USER LOCALE CONTEXT already covers it.\n\n`
      : '';
    
    // Extract conversation text from recent messages
    const recentConversationText = getRecentConversationText(messages);
    
    // 메모리 유무에 따른 조건부 접근
    const hasExistingMemory = categoryMemory && !categoryMemory.includes('No previous personal information recorded');
    
    const personalInfoPrompt = hasExistingMemory 
      ? `Update the user's personal information based on new conversation data.

${localeContext ? `USER LOCALE CONTEXT:\n${localeContext}\n\n` : ''}${trendsContextBlock}EXISTING PERSONAL INFO:
${categoryMemory}

NEW CONVERSATION:
${recentConversationText}

${edits && edits.length > 0 ? `
EDIT OPERATIONS REQUESTED:
${edits.map((edit, index) => `
${index + 1}. ${edit.editIntent.toUpperCase()}: "${edit.targetContent}"
${edit.editIntent === 'delete' ? '   - Remove all mentions while preserving other content' : ''}
${edit.editIntent === 'modify' ? '   - Update/change this content based on new information' : ''}
${edit.editIntent === 'add' ? '   - Add this new information while preserving existing content' : ''}
`).join('\n')}

Apply ALL edit operations above in sequence.
` : ''}

LOCALE INFORMATION USAGE:
- If USER LOCALE CONTEXT is provided, use it to determine the user's primary language and location
- The language field in locale context indicates the user's preferred language (e.g., "ko" = Korean, "en" = English)
- Use this language to write the entire profile in the same language
- Include location information (country, region) in Basic Details section if available
- Store the language preference explicitly in Basic Details section

TRENDS PREFERENCES USAGE:
- If TRENDS PREFERENCES CONTEXT is provided, the user manually selected a country/region for the Trending widget
- Treat it as an active interest and weave it naturally into ## Basic Details (e.g., "Interested in trends from United States, California")
- Prefer the provided human-readable names; fall back to codes when names are missing
- Do not duplicate locale information—merge the trend interest with existing location facts when they refer to the same place

CRITICAL FORMAT REQUIREMENTS:
- MUST output ONLY these sections in this order: ## Basic Details, ## Professional Context, ## Key Characteristics
- Each section must contain at most 3 concise bullet sentences (no nested lists, no enumerated examples)
- Summaries must read like how someone would naturally describe a friend (e.g., "GOAT은 ...")
- Start each sentence directly with the fact—avoid generic openings like "사용자는", "그는", "그녀는"
- Do NOT repeat the same fact across multiple sections
- Delete filler sentences and long enumerations—capture only memorable traits
- NEVER include explanatory text, meta-comments, or reasoning outside the markdown sections
- Treat EXISTING PERSONAL INFO as the durable baseline. Keep previously established facts unless explicitly contradicted by new evidence or explicit edit requests.
- Do not drop durable profile facts just because they were not mentioned in this recent conversation.

Update the existing personal info profile by:
1. ${edits && edits.length > 0 ? 'Applying the requested edit operations first' : 'Integrating new insights without losing earlier facts'}
2. Compressing long lists into natural sentences that highlight only the most important ideas
3. Returning ONLY the markdown profile content even when no changes are needed`
      
      : `Create a new user personal information profile based on conversation analysis.

${localeContext ? `USER LOCALE CONTEXT:\n${localeContext}\n\n` : ''}${trendsContextBlock}BASIC USER DATA:
- Name: ${basicInfo.name || '[Extract from conversation if mentioned]'}
- Member since: ${basicInfo.created_at ? new Date(basicInfo.created_at).toLocaleDateString() : 'Unknown'}

CONVERSATION:
${recentConversationText}

⚠️ IMPORTANT: User has NO existing memory data. Capture naturally shared facts even if brief, but summarize them like a friend describing another friend.

LOCALE INFORMATION USAGE:
- If USER LOCALE CONTEXT is provided, use it to determine the user's primary language and location
- The language field in locale context indicates the user's preferred language (e.g., "ko" = Korean, "en" = English)
- Use this language to write the entire profile in the same language
- Include location information (country, region) in Basic Details section if available
- Store the language preference explicitly in Basic Details section

TRENDS PREFERENCES USAGE:
- If TRENDS PREFERENCES CONTEXT is provided, the user manually selected a country/region for the Trending widget
- Treat it as an active interest and weave it naturally into ## Basic Details (e.g., "Interested in trends from United States, California")
- Prefer the provided human-readable names; fall back to codes when names are missing
- Do not duplicate locale information—merge the trend interest with existing location facts when they refer to the same place

CRITICAL FORMAT REQUIREMENTS:
- MUST use exactly these section headers in this order: ## Basic Details, ## Professional Context, ## Key Characteristics
- Each section is limited to 3 short bullet sentences—no rambling lists or long chains of clauses
- If locale information is provided, prioritize it over inferring from conversation content
- Omit enumerated examples; focus on the essence
- Start each sentence directly with the fact; avoid generic subjects like "사용자는/그는/그녀는"

Create the profile as follows:

## Basic Details
- Name: [Extract or use provided name]
- Member since: [Use provided date]
- Language preference: [Use locale context if available, otherwise infer from conversation]

## Professional Context
- Occupation: [Summarize job/role context]
- Expertise level: [Beginner/Intermediate/Advanced inferred]
- Fields: [1-line summary of main domains]

## Key Characteristics
- Provide up to 3 natural-language sentences that capture personality, focus areas, or habits

GUIDELINES:
1. Be permissive while staying factual—short memorable sentences beat exhaustive lists
2. Convert even implicit hints into concise statements when reasonably supported
3. Never fabricate information; use "[To be determined]" when absolutely no clue exists`
    
    return await updateMemoryCategory(
      supabase,
      userId,
      MEMORY_CATEGORIES.PERSONAL_CORE,
      'Extract and organize user personal core from available data',
      personalInfoPrompt
    );
  } catch (error) {
    console.error("Error updating personal info:", error);
    return null;
  }
}

/**
 * Update the user's durable interests core.
 */
export async function updateInterestCore(
  supabase: SupabaseClient,
  userId: string,
  messages: any[],
  memoryData?: string | null,
  edits?: Array<{
    editIntent: 'add' | 'delete' | 'modify';
    targetContent: string;
  }>
): Promise<void> {
  try {
    let categoryMemory = memoryData;
    if (categoryMemory === undefined) {
      const { data } = await getMemoryBankEntry(
        supabase,
        userId,
        MEMORY_CATEGORIES.INTEREST_CORE
      );
      categoryMemory = data;
    }

    const recentMessages = messages.slice(-RECENT_MESSAGES_COUNT);
    const conversationText = convertMessagesToText(recentMessages);

    const interestCorePrompt = `Refine the user's durable interest core from this conversation.

EXISTING INTEREST CORE:
${categoryMemory || 'No previous interest core recorded.'}

NEW CONVERSATION:
${conversationText}

${edits && edits.length > 0 ? `
EDIT OPERATIONS REQUESTED:
${edits.map((edit, index) => `${index + 1}. ${edit.editIntent.toUpperCase()}: "${edit.targetContent}"`).join('\n')}
Apply all edit operations before rewriting.` : ''}

CRITICAL FORMAT REQUIREMENTS:
- Output ONLY this section: ## Primary Interests
- Keep 3-6 bullets maximum
- Each bullet must be concise and taxonomy-like: "<topic>: <engagement-strength>"
- Keep only durable, recurring interests; remove one-off experiments and noisy details
- Merge semantically similar topics into one bullet
- Do not include explanation outside the section
- Treat EXISTING INTEREST CORE as baseline. Preserve previously confirmed durable interests unless explicit delete/modify intent exists.
- New conversation can add or tune strength, but should not replace the entire durable set with one short-term topic.

Example bullet style:
- AI product strategy: high
- Prompt engineering for multimodal workflows: medium
- US/California trend tracking: medium`;

    await updateMemoryCategory(
      supabase,
      userId,
      MEMORY_CATEGORIES.INTEREST_CORE,
      'Extract and organize user interest core from conversation patterns',
      interestCorePrompt
    );
  } catch (error) {
    console.error('Error updating interest core:', error);
  }
}

/**
 * Update short-lived active context.
 */
export async function updateActiveContext(
  supabase: SupabaseClient,
  userId: string,
  messages: any[],
  memoryData?: string | null,
  edits?: Array<{
    editIntent: 'add' | 'delete' | 'modify';
    targetContent: string;
  }>
): Promise<void> {
  try {
    let categoryMemory = memoryData;
    if (categoryMemory === undefined) {
      const { data } = await getMemoryBankEntry(
        supabase,
        userId,
        MEMORY_CATEGORIES.ACTIVE_CONTEXT
      );
      categoryMemory = data;
    }

    const recentMessages = messages.slice(-RECENT_MESSAGES_COUNT);
    const conversationText = convertMessagesToText(recentMessages);

    const activeContextPrompt = `Update the user's active context from recent conversation.

EXISTING ACTIVE CONTEXT:
${categoryMemory || 'No previous active context recorded.'}

RECENT CONVERSATION:
${conversationText}

${edits && edits.length > 0 ? `
EDIT OPERATIONS REQUESTED:
${edits.map((edit, index) => `${index + 1}. ${edit.editIntent.toUpperCase()}: "${edit.targetContent}"`).join('\n')}
Apply all edit operations before rewriting.` : ''}

CRITICAL FORMAT REQUIREMENTS:
- Output ONLY these sections in order: ## Current Focus, ## Learning Snapshot
- Keep each section 1-3 bullets maximum
- Focus on short-lived, currently active items only
- Remove stale or duplicated details
- Keep each bullet as one short sentence
- No extra commentary outside the sections`;

    await updateMemoryCategory(
      supabase,
      userId,
      MEMORY_CATEGORIES.ACTIVE_CONTEXT,
      'Extract and organize user active context from conversation patterns',
      activeContextPrompt
    );
  } catch (error) {
    console.error('Error updating active context:', error);
  }
}

/**
 * Selective memory update - 특정 카테고리만 업데이트
 * @returns 업데이트 결과 정보 (클라이언트 캐시 갱신용)
 */
export async function updateSelectiveMemoryBanks(
  supabase: SupabaseClient,
  userId: string,
  chatId: string,
  messages: any[],
  userMessage: string,
  aiMessage: string,
  categories: string[],
  edits?: Array<{
    category: string;
    editIntent: 'add' | 'delete' | 'modify';
    targetContent: string;
  }>
  // 🆕 REMOVE memoryData parameter - will be fetched per-category
): Promise<{
  success: boolean;
  updatedCategories: string[];
  timestamp: number;
}> {
  try {
    const startTime = Date.now();
    const explicitMemoryIntent = hasExplicitMemoryIntent(userMessage) || Boolean(edits && edits.length > 0);
    
    const isAllRequest = categories.includes('all');
    const normalizedCategories = isAllRequest
      ? [...AI_CATEGORY_KEYS]
      : categories.filter(category => AI_CATEGORY_KEYS.includes(category as (typeof AI_CATEGORY_KEYS)[number]));
    
    if (normalizedCategories.length === 0) {
      return {
        success: false,
        updatedCategories: [],
        timestamp: Date.now()
      };
    }
    
    const updatePromises: Promise<any>[] = [];
    
    // 🆕 Fetch category-specific memory data
    const categoryDataMap: Record<string, string | null> = {};
    
    // Handle 'all' category specially
    if (isAllRequest) {
      for (const category of AI_CATEGORY_KEYS) {
        const dbCategory = mapCategoryToDb(category);
        if (!dbCategory) continue;
        const { data } = await getMemoryBankEntry(supabase, userId, dbCategory);
        categoryDataMap[category] = data;
      }
    } else {
      for (const category of normalizedCategories) {
        const dbCategory = mapCategoryToDb(category);
        if (!dbCategory) continue;
        const { data } = await getMemoryBankEntry(supabase, userId, dbCategory);
        categoryDataMap[category] = data;
      }
    }
    
    // Group edits by category
    const editsByCategory: Record<string, Array<{editIntent: 'add' | 'delete' | 'modify', targetContent: string}>> = {};
    if (edits) {
      edits.forEach(edit => {
        if (!AI_CATEGORY_KEYS.includes(edit.category as (typeof AI_CATEGORY_KEYS)[number])) {
          return;
        }
        if (!editsByCategory[edit.category]) {
          editsByCategory[edit.category] = [];
        }
        editsByCategory[edit.category].push({
          editIntent: edit.editIntent,
          targetContent: edit.targetContent
        });
      });
    }

    // If user did not explicitly request memory operations, keep realtime writes conservative.
    // Durable categories are refined by scheduled refine jobs; realtime path should bias to active context.
    const runtimeCategories = explicitMemoryIntent
      ? normalizedCategories
      : normalizedCategories.filter(category => category === 'active-context');

    if (runtimeCategories.length === 0) {
      return {
        success: false,
        updatedCategories: [],
        timestamp: Date.now()
      };
    }

    // 카테고리별 업데이트 함수 매핑 (category-specific data)
    const updateFunctions = {
      'personal-core': () => updatePersonalInfo(supabase, userId, messages, categoryDataMap['personal-core'], editsByCategory['personal-core']),
      'interest-core': () => updateInterestCore(supabase, userId, messages, categoryDataMap['interest-core'], editsByCategory['interest-core']),
      'active-context': () => updateActiveContext(supabase, userId, messages, categoryDataMap['active-context'], editsByCategory['active-context'])
    };
    
    // 선택된 카테고리만 업데이트
    runtimeCategories.forEach(category => {
      if (updateFunctions[category as keyof typeof updateFunctions]) {
        updatePromises.push(updateFunctions[category as keyof typeof updateFunctions]());
      }
    });
    
    if (updatePromises.length === 0) {
      return {
        success: false,
        updatedCategories: [],
        timestamp: Date.now()
      };
    }
    
    // 선택적 업데이트 실행
    const results = await Promise.allSettled(updatePromises);
    
    const duration = Date.now() - startTime;
    const successes = results.filter(result => result.status === 'fulfilled').length;
    const failures = results.filter(result => result.status === 'rejected').length;
    
    if (successes > 0) {
      // 🚀 최적화: 업데이트 후 최신 메모리를 반환하여 클라이언트 캐시 갱신 가능하도록
      // 클라이언트는 이 정보를 사용하여 localStorage 캐시를 갱신할 수 있음
      return {
        success: true,
        updatedCategories: runtimeCategories,
        timestamp: Date.now()
      };
    } else {
      return {
        success: false,
        updatedCategories: [],
        timestamp: Date.now()
      };
    }
    
  } catch (error) {
    return {
      success: false,
      updatedCategories: [],
      timestamp: Date.now()
    };
  }
}

/**
 * Smart Memory Update - AI 분석 기반 지능적 업데이트
 * @returns 업데이트 결과 정보 (클라이언트 캐시 갱신용)
 */
export async function smartUpdateMemoryBanks(
  supabase: SupabaseClient,
  userId: string,
  chatId: string,
  messages: any[],
  userMessage: string,
  aiMessage: string
  // 🆕 REMOVE memoryData parameter
): Promise<{
  success: boolean;
  updatedCategories: string[];
  timestamp: number;
} | null> {
  try {
    // 🆕 Fetch all memory for analysis purposes ONLY
    const { data: allMemoryData } = await getAllMemoryBank(supabase, userId);
    
    // 1. 메모리 업데이트 필요성 분석
    const analysis = await shouldUpdateMemory(supabase, userId, messages, userMessage, aiMessage, allMemoryData);
    
    // 2. 업데이트 불필요 시 건너뛰기
    if (!analysis.shouldUpdate) {
      return null;
    }
    
    // 3. 선택적 업데이트 실행
    const result = await updateSelectiveMemoryBanks(
      supabase, userId, chatId, messages, userMessage, aiMessage, 
      analysis.categories,
      analysis.edits
    );
    
    return result;
    
  } catch (error) {
    return {
      success: false,
      updatedCategories: [],
      timestamp: Date.now()
    };
  }
} 