// app/components/chat/ChatInput/FileUpload.tsx
import { ReactNode, memo, useState, useEffect, useRef } from 'react';
import { FilePreviewProps, FileUploadButtonProps, FileHelpers } from './types';

// 파일 관련 유틸리티 함수들
export const fileHelpers: FileHelpers = {
  formatFileSize: (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  },

  getFileIcon: (file: File): ReactNode => {
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
  },

  getFileTypeBadge: (file: File): string => {
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
  },

  isImageFile: (file: File): boolean => {
    return file.type.startsWith('image/');
  },

  isTextFile: (file: File): boolean => {
    const fileType = file.type;
    const fileName = file.name.toLowerCase();
    const fileExt = fileName.split('.').pop() || '';
    
    return fileType.includes('text') || 
           ['js', 'jsx', 'ts', 'tsx', 'html', 'css', 'json', 'md', 'py', 'java', 
            'c', 'cpp', 'cs', 'go', 'rb', 'php', 'swift', 'kt', 'rs'].includes(fileExt);
  },

  isPDFFile: (file: File): boolean => {
    return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  }
};

// 파일 업로드 버튼 컴포넌트
export const FileUploadButton = memo(function FileUploadButton({ 
  filesCount, 
  onClick 
}: FileUploadButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="input-btn transition-all duration-300 flex items-center justify-center relative rounded-md w-9 h-9 text-background"
      aria-label="Attach files"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.48-8.48l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
        </svg>
      
      {filesCount > 0 && (
        <span className="absolute top-1 right-1 bg-[var(--background)] text-[var(--foreground)] text-[9px] rounded-md min-w-[14px] h-[14px] flex items-center justify-center">
          {filesCount}
        </span>
      )}
    </button>
  );
});

