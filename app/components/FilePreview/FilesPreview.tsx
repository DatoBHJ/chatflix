import React, { memo } from 'react'
import { Download } from 'lucide-react'
import { fileHelpers } from '../ChatInput/FileUpload'
import { getIcon } from 'material-file-icons'

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

  const getFileIconElement = (fileName?: string) => {
    if (!fileName) {
      // 로딩 중일 때 기본 파일 아이콘
      const defaultIcon = getIcon('file.txt');
      return (
        <div 
          style={{ width: '24px', height: '24px' }}
          dangerouslySetInnerHTML={{ __html: defaultIcon.svg }}
        />
      );
    }
    
    const icon = getIcon(fileName);
    return (
      <div 
        style={{ width: '24px', height: '24px' }}
        dangerouslySetInnerHTML={{ __html: icon.svg }}
      />
    );
  };

  // 파일 크기 계산 함수 (UTF-8 바이트 크기)
  const calculateFileSize = (content?: string): number => {
    if (!content) return 0;
    // UTF-8 인코딩에서 문자열의 바이트 크기 계산
    return new Blob([content]).size;
  };

  const isLoading = responseData.isProgress === true;

  return (
    <div className="flex flex-col gap-2 mt-2">
      {responseData.files.map((file: any, index: number) => {
        const fileName = file.name || (isLoading ? 'Generating file...' : 'Unknown file');
        
        // 파일 크기 계산 - content가 있으면 바이트 크기 계산, 없으면 로딩/기본 메시지
        let fileSize: string;
        if (isLoading) {
          fileSize = 'Processing...';
        } else if (file.content) {
          const sizeInBytes = calculateFileSize(file.content);
          fileSize = fileHelpers.formatFileSize(sizeInBytes);
        } else {
          fileSize = 'Unknown size';
        }
        
        return (
          <div
            key={index}
            className="imessage-file-bubble"
            onClick={() => togglePanel && togglePanel(messageId, 'structuredResponse', index, undefined, file.name)}
            style={{
              cursor: togglePanel ? 'pointer' : 'default',
              opacity: isLoading ? 0.8 : 1
            }}
          >
            {/* File Icon */}
            <div className="flex-shrink-0">
              {getFileIconElement(file.name)}
            </div>
            {/* File Info */}
            <div className="flex-1 text-left overflow-hidden">
              <p className="font-medium truncate text-sm text-black/60 dark:text-white/80">
                {fileName}
              </p>
              <p className="text-xs text-black/40 dark:text-white/60">
                {fileSize}
              </p>
            </div>
            {/* Download Icon - 완료된 파일에만 표시 */}
            {!isLoading && (
              <div className="p-1">
                <Download className="text-neutral-500" size={20} />
              </div>
            )}
            {/* 로딩 중일 때 로딩 표시 */}
            {isLoading && (
              <div className="p-1">
                <div className="loading-dots text-xs">
                  <span>.</span>
                  <span>.</span>
                  <span>.</span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}); 