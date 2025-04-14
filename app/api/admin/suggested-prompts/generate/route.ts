import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(request: Request) {
  try {
    const { limit = 10, offset = 0, auto_batch = false } = await request.json();
    
    if (auto_batch) {
      return await processAllBatches(limit, offset);
    }
    
    return await processBatch(limit, offset);
    
  } catch (error) {
    console.error('Error generating suggested prompts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// 단일 배치 처리 함수
async function processBatch(batchSize: number, offset: number = 0) {
  try {
    // 1. 최신 활성 채팅 세션에서 사용자 ID 가져오기
    const { data: sessions, error: sessionsError } = await supabase
      .from('chat_sessions')
      .select('user_id')
      .order('created_at', { ascending: false });
    
    if (sessionsError) {
      console.error('Error fetching chat sessions:', sessionsError);
      return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
    }
    
    if (!sessions || sessions.length === 0) {
      return NextResponse.json({ error: 'No chat sessions found' }, { status: 404 });
    }
    
    // 고유 사용자 ID 추출 (중복 제거)
    const uniqueUserIds = [...new Set(sessions.map(session => session.user_id))];
    console.log(`Found ${uniqueUserIds.length} unique users with recent chat sessions`);
    
    // 전체 사용자 수 (페이지네이션 정보용)
    const totalUsers = uniqueUserIds.length;
    
    // 처리할 사용자 ID (현재 배치)
    const userIdsToProcess = uniqueUserIds.slice(offset, offset + batchSize);
    
    // 2. 결과 저장 변수 초기화
    const results = {
      processed: 0,
      skipped: 0,
      failed: 0,
      userResults: [] as Array<{
        user_id: string;
        status: string;
        prompts?: string[];
        language?: string;
        error?: string;
      }>,
      pagination: {
        total_users: totalUsers,
        processed_users: offset,
        current_offset: offset,
        next_offset: offset + batchSize < totalUsers ? offset + batchSize : null,
        has_more: offset + batchSize < totalUsers,
        batch_size: batchSize
      }
    };
    
    // 3. 각 사용자에 대해 프롬프트 생성
    for (const userId of userIdsToProcess) {
      try {
        console.log(`Processing user: ${userId}`);
        
        // 사용자별 메시지 가져오기
        const { data: messages, error: messagesError } = await supabase
          .from('messages')
          .select('content')
          .eq('user_id', userId)
          .eq('role', 'user')
          .not('content', 'eq', '')
          .order('created_at', { ascending: false })
          .limit(10);
        
        if (messagesError || !messages || messages.length < 3) {
          const reason = messagesError ? 'Error fetching messages' : 
                        (!messages || messages.length === 0) ? 'No messages' : 'Too few messages';
          results.skipped++;
          results.userResults.push({
            user_id: userId,
            status: 'skipped',
            error: reason
          });
          continue;
        }
        
        // 메시지 콘텐츠 배열
        const messageContents = messages.map(msg => msg.content);
        
        // 프롬프트 생성
        const promptResult = await generatePromptsForUser(userId, messageContents);
        
        if (promptResult.success) {
          results.processed++;
          results.userResults.push({
            user_id: userId,
            status: 'success',
            prompts: promptResult.prompts,
            language: promptResult.language
          });
        } else {
          results.failed++;
          results.userResults.push({
            user_id: userId,
            status: 'failed',
            error: promptResult.error
          });
        }
      } catch (error) {
        console.error(`Error processing user ${userId}:`, error);
        results.failed++;
        results.userResults.push({
          user_id: userId,
          status: 'failed',
          error: 'Unexpected error'
        });
      }
    }
    
    // 페이지네이션 정보 업데이트
    results.pagination.processed_users = offset + results.processed + results.skipped;
    
    return NextResponse.json({
      success: true,
      results
    });
  } catch (error) {
    console.error('Error in batch processing:', error);
    return NextResponse.json({ error: 'Batch processing failed' }, { status: 500 });
  }
}

// 모든 배치 자동 처리 함수
async function processAllBatches(batchSize: number, offset: number = 0, previousResults: any = null): Promise<NextResponse> {
  try {
    console.log(`[Suggested Prompts] Starting batch with size=${batchSize}, offset=${offset}`);
    
    const batchResponse = await processBatch(batchSize, offset);
    const batchData = await batchResponse.json();
    
    if (!batchData.success) {
      console.error("[Suggested Prompts] Batch processing failed:", batchData.error);
      return NextResponse.json({ 
        error: batchData.error || "Batch processing failed", 
        partial_results: previousResults 
      }, { status: 500 });
    }
    
    // 현재 배치 결과
    const currentResults = batchData.results;
    
    // 누적 결과 계산
    const aggregatedResults = previousResults ? {
      processed: previousResults.processed + currentResults.processed,
      skipped: previousResults.skipped + currentResults.skipped,
      failed: previousResults.failed + currentResults.failed,
      userResults: [...previousResults.userResults, ...currentResults.userResults],
      pagination: currentResults.pagination
    } : currentResults;
    
    // 더 처리할 배치가 없으면 최종 결과 반환
    if (!currentResults.pagination.has_more) {
      console.log(`[Suggested Prompts] All batches complete. Total processed: ${aggregatedResults.processed}`);
      return NextResponse.json({ success: true, results: aggregatedResults });
    }
    
    // 다음 오프셋 계산
    const nextOffset = currentResults.pagination.next_offset;
    
    // 재귀적으로 다음 배치 처리
    console.log(`[Suggested Prompts] Processing next batch from offset ${nextOffset}`);
    return processAllBatches(batchSize, nextOffset, aggregatedResults);
    
  } catch (error) {
    console.error('[Suggested Prompts] Error in batch processing:', error);
    return NextResponse.json({ 
      error: 'Auto batch processing failed', 
      partial_results: previousResults 
    }, { status: 500 });
  }
}

// 사용자별 프롬프트 생성 함수
async function generatePromptsForUser(userId: string, messageContents: string[]) {
  try {
    // 1. 기존 프롬프트 확인 (중복 방지)
    const { data: existingPrompts, error: queryError } = await supabase
      .from('suggested_prompts')
      .select('source_messages')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (!queryError && existingPrompts && existingPrompts.length > 0 && existingPrompts[0].source_messages) {
      // 메시지 중복 확인
      const previousMessages = existingPrompts[0].source_messages as string[];
      const hasDuplicate = messageContents.some(currentMsg => 
        previousMessages.some(prevMsg => prevMsg === currentMsg)
      );
      
      if (hasDuplicate) {
        return { success: false, error: 'Similar messages found' };
      }
    }
    
    // 2. 프롬프트 생성
    const extractionPrompt = `
      Analyze the following user messages to identify specific topics, interests, and knowledge areas.
      Generate 5 high-quality initial prompts tailored to this user's interests and conversation patterns.
      
      IMPORTANT REQUIREMENTS:
      1. Make each prompt SPECIFIC with clear context and subject matter (avoid vague requests)
      2. Include concrete topics, concepts, or scenarios from user's interest areas
      3. Generate the prompts in the PRIMARY LANGUAGE detected from the user's messages
      4. Ensure each prompt can stand alone without additional context
      5. Mix of questions and statements is fine, but each must be substantive
      
      LANGUAGE DETECTION AND RESPONSE REQUIREMENTS:
      - You MUST respond in the same language that the user primarily uses in their messages
      - For the "language" field in your response, ONLY use the standard ISO 639-1 two-letter code:
        * Korean = "ko"
        * English = "en"
        * Japanese = "ja"
        * Chinese = "zh"
        * Spanish = "es"
        * French = "fr"
        * German = "de"
        * etc.
      - DO NOT use full language names like "Korean", "English", or native names like "한국어"
      - If you cannot determine the language with certainty, default to "en"
      
      GOOD EXAMPLES (generate in the user's detected language):
      - "Can you explain the differentiation formulas for inverse trigonometric functions?"
      - "I want to know about the limitations of AI-based recommendation systems."
      - "Tell me how to effectively present leadership experiences in interviews."
      - "Explain the influence of ancient Roman architecture on modern buildings."
      - "Could you explain the basic principles of quantum computing and its current development status?"
      
      BAD EXAMPLES TO AVOID:
      - "Can you solve this problem?" (too vague)
      - "Can you give me a hint for problem 8?" (no specific context)
      - "What do you think about this?" (lacks specificity)
      - "Can you help me?" (unclear content)
      - "Can you explain this?" (no topic specified)
      
      YOUR RESPONSE MUST BE VALID JSON WITH THE FOLLOWING STRUCTURE:
      {
        "prompts": [
          "Specific prompt with clear topic 1 in user's language",
          "Clear prompt with context 2 in user's language",
          "Interest-based specific prompt 3 in user's language", 
          "Standalone prompt 4 in user's language",
          "Topic-specific prompt 5 in user's language"
        ],
        "language": "xx" // where xx is the ISO 639-1 two-letter language code (e.g., ko, en, ja, zh)
      }
      
      User messages:
      ${messageContents.join('\n\n')}
    `;
    
    // 3. OpenAI 호출
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: extractionPrompt }],
      temperature: 0.7,
      max_tokens: 1024,
      response_format: { type: 'json_object' }
    });
    
    const responseContent = completion.choices[0].message.content || '{"prompts":[], "language": "Unknown"}';
    const parsedResponse = JSON.parse(responseContent);
    
    const prompts = parsedResponse?.prompts || [];
    const language = parsedResponse?.language || "Unknown";
    
    if (prompts.length === 0) {
      return { success: false, error: 'Failed to generate prompts' };
    }
    
    // 4. DB에 저장
    const { error: insertError } = await supabase
      .from('suggested_prompts')
      .insert({
        user_id: userId,
        prompts: prompts,
        source_messages: messageContents,
        language: language,
        created_at: new Date().toISOString()
      });
    
    if (insertError) {
      console.error('Error saving prompts to database:', insertError);
      return { success: false, error: 'Failed to save prompts' };
    }
    
    return {
      success: true,
      prompts,
      language
    };
    
  } catch (error) {
    console.error('Error in prompt generation:', error);
    return { success: false, error: 'Prompt generation failed' };
  }
} 