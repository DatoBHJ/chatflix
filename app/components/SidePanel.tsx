'use client'

import { UIMessage } from 'ai'
import Canvas from '@/app/components/Canvas';
import { StructuredResponse } from '@/app/components/StructuredResponse';
import { getYouTubeLinkAnalysisData, getYouTubeSearchData, getWebSearchResults, getMathCalculationData, getLinkReaderData, getImageGeneratorData } from '@/app/hooks/toolFunction';
import React, { useState, useEffect } from 'react';
import { AttachmentTextViewer } from './AttachmentTextViewer';

interface SidePanelProps {
  activePanel: { messageId: string; type: 'canvas' | 'structuredResponse' | 'attachment'; fileIndex?: number; toolType?: string; fileName?: string } | null;
  messages: UIMessage[];
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
  const [isMobile, setIsMobile] = useState(false);

  // 모바일 화면 여부 확인
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 640); // sm breakpoint
    };
    
    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);
    return () => window.removeEventListener('resize', checkIfMobile);
  }, []);

  if (!activePanel?.messageId) {
    return (
      <div 
        className={`fixed sm:relative sm:top-1.5 right-0 bottom-0 
          w-full sm:w-0 bg-[var(--background)] sm:border-l 
          border-[color-mix(in_srgb,var(--foreground)_7%,transparent)] 
          overflow-hidden z-[60] 
          transition-all duration-300 ease-in-out transform 
          translate-x-full sm:translate-x-0 sm:opacity-0 
          scrollbar-minimal`}
        style={{ 
          // height: 'calc(100vh - 60px)',
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
        youTubeSearchData,
        youTubeLinkAnalysisData
      ].filter(Boolean).length;
      
      if (activeToolsCount === 1) {
        if (webSearchData) return 'Web Search';
        if (mathCalculationData) return 'Calculator';
        if (linkReaderData) return 'Link Reader';
        if (imageGeneratorData) return 'Image Generator';

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
        let content = selectedFile.content;
        // 코드 블록 제거
        if (content.trim().startsWith('```')) {
          content = content.trim().replace(/^```[^\n]*\n?/, '').replace(/```$/, '');
        }
        navigator.clipboard.writeText(content)
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
      const attachmentsFromParts = (() => {
        const parts = (activeMessage as any)?.parts;
        if (!Array.isArray(parts)) return [] as any[];
        return parts
          .filter((part: any) => part.type === 'image' || part.type === 'file')
          .map((part: any, index: number) => {
            if (part.type === 'image') {
              return {
                name: `image-${index}`,
                contentType: 'image/jpeg',
                url: part.image,
                fileType: 'image' as const
              };
            } else {
              return {
                name: part.filename || `file-${index}`,
                contentType: part.mediaType || 'application/octet-stream',
                url: part.url,
                fileType: 'file' as const
              };
            }
          })
          .filter(Boolean);
      })();

      const attachments = (activeMessage as any).experimental_attachments || attachmentsFromParts;
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

    // Prefer DB attachments, but fall back to parts-derived attachments for v5-only messages
    const attachmentsFromParts = (() => {
      const parts = (activeMessage as any)?.parts;
      if (!Array.isArray(parts)) return [] as any[];
      return parts
        .filter((part: any) => part.type === 'image' || part.type === 'file')
        .map((part: any, index: number) => {
          if (part.type === 'image') {
            return {
              name: `image-${index}`,
              contentType: 'image/jpeg',
              url: part.image,
              fileType: 'image' as const
            };
          } else {
            return {
              name: part.filename || `file-${index}`,
              contentType: part.mediaType || 'application/octet-stream',
              url: part.url,
              fileType: 'file' as const
            };
          }
        })
        .filter(Boolean);
    })();

    const attachments = (activeMessage as any).experimental_attachments || attachmentsFromParts;
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
                   (attachment.name && /(\.txt|\.md|\.js|\.jsx|\.ts|\.tsx|\.html|\.css|\.json|\.xml|\.py|\.java|\.c|\.cpp|\.cs|\.go|\.rb|\.php|\.swift|\.kt|\.rs|\.sql|\.sh|\.yml|\.yaml|\.toml|\.ini|\.cfg|\.conf|\.log)$/i.test(attachment.name));

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
  className="side-panel fixed sm:relative sm:top-1.5 right-0 bottom-0 
    w-full sm:w-full sm:h-full bg-[var(--background)] sm:border-l 
    border-[color-mix(in_srgb,var(--foreground)_7%,transparent)] 
    overflow-y-auto z-[60] 
    transition-all duration-300 ease-in-out transform 
    translate-x-0 opacity-100 sm:flex-shrink-0 
    scrollbar-minimal"
  style={{ 
    height: isMobile ? '100vh' : '100%',
    maxHeight: isMobile ? '100vh' : '100%',
    minWidth: 0 // Prevent flex item from overflowing
  }}
  ref={canvasContainerRef}
>
  {/* 사파리 스타일 헤더 */}
  <div className="sticky top-0 z-20 bg-[var(--background)] flex items-center justify-between px-2 sm:px-4 py-1.5 border-b border-[color-mix(in_srgb,var(--foreground)_7%,transparent)]">
    <div className="flex items-center gap-1">
      {/* 모바일: 닫기 버튼만, 데스크톱: 사파리 스타일 버튼들 */}
      <div>
        {/* 모바일에서만 표시되는 닫기 버튼 */}
        {isMobile && (
          <button 
            onClick={() => togglePanel(activePanel.messageId, activePanel.type, activePanel.fileIndex, activePanel.toolType)}
            className="imessage-control-btn"
            title="Close panel"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        )}
        
        {/* 데스크톱에서만 표시되는 사파리 스타일 버튼들 */}
        {!isMobile && (
          <div className="flex items-center gap-2">
            {/* 빨간색 닫기 버튼 */}
            <button 
              onClick={() => togglePanel(activePanel.messageId, activePanel.type, activePanel.fileIndex, activePanel.toolType)}
              className="safari-window-button close"
              title="Close panel"
            >
              <div className="icon">
                <svg viewBox="0 0 8 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M1 1L7 7M7 1L1 7" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
                </svg>
              </div>
            </button>
            
            {/* 회색 최소화 버튼 (비활성) */}
            <button 
              className="safari-window-button minimize"
              title="Minimize (not available)"
              disabled
            />
            
            {/* 초록색 최대화 버튼 */}
            <button 
              onClick={() => {
                // 창 최대화/복원 효과
                const panel = canvasContainerRef.current;
                if (panel) {
                  if (panel.classList.contains('maximized')) {
                    // 최대화 상태에서 원래 크기로 복원
                    panel.classList.remove('maximized');
                    panel.style.position = '';
                    panel.style.top = '';
                    panel.style.right = '';
                    panel.style.bottom = '';
                    panel.style.left = '';
                    panel.style.width = '';
                    panel.style.height = '';
                    panel.style.zIndex = '';
                    panel.style.transform = '';
                    panel.style.borderRadius = '';
                  } else {
                    // 기본 상태에서 전체 화면으로 최대화
                    panel.classList.add('maximized');
                    panel.style.position = 'fixed';
                    panel.style.top = '0';
                    panel.style.right = '0';
                    panel.style.bottom = '0';
                    panel.style.left = '0';
                    panel.style.width = '100vw';
                    panel.style.height = '100vh';
                    panel.style.zIndex = '9999';
                    panel.style.transform = 'scale(1)';
                    panel.style.borderRadius = '0';
                  }
                }
              }}
              className="safari-window-button maximize"
              title="Toggle maximize"
            >
              <div className="icon">
                <svg viewBox="0 0 8 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="2" y="2" width="4" height="4" stroke="currentColor" strokeWidth="1" fill="none"/>
                </svg>
              </div>
            </button>
          </div>
        )}
      </div>
      

    </div>
    
    {/* 우측 액션 버튼들 */}
    <div className="flex items-center gap-1">
      {renderFileActions()}
    </div>
  </div>

  {/* 패널 내용 */}
  <div className="px-3 sm:px-4 pt-0 sm:pt-4 pb-28 min-w-0 flex-1 overflow-hidden">
    <div key={`panel-content-${activeMessage.id}`} className="h-full overflow-y-auto">
      {activePanel.type === 'canvas' && (
        <Canvas
          webSearchData={webSearchData}
          mathCalculationData={mathCalculationData}
          linkReaderData={linkReaderData}
          imageGeneratorData={imageGeneratorData}

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