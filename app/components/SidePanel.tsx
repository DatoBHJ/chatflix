'use client'

import { Message } from 'ai'
import Canvas from '@/app/components/Canvas';
import { StructuredResponse } from '@/app/components/StructuredResponse';
import { getYouTubeLinkAnalysisData, getYouTubeSearchData, getWebSearchResults, getMathCalculationData, getLinkReaderData, getImageGeneratorData, getAcademicSearchData } from '@/app/hooks/toolFunction';
import React, { useState } from 'react';
import { AttachmentTextViewer } from './AttachmentTextViewer';

interface SidePanelProps {
  activePanel: { messageId: string; type: 'canvas' | 'structuredResponse' | 'attachment'; fileIndex?: number; toolType?: string; fileName?: string } | null;
  messages: Message[];
  togglePanel: (messageId: string, type: 'canvas' | 'structuredResponse' | 'attachment', fileIndex?: number, toolType?: string, fileName?: string) => void;
  canvasContainerRef: React.RefObject<HTMLDivElement | null>;
}

export function SidePanel({
  activePanel,
  messages,
  togglePanel,
  canvasContainerRef
}: SidePanelProps) {
  const [copiedFileIndex, setCopiedFileIndex] = useState<string | null>(null);

  if (!activePanel?.messageId) {
    return (
      <div 
        className={`fixed sm:relative top-[60px] sm:top-0 right-0 bottom-0 
          w-full sm:w-0 bg-[var(--background)] sm:border-l 
          border-[color-mix(in_srgb,var(--foreground)_7%,transparent)] 
          overflow-hidden z-0 
          transition-all duration-300 ease-in-out transform 
          translate-x-full sm:translate-x-0 sm:opacity-0 
          scrollbar-minimal`}
        style={{ 
          height: 'calc(100vh - 60px)',
          maxHeight: '100%'
        }}
        ref={canvasContainerRef}
      />
    );
  }

  const activeMessage = messages.find(msg => msg.id === activePanel.messageId);
  if (!activeMessage) return null;

  const webSearchData = getWebSearchResults(activeMessage);
  const mathCalculationData = getMathCalculationData(activeMessage);
  const linkReaderData = getLinkReaderData(activeMessage);
  const imageGeneratorData = getImageGeneratorData(activeMessage);
  const academicSearchData = getAcademicSearchData(activeMessage);
  const youTubeSearchData = getYouTubeSearchData(activeMessage);
  const youTubeLinkAnalysisData = getYouTubeLinkAnalysisData(activeMessage);

  const getPanelTitle = () => {
    if (activePanel.type === 'canvas') {
      if (activePanel.toolType) {
        const toolNames: { [key: string]: string } = {
          'web-search': 'Web Search',
          'calculator': 'Calculator', 
          'link-reader': 'Link Reader',
          'image-generator': 'Image Generator',
          'academic-search': 'Academic Search',
          'x-search': 'X Search',
          'youtube-search': 'YouTube Search',
          'youtube-analyzer': 'YouTube Analyzer'
        };
        return toolNames[activePanel.toolType] || 'Canvas Tool';
      }
      
      // If no toolType specified, determine title based on available data
      // Show specific tool name if only one tool has data
      const activeToolsCount = [
        webSearchData,
        mathCalculationData,
        linkReaderData,
        imageGeneratorData,
        academicSearchData,
        youTubeSearchData,
        youTubeLinkAnalysisData
      ].filter(Boolean).length;
      
      if (activeToolsCount === 1) {
        if (webSearchData) return 'Web Search';
        if (mathCalculationData) return 'Calculator';
        if (linkReaderData) return 'Link Reader';
        if (imageGeneratorData) return 'Image Generator';
        if (academicSearchData) return 'Academic Search';
        if (youTubeSearchData) return 'YouTube Search';
        if (youTubeLinkAnalysisData) return 'YouTube Analysis';
      }
      
      return 'Canvas';
    }
    if (activePanel.type === 'attachment') {
      return activePanel.fileName || 'Attachment';
    }
    return activePanel.fileName || 'File Details';
  };

  const getPanelSubtitle = () => {
    if (activePanel.type === 'canvas' && !activePanel.toolType) {
      const canvasDataSummary: string[] = [];
      if (webSearchData) canvasDataSummary.push('Web Search');
      if (mathCalculationData) canvasDataSummary.push('Calculator');
      if (linkReaderData) canvasDataSummary.push('Link Reader');
      if (imageGeneratorData) canvasDataSummary.push('Image Gen');
      if (academicSearchData) canvasDataSummary.push('Academic Search');
      if (youTubeSearchData) canvasDataSummary.push('YouTube Search');
      if (youTubeLinkAnalysisData) canvasDataSummary.push('YouTube Analysis');

      // Only show subtitle if there are multiple tools (since single tool name is already in title)
      if (canvasDataSummary.length > 1) {
        return canvasDataSummary.join(', ');
      }
    }
    if (activePanel.type === 'attachment') {
      return 'User uploaded file';
    }
    return null;
  };

  const renderFileActions = () => {
    // StructuredResponse 파일 액션
    if (activePanel.type === 'structuredResponse' && typeof activePanel.fileIndex === 'number') {
      // StructuredResponse.tsx와 동일한 방식으로 파일 데이터 가져오기
      const getStructuredResponseData = (message: any) => {
        const structuredResponseAnnotation = message.annotations?.find(
          (annotation: any) => annotation.type === 'structured_response'
        );
        
        if (structuredResponseAnnotation?.data?.response) {
          return structuredResponseAnnotation.data.response;
        }
        
        if (message.tool_results?.structuredResponse?.response) {
          return message.tool_results.structuredResponse.response;
        }
        
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
      
      const responseData = getStructuredResponseData(activeMessage);
      const filesForPanel = responseData?.files;
      if (!filesForPanel || activePanel.fileIndex < 0 || activePanel.fileIndex >= filesForPanel.length) {
        return null;
      }

      const selectedFile = filesForPanel[activePanel.fileIndex];
      const copyKey = `${activePanel.messageId}-${activePanel.fileIndex}`;
      const isCopied = copiedFileIndex === copyKey;
      
      const downloadFile = () => {
        const blob = new Blob([selectedFile.content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = selectedFile.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      };
      
      const copyFileContent = () => {
        navigator.clipboard.writeText(selectedFile.content)
          .then(() => {
            setCopiedFileIndex(copyKey);
            // 2초 후 복사 상태 초기화
            setTimeout(() => {
              setCopiedFileIndex(null);
            }, 2000);
          })
          .catch((err) => {
            console.error('Failed to copy file content:', err);
          });
      };
      
      return (
        <>
          {/* 다운로드 버튼 */}
          <button
            onClick={downloadFile}
            className="rounded-full p-1.5 sm:p-2 hover:bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] transition-colors"
            title="Download file"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" className="sm:w-[18px] sm:h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7,10 12,15 17,10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </button>
          {/* 복사 버튼 */}
          <button
            onClick={copyFileContent}
            className={`rounded-full p-1.5 sm:p-2 hover:bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] transition-all duration-200 ${
              isCopied ? 'text-green-500' : 'text-[var(--foreground)]'
            }`}
            title={isCopied ? "Copied!" : "Copy file content"}
          >
            {isCopied ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" className="sm:w-[18px] sm:h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5"/>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" className="sm:w-[18px] sm:h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                <path d="M4 16c-1.1 0-2-.9-2 2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
              </svg>
            )}
          </button>
        </>
      );
    }

    // Attachment 파일 액션
    if (activePanel.type === 'attachment' && typeof activePanel.fileIndex === 'number') {
      const attachments = (activeMessage as any).experimental_attachments;
      if (!attachments || activePanel.fileIndex < 0 || activePanel.fileIndex >= attachments.length) {
        return null;
      }

      const selectedAttachment = attachments[activePanel.fileIndex];
      
      const downloadAttachment = () => {
        window.open(selectedAttachment.url, '_blank');
      };
      
      return (
        <>
          {/* 다운로드 버튼 */}
          <button
            onClick={downloadAttachment}
            className="rounded-full p-1.5 sm:p-2 hover:bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] transition-colors"
            title="Download file"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" className="sm:w-[18px] sm:h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7,10 12,15 17,10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </button>
        </>
      );
    }

    return null;
  };

  // 사용자 첨부파일 렌더링 함수
  const renderAttachmentContent = () => {
    if (activePanel.type !== 'attachment' || typeof activePanel.fileIndex !== 'number') {
      return null;
    }

    const attachments = (activeMessage as any).experimental_attachments;
    if (!attachments || activePanel.fileIndex < 0 || activePanel.fileIndex >= attachments.length) {
      return <div className="text-center text-[var(--muted)]">Attachment not found</div>;
    }

    const attachment = attachments[activePanel.fileIndex];
    const isImage = attachment.contentType?.startsWith('image/');
    const isPDF = attachment.contentType === 'application/pdf' || attachment.name?.toLowerCase().endsWith('.pdf');
    const isText = attachment.contentType?.startsWith('text/') || 
                   attachment.contentType?.includes('json') ||
                   attachment.contentType?.includes('xml') ||
                   attachment.contentType?.includes('javascript') ||
                   attachment.contentType?.includes('typescript') ||
                   attachment.contentType?.includes('html') ||
                   attachment.contentType?.includes('css') ||
                   (attachment.name && /\.(txt|md|js|jsx|ts|tsx|html|css|json|xml|py|java|c|cpp|cs|go|rb|php|swift|kt|rs|sql|sh|yml|yaml|toml|ini|cfg|conf|log)$/i.test(attachment.name));

    if (isImage) {
      return (
        <div className="flex justify-center">
          <img 
            src={attachment.url} 
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
            src={`${attachment.url}#toolbar=1&navpanes=1&scrollbar=1`}
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
      return <AttachmentTextViewer attachment={attachment} />;
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

  return (
    <div 
      className="fixed sm:relative top-[60px] sm:top-0 right-0 bottom-0 
        w-full sm:w-full sm:h-full bg-[var(--background)] sm:border-l 
        border-[color-mix(in_srgb,var(--foreground)_7%,transparent)] 
        overflow-y-auto z-0 
        transition-all duration-300 ease-in-out transform 
        translate-x-0 opacity-100 sm:flex-shrink-0 
        scrollbar-minimal"
      style={{ 
        height: 'calc(100vh - 60px)',
        maxHeight: '100%',
        minWidth: 0 // Prevent flex item from overflowing
      }}
      ref={canvasContainerRef}
    >
      {/* 패널 헤더 */}
      <div className="sticky top-0 z-20 bg-[var(--background)] flex items-center justify-between px-3 sm:px-4 h-auto py-2 sm:py-2.5 border-b border-[color-mix(in_srgb,var(--foreground)_7%,transparent)]">
        <div className="flex items-center min-w-0 flex-1">
          <button 
            onClick={() => togglePanel(activePanel.messageId, activePanel.type, activePanel.fileIndex, activePanel.toolType)}
            className="w-8 h-8 flex items-center justify-center mr-2 sm:mr-3 flex-shrink-0"
            aria-label="Close panel"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
          <div className="flex flex-col min-w-0 flex-1">
            <h3 className="text-base sm:text-lg font-semibold truncate">
              {getPanelTitle()}
            </h3>
            {getPanelSubtitle() && (
              <p className="text-xs text-[var(--muted)] mt-0.5 truncate">{getPanelSubtitle()}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          {renderFileActions()}
        </div>
      </div>

      {/* 패널 내용 */}
      <div className="px-3 sm:px-4 pt-3 sm:pt-4 pb-28 min-w-0 flex-1 overflow-hidden">
        <div key={`panel-content-${activeMessage.id}`} className="h-full overflow-y-auto">
          {activePanel.type === 'canvas' && (
            <Canvas
              webSearchData={webSearchData}
              mathCalculationData={mathCalculationData}
              linkReaderData={linkReaderData}
              imageGeneratorData={imageGeneratorData}
              academicSearchData={academicSearchData}
              youTubeSearchData={youTubeSearchData}
              youTubeLinkAnalysisData={youTubeLinkAnalysisData}
              isCompact={false} // 패널에서는 항상 전체 보기
              selectedTool={activePanel.toolType} // 선택된 도구 전달
            />
          )}
          {activePanel.type === 'structuredResponse' && (
            <StructuredResponse message={activeMessage} fileIndex={activePanel.fileIndex} />
          )}
          {activePanel.type === 'attachment' && renderAttachmentContent()}
        </div>
      </div>
    </div>
  );
} 