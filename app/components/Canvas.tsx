import React, { useState, useMemo, useEffect, memo, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { e2bChartToChartJs } from '@/app/utils/e2bChartToChartJs';
import { e2bChartToEChartsOption } from '@/app/utils/e2bChartToECharts';
import MultiSearch from './MultiSearch';
import MathCalculation from './MathCalculation';
import LinkReader from './LinkReader';
import { ChevronUp, ChevronDown, Brain, Link2, Image as ImageIcon, AlertTriangle, X, ChevronLeft, ChevronRight, ExternalLink, Search, Calculator, BookOpen, FileSearch, FileText, Code2, Youtube, Database, Video, Loader2, Share, ScrollText, Info, Check, Copy, Bookmark, Download, RotateCcw } from 'lucide-react';
import { getAdaptiveGlassStyleBlur, getIconClassName } from '@/app/lib/adaptiveGlassStyle';
import { createPortal } from 'react-dom';
import { Tweet } from 'react-tweet';
import { SiGoogle } from 'react-icons/si';
import { XLogo, YouTubeLogo, WanAiLogo, SeedreamLogo, XaiLogo } from './CanvasFolder/CanvasLogo';
import { YouTubeVideo, VideoWithRefresh } from './CanvasFolder/toolComponent';
import { DirectVideoEmbed } from './MarkdownContent';
import { CanvasPreviewMarkdown } from './CanvasPreviewMarkdown';
import { ImageGalleryStack } from './ImageGalleryStack';
import { VideoGalleryStack } from './VideoGalleryStack';
import type { LinkMetaEntry } from '@/app/types/linkPreview';
import type { FileEditData, FileEditFileEntry, RunCodeData } from '@/app/hooks/toolFunction';
import { useUrlRefresh } from '../hooks/useUrlRefresh';
import { ImageModal, type ImageModalImage } from './ImageModal';
import { computeDiffHunks, computeFullFileSegments, type DiffSummary, type ChangeBlock } from '@/app/utils/diffUtils';

// File path → language for CanvasPreviewMarkdown code blocks (mirrors AttachmentTextViewer)
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

const DynamicChart = dynamic(() => import('./charts/DynamicChart'), { ssr: false });
const E2BChartECharts = dynamic(
  () => import('./charts/E2BChartECharts').then((m) => ({ default: m.E2BChartECharts })),
  { ssr: false }
);

type CanvasProps = {
  webSearchData: {
    result: any;
    args: any;
    annotations: any[];
    results: any[];
  } | null;
  mathCalculationData: {
    calculationSteps: any[];
  } | null;
  linkReaderData?: {
    linkAttempts: {
      url: string;
      title?: string;
      error?: string;
      timestamp?: string;
    }[];
    rawContent?: {
      url: string;
      title: string;
      content: string;
      contentType: string;
      contentLength: number;
      timestamp: string;
    }[];
  } | null;
  imageGeneratorData?: {
    generatedImages: {
      imageUrl: string;
      prompt: string;
      model?: string;
      timestamp?: string;
    }[];
  } | null;
  geminiImageData?: {
    generatedImages: {
      imageUrl: string;
      prompt: string;
      timestamp: string;
      originalImageUrl?: string;
      isEdit?: boolean;
      partIndex?: number;
    }[];
  } | null;
  seedreamImageData?: {
    generatedImages: {
      imageUrl: string;
      prompt: string;
      timestamp: string;
      originalImageUrl?: string;
      isEdit?: boolean;
      size?: string;
      aspectRatio?: string;
      partIndex?: number;
    }[];
  } | null;
  qwenImageData?: {
    generatedImages: {
      imageUrl: string;
      prompt: string;
      timestamp: string;
      originalImageUrl?: string;
      isEdit?: boolean;
      aspectRatio?: string;
      partIndex?: number;
    }[];
  } | null;
  wan25VideoData?: {
    generatedVideos: {
      videoUrl: string;
      prompt: string;
      timestamp: string;
      resolution?: string;
      size?: string;
      duration?: number;
      isImageToVideo?: boolean;
      sourceImageUrl?: string;
      path?: string;
    }[];
    status?: 'processing' | 'completed' | 'error';
    startedCount?: number;
    pendingCount?: number;
    pendingPrompts?: string[];
    pendingSourceImages?: string[];
    errorCount?: number;
  } | null;
  grokVideoData?: {
    generatedVideos: {
      videoUrl: string;
      prompt: string;
      timestamp: string;
      resolution?: string;
      duration?: number;
      aspect_ratio?: string;
      isImageToVideo?: boolean;
      isVideoEdit?: boolean;
      sourceImageUrl?: string;
      sourceVideoUrl?: string;
      path?: string;
    }[];
    status?: 'processing' | 'completed' | 'error';
    startedCount?: number;
    pendingCount?: number;
    pendingPrompts?: string[];
    pendingSourceImages?: string[];
    pendingSourceVideos?: string[];
    isVideoEdit?: boolean;
    errorCount?: number;
  } | null;

  twitterSearchData?: {
    result: any;
    args: any;
    annotations: any[];
    results: any[];
    imageMap?: Record<string, string>;
    linkMap?: Record<string, string>;
    thumbnailMap?: Record<string, string>;
    linkMetaMap?: Record<string, any>;
  } | null;
  youTubeSearchData?: {
    youtubeResults: {
      query: string;
      timestamp?: string;
      results: {
        videoId: string;
        url: string;
        details?: {
          title?: string;
          description?: string;
          channelName?: string;
          publishDate?: string;
          viewCount?: number;
          duration?: string;
          thumbnailUrl?: string;
        };
        captions?: string;
        timestamps?: {
          time: string;
          text: string;
        }[];
      }[];
    }[];
  } | null;
  youTubeLinkAnalysisData?: {
    analysisResults: {
      url: string;
      videoId: string;
      timestamp: string;
      details?: {
        title?: string;
        description?: string;
        author?: string;
        publishedTime?: string;
        views?: number;
        likes?: number;
        category?: string;
        duration?: number;
      };
      channel?: {
        name?: string;
        id?: string;
        subscribers?: string;
        link?: string;
      };
      transcript?: {
        language: string;
        segments: {
          timestamp: string;
          start: number;
          duration: number;
          text: string;
        }[];
        fullText: string;
      };
      transcriptError?: string;
      error?: string;
    }[];
  } | null;
  googleSearchData?: {
    result: any;
    args: any;
    annotations: any[];
    results: any[];
  } | null;
  fileEditData?: FileEditData | null;
  runCodeData?: RunCodeData | null;
  isCompact?: boolean;
  selectedTool?: string;
  selectedItem?: string;
  onSearchFilterChange?: (hasActiveFilters: boolean, selectedTopics?: string[], isAllQueriesSelected?: boolean, userHasInteracted?: boolean) => void;
  messageId?: string;
  chatId?: string;
  userId?: string;
};

// ── CanvasReadFileView: Full file content via CanvasPreviewMarkdown ──────────
// Fetches full file from workspace and renders as markdown or syntax-highlighted code block.
function CanvasReadFileView({ entry, chatId }: { entry: FileEditFileEntry; chatId?: string }) {
  const [fullContent, setFullContent] = useState<string | null>(null);

  const fetchFullContent = useCallback(async () => {
    if (!chatId || !entry.path) return;
    try {
      const res = await fetch(`/api/chat/workspace-file-content?chatId=${encodeURIComponent(chatId)}&path=${encodeURIComponent(entry.path)}`);
      if (res.ok) {
        const data = await res.json();
        setFullContent(typeof data.content === 'string' ? data.content : null);
      } else {
        setFullContent(null);
      }
    } catch {
      setFullContent(null);
    }
  }, [chatId, entry.path]);

  useEffect(() => {
    fetchFullContent();
  }, [fetchFullContent]);

  const displayContent = fullContent ?? entry.content ?? '';
  const contentToCopyOrDownload = fullContent ?? entry.content ?? '';
  const isCSV = isCSVPath(entry.path);
  const csvRows = useMemo(() => (isCSV && displayContent ? parseCSV(displayContent, entry.path) : null), [isCSV, displayContent, entry.path]);

  const highlightLineNumbers = useMemo(() => {
    const start = entry.startLine;
    const end = entry.endLine;
    if (typeof start !== 'number' || typeof end !== 'number' || start > end) return undefined;
    const set = new Set<number>();
    for (let i = start; i <= end; i++) set.add(i);
    return set.size > 0 ? set : undefined;
  }, [entry.startLine, entry.endLine]);
  const scrollToLine = useMemo(() => {
    if (!highlightLineNumbers || highlightLineNumbers.size === 0) return undefined;
    let min = Infinity;
    highlightLineNumbers.forEach((lineNo) => {
      if (lineNo < min) min = lineNo;
    });
    return Number.isFinite(min) ? min : undefined;
  }, [highlightLineNumbers]);

  if (!entry.success && entry.error) {
    return <p className="text-sm text-red-500">{entry.error}</p>;
  }

  return (
    <>
      <div className="flex items-center gap-3 mb-3">
        <button
          type="button"
          onClick={() => navigator.clipboard.writeText(contentToCopyOrDownload)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-(--muted) hover:text-(--foreground) hover:bg-(--muted/10) transition-all"
        >
          <Copy size={14} /> Copy
        </button>
        <button
          type="button"
          onClick={() => {
            const name = entry.path.replace(/^.*\//, '') || 'download.txt';
            const blob = new Blob([contentToCopyOrDownload], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = name;
            a.click();
            URL.revokeObjectURL(url);
          }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-(--muted) hover:text-(--foreground) hover:bg-(--muted/10) transition-all"
        >
          <Download size={14} /> Download
        </button>
      </div>
      {fullContent === null && !entry.content && (
        <p className="text-sm text-(--muted)">Loading file…</p>
      )}
      {displayContent && !isCSV && (
        <div className="p-6 rounded-xl border border-[color-mix(in_srgb,var(--foreground)_10%,transparent)] bg-[color-mix(in_srgb,var(--foreground)_2%,transparent)]">
          <CanvasPreviewMarkdown
            isMainFile={true}
            highlightLineNumbers={highlightLineNumbers}
            scrollToLine={scrollToLine}
            content={entry.path?.toLowerCase().endsWith('.md')
              ? displayContent
              : `\`\`\`${getLanguageFromPath(entry.path)}\n${displayContent}\n\`\`\``}
          />
        </div>
      )}
      {displayContent && isCSV && csvRows && csvRows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-[color-mix(in_srgb,var(--foreground)_10%,transparent)] bg-(--muted/20)">
          <table className="w-full text-xs md:text-[13px] border-collapse">
            <thead>
              <tr>
                {csvRows[0].map((cell, j) => (
                  <th
                    key={j}
                    className="text-left font-medium px-3 py-2 border-b border-[color-mix(in_srgb,var(--foreground)_15%,transparent)] bg-(--muted/30) text-(--foreground)"
                  >
                    {cell}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {csvRows.slice(1).map((row, i) => (
                <tr
                  key={i}
                  className="border-b border-[color-mix(in_srgb,var(--foreground)_8%,transparent)] last:border-b-0 hover:bg-(--muted/20)"
                >
                  {row.map((cell, j) => (
                    <td
                      key={j}
                      className="px-3 py-2 text-(--foreground) whitespace-nowrap max-w-[200px] truncate"
                      title={cell}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// ── CanvasGrepFileView: Full file with highlighted matching lines ──────────
// Fetches full file from workspace and highlights lines in entry.matches.
function CanvasGrepFileView({ entry, chatId }: { entry: FileEditFileEntry; chatId?: string }) {
  const [fullContent, setFullContent] = useState<string | null>(null);

  const fetchFullContent = useCallback(async () => {
    if (!chatId || !entry.path) return;
    try {
      const res = await fetch(`/api/chat/workspace-file-content?chatId=${encodeURIComponent(chatId)}&path=${encodeURIComponent(entry.path)}`);
      if (res.ok) {
        const data = await res.json();
        setFullContent(typeof data.content === 'string' ? data.content : null);
      } else {
        setFullContent(null);
      }
    } catch {
      setFullContent(null);
    }
  }, [chatId, entry.path]);

  useEffect(() => {
    fetchFullContent();
  }, [fetchFullContent]);

  const contentToCopyOrDownload = fullContent ?? '';

  const matchLineNumbers = useMemo(() => {
    if (!entry.matches || entry.matches.length === 0) return undefined;
    const set = new Set(entry.matches.map((m) => m.lineNumber));
    return set.size > 0 ? set : undefined;
  }, [entry.matches]);
  const scrollToLine = useMemo(() => {
    if (!matchLineNumbers || matchLineNumbers.size === 0) return undefined;
    let min = Infinity;
    matchLineNumbers.forEach((lineNo) => {
      if (lineNo < min) min = lineNo;
    });
    return Number.isFinite(min) ? min : undefined;
  }, [matchLineNumbers]);

  if (!entry.success && entry.error) {
    return <p className="text-sm text-red-500">{entry.error}</p>;
  }

  return (
    <>
      <div className="flex items-center gap-3 mb-3">
        <button
          type="button"
          onClick={() => navigator.clipboard.writeText(contentToCopyOrDownload)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-(--muted) hover:text-(--foreground) hover:bg-(--muted/10) transition-all"
        >
          <Copy size={14} /> Copy
        </button>
        <button
          type="button"
          onClick={() => {
            const name = entry.path.replace(/^.*\//, '') || 'download.txt';
            const blob = new Blob([contentToCopyOrDownload], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = name;
            a.click();
            URL.revokeObjectURL(url);
          }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-(--muted) hover:text-(--foreground) hover:bg-(--muted/10) transition-all"
        >
          <Download size={14} /> Download
        </button>
      </div>
      {fullContent === null && (
        <p className="text-sm text-(--muted)">Loading file…</p>
      )}
      {fullContent != null && fullContent.length > 0 && (
        <div className="p-6 rounded-xl border border-[color-mix(in_srgb,var(--foreground)_10%,transparent)] bg-[color-mix(in_srgb,var(--foreground)_2%,transparent)]">
          <CanvasPreviewMarkdown
            isMainFile={true}
            highlightLineNumbers={matchLineNumbers}
            scrollToLine={scrollToLine}
            content={entry.path?.toLowerCase().endsWith('.md')
              ? fullContent
              : `\`\`\`${getLanguageFromPath(entry.path)}\n${fullContent}\n\`\`\``}
          />
        </div>
      )}
    </>
  );
}

// ── CanvasDiffView: Full-file diff with per-change Accept/Reject ──────────
// Fetches the CURRENT file content from the DB so the diff always reflects
// the actual applied state, even after page refresh.
function CanvasDiffView({ entry, chatId }: { entry: FileEditFileEntry; chatId?: string }) {
  // ── localStorage persistence keys ──
  const storageKey = useMemo(() => {
    if (!entry.path) return null;
    return `diff-rejected:${chatId || ''}:${entry.toolName}:${entry.path}`;
  }, [chatId, entry.toolName, entry.path]);

  const acceptedStorageKey = useMemo(() => {
    if (!entry.path) return null;
    return `diff-accepted:${chatId || ''}:${entry.toolName}:${entry.path}`;
  }, [chatId, entry.toolName, entry.path]);

  // rejectedBlocks: set of block IDs explicitly rejected.
  const [rejectedBlocks, setRejectedBlocks] = useState<Set<string>>(() => {
    if (!storageKey) return new Set();
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  });

  // acceptedBlocks: set of block IDs explicitly accepted (show final content only, no diff).
  const [acceptedBlocks, setAcceptedBlocks] = useState<Set<string>>(() => {
    if (!acceptedStorageKey) return new Set();
    try {
      const stored = localStorage.getItem(acceptedStorageKey);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  });

  // Persist to localStorage
  useEffect(() => {
    if (!storageKey) return;
    try {
      if (rejectedBlocks.size === 0) {
        localStorage.removeItem(storageKey);
      } else {
        localStorage.setItem(storageKey, JSON.stringify([...rejectedBlocks]));
      }
    } catch { /* quota exceeded */ }
  }, [rejectedBlocks, storageKey]);

  useEffect(() => {
    if (!acceptedStorageKey) return;
    try {
      if (acceptedBlocks.size === 0) {
        localStorage.removeItem(acceptedStorageKey);
      } else {
        localStorage.setItem(acceptedStorageKey, JSON.stringify([...acceptedBlocks]));
      }
    } catch { /* quota exceeded */ }
  }, [acceptedBlocks, acceptedStorageKey]);

  // Queued DB write ref – allows debouncing rapid clicks without blocking UI
  const writeRef = useRef<AbortController | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const [currentContent, setCurrentContent] = useState<string | null | undefined>(undefined);

  const proposedContent: string | undefined = entry.toolName === 'write_file'
    ? (entry.content ?? entry.input?.content)
    : entry.content;

  const originalContent: string | null = entry.originalContent !== undefined
    ? (entry.originalContent ?? null)
    : null;

  // ── Fetch current file from DB ──
  const fetchCurrentContent = useCallback(async () => {
    if (!chatId || !entry.path) return;
    try {
      const res = await fetch(`/api/chat/workspace-file-content?chatId=${encodeURIComponent(chatId)}&path=${encodeURIComponent(entry.path)}`);
      if (res.ok) {
        const data = await res.json();
        setCurrentContent(typeof data.content === 'string' ? data.content : null);
      } else { setCurrentContent(null); }
    } catch { setCurrentContent(null); }
  }, [chatId, entry.path]);

  useEffect(() => { fetchCurrentContent(); }, [fetchCurrentContent]);

  const displayContent: string | undefined = (currentContent !== undefined && currentContent !== null)
    ? currentContent
    : proposedContent ?? entry.input?.content;

  // ── Static Diff: original vs AI's initial proposal ──
  // This diff stays stable even when the user makes local edits.
  const diffData: DiffSummary | null = useMemo(() => {
    if (entry.originalContent === undefined) return null;
    if (typeof proposedContent !== 'string') return null;
    return computeDiffHunks(originalContent, proposedContent, 3);
  }, [originalContent, proposedContent, entry.originalContent]);

  // ── Full File Segments ──
  // Interleave the static diff with context lines to show the entire file.
  const allSegments = useMemo(() => {
    if (!diffData || !originalContent || !proposedContent) return null;
    return computeFullFileSegments(originalContent, proposedContent, diffData.hunks);
  }, [diffData, originalContent, proposedContent]);

  const allBlockIds = useMemo(() => {
    if (!allSegments) return [];
    return allSegments.filter(s => s.type === 'change').map(s => (s as { type: 'change'; block: ChangeBlock }).block.id);
  }, [allSegments]);

  // ── Computed Live Content (what the user actually sees on screen) ──
  const liveContent = useMemo(() => {
    if (!proposedContent || !allSegments) return displayContent;
    
    const lines: string[] = [];
    for (const seg of allSegments) {
      if (seg.type === 'context') {
        for (const line of seg.lines) {
          lines.push(line.content);
        }
      } else {
        if (rejectedBlocks.has(seg.block.id)) {
          // Revert to original
          lines.push(...seg.block.lines.filter(l => l.type === 'removed').map(l => l.content));
        } else {
          // Keep proposed
          for (const line of seg.block.lines) {
            if (line.type === 'added') {
              lines.push(line.content);
            }
          }
        }
      }
    }
    return lines.join('\n');
  }, [proposedContent, allSegments, rejectedBlocks, displayContent]);

  // ── Optimistic DB write ──
  const syncToDb = useCallback(async (rejected: Set<string>) => {
    if (!chatId || !originalContent || !proposedContent || !allSegments) return;
    
    writeRef.current?.abort();
    const controller = new AbortController();
    writeRef.current = controller;
    setIsSyncing(true);
    try {
      const lines: string[] = [];
      for (const seg of allSegments) {
        if (seg.type === 'context') {
          for (const line of seg.lines) {
            lines.push(line.content);
          }
        } else {
          if (rejected.has(seg.block.id)) {
            lines.push(...seg.block.lines.filter(l => l.type === 'removed').map(l => l.content));
          } else {
            for (const line of seg.block.lines) {
              if (line.type === 'added') {
                lines.push(line.content);
              }
            }
          }
        }
      }
      const content = lines.join('\n');
      
      await fetch('/api/chat/revert-hunks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, path: entry.path, content }),
        signal: controller.signal,
      });
      if (!controller.signal.aborted) setCurrentContent(content);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      console.error('Failed to sync file:', err);
    } finally {
      if (!controller.signal.aborted) setIsSyncing(false);
    }
  }, [chatId, entry.path, originalContent, proposedContent, allSegments]);

  const handleReject = useCallback((blockId: string) => {
    setRejectedBlocks(prev => {
      const next = new Set(prev);
      next.add(blockId);
      syncToDb(next);
      return next;
    });
  }, [syncToDb]);

  const handleUndo = useCallback((blockId: string) => {
    setRejectedBlocks(prev => {
      const next = new Set(prev);
      next.delete(blockId);
      syncToDb(next);
      return next;
    });
  }, [syncToDb]);

  const handleRejectAll = useCallback(() => {
    const next = new Set(allBlockIds);
    setRejectedBlocks(next);
    syncToDb(next);
  }, [allBlockIds, syncToDb]);

  const handleRestoreAll = useCallback(() => {
    if (rejectedBlocks.size > 0) {
      setRejectedBlocks(new Set<string>());
      syncToDb(new Set());
    }
    if (acceptedBlocks.size > 0) {
      setAcceptedBlocks(new Set<string>());
    }
  }, [syncToDb, rejectedBlocks.size, acceptedBlocks.size]);

  const handleAccept = useCallback((blockId: string) => {
    setAcceptedBlocks(prev => {
      const next = new Set(prev);
      next.add(blockId);
      return next;
    });
  }, []);

  const handleUndoAccept = useCallback((blockId: string) => {
    setAcceptedBlocks(prev => {
      const next = new Set(prev);
      next.delete(blockId);
      return next;
    });
  }, []);

  const handleAcceptAll = useCallback(() => {
    const toAccept = allBlockIds.filter(id => !rejectedBlocks.has(id));
    setAcceptedBlocks(prev => {
      const next = new Set(prev);
      toAccept.forEach(id => next.add(id));
      return next;
    });
  }, [allBlockIds, rejectedBlocks]);

  const rejectedCount = allBlockIds.filter(id => rejectedBlocks.has(id)).length;
  const hasAnyRejected = rejectedCount > 0;
  const allRejected = rejectedCount === allBlockIds.length && allBlockIds.length > 0;
  const pendingBlockIds = allBlockIds.filter(id => !rejectedBlocks.has(id));
  const acceptedCount = pendingBlockIds.filter(id => acceptedBlocks.has(id)).length;
  const allAccepted = pendingBlockIds.length > 0 && acceptedCount === pendingBlockIds.length;
  const hasAnyAccepted = acceptedBlocks.size > 0;

  const finalDownloadContent = liveContent || displayContent || '';

  // Build preview content with removed lines shown before Accept
  const previewContentWithDiff = useMemo<{ content: string; lineDiffMap: Map<number, 'added' | 'removed' | 'context'> | null }>(() => {
    if (!allSegments || !finalDownloadContent) {
      return { content: finalDownloadContent, lineDiffMap: null };
    }
    
    const lines: string[] = [];
    const lineDiffMap = new Map<number, 'added' | 'removed' | 'context'>();
    let lineNo = 1;
    
    for (const seg of allSegments) {
      if (seg.type === 'context') {
        for (const line of seg.lines) {
          lines.push(line.content);
          lineDiffMap.set(lineNo, 'context');
          lineNo++;
        }
      } else {
        const block = seg.block;
        const isRejected = rejectedBlocks.has(block.id);
        const isAccepted = acceptedBlocks.has(block.id);
        
        if (isAccepted) {
          // Accepted: only added lines
          for (const line of block.lines) {
            if (line.type === 'added') {
              lines.push(line.content);
              lineDiffMap.set(lineNo, 'added');
              lineNo++;
            }
          }
        } else if (isRejected) {
          // Rejected: only removed lines
          for (const line of block.lines) {
            if (line.type === 'removed') {
              lines.push(line.content);
              lineDiffMap.set(lineNo, 'removed');
              lineNo++;
            }
          }
        } else {
          // Not accepted yet: show removed lines first, then added lines
          for (const line of block.lines) {
            if (line.type === 'removed') {
              lines.push(line.content);
              lineDiffMap.set(lineNo, 'removed');
              lineNo++;
            }
          }
          for (const line of block.lines) {
            if (line.type === 'added') {
              lines.push(line.content);
              lineDiffMap.set(lineNo, 'added');
              lineNo++;
            }
          }
        }
      }
    }
    
    return { content: lines.join('\n'), lineDiffMap };
  }, [allSegments, finalDownloadContent, rejectedBlocks, acceptedBlocks]);

  const previewLineDiffMap = previewContentWithDiff.lineDiffMap;
  const previewContent = previewContentWithDiff.content;

  if (!entry.success && entry.error) return <p className="text-sm text-red-500">{entry.error}</p>;
  if (currentContent === undefined && chatId && entry.path) return <div className="p-4 text-xs text-(--muted)">Loading current file...</div>;

  if (!diffData || !allSegments || typeof displayContent !== 'string') {
    const fallback = displayContent ?? proposedContent ?? entry.input?.content;
    return fallback ? (
      <div>
        <div className="flex items-center gap-2 mb-2">
        <button type="button" onClick={() => navigator.clipboard.writeText(fallback)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-(--muted) hover:text-(--foreground) hover:bg-(--muted/10) transition-all">
          <Copy size={14} /> Copy
        </button>
        <button type="button" onClick={() => { const n = entry.path.replace(/^.*\//, '') || 'download.txt'; const b = new Blob([fallback], { type: 'text/plain;charset=utf-8' }); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = n; a.click(); URL.revokeObjectURL(u); }} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-(--muted) hover:text-(--foreground) hover:bg-(--muted/10) transition-all">
          <Download size={14} /> Download
        </button>
      </div>
        <div className="p-6 rounded-xl border border-[color-mix(in_srgb,var(--foreground)_10%,transparent)] bg-[color-mix(in_srgb,var(--foreground)_2%,transparent)]">
          <CanvasPreviewMarkdown
            content={entry.path?.toLowerCase().endsWith('.md')
              ? fallback
              : `\`\`\`${getLanguageFromPath(entry.path)}\n${fallback}\n\`\`\``}
          />
        </div>
      </div>
    ) : null;
  }

  return (
    <div className="diff-canvas-view">
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        {diffData && (
          <span className="text-xs text-(--muted)">
            <span className="text-green-500">+{diffData.additions}</span>{' '}
            <span className="text-red-400">-{diffData.deletions}</span>
          </span>
        )}
        {isSyncing && <span className="diff-sync-dot" title="Saving..." />}
        <div className="flex-1" />
        <button type="button" className={`diff-btn-action diff-btn-accept-all ${allAccepted || allRejected ? 'diff-btn-disabled' : ''}`} onClick={handleAcceptAll} disabled={allAccepted || allRejected}>
          <Check size={14} /> Accept All
        </button>
        <button type="button" className={`diff-btn-action diff-btn-reject-all ${allRejected || allAccepted ? 'diff-btn-disabled' : ''}`} onClick={handleRejectAll} disabled={allRejected || allAccepted}>
          <X size={14} /> Reject All
        </button>
        <button type="button" className={`diff-btn-action diff-btn-restore ${!hasAnyRejected && !hasAnyAccepted ? 'diff-btn-disabled' : ''}`} onClick={handleRestoreAll} disabled={!hasAnyRejected && !hasAnyAccepted}>
          <RotateCcw size={14} /> Undo All
        </button>
        <button type="button" onClick={() => navigator.clipboard.writeText(finalDownloadContent)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-(--muted) hover:text-(--foreground) hover:bg-(--muted/10) transition-all">
          <Copy size={14} /> Copy
        </button>
        <button
          type="button"
          onClick={() => {
            const name = entry.path.replace(/^.*\//, '') || 'download.txt';
            const blob = new Blob([finalDownloadContent], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = name; a.click();
            URL.revokeObjectURL(url);
          }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-(--muted) hover:text-(--foreground) hover:bg-(--muted/10) transition-all"
        >
          <Download size={14} /> Download
        </button>
      </div>

      <div className="rounded-lg border border-[color-mix(in_srgb,var(--foreground)_10%,transparent)] overflow-hidden">
        <div className="p-6 bg-[color-mix(in_srgb,var(--foreground)_2%,transparent)]">
          <CanvasPreviewMarkdown
            isMainFile={true}
            content={entry.path?.toLowerCase().endsWith('.md')
              ? previewContent
              : `\`\`\`${getLanguageFromPath(entry.path)}\n${previewContent}\n\`\`\``}
            diffSegments={allSegments.length > 0 ? allSegments : undefined}
            previewLineDiffMap={previewLineDiffMap}
            rejectedBlocks={rejectedBlocks}
            acceptedBlocks={acceptedBlocks}
            onReject={handleReject}
            onAccept={handleAccept}
            onUndo={handleUndo}
            onUndoAccept={handleUndoAccept}
          />
        </div>
      </div>

      {entry.truncated && <p className="text-xs text-(--muted) mt-1">Content truncated for display.</p>}
    </div>
  );
}

/**
 * Canvas Component - An integrated container to display multiple tool results
 * Currently shows web search, math calculation, and link reader results, but can easily be extended to other tools in the future
 */
export default function Canvas({ 
  webSearchData, 
  mathCalculationData, 
  linkReaderData, 
  imageGeneratorData, 
  geminiImageData,
  seedreamImageData,
  qwenImageData,
  wan25VideoData,
  grokVideoData,
  twitterSearchData, 
  youTubeSearchData, 
  youTubeLinkAnalysisData,
  googleSearchData,
  fileEditData,
  runCodeData,
  isCompact = false,
  selectedTool,
  selectedItem,
  onSearchFilterChange,
  messageId,
  chatId,
  userId,
}: CanvasProps) {
  // Helper function to get aspect ratio from size string
  const getAspectRatioFromSize = (size?: string): string => {
    if (!size) return '16/9';
    const [width, height] = size.split('*').map(Number);
    if (!width || !height) return '16/9';
    return `${width}/${height}`;
  };

  // Track detected aspect ratios for videos without size parameter
  const [detectedAspectRatios, setDetectedAspectRatios] = useState<Record<number, string>>({});
  // Merge Web Search and Google Search data for unified display
  const mergedSearchData = useMemo(() => {
    const sources = [webSearchData, googleSearchData, twitterSearchData].filter(Boolean);
    if (sources.length === 0) {
      return null;
    }
  
    const allResults: any[] = [];
    const allArgs: any[] = [];
    const allAnnotations: any[] = [];
    let mergedImageMap: Record<string, string> = {};
    let mergedLinkMap: Record<string, string> = {};
    let mergedThumbnailMap: Record<string, string> = {};
    let mergedLinkMetaMap: Record<string, LinkMetaEntry> = {};
  
    sources.forEach((source) => {
      if (!source) return;
      
      if (source.results) {
        allResults.push(...source.results);
      }
      if (source.args) {
        allArgs.push(source.args);
      }
      if (source.annotations) {
        allAnnotations.push(...source.annotations);
      }
      if ((source as any).imageMap) {
        mergedImageMap = { ...mergedImageMap, ...(source as any).imageMap };
      }
      if ((source as any).linkMap) {
        mergedLinkMap = { ...mergedLinkMap, ...(source as any).linkMap };
      }
      if ((source as any).thumbnailMap) {
        mergedThumbnailMap = { ...mergedThumbnailMap, ...(source as any).thumbnailMap };
      }
      if ((source as any).linkMetaMap) {
        mergedLinkMetaMap = { ...mergedLinkMetaMap, ...(source as any).linkMetaMap };
      }
    });
  
    if (allResults.length === 0 && allArgs.length === 0) {
      return null;
    }
  
    const finalData = {
      result: null,
      results: allResults,
      args: allArgs.length > 0 ? allArgs[0] : null,
      annotations: allAnnotations,
      imageMap: mergedImageMap,
      linkMap: mergedLinkMap,
      thumbnailMap: mergedThumbnailMap,
      linkMetaMap: mergedLinkMetaMap
    };
    
    return finalData;
  }, [webSearchData, googleSearchData, twitterSearchData]);

  // Simplified state management - all sections are initially open
  // Only track if data is in "generation complete" state
  const [webSearchExpanded, setWebSearchExpanded] = useState(true);
  const [mathCalcExpanded, setMathCalcExpanded] = useState(true);
  const [linkReaderExpanded, setLinkReaderExpanded] = useState(true);
  const [imageGenExpanded, setImageGenExpanded] = useState(true);
  const [seedreamExpanded, setSeedreamExpanded] = useState(true);
  const [qwenExpanded, setQwenExpanded] = useState(true);
  const [wan25Expanded, setWan25Expanded] = useState(true);
  const [grokExpanded, setGrokExpanded] = useState(true);

  const [youTubeSearchExpanded, setYouTubeSearchExpanded] = useState(true);
  const [youTubeLinkAnalysisExpanded, setYouTubeLinkAnalysisExpanded] = useState(true);
  
  // References for content elements
  const webSearchContentRef = useRef<HTMLDivElement>(null);
  const mathCalcContentRef = useRef<HTMLDivElement>(null);
  const linkReaderContentRef = useRef<HTMLDivElement>(null);
  const imageGenContentRef = useRef<HTMLDivElement>(null);
  const seedreamContentRef = useRef<HTMLDivElement>(null);
  const qwenContentRef = useRef<HTMLDivElement>(null);

  const youTubeSearchContentRef = useRef<HTMLDivElement>(null);
  const youTubeLinkAnalysisContentRef = useRef<HTMLDivElement>(null);
  
  // Simplified height handling - using fixed large height for open sections
  const [isMounted, setIsMounted] = useState(false);

  // Check if we're in browser environment for portal rendering
  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);
  
  // Simplified togglers - only close completed sections, always open if clicked
  const toggleWebSearch = () => setWebSearchExpanded(!webSearchExpanded);
  const toggleMathCalc = () => setMathCalcExpanded(!mathCalcExpanded);
  const toggleLinkReader = () => setLinkReaderExpanded(!linkReaderExpanded);
  const toggleImageGen = () => setImageGenExpanded(!imageGenExpanded);
  const toggleSeedreamImages = () => setSeedreamExpanded(!seedreamExpanded);
  const toggleQwenImages = () => setQwenExpanded(!qwenExpanded);
  const toggleWan25Video = () => setWan25Expanded(!wan25Expanded);
  const toggleGrokVideo = () => setGrokExpanded(!grokExpanded);

  const toggleYouTubeSearch = () => setYouTubeSearchExpanded(!youTubeSearchExpanded);
  const toggleYouTubeLinkAnalysis = () => setYouTubeLinkAnalysisExpanded(!youTubeLinkAnalysisExpanded);
  
  // State for image viewer modal
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(-1);
  const [selectedSourceImageUrl, setSelectedSourceImageUrl] = useState<string | null>(null);
  
  // Save to gallery state
  const [savingImages, setSavingImages] = useState<Set<string>>(new Set());
  const [savedImages, setSavedImages] = useState<Set<string>>(new Set());
  
  // Mobile detection and UI state
  const [isMobile, setIsMobile] = useState(false);
  
  // Mobile swipe state (for Mermaid modal)
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);

  // Image-to-video pending: aspect ratio per tool+index (measured on img load). Keys: wan-0, grok-0, etc.
  const [pendingImageAspectRatios, setPendingImageAspectRatios] = useState<Record<string, number>>({});

  // Mobile detection
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 640); // sm breakpoint
    };
    
    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);
    return () => window.removeEventListener('resize', checkIfMobile);
  }, []);

  // Mobile touch handlers (for Mermaid modal)

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isMobile) return;
    
    const touch = e.touches[0];
    setTouchStart({ x: touch.clientX, y: touch.clientY });
    setTouchEnd(null);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isMobile) return;
    
    const touch = e.touches[0];
    setTouchEnd({ x: touch.clientX, y: touch.clientY });
  };

  // Touch handlers는 ImageModal 내부에서 처리

  // Keyboard navigation은 ImageModal 내부에서 처리

  // Image viewer functions
  const openImageViewer = (index: number) => {
    setSelectedImageIndex(index);
    setSelectedSourceImageUrl(null); // 소스 이미지 상태 초기화
  };
  
  const closeImageViewer = () => {
    setSelectedImageIndex(-1);
    setSelectedSourceImageUrl(null);
  };


  const saveImageToGallery = async (imageUrl: string) => {
    setSavingImages(prev => new Set(prev).add(imageUrl));
    try {
      const response = await fetch('/api/photo/save-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl })
      });
      if (response.ok) {
        setSavedImages(prev => new Set(prev).add(imageUrl));
      } else {
        const error = await response.json();
        console.error('Save failed:', error);
      }
    } catch (error) {
      console.error('Save error:', error);
    } finally {
      setSavingImages(prev => {
        const next = new Set(prev);
        next.delete(imageUrl);
        return next;
      });
    }
  };

  // Helper function to determine if data is still being generated
  const isGenerating = (data: any) => {
    if (!data) return false;
    return data.isGenerating === true || data.isProgress === true;
  };

  const sortImagesByOrder = useCallback((images: any[]) => {
    return images
      .map((image, index) => ({ image, index }))
      .sort((a, b) => {
        const orderA = a.image.partIndex ?? a.image.contentIndex ?? (a.image.timestamp ? new Date(a.image.timestamp).getTime() : Number.POSITIVE_INFINITY);
        const orderB = b.image.partIndex ?? b.image.contentIndex ?? (b.image.timestamp ? new Date(b.image.timestamp).getTime() : Number.POSITIVE_INFINITY);
        if (orderA !== orderB) return orderA - orderB;
        return a.index - b.index;
      })
      .map(({ image }) => image);
  }, []);

  const orderedImageGeneratorImages = useMemo(
    () => sortImagesByOrder(imageGeneratorData?.generatedImages || []),
    [imageGeneratorData?.generatedImages, sortImagesByOrder]
  );
  const orderedGeminiImages = useMemo(
    () => sortImagesByOrder(geminiImageData?.generatedImages || []),
    [geminiImageData?.generatedImages, sortImagesByOrder]
  );
  const orderedSeedreamImages = useMemo(
    () => sortImagesByOrder(seedreamImageData?.generatedImages || []),
    [seedreamImageData?.generatedImages, sortImagesByOrder]
  );
  const orderedQwenImages = useMemo(
    () => sortImagesByOrder(qwenImageData?.generatedImages || []),
    [qwenImageData?.generatedImages, sortImagesByOrder]
  );
  const orderedAllImages = useMemo(
    () => [...orderedImageGeneratorImages, ...orderedGeminiImages, ...orderedSeedreamImages, ...orderedQwenImages],
    [orderedImageGeneratorImages, orderedGeminiImages, orderedSeedreamImages, orderedQwenImages]
  );
  
  // 이미지를 ImageModalImage 형식으로 변환
  const galleryImages: ImageModalImage[] = useMemo(() => {
    return orderedAllImages.map(img => ({
      src: img.imageUrl,
      alt: img.prompt || 'Generated image',
      prompt: img.prompt,
      sourceImageUrl: img.originalImageUrl
    }));
  }, [orderedAllImages]);
  
  // 현재 이미지 정보
  const currentImage = useMemo(() => {
    return selectedImageIndex >= 0 && selectedImageIndex < orderedAllImages.length 
      ? orderedAllImages[selectedImageIndex] 
      : null;
  }, [selectedImageIndex, orderedAllImages]);


  // Prompt handlers는 ImageModal 내부에서 처리
  const currentPrompt = useMemo(() => {
    if (selectedImageIndex < 0 || !currentImage) return undefined;
    return currentImage.prompt;
  }, [selectedImageIndex, currentImage]);
  
  // 저장 핸들러 (Set 기반). ImageModal에서 { imageUrl, prompt?, sourceImageUrl?, originalSrc? } 페이로드로 호출.
  const handleSave = useCallback(async (payload: { imageUrl: string; prompt?: string | null; sourceImageUrl?: string | null; originalSrc?: string }) => {
    const imageUrl = payload.imageUrl;
    const setKey = payload.originalSrc ?? imageUrl;
    if (savingImages.has(setKey) || savedImages.has(setKey)) return;
    setSavingImages(prev => new Set(prev).add(setKey));
    try {
      const imageToSave = orderedAllImages.find(img => img.imageUrl === (payload.originalSrc ?? imageUrl));
      const promptToSave = payload.prompt ?? imageToSave?.prompt ?? currentPrompt;
      const sourceImageUrl = payload.sourceImageUrl ?? imageToSave?.originalImageUrl;

      const response = await fetch('/api/photo/save-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl,
          prompt: promptToSave || null,
          ai_prompt: null,
          ai_json_prompt: null,
          chatId: chatId || null,
          messageId: messageId || null,
          metadata: { sourceImageUrl: sourceImageUrl || null }
        })
      });
      if (response.ok) {
        setSavedImages(prev => new Set(prev).add(setKey));
      } else {
        const error = await response.json();
        console.error('Save failed:', error);
      }
    } catch (error) {
      console.error('Save error:', error);
    } finally {
      setSavingImages(prev => {
        const next = new Set(prev);
        next.delete(setKey);
        return next;
      });
    }
  }, [savingImages, savedImages, orderedAllImages, currentPrompt, chatId, messageId]);
  
  const navigateImage = (direction: 'prev' | 'next') => {
    if (orderedAllImages.length === 0) return;
    
    const count = orderedAllImages.length;
    const newIndex = direction === 'next' 
      ? (selectedImageIndex + 1) % count 
      : (selectedImageIndex - 1 + count) % count;
    
    setSelectedImageIndex(newIndex);
  };

  // Don't render if there's no data to display
  const shouldRender = !!(mergedSearchData || mathCalculationData || linkReaderData || imageGeneratorData || geminiImageData || seedreamImageData || qwenImageData || wan25VideoData || grokVideoData || youTubeSearchData || youTubeLinkAnalysisData || fileEditData || runCodeData);
  
  if (!shouldRender) {
    return null;
  }

  // 컴팩트 모드일 때 적용할 추가 클래스
  const compactModeClasses = isCompact ? 'my-2 space-y-2' : 'my-4 space-y-4';
  
  // 컴팩트 모드에서 컨텐츠 최대 높이 설정 (메시지 내에서 너무 길어지지 않도록)
  const maxContentHeight = isCompact ? '300px' : '5000px';
  const headerClasses = isCompact ? 'mb-2' : 'mb-4';

  return (
    <div className={`tool-results-canvas ${compactModeClasses}`}>
      <style>{`
        @keyframes shimmer {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }
      `}</style>
      {/* Unified Search Results (Web Search + Google Search + Twitter Search) */}
           {(!selectedTool || selectedTool.startsWith?.('web-search') || selectedTool === 'google-search' || selectedTool.startsWith?.('google-search:topic:') || selectedTool === 'google-images' || selectedTool === 'google-videos' || selectedTool === 'twitter_search') && mergedSearchData && (
        <div className="">
          {!selectedTool && (
          <div 
            className={`flex items-center justify-between w-full ${headerClasses} cursor-pointer`}
            onClick={toggleWebSearch}
          >
            <div className="flex items-center gap-2.5">
              {(() => {
                     // Check if this is specifically Google Images or Google Videos from selectedTool
                     if (selectedTool === 'google-images' || selectedTool === 'google-search:topic:google_images') {
                       return (
                         <>
                           <ImageIcon className="h-4 w-4 text-(--foreground)" strokeWidth={1.5} />
                           <h2 className="font-medium text-left tracking-tight">Google Images</h2>
                         </>
                       );
                     }
                     
                     if (selectedTool === 'google-videos' || selectedTool === 'google-search:topic:google_videos') {
                       return (
                         <>
                           <Video className="h-4 w-4 text-(--foreground)" strokeWidth={1.5} />
                           <h2 className="font-medium text-left tracking-tight">Google Videos</h2>
                         </>
                       );
                     }
                
                     // Check if this is primarily Google Images or Google Videos search from data
                     const allSearches = (mergedSearchData.results || []).flatMap((r: any) => r.searches || []);
                     const hasGoogleImages = allSearches.some((s: any) => s?.topic === 'google_images' || s?.engine === 'google_images');
                     const hasGoogleVideos = allSearches.some((s: any) => s?.topic === 'google_videos' || s?.engine === 'google_videos');
                     const hasOnlyGoogleImages = allSearches.every((s: any) => s?.topic === 'google_images' || s?.engine === 'google_images');
                     const hasOnlyGoogleVideos = allSearches.every((s: any) => s?.topic === 'google_videos' || s?.engine === 'google_videos');
                
                     if (hasOnlyGoogleImages && hasGoogleImages) {
                       return (
                         <>
                           <ImageIcon className="h-4 w-4 text-(--foreground)" strokeWidth={1.5} />
                           <h2 className="font-medium text-left tracking-tight">Google Images</h2>
                         </>
                       );
                     } else if (hasOnlyGoogleVideos && hasGoogleVideos) {
                       return (
                         <>
                           <Video className="h-4 w-4 text-(--foreground)" strokeWidth={1.5} />
                           <h2 className="font-medium text-left tracking-tight">Google Videos</h2>
                         </>
                       );
                     } else if (hasGoogleImages || hasGoogleVideos) {
                  return (
                    <>
                      <Search className="h-4 w-4 text-(--foreground)" strokeWidth={1.5} />
                      <h2 className="font-medium text-left tracking-tight">Searches</h2>
                    </>
                  );
                } else {
                  return (
                    <>
                      <Search className="h-4 w-4 text-(--foreground)" strokeWidth={1.5} />
                      <h2 className="font-medium text-left tracking-tight">Searches</h2>
                    </>
                  );
                }
              })()}
            </div>
            <div className="flex items-center gap-2">
              <div className="rounded-full p-1 hover:bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] transition-colors">
                {webSearchExpanded ? 
                  <ChevronUp size={16} className="text-[color-mix(in_srgb,var(--foreground)_50%,transparent)]" /> : 
                  <ChevronDown size={16} className="text-[color-mix(in_srgb,var(--foreground)_50%,transparent)]" />
                }
              </div>
            </div>
          </div>
          )}
          <div 
            className={selectedTool ? '' : 'overflow-hidden transition-all duration-200 ease-in-out'}
            style={selectedTool ? {} : { 
              maxHeight: webSearchExpanded ? maxContentHeight : '0px',
            }}
          >
            <div
              ref={webSearchContentRef}
              className={selectedTool ? '' : 'transition-opacity duration-200 ease-in-out'}
              style={selectedTool ? {} : {
                opacity: webSearchExpanded ? 1 : 0,
                scrollbarWidth: 'none',
                msOverflowStyle: 'none'
              }}
            >
              <style jsx>{`
                div::-webkit-scrollbar {
                  display: none;
                }
              `}</style>
              <MultiSearch 
                result={mergedSearchData.result} 
                args={mergedSearchData.args}
                annotations={mergedSearchData.annotations}
                results={mergedSearchData.results}
                linkMetaMap={mergedSearchData.linkMetaMap}
                onFilterChange={onSearchFilterChange}
                {...(() => {
                  // If selectedItem is provided, highlight only that specific query
                  if (selectedItem && selectedTool && (selectedTool.startsWith?.('web-search') || selectedTool.startsWith?.('google-search') || selectedTool === 'twitter_search' || selectedTool === 'google-search')) {
                    return { highlightedQueries: [selectedItem], initialAllSelected: false };
                  }
                  
                  // Handle both web-search and google-search topic filtering
                  if (selectedTool && (selectedTool.startsWith?.('web-search:topic:') || selectedTool.startsWith?.('google-search:topic:'))) {
                    const topic = selectedTool.split(':').pop();
                    // Gather all search entries across web & google data
                    const allSearches = (mergedSearchData.results || []).flatMap((r: any) => r.searches || []);
                    const uniqueTopics = new Set(
                      allSearches
                        .map((s: any) => s?.topic)
                        .filter(Boolean)
                    );
                    if (uniqueTopics.size === 1) {
                      return { highlightedQueries: [], initialAllSelected: true };
                    }

                    // Highlight only queries belonging to the selected topic
                    const searches = allSearches.filter((s: any) => (s as any).topic === topic);
                    const dedupeQueries = (items: any[]) =>
                      Array.from(
                        new Set(
                          items
                            .map((s: any) => s?.query)
                            .filter(Boolean)
                        )
                      );

                    let relevantQueries: string[] = [];

                    if (topic === 'google' || topic === 'google_images' || topic === 'google_videos') {
                      // For Google search topics, use queries from topic-specific results (already filtered above)
                      relevantQueries = dedupeQueries(searches);
                    } else {
                      // For web search topics (GitHub, research paper, etc.), use topic-specific queries
                      relevantQueries = dedupeQueries(searches);
                    }

                    return { highlightedQueries: relevantQueries, initialAllSelected: false };
              } else if (selectedTool === 'twitter_search') {
                const allSearches = (mergedSearchData.results || []).flatMap((r: any) => r.searches || []);
                const dedupeQueries = (items: any[]) =>
                  Array.from(
                    new Set(
                      items
                        .map((s: any) => s?.query)
                        .filter(Boolean)
                    )
                  );
                const twitterQueries = dedupeQueries(
                  allSearches.filter((s: any) => (s as any).topic === 'twitter')
                );
                return { highlightedQueries: twitterQueries, initialAllSelected: twitterQueries.length === 0 };
                  }
                  return { highlightedQueries: [], initialAllSelected: false };
                })()}
              />
            </div>
          </div>
        </div>
      )}
      
      {/* Math Calculation Results */}
      {(!selectedTool || selectedTool === 'calculator') && mathCalculationData && (
        <div className="">
          {!selectedTool && (
          <div 
            className={`flex items-center justify-between w-full ${headerClasses} cursor-pointer`}
            onClick={toggleMathCalc}
          >
            <div className="flex items-center gap-2.5">
              <Calculator className="h-4 w-4 text-(--foreground)" strokeWidth={1.5} />
              <h2 className="font-medium text-left tracking-tight">Math Calculation</h2>
            </div>
            <div className="flex items-center gap-2">
              <div className="rounded-full p-1 hover:bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] transition-colors">
                {mathCalcExpanded ? 
                  <ChevronUp size={16} className="text-[color-mix(in_srgb,var(--foreground)_50%,transparent)]" /> : 
                  <ChevronDown size={16} className="text-[color-mix(in_srgb,var(--foreground)_50%,transparent)]" />
                }
              </div>
            </div>
          </div>
          )}
          <div 
            className={selectedTool ? '' : 'overflow-hidden transition-all duration-200 ease-in-out'}
            style={selectedTool ? {} : { 
              maxHeight: mathCalcExpanded ? maxContentHeight : '0px',
            }}
          >
            <div
              ref={mathCalcContentRef}
              className={selectedTool ? '' : 'transition-opacity duration-200 ease-in-out'}
              style={selectedTool ? {} : {
                opacity: mathCalcExpanded ? 1 : 0,
                scrollbarWidth: 'none',
                msOverflowStyle: 'none'
              }}
            >
              <style jsx>{`
                div::-webkit-scrollbar {
                  display: none;
                }
              `}</style>
              <MathCalculation
                calculationSteps={mathCalculationData.calculationSteps}
                selectedExpression={selectedTool === 'calculator' && selectedItem ? selectedItem : undefined}
              />
            </div>
          </div>
        </div>
      )}
      
      {/* Link Reader Results */}
      {(!selectedTool || selectedTool === 'link-reader') && linkReaderData && (
        <div className="">
          {!selectedTool && (
          <div 
            className={`flex items-center justify-between w-full ${headerClasses} cursor-pointer`}
            onClick={toggleLinkReader}
          >
            <div className="flex items-center gap-2.5">
              <Link2 className="h-4 w-4 text-(--foreground)" strokeWidth={1.5} />
              <h2 className="font-medium text-left tracking-tight">Link Reading</h2>
            </div>
            <div className="flex items-center gap-2">
              <div className="rounded-full p-1 hover:bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] transition-colors">
                {linkReaderExpanded ? 
                  <ChevronUp size={16} className="text-[color-mix(in_srgb,var(--foreground)_50%,transparent)]" /> : 
                  <ChevronDown size={16} className="text-[color-mix(in_srgb,var(--foreground)_50%,transparent)]" />
                }
              </div>
            </div>
          </div>
          )}
          <div 
            className={selectedTool ? '' : 'overflow-hidden transition-all duration-200 ease-in-out'}
            style={selectedTool ? {} : { 
              maxHeight: linkReaderExpanded ? maxContentHeight : '0px',
            }}
          >
            <div
              ref={linkReaderContentRef}
              className={selectedTool ? '' : 'transition-opacity duration-200 ease-in-out'}
              style={selectedTool ? {} : {
                opacity: linkReaderExpanded ? 1 : 0,
                scrollbarWidth: 'none',
                msOverflowStyle: 'none'
              }}
            >
              <style jsx>{`
                div::-webkit-scrollbar {
                  display: none;
                }
              `}</style>
              <LinkReader
                linkAttempts={linkReaderData.linkAttempts}
                rawContent={linkReaderData.rawContent}
                selectedUrl={selectedTool === 'link-reader' && selectedItem ? selectedItem : undefined}
              />
            </div>
          </div>
        </div>
      )}

      {/* Image Generator Results */}
      {(!selectedTool || selectedTool === 'image-generator') && imageGeneratorData && imageGeneratorData.generatedImages.length > 0 && (
        <div className="">
          {!selectedTool && (
          <div 
            className={`flex items-center justify-between w-full ${headerClasses} cursor-pointer`}
            onClick={toggleImageGen}
          >
            <div className="flex items-center gap-2.5">
              <ImageIcon className="h-4 w-4 text-(--foreground)" strokeWidth={1.5} />
              <h2 className="font-medium text-left tracking-tight">Generated Images</h2>
            </div>
            <div className="flex items-center gap-2">
              <div className="rounded-full p-1 hover:bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] transition-colors">
                {imageGenExpanded ? 
                  <ChevronUp size={16} className="text-[color-mix(in_srgb,var(--foreground)_50%,transparent)]" /> : 
                  <ChevronDown size={16} className="text-[color-mix(in_srgb,var(--foreground)_50%,transparent)]" />
                }
              </div>
            </div>
          </div>
          )}
          <div 
            className={selectedTool ? '' : 'overflow-hidden transition-all duration-200 ease-in-out'}
            style={selectedTool ? {} : { 
              maxHeight: imageGenExpanded ? maxContentHeight : '0px',
            }}
          >
            <div
              ref={imageGenContentRef}
              className={selectedTool ? 'p-1' : 'transition-opacity duration-200 ease-in-out p-1'}
              style={selectedTool ? {} : {
                opacity: imageGenExpanded ? 1 : 0,
                scrollbarWidth: 'none',
                msOverflowStyle: 'none'
              }}
            >
              <style jsx>{`
                div::-webkit-scrollbar {
                  display: none;
                }
              `}</style>
              {orderedImageGeneratorImages.length > 0 && (
                <ImageGalleryStack
                  images={orderedImageGeneratorImages.map((image) => ({
                    src: image.imageUrl,
                    alt: image.prompt || 'Generated image',
                    prompt: image.prompt
                  }))}
                  onSingleImageClick={(src, alt, allImages, index) => {
                    openImageViewer(index);
                  }}
                  isMobile={isMobile}
                  chatId={chatId}
                  messageId={messageId}
                />
              )}
            </div>
          </div>
        </div>
      )}
      

      
      {/* YouTube Search Results */}
      {(!selectedTool || selectedTool === 'youtube-search') && youTubeSearchData && (
        <div className="">
          {!selectedTool && (
          <div 
            className={`flex items-center justify-between w-full ${headerClasses} cursor-pointer`}
            onClick={toggleYouTubeSearch}
          >
            <div className="flex items-center gap-2.5">
              <YouTubeLogo className="h-4 w-4 text-(--foreground)" strokeWidth={1.5} />
              <h2 className="font-medium text-left tracking-tight">YouTube Search</h2>
            </div>
            <div className="flex items-center gap-2">
              <div className="rounded-full p-1 hover:bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] transition-colors">
                {youTubeSearchExpanded ? 
                  <ChevronUp size={16} className="text-[color-mix(in_srgb,var(--foreground)_50%,transparent)]" /> : 
                  <ChevronDown size={16} className="text-[color-mix(in_srgb,var(--foreground)_50%,transparent)]" />
                }
              </div>
            </div>
          </div>
          )}
          <div 
            className={selectedTool ? '' : 'overflow-hidden transition-all duration-200 ease-in-out'}
            style={selectedTool ? {} : { 
              maxHeight: youTubeSearchExpanded ? maxContentHeight : '0px',
            }}
          >
            <div
              ref={youTubeSearchContentRef}
              className={selectedTool ? 'space-y-6' : 'transition-opacity duration-200 ease-in-out space-y-6'}
              style={selectedTool ? {} : {
                opacity: youTubeSearchExpanded ? 1 : 0,
                scrollbarWidth: 'none',
                msOverflowStyle: 'none'
              }}
            >
              <style jsx>{`
                div::-webkit-scrollbar {
                  display: none;
                }
              `}</style>
              {/* Loading state when processing */}
              {(((youTubeSearchData as any).status === 'processing' || (youTubeSearchData as any).pendingCount > 0) && 
                (!youTubeSearchData.youtubeResults || youTubeSearchData.youtubeResults.length === 0)) && (
                <div className="space-y-4">
                  <div className="border border-[color-mix(in_srgb,var(--foreground)_7%,transparent)] rounded-xl overflow-hidden shadow-sm bg-[color-mix(in_srgb,var(--foreground)_2%,transparent)] relative min-h-[300px]">
                    {/* Background placeholder */}
                    <div className="absolute inset-0 bg-linear-to-br from-[color-mix(in_srgb,var(--foreground)_5%,transparent)] via-[color-mix(in_srgb,var(--foreground)_3%,transparent)] to-[color-mix(in_srgb,var(--foreground)_5%,transparent)]" />
                    
                    {/* Loading overlay */}
                    <div className="prompt-overlay absolute inset-0 bg-black/75 backdrop-blur-md text-white p-6 flex flex-col justify-center items-center text-center opacity-100 transition-opacity duration-300 overflow-auto pointer-events-none z-20">
                      <div 
                        className="text-base md:text-lg font-medium"
                        style={{
                          background: 'linear-gradient(90deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.9) 25%, rgba(255,255,255,0.3) 50%, rgba(255,255,255,0.9) 75%, rgba(255,255,255,0.3) 100%)',
                          backgroundSize: '200% 100%',
                          backgroundClip: 'text',
                          WebkitBackgroundClip: 'text',
                          color: 'transparent',
                          animation: 'shimmer-text-strong 1.5s ease-in-out infinite'
                        }}
                      >
                        Searching YouTube videos...
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {/* Results display */}
              {youTubeSearchData.youtubeResults && youTubeSearchData.youtubeResults.length > 0 && (
                youTubeSearchData.youtubeResults.map((searchResult, index) => (
                  <div key={index} className="space-y-4">
                    <div className="text-sm font-medium text-[color-mix(in_srgb,var(--foreground)_90%,transparent)]">
                      Search: <span className="italic">"{searchResult.query}"</span>
                    </div>
                    
                    {/* Video display section */}
                    <div className="mb-4">
                      {/* Videos with embedded rendering if videoId exists */}
                      <div className="grid grid-cols-1 gap-4">
                        {searchResult.results.map((video, videoIndex) => (
                          <div key={videoIndex} className="w-full overflow-hidden transition-all hover:shadow-md rounded-lg">
                            {video.videoId ? (
                              // If videoId is available, use the YouTube video component
                              <div className="w-full [&>div]:w-full [&>div]:mx-auto rounded-lg overflow-hidden [&_a]:text-[color-mix(in_srgb,var(--foreground)_75%,transparent)]! [&_a:hover]:text-[color-mix(in_srgb,var(--foreground)_90%,transparent)]! [&_.react-tweet-theme]:bg-[color-mix(in_srgb,var(--background)_97%,var(--foreground)_3%)]! dark:[&_.react-tweet-theme]:bg-[color-mix(in_srgb,var(--background)_97%,var(--foreground)_3%)]! [&_.react-tweet-border]:border-[color-mix(in_srgb,var(--foreground)_5%,transparent)]! [&_hr]:border-[color-mix(in_srgb,var(--foreground)_5%,transparent)]! [&_div[data-separator]]:border-[color-mix(in_srgb,var(--foreground)_5%,transparent)]! [&_.react-tweet-header-border]:border-[color-mix(in_srgb,var(--foreground)_5%,transparent)]! [&_.react-tweet-footer-border]:border-[color-mix(in_srgb,var(--foreground)_5%,transparent)]! **:border-[color-mix(in_srgb,var(--foreground)_5%,transparent)]!">
                                <YouTubeVideo videoId={video.videoId} video={video.details || video} />
                              </div>
                            ) : (
                              // Fallback to text representation if no videoId
                              <div className="p-3 border border-[color-mix(in_srgb,var(--foreground)_5%,transparent)] rounded-lg bg-[color-mix(in_srgb,var(--foreground)_1%,transparent)] hover:bg-[color-mix(in_srgb,var(--foreground)_2%,transparent)] transition-colors">
                                <div className="flex gap-2 mb-1">
                                  <span className="text-sm font-medium">{video.details?.title || "Untitled Video"}</span>
                                  {video.details?.publishDate && <span className="text-xs text-[color-mix(in_srgb,var(--foreground)_60%,transparent)]">{video.details.publishDate}</span>}
                                </div>
                                <p className="text-sm whitespace-pre-wrap text-[color-mix(in_srgb,var(--foreground)_75%,transparent)] my-1">
                                  {video.details?.description || "No description available"}
                                </p>
                                {video.url && (
                                  <a 
                                    href={video.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-[color-mix(in_srgb,var(--foreground)_75%,transparent)] hover:text-[color-mix(in_srgb,var(--foreground)_90%,transparent)] hover:underline mt-2 inline-flex items-center gap-1"
                                  >
                                    <span>View video</span>
                                    <ExternalLink size={12} />
                                  </a>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* YouTube Link Analysis Results */}
      {(!selectedTool || selectedTool === 'youtube-analyzer') && youTubeLinkAnalysisData && (
        <div className="">
          {!selectedTool && (
          <div 
            className={`flex items-center justify-between w-full ${headerClasses} cursor-pointer`}
            onClick={toggleYouTubeLinkAnalysis}
          >
            <div className="flex items-center gap-2.5">
              <YouTubeLogo className="h-4 w-4 text-(--foreground)" strokeWidth={1.5} />
              <h2 className="font-medium text-left tracking-tight">YouTube Analysis</h2>
            </div>
            <div className="flex items-center gap-2">
              <div className="rounded-full p-1 hover:bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] transition-colors">
                {youTubeLinkAnalysisExpanded ? 
                  <ChevronUp size={16} className="text-[color-mix(in_srgb,var(--foreground)_50%,transparent)]" /> : 
                  <ChevronDown size={16} className="text-[color-mix(in_srgb,var(--foreground)_50%,transparent)]" />
                }
              </div>
            </div>
          </div>
          )}
          <div 
            className={selectedTool ? '' : 'overflow-hidden transition-all duration-200 ease-in-out'}
            style={selectedTool ? {} : { 
              maxHeight: youTubeLinkAnalysisExpanded ? maxContentHeight : '0px',
            }}
          >
            <div
              ref={youTubeLinkAnalysisContentRef}
              className={selectedTool ? 'space-y-6' : 'transition-opacity duration-200 ease-in-out space-y-6'}
              style={selectedTool ? {} : {
                opacity: youTubeLinkAnalysisExpanded ? 1 : 0,
                scrollbarWidth: 'none',
                msOverflowStyle: 'none'
              }}
            >
              <style jsx>{`
                div::-webkit-scrollbar {
                  display: none;
                }
              `}</style>
              {/* Loading state when processing */}
              {(((youTubeLinkAnalysisData as any).status === 'processing' || (youTubeLinkAnalysisData as any).pendingCount > 0) && 
                (!youTubeLinkAnalysisData.analysisResults || youTubeLinkAnalysisData.analysisResults.length === 0)) && (
                <div className="space-y-4">
                  <div className="border border-[color-mix(in_srgb,var(--foreground)_7%,transparent)] rounded-xl overflow-hidden shadow-sm bg-[color-mix(in_srgb,var(--foreground)_2%,transparent)] relative min-h-[300px]">
                    {/* Background placeholder */}
                    <div className="absolute inset-0 bg-linear-to-br from-[color-mix(in_srgb,var(--foreground)_5%,transparent)] via-[color-mix(in_srgb,var(--foreground)_3%,transparent)] to-[color-mix(in_srgb,var(--foreground)_5%,transparent)]" />
                    
                    {/* Loading overlay */}
                    <div className="prompt-overlay absolute inset-0 bg-black/75 backdrop-blur-md text-white p-6 flex flex-col justify-center items-center text-center opacity-100 transition-opacity duration-300 overflow-auto pointer-events-none z-20">
                      <div 
                        className="text-base md:text-lg font-medium"
                        style={{
                          background: 'linear-gradient(90deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.9) 25%, rgba(255,255,255,0.3) 50%, rgba(255,255,255,0.9) 75%, rgba(255,255,255,0.3) 100%)',
                          backgroundSize: '200% 100%',
                          backgroundClip: 'text',
                          WebkitBackgroundClip: 'text',
                          color: 'transparent',
                          animation: 'shimmer-text-strong 1.5s ease-in-out infinite'
                        }}
                      >
                        Analyzing YouTube video...
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {/* Results display */}
              {youTubeLinkAnalysisData.analysisResults && youTubeLinkAnalysisData.analysisResults.length > 0 && (
                youTubeLinkAnalysisData.analysisResults.map((result, index) => (
                  <div key={index} className="space-y-4">
                    {result.error ? (
                      <div className="flex items-center gap-2 text-red-500 text-sm">
                        <AlertTriangle size={16} />
                        <span>Error: {result.error}</span>
                      </div>
                    ) : (
                      <>
                        <div className="rounded-lg overflow-hidden shadow-sm border border-[color-mix(in_srgb,var(--foreground)_7%,transparent)]">
                          <YouTubeVideo 
                            videoId={result.videoId} 
                            video={{
                              title: result.details?.title,
                              description: result.details?.description,
                              publishDate: result.details?.publishedTime,
                              viewCount: result.details?.views,
                              duration: result.details?.duration ? `${Math.floor(result.details.duration / 60)}:${(result.details.duration % 60).toString().padStart(2, '0')}` : undefined,
                              channelName: result.channel?.name
                            }} 
                          />
                        </div>
                        
                        {result.transcript && (
                          <div className="text-sm mt-4">
                            <div className="font-medium mb-2">Transcript ({result.transcript.language}):</div>
                            <div className="max-h-60 overflow-y-auto p-3 rounded-md bg-[color-mix(in_srgb,var(--foreground)_3%,transparent)] text-[color-mix(in_srgb,var(--foreground)_80%,transparent)]">
                              {result.transcript.segments.map((segment, i) => (
                                <div key={i} className="mb-2">
                                  <span className="inline-block w-12 text-[color-mix(in_srgb,var(--foreground)_60%,transparent)]">[{segment.timestamp}]</span>
                                  <span>{segment.text}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {result.transcriptError && (
                          <div className="text-sm text-red-500 mt-2">
                            Transcript error: {result.transcriptError}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Gemini Image Results */}
      {(!selectedTool || selectedTool === 'gemini-image') && geminiImageData && (
        <div className="">
          {!selectedTool && (
          <div 
            className={`flex items-center justify-between w-full ${headerClasses} cursor-pointer`}
            onClick={toggleImageGen}
          >
            <div className="flex items-center gap-2.5">
                <SiGoogle className="h-4 w-4 text-(--foreground)" />
                <h2 className="font-medium text-left tracking-tight">Gemini Images</h2>
              </div>
            <div className="flex items-center gap-2">
              <div className="rounded-full p-1 hover:bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] transition-colors">
                {imageGenExpanded ? 
                  <ChevronUp size={16} className="text-[color-mix(in_srgb,var(--foreground)_50%,transparent)]" /> : 
                  <ChevronDown size={16} className="text-[color-mix(in_srgb,var(--foreground)_50%,transparent)]" />
                }
              </div>
            </div>
          </div>
          )}
          <div 
            className={selectedTool ? '' : 'overflow-hidden transition-all duration-200 ease-in-out'}
            style={selectedTool ? {} : { 
              maxHeight: imageGenExpanded ? maxContentHeight : '0px',
            }}
          >
            <div
              ref={imageGenContentRef}
              className={selectedTool ? 'p-1' : 'transition-opacity duration-200 ease-in-out p-1'}
              style={selectedTool ? {} : {
                opacity: imageGenExpanded ? 1 : 0,
                scrollbarWidth: 'none',
                msOverflowStyle: 'none'
              }}
            >
              <style jsx>{`
                div::-webkit-scrollbar {
                  display: none;
                }
              `}</style>
              {/* Render completed images with ImageGalleryStack */}
              {orderedGeminiImages.length > 0 && (
                <ImageGalleryStack
                  images={orderedGeminiImages.map((image) => ({
                    src: image.imageUrl,
                    alt: image.prompt || 'Generated image',
                    prompt: image.prompt,
                    sourceImageUrl: image.originalImageUrl
                  }))}
                  onSingleImageClick={(src, alt, allImages, index) => {
                    const globalIndex = orderedImageGeneratorImages.length + index;
                    openImageViewer(globalIndex);
                  }}
                  isMobile={isMobile}
                  chatId={chatId}
                  messageId={messageId}
                />
              )}
              {/* Render placeholders for pending images */}
              {(geminiImageData as any).pendingCount > 0 && ((geminiImageData as any).pendingItems?.length > 0 || (geminiImageData as any).pendingPrompts?.length > 0) && (
                <div className={`grid gap-5 ${orderedGeminiImages.length > 0 ? 'mt-5' : ''} ${
                  ((geminiImageData as any).startedCount || geminiImageData.generatedImages?.length || 0) === 1 
                    ? 'grid-cols-1' 
                    : 'grid-cols-1 sm:grid-cols-2'
                }`}>
                  {/* 🔥 pendingItems가 있으면 사용 (인덱스 기반 매칭), 없으면 pendingPrompts 사용 (레거시) */}
                  {((geminiImageData as any).pendingItems?.length > 0 || (geminiImageData as any).pendingPrompts?.length > 0) ? (
                    ((geminiImageData as any).pendingItems || (geminiImageData as any).pendingPrompts?.map((p: string, i: number) => ({ prompt: p, index: i }))).map((pendingItem: any, idx: number) => {
                    const prompt = pendingItem.prompt || pendingItem;
                    const itemIndex = pendingItem.index ?? idx;
                    
                    // 🔥 인덱스 기반 매칭으로 변경 (프롬프트 매칭 대신)
                    const failedImages = (geminiImageData as any).failedImages || [];
                    // 인덱스로 먼저 매칭, 없으면 프롬프트로 폴백
                    const failedImage = failedImages.find((f: any) => f.index === itemIndex) || 
                                       failedImages.find((f: any) => f.prompt === prompt && !failedImages.some((ff: any) => ff.index !== undefined));
                    const isFailed = !!failedImage;
                    
                    // Check if this is an edit operation
                    // 🔥 pendingItem에서 editImageUrl 직접 가져오기 (있으면), 없으면 레거시 배열에서
                    const pendingEditImageUrls = (geminiImageData as any).pendingEditImageUrls || [];
                    const editImageUrl = pendingItem.editImageUrl || pendingEditImageUrls[itemIndex];
                    const isEditMode = !!editImageUrl;
                    
                    // Get the original image URL (should be resolved URL from server)
                    let originalImageUrl: string | undefined;
                    if (isEditMode && editImageUrl) {
                      // editImageUrl should now be the resolved URL from server
                      if (typeof editImageUrl === 'string' && (editImageUrl.startsWith('http://') || editImageUrl.startsWith('https://'))) {
                        // Direct URL (resolved from server)
                        originalImageUrl = editImageUrl;
                      } else if (Array.isArray(editImageUrl) && editImageUrl.length > 0) {
                        // Array of URLs - use first one
                        const firstUrl = editImageUrl[0];
                        if (typeof firstUrl === 'string' && (firstUrl.startsWith('http://') || firstUrl.startsWith('https://'))) {
                          originalImageUrl = firstUrl;
                        }
                      } else if (typeof editImageUrl === 'string' && editImageUrl.startsWith('generated_image_')) {
                        // Fallback: if still a reference, try to resolve from generated images
                        const allGeneratedImages = [
                          ...(imageGeneratorData?.generatedImages || []),
                          ...(geminiImageData?.generatedImages || []),
                          ...(seedreamImageData?.generatedImages || [])
                        ];
                        const imageIndex = parseInt(editImageUrl.replace('generated_image_', '')) - 1;
                        if (allGeneratedImages[imageIndex]) {
                          originalImageUrl = allGeneratedImages[imageIndex].imageUrl;
                        }
                      }
                    }
                    
                    return (
                      <div 
                        key={`pending-${idx}`}
                        className={`border border-[color-mix(in_srgb,var(--foreground)_7%,transparent)] rounded-xl ${isEditMode && originalImageUrl && !isFailed ? 'overflow-visible' : 'overflow-hidden'} shadow-sm bg-[color-mix(in_srgb,var(--foreground)_2%,transparent)] relative ${isEditMode && originalImageUrl && !isFailed ? '' : 'min-h-[400px]'}`}
                      >
                        {isFailed ? (
                          // Failed image UI - minimal
                          <>
                            {/* Background placeholder with subtle red tint */}
                            <div className="absolute inset-0 bg-linear-to-br from-[color-mix(in_srgb,var(--foreground)_5%,transparent)] via-red-500/5 to-[color-mix(in_srgb,var(--foreground)_5%,transparent)]" />
                            
                            {/* Minimal error overlay */}
                            <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none z-20">
                              <div className="flex flex-col items-center gap-2 text-red-500">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                <p className="text-xs font-medium truncate max-w-full">
                                  Failed
                                </p>
                              </div>
                            </div>
                          </>
                        ) : (
                          <>
                            {/* Original image background (if editing) */}
                            {isEditMode && originalImageUrl ? (
                              <div className="relative w-full">
                                <img
                                  src={originalImageUrl}
                                  alt="Original image"
                                  className="w-full h-auto block"
                                  style={{ maxWidth: '100%', display: 'block' }}
                                />
                                {/* Prompt overlay - same style as image viewer */}
                                <div className="prompt-overlay absolute inset-0 bg-black/75 backdrop-blur-md text-white p-6 flex flex-col justify-center items-center text-center opacity-100 transition-opacity duration-300 overflow-auto pointer-events-none z-20">
                                  <p 
                                    className="text-base md:text-lg font-medium"
                                    style={{
                                      background: 'linear-gradient(90deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.9) 25%, rgba(255,255,255,0.3) 50%, rgba(255,255,255,0.9) 75%, rgba(255,255,255,0.3) 100%)',
                                      backgroundSize: '200% 100%',
                                      backgroundClip: 'text',
                                      WebkitBackgroundClip: 'text',
                                      color: 'transparent',
                                      animation: 'shimmer-text-strong 1.5s ease-in-out infinite'
                                    }}
                                  >
                                    {prompt}
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <>
                                {/* Background placeholder (if not editing) */}
                                <div className="absolute inset-0 bg-linear-to-br from-[color-mix(in_srgb,var(--foreground)_5%,transparent)] via-[color-mix(in_srgb,var(--foreground)_3%,transparent)] to-[color-mix(in_srgb,var(--foreground)_5%,transparent)]" />
                                
                                {/* Prompt overlay */}
                                <div className="prompt-overlay absolute inset-0 bg-black/75 backdrop-blur-md text-white p-6 flex flex-col justify-center items-center text-center opacity-100 transition-opacity duration-300 overflow-auto pointer-events-none z-20">
                                  <p 
                                    className="text-base md:text-lg font-medium"
                                    style={{
                                      background: 'linear-gradient(90deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.9) 25%, rgba(255,255,255,0.3) 50%, rgba(255,255,255,0.9) 75%, rgba(255,255,255,0.3) 100%)',
                                      backgroundSize: '200% 100%',
                                      backgroundClip: 'text',
                                      WebkitBackgroundClip: 'text',
                                      color: 'transparent',
                                      animation: 'shimmer-text-strong 1.5s ease-in-out infinite'
                                    }}
                                  >
                                    {prompt}
                                  </p>
                                </div>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })
                ) : (
                  // Fallback to skeleton if prompts not available
                  (geminiImageData as any).pendingCount > 0 && Array.from({ length: (geminiImageData as any).pendingCount }).map((_, index) => (
                    <div 
                      key={`pending-${index}`}
                      className="border border-[color-mix(in_srgb,var(--foreground)_7%,transparent)] rounded-xl overflow-hidden shadow-sm bg-[color-mix(in_srgb,var(--foreground)_2%,transparent)] relative min-h-[400px]"
                    >
                      {/* Background placeholder */}
                      <div className="absolute inset-0 bg-linear-to-br from-[color-mix(in_srgb,var(--foreground)_5%,transparent)] via-[color-mix(in_srgb,var(--foreground)_3%,transparent)] to-[color-mix(in_srgb,var(--foreground)_5%,transparent)]" />
                      
                      {/* Prompt overlay */}
                      <div className="prompt-overlay absolute inset-0 bg-black/75 backdrop-blur-md text-white p-6 flex flex-col justify-center items-center text-center opacity-100 transition-opacity duration-300 overflow-auto pointer-events-none z-20">
                        <div 
                          className="text-base md:text-lg font-medium"
                          style={{
                            background: 'linear-gradient(90deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.9) 25%, rgba(255,255,255,0.3) 50%, rgba(255,255,255,0.9) 75%, rgba(255,255,255,0.3) 100%)',
                            backgroundSize: '200% 100%',
                            backgroundClip: 'text',
                            WebkitBackgroundClip: 'text',
                            color: 'transparent',
                            animation: 'shimmer-text-strong 1.5s ease-in-out infinite'
                          }}
                        >
                          Generating image...
                        </div>
                      </div>
                    </div>
                  ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Seedream 4.5 Results */}
      {(!selectedTool || selectedTool === 'seedream-image') && seedreamImageData && (
        <div className="">
          {!selectedTool && (
            <div 
              className={`flex items-center justify-between w-full ${headerClasses} cursor-pointer`}
              onClick={toggleSeedreamImages}
            >
              <div className="flex items-center gap-2.5">
                <SeedreamLogo size={16} className="text-(--foreground)" />
                <h2 className="font-medium text-left tracking-tight">Seedream 4.5</h2>
              </div>
              <div className="flex items-center gap-2">
                <div className="rounded-full p-1 hover:bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] transition-colors">
                  {seedreamExpanded ? 
                    <ChevronUp size={16} className="text-[color-mix(in_srgb,var(--foreground)_50%,transparent)]" /> : 
                    <ChevronDown size={16} className="text-[color-mix(in_srgb,var(--foreground)_50%,transparent)]" />
                  }
                </div>
              </div>
            </div>
          )}
          <div 
            className={selectedTool ? '' : 'overflow-hidden transition-all duration-200 ease-in-out'}
            style={selectedTool ? {} : { 
              maxHeight: seedreamExpanded ? maxContentHeight : '0px',
            }}
          >
            <div
              ref={seedreamContentRef}
              className={selectedTool ? 'p-1' : 'transition-opacity duration-200 ease-in-out p-1'}
              style={selectedTool ? {} : {
                opacity: seedreamExpanded ? 1 : 0,
                scrollbarWidth: 'none',
                msOverflowStyle: 'none'
              }}
            >
              <style jsx>{`
                div::-webkit-scrollbar {
                  display: none;
                }
              `}</style>
              {/* Render completed images with ImageGalleryStack */}
              {orderedSeedreamImages.length > 0 && (
                <ImageGalleryStack
                  images={orderedSeedreamImages.map((image) => ({
                    src: image.imageUrl,
                    alt: image.prompt || 'Generated image',
                    prompt: image.prompt,
                    sourceImageUrl: image.originalImageUrl
                  }))}
                  onSingleImageClick={(src, alt, allImages, index) => {
                    const globalIndex = orderedImageGeneratorImages.length + orderedGeminiImages.length + index;
                    openImageViewer(globalIndex);
                  }}
                  isMobile={isMobile}
                  chatId={chatId}
                  messageId={messageId}
                />
              )}
              {/* Render placeholders for pending images */}
              {(seedreamImageData as any).pendingCount > 0 && ((seedreamImageData as any).pendingItems?.length > 0 || (seedreamImageData as any).pendingPrompts?.length > 0) && (
                <div className={`grid gap-5 ${orderedSeedreamImages.length > 0 ? 'mt-5' : ''} ${
                  ((seedreamImageData as any).startedCount || seedreamImageData.generatedImages?.length || 0) === 1 
                    ? 'grid-cols-1' 
                    : 'grid-cols-1 sm:grid-cols-2'
                }`}>
                  {/* 🔥 pendingItems가 있으면 사용 (인덱스 기반 매칭), 없으면 pendingPrompts 사용 (레거시) */}
                  {((seedreamImageData as any).pendingItems?.length > 0 || (seedreamImageData as any).pendingPrompts?.length > 0) ? (
                    ((seedreamImageData as any).pendingItems || (seedreamImageData as any).pendingPrompts?.map((p: string, i: number) => ({ prompt: p, index: i }))).map((pendingItem: any, idx: number) => {
                    const prompt = pendingItem.prompt || pendingItem;
                    const itemIndex = pendingItem.index ?? idx;
                    
                    // 🔥 인덱스 기반 매칭으로 변경 (프롬프트 매칭 대신)
                    const failedImages = (seedreamImageData as any).failedImages || [];
                    // 인덱스로 먼저 매칭, 없으면 프롬프트로 폴백
                    const failedImage = failedImages.find((f: any) => f.index === itemIndex) || 
                                       failedImages.find((f: any) => f.prompt === prompt && !failedImages.some((ff: any) => ff.index !== undefined));
                    const isFailed = !!failedImage;
                    
                    // Check if this is an edit operation
                    // 🔥 pendingItem에서 editImageUrl 직접 가져오기 (있으면), 없으면 레거시 배열에서
                    const pendingEditImageUrls = (seedreamImageData as any).pendingEditImageUrls || [];
                    const editImageUrl = pendingItem.editImageUrl || pendingEditImageUrls[itemIndex];
                    const isEditMode = !!editImageUrl;
                    
                    // Get the original image URL (should be resolved URL from server)
                    let originalImageUrl: string | undefined;
                    if (isEditMode && editImageUrl) {
                      // editImageUrl should now be the resolved URL from server
                      if (typeof editImageUrl === 'string' && (editImageUrl.startsWith('http://') || editImageUrl.startsWith('https://'))) {
                        // Direct URL (resolved from server)
                        originalImageUrl = editImageUrl;
                      } else if (Array.isArray(editImageUrl) && editImageUrl.length > 0) {
                        // Array of URLs - use first one
                        const firstUrl = editImageUrl[0];
                        if (typeof firstUrl === 'string' && (firstUrl.startsWith('http://') || firstUrl.startsWith('https://'))) {
                          originalImageUrl = firstUrl;
                        }
                      } else if (typeof editImageUrl === 'string' && editImageUrl.startsWith('generated_image_')) {
                        // Fallback: if still a reference, try to resolve from generated images
                        const allGeneratedImages = [
                          ...(imageGeneratorData?.generatedImages || []),
                          ...(geminiImageData?.generatedImages || []),
                          ...(seedreamImageData?.generatedImages || [])
                        ];
                        const imageIndex = parseInt(editImageUrl.replace('generated_image_', '')) - 1;
                        if (allGeneratedImages[imageIndex]) {
                          originalImageUrl = allGeneratedImages[imageIndex].imageUrl;
                        }
                      }
                    }
                    
                    return (
                      <div 
                        key={`pending-${idx}`}
                        className={`border border-[color-mix(in_srgb,var(--foreground)_7%,transparent)] rounded-xl ${isEditMode && originalImageUrl && !isFailed ? 'overflow-visible' : 'overflow-hidden'} shadow-sm bg-[color-mix(in_srgb,var(--foreground)_2%,transparent)] relative ${isEditMode && originalImageUrl && !isFailed ? '' : 'min-h-[400px]'}`}
                      >
                        {isFailed ? (
                          // Failed image UI - minimal
                          <>
                            {/* Background placeholder with subtle red tint */}
                            <div className="absolute inset-0 bg-linear-to-br from-[color-mix(in_srgb,var(--foreground)_5%,transparent)] via-red-500/5 to-[color-mix(in_srgb,var(--foreground)_5%,transparent)]" />
                            
                            {/* Minimal error overlay */}
                            <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none z-20">
                              <div className="flex flex-col items-center gap-2 text-red-500">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                <p className="text-xs font-medium truncate max-w-full">
                                  Failed
                                </p>
                              </div>
                            </div>
                          </>
                        ) : (
                          <>
                            {/* Original image background (if editing) */}
                            {isEditMode && originalImageUrl ? (
                              <div className="relative w-full">
                                <img
                                  src={originalImageUrl}
                                  alt="Original image"
                                  className="w-full h-auto block"
                                  style={{ maxWidth: '100%', display: 'block' }}
                                />
                                {/* Prompt overlay - same style as image viewer */}
                                <div className="prompt-overlay absolute inset-0 bg-black/75 backdrop-blur-md text-white p-6 flex flex-col justify-center items-center text-center opacity-100 transition-opacity duration-300 overflow-auto pointer-events-none z-20">
                                  <p 
                                    className="text-base md:text-lg font-medium"
                                    style={{
                                      background: 'linear-gradient(90deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.9) 25%, rgba(255,255,255,0.3) 50%, rgba(255,255,255,0.9) 75%, rgba(255,255,255,0.3) 100%)',
                                      backgroundSize: '200% 100%',
                                      backgroundClip: 'text',
                                      WebkitBackgroundClip: 'text',
                                      color: 'transparent',
                                      animation: 'shimmer-text-strong 1.5s ease-in-out infinite'
                                    }}
                                  >
                                    {prompt}
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <>
                                {/* Background placeholder (if not editing) */}
                                <div className="absolute inset-0 bg-linear-to-br from-[color-mix(in_srgb,var(--foreground)_5%,transparent)] via-[color-mix(in_srgb,var(--foreground)_3%,transparent)] to-[color-mix(in_srgb,var(--foreground)_5%,transparent)]" />
                                
                                {/* Prompt overlay */}
                                <div className="prompt-overlay absolute inset-0 bg-black/75 backdrop-blur-md text-white p-6 flex flex-col justify-center items-center text-center opacity-100 transition-opacity duration-300 overflow-auto pointer-events-none z-20">
                                  <p 
                                    className="text-base md:text-lg font-medium"
                                    style={{
                                      background: 'linear-gradient(90deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.9) 25%, rgba(255,255,255,0.3) 50%, rgba(255,255,255,0.9) 75%, rgba(255,255,255,0.3) 100%)',
                                      backgroundSize: '200% 100%',
                                      backgroundClip: 'text',
                                      WebkitBackgroundClip: 'text',
                                      color: 'transparent',
                                      animation: 'shimmer-text-strong 1.5s ease-in-out infinite'
                                    }}
                                  >
                                    {prompt}
                                  </p>
                                </div>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })
                ) : (
                  // Fallback to skeleton if prompts not available
                  (seedreamImageData as any).pendingCount > 0 && Array.from({ length: (seedreamImageData as any).pendingCount }).map((_, index) => (
                    <div 
                      key={`pending-${index}`}
                      className="border border-[color-mix(in_srgb,var(--foreground)_7%,transparent)] rounded-xl overflow-hidden shadow-sm bg-[color-mix(in_srgb,var(--foreground)_2%,transparent)] relative min-h-[400px]"
                    >
                      {/* Background placeholder */}
                      <div className="absolute inset-0 bg-linear-to-br from-[color-mix(in_srgb,var(--foreground)_5%,transparent)] via-[color-mix(in_srgb,var(--foreground)_3%,transparent)] to-[color-mix(in_srgb,var(--foreground)_5%,transparent)]" />
                      
                      {/* Prompt overlay */}
                      <div className="prompt-overlay absolute inset-0 bg-black/75 backdrop-blur-md text-white p-6 flex flex-col justify-center items-center text-center opacity-100 transition-opacity duration-300 overflow-auto pointer-events-none z-20">
                        <div 
                          className="text-base md:text-lg font-medium"
                          style={{
                            background: 'linear-gradient(90deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.9) 25%, rgba(255,255,255,0.3) 50%, rgba(255,255,255,0.9) 75%, rgba(255,255,255,0.3) 100%)',
                            backgroundSize: '200% 100%',
                            backgroundClip: 'text',
                            WebkitBackgroundClip: 'text',
                            color: 'transparent',
                            animation: 'shimmer-text-strong 1.5s ease-in-out infinite'
                          }}
                        >
                          Generating image...
                        </div>
                      </div>
                    </div>
                  ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Qwen Image Edit Results */}
      {(!selectedTool || selectedTool === 'qwen-image') && qwenImageData && (
        <div className="">
          {!selectedTool && (
            <div 
              className={`flex items-center justify-between w-full ${headerClasses} cursor-pointer`}
              onClick={toggleQwenImages}
            >
              <div className="flex items-center gap-2.5">
                <WanAiLogo size={16} className="text-(--foreground)" />
                <h2 className="font-medium text-left tracking-tight">Qwen Image Edit</h2>
              </div>
              <div className="flex items-center gap-2">
                <div className="rounded-full p-1 hover:bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] transition-colors">
                  {qwenExpanded ? 
                    <ChevronUp size={16} className="text-[color-mix(in_srgb,var(--foreground)_50%,transparent)]" /> : 
                    <ChevronDown size={16} className="text-[color-mix(in_srgb,var(--foreground)_50%,transparent)]" />
                  }
                </div>
              </div>
            </div>
          )}
          <div 
            className={selectedTool ? '' : 'overflow-hidden transition-all duration-200 ease-in-out'}
            style={selectedTool ? {} : { 
              maxHeight: qwenExpanded ? maxContentHeight : '0px',
            }}
          >
            <div
              ref={qwenContentRef}
              className={selectedTool ? 'p-1' : 'transition-opacity duration-200 ease-in-out p-1'}
              style={selectedTool ? {} : {
                opacity: qwenExpanded ? 1 : 0,
                scrollbarWidth: 'none',
                msOverflowStyle: 'none'
              }}
            >
              <style jsx>{`
                div::-webkit-scrollbar {
                  display: none;
                }
              `}</style>
              {/* Render completed images with ImageGalleryStack */}
              {orderedQwenImages.length > 0 && (
                <ImageGalleryStack
                  images={orderedQwenImages.map((image) => ({
                    src: image.imageUrl,
                    alt: image.prompt || 'Generated image',
                    prompt: image.prompt,
                    sourceImageUrl: image.originalImageUrl
                  }))}
                  onSingleImageClick={(src, alt, allImages, index) => {
                    const globalIndex = orderedImageGeneratorImages.length + orderedGeminiImages.length + orderedSeedreamImages.length + index;
                    openImageViewer(globalIndex);
                  }}
                  isMobile={isMobile}
                  chatId={chatId}
                  messageId={messageId}
                />
              )}
              {/* Render placeholders for pending images */}
              {(qwenImageData as any).pendingCount > 0 && ((qwenImageData as any).pendingItems?.length > 0 || (qwenImageData as any).pendingPrompts?.length > 0) && (
                <div className={`grid gap-5 ${orderedQwenImages.length > 0 ? 'mt-5' : ''} ${
                  ((qwenImageData as any).startedCount || qwenImageData.generatedImages?.length || 0) === 1 
                    ? 'grid-cols-1' 
                    : 'grid-cols-1 sm:grid-cols-2'
                }`}>
                  {((qwenImageData as any).pendingItems?.length > 0 || (qwenImageData as any).pendingPrompts?.length > 0) ? (
                    ((qwenImageData as any).pendingItems || (qwenImageData as any).pendingPrompts?.map((p: string, i: number) => ({ prompt: p, index: i }))).map((pendingItem: any, idx: number) => {
                    const prompt = pendingItem.prompt || pendingItem;
                    const itemIndex = pendingItem.index ?? idx;
                    
                    const failedImages = (qwenImageData as any).failedImages || [];
                    const failedImage = failedImages.find((f: any) => f.index === itemIndex) || 
                                       failedImages.find((f: any) => f.prompt === prompt && !failedImages.some((ff: any) => ff.index !== undefined));
                    const isFailed = !!failedImage;
                    
                    const pendingEditImageUrls = (qwenImageData as any).pendingEditImageUrls || [];
                    const editImageUrl = pendingItem.editImageUrl || pendingEditImageUrls[itemIndex];
                    const isEditMode = !!editImageUrl;
                    
                    let originalImageUrl: string | undefined;
                    if (isEditMode && editImageUrl) {
                      if (typeof editImageUrl === 'string' && (editImageUrl.startsWith('http://') || editImageUrl.startsWith('https://'))) {
                        originalImageUrl = editImageUrl;
                      } else if (Array.isArray(editImageUrl) && editImageUrl.length > 0) {
                        const firstUrl = editImageUrl[0];
                        if (typeof firstUrl === 'string' && (firstUrl.startsWith('http://') || firstUrl.startsWith('https://'))) {
                          originalImageUrl = firstUrl;
                        }
                      }
                    }
                    
                    return (
                      <div 
                        key={`qwen-pending-${idx}`}
                        className={`border border-[color-mix(in_srgb,var(--foreground)_7%,transparent)] rounded-xl ${isEditMode && originalImageUrl && !isFailed ? 'overflow-visible' : 'overflow-hidden'} shadow-sm bg-[color-mix(in_srgb,var(--foreground)_2%,transparent)] relative ${isEditMode && originalImageUrl && !isFailed ? '' : 'min-h-[400px]'}`}
                      >
                        {isFailed ? (
                          <>
                            <div className="absolute inset-0 bg-linear-to-br from-[color-mix(in_srgb,var(--foreground)_5%,transparent)] via-red-500/5 to-[color-mix(in_srgb,var(--foreground)_5%,transparent)]" />
                            <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none z-20">
                              <div className="flex flex-col items-center gap-2 text-red-500">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                <p className="text-xs font-medium truncate max-w-full">Failed</p>
                              </div>
                            </div>
                          </>
                        ) : (
                          <>
                            {isEditMode && originalImageUrl ? (
                              <div className="relative w-full">
                                <img src={originalImageUrl} alt="Original image" className="w-full h-auto block" style={{ maxWidth: '100%', display: 'block' }} />
                                <div className="prompt-overlay absolute inset-0 bg-black/75 backdrop-blur-md text-white p-6 flex flex-col justify-center items-center text-center opacity-100 transition-opacity duration-300 overflow-auto pointer-events-none z-20">
                                  <p 
                                    className="text-base md:text-lg font-medium"
                                    style={{
                                      background: 'linear-gradient(90deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.9) 25%, rgba(255,255,255,0.3) 50%, rgba(255,255,255,0.9) 75%, rgba(255,255,255,0.3) 100%)',
                                      backgroundSize: '200% 100%',
                                      backgroundClip: 'text',
                                      WebkitBackgroundClip: 'text',
                                      color: 'transparent',
                                      animation: 'shimmer-text-strong 1.5s ease-in-out infinite'
                                    }}
                                  >
                                    {prompt}
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="absolute inset-0 bg-linear-to-br from-[color-mix(in_srgb,var(--foreground)_5%,transparent)] via-[color-mix(in_srgb,var(--foreground)_3%,transparent)] to-[color-mix(in_srgb,var(--foreground)_5%,transparent)]" />
                                <div className="prompt-overlay absolute inset-0 bg-black/75 backdrop-blur-md text-white p-6 flex flex-col justify-center items-center text-center opacity-100 transition-opacity duration-300 overflow-auto pointer-events-none z-20">
                                  <p 
                                    className="text-base md:text-lg font-medium"
                                    style={{
                                      background: 'linear-gradient(90deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.9) 25%, rgba(255,255,255,0.3) 50%, rgba(255,255,255,0.9) 75%, rgba(255,255,255,0.3) 100%)',
                                      backgroundSize: '200% 100%',
                                      backgroundClip: 'text',
                                      WebkitBackgroundClip: 'text',
                                      color: 'transparent',
                                      animation: 'shimmer-text-strong 1.5s ease-in-out infinite'
                                    }}
                                  >
                                    {prompt}
                                  </p>
                                </div>
                              </>
                            )}
                            <div className="absolute top-3 right-3 z-30">
                              <div className="bg-black/40 backdrop-blur-md rounded-full p-1.5 border border-white/10 shadow-lg">
                                <Loader2 className="w-4 h-4 text-white animate-spin" />
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })
                ) : (
                  (qwenImageData as any).pendingCount > 0 && Array.from({ length: (qwenImageData as any).pendingCount }).map((_, index) => (
                    <div 
                      key={`qwen-skeleton-${index}`}
                      className="border border-[color-mix(in_srgb,var(--foreground)_7%,transparent)] rounded-xl overflow-hidden shadow-sm bg-[color-mix(in_srgb,var(--foreground)_2%,transparent)] min-h-[400px]"
                    >
                      <div className="w-full h-full relative overflow-hidden">
                        <div 
                          className="absolute inset-0 bg-linear-to-r from-transparent via-white/10 to-transparent"
                          style={{
                            backgroundSize: '200% 100%',
                            animation: 'shimmer 2s ease-in-out infinite'
                          }}
                        />
                      </div>
                    </div>
                  ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Wan 2.5 Video Results */}
      {(!selectedTool || selectedTool === 'wan25-video') && wan25VideoData && (
        <div className="">
          {!selectedTool && (
            <div 
              className={`flex items-center justify-between w-full ${headerClasses} cursor-pointer`}
              onClick={toggleWan25Video}
            >
              <div className="flex items-center gap-2.5">
                <WanAiLogo size={16} className="text-(--foreground)" />
                <h2 className="font-medium text-left tracking-tight">
                  {(wan25VideoData.generatedVideos?.some(v => v.isImageToVideo) || (wan25VideoData.pendingSourceImages && wan25VideoData.pendingSourceImages.length > 0)) ? 'Wan 2.5 Image to Video' : 'Wan 2.5 Text to Video'}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-(--foreground)/5 text-(--muted)">
                  {wan25VideoData.generatedVideos?.length || 0}
                </span>
                {wan25Expanded ? <ChevronUp className="h-4 w-4 text-(--muted)" /> : <ChevronDown className="h-4 w-4 text-(--muted)" />}
              </div>
            </div>
          )}
          
          <div 
            className="overflow-hidden transition-all duration-300 ease-in-out"
            style={{ 
              maxHeight: wan25Expanded ? '2000px' : '0',
              opacity: wan25Expanded ? 1 : 0,
              paddingTop: wan25Expanded ? '0.5rem' : '0'
            }}
          >
            {/* Render completed videos with VideoGalleryStack */}
            {wan25VideoData.generatedVideos && wan25VideoData.generatedVideos.length > 0 && (
              <VideoGalleryStack
                videos={wan25VideoData.generatedVideos.map((video) => ({
                  src: video.videoUrl,
                  prompt: video.prompt,
                  sourceImageUrl: video.sourceImageUrl,
                  aspectRatio: video.size ? getAspectRatioFromSize(video.size) : undefined
                }))}
                messageId={messageId}
                chatId={chatId}
                userId={userId}
                isMobile={isMobile}
              />
            )}
            
            {/* Render placeholders for pending videos */}
            {wan25VideoData.pendingCount && wan25VideoData.pendingCount > 0 && wan25VideoData.pendingPrompts && wan25VideoData.pendingPrompts.length > 0 ? (
              <div className={`grid gap-5 ${wan25VideoData.generatedVideos && wan25VideoData.generatedVideos.length > 0 ? 'mt-5' : ''} ${
                (wan25VideoData.startedCount || wan25VideoData.generatedVideos?.length || 0) === 1 
                  ? 'grid-cols-1' 
                  : 'grid-cols-1 sm:grid-cols-2'
              }`}>
                {wan25VideoData.pendingPrompts.map((prompt: string, index: number) => {
                  const sourceImage = wan25VideoData.pendingSourceImages?.[index];
                  const isImageToVideo = !!sourceImage;

                  return (
                    <div 
                      key={`pending-video-prompt-${index}`}
                      className="border border-[color-mix(in_srgb,var(--foreground)_7%,transparent)] rounded-xl overflow-hidden shadow-sm bg-[color-mix(in_srgb,var(--foreground)_2%,transparent)] relative min-h-[200px]"
                    >
                      {isImageToVideo ? (
                        pendingImageAspectRatios[`wan-${index}`] == null ? (
                          <>
                            <div className="relative w-full min-h-[200px] flex items-center justify-center overflow-hidden">
                              <div
                                className="absolute inset-0 bg-linear-to-r from-transparent via-white/10 to-transparent"
                                style={{
                                  backgroundSize: '200% 100%',
                                  animation: 'shimmer 2s ease-in-out infinite'
                                }}
                              />
                              <div className="prompt-overlay absolute inset-0 bg-black/75 backdrop-blur-md text-white p-6 flex flex-col justify-center items-center text-center opacity-100 transition-opacity duration-300 z-20">
                                <div
                                  className="text-base font-medium bg-linear-to-r from-transparent via-gray-300 to-transparent bg-clip-text text-transparent px-4"
                                  style={{
                                    backgroundSize: '200% 100%',
                                    animation: 'shimmer 2s ease-in-out infinite'
                                  }}
                                >
                                  {prompt}
                                </div>
                              </div>
                            </div>
                            <img
                              src={sourceImage}
                              alt=""
                              className="absolute w-0 h-0 opacity-0 pointer-events-none"
                              onLoad={(e) => {
                                const el = e.currentTarget;
                                const w = el.naturalWidth;
                                const h = el.naturalHeight;
                                if (w && h) {
                                  setPendingImageAspectRatios((prev) => ({ ...prev, [`wan-${index}`]: w / h }));
                                }
                              }}
                            />
                          </>
                        ) : (
                          <div
                            className="relative w-full"
                            style={{ aspectRatio: `${pendingImageAspectRatios[`wan-${index}`]} / 1` }}
                          >
                            <img
                              src={sourceImage}
                              alt="Source image"
                              className="w-full h-full object-contain block"
                            />
                            <div className="prompt-overlay absolute inset-0 bg-black/75 backdrop-blur-md text-white p-6 flex flex-col justify-center items-center text-center opacity-100 transition-opacity duration-300 z-20">
                              <div
                                className="text-base font-medium bg-linear-to-r from-transparent via-gray-300 to-transparent bg-clip-text text-transparent px-4"
                                style={{
                                  backgroundSize: '200% 100%',
                                  animation: 'shimmer 2s ease-in-out infinite'
                                }}
                              >
                                {prompt}
                              </div>
                            </div>
                          </div>
                        )
                      ) : (
                        <>
                          <div className="absolute inset-0 bg-linear-to-br from-[color-mix(in_srgb,var(--foreground)_5%,transparent)] via-[color-mix(in_srgb,var(--foreground)_3%,transparent)] to-[color-mix(in_srgb,var(--foreground)_5%,transparent)]" />
                          <div className="prompt-overlay absolute inset-0 bg-black/75 backdrop-blur-md text-white p-6 flex flex-col justify-center items-center text-center opacity-100 transition-opacity duration-300 z-20">
                            <div 
                              className="text-base font-medium bg-linear-to-r from-transparent via-gray-300 to-transparent bg-clip-text text-transparent px-4"
                              style={{
                                backgroundSize: '200% 100%',
                                animation: 'shimmer 2s ease-in-out infinite'
                              }}
                            >
                              {prompt}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              wan25VideoData.pendingCount && wan25VideoData.pendingCount > 0 ? (
                <div className={`grid gap-5 ${wan25VideoData.generatedVideos && wan25VideoData.generatedVideos.length > 0 ? 'mt-5' : ''} ${
                  (wan25VideoData.startedCount || wan25VideoData.generatedVideos?.length || 0) === 1 
                    ? 'grid-cols-1' 
                    : 'grid-cols-1 sm:grid-cols-2'
                }`}>
                  {Array.from({ length: wan25VideoData.pendingCount }).map((_, index) => (
                    <div 
                      key={`pending-video-skeleton-${index}`}
                      className="border border-[color-mix(in_srgb,var(--foreground)_7%,transparent)] rounded-xl overflow-hidden shadow-sm bg-[color-mix(in_srgb,var(--foreground)_2%,transparent)]"
                    >
                      <div className="relative aspect-video bg-black/50 overflow-hidden flex items-center justify-center">
                        <div className="w-full h-full relative overflow-hidden">
                          <div 
                            className="absolute inset-0 bg-linear-to-r from-transparent via-white/10 to-transparent"
                            style={{
                              backgroundSize: '200% 100%',
                              animation: 'shimmer 2s ease-in-out infinite'
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null
            )}
          </div>
        </div>
      )}

      {/* Grok Imagine Video Results */}
      {(!selectedTool || selectedTool === 'grok-video') && grokVideoData && (
        <div className="">
          {!selectedTool && (
            <div 
              className={`flex items-center justify-between w-full ${headerClasses} cursor-pointer`}
              onClick={toggleGrokVideo}
            >
              <div className="flex items-center gap-2.5">
                <XaiLogo size={16} className="text-(--foreground)" />
                <h2 className="font-medium text-left tracking-tight">
                  {grokVideoData.isVideoEdit ? 'Grok Video to Video' : (grokVideoData.generatedVideos?.some(v => v.isImageToVideo) || (grokVideoData.pendingSourceImages && grokVideoData.pendingSourceImages.length > 0)) ? 'Grok Image to Video' : 'Grok Text to Video'}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-(--foreground)/5 text-(--muted)">
                  {grokVideoData.generatedVideos?.length || 0}
                </span>
                {grokExpanded ? <ChevronUp className="h-4 w-4 text-(--muted)" /> : <ChevronDown className="h-4 w-4 text-(--muted)" />}
              </div>
            </div>
          )}
          <div 
            className="overflow-hidden transition-all duration-300 ease-in-out"
            style={{ 
              maxHeight: grokExpanded ? '2000px' : '0',
              opacity: grokExpanded ? 1 : 0,
              paddingTop: grokExpanded ? '0.5rem' : '0'
            }}
          >
            {grokVideoData.generatedVideos && grokVideoData.generatedVideos.length > 0 && (
              <VideoGalleryStack
                videos={grokVideoData.generatedVideos.map((video) => ({
                  src: video.videoUrl,
                  prompt: video.prompt,
                  sourceImageUrl: video.sourceImageUrl,
                  aspectRatio: video.aspect_ratio ? video.aspect_ratio.replace(':', '/') : undefined
                }))}
                messageId={messageId}
                chatId={chatId}
                userId={userId}
                isMobile={isMobile}
              />
            )}
            {grokVideoData.pendingCount && grokVideoData.pendingCount > 0 && grokVideoData.pendingPrompts && grokVideoData.pendingPrompts.length > 0 ? (
              <div className={`grid gap-5 ${grokVideoData.generatedVideos && grokVideoData.generatedVideos.length > 0 ? 'mt-5' : ''} ${(grokVideoData.startedCount || grokVideoData.generatedVideos?.length || 0) === 1 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
                {grokVideoData.pendingPrompts.map((prompt: string, index: number) => {
                  const sourceImage = grokVideoData.pendingSourceImages?.[index];
                  const sourceVideo = grokVideoData.pendingSourceVideos?.[index];
                  const isImageToVideo = !!sourceImage;
                  const isVideoEdit = !!sourceVideo;

                  return (
                    <div 
                      key={`pending-grok-prompt-${index}`}
                      className="border border-[color-mix(in_srgb,var(--foreground)_7%,transparent)] rounded-xl overflow-hidden shadow-sm bg-[color-mix(in_srgb,var(--foreground)_2%,transparent)] relative min-h-[200px]"
                    >
                      {isImageToVideo ? (
                        pendingImageAspectRatios[`grok-${index}`] == null ? (
                          <>
                            <div className="relative w-full min-h-[200px] flex items-center justify-center overflow-hidden">
                              <div
                                className="absolute inset-0 bg-linear-to-r from-transparent via-white/10 to-transparent"
                                style={{
                                  backgroundSize: '200% 100%',
                                  animation: 'shimmer 2s ease-in-out infinite'
                                }}
                              />
                              <div className="prompt-overlay absolute inset-0 bg-black/75 backdrop-blur-md text-white p-6 flex flex-col justify-center items-center text-center opacity-100 transition-opacity duration-300 z-20">
                                <div
                                  className="text-base font-medium bg-linear-to-r from-transparent via-gray-300 to-transparent bg-clip-text text-transparent px-4"
                                  style={{
                                    backgroundSize: '200% 100%',
                                    animation: 'shimmer 2s ease-in-out infinite'
                                  }}
                                >
                                  {prompt}
                                </div>
                              </div>
                            </div>
                            <img
                              src={sourceImage}
                              alt=""
                              className="absolute w-0 h-0 opacity-0 pointer-events-none"
                              onLoad={(e) => {
                                const el = e.currentTarget;
                                const w = el.naturalWidth;
                                const h = el.naturalHeight;
                                if (w && h) {
                                  setPendingImageAspectRatios((prev) => ({ ...prev, [`grok-${index}`]: w / h }));
                                }
                              }}
                            />
                          </>
                        ) : (
                          <div
                            className="relative w-full"
                            style={{ aspectRatio: `${pendingImageAspectRatios[`grok-${index}`]} / 1` }}
                          >
                            <img
                              src={sourceImage}
                              alt="Source image"
                              className="w-full h-full object-contain block"
                            />
                            <div className="prompt-overlay absolute inset-0 bg-black/75 backdrop-blur-md text-white p-6 flex flex-col justify-center items-center text-center opacity-100 transition-opacity duration-300 z-20">
                              <div
                                className="text-base font-medium bg-linear-to-r from-transparent via-gray-300 to-transparent bg-clip-text text-transparent px-4"
                                style={{
                                  backgroundSize: '200% 100%',
                                  animation: 'shimmer 2s ease-in-out infinite'
                                }}
                              >
                                {prompt}
                              </div>
                            </div>
                          </div>
                        )
                      ) : isVideoEdit ? (
                        <div className="relative w-full aspect-video overflow-hidden">
                          <video
                            src={sourceVideo}
                            muted
                            loop
                            playsInline
                            className="w-full h-full object-contain block"
                          />
                          <div className="prompt-overlay absolute inset-0 bg-black/75 backdrop-blur-md text-white p-6 flex flex-col justify-center items-center text-center opacity-100 transition-opacity duration-300 z-20">
                            <div
                              className="text-base font-medium bg-linear-to-r from-transparent via-gray-300 to-transparent bg-clip-text text-transparent px-4"
                              style={{
                                backgroundSize: '200% 100%',
                                animation: 'shimmer 2s ease-in-out infinite'
                              }}
                            >
                              {prompt}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="absolute inset-0 bg-linear-to-br from-[color-mix(in_srgb,var(--foreground)_5%,transparent)] via-[color-mix(in_srgb,var(--foreground)_3%,transparent)] to-[color-mix(in_srgb,var(--foreground)_5%,transparent)]" />
                          <div className="prompt-overlay absolute inset-0 bg-black/75 backdrop-blur-md text-white p-6 flex flex-col justify-center items-center text-center opacity-100 transition-opacity duration-300 z-20">
                            <div
                              className="text-base font-medium bg-linear-to-r from-transparent via-gray-300 to-transparent bg-clip-text text-transparent px-4"
                              style={{
                                backgroundSize: '200% 100%',
                                animation: 'shimmer 2s ease-in-out infinite'
                              }}
                            >
                              {prompt}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : grokVideoData.pendingCount && grokVideoData.pendingCount > 0 ? (
              <div className={`grid gap-5 ${grokVideoData.generatedVideos && grokVideoData.generatedVideos.length > 0 ? 'mt-5' : ''} ${(grokVideoData.startedCount || grokVideoData.generatedVideos?.length || 0) === 1 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
                {Array.from({ length: grokVideoData.pendingCount }).map((_, index) => (
                  <div key={`pending-grok-skeleton-${index}`} className="border border-[color-mix(in_srgb,var(--foreground)_7%,transparent)] rounded-xl overflow-hidden shadow-sm bg-[color-mix(in_srgb,var(--foreground)_2%,transparent)]">
                    <div className="relative aspect-video bg-black/50 overflow-hidden flex items-center justify-center">
                      <div className="w-full h-full relative overflow-hidden">
                        <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/10 to-transparent" style={{ backgroundSize: '200% 100%', animation: 'shimmer 2s ease-in-out infinite' }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* File edit (read_file, write_file, get_file_info, list_workspace, delete_file, grep_file, apply_edits) - styled like attachment viewer */}
      {(!selectedTool || selectedTool.startsWith?.('file-edit:')) && fileEditData && fileEditData.files.length > 0 && (
        <div className="">
          {!selectedTool && (
            <div className={`flex items-center gap-2.5 ${headerClasses}`}>
              <FileText className="h-4 w-4 text-(--foreground)" strokeWidth={1.5} />
              <h2 className="font-medium text-left tracking-tight">File</h2>
            </div>
          )}
          <div className="space-y-4">
            {fileEditData.files
              .filter((f) => {
                const selectedFileTool =
                  selectedTool?.startsWith?.('file-edit:')
                    ? selectedTool.slice('file-edit:'.length)
                    : null;
                const matchesPath = !selectedItem || f.path === selectedItem;
                const matchesTool = !selectedFileTool || f.toolName === selectedFileTool;
                return matchesPath && matchesTool;
              })
              .map((entry, idx) => (
                <div key={`file-edit-${idx}-${entry.path || entry.toolName}`} className="rounded-lg border border-[color-mix(in_srgb,var(--foreground)_10%,transparent)] bg-(--background) overflow-hidden">
                  <div className="px-4 py-2.5 text-sm font-medium text-(--foreground) border-b border-[color-mix(in_srgb,var(--foreground)_10%,transparent)] truncate" title={entry.path || undefined}>
                    {entry.toolName === 'list_workspace' && !entry.path ? 'Workspace' : entry.path}
                  </div>
                  <div className="p-4">
                    {entry.toolName === 'read_file' && (
                      <CanvasReadFileView entry={entry} chatId={chatId} />
                    )}
                    {entry.toolName === 'write_file' && (
                      <CanvasDiffView entry={entry} chatId={chatId} />
                    )}
                    {entry.toolName === 'get_file_info' && (
                      <>
                        {entry.success && (
                          <dl className="text-sm space-y-1">
                            {typeof entry.size === 'number' && <><dt className="text-(--muted)">Size</dt><dd>{entry.size} bytes</dd></>}
                          </dl>
                        )}
                        {!entry.success && entry.error && <p className="text-sm text-red-500">{entry.error}</p>}
                      </>
                    )}
                    {entry.toolName === 'list_workspace' && (
                      <>
                        {entry.success && entry.entries && entry.entries.length > 0 && (
                          <ul className="text-sm space-y-1 list-disc list-inside">
                            {entry.entries.map((e, i) => (
                              <li key={i}>{e.path || e.name} {e.isDir ? '(dir)' : ''}</li>
                            ))}
                          </ul>
                        )}
                        {entry.success && (!entry.entries || entry.entries.length === 0) && <p className="text-sm text-(--muted)">No entries.</p>}
                        {!entry.success && entry.error && <p className="text-sm text-red-500">{entry.error}</p>}
                      </>
                    )}
                    {entry.toolName === 'delete_file' && (
                      <>
                        {entry.success && <p className="text-sm text-(--muted)">Deleted.</p>}
                        {!entry.success && entry.error && <p className="text-sm text-red-500">{entry.error}</p>}
                      </>
                    )}
                    {entry.toolName === 'grep_file' && (
                      <CanvasGrepFileView entry={entry} chatId={chatId} />
                    )}
                    {entry.toolName === 'apply_edits' && (
                      <CanvasDiffView entry={entry} chatId={chatId} />
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Run Python code (run_python_code) - Clean terminal UI */}
      {(!selectedTool || selectedTool === 'run-code') && runCodeData && (
        <div className="space-y-4">
          {!selectedTool && (
            <div className={`flex items-center gap-2.5 ${headerClasses}`}>
              <Code2 className="h-4 w-4 text-(--foreground)" strokeWidth={1.5} />
              <h2 className="font-medium text-left tracking-tight">Code output</h2>
            </div>
          )}
          
          <div className="rounded-xl border border-[color-mix(in_srgb,var(--foreground)_10%,transparent)] overflow-hidden">
            {/* Console output: stdout / stderr / error */}
            {(runCodeData.error || runCodeData.stdout.length > 0 || runCodeData.stderr.length > 0) && (
              <div className="canvas-terminal-console">
                {runCodeData.error && (
                  <div className="canvas-terminal-error">
                    <span className="canvas-terminal-error-label">
                      {runCodeData.error.name ?? 'Error'}
                    </span>
                    <span className="canvas-terminal-error-msg">
                      {runCodeData.error.value ?? ''}
                    </span>
                    {Array.isArray(runCodeData.error.traceback) && runCodeData.error.traceback.length > 0 && (
                      <pre className="canvas-terminal-traceback">
                        {runCodeData.error.traceback.join('\n')}
                      </pre>
                    )}
                  </div>
                )}
                {runCodeData.stdout.length > 0 && (
                  <pre className="canvas-terminal-stdout">{runCodeData.stdout.join('')}</pre>
                )}
                {runCodeData.stderr.length > 0 && (
                  <pre className="canvas-terminal-stderr">{runCodeData.stderr.join('')}</pre>
                )}
              </div>
            )}

            {/* Results: charts, images, text, html */}
            {runCodeData.results.length > 0 && (
              <div className="space-y-0">
                {runCodeData.results.map((r, idx) => {
                  const hasChart = !!r.chart;
                  const hasPng = !!r.png || !!r.jpeg;
                  const echartsOption = hasChart ? e2bChartToEChartsOption(r.chart) : null;
                  const showECharts = echartsOption != null;
                  const chartConfig = !showECharts && hasChart ? e2bChartToChartJs(r.chart) : null;
                  const showChartJs = chartConfig != null;
                  const showInteractive = showECharts || showChartJs;
                  const chartCount = runCodeData.results.filter((x: any) => x.chart || x.png || x.jpeg).length;
                  const resultLabel = showInteractive || hasPng
                    ? (chartCount > 1 ? `Figure ${runCodeData.results.filter((x: any, i: number) => (x.chart || x.png || x.jpeg) && i <= idx).length}` : 'Figure')
                    : r.html
                      ? 'HTML'
                      : 'Result';
                  
                  return (
                    <div key={idx} className="group relative border-t border-[color-mix(in_srgb,var(--foreground)_8%,transparent)]">
                      {/* Result label bar */}
                      <div className="flex items-center justify-between px-4 py-2 bg-[color-mix(in_srgb,var(--foreground)_3%,transparent)]">
                        <span className="text-xs font-medium text-(--muted) tracking-wide">{resultLabel}</span>
                        {(hasPng || (r.jpeg && !r.png)) && (
                          <button
                            type="button"
                            onClick={() => {
                              const link = document.createElement('a');
                              link.href = r.png ? `data:image/png;base64,${r.png}` : `data:image/jpeg;base64,${r.jpeg}`;
                              link.download = `figure-${idx + 1}.${r.png ? 'png' : 'jpg'}`;
                              link.click();
                            }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 text-(--muted) hover:text-(--foreground)"
                            title="Download"
                          >
                            <Download size={13} />
                          </button>
                        )}
                      </div>
                      
                      {/* Result content */}
                      <div className="bg-(--background)">
                        {showECharts && (
                          <div className="relative min-h-[340px] w-full p-4">
                            <E2BChartECharts option={echartsOption!} chartIndex={idx} />
                          </div>
                        )}
                        {showChartJs && (
                          <div className="relative min-h-[340px] w-full p-4">
                            <DynamicChart chartConfig={chartConfig!} />
                          </div>
                        )}
                        {!showInteractive && r.png && (
                          <div className="p-4 flex items-center justify-center">
                            <img 
                              src={`data:image/png;base64,${r.png}`} 
                              alt={resultLabel} 
                              className="max-w-full h-auto rounded-lg" 
                            />
                          </div>
                        )}
                        {!showInteractive && r.jpeg && !r.png && (
                          <div className="p-4 flex items-center justify-center">
                            <img 
                              src={`data:image/jpeg;base64,${r.jpeg}`} 
                              alt={resultLabel} 
                              className="max-w-full h-auto rounded-lg" 
                            />
                          </div>
                        )}
                        {r.html && (
                          <div className="p-4 overflow-auto custom-scrollbar max-h-[500px]" dangerouslySetInnerHTML={{ __html: r.html }} />
                        )}
                        {r.text && !hasChart && !hasPng && !r.html && (
                          <pre className="canvas-terminal-stdout">{r.text}</pre>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Empty state */}
            {!runCodeData.error && runCodeData.stdout.length === 0 && runCodeData.stderr.length === 0 && runCodeData.results.length === 0 && (
              <div className="px-5 py-8 text-center text-xs text-(--muted)">
                No output
              </div>
            )}
          </div>
        </div>
      )}

      {/* Image viewer modal */}
      <ImageModal
        isOpen={selectedImageIndex >= 0 && !!currentImage}
        imageUrl={currentImage?.imageUrl || ''}
        imageAlt={currentImage?.prompt || 'Generated image'}
        onClose={closeImageViewer}
        gallery={galleryImages.length > 1 ? galleryImages : undefined}
        currentIndex={selectedImageIndex}
        onNavigate={galleryImages.length > 1 ? navigateImage : undefined}
        prompt={currentPrompt}
        showPromptButton={!!currentPrompt}
        enableDownload={true}
        enableSave={true}
        enableUrlRefresh={true}
        messageId={messageId}
        chatId={chatId}
        userId={userId}
        isMobile={isMobile}
        isSaving={currentImage ? savingImages.has(currentImage.imageUrl) : false}
        isSaved={currentImage ? savedImages.has(currentImage.imageUrl) : false}
        onSave={handleSave}
        sourceImageUrl={currentImage?.originalImageUrl}
      />
    </div>
  );
} 
