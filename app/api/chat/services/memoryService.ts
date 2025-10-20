import { SupabaseClient } from '@supabase/supabase-js';
import { updateMemoryBank, getLastMemoryUpdate, getMemoryBankEntry, getAllMemoryBank } from '@/utils/memory-bank';
// import { MultiModalMessage } from '../types';
import { callMemoryBankUpdate } from '@/app/api/chat/utils/callMemoryBankUpdate';
import { getCachedUserName } from '@/lib/user-name-cache';

// Internal function to fetch user name from database (without cache)
const fetchUserNameFromDB = async (userId: string, supabase: SupabaseClient) => {
  try {
    console.log(`👤 [USER NAME] Fetching name for user ${userId}`);
    
    // First try to get name from all_user table
    const { data, error } = await supabase
      .from('all_user')
      .select('name')
      .eq('id', userId)
      .single();

    if (error) {
      console.log(`👤 [USER NAME] all_user lookup failed (${error.code}), checking auth metadata...`);
      
      // Single auth call with better error handling
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user) {
          // 게스트 모드에서는 auth 에러가 정상이므로 warn 레벨로만 로깅
          console.log(`👤 [USER NAME] Auth lookup failed (guest mode), using default 'You'`);
          return 'You';
        }
        
        const authName = user.user_metadata?.full_name || user.user_metadata?.name || 'You';
        console.log(`👤 [USER NAME] Using auth metadata name: ${authName}`);
        return authName;
      } catch (authErr) {
        // 게스트 모드에서는 auth 에러가 정상이므로 error 레벨 로깅 제거
        console.log(`👤 [USER NAME] Auth lookup failed (guest mode), using default 'You'`);
        return 'You';
      }
    } else if (data?.name) {
      console.log(`👤 [USER NAME] Found name in all_user table: ${data.name}`);
      return data.name;
    } else {
      console.log(`👤 [USER NAME] No name data found, using default 'You'`);
      return 'You';
    }
  } catch (error) {
    console.error('❌ [USER NAME] Unexpected error fetching user name:', error);
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
const MEMORY_UPDATE_MAX_TOKENS = 1500;
const MEMORY_UPDATE_TEMPERATURE = 0.3;

// 🆕 Smart Trigger 관련 상수
const MEMORY_ANALYSIS_MODEL = 'gemini-2.0-flash'; // Gemini 2.0 Flash 모델 사용
const MAX_TIME_SINCE_LAST_UPDATE = 24 * 60 * 60 * 1000; // 최대 24시간

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
          description: "Categories that need updating: personal-info, preferences, interests, interaction-history, relationship"
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
                description: "Category to apply this edit to: personal-info, preferences, interests, interaction-history, relationship"
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

Determine:
1. Should memory be updated? (yes/no)
2. What categories need updating? (personal-info, preferences, interests, interaction-history, relationship)
3. Brief reasons
4. If user explicitly requests an edit operation, set editIntent and targetContent

CRITICAL RULES FOR MEMORY UPDATES:
- ALWAYS update when user EXPLICITLY requests to remember something (e.g., "remember this", "save this", "keep this in mind", "memorize this")
- ALWAYS update when user asks to remember specific preferences, styles, or instructions
- UPDATE for:
  * User explicitly requests memory updates ("remember this", "save this", "keep this in mind", etc.)
  * Major personal info changes (name, occupation, location)
  * Strong emotional responses or preferences that contradict existing data
  * Completely new topics/interests not mentioned before
  * New users with default memory (first few interactions)
  * Specific writing style preferences or communication instructions
  * New learning patterns or expertise level changes
  * Significant technical discussions on new subjects
  * Communication style preferences that differ from existing patterns
  * Regular updates for users with established profiles (every 24h)
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
      0.1,
      analysisSchema
    );
    
    if (analysisResult) {
      try {
        const analysis = JSON.parse(analysisResult);
        console.log(`🧠 [SMART TRIGGER] Analysis result:`, analysis);
        return {
          shouldUpdate: analysis.shouldUpdate || false,
          reasons: analysis.reasons || [],
          categories: analysis.categories || [],
          edits: analysis.edits
        };
      } catch (parseError) {
        console.error('❌ [SMART TRIGGER] Failed to parse analysis result:', parseError);
      }
    }
    
    // AI 분석 실패 시 업데이트 건너뛰기
    console.log(`⏭️ [SMART TRIGGER] AI analysis failed, skipping memory update`);
    return {
      shouldUpdate: false,
      reasons: ['AI analysis failed'],
      categories: []
    };
    
  } catch (error) {
    console.error('❌ [SMART TRIGGER] Analysis failed:', error);
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
  INTERESTS: '02-interests',
  INTERACTION_HISTORY: '03-interaction-history',
  RELATIONSHIP: '04-relationship'
};

