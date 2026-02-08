/**
 * E2B sandbox lifecycle and workspace path tracking per chat.
 * Used by file read/write tools and message context injection.
 */

import { Sandbox } from '@e2b/code-interpreter';

const SANDBOX_TTL_MS = 60 * 60 * 1000; // 1 hour
const WORKSPACE_BASE = '/home/user/workspace';

/** In-memory cache: chatId -> { sandbox, expiresAt } so we don't reconnect every request. */
const sandboxInstanceCache = new Map<
  string,
  { sandbox: Sandbox; expiresAt: number }
>();

/**
 * Invalidate the sandbox cache for a chat so the next getOrCreateSandbox creates
 * a new sandbox (e.g. after workspace rollback).
 */
export function invalidateSandboxCache(chatId: string): void {
  sandboxInstanceCache.delete(chatId);
}

export type SandboxRow = {
  chat_id: string;
  sandbox_id: string;
  expires_at: string;
  workspace_paths: string[];
  created_at: string;
  updated_at: string;
};

export type SupabaseClient = Awaited<
  ReturnType<typeof import('@/utils/supabase/server').createClient>
>;

/**
 * Get or create an E2B sandbox for the given chat.
 * Persists sandbox_id and expiry in DB; reuses in-memory instance when valid.
 */
export async function getOrCreateSandbox(
  chatId: string,
  supabase: SupabaseClient
): Promise<Sandbox> {
  const now = Date.now();
  const cached = sandboxInstanceCache.get(chatId);
  if (cached && cached.expiresAt > now) {
    return cached.sandbox;
  }

  const { data: row } = await supabase
    .from('chat_sandboxes')
    .select('sandbox_id, expires_at')
    .eq('chat_id', chatId)
    .single();

  const expiresAtMs = row?.expires_at
    ? new Date(row.expires_at).getTime()
    : 0;
  if (row?.sandbox_id && expiresAtMs > now) {
    try {
      const sandbox = await Sandbox.connect(row.sandbox_id);
      try {
        await sandbox.setTimeout(SANDBOX_TTL_MS);
      } catch {
        // Ignore timeout extension failure (e.g. sandbox already gone)
      }
      sandboxInstanceCache.set(chatId, {
        sandbox,
        expiresAt: expiresAtMs,
      });
      return sandbox;
    } catch {
      // Sandbox may have been killed; create new one below.
    }
  }

  const sandbox = await Sandbox.create({ timeoutMs: SANDBOX_TTL_MS });
  const newExpiresAt = new Date(now + SANDBOX_TTL_MS).toISOString();

  const savedFiles = await getSavedWorkspaceFiles(chatId, supabase);
  const rehydratedPaths: string[] = [];
  for (const { path, content } of savedFiles) {
    try {
      await sandbox.files.write(path, content);
      rehydratedPaths.push(path);
    } catch {
      // Skip failed writes (path too long, etc.)
    }
  }

  await supabase.from('chat_sandboxes').upsert(
    {
      chat_id: chatId,
      sandbox_id: sandbox.sandboxId,
      expires_at: newExpiresAt,
      workspace_paths: rehydratedPaths,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'chat_id' }
  );

  sandboxInstanceCache.set(chatId, {
    sandbox,
    expiresAt: now + SANDBOX_TTL_MS,
  });
  return sandbox;
}

/**
 * Return the list of workspace file paths we track for this chat.
 */
