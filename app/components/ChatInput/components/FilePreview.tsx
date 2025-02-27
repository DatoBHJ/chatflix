import { ReactNode } from 'react';
import { FilePreviewProps } from '../types';
import { formatFileSize, isImageFile } from '../hooks/useFileUpload';

const getFileIcon = (file: File): ReactNode => {
  const fileType = file.type;
  const fileName = file.name.toLowerCase();
  const fileExt = fileName.split('.').pop() || '';
  
  // Code files
  if (fileType.includes('text') || 
      ['js', 'jsx', 'ts', 'tsx', 'html', 'css', 'json', 'md', 'py', 'java', 
       'c', 'cpp', 'cs', 'go', 'rb', 'php', 'swift', 'kt', 'rs'].includes(fileExt)) {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="16 18 22 12 16 6"></polyline>
        <polyline points="8 6 2 12 8 18"></polyline>
      </svg>
    );
  }
  
  // PDF files
  if (fileType === 'application/pdf' || fileExt === 'pdf') {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <line x1="16" y1="13" x2="8" y2="13"></line>
        <line x1="16" y1="17" x2="8" y2="17"></line>
        <polyline points="10 9 9 9 8 9"></polyline>
      </svg>
    );
  }
  
  // Default file icon
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
      <polyline points="13 2 13 9 20 9"></polyline>
    </svg>
  );
};

const getFileTypeBadge = (file: File): string => {
  const fileType = file.type;
  const fileName = file.name.toLowerCase();
  const fileExt = fileName.split('.').pop() || '';
  
  if (fileType.startsWith('image/')) {
    return fileType.split('/')[1].toUpperCase();
  }
  
  if (fileExt) {
    return fileExt.toUpperCase();
  }
  
  return 'FILE';
};

export const FilePreview: React.FC<FilePreviewProps> = ({ files, fileMap, removeFile }) => {
  if (files.length === 0) return null;

  return (
    <div className="absolute bottom-full right-0 mb-4 bg-[var(--background)]/80 image-preview-container p-4 max-w-[80%] max-h-[200px] ml-auto">
      <div className="flex gap-4 image-preview-scroll" style={{ maxWidth: '100%' }}>
        {files.map((file) => {
          const fileData = fileMap.get(file.name);
          if (!fileData) return null;

          return isImageFile(file) ? (
            <div key={file.name} className="relative group image-preview-item flex-shrink-0">
              <div className="preview-overlay"></div>
              <span className="file-type-badge">{getFileTypeBadge(file)}</span>
              <img
                src={fileData.url}
                alt={`Preview ${file.name}`}
                className="w-24 h-24 object-cover preview-img"
              />
              <button
                onClick={() => removeFile(file)}
                className="remove-file-btn"
                type="button"
                aria-label="Remove file"
              >
                ×
              </button>
            </div>
          ) : (
            <div key={file.name} className="relative group file-preview-item flex-shrink-0">
              <span className="file-type-badge">{getFileTypeBadge(file)}</span>
              <div className="file-icon">
                {getFileIcon(file)}
              </div>
              <div className="file-name">{file.name}</div>
              <div className="file-size">{formatFileSize(file.size)}</div>
              <button
                onClick={() => removeFile(file)}
                className="remove-file-btn"
                type="button"
                aria-label="Remove file"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}; 