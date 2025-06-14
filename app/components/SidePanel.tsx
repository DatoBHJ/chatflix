'use client'

import { Message } from 'ai'
import Canvas from '@/app/components/Canvas';
import { StructuredResponse } from '@/app/components/StructuredResponse';
import { getYouTubeLinkAnalysisData, getYouTubeSearchData, getWebSearchResults, getMathCalculationData, getLinkReaderData, getImageGeneratorData, getAcademicSearchData } from '@/app/hooks/toolFunction';
import React from 'react';

interface SidePanelProps {
  activePanel: { messageId: string; type: 'canvas' | 'structuredResponse'; fileIndex?: number; toolType?: string; fileName?: string } | null;
  messages: Message[];
  togglePanel: (messageId: string, type: 'canvas' | 'structuredResponse', fileIndex?: number, toolType?: string, fileName?: string) => void;
  canvasContainerRef: React.RefObject<HTMLDivElement | null>;
}

export function SidePanel({
  activePanel,
  messages,
  togglePanel,
  canvasContainerRef
}: SidePanelProps) {
  if (!activePanel?.messageId) {
    return (
      <div 
        className={`fixed sm:relative top-[60px] sm:top-0 right-0 bottom-0 
          w-full sm:w-4/6 bg-[var(--background)] sm:border-l 
          border-[color-mix(in_srgb,var(--foreground)_7%,transparent)] 
          overflow-y-auto z-0 
          transition-all duration-300 ease-in-out transform 
          translate-x-full sm:translate-x-0 sm:max-w-0 sm:opacity-0 sm:overflow-hidden 
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
      return 'Canvas';
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

      if (canvasDataSummary.length > 0) {
        return canvasDataSummary.join(', ');
      }
    }
    return null;
  };

  const renderFileActions = () => {
    if (activePanel.type !== 'structuredResponse' || typeof activePanel.fileIndex !== 'number') {
      return null;
    }

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
          // 복사 성공 피드백
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
          className="rounded-full p-1.5 sm:p-2 hover:bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] transition-colors"
          title="Copy file content"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" className="sm:w-[18px] sm:h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
          </svg>
        </button>
      </>
    );
  };

  return (
    <div 
      className={`fixed sm:relative top-[60px] sm:top-0 right-0 bottom-0 
        w-full sm:w-4/6 bg-[var(--background)] sm:border-l 
        border-[color-mix(in_srgb,var(--foreground)_7%,transparent)] 
        overflow-y-auto z-0 
        transition-all duration-300 ease-in-out transform 
        translate-x-0 opacity-100 sm:max-w-[66.666667%] 
        scrollbar-minimal`}
      style={{ 
        height: 'calc(100vh - 60px)',
        maxHeight: '100%'
      }}
      ref={canvasContainerRef}
    >
      {/* 패널 헤더 */}
      <div className="sticky top-0 z-10 bg-[var(--background)] flex items-center justify-between px-3 sm:px-4 h-auto py-2 sm:py-2.5 border-b border-[color-mix(in_srgb,var(--foreground)_7%,transparent)]">
        <div className="flex items-center">
          <button 
            onClick={() => togglePanel(activePanel.messageId, activePanel.type, activePanel.fileIndex, activePanel.toolType)}
            className="w-8 h-8 flex items-center justify-center mr-2 sm:mr-3"
            aria-label="Close panel"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
          <div className="flex flex-col">
            <h3 className="text-base sm:text-lg font-semibold">
              {getPanelTitle()}
            </h3>
            {getPanelSubtitle() && (
              <p className="text-xs text-[var(--muted)] mt-0.5">{getPanelSubtitle()}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          {renderFileActions()}
        </div>
      </div>

      {/* 패널 내용 */}
      <div className="px-3 sm:px-4 pt-3 sm:pt-4 pb-28">
        <div key={`panel-content-${activeMessage.id}`}>
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
        </div>
      </div>
    </div>
  );
} 