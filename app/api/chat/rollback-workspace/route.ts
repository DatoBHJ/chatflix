import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { rollbackWorkspaceToSequence } from '@/app/api/chat/lib/workspaceRollback';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: { chatId?: string; upToSequenceNumber?: number };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const chatId = typeof body.chatId === 'string' ? body.chatId.trim() : '';
    const upToSequenceNumber =
      typeof body.upToSequenceNumber === 'number' && Number.isInteger(body.upToSequenceNumber)
        ? body.upToSequenceNumber
        : undefined;

    if (!chatId || upToSequenceNumber === undefined || upToSequenceNumber < 0) {
      return NextResponse.json(
        { error: 'chatId and upToSequenceNumber (non-negative integer) are required' },
        { status: 400 }
      );
    }

    const { data: existingMessages } = await supabase
      .from('messages')
      .select('id')
      .eq('chat_session_id', chatId)
      .eq('user_id', user.id)
      .limit(1);

    if (!existingMessages?.length) {
      return NextResponse.json(
        { error: 'Chat not found or access denied' },
        { status: 403 }
      );
    }

    const result = await rollbackWorkspaceToSequence(
      chatId,
      user.id,
      upToSequenceNumber,
      supabase
    );

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[rollback-workspace]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
