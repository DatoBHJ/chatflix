import { useState, useMemo, memo, useCallback, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import type { Components, ExtraProps } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import rehypeHighlight from 'rehype-highlight';
import mermaid from 'mermaid';
import { MathJaxEquation } from './math/MathJaxEquation';
import React from 'react';
import dynamic from 'next/dynamic';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight, ExternalLink, Play } from 'lucide-react';

// Dynamically import DynamicChart for client-side rendering
const DynamicChart = dynamic(() => import('./charts/DynamicChart'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[300px] w-full bg-[var(--accent)] rounded-lg shadow-md">
      <p className="text-[var(--muted-foreground)]">Loading chart...</p>
    </div>
  ),
});

// 더 정교한 LaTeX 전처리 함수 추가
const preprocessLaTeX = (content: string) => {
  if (!content) return '';
  
  // 이미 이스케이프된 구분자 처리
  let processedContent = content
    .replace(/\\\[/g, '___BLOCK_OPEN___')
    .replace(/\\\]/g, '___BLOCK_CLOSE___')
    .replace(/\\\(/g, '___INLINE_OPEN___')
    .replace(/\\\)/g, '___INLINE_CLOSE___');

  // Escape currency dollar amounts BEFORE attempting to identify LaTeX.
  processedContent = escapeCurrencyDollars(processedContent);

  // 블록 수식 ($$...$$) 보존
  const blockRegex = /\$\$[\s\S]*?\$\$/g;
  const blocks: string[] = [];
  processedContent = processedContent.replace(blockRegex, (match) => {
    const id = blocks.length;
    blocks.push(match);
    return `___LATEX_BLOCK_${id}___`;
  });

  // 인라인 수식 ($...$) 보존 - 화폐 값과 구분
  // Matches $math$ not adjacent to word characters and not part of an HTML entity (like &#36;)
  const inlineRegex = /(?<![\w&])\$((?:\\\$|[^$])+?)\$(?![\w])/g;
  const inlines: string[] = [];
  processedContent = processedContent.replace(inlineRegex, (match) => {
    // Ensure inner content is not empty after trim, to avoid issues with "$ $"
    if (match.substring(1, match.length - 1).trim() === "") {
        return match; // Not a valid math expression, leave it.
    }
    const id = inlines.length;
    inlines.push(match);
    return `___LATEX_INLINE_${id}___`;
  });

  // 이스케이프된 구분자 복원
  processedContent = processedContent
    .replace(/___BLOCK_OPEN___/g, '\\[')
    .replace(/___BLOCK_CLOSE___/g, '\\]')
    .replace(/___INLINE_OPEN___/g, '\\(')
    .replace(/___INLINE_CLOSE___/g, '\\)');

  // LaTeX 블록 복원
  processedContent = processedContent.replace(/___LATEX_BLOCK_(\d+)___/g, (_, id) => {
    return blocks[parseInt(id)];
  });
  
  processedContent = processedContent.replace(/___LATEX_INLINE_(\d+)___/g, (_, id) => {
    return inlines[parseInt(id)];
  });

  return processedContent;
};

// 단순화된 화폐 기호 처리 함수
function escapeCurrencyDollars(text: string): string {
  // This comment is no longer accurate with the new logic
  if (!text.includes('$')) return text;
  
  // 금액 패턴 (예: $100, $1,000.50)
  // Regex to identify currency: $ not preceded by alnum/backslash, followed by number, then boundary/non-word.
  const currencyRegex = /(?<![\\a-zA-Z0-9_])\$(\d+(?:[.,]\d+)*)(?=\b|[^\w])/g;
  return text.replace(currencyRegex, '&#36;$1');
}

// Pollination 이미지 URL에 nologo 옵션 추가하는 함수
function ensureNoLogo(url: string): string {
  if (!url.includes('image.pollinations.ai')) return url;
  
  try {
    const urlObj = new URL(url);
    // nologo 파라미터가 없으면 추가
    if (!urlObj.searchParams.has('nologo')) {
      urlObj.searchParams.set('nologo', 'true');
    }
    return urlObj.toString();
  } catch (error) {
    // URL 파싱에 실패하면 원본 반환
    console.warn('Failed to parse pollinations URL:', url);
    return url;
  }
}

interface MarkdownContentProps {
  content: string;
  enableSegmentation?: boolean;
  variant?: 'default' | 'clean'; // 'clean'은 배경색 없는 버전
}

