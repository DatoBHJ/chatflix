import React, { useState } from 'react';
import { ExternalLink, CheckCircle, XCircle, Clock, Eye, EyeOff, Copy, Check } from 'lucide-react';
import { MarkdownContent } from './MarkdownContent';

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
  const [copiedUrls, setCopiedUrls] = useState<Set<string>>(new Set());

  if (!linkAttempts?.length) return null;

  // Filter linkAttempts if selectedUrl is provided
  const displayAttempts = selectedUrl
    ? linkAttempts.filter(attempt => attempt.url === selectedUrl)
    : linkAttempts;

  if (displayAttempts.length === 0) return null;

  // Helper function to get status indicator
  const getStatusIcon = (attempt: LinkReaderProps['linkAttempts'][0]) => {
    const isFailed = attempt.status === 'failed' || attempt.error;
    const isSuccess = attempt.status === 'success';

    if (isFailed) return <XCircle size={14} className="mr-2 flex-shrink-0 text-red-500" />;
    if (isSuccess) return <CheckCircle size={14} className="mr-2 flex-shrink-0 text-green-500" />;
    return <Clock size={14} className="mr-2 flex-shrink-0 text-blue-500 animate-pulse" />;
  };

  // Helper function to toggle content expansion
  const toggleContent = (url: string) => {
    const newExpanded = new Set(expandedContent);
    if (newExpanded.has(url)) {
      newExpanded.delete(url);
    } else {
      newExpanded.add(url);
    }
    setExpandedContent(newExpanded);
  };

  // Helper function to copy content to clipboard
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

  // Helper function to get raw content for a URL
  const getRawContentForUrl = (url: string) => {
    return rawContent?.find(content => content.url === url);
  };

  return (
    <div className="px-4 py-3">
      <div className="mb-3">
        <h4 className="text-sm font-medium mb-2">Link Reading Attempts</h4>
        <div className="space-y-2">
          {displayAttempts.map((attempt, index) => {
            const isFailed = attempt.status === 'failed' || !!attempt.error;
            const statusText = isFailed 
              ? 'Failed' 
              : attempt.status === 'success' 
                ? 'Success' 
                : 'Loading...';
            
            const rawData = getRawContentForUrl(attempt.url);
            const isExpanded = expandedContent.has(attempt.url);
            const isCopied = copiedUrls.has(attempt.url);
                
            return (
              <div key={index} className="border border-[color-mix(in_srgb,var(--foreground)_10%,transparent)] rounded p-2">
                <div className="flex items-start">
                  <div className="flex-1 overflow-hidden">
                    <div className="flex items-center">
                      {getStatusIcon(attempt)}
                      <ExternalLink size={14} className="mr-2 flex-shrink-0" />
                      <a 
                        href={attempt.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-blue-500 hover:underline truncate"
                      >
                        {attempt.title || attempt.url}
                      </a>
                      <span className="text-xs ml-2 text-neutral-500">{statusText}</span>
                    </div>
                    {attempt.error && (
                      <p className="text-xs text-red-500 mt-1">
                        Error: {attempt.error}
                      </p>
                    )}
                  </div>
                  
                  {/* Raw content toggle and copy buttons */}
                  {rawData && (
                    <div className="flex items-center gap-1 ml-2">
                      <button
                        onClick={() => toggleContent(attempt.url)}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                        title={isExpanded ? "Hide raw content" : "Show raw content"}
                      >
                        {isExpanded ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                      <button
                        onClick={() => copyContent(attempt.url, rawData.content)}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                        title="Copy raw content"
                      >
                        {isCopied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                      </button>
                    </div>
                  )}
                </div>
                
                {/* Raw content display */}
                {rawData && isExpanded && (
                  <div className="mt-3 pt-3 border-t border-[color-mix(in_srgb,var(--foreground)_10%,transparent)]">
                    <div className="mb-2">
                      <h5 className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Raw Content ({rawData.contentLength} characters)
                      </h5>
                      <div className="text-xs text-gray-500 dark:text-gray-500">
                        Content Type: {rawData.contentType}
                      </div>
                    </div>
                    <div className="rounded p-3 max-h-96 overflow-y-auto bg-[var(--accent)]/30">
                      <div className="prose prose-sm dark:prose-invert max-w-none break-words">
                        <MarkdownContent content={rawData.content} variant="clean" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
} 