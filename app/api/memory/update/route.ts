import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { updateMemoryBank } from '@/utils/memory-bank';

export async function POST(req: NextRequest) {
  try {
    const { category, content } = await req.json();
    
    // 사용자 인증
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // 메모리 뱅크 업데이트
    const { data, error } = await updateMemoryBank(supabase, user.id, category, content);
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error updating memory:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 