import React from 'react';
import { useUrlRefresh } from '../hooks/useUrlRefresh';
import { AttachmentTextViewer } from './AttachmentTextViewer';

interface AttachmentViewerProps {
  attachment: any;
}

export const AttachmentViewer: React.FC<AttachmentViewerProps> = ({ attachment }) => {
  // URL 자동 갱신 훅 사용
  const { refreshedUrl, isRefreshing, refreshError } = useUrlRefresh({
    url: attachment.url,
    enabled: true
  });

  const isImage = attachment.contentType?.startsWith('image/');
  const isPDF = attachment.contentType === 'application/pdf' || attachment.name?.toLowerCase().endsWith('.pdf');
  const isText = attachment.contentType?.startsWith('text/') || 
                 attachment.contentType?.includes('json') ||
                 attachment.contentType?.includes('xml') ||
                 attachment.contentType?.includes('javascript') ||
                 attachment.contentType?.includes('typescript') ||
                 attachment.contentType?.includes('html') ||
                 attachment.contentType?.includes('css') ||
                 (attachment.name && /(\.txt|\.md|\.js|\.jsx|\.ts|\.tsx|\.html|\.css|\.json|\.xml|\.py|\.java|\.c|\.cpp|\.cs|\.go|\.rb|\.php|\.swift|\.kt|\.rs|\.sql|\.sh|\.yml|\.yaml|\.toml|\.ini|\.cfg|\.conf|\.log)$/i.test(attachment.name));

  if (isRefreshing) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="flex items-center gap-2 text-[color-mix(in_srgb,var(--foreground)_60%,transparent)]">
          <div className="loading-dots text-sm">
            <span>.</span>
            <span>.</span>
            <span>.</span>
          </div>
          <span className="text-sm">Loading file...</span>
        </div>
      </div>
    );
  }

  if (refreshError) {
    return (
      <div className="p-4 border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20 rounded-lg">
        <p className="text-red-600 dark:text-red-400 text-sm font-medium">Error loading file: {refreshError}</p>
        <p className="text-red-500 dark:text-red-300 text-xs mt-1">Please try refreshing the page.</p>
      </div>
    );
  }

  if (isImage) {
    return (
      <div className="flex justify-center">
        <img 
          src={refreshedUrl} 
          alt={attachment.name || 'Attachment'} 
          className="max-w-full h-auto rounded-lg"
          style={{ maxHeight: '70vh' }}
        />
      </div>
    );
  } else if (isPDF) {
    return (
      <div className="w-full h-full">
        <iframe
          src={`${refreshedUrl}#toolbar=1&navpanes=1&scrollbar=1`}
          className="w-full border border-[color-mix(in_srgb,var(--foreground)_10%,transparent)] rounded-lg"
          style={{ height: '80vh', minHeight: '600px' }}
          title={attachment.name || 'PDF Document'}
        />
        <div className="text-center mt-2 text-sm text-[color-mix(in_srgb,var(--foreground)_60%,transparent)]">
          <p>PDF preview - Use browser controls to navigate</p>
        </div>
      </div>
    );
  } else if (isText) {
    return <AttachmentTextViewer attachment={attachment} url={refreshedUrl} />;
  } else {
    // 기타 파일의 경우
    return (
      <div className="space-y-4">
        <div className="p-4 border border-[color-mix(in_srgb,var(--foreground)_10%,transparent)] rounded-lg">
          <h4 className="font-medium text-sm mb-2">File Information</h4>
          <div className="text-sm text-[var(--muted)] space-y-1">
            <p><strong>Name:</strong> {attachment.name || 'Unknown'}</p>
            <p><strong>Type:</strong> {attachment.contentType || 'Unknown'}</p>
            {attachment.metadata?.fileSize && (
              <p><strong>Size:</strong> {Math.round(attachment.metadata.fileSize / 1024)} KB</p>
            )}
          </div>
        </div>
        
        <div className="text-center text-[var(--muted)]">
          <p>Preview not available for this file type.</p>
          <p className="text-sm mt-2">Click download to view the file.</p>
        </div>
      </div>
    );
  }
};
