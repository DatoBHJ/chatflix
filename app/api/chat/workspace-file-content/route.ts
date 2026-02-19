import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import {
  addWorkspacePath,
  getOrCreateSandbox,
  getWorkspaceFileContent,
  getWorkspaceFileDownloadUrl,
  isBinaryStorageRef,
  isTextFile,
  saveWorkspaceBinaryFile,
  saveWorkspaceFile,
  WORKSPACE_BASE,
} from '@/app/api/chat/lib/sandboxService';

async function trySyncMissingWorkspaceFileFromSandbox(
  chatId: string,
  path: string,
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<boolean> {
  // Only ever attempt to read within the known sandbox workspace.
  // This avoids turning this endpoint into an arbitrary filesystem reader.
  if (!path.startsWith(`${WORKSPACE_BASE}/`)) return false;

  try {
    const sandbox = await getOrCreateSandbox(chatId, supabase);
    if (isTextFile(path)) {
      const text = await sandbox.files.read(path);
      if (typeof text !== 'string' || text.length === 0) return false;
      await addWorkspacePath(chatId, path, supabase);
      await saveWorkspaceFile(chatId, path, text, supabase);
      return true;
    }

    const bytes = await sandbox.files.read(path, { format: 'bytes' }) as unknown as Uint8Array;
    if (!bytes || bytes.byteLength === 0) return false;
    await addWorkspacePath(chatId, path, supabase);
    await saveWorkspaceBinaryFile(chatId, path, bytes, supabase);
    return true;
  } catch {
    return false;
  }
}

async function tryMaterializeMissingWorkspaceFileFromMessages(
  chatId: string,
  path: string,
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<boolean> {
  const tag = `[FILE:${path}]`;
  try {
    // Fetch recent assistant messages and search client-side to avoid SQL LIKE escaping issues
    // (paths can contain '_' which is a wildcard in LIKE).
    const { data: msgs } = await supabase
      .from('messages')
      .select('content, sequence_number')
      .eq('chat_session_id', chatId)
      .eq('role', 'assistant')
      .order('sequence_number', { ascending: false })
      .limit(50);

    const msg = Array.isArray(msgs)
      ? msgs.find((m) => typeof m?.content === 'string' && (m.content as string).includes(tag))
      : undefined;

    const raw = typeof msg?.content === 'string' ? msg.content : '';
    if (!raw) return false;

    // Best-effort fallback: if the assistant referenced a file but never created it,
    // store the assistant message (minus the tag) as the file content so the UI
    // doesn't dead-end with a 404.
    const content = `<!-- Auto-generated: file was referenced but missing. -->\n\n${raw.replace(tag, '').trim()}\n`;
    if (content.trim().length === 0) return false;

    await addWorkspacePath(chatId, path, supabase);
    await saveWorkspaceFile(chatId, path, content, supabase);
    return true;
  } catch {
    return false;
  }
}

/**
 * GET /api/chat/workspace-file-content?chatId=...&path=...
 * Returns the current content of a workspace file from chat_workspace_files.
 *
 * For text files: { content: "..." }
 * For binary files (storage:// ref): { content: null, isBinary: true, downloadUrl: "...", filename: "..." }
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

    // Verify chat ownership.
    //
    // IMPORTANT: Don't rely on `messages` existence here.
    // During streaming, the assistant message may not be persisted yet, but the user still
    // needs to preview workspace files immediately (file tool preview / file path card).
    // `chat_sessions` is the canonical source of ownership and exists before messages do.
    const { data: chatSession, error: chatError } = await supabase
      .from('chat_sessions')
      .select('id, user_id')
      .eq('id', chatId)
      .eq('user_id', user.id)
      .single();

    if (chatError || !chatSession) {
      // Backward-compatible fallback: allow access if there is at least one message owned
      // by the user. This covers any edge cases where chat_sessions may be absent.
      const { data: existingMessages } = await supabase
        .from('messages')
        .select('id')
        .eq('chat_session_id', chatId)
        .eq('user_id', user.id)
        .limit(1);

      if (!existingMessages?.length) {
        return NextResponse.json({ error: 'Chat not found or access denied' }, { status: 403 });
      }
    }

    const content = await getWorkspaceFileContent(chatId, path, supabase);

    if (content === null) {
      // Recovery path:
      // 1) If the file exists in the live sandbox but wasn't persisted, sync it now.
      // 2) If it was referenced by the assistant but never created, materialize it from the
      //    most recent assistant message that contains the tag.
      const synced =
        (await trySyncMissingWorkspaceFileFromSandbox(chatId, path, supabase)) ||
        (await tryMaterializeMissingWorkspaceFileFromMessages(chatId, path, supabase));

      if (!synced) {
        return NextResponse.json({ error: 'File not found in chat workspace' }, { status: 404 });
      }

      const recovered = await getWorkspaceFileContent(chatId, path, supabase);
      if (recovered === null) {
        return NextResponse.json({ error: 'File not found in chat workspace' }, { status: 404 });
      }

      // Continue below with the recovered content.
      if (isBinaryStorageRef(recovered)) {
        const downloadUrl = await getWorkspaceFileDownloadUrl(chatId, path, supabase);
        const filename = path.replace(/^.*[/\\]/, '') || 'download';
        if (!downloadUrl) {
          return NextResponse.json({ error: 'Binary file download URL could not be generated' }, { status: 500 });
        }
        return NextResponse.json({ content: null, isBinary: true, downloadUrl, filename });
      }

      return NextResponse.json({ content: recovered });
    }

    // Binary file stored in Supabase Storage – return signed download URL
    if (isBinaryStorageRef(content)) {
      const downloadUrl = await getWorkspaceFileDownloadUrl(chatId, path, supabase);
      const filename = path.replace(/^.*[/\\]/, '') || 'download';
      if (!downloadUrl) {
        return NextResponse.json({ error: 'Binary file download URL could not be generated' }, { status: 500 });
      }
      return NextResponse.json({ content: null, isBinary: true, downloadUrl, filename });
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