/**
 * Map category name from AI analysis format to database format
 * @param category - Category name from AI (e.g., 'personal-info')
 * @returns Database category name (e.g., '00-personal-info')
 */
function mapCategoryToDb(category: string): string | null {
  const mapping: Record<string, string> = {
    'personal-info': MEMORY_CATEGORIES.PERSONAL_INFO,
    'preferences': MEMORY_CATEGORIES.PREFERENCES,
    'interests': MEMORY_CATEGORIES.INTERESTS,
    'interaction-history': MEMORY_CATEGORIES.INTERACTION_HISTORY,
    'relationship': MEMORY_CATEGORIES.RELATIONSHIP
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
    console.log(`📝 [MEMORY CATEGORY] Updating ${category} for user ${userId}`);
    // console.log('--------------------------------');
    // console.log(`📝 [MEMORY CATEGORY] System prompt text:`, systemPromptText);
    // console.log('--------------------------------');
    // console.log(`📝 [MEMORY CATEGORY] Prompt content:`, promptContent);
    // console.log('--------------------------------');
    
    const result = await callMemoryBankUpdate(
      MEMORY_UPDATE_MODEL,
      systemPromptText,
      promptContent,
      maxTokens,
      MEMORY_UPDATE_TEMPERATURE
    );
    
    if (result) {
      console.log(`💾 [MEMORY CATEGORY] Saving ${category} to database...`);
      console.log('--------------------------------');
      console.log(`📝 [MEMORY CATEGORY] Result:`, result);
      console.log('--------------------------------');
      const dbResult = await updateMemoryBank(supabase, userId, category, result);
      
      if (dbResult.error) {
        console.error(`❌ [MEMORY CATEGORY] Database save failed for ${category}:`, dbResult.error);
        return null;
      }
      
      console.log(`✅ [MEMORY CATEGORY] Successfully updated ${category} for user ${userId}`);
      return result;
    } else {
      console.error(`❌ [MEMORY CATEGORY] AI generation failed for ${category}`);
    }
    
    return null;
  } catch (error) {
    console.error(`❌ [MEMORY CATEGORY] Error updating memory category ${category}:`, error);
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
    
    // Extract conversation text from recent messages
    const recentConversationText = getRecentConversationText(messages);
    
    // 메모리 유무에 따른 조건부 접근
    const hasExistingMemory = categoryMemory && !categoryMemory.includes('No previous personal information recorded');
    
    const personalInfoPrompt = hasExistingMemory 
      ? `Update the user's personal information based on new conversation data.

EXISTING PERSONAL INFO:
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

CRITICAL FORMAT REQUIREMENTS:
- MUST maintain the exact same markdown structure as the existing profile
- MUST preserve all existing section headers (## Basic Details, ## Professional Context, ## Usage Patterns)
- MUST maintain the same language as the existing profile
- DELETE any content that doesn't fit the required format
- NEVER include explanatory text, meta-comments, or reasoning
- Output ONLY the markdown profile content
- NO sentences like 'No new X can be inferred...' or 'The existing profile will be returned unchanged'
- If no updates needed, return ONLY the existing profile in pure markdown format

Update the existing personal info profile by:
1. ${edits && edits.length > 0 ? 'Following the specific edit operations listed above' : 'Integrating new observations while preserving previous insights'}
2. Only updating information that can be reliably inferred from the new conversation
3. Maintaining the exact same language and format as the existing profile
4. If no new personal info insights are available, return ONLY the existing profile in pure markdown format without any explanatory text`
      
      : `Create a new user personal information profile based on conversation analysis.

BASIC USER DATA:
- Name: ${basicInfo.name || '[Extract from conversation if mentioned]'}
- Member since: ${basicInfo.created_at ? new Date(basicInfo.created_at).toLocaleDateString() : 'Unknown'}
- Last active: ${basicInfo.last_sign_in_at ? new Date(basicInfo.last_sign_in_at).toLocaleDateString() : 'Unknown'}

CONVERSATION:
${recentConversationText}

CRITICAL FORMAT REQUIREMENTS:
- MUST use exactly these section headers: ## Basic Details, ## Professional Context, ## Usage Patterns
- MUST analyze conversation to detect user's preferred language and write entire profile in that language
- MUST follow the exact structure shown below
- DELETE any content that doesn't fit the required format

Create a comprehensive user profile in markdown format with these EXACT sections:

## Basic Details
- Name: [Extract from conversation if mentioned, otherwise use provided name]
- Member since: [Use provided date]
- Last active: [Use provided date]
- Language preference: [Extract from conversation]

## Professional Context
- Occupation: [Extract from conversation if mentioned]
- Expertise level: [Beginner/Intermediate/Advanced - infer from conversation]
- Fields: [Extract main professional/interest areas]

## Usage Patterns
- Typical activity: [Identify any patterns in usage]
- Session frequency: [How often they engage in conversations]

GUIDELINES:
1. Only include information that can be reliably inferred from the conversation or the provided user data
2. DO NOT make up information that wasn't mentioned or isn't provided
3. If information isn't available, keep the existing placeholder text in brackets
4. Follow the exact format requirements above - no deviations allowed`;
    
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
    
    // 메모리 유무에 따른 조건부 접근
    const hasExistingMemory = categoryMemory && !categoryMemory.includes('No previous preferences recorded');
    
    const preferencesPrompt = hasExistingMemory 
      ? `Update the user's preferences based on new conversation data.

EXISTING PREFERENCES:
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
- MUST maintain the exact same markdown structure as the existing profile
- MUST preserve all existing section headers (## Communication Style, ## Content Preferences, ## Response Format Preferences)
- MUST maintain the same language as the existing profile
- DELETE any content that doesn't fit the required format
- NEVER include explanatory text, meta-comments, or reasoning
- Output ONLY the markdown profile content
- NO sentences like 'No new X can be inferred...' or 'The existing profile will be returned unchanged'
- If no updates needed, return ONLY the existing profile in pure markdown format

Update the existing preference profile by:
1. ${edits && edits.length > 0 ? 'Following the specific edit operations listed above' : 'Integrating new observations while preserving previous insights'}
2. Only updating preferences that can be reliably inferred from the new conversation
3. Maintaining the exact same language and format as the existing profile
4. If no new preference insights are available, return ONLY the existing profile in pure markdown format without any explanatory text`
      
      : `Create a new user preference profile based on conversation analysis.

CONVERSATION:
${conversationText}

CRITICAL FORMAT REQUIREMENTS:
- MUST use exactly these section headers: ## Communication Style, ## Content Preferences, ## Response Format Preferences
- MUST analyze conversation to detect user's preferred language and write entire profile in that language
- MUST follow the exact structure shown below
- DELETE any content that doesn't fit the required format

Create a comprehensive preference profile in markdown format with these EXACT sections:

## Communication Style
- Preferred response length: [Concise/Detailed - analyze how they respond to different length answers]
- Technical detail level: [Basic/Intermediate/Advanced - analyze their comfort with technical details]
- Tone preference: [Casual/Professional/Academic - infer from their language style]
- Language style: [Formal/Informal - analyze their writing style]

## Content Preferences
- Code examples: [Frequency of code-related questions, preference for examples]
- Visual elements: [Any mentions or requests for visual aids, diagrams, etc.]
- Step-by-step guides: [Do they prefer procedural explanations?]
- References inclusion: [Do they ask for sources or additional reading?]

## Response Format Preferences
- Structure preference: [Do they prefer structured responses, bullet points, or prose?]
- Organization style: [Linear flow vs. hierarchical organization]
- Detail presentation: [How they prefer information to be organized and presented]

GUIDELINES:
1. Only include preferences that can be reliably inferred from the conversation
2. If certain preferences can't be determined, indicate "Not enough data" rather than guessing
3. Follow the exact format requirements above - no deviations allowed`;
    
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
      ? `Update the user's interests based on new conversation data.

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
- MUST maintain the exact same markdown structure as the existing profile
- MUST preserve all existing section headers (## Primary Interests, ## Recent Topics, ## Learning Journey)
- MUST maintain the same language as the existing profile
- DELETE any content that doesn't fit the required format
- NEVER include explanatory text, meta-comments, or reasoning
- Output ONLY the markdown profile content
- NO sentences like 'No new X can be inferred...' or 'The existing profile will be returned unchanged'
- If no updates needed, return ONLY the existing profile in pure markdown format

Update the existing interests profile by:
1. ${edits && edits.length > 0 ? 'Following the specific edit operations listed above' : 'Integrating new observations while preserving previous insights'}
2. Only updating interests that can be reliably inferred from the new conversation
3. Maintaining the exact same language and format as the existing profile
4. If no new interest insights are available, return ONLY the existing profile in pure markdown format without any explanatory text`
      
      : `Create a new user interests profile based on conversation analysis.

CONVERSATION:
${conversationText}

CRITICAL FORMAT REQUIREMENTS:
- MUST use exactly these section headers: ## Primary Interests, ## Recent Topics, ## Learning Journey
- MUST analyze conversation to detect user's preferred language and write entire profile in that language
- MUST follow the exact structure shown below
- DELETE any content that doesn't fit the required format

Create a comprehensive interest profile in markdown format with these EXACT sections:

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

GUIDELINES:
1. Focus on identifying genuine interests, not just passing mentions
2. Look for patterns across multiple messages or sessions
3. Prioritize recurring topics that show sustained interest
4. Be specific about topics rather than using generic categories
5. Follow the exact format requirements above - no deviations allowed`;
    
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
 * Update the interaction history
 */
export async function updateInteractionHistory(
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
        MEMORY_CATEGORIES.INTERACTION_HISTORY
      );
      categoryMemory = data;
    }
    
    const recentMessages = messages.slice(-RECENT_MESSAGES_COUNT);
    const conversationText = convertMessagesToText(recentMessages);
    
    // 현재 날짜 정보 추가
    const currentDate = new Date().toLocaleDateString();
    
    // 메모리 유무에 따른 조건부 접근
    const hasExistingMemory = categoryMemory && !categoryMemory.includes('No previous interaction history recorded');
    
    const historyPrompt = hasExistingMemory 
      ? `Update the user's interaction history based on new conversation data.

EXISTING INTERACTION HISTORY:
${categoryMemory}

NEW CONVERSATION (${currentDate}):
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
- MUST maintain the exact same markdown structure as the existing profile
- MUST preserve all existing section headers (## Recent Conversations, ## Recurring Questions, ## Unresolved Issues)
- MUST maintain the same language as the existing profile
- DELETE any content that doesn't fit the required format
- Place the new interaction at the top of the Recent Conversations section
- NEVER include explanatory text, meta-comments, or reasoning
- Output ONLY the markdown profile content
- NO sentences like 'No new X can be inferred...' or 'The existing profile will be returned unchanged'
- If no updates needed, return ONLY the existing profile in pure markdown format

Update the existing interaction history by:
1. ${edits && edits.length > 0 ? 'Following the specific edit operations listed above' : 'Adding today\'s conversation summary to the top of Recent Conversations'}
2. ${edits && edits.length > 0 ? 'Following the specific edit operations listed above' : 'Integrating new observations while preserving previous insights'}
3. Maintaining the exact same language and format as the existing profile
4. If no new interaction insights are available, return ONLY the existing profile in pure markdown format without any explanatory text`
      
      : `Create a new user interaction history based on conversation analysis.

CONVERSATION (${currentDate}):
${conversationText}

CRITICAL FORMAT REQUIREMENTS:
- MUST use exactly these section headers: ## Recent Conversations, ## Recurring Questions, ## Unresolved Issues
- MUST analyze conversation to detect user's preferred language and write entire profile in that language
- MUST follow the exact structure shown below
- DELETE any content that doesn't fit the required format

Create a comprehensive interaction history in markdown format with these EXACT sections:

## Recent Conversations
- Today (${currentDate}): Summarize this conversation with main topics and any conclusions reached
- Focus on capturing actionable information and important outcomes

## Recurring Questions
- Identify any questions or topics that seem to repeat across conversations
- Note the frequency and context of these recurring patterns

## Unresolved Issues
- Note any questions or problems that weren't fully addressed
- Include any tasks the user mentioned they wanted to complete

GUIDELINES:
1. Prioritize information that will be useful for future interactions
2. Focus on factual summaries rather than interpretations
3. Include dates wherever possible to maintain chronology
4. Keep the history concise but comprehensive
5. Follow the exact format requirements above - no deviations allowed`;
    
    await updateMemoryCategory(
      supabase,
      userId,
      MEMORY_CATEGORIES.INTERACTION_HISTORY,
      'Create a structured interaction history from conversation',
      historyPrompt
    );
  } catch (error) {
    console.error("Error updating interaction history:", error);
  }
}

