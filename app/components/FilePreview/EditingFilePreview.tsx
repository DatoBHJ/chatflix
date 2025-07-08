import React, { memo } from 'react'
import { fileHelpers } from '../ChatInput/FileUpload'
import { getIcon } from 'material-file-icons'

// 편집 모드 전용 파일 미리보기 컴포넌트
export const EditingFilePreview = memo(function EditingFilePreview({ 
  files, 
  fileMap, 
  removeFile 
}: { 
  files: globalThis.File[];
  fileMap: Map<string, { file: globalThis.File, url: string }>;
  removeFile: (file: globalThis.File) => void;
}) {
  if (!files.length) return null;

  const getFileIconElement = (fileName: string | undefined) => {
    const icon = getIcon(fileName || 'file.txt');
    return (
      <div 
        style={{ width: '32px', height: '32px' }}
        dangerouslySetInnerHTML={{ __html: icon.svg }}
      />
    );
  };

  // 파일 크기 계산 함수
  const getFileSize = (file: globalThis.File): string => {
    const isExisting = (file as any).isExisting;
    
    if (isExisting) {
      // 기존 파일의 경우 attachmentData에서 크기 정보 가져오기
      const attachmentData = (file as any).attachmentData;
      if (attachmentData?.metadata?.fileSize) {
        return fileHelpers.formatFileSize(attachmentData.metadata.fileSize);
      }
      // 메타데이터에 크기 정보가 없으면 Unknown size
      return 'Unknown size';
    } else {
      // 새 파일의 경우 실제 파일 크기 사용
      return fileHelpers.formatFileSize(file.size);
    }
  };

  return (
    <div className="file-preview-wrapper -mx-2 px-4 pt-4 pb-1 mt-3 mb-3 relative">
      <div className="file-preview-container grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 gap-y-3 pb-2">
        {files.map((file) => {
          const fileId = (file as any).id;
          const fileData = fileMap.get(fileId);
          const isImage = file.type.startsWith('image/');
          
          return (
            <div 
              key={fileId}
              className="file-preview-item relative rounded-lg flex flex-col overflow-hidden transition-all duration-200 hover:translate-y-[-2px]"
              style={{ 
                aspectRatio: '1',
                backgroundColor: `var(--accent)`,
              }}
            >
              <button
                onClick={() => removeFile(file)}
                className="absolute top-1.5 right-1.5 w-7 h-7 md:w-6 md:h-6 md:top-2 md:right-2 flex items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--background)_80%,var(--foreground)_20%)] text-[var(--foreground)] text-xs z-10 transition-all duration-200 hover:opacity-100 hover:bg-[color-mix(in_srgb,var(--background)_70%,var(--foreground)_30%)] opacity-70"
                aria-label={`Remove file ${file.name || 'Unknown file'}`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
              
              <div className="flex-1 w-full flex items-center justify-center overflow-hidden">
                {isImage && fileData?.url ? (
                  <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                    <img 
                      src={fileData.url} 
                      alt={file.name || 'Image file'} 
                      className="w-full h-full object-contain"
                      loading="lazy"
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center text-center p-3 h-full">
                    {getFileIconElement(file.name)}
                  </div>
                )}
              </div>
              
              <div className="w-full px-2.5 py-2">
                <div className="text-[12px] font-normal truncate tracking-tight" title={file.name || 'Unknown file'}>
                  {file.name || 'Unknown file'}
                </div>
                <div className="text-[9px] opacity-60 mt-0.5 font-medium tracking-tight">
                  {getFileSize(file)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}); 