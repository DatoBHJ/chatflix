'use client'

import React, { useState, useEffect } from 'react';
import { Attachment } from '@/lib/types';
import { MarkdownContent } from './MarkdownContent';

interface AttachmentTextViewerProps {
  attachment: Attachment;
  url?: string; // Optional refreshed URL prop
}

// 파일 내용 캐시 (메모리)
const fileContentCache = new Map<string, string>();

export function AttachmentTextViewer({ attachment, url }: AttachmentTextViewerProps) {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isBinary, setIsBinary] = useState(false);

  // 파일 확장자에 따른 언어 결정
  const getLanguageFromExtension = (fileName?: string): string => {
    if (!fileName) return 'text';
    
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (!ext) return 'text';
    
    const languageMap: { [key: string]: string } = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'py': 'python',
      'java': 'java',
      'c': 'c',
      'cpp': 'cpp',
      'cs': 'csharp',
      'go': 'go',
      'rb': 'ruby',
      'php': 'php',
      'swift': 'swift',
      'kt': 'kotlin',
      'rs': 'rust',
      'html': 'html',
      'css': 'css',
      'json': 'json',
      'xml': 'xml',
      'md': 'markdown',
      'sql': 'sql',
      'sh': 'bash',
      'yml': 'yaml',
      'yaml': 'yaml',
      'toml': 'toml',
      'ini': 'ini',
      'cfg': 'ini',
      'conf': 'ini',
      'log': 'text'
    };
    
    return languageMap[ext] || 'text';
  };

  useEffect(() => {
    const fetchFileContent = async () => {
      try {
        setLoading(true);
        setError(null);
        setIsBinary(false);
        
        // Use refreshed URL if provided, otherwise fall back to attachment.url
        const fetchUrl = url || attachment.url;
        
        const cacheKey = fetchUrl;
        const cachedContent = fileContentCache.get(cacheKey);
        if (cachedContent) {
          setContent(cachedContent);
          setLoading(false);
          return;
        }
        
        const response = await fetch(fetchUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch file: ${response.statusText}`);
        }
 
        const ct = response.headers.get('content-type') || attachment.contentType || '';
        const looksText = ct.startsWith('text/') || ct.includes('json') || ct.includes('xml') || ct.includes('javascript') || ct.includes('typescript') || ct.includes('html') || ct.includes('css') || (!!attachment.name && /(\.txt|\.md|\.js|\.jsx|\.ts|\.tsx|\.html|\.css|\.json|\.xml|\.py|\.java|\.c|\.cpp|\.cs|\.go|\.rb|\.php|\.swift|\.kt|\.rs|\.sql|\.sh|\.yml|\.yaml|\.toml|\.ini|\.cfg|\.conf|\.log)$/i.test(attachment.name));
 
        if (!looksText) {
          // 바이너리 파일로 간주 (PDF 등)
          setIsBinary(true);
          setLoading(false);
          return;
        }
 
        const text = await response.text();
 
        // 캐시에 저장 (최대 50개 파일만 캐시)
        if (fileContentCache.size >= 50) {
          const firstKey = fileContentCache.keys().next().value;
          if (firstKey) {
            fileContentCache.delete(firstKey);
          }
        }
        fileContentCache.set(cacheKey, text);
        setContent(text);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load file content');
      } finally {
        setLoading(false);
      }
    };
 
    fetchFileContent();
  }, [url, attachment.url, attachment.name, attachment.contentType]);
 
  const language = getLanguageFromExtension(attachment.name);
 
  // PDF 등 바이너리 파일에 대한 iframe 프리뷰 제공
  if (attachment.contentType === 'application/pdf' || attachment.name?.toLowerCase().endsWith('.pdf')) {
    return (
      <div className="w-full h-full">
        <iframe
          src={`${attachment.url}#toolbar=1&navpanes=1&scrollbar=1`}
          className="w-full border border-[color-mix(in_srgb,var(--foreground)_10%,transparent)] rounded-lg"
          style={{ height: '80vh', minHeight: '600px' }}
          title={attachment.name || 'PDF Document'}
        />
      </div>
    );
  }
 
  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="flex items-center gap-2 text-[color-mix(in_srgb,var(--foreground)_60%,transparent)]">
          <div className="loading-dots text-sm">
            <span>.</span>
            <span>.</span>
            <span>.</span>
          </div>
          <span className="text-sm">Loading file content...</span>
        </div>
      </div>
    );
  }
 
  if (error) {
    return (
      <div className="p-4 border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20 rounded-lg">
        <p className="text-red-600 dark:text-red-400 text-sm font-medium">Error loading file content</p>
        <p className="text-red-500 dark:text-red-300 text-xs mt-1">{error}</p>
      </div>
    );
  }
 
  if (isBinary) {
    return (
      <div className="text-center text-[var(--muted)] p-6">
        <p>Preview not available for this file type. Use the download button to view.</p>
      </div>
    );
  }
 
  // 마크다운의 경우 직접 렌더링, 다른 파일의 경우 코드 블록으로 감싸기
  const isMarkdown = language === 'markdown';
  const markdownContent = isMarkdown 
    ? content 
    : `\`\`\`${language}\n${content}\n\`\`\``;
 
  return (
    <div
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
        <MarkdownContent content={markdownContent} variant="clean" />
      </div>
    </div>
  );
} 