/**
 * Update the relationship development
 */
export async function updateRelationship(
  supabase: SupabaseClient,
  userId: string,
  messages: any[],
  userMessage: string,
  aiMessage: string,
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
        MEMORY_CATEGORIES.RELATIONSHIP
      );
      categoryMemory = data;
    }
    
    // 최근 대화 분석을 통한 감정 상태와 소통 패턴 파악
    const recentConversation = getRecentConversationText(messages);
    
    // 메모리 유무에 따른 조건부 접근
    const hasExistingMemory = categoryMemory && !categoryMemory.includes('No previous relationship data recorded');
    
    const relationshipPrompt = hasExistingMemory 
      ? `Update the AI-user relationship profile based on new conversation data.

EXISTING RELATIONSHIP PROFILE:
${categoryMemory}

NEW CONVERSATION CONTEXT:
${recentConversation}

LATEST INTERACTION:
User: ${userMessage}
AI: ${aiMessage}

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
- MUST maintain the exact same markdown structure as the existing profile
- MUST preserve all existing section headers (## Communication Quality, ## Emotional Patterns, ## Personalization Strategy)
- MUST maintain the same language as the existing profile
- DELETE any content that doesn't fit the required format
- NEVER include explanatory text, meta-comments, or reasoning
- Output ONLY the markdown profile content
- NO sentences like 'No new X can be inferred...' or 'The existing profile will be returned unchanged'
- If no updates needed, return ONLY the existing profile in pure markdown format

Update the existing relationship profile by:
1. ${edits && edits.length > 0 ? 'Following the specific edit operations listed above' : 'Integrating new observations while preserving previous insights'}
2. Only updating relationship insights that can be reliably inferred from the new conversation
3. Maintaining the exact same language and format as the existing profile
4. If no new relationship insights are available, return ONLY the existing profile in pure markdown format without any explanatory text`
      
      : `Create a new AI-user relationship profile based on conversation analysis.

CONVERSATION CONTEXT:
${recentConversation}

LATEST INTERACTION:
User: ${userMessage}
AI: ${aiMessage}

CRITICAL FORMAT REQUIREMENTS:
- MUST use exactly these section headers: ## Communication Quality, ## Emotional Patterns, ## Personalization Strategy
- MUST analyze conversation to detect user's preferred language and write entire profile in that language
- MUST follow the exact structure shown below
- DELETE any content that doesn't fit the required format

Create a comprehensive relationship profile in markdown format with these EXACT sections:

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

GUIDELINES:
1. Focus on objective observations rather than judgments
2. Be specific about observable communication patterns
3. Don't make assumptions about the user's actual feelings or thoughts
4. Focus on insights that will help improve future interactions
5. Follow the exact format requirements above - no deviations allowed`;
    
    await updateMemoryCategory(
      supabase,
      userId,
      MEMORY_CATEGORIES.RELATIONSHIP,
      'Analyze and update AI-user relationship insights',
      relationshipPrompt
    );
  } catch (error) {
    console.error("Error updating relationship profile:", error);
  }
}

