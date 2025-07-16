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

  // 이미지 URL 가져오기 함수
  const getImageUrl = (file: globalThis.File): string | null => {
    const fileId = (file as any).id;
    const fileData = fileMap.get(fileId);
    
    if (fileData?.url) {
      return fileData.url;
    }
    
    // 기존 파일인 경우 attachmentData에서 URL 가져오기
    const isExisting = (file as any).isExisting;
    if (isExisting) {
      const attachmentData = (file as any).attachmentData;
      if (attachmentData?.url) {
        return attachmentData.url;
      }
    }
    
    return null;
  };

  return (
    <>
      {files.map((file) => {
        const fileId = (file as any).id;
        const isImage = file.type.startsWith('image/');
        
        if (isImage) {
          const imageUrl = getImageUrl(file);
          
          if (imageUrl) {
            // 이미지 파일은 imessage-image-attachment 스타일 사용
            return (
              <div key={fileId} className="relative inline-block">
                <img 
                  src={imageUrl} 
                  alt={file.name || 'Image Attachment'}
                  className="imessage-image-attachment"
                  style={{ cursor: 'default' }}
                />
                {/* X 버튼 */}
                <button
                  onClick={() => removeFile(file)}
                  className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors z-10"
                  aria-label={`Remove file ${file.name || 'Unknown file'}`}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
            );
          }
        }
        
        // 일반 파일이거나 이미지 URL이 없는 경우 imessage-file-bubble 스타일 사용
        const fileName = file.name || '';
        const icon = getIcon(fileName);
        const fileSize = getFileSize(file);
        
        return (
          <div key={fileId} className="relative">
            <div 
              className="imessage-file-bubble" 
              style={{ cursor: 'default' }}
            >
              {/* File Icon */}
              <div className="flex-shrink-0">
                <div 
                  style={{ width: '24px', height: '24px' }}
                  dangerouslySetInnerHTML={{ __html: icon.svg }}
                />
              </div>
              {/* File Info */}
              <div className="flex-1 text-left overflow-hidden">
                <p className="font-medium truncate text-sm text-black/60 dark:text-white/80">{file.name || 'File'}</p>
                <p className="text-xs text-black/40 dark:text-white/60">{fileSize}</p>
              </div>
              {/* X 버튼 (다운로드 아이콘 대신) */}
              <div className="p-1">
                <button
                  onClick={() => removeFile(file)}
                  className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                  aria-label={`Remove file ${file.name || 'Unknown file'}`}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-neutral-500">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}); 