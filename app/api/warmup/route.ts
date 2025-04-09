import { streamText } from 'ai';
import { providers } from '@/lib/providers';
import { getActivatedModels, DEFAULT_MODEL_ID, ModelConfig } from '@/lib/models/config';
import { createClient } from '@/utils/supabase/server';

// 웜업 대상 API 요청
const WARMUP_QUERY = "Hello";

// API 핸들러 함수
export async function GET(request: Request) {
  try {
    console.log('Warming up user-specific popular models...');
    
    // Supabase 클라이언트 생성 및 사용자 정보 가져오기
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    // 모델 목록 준비
    let modelsToWarmup: ModelConfig[] = [];
    
    // 인증된 유저가 있으면 해당 유저의 인기 모델 가져오기
    if (user?.id) {
      const userId = user.id;
      console.log(`Found authenticated user: ${userId}`);
      
      // 해당 유저의 최근 메시지에서 사용한 모델 조회
      const { data: userMessages, error: userMessagesError } = await supabase
        .from('messages')
        .select('model')
        .eq('role', 'assistant')
        .eq('user_id', userId)
        .not('model', 'is', null)
        .order('created_at', { ascending: false })
        .limit(15);
        
      if (userMessagesError) {
        console.error('Error fetching user messages:', userMessagesError);
      } else if (userMessages && userMessages.length > 0) {
        // 유저별 모델 사용 횟수 계산
        const counts: Record<string, number> = {};
        userMessages.forEach((item: { model: string }) => {
          if (item.model) {
            counts[item.model] = (counts[item.model] || 0) + 1;
          }
        });
        
        // 사용 횟수별로 정렬하여 상위 3개 선택
        const userPopularModels = Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([model]) => model);
          
        console.log(`User popular models: ${userPopularModels.join(', ')}`);
        
        // 활성화된 모델 중 인기 모델만 필터링
        const activatedModels = getActivatedModels();
        modelsToWarmup = activatedModels.filter(model => userPopularModels.includes(model.id));
      }
    }
    
    // 인증된 유저가 없거나 유저별 인기 모델이 없는 경우 전체 인기 모델 계산
    if (modelsToWarmup.length === 0) {
      console.log('No user-specific models found, calculating global popular models');
      
      // 전체 최근 메시지에서 가장 많이 사용된 모델 3개 가져오기
      const { data: recentMessages, error: messagesError } = await supabase
        .from('messages')
        .select('model')
        .eq('role', 'assistant')
        .not('model', 'is', null)
        .order('created_at', { ascending: false })
        .limit(30);
      
      if (messagesError) {
        console.error('Error fetching recent messages:', messagesError);
      } else if (recentMessages && recentMessages.length > 0) {
        // 모델별 사용 횟수 계산
        const counts: Record<string, number> = {};
        recentMessages.forEach((item: { model: string }) => {
          if (item.model) {
            counts[item.model] = (counts[item.model] || 0) + 1;
          }
        });
        
        // 사용 횟수별로 정렬하여 상위 3개 선택
        const popularModelIds = Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([model]) => model);
        
        console.log('Global popular models:', popularModelIds);
        
        // 활성화된 모델 중 인기 모델만 필터링
        const activatedModels = getActivatedModels();
        modelsToWarmup = activatedModels.filter(model => popularModelIds.includes(model.id));
      }
    }
    
    // 인기 모델이 없거나 활성화되지 않은 경우 기본 모델 추가
    if (modelsToWarmup.length === 0) {
      const defaultModel = getActivatedModels().find(model => model.id === DEFAULT_MODEL_ID);
      if (defaultModel) {
        modelsToWarmup = [defaultModel];
        console.log('No popular models found, warming up default model only');
      }
    }

    // grok-2-vision-latest 모델 추가 (이미 포함되어 있지 않은 경우에만)
    const grokModel = getActivatedModels().find(model => model.id === 'grok-2-vision-latest');
    if (grokModel && !modelsToWarmup.some(model => model.id === 'grok-2-vision-latest')) {
      modelsToWarmup.push(grokModel);
      console.log('Added grok-2-vision-latest model to warmup list');
    }
    
    // 각 모델 웜업 작업 생성
    const warmupPromises = modelsToWarmup.map(async (model) => {
      try {
        console.log(`Warming up model: ${model.id}`);
        
        // streamText 사용하여 간단한 웜업
        const { textStream } = streamText({
          model: providers.languageModel(model.id),
          system: "You are a helpful assistant.",
          prompt: WARMUP_QUERY,
          temperature: 0.1,
          maxTokens: 50,
        });
        
        // 첫 토큰만 얻어서 웜업 확인
        for await (const chunk of textStream) {
          // 첫 토큰을 받으면 중단 (웜업 목적만 달성하면 됨)
          break;
        }
        
        console.log(`Successfully warmed up model: ${model.id}`);
        return { modelId: model.id, success: true };
      } catch (error) {
        console.error(`Failed to warm up model: ${model.id}`, error);
        return { modelId: model.id, success: false, error };
      }
    });
    
    // 모든 웜업 작업 완료 대기
    const results = await Promise.allSettled(warmupPromises);
    
    // 성공 및 실패 모델 카운트
    const successCount = results.filter(
      result => result.status === 'fulfilled' && result.value.success
    ).length;
    
    const failedCount = modelsToWarmup.length - successCount;
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Warmup completed',
      summary: {
        total: modelsToWarmup.length,
        success: successCount,
        failed: failedCount,
        models: modelsToWarmup.map(m => m.id),
        isUserSpecific: user?.id ? true : false
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Warmup failed:', error);
    return new Response(JSON.stringify({ success: false, error: 'Warmup failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
} 