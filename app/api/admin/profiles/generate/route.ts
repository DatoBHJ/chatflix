import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
// streamText와 providers 대신 Groq SDK 사용
import { Groq } from 'groq-sdk';
import { z } from 'zod';
import { Output } from 'ai';
// 모델 정보 불러오기 (contextWindow 제한용)
import { MODEL_CONFIGS } from '@/lib/models/config';

// 간단한 토큰 계산 함수 (근사값 기반)
function estimateTokens(text: string): number {
  // 영어 기준 평균 토큰 비율: 약 4자당 1토큰, 한글 기준: 약 2자당 1토큰
  // 보수적으로 계산하기 위해 2자당 1토큰으로 계산
  return Math.ceil(text.length / 2);
}

// 토큰 제한 적용 함수
function truncateToFitContextWindow(modelId: string, prompt: string, reserveTokens: number = 2000): string {
  // 모델 정보 가져오기
  const modelConfig = MODEL_CONFIGS.find(model => model.id === modelId);
  
  // contextWindow 정보가 없으면 기본값 사용
  const contextWindow = modelConfig?.contextWindow || 128000;
  
  // 실제 사용 가능한 컨텍스트 크기 (출력 토큰과 시스템 메시지 등을 위한 공간 확보)
  const availableContext = contextWindow - reserveTokens;
  
  // 현재 프롬프트의 예상 토큰 수
  const estimatedTokens = estimateTokens(prompt);
  
  console.log(`[Token Estimation] Model: ${modelId}, Context window: ${contextWindow}, Estimated tokens: ${estimatedTokens}, Available: ${availableContext}`);
  
  // 토큰 수가 제한 내에 있으면 그대로 반환
  if (estimatedTokens <= availableContext) {
    return prompt;
  }
  
  // 토큰 제한을 초과하면 잘라내기
  // 프롬프트의 구조를 유지하기 위해 앞부분은 유지하고 User conversations 부분만 잘라냄
  const userConversationsMatch = prompt.match(/(User conversations:\n)[\s\S]+/);
  
  if (!userConversationsMatch || userConversationsMatch.index === undefined) {
    // 매칭되는 부분이 없으면 단순히 길이로 자르기
    const ratio = availableContext / estimatedTokens;
    const newLength = Math.floor(prompt.length * ratio) - 100; // 안전 마진
    console.log(`[Token Truncation] Simple truncation to ${newLength} characters`);
    return prompt.substring(0, newLength) + "\n(Note: Some conversations were truncated due to length constraints)";
  }
  
  // 프롬프트의 지시사항 부분
  const instructionPart = prompt.substring(0, userConversationsMatch.index + userConversationsMatch[1].length);
  const instructionTokens = estimateTokens(instructionPart);
  
  // 대화 부분
  const conversationsPart = prompt.substring(userConversationsMatch.index + userConversationsMatch[1].length);
  
  // 대화에 사용할 수 있는 토큰 수
  const availableForConversations = availableContext - instructionTokens;
  
  // 대화 부분이 너무 길면 자르기
  if (availableForConversations <= 0) {
    console.log(`[Token Truncation] No space for conversations, returning instructions only`);
    return instructionPart + "(No space for conversations due to token limits)";
  }
  
  // 대화 부분을 적절히 자르기
  const ratio = availableForConversations / estimateTokens(conversationsPart);
  const newConversationsLength = Math.floor(conversationsPart.length * ratio) - 100; // 안전 마진
  
  const truncatedConversations = conversationsPart.substring(0, newConversationsLength);
  console.log(`[Token Truncation] Truncated conversations from ${conversationsPart.length} to ${truncatedConversations.length} characters`);
  
  return instructionPart + truncatedConversations + "\n(Note: Some conversations were truncated due to length constraints)";
}

// 타입 정의 추가
interface User {
  user_id: string;
  message_count: number;
}

