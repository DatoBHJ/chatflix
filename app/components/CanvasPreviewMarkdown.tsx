'use client';

import React, { useMemo, useCallback, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import { Copy, Check, X, RotateCcw } from 'lucide-react';
import type { DiffLine } from '@/app/utils/diffUtils';

const MermaidDiagram = dynamic(() => import('./Mermaid'), {
  ssr: false,
  loading: () => (
    <div className="my-6 flex items-center justify-center h-[200px] w-full rounded-xl border border-[color-mix(in_srgb,var(--foreground)_10%,transparent)] bg-[color-mix(in_srgb,var(--foreground)_3%,transparent)]">
      <p className="text-[color-mix(in_srgb,var(--foreground)_50%,transparent)] text-sm">Loading diagram...</p>
    </div>
  ),
});

const DynamicChart = dynamic(() => import('./charts/DynamicChart'), {
  ssr: false,
  loading: () => (
    <div className="my-6 flex items-center justify-center h-[300px] w-full rounded-xl border border-[color-mix(in_srgb,var(--foreground)_10%,transparent)] bg-[color-mix(in_srgb,var(--foreground)_3%,transparent)]">
      <p className="text-[color-mix(in_srgb,var(--foreground)_50%,transparent)] text-sm">Loading chart...</p>
    </div>
  ),
});

const remarkPlugins: any = [[remarkGfm, { singleTilde: false }]];
const rehypePlugins: any = [rehypeRaw, rehypeHighlight];

// Helper function to extract text content from React children
function extractTextFromChildren(children: any): string {
  if (typeof children === 'string') {
    return children;
  }
  if (typeof children === 'number') {
    return String(children);
  }
  if (Array.isArray(children)) {
    return children.map(child => extractTextFromChildren(child)).join('');
  }
  if (React.isValidElement(children)) {
    const props = children.props as any;
    if (props && props.children) {
      return extractTextFromChildren(props.children);
    }
    return '';
  }
  return '';
}

function isCompleteJSON(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return false;
  let braceCount = 0;
  let inString = false;
  let escapeNext = false;
  for (let i = 0; i < trimmed.length; i++) {
    const char = trimmed[i];
    if (escapeNext) { escapeNext = false; continue; }
    if (char === '\\') { escapeNext = true; continue; }
    if (char === '"') { inString = !inString; continue; }
    if (!inString) {
      if (char === '{') braceCount++;
      else if (char === '}') braceCount--;
    }
  }
  return braceCount === 0;
}

function parseChartConfig(text: string): { success: boolean; config?: any; error?: string } {
  const problematicPatterns = [
    /callback[s]?\s*:\s*["\'][^"\']*function\s*\([^)]*\)[^"\']*["\']/gi,
    /["\'][^"\']*\\(?!["\'\\\/bfnrt]|u[0-9a-fA-F]{4})[^"\']*["\']/g,
    /["\'][^"\']*\\\s*\n[^"\']*["\']/g,
  ];
  for (const pattern of problematicPatterns) {
    if (pattern.test(text)) {
      return { success: false, error: 'Chart configuration contains unsupported patterns.' };
    }
  }
  try {
    const config = JSON.parse(text);
    return { success: true, config };
  } catch (jsonError) {
    try {
      const fixedText = text
        .replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":')
        .replace(/'([^'\\]*(\\.[^'\\]*)*)'/g, '"$1"')
        .replace(/,(\s*[}\]])/g, '$1')
        .replace(/\/\/.*$/gm, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\\(?!["\\\/bfnrt]|u[0-9a-fA-F]{4})/g, '\\\\');
      const config = JSON.parse(fixedText);
      return { success: true, config };
    } catch (fixError) {
      const jsonErrorMsg = jsonError instanceof Error ? jsonError.message : 'Unknown';
      const fixErrorMsg = fixError instanceof Error ? fixError.message : 'Unknown';
      return { success: false, error: `JSON Error: ${jsonErrorMsg}, Fix Error: ${fixErrorMsg}` };
    }
  }
}

export function CanvasPreviewMarkdown({
  content,
  className = '',
  diffSegments,
  previewLineDiffMap,
  rejectedBlocks,
  acceptedBlocks,
  onReject,
  onAccept,
  onUndo,
  onUndoAccept,
  isMainFile = false,
  highlightLineNumbers,
  scrollToLine,
}: {
  content: string;
  className?: string;
  diffSegments?: Array<{ type: 'context'; lines: DiffLine[] } | { type: 'change'; block: { id: string; lines: DiffLine[] } }>;
  previewLineDiffMap?: Map<number, 'added' | 'removed' | 'context'> | null;
  rejectedBlocks?: Set<string>;
  acceptedBlocks?: Set<string>;
  onReject?: (blockId: string) => void;
  onAccept?: (blockId: string) => void;
  onUndo?: (blockId: string) => void;
  onUndoAccept?: (blockId: string) => void;
  isMainFile?: boolean;
  /** Line numbers (1-based) to highlight with slate background (read_file range, grep matches). */
  highlightLineNumbers?: Set<number>;
  /** Line number (1-based) to scroll into view when available. */
  scrollToLine?: number;
}) {
  const handleCopy = useCallback((text: string, event: React.MouseEvent<HTMLButtonElement>) => {
    const btn = event.currentTarget;
    navigator.clipboard.writeText(text).then(() => {
      const originalContent = btn.innerHTML;
      btn.innerHTML = '<span class="flex items-center gap-1"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-check"><path d="M20 6 9 17l-5-5"/></svg> Copied!</span>';
      setTimeout(() => {
        btn.innerHTML = originalContent;
      }, 2000);
    });
  }, []);

  const components = useMemo(() => ({
    h1: ({ children, ...props }: any) => (
      <h1 className="text-2xl font-semibold tracking-tight mt-8 mb-4 first:mt-0" {...props}>
        {children}
      </h1>
    ),
    h2: ({ children, ...props }: any) => (
      <h2 className="text-xl font-semibold tracking-tight mt-8 mb-4 first:mt-0 border-b border-[color-mix(in_srgb,var(--foreground)_10%,transparent)] pb-2" {...props}>
        {children}
      </h2>
    ),
    h3: ({ children, ...props }: any) => (
      <h3 className="text-lg font-semibold tracking-tight mt-6 mb-3 first:mt-0" {...props}>
        {children}
      </h3>
    ),
    p: ({ children, ...props }: any) => {
      // <p> cannot contain block elements (div, pre). Custom code/table components render divs, so use div when any child is a React element to avoid hydration error.
      const hasElementChild = React.Children.toArray(children).some((child) => React.isValidElement(child) && typeof child.type !== 'string');
      const Tag = hasElementChild ? 'div' : 'p';
      return (
        <Tag className="leading-relaxed my-4 text-[15px] text-[color-mix(in_srgb,var(--foreground)_90%,transparent)]" {...props}>
          {children}
        </Tag>
      );
    },
    ul: ({ children, ...props }: any) => (
      <ul className="list-disc pl-6 my-4 space-y-2" {...props}>
        {children}
      </ul>
    ),
    ol: ({ children, ...props }: any) => (
      <ol className="list-decimal pl-6 my-4 space-y-2" {...props}>
        {children}
      </ol>
    ),
    li: ({ children, ...props }: any) => (
      <li className="text-[15px] leading-relaxed" {...props}>
        {children}
      </li>
    ),
    blockquote: ({ children, ...props }: any) => (
      <blockquote className="border-l-4 border-[color-mix(in_srgb,var(--foreground)_20%,transparent)] pl-4 my-6 italic text-[color-mix(in_srgb,var(--foreground)_70%,transparent)]" {...props}>
        {children}
      </blockquote>
    ),
    a: ({ children, href, ...props }: any) => {
      // Canvas file previews: make links obviously clickable.
      // (Chat UI styling remains unchanged; this component is only used in CanvasPreviewMarkdown.)
      const safeHref = typeof href === 'string' ? href : undefined;
      return (
        <a
          href={safeHref}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 dark:text-blue-400 underline underline-offset-2 hover:opacity-90 wrap-break-word"
          {...props}
        >
          {children}
        </a>
      );
    },
    code: ({ node, inline, className, children, ...props }: any) => {
      const match = /language-(\w+)/.exec(className || '');
      const language = match ? match[1] : '';
      const isMain = isMainFile && !inline;
      const codeText = extractTextFromChildren(children).replace(/\n$/, '');
      
      // For diff highlighting, we need the raw code text without syntax highlighting
      // But we'll apply syntax highlighting manually if needed

      if (inline) {
        return (
          <code className="bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
            {children}
          </code>
        );
      }

      if (language === 'mermaid') {
        return (
          <div className="my-6">
            <MermaidDiagram chart={codeText} title="Mermaid Diagram" />
          </div>
        );
      }

      if (language === 'chartjs') {
        if (!isCompleteJSON(codeText)) {
          return (
            <div className="my-6 flex items-center justify-center h-[300px] w-full rounded-xl border border-[color-mix(in_srgb,var(--foreground)_10%,transparent)] bg-[color-mix(in_srgb,var(--foreground)_3%,transparent)]">
              <p className="text-[color-mix(in_srgb,var(--foreground)_50%,transparent)] text-sm">Loading chart...</p>
            </div>
          );
        }
        const parseResult = parseChartConfig(codeText);
        if (parseResult.success && parseResult.config) {
          const chartConfig = parseResult.config;
          if (typeof chartConfig === 'object' && chartConfig !== null && typeof chartConfig.type === 'string' && typeof chartConfig.data === 'object' && chartConfig.data !== null) {
            return (
              <div className="my-6">
                <DynamicChart chartConfig={chartConfig} />
              </div>
            );
          }
          return (
            <div className="my-6 p-4 rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-800">
              <p className="text-red-600 dark:text-red-400 font-semibold text-sm">Invalid Chart Configuration</p>
              <p className="text-red-500 dark:text-red-500 text-xs mt-1">Expected format: {`{type: string, data: object, options?: object}`}</p>
            </div>
          );
        }
        return (
          <div className="my-6 p-4 rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-800">
            <p className="text-red-600 dark:text-red-400 font-semibold text-sm">Chart Parse Error</p>
            <p className="text-red-500 dark:text-red-500 text-xs mt-1">{parseResult.error || 'Invalid JSON.'}</p>
          </div>
        );
      }

      // Use previewLineDiffMap if provided (more accurate), otherwise build from diffSegments
      const lineDiffMap = useMemo(() => {
        if (previewLineDiffMap) return previewLineDiffMap;
        if (!diffSegments) return null;
        const map = new Map<number, 'added' | 'removed' | 'context'>();
        let currentLineNo = 1;
        
        for (const seg of diffSegments) {
          if (seg.type === 'context') {
            for (const line of seg.lines) {
              if (line.newLineNo !== undefined) {
                map.set(currentLineNo, 'context');
                currentLineNo++;
              }
            }
          } else {
            // For change blocks, only 'added' lines appear in final content
            for (const line of seg.block.lines) {
              if (line.type === 'added' && line.newLineNo !== undefined) {
                map.set(currentLineNo, 'added');
                currentLineNo++;
              }
            }
          }
        }
        return map;
      }, [diffSegments, previewLineDiffMap]);

      const codeLines = codeText.split('\n');
      const hasDiff = isMain && lineDiffMap !== null && diffSegments !== undefined;
      const hasHighlight = isMain && highlightLineNumbers != null && highlightLineNumbers.size > 0;
      const containerRef = useRef<HTMLDivElement>(null);

      useEffect(() => {
        if (!isMain || !scrollToLine || !containerRef.current) return;
        const target = containerRef.current.querySelector(`[data-line-number="${scrollToLine}"]`) as HTMLElement | null;
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
          return;
        }
        const fallbackTop = Math.max(0, (scrollToLine - 1) * 20);
        containerRef.current.scrollTo({ top: fallbackTop, behavior: 'smooth' });
      }, [isMain, scrollToLine, codeLines.length]);

      // Build block-to-line-range map for button placement
      const blockLineRanges = useMemo(() => {
        if (!diffSegments) return new Map<string, { startLine: number; endLine: number }>();
        const ranges = new Map<string, { startLine: number; endLine: number }>();
        let currentLineNo = 1;
        
        for (const seg of diffSegments) {
          if (seg.type === 'change') {
            const block = seg.block;
            const startLine = currentLineNo;
            const isRejected = rejectedBlocks?.has(block.id);
            const isAccepted = acceptedBlocks?.has(block.id);
            
            let lineCount = 0;
            if (isAccepted) {
              lineCount = block.lines.filter(l => l.type === 'added').length;
            } else if (isRejected) {
              lineCount = block.lines.filter(l => l.type === 'removed').length;
            } else {
              // Show both removed and added
              lineCount = block.lines.length;
            }
            
            const endLine = startLine + lineCount - 1;
            ranges.set(block.id, { startLine, endLine });
            currentLineNo += lineCount;
          } else {
            currentLineNo += seg.lines.length;
          }
        }
        return ranges;
      }, [diffSegments, rejectedBlocks, acceptedBlocks]);

      return (
        <div className="group relative my-6 rounded-xl overflow-hidden border border-[color-mix(in_srgb,var(--foreground)_10%,transparent)] bg-[color-mix(in_srgb,var(--foreground)_2%,transparent)]">
          <div className="flex items-center justify-between px-4 py-2 bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] border-b border-[color-mix(in_srgb,var(--foreground)_10%,transparent)]">
            <span className="text-[11px] font-medium uppercase tracking-widest text-[color-mix(in_srgb,var(--foreground)_50%,transparent)]">
              {language || 'text'}
            </span>
            <button
              onClick={(e) => handleCopy(codeText, e)}
              className="text-[11px] font-medium uppercase tracking-widest text-[color-mix(in_srgb,var(--foreground)_50%,transparent)] hover:text-(--foreground) transition-colors flex items-center gap-1.5"
            >
              <Copy size={12} /> Copy
            </button>
          </div>
          <div className="relative">
            <div ref={containerRef} className="p-4 overflow-x-auto diff-preview-code relative">
              {((hasDiff && lineDiffMap) || hasHighlight) && (
                <div className="absolute inset-0 pointer-events-none" style={{ padding: '1rem' }}>
                  {codeLines.map((_, index) => {
                    const lineNo = index + 1;
                    const diffType = lineDiffMap?.get(lineNo);
                    let backgroundColor = 'transparent';
                    
                    if (diffType === 'added') {
                      backgroundColor = 'rgba(16, 185, 129, 0.12)';
                    } else if (diffType === 'removed') {
                      backgroundColor = 'rgba(239, 68, 68, 0.15)';
                    } else if (highlightLineNumbers?.has(lineNo)) {
                      backgroundColor = 'rgba(100, 116, 139, 0.15)';
                    }
                    
                    return (
                      <div
                        key={index}
                        data-line-number={lineNo}
                        style={{
                          height: '20px',
                          backgroundColor,
                          width: '100%',
                        }}
                      />
                    );
                  })}
                </div>
              )}
              <div className="hljs relative z-10">
                <pre className="font-mono text-[13px] whitespace-pre m-0 p-0" style={{ background: 'transparent', lineHeight: '20px' }}>
                  <code className={`${className} bg-transparent!`} style={{ background: 'transparent', lineHeight: '20px', display: 'block', padding: 0 }} {...props}>
                    {children}
                  </code>
                </pre>
              </div>
            </div>
            {hasDiff && blockLineRanges.size > 0 && (
              <>
                {Array.from(blockLineRanges.entries()).map(([blockId, range]) => {
                  const isRejected = rejectedBlocks?.has(blockId);
                  const isAccepted = acceptedBlocks?.has(blockId);
                  return (
                    <div
                      key={blockId}
                      className="absolute right-4 z-20 flex items-center gap-2 py-2"
                      style={{
                        top: `${range.endLine * 20 + 8}px`,
                      }}
                    >
                      {isAccepted ? (
                        <button
                          type="button"
                          className="flex items-center gap-1 text-[11px] font-medium text-[color-mix(in_srgb,var(--foreground)_60%,transparent)] hover:text-[color-mix(in_srgb,var(--foreground)_90%,transparent)] transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            onUndoAccept?.(blockId);
                          }}
                        >
                          <RotateCcw size={12} />Undo
                        </button>
                      ) : isRejected ? (
                        <button
                          type="button"
                          className="flex items-center gap-1 text-[11px] font-medium text-[color-mix(in_srgb,var(--foreground)_60%,transparent)] hover:text-[color-mix(in_srgb,var(--foreground)_90%,transparent)] transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            onUndo?.(blockId);
                          }}
                        >
                          <RotateCcw size={12} />Undo
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="flex items-center gap-1 text-[11px] font-medium text-green-500 hover:text-green-600 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              onAccept?.(blockId);
                            }}
                          >
                            <Check size={12} />Accept
                          </button>
                          <button
                            type="button"
                            className="flex items-center gap-1 text-[11px] font-medium text-red-500 hover:text-red-600 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              onReject?.(blockId);
                            }}
                          >
                            <X size={12} />Reject
                          </button>
                        </>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>
      );
    },
    table: ({ children, ...props }: any) => (
      <div className="my-6 w-full overflow-x-auto rounded-xl border border-[color-mix(in_srgb,var(--foreground)_10%,transparent)]">
        <table className="w-full border-collapse text-sm text-left" {...props}>
          {children}
        </table>
      </div>
    ),
    thead: ({ children, ...props }: any) => (
      <thead className="bg-[color-mix(in_srgb,var(--foreground)_3%,transparent)] border-b border-[color-mix(in_srgb,var(--foreground)_10%,transparent)]" {...props}>
        {children}
      </thead>
    ),
    th: ({ children, ...props }: any) => (
      <th className="px-4 py-3 font-semibold text-[color-mix(in_srgb,var(--foreground)_70%,transparent)]" {...props}>
        {children}
      </th>
    ),
    td: ({ children, ...props }: any) => (
      <td className="px-4 py-3 border-b border-[color-mix(in_srgb,var(--foreground)_5%,transparent)] last:border-0" {...props}>
        {children}
      </td>
    ),
    hr: () => (
      <hr className="my-8 border-t border-[color-mix(in_srgb,var(--foreground)_10%,transparent)]" />
    ),
  }), [handleCopy, diffSegments, previewLineDiffMap, rejectedBlocks, acceptedBlocks, onReject, onAccept, onUndo, onUndoAccept, isMainFile, highlightLineNumbers, scrollToLine]);

  return (
    <div className={`max-w-full wrap-break-word ${className}`}>
      <style jsx>{`
        div :global(.prose) {
          color: var(--foreground);
        }
        div :global(table) {
          width: 100%;
          border-spacing: 0;
        }
        div :global(pre::-webkit-scrollbar) {
          height: 8px;
        }
        div :global(pre::-webkit-scrollbar-track) {
          background: transparent;
        }
        div :global(pre::-webkit-scrollbar-thumb) {
          background: color-mix(in_srgb, var(--foreground) 10%, transparent);
          border-radius: 10px;
        }
        div :global(pre::-webkit-scrollbar-thumb:hover) {
          background: color-mix(in_srgb, var(--foreground) 20%, transparent);
        }
        div :global(.diff-preview-line) {
          display: block;
          width: 100%;
          padding: 0;
          margin: 0;
          min-height: 20px;
        }
        div :global(.diff-preview-line[data-diff-type="removed"]) {
          width: 100%;
          display: block;
        }
        div :global(.diff-preview-code pre) {
          line-height: 20px !important;
        }
        div :global(.diff-preview-code code) {
          line-height: 20px !important;
          display: block;
        }
        div :global(.diff-line-content) {
          display: inline-block;
          width: 100%;
        }
      `}</style>
      <div className="prose prose-sm dark:prose-invert max-w-none wrap-break-word">
        <ReactMarkdown
          remarkPlugins={remarkPlugins}
          rehypePlugins={rehypePlugins}
          components={components}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
