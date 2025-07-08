'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronUp, ChevronDown, FileText, Download, Copy, Check } from 'lucide-react';
import { MarkdownContent } from './MarkdownContent';

type File = {
  name: string | undefined;
  content: string;
  description?: string;
};

type ResponseData = {
  description?: string;
  files?: File[];
  isProgress?: boolean;
};

type StructuredResponseProps = {
  message: any;
  fileIndex?: number;
};

// 파일 확장자에서 언어 추론
function getLanguageFromExtension(fileName: string | undefined): string {
  // fileName이 없으면 기본값 'text' 반환
  if (!fileName || typeof fileName !== 'string') {
    return 'text';
  }
  
  const extension = fileName.toLowerCase().split('.').pop();
  const languageMap: { [key: string]: string } = {
    'js': 'javascript',
    'jsx': 'jsx',
    'ts': 'typescript',
    'tsx': 'tsx',
    'py': 'python',
    'java': 'java',
    'cpp': 'cpp',
    'c': 'c',
    'cs': 'csharp',
    'php': 'php',
    'rb': 'ruby',
    'go': 'go',
    'rs': 'rust',
    'swift': 'swift',
    'kt': 'kotlin',
    'scala': 'scala',
    'html': 'html',
    'css': 'css',
    'scss': 'scss',
    'sass': 'sass',
    'less': 'less',
    'xml': 'xml',
    'json': 'json',
    'yaml': 'yaml',
    'yml': 'yaml',
    'toml': 'toml',
    'sql': 'sql',
    'sh': 'bash',
    'bash': 'bash',
    'zsh': 'zsh',
    'fish': 'fish',
    'ps1': 'powershell',
    'r': 'r',
    'matlab': 'matlab',
    'm': 'objectivec',
    'vue': 'vue',
    'svelte': 'svelte',
    'md': 'markdown',
    'markdown': 'markdown',
    'tex': 'latex',
    'dockerfile': 'dockerfile',
  };
  
  return languageMap[extension || ''] || 'text';
}

// 파일 내용을 적절한 코드 블록으로 감싸기
function wrapContentWithCodeBlock(content: string, fileName: string | undefined): string {
  // 이미 코드 블록으로 감싸져 있는지 확인
  const hasCodeBlock = content.trim().startsWith('```');
  
  if (hasCodeBlock) {
    return content;
  }
  
  // 파일 확장자에서 언어 추론 (fileName이 없으면 'text' 반환)
  const language = getLanguageFromExtension(fileName);
  
  // 마크다운 파일이거나 일반 텍스트인 경우 그대로 반환
  if (language === 'markdown' || language === 'text') {
    return content;
  }
  
  // 코드 블록으로 감싸기
  return `\`\`\`${language}\n${content}\n\`\`\``;
}

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

