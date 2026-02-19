'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Copy, Download, X } from 'lucide-react';
import { getAdaptiveGlassStyleBlur } from '@/app/lib/adaptiveGlassStyle';
import type { FileEditFileEntry } from '@/app/hooks/toolFunction';
import { resolveMediaPlaceholders, type VideoMapValue } from '@/app/utils/resolveMediaPlaceholders';
import { CanvasPreviewMarkdown } from './CanvasPreviewMarkdown';
import {
  CanvasDiffView,
} from './Canvas';
import { CsvTable } from './CsvTable';

export type FileEditMediaMaps = {
  linkMap: Record<string, string>;
  imageMap: Record<string, string>;
  videoMap: Record<string, VideoMapValue>;
};

function getLanguageFromPath(path?: string): string {
  if (!path) return 'text';
  const ext = path.split('.').pop()?.toLowerCase();
  if (!ext) return 'text';
  const languageMap: Record<string, string> = {
    js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
    py: 'python', java: 'java', c: 'c', cpp: 'cpp', cs: 'csharp', go: 'go',
    rb: 'ruby', php: 'php', swift: 'swift', kt: 'kotlin', rs: 'rust',
    html: 'html', css: 'css', json: 'json', xml: 'xml', md: 'markdown',
    sql: 'sql', sh: 'bash', yml: 'yaml', yaml: 'yaml', toml: 'toml',
    ini: 'ini', cfg: 'ini', conf: 'ini', log: 'text',
    csv: 'text', tsv: 'text', txt: 'text',
  };
  return languageMap[ext] ?? 'text';
}

function isCSVPath(path?: string): boolean {
  if (!path) return false;
  const lower = path.toLowerCase();
  return lower.endsWith('.csv') || lower.endsWith('.tsv');
}

/** Parse CSV/TSV into rows (handles quoted fields and "" escape). */
function parseCSV(content: string, path?: string): string[][] {
  const isTsv = path?.toLowerCase().endsWith('.tsv');
  const delimiter = isTsv ? '\t' : ',';
  const lines = content.split(/\r?\n/);
  const rows: string[][] = [];

  for (const line of lines) {
    const row: string[] = [];
    let i = 0;
    while (i < line.length) {
      if (line[i] === '"') {
        let cell = '';
        i++;
        while (i < line.length) {
          if (line[i] === '"') {
            if (line[i + 1] === '"') {
              cell += '"';
              i += 2;
            } else {
              i++;
              break;
            }
          } else {
            cell += line[i];
            i++;
          }
        }
        row.push(cell);
      } else {
        let end = line.indexOf(delimiter, i);
        if (end === -1) end = line.length;
        row.push(line.slice(i, end).trim());
        i = end + 1;
      }
    }
    rows.push(row);
  }
  return rows;
}


