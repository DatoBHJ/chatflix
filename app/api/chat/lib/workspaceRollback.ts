/**
 * Workspace rollback: restore chat_workspace_files and sandbox state to the
 * state implied by messages up to a given sequence number (for regenerate / edit-send).
 */

import type { SupabaseClient } from '@/app/api/chat/lib/sandboxService';
import { invalidateSandboxCache } from '@/app/api/chat/lib/sandboxService';

const FILE_EDIT_PART_TYPES = ['tool-write_file', 'tool-apply_edits', 'tool-delete_file'] as const;

type FileEditPartType = (typeof FILE_EDIT_PART_TYPES)[number];

interface PartInput {
  path?: string;
  content?: string;
  edits?: Array< { startLine: number; endLine: number; newContent: string }>;
}

function parsePartInput(part: { input?: unknown; args?: unknown }): PartInput | null {
  const raw = part.input ?? part.args;
  if (raw == null) return null;
  if (typeof raw === 'object' && !Array.isArray(raw) && raw !== null) {
    return raw as PartInput;
  }
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as PartInput;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Apply edits to content string (same logic as createApplyEditsTool).
 * 1-based inclusive startLine/endLine; edits applied in endLine-descending order.
 */
function applyEditsToContent(content: string, edits: Array<{ startLine: number; endLine: number; newContent: string }>): string {
  const lines = content.split('\n');
  const sortedEdits = [...edits].sort((a, b) => b.endLine - a.endLine);
  for (const edit of sortedEdits) {
    const start = Math.max(0, edit.startLine - 1);
    const count = Math.min(lines.length - start, edit.endLine - edit.startLine + 1);
    const newLines = edit.newContent ? edit.newContent.split('\n') : [];
    lines.splice(start, count, ...newLines);
  }
  return lines.join('\n');
}

/**
 * Replay file-edit tool calls from message parts into a path -> content map.
 * Only processes assistant message parts with type tool-write_file, tool-apply_edits, tool-delete_file.
 */
function replayFileEditsFromParts(
  messages: Array<{ sequence_number: number; role: string; parts: unknown }>
): Map<string, string> {
  const map = new Map<string, string>();

  for (const msg of messages) {
    if (msg.role !== 'assistant' || !Array.isArray(msg.parts)) continue;

    for (const part of msg.parts as Array<{ type?: string; input?: unknown; args?: unknown }>) {
      const type = part?.type;
      if (!type || !FILE_EDIT_PART_TYPES.includes(type as FileEditPartType)) continue;

      const input = parsePartInput(part);
      if (!input || typeof input.path !== 'string') continue;

      const path = input.path;

      if (type === 'tool-write_file') {
        const content = typeof input.content === 'string' ? input.content : '';
        map.set(path, content);
        continue;
      }

      if (type === 'tool-apply_edits') {
        const edits = Array.isArray(input.edits) ? input.edits : [];
        const current = map.get(path) ?? '';
        const newContent = applyEditsToContent(current, edits);
        map.set(path, newContent);
        continue;
      }

      if (type === 'tool-delete_file') {
        map.delete(path);
      }
    }
  }

  return map;
}

/**
 * Roll back workspace state for a chat to the state implied by all messages
 * with sequence_number <= upToSequenceNumber. Caller must verify the user owns the chat.
 */
export async function rollbackWorkspaceToSequence(
  chatId: string,
  userId: string,
  upToSequenceNumber: number,
  supabase: SupabaseClient
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: messages, error: fetchError } = await supabase
    .from('messages')
    .select('sequence_number, role, parts')
    .eq('chat_session_id', chatId)
    .eq('user_id', userId)
    .lte('sequence_number', upToSequenceNumber)
    .order('sequence_number', { ascending: true });

  if (fetchError) {
    console.error('[workspaceRollback] Failed to fetch messages:', fetchError);
    return { ok: false, error: fetchError.message };
  }

  if (!Array.isArray(messages)) {
    return { ok: false, error: 'Invalid messages response' };
  }

  const fileMap = replayFileEditsFromParts(messages);

  const { error: deleteFilesError } = await supabase
    .from('chat_workspace_files')
    .delete()
    .eq('chat_id', chatId);

  if (deleteFilesError) {
    console.error('[workspaceRollback] Failed to delete workspace files:', deleteFilesError);
    return { ok: false, error: deleteFilesError.message };
  }

  if (fileMap.size > 0) {
    const rows = Array.from(fileMap.entries()).map(([path, content]) => ({
      chat_id: chatId,
      path,
      content,
      updated_at: new Date().toISOString(),
    }));

    const { error: insertError } = await supabase
      .from('chat_workspace_files')
      .insert(rows);

    if (insertError) {
      console.error('[workspaceRollback] Failed to insert workspace files:', insertError);
      return { ok: false, error: insertError.message };
    }
  }

  const { error: deleteSandboxError } = await supabase
    .from('chat_sandboxes')
    .delete()
    .eq('chat_id', chatId);

  if (deleteSandboxError) {
    console.error('[workspaceRollback] Failed to delete chat_sandboxes row:', deleteSandboxError);
    return { ok: false, error: deleteSandboxError.message };
  }

  invalidateSandboxCache(chatId);
  return { ok: true };
}
