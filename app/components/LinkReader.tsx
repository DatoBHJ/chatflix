import React from 'react';
import { ExternalLink, CheckCircle, XCircle, Clock } from 'lucide-react';

type LinkReaderProps = {
  linkAttempts: {
    url: string;
    title?: string;
    error?: string;
    timestamp?: string;
    success?: boolean;
    status?: 'in_progress' | 'success' | 'failed';
  }[];
};

/**
 * LinkReader Component
 * Displays a list of links that were attempted to be read by the Jina.ai link reader tool
 */
export default function LinkReader({ linkAttempts }: LinkReaderProps) {
  if (!linkAttempts?.length) return null;

  // Helper function to get status indicator
  const getStatusIcon = (attempt: LinkReaderProps['linkAttempts'][0]) => {
    const isFailed = attempt.status === 'failed' || attempt.error;
    const isSuccess = attempt.status === 'success';

    if (isFailed) return <XCircle size={14} className="mr-2 flex-shrink-0 text-red-500" />;
    if (isSuccess) return <CheckCircle size={14} className="mr-2 flex-shrink-0 text-green-500" />;
    return <Clock size={14} className="mr-2 flex-shrink-0 text-blue-500 animate-pulse" />;
  };

  return (
    <div className="px-4 py-3">
      <div className="mb-3">
        <h4 className="text-sm font-medium mb-2">Link Reading Attempts</h4>
        <div className="space-y-2">
          {linkAttempts.map((attempt, index) => {
            const isFailed = attempt.status === 'failed' || !!attempt.error;
            const statusText = isFailed 
              ? 'Failed' 
              : attempt.status === 'success' 
                ? 'Success' 
                : 'Loading...';
                
            return (
              <div key={index} className="flex items-start border border-[color-mix(in_srgb,var(--foreground)_10%,transparent)] rounded p-2">
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
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
} 