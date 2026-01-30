'use client';

import { useState, useEffect } from 'react';
import { MarkdownContent } from '@/app/components/MarkdownContent';
import { ChevronRight, ChevronDown } from 'lucide-react';

interface FileInfo {
  filename: string;
  nameWithoutExt: string;
  hasAiMode: boolean;
  hasResult: boolean;
}

interface FileContent {
  filename: string;
  aiMode: {
    raw: any;
    formatted: string;
    markdown: string | null;
    hasMarkdown: boolean;
  } | null;
  result: {
    raw: any;
    formatted: string;
  } | null;
}

interface CollapsedPaths {
  [path: string]: boolean;
}

// JSON 접기/펼치기 컴포넌트
function CollapsibleJsonViewer({ data, collapsedPaths, onToggle, path = '' }: { 
  data: any; 
  collapsedPaths: CollapsedPaths;
  onToggle: (path: string) => void;
  path?: string;
}) {
  const isCollapsed = collapsedPaths[path] ?? false;
  const indent = path.split('.').length - 1;
  const indentSize = 2;

  if (data === null || data === undefined) {
    return <span style={{ color: '#808080' }}>null</span>;
  }

  if (typeof data === 'string') {
    return <span style={{ color: '#ce9178' }}>"{data}"</span>;
  }

  if (typeof data === 'number') {
    return <span style={{ color: '#b5cea8' }}>{data}</span>;
  }

  if (typeof data === 'boolean') {
    return <span style={{ color: '#569cd6' }}>{data ? 'true' : 'false'}</span>;
  }

  if (Array.isArray(data)) {
    if (data.length === 0) {
      return <span style={{ color: '#808080' }}>[]</span>;
    }

    return (
      <div>
        <span 
          onClick={() => onToggle(path)}
          style={{ cursor: 'pointer', userSelect: 'none' }}
          className="flex items-center gap-1"
        >
          {isCollapsed ? (
            <ChevronRight size={12} style={{ color: '#808080' }} />
          ) : (
            <ChevronDown size={12} style={{ color: '#808080' }} />
          )}
          <span style={{ color: '#808080' }}>[</span>
        </span>
        {!isCollapsed && (
          <div style={{ marginLeft: `${(indent + 1) * indentSize * 8}px` }}>
            {data.map((item, index) => {
              const itemPath = path ? `${path}[${index}]` : `[${index}]`;
              return (
                <div key={index} style={{ marginBottom: '2px' }}>
                  <CollapsibleJsonViewer
                    data={item}
                    collapsedPaths={collapsedPaths}
                    onToggle={onToggle}
                    path={itemPath}
                  />
                  {index < data.length - 1 && <span style={{ color: '#808080' }}>,</span>}
                </div>
              );
            })}
          </div>
        )}
        {isCollapsed && (
          <span style={{ color: '#808080', marginLeft: '4px' }}>
            ... {data.length} {data.length === 1 ? 'item' : 'items'}
          </span>
        )}
        {!isCollapsed && (
          <div style={{ marginLeft: `${indent * indentSize * 8}px` }}>
            <span style={{ color: '#808080' }}>]</span>
          </div>
        )}
      </div>
    );
  }

  if (typeof data === 'object') {
    const keys = Object.keys(data);
    if (keys.length === 0) {
      return <span style={{ color: '#808080' }}>{'{}'}</span>;
    }

    return (
      <div>
        <span 
          onClick={() => onToggle(path)}
          style={{ cursor: 'pointer', userSelect: 'none' }}
          className="flex items-center gap-1"
        >
          {isCollapsed ? (
            <ChevronRight size={12} style={{ color: '#808080' }} />
          ) : (
            <ChevronDown size={12} style={{ color: '#808080' }} />
          )}
          <span style={{ color: '#808080' }}>{'{'}</span>
        </span>
        {!isCollapsed && (
          <div style={{ marginLeft: `${(indent + 1) * indentSize * 8}px` }}>
            {keys.map((key, index) => {
              const keyPath = path ? `${path}.${key}` : key;
              return (
                <div key={key} style={{ marginBottom: '2px' }}>
                  <span style={{ color: '#9cdcfe' }}>"{key}"</span>
                  <span style={{ color: '#808080', margin: '0 4px' }}>:</span>
                  <CollapsibleJsonViewer
                    data={data[key]}
                    collapsedPaths={collapsedPaths}
                    onToggle={onToggle}
                    path={keyPath}
                  />
                  {index < keys.length - 1 && <span style={{ color: '#808080' }}>,</span>}
                </div>
              );
            })}
          </div>
        )}
        {isCollapsed && (
          <span style={{ color: '#808080', marginLeft: '4px' }}>
            ... {keys.length} {keys.length === 1 ? 'key' : 'keys'}
          </span>
        )}
        {!isCollapsed && (
          <div style={{ marginLeft: `${indent * indentSize * 8}px` }}>
            <span style={{ color: '#808080' }}>{'}'}</span>
          </div>
        )}
      </div>
    );
  }

  return <span>{String(data)}</span>;
}