// 메시지 포맷팅 함수 - 컨텍스트 길이 줄이기
function formatMessages(messages: any[]) {
  // 너무 긴 메시지는 요약 (컨텍스트 길이 이슈 해결을 위해)
  return messages.map(msg => {
    const sessionTitle = msg.chat_sessions?.title;
    const sessionInfo = sessionTitle 
      ? `[Session: ${msg.chat_session_id}, Title: ${sessionTitle}]` 
      : `[Session: ${msg.chat_session_id}]`;
    
    // 너무 긴 메시지는 자르기
    let content = msg.content;
    if (content.length > 500) {
      content = content.substring(0, 497) + '...';
    }
      
    return `${sessionInfo}\n${content}`;
  }).join('\n\n');
}

// 대화 메시지 전처리 함수
function preprocessMessages(messages: any[]) {
  // 5단어 미만 메시지 필터링
  const filteredMessages = messages.filter(msg => {
    const wordCount = msg.content.split(/\s+/).length;
    return wordCount >= 5;
  });
  
  // 최대 50개 메시지로 제한 (컨텍스트 길이 이슈 해결을 위해 100->50)
  return filteredMessages.slice(0, 50);
}

// Groq 클라이언트 초기화
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

export async function POST(request: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  // 내부적으로 재귀 호출하여 모든 배치를 처리하는 함수
  async function processAllBatches(batchSize: number, offset: number = 0, previousResults: any = null): Promise<any> {
    try {
      console.log(`[Profile Generation] Starting batch with size=${batchSize}, offset=${offset}`);
      
      // 대상 사용자 조회 (메시지 10개 이상)
      const { data: users, error: usersError } = await supabase.rpc(
        'get_users_with_message_count',
        { min_message_count: 10 }
      );
      
      if (usersError) throw usersError;
      
      // 프로필이 이미 있는 사용자 제외 (증분 업데이트와 중복 방지)
      const { data: existingProfiles } = await supabase
        .from('user_profiles')
        .select('user_id');
      
      const existingProfileIds = new Set(existingProfiles?.map(p => p.user_id) || []);
      const usersWithoutProfiles = (users as User[]).filter(user => !existingProfileIds.has(user.user_id));
      
      // 전체 사용자 수와 처리할 배치 정보 계산
      const totalUsers = usersWithoutProfiles.length;
      const batchUsers = usersWithoutProfiles.slice(offset, offset + batchSize);
      
      console.log(`[Profile Generation] Found ${totalUsers} users without profiles total, processing ${batchUsers.length} users from offset ${offset}`);
      
      // 처리할 사용자가 없는 경우: 오프셋이 총 사용자 수를 초과했거나 더 이상 처리할 사용자가 없음
      if (batchUsers.length === 0 || offset >= totalUsers) {
        console.log(`[Profile Generation] No users to process at offset ${offset}. Total users: ${totalUsers}. Stopping batch processing.`);
        
        // 이전 결과가 있으면 그대로 반환, 없으면 빈 결과 생성
        if (previousResults) {
          // 다음 배치가 없음을 표시
          previousResults.pagination.has_more = false;
          previousResults.pagination.next_offset = null;
          return previousResults;
        } else {
          return {
            processed: 0,
            skipped: 0,
            failed: [],
            details: [],
            pagination: {
              total_users: totalUsers,
              batch_size: batchSize,
              current_offset: offset,
              processed_users: totalUsers, // 모든 사용자가 이미 처리됨
              next_offset: null,
              has_more: false
            }
          };
        }
      }
      
      // 결과 객체 초기화 또는 이전 결과에서 복사
      const results = previousResults || {
        processed: 0,
        skipped: 0,
        failed: [] as string[],
        details: [] as Array<{
          user_id: string;
          status: string;
          profile_id?: string;
          error?: string;
        }>,
        pagination: {
          total_users: totalUsers,
          batch_size: batchSize,
          current_offset: offset,
          processed_users: offset,
          next_offset: offset + batchSize < totalUsers ? offset + batchSize : null,
          has_more: offset + batchSize < totalUsers
        }
      };
      
      // 각 사용자에 대한 프로필 생성
      for (const user of batchUsers) {
        try {
          // 사용자 메시지 조회
          const { data: messages, error: messagesError } = await supabase
            .from('messages')
            .select('id, content, role, created_at, chat_session_id, chat_sessions(title)')
            .eq('user_id', user.user_id)
            .eq('role', 'user')
            .order('created_at', { ascending: false })
            .limit(100);
          
          if (messagesError) throw messagesError;
          
          // 메시지 전처리
          const processedMessages = preprocessMessages(messages);
          
          if (processedMessages.length < 10) {
            results.skipped++;
            results.pagination.processed_users = offset + results.processed + results.skipped;
            results.details.push({
              user_id: user.user_id,
              status: 'skipped',
              error: 'Not enough valid messages after filtering'
            });
            continue;
          }
          
          console.log(`[Profile Generation] Processing user ${user.user_id} with ${processedMessages.length} messages`);
          
          // 프로필 생성
          const profileData = await generateUserProfile(user.user_id, processedMessages);
          
          // 프로필 저장
          const { data: profile, error: profileError } = await supabase
            .from('user_profiles')
            .upsert({
              user_id: user.user_id,
              profile_data: profileData.profileData,
              profile_summary: profileData.profileSummary,
              last_analyzed_message_id: processedMessages[0].id,
              analyzed_message_count: processedMessages.length,
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'user_id'
            })
            .select();
          
          if (profileError) throw profileError;
          
          results.processed++;
          results.pagination.processed_users = offset + results.processed + results.skipped;
          
          // 로그에 현재 진행 상황 출력 - 디버깅용
          console.log(`[Profile Generation] Progress: ${results.pagination.processed_users}/${totalUsers} users`);
          
          results.details.push({
            user_id: user.user_id,
            status: 'success',
            profile_id: profile[0].id
          });
          
          console.log(`[Profile Generation] Successfully processed user ${user.user_id}`);
        } catch (error) {
          results.failed.push(user.user_id);
          results.pagination.processed_users = offset + results.processed + results.skipped;
          results.details.push({
            user_id: user.user_id,
            status: 'failed',
            error: (error as Error).message
          });
          console.error(`[Profile Generation] Failed for user ${user.user_id}:`, error);
        }
      }
      
      // 더 처리할 사용자가 있는 경우 재귀적으로 다음 배치 처리
      if (results.pagination.has_more) {
        // 다음 배치의 오프셋 계산 (명시적으로 오프셋을 업데이트)
        const nextOffset = offset + batchSize;
        
        // 안전장치 1: 오프셋이 증가하지 않는 경우 중단
        if (nextOffset <= offset) {
          console.error(`[Profile Generation] Invalid next offset detected: ${nextOffset} <= ${offset}. Stopping recursion to prevent infinite loop.`);
          results.pagination.has_more = false;
          results.pagination.next_offset = null;
          return results;
        }
        
        // 안전장치 2: 현재 배치에서 처리된 사용자가 없는 경우 중단
        if (batchUsers.length > 0 && results.processed === 0 && results.skipped === 0) {
          console.warn(`[Profile Generation] No users were processed or skipped in this batch. Stopping recursion to prevent infinite loop.`);
          results.pagination.has_more = false;
          results.pagination.next_offset = null;
          return results;
        }
        
        // 안전장치 3: 오프셋이 총 사용자 수에 도달하거나 초과한 경우 중단
        if (nextOffset >= totalUsers) {
          console.log(`[Profile Generation] Next offset ${nextOffset} would exceed total users ${totalUsers}. Stopping batch processing.`);
          results.pagination.has_more = false;
          results.pagination.next_offset = null;
          return results;
        }
        
        console.log(`[Profile Generation] Processing next batch from offset ${nextOffset} (current: ${offset}, batch size: ${batchSize})`);
        
        // 다음 배치 재귀 호출 - 결과 병합을 위해 현재 결과 전달
        // 명시적으로 계산된 nextOffset 값을 사용
        return processAllBatches(batchSize, nextOffset, results);
      }
      
      // 모든 배치 처리 완료
      return results;
    } catch (error) {
      console.error(`[Profile Generation] Error in batch processing:`, error);
      throw error;
    }
  }
  
  try {
    // 요청 바디에서 배치 크기 및 오프셋 파라미터 추출
    const body = await request.json().catch(() => ({}));
    const batchSize = body.batch_size || 5; // 기본값 5명
    const offset = body.offset || 0; // 기본값 0
    const autoBatch = body.auto_batch || false; // 자동 배치 처리 여부
    
    // 자동 배치 처리가 활성화된 경우 모든 배치 처리
    if (autoBatch) {
      console.log(`[Profile Generation] Auto-batch enabled, processing all batches from offset ${offset}`);
      const results = await processAllBatches(batchSize, offset);
      return NextResponse.json(results);
    }
    
    // 자동 배치 처리가 비활성화된 경우 단일 배치만 처리
    const results = await processAllBatches(batchSize, offset);
    
    // 자동 배치 처리가 비활성화된 경우 다음 배치 정보만 반환 (실제 처리는 하지 않음)
    if (!autoBatch && results.pagination.has_more) {
      results.pagination.next_offset = offset + batchSize;
    }
    
    return NextResponse.json(results);
  } catch (error) {
    console.error('Error generating profiles:', error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

// 프로필 생성 함수
async function generateUserProfile(userId: string, messages: any[]) {
  try {
    // 1단계: 성향/관심사 추출
    const extractionPrompt = `
      Analyze the following user conversation summaries. Each conversation includes a session ID and title.
      Based on these conversations, identify and list the user's top 3 interests, personality traits, and conversation patterns in JSON format.
      Also suggest 5-7 specific search queries or conversation starters (including questions) that would likely interest this user.
      Additionally, provide a list of 5-10 representative keywords that characterize this user's interests and personality.
      Also identify the primary language used by the user in these conversations.
      
      IMPORTANT: Generate all content (topics, traits, patterns, keywords, suggested_prompts) in the user's primary language that you detect from their conversations.
      
      YOUR RESPONSE MUST BE VALID JSON WITH THE FOLLOWING STRUCTURE:
      {
        "topics": ["topic1", "topic2", "topic3"],
        "traits": ["trait1", "trait2", "trait3"],
        "patterns": ["pattern1", "pattern2"],
        "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
        "language": "the primary language used (e.g., English, Korean, etc.)",
        "suggested_prompts": ["prompt1", "prompt2", "prompt3", "prompt4", "prompt5"]
      }
      
      User conversations:
      ${formatMessages(messages)}
    `;
    
    // 토큰 제한 적용 (qwen-qwq-32b 모델용)
    const truncatedExtractionPrompt = truncateToFitContextWindow("qwen-qwq-32b", extractionPrompt, 4096);
    
    console.log(`[Profile Generation] Starting extraction for user ${userId} with ${messages.length} messages`);
    
    // 최대 3회 재시도 로직 추가
    let profileData;
    let attempt = 0;
    const maxAttempts = 3;
    
    while (attempt < maxAttempts) {
      try {
        attempt++;
        console.log(`[Profile Generation] Attempt ${attempt}/${maxAttempts} for user ${userId}`);
        
        // Groq API 직접 호출
        const response = await groq.chat.completions.create({
          messages: [{ role: 'user', content: truncatedExtractionPrompt }],
          "model": "qwen-qwq-32b",
          "temperature": 0.6,
          "max_completion_tokens": 4096,
          "top_p": 0.95,
          "stream": false,
          "response_format": {
            "type": "json_object"
          },
          "stop": null
        });
      

        // Groq API는 문자열로 JSON을 반환하므로 파싱 필요
        const responseContent = response.choices[0].message.content || "";
        console.log(`[Profile Generation] Raw model response for user ${userId}:`, responseContent);
        
        // 간단한 방식으로 처리 - try/catch로 감싸서 실패하면 기본값 사용
        let parsedResponse;
        try {
          parsedResponse = JSON.parse(responseContent);
        } catch (parseError) {
          console.error(`[Profile Generation] JSON parse error:`, parseError);
          if (attempt < maxAttempts) continue;
          parsedResponse = {};
        }
        
        // 기본값 설정
        const defaultTopics = ['General Interest'];
        const defaultTraits = ['Inquisitive'];
        const defaultPatterns = ['Conversational'];
        const defaultKeywords = ['communication'];
        const defaultPrompts = ['What topics interest you?'];
        const defaultLanguage = 'English';
        
        // 프로필 데이터 설정
        profileData = {
          topics: Array.isArray(parsedResponse?.topics) ? parsedResponse.topics : defaultTopics,
          traits: Array.isArray(parsedResponse?.traits) ? parsedResponse.traits : defaultTraits,
          patterns: Array.isArray(parsedResponse?.patterns) ? parsedResponse.patterns : defaultPatterns,
          keywords: Array.isArray(parsedResponse?.keywords) ? parsedResponse.keywords : defaultKeywords,
          language: parsedResponse?.language || defaultLanguage,
          suggested_prompts: Array.isArray(parsedResponse?.suggested_prompts) ? parsedResponse.suggested_prompts : defaultPrompts
        };
        
        // 유효한 응답을 받았으면 반복 중단
        break;
      } catch (err) {
        console.error(`[Profile Generation] Error on attempt ${attempt}:`, err);
        if (attempt >= maxAttempts) throw err;
        // 잠시 대기 후 재시도
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    if (!profileData) {
      // 모든 시도가 실패한 경우 기본값 설정
      console.warn(`[Profile Generation] All attempts failed, using default profile data for user ${userId}`);
      profileData = {
        topics: ['General Interest'],
        traits: ['Inquisitive'],
        patterns: ['Conversational'],
        keywords: ['communication'],
        language: 'English',
        suggested_prompts: ['What topics interest you?']
      };
    }

    console.log(`[Profile Generation] Successfully extracted profile for user ${userId}`);
    console.log(`[Profile Generation] Structured profile data:`, JSON.stringify(profileData));
    
    // 요약 생성 로직
    console.log(`[Profile Summary] Starting summary generation for user ${userId}`);
    const summaryPrompt = `Create a SHORT, IMPACTFUL profile summary for this user (max 3-4 sentences).

User interests: ${profileData.topics ? profileData.topics.join(', ') : 'various topics'}
Personality: ${profileData.traits ? profileData.traits.join(', ') : 'unique and diverse'}
Communication style: ${profileData.patterns ? profileData.patterns.join(', ') : 'interesting patterns'}

Focus ONLY on the most distinctive aspects. Be concise and engaging.
This summary will be shown directly to the user on their profile.
DO NOT overthink this - just capture the essence of the user in a simple, clear way.

IMPORTANT: Write this summary in English, regardless of the user's primary language: ${profileData.language}
DO NOT include any tags, prefixes, or explanations. Only the summary itself.`;
    
    // Summary prompt is typically short, but apply token limit for consistency
    const truncatedSummaryPrompt = truncateToFitContextWindow("llama-3.3-70b-versatile", summaryPrompt, 2048);
    
    let profileSummary = "";
    try {
      // Groq API 직접 호출 - 요약도 llama-3.3-70b-versatile 모델 사용
      const summaryResponse = await groq.chat.completions.create({
        messages: [{ role: 'user', content: truncatedSummaryPrompt }],
        model: 'llama-3.3-70b-versatile',
        temperature: 0.7,
        max_tokens: 4096,
        stream: false
      });
      
      const summaryText = summaryResponse.choices[0].message.content || "";
      console.log(`[Profile Summary] Generated summary length: ${summaryText.length}`);
      
      // 요약이 비어있는 경우 빈 문자열 그대로 유지
      if (!summaryText || summaryText.trim() === '') {
        console.log(`[Profile Summary] Empty summary generated, keeping it empty`);
        profileSummary = "";
      } else {
        // <think> 태그 제거 로직 주석 처리 (llama 3 70B는 thinking 모델이 아님)
        // let cleanedSummary = summaryText.trim();
        // cleanedSummary = cleanedSummary.replace(/<think>[\s\S]*?<\/think>/g, '');
        
        // 앞뒤 공백 제거 후 저장
        profileSummary = summaryText.trim();
      }
    } catch (err) {
      console.error(`[Profile Summary] Error generating summary:`, err);
      // 에러 발생 시에도 빈 문자열 반환
      profileSummary = "";
    }
    
    console.log(`[Profile] Successfully generated profile for user ${userId}`);
    
    return {
      profileData,
      profileSummary
    };
  } catch (error) {
    console.error(`[Profile Generation ERROR] User ${userId}:`, error);
    throw error;
  }
} 