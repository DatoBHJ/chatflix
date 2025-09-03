// app/components/chat/ChatInput/FileUpload.tsx
import { ReactNode, memo, useState, useEffect, useRef, useMemo } from 'react';
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
      className="input-btn transition-all duration-300 flex items-center justify-center relative rounded-md w-9 h-9 text-[var(--muted)] hover:text-[var(--foreground)]"
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

// LazyImage 컴포넌트 - 이미지를 지연 로딩
const LazyImage = memo(function LazyImage({ 
  src, 
  alt,
  onLoad
}: { 
  src: string; 
  alt: string; 
  onLoad: () => void;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [isInView, setIsInView] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    
    if (imgRef.current) {
      observer.observe(imgRef.current);
    }
    
    return () => {
      observer.disconnect();
    };
  }, []);
  
  const handleLoad = () => {
    setIsLoaded(true);
    onLoad();
  };
  
  return (
    <div className="w-full h-full flex items-center justify-center overflow-hidden" ref={imgRef}>
      {isInView && (
        <img 
          src={src} 
          alt={alt} 
          className={`w-full h-full object-contain transition-all duration-300 ${isLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
          onLoad={handleLoad}
          loading="lazy"
        />
      )}
      {(!isInView || !isLoaded) && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-5 h-5 border-none rounded-full animate-spin opacity-40"></div>
        </div>
      )}
    </div>
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
  
  // 파일 확장자 캐싱 (불필요한 문자열 작업 방지)
  const fileExtension = useMemo(() => file.name.split('.').pop()?.toUpperCase() || 'FILE', [file.name]);
  
  // 파일 메타데이터 정보 (experimental_attachments의 metadata 사용)
  const metadata = (file as any).metadata;
  
  // 메타데이터 표시 텍스트 생성
  const getMetadataText = useMemo(() => {
    if (!metadata) return fileHelpers.formatFileSize(file.size);
    
    const parts = [fileHelpers.formatFileSize(file.size)];
    
    // 이미지 메타데이터
    if (metadata.width && metadata.height) {
      parts.push(`${metadata.width}×${metadata.height}`);
    }
    
    // PDF 메타데이터
    if (metadata.pageCount) {
      parts.push(`${metadata.pageCount}p`);
    }
    
    // 토큰 추정치 (1000 이상일 때만 표시)
    if (metadata.estimatedTokens && metadata.estimatedTokens >= 1000) {
      const tokenText = metadata.estimatedTokens >= 1000 ? 
        `${Math.round(metadata.estimatedTokens / 1000 * 10) / 10}K tok` : 
        `${metadata.estimatedTokens} tok`;
      parts.push(tokenText);
    }
    
    return parts.join(' • ');
  }, [metadata, file.size]);
  
  // 모바일과 데스크톱 환경에 따른 삭제 버튼 스타일 계산
  const deleteButtonClasses = useMemo(() => [
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
  ].filter(Boolean).join(" "), [hovered]);
  
  // 파일 타입에 따른 아이콘 결정
  let fileIcon;
  
  if (isImage) {
    const imageUrl = fileData?.url;
    if (imageUrl) {
      fileIcon = (
        <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
          <LazyImage 
            src={imageUrl} 
            alt={file.name} 
            onLoad={() => setLoaded(true)}
          />
          {/* 이미지 위에 메타데이터 오버레이 */}
          {metadata?.width && metadata?.height && (
            <div className="absolute bottom-1 left-1 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded backdrop-blur-sm">
              {metadata.width}×{metadata.height}
            </div>
          )}
        </div>
      );
    }
  } else if (file.type.includes('text') || 
           /\.(js|jsx|ts|tsx|html|css|json|md|py|java|c|cpp|cs|go|rb|php|swift|kt|rs)$/i.test(file.name)) {
    fileIcon = (
      <div className="flex flex-col items-center justify-center text-center p-3 h-full">
        <span className="text-[10px] font-mono mt-2 px-1.5 py-0.5 rounded bg-[color-mix(in_srgb,var(--background)_7%,transparent)]">
          {fileExtension}
        </span>
        {/* 코드 파일 라인 수 표시 */}
        {metadata?.lineCount && (
          <div className="text-[8px] opacity-60 mt-1">
            {metadata.lineCount} lines
          </div>
        )}
      </div>
    );
  } else if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    fileIcon = (
      <div className="flex flex-col items-center justify-center text-center p-3 h-full">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="opacity-70">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
          <polyline points="10 9 9 9 8 9"/>
        </svg>
        <span className="text-[10px] font-mono mt-1 px-1.5 py-0.5 rounded bg-[color-mix(in_srgb,var(--background)_7%,transparent)]">
          PDF
        </span>
        {/* PDF 페이지 수 표시 */}
        {metadata?.pageCount && (
          <div className="text-[8px] opacity-60 mt-1">
            {metadata.pageCount} pages
          </div>
        )}
      </div>
    );
  } else {
    fileIcon = (
      <div className="flex flex-col items-center justify-center text-center p-3 h-full">
        <span className="text-[10px] font-mono mt-2 px-1.5 py-0.5 rounded bg-[color-mix(in_srgb,var(--background)_7%,transparent)]">
          {fileExtension}
        </span>
      </div>
    );
  }
  
  const handleRemove = () => {
    removeFile(file);
  };
  
  return (
    <div 
      className={`file-preview-item relative rounded-lg flex flex-col overflow-hidden transition-all duration-200 
                 ${hovered ? 'translate-y-[-2px]' : ''}`}
      style={{ 
        aspectRatio: '1',
        backgroundColor: `var(--accent)`,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        onClick={handleRemove}
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
      
      <div className="w-full px-2.5 py-2">
        <div className="text-[12px] font-normal truncate tracking-tight" title={file.name}>
          {file.name}
        </div>
        <div className="text-[9px] opacity-60 mt-0.5 font-medium tracking-tight" title={getMetadataText}>
          {getMetadataText}
        </div>
      </div>
    </div>
  );
});

// 청크 단위로 파일 렌더링하는 메모이제이션 컴포넌트
const ChunkedFileItems = memo(function ChunkedFileItems({
  files,
  fileMap,
  removeFile,
  chunkSize = 5
}: {
  files: File[];
  fileMap: Map<string, { file: File, url: string }>;
  removeFile: (file: File) => void;
  chunkSize?: number;
}) {
  const [renderedCount, setRenderedCount] = useState(chunkSize);
  
  // 더 많은 파일 렌더링
  useEffect(() => {
    if (renderedCount < files.length) {
      const timer = setTimeout(() => {
        setRenderedCount(prev => Math.min(prev + chunkSize, files.length));
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [renderedCount, files.length, chunkSize]);
  
  // 파일 수가 변경될 때 렌더링 수 리셋
  useEffect(() => {
    setRenderedCount(Math.min(chunkSize, files.length));
  }, [files.length, chunkSize]);
  
  // 현재 렌더링할 파일들
  const visibleFiles = files.slice(0, renderedCount);
  
  return (
    <>
      {visibleFiles.map((file, index) => {
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
    </>
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
      className={`file-preview-wrapper -mx-2 px-4 pb-1 mt-3 mb-3 relative transition-all duration-300 ${fadeEffect ? 'opacity-95' : 'opacity-100'}`}
    >
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
        <ChunkedFileItems 
          files={files}
          fileMap={fileMap}
          removeFile={removeFile}
          chunkSize={8} // 한 번에 8개씩 렌더링
        />
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