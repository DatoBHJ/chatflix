
'use client';

import React, { memo, useMemo, useCallback, useState, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Calculator, Link2, ImageIcon, Search, Youtube, Video, FileText, Code2, Copy, Download, Globe, MessageCircle } from 'lucide-react';
import { SiGoogle } from 'react-icons/si';
import { getIcon } from 'material-file-icons';
import { XLogo, YouTubeLogo, WanAiLogo, SeedreamLogo, XaiLogo } from './CanvasFolder/CanvasLogo';
import { getTopicIconComponent, getTopicName, getTopicIcon } from './MultiSearch';
import { fileHelpers } from './ChatInput/FileUpload';
import { e2bChartToEChartsOption } from '@/app/utils/e2bChartToECharts';
import { computeDiffHunks, type DiffSummary } from '@/app/utils/diffUtils';
import { ImageModal } from './ImageModal';
import type { RunCodeSyncedFile } from '@/app/hooks/toolFunction';

const E2BChartEChartsInline = dynamic(
  () => import('./charts/E2BChartECharts').then((m) => ({ default: m.E2BChartECharts })),
  { ssr: false }
);

// Outcome file tools (write/edit) - UI as result/attachment style
const OUTCOME_FILE_TOOLS = ['write_file', 'apply_edits', 'read_file', 'delete_file', 'grep_file', 'get_file_info', 'list_workspace'] as const;
const isOutcomeFileTool = (name: string): boolean =>
  (OUTCOME_FILE_TOOLS as readonly string[]).includes(name);

// Minimalist labels for file tools and code tools only
const FILE_TOOL_ACTION_LABELS: Record<string, string> = {
  'read_file': 'Read',
  'write_file': 'Created',
  'apply_edits': 'Edited',
  'delete_file': 'Deleted',
  'grep_file': 'Searched',
  'get_file_info': 'Info',
  'list_workspace': 'Listed',
  'run_python_code': 'Ran',
  'browser_observe': 'Observed',
};

const FILE_TOOL_ACTION_LABELS_PROCESSING: Record<string, string> = {
  'read_file': 'Reading',
  'write_file': 'Creating',
  'apply_edits': 'Editing',
  'delete_file': 'Deleting',
  'grep_file': 'Searching',
  'get_file_info': 'Getting info',
  'list_workspace': 'Listing',
  'run_python_code': 'Running',
  'browser_observe': 'Observing',
};

function getActionLabel(toolName: string, status: string): string {
  if (status === 'processing') {
    return FILE_TOOL_ACTION_LABELS_PROCESSING[toolName] ?? '';
  }
  return FILE_TOOL_ACTION_LABELS[toolName] ?? '';
}

const isFileToolName = (name: string): boolean =>
  ([
    'read_file',
    'grep_file',
    'get_file_info',
    'list_workspace',
    'delete_file',
    'write_file',
    'apply_edits',
  ] as readonly string[]).includes(name);

// Shimmer animation styles
const shimmerStyles = `
  @keyframes shimmer {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }
`;

/** Truncate pattern with "..." when too long; layout/CSS handles visual ellipsis, this is fallback for very long strings. */
function normalizeInlineSearchText(input: unknown, maxLen = 200): string | null {
  if (typeof input !== 'string') return null;
  const collapsed = input.replace(/\s+/g, ' ').trim();
  if (!collapsed) return null;
  if (collapsed.length <= maxLen) return collapsed;
  return collapsed.slice(0, Math.max(0, maxLen - 3)) + '...';
}

function formatQuoted(input: unknown, maxLen = 200): string | null {
  const normalized = normalizeInlineSearchText(input, maxLen);
  if (!normalized) return null;
  return `"${normalized}"`;
}

// Tool name to display name mapping
const TOOL_DISPLAY_NAMES: Record<string, string> = {
  'web_search': 'Web Search',
  'multi_search': 'Web Search',
  'calculator': 'Calculator',
  'math_calculation': 'Calculator',
  'link_reader': 'Link Reader',
  'gemini_image_tool': 'Nano Banana Pro',
  'seedream_image_tool': 'Seedream 4.5',
  'qwen_image_edit': 'Qwen Image Edit',
  'twitter_search': 'X Search',
  'youtube_search': 'YouTube Search',
  'youtube_link_analysis': 'YouTube Analyzer',
  'youtube_link_analyzer': 'YouTube Analyzer',
  'google_search': 'Google Search',
  'wan25_video': 'Wan 2.5 Video',
  'grok_video': 'Grok Imagine Video',
  'video_upscaler': '4K Video Upscaler',
  'image_upscaler': '8K Image Upscaler',
  'read_file': 'Read file',
  'write_file': 'Write file',
  'get_file_info': 'File info',
  'list_workspace': 'List workspace',
  'delete_file': 'Delete file',
  'grep_file': 'Search in file',
  'apply_edits': 'Apply edits',
  'run_python_code': 'Run code',
  'browser_observe': 'Browser Observe',
  'chat_history_search': 'Message Search',
};

// Tool name to icon mapping
const getToolIcon = (toolName: string, toolArgs?: any, toolResult?: any) => {
  const iconProps = { size: 14, strokeWidth: 1.5 };
  
  switch (toolName) {
    case 'web_search':
    case 'multi_search': {
      // Use topic-based icon for web search if available
      // 1. toolArgs에서 topics 확인
      // 2. toolResult에서 실제 사용된 topic 확인 (forcedTopic이 설정된 경우)
      // 3. 기본값 'general'
      let topic = toolArgs?.topics?.[0] || toolArgs?.topic;
      
      // toolArgs에 topics가 없고 toolResult가 있으면, toolResult에서 topic 추출
      if (!topic && toolResult?.searches && Array.isArray(toolResult.searches) && toolResult.searches.length > 0) {
        topic = toolResult.searches[0].topic;
      }
      
      topic = topic || 'general';
      const topicIcon = getTopicIcon(topic);
      return getTopicIconComponent(topicIcon);
    }
    case 'google_search': {
      // Use topic-based icon for google search
      // engines 배열이 있으면 첫 번째 엔진을 topic으로 사용, 없으면 topic 또는 기본값 'google'
      const topic = toolArgs?.engines?.[0] || toolArgs?.topic || toolArgs?.engine || 'google';
      const topicIcon = getTopicIcon(topic);
      return getTopicIconComponent(topicIcon);
    }
    case 'calculator':
    case 'math_calculation':
      return <Calculator {...iconProps} />;
    case 'link_reader':
      return <Link2 {...iconProps} />;
    case 'gemini_image_tool':
      return <SiGoogle strokeWidth={0.5} size={14} />;
    case 'seedream_image_tool':
      return <SeedreamLogo size={14} />;
    case 'qwen_image_edit':
      return <WanAiLogo size={14} />;
    case 'youtube_search':
      return <YouTubeLogo size={iconProps.size} />;
    case 'youtube_link_analysis':
    case 'youtube_link_analyzer':
      return <Youtube {...iconProps} />;
    case 'twitter_search':
      return <XLogo size={iconProps.size} />;
    case 'chat_history_search':
      return <MessageCircle {...iconProps} />;
    case 'wan25_video':
      return <WanAiLogo size={iconProps.size} />;
    case 'grok_video':
      return <XaiLogo size={iconProps.size} />;
    case 'video_upscaler':
      return <Video {...iconProps} />;
    case 'image_upscaler':
      return <ImageIcon {...iconProps} />;
    case 'read_file':
    case 'write_file':
    case 'get_file_info':
    case 'list_workspace':
    case 'delete_file':
    case 'grep_file':
    case 'apply_edits':
      return <FileText {...iconProps} />;
    case 'run_python_code':
      return <Code2 {...iconProps} />;
    case 'browser_observe':
      return <Globe {...iconProps} />;
    default:
      return <Search {...iconProps} />;
  }
};

