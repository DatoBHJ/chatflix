import { SupabaseClient } from '@supabase/supabase-js';
import { updateMemoryBank, getLastMemoryUpdate } from '@/utils/memory-bank';
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
const MEMORY_UPDATE_MODEL = 'gpt-4.1-nano';
const MEMORY_UPDATE_MAX_TOKENS = 1500;
const MEMORY_UPDATE_TEMPERATURE = 0.3;

// 🆕 Smart Trigger 관련 상수
const MEMORY_ANALYSIS_MODEL = 'gpt-4.1-nano'; // OpenAI API 호환 모델 사용
const MIN_MESSAGE_LENGTH = 20; // 최소 메시지 길이 
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
  priority: 'high' | 'medium' | 'low';
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
        categories: ['all'],
        priority: 'high'
      };
    }
    
    // 24시간이 지났으면 업데이트 (기본 메모리 데이터가 있어도 시간 기반으로 업데이트)
    if (timeSinceLastUpdate > MAX_TIME_SINCE_LAST_UPDATE) {
      return {
        shouldUpdate: true,
        reasons: ['Maximum time threshold reached'],
        categories: ['all'],
        priority: 'medium'
      };
    }
    
    // 3. 메시지 길이 확인 (더 엄격한 조건)
    if (userMessage.length < MIN_MESSAGE_LENGTH) {
      return {
        shouldUpdate: false,
        reasons: ['Messages too short for meaningful analysis'],
        categories: [],
        priority: 'low'
      };
    }
    
    // 4. AI 분석을 통한 컨텍스트 중요도 판단
    const recentConversation = messages.slice(-3).map(msg => 
      typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
    ).join('\n');
    
    const analysisPrompt = `Analyze this conversation to determine if user memory should be updated.
    
USER MESSAGE: "${userMessage}"
AI RESPONSE: "${aiMessage}"
RECENT CONTEXT: "${recentConversation}"
${memoryData ? `EXISTING MEMORY DATA: "${memoryData}"` : 'NO EXISTING MEMORY DATA'}
${isDefaultMemory ? 'NOTE: User has default/initial memory data - prioritize updates' : ''}

Determine:
1. Should memory be updated? (yes/no)
2. What categories need updating? (personal-info, preferences, interests, interaction-history, relationship)
3. Priority level? (high/medium/low)
4. Brief reasons

Respond in JSON format:
{
  "shouldUpdate": boolean,
  "categories": ["category1", "category2"],
  "priority": "high|medium|low",
  "reasons": ["reason1", "reason2"]
}

CRITICAL RULES FOR MEMORY UPDATES:
- ALWAYS update when user EXPLICITLY requests to remember something (e.g., "remember this", "save this", "keep this in mind", "memorize this")
- ALWAYS update when user asks to remember specific preferences, styles, or instructions
- HIGH priority: 
  * User explicitly requests memory updates ("remember this", "save this", "keep this in mind", etc.)
  * Major personal info changes (name, occupation, location)
  * Strong emotional responses or preferences that contradict existing data
  * Completely new topics/interests not mentioned before
  * New users with default memory (first few interactions)
  * Specific writing style preferences or communication instructions
- MEDIUM priority:
  * New learning patterns or expertise level changes
  * Significant technical discussions on new subjects
  * Communication style preferences that differ from existing patterns
  * Regular updates for users with established profiles (every 24h)
- LOW priority:
  * Minor clarifications or elaborations on existing topics
  * Simple questions or greetings
  * Information already present in memory
- SKIP update for:
  * Very short exchanges (< 50 characters total)
  * Purely factual Q&A without personal context
  * Information already well-documented in memory
  * Routine conversations without new insights
  * Repeated topics or preferences already recorded

EXPLICIT MEMORY REQUESTS:
- Look for phrases like: "remember this", "save this", "keep this in mind", "memorize this", "remember that", "save that"
- When user asks to remember something specific, ALWAYS update memory regardless of other factors
- This includes style preferences, writing instructions, communication preferences, etc.

COMPARISON LOGIC:
- Compare new information with existing memory data
- Only update if the new information is substantially different or adds significant value
- If the information is already well-covered in memory, skip the update
- Focus on capturing truly unique or changing aspects of the user's profile
- EXCEPTION: Always update when user explicitly requests it`;

    // AI 분석 호출 (경량 모델 사용)
    const analysisResult = await callMemoryBankUpdate(
      MEMORY_ANALYSIS_MODEL,
      'You are an AI assistant that analyzes conversations to determine memory update necessity.',
      analysisPrompt,
      200,
      0.1
    );
    
    if (analysisResult) {
      try {
        const analysis = JSON.parse(analysisResult);
        console.log(`🧠 [SMART TRIGGER] Analysis result:`, analysis);
        return {
          shouldUpdate: analysis.shouldUpdate || false,
          reasons: analysis.reasons || [],
          categories: analysis.categories || [],
          priority: analysis.priority || 'low'
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
      categories: [],
      priority: 'low'
    };
    
  } catch (error) {
    console.error('❌ [SMART TRIGGER] Analysis failed:', error);
    // AI 분석 실패 시 업데이트 건너뛰기
    return {
      shouldUpdate: false,
      reasons: ['Analysis failed'],
      categories: [],
      priority: 'low'
    };
  }
}

