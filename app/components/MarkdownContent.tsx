import { useState, useMemo, memo, useCallback, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import type { Components, ExtraProps } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import rehypeHighlight from 'rehype-highlight';
import { MathJaxEquation } from './math/MathJaxEquation';
import type { LinkCardData } from '@/app/types/linkPreview';
import React from 'react';
import dynamic from 'next/dynamic';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight, ExternalLink, Play, Pause, Volume2, VolumeX, Download, Bookmark, Share, ScrollText, Info, Check, Copy, Maximize } from 'lucide-react';
import { getAdaptiveGlassStyleBlur, getIconClassName } from '@/app/lib/adaptiveGlassStyle';
import { LinkPreview } from './LinkPreview';
import { useUrlRefresh } from '../hooks/useUrlRefresh';
import { useLazyMedia } from '../hooks/useIntersectionObserver';
import { highlightSearchTerm, highlightSearchTermInChildren } from '@/app/utils/searchHighlight';
import { Tweet } from 'react-tweet';
import { ImageGalleryStack } from './ImageGalleryStack';
import { categorizeAspectRatio, parseImageDimensions, parseMediaDimensions, getAspectCategory } from '@/app/utils/imageUtils';
import { ImageModal, type ImageModalImage } from './ImageModal';

// Dynamically import MermaidDiagram for client-side rendering
const MermaidDiagram = dynamic(() => import('./Mermaid'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[300px] w-full bg-[var(--accent)] rounded-lg shadow-md">
      <p className="text-[var(--muted-foreground)]">Loading diagram...</p>
    </div>
  ),
});

// Dynamically import DynamicChart for client-side rendering
const DynamicChart = dynamic(() => import('./charts/DynamicChart'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[300px] w-full bg-[var(--accent)] rounded-lg shadow-md">
      <p className="text-[var(--muted-foreground)]">Loading chart...</p>
    </div>
  ),
});

// Twitter URL detection and ID extraction
const isTwitterUrl = (url: string): boolean => {
  if (!url) return false;
  const twitterRegex = /^(https?:\/\/)?(www\.)?(twitter\.com|x\.com)\/.+/i;
  return twitterRegex.test(url);
};