// Tool name to Canvas toolType mapping for togglePanel
const getCanvasToolType = (toolName: string, toolArgs?: any, toolResult?: any): string => {
  switch (toolName) {
    case 'web_search':
    case 'multi_search': {
      // toolArgs에서 topics 확인, 없으면 toolResult에서 추출
      let topic = toolArgs?.topics?.[0] || toolArgs?.topic;
      
      // toolArgs에 topics가 없고 toolResult가 있으면, toolResult에서 topic 추출
      if (!topic && toolResult?.searches && Array.isArray(toolResult.searches) && toolResult.searches.length > 0) {
        topic = toolResult.searches[0].topic;
      }
      
      topic = topic || 'general';
      return `web-search:topic:${topic}`;
    }
    case 'google_search': {
      // engines 배열이 있으면 첫 번째 엔진을 topic으로 사용
      const topic = toolArgs?.engines?.[0] || toolArgs?.topic || toolArgs?.engine || 'google';
      return `google-search:topic:${topic}`;
    }
    case 'chat_history_search':
      return 'chat-search';
    case 'calculator':
    case 'math_calculation':
      return 'calculator';
    case 'link_reader':
      return 'link-reader';
    case 'gemini_image_tool':
      return 'gemini-image';
    case 'seedream_image_tool':
      return 'seedream-image';
    case 'qwen_image_edit':
      return 'qwen-image';
    case 'twitter_search':
      return 'twitter_search';
    case 'youtube_search':
      return 'youtube-search';
    case 'youtube_link_analysis':
    case 'youtube_link_analyzer':
      return 'youtube-analyzer';
    case 'wan25_video':
      return 'wan25-video';
    case 'grok_video':
      return 'grok-video';
    case 'video_upscaler':
      return 'video-upscaler';
    case 'image_upscaler':
      return 'image-upscaler';
    case 'read_file':
    case 'write_file':
    case 'get_file_info':
    case 'list_workspace':
    case 'delete_file':
    case 'grep_file':
    case 'apply_edits':
      return `file-edit:${toolName}`;
    case 'run_python_code':
      return 'run-code';
    case 'browser_observe':
      return 'browser-observe';
    default:
      return toolName;
  }
};

function BrowserObserveImagePreview({
  chatId,
  path,
}: {
  chatId?: string;
  path?: string;
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadImage = async () => {
      if (!chatId || !path) {
        setImageUrl(null);
        return;
      }
      try {
        const res = await fetch(`/api/chat/workspace-file-content?chatId=${encodeURIComponent(chatId)}&path=${encodeURIComponent(path)}`);
        const data = await res.json();
        if (cancelled) return;
        if (data?.isBinary && data?.downloadUrl) {
          setImageUrl(data.downloadUrl);
          return;
        }
        setImageUrl(null);
      } catch {
        if (!cancelled) setImageUrl(null);
      }
    };
    loadImage();
    return () => {
      cancelled = true;
    };
  }, [chatId, path]);

  if (!imageUrl) return null;
  return (
    <div className="mt-2.5 rounded-md overflow-hidden border border-[color-mix(in_srgb,var(--foreground)_10%,transparent)]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imageUrl} alt="browser observe screenshot" className="w-full max-h-56 object-cover" />
    </div>
  );
}

// ── RunCodeExtractedResults: Images (with modal) + ECharts + File cards ──
function RunCodeExtractedResults({
  runCodeResults,
  runCodeEChartsOption,
  runCodeFirstPng,
  syncedFiles,
  chatId,
  messageId,
}: {
  runCodeResults: any[];
  runCodeEChartsOption: any;
  runCodeFirstPng: boolean;
  syncedFiles?: RunCodeSyncedFile[];
  chatId?: string;
  messageId?: string;
}) {
  // Image modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalImageUrl, setModalImageUrl] = useState('');
  const [modalImageAlt, setModalImageAlt] = useState('');

  const imageResults = useMemo(
    () => runCodeResults.filter((r: any) => r?.png || r?.jpeg),
    [runCodeResults]
  );

  // When the same image is in both results and syncedFiles, show only synced as photo (not file card)
  const syncedImageFiles = useMemo(
    () => (syncedFiles ?? []).filter((f: RunCodeSyncedFile) => /\.(png|jpe?g|webp)$/i.test(f.path ?? '')),
    [syncedFiles]
  );
  const syncedOtherFiles = useMemo(
    () => (syncedFiles ?? []).filter((f: RunCodeSyncedFile) => !/\.(png|jpe?g|webp)$/i.test(f.path ?? '')),
    [syncedFiles]
  );
  // Prefer base64 images from execution results (instant) over synced image API fetch
  const showInlineResultImages = imageResults.length > 0;
  // Only show synced images via API when no base64 alternative exists
  const showSyncedImages = syncedImageFiles.length > 0 && imageResults.length === 0;

  const openModal = useCallback((src: string, alt: string) => {
    setModalImageUrl(src);
    setModalImageAlt(alt);
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
  }, []);

  return (
    <>
      {/* Chart / PNG images from execution results (base64 — instant, no API fetch needed) */}
      {showInlineResultImages && (
        <div className="mt-2 flex flex-col gap-2 message-media-max-width">
          {imageResults.map((r: any, i: number) => {
            const src = r.png
              ? `data:image/png;base64,${r.png}`
              : `data:image/jpeg;base64,${r.jpeg}`;
            const alt = `Code output ${i + 1}`;
            return (
              <div
                key={`run-code-img-${i}`}
                className="rounded-2xl overflow-hidden cursor-pointer"
                onClick={() => openModal(src, alt)}
              >
                <img src={src} alt={alt} className="w-full h-auto" />
              </div>
            );
          })}
        </div>
      )}

      {/* ECharts - full interactive chart */}
      {!runCodeFirstPng && runCodeEChartsOption && (
        <div className="mt-2 rounded-xl overflow-hidden border border-[color-mix(in_srgb,var(--foreground)_8%,transparent)] bg-[color-mix(in_srgb,var(--foreground)_2%,transparent)]">
          <E2BChartEChartsInline option={runCodeEChartsOption} height={300} />
        </div>
      )}

      {/* Synced files (images, docx, etc.) are no longer shown here.
          Files are surfaced via path-in-text substitution in the AI message instead.
          See MarkdownContent: inline code with /home/user/workspace/... → WorkspaceFilePathCard */}

      {/* Image Modal */}
      <ImageModal
        isOpen={modalOpen}
        imageUrl={modalImageUrl}
        imageAlt={modalImageAlt}
        onClose={closeModal}
        enableDownload={true}
        enableSave={true}
        enableUrlRefresh={false}
        messageId={messageId}
        chatId={chatId}
        userId={undefined}
        showPromptButton={false}
        isMobile={false}
      />
    </>
  );
}

