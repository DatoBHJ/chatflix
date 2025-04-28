'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronUp, ChevronDown, FileText, Download } from 'lucide-react';
import { MarkdownContent } from './MarkdownContent';

type File = {
  name: string;
  content: string;
  description?: string;
};

type ResponseData = {
  main_response?: string;
  files?: File[];
  isProgress?: boolean;
};

type StructuredResponseProps = {
  message: any;
};


function getStructuredResponseData(message: any) {
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
}


export const StructuredResponse = ({ message }: StructuredResponseProps) => {
  const [responseData, setResponseData] = useState<ResponseData | null>(null);
  const [openFileIndexes, setOpenFileIndexes] = useState<number[]>([]);
  const fileContentRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [fileContentHeights, setFileContentHeights] = useState<{[key: number]: number}>({});
  
  // 메시지 ID에 기반한 로컬 스토리지 키 생성
  const storageKey = `structuredResponse_openFiles_${message.id}`;
  
  // 컴포넌트 마운트 시 로컬 스토리지에서 열린 파일 인덱스 불러오기
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const storedIndexes = localStorage.getItem(storageKey);
        if (storedIndexes) {
          setOpenFileIndexes(JSON.parse(storedIndexes));
        }
      } catch (error) {
        console.error('Failed to load open file indexes from localStorage:', error);
      }
    }
  }, [storageKey]);
  
  useEffect(() => {
    // 메시지에서 구조화된 응답 데이터 추출
    const structuredResponseData = getStructuredResponseData(message);
    
    // 생성 중일 때만 모든 파일 열기 (완료 시 닫지 않음)
    if (structuredResponseData) {
      const isGenerating = structuredResponseData.isProgress === true;
      if (isGenerating) {
        // 생성 중일 때는 모든 파일 열기
        const allIndexes = structuredResponseData.files ? 
          structuredResponseData.files.map((_: File, idx: number) => idx) : [];
        setOpenFileIndexes(allIndexes);
        
        // 로컬 스토리지에도 저장
        if (typeof window !== 'undefined') {
          localStorage.setItem(storageKey, JSON.stringify(allIndexes));
        }
      }
      // 생성이 완료되면 모든 파일 닫기 로직 제거 (파일 상태 유지)
    }
    
    setResponseData(structuredResponseData);
    
    // 데이터 변경 시 refs 배열 초기화
    if (structuredResponseData?.files) {
      fileContentRefs.current = structuredResponseData.files.map(() => null);
    }
  }, [message, storageKey]);
  
  // 파일 콘텐츠의 높이 측정
  useEffect(() => {
    if (responseData?.files) {
      const newHeights: {[key: number]: number} = {};
      
      openFileIndexes.forEach(index => {
        const ref = fileContentRefs.current[index];
        if (ref) {
          newHeights[index] = ref.scrollHeight;
        }
      });
      
      setFileContentHeights(prev => ({...prev, ...newHeights}));
    }
  }, [responseData, openFileIndexes]);
  
  // 파일 토글 핸들러
  const toggleFile = (index: number) => {
    const newOpenIndexes = openFileIndexes.includes(index) 
      ? openFileIndexes.filter(i => i !== index) 
      : [...openFileIndexes, index];
    
    setOpenFileIndexes(newOpenIndexes);
    
    // 로컬 스토리지에 저장
    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKey, JSON.stringify(newOpenIndexes));
    }
  };
  
  // 파일 다운로드 핸들러
  const downloadFile = (file: File) => {
    const blob = new Blob([file.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 파일이 없으면 렌더링하지 않음
  if (!responseData || !responseData.files || responseData.files.length === 0) {
    return null;
  }

  const isLoading = responseData.isProgress === true;

  return (
    <div className="p-4 sm:p-5 my-6 bg-gradient-to-br from-[color-mix(in_srgb,var(--background)_97%,var(--foreground)_3%)] to-[color-mix(in_srgb,var(--background)_99%,var(--foreground)_1%)] backdrop-blur-xl rounded-xl border border-[color-mix(in_srgb,var(--foreground)_7%,transparent)] shadow-sm overflow-hidden relative">
      {/* 헤더 */}
      <div className="flex items-center justify-between w-full mb-4">
        <div className="flex items-center gap-2.5">
          <FileText className="h-4 w-4 text-[var(--foreground)]" strokeWidth={1.5} />
          <h2 className="font-medium text-left tracking-tight">Generated Files</h2>
        </div>
        
        {/* 로딩 표시기 */}
        {isLoading && (
          <div className="flex items-center gap-2 text-xs">
            <div className="relative flex items-center">
              <div className="h-2 w-2 rounded-full bg-blue-500 animate-ping absolute"></div>
              <div className="h-2 w-2 rounded-full bg-blue-500 relative"></div>
            </div>
            <span className="text-[color-mix(in_srgb,var(--foreground)_60%,transparent)]">Generating...</span>
          </div>
        )}
      </div>
      
      {/* 파일 목록 */}
      <div className="space-y-4">
        {responseData.files.map((file: File, index: number) => {
          const isOpen = openFileIndexes.includes(index);
          
          return (
            <div key={index} className="border border-[color-mix(in_srgb,var(--foreground)_5%,transparent)] rounded-lg overflow-hidden shadow-sm transition-all hover:shadow-md hover:border-[color-mix(in_srgb,var(--foreground)_10%,transparent)]">
              <div className="bg-[color-mix(in_srgb,var(--foreground)_3%,transparent)] hover:bg-[color-mix(in_srgb,var(--foreground)_5%,transparent)] transition-colors">
                {/* 파일 헤더 영역 - 이름과 액션 버튼 */}
                <div className="px-3 py-2.5 flex justify-between items-center">
                  <div 
                    className="flex items-center gap-2.5 truncate cursor-pointer flex-grow"
                    onClick={() => toggleFile(index)}
                  >
                    <FileText className="h-4 w-4 flex-shrink-0" strokeWidth={1.5} />
                    <span className="font-mono text-sm font-medium bg-[color-mix(in_srgb,var(--foreground)_6%,transparent)] px-2 py-0.5 rounded-md">
                      {file.name}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {/* 다운로드 버튼 */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadFile(file);
                      }}
                      className="rounded-full p-1.5 hover:bg-[color-mix(in_srgb,var(--foreground)_10%,transparent)] transition-colors flex-shrink-0"
                      title="Download file"
                    >
                      <Download size={16} className="text-[color-mix(in_srgb,var(--foreground)_60%,transparent)]" />
                    </button>
                    
                    {/* 토글 버튼 */}
                    <div 
                      className="rounded-full p-1.5 hover:bg-[color-mix(in_srgb,var(--foreground)_10%,transparent)] transition-colors flex-shrink-0 cursor-pointer"
                      onClick={() => toggleFile(index)}
                    >
                      {isOpen ? 
                        <ChevronUp size={16} className="text-[color-mix(in_srgb,var(--foreground)_60%,transparent)]" /> : 
                        <ChevronDown size={16} className="text-[color-mix(in_srgb,var(--foreground)_60%,transparent)]" />
                      }
                    </div>
                  </div>
                </div>
                
                {/* 파일 설명 영역 - 별도 행에 배치 */}
                {file.description && (
                  <div 
                    className="px-3 pb-2 pt-0.5 cursor-pointer"
                    onClick={() => toggleFile(index)}
                  >
                    <p className="text-xs text-[color-mix(in_srgb,var(--foreground)_60%,transparent)] line-clamp-2">
                      {file.description}
                    </p>
                  </div>
                )}
              </div>
              
              <div 
                className="overflow-hidden transition-all duration-300 ease-in-out border-t border-[color-mix(in_srgb,var(--foreground)_7%,transparent)] bg-[color-mix(in_srgb,var(--foreground)_1%,transparent)]"
                style={{ 
                  maxHeight: isOpen ? (fileContentHeights[index] ? `${fileContentHeights[index]}px` : '1000px') : '0px',
                }}
              >
                <div
                  ref={el => {
                    fileContentRefs.current[index] = el;
                    return undefined;
                  }}
                  className="p-4 transition-opacity duration-300 ease-in-out max-w-full w-full overflow-x-auto"
                  style={{
                    opacity: isOpen ? 1 : 0,
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none'
                  }}
                >
                  <style jsx>{`
                    div::-webkit-scrollbar {
                      display: none;
                    }
                    
                    /* LaTeX 수식 스타일 덮어쓰기 */
                    :global(.katex-display) {
                      max-width: 100%;
                      overflow-x: auto;
                      overflow-y: hidden;
                      padding: 0.5rem 0;
                    }
                    
                    :global(pre) {
                      white-space: pre-wrap;
                      word-break: break-word;
                      max-width: 100%;
                      overflow-x: auto;
                    }
                    
                    :global(code) {
                      white-space: pre-wrap;
                      word-break: break-word;
                    }
                    
                    :global(table) {
                      max-width: 100%;
                      display: block;
                      overflow-x: auto;
                    }
                    
                    :global(.math), :global(.math-inline), :global(.math-display) {
                      max-width: 100%;
                      overflow-x: auto;
                      overflow-y: hidden;
                    }
                  `}</style>
                  <div className="prose prose-sm dark:prose-invert max-w-none break-words">
                    <MarkdownContent content={file.content || ''} />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}; 