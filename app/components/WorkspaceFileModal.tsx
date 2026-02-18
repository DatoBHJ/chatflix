import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Copy, Download, X } from 'lucide-react';

import { getAdaptiveGlassStyleBlur } from '@/app/lib/adaptiveGlassStyle';
import { CanvasPreviewMarkdown } from './CanvasPreviewMarkdown';
import { resolveMediaPlaceholders, type VideoMapValue } from '@/app/utils/resolveMediaPlaceholders';
import { CsvTable } from './CsvTable';

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
    txt: 'text',
  };
  return languageMap[ext] ?? 'text';
}

export function WorkspaceFileModal({
  isOpen,
  isMobile,
  path,
  content,
  binaryInfo,
  loading,
  error,
  linkMap,
  imageMap,
  videoMap,
  onClose,
}: {
  isOpen: boolean;
  isMobile: boolean;
  path: string | null;
  content: string | null;
  binaryInfo: { downloadUrl: string; filename: string } | null;
  loading: boolean;
  error: string | null;
  linkMap?: Record<string, string>;
  imageMap?: Record<string, string>;
  videoMap?: Record<string, VideoMapValue>;
  onClose: () => void;
}) {
  const isCSV = useMemo(() => !!path?.toLowerCase().endsWith('.csv') || !!path?.toLowerCase().endsWith('.tsv'), [path]);

  /** Parse CSV/TSV into rows (handles quoted fields and "" escape). */
  const csvRows = useMemo(() => {
    if (!isCSV || !content) return null;
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
  }, [isCSV, content, path]);

  const isMarkdown = useMemo(() => !!path?.toLowerCase().endsWith('.md'), [path]);
  const filename = useMemo(() => (path ? (path.replace(/^.*[/\\]/, '') || 'file') : ''), [path]);

  const resolvedDisplayContent = useMemo(() => {
    if (!content) return '';
    if (!isMarkdown) return content;
    return resolveMediaPlaceholders(content, {
      linkMap,
      imageMap,
      videoMap,
      unresolvedPolicy: 'remove',
    });
  }, [content, isMarkdown, linkMap, imageMap, videoMap]);

  const resolvedDownloadContent = useMemo(() => {
    if (!content) return '';
    if (!isMarkdown) return content;
    return resolveMediaPlaceholders(content, {
      linkMap,
      imageMap,
      videoMap,
      unresolvedPolicy: 'remove',
      imageOutput: 'url',
    });
  }, [content, isMarkdown, linkMap, imageMap, videoMap]);

  const handleCopy = () => {
    const text = binaryInfo ? binaryInfo.downloadUrl : resolvedDownloadContent;
    if (text) navigator.clipboard.writeText(text);
  };

  const handleDownload = () => {
    if (binaryInfo?.downloadUrl) {
      window.open(binaryInfo.downloadUrl, '_blank');
      return;
    }
    const text = resolvedDownloadContent || '';
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'download.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen || !path) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-9999"
      style={{ touchAction: 'none', overflow: 'hidden' }}
    >
      {isMobile ? (
        <>
          {/* Backdrop (click to close) - Select Text와 동일 */}
          <div className="fixed inset-0 bg-transparent" onClick={onClose} style={{ touchAction: 'none' }} />

          {/* Bottom sheet - Select Text와 동일 구조: Handle → 제목만 → 액션행 → 컨텐츠 */}
          <div
            className="fixed inset-x-0 bottom-0 w-full flex flex-col overflow-hidden rounded-t-3xl"
            style={{
              height: 'calc(100vh - 120px)',
              maxHeight: 'calc(100vh - 120px)',
              transform: 'translateY(0px)',
              transition: 'transform 0.35s cubic-bezier(0.25, 0.1, 0.25, 1), opacity 0.25s ease-out',
              willChange: 'transform, opacity',
              opacity: 1,
              ...getAdaptiveGlassStyleBlur(),
              backgroundColor: (typeof window !== 'undefined' && (
                document.documentElement.getAttribute('data-theme') === 'dark' ||
                (document.documentElement.getAttribute('data-theme') === 'system' &&
                  window.matchMedia('(prefers-color-scheme: dark)').matches)
              )) ? 'rgba(30, 30, 30, 0.6)' : 'rgba(240, 240, 240, 0.6)',
              backdropFilter: 'blur(40px)',
              WebkitBackdropFilter: 'blur(40px)',
              zIndex: 9999,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 드래그 핸들 - Select Text와 동일 */}
            <div className="text-center pt-4 pb-4 shrink-0">
              <div className="w-12 h-1.5 rounded-full mx-auto" style={{ backgroundColor: 'rgba(209, 213, 219, 0.3)' }} />
            </div>

            {/* 헤더: 제목만 가운데 (Select Text와 동일, 닫기는 backdrop 탭으로) */}
            <div className="relative flex items-center justify-center py-6 px-6 shrink-0">
              <h2 className="text-2xl font-bold truncate" style={{ color: 'var(--foreground)', maxWidth: 'calc(100vw - 48px)' }}>
                {filename}
              </h2>
            </div>

            {/* 액션 행: Select Text의 md/txt 토글 위치와 동일 (pt-2 pb-6) */}
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

            {/* 컨텐츠: Select Text의 텍스트 영역과 동일 구조 */}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden px-4 pb-6">
              <div
                className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
                style={{
                  WebkitUserSelect: 'text',
                  userSelect: 'text',
                  touchAction: 'pan-y',
                  wordBreak: 'break-word',
                  overflowWrap: 'break-word',
                }}
              >
                {error && (
                  <div className="text-sm text-red-500">{error}</div>
                )}
                {!error && binaryInfo && (
                  <div className="text-sm opacity-80" style={{ color: 'var(--foreground)' }}>
                    Binary file. Use Download to open the file.
                  </div>
                )}
                {!error && !binaryInfo && content && (
                  <div className="p-4 rounded-xl border border-[color-mix(in_srgb,var(--foreground)_10%,transparent)] bg-[color-mix(in_srgb,var(--foreground)_2%,transparent)]">
                    {isCSV && csvRows && csvRows.length > 0 ? (
                      <CsvTable rows={csvRows} />
                    ) : (
                      <CanvasPreviewMarkdown
                        isMainFile={true}
                        content={isMarkdown
                          ? resolvedDisplayContent
                          : `\`\`\`${getLanguageFromPath(path)}\n${content}\n\`\`\``}
                        filePath={path ?? undefined}
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="fixed inset-0 text-(--foreground) pointer-events-auto" style={{ zIndex: 9999 }}>
          {/* Blur overlay */}
          <div
            className="fixed inset-0 min-h-screen w-full pointer-events-none"
            style={{ backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)', zIndex: 0.5 }}
          />
          {/* Invisible overlay for backdrop click handling */}
          <div className="absolute inset-0 pointer-events-auto" style={{ backgroundColor: 'transparent', zIndex: 1 }} onClick={onClose} />

          <div className="relative h-full w-full flex flex-col transform-gpu" style={{ zIndex: 2 }} onClick={(e) => e.stopPropagation()}>
            <button
              aria-label="Close"
              className="absolute top-3 right-3 rounded-full p-2 z-10 cursor-pointer transition-all duration-200 hover:scale-105 active:scale-95"
              onClick={onClose}
              style={{ outline: '0 !important', WebkitTapHighlightColor: 'transparent', ...getAdaptiveGlassStyleBlur(), color: 'var(--foreground)' }}
            >
              <X size={20} />
            </button>

            <div className="px-12 sm:px-16 md:px-20 lg:px-28 pt-12 sm:pt-30 pb-24 overflow-y-auto">
              {/* 제목만 (Select Text와 동일: flex justify-between, h2 + spacer) */}
              <div className="flex items-center justify-between">
                <h2 className="text-3xl sm:text-3xl md:text-4xl font-semibold tracking-tight truncate min-w-0" style={{ color: 'var(--foreground)' }}>
                  {filename}
                </h2>
                <div />
              </div>
              <div className="text-xs mt-2 truncate opacity-70" style={{ color: 'var(--foreground)' }}>
                {path}
              </div>

              {/* mt-12: 제목 아래 액션+컨텐츠 (Select Text의 md/txt 토글 위치와 동일) */}
              <div className="mt-12 ml-1">
                {/* Copy/Download - Select Text의 md/txt 토글 row와 동일 */}
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
                {error && (
                  <div className="text-sm text-red-500">{error}</div>
                )}
                {!error && binaryInfo && (
                  <div className="text-sm opacity-80" style={{ color: 'var(--foreground)' }}>
                    Binary file. Use Download to open the file.
                  </div>
                )}
                {!error && !binaryInfo && content && (
                  <div className="p-4 rounded-xl border border-[color-mix(in_srgb,var(--foreground)_10%,transparent)] bg-[color-mix(in_srgb,var(--foreground)_2%,transparent)]">
                    {isCSV && csvRows && csvRows.length > 0 ? (
                      <div className="overflow-x-auto rounded-lg border border-[color-mix(in_srgb,var(--foreground)_8%,transparent)] bg-(--muted/20)">
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
                    ) : (
                      <CanvasPreviewMarkdown
                        isMainFile={true}
                        content={isMarkdown
                          ? resolvedDisplayContent
                          : `\`\`\`${getLanguageFromPath(path)}\n${content}\n\`\`\``}
                        filePath={path ?? undefined}
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}