// 개별 파일 아이템 컴포넌트
const FileItem = memo(function FileItem({ 
  file, 
  fileData, 
  removeFile 
}: { 
  file: File;
  fileData: { url: string } | undefined;
  removeFile: (file: File) => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const [hovered, setHovered] = useState(false);
  const isImage = file.type.startsWith('image/');
  const fileExt = file.name.split('.').pop()?.toUpperCase() || 'FILE';
  
  // 모바일과 데스크톱 환경에 따른 삭제 버튼 스타일 계산
  const deleteButtonClasses = [
    "absolute top-1.5 right-1.5 w-7 h-7 md:w-6 md:h-6 md:top-2 md:right-2",
    "flex items-center justify-center rounded-full",
    "bg-[color-mix(in_srgb,var(--background)_80%,var(--foreground)_20%)]",
    "text-[var(--foreground)] text-xs z-10",
    "transition-all duration-200",
    "hover:opacity-100 hover:bg-[color-mix(in_srgb,var(--background)_70%,var(--foreground)_30%)]",
    // 모바일에서는 항상 표시, 데스크톱에서는 호버에 따라 표시
    "opacity-70 md:opacity-0",
    // 데스크톱에서 호버 시 표시
    hovered ? "md:opacity-90" : ""
  ].filter(Boolean).join(" ");
  
  // 파일 타입에 따른 아이콘 결정
  let fileIcon;
  
  if (isImage) {
    const imageUrl = fileData?.url;
    if (imageUrl) {
      fileIcon = (
        <div className="relative w-full h-full flex items-center justify-center overflow-hidden ">
          <img 
            src={imageUrl} 
            alt={file.name} 
            className={`w-full h-full object-contain transition-all duration-300 ${loaded ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
            onLoad={() => setLoaded(true)}
            loading="lazy"
          />
          {!loaded && (
            <div className="absolute inset-0 flex items-center justify-center ">
              <div className="w-5 h-5 border-none rounded-full animate-spin opacity-40"></div>
            </div>
          )}
        </div>
      );
    }
  } else if (file.type.includes('text') || 
           /\.(js|jsx|ts|tsx|html|css|json|md|py|java|c|cpp|cs|go|rb|php|swift|kt|rs)$/i.test(file.name)) {
    fileIcon = (
      <div className="flex flex-col items-center justify-center text-center p-3 h-full">
        {/* <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="background" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="16 18 22 12 16 6"></polyline>
          <polyline points="8 6 2 12 8 18"></polyline>
        </svg> */}
        <span className="text-[10px] text-background font-mono mt-2 px-1.5 py-0.5 rounded bg-[color-mix(in_srgb,var(--background)_7%,transparent)]">
          {fileExt}
        </span>
      </div>
    );
  } else {
    fileIcon = (
      <div className="flex flex-col items-center justify-center text-center p-3 h-full">
        {/* <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="background" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
          <polyline points="13 2 13 9 20 9"></polyline>
        </svg> */}
        <span className="text-[10px] text-background font-mono mt-2 px-1.5 py-0.5 rounded bg-[color-mix(in_srgb,var(--background)_7%,transparent)]">
          {fileExt}
        </span>
      </div>
    );
  }
  
  return (
    <div 
      className={`file-preview-item relative rounded-lg flex flex-col overflow-hidden transition-all duration-200 
                 ${hovered ? 'translate-y-[-2px]' : ''}`}
      style={{ 
        aspectRatio: '1',
        backgroundColor: `color-mix(in srgb, var(--foreground) 97%, var(--foreground) 3%)`,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        onClick={() => removeFile(file)}
        className={deleteButtonClasses}
        aria-label={`Remove file ${file.name}`}
        title={`Remove ${file.name}`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
      
      <div className="flex-1 w-full flex items-center justify-center overflow-hidden">
        {fileIcon}
      </div>
      
      <div className="w-full px-2.5 py-2 text-background">
        <div className="text-[12px] font-normal truncate tracking-tight" title={file.name}>
          {file.name}
        </div>
        <div className="text-[9px] opacity-60 mt-0.5 font-medium tracking-tight">
          {fileHelpers.formatFileSize(file.size)}
        </div>
      </div>
    </div>
  );
});

// 파일 미리보기 컴포넌트
export function FilePreview({ files, fileMap, removeFile }: FilePreviewProps) {
  const previewRef = useRef<HTMLDivElement>(null);
  const [fadeEffect, setFadeEffect] = useState(false);
  
  // 컴포넌트 마운트 시 애니메이션 효과
  useEffect(() => {
    if (files.length > 0) {
      setFadeEffect(true);
      const timer = setTimeout(() => setFadeEffect(false), 300);
      return () => clearTimeout(timer);
    }
  }, [files.length]);
  
  if (!files.length) return null;
  
  // 파일이 많을 때 스크롤 가능한 컨테이너 제공
  const shouldScroll = files.length > 8;
  
  return (
    <div 
      ref={previewRef}
      className={`file-preview-wrapper -mx-2 px-4 pt-4 pb-1 mt-3 mb-3 relative transition-all duration-300 ${fadeEffect ? 'opacity-95' : 'opacity-100'}`}
    >
      {/* <div className="mb-3 text-xs uppercase tracking-wider text-[var(--muted)] flex justify-between items-center">
        <span>첨부된 파일 ({files.length})</span>
      </div>
       */}
      <div 
        className={`file-preview-container grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 gap-y-3
                   ${shouldScroll ? 'max-h-[240px] overflow-y-auto pr-2 pb-8 pt-1' : 'pb-2'}`}
        role="list"
        aria-label="Uploaded files preview"
        style={{
          scrollbarWidth: 'thin',
          msOverflowStyle: 'none', /* IE and Edge */
        }}
      >
        {files.map((file, index) => {
          // 파일 ID로 맵에서 데이터 찾기
          const fileId = (file as any).id;
          const fileData = fileMap.get(fileId);
          
          return (
            <div key={fileId} style={{ '--index': index } as React.CSSProperties}>
              <FileItem 
                file={file}
                fileData={fileData}
                removeFile={removeFile}
              />
            </div>
          );
        })}
      </div>
      

      
      <style jsx>{`
        .file-preview-container::-webkit-scrollbar {
          width: 4px;
        }
        
        .file-preview-container::-webkit-scrollbar-track {
          background: transparent;
        }
        
        .file-preview-container::-webkit-scrollbar-thumb {
          background-color: color-mix(in srgb, var(--foreground) 20%, transparent);
          border-radius: 4px;
        }
        
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(5px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .file-preview-item {
          animation: fadeIn 0.3s ease-out forwards;
          animation-delay: calc(0.05s * var(--index, 0));
        }
      `}</style>
    </div>
  );
}