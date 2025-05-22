import { useState, useMemo, memo, useCallback, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import rehypeHighlight from 'rehype-highlight';
import mermaid from 'mermaid';
import { MathJaxEquation } from './math/MathJaxEquation';
import React from 'react';

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

interface MarkdownContentProps {
  content: string;
}

// Image component with loading state
const ImageWithLoading = memo(function ImageWithLoadingComponent({ 
  src, 
  alt, 
  className = "",
  ...props 
}: React.ImgHTMLAttributes<HTMLImageElement>) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  
  // 로딩 애니메이션 효과를 위한 상태
  const [loadingTime, setLoadingTime] = useState(0);
  
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
  const isValidUrl = src && (
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
      
      {error && (
        <div className="bg-[var(--accent)] rounded-lg p-6 text-center text-[var(--muted)]">
          <svg className="w-10 h-10 mx-auto mb-3 text-[var(--muted)]" fill="none" strokeWidth="1.5" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <div className="mb-1">Image failed to load</div>
          {alt && <div className="text-sm italic mb-2 opacity-75">{alt}</div>}
          {src && (
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
        className={`${className} ${isLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-500 rounded-lg`}
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
export const MarkdownContent = memo(function MarkdownContentComponent({ content }: MarkdownContentProps) {

  // Pre-process the content to handle LaTeX and escape currency dollar signs
  const processedContent = useMemo(() => {
    return preprocessLaTeX(content);
  }, [content]);

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
      
      parts.push({
        type: 'image_link',
        key: match.index,
        url: decodedUrl,
        display: decodedUrl
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
    
    p: ({ children, ...props }) => {
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
          
          return (
            <div className="my-4">
              <a 
                href={decodedUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="block"
              >
                <ImageWithLoading 
                  src={decodedUrl} 
                  alt={altText || "Generated image"} 
                  className="rounded-lg max-w-full hover:opacity-90 transition-opacity cursor-pointer border border-[var(--accent)] shadow-md" 
                />
              </a>
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
          
          return (
            <div className="my-4">
              <a 
                href={decodedUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="block"
              >
                <ImageWithLoading 
                  src={decodedUrl} 
                  alt="Generated image" 
                  className="rounded-lg max-w-full hover:opacity-90 transition-opacity cursor-pointer border border-[var(--accent)] shadow-md" 
                />
              </a>
              <div className="text-sm text-[var(--muted)] mt-2 italic text-center">Generated Image</div>
            </div>
          );
        }
        
        // Process for raw image URLs
        const processedContent = styleImageUrls(children);
        
        // Handle special image links
        if (Array.isArray(processedContent)) {
          const elements = processedContent.map((part, index) => {
            if (typeof part === 'string') {
              return <span key={index}>{styleMentions(part)}</span>;
            } else if (part && typeof part === 'object' && 'type' in part && part.type === 'image_link') {
              return (
                <div key={part.key} className="my-4">
                  <a 
                    href={part.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <ImageWithLoading 
                      src={part.url} 
                      alt="Generated image" 
                      className="rounded-lg max-w-full hover:opacity-90 transition-opacity cursor-pointer border border-[var(--accent)] shadow-md" 
                    />
                    <div className="text-xs text-[var(--muted)] mt-2 text-center break-all">
                      {part.display}
                    </div>
                  </a>
                </div>
              );
            }
            return null;
          });
          
          return <>{elements}</>;
        }
        
        // For regular text, just render with styleMentions
        return <p className="my-3 leading-relaxed" {...props}>{styleMentions(children)}</p>;
      }
      
      // If children is not a string, render as-is
      return <p className="my-3 leading-relaxed" {...props}>{children}</p>;
    },
    img: ({ src, alt, ...props }) => {
      // Agent 도구에서 생성된 이미지 URL을 처리합니다
      if (src && (src.includes('image.pollinations.ai'))) {
        return (
          <a 
            href={src} 
            target="_blank" 
            rel="noopener noreferrer"
            className="block my-4"
          >
            <ImageWithLoading 
              src={src} 
              alt={alt || "Generated image"} 
              className="rounded-lg max-w-full hover:opacity-90 transition-opacity cursor-pointer border border-[var(--accent)] shadow-md" 
              {...props}
            />
            {alt && <div className="text-sm text-[var(--muted)] mt-2 italic text-center">{alt}</div>}
          </a>
        );
      }
      
      // Regular image rendering with loading state
      return src ? (
        <ImageWithLoading src={src} alt={alt} className="my-4 rounded-lg max-w-full" {...props} />
      ) : (
        <span className="text-[var(--muted)]">[Unable to load image]</span>
      );
    },
    a: ({ href, children, ...props }) => (
      <a 
        href={href} 
        target="_blank" 
        rel="noopener noreferrer" 
        className="text-[var(--foreground)] border-b border-[var(--muted)] hover:border-[var(--foreground)] transition-colors"
        {...props}
      >
        {children}
      </a>
    ),
    code: ({ className, children, ...props }) => {
      const match = /language-(\w+)/.exec(className || '');
      const isInline = !match;
      
      if (isInline) {
        return (
          <code className="font-mono text-sm bg-[var(--inline-code-bg)] text-[var(--inline-code-text)] px-1.5 py-0.5 rounded" {...props}>
            {children}
          </code>
        );
      }
      
      const language = match?.[1] || '';
      const codeText = extractText(children);
    
      // Handle math code blocks - with dedicated wrapper component
      if (language === 'math') {
        // Use a stable key based on content to avoid unnecessary remounts
        const key = `math-code-${codeText.slice(0, 20).replace(/\W/g, '')}`;
        
        // Remove the MathBlock from any potential paragraph by wrapping in a div with a key
        return (
          <div className="non-paragraph-wrapper" key={key}>
            <MathBlock content={codeText} />
          </div>
        );
      }
      
      // Render code blocks in a div instead of a pre inside p to avoid hydration issues
      return (
        <div className="message-code group relative my-6 max-w-full overflow-hidden">
          <div className="message-code-header flex items-center justify-between px-4 py-2">
            <span className="text-xs uppercase tracking-wider text-[var(--muted)] break-all">
              {language || 'text'}
            </span>
            <button
              onClick={(e) => handleCopy(codeText, e)}
              className="text-xs uppercase tracking-wider px-2 py-1 
                       text-[var(--muted)] hover:text-[var(--foreground)] 
                       transition-colors whitespace-nowrap ml-2"
            >
              Copy
            </button>
          </div>
          <pre className="overflow-x-auto p-4 m-0 bg-[var(--code-bg)] text-[var(--code-text)] max-w-full whitespace-pre-wrap break-all">
            {children}
          </pre>
        </div>
      );
    },
    table: ({ children, ...props }) => (
      <div className="overflow-x-auto my-6">
        <table className="w-full border-collapse" {...props}>{children}</table>
      </div>
    ),
    th: ({ children, ...props }) => (
      <th className="bg-[var(--accent)] font-medium text-[var(--muted)] uppercase tracking-wider p-3 border border-[var(--accent)]" {...props}>
        {children}
      </th>
    ),
    td: ({ children, ...props }) => (
      <td className="p-3 border border-[var(--accent)]" {...props}>{children}</td>
    ),
    blockquote: ({ children, ...props }) => (
      <blockquote className="border-l-2 border-[var(--muted)] pl-4 my-6 text-[var(--muted)] italic" {...props}>
        {children}
      </blockquote>
    ),
    ul: ({ children, ...props }) => (
      <ul className="my-4 pl-5" style={{ listStylePosition: 'outside', listStyleType: 'disc' }} {...props}>
        {children}
      </ul>
    ),
    ol: ({ children, ...props }) => (
      <ol className="my-4 pl-5" style={{ listStylePosition: 'outside', listStyleType: 'decimal' }} {...props}>
        {children}
      </ol>
    ),
    li: ({ children, ...props }) => (
      <li className="my-2" style={{ display: 'list-item' }} {...props}>{children}</li>
    ),
    h1: ({ children, ...props }) => (
      <h1 className="text-2xl font-bold mt-8 mb-4" {...props}>{children}</h1>
    ),
    h2: ({ children, ...props }) => (
      <h2 className="text-xl font-bold mt-6 mb-3" {...props}>{children}</h2>
    ),
    h3: ({ children, ...props }) => (
      <h3 className="text-lg font-bold mt-5 mb-2" {...props}>{children}</h3>
    ),
    math: ({ value, inline }: MathProps) => {
      // For block math, use the dedicated wrapper component
      if (!inline) {
        return <MathBlock content={value} />;
      }
      
      // For inline math, use the simpler inline wrapper
      return <InlineMath content={value} />;
    },
  }), [styleMentions, styleImageUrls, extractText, handleCopy]);

  // Memoize the remarkPlugins and rehypePlugins
  const remarkPlugins = useMemo(() => [remarkGfm, remarkMath], []);
  
  // Updated rehypePlugins with proper configuration
  const rehypePlugins = useMemo(() => {
    return [
      [rehypeRaw, { passThrough: ['math', 'inlineMath'] }],
      rehypeSanitize,
      rehypeHighlight,
    ] as any;
  }, []);

  return (
    <ReactMarkdown
      className="message-content break-words"
      remarkPlugins={remarkPlugins}
      rehypePlugins={rehypePlugins}
      components={components}
    >
      {processedContent}
    </ReactMarkdown>
  );
}); 