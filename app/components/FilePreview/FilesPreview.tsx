import React, { memo } from 'react'
import { ImageIcon, FileText } from 'lucide-react'
import { fileHelpers } from '../ChatInput/FileUpload'

// 새로운 FilesPreview 컴포넌트
export const FilesPreview = memo(function FilesPreview({
  messageId,
  togglePanel,
  message
}: {
  messageId: string;
  togglePanel?: (messageId: string, type: 'canvas' | 'structuredResponse', fileIndex?: number, toolType?: string, fileName?: string) => void;
  message: any; // message 객체를 직접 받아서 스트리밍 데이터에 접근
}) {
  // StructuredResponse.tsx와 동일한 방식으로 스트리밍 데이터 처리
  const getStructuredResponseData = (message: any) => {
    // 1. 먼저 annotations에서 확인
    const structuredResponseAnnotation = message.annotations?.find(
      (annotation: any) => annotation.type === 'structured_response'
    );
    
    if (structuredResponseAnnotation?.data?.response) {
      return structuredResponseAnnotation.data.response;
    }
    
    // 2. tool_results에서 확인
    if (message.tool_results?.structuredResponse?.response) {
      return message.tool_results.structuredResponse.response;
    }
    
    // 3. 진행 중인 응답 확인 (가장 최신 것)
    const progressAnnotations = message.annotations?.filter(
      (annotation: any) => annotation.type === 'structured_response_progress'
    );
    
    if (progressAnnotations?.length > 0) {
      const latestProgress = progressAnnotations[progressAnnotations.length - 1];
      if (latestProgress.data?.response) {
        return {
          ...latestProgress.data.response,
          isProgress: true
        };
      }
    }
    
    return null;
  };

  const responseData = getStructuredResponseData(message);
  
  // 파일이 없으면 렌더링하지 않음
  if (!responseData || !responseData.files || responseData.files.length === 0) {
    return null;
  }

  const getFileIcon = (fileType?: string) => {
    if (fileType?.startsWith('image/')) return <ImageIcon size={16} />;
    if (fileType === 'application/pdf') return <FileText size={16} />;
    if (fileType?.includes('text') || fileType?.includes('script')) return <FileText size={16} />;
    return <FileText size={16} />; // 기본 아이콘
  };

  // 파일명을 확장자 유지하면서 중간 부분을 ... 로 처리하는 함수
  const truncateFileName = (fileName?: string, maxLength: number = 35) => {
    if (!fileName || typeof fileName !== 'string') {
      return 'Loading file...'; // 이름이 없으면 로딩 중으로 표시
    }
    
    if (fileName.length <= maxLength) return fileName;
    
    const lastDotIndex = fileName.lastIndexOf('.');
    if (lastDotIndex === -1) {
      // 확장자가 없는 경우
      return fileName.slice(0, maxLength - 3) + '...';
    }
    
    const name = fileName.slice(0, lastDotIndex);
    const extension = fileName.slice(lastDotIndex);
    
    // 확장자를 포함한 길이가 maxLength를 초과하는 경우
    const availableLength = maxLength - extension.length - 3; // 3은 ... 의 길이
    if (availableLength <= 0) {
      return '...' + extension;
    }
    
    return name.slice(0, availableLength) + '...' + extension;
  };

  return (
    <div className="mt-6">
      <div className="grid grid-cols-1 gap-2">
        {responseData.files.map((file: any, index: number) => {
          return (
            <div
              key={index}
              className="flex items-center gap-2 p-2.5 bg-[color-mix(in_srgb,var(--foreground)_3%,transparent)] rounded-lg min-w-0 border border-[color-mix(in_srgb,var(--foreground)_7%,transparent)] hover:border-[color-mix(in_srgb,var(--foreground)_10%,transparent)] transition-colors cursor-pointer max-w-md"
              onClick={() => togglePanel && togglePanel(messageId, 'structuredResponse', index, undefined, file.name)} 
              title={file.name ? `View ${file.name}` : 'View loading file...'}
            >
              <div className="flex items-center justify-center w-7 h-7 rounded-md bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] flex-shrink-0">
                {getFileIcon(file.type)}
              </div>
              <div className="flex-1 min-w-0 overflow-hidden">
                <div className="text-sm font-medium" title={file.name || 'Loading file...'}>
                  {truncateFileName(file.name)}
                </div>
                <div className="text-xs text-[var(--muted)] truncate">
                  {file.size ? fileHelpers.formatFileSize(file.size) : (file.type || (file.name ? '' : 'Processing...'))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}); 