export default function MarkdownPreviewerPage() {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [content, setContent] = useState<FileContent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [collapsedPaths, setCollapsedPaths] = useState<CollapsedPaths>({});
  const [leftViewMode, setLeftViewMode] = useState<'markdown' | 'json'>('markdown');
  const [leftCollapsedPaths, setLeftCollapsedPaths] = useState<CollapsedPaths>({});

  // 파일 목록 로드
  useEffect(() => {
    const loadFiles = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/admin/markdown-previewer?action=list');
        if (!response.ok) {
          throw new Error('Failed to load files');
        }
        const data = await response.json();
        setFiles(data.files || []);
        if (data.files && data.files.length > 0) {
          setCurrentIndex(0);
        }
      } catch (error) {
        console.error('Error loading files:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadFiles();
  }, []);

  // 현재 파일 내용 로드
  useEffect(() => {
    if (files.length === 0 || currentIndex < 0 || currentIndex >= files.length) {
      return;
    }

    const loadContent = async () => {
      try {
        setIsLoadingContent(true);
        const filename = files[currentIndex].filename;
        const response = await fetch(`/api/admin/markdown-previewer?action=content&filename=${encodeURIComponent(filename)}`);
        if (!response.ok) {
          throw new Error('Failed to load content');
        }
        const data = await response.json();
        setContent(data);
      } catch (error) {
        console.error('Error loading content:', error);
        setContent(null);
      } finally {
        setIsLoadingContent(false);
      }
    };

    loadContent();
  }, [files, currentIndex]);

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < files.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleFileSelect = (index: number) => {
    setCurrentIndex(index);
    setCollapsedPaths({}); // 파일 변경 시 접기 상태 초기화
  };

  const handleToggleCollapse = (path: string) => {
    setCollapsedPaths(prev => ({
      ...prev,
      [path]: !prev[path]
    }));
  };

  const handleLeftToggleCollapse = (path: string) => {
    setLeftCollapsedPaths(prev => ({
      ...prev,
      [path]: !prev[path]
    }));
  };

  // 파일이 변경될 때 접기 상태 초기화
  useEffect(() => {
    setCollapsedPaths({});
    setLeftCollapsedPaths({});
  }, [currentIndex]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-xl">파일 목록 로딩 중...</div>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="container mx-auto p-6">
        <h1 className="text-3xl font-bold mb-4">마크다운 미리보기 도구</h1>
        <div className="text-center py-12">
          <p className="text-lg">매칭된 파일을 찾을 수 없습니다.</p>
        </div>
      </div>
    );
  }

  const currentFile = files[currentIndex];

  return (
    <div className="container mx-auto p-4 sm:p-6">
      <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6">마크다운 미리보기 도구</h1>

      {/* 네비게이션 컨트롤 */}
      <div className="mb-6 p-4 rounded-lg border" style={{ backgroundColor: 'var(--accent)', borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
            <button
              onClick={handlePrevious}
              disabled={currentIndex === 0}
              className="px-3 sm:px-4 py-2 rounded transition-colors text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: currentIndex === 0 ? 'var(--muted)' : 'var(--foreground)',
                color: 'var(--background)',
                cursor: currentIndex === 0 ? 'not-allowed' : 'pointer'
              }}
            >
              ← 이전
            </button>
            <button
              onClick={handleNext}
              disabled={currentIndex === files.length - 1}
              className="px-3 sm:px-4 py-2 rounded transition-colors text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: currentIndex === files.length - 1 ? 'var(--muted)' : 'var(--foreground)',
                color: 'var(--background)',
                cursor: currentIndex === files.length - 1 ? 'not-allowed' : 'pointer'
              }}
            >
              다음 →
            </button>
            <span className="text-sm px-2" style={{ color: 'var(--muted)' }}>
              {currentIndex + 1} / {files.length}
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 flex-wrap w-full sm:w-auto">
            <label className="text-sm" style={{ color: 'var(--muted)' }}>
              파일 선택:
            </label>
            <select
              value={currentIndex}
              onChange={(e) => handleFileSelect(Number(e.target.value))}
              className="px-3 py-2 rounded border text-sm flex-1 sm:flex-none min-w-0"
              style={{
                backgroundColor: 'var(--background)',
                color: 'var(--foreground)',
                borderColor: 'var(--border)'
              }}
            >
              {files.map((file, index) => (
                <option key={index} value={index}>
                  {file.filename}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
          <p className="text-sm font-medium break-words" style={{ color: 'var(--foreground)' }}>
            현재 파일: <span className="font-mono">{currentFile?.filename}</span>
          </p>
        </div>
      </div>

      {/* 분할 레이아웃 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        {/* 좌측 패널 - 마크다운/JSON 전환 */}
        <div className="flex flex-col order-2 lg:order-1">
          <div className="mb-2">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg sm:text-xl font-semibold">result-from-google-search</h2>
              <div className="flex gap-1 p-1 rounded-lg border" style={{ 
                backgroundColor: 'var(--accent)', 
                borderColor: 'var(--border)' 
              }}>
                <button
                  onClick={() => setLeftViewMode('markdown')}
                  className={`px-3 py-1 text-xs sm:text-sm rounded transition-colors ${
                    leftViewMode === 'markdown' ? 'font-semibold' : 'opacity-70'
                  }`}
                  style={{
                    backgroundColor: leftViewMode === 'markdown' ? 'var(--foreground)' : 'transparent',
                    color: leftViewMode === 'markdown' ? 'var(--background)' : 'var(--foreground)'
                  }}
                >
                  마크다운
                </button>
                <button
                  onClick={() => setLeftViewMode('json')}
                  className={`px-3 py-1 text-xs sm:text-sm rounded transition-colors ${
                    leftViewMode === 'json' ? 'font-semibold' : 'opacity-70'
                  }`}
                  style={{
                    backgroundColor: leftViewMode === 'json' ? 'var(--foreground)' : 'transparent',
                    color: leftViewMode === 'json' ? 'var(--background)' : 'var(--foreground)'
                  }}
                >
                  JSON
                </button>
              </div>
            </div>
          </div>
          <div className="flex-1 border rounded-lg p-3 sm:p-4 overflow-auto" style={{ 
            backgroundColor: 'var(--background)', 
            borderColor: 'var(--border)',
            minHeight: '400px',
            maxHeight: 'calc(100vh - 300px)'
          }}>
            {isLoadingContent ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-base sm:text-lg">로딩 중...</div>
              </div>
            ) : leftViewMode === 'markdown' ? (
              content?.aiMode?.markdown ? (
                <div className="space-y-4">
                  <div className="imessage-receive-bubble multi-line">
                    <div className="imessage-content-wrapper space-y-4">
                      <MarkdownContent
                        content={content.aiMode.markdown}
                        enableSegmentation={true}
                        messageType="assistant"
                        isMobile={false}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-base sm:text-lg" style={{ color: 'var(--muted)' }}>
                    마크다운 내용이 없습니다.
                  </div>
                </div>
              )
            ) : (
              content?.aiMode?.raw ? (
                <div className="relative h-full overflow-auto" style={{ 
                  scrollbarWidth: 'thin',
                  scrollbarColor: 'var(--border) var(--accent)'
                }}>
                  <div 
                    className="text-[10px] sm:text-xs font-mono"
                    style={{ 
                      color: 'var(--foreground)',
                      padding: '4px 0'
                    }}
                  >
                    <CollapsibleJsonViewer
                      data={content.aiMode.raw}
                      collapsedPaths={leftCollapsedPaths}
                      onToggle={handleLeftToggleCollapse}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-base sm:text-lg" style={{ color: 'var(--muted)' }}>
                    JSON 데이터가 없습니다.
                  </div>
                </div>
              )
            )}
          </div>
        </div>

        {/* 우측 패널 - Raw JSON */}
        <div className="flex flex-col order-1 lg:order-2">
          <div className="mb-2">
            <h2 className="text-lg sm:text-xl font-semibold">Raw JSON 데이터</h2>
            <p className="text-xs sm:text-sm" style={{ color: 'var(--muted)' }}>
              result
            </p>
          </div>
          <div className="flex-1 border rounded-lg p-3 sm:p-4 overflow-auto" style={{ 
            backgroundColor: 'var(--background)', 
            borderColor: 'var(--border)',
            minHeight: '400px',
            maxHeight: 'calc(100vh - 300px)'
          }}>
            {isLoadingContent ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-base sm:text-lg">로딩 중...</div>
              </div>
            ) : content?.result?.raw ? (
              <div className="relative h-full overflow-auto" style={{ 
                scrollbarWidth: 'thin',
                scrollbarColor: 'var(--border) var(--accent)'
              }}>
                <div 
                  className="text-[10px] sm:text-xs font-mono"
                  style={{ 
                    color: 'var(--foreground)',
                    padding: '4px 0'
                  }}
                >
                  <CollapsibleJsonViewer
                    data={content.result.raw}
                    collapsedPaths={collapsedPaths}
                    onToggle={handleToggleCollapse}
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-base sm:text-lg" style={{ color: 'var(--muted)' }}>
                  JSON 데이터가 없습니다.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

