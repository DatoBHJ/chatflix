import { createClient as createServiceClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    console.log('🔧 [TEST-REFINE] Starting test memory refine');
    
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('user_id');
    
    if (!userId) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
    }

    const serviceSupabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 사용자 메모리 가져오기
    const { data: memoryEntries } = await serviceSupabase
      .from('memory_bank')
      .select('category, content')
      .eq('user_id', userId)
      .order('category');

    if (!memoryEntries || memoryEntries.length === 0) {
      return NextResponse.json({ error: 'No memory entries found' }, { status: 404 });
    }

    // 간단한 테스트: 메모리 내용을 그대로 반환
    return NextResponse.json({
      message: 'Test memory refine successful',
      user_id: userId,
      memory_count: memoryEntries.length,
      categories: memoryEntries.map(entry => entry.category)
    });

  } catch (error) {
    console.error('❌ [TEST-REFINE] Error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
