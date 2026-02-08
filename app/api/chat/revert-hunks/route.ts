import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateSandbox, saveWorkspaceFile } from '@/app/api/chat/lib/sandboxService';

/**
 * POST /api/chat/revert-hunks
 * Writes rebuilt file content (after accept/reject hunk decisions) back to the sandbox and DB.
 *
 * Body: { chatId: string, path: string, content: string }
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: { chatId?: string; path?: string; content?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const chatId = typeof body.chatId === 'string' ? body.chatId.trim() : '';
    const path = typeof body.path === 'string' ? body.path.trim() : '';
    const content = typeof body.content === 'string' ? body.content : undefined;

    if (!chatId || !path || content === undefined) {
      return NextResponse.json(
        { error: 'chatId, path, and content are required' },
        { status: 400 },
      );
    }

    // Verify chat ownership
    const { data: existingMessages } = await supabase
      .from('messages')
      .select('id')
      .eq('chat_session_id', chatId)
      .eq('user_id', user.id)
      .limit(1);

    if (!existingMessages?.length) {
      return NextResponse.json(
        { error: 'Chat not found or access denied' },
        { status: 403 },
      );
    }

    // Write rebuilt content to sandbox and DB
    const sandbox = await getOrCreateSandbox(chatId, supabase);
    await sandbox.files.write(path, content);
    await saveWorkspaceFile(chatId, path, content, supabase);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[revert-hunks] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