export const StructuredResponse = ({ message, fileIndex }: StructuredResponseProps) => {
  const [responseData, setResponseData] = useState<ResponseData | null>(null);
  const [openFileIndexes, setOpenFileIndexes] = useState<number[]>([]);
  const fileContentRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [fileContentHeights, setFileContentHeights] = useState<{[key: number]: number}>({});
  const [copiedFileIndex, setCopiedFileIndex] = useState<number | null>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  
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
  
  // Toggle handler for the entire section
  const toggleSection = () => {
    setIsExpanded(!isExpanded);
  };

  useEffect(() => {
    // 메시지에서 구조화된 응답 데이터 추출
    const structuredResponseData = getStructuredResponseData(message);
    
    // 특정 파일 인덱스가 지정된 경우 해당 파일만 열기
    if (structuredResponseData && typeof fileIndex === 'number') {
      setOpenFileIndexes([fileIndex]);
    } else {
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
    }
    
    setResponseData(structuredResponseData);
    
    // 데이터 변경 시 refs 배열 초기화
    if (structuredResponseData?.files) {
      fileContentRefs.current = structuredResponseData.files.map(() => null);
    }
  }, [message, storageKey, fileIndex]);
  
  // 파일 콘텐츠의 높이 측정 (ResizeObserver로 대체됨)
  // useEffect(() => {
  //   if (responseData?.files) {
  //     const newHeights: {[key: number]: number} = {};
      
  //     openFileIndexes.forEach(index => {
  //       const ref = fileContentRefs.current[index];
  //       if (ref) {
  //         newHeights[index] = ref.scrollHeight;
  //       }
  //     });
      
  //     setFileContentHeights(prev => ({...prev, ...newHeights}));
  //   }
  // }, [responseData, openFileIndexes]);

  // New useEffect for dynamic height adjustment using ResizeObserver
  useEffect(() => {
    const activeObservers = new Map<number, ResizeObserver>();
      
    if (responseData && responseData.files && responseData.files.length > 0) {
      const files = responseData.files;
      openFileIndexes.forEach(index => {
        // Ensure the index is valid for files.length.
        if (index < 0 || index >= files.length) {
          return;
        }
        const contentElement = fileContentRefs.current[index];

        if (contentElement) {
          const updateHeightCallback = () => {
            requestAnimationFrame(() => {
              // Check if the ref is still valid and element is mounted
              if (fileContentRefs.current[index]) { 
                const newScrollHeight = fileContentRefs.current[index]!.scrollHeight;
                setFileContentHeights(prevHeights => {
                  if (prevHeights[index] !== newScrollHeight) {
                    return { ...prevHeights, [index]: newScrollHeight };
                  }
                  return prevHeights;
                });
              }
            });
          };

          // Initial height setting attempt + ResizeObserver for subsequent changes
          updateHeightCallback(); 

          const observer = new ResizeObserver(updateHeightCallback);
          observer.observe(contentElement);
          activeObservers.set(index, observer);
        }
      });
    }

    return () => {
      activeObservers.forEach((observer) => {
        // No need to unobserve specific elements if we disconnect the entire observer
        observer.disconnect();
      });
    };
  }, [responseData, openFileIndexes]); // fileContentRefs.current is not a state/prop, so it's not a dependency here.
  
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
    a.download = file.name || '';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  // 파일 내용 복사 핸들러
  const copyFileContent = (file: File, index: number) => {
    navigator.clipboard.writeText(file.content)
      .then(() => {
        setCopiedFileIndex(index);
        // 복사 상태 2초 후 초기화
        setTimeout(() => {
          setCopiedFileIndex(null);
        }, 2000);
      })
      .catch((err) => {
        console.error('Failed to copy file content:', err);
      });
  };

  // 파일이 없으면 렌더링하지 않음
  if (!responseData || !responseData.files || responseData.files.length === 0) {
    return null;
  }

  const isLoading = responseData.isProgress === true;

  // 특정 파일 인덱스가 지정된 경우 해당 파일만 필터링
  const filesToShow = typeof fileIndex === 'number' && fileIndex >= 0 && fileIndex < responseData.files.length
    ? [responseData.files[fileIndex]]
    : responseData.files;

  // 파일 인덱스 매핑 (단일 파일 표시 시 인덱스 조정)
  const getActualFileIndex = (displayIndex: number) => {
    return typeof fileIndex === 'number' ? fileIndex : displayIndex;
  };

  // 기존 큰 배경 박스와 헤더 제거, 파일 목록만 바로 렌더링
  return (
    <div className="space-y-4">
        {filesToShow.map((file: File, displayIndex: number) => {
          const actualIndex = getActualFileIndex(displayIndex);
          const isOpen = openFileIndexes.includes(actualIndex);
          const isSpecificFile = typeof fileIndex === 'number'; // 특정 파일 표시 여부
          
          // 특정 파일일 때는 배경 없이 바로 내용 표시
          if (isSpecificFile) {
            return (
              <div key={actualIndex}>
                {/* 파일 설명을 최상단에 표시 */}
                {file.description && (
                  <div className="mb-4 p-3 bg-[color-mix(in_srgb,var(--foreground)_3%,transparent)] rounded-lg">
                    <p className="text-sm text-[color-mix(in_srgb,var(--foreground)_70%,transparent)]">
                      {file.description}
                    </p>
                  </div>
                )}
                
                {/* 파일 내용 바로 표시 */}
                <div
                  ref={el => {
                    fileContentRefs.current[actualIndex] = el;
                    return undefined;
                  }}
                  className="max-w-full w-full overflow-x-auto"
                  style={{
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
                    <MarkdownContent content={wrapContentWithCodeBlock(file.content || '', file.name)} />
                  </div>
                </div>
              </div>
            );
          }
          
          // 기존 다중 파일 표시 로직 (파일 헤더 포함)
          return (
            <div key={actualIndex} className="border border-[color-mix(in_srgb,var(--foreground)_5%,transparent)] rounded-lg overflow-hidden">
              {/* 특정 파일이 아닐 때만 파일 헤더 표시 */}
              {!isSpecificFile && (
              <div className="bg-[color-mix(in_srgb,var(--foreground)_3%,transparent)]">
                {/* 파일 헤더 영역 - 이름과 액션 버튼 */}
                <div className="px-3 py-2.5 flex justify-between items-center">
                  <div 
                    className="flex items-center gap-2.5 truncate cursor-pointer flex-grow"
                      onClick={() => toggleFile(actualIndex)}
                  >
                    <FileText className="h-4 w-4 flex-shrink-0" strokeWidth={1.5} />
                    <span className="font-mono text-sm font-medium bg-[color-mix(in_srgb,var(--foreground)_6%,transparent)] px-2 py-0.5 rounded-md">
                      {file.name || 'Untitled'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* 다운로드 버튼 */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadFile(file);
                      }}
                      className="rounded-full p-1.5 flex-shrink-0"
                      title="Download file"
                    >
                      <Download size={16} className="text-[color-mix(in_srgb,var(--foreground)_60%,transparent)]" />
                    </button>
                    {/* 복사 버튼 */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                          copyFileContent(file, actualIndex);
                      }}
                      className="rounded-full p-1.5 flex-shrink-0"
                        title={copiedFileIndex === actualIndex ? "Copied!" : "Copy file content"}
                    >
                        {copiedFileIndex === actualIndex ? (
                        <Check size={16} className="text-green-500" />
                      ) : (
                        <Copy size={16} className="text-[color-mix(in_srgb,var(--foreground)_60%,transparent)]" />
                      )}
                    </button>
                    {/* 토글 버튼 */}
                    <div 
                      className="rounded-full p-1.5 flex-shrink-0 cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                          toggleFile(actualIndex);
                      }}
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
                      onClick={() => toggleFile(actualIndex)}
                  >
                    <p className="text-xs text-[color-mix(in_srgb,var(--foreground)_60%,transparent)] line-clamp-2">
                      {file.description}
                    </p>
                  </div>
                )}
              </div>
              )}
              <div 
                className={`overflow-hidden transition-all duration-300 ease-in-out bg-[color-mix(in_srgb,var(--foreground)_1%,transparent)] ${
                  !isSpecificFile ? 'border-t border-[color-mix(in_srgb,var(--foreground)_7%,transparent)]' : ''
                }`}
                style={{ 
                  maxHeight: (isOpen || isSpecificFile) ? (fileContentHeights[actualIndex] ? `${fileContentHeights[actualIndex]}px` : '1000px') : '0px',
                }}
              >
                <div
                  ref={el => {
                    fileContentRefs.current[actualIndex] = el;
                    return undefined;
                  }}
                  className="p-4 transition-opacity duration-300 ease-in-out max-w-full w-full overflow-x-auto"
                  style={{
                    opacity: (isOpen || isSpecificFile) ? 1 : 0,
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
                    <MarkdownContent content={wrapContentWithCodeBlock(file.content || '', file.name)} />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
    </div>
  );
}; 