const extractTwitterId = (url: string): string | null => {
  const patterns = [
    // Standard Twitter URL: https://twitter.com/username/status/1234567890
    /(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/,
    // Short Twitter URL: https://t.co/abc123
    /t\.co\/([^\/\?]+)/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }
  return null;
};

// Twitter Embed Component with fallback to LinkPreview
export const TwitterEmbed = memo(function TwitterEmbedComponent({ 
  tweetId, 
  originalUrl 
}: { 
  tweetId: string; 
  originalUrl?: string;
}) {
  const [hasError, setHasError] = useState(false);
  const [useFallback, setUseFallback] = useState(false);
  
  // If error occurs, fallback to LinkPreview
  if (useFallback && originalUrl) {
    return (
      <div className="my-4">
        <LinkPreview url={originalUrl} />
      </div>
    );
  }
  
  return (
    <div className="my-6 w-full flex justify-center">
      <div 
        className="w-full max-w-[400px]"
        style={{
          maxWidth: 'min(400px, calc(100vw - 2rem))',
          width: '100%'
        }}
      >
        {/* Error state */}
        {hasError && (
          <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 text-center">
            <div className="w-12 h-12 mx-auto mb-2 bg-blue-500 rounded-full flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </div>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">Twitter failed to load</p>
            <p className="text-gray-500 dark:text-gray-500 text-xs mb-3">Falling back to link preview...</p>
            {originalUrl && (
              <button
                onClick={() => setUseFallback(true)}
                className="text-blue-500 hover:text-blue-400 text-xs underline mb-2 block"
              >
                Show as link preview
              </button>
            )}
            {originalUrl && (
              <a
                href={originalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:text-blue-400 text-xs underline"
              >
                Open on Twitter
              </a>
            )}
          </div>
        )}
        
        {/* Twitter embed */}
        {!hasError && (
          <div 
            className="w-full [&>div]:w-full [&>div]:mx-auto rounded-lg overflow-hidden [&_a]:!text-[color-mix(in_srgb,var(--foreground)_75%,transparent)] [&_a:hover]:!text-[color-mix(in_srgb,var(--foreground)_90%,transparent)] [&_.react-tweet-theme]:!bg-[color-mix(in_srgb,var(--background)_97%,var(--foreground)_3%)] dark:[&_.react-tweet-theme]:!bg-[color-mix(in_srgb,var(--background)_97%,var(--foreground)_3%)] [&_.react-tweet-border]:!border-[color-mix(in_srgb,var(--foreground)_5%,transparent)] [&_hr]:!border-[color-mix(in_srgb,var(--foreground)_5%,transparent)] [&_div[data-separator]]:!border-[color-mix(in_srgb,var(--foreground)_5%,transparent)] [&_.react-tweet-header-border]:!border-[color-mix(in_srgb,var(--foreground)_5%,transparent)] [&_.react-tweet-footer-border]:!border-[color-mix(in_srgb,var(--foreground)_5%,transparent)] [&_*]:!border-[color-mix(in_srgb,var(--foreground)_5%,transparent)] [&_video]:!max-w-full [&_video]:!h-auto [&_iframe]:!max-w-full [&_iframe]:!h-auto"
            style={{
              maxWidth: '100%',
              width: '100%',
              maxHeight: 'min(600px, calc(100vh - 4rem))',
              overflowY: 'auto'
            }}
          >
            <Tweet id={tweetId} />
          </div>
        )}
      </div>
    </div>
  );
});

// 더 정교한 LaTeX 전처리 함수 추가
const preprocessLaTeX = (content: string) => {
  if (!content) return '';
  
  // 볼드체 패턴(**...**)을 먼저 보호하여 LaTeX 처리 과정에서 손상되지 않도록 함
  // 볼드체는 **로 시작하고 **로 끝나며, 내부에 **가 없어야 함 (단일 *는 허용)
  const boldPattern = /\*\*((?:[^*]|\*(?!\*))+)\*\*/g;
  const boldBlocks: string[] = [];
  let processedContent = content.replace(boldPattern, (match, innerContent) => {
    const id = boldBlocks.length;
    boldBlocks.push(innerContent);
    return `___BOLD_PATTERN_${id}___`;
  });
  
  // 이미 이스케이프된 구분자 처리
  processedContent = processedContent
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
  // 더 정확한 LaTeX 수식 패턴 매칭
  const inlineRegex = /(?<![\w&])\$((?:\\\$|[^$])+?)\$(?![\w])/g;
  const inlines: string[] = [];
  processedContent = processedContent.replace(inlineRegex, (match) => {
    const innerContent = match.substring(1, match.length - 1).trim();
    
    // 빈 내용이면 수식이 아님
    if (innerContent === "") {
        return match;
    }
    
    // 화폐 패턴인지 확인 (이미 이스케이프된 화폐 기호는 제외)
    const isCurrencyPattern = /^(\d+(?:[.,]\d+)*(?:[KMBkmb])?)$/.test(innerContent) ||
                             /^(\d+(?:[.,]\d+)*\s+(?:million|billion|thousand|trillion|M|B|K|k))$/i.test(innerContent);
    
    // 프로그래밍 변수 패턴 확인 (예: $variable, $user_name)
    const isProgrammingVariable = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(innerContent);
    
    // 템플릿 변수 패턴 확인 (예: ${variableName})
    const isTemplateVariable = /^\{[a-zA-Z_][a-zA-Z0-9_.]*\}$/.test(innerContent);
    
    // 실제 수학 표현식인지 확인 (수학 기호나 변수가 포함되어 있는지)
    const hasMathSymbols = /[+\-*/=<>()\[\]{}^_\\]/.test(innerContent) ||
                           /[a-zA-Z]/.test(innerContent) ||
                           /\\[a-zA-Z]/.test(innerContent); // LaTeX 명령어
    
    // LaTeX 명령어가 있는지 확인 (더 정확한 수식 판별)
    const hasLatexCommands = /\\[a-zA-Z]/.test(innerContent);
    
    // 그리스 문자나 수학 기호가 있는지 확인
    const hasGreekOrMath = /[αβγδεζηθικλμνξοπρστυφχψωςΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ]/.test(innerContent) ||
                           /[∫∑∏√∞±×÷≤≥≠≈≡]/.test(innerContent);
    
    // 짧은 수식 패턴 확인 (예: $x$, $y$, $z$)
    const isShortMathVariable = /^[a-zA-Z]$/.test(innerContent);
    
    // 화폐 패턴이면서 수학 기호가 없으면 화폐로 처리
    if (isCurrencyPattern && !hasMathSymbols && !hasLatexCommands && !hasGreekOrMath) {
        return match; // 수식으로 처리하지 않음
    }
    
    // 프로그래밍 변수나 템플릿 변수는 화폐로 처리
    if (isProgrammingVariable || isTemplateVariable) {
        return match; // 수식으로 처리하지 않음
    }
    
    // 짧은 수학 변수는 LaTeX로 처리 (예: $x$, $y$, $z$)
    if (isShortMathVariable) {
        const id = inlines.length;
        inlines.push(match);
        return `___LATEX_INLINE_${id}___`;
    }
    
    // 실제 수학 표현식인 경우에만 LaTeX로 처리
    if (hasMathSymbols || hasLatexCommands || hasGreekOrMath || innerContent.length > 3) { 
        // 길이가 3보다 크고 복잡한 패턴이면 수식일 가능성이 높음
        const id = inlines.length;
        inlines.push(match);
        return `___LATEX_INLINE_${id}___`;
    }
    
    // 그 외의 경우는 화폐로 간주
    return match;
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

  // 볼드체 패턴 복원 (LaTeX 처리 완료 후)
  // react-markdown이 따옴표가 포함된 볼드체를 잘 처리하지 못하는 경우가 있어 HTML 태그로 변환
  processedContent = processedContent.replace(/___BOLD_PATTERN_(\d+)___/g, (_, id) => {
    return `<strong>${boldBlocks[parseInt(id)]}</strong>`;
  });

  return processedContent;
};

// 정교한 화폐 기호 처리 함수
function escapeCurrencyDollars(text: string): string {
  if (!text.includes('$')) return text;
  
  // 1. 이미 HTML 엔티티로 이스케이프된 달러 기호는 건너뛰기
  const htmlEntityRegex = /&#36;/g;
  const htmlEntities: string[] = [];
  let entityIndex = 0;
  text = text.replace(htmlEntityRegex, () => {
    htmlEntities.push('&#36;');
    return `___HTML_ENTITY_${entityIndex++}___`;
  });
  
  // 2. 화폐 패턴들을 더 정확하게 식별
  // 패턴 1: $숫자 (예: $100, $1,000, $570M, $1.5B)
  const currencyPattern1 = /(?<![\\a-zA-Z0-9_])\$(\d+(?:[.,]\d+)*(?:[KMBkmb])?)(?=\b|[^\w\s])/g;
  
  // 패턴 2: $숫자M, $숫자B 등 (예: $570M, $1.5B)
  const currencyPattern2 = /(?<![\\a-zA-Z0-9_])\$(\d+(?:[.,]\d+)*[KMBkmb])(?=\b|[^\w\s])/g;
  
  // 패턴 3: 일반적인 화폐 표현 (예: $100 million, $1.5 billion)
  const currencyPattern3 = /(?<![\\a-zA-Z0-9_])\$(\d+(?:[.,]\d+)*\s+(?:million|billion|thousand|trillion|M|B|K|k))(?=\b|[^\w\s])/gi;
  
  // 패턴 4: 프로그래밍 변수 (예: $variable, $user_name) - 화폐로 처리하지 않음
  const programmingVariablePattern = /(?<![\\a-zA-Z0-9_])\$([a-zA-Z_][a-zA-Z0-9_]*)(?=\b|[^\w\s])/g;
  
  // 패턴 5: 템플릿 변수 (예: ${variableName}) - 화폐로 처리하지 않음
  const templateVariablePattern = /(?<![\\a-zA-Z0-9_])\$\{[a-zA-Z_][a-zA-Z0-9_.]*\}(?=\b|[^\w\s])/g;
  
  // 패턴 6: 주식 티커 심볼 (예: $NVDA, $ORCL, $AAPL) - 화폐로 처리
  const stockTickerPattern = /(?<![\\a-zA-Z0-9_])\$([A-Z]{1,5})(?=\b|[^\w\s])/g;
  
  // 패턴 7: 백슬래시로 이스케이프된 달러는 LaTeX 수식이므로 건드리지 않음
  const escapedDollarRegex = /\\\$/g;
  const escapedDollars: string[] = [];
  let escapedIndex = 0;
  text = text.replace(escapedDollarRegex, () => {
    escapedDollars.push('\\$');
    return `___ESCAPED_DOLLAR_${escapedIndex++}___`;
  });
  
  // 3. 화폐 패턴들을 HTML 엔티티로 변환 (프로그래밍/템플릿 변수는 제외)
  text = text.replace(currencyPattern1, '&#36;$1');
  text = text.replace(currencyPattern2, '&#36;$1');
  text = text.replace(currencyPattern3, '&#36;$1');
  text = text.replace(stockTickerPattern, '&#36;$1');
  
  // 프로그래밍 변수와 템플릿 변수는 그대로 유지 (화폐로 처리하지 않음)
  // 이들은 LaTeX 수식 처리 단계에서 적절히 처리됨
  
  // 4. 이스케이프된 달러 복원
  text = text.replace(/___ESCAPED_DOLLAR_(\d+)___/g, (_, id) => {
    return escapedDollars[parseInt(id)];
  });
  
  // 5. HTML 엔티티 복원
  text = text.replace(/___HTML_ENTITY_(\d+)___/g, (_, id) => {
    return htmlEntities[parseInt(id)];
  });
  
  return text;
}

interface MarkdownContentProps {
  content: string;
  enableSegmentation?: boolean;
  variant?: 'default' | 'clean'; // 'clean'은 배경색 없는 버전
  searchTerm?: string | null; // 🚀 FEATURE: Search term for highlighting
  isReasoningSection?: boolean; // ReasoningSection에서만 메시지 형식 완전 제거
  messageType?: 'user' | 'assistant' | 'default'; // 🚀 FEATURE: Message type for different highlight colors
  thumbnailMap?: { [key: string]: string }; // 🚀 FEATURE: Thumbnail map for link previews
  titleMap?: { [key: string]: string }; // 🚀 FEATURE: Title map for link previews
  linkPreviewData?: Record<string, LinkCardData>;
  isMobile?: boolean;
  noTail?: boolean; // 꼬리 제거 옵션
  isLongPressActive?: boolean; // 🚀 FEATURE: Long press state for segment shadows
  isStreaming?: boolean; // 🚀 FEATURE: Streaming state for Mermaid diagrams
  messageId?: string; // 🚀 FEATURE: For URL refreshing
  chatId?: string; // 🚀 FEATURE: For URL refreshing
  userId?: string; // 🚀 FEATURE: For URL refreshing
  promptMap?: { [key: string]: string }; // 🚀 FEATURE: Prompt map for image prompts
  sourceImageMap?: { [key: string]: string }; // 🚀 FEATURE: Source image map for video prompts
}

// 더 적극적으로 마크다운 구조를 분할하는 함수 - 구분선(---)을 기준으로 메시지 그룹 분할
const segmentContent = (content: string): string[][] => {
  if (!content || !content.trim()) return [];

  const trimmedContent = content.trim();
  


  // 1. 이미지 ID와 마크다운 이미지 문법을 별도 세그먼트로 분리
  const imageIdRegex = /\[IMAGE_ID:([^\]]+)\]/g;
  // 더 안전한 마크다운 이미지 파싱 - 괄호가 포함된 URL 처리
  const parseMarkdownImages = (text: string) => {
    const results: Array<{match: string, alt: string, url: string, start: number, end: number}> = [];
    let index = 0;
    
    while (index < text.length) {
      const imgStart = text.indexOf('![', index);
      if (imgStart === -1) break;
      
      const altStart = imgStart + 2;
      const altEnd = text.indexOf(']', altStart);
      if (altEnd === -1) {
        index = imgStart + 1;
        continue;
      }
      
      const urlStart = text.indexOf('(', altEnd);
      if (urlStart === -1 || urlStart !== altEnd + 1) {
        index = imgStart + 1;
        continue;
      }
      
      // URL 끝 찾기 - 괄호 밸런스 고려
      let urlEnd = urlStart + 1;
      let parenCount = 1;
      while (urlEnd < text.length && parenCount > 0) {
        if (text[urlEnd] === '(') parenCount++;
        else if (text[urlEnd] === ')') parenCount--;
        urlEnd++;
      }
      
      if (parenCount === 0) {
        const alt = text.slice(altStart, altEnd);
        const url = text.slice(urlStart + 1, urlEnd - 1);
        const match = text.slice(imgStart, urlEnd);
        results.push({ match, alt, url, start: imgStart, end: urlEnd });
        index = urlEnd;
      } else {
        index = imgStart + 1;
      }
    }
    
    return results;
  };
  const imageSegments: string[] = [];
  let imageIndex = 0;
  
  // 이미지 ID를 임시 마커로 교체
  let contentWithoutImages = trimmedContent.replace(imageIdRegex, (match, imageId) => {
    imageSegments.push(match);
    return `\n\n<IMAGE_SEGMENT_${imageIndex++}>\n\n`;
  });
  
  // 마크다운 이미지 문법을 임시 마커로 교체 - 더 안전한 파싱
  const markdownImages = parseMarkdownImages(contentWithoutImages);
  // 역순으로 처리하여 인덱스 변경 방지
  markdownImages.reverse().forEach(({ match, alt, url, start, end }) => {
    console.log('Parsed markdown image:', { match, alt, url });
    imageSegments.push(match);
    contentWithoutImages = contentWithoutImages.slice(0, start) + 
      `\n\n<IMAGE_SEGMENT_${imageIndex++}>\n\n` + 
      contentWithoutImages.slice(end);
  });

  // 2. 모든 코드 블록을 먼저 임시 플레이스홀더로 교체 (차트 블록 포함)
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
  
  const placeholderContent = extractCodeBlocks(contentWithoutImages);

  // 3. 코드 블록을 제외한 나머지 텍스트에서 링크를 별도 세그먼트로 분리
  const linkSegments: string[] = [];
  let linkIndex = 0;
  
  // 마크다운 링크 문법 [텍스트](URL) 감지 및 분리 (코드 블록 플레이스홀더는 제외)
  const markdownLinkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;
  const contentWithLinkSegments = placeholderContent.replace(markdownLinkRegex, (match, text, url) => {
    // 코드 블록 플레이스홀더 내부가 아닌 경우만 링크로 분리
    if (!match.includes('<CODE_PLACEHOLDER_')) {
      linkSegments.push(match);
      return `\n\n<LINK_SEGMENT_${linkIndex++}>\n\n`;
    }
    return match;
  });
  
  // 일반 URL 패턴 감지 및 분리 (마크다운 링크가 아닌 경우만, 코드 블록 플레이스홀더 제외)
  const urlRegex = /(https?:\/\/[^\s"'<>]+)/g;
  const finalContent = contentWithLinkSegments.replace(urlRegex, (match, url) => {
    // 이미 마크다운 링크로 처리된 URL이 아니고, 코드 블록 플레이스홀더 내부가 아닌 경우만 처리
    // 이미지 호스팅 URL은 제외 (이미지 렌더링 로직에서 처리하도록)
    const isImageUrl = 
      url.includes('/storage/v1/object/public/gemini-images/') ||
      url.includes('/storage/v1/object/sign/generated-images/');
    
    if (!match.includes('[') && !match.includes(']') && !match.includes('<CODE_PLACEHOLDER_') && !isImageUrl) {
      linkSegments.push(match);
      return `\n\n<LINK_SEGMENT_${linkIndex++}>\n\n`;
    }
    return match;
  });

  // 4. 구분선(---)을 기준으로 먼저 메시지 그룹을 분할
  const messageGroups: string[][] = [];
  let currentGroup: string[] = [];

  const separatorSegments = finalContent.split(/\n\s*---\s*\n/);

  separatorSegments.forEach(segment => {
    if (segment.trim()) {
      const subSegments = splitSegmentByLineBreaks(segment);
      currentGroup.push(...subSegments);
    }
  });
  
  if (currentGroup.length > 0) {
    messageGroups.push([...currentGroup]);
  }

  // 5. 코드 블록과 이미지 세그먼트 복원 (그룹 단위 유지)
  const finalMessageGroups: string[][] = [];

  for (const group of messageGroups) {
    const processedGroup: string[] = [];

    for (const segment of group) {
      if (!segment || !segment.trim()) continue;

      // 이미지 세그먼트 먼저 복원
      let processedSegment = segment;
      const imageSegmentRegex = /<IMAGE_SEGMENT_(\d+)>/g;
      let imageMatch;

      while ((imageMatch = imageSegmentRegex.exec(processedSegment)) !== null) {
        const imageIndex = parseInt(imageMatch[1], 10);
        const imageSegment = imageSegments[imageIndex];
        if (imageSegment) {
          processedGroup.push(imageSegment);
        }
      }

      // 이미지 세그먼트 마커 제거
      processedSegment = processedSegment.replace(imageSegmentRegex, '');

      // 링크 세그먼트 복원
      const linkSegmentRegex = /<LINK_SEGMENT_(\d+)>/g;
      let linkMatch;

      while ((linkMatch = linkSegmentRegex.exec(processedSegment)) !== null) {
        const linkIndex = parseInt(linkMatch[1], 10);
        const linkSegment = linkSegments[linkIndex];
        if (linkSegment) {
          processedGroup.push(linkSegment);
        }
      }

      // 링크 세그먼트 마커 제거
      processedSegment = processedSegment.replace(linkSegmentRegex, '');

      // 코드 블록 플레이스홀더 복원
      const codePlaceholderRegex = /<CODE_PLACEHOLDER_(\d+)>/g;
      let lastIndex = 0;
      let match;

      while ((match = codePlaceholderRegex.exec(processedSegment)) !== null) {
        if (match.index > lastIndex) {
          const textSegment = processedSegment.slice(lastIndex, match.index).trim();
          if (textSegment) {
            processedGroup.push(textSegment);
          }
        }
        processedGroup.push(codeBlocks[parseInt(match[1], 10)]);
        lastIndex = match.index + match[0].length;
      }

      if (lastIndex < processedSegment.length) {
        const remainingText = processedSegment.slice(lastIndex).trim();
        if (remainingText) {
          processedGroup.push(remainingText);
        }
      }
    }

    if (processedGroup.length > 0) {
      finalMessageGroups.push(processedGroup.filter(s => s.trim().length > 0));
    }
  }

  // 6. 최종적으로 비어있지 않은 그룹만 반환
  const result = finalMessageGroups.filter(group => group.length > 0);

  if (result.length === 0) {
    return [[trimmedContent]];
  }

  return result;
};

// 과감하게 세그먼트를 분할하는 함수 - 마크다운 구조를 고려하되 텍스트, 리스트, 테이블은 적절히 유지
const splitSegmentByLineBreaks = (segment: string): string[] => {
  if (!segment || !segment.trim()) return [];

  // 단일 줄이면 그대로 반환
  if (!segment.includes('\n')) {
    return [segment.trim()];
  }

  const lines = segment.split('\n');
  const segments: string[] = [];
  let currentSegment: string[] = [];
  let inTableBlock = false; // 테이블 블록 상태 추가

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // 헤더는 항상 별도의 세그먼트로 분리
    if (/^#{1,3}\s/.test(trimmedLine)) {
      if (currentSegment.length > 0) {
        segments.push(currentSegment.join('\n').trim());
      }
      segments.push(line);
      currentSegment = [];
      continue;
    }

    // Block detectors
    const isListItem = /^([-*+]\s(?:\[[ xX]\]\s)?|\d+\.\s)/.test(trimmedLine);
    const isTableLine = /^\s*\|.*\|\s*$/.test(trimmedLine); // 테이블 행 감지

    // 리스트 아이템들을 들여쓰기 레벨별로 그룹핑 (부모와 자식 그룹 분리)
    if (isListItem) {
      if (currentSegment.length > 0) {
        segments.push(currentSegment.join('\n').trim());
        currentSegment = [];
      }
      
      const listBlock: string[] = [];
      let j = i;
      let minIndent = -1;

      while (j < lines.length) {
        const lineContent = lines[j];
        const trimmedContent = lineContent.trim();

        if (trimmedContent === '') {
          // 비어있는 줄 다음에 리스트가 계속되지 않으면 리스트 블록 종료
          if (j + 1 >= lines.length || !/^(\s*)[-*+]/.test(lines[j + 1])) {
            break;
          }
          listBlock.push(lineContent);
          j++;
          continue;
        }

        const isLineListItem = /^([-*+]\s(?:\[[ xX]\]\s)?|\d+\.\s)/.test(trimmedContent);
        const currentIndent = lineContent.match(/^(\s*)/)?.[0].length ?? 0;

        if (minIndent === -1 && isLineListItem) {
          minIndent = currentIndent;
        }

        if (isLineListItem) {
          if (currentIndent < minIndent) {
            break; // 들여쓰기가 줄어들면 리스트 블록 종료
          }
          listBlock.push(lineContent);
        } else if (minIndent !== -1 && currentIndent > minIndent) {
          // 리스트 아이템에 속한 여러 줄 텍스트
          listBlock.push(lineContent);
        } else {
          break; // 리스트 블록이 아닌 경우
        }
        j++;
      }

      if (listBlock.length > 0) {
        segments.push(listBlock.join('\n'));
      }
      i = j - 1; // 메인 루프 인덱스 업데이트
      continue;
    }

    // 분할 조건들 - 블록 외부에서만 적용
    const shouldSplit =
      (trimmedLine === '' && !inTableBlock) ||
      /^```/.test(trimmedLine) ||
      /^---+$/.test(trimmedLine) ||
      /^[*_-]{3,}$/.test(trimmedLine);

    // 테이블이 시작될 때 새로운 세그먼트 시작
    if (!inTableBlock && isTableLine && currentSegment.length > 0) {
      segments.push(currentSegment.join('\n').trim());
      currentSegment = [];
    }

    // 테이블 블록 종료 조건
    if (inTableBlock && (!isTableLine || shouldSplit) && currentSegment.length > 0) {
      segments.push(currentSegment.join('\n').trim());
      currentSegment = [];
      inTableBlock = false;
    }

    const isSeparator = /^---+$/.test(trimmedLine) || /^[*_-]{3,}$/.test(trimmedLine);

    // 일반적인 분할 처리
    if (shouldSplit && currentSegment.length > 0) {
        // 볼드 제목과 그 다음 내용이 분리되지 않도록 처리
        const lastLine = currentSegment[currentSegment.length - 1].trim();
        if (/^\*\*[^*]+\*\*\s*$/.test(lastLine) && trimmedLine !== '') {
            // 아무것도 하지 않음 (분할 방지)
        } else {
            segments.push(currentSegment.join('\n').trim());
            currentSegment = [];
        }
    }

    // 블록 상태 시작
    if (isTableLine) {
      inTableBlock = true;
    }

    // 현재 세그먼트에 내용 추가
    if (!isSeparator && !(shouldSplit && trimmedLine === '')) {
      currentSegment.push(line);
    }
  }

  // 마지막 세그먼트 추가
  if (currentSegment.length > 0) {
    segments.push(currentSegment.join('\n').trim());
  }

  return segments.filter(s => s.length > 0 && s.trim().length > 0);
};

// YouTube utility functions
const isYouTubeUrl = (url: string): boolean => {
  if (!url) return false;
  const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be|m\.youtube\.com)\/.+/i;
  return youtubeRegex.test(url);
};

const isYouTubeShorts = (url: string): boolean => {
  if (!url) return false;
  return url.includes('/shorts/') || url.includes('youtube.com/shorts/');
};

const extractYouTubeVideoId = (url: string): string | null => {
  if (!url) return null;
  
  // Handle YouTube Shorts first
  if (isYouTubeShorts(url)) {
    const shortsMatch = url.match(/(?:youtube\.com\/shorts\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (shortsMatch && shortsMatch[1]) {
      return shortsMatch[1];
    }
  }
  
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

// TikTok utility functions
const isTikTokUrl = (url: string): boolean => {
  return url.includes('tiktok.com') || url.includes('vm.tiktok.com');
};

const extractTikTokVideoId = (url: string): string | null => {
  const patterns = [
    // Standard TikTok video URL: https://www.tiktok.com/@username/video/1234567890
    /tiktok\.com\/@([^\/]+)\/video\/(\d+)/,
    // Generic TikTok video URL: https://www.tiktok.com/video/1234567890
    /tiktok\.com\/.*\/video\/(\d+)/,
    // Short TikTok URL: https://vm.tiktok.com/abc123
    /vm\.tiktok\.com\/([^\/\?]+)/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      // For @username/video/1234567890 format, return the video ID (match[2])
      // For other formats, return match[1]
      return match[2] || match[1];
    }
  }
  return null;
};

// Instagram utility functions
const isInstagramUrl = (url: string): boolean => {
  if (!url) return false;
  const instagramRegex = /^(https?:\/\/)?(www\.)?(instagram\.com)\/(p|reel|tv)\/[^\/\s]+/i;
  return instagramRegex.test(url);
};

const extractInstagramShortcode = (url: string): string | null => {
  if (!url) return null;
  
  const patterns = [
    // Standard Instagram post URL: https://www.instagram.com/p/ABC123/
    /instagram\.com\/p\/([a-zA-Z0-9_-]+)/,
    // Instagram reel URL: https://www.instagram.com/reel/ABC123/
    /instagram\.com\/reel\/([a-zA-Z0-9_-]+)/,
    // Instagram TV URL: https://www.instagram.com/tv/ABC123/
    /instagram\.com\/tv\/([a-zA-Z0-9_-]+)/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
};

// Google Video Link Component
const GoogleVideoLink = memo(function GoogleVideoLinkComponent({ 
  linkId, 
  title = "Video"
}: { 
  linkId: string; 
  title?: string;
}) {
  // Extract video information from linkId if possible
  const parts = linkId.split('_');
  const searchId = parts[2];
  const query = parts[3];
  const videoIndex = parts[4];
  
  return (
    <div className="my-4 p-4 bg-[var(--accent)] rounded-lg border border-[var(--subtle-divider)]">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-red-500 rounded-lg flex items-center justify-center flex-shrink-0">
          <Play size={20} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-[var(--foreground)] truncate">
            {title}
          </h3>
          <p className="text-sm text-[var(--muted)] truncate">
            Google Video Search Result
          </p>
          <p className="text-xs text-[var(--muted)] mt-1 font-mono">
            ID: {linkId}
          </p>
        </div>
        <div className="flex-shrink-0">
          <button 
            className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-sm rounded-md transition-colors flex items-center gap-1.5"
            onClick={() => {
              // Try to find the actual video URL from the MultiSearch component
              // This would need to be connected to the video data from the search results
              console.log('Google Video link clicked:', linkId);
              // For now, we'll show an alert - this should be connected to the actual video data
              alert(`Video link clicked: ${linkId}\n\nThis would open the video in a new tab or modal.`);
            }}
          >
            <Play size={14} />
            Watch
          </button>
        </div>
      </div>
    </div>
  );
});

// YouTube Embed Player Component
export const YouTubeEmbed = memo(function YouTubeEmbedComponent({ 
  videoId, 
  title = "YouTube video",
  originalUrl,
  isShorts = false,
  isMobile = false
}: { 
  videoId: string; 
  title?: string; 
  originalUrl?: string;
  isShorts?: boolean;
  isMobile?: boolean;
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  
  // For Shorts, use the shorts embed URL
  const embedUrl = isShorts 
    ? `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`
    : `https://www.youtube.com/embed/${videoId}`;
  
  const videoMaxWidth = '400px';
  
  return (
    <div 
      className={`my-6 w-full ${isShorts ? 'flex justify-center' : ''}`}
      style={{ maxWidth: videoMaxWidth }}
    >
      <div 
        className="relative bg-black rounded-lg overflow-hidden shadow-lg w-full"
        style={{ 
          aspectRatio: isShorts ? '9/16' : '16/9'
        }}
      >
        {/* Loading state */}
        {isLoading && !hasError && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500 mx-auto mb-2"></div>
              <p className="text-white text-sm">Loading {isShorts ? 'short' : 'video'}...</p>
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
              <p className="text-white text-sm mb-2">{isShorts ? 'Short' : 'Video'} failed to load</p>
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
      
      {/* Video info - hidden for Shorts to avoid duplication */}
      {!isShorts && (
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
      )}
    </div>
  );
});

// TikTok Embed Player Component with fallback to LinkPreview
export const TikTokEmbed = memo(function TikTokEmbedComponent({ 
  videoId, 
  title = "TikTok video",
  originalUrl,
  isMobile = false
}: { 
  videoId: string; 
  title?: string; 
  originalUrl?: string;
  isMobile?: boolean;
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [useFallback, setUseFallback] = useState(false);
  
  
  const embedUrl = `https://www.tiktok.com/embed/${videoId}`;
  
  // If error occurs, fallback to LinkPreview
  if (useFallback && originalUrl) {
    return (
      <div className="my-4">
        <LinkPreview url={originalUrl} />
      </div>
    );
  }
  
  const videoMaxWidth = '400px';
  
  return (
    <div 
      className="my-6 w-full flex justify-center"
      style={{ maxWidth: videoMaxWidth }}
    >
      <div 
        className="relative bg-black rounded-lg overflow-hidden shadow-lg w-full"
        style={{ 
          aspectRatio: '9/16'
        }}
      >
        {/* Loading state */}
        {isLoading && !hasError && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500 mx-auto mb-2"></div>
              <p className="text-white text-sm">Loading TikTok...</p>
            </div>
          </div>
        )}
        
        {/* Error state */}
        {hasError && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
            <div className="text-center p-4">
              <div className="w-12 h-12 mx-auto mb-2 bg-pink-500 rounded-full flex items-center justify-center">
                <X size={24} className="text-white" />
              </div>
              <p className="text-white text-sm mb-2">TikTok failed to load</p>
              <p className="text-white text-xs mb-3 opacity-75">Falling back to link preview...</p>
              {originalUrl && (
                <button
                  onClick={() => setUseFallback(true)}
                  className="text-pink-400 hover:text-pink-300 text-xs underline mb-2 block"
                >
                  Show as link preview
                </button>
              )}
              {originalUrl && (
                <a
                  href={originalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-pink-400 hover:text-pink-300 text-xs underline"
                >
                  Open on TikTok
                </a>
              )}
            </div>
          </div>
        )}
        
        {/* TikTok iframe */}
        <iframe
          src={embedUrl}
          title={title}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="absolute inset-0 w-full h-full"
          onLoad={() => setIsLoading(false)}
          onError={() => {
            console.warn('TikTok embed failed, falling back to LinkPreview');
            setHasError(true);
            setIsLoading(false);
            // Auto-fallback after 3 seconds
            setTimeout(() => {
              if (originalUrl) {
                setUseFallback(true);
              }
            }, 3000);
          }}
        />
      </div>
      
      {/* Video info - hidden for TikTok to avoid duplication */}
      {/* TikTok info is already embedded in the iframe, so we hide the external info */}
    </div>
  );
});

// Instagram Embed Component with fallback to LinkPreview
export const InstagramEmbed = memo(function InstagramEmbedComponent({ 
  shortcode, 
  title = "Instagram post",
  originalUrl 
}: { 
  shortcode: string; 
  title?: string; 
  originalUrl?: string;
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [useFallback, setUseFallback] = useState(false);
  
  // Determine the embed URL based on the original URL
  let embedUrl = '';
  if (originalUrl) {
    if (originalUrl.includes('/p/')) {
      embedUrl = `https://www.instagram.com/p/${shortcode}/embed/`;
    } else if (originalUrl.includes('/reel/')) {
      embedUrl = `https://www.instagram.com/reel/${shortcode}/embed/`;
    } else if (originalUrl.includes('/tv/')) {
      embedUrl = `https://www.instagram.com/tv/${shortcode}/embed/`;
    } else {
      // Default to post format
      embedUrl = `https://www.instagram.com/p/${shortcode}/embed/`;
    }
  }
  
  // If error occurs, fallback to LinkPreview
  if (useFallback && originalUrl) {
    return (
      <div className="my-4">
        <LinkPreview url={originalUrl} />
      </div>
    );
  }
  
  return (
    <div className="my-6 w-full flex justify-center">
      <div 
        className="relative bg-black rounded-lg overflow-hidden shadow-lg max-w-[400px] w-full"
        style={{ 
          aspectRatio: '9/16',
          maxWidth: 'min(400px, 90vw)',
          width: 'min(400px, 90vw)'
        }}
      >
        {/* Loading state */}
        {isLoading && !hasError && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500 mx-auto mb-2"></div>
              <p className="text-white text-sm">Loading Instagram...</p>
            </div>
          </div>
        )}
        
        {/* Error state */}
        {hasError && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
            <div className="text-center p-4">
              <div className="w-12 h-12 mx-auto mb-2 bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 rounded-full flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
              </div>
              <p className="text-white text-sm mb-2">Instagram failed to load</p>
              <p className="text-white text-xs mb-3 opacity-75">Falling back to link preview...</p>
              {originalUrl && (
                <button
                  onClick={() => setUseFallback(true)}
                  className="text-pink-400 hover:text-pink-300 text-xs underline mb-2 block"
                >
                  Show as link preview
                </button>
              )}
              {originalUrl && (
                <a
                  href={originalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-pink-400 hover:text-pink-300 text-xs underline"
                >
                  Open on Instagram
                </a>
              )}
            </div>
          </div>
        )}
        
        {/* Instagram iframe */}
        {embedUrl && (
          <iframe
            src={embedUrl}
            title={title}
            frameBorder="0"
            allow="encrypted-media"
            allowFullScreen
            className="absolute inset-0 w-full h-full"
            onLoad={() => setIsLoading(false)}
            onError={() => {
              console.warn('Instagram embed failed, falling back to LinkPreview');
              setHasError(true);
              setIsLoading(false);
              // Auto-fallback after 3 seconds
              setTimeout(() => {
                if (originalUrl) {
                  setUseFallback(true);
                }
              }, 3000);
            }}
          />
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
  
  // LaTeX 렌더링 비활성화 - 원본 텍스트로 표시
  return (
    <div 
      className="math-block-wrapper my-6" 
      key={id}
      // Use flex layout and isolation for better rendering stability
      style={{ 
        isolation: 'isolate' // Create a new stacking context
      }}
    >
      {/* <MathJaxEquation equation={content} display={true} /> */}
      <pre className="font-mono text-sm whitespace-pre-wrap">{content}</pre>
    </div>
  );
};

// Simpler math component for inline math
const InlineMath = ({ content }: { content: string }) => {
  // Create a more stable ID that doesn't change across renders
  const id = useMemo(() => `math-inline-${content.slice(0, 10).replace(/\W/g, '')}-${Math.random().toString(36).slice(2, 6)}`, [content]);
  
  // LaTeX 렌더링 비활성화 - 원본 텍스트로 표시
  return (
    <span 
      className="math-inline-wrapper"
      key={id}
      style={{ isolation: 'isolate' }} // Create a new stacking context
    >
      {/* <MathJaxEquation equation={content} display={false} /> */}
      <code className="font-mono text-sm">${content}$</code>
    </span>
  );
};


// Memoize the MarkdownContent component to prevent unnecessary re-renders
// Direct Video File Player Component (supports URL refresh)
// 🚀 ChatGPT STYLE: max-width 제한 + aspect-ratio CSS로 정확한 비율 유지 (Virtuoso 스크롤 최적화)
export const DirectVideoEmbed = memo(function DirectVideoEmbedComponent({ 
  url,
  aspectRatio,
  messageId,
  chatId,
  userId,
  isMobile = false,
  maxWidth,
  prompt,
  sourceImageUrl,
  onSourceImageClick
}: { 
  url: string;
  aspectRatio?: string;
  messageId?: string;
  chatId?: string;
  userId?: string;
  isMobile?: boolean;
  maxWidth?: string;
  prompt?: string;
  sourceImageUrl?: string;
  onSourceImageClick?: (imageUrl: string) => void;
}) {
  // 🚀 INSTANT LOAD: 화면 근처(200px)에서 비디오 로드 시작 - 초기 로딩 최대화
  const { ref: lazyRef, shouldLoad } = useLazyMedia();
  
  const { refreshedUrl, isRefreshing } = useUrlRefresh({
    url,
    messageId,
    chatId,
    userId,
    // 🚀 LAZY LOADING: shouldLoad가 true일 때만 URL refresh 수행
    enabled: shouldLoad
  });

  // sourceImageUrl도 자동 갱신
  const { refreshedUrl: refreshedSourceImageUrl } = useUrlRefresh({
    url: sourceImageUrl || '',
    messageId,
    chatId,
    userId,
    enabled: shouldLoad && !!sourceImageUrl
  });

  // 🚀 VENICE: 비율 상태 제거 - 고정 컨테이너 사용
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Custom Controls State
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true); // Default to muted
  const [volume, setVolume] = useState(0); // 0-1, starts at 0 when muted
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isLooping, setIsLooping] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Prompt 오버레이 상태
  const [showPromptOverlay, setShowPromptOverlay] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Save 상태
  const [savingVideo, setSavingVideo] = useState(false);
  const [savedVideo, setSavedVideo] = useState(false);
  
  // Mount state for portal
  const [isMounted, setIsMounted] = useState(false);
  
  // Mobile: tap-to-show controls (no hover on touch devices)
  const [controlsVisible, setControlsVisible] = useState(false);
  
  // Touch device detection (fallback when isMobile prop is false, e.g. tablet/landscape)
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  
  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  // Detect touch device on mount; show controls by default on touch so buttons are visible without a tap
  useEffect(() => {
    const touch = typeof window !== 'undefined' && ('ontouchstart' in window || (navigator.maxTouchPoints != null && navigator.maxTouchPoints > 0));
    const coarse = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
    const isTouch = !!touch || !!coarse;
    setIsTouchDevice(isTouch);
    if (isTouch) setControlsVisible(true);
  }, []);

  // 🚀 근본적 해결: URL에서 크기 정보 먼저 추출, 없으면 메타데이터로 빠른 측정
  // 측정된 비율은 initialVideoAspectRatio에 저장되어 컨테이너 크기가 한 번만 설정됨
  const [initialVideoAspectRatio, setInitialVideoAspectRatio] = useState<number | null>(() => {
    if (!refreshedUrl) return null;
    const dimensions = parseMediaDimensions(refreshedUrl);
    return dimensions ? dimensions.width / dimensions.height : null;
  });
  const preloadVideoRef = useRef<HTMLVideoElement | null>(null);

  // 🚀 URL에서 크기 정보를 못 찾았으면 메타데이터로 빠르게 측정
  // 측정된 비율은 initialVideoAspectRatio에 저장되어 컨테이너 크기가 변경되지 않음
  useEffect(() => {
    if (shouldLoad && refreshedUrl && !initialVideoAspectRatio) {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;
      video.src = refreshedUrl;
      
      video.onloadedmetadata = () => {
        const videoWidth = video.videoWidth;
        const videoHeight = video.videoHeight;
        if (videoWidth > 0 && videoHeight > 0) {
          setInitialVideoAspectRatio(videoWidth / videoHeight);
        }
        video.src = '';
        video.load();
        preloadVideoRef.current = null;
      };
      
      video.onerror = () => {
        video.src = '';
        video.load();
        preloadVideoRef.current = null;
      };
      
      preloadVideoRef.current = video;
      
      return () => {
        if (preloadVideoRef.current) {
          preloadVideoRef.current.src = '';
          preloadVideoRef.current.load();
          preloadVideoRef.current = null;
        }
      };
    }
  }, [shouldLoad, refreshedUrl, initialVideoAspectRatio]);

  // 비디오 메타데이터 로드 시 실제 비율 계산 (fallback)
  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      setIsVideoLoaded(true);
      setDuration(video.duration);
      // initialVideoAspectRatio가 아직 설정되지 않았으면 최종 확인
      if (video.videoWidth > 0 && video.videoHeight > 0 && !initialVideoAspectRatio) {
        setInitialVideoAspectRatio(video.videoWidth / video.videoHeight);
      }
    }
  }, [initialVideoAspectRatio]);

  // 전체화면 상태 감지
  useEffect(() => {
    const handleFullscreenChange = () => {
      const fullscreenElement = document.fullscreenElement;
      const isCurrentlyFullscreen = !!fullscreenElement;
      // Check if our container or video is in fullscreen
      const container = containerRef.current;
      const video = videoRef.current;
      let isOurElementFullscreen = false;
      if (isCurrentlyFullscreen && fullscreenElement) {
        isOurElementFullscreen = 
          fullscreenElement === container || 
          fullscreenElement === video ||
          (container !== null && container.contains(fullscreenElement as Node));
      }
      setIsFullscreen(isOurElementFullscreen);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Body scroll lock when prompt overlay is open; restore on close so chat scroll works again (fixes mobile)
  useEffect(() => {
    if (!showPromptOverlay) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [showPromptOverlay]);

  const handleVideoClick = useCallback(async (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;

    // Mobile/touch: 컨트롤 표시와 동시에 재생 (배포 환경에서 재생 문제 해결)
    if (isMobile || isTouchDevice) {
      if (!controlsVisible) {
        setControlsVisible(true);
      }
      // 컨트롤 표시와 관계없이 즉시 재생 시도
      if (video.paused) {
        try {
          await video.play();
          setIsPlaying(true);
        } catch (error) {
          console.error('Video play failed:', error);
          // 재생 실패 시에도 컨트롤은 표시됨
        }
      } else {
        video.pause();
        setIsPlaying(false);
      }
      return;
    }

    // Desktop: 일반 재생/일시정지
    if (video.paused) {
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, [isMobile, isTouchDevice, controlsVisible]);

  const handleProgressBarClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video || !duration) return;

    // Get click position relative to progress bar
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickPercentage = (clickX / rect.width) * 100;
    
    // Calculate target time
    const targetTime = (clickPercentage / 100) * duration;
    
    // Seek to target time
    video.currentTime = Math.max(0, Math.min(targetTime, duration));
    
    // If video is paused, play it
    if (video.paused) {
      video.play();
      setIsPlaying(true);
    }
  }, [duration]);

  const togglePlay = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;

    // Mobile/touch: 컨트롤 표시와 동시에 재생 (배포 환경에서 재생 문제 해결)
    if (isMobile || isTouchDevice) {
      if (!controlsVisible) {
        setControlsVisible(true);
      }
      // 컨트롤 표시와 관계없이 즉시 재생 시도
      if (video.paused) {
        try {
          await video.play();
          setIsPlaying(true);
        } catch (error) {
          console.error('Video play failed:', error);
          // 재생 실패 시에도 컨트롤은 표시됨
        }
      } else {
        video.pause();
        setIsPlaying(false);
      }
      return;
    }

    // Desktop: 일반 재생/일시정지
    if (video.paused) {
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, [isMobile, isTouchDevice, controlsVisible]);

  const toggleMute = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;

    if (isMuted) {
      // Unmute: restore to previous volume or default 0.5
      const newVolume = volume > 0 ? volume : 0.5;
      video.muted = false;
      video.volume = newVolume;
      setVolume(newVolume);
      setIsMuted(false);
    } else {
      // Mute
      video.muted = true;
      setIsMuted(true);
    }
  }, [isMuted, volume]);

  const setVolumeValue = useCallback((newVolume: number) => {
    const video = videoRef.current;
    if (!video) return;

    video.volume = newVolume;
    setVolume(newVolume);
    
    if (newVolume === 0) {
      video.muted = true;
      setIsMuted(true);
    } else {
      video.muted = false;
      setIsMuted(false);
    }
  }, []);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const newVolume = parseFloat(e.target.value);
    setVolumeValue(newVolume);
  }, [setVolumeValue]);

  const toggleLoop = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;

    video.loop = !video.loop;
    setIsLooping(video.loop);
  }, []);

  const handleDownload = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!refreshedUrl) return;
    
    try {
      const response = await fetch(refreshedUrl);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = 'video.mp4';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      // Fallback: open in new tab
      window.open(refreshedUrl, '_blank');
    }
  }, [refreshedUrl]);

  const toggleFullScreen = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const container = containerRef.current;
    const video = videoRef.current;
    if (!container || !video) return;

    // iOS Safari: use webkitEnterFullscreen on video element (requestFullscreen doesn't work on iOS)
    if (typeof (video as any).webkitEnterFullscreen === 'function') {
      try {
        (video as any).webkitEnterFullscreen();
      } catch (err) {
        console.error('Error entering iOS fullscreen:', err);
      }
      return;
    }

    // Standard Fullscreen API for other browsers
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(err => {
        console.error('Error exiting fullscreen:', err);
      });
    } else {
      // Use container element for fullscreen (works better in modals)
      container.requestFullscreen().catch(err => {
        console.error('Error entering fullscreen:', err);
        // Fallback: try video element if container fails
        video.requestFullscreen().catch(err2 => {
          console.error('Error entering fullscreen (fallback):', err2);
        });
      });
    }
  }, []);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
    }
  }, []);

  // Prompt 복사 핸들러
  const handleCopyPrompt = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!prompt) return;
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (error) {
      console.error('Copy failed:', error);
    }
  }, [prompt]);

  // Save to Gallery 핸들러
  const handleSave = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (savingVideo || savedVideo || !refreshedUrl) return;
    setSavingVideo(true);
    try {
      const response = await fetch('/api/photo/save-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          videoUrl: refreshedUrl,
          prompt: prompt || null,
          ai_prompt: null,
          ai_json_prompt: null,
          chatId: chatId || null,
          messageId: messageId || null,
          metadata: {
            sourceImageUrl: sourceImageUrl || null
          }
        })
      });
      if (response.ok) {
        setSavedVideo(true);
        setTimeout(() => {
          setSavedVideo(false);
        }, 2000);
      } else {
        const error = await response.json();
        console.error('Save failed:', error);
      }
    } catch (error) {
      console.error('Save error:', error);
    } finally {
      setSavingVideo(false);
    }
  }, [refreshedUrl, prompt, sourceImageUrl, chatId, messageId, savingVideo, savedVideo]);

  // Format time helper
  const formatTime = (time: number) => {
    if (!time || isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // 🚀 근본적 해결: 컨테이너 크기를 초기에 한 번만 설정하고 절대 변경하지 않음
  // initialVideoAspectRatio만 사용하여 레이아웃 시프트 완전 방지
  const containerStyle: React.CSSProperties = useMemo(() => {
    if (isFullscreen) {
      return {
        width: '100vw',
        height: '100vh',
        maxWidth: 'none',
        aspectRatio: 'unset',
      };
    }
    const baseStyle: React.CSSProperties = {
      // maxWidth는 CSS 클래스(.message-media-max-width)에 의존하므로 인라인 스타일에서 제거
      width: '100%',
      backgroundColor: 'black',
      height: 'auto',
    };
    
    // 초기 비율만 사용 (비디오 로드 후에도 변경되지 않음)
    // URL에서 추출한 비율이 있으면 사용, 없으면 안정적인 기본값(16:9)으로 고정
    const finalAspectRatio = initialVideoAspectRatio || 16/9;
    baseStyle.aspectRatio = `${finalAspectRatio}`;
    
    return baseStyle;
  }, [isFullscreen, initialVideoAspectRatio]);

  return (
    <div 
      ref={lazyRef}
      className={`generated-video-container message-media-max-width my-1 group relative ${showPromptOverlay ? 'cursor-default' : 'cursor-pointer'}`}
      style={{
        ...containerStyle,
        // GPU 가속으로 레이아웃 변경 성능 향상
        transform: 'translateZ(0)',
        // 레이아웃 격리로 부모에 영향 최소화
        isolation: 'isolate',
      }}
    >
      {/* 🚀 VENICE: Skeleton while loading */}
      {!isVideoLoaded && (
        <div className="absolute inset-0 skeleton-shimmer rounded-2xl" />
      )}
      
      {/* 🚀 비디오가 컨테이너를 꽉 채우도록 표시 */}
      <div 
        ref={containerRef}
        className={`relative w-full h-full overflow-hidden bg-black transition-opacity duration-300 ${isFullscreen ? 'rounded-none' : 'rounded-2xl'} ${showPromptOverlay ? 'cursor-default opacity-0 pointer-events-none' : 'opacity-100'}`}
        onClick={showPromptOverlay ? undefined : handleVideoClick}
      >
        <video 
          ref={videoRef}
          src={shouldLoad ? refreshedUrl : undefined}
          playsInline
          muted={isMuted}
          loop={isLooping}
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
          onEnded={handleEnded}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          className={`w-full h-full object-cover transition-opacity duration-200 ${isVideoLoaded ? 'opacity-100' : 'opacity-0'}`}
          style={{
            objectFit: 'cover',
            width: '100%',
            height: '100%',
          }}
          preload="metadata"
          onContextMenu={(e) => {
            // Sync loop state when user changes via right-click context menu
            setTimeout(() => {
              const video = videoRef.current;
              if (video) {
                setIsLooping(video.loop);
              }
            }, 100);
          }}
        >
          Your browser does not support the video tag.
        </video>
        
        {/* Custom Overlays */}
        
        {/* Center Play Button - Visible when paused */}
        {!isPlaying && !isRefreshing && (
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-auto" onClick={togglePlay}>
            <div className="w-16 h-16 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white transition-all hover:scale-105 hover:bg-black/50">
              <Play size={32} fill="white" className="ml-1 opacity-95" />
            </div>
          </div>
        )}

        {/* Bottom Controls Overlay - visible on group-hover (desktop) or when controlsVisible (mobile tap); pointer-events match visibility so touches reach buttons on mobile */}
        <div className={`absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/80 via-black/40 to-transparent transition-opacity duration-300 z-20 ${controlsVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto'}`}>
          <div className={`absolute bottom-0 left-0 right-0 p-4 ${controlsVisible ? 'pointer-events-auto' : 'pointer-events-none group-hover:pointer-events-auto'}`}>
            {/* Progress Bar */}
            <div 
              className="group/progress relative w-full h-1.5 mb-4 bg-white/20 rounded-full cursor-pointer overflow-visible"
              onClick={handleProgressBarClick}
            >
              {/* Hover effect area */}
              <div className="absolute -inset-y-2 left-0 right-0" />
              
              {/* Background Track */}
              <div className="absolute inset-0 bg-white/20 rounded-full" />
              
              {/* Progress Fill */}
              <div 
                className="absolute inset-y-0 left-0 bg-white rounded-full transition-all duration-150"
                style={{ width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%' }}
              >
                {/* Knob */}
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg scale-0 group-hover/progress:scale-100 transition-transform" />
              </div>
            </div>

            {/* Controls Row */}
            <div className="flex items-center justify-between text-white">
              <div className="flex items-center gap-4">
                <button onClick={togglePlay} className="hover:scale-110 transition-transform">
                  {isPlaying ? <Pause size={20} fill="white" /> : <Play size={20} fill="white" />}
                </button>
                
                <div className="text-[13px] font-medium tracking-tight opacity-90">
                  {formatTime(currentTime)} / {formatTime(duration || 0)}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Volume Control with Horizontal Slider */}
                <div 
                  className="group/volume flex items-center"
                  onMouseEnter={() => setShowVolumeSlider(true)}
                  onMouseLeave={() => setShowVolumeSlider(false)}
                >
                  {/* Horizontal Volume Slider - appears on left */}
                  <div 
                    className={`overflow-hidden transition-all duration-200 flex items-center ${showVolumeSlider ? 'w-16 mr-1' : 'w-0'}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div 
                      className="relative w-16 h-1 bg-white/30 rounded-full cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        const rect = e.currentTarget.getBoundingClientRect();
                        const clickX = e.clientX - rect.left;
                        const clickPercentage = (clickX / rect.width) * 100;
                        const newVolume = Math.max(0, Math.min(clickPercentage / 100, 1));
                        setVolumeValue(newVolume);
                      }}
                    >
                      {/* Background Track */}
                      <div className="absolute inset-0 bg-white/30 rounded-full" />
                      
                      {/* Filled Progress */}
                      <div 
                        className="absolute inset-y-0 left-0 bg-white rounded-full transition-all duration-150"
                        style={{ width: `${(isMuted ? 0 : volume) * 100}%` }}
                      />
                    </div>
                  </div>
                  
                  <button onClick={toggleMute} className="hover:scale-110 transition-transform p-1">
                    {isMuted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
                  </button>
                </div>
                
                {/* Download Button */}
                <button onClick={handleDownload} className="hover:scale-110 transition-transform p-1 opacity-80 hover:opacity-100">
                  <Download size={18} />
                </button>

                {/* Prompt Button */}
                {prompt && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowPromptOverlay(true);
                    }}
                    className="hover:scale-110 transition-transform p-1 opacity-80 hover:opacity-100"
                    aria-label="Show prompt"
                  >
                    <ScrollText size={18} />
                  </button>
                )}

                {/* Save Button */}
                <button 
                  onClick={handleSave}
                  disabled={savingVideo || savedVideo}
                  className="hover:scale-110 transition-transform p-1 opacity-80 hover:opacity-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label={savingVideo ? 'Saving...' : savedVideo ? 'Saved' : 'Save to Gallery'}
                >
                  {savingVideo ? (
                    <div className="w-[18px] h-[18px] border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : savedVideo ? (
                    <Check size={18} />
                  ) : (
                    <Bookmark size={18} />
                  )}
                </button>

                {/* Loop Toggle */}
                <button 
                  onClick={toggleLoop} 
                  className={`hover:scale-110 transition-transform p-1 relative ${isLooping ? 'opacity-100' : 'opacity-80 hover:opacity-100'}`}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 2l4 4-4 4" />
                    <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
                    <path d="M7 22l-4-4 4-4" />
                    <path d="M21 13v1a4 4 0 0 1-4 4H3" />
                    {isLooping && (
                      <text x="12" y="14" textAnchor="middle" fontSize="8" fill="currentColor" stroke="none" fontWeight="bold">1</text>
                    )}
                  </svg>
                </button>
                
                {/* Fullscreen */}
                <button onClick={toggleFullScreen} className="hover:scale-110 transition-transform p-1 opacity-80 hover:opacity-100">
                  <Maximize size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
        
        {/* 🚀 로딩 중일 때만 placeholder 표시 */}
        {isRefreshing && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-20">
            <div className="w-8 h-8 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" />
          </div>
        )}

        {/* 프롬프트 오버레이 - 항상 마운트하되 가시성만 조절하여 즉각적인 반응성 확보 (채팅창 배경 노출 방지) */}
        {prompt && isMounted ? createPortal(
          <div 
            className={`fixed inset-0 z-[9999] text-white bg-black transition-all duration-200 ${showPromptOverlay ? 'opacity-100 pointer-events-auto visible' : 'opacity-0 pointer-events-none invisible'}`}
            style={{
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              width: '100vw',
              minWidth: '100vw',
              height: '100vh',
              minHeight: '100vh',
              overflow: 'hidden'
            }}
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            {/* 배경: 즉각적인 블랙 배경으로 채팅창 가림 */}
            <div 
              className="absolute inset-0 z-0 bg-black"
            />
            {/* Blurred background video; mobile: static frame with lighter blur for performance */}
            {showPromptOverlay && (
              <div 
                className="absolute z-0 overflow-hidden animate-in fade-in duration-500"
                style={{
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  width: '100vw',
                  minWidth: '100vw',
                  height: '100vh',
                  minHeight: '100vh'
                }}
              >
                <video
                  src={refreshedUrl}
                  className="absolute"
                  style={{
                    top: 0,
                    left: 0,
                    width: '100vw',
                    minWidth: '100vw',
                    height: '100vh',
                    minHeight: '100vh',
                    objectFit: 'cover',
                    // Mobile: lighter blur (10px) and no animation for smoother performance
                    filter: (isMobile || isTouchDevice) ? 'brightness(0.3) blur(10px)' : 'brightness(0.3) blur(20px)',
                    transform: 'scale(1.1)',
                    objectPosition: 'center',
                    willChange: 'transform'
                  }}
                  muted
                  loop
                  // Desktop: autoPlay for animated background; Mobile: static frame (no autoPlay) for performance
                  autoPlay={!(isMobile || isTouchDevice)}
                  playsInline
                />
              </div>
            )}

            {/* 콘텐츠 영역 - 부드러운 등장 효과 */}
            <div className={`relative w-full h-full flex flex-col justify-center items-center text-center z-20 p-6 ${showPromptOverlay ? 'animate-in fade-in zoom-in-95 duration-300' : ''}`}>
              {/* Done / close button - top right (desktop) / bottom right (mobile) */}
              <button
                className={`absolute ${isMobile ? 'bottom-6 right-4' : 'top-4 right-4'} z-30 w-12 h-12 rounded-full flex items-center justify-center cursor-pointer`}
                style={{
                  color: 'white',
                  backgroundColor: '#007AFF',
                  border: '1px solid #007AFF',
                  boxShadow:
                    '0 8px 40px rgba(0, 122, 255, 0.3), 0 4px 20px rgba(0, 122, 255, 0.2), 0 2px 8px rgba(0, 122, 255, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowPromptOverlay(false);
                }}
                aria-label="Close prompt overlay"
              >
                <Check size={18} />
              </button>

              {/* Prompt content */}
              <div className="flex flex-col items-center w-full flex-1 min-h-0">
                <div className="w-full flex justify-center flex-1 min-h-0 overflow-hidden pt-10 sm:pt-28 pb-22 sm:pb-28">
                  <div className="max-w-3xl w-full h-full overflow-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden px-2 flex flex-col items-start justify-start">
                    {/* 소스 이미지 썸네일 */}
                    {sourceImageUrl && (
                      <div className="mb-3 flex justify-center w-full">
                        <img
                          src={refreshedSourceImageUrl || sourceImageUrl}
                          alt="Source image"
                          className="max-w-[150px] max-h-[150px] object-contain rounded-lg"
                          style={{ maxWidth: '150px', maxHeight: '150px' }}
                        />
                      </div>
                    )}
                    
                    {/* 프롬프트 텍스트 */}
                    <div className="text-base md:text-lg font-medium leading-relaxed text-white w-full text-left py-8 whitespace-pre-wrap">
                      {prompt}
                    </div>
                  </div>
                </div>
              </div>

              {/* Copy button - center bottom */}
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopyPrompt(e);
                  }}
                  className="px-4 py-2.5 rounded-full text-white transition-colors cursor-pointer flex items-center gap-2"
                  style={getAdaptiveGlassStyleBlur()}
                  aria-label="Copy"
                >
                  {copied ? <Check size={18} /> : <Copy size={18} />}
                  <span className="text-sm font-medium">{copied ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        ) : null}
      </div>
    </div>
  );
});

function MarkdownContentComponent({ 
  content, 
  enableSegmentation = false,
  variant = 'default',
  searchTerm = null,
  isReasoningSection = false,
  messageType = 'default',
  thumbnailMap = {},
  titleMap = {},
  linkPreviewData = {},
  isMobile = false,
  noTail = false,
  isLongPressActive = false,
  isStreaming = false,
  messageId,
  chatId,
  userId,
  promptMap = {},
  sourceImageMap = {}
}: MarkdownContentProps) {

  // Image modal state
  const [selectedImage, setSelectedImage] = useState<{ src: string; alt: string; prompt?: string; sourceImageUrl?: string } | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  
  // Image gallery state
  const [imageGallery, setImageGallery] = useState<{ src: string; alt: string; prompt?: string; sourceImageUrl?: string }[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isGalleryMode, setIsGalleryMode] = useState(false);
  
  // Save image state
  const [savingImage, setSavingImage] = useState(false);
  const [savedImage, setSavedImage] = useState(false);
  
  // Mermaid modal state
  const [selectedMermaid, setSelectedMermaid] = useState<{ chart: string; title?: string } | null>(null);
  
  // Mobile UI visibility state (for Mermaid modal)
  const [showMobileUI, setShowMobileUI] = useState(false);
  
  // Mobile swipe state (for Mermaid modal)
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);
  
  // Mobile touch handlers (for Mermaid modal only - ImageModal handles its own touch handlers)
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isMobile) return;
    const touch = e.touches[0];
    setTouchStart({ x: touch.clientX, y: touch.clientY });
    setTouchEnd(null);
  }, [isMobile]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isMobile) return;
    const touch = e.touches[0];
    setTouchEnd({ x: touch.clientX, y: touch.clientY });
  }, [isMobile]);

  const handleTouchEnd = useCallback(() => {
    if (!isMobile) {
      setTouchStart(null);
      setTouchEnd(null);
      return;
    }
    if (!touchStart || !touchEnd) {
      setShowMobileUI(prev => !prev);
      setTouchStart(null);
      setTouchEnd(null);
      return;
    }
    setTouchStart(null);
    setTouchEnd(null);
  }, [isMobile, touchStart, touchEnd]);

  // Check if we're in browser environment for portal rendering
  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  // Image modal functions
  const openImageModal = useCallback((src: string | undefined, alt: string, allImages?: { src: string; alt: string; originalMatch?: string; prompt?: string }[], imageIndex?: number) => {
    if (src && typeof src === 'string') {
      console.log('Opening image modal:', { src, alt, allImages, imageIndex });
      
      // Extract prompt from promptMap, allImages, or alt
      let prompt: string | undefined;
      
      // 1. promptMap에서 먼저 찾기
      if (promptMap && promptMap[src]) {
        prompt = promptMap[src];
      }
      // 2. allImages에서 찾기
      else if (allImages && imageIndex !== undefined && imageIndex >= 0) {
        const imageData = allImages[imageIndex];
        prompt = imageData?.prompt;
      }
      // 3. alt가 긴 텍스트면 prompt로 사용 (하지만 "image" 같은 단순한 텍스트는 제외)
      if (!prompt && alt && alt.length > 20 && alt !== 'Image' && alt !== 'image' && !alt.startsWith('http')) {
        prompt = alt;
      }
      
      // Extract source image URL from sourceImageMap
      const sourceImageUrl = sourceImageMap && sourceImageMap[src] ? sourceImageMap[src] : undefined;
      
      setSelectedImage({ src, alt, prompt, sourceImageUrl });
      
      // If multiple images are provided, set up gallery mode
      if (allImages && allImages.length > 1) {
        console.log('Setting up gallery mode with', allImages.length, 'images');
        // Map allImages to include prompt from promptMap and sourceImageUrl from sourceImageMap
        const galleryImages = allImages.map(img => ({
          src: img.src,
          alt: img.alt,
          prompt: img.prompt || (promptMap && promptMap[img.src]) || undefined,
          sourceImageUrl: sourceImageMap && sourceImageMap[img.src] ? sourceImageMap[img.src] : undefined
        }));
        setImageGallery(galleryImages);
        setCurrentImageIndex(imageIndex || 0);
        setIsGalleryMode(true);
      } else {
        console.log('Single image mode');
        setImageGallery([]);
        setCurrentImageIndex(0);
        setIsGalleryMode(false);
      }
    }
  }, [promptMap, sourceImageMap]);

  const closeImageModal = useCallback(() => {
    setSelectedImage(null);
    setImageGallery([]);
    setCurrentImageIndex(0);
    setIsGalleryMode(false);
    setSavingImage(false); // Reset saving state
    setSavedImage(false); // Reset saved state
  }, []);

  // Mermaid modal functions
  const openMermaidModal = useCallback((chart: string, title?: string) => {
    console.log('Opening Mermaid modal:', { chart, title });
    setSelectedMermaid({ chart, title });
  }, []);

  const closeMermaidModal = useCallback(() => {
    setSelectedMermaid(null);
  }, []);

  // Gallery navigation functions
  const navigateToNextImage = useCallback(() => {
    if (imageGallery.length > 1) {
      const nextIndex = (currentImageIndex + 1) % imageGallery.length;
      console.log('Navigating to next image:', nextIndex, 'of', imageGallery.length);
      setCurrentImageIndex(nextIndex);
      setSelectedImage(imageGallery[nextIndex]);
    }
  }, [imageGallery, currentImageIndex]);

  const navigateToPreviousImage = useCallback(() => {
    if (imageGallery.length > 1) {
      const prevIndex = currentImageIndex === 0 ? imageGallery.length - 1 : currentImageIndex - 1;
      setCurrentImageIndex(prevIndex);
      setSelectedImage(imageGallery[prevIndex]);
    }
  }, [imageGallery, currentImageIndex]);
  
  const navigateImage = useCallback((direction: 'prev' | 'next') => {
    if (direction === 'next') {
      navigateToNextImage();
    } else {
      navigateToPreviousImage();
    }
  }, [navigateToNextImage, navigateToPreviousImage]);
  
  // 이미지를 ImageModalImage 형식으로 변환
  const galleryImages: ImageModalImage[] = useMemo(() => {
    return imageGallery.map(img => ({
      src: img.src,
      alt: img.alt,
      prompt: img.prompt,
      sourceImageUrl: img.sourceImageUrl
    }));
  }, [imageGallery]);
  
  // 저장 핸들러. ImageModal에서 { imageUrl, prompt?, sourceImageUrl?, originalSrc? } 페이로드로 호출.
  // prompt/sourceImageUrl은 refreshed URL과 map 키 불일치 시 전달값 우선, 없으면 map fallback.
  const handleSave = useCallback(async (payload: { imageUrl: string; prompt?: string | null; sourceImageUrl?: string | null; originalSrc?: string }) => {
    if (savingImage || savedImage) return;
    setSavingImage(true);
    try {
      const imageUrl = payload.imageUrl;
      const prompt = payload.prompt ?? promptMap[imageUrl] ?? null;
      const sourceImageUrl = payload.sourceImageUrl ?? sourceImageMap[imageUrl] ?? null;

      const response = await fetch('/api/photo/save-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl,
          prompt: prompt || null,
          ai_prompt: null,
          ai_json_prompt: null,
          chatId: chatId || null,
          messageId: messageId || null,
          metadata: {
            sourceImageUrl: sourceImageUrl || null
          }
        })
      });
      if (response.ok) {
        setSavedImage(true);
        setTimeout(() => {
          setSavedImage(false);
        }, 2000);
      } else {
        const error = await response.json();
        console.error('Save failed:', error);
      }
    } catch (error) {
      console.error('Save error:', error);
    } finally {
      setSavingImage(false);
    }
  }, [savingImage, savedImage, promptMap, sourceImageMap, chatId, messageId]);

  // Handle keyboard navigation for image modal and gallery
  useEffect(() => {
    if (!selectedImage && !isGalleryMode && !selectedMermaid) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedMermaid) {
          closeMermaidModal();
        } else {
          closeImageModal();
        }
      } else if (isGalleryMode && imageGallery.length > 1) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          navigateToPreviousImage();
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          navigateToNextImage();
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [selectedImage, isGalleryMode, imageGallery.length, selectedMermaid, navigateToNextImage, navigateToPreviousImage, closeImageModal, closeMermaidModal]);

  // Pre-process the content to handle LaTeX and escape currency dollar signs
  // LaTeX 렌더링 비활성화
  const processedContent = useMemo(() => {
    // return preprocessLaTeX(content);
    return content; // LaTeX 전처리 없이 원본 반환
  }, [content]);

  // Build message groups (arrays of segments). When segmentation is disabled, treat as a single group.
  const segments = useMemo(() => {
    if (!enableSegmentation) return [[processedContent]];
    return segmentContent(processedContent);
  }, [processedContent, enableSegmentation]);

  // Extract all images from content for gallery functionality
  const allImages = useMemo(() => {
    const images: { src: string; alt: string; originalMatch?: string; prompt?: string }[] = [];
    
    // Extract images from markdown image syntax (these are already processed from IMAGE_ID)
    const markdownImageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    let match;
    while ((match = markdownImageRegex.exec(processedContent)) !== null) {
      const [fullMatch, alt, src] = match;
      const prompt = promptMap[src] || undefined;
      images.push({ 
        src, 
        alt: alt || `Image ${images.length + 1}`,
        originalMatch: fullMatch,
        prompt
      });
    }
    
    // Extract Supabase storage image URLs (both custom domain and default domain)
    const supabaseImageRegex = /(https:\/\/[^\s/]+\/storage\/v1\/object\/(public\/gemini-images|sign\/generated-images)\/[^\s)]+)/g;
    while ((match = supabaseImageRegex.exec(processedContent)) !== null) {
      const src = match[1];
      // Avoid duplicates
      if (!images.find(img => img.src === src)) {
        const prompt = promptMap[src] || undefined;
        images.push({ 
          src, 
          alt: `Generated image ${images.length + 1}`,
          originalMatch: match[0],
          prompt
        });
      }
    }
    
    console.log('Extracted images for gallery:', images);
    return images;
  }, [processedContent, promptMap]);



  // Function to detect image URLs (from original code)
  const styleImageUrls = useCallback((text: string) => {
    return text;
  }, []);

  // Function to detect YouTube URLs in text (including Shorts)
  const styleYouTubeUrls = useCallback((text: string) => {
    if (!text.includes('youtube.com') && !text.includes('youtu.be')) return text;
    
    // Updated regex to include YouTube Shorts
    const youtubeUrlRegex = /(https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/|v\/)|youtu\.be\/|m\.youtube\.com\/(?:watch\?v=|shorts\/))[a-zA-Z0-9_-]{11}(?:\S*)?)/g;
    
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = youtubeUrlRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }
      
      const youtubeUrl = match[1];
      const videoId = extractYouTubeVideoId(youtubeUrl);
      const isShorts = isYouTubeShorts(youtubeUrl);
      
      if (videoId) {
        parts.push({
          type: 'youtube_link',
          key: match.index,
          url: youtubeUrl,
          videoId: videoId,
          isShorts: isShorts
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

  // Function to detect TikTok URLs in text
  const styleTikTokUrls = useCallback((text: string) => {
    if (!text.includes('tiktok.com') && !text.includes('vm.tiktok.com')) return text;
    
    const tiktokUrlRegex = /(https?:\/\/(?:www\.)?(?:tiktok\.com\/@[^\/]+\/video\/\d+|tiktok\.com\/.*\/video\/\d+|vm\.tiktok\.com\/[^\/\?\s]+)(?:\S*)?)/g;
    
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = tiktokUrlRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }
      
      const tiktokUrl = match[1];
      const videoId = extractTikTokVideoId(tiktokUrl);
      
      if (videoId) {
        parts.push({
          type: 'tiktok_link',
          key: match.index,
          url: tiktokUrl,
          videoId: videoId
        });
      } else {
        parts.push(tiktokUrl);
      }
      
      lastIndex = match.index + match[0].length;
    }
    
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }
    
    return parts.length > 0 ? parts : text;
  }, []);

  // Function to detect Instagram URLs in text
  const styleInstagramUrls = useCallback((text: string) => {
    if (!text.includes('instagram.com')) return text;
    
    const instagramUrlRegex = /(https?:\/\/(?:www\.)?instagram\.com\/(?:p|reel|tv)\/[a-zA-Z0-9_-]+(?:\S*)?)/g;
    
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = instagramUrlRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }
      
      const instagramUrl = match[1];
      const shortcode = extractInstagramShortcode(instagramUrl);
      
      if (shortcode) {
        parts.push({
          type: 'instagram_link',
          key: match.index,
          url: instagramUrl,
          shortcode: shortcode
        });
      } else {
        parts.push(instagramUrl);
      }
      
      lastIndex = match.index + match[0].length;
    }
    
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }
    
    return parts.length > 0 ? parts : text;
  }, []);


  // Function to detect Google Video link IDs in text
  const styleGoogleVideoLinks = useCallback((text: string) => {
    if (!text.includes('google_video_link_')) return text;
    
    const googleVideoLinkRegex = /(google_video_link_[a-zA-Z0-9_]+)/g;
    
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = googleVideoLinkRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }
      
      const linkId = match[1];
      parts.push({
        type: 'google_video_link',
        key: match.index,
        linkId: linkId
      });
      
      lastIndex = match.index + match[0].length;
    }
    
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }
    
    return parts.length > 0 ? parts : text;
  }, []);

  // Function to detect general URLs in text
  const styleGeneralUrls = useCallback((text: string) => {
    if (!text.includes('http://') && !text.includes('https://')) return text;
    
    // Exclude YouTube URLs (already handled) and image URLs (already handled)
    const generalUrlRegex = /(https?:\/\/[^\s"'<>]+)/g;
    
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = generalUrlRegex.exec(text)) !== null) {
      const url = match[1];
      
      // Skip if it's a YouTube URL, TikTok URL, Instagram URL, Twitter URL, or image URL (already handled)
      if (url.includes('youtube.com') || url.includes('youtu.be') || 
          url.includes('tiktok.com') || url.includes('vm.tiktok.com') ||
          url.includes('instagram.com') ||
          url.includes('twitter.com') || url.includes('x.com')) {
        continue;
      }
      
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }
      
      parts.push({
        type: 'general_link',
        key: match.index,
        url: url
      });
      
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
    
    pre: ({ children, ...props }: React.PropsWithChildren<ExtraProps>) => {
      return (
        <pre 
          className="whitespace-pre-wrap break-words overflow-x-auto max-w-full" 
          style={{ 
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            overflowWrap: 'break-word',
            maxWidth: '100%'
          }}
          {...props}
        >
          {children}
        </pre>
      );
    },
    
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
        // 🚀 FEATURE: Apply search term highlighting first
        const highlightedContent = highlightSearchTerm(children, searchTerm, { messageType });
        
        // Process for raw image URLs
        const processedImageContent = styleImageUrls(children);
        
      // Process for raw YouTube URLs
      const processedYouTubeContent = Array.isArray(processedImageContent) ? processedImageContent : styleYouTubeUrls(processedImageContent);
      
      // Process for TikTok URLs
      const processedTikTokContent = Array.isArray(processedYouTubeContent) ? processedYouTubeContent : styleTikTokUrls(processedYouTubeContent);
      
      // Process for Instagram URLs
      const processedInstagramContent = Array.isArray(processedTikTokContent) ? processedTikTokContent : styleInstagramUrls(processedTikTokContent);
      
      // Process for Google Video links
      const processedGoogleVideoContent = Array.isArray(processedInstagramContent) ? processedInstagramContent : styleGoogleVideoLinks(processedInstagramContent);
      
      // Process for general URLs
      const processedContent = Array.isArray(processedGoogleVideoContent) ? processedGoogleVideoContent : styleGeneralUrls(processedGoogleVideoContent);
        
        // Handle special links (images and YouTube)
        if (Array.isArray(processedContent)) {
          const elements = processedContent.map((part, index) => {
            if (typeof part === 'string') {
              // 🚀 FEATURE: Apply search term highlighting to text parts
                  const highlightedPart = highlightSearchTerm(part, searchTerm, { messageType });
                  return <span key={index}>
                    {highlightedPart}
                  </span>;
            } else if (part && typeof part === 'object' && 'type' in part) {
              if (part.type === 'image_link' && 'display' in part && 'url' in part) {
                // allImages에서 prompt 찾기
                const imageData = allImages.find(img => 
                  img.src === part.url ||
                  img.originalMatch === `![](${part.url})` ||
                  img.originalMatch === `![Generated image](${part.url})` ||
                  (img.originalMatch && img.originalMatch.includes(part.url))
                );
                const imagePrompt = imageData?.prompt;
                const imageSourceImageUrl = sourceImageMap && part.url ? sourceImageMap[part.url] : undefined;
                
                return (
                  <div key={part.key} className="my-4">
                    <ImageGalleryStack
                      images={[{
                        src: part.url,
                        alt: "Generated image",
                        prompt: imagePrompt,
                        sourceImageUrl: imageSourceImageUrl
                      }]}
                      onSingleImageClick={(imageSrc, imageAlt, allImagesArray, imageIndex) => {
                        // Find the image index by matching the URL or the original match
                        const foundIndex = allImages.findIndex(img => 
                          img.src === part.url ||
                          img.originalMatch === `![](${part.url})` ||
                          img.originalMatch === `![Generated image](${part.url})` ||
                          (img.originalMatch && img.originalMatch.includes(part.url))
                        );
                        console.log('Image click - found index:', foundIndex, 'for URL:', part.url);
                        openImageModal(part.url, "Generated image", allImages, foundIndex >= 0 ? foundIndex : 0);
                      }}
                      isMobile={isMobile}
                      chatId={chatId}
                      messageId={messageId}
                    />
                    <div className="text-xs text-[var(--muted)] mt-2 text-center break-all">
                      {part.display as string}
                    </div>
                  </div>
                );
              } else if (part.type === 'youtube_link' && 'videoId' in part && 'url' in part) {
                return (
                  <YouTubeEmbed 
                    key={part.key}
                    videoId={part.videoId as string} 
                    title="YouTube video" 
                    originalUrl={part.url}
                    isShorts={'isShorts' in part ? part.isShorts as boolean : false}
                    isMobile={isMobile}
                  />
                );
              } else if (part.type === 'tiktok_link' && 'videoId' in part && 'url' in part) {
                return (
                  <TikTokEmbed 
                    key={part.key}
                    videoId={part.videoId as string} 
                    title="TikTok video" 
                    originalUrl={part.url}
                    isMobile={isMobile}
                  />
                );
              } else if (part.type === 'instagram_link' && 'shortcode' in part && 'url' in part) {
                return (
                  <InstagramEmbed 
                    key={part.key}
                    shortcode={part.shortcode as string} 
                    title="Instagram post" 
                    originalUrl={part.url}
                  />
                );
              } else if (part.type === 'google_video_link' && 'linkId' in part) {
                return (
                  <GoogleVideoLink 
                    key={part.key}
                    linkId={part.linkId as string}
                    title="Video"
                  />
                );
                } else if (part.type === 'general_link' && 'url' in part) {
                  return (
                    <div key={part.key} className="my-0.5">
                      <LinkPreview url={part.url as string} />
                    </div>
                  );
                }
            }
            return null;
          });
          
          return <>{elements}</>;
        }
        
        // For regular text, just render
        return <p className="my-3 leading-relaxed break-words" {...props}>
          {highlightedContent}
        </p>;
      }
      
      // If children is not a string, apply highlighting to children
      return <p className="my-3 leading-relaxed break-words" {...props}>
        {highlightSearchTermInChildren(children, searchTerm, { messageType })}
      </p>;
    },
    img: ({ src, alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => {
      // 🚀 모든 이미지를 ImageGalleryStack으로 통일 렌더링
      // src가 문자열인지 확인
      if (!src || typeof src !== 'string') {
        return <span className="text-[var(--muted)]">[Unable to load image]</span>;
      }
      
      // allImages에서 prompt 찾기
      const imageData = allImages.find(img => 
        img.src === src ||
        img.originalMatch === `![](${src})` ||
        img.originalMatch === `![${alt || "Image"}](${src})` ||
        (img.originalMatch && img.originalMatch.includes(src))
      );
      const imagePrompt = imageData?.prompt;
      const imageSourceImageUrl = sourceImageMap ? sourceImageMap[src] : undefined;
      
      // ImageGalleryStack을 사용하여 단일 이미지도 렌더링
      return (
        <div 
          className="my-1"
          style={{
            background: 'transparent',
            padding: '0',
            border: 'none',
            boxShadow: 'none',
            overflow: 'visible',
            marginBottom: '8px'
          }}
        >
          <ImageGalleryStack
            images={[{
              src: src,
              alt: alt || "Image",
              prompt: imagePrompt,
              sourceImageUrl: imageSourceImageUrl
            }]}
            onSingleImageClick={(imageSrc, imageAlt, allImagesArray, imageIndex) => {
              const foundIndex = allImages.findIndex(img => 
                img.src === src ||
                img.originalMatch === `![](${src})` ||
                img.originalMatch === `![${alt || "Image"}](${src})` ||
                (img.originalMatch && img.originalMatch.includes(src))
              );
              openImageModal(src, alt || "Image", allImages, foundIndex >= 0 ? foundIndex : 0);
            }}
            isMobile={isMobile}
            chatId={chatId}
            messageId={messageId}
          />
        </div>
      );
    },
    a: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
      // Check if this URL has a thumbnail in the thumbnailMap
      const thumbnailUrl = href && thumbnailMap[href] ? thumbnailMap[href] : undefined;
      // Check if this URL has a title in the titleMap
      const searchApiTitle = href && titleMap[href] ? titleMap[href] : undefined;
      // Check if this is a YouTube link
      if (href && isYouTubeUrl(href)) {
        const videoId = extractYouTubeVideoId(href);
        const linkText = typeof children === 'string' ? children : extractText(children);
        const isShorts = isYouTubeShorts(href);
        
        if (videoId) {
          return (
            <YouTubeEmbed 
              videoId={videoId} 
              title={linkText || "YouTube video"} 
              originalUrl={href}
              isShorts={isShorts}
              isMobile={isMobile}
            />
          );
        }
      }

      // Check if this is a direct video link (mp4, webm, etc.)
      const isVideoFile = href && (
        href.toLowerCase().endsWith('.mp4') || 
        href.toLowerCase().endsWith('.webm') || 
        href.toLowerCase().endsWith('.mov') ||
        href.includes('generated-videos') // Supabase bucket name
      );

      if (href && isVideoFile) {
        // 🚀 이미지와 동일한 방식: parseMediaDimensions가 URL에서 크기 정보를 자동으로 파싱
        // aspectRatio prop은 선택적이며, URL에 크기 정보가 없을 때만 사용
        const videoPrompt = promptMap && href ? promptMap[href] : undefined;
        const videoSourceImageUrl = sourceImageMap && href ? sourceImageMap[href] : undefined;
        return (
          <DirectVideoEmbed 
            url={href} 
            messageId={messageId} 
            chatId={chatId} 
            userId={userId}
            isMobile={isMobile}
            prompt={videoPrompt}
            sourceImageUrl={videoSourceImageUrl}
          />
        );
      }

      // Check if this is a TikTok link
      if (href && isTikTokUrl(href)) {
        const videoId = extractTikTokVideoId(href);
        const linkText = typeof children === 'string' ? children : extractText(children);
        
        if (videoId) {
          return (
            <TikTokEmbed 
              videoId={videoId} 
              title={linkText || "TikTok video"} 
              originalUrl={href}
              isMobile={isMobile}
            />
          );
        }
      }

      // Check if this is a Twitter/X link
      if (href && isTwitterUrl(href)) {
        const tweetId = extractTwitterId(href);
        const linkText = typeof children === 'string' ? children : extractText(children);
        
        if (tweetId) {
          return (
            <TwitterEmbed 
              tweetId={tweetId} 
              originalUrl={href}
            />
          );
        }
      }

      // Check if this is an Instagram link
      if (href && isInstagramUrl(href)) {
        const shortcode = extractInstagramShortcode(href);
        const linkText = typeof children === 'string' ? children : extractText(children);
        
        if (shortcode) {
          return (
            <InstagramEmbed 
              shortcode={shortcode} 
              title={linkText || "Instagram post"} 
              originalUrl={href}
            />
          );
        }
      }
      
      // Check if this is a Supabase storage image link (Gemini images)
      // Support both default Supabase domain and custom domain (auth.chatflix.app)
      if (href && (
        href.includes('/storage/v1/object/public/gemini-images/') ||
        href.includes('/storage/v1/object/sign/generated-images/')
      )) {
        const linkText = typeof children === 'string' ? children : extractText(children);
        const imagePrompt = promptMap && href ? promptMap[href] : undefined;
        const imageSourceImageUrl = sourceImageMap && href ? sourceImageMap[href] : undefined;
        
        return (
          <div className="my-4">
            <ImageGalleryStack
              images={[{
                src: href,
                alt: linkText || "Generated image",
                prompt: imagePrompt,
                sourceImageUrl: imageSourceImageUrl
              }]}
              onSingleImageClick={(imageSrc, imageAlt, allImagesArray, imageIndex) => {
                const foundIndex = allImages.findIndex(img => 
                  img.src === href ||
                  img.originalMatch === `![](${href})` ||
                  img.originalMatch === `![${linkText || "Generated image"}](${href})` ||
                  (img.originalMatch && img.originalMatch.includes(href))
                );
                openImageModal(href, linkText || "Generated image", allImages, foundIndex >= 0 ? foundIndex : 0);
              }}
              isMobile={isMobile}
              chatId={chatId}
              messageId={messageId}
            />
          </div>
        );
      }
      
      // Regular link rendering with LinkPreview
      if (href && typeof href === 'string' && (href.startsWith('http://') || href.startsWith('https://'))) {
        return (
          <div className="my-0.5 w-full" style={{ 
            maxWidth: '400px',
            minWidth: '300px',
            width: '100%'
          }}>
            <LinkPreview url={href} thumbnailUrl={thumbnailUrl} searchApiTitle={searchApiTitle} prefetchedData={linkPreviewData?.[href]} />
          </div>
        );
      }
      
      // Fallback for non-http links
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
          // 인라인 코드를 일반 텍스트처럼 처리
          return (
            <span {...props}>
              {highlightSearchTermInChildren(children, searchTerm, { messageType })}
            </span>
          );
        }
      
      const language = match?.[1] || '';
      // Use the existing extractText utility which is designed to handle complex children structures.
      const codeText = extractText(children);
    
      // LaTeX 렌더링 비활성화 - math 코드 블록을 일반 코드 블록으로 처리
      // if (language === 'math') {
      //   const key = `math-code-${codeText.slice(0, 20).replace(/\W/g, '')}`;
      //   return (
      //     <div className="non-paragraph-wrapper" key={key}>
      //       <MathBlock content={codeText} />
      //     </div>
      //   );
      // }
      
      if (language === 'mermaid') {
        return <MermaidDiagram chart={codeText} onMermaidClick={openMermaidModal} title="Mermaid Diagram" isStreaming={isStreaming} />;
      }
      
      if (language === 'diff') {
        const lines = codeText.split('\n');
        
        // 실제 diff 형식인지 미리 판단
        const hasGitDiffMarkers = lines.some(line => {
          const trimmed = line.trim();
          return trimmed.startsWith('@@') || // hunk 헤더
                 trimmed.startsWith('+++') || // 새 파일
                 trimmed.startsWith('---') || // 기존 파일
                 trimmed.match(/^diff --git/); // git diff 헤더
        });
      
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
      
                  if (hasGitDiffMarkers) {
                    // 실제 git diff 형식일 때만 색상 처리
                    if (trimmedLine.startsWith('@@')) {
                      // Hunk 헤더
                      lineClass = 'bg-blue-500/10 text-blue-600 dark:text-blue-400';
                      lineStyle = {
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        fontWeight: 'bold'
                      };
                      prefix = '@@';
                    } else if (trimmedLine.startsWith('+')) {
                      // 추가된 줄
                      lineClass = 'bg-green-500/10 text-green-600 dark:text-green-400';
                      lineStyle = {
                        backgroundColor: 'rgba(34, 197, 94, 0.1)',
                        borderLeft: '3px solid rgb(34, 197, 94)'
                      };
                      prefix = '+';
                    } else if (trimmedLine.startsWith('-')) {
                      // 삭제된 줄
                      lineClass = 'bg-red-500/10 text-red-600 dark:text-red-400';
                      lineStyle = {
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        borderLeft: '3px solid rgb(239, 68, 68)'
                      };
                      prefix = '-';
                    } else if (trimmedLine.startsWith('+++') || trimmedLine.startsWith('---')) {
                      // 파일 헤더
                      lineClass = 'bg-gray-500/10 text-gray-600 dark:text-gray-400';
                      lineStyle = {
                        backgroundColor: 'rgba(107, 114, 128, 0.1)',
                        fontWeight: 'bold'
                      };
                      prefix = trimmedLine.startsWith('+++') ? '+++' : '---';
                    } else {
                      // 컨텍스트 줄
                      lineClass = 'text-[var(--code-text)]';
                      prefix = ' ';
                    }
                  } else {
                    // 실제 diff가 아닌 경우 - 모든 줄을 일반 텍스트로 처리
                    lineClass = 'text-[var(--code-text)]';
                    if (trimmedLine.startsWith('-')) {
                      prefix = '-'; // bullet point로 처리
                    } else if (trimmedLine.startsWith('+')) {
                      prefix = '+';
                    } else {
                      prefix = '';
                    }
                  }
      
                  // prefix 제거 (실제 diff가 아닌 경우는 제거하지 않음)
                  const displayLine = hasGitDiffMarkers && line.startsWith(prefix) 
                    ? line.slice(prefix.length) 
                    : line;
      
                  return (
                    <div
                      key={index}
                      className={`px-4 py-1 ${lineClass} flex items-start hover:bg-opacity-20 transition-colors`}
                      style={lineStyle}
                    >
                      <span className="inline-block w-4 text-center opacity-60 select-none mr-2 flex-shrink-0">
                        {hasGitDiffMarkers ? prefix : ''}
                      </span>
                      <span className="break-words min-w-0 flex-1 whitespace-pre-wrap">
                        {displayLine || ' '}
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
    table: ({ children, ...props }: React.PropsWithChildren<ExtraProps>) => {
      // Count columns to determine if we need mobile optimization
      const tableRef = useRef<HTMLTableElement>(null);
      const [isWideTable, setIsWideTable] = useState(false);

      useEffect(() => {
        if (tableRef.current) {
          const table = tableRef.current;
          const firstRow = table.querySelector('tr');
          const firstRowCells = firstRow ? firstRow.querySelectorAll('th, td').length : 0;
          
          // Consider it a wide table if it has more than 3 columns or if any cell content is long
          const hasLongContent = Array.from(table.querySelectorAll('td, th')).some(cell => 
            cell.textContent && cell.textContent.length > 20
          );
          
          setIsWideTable(firstRowCells > 3 || hasLongContent);
        }
      }, [children]);

      return (
        <div className="responsive-table-container my-4 max-w-full">
          <div className={`table-wrapper ${isWideTable ? 'wide-table' : ''}`}>
            <table 
              ref={tableRef}
              className="responsive-table border-collapse" 
              {...props}
            >
              {children}
            </table>
          </div>
        </div>
      );
    },
    th: ({ children, ...props }) => (
      <th className="table-header bg-[var(--accent)] font-medium text-[var(--muted)] uppercase tracking-wider p-2 sm:p-3 border border-[var(--accent)] text-left min-w-0" {...props}>
        <div className="break-words text-sm sm:text-base">
          {highlightSearchTermInChildren(children, searchTerm, { messageType })}
        </div>
      </th>
    ),
    td: ({ children, ...props }) => (
      <td className="table-cell p-2 sm:p-3 border border-[var(--accent)] min-w-0" {...props}>
        <div className="break-words text-sm sm:text-base">
          {highlightSearchTermInChildren(children, searchTerm, { messageType })}
        </div>
      </td>
    ),
    blockquote: ({ children, ...props }) => (
      <blockquote className="border-l-2 border-[var(--muted)] pl-4 my-6 text-[var(--muted)] italic" {...props}>
        {highlightSearchTermInChildren(children, searchTerm, { messageType })}
      </blockquote>
    ),
    ul: ({ children, ...props }) => {
      const ulRef = useRef<HTMLUListElement>(null);
      const [isNested, setIsNested] = useState(false);
      const [isSafari, setIsSafari] = useState(false);
      
      useEffect(() => {
        if (ulRef.current) {
          // Check if this ul is inside a li element
          const parentLi = ulRef.current.closest('li');
          setIsNested(!!parentLi);
        }
        
        // Detect Safari browser
        const ua = navigator.userAgent;
        const isSafariBrowser = /^((?!chrome|android).)*safari/i.test(ua);
        setIsSafari(isSafariBrowser);
      }, []);
      
      return (
        <ul
          ref={ulRef}
          className={`my-4 list-disc list-outside ${
            isNested ? 'pl-2' : isSafari ? 'pl-[1.3rem] md:pl-[1.4rem]' : 'pl-[1.3rem] md:pl-[0.9rem]'
          }`}
          {...props}
        >
          {children}
        </ul>
      );
    },
    ol: ({ children, ...props }) => {
      const olRef = useRef<HTMLOListElement>(null);
      const [isNested, setIsNested] = useState(false);
      const [isSafari, setIsSafari] = useState(false);
      
      useEffect(() => {
        if (olRef.current) {
          // Check if this ol is inside a li element
          const parentLi = olRef.current.closest('li');
          setIsNested(!!parentLi);
        }
        
        // Detect Safari browser
        const ua = navigator.userAgent;
        const isSafariBrowser = /^((?!chrome|android).)*safari/i.test(ua);
        setIsSafari(isSafariBrowser);
      }, []);
      
      return (
        <ol 
          ref={olRef}
          className={`my-4 list-decimal list-outside ${
            isNested ? 'pl-2' : isSafari ? 'pl-[1.5rem] md:pl-[1.6rem]' : 'pl-[1.5rem] md:pl-[1.1rem]'
          }`}
          {...props}
        >
          {children}
        </ol>
      );
    },
    li: ({ children, ...props }) => (
      <li className="my-0 break-words leading-tight" style={{ 
        listStylePosition: 'outside',
        paddingLeft: '0.25rem'
      }} {...props}>
        {highlightSearchTermInChildren(children, searchTerm, { messageType })}
        <style jsx>{`
          li ul, li ol {
            padding-left: 0.5rem !important;
          }
        `}</style>
      </li>
    ),
    h1: ({ children, ...props }) => (
      <h1 className="text-2xl md:text-base font-semibold tracking-tight break-words" {...props}>
        {highlightSearchTermInChildren(children, searchTerm, { messageType })}
      </h1>
    ),
    h2: ({ children, ...props }) => (
      <h2 className="text-2xl md:text-base font-semibold tracking-tight break-words" {...props}>
        {highlightSearchTermInChildren(children, searchTerm, { messageType })}
      </h2>
    ),
    h3: ({ children, ...props }) => (
      <h3 className="text-xl md:text-base font-semibold tracking-tight break-words" {...props}>
        {highlightSearchTermInChildren(children, searchTerm, { messageType })}
      </h3>
    ),
    strong: ({ children, ...props }) => (
      <strong className="text-lg md:text-base" {...props}>
        {highlightSearchTermInChildren(children, searchTerm, { messageType })}
      </strong>
    ),
    em: ({ children, ...props }) => (
      <em className="italic" {...props}>
        {highlightSearchTermInChildren(children, searchTerm, { messageType })}
      </em>
    ),
    b: ({ children, ...props }) => (
      <b className="font-bold" {...props}>
        {highlightSearchTermInChildren(children, searchTerm, { messageType })}
      </b>
    ),
    i: ({ children, ...props }) => (
      <i className="italic" {...props}>
        {highlightSearchTermInChildren(children, searchTerm, { messageType })}
      </i>
    ),
    // LaTeX 렌더링 비활성화 - math를 일반 텍스트로 표시
    // math: ({ value, inline }: MathProps) => {
    //   // For block math, use the dedicated wrapper component
    //   if (!inline) {
    //     return <MathBlock content={value} />;
    //   }
    //   
    //   // For inline math, use the simpler inline wrapper
    //   return <InlineMath content={value} />;
    // },
    math: ({ value, inline }: MathProps) => {
      // LaTeX 비활성화 - 원본 텍스트로 표시
      if (!inline) {
        return <pre className="font-mono text-sm whitespace-pre-wrap my-2">$${value}$$</pre>;
      }
      return <code className="font-mono text-sm">${value}$</code>;
    },
  }), [styleImageUrls, extractText, handleCopy, openImageModal, searchTerm, messageType]);

  // Memoize the remarkPlugins and rehypePlugins
  // singleTilde: false로 설정하여 단일 틸드(~)가 취소선으로 해석되지 않도록 함
  // 이는 "85~88달러" 같은 범위 표기에서 틸드가 취소선으로 잘못 해석되는 문제를 방지
  // LaTeX 렌더링 비활성화 - remarkMath 제거
  const remarkPlugins: any = useMemo(() => [[remarkGfm, { singleTilde: false }] /* , remarkMath */], []);
  
  // Updated rehypePlugins with proper configuration
  // LaTeX 렌더링 비활성화 - math, inlineMath passThrough 제거
  const rehypePlugins = useMemo(() => {
    return [
      // [rehypeRaw, { passThrough: ['math', 'inlineMath'] }],
      rehypeRaw,
      rehypeHighlight,
    ] as any;
  }, []);

  // Render grouped segments into separate bubbles
  return (
    <>
      {segments.map((segmentGroup, groupIndex) => {
        // Identify the last actual text bubble (exclude image/link-only segments)
        const imageRegex = /\[IMAGE_ID:|!\[.*\]\(.*\)/;
        const linkRegex = /\[.*\]\(https?:\/\/[^)]+\)|https?:\/\/[^\s"'<>]+/;
        let lastBubbleIndex = -1;
        for (let i = 0; i < segmentGroup.length; i++) {
          const s = segmentGroup[i];
          const isImg = imageRegex.test(s);
          const isLnk = linkRegex.test(s);
          if (!isImg && !isLnk) lastBubbleIndex = i;
        }

        // 🚀 Apple 스타일: 연속 이미지 그룹 계산
        // 연속된 이미지 그룹을 찾아서 시작 인덱스와 이미지 목록을 저장
        const consecutiveImageGroups: { startIndex: number; images: { src: string; alt: string; prompt?: string; sourceImageUrl?: string }[]; endIndex: number }[] = [];
        let currentGroup: { startIndex: number; images: { src: string; alt: string; prompt?: string; sourceImageUrl?: string }[]; endIndex: number } | null = null;
        
        segmentGroup.forEach((segment, index) => {
          const isImg = imageRegex.test(segment);
          
          if (isImg) {
            // 마크다운 이미지에서 URL 추출
            const markdownMatch = segment.match(/!\[([^\]]*)\]\(([^)]+)\)/);
            let imgSrc = '';
            let imgAlt = '';
            
            if (markdownMatch) {
              imgAlt = markdownMatch[1] || `Image ${index + 1}`;
              imgSrc = markdownMatch[2];
            }
            
            if (imgSrc) {
              // allImages에서 prompt 찾기
              const imageData = allImages.find(img => img.src === imgSrc);
              const imagePrompt = imageData?.prompt || promptMap[imgSrc];
              
              // sourceImageMap에서 sourceImageUrl 찾기
              const imageSourceImageUrl = sourceImageMap[imgSrc];
              
              const imageObj = {
                src: imgSrc,
                alt: imgAlt,
                prompt: imagePrompt,
                sourceImageUrl: imageSourceImageUrl
              };
              
              if (currentGroup === null) {
                currentGroup = { startIndex: index, images: [imageObj], endIndex: index };
              } else {
                currentGroup.images.push(imageObj);
                currentGroup.endIndex = index;
              }
            }
          } else {
            if (currentGroup !== null) {
              consecutiveImageGroups.push(currentGroup);
              currentGroup = null;
            }
          }
        });
        
        // 마지막 그룹 처리
        if (currentGroup !== null) {
          consecutiveImageGroups.push(currentGroup);
        }
        
        // 각 세그먼트가 어떤 이미지 그룹에 속하는지 확인하는 함수
        const getImageGroupForIndex = (index: number) => {
          return consecutiveImageGroups.find(
            group => index >= group.startIndex && index <= group.endIndex
          );
        };

        return (
          <div key={groupIndex} className={isReasoningSection ? '' : 'imessage-receive-bubble'}>
            <div className={`${isReasoningSection ? 'markdown-segments' : 'message-segments'}${noTail ? ' no-tail' : ''}`}>
              {segmentGroup.map((segment, index) => {
              // 이미지 세그먼트인지 확인
              const isImageSegment = /\[IMAGE_ID:|!\[.*\]\(.*\)/.test(segment);
              
              // 링크 세그먼트인지 확인 - 세그먼트 전체가 URL인 경우에만 true
              // (URL이 포함된 텍스트와 구분하기 위해 앵커 사용)
              const isLinkSegment = /^\s*(\[.*\]\(https?:\/\/[^)]+\)|https?:\/\/[^\s"'<>]+)\s*$/.test(segment);
              
              const processedSegment = segment;
              
              // 테이블 세그먼트인지 확인 (마크다운 표 패턴: 헤더 행 + 구분 행 존재)
              const isTableSegment = /(^|\n)\s*\|.*\|\s*(\n|$)/.test(segment) && /(^|\n)\s*\|?\s*[:\-]+\s*(\|\s*[:\-]+\s*)+\|?\s*(\n|$)/.test(segment);
              
              // 헤더 세그먼트인지 확인 (#, ##, ###)
              const isHeaderSegment = /^#{1,3}\s/.test(segment.trim());
              
              // h2 헤더 세그먼트인지 확인
              const isH2HeaderSegment = /^##\s/.test(segment.trim());
              
              // 🚀 Apple 스타일: 이미지 그룹 처리
              const imageGroup = getImageGroupForIndex(index);
              const isInImageGroup = imageGroup !== null && imageGroup !== undefined;
              const isFirstInImageGroup = isInImageGroup && imageGroup.startIndex === index;
              
              // 모든 이미지 그룹의 첫 번째가 아닌 경우 렌더링 스킵 (ImageGalleryStack이 그룹 전체를 렌더링)
              if (isImageSegment && isInImageGroup && !isFirstInImageGroup) {
                return null;
              }
              
              const nextIsHeader = index < segmentGroup.length - 1 && /^#{1,3}\s/.test(segmentGroup[index + 1].trim());

              const isLastBubble = !isImageSegment && !isLinkSegment && (index === lastBubbleIndex || nextIsHeader);
              
              // 🚀 Apple 스타일: 모든 이미지 그룹(1개 이상)은 ImageGalleryStack으로 렌더링
              if (isImageSegment && isInImageGroup && isFirstInImageGroup) {
                return (
                  <div 
                    key={index}
                    style={{
                      background: 'transparent',
                      padding: '0',
                      border: 'none',
                      boxShadow: 'none',
                      overflow: 'visible',
                      marginBottom: '8px'
                    }}
                  >
                    <ImageGalleryStack
                      images={imageGroup.images}
                      onSingleImageClick={openImageModal}
                      isMobile={isMobile}
                      chatId={chatId}
                      messageId={messageId}
                    />
                  </div>
                );
              }
              
              return (
                <div 
                  key={index} 
                  className={`${(isImageSegment || isLinkSegment) ? '' : `${variant === 'clean' ? 'markdown-segment' : 'message-segment'}${isLastBubble ? ' last-bubble' : ''}${isTableSegment ? ' table-segment' : ''}${isHeaderSegment ? ' contains-header' : ''}${isH2HeaderSegment ? ' contains-h2-header' : ''}${isLongPressActive && isLastBubble ? ' long-press-shadow' : ''}`}`}
                  style={{
                    ...(isTableSegment && {
                      background: 'transparent',
                      padding: 0,
                      border: 'none',
                      boxShadow: 'none'
                    }),
                    ...((isImageSegment || isLinkSegment) && {
                      background: 'transparent !important',
                      padding: '0',
                      border: 'none',
                      boxShadow: 'none',
                      pointerEvents: 'auto',
                      position: 'relative',
                      overflow: 'visible',
                      minWidth: 'fit-content',
                      width: 'auto'
                    }),
                    // 롱프레스 상태에서 세그먼트 그림자 효과 (noTail이 있어도 적용)
                    ...(isLongPressActive && !(isImageSegment || isLinkSegment) && {
                      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15), 0 4px 16px rgba(0, 0, 0, 0.1), 0 2px 8px rgba(0, 0, 0, 0.05)',
                      transform: 'translateY(-2px)',
                      transition: 'all 0.3s cubic-bezier(0.22, 1, 0.36, 1)'
                    })
                  }}
                >
                  {(isImageSegment || isLinkSegment) ? (
                    <ReactMarkdown
                      remarkPlugins={remarkPlugins}
                      rehypePlugins={rehypePlugins}
                      components={components}
                    >
                      {processedSegment}
                    </ReactMarkdown>
                  ) : (
                    <div className={`${isTableSegment ? 'table-segment-content' : 'message-content'} max-w-full overflow-x-auto break-words`}>
                      <ReactMarkdown
                        remarkPlugins={remarkPlugins}
                        rehypePlugins={rehypePlugins}
                        components={components}
                      >
                        {processedSegment}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        );
      })}

      {/* Image Modal */}
      <ImageModal
        isOpen={!!selectedImage}
        imageUrl={selectedImage?.src || ''}
        imageAlt={selectedImage?.alt}
        onClose={closeImageModal}
        gallery={isGalleryMode && galleryImages.length > 1 ? galleryImages : undefined}
        currentIndex={currentImageIndex}
        onNavigate={isGalleryMode && galleryImages.length > 1 ? navigateImage : undefined}
        prompt={selectedImage?.prompt}
        showPromptButton={!!selectedImage?.prompt}
        enableDownload={true}
        enableSave={true}
        enableUrlRefresh={true}
        messageId={messageId}
        chatId={chatId}
        userId={userId}
        isMobile={isMobile}
        isSaving={savingImage}
        isSaved={savedImage}
        onSave={handleSave}
        sourceImageUrl={selectedImage?.sourceImageUrl}
      />

      {/* Mermaid Modal */}
      {isMounted && selectedMermaid && createPortal(
        <div 
          className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center" 
          onClick={closeMermaidModal}
        >
          {/* Close button */}
          {(!isMobile || showMobileUI) && (
            <button 
              className="absolute top-4 right-4 bg-black/40 hover:bg-black/60 p-2 rounded-full text-white transition-colors z-10"
              onClick={closeMermaidModal}
              aria-label="Close diagram viewer"
            >
              <X size={24} />
            </button>
          )}
          
          {/* Main diagram container */}
          <div 
            className="relative flex items-center justify-center bg-transparent rounded-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{ 
              width: '100vw', 
              height: '100vh' 
            }}
          >
            <div className="relative group cursor-pointer flex flex-col items-center w-full h-full">
              <div className="relative w-full h-full flex items-center justify-center bg-[var(--background)]">
                <MermaidDiagram chart={selectedMermaid.chart} isModal={true} />
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

export const MarkdownContent = memo(MarkdownContentComponent);