export async function getWorkspacePaths(
  chatId: string,
  supabase: SupabaseClient
): Promise<string[]> {
  const { data } = await supabase
    .from('chat_sandboxes')
    .select('workspace_paths')
    .eq('chat_id', chatId)
    .single();

  const paths = data?.workspace_paths;
  if (Array.isArray(paths)) return paths;
  if (typeof paths === 'string') {
    try {
      const parsed = JSON.parse(paths) as unknown;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Add a path to the workspace list for this chat (e.g. after upload or write_file).
 * Deduplicates and persists.
 */
export async function addWorkspacePath(
  chatId: string,
  path: string,
  supabase: SupabaseClient
): Promise<void> {
  const current = await getWorkspacePaths(chatId, supabase);
  if (current.includes(path)) return;
  const next = [...current, path];

  await supabase
    .from('chat_sandboxes')
    .update({
      workspace_paths: next,
      updated_at: new Date().toISOString(),
    })
    .eq('chat_id', chatId);
}

/**
 * Remove a path from the workspace list for this chat (e.g. after delete_file).
 */
export async function removeWorkspacePath(
  chatId: string,
  path: string,
  supabase: SupabaseClient
): Promise<void> {
  const current = await getWorkspacePaths(chatId, supabase);
  const next = current.filter((p) => p !== path);
  if (next.length === current.length) return;

  await supabase
    .from('chat_sandboxes')
    .update({
      workspace_paths: next,
      updated_at: new Date().toISOString(),
    })
    .eq('chat_id', chatId);
}

/**
 * Delete a workspace file from DB (so it is not rehydrated on new sandbox).
 */
export async function deleteWorkspaceFile(
  chatId: string,
  path: string,
  supabase: SupabaseClient
): Promise<void> {
  await supabase
    .from('chat_workspace_files')
    .delete()
    .eq('chat_id', chatId)
    .eq('path', path);
}

/**
 * Save workspace file content to DB so we can rehydrate a new sandbox later.
 */
export async function saveWorkspaceFile(
  chatId: string,
  path: string,
  content: string,
  supabase: SupabaseClient
): Promise<void> {
  await supabase.from('chat_workspace_files').upsert(
    {
      chat_id: chatId,
      path,
      content,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'chat_id,path' }
  );
}

/**
 * Load saved workspace file contents for a chat (for rehydration).
 */
export async function getSavedWorkspaceFiles(
  chatId: string,
  supabase: SupabaseClient
): Promise<Array<{ path: string; content: string }>> {
  const { data } = await supabase
    .from('chat_workspace_files')
    .select('path, content')
    .eq('chat_id', chatId);
  if (!Array.isArray(data)) return [];
  return data.filter((r): r is { path: string; content: string } => typeof r?.path === 'string' && typeof r?.content === 'string');
}

/**
 * Load a single workspace file's content for a chat.
 * Returns the content string, or null if the file doesn't exist.
 */
export async function getWorkspaceFileContent(
  chatId: string,
  path: string,
  supabase: SupabaseClient
): Promise<string | null> {
  const { data } = await supabase
    .from('chat_workspace_files')
    .select('content')
    .eq('chat_id', chatId)
    .eq('path', path)
    .limit(1);
  if (!Array.isArray(data) || data.length === 0) return null;
  return typeof data[0].content === 'string' ? data[0].content : null;
}

/**
 * Resolve sandbox path for an uploaded file (consistent with doc 3).
 * Use this when writing user uploads into the sandbox.
 */
export function workspacePathForFilename(filename: string): string {
  const base = filename.replace(/^.*[/\\]/, '');
  return `${WORKSPACE_BASE}/${base}`;
}

export { WORKSPACE_BASE };

const MAX_WORKSPACE_FILES = 20;
const SNIPPET_MAX_CHARS_PER_FILE = 280;
const SNIPPET_MAX_TOTAL_CHARS = 2400;

/**
 * Build workspace file context string: path + short content snippet per file.
 * Only includes paths that exist in chat_workspace_files so we never advertise files
 * that no longer exist in the sandbox (e.g. after rehydration with fewer files).
 */
export async function getWorkspaceContextText(
  chatId: string,
  supabase: SupabaseClient
): Promise<string> {
  try {
    const [paths, savedFiles] = await Promise.all([
      getWorkspacePaths(chatId, supabase),
      getSavedWorkspaceFiles(chatId, supabase),
    ]);
    const savedPathSet = new Set(savedFiles.map((f) => f.path));
    const pathSet = new Set(
      paths.slice(0, MAX_WORKSPACE_FILES).filter((p) => savedPathSet.has(p))
    );
    const savedByPath = new Map(savedFiles.map((f) => [f.path, f.content]));
    const blocks: string[] = [];
    let totalSnippetChars = 0;
    for (const path of pathSet) {
      const content = savedByPath.get(path);
      if (content !== undefined && totalSnippetChars < SNIPPET_MAX_TOTAL_CHARS) {
        const snippet =
          content.length <= SNIPPET_MAX_CHARS_PER_FILE
            ? content
            : content.slice(0, SNIPPET_MAX_CHARS_PER_FILE) + '...';
        totalSnippetChars += snippet.length;
        blocks.push(`Path: ${path}\nSnippet:\n\`\`\`\n${snippet}\n\`\`\`\n(Use read_file("${path}") for full content.)`);
      } else {
        blocks.push(`Path: ${path} (use read_file to read)`);
      }
    }
    if (blocks.length === 0) return '';
    return `\n\n---\nCurrent workspace files (use read_file(path) for full content, write_file(path, content) to write):\n\n${blocks.join('\n\n')}\n---\n`;
  } catch {
    return '';
  }
}

/** Return true if attachment is a code/text file we can put in the sandbox (not image/pdf). */
function isTextOrCodeAttachment(att: { contentType?: string; fileType?: string; name?: string }): boolean {
  const ct = (att.contentType || '').toLowerCase();
  const ft = (att.fileType || '').toLowerCase();
  const name = (att.name || '');
  if (ct.startsWith('image/') || ct === 'application/pdf') return false;
  if (ft === 'image' || ft === 'pdf') return false;
  const codeExt = /\.(js|ts|jsx|tsx|py|java|c|cpp|cs|go|rb|php|html|css|sql|scala|swift|kt|rs|dart|json|xml|yaml|yml|md|txt|csv)$/i;
  return !!name.match(codeExt) || ft === 'code' || ct.includes('text/') || ct.includes('javascript') || ct.includes('json') || ct === 'application/csv';
}

/**
 * Upload code/text attachments from the last user message into the chat's sandbox and track paths.
 * Call when file-edit tools are active and the user message has file attachments.
 */
export async function uploadMessageAttachmentsToSandbox(
  chatId: string,
  lastUserMessage: { experimental_attachments?: Array<{ url?: string; name?: string; contentType?: string; fileType?: string }>; parts?: Array<{ type: string; url?: string; filename?: string; mediaType?: string }> },
  supabase: SupabaseClient
): Promise<void> {
  const attachments: { url: string; name: string; contentType?: string }[] = [];
  if (Array.isArray(lastUserMessage.experimental_attachments)) {
    for (const a of lastUserMessage.experimental_attachments) {
      if (a?.url && isTextOrCodeAttachment(a)) attachments.push({ url: a.url, name: a.name || 'file', contentType: a.contentType });
    }
  }
  if (Array.isArray(lastUserMessage.parts)) {
    for (const p of lastUserMessage.parts) {
      if (p?.type === 'file' && p.url && isTextOrCodeAttachment({ contentType: p.mediaType, name: p.filename })) {
        attachments.push({ url: p.url, name: p.filename || 'file', contentType: p.mediaType });
      }
    }
  }
  if (attachments.length === 0) return;

  const { fetchFileContent } = await import('../utils/messageUtils');
  const sandbox = await getOrCreateSandbox(chatId, supabase);

  for (const att of attachments) {
    const content = await fetchFileContent(att.url, att.contentType);
    if (!content?.text) continue;
    const path = workspacePathForFilename(att.name);
    await sandbox.files.write(path, content.text);
    await addWorkspacePath(chatId, path, supabase);
    await saveWorkspaceFile(chatId, path, content.text, supabase);
  }
}