// 최근 메시지 추출을 위한 상수
// 가장 최근 메시지 5개만 고려 - 현재 대화의 직접적인 컨텍스트를 캡처하기 위함
const RECENT_MESSAGES_COUNT = 5;
// 조금 더 넓은 컨텍스트를 위해 7개의 메시지 사용 - 선호도, 관심사 등 패턴 파악에 유용
const EXTENDED_MESSAGES_COUNT = 7;

// 메모리 뱅크 카테고리 상수
const MEMORY_CATEGORIES = {
  PERSONAL_INFO: '00-personal-info',
  PREFERENCES: '01-preferences',
  INTERESTS: '02-interests',
  INTERACTION_HISTORY: '03-interaction-history',
  RELATIONSHIP: '04-relationship'
};


/**
 * Utility function to convert messages to text
 */
function convertMessagesToText(messages: any[]): string {
  return messages.map(msg => {
    const role = msg.role.charAt(0).toUpperCase() + msg.role.slice(1);
    const content = typeof msg.content === 'string' 
      ? msg.content 
      : Array.isArray(msg.content) 
        ? msg.content.filter((part: any) => part.type === 'text').map((part: any) => part.text).join('\n')
        : JSON.stringify(msg.content);
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
    
    const result = await callMemoryBankUpdate(
      MEMORY_UPDATE_MODEL,
      systemPromptText,
      promptContent,
      maxTokens,
      MEMORY_UPDATE_TEMPERATURE
    );
    
    if (result) {
      console.log(`💾 [MEMORY CATEGORY] Saving ${category} to database...`);
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
  memoryData?: string | null
): Promise<string | null> {
  try {
    // Get basic user info from auth.users
    const basicInfo = await getUserBasicInfo(supabase, userId);
    
    // Extract conversation text from recent messages
    const recentConversationText = getRecentConversationText(messages);
    
    // Create a context-rich prompt that includes the basic user info
    const personalInfoPrompt = `Based on the conversation and available user information, extract or update the user's personal information.
Create a comprehensive user profile in markdown format with the following sections:

## Basic Details
- Name: ${basicInfo.name || '[Extract from conversation if mentioned]'}
- Member since: ${basicInfo.created_at ? new Date(basicInfo.created_at).toLocaleDateString() : 'Unknown'}
- Last active: ${basicInfo.last_sign_in_at ? new Date(basicInfo.last_sign_in_at).toLocaleDateString() : 'Unknown'}
- Language preference: [Extract from conversation]

## Professional Context
- Occupation: [Extract from conversation if mentioned]
- Expertise level: [Beginner/Intermediate/Advanced - infer from conversation]
- Fields: [Extract main professional/interest areas]

## Usage Patterns
- Typical activity: [Identify any patterns in usage]
- Session frequency: [How often they engage in conversations]

Previous personal information:
${memoryData || "No previous personal information recorded."}

Current conversation:
${recentConversationText}

IMPORTANT GUIDELINES:
1. Only include information that can be reliably inferred from the conversation or the provided user data.
2. DO NOT make up information that wasn't mentioned or isn't provided.
3. If information isn't available, keep the existing placeholder text in brackets.
4. If updating an existing profile, integrate new observations while preserving previous insights.
5. Format as a structured markdown document with clear sections.
6. Focus on creating a useful reference that helps understand the user's background and context.
`;
    
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
  memoryData?: string | null
): Promise<void> {
  try {
    const recentMessages = messages.slice(-EXTENDED_MESSAGES_COUNT);
    const conversationText = convertMessagesToText(recentMessages);
    
    const preferencesPrompt = `Based on the conversation and user profile data, identify and update the user's preferences.
Create a comprehensive preference profile in markdown format with the following sections:

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

## UI/UX Preferences
- Response format: [Do they prefer structured responses, bullet points, or prose?]
- Follow-up style: [Do they engage with follow-up questions?]

Previous preferences information:
${memoryData || "No previous preferences recorded."}

Current conversation:
${conversationText}

IMPORTANT GUIDELINES:
1. If this is the first time analyzing preferences, create a complete profile based on available information.
2. If updating an existing profile, integrate new observations while preserving previous insights.
3. Only include preferences that can be reliably inferred from the conversation.
4. If certain preferences can't be determined, indicate "Not enough data" rather than guessing.
5. Format as a structured markdown document with clear sections.
`;
    
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
  memoryData?: string | null
): Promise<void> {
  try {
    const recentMessages = messages.slice(-EXTENDED_MESSAGES_COUNT);
    const conversationText = convertMessagesToText(recentMessages);
    
    const interestsPrompt = `Based on the conversation and user profile data, identify and update the user's interests and topics they care about.
Create a comprehensive interest profile in markdown format with the following sections:

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

Previous interests information:
${memoryData || "No previous interests recorded."}

Current conversation:
${conversationText}

IMPORTANT GUIDELINES:
1. Focus on identifying genuine interests, not just passing mentions.
2. Look for patterns across multiple messages or sessions.
3. Prioritize recurring topics that show sustained interest.
4. If updating an existing profile, integrate new observations while preserving previous insights.
5. Format as a structured markdown document with clear sections.
6. Be specific about topics rather than using generic categories.
`;
    
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
  memoryData?: string | null
): Promise<void> {
  try {
    const recentMessages = messages.slice(-EXTENDED_MESSAGES_COUNT);
    const conversationText = convertMessagesToText(recentMessages);
    
    // 현재 날짜 정보 추가
    const currentDate = new Date().toLocaleDateString();
    
    const historyPrompt = `Summarize and organize the key points of this conversation to maintain in the user's interaction history.
Create a comprehensive interaction history in markdown format with the following sections:

## Recent Conversations
- Today (${currentDate}): Summarize this conversation with main topics and any conclusions reached
- Focus on capturing actionable information and important outcomes

## Recurring Questions
- Identify any questions or topics that seem to repeat across conversations
- Note the frequency and context of these recurring patterns

## Unresolved Issues
- Note any questions or problems that weren't fully addressed
- Include any tasks the user mentioned they wanted to complete

Previous interaction history:
${memoryData || "No previous interaction history recorded."}

Current conversation:
${conversationText}

IMPORTANT GUIDELINES:
1. Prioritize information that will be useful for future interactions.
2. Focus on factual summaries rather than interpretations.
3. If updating existing history, place the new interaction at the top of the Recent Conversations section.
4. Include dates wherever possible to maintain chronology.
5. Format as a structured markdown document with clear sections.
6. Keep the history concise but comprehensive.
`;
    
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
  memoryData?: string | null
): Promise<void> {
  try {
    // 최근 대화 분석을 통한 감정 상태와 소통 패턴 파악
    const recentConversation = getRecentConversationText(messages);
    
    const relationshipPrompt = `Based on this conversation and comprehensive user profile data, update the AI-user relationship profile.
Create a comprehensive relationship profile in markdown format with the following sections:

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

Previous relationship information:
${memoryData || "No previous relationship data recorded."}

Recent conversation context:
${recentConversation}

Latest interaction:
User: ${userMessage}
AI: ${aiMessage}

IMPORTANT GUIDELINES:
1. Focus on objective observations rather than judgments.
2. If updating existing data, integrate new observations while preserving previous insights.
3. Be specific about observable communication patterns.
4. Don't make assumptions about the user's actual feelings or thoughts.
5. Format as a structured markdown document with clear sections.
6. Focus on insights that will help improve future interactions.
7. Use the user profile data to provide more personalized relationship analysis.
`;
    
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
  priority: 'high' | 'medium' | 'low',
  memoryData?: string | null
): Promise<void> {
  try {
    const startTime = Date.now();
    console.log(`🎯 [SELECTIVE UPDATE] Updating categories: ${categories.join(', ')} with ${priority} priority`);
    
    const updatePromises: Promise<any>[] = [];
    
    // 카테고리별 업데이트 함수 매핑
    const updateFunctions = {
      'personal-info': () => updatePersonalInfo(supabase, userId, messages, memoryData),
      'preferences': () => updatePreferences(supabase, userId, messages, memoryData),
      'interests': () => updateInterests(supabase, userId, messages, memoryData),
      'interaction-history': () => updateInteractionHistory(supabase, userId, messages, memoryData),
      'relationship': () => updateRelationship(supabase, userId, messages, userMessage, aiMessage, memoryData),
      'all': () => Promise.all([
        updatePersonalInfo(supabase, userId, messages, memoryData),
        updatePreferences(supabase, userId, messages, memoryData),
        updateInterests(supabase, userId, messages, memoryData),
        updateInteractionHistory(supabase, userId, messages, memoryData),
        updateRelationship(supabase, userId, messages, userMessage, aiMessage, memoryData)
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
  aiMessage: string,
  memoryData?: string | null
): Promise<void> {
  try {
    // 1. 메모리 업데이트 필요성 분석
    const analysis = await shouldUpdateMemory(supabase, userId, messages, userMessage, aiMessage, memoryData);
    
    console.log(`🧠 [SMART UPDATE] Analysis complete:`, {
      shouldUpdate: analysis.shouldUpdate,
      priority: analysis.priority,
      categories: analysis.categories,
      reasons: analysis.reasons
    });
    
    // 2. 업데이트 불필요 시 건너뛰기
    if (!analysis.shouldUpdate) {
      console.log(`⏭️ [SMART UPDATE] Skipping update - ${analysis.reasons.join(', ')}`);
      return;
    }
    
    // 3. 우선순위에 따른 선택적 업데이트
    if (analysis.priority === 'high') {
      // 높은 우선순위: 즉시 업데이트
      console.log(`🔥 [SMART UPDATE] High priority - immediate update`);
      await updateSelectiveMemoryBanks(
        supabase, userId, chatId, messages, userMessage, aiMessage, 
        analysis.categories, analysis.priority, memoryData
      );
    } else if (analysis.priority === 'medium') {
      // 중간 우선순위: 3초 딜레이 후 업데이트
      console.log(`⏱️ [SMART UPDATE] Medium priority - delayed update (3s)`);
      setTimeout(async () => {
        await updateSelectiveMemoryBanks(
          supabase, userId, chatId, messages, userMessage, aiMessage, 
          analysis.categories, analysis.priority, memoryData
        );
      }, 3000);
    } else {
      // 낮은 우선순위: 30초 딜레이 후 업데이트 (배치 처리 가능)
      console.log(`🐌 [SMART UPDATE] Low priority - batch update (30s)`);
      setTimeout(async () => {
        await updateSelectiveMemoryBanks(
          supabase, userId, chatId, messages, userMessage, aiMessage, 
          analysis.categories, analysis.priority, memoryData
        );
      }, 30000);
    }
    
  } catch (error) {
    console.error("❌ [SMART UPDATE] Smart memory update failed:", error);
  }
} 