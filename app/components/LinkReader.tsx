import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChevronDown, ChevronUp } from 'lucide-react';

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

/**
 * LinkReader Component
 * Displays a list of links that were attempted to be read by the Jina.ai link reader tool
 */
export default function LinkReader({ linkAttempts, rawContent, selectedUrl }: LinkReaderProps) {
  const [expandedContent, setExpandedContent] = useState<Set<string>>(new Set());

  if (!linkAttempts?.length) return null;

  const displayAttempts = selectedUrl
    ? linkAttempts.filter(attempt => attempt.url === selectedUrl)
    : linkAttempts;

  if (displayAttempts.length === 0) return null;

  const getStatusMeta = (attempt: LinkReaderProps['linkAttempts'][0]) => {
    const isFailed = attempt.status === 'failed' || attempt.error;
    const isSuccess = attempt.status === 'success';

    if (isFailed) return { label: 'Failed', dotClass: 'bg-red-500' };
    if (isSuccess) return { label: 'Fetched', dotClass: 'bg-green-500' };
    return { label: 'Fetching', dotClass: 'bg-blue-500 animate-pulse' };
  };

  const toggleContent = (url: string) => {
    const newExpanded = new Set(expandedContent);
    if (newExpanded.has(url)) {
      newExpanded.delete(url);
    } else {
      newExpanded.add(url);
    }
    setExpandedContent(newExpanded);
  };

  const getRawContentForUrl = (url: string) => {
    return rawContent?.find(content => content.url === url);
  };

  return (
    <div className="px-1 py-4">
      <div className="space-y-3">
        {displayAttempts.map((attempt, index) => {
          const rawData = getRawContentForUrl(attempt.url);
          const isExpanded = expandedContent.has(attempt.url);
          const status = getStatusMeta(attempt);
              
          return (
            <div key={index} className="overflow-hidden rounded-2xl border border-[color-mix(in_srgb,var(--foreground)_9%,transparent)] bg-[color-mix(in_srgb,var(--foreground)_2%,transparent)]">
              <div className="flex items-center gap-2 px-3.5 py-2.5 min-w-0">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${status.dotClass}`} />
                <span className="text-sm text-(--muted) shrink-0">{status.label}</span>
                <a
                  href={attempt.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-w-0 flex-1 truncate text-sm text-(--foreground) hover:opacity-75 transition-opacity"
                  title={attempt.url}
                >
                  {attempt.url}
                </a>
                {rawData && (
                  <button
                    onClick={() => toggleContent(attempt.url)}
                    className="shrink-0 text-(--muted) hover:text-(--foreground) transition-colors p-0.5"
                    title={isExpanded ? 'Hide content' : 'Show content'}
                  >
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                )}
              </div>
              {attempt.error && (
                <div className="px-3.5 pb-2.5 text-xs text-red-500/90">
                  {attempt.error}
                </div>
              )}
              
              {rawData && isExpanded && (
                <div className="border-t border-[color-mix(in_srgb,var(--foreground)_7%,transparent)] px-3.5 py-3">
                  <div className="mb-2 flex items-center justify-between text-[10px] text-(--muted)">
                    <span>{rawData.contentType}</span>
                    <span>{rawData.contentLength.toLocaleString()} chars</span>
                  </div>
                  <div className="max-h-[380px] overflow-y-auto">
                    <div className="prose prose-sm dark:prose-invert max-w-none wrap-break-word text-sm">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {rawData.content}
                      </ReactMarkdown>
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
