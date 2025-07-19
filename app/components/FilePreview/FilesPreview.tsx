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

  const isLoading = responseData.isProgress === true;

  // 파일 크기 계산 함수
  const calculateFileSize = (content: string): number => {
    // UTF-8 인코딩 기준으로 바이트 크기 계산
    return new Blob([content]).size;
  };

  // 파일 아이콘 엘리먼트 생성 함수
  const getFileIconElement = (fileName: string) => {
    try {
      const icon = getIcon(fileName || '');
      return (
        <div 
          style={{ width: '24px', height: '24px' }}
          dangerouslySetInnerHTML={{ __html: icon.svg }}
        />
      );
    } catch (error) {
      // 아이콘 생성 실패 시 기본 파일 아이콘
      return (
        <div className="w-6 h-6 bg-gray-300 rounded flex items-center justify-center text-xs text-gray-600">
          📄
        </div>
      );
    }
  };

  // 파일 다운로드 핸들러
  const handleDownload = (e: React.MouseEvent, file: any) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!file.content || isLoading) return;
    
    try {
      // Blob 생성
      const blob = new Blob([file.content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      
      // 다운로드 링크 생성
      const link = document.createElement('a');
      link.href = url;
      link.download = file.name || 'download.txt';
      
      // 링크를 DOM에 추가하고 클릭한 후 제거
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // URL 정리
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

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
                <button
                  onClick={(e) => handleDownload(e, file)}
                  className="hover:bg-black/10 dark:hover:bg-white/10 rounded p-1 transition-colors"
                  title="Download file"
                >
                  <Download className="text-neutral-500" size={20} />
                </button>
              </div>
            )}
            {/* 로딩 중일 때 로딩 표시 */}
            {isLoading && (
              <div className="p-1">
                <div className="w-5 h-5 flex items-center justify-center">
                  <div className="loading-dots text-xs">
                    <span>.</span>
                    <span>.</span>
                    <span>.</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}); 