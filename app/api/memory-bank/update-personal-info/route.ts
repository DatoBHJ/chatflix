import { createClient } from '@/utils/supabase/server';
import { updatePersonalInfo } from '@/app/api/chat/services/memoryService';

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { trigger } = await req.json();
    
    // 즉시 반영이 필요한 트리거들
    const allowedTriggers = [
      'name_change',      // 이름 변경
      'profile_image',    // 프로필 이미지 변경
      'language_change',  // 언어 설정 변경
      'urgent_update'     // 긴급 업데이트
    ];
    
    if (!allowedTriggers.includes(trigger)) {
      return new Response(JSON.stringify({ error: 'Invalid trigger' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 즉시 personal-info 메모리 업데이트
    console.log(`🚀 [INSTANT UPDATE] Starting ${trigger} update for user ${user.id}`);
    
    // 빈 메시지 배열을 전달 - 이름 변경은 대화 컨텍스트와 무관하므로
    const result = await updatePersonalInfo(supabase, user.id, []);
    
    console.log(`🚀 [INSTANT UPDATE] updatePersonalInfo result:`, result ? 'SUCCESS' : 'FAILED');
    
    if (result) {
      console.log(`✅ [INSTANT UPDATE] Personal info updated successfully for user ${user.id}`);
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Personal info updated successfully',
        updated_content: result 
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      console.error(`❌ [INSTANT UPDATE] Failed to update personal info for user ${user.id}`);
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'Failed to update personal info' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (error) {
    console.error('Error updating personal info:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
} 