// ── RunCodeSyncedImage: synced image file as photo with modal (no file card) ──
// Used only when no base64 result images are available — fetches from workspace API with retry.
function RunCodeSyncedImage({
  file,
  chatId,
  onOpenModal,
}: {
  file: RunCodeSyncedFile;
  chatId?: string;
  onOpenModal: (src: string, alt: string) => void;
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const filename = file.path.replace(/^.*\//, '') || 'image';

  useEffect(() => {
    if (!chatId || !file.path) return;
    let cancelled = false;

    const fetchImage = async (attempt: number) => {
      try {
        const res = await fetch(
          `/api/chat/workspace-file-content?chatId=${encodeURIComponent(chatId)}&path=${encodeURIComponent(file.path)}`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        if (data?.downloadUrl) {
          setImageUrl(data.downloadUrl);
          setError(false);
        } else {
          throw new Error('No downloadUrl');
        }
      } catch {
        if (cancelled) return;
        // Retry up to 3 times with increasing delay (1s, 2s, 4s)
        if (attempt < 3) {
          const delay = Math.pow(2, attempt) * 1000;
          setTimeout(() => { if (!cancelled) fetchImage(attempt + 1); }, delay);
        } else {
          setError(true);
        }
      }
    };

    setError(false);
    setImageUrl(null);
    fetchImage(0);
    return () => { cancelled = true; };
  }, [chatId, file.path, retryCount]);

  if (error) {
    return (
      <div className="rounded-2xl overflow-hidden bg-[color-mix(in_srgb,var(--foreground)_6%,transparent)] flex flex-col items-center justify-center min-h-[120px] gap-2">
        <span className="text-xs text-(--muted)">Failed to load image</span>
        <button
          type="button"
          onClick={() => { setError(false); setRetryCount((c) => c + 1); }}
          className="text-xs text-blue-500 hover:text-blue-400 underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!imageUrl) {
    return (
      <div className="rounded-2xl overflow-hidden bg-[color-mix(in_srgb,var(--foreground)_6%,transparent)] flex items-center justify-center min-h-[120px]">
        <span className="text-xs text-(--muted) animate-pulse">Loading image…</span>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl overflow-hidden cursor-pointer"
      onClick={() => onOpenModal(imageUrl, filename)}
    >
      <img src={imageUrl} alt={filename} className="w-full h-auto" />
    </div>
  );
}

// ── RunCodeFileCard: imessage-file-bubble style card for synced files ──
function RunCodeFileCard({ file, chatId }: { file: RunCodeSyncedFile; chatId?: string }) {
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const filename = file.path.replace(/^.*\//, '') || 'file';
  const icon = getIcon(filename);
  const sizeStr = file.bytes >= 1024 * 1024
    ? `${(file.bytes / (1024 * 1024)).toFixed(1)} MB`
    : file.bytes >= 1024
      ? `${(file.bytes / 1024).toFixed(1)} KB`
      : `${file.bytes} B`;

  const handleDownload = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!chatId || !file.path) return;
    if (file.isText) {
      setLoading(true);
      try {
        const res = await fetch(`/api/chat/workspace-file-content?chatId=${encodeURIComponent(chatId)}&path=${encodeURIComponent(file.path)}`);
        if (res.ok) {
          const data = await res.json();
          if (typeof data.content === 'string') {
            const blob = new Blob([data.content], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
            URL.revokeObjectURL(url);
          }
        }
      } catch { /* ignore */ }
      setLoading(false);
    } else {
      if (downloadUrl) {
        window.open(downloadUrl, '_blank');
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(`/api/chat/workspace-file-content?chatId=${encodeURIComponent(chatId)}&path=${encodeURIComponent(file.path)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.isBinary && data.downloadUrl) {
            setDownloadUrl(data.downloadUrl);
            window.open(data.downloadUrl, '_blank');
          }
        }
      } catch { /* ignore */ }
      setLoading(false);
    }
  }, [chatId, file.path, file.isText, filename, downloadUrl]);

  if ((file as any).skipped || (file as any).error) {
    return null; // Don't render skipped/errored files
  }

  return (
    <div className="imessage-file-bubble" onClick={handleDownload as any} style={{ cursor: 'pointer' }}>
      {/* File Icon */}
      <div className="shrink-0">
        <div
          style={{ width: '24px', height: '24px' }}
          dangerouslySetInnerHTML={{ __html: icon.svg }}
        />
      </div>
      {/* File Info */}
      <div className="flex-1 text-left overflow-hidden">
        <p className="font-medium truncate text-sm text-black/60 dark:text-white/80">{filename}</p>
        <p className="text-xs text-black/40 dark:text-white/60">{sizeStr}</p>
      </div>
      {/* Download Icon */}
      <div className="p-1">
        <button
          onClick={handleDownload}
          disabled={loading}
          className="hover:bg-black/10 dark:hover:bg-white/10 rounded p-1 transition-colors disabled:opacity-50"
          title="Download file"
        >
          <Download className={`text-neutral-500 ${loading ? 'animate-pulse' : ''}`} size={20} />
        </button>
      </div>
    </div>
  );
}

interface InlineToolPreviewProps {
  toolName: string;
  toolArgs?: any;
  toolResult?: any;
  messageId: string;
  togglePanel?: (messageId: string, type: 'canvas' | 'structuredResponse', fileIndex?: number, toolType?: string, fileName?: string) => void;
  activePanel?: { messageId: string; type: string; toolType?: string } | null;
  isProcessing?: boolean;
  chatId?: string;
  toolCallId?: string;
  isLastBubble?: boolean;
  isNoTail?: boolean;
}

export const InlineToolPreview = memo(function InlineToolPreview({
  toolName,
  toolArgs,
  toolResult,
  messageId,
  togglePanel,
  activePanel,
  isProcessing = false,
  chatId,
  toolCallId,
  isLastBubble = false,
  isNoTail = false,
}: InlineToolPreviewProps) {
  // Determine status
  const status = useMemo(() => {
    if (isProcessing) return 'processing';
    
    // 이미지 생성 도구: success 필드와 실제 이미지 데이터 확인
    if (toolName === 'gemini_image_tool' || toolName === 'seedream_image_tool' || toolName === 'qwen_image_edit') {
      if (toolResult) {
        // 명시적 실패 케이스
        if (toolResult.success === false) {
          return 'error';
        }
        // 성공 케이스: 이미지 데이터 확인
        const hasImage = toolResult.imageUrl || 
                        toolResult.path || 
                        (toolResult.images && toolResult.images.length > 0);
        return hasImage ? 'completed' : 'processing';
      }
      return 'processing';
    }
    
    // 파일 편집 도구
    if (toolName === 'read_file' || toolName === 'write_file' || toolName === 'get_file_info' || toolName === 'list_workspace' || toolName === 'delete_file' || toolName === 'grep_file' || toolName === 'apply_edits') {
      if (toolResult) return toolResult.success === false ? 'error' : 'completed';
      return 'processing';
    }
    // 코드 실행 도구
    if (toolName === 'run_python_code') {
      // Streaming data (isStreaming=true) means code is still running — treat as processing
      if (toolResult?.isStreaming) return 'processing';
      // toolResult가 있으면 성공 여부에 따라 상태 결정
      if (toolResult) return toolResult.success === false ? 'error' : 'completed';
      
      // toolResult가 없더라도 message.parts에 관련 데이터가 있으면 completed로 간주
      // (일부 환경에서 tool_results 대신 parts에 결과가 포함되는 경우 대응)
      return 'processing';
    }
    if (toolName === 'browser_observe') {
      if (toolResult?.isStreaming) return 'processing';
      if (toolResult) return toolResult.success === false ? 'error' : 'completed';
      return 'processing';
    }
    
    // 비디오 생성 도구: success 필드와 실제 비디오 데이터 확인
    if (toolName === 'wan25_video' || toolName === 'grok_video' || toolName === 'video_upscaler') {
      if (toolResult) {
        if (toolResult.success === false) {
          return 'error';
        }
        const hasVideo = toolResult.videoUrl || 
                        toolResult.path || 
                        (toolResult.videos && toolResult.videos.length > 0);
        return hasVideo ? 'completed' : 'processing';
      }
      return 'processing';
    }

    // 이미지 업스케일 도구: success 필드와 실제 이미지 데이터 확인
    if (toolName === 'image_upscaler') {
      if (toolResult) {
        if (toolResult.success === false) {
          return 'error';
        }
        const hasImage = toolResult.imageUrl ||
                         toolResult.path ||
                         (toolResult.images && toolResult.images.length > 0);
        return hasImage ? 'completed' : 'processing';
      }
      return 'processing';
    }
    
    // 기타 도구는 기존 로직 유지
    if (toolResult) return 'completed';
    return 'processing';
  }, [isProcessing, toolResult, toolName]);

  // Get display name and icon (with topic support for search tools)
  const displayName = useMemo(() => {
    const actionLabel = status === 'processing'
      ? (FILE_TOOL_ACTION_LABELS_PROCESSING[toolName] ?? '')
      : (FILE_TOOL_ACTION_LABELS[toolName] ?? '');
    
    // Use topic-based names for search tools
    if (toolName === 'web_search' || toolName === 'multi_search') {
      // toolArgs에서 topics 확인, 없으면 toolResult에서 추출
      let topic = toolArgs?.topics?.[0] || toolArgs?.topic;
      
      // toolArgs에 topics가 없고 toolResult가 있으면, toolResult에서 topic 추출
      if (!topic && toolResult?.searches && Array.isArray(toolResult.searches) && toolResult.searches.length > 0) {
        topic = toolResult.searches[0].topic;
      }
      
      if (topic) {
        const topicName = getTopicName(topic);
        return actionLabel ? `${actionLabel} ${topicName}` : topicName;
      }
    }
    if (toolName === 'google_search') {
      // engines 배열이 있으면 첫 번째 엔진을 topic으로 사용
      const topic = toolArgs?.engines?.[0] || toolArgs?.topic || toolArgs?.engine || 'google';
      const topicName = getTopicName(topic);
      return actionLabel ? `${actionLabel} ${topicName}` : topicName;
    }
    // wan25_video: model에 따라 동적 이름 (toolResult 우선 - forcedModel 반영)
    if (toolName === 'wan25_video') {
      const model = toolResult?.model ?? toolArgs?.model;
      const isImageToVideo =
        toolResult?.isImageToVideo ??
        toolResult?.videos?.[0]?.isImageToVideo ??
        model === 'image-to-video';
      return isImageToVideo
        ? 'Wan 2.5 Image to Video'
        : 'Wan 2.5 Text to Video';
    }
    // grok_video: model에 따라 동적 이름 (toolResult 우선 - forcedModel 반영, flicker 방지)
    if (toolName === 'grok_video') {
      const model = toolResult?.model ?? toolArgs?.model;
      const isVideoEdit = toolResult?.isVideoEdit ?? model === 'video-edit';
      const isImageToVideo = toolResult?.isImageToVideo ?? model === 'image-to-video';
      if (isVideoEdit) return 'Grok Video to Video';
      if (isImageToVideo) return 'Grok Image to Video';
      return 'Grok Text to Video';
    }
    if (toolName === 'video_upscaler') {
      return '4K Video Upscaler';
    }
    if (toolName === 'image_upscaler') {
      return '8K Image Upscaler';
    }
    
    const baseName = TOOL_DISPLAY_NAMES[toolName] || toolName;
    return actionLabel ? `${actionLabel} ${baseName}` : baseName;
  }, [toolName, toolArgs, toolResult, status]);

  const icon = getToolIcon(toolName, toolArgs, toolResult); // Pass toolArgs and toolResult for topic-based icons
  const canvasToolType = getCanvasToolType(toolName, toolArgs, toolResult); // Pass toolArgs and toolResult for topic-based routing

  // Extract display text from args
  const displayText = useMemo(() => {
    if (!toolArgs) return '';
    
    // grep_file: always show the pattern (what we searched for)
    if (toolName === 'grep_file') {
      const quoted = formatQuoted(toolArgs.pattern ?? toolResult?.pattern, 80);
      if (quoted) return quoted;
    }

    // Handle different tool argument structures
    if (toolArgs.queries && Array.isArray(toolArgs.queries)) {
      return toolArgs.queries.map((q: string) => `"${q}"`).join(', ');
    }
    if (toolArgs.query) {
      return `"${toolArgs.query}"`;
    }
    if (toolArgs.expression) {
      return toolArgs.expression;
    }
    // Handle YouTube link analyzer URLs array
    if (toolArgs.urls && Array.isArray(toolArgs.urls)) {
      if (toolArgs.urls.length === 1) {
        try {
          const domain = new URL(toolArgs.urls[0]).hostname.replace('www.', '');
          return domain;
        } catch {
          return toolArgs.urls[0];
        }
      } else {
        try {
          const firstDomain = new URL(toolArgs.urls[0]).hostname.replace('www.', '');
          return `${firstDomain} (+${toolArgs.urls.length - 1} more)`;
        } catch {
          return `${toolArgs.urls.length} URLs`;
        }
      }
    }
    if (toolArgs.url) {
      try {
        const domain = new URL(toolArgs.url).hostname.replace('www.', '');
        return domain;
      } catch {
        return toolArgs.url;
      }
    }
    if (toolArgs.prompt) {
      return toolArgs.prompt.length > 50 
        ? toolArgs.prompt.substring(0, 50) + '...' 
        : toolArgs.prompt;
    }
    if (toolArgs.path) {
      const p = toolArgs.path as string;
      return p.length > 40 ? p.slice(0, 40) + '…' : p;
    }
    return '';
  }, [toolArgs]);

  // 롱프레스와 클릭 구분을 위한 상태
  const [touchStartTime, setTouchStartTime] = useState<number>(0);
  const [isLongPressing, setIsLongPressing] = useState(false);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Extract item identifier from toolArgs for filtering
  const itemIdentifier = useMemo(() => {
    if (!toolArgs) return undefined;
    
    // For search tools: use query/queries (prefer query field, fallback to first query in queries array)
    if (toolName === 'web_search' || toolName === 'multi_search' || toolName === 'google_search' || toolName === 'twitter_search' || toolName === 'chat_history_search') {
      // Prefer the *actual executed query* from toolResult when available (query completion may rewrite queries).
      if (toolResult?.searches && Array.isArray(toolResult.searches) && toolResult.searches.length > 0) {
        const q = toolResult.searches[0]?.query;
        if (typeof q === 'string' && q.trim().length > 0) return q;
      }
      // Prefer toolArgs.query if available (single query)
      if (toolArgs.query) {
        return toolArgs.query;
      }
      // Fallback to first query in queries array
      if (toolArgs.queries && Array.isArray(toolArgs.queries) && toolArgs.queries.length > 0) {
        return toolArgs.queries[0];
      }
    }
    
    // For link reader: use URL
    if (toolName === 'link_reader' && toolArgs.url) {
      return toolArgs.url;
    }
    
    // For YouTube link analyzer: use first URL from urls array
    if ((toolName === 'youtube_link_analyzer' || toolName === 'youtube_link_analysis') && toolArgs.urls && Array.isArray(toolArgs.urls) && toolArgs.urls.length > 0) {
      return toolArgs.urls[0];
    }
    
    // For calculator: use expression
    if ((toolName === 'calculator' || toolName === 'math_calculation') && toolArgs.expression) {
      return toolArgs.expression;
    }
    
    if ((toolName === 'read_file' || toolName === 'write_file' || toolName === 'get_file_info' || toolName === 'delete_file' || toolName === 'grep_file' || toolName === 'apply_edits') && toolArgs.path) {
      return toolArgs.path;
    }
    
    // For run_python_code: pass toolCallId so Canvas can show the correct invocation
    if ((toolName === 'run_python_code' || toolName === 'browser_observe') && toolCallId) {
      return toolCallId;
    }
    
    return undefined;
  }, [toolArgs, toolName, toolCallId]);

  // Handle click - 롱프레스가 아닌 경우에만 실행
  const handleClick = useCallback((e: React.MouseEvent) => {
    // 롱프레스가 활성화된 경우 클릭 무시
    if (isLongPressing) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    
    if (togglePanel) {
      // Pass item identifier as fileName parameter (repurposed for item filtering)
      togglePanel(messageId, 'canvas', undefined, canvasToolType, itemIdentifier);
    }
  }, [togglePanel, messageId, canvasToolType, itemIdentifier, isLongPressing]);

  // 터치 시작 핸들러 - 부모로 이벤트 전파하되 롱프레스 감지
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const startTime = Date.now();
    setTouchStartTime(startTime);
    setIsLongPressing(false);
    
    // 롱프레스 타이머 시작 (500ms)
    longPressTimerRef.current = setTimeout(() => {
      setIsLongPressing(true);
      // 롱프레스가 활성화되면 부모로 이벤트 전파를 위해 버블링 허용
      // 부모의 handleAITouchStart가 호출되어 롱프레스 메뉴가 표시됨
    }, 500);
    
    // 이벤트를 부모로 전파 (롱프레스 처리용)
    // stopPropagation을 호출하지 않아 부모의 터치 핸들러도 실행됨
  }, []);

  // 터치 종료 핸들러
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const touchEndTime = Date.now();
    const currentTouchStartTime = touchStartTime;
    const touchDuration = currentTouchStartTime > 0 ? touchEndTime - currentTouchStartTime : 0;
    
    // 타이머 정리
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    
    // 롱프레스가 활성화된 경우 클릭 방지
    if (isLongPressing || touchDuration >= 500) {
      setIsLongPressing(false);
      setTouchStartTime(0);
      // 롱프레스가 활성화된 경우 클릭 이벤트 방지
      e.preventDefault();
      // 부모로 이벤트 전파 (롱프레스 취소 처리용)
      return;
    }
    
    // 짧은 터치인 경우 클릭 처리 (일반 클릭은 onClick에서 처리)
    setIsLongPressing(false);
    setTouchStartTime(0);
    // 짧은 터치인 경우 부모로 이벤트 전파하지 않음 (클릭만 처리)
  }, [touchStartTime, isLongPressing]);

  // 터치 이동 핸들러 - 스크롤 감지 시 롱프레스 취소
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    // 스크롤이 감지되면 롱프레스 타이머 취소
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
      setIsLongPressing(false);
    }
  }, []);

  // 컴포넌트 언마운트 시 타이머 정리
  React.useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  // Check if this tool is currently active in the panel
  const isActive = activePanel?.messageId === messageId && 
                   activePanel?.type === 'canvas' && 
                   activePanel?.toolType === canvasToolType;

  const filePath = toolResult?.path ?? toolArgs?.path ?? '';
  const fileName = filePath ? filePath.replace(/^.*\//, '') || 'file' : 'file';
  const fileBubbleTitle = toolName === 'list_workspace' ? 'Workspace' : fileName;
  const iconNameForBubble = toolName === 'list_workspace' ? 'workspace' : fileName;

  const fileBubbleSubtitle = useMemo(() => {
    if (toolName === 'grep_file') {
      const quoted = formatQuoted(toolArgs?.pattern ?? toolResult?.pattern, 80);
      if (status === 'processing') {
        return '…';
      }
      if (status === 'error') {
        const err = toolResult?.error;
        if (typeof err === 'string' && err.trim().length > 0) {
          return err;
        }
        return 'Error';
      }
      const matches = toolResult?.matches;
      const n = Array.isArray(matches) ? matches.length : (typeof toolResult?.matchesCount === 'number' ? toolResult.matchesCount : 0);
      return `${n} match(es)`;
    }

    if (status === 'processing') return '…';
    if (toolName === 'read_file') {
      const start = toolArgs?.startLine ?? toolResult?.startLine;
      const end = toolArgs?.endLine ?? toolResult?.endLine;
      const totalLines = typeof toolResult?.totalLines === 'number' ? toolResult.totalLines : undefined;
      // Always show Lstart-end: use range when valid, else full file as L1-N
      if (typeof start === 'number' && typeof end === 'number' && end >= start && end > 0) {
        return `L${start}-${end}`;
      }
      const fullEnd = totalLines ?? (typeof toolResult?.content === 'string' ? toolResult.content.split('\n').length : 0);
      if (fullEnd > 0) return `L1-${fullEnd}`;
      return '—';
    }
    if (toolName === 'write_file') {
      if (typeof toolArgs?.content === 'string') return fileHelpers.formatFileSize(new Blob([toolArgs.content]).size);
      return '—';
    }
    if (toolName === 'apply_edits') {
      if (typeof toolResult?.content === 'string') return fileHelpers.formatFileSize(new Blob([toolResult.content]).size);
      return '—';
    }
    if (toolName === 'get_file_info') {
      const size = typeof toolResult?.size === 'number' ? toolResult.size : (toolResult?.info && typeof (toolResult.info as any).size === 'number' ? (toolResult.info as any).size : undefined);
      if (size != null) return fileHelpers.formatFileSize(size);
      return filePath ? filePath : '—';
    }
    if (toolName === 'list_workspace') {
      const list = Array.isArray(toolResult?.paths) ? toolResult.paths : toolResult?.entries;
      const n = Array.isArray(list) ? list.length : 0;
      return `${n} entr${n === 1 ? 'y' : 'ies'}`;
    }
    if (toolName === 'delete_file') {
      if (toolResult?.success === false && toolResult?.error) return toolResult.error;
      return 'Deleted';
    }
    return '—';
  }, [status, toolName, toolArgs, toolResult, filePath]);

  const hasFileBubbleDownload =
    (toolName === 'write_file' && typeof toolArgs?.content === 'string') ||
    (toolName === 'apply_edits' && typeof toolResult?.content === 'string') ||
    (toolName === 'read_file' && typeof toolResult?.content === 'string') ||
    (toolName === 'grep_file' && (typeof (toolResult?.output ?? toolResult?.content) === 'string'));

  const handleFileDownload = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    let content: string | undefined;
    let name = fileName || 'download.txt';
    if (toolName === 'write_file') content = toolArgs?.content;
    else if (toolName === 'apply_edits' || toolName === 'read_file') content = toolResult?.content;
    else if (toolName === 'grep_file') content = toolResult?.output ?? toolResult?.content;
    if (typeof content !== 'string') return;
    if (toolName === 'grep_file') name = (fileName || 'grep') + '.txt';
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }, [toolName, toolArgs, toolResult, fileName]);

  const openWorkspacePath = useCallback(async (e: React.MouseEvent, path?: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!chatId || !path) return;
    try {
      const res = await fetch(`/api/chat/workspace-file-content?chatId=${encodeURIComponent(chatId)}&path=${encodeURIComponent(path)}`);
      const data = await res.json();
      if (data?.downloadUrl) {
        window.open(data.downloadUrl, '_blank');
        return;
      }
      if (typeof data?.content === 'string') {
        const blob = new Blob([data.content], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 5_000);
      }
    } catch {
      // non-fatal
    }
  }, [chatId]);

  const inlineSubtitle = useMemo(() => {
    if (isFileToolName(toolName) && !isOutcomeFileTool(toolName)) {
      if (displayText && fileBubbleSubtitle && fileBubbleSubtitle !== '—') {
        return `${displayText} · ${fileBubbleSubtitle}`;
      }
      return displayText || (fileBubbleSubtitle !== '—' ? fileBubbleSubtitle : '');
    }
    return displayText;
  }, [toolName, displayText, fileBubbleSubtitle]);

  // Outcome: use same labels as canvas panel title (TOOL_DISPLAY_NAMES) for consistency
  const outcomeActionLabel = useMemo(() => {
    return TOOL_DISPLAY_NAMES[toolName] ?? toolName;
  }, [toolName]);
  const outcomeSubtitle = fileBubbleSubtitle !== '—' ? `${outcomeActionLabel} · ${fileBubbleSubtitle}` : outcomeActionLabel;

  // run_python_code: compact outcome preview when results include chart/png
  const runCodeResults = useMemo(() => {
    if (Array.isArray(toolResult?.results)) return toolResult.results;
    // toolResult가 null이거나 results가 없을 때, toolResult 자체가 runCodeResults 배열인 경우 대응
    if (toolName === 'run_python_code' && Array.isArray(toolResult)) {
      const last = toolResult[toolResult.length - 1];
      return last?.results || [];
    }
    return [];
  }, [toolResult, toolName]);

  const runCodeStdout = useMemo(() => {
    if (Array.isArray(toolResult?.stdout)) return toolResult.stdout;
    if (toolName === 'run_python_code' && Array.isArray(toolResult)) {
      const last = toolResult[toolResult.length - 1];
      return last?.stdout || [];
    }
    return [];
  }, [toolResult, toolName]);

  const runCodeStderr = useMemo(() => {
    if (Array.isArray(toolResult?.stderr)) return toolResult.stderr;
    if (toolName === 'run_python_code' && Array.isArray(toolResult)) {
      const last = toolResult[toolResult.length - 1];
      return last?.stderr || [];
    }
    return [];
  }, [toolResult, toolName]);

  const runCodeHasChartOrPng = runCodeResults.some((r: any) => r?.png || r?.jpeg || r?.chart);
  const runCodeFirstPng = runCodeResults.find((r: any) => r?.png || r?.jpeg);
  const runCodePngCount = runCodeResults.filter((r: any) => r?.png || r?.jpeg).length;
  const runCodeSyncedImageCount = (toolResult?.syncedFiles ?? []).filter((f: any) => /\.(png|jpe?g|webp)$/i.test(f.path ?? '')).length;
  const runCodeHasSyncedImageFiles = runCodeSyncedImageCount > 0;
  const runCodeSubtitle = useMemo(() => {
    if (status === 'processing') return '…';
    if (status === 'error') {
      const errName = toolResult?.error?.name || toolResult?.error?.value;
      return errName ? `Error: ${errName}` : 'Error';
    }
    if (runCodeHasSyncedImageFiles) {
      return runCodeSyncedImageCount === 1 ? '1 image' : `${runCodeSyncedImageCount} images`;
    }
    const otherCount = (toolResult?.syncedFiles?.length ?? 0) - runCodeSyncedImageCount;
    if (otherCount > 0) return otherCount === 1 ? '1 file' : `${otherCount} files`;
    if (runCodePngCount > 0) return runCodePngCount === 1 ? '1 chart' : `${runCodePngCount} figures`;
    if (runCodeResults.some((r: any) => r?.chart)) return '1 chart';
    if (runCodeResults.some((r: any) => r?.text || r?.html)) return 'Text output';
    if (runCodeStdout.length > 0 || runCodeStderr.length > 0) return 'Output';
    return 'Output';
  }, [status, runCodePngCount, runCodeResults, runCodeStdout, runCodeStderr, toolResult, runCodeHasSyncedImageFiles, runCodeSyncedImageCount]);

  const browserObserveSubtitle = useMemo(() => {
    if (status === 'processing') {
      if (toolResult?.progressPhase) return `Observing… (${toolResult.progressPhase})`;
      return 'Observing…';
    }
    if (status === 'error') return toolResult?.error || 'Observation failed';
    if (typeof toolResult?.htmlLength === 'number') {
      const htmlSize = fileHelpers.formatFileSize(toolResult.htmlLength);
      return `Captured · ${htmlSize} HTML`;
    }
    return 'Captured';
  }, [status, toolResult]);

  const diffBubbleClass = `diff-inline-preview${isLastBubble ? ' last-bubble' : ''}${isNoTail ? ' no-tail' : ''}`;

  if (toolName === 'browser_observe') {
    const isSuccess = status === 'completed';
    const actionLabel = getActionLabel(toolName, status);
    const browserTitle = toolResult?.title || displayText || 'Browser';

    return (
      <>
        <style>{shimmerStyles}</style>
        <div
          className={diffBubbleClass}
          onClick={handleClick}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchMove={handleTouchMove}
          style={{ 
            cursor: togglePanel ? 'pointer' : 'default', 
            touchAction: 'manipulation',
            width: 'fit-content',
            minWidth: '140px'
          }}
        >
          <div className="diff-header">
            <div className="diff-header-fixed shrink-0">
              <span className="flex items-center text-(--muted)">
                {getToolIcon(toolName, toolArgs, toolResult)}
              </span>
              <span className="text-sm text-(--muted) whitespace-nowrap">
                {actionLabel}
              </span>
            </div>
            <div className="diff-header-scroll">
              <span className="diff-filename">
                {browserTitle}
              </span>

              <span className="text-xs text-(--muted) shrink-0 ml-0.5">
                {browserObserveSubtitle}
              </span>
            </div>

            <div className="shrink-0 flex items-center ml-0.5">
              {status === 'processing' && (
                <span className="inline-tool-status-dot shrink-0" />
              )}
              
              {isSuccess && (
                <svg className="w-3.5 h-3.5 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}

              {status === 'error' && (
                <svg className="w-3.5 h-3.5 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </div>
          </div>

          {toolResult?.finalUrl && (
            <div className="text-[11px] text-(--muted) truncate opacity-70 px-3 pb-1">
              {toolResult.finalUrl}
            </div>
          )}

          {isSuccess && toolResult?.screenshotPath && (
            <div className="px-1 pb-1">
              <BrowserObserveImagePreview chatId={chatId} path={toolResult.screenshotPath} />
            </div>
          )}
        </div>
      </>
    );
  }

  if (toolName === 'run_python_code') {
    const isSuccess = status === 'completed';
    const actionLabel = getActionLabel(toolName, status);
    
    return (
      <>
        <style>{shimmerStyles}</style>
        <div
          className={diffBubbleClass}
          onClick={handleClick}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchMove={handleTouchMove}
          style={{ 
            cursor: togglePanel ? 'pointer' : 'default', 
            touchAction: 'manipulation',
            width: 'fit-content',
            minWidth: '140px'
          }}
        >
          <div className="diff-header">
            <div className="diff-header-fixed shrink-0">
              <span className="flex items-center text-(--muted)">
                {getToolIcon(toolName, toolArgs, toolResult)}
              </span>
              <span className="text-sm text-(--muted) whitespace-nowrap">
                {actionLabel}
              </span>
            </div>
            <div className="diff-header-scroll">
              <span className="diff-filename">
                Code output
              </span>

              <span className="text-xs text-(--muted) shrink-0 ml-0.5">
                {runCodeSubtitle}
              </span>
            </div>

            <div className="shrink-0 flex items-center ml-0.5">
              {status === 'processing' && (
                <span className="inline-tool-status-dot shrink-0" />
              )}
              
              {isSuccess && (
                <svg className="w-3.5 h-3.5 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}

              {status === 'error' && (
                <svg className="w-3.5 h-3.5 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </div>
          </div>
        </div>
        
        {isSuccess && (
          <RunCodeExtractedResults
            runCodeResults={runCodeResults}
            runCodeEChartsOption={null} // Simplified for minimal view
            runCodeFirstPng={runCodeFirstPng}
            syncedFiles={toolResult?.syncedFiles}
            chatId={chatId}
            messageId={messageId}
          />
        )}
      </>
    );
  }

  // ── Diff preview for write_file / apply_edits ──
  const INLINE_MAX_LINES = 8;

  // Completed: compute real diff from originalContent + newContent
  const diffData: DiffSummary | null = useMemo(() => {
    if (!isOutcomeFileTool(toolName)) return null;
    if (status !== 'completed') return null;
    const hasOriginalField = toolResult && 'originalContent' in toolResult;
    if (!hasOriginalField) return null;
    const originalContent: string | null = toolResult.originalContent ?? null;
    let newContent: string | undefined;
    if (toolName === 'write_file') {
      newContent = toolResult?.content ?? toolArgs?.content;
    } else {
      newContent = toolResult?.content;
    }
    if (typeof newContent !== 'string') return null;
    return computeDiffHunks(originalContent, newContent, 2);
  }, [toolName, toolArgs, toolResult, status]);

  // For inline diff, only changed lines, limited count
  const inlineDiffLines = useMemo(() => {
    if (!diffData) return null;
    const changedLines = diffData.hunks.flatMap(h =>
      h.lines.filter(l => l.type === 'added' || l.type === 'removed')
    );
    if (changedLines.length === 0) return null;
    const truncated = changedLines.length > INLINE_MAX_LINES;
    return { lines: changedLines.slice(0, INLINE_MAX_LINES), truncated, total: changedLines.length };
  }, [diffData]);

  // Streaming preview: show content from toolArgs as it arrives (before result is ready)
  const streamingLines = useMemo(() => {
    if (!isOutcomeFileTool(toolName)) return null;
    if (status !== 'processing') return null;
    if (toolName === 'write_file' && typeof toolArgs?.content === 'string' && toolArgs.content.length > 0) {
      const lines = toolArgs.content.split('\n');
      const display = lines.slice(0, INLINE_MAX_LINES);
      return { lines: display, total: lines.length, truncated: lines.length > INLINE_MAX_LINES };
    }
    if (toolName === 'apply_edits' && Array.isArray(toolArgs?.edits) && toolArgs.edits.length > 0) {
      const editLines: string[] = [];
      for (const edit of toolArgs.edits) {
        if (edit.newContent) {
          const nc = edit.newContent.split('\n');
          editLines.push(...nc);
        }
      }
      if (editLines.length > 0) {
        const display = editLines.slice(0, INLINE_MAX_LINES);
        return { lines: display, total: editLines.length, truncated: editLines.length > INLINE_MAX_LINES };
      }
    }
    return null;
  }, [toolName, toolArgs, status]);

  if (isOutcomeFileTool(toolName)) {
    const isSuccess = status === 'completed';
    const actionLabel = getActionLabel(toolName, status);
    const isSearchTool = toolName === 'grep_file' || toolName === 'list_workspace';
    const grepPattern = toolName === 'grep_file'
      ? (formatQuoted(toolArgs?.pattern ?? toolResult?.pattern, 200) ?? '')
      : '';
    
    return (
      <>
        <style>{shimmerStyles}</style>
        <div
          className={diffBubbleClass}
          onClick={handleClick}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchMove={handleTouchMove}
          style={{ 
            cursor: togglePanel ? 'pointer' : 'default', 
            touchAction: 'manipulation',
            width: 'fit-content',
            minWidth: '140px'
          }}
        >
          <div className="diff-header">
            <div className="diff-header-fixed shrink-0">
              <span className="flex items-center text-(--muted)">
                {getToolIcon(toolName, toolArgs, toolResult)}
              </span>
              <span className="text-sm text-(--muted) whitespace-nowrap">
                {actionLabel}
              </span>
            </div>
            <div className="diff-header-scroll">
              {toolName === 'grep_file' && grepPattern && (
                <span className="text-sm text-(--muted) whitespace-nowrap flex-none" title={typeof toolArgs?.pattern === 'string' ? toolArgs.pattern : undefined}>
                  {grepPattern}
                </span>
              )}
              <span className="diff-filename">
                {(toolName === 'read_file' || isSearchTool)
                  ? (fileBubbleSubtitle !== '—' ? `${fileBubbleTitle} · ${fileBubbleSubtitle}` : fileBubbleTitle)
                  : fileBubbleTitle}
              </span>

              {!isSearchTool && diffData && (
                <span className="text-xs flex items-center gap-1.5 shrink-0 ml-0.5">
                  {diffData.additions > 0 && <span className="text-green-600">+{diffData.additions}</span>}
                  {diffData.deletions > 0 && <span className="text-red-600">-{diffData.deletions}</span>}
                </span>
              )}
            </div>

            <div className="shrink-0 flex items-center ml-0.5">
              {status === 'processing' && (
                <span className="inline-tool-status-dot shrink-0" />
              )}
              
              {isSuccess && (
                <svg className="w-3.5 h-3.5 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}

              {status === 'error' && (
                <svg className="w-3.5 h-3.5 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </div>
          </div>
        </div>
      </>
    );
  }

  const fallbackVerb = getActionLabel(toolName, status);
  const fallbackEtc = useMemo(() => {
    if (toolName === 'web_search' || toolName === 'multi_search') {
      let topic = toolArgs?.topics?.[0] || toolArgs?.topic;
      if (!topic && toolResult?.searches?.length) topic = toolResult.searches[0].topic;
      return topic ? getTopicName(topic) : (TOOL_DISPLAY_NAMES[toolName] ?? toolName);
    }
    if (toolName === 'google_search') {
      const topic = toolArgs?.engines?.[0] || toolArgs?.topic || toolArgs?.engine || 'google';
      return getTopicName(topic);
    }
    return displayName.startsWith(fallbackVerb) ? displayName.slice(fallbackVerb.length).trim() || (TOOL_DISPLAY_NAMES[toolName] ?? toolName) : displayName;
  }, [toolName, toolArgs, toolResult, displayName, fallbackVerb]);

  return (
    <>
      <style>{shimmerStyles}</style>
      {/* Tool preview inside message bubble */}
      <div className="text-base md:text-sm text-(--muted) ml-1">
        <button
          onClick={handleClick}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchMove={handleTouchMove}
          className="flex items-center gap-3 cursor-pointer w-full flex-nowrap overflow-hidden"
          style={{ touchAction: 'manipulation' }}
        >
          {/* Icon + tool name (or verb): never shrink or truncate */}
          <div className="shrink-0 flex items-center gap-3 flex-nowrap">
            <div className="text-(--muted) group-hover:text-(--foreground) transition-colors">
              {icon}
            </div>
            {fallbackVerb && (
              <span
                className={`text-base md:text-sm font-medium text-(--foreground) whitespace-nowrap ${
                  status === 'processing'
                    ? 'bg-linear-to-r from-transparent via-gray-400 to-transparent bg-clip-text text-transparent'
                    : ''
                }`}
                style={status === 'processing' ? {
                  backgroundSize: '200% 100%',
                  animation: 'shimmer 2s ease-in-out infinite'
                } : {}}
              >
                {fallbackVerb}
              </span>
            )}
            <span
              className={`text-base md:text-sm font-medium text-(--foreground) whitespace-nowrap ${
                status === 'processing'
                  ? 'bg-linear-to-r from-transparent via-gray-400 to-transparent bg-clip-text text-transparent'
                  : ''
              }`}
              style={status === 'processing' ? {
                backgroundSize: '200% 100%',
                animation: 'shimmer 2s ease-in-out infinite'
              } : {}}
            >
              {fallbackEtc}
            </span>
          </div>
          
          {/* Display text (subtitle): can scroll */}
          <div className="diff-header-scroll" style={{ touchAction: 'pan-x' }}>
            {inlineSubtitle && (
              <span className="text-xs text-(--muted) whitespace-nowrap flex-none">
                {inlineSubtitle}
              </span>
            )}
          </div>
          
          {/* Status indicator (never shrink, never hidden) */}
          <div className="shrink-0 flex items-center ml-auto">
            {status === 'processing' && (
              <span className="inline-tool-status-dot shrink-0" />
            )}
            {status === 'completed' && (
              <svg 
                className="w-3.5 h-3.5 text-green-500 shrink-0" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
            {status === 'error' && (
              <svg 
                className="w-3.5 h-3.5 text-red-500 shrink-0" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
          </div>
        </button>
      </div>
    </>
  );
});

export default InlineToolPreview;
