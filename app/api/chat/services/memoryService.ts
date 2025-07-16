import { SupabaseClient } from '@supabase/supabase-js';
import { updateMemoryBank, getLastMemoryUpdate } from '@/utils/memory-bank';
import { MultiModalMessage } from '../types';
import { callMemoryBankUpdate } from '@/app/api/chat/utils/callMemoryBankUpdate';

// fetchUserName 함수 - 최적화된 버전 (중복 auth 호출 방지)
const fetchUserName = async (userId: string, supabase: SupabaseClient) => {
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
          console.warn(`👤 [USER NAME] Auth lookup also failed, using default 'You'`);
          return 'You';
        }
        
        const authName = user.user_metadata?.full_name || user.user_metadata?.name || 'You';
        console.log(`👤 [USER NAME] Using auth metadata name: ${authName}`);
        return authName;
      } catch (authErr) {
        console.error(`❌ [USER NAME] Auth error:`, authErr);
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

// 메모리 뱅크 업데이트에 사용할 AI 모델 및 설정
const MEMORY_UPDATE_MODEL = 'gpt-4.1-nano';
const MEMORY_UPDATE_MAX_TOKENS = 800;
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
  messages: MultiModalMessage[],
  userMessage: string,
  aiMessage: string
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
    
    // 2. 강제 업데이트 조건들
    if (!lastUpdate || timeSinceLastUpdate > MAX_TIME_SINCE_LAST_UPDATE) {
      return {
        shouldUpdate: true,
        reasons: ['Maximum time threshold reached'],
        categories: ['all'],
        priority: 'medium'
      };
    }
    
    // 3. 메시지 길이 확인
    if (userMessage.length < MIN_MESSAGE_LENGTH && aiMessage.length < 100) {
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

RULES:
- HIGH priority: Personal info changes, strong preferences expressed, emotional responses
- MEDIUM priority: New interests, learning patterns, significant technical discussions
- LOW priority: Simple questions, greetings, basic clarifications
- Skip update for: Very short exchanges, purely factual Q&A without personal context`;

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
    
    // 폴백: 기본 휴리스틱 분석
    return analyzeWithHeuristics(userMessage, aiMessage, timeSinceLastUpdate);
    
  } catch (error) {
    console.error('❌ [SMART TRIGGER] Analysis failed:', error);
    // 안전한 폴백
    return {
      shouldUpdate: false,
      reasons: ['Analysis failed'],
      categories: [],
      priority: 'low'
    };
  }
}

/**
 * 휴리스틱 기반 메모리 업데이트 필요성 분석 (AI 분석 실패 시 폴백)
 */
function analyzeWithHeuristics(
  userMessage: string, 
  aiMessage: string, 
  timeSinceLastUpdate: number
): {
  shouldUpdate: boolean;
  reasons: string[];
  categories: string[];
  priority: 'high' | 'medium' | 'low';
} {
  const reasons: string[] = [];
  const categories: string[] = [];
  let priority: 'high' | 'medium' | 'low' = 'low';
  
  // 키워드 기반 분석
  const personalInfoKeywords = ['my name', 'i am', 'i work', 'my job', 'my role', 'call me', '제 이름', '저는', '제가'];
  const preferencesKeywords = ['i prefer', 'i like', 'i want', 'i need', 'prefer', '선호', '좋아해', '원해'];
  const interestsKeywords = ['interested in', 'learning', 'studying', 'working on', '관심', '배우고', '공부'];
  
  const combinedText = (userMessage + ' ' + aiMessage).toLowerCase();
  
  // Personal info 체크
  if (personalInfoKeywords.some(keyword => combinedText.includes(keyword))) {
    categories.push('personal-info');
    reasons.push('Personal information mentioned');
    priority = 'high';
  }
  
  // Preferences 체크
  if (preferencesKeywords.some(keyword => combinedText.includes(keyword))) {
    categories.push('preferences');
    reasons.push('User preferences expressed');
    if (priority !== 'high') priority = 'medium';
  }
  
  // Interests 체크
  if (interestsKeywords.some(keyword => combinedText.includes(keyword))) {
    categories.push('interests');
    reasons.push('New interests or learning topics mentioned');
    if (priority === 'low') priority = 'medium';
  }
  
  // 시간 기반 체크
  const oneHour = 60 * 60 * 1000;
  if (timeSinceLastUpdate > oneHour) {
    categories.push('interaction-history');
    reasons.push('Sufficient time since last update');
    if (priority === 'low') priority = 'medium';
  }
  
  // 긴 대화 체크
  if (userMessage.length > 200 || aiMessage.length > 500) {
    categories.push('relationship');
    reasons.push('Substantial conversation for relationship analysis');
    if (priority === 'low') priority = 'medium';
  }
  
  return {
    shouldUpdate: categories.length > 0,
    reasons,
    categories,
    priority
  };
}

// 최근 메시지 추출을 위한 상수
// 가장 최근 메시지 5개만 고려 - 현재 대화의 직접적인 컨텍스트를 캡처하기 위함
const RECENT_MESSAGES_COUNT = 5;
// 조금 더 넓은 컨텍스트를 위해 7개의 메시지 사용 - 선호도, 관심사 등 패턴 파악에 유용
const EXTENDED_MESSAGES_COUNT = 7;
// DB에서 가져올 최대 메시지 수 - 비용 효율성을 위해 10개로 제한
const MESSAGES_HISTORY_LIMIT = 10;

// 메모리 뱅크 카테고리 상수
const MEMORY_CATEGORIES = {
  PERSONAL_INFO: '00-personal-info',
  PREFERENCES: '01-preferences',
  INTERESTS: '02-interests',
  INTERACTION_HISTORY: '03-interaction-history',
  RELATIONSHIP: '04-relationship'
};

/**
 * 사용자 메모리 데이터 인터페이스
 */
interface UserMemoryData {
  personalInfo: string | null;
  preferences: string | null;
  interests: string | null;
  interactionHistory: string | null;
  relationship: string | null;
  profileData: any;
}

/**
 * Utility function to convert messages to text
 */
function convertMessagesToText(messages: MultiModalMessage[]): string {
  return messages.map(msg => {
    const role = msg.role.charAt(0).toUpperCase() + msg.role.slice(1);
    const content = typeof msg.content === 'string' 
      ? msg.content 
      : Array.isArray(msg.content) 
        ? msg.content.filter(part => part.type === 'text').map(part => part.text).join('\n')
        : JSON.stringify(msg.content);
    return `${role}: ${content}`;
  }).join('\n\n');
}

/**
 * Extract recent messages from the conversation
 */
function getRecentConversationText(messages: MultiModalMessage[], count: number = RECENT_MESSAGES_COUNT): string {
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
 * Retrieve user's recent messages for analysis
 */
async function getUserRecentMessages(supabase: SupabaseClient, userId: string, limit: number = MESSAGES_HISTORY_LIMIT): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('content, role, model, created_at, chat_session_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      return [];
    }
    
    if (!data || data.length === 0) {
      return [];
    }
    
    return data;
  } catch (error) {
    return [];
  }
}

/**
 * Retrieve user profile data from active_user_profiles
 */
async function getUserProfileData(supabase: SupabaseClient, userId: string): Promise<any> {
  try {
    const { data, error } = await supabase
      .from('active_user_profiles')
      .select('profile_data, profile_summary, analyzed_message_count')
      .eq('user_id', userId)
      .single();
    
    if (error) {
      return {};
    }
    
    if (!data) {
      return {};
    }
    
    return data;
  } catch (error) {
    return {};
  }
}

/**
 * 통합 메모리 조회 함수: 한 번의 호출로 필요한 모든 메모리 데이터 가져오기
 */
async function getUserMemoryData(supabase: SupabaseClient, userId: string): Promise<UserMemoryData> {
  try {
    // 모든 메모리 뱅크 항목 가져오기
    const { data: memoryEntries, error } = await supabase
      .from('memory_bank')
      .select('category, content')
      .eq('user_id', userId);
    
    if (error || !memoryEntries) {
      return {
        personalInfo: null,
        preferences: null,
        interests: null,
        interactionHistory: null,
        relationship: null,
        profileData: {}
      };
    }
    
    // 메모리 뱅크 항목을 카테고리별로 정리
    const memoryMap: Record<string, string> = {};
    memoryEntries.forEach(entry => {
      memoryMap[entry.category] = entry.content;
    });
    
    // 프로필 데이터 가져오기
    const profileData = await getUserProfileData(supabase, userId);
    
    return {
      personalInfo: memoryMap[MEMORY_CATEGORIES.PERSONAL_INFO] || null,
      preferences: memoryMap[MEMORY_CATEGORIES.PREFERENCES] || null,
      interests: memoryMap[MEMORY_CATEGORIES.INTERESTS] || null,
      interactionHistory: memoryMap[MEMORY_CATEGORIES.INTERACTION_HISTORY] || null,
      relationship: memoryMap[MEMORY_CATEGORIES.RELATIONSHIP] || null,
      profileData
    };
  } catch (error) {
    console.error("Error retrieving user memory data:", error);
    return {
      personalInfo: null,
      preferences: null,
      interests: null,
      interactionHistory: null,
      relationship: null,
      profileData: {}
    };
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
  messages: MultiModalMessage[]
): Promise<string | null> {
  try {
    // Get basic user info from auth.users
    const basicInfo = await getUserBasicInfo(supabase, userId);
    
    // Get all user memory data in one call
    const memoryData = await getUserMemoryData(supabase, userId);
    
    // Extract conversation text from recent messages
    const recentConversationText = getRecentConversationText(messages);
    
    // 프로필 데이터에서 유용한 추가 정보 추출
    const profileInsights = memoryData.profileData?.profile_data ? 
      `\n## Profile Analytics\n${memoryData.profileData.profile_summary || "No profile summary available."}\n` : '';
    
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
- Preferred models: [Which AI models they use most]

Previous personal information:
${memoryData.personalInfo || "No previous personal information recorded."}
${profileInsights}

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
  messages: MultiModalMessage[]
): Promise<void> {
  try {
    // Get all user memory data in one call
    const memoryData = await getUserMemoryData(supabase, userId);
    
    const recentMessages = messages.slice(-EXTENDED_MESSAGES_COUNT);
    const conversationText = convertMessagesToText(recentMessages);
    
    // 프로필 데이터에서 유용한 정보 추출
    let profilePreferences = '';
    if (memoryData.profileData?.profile_data) {
      const profileData = memoryData.profileData.profile_data;
      // 선호도와 관련된 데이터 추출 시도
      const traits = profileData.traits ? `User traits: ${profileData.traits.join(', ')}` : '';
      const patterns = profileData.patterns ? `\nObserved patterns: ${profileData.patterns.join('\n- ')}` : '';
      
      if (traits || patterns) {
        profilePreferences = `\n## Profile Insights\n${traits}${patterns}\n`;
      }
    }
    
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
${memoryData.preferences || "No previous preferences recorded."}
${profilePreferences}

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
  messages: MultiModalMessage[]
): Promise<void> {
  try {
    // Get all user memory data in one call
    const memoryData = await getUserMemoryData(supabase, userId);
    
    // 대화 세션 수를 프로필 데이터에서 가져오기
    const analyzedMessageCount = memoryData.profileData?.analyzed_message_count || 0;
    
    const recentMessages = messages.slice(-EXTENDED_MESSAGES_COUNT);
    const conversationText = convertMessagesToText(recentMessages);
    
    // 프로필 데이터에서 관심사 정보 추출
    let profileInterests = '';
    if (memoryData.profileData?.profile_data) {
      const profileData = memoryData.profileData.profile_data;
      
      // 관심사 관련 데이터 추출
      const topics = profileData.topics ? `User topics: ${profileData.topics.join(', ')}` : '';
      const keywords = profileData.keywords ? `\nKeywords: ${profileData.keywords.join(', ')}` : '';
      
      if (topics || keywords) {
        profileInterests = `\n## Profile Interests\n${topics}${keywords}\n`;
      }
    }
    
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

User has approximately ${analyzedMessageCount} analyzed messages.
${profileInterests}

Previous interests information:
${memoryData.interests || "No previous interests recorded."}

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
  messages: MultiModalMessage[]
): Promise<void> {
  try {
    // Get all user memory data in one call
    const memoryData = await getUserMemoryData(supabase, userId);
    
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
${memoryData.interactionHistory || "No previous interaction history recorded."}

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
  messages: MultiModalMessage[],
  userMessage: string,
  aiMessage: string
): Promise<void> {
  try {
    // Get all user memory data in one call
    const memoryData = await getUserMemoryData(supabase, userId);
    
    // 최근 대화 분석을 통한 감정 상태와 소통 패턴 파악
    const recentConversation = getRecentConversationText(messages);
    
    // 프로필 데이터에서 유용한 정보 추출
    const profileInsights = memoryData.profileData?.profile_data ? 
      `\n## User Profile Insights\n${JSON.stringify(memoryData.profileData.profile_data, null, 2)}\n` : '';

    const profileSummary = memoryData.profileData?.profile_summary ? 
      `\n## User Profile Summary\n${memoryData.profileData.profile_summary}\n` : '';
      
    // 분석된 메시지 수 정보 추가
    const messageAnalytics = `Analyzed message count: ${memoryData.profileData?.analyzed_message_count || 0}`;
    
    // 이전 메모리 뱅크 정보를 활용한 통합 분석
    const personalContext = memoryData.personalInfo ? 
      `\n## Personal Context\n${memoryData.personalInfo}\n` : '';
    
    const preferencesContext = memoryData.preferences ? 
      `\n## Preferences Context\n${memoryData.preferences}\n` : '';
    
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
${memoryData.relationship || "No previous relationship data recorded."}

User insights:
${profileInsights}
${profileSummary}
${messageAnalytics}
${personalContext}
${preferencesContext}

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
 * Update all memory banks in parallel
 */
export async function updateAllMemoryBanks(
  supabase: SupabaseClient, 
  userId: string, 
  chatId: string, 
  messages: MultiModalMessage[], 
  userMessage: string, 
  aiMessage: string
): Promise<void> {
  try {
    // 서버 측 시간 검사 로직 제거 - route.ts에서 이미 검사 완료
    // const lastUpdate = await getLastMemoryUpdate(supabase, userId);  // 중복 검사 제거
    // if (lastUpdate && ...) return;  // 중복 검사 제거
    
    // Initialize timer for performance tracking
    const startTime = Date.now();
    
    // Update all memory categories in parallel (allow individual failures)
    const results = await Promise.allSettled([
      updatePersonalInfo(supabase, userId, messages),
      updatePreferences(supabase, userId, messages),
      updateInterests(supabase, userId, messages),
      updateInteractionHistory(supabase, userId, messages),
      updateRelationship(supabase, userId, messages, userMessage, aiMessage)
    ]);
    
    const duration = Date.now() - startTime;
    
    // Count successes and failures
    const categoryNames = ['personal-info', 'preferences', 'interests', 'interaction-history', 'relationship'];
    const successes = results.filter(result => result.status === 'fulfilled').length;
    const failures = results.filter(result => result.status === 'rejected').length;
    
    // Log individual failures for debugging
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`❌ [MEMORY UPDATE] Failed to update ${categoryNames[index]}:`, result.reason);
      }
    });
    
    if (successes > 0) {
      console.log(`✅ [MEMORY UPDATE] ${successes}/${results.length} memory banks updated successfully in ${duration}ms`);
    } else {
      console.error(`❌ [MEMORY UPDATE] All ${results.length} memory bank updates failed in ${duration}ms`);
    }
  } catch (error) {
    console.error("Memory update process failed:", error);
  }
} 

/**
 * Selective memory update - 특정 카테고리만 업데이트
 */
export async function updateSelectiveMemoryBanks(
  supabase: SupabaseClient,
  userId: string,
  chatId: string,
  messages: MultiModalMessage[],
  userMessage: string,
  aiMessage: string,
  categories: string[],
  priority: 'high' | 'medium' | 'low'
): Promise<void> {
  try {
    const startTime = Date.now();
    console.log(`🎯 [SELECTIVE UPDATE] Updating categories: ${categories.join(', ')} with ${priority} priority`);
    
    const updatePromises: Promise<any>[] = [];
    
    // 카테고리별 업데이트 함수 매핑
    const updateFunctions = {
      'personal-info': () => updatePersonalInfo(supabase, userId, messages),
      'preferences': () => updatePreferences(supabase, userId, messages),
      'interests': () => updateInterests(supabase, userId, messages),
      'interaction-history': () => updateInteractionHistory(supabase, userId, messages),
      'relationship': () => updateRelationship(supabase, userId, messages, userMessage, aiMessage),
      'all': () => Promise.all([
        updatePersonalInfo(supabase, userId, messages),
        updatePreferences(supabase, userId, messages),
        updateInterests(supabase, userId, messages),
        updateInteractionHistory(supabase, userId, messages),
        updateRelationship(supabase, userId, messages, userMessage, aiMessage)
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
  messages: MultiModalMessage[],
  userMessage: string,
  aiMessage: string
): Promise<void> {
  try {
    // 1. 메모리 업데이트 필요성 분석
    const analysis = await shouldUpdateMemory(supabase, userId, messages, userMessage, aiMessage);
    
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
        analysis.categories, analysis.priority
      );
    } else if (analysis.priority === 'medium') {
      // 중간 우선순위: 3초 딜레이 후 업데이트
      console.log(`⏱️ [SMART UPDATE] Medium priority - delayed update (3s)`);
      setTimeout(async () => {
        await updateSelectiveMemoryBanks(
          supabase, userId, chatId, messages, userMessage, aiMessage, 
          analysis.categories, analysis.priority
        );
      }, 3000);
    } else {
      // 낮은 우선순위: 30초 딜레이 후 업데이트 (배치 처리 가능)
      console.log(`🐌 [SMART UPDATE] Low priority - batch update (30s)`);
      setTimeout(async () => {
        await updateSelectiveMemoryBanks(
          supabase, userId, chatId, messages, userMessage, aiMessage, 
          analysis.categories, analysis.priority
        );
      }, 30000);
    }
    
  } catch (error) {
    console.error("❌ [SMART UPDATE] Smart memory update failed:", error);
  }
} 