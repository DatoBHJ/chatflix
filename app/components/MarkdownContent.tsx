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
import { LinkPreview } from './LinkPreview';
import { highlightSearchTerm, highlightSearchTermInChildren } from '@/app/utils/searchHighlight';

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
  searchTerm?: string | null; // 🚀 FEATURE: Search term for highlighting
  isReasoningSection?: boolean; // ReasoningSection에서만 메시지 형식 완전 제거
  messageType?: 'user' | 'assistant' | 'default'; // 🚀 FEATURE: Message type for different highlight colors
  thumbnailMap?: { [key: string]: string }; // 🚀 FEATURE: Thumbnail map for link previews
  titleMap?: { [key: string]: string }; // 🚀 FEATURE: Title map for link previews
  isMobile?: boolean;
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
    if (!match.includes('[') && !match.includes(']') && !match.includes('<CODE_PLACEHOLDER_')) {
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
      
      // 현재 리스트 아이템의 들여쓰기 레벨 확인
      const currentIndentLevel = line.match(/^(\s*)/)?.[1]?.length || 0;
      
      let j = i;
      let groupContent: string[] = [];
      
      while (j < lines.length) {
        const currentLine = lines[j];
        const currentTrimmed = currentLine.trim();
        const lineIndentLevel = currentLine.match(/^(\s*)/)?.[1]?.length || 0;
        const isCurrentListItem = /^([-*+]\s(?:\[[ xX]\]\s)?|\d+\.\s)/.test(currentTrimmed);
        
        if (currentTrimmed === '') {
          // 빈 줄 다음에 리스트가 계속되는지 확인
          if (j + 1 < lines.length) {
            const nextLineTrimmed = lines[j+1].trim();
            const nextLineIndentLevel = lines[j+1].match(/^(\s*)/)?.[1]?.length || 0;
            const isNextLineListItem = /^([-*+]\s(?:\[[ xX]\]\s)?|\d+\.\s)/.test(nextLineTrimmed);
            
            // 같은 레벨의 리스트가 계속되면 빈 줄 포함
            if (isNextLineListItem && nextLineIndentLevel === currentIndentLevel) {
              groupContent.push(currentLine);
              j++;
              continue;
            }
          }
          break; // 리스트 그룹 종료
        }
        
        if (isCurrentListItem) {
          if (lineIndentLevel === currentIndentLevel) {
            // 같은 들여쓰기 레벨의 리스트 아이템은 그룹에 포함
            groupContent.push(currentLine);
          } else {
            // 다른 들여쓰기 레벨이면 그룹 종료
            break;
          }
        } else if (lineIndentLevel > currentIndentLevel) {
          // 더 깊은 들여쓰기의 내용은 현재 그룹에 포함
          groupContent.push(currentLine);
        } else {
          // 더 얕은 들여쓰기나 리스트가 아닌 내용이면 그룹 종료
          break;
        }
        
        j++;
      }
      
      if (groupContent.length > 0) {
        segments.push(groupContent.join('\n').trim());
      }
      i = j - 1; // 바깥 루프 인덱스 업데이트
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
  
  // pollination 이미지인지 확인
  const isPollinationImage = src && typeof src === 'string' && src.includes('image.pollinations.ai');
  
  // URL이 유효한지 확인 (간단한 체크)
  const isValidUrl = src && typeof src === 'string' && (
    src.startsWith('http://') || 
    src.startsWith('https://') || 
    src.startsWith('data:')
  );

  if (!isValidUrl) {
    return null;
  }

  // 일반 이미지가 에러나면 아무것도 렌더링하지 않음
  if (error && !isPollinationImage) {
    return null;
  }
  
  return (
    <div className="relative w-full">
      {!isLoaded && !error && (
        <div className="text-[var(--muted)] text-sm py-2">
          {isPollinationImage ? (
            // AI 이미지 생성용 완전 미니멀 로딩 UI
            <div className="bg-[var(--accent)] rounded-2xl p-6 border border-[color-mix(in_srgb,var(--foreground)_4%,transparent)]">
              <div className="flex flex-col items-center space-y-4">
                {/* 미니멀한 회전 애니메이션만 */}
                <div className="w-6 h-6 border border-[color-mix(in_srgb,var(--foreground)_20%,transparent)] border-t-[var(--foreground)] rounded-full animate-spin"></div>
                
                {/* 미니멀한 로딩 텍스트 */}
                <div className="text-center space-y-1">
                  <div className="text-[var(--foreground)] font-medium text-sm">
                    Creating image
                  </div>
                  <div className="text-[color-mix(in_srgb,var(--foreground)_60%,transparent)] text-xs">
                    This may take a moment
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // 일반 검색 이미지용 기존 로딩 UI
            <div className="typing-indicator-compact">
              <div className="typing-dot-compact"></div>
              <div className="typing-dot-compact"></div>
              <div className="typing-dot-compact"></div>
            </div>
          )}
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
      
      <div className="relative">
        <img
          src={src}
          alt={alt || ""}
          className={`${className} ${isLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-500 rounded-lg ${onImageClick ? 'cursor-pointer' : ''}`}
          onClick={onImageClick}
          onLoad={() => {
            setIsLoaded(true);
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
        
        {/* Generated image tag */}
        {isPollinationImage && isLoaded && !error && (
          <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-full font-medium">
            AI Generated
          </div>
        )}
      </div>
    </div>
  );
});

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
  isShorts = false
}: { 
  videoId: string; 
  title?: string; 
  originalUrl?: string;
  isShorts?: boolean;
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  
  // For Shorts, use the shorts embed URL
  const embedUrl = isShorts 
    ? `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`
    : `https://www.youtube.com/embed/${videoId}`;
  
  return (
    <div className={`my-6 w-full ${isShorts ? 'flex justify-center' : ''}`}>
      <div 
        className={`relative bg-black rounded-lg overflow-hidden shadow-lg ${
          isShorts ? 'max-w-[400px] w-full' : 'w-full'
        }`}
        style={{ 
          aspectRatio: isShorts ? '9/16' : '16/9',
          maxWidth: isShorts ? 'min(400px, 90vw)' : '100%',
          width: isShorts ? 'min(400px, 90vw)' : '100%'
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
  originalUrl 
}: { 
  videoId: string; 
  title?: string; 
  originalUrl?: string;
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
  variant = 'default',
  searchTerm = null,
  isReasoningSection = false,
  messageType = 'default',
  thumbnailMap = {},
  titleMap = {},
  isMobile = false
}: MarkdownContentProps) {

  // Image modal state
  const [selectedImage, setSelectedImage] = useState<{ src: string; alt: string } | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  
  // Image gallery state
  const [imageGallery, setImageGallery] = useState<{ src: string; alt: string }[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isGalleryMode, setIsGalleryMode] = useState(false);

  // Check if we're in browser environment for portal rendering
  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  // Image modal functions
  const openImageModal = useCallback((src: string | undefined, alt: string, allImages?: { src: string; alt: string; originalMatch?: string }[], imageIndex?: number) => {
    if (src && typeof src === 'string') {
      console.log('Opening image modal:', { src, alt, allImages, imageIndex });
      setSelectedImage({ src, alt });
      
      // If multiple images are provided, set up gallery mode
      if (allImages && allImages.length > 1) {
        console.log('Setting up gallery mode with', allImages.length, 'images');
        setImageGallery(allImages);
        setCurrentImageIndex(imageIndex || 0);
        setIsGalleryMode(true);
      } else {
        console.log('Single image mode');
        setImageGallery([]);
        setCurrentImageIndex(0);
        setIsGalleryMode(false);
      }
    }
  }, []);

  const closeImageModal = useCallback(() => {
    setSelectedImage(null);
    setImageGallery([]);
    setCurrentImageIndex(0);
    setIsGalleryMode(false);
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
      console.log('Navigating to previous image:', prevIndex, 'of', imageGallery.length);
      setCurrentImageIndex(prevIndex);
      setSelectedImage(imageGallery[prevIndex]);
    }
  }, [imageGallery, currentImageIndex]);

  // Handle keyboard navigation for image modal and gallery
  useEffect(() => {
    if (!selectedImage && !isGalleryMode) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeImageModal();
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
  }, [selectedImage, isGalleryMode, imageGallery.length, navigateToNextImage, navigateToPreviousImage, closeImageModal]);

  // Pre-process the content to handle LaTeX and escape currency dollar signs
  const processedContent = useMemo(() => {
    return preprocessLaTeX(content);
  }, [content]);

  // Build message groups (arrays of segments). When segmentation is disabled, treat as a single group.
  const segments = useMemo(() => {
    if (!enableSegmentation) return [[processedContent]];
    return segmentContent(processedContent);
  }, [processedContent, enableSegmentation]);

  // Extract all images from content for gallery functionality
  const allImages = useMemo(() => {
    const images: { src: string; alt: string; originalMatch?: string }[] = [];
    
    // Extract images from markdown image syntax (these are already processed from IMAGE_ID)
    const markdownImageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    let match;
    while ((match = markdownImageRegex.exec(processedContent)) !== null) {
      const [fullMatch, alt, src] = match;
      images.push({ 
        src, 
        alt: alt || `Image ${images.length + 1}`,
        originalMatch: fullMatch
      });
    }
    
    // Extract raw image URLs
    const rawImageRegex = /(https:\/\/image\.pollinations\.ai\/[^\s)]+)/g;
    while ((match = rawImageRegex.exec(processedContent)) !== null) {
      const src = match[1];
      images.push({ 
        src, 
        alt: `Generated image ${images.length + 1}`,
        originalMatch: match[0]
      });
    }
    
    console.log('Extracted images for gallery:', images);
    return images;
  }, [processedContent]);



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
      
      // Skip if it's a YouTube URL or image URL (already handled)
      if (url.includes('youtube.com') || url.includes('youtu.be') || url.includes('image.pollinations.ai')) {
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
                  className="w-auto max-w-full hover:opacity-90 transition-opacity border border-[var(--accent)] shadow-md " 
                  style={{ borderRadius: '32px' }}
                  onImageClick={() => {
                    // Find the image index by matching the URL or the original match
                    const imageIndex = allImages.findIndex(img => 
                      img.src === urlWithNoLogo || 
                      img.src === imageUrl ||
                      img.originalMatch === `![](${imageUrl})` ||
                      img.originalMatch === `![${altText || ""}](${imageUrl})` ||
                      (img.originalMatch && img.originalMatch.includes(imageUrl))
                    );
                    console.log('Image click - found index:', imageIndex, 'for URL:', urlWithNoLogo);
                    openImageModal(urlWithNoLogo, altText || "Generated image", allImages, imageIndex >= 0 ? imageIndex : 0);
                  }}
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
                  onImageClick={() => {
                    // Find the image index by matching the URL or the original match
                    const imageIndex = allImages.findIndex(img => 
                      img.src === urlWithNoLogo || 
                      img.src === imageUrl ||
                      img.originalMatch === `![](${imageUrl})` ||
                      img.originalMatch === `![Generated image](${imageUrl})` ||
                      (img.originalMatch && img.originalMatch.includes(imageUrl))
                    );
                    console.log('Image click - found index:', imageIndex, 'for URL:', urlWithNoLogo);
                    openImageModal(urlWithNoLogo, "Generated image", allImages, imageIndex >= 0 ? imageIndex : 0);
                  }}
                />
              </div>
              <div className="text-sm text-[var(--muted)] mt-2 italic text-center">Generated Image</div>
            </div>
          );
        }
        
        // Process for raw image URLs
        const processedImageContent = styleImageUrls(children);
        
      // Process for raw YouTube URLs
      const processedYouTubeContent = Array.isArray(processedImageContent) ? processedImageContent : styleYouTubeUrls(processedImageContent);
      
      // Process for TikTok URLs
      const processedTikTokContent = Array.isArray(processedYouTubeContent) ? processedYouTubeContent : styleTikTokUrls(processedYouTubeContent);
      
      // Process for Google Video links
      const processedGoogleVideoContent = Array.isArray(processedTikTokContent) ? processedTikTokContent : styleGoogleVideoLinks(processedTikTokContent);
      
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
                return (
                  <div key={part.key} className="my-4">
                    <div className="block cursor-pointer">
                      <ImageWithLoading 
                        src={part.url} 
                        alt="Generated image" 
                        className="w-auto max-w-full hover:opacity-90 transition-opacity border border-[var(--accent)] shadow-md " 
                        style={{ borderRadius: '32px' }}
                        onImageClick={() => {
                          // Find the image index by matching the URL or the original match
                          const imageIndex = allImages.findIndex(img => 
                            img.src === part.url ||
                            img.originalMatch === `![](${part.url})` ||
                            img.originalMatch === `![Generated image](${part.url})` ||
                            (img.originalMatch && img.originalMatch.includes(part.url))
                          );
                          console.log('Image click - found index:', imageIndex, 'for URL:', part.url);
                          openImageModal(part.url, "Generated image", allImages, imageIndex >= 0 ? imageIndex : 0);
                        }}
                      />
                      <div className="text-xs text-[var(--muted)] mt-2 text-center break-all">
                        {part.display as string}
                      </div>
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
                  />
                );
              } else if (part.type === 'tiktok_link' && 'videoId' in part && 'url' in part) {
                return (
                  <TikTokEmbed 
                    key={part.key}
                    videoId={part.videoId as string} 
                    title="TikTok video" 
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
      // Agent 도구에서 생성된 이미지 URL을 처리합니다
      if (src && typeof src === 'string' && (src.includes('image.pollinations.ai'))) {
        const urlWithNoLogo = ensureNoLogo(src);
        
        return (
          <div className="block my-4 cursor-pointer">
                          <ImageWithLoading 
                src={urlWithNoLogo} 
                alt={alt || "Generated image"} 
                className="w-auto max-w-full hover:opacity-90 transition-opacity border border-[var(--accent)] shadow-md " 
                style={{ borderRadius: '18px' }}
                onImageClick={() => {
                  // Find the image index by matching the URL or the original match
                  const imageIndex = allImages.findIndex(img => 
                    img.src === urlWithNoLogo || 
                    img.src === src ||
                    img.originalMatch === `![](${src})` ||
                    img.originalMatch === `![${alt || "Generated image"}](${src})` ||
                    (img.originalMatch && img.originalMatch.includes(src))
                  );
                  console.log('Image click - found index:', imageIndex, 'for URL:', urlWithNoLogo);
                  openImageModal(urlWithNoLogo, alt || "Generated image", allImages, imageIndex >= 0 ? imageIndex : 0);
                }}
                {...props}
              />
            {alt && <div className="text-sm text-[var(--muted)] mt-2 italic text-center">{alt}</div>}
          </div>
        );
      }
      
      // Regular image rendering with loading state and modal
      return src ? (
        <div className="my-1 cursor-pointer">
          <ImageWithLoading 
            src={src} 
            alt={alt || "Image"} 
            className="w-auto max-w-full hover:opacity-90 transition-opacity" 
            style={{ borderRadius: '18px' }}
            onImageClick={() => {
              if (typeof src === 'string') {
                // Find the image index by matching the URL or the original match
                const imageIndex = allImages.findIndex(img => 
                  img.src === src ||
                  img.originalMatch === `![](${src})` ||
                  img.originalMatch === `![${alt || "Image"}](${src})` ||
                  (img.originalMatch && img.originalMatch.includes(src))
                );
                console.log('Image click - found index:', imageIndex, 'for URL:', src);
                openImageModal(src, alt || "Image", allImages, imageIndex >= 0 ? imageIndex : 0);
              }
            }}            {...props} 
          />
          {alt && <div className="text-sm text-[var(--muted)] mt-2 italic text-center">{alt}</div>}
        </div>
      ) : (
        <span className="text-[var(--muted)]">[Unable to load image]</span>
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
            />
          );
        }
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
                  className="w-auto max-w-full hover:opacity-90 transition-opacity border border-[var(--accent)] shadow-md " 
                  style={{ borderRadius: '18px' }}
                  onImageClick={() => {
                    // Find the image index by matching the URL or the original match
                    const imageIndex = allImages.findIndex(img => 
                      img.src === urlWithNoLogo || 
                      img.src === href ||
                      img.originalMatch === `![](${href})` ||
                      img.originalMatch === `![${linkText || "Generated image"}](${href})` ||
                      (img.originalMatch && img.originalMatch.includes(href))
                    );
                    console.log('Image click - found index:', imageIndex, 'for URL:', urlWithNoLogo);
                    openImageModal(urlWithNoLogo, linkText || "Generated image", allImages, imageIndex >= 0 ? imageIndex : 0);
                  }}
                />
            </div>
            <div className="text-sm text-[var(--muted)] mt-2 italic text-center">{linkText}</div>
          </div>
        );
      }
      
      // Regular link rendering with LinkPreview
      if (href && typeof href === 'string' && (href.startsWith('http://') || href.startsWith('https://'))) {
        return (
          <div className="my-0.5">
            <LinkPreview url={href} thumbnailUrl={thumbnailUrl} searchApiTitle={searchApiTitle} />
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
      
      useEffect(() => {
        if (ulRef.current) {
          // Check if this ul is inside a li element
          const parentLi = ulRef.current.closest('li');
          setIsNested(!!parentLi);
        }
      }, []);
      
      return (
        <ul
          ref={ulRef}
          className={`my-4 list-disc list-outside ${
            isNested ? 'pl-2' : 'pl-[1.3rem] md:pl-[0.9rem]'
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
      
      useEffect(() => {
        if (olRef.current) {
          // Check if this ol is inside a li element
          const parentLi = olRef.current.closest('li');
          setIsNested(!!parentLi);
        }
      }, []);
      
      return (
        <ol 
          ref={olRef}
          className={`my-4 list-decimal list-outside ${
            isNested ? 'pl-2' : 'pl-[1.5rem] md:pl-[1.1rem]'
          }`}
          {...props}
        >
          {children}
        </ol>
      );
    },
    li: ({ children, ...props }) => (
      <li className="my-3 break-words leading-relaxed" style={{ 
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
      <h1 className="text-3xl font-semibold tracking-tight break-words" {...props}>
        {highlightSearchTermInChildren(children, searchTerm, { messageType })}
      </h1>
    ),
    h2: ({ children, ...props }) => (
      <h2 className="text-3xl font-semibold tracking-tight break-words" {...props}>
        {highlightSearchTermInChildren(children, searchTerm, { messageType })}
      </h2>
    ),
    h3: ({ children, ...props }) => (
      <h3 className="text-2xl font-semibold tracking-tight break-words" {...props}>
        {highlightSearchTermInChildren(children, searchTerm, { messageType })}
      </h3>
    ),
    strong: ({ children, ...props }) => (
      <strong className="text-lg" {...props}>
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
    math: ({ value, inline }: MathProps) => {
      // For block math, use the dedicated wrapper component
      if (!inline) {
        return <MathBlock content={value} />;
      }
      
      // For inline math, use the simpler inline wrapper
      return <InlineMath content={value} />;
    },
  }), [styleImageUrls, extractText, handleCopy, openImageModal, searchTerm]);

  // Memoize the remarkPlugins and rehypePlugins
  const remarkPlugins = useMemo(() => [remarkGfm, remarkMath], []);
  
  // Updated rehypePlugins with proper configuration
  const rehypePlugins = useMemo(() => {
    return [
      [rehypeRaw, { passThrough: ['math', 'inlineMath'] }],
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

        return (
          <div key={groupIndex} className={isReasoningSection ? '' : 'imessage-receive-bubble'}>
            <div className={isReasoningSection ? 'markdown-segments' : 'message-segments'}>
              {segmentGroup.map((segment, index) => {
              // 이미지 세그먼트인지 확인
              const isImageSegment = /\[IMAGE_ID:|!\[.*\]\(.*\)/.test(segment);
              
              // 링크 세그먼트인지 확인
              const isLinkSegment = /\[.*\]\(https?:\/\/[^)]+\)|https?:\/\/[^\s"'<>]+/.test(segment);
              
              // 단일 줄 불릿 포인트인지 확인
              const isSingleLineBullet = /^[-*+]\s/.test(segment.trim()) && !segment.includes('\n');
              
              // 볼드가 바로 옆에 있는 bullet point인지 확인 (연속/단일 상관없이)
              const hasBoldNextToBullet = /^[-*+]\s+\*\*/.test(segment.trim()) || 
                                          /\n\s*[-*+]\s+\*\*/.test(segment);
              
              // bullet point에서 bullet 제거한 텍스트
              let processedSegment = segment;
              
              if (isSingleLineBullet) {
                // 단일 줄 bullet point는 bullet 제거
                processedSegment = segment.replace(/^[-*+]\s/, '').trim();
              } else if (hasBoldNextToBullet) {
                // 볼드가 바로 옆에 있는 bullet point들은 모든 줄에서 bullet만 제거
                processedSegment = segment.replace(/^(\s*)[-*+]\s+/gm, '$1');
              }
              
              // 테이블 세그먼트인지 확인 (마크다운 표 패턴: 헤더 행 + 구분 행 존재)
              const isTableSegment = /(^|\n)\s*\|.*\|\s*(\n|$)/.test(segment) && /(^|\n)\s*\|?\s*[:\-]+\s*(\|\s*[:\-]+\s*)+\|?\s*(\n|$)/.test(segment);
              
              // 헤더 세그먼트인지 확인 (#, ##, ###)
              const isHeaderSegment = /^#{1,3}\s/.test(segment.trim());
              
              // h2 헤더 세그먼트인지 확인
              const isH2HeaderSegment = /^##\s/.test(segment.trim());
              
              // 이전 세그먼트가 이미지 세그먼트인지 확인
              const prevIsImage = index > 0 && /\[IMAGE_ID:|!\[.*\]\(.*\)/.test(segmentGroup[index - 1]);
              
              // 다음 세그먼트가 이미지 세그먼트인지 확인
              const nextIsImage = index < segmentGroup.length - 1 && /\[IMAGE_ID:|!\[.*\]\(.*\)/.test(segmentGroup[index + 1]);
              
              // 연속된 이미지 세그먼트인지 확인
              const isConsecutiveImage = isImageSegment && (prevIsImage || nextIsImage);
              
              // 연속된 이미지가 있는지 확인 (현재 이미지가 연속된 이미지인 경우만)
              const hasConsecutiveImages = isConsecutiveImage;
              
              // 텍스트와 겹치지 않도록 확인
              const hasTextBefore = index > 0 && !/\[IMAGE_ID:|!\[.*\]\(.*\)/.test(segmentGroup[index - 1]);
              const hasTextAfter = index < segmentGroup.length - 1 && !/\[IMAGE_ID:|!\[.*\]\(.*\)/.test(segmentGroup[index + 1]);
              
              // 연속 이미지들의 겹침을 완전히 제거하는 스타일 계산
              const getImageStyle = (): React.CSSProperties => {
                if (!isConsecutiveImage) return {};
                
                // 연속 이미지들의 총 개수 계산
                const consecutiveImageCount = segmentGroup.filter(seg => 
                  /\[IMAGE_ID:|!\[.*\]\(.*\)/.test(seg)
                ).length;
                
                // 이미지 인덱스에 따른 체계적인 위치 계산
                const imageIndex = segmentGroup.slice(0, index + 1).filter(seg => 
                  /\[IMAGE_ID:|!\[.*\]\(.*\)/.test(seg)
                ).length - 1;
                
                // 겹침을 일정하게 번갈아가면서 표현하기 위한 X 오프셋 계산
                const baseOffset = 15;
                const maxOffset = 0;
                // const maxOffset = 45;
                let offsetX = Math.floor((imageIndex + 1) / 2) * baseOffset;
                if (offsetX > maxOffset) offsetX = maxOffset;
                if (imageIndex % 2 !== 0) { // odd indexes are on the left
                    offsetX = -offsetX;
                }

                // 모바일에서 이미지가 너무 왼쪽으로 치우치지 않도록 조정
                const finalRandomX = isMobile && offsetX < 0 ? Math.max(offsetX, 0) : offsetX;
  
                // 회전 각도도 더 작게 조정
                const randomRotate = (imageIndex % 3 - 1) * 1.5; // -1.5도, 0도, 1.5도만 사용
                
                // 모든 이미지가 클릭 가능하도록 매우 높은 z-index 설정
                const zIndexValue = (hasTextBefore || hasTextAfter) ? -1 : 100 + imageIndex; // 각 이미지마다 다른 높은 z-index
                
                // iMessage처럼 겹치도록 margin 조정
                const marginTop = prevIsImage ? '-40px' : '0';
                // const marginTop = prevIsImage ? '-10px' : '0';
                const marginBottom = '0';
                const marginLeft = `${finalRandomX}px`;
                const marginRight = '0';
                
                return {
                  marginTop,
                  marginBottom,
                  marginLeft,
                  marginRight,
                  transform: `rotate(${randomRotate}deg)`,
                  zIndex: zIndexValue,
                  position: 'relative' as const,
                  transition: 'all 0.3s ease-in-out',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                  cursor: 'pointer',
                  pointerEvents: 'auto', // 명시적으로 포인터 이벤트 활성화
                  isolation: 'isolate', // 새로운 스택킹 컨텍스트 생성
                  // 이미지가 컨테이너를 넘어서도 보이도록 설정
                  overflow: 'visible',
                  minWidth: 'fit-content'
                };
              };
              
              const nextIsHeader = index < segmentGroup.length - 1 && /^#{1,3}\s/.test(segmentGroup[index + 1].trim());

              const isLastBubble = !isImageSegment && !isLinkSegment && (index === lastBubbleIndex || nextIsHeader);
              return (
                <div 
                  key={index} 
                  className={`${isImageSegment ? (hasConsecutiveImages ? (isMobile ? 'max-w-[45%]' : 'max-w-[100%] md:max-w-[90%]') : (isMobile ? 'max-w-[55%]' : 'max-w-[100%] md:max-w-[70%]')) : ''} ${(isImageSegment || isLinkSegment) ? '' : `${variant === 'clean' ? 'markdown-segment' : 'message-segment'}${isSingleLineBullet ? ' single-line-bullet' : ''}${isLastBubble ? ' last-bubble' : ''}${isTableSegment ? ' table-segment' : ''}${isHeaderSegment ? ' contains-header' : ''}${isH2HeaderSegment ? ' contains-h2-header' : ''}`}`}
                  style={{
                    ...getImageStyle(),
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
                      pointerEvents: 'auto', // 모든 이미지가 클릭 가능하도록
                      position: 'relative',
                      zIndex: isConsecutiveImage ? 100 + index : 'auto', // 연속 이미지의 경우 매우 높은 z-index
                      // 이미지가 컨테이너를 넘어서도 보이도록 설정
                      overflow: 'visible',
                      minWidth: 'fit-content',
                      width: 'auto'
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
      {isMounted && selectedImage && createPortal(
        <div 
          className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center" 
          onClick={closeImageModal}
        >
          {/* Close button */}
          <button 
            className="absolute top-4 right-4 bg-black/40 hover:bg-black/60 p-2 rounded-full text-white transition-colors z-10"
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
            className="absolute top-4 left-4 bg-black/40 hover:bg-black/60 p-2 rounded-lg text-white transition-colors flex items-center gap-2 z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink size={16} />
            <span className="hidden sm:inline">View Original</span>
          </a>

          {/* Gallery navigation buttons */}
          {isGalleryMode && imageGallery.length > 1 && (
            <>
              {/* Previous button */}
              <button
                className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 p-3 rounded-full text-white transition-colors z-10"
                onClick={(e) => {
                  e.stopPropagation();
                  navigateToPreviousImage();
                }}
                aria-label="Previous image"
              >
                <ChevronLeft size={24} />
              </button>
              
              {/* Next button */}
              <button
                className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 p-3 rounded-full text-white transition-colors z-10"
                onClick={(e) => {
                  e.stopPropagation();
                  navigateToNextImage();
                }}
                aria-label="Next image"
              >
                <ChevronRight size={24} />
              </button>
            </>
          )}

          {/* Gallery counter */}
          {isGalleryMode && imageGallery.length > 1 && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/40 px-3 py-1 rounded-full text-white text-sm z-10">
              {currentImageIndex + 1} / {imageGallery.length}
            </div>
          )}
          
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
              
              {/* Caption below the image - only for generated images */}
              {selectedImage.alt && (
                selectedImage.src.includes('image.pollinations.ai') || 
                selectedImage.alt.includes('Generated image')
              ) && (
                <div className="text-center text-white text-sm mt-4 z-10 bg-black/30 py-2 px-4 rounded-md">
                  {selectedImage.alt}
                </div>
              )}
            </div>
          </div>

          {/* Thumbnail indicators */}
          {isGalleryMode && imageGallery.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
              {imageGallery.map((_, index) => (
                <button
                  key={index}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    index === currentImageIndex 
                      ? 'bg-white' 
                      : 'bg-white/40 hover:bg-white/60'
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentImageIndex(index);
                    setSelectedImage(imageGallery[index]);
                  }}
                  aria-label={`Go to image ${index + 1}`}
                />
              ))}
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  );
}); 