// 더 적극적으로 마크다운 구조를 분할하는 함수
const segmentContent = (content: string): string[] => {
  if (!content || !content.trim()) return [];

  const trimmedContent = content.trim();

  // 1. 모든 코드 블록을 임시 플레이스홀더로 교체 (차트 블록 포함)
  // 개선된 코드 블록 매칭 로직으로 중첩된 백틱 처리
  const codeBlocks: string[] = [];
  
  // 더 정확한 코드 블록 매칭을 위한 함수
  const extractCodeBlocks = (text: string): string => {
    let result = text;
    let blockIndex = 0;
    
    // 코드 블록을 찾기 위한 상태 기반 파싱
    const lines = text.split('\n');
    const processedLines: string[] = [];
    let inCodeBlock = false;
    let codeBlockStart = -1;
    let codeBlockContent: string[] = [];
    let codeBlockFence = '';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      
      // 백틱으로 시작하는 라인 체크
      const fenceMatch = trimmedLine.match(/^(`{3,})/);
      
      if (fenceMatch && !inCodeBlock) {
        // 코드 블록 시작
        inCodeBlock = true;
        codeBlockStart = i;
        codeBlockContent = [line];
        codeBlockFence = fenceMatch[1];
      } else if (inCodeBlock && trimmedLine.startsWith(codeBlockFence) && trimmedLine.length === codeBlockFence.length) {
        // 코드 블록 끝 (같은 길이의 백틱)
        codeBlockContent.push(line);
        
        // 코드 블록 전체를 플레이스홀더로 교체
        const fullCodeBlock = codeBlockContent.join('\n');
        codeBlocks.push(fullCodeBlock);
        processedLines.push(`<CODE_PLACEHOLDER_${blockIndex}>`);
        blockIndex++;
        
        // 상태 초기화
        inCodeBlock = false;
        codeBlockStart = -1;
        codeBlockContent = [];
        codeBlockFence = '';
      } else if (inCodeBlock) {
        // 코드 블록 내부 라인
        codeBlockContent.push(line);
      } else {
        // 일반 라인
        processedLines.push(line);
      }
    }
    
    // 닫히지 않은 코드 블록 처리 (스트리밍 중 등)
    if (inCodeBlock && codeBlockContent.length > 0) {
      const fullCodeBlock = codeBlockContent.join('\n');
      codeBlocks.push(fullCodeBlock);
      processedLines.push(`<CODE_PLACEHOLDER_${blockIndex}>`);
    }
    
    return processedLines.join('\n');
  };
  
  const placeholderContent = extractCodeBlocks(trimmedContent);

  // 2. 주요 구분자(---, H1, H2, H3)를 기준으로 분할
  // 파일 생성 진행 메시지 구분자(\n\n---\n\n)와 마크다운 구분자 모두 지원
  const separator = /(?:\n\n---\n\n)|(?:\n\s*---+\s*\n)|(?=\n#{1,3}\s)/;
  const mainSegments = placeholderContent.split(separator);
  
  const finalSegments: string[] = [];

  // 3. 코드 블록 플레이스홀더 복원
  for (const segment of mainSegments) {
    if (!segment || !segment.trim()) continue;
    
    const codePlaceholderRegex = /<CODE_PLACEHOLDER_(\d+)>/g;
    let lastIndex = 0;
    let match;

    while ((match = codePlaceholderRegex.exec(segment)) !== null) {
      if (match.index > lastIndex) {
        finalSegments.push(segment.slice(lastIndex, match.index).trim());
      }
      finalSegments.push(codeBlocks[parseInt(match[1], 10)]);
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < segment.length) {
      finalSegments.push(segment.slice(lastIndex).trim());
    }
  }
  
  // 4. 최종적으로 빈 세그먼트 제거 후 반환
  const result = finalSegments.filter(s => s.trim().length > 0);
  
  // 분할 결과가 없으면 원본 반환
  if (result.length <= 1) {
      return [trimmedContent];
  }
  
  return result;
};

// Image component with loading state and modal support
const ImageWithLoading = memo(function ImageWithLoadingComponent({ 
  src, 
  alt, 
  className = "",
  onImageClick,
  ...props 
}: React.ImgHTMLAttributes<HTMLImageElement> & { onImageClick?: () => void }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  
  // 로딩 애니메이션 효과를 위한 상태
  const [loadingTime, setLoadingTime] = useState(0);
  
  // pollination 이미지인지 확인
  const isPollinationImage = src && typeof src === 'string' && src.includes('image.pollinations.ai');
  
  // 로딩이 시작되면 진행 상태를 시뮬레이션
  useEffect(() => {
    if (!isLoaded && !error) {
      const timer = setInterval(() => {
        setLoadingTime(prev => {
          const newTime = prev + 1;
          // 진행률 계산 (0-95% 범위, 실제 로딩 완료 시 100%로 점프)
          const progress = Math.min(95, Math.floor(newTime * 1.5));
          setLoadingProgress(progress);
          return newTime;
        });
      }, 100);
      
      return () => clearInterval(timer);
    }
  }, [isLoaded, error]);
  
  // URL이 유효한지 확인 (간단한 체크)
  const isValidUrl = src && typeof src === 'string' && (
    src.startsWith('http://') || 
    src.startsWith('https://') || 
    src.startsWith('data:')
  );

  if (!isValidUrl) {
    return (
      <div className="bg-[var(--accent)] rounded-lg p-4 text-center text-[var(--muted)]">
        <svg className="w-8 h-8 mx-auto mb-2 text-[var(--muted)]" fill="none" strokeWidth="1.5" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
        <div>Invalid image URL</div>
      </div>
    );
  }

  // 일반 이미지가 에러나면 아무것도 렌더링하지 않음
  if (error && !isPollinationImage) {
    return null;
  }
  
  return (
    <div className="relative w-full">
      {!isLoaded && !error && (
        <div className="bg-[var(--accent)] animate-pulse rounded-lg overflow-hidden" style={{ aspectRatio: "16/9" }}>
          {/* 스켈레톤 로딩 효과 */}
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
            {/* 이미지 로딩 아이콘 */}
            <svg 
              className="w-12 h-12 text-[var(--muted)] mb-2 animate-spin" 
              fill="none" 
              strokeWidth="1.5" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
              style={{ animationDuration: '2s' }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
            
            {/* 로딩 텍스트 - div로 변경하여 nested <p> 방지 */}
            <div className="text-[var(--muted)] text-sm font-medium">
              Loading image... {loadingProgress}%
            </div>
            
            {/* 로딩 진행 표시기 */}
            <div className="w-3/4 h-1.5 bg-[var(--muted)] bg-opacity-20 rounded-full mt-3 overflow-hidden">
              <div 
                className="h-full bg-[var(--muted)] rounded-full transition-all duration-300 ease-out"
                style={{ width: `${loadingProgress}%` }}
              ></div>
            </div>
            
            {/* 이미지 설명 표시 (있는 경우) */}
            {alt && (
              <div className="mt-3 text-xs text-[var(--muted)] italic opacity-70">
                {alt}
              </div>
            )}
          </div>
          
          {/* 배경 패턴 */}
          <div className="absolute inset-0 opacity-5">
            <div className="h-full w-full" 
              style={{ 
                backgroundImage: 'radial-gradient(var(--muted) 1px, transparent 1px)', 
                backgroundSize: '20px 20px' 
              }}>
            </div>
          </div>
        </div>
      )}
      
      {error && isPollinationImage && (
        <div className="bg-[var(--accent)] rounded-lg p-6 text-center text-[var(--muted)]">
          <svg className="w-10 h-10 mx-auto mb-3 text-[var(--muted)]" fill="none" strokeWidth="1.5" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <div className="mb-1">Image failed to load</div>
          {alt && <div className="text-sm italic mb-2 opacity-75">{alt}</div>}
          {src && typeof src === 'string' && (
            <a 
              href={src}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[var(--muted-foreground)] hover:underline mt-1 block"
            >
              View image directly
            </a>
          )}
        </div>
      )}
      
      <img
        src={src}
        alt={alt || ""}
        className={`${className} ${isLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-500 rounded-lg ${onImageClick ? 'cursor-pointer' : ''}`}
        onClick={onImageClick}
        onLoad={() => {
          setLoadingProgress(100);
          setTimeout(() => setIsLoaded(true), 200); // 약간의 지연으로 부드러운 전환 효과
        }}
        onError={() => {
          console.log('Image load error:', src);
          setError(true);
          setIsLoaded(true);
        }}
        loading="lazy"
        referrerPolicy="no-referrer"
        {...props}
      />
    </div>
  );
});

// YouTube utility functions
const isYouTubeUrl = (url: string): boolean => {
  if (!url) return false;
  const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be|m\.youtube\.com)\/.+/i;
  return youtubeRegex.test(url);
};

const extractYouTubeVideoId = (url: string): string | null => {
  if (!url) return null;
  
  // Handle different YouTube URL formats
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|m\.youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return null;
};

// YouTube Embed Player Component
const YouTubeEmbed = memo(function YouTubeEmbedComponent({ 
  videoId, 
  title = "YouTube video",
  originalUrl 
}: { 
  videoId: string; 
  title?: string; 
  originalUrl?: string;
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  
  const embedUrl = `https://www.youtube.com/embed/${videoId}`;
  
  return (
    <div className="my-6 w-full">
      <div className="relative w-full bg-black rounded-lg overflow-hidden shadow-lg" style={{ aspectRatio: '16/9' }}>
        {/* Loading state */}
        {isLoading && !hasError && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500 mx-auto mb-2"></div>
              <p className="text-white text-sm">Loading video...</p>
            </div>
          </div>
        )}
        
        {/* Error state */}
        {hasError && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
            <div className="text-center p-4">
              <div className="w-12 h-12 mx-auto mb-2 bg-red-500 rounded-full flex items-center justify-center">
                <X size={24} className="text-white" />
              </div>
              <p className="text-white text-sm mb-2">Video failed to load</p>
              {originalUrl && (
                <a
                  href={originalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-red-400 hover:text-red-300 text-xs underline"
                >
                  Open on YouTube
                </a>
              )}
            </div>
          </div>
        )}
        
        {/* YouTube iframe */}
        <iframe
          src={embedUrl}
          title={title}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="absolute inset-0 w-full h-full"
          onLoad={() => setIsLoading(false)}
          onError={() => {
            setHasError(true);
            setIsLoading(false);
          }}
        />
      </div>
      
      {/* Video info */}
      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
            <Play size={8} className="text-white ml-0.5" />
          </div>
          <span className="text-sm text-[var(--muted-foreground)]">
            {title}
          </span>
        </div>
        {originalUrl && (
          <a
            href={originalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors flex items-center gap-1"
          >
            <ExternalLink size={12} />
            YouTube
          </a>
        )}
      </div>
    </div>
  );
});

interface MathProps {
  value: string;
  inline?: boolean;
}

// Create a custom wrapper to ensure proper nesting
const SafeWrapper = ({ children }: { children: React.ReactNode }) => {
  // Render with fragment to avoid adding any unnecessary elements
  return <>{children}</>;
};

// Special component to handle math blocks with better isolation
const MathBlock = ({ content }: { content: string }) => {
  // Create a more stable ID that doesn't change across renders
  const id = useMemo(() => `math-block-${content.slice(0, 10).replace(/\W/g, '')}-${Math.random().toString(36).slice(2, 6)}`, [content]);
  
  return (
    <div 
      className="math-block-wrapper my-6" 
      key={id}
      // Use flex layout and isolation for better rendering stability
      style={{ 
        isolation: 'isolate' // Create a new stacking context
      }}
    >
      <MathJaxEquation equation={content} display={true} />
    </div>
  );
};

// Simpler math component for inline math
const InlineMath = ({ content }: { content: string }) => {
  // Create a more stable ID that doesn't change across renders
  const id = useMemo(() => `math-inline-${content.slice(0, 10).replace(/\W/g, '')}-${Math.random().toString(36).slice(2, 6)}`, [content]);
  
  return (
    <span 
      className="math-inline-wrapper"
      key={id}
      style={{ isolation: 'isolate' }} // Create a new stacking context
    >
      <MathJaxEquation equation={content} display={false} />
    </span>
  );
};

// Memoize the MarkdownContent component to prevent unnecessary re-renders
export const MarkdownContent = memo(function MarkdownContentComponent({ 
  content, 
  enableSegmentation = false,
  variant = 'default'
}: MarkdownContentProps) {

  // Image modal state
  const [selectedImage, setSelectedImage] = useState<{ src: string; alt: string } | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  // Check if we're in browser environment for portal rendering
  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  // Handle keyboard navigation for image modal
  useEffect(() => {
    if (!selectedImage) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeImageModal();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [selectedImage]);

  // Image modal functions
  const openImageModal = useCallback((src: string | undefined, alt: string) => {
    if (src && typeof src === 'string') {
      setSelectedImage({ src, alt });
    }
  }, []);

  const closeImageModal = useCallback(() => {
    setSelectedImage(null);
  }, []);

  // Pre-process the content to handle LaTeX and escape currency dollar signs
  const processedContent = useMemo(() => {
    return preprocessLaTeX(content);
  }, [content]);

  // Segment the content if segmentation is enabled
  const segments = useMemo(() => {
    if (!enableSegmentation) return [processedContent];
    return segmentContent(processedContent);
  }, [processedContent, enableSegmentation]);

  // Memoize the styleMentions function to avoid recreating it on every render
  const styleMentions = useCallback((text: string) => {
    if (!text.includes('@')) return text; // Quick check to avoid unnecessary regex processing
    
    const jsonMentionRegex = /\{"displayName":"([^"]+)","promptContent":"[^"]+"}/g;
    const legacyMentionRegex = /@([\w?!.,_\-+=@#$%^&*()<>{}\[\]|/\\~`]+)/g;
    
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = jsonMentionRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }
      
      parts.push(
        <span key={match.index} className="mention-tag">
          @{match[1]}
        </span>
      );
      
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex === 0) {
      while ((match = legacyMentionRegex.exec(text)) !== null) {
        if (match.index > lastIndex) {
          parts.push(text.slice(lastIndex, match.index));
        }
        
        parts.push(
          <span key={match.index} className="mention-tag">
            {match[0]}
          </span>
        );
        
        lastIndex = match.index + match[0].length;
      }
    }
    
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }
    
    return parts.length > 0 ? parts : text;
  }, []);

  // Function to detect image URLs (from original code)
  const styleImageUrls = useCallback((text: string) => {
    if (!text.includes('image.pollinations.ai')) return text;
    
    const pollinationsUrlRegex = /(https:\/\/image\.pollinations\.ai\/[^\s]+)/g;
    
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = pollinationsUrlRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }
      
      const imageUrl = match[1];
      const decodedUrl = decodeURIComponent(imageUrl);
      const urlWithNoLogo = ensureNoLogo(decodedUrl);
      
      parts.push({
        type: 'image_link',
        key: match.index,
        url: urlWithNoLogo,
        display: urlWithNoLogo
      });
      
      lastIndex = match.index + match[0].length;
    }
    
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }
    
    return parts.length > 0 ? parts : text;
  }, []);

  // Function to detect YouTube URLs in text
  const styleYouTubeUrls = useCallback((text: string) => {
    if (!text.includes('youtube.com') && !text.includes('youtu.be')) return text;
    
    const youtubeUrlRegex = /(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|m\.youtube\.com\/watch\?v=)[a-zA-Z0-9_-]{11}(?:\S*)?)/g;
    
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = youtubeUrlRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }
      
      const youtubeUrl = match[1];
      const videoId = extractYouTubeVideoId(youtubeUrl);
      
      if (videoId) {
        parts.push({
          type: 'youtube_link',
          key: match.index,
          url: youtubeUrl,
          videoId: videoId
        });
      } else {
        parts.push(youtubeUrl);
      }
      
      lastIndex = match.index + match[0].length;
    }
    
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }
    
    return parts.length > 0 ? parts : text;
  }, []);

  // Memoize the extractText function
  const extractText = useCallback((node: any): string => {
    if (typeof node === 'string') return node;
    if (Array.isArray(node)) return node.map(extractText).join('');
    if (node?.props?.children) return extractText(node.props.children);
    return '';
  }, []);

  // 복사 기능 구현 - 텍스트 변경만 적용
  const handleCopy = useCallback((text: string, event: React.MouseEvent<HTMLButtonElement>) => {
    const btn = event.currentTarget;
    
    // 텍스트 복사
    navigator.clipboard.writeText(text)
      .then(() => {
        // 복사 성공 시 텍스트만 변경 (색상 변경 없음)
        btn.textContent = 'Copied!';
        
        // 2초 후 원래 상태로 복원
        setTimeout(() => {
          btn.textContent = 'Copy';
        }, 2000);
      })
      .catch(err => {
        console.error('Failed to copy code:', err);
      });
  }, []);

  // Memoize the components object to avoid recreating it on every render
  const components = useMemo<Components>(() => ({
    // Use a simple div as the root component to properly handle all elements
    root: SafeWrapper,
    
    p: ({ children, ...props }: React.PropsWithChildren<ExtraProps>) => {
      // Check if this is a text-only paragraph
      const childArray = React.Children.toArray(children);
      
      // If there are no children or only a single text child, it's safe to render as paragraph
      const isSafeParagraph = 
        childArray.length === 0 || 
        (childArray.length === 1 && typeof childArray[0] === 'string');
      
      // If it's not a simple text paragraph, render without p to avoid potential nesting issues
      if (!isSafeParagraph) {
        return <>{children}</>;
      }
      
      // Process text content to detect image generation links
      if (typeof children === 'string') {
        // Handle image markdown pattern
        const pollinationsRegex = /!\[([^\]]*)\]\((https:\/\/image\.pollinations\.ai\/[^)]+)\)/g;
        const match = pollinationsRegex.exec(children);
        
        if (match) {
          const [fullMatch, altText, imageUrl] = match;
          const decodedUrl = decodeURIComponent(imageUrl);
          const urlWithNoLogo = ensureNoLogo(decodedUrl);
          
          return (
            <div className="my-4">
              <div className="block cursor-pointer">
                <ImageWithLoading 
                  src={urlWithNoLogo} 
                  alt={altText || "Generated image"} 
                  className="rounded-lg max-w-full hover:opacity-90 transition-opacity border border-[var(--accent)] shadow-md" 
                  onImageClick={() => openImageModal(urlWithNoLogo, altText || "Generated image")}
                />
              </div>
              <div className="text-sm text-[var(--muted)] mt-2 italic text-center">{altText}</div>
            </div>
          );
        }
        
        // Process raw image URLs
        const rawPollinationsRegex = /(https:\/\/image\.pollinations\.ai\/[^\s)]+)/g;
        const rawMatch = rawPollinationsRegex.exec(children);
        
        if (rawMatch) {
          const [, imageUrl] = rawMatch;
          const decodedUrl = decodeURIComponent(imageUrl);
          const urlWithNoLogo = ensureNoLogo(decodedUrl);
          
          return (
            <div className="my-4">
              <div className="block cursor-pointer">
                <ImageWithLoading 
                  src={urlWithNoLogo} 
                  alt="Generated image" 
                  className="rounded-lg max-w-full hover:opacity-90 transition-opacity border border-[var(--accent)] shadow-md" 
                  onImageClick={() => openImageModal(urlWithNoLogo, "Generated image")}
                />
              </div>
              <div className="text-sm text-[var(--muted)] mt-2 italic text-center">Generated Image</div>
            </div>
          );
        }
        
        // Process for raw image URLs
        const processedImageContent = styleImageUrls(children);
        
        // Process for raw YouTube URLs
        const processedContent = Array.isArray(processedImageContent) ? processedImageContent : styleYouTubeUrls(processedImageContent);
        
        // Handle special links (images and YouTube)
        if (Array.isArray(processedContent)) {
          const elements = processedContent.map((part, index) => {
            if (typeof part === 'string') {
              return <span key={index}>{styleMentions(part)}</span>;
            } else if (part && typeof part === 'object' && 'type' in part) {
              if (part.type === 'image_link' && 'display' in part) {
                return (
                  <div key={part.key} className="my-4">
                    <div className="block cursor-pointer">
                      <ImageWithLoading 
                        src={part.url} 
                        alt="Generated image" 
                        className="rounded-lg max-w-full hover:opacity-90 transition-opacity border border-[var(--accent)] shadow-md" 
                        onImageClick={() => openImageModal(part.url, "Generated image")}
                      />
                      <div className="text-xs text-[var(--muted)] mt-2 text-center break-all">
                        {part.display}
                      </div>
                    </div>
                  </div>
                );
              } else if (part.type === 'youtube_link' && 'videoId' in part) {
                return (
                  <YouTubeEmbed 
                    key={part.key}
                    videoId={part.videoId} 
                    title="YouTube video" 
                    originalUrl={part.url}
                  />
                );
              }
            }
            return null;
          });
          
          return <>{elements}</>;
        }
        
        // For regular text, just render with styleMentions
        return <p className="my-3 leading-relaxed break-words" {...props}>{styleMentions(children)}</p>;
      }
      
      // If children is not a string, render as-is
      return <p className="my-3 leading-relaxed break-words" {...props}>{children}</p>;
    },
    img: ({ src, alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => {
      // Agent 도구에서 생성된 이미지 URL을 처리합니다
      if (src && typeof src === 'string' && (src.includes('image.pollinations.ai'))) {
        const urlWithNoLogo = ensureNoLogo(src);
        
        return (
          <div className="block my-4 cursor-pointer">
                          <ImageWithLoading 
                src={urlWithNoLogo} 
                alt={alt || "Generated image"} 
                className="rounded-lg max-w-full hover:opacity-90 transition-opacity border border-[var(--accent)] shadow-md" 
                onImageClick={() => openImageModal(urlWithNoLogo, alt || "Generated image")}
                {...props}
              />
            {alt && <div className="text-sm text-[var(--muted)] mt-2 italic text-center">{alt}</div>}
          </div>
        );
      }
      
      // Regular image rendering with loading state and modal
      return src ? (
        <div className="my-4 cursor-pointer">
          <ImageWithLoading 
            src={src} 
            alt={alt || "Image"} 
            className="rounded-lg max-w-full hover:opacity-90 transition-opacity" 
            onImageClick={() => typeof src === 'string' && openImageModal(src, alt || "Image")}            {...props} 
          />
          {alt && <div className="text-sm text-[var(--muted)] mt-2 italic text-center">{alt}</div>}
        </div>
      ) : (
        <span className="text-[var(--muted)]">[Unable to load image]</span>
      );
    },
    a: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
      // Check if this is a YouTube link
      if (href && isYouTubeUrl(href)) {
        const videoId = extractYouTubeVideoId(href);
        const linkText = typeof children === 'string' ? children : extractText(children);
        
        if (videoId) {
          return (
            <YouTubeEmbed 
              videoId={videoId} 
              title={linkText || "YouTube video"} 
              originalUrl={href}
            />
          );
        }
      }
      
      // Check if this is a pollinations.ai image link
      if (href && href.includes('image.pollinations.ai')) {
        const urlWithNoLogo = ensureNoLogo(href);
        const linkText = typeof children === 'string' ? children : extractText(children);
        
        return (
          <div className="my-4">
            <div className="block cursor-pointer">
                              <ImageWithLoading 
                  src={urlWithNoLogo} 
                  alt={linkText || "Generated image"} 
                  className="rounded-lg max-w-full hover:opacity-90 transition-opacity border border-[var(--accent)] shadow-md" 
                  onImageClick={() => openImageModal(urlWithNoLogo, linkText || "Generated image")}
                />
            </div>
            <div className="text-sm text-[var(--muted)] mt-2 italic text-center">{linkText}</div>
          </div>
        );
      }
      
      // Regular link rendering
      return (
        <a 
          href={href} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-[var(--foreground)] border-b border-[var(--muted)] hover:border-[var(--foreground)] transition-colors"
          {...props}
        >
          {children}
        </a>
      );
    },
    code: ({ node, className, children, ...props }: React.PropsWithChildren<{ node?: any; className?: string;[key: string]: any; }>) => {
      const match = /language-(\w+)/.exec(className || '');
      const isInline = !match;
      
      if (isInline) {
        return (
          <code className="hljs font-mono text-sm bg-[var(--inline-code-bg)] text-[var(--inline-code-text)] px-1.5 py-0.5 rounded" {...props}>
            {children}
          </code>
        );
      }
      
      const language = match?.[1] || '';
      // Use the existing extractText utility which is designed to handle complex children structures.
      const codeText = extractText(children);
    
      if (language === 'math') {
        const key = `math-code-${codeText.slice(0, 20).replace(/\W/g, '')}`;
        return (
          <div className="non-paragraph-wrapper" key={key}>
            <MathBlock content={codeText} />
          </div>
        );
      }
      
      if (language === 'diff') {
        const lines = codeText.split('\n');
        
        return (
          <div className="message-code group relative my-6 max-w-full overflow-hidden">
            <div className="message-code-header flex items-center justify-between px-4 py-2 min-w-0">
              <span className="text-xs uppercase tracking-wider text-[var(--muted)] break-all truncate">
                diff
              </span>
              <button
                onClick={(e) => handleCopy(codeText, e)}
                className="text-xs uppercase tracking-wider px-2 py-1 
                         text-[var(--muted)] hover:text-[var(--foreground)] 
                         transition-colors whitespace-nowrap ml-2 flex-shrink-0"
              >
                Copy
              </button>
            </div>
            <div className="hljs overflow-x-auto bg-[var(--code-bg)] text-[var(--code-text)] max-w-full">
              <div className="font-mono text-sm">
                {lines.map((line, index) => {
                  const trimmedLine = line.trim();
                  let lineClass = '';
                  let lineStyle = {};
                  let prefix = '';
                  
                  if (trimmedLine.startsWith('+')) {
                    // Added line
                    lineClass = 'bg-green-500/10 text-green-600 dark:text-green-400';
                    lineStyle = { 
                      backgroundColor: 'rgba(34, 197, 94, 0.1)',
                      borderLeft: '3px solid rgb(34, 197, 94)'
                    };
                    prefix = '+';
                  } else if (trimmedLine.startsWith('-')) {
                    // Removed line
                    lineClass = 'bg-red-500/10 text-red-600 dark:text-red-400';
                    lineStyle = { 
                      backgroundColor: 'rgba(239, 68, 68, 0.1)',
                      borderLeft: '3px solid rgb(239, 68, 68)'
                    };
                    prefix = '-';
                  } else if (trimmedLine.startsWith('@@')) {
                    // Hunk header
                    lineClass = 'bg-blue-500/10 text-blue-600 dark:text-blue-400';
                    lineStyle = { 
                      backgroundColor: 'rgba(59, 130, 246, 0.1)',
                      fontWeight: 'bold'
                    };
                    prefix = '@@';
                  } else if (trimmedLine.startsWith('+++') || trimmedLine.startsWith('---')) {
                    // File header
                    lineClass = 'bg-gray-500/10 text-gray-600 dark:text-gray-400';
                    lineStyle = { 
                      backgroundColor: 'rgba(107, 114, 128, 0.1)',
                      fontWeight: 'bold'
                    };
                    prefix = trimmedLine.startsWith('+++') ? '+++' : '---';
                  } else {
                    // Context line
                    lineClass = 'text-[var(--code-text)]';
                    prefix = ' ';
                  }
                  
                  return (
                    <div
                      key={index}
                      className={`px-4 py-1 ${lineClass} flex items-start hover:bg-opacity-20 transition-colors`}
                      style={lineStyle}
                    >
                      <span className="inline-block w-4 text-center opacity-60 select-none mr-2 flex-shrink-0">
                        {prefix}
                      </span>
                      <span className="break-words min-w-0 flex-1 whitespace-pre-wrap">
                        {line.slice(1) || ' '}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      }
      
      if (language === 'chartjs') {
        
        // Function to check if JSON is complete (not a streaming fragment)
        const isCompleteJSON = (text: string): boolean => {
          const trimmed = text.trim();
          if (!trimmed) return false;
          
          // Must start and end with braces
          if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
            return false;
          }
          
          // Count braces to ensure they are balanced
          let braceCount = 0;
          let inString = false;
          let escapeNext = false;
          
          for (let i = 0; i < trimmed.length; i++) {
            const char = trimmed[i];
            
            if (escapeNext) {
              escapeNext = false;
              continue;
            }
            
            if (char === '\\') {
              escapeNext = true;
              continue;
            }
            
            if (char === '"' && !escapeNext) {
              inString = !inString;
              continue;
            }
            
            if (!inString) {
              if (char === '{') {
                braceCount++;
              } else if (char === '}') {
                braceCount--;
              }
            }
          }
          
          // JSON is complete if all braces are balanced
          return braceCount === 0;
        };
        
        // Check if the JSON is complete before parsing
        if (!isCompleteJSON(codeText)) {
          return (
            <div className="my-6">
              <div className="flex items-center justify-center h-[300px] w-full">
                <div className="flex flex-col items-center space-y-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  <p className="text-[var(--muted-foreground)] text-sm">Loading chart...</p>
                </div>
              </div>
            </div>
          );
        }
        
        // Function to safely parse both JSON and JavaScript object literals
        const parseChartConfig = (text: string): { success: boolean; config?: any; error?: string } => {
          // First, check for problematic patterns that should be rejected
          const problematicPatterns = [
            /callback[s]?\s*:\s*["\'][^"\']*function\s*\([^)]*\)[^"\']*["\']/gi,  // Callback functions
            /["\'][^"\']*\\(?!["\'\\\/bfnrt]|u[0-9a-fA-F]{4})[^"\']*["\']/g,       // Invalid escape sequences
            /["\'][^"\']*\\\s*\n[^"\']*["\']/g,                                      // Line continuation in strings
          ];
          
          for (const pattern of problematicPatterns) {
            if (pattern.test(text)) {
              return { 
                success: false, 
                error: 'Chart configuration contains unsupported patterns (functions, invalid escapes, or line continuations). Please use simple, static configurations only.' 
              };
            }
          }
          
          // First try standard JSON parsing
          try {
            const config = JSON.parse(text);
            return { success: true, config };
          } catch (jsonError) {
            
            // Try to convert JavaScript object literal to valid JSON
            try {
              // Replace single quotes with double quotes for string values
              // Replace unquoted property names with quoted ones
              let fixedText = text
                // Handle unquoted property names (e.g., type: -> "type":)
                .replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":')
                // Handle single quotes around string values (but be careful with escaped quotes)
                .replace(/'([^'\\]*(\\.[^'\\]*)*)'/g, '"$1"')
                // Handle trailing commas (remove them)
                .replace(/,(\s*[}\]])/g, '$1')
                // Handle JavaScript comments (remove them)
                .replace(/\/\/.*$/gm, '')
                .replace(/\/\*[\s\S]*?\*\//g, '')
                // Clean up any remaining problematic escapes
                .replace(/\\(?!["\\\/bfnrt]|u[0-9a-fA-F]{4})/g, '\\\\');
                
              const config = JSON.parse(fixedText);
              return { success: true, config };
            } catch (fixError) {
              const jsonErrorMsg = jsonError instanceof Error ? jsonError.message : 'Unknown JSON error';
              const fixErrorMsg = fixError instanceof Error ? fixError.message : 'Unknown fix error';
              return { 
                success: false, 
                error: `Failed to parse as JSON or fix JavaScript object literal. JSON Error: ${jsonErrorMsg}, Fix Error: ${fixErrorMsg}` 
              };
            }
          }
        };
        
        // Parse the chart configuration synchronously
        const parseResult = parseChartConfig(codeText);
        
        if (parseResult.success && parseResult.config) {
          const chartConfig = parseResult.config;
          
          // Validate chart configuration structure
          if (typeof chartConfig === 'object' && chartConfig !== null && typeof chartConfig.type === 'string' && typeof chartConfig.data === 'object' && chartConfig.data !== null) {
            return (
              <div className="my-6">
                <DynamicChart chartConfig={chartConfig} />
              </div>
            );
          } else {
            console.warn('[Chart Debug] Invalid chartjs configuration structure. Expected {type: string, data: object, options?: object}. Received:', chartConfig);
            console.warn('[Chart Debug] Type of chartConfig:', typeof chartConfig);
            console.warn('[Chart Debug] chartConfig.type:', typeof chartConfig?.type, chartConfig?.type);
            console.warn('[Chart Debug] chartConfig.data:', typeof chartConfig?.data, chartConfig?.data);
            
            // Return error message for invalid config structure
            return (
              <div className="my-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-600 font-semibold">Invalid Chart Configuration</p>
                <p className="text-red-500 text-sm mt-1">
                  Expected format: {`{type: string, data: object, options?: object}`}
                </p>
                <details className="mt-2">
                  <summary className="text-red-600 cursor-pointer text-sm">Show raw config</summary>
                  <pre className="text-xs text-red-500 mt-1 whitespace-pre-wrap">{JSON.stringify(chartConfig, null, 2)}</pre>
                </details>
              </div>
            );
          }
        } else {
          // Parsing failed completely
          console.error('[Chart Debug] Error parsing chartjs:', parseResult.error);
          console.error('[Chart Debug] Raw text that failed to parse:', codeText);
          
          const errorMessage = parseResult.error || 'Unknown parsing error';
          
          // Return error message for parsing failure
          return (
            <div className="my-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 font-semibold">Chart Parse Error</p>
              <p className="text-red-500 text-sm mt-1">
                Failed to parse chart configuration. Please ensure it's valid JSON format.
              </p>
              <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded">
                <p className="text-blue-600 text-xs font-semibold">Correct JSON format example:</p>
                <pre className="text-xs text-blue-600 mt-1">{`{
  "type": "bar",
  "data": {
    "labels": ["A", "B"],
    "datasets": [{"label": "Data", "data": [1, 2]}]
  }
}`}</pre>
              </div>
              <details className="mt-2">
                <summary className="text-red-600 cursor-pointer text-sm">Show error details</summary>
                <pre className="text-xs text-red-500 mt-1 whitespace-pre-wrap">{errorMessage}</pre>
                <pre className="text-xs text-red-500 mt-1 whitespace-pre-wrap">{codeText}</pre>
              </details>
            </div>
          );
        }
      }
      
      return (
        <div className="message-code group relative my-6 max-w-full overflow-hidden">
          <div className="message-code-header flex items-center justify-between px-4 py-2 min-w-0">
            <span className="text-xs uppercase tracking-wider text-[var(--muted)] break-all truncate">
              {language || 'text'}
            </span>
            <button
              onClick={(e) => handleCopy(codeText, e)}
              className="text-xs uppercase tracking-wider px-2 py-1 
                       text-[var(--muted)] hover:text-[var(--foreground)] 
                       transition-colors whitespace-nowrap ml-2 flex-shrink-0"
            >
              Copy
            </button>
          </div>
          <div className="hljs overflow-x-auto p-4 m-0 bg-[var(--code-bg)] text-[var(--code-text)] max-w-full">
            <pre className="whitespace-pre-wrap break-words min-w-0 font-mono text-sm">{children}</pre>
          </div>
        </div>
      );
    },
    table: ({ children, ...props }: React.PropsWithChildren<ExtraProps>) => (
      <div className="overflow-x-auto my-6 max-w-full">
        <table className="w-full border-collapse table-auto" {...props}>{children}</table>
      </div>
    ),
    th: ({ children, ...props }) => (
      <th className="bg-[var(--accent)] font-medium text-[var(--muted)] uppercase tracking-wider p-3 border border-[var(--accent)] text-left min-w-0" {...props}>
        <div className="break-words">{children}</div>
      </th>
    ),
    td: ({ children, ...props }) => (
      <td className="p-3 border border-[var(--accent)] min-w-0" {...props}>
        <div className="break-words">{children}</div>
      </td>
    ),
    blockquote: ({ children, ...props }) => (
      <blockquote className="border-l-2 border-[var(--muted)] pl-4 my-6 text-[var(--muted)] italic" {...props}>
        {children}
      </blockquote>
    ),
    ul: ({ children, ...props }) => (
      <ul className="my-4 list-disc list-inside pl-5" {...props}>
        {children}
      </ul>
    ),
    ol: ({ children, ...props }) => (
      <ol className="my-4 list-decimal list-inside pl-5" {...props}>
        {children}
      </ol>
    ),
    li: ({ children, ...props }) => (
      <li className="my-2 break-words" style={{ display: 'list-item' }} {...props}>{children}</li>
    ),
    h1: ({ children, ...props }) => (
      <h1 className="text-2xl font-bold mt-8 mb-4 break-words" {...props}>{children}</h1>
    ),
    h2: ({ children, ...props }) => (
      <h2 className="text-xl font-bold mt-6 mb-3 break-words" {...props}>{children}</h2>
    ),
    h3: ({ children, ...props }) => (
      <h3 className="text-lg font-bold mt-5 mb-2 break-words" {...props}>{children}</h3>
    ),
    strong: ({ children, ...props }) => (
      <strong className="font-bold" {...props}>{children}</strong>
    ),
    em: ({ children, ...props }) => (
      <em className="italic" {...props}>{children}</em>
    ),
    b: ({ children, ...props }) => (
      <b className="font-bold" {...props}>{children}</b>
    ),
    i: ({ children, ...props }) => (
      <i className="italic" {...props}>{children}</i>
    ),
    math: ({ value, inline }: MathProps) => {
      // For block math, use the dedicated wrapper component
      if (!inline) {
        return <MathBlock content={value} />;
      }
      
      // For inline math, use the simpler inline wrapper
      return <InlineMath content={value} />;
    },
  }), [styleMentions, styleImageUrls, extractText, handleCopy, openImageModal]);

  // Memoize the remarkPlugins and rehypePlugins
  const remarkPlugins = useMemo(() => [remarkGfm, remarkMath], []);
  
  // Updated rehypePlugins with proper configuration
  const rehypePlugins = useMemo(() => {
    return [
      [rehypeRaw, { passThrough: ['math', 'inlineMath'] }],
      rehypeHighlight,
    ] as any;
  }, []);

  // If segmentation is enabled, render multiple segments
  return (
    <>
      <div className={variant === 'clean' ? 'markdown-segments' : 'message-segments'}>
        {segments.map((segment, index) => (
          <div key={index} className={`${variant === 'clean' ? 'markdown-segment' : 'message-segment'}`}>
            <div className="max-w-full overflow-x-auto">
              <ReactMarkdown
                className="message-content break-words"
                remarkPlugins={remarkPlugins}
                rehypePlugins={rehypePlugins}
                components={components}
              >
                {segment}
              </ReactMarkdown>
            </div>
          </div>
        ))}
      </div>

      {/* Image Modal */}
      {isMounted && selectedImage && createPortal(
        <div 
          className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center" 
          onClick={closeImageModal}
        >
          {/* Close button */}
          <button 
            className="absolute top-4 right-4 bg-black/40 hover:bg-black/60 p-2 rounded-full text-white transition-colors"
            onClick={closeImageModal}
            aria-label="Close image viewer"
          >
            <X size={24} />
          </button>
          
          {/* View original button */}
          <a
            href={selectedImage.src}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute top-4 left-4 bg-black/40 hover:bg-black/60 p-2 rounded-lg text-white transition-colors flex items-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink size={16} />
            <span className="hidden sm:inline">View Original</span>
          </a>
          
          {/* Main image container */}
          <div 
            className="relative flex items-center justify-center bg-transparent rounded-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            style={{ width: '90vw', height: '90vh' }}
          >
            <div className="relative group cursor-pointer flex flex-col items-center">
              <div className="relative">
                <img
                  src={selectedImage.src}
                  alt={selectedImage.alt}
                  className="rounded-md shadow-xl"
                  style={{ 
                    maxWidth: '100%', 
                    maxHeight: '75vh', 
                    objectFit: 'contain',
                    width: 'auto',
                    height: 'auto'
                  }}
                  referrerPolicy="no-referrer"
                />
                
                {/* Download button */}
                <button
                  className="absolute bottom-4 right-4 bg-black/40 hover:bg-black/60 p-2 rounded-full text-white transition-colors z-20"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Download image by first fetching it as a blob
                    fetch(selectedImage.src)
                      .then(response => response.blob())
                      .then(blob => {
                        // Create an object URL from the blob
                        const blobUrl = URL.createObjectURL(blob);
                        
                        // Create and trigger download
                        const link = document.createElement('a');
                        link.href = blobUrl;
                        link.download = `image-${Date.now()}.jpg`;
                        document.body.appendChild(link);
                        link.click();
                        
                        // Clean up
                        setTimeout(() => {
                          document.body.removeChild(link);
                          URL.revokeObjectURL(blobUrl);
                        }, 100);
                      })
                      .catch(error => {
                        console.error('Download failed:', error);
                      });
                  }}
                  aria-label="Download image"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                </button>
              </div>
              
              {/* Caption below the image */}
              {selectedImage.alt && (
                <div className="text-center text-white text-sm mt-4 z-10 bg-black/30 py-2 px-4 rounded-md">
                  {selectedImage.alt}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}); 