/**
 * Selective memory update - 특정 카테고리만 업데이트
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
): Promise<void> {
  try {
    const startTime = Date.now();
    console.log(`🎯 [SELECTIVE UPDATE] Updating categories: ${categories.join(', ')}`);
    
    const updatePromises: Promise<any>[] = [];
    
    // 🆕 Fetch category-specific memory data
    const categoryDataMap: Record<string, string | null> = {};
    
    // Handle 'all' category specially
    if (categories.includes('all')) {
      // Fetch all categories
      for (const [key, dbCategory] of Object.entries(MEMORY_CATEGORIES)) {
        const { data } = await getMemoryBankEntry(supabase, userId, dbCategory);
        // Map back to AI format for the map
        const aiFormat = dbCategory.replace(/^\d+-/, ''); // Remove "00-", "01-", etc.
        categoryDataMap[aiFormat] = data;
      }
    } else {
      // Fetch only specified categories
      for (const category of categories) {
        const dbCategory = mapCategoryToDb(category);
        if (dbCategory) {
          const { data } = await getMemoryBankEntry(supabase, userId, dbCategory);
          categoryDataMap[category] = data;
        } else {
          console.warn(`⚠️ [SELECTIVE UPDATE] Unknown category: ${category}`);
        }
      }
    }
    
    // Group edits by category
    const editsByCategory: Record<string, Array<{editIntent: 'add' | 'delete' | 'modify', targetContent: string}>> = {};
    if (edits) {
      edits.forEach(edit => {
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
    const updateFunctions = {
      'personal-info': () => updatePersonalInfo(supabase, userId, messages, categoryDataMap['personal-info'], editsByCategory['personal-info']),
      'preferences': () => updatePreferences(supabase, userId, messages, categoryDataMap['preferences'], editsByCategory['preferences']),
      'interests': () => updateInterests(supabase, userId, messages, categoryDataMap['interests'], editsByCategory['interests']),
      'interaction-history': () => updateInteractionHistory(supabase, userId, messages, categoryDataMap['interaction-history'], editsByCategory['interaction-history']),
      'relationship': () => updateRelationship(supabase, userId, messages, userMessage, aiMessage, categoryDataMap['relationship'], editsByCategory['relationship']),
      'all': () => Promise.all([
        updatePersonalInfo(supabase, userId, messages, categoryDataMap['personal-info'], editsByCategory['personal-info']),
        updatePreferences(supabase, userId, messages, categoryDataMap['preferences'], editsByCategory['preferences']),
        updateInterests(supabase, userId, messages, categoryDataMap['interests'], editsByCategory['interests']),
        updateInteractionHistory(supabase, userId, messages, categoryDataMap['interaction-history'], editsByCategory['interaction-history']),
        updateRelationship(supabase, userId, messages, userMessage, aiMessage, categoryDataMap['relationship'], editsByCategory['relationship'])
      ])
    };
    
    // 선택된 카테고리만 업데이트
    categories.forEach(category => {
      if (updateFunctions[category as keyof typeof updateFunctions]) {
        updatePromises.push(updateFunctions[category as keyof typeof updateFunctions]());
      }
    });
    
    if (updatePromises.length === 0) {
      console.log(`⏭️ [SELECTIVE UPDATE] No valid categories to update`);
      return;
    }
    
    // 선택적 업데이트 실행
    const results = await Promise.allSettled(updatePromises);
    
    const duration = Date.now() - startTime;
    const successes = results.filter(result => result.status === 'fulfilled').length;
    const failures = results.filter(result => result.status === 'rejected').length;
    
    // 실패한 업데이트 로그
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`❌ [SELECTIVE UPDATE] Failed to update ${categories[index]}:`, result.reason);
      }
    });
    
    if (successes > 0) {
      console.log(`✅ [SELECTIVE UPDATE] ${successes}/${categories.length} categories updated successfully in ${duration}ms`);
    } else {
      console.error(`❌ [SELECTIVE UPDATE] All ${categories.length} category updates failed in ${duration}ms`);
    }
    
  } catch (error) {
    console.error("❌ [SELECTIVE UPDATE] Selective memory update failed:", error);
  }
}

/**
 * Smart Memory Update - AI 분석 기반 지능적 업데이트
 */
