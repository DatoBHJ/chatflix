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
      memoryData.includes('This section contains basic information about the user') &&
      memoryData.includes('This section tracks user preferences such as UI style');
    
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
          description: "Categories eligible for real-time updates: personal-info, preferences (Pinned Memories only), interests"
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
                description: "Category to apply this edit to: personal-info, preferences (Pinned-only), or interests"
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
2. What categories need updating? (personal-info, preferences (Pinned-only), interests)
3. Brief reasons
4. If user explicitly requests an edit operation, set editIntent and targetContent

NOTE: Realtime writes support three paths:
- 00-personal-info: facts about the person, expertise, key characteristics
- 02-interests: hobbies, projects, long-term focus areas
- 01-preferences: ONLY the \"## Pinned Memories (User Requested)\" section when the user explicitly commands changes to tone/format/structure (e.g., \"앞으로 이미지는 쓰지 마\", \"항상 한국어 요약부터 해줘\"). Strategy sections stay untouched until refinement.

CRITICAL RULES FOR MEMORY UPDATES:

${!memoryData ? `**SPECIAL RULES FOR USERS WITH NO EXISTING MEMORY:**
- User has NO memory data yet - this is the foundation for future personalization
- Be MORE PERMISSIVE in capturing information - any naturally shared information is valuable
- If the user naturally shares ANY personal information (name, interests, work) capture it under personal-info or interests
- Explicit instructions about response tone/format (\"앞으로 이미지는 쓰지 마\", \"코드 먼저 보여줘\") belong in the preferences pinned section
- Even subtle information is valuable when there's no existing memory (e.g., "I'm learning Python" → interests category)
- If the AI asked natural follow-up questions and the user responded, capture that information
- Focus on building a basic profile from available information
- However, still maintain quality - don't capture meaningless greetings or single-word responses
- Priority categories when no memory exists: personal-info and interests (preferences only when pinned instructions are explicitly given)

**Examples for Users with No Memory:**
✅ User: "Hi, I'm working on a React project" → Update personal-info (work/project), interests (React)
✅ User: "방정식 풀이를 이미지로 하지 마. 앞으로 텍스트로만 설명해줘." → Update preferences (Pinned instruction to avoid images)
✅ User: "I'm a beginner in programming" → Update personal-info (expertise level), interests
✅ AI: "What are you working on?" → User: "A web app for my startup" → Update personal-info (work), interests
❌ User: "Hi" → AI: "Hello!" → User: "Thanks" → Skip (no meaningful information)
` : ''}
- ALWAYS update when user EXPLICITLY requests to remember something (e.g., "remember this", "save this", "keep this in mind", "memorize this")
- ALWAYS update preferences when the user gives a direct instruction about how answers should be formatted/styled (this becomes a Pinned entry)
- UPDATE for:
  * User explicitly requests memory updates ("remember this", "save this", "keep this in mind", etc.)
  * Major personal info changes (name, occupation, location)
  * Strong emotional responses or preferences that contradict existing data (log inside personal-info key characteristics unless it's an explicit command)
  * Completely new topics/interests not mentioned before
  * New users with default memory (first few interactions)
  * Distinct communication or response-style instructions that clearly begin with "앞으로", "다음부터", "기억해", "하지 마", etc. (store as Pinned preferences)
  * New learning patterns or expertise level changes
  * Significant technical discussions on new subjects
  * Communication style preferences that differ from existing patterns ONLY when the user makes an explicit request ("항상 TL;DR부터", "이미지는 금지", "한국어로만")
  * Regular updates for users with established profiles (every 24h)

PREFERENCES (PINNED) LOGIC:
- Look for imperative phrases about how the assistant should respond (e.g., "앞으로 이미지는 쓰지 마", "항상 한국어 요약부터", "코드 먼저 보여줘").
- These instructions must generate a preferences edit with editIntent "add"/"delete"/"modify" targeting the pinned section.
- If the user did NOT explicitly instruct a change, do NOT update preferences—implicit hints belong to refinement later.
- SKIP update for:
  * Purely factual Q&A without personal context
  * Information already well-documented in memory
  * Routine conversations without new insights
  * Repeated topics or preferences already recorded
  * Minor clarifications or elaborations on existing topics
  * Simple questions or greetings
  * Information already present in memory

EXPLICIT MEMORY REQUESTS:
- Look for phrases like: "remember this", "save this", "keep this in mind", "memorize this", "remember that", "save that"
- When user asks to remember something specific, ALWAYS update memory regardless of other factors
- This includes style preferences, writing instructions, communication preferences, etc.

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
        const hasPreferenceEdit = filteredEdits?.some((edit: { category: string }) => edit.category === 'preferences') ?? false;

        if (!includeAll) {
          if (hasPreferenceEdit && !filteredCategories.includes('preferences')) {
            filteredCategories = [...filteredCategories, 'preferences'];
          }
          if (filteredCategories.includes('preferences') && !hasPreferenceEdit) {
            filteredCategories = filteredCategories.filter(category => category !== 'preferences');
          }
        }

        if ((analysis.shouldUpdate && filteredCategories.length === 0) && !includeAll) {
          return {
            shouldUpdate: false,
            reasons: [...reasons, 'Realtime updates require personal-info/interests context or explicit Pinned preference instructions.'],
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
const RECENT_MESSAGES_COUNT = 5;

// 메모리 뱅크 카테고리 상수
const MEMORY_CATEGORIES = {
  PERSONAL_INFO: '00-personal-info',
  PREFERENCES: '01-preferences',
  INTERESTS: '02-interests'
};

const AI_CATEGORY_KEYS = ['personal-info', 'preferences', 'interests'] as const;

/**
 * Map category name from AI analysis format to database format
 * @param category - Category name from AI (e.g., 'personal-info')
 * @returns Database category name (e.g., '00-personal-info')
 */
function mapCategoryToDb(category: string): string | null {
  const mapping: Record<string, string> = {
    'personal-info': MEMORY_CATEGORIES.PERSONAL_INFO,
    'preferences': MEMORY_CATEGORIES.PREFERENCES,
    'interests': MEMORY_CATEGORIES.INTERESTS
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
        MEMORY_CATEGORIES.PERSONAL_INFO
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
- MUST output ONLY these sections in this order: ## Basic Details, ## Professional Context, ## Key Characteristics, ## Pinned Memories (User Requested)
- Each section must contain at most 3 concise bullet sentences (no nested lists, no enumerated examples)
- Summaries must read like how someone would naturally describe a friend (e.g., "GOAT은 ...")
- Start each sentence directly with the fact—avoid generic openings like "사용자는", "그는", "그녀는"
- Do NOT repeat the same fact across multiple sections
- Delete filler sentences and long enumerations—capture only memorable traits
- Pinned entries must use the format "- [PINNED] <short instruction>" and ONLY appear when the user explicitly asked to remember/add/delete/modify something (keywords like remember/save/keep/add/delete/remove/forget/erase/update/change/modify)
- If there are no explicit user memory requests, include "- [PINNED] None yet"
- NEVER include explanatory text, meta-comments, or reasoning outside the markdown sections

Update the existing personal info profile by:
1. ${edits && edits.length > 0 ? 'Applying the requested edit operations first' : 'Integrating new insights without losing earlier facts'}
2. Compressing long lists into natural sentences that highlight only the most important ideas
3. Adding explicit user memory requests to the pinned section (never infer pinned entries yourself)
4. Returning ONLY the markdown profile content even when no changes are needed`
      
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
- MUST use exactly these section headers in this order: ## Basic Details, ## Professional Context, ## Key Characteristics, ## Pinned Memories (User Requested)
- Each section is limited to 3 short bullet sentences—no rambling lists or long chains of clauses
- If locale information is provided, prioritize it over inferring from conversation content
- Omit enumerated examples; focus on the essence
- Start each sentence directly with the fact; avoid generic subjects like "사용자는/그는/그녀는"
- Pinned section lists explicit user memory requests using "- [PINNED] ..." only when the user explicitly issued a remember/save/add/delete-style command; otherwise output "- [PINNED] None yet"

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

## Pinned Memories (User Requested)
- Include "- [PINNED] ..." entries only when the user explicitly asked to remember/add/delete/modify something; otherwise output "- [PINNED] None yet"

GUIDELINES:
1. Be permissive while staying factual—short memorable sentences beat exhaustive lists
2. Convert even implicit hints into concise statements when reasonably supported
3. Never fabricate information; use "[To be determined]" when absolutely no clue exists`
    
    return await updateMemoryCategory(
      supabase,
      userId,
      MEMORY_CATEGORIES.PERSONAL_INFO,
      'Extract and organize user personal information from available data',
      personalInfoPrompt
    );
  } catch (error) {
    console.error("Error updating personal info:", error);
    return null;
  }
}

/**
 * Update the user's preferences
 */
export async function updatePreferences(
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
    // 🆕 If memoryData is undefined (not explicitly passed), fetch it
    let categoryMemory = memoryData;
    if (categoryMemory === undefined) {
      const { data } = await getMemoryBankEntry(
        supabase, 
        userId, 
        MEMORY_CATEGORIES.PREFERENCES
      );
      categoryMemory = data;
    }
    
    const recentMessages = messages.slice(-RECENT_MESSAGES_COUNT);
    const conversationText = convertMessagesToText(recentMessages);
    
    // 메모리 유무에 따른 조건부 접근 (legacy structure preserved for refinement, pinned-only updates handled below)
    let preferencesPrompt = '';

    if (!categoryMemory) {
      categoryMemory = `## Communication Style
- [To be determined from interactions]

## Response Format Preferences
- [To be determined from interactions]

## Pinned Memories (User Requested)
- [PINNED] None yet`;
    }

    const preferenceEditBlock = edits && edits.length > 0
      ? `EXPLICIT EDIT OPERATIONS (apply in order):
${edits.map((edit, index) => `${index + 1}. ${edit.editIntent.toUpperCase()} "${edit.targetContent}"`).join('\n')}

Remember: these edits always target the pinned section only.`
      : 'EXPLICIT EDIT OPERATIONS: None detected. Only add a pinned entry if the conversation clearly contains commands such as "앞으로", "기억해", "하지 마", "keep this in mind".';

    preferencesPrompt = `REALTIME UPDATE MODE (Pinned-only)
- You are ONLY allowed to modify the "## Pinned Memories (User Requested)" section.
- DO NOT rewrite or reorder the "## Communication Style" or "## Response Format Preferences" sections—copy them exactly as the existing profile shows.
- Add, modify, or delete pinned entries ONLY when the user clearly gave an instruction about response tone/format (e.g., "이미지로 설명하지 마", "항상 텍스트 요약부터").
- If there are no qualifying instructions, return the profile unchanged.
- Phrase pinned entries as direct instructions (e.g., "- [PINNED] 방정식은 텍스트로 설명")—avoid generic openings like "사용자는/그는/그녀는".

${preferenceEditBlock}

EXISTING PREFERENCE PROFILE:
${categoryMemory}

RECENT CONVERSATION (focus on explicit commands):
${conversationText}

OUTPUT REQUIREMENTS:
1. Return the complete markdown profile with sections in this exact order: ## Communication Style, ## Response Format Preferences, ## Pinned Memories (User Requested).
2. Keep the first two sections verbatim—identical text and bullet order.
3. Update only the pinned section. Use "- [PINNED] ..." entries, deduplicate similar commands, and remove an entry only when the user explicitly rescinds it.
4. If nothing changes, output the original profile verbatim.`;

    await updateMemoryCategory(
      supabase,
      userId,
      MEMORY_CATEGORIES.PREFERENCES,
      'Extract and organize user preferences from conversation patterns',
      preferencesPrompt
    );
  } catch (error) {
    console.error("Error updating preferences:", error);
  }
}

/**
 * Update the user's interests
 */
export async function updateInterests(
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
    // 🆕 If memoryData is undefined (not explicitly passed), fetch it
    let categoryMemory = memoryData;
    if (categoryMemory === undefined) {
      const { data } = await getMemoryBankEntry(
        supabase, 
        userId, 
        MEMORY_CATEGORIES.INTERESTS
      );
      categoryMemory = data;
    }
    
    const recentMessages = messages.slice(-RECENT_MESSAGES_COUNT);
    const conversationText = convertMessagesToText(recentMessages);
    
    // 메모리 유무에 따른 조건부 접근
    const hasExistingMemory = categoryMemory && !categoryMemory.includes('No previous interests recorded');
    
    const interestsPrompt = hasExistingMemory 
      ? `Update the user's interests based on new conversation data while trimming the content to only the most memorable facts.

EXISTING INTERESTS:
${categoryMemory}

NEW CONVERSATION:
${conversationText}

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

CRITICAL FORMAT REQUIREMENTS:
- MUST output ONLY these sections in this order: ## Primary Interests, ## Current Focus, ## Learning Journey, ## Pinned Memories (User Requested)
- Limit each bullet to a single vivid sentence—do not enumerate subtopics or list every example
- Use natural Korean sentences when the conversation is in Korean
- Start each sentence directly with the fact; avoid generic openings such as "사용자는/그는/그녀는"
- No duplicated facts across sections
- Pinned section uses "- [PINNED] ..." entries ONLY when the user explicitly asked to remember/add/delete/modify something; otherwise include "- [PINNED] None yet"
- No meta commentary or explanation outside the markdown sections

Update the existing interests profile by:
1. ${edits && edits.length > 0 ? 'Applying requested edits first' : 'Synthesizing only the standout interests'}
2. Collapsing long subtopic lists into short descriptors (e.g., "Seedream vs Nano Banana Pro 비교에 집착함")
3. Capturing explicit memory requests in the pinned section`
      
      : `Create a new user interests profile from the conversation while keeping it punchy.

CONVERSATION:
${conversationText}

CRITICAL FORMAT REQUIREMENTS:
- Sections must be: ## Primary Interests, ## Current Focus, ## Learning Journey, ## Pinned Memories (User Requested)
- Each bullet = one sentence, no semicolons or comma splices
- Describe interests the way someone would recall them later ("요즘 위젯 UI 리디자인 얘기를 자주 꺼냄")
- Start each sentence directly with the fact; avoid generic openings such as "사용자는/그는/그녀는"
- Pinned section lists explicit instructions with "- [PINNED] ..." only when directly requested; otherwise "- [PINNED] None yet"

Section guidance:

## Primary Interests
- Up to 4 bullets summarizing the main domains they care about (include engagement hint like "집중", "관심")

## Current Focus
- 2 bullets on what they are actively exploring or building now

## Learning Journey
- 3 bullets covering current focus, progress strengths, and areas they find challenging

## Pinned Memories (User Requested)
- Explicit remember requests only (user must have clearly asked to remember/add/delete something); otherwise "- [PINNED] None yet"

GUIDELINES:
1. A single mention can qualify if it felt important to the user
2. Prefer concrete nouns over broad categories (\"Nano Banana Pro\" instead of \"AI\")
3. If information is missing, use "- [To be determined from conversations]" but keep it brief`
    
    await updateMemoryCategory(
      supabase,
      userId,
      MEMORY_CATEGORIES.INTERESTS,
      'Extract and organize user interests from conversation patterns',
      interestsPrompt
    );
  } catch (error) {
    console.error("Error updating interests:", error);
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

    // 카테고리별 업데이트 함수 매핑 (category-specific data)
    const hasPreferenceEdits = !!(editsByCategory['preferences'] && editsByCategory['preferences'].length);

    const updateFunctions = {
      'personal-info': () => updatePersonalInfo(supabase, userId, messages, categoryDataMap['personal-info'], editsByCategory['personal-info']),
      'preferences': () => updatePreferences(supabase, userId, messages, categoryDataMap['preferences'], editsByCategory['preferences']),
      'interests': () => updateInterests(supabase, userId, messages, categoryDataMap['interests'], editsByCategory['interests'])
    };
    
    // 선택된 카테고리만 업데이트
    normalizedCategories.forEach(category => {
      if (category === 'preferences' && !hasPreferenceEdits) {
        return;
      }
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
        updatedCategories: normalizedCategories,
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