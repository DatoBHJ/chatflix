import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { getWorkspaceFileContent } from '@/app/api/chat/lib/sandboxService';

/**
 * GET /api/chat/workspace-file-content?chatId=...&path=...
 * Returns the current content of a workspace file from chat_workspace_files.
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const chatId = searchParams.get('chatId')?.trim() || '';
    const path = searchParams.get('path')?.trim() || '';

    if (!chatId || !path) {
      return NextResponse.json({ error: 'chatId and path are required' }, { status: 400 });
    }

    // Verify chat ownership
    const { data: existingMessages } = await supabase
      .from('messages')
      .select('id')
      .eq('chat_session_id', chatId)
      .eq('user_id', user.id)
      .limit(1);

    if (!existingMessages?.length) {
      return NextResponse.json({ error: 'Chat not found or access denied' }, { status: 403 });
    }

    const content = await getWorkspaceFileContent(chatId, path, supabase);

    if (content === null) {
      return NextResponse.json({ content: null }, { status: 404 });
    }

    return NextResponse.json({ content });
  } catch (err) {
    console.error('[workspace-file-content] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