export async function smartUpdateMemoryBanks(
  supabase: SupabaseClient,
  userId: string,
  chatId: string,
  messages: any[],
  userMessage: string,
  aiMessage: string
  // 🆕 REMOVE memoryData parameter
): Promise<void> {
  try {
    // 🆕 Fetch all memory for analysis purposes ONLY
    const { data: allMemoryData } = await getAllMemoryBank(supabase, userId);
    
    // 1. 메모리 업데이트 필요성 분석
    const analysis = await shouldUpdateMemory(supabase, userId, messages, userMessage, aiMessage, allMemoryData);
    
    console.log(`🧠 [SMART UPDATE] Analysis complete:`, {
      shouldUpdate: analysis.shouldUpdate,
      categories: analysis.categories,
      reasons: analysis.reasons
    });
    
    // 2. 업데이트 불필요 시 건너뛰기
    if (!analysis.shouldUpdate) {
      console.log(`⏭️ [SMART UPDATE] Skipping update - ${analysis.reasons.join(', ')}`);
      return;
    }
    
    // 3. 선택적 업데이트 실행
    console.log(`🚀 [SMART UPDATE] Executing memory update`);
    await updateSelectiveMemoryBanks(
      supabase, userId, chatId, messages, userMessage, aiMessage, 
      analysis.categories,
      analysis.edits
    );
    
  } catch (error) {
    console.error("❌ [SMART UPDATE] Smart memory update failed:", error);
  }
} 