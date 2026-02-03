import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ExternalLink, CheckCircle, XCircle, Eye, EyeOff, Copy, Check } from 'lucide-react';

type LinkReaderProps = {
  linkAttempts: {
    url: string;
    title?: string;
    error?: string;
    timestamp?: string;
    success?: boolean;
    status?: 'in_progress' | 'success' | 'failed';
  }[];
  rawContent?: {
    url: string;
    title: string;
    content: string;
    contentType: string;
    contentLength: number;
    timestamp: string;
  }[];
  selectedUrl?: string;
};

/** Loading dots animation for in_progress state */
function LoadingDots() {
  return (
    <span className="inline-flex items-center gap-1" aria-label="Loading">
      <span className="w-1.5 h-1.5 rounded-full bg-(--muted-foreground)/70 animate-[linkReaderDot_1.2s_ease-in-out_infinite]" />
      <span className="w-1.5 h-1.5 rounded-full bg-(--muted-foreground)/70 animate-[linkReaderDot_1.2s_ease-in-out_0.2s_infinite]" />
      <span className="w-1.5 h-1.5 rounded-full bg-(--muted-foreground)/70 animate-[linkReaderDot_1.2s_ease-in-out_0.4s_infinite]" />
    </span>
  );
}

/**
 * LinkReader Component
 * Displays a list of links that were attempted to be read by the Jina.ai link reader tool.
 * Apple-style card layout with soft backgrounds and clear status indicators.
 */
export default function LinkReader({ linkAttempts, rawContent, selectedUrl }: LinkReaderProps) {
  const [expandedContent, setExpandedContent] = useState<Set<string>>(new Set());
  const [copiedUrls, setCopiedUrls] = useState<Set<string>>(new Set());

  if (!linkAttempts?.length) return null;

  const displayAttempts = selectedUrl
    ? linkAttempts.filter(attempt => attempt.url === selectedUrl)
    : linkAttempts;

  if (displayAttempts.length === 0) return null;

  const toggleContent = (url: string) => {
    const newExpanded = new Set(expandedContent);
    if (newExpanded.has(url)) {
      newExpanded.delete(url);
    } else {
      newExpanded.add(url);
    }
    setExpandedContent(newExpanded);
  };

  const copyContent = async (url: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedUrls(prev => new Set(prev).add(url));
      setTimeout(() => {
        setCopiedUrls(prev => {
          const newSet = new Set(prev);
          newSet.delete(url);
          return newSet;
        });
      }, 2000);
    } catch (error) {
      console.error('Failed to copy content:', error);
    }
  };

  const getRawContentForUrl = (url: string) => {
    return rawContent?.find(content => content.url === url);
  };

  const getStatusDisplay = (attempt: LinkReaderProps['linkAttempts'][0]) => {
    const isFailed = attempt.status === 'failed' || !!attempt.error;
    const isSuccess = attempt.status === 'success';

    if (isFailed) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium bg-red-500/15 text-red-600 dark:text-red-400">
          <XCircle size={12} className="shrink-0" aria-hidden />
          Failed
        </span>
      );
    }
    if (isSuccess) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
          <CheckCircle size={12} className="shrink-0" aria-hidden />
          Success
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium text-(--muted-foreground)" aria-live="polite">
        <LoadingDots />
        Loading
      </span>
    );
  };

  const actionButtonClass =
    'p-2 rounded-full transition-colors hover:bg-[color-mix(in_srgb,var(--foreground)_8%,transparent)] active:opacity-70 min-w-[36px] min-h-[36px] flex items-center justify-center';

  return (
    <div className="px-4 py-3">
      <style>{`
        @keyframes linkReaderDot {
          0%, 80%, 100% { opacity: 0.4; transform: scale(0.9); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}</style>
      <h4 className="text-sm font-semibold text-(--foreground) mb-4">Links</h4>
      <div className="space-y-4">
        {displayAttempts.map((attempt, index) => {
          const rawData = getRawContentForUrl(attempt.url);
          const isExpanded = expandedContent.has(attempt.url);
          const isCopied = copiedUrls.has(attempt.url);

          return (
            <div
              key={index}
              className="rounded-2xl bg-[color-mix(in_srgb,var(--foreground)_4%,transparent)] p-4 sm:p-5"
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={attempt.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-(--foreground) hover:underline truncate inline-flex items-center gap-1.5"
                    >
                      <ExternalLink size={14} className="shrink-0 text-(--muted-foreground)" aria-hidden />
                      {attempt.title || attempt.url}
                    </a>
                    {getStatusDisplay(attempt)}
                  </div>
                  {attempt.error && (
                    <div
                      className="mt-3 rounded-lg px-3 py-2 text-sm bg-red-500/10 text-red-600 dark:text-red-400"
                      role="alert"
                    >
                      {attempt.error}
                    </div>
                  )}
                </div>
                {rawData && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleContent(attempt.url)}
                      className={actionButtonClass}
                      title={isExpanded ? 'Hide raw content' : 'Show raw content'}
                      aria-expanded={isExpanded}
                    >
                      {isExpanded ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => copyContent(attempt.url, rawData.content)}
                      className={actionButtonClass}
                      title="Copy raw content"
                    >
                      {isCopied ? (
                        <Check size={18} className="text-emerald-600 dark:text-emerald-400" aria-hidden />
                      ) : (
                        <Copy size={18} aria-hidden />
                      )}
                    </button>
                  </div>
                )}
              </div>

              {rawData && isExpanded && (
                <div className="mt-4 pt-4">
                  <div className="rounded-xl bg-[color-mix(in_srgb,var(--foreground)_6%,transparent)] overflow-hidden">
                    <div className="px-4 pt-3 pb-2">
                      <p className="text-xs font-medium text-(--muted-foreground)">Raw content</p>
                      <p className="text-xs text-(--muted-foreground)/80 mt-0.5">
                        {rawData.contentLength} characters · {rawData.contentType}
                      </p>
                    </div>
                    <div className="rounded-b-xl p-4 max-h-96 overflow-y-auto no-scrollbar bg-[color-mix(in_srgb,var(--foreground)_6%,transparent)]">
                      <div className="prose prose-sm dark:prose-invert max-w-none wrap-break-word">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{rawData.content}</ReactMarkdown>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