export function FileEditCanvasPanel({
  entry,
  chatId,
  mediaMaps,
  onClose,
  isMobile,
  title,
  filePath,
}: {
  entry: FileEditFileEntry;
  chatId?: string;
  mediaMaps: FileEditMediaMaps;
  onClose: () => void;
  isMobile: boolean;
  /** Tool display name (e.g. "Read file", "Write file") */
  title: string;
  /** File path or path label, shown below the title when set */
  filePath?: string;
}) {
  const isDiffTool = entry.toolName === 'write_file' || entry.toolName === 'apply_edits';
  const isReadOrGrep = entry.toolName === 'read_file' || entry.toolName === 'grep_file';
  const shouldFetchContent = isReadOrGrep && !!chatId && !!entry.path;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [fullContent, setFullContent] = useState<string | null>(null);
  const [binaryInfo, setBinaryInfo] = useState<{ downloadUrl: string; filename: string } | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchFullContent = useCallback(async () => {
    if (!shouldFetchContent || !chatId || !entry.path) return;
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    setLoading(true);
    setError(null);
    setSyncing(false);
    try {
      const res = await fetch(
        `/api/chat/workspace-file-content?chatId=${encodeURIComponent(chatId)}&path=${encodeURIComponent(entry.path)}`
      );
      if (!res.ok) {
        setFullContent(null);
        setBinaryInfo(null);
        // When the assistant is still streaming, the workspace file may not have been
        // persisted to `chat_workspace_files` yet. Treat 404/403 as a transient state
        // and retry for a short window to avoid a sticky "Failed to load" canvas.
        if ((res.status === 404 || res.status === 403) && retryCount < 6) {
          setSyncing(true);
          const delayMs = Math.min(4000, 350 * Math.pow(2, retryCount)); // 350,700,1400,2800,4000...
          retryTimerRef.current = setTimeout(() => setRetryCount((c) => c + 1), delayMs);
          return;
        }
        setError('Failed to load file');
        return;
      }
      const data = await res.json();
      if (data?.isBinary && data?.downloadUrl) {
        setBinaryInfo({ downloadUrl: data.downloadUrl, filename: data.filename || entry.path.replace(/^.*\//, '') });
        setFullContent(null);
        return;
      }
      setBinaryInfo(null);
      setFullContent(typeof data?.content === 'string' ? data.content : null);
    } catch {
      setFullContent(null);
      setBinaryInfo(null);
      setError('Failed to load file');
    } finally {
      setLoading(false);
    }
  }, [shouldFetchContent, chatId, entry.path, retryCount]);

  useEffect(() => {
    fetchFullContent();
  }, [fetchFullContent]);

  // Reset retries when the target file changes.
  useEffect(() => {
    setRetryCount(0);
    setSyncing(false);
    setError(null);
    // Do not eagerly clear fullContent here; we want to keep previous content visible
    // until the next fetch resolves (prevents flashing on quick switches).
  }, [chatId, entry.path]);

  // Cleanup any pending retry timer on unmount.
  useEffect(() => {
    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, []);

  const isMarkdown = useMemo(() => !!entry.path?.toLowerCase().endsWith('.md'), [entry.path]);
  const isCSV = useMemo(() => isCSVPath(entry.path), [entry.path]);

  const highlightLineNumbers = useMemo(() => {
    if (entry.toolName === 'read_file') {
      const start = (entry as any).startLine;
      const end = (entry as any).endLine;
      if (typeof start !== 'number' || typeof end !== 'number' || start > end) return undefined;
      const set = new Set<number>();
      for (let i = start; i <= end; i++) set.add(i);
      return set.size > 0 ? set : undefined;
    }
    if (entry.toolName === 'grep_file') {
      const matches = (entry as any).matches as Array<{ lineNumber: number }> | undefined;
      if (!matches || matches.length === 0) return undefined;
      const set = new Set<number>(matches.map((m) => m.lineNumber));
      return set.size > 0 ? set : undefined;
    }
    return undefined;
  }, [entry]);

  const scrollToLine = useMemo(() => {
    if (!highlightLineNumbers || highlightLineNumbers.size === 0) return undefined;
    let min = Infinity;
    highlightLineNumbers.forEach((n) => { if (n < min) min = n; });
    return Number.isFinite(min) ? min : undefined;
  }, [highlightLineNumbers]);

  const resolvedDisplayContent = useMemo(() => {
    if (!fullContent) return '';
    if (!isMarkdown) return fullContent;
    return resolveMediaPlaceholders(fullContent, { ...mediaMaps, unresolvedPolicy: 'remove' });
  }, [fullContent, isMarkdown, mediaMaps.linkMap, mediaMaps.imageMap, mediaMaps.videoMap]);

  const resolvedDownloadContent = useMemo(() => {
    if (!fullContent) return '';
    if (!isMarkdown) return fullContent;
    return resolveMediaPlaceholders(fullContent, { ...mediaMaps, unresolvedPolicy: 'remove', imageOutput: 'url' });
  }, [fullContent, isMarkdown, mediaMaps.linkMap, mediaMaps.imageMap, mediaMaps.videoMap]);

  const csvRows = useMemo(() => {
    if (!isCSV || !fullContent) return null;
    return parseCSV(fullContent, entry.path);
  }, [isCSV, fullContent, entry.path]);

  const handleCopy = useCallback(() => {
    const text = binaryInfo?.downloadUrl ? binaryInfo.downloadUrl : resolvedDownloadContent;
    if (text) navigator.clipboard.writeText(text);
  }, [binaryInfo?.downloadUrl, resolvedDownloadContent]);

  const handleDownload = useCallback(() => {
    if (binaryInfo?.downloadUrl) {
      window.open(binaryInfo.downloadUrl, '_blank');
      return;
    }
    const text = resolvedDownloadContent || '';
    const name = entry.path?.replace(/^.*\//, '') || 'download.txt';
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }, [binaryInfo?.downloadUrl, resolvedDownloadContent, entry.path]);

  const showActions = isReadOrGrep;

  const renderReadOrGrepBody = () => {
    if (loading) {
      return <div className="text-sm opacity-80" style={{ color: 'var(--foreground)' }}>Loading file…</div>;
    }
    if (syncing) {
      return <div className="text-sm text-(--muted) animate-pulse">Waiting for file to sync…</div>;
    }
    if (error) {
      return <div className="text-sm text-red-500">{error}</div>;
    }
    if (binaryInfo) {
      return (
        <div className="text-sm opacity-80" style={{ color: 'var(--foreground)' }}>
          Binary file. Use Download to open the file.
        </div>
      );
    }
    if (!fullContent) return null;

    const needsCodeBlock = highlightLineNumbers != null && highlightLineNumbers.size > 0;
    const content = isMarkdown
      ? (needsCodeBlock ? `\`\`\`markdown\n${resolvedDisplayContent}\n\`\`\`` : resolvedDisplayContent)
      : `\`\`\`${getLanguageFromPath(entry.path)}\n${fullContent}\n\`\`\``;

    return (
      <div className="p-4 rounded-xl border border-[color-mix(in_srgb,var(--foreground)_10%,transparent)] bg-[color-mix(in_srgb,var(--foreground)_2%,transparent)]">
        {isCSV && csvRows && csvRows.length > 0 ? (
          <CsvTable rows={csvRows} />
        ) : (
          <CanvasPreviewMarkdown
            isMainFile={true}
            highlightLineNumbers={needsCodeBlock ? highlightLineNumbers : undefined}
            scrollToLine={needsCodeBlock ? scrollToLine : undefined}
            content={content}
            filePath={entry.path}
          />
        )}
      </div>
    );
  };

  const renderMetaBody = () => {
    if (entry.toolName === 'get_file_info') {
      return (
        <div className="p-4 rounded-xl border border-[color-mix(in_srgb,var(--foreground)_10%,transparent)] bg-[color-mix(in_srgb,var(--foreground)_2%,transparent)]">
          {entry.success && (
            <dl className="text-sm space-y-1">
              {typeof entry.size === 'number' && (
                <>
                  <dt className="text-(--muted)">Size</dt>
                  <dd>{entry.size} bytes</dd>
                </>
              )}
            </dl>
          )}
          {!entry.success && entry.error && <p className="text-sm text-red-500">{entry.error}</p>}
        </div>
      );
    }
    if (entry.toolName === 'list_workspace') {
      return (
        <div className="p-4 rounded-xl border border-[color-mix(in_srgb,var(--foreground)_10%,transparent)] bg-[color-mix(in_srgb,var(--foreground)_2%,transparent)]">
          {entry.success && entry.entries && entry.entries.length > 0 && (
            <ul className="text-sm space-y-1 list-disc list-inside">
              {entry.entries.map((e, i) => (
                <li key={i}>{e.path || e.name} {e.isDir ? '(dir)' : ''}</li>
              ))}
            </ul>
          )}
          {entry.success && (!entry.entries || entry.entries.length === 0) && <p className="text-sm text-(--muted)">No entries.</p>}
          {!entry.success && entry.error && <p className="text-sm text-red-500">{entry.error}</p>}
        </div>
      );
    }
    if (entry.toolName === 'delete_file') {
      return (
        <div className="p-4 rounded-xl border border-[color-mix(in_srgb,var(--foreground)_10%,transparent)] bg-[color-mix(in_srgb,var(--foreground)_2%,transparent)]">
          {entry.success && <p className="text-sm text-(--muted)">Deleted.</p>}
          {!entry.success && entry.error && <p className="text-sm text-red-500">{entry.error}</p>}
        </div>
      );
    }
    return null;
  };

  const mainBody = isDiffTool ? (
    <CanvasDiffView entry={entry} chatId={chatId} mediaMaps={mediaMaps} useGlassActionButtons />
  ) : isReadOrGrep ? (
    renderReadOrGrepBody()
  ) : (
    renderMetaBody()
  );

  // Mobile action row matches WorkspaceFileModal (small pill buttons).
  const mobileActionsRow = showActions ? (
    <div className="shrink-0 flex items-center gap-3 pt-2 pb-6 px-4">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); handleCopy(); }}
        className="flex items-center gap-2 px-3 py-2 rounded-full min-w-0"
        style={{ ...getAdaptiveGlassStyleBlur(), color: 'var(--foreground)', WebkitTapHighlightColor: 'transparent' }}
        title="Copy"
      >
        <Copy size={16} />
        <span className="text-[10px] tracking-wider font-bold">Copy</span>
      </button>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); handleDownload(); }}
        className="flex items-center gap-2 px-3 py-2 rounded-full min-w-0"
        style={{ ...getAdaptiveGlassStyleBlur(), color: 'var(--foreground)', WebkitTapHighlightColor: 'transparent' }}
        title="Download"
      >
        <Download size={16} />
        <span className="text-[10px] tracking-wider font-bold">Download</span>
      </button>
    </div>
  ) : null;

  // Desktop action row matches WorkspaceFileModal (larger pill buttons).
  const desktopActionsRow = showActions ? (
    <div className="flex items-center gap-3 mb-8">
      <button
        type="button"
        onClick={handleCopy}
        className="flex items-center gap-2 px-4 py-2 rounded-full cursor-pointer transition-all duration-200 hover:scale-105 active:scale-95"
        style={{ ...getAdaptiveGlassStyleBlur(), color: 'var(--foreground)', WebkitTapHighlightColor: 'transparent' }}
        title="Copy"
      >
        <Copy size={18} />
        <span className="text-xs font-semibold">Copy</span>
      </button>
      <button
        type="button"
        onClick={handleDownload}
        className="flex items-center gap-2 px-4 py-2 rounded-full cursor-pointer transition-all duration-200 hover:scale-105 active:scale-95"
        style={{ ...getAdaptiveGlassStyleBlur(), color: 'var(--foreground)', WebkitTapHighlightColor: 'transparent' }}
        title="Download"
      >
        <Download size={18} />
        <span className="text-xs font-semibold">Download</span>
      </button>
    </div>
  ) : null;

  const mobileBody = (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      {mobileActionsRow}
      <div
        className="flex-1 min-h-0 flex flex-col overflow-hidden px-4 pb-6"
        style={{
          WebkitUserSelect: 'text',
          userSelect: 'text',
          touchAction: 'pan-y',
          wordBreak: 'break-word',
          overflowWrap: 'break-word',
        }}
      >
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
          {mainBody}
        </div>
      </div>
    </div>
  );

  const desktopBody = (
    <div className="mt-12 ml-1">
      {desktopActionsRow}
      <div
        className="min-h-[200px] overflow-y-auto overflow-x-hidden"
        style={{
          WebkitUserSelect: 'text',
          userSelect: 'text',
          touchAction: 'pan-y',
          wordBreak: 'break-word',
          overflowWrap: 'break-word',
        }}
      >
        {mainBody}
      </div>
    </div>
  );

  const glassPanelStyle = useMemo(
    () => ({
      height: 'calc(100vh - 120px)',
      maxHeight: 'calc(100vh - 120px)',
      transform: 'translateY(0px)',
      transition:
        'transform 0.35s cubic-bezier(0.25, 0.1, 0.25, 1), opacity 0.25s ease-out',
      willChange: 'transform, opacity' as const,
      opacity: 1,
      ...getAdaptiveGlassStyleBlur(),
      backgroundColor:
        typeof window !== 'undefined' &&
        (document.documentElement.getAttribute('data-theme') === 'dark' ||
          (document.documentElement.getAttribute('data-theme') === 'system' &&
            window.matchMedia('(prefers-color-scheme: dark)').matches))
          ? 'rgba(30, 30, 30, 0.6)'
          : 'rgba(240, 240, 240, 0.6)',
      backdropFilter: 'blur(40px)',
      WebkitBackdropFilter: 'blur(40px)',
      zIndex: 9999,
    }),
    []
  );

  return createPortal(
    <div
      className="fixed inset-0 z-9999"
      style={{ touchAction: 'none', overflow: 'hidden' }}
    >
      {isMobile ? (
        <>
          <div
            className="fixed inset-0 bg-transparent"
            onClick={onClose}
            style={{ touchAction: 'none' }}
          />
          <div
            className="fixed inset-x-0 bottom-0 w-full flex flex-col overflow-hidden rounded-t-3xl"
            style={glassPanelStyle}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center pt-4 pb-4 shrink-0">
              <div
                className="w-12 h-1.5 rounded-full mx-auto"
                style={{ backgroundColor: 'rgba(209, 213, 219, 0.3)' }}
              />
            </div>
            <div className="relative flex flex-col items-center justify-center py-6 px-6 shrink-0 gap-1">
              <h2
                className="text-2xl font-bold truncate text-center w-full"
                style={{
                  color: 'var(--foreground)',
                  maxWidth: 'calc(100vw - 48px)',
                }}
              >
                {title}
              </h2>
              {filePath ? (
                <p
                  className="text-xs truncate text-center opacity-70 w-full px-4"
                  style={{ color: 'var(--foreground)' }}
                  title={filePath}
                >
                  {filePath}
                </p>
              ) : null}
            </div>
            {mobileBody}
          </div>
        </>
      ) : (
        <div
          className="fixed inset-0 text-(--foreground) pointer-events-auto"
          style={{ zIndex: 9999 }}
        >
          <div
            className="fixed inset-0 min-h-screen w-full pointer-events-none"
            style={{
              backdropFilter: 'blur(40px)',
              WebkitBackdropFilter: 'blur(40px)',
              zIndex: 0.5,
            }}
          />
          <div
            className="absolute inset-0 pointer-events-auto"
            style={{ backgroundColor: 'transparent', zIndex: 1 }}
            onClick={onClose}
          />
          <div
            className="relative h-full w-full flex flex-col transform-gpu"
            style={{ zIndex: 2 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              aria-label="Close"
              className="absolute top-3 right-3 rounded-full p-2 z-10 cursor-pointer transition-all duration-200 hover:scale-105 active:scale-95"
              onClick={onClose}
              style={{
                outline: '0 !important',
                WebkitTapHighlightColor: 'transparent',
                ...getAdaptiveGlassStyleBlur(),
                color: 'var(--foreground)',
              }}
            >
              <X size={20} />
            </button>
            <div className="px-12 sm:px-16 md:px-20 lg:px-28 pt-12 sm:pt-30 pb-24 overflow-y-auto">
              <div className="flex items-center justify-between">
                <h2
                  className="text-3xl sm:text-3xl md:text-4xl font-semibold tracking-tight truncate min-w-0"
                  style={{ color: 'var(--foreground)' }}
                >
                  {title}
                </h2>
                <div />
              </div>
              {filePath ? (
                <div
                  className="text-xs mt-2 truncate opacity-70"
                  style={{ color: 'var(--foreground)' }}
                  title={filePath}
                >
                  {filePath}
                </div>
              ) : null}
              {desktopBody}
            </div>
          </div>
        </div>
      )}
    </div>,
    typeof document !== 'undefined' ? document.body : (null as any)
